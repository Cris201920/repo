import { playBossAnim, kindFor } from "./bossanim.js";
// systems/bosses.js - IA de bosses: fases, habilidades especiais, invocação por sigilo
// A barra de vida é nativa (componente minecraft:boss na entidade).
import { world, system } from "@minecraft/server";
import { placeArena, anchorFromPlayer, keyOfBoss } from "./arenas.js";
import { BOSSES, BOSS_BY_TYPE } from "../data/bosses.js";
import { say, toast, playSound, isValid, add, norm, dot, sub, rand, healthComp, heal } from "../core/utils.js";
import { fx, ring, line, level as fxLevel } from "./fx.js";
import { addBuff } from "./effects.js";
import { SOUNDS } from "../config.js";

const live = new Map(); // entityId -> { e, def, phase, cds, gcd }
const spawnCd = new Map(); // playerId -> tick
const DIMS = ["overworld", "nether", "the_end"];

function hurt(pl, b, mult) {
  try { pl.applyDamage(b.def.dmgBase * mult, { cause: "entityAttack", damagingEntity: b.e }); } catch { /* ignore */ }
}
function pushPl(pl, from, strength, up = 0.35, inward = false) {
  try {
    let dx = pl.location.x - from.x, dz = pl.location.z - from.z; if (inward) { dx = -dx; dz = -dz; }
    const l = Math.hypot(dx, dz) || 1; pl.applyKnockback(dx / l, dz / l, strength, up);
  } catch { /* ignore */ }
}
const playersNear = (b, c, r) => { try { return b.e.dimension.getPlayers({ location: c, maxDistance: r }); } catch { return []; } };

// zonas telegrafadas (1,2 s de aviso) que ferem por segundo; no máx. 4 zonas ativas no mundo
let zoneCount = 0;
function zonesAt(b, t, p, col, tickFn) {
  const dim = b.e.dimension, targets = playersNear(b, b.e.location, b.def.range);
  for (let i = 0; i < p.n && zoneCount < 4; i++) {
    const base = targets.length ? targets[i % targets.length].location : t.location;
    const pt = { x: base.x + (i ? rand(-5, 5) : 0), y: base.y, z: base.z + (i ? rand(-5, 5) : 0) };
    ring(dim, pt, p.radius, col === "fire" ? "physical" : "void", t);
    zoneCount++;
    system.runTimeout(() => {
      let n = 0;
      const h = system.runInterval(() => {
        n += 10;
        if (n > p.sec * 20 || !isValid(b.e)) { system.clearRun(h); zoneCount = Math.max(0, zoneCount - 1); return; }
        fx(dim, pt, col, t, 1);
        for (const pl of playersNear(b, pt, p.radius)) tickFn(pl, pt);
      }, 10);
    }, 24);
  }
}

const AB = {
  smash(b, t, p) {
    const c = b.e.location, dim = b.e.dimension;
    ring(dim, c, p.radius, "physical", t); fx(dim, c, "physical", t, 2);
    for (const pl of playersNear(b, c, p.radius)) { hurt(pl, b, p.dmg); pushPl(pl, c, p.knock); }
    playSound(t, "random.explode", 0.7, 0.8);
  },
  charge(b, t, p) {
    const dx = t.location.x - b.e.location.x, dz = t.location.z - b.e.location.z, l = Math.hypot(dx, dz) || 1;
    try { b.e.applyKnockback(dx / l, dz / l, p.power, 0.2); } catch { /* ignore */ }
    fx(b.e.dimension, b.e.location, "boss", t, 2);
  },
  summon(b, t, p) {
    const dim = b.e.dimension;
    let n = 0; try { n = dim.getEntities({ type: p.type, location: b.e.location, maxDistance: 32 }).length; } catch { /* ignore */ }
    if (n >= p.cap) return;
    for (let i = 0; i < p.n; i++) {
      const a = rand(0, Math.PI * 2), loc = { x: b.e.location.x + Math.cos(a) * 3, y: b.e.location.y, z: b.e.location.z + Math.sin(a) * 3 };
      try { dim.spawnEntity(p.type, loc); fx(dim, loc, "arcane", t); } catch { /* ignore */ }
    }
    playSound(t, "mob.evocation_illager.prepare_summon", 1, 1);
  },
  roar(b, t, p) {
    const c = b.e.location;
    ring(b.e.dimension, c, p.radius * 0.6, "boss", t); ring(b.e.dimension, c, p.radius, "boss", t);
    for (const pl of playersNear(b, c, p.radius)) { hurt(pl, b, p.dmg); addBuff(pl, "weak", p.weak); }
    playSound(t, "mob.ravager.roar", 1, 0.8);
  },
  fire_breath(b, t, p) {
    const head = { x: b.e.location.x, y: b.e.location.y + 2, z: b.e.location.z };
    const dir = norm(sub(t.location, head)), cosA = Math.cos((p.angle / 2) * Math.PI / 180);
    for (const k of [0.4, 0.7, 1]) fx(b.e.dimension, add(head, dir, p.range * k), "fire", t, 2);
    for (const pl of playersNear(b, b.e.location, p.range + 1)) {
      const v = sub({ x: pl.location.x, y: pl.location.y + 1, z: pl.location.z }, head);
      if (dot(norm(v), dir) < cosA) continue;
      hurt(pl, b, p.dmg); try { pl.setOnFire(p.burn, true); } catch { /* ignore */ }
    }
    playSound(t, "mob.blaze.shoot", 1, 0.7);
  },
  meteors(b, t, p) {
    const targets = playersNear(b, b.e.location, b.def.range);
    if (targets.length === 0) return;
    for (let i = 0; i < p.count; i++) {
      const pl = targets[i % targets.length];
      const pt = { x: pl.location.x + rand(-4, 4), y: pl.location.y, z: pl.location.z + rand(-4, 4) };
      ring(b.e.dimension, pt, p.radius, "physical", pl);
      system.runTimeout(() => {
        if (!isValid(b.e)) return;
        fx(b.e.dimension, pt, p.fx, pl, 2);
        for (const v of playersNear(b, pt, p.radius)) { hurt(v, b, p.dmg); pushPl(v, pt, 0.8); if (p.fx === "fire") { try { v.setOnFire(3, true); } catch { /* ignore */ } } }
      }, p.delay);
    }
    playSound(t, "mob.ghast.fireball", 1, 0.8);
  },
  void_pull(b, t, p) {
    const c = b.e.location;
    ring(b.e.dimension, c, p.radius, "void", t); fx(b.e.dimension, c, "void", t, 2);
    for (const pl of playersNear(b, c, p.radius)) { pushPl(pl, c, p.pull, 0.25, true); hurt(pl, b, p.dmg); }
    playSound(t, "mob.endermen.portal", 1, 0.6);
  },
  void_shards(b, t, p) {
    const head = { x: b.e.location.x, y: b.e.location.y + 2.5, z: b.e.location.z };
    for (const pl of playersNear(b, b.e.location, b.def.range)) {
      line(b.e.dimension, head, { x: pl.location.x, y: pl.location.y + 1, z: pl.location.z }, "void", pl);
      hurt(pl, b, p.dmg);
    }
    playSound(t, "mob.evocation_illager.cast_spell", 1, 0.7);
  },
  blink(b, t) {
    const v = norm({ x: t.location.x - b.e.location.x, y: 0, z: t.location.z - b.e.location.z });
    const dest = { x: t.location.x + v.x * 3, y: t.location.y, z: t.location.z + v.z * 3 };
    fx(b.e.dimension, b.e.location, "teleport", t, 2);
    try { b.e.teleport(dest, { checkForBlocks: true }); fx(b.e.dimension, dest, "teleport", t, 2); } catch { /* ignore */ }
  },
  drain(b, t, p) {
    const c = b.e.location; let total = 0;
    ring(b.e.dimension, c, p.radius, "shadow", t);
    for (const pl of playersNear(b, c, p.radius)) { hurt(pl, b, p.dmg); total++; }
    const h = healthComp(b.e); if (h && total > 0) heal(b.e, h.effectiveMax * p.heal * total);
  },
  // ---- mecânicas exclusivas (6.20.0): Rei Goblin = tambores de guerra; Senhor do Vazio = fendas; Tirano Brasa = chão de magma
  war_drums(b, t, p) {
    const c = b.e.location; ring(b.e.dimension, c, p.radius * 0.5, "boss", t);
    let n = 0; try { for (const g of b.e.dimension.getEntities({ location: c, maxDistance: p.radius, families: ["goblin"] })) { if (g.id === b.e.id) continue; g.addEffect("speed", p.sec * 20, { amplifier: 1 }); g.addEffect("strength", p.sec * 20, { amplifier: 1 }); n++; } } catch { /* ignore */ }
    for (const pl of playersNear(b, c, 40)) say(pl, `§a§o Os tambores de guerra ecoam${n ? `: ${n} goblins se enfurecem!` : "!"}`);
    playSound(t, "mob.ravager.roar", 1, 1.3);
  },
  reality_tear(b, t, p) { zonesAt(b, t, p, "void", (pl, pt) => { hurt(pl, b, p.dmg); pushPl(pl, pt, 0.35, 0.1, true); }); playSound(t, "mob.endermen.portal", 1, 0.5); },
  magma_floor(b, t, p) { zonesAt(b, t, p, "fire", (pl) => { hurt(pl, b, p.dmg); try { pl.setOnFire(2, true); } catch { /* ignore */ } }); playSound(t, "mob.blaze.shoot", 1, 0.5); },
  barrier(b, t, p) {
    try { b.e.addEffect("resistance", p.sec * 20, { amplifier: 3, showParticles: true }); } catch { /* ignore */ }
    fx(b.e.dimension, b.e.location, "arcane", t, 2);
  },
};

function register(e, def) {
  if (live.has(e.id)) return;
  live.set(e.id, { e, def, phase: -1, cds: new Map(), gcd: 0, aura: 0 });
  try { e.addTag("etheria_boss"); } catch { /* ignore */ }
  try { for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 64 })) { say(p, def.intro); toast(p, `${def.color}§l${def.name}`, "§7desperta..."); playSound(p, SOUNDS.boss, 1, 0.8); } } catch { /* ignore */ }
}
function scan() {
  for (const did of DIMS) {
    let dim; try { dim = world.getDimension(did); } catch { continue; }
    for (const def of Object.values(BOSSES)) {
      try { for (const e of dim.getEntities({ type: def.type })) if (!live.has(e.id)) live.set(e.id, { e, def, phase: -1, cds: new Map(), gcd: 0, aura: 0 }); } catch { /* dimensão não carregada */ }
    }
  }
}
function enterPhase(b, idx) {
  b.phase = idx;
  const ph = b.def.phases[idx];
  try { b.e.triggerEvent(`etheria:phase_${idx + 1}`); } catch { /* ignore */ }
  for (const [id, amp] of ph.fx ?? []) { try { b.e.addEffect(id, 20000000, { amplifier: amp - 1, showParticles: false }); } catch { /* ignore */ } }
  if (idx > 0) {
    for (const p of playersNear(b, b.e.location, 64)) { say(p, b.def.phaseMsg[idx] ?? ""); toast(p, b.def.phaseMsg[idx] ?? "", `§7Fase ${idx + 1}`); playSound(p, SOUNDS.boss, 1, 1.1 - idx * 0.1); }
    fx(b.e.dimension, b.e.location, "transform", undefined, 2);
  }
}

function tick() {
  const now = system.currentTick;
  for (const [id, b] of live) {
    if (!isValid(b.e)) { live.delete(id); continue; }
    const h = healthComp(b.e); if (!h) continue;
    const ratio = h.currentValue / h.effectiveMax;
    let idx = 0; b.def.phases.forEach((p, i) => { if (ratio <= p.hp) idx = i; });
    if (idx !== b.phase) enterPhase(b, idx);
    let target; try { target = b.e.dimension.getPlayers({ location: b.e.location, maxDistance: b.def.range, closest: 1 })[0]; } catch { /* ignore */ }
    if (!target) continue;
    if (fxLevel(target) !== "off") fx(b.e.dimension, { x: b.e.location.x, y: b.e.location.y + 1, z: b.e.location.z }, b.def.particles, target);
    if (now < b.gcd) continue;
    for (const [name, cd, params] of b.def.phases[b.phase].abilities) {
      const key = `${b.phase}:${name}`;
      if ((b.cds.get(key) ?? 0) > now) continue;
      playBossAnim(b.e, kindFor(name), 24);   // 6.37: animação de combate
      try { AB[name](b, target, params); } catch (e) { console.warn(`[Etheria] boss ${b.def.key} ${name}: ${e}`); }
      b.cds.set(key, now + cd * 20); b.gcd = now + 50;
      break;
    }
  }
}

export function useSigil(player, itemTypeId) {
  const def = Object.values(BOSSES).find((b) => b.sigil === itemTypeId);
  if (!def) return { ok: false };
  const now = system.currentTick;
  if ((spawnCd.get(player.id) ?? 0) > now) return { ok: false, msg: "Aguarde antes de invocar novamente." };
  for (const b of live.values()) { if (isValid(b.e) && b.def.key === def.key) return { ok: false, msg: `${def.name} já está ativo no mundo.` }; }
  const dir = norm(player.getViewDirection()), dim = player.dimension;
  const loc = { x: player.location.x + dir.x * 8, y: player.location.y + 0.5, z: player.location.z + dir.z * 8 };
  const key = keyOfBoss(def.key);
  // 6.24: a arena EXCLUSIVA do boss é colocada na hora (uma chamada), e o boss nasce no ponto dela; se a estrutura falhar, ele nasce no local antigo (aviso já enviado)
  const spawn = (at) => { try { const e = dim.spawnEntity(def.type, at); register(e, def); return true; } catch { return false; } };
  if (!key) { if (!spawn(loc)) return { ok: false, msg: "Não foi possível invocar aqui (espaço livre necessário)." }; spawnCd.set(player.id, now + 200); return { ok: true, consume: true }; }
  let sync = true, returned = false;
  placeArena(dim, key, anchorFromPlayer(player, 14), (res) => { const okSpawn = spawn(res.ok ? res.spawn : loc) || spawn(loc); if (!returned) sync = okSpawn; else if (!okSpawn) say(player, `§c[Etheria] Não foi possível invocar ${def.name} aqui.`); });
  returned = true;
  if (!sync) return { ok: false, msg: "Não foi possível invocar aqui (espaço livre necessário)." };
  spawnCd.set(player.id, now + 200);
  return { ok: true, consume: true };
}

export function startBosses() {
  world.afterEvents.entitySpawn.subscribe((ev) => { const def = BOSS_BY_TYPE[ev.entity?.typeId]; if (def) register(ev.entity, def); });
  scan();
  system.runInterval(tick, 20);
  system.runInterval(scan, 400);
}
export function activeBosses() { return [...live.values()].filter((b) => isValid(b.e)); }

import { announceInfo } from "./sageannounce.js";
// systems/agility.js - AGILIDADES SUPREMAS (6.29): executor exec.kind "agility" + esquiva automática + progressão por raça.
// Dados: data/agility.js. Cada movimento tem efeito real (deslocamento, dano no trajeto, invisibilidade, aceleração), animação corporal
// (RP animations/etheria_agility.animation.json via playAnimation), partículas com direção e som. Custos/recargas vêm do pipeline normal de habilidades.
import { world, system } from "@minecraft/server";
import { registerExec, helpers, hasSkill, grantSkill } from "./skills.js";
import { SKILLS } from "../data/skills.js";
import { AGILITY_LINES, AGILITY_OF, AGI_GATES } from "../data/agility.js";
import { getData, markDirty } from "../core/db.js";
import { ctx, mote, streak, ringFlat, burst, implode, T } from "./fxlib.js";
import { add, norm, dist, heal, healthComp, say, toast, isValid } from "../core/utils.js";
import { raceDepth, bossTotal } from "../data/lineages.js";
import { getStats } from "./stats.js";

const H = () => helpers();
const LINE_OF = (sk) => AGILITY_LINES[AGILITY_OF[sk.id]?.race] ?? { fx: ["wind", "white"] };
const anim = (p, id, blend = 0.15) => { try { p.playAnimation(`animation.etheria.agi.${id}`, { blendOutTime: blend }); } catch { /* ignore */ } };
const eff = (e, id, ticks, amp = 0) => { try { e.addEffect(id, ticks, { amplifier: amp, showParticles: false }); } catch { /* ignore */ } };
const PASS = /air|water|lava|grass|fern|flower|sapling|torch|carpet|snow_layer|vine|button|pressure_plate|rail|sign|banner|tall|bush|reeds|kelp|seagrass|web|ladder|lever|rose|tulip|dandelion|poppy|orchid|allium|bluet|daisy|lily|petals|moss_carpet|glow_lichen|light_block|structure_void/;
function passable(dim, x, y, z) {
  try { const b = dim.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }); return !!b && (b.isAir || b.isLiquid || PASS.test(b.typeId)); } catch { return false; }
}
const fits = (dim, p) => passable(dim, p.x, p.y + 0.1, p.z) && passable(dim, p.x, p.y + 1.1, p.z);
/** caminha do ponto inicial na direção dada e devolve o último ponto livre (o jogador nunca entra em parede) */
function travel(dim, from, dir, maxDist) {
  let last = from;
  for (let d = 0.5; d <= maxDist; d += 0.5) { const q = add(from, dir, d); if (!fits(dim, q)) break; last = q; }
  return last;
}
const flat = (v) => norm({ x: v.x, y: 0, z: v.z });
const chest = (p) => ({ x: p.x, y: p.y + 1, z: p.z });

// ------------------------------------------------------------------ efeitos visuais por modo
function afterimage(c, at, cols) {   // silhueta residual: coluna de partículas no formato do corpo
  for (let i = 0; i < 6; i++) mote(c, { x: at.x + (Math.random() - 0.5) * 0.5, y: at.y + 0.2 + i * 0.32, z: at.z + (Math.random() - 0.5) * 0.5 }, { col: i % 2 ? cols[0] : cols[1], tile: T.blob, size: 0.32, life: 0.55, spd: 0.05, a: 0.7, grow: -0.2 });
}
function trail(c, a, b, cols, w = 0.18) {
  streak(c, chest(a), chest(b), { col: cols[0], w, life: 0.35, a: 0.9 });
  streak(c, { x: a.x, y: a.y + 0.4, z: a.z }, { x: b.x, y: b.y + 0.4, z: b.z }, { col: cols[1], w: w * 0.6, life: 0.3, a: 0.7 });
}

// ------------------------------------------------------------------ executor
registerExec("agility", (player, sk, s, d) => {
  const ex = sk.exec, dim = player.dimension, cols = LINE_OF(sk).fx, c = ctx(player, 1.2);
  const view = player.getViewDirection(), dir = flat(view), start = { ...player.location };
  const { around, hitOne, aim } = H();
  const strike = (e, mult = ex.damage ?? 1, extra = {}) => hitOne(player, e, { ...sk, exec: { ...ex, power: mult, ...extra } }, s);

  if (ex.mode === "surge") {
    let reach = ex.dist ?? 7; try { if (ex.wet && (player.isInWater || dim.getBlock(player.location)?.isLiquid)) reach = ex.wet; } catch { /* ignore */ }
    const end = travel(dim, start, dir, reach), len = dist(start, end);
    if (len < 1) return "Sem espaço para avançar.";
    anim(player, ex.boom ? "surge_heavy" : "surge");
    // antecipação (2 ticks) -> deslocamento -> impacto: o dano acontece quando o corpo passa pelo alvo, não antes
    eff(player, "resistance", 10, 1);
    if (ex.resist) eff(player, "resistance", 40, ex.resist - 1);
    system.runTimeout(() => {
      if (!isValid(player)) return;
      try { player.teleport(end, { dimension: dim, keepVelocity: false, checkForBlocks: true, rotation: player.getRotation() }); } catch { return; }
      try { player.applyKnockback(dir.x, dir.z, 0.6, 0.05); } catch { /* ignore */ }   // continua deslizando um pouco: sem parada robótica
      trail(c, start, end, cols, ex.boom ? 0.35 : 0.2);
      for (let i = 0; i < 4; i++) afterimage(c, add(start, dir, (len * i) / 4), cols);
      const hit = new Set();
      for (let k = 0; k <= Math.ceil(len); k += 1.5) for (const e of around(dim, add(start, dir, k), 1.9, player)) {
        if (hit.has(e.id)) continue; hit.add(e.id);
        strike(e, ex.damage ?? 1, ex.slow ? { debuff: { id: "chill", sec: ex.slow } } : ex.stun ? { debuff: { id: "stun", sec: ex.stun } } : {});
        if (ex.knock) { try { const v = norm({ x: e.location.x - start.x, y: 0, z: e.location.z - start.z }); e.applyKnockback(v.x || dir.x, v.z || dir.z, ex.knock, 0.35); } catch { /* ignore */ } }
        if (ex.blind) { eff(e, "slowness", ex.blind * 20, 2); eff(e, "weakness", ex.blind * 20, 0); eff(e, "blindness", ex.blind * 20, 0); }
        burst(c, chest(e.location), { col: cols[0], tile: T.spark, n: 6, spd: 2.2, size: 0.16, life: 0.35 });
      }
      if (ex.boom) {   // estrondo sônico: anel no início e no fim + empurrão em área
        ringFlat(c, start, { col: "white", tile: T.ring, n: 18, radius: 3.2, life: 0.4 }); ringFlat(c, end, { col: cols[0], tile: T.ring, n: 22, radius: 4.5, life: 0.5 });
        for (const e of around(dim, end, 4, player)) { if (hit.has(e.id)) continue; strike(e, (ex.damage ?? 1) * 0.5); try { const v = norm({ x: e.location.x - end.x, y: 0, z: e.location.z - end.z }); e.applyKnockback(v.x, v.z, 1.4, 0.4); } catch { /* ignore */ } }
        try { dim.spawnParticle("minecraft:sonic_explosion", chest(end)); } catch { /* ignore */ }
      }
    }, 2);
    return true;
  }

  if (ex.mode === "blink") {
    const end = travel(dim, start, flat(view), ex.dist ?? 6);
    if (dist(start, end) < 1) return "Sem espaço para o deslocamento.";
    anim(player, "blink");
    afterimage(c, start, cols); implode(c, chest(start), { col: cols[0], tile: T.spark, n: 10, radius: 1.2, life: 0.25 });
    try { player.teleport(end, { dimension: dim, keepVelocity: true, checkForBlocks: true, rotation: player.getRotation() }); } catch { return "Destino inválido."; }
    burst(c, chest(end), { col: cols[1], tile: T.star, n: 10, spd: 1.6, size: 0.18, life: 0.4 });
    eff(player, "resistance", 6, 4);   // 0,3 s de esquiva real durante o deslocamento
    return true;
  }

  if (ex.mode === "phase") {
    const a = aim(player, ex.range ?? 16), t = a.target;
    let end, face;
    if (t) {
      const tv = flat(t.getViewDirection?.() ?? dir);
      for (const off of [{ x: -tv.x * 1.6, z: -tv.z * 1.6 }, { x: tv.z * 1.6, z: -tv.x * 1.6 }, { x: -tv.z * 1.6, z: tv.x * 1.6 }]) {
        const q = { x: t.location.x + off.x, y: t.location.y, z: t.location.z + off.z }; if (fits(dim, q)) { end = q; break; }
      }
      face = t.location;
    }
    if (!end) { end = travel(dim, start, dir, Math.min(8, ex.range ?? 8)); face = undefined; }
    if (dist(start, end) < 1) return "Sem alvo ou espaço.";
    anim(player, "phase");
    afterimage(c, start, cols); trail(c, start, end, cols, 0.1);
    try { player.teleport(end, { dimension: dim, keepVelocity: false, checkForBlocks: true, ...(face ? { facingLocation: chest(face) } : { rotation: player.getRotation() }) }); } catch { return "Destino inválido."; }
    burst(c, chest(end), { col: cols[0], tile: T.shard, n: 12, spd: 2, size: 0.18, life: 0.4 });
    if (t) system.runTimeout(() => { if (isValid(player) && isValid(t)) { anim(player, "slash"); strike(t, ex.crit ?? 1.5, ex.drain ? { drain: ex.drain } : {}); burst(c, chest(t.location), { col: "white", tile: T.cross, n: 8, spd: 2.6, size: 0.22, life: 0.3 }); } }, 4);
    return true;
  }

  if (ex.mode === "airdash") {
    const charges = Math.max(1, ex.charges ?? 1), v = norm({ x: view.x, y: 0, z: view.z });
    const dash = (i) => {
      if (!isValid(player)) return;
      anim(player, i % 2 ? "air_flip" : "air");
      try { player.applyKnockback(v.x, v.z, ex.power ?? 1.6, ex.up ?? 0.7); } catch { /* ignore */ }
      ringFlat(c, player.location, { col: cols[0], tile: T.ring, n: 12, radius: 1.6, life: 0.3 });
      burst(c, player.location, { col: cols[1], tile: T.smoke, n: 6, spd: 0.8, size: 0.3, life: 0.5 });
    };
    for (let i = 0; i < charges; i++) system.runTimeout(() => dash(i), 1 + i * 9);
    eff(player, "slow_falling", 20 * (ex.glide ?? 2) + charges * 9, 0);
    if (ex.slam) watchLanding(player, sk, s, cols);
    return true;
  }

  if (ex.mode === "overdrive") {
    const t = (ex.sec ?? 10) * 20;
    anim(player, "power_up");
    eff(player, "speed", t, ex.speed ?? 2); eff(player, "jump_boost", t, ex.jump ?? 1); if (ex.haste) eff(player, "haste", t, ex.haste);
    if (ex.water) { eff(player, "dolphins_grace", t, 0); eff(player, "water_breathing", t, 0); }
    ringFlat(c, player.location, { col: cols[0], tile: T.ring, n: 24, radius: 3.5, life: 0.6 });
    implode(c, chest(player.location), { col: cols[1], tile: T.star, n: 18, radius: 3, life: 0.5 });
    let n = 0; const h = system.runInterval(() => {   // imagens residuais enquanto corre
      if (!isValid(player) || (n += 4) > t) { system.clearRun(h); return; }
      try { const vel = player.getVelocity(); if (Math.hypot(vel.x, vel.z) > 0.18) afterimage(ctx(player, 0.6), player.location, cols); } catch { /* ignore */ }
    }, 4);
    return true;
  }

  if (ex.mode === "rift") {
    const a = aim(player, ex.range ?? 32);
    let end = a.point; end = add(end, norm(view), -1);
    end = { x: end.x, y: Math.floor(end.y) + 0.05, z: end.z };
    for (let k = 0; k < 4 && !fits(dim, end); k++) end = { ...end, y: end.y + 1 };
    if (!fits(dim, end) || dist(start, end) < 2) return "Sem destino dimensional válido.";
    anim(player, "rift");
    implode(c, chest(start), { col: "void", tile: T.rune1, n: 16, radius: 2, life: 0.35 }); ringFlat(c, start, { col: cols[0], tile: T.ring, n: 16, radius: 2, life: 0.3 });
    system.runTimeout(() => {
      if (!isValid(player)) return;
      try { player.teleport(end, { dimension: dim, keepVelocity: false, checkForBlocks: true, rotation: player.getRotation() }); } catch { return; }
      trail(c, start, end, ["void", cols[0]], 0.12);
      burst(c, chest(end), { col: cols[0], tile: T.rune2, n: 16, spd: 2.4, size: 0.22, life: 0.5 }); ringFlat(c, end, { col: "void", tile: T.ring, n: 18, radius: 2.4, life: 0.4 });
      if (ex.invis) eff(player, "invisibility", ex.invis * 20, 0);
      if (ex.heal) { const h = healthComp(player); if (h) heal(player, h.effectiveMax * ex.heal); }
      eff(player, "resistance", 10, 4);
    }, 3);
    return true;
  }
  return "Modo desconhecido.";
});

// ------------------------------------------------------------------ impacto ao aterrissar (airdash com slam)
function watchLanding(player, sk, s, cols) {
  const ex = sk.exec, sl = ex.slam; let t = 0, left = false;
  const h = system.runInterval(() => {
    t += 2; if (!isValid(player) || t > 80) { system.clearRun(h); return; }
    let ground = false; try { ground = player.isOnGround; } catch { /* ignore */ }
    if (!ground) { left = true; return; }
    if (!left && t < 10) return;
    system.clearRun(h);
    const c = ctx(player, 1.3), at = player.location, { around, hitOne } = H();
    anim(player, "land");
    ringFlat(c, at, { col: cols[0], tile: T.ring, n: 26, radius: sl.radius, life: 0.5 }); burst(c, at, { col: "dust", tile: T.chunk, n: 14, spd: 2.5, size: 0.25, life: 0.6, up: 1 });
    try { player.dimension.playSound("random.explode", at, { volume: 0.6, pitch: 1.3 }); } catch { /* ignore */ }
    for (const e of around(player.dimension, at, sl.radius, player)) {
      hitOne(player, e, { ...sk, exec: { ...ex, power: sl.damage, stat: sl.stat ?? ex.stat, burn: sl.burn, ...(sl.stun ? { debuff: { id: "stun", sec: sl.stun } } : {}) } }, s);
      try { const v = norm({ x: e.location.x - at.x, y: 0, z: e.location.z - at.z }); e.applyKnockback(v.x, v.z, 0.9, 0.45); } catch { /* ignore */ }
    }
  }, 2);
}

// ------------------------------------------------------------------ esquiva automática (passivas com dodge)
const dodgeCd = new Map();
function dodgeOf(d) {
  let best = null;
  for (const id of d.unlockedSkills ?? []) { const sk = SKILLS[id]; if (sk?.dodge && (!best || sk.dodge.chance > best.chance)) best = sk.dodge; }
  return best;
}
function onHurt(ev) {
  const p = ev.hurtEntity; if (p?.typeId !== "minecraft:player" || !isValid(p)) return;
  const amt = ev.damage; if (!(amt > 0)) return;
  const cause = ev.damageSource?.cause; if (cause && !["entityAttack", "projectile", "entityExplosion", "magic", "thorns"].includes(cause)) return;
  const d = getData(p), dg = dodgeOf(d); if (!dg) return;
  const now = system.currentTick; if ((dodgeCd.get(p.id) ?? 0) > now) return;
  // agilidade alta melhora a chance (até +8 pontos percentuais)
  let agi = 0; try { agi = getStats(p)?.agility ?? 0; } catch { /* ignore */ }
  if (Math.random() > dg.chance + Math.min(0.08, agi * 0.001)) return;
  const h = healthComp(p); if (!h || h.currentValue <= 0) return;
  dodgeCd.set(p.id, now + dg.cd * 20);
  heal(p, amt);   // o golpe é anulado
  const src = ev.damageSource?.damagingEntity, dim = p.dimension, at = { ...p.location };
  let side = { x: 1, z: 0 };
  try { const from = src ? norm({ x: at.x - src.location.x, y: 0, z: at.z - src.location.z }) : flat(p.getViewDirection()); side = Math.random() < 0.5 ? { x: -from.z, z: from.x } : { x: from.z, z: -from.x }; } catch { /* ignore */ }
  const end = travel(dim, at, { x: side.x, y: 0, z: side.z }, 2.5);
  try { p.teleport(end, { dimension: dim, keepVelocity: false, checkForBlocks: true, rotation: p.getRotation() }); } catch { /* ignore */ }
  anim(p, "dodge");
  const race = Object.keys(AGILITY_LINES).find((r) => AGILITY_LINES[r].stages.some((x) => x.dodge === dg)), cols = AGILITY_LINES[race]?.fx ?? ["wind", "white"], c = ctx(p, 0.8);
  afterimage(c, at, cols); trail(c, at, end, cols, 0.08);
  try { p.onScreenDisplay.setActionBar("§b» ESQUIVA «"); } catch { /* ignore */ }
  try { p.playSound("mob.phantom.flap", { volume: 0.6, pitch: 1.6 }); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ progressão: requisitos reais e despertar
/** requisitos do estágio idx da linha da raça do jogador: [{ok, text}] */
export function agilityReq(player, race, idx) {
  const d = getData(player), g = AGI_GATES[idx], L = AGILITY_LINES[race], out = [];
  const R = (ok, text) => ({ ok: !!ok, text });
  out.push(R(d.race === race, `Raça: ${race === d.race ? "a sua" : race}`));
  if (idx > 0) out.push(R(hasSkill(d, L.stages[idx - 1].id), `Possuir ${L.stages[idx - 1].name}`));
  out.push(R(d.level >= g.level, `Nível ${g.level} (${d.level})`));
  if (g.depth > 1) out.push(R(raceDepth(d) >= g.depth, `Evolução da raça: estágio ${g.depth} (${raceDepth(d)})`));
  if (g.bosses) out.push(R(bossTotal(d) >= g.bosses, `${g.bosses} chefes derrotados (${bossTotal(d)})`));
  return out;
}
export function agilityAwaken(player, id) {
  const o = AGILITY_OF[id]; if (!o) return { ok: false, msg: "Agilidade inválida." };
  const d = getData(player); if (hasSkill(d, id)) return { ok: false, msg: "Já desperta." };
  const req = agilityReq(player, o.race, o.idx); if (!req.every((r) => r.ok)) return { ok: false, msg: "Requisitos pendentes." };
  grantSkill(player, id); markDirty(player);
  return { ok: true, msg: `${SKILLS[id].name} despertou!` };
}
const told = new Map();
function scanReady() {
  for (const p of world.getAllPlayers()) {
    try {
      const d = getData(p), L = AGILITY_LINES[d.race]; if (!L) continue;
      L.stages.forEach((sk, i) => {
        if (hasSkill(d, sk.id)) return;
        const key = `${p.id}:${sk.id}`; if (told.get(key)) return;
        if (agilityReq(p, d.race, i).every((r) => r.ok)) { told.set(key, 1); announceInfo(p, "AGILIDADE SUPREMA", sk.name, "Pronta para despertar · Árvore de Poderes", "unique"); }
      });
    } catch { /* ignore */ }
  }
}
export function startAgility() {
  try { world.afterEvents.entityHurt.subscribe(onHurt, { entityTypes: ["minecraft:player"] }); } catch { try { world.afterEvents.entityHurt.subscribe(onHurt); } catch { /* ignore */ } }
  system.runInterval(scanReady, 200);
  world.afterEvents.playerLeave.subscribe((ev) => dodgeCd.delete(ev.playerId));
}

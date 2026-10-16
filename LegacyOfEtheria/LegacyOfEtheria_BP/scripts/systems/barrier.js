// systems/barrier.js - 6.55: BARREIRA PASSIVA (habilidade "barrier"): protege 7 golpes, automática, sem botão.
// Proteção REAL (não só visual):
//   - enquanto houver cargas, o jogador mantém Resistência IV invisível (80% menos dano em qualquer fonte: evita morrer de um golpe só);
//   - cada GOLPE válido (ataque corpo a corpo, projétil, explosão, raio, magia lançada por uma criatura) é anulado: o dano que passou é devolvido
//     na hora (cura do valor exato) e 1 carga é gasta;
//   - um mesmo atacante só gasta 1 carga a cada 10 ticks (ataques em área e golpes múltiplos não esvaziam a barreira de uma vez);
//     explosões sem atacante contam 1 carga por tick;
//   - dano CONTÍNUO/ambiental (fogo, veneno, wither, queda, afogamento, fome, congelamento, sufocamento) não gasta carga: só é amortecido
//     pela Resistência; vazio e /kill nunca são bloqueados;
//   - chefes com pressão de poder muito superior (diferença 3+, systems/power.js) furam metade: o golpe gasta 2 cargas e só metade do dano é anulado.
// Ao gastar a 7ª carga a barreira se rompe (explosão de partículas), recarrega por 40 s e se reconstrói sozinha (animação de reconstrução).
// Fora de combate, cargas perdidas voltam 1 a cada 15 s. Cargas e recarga ficam no personagem (d.barrier) -> individuais e salvas.
import { world, system, Player } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { heal, healthComp, isValid, playSound } from "../core/utils.js";
import { ctx, mote, ringFlat, burst, implode, helix, after, T } from "./fxlib.js";
import { inCombat } from "./combat.js";
import { pressureGap, pulse } from "./power.js";
import { sageText } from "./voice.js";
import { emit, EV } from "../core/bus.js";
import { addHudLine } from "./hudhooks.js";

export const BARRIER = { max: 7, rebuildMs: 40000, regenMs: 15000, perAttacker: 10, resistAmp: 3 };
const HIT = new Set(["entityAttack", "projectile", "entityExplosion", "blockExplosion", "lightning", "sonicBoom", "ramAttack", "maceSmash", "fallingBlock", "fireworks", "thorns", "magic"]);
const last = new Map();   // playerId -> Map(chave do atacante -> tick)

export const hasBarrier = (d) => (d.unlockedSkills ?? []).includes("barrier");
export function barrierOf(d) {
  const b = (d.barrier ??= { charges: BARRIER.max, brokenAt: 0, regenAt: 0 });
  if (!(b.charges >= 0)) b.charges = BARRIER.max;
  return b;
}
export const barrierUp = (d) => hasBarrier(d) && barrierOf(d).charges > 0;

const col = (n) => (n <= 2 ? "blood" : n <= 4 ? "gold" : "mana");
const at = (l, y) => ({ x: l.x, y: l.y + y, z: l.z });
function shell(c, p, n, k = 1) {   // casca da barreira: pontos sobre uma esfera em volta do corpo
  const L = p.location;
  for (let i = 0; i < Math.round(k * (n <= 2 ? 10 : 5)); i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - u * u);
    mote(c, { x: L.x + Math.cos(a) * s * 1.05, y: L.y + 0.95 + u * 1.15, z: L.z + Math.sin(a) * s * 1.05 }, { col: col(n), tile: n <= 2 ? T.diamond : T.ring, size: n <= 2 ? 0.16 : 0.12, life: 0.4, a: n <= 2 ? 0.95 : 0.55, spd: 0 });
  }
}
function blockFx(p, n, src) {
  const c = ctx(p, 1); if (c.k <= 0) return;
  const L = p.location, s = src?.location ?? L, dx = s.x - L.x, dz = s.z - L.z, m = Math.hypot(dx, dz) || 1;
  const hit = { x: L.x + (dx / m) * 1.05, y: L.y + 1.1, z: L.z + (dz / m) * 1.05 };
  burst(c, hit, { col: col(n), tile: T.diamond, n: 14, spd: 2.4, life: 0.35, size: 0.12 });
  ringFlat(c, at(L, 1), { col: col(n), tile: T.ring, n: 16, radius: 1.3, spd: 2.5, life: 0.3, size: 0.1 });
  shell(c, p, n, 2.5);
}
function breakFx(p) {
  const c = ctx(p, 1); if (c.k <= 0) return;
  const L = p.location;
  burst(c, at(L, 1), { col: "mana", tile: T.diamond, n: 40, spd: 5, life: 0.7, size: 0.18 });
  burst(c, at(L, 1), { col: "white", tile: T.shard, n: 24, spd: 3.5, life: 0.9, size: 0.14, acc: [0, -6, 0] });
  for (let i = 0; i < 3; i++) after(i * 3, () => ringFlat(c, at(L, 0.2 + i * 0.7), { col: i ? "mana" : "white", tile: T.ring, n: 24, radius: 2.4 + i, spd: 6, life: 0.45, size: 0.14 }));
}
function rebuildFx(p) {
  const c = ctx(p, 1); if (c.k <= 0) return;
  implode(c, at(p.location, 1), { col: "mana", tile: T.spark, n: 30, radius: 2.6, life: 0.6, size: 0.12 });
  helix(c, p.location, { col: "white", tile: T.ring, steps: 24, turns: 3, r: 1.05, h: 2.1, dur: 16, size: 0.1, life: 0.5 });
  after(16, () => { if (isValid(p)) { const k = ctx(p, 1); ringFlat(k, at(p.location, 1), { col: "mana", tile: T.ring, n: 20, radius: 1.1, spd: 0.3, life: 0.6, size: 0.14 }); shell(k, p, 7, 4); } });
}

function onHurt(ev) {
  const p = ev.hurtEntity; if (!(p instanceof Player)) return;
  const d = getData(p); if (!barrierUp(d)) return;
  const src = ev.damageSource, cause = src?.cause, att = src?.damagingEntity ?? src?.damagingProjectile;
  if (!HIT.has(cause) || (cause === "magic" && !att)) return;   // dano contínuo / reaplicações sem atacante: só a Resistência amortece
  const now = system.currentTick, key = att?.id ?? cause, m = last.get(p.id) ?? new Map(); last.set(p.id, m);
  const prev = m.get(key), dmg = ev.damage, h = healthComp(p);
  const pierce = pressureGap(p) >= 3 && att && !(att instanceof Player) && /etheria:/.test(att.typeId ?? "");
  if (h && h.currentValue > 0 && dmg > 0) heal(p, pierce ? dmg * 0.5 : dmg);   // o golpe é anulado (metade, se o chefe fura a barreira)
  if (prev !== undefined && now - prev < BARRIER.perAttacker) return;          // mesmo golpe/área: não gasta outra carga
  m.set(key, now); if (m.size > 24) m.delete(m.keys().next().value);
  const b = barrierOf(d); b.charges = Math.max(0, b.charges - (pierce ? 2 : 1)); b.regenAt = Date.now() + BARRIER.regenMs; markDirty(p);
  pulse(p, 20);
  if (b.charges <= 0) {
    b.brokenAt = Date.now(); breakFx(p);
    try { p.removeEffect("resistance"); } catch { /* ignore */ }
    try { playSound(p, "random.glass", 1, 0.7); } catch { /* ignore */ }
    try { sageText(p, `Barreira rompida. Reconstrução em ${BARRIER.rebuildMs / 1000} segundos.`, { pri: 2, key: "barrier.broken", cd: 400 }); } catch { /* ignore */ }
    emit(EV.BARRIER_BROKEN, { player: p });
  } else {
    blockFx(p, b.charges, att);
    try { playSound(p, "random.anvil_land", 0.35, 1.8); } catch { /* ignore */ }
    if (pierce) { try { sageText(p, "A pressão do inimigo atravessa parcialmente a barreira.", { pri: 3, key: "barrier.pierce", cd: 1200 }); } catch { /* ignore */ } }
    else if (b.charges === 2) { try { sageText(p, "Barreira prestes a se romper.", { pri: 3, key: "barrier.low", cd: 600 }); } catch { /* ignore */ } }
    emit(EV.BARRIER_BLOCK, { player: p, left: b.charges, pierce });
  }
}

let beat = 0;
function tick() {
  beat++;
  const t = Date.now();
  for (const p of world.getAllPlayers()) {
    try {
      const d = getData(p); if (!hasBarrier(d)) continue;
      const b = barrierOf(d);
      if (b.charges <= 0) {
        if (t - (b.brokenAt ?? 0) >= BARRIER.rebuildMs) {
          b.charges = BARRIER.max; markDirty(p); rebuildFx(p); pulse(p, 30);
          try { sageText(p, "Barreira reconstruída. Sete golpes de proteção.", { pri: 4, key: "barrier.up", cd: 200 }); } catch { /* ignore */ }
          emit(EV.BARRIER_RESTORED, { player: p });
        }
        continue;
      }
      if (b.charges < BARRIER.max && !inCombat(p) && t >= (b.regenAt ?? 0)) { b.charges++; b.regenAt = t + BARRIER.regenMs; markDirty(p); }
      try { p.addEffect("resistance", 40, { amplifier: BARRIER.resistAmp, showParticles: false }); } catch { /* ignore */ }
      // casca visível: discreta normalmente, forte quando faltam poucas cargas
      if (b.charges <= 2 || beat % 4 === 0) { const c = ctx(p, 1); if (c.k > 0) shell(c, p, b.charges, b.charges <= 2 ? 1.4 : 0.8); }
    } catch { /* ignore */ }
  }
}

export function startBarrier() {
  world.afterEvents.entityHurt.subscribe(onHurt, { entityTypes: ["minecraft:player"] });
  system.runInterval(tick, 10);
  world.afterEvents.playerLeave.subscribe((ev) => last.delete(ev.playerId));
  addHudLine((p) => {
    const d = getData(p); if (!hasBarrier(d)) return "";
    const b = barrierOf(d);
    if (b.charges <= 0) return `§8◈ Barreira §c${Math.max(0, Math.ceil((BARRIER.rebuildMs - (Date.now() - b.brokenAt)) / 1000))}s`;
    return `§8◈ ${b.charges <= 2 ? "§c" : "§b"}${"◆".repeat(b.charges)}§8${"◇".repeat(BARRIER.max - b.charges)}`;
  });
}

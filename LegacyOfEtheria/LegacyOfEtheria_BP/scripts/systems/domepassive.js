// systems/domepassive.js - DOMO DE PROTEÇÃO como PASSIVA + ATIVA (habilidade "range_barrier", Raro • Intrínseca • Ativa/Passiva).
// Dispara SOZINHA quando o jogador leva um golpe forte (>= 25% da vida máxima num golpe só) ou fica com a vida baixa (<= 40%):
// absorção (Absorção VI) + resistência (Resistência II e +8 Defesa, +15% res. mágica, +30% res. a projéteis) por 15 s, com um domo de partículas
// que acompanha o jogador. Custa 22 de mana no disparo e usa a MESMA recarga de 20 s da ativa (systems/skills.js: cdLeft/startCd).
// Não soma com a ativa: se o domo ativo (buff "barrier") ou o passivo já estiver no ar, não dispara de novo.
// Sem mana suficiente o domo não abre (o Sábio avisa, no máx. 1x por minuto). Dano do vazio e /kill nunca disparam.
import { world, system, Player } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { addBuff, hasBuff } from "./effects.js";
import { cdLeft, startCd } from "./skills.js";
import { ctx, mote, ringFlat, implode, burst, T } from "./fxlib.js";
import { dome } from "./spellvfx.js";
import { sageText } from "./voice.js";
import { addHudLine } from "./hudhooks.js";
import { SKILLS } from "../data/skills.js";

export const DOME_ID = "range_barrier";
const SK = () => SKILLS[DOME_ID];
const cfg = () => SK()?.passive ?? { sec: 15, absorb: 6, hpBelow: 0.4, bigHit: 0.25, stats: {} };
const SKIP = new Set(["void", "selfDestruct", "suicide", "override"]);
const shells = new Map();   // playerId -> tick final do domo (partículas)

export const hasDome = (d) => (d?.unlockedSkills ?? []).includes(DOME_ID) && !!SK()?.passive;
/** segundos até a recarga do Domo acabar (a mesma da ativa) */
export function domeReadyIn(p) { return cdLeft(p, DOME_ID); }

/** decide e abre o domo. info = { damage, cause, hp, max }. Devolve "open" | "cd" | "mana" | "" */
export function tryDome(p, info) {
  const d = getData(p); if (!hasDome(d)) return "";
  if (SKIP.has(info.cause)) return "";
  const c = cfg(), max = Math.max(1, info.max ?? 20), dmg = info.damage ?? 0, hp = info.hp ?? max;
  if (!(dmg > 0)) return "";
  if (!(dmg >= max * c.bigHit || hp <= max * c.hpBelow)) return "";
  if (domeReadyIn(p) > 0) return "cd";
  if (domeActive(p) || hasBuff(p, "barrier")) return "";   // já há um domo no ar (passivo ou o da ativa): não soma
  const cost = SK().mana ?? 22;
  if ((d.mana ?? 0) < cost) {
    try { sageText(p, "Domo de Proteção: mana insuficiente para abrir o domo.", { pri: 4, key: "dome.nomana", cd: 1200 }); } catch { /* ignore */ }
    return "mana";
  }
  d.mana -= cost; markDirty(p);
  startCd(p, DOME_ID, SK().cd ?? 20);   // mesma recarga da ativa (salva com as outras recargas)
  openDome(p, c);
  return "open";
}
export function openDome(p, c = cfg()) {
  const ticks = c.sec * 20;
  try { p.addEffect("absorption", ticks, { amplifier: Math.max(0, c.absorb - 1), showParticles: false }); } catch { /* ignore */ }
  try { addBuff(p, "protection_dome", c.sec, { name: "Domo", stats: c.stats, vanilla: [["resistance", 1]] }); } catch { /* ignore */ }
  shells.set(p.id, system.currentTick + ticks);
  try { dome(p.dimension, "aura_blue", { x: p.location.x, y: p.location.y + 1, z: p.location.z }, 2.4, 14); } catch { /* ignore */ }   // flash 3D (mesmo modelo das magias)
  const k = ctx(p, 1.2), L = p.location;
  implode(k, { x: L.x, y: L.y + 1, z: L.z }, { col: "mana", tile: T.diamond, n: 26, radius: 2.8, life: 0.5, size: 0.14 });
  ringFlat(k, { x: L.x, y: L.y + 0.1, z: L.z }, { col: "arcane", tile: T.ring, n: 28, radius: 2.4, life: 0.8, size: 0.16 });
  try { p.playSound("beacon.activate", { volume: 0.8, pitch: 1.3 }); } catch { /* ignore */ }
  try { sageText(p, "Domo de Proteção ativado automaticamente: absorção e resistência por 15 segundos.", { pri: 3, key: "dome.open", cd: 200 }); } catch { /* ignore */ }
}
/** casca do domo (meia esfera de pontos em volta do jogador) */
function shell(p, left) {
  const c = ctx(p, 1); if (c.k <= 0) return;
  const L = p.location, R = 2.2, n = left < 60 ? 10 : 16;
  for (let i = 0; i < n; i++) {
    const u = Math.random(), a = Math.random() * 6.283, s = Math.sqrt(1 - u * u);
    mote(c, { x: L.x + Math.cos(a) * s * R, y: L.y + 0.1 + u * R, z: L.z + Math.sin(a) * s * R }, { col: left < 60 ? "gold" : "mana", tile: T.diamond, size: 0.13, life: 0.55, a: 0.7, spd: 0 });
  }
  if (left % 40 < 10) ringFlat(c, { x: L.x, y: L.y + 0.1, z: L.z }, { col: "arcane", tile: T.ring, n: 18, radius: R, life: 0.6, size: 0.12 });
}
function onHurt(ev) {
  const p = ev.hurtEntity; if (!(p instanceof Player)) return;
  let h; try { h = p.getComponent("minecraft:health"); } catch { /* ignore */ }
  if (!h || h.currentValue <= 0) return;
  const r = tryDome(p, { damage: ev.damage, cause: ev.damageSource?.cause, hp: h.currentValue, max: h.effectiveMax });
  if (r === "open") { const L = p.location; burst(ctx(p, 1), { x: L.x, y: L.y + 1, z: L.z }, { col: "white", tile: T.shard, n: 12, spd: 2, life: 0.4, size: 0.12 }); }
}
function tick() {
  const now = system.currentTick;
  for (const [id, end] of shells) {
    if (now >= end) { shells.delete(id); continue; }
    const p = world.getAllPlayers().find((x) => x.id === id); if (!p) { shells.delete(id); continue; }
    try { shell(p, end - now); } catch { /* ignore */ }
  }
}
export const domeActive = (p) => shells.has(p?.id);
export function startDomePassive() {
  try { world.afterEvents.entityHurt.subscribe(onHurt, { entityTypes: ["minecraft:player"] }); } catch { try { world.afterEvents.entityHurt.subscribe(onHurt); } catch { /* ignore */ } }
  system.runInterval(tick, 10);
  addHudLine((p) => {
    const d = getData(p); if (!hasDome(d)) return "";
    if (shells.has(p.id)) return `§b◎ Domo ${Math.ceil((shells.get(p.id) - system.currentTick) / 20)}s`;
    const cd = domeReadyIn(p); return cd > 0 ? `§8◎ Domo ${Math.ceil(cd)}s` : "";
  });
}

// systems/effects.js - Buffs e debuffs do RPG (em memória; expiram sozinhos). Tick de 1s chamado pelo laço principal.
import { system } from "@minecraft/server";
import { isValid } from "../core/utils.js";

const store = new Map(); // entityId -> { entity, buffs: Map(id -> buff) }

// Debuffs pré-definidos. dot = dano por segundo (aplicado pelo tick). vanilla = efeitos nativos.
export const PRESETS = {
  chill:  { name: "Lentidão", debuff: true, vanilla: [["slowness", 1]] },
  stun:   { name: "Atordoado", debuff: true, vanilla: [["slowness", 4], ["weakness", 1]] },
  bleed:  { name: "Sangramento", debuff: true, dot: 2 },
  burn:   { name: "Queimadura", debuff: true, dot: 1.5, fire: true },
  poison: { name: "Veneno", debuff: true, vanilla: [["poison", 0]] },
  weak:   { name: "Fraqueza", debuff: true, vanilla: [["weakness", 1]] },
  paralyze: { name: "Paralisia", debuff: true, vanilla: [["slowness", 6], ["weakness", 2]] },
  degenerate: { name: "Degeneração", debuff: true, dot: 2.5, vanilla: [["wither", 0]] },
  mark:   { name: "Marcado", debuff: true, vanilla: [["glowing", 0], ["weakness", 0]] },
  fear:   { name: "Medo", debuff: true, vanilla: [["slowness", 2], ["nausea", 0]] },
  sloth:  { name: "Letargia", debuff: true, vanilla: [["slowness", 3], ["mining_fatigue", 1], ["weakness", 1]] },
};
const NAMES = { barrier: "Barreira", divine_shield: "Escudo Divino", war_cry: "Grito de Guerra", arcane_surge: "Surto Arcano", berserk_rage: "Fúria" };

export function addBuff(entity, id, seconds, o = {}) {
  if (!isValid(entity)) return;
  let rec = store.get(entity.id);
  if (!rec) { rec = { entity, buffs: new Map() }; store.set(entity.id, rec); }
  rec.entity = entity;
  const p = PRESETS[id] ?? {};
  const b = {
    id, name: o.name ?? p.name ?? NAMES[id] ?? id, until: system.currentTick + Math.floor(seconds * 20),
    stats: o.stats, debuff: o.debuff ?? p.debuff ?? false, dot: o.dot ?? p.dot, src: o.src, vanilla: o.vanilla ?? p.vanilla,
  };
  rec.buffs.set(id, b);
  for (const [vid, amp] of b.vanilla ?? []) {
    try { entity.addEffect(vid, Math.floor(seconds * 20), { amplifier: amp, showParticles: false }); } catch { /* efeito inválido */ }
  }
  if (p.fire) { try { entity.setOnFire(Math.min(seconds, 8), true); } catch { /* ignore */ } }
}
export function hasBuff(entity, id) {
  const r = store.get(entity.id); const b = r?.buffs.get(id);
  return !!b && b.until > system.currentTick;
}
export function getBuffStats(entity) {
  const r = store.get(entity.id); const out = {};
  if (!r) return out;
  const now = system.currentTick;
  for (const b of r.buffs.values()) {
    if (b.until <= now || !b.stats) continue;
    for (const [k, v] of Object.entries(b.stats)) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}
export function listBuffs(entity) {
  const r = store.get(entity.id); if (!r) return [];
  const now = system.currentTick;
  return [...r.buffs.values()].filter((b) => b.until > now).map((b) => ({ name: b.name, left: Math.ceil((b.until - now) / 20), debuff: b.debuff }));
}
export function clearBuffs(entityId) { store.delete(entityId); }
/** Remove debuffs (e seus efeitos vanilla) de uma entidade. */
export function clearDebuffs(entity) {
  const r = store.get(entity.id);
  if (r) for (const [id, b] of r.buffs) if (b.debuff) { for (const [vid] of b.vanilla ?? []) { try { entity.removeEffect(vid); } catch { /* ignore */ } } r.buffs.delete(id); }
  for (const vid of ["poison", "wither", "weakness", "slowness", "nausea", "mining_fatigue"]) { try { entity.removeEffect(vid); } catch { /* ignore */ } }
  try { entity.extinguishFire(); } catch { /* ignore */ }
}

/** Chamado 1x por segundo. */
export function tickEffects() {
  const now = system.currentTick;
  for (const [id, rec] of store) {
    if (!isValid(rec.entity)) { store.delete(id); continue; }
    for (const [bid, b] of rec.buffs) {
      if (b.until <= now) { rec.buffs.delete(bid); continue; }
      if (b.dot) {
        try {
          const opts = { cause: "magic" };
          if (b.src && isValid(b.src)) { opts.cause = "entityAttack"; opts.damagingEntity = b.src; }
          rec.entity.applyDamage(b.dot, opts);
        } catch { /* ignore */ }
      }
    }
    if (rec.buffs.size === 0) store.delete(id);
  }
}

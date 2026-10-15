// systems/stats.js - Cálculo de status finais (atributos + raça + classe + passivas + equipamentos + buffs)
import { system } from "@minecraft/server";
import { ATTRIBUTES, ELEMENTS, COMBAT, REGEN, MAX_LEVEL } from "../config.js";
import { getData, markDirty } from "../core/db.js";
import { clamp } from "../core/utils.js";
import { ITEMS } from "../data/items.gen.js";
import { SKILLS } from "../data/skills.js";
import { CLASSES } from "../data/classes.js";
import { stageOf } from "../data/races.js";
import { lineageStats } from "../data/lineages.js";
import { SET_DEFS } from "../data/armor.gen.js";
import { getBuffStats } from "./effects.js";
import { forgeOf, scaled } from "./items.js";
import { sageStage } from "./voice.js";

const cache = new Map();
const SLOTS = ["Mainhand", "Offhand", "Head", "Chest", "Legs", "Feet"];
const ARMOR_SLOTS = ["Head", "Chest", "Legs", "Feet"];
const lastAmp = new Map();

function readEquipment(player) {
  const out = [];
  let eq; try { eq = player.getComponent("minecraft:equippable"); } catch { /* ignore */ }
  if (!eq) return out;
  for (const slot of SLOTS) {
    let it; try { it = eq.getEquipment(slot); } catch { /* ignore */ }
    if (!it) continue;
    const inf = ITEMS[it.typeId]; if (!inf) continue;
    if (slot === "Mainhand" && inf.kind !== "weapon") continue;
    if (slot === "Offhand" && inf.kind !== "accessory") continue;
    if (ARMOR_SLOTS.includes(slot) && inf.kind !== "armor") continue;
    out.push({ slot, info: inf, forge: forgeOf(it) });
  }
  return out;
}

function addStats(t, stats, mult = 1) {
  for (const [k, raw] of Object.entries(stats ?? {})) {
    const v = raw * mult;
    if (k in ATTRIBUTES) t.attr[k] += v;
    else if (ELEMENTS.includes(k)) t.elem[k] = (t.elem[k] ?? 0) + v;
    else if (k.startsWith("res_")) t.res[k.slice(4)] = (t.res[k.slice(4)] ?? 0) + v;
    else t[k] = (t[k] ?? 0) + v;
  }
}

function compute(player) {
  const d = getData(player);
  const t = { attr: { strength: 0, defense: 0, intelligence: 0, agility: 0, vitality: 0 }, elem: {}, res: {},
    atk: 0, crit: 0, critDmg: 0, lifesteal: 0, manaRegen: 0, manaCost: 0, cdr: 0, hp: 0, mana: 0, stamina: 0, xp: 0, coin: 0 };
  addStats(t, d.attributes);
  const stage = stageOf(d);
  addStats(t, stage.attrs); addStats(t, stage.stats);
  { const ls = lineageStats(d); if (ls) for (const b of ls) addStats(t, b); }   // linhagem dracônica + forma
  const cls = d.class ? CLASSES[d.class] : null;
  if (cls) { addStats(t, cls.attrs); addStats(t, cls.stats); }
  const vanilla = new Set();
  const grantEff = (sk) => { for (const e of sk.effects ?? []) vanilla.add(e.id + ":" + e.amp); };
  for (const id of d.unlockedSkills) {
    const sk = SKILLS[id];
    if (sk && (sk.type === "passive" || sk.stats || sk.effects)) { addStats(t, sk.stats); grantEff(sk); }
  }
  { const sgs = sageStage(d); if (sgs >= 2 && d.sage?.mods?.cancel !== false) t.res.magic = (t.res.magic ?? 0) + [0, 0, 8, 14, 18][sgs]; }   // Anulação de Canto (Sábio)
  const eq = readEquipment(player);
  let weapon = null, weaponForge = 0; const sets = {};
  for (const e of eq) {
    addStats(t, scaled(e.info.stats, e.forge));
    if (e.slot === "Mainhand") { weapon = e.info; weaponForge = e.forge; }
    if (e.info.set) sets[e.info.set] = (sets[e.info.set] ?? 0) + 1;
  }
  for (const [name, n] of Object.entries(sets)) {   // bônus de conjunto data-driven (2/3/4 peças), acumulativos
    const def = SET_DEFS[name]; if (!def) continue;
    for (const need of [2, 3, 4]) if (n >= need && def.b[need]) addStats(t, def.b[need].stats);
  }
  addStats(t, getBuffStats(player));

  const A = (k) => Math.max(1, Math.round(t.attr[k]));
  const s = { level: d.level, str: A("strength"), def: A("defense"), int: A("intelligence"), agi: A("agility"), vit: A("vitality") };
  s.atk = t.atk + s.str * 0.6 + d.level * 0.2;
  s.crit = clamp(COMBAT.base_crit + s.agi * 0.25 + t.crit, 0, 75);
  s.critDmg = COMBAT.base_crit_dmg + t.critDmg;
  s.reduction = clamp(s.def / (s.def + COMBAT.def_k), 0, COMBAT.max_reduction);
  s.lifesteal = Math.max(0, t.lifesteal);
  s.cdr = clamp(t.cdr + s.agi * 0.2, 0, 50);
  s.manaCost = clamp(t.manaCost + s.int * 0.2, 0, 50);
  s.maxHpExtra = clamp(Math.round((s.vit - 5) * 2 + d.level + t.hp), 0, 600);
  s.maxMana = Math.round(20 + s.int * 5 + d.level * 2 + t.mana);
  s.maxStamina = Math.round(100 + s.agi * 2 + s.vit * 2 + t.stamina);
  s.manaRegen = (REGEN.mana_base + s.int * REGEN.mana_int) * (1 + t.manaRegen / 100);
  s.staminaRegen = REGEN.stamina_base + s.agi * REGEN.stamina_agi;
  s.elem = t.elem; s.res = t.res;
  s.xpPct = t.xp; s.coinPct = t.coin;
  s.weapon = weapon; s.weaponForge = weaponForge; s.eq = eq;
  s.vanilla = [...vanilla].map((x) => { const [id, amp] = x.split(":"); return { id, amp: Number(amp) }; });
  return s;
}

/** Status finais do jogador (memoizado por tick). */
export function getStats(player) {
  const now = system.currentTick; const c = cache.get(player.id);
  if (c && c.tick === now) return c.s;
  const s = compute(player); cache.set(player.id, { tick: now, s });
  return s;
}
export function dropStats(id) { cache.delete(id); lastAmp.delete(id); }

/** Aplica vida extra (health_boost), limita mana/stamina e efeitos passivos. */
export function applyDerivedStats(player) {
  const d = getData(player); const s = getStats(player);
  d.mana = clamp(d.mana, 0, s.maxMana);
  d.stamina = clamp(d.stamina, 0, s.maxStamina);
  const amp = Math.floor(s.maxHpExtra / 4) - 1;
  if (lastAmp.get(player.id) !== amp) {
    try {
      if (amp >= 0) player.addEffect("health_boost", 20000000, { amplifier: Math.min(amp, 250), showParticles: false });
      else player.removeEffect("health_boost");
      lastAmp.set(player.id, amp);
    } catch { /* jogador inválido */ }
  }
  markDirty(player);
}
export function applyPassiveEffects(player) {
  const s = getStats(player);
  for (const e of s.vanilla) {
    try { player.addEffect(e.id, e.id === "night_vision" ? 400 : 60, { amplifier: e.amp, showParticles: false }); } catch { /* ignore */ }
  }
}
export function getHealth(player) {
  try {
    const h = player.getComponent("minecraft:health");
    return h ? { cur: h.currentValue, max: h.effectiveMax } : { cur: 20, max: 20 };
  } catch { return { cur: 20, max: 20 }; }
}
export { MAX_LEVEL };

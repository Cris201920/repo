// systems/items.js - Informações de itens Etheria, tooltips (lore), forja e raridade
import { ITEMS } from "../data/items.gen.js";
import { RARITY, STAT_LABELS, COMBAT } from "../config.js";
import { SET_DEFS } from "../data/armor.gen.js";

export function info(typeId) { return ITEMS[typeId]; }
export function nameOf(typeId) { const i = ITEMS[typeId]; return i ? `${RARITY[i.rarity].color}${i.name}§r` : typeId; }

export function forgeOf(item) {
  try {
    for (const l of item.getLore() ?? []) { const m = /Forja \+(\d+)/.exec(l); if (m) return parseInt(m[1]); }
  } catch { /* ignore */ }
  return 0;
}
export function scaled(stats, forge) {
  const f = 1 + forge * COMBAT.forge_bonus, out = {};
  for (const [k, v] of Object.entries(stats ?? {})) out[k] = v > 0 ? Math.round(v * f * 10) / 10 : v;
  return out;
}
export function fmtStat(k, v) {
  const label = STAT_LABELS[k] ?? k;
  const sign = v >= 0 ? "+" : "";
  if (label.endsWith(" %")) return `${sign}${v}% ${label.slice(0, -2)}`;
  return `${sign}${v} ${label}`;
}
const KIND = { weapon: "Arma", armor: "Armadura", accessory: "Acessório", material: "Material", consumable: "Consumível", artifact: "Artefato", quest: "Item de missão" };
const WTYPE = { sword: "Espada", dagger: "Adaga", spear: "Lança", axe: "Machado", bow: "Arco", staff: "Cajado", tome: "Grimório", scythe: "Foice", club: "Clava" };

export function buildLore(inf, forge = 0) {
  const R = RARITY[inf.rarity];
  const lines = [`${R.color}${R.name} §8• §7${inf.wtype ? WTYPE[inf.wtype] : KIND[inf.kind] ?? inf.kind}`];
  const st = scaled(inf.stats, forge);
  for (const [k, v] of Object.entries(st)) lines.push(`${v >= 0 ? "§a" : "§c"}${fmtStat(k, v)}`);
  if (inf.onHit) lines.push(`§6Habilidade: ${inf.onHit.name ?? inf.onHit.kind}`);
  if (inf.caster) lines.push("§bUse para lançar a habilidade equipada");
  if (inf.ranged) lines.push("§bUse para disparar");
  if (inf.use) lines.push("§eUse para consumir");
  if (inf.set) { const sd = SET_DEFS[inf.set]; lines.push(`§dConjunto: ${sd?.name ?? inf.set}`); if (sd) { for (const n of [2, 3, 4]) lines.push(`§8(${n}) ${sd.b[n].text}`); if (sd.ptext) lines.push(`§6${sd.ptext}`); } }
  if (inf.kind === "weapon" || inf.kind === "armor" || inf.kind === "accessory") lines.push(`§8Forja +${forge}`);
  return lines;
}
/** Garante que o ItemStack tenha tooltip. Retorna true se alterou. */
export function ensureLore(item) {
  const inf = ITEMS[item.typeId]; if (!inf) return false;
  let cur = []; try { cur = item.getLore() ?? []; } catch { /* ignore */ }
  const forge = forgeOf(item);
  const want = buildLore(inf, forge);
  if (cur.length === want.length && cur.every((l, i) => l === want[i])) return false;
  item.setLore(want);
  return true;
}
export function forgeCost(inf, level) {
  const mult = 1 + ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine"].indexOf(inf.rarity);
  return { coins: 150 * (level + 1) * mult, ingots: level + 1 };
}
export function itemsByKind(kind) { return Object.values(ITEMS).filter((i) => i.kind === kind); }

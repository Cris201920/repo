// data/skillfmt.js - Ficha de habilidade no formato do Grande Sábio (mod Tensura):
//   "Domo de Proteção — Raro • Intrínseca • Ativa/Passiva • Mana 22 • Recarga 20 s • Nível 12 • Custo 2 pt"
// Só apresentação: os números vêm de data/skills.js (nada é alterado aqui).
import { RARITY } from "../config.js";
import { SKILLS } from "./skills.js";

export const TIER_ORDER = ["ultimate", "unique", "extra", "intrinsic", "resistance", "common"];
export const TIER_LABEL = { ultimate: "Ultimate", unique: "Única", extra: "Extra", intrinsic: "Intrínseca", resistance: "Resistência", common: "Comum" };
export const TIER_PLURAL = { ultimate: "Ultimates", unique: "Únicas", extra: "Extra", intrinsic: "Intrínsecas", resistance: "Resistências", common: "Comuns" };
export const TIER_COLOR = { ultimate: "§c", unique: "§6", extra: "§e", intrinsic: "§a", resistance: "§b", common: "§f" };

const RES = /resist|imunidade|imune/i;
/** classe da habilidade no Tensura: ultimate | unique | extra | intrinsic | resistance | common (sk.tier, se existir, manda) */
export function tierOf(sk) {
  if (!sk) return "common";
  if (sk.tier && TIER_LABEL[sk.tier]) return sk.tier;
  if (sk.rarity === "divine" || sk.cat === "Ultimate" || sk.cat === "Manas") return "ultimate";
  if (sk.cat === "Única") return "unique";
  const st = Object.keys(sk.stats ?? {});
  if (RES.test(`${sk.id} ${sk.name}`) || (sk.type === "passive" && !sk.exec && st.length && st.every((k) => k.startsWith("res_")))) return "resistance";
  if (sk.cat === "Racial" || sk.cat === "Intrínseca") return "intrinsic";
  if (sk.cat === "Extra" || ["epic", "legendary", "mythic"].includes(sk.rarity)) return "extra";
  return "common";
}
export const tierOfSkill = (id) => tierOf(SKILLS[id]);
export const tierTag = (sk) => { const t = tierOf(sk); return `${TIER_COLOR[t]}${TIER_LABEL[t]}`; };
export const modeOf = (sk) => (sk.type === "active" ? "Ativa" : sk.trigger ? "Ativa/Passiva" : "Passiva");
export const rarityOf = (sk) => RARITY[sk?.rarity] ?? RARITY.common;
export const rarityTag = (sk) => { const r = rarityOf(sk); return `${r.color}${r.name}`; };
const usesMana = (sk) => sk.type === "active" || !!sk.trigger;

/** "Raro • Intrínseca • Ativa/Passiva" */
export function skillTags(sk) { return `${rarityTag(sk)} §8• ${tierTag(sk)} §8• §f${modeOf(sk)}`; }
/** "Mana 22 • Recarga 20 s • Nível 12 • Custo 2 pt" */
export function skillNums(sk) {
  return [
    `§bMana ${usesMana(sk) ? sk.mana ?? 0 : "—"}${sk.stamina ? ` §8+ §aStamina ${sk.stamina}` : ""}`,
    `§eRecarga ${usesMana(sk) && sk.cd ? `${sk.cd} s` : "—"}`,
    `§fNível ${sk.level ?? 1}`,
    `§dCusto ${sk.sp > 0 ? `${sk.sp} pt` : "—"}`,
  ].join(" §8• ");
}
/** linha única no formato do Sábio */
export function skillLine(sk) { return `${rarityOf(sk).color}§l${sk.name}§r §8— ${skillTags(sk)} §8• ${skillNums(sk)}`; }
/** primeira frase da descrição (até n letras) */
export function shortDesc(sk, n = 110) {
  const t = String(sk?.desc ?? "").replace(/^(Habilidade Única|Passiva|PASSIVA)[.:]\s*/i, "");
  const f = (/^.*?[.!?](\s|$)/.exec(t)?.[0] ?? t).trim();
  return f.length > n ? f.slice(0, n - 1).trimEnd() + "…" : f;
}
const ORIGIN = { Racial: "Concedida pela raça ou evolução", Intrínseca: "Concedida pela raça ou evolução", Classe: "Concedida pela classe", Única: "Descoberta por condições ou pelo Predador",
  Ultimate: "Despertar (Raça > Skills Ultimate)", "Agilidade Suprema": "Linha de agilidade da raça", Espada: "Ensinada por mestres", Lança: "Ensinada por mestres", Combate: "Ensinada por mestres", Energia: "Ensinada por mestres", Suporte: "Ensinada por mestres" };
/** requisito em texto curto */
export function reqText(sk) {
  const r = [];
  if ((sk.level ?? 1) > 1) r.push(`Nível ${sk.level}`);
  for (const id of sk.req ?? []) r.push(SKILLS[id]?.name ?? id);
  if (sk.sp > 0) return r.length ? r.join(", ") : "Nenhum";
  const o = ORIGIN[sk.cat] ?? "Concedida por progressão";
  return r.length ? `${o} · ${r.join(", ")}` : o;
}
/** ficha completa (linhas), para a tela de habilidade e o chat do Sábio */
export function skillCard(sk, owned = false) {
  return [
    `${rarityOf(sk).color}§l${sk.name}${owned ? " §r§a✔" : ""}`,
    skillTags(sk),
    skillNums(sk),
    `§8Categoria: §7${sk.cat}`,
    "",
    `§f${sk.desc}`,
    "",
    `§7Requisito: §f${reqText(sk)}`,
  ];
}
/** contagem por classe (para o relatório do Sábio) */
export function tierCount(ids) {
  const c = {}; for (const id of ids) { const sk = SKILLS[id]; if (sk) { const t = tierOf(sk); c[t] = (c[t] ?? 0) + 1; } }
  return TIER_ORDER.filter((t) => c[t]).map((t) => `${TIER_COLOR[t]}${TIER_PLURAL[t]} ${c[t]}`).join(" §8· ");
}

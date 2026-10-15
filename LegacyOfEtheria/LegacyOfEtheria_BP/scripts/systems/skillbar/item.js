// systems/skillbar/item.js - SkillItem: cria o item físico de uma habilidade (ícone na hotbar) e monta o texto (lore)
// Proteções nativas do item: lockMode=inventory (não cai no chão, não vai para baú/bancada) e keepOnDeath (sobrevive à morte).
import { ItemStack, ItemLockMode } from "@minecraft/server";
import { SKILLBAR } from "../../config.js";
import { SKILLS } from "../../data/skills.js";
import { masteryLevel } from "../mastery.js";
import { itemIdOf, categoryLabel, rarityOf, isSpecial } from "./registry.js";

let seq = 0;
/** Id único de instância. Dois itens da mesma habilidade com o mesmo id => um deles é cópia e é removido na conferência. */
export function newSid() {
  return `${Math.floor(Math.random() * 2176782336).toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** Quebra o texto em linhas de até `w` caracteres visíveis (o limite do Minecraft é 50 por linha, incluindo códigos §). */
export function wrap(text, w = 40) {
  const out = []; let cur = "";
  for (const word of String(text ?? "").split(/\s+/)) {
    if (!word) continue;
    if ((cur + " " + word).trim().length > w) { if (cur) out.push(cur); cur = word; } else cur = (cur + " " + word).trim();
  }
  if (cur) out.push(cur);
  return out;
}

/** Texto do item. Usa valores BASE (não os afetados por buffs temporários) para o item não "piscar" a cada buff. */
export function skillLore(player, id) {
  const sk = SKILLS[id]; if (!sk) return { lines: ["§7Habilidade desconhecida"], sig: "?" };
  const R = rarityOf(id), mastery = masteryLevel(player, id);
  const lines = [`${R.color}${R.name} §8• §7${categoryLabel(id)}`];
  const res = [`§9Mana ${sk.mana ?? 0}`];
  if (sk.stamina) res.push(`§aStamina ${sk.stamina}`);
  res.push(`§7Recarga ${sk.cd ?? 0}s`);
  lines.push(res.join(" §8• "));
  for (const l of wrap(sk.desc, 40).slice(0, 4)) lines.push(`§7${l}`);
  if (mastery > 0) lines.push(`§dMaestria Nv.${mastery}`);
  if (isSpecial(id)) lines.push("§6Habilidade especial");
  lines.push("§8Toque para usar §7• §8Agache: interagir");
  return { lines: lines.slice(0, 12), sig: `${mastery}|${sk.mana}|${sk.cd}` };
}

/** Item novo de uma habilidade, já travado/protegido e marcado com a instância. Nunca coloca no inventário (quem chama decide o slot). */
export function createSkillItem(player, id, sid) {
  const it = new ItemStack(itemIdOf(id), 1);
  try { it.lockMode = ItemLockMode.inventory; } catch (e) { console.warn(`[Etheria] lockMode ${id}: ${e}`); }
  try { it.keepOnDeath = true; } catch (e) { console.warn(`[Etheria] keepOnDeath ${id}: ${e}`); }
  try { it.setDynamicProperty(SKILLBAR.sidKey, sid); } catch (e) { console.warn(`[Etheria] sid ${id}: ${e}`); }
  try { const { lines, sig } = skillLore(player, id); it.setLore(lines); it.setDynamicProperty(SKILLBAR.sigKey, sig); } catch (e) { console.warn(`[Etheria] lore ${id}: ${e}`); }
  return it;
}

/** Lê id da instância e assinatura de um ContainerSlot/ItemStack. */
export function readInstance(slotOrItem) {
  let sid = null, sig = null;
  try { const v = slotOrItem.getDynamicProperty(SKILLBAR.sidKey); if (typeof v === "string" && v) sid = v; } catch { /* ignore */ }
  try { const v = slotOrItem.getDynamicProperty(SKILLBAR.sigKey); if (typeof v === "string") sig = v; } catch { /* ignore */ }
  return { sid, sig };
}

// systems/skillbar/registry.js - SkillRegistry: catálogo das habilidades que viram itens (ícone na hotbar)
// Cada habilidade ATIVA tem um item `etheria:sk_<id>` gerado no build (tools/skillitems.py) a partir de data/skills.js.
// Passivas não viram item: ficam sempre ativas enquanto desbloqueadas.
import { ItemTypes } from "@minecraft/server";
import { SKILLBAR, RARITY } from "../../config.js";
import { SKILLS } from "../../data/skills.js";

export const ITEM_PREFIX = SKILLBAR.itemPrefix;
export const itemIdOf = (skillId) => ITEM_PREFIX + skillId;
export const isSkillItemType = (typeId) => typeof typeId === "string" && typeId.startsWith(ITEM_PREFIX);
export const skillIdOfItem = (typeId) => (isSkillItemType(typeId) ? typeId.slice(ITEM_PREFIX.length) : null);
export const cooldownCategory = (skillId) => SKILLBAR.cdPrefix + skillId;

export const getSkill = (id) => SKILLS[id];
const typeOk = new Map();
/** O tipo de item da habilidade existe no pacote carregado? (protege contra pacote de recursos/comportamento desencontrados) */
export function hasItemType(skillId) {
  let v = typeOk.get(skillId);
  if (v === undefined) {
    try { v = !!ItemTypes.get(itemIdOf(skillId)); } catch { v = true; }   // sem a API, assume que existe e deixa o create falhar com aviso
    typeOk.set(skillId, v);
  }
  return v;
}
export const resetTypeCache = () => typeOk.clear();

/** Só habilidades ativas existentes podem ser equipadas como item. */
export const isEquippable = (id) => SKILLS[id]?.type === "active";
export const allEquippable = () => Object.values(SKILLS).filter((s) => s.type === "active");

const SPECIAL = new Set(SKILLBAR.special);
export const isSpecial = (id) => { const s = SKILLS[id]; return !!s && (SPECIAL.has(s.cat) || s.rarity === "divine" || s.rarity === "mythic"); };

/** Rótulo de categoria exibido no item/menu (as categorias do jogo + as futuras entram automaticamente). */
export const CATEGORY_LABEL = {
  "Intrínseca": "Habilidade Intrínseca", "Extra": "Habilidade Extra", "Única": "Habilidade Única", "Ultimate": "Habilidade Suprema",
  "Manas": "Habilidade Manas", "Magia": "Magia", "Combate": "Técnica de Combate", "Mobilidade": "Mobilidade", "Suporte": "Suporte",
  "Invocação": "Invocação", "Racial": "Habilidade Racial", "Classe": "Habilidade de Classe",
};
export const categoryLabel = (id) => { const s = SKILLS[id]; return s ? (CATEGORY_LABEL[s.cat] ?? s.cat ?? "Habilidade") : "Habilidade"; };
export const rarityOf = (id) => RARITY[SKILLS[id]?.rarity] ?? RARITY.common;

/** Nome curto para HUD (cabe na barra de ação do celular). */
export function shortName(id, n = 9) {
  const name = SKILLS[id]?.name ?? "?";
  return name.length > n ? name.slice(0, n - 1) + "." : name;
}

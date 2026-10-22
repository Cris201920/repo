// systems/skillbar/ui.js - Interface da hotbar de habilidades: faixa na HUD, linha da habilidade selecionada,
// mensagens rápidas (sem spam de chat) e os formulários de organização. Tudo em pt-BR; nunca mostra id técnico.
import { system } from "@minecraft/server";
import { HOTBAR_SIZE, MAX_SLOTS, SKILLBAR, SOUNDS, RARITY } from "../../config.js";
import { SKILLS } from "../../data/skills.js";
import { getData } from "../../core/db.js";
import { inventory, say, playSound } from "../../core/utils.js";
import { ITEMS } from "../../data/items.gen.js";
import { menu } from "../ui/forms.js";
import { getStats } from "../stats.js";
import { cdLeft, checkCast, CAST } from "../skills.js";
import { skillIdOfItem, shortName, categoryLabel, rarityOf } from "./registry.js";
import { skillColor } from "../../data/skillcolors.js";
import { HotbarLoadout } from "./loadout.js";
import { EquippedSkillManager } from "./equipped.js";
import { describeHotbar } from "./sync.js";

// ------------------------------------------------------------------ nomes em português para itens que não são do addon
const MATERIAL = { wooden: "de madeira", stone: "de pedra", iron: "de ferro", golden: "de ouro", diamond: "de diamante", netherite: "de netherita", leather: "de couro", chainmail: "de malha", turtle: "de tartaruga" };
const KIND = { sword: "Espada", pickaxe: "Picareta", axe: "Machado", shovel: "Pá", hoe: "Enxada", helmet: "Capacete", chestplate: "Peitoral", leggings: "Calça", boots: "Botas" };
const FIXED = {
  "minecraft:bow": "Arco", "minecraft:crossbow": "Besta", "minecraft:shield": "Escudo", "minecraft:arrow": "Flecha", "minecraft:torch": "Tocha", "minecraft:bread": "Pão",
  "minecraft:cooked_beef": "Bife", "minecraft:cooked_porkchop": "Costeleta", "minecraft:apple": "Maçã", "minecraft:golden_apple": "Maçã dourada", "minecraft:bucket": "Balde",
  "minecraft:water_bucket": "Balde de água", "minecraft:lava_bucket": "Balde de lava", "minecraft:ender_pearl": "Pérola do End", "minecraft:trident": "Tridente",
  "minecraft:fishing_rod": "Vara de pescar", "minecraft:totem_of_undying": "Totem da imortalidade", "minecraft:elytra": "Élitros", "minecraft:clock": "Relógio",
  "minecraft:compass": "Bússola", "minecraft:map": "Mapa", "minecraft:cobblestone": "Pedregulho", "minecraft:dirt": "Terra", "minecraft:oak_planks": "Tábuas de carvalho",
  "minecraft:stick": "Graveto", "minecraft:coal": "Carvão", "minecraft:iron_ingot": "Barra de ferro", "minecraft:gold_ingot": "Barra de ouro", "minecraft:diamond": "Diamante",
  "minecraft:emerald": "Esmeralda", "minecraft:book": "Livro", "minecraft:enchanted_book": "Livro encantado", "minecraft:potion": "Poção", "minecraft:crafting_table": "Bancada de trabalho",
  "minecraft:chest": "Baú", "minecraft:furnace": "Fornalha", "minecraft:bed": "Cama", "minecraft:white_bed": "Cama", "minecraft:spyglass": "Luneta", "minecraft:flint_and_steel": "Isqueiro",
};
/** Nome legível (pt-BR) de qualquer item do inventário. */
export function itemLabel(typeId) {
  if (!typeId) return "—";
  const sid = skillIdOfItem(typeId); if (sid !== null) return SKILLS[sid]?.name ?? "Habilidade";
  const inf = ITEMS[typeId]; if (inf) return `${RARITY[inf.rarity]?.color ?? ""}${inf.name}§r`;
  if (FIXED[typeId]) return FIXED[typeId];
  const m = /^minecraft:(wooden|stone|iron|golden|diamond|netherite|leather|chainmail|turtle)_(sword|pickaxe|axe|shovel|hoe|helmet|chestplate|leggings|boots)$/.exec(typeId);
  if (m) return `${KIND[m[2]]} ${MATERIAL[m[1]]}`;
  return "Item";
}

// ------------------------------------------------------------------ estado e mensagens rápidas
let hudRenderer = null;
export function setHudRenderer(fn) { hudRenderer = fn; }
/** Redesenha a barra de ação agora (em vez de esperar o próximo ciclo de 1 s). */
export function pushHud(player) { try { hudRenderer?.(player); } catch { /* ignore */ } }

const flashUntil = new Map();
/** Mensagem curta na barra de ação que NÃO é sobrescrita pela HUD por `ticks` ticks (não usa o chat). */
export function flash(player, text, ticks = 30) {
  try { player.onScreenDisplay.setActionBar(text); flashUntil.set(player.id, system.currentTick + ticks); } catch { /* ignore */ }
}
export const flashActive = (player) => (flashUntil.get(player.id) ?? 0) > system.currentTick;
export function dropUi(id) { flashUntil.delete(id); }

/** Habilidade do item que está na mão (slot selecionado), ou null. */
export function selectedSkill(player) {
  try {
    const c = inventory(player), s = c?.getSlot(player.selectedSlotIndex);
    return s && s.hasItem() ? skillIdOfItem(s.typeId) : null;
  } catch { return null; }
}

// ------------------------------------------------------------------ HUD
function stateTag(player, id, d, s) {
  const c = checkCast(player, id);
  if (c.ok) return { txt: "§aPRONTA", st: CAST.READY };
  if (c.state === CAST.COOLDOWN) return { txt: `§8recarga ${Math.ceil(c.left)}s`, st: c.state, left: c.left };
  if (c.state === CAST.NO_RESOURCE) return { txt: c.resource === "stamina" ? "§cSEM STAMINA" : "§cSEM MANA", st: c.state };
  if (c.state === CAST.DISABLED) return { txt: `§c${c.msg.replace(/\.$/, "").toUpperCase()}`, st: c.state };
  return { txt: "§cINDISPONÍVEL", st: c.state };
}
/** Linha da habilidade selecionada: "▶ Bola de Fogo  12 MP  PRONTA". Vazia se o item na mão não é uma habilidade. */
export function hudSelectedLine(player, d, s) {
  if (d.settings?.skillbar?.selectInfo === false) return "";
  const id = selectedSkill(player); if (id === null) return "";
  const sk = SKILLS[id]; if (!sk) return "";
  const cost = Math.ceil((sk.mana ?? 0) * (1 - s.manaCost / 100) * (d.awakened?.[id] ? 0.8 : 1));
  const t = stateTag(player, id, d, s);
  return `§e▶ §f${sk.name} §9${cost}MP${sk.stamina ? ` §a${sk.stamina}ST` : ""} ${t.txt}`;
}
/** Faixa com as habilidades equipadas (número = slot da hotbar). 1 ou 2 linhas. */
export function hudSkillLines(player, d, s) {
  if (d.settings?.skillbar?.strip === false || !d.equippedSkills.length) return [];
  const ents = d.equippedSkills.map((id) => ({ id, slot: HotbarLoadout.slotOf(d, id) })).sort((a, b) => (a.slot < 0 ? 99 : a.slot) - (b.slot < 0 ? 99 : b.slot));
  const many = ents.length > 5, nameLen = many ? 5 : 7, parts = [];   // 7.x: nomes mais curtos (barra de ação menor)
  for (const e of ents) {
    const key = e.slot >= 0 && e.slot < HOTBAR_SIZE ? String(e.slot + 1) : "•", n = shortName(e.id, nameLen), cd = cdLeft(player, e.id);
    if (cd > 0) { parts.push(`§8${key} ${n} ${Math.ceil(cd)}s`); continue; }
    const sk = SKILLS[e.id], cost = Math.ceil((sk?.mana ?? 0) * (1 - s.manaCost / 100) * (d.awakened?.[e.id] ? 0.8 : 1));
    parts.push(d.mana < cost ? `§c${key}§7 ${n}` : `§b${key} ${skillColor(sk)}${n}`);   // 6.46: cor da categoria
  }
  const lines = []; for (let i = 0; i < parts.length; i += 5) lines.push(parts.slice(i, i + 5).join(" "));
  return lines;
}

/** Feedback discreto ao selecionar o slot de uma habilidade. */
export function onSelect(player, id) {
  const d = getData(player), sb = d.settings?.skillbar ?? SKILLBAR.defaults;
  if (sb.selectSound) playSound(player, "random.click", 0.25, 1.6);
  if (sb.selectInfo) pushHud(player);
}

// ------------------------------------------------------------------ formulários
const back = (fn) => ({ text: "§7« Voltar", icon: "back", run: fn });
const R = (id) => rarityOf(id);

function slotLine(player, e, d) {
  if (e.empty) return `§8${e.slot + 1}. (vazio)`;
  if (e.skill) { const t = stateTag(player, e.skill, d, getStats(player)); return `§f${e.slot + 1}. ${R(e.skill).color}${SKILLS[e.skill]?.name ?? "Habilidade"} §8- ${t.txt}`; }
  return `§7${e.slot + 1}. ${itemLabel(e.typeId)}${e.amount > 1 ? ` §8x${e.amount}` : ""}`;
}
/** Resumo da hotbar em texto (usado no menu de habilidades). */
export function hotbarSummary(player) {
  const d = getData(player); return describeHotbar(player).map((e) => slotLine(player, e, d)).join("\n");
}

/** Tela da hotbar: cada slot é um botão. Toque para mover/desequipar a habilidade ou colocar uma habilidade nesse slot. */
export function openHotbar(player, backFn) {
  const d = getData(player), hb = describeHotbar(player);
  const b = hb.map((e) => ({
    text: slotLine(player, e, d), icon: e.skill ? "skill_" + e.skill : undefined,
    run: () => openSlotActions(player, e.slot, backFn),
  }));
  b.push({ text: "§aOrganizar automaticamente", icon: "menu_skills", run: () => {
    const r = EquippedSkillManager.autoArrange(player);
    say(player, r.moved ? `§a${r.moved} habilidade(s) movida(s) para a hotbar.` : "§7Nada para organizar (sem slots livres ou já organizado).");
    openHotbar(player, backFn);
  } });
  b.push(back(backFn));
  menu(player, "§l§bHOTBAR DE HABILIDADES", `§7Cada habilidade equipada é um item na sua hotbar: selecione o slot e use.\n§7Você também pode arrastar os itens no inventário. §8(Agachado, você interage com baús e portas normalmente.)\n§7Equipadas: §f${d.equippedSkills.length}/${MAX_SLOTS}`, b);
}

function openSlotActions(player, slot, backFn) {
  const d = getData(player), e = describeHotbar(player)[slot];
  const again = () => openHotbar(player, backFn);
  if (e.skill) {
    const sk = SKILLS[e.skill];
    menu(player, `§l${sk.name}`, `${R(e.skill).color}${R(e.skill).name} §7• ${categoryLabel(e.skill)}\n\n§f${sk.desc}\n\n§9Mana ${sk.mana}  §7Recarga ${sk.cd}s`, [
      { text: "Mover para outro slot", icon: "menu_skills", run: () => openSlotPick(player, e.skill, again, `Escolha o novo slot de ${sk.name}.`) },
      { text: "§cGuardar (desequipar)", icon: "menu_class", run: () => { const r = EquippedSkillManager.unequip(player, e.skill); say(player, r.ok ? `§7${r.msg}` : `§c${r.msg}`); again(); } },
      back(again),
    ]);
    return;
  }
  // slot vazio ou com item comum: escolher qual habilidade colocar
  const list = d.unlockedSkills.map((id) => SKILLS[id]).filter((s) => s && s.type === "active");
  const free = list.filter((s) => !d.equippedSkills.includes(s.id)).concat(list.filter((s) => d.equippedSkills.includes(s.id)));
  if (!free.length) { say(player, "§cVocê ainda não tem habilidades ativas."); return again(); }
  const per = 8, page = 0;
  openPickForSlot(player, slot, free, page, per, again);
}
function openPickForSlot(player, slot, list, page, per, again) {
  const d = getData(player), pages = Math.max(1, Math.ceil(list.length / per)), slice = list.slice(page * per, page * per + per);
  const b = slice.map((sk) => ({
    text: `${R(sk.id).color}${sk.name}\n§r${d.equippedSkills.includes(sk.id) ? `§a[${HotbarLoadout.label(d, sk.id)}] mover para cá` : "§7equipar neste slot"}`,
    icon: "skill_" + sk.id,
    run: () => { const r = EquippedSkillManager.equip(player, sk.id, { slot }); say(player, r.ok ? `§a${r.msg}` : `§c${r.msg}`); again(); },
  }));
  if (page > 0) b.push({ text: "« Página anterior", run: () => openPickForSlot(player, slot, list, page - 1, per, again) });
  if (page < pages - 1) b.push({ text: "Próxima página »", run: () => openPickForSlot(player, slot, list, page + 1, per, again) });
  b.push(back(again));
  menu(player, `§l§bSLOT ${slot + 1}`, `§7Escolha a habilidade para o slot ${slot + 1}.\n§8Se houver outro item nele, ele troca de lugar (nada é perdido).  Página ${page + 1}/${pages}`, b);
}

/** Escolher o slot (1-9) de uma habilidade: equipa se necessário, ou move se já estiver equipada. */
export function openSlotPick(player, id, backFn, body) {
  const d = getData(player), sk = SKILLS[id], hb = describeHotbar(player), eq = d.equippedSkills.includes(id);
  const b = hb.map((e) => ({
    text: `Slot ${e.slot + 1}${e.skill === id ? " §a(atual)" : e.empty ? " §8(livre)" : ` §8(${itemLabel(e.typeId)})`}`,
    run: () => { const r = EquippedSkillManager.equip(player, id, { slot: e.slot }); say(player, r.ok ? `§a${r.msg}` : `§c${r.msg}`); backFn(); },
  }));
  if (!eq) b.push({ text: "§aEquipar no primeiro espaço livre", run: () => { const r = EquippedSkillManager.equip(player, id); say(player, r.ok ? `§a${r.msg}` : `§c${r.msg}`); backFn(); } });
  if (eq) b.push({ text: "§cGuardar (desequipar)", run: () => { const r = EquippedSkillManager.unequip(player, id); say(player, r.ok ? `§7${r.msg}` : `§c${r.msg}`); backFn(); } });
  b.push(back(backFn));
  menu(player, `§l${sk.name}`, body ?? `§7Escolha o slot da hotbar. Se já houver um item, os dois trocam de lugar.\n§7Equipadas: §f${d.equippedSkills.length}/${MAX_SLOTS}`, b);
}

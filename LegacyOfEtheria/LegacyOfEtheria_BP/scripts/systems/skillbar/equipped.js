// systems/skillbar/equipped.js - EquippedSkillManager: equipar / desequipar / substituir / reposicionar habilidades-item
// Regra de ouro: NUNCA mexe nas habilidades desbloqueadas (d.unlockedSkills) e NUNCA descarta item de outro tipo.
// Equipar = entrar em d.equippedSkills + existir UM item físico; desequipar = o contrário. Tudo passa pela sincronização.
import { MAX_SLOTS, HOTBAR_SIZE, INV_SIZE } from "../../config.js";
import { SKILLS } from "../../data/skills.js";
import { getData, markDirty, saveNow } from "../../core/db.js";
import { emit, EV } from "../../core/bus.js";
import { isEquippable, hasItemType } from "./registry.js";
import { HotbarLoadout } from "./loadout.js";
import { reconcile, removeSkillItem, moveSkillItem, freeSlots, scanInventory } from "./sync.js";

const nameOf = (id) => SKILLS[id]?.name ?? id;
const fix = (d) => { if (d.slot >= d.equippedSkills.length) d.slot = 0; };

export const EquippedSkillManager = {
  list(d) { return d.equippedSkills.slice(); },
  has(d, id) { return d.equippedSkills.includes(id); },
  count(d) { return d.equippedSkills.length; },

  /** null = pode equipar; senão o motivo (pt-BR). */
  canEquip(d, id) {
    if (!isEquippable(id)) return "Só habilidades ativas podem ser equipadas.";
    if (!d.unlockedSkills.includes(id)) return "Você ainda não desbloqueou essa habilidade.";
    if (!hasItemType(id)) return "Essa habilidade ainda não tem item neste pacote.";
    if (d.equippedSkills.includes(id)) return "Já está equipada.";
    if (d.equippedSkills.length >= MAX_SLOTS) return `Limite de ${MAX_SLOTS} habilidades equipadas. Desequipe uma antes.`;
    return null;
  },

  /**
   * Equipa a habilidade. opts.order = posição na lista de equipadas (ordem de !cast N / lançar rápido);
   * opts.slot = slot do inventário desejado (0-8 hotbar). Sem opts.slot usa o primeiro espaço livre (hotbar antes da mochila).
   * Se o slot desejado estiver ocupado por OUTRO item, os dois trocam de lugar (nada é descartado). Sem espaço livre: recusa.
   */
  equip(player, id, opts = {}) {
    const d = getData(player);
    if (d.equippedSkills.includes(id)) return opts.slot !== undefined ? this.moveTo(player, id, opts.slot) : { ok: true, msg: "Já equipada." };
    const why = this.canEquip(d, id); if (why) return { ok: false, msg: why };
    if (freeSlots(player) === 0) return { ok: false, msg: "Inventário cheio: libere um espaço para receber o item da habilidade." };
    const order = Number.isInteger(opts.order) ? Math.max(0, Math.min(opts.order, d.equippedSkills.length)) : d.equippedSkills.length;
    d.equippedSkills.splice(order, 0, id);
    if (Number.isInteger(opts.slot) && opts.slot >= 0 && opts.slot < INV_SIZE) HotbarLoadout.set(d, id, opts.slot);
    markDirty(player);
    const res = reconcile(player, "equip", { force: true });
    if (!d.skillInst[id] || (res && res.rolledBack)) {   // não conseguiu criar o item: desfaz a lista (estado consistente)
      d.equippedSkills = d.equippedSkills.filter((x) => x !== id); HotbarLoadout.clear(d, id); delete d.skillInst[id]; fix(d); markDirty(player);
      return { ok: false, msg: "Não foi possível criar o item da habilidade agora. Tente de novo." };
    }
    // slot pedido ocupado por outro item? o item novo está no primeiro livre; troca para o slot desejado
    if (Number.isInteger(opts.slot) && HotbarLoadout.slotOf(d, id) !== opts.slot) {
      const mv = moveSkillItem(player, id, opts.slot);
      if (!mv.ok && mv.reason !== "absent") return { ok: true, msg: `${nameOf(id)} equipada (não foi possível usar o slot escolhido).`, slot: HotbarLoadout.slotOf(d, id) };
    }
    if (!opts.silent) saveNow(player);
    emit(EV.SKILL_EQUIPPED, { player, id, slot: HotbarLoadout.slotOf(d, id), silent: !!opts.silent });
    return { ok: true, msg: `${nameOf(id)} equipada.`, slot: HotbarLoadout.slotOf(d, id) };
  },

  /** Remove da lista e apaga SÓ o item da habilidade (a habilidade continua desbloqueada). */
  unequip(player, id) {
    const d = getData(player);
    if (!d.equippedSkills.includes(id)) return { ok: false, msg: "Essa habilidade não está equipada." };
    d.equippedSkills = d.equippedSkills.filter((x) => x !== id);
    HotbarLoadout.clear(d, id); delete d.skillInst[id]; fix(d);
    removeSkillItem(player, id);
    markDirty(player); saveNow(player);
    emit(EV.SKILL_UNEQUIPPED, { player, id });
    return { ok: true, msg: `${nameOf(id)} guardada.` };
  },

  /** Evolução: troca uma habilidade por outra mantendo posição na lista e slot no inventário (ex.: Predador -> Glutonaria). */
  replace(player, oldId, newId) {
    const d = getData(player);
    const i = d.equippedSkills.indexOf(oldId);
    if (i < 0) return { ok: false, msg: "A habilidade antiga não estava equipada." };
    if (d.equippedSkills.includes(newId)) { return this.unequip(player, oldId); }
    if (!isEquippable(newId) || !d.unlockedSkills.includes(newId) || !hasItemType(newId)) return { ok: false, msg: "A nova habilidade não pode ser equipada." };
    const slot = HotbarLoadout.slotOf(d, oldId);
    removeSkillItem(player, oldId);
    d.equippedSkills[i] = newId;
    HotbarLoadout.clear(d, oldId); delete d.skillInst[oldId];
    if (slot >= 0) HotbarLoadout.set(d, newId, slot);
    markDirty(player);
    reconcile(player, "replace", { force: true });
    saveNow(player);
    emit(EV.SKILL_REPLACED, { player, from: oldId, to: newId });
    return { ok: true, msg: `${nameOf(oldId)} evoluiu para ${nameOf(newId)}.` };
  },

  /** Move o item para outro slot (0-35). Se houver outro item lá, os dois trocam de lugar. */
  moveTo(player, id, slot) {
    const d = getData(player);
    if (!d.equippedSkills.includes(id)) return { ok: false, msg: "Equipe a habilidade primeiro." };
    const r = moveSkillItem(player, id, slot);
    if (!r.ok) return { ok: false, msg: r.reason === "absent" ? "O item dessa habilidade não está no inventário (está no cursor ou na mão secundária)." : "Não foi possível mover agora." };
    saveNow(player);
    return { ok: true, msg: r.same ? "Já está nesse slot." : `${nameOf(id)} agora está no slot ${slot < HOTBAR_SIZE ? slot + 1 : "da mochila"}.`, ...r };
  },

  /** Coloca as equipadas que estão na mochila nos slots livres da hotbar, SEM deslocar nenhum outro item. */
  autoArrange(player) {
    const d = getData(player), st = scanInventory(player); if (!st) return { ok: false, moved: 0 };
    let moved = 0;
    for (const id of d.equippedSkills) {
      const cur = st.slots.findIndex((e) => e && e.skill === id);
      if (cur < 0 || cur < HOTBAR_SIZE) continue;
      const free = st.slots.findIndex((e, i) => i < HOTBAR_SIZE && !e);
      if (free < 0) break;
      const r = moveSkillItem(player, id, free);
      if (r.ok) { moved++; st.slots[free] = st.slots[cur]; st.slots[cur] = null; }
    }
    if (moved) saveNow(player);
    return { ok: true, moved };
  },
};

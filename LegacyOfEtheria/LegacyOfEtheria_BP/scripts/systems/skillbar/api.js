// systems/skillbar/api.js - Fachada pública SkillManager (o que os outros sistemas devem usar)
import { getData } from "../../core/db.js";
import { activate, skillState, refreshCooldownVisuals } from "./manager.js";
import { EquippedSkillManager } from "./equipped.js";
import { HotbarLoadout } from "./loadout.js";
import { reconcile, scanInventory, describeHotbar } from "./sync.js";
import { selectedSkill } from "./ui.js";

export const SkillManager = {
  /** Usa a habilidade (mesma sequência do item na hotbar). */
  activate(player, id, via = "api") { return activate(player, id, via); },
  /** Estado da habilidade agora: { ok, state, msg?, left?, cost? }. */
  state(player, id) { return skillState(player, id); },
  /** Habilidade do item que está na mão (ou null). */
  selected(player) { return selectedSkill(player); },
  equip(player, id, opts) { return EquippedSkillManager.equip(player, id, opts); },
  unequip(player, id) { return EquippedSkillManager.unequip(player, id); },
  replace(player, oldId, newId) { return EquippedSkillManager.replace(player, oldId, newId); },
  equipped(player) { return EquippedSkillManager.list(getData(player)); },
  hotbar(player) { return describeHotbar(player); },
  loadout(player) { return HotbarLoadout.hotbar(getData(player)); },
  /** Força a conferência dos itens (restaura faltantes, remove cópias). */
  sync(player, reason = "api") { return reconcile(player, reason, { force: true }); },
  refreshCooldowns(player) { return refreshCooldownVisuals(player); },
  snapshot(player) { return scanInventory(player); },
};

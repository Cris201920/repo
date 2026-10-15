// systems/mastery.js - Maestria por habilidade: cada uso rende XP; níveis dão mais poder e efeitos visuais mais ricos.
import { getData, markDirty } from "../core/db.js";
import { emit, EV } from "../core/bus.js";

export const MASTERY_MAX = 10;
export const masteryXp = (player, id) => getData(player).mastery?.[id] ?? 0;
export const masteryLevel = (player, id) => Math.min(MASTERY_MAX, Math.floor(Math.sqrt(masteryXp(player, id) / 4)));
export const masteryNeed = (lv) => lv >= MASTERY_MAX ? 0 : (lv + 1) * (lv + 1) * 4;
export const masteryPower = (player, id) => 1 + 0.05 * masteryLevel(player, id) + (getData(player).awakened?.[id] ? 0.3 : 0);

export function addMastery(player, id, amount = 1) {
  const d = getData(player); d.mastery ??= {};
  const before = masteryLevel(player, id);
  d.mastery[id] = (d.mastery[id] ?? 0) + amount;
  markDirty(player);
  const after = masteryLevel(player, id);
  if (after >= MASTERY_MAX && before < MASTERY_MAX) { try { emit(EV.SAGE_SKILL_MASTERED, { player, id }); } catch { /* ignore */ } }   // maestria máxima: o Sábio registra (skill_mastered)
  return after > before ? after : 0; // retorna novo nível se subiu
}

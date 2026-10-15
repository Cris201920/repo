// systems/level.js - XP e níveis (até 100)
import { MAX_LEVEL, ATTR_POINTS_PER_LEVEL, SKILL_POINT_EVERY, xpToNext, SOUNDS } from "../config.js";
import { getData, saveNow } from "../core/db.js";
import { heal, say, playSound, toast } from "../core/utils.js";
import { applyDerivedStats, getStats } from "./stats.js";
import { fx } from "./fx.js";
import { refreshName, notifyEvolution } from "./race.js";
import { announceLevel } from "./sageannounce.js";
import { checkAchievements } from "./achievements.js";
import { updateRanking } from "./ranking.js";
import { onLevelQuest } from "./quests.js";
import { sysSay } from "./voice.js";

export function addXp(player, amount) {
  const d = getData(player);
  if (d.level >= MAX_LEVEL || !(amount > 0)) return 0;
  d.xp += Math.floor(amount);
  let leveled = 0;
  while (d.level < MAX_LEVEL && d.xp >= xpToNext(d.level)) {
    d.xp -= xpToNext(d.level);
    d.level += 1;
    d.attributePoints += ATTR_POINTS_PER_LEVEL;
    if (d.level % SKILL_POINT_EVERY === 0) d.skillPoints += 1;
    leveled++;
  }
  if (d.level >= MAX_LEVEL) d.xp = 0;
  if (leveled > 0) onLevelUp(player, d, leveled); else saveNow(player);
  return leveled;
}

function onLevelUp(player, d, n) {
  applyDerivedStats(player);
  const s = getStats(player);
  d.mana = Math.min(s.maxMana, d.mana + s.maxMana * 0.5);
  d.stamina = Math.min(s.maxStamina, d.stamina + s.maxStamina * 0.5);
  try { const h = player.getComponent("minecraft:health"); heal(player, h.effectiveMax * 0.5); } catch { /* ignore */ }
  // 6.36: o nível aparece só na cena da Voz do Mundo (sem chat, sem título vanilla, sem fala do sistema por cima)
  announceLevel(player, d.level, { attr: ATTR_POINTS_PER_LEVEL * n, skillPt: d.level % SKILL_POINT_EVERY === 0 || n > 1 });
  playSound(player, SOUNDS.levelup);
  fx(player.dimension, player.location, "levelup", player, 2);
  refreshName(player);
  checkAchievements(player);
  updateRanking(player);
  onLevelQuest(player);
  notifyEvolution(player);
  saveNow(player);
}

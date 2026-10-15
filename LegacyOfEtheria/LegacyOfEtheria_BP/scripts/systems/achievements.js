import { announceInfo } from "./sageannounce.js";
// systems/achievements.js - Conquistas e títulos
import { getData, markDirty } from "../core/db.js";
import { say, toast, playSound } from "../core/utils.js";
import { ACHIEVEMENTS } from "../data/misc.js";
import { SOUNDS } from "../config.js";

export function checkAchievements(player) {
  const d = getData(player);
  for (const a of ACHIEVEMENTS) {
    if (d.achievements.includes(a.id)) continue;
    let ok = false; try { ok = !!a.check(d); } catch { ok = false; }
    if (!ok) continue;
    d.achievements.push(a.id);
    if (a.title && !d.titles.includes(a.title)) d.titles.push(a.title);
    if (a.coins) d.coins += a.coins;
    markDirty(player);
    announceInfo(player, "CONQUISTA", a.name, `Título "${a.title}"${a.coins ? ` · +${a.coins} moedas` : ""}`, "extra");
    playSound(player, SOUNDS.quest);
  }
}

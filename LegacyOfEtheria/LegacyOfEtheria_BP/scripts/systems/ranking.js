// systems/ranking.js - Ranking global (top 10) guardado em Dynamic Property do mundo
import { world } from "@minecraft/server";
import { WORLD_RANK_KEY } from "../config.js";
import { getData } from "../core/db.js";
import { stageOf } from "../data/races.js";

export function getRanking() {
  try { const raw = world.getDynamicProperty(WORLD_RANK_KEY); return typeof raw === "string" ? JSON.parse(raw) : []; } catch { return []; }
}
export function updateRanking(player) {
  const d = getData(player);
  const list = getRanking().filter((e) => e.n !== player.name);
  const bosses = Object.values(d.bossKills).reduce((a, b) => a + b, 0);
  list.push({ n: player.name, l: d.level, k: d.kills, b: bosses, r: stageOf(d).name });
  list.sort((a, b) => b.l - a.l || b.b - a.b || b.k - a.k);
  try { world.setDynamicProperty(WORLD_RANK_KEY, JSON.stringify(list.slice(0, 10))); } catch { /* ignore */ }
}

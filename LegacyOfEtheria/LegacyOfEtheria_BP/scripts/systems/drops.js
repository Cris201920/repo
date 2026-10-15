// systems/drops.js - XP, moedas, drops e raridade ao derrotar mobs e bosses
import { world, Player, ItemStack } from "@minecraft/server";
import { VANILLA_MOB_XP, DEFAULT_MOB_XP, XP_RATE, RARITY, RARITY_ORDER, ALLY_TAG, SOUNDS } from "../config.js";
import { getData, markDirty, saveNow } from "../core/db.js";
import { chance, randInt, say, toast, playSound, isValid } from "../core/utils.js";
import { MOBS, BOSS_DROPS } from "../data/mobs.gen.js";
import { ITEMS } from "../data/items.gen.js";
import { BOSS_BY_TYPE } from "../data/bosses.js";
import { addXp } from "./level.js";
import { sysSay } from "./voice.js";
import { getStats } from "./stats.js";
import { onKill, onBoss } from "./quests.js";
import { onBossDefeated } from "./factions.js";
import { checkAchievements } from "./achievements.js";
import { updateRanking } from "./ranking.js";
import { nameOf, ensureLore } from "./items.js";
import { fx } from "./fx.js";

function drop(dim, loc, id, n) {
  try {
    const it = new ItemStack(id, n);
    if (ITEMS[id] && ["weapon", "armor", "accessory"].includes(ITEMS[id].kind)) ensureLore(it);
    dim.spawnItem(it, loc);
  } catch { /* ignore */ }
}

// Pool de equipamentos raros: a raridade define a chance (RARITY[x].drop); mobs mais fortes liberam raridades maiores.
const POOL = {};
for (const inf of Object.values(ITEMS)) {
  if (!["weapon", "armor", "accessory"].includes(inf.kind) || inf.boss || !(inf.price > 0)) continue;
  (POOL[inf.rarity] ??= []).push(inf.id);
}
function rareRoll(tier) {
  if (!chance(0.012 * tier)) return null;
  const maxIdx = Math.min(RARITY_ORDER.length - 1, 1 + Math.floor(tier * 1.2));
  const weights = RARITY_ORDER.slice(0, maxIdx + 1).filter((r) => POOL[r]?.length).map((r) => [r, RARITY[r].drop]);
  const total = weights.reduce((a, [, w]) => a + w, 0); if (total <= 0) return null;
  let x = Math.random() * total;
  for (const [r, w] of weights) { x -= w; if (x <= 0) { const p = POOL[r]; return p[Math.floor(Math.random() * p.length)]; } }
  return null;
}
function isMonster(e) { try { return !!e.getComponent("minecraft:type_family")?.hasTypeFamily("monster"); } catch { return false; } }

function onDie(ev) {
  const dead = ev.deadEntity, killer = ev.damageSource?.damagingEntity;
  if (dead instanceof Player) return;
  let tid, loc, dim;
  try { tid = dead.typeId; } catch { return; }
  const bossDef = BOSS_BY_TYPE[tid];
  try { loc = dead.location; dim = dead.dimension; } catch { if (killer instanceof Player) { loc = killer.location; dim = killer.dimension; } else return; }
  if (bossDef) return onBossDie(bossDef, loc, dim, killer);
  if (!(killer instanceof Player) || !isValid(killer)) return;
  try { if (dead.hasTag(ALLY_TAG) || dead.hasTag("etheria_minion")) return; } catch { /* ignore */ }   // súditos de chefe não dão XP/moedas (evita farm)
  const m = MOBS[tid];
  let xp = m?.xp ?? VANILLA_MOB_XP[tid] ?? (isMonster(dead) ? DEFAULT_MOB_XP : 0);
  if (xp <= 0) return;
  const d = getData(killer), s = getStats(killer);
  d.kills += 1;
  xp = Math.floor(xp * XP_RATE * (1 + s.xpPct / 100));
  let coins = m ? randInt(m.coins[0], m.coins[1]) : (xp >= 7 ? randInt(0, 2) : 0);
  coins = Math.floor(coins * (1 + s.coinPct / 100));
  if (coins > 0) d.coins += coins;
  for (const [id, min, max, p] of m?.drops ?? []) if (chance(p)) drop(dim, loc, id, randInt(min, max));
  const tier = m ? Math.max(1, Math.min(4, m.hp / 25)) : 1;
  const rare = rareRoll(tier);
  if (rare) { drop(dim, loc, rare, 1); say(killer, `§6§l[Drop raro]§r ${nameOf(rare)}`); playSound(killer, SOUNDS.rare); }
  markDirty(killer);
  sysSay(killer, "combat", "kill", { cd: 1800 });
  onKill(killer, tid);
  addXp(killer, xp);
  checkAchievements(killer);
  if (d.kills % 25 === 0) updateRanking(killer);
}

function onBossDie(def, loc, dim, killer) {
  let players = [];
  try { players = dim.getPlayers({ location: loc, maxDistance: 48 }); } catch { /* ignore */ }
  if (killer instanceof Player && !players.some((p) => p.id === killer.id)) players.push(killer);
  const loot = BOSS_DROPS[def.key] ?? [];
  for (const p of players) {
    const d = getData(p), s = getStats(p);
    d.bossKills[def.key] = (d.bossKills[def.key] ?? 0) + 1; d.kills += 1;
    const coins = Math.floor(randInt(def.coins[0], def.coins[1]) * (1 + s.coinPct / 100));
    d.coins += coins;
    const got = [];
    for (const [id, min, max, pr] of loot) if (chance(pr)) { const n = randInt(min, max); drop(p.dimension, p.location, id, n); got.push(`${n}x ${nameOf(id)}`); }
    say(p, `${def.color}§l[${def.name} derrotado!]§r §7+${Math.floor(def.xp * (1 + s.xpPct / 100))} XP, +${coins} moedas${got.length ? "\n§7Loot: " + got.join("§7, ") : ""}`);
    toast(p, `${def.color}§l${def.name}`, "§7foi derrotado!");
    playSound(p, SOUNDS.levelup, 1, 0.6);
    fx(p.dimension, p.location, "legendary", p, 2);
    markDirty(p);
    onBoss(p, def.key);
    try { onBossDefeated(p, def.key); } catch (e) { console.warn(`[Etheria] mundo/boss: ${e}`); }
    addXp(p, Math.floor(def.xp * XP_RATE * (1 + s.xpPct / 100)));
    checkAchievements(p); updateRanking(p); saveNow(p);
  }
}

export function startDrops() { world.afterEvents.entityDie.subscribe(onDie); }

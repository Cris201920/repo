// systems/guild.js - Guilda de aventureiros: reputação, ranks F..SSS e recompensas
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, toast, playSound, giveItem } from "../core/utils.js";
import { GUILD_RANKS, GUILD_REP, GUILD_REWARDS } from "../data/misc.js";
import { checkAchievements } from "./achievements.js";
import { updateRanking } from "./ranking.js";
import { nameOf } from "./items.js";
import { SOUNDS } from "../config.js";

export function joinGuild(player) {
  const d = getData(player);
  if (d.guild.id) return { ok: false, msg: "Você já faz parte da Guilda." };
  d.guild.id = "etheria_guild"; d.guild.rank = 0; d.guild.reputation = 0;
  markDirty(player); saveNow(player);
  toast(player, "§6§lGUILDA", "§7Bem-vindo, aventureiro rank F");
  playSound(player, SOUNDS.quest);
  return { ok: true, msg: "Você entrou na Guilda de Etheria!" };
}
export function rankFor(rep) { let r = 0; GUILD_REP.forEach((min, i) => { if (rep >= min) r = i; }); return r; }
export function addRep(player, n) {
  const d = getData(player); if (!d.guild.id) return;
  d.guild.reputation += n;
  const nr = rankFor(d.guild.reputation);
  if (nr > d.guild.rank) {
    d.guild.rank = nr;
    toast(player, "§6§lRANK DA GUILDA", `§fRank ${GUILD_RANKS[nr]}`);
    say(player, `§6§l[Guilda]§r §eVocê subiu para o rank §f${GUILD_RANKS[nr]}§e! Fale com a Recepcionista para resgatar a recompensa.`);
    playSound(player, SOUNDS.levelup);
    checkAchievements(player); updateRanking(player);
  }
  markDirty(player);
}
export function claimable(d) {
  const out = [];
  for (let i = 1; i <= d.guild.rank; i++) if (GUILD_REWARDS[i] && !d.guild.claimed.includes(i)) out.push(i);
  return out;
}
export function claimRewards(player) {
  const d = getData(player), list = claimable(d);
  if (list.length === 0) return { ok: false, msg: "Nenhuma recompensa disponível." };
  const lines = [];
  for (const i of list) {
    const r = GUILD_REWARDS[i];
    d.coins += r.coins; d.guild.claimed.push(i);
    for (const [id, n] of r.items ?? []) giveItem(player, id, n);
    lines.push(`Rank ${GUILD_RANKS[i]}: ${r.coins} moedas${(r.items ?? []).map(([id, n]) => `, ${n}x ${nameOf(id)}`).join("")}`);
  }
  markDirty(player); saveNow(player); playSound(player, SOUNDS.coins);
  return { ok: true, msg: lines.join("\n") };
}

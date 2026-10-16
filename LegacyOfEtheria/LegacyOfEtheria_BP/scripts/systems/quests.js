// systems/quests.js - Missões (matar, coletar, entregar, explorar, boss, nível, conversar)
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, toast, playSound, giveItem, countItem, removeItem } from "../core/utils.js";
import { QUESTS } from "../data/quests.js";
import { nameOf } from "./items.js";
import { addXp } from "./level.js";
import { addRep } from "./guild.js";
import { grantSkill } from "./skills.js";
import { checkAchievements } from "./achievements.js";
import { SOUNDS } from "../config.js";
import { addFactionRep, hasFlag, setFlag, changeRelation } from "./factions.js";

const day = () => Math.floor(Date.now() / 86400000);

export function isDone(d, id) {
  const q = QUESTS[id];
  return q.giver === "guild" ? d.quests.daily[id] === day() : d.quests.completed.includes(id);
}
export function canAccept(d, q) {
  if (d.quests.active[q.id]) return "Já aceita";
  if (isDone(d, q.id)) return q.giver === "guild" ? "Concluída hoje" : "Concluída";
  if (d.level < (q.minLevel ?? 1)) return `Requer nível ${q.minLevel}`;
  if (q.flag && !hasFlag(d, q.flag)) return "Ainda não disponível (progrida no mundo)";
  for (const r of q.req ?? []) if (!d.quests.completed.includes(r)) return `Requer: ${QUESTS[r]?.name ?? r}`;
  if (q.giver === "guild") {
    if (!d.guild.id) return "Entre na Guilda primeiro";
    if (d.guild.rank < (q.minGuildRank ?? 0)) return "Rank da guilda insuficiente";
  }
  return null;
}
export function acceptQuest(player, id) {
  const d = getData(player), q = QUESTS[id];
  if (!q) return { ok: false, msg: "Missão inválida." };
  const why = canAccept(d, q);
  if (why) return { ok: false, msg: why };
  if (Object.keys(d.quests.active).length >= 6) return { ok: false, msg: "Máximo de 6 missões ativas." };
  d.quests.active[id] = { p: q.objectives.map(() => 0), sx: Math.round(player.location.x), sz: Math.round(player.location.z), dim: player.dimension.id };
  markDirty(player); saveNow(player);
  playSound(player, SOUNDS.quest);
  evaluate(player, id);
  return { ok: true, msg: `Missão aceita: ${q.name}` };
}
export function abandonQuest(player, id) { const d = getData(player); delete d.quests.active[id]; markDirty(player); saveNow(player); }

function done(q, st) { return q.objectives.every((o, i) => st.p[i] >= (o.n ?? 1)); }

/** Recalcula objetivos "vivos" (coletar/explorar/nível) e conclui se possível. */
function evaluate(player, id) {
  const d = getData(player), q = QUESTS[id], st = d.quests.active[id];
  if (!q || !st) return;
  q.objectives.forEach((o, i) => {
    if (o.type === "collect") st.p[i] = Math.min(o.n, countItem(player, o.item));
    else if (o.type === "level") st.p[i] = d.level >= o.n ? o.n : 0;
    else if (o.type === "explore" && player.dimension.id === st.dim) {
      const dx = player.location.x - st.sx, dz = player.location.z - st.sz;
      st.p[i] = Math.max(st.p[i], Math.min(o.n, Math.floor(Math.hypot(dx, dz))));
    }
  });
  if (done(q, st)) completeQuest(player, id);
}
import { sysSay } from "./voice.js";
import { emit, EV } from "../core/bus.js";
function completeQuest(player, id) {
  sysSay(player, "main", "quest", { cd: 300 });
  const d = getData(player), q = QUESTS[id];
  delete d.quests.active[id];
  if (q.giver === "guild") d.quests.daily[id] = day(); else d.quests.completed.push(id);
  const r = q.reward ?? {};
  if (r.coins) d.coins += r.coins;
  if (r.sp) d.skillPoints += r.sp;
  for (const [item, n] of r.items ?? []) giveItem(player, item, n);
  const lines = [r.xp ? `${r.xp} XP` : "", r.coins ? `${r.coins} moedas` : "", r.sp ? `${r.sp} pt. habilidade` : "", r.rep ? `${r.rep} reputação` : "",
    ...(r.frep ? Object.entries(r.frep).map(([f, n]) => `${n > 0 ? "+" : ""}${n} rep. ${f}`) : []),
    ...(r.items ?? []).map(([i, n]) => `${n}x ${nameOf(i)}`)].filter(Boolean);
  say(player, `§a§l[Missão concluída]§r §f${q.name}\n§7Recompensa: §e${lines.join("§7, §e")}`);
  toast(player, "§a§lMISSÃO CONCLUÍDA", `§f${q.name}`);
  playSound(player, SOUNDS.quest);
  markDirty(player);
  if (r.rep) addRep(player, r.rep);
  if (r.frep) for (const [f, n] of Object.entries(r.frep)) addFactionRep(player, f, n, q.name);
  if (r.skill) { try { grantSkill(player, r.skill); } catch { /* ignore */ } }
  if (r.flagSet) setFlag(player, r.flagSet);
  for (const [a, b, dv] of r.dipl ?? []) changeRelation(a, b, dv, player);
  if (r.xp) addXp(player, r.xp);
  checkAchievements(player); saveNow(player);
  try { emit(EV.QUEST_COMPLETED, { player, id, name: q.name }); } catch { /* ignore */ }
}

function eachActive(player, fn) {
  const d = getData(player);
  for (const id of Object.keys(d.quests.active)) { const q = QUESTS[id], st = d.quests.active[id]; if (q && st) fn(q, st, id); }
}
export function onKill(player, typeId) {
  let changed = false;
  eachActive(player, (q, st, id) => {
    q.objectives.forEach((o, i) => { if (o.type === "kill" && o.target === typeId && st.p[i] < o.n) { st.p[i]++; changed = true; } });
    if (done(q, st)) completeQuest(player, id);
  });
  if (changed) markDirty(player);
}
export function onBoss(player, key) {
  eachActive(player, (q, st, id) => {
    q.objectives.forEach((o, i) => { if (o.type === "boss" && o.target === key && st.p[i] < o.n) st.p[i]++; });
    if (done(q, st)) completeQuest(player, id);
  });
}
export function onWorldEvent(player, key) {
  eachActive(player, (q, st, id) => {
    q.objectives.forEach((o, i) => { if (o.type === key && st.p[i] < (o.n ?? 1)) st.p[i]++; });
    if (done(q, st)) completeQuest(player, id);
  });
  markDirty(player);
}
export function onLevelQuest(player) { eachActive(player, (q, st, id) => evaluate(player, id)); }
export function onTalk(player, npc) {
  eachActive(player, (q, st, id) => {
    q.objectives.forEach((o, i) => { if (o.type === "talk" && o.npc === npc) st.p[i] = 1; });
    if (done(q, st)) completeQuest(player, id);
  });
}
/** Entrega itens das missões "deliver" ao NPC. Retorna linhas de feedback. */
export function deliverAt(player, npc) {
  const msgs = [];
  eachActive(player, (q, st, id) => {
    q.objectives.forEach((o, i) => {
      if (o.type !== "deliver" || o.npc !== npc || st.p[i] >= o.n) return;
      const have = countItem(player, o.item), n = Math.min(have, o.n - st.p[i]);
      if (n > 0 && removeItem(player, o.item, n)) { st.p[i] += n; msgs.push(`Entregou ${n}x ${nameOf(o.item)} (${q.name})`); }
    });
    if (done(q, st)) completeQuest(player, id);
  });
  markDirty(player);
  return msgs;
}
/** Chamado 1x/s para jogadores com missões vivas (coletar/explorar). */
export function tickQuests(player) {
  const d = getData(player);
  for (const id of Object.keys(d.quests.active)) {
    const q = QUESTS[id];
    if (q?.objectives.some((o) => o.type === "collect" || o.type === "explore")) evaluate(player, id);
  }
}
export function describe(player, id) {
  const d = getData(player), q = QUESTS[id], st = d.quests.active[id];
  const lines = q.objectives.map((o, i) => `${(st?.p[i] ?? 0) >= o.n ? "§a[x]" : "§7•"} §f${o.label ?? o.type} §7${Math.min(st?.p[i] ?? 0, o.n)}/${o.n}`);
  return lines;
}
export function trackerLine(player) {
  const d = getData(player), ids = Object.keys(d.quests.active);
  if (ids.length === 0) return "";
  const q = QUESTS[ids[0]], st = d.quests.active[ids[0]];
  const i = q.objectives.findIndex((o, k) => st.p[k] < o.n);
  const o = q.objectives[Math.max(0, i)];
  return `§6${q.name}§7: ${o.label ?? o.type} ${Math.min(st.p[Math.max(0, i)], o.n)}/${o.n}`;
}

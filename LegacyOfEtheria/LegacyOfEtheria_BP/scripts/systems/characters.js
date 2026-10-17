// systems/characters.js - 6.43: DIÁLOGOS DOS PERSONAGENS (Rimuru, Benimaru, Shion, Shuna e os Lordes do Octagrama).
// Interface: nome + título do personagem, fala contextual (primeira vez / normal / discípulo / rival) e opções que executam ações reais:
//   Conversar (assuntos próprios) · Pedir missão (sistema de missões existente) · Tornar-se discípulo (requisitos + prova) ·
//   Treinamento (aulas existentes, só para discípulos) · Desafiar (com confirmação e nível mínimo) · Comércio (loja da nação) · Despedir-se.
// Conselho de Tempest: fica calmo (grupo etheria_calm: não ataca nem leva dano). O desafio vira um DUELO: o personagem luta e se rende
// com 15% de vida (nunca morre de vez); derrota/fuga/tempo encerram o duelo e ele volta ao posto.
// Octagrama: o desafio inicia a luta de chefe que já existe (mesmas recompensas do chefe).
import { world, system } from "@minecraft/server";
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, toast, fmt, pick, playSound, isValid, holdTitle } from "../core/utils.js";
import { menu } from "./ui/forms.js";
import { CHARACTERS } from "../data/characters.js";
import { QUESTS } from "../data/quests.js";
import { SKILLS } from "../data/skills.js";
import { acceptQuest, canAccept, isDone, describe, onTalk, deliverAt } from "./quests.js";
import { wd, repOf, addFactionRep, hasFlag } from "./factions.js";
import { FACTIONS } from "../data/factions.js";
import { lessonReqs, learnLesson, openFacShop } from "./worldnpc.js";
import { addXp } from "./level.js";
import { checkAchievements } from "./achievements.js";
import { residentHome, reviveResident } from "./realms.js";
import { SOUNDS } from "../config.js";
import { sageText } from "./voice.js";

const CALM = "etheria_calm", DUEL = "etheria_duel", IDLE = "etheria_oct_idle";
const DUEL_MAX = 6000, DUEL_RANGE = 48, YIELD = 0.15, DUEL_CD = 12000;
const idOf = (e) => { try { return e.typeId.startsWith("etheria:") ? e.typeId.slice(8) : null; } catch { return null; } };
const charOf = (e) => CHARACTERS[idOf(e)];
const rel = (d, id) => { const w = wd(d); w.chars ??= {}; return (w.chars[id] ??= {}); };
const back = (fn) => ({ text: "§7« Voltar", icon: "back", run: fn });
const quoted = (C, s) => `${C.color}${C.name}:§r §f"${s}"`;
const ok = (p, r) => say(p, `${r.ok ? "§a" : "§c"}${r.msg}`);

/** pode conversar agora? (morador calmo do Conselho ou lorde parado no trono, sem luta em andamento) */
export function canTalk(e) {
  const C = charOf(e); if (!C) return false;
  if (e.hasTag(DUEL)) return false;
  return C.where === "octagrama" ? e.hasTag(IDLE) : e.hasTag(CALM);
}

// ------------------------------------------------------------------ tela principal
export function openCharacter(player, e) {
  const id = idOf(e), C = CHARACTERS[id]; if (!C) return;
  const d = getData(player), r = rel(d, id), first = !r.met;
  r.met = 1; r.talks = (r.talks ?? 0) + 1; markDirty(player);
  onTalk(player, id);
  for (const m of deliverAt(player, id)) say(player, `§a${m}`);
  const G = C.greet ?? {};
  const line = first && G.first ? pick(G.first) : (wd(d).master === id && G.disciple) ? pick(G.disciple) : ((r.wins ?? 0) > 0 && G.rival) ? pick(G.rival) : pick(G.normal ?? ["..."]);
  const F = C.faction && FACTIONS[C.faction];
  const status = [F ? `${F.color}${F.short}: §f${repOf(d, C.faction)}` : "", wd(d).master === id ? "§a[seu mestre]" : "", (r.wins ?? 0) > 0 ? `§e${r.wins} vitória(s) em duelo` : ""].filter(Boolean).join(" §8| ");
  const body = `${C.color}${C.title}${status ? `\n${status}` : ""}\n\n${quoted(C, line)}`;
  const b = [{ text: "§lConversar\n§r§7Assuntos de " + C.name.split(" ")[0], icon: "menu_skills", run: () => openTalk(player, e) }];
  if (C.quests?.length) b.push({ text: "§l§eSolicitar uma missão\n§r§7Pedidos e provas", icon: "menu_quests", run: () => openQuests(player, e) });
  if (C.disciple) b.push(wd(d).master === id
    ? { text: "§l§aTreinamento de discípulo\n§r§7Técnicas do seu mestre", icon: "menu_class", run: () => openTraining(player, e) }
    : { text: "§l§bTornar-me seu discípulo", icon: "menu_class", run: () => openDisciple(player, e) });
  if (C.duel) b.push({ text: `§l§cDesafiar\n§r§7Nível mínimo ${C.duel.lvl}`, icon: "menu_status", run: () => openChallenge(player, e) });
  if (C.shop) b.push({ text: "§l§6Comércio\n§r§7Itens da nação", icon: "menu_inventory", run: () => openFacShop(player, C.shop, 0) });
  b.push({ text: "Despedir-se", run: () => say(player, quoted(C, pick(["Até mais.", "Cuide-se.", "Volte quando quiser."]))) });
  menu(player, `${C.color}§l${C.name}`, body, b);
}

function openTalk(player, e) {
  const C = charOf(e); if (!C) return;
  const b = (C.talk ?? []).map(([t, s]) => ({ text: `§l${t}`, run: () => menu(player, `${C.color}§l${C.name}`, quoted(C, s), [back(() => openTalk(player, e))]) }));
  b.push(back(() => openCharacter(player, e)));
  menu(player, `${C.color}§l${C.name}`, quoted(C, "Sobre o que quer conversar?"), b);
}

// ------------------------------------------------------------------ missões (sistema existente)
function openQuests(player, e) {
  const C = charOf(e), d = getData(player); if (!C) return;
  const b = C.quests.map((id) => QUESTS[id]).filter(Boolean).map((q) => {
    const act = d.quests.active[q.id], why = act ? null : canAccept(d, q), dn = isDone(d, q.id);
    const tag = dn ? "§a[concluída]" : act ? "§e[em andamento]" : why ? `§c${why}` : "§aDisponível";
    return { text: `§l${q.name}\n§r${tag}`, icon: "menu_quests", run: () => openQuest(player, e, q.id) };
  });
  b.push(back(() => openCharacter(player, e)));
  menu(player, `${C.color}§l${C.name}`, quoted(C, "Tenho alguns pedidos. Está preparado para ajudar?"), b);
}
function openQuest(player, e, id) {
  const C = charOf(e), d = getData(player), q = QUESTS[id], act = d.quests.active[id], why = act ? null : canAccept(d, q), r = q.reward ?? {};
  const rew = [r.xp ? `${r.xp} XP` : "", r.coins ? `${r.coins} moedas` : "", ...Object.entries(r.frep ?? {}).map(([f, n]) => `+${n} rep. ${FACTIONS[f]?.short ?? f}`)].filter(Boolean).join("§7, §e");
  const body = [`§f${q.desc}`, "", "§e§lObjetivos", ...(act ? describe(player, id) : q.objectives.map((o) => `§7• §f${o.label ?? o.type} §7(${o.n ?? 1})`)), "", `§7Nível mínimo: §f${q.minLevel ?? 1}`, `§7Recompensa: §e${rew || "—"}`].join("\n");
  const b = [];
  if (!act && !why && !isDone(d, id)) b.push({ text: "§a§lAceitar missão", icon: "menu_quests", run: () => { ok(player, acceptQuest(player, id)); openQuests(player, e); } });
  if (why && !act) b.push({ text: `§c${why}` });
  b.push(back(() => openQuests(player, e)));
  menu(player, `§e${q.name}`, body, b);
}

// ------------------------------------------------------------------ discípulo
export function discipleReqs(player, id) {
  const C = CHARACTERS[id], D = C?.disciple, d = getData(player), out = []; if (!D) return out;
  const ck = (okk, t) => out.push({ ok: okk, text: `${okk ? "§a[x]" : "§c[ ]"} §f${t}` });
  ck(d.level >= D.lvl, `Nível ${D.lvl} (você: ${d.level})`);
  for (const [f, n] of Object.entries(D.rep ?? {})) ck(repOf(d, f) >= n, `Reputação ${FACTIONS[f]?.short ?? f} ${n} (você: ${repOf(d, f)})`);
  if (D.quest) ck(d.quests.completed.includes(D.quest), `Missão concluída: ${QUESTS[D.quest]?.name ?? D.quest}`);
  return out;
}
function openDisciple(player, e) {
  const id = idOf(e), C = CHARACTERS[id], D = C.disciple, d = getData(player), cur = wd(d).master;
  const extra = cur && cur !== id ? `\n§6Atenção: você é discípulo de ${CHARACTERS[cur]?.name ?? cur}. Aceitar troca de mestre.` : "";
  menu(player, `${C.color}§l${C.name}`, `${quoted(C, D.ask)}${extra}`, [
    { text: "§a§lAceitar o treinamento", run: () => {
      const miss = discipleReqs(player, id).filter((x) => !x.ok);
      if (miss.length) { try { sageText(player, `Requisitos para ser discípulo de ${C.name}: ${miss.map((x) => x.text.replace(/§./g, "").replace("[ ] ", "")).join("; ")}.`, { pri: 4, key: "disc." + id, cd: 600 }); } catch { /* ignore */ } }
      if (miss.length) return menu(player, `${C.color}§l${C.name}`, `${quoted(C, "Ainda não. Volte quando cumprir isto:")}\n\n${discipleReqs(player, id).map((x) => x.text).join("\n")}`, [back(() => openCharacter(player, e))]);
      wd(d).master = id; rel(d, id).disciple = 1; markDirty(player); saveNow(player);
      say(player, quoted(C, D.yes)); toast(player, "§b§lNOVO MESTRE", `§f${C.name}`); playSound(player, SOUNDS.quest);
      if (D.trial && !isDone(d, D.trial) && !d.quests.active[D.trial]) ok(player, acceptQuest(player, D.trial));
      checkAchievements(player);
    } },
    { text: "§lQuais são os requisitos?", run: () => menu(player, `${C.color}§l${C.name}`, `§e§lRequisitos\n${discipleReqs(player, id).map((x) => x.text).join("\n")}${D.trial ? `\n\n§7Depois de aceito: prova §f${QUESTS[D.trial]?.name}` : ""}\n§7Benefícios: §ftreino diário e as técnicas de ${C.name.split(" ")[0]}.`, [back(() => openDisciple(player, e))]) },
    { text: "§cRecusar", run: () => say(player, quoted(C, D.no)) },
  ]);
}
function openTraining(player, e) {
  const id = idOf(e), C = CHARACTERS[id], D = C.disciple, d = getData(player), r = rel(d, id);
  const today = Math.floor(Date.now() / 86400000), trained = r.trainDay === today, trialDone = !D.trial || hasFlag(d, "disc_" + id);
  const b = [];
  b.push({ text: trained ? "§7Treino diário (já feito hoje)" : `§l§aTreino diário\n§r§7+${d.level * 40} XP, grátis 1x por dia`, icon: "menu_status", run: () => {
    if (rel(d, id).trainDay === today) return say(player, quoted(C, "Já treinamos hoje. Descanse."));
    rel(d, id).trainDay = today; markDirty(player); addXp(player, d.level * 40); say(player, quoted(C, "Bom treino. Amanhã tem mais.")); playSound(player, SOUNDS.quest);
  } });
  for (const sk of D.lessons) {
    const S = SKILLS[sk]; if (!S) continue;
    const learned = d.unlockedSkills.includes(sk), ready = trialDone && !learned && lessonReqs(player, sk).every((x) => x.ok);
    b.push({ text: `§l${S.name}\n§r${learned ? "§a[aprendida]" : !trialDone ? "§cconclua a prova de discípulo" : ready ? "§a★ pronta para aprender" : "§7ver requisitos"}`, icon: "skill_" + sk, run: () => {
      const reqs = lessonReqs(player, sk);
      const bb = [];
      if (!learned && trialDone && reqs.every((x) => x.ok)) bb.push({ text: "§a§lAprender agora", run: () => { ok(player, learnLesson(player, sk, D.role)); openTraining(player, e); } });
      bb.push(back(() => openTraining(player, e)));
      menu(player, `§b${S.name}`, `§f${S.desc}\n\n§e§lRequisitos\n${reqs.map((x) => x.text).join("\n")}${trialDone ? "" : `\n§c[ ] §fProva: ${QUESTS[D.trial]?.name}`}`, bb);
    } });
  }
  if (D.trial && !trialDone && !d.quests.active[D.trial] && !isDone(d, D.trial)) b.push({ text: "§e§lReceber a prova de discípulo", run: () => { ok(player, acceptQuest(player, D.trial)); } });
  b.push({ text: "§cDeixar de ser discípulo", run: () => { if (wd(d).master === id) { delete wd(d).master; markDirty(player); } say(player, quoted(C, "Entendo. Boa sorte no seu caminho.")); } });
  b.push(back(() => openCharacter(player, e)));
  menu(player, `${C.color}§l${C.name} — Treinamento`, quoted(C, pick(C.greet?.disciple ?? ["Vamos treinar."])), b);
}

// ------------------------------------------------------------------ desafio
const duels = new Map();   // id da entidade -> { pid, id, start, home }
const lastDuel = new Map();
function openChallenge(player, e) {
  const id = idOf(e), C = CHARACTERS[id], X = C.duel, d = getData(player);
  menu(player, `${C.color}§l${C.name}`, quoted(C, X.ask), [
    { text: "§c§lIniciar desafio", run: () => startChallenge(player, e) },
    { text: "§lVerificar meu nível", run: () => menu(player, "§lSeu nível", `§fSeu nível: §e${d.level}\n§fNível exigido: ${d.level >= X.lvl ? "§a" : "§c"}${X.lvl}\n${C.where !== "octagrama" ? "§7Duelo: o personagem se rende com 15% de vida. Se você cair ou fugir, perde." : "§7Luta real contra um Lorde do Octagrama: só termina com a derrota de um dos dois."}`, [back(() => openChallenge(player, e))]) },
    { text: "Desistir", run: () => say(player, quoted(C, "Sábia escolha.")) },
  ]);
}
function startChallenge(player, e) {
  const id = idOf(e), C = CHARACTERS[id], X = C.duel, d = getData(player);
  if (!isValid(e) || !canTalk(e)) return say(player, "§cNão é possível desafiar agora.");
  if (d.level < X.lvl) { try { sageText(player, `Análise: ${C.name} exige nível ${X.lvl}. Seu nível atual é ${d.level}. Probabilidade de vitória insuficiente.`, { pri: 4, key: "duel." + id, cd: 600 }); } catch { /* ignore */ } return say(player, quoted(C, `Volte quando tiver nível ${X.lvl}. Agora seria só uma surra.`)); }
  if ([...duels.values()].some((x) => x.pid === player.id)) return say(player, "§cVocê já está em um desafio.");
  const k = `${player.id}:${id}`, now = system.currentTick;
  if (now - (lastDuel.get(k) ?? -1e9) < DUEL_CD) return say(player, quoted(C, "Acabamos de lutar. Descanse um pouco antes."));
  lastDuel.set(k, now);
  say(player, quoted(C, X.start));
  if (C.where === "octagrama") {                      // luta de chefe que já existe: o lorde sai do trono ao ser provocado
    try { e.applyDamage(1, { cause: "entityAttack", damagingEntity: player }); } catch { try { e.removeTag(IDLE); } catch { /* ignore */ } }
    return;
  }
  duels.set(e.id, { pid: player.id, id, where: C.where, start: now, home: (C.where === "council" ? residentHome("council", id) : null) ?? { ...e.location }, ent: e });
  try { e.removeTag(CALM); e.removeTag(IDLE); e.addTag(DUEL); e.removeEffect("slowness"); e.triggerEvent("etheria:provoke"); } catch { /* ignore */ }
  let n = 3;
  const h = system.runInterval(() => {
    holdTitle(player, 20);
    try { player.onScreenDisplay.setTitle(n > 0 ? `§c${n}` : "§c§lLUTE!", { fadeInDuration: 0, stayDuration: 14, fadeOutDuration: 4 }); } catch { /* ignore */ }
    if (n-- <= 0) { system.clearRun(h); try { if (isValid(e)) e.applyDamage(1, { cause: "entityAttack", damagingEntity: player }); } catch { /* ignore */ } }
  }, 20);
}
function endDuel(eid, result) {
  const X = duels.get(eid); if (!X) return; duels.delete(eid);
  const C = CHARACTERS[X.id], e = X.ent, player = world.getAllPlayers().find((p) => p.id === X.pid);
  if (e && isValid(e)) {
    try { e.getComponent("minecraft:health")?.resetToMaxValue(); } catch { /* ignore */ }
    try { e.triggerEvent("etheria:calm"); e.removeTag(DUEL); e.addTag(CALM); if (X.where === "council") e.addTag(IDLE); if (X.home) e.teleport(X.home); } catch { /* ignore */ }
  } else if (X.where === "council") system.runTimeout(() => reviveResident("council", X.id), 5);   // caiu de vez: volta a existir no próximo ciclo do Conselho (depois do registro de morte)
  if (!player) return;
  const d = getData(player), r = rel(d, X.id);
  if (result === "win") {
    const first = !(r.wins > 0), rw = C.duel.reward ?? {}, k = first ? 1 : 0.25;
    r.wins = (r.wins ?? 0) + 1; markDirty(player);
    if (rw.coins) d.coins += Math.round(rw.coins * k);
    if (rw.xp) addXp(player, Math.round(rw.xp * k));
    if (rw.rep && C.faction) addFactionRep(player, C.faction, Math.round(rw.rep * k), `duelo com ${C.name}`, false);
    say(player, quoted(C, C.duel.win)); toast(player, "§a§lVITÓRIA NO DUELO", `§f${C.name}${first ? " §e(primeira vitória)" : ""}`); playSound(player, SOUNDS.quest);
    say(player, `§7Recompensa: §e${Math.round((rw.xp ?? 0) * k)} XP§7, §e${Math.round((rw.coins ?? 0) * k)} moedas${rw.rep && C.faction ? `§7, §e+${Math.round(rw.rep * k)} reputação` : ""}`);
  } else {
    r.losses = (r.losses ?? 0) + 1; markDirty(player);
    say(player, quoted(C, result === "time" ? "Chega por hoje. Empate." : result === "fled" ? "Fugiu? Tudo bem, volte quando estiver pronto." : C.duel.lose));
  }
  checkAchievements(player); saveNow(player);
}

// ------------------------------------------------------------------ eventos
const lastTalk = new Map();
export function startCharacters() {
  world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
    const p = ev.player, e = ev.target; if (!p || !e || !charOf(e)) return;
    const now = system.currentTick; if (now - (lastTalk.get(p.id) ?? -99) < 10) return; lastTalk.set(p.id, now);
    if (!canTalk(e)) return;
    system.run(() => { try { openCharacter(p, e); } catch (er) { console.warn(`[Etheria] diálogo: ${er}`); } });
  });
  system.runInterval(() => {
    const now = system.currentTick;
    for (const [eid, X] of duels) {
      const e = X.ent, p = world.getAllPlayers().find((q) => q.id === X.pid);
      if (!e || !isValid(e)) { endDuel(eid, "win"); continue; }
      if (!p) { endDuel(eid, "fled"); continue; }
      const hp = e.getComponent("minecraft:health");
      if (hp && hp.currentValue <= hp.effectiveMax * YIELD) { endDuel(eid, "win"); continue; }
      if (p.dimension.id !== e.dimension.id || Math.hypot(p.location.x - e.location.x, p.location.z - e.location.z) > DUEL_RANGE) { endDuel(eid, "fled"); continue; }
      if (now - X.start > DUEL_MAX) endDuel(eid, "time");
    }
  }, 10);
  world.afterEvents.entityDie.subscribe((ev) => {
    const dead = ev.deadEntity; if (!dead) return;
    if (dead.typeId === "minecraft:player") { for (const [eid, X] of duels) if (X.pid === dead.id) endDuel(eid, "lose"); return; }
    if (duels.has(dead.id)) endDuel(dead.id, "win");
  });
}
export const __test = { duels, endDuel, startChallenge, canTalk, CHARACTERS };

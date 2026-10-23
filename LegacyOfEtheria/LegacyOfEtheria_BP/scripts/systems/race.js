// systems/race.js - Raça, classe, evolução/transformação e título no nome
import { sceneOn , announceInfo, sageNote } from "./sageannounce.js";
import { system } from "@minecraft/server";
import { evolutionScene } from "./sagecore.js";
import { getData, saveNow } from "../core/db.js";
import { say, toast, playSound, countItem, removeItem } from "../core/utils.js";
import { RACES, stageOf, nextStages, raceOf, isLordStage } from "../data/races.js";
import { CLASSES } from "../data/classes.js";
import { applyDerivedStats } from "./stats.js";
import { grantSkill, hasSkill } from "./skills.js";
import { SKILLS } from "../data/skills.js";
import { evoChanges } from "../data/racecard.js";
import { rarityOf } from "../data/skillfmt.js";
import { fx, ring } from "./fx.js";
import { checkAchievements } from "./achievements.js";
import { updateRanking } from "./ranking.js";
import { SOUNDS } from "../config.js";
import { sageSay, sysSay, sageText } from "./voice.js";
import { emit, EV } from "../core/bus.js";
import { applyRaceLook, playTransform } from "./raceparts.js";
import { playCinematic, tierOfStage } from "./cinematic.js";
import { demonStart } from "./realms.js";
import { startLordEvolution, lordEvolving } from "./lordevo.js";

/** Exibe "[Estágio] Nome" acima do jogador. */
export function refreshName(player) {
  try {
    const d = getData(player), r = raceOf(d), st = stageOf(d);
    player.nameTag = `${r.color}[${st.name}] §f${player.name}\n§7Nv.${d.level}${d.class ? " " + CLASSES[d.class].name : ""}`;
  } catch { /* ignore */ }
}

function grantStage(player, stage) { for (const id of stage.skills) grantSkill(player, id); }
const skNames = (ids) => ids.filter((s) => SKILLS[s]).map((s) => `${rarityOf(SKILLS[s]).color}${SKILLS[s].name}`).join("§f, ");
/** o Grande Sábio descreve, no chat, o que muda numa evolução (atributos, traços e habilidades novas) */
function evoReport(ch) {
  const L = [];
  if (ch.attrs.length || ch.stats.length) L.push(` ${[...ch.attrs, ...ch.stats].join(" ")}`);
  if (ch.skills.length) L.push(` §7Novas habilidades: ${skNames(ch.skills)}`);
  return L.length ? `\n${L.join("\n")}` : "";
}

export function chooseRace(player, raceId) {
  const d = getData(player), r = RACES[raceId];
  if (!r || d.raceChosen) return false;
  d.race = raceId; d.raceStage = r.root; d.raceChosen = true;
  grantStage(player, r.stages[r.root]);
  applyDerivedStats(player); refreshName(player); saveNow(player);
  try { applyRaceLook(player, true); } catch { /* ignore */ }
  toast(player, `${r.color}§l${r.name}`, "§7Sua jornada começa agora");
  fx(player.dimension, player.location, "transform", player, 2);
  if (raceId === "dragonoid") say(player, "§6§l[Linhagem] §r§fComo Dragonoide você pode seguir uma linhagem dracônica (Veldora, Velzard, Velgrynd ou Veldanava): Relógio > Raça > Linhagem.");
  sysSay(player, "race", "chosen", { cd: 0 }); sysSay(player, "race", "traits", { cd: 0 });
  const st0 = r.stages[r.root];
  sageText(player, `Renascimento confirmado: ${r.name}.`, { important: true, key: "race.born" });
  sageNote(player, `Análise concluída. Raça registrada: ${r.color}§l${r.name}§r§f.\n §a+ ${r.bonus}\n §c- ${r.penalty}${st0.next?.length ? `\n §7Evoluções possíveis: §f${st0.next.map((x) => r.stages[x]?.name ?? x).join("§7, §f")}` : ""}\n §8Livro do Sábio > RAÇA · EVOLUÇÃO`);
  if (raceId === "demon") { try { demonStart(player); } catch (e) { console.warn(`[Etheria] início no Inferno: ${e}`); } }   // 6.27: Demônio começa no Inferno (só na escolha inicial)
  return true;
}

const notified = new Set();
/** Avisa (uma vez por estágio e sessão) quando uma evolução da raça fica disponível. */
export function notifyEvolution(player) {
  try {
    const d = getData(player); if (!d.raceChosen) return;
    for (const n of nextStages(d)) {
      const key = player.id + n.id; if (notified.has(key) || evolveCheck(player, n)) continue;
      notified.add(key);
      announceInfo(player, "EVOLUÇÃO DISPONÍVEL", n.name, "Relógio > Raça");   // 6.36: na cena da Voz do Mundo
      sageNote(player, `Condições de evolução atendidas: §e${stageOf(d).name} §7» §e${n.name}§f.${evoReport(evoChanges(stageOf(d), n, (s) => hasSkill(d, s)))}\n §8Livro do Sábio > EVOLUÇÃO`);
      fx(player.dimension, player.location, "transform", player, 1);
    }
  } catch { /* ignore */ }
}
export function evolveCheck(player, stage) {
  const d = getData(player);
  if (d.level < stage.minLevel) return `Requer nível ${stage.minLevel}`;
  if (d.coins < stage.cost) return `Requer ${stage.cost} moedas`;
  if (stage.kills && d.kills < stage.kills) return `Requer ${stage.kills} abates (${d.kills})`;
  if (stage.boss && !(d.bossKills[stage.boss] > 0)) return "Requer derrotar o boss do reino";
  if (stage.item && countItem(player, stage.item[0]) < stage.item[1]) return `Requer ${stage.item[1]}x Fragmento de Demonite (${countItem(player, stage.item[0])})`;
  return null;
}
/** Grande Sábio narra a evolução para Lord Demônio (sequência com tempos, como no processamento). */
function lordDemonSage(player) {
  const L = [[0, "Analisando..."], [30, "Requisitos confirmados."], [60, "Processo evolutivo iniciado."], [150, "Evolução concluída."], [190, "§dLord Demônio§b registrado."]];
  for (const [t, m] of L) system.runTimeout(() => { try { sageText(player, `§f${m}`); } catch { /* ignore */ } }, t);
}
export function evolve(player, stageId) {
  const d = getData(player);
  const opts = nextStages(d).filter((s) => s.id === stageId);
  if (opts.length === 0) return { ok: false, msg: "Evolução inválida." };
  const st = opts[0], why = evolveCheck(player, st);
  if (why) { sysSay(player, "raceevo", "fail"); return { ok: false, msg: why }; }
  if (isLordStage(st.id)) return beginLord(player, st);   // 7.x: Lord Demônio = sequência de 1 minuto (systems/lordevo.js)
  const scene = sceneOn(player);   // 6.35: com a cena da Voz do Mundo, sem título/voz/chat antigos
  if (!scene) sysSay(player, "raceevo", "start", { cd: 0 });
  if (st.item && !removeItem(player, st.item[0], st.item[1])) return { ok: false, msg: "Itens insuficientes." };
  const prev = stageOf(d), ch = evoChanges(prev, st, (s) => hasSkill(d, s));
  d.coins -= st.cost; d.raceStage = st.id;
  sageNote(player, `Processo de evolução concluído: §e${prev.name} §7» §e${st.name}§f.${evoReport(ch)}`);
  const kind = isLordStage(st.id) ? "lord" : "evo";
  // cinemática 3ª pessoa: a aparência nova só entra no momento do flash (change); se não rodar, aplica na hora
  const cine = playCinematic(player, { kind, tier: tierOfStage(st, kind), change: () => { try { applyRaceLook(player); } catch { /* ignore */ } } });
  if (!cine) { try { applyRaceLook(player); } catch { /* ignore */ } }
  grantStage(player, st);
  applyDerivedStats(player); refreshName(player);
  checkAchievements(player); updateRanking(player); saveNow(player);
  if (!scene) toast(player, `§d§lEVOLUÇÃO`, `§f${st.name}`);
  playSound(player, SOUNDS.evolve, 1, 1);
  if (!scene) sysSay(player, "raceevo", "done", { cd: 0 });
  try { evolutionScene(player, st); } catch { /* ignore */ }
  ring(player.dimension, player.location, 1.5, "transform", player); fx(player.dimension, player.location, "transform", player, 2);
  if (!cine) playTransform(player, kind);   // sem cinemática: animação de evolução em 3ª pessoa (Lord Demônio tem a sua)
  if (isLordStage(st.id) && !scene) lordDemonSage(player);
  try { emit(EV.PLAYER_EVOLVES, { player, kind: "race", stage: st.id, name: st.name }); } catch { /* ignore */ }   // o Sábio registra e anuncia (sageadapter.js)
  return { ok: true, msg: `Você evoluiu para ${st.name}!` };
}

// ---------------------------------------------------------------- 7.x: LORD DEMÔNIO EM 1 MINUTO
// O pagamento é feito na hora e a evolução fica PENDENTE (d.lordEvo) até o renascimento (50 s). finishLord é idempotente: aplica a
// evolução uma única vez — no renascimento, na interrupção (morte/saída/dimensão) ou ao voltar ao mundo se o jogo caiu no meio.
function beginLord(player, st) {
  const d = getData(player);
  if (d.lordEvo || lordEvolving(player)) return { ok: false, msg: "A evolução para Lord Demônio já está em andamento." };
  if (st.item && !removeItem(player, st.item[0], st.item[1])) return { ok: false, msg: "Itens insuficientes." };
  d.coins -= st.cost; d.lordEvo = { stage: st.id, from: d.raceStage, at: Date.now() }; saveNow(player);
  if (!startLordEvolution(player, { change: () => finishLord(player, st.id) })) finishLord(player, st.id);   // sem sequência: aplica na hora
  return { ok: true, msg: "A evolução para Lord Demônio começou: 1 minuto. Fique parado." };
}
/** conclui a evolução pendente para Lord Demônio (idempotente) */
export function finishLord(player, stageId) {
  let d; try { d = getData(player); } catch { return false; }
  const id = stageId ?? d.lordEvo?.stage;
  if (!id || d.lordEvo?.stage !== id) return false;
  const st = raceOf(d).stages[id]; delete d.lordEvo;
  if (!st) { saveNow(player); return false; }
  const prev = stageOf(d), ch = evoChanges(prev, st, (s) => hasSkill(d, s));
  d.raceStage = st.id;
  sageNote(player, `Evolução concluída: §e${prev.name} §7» §5${st.name}§f.${evoReport(ch)}`);
  try { applyRaceLook(player); } catch { /* ignore */ }
  grantStage(player, st);
  applyDerivedStats(player); refreshName(player);
  checkAchievements(player); updateRanking(player); saveNow(player);
  playSound(player, SOUNDS.evolve, 1, 1);
  if (!sceneOn(player)) { toast(player, "§5§lLORD DEMÔNIO", `§f${st.name}`); lordDemonSage(player); }
  try { evolutionScene(player, st, { skipHarvest: true }); } catch { /* ignore */ }
  try { emit(EV.PLAYER_EVOLVES, { player, kind: "race", stage: st.id, name: st.name }); } catch { /* ignore */ }
  return true;
}
/** jogador voltou com uma evolução pendente (o jogo caiu no meio): conclui */
export function resumeLord(player) { try { const d = getData(player); if (d.lordEvo && !lordEvolving(player)) return finishLord(player, d.lordEvo.stage); } catch { /* ignore */ } return false; }

export function classCheck(player, cls) {
  const d = getData(player);
  if (d.class === cls.id) return "Classe atual";
  return null;   // 8.15: todas as classes liberadas, sem nível nem moedas
}
export function chooseClass(player, id) {
  const d = getData(player), cls = CLASSES[id];
  if (!cls) return { ok: false, msg: "Classe inválida." };
  const why = classCheck(player, cls);
  if (why) return { ok: false, msg: why };
  d.class = id;
  for (const s of cls.skills) grantSkill(player, s);
  applyDerivedStats(player); refreshName(player); saveNow(player);
  toast(player, `§6§l${cls.name}`, "§7Nova classe!");
  fx(player.dimension, player.location, "arcane", player, 2);
  return { ok: true, msg: `Você agora é ${cls.name}!` };
}
export function say2(player, m) { say(player, m); }

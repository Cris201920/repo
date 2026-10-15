// systems/race.js - Raça, classe, evolução/transformação e título no nome
import { sceneOn , announceInfo } from "./sageannounce.js";
import { system } from "@minecraft/server";
import { evolutionScene } from "./sagecore.js";
import { getData, saveNow } from "../core/db.js";
import { say, toast, playSound, countItem, removeItem } from "../core/utils.js";
import { RACES, stageOf, nextStages, raceOf, isLordStage } from "../data/races.js";
import { CLASSES } from "../data/classes.js";
import { applyDerivedStats } from "./stats.js";
import { grantSkill } from "./skills.js";
import { fx, ring } from "./fx.js";
import { checkAchievements } from "./achievements.js";
import { updateRanking } from "./ranking.js";
import { SOUNDS } from "../config.js";
import { sageSay, sysSay } from "./voice.js";
import { emit, EV } from "../core/bus.js";
import { applyRaceLook, playTransform } from "./raceparts.js";
import { playCinematic, tierOfStage } from "./cinematic.js";
import { demonStart } from "./realms.js";

/** Exibe "[Estágio] Nome" acima do jogador. */
export function refreshName(player) {
  try {
    const d = getData(player), r = raceOf(d), st = stageOf(d);
    player.nameTag = `${r.color}[${st.name}] §f${player.name}\n§7Nv.${d.level}${d.class ? " " + CLASSES[d.class].name : ""}`;
  } catch { /* ignore */ }
}

function grantStage(player, stage) { for (const id of stage.skills) grantSkill(player, id); }

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
  for (const [t, m] of L) system.runTimeout(() => { try { say(player, `§5§l[Grande Sábio] §r§f${m}`); } catch { /* ignore */ } }, t);
}
export function evolve(player, stageId) {
  const d = getData(player);
  const opts = nextStages(d).filter((s) => s.id === stageId);
  if (opts.length === 0) return { ok: false, msg: "Evolução inválida." };
  const st = opts[0], why = evolveCheck(player, st);
  if (why) { sysSay(player, "raceevo", "fail"); return { ok: false, msg: why }; }
  const scene = sceneOn(player);   // 6.35: com a cena da Voz do Mundo, sem título/voz/chat antigos
  if (!scene) sysSay(player, "raceevo", "start", { cd: 0 });
  if (st.item && !removeItem(player, st.item[0], st.item[1])) return { ok: false, msg: "Itens insuficientes." };
  d.coins -= st.cost; d.raceStage = st.id;
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

export function classCheck(player, cls) {
  const d = getData(player);
  if (d.class === cls.id) return "Classe atual";
  if (d.level < cls.minLevel) return `Requer nível ${cls.minLevel}`;
  const cost = d.class ? cls.cost + d.level * 50 : cls.cost;
  if (d.coins < cost) return `Requer ${cost} moedas`;
  return null;
}
export function chooseClass(player, id) {
  const d = getData(player), cls = CLASSES[id];
  if (!cls) return { ok: false, msg: "Classe inválida." };
  const why = classCheck(player, cls);
  if (why) return { ok: false, msg: why };
  d.coins -= d.class ? cls.cost + d.level * 50 : cls.cost;
  d.class = id;
  for (const s of cls.skills) grantSkill(player, s);
  applyDerivedStats(player); refreshName(player); saveNow(player);
  toast(player, `§6§l${cls.name}`, "§7Nova classe!");
  fx(player.dimension, player.location, "arcane", player, 2);
  return { ok: true, msg: `Você agora é ${cls.name}!` };
}
export function say2(player, m) { say(player, m); }

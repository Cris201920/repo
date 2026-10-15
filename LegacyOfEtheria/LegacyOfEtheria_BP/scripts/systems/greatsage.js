// systems/greatsage.js - FACHADA do Grande Sábio: ponto único de entrada (GreatSage.initialize/load/save/analyze/evolve/process/destroy/test).
// Cada método delega ao módulo que realmente faz o trabalho (nada é duplicado aqui):
//   sage.js (análise, menus, evolução) · sagesave.js (persistência versionada) · sageproc.js (processamento paralelo e fila de prioridade)
//   sageevo.js (EvolutionManager) · sagecombat.js (CombatManager) · sagetarget.js / sageassess.js (alvo e Modo Assess)
//   sageadapter.js (eventos) · sagedebug.js (debug e métricas) · sagetests.js (testes automáticos)
// Modos de interface (opção "Interface" nas configurações): Discreta = HIDDEN · Normal = COMPACT · Completa = FULL.
import { system, world } from "@minecraft/server";
import { getData } from "../core/db.js";
import { say } from "../core/utils.js";
import { on, off, emit, EV } from "../core/bus.js";
import { GreatSageLogger as Log } from "../core/logger.js";
import { addHudLine } from "./hudhooks.js";
import { sageCfg, sageStage, sageSay, dropVoice, sageText } from "./voice.js";
import { addExp, remember } from "./sageknow.js";
import { analyze, startEvolution, spellLines } from "./sage.js";
import { startSageSave, saveGreatSageState, loadGreatSageState } from "./sagesave.js";
import { startSageCombat } from "./sagecombat.js";
import { startSageTarget, detectTarget, lockTarget, releaseTarget, isLocked } from "./sagetarget.js";
import { startSageAssess, assessToggle } from "./sageassess.js";
import { startSageAdapter, dropAdapter } from "./sageadapter.js";
import { startSageDebug, dropDebug } from "./sagedebug.js";
import { EvolutionManager } from "./sageevo.js";
import { processNow, queueTask, procResult, dropProc } from "./sageproc.js";
import { coreOn, dropCore } from "./sagecore.js";
import { runSelfTests, reportSelfTests, setTestHooks } from "./sagetests.js";
import { dropSage } from "./sage.js";
import { markDirty } from "../core/db.js";

export const SAGE_STATE = Object.freeze({ SAGE: 1, GREAT_SAGE: 2, RAPHAEL: 3, CIEL: 4 });
export const UI_MODE = Object.freeze({ HIDDEN: "discreet", COMPACT: "normal", FULL: "full" });
export const GreatSageEvents = Object.freeze({ emit, on, off });

// ---- funções reutilizáveis (nomes do guia de código limpo)
/** Toca o estado visual do núcleo (IDLE, ANALYZING, PROCESSING, EVOLVING...). */
export const playGreatSageAnimation = (player, state = "IDLE", opts = {}) => coreOn(player, state, opts);
/** Fala do Sábio com o estágio, a recarga e a fila da voz. */
export const playGreatSageVoice = (player, key, opts = {}) => sageSay(player, key, opts);
/** Inicia a análise de um alvo (o fim é anunciado pelo evento analysis_finished). */
export const startAnalysis = (player, target, opts = {}) => analyze(player, target, opts);
export { saveGreatSageState, loadGreatSageState, queueTask };
/** Emite um evento do Sábio no barramento. */
export const emitGreatSageEvent = (name, data = {}) => emit(name, data);

// ---- magia aprendida: o Sábio detecta, registra na memória e analisa (uma vez por magia)
function onMagicLearned({ player, id, sk }) {
  if (sageStage(getData(player)) < 1 || !sk) return;
  const sg = sageCfg(getData(player)); sg.obs ??= {}; const key = "sp." + id;
  if ((sg.obs[key] ?? 0) >= 2) return;
  sg.obs[key] = 2; sg.analyses = (sg.analyses ?? 0) + 1; addExp(player, 4); remember(player, "magic", `Magia analisada: ${sk.name}`); markDirty(player);
  sageSay(player, "sp_done", { cd: 600 });
  sageText(player, `§fMagia detectada: §d${sk.name}§f.\n${spellLines(player, id, player).join("\n")}\n§bANÁLISE CONCLUÍDA.`);
}

let ready = false;
/** Estado em memória de UM jogador (não apaga nenhum dado salvo). */
function destroyPlayerState(p) { const id = p.id; dropSage(id); dropCore(id); dropVoice(id); dropAdapter(id); dropDebug(id); }

export const GreatSage = {
  /** Liga todos os módulos (idempotente). Falha de um módulo é registrada e não derruba os outros. */
  initialize() {
    if (ready) return true;
    for (const [nome, fn] of [["save", startSageSave], ["combate", startSageCombat], ["alvo", startSageTarget], ["assess", startSageAssess], ["adaptador", startSageAdapter], ["debug", startSageDebug]]) Log.guard(nome, fn);
    Log.guard("magia", () => on(EV.SAGE_MAGIC_LEARNED, onMagicLearned));
    Log.guard("interface", () => addHudLine((p) => { const sg = sageCfg(getData(p)); return sg.ui === "full" && !sg.debug ? `§8◈ §7${Object.values(procResult(p))[0] ?? ""}`.slice(0, 60) : ""; }));
    Log.guard("scriptevent", () => system.afterEvents.scriptEventReceive.subscribe((ev) => {
      if (ev.id !== "etheria:sagetest") return; const p = ev.sourceEntity; if (p?.typeId === "minecraft:player") reportSelfTests(p);
    }));
    setTestHooks({ destroyPlayerState });
    ready = true; Log.info("Grande Sábio inicializado", "Sábio"); return true;
  },
  isReady: () => ready,
  load: (player) => loadGreatSageState(player),
  save: (player) => saveGreatSageState(player),
  /** Analisa `target` (ou o alvo da mira). */
  analyze: (player, target, opts = {}) => analyze(player, target ?? detectTarget(player), opts),
  /** Verifica (com cache) e, se possível, inicia a próxima evolução do Sábio. Nunca evolui sem os requisitos. */
  evolve(player, to) {
    const ev = EvolutionManager.check(player, true);
    if (!ev.available) return { ok: false, evolution: ev.evolution, missing: ev.missing };
    startEvolution(player, to ?? ev.target); return { ok: true, evolution: ev.evolution, missing: [] };
  },
  /** Executa agora todas as tarefas do processamento paralelo e devolve os resultados. */
  process: (player) => processNow(player),
  lockTarget, releaseTarget, isLocked, assess: assessToggle,
  check: (player) => EvolutionManager.check(player),
  /** Libera o estado em memória de um jogador (ou de todos, sem argumento). Os dados salvos nunca são apagados. */
  destroy(player) { if (player) { destroyPlayerState(player); return; } for (const p of world.getAllPlayers()) destroyPlayerState(p); },
  /** Bateria de testes automáticos (ver sagetests.js). */
  test: (player) => runSelfTests(player),
};

// systems/sagedebug.js - MODO DEBUG e MÉTRICAS do Grande Sábio.
// Nada disto aparece no modo normal: o painel só existe para quem liga "Modo debug" nas configurações do Sábio
// (ou /scriptevent etheria:sagedebug on). Campos exigidos: Great Sage State, Current Animation, Current Queue, Processing Tasks, Current Target,
// Analysis Level, Voice Event, Particle Event, Evolution Status, Memory Status, Performance.
// Métricas: scanTime, analysisTime, queueSize, activeParticles, activeAnimations, memoryEntries, voiceQueue, tickCost.
// Comandos (chat do jogador que enviou):  /scriptevent etheria:sagedebug on | off | report | log [erro|aviso] | reset
import { world, system } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { say } from "../core/utils.js";
import { addHudLine } from "./hudhooks.js";
import { sageCfg, sageStage, voiceInfo } from "./voice.js";
import { kcount, learnBonus, stageName } from "./sageknow.js";
import { lockInfo } from "./sagetarget.js";
import { assessState, assessActive } from "./sageassess.js";
import { EvolutionManager } from "./sageevo.js";
import { procInfo, TASKS } from "./sageproc.js";
import { coreInfo } from "./sagecore.js";
import { circleActive } from "./sagecircle.js";
import { fxStats, lvl } from "./fxlib.js";
import { metricsSnapshot } from "../core/metrics.js";
import { busStats } from "../core/bus.js";
import { GreatSageLogger as Log } from "../core/logger.js";

export const STAGE_KEY = Object.freeze(["SAGE", "SAGE", "GREAT_SAGE", "RAPHAEL", "CIEL"]);
const OVERLAY_TTL = 10, DEBUG_SYNC = 100;
export const isDebug = (p) => { try { return !!sageCfg(getData(p)).debug; } catch { return false; } };

/** As 8 métricas de desempenho exigidas (valores ao vivo; o custo de CPU tem resolução de 1 ms, por isso o pico importa mais que a média). */
export function sageMetrics(p) {
  const m = metricsSnapshot(), fx = fxStats(), vi = voiceInfo(p), ci = coreInfo(p), pi = procInfo(p), d = getData(p), sg = sageCfg(d);
  return {
    scanTime: +m.scanMs.toFixed(2),                                    // ms da última varredura (média móvel)
    analysisTime: m.analysisTicks,                                     // ticks da última análise concluída
    queueSize: pi.queued,                                              // tarefas vencidas esperando a vez
    activeParticles: fx.perTick,                                       // partículas emitidas no tick atual (limitadas pelo orçamento do nível de efeitos)
    activeAnimations: ci.layers + (circleActive(p) ? 1 : 0) + (assessActive(p) ? 1 : 0),
    memoryEntries: kcount(d) + (sg.mem?.length ?? 0),
    voiceQueue: vi.queue + (vi.current ? 1 : 0),
    tickCost: +m.tickAvg.toFixed(2),                                   // ms por tick gastos pelo Sábio (média móvel)
  };
}

/** Os 11 campos do modo debug, em dados (o relatório e o painel só formatam). */
export function debugFields(p) {
  const d = getData(p), sg = sageCfg(d), st = sageStage(d), vi = voiceInfo(p), ci = coreInfo(p), pi = procInfo(p), lk = lockInfo(p), ev = EvolutionManager.check(p), lb = learnBonus(d), fx = fxStats(), m = metricsSnapshot(), now = system.currentTick;
  return {
    greatSageState: { key: STAGE_KEY[st] ?? "SAGE", name: stageName(st), assess: assessState(p) },
    currentAnimation: { state: ci.state, layers: ci.layers, circle: circleActive(p) },
    currentQueue: { tasks: pi.queued, voice: vi.queue, speaking: vi.current },
    processingTasks: { ran: pi.ran, total: TASKS.length, lastAt: pi.lastAt, results: pi.results },
    currentTarget: lk ? { name: lk.name, pct: Math.round(lk.pct * 100), dist: Math.round(lk.dist), out: lk.out } : null,
    analysisLevel: { analyses: sg.analyses ?? 0, tier: lb.got.length, range: lb.range, speed: lb.speed },
    voiceEvent: { last: vi.last, ago: vi.lastAt ? now - vi.lastAt : null },
    particleEvent: { perTick: fx.perTick, peak: fx.peak, total: fx.total, level: lvl(p) },
    evolutionStatus: { target: ev.evolution, available: ev.available, missing: ev.missing.length, cached: ev.cached, race: ev.race.available },
    memoryStatus: { entries: kcount(d), memory: sg.mem?.length ?? 0, version: sg.sv ?? 0 },
    performance: { ...sageMetrics(p), tickPeak: +m.tickPeak.toFixed(2), scanMax: +m.scanMax.toFixed(2), queuePeak: m.queuePeak },
  };
}

const ago = (t) => (t === null || t === undefined ? "—" : `${(t / 20).toFixed(1)}s atrás`);
/** Relatório completo (várias linhas) para o chat. */
export function debugReport(p) {
  const f = debugFields(p), pf = f.performance, L = [];
  L.push("§8§l[DEBUG DO GRANDE SÁBIO]");
  L.push(`§7Estado do Grande Sábio: §f${f.greatSageState.key} §8(${f.greatSageState.name}) §7· Modo Assess: §f${f.greatSageState.assess}`);
  L.push(`§7Animação atual: §f${f.currentAnimation.state ?? "nenhuma"} §7· camadas: §f${f.currentAnimation.layers}§7 · círculo: §f${f.currentAnimation.circle ? "sim" : "não"}`);
  L.push(`§7Fila atual: §f${f.currentQueue.tasks}§7 tarefa(s) · voz: §f${f.currentQueue.voice}§7 na fila · falando: §f${f.currentQueue.speaking ?? "—"}`);
  const res = Object.entries(f.processingTasks.results).slice(0, 4).map(([k, v]) => `${k}=${String(v).slice(0, 28)}`).join("; ");
  L.push(`§7Tarefas em processamento: §f${f.processingTasks.ran}§7/${f.processingTasks.total} na última passada · §8${res || "sem resultados"}`);
  L.push(`§7Alvo atual: §f${f.currentTarget ? `${f.currentTarget.name} ${f.currentTarget.pct}% a ${f.currentTarget.dist}m${f.currentTarget.out ? " (fora de alcance)" : ""}` : "nenhum"}`);
  L.push(`§7Nível de análise: §f${f.analysisLevel.analyses}§7 análises · benefícios: §f${f.analysisLevel.tier}§7 · alcance §f${f.analysisLevel.range}§7 · velocidade §fx${f.analysisLevel.speed}`);
  L.push(`§7Evento de voz: §f${f.voiceEvent.last ?? "nenhum"} §8(${ago(f.voiceEvent.ago)})`);
  L.push(`§7Evento de partículas: §f${f.particleEvent.perTick}§7/tick · pico §f${f.particleEvent.peak}§7 · total §f${f.particleEvent.total}§7 · nível §f${f.particleEvent.level}`);
  L.push(`§7Status da evolução: §f${f.evolutionStatus.target ? `${f.evolutionStatus.target}: ${f.evolutionStatus.available ? "DISPONÍVEL" : `faltam ${f.evolutionStatus.missing}`}` : "estágio máximo"} §8(${f.evolutionStatus.cached ? "cache" : "calculado"})`);
  L.push(`§7Status da memória: §f${f.memoryStatus.entries}§7 registros · §f${f.memoryStatus.memory}§7 fatos · formato v§f${f.memoryStatus.version}`);
  L.push(`§7Desempenho: §fscan ${pf.scanTime}ms§7 (máx ${pf.scanMax}) · análise §f${pf.analysisTime}t§7 · fila §f${pf.queueSize}§7 · partículas §f${pf.activeParticles}§7 · animações §f${pf.activeAnimations}§7 · memória §f${pf.memoryEntries}§7 · voz §f${pf.voiceQueue}§7 · custo §f${pf.tickCost}ms§7 (pico ${pf.tickPeak}ms)`);
  const lg = Log.stats(), bs = busStats();
  L.push(`§8Registro: ${lg.ERROR} erro(s) · ${lg.WARNING} aviso(s) · ${lg.suppressed} repetição(ões) omitida(s) · eventos com erro: ${bs.handlerErrors}`);
  return L;
}

// ---------------------------------------------------------------- painel na HUD (só com debug ligado)
const overlayCache = new Map();   // playerId -> { at, text }
/** Linhas compactas do painel (3 linhas curtas). Vazio quando o debug está desligado: o modo normal nunca mostra nada. */
export function debugOverlay(p, now = system.currentTick) {
  if (!isDebug(p)) { overlayCache.delete(p.id); return ""; }
  const c = overlayCache.get(p.id); if (c && now - c.at < OVERLAY_TTL) return c.text;
  const f = debugFields(p), pf = f.performance, tg = f.currentTarget;
  const text = [
    `§8[DEBUG] §7${f.greatSageState.key} §8| §7anim §f${f.currentAnimation.state ?? "-"} §8| §7fila §f${f.currentQueue.tasks}/${f.currentQueue.voice} §8| §7tarefas §f${f.processingTasks.ran}/${f.processingTasks.total}`,
    `§7alvo §f${tg ? `${tg.name.slice(0, 12)} ${tg.pct}%` : "-"} §8| §7análise §f${f.analysisLevel.analyses} §8| §7voz §f${f.voiceEvent.last ?? "-"} §8| §7part §f${f.particleEvent.perTick}/t`,
    `§7evo §f${f.evolutionStatus.target ? (f.evolutionStatus.available ? "pronta" : `-${f.evolutionStatus.missing}`) : "máx"} §8| §7mem §f${f.memoryStatus.entries} §8| §7custo §f${pf.tickCost}ms §8(pico ${pf.tickPeak}) §8| §7scan §f${pf.scanTime}ms`,
  ].join("\n");
  overlayCache.set(p.id, { at: now, text }); return text;
}
export const dropDebug = (id) => { overlayCache.delete(id); };

// ---------------------------------------------------------------- comandos
/** Liga/desliga o debug do jogador e sincroniza o nível de log do console (global: ligado se ALGUM jogador estiver em debug). */
export function setDebug(p, on) {
  const sg = sageCfg(getData(p)); sg.debug = !!on; markDirty(p); syncLogLevel();
  say(p, `§8[Debug do Sábio] ${on ? "§aligado" : "§cdesligado"}§8.`); return sg.debug;
}
export function syncLogLevel() { let any = false; try { for (const p of world.getAllPlayers()) if (isDebug(p)) { any = true; break; } } catch { /* ignore */ } Log.setDebug(any); return any; }

/** Executa um comando de texto do debug. Retorna true se entendeu. */
export function handleDebugCommand(p, text) {
  const [cmd = "", arg = ""] = String(text ?? "").trim().toLowerCase().split(/\s+/);
  switch (cmd) {
    case "on": case "ligar": setDebug(p, true); return true;
    case "off": case "desligar": setDebug(p, false); return true;
    case "toggle": setDebug(p, !isDebug(p)); return true;
    case "": case "report": case "relatorio": case "relatório": for (const l of debugReport(p)) say(p, l); return true;
    case "log": {
      const lvl2 = { erro: "ERROR", error: "ERROR", aviso: "WARNING", warning: "WARNING", info: "INFO", debug: "DEBUG" }[arg];
      const rows = Log.recent(8, lvl2); say(p, `§8[Registro do Sábio] ${rows.length ? `últimas ${rows.length} entrada(s)` : "vazio"}`);
      for (const r of rows) say(p, `§8${r.level} §7${r.line.replace(/§./g, "").slice(0, 110)}`);
      return true;
    }
    case "reset": Log.reset(); say(p, "§8[Registro do Sábio] limpo."); return true;
    default: return false;
  }
}

let started = false;
export function startSageDebug() {
  if (started) return; started = true;
  addHudLine((p) => debugOverlay(p));
  system.runInterval(() => { try { syncLogLevel(); } catch { /* ignore */ } }, DEBUG_SYNC);
  try {
    system.afterEvents.scriptEventReceive.subscribe((ev) => {
      if (ev.id !== "etheria:sagedebug") return;
      const p = ev.sourceEntity; if (!p || p.typeId !== "minecraft:player") return;
      try { if (!handleDebugCommand(p, ev.message)) say(p, "§7[Debug do Sábio] Use: on · off · report · log [erro|aviso] · reset"); } catch (e) { Log.error(`comando de debug: ${e}`, "Debug"); }
    });
  } catch (e) { Log.warning(`scriptevent indisponível: ${e}`, "Debug"); }
}

// core/metrics.js - Métricas de desempenho do Grande Sábio (módulo-folha: não importa nada do addon).
//   scanTime        tempo da última varredura/tarefa do processamento paralelo (ms)
//   analysisTime    duração da última análise concluída (ticks) e custo de CPU dela (ms)
//   tickCost        custo médio e pico, em ms, de tudo que o Sábio executa em um tick
//   queueSize       tarefas vencidas que esperaram a vez (o laço executa no máximo 3 por passada)
// As demais métricas (activeParticles, activeAnimations, memoryEntries, voiceQueue) são lidas ao vivo pelo sagedebug.js.
// Custo: dois Date.now() por trecho medido; a resolução é de 1 ms, então o valor médio é aproximado e o pico é o que importa.
import { system } from "@minecraft/server";

const EMA = 0.1;     // peso da média móvel exponencial
const M = { scanMs: 0, scanMax: 0, scanN: 0, analysisTicks: 0, analysisMs: 0, analysisN: 0, tickAvg: 0, tickPeak: 0, queue: 0, queuePeak: 0 };
let curTick = -1, acc = 0;

function closeTick() {
  M.tickAvg += (acc - M.tickAvg) * EMA;
  M.tickPeak = Math.max(M.tickPeak * 0.995, acc);   // o pico decai devagar, para refletir o uso recente
}
/** Soma `ms` ao custo do tick `tick` (fecha o tick anterior quando o tick muda). */
function addCost(ms, tick) {
  if (tick !== curTick) { if (curTick >= 0) closeTick(); curTick = tick; acc = 0; }
  acc += ms;
}

/** Executa `fn`, soma o tempo ao custo do tick e devolve o resultado. Se `kind` for "scan", também alimenta scanTime. Erros sobem normalmente. */
export function measure(kind, fn) {
  const t0 = Date.now();
  try { return fn(); }
  finally {
    const ms = Date.now() - t0;
    addCost(ms, system.currentTick);
    if (kind === "scan") { M.scanMs += (ms - M.scanMs) * 0.3; M.scanMax = Math.max(M.scanMax * 0.99, ms); M.scanN++; }
  }
}
/** Registra uma análise concluída. */
export function noteAnalysis(ticks, ms = 0) { M.analysisTicks = ticks; M.analysisMs = ms; M.analysisN++; }
/** Registra o tamanho da fila de tarefas (vencidas e adiadas). */
export function noteQueue(n) { M.queue = n; if (n > M.queuePeak) M.queuePeak = n; }

export const metricsSnapshot = () => ({ ...M, tickNow: curTick === system.currentTick ? acc : 0 });
export function metricsReset() { for (const k of Object.keys(M)) M[k] = 0; curTick = -1; acc = 0; }

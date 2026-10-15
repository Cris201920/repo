// core/logger.js - GreatSageLogger: registro por níveis (DEBUG / INFO / WARNING / ERROR) SEM spam de console.
//  · WARNING e ERROR vão para o console; INFO e DEBUG só aparecem no console quando o modo debug do Sábio está ligado.
//  · A mesma mensagem repetida dentro da janela SAME_WINDOW é só contada; quando passar a janela ela aparece uma vez com "(xN)".
//  · Um anel guarda as últimas entradas (o modo DEBUG lê daqui) e as contagens por nível ficam disponíveis em stats().
import { system } from "@minecraft/server";

export const LOG = Object.freeze({ DEBUG: "DEBUG", INFO: "INFO", WARNING: "WARNING", ERROR: "ERROR" });
const RING_MAX = 60;          // entradas guardadas para o painel de debug
const SAME_WINDOW = 400;      // ticks (20 s) em que a mesma mensagem não se repete no console
const MAX_KEYS = 120;         // quantas mensagens distintas são lembradas para a deduplicação

let debugOn = false, suppressed = 0;
const ring = [];
const seen = new Map();       // "NÍVEL|tag|texto" -> { at, rep }
const counts = { DEBUG: 0, INFO: 0, WARNING: 0, ERROR: 0 };

function write(level, tag, msg) {
  counts[level]++;
  const text = typeof msg === "string" ? msg : String(msg);
  const now = system.currentTick, key = `${level}|${tag}|${text}`, rec = seen.get(key);
  if (rec && now - rec.at < SAME_WINDOW) { rec.rep++; suppressed++; return false; }
  const rep = rec?.rep ?? 0;
  if (seen.size >= MAX_KEYS) seen.delete(seen.keys().next().value);
  seen.set(key, { at: now, rep: 0 });
  const line = `[Etheria${tag ? "/" + tag : ""}] ${text}${rep ? ` (x${rep + 1})` : ""}`;
  ring.push({ t: now, level, line }); if (ring.length > RING_MAX) ring.shift();
  try {
    if (level === LOG.ERROR || level === LOG.WARNING) console.warn(line);
    else if (debugOn) console.log(line);
  } catch { /* o console nunca pode derrubar o addon */ }
  return true;
}

export const GreatSageLogger = {
  debug(msg, tag = "Sábio") { return write(LOG.DEBUG, tag, msg); },
  info(msg, tag = "Sábio") { return write(LOG.INFO, tag, msg); },
  warning(msg, tag = "Sábio") { return write(LOG.WARNING, tag, msg); },
  error(msg, tag = "Sábio") { return write(LOG.ERROR, tag, msg); },
  /** Executa fn; qualquer erro vira um ERROR registrado e devolve `fallback` (o Sábio nunca derruba o addon). */
  guard(tag, fn, fallback) { try { return fn(); } catch (e) { write(LOG.ERROR, tag, `${e}`); return fallback; } },
  setDebug(on) { debugOn = !!on; },
  isDebug() { return debugOn; },
  /** Últimas entradas (mais novas por último). level opcional filtra por nível. */
  recent(n = 8, level) { const l = level ? ring.filter((x) => x.level === level) : ring; return l.slice(-n); },
  stats() { return { ...counts, suppressed, kept: ring.length }; },
  reset() { ring.length = 0; seen.clear(); suppressed = 0; for (const k of Object.keys(counts)) counts[k] = 0; },
};

// systems/sagetips.js - Dicas contextuais do Sábio (TipManager): PRIORIDADE, recarga por tipo de evento, silêncio entre falas e aviso crítico.
// O Sábio observa o mundo, mas NÃO fala o tempo todo:
//  · tipPriority   CRÍTICO > ALTO > NORMAL > BAIXO (morte iminente / evolução disponível = crítico; minério, mob, ambiente = normal)
//  · tipCooldown   recarga POR TIPO de evento (ex.: "minério" 600 ticks); o mesmo evento repetido recua progressivamente (até 8x)
//  · tipQuietTicks silêncio mínimo entre duas dicas; a frequência escolhida pelo jogador (rara / normal / frequente) escala recarga e silêncio
//  · criticalWarning ignora a recarga comum e o silêncio (mas nunca repete a mesma chave em menos de 2 s)
// O porteiro `tipGate` só decide; quem fala (voz, núcleo, barra de ação) continua sendo o sageproc.
import { system } from "@minecraft/server";
import { getData } from "../core/db.js";
import { sageCfg } from "./voice.js";

export const TIP_PRI = Object.freeze({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 });
export const TIP_PRI_NAME = Object.freeze(["CRÍTICO", "ALTO", "NORMAL", "BAIXO"]);
/** tipCooldown por TIPO de evento, em ticks (20 = 1 s). O valor passado por quem chama tem precedência. */
export const TIP_COOLDOWN = Object.freeze({ lowhp: 1200, hp: 900, mana: 1500, eff: 1500, superior: 3000, ambush: 1800, bighit: 900, durability: 1800, ore: 600, enemy: 600, evo: 12000, env: 1200, item: 900, info: 2400, defend: 900, weapon: 1500, res: 9000, cmb: 24000, awk: 24000, lava: 1200 });
/** Prioridade padrão por tipo (o que não está aqui é NORMAL). */
export const TIP_PRI_OF = Object.freeze({ lowhp: 0, evo: 0, superior: 1, ambush: 1, bighit: 1, hp: 1, durability: 1, eff: 2, mana: 2, ore: 2, enemy: 2, info: 3 });
/** Frequência dos avisos (configuração do jogador): multiplica a recarga e define o silêncio base entre dicas (ticks). */
export const TIP_FREQ = Object.freeze({ low: { mult: 2, quiet: 240, label: "Rara" }, normal: { mult: 1, quiet: 100, label: "Normal" }, high: { mult: 0.5, quiet: 50, label: "Frequente" } });
export const TIP_FREQ_ORDER = Object.freeze(["low", "normal", "high"]);
const CRITICAL_MIN_REPEAT = 40;   // ticks: nem o aviso crítico repete a mesma chave em menos de 2 s
const AFTER_CRITICAL = 60;        // ticks: depois de um aviso crítico as dicas comuns esperam 3 s
const BACKOFF_MAX = 8, RECENT_MAX = 16;

const state = new Map();          // playerId -> { lastTip, lastCrit, keys: Map(chave -> {at, mult}), recent: [] }
const S = (p) => { let s = state.get(p.id); if (!s) { s = { lastTip: -9999, lastCrit: -9999, keys: new Map(), recent: [], gated: 0, passed: 0 }; state.set(p.id, s); } return s; };
export const dropTips = (id) => state.delete(id);
export const typeOfKey = (key) => String(key).replace(/^(al|sg)\./, "").split(".")[0];
export const priorityOf = (key) => TIP_PRI_OF[typeOfKey(key)] ?? TIP_PRI.NORMAL;

/**
 * Porteiro de dicas. Devolve:
 *   0 = bloqueada (ainda em recarga)         -> não registra nem fala
 *   1 = pode REGISTRAR, mas não anunciar     -> silêncio entre dicas, dicas desligadas
 *   2 = pode ANUNCIAR                         -> a recarga é consumida agora
 */
export function tipGate(p, key, pri = TIP_PRI.NORMAL, cooldown) {
  const sg = sageCfg(getData(p)), s = S(p), now = system.currentTick, f = TIP_FREQ[sg.tipFreq] ?? TIP_FREQ.normal, rec = s.keys.get(key);
  if (pri <= TIP_PRI.CRITICAL) {                                               // aviso crítico: ignora recarga e silêncio
    if (rec && now - rec.at < CRITICAL_MIN_REPEAT) { s.gated++; return 0; }
    mark(s, key, now, 1, pri); s.lastCrit = now; s.passed++; return 2;
  }
  const base = cooldown ?? TIP_COOLDOWN[typeOfKey(key)] ?? 1200, cd = Math.round(base * f.mult * (rec?.mult ?? 1));
  if (rec && now - rec.at < cd) { s.gated++; return 0; }
  if (sg.tips === false || (sg.ui === "discreet" && pri >= TIP_PRI.NORMAL)) return 1;   // dicas desligadas ou interface discreta: só registra (críticas e altas continuam)
  const quiet = pri === TIP_PRI.HIGH ? Math.round(f.quiet / 2) : pri >= TIP_PRI.LOW ? Math.round(f.quiet * 1.5) : f.quiet;
  if (now - s.lastTip < quiet || now - s.lastCrit < AFTER_CRITICAL) { s.gated++; return 1; }
  const mult = rec && now - rec.at < cd * 3 ? Math.min(BACKOFF_MAX, rec.mult * 2) : 1;   // repetiu logo depois: recua mais
  mark(s, key, now, mult, pri); s.passed++; return 2;
}
function mark(s, key, now, mult, pri) {
  if (s.keys.size > 80) s.keys.delete(s.keys.keys().next().value);
  s.keys.set(key, { at: now, mult }); s.lastTip = now;
  s.recent.push({ key, pri, at: now }); if (s.recent.length > RECENT_MAX) s.recent.shift();
}
/** Memória de eventos recentes (últimas dicas anunciadas) e contagem do porteiro, para o modo debug. */
export function tipStats(p) { const s = S(p); return { recent: s.recent.slice(-5), gated: s.gated, passed: s.passed, lastTip: s.lastTip }; }
/** Esquece o recuo de um tipo (ex.: o jogador pediu para repetir). */
export function tipForget(p, key) { S(p).keys.delete(key); }

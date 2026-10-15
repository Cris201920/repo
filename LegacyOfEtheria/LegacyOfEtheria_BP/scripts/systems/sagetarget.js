// systems/sagetarget.js - SISTEMA DE ALVO do Sábio: detecção (target detection), trava (target lock) e liberação (target release).
//  · detecção  : a entidade analisável na mira (dentro do alcance de análise do estágio)
//  · trava     : fixa o alvo e mostra a análise; enquanto travado, uma linha da HUD acompanha vida, estado e distância
//  · atualiza  : alvo fora do alcance -> "fora de alcance" com tolerância de 4 s (histerese) antes de soltar
//  · finaliza  : alvo morreu/sumiu/mudou de dimensão -> análise encerrada e trava liberada
// Um único laço de 10 ticks trata todos os jogadores com alvo; sem alvo travado o custo é zero.
import { system, world } from "@minecraft/server";
import { getData } from "../core/db.js";
import { isValid, healthComp, say } from "../core/utils.js";
import { MOBS } from "../data/mobs.gen.js";
import { BOSSES } from "../data/bosses.js";
import { sageStage } from "./voice.js";
import { learnBonus } from "./sageknow.js";
import { runAnalyzer } from "./sageproc.js";
import { addHudLine } from "./hudhooks.js";
import { emit, EV } from "../core/bus.js";
import { GreatSageLogger as Log } from "../core/logger.js";

export const LOCK_RANGE_EXTRA = 8;    // blocos além do alcance de análise em que a trava ainda se mantém (histerese)
export const OUT_OF_RANGE_GRACE = 80; // ticks fora de alcance antes de soltar (4 s)
const LOOP_TICKS = 10;
export const RELEASE_REASON = Object.freeze({ MANUAL: "manual", DEAD: "dead", GONE: "gone", RANGE: "range", DIMENSION: "dimension", SWITCH: "switch", LEAVE: "leave" });

const locks = new Map();              // playerId -> { p, e, name, since, outSince, pct, dist }
const pretty = (id) => id.split(":").pop().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const sayS = (p, t) => { try { say(p, `§b[Sábio] §f${t}`); } catch { /* ignore */ } };
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function targetName(e) {
  const m = MOBS[e.typeId]; if (m?.name) return m.name;
  const b = Object.values(BOSSES).find((x) => x.type === e.typeId); if (b?.name) return b.name;
  return e.nameTag || pretty(e.typeId);
}
/** Só seres vivos com vida são analisáveis (itens, orbes e entidades de efeito ficam de fora). */
export function analyzable(e) {
  try { return !!e && isValid(e) && e.typeId !== "minecraft:player" && !e.typeId.includes("sage_circle") && !!healthComp(e); } catch { return false; }
}
export const rangeOf = (p) => learnBonus(getData(p)).range;

/** target detection: a entidade analisável mais próxima na mira, dentro do alcance. */
export function detectTarget(p, range = rangeOf(p)) {
  try { for (const h of p.getEntitiesFromViewDirection({ maxDistance: range })) if (analyzable(h.entity)) return h.entity; } catch { /* ignore */ }
  return undefined;
}
export const targetOf = (p) => { const L = locks.get(p.id); return L && isValid(L.e) ? L.e : undefined; };
export const isLocked = (p) => locks.has(p.id);
export const lockInfo = (p) => { const L = locks.get(p.id); return L ? { name: L.name, pct: L.pct, dist: L.dist, out: !!L.outSince, since: L.since } : null; };

/** target lock: fixa `e` (ou o alvo da mira) e mostra a análise. Retorna true se travou. */
export function lockTarget(p, e = detectTarget(p), opts = {}) {
  if (!e || !analyzable(e)) { if (!opts.silent) sayS(p, "Nenhum alvo analisável na mira."); return false; }
  if (sageStage(getData(p)) < 1 && !opts.force) { if (!opts.silent) sayS(p, "A trava de alvo exige o estágio Sábio (nível 15 ou 5 análises)."); return false; }
  const cur = locks.get(p.id);
  if (cur?.e === e) return true;
  if (cur) releaseTarget(p, RELEASE_REASON.SWITCH, true);
  const now = system.currentTick, h = healthComp(e);
  locks.set(p.id, { p, e, eid: e.id, name: targetName(e), since: now, outSince: 0, pct: h ? h.currentValue / h.effectiveMax : 1, dist: dist3(e.location, p.location), dim: p.dimension.id });
  Log.debug(`alvo travado: ${e.typeId}`, "Alvo");
  try { emit(EV.SAGE_TARGET_LOCKED, { player: p, target: e }); } catch { /* ignore */ }
  if (!opts.noAnalysis) { try { runAnalyzer(p, e, {}); } catch (err) { Log.error(`análise ao travar: ${err}`, "Alvo"); } }
  return true;
}

/** target release: solta a trava. `quiet` não envia mensagem. Retorna true se havia trava. */
export function releaseTarget(p, reason = RELEASE_REASON.MANUAL, quiet = false) {
  const L = locks.get(p.id); if (!L) return false;
  locks.delete(p.id);
  if (!quiet) {
    const msg = { dead: `Alvo eliminado: análise de ${L.name} finalizada.`, gone: `${L.name} deixou de existir: análise encerrada.`, range: `${L.name} saiu do alcance: trava liberada.`, dimension: "Mudança de dimensão: trava liberada.", manual: `Alvo ${L.name} liberado.` }[reason];
    if (msg && isValid(p)) sayS(p, msg);
  }
  try { emit(EV.SAGE_TARGET_RELEASED, { player: p, reason, name: L.name }); } catch { /* ignore */ }
  return true;
}
export const dropTarget = (id) => { locks.delete(id); };

/** Uma passada de atualização (exportada para teste): atualiza vida/distância, trata fora de alcance e fim do alvo. */
export function updateLocks(now = system.currentTick) {
  for (const [pid, L] of [...locks]) {
    const p = L.p;
    if (!isValid(p)) { locks.delete(pid); continue; }
    const e = L.e; let h; try { h = isValid(e) ? healthComp(e) : undefined; } catch { /* ignore */ }
    if (!isValid(e)) { releaseTarget(p, RELEASE_REASON.GONE); continue; }
    if (!h || h.currentValue <= 0) { releaseTarget(p, RELEASE_REASON.DEAD); continue; }
    if (e.dimension.id !== p.dimension.id) { releaseTarget(p, RELEASE_REASON.DIMENSION); continue; }
    L.pct = h.currentValue / h.effectiveMax; L.dist = dist3(e.location, p.location);
    if (L.dist > rangeOf(p) + LOCK_RANGE_EXTRA) {
      if (!L.outSince) L.outSince = now;
      else if (now - L.outSince > OUT_OF_RANGE_GRACE) releaseTarget(p, RELEASE_REASON.RANGE);
    } else L.outSince = 0;
  }
}

/** Linha da HUD enquanto há alvo travado. */
export function lockLine(p) {
  const L = locks.get(p.id); if (!L) return "";
  const hp = Math.max(0, Math.round(L.pct * 100)), col = hp > 60 ? "§a" : hp > 30 ? "§e" : "§c";
  return `§b◎ §f${L.name.slice(0, 18)} ${col}${hp}% §7${L.dist.toFixed(0)}m${L.outSince ? " §6(fora de alcance)" : ""}`;
}

let started = false;
export function startSageTarget() {
  if (started) return; started = true;
  addHudLine(lockLine);
  system.runInterval(() => { if (locks.size) { try { updateLocks(); } catch (e) { Log.error(`atualizar alvos: ${e}`, "Alvo"); } } }, LOOP_TICKS);
  try {
    world.afterEvents.entityDie.subscribe((ev) => {
      let id; try { id = ev.deadEntity.id; } catch { return; }
      for (const L of [...locks.values()]) if (L.eid === id) { try { releaseTarget(L.p, RELEASE_REASON.DEAD); } catch { /* ignore */ } }
    });
  } catch (e) { Log.warning(`entityDie indisponível: ${e}`, "Alvo"); }
}

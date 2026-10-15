// systems/sagecombat.js - CombatManager do Grande Sábio: MEDE o combate (quem decide e avisa é o sageproc, sem spam e sem agir pelo jogador).
// Mede: inimigos próximos, quantidade, distância, vida, ameaça, dano causado e recebido (janela de 10 s), recargas e habilidades prontas.
// Custo baixo: a consulta de inimigos é compartilhada e guardada por 20 ticks; o resumo (snapshot) vale 10 ticks; as janelas de dano são
// listas curtas (no máximo 60 registros). Fora de combate nada disso é calculado.
import { system } from "@minecraft/server";
import { getData } from "../core/db.js";
import { isValid, healthComp } from "../core/utils.js";
import { on, EV } from "../core/bus.js";
import { inCombat } from "./combat.js";
import { checkCast, listCooldowns } from "./skills.js";
import { GreatSageLogger as Log } from "../core/logger.js";

export const COMBAT_WINDOW = 200;      // ticks (10 s) de memória de dano
export const HOSTILE_RANGE = 16;       // blocos
const HOSTILE_TTL = 20, SNAP_TTL = 10, RING_MAX = 60, SCAN_MAX = 12;
export const THREAT = Object.freeze({ LOW: 0, MEDIUM: 1, HIGH: 2, EXTREME: 3 });
export const THREAT_NAME = Object.freeze(["BAIXA", "MÉDIA", "ALTA", "EXTREMA"]);

const recs = new Map();   // playerId -> { dealt: [[tick, v]], taken: [[tick, v]], hostiles: {at, list}, snap }
const R = (p) => { let r = recs.get(p.id); if (!r) { r = { dealt: [], taken: [], hostiles: { at: -999, list: [] }, snap: null, lastCause: null }; recs.set(p.id, r); } return r; };
export const dropCombat = (id) => { recs.delete(id); };
/** Descarta as consultas guardadas (ex.: depois de um teleporte): a próxima leitura consulta o mundo de novo. */
export const forgetHostiles = (p) => { const r = recs.get(p.id); if (r) { r.hostiles = { at: -999, list: [] }; r.snap = null; } };

/** Ameaça pela razão entre a vida somada dos inimigos e a vida máxima do jogador. */
export function threatOf(enemyHp, myMax) {
  const r = enemyHp / Math.max(1, myMax);
  return r < 0.5 ? THREAT.LOW : r < 1.5 ? THREAT.MEDIUM : r < 4 ? THREAT.HIGH : THREAT.EXTREME;
}

function push(list, now, v) {
  list.push([now, v]);
  while (list.length > RING_MAX || (list.length && now - list[0][0] > COMBAT_WINDOW)) list.shift();
}
const total = (list, now) => { let s = 0; for (const [t, v] of list) if (now - t <= COMBAT_WINDOW) s += v; return s; };

/** Registra dano causado pelo jogador (chamado pelo evento PLAYER_ATTACKS). */
export function noteDealt(p, amount, now = system.currentTick) { if (amount > 0) { const r = R(p); push(r.dealt, now, amount); r.snap = null; } }
/** Registra dano recebido (chamado pelo evento PLAYER_TAKES_DAMAGE). */
export function noteTaken(p, amount, cause, now = system.currentTick) { if (amount > 0) { const r = R(p); push(r.taken, now, amount); r.lastCause = cause ?? r.lastCause; r.snap = null; } }

/** Hostis próximos (família "monster", sem aliados e sem jogadores). Compartilhado por todas as tarefas do Sábio (cache de 20 ticks). */
export function hostilesOf(p, now = system.currentTick) {
  const r = R(p); if (now - r.hostiles.at < HOSTILE_TTL) return r.hostiles.list;
  let list = [];
  try { list = p.dimension.getEntities({ location: p.location, maxDistance: HOSTILE_RANGE, families: ["monster"] }).filter((e) => { try { return !e.hasTag("etheria_ally") && e.typeId !== "minecraft:player"; } catch { return false; } }); } catch { /* ignore */ }
  r.hostiles = { at: now, list }; return list;
}

/** Resumo do combate. Sempre devolve um objeto completo (sem inimigos: count 0). */
export function combatSnapshot(p, now = system.currentTick) {
  const r = R(p); if (r.snap && now - r.snap.at < SNAP_TTL) return r.snap;
  const hostiles = hostilesOf(p, now), me = healthComp(p), myMax = me?.effectiveMax ?? 20, myPct = me ? me.currentValue / Math.max(1, me.effectiveMax) : 1;
  let nearest = null, nearestD = Infinity, lowest = 1, hpSum = 0, seen = 0;
  for (const e of hostiles) {
    if (seen >= SCAN_MAX) break; if (!isValid(e)) continue; seen++;
    const h = healthComp(e); if (!h || h.currentValue <= 0) continue;
    hpSum += h.effectiveMax; lowest = Math.min(lowest, h.currentValue / Math.max(1, h.effectiveMax));
    const d = Math.hypot(e.location.x - p.location.x, e.location.y - p.location.y, e.location.z - p.location.z);
    if (d < nearestD) { nearestD = d; nearest = e; }
  }
  const d = getData(p), eq = d.equippedSkills ?? [], ready = [];
  for (const id of eq) { try { if (checkCast(p, id).ok) ready.push(id); } catch { /* ignore */ } }
  const dealt = total(r.dealt, now), taken = total(r.taken, now);
  const snap = {
    at: now, inCombat: inCombat(p), count: seen, nearestType: nearest?.typeId ?? null, nearest: nearest ? nearestD : null, lowestPct: seen ? lowest : 1,
    threat: seen ? threatOf(hpSum, myMax) : THREAT.LOW, hpPct: myPct, dealt, taken, dps: dealt / (COMBAT_WINDOW / 20), takenPerSec: taken / (COMBAT_WINDOW / 20),
    lastCause: r.lastCause, ready, cooldowns: listCooldowns(p).slice(0, 9),
  };
  r.snap = snap; return snap;
}

let started = false;
/** Liga o CombatManager aos eventos do barramento (PLAYER_ATTACKS / PLAYER_TAKES_DAMAGE). Idempotente. */
export function startSageCombat() {
  if (started) return; started = true;
  on(EV.PLAYER_ATTACKS, ({ player, damage }) => { try { noteDealt(player, damage); } catch (e) { Log.error(`dano causado: ${e}`, "Combate"); } });
  on(EV.PLAYER_TAKES_DAMAGE, ({ player, damage, cause }) => { try { noteTaken(player, damage, cause); } catch (e) { Log.error(`dano recebido: ${e}`, "Combate"); } });
}

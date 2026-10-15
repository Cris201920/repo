// systems/sageassess.js - MODO ASSESS (assessment_mode): o Sábio amplia a percepção do jogador.
//
// Estados (máquina de estados com tabela de transições, exportada para teste):
//   OFF -> ENTERING -> ACTIVE -> SCANNING -> LOCKED_TARGET -> (ACTIVE) -> EXITING -> OFF
// Ao ativar: a HUD normal some (entra a do modo), o mundo ganha um "filtro" (visão noturna), seres vivos recebem AURA proporcional ao poder,
// jogadores/mobs/chefes/aliados têm cores próprias, itens no chão ganham um facho, e as informações aparecem ao selecionar um alvo
// (mirar por alguns instantes ou usar o Livro) -> trava de alvo + análise do Sábio (sagetarget.js).
//
// LIMITAÇÃO DO BEDROCK (documentada, não escondida): scripts não conseguem aplicar um filtro de tela translúcido nem destacar contornos de
// entidades. O "filtro" é feito com o efeito de visão noturna (só quando o jogador não tem outro) e as "auras" são partículas.
//
// Desempenho (celular): um único laço de 5 ticks e só enquanto há jogadores no modo; auras com orçamento por estágio e por nível de efeitos,
// cada ser vivo é redesenhado a cada 20 ticks (em fases alternadas) e as partículas passam pelo orçamento por tick do fxlib.
import { system } from "@minecraft/server";
import { getData } from "../core/db.js";
import { isValid, healthComp, say } from "../core/utils.js";
import { sageCfg, sageStage, sageSay, subtitleActive, sageText } from "./voice.js";
import { SAGE_BASE } from "../config.js";
import { ctx, ringFlat, column, mote, T } from "./fxlib.js";
import { coreOn, coreState, coreOff, corePulse, typingActive } from "./sagecore.js";
import { sageSnd } from "./sagecircle.js";
import { detectTarget, lockTarget, releaseTarget, isLocked, targetOf, lockLine, analyzable, RELEASE_REASON } from "./sagetarget.js";
import { addHudOverride } from "./hudhooks.js";
import { getStats } from "./stats.js";
import { emit, EV } from "../core/bus.js";
import { GreatSageLogger as Log } from "../core/logger.js";

export const ASSESS = Object.freeze({ OFF: "OFF", ENTERING: "ENTERING", ACTIVE: "ACTIVE", SCANNING: "SCANNING", LOCKED_TARGET: "LOCKED_TARGET", EXITING: "EXITING" });
const A = ASSESS;
/** estado atual -> evento -> próximo estado. Evento fora da tabela é ignorado. */
export const TRANSITIONS = Object.freeze({
  [A.OFF]: { toggle: A.ENTERING },
  [A.ENTERING]: { done: A.ACTIVE, toggle: A.EXITING, abort: A.OFF },
  [A.ACTIVE]: { aim: A.SCANNING, toggle: A.EXITING, abort: A.EXITING },
  [A.SCANNING]: { done: A.LOCKED_TARGET, lost: A.ACTIVE, toggle: A.EXITING, abort: A.EXITING },
  [A.LOCKED_TARGET]: { lost: A.ACTIVE, release: A.ACTIVE, toggle: A.EXITING, abort: A.EXITING },
  [A.EXITING]: { done: A.OFF, abort: A.OFF },
});
export const nextState = (state, ev) => TRANSITIONS[state]?.[ev] ?? null;
const LABEL = { OFF: "DESLIGADO", ENTERING: "INICIANDO", ACTIVE: "ATIVO", SCANNING: "ESCANEANDO", LOCKED_TARGET: "ALVO TRAVADO", EXITING: "ENCERRANDO" };
export const assessLabel = (s) => LABEL[s] ?? s;

// ---------------------------------------------------------------- constantes (nada de números mágicos soltos)
export const ENTER_TICKS = 24, EXIT_TICKS = 14, LOOP_TICKS = 5, AIM_DWELL = 10, SCAN_TICKS = 40, AURA_RANGE = 24, ITEM_RANGE = 12;
export const MAX_ACTIVE_TICKS = 2400;                         // 2 minutos: o modo se encerra sozinho se for esquecido
export const MAX_AURAS = Object.freeze([0, 4, 8, 12, 12]);    // por estágio do Sábio (0 inicial · 1 Sábio · 2 GS · 3 Raphael · 4 Ciel)
const AURA_LIFE = 20, FILTER_REFRESH = 20, FILTER_DURATION = 60, HUD_EVERY = 10;
const AURA_COL = { hostile: "ember", boss: "violet", neutral: "green", player: "gold", ally: "sage", locked: "white" };
const NON_LIVING = ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:falling_block", "minecraft:armor_stand", "minecraft:painting", "minecraft:fishing_hook"];

// ---------------------------------------------------------------- aura proporcional (normalizada)
/** Poder estimado de um ser vivo: vida máxima + (jogadores) nível e ataque. */
export function powerOf(e) {
  let p = 0;
  try { p = healthComp(e)?.effectiveMax ?? 0; } catch { /* ignore */ }
  if (e.typeId === "minecraft:player") { try { const s = getStats(e); p += (getData(e).level ?? 1) * 3 + (s.atk ?? 0) * 2; } catch { /* ignore */ } }
  return p;
}
/** Perfil da aura. A razão poder/referência é limitada e passa por escala LOGARÍTMICA: o dobro de poder não vira o dobro de partículas e
 *  valores absurdos não explodem o efeito. 1x = discreta (≈0,3) · 4x ≈ 0,5 · 16x ≈ 0,75 · 64x ou mais = máxima (1,0). */
export function auraProfile(power, ref) {
  const r = Math.min(64, Math.max(0.02, power / Math.max(1, ref)));
  const k = Math.log2(1 + r) / Math.log2(65), intensity = Math.min(1, 0.15 + 0.85 * k);
  return { ratio: r, intensity, size: 0.55 + 0.9 * intensity, count: 1 + Math.round(4 * intensity), rise: 0.6 + 1.4 * intensity, pulse: 0.8 + 1.4 * intensity };
}
export function relationOf(e, p) {
  try {
    if (e.typeId === "minecraft:player") return "player";
    if (e.hasTag("etheria_ally")) return "ally";
    if (e.typeId.includes("boss_")) return "boss";
    const fam = e.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? [];
    if (fam.includes("monster")) return "hostile";
  } catch { /* ignore */ }
  return e.typeId.startsWith("etheria:") && !e.typeId.includes("npc") ? "hostile" : "neutral";
}

// ---------------------------------------------------------------- estado por jogador
const recs = new Map();   // playerId -> { p, state, since, t0, dim, nv, aim, scanUntil, count, hudAt }
export const assessState = (p) => recs.get(p.id)?.state ?? A.OFF;
export const assessActive = (p) => recs.has(p.id);
const sayS = (p, t) => { try { sageText(p, `§f${t}`); } catch { /* ignore */ } };
const stageOf = (p) => sageStage(getData(p));

function applyFilter(p, rec, force = false) {
  const sg = sageCfg(getData(p)), lv = getData(p).settings.fx;
  if (sg.filter === false || lv === "off" || lv === "low" || sg.perf) return;
  try {
    if (!rec.nv) { if (p.getEffect("night_vision")) return; rec.nv = true; force = true; }   // já tem (poção/passiva): não mexe
    if (force) p.addEffect("night_vision", FILTER_DURATION, { amplifier: 0, showParticles: false });
  } catch { /* ignore */ }
}
function dropFilter(p, rec) { if (rec.nv) { try { p.removeEffect("night_vision"); } catch { /* ignore */ } rec.nv = false; } }

function scanRing(p, rec, col = "sage") {   // onda de varredura que se expande a partir do jogador
  const c = ctx(p, 1), o = p.location;
  for (let i = 0; i < 3; i++) system.runTimeout(() => { try { if (isValid(p)) ringFlat(c, { x: o.x, y: o.y, z: o.z }, { col, radius: 5 + i * 3, n: 18 + i * 6, life: 0.6, size: 0.18, a: 0.7 - i * 0.15, tile: T.spark }); } catch { /* ignore */ } }, i * 3 + 1);
}

// ---------------------------------------------------------------- ações ao ENTRAR em cada estado
const onEnter = {
  [A.ENTERING](p, rec) {
    applyFilter(p, rec, true); scanRing(p, rec, "sage");
    try { coreOn(p, "DETECTING", { ticks: 80, side: true }); corePulse(p, 1); } catch { /* ignore */ }
    sageSnd(p, "start1", 0.6, 1.1); sageSay(p, "an_start", { cd: 0 });
  },
  [A.ACTIVE](p) { try { coreState(p, "IDLE"); } catch { /* ignore */ } },
  [A.SCANNING](p, rec) {
    const e = rec.aim?.e; rec.scanUntil = system.currentTick + SCAN_TICKS;
    try { coreState(p, "ANALYZING"); } catch { /* ignore */ }
    if (!e || !lockTarget(p, e, { silent: true })) rec.scanUntil = 0;   // sem alvo válido: o laço devolve a ACTIVE ("lost")
  },
  [A.LOCKED_TARGET](p) { try { coreState(p, "RESULT"); corePulse(p, 1.2); } catch { /* ignore */ } sageSnd(p, "react", 0.6, 1); },
  [A.EXITING](p, rec) { cleanup(p, rec); scanRing(p, rec, "steel"); sageSnd(p, "react", 0.4, 0.8); sageSay(p, "cmd_ok", { cd: 0 }); },
  [A.OFF](p, rec) { cleanup(p, rec); },
};
function cleanup(p, rec) {
  dropFilter(p, rec);
  try { coreOff(p); } catch { /* ignore */ }
  if (isLocked(p)) releaseTarget(p, RELEASE_REASON.MANUAL, true);
}

/** Envia um evento à máquina de estados. Retorna true se houve transição. */
export function assessSend(p, ev) {
  let rec = recs.get(p.id);
  if (!rec) {
    if (ev !== "toggle") return false;
    rec = { p, state: A.OFF, since: 0, t0: system.currentTick, dim: p.dimension.id, nv: false, aim: null, scanUntil: 0, count: 0, hudAt: 0 };
  }
  const to = nextState(rec.state, ev); if (!to) return false;
  const from = rec.state; rec.state = to; rec.since = system.currentTick;
  if (to === A.OFF) recs.delete(p.id); else recs.set(p.id, rec);
  try { onEnter[to]?.(p, rec, from); } catch (e) { Log.error(`assess ${from}->${to}: ${e}`, "Assess"); }
  try { emit(EV.SAGE_ASSESS_STATE, { player: p, from, to, event: ev }); } catch { /* ignore */ }
  Log.debug(`${from} -> ${to} (${ev})`, "Assess");
  return true;
}

/** Liga/desliga o modo. Exige o estágio Sábio e uma pequena quantidade de mana para ligar. */
export function assessToggle(p) {
  if (assessActive(p)) return assessSend(p, "toggle");
  const d = getData(p);
  if (stageOf(p) < 1) { sayS(p, "O Modo Assess exige o estágio Sábio (nível 15 ou 5 análises)."); return false; }
  const cost = SAGE_BASE.mana + 2;
  if (d.mana < cost) { sayS(p, "Mana insuficiente para o Modo Assess."); return false; }
  d.mana -= cost;
  return assessSend(p, "toggle");
}

/** Seleciona manualmente um alvo (Livro do Sábio): ACTIVE ou LOCKED_TARGET -> SCANNING. Retorna false se não houver alvo analisável. */
export function assessSelect(p, e = detectTarget(p, AURA_RANGE)) {
  const rec = recs.get(p.id);
  if (!rec || (rec.state !== A.ACTIVE && rec.state !== A.LOCKED_TARGET) || !e || !analyzable(e)) return false;
  if (rec.state === A.LOCKED_TARGET) { releaseTarget(p, RELEASE_REASON.SWITCH, true); assessSend(p, "release"); }
  rec.aim = { e, since: system.currentTick };
  return assessSend(p, "aim");
}

// ---------------------------------------------------------------- auras e destaques
function nearbyLiving(p, range, limit) {
  let list = [];
  try { list = p.dimension.getEntities({ location: p.location, maxDistance: range, closest: limit * 2, excludeTypes: NON_LIVING }); } catch { /* ignore */ }
  return list.filter((e) => { try { return e !== p && e.id !== p.id && analyzable(e) || (e.typeId === "minecraft:player" && e.id !== p.id); } catch { return false; } }).slice(0, limit);
}
function drawAuras(p, rec, now) {
  const stage = stageOf(p), sg = sageCfg(getData(p)), cap = Math.min(MAX_AURAS[stage] ?? 0, sg.perf ? 3 : 99);
  if (cap <= 0 || sg.parts === false) { rec.count = 0; return; }
  const list = nearbyLiving(p, AURA_RANGE, cap), ref = Math.max(1, powerOf(p)), locked = targetOf(p), phase = Math.floor(now / AURA_LIFE) % 2, c = ctx(p, 0.8);
  rec.count = list.length;
  list.forEach((e, i) => {
    const isLock = locked && e.id === locked.id;
    if (!isLock && i % 2 !== phase && list.length > 4) return;   // com muitos alvos, metade por vez (cada um ainda se renova a cada 40 ticks)
    let prof; try { prof = auraProfile(powerOf(e), ref); } catch { return; }
    const rel = isLock ? "locked" : relationOf(e, p), col = AURA_COL[rel] ?? "white", L = e.location;
    const pulse = 0.8 + 0.2 * Math.sin(now * 0.12 * prof.pulse), r = prof.size * pulse * (isLock ? 1.25 : 1);
    ringFlat(c, { x: L.x, y: L.y, z: L.z }, { col, radius: r, n: 8 + prof.count * 2, life: AURA_LIFE / 20, size: 0.12 + 0.1 * prof.intensity, a: 0.5 + 0.4 * prof.intensity, tile: T.spark, spd: 0.01 });
    column(c, { x: L.x, y: L.y, z: L.z }, { col, n: prof.count, h: 1.1 + 1.7 * prof.intensity, r: r * 0.45, size: 0.1 + 0.06 * prof.intensity, life: 1.0, a: 0.6, tile: T.spark });
  });
  // objetos importantes: facho dourado sobre itens no chão (poucos, só em estágios mais altos)
  if (stage >= 2 && !sg.perf) {
    let items = []; try { items = p.dimension.getEntities({ type: "minecraft:item", location: p.location, maxDistance: ITEM_RANGE, closest: 5 }); } catch { /* ignore */ }
    for (const it of items) { try { if (it.typeId === "minecraft:item") mote(c, { x: it.location.x, y: it.location.y + 0.4, z: it.location.z }, { col: "gold", tile: T.diamond, dir: [0, 1, 0], spd: 0.8, size: 0.14, life: 1.0, a: 0.8 }); } catch { /* ignore */ } }
  }
}

// ---------------------------------------------------------------- HUD do modo (substitui a HUD normal)
function hudOf(p) {
  const rec = recs.get(p.id); if (!rec) return null;
  const hint = rec.state === A.ACTIVE ? "§8mire numa entidade para analisar · Livro do Sábio sai do modo" : rec.state === A.SCANNING ? "§8analisando alvo..." : "";
  const lk = lockLine(p);
  return `§b§l◈ MODO ASSESS §r§8[§f${assessLabel(rec.state)}§8] §7vivos: §f${rec.count}${lk ? "\n" + lk : ""}${hint ? "\n" + hint : ""}`;
}

// ---------------------------------------------------------------- laço único
export function assessTick(now = system.currentTick) {
  for (const [pid, rec] of [...recs]) {
    const p = rec.p;
    if (!isValid(p)) { recs.delete(pid); try { dropFilter(p, rec); } catch { /* ignore */ } continue; }
    const st = rec.state;
    if (st !== A.EXITING) {
      let dead = false; try { dead = (healthComp(p)?.currentValue ?? 1) <= 0; } catch { /* ignore */ }
      if (dead || p.dimension.id !== rec.dim) { assessSend(p, "abort"); continue; }
      if (now - rec.t0 > MAX_ACTIVE_TICKS) { sayS(p, "Modo Assess encerrado por tempo."); assessSend(p, "toggle"); continue; }
    }
    if (st === A.ENTERING) { if (now - rec.since >= ENTER_TICKS) assessSend(p, "done"); continue; }
    if (st === A.EXITING) { if (now - rec.since >= EXIT_TICKS) assessSend(p, "done"); continue; }
    if (now % FILTER_REFRESH < LOOP_TICKS) applyFilter(p, rec, true);
    if (st === A.ACTIVE) {
      const e = detectTarget(p, AURA_RANGE);
      if (e && rec.aim?.e && rec.aim.e.id === e.id) { if (now - rec.aim.since >= AIM_DWELL) { assessSend(p, "aim"); continue; } }
      else rec.aim = e ? { e, since: now } : null;
    } else if (st === A.SCANNING) {
      if (!isLocked(p)) { assessSend(p, "lost"); continue; }
      if (now >= rec.scanUntil) { assessSend(p, "done"); continue; }
    } else if (st === A.LOCKED_TARGET) {
      if (!isLocked(p)) { assessSend(p, "lost"); continue; }
    }
    if (now % AURA_LIFE < LOOP_TICKS) { try { drawAuras(p, rec, now); } catch (e) { Log.error(`auras: ${e}`, "Assess"); } }
    if (now % HUD_EVERY < LOOP_TICKS && !typingActive(p) && !subtitleActive(p)) { try { p.onScreenDisplay.setActionBar(hudOf(p)); } catch { /* ignore */ } }
  }
}

/** Limpeza quando o jogador sai. */
export function dropAssess(id) { const rec = recs.get(id); if (rec) { try { dropFilter(rec.p, rec); } catch { /* ignore */ } } recs.delete(id); }

let started = false;
export function startSageAssess() {
  if (started) return; started = true;
  addHudOverride(hudOf);
  system.runInterval(() => { if (recs.size) { try { assessTick(); } catch (e) { Log.error(`laço do assess: ${e}`, "Assess"); } } }, LOOP_TICKS);
}

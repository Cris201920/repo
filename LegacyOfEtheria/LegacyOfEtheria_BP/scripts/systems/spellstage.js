// systems/spellstage.js - Diretor de conjuração em FASES: formação -> liberação -> trajeto -> impacto.
// Este módulo cuida só do TEMPO e do VISUAL de cada fase; a regra do jogo (custo, recarga, dano, reembolso) continua em skills.js e chega aqui
// por um objeto `io` (guard, aimPoint, execute, onRelease, flush, onCancel, onFail). Nada aqui aplica dano nem gasta recurso por conta própria.
// Mobile: laços de 1 tick só existem durante a formação (≤ ~18 ticks) e o trajeto (≤ 24 ticks); tudo passa por fxlib (orçamento por tick e níveis).
import { system } from "@minecraft/server";
import { SOUNDS } from "../config.js";
import { ctx, snd, burst, mote, implode, T, partChoreo } from "./fxlib.js";
import { recipeFor } from "../data/fxrecipes.js";
import { LOOK } from "../data/fxpack.js";
import { CHOREO, STAGE_RULES, ELEMENT_LOOK, defaultFly, defaultBeamFly, hnorm } from "../data/spellstages.js";
import { masteryLevel } from "./mastery.js";
import { hasBuff } from "./effects.js";
import { isValid, norm, add, dist, clamp } from "../core/utils.js";

export const stageMetrics = { started: 0, released: 0, cancelled: 0, failed: 0, hold: 0 };
const safe = (fn) => { try { fn(); } catch { /* efeitos nunca derrubam a habilidade */ } };

// ------------------------------------------------------------------ quais habilidades têm formação
const derived = new Map();
const HANDED = new Set(["projectile", "beam", "chain", "target_aoe"]);   // a magia sai da mão do conjurador
/** Coreografia derivada da receita visual existente (cast = formação, travel = liberação, impact = chegada) + núcleo voando nos projéteis. */
function derive(sk) {
  let ch = derived.get(sk.id); if (ch) return ch;
  const r = recipeFor(sk), look = LOOK[sk.id] ?? ELEMENT_LOOK[sk.element] ?? ELEMENT_LOOK.arcane, kind = sk.exec.kind;
  const handed = HANDED.has(kind);
  ch = {
    // formação: a receita original no 1º tick + "carga" visível a cada tick (brilho que cresce e partículas sugadas para a mão ou para o peito)
    form: (c, f) => {
      if (f.i === 0) r.cast?.(c, f.v0);
      const o = handed ? f.hand : { x: f.feet.x, y: f.feet.y + 1.1, z: f.feet.z };
      mote(c, o, { col: look.B, tile: T.blob, size: 0.12 + 0.42 * f.t, life: 0.12, a: 0.9, spd: 0, grow: 0 });
      if (f.i % 2 === 0) implode(c, o, { col: look.A, tile: look.tile, n: 2, radius: (handed ? 0.8 : 1.3) * (1 - f.t) + 0.3, life: 0.25, size: 0.14, flat: 1 });
    },
    release: (c, v) => r.travel?.(c, v),
    fly: kind === "projectile" || kind === "chain" ? defaultFly(look) : kind === "beam" ? defaultBeamFly(look) : null,
    impact: (c, v) => r.impact?.(c, v),
  };
  derived.set(sk.id, ch);
  return ch;
}

/** Especificação de fases da habilidade, ou null quando ela é instantânea (golpes, investidas, sentidos, gritos...). */
export function stageSpec(sk) {
  const ex = sk?.exec; if (!ex) return null;
  const own = CHOREO[sk.id], rule = STAGE_RULES[ex.kind];
  if (!own) {
    if (!rule) return null;
    if (sk.cat === "Combate" || sk.cat === "Racial") return null;                               // golpes e rugidos: instantâneos
    if (sk.element === "physical" && sk.cat !== "Extra") return null;
    if (ex.kind === "buff" && sk.element !== "arcane" && sk.element !== "light") return null;   // fúrias e gritos: instantâneos
    if (ex.kind === "aoe_self" && (sk.element === "blood" || sk.element === "physical")) return null;
  }
  return { windup: own?.windup ?? rule?.windup ?? 6, speed: own?.speed ?? rule?.speed ?? 0, minT: own?.minT ?? 1, timing: own?.timing ?? rule?.timing ?? "arrive", ch: own ?? derive(sk), kind: ex.kind, hand: own ? !!own.hand : HANDED.has(ex.kind) };
}

// ------------------------------------------------------------------ geometria do conjurador
function basis(player) {
  const head = player.getHeadLocation(), dir = norm(player.getViewDirection()), hdir = hnorm(dir), right = { x: -hdir.z, y: 0, z: hdir.x };
  const hand = { x: head.x + right.x * 0.38 + dir.x * 0.55, y: head.y - 0.3 + dir.y * 0.55, z: head.z + right.z * 0.38 + dir.z * 0.55 };
  return { head, dir, hdir, right, hand };
}

// ------------------------------------------------------------------ voo (trajeto) a cada tick
function flight(c, ch, v, T_, onEnd) {
  if (T_ <= 0) { onEnd(); return; }
  if (!ch.fly) { system.runTimeout(() => safe(onEnd), T_); return; }
  let i = 0, prev = v.from;
  const hd = hnorm(v.dir), right = { x: -hd.z, y: 0, z: hd.x };
  const id = system.runInterval(() => {
    i++;
    const t = i / T_, p = { x: v.from.x + (v.at.x - v.from.x) * t, y: v.from.y + (v.at.y - v.from.y) * t, z: v.from.z + (v.at.z - v.from.z) * t };
    safe(() => ch.fly(c, p, { i, n: T_, t, dir: v.dir, hdir: hd, right, prev, from: v.from, to: v.at, ex: v.ex, tier: v.tier }));
    prev = p;
    if (i >= T_) { system.clearRun(id); safe(onEnd); }
  }, 1);
}

// ------------------------------------------------------------------ escudos: pulso visual enquanto o efeito durar
function hold(c, player, sk, ch, play) {
  const ex = sk.exec, every = ch.hold?.every ?? 8, total = Math.max(1, Math.floor(((ex.sec ?? 5) * 20) / every)), bid = ex.buff?.id;
  let k = 0; stageMetrics.hold++;
  const frame = () => ({ feet: player.location, center0: player.location, ex });
  const id = system.runInterval(() => {
    let alive = isValid(player);
    if (alive && bid) { try { alive = hasBuff(player, bid); } catch { /* sem consulta: segue pela duração */ } }
    if (!alive || k >= total) {
      system.clearRun(id);
      if (isValid(player)) { const early = !alive && k < total - 1; safe(() => ch.end?.(c, frame(), early)); play(ch.endSfx?.(early), player.location); }
      return;
    }
    safe(() => ch.holdFx(c, frame(), k, total)); k++;
  }, every);
}

// ------------------------------------------------------------------ o diretor
/**
 * Executa as fases de uma conjuração. Retorna { cancel(reason), active } (o jogo pode interromper de fora: morte, saída, dimensão).
 * io: { guard(): string|null · aimPoint(range) · execute(): {ok,msg,geo,hits} · onRelease(out,v) · flush(hits, delayOf, onEach) · onCancel(reason) · onFail(msg) }
 */
export function runStaged(player, sk, spec, io) {
  stageMetrics.started++;
  const c = ctx(player), ch = partChoreo(spec.ch, sk), ex = sk.exec;   // + partículas portadas (fxlib.partChoreo) em formação/liberação/impacto/escudo
  const ml = masteryLevel(player, sk.id), tier = ml >= 7 ? 3 : ml >= 3 ? 2 : 1;
  const n = Math.max(2, Math.round(spec.windup * (1 - 0.03 * ml)));   // maestria acelera a formação (até -30%)
  let aimAt = -99, aimPt;
  const aim = (range) => { const now = system.currentTick; if (now - aimAt >= 2) { aimAt = now; try { aimPt = io.aimPoint(range); } catch { aimPt = undefined; } } return aimPt; };
  const mk = (i) => ({ i, n, t: (i + 1) / n, feet: player.location, ...basis(player), aim, ex, tier });
  const play = (list, at) => { for (const s of list ?? []) safe(() => snd(c, s.id, { vol: s.vol, pitch: s.pitch, at })); };
  let stopped = false, timer;
  const stop = () => { stopped = true; if (timer !== undefined) { system.clearRun(timer); timer = undefined; } };
  const handle = {
    get active() { return !stopped; },
    cancel(reason) {
      if (stopped) return false;
      stop(); stageMetrics.cancelled++;
      if (isValid(player)) safe(() => { burst(c, basis(player).hand, { col: "steel", tile: T.smoke, n: 5, spd: 1, size: 0.35, a: 0.6, life: 0.5 }); c.p.playSound("random.fizz", { volume: 0.5, pitch: 1.2 }); });
      io.onCancel(reason);
      return true;
    },
  };

  function release() {
    let out;
    try { out = io.execute(); } catch (e) { console.warn(`[Etheria] liberar ${sk.id}: ${e}`); out = { ok: false, msg: "Erro ao lançar." }; }
    if (!out || !out.ok) { stageMetrics.failed++; io.onFail(out?.msg ?? "Falhou."); return; }
    stageMetrics.released++;
    const fr = mk(n - 1), g = out.geo ?? {};
    const origin = g.from ?? fr.head, from = spec.hand ? fr.hand : origin;
    const at = g.at ?? g.to ?? player.location, to = g.to ?? at, d = dist(from, at);
    const T_ = spec.speed > 0 ? clamp(Math.max(spec.minT ?? 1, Math.ceil(d / spec.speed)), 1, 24) : 0;
    const dir = spec.speed > 0 && d > 0.5 ? norm({ x: at.x - from.x, y: at.y - from.y, z: at.z - from.z }) : fr.dir;
    const v = { player, sk, ex, tier, pos: player.location, origin, from, to, at, dir, hand: fr.hand, dist: d, T: T_, hits: out.hits.length };
    play(ch.sfx?.release ?? [{ id: ex.snd ?? SOUNDS.cast, vol: 0.8, pitch: 1 }], player.location);
    safe(() => ch.release?.(c, v));
    io.onRelease(out, v);
    const delayOf = (e) => (spec.timing === "pass" ? clamp(Math.ceil(dist(from, e.location) / Math.max(0.5, spec.speed)), 0, T_) : T_);
    flight(c, ch, v, T_, () => { safe(() => ch.impact?.(c, v)); play(ch.sfx?.impact, at); });
    io.flush(out.hits, delayOf, (e) => safe(() => ch.onHit?.(c, e, v)));
    if (ch.holdFx) hold(c, player, sk, ch, play);
  }

  let i = 0;
  const step = () => {
    if (stopped) return;
    const bad = io.guard();
    if (bad) { handle.cancel(bad); return; }
    if (i >= n) { stop(); release(); return; }
    try {
      const f = mk(i);
      if (i === 0) f.v0 = { pos: f.feet, from: f.head, to: add(f.head, f.dir, 6), at: add(f.head, f.dir, 6), dir: f.dir, tier, sk };
      ch.form?.(c, f);
    } catch { /* efeito de formação nunca derruba a habilidade */ }
    i++;
  };
  play(ch.sfx?.form, player.location);
  step();
  if (!stopped) timer = system.runInterval(step, 1);
  return handle;
}

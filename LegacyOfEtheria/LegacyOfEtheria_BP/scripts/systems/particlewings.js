// systems/particlewings.js - 9.5: ASAS DE PARTÍCULAS (Demônio, Lord Demônio, Anjo Caído e mobs Anjo Caído / Pico / Garasha).
// As asas desses corpos não são cubos (tools/particle_wings.py esvazia os ossos de asa): são desenhadas aqui, a cada 3 ticks, como um LEQUE
// denso de riscos pretos (pinceladas) que saem do ombro, com base vermelha, borrões de movimento, baforadas de fumaça preta e fagulhas.
// 9.6: UMA chamada de spawnParticle por corpo solta o leque das DUAS asas (etheria:wingfan: variable.count riscos, 20-160; ângulo,
// comprimento, lado, largura e tipo de cada risco saem de variable.particle_random_1..4) + 1 chamada de fumaça a cada 2 emissões
// (etheria:wingsmoke). As partículas ficam no mundo: o corpo anda e as gerações anteriores ficam para trás -> rastro/borrão.
// A forma vem do ESTADO (repouso, andando, agachado, no ar, pairando, decolando, planando, mergulho) e da FASE DE BATIDA (system.currentTick).
// 9.8: demônios ~+50% de riscos (mais grossos e sobrepostos na base) e +60% de baforadas; ANJOS (todas as raças anjo e os mobs anjo) também
// por partículas: leque claro (etheria:wingfan_light, branco com bordas/pontas/base douradas, fagulhas douradas e baforadas de luz), mais
// aberto e elegante, que cresce por estágio (riscos, envergadura e ouro; Querubim 2 pares, Serafim 3 pares). Teto de vivas 700/350/150 ->
// 1100/560/240 (asas + aura da raça de power.js + mob mais perto; ver LIVE_CAP).
// Desempenho: 1 laço a cada 3 ticks; sem getEntities (o mob mais perto vem do laço de mobflight.js); no máximo 2 corpos por jogador
// (ele + 1 mob <= 48 blocos, com 60%/40% da densidade); densidade pelo nível de FX (alto 100%, médio 55%, baixo 25%).
import { world, system } from "@minecraft/server";
import { ctx, emitMany } from "./fxlib.js";
import { getData } from "../core/db.js";
import { bodyOfStage, tierOf } from "./raceparts.js";
import { isLordStage } from "../data/races.js";
import { lineageOf } from "../data/lineages.js";
import { pwNear } from "./mobflight.js";

const EVERY = 3;                                   // ticks entre emissões
const PW_BODY = new Set(["demon", "fallen", "fallen_lord"]);
const ANGEL_BODY = { angel: 1, angel_arch: 1, angel_cherub: 2, angel_seraph: 3 };   // 9.8: corpo de anjo -> pares de asas de partículas
const FID = "etheria:wingfan", SID = "etheria:wingsmoke";   // 9.6: 1 chamada = leque inteiro (variable.count riscos) / baforadas + fagulhas
const LID = "etheria:wingfan_light";                          // 9.8: leque claro dos anjos (mesmo Molang, textura branca/dourada)
const MOB = { "etheria:fallen_angel": { tier: 5, lord: true, fallen: true, sc: 1.2 }, "etheria:pico": { tier: 4, lord: false, fallen: true, sc: 1.0 },
  "etheria:garasha": { tier: 4, lord: false, fallen: true, sc: 1.0 },
  // 9.8: mobs ANJO (asas brancas/douradas de partículas; halo do modelo preservado)
  "etheria:feldway_angel": { tier: 3, lord: false, angel: true, pairs: 1, sc: 1.0 }, "etheria:dino": { tier: 4, lord: false, angel: true, pairs: 1, sc: 1.0 },
  "etheria:zalario": { tier: 5, lord: false, angel: true, pairs: 1, sc: 1.1 }, "etheria:angel_guardian": { tier: 5, lord: true, angel: true, pairs: 1, sc: 1.2 } };
// estados: lo/hi = ângulos do leque (graus; 0 = para fora, 90 = para cima, negativo = para baixo) · sw = varredura para trás · amp/hz = batida
// span = envergadura relativa · n = riscos POR ASA por emissão (FX alto, antes do fator do estágio) · life = vida dos riscos (s)
// ev = emite a cada ev laços · smk = baforadas por emissão (as 2 asas) · red = fração de riscos vermelhos na base · blur = fração de borrões largos
// 9.8: n x1,5 (16/18/12/34/50/64/56/22 -> 24/27/18/50/74/96/84/33) e smk x1,6
const ST = {
  rest: { lo: 12, hi: 74, sw: 30, amp: 3, hz: 0.35, span: 0.92, n: 24, life: 0.5, ev: 2, smk: 0.65, red: 0.06, blur: 0 },
  walk: { lo: 10, hi: 74, sw: 30, amp: 7, hz: 1.1, span: 0.92, n: 27, life: 0.5, ev: 2, smk: 1, red: 0.06, blur: 0 },
  sneak: { lo: 60, hi: 92, sw: 60, amp: 2, hz: 0.3, span: 0.6, n: 18, life: 0.5, ev: 2, smk: 0.35, red: 0.05, blur: 0 },
  air: { lo: 6, hi: 82, sw: 30, amp: 22, hz: 1.5, span: 0.95, n: 50, life: 0.32, ev: 1, smk: 3.2, red: 0.07, blur: 0.08 },
  hover: { lo: -48, hi: 52, sw: 16, amp: 34, hz: 1.35, span: 1.0, n: 74, life: 0.3, ev: 1, smk: 4.8, red: 0.08, blur: 0.12 },
  rise: { lo: -58, hi: 62, sw: 10, amp: 48, hz: 2.1, span: 1.05, n: 96, life: 0.27, ev: 1, smk: 8, red: 0.09, blur: 0.14 },
  glide: { lo: -55, hi: 32, sw: 4, amp: 6, hz: 0.6, span: 1.18, n: 84, life: 0.4, ev: 1, smk: 3.2, red: 0.08, blur: 0.16 },
  dive: { lo: -16, hi: 34, sw: 68, amp: 4, hz: 0.8, span: 0.95, n: 33, life: 0.32, ev: 1, smk: 1.6, red: 0.06, blur: 0.2 },
};
// 9.8: ANJO - leque mais aberto e elegante (penas longas, menos riscos curtos/"pelos"): repouso alto e fechado (para trás), voo aberto e
// ondulante, planeio bem aberto, mergulho recolhido. red = fração de penas da base douradas; n antes do fator do estágio (cresce com o tier).
const AST = {
  rest: { lo: 40, hi: 98, sw: 50, amp: 2, hz: 0.3, span: 0.95, n: 16, life: 0.55, ev: 2, smk: 0.4, red: 0.1, blur: 0.04 },
  walk: { lo: 36, hi: 98, sw: 48, amp: 6, hz: 1.0, span: 0.95, n: 18, life: 0.55, ev: 2, smk: 0.6, red: 0.1, blur: 0.04 },
  sneak: { lo: 62, hi: 102, sw: 70, amp: 2, hz: 0.3, span: 0.66, n: 12, life: 0.55, ev: 2, smk: 0.2, red: 0.08, blur: 0 },
  air: { lo: 4, hi: 88, sw: 24, amp: 24, hz: 1.3, span: 1.05, n: 32, life: 0.36, ev: 1, smk: 1.6, red: 0.1, blur: 0.04 },
  hover: { lo: -30, hi: 72, sw: 12, amp: 36, hz: 1.1, span: 1.12, n: 46, life: 0.34, ev: 1, smk: 2.6, red: 0.1, blur: 0.05 },
  rise: { lo: -40, hi: 82, sw: 8, amp: 46, hz: 1.8, span: 1.15, n: 60, life: 0.3, ev: 1, smk: 4, red: 0.12, blur: 0.06 },
  glide: { lo: -22, hi: 42, sw: 6, amp: 8, hz: 0.5, span: 1.32, n: 52, life: 0.42, ev: 1, smk: 1.6, red: 0.1, blur: 0.05 },
  dive: { lo: -8, hi: 30, sw: 76, amp: 3, hz: 0.8, span: 0.8, n: 22, life: 0.32, ev: 1, smk: 1, red: 0.08, blur: 0.22 },
};
// pares extras (Querubim 2, Serafim 3): par de baixo (mais curto, apontando para baixo) e par de cima (pequeno, junto da cabeça)
const PAIRS = [null, { dy: -0.32, dlo: -38, dhi: -46, len: 0.62, n: 0.38 }, { dy: 0.16, dlo: 22, dhi: 14, len: 0.5, n: 0.3 }];
// densidade pelo nível de FX do jogador: alto (e acima) = 100% · médio 55% (menos riscos por chamada) · baixo 25% (metade dos riscos, metade das emissões)
const FXD = { extreme: 1, ultra: 1, high: 1, medium: 0.55, low: 0.5 };
const FXEV = { low: 2 };
// TETO de partículas VIVAS por jogador (as dele + as do mob mais perto): cada emissão registra (fim da vida, quantidade); a que passaria do teto encolhe
// 9.8: 700/350/150 -> 1100/560/240. Pior caso medido no simulador (Lord Demônio decolando, FX alto): asas ~900 + aura ~150 (+ mob), ver relatório.
const LIVE_CAP = { extreme: 1100, ultra: 1100, high: 1100, medium: 560, low: 240 };
const liveN = new Map();   // playerId -> [[tickFim, n], ...]
function room(c, now) {
  if (!c.pid) return 999;
  let a = liveN.get(c.pid); if (!a) { a = []; liveN.set(c.pid, a); }
  let n = 0, j = 0;
  for (const e of a) if (e[0] > now) { a[j++] = e; n += e[1]; }
  a.length = j;
  return (LIVE_CAP[c.lv] ?? 150) - n;
}
function spend(c, now, want, life, min = 4) {   // devolve quantas partículas pode soltar (0 = não emite)
  const r = room(c, now), n = Math.min(want, Math.floor(r));
  if (n < min || n < 1) return 0;
  if (c.pid) liveN.get(c.pid).push([now + Math.ceil(life * 20), n]);
  return n;
}
/** 9.8: orçamento compartilhado com a AURA da raça (power.js): devolve quantas partículas a chamada pode soltar (0 = não emite). */
export function liveBudget(c, now, want, life, min = 3) { return spend(c, now, want, life, min); }
const FLY_ST = [null, "hover", "rise", "glide", "dive"];
const COL = {
  demon: { line: [0.02, 0.012, 0.025], vein: [0.13, 0.02, 0.07], base: [0.85, 0.05, 0.08], glint: [0.95, 0.12, 0.12] },
  fallen: { line: [0.03, 0.02, 0.045], vein: [0.15, 0.06, 0.26], base: [0.62, 0.05, 0.14], glint: [0.66, 0.42, 1.0] },
};
const SMOKE = [0.045, 0.035, 0.055];
// 9.8: anjo - linha branca, ouro nas penas de fora/pontas (vein, mais forte a cada estágio), base dourada, fagulhas douradas, baforadas de luz
const GOLD = [1.0, 0.76, 0.24], WHITE = [1.0, 0.99, 0.95], LIGHT = [0.98, 0.96, 0.86];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function angelPal(tier) { const g = Math.min(0.6, 0.12 + 0.07 * tier); return { line: WHITE, vein: mixc(WHITE, GOLD, g), base: [1.0, 0.8, 0.32], glint: [1.0, 0.86, 0.38] }; }
const palOf = (B) => (B.angel ? angelPal(B.tier) : B.fallen ? COL.fallen : COL.demon);
const DEG = Math.PI / 180, TAU = Math.PI * 2;

const info = new Map();   // playerId -> { at, on, tier, lord, fallen }
const prevSt = new Map(); // id do corpo -> { st, take }
let loops = 0;
export const pwStats = { calls: 0, parts: 0, bodies: 0, loops: 0 };   // métrica para o simulador / modo debug

function bodyInfo(p, now) {
  let b = info.get(p.id);
  if (b && now - b.at < 100) return b;
  b = { at: now, on: false, tier: 0, lord: false, fallen: false, angel: false, pairs: 1 };
  try {
    const d = getData(p);
    if (d.raceChosen) {
      const body = bodyOfStage(d.raceStage);
      let lin = null; try { lin = lineageOf(d); } catch { /* ignore */ }
      if (PW_BODY.has(body) && !lin) {
        b.on = true; b.tier = Math.max(1, tierOf(d)); b.fallen = body !== "demon";
        b.lord = isLordStage(d.raceStage ?? "") || d.raceStage === "demon_4" || body === "fallen_lord";
      } else if (ANGEL_BODY[body] && !lin) {   // 9.8: anjo (Lorde de anjo também: mantém a luz da raça, mais denso)
        b.on = true; b.angel = true; b.tier = Math.max(1, tierOf(d)); b.pairs = ANGEL_BODY[body]; b.lord = isLordStage(d.raceStage ?? "");
      }
    }
  } catch { /* ignore */ }
  info.set(p.id, b); return b;
}

/** estado visual do corpo (jogador ou mob) */
function stateOf(e, isPlayer) {
  let fly = 0, sfly = 0;
  try { fly = e.getProperty("etheria:fly") ?? 0; } catch { /* ignore */ }
  if (isPlayer) { try { sfly = e.getProperty("etheria:sfly") ?? 0; } catch { /* ignore */ } }
  if (sfly === 1) return "glide"; if (sfly === 2) return "rise"; if (sfly === 3) return "dive";
  if (fly > 0) return FLY_ST[fly] ?? "hover";
  let g = true; try { g = !!e.isOnGround; } catch { /* ignore */ }
  if (isPlayer) { try { if (e.isGliding) return "glide"; } catch { /* ignore */ } }
  if (!g) return "air";
  try { if (e.isSneaking) return "sneak"; } catch { /* ignore */ }
  let v = { x: 0, z: 0 }; try { v = e.getVelocity(); } catch { /* ignore */ }
  return Math.hypot(v.x, v.z) > 0.06 ? "walk" : "rest";
}

/** Base do leque das duas asas (vetores no mundo) para os emissores etheria:wingfan / etheria:wingsmoke. */
function basis(B, sw, beat, armDeg = 90) {   // armDeg: ângulo do "braço" da asa (onde nascem as penas de fora)
  const yaw = B.yaw * DEG, fx = -Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx, sc = B.sc, be = (sw + beat) * DEG;
  const cb = Math.cos(be), sb = Math.sin(be), o = 0.16 * sc, ca = Math.cos(armDeg * DEG), sa = Math.sin(armDeg * DEG);
  const ux1 = cb * rx - sb * fx, uz1 = cb * rz - sb * fz, ux2 = -cb * rx - sb * fx, uz2 = -cb * rz - sb * fz, tx = -fx * 0.18, tz = -fz * 0.18;
  return { fx, fz, rx, rz, pos: { x: B.pos.x - fx * 0.22 * sc, y: B.pos.y + 1.38 * sc, z: B.pos.z - fz * 0.22 * sc },
    v: { ox1: rx * o, oz1: rz * o, ox2: -rx * o, oz2: -rz * o, ux1, uz1, ux2, uz2, tx, tz,
      ax1: ca * ux1 + tx, ay1: sa, az1: ca * uz1 + tz, ax2: ca * ux2 + tx, ay2: sa, az2: ca * uz2 + tz } };
}
const dens = (B) => (B.angel ? 0.6 + 0.14 * B.tier : 0.8 + 0.06 * B.tier) * (B.lord ? 1.15 : 1);   // 9.8: anjo cresce mais por estágio
const fxd = (c) => (FXD[c.lv] ?? Math.min(1, c.k)) * (c.pwm ?? 1);
const colv = (pal) => ({ lr: pal.line[0], lg: pal.line[1], lb: pal.line[2], vr: pal.vein[0], vg: pal.vein[1], vb: pal.vein[2], br: pal.base[0], bg: pal.base[1], bb: pal.base[2] });
function smoke(c, Bs, B, o, now) {   // baforadas pretas (anjo: de luz branca) + fagulhas (1 chamada)
  const pal = palOf(B), count = spend(c, now, o.count, o.life, 1), sm = B.angel ? LIGHT : SMOKE;
  if (!count) return 0;
  pwStats.parts += count;
  return emitMany(c, SID, Bs.pos, { ...Bs.v, count, life: o.life, lo: o.lo, dh: o.dh, len: o.len, spd: o.spd, sz: o.sz * B.sc * (B.angel ? 1.25 : 1), spk: o.spk,
    dvx: -Bs.fx * o.back, dvy: -o.down, dvz: -Bs.fz * o.back, cr: sm[0], cg: sm[1], cb: sm[2], gr: pal.glint[0], gg: pal.glint[1], gb: pal.glint[2], a: B.angel ? 0.35 : 0.88 }) ? 1 : 0;
}

/** Desenha as asas: UMA chamada por par (leque das duas asas, etheria:wingfan / _light) + baforadas a cada 2 emissões.
 * B = { pos, yaw, tier, lord, fallen, angel, pairs, sc, st, key, gen }. Devolve chamadas. */
export function drawWings(c, B, now) {
  const S = (B.angel ? AST : ST)[B.st] ?? (B.angel ? AST : ST).rest;
  if (c.k <= 0) return 0;
  const f = fxd(c), D = dens(B), air = S.ev === 1, take = B.take > 0, pal = palOf(B), A = !!B.angel;
  const amp = S.amp * (take ? 1.25 : 1), ph = (S.hz * 360 * (now / 20) + (B.key % 7) * 51) % 360;
  const Bs = basis(B, S.sw, amp * 0.22 * Math.cos(ph * DEG), S.hi + amp * Math.sin((ph - 32) * DEG));
  const Lmax = (A ? 1.35 + 0.2 * B.tier : 1.45 + 0.22 * B.tier) * B.sc * S.span * (B.lord ? 1.12 : 1);
  const want = Math.max(4, Math.min(300, Math.round(2 * S.n * D * f * (take ? 1.2 : 1))));
  let n = 0;
  for (let k = 0; k < (A ? B.pairs ?? 1 : 1); k++) {
    // pares extras no voo: 1 emissão sim, 1 não, com vida 1,8x (mesma densidade média, metade das chamadas: Serafim ~17 chamadas/s em vez de 25)
    const P = PAIRS[k], alt = P && air && !take, life = alt ? S.life * 1.8 : S.life;
    if (alt && B.gen % 2 === 1) continue;
    const cnt = spend(c, now, P ? Math.max(4, Math.round(want * P.n)) : want, life);
    if (!cnt) { if (k === 0) break; continue; }
    pwStats.parts += cnt;
    const pos = P ? { x: Bs.pos.x, y: Bs.pos.y + P.dy * B.sc, z: Bs.pos.z } : Bs.pos, lo = S.lo + (P?.dlo ?? 0), hi = S.hi + (P?.dhi ?? 0), lm = Lmax * (P?.len ?? 1);
    const v = A
      // anjo: penas longas e lisas (lp alto, pouca cobertura curta), mais finas; ouro na base cresce com o estágio
      ? { lp: 0.72, len: lm * 0.8, arm: lm * 0.46, w: 0.11 * B.sc * (B.lord ? 1.08 : 1), red: S.red + 0.02 * B.tier, cov: 0.14, blur: S.blur }
      // demônio: 9.8 riscos ~15% mais grossos e mais cobertura curta e grossa no miolo (aspecto de pincel)
      : { lp: 0.58, len: lm * 0.74, arm: lm * 0.42, w: 0.16 * B.sc * (air ? 1 : 1.2) * (B.lord ? 1.12 : 1), red: S.red * (B.lord ? 1.5 : 1), cov: 0.36, blur: S.blur };
    if (emitMany(c, A ? LID : FID, pos, { ...Bs.v, ...colv(pal), count: cnt, life, a: 1, lo, dh: hi - lo, amp: amp * (P ? 0.8 : 1), ph, lag: 32, ...v,
      dvx: air ? -Bs.fx * 0.35 : 0, dvy: air ? -0.15 : -0.04, dvz: air ? -Bs.fz * 0.35 : 0 })) n++;
  }
  if (!n) return 0;
  // baforadas: a cada 2 emissões (dobro da contagem), mais na batida para baixo e na decolagem
  if (B.gen % 2 === 0) {
    const down = air && amp > 10 && Math.sin(ph * DEG) < -0.3;
    let ns = 2 * S.smk * D * f + (down ? 4 * f : 0) + (take ? 8 * f : 0);
    ns = Math.floor(ns) + (Math.random() < ns % 1 ? 1 : 0);
    const spk = A ? 0.25 + 0.06 * B.tier : B.lord ? 0.3 : 0.2;
    if (ns >= 1) n += smoke(c, Bs, B, { count: Math.min(80, ns), life: 0.8, lo: S.lo, dh: S.hi - S.lo, len: Lmax, spd: 0.6, sz: 0.15, spk, back: air ? 0.6 : 0.1, down: air ? 0.4 : 0.15 }, now);
  }
  return n;
}

/** Decolagem: explosão de raios pretos/vermelhos saindo das costas + fumaça preta (2 chamadas, uma vez). */
export function takeoffBurst(c, B, now = system.currentTick) {
  if (c.k <= 0) return 0;
  const f = fxd(c), pal = palOf(B), Bs = basis(B, 15, 0), g = (B.lord ? 1.15 : 1) * (B.angel ? 0.85 + 0.06 * B.tier : 1), A = !!B.angel;
  Bs.pos.y -= 0.08 * B.sc;
  const count = spend(c, now, Math.max(10, Math.min(260, Math.round(150 * f * g))), 0.4);
  if (!count) return 0;
  pwStats.parts += count;
  // anjo: explosão de luz DOURADA (metade dos raios na cor da base dourada) + nuvem de luz com muitas fagulhas douradas
  let n = emitMany(c, A ? LID : FID, Bs.pos, { ...Bs.v, ...colv(pal), count, life: 0.4, a: 0.95, lo: -90, dh: 360, amp: 0, ph: 0, lag: 0, lp: 0, len: (1.8 + 0.12 * B.tier) * B.sc * g, arm: 0,
    w: 0.1 * B.sc, red: A ? 0.5 : B.lord ? 0.4 : 0.3, cov: 0.15, blur: A ? 0.25 : 0.15, dvx: 0, dvy: 0, dvz: 0 }) ? 1 : 0;
  n += smoke(c, Bs, B, { count: Math.max(6, Math.round(50 * f * g)), life: 1.1, lo: -30, dh: 240, len: 0.7 * B.sc, spd: 2.6, sz: 0.3, spk: A ? 0.45 : 0.2, back: 0.3, down: -0.2 }, now);
  return n;
}

function lead(e) {   // posição prevista ~2 ticks à frente (a geração nova nasce no corpo; as anteriores ficam para trás como rastro)
  const L = e.location; let v; try { v = e.getVelocity(); } catch { return L; }
  return { x: L.x + v.x * 1.5, y: L.y + v.y * 1.5, z: L.z + v.z * 1.5 };
}
function emit(c, e, B, now, isPlayer) {
  const S = ST[B.st] ?? ST.rest;
  let pv = prevSt.get(B.id);
  if (!pv) { pv = { st: B.st, take: 0 }; prevSt.set(B.id, pv); }
  let n = 0;
  const wasGround = pv.st === "rest" || pv.st === "walk" || pv.st === "sneak";
  if (wasGround && (B.st === "rise" || B.st === "hover") && isPlayer) { n += takeoffBurst(c, B, now); pv.take = 12; }
  pv.st = B.st; B.take = pv.take; if (pv.take > 0) pv.take -= EVERY;
  if (B.take > 0 || (loops + B.key) % (S.ev * (FXEV[c.lv] ?? 1)) === 0) { B.gen = pv.gen = (pv.gen ?? 0) + 1; n += drawWings(c, B, now); }
  return n;
}

export function particleWingsStep() {
  const now = system.currentTick; loops++; pwStats.loops++;
  let players; try { players = world.getAllPlayers(); } catch { return; }
  if (!players.length) return;
  const done = new Set();
  for (const p of players) {
    try {
      const b = bodyInfo(p, now), near = pwNear.get(p.id), mob = near && now - near.t <= 12 && near.e?.isValid ? near.e : null;
      if (!b.on && !mob) continue;                                   // early-return: nada com asas por perto
      const c = ctx(p, 1); if (c.k <= 0) continue;
      c.pid = p.id;
      if (b.on) {
        let inv = false; try { inv = !!p.getEffect("invisibility"); } catch { /* ignore */ }
        if (!inv) {
          const B = { id: p.id, key: (p.id.length * 7 + p.id.charCodeAt(p.id.length - 1)) | 0, pos: lead(p), yaw: p.getRotation().y, tier: b.tier, lord: b.lord,
            fallen: b.fallen, angel: b.angel, pairs: b.pairs, sc: 1, st: stateOf(p, true), gen: loops };
          const k = emit(c, p, B, now, true); pwStats.calls += k; pwStats.bodies++;
        }
      }
      if (mob && !done.has(mob.id)) {
        done.add(mob.id);
        const m = MOB[mob.typeId];
        if (m) {
          // mob: 60% da densidade do jogador até 16 blocos, 40% além (só o mais perto de cada jogador)
          const L = mob.location, P = p.location, far = (L.x - P.x) ** 2 + (L.y - P.y) ** 2 + (L.z - P.z) ** 2 > 256;
          const cm = { ...c, dim: mob.dimension ?? c.dim, pwm: far ? 0.4 : 0.6 };
          const B = { id: mob.id, key: (String(mob.id).length * 13) | 0, pos: lead(mob), yaw: mob.getRotation().y, tier: m.tier, lord: m.lord, fallen: !!m.fallen,
            angel: !!m.angel, pairs: m.pairs ?? 1, sc: m.sc, st: stateOf(mob, false), gen: loops };
          const k = emit(cm, mob, B, now, false); pwStats.calls += k; pwStats.bodies++;
        }
      }
    } catch { /* efeitos nunca derrubam o laço */ }
  }
  if (loops % 200 === 0) {   // limpeza (~30 s)
    const live = new Set(players.map((p) => p.id));
    for (const id of info.keys()) if (!live.has(id)) info.delete(id);
    for (const id of pwNear.keys()) if (!live.has(id)) pwNear.delete(id);
    for (const id of liveN.keys()) if (!live.has(id)) liveN.delete(id);
    if (prevSt.size > 64) prevSt.clear();
  }
}

export function startParticleWings() {
  system.runInterval(() => { try { particleWingsStep(); } catch { /* ignore */ } }, EVERY);
}

// systems/particlewings.js - 9.5: ASAS DE PARTÍCULAS (Demônio, Lord Demônio, Anjo Caído e mobs Anjo Caído / Pico / Garasha).
// As asas desses corpos não são cubos (tools/particle_wings.py esvazia os ossos de asa): são desenhadas aqui, a cada 3 ticks, como um LEQUE
// de riscos pretos alongados (partícula etheria:wingline, billboard alinhado base->ponta, vida 0,25-0,45 s) que saem do ombro, mais
// baforadas de fumaça preta e toques vermelhos na junção com as costas. As partículas não se movem: o corpo anda e as gerações anteriores
// ficam para trás -> rastro/borrão de movimento. A forma do leque vem do ESTADO (repouso, andando, agachado, no ar, pairando, decolando,
// planando, mergulho) e de uma FASE DE BATIDA calculada pelo tempo de jogo (system.currentTick).
// Desempenho: 1 laço a cada 3 ticks; sem getEntities (o mob mais perto vem do laço de mobflight.js); no máximo 2 corpos por jogador
// (ele + 1 mob <= 48 blocos); teto por emissão escalado pelo nível de FX do jogador (fxlib.ctx) e o teto global por tick do fxlib.
import { world, system } from "@minecraft/server";
import { ctx, mote, streak, T } from "./fxlib.js";
import { getData } from "../core/db.js";
import { bodyOfStage, tierOf } from "./raceparts.js";
import { isLordStage } from "../data/races.js";
import { lineageOf } from "../data/lineages.js";
import { pwNear } from "./mobflight.js";

const EVERY = 3;                                   // ticks entre emissões
const PW_BODY = new Set(["demon", "fallen", "fallen_lord"]);
const PID = "etheria:wingline";                    // tiles: 0 lâmina · 1 borrão largo · 2 fio · 3 brasa alongada
const MOB = { "etheria:fallen_angel": { tier: 5, lord: true, fallen: true, sc: 1.2 }, "etheria:pico": { tier: 4, lord: false, fallen: true, sc: 1.0 },
  "etheria:garasha": { tier: 4, lord: false, fallen: true, sc: 1.0 } };
// estados: lo/hi = ângulos do leque (graus; 0 = para fora, 90 = para cima, negativo = para baixo) · sw = varredura para trás · amp/hz = batida
// span = envergadura relativa · frac = fração das linhas desenhadas · life = vida dos riscos (s) · ev = emite a cada ev laços · smoke = chance de baforada
const ST = {
  rest: { lo: 64, hi: 100, sw: 58, amp: 3, hz: 0.35, span: 0.82, frac: 0.34, life: 0.5, ev: 2, smoke: 0.06 },
  walk: { lo: 60, hi: 98, sw: 52, amp: 7, hz: 1.1, span: 0.85, frac: 0.4, life: 0.5, ev: 2, smoke: 0.08 },
  sneak: { lo: 74, hi: 96, sw: 76, amp: 2, hz: 0.3, span: 0.6, frac: 0.25, life: 0.5, ev: 2, smoke: 0.03 },
  air: { lo: 6, hi: 82, sw: 30, amp: 22, hz: 1.5, span: 0.95, frac: 0.6, life: 0.3, ev: 1, smoke: 0.18 },
  hover: { lo: -48, hi: 52, sw: 16, amp: 34, hz: 1.35, span: 1.0, frac: 1, life: 0.3, ev: 1, smoke: 0.3 },
  rise: { lo: -58, hi: 62, sw: 10, amp: 48, hz: 2.1, span: 1.05, frac: 1, life: 0.27, ev: 1, smoke: 0.5 },
  glide: { lo: -55, hi: 32, sw: 4, amp: 6, hz: 0.6, span: 1.18, frac: 1, life: 0.42, ev: 1, smoke: 0.14 },
  dive: { lo: -16, hi: 34, sw: 68, amp: 4, hz: 0.8, span: 0.95, frac: 0.65, life: 0.32, ev: 1, smoke: 0.08 },
};
const FLY_ST = [null, "hover", "rise", "glide", "dive"];
const COL = {
  demon: { line: [0.035, 0.02, 0.045], vein: [0.3, 0.02, 0.05], base: [0.72, 0.04, 0.08], glint: [0.85, 0.08, 0.12] },
  fallen: { line: [0.06, 0.035, 0.1], vein: [0.22, 0.08, 0.34], base: [0.62, 0.05, 0.12], glint: [0.62, 0.38, 1.0] },
};
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const hsh = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };   // ruído fixo por linha

const info = new Map();   // playerId -> { at, on, tier, lord, fallen }
const prevSt = new Map(); // id do corpo -> { st, take }
let loops = 0;
export const pwStats = { calls: 0, bodies: 0, loops: 0 };   // métrica para o simulador / modo debug

function bodyInfo(p, now) {
  let b = info.get(p.id);
  if (b && now - b.at < 100) return b;
  b = { at: now, on: false, tier: 0, lord: false, fallen: false };
  try {
    const d = getData(p);
    if (d.raceChosen) {
      const body = bodyOfStage(d.raceStage);
      let lin = null; try { lin = lineageOf(d); } catch { /* ignore */ }
      if (PW_BODY.has(body) && !lin) {
        b.on = true; b.tier = Math.max(1, tierOf(d)); b.fallen = body !== "demon";
        b.lord = isLordStage(d.raceStage ?? "") || d.raceStage === "demon_4" || body === "fallen_lord";
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

/** Desenha um par de asas. B = { pos, yaw, tier, lord, fallen, sc, st, key, gen }. Devolve o número de chamadas. */
export function drawWings(c, B, now) {
  const S = ST[B.st] ?? ST.rest, k = c.k;
  if (k <= 0) return 0;
  const air = S.ev === 1, cap = Math.max(6, Math.min(46, Math.round((air ? 26 : 10) * k) + (B.lord ? 1 : 0)));
  const yaw = B.yaw * DEG, fx = -Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;   // frente / direita do corpo
  const sc = B.sc, pal = B.fallen ? COL.fallen : COL.demon;
  const N = Math.min(14, 7 + B.tier + (B.lord ? 1 : 0));
  const reds = B.lord && S.ev === 1 ? 2 : 1;
  const wingCap = Math.floor(cap / 2);                                // teto por asa (os dois lados ficam iguais)
  const nDraw = Math.max(2, Math.min(Math.round(N * S.frac), wingCap - reds - (air ? 1 : 0)));
  const Lmax = (1.45 + 0.22 * B.tier) * sc * S.span * (B.lord ? 1.12 : 1);
  const sec = now / 20, ph = TAU * S.hz * sec + (B.key % 7);
  const take = B.take > 0, amp = S.amp * (take ? 1.25 : 1), sw0 = S.sw;
  let n = 0;
  const L = B.pos, Sy = L.y + 1.38 * sc;
  for (const sd of [1, -1]) {
    const ox = rx * sd, oz = rz * sd, n0 = n;                         // para fora deste lado
    const sh = { x: L.x + ox * 0.16 * sc - fx * 0.22 * sc, y: Sy, z: L.z + oz * 0.16 * sc - fz * 0.22 * sc };
    const dirOf = (t, lag) => {
      const s = Math.sin(ph - lag), th = (S.lo + (S.hi - S.lo) * t * (1 - 0.16 * (1 - s) * (amp > 10 ? 1 : 0)) + amp * s) * DEG;
      const be = (sw0 + amp * 0.22 * Math.cos(ph - lag)) * DEG, ct = Math.cos(th), st = Math.sin(th);
      let dx = ct * (Math.cos(be) * ox - Math.sin(be) * fx), dz = ct * (Math.cos(be) * oz - Math.sin(be) * fz), dy = st;
      dx -= fx * 0.18; dz -= fz * 0.18;                                 // leve inclinação para trás (asa atrás das costas)
      const m = Math.hypot(dx, dy, dz) || 1; return [dx / m, dy / m, dz / m];
    };
    // 1) junção vermelha com as costas (sempre primeiro: é o detalhe que identifica a raça)
    for (let r = 0; r < reds; r++) {
      const d = dirOf(0.35 + 0.3 * r, 0), ln = Lmax * (0.22 + 0.08 * r);
      streak(c, sh, { x: sh.x + d[0] * ln, y: sh.y + d[1] * ln, z: sh.z + d[2] * ln }, { pid: PID, tile: 3, col: pal.base, a: 0.95, w: 0.07 * sc, len: ln / 2, life: S.life * 0.9 }); n++;
    }
    // 2) as "penas": linhas do ombro à ponta, comprimentos crescentes do centro à ponta
    const stepI = N / nDraw;
    for (let j = 0; j < nDraw; j++) {
      const i = Math.min(N - 1, Math.floor(j * stepI + ((B.gen + (sd > 0 ? 0 : 1)) % 2) * (stepI > 1.5 ? stepI / 2 : 0)));
      const t = N > 1 ? i / (N - 1) : 0.5, d = dirOf(t, 0.55 * t);
      const ln = Lmax * (0.45 + 0.55 * Math.pow(t, 0.65)) * (0.88 + 0.24 * hsh(i, sd));
      const b0 = 0.1 * sc, a = { x: sh.x + d[0] * b0, y: sh.y + d[1] * b0, z: sh.z + d[2] * b0 };
      const tip = { x: sh.x + d[0] * ln, y: sh.y + d[1] * ln, z: sh.z + d[2] * ln };
      const vein = (B.lord && i % 4 === 2) || (!B.lord && i % 6 === 3);
      streak(c, a, tip, { pid: PID, tile: 0, col: vein ? pal.vein : pal.line, a: 1, w: (0.055 + 0.03 * t) * sc * (air ? 1 : 1.7), len: (ln - b0) / 2, life: S.life }); n++;
      // borrão: um segmento largo e translúcido na metade externa (só em voo e com orçamento sobrando; alterna entre emissões)
      if (air && n - n0 < wingCap - 1 && (i + B.gen) % 3 === 0) {
        const m0 = 0.45, p0 = { x: sh.x + d[0] * ln * m0, y: sh.y + d[1] * ln * m0, z: sh.z + d[2] * ln * m0 };
        streak(c, p0, tip, { pid: PID, tile: 1, col: pal.line, a: 0.42, w: 0.12 * sc, len: ln * (1 - m0) / 2, life: S.life * 0.8 }); n++;
      }
    }
    // 3) baforada de fumaça preta solta (mais na batida para baixo e na decolagem) e fagulhas
    const down = Math.sin(ph) < -0.3 && air && amp > 10;
    if (n - n0 < wingCap + 1 && Math.random() < (S.smoke + (down ? 0.25 : 0) + (take ? 0.5 : 0)) * Math.min(1, k)) {
      const t = 0.4 + Math.random() * 0.6, d = dirOf(t, 0.4), ln = Lmax * (0.5 + Math.random() * 0.5);
      mote(c, { x: sh.x + d[0] * ln, y: sh.y + d[1] * ln, z: sh.z + d[2] * ln }, { col: "black", tile: T.smoke, size: (0.2 + Math.random() * 0.16) * sc,
        dir: [-fx * 0.4, -0.5, -fz * 0.4], spd: 0.5, drag: 1.2, life: 0.7, grow: 0.5, a: 0.92 }); n++;
    }
    if (Math.random() < (B.lord ? 0.22 : 0.12) * Math.min(1, k)) {
      mote(c, { x: sh.x + ox * 0.1, y: sh.y + Math.random() * 0.3, z: sh.z + oz * 0.1 }, { col: pal.glint, tile: T.ember, size: 0.08 * sc, dir: [ox, 0.6, oz], spd: 0.5, drag: 1, life: 0.45, grow: -0.6 }); n++;
    }
  }
  return n;
}

/** Decolagem: explosão de fumaça preta e raios vermelhos/pretos saindo das costas (uma vez). */
export function takeoffBurst(c, B) {
  if (c.k <= 0) return 0;
  const yaw = B.yaw * DEG, fx = -Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx, sc = B.sc, pal = B.fallen ? COL.fallen : COL.demon;
  const o = { x: B.pos.x - fx * 0.3 * sc, y: B.pos.y + 1.3 * sc, z: B.pos.z - fz * 0.3 * sc };
  let n = 0;
  const nr = Math.max(3, Math.round(8 * Math.min(1.3, c.k)));
  for (let i = 0; i < nr; i++) {   // raios no plano das costas
    const a = (i / nr) * TAU + Math.random() * 0.3, ln = (2.2 + Math.random() * 1.6) * sc * (B.lord ? 1.15 : 1);
    const d = [rx * Math.cos(a) - fx * 0.25, Math.sin(a), rz * Math.cos(a) - fz * 0.25];
    streak(c, o, { x: o.x + d[0] * ln, y: o.y + d[1] * ln, z: o.z + d[2] * ln }, { pid: PID, tile: i % 2 ? 3 : 0, col: i % 2 ? pal.base : pal.line, a: 0.9, w: 0.09 * sc, len: ln / 2, life: 0.35 }); n++;
  }
  const ns = Math.max(4, Math.round(12 * Math.min(1.3, c.k)));
  for (let i = 0; i < ns; i++) {   // fumaça preta explode para os lados e para cima
    const a = Math.random() * TAU, d = [rx * Math.cos(a) - fx * 0.3, 0.3 + Math.abs(Math.sin(a)) * 0.7, rz * Math.cos(a) - fz * 0.3];
    mote(c, { x: o.x + d[0] * 0.5, y: o.y + d[1] * 0.4, z: o.z + d[2] * 0.5 }, { col: "black", tile: i % 4 ? T.smoke : T.cloud, size: (0.32 + Math.random() * 0.22) * sc,
      dir: d, spd: 2.4 + Math.random(), drag: 2.2, life: 0.9 + Math.random() * 0.4, grow: 0.9, a: 0.9 }); n++;
  }
  for (let i = 0; i < Math.round(4 * Math.min(1, c.k)) + 1; i++) {
    mote(c, o, { col: pal.glint, tile: T.ember, size: 0.12 * sc, dir: [Math.random() - 0.5, 1, Math.random() - 0.5], spd: 2, drag: 1.5, life: 0.6, grow: -0.6 }); n++;
  }
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
  if (wasGround && (B.st === "rise" || B.st === "hover") && isPlayer) { n += takeoffBurst(c, B); pv.take = 12; }
  pv.st = B.st; B.take = pv.take; if (pv.take > 0) pv.take -= EVERY;
  if (B.take > 0 || (loops + B.key) % S.ev === 0) n += drawWings(c, B, now);
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
      if (b.on) {
        let inv = false; try { inv = !!p.getEffect("invisibility"); } catch { /* ignore */ }
        if (!inv) {
          const B = { id: p.id, key: (p.id.length * 7 + p.id.charCodeAt(p.id.length - 1)) | 0, pos: lead(p), yaw: p.getRotation().y, tier: b.tier, lord: b.lord,
            fallen: b.fallen, sc: 1, st: stateOf(p, true), gen: loops };
          const k = emit(c, p, B, now, true); pwStats.calls += k; pwStats.bodies++;
        }
      }
      if (mob && !done.has(mob.id)) {
        done.add(mob.id);
        const m = MOB[mob.typeId];
        if (m) {
          // mob: densidade menor que a do jogador (0,6 até 16 blocos, 0,4 além) -> jogador + mob cabem em ~50 chamadas por emissão
          const L = mob.location, P = p.location, far = (L.x - P.x) ** 2 + (L.y - P.y) ** 2 + (L.z - P.z) ** 2 > 256;
          const cm = { ...c, dim: mob.dimension ?? c.dim, k: c.k * (far ? 0.4 : 0.6) };
          const B = { id: mob.id, key: (String(mob.id).length * 13) | 0, pos: lead(mob), yaw: mob.getRotation().y, tier: m.tier, lord: m.lord, fallen: m.fallen,
            sc: m.sc, st: stateOf(mob, false), gen: loops };
          const k = emit(cm, mob, B, now, false); pwStats.calls += k; pwStats.bodies++;
        }
      }
    } catch { /* efeitos nunca derrubam o laço */ }
  }
  if (loops % 200 === 0) {   // limpeza (~30 s)
    const live = new Set(players.map((p) => p.id));
    for (const id of info.keys()) if (!live.has(id)) info.delete(id);
    for (const id of pwNear.keys()) if (!live.has(id)) pwNear.delete(id);
    if (prevSt.size > 64) prevSt.clear();
  }
}

export function startParticleWings() {
  system.runInterval(() => { try { particleWingsStep(); } catch { /* ignore */ } }, EVERY);
}

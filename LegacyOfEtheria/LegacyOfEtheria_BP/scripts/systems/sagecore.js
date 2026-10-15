// systems/sagecore.js - GRANDE SÁBIO "VIVO": núcleo geométrico 3D (poliedro em arame + anéis orbitais + raios), máquina de estados,
// texto digitado com glitch, anúncio cinematográfico de habilidades (agrupado), cenas de evolução / Festival da Colheita / Verdadeiro Senhor Demoníaco,
// resistência à análise, Aceleração de Pensamento, Processamento Paralelo, Anulação de Canto, All of Creation e modo ocioso.
// Tudo é desenhado com partículas (fxlib) apenas enquanto há uma cena ativa; um único laço (3 ticks) renderiza e limpa sozinho.
// Visual evolui por estágio: Sábio (octaedro) · Grande Sábio (icosaedro) · Raphael (icosaedro duplo) · Ciel (dodecaedro orgânico).
// Nas cenas principais (habilidade obtida, evolução, descoberta nova, All of Creation) também surge o ANEL DE GLIFOS: uma única partícula com a imagem
// do Grande Sábio (sageRing, textura em tools/sagering.py), com fade, giro lento e ~2,6 s de vida, no máximo 1 a cada 8 s por jogador.
import { worldVoice, voiceActive } from "./worldvoice.js";
import { system, world } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { isValid } from "../core/utils.js";
import { SKILLS } from "../data/skills.js";
import { ctx, mote, streak, burst, implode, ringFlat, nn, after, T } from "./fxlib.js";
import { sageStage, sageCfg } from "./voice.js";
import { sageSnd } from "./sagecircle.js";
import { kb, kcount, stageName } from "./sageknow.js";

// ------------------------------------------------------------------ configuração (salva no jogador: d.sage)
export const DUR_LABEL = { short: "Curta", normal: "Normal", long: "Longa" };
const DUR_K = { short: 0.65, normal: 1, long: 1.5 };
const cfg = (p) => sageCfg(getData(p));
export const enabled = (p) => { try { return cfg(p).core !== false; } catch { return false; } };
export const animOn = (p) => { try { const sg = cfg(p); return sg.core !== false && sg.anim !== false && getData(p).settings.fx !== "off"; } catch { return false; } };
export const CINEMATIC_K = 1.35;   // modo cinematográfico: cenas 35% mais longas e solenes (soma-se à duração escolhida)
const durK = (p) => { const sg = cfg(p); return (DUR_K[sg.dur ?? "normal"] ?? 1) * (sg.cinematic ? CINEMATIC_K : 1); };
const lvl = (p) => { try { return getData(p).settings.fx; } catch { return "high"; } };
const stageOf = (p) => sageStage(getData(p));
const alive = (p) => { try { return p && isValid(p); } catch { return false; } };
const snd = (p, n, v = 1, pitch = 1) => sageSnd(p, n, v, pitch);
const tintN = (s) => (s <= 1 ? 0 : s - 1);

// ------------------------------------------------------------------ geometria (poliedros regulares calculados uma vez)
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function edgesOf(V) {
  let m = Infinity; for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) m = Math.min(m, Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]));
  const E = []; for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]) < m * 1.05) E.push([i, j]);
  return E;
}
const PHI = (1 + Math.sqrt(5)) / 2;
function mk(raw) { const V = raw.map(norm3); return { V, E: edgesOf(V) }; }
const GEO = {
  octa: mk([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]),
  ico: mk([[0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI], [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0], [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1]]),
  dodeca: mk([[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1], [0, 1 / PHI, PHI], [0, 1 / PHI, -PHI], [0, -1 / PHI, PHI], [0, -1 / PHI, -PHI],
    [1 / PHI, PHI, 0], [1 / PHI, -PHI, 0], [-1 / PHI, PHI, 0], [-1 / PHI, -PHI, 0], [PHI, 0, 1 / PHI], [PHI, 0, -1 / PHI], [-PHI, 0, 1 / PHI], [-PHI, 0, -1 / PHI]]),
};
const GEO_OF = [["octa"], ["octa"], ["ico"], ["ico", "ico"], ["dodeca"]];   // por estágio (índice = estágio do Sábio 0..4)

// ------------------------------------------------------------------ estados (cada um com animação própria)
export const STATES = {
  IDLE:        { spin: 0.4, amp: 0.06, freq: 1.6, edges: 0.55, rings: 1, rays: 0, rspeed: 0.5, conv: false, ringSpd: 0.4 },
  DETECTING:   { spin: 1.1, amp: 0.10, freq: 3.2, edges: 0.8, rings: 2, rays: 6, rspeed: 0.9, conv: false, ringSpd: 1.0 },
  ANALYZING:   { spin: 1.8, amp: 0.12, freq: 5.0, edges: 1, rings: 3, rays: 10, rspeed: 1.4, conv: true, ringSpd: 1.6 },
  PROCESSING:  { spin: 2.6, amp: 0.16, freq: 7.0, edges: 1, rings: 5, rays: 14, rspeed: 2.0, conv: true, ringSpd: 2.2 },
  CALCULATING: { spin: 3.4, amp: 0.18, freq: 9.0, edges: 1, rings: 5, rays: 18, rspeed: 2.8, conv: true, ringSpd: 3.0 },
  RESULT:      { spin: 0.3, amp: 0.35, freq: 2.5, edges: 1, rings: 3, rays: 12, rspeed: 1.2, conv: false, ringSpd: 0.5 },
  ARCHIVED:    { spin: 0.2, amp: 0.05, freq: 1.2, edges: 0.7, rings: 2, rays: 0, rspeed: 0.5, conv: false, ringSpd: 0.3 },
  EVOLVING:    { spin: 5.0, amp: 0.30, freq: 10, edges: 1, rings: 5, rays: 26, rspeed: 3.5, conv: true, ringSpd: 4.0 },
  FAIL:        { spin: 2.2, amp: 0.40, freq: 14, edges: 0.4, rings: 1, rays: 7, rspeed: 1.0, conv: false, ringSpd: 1.0 },
};
const RING_CAP = [2, 3, 4, 5, 5];
const COLS = [{ wire: "white", ray: "sage", ring: "sage" }, { wire: "white", ray: "sage", ring: "sage" }, { wire: "white", ray: "gold", ring: "gold" }, { wire: "white", ray: "violet", ring: "arcane" }, { wire: "white", ray: "pink", ring: "pink" }];

// ------------------------------------------------------------------ núcleos ativos
const cores = new Map();   // playerId -> { state, since, until, stage, accel, boost, phase, frame, ray, size, side }
const BAS = { r: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 1, z: 0 }, v: { x: 0, y: 0, z: 1 } };
function basis(p) {
  let v; try { v = p.getViewDirection(); } catch { return BAS; }
  let r = { x: v.z, y: 0, z: -v.x }; const l = Math.hypot(r.x, r.z) || 1; r = { x: r.x / l, y: 0, z: r.z / l };
  return { r, v, u: { x: v.y * r.z - v.z * r.y, y: v.z * r.x - v.x * r.z, z: v.x * r.y - v.y * r.x } };
}
const P3 = (o, B, a, b, d) => ({ x: o.x + B.r.x * a + B.u.x * b + B.v.x * d, y: o.y + B.r.y * a + B.u.y * b + B.v.y * d, z: o.z + B.r.z * a + B.u.z * b + B.v.z * d });

/** Liga/atualiza o núcleo. o: { stage, ticks, side, ray, size, accel, ring } (ring: true também projeta o anel de glifos; ver sageRing) */
export function coreOn(p, state = "IDLE", o = {}) {
  if (!alive(p) || !animOn(p)) return null;
  const now = system.currentTick, ex = cores.get(p.id);
  const c = ex ?? { since: now, phase: Math.random() * 6, boost: 0, frame: 0, accel: 1 };
  c.state = state; c.stage = o.stage ?? stageOf(p); c.until = now + Math.round((o.ticks ?? 100) * durK(p)); c.side = !!o.side; c.ray = o.ray; c.size = o.size; c.accel = o.accel ?? c.accel ?? 1; c.wire = o.wire;
  if (!ex) { c.since = now; cores.set(p.id, c); snd(p, `start${tintN(c.stage)}`, 0.5, 1.1); }
  if (o.ring && !o.side) sageRing(p);
  return c;
}
export function coreState(p, state, o = {}) { const c = cores.get(p.id); if (!c) return coreOn(p, state, o); c.state = state; if (o.ray !== undefined) c.ray = o.ray; if (o.accel) c.accel = o.accel; if (o.ticks) c.until = system.currentTick + Math.round(o.ticks * durK(p)); return c; }
export function coreOff(p) { cores.delete(p.id); }
export const coreActive = (p) => cores.has(p.id);
/** Estado visual do núcleo (modo debug): animação atual e quantas camadas estão ativas (núcleo, cena, texto digitado). */
export function coreInfo(p) { const c = cores.get(p.id); return { state: c?.state ?? null, stage: c?.stage ?? null, layers: (c ? 1 : 0) + (scene.has(p.id) ? 1 : 0) + (jobs.has(p.id) ? 1 : 0) }; }
/** Pulso de expansão (voz, palavra importante, conclusão). */
export function corePulse(p, power = 1) {
  const c = cores.get(p.id); if (!c) return;
  c.boost = Math.min(1.2, c.boost + 0.3 * power);
  const x = ctx(p, 1), B = basis(p), o = centerOf(p, c), col = (COLS[c.stage] ?? COLS[2]).ray;
  const n = nn(x, 14 + 6 * power);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const d = P3({ x: 0, y: 0, z: 0 }, B, Math.cos(a), Math.sin(a), 0); mote(x, o, { col, tile: T.ring, dir: [d.x, d.y, d.z], spd: 2.4 + power, size: 0.14, life: 0.45, drag: 0.1 }); }
}
function centerOf(p, c) {
  const h = p.getHeadLocation(), B = basis(p);
  if (c.side) return P3(h, B, 0.95, 0.35, 1.2);
  return P3(h, B, 0, 0.1, 3.4);
}

// renderização de 1 quadro do núcleo ----------------------------------------------------------
function draw(p, c, now) {
  const x = ctx(p, 1); if (x.k <= 0) return;
  const S = STATES[c.state] ?? STATES.IDLE, st = c.stage, cs = COLS[st] ?? COLS[2];
  const rayCol = c.ray ?? cs.ray, wire = c.wire ?? cs.wire, B = basis(p), O = centerOf(p, c);
  const t = (now - c.since) / 20 * c.accel + c.phase, jitter = c.state === "FAIL" ? (Math.random() - 0.5) * 0.5 : 0;
  const pulse = 1 + S.amp * Math.sin(t * S.freq) + c.boost; c.boost *= 0.82;
  const R = (c.size ?? (c.side ? 0.32 : 0.78)) * pulse, ang = t * S.spin + jitter;
  const lv = lvl(p); c.frame++;
  if (lv === "low" && (c.frame & 1)) return;
  // poliedro em arame (cada estágio tem o seu; Raphael tem um segundo, interno e contrário)
  GEO_OF[st].forEach((gn, gi) => {
    const g = GEO[gn], rr = R * (gi ? 0.55 : 1), a = gi ? -ang * 1.3 : ang, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(a * 0.6 + 0.5), sb = Math.sin(a * 0.6 + 0.5);
    const pts = g.V.map(([vx, vy, vz]) => { const x1 = vx * ca + vz * sa, z1 = -vx * sa + vz * ca; const y2 = vy * cb - z1 * sb, z2 = vy * sb + z1 * cb; return P3(O, B, x1 * rr, y2 * rr, z2 * rr); });
    const n = Math.max(3, Math.round(g.E.length * S.edges * Math.min(1, x.k + 0.15))), off = (c.frame * 5) % g.E.length;
    for (let k = 0; k < n; k++) { const e = g.E[(off + k) % g.E.length]; streak(x, pts[e[0]], pts[e[1]], { col: wire, w: gi ? 0.025 : 0.035, life: 0.24, a: gi ? 0.6 : 0.9, tile: T.line }); }
    if (gn === "dodeca") for (let k = 0; k < Math.min(pts.length, nn(x, 6)); k++) mote(x, pts[(k * 3 + c.frame) % pts.length], { col: "pink", tile: T.heart, size: 0.1, life: 0.3, a: 0.8 });
  });
  // brilho do núcleo
  mote(x, O, { col: "white", tile: T.star, size: 0.5 * pulse * (c.side ? 0.5 : 1), life: 0.2, a: 1 });
  if (x.k >= 0.7) mote(x, O, { col: rayCol, tile: T.orb, size: 0.9 * pulse * (c.side ? 0.5 : 1), life: 0.2, a: 0.3 });
  if (c.side) return;   // modo lateral: só poliedro + brilho
  // anéis orbitais (velocidades/sentidos/inclinações diferentes; o 5º só aparece em processamento intenso)
  const rings = Math.min(S.rings, RING_CAP[st]), heavy = ["PROCESSING", "CALCULATING", "EVOLVING"].includes(c.state);
  for (let i = 0; i < rings; i++) {
    if (i === 4 && !heavy) continue;
    const rad = R * (1.55 + 0.5 * i), tilt = [0, 1.05, -0.7, 0.45, -1.2][i], dir = i % 2 ? -1 : 1, sp = S.ringSpd * (0.5 + 0.35 * i) * dir, ct = Math.cos(tilt), stl = Math.sin(tilt);
    const pt = (th) => P3(O, B, Math.cos(th) * rad, Math.sin(th) * rad * ct, Math.sin(th) * rad * stl);
    const arcs = nn(x, 4);
    for (let k = 0; k < arcs; k++) { const th = t * sp + (k / arcs) * Math.PI * 2; streak(x, pt(th), pt(th + 0.55), { col: cs.ring, w: 0.05, life: 0.26, a: 0.85, tile: T.line }); }
    const m = nn(x, 6 + i * 2);
    for (let k = 0; k < m; k++) { const th = -t * sp * 0.6 + (k / m) * Math.PI * 2; mote(x, pt(th), { col: cs.ring, tile: k % 3 === 0 ? [T.rune1, T.rune2, T.rune3][(k / 3 | 0) % 3] : T.spark, size: k % 3 === 0 ? 0.14 : 0.09, life: 0.3, a: 0.9 }); }
  }
  // raios: expansivos ou convergindo para o núcleo (processamento de dados)
  const rays = nn(x, S.rays);
  for (let k = 0; k < rays; k++) {
    const phi = (k / rays) * Math.PI * 2 + t * 0.25, ph = (t * S.rspeed + k * 0.37) % 1;
    const dirA = P3({ x: 0, y: 0, z: 0 }, B, Math.cos(phi), Math.sin(phi), (k % 3 - 1) * 0.15), inner = R * 1.5, outer = R * (4.4 + (k % 4) * 0.6);
    const f0 = S.conv ? 1 - ph : ph, f1 = Math.min(1, f0 + 0.2), f1b = S.conv ? Math.max(0, f0 - 0.2) : f1;
    const at = (f) => ({ x: O.x + dirA.x * (inner + (outer - inner) * f), y: O.y + dirA.y * (inner + (outer - inner) * f), z: O.z + dirA.z * (inner + (outer - inner) * f) });
    streak(x, at(f0), at(S.conv ? f1b : f1), { col: rayCol, w: 0.06, life: 0.22, a: 0.8 * (1 - 0.5 * f0), tile: T.line });
  }
}

// ------------------------------------------------------------------ modo ocioso (núcleo pequeno ao lado, só quando livre)
let idleTick = 0;
function idleFrame(p) {
  const st = stageOf(p); if (st < 1 || cores.has(p.id)) return;
  const sg = cfg(p); if (sg.idle === false || !animOn(p)) return;
  const x = ctx(p, 1), lv = lvl(p); if (x.k <= 0) return;
  const B = basis(p), h = p.getHeadLocation(), O = P3(h, B, 0.95, 0.4, 0.4), t = system.currentTick / 20, cs = COLS[st] ?? COLS[2];
  const pulse = 1 + 0.12 * Math.sin(t * 1.6);
  mote(x, O, { col: "white", tile: T.star, size: 0.16 * pulse, life: 0.6, a: 0.9 });
  if (lv === "low") return;
  const g = GEO[GEO_OF[st][0]], a = t * 0.5, ca = Math.cos(a), sa = Math.sin(a), R = 0.15 * pulse;
  const pts = g.V.map(([vx, vy, vz]) => P3(O, B, (vx * ca + vz * sa) * R, vy * R, (-vx * sa + vz * ca) * R));
  const n = lv === "medium" ? 4 : Math.min(g.E.length, 10);
  for (let k = 0; k < n; k++) { const e = g.E[(idleTick * 3 + k) % g.E.length]; streak(x, pts[e[0]], pts[e[1]], { col: cs.wire, w: 0.02, life: 0.55, a: 0.55 }); }
  const th = t * 0.9; mote(x, P3(O, B, Math.cos(th) * 0.3, Math.sin(th) * 0.12, Math.sin(th) * 0.3), { col: cs.ring, tile: T.spark, size: 0.07, life: 0.6, a: 0.8 });
}

// ------------------------------------------------------------------ anel de glifos (imagem do Grande Sábio: anéis de glifos com a Terra no centro)
// Partícula etheria:sage_ring (RP/particles/sage_ring.json, gerada por tools/sagering.py): billboard grande e semitransparente, sempre voltado para
// a câmera, com fade de entrada/saída, giro lento e ~2,6 s de vida. Nasce NO MUNDO ~2,5 blocos à frente do olhar (não gruda na tela nem fica fixo)
// e só nas cenas importantes: núcleo aberto com { ring: true }, habilidade obtida, evolução, descoberta nova da análise e All of Creation.
export const RING_ID = "etheria:sage_ring";
export const RING_GAP = 160;                       // anti-spam: no máximo 1 anel a cada 8 s por jogador
export const RING_FX = ["extreme", "ultra", "high", "medium"];   // celular/"Reduzido" e "Desligado" não recebem um efeito que cobre boa parte da tela
const RING_DIST = 2.5, RING_LEAD = 1.3, RING_MAXLEAD = 4;        // distância à frente do olhar · segundos de antecipação do movimento · limite (blocos)
const ringAt = new Map();                          // playerId -> tick do último anel
/** O anel está permitido para este jogador? (interface e animações ligadas, partículas em Médio ou mais, opções "Anel de glifos" e "Partículas do Sábio" ligadas, fora do modo desempenho) */
export const ringEnabled = (p) => { try { const sg = cfg(p); return animOn(p) && sg.ring !== false && sg.parts !== false && !sg.perf && RING_FX.includes(lvl(p)); } catch { return false; } };
/** Projeta o anel de glifos à frente do olhar. Devolve true se emitiu; false se desligado, em recarga (RING_GAP) ou se o jogo recusou (chunk não carregado). */
export function sageRing(p) {
  try {
    if (!alive(p) || !ringEnabled(p)) return false;
    const now = system.currentTick, last = ringAt.get(p.id);
    if (last !== undefined && now - last < RING_GAP) return false;
    const h = p.getHeadLocation(), v = p.getViewDirection();
    let lead = 0;   // quem anda/corre: o anel nasce mais à frente, para estar a ~RING_DIST no meio da vida em vez de o jogador atravessá-lo
    try { const w = p.getVelocity(); lead = Math.max(0, Math.min(RING_MAXLEAD, (w.x * v.x + w.y * v.y + w.z * v.z) * 20 * RING_LEAD)); } catch { /* ignore */ }
    const d = RING_DIST + lead;
    p.dimension.spawnParticle(RING_ID, { x: h.x + v.x * d, y: h.y + v.y * d, z: h.z + v.z * d });
    ringAt.set(p.id, now);
    return true;
  } catch { return false; }
}

// ------------------------------------------------------------------ texto: digitado com glitch sutil
const jobs = new Map(), jobAt = new Map();
/** Há texto do Grande Sábio sendo digitado na barra de ação? (a HUD não deve sobrescrevê-lo.) Entrada velha (>45 s) é ignorada por segurança. */
export const typingActive = (p) => jobs.has(p.id) && system.currentTick - (jobAt.get(p.id) ?? 0) < 900;
const GL = "#%&$▒░?/";
const corrupt = (s) => { if (s.length < 4) return s; const i = 1 + Math.floor(Math.random() * (s.length - 2)); return s.slice(0, i) + GL[Math.floor(Math.random() * GL.length)] + s.slice(i + 1); };
/** Digita linhas progressivamente na barra de ação. o: { col, hold, cps, onDone, tail } */
export function typeText(p, lines, o = {}) {
  if (voiceActive(p)) { system.runTimeout(() => o.onDone?.(), 10); return; }
  if (!alive(p) || !animOn(p)) { try { p.onScreenDisplay.setActionBar(`${o.col ?? "§b"}${lines[lines.length - 1] ?? ""}`); } catch { /* ignore */ } system.runTimeout(() => o.onDone?.(), 10); return; }
  const id = Symbol(), col = o.col ?? "§b", cps = (o.cps ?? 1.6) / durK(p), done = [];
  jobs.set(p.id, id); jobAt.set(p.id, system.currentTick); let li = 0, ci = 0, wait = 0, glitchFrames = 0, hold = Math.round((o.hold ?? 24) * durK(p));
  const loop = system.runInterval(() => {
    if (!alive(p) || jobs.get(p.id) !== id) { system.clearRun(loop); return; }
    if (wait-- > 0) return;
    if (li >= lines.length) { if (hold-- > 0) { show(); return; } system.clearRun(loop); if (jobs.get(p.id) === id) { jobs.delete(p.id); jobAt.delete(p.id); try { p.onScreenDisplay.setActionBar(""); } catch { /* ignore */ } } o.onDone?.(); return; }
    const line = lines[li];
    ci = Math.min(line.length, ci + Math.max(1, Math.round(cps * 1.2)));
    if (ci >= line.length) { done.push(line); li++; ci = 0; wait = o.pause ?? 4; if (Math.random() < 0.35) glitchFrames = 2; }
    show(line.slice(0, ci || 1), ci >= line.length);
  }, 2);
  function show(partial, full) {
    const cur = partial ?? ""; let shown = cur;
    if (glitchFrames-- > 0 && done.length) { const last = done[done.length - 1]; shown = ""; try { p.onScreenDisplay.setActionBar(`${col}▌ ${glitchFrames % 2 ? corrupt(last) : last.slice(0, -1)}`); } catch { /* ignore */ } return; }
    const tail = done.slice(-2).map((l) => `§8${l}`).join("\n");
    try { p.onScreenDisplay.setActionBar(`${tail ? tail + "\n" : ""}${col}▌ ${shown}${full ? "" : "▌"}`); } catch { /* ignore */ }
  }
}
/** Título com entrada "de impacto": glitch → revelação com fade rápido (anúncio de nome). */
export function slam(p, title, sub = "", o = {}) {
  if (!alive(p) || voiceActive(p)) return;
  const stay = Math.round((o.stay ?? 44) * durK(p)), set = (t, s, fi, st, fo) => { try { p.onScreenDisplay.setTitle(t, { stayDuration: st, fadeInDuration: fi, fadeOutDuration: fo, subtitle: s }); } catch { /* ignore */ } };
  if (!animOn(p)) { set(title, sub, 4, stay, 10); return; }
  const c = o.col ?? "§f";
  set(`${c}§k${title.replace(/./g, "░").slice(0, Math.max(4, title.length))}`, sub ? `§8${sub.replace(/./g, "·")}` : "", 0, 3, 0);
  system.runTimeout(() => set(`${c}${corrupt(title)}`, sub, 0, 3, 0), 3);
  system.runTimeout(() => set(`${c}§l${title}`, sub ? `§7${sub}` : "", 1, stay, 12), 6);
}

// ------------------------------------------------------------------ fila de cenas (uma por vez; prioridade interrompe)
const scene = new Map();   // pid -> { prio, token }
const waiting = new Map(); // pid -> [{ prio, fn }]
function play(p, prio, fn) {
  if (!alive(p)) return;
  if (!enabled(p)) return;
  const cur = scene.get(p.id);
  if (cur && cur.prio >= prio) { const q = waiting.get(p.id) ?? []; if (q.length < 3) { q.push({ prio, fn }); waiting.set(p.id, q); } return; }
  const token = Symbol(); scene.set(p.id, { prio, token });
  let ended = false;
  const end = () => { if (ended) return; ended = true; if (scene.get(p.id)?.token === token) { scene.delete(p.id); const q = waiting.get(p.id); const nx = q?.shift(); if (nx) { system.runTimeout(() => play(p, nx.prio, nx.fn), 10); } } };
  const guard = () => alive(p) && scene.get(p.id)?.token === token;
  try { fn(end, guard); } catch { end(); }
  system.runTimeout(end, 20 * 60);   // segurança: cena nunca fica presa
}
const seq = (p, guard, steps) => steps.forEach(([t, f]) => after(t * durK(p), () => { if (guard()) f(); }));

// ------------------------------------------------------------------ API de análise (usada por sage.js)
export function coreBegin(p, label = "ANALISANDO...", state = "ANALYZING", head = "DETECÇÃO DE ALVO") {
  if (!animOn(p)) return;
  coreOn(p, "DETECTING", { ticks: 200 }); const s = stageOf(p), accel = cfg(p).mods?.accel !== false && s >= 2 ? 1.6 : 1;
  coreState(p, "DETECTING", { accel }); typeText(p, [head, label], { hold: 40, col: "§b" });
  after(14, () => { if (cores.has(p.id)) coreState(p, state); });
  if (accel > 1) after(6, () => { if (alive(p)) try { p.onScreenDisplay.setActionBar("§b▌ §fACELERAÇÃO DE PENSAMENTO"); } catch { /* ignore */ } });
}
/** Resultado: pulso, linhas reveladas progressivamente (nome, vida, resistências...) e arquivamento. rows: ["NOME: ...", ...] */
export function coreResult(p, rows = [], opt = {}) {
  if (!alive(p)) return;
  if (!animOn(p)) { return; }
  coreState(p, "RESULT", { ticks: 40 + rows.length * 14, accel: 1 }); corePulse(p, 1.5); snd(p, `done${tintN(stageOf(p))}`, 0.7);
  const known = opt.known;
  if (!known) sageRing(p);   // descoberta nova (criatura, item, habilidade ou magia ainda não registrada): o anel aparece; repetição não
  typeText(p, [known ? "DADOS RECUPERADOS." : "RESULTADO OBTIDO", ...rows.slice(0, 7), "ANÁLISE CONCLUÍDA."], { hold: 26, col: "§b", onDone: () => { if (cores.has(p.id)) { coreState(p, "ARCHIVED", { ticks: 30 }); after(30, () => coreOff(p)); } } });
}
export function coreFail(p) {
  if (!alive(p)) return;
  coreOn(p, "FAIL", { ticks: 70, ray: "blood" }); snd(p, "proc", 0.6, 0.6); try { p.playSound("etheria.sage.sfx.fail", { volume: 0.8 }); } catch { /* ignore */ }
  typeText(p, ["ANÁLISE INSUFICIENTE.", "O ALVO RESISTIU À ANÁLISE."], { col: "§c", hold: 30, onDone: () => after(4, () => coreOff(p)) });
  for (let i = 0; i < 4; i++) after(i * 6, () => { const c = cores.get(p.id); if (c) { c.boost += 0.25; c.state = i % 2 ? "FAIL" : "DETECTING"; } });
}
/** O alvo é muito superior? Evita revelar tudo de imediato (nunca bloqueia: após 2 tentativas a análise passa). */
export function resistsAnalysis(p, target, power) {
  try {
    const sg = cfg(p), s = stageOf(p), id = target.typeId; sg.res ??= {};
    if (sg.archive?.[id] || (sg.res[id] ?? 0) >= 2) return false;
    const chance = power >= 3 ? (s >= 3 ? 0 : s === 2 ? 0.35 : 0.8) : power === 2 ? (s >= 1 ? 0 : 0.45) : 0;
    if (Math.random() < chance) { sg.res[id] = (sg.res[id] ?? 0) + 1; markDirty(p); return true; }
  } catch { /* ignore */ }
  return false;
}

// ------------------------------------------------------------------ anúncio de habilidades (agrupado)
const CLS = (id) => {
  const sk = SKILLS[id]; if (!sk) return { k: "HABILIDADE", c: "§f", n: 0 };
  if (sk.rarity === "divine" || sk.cat === "Ultimate") return { k: "HABILIDADE ÚLTIMA", c: "§b", n: 4 };
  if (sk.cat === "Única") return { k: "HABILIDADE ÚNICA", c: "§6", n: 3 };
  if (sk.cat === "Racial" || sk.cat === "Intrínseca") return { k: "HABILIDADE INTRÍNSECA", c: "§a", n: 1 };
  if (sk.cat === "Magia") return { k: "ESTRUTURA MÁGICA", c: "§d", n: 2 };
  if (sk.cat === "Extra" || ["rare", "epic", "legendary", "mythic"].includes(sk.rarity)) return { k: "HABILIDADE EXTRA", c: "§e", n: 2 };
  return { k: "HABILIDADE COMUM", c: "§f", n: 0 };
};
const buf = new Map();   // pid -> { ids, timer }
export function queueSkillAnnounce(p, id) {
  if (!alive(p) || !enabled(p)) return;
  const b = buf.get(p.id) ?? { ids: [], timer: 0 }; if (!b.ids.includes(id)) b.ids.push(id);
  if (b.timer) system.clearRun(b.timer);
  b.timer = system.runTimeout(() => { buf.delete(p.id); announceSkills(p, b.ids); }, 24);   // agrupa tudo recebido em ~1s
  buf.set(p.id, b);
}
export function announceSkills(p, ids) {
  ids = ids.filter((i) => SKILLS[i]); if (!ids.length) return;
  play(p, 3, (end, ok) => {
    const s = stageOf(p), t = tintN(s), many = ids.length > 1, top = ids.map(CLS).sort((a, b) => b.n - a.n)[0], x = ctx(p, 1.5);
    if (!animOn(p)) { for (const i of ids) { try { p.sendMessage(`${CLS(i).c}[${CLS(i).k}] §f${SKILLS[i].name}`); } catch { /* ignore */ } } end(); return; }
    { // Voz do Mundo: título + categorias + nomes, um a um
      const groups = []; for (const i of ids.slice(0, 12)) { const c = CLS(i); let g = groups.find((x) => x.header === c.k); if (!g) groups.push(g = { header: c.k, col: c.c, n: c.n, items: [], snd: c.n >= 4 ? "etheria.sage.tier.ultimate" : c.n >= 3 ? "etheria.sage.tier.unique" : c.n === 1 ? "etheria.sage.tier.intrinsic" : c.n === 2 ? "etheria.sage.tier.extra" : "etheria.sage.tier.common" }); g.items.push(SKILLS[i].name); }
      groups.sort((a, b) => b.n - a.n);
      worldVoice(p, { theme: s >= 4 ? "ciel" : s >= 3 ? "raphael" : "sage", title: `${top.c}§l${many ? "HABILIDADES ADQUIRIDAS" : SKILLS[ids[0]].name.toUpperCase()}`, narration: [many ? "Confirmado. Relatando as habilidades adquiridas." : "Confirmado. Nova habilidade adquirida."], groups });
    }
    const dark = ["ultra", "extreme"].includes(lvl(p)) && cfg(p).filter !== false;
    if (dark) { try { p.addEffect("darkness", Math.round(110 * durK(p)), { amplifier: 0, showParticles: false }); } catch { /* ignore */ } }
    coreOn(p, "DETECTING", { ticks: 180 + ids.length * 40, ray: top.n >= 3 ? "gold" : undefined, ring: true }); snd(p, `start${t}`, 0.7);   // habilidade obtida: o anel surge com o núcleo
    const steps = [
      [4, () => { coreState(p, "ANALYZING"); snd(p, "layer1", 0.4); }],
      [10, () => typeText(p, [many ? "PROCESSANDO NOVAS HABILIDADES..." : "NOVA HABILIDADE DETECTADA."], { col: "§b", hold: 10, cps: 2 })],
      [24, () => { coreState(p, "PROCESSING"); snd(p, "proc", 0.5); }],
    ];
    let T0 = 40;
    ids.slice(0, 6).forEach((id, i) => {
      const cl = CLS(id), name = SKILLS[id].name;
      steps.push([T0, () => { coreState(p, "CALCULATING"); typeText(p, [many ? `${cl.k}` : "PROCESSANDO ESTRUTURA..."], { col: cl.c, hold: 4, cps: 2.2 }); }]);
      steps.push([T0 + 12, () => { slam(p, name.toUpperCase(), cl.k, { col: cl.c, stay: 40 }); coreState(p, "RESULT"); corePulse(p, 1.4 + cl.n * 0.3); snd(p, cl.n >= 3 ? "evo1" : "react", 0.8, 1 + cl.n * 0.06); try { p.playSound(cl.n >= 3 ? "random.levelup" : "note.bell", { volume: 0.7, pitch: 0.8 + cl.n * 0.1 }); } catch { /* ignore */ } burst(x, { x: p.location.x, y: p.location.y + 1.6, z: p.location.z }, { col: cl.n >= 3 ? "gold" : "sage", tile: T.star, n: 8 + cl.n * 4, spd: 2.4, size: 0.2, life: 0.7, up: 1 }); }]);
      T0 += 52;
    });
    steps.push([T0, () => { typeText(p, [many ? `${ids.length} HABILIDADES REGISTRADAS.` : "HABILIDADE REGISTRADA."], { col: "§a", hold: 14, cps: 2 }); coreState(p, "ARCHIVED"); }]);
    steps.push([T0 + 36, () => { coreOff(p); if (dark) { try { p.removeEffect("darkness"); } catch { /* ignore */ } } end(); }]);
    seq(p, ok, steps);
    after((T0 + 60) * durK(p), () => { if (dark) { try { p.removeEffect("darkness"); } catch { /* ignore */ } } });
  });
}

// ------------------------------------------------------------------ evolução de raça: padrão · Festival da Colheita · Verdadeiro Senhor Demoníaco
const TDL = (id) => /^demon_4$/.test(id) || /_ld$/.test(id);   // LORD DEMÔNIO: cerimônia especial (sangue, distorção e som próprio)
export function evolutionScene(p, stage) {
  if (!alive(p) || !enabled(p)) return;
  const id = stage?.id ?? "", big = /_(3[ab]|4)$/.test(id) || /_ld$/.test(id), tdl = TDL(id), name = (stage?.name ?? "EVOLUÇÃO").toUpperCase();
  play(p, 5, (end, ok) => {
    const s = stageOf(p), x = ctx(p, 2.5), at = () => ({ x: p.location.x, y: p.location.y + 1.2, z: p.location.z });
    if (!animOn(p)) { slam(p, name, "EVOLUÇÃO CONFIRMADA"); end(); return; }
    worldVoice(p, tdl ? { theme: "world", title: "§c§lVERDADEIRO LORDE DEMÔNIO", sound: "etheria.sage.ceremony.true_demon_lord", narration: ["O Festival da Colheita está completo.", "O indivíduo designado, o hospedeiro, despertou como Verdadeiro Lorde Demônio.", "Confirmados o aumento de todos os valores de habilidade e a evolução dos subordinados.", "Continuando, relatarei as habilidades adquiridas."] }
      : { theme: big ? "world" : "tree", title: `§6§l${name}`, sound: big ? "etheria.sage.ceremony.harvest_festival" : undefined, narration: big ? ["Condições de evolução confirmadas.", "O Festival da Colheita começou.", `Evolução para ${stage?.name ?? "a nova forma"} concluída.`] : ["Condições de evolução confirmadas.", `Evolução para ${stage?.name ?? "a nova forma"} concluída.`] });
    coreOn(p, "DETECTING", { ticks: 420, ray: tdl ? "blood" : undefined, size: tdl ? 1.0 : undefined, ring: true });   // 1º anel na abertura; o 2º (anti-spam de 8 s) no momento do núcleo exposto
    const L = [
      [4, () => typeText(p, ["CONDIÇÕES DE EVOLUÇÃO DETECTADAS."], { col: tdl ? "§c" : "§b", hold: 14 })],
      [34, () => { coreState(p, "PROCESSING"); typeText(p, ["INICIANDO PROCESSAMENTO..."], { col: tdl ? "§c" : "§b", hold: 10 }); snd(p, "proc", 0.6); }],
      [60, () => { coreState(p, "EVOLVING", { accel: 1.4 }); typeText(p, ["STATUS", "HABILIDADES", "ESTRUTURA MÁGICA", "RAÇA", "ENERGIA", "EVOLUÇÃO"], { col: "§e", cps: 2.2, pause: 6, hold: 6 }); snd(p, "evo1", 0.7); }],
      [118, () => { typeText(p, ["SOLICITAÇÃO DE EVOLUÇÃO."], { col: "§6", hold: 22 }); implode(x, at(), { col: tdl ? "blood" : "gold", tile: T.diamond, n: 22, radius: 4, life: 0.8 }); }],
      [142, () => { try { p.onScreenDisplay.setActionBar(""); } catch { /* ignore */ } coreState(p, "ARCHIVED"); }],             // pausa dramática / silêncio curto
      [158, () => { typeText(p, ["EVOLUÇÃO AUTORIZADA."], { col: "§a", hold: 12, cps: 2.4 }); corePulse(p, 2); snd(p, "react", 1, 0.8); }],
      [172, () => { // fragmentos se afastam do núcleo → núcleo exposto
        burst(x, at(), { col: tdl ? "blood" : "gold", tile: T.shard, n: 30, spd: 5, size: 0.3, life: 1.0 }); ringFlat(x, p.location, { col: "white", tile: T.diamond, n: 24, radius: 5, life: 0.8 }); coreState(p, "RESULT"); corePulse(p, 2.5); sageRing(p); }],
      [200, () => { coreState(p, "EVOLVING", { accel: 2 }); implode(x, at(), { col: tdl ? "blood" : "arcane", tile: T.star, n: 28, radius: 5, life: 0.9 }); snd(p, "evo3", 0.8); }],   // nova estrutura se forma
    ];
    let t = 226;
    if (big) { L.push([t, () => slam(p, "FESTIVAL DA COLHEITA", "", { col: "§6", stay: 46 })]); t += 56; }
    L.push([t, () => { slam(p, "EVOLUÇÃO CONFIRMADA", "", { col: "§e", stay: 36 }); corePulse(p, 2); snd(p, "evo1", 1, 1.1); }]); t += 48;
    L.push([t, () => { slam(p, tdl ? "LORD DEMÔNIO" : name, tdl ? "STATUS: LORD DEMÔNIO" : "STATUS", { col: tdl ? "§4" : "§6", stay: tdl ? 70 : 50 }); coreState(p, "RESULT"); corePulse(p, 3.5);
      burst(x, at(), { col: tdl ? "blood" : "gold", tile: T.star, n: 40, spd: 6, size: 0.32, life: 1.1 }); ringFlat(x, p.location, { col: tdl ? "blood" : "gold", tile: T.ring, n: 32, radius: 8, life: 1 }); if (tdl) try { p.playSound("mob.wither.spawn", { volume: 0.5, pitch: 0.6 }); } catch { /* ignore */ } }]); t += tdl ? 90 : 62;
    L.push([t, () => { typeText(p, ["ANÁLISE COMPLETA."], { col: "§b", hold: 12 }); coreState(p, "ARCHIVED"); }]);
    L.push([t + 34, () => { coreOff(p); end(); }]);
    seq(p, ok, L);
  });
}

// evolução do PRÓPRIO Sábio (complementa evolveSequence do sagecircle): textos + núcleo em intensidade máxima
export function sageEvolveScene(p, to) {
  if (!alive(p) || !animOn(p)) return;
  const cur = stageName(to - 1).toUpperCase(), nxt = ({ 2: "GRANDE SÁBIO", 3: "REI DA SABEDORIA RAPHAEL", 4: "MANAS CIEL" })[to] ?? stageName(to).toUpperCase();
  play(p, 6, (end, ok) => {
    worldVoice(p, { theme: to >= 4 ? "ciel" : to >= 3 ? "raphael" : "sage", title: `${to >= 4 ? "§d" : to >= 3 ? "§6" : "§b"}§l${nxt}`, sound: to >= 3 ? "etheria.sage.ceremony.demon_lord_seed" : undefined,
      narration: ["Evolução da habilidade detectada.", `Estrutura existente: ${cur}.`, `A habilidade evoluiu para ${nxt}.`] });
    coreOn(p, "PROCESSING", { stage: Math.max(0, to - 1), ticks: 260 });
    seq(p, ok, [
      [2, () => typeText(p, ["EVOLUÇÃO DA HABILIDADE DETECTADA.", "PROCESSANDO..."], { col: "§e", hold: 4 })],
      [40, () => { coreState(p, "CALCULATING"); typeText(p, [`ESTRUTURA EXISTENTE: ${cur}`, "NOVA ESTRUTURA COMPATÍVEL:", nxt], { col: "§d", pause: 8, hold: 10 }); }],
      [100, () => coreState(p, "EVOLVING", { accel: 1.8 })],
      [150, () => { coreOn(p, "RESULT", { stage: to, ticks: 90, ring: true }); corePulse(p, 3); slam(p, nxt, "EVOLUÇÃO CONCLUÍDA", { col: "§d", stay: 50 }); }],   // nova estrutura revelada: o anel
      [200, () => { coreState(p, "ARCHIVED"); }],
      [230, () => { coreOff(p); end(); }],
    ]);
  });
}

// ------------------------------------------------------------------ módulos do Grande Sábio (cenas curtas)
export function sceneAccel(p) {
  play(p, 2, (end, ok) => { coreOn(p, "ANALYZING", { ticks: 80, accel: 2.4 }); snd(p, "layer4", 0.5, 1.3); seq(p, ok, [[2, () => typeText(p, ["ACELERAÇÃO DE PENSAMENTO ATIVADA.", "VELOCIDADE DE PROCESSAMENTO ×3"], { col: "§b", cps: 2.4, hold: 14 })], [20, () => corePulse(p, 1)], [70, () => { coreOff(p); end(); }]]); });
}
export function sceneParallel(p, labels = ["ANÁLISE", "COMBATE", "AMBIENTE", "SKILL"]) {
  play(p, 2, (end, ok) => {
    coreOn(p, "PROCESSING", { ticks: 110 }); snd(p, "proc", 0.5);
    const x = ctx(p, 1), B = basis(p);
    labels.forEach((l, i) => after((6 + i * 9) * durK(p), () => { if (!ok()) return;
      const c = cores.get(p.id); if (!c) return; const O = centerOf(p, c), a = (i / labels.length) * Math.PI * 2 + Math.PI / 4, S = P3(O, basis(p), Math.cos(a) * 1.6, Math.sin(a) * 1.1, 0);
      for (let k = 0; k <= 8; k++) { const f = k / 8; mote(x, { x: S.x + (O.x - S.x) * f, y: S.y + (O.y - S.y) * f, z: S.z + (O.z - S.z) * f }, { col: "sage", tile: T.spark, size: 0.08, life: 0.9, a: 0.9 }); }
      burst(x, S, { col: "white", tile: T.orb, n: 3, spd: 0.4, size: 0.18, life: 0.9 }); snd(p, `layer${i}`, 0.3, 1.1);
      try { p.onScreenDisplay.setActionBar(`§b▌ ${labels.slice(0, i + 1).map((q) => `§f[${q}]`).join(" ")}`); } catch { /* ignore */ } }));
    seq(p, ok, [[labels.length * 9 + 14, () => typeText(p, ["PROCESSAMENTO PARALELO ATIVO."], { col: "§b", hold: 12 })], [100, () => { coreOff(p); end(); }]]);
  });
}
export function sceneChant(p, spellName = "") {
  play(p, 2, (end, ok) => {
    coreOn(p, "RESULT", { ticks: 70, ray: "violet" }); snd(p, "react", 0.7, 1.4);
    const x = ctx(p, 1.2), B = basis(p);
    seq(p, ok, [[2, () => typeText(p, ["PROCESSAMENTO DIRETO DISPONÍVEL.", spellName ? `ANULAÇÃO DE CANTO: ${spellName.toUpperCase()}` : "ANULAÇÃO DE CANTO"], { col: "§d", hold: 12 })],
      [10, () => { const c = cores.get(p.id); if (!c) return; const O = centerOf(p, c); for (let i = 0; i < 6; i++) streak(x, O, P3(O, B, 0, 0, 5 + i * 0.6), { col: "violet", w: 0.07, life: 0.4, a: 0.9 }); corePulse(p, 1.6); }],
      [64, () => { coreOff(p); end(); }]]);
  });
}
export function sceneCreation(p) {
  play(p, 2, (end, ok) => {
    const d = getData(p), k = kb(d), n = (c) => Object.keys(k[c] ?? {}).length;
    coreOn(p, "CALCULATING", { ticks: 160, ring: true }); snd(p, "capture", 0.7);
    const rows = [["HABILIDADES", n("skills")], ["MAGIAS", n("magic")], ["CRIATURAS", n("creatures")], ["MATERIAIS", n("materials")], ["ITENS", n("items") + n("weapons")]];
    seq(p, ok, [[2, () => typeText(p, ["ALL OF CREATION: ACESSO AO CONHECIMENTO", ...rows.map(([a, b]) => `${a} → ${b} registros`), `TOTAL: ${kcount(d)} REGISTROS`], { col: "§e", cps: 2.2, pause: 3, hold: 20 })],
      [14, () => { const x = ctx(p, 1.5); const c = cores.get(p.id); if (c) { const O = centerOf(p, c), B = basis(p); rows.forEach((_, i) => { const a = (i / rows.length) * Math.PI * 2; const S = P3(O, B, Math.cos(a) * 2.4, Math.sin(a) * 1.6, 0); streak(x, S, O, { col: ["gold", "violet", "sage", "steel", "white"][i], w: 0.05, life: 0.9, a: 0.9 }); burst(x, S, { col: "white", tile: T.star, n: 3, spd: 0.6, size: 0.15, life: 0.8 }); }); } corePulse(p, 1.2); }],
      [150, () => { coreOff(p); end(); }]]);
  });
}
export function coreAlert(p, kind = "info") {
  if (!animOn(p)) return;
  const ray = kind === "danger" ? "blood" : kind === "boss" ? "violet" : "gold";
  const ex = cores.get(p.id); if (ex && ex.until - system.currentTick > 30) return;
  coreOn(p, kind === "info" ? "DETECTING" : "FAIL", { ticks: 36, ray, side: lvl(p) === "low" }); corePulse(p, 1); snd(p, kind === "danger" ? "proc" : "mini", 0.6, kind === "danger" ? 0.7 : 1.2);
}

// ------------------------------------------------------------------ menu "Sistemas visuais"
import { menu as baseMenu, sageThemeOf } from "./ui/forms.js";
const menu = (p, t, b, B) => baseMenu(p, t, b, B, sageThemeOf(sageStage(getData(p))));
import { FX_LEVELS, FX_LABELS } from "../config.js";
export function openCoreSettings(p, back) {
  const d = getData(p), sg = cfg(p), st = d.settings, onoff = (v) => (v ? "§aLIGADO" : "§cDESLIGADO");
  const tg = (key, label) => ({ text: `§l${label}: ${onoff(sg[key] !== false)}`, icon: "menu_settings", run: () => { sg[key] = sg[key] === false; markDirty(p); openCoreSettings(p, back); } });
  menu(p, "§l§bNÚCLEO DO GRANDE SÁBIO", "§7Interface viva: núcleo 3D, anéis, raios, texto animado e cenas.\n§8Tudo é salvo no seu personagem.", [
    tg("core", "Grande Sábio (interface)"), tg("anim", "Animações"), tg("idle", "Núcleo em espera"), tg("filter", "Filtro de tela nas cenas"), tg("ring", "Anel de glifos (imagem)"),
    { text: `§lVoz: ${onoff(sg.voice !== false)}`, icon: "menu_settings", run: () => { sg.voice = sg.voice === false; markDirty(p); openCoreSettings(p, back); } },
    { text: `§lPartículas: §f${FX_LABELS[st.fx] ?? st.fx}\n§r§8toque para alternar`, icon: "menu_settings", run: () => { st.fx = FX_LEVELS[(FX_LEVELS.indexOf(st.fx) + 1) % FX_LEVELS.length]; markDirty(p); openCoreSettings(p, back); } },
    { text: `§lDuração da interface: §f${DUR_LABEL[sg.dur ?? "normal"]}`, icon: "menu_settings", run: () => { sg.dur = ({ short: "normal", normal: "long", long: "short" })[sg.dur ?? "normal"]; markDirty(p); openCoreSettings(p, back); } },
    { text: "§lDemonstrar: Aceleração de Pensamento", icon: "menu_skills", run: () => { sceneAccel(p); } },
    { text: "§lDemonstrar: Processamento Paralelo", icon: "menu_skills", run: () => { sceneParallel(p); } },
    { text: "§lDemonstrar: Anulação de Canto", icon: "menu_skills", run: () => { sceneChant(p); } },
    { text: "§lDemonstrar: All of Creation", icon: "menu_skills", run: () => { sceneCreation(p); } },
    { text: "§lVoltar", run: () => back?.() },
  ]);
}

// ------------------------------------------------------------------ laços (um só, com limpeza)
export function dropCore(id) { cores.delete(id); jobs.delete(id); jobAt.delete(id); scene.delete(id); waiting.delete(id); ringAt.delete(id); const b = buf.get(id); if (b?.timer) system.clearRun(b.timer); buf.delete(id); }
let started = false;
export function startSageCore() {
  if (started) return; started = true;
  system.runInterval(() => {
    const now = system.currentTick;
    for (const [id, c] of cores) {
      const p = world.getAllPlayers().find((q) => q.id === id);
      if (!p || !alive(p) || now > c.until) { cores.delete(id); continue; }
      try { draw(p, c, now); } catch { cores.delete(id); }
    }
  }, 3);
  system.runInterval(() => { idleTick++; for (const p of world.getAllPlayers()) { try { idleFrame(p); } catch { /* ignore */ } } }, 10);
}

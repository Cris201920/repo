// systems/sagecircle.js - Manifestação visual do Sábio / Grande Sábio / Raphael / Ciel.
// NÃO é só partícula: combina camadas texturizadas independentes (cada uma com rotação/pulso próprios), uma ENTIDADE geométrica animada
// (placas em planos diferentes), planos verticais (profundidade), partículas orbitais, sons por camada, UI e reação à voz.
// Níveis: ultra (tudo) · high · medium · low (simplificado) · off. Tudo é ativado só quando necessário e removido ao concluir.
import { system } from "@minecraft/server";
import { getData } from "../core/db.js";
import { isValid, playSound } from "../core/utils.js";
import { ctx, layer, mote, burst, implode, ringFlat, column, helix, after, T, PAL } from "./fxlib.js";
import { sageStage, sageCfg } from "./voice.js";

export const L = { core: 0, glyph: 1, cells: 2, text: 3, scale: 4, band: 5, distort: 6, lattice: 7, cielCore: 8, cielRing: 9, mini: 10, data: 11, spell: 12, skillhex: 13, scan: 14, sigil: 15 };
// cor por estágio (0 Sábio · 1 Grande Sábio · 2 Raphael · 3 Ciel)
const TINT = [[0.55, 1, 0.92], [1, 0.9, 0.55], [0.75, 0.55, 1], [1, 0.72, 0.9]];
export const tintOf = (stage) => Math.max(0, Math.min(3, stage <= 1 ? 0 : stage - 1));
const SND = (n) => `etheria.sagefx.${n}`;

// plano de camadas: [tile, tamanho(×base), rot(°/s), instante de surgimento (0..1), alpha, extra]
const PLAN = [
  [[L.sigil, 0.55, 22, 0, 0.9], [L.cells, 0.95, 34, 0.25, 0.8], [L.scale, 1.2, -18, 0.5, 0.75]],
  [[L.core, 0.42, 0, 0, 1, { amp: 0.06, freq: 1.2 }], [L.glyph, 0.8, -52, 0.10, 0.9], [L.cells, 1.0, 38, 0.22, 0.85], [L.text, 1.2, -24, 0.34, 0.8],
    [L.scale, 1.4, 17, 0.46, 0.8], [L.band, 1.65, -11, 0.58, 0.7], [L.distort, 1.85, 9, 0.7, 0.45, { grow: 0.08 }]],
  [[L.core, 0.40, 0, 0, 1, { amp: 0.09, freq: 1.8 }], [L.lattice, 0.9, 58, 0.08, 0.85], [L.glyph, 0.78, -70, 0.14, 0.9], [L.cells, 1.0, 46, 0.24, 0.85], [L.data, 1.22, -42, 0.34, 0.8],
    [L.text, 1.35, -28, 0.44, 0.8], [L.spell, 0.62, 96, 0.52, 0.75], [L.scale, 1.58, 21, 0.60, 0.8], [L.band, 1.85, -13, 0.68, 0.7], [L.scan, 1.5, 170, 0.76, 0.55], [L.distort, 2.05, 12, 0.82, 0.5, { grow: 0.1 }]],
  [[L.cielCore, 0.46, 0, 0, 1, { amp: 0.12, freq: 1.1 }], [L.cielRing, 0.9, 26, 0.1, 0.9, { amp: 0.03, freq: 0.7 }], [L.cells, 1.0, 22, 0.2, 0.7], [L.text, 1.2, -17, 0.3, 0.75],
    [L.cielRing, 1.5, -34, 0.4, 0.85, { amp: 0.04, freq: 0.9 }], [L.scale, 1.4, 14, 0.5, 0.7], [L.lattice, 1.7, 13, 0.6, 0.55], [L.distort, 2.0, 7, 0.7, 0.5, { grow: 0.07 }]],
];
const active = new Map();   // playerId -> { until, ent, kind, pos, stage, id }
const lastHalo = new Map();

export const circleActive = (p) => active.has(p.id);
const lvOf = (p) => { try { const v = getData(p).settings.fx; return v === "extreme" ? "ultra" : v; } catch { return "high"; } };
const cap = (lv) => ({ ultra: 99, high: 8, medium: 4, low: 2, off: 0 }[lv] ?? 4);
function snd(p, name, vol = 1, pitch = 1) {
  try { const sg = sageCfg(getData(p)); if (sg.sfx === false || sg.volume <= 0) return; p.playSound(SND(name), { volume: vol * Math.max(0.15, sg.volume / 100), pitch }); } catch { /* ignore */ }
}
export { snd as sageSnd };

/** Posição na frente do jogador + plano vertical que mais encara a câmera. */
export function frontOf(p, dist = 2.6, up = 1.1) {
  const v = p.getViewDirection(), h = Math.hypot(v.x, v.z) || 1, l = p.location;
  const plane = Math.abs(v.z) / h > Math.abs(v.x) / h ? "xy" : "yz";
  return { pos: { x: l.x + (v.x / h) * dist, y: l.y + up, z: l.z + (v.z / h) * dist }, plane };
}

function spawnEntity(p, pos, tint, size) {
  const lv = lvOf(p);
  if (lv !== "ultra") return null;
  try {
    const e = p.dimension.spawnEntity("etheria:sage_circle", { x: pos.x, y: pos.y + 0.03, z: pos.z });
    e.triggerEvent(`etheria:v${tint}`); e.triggerEvent(size > 3.2 ? "etheria:size_large" : size < 1.6 ? "etheria:size_small" : "etheria:size_medium");
    try { e.setRotation({ x: 0, y: p.getRotation().y }); } catch { /* ignore */ }
    return e;
  } catch { return null; }
}
const killEnt = (e) => { try { if (e && isValid(e)) e.triggerEvent("etheria:despawn"); } catch { try { e?.remove(); } catch { /* ignore */ } } };

/**
 * Círculo de análise completo (camadas independentes + entidade + órbitas + sons).
 * o: { stage, kind:'analysis'|'spell'|'skill'|'item'|'idle', power(0..3), dur(ticks), size(blocos), col, plane, onDone, label }
 */
export function playCircle(player, center, o = {}) {
  const lv = lvOf(player), stage = o.stage ?? sageStage(getData(player)), tint = tintOf(stage), dur = Math.max(20, o.dur ?? 60);
  const power = Math.max(0, Math.min(3, o.power ?? 1)), base = (o.size ?? 3.2), col = o.col ?? TINT[tint], plane = o.plane ?? "xz";
  const done = () => { try { o.onDone?.(); } catch { /* ignore */ } };
  if (lv === "off") { system.runTimeout(done, dur); return null; }
  if (active.has(player.id)) { const a = active.get(player.id); if (a.until > system.currentTick) { system.runTimeout(done, dur); return null; } }
  const c = ctx(player, 1 + power * 0.3), me = { until: system.currentTick + dur + 12, kind: o.kind ?? "analysis", pos: center, stage, ent: null };
  active.set(player.id, me);
  const plan = PLAN[tint].slice(0, cap(lv)), flat = plane === "xz";
  const rise = (i) => (flat ? 0.04 * i : 0);
  // início: som de ativação + zumbido do estágio
  snd(player, `start${tint}`, 0.9); after(6, () => snd(player, `hum${tint}`, 0.5));
  // camadas: cada uma surge no seu momento, com giro/pulso próprios
  plan.forEach((ly, i) => {
    const [tile, sz, rot, at, al, ex] = ly;
    after(at * dur, () => {
      const left = (dur * (1 - at) + 12) / 20, k = (0.55 + 0.25 * power) * (tile === L.core || tile === L.cielCore ? 1 : 1);
      const sizeK = tile === L.core || tile === L.cielCore ? 0.7 + 0.5 * power : 1;
      layer(c, center, { tile, size: base * sz * sizeK * (flat ? 1 : 0.9), rot: rot * (1 + 0.15 * power), life: left, a: al, plane, y: (o.y ?? 0.05) + rise(i), col, ...(ex ?? {}) });
      snd(player, `layer${i % 9}`, 0.35, 0.9 + 0.04 * i);
      // profundidade (ultra): cópias em alturas diferentes + plano vertical atrás/à frente
      if (lv === "ultra" && flat && i > 0 && i < 6 && i % 2 === 1) layer(c, center, { tile, size: base * sz * 0.82, rot: -rot * 1.3, life: left, a: al * 0.5, y: 0.5 + i * 0.12, col, ...(ex ?? {}) });
    });
  });
  // planos verticais (frente/atrás do jogador) — high+ e apenas em círculos de pessoa/analise
  if (flat && (lv === "high" || lv === "ultra") && stage >= 2) {
    const f = frontOf(player, 3.2, 1.3);
    after(0.5 * dur, () => { layer(c, f.pos, { tile: stage >= 4 ? L.cielRing : L.glyph, size: base * 0.9, rot: 40, life: (dur * 0.5 + 12) / 20, a: 0.7, plane: f.plane, y: 0, col }); });
    if (lv === "ultra") after(0.6 * dur, () => { const l = player.location; layer(c, { x: l.x - (f.pos.x - l.x) * 0.7, y: l.y + 1.3, z: l.z - (f.pos.z - l.z) * 0.7 }, { tile: L.text, size: base * 0.8, rot: -35, life: (dur * 0.4 + 12) / 20, a: 0.55, plane: f.plane, y: 0, col }); });
  }
  // Raphael: múltiplos núcleos orbitando; Ciel: núcleo orgânico pulsante extra
  if (stage >= 3 && lv !== "low") after(0.15 * dur, () => {
    const n = stage >= 4 ? 2 : 3;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; layer(c, { x: center.x + Math.cos(a) * base * 0.55, y: center.y, z: center.z + Math.sin(a) * base * 0.55 }, { tile: stage >= 4 ? L.cielCore : L.core, size: base * 0.22, rot: 0, life: (dur * 0.85 + 12) / 20, a: 0.9, amp: 0.15, freq: 1.5 + k * 0.4, col, y: 0.12 }); }
  });
  // entidade geométrica (ultra)
  me.ent = (lv === "ultra" && flat) ? spawnEntity(player, center, tint, base) : null;
  // órbitas + dados subindo
  let t = 0;
  const loop = system.runInterval(() => {
    t += 3;
    if (t >= dur) { system.clearRun(loop); return; }
    const k = t / dur, w = t * 0.18 * (1 + 0.2 * stage), n = lv === "low" ? 0 : lv === "medium" ? 1 : 2;
    if (k > 0.35) for (let i = 0; i < n; i++) {
      const a = w + i * Math.PI, r = base * (0.55 + 0.3 * Math.sin(w * 0.5 + i));
      mote(c, { x: center.x + Math.cos(a) * r, y: center.y + 0.2 + (flat ? 0.4 : 0), z: center.z + Math.sin(a) * r }, { col, tile: [T.rune1, T.rune2, T.rune3, T.glyph, T.spark][(t / 3 + i) % 5 | 0], dir: [-Math.sin(a), 0.1, Math.cos(a)], spd: 1.2, size: 0.2, life: 0.7, drag: 0.2 });
    }
    if (k > 0.6 && lv !== "low" && lv !== "medium" && t % 6 === 0) mote(c, { x: center.x + (Math.random() - 0.5) * base * 0.6, y: center.y + 0.3, z: center.z + (Math.random() - 0.5) * base * 0.6 }, { col, tile: [T.line, T.glyph, T.note][t % 3], dir: [0, 1, 0], spd: 1.1, size: 0.18, life: 0.9, drag: 0 });
    if (t % 15 === 0 && lv !== "low") snd(player, "proc", 0.25);
  }, 3);
  // conclusão: estabiliza + flash do núcleo
  after(dur, () => {
    snd(player, `done${tint}`, 0.8); snd(player, "stable", 0.35);
    layer(c, center, { tile: stage >= 4 ? L.cielCore : L.core, size: base * (0.5 + 0.3 * power), rot: 0, life: 0.7, a: 1, grow: 1.2, y: 0.1, col });
    burst(c, { x: center.x, y: center.y + 0.3, z: center.z }, { col, tile: T.star, n: 6 + power * 3, spd: 2.5, size: 0.2, life: 0.6, up: 1 });
    killEnt(me.ent); active.delete(player.id); done();
  });
  return me;
}

/** Versão reduzida para combate: aparece, analisa rápido, some. */
export function miniCircle(player, pos, o = {}) {
  const lv = lvOf(player); if (lv === "off") return;
  const stage = sageStage(getData(player)), tint = tintOf(stage), c = ctx(player, 1);
  layer(c, pos, { tile: L.mini, size: o.size ?? 1.8, rot: 110, life: 1.2, a: 0.85, col: TINT[tint], y: 0.06 });
  if (lv === "low") return;
  layer(c, pos, { tile: L.core, size: 0.5, rot: 0, life: 1.0, a: 0.9, amp: 0.2, freq: 3, col: TINT[tint], y: 0.1 });
  snd(player, "mini", 0.5, 1 + 0.05 * tint);
  if (lv === "high" || lv === "ultra") after(12, () => burst(c, { x: pos.x, y: pos.y + 0.6, z: pos.z }, { col: TINT[tint], tile: T.glyph, n: 4, spd: 1.4, size: 0.16, life: 0.7, up: 1 }));
}

/** Análise de MAGIA: a magia é capturada no centro e desmontada em camadas. */
export function spellCircle(player, pos, colName, o = {}) {
  const lv = lvOf(player); if (lv === "off") return o.onDone?.();
  const stage = sageStage(getData(player)), tint = tintOf(stage), c = ctx(player, 1.5), dur = o.dur ?? 70, base = 3, col = PAL[colName] ?? PAL.arcane;
  const f = lv === "low" || lv === "medium" ? { pos, plane: "xz" } : frontOf(player, 3.4, 1.4);
  snd(player, "capture", 0.8); snd(player, `start${tint}`, 0.6);
  layer(c, f.pos, { tile: L.core, size: 1.0, rot: 0, life: dur / 20 + 0.6, a: 1, amp: 0.15, freq: 2.2, col, plane: f.plane, y: 0 });
  const steps = [[L.spell, 2.4, 120, 0.15], [L.lattice, 3.2, -70, 0.3], [L.text, 3.8, 30, 0.45], [L.scale, 4.4, -20, 0.6]].slice(0, cap(lv) > 3 ? 4 : 2);
  steps.forEach(([tile, sz, rot, at], i) => after(at * dur, () => { layer(c, f.pos, { tile, size: sz, rot, life: (dur * (1 - at) + 10) / 20, a: 0.8, plane: f.plane, y: 0, col: i % 2 ? col : TINT[tint] }); snd(player, `layer${i + 2}`, 0.3, 1.1); }));
  // magia desmontada em camadas: fragmentos que se afastam em raios diferentes
  after(dur * 0.65, () => { for (let i = 0; i < 3; i++) after(i * 4, () => burst(c, f.pos, { col, tile: [T.shard, T.diamond, T.rune2][i], n: 6, spd: 1.2 + i * 0.9, size: 0.2, life: 0.9 })); });
  after(dur, () => { snd(player, `done${tint}`, 0.7); snd(player, "stable", 0.3); o.onDone?.(); });
}

/** Análise de HABILIDADE: representação da habilidade no centro com dados ao redor. */
export function skillCircle(player, colName, o = {}) {
  const lv = lvOf(player); if (lv === "off") return o.onDone?.();
  const stage = sageStage(getData(player)), tint = tintOf(stage), c = ctx(player, 1.3), dur = o.dur ?? 56, col = PAL[colName] ?? PAL.sage;
  const f = frontOf(player, 3, 1.4);
  snd(player, `start${tint}`, 0.7);
  layer(c, f.pos, { tile: L.skillhex, size: 2.0, rot: 30, life: dur / 20 + 0.6, a: 0.95, col, plane: f.plane, y: 0 });
  layer(c, f.pos, { tile: L.core, size: 0.8, rot: 0, life: dur / 20 + 0.6, a: 1, amp: 0.1, freq: 1.6, col, plane: f.plane, y: 0 });
  if (lv !== "low") after(dur * 0.3, () => { layer(c, f.pos, { tile: L.cells, size: 3.0, rot: -45, life: dur * 0.7 / 20 + 0.5, a: 0.8, col: TINT[tint], plane: f.plane, y: 0 }); snd(player, "layer3", 0.3); });
  if (lv === "high" || lv === "ultra") after(dur * 0.55, () => { layer(c, f.pos, { tile: L.data, size: 3.8, rot: 25, life: dur * 0.45 / 20 + 0.5, a: 0.7, col: TINT[tint], plane: f.plane, y: 0 }); snd(player, "layer5", 0.3); });
  after(dur, () => { snd(player, `done${tint}`, 0.7); o.onDone?.(); });
}

/** Halo de reação à voz: quando o Sábio fala, o sistema visual responde. */
export function reactVoice(player, info) {
  const lv = lvOf(player); if (lv === "off" || lv === "low") return;
  const stage = info.stage ?? sageStage(getData(player)), tint = tintOf(stage), dur = (info.dur ?? 40) / 20, col = TINT[tint];
  const c = ctx(player, 1), a = active.get(player.id);
  if (a && a.until > system.currentTick) {                 // círculo ativo: núcleo acende + anéis aceleram
    layer(c, a.pos, { tile: stage >= 4 ? L.cielCore : L.core, size: 1.4, rot: 0, life: dur, a: 0.9, amp: 0.2, freq: 3, col, y: 0.12 });
    layer(c, a.pos, { tile: L.scale, size: 2.8, rot: 240, life: dur, a: 0.55, col, y: 0.1 });
    snd(player, "react", 0.4, 1 + 0.1 * tint); return;
  }
  if (stage < 2) return;
  const now = system.currentTick; if ((lastHalo.get(player.id) ?? 0) > now) return; lastHalo.set(player.id, now + 40);
  const p = player.location;
  if (stage >= 4) {                                        // Ciel: pulsação consciente ao lado do jogador
    layer(c, { x: p.x, y: p.y + 2.5, z: p.z }, { tile: L.cielCore, size: 0.9, rot: 20, life: dur, a: 0.9, amp: 0.18, freq: 2.4, col, plane: "xz", y: 0 });
    if (lv !== "medium") mote(c, { x: p.x, y: p.y + 2.5, z: p.z }, { col, tile: T.heart, dir: [0, 1, 0], spd: 0.6, size: 0.2, life: 1.0, drag: 0.3 });
  } else {
    layer(c, { x: p.x, y: p.y, z: p.z }, { tile: L.mini, size: 1.6, rot: 80 + 30 * tint, life: dur, a: 0.7, amp: 0.05, freq: 2, col, y: 0.06 });
  }
}

/** Sequências de evolução (cada uma com narrativa visual própria). done() é chamado no ponto de virada. */
export function evolveSequence(player, to, done) {
  const lv = lvOf(player), tint = tintOf(to), col = TINT[tint], c = ctx(player, 3), p = player.location, at = { x: p.x, y: p.y, z: p.z };
  const fin = () => { try { done?.(); } catch { /* ignore */ } };
  snd(player, `evo${tint === 0 ? 1 : tint}`, 1);
  if (lv === "off") { system.runTimeout(fin, 60); return; }
  const L1 = (tile, size, rot, life, a = 0.9, ex = {}) => layer(c, at, { tile, size, rot, life, a, col, y: 0.05, ...ex });
  let ent = lv === "ultra" ? spawnEntity(player, at, tint, 4.2) : null;
  const end = (ms) => after(ms, () => killEnt(ent));
  if (to <= 2) {           // SÁBIO -> GRANDE SÁBIO: surge, expande, múltiplos anéis, runas, explosão controlada
    L1(L.sigil, 1.6, 40, 3.2); after(14, () => L1(L.cells, 3.4, -50, 2.8, 0.85, { grow: 0.5 })); after(30, () => { L1(L.glyph, 3.0, 70, 2.2); L1(L.scale, 4.2, -25, 2.0); });
    after(46, () => { L1(L.text, 4.6, 30, 1.6); L1(L.band, 5.2, -15, 1.4); helix(c, at, { col, tile: T.glyph, r: 2.2, h: 5, steps: 22, turns: 3, dur: 36 }); snd(player, "layer4", 0.6); });
    after(80, () => { L1(L.core, 3.0, 0, 1.2, 1, { grow: 1.6 }); implode(c, { x: at.x, y: at.y + 1, z: at.z }, { col, tile: T.star, n: 16, radius: 4, life: 0.5 }); });
    after(96, () => { burst(c, { x: at.x, y: at.y + 1, z: at.z }, { col: "gold", tile: T.star, n: 26, spd: 5, size: 0.28, life: 0.9 }); ringFlat(c, at, { col, tile: T.diamond, n: 24, radius: 6, life: 0.7 }); column(c, at, { col: "light", tile: T.line, n: 16, h: 9, life: 1.0, r: 1.2 }); });
    after(100, fin); end(140);
  } else if (to === 3) {   // GRANDE SÁBIO -> RAPHAEL: anéis → sobreposição → processamento → colapso → reorganização → expansão → manifestação
    L1(L.cells, 2.6, 50, 3.0); L1(L.scale, 3.4, -40, 3.0); after(16, () => { L1(L.glyph, 3.0, -90, 2.6); L1(L.lattice, 2.2, 110, 2.6); });
    after(30, () => { const f = frontOf(player, 2.8, 1.4); layer(c, f.pos, { tile: L.cells, size: 3.6, rot: -60, life: 2.2, a: 0.8, col, plane: f.plane, y: 0 }); layer(c, f.pos, { tile: L.glyph, size: 2.6, rot: 80, life: 2.2, a: 0.8, col, plane: f.plane, y: 0 }); snd(player, "proc", 0.6); });
    after(52, () => { L1(L.data, 4.2, -120, 1.8); L1(L.text, 4.8, 90, 1.8); for (let i = 0; i < 5; i++) after(i * 5, () => { snd(player, "proc", 0.3); burst(c, { x: at.x, y: at.y + 0.5, z: at.z }, { col, tile: T.line, n: 6, spd: 2, size: 0.15, life: 0.8, up: 1 }); }); });
    after(88, () => { implode(c, { x: at.x, y: at.y + 1, z: at.z }, { col, tile: T.diamond, n: 26, radius: 5, life: 0.7, flat: 0.9 }); L1(L.core, 5.0, 0, 0.7, 1, { grow: -0.9 }); });
    after(104, () => { burst(c, { x: at.x, y: at.y + 1, z: at.z }, { col: "white", tile: T.star, n: 14, spd: 1, life: 0.5 }); });
    after(112, () => { L1(L.lattice, 3.4, 55, 2.4, 0.9, { grow: 0.4 }); L1(L.cells, 3.0, -46, 2.4); L1(L.data, 4.0, -38, 2.4); L1(L.spell, 2.2, 96, 2.4); snd(player, "layer6", 0.7); });
    after(126, () => { ringFlat(c, at, { col, tile: T.rune2, n: 28, radius: 7, life: 0.8 }); L1(L.scan, 4.6, 170, 1.6, 0.6); L1(L.band, 5.4, -13, 1.6); L1(L.distort, 6.0, 12, 1.4, 0.5, { grow: 0.1 }); });
    after(146, () => { column(c, at, { col, tile: T.glyph, n: 22, h: 11, life: 1.2, r: 1.5 }); burst(c, { x: at.x, y: at.y + 1, z: at.z }, { col: "gold", tile: T.star, n: 30, spd: 6, size: 0.3, life: 1.0 }); L1(L.core, 3.4, 0, 1.0, 1, { grow: 1.4 }); });
    after(150, fin); end(210);
  } else {                 // RAPHAEL -> CIEL: processamento → núcleo → pulsação → padrões → consciência → resposta → manifestação
    for (let i = 0; i < 5; i++) after(i * 6, () => { snd(player, "proc", 0.35); burst(c, { x: at.x, y: at.y + 0.6, z: at.z }, { col, tile: T.glyph, n: 5, spd: 2.2, size: 0.15, life: 0.8, up: 1 }); });
    L1(L.data, 3.4, -60, 2.6, 0.8); L1(L.lattice, 2.4, 70, 2.6, 0.8);
    after(36, () => { L1(L.cielCore, 1.0, 0, 3.4, 1, { amp: 0.25, freq: 1.4 }); snd(player, "react", 0.8, 0.8); });
    for (let k = 0; k < 3; k++) after(52 + k * 14, () => { L1(L.cielCore, 1.4 + k * 0.7, 0, 0.8, 0.7, { grow: 0.8 }); snd(player, "react", 0.6, 0.8 + k * 0.15); });
    after(94, () => { L1(L.cielRing, 3.0, 28, 2.6, 0.9, { amp: 0.05, freq: 0.8 }); L1(L.cells, 3.6, -22, 2.6, 0.7); helix(c, at, { col, tile: T.heart, r: 1.8, h: 4, steps: 16, turns: 2, dur: 30 }); });
    after(116, () => { L1(L.cielCore, 2.6, 0, 2.2, 1, { amp: 0.12, freq: 1.0 }); L1(L.cielRing, 4.4, -36, 2.2, 0.8); snd(player, "layer7", 0.6, 1.2); });
    after(140, () => { const f = frontOf(player, 2.6, 1.5); layer(c, f.pos, { tile: L.cielCore, size: 2.0, rot: 18, life: 2.0, a: 0.9, amp: 0.1, freq: 1.2, col, plane: f.plane, y: 0 }); L1(L.scale, 3.4, 0, 1.6, 0.6, { rot: 0 }); });
    after(164, () => { column(c, at, { col, tile: T.heart, n: 14, h: 9, life: 1.4, r: 1.0 }); burst(c, { x: at.x, y: at.y + 1.2, z: at.z }, { col: "white", tile: T.star, n: 28, spd: 3.2, size: 0.26, life: 1.2 }); L1(L.cielCore, 3.2, 0, 1.2, 1, { grow: 1.2 }); });
    after(170, fin); end(230);
  }
}

export function dropCircle(id) { const a = active.get(id); if (a) killEnt(a.ent); active.delete(id); lastHalo.delete(id); }

// systems/sagecircle.js - 6.38: os círculos/camadas de partículas e a entidade geométrica do Sábio (sistema antigo) foram REMOVIDOS.
// Ficam só os sons do Sábio (sageSnd) e as funções com o mesmo nome, que agora apenas chamam o retorno (onDone) no tempo certo.
// O Grande Sábio oficial é a cena da Voz do Mundo (sageannounce.js) + a fala com indicador (voice.js).
// (texto original:) Manifestação visual do Sábio / Grande Sábio / Raphael / Ciel.
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

const later = (fn, t) => system.runTimeout(() => { try { fn?.(); } catch { /* ignore */ } }, Math.max(1, Math.round(t)));
export function playCircle(player, center, o = {}) { later(o.onDone, Math.max(20, o.dur ?? 60)); return null; }
export function miniCircle() { /* removido */ }
export function spellCircle(player, pos, colName, o = {}) { later(o.onDone, o.dur ?? 70); }
export function skillCircle(player, colName, o = {}) { later(o.onDone, o.dur ?? 56); }
export function reactVoice() { /* removido */ }
export function evolveSequence(player, to, done) { snd(player, `evo${tintOf(to) === 0 ? 1 : tintOf(to)}`, 1); later(done, 60); }
export function dropCircle(id) { active.delete(id); lastHalo.delete(id); }

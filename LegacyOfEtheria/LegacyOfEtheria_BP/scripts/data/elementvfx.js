// data/elementvfx.js - 6.36: CAMADAS VISUAIS POR ELEMENTO, somadas à coreografia própria de cada habilidade (data/fxrecipes.js).
// Cada família tem 5 fases: prep (preparação no conjurador) -> act (ativação) -> trail (trajetória) -> impact (impacto) -> residue (resíduo curto).
// Tudo passa pelo orçamento por tick de fxlib (CAP por nível de detalhe) e pelo nn() (escala no modo reduzido): nada fica preso no mundo,
// toda partícula tem vida máxima de ~2 s.
import { mote, streak, disc, burst, implode, ringFlat, column, arc, helix, orbit, after, vfx, vbolt, nn, T, CIRCLE } from "../systems/fxlib.js";

const up = (p, y = 1) => ({ x: p.x, y: p.y + y, z: p.z });
const rr = (a, b) => a + Math.random() * (b - a);
const lenOf = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const along = (a, b, n, f) => { for (let i = 1; i <= n; i++) { const t = i / n; f({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }, t, i); } };
const waves = (c, p, col, n, r, gap = 3) => { for (let i = 0; i < n; i++) after(i * gap, () => vfx(c, "wave", up(p, 0.08), { col, size: r * 0.4, grow: 2.2 + i * 0.4, life: 0.55, a: 0.9 - i * 0.2 })); };

export const ELEMENT_VFX = {
  // RAIO NEGRO / ELÉTRICO: ramos escuros com contorno brilhante, faíscas, estalos residuais
  black_lightning: {
    prep: (c, v) => { for (let i = 0; i < 3; i++) after(i * 2, () => vbolt(c, up(v.pos, 2.2), up(v.pos, 0.2), { jitter: 0.5, segs: 4, w: 0.35, life: 0.15 })); implode(c, up(v.pos, 1.2), { col: "violet", tile: T.spark, n: 8, radius: 1.6, life: 0.35, size: 0.15 }); },
    act: (c, v) => { vfx(c, "glow", up(v.pos, 1.3), { col: "violet", tile: 0, size: 1.6, grow: -0.8, life: 0.18 }); waves(c, v.pos, "violet", 1, 3); },
    trail: (c, v) => { const n = v.tier > 2 ? 3 : v.tier > 1 ? 2 : 1; for (let i = 0; i < n; i++) after(i, () => vbolt(c, v.from, v.to, { jitter: 0.7, segs: Math.min(10, 3 + Math.ceil(lenOf(v.from, v.to) / 2)), branch: 0.45, w: 0.6 - i * 0.12 })); },
    impact: (c, v) => { for (let i = 0; i < 2 + v.tier; i++) after(i, () => vbolt(c, up(v.at, rr(3, 5)), up(v.at, 0.1), { jitter: 0.8, segs: 6, branch: 0.5, w: 0.7 })); waves(c, v.at, "violet", 2, 3.5); burst(c, up(v.at, 0.8), { col: "white", tile: T.spark, n: 10, spd: 6, size: 0.14, life: 0.25 }); vfx(c, "glow", up(v.at, 1), { col: "white", tile: 0, size: 2.2, grow: -0.9, life: 0.14 }); },
    residue: (c, v) => { for (let i = 0; i < nn(c, 4); i++) after(4 + i * 5, () => { const p = { x: v.at.x + rr(-1.5, 1.5), y: v.at.y + 0.1, z: v.at.z + rr(-1.5, 1.5) }; vbolt(c, up(p, rr(0.6, 1.2)), p, { segs: 2, w: 0.25, life: 0.12, jitter: 0.3 }); }); },
  },
  // ENERGIA AZUL (Rimuru): ondas, orbes, anéis e choque, azul profundo + branco
  blue: {
    prep: (c, v) => { disc(c, v.pos, { col: "water", circle: CIRCLE.sage, size: 2.6, life: 0.9, rot: 80 }); orbit(c, () => up(v.pos, 1.1), { col: "mana", tile: T.orb, n: 3, r: 1, dur: 10, size: 0.22, speed: 2.4 }); },
    act: (c, v) => { waves(c, v.pos, "mana", 2, 2.5, 2); vfx(c, "glow", up(v.pos, 1.2), { col: "water", tile: 0, size: 1.8, grow: -0.7, life: 0.2 }); },
    trail: (c, v) => { const n = Math.min(10, Math.max(3, Math.floor(lenOf(v.from, v.to) / 1.5))); along(v.from, v.to, n, (p, t, i) => after(i * 0.5, () => { vfx(c, "glow", p, { col: "mana", tile: 0, size: 0.5 * (1 - t * 0.3), life: 0.35, grow: -0.6 }); if (i % 2 === 0) vfx(c, "wave", p, { col: "water", size: 0.4, grow: 2, life: 0.3, a: 0.6 }); })); },
    impact: (c, v) => { waves(c, v.at, "water", 2 + Math.min(1, v.tier - 1), 4, 3); burst(c, up(v.at, 0.6), { col: "mana", tile: T.orb, n: 10, spd: 3.5, size: 0.24, life: 0.5 }); vfx(c, "glow", up(v.at, 1), { col: "white", tile: 0, size: 2.4, grow: -0.9, life: 0.16 }); if (v.tier > 1) helix(c, v.at, { col: "foam", tile: T.spark, r: 1.2, h: 2.4, steps: 10, turns: 1.5, size: 0.18 }); },
    residue: (c, v) => { for (let i = 0; i < nn(c, 5); i++) after(3 + i * 3, () => vfx(c, "glow", { x: v.at.x + rr(-1.2, 1.2), y: v.at.y + 0.3, z: v.at.z + rr(-1.2, 1.2) }, { col: "mana", tile: 0, size: 0.2, spd: 0.6, dir: [0, 1, 0], life: 0.9 })); },
  },
  // FOGO: brasas que sobem em espiral, explosão em camadas, rastro quente e fumaça
  fire: {
    prep: (c, v) => { for (let i = 0; i < nn(c, 8); i++) vfx(c, "ember", { x: v.pos.x + rr(-0.8, 0.8), y: v.pos.y + 0.2, z: v.pos.z + rr(-0.8, 0.8) }, { col: "fire", size: 0.22, spd: 1.2, dir: [0, 1, 0], life: 0.8, drag: 0.4 }); },
    act: (c, v) => { vfx(c, "glow", up(v.pos, 1.2), { col: "ember", tile: 0, size: 1.6, grow: -0.6, life: 0.2 }); },
    trail: (c, v) => { const n = Math.min(10, Math.max(3, Math.floor(lenOf(v.from, v.to) / 1.4))); along(v.from, v.to, n, (p, t, i) => after(i * 0.5, () => { vfx(c, "ember", p, { col: "fire", size: 0.35, life: 0.45, spd: 0.4, dir: [0, 1, 0] }); if (i % 2) vfx(c, "smoke", p, { col: [0.25, 0.2, 0.18], size: 0.5, grow: 0.8, life: 0.7, a: 0.5, spd: 0.3 }); })); },
    impact: (c, v) => { vfx(c, "glow", up(v.at, 0.8), { col: "white", tile: 0, size: 2, grow: -0.9, life: 0.12 }); burst(c, up(v.at, 0.4), { col: "fire", tile: T.flame, n: 12, spd: 3.5, size: 0.42, up: 1 }); for (let i = 0; i < nn(c, 10); i++) vfx(c, "ember", up(v.at, 0.3), { col: "ember", size: 0.18, spd: rr(2, 5), dir: [rr(-1, 1), rr(0.4, 1.2), rr(-1, 1)], acc: [0, -4, 0], life: 0.9 }); waves(c, v.at, "fire", 1 + Math.min(1, v.tier - 1), 3.2); },
    residue: (c, v) => { for (let i = 0; i < nn(c, 4); i++) after(4 + i * 4, () => vfx(c, "smoke", { x: v.at.x + rr(-0.8, 0.8), y: v.at.y + 0.4, z: v.at.z + rr(-0.8, 0.8) }, { col: [0.18, 0.15, 0.14], size: 0.7, grow: 1, spd: 0.6, dir: [0, 1, 0], life: 1.1, a: 0.55 })); },
  },
  // VENTO / CORTE: arcos e lâminas de ar, linhas de velocidade
  wind: {
    prep: (c, v) => { ringFlat(c, v.pos, { col: "wind", tile: T.cloud, radius: 1.4, n: 6, life: 0.3, a: 0.6 }); },
    act: (c, v) => { for (let i = 0; i < Math.min(3, v.tier); i++) after(i * 2, () => arc(c, v.pos, v.dir, { col: "wind", radius: 2.2 + i * 0.4, angle: 150, n: 7, tilt: 1.2 - i * 0.4, w: 0.18, life: 0.25 })); },
    trail: (c, v) => { const d = v.dir; const n = Math.min(6, Math.max(2, Math.floor(lenOf(v.from, v.to) / 2))); along(v.from, v.to, n, (p, t, i) => after(i * 0.5, () => vfx(c, "blade", p, { col: "wind", size: 1.4, dir: [d.x, d.y, d.z], life: 0.22, grow: 0.3 }))); },
    impact: (c, v) => { for (let i = 0; i < 2; i++) streak(c, { x: v.at.x - 1, y: v.at.y + 1.6 - i * 0.6, z: v.at.z + (i ? 1 : -1) * 0.4 }, { x: v.at.x + 1, y: v.at.y + 0.4 + i * 0.6, z: v.at.z }, { col: "white", w: 0.12, life: 0.2 }); waves(c, v.at, "wind", 1, 3); burst(c, up(v.at, 1), { col: "wind", tile: T.line, n: 8, spd: 6, size: 0.2, life: 0.2 }); },
    residue: (c, v) => { for (let i = 0; i < nn(c, 3); i++) after(3 + i * 3, () => vfx(c, "smoke", up(v.at, 0.2), { col: [0.85, 0.95, 0.9], size: 0.5, grow: 1.4, life: 0.6, a: 0.35, spd: 1.4, dir: [rr(-1, 1), 0.1, rr(-1, 1)] })); },
  },
  // ESCURIDÃO: fragmentos violeta girando, fumaça negra, implosão
  dark: {
    prep: (c, v) => { implode(c, up(v.pos, 1), { col: "shadow", tile: T.smoke, n: 8, radius: 2, life: 0.5, size: 0.5, a: 0.7 }); for (let i = 0; i < nn(c, 4); i++) vfx(c, "shard", { x: v.pos.x + rr(-1, 1), y: v.pos.y + rr(0.5, 1.8), z: v.pos.z + rr(-1, 1) }, { col: "violet", size: 0.3, life: 0.6, spd: 0.3 }); },
    act: (c, v) => { vfx(c, "smoke", up(v.pos, 1), { col: [0.06, 0.03, 0.1], size: 1.4, grow: 1.2, life: 0.5, a: 0.8 }); waves(c, v.pos, "void", 1, 2.6); },
    trail: (c, v) => { const n = Math.min(9, Math.max(3, Math.floor(lenOf(v.from, v.to) / 1.6))); along(v.from, v.to, n, (p, t, i) => after(i * 0.6, () => { vfx(c, "smoke", p, { col: [0.08, 0.04, 0.12], size: 0.6, grow: 0.8, life: 0.55, a: 0.7 }); vfx(c, "shard", p, { col: "violet", size: 0.22, life: 0.4, spd: 1, dir: [rr(-1, 1), rr(-1, 1), rr(-1, 1)] }); })); },
    impact: (c, v) => { for (let i = 0; i < nn(c, 10); i++) vfx(c, "shard", up(v.at, 0.8), { col: i % 3 ? "violet" : "white", size: 0.28, spd: rr(2, 5), dir: [rr(-1, 1), rr(-0.2, 1), rr(-1, 1)], acc: [0, -3, 0], life: 0.7 }); vfx(c, "smoke", up(v.at, 0.6), { col: [0.05, 0.02, 0.08], size: 2, grow: 0.8, life: 0.7, a: 0.85 }); waves(c, v.at, "violet", 1 + Math.min(1, v.tier - 1), 3.4); },
    residue: (c, v) => { for (let i = 0; i < nn(c, 4); i++) after(4 + i * 4, () => vfx(c, "smoke", { x: v.at.x + rr(-1, 1), y: v.at.y + 0.2, z: v.at.z + rr(-1, 1) }, { col: [0.1, 0.05, 0.15], size: 0.7, grow: 0.9, spd: 0.4, dir: [0, 1, 0], life: 1.2, a: 0.6 })); },
  },
  // LUZ / BARREIRA / CURA: círculo no chão, partículas subindo, cruz de brilho, escudo
  light: {
    prep: (c, v) => { disc(c, v.pos, { col: "holy", circle: CIRCLE.holy, size: 2.6, life: 1.1, rot: 40 }); for (let i = 0; i < nn(c, 8); i++) vfx(c, "glow", { x: v.pos.x + rr(-1, 1), y: v.pos.y + 0.1, z: v.pos.z + rr(-1, 1) }, { col: "light", tile: 0, size: 0.16, spd: 1.4, dir: [0, 1, 0], life: 0.9, drag: 0.8 }); },
    act: (c, v) => { vfx(c, "glow", up(v.pos, 1.3), { col: "white", tile: 9, size: 1.4, grow: -0.5, life: 0.25 }); waves(c, v.pos, "gold", 1, 2.4); },
    trail: (c, v) => { const n = Math.min(8, Math.max(2, Math.floor(lenOf(v.from, v.to) / 2))); along(v.from, v.to, n, (p, t, i) => after(i * 0.5, () => vfx(c, "glow", p, { col: "holy", tile: 0, size: 0.4, life: 0.35, grow: -0.5 }))); },
    impact: (c, v) => { vfx(c, "glow", up(v.at, 1), { col: "white", tile: 9, size: 2.2, grow: -0.6, life: 0.3 }); column(c, v.at, { col: "light", tile: T.spark, n: 8, h: 3, life: 0.8, r: 0.8 }); waves(c, v.at, "holy", 2, 3, 3); if (v.tier > 1) orbit(c, () => up(v.at, 1), { col: "gold", tile: T.diamond, n: 4, r: 1.2, dur: 14, size: 0.2, speed: 1.6 }); },
    residue: (c, v) => { for (let i = 0; i < nn(c, 6); i++) after(3 + i * 3, () => vfx(c, "glow", { x: v.at.x + rr(-1, 1), y: v.at.y + 0.1, z: v.at.z + rr(-1, 1) }, { col: "light", tile: 0, size: 0.14, spd: 1, dir: [0, 1, 0], life: 1, drag: 0.6 })); },
  },
};

/** família visual de uma habilidade (ou null = só a coreografia própria) */
export function familyOf(sk) {
  const id = String(sk?.id ?? ""), el = sk?.element ?? "";
  if (/black_lightning|black_thunder|kokurai|storm|thunder|lightning|electro|zap/.test(id) || el === "lightning") return "black_lightning";
  if (/rimuru|slime|predator|sage|mana|water|aqua|hydro/.test(id) || el === "water" || el === "ice" || el === "arcane") return "blue";
  if (el === "fire" || /flame|fire|blaze|ember|inferno/.test(id)) return "fire";
  if (el === "wind" || /slash|cut|blade|wind|gale|sword|iai/.test(id) || el === "physical") return "wind";
  if (el === "shadow" || el === "void" || el === "blood" || /dark|shadow|void|abyss/.test(id)) return "dark";
  if (el === "light" || /holy|heal|barrier|shield|light|bless|sanct/.test(id)) return "light";
  return null;
}

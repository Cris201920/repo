// data/fxgrand.js - 6.55: CAMADA DE GRANDEZA das magias — composições densas por ELEMENTO, escaladas pela RARIDADE da habilidade.
// Soma-se às camadas já existentes (fxrecipes = coreografia própria, elementvfx = família, partículas portadas) sem substituir nada.
// Fases: charge (acúmulo no conjurador: implosão + runas em órbita + círculo) -> release (liberação) -> trail (rastro denso)
//        -> impact (explosão em camadas: núcleo, estilhaços, anéis de choque) -> dissipate (resíduo que some aos poucos).
// Raridade lendária+ ganha "grande escala": círculo gigante no chão, pilar vertical, várias ondas e um fenômeno de área próprio do elemento
// (tempestade de raios, chuva de brasas/cristais, tornado, absorção da região, coluna de luz...).
// Cada partícula tem direção, velocidade, tamanho, vida e momento definidos; tudo passa pelo orçamento por tick do fxlib e pelo nível de detalhe.
import { mote, streak, disc, burst, implode, ringFlat, column, helix, orbit, after, nn, T, CIRCLE } from "../systems/fxlib.js";

export const GRAND = { common: 0.5, uncommon: 0.7, rare: 1, epic: 1.4, legendary: 1.9, mythic: 2.4, divine: 3 };
export const BIG = (sk) => (GRAND[sk?.rarity] ?? 1) >= 1.9 || /ultimate|suprem|divin/i.test(`${sk?.cat ?? ""} ${sk?.tier ?? ""}`);
const up = (p, y = 1) => ({ x: p.x, y: p.y + y, z: p.z });
const rr = (a, b) => a + Math.random() * (b - a);
const N = (c, g, n) => nn(c, Math.round(n * g));
const lenOf = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const along = (a, b, n, f) => { for (let i = 1; i <= n; i++) { const t = i / n; f({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }, t, i); } };
const around = (p, r, y = 0) => { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r; return { x: p.x + Math.cos(a) * d, y: p.y + y, z: p.z + Math.sin(a) * d }; };
const waves = (c, p, col, n, r, gap = 3, tile = T.ring) => { for (let i = 0; i < n; i++) after(i * gap, () => ringFlat(c, up(p, 0.1 + i * 0.05), { col, tile, n: 18 + i * 4, radius: r * (1 + i * 0.35), spd: r * (2 + i * 0.4), life: 0.5, size: 0.16, a: 0.9 - i * 0.12 })); };
const runes = (c, p, col, g, dur = 14) => orbit(c, () => up(p, 1.1), { col, tile: T.rune1 + Math.floor(Math.random() * 3), n: Math.max(2, Math.round(3 * g)), r: 1.2, dur, step: 2, size: 0.22, speed: 1.6, shrink: true, life: 0.35 });

// ---------------------------------------------------------------- composições por elemento
const E = {
  fire: { c1: "fire", c2: "ember", circle: CIRCLE.fire,
    charge: (c, v, g) => { helix(c, v.pos, { col: "ember", tile: T.ember, steps: N(c, g, 18), turns: 2, r: 0.9, h: 2.2, dur: 10, size: 0.14, vy: 0.8 }); implode(c, up(v.pos, 1.2), { col: "fire", tile: T.flame, n: N(c, g, 14), radius: 2.2, life: 0.45, size: 0.2 }); },
    trail: (c, p, g) => { mote(c, p, { col: "fire", tile: T.flame, size: 0.32, life: 0.35, spd: 0.3, dir: [0, 1, 0] }); if (Math.random() < 0.5 * g) mote(c, p, { col: [0.2, 0.17, 0.15], tile: T.smoke, size: 0.45, grow: 0.9, life: 0.7, spd: 0.5, dir: [0, 1, 0], a: 0.5 }); },
    impact: (c, p, g) => { burst(c, up(p, 0.6), { col: "fire", tile: T.flame, n: N(c, g, 26), spd: 4.5, life: 0.55, size: 0.28 }); burst(c, up(p, 0.4), { col: "ember", tile: T.ember, n: N(c, g, 22), spd: 6, up: 1.4, life: 0.9, size: 0.1, acc: [0, -5, 0] }); waves(c, p, "ember", 2 + Math.round(g), 2.2); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 8); i++) after(4 + i * 3, () => mote(c, around(p, 1.6, 0.2), { col: [0.18, 0.15, 0.14], tile: T.smoke, size: 0.6, grow: 1, spd: 0.6, dir: [0, 1, 0], life: 1.3, a: 0.5 })); },
    big: (c, v, g) => { for (let i = 0; i < N(c, g, 16); i++) after(i * 1.5, () => { const q = around(v.at, 6, 7); mote(c, q, { col: i % 2 ? "fire" : "ember", tile: T.flame, size: 0.4, spd: 9, dir: [rr(-0.2, 0.2), -1, rr(-0.2, 0.2)], life: 0.75, drag: 0 }); after(15, () => burst(c, { x: q.x, y: v.at.y + 0.3, z: q.z }, { col: "ember", tile: T.ember, n: 6, spd: 3, up: 1.5, life: 0.5, size: 0.1 })); }); column(c, v.at, { col: "fire", tile: T.flame, n: N(c, g, 24), h: 7, life: 0.9, r: 1.2, size: 0.3 }); } },
  ice: { c1: "ice", c2: "frost", circle: CIRCLE.ice,
    charge: (c, v, g) => { for (let i = 0; i < N(c, g, 12); i++) mote(c, around(v.pos, 1.4, rr(0.2, 2)), { col: "frost", tile: T.flake, size: 0.14, spd: 0.4, dir: [0, -1, 0], life: 0.9, grow: 0.2 }); implode(c, up(v.pos, 1.2), { col: "ice", tile: T.shard, n: N(c, g, 12), radius: 2, life: 0.5, size: 0.16 }); },
    trail: (c, p, g) => { mote(c, p, { col: "ice", tile: T.shard, size: 0.2, life: 0.5, spd: 0.6, dir: [rr(-1, 1), -0.4, rr(-1, 1)], acc: [0, -4, 0] }); if (Math.random() < 0.6 * g) mote(c, p, { col: "frost", tile: T.flake, size: 0.12, life: 0.8, spd: 0.2, dir: [0, -1, 0] }); },
    impact: (c, p, g) => { for (let i = 0; i < N(c, g, 10); i++) { const a = (i / 10) * 6.283; streak(c, up(p, 0.1), { x: p.x + Math.cos(a) * rr(1, 2.4), y: p.y + rr(0.6, 2.2), z: p.z + Math.sin(a) * rr(1, 2.4) }, { col: i % 2 ? "ice" : "frost", w: 0.18, life: 0.9, tile: T.shard }); } burst(c, up(p, 0.8), { col: "frost", tile: T.shard, n: N(c, g, 24), spd: 5, life: 0.8, size: 0.14, acc: [0, -9, 0] }); waves(c, p, "frost", 1 + Math.round(g), 2.6, 4, T.flake); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 10); i++) after(3 + i * 3, () => mote(c, around(p, 2, rr(1, 2.5)), { col: "frost", tile: T.flake, size: 0.12, spd: 0.5, dir: [rr(-0.2, 0.2), -1, rr(-0.2, 0.2)], life: 1.4 })); },
    big: (c, v, g) => { for (let i = 0; i < N(c, g, 22); i++) after(i, () => mote(c, around(v.at, 7, 8), { col: i % 3 ? "ice" : "white", tile: T.shard, size: 0.3, spd: 11, dir: [0, -1, 0], life: 0.7, drag: 0 })); waves(c, v.at, "ice", 4, 4, 4, T.flake); } },
  lightning: { c1: "bolt", c2: "violet", circle: CIRCLE.bolt,
    charge: (c, v, g) => { for (let i = 0; i < N(c, g, 6); i++) after(i, () => { const a = around(v.pos, 1.3, rr(0.3, 2)); streak(c, a, { x: a.x + rr(-0.6, 0.6), y: a.y + rr(-0.6, 0.6), z: a.z + rr(-0.6, 0.6) }, { col: "bolt", w: 0.08, life: 0.12, tile: T.zig }); }); implode(c, up(v.pos, 1.3), { col: "bolt", tile: T.spark, n: N(c, g, 14), radius: 1.8, life: 0.3, size: 0.1 }); },
    trail: (c, p, g) => { mote(c, p, { col: "bolt", tile: T.spark, size: 0.16, life: 0.2 }); if (Math.random() < 0.4 * g) streak(c, p, { x: p.x + rr(-0.8, 0.8), y: p.y + rr(-0.8, 0.8), z: p.z + rr(-0.8, 0.8) }, { col: "white", w: 0.06, life: 0.1, tile: T.zig }); },
    impact: (c, p, g) => { burst(c, up(p, 1), { col: "bolt", tile: T.spark, n: N(c, g, 28), spd: 7, life: 0.35, size: 0.1 }); for (let i = 0; i < N(c, g, 6); i++) after(i, () => { const a = up(p, 1), b = around(p, 2.5, rr(0, 1.5)); streak(c, a, b, { col: i % 2 ? "violet" : "bolt", w: 0.1, life: 0.15, tile: T.zig }); }); waves(c, p, "bolt", 1 + Math.round(g), 2.4, 2); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 6); i++) after(4 + i * 4, () => { const q = around(p, 1.5, 0.1); streak(c, q, up(q, rr(0.4, 1)), { col: "bolt", w: 0.05, life: 0.1, tile: T.zig }); }); },
    big: (c, v, g) => { for (let i = 0; i < N(c, g, 8); i++) after(i * 2, () => { const q = around(v.at, 6, 0.1); let cur = up(q, 12); for (let s = 0; s < 6; s++) { const nx = s === 5 ? q : { x: q.x + rr(-0.8, 0.8), y: cur.y - 2, z: q.z + rr(-0.8, 0.8) }; streak(c, cur, nx, { col: s % 2 ? "white" : "bolt", w: 0.22, life: 0.2, tile: T.zig }); if (Math.random() < 0.35) streak(c, nx, { x: nx.x + rr(-2, 2), y: nx.y - rr(0.5, 1.5), z: nx.z + rr(-2, 2) }, { col: "violet", w: 0.1, life: 0.15, tile: T.zig }); cur = nx; } burst(c, up(q, 0.2), { col: "bolt", tile: T.spark, n: 6, spd: 4, life: 0.3, size: 0.1 }); }); } },
  dark: { c1: "violet", c2: "shadow", circle: CIRCLE.shadow,
    charge: (c, v, g) => { helix(c, v.pos, { col: "violet", tile: T.shard, steps: N(c, g, 18), turns: 3, r: 1.4, h: 2.4, dur: 12, size: 0.14, down: true }); implode(c, up(v.pos, 1.1), { col: "shadow", tile: T.smoke, n: N(c, g, 12), radius: 2.6, life: 0.6, size: 0.4, a: 0.7 }); },
    trail: (c, p, g) => { mote(c, p, { col: [0.08, 0.04, 0.12], tile: T.smoke, size: 0.5, grow: 0.6, life: 0.6, a: 0.7 }); if (Math.random() < 0.5 * g) mote(c, p, { col: "violet", tile: T.shard, size: 0.14, life: 0.4, spd: 1.2, dir: [rr(-1, 1), rr(-1, 1), rr(-1, 1)] }); },
    impact: (c, p, g) => { implode(c, up(p, 1), { col: "violet", tile: T.shard, n: N(c, g, 18), radius: 3, life: 0.35, size: 0.16 }); after(7, () => { burst(c, up(p, 1), { col: "black", tile: T.smoke, n: N(c, g, 14), spd: 3, life: 0.8, size: 0.5, a: 0.8 }); burst(c, up(p, 1), { col: "violet", tile: T.star, n: N(c, g, 16), spd: 5, life: 0.5, size: 0.14 }); waves(c, p, "void", 1 + Math.round(g), 2.6); }); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 8); i++) after(6 + i * 3, () => mote(c, around(p, 1.4, 0.1), { col: [0.1, 0.05, 0.15], tile: T.smoke, size: 0.6, grow: 0.8, spd: 0.4, dir: [0, 1, 0], life: 1.2, a: 0.55 })); },
    big: (c, v, g) => { for (let k = 0; k < 4; k++) after(k * 4, () => implode(c, up(v.at, 1), { col: k % 2 ? "violet" : "shadow", tile: k % 2 ? T.spark : T.smoke, n: N(c, g, 18), radius: 8, flat: 0.2, life: 0.8, size: 0.22 })); orbit(c, () => up(v.at, 1.2), { col: "black", tile: T.orb, n: 4, r: 1.6, dur: 24, step: 2, size: 0.3, speed: 2 }); } },
  blood: { c1: "blood", c2: [0.4, 0.02, 0.05], circle: CIRCLE.blood,
    charge: (c, v, g) => { helix(c, v.pos, { col: "blood", tile: T.drop, steps: N(c, g, 16), turns: 2, r: 1, h: 2, dur: 10, size: 0.12 }); },
    trail: (c, p) => { mote(c, p, { col: "blood", tile: T.drop, size: 0.16, life: 0.6, spd: 0.6, dir: [rr(-0.5, 0.5), 0.3, rr(-0.5, 0.5)], acc: [0, -7, 0] }); },
    impact: (c, p, g) => { burst(c, up(p, 1), { col: "blood", tile: T.drop, n: N(c, g, 26), spd: 4.5, up: 1.2, life: 0.8, size: 0.13, acc: [0, -9, 0] }); waves(c, p, "blood", 1 + Math.round(g), 2.2); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 6); i++) after(4 + i * 3, () => mote(c, around(p, 1.3, 0.05), { col: [0.4, 0.02, 0.05], tile: T.blob, size: 0.2, life: 1.2, grow: 0.4, a: 0.7 })); },
    big: (c, v, g) => { for (let k = 0; k < 3; k++) after(k * 5, () => implode(c, up(v.at, 1), { col: "blood", tile: T.drop, n: N(c, g, 16), radius: 7, flat: 0.25, life: 0.7, size: 0.15 })); } },
  light: { c1: "holy", c2: "white", circle: CIRCLE.holy,
    charge: (c, v, g) => { column(c, v.pos, { col: "light", tile: T.spark, n: N(c, g, 16), h: 2.6, life: 0.8, r: 0.9, size: 0.1 }); for (let i = 0; i < 3; i++) after(i * 3, () => ringFlat(c, up(v.pos, 0.3 + i * 0.7), { col: "gold", tile: T.ring, n: 12, radius: 0.9, spd: 0.5, life: 0.4, size: 0.1 })); },
    trail: (c, p, g) => { mote(c, p, { col: "light", tile: T.star, size: 0.18, life: 0.4, grow: -0.6 }); if (Math.random() < 0.4 * g) mote(c, p, { col: "gold", tile: T.spark, size: 0.08, spd: 0.8, dir: [0, 1, 0], life: 0.7 }); },
    impact: (c, p, g) => { for (let i = 0; i < N(c, g, 6); i++) { const a = (i / 6) * 6.283; streak(c, up(p, 0.2), { x: p.x + Math.cos(a) * 0.4, y: p.y + rr(3, 5), z: p.z + Math.sin(a) * 0.4 }, { col: i % 2 ? "white" : "holy", w: 0.16, life: 0.4 }); } burst(c, up(p, 1), { col: "holy", tile: T.star, n: N(c, g, 22), spd: 4, life: 0.6, size: 0.13 }); waves(c, p, "gold", 1 + Math.round(g), 2.8, 3); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 10); i++) after(3 + i * 2, () => mote(c, around(p, 1.6, 0.1), { col: "light", tile: T.spark, size: 0.08, spd: 1.2, dir: [0, 1, 0], life: 1.2 })); },
    big: (c, v, g) => { column(c, v.at, { col: "white", tile: T.spark, n: N(c, g, 36), h: 14, life: 1, r: 1.6, size: 0.16 }); for (let i = 0; i < 4; i++) after(i * 4, () => ringFlat(c, up(v.at, 0.1 + i * 3), { col: i % 2 ? "gold" : "holy", tile: T.ring, n: 24, radius: 3 + i, spd: 1.5, life: 0.6, size: 0.18 })); } },
  wind: { c1: "wind", c2: "white", circle: CIRCLE.wind,
    charge: (c, v, g) => { helix(c, v.pos, { col: "wind", tile: T.cloud, steps: N(c, g, 18), turns: 3, r: 1.3, h: 2.2, dur: 10, size: 0.3, spd: 2, a: 0.6 }); },
    trail: (c, p, g) => { mote(c, p, { col: "wind", tile: T.line, size: 0.25, life: 0.25, a: 0.7 }); if (Math.random() < 0.5 * g) mote(c, p, { col: [0.85, 0.95, 0.9], tile: T.cloud, size: 0.35, grow: 1, life: 0.5, a: 0.4 }); },
    impact: (c, p, g) => { ringFlat(c, up(p, 0.3), { col: "wind", tile: T.cloud, n: N(c, g, 22), radius: 3, spd: 7, life: 0.45, size: 0.35, a: 0.6 }); burst(c, up(p, 1), { col: "white", tile: T.line, n: N(c, g, 16), spd: 6, life: 0.3, size: 0.2 }); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 5); i++) after(3 + i * 3, () => mote(c, around(p, 1.5, 0.3), { col: [0.85, 0.95, 0.9], tile: T.cloud, size: 0.5, grow: 1.2, life: 0.7, a: 0.35, spd: 1.2, dir: [rr(-1, 1), 0.2, rr(-1, 1)] })); },
    big: (c, v, g) => { for (let k = 0; k < 3; k++) helix(c, v.at, { col: k ? "wind" : "white", tile: k ? T.cloud : T.line, steps: N(c, g, 26), turns: 5, r: 1.2 + k * 0.9, h: 8, dur: 24, size: 0.32, spd: 3, phase: k * 2, a: 0.65 }); } },
  water: { c1: "water", c2: "foam", circle: CIRCLE.water,
    charge: (c, v, g) => { orbit(c, () => up(v.pos, 1), { col: "water", tile: T.bubble, n: Math.round(3 * g) + 1, r: 1.1, dur: 12, step: 2, size: 0.14, speed: 2 }); },
    trail: (c, p) => { mote(c, p, { col: "water", tile: T.drop, size: 0.16, life: 0.5, spd: 0.8, dir: [rr(-0.5, 0.5), 0.5, rr(-0.5, 0.5)], acc: [0, -8, 0] }); },
    impact: (c, p, g) => { burst(c, up(p, 0.5), { col: "foam", tile: T.drop, n: N(c, g, 26), spd: 5, up: 1.8, life: 0.8, size: 0.13, acc: [0, -10, 0] }); for (let i = 0; i < N(c, g, 8); i++) mote(c, around(p, 1.2, rr(0.3, 1.5)), { col: "water", tile: T.bubble, size: 0.16, spd: 0.6, dir: [0, 1, 0], life: 0.9 }); waves(c, p, "water", 2 + Math.round(g), 2.4, 3); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 6); i++) after(3 + i * 3, () => mote(c, around(p, 1.5, 0.2), { col: "water", tile: T.bubble, size: 0.12, spd: 0.8, dir: [0, 1, 0], life: 1 })); },
    big: (c, v, g) => { for (let i = 0; i < 4; i++) after(i * 5, () => ringFlat(c, up(v.at, 0.2), { col: i % 2 ? "foam" : "water", tile: T.drop, n: 30, radius: 6, spd: 8, lift: 0.4, life: 0.7, size: 0.2 })); } },
  earth: { c1: "earth", c2: "dust", circle: CIRCLE.earth,
    charge: (c, v, g) => { for (let i = 0; i < N(c, g, 12); i++) mote(c, around(v.pos, 1.4, 0.1), { col: "earth", tile: T.chunk, size: 0.16, spd: 1.6, dir: [0, 1, 0], life: 0.7, acc: [0, -3, 0] }); },
    trail: (c, p) => { mote(c, p, { col: "dust", tile: T.chunk, size: 0.16, life: 0.6, spd: 1, dir: [rr(-1, 1), 0.3, rr(-1, 1)], acc: [0, -9, 0] }); },
    impact: (c, p, g) => { burst(c, up(p, 0.3), { col: "earth", tile: T.chunk, n: N(c, g, 24), spd: 6, up: 1.5, life: 1, size: 0.2, acc: [0, -14, 0] }); for (let i = 0; i < N(c, g, 8); i++) { const a = (i / 8) * 6.283; streak(c, up(p, 0.05), { x: p.x + Math.cos(a) * rr(1.5, 3), y: p.y + 0.05, z: p.z + Math.sin(a) * rr(1.5, 3) }, { col: [0.3, 0.22, 0.12], w: 0.12, life: 1.2 }); } waves(c, p, "dust", 2, 2.6, 3, T.cloud); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 6); i++) after(3 + i * 3, () => mote(c, around(p, 2, 0.2), { col: "dust", tile: T.cloud, size: 0.6, grow: 1, life: 1, a: 0.4, spd: 0.4, dir: [0, 1, 0] })); },
    big: (c, v, g) => { for (let i = 0; i < N(c, g, 10); i++) after(i, () => burst(c, around(v.at, 6, 0.2), { col: "earth", tile: T.chunk, n: 5, spd: 7, up: 2.5, life: 1, size: 0.24, acc: [0, -14, 0] })); } },
  arcane: { c1: "arcane", c2: "mana", circle: CIRCLE.arcane,
    charge: (c, v, g) => { runes(c, v.pos, "arcane", g); implode(c, up(v.pos, 1.2), { col: "mana", tile: T.diamond, n: N(c, g, 14), radius: 2, life: 0.4, size: 0.12 }); },
    trail: (c, p, g) => { mote(c, p, { col: "mana", tile: T.diamond, size: 0.18, life: 0.35, grow: -0.5 }); if (Math.random() < 0.4 * g) mote(c, p, { col: "arcane", tile: T.glyph, size: 0.2, life: 0.5, spd: 0.4, dir: [0, 1, 0] }); },
    impact: (c, p, g) => { burst(c, up(p, 1), { col: "arcane", tile: T.diamond, n: N(c, g, 24), spd: 4.5, life: 0.5, size: 0.13 }); burst(c, up(p, 1), { col: "white", tile: T.glyph, n: N(c, g, 8), spd: 2, life: 0.7, size: 0.2 }); waves(c, p, "mana", 1 + Math.round(g), 2.6); },
    residue: (c, p, g) => { for (let i = 0; i < N(c, g, 6); i++) after(3 + i * 3, () => mote(c, around(p, 1.3, rr(0.3, 1.5)), { col: "arcane", tile: T.rune1 + (i % 3), size: 0.16, life: 0.8, spd: 0.4, dir: [0, 1, 0], a: 0.8 })); },
    big: (c, v, g) => { for (let i = 0; i < 3; i++) after(i * 4, () => disc(c, v.at, { col: i % 2 ? "mana" : "arcane", circle: CIRCLE.arcane, size: 5 + i * 2.5, life: 1.2, rot: 60 - i * 40, grow: 0.3 })); column(c, v.at, { col: "mana", tile: T.diamond, n: N(c, g, 24), h: 9, life: 0.9, r: 1, size: 0.14 }); } },
  physical: { c1: "steel", c2: "white", circle: CIRCLE.arcane,
    charge: (c, v, g) => { implode(c, up(v.pos, 1.1), { col: "steel", tile: T.line, n: N(c, g, 10), radius: 1.6, life: 0.3, size: 0.14 }); },
    trail: (c, p) => { mote(c, p, { col: "white", tile: T.line, size: 0.22, life: 0.2, a: 0.8 }); },
    impact: (c, p, g) => { burst(c, up(p, 1), { col: "steel", tile: T.spark, n: N(c, g, 20), spd: 6, life: 0.3, size: 0.09 }); burst(c, up(p, 0.3), { col: "dust", tile: T.cloud, n: N(c, g, 6), spd: 1.5, life: 0.6, size: 0.4, a: 0.5 }); waves(c, p, "white", 1 + Math.round(g * 0.6), 2, 2); },
    residue: () => {},
    big: (c, v, g) => { for (let i = 0; i < 3; i++) after(i * 3, () => ringFlat(c, up(v.at, 1 + i * 0.4), { col: "white", tile: T.line, n: 24, radius: 4, spd: 9, life: 0.4, size: 0.2 })); } },
};
E.shadow = E.dark; E.void = E.dark;
export const grandOf = (sk) => E[sk?.element] ?? E.arcane;

// 6.58: MAGIA DE GRANDE ESCALA (vídeo de referência 5): esfera de energia que cresce sobre o conjurador enquanto o círculo gira -> disparo ->
// clarão -> CÚPULA de choque do tamanho REAL da área de dano (exec.radius, a mesma usada em systems/skillkinds.js) -> coluna e "cogumelo" de
// fumaça/energia na cor do elemento -> anel no chão. Só magias de ÁREA lendárias+ (BIG); o orçamento por tick do fxlib protege o celular.
const AREA = new Set(["aoe_self", "target_aoe", "field", "storm", "wave"]);
export const isCataclysm = (sk) => BIG(sk) && AREA.has(sk?.exec?.kind);
function cataclysm(c, v, sk, X, g, hitT, schedule) {
  const R = Math.max(4, Math.min(24, sk.exec?.radius ?? 6)), core = up(v.pos, 2.4);
  // esfera crescendo (camadas que convergem para uma casca cada vez maior)
  for (let k = 0; k < Math.max(3, hitT - 1); k++) after(k, () => implode(c, core, { col: k % 2 ? X.c2 : "white", tile: T.spark, n: N(c, g, 10), radius: 0.6 + k * 0.22, flat: 1, life: 0.3, size: 0.12 + k * 0.012, grow: 0.4 }));
  orbit(c, () => core, { col: X.c1, tile: T.orb, n: 3, r: 1.1, dur: hitT, step: 2, size: 0.32, speed: 2.4 });
  schedule((at) => {
    burst(c, up(at, 1), { col: "white", tile: T.flash ?? T.spark, n: N(c, g, 14), spd: R * 1.2, life: 0.35, size: 0.5 });
    for (let i = 0; i <= 6; i++) { const th = (i / 6) * 1.35, rr = R * Math.cos(th); after(1 + i * 0.6, () => ringFlat(c, up(at, R * Math.sin(th)), { col: i % 2 ? X.c1 : X.c2, tile: T.ring, n: Math.max(8, Math.round(N(c, g, 26) * Math.cos(th))), radius: rr, start: rr * 0.55, life: 0.45, size: 0.22, a: 0.8 })); }
    after(3, () => column(c, at, { col: X.c1, tile: T.smoke ?? T.cloud, n: N(c, g, 30), h: R * 1.3, life: 1.1, r: R * 0.18, size: 0.5 }));
    after(12, () => { const top = up(at, R * 1.3); ringFlat(c, top, { col: X.c2, tile: T.cloud ?? T.smoke, n: N(c, g, 22), radius: R * 0.55, start: R * 0.1, life: 0.9, size: 0.7, lift: 0.15 }); burst(c, top, { col: X.c1, tile: T.cloud ?? T.smoke, n: N(c, g, 16), spd: R * 0.4, up: 0.6, life: 1.1, size: 0.6 }); });
    for (let i = 0; i < 3; i++) after(2 + i * 4, () => ringFlat(c, up(at, 0.15), { col: i ? X.c2 : "white", tile: T.ring, n: N(c, g, 30), radius: R * (1 + i * 0.25), start: 0.5, life: 0.55, size: 0.24 }));
  });
}

/** Executa todas as fases da camada de grandeza (chamado por systems/skillfx.js). */
export function grandFx(c, v, sk, schedule, hitT = 8) {
  const g = (GRAND[sk.rarity] ?? 1) * (v.tier >= 3 ? 1.25 : v.tier >= 2 ? 1.1 : 1), X = grandOf(sk), big = BIG(sk);
  const run = (f) => { try { f(); } catch { /* efeitos nunca derrubam a habilidade */ } };
  // 1-4: formação, círculo, órbitas e núcleo
  run(() => { X.charge(c, v, g); disc(c, v.pos, { col: X.c1, circle: X.circle, size: big ? 4.2 : 2.4 + g * 0.4, life: 0.9, rot: 90, grow: 0.25 }); });
  if (g >= 1.4) run(() => runes(c, v.pos, X.c2, g * 0.6, 10));
  // 5: liberação
  after(2, () => run(() => burst(c, up(v.pos, 1.2), { col: X.c2, tile: T.spark, n: N(c, g, 12), spd: 3, life: 0.35, size: 0.1 })));
  // 6: rastro denso ao longo do trajeto
  const L = lenOf(v.from, v.to);
  if (L > 2) after(3, () => run(() => along(v.from, v.to, Math.min(28, Math.max(4, Math.round(L * 1.2 * Math.min(1.6, g)))), (p, t, i) => after(i * 0.4, () => run(() => X.trail(c, p, g))))));
  if (isCataclysm(sk)) run(() => cataclysm(c, v, sk, X, g, hitT, schedule));
  // 7-10: impacto em camadas, onda de choque, fragmentos e dissipação
  schedule((at) => {
    run(() => X.impact(c, at, g)); after(2, () => run(() => X.residue(c, at, g)));
    if (big) { run(() => disc(c, at, { col: X.c1, circle: X.circle, size: 7 + g, life: 1.6, rot: 40, grow: 0.15 })); after(1, () => run(() => X.big(c, { ...v, at }, g))); after(6, () => run(() => waves(c, at, X.c2, 3, 3.5 + g, 4))); }
  });
}

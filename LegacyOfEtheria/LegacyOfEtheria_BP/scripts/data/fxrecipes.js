// data/fxrecipes.js - Coreografia visual única por habilidade. Fases: cast (preparação/ativação) -> travel (trajetória) -> impact (impacto + efeito posterior).
// Cada receita combina padrões diferentes de fxlib (nada de "mesma explosão com outra cor"). Nível/tier maior => camadas extras.
import { mote, streak, disc, burst, implode, ringFlat, column, fan, arc, bolt, helix, orbit, snd, after, T, CIRCLE } from "../systems/fxlib.js";
import { SOUNDS } from "../config.js";
import { PACK_RECIPES } from "./fxpack.js";

const up = (p, y = 1) => ({ x: p.x, y: p.y + y, z: p.z });
const along = (a, b, n, f) => { for (let i = 1; i <= n; i++) { const t = i / n; f({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }, t, i); } };
const trail = (col, tile, n = 8, o = {}) => (c, v) => along(v.from, v.to, Math.min(n, Math.max(2, Math.floor(Math.hypot(v.to.x - v.from.x, v.to.y - v.from.y, v.to.z - v.from.z) / 2))), (p, t, i) =>
  after(i * 0.6, () => mote(c, p, { col, tile, size: 0.3 * (1 - t * 0.4), life: 0.5, spd: 0.2, dir: [0, 0.3, 0], ...o })));
const S = (id) => `etheria.sage.${id}`; // reservado para sons portados

export const RECIPES = {
  fireball: {
    cast: (c, v) => { disc(c, v.pos, { col: "fire", circle: CIRCLE.fire, size: 1.8, life: 0.7, rot: 90 }); implode(c, up(v.pos, 1.3), { col: "ember", tile: T.ember, n: 8, radius: 1.2, life: 0.4 }); },
    travel: (c, v) => { trail("fire", T.flame, 9)(c, v); trail("smoke", T.smoke, 5, { size: 0.35, a: 0.5 })(c, v); },
    impact: (c, v) => { burst(c, v.at, { col: "fire", tile: T.flame, n: 14, spd: 3, size: 0.4, up: 1 }); ringFlat(c, v.at, { col: "ember", tile: T.spark, radius: 2.5, n: 12, life: 0.4 }); if (v.tier > 1) after(5, () => column(c, v.at, { col: "ember", tile: T.ember, n: 6, h: 2.5, life: 0.9 })); },
  },
  ice_lance: {
    cast: (c, v) => { disc(c, v.pos, { col: "ice", circle: CIRCLE.ice, size: 2.2, life: 0.8, rot: -40 }); burst(c, up(v.pos, 1.4), { col: "frost", tile: T.flake, n: 6, spd: 1.2, life: 0.8 }); },
    travel: (c, v) => { streak(c, v.from, v.to, { col: "ice", w: 0.22, life: 0.3, tile: T.line }); trail("frost", T.shard, 6, { size: 0.25 })(c, v); },
    impact: (c, v) => { burst(c, v.at, { col: "ice", tile: T.shard, n: 12, spd: 4, size: 0.3 }); for (let i = 0; i < 4; i++) after(i * 2, () => mote(c, up(v.at, 0.2), { col: "frost", tile: T.flake, dir: [Math.cos(i * 1.6), 0.4, Math.sin(i * 1.6)], spd: 1.5, life: 1.2, size: 0.3 })); disc(c, v.at, { col: "frost", circle: CIRCLE.ice, size: 3, life: 1.6, rot: 10 }); },
  },
  lightning: {
    cast: (c, v) => { disc(c, v.pos, { col: "bolt", circle: CIRCLE.bolt, size: 2, life: 0.5, rot: 120 }); orbit(c, () => up(v.pos, 1), { col: "bolt", tile: T.spark, n: 3, r: 0.9, dur: 6, life: 0.3, speed: 3 }); },
    travel: (c, v) => bolt(c, v.from, v.to, { col: "bolt", branch: 0.4, jitter: 0.6 }),
    impact: (c, v) => { column(c, v.at, { col: "bolt", tile: T.zig, n: 6, h: 5, life: 0.3, r: 0.3 }); burst(c, v.at, { col: "white", tile: T.spark, n: 10, spd: 6, size: 0.2, life: 0.3 }); if (v.tier > 1) for (let i = 0; i < 3; i++) after(2 + i, () => bolt(c, up(v.at, 3), { x: v.at.x + (i - 1) * 1.5, y: v.at.y, z: v.at.z + 1 }, { col: "bolt", jitter: 0.4 })); },
  },
  energy_lance: {
    cast: (c, v) => { implode(c, up(v.pos, 1.4), { col: "arcane", tile: T.diamond, n: 10, radius: 1.6, life: 0.4 }); disc(c, v.pos, { col: "arcane", circle: CIRCLE.arcane, size: 1.6, life: 0.5 }); },
    travel: (c, v) => { streak(c, v.from, v.to, { col: "violet", w: 0.3, life: 0.25, tile: T.line }); streak(c, v.from, v.to, { col: "white", w: 0.1, life: 0.2, tile: T.line }); },
    impact: (c, v) => { ringFlat(c, v.at, { col: "arcane", tile: T.ring, radius: 2, n: 10, life: 0.35, size: 0.5 }); burst(c, v.at, { col: "violet", tile: T.diamond, n: 8, spd: 3 }); },
  },
  mana_burst: {
    cast: (c, v) => { implode(c, up(v.pos, 1), { col: "mana", tile: T.orb, n: 18, radius: 3, life: 0.8, size: 0.3 }); disc(c, v.pos, { col: "mana", circle: CIRCLE.arcane, size: 3, life: 1, rot: 60 }); },
    travel: () => {},
    impact: (c, v) => { ringFlat(c, v.at, { col: "mana", tile: T.ring, radius: 4.5, n: 20, life: 0.55, size: 0.7 }); ringFlat(c, v.at, { col: "white", tile: T.spark, radius: 3, n: 14, life: 0.4 }); burst(c, up(v.at, 1), { col: "mana", tile: T.orb, n: 14, spd: 4, size: 0.35 }); after(6, () => disc(c, v.at, { col: "mana", circle: CIRCLE.arcane, size: 5, life: 1.2, a: 0.5 })); },
  },
  dark_slash: {
    cast: (c, v) => { burst(c, up(v.pos, 1.2), { col: "shadow", tile: T.smoke, n: 5, spd: 0.8, a: 0.6 }); },
    travel: (c, v) => arc(c, v.pos, v.dir, { col: "violet", radius: 2.3, angle: 140, n: 7, tilt: 1.2, w: 0.2, life: 0.3, delay: 0.5 }),
    impact: (c, v) => { burst(c, up(v.at, 0.2), { col: "black", tile: T.smoke, n: 8, spd: 2, size: 0.5, a: 0.8 }); streak(c, { x: v.at.x - 0.8, y: v.at.y + 1.3, z: v.at.z }, { x: v.at.x + 0.8, y: v.at.y + 0.5, z: v.at.z }, { col: "violet", w: 0.15, life: 0.25 }); },
  },
  impact: {
    cast: (c, v) => { burst(c, v.pos, { col: "dust", tile: T.chunk, n: 4, spd: 1.2, up: 0.5 }); },
    travel: () => {},
    impact: (c, v) => { ringFlat(c, v.at, { col: "white", tile: T.ring, radius: 2.2, n: 10, life: 0.3, size: 0.55 }); burst(c, v.at, { col: "steel", tile: T.spark, n: 8, spd: 4, size: 0.2, life: 0.3 }); mote(c, up(v.at, 1), { col: "white", tile: T.star, size: 1.2, life: 0.18, grow: -1 }); },
  },
  earth_slam: {
    cast: (c, v) => { disc(c, v.pos, { col: "earth", circle: CIRCLE.earth, size: 2.4, life: 0.7 }); },
    travel: () => {},
    impact: (c, v) => { ringFlat(c, v.at, { col: "dust", tile: T.chunk, radius: 5, n: 20, life: 0.6, size: 0.4, lift: 0.4 }); burst(c, v.at, { col: "earth", tile: T.chunk, n: 14, spd: 4, up: 1.4, size: 0.35, acc: [0, -9, 0] }); disc(c, v.at, { col: "earth", circle: CIRCLE.earth, size: 5.5, life: 1.2 }); },
  },
  water_surge: {
    cast: (c, v) => { disc(c, v.pos, { col: "water", circle: CIRCLE.water, size: 2.2, life: 0.8, rot: 50 }); helix(c, v.pos, { col: "foam", tile: T.bubble, r: 0.9, h: 2, steps: 10, turns: 1.5 }); },
    travel: (c, v) => trail("water", T.drop, 8, { size: 0.3, acc: [0, -3, 0] })(c, v),
    impact: (c, v) => { column(c, v.at, { col: "water", tile: T.drop, n: 12, h: 3, life: 0.7, r: 1.2, acc: [0, -6, 0] }); ringFlat(c, v.at, { col: "foam", tile: T.bubble, radius: 4, n: 16, life: 0.6 }); },
  },
  wind_dash: {
    cast: (c, v) => { ringFlat(c, v.pos, { col: "wind", tile: T.cloud, radius: 1.5, n: 8, life: 0.35, a: 0.7 }); },
    travel: (c, v) => { for (let i = 0; i < 3; i++) streak(c, { x: v.from.x + (i - 1) * 0.35, y: v.from.y + 0.6 + i * 0.4, z: v.from.z }, { x: v.to.x + (i - 1) * 0.35, y: v.to.y + 0.6 + i * 0.4, z: v.to.z }, { col: "wind", w: 0.1, life: 0.35, a: 0.7 }); },
    impact: (c, v) => { burst(c, v.at, { col: "wind", tile: T.cloud, n: 6, spd: 2, a: 0.6 }); },
  },
  teleport: {
    cast: (c, v) => { disc(c, v.pos, { col: "arcane", circle: CIRCLE.space, size: 2, life: 0.6, rot: 160 }); implode(c, up(v.pos, 1), { col: "violet", tile: T.spark, n: 12, radius: 1.5, life: 0.3 }); },
    travel: (c, v) => streak(c, up(v.from, 1), up(v.to, 1), { col: "violet", w: 0.12, life: 0.4, a: 0.6 }),
    impact: (c, v) => { disc(c, v.at, { col: "arcane", circle: CIRCLE.space, size: 2, life: 0.6, rot: -160 }); burst(c, up(v.at, 1), { col: "violet", tile: T.star, n: 10, spd: 3, size: 0.3 }); },
  },
  heal: {
    cast: (c, v) => { disc(c, v.pos, { col: "holy", circle: CIRCLE.holy, size: 2.6, life: 1.2, rot: 25 }); helix(c, v.pos, { col: "green", tile: T.heart, r: 0.8, h: 2.2, steps: 9, size: 0.22, life: 0.8 }); },
    travel: () => {},
    impact: (c, v) => { column(c, v.at, { col: "green", tile: T.cross, n: 6, h: 2, life: 1, r: 0.5, size: 0.25 }); },
  },
  holy_light: {
    cast: (c, v) => { disc(c, v.pos, { col: "holy", circle: CIRCLE.holy, size: 5, life: 1.8, rot: 20 }); helix(c, v.pos, { col: "light", tile: T.star, r: 1.4, h: 4, steps: 16, turns: 2.5 }); },
    travel: () => {},
    impact: (c, v) => { column(c, v.at, { col: "light", tile: T.line, n: 14, h: 9, life: 1, r: 1.2, size: 0.25 }); ringFlat(c, v.at, { col: "gold", tile: T.ring, radius: 6, n: 18, life: 0.8 }); },
  },
  barrier: {
    cast: (c, v) => { disc(c, v.pos, { col: "arcane", circle: CIRCLE.arcane, size: 3, life: 1.5, rot: 15 }); orbit(c, () => up(v.pos, 1), { col: "violet", tile: T.diamond, n: 4, r: 1.3, dur: 16, wob: 1, size: 0.25 }); },
    travel: () => {}, impact: (c, v) => { ringFlat(c, up(v.at, 0.8), { col: "violet", tile: T.ring, radius: 1.6, n: 12, life: 0.4 }); },
  },
  blood_slash: {
    cast: (c, v) => { burst(c, up(v.pos, 1.2), { col: "blood", tile: T.drop, n: 6, spd: 1, acc: [0, -4, 0] }); },
    travel: (c, v) => { arc(c, v.pos, v.dir, { col: "blood", radius: 2.4, angle: 160, n: 8, tilt: -1, w: 0.22, life: 0.35 }); },
    impact: (c, v) => { burst(c, up(v.at, 1), { col: "blood", tile: T.drop, n: 12, spd: 3, size: 0.25, acc: [0, -9, 0] }); disc(c, v.at, { col: "blood", circle: CIRCLE.blood, size: 2.4, life: 1.2 }); },
  },
  void_rift: {
    cast: (c, v) => { disc(c, v.pos, { col: "void", circle: CIRCLE.void, size: 3, life: 1, rot: -90 }); },
    travel: () => {},
    impact: (c, v) => { disc(c, v.at, { col: "void", circle: CIRCLE.void, size: 6, life: 2, rot: 70 }); implode(c, up(v.at, 1), { col: "violet", tile: T.orb, n: 20, radius: 5, life: 0.9, size: 0.3 }); after(8, () => burst(c, up(v.at, 1), { col: "black", tile: T.smoke, n: 10, spd: 2, size: 0.8, a: 0.8 })); },
  },
  summon_guardian: {
    cast: (c, v) => { disc(c, v.pos, { col: "arcane", circle: CIRCLE.arcane, size: 4, life: 1.6, rot: 40 }); helix(c, v.pos, { col: "violet", tile: T.rune1, r: 1.5, h: 3, steps: 14 }); },
    travel: () => {}, impact: (c, v) => { column(c, v.at, { col: "arcane", tile: T.glyph, n: 10, h: 3, life: 1 }); },
  },
  dragon_breath: {
    cast: (c, v) => { disc(c, v.pos, { col: "fire", circle: CIRCLE.fire, size: 3, life: 1.2 }); implode(c, up(v.pos, 1.5), { col: "ember", tile: T.flame, n: 14, radius: 2, life: 0.6 }); },
    travel: (c, v) => { fan(c, v.from, v.dir, { col: "fire", tile: T.flame, n: 16, angle: 28, spd: 12, size: 0.6, life: 0.7 }); fan(c, v.from, v.dir, { col: "smoke", tile: T.smoke, n: 6, angle: 36, spd: 8, size: 0.8, life: 0.9, a: 0.5 }); },
    impact: (c, v) => { burst(c, v.at, { col: "fire", tile: T.flame, n: 14, spd: 4, size: 0.6, up: 1 }); disc(c, v.at, { col: "fire", circle: CIRCLE.fire, size: 4, life: 1.5 }); },
  },
  demon_flame: {
    cast: (c, v) => { burst(c, up(v.pos, 1), { col: "ember", tile: T.ember, n: 8, spd: 1.5 }); },
    travel: trail("ember", T.flame, 8, { size: 0.35 }),
    impact: (c, v) => { column(c, v.at, { col: "fire", tile: T.flame, n: 10, h: 3.5, r: 0.8, life: 0.9, size: 0.4 }); disc(c, v.at, { col: "ember", circle: CIRCLE.fire, size: 3, life: 1.2, rot: -50 }); },
  },
  war_cry: {
    cast: (c, v) => { ringFlat(c, v.pos, { col: "gold", tile: T.ring, radius: 6, n: 22, life: 0.6, size: 0.6 }); burst(c, up(v.pos, 1.7), { col: "white", tile: T.star, n: 8, spd: 4, size: 0.3 }); },
    travel: () => {}, impact: () => {},
  },
  royal_decree: {
    cast: (c, v) => { disc(c, v.pos, { col: "gold", circle: CIRCLE.holy, size: 6, life: 2, rot: 15 }); column(c, v.pos, { col: "gold", tile: T.star, n: 12, h: 6, life: 1.2, r: 1 }); },
    travel: () => {}, impact: () => {},
  },
  soul_drain: {
    cast: (c, v) => { disc(c, v.pos, { col: "shadow", circle: CIRCLE.devour, size: 2.4, life: 0.9 }); },
    travel: (c, v) => along(v.to, v.from, 6, (p, t, i) => after(i, () => mote(c, p, { col: "sage", tile: T.skull, size: 0.25, life: 0.4, dir: [0, 0.2, 0], spd: 0.5 }))),
    impact: (c, v) => { implode(c, up(v.at, 1), { col: "shadow", tile: T.skull, n: 8, radius: 1.5, life: 0.5, size: 0.25 }); },
  },
  dragon_roar: {
    cast: (c, v) => { ringFlat(c, up(v.pos, 1.4), { col: "fire", tile: T.ring, radius: 7, n: 24, life: 0.7, size: 0.8 }); ringFlat(c, up(v.pos, 1.4), { col: "ember", tile: T.ring, radius: 4, n: 16, life: 0.5, size: 0.6 }); disc(c, v.pos, { col: "fire", circle: CIRCLE.fire, size: 5, life: 1.2 }); },
    travel: () => {}, impact: (c, v) => { burst(c, up(v.at, 1), { col: "ember", tile: T.ember, n: 6, spd: 3 }); },
  },
  power_strike: {
    cast: () => {}, travel: () => {},
    impact: (c, v) => { mote(c, up(v.at, 1), { col: "white", tile: T.cross, size: 1.4, life: 0.16, grow: -1 }); burst(c, up(v.at, 1), { col: "steel", tile: T.spark, n: 10, spd: 5, size: 0.2, life: 0.25 }); ringFlat(c, v.at, { col: "gold", tile: T.ring, radius: 1.6, n: 8, life: 0.25 }); },
  },
  arcane_surge: {
    cast: (c, v) => { disc(c, v.pos, { col: "arcane", circle: CIRCLE.arcane, size: 3.5, life: 1.6, rot: 70 }); orbit(c, () => up(v.pos, 1), { col: "violet", tile: T.rune2, n: 3, r: 1.1, dur: 14, wob: 2, size: 0.3 }); column(c, v.pos, { col: "mana", tile: T.diamond, n: 8, h: 3, life: 0.9 }); },
    travel: () => {}, impact: () => {},
  },
  shadow_step: {
    cast: (c, v) => { burst(c, up(v.pos, 1), { col: "black", tile: T.smoke, n: 8, spd: 1.5, a: 0.8, size: 0.6 }); },
    travel: (c, v) => along(v.from, v.to, 5, (p, t, i) => after(i, () => mote(c, up(p, 1), { col: "shadow", tile: T.smoke, size: 0.7, life: 0.6, a: 0.6, spd: 0.1 }))),
    impact: (c, v) => { burst(c, up(v.at, 1), { col: "violet", tile: T.wing, n: 6, spd: 2, size: 0.35 }); },
  },
  divine_shield: {
    cast: (c, v) => { disc(c, v.pos, { col: "gold", circle: CIRCLE.holy, size: 3, life: 1.5, rot: 25 }); orbit(c, () => up(v.pos, 1), { col: "gold", tile: T.diamond, n: 5, r: 1.2, dur: 20, size: 0.25, speed: 1.4 }); },
    travel: () => {}, impact: (c, v) => { ringFlat(c, up(v.at, 0.9), { col: "gold", tile: T.spark, radius: 1.5, n: 10, life: 0.4 }); },
  },
  piercing_shot: {
    cast: () => {},
    travel: (c, v) => { streak(c, v.from, v.to, { col: "steel", w: 0.09, life: 0.3, tile: T.line }); streak(c, v.from, v.to, { col: "white", w: 0.04, life: 0.2 }); },
    impact: (c, v) => { burst(c, v.at, { col: "steel", tile: T.spark, n: 7, spd: 4, size: 0.18, life: 0.25 }); mote(c, v.at, { col: "white", tile: T.star, size: 0.8, life: 0.15 }); },
  },
  shield_bash: {
    cast: () => {}, travel: () => {},
    impact: (c, v) => { ringFlat(c, up(v.at, 1), { col: "steel", tile: T.ring, radius: 2, n: 10, life: 0.3, size: 0.5 }); burst(c, up(v.at, 1), { col: "steel", tile: T.chunk, n: 6, spd: 3, size: 0.2 }); },
  },
  berserk_rage: {
    cast: (c, v) => { disc(c, v.pos, { col: "blood", circle: CIRCLE.blood, size: 3, life: 1.4, rot: 140 }); column(c, v.pos, { col: "blood", tile: T.flame, n: 10, h: 3, life: 0.9, r: 0.7 }); orbit(c, () => up(v.pos, 1.2), { col: "ember", tile: T.ember, n: 3, r: 0.8, dur: 14, size: 0.25 }); },
    travel: () => {}, impact: () => {},
  },
  predator: {
    cast: (c, v) => { disc(c, v.pos, { col: "shadow", circle: CIRCLE.devour, size: 2.4, life: 0.8, rot: -60 }); implode(c, up(v.pos, 1), { col: "violet", tile: T.fang, n: 8, radius: 1.8, life: 0.4 }); },
    travel: (c, v) => along(v.to, v.from, 5, (p, t, i) => after(i, () => mote(c, p, { col: "violet", tile: T.skull, size: 0.22, life: 0.35, dir: [0, 0.2, 0], spd: 0.4 }))),
    impact: (c, v) => { burst(c, up(v.at, 1), { col: "black", tile: T.smoke, n: 6, spd: 1.5, size: 0.6, a: 0.8 }); },
  },
  gluttony: {
    cast: (c, v) => { disc(c, v.pos, { col: "void", circle: CIRCLE.devour, size: 6, life: 1.4, rot: -90 }); implode(c, up(v.pos, 1), { col: "violet", tile: T.fang, n: 16, radius: 5, life: 0.8 }); },
    travel: () => {},
    impact: (c, v) => { disc(c, v.pos, { col: "black", circle: CIRCLE.void, size: 8, life: 1.6, rot: 50, a: 0.7 }); burst(c, up(v.pos, 1), { col: "violet", tile: T.skull, n: 12, spd: 3 }); },
  },
};

// fallback por elemento (para skills sem receita própria)
const ELEM = { fire: "fireball", ice: "ice_lance", lightning: "lightning", arcane: "energy_lance", shadow: "dark_slash", physical: "impact", earth: "earth_slam", water: "water_surge", wind: "wind_dash", light: "heal", blood: "blood_slash", void: "void_rift" };
export const recipeFor = (sk) => RECIPES[sk.id] ?? PACK_RECIPES[sk.id] ?? RECIPES[ELEM[sk.element]] ?? RECIPES.impact;
export const tierOf = (level) => (level >= 40 ? 3 : level >= 15 ? 2 : 1);
export { snd, SOUNDS, S };

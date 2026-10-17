// systems/elementfx.js - 6.82: IDENTIDADE VISUAL DE CADA ELEMENTO em todas as magias (jogador, NPC e chefes).
// Uma camada que se SOMA às coreografias existentes (receitas, partículas portadas, corpos 3D) nas 5 fases:
//   carga (formação nas mãos + círculo do elemento)  lançamento (clarão de saída)  trajeto (rastro próprio)  impacto  resíduo.
// Cada elemento tem forma, movimento e cor próprios (fogo não é só partícula vermelha: língua de chama subindo, brasas com gravidade
// invertida, fumaça escura, anel de chamas no chão; gelo: estilhaços que caem, cristais que brotam do chão, névoa fria; raio: ramificações,
// faíscas em zigue-zague, clarão; etc.). A ESCALA vem do poder da magia: básica, avançada, única, ultimate (raridade/categoria) e do raio real.
// Orçamento: tudo passa por fxlib (limite por tick e nível de detalhe do jogador).
import { mote, streak, disc, layer, burst, implode, ringFlat, column, helix, bolt, after, nn, snd, T, CIRCLE } from "./fxlib.js";

const V = (x, y, z) => ({ x, y, z });
const up = (p, h) => V(p.x, p.y + h, p.z);
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const FAM = { bolt: "lightning", holy: "light", gold: "light", void: "shadow", green: "nature", physical: "physical" };
export const elemOf = (sk) => FAM[sk?.element] ?? sk?.element ?? "arcane";
const RANK = { common: 0, uncommon: 0, rare: 1, epic: 1, legendary: 2, mythic: 2, divine: 3 };
/** 0 básica · 1 avançada · 2 única · 3 ultimate */
export function classOf(sk) {
  if (!sk) return 1;
  if (sk.cat === "Ultimate") return 3;
  let r = RANK[sk.rarity] ?? 1;
  if (sk.cat === "Única" && r < 2) r = 2;
  return r;
}
const SCALE = [0.7, 1, 1.4, 2];
const CIRC = { fire: CIRCLE.fire, ice: CIRCLE.ice, lightning: CIRCLE.bolt, wind: CIRCLE.wind, water: CIRCLE.water, earth: CIRCLE.earth, light: CIRCLE.holy, shadow: CIRCLE.shadow, blood: CIRCLE.blood, arcane: CIRCLE.arcane, nature: CIRCLE.evolve, physical: CIRCLE.gravity };
const COL = { fire: ["fire", "ember"], ice: ["ice", "frost"], lightning: ["bolt", "white"], wind: ["wind", "white"], water: ["water", "foam"], earth: ["earth", "dust"], light: ["light", "gold"],
  shadow: ["shadow", "black"], blood: ["blood", "ember"], arcane: ["arcane", "violet"], nature: ["green", "toxic"], physical: ["steel", "white"] };
// sons por elemento (só sons nativos estáveis): lançamento, impacto
const SND = { fire: ["mob.blaze.shoot", "random.explode"], ice: ["random.glass", "random.glass"], lightning: ["ambient.weather.lightning.impact", "ambient.weather.thunder"],
  wind: ["mob.phantom.flap", "item.trident.riptide_1"], water: ["random.splash", "random.splash"], earth: ["dig.stone", "random.explode"], light: ["beacon.power_select", "random.orb"],
  shadow: ["mob.endermen.portal", "mob.wither.shoot"], blood: ["mob.slime.attack", "mob.slime.big"], arcane: ["mob.evocation_illager.cast_spell", "random.orb"],
  nature: ["dig.grass", "mob.slime.big"], physical: ["random.anvil_land", "random.anvil_land"] };

// ------------------------------------------------------------------ CARGA (chamada a cada quadro da formação)
export function chargeFrame(c, sk, f) {
  if (!c || c.k <= 0) return;
  const el = elemOf(sk), k = classOf(sk), [a, b] = COL[el] ?? COL.arcane, hand = f.hand ?? up(f.feet, 1.3), i = f.i ?? 0;
  if (i === 0) {
    layer(c, f.feet, { tile: CIRC[el] ?? CIRCLE.arcane, size: 2.2 + k * 1.3, rot: 70, life: (f.n ?? 8) / 20 + 0.5, col: a, a: 0.85, grow: 0.1 });
    if (k >= 2) layer(c, f.feet, { tile: CIRCLE.sage, size: 1.4 + k, rot: -110, life: (f.n ?? 8) / 20 + 0.4, col: b, a: 0.7, y: 0.1 });
  }
  if (i % 2) return;
  const n = 2 + k;
  switch (el) {
    case "fire": for (let j = 0; j < n; j++) mote(c, V(hand.x + rnd(-0.3, 0.3), hand.y - 0.1, hand.z + rnd(-0.3, 0.3)), { col: j % 2 ? a : b, dir: [0, 1, 0], spd: 1.2, size: 0.18, life: 0.4, tile: T.flame, grow: -0.3 }); break;
    case "ice": implode(c, hand, { col: b, n, radius: 1.2, life: 0.4, size: 0.14, tile: T.flake }); break;
    case "lightning": if (Math.random() < 0.6) bolt(c, hand, V(hand.x + rnd(-0.9, 0.9), hand.y + rnd(-0.6, 0.6), hand.z + rnd(-0.9, 0.9)), { col: a, w: 0.05, seg: 3, jitter: 0.25, life: 0.1 }); break;
    case "wind": helix(c, f.feet, { col: a, steps: 3, turns: 0.4, r: 0.9, h: 2, dur: 2, phase: i / 2, tile: T.arc, size: 0.22 }); break;
    case "water": implode(c, hand, { col: j2(i, a, b), n, radius: 1.1, life: 0.35, size: 0.16, tile: T.drop }); break;
    case "earth": for (let j = 0; j < n; j++) mote(c, V(f.feet.x + rnd(-1.2, 1.2), f.feet.y + 0.1, f.feet.z + rnd(-1.2, 1.2)), { col: b, dir: [0, 1, 0], spd: 2, size: 0.2, life: 0.45, tile: T.chunk, acc: [0, -6, 0] }); break;
    case "light": implode(c, hand, { col: a, n, radius: 1.4, life: 0.35, size: 0.16, tile: T.star }); break;
    case "shadow": implode(c, hand, { col: j2(i, a, b), n, radius: 1.6, life: 0.45, size: 0.3, tile: T.smoke }); break;
    case "blood": implode(c, hand, { col: a, n, radius: 1.2, life: 0.4, size: 0.15, tile: T.drop }); break;
    case "nature": for (let j = 0; j < n; j++) mote(c, V(f.feet.x + rnd(-1, 1), f.feet.y + 0.1, f.feet.z + rnd(-1, 1)), { col: a, dir: [0, 1, 0], spd: 1, size: 0.18, life: 0.6, tile: T.leaf }); break;
    default: implode(c, hand, { col: j2(i, a, b), n, radius: 1.3, life: 0.4, size: 0.16, tile: T.rune1 + (i % 3) });
  }
}
const j2 = (i, a, b) => (i % 4 ? a : b);

// ------------------------------------------------------------------ LANÇAMENTO + TRAJETO
export function releaseFx(c, v, sk, T_ = 0) {
  if (!c || c.k <= 0 || !v) return;
  const el = elemOf(sk), k = classOf(sk), [a, b] = COL[el] ?? COL.arcane, from = v.hand ?? v.from ?? v.pos, at = v.at ?? v.to;
  burst(c, from, { col: a, n: 4 + k * 3, spd: 2.5, life: 0.3, size: 0.2, tile: T.spark });
  try { snd(c, SND[el]?.[0], { vol: 0.5 + k * 0.15, pitch: rnd(0.9, 1.15) }); } catch { /* ignore */ }
  if (!at || !T_ || T_ < 2) return;
  const steps = Math.min(T_, 16);
  for (let s = 1; s <= steps; s++) after(Math.round((s / steps) * T_), () => {
    const p = lerp(from, at, s / steps), q = lerp(from, at, (s - 1) / steps);
    switch (el) {
      case "fire": mote(c, p, { col: s % 2 ? a : b, dir: [0, 1, 0], spd: 0.8, size: 0.22 + k * 0.06, life: 0.4, tile: T.flame }); mote(c, p, { col: "black", dir: [0, 1, 0], spd: 0.5, size: 0.35, life: 0.7, tile: T.smoke, a: 0.5 }); break;
      case "ice": mote(c, p, { col: b, dir: [0, -1, 0], spd: 1.2, size: 0.14, life: 0.5, tile: T.flake, acc: [0, -3, 0] }); break;
      case "lightning": bolt(c, q, p, { col: s % 3 ? a : b, w: 0.08 + k * 0.03, seg: 2, jitter: 0.35, life: 0.12 }); break;
      case "wind": streak(c, q, p, { col: a, w: 0.06, life: 0.25, tile: T.arc }); break;
      case "water": mote(c, p, { col: s % 2 ? a : b, dir: [0, -1, 0], spd: 1, size: 0.16, life: 0.4, tile: T.drop, acc: [0, -6, 0] }); break;
      case "earth": mote(c, p, { col: b, dir: [0, -1, 0], spd: 1.5, size: 0.2, life: 0.5, tile: T.chunk, acc: [0, -8, 0] }); break;
      case "light": streak(c, q, p, { col: s % 2 ? a : b, w: 0.08, life: 0.3, tile: T.line }); break;
      case "shadow": mote(c, p, { col: s % 2 ? a : b, dir: [0, 0.2, 0], spd: 0.2, size: 0.4, life: 0.6, tile: T.smoke, a: 0.8 }); break;
      case "blood": mote(c, p, { col: a, dir: [0, -1, 0], spd: 1.2, size: 0.13, life: 0.5, tile: T.drop, acc: [0, -8, 0] }); break;
      default: mote(c, p, { col: s % 2 ? a : b, size: 0.18, life: 0.35, tile: T.rune1 + (s % 3) });
    }
  });
}

// ------------------------------------------------------------------ IMPACTO + RESÍDUO
export function impactFx(c, v, sk, o = {}) {
  if (!c || c.k <= 0) return;
  const at = v?.at ?? v?.to ?? v?.pos; if (!at) return;
  const el = o.el ?? elemOf(sk), k = o.k ?? classOf(sk), [a, b] = COL[el] ?? COL.arcane, s = SCALE[k];
  const R = Math.max(1.2, Math.min(18, (sk?.exec?.radius ?? 1.6) * (k >= 2 ? 1 : 0.9)));
  const g = V(at.x, Math.floor(at.y) + 0.05, at.z);
  try { snd(c, SND[el]?.[1], { at, vol: 0.5 + k * 0.25, pitch: rnd(0.75, 1.05) }); } catch { /* ignore */ }
  switch (el) {
    case "fire":
      burst(c, at, { col: a, n: 10 * s, spd: 4 * s, life: 0.45, size: 0.3, tile: T.flame, up: 0.7 });
      for (let i = 0; i < nn(c, 8 * s); i++) mote(c, V(at.x + rnd(-R, R) * 0.6, at.y, at.z + rnd(-R, R) * 0.6), { col: b, dir: [rnd(-0.3, 0.3), 1, rnd(-0.3, 0.3)], spd: rnd(1, 3), size: 0.1, life: 1.2, tile: T.ember, acc: [0, 1.5, 0] });
      ringFlat(c, g, { col: a, n: 12 * s, radius: R, life: 0.45, size: 0.3, tile: T.flame });
      after(4, () => column(c, at, { col: "black", n: 4 * s, h: 3 + k, r: R * 0.4, tile: T.smoke, life: 1.2, size: 0.6, a: 0.6 }));
      if (k >= 2) after(2, () => disc(c, g, { col: "ember", circle: CIRCLE.fire, size: R * 1.8, life: 1.2 }));
      break;
    case "ice":
      burst(c, at, { col: b, n: 10 * s, spd: 4 * s, life: 0.5, size: 0.22, tile: T.shard, acc: [0, -6, 0] });
      for (let i = 0; i < nn(c, 3 + k * 2); i++) { const p = V(at.x + rnd(-R, R) * 0.7, g.y, at.z + rnd(-R, R) * 0.7); column(c, p, { col: i % 2 ? a : b, n: 3, h: 1.2 + k * 0.6, r: 0.15, tile: T.diamond, life: 0.9, size: 0.35 }); }
      ringFlat(c, g, { col: "frost", n: 12 * s, radius: R, life: 0.7, size: 0.4, tile: T.cloud, a: 0.6 });
      after(6, () => burst(c, at, { col: "frost", n: 6 * s, spd: 0.6, life: 1.4, size: 0.5, tile: T.cloud, a: 0.4 }));
      break;
    case "lightning":
      for (let i = 0; i < 1 + k; i++) bolt(c, up(at, 6 + k * 3), at, { col: i ? a : b, w: 0.12 + k * 0.05, branch: 0.3, life: 0.2 });
      burst(c, at, { col: a, n: 10 * s, spd: 5 * s, life: 0.3, size: 0.18, tile: T.zig });
      for (let i = 0; i < nn(c, 3 + k); i++) bolt(c, at, V(at.x + rnd(-R, R), at.y + rnd(-0.2, 1), at.z + rnd(-R, R)), { col: a, w: 0.06, seg: 3, jitter: 0.4, life: 0.15 });
      mote(c, up(at, 0.5), { col: "white", size: 1.2 + k * 0.6, life: 0.12, tile: T.star });
      break;
    case "wind":
      for (let r = 0; r < 2 + Math.min(2, k); r++) after(r * 2, () => ringFlat(c, up(g, 0.2 + r * 0.5), { col: r % 2 ? a : b, n: 10 * s, radius: R * (0.6 + r * 0.25), life: 0.4, size: 0.3, tile: T.arc, lift: 0.25 }));
      helix(c, g, { col: a, steps: 10 * s, turns: 2, r: R * 0.5, h: 3 + k, dur: 8, tile: T.arc, size: 0.3 });
      burst(c, at, { col: "dust", n: 5 * s, spd: 3, life: 0.5, size: 0.4, tile: T.smoke, a: 0.5 });
      break;
    case "water":
      burst(c, at, { col: a, n: 12 * s, spd: 4, life: 0.6, size: 0.2, tile: T.drop, up: 1, acc: [0, -10, 0] });
      ringFlat(c, g, { col: b, n: 14 * s, radius: R, life: 0.5, size: 0.35, tile: T.bubble });
      column(c, at, { col: b, n: 5 * s, h: 1.5 + k, r: 0.5, tile: T.drop, life: 0.5, acc: [0, -10, 0] });
      break;
    case "earth":
      burst(c, at, { col: a, n: 8 * s, spd: 5, life: 0.7, size: 0.35, tile: T.chunk, up: 1, acc: [0, -14, 0] });
      for (let i = 0; i < nn(c, 5 + k * 2); i++) { const ang = rnd(0, Math.PI * 2), r1 = R * rnd(0.6, 1.1); streak(c, g, V(g.x + Math.cos(ang) * r1, g.y, g.z + Math.sin(ang) * r1), { col: "black", w: 0.1, life: 0.9, tile: T.line, a: 0.7 }); }
      ringFlat(c, g, { col: b, n: 12 * s, radius: R, life: 0.6, size: 0.5, tile: T.smoke, a: 0.6 });
      break;
    case "light":
      column(c, at, { col: a, n: 8 * s, h: 5 + k * 3, r: 0.4 + k * 0.2, tile: T.line, life: 0.5 });
      burst(c, at, { col: b, n: 10 * s, spd: 4, life: 0.5, size: 0.22, tile: T.star });
      ringFlat(c, g, { col: a, n: 12 * s, radius: R, life: 0.45, size: 0.25, tile: T.cross });
      if (k >= 2) disc(c, g, { col: "holy", circle: CIRCLE.holy, size: R * 1.8, life: 1 });
      break;
    case "shadow":
      implode(c, at, { col: b, n: 10 * s, radius: R, life: 0.45, size: 0.45, tile: T.smoke });
      after(8, () => burst(c, at, { col: a, n: 10 * s, spd: 3 * s, life: 0.6, size: 0.4, tile: T.shard }));
      if (k >= 1) layer(c, up(at, 0.6), { plane: "xy", tile: CIRCLE.void, size: 1.4 + k, rot: 200, life: 0.6, col: a, a: 0.9 });
      after(10, () => ringFlat(c, g, { col: "black", n: 10 * s, radius: R, life: 0.8, size: 0.6, tile: T.smoke, a: 0.7 }));
      break;
    case "blood":
      burst(c, at, { col: a, n: 12 * s, spd: 4, life: 0.6, size: 0.16, tile: T.drop, acc: [0, -10, 0] });
      ringFlat(c, g, { col: a, n: 10 * s, radius: R, life: 0.8, size: 0.5, tile: T.cloud, a: 0.5 });
      break;
    case "nature":
      burst(c, at, { col: a, n: 10 * s, spd: 3, life: 0.8, size: 0.2, tile: T.leaf, acc: [0, -2, 0] });
      ringFlat(c, g, { col: b, n: 10 * s, radius: R, life: 0.6, size: 0.3, tile: T.leaf });
      break;
    case "physical":
      burst(c, at, { col: a, n: 8 * s, spd: 4, life: 0.3, size: 0.2, tile: T.spark });
      ringFlat(c, g, { col: "dust", n: 10 * s, radius: R * 0.8, life: 0.4, size: 0.45, tile: T.smoke, a: 0.6 });
      break;
    default:
      burst(c, at, { col: a, n: 10 * s, spd: 3.5, life: 0.5, size: 0.2, tile: T.rune1 });
      ringFlat(c, g, { col: b, n: 12 * s, radius: R, life: 0.5, size: 0.3, tile: T.glyph });
      layer(c, up(at, 0.4), { plane: "xy", tile: CIRCLE.arcane, size: 1.2 + k, rot: 160, life: 0.5, col: a });
  }
  // resíduo (dissipação) — magias únicas e ultimate deixam o elemento no chão por mais tempo
  if (k >= 1) after(14, () => {
    const n = 2 + k * 2;
    for (let i = 0; i < nn(c, n); i++) {
      const p = V(at.x + rnd(-R, R) * 0.6, g.y + 0.1, at.z + rnd(-R, R) * 0.6);
      const t = { fire: T.ember, ice: T.flake, lightning: T.zig, water: T.bubble, earth: T.chunk, light: T.star, shadow: T.smoke, blood: T.drop, nature: T.leaf }[el] ?? T.spark;
      mote(c, p, { col: b, dir: [0, 1, 0], spd: el === "ice" || el === "earth" ? 0.2 : 0.7, size: 0.18, life: 1.2, tile: t, a: 0.8 });
    }
  });
}

// ------------------------------------------------------------------ chefes / NPC: elemento pelo nome da habilidade
const BOSS_EL = [[/fire|flame|ember|inferno|magma|blaze|burn|meteor|hell/, "fire"], [/ice|frost|frozen|glacial|snow|blizzard/, "ice"], [/bolt|thunder|lightning|storm|spark|zap/, "lightning"],
  [/wind|gust|tornado|cyclone|gale/, "wind"], [/water|wave|tide|aqua|bubble|flood/, "water"], [/earth|stone|rock|quake|ground|slam|pillar/, "earth"],
  [/holy|light|sun|judg|divine|megiddo|smite|heal/, "light"], [/void|shadow|dark|abyss|death|curse|chaos|gravity|rift/, "shadow"], [/blood|drain|leech/, "blood"],
  [/poison|toxic|venom|acid|thorn|vine/, "nature"]];
export function bossElement(id) { for (const [rx, el] of BOSS_EL) if (rx.test(id)) return el; return null; }
/** impacto com identidade para golpes de chefes/NPC (classe 1 avançada; 2 para chefes) */
export function bossImpact(c, id, at, boss) {
  const el = bossElement(String(id)); if (!el || !at) return;
  impactFx(c, { at }, null, { el, k: boss ? 2 : 1 });
}

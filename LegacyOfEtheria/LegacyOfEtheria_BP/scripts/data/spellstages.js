// data/spellstages.js - Coreografias das magias em FASES: FORMAÇÃO -> LIBERAÇÃO -> TRAJETO -> IMPACTO (+ efeito residual).
// O diretor (systems/spellstage.js) cuida do tempo, da mira, do dano e da recarga; aqui só há o que se VÊ e se OUVE.
// Cada coreografia pode definir:
//   windup (ticks de formação) · speed (blocos/tick do trajeto) · minT (duração mínima do trajeto, em ticks) · timing "arrive"|"pass" (dano na chegada ou ao ser atravessado) · hand (origem na mão)
//   sfx { form, release, impact }: [{ id, vol, pitch, at }]     (at: true = também ouvido por quem está perto do ponto de impacto)
//   form(c, f)     a cada tick da formação   f: { i, n, t(0..1), head, feet, hand, dir, hdir, right, u, w, aim(range), ex, v0 }
//   release(c, v)  uma vez, no instante do disparo
//   fly(c, p, f)   a cada tick do trajeto    f: { i, n, t, dir, hdir, right, prev, from, to, ex, tier }
//   impact(c, v)   na chegada                v: { from, to, at, dir, tier, ex, dist, T, pos, hand }
//   onHit(c, e, v) quando o dano é aplicado a cada alvo
//   Tempestades: sky(c, center, R, i, n) · telegraph(c, p, i, n) · strike(c, p, i, n, ex) · delay (ticks entre aviso e raio)
//   Escudos:     holdFx(c, f, k, total) a cada pulso enquanto durar · end(c, f, broken) ao terminar
// Orçamento: tudo passa por fxlib (nn() escala pelo nível de efeitos; canSpawn() limita por tick), então "baixo/desligado" ficam leves.
import { mote, streak, disc, burst, implode, ringFlat, column, bolt, helix, nn, after, T, CIRCLE } from "../systems/fxlib.js";

const TAU = Math.PI * 2;
const up = (p, y = 1) => ({ x: p.x, y: p.y + y, z: p.z });
const rnd = (a, b) => a + Math.random() * (b - a);
const sfx = (id, vol = 1, pitch = 1, at = false) => ({ id, vol, pitch, at });

// ---------------------------------------------------------------- regras padrão por tipo de executor
// (golpes corpo a corpo, investidas, sentidos, correntes e afins continuam instantâneos: a "formação" deles é o próprio golpe)
export const STAGE_RULES = {
  projectile: { windup: 6, speed: 1.8 },
  beam: { windup: 6, speed: 4.5, timing: "pass" },
  chain: { windup: 5, speed: 3.5 },
  target_aoe: { windup: 9, speed: 3.2 },
  storm: { windup: 14 },
  field: { windup: 10 },
  teleport: { windup: 8 },
  aoe_self: { windup: 7 },
  buff: { windup: 7 },
  heal: { windup: 6 },
  summon: { windup: 12 },
};

// aparência por elemento (para magias sem coreografia própria)
export const ELEMENT_LOOK = {
  fire: { A: "fire", B: "ember", tile: T.flame }, ice: { A: "ice", B: "frost", tile: T.shard }, lightning: { A: "bolt", B: "white", tile: T.spark },
  arcane: { A: "arcane", B: "violet", tile: T.diamond }, shadow: { A: "shadow", B: "black", tile: T.smoke }, water: { A: "water", B: "foam", tile: T.drop },
  earth: { A: "earth", B: "dust", tile: T.chunk }, wind: { A: "wind", B: "white", tile: T.cloud }, light: { A: "light", B: "gold", tile: T.star },
  blood: { A: "blood", B: "ember", tile: T.drop }, void: { A: "void", B: "violet", tile: T.orb }, physical: { A: "steel", B: "white", tile: T.spark },
};

/** Trajeto padrão de projétil: núcleo + rastro que acompanham a posição a cada tick. */
export const defaultFly = (look) => (c, p, f) => {
  mote(c, p, { col: look.A, tile: T.blob, size: 0.55, life: 0.14, spd: 0, grow: 0 });
  mote(c, p, { col: look.B, tile: look.tile, size: 0.4, life: 0.24, a: 0.8, dir: [-f.dir.x * 0.4, 0.3, -f.dir.z * 0.4], spd: 0.8 });
};
/** Trajeto padrão de raio/lâmina: traço entre a posição anterior e a atual. */
export const defaultBeamFly = (look) => (c, p, f) => {
  streak(c, f.prev, p, { col: look.A, w: 0.3, life: 0.2, a: 0.9 });
  streak(c, f.prev, p, { col: "white", w: 0.1, life: 0.14 });
};

// ---------------------------------------------------------------- utilidades de forma
/** Meia-lua horizontal com o ápice em `apex`, voltada para f.hdir; R = raio, span = abertura (rad). */
function crescent(c, apex, f, R, span, o = {}) {
  const n = Math.max(3, nn(c, o.n ?? 8)), fw = f.hdir, rt = f.right;
  let prev = null;
  for (let k = 0; k <= n; k++) {
    const phi = -span / 2 + (span * k) / n, s = Math.sin(phi), co = Math.cos(phi);
    const q = { x: apex.x + fw.x * R * (co - 1) + rt.x * R * s, y: apex.y + (o.tilt ?? 0) * s, z: apex.z + fw.z * R * (co - 1) + rt.z * R * s };
    if (prev) streak(c, prev, q, { col: o.col, w: o.w ?? 0.1, life: o.life ?? 0.14, a: o.a, tile: T.line });
    prev = q;
  }
}
/** Pontos de uma cúpula (hemisfério) de raio R: lista de anéis do chão para cima. */
function dome(center, R, rings, per) {
  const out = [];
  for (let j = 0; j < rings; j++) {
    const lat = ((j + 0.5) / rings) * (Math.PI / 2) * 0.94, rr = R * Math.cos(lat), y = R * Math.sin(lat) * 1.15, m = Math.max(4, Math.round(per * Math.cos(lat))), ph = j * 0.55;
    const ring = [];
    for (let k = 0; k < m; k++) { const a = ph + (k / m) * TAU; ring.push({ x: center.x + Math.cos(a) * rr, y: center.y + y, z: center.z + Math.sin(a) * rr }); }
    out.push(ring);
  }
  return out;
}
const boltSeg = (c, len) => Math.max(3, Math.round(len / (c.k >= 1 ? 1.4 : c.k >= 0.7 ? 2.2 : 3.6)));

// ---------------------------------------------------------------- fábrica: tempestades (Trovão Negro, Tempestade da Morte, Manipulação da Água)
function makeStorm(P) {
  return {
    windup: P.windup ?? 14, delay: P.delay ?? 4,
    sfx: { form: P.form ?? [sfx("ambient.weather.thunder", 0.55, 0.5)], release: P.release ?? [sfx("mob.wither.spawn", 0.45, 1.7)] },
    form(c, f) {
      const ap = f.aim(f.ex.range ?? 24); if (!ap) return;
      const R = f.ex.radius ?? 6, t = f.t;
      if (f.i % 4 === 0) disc(c, ap, { col: P.A, circle: P.circle ?? CIRCLE.bolt, size: R * 2, life: 0.5, rot: 40 + f.i * 9, a: 0.35 + 0.55 * t });
      if (f.i % 8 === 0) disc(c, ap, { col: P.B, circle: P.circle2 ?? CIRCLE.shadow, size: R * 1.3, life: 0.5, rot: -70 - f.i * 6, a: 0.25 + 0.4 * t });
      // nuvem que engrossa no alto
      const n = 1 + Math.floor(t * 4);
      for (let k = 0; k < n; k++) {
        const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * R * (0.45 + 0.75 * t);
        mote(c, { x: ap.x + Math.cos(a) * r, y: ap.y + 11 + rnd(-0.6, 1), z: ap.z + Math.sin(a) * r }, { col: P.cloud ?? "black", tile: T.cloud, size: 1.8 + 1.5 * t, life: 0.5, a: 0.5 + 0.3 * t, spd: 0.3, dir: [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], grow: 0 });
      }
      if (f.i % 3 === 1) mote(c, { x: ap.x + rnd(-R, R) * 0.6, y: ap.y + 10.4, z: ap.z + rnd(-R, R) * 0.6 }, { col: P.B, tile: T.spark, size: 0.9, life: 0.14, a: 0.9, grow: -1 });
      if (f.i % 2 === 0) column(c, ap, { col: P.B, tile: P.groundTile ?? T.zig, n: 2, h: 2, r: R * 0.6, life: 0.5, size: 0.2 });
    },
    sky(c, center, R, i, n) {
      const k = nn(c, 4);
      for (let q = 0; q < k; q++) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * R * 1.1; mote(c, { x: center.x + Math.cos(a) * r, y: center.y + 11 + rnd(-0.6, 1), z: center.z + Math.sin(a) * r }, { col: P.cloud ?? "black", tile: T.cloud, size: 2.6, life: 0.7, a: 0.7, spd: 0.2, dir: [0, 0, 0], grow: 0 }); }
      if (i === 0 || i === n - 1) mote(c, up(center, 10.5), { col: "white", tile: T.star, size: 3.4, life: 0.16, a: 0.8, grow: -1 });
    },
    telegraph(c, p) {
      ringFlat(c, p, { col: P.A, tile: T.ring, radius: 2, start: 1.9, spd: -7, n: 8, life: 0.26, size: 0.42 });
      mote(c, up(p, 0.15), { col: P.B, tile: T.cross, size: 0.7, life: 0.3, a: 0.85, spd: 0, grow: -0.8 });
    },
    strike(c, p, i, n) {
      const big = i === n - 1, top = up(p, 14), sg = boltSeg(c, 14);
      if (P.bolts !== false) {
        bolt(c, top, p, { col: P.A, w: 0.3, jitter: 1.1, branch: 0.3, life: 0.22, seg: sg });
        bolt(c, top, p, { col: P.B, w: 0.12, jitter: 0.8, branch: 0.15, life: 0.2, seg: sg });
      } else {
        for (let k = 0; k < nn(c, 9); k++) mote(c, { x: p.x + rnd(-0.9, 0.9), y: p.y + 7 + rnd(0, 2), z: p.z + rnd(-0.9, 0.9) }, { col: k % 2 ? P.A : P.B, tile: T.drop, size: 0.3, life: 0.5, dir: [0, -1, 0], spd: 12 });
      }
      mote(c, up(p, 0.5), { col: "white", tile: T.star, size: big ? 3.2 : 1.9, life: 0.14, grow: -1 });
      burst(c, up(p, 0.3), { col: P.B, tile: P.tile ?? T.spark, n: big ? 14 : 8, spd: 5, size: 0.22, life: 0.35, up: 0.8 });
      burst(c, up(p, 0.3), { col: P.smoke ?? "black", tile: T.smoke, n: big ? 10 : 5, spd: 2, size: 0.55, a: 0.75, up: 1, life: 0.7 });
      ringFlat(c, p, { col: P.B, tile: T.ring, radius: big ? 4.6 : 2.7, n: big ? 18 : 12, life: 0.4, size: 0.5 });
      column(c, p, { col: P.A, tile: P.groundTile ?? T.zig, n: 5, h: big ? 7 : 5, r: 0.25, life: 0.3, size: 0.3 });
      if (big) disc(c, p, { col: P.A, circle: P.circle ?? CIRCLE.bolt, size: 5.5, life: 1.2, rot: 30, a: 0.8 });
    },
    strikeSfx: P.strikeSfx ?? ((i, n) => sfx("ambient.weather.lightning.impact", i === n - 1 ? 1 : 0.6, 0.7 + Math.random() * 0.2, true)),
  };
}

// ---------------------------------------------------------------- fábrica: escudos/barreiras
function makeBarrier(P) {
  const R = P.radius ?? 1.7;
  return {
    windup: P.windup ?? 8,
    hold: { every: 8 },
    sfx: { form: [sfx("beacon.activate", 0.45, 1.5)], release: [sfx("item.shield.block", 0.8, P.pitch ?? 1.15), sfx("random.orb", 0.6, 1.2)], impact: [] },
    form(c, f) {
      if (f.i === 0) disc(c, f.feet, { col: P.A, circle: P.circle ?? CIRCLE.arcane, size: 3.4, life: f.n / 20 + 0.7, rot: 15 });
      const base = f.i * 0.9;
      for (let k = 0; k < 3; k++) {
        const a = base + k * (TAU / 3);
        mote(c, { x: f.feet.x + Math.cos(a) * 1.5, y: f.feet.y + 0.2 + f.t * 1.8, z: f.feet.z + Math.sin(a) * 1.5 }, { col: k % 2 ? P.B : P.A, tile: P.tile ?? T.diamond, size: 0.3, life: 0.35, spd: 0.3, dir: [0, 1, 0] });
      }
      if (f.i % 2 === 0) implode(c, up(f.feet, 1), { col: P.B, tile: T.spark, n: 3, radius: 1.9, life: 0.3, size: 0.16, flat: 1 });
    },
    release(c, v) {
      const center = v.pos, layers = P.layers ?? 1;
      for (let L = 0; L < layers; L++) {
        const rings = dome(center, R + L * 0.45, 6, 12), col = L % 2 ? P.B : P.A;
        rings.forEach((ring, j) => {
          after(j * 1.1 + L * 2, () => { for (const q of ring) mote(c, q, { col, tile: P.tile ?? T.diamond, size: 0.3 - L * 0.03, life: 0.9, spd: 0, a: 0.85, grow: 0 }); });
        });
      }
      mote(c, up(center, 1), { col: "white", tile: T.star, size: 2.6, life: 0.18, grow: -1.1 });
      ringFlat(c, up(center, 0.1), { col: P.B, tile: T.ring, radius: R + 1.2, n: 16, life: 0.45, size: 0.55 });
    },
    impact() {},
    holdFx(c, f, k, total) {
      const near = total - k <= 3, n = nn(c, near ? 7 : 5);
      for (const ring of dome(f.center0, R, 4, 8)) for (let q = 0; q < ring.length; q++) { if (Math.random() > n / (ring.length * 4)) continue; mote(c, ring[q], { col: Math.random() < 0.5 ? P.A : P.B, tile: P.tile ?? T.diamond, size: 0.24, life: 0.5, spd: 0, a: near && k % 2 ? 0.3 : 0.75, grow: 0 }); }
      if (k % 3 === 0) ringFlat(c, up(f.feet, 0.1), { col: P.A, tile: T.ring, radius: R, n: 12, life: 0.5, size: 0.4, start: R, spd: 0.2 });
    },
    end(c, f, broken) {
      const center = f.center0;
      if (broken) {
        for (const ring of dome(center, R, 5, 10)) for (const q of ring) mote(c, q, { col: P.B, tile: P.tile ?? T.diamond, size: 0.28, life: 0.7, dir: [q.x - center.x, 0.4, q.z - center.z], spd: 3, acc: [0, -7, 0] });
        mote(c, up(center, 1), { col: "white", tile: T.star, size: 2.2, life: 0.14, grow: -1 });
      } else {
        ringFlat(c, up(f.feet, 0.1), { col: P.B, tile: T.ring, radius: R + 0.5, n: 14, life: 0.5, size: 0.4, start: R + 0.5, spd: -2 });
      }
    },
    endSfx: (broken) => (broken ? [sfx("random.glass", 0.8, 0.8), sfx("random.break", 0.5, 1.2)] : [sfx("beacon.deactivate", 0.5, 1.4)]),
  };
}
// ---------------------------------------------------------------- fábrica: teletransporte
function makeTeleport(P) {
  const size = P.size ?? 2.6;
  return {
    windup: P.windup ?? 8,
    sfx: { form: [sfx("mob.endermen.portal", 0.45, 0.7 * (P.pitch ?? 1))], release: [sfx("mob.endermen.teleport", 0.9, 1.1 * (P.pitch ?? 1))], impact: [sfx("mob.endermen.teleport", 0.9, 1.4 * (P.pitch ?? 1), true)] },
    form(c, f) {
      if (f.i === 0) disc(c, f.feet, { col: P.A, circle: P.circle, size, life: f.n / 20 + 0.4, rot: 160 });
      implode(c, up(f.feet, 1), { col: P.B, tile: T.spark, n: 4, radius: 0.4 + 1.4 * (1 - f.t), life: 0.25, size: 0.2, flat: 1 });
      const y = 0.1 + f.t * 1.9;
      for (let k = 0; k < 4; k++) { const a = f.i * 0.8 + k * (TAU / 4); mote(c, { x: f.feet.x + Math.cos(a) * 0.75, y: f.feet.y + y, z: f.feet.z + Math.sin(a) * 0.75 }, { col: k % 2 ? P.B : P.A, tile: T.star, size: 0.22, life: 0.3, spd: 0.2, dir: [-Math.sin(a), 0.2, Math.cos(a)] }); }
    },
    release(c, v) {                                                                                                                           // v.origin = de onde saiu
      const o = v.origin ?? v.from;
      mote(c, up(o, 1), { col: "white", tile: T.star, size: 1.8, life: 0.18, grow: -1.2 });
      column(c, o, { col: P.B, tile: T.spark, n: 8, h: 2.4, r: 0.4, life: 0.4, size: 0.25 });
      burst(c, up(o, 1), { col: P.A, tile: T.star, n: 8, spd: 3, size: 0.3, life: 0.4 });
      disc(c, o, { col: P.B, circle: P.circle, size: size * 0.85, life: 0.7, rot: -160 });
    },
    impact(c, v) {                                                                                                                            // chegada
      const o = v.origin ?? v.from;
      streak(c, up(o, 1), up(v.at, 1), { col: P.B, w: 0.14, life: 0.45, a: 0.7 });
      streak(c, up(o, 1), up(v.at, 1), { col: "white", w: 0.05, life: 0.3 });
      disc(c, v.at, { col: P.A, circle: P.circle, size, life: 0.8, rot: 160 });
      burst(c, up(v.at, 1), { col: P.B, tile: T.star, n: 10, spd: 3.2, size: 0.3, life: 0.5 });
      ringFlat(c, v.at, { col: P.A, tile: T.ring, radius: 2.4, n: 14, life: 0.4, size: 0.5 });
      column(c, v.at, { col: "white", tile: T.spark, n: 6, h: 2.6, r: 0.4, life: 0.35, size: 0.22 });
    },
  };
}

// ---------------------------------------------------------------- fábrica: lâminas (Lâmina de Água, Lâmina de Vento)
function makeBlade(P) {
  const { A, B, drop, mist, circle, g } = P;
  return {
    windup: 8, speed: 2.6, timing: "pass", hand: true, sfx: P.sfx,
    form(c, f) {
      const t = f.t, R = 0.3 + 0.6 * t, span = 0.7 + 1.5 * t, apex = { x: f.hand.x + f.hdir.x * 0.25, y: f.hand.y, z: f.hand.z + f.hdir.z * 0.25 };
      crescent(c, apex, f, R, span, { col: A, w: 0.09, life: 0.12, n: 6 });
      crescent(c, apex, f, R * 0.8, span * 0.9, { col: B, w: 0.04, life: 0.1, n: 4 });
      implode(c, f.hand, { col: B, tile: drop, n: 3, radius: 1.1, life: 0.25, size: 0.14, flat: 1 });
      if (f.i % 2 === 0) mote(c, up(f.hand, 0.3), { col: A, tile: mist, size: 0.2, life: 0.5, dir: [0, 1, 0], spd: 0.6 });
    },
    release(c, v) {
      const f = { hdir: hnorm(v.dir), right: { x: -hnorm(v.dir).z, y: 0, z: hnorm(v.dir).x } };
      crescent(c, v.from, f, 1.4, 1.9, { col: B, w: 0.14, life: 0.18, n: 8 });
      burst(c, v.from, { col: B, tile: drop, n: 8, spd: 3, size: 0.2, life: 0.45, acc: [0, g, 0] });
    },
    fly(c, p, f) {
      const h = hnorm(f.dir), fr = { hdir: h, right: { x: -h.z, y: 0, z: h.x } };
      crescent(c, p, fr, 1.45, 1.9, { col: A, w: 0.13, life: 0.16, n: 8 });                                                                  // a lâmina
      crescent(c, p, fr, 1.2, 1.6, { col: B, w: 0.05, life: 0.12, n: 5 });                                                                   // fio branco
      streak(c, f.prev, p, { col: A, w: 0.2, life: 0.22, a: 0.5 });                                                                          // fita atrás
      mote(c, { x: p.x - h.z * 1.2, y: p.y, z: p.z + h.x * 1.2 }, { col: B, tile: drop, size: 0.18, life: 0.4, dir: [-h.x, 0.2, -h.z], spd: 1.2, acc: [0, g * 2 / 3, 0] });
      mote(c, { x: p.x + h.z * 1.2, y: p.y, z: p.z - h.x * 1.2 }, { col: B, tile: drop, size: 0.18, life: 0.4, dir: [-h.x, 0.2, -h.z], spd: 1.2, acc: [0, g * 2 / 3, 0] });
    },
    impact(c, v) {
      column(c, v.at, { col: A, tile: drop, n: 8, h: 2.4, r: 0.8, life: 0.6, size: 0.3, acc: [0, g, 0] });
      ringFlat(c, v.at, { col: B, tile: mist, radius: 2.4, n: 12, life: 0.5, size: 0.4 });
      disc(c, v.at, { col: A, circle, size: 3, life: 1.2, rot: 40, a: 0.7 });
    },
    onHit(c, e) {
      column(c, e.location, { col: A, tile: drop, n: 6, h: 2.2, r: 0.4, life: 0.55, size: 0.28, acc: [0, g, 0] });
      ringFlat(c, up(e.location, 0.8), { col: B, tile: T.ring, radius: 1.5, n: 10, life: 0.3, size: 0.4 });
    },
  };
}

// ---------------------------------------------------------------- coreografias por habilidade
export const CHOREO = {
  // ------------------------------------------------------------ CHAMA NEGRA: orbe de fogo negro na mão -> disparo -> trajeto com rastro -> explosão que queima o chão
  black_flame: {
    windup: 12, speed: 1.5, hand: true,
    sfx: {
      form: [sfx("fire.ignite", 0.7, 0.6)],
      release: [sfx("mob.blaze.shoot", 1, 0.55), sfx("mob.ghast.fireball", 0.5, 0.7)],
      impact: [sfx("random.explode", 0.8, 0.7, true), sfx("fire.ignite", 0.8, 0.5, true)],
    },
    form(c, f) {
      const h = f.hand, t = f.t;
      if (f.i === 0) disc(c, f.feet, { col: "shadow", circle: CIRCLE.shadow, size: 2.4, life: f.n / 20 + 0.6, rot: -50 });
      mote(c, h, { col: "black", tile: T.blob, size: 0.18 + 0.7 * t, life: 0.14, a: 1, spd: 0, grow: 0 });                                  // núcleo escuro que cresce
      mote(c, h, { col: "ember", tile: T.flame, size: 0.3 + 0.55 * t, life: 0.22, a: 0.75, dir: [0, 1, 0], spd: 0.8 });                       // chama alaranjada na borda
      if (f.i % 2 === 0) implode(c, h, { col: "ember", tile: T.ember, n: 3, radius: 0.9 + 0.5 * (1 - t), life: 0.28, size: 0.16, flat: 1 });   // brasas sugadas
      if (f.i % 3 === 0) mote(c, up(f.feet, 0.1), { col: "black", tile: T.smoke, size: 0.5, life: 0.7, a: 0.55, dir: [rnd(-0.3, 0.3), 1, rnd(-0.3, 0.3)], spd: 1.2 });
    },
    release(c, v) {
      mote(c, v.from, { col: "white", tile: T.star, size: 1.5, life: 0.16, grow: -1, a: 0.9 });
      burst(c, v.from, { col: "ember", tile: T.ember, n: 8, spd: 2.5, size: 0.22, life: 0.4 });
      burst(c, v.from, { col: "black", tile: T.smoke, n: 5, spd: 1.2, size: 0.5, a: 0.7, life: 0.6 });
    },
    fly(c, p, f) {
      mote(c, p, { col: "black", tile: T.blob, size: 0.75, life: 0.16, spd: 0, grow: 0 });
      mote(c, p, { col: "ember", tile: T.flame, size: 0.6, life: 0.26, a: 0.8, dir: [-f.dir.x * 0.3, 0.6, -f.dir.z * 0.3], spd: 1 });
      mote(c, p, { col: "black", tile: T.smoke, size: 0.55, life: 0.5, a: 0.5, dir: [-f.dir.x, 0.2, -f.dir.z], spd: 0.8 });
      const a = f.i * 1.15, r = 0.5;                                                                                                          // espiral de brasas ao redor do orbe
      mote(c, { x: p.x + f.right.x * Math.cos(a) * r, y: p.y + Math.sin(a) * r, z: p.z + f.right.z * Math.cos(a) * r }, { col: "fire", tile: T.ember, size: 0.2, life: 0.3, dir: [0, 0.2, 0], spd: 0.3 });
    },
    impact(c, v) {
      const at = v.at, tier = v.tier, R = v.ex?.radius ?? 2.5;
      mote(c, up(at, 0.8), { col: "white", tile: T.star, size: 2.2, life: 0.14, grow: -1.2 });
      burst(c, up(at, 0.6), { col: "black", tile: T.smoke, n: 14, spd: 3.2, size: 0.65, a: 0.85, up: 1, life: 0.9 });
      burst(c, up(at, 0.6), { col: "ember", tile: T.flame, n: 10, spd: 4, size: 0.45, up: 1.1, life: 0.6 });
      column(c, at, { col: "black", tile: T.flame, n: 10, h: 3.6, r: 0.9, life: 0.8, size: 0.7 });
      column(c, at, { col: "ember", tile: T.flame, n: 6, h: 3.2, r: 1.1, life: 0.7, size: 0.4, a: 0.8 });
      ringFlat(c, at, { col: "ember", tile: T.ring, radius: 3.4 + tier * 0.4, n: 18, life: 0.5, size: 0.6 });
      disc(c, at, { col: "black", circle: CIRCLE.fire, size: R * 2 + tier, life: 2.4, rot: -35, a: 0.85 });
      after(5, () => { column(c, at, { col: "black", tile: T.flame, n: 6, h: 2.4, r: 1.6, life: 0.7, size: 0.5 }); burst(c, up(at, 0.3), { col: "ember", tile: T.ember, n: 8, spd: 2, size: 0.18, up: 1.5, life: 0.8, acc: [0, -2, 0] }); });
      if (tier > 1) after(10, () => ringFlat(c, at, { col: "shadow", tile: T.ring, radius: 5, n: 16, life: 0.5, size: 0.5 }));
      for (let k = 1; k <= 4; k++) after(k * 10, () => column(c, at, { col: k % 2 ? "black" : "ember", tile: T.flame, n: 5, h: 1.6, r: R, life: 0.6, size: 0.45, a: 0.8 }));   // chamas negras que seguem ardendo (só visual)
    },
    onHit(c, e) { column(c, e.location, { col: "black", tile: T.flame, n: 4, h: 2, r: 0.4, life: 0.6, size: 0.5 }); },
  },

  // ------------------------------------------------------------ RAIO NEGRO: carga sombria na mão -> feixe que percorre a linha de visão
  black_lightning: {
    windup: 8, speed: 5, timing: "pass", hand: true,
    sfx: { form: [sfx("mob.evocation_illager.prepare_attack", 0.5, 1.4)], release: [sfx("ambient.weather.thunder", 0.8, 1.3), sfx("mob.wither.shoot", 0.5, 1.5)], impact: [sfx("ambient.weather.lightning.impact", 0.5, 1.2, true)] },
    form(c, f) {
      const h = f.hand;
      mote(c, h, { col: "black", tile: T.blob, size: 0.2 + 0.5 * f.t, life: 0.12, spd: 0, grow: 0 });
      for (let k = 0; k < nn(c, 2); k++) { const a = rnd(0, TAU), r = 0.5 * (1 - f.t) + 0.2; streak(c, { x: h.x + Math.cos(a) * r * 2, y: h.y + Math.sin(a) * r * 2, z: h.z + Math.sin(a * 1.3) * r * 2 }, h, { col: "violet", w: 0.05, life: 0.12, tile: T.zig }); }
      if (f.i === 0) disc(c, f.feet, { col: "violet", circle: CIRCLE.bolt, size: 2, life: f.n / 20 + 0.4, rot: 120 });
    },
    release(c, v) { mote(c, v.from, { col: "white", tile: T.star, size: 1.6, life: 0.14, grow: -1 }); burst(c, v.from, { col: "violet", tile: T.spark, n: 8, spd: 4, size: 0.2, life: 0.3 }); },
    fly(c, p, f) {
      bolt(c, f.prev, p, { col: "black", w: 0.32, jitter: 0.35, seg: 2, life: 0.2 });
      streak(c, f.prev, p, { col: "violet", w: 0.12, life: 0.16 });
      streak(c, f.prev, p, { col: "white", w: 0.05, life: 0.12 });
    },
    impact(c, v) { burst(c, up(v.at, 0.6), { col: "violet", tile: T.spark, n: 10, spd: 5, size: 0.22, life: 0.3, up: 0.6 }); ringFlat(c, v.at, { col: "black", tile: T.ring, radius: 2.4, n: 12, life: 0.4, size: 0.5 }); },
    onHit(c, e) { burst(c, up(e.location, 1), { col: "violet", tile: T.zig, n: 6, spd: 3, size: 0.22, life: 0.3 }); mote(c, up(e.location, 1), { col: "white", tile: T.star, size: 1.2, life: 0.12, grow: -1 }); },
  },

  // ------------------------------------------------------------ TROVÃO NEGRO: nuvem e círculo na área marcada -> raios com aviso -> raio final
  black_thunder: makeStorm({ A: "black", B: "violet", cloud: "black", circle: CIRCLE.bolt, circle2: CIRCLE.shadow, smoke: "black" }),
  death_storm: makeStorm({
    A: "void", B: "blood", cloud: "black", circle: CIRCLE.void, circle2: CIRCLE.devour, tile: T.skull, groundTile: T.skull, smoke: "black", windup: 18,
    form: [sfx("mob.wither.ambient", 0.7, 0.6)], release: [sfx("mob.wither.spawn", 0.7, 0.8)],
    strikeSfx: (i, n) => sfx("mob.wither.break_block", i === n - 1 ? 0.9 : 0.5, 0.7 + Math.random() * 0.2, true),
  }),
  water_manip: makeStorm({
    A: "water", B: "foam", cloud: "steel", circle: CIRCLE.water, circle2: CIRCLE.wind, tile: T.drop, groundTile: T.drop, smoke: "foam", bolts: false, windup: 10, delay: 3,
    form: [sfx("random.splash", 0.4, 0.8)], release: [sfx("ambient.weather.rain", 0.6, 1)],
    strikeSfx: (i, n) => sfx("random.splash", i === n - 1 ? 0.9 : 0.5, 0.8 + Math.random() * 0.3, true),
  }),

  // ------------------------------------------------------------ LÂMINA DE ÁGUA / LÂMINA DE VENTO: meia-lua na mão -> corte que atravessa os inimigos
  water_blade: makeBlade({
    A: "water", B: "foam", drop: T.drop, mist: T.bubble, circle: CIRCLE.water, g: -6,
    sfx: {
      form: [sfx("random.splash", 0.35, 1.5)],
      release: [sfx("item.trident.throw", 0.9, 1.35), sfx("random.splash", 0.8, 1.2)],
      impact: [sfx("random.splash", 0.7, 1, true)],
    },
  }),
  wind_blade: makeBlade({
    A: "wind", B: "white", drop: T.cloud, mist: T.cloud, circle: CIRCLE.wind, g: 1.5,
    sfx: {
      form: [sfx("mob.phantom.swoop", 0.3, 1.9)],
      release: [sfx("item.trident.throw", 0.8, 1.7), sfx("mob.phantom.swoop", 0.7, 1.5)],
      impact: [sfx("mob.phantom.swoop", 0.6, 0.9, true)],
    },
  }),

  // ------------------------------------------------------------ CHUVA DE SANGUE: nuvem rubra -> gotas anunciadas no chão -> respingos (cura aliados, fere inimigos)
  blood_rain: makeStorm({
    A: "blood", B: "ember", cloud: "blood", circle: CIRCLE.blood, circle2: CIRCLE.devour, tile: T.drop, groundTile: T.drop, smoke: "black", bolts: false, windup: 11, delay: 3,
    form: [sfx("mob.phantom.bite", 0.45, 0.6)], release: [sfx("ambient.weather.rain", 0.7, 0.8)],
    strikeSfx: (i, n) => sfx("random.splash", i === n - 1 ? 0.9 : 0.5, 0.55 + Math.random() * 0.2, true),
  }),

  // ------------------------------------------------------------ MEGIDDO (Suprema): esfera de luz na mão + colunas sagradas -> feixe colossal que atravessa a linha -> pilares de luz
  megiddo: {
    windup: 16, speed: 6, timing: "pass", hand: true,
    sfx: {
      form: [sfx("beacon.activate", 0.7, 0.6), sfx("mob.evocation_illager.prepare_attack", 0.5, 0.8)],
      release: [sfx("beacon.power_select", 1, 0.5), sfx("mob.enderdragon.growl", 0.5, 1.6), sfx("random.explode", 0.5, 1.4)],
      impact: [sfx("random.explode", 0.8, 1.1, true), sfx("beacon.deactivate", 0.7, 0.7, true)],
    },
    form(c, f) {
      const h = f.hand, t = f.t;
      if (f.i === 0) { disc(c, f.feet, { col: "gold", circle: CIRCLE.holy, size: 5.2, life: f.n / 20 + 0.9, rot: 30 }); disc(c, f.feet, { col: "white", circle: CIRCLE.sage, size: 3.2, life: f.n / 20 + 0.9, rot: -80 }); }
      mote(c, h, { col: "white", tile: T.blob, size: 0.25 + 1.1 * t, life: 0.12, a: 1, spd: 0, grow: 0 });
      mote(c, h, { col: "gold", tile: T.star, size: 0.5 + 1.1 * t, life: 0.16, a: 0.6, spd: 0, grow: 0 });
      implode(c, h, { col: "gold", tile: T.spark, n: 4, radius: 2.4 * (1 - t) + 0.4, life: 0.3, size: 0.16, flat: 1 });
      if (f.i % 3 === 0) column(c, f.feet, { col: "holy", tile: T.star, n: 4, h: 3.2, r: 1.3, life: 0.6, size: 0.3 });
      if (f.i % 6 === 0) ringFlat(c, f.feet, { col: "gold", tile: T.ring, radius: 4, start: 4 - 2.5 * t, spd: -3, n: 14, life: 0.4, size: 0.4 });
    },
    release(c, v) {
      mote(c, v.from, { col: "white", tile: T.star, size: 3, life: 0.18, grow: -1.5 });
      burst(c, v.from, { col: "white", tile: T.spark, n: 16, spd: 6, size: 0.25, life: 0.35 });
      ringFlat(c, up(v.from, -0.3), { col: "gold", tile: T.ring, radius: 3, n: 16, life: 0.4, size: 0.5 });
    },
    fly(c, p, f) {
      streak(c, f.prev, p, { col: "gold", w: 0.95, life: 0.22, a: 0.55 });                                                                    // o feixe: três camadas, da aura ao núcleo
      streak(c, f.prev, p, { col: "white", w: 0.45, life: 0.18, a: 0.9 });
      streak(c, f.prev, p, { col: "white", w: 0.14, life: 0.14 });
      const a = f.i * 1.35;
      for (let k = 0; k < 2; k++) { const b = a + k * Math.PI, r = 0.9; mote(c, { x: p.x + f.right.x * Math.cos(b) * r, y: p.y + Math.sin(b) * r, z: p.z + f.right.z * Math.cos(b) * r }, { col: k ? "gold" : "white", tile: T.star, size: 0.28, life: 0.3, dir: [0, 0.1, 0], spd: 0.2 }); }
    },
    impact(c, v) {
      const at = v.at;
      mote(c, up(at, 1), { col: "white", tile: T.star, size: 4.2, life: 0.22, grow: -1.4 });
      column(c, at, { col: "white", tile: T.spark, n: 14, h: 9, r: 1.2, life: 0.6, size: 0.5 });
      column(c, at, { col: "gold", tile: T.star, n: 10, h: 7, r: 1.8, life: 0.8, size: 0.4 });
      ringFlat(c, at, { col: "gold", tile: T.ring, radius: 6 + v.tier, n: 26, life: 0.55, size: 0.7 });
      disc(c, at, { col: "gold", circle: CIRCLE.holy, size: 9, life: 2.2, rot: 20, a: 0.85 });
      after(6, () => ringFlat(c, at, { col: "white", tile: T.ring, radius: 9, n: 28, life: 0.6, size: 0.6 }));
      for (let k = 1; k <= 3; k++) after(k * 9, () => column(c, at, { col: k % 2 ? "holy" : "white", tile: T.star, n: 6, h: 6, r: 2.2, life: 0.7, size: 0.4 }));   // pilares que continuam brilhando (só visual)
    },
    onHit(c, e) { column(c, e.location, { col: "light", tile: T.star, n: 6, h: 3.2, r: 0.4, life: 0.6, size: 0.35 }); burst(c, up(e.location, 1), { col: "gold", tile: T.spark, n: 8, spd: 4, size: 0.2, life: 0.35 }); },
  },

  // ------------------------------------------------------------ DRAGO NOVA (Suprema): círculos de fogo negro + vórtice que suga energia -> explosão em ondas e chama em espiral
  drago_nova: {
    windup: 22,
    sfx: {
      form: [sfx("mob.enderdragon.growl", 0.6, 0.6)],
      release: [sfx("mob.enderdragon.growl", 1, 0.5), sfx("random.explode", 1, 0.5), sfx("mob.wither.spawn", 0.5, 1.2)],
      impact: [],
    },
    form(c, f) {
      const t = f.t, o = up(f.feet, 1.1);
      if (f.i === 0) { disc(c, f.feet, { col: "black", circle: CIRCLE.fire, size: 4.2, life: f.n / 20 + 0.3, rot: -90 }); disc(c, f.feet, { col: "void", circle: CIRCLE.void, size: 7, life: f.n / 20 + 0.3, rot: 60 }); }
      implode(c, o, { col: "void", tile: T.ember, n: 5, radius: 5 * (1 - t) + 0.6, life: 0.35, size: 0.2, flat: 0.8 });
      mote(c, o, { col: "black", tile: T.blob, size: 0.4 + 1.4 * t, life: 0.12, spd: 0, grow: 0 });
      mote(c, o, { col: "ember", tile: T.flame, size: 0.5 + 1.2 * t, life: 0.2, a: 0.7, dir: [0, 1, 0], spd: 0.6 });
      column(c, f.feet, { col: "ember", tile: T.flame, n: 3, h: 2 + 3 * t, r: 0.8, life: 0.5, size: 0.4 });
      if (f.i % 5 === 0) ringFlat(c, f.feet, { col: "void", tile: T.ring, radius: 5 * (1 - t) + 1.5, start: 5 * (1 - t) + 1.5, spd: -3, n: 14, life: 0.4, size: 0.4 });
    },
    release(c, v) {
      const o = up(v.pos, 1.1);
      mote(c, o, { col: "white", tile: T.star, size: 4.4, life: 0.2, grow: -1.5 });
      burst(c, o, { col: "ember", tile: T.flame, n: 16, spd: 8, size: 0.5, life: 0.6 });
    },
    impact(c, v) {
      const at = v.at, R = v.ex?.radius ?? 12;
      ringFlat(c, at, { col: "ember", tile: T.flame, radius: R, n: 28, life: 0.6, size: 0.8 });
      ringFlat(c, at, { col: "void", tile: T.ring, radius: R * 0.7, n: 22, life: 0.5, size: 0.7 });
      burst(c, up(at, 1), { col: "black", tile: T.smoke, n: 20, spd: 6, size: 0.9, a: 0.8, up: 1, life: 1 });
      burst(c, up(at, 1), { col: "ember", tile: T.flame, n: 16, spd: 8, size: 0.55, up: 1.2, life: 0.7 });
      column(c, at, { col: "black", tile: T.flame, n: 14, h: 6, r: 1.6, life: 1, size: 1 });
      column(c, at, { col: "ember", tile: T.flame, n: 10, h: 7, r: 2, life: 0.9, size: 0.6, a: 0.85 });
      disc(c, at, { col: "black", circle: CIRCLE.fire, size: R * 2, life: 2.6, rot: 40, a: 0.85 });
      helix(c, at, { col: "ember", tile: T.flame, r: 2.2, h: 8, steps: 18, turns: 2.5, dur: 12, life: 0.6, size: 0.5 });                        // espiral de chamas: o "dragão" subindo
      after(6, () => ringFlat(c, at, { col: "ember", tile: T.flame, radius: R + 4, n: 32, life: 0.7, size: 0.9, a: 0.8 }));
      after(12, () => { ringFlat(c, at, { col: "shadow", tile: T.ring, radius: R + 7, n: 32, life: 0.8, size: 0.8 }); burst(c, up(at, 0.5), { col: "ember", tile: T.ember, n: 14, spd: 5, size: 0.3, up: 1.5, life: 0.9, acc: [0, -3, 0] }); });
      for (let k = 1; k <= 4; k++) after(k * 10, () => column(c, at, { col: k % 2 ? "black" : "ember", tile: T.flame, n: 6, h: 2.2, r: R * 0.6, life: 0.7, size: 0.6, a: 0.8 }));   // chamas que seguem ardendo (só visual)
    },
    onHit(c, e) { column(c, e.location, { col: "ember", tile: T.flame, n: 5, h: 2.6, r: 0.5, life: 0.6, size: 0.5 }); burst(c, up(e.location, 1), { col: "black", tile: T.smoke, n: 5, spd: 2.5, size: 0.6, a: 0.7, life: 0.7 }); },
  },

  // ------------------------------------------------------------ DRAGÃO DA TEMPESTADE (Suprema): vórtice de raios -> dragão de relâmpagos voa até o alvo -> descarga em cada salto
  storm_dragon: {
    windup: 14, speed: 4, hand: true,
    sfx: {
      form: [sfx("ambient.weather.thunder", 0.5, 0.6)],
      release: [sfx("mob.enderdragon.growl", 0.7, 1.3), sfx("ambient.weather.lightning.impact", 0.8, 1.1)],
      impact: [sfx("ambient.weather.lightning.impact", 0.7, 0.9, true)],
    },
    form(c, f) {
      const t = f.t;
      if (f.i === 0) disc(c, f.feet, { col: "bolt", circle: CIRCLE.bolt, size: 4, life: f.n / 20 + 0.4, rot: 120 });
      for (let k = 0; k < 3; k++) {
        const a = f.i * 0.9 + k * 2.09, r = 1.7 * (1 - 0.45 * t);
        mote(c, { x: f.feet.x + Math.cos(a) * r, y: f.feet.y + 0.3 + 2.2 * t + Math.sin(f.i * 0.5 + k) * 0.3, z: f.feet.z + Math.sin(a) * r }, { col: k % 2 ? "bolt" : "white", tile: T.spark, size: 0.3, life: 0.25, dir: [-Math.sin(a), 0.2, Math.cos(a)], spd: 1 });
      }
      if (f.i % 3 === 0) bolt(c, { x: f.feet.x + rnd(-1.5, 1.5), y: f.feet.y + 3.4, z: f.feet.z + rnd(-1.5, 1.5) }, { x: f.feet.x + rnd(-1.2, 1.2), y: f.feet.y + 0.1, z: f.feet.z + rnd(-1.2, 1.2) }, { col: "bolt", w: 0.1, jitter: 0.5, life: 0.16, seg: 3 });
      mote(c, f.hand, { col: "white", tile: T.blob, size: 0.2 + 0.7 * t, life: 0.12, spd: 0, grow: 0 });
    },
    release(c, v) { mote(c, v.from, { col: "white", tile: T.star, size: 2.4, life: 0.16, grow: -1.3 }); burst(c, v.from, { col: "bolt", tile: T.spark, n: 12, spd: 6, size: 0.22, life: 0.3 }); },
    fly(c, p, f) {                                                                                                                              // cabeça de dragão (asas + núcleo) com cauda serpenteante
      mote(c, p, { col: "bolt", tile: T.wing, size: 1.3, life: 0.14, a: 0.9, spd: 0, grow: 0 });
      mote(c, p, { col: "white", tile: T.blob, size: 0.75, life: 0.14, spd: 0, grow: 0 });
      for (let k = 1; k <= 3; k++) {
        const w = Math.sin(f.i * 0.9 + k) * 0.55;
        mote(c, { x: p.x - f.dir.x * k * 0.8 + f.right.x * w, y: p.y - f.dir.y * k * 0.8 + Math.cos(f.i * 0.9 + k) * 0.35, z: p.z - f.dir.z * k * 0.8 + f.right.z * w }, { col: k % 2 ? "bolt" : "white", tile: T.zig, size: 0.34 - 0.04 * k, life: 0.3, spd: 0 });
      }
      bolt(c, f.prev, p, { col: "bolt", w: 0.18, jitter: 0.3, seg: 2, life: 0.14 });
    },
    impact(c, v) { column(c, v.at, { col: "bolt", tile: T.zig, n: 10, h: 5, r: 0.6, life: 0.35, size: 0.4 }); ringFlat(c, v.at, { col: "white", tile: T.ring, radius: 3.4, n: 16, life: 0.4, size: 0.55 }); disc(c, v.at, { col: "bolt", circle: CIRCLE.bolt, size: 4.5, life: 1.2, rot: 100, a: 0.8 }); },
    onHit(c, e) {
      const p = e.location;
      bolt(c, up(p, 7), up(p, 0.2), { col: "white", w: 0.16, jitter: 0.4, life: 0.16 });
      column(c, p, { col: "bolt", tile: T.zig, n: 8, h: 4, r: 0.35, life: 0.3, size: 0.35 });
      mote(c, up(p, 1), { col: "white", tile: T.star, size: 1.5, life: 0.12, grow: -1 });
    },
  },

  // ------------------------------------------------------------ FIM DO MUNDO (Suprema): esfera do vazio cresce no alto e a zona é marcada -> desaba -> implosão e ondas negras
  world_end: {
    windup: 28, speed: 0.4, minT: 22,
    sfx: {
      form: [sfx("mob.wither.ambient", 0.8, 0.5), sfx("beacon.activate", 0.5, 0.5)],
      release: [sfx("mob.wither.spawn", 0.8, 0.7)],
      impact: [sfx("random.explode", 1, 0.5, true), sfx("mob.wither.break_block", 1, 0.5, true)],
    },
    form(c, f) {
      const ap = f.aim(f.ex.range ?? 30); if (!ap) return;
      const R = f.ex.radius ?? 12, t = f.t, sky = up(ap, 16);
      if (f.i % 4 === 0) disc(c, ap, { col: "black", circle: CIRCLE.space, size: R * 2 * (0.4 + 0.6 * t), life: 0.5, rot: 30 + f.i * 7, a: 0.3 + 0.6 * t });
      if (f.i % 8 === 0) disc(c, ap, { col: "violet", circle: CIRCLE.void, size: R * 1.3, life: 0.5, rot: -50 - f.i * 5, a: 0.25 + 0.4 * t });
      if (f.i % 6 === 0) ringFlat(c, ap, { col: "blood", tile: T.ring, radius: R, start: R, spd: 0.2, n: 18, life: 0.45, size: 0.4 });                  // contorno da zona de perigo
      mote(c, sky, { col: "black", tile: T.blob, size: 0.6 + 3.2 * t, life: 0.12, spd: 0, grow: 0 });
      mote(c, sky, { col: "violet", tile: T.orb, size: 1 + 3.6 * t, life: 0.16, a: 0.5, spd: 0, grow: 0 });
      implode(c, sky, { col: "violet", tile: T.spark, n: 5, radius: 5 * (1 - t) + 1, life: 0.35, size: 0.22, flat: 1 });
    },
    release(c, v) { mote(c, up(v.at, 16), { col: "white", tile: T.star, size: 4.5, life: 0.2, grow: -1.5 }); },
    fly(c, p, f) {                                                                                                                              // a esfera desaba do alto sobre o ponto marcado (a posição linear p é ignorada)
      const R = f.ex?.radius ?? 12, h = 16 * (1 - f.t * f.t), pos = { x: f.to.x, y: f.to.y + h, z: f.to.z };
      mote(c, pos, { col: "black", tile: T.blob, size: 3.4, life: 0.14, spd: 0, grow: 0 });
      mote(c, pos, { col: "violet", tile: T.orb, size: 4.2, life: 0.16, a: 0.55, spd: 0, grow: 0 });
      mote(c, up(pos, 1.6), { col: "void", tile: T.smoke, size: 1.5, life: 0.4, a: 0.5, dir: [0, 1, 0], spd: 2 });
      implode(c, pos, { col: "violet", tile: T.spark, n: 4, radius: 3.4, life: 0.3, size: 0.2, flat: 1 });
      if (f.i % 2 === 0) disc(c, f.to, { col: "black", circle: CIRCLE.void, size: R * 2 * (1.05 - 0.15 * f.t), life: 0.14, rot: 100 * f.t, a: 0.4 + 0.5 * f.t });
    },
    impact(c, v) {
      const at = v.at, R = v.ex?.radius ?? 12;
      mote(c, up(at, 1), { col: "white", tile: T.star, size: 6, life: 0.25, grow: -1.4 });
      implode(c, up(at, 1.5), { col: "violet", tile: T.orb, n: 20, radius: R, life: 0.5, size: 0.4, flat: 0.7 });
      burst(c, up(at, 1), { col: "black", tile: T.smoke, n: 18, spd: 6, size: 1, a: 0.8, up: 1, life: 1 });
      column(c, at, { col: "white", tile: T.spark, n: 12, h: 12, r: 1.2, life: 0.7, size: 0.6 });
      disc(c, at, { col: "black", circle: CIRCLE.space, size: R * 2.4, life: 3, rot: 20, a: 0.9 });
      after(8, () => { ringFlat(c, at, { col: "black", tile: T.ring, radius: R + 4, n: 36, life: 0.7, size: 1 }); ringFlat(c, at, { col: "violet", tile: T.ring, radius: R, n: 30, life: 0.6, size: 0.7 }); });
      after(16, () => { ringFlat(c, at, { col: "void", tile: T.ring, radius: R + 8, n: 36, life: 0.8, size: 0.9 }); column(c, at, { col: "black", tile: T.smoke, n: 10, h: 8, r: R * 0.5, life: 1, size: 1.2, a: 0.7 }); });
    },
    onHit(c, e) { column(c, e.location, { col: "void", tile: T.skull, n: 6, h: 3, r: 0.5, life: 0.6, size: 0.4 }); },
  },

  // ------------------------------------------------------------ TELETRANSPORTE: círculo espacial -> some no ponto de partida -> chega no destino com rastro
  teleport: makeTeleport({ A: "arcane", B: "violet", circle: CIRCLE.space }),
  space_travel: makeTeleport({ A: "void", B: "violet", circle: CIRCLE.space, windup: 12, size: 4, pitch: 0.8 }),
  traveler: makeTeleport({ A: "wind", B: "white", circle: CIRCLE.wind, windup: 6, size: 2.2, pitch: 1.3 }),

  // ------------------------------------------------------------ BARREIRA: runas sobem do chão -> cúpula se monta -> brilha enquanto durar -> estilhaça
  barrier: makeBarrier({ A: "arcane", B: "violet", tile: T.diamond, circle: CIRCLE.arcane, layers: 1 }),
  range_barrier: makeBarrier({ A: "arcane", B: "mana", tile: T.diamond, circle: CIRCLE.arcane, layers: 3, radius: 1.8, pitch: 1 }),
  divine_shield: makeBarrier({ A: "gold", B: "white", tile: T.star, circle: CIRCLE.holy, layers: 2, pitch: 1.4 }),
};

/** Vetor horizontal unitário (para lâminas e círculos que não devem inclinar com a mira vertical). */
export function hnorm(d) { const l = Math.hypot(d.x, d.z) || 1; return { x: d.x / l, y: 0, z: d.z / l }; }

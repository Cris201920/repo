// systems/fxlib.js - Biblioteca de efeitos: emissores parametrizados por Molang (mote / streak / disc) e padrões compostos.
// Todo efeito visual de habilidade é montado a partir destes blocos + simulação de projéteis feita em script.
// Orçamento por tick e 3 níveis de detalhe (alto/reduzido/desligado) protegem o desempenho no celular.
import { MolangVariableMap, system, world } from "@minecraft/server";
import { getData } from "../core/db.js";
import { isValid, add, norm, sub, dist, rand } from "../core/utils.js";
import { PART_FX, PART_COL, PART_INFO } from "../data/partmap.gen.js";   // gerado por tools/partports.py (partículas portadas dos mods de referência)

export const PAL = {
  fire: [1, 0.55, 0.12], ember: [1, 0.3, 0.05], gold: [1, 0.85, 0.3], ice: [0.55, 0.88, 1], frost: [0.85, 0.97, 1], bolt: [1, 0.95, 0.45], violet: [0.75, 0.45, 1],
  shadow: [0.32, 0.18, 0.5], black: [0.08, 0.05, 0.14], void: [0.6, 0.3, 1], water: [0.25, 0.55, 1], foam: [0.8, 0.93, 1], earth: [0.62, 0.45, 0.26], dust: [0.75, 0.65, 0.5],
  wind: [0.7, 1, 0.9], light: [1, 0.98, 0.8], holy: [1, 0.92, 0.6], blood: [0.85, 0.08, 0.15], mana: [0.35, 0.65, 1], arcane: [0.65, 0.5, 1], green: [0.4, 1, 0.45],
  white: [1, 1, 1], steel: [0.78, 0.82, 0.9], pink: [1, 0.55, 0.8], sage: [0.45, 1, 0.9], toxic: [0.55, 1, 0.2],
};
// índices dos sprites no atlas 8x8 (16px) -> ver tools/rp.py TILE_NAMES
export const T = { blob: 0, spark: 1, diamond: 2, ring: 3, drop: 4, chunk: 5, star: 6, cross: 7, flame: 8, smoke: 9, ember: 10, shard: 11, arc: 12, rune1: 13, rune2: 14, rune3: 15,
  zig: 16, bubble: 17, flake: 18, skull: 19, eye: 20, heart: 21, note: 22, leaf: 23, wing: 24, claw: 25, fang: 26, orb: 27, gear: 28, glyph: 29, cloud: 30, line: 31 };
// círculos mágicos (atlas 4x4 de 64px)
export const CIRCLE = { arcane: 0, fire: 1, ice: 2, void: 3, holy: 4, shadow: 5, wind: 6, bolt: 7, gravity: 8, sage: 9, evolve: 10, earth: 11, water: 12, blood: 13, devour: 14, space: 15 };

let tickMark = -1, used = 0, lastUsed = 0, peakUsed = 0, totalUsed = 0, fxMark = -1, fxUsed = 0;
const MAP = new MolangVariableMap();
const CAP = { extreme: 520, ultra: 340, high: 210, medium: 120, low: 55, off: 0 };   // 6.55: mais densidade nos níveis altos (fases distribuídas no tempo)
const KMAP = { extreme: 1.7, ultra: 1.3, high: 1, medium: 0.7, low: 0.4, off: 0 };
/** Métrica de partículas (modo debug do Sábio): emitidas no tick atual/anterior, pico desde o início e total. Sem custo extra: só contadores.
 *  Inclui os spawns das partículas portadas (fxp), que têm orçamento próprio por tick. */
export const fxStats = () => ({ perTick: (system.currentTick === tickMark ? Math.max(used, lastUsed) : 0) + (system.currentTick === fxMark ? fxUsed : 0), peak: peakUsed, total: totalUsed });

export function lvl(p) { try { return p ? getData(p).settings.fx : "high"; } catch { return "high"; } }
export function ctx(p, power = 1, dim = undefined) {   // sem jogador: usa a dimensão informada (efeitos de chefes/zonas)
  const lv = lvl(p);
  return { p, dim: p?.dimension ?? dim, lv, k: KMAP[lv] ?? 0, power, tier: 1 };
}
/** Escala uma contagem pelo nível de detalhe. */
export const nn = (c, n) => (c.k <= 0 ? 0 : Math.max(1, Math.round(n * c.k)));
export const after = (ticks, fn) => system.runTimeout(() => { try { fn(); } catch { /* ignore */ } }, Math.max(1, Math.round(ticks)));
const col = (n) => (Array.isArray(n) ? n : PAL[n] ?? PAL.white);

function canSpawn(c) {
  if (c.k <= 0) return false;
  if (system.currentTick !== tickMark) { lastUsed = used; if (used > peakUsed) peakUsed = used; tickMark = system.currentTick; used = 0; }
  if (used >= CAP[c.lv]) return false;
  used++; totalUsed++; return true;
}
function setv(n, v) { MAP.setFloat("variable." + n, v); }
// 6.38: partícula grande nascendo DENTRO da câmera vira um borrão gigante na tela -> não é criada (cabeças cacheadas por tick)
let eyeTick = -1, eyes = [];
function nearEye(pos, size) {
  if (!(size >= 0.45)) return false;
  if (system.currentTick !== eyeTick) { eyeTick = system.currentTick; eyes = []; try { for (const p of world.getAllPlayers()) { try { eyes.push(p.getHeadLocation()); } catch { /* ignore */ } } } catch { /* ignore */ } }
  const r = Math.max(1.1, size * 1.4);
  for (const e of eyes) { const dx = e.x - pos.x, dy = e.y - pos.y, dz = e.z - pos.z; if (dx * dx + dy * dy + dz * dz < r * r) return true; }
  return false;
}

/** Partícula pontual. o: {dir,spd,col,a,size,life,tile,acc,drag,grow,fade} */
export function mote(c, pos, o = {}) {
  if (nearEye(pos, o.size ?? 0.25) || !canSpawn(c)) return;
  const d = o.dir ?? [0, 1, 0], k = col(o.col ?? "white");
  setv("dx", d[0]); setv("dy", d[1]); setv("dz", d[2]); setv("spd", o.spd ?? 0);
  setv("ax", o.acc?.[0] ?? 0); setv("ay", o.acc?.[1] ?? 0); setv("az", o.acc?.[2] ?? 0); setv("drag", o.drag ?? 0.5);
  setv("r", k[0]); setv("g", k[1]); setv("b", k[2]); setv("a", o.a ?? 1);
  setv("size", (o.size ?? 0.25) * (c.sz ?? 1)); setv("life", o.life ?? 0.8); setv("grow", o.grow ?? -0.4);
  setv("tu", (o.tile ?? 0) % 8); setv("tv", Math.floor((o.tile ?? 0) / 8));
  try { c.dim.spawnParticle("etheria:mote", pos, MAP); } catch { /* ignore */ }
}
/** Traço alinhado à direção (raios, cortes, rastros). */
export function streak(c, a, b, o = {}) {
  if (!canSpawn(c)) return;
  const v = sub(b, a), len = Math.hypot(v.x, v.y, v.z) || 0.01, k = col(o.col ?? "white");
  setv("dx", v.x / len); setv("dy", v.y / len); setv("dz", v.z / len);
  setv("r", k[0]); setv("g", k[1]); setv("b", k[2]); setv("a", o.a ?? 1);
  setv("sx", (o.w ?? 0.12) * (c.sz ?? 1)); setv("sy", o.len ?? len); setv("life", o.life ?? 0.25); setv("tu", (o.tile ?? T.line) % 8); setv("tv", Math.floor((o.tile ?? T.line) / 8));
  try { c.dim.spawnParticle("etheria:streak", { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, MAP); } catch { /* ignore */ }
}
/** Disco/círculo mágico deitado no chão. */
export function disc(c, pos, o = {}) {
  if (!canSpawn(c)) return;
  const k = col(o.col ?? "arcane"), t = o.circle ?? 0;
  setv("r", k[0]); setv("g", k[1]); setv("b", k[2]); setv("a", o.a ?? 0.9);
  setv("size", (o.size ?? 3) * (c.sz ?? 1)); setv("life", o.life ?? 1.2); setv("rot", o.rot ?? 30); setv("grow", o.grow ?? 0);
  setv("tu", t % 4); setv("tv", Math.floor(t / 4));
  try { c.dim.spawnParticle("etheria:disc", { x: pos.x, y: pos.y + (o.y ?? 0.06), z: pos.z }, MAP); } catch { /* ignore */ }
}

/** Camada do círculo do Sábio: placa texturizada (atlas etheria_sage) horizontal ou vertical, com rotação, pulso e subida próprios.
 *  o: {tile,size,rot(°/s),life(s),a,grow,rise,amp,freq,col,plane:'xz'|'xy'|'yz',y} */
export function layer(c, pos, o = {}) {
  if (c.k <= 0) return;
  const k = col(o.col ?? "sage"), t = o.tile ?? 0;
  setv("r", k[0]); setv("g", k[1]); setv("b", k[2]); setv("a", o.a ?? 0.9);
  setv("size", (o.size ?? 3) * (c.sz ?? 1)); setv("life", o.life ?? 1.5); setv("rot", o.rot ?? 30); setv("grow", o.grow ?? 0); setv("rise", o.rise ?? 0);
  setv("amp", o.amp ?? 0); setv("freq", o.freq ?? 1); setv("tu", t % 4); setv("tv", Math.floor(t / 4));
  const id = o.plane === "xy" ? "etheria:layer_xy" : o.plane === "yz" ? "etheria:layer_yz" : "etheria:layer";
  try { c.dim.spawnParticle(id, { x: pos.x, y: pos.y + (o.y ?? 0.05), z: pos.z }, MAP); } catch { /* ignore */ }
}

// --------------------------------------------------------------- padrões
const rd = () => { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u); return [Math.cos(a) * s, u, Math.sin(a) * s]; };
export function burst(c, p, o = {}) {
  const n = nn(c, o.n ?? 10);
  for (let i = 0; i < n; i++) { const d = rd(); if (o.up) d[1] = Math.abs(d[1]) * o.up + 0.2; mote(c, p, { ...o, dir: d, spd: (o.spd ?? 2) * (c.sz ?? 1) * rand(0.6, 1.2), life: (o.life ?? 0.7) * rand(0.8, 1.2) }); }
}
export function implode(c, p, o = {}) {
  const n = nn(c, o.n ?? 12), r = (o.radius ?? 3) * (c.sz ?? 1), life = o.life ?? 0.7;
  for (let i = 0; i < n; i++) {
    const d = rd(), q = { x: p.x + d[0] * r, y: p.y + d[1] * r * (o.flat ?? 0.6), z: p.z + d[2] * r };
    const dir = norm(sub(p, q)); mote(c, q, { ...o, dir: [dir.x, dir.y, dir.z], spd: r / life, life, drag: 0, grow: o.grow ?? -0.5 });
  }
}
export function ringFlat(c, p, o = {}) {
  const n = nn(c, o.n ?? 14), r = (o.radius ?? 2) * (c.sz ?? 1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, d = [Math.cos(a), o.lift ?? 0.05, Math.sin(a)];
    mote(c, { x: p.x + d[0] * (o.start ?? r * 0.15), y: p.y + 0.1, z: p.z + d[2] * (o.start ?? r * 0.15) }, { ...o, dir: d, spd: (o.spd ?? r / (o.life ?? 0.5)), drag: 0 });
  }
}
export function column(c, p, o = {}) {
  const n = nn(c, o.n ?? 8), h = (o.h ?? 4) * (c.sz ?? 1);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * (o.r ?? 0.6) * (c.sz ?? 1);
    mote(c, { x: p.x + Math.cos(a) * rr, y: p.y + Math.random() * 0.4, z: p.z + Math.sin(a) * rr }, { ...o, dir: [0, 1, 0], spd: (o.spd ?? h / (o.life ?? 0.8)), drag: 0 });
  }
}
export function fan(c, origin, dir, o = {}) {
  const n = nn(c, o.n ?? 10), ang = ((o.angle ?? 60) * Math.PI) / 180, base = Math.atan2(dir.z, dir.x), fz = c.sz ?? 1;
  for (let i = 0; i < n; i++) {
    const a = base + (Math.random() - 0.5) * ang, e = (Math.random() - 0.5) * (o.spread ?? 0.3);
    mote(c, origin, { ...o, dir: [Math.cos(a), e, Math.sin(a)], spd: (o.spd ?? 6) * fz * rand(0.6, 1.1), life: (o.life ?? 0.5) * rand(0.8, 1.2) });
  }
}
/** Arco de corte: pontos num arco à frente do jogador com direção tangente. */
export function arc(c, p, dir, o = {}) {
  const n = nn(c, o.n ?? 8), a0 = Math.atan2(dir.z, dir.x), span = ((o.angle ?? 120) * Math.PI) / 180, r = o.radius ?? 2.4, y = o.y ?? 1.2, tilt = o.tilt ?? 0;
  let prev;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 - span / 2 + span * t, q = { x: p.x + Math.cos(a) * r, y: p.y + y + Math.sin(t * Math.PI) * tilt - tilt / 2, z: p.z + Math.sin(a) * r };
    if (prev) { const j = i; after(i * (o.delay ?? 0.4), () => streak(c, prev0(prev, q, j), q, { col: o.col, w: o.w ?? 0.16, life: o.life ?? 0.3, tile: o.tile ?? T.line, a: o.a })); }
    prev = q;
  }
}
const prev0 = (a) => a;
export function bolt(c, a, b, o = {}) {
  const segs = Math.max(2, Math.round((o.seg ?? dist(a, b) / 1.2) * (c.k > 0 ? 1 : 0))), j = o.jitter ?? 0.5;
  let cur = a;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs, p = i === segs ? b : { x: a.x + (b.x - a.x) * t + rand(-j, j), y: a.y + (b.y - a.y) * t + rand(-j, j), z: a.z + (b.z - a.z) * t + rand(-j, j) };
    streak(c, cur, p, { col: o.col ?? "bolt", w: o.w ?? 0.14, life: o.life ?? 0.18, tile: T.zig });
    if (o.branch && Math.random() < o.branch) bolt(c, p, { x: p.x + rand(-2, 2), y: p.y + rand(-1.5, 1), z: p.z + rand(-2, 2) }, { ...o, seg: 2, branch: 0, w: (o.w ?? 0.14) * 0.6 });
    cur = p;
  }
}
/** Hélice que sobe ao redor de um ponto, distribuída no tempo. */
export function helix(c, p, o = {}) {
  const steps = nn(c, o.steps ?? 16), turns = o.turns ?? 2, r = (o.r ?? 1) * (c.sz ?? 1), h = (o.h ?? 2.5) * (c.sz ?? 1), dur = o.dur ?? 14;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    after(t * dur, () => {
      const a = t * turns * Math.PI * 2 + (o.phase ?? 0), pos = { x: p.x + Math.cos(a) * r, y: p.y + (o.down ? h * (1 - t) : h * t), z: p.z + Math.sin(a) * r };
      mote(c, pos, { ...o, dir: [-Math.sin(a), o.vy ?? 0.3, Math.cos(a)], spd: o.spd ?? 0.6, life: o.life ?? 0.5 });
    });
  }
}
/** Partículas orbitando um ponto móvel durante dur ticks. */
export function orbit(c, getPos, o = {}) {
  const dur = o.dur ?? 20, step = o.step ?? 2;
  for (let t = 0; t < dur; t += step) {
    after(t, () => {
      const p = getPos(); if (!p) return;
      const n = nn(c, o.n ?? 3);
      for (let i = 0; i < n; i++) {
        const a = (t / 4) * (o.speed ?? 1) + (i / n) * Math.PI * 2, r = (o.r ?? 1) * (o.shrink ? 1 - t / dur : 1);
        mote(c, { x: p.x + Math.cos(a) * r, y: p.y + (o.y ?? 0) + Math.sin(a * (o.wob ?? 0)) * 0.3, z: p.z + Math.sin(a) * r }, { ...o, dir: [-Math.sin(a), 0.05, Math.cos(a)], spd: o.spd ?? 0.5, life: o.life ?? 0.4 });
      }
    });
  }
}

// --------------------------------------------------------------- som
export function snd(c, id, o = {}) {
  if (!id) return;
  try { c.p.playSound(id, { volume: o.vol ?? 1, pitch: o.pitch ?? 1 }); } catch { /* ignore */ }
  const at = o.at; if (!at || o.self) return;
  try { for (const q of c.dim.getPlayers({ location: at, maxDistance: 24 })) if (q.id !== c.p.id) q.playSound(id, { volume: (o.vol ?? 1) * 0.8, pitch: o.pitch ?? 1, location: at }); } catch { /* ignore */ }
}

// --------------------------------------------------------------- projétil simulado
/** Projétil: dispara de `from` na direção `dir`, avança a cada tick. Callbacks: step(p, t, dirV), hit(p, entity|null). */
export function fly(c, o) {
  let p = { ...o.from }, d = norm(o.dir), t = 0, travelled = 0;
  const speed = o.speed ?? 1.6, range = o.range ?? 28, grav = o.gravity ?? 0, home = o.home;
  let vel = { x: d.x * speed, y: d.y * speed, z: d.z * speed };
  const id = system.runInterval(() => {
    let end = false, hitE = null;
    try {
      if (home && isValid(home)) {
        const tp = { x: home.location.x, y: home.location.y + 1, z: home.location.z }, want = norm(sub(tp, p)), cur = norm(vel);
        const k = o.turn ?? 0.2, nd = norm({ x: cur.x + (want.x - cur.x) * k, y: cur.y + (want.y - cur.y) * k, z: cur.z + (want.z - cur.z) * k });
        vel = { x: nd.x * speed, y: nd.y * speed, z: nd.z * speed };
      }
      vel.y -= grav;
      const np = { x: p.x + vel.x, y: p.y + vel.y, z: p.z + vel.z };
      // colisão com bloco
      try { const b = c.dim.getBlock(np); if (b && !b.isAir && !b.isLiquid) { end = true; } } catch { /* ignore */ }
      // colisão com entidade
      if (!end) {
        let list = []; try { list = c.dim.getEntities({ location: np, maxDistance: o.radius ?? 1.1 }); } catch { /* ignore */ }
        hitE = list.find((e) => o.valid ? o.valid(e) : e !== c.p);
        if (hitE) end = true;
      }
      travelled += Math.hypot(vel.x, vel.y, vel.z); t++;
      o.step?.(np, t, norm(vel), p);
      p = np;
      if (travelled >= range) end = true;
    } catch { end = true; }
    if (end) { system.clearRun(id); try { o.hit?.(p, hitE, norm(vel)); } catch { /* ignore */ } }
  }, 1);
  return id;
}

// --------------------------------------------------------------- partículas portadas dos mods de referência (RP/particles/fx_*.json)
// Geradas por tools/partports.py (TTIGRAAS, Tensura More Skills, Iron's Spells). Cada spawn já solta VÁRIAS partículas animadas (flipbook) definidas no JSON;
// aqui só se escolhe ONDE e QUANDO. Orçamento próprio por tick (FXCAP) e pelo nível de detalhe; só ids presentes em PART_INFO (= realmente gerados) são emitidos.
const FXCAP = { extreme: 110, ultra: 76, high: 52, medium: 30, low: 12, off: 0 };
const FXMAP = new MolangVariableMap();
const GAP = { pulse: 6, hold: 8, bind: 6, link: 6 };   // intervalo mínimo (ticks) entre repetições vindas de laços de campo/elo/prisão
const PHASE = { strike: "impact", hold: "pulse", bind: "pulse", link: "travel" };
const gate = new Map();
const TAU = Math.PI * 2;

function canFx(c) {
  if (c.k <= 0) return false;
  const now = system.currentTick;
  if (now !== fxMark) { fxMark = now; fxUsed = 0; }
  if (fxUsed >= (FXCAP[c.lv] ?? 0)) return false;
  fxUsed++; totalUsed++; return true;
}
/** Uma partícula portada ("etheria:fx_*"; ids fora de PART_INFO são ignorados). o: { col: nome de PAL | [r,g,b] (só vale para sprites que aceitam tinta), s: escala do tamanho }. */
export function fxp(c, id, pos, o = {}) {
  const inf = PART_INFO[id]; if (!inf || !canFx(c)) return false;
  const k = inf.c && o.col ? col(o.col) : null;
  try {
    if (k || o.s || (c.sz ?? 1) !== 1) {   // sem tinta nem escala: spawn simples (sem mapa), nada de variável velha vazando
      FXMAP.setFloat("variable.ft_on", k ? 1 : 0);
      FXMAP.setFloat("variable.ft_r", k ? k[0] : 1); FXMAP.setFloat("variable.ft_g", k ? k[1] : 1); FXMAP.setFloat("variable.ft_b", k ? k[2] : 1);
      FXMAP.setFloat("variable.ft_s", (o.s ?? 1) * (c.sz ?? 1));
      c.dim.spawnParticle(id, pos, FXMAP);
    } else c.dim.spawnParticle(id, pos);
    return true;
  } catch { return false; }
}
/** Ids de partículas portadas da habilidade (ou, sem entrada própria, do seu elemento). */
export const partIds = (sk) => PART_FX[sk?.id] ?? PART_FX[sk?.element] ?? [];
/** Atalho: solta em `at` as primeiras `n` partículas da chave (elemento ou id de habilidade), tingidas com a cor do elemento. */
export function partAt(c, key, at, n = 1, o = {}) {
  const ids = PART_FX[key]; if (!ids?.length) return;
  for (let i = 0; i < Math.min(n, ids.length); i++) fxp(c, ids[i], at, { col: PART_COL[key], ...o });
}

// tipo de partícula (PART_INFO[id].k) -> colocação por fase: [modo, quantidade, a, b]
//  ring: n em círculo de raio a, altura b · spread: n aleatórios num raio a, altura b · stack: n em coluna de altura a e base b (de cima para baixo) · above: n acima (altura b, espalhados por a)
//  one: 1 no ponto (altura b) · front: 1 à frente do conjurador (distância a, altura b) · line: n ao longo de origem->destino (desvio a, intervalo b em ticks)
const PLACE = {
  flame:   { cast: ["ring", 3, 1.1, 0.1], travel: ["line", 5, 0.2, 0.7], impact: ["spread", 3, 1.2, 0.1], pulse: ["spread", 3, 0.8, 0.1] },
  flare:   { cast: ["ring", 2, 1.2, 0.1], travel: ["line", 3, 0.2, 0.9], impact: ["spread", 2, 0.9, 0.1], pulse: ["spread", 2, 0.7, 0.1] },
  bolt:    { cast: ["ring", 2, 0.9, 1.0], travel: ["line", 5, 0.35, 0.6], impact: ["stack", 3, 3.2, 0.4], pulse: ["spread", 3, 0.9, 1.0] },
  thunder: { cast: ["ring", 1, 0.7, 1.2], travel: ["line", 3, 0.4, 0.8], impact: ["stack", 4, 6, 0.5], pulse: ["stack", 2, 5, 0.6] },
  spark:   { cast: ["ring", 2, 0.8, 1.0], travel: ["line", 5, 0.2, 0.6], impact: ["spread", 2, 0.8, 1.0], pulse: ["spread", 2, 0.8, 0.6] },
  thread:  { cast: ["ring", 4, 0.9, 0.9], travel: ["line", 7, 0.15, 0.6], impact: ["stack", 3, 2.4, 0.5], pulse: ["stack", 2, 2.2, 0.8] },
  cloud:   { cast: ["ring", 2, 0.8, 0.2], travel: ["line", 3, 0.5, 0.9], impact: ["spread", 3, 1.3, 0.3], pulse: ["spread", 3, 1.0, 0.3] },
  bubble:  { cast: ["ring", 3, 1.0, 0.3], travel: ["line", 4, 0.3, 0.8], impact: ["spread", 3, 1.2, 0.3], pulse: ["spread", 3, 1.0, 0.2] },
  glow:    { cast: ["ring", 3, 1.0, 0.2], travel: ["line", 3, 0.3, 0.8], impact: ["spread", 3, 1.2, 0.2], pulse: ["spread", 3, 1.0, 0.2] },
  wing:    { cast: ["ring", 2, 0.8, 1.0], travel: ["line", 2, 0.3, 0.9], impact: ["spread", 2, 0.8, 0.8], pulse: ["spread", 1, 0.8, 1.0] },
  fall:    { cast: ["above", 3, 1.2, 3.0], travel: ["line", 3, 0.3, 0.8], impact: ["above", 3, 1.5, 3.0], pulse: ["above", 3, 1.5, 3.0] },
  ring:    { cast: ["one", 1, 0, 0.12], impact: ["one", 1, 0, 0.12], pulse: ["one", 1, 0, 0.12] },
  slash:   { cast: ["front", 1, 1.8, 1.2], impact: ["spread", 2, 0.6, 1.1] },
  burst:   { cast: ["ring", 1, 0.5, 1.0], travel: ["line", 3, 0.2, 0.8], impact: ["spread", 2, 0.5, 0.9], pulse: ["spread", 2, 0.8, 0.5] },
  column:  { cast: ["one", 1, 0, 0], impact: ["one", 1, 0, 0], pulse: ["one", 1, 0, 0] },
  ground:  { impact: ["spread", 2, 1.2, 0.05], pulse: ["spread", 2, 1.5, 0.05] },
  trail:   { cast: ["ring", 2, 0.9, 1.0], travel: ["line", 5, 0.25, 0.6], impact: ["spread", 2, 0.8, 1.0], pulse: ["spread", 2, 1.0, 0.8] },
  orb:     { impact: ["one", 1, 0, 1.4] },
};

function placeFx(c, id, inf, ph, v, o, rs) {
  const cfg = PLACE[inf.k]?.[PHASE[ph] ?? ph]; if (!cfg) return;
  const [mode, n0, pa, pb] = cfg, n = nn(c, Math.round(n0 * (1 + ((v.tier ?? 1) - 1) * 0.4)));
  const ctr = ph === "cast" || ph === "hold" ? (v.pos ?? v.at) : (v.at ?? v.pos); if (!ctr || n <= 0) return;
  switch (mode) {
    case "ring": { const a0 = Math.random() * TAU; for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; fxp(c, id, { x: ctr.x + Math.cos(a) * pa, y: ctr.y + pb, z: ctr.z + Math.sin(a) * pa }, o); } break; }
    case "spread": for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * pa * rs; fxp(c, id, { x: ctr.x + Math.cos(a) * r, y: ctr.y + pb, z: ctr.z + Math.sin(a) * r }, o); } break;
    case "stack": for (let i = 0; i < n; i++) { const y = ctr.y + pb + pa * (1 - i / Math.max(1, n - 1)); after(i, () => fxp(c, id, { x: ctr.x + rand(-0.25, 0.25), y, z: ctr.z + rand(-0.25, 0.25) }, o)); } break;
    case "above": for (let i = 0; i < n; i++) fxp(c, id, { x: ctr.x + rand(-pa, pa), y: ctr.y + pb, z: ctr.z + rand(-pa, pa) }, o); break;
    case "one": fxp(c, id, { x: ctr.x, y: ctr.y + pb, z: ctr.z }, o); break;
    case "front": { const d = v.dir ?? { x: 0, y: 0, z: 1 }, l = Math.hypot(d.x, d.z) || 1; fxp(c, id, { x: ctr.x + (d.x / l) * pa, y: ctr.y + pb, z: ctr.z + (d.z / l) * pa }, o); break; }
    case "line": {
      const a = v.from, b = v.to ?? v.at; if (!a || !b || dist(a, b) < 2.5) break;   // habilidades sem trajeto (de cabeça a pés) não ganham rastro
      for (let i = 1; i <= n; i++) { const t = i / (n + 1); after(i * pb, () => fxp(c, id, { x: a.x + (b.x - a.x) * t + rand(-pa, pa), y: a.y + (b.y - a.y) * t + rand(-pa, pa), z: a.z + (b.z - a.z) * t + rand(-pa, pa) }, o)); }
      break;
    }
  }
}
function gated(c, sk, ph, v) {
  const key = `${c.p?.id ?? ""}|${sk.id}|${ph}|${v.key ?? ""}`, now = system.currentTick;
  if (now - (gate.get(key) ?? -999) < GAP[ph]) return false;
  if (gate.size > 300) gate.clear();
  gate.set(key, now); return true;
}
/** Liga as partículas portadas à habilidade (ou ao elemento dela). Fases: cast (conjurador) · travel (origem->destino) · impact/strike (alvo) · pulse/hold/bind (campo, escudo, prisão: repetidas, com intervalo mínimo)
 *  · link (elo alvo->conjurador). v: { pos, from, to, at, dir, tier, key? }. Sem entrada em PART_FX para a habilidade/elemento, não faz nada. */
export function skillPart(c, sk, ph, v) {
  if (c.k <= 0 || !sk || !v) return;
  const ids = PART_FX[sk.id] ?? PART_FX[sk.element]; if (!ids?.length) return;
  if (GAP[ph] && !gated(c, sk, ph, v)) return;
  const tier = v.tier ?? 1, early = ph === "cast" || ph === "travel" || ph === "link", take = Math.min(ids.length, early ? 2 : 2 + tier);
  const colr = PART_COL[sk.id] ?? PART_COL[sk.element], rad = sk.exec?.radius ?? 3, rs = Math.min(2.5, Math.max(0.8, rad / 3)), vv = { ...v, tier };
  for (let i = 0; i < take; i++) {
    const inf = PART_INFO[ids[i]]; if (!inf) continue;
    placeFx(c, ids[i], inf, ph, vv, { col: colr, s: inf.k === "ring" ? Math.min(3, Math.max(0.7, rad / 3)) : undefined }, rs);
  }
}
/** Envolve uma coreografia de magia em fases (data/spellstages.js ou derivada) somando as partículas portadas em formação, liberação, impacto e escudo; o resto da coreografia fica intacto. */
export function partChoreo(ch, sk) {
  if (!ch || !partIds(sk).length) return ch;
  const w = { ...ch };
  w.form = (c, f) => { ch.form?.(c, f); if (f.i === 0 && f.v0) skillPart(c, sk, "cast", f.v0); };
  w.release = (c, v) => { ch.release?.(c, v); skillPart(c, sk, "travel", v); };
  w.impact = (c, v) => { ch.impact?.(c, v); skillPart(c, sk, "impact", v); };
  if (ch.holdFx) w.holdFx = (c, f, k, total) => { ch.holdFx(c, f, k, total); skillPart(c, sk, "hold", { pos: f.feet, at: f.feet, tier: 1 }); };
  return w;
}

// --------------------------------------------------------------- 6.36: partículas próprias das camadas (RP/particles/vfx_*.json, atlas etheria_vfx)
/** kind: bolt | ember | shard | blade | wave | smoke | glow. o: {dir,spd,col,a,size,life,grow,acc,drag,tile,sx,sy} — mesmo orçamento por tick de mote(). */
export function vfx(c, kind, pos, o = {}) {
  if (nearEye(pos, kind === "bolt" ? 0 : o.size ?? 0.4) || !canSpawn(c)) return;
  const d = o.dir ?? [0, 1, 0], k = col(o.col ?? "white");
  setv("dx", d[0]); setv("dy", d[1]); setv("dz", d[2]); setv("spd", o.spd ?? 0);
  setv("ax", o.acc?.[0] ?? 0); setv("ay", o.acc?.[1] ?? 0); setv("az", o.acc?.[2] ?? 0); setv("drag", o.drag ?? 0.6);
  setv("r", k[0]); setv("g", k[1]); setv("b", k[2]); setv("a", o.a ?? 1);
  setv("size", (o.size ?? 0.4) * (c.sz ?? 1)); setv("life", o.life ?? 0.6); setv("grow", o.grow ?? 0); setv("tile", o.tile ?? 0);
  setv("sx", o.sx ?? 0.5); setv("sy", o.sy ?? 1); setv("seed", Math.floor(Math.random() * 4));
  try { c.dim.spawnParticle(`etheria:vfx_${kind}`, pos, MAP); } catch { /* ignore */ }
}
/** Raio ramificado (preto com contorno claro por padrão): segmentos tremeluzentes entre a e b + ramos curtos. */
export function vbolt(c, a, b, o = {}) {
  const segs = Math.max(2, Math.min(o.segs ?? 7, nn(c, o.segs ?? 7) + 1)), jit = o.jitter ?? 0.5;
  let prev = a;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs, cur = i === segs ? b : { x: a.x + (b.x - a.x) * t + rand(-jit, jit), y: a.y + (b.y - a.y) * t + rand(-jit, jit) * 0.6, z: a.z + (b.z - a.z) * t + rand(-jit, jit) };
    const v = sub(cur, prev), len = Math.hypot(v.x, v.y, v.z) || 0.01;
    vfx(c, "bolt", { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2, z: (prev.z + cur.z) / 2 }, { dir: [v.x / len, v.y / len, v.z / len], sx: o.w ?? 0.55, sy: len * 1.15, life: o.life ?? 0.22, col: o.col ?? "white", a: o.a ?? 1 });
    if (o.branch && Math.random() < o.branch && i < segs) {
      const e = { x: cur.x + rand(-1.4, 1.4), y: cur.y + rand(-0.8, 0.6), z: cur.z + rand(-1.4, 1.4) }, w = sub(e, cur), l2 = Math.hypot(w.x, w.y, w.z) || 0.01;
      vfx(c, "bolt", { x: (cur.x + e.x) / 2, y: (cur.y + e.y) / 2, z: (cur.z + e.z) / 2 }, { dir: [w.x / l2, w.y / l2, w.z / l2], sx: (o.w ?? 0.55) * 0.6, sy: l2, life: (o.life ?? 0.22) * 0.8, col: o.col ?? "white" });
    }
    prev = cur;
  }
}
/** Partículas com as texturas do mod Tensura (RP/particles/tx_*.json, flipbook). name: black_lightning | purple_lightning | red_lightning | lightning |
 *  fire | black_fire | plasma | gust | heat | bubble_pop | hell_flare | lightning_ball | fire_bolt | magic_circle */
export function tx(c, name, pos, o = {}) {
  if ((name !== "magic_circle" && nearEye(pos, o.size ?? 0.6)) || !canSpawn(c)) return;
  const d = o.dir ?? [0, 1, 0], k = col(o.col ?? "white");
  setv("dx", d[0]); setv("dy", d[1]); setv("dz", d[2]); setv("spd", o.spd ?? 0);
  setv("ax", o.acc?.[0] ?? 0); setv("ay", o.acc?.[1] ?? 0); setv("az", o.acc?.[2] ?? 0); setv("drag", o.drag ?? 0.6);
  setv("r", k[0]); setv("g", k[1]); setv("b", k[2]); setv("a", o.a ?? 1);
  setv("size", (o.size ?? 0.6) * (c.sz ?? 1)); setv("life", o.life ?? 0.5); setv("grow", o.grow ?? 0); setv("rot", o.rot ?? 40); setv("flat", o.flat ? 1 : 0);
  try { c.dim.spawnParticle(`etheria:tx_${name}`, pos, MAP); } catch { /* ignore */ }
}
/** 8.5: partículas de espada (RP/particles/etheria_sl_*.json, tools/sword_vfx.py). kind: ribbon | flash | ring | spark | glow | drop.
 *  o: {dir,spd,acc,drag,col,a,size,life,grow,tile,sx,sy,rot} — mesmo orçamento por tick e mesma proteção perto da câmera de mote(). */
export function sl(c, kind, pos, o = {}) {
  if ((kind === "glow" || kind === "flash" || kind === "drop") && nearEye(pos, o.size ?? 0.3)) return;
  if (!canSpawn(c)) return;
  const d = o.dir ?? [0, 1, 0], k = col(o.col ?? "white");
  setv("dx", d[0]); setv("dy", d[1]); setv("dz", d[2]); setv("spd", o.spd ?? 0);
  setv("ax", o.acc?.[0] ?? 0); setv("ay", o.acc?.[1] ?? 0); setv("az", o.acc?.[2] ?? 0); setv("drag", o.drag ?? 0.6);
  setv("r", k[0]); setv("g", k[1]); setv("b", k[2]); setv("a", o.a ?? 1);
  setv("size", (o.size ?? 0.3) * (c.sz ?? 1)); setv("life", o.life ?? 0.4); setv("grow", o.grow ?? 0); setv("tile", o.tile ?? 0); setv("rot", o.rot ?? 0);
  setv("sx", (o.sx ?? 0.2) * (c.sz ?? 1)); setv("sy", o.sy ?? 0.5);
  try { c.dim.spawnParticle(`etheria:sl_${kind}`, pos, MAP); } catch { /* ignore */ }
}

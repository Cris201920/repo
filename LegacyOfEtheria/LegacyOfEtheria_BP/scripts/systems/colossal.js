// systems/colossal.js - 8.6: MAGIAS COLOSSAIS (data/colossal.js). Escala de dezenas de blocos, aprendidas com pontos de habilidade.
// Cada magia segue 3 fases no MESMO ponto mirado: CONJURAÇÃO (o círculo se desenha, runas giram, partículas convergem) ->
// IMPACTO (dano em área, clarão, tremor leve de câmera) -> DISSIPAÇÃO (restos que sobem/caem e somem).
// Desempenho: cada lançamento tem orçamento próprio de partículas por tick (COLOSSAL.perTick × nível de detalhe, ver fxlib ctx.cap),
// além do teto global; um único runInterval por magia; no máx. COLOSSAL.maxTargets alvos por golpe (os mais próximos).
// Não quebra blocos: a "cratera" é só visual (partículas e disco escuro no chão).
import { system } from "@minecraft/server";
import { registerExec } from "./skills.js";
import { ctx, mote, streak, disc, layer, burst, ringFlat, column, bolt, snd, T, CIRCLE, nn } from "./fxlib.js";
import { dome, vfxSpawn, vfxSize, vfxKill, vfxOk } from "./spellvfx.js";
import { addBuff } from "./effects.js";
import { castGesture } from "./castanim.js";
import { COLOSSAL as CFG } from "../config.js";

const V = (x, y, z) => ({ x, y, z });
const up = (p, h) => V(p.x, p.y + h, p.z);
const lerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const RUNES = [T.rune1, T.rune2, T.rune3, T.glyph];
const SAGE = { glyph: 1, text: 3, scale: 4, band: 5, spell: 12, skillhex: 13, sigil: 15 };   // camadas do atlas etheria_sage
const onRing = (c, r, a, y = 0) => V(c.x + Math.cos(a) * r, c.y + y, c.z + Math.sin(a) * r);

/** um único laço por magia: fn(t) a cada tick até `ticks` */
function timeline(ticks, fn) {
  let t = 0;
  const id = system.runInterval(() => { try { fn(t); } catch (e) { console.warn(`[Etheria] magia colossal: ${e}`); } if (++t > ticks) system.clearRun(id); }, 1);
}
/** chão abaixo do ponto (até 40 blocos); sem a API, usa o próprio ponto */
function ground(dim, p) {
  try { const b = dim.getBlockBelow({ x: p.x, y: p.y + 0.5, z: p.z }, { maxDistance: 40 }); if (b) return V(p.x, b.location.y + 1, p.z); } catch { /* ignore */ }
  return { ...p };
}
/** tremor leve (e clarão opcional) para quem está perto */
function shake(dim, at, amt, r = CFG.shakeRadius, rgb = null) {
  const a = Math.min(CFG.shake, amt); let list = [];
  try { list = dim.getPlayers({ location: at, maxDistance: r }); } catch { /* ignore */ }
  for (const p of list) {
    try { p.runCommand(`camerashake add @s ${a.toFixed(2)} 0.7 positional`); } catch { /* ignore */ }
    if (rgb) { try { p.runCommand(`camera @s fade time 0.03 0.05 0.35 color ${rgb.join(" ")}`); } catch { /* ignore */ } }
  }
}
function body(dim, name, at, sz) { const e = vfxSpawn(dim, name, at, 0.2); if (e) vfxSize(e, sz); return e; }
const tp = (e, p) => { if (vfxOk(e)) { try { e.teleport(p); } catch { /* ignore */ } } };

// ------------------------------------------------------------------ blocos da conjuração
/** o círculo se DESENHA: dois traçadores percorrem a borda deixando pontos que ficam até o fim; camadas surgem de dentro para fora */
function drawCircle(c, at, R, t, o) {
  const F = o.form, life = o.life;
  if (t < F) {
    for (const s of [0, Math.PI]) { const a = s + (t / F) * Math.PI; mote(c, onRing(at, R, a, 0.15), { col: o.col, size: 0.45, life: Math.max(0.5, life - t / 20), tile: T.spark, spd: 0, grow: 0 }); }
    if (t % 2 === 0) mote(c, onRing(at, R, (t / F) * Math.PI, 0.3), { col: "white", size: 1.1, life: 0.2, tile: T.star });
  }
  const left = Math.max(0.4, life - t / 20);
  if (t === 0) disc(c, at, { col: o.col, circle: o.circ, size: R * 0.35, life: left, rot: 50 });
  if (t === Math.round(F * 0.3)) layer(c, at, { tile: o.tiles[0], size: R * 0.6, rot: -40, life: left, col: o.col, a: 0.9 });
  if (t === Math.round(F * 0.6)) disc(c, at, { col: o.col, circle: o.circ, size: R * 0.95, life: left, rot: 18 });
  if (t === F) { layer(c, at, { tile: o.tiles[1], size: R * 1.05, rot: -12, life: left, col: o.col2 ?? o.col, a: 0.8 }); ringFlat(c, at, { col: "white", n: 20, radius: R, life: 0.4, size: 0.5, tile: T.ring }); }
}
/** runas girando sobre o anel (cada tick n runas que vivem 2 ticks: parecem deslizar) */
function runeRing(c, at, r, t, n, col, y = 0.4, w = 0.05) {
  const k = nn(c, n);
  for (let i = 0; i < k; i++) { const a = (i / k) * TAU + t * w; mote(c, onRing(at, r, a, y + Math.sin(t / 6 + i) * 0.25), { col, size: 1.0, life: 0.12, tile: RUNES[i % 4], grow: 0 }); }
}
/** partículas convergindo de fora para o centro */
function converge(c, to, R, col, n, tile = T.spark, h = 0.3) {
  for (let i = 0; i < nn(c, n); i++) {
    const a = rnd(0, TAU), r = R * rnd(1, 1.35), q = onRing(to, r, a, rnd(-0.5, R * h)), life = 0.55;
    const d = V(to.x - q.x, to.y - q.y, to.z - q.z), l = Math.hypot(d.x, d.y, d.z) || 1;
    mote(c, q, { col, dir: [d.x / l, d.y / l, d.z / l], spd: l / life, life, drag: 0, size: 0.35, tile, grow: -0.3 });
  }
}
/** pontos de um anel inclinado (plano com normal n) */
function tiltRing(center, r, n, tilt, yaw, a0) {
  const N = V(Math.sin(tilt) * Math.cos(yaw), Math.cos(tilt), Math.sin(tilt) * Math.sin(yaw));
  let U = V(N.y, -N.x, 0); const lu = Math.hypot(U.x, U.y) || 1; U = V(U.x / lu, U.y / lu, 0);
  const W = V(N.y * U.z - N.z * U.y, N.z * U.x - N.x * U.z, N.x * U.y - N.y * U.x);
  return Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * TAU, cs = Math.cos(a) * r, sn = Math.sin(a) * r; return V(center.x + U.x * cs + W.x * sn, center.y + U.y * cs + W.y * sn, center.z + U.z * cs + W.z * sn); });
}
/** cratera visual: disco escuro + borda de poeira e pedras (nenhum bloco é alterado) */
function crater(c, at, r, life = 4) {
  disc(c, at, { col: [0.16, 0.11, 0.08], circle: CIRCLE.earth, size: r, life, rot: 0, a: 0.85, y: 0.03 });
  disc(c, at, { col: [0.05, 0.03, 0.02], circle: CIRCLE.gravity, size: r * 0.6, life, rot: 0, a: 0.8, y: 0.05 });
  for (let i = 0; i < nn(c, 16); i++) { const a = (i / 16) * TAU; mote(c, onRing(at, r * rnd(0.85, 1.05), a, 0.2), { col: i % 2 ? "earth" : "dust", size: rnd(0.4, 0.8), life: life * 0.8, tile: T.chunk, grow: 0 }); }
}

// ------------------------------------------------------------------ as magias
// o: { c, dim, at (chão no alvo), R, from, caster, hit(p, r, mult, opt) -> nº de alvos, foes(p, r) }
export const COLOSSAL_FX = {
  /** Selo Rúnico Colossal: círculo de runas de ~32 blocos de diâmetro; o selo explode em pilares de luz. */
  cs_runic_seal(o) {
    const { c, dim, at, R } = o, CH = 50, END = 95;
    timeline(END, (t) => {
      if (t < CH) {
        drawCircle(c, at, R, t, { form: 34, life: END / 20, col: "arcane", col2: "violet", circ: CIRCLE.arcane, tiles: [SAGE.sigil, SAGE.text] });
        runeRing(c, at, R * 0.82, t, 10, "violet", 0.5, 0.06); runeRing(c, at, R * 0.5, t, 6, "arcane", 0.8, -0.09);
        if (t % 2 === 0) converge(c, up(at, 1.5), R, t % 4 ? "arcane" : "white", 5);
        if (t > 20 && t % 3 === 0) for (let k = 0; k < 8; k++) { const p = onRing(at, R * 0.82, (k / 8) * TAU); column(c, p, { col: "violet", n: 1, h: 1 + t / 8, r: 0.3, tile: T.rune2, life: 0.5, size: 0.5 }); }
        if (t === 0) snd(c, "block.enchanting_table.use", { at, vol: 2, pitch: 0.5 });
        if (t === 30) { snd(c, "beacon.activate", { at, vol: 2, pitch: 0.6 }); shake(dim, at, 0.08); }
      }
      if (t === CH) {
        layer(c, up(at, 0.2), { tile: SAGE.spell, size: R * 1.1, rot: 160, life: 0.8, col: "white", a: 1, grow: 0.25 });
        for (let k = 0; k < 8; k++) { const p = onRing(at, R * 0.82, (k / 8) * TAU); column(c, p, { col: k % 2 ? "violet" : "white", n: 5, h: 18, r: 0.8, tile: T.line, life: 0.9, size: 0.7 }); }
        dome(dim, "aura_purple", at, R, 10);
        o.hit(at, R, 1, { falloff: true, push: 0.8, lift: 0.6, debuff: "paralyze", sec: 2 });
        shake(dim, at, 0.35, undefined, [200, 170, 255]); snd(c, "random.explode", { at, vol: 2.5, pitch: 0.7 }); snd(c, "mob.evocation_illager.cast_spell", { at, vol: 2, pitch: 0.5 });
      }
      if (t === CH + 1) { column(c, at, { col: "white", n: 10, h: 26, r: 2, tile: T.line, life: 0.9, size: 1 }); burst(c, up(at, 1), { col: "violet", n: 18, spd: 9, life: 0.8, tile: T.rune1, up: 0.5, size: 0.7 }); }
      if (t > CH + 1 && t % 2 === 0) {      // dissipação: runas sobem e se apagam
        for (let i = 0; i < nn(c, 6); i++) mote(c, onRing(at, R * rnd(0.2, 0.95), rnd(0, TAU), rnd(0.2, 1)), { col: i % 2 ? "violet" : "white", dir: [0, 1, 0], spd: rnd(1, 3), life: 1.4, size: 0.9, tile: RUNES[i % 4], grow: -0.5 });
      }
    });
  },

  /** Pilar do Firmamento: um selo no céu concentra a luz e um pilar colossal desce do alto, queimando por 2 s. */
  cs_heaven_pillar(o) {
    const { c, dim, at, R } = o, sky = up(at, 30), CH = 40, BEAM = 44, END = 110;
    timeline(END, (t) => {
      if (t <= CH) {
        if (t === 0) { layer(c, sky, { tile: SAGE.sigil, size: R * 1.6, rot: 30, life: (BEAM + CH) / 20, col: "holy", a: 0.95 }); layer(c, sky, { tile: SAGE.band, size: R * 2.1, rot: -14, life: (BEAM + CH) / 20, col: "gold", a: 0.7 }); }
        drawCircle(c, at, R * 1.6, t, { form: 30, life: (CH + BEAM) / 20, col: "gold", circ: CIRCLE.holy, tiles: [SAGE.glyph, SAGE.scale] });
        if (t % 2 === 0) { converge(c, sky, R * 1.6, "gold", 5, T.star, 0.05); for (let i = 0; i < nn(c, 3); i++) mote(c, onRing(at, R * rnd(0, 1.4), rnd(0, TAU), 0.2), { col: "light", dir: [0, 1, 0], spd: rnd(4, 9), life: 0.9, size: 0.3, tile: T.spark }); }
        if (t % 4 === 0) streak(c, sky, up(at, 0.5), { col: "holy", w: 0.08 + t / 300, life: 0.25, a: 0.5 });
        runeRing(c, sky, R * 1.25, t, 8, "gold", 0, 0.05);
        if (t === 0) snd(c, "beacon.power_select", { at, vol: 2, pitch: 0.6 });
        if (t === 26) shake(dim, at, 0.08);
      }
      if (t >= CH && t < CH + BEAM) {
        const k = t - CH, w = k < 4 ? k / 4 : k > BEAM - 10 ? (BEAM - k) / 10 : 1;
        streak(c, up(at, 34), up(at, -0.5), { col: "white", w: R * 0.55 * w, life: 0.12, tile: T.line });
        streak(c, up(at, 34), up(at, -0.5), { col: "holy", w: R * 0.9 * w, life: 0.12, tile: T.line, a: 0.55 });
        for (let i = 0; i < nn(c, 4); i++) { const p = onRing(at, R * rnd(0.1, 0.6) * w, rnd(0, TAU), rnd(0, 26)); streak(c, p, up(p, 6), { col: i % 2 ? "gold" : "light", w: 0.25, life: 0.15 }); }
        if (k % 3 === 0) ringFlat(c, at, { col: "gold", n: 18, radius: R * 1.5, life: 0.5, size: 0.5, tile: T.star });
        if (k % 2 === 0) burst(c, up(at, 0.4), { col: "light", n: 6, spd: 8, life: 0.5, tile: T.spark, up: 0.3 });
        if (k === 0) { dome(dim, "solar_grenade", at, R, BEAM - 8); shake(dim, at, 0.35, undefined, [255, 250, 220]); snd(c, "random.explode", { at, vol: 2.5, pitch: 1.3 }); snd(c, "beacon.activate", { at, vol: 2, pitch: 1.4 }); }
        if (k % 10 === 0) o.hit(at, R, k === 40 ? 1.0 : 0.45, { push: 0.25, lift: 0.5, debuff: "burn", sec: 2 });
      }
      if (t >= CH + BEAM && t % 2 === 0) {   // dissipação: plumas de luz caindo
        for (let i = 0; i < nn(c, 5); i++) mote(c, onRing(at, R * rnd(0, 1.5), rnd(0, TAU), rnd(4, 20)), { col: i % 2 ? "gold" : "light", dir: [0, -1, 0], spd: rnd(0.5, 1.5), life: 1.4, size: 0.4, tile: i % 3 ? T.star : T.wing, grow: -0.5 });
      }
    });
  },

  /** Sol Anelado: um sol enorme envolto em três anéis se forma no céu, desce e explode, deixando uma cratera visual. */
  cs_ringed_sun(o) {
    const { c, dim, at, R } = o, sky = V(at.x - 10, at.y + 30, at.z - 6), CH = 50, FALL = 22, IMP = CH + FALL, END = 140, SZ = 11;
    let sun = null;
    const rings = [[0.35, 0.3, 1.0], [1.15, 1.9, -0.8], [0.85, 4.0, 0.6]];   // [inclinação, direção, velocidade]
    timeline(END, (t) => {
      const ctr = t <= CH ? sky : t < IMP ? lerp(sky, up(at, SZ * 0.35), Math.pow((t - CH) / FALL, 1.6)) : null;
      if (t === 0) { sun = body(dim, "solar_grenade", sky, 0.4); snd(c, "mob.blaze.breathe", { at, vol: 2, pitch: 0.4 }); disc(c, at, { col: "ember", circle: CIRCLE.fire, size: R, life: IMP / 20, rot: 25 }); }
      if (ctr) {
        const g = Math.min(1, t / 40), rad = (0.5 + g * SZ * 2) * 0.4375;   // raio visível do corpo 3D
        if (t <= CH) vfxSize(sun, 0.5 + g * SZ * 2); else tp(sun, ctr);
        rings.forEach(([ti, yw, w], j) => {   // anéis contínuos: segmentos entre pontos vizinhos girando
          const P = tiltRing(ctr, rad * (1.35 + j * 0.25) + 0.6, nn(c, 14), ti, yw, t * 0.12 * w);
          P.forEach((p, i) => streak(c, p, P[(i + 1) % P.length], { col: j === 1 ? "fire" : "gold", w: 0.35, life: 0.1, tile: T.line }));
          if (t % 3 === 0) mote(c, P[0], { col: "white", size: 0.9, life: 0.15, tile: T.star });
        });
        if (t <= CH && t % 2 === 0) converge(c, ctr, rad * 3, t % 4 ? "fire" : "gold", 6, T.flame, 0.6);
        if (t > CH) { mote(c, up(ctr, rad), { col: "black", size: 2.4, life: 0.9, tile: T.smoke, a: 0.7 }); mote(c, ctr, { col: "ember", size: 1.6, life: 0.5, tile: T.flame }); }
        if (t % 3 === 0) ringFlat(c, at, { col: "ember", n: 12, radius: R * (0.4 + g * 0.6), life: 0.4, size: 0.4, tile: T.ember });
        if (t === CH) { snd(c, "mob.ghast.fireball", { at, vol: 2, pitch: 0.4 }); shake(dim, at, 0.1); }
      }
      if (t === IMP) {
        if (sun) vfxKill(sun);
        dome(dim, "flame_orb", at, R, 10); dome(dim, "heat_sphere", at, R * 0.6, 8);
        burst(c, up(at, 1), { col: "fire", n: 30, spd: 12, life: 1, size: 0.8, tile: T.flame, up: 0.7 });
        o.hit(at, R, 1, { falloff: true, push: 1.5, lift: 0.7, debuff: "burn", sec: 4 });
        shake(dim, at, 0.4, undefined, [255, 150, 60]); snd(c, "random.explode", { at, vol: 3, pitch: 0.4 });
      }
      if (t === IMP + 1) crater(c, at, R * 0.7, 6);
      if (t === IMP + 2) burst(c, up(at, 1), { col: "earth", n: 16, spd: 9, life: 1.2, size: 0.5, tile: T.chunk, up: 1.2, acc: [0, -16, 0] });
      if (t > IMP + 2 && t < IMP + 14 && t % 3 === 0) ringFlat(c, at, { col: t % 2 ? "dust" : "ember", n: 26, radius: R * (0.6 + (t - IMP) / 8), life: 0.6, size: 0.7, tile: T.smoke, a: 0.7 });
      if (t > IMP && t % 3 === 0) {   // dissipação: fumaça escura e brasas subindo da cratera
        column(c, at, { col: "black", n: 2, h: 14, r: R * 0.4, tile: T.smoke, life: 1.6, size: 1.6, a: 0.55 });
        for (let i = 0; i < nn(c, 3); i++) mote(c, onRing(at, R * rnd(0, 0.6), rnd(0, TAU), 0.3), { col: "ember", dir: [0, 1, 0], spd: rnd(1, 4), life: 1.2, size: 0.25, tile: T.ember });
      }
    });
  },

  /** Juízo da Tempestade: nuvens negras giram no céu e raios caem em sequência sobre os inimigos; um raio final fulmina o centro. */
  cs_tempest_judgement(o) {
    const { c, dim, at, R } = o, H = 22, CH = 30, END = 150, FIN = 136;
    timeline(END, (t) => {
      const rot = t * 0.03;
      if (t % 2 === 0) for (const p of tiltRing(up(at, H + Math.sin(t / 9)), R * 0.8, nn(c, 8), 0, 0, rot)) mote(c, p, { col: t % 4 ? "black" : "shadow", size: 3.4, life: 0.35, tile: T.cloud, a: 0.8 });
      if (t % 4 === 0) for (const p of tiltRing(up(at, H + 1.5), R * 0.45, nn(c, 5), 0, 0, -rot * 1.5)) mote(c, p, { col: "black", size: 2.6, life: 0.4, tile: T.cloud, a: 0.7 });
      if (t <= CH) {
        drawCircle(c, at, R, t, { form: 26, life: END / 20, col: "bolt", circ: CIRCLE.bolt, tiles: [SAGE.skillhex, SAGE.band] });
        if (t % 2 === 0) converge(c, up(at, H), R, "wind", 4, T.arc, 0.1);
        if (t === 0) snd(c, "ambient.weather.thunder", { at, vol: 2, pitch: 0.5 });
      }
      if (t % 5 === 0) { const a = rnd(0, TAU), p = onRing(at, R * rnd(0.2, 0.8), a, H); bolt(c, p, onRing(at, R * 0.7, a + 0.6, H - 0.5), { col: "violet", w: 0.12, seg: 4, life: 0.2 }); }
      if (t > CH && t % 3 === 0) for (let i = 0; i < nn(c, 3); i++) { const p = onRing(at, R * Math.sqrt(Math.random()), rnd(0, TAU), H - 2); streak(c, p, V(p.x + 0.6, p.y - 6, p.z), { col: "water", w: 0.05, life: 0.25 }); }
      if (t > CH && t < FIN && (t - CH) % 7 === 0) {      // raio sobre um inimigo (ou ponto aleatório)
        const foes = o.foes(at, R), e = foes.length ? foes[Math.floor(Math.random() * foes.length)] : null;
        const g = e ? ground(dim, e.location) : ground(dim, onRing(at, R * Math.sqrt(Math.random()) * 0.9, rnd(0, TAU), 2));
        bolt(c, up(g, H), g, { col: "white", w: 0.7, seg: 9, branch: 0.3, life: 0.3 }); bolt(c, up(g, H), g, { col: "bolt", w: 1.3, seg: 6, life: 0.2, a: 0.7 });
        burst(c, up(g, 0.3), { col: "bolt", n: 10, spd: 7, life: 0.4, tile: T.zig }); ringFlat(c, g, { col: "white", n: 12, radius: 3.5, life: 0.3, tile: T.ring });
        disc(c, g, { col: [0.1, 0.08, 0.12], circle: CIRCLE.bolt, size: 2.2, life: 2.5, rot: 0, a: 0.7 });
        o.hit(g, 3.5, 0.22, { push: 0.5, lift: 0.5, debuff: "paralyze", sec: 1 });
        snd(c, "ambient.weather.lightning.impact", { at: g, vol: 1.6, pitch: rnd(0.7, 1) });
        if ((t - CH) % 21 === 0) shake(dim, g, 0.18, 30, [220, 230, 255]);
      }
      if (t === FIN + 1) burst(c, up(at, 1), { col: "bolt", n: 24, spd: 12, life: 0.6, tile: T.zig });
      if (t >= FIN + 1 && t <= FIN + 3) ringFlat(c, at, { col: t === FIN + 1 ? "white" : "bolt", n: 22, radius: R * (0.3 + (t - FIN) * 0.3), life: 0.5, tile: T.ring, size: 0.5 });
      if (t === FIN) {
        for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU; bolt(c, up(at, H), onRing(at, k ? 1.5 : 0, a), { col: k ? "bolt" : "white", w: k ? 0.7 : 1.4, seg: 8, branch: 0.25, life: 0.35 }); }
        dome(dim, "lightning_sphere", at, R * 0.6, 8);
        o.hit(at, R, 1, { falloff: true, push: 1, lift: 0.6, debuff: "paralyze", sec: 2 });
        shake(dim, at, 0.35, undefined, [235, 240, 255]); snd(c, "ambient.weather.thunder", { at, vol: 3, pitch: 0.7 }); snd(c, "random.explode", { at, vol: 2, pitch: 1.1 });
      }
    });
  },

  /** Onda do Cataclismo: o conjurador golpeia o chão; uma onda de choque de ~40 blocos de diâmetro varre a área a partir de uma cratera. */
  cs_cataclysm_wave(o) {
    const { c, dim, R } = o, at = ground(dim, o.from), CH = 30, WAVE = 26, END = 110;
    let r0 = 0; const done = new Set();
    timeline(END, (t) => {
      if (t <= CH) {
        drawCircle(c, at, R * 0.3, t, { form: 20, life: (CH + WAVE) / 20, col: "earth", circ: CIRCLE.earth, tiles: [SAGE.scale, SAGE.band] });
        if (t % 2 === 0) { const a = rnd(0, TAU), l = R * 0.25 + t / CH * R * 0.6; streak(c, up(at, 0.08), onRing(at, l, a, 0.08), { col: [0.12, 0.08, 0.06], w: 0.18, life: 1.5, tile: T.line, a: 0.9 }); }
        if (t % 2 === 1) converge(c, up(at, 1), R * 0.5, "dust", 5, T.smoke, 0.1);
        if (t % 3 === 0) for (let i = 0; i < nn(c, 3); i++) mote(c, onRing(at, rnd(2, R * 0.5), rnd(0, TAU), 0.2), { col: "earth", dir: [0, 1, 0], spd: rnd(0.6, 1.6), life: 1.3, size: rnd(0.3, 0.6), tile: T.chunk, drag: 0.3 });
        if (t === 0) snd(c, "mob.ravager.roar", { at, vol: 1.6, pitch: 0.5 });
        if (t === 15) shake(dim, at, 0.1, 24);
      }
      if (t === CH) {
        crater(c, at, 5, 5); burst(c, up(at, 0.5), { col: "earth", n: 24, spd: 10, life: 1.1, size: 0.6, tile: T.chunk, up: 1.3, acc: [0, -18, 0] });
        burst(c, up(at, 0.5), { col: "dust", n: 14, spd: 6, life: 1.4, size: 1.4, tile: T.smoke, up: 0.4, a: 0.7 });
        shake(dim, at, 0.4, undefined, [200, 170, 130]); snd(c, "random.explode", { at, vol: 3, pitch: 0.5 }); snd(c, "mob.warden.sonic_boom", { at, vol: 1.5, pitch: 0.5 });
      }
      if (t >= CH && t <= CH + WAVE) {          // a onda: anel que cresce; cada alvo é atingido UMA vez quando a frente passa por ele
        const k = (t - CH) / WAVE, r = 2 + (R - 2) * (1 - Math.pow(1 - k, 1.6));
        const n = nn(c, 20);
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU + t * 0.07, p = onRing(at, r, a, 0.2); mote(c, p, { col: i % 3 ? "dust" : "earth", dir: [Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5], spd: rnd(2, 4) * (1 - k * 0.5), life: 0.6, size: 0.9 - k * 0.3, tile: i % 3 ? T.smoke : T.chunk, a: 0.85, acc: [0, -6, 0] }); }
        if (t % 2 === 0) ringFlat(c, at, { col: "white", n: 14, radius: r, start: r * 0.97, spd: 2, life: 0.15, size: 0.4, tile: T.ring });
        if (t % 4 === 0) disc(c, at, { col: "earth", circle: CIRCLE.earth, size: r, life: 0.3, rot: 0, a: 0.4 });
        o.hit(at, r + 0.8, 1 - k * 0.45, { push: 1.3, lift: 0.7, debuff: "stun", sec: 1, ring: [r0 - 0.8, r + 0.8], skip: done });
        r0 = r;
      }
      if (t > CH + WAVE && t % 3 === 0) {       // dissipação: poeira assentando e fumaça na borda da cratera
        for (let i = 0; i < nn(c, 5); i++) mote(c, onRing(at, R * rnd(0.3, 1), rnd(0, TAU), rnd(0.5, 2)), { col: "dust", dir: [0, -1, 0], spd: 0.4, life: 1.6, size: rnd(1, 1.8), tile: T.smoke, a: 0.45 });
        column(c, onRing(at, 5, rnd(0, TAU)), { col: "black", n: 1, h: 3, r: 0.5, tile: T.smoke, life: 1.2, size: 0.9, a: 0.5 });
      }
    });
  },

  /** Círculo das Mil Moedas: moedas de ouro surgem num anel que orbita o conjurador, crescem num círculo gigante e chovem sobre a área. */
  cs_coin_circle(o) {
    const { c, dim, at, R } = o, src = o.caster, CH = 40, RAIN = 44, END = 120, FIN = CH + RAIN;
    const me = () => { try { return src?.isValid ? { ...src.location } : o.from; } catch { return o.from; } };
    const sky = up(at, 16);
    timeline(END, (t) => {
      const p0 = me(), g = Math.min(1, t / CH), ringR = 2 + g * 5;
      if (t < FIN) {        // anel de moedas girando ao redor do conjurador (dois andares) + disco dourado
        const n = nn(c, 14);
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU + t * 0.14, h = 1.2 + (i % 2) * 0.9 + Math.sin(t / 5 + i) * 0.15; mote(c, onRing(p0, ringR * (i % 2 ? 0.8 : 1), (i % 2 ? -1 : 1) * a, h), { col: "gold", size: 0.6, life: 0.1, tile: T.orb, grow: 0 }); }
        if (t % 6 === 0) mote(c, onRing(p0, ringR, rnd(0, TAU), 1.6), { col: "white", size: 0.7, life: 0.25, tile: T.star });
        if (t % 20 === 0) disc(c, p0, { col: "gold", circle: CIRCLE.holy, size: ringR + 1, life: 1.1, rot: 60 });
      }
      if (t <= CH) {
        if (t % 2 === 0) converge(c, up(p0, 1.6), ringR * 1.6, "gold", 4, T.orb, 0.3);
        drawCircle(c, at, R, t, { form: 30, life: FIN / 20, col: "gold", circ: CIRCLE.holy, tiles: [SAGE.text, SAGE.band] });
        if (t === 0) { layer(c, sky, { tile: SAGE.glyph, size: R * 0.9, rot: 45, life: FIN / 20, col: "gold", a: 0.85 }); snd(c, "random.orb", { at: p0, vol: 2, pitch: 0.5 }); }
        if (t % 8 === 0) snd(c, "random.orb", { at: p0, vol: 1.2, pitch: 0.8 + t / 60 });
      }
      if (t > CH && t < FIN) {              // chuva: rajadas de moedas do anel e do céu
        for (let i = 0; i < nn(c, 3); i++) {
          const q = onRing(at, R * Math.sqrt(Math.random()), rnd(0, TAU), 0.3), s = i ? onRing(sky, rnd(0, R * 0.8), rnd(0, TAU)) : onRing(p0, ringR, rnd(0, TAU), 1.6);
          streak(c, s, q, { col: "gold", w: 0.18, life: 0.18, tile: T.line });
          mote(c, q, { col: "gold", size: 0.5, life: 0.5, tile: T.orb, dir: [rnd(-0.5, 0.5), 1, rnd(-0.5, 0.5)], spd: rnd(2, 5), acc: [0, -16, 0], drag: 0 });
        }
        if ((t - CH) % 8 === 0) { o.hit(at, R, 0.4, { push: 0.15, lift: 0.2 }); ringFlat(c, at, { col: "gold", n: 12, radius: R * 0.8, life: 0.3, tile: T.star, size: 0.4 }); snd(c, "random.orb", { at, vol: 1.5, pitch: rnd(1.2, 1.8) }); }
        if (t === CH + 1) shake(dim, at, 0.12);
      }
      if (t === FIN) {
        dome(dim, "aura_yellow", at, R, 8); dome(dim, "solar_grenade", at, R * 0.5, 6);
        burst(c, up(at, 1), { col: "gold", n: 34, spd: 11, life: 1.4, size: 0.5, tile: T.orb, up: 1.6, acc: [0, -18, 0], drag: 0 });
        burst(c, up(at, 1), { col: "white", n: 10, spd: 8, life: 0.5, tile: T.star });
        o.hit(at, R, 1.6, { falloff: true, push: 1.2, lift: 0.6, debuff: "stun", sec: 1 });
        shake(dim, at, 0.3, undefined, [255, 220, 120]); snd(c, "random.explode", { at, vol: 2.5, pitch: 1.2 }); snd(c, "random.levelup", { at, vol: 1.5, pitch: 0.6 });
      }
      if (t >= FIN + 1 && t <= FIN + 3) ringFlat(c, at, { col: t === FIN + 1 ? "white" : "gold", n: 20, radius: R * (0.35 + (t - FIN) * 0.35), life: 0.5, tile: T.ring, size: 0.5 });
      if (t > FIN + 3 && t % 2 === 0) for (let i = 0; i < nn(c, 4); i++) mote(c, onRing(at, R * rnd(0, 0.9), rnd(0, TAU), rnd(0.2, 3)), { col: i % 2 ? "gold" : "light", dir: [0, 1, 0], spd: rnd(0.3, 1), life: 1, size: 0.3, tile: i % 2 ? T.orb : T.star, grow: -0.5 });
    });
  },
};

// ------------------------------------------------------------------ jogador (sistema de habilidades: mana/recarga/dano/maestria iguais às demais)
const near = (list, p, max) => list.length <= max ? list : list.map((e) => [e, (e.location.x - p.x) ** 2 + (e.location.z - p.z) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, max).map((a) => a[0]);
export const lastColossal = { c: null };   // depuração/medição: contexto do último lançamento (c.peak = pico de partículas/tick da magia)
export function colossalCtx(pl, dim) {
  const c = ctx(pl, 3, dim); c.sz = 1; c.cap = Math.max(0, Math.round(CFG.perTick * (c.k > 1 ? Math.sqrt(c.k) : c.k))); c.peak = 0; return c;
}
export function startColossal() {
  registerExec("colossal", (pl, sk, s, d, H) => {
    const f = COLOSSAL_FX[sk.id]; if (!f) return "magia sem coreografia";
    const dim = pl.dimension, R = sk.exec.radius ?? 12;
    const A = sk.exec.self ? null : H.aim(pl, sk.exec.range ?? 32);
    const at = ground(dim, A ? (A.target ? { ...A.target.location } : A.point) : pl.location), c = colossalCtx(pl);
    lastColossal.c = c;
    H.mark(up(pl.location, 1.3), at, at);
    castGesture(pl, "grand", 0.25);
    const hit = (p, r, mult, o = {}) => {
      let list = H.around(dim, p, r, pl);
      if (o.ring) list = list.filter((e) => { const q = Math.hypot(e.location.x - p.x, e.location.z - p.z); return q >= o.ring[0] && q <= o.ring[1] && !o.skip?.has(e.id); });
      list = near(list, p, CFG.maxTargets);
      for (const e of list) {
        o.skip?.add(e.id);
        const fall = o.falloff ? Math.max(0.5, 1 - Math.hypot(e.location.x - p.x, e.location.z - p.z) / r * 0.5) : 1;
        try { H.hitOne(pl, e, sk, s, mult * fall); } catch { /* ignore */ }
        if (o.push) H.push(e, p, o.push, o.lift ?? 0.4);
        if (o.debuff) { try { addBuff(e, o.debuff, o.sec ?? 2); } catch { /* ignore */ } }
      }
      return list.length;
    };
    try { f({ c, dim, at, R, from: { ...pl.location }, caster: pl, hit, foes: (p, r) => near(H.around(dim, p, r, pl), p, CFG.maxTargets) }); }
    catch (e) { console.warn(`[Etheria] magia colossal ${sk.id}: ${e}`); return "falhou"; }
    return true;
  });
}

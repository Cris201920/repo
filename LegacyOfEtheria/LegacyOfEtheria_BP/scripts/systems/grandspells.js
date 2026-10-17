// systems/grandspells.js - 6.83: MAGIAS GIGANTES / ATAQUES CINEMATOGRÁFICOS (data/ultimates.js GRANDS).
// O MESMO visual serve ao jogador (exec.kind "grand", dano pelo sistema de habilidades) e aos chefes (habilidades GA no mobai, dano de chefe).
// Cada magia: aviso no chão -> acumulação -> lançamento -> impacto (ondas, clarão, tremor) -> dissipação; o dano acontece no impacto visual.
import { system } from "@minecraft/server";
import { registerExec } from "./skills.js";
import { ctx, after, mote, streak, disc, layer, burst, implode, ringFlat, column, helix, bolt, snd, T, CIRCLE, nn } from "./fxlib.js";
import { dome, vfxSpawn, vfxSize, vfxKill, vfxOk } from "./spellvfx.js";
import { addBuff } from "./effects.js";
import { castGesture } from "./castanim.js";
import { TIER_FX, tierOf } from "../data/tiers.js";
const tc = (pl, sk) => { const c = ctx(pl, 3); c.sz = TIER_FX[tierOf(sk)] * 0.75; return c; };   // 6.84: maior conforme o tier (as posições já são de grande escala)
import { bossDmg, bossHurt, bossNear } from "./bossabilities.js";

const V = (x, y, z) => ({ x, y, z });
const add = (a, b, k = 1) => V(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
const up = (p, h) => V(p.x, p.y + h, p.z);
const lerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const rnd = (a, b) => a + Math.random() * (b - a);
const valid = (e) => { try { return e?.isValid; } catch { return false; } };
const ringPts = (c, r, n, y = 0, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return V(c.x + Math.cos(a) * r, c.y + y, c.z + Math.sin(a) * r); });
function every(ticks, step, fn, end) { let t = 0; const id = system.runInterval(() => { t += step; try { fn(t); } catch { /* ignore */ } if (t >= ticks) { system.clearRun(id); try { end?.(); } catch { /* ignore */ } } }, step); }
function cam(dim, at, rgb, r = 40, shake = 0.5) {
  let list = []; try { list = dim.getPlayers({ location: at, maxDistance: r }); } catch { /* ignore */ }
  for (const p of list) { try { p.runCommand(`camera @s fade time 0.04 0.06 0.4 color ${rgb.join(" ")}`); } catch { /* ignore */ } try { p.runCommand(`camerashake add @s ${shake.toFixed(2)} 0.9 positional`); } catch { /* ignore */ } }
}
function body(dim, name, at, sz, grow = 6, life = 40) {
  const e = vfxSpawn(dim, name, at, 0.3); if (!e) return null;
  every(grow, 1, (t) => vfxSize(e, sz * (1 - Math.pow(1 - t / grow, 3)))); after(life, () => vfxKill(e)); return e;
}
function move(e, a, b, ticks, done) { every(ticks, 1, (t) => { if (vfxOk(e)) try { e.teleport(lerp(a, b, t / ticks)); } catch { /* ignore */ } }, done); }
const waves = (c, at, R, col, n = 4, gap = 3) => { for (let i = 0; i < n; i++) after(i * gap, () => ringFlat(c, at, { col, n: 26, radius: R * (0.5 + i * 0.3), life: 0.5, size: 0.55, tile: T.smoke })); };
const warn = (c, at, R, col, sec) => { disc(c, at, { col, circle: CIRCLE.space, size: R * 2, life: sec, rot: 30 }); ringFlat(c, at, { col, n: 20, radius: R, life: sec * 0.6, size: 0.3, tile: T.ring }); };

// o: { c, dim, from, at, R, hit(at, R, mult, opt), foes(at, R) -> entidades, caster (entidade) }
export const GRAND = {
  gs_meteor(o) {
    const { c, dim, at, R } = o, sky = add(at, V(-14, 44, -8)), mid = add(at, V(-6, 20, -3.5));
    warn(c, at, R, "ember", 2.2);
    every(40, 4, () => { for (const p of ringPts(at, R * 1.2, 6, 20, Math.random() * 6)) mote(c, p, { col: "black", size: 2.2, life: 0.6, tile: T.cloud, a: 0.7 }); });
    after(4, () => {
      const m = body(dim, "fire_ball", sky, 7, 6, 44); if (m) move(m, sky, at, 36);
      every(36, 2, (t) => { const p = lerp(sky, at, t / 36); mote(c, p, { col: "ember", size: 1.4, life: 0.8, tile: T.smoke }); mote(c, p, { col: "fire", size: 0.9, life: 0.4, tile: T.flame });
        if (t === 16) { burst(c, mid, { col: "white", n: 24, spd: 5, life: 0.8, size: 1.4, tile: T.cloud, a: 0.6 }); snd(c, "mob.ghast.fireball", { at: mid, vol: 1.4, pitch: 0.4 }); } });
    });
    after(40, () => {
      dome(dim, "flame_orb", at, R, 12); dome(dim, "heat_sphere", at, R * 0.6, 8);
      burst(c, up(at, 1), { col: "fire", n: 70, spd: 10, life: 1, size: 0.7, tile: T.flame, up: 0.8 });
      burst(c, at, { col: "earth", n: 30, spd: 7, life: 1, size: 0.45, tile: T.chunk, up: 1.2, acc: [0, -14, 0] });
      column(c, at, { col: "black", n: 24, h: 18, r: 3, tile: T.smoke, life: 1.6, size: 1.2, a: 0.7 });
      waves(c, at, R * 1.7, "dust", 5, 3); cam(dim, at, [255, 130, 50], 48, 0.8);
      o.hit(at, R, 1, { falloff: true, push: 1.6, lift: 0.7, debuff: "burn", sec: 5 });
      snd(c, "random.explode", { at, vol: 3, pitch: 0.4 });
    });
  },
  gs_dragon_storm(o) {
    const { c, dim, at, R } = o;
    every(100, 3, (t) => {
      for (const p of ringPts(at, R * 0.9, 7, 14 + Math.sin(t / 6), t / 8)) mote(c, p, { col: "black", size: 2.4, life: 0.6, tile: T.cloud, a: 0.85 });
      helix(c, at, { col: "wind", steps: 2, turns: 0.3, r: R * 0.6, h: 4, dur: 3, phase: t / 5, tile: T.arc, size: 0.35 });
      for (let i = 0; i < nn(c, 3); i++) { const p = V(at.x + rnd(-R, R), at.y + 14, at.z + rnd(-R, R)); streak(c, p, add(p, V(0.8, -5, 0)), { col: "water", w: 0.04, life: 0.2 }); }
      if (t % 9 === 0 && t >= 18) {
        const foes = o.foes(at, R), e = foes[Math.floor(Math.random() * foes.length)];
        const hitAt = e ? { ...e.location } : V(at.x + rnd(-R, R), at.y, at.z + rnd(-R, R));
        for (let k = 0; k < 2; k++) bolt(c, up(hitAt, 16), hitAt, { col: k ? "white" : "bolt", w: 0.45 - k * 0.15, branch: 0.4, life: 0.3 });
        burst(c, hitAt, { col: "bolt", n: 16, spd: 6, life: 0.4, tile: T.zig }); ringFlat(c, hitAt, { col: "white", n: 12, radius: 3, life: 0.3 });
        o.hit(hitAt, 3.2, 1, { push: 0.6, lift: 0.5, debuff: "paralyze", sec: 1 });
        snd(c, "ambient.weather.lightning.impact", { at: hitAt, vol: 1.4, pitch: rnd(0.7, 1) });
        if (t % 27 === 0) cam(dim, hitAt, [220, 235, 255], 28, 0.35);
      }
    });
    snd(c, "ambient.weather.thunder", { at, vol: 2, pitch: 0.5 });
  },
  gs_void_explosion(o) {
    const { c, dim, at, R } = o, gate = up(at, 6);
    warn(c, at, R, "void", 2);
    layer(c, gate, { plane: "xy", tile: CIRCLE.space, size: 6, rot: 120, life: 2.2, col: "void", a: 1 }); layer(c, gate, { plane: "yz", tile: CIRCLE.void, size: 6, rot: -120, life: 2.2, col: "violet" });
    const core = body(dim, "gravity_sphere", gate, 3, 30, 44);
    every(32, 2, (t) => { implode(c, gate, { col: t % 4 ? "void" : "black", n: 8, radius: 7 - t / 8, life: 0.4, tile: T.shard, size: 0.4 });
      for (const e of o.foes(at, R + 3)) o.pull?.(e, at); });
    after(32, () => { if (core) move(core, gate, at, 6); snd(c, "mob.wither.shoot", { at, pitch: 0.4, vol: 1.5 }); });
    after(38, () => {
      if (core) vfxKill(core); dome(dim, "chaos_eater", at, R, 12); dome(dim, "aura_purple", at, R * 1.2, 8);
      burst(c, up(at, 1), { col: "void", n: 60, spd: 9, life: 0.9, size: 0.6, tile: T.shard }); burst(c, up(at, 1), { col: "black", n: 30, spd: 4, life: 1.4, size: 1, tile: T.smoke });
      for (let i = 0; i < 8; i++) bolt(c, up(at, 1), add(at, V(rnd(-R, R), rnd(0, 6), rnd(-R, R))), { col: "violet", w: 0.2 });
      waves(c, at, R * 1.6, "violet", 4, 3); cam(dim, at, [80, 20, 130], 44, 0.6);
      o.hit(at, R, 1, { falloff: true, push: 1.4, lift: 0.5, debuff: "degenerate", sec: 6 });
      snd(c, "random.explode", { at, vol: 2.5, pitch: 0.5 });
    });
  },
  gs_celestial_lance(o) {
    const { c, dim, at, R } = o, foes = o.foes(at, R).slice(0, 12);
    const spots = foes.length ? foes.map((e) => ({ e, p: { ...e.location } })) : ringPts(at, R * 0.4, 6).map((p) => ({ e: null, p }));
    layer(c, up(at, 16), { tile: CIRCLE.holy, size: R * 1.5, rot: 25, life: 2.4, col: "gold", a: 0.9 });
    for (const s of spots) { const top = up(s.p, 15); every(26, 2, () => { streak(c, add(top, V(0, 2.5, 0)), add(top, V(0, -2.5, 0)), { col: "light", w: 0.35, life: 0.15 }); mote(c, top, { col: "gold", size: 0.9, life: 0.15, tile: T.star }); });
      disc(c, s.p, { col: "holy", circle: CIRCLE.holy, size: 3, life: 1.6 }); }
    after(28, () => {
      for (const s of spots) { const g = s.e && valid(s.e) ? { ...s.e.location } : s.p, top = up(g, 15);
        streak(c, top, g, { col: "white", w: 0.45, life: 0.25, tile: T.line });
        after(3, () => { burst(c, up(g, 0.3), { col: "holy", n: 16, spd: 5, life: 0.5, tile: T.star, up: 0.6 }); column(c, g, { col: "light", n: 8, h: 7, r: 0.4, tile: T.line, life: 0.5 }); o.hit(g, 2.6, 1, { push: 0.6, lift: 0.4 }); }); }
      after(4, () => { cam(dim, at, [255, 250, 220], 40, 0.45); snd(c, "random.explode", { at, vol: 1.6, pitch: 1.5 }); snd(c, "beacon.power_select", { at, pitch: 1.6 }); });
    });
  },
  gs_glacial_prison(o) {
    const { c, dim, at, R } = o, tgt = o.target;
    disc(c, at, { col: "ice", circle: CIRCLE.ice, size: R * 2.4, life: 3, rot: 40 });
    every(24, 2, (t) => { for (const p of ringPts(at, R * (1 - t / 40), 10, 0, t / 10)) column(c, p, { col: t % 4 ? "ice" : "frost", n: 2, h: 1 + t / 5, r: 0.2, tile: T.diamond, life: 0.9, size: 0.45 }); });
    after(24, () => {
      dome(dim, "aura_blue", at, R * 0.8, 70); dome(dim, "frost_ball", at, R * 0.5, 66);
      for (const p of ringPts(at, R * 0.7, 8)) column(c, p, { col: "frost", n: 10, h: 6, r: 0.4, tile: T.shard, life: 3, size: 0.6 });
      burst(c, up(at, 1), { col: "frost", n: 30, spd: 2, life: 1.5, size: 0.8, tile: T.cloud, a: 0.5 });
      o.hit(at, R, 1, { debuff: "paralyze", sec: 4 }); if (tgt) { try { addBuff(tgt, "paralyze", 4); } catch { /* ignore */ } }
      snd(c, "random.glass", { at, vol: 1.6, pitch: 0.5 }); cam(dim, at, [200, 240, 255], 30, 0.25);
    });
    after(96, () => { burst(c, up(at, 1), { col: "ice", n: 50, spd: 8, life: 0.8, size: 0.4, tile: T.shard, acc: [0, -8, 0] }); waves(c, at, R * 1.6, "frost", 3, 3);
      o.hit(at, R, 0.5, { push: 1, lift: 0.4 }); snd(c, "random.glass", { at, vol: 2, pitch: 1.4 }); });
  },
  gs_demonic_inferno(o) {
    const { c, dim, at, R } = o;
    disc(c, at, { col: "blood", circle: CIRCLE.fire, size: R * 2.2, life: 4.5, rot: 20 });
    every(80, 4, (t) => {
      for (let i = 0; i < nn(c, 8); i++) { const a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * R; mote(c, V(at.x + Math.cos(a) * r, Math.floor(at.y) + 0.1, at.z + Math.sin(a) * r), { col: i % 3 ? "fire" : "ember", dir: [0, 1, 0], spd: rnd(1, 3), size: 0.4, life: 0.6, tile: T.flame }); }
      if (t % 16 === 0) { const p = V(at.x + rnd(-R, R) * 0.7, at.y, at.z + rnd(-R, R) * 0.7);
        column(c, p, { col: "fire", n: 16, h: 12, r: 1, tile: T.flame, life: 0.9, size: 0.7 }); o.hit(p, 2.2, 1, { lift: 1.1, push: 0.2, debuff: "burn", sec: 3 }); snd(c, "mob.blaze.shoot", { at: p, pitch: 0.6 }); }
      if (t % 20 === 0) o.hit(at, R, 0.35, { debuff: "burn", sec: 2 });
    });
    after(84, () => { dome(dim, "hell_flare", at, R, 12); burst(c, up(at, 1), { col: "fire", n: 60, spd: 9, life: 0.9, tile: T.flame, up: 0.8 }); waves(c, at, R * 1.5, "ember", 4, 3);
      cam(dim, at, [255, 90, 30], 44, 0.7); o.hit(at, R, 2, { falloff: true, push: 1.5, lift: 0.6, debuff: "burn", sec: 5 }); snd(c, "random.explode", { at, vol: 2.5, pitch: 0.5 }); });
  },
  gs_absolute_destruction(o) {
    const { c, dim, at, R, from } = o, src = o.caster;
    const orb = body(dim, "aura_red", up(from, 1.5), 4, 56, 70);
    every(60, 3, (t) => {
      const f = src && valid(src) ? src.location : from;
      implode(c, up(f, 2.4), { col: t % 6 ? "blood" : "white", n: 10, radius: 6 - t / 15, life: 0.4, tile: T.spark });
      column(c, f, { col: "blood", n: 5, h: 8, r: 2.4, tile: T.line, life: 0.6 });
      for (let k = 0; k < 2; k++) { const a = rnd(0, Math.PI * 2), r = rnd(3, 9); streak(c, V(f.x, f.y + 0.1, f.z), V(f.x + Math.cos(a) * r, f.y + 0.1, f.z + Math.sin(a) * r), { col: "black", w: 0.14, life: 0.8, tile: T.line }); }
      if (t % 15 === 0) { snd(c, "mob.warden.sonic_charge", { at: f, pitch: 0.5 + t / 120 }); cam(dim, f, [120, 0, 0], 16, 0.1 + t / 400); }
    });
    after(60, () => {
      const f = src && valid(src) ? up(src.location, 1.5) : up(from, 1.5);
      if (orb) move(orb, f, at, 8);
      for (let k = 0; k < 3; k++) after(k, () => bolt(c, f, up(at, 1), { col: k === 1 ? "white" : "blood", w: 0.9 - k * 0.2, jitter: 0.4, life: 0.4 }));
      snd(c, "mob.warden.sonic_boom", { at, vol: 2, pitch: 0.5 });
    });
    after(68, () => {
      if (orb) vfxKill(orb); dome(dim, "hell_flare", at, R, 16); dome(dim, "aura_red", at, R * 1.25, 12); dome(dim, "chaos_eater", at, R * 0.6, 10);
      burst(c, up(at, 1), { col: "blood", n: 80, spd: 12, life: 1, size: 0.7, tile: T.shard, up: 0.6 }); burst(c, up(at, 1), { col: "black", n: 40, spd: 5, life: 1.8, size: 1.3, tile: T.smoke, up: 1.2 });
      column(c, at, { col: "white", n: 30, h: 24, r: 2.4, tile: T.line, life: 0.8 }); waves(c, at, R * 2, "blood", 6, 3);
      cam(dim, at, [255, 40, 40], 56, 1); o.hit(at, R, 1, { falloff: true, push: 2.2, lift: 0.8, debuff: "degenerate", sec: 8 });
      snd(c, "random.explode", { at, vol: 3, pitch: 0.3 }); after(5, () => snd(c, "random.explode", { at, vol: 2, pitch: 0.6 }));
    });
  },
};

// ------------------------------------------------------------------ jogador
export function startGrandSpells() {
  registerExec("grand", (pl, sk, s, d, H) => {
    const f = GRAND[sk.id]; if (!f) return "magia sem coreografia";
    const A = H.aim(pl, sk.exec.range ?? 30), at = A.target ? { ...A.target.location } : A.point, R = sk.exec.radius ?? 8, c = tc(pl, sk), dim = pl.dimension;
    H.mark(up(pl.location, 1.3), at, at);
    castGesture(pl, "charge", 0.15); after(14, () => castGesture(pl, "target"));
    layer(c, pl.location, { tile: CIRCLE.arcane, size: 4.5, rot: 70, life: 1.4, col: "white", a: 0.8 });
    const hit = (p, r, mult, o = {}) => {
      for (const e of H.around(dim, p, r, pl)) {
        const fall = o.falloff ? Math.max(0.45, 1 - Math.hypot(e.location.x - p.x, e.location.z - p.z) / r * 0.55) : 1;
        try { H.hitOne(pl, e, sk, s, mult * fall); } catch { /* ignore */ }
        if (o.push) H.push(e, p, o.push, o.lift ?? 0.4);
        if (o.debuff) { try { addBuff(e, o.debuff, o.sec ?? 3); } catch { /* ignore */ } }
      }
    };
    try { f({ c, dim, from: { ...pl.location }, at, R, target: A.target, caster: pl, hit, foes: (p, r) => H.around(dim, p, r, pl), pull: (e, p) => H.push(e, p, 0.5, 0.05, true) }); }
    catch (e) { console.warn(`[Etheria] magia gigante ${sk.id}: ${e}`); return "falhou"; }
    return true;
  });
}

// ------------------------------------------------------------------ chefes: as mesmas magias como habilidades de combate (mobai)
const players = (e, p, r) => bossNear(e, p, r);
const B = (id, R, cd, wind, mult) => ({ min: 0, max: 30, cd, wind,
  tele: (e, t, c) => { warn(c, t.location, R, "blood", wind / 20); snd(c, "mob.evocation_illager.prepare_attack", { at: t.location, pitch: 0.6 }); },
  run(e, t, c) {
    const at = { ...t.location };
    const hit = (p, r, m, o = {}) => { for (const pl of players(e, p, r)) { bossHurt(pl, e, bossDmg(e, mult * m)); if (o.push) { try { const dx = pl.location.x - p.x, dz = pl.location.z - p.z, l = Math.hypot(dx, dz) || 1; pl.applyKnockback(dx / l, dz / l, o.push, o.lift ?? 0.4); } catch { /* ignore */ } } if (o.debuff) { try { addBuff(pl, o.debuff, o.sec ?? 3); } catch { /* ignore */ } } } };
    GRAND[id]({ c, dim: e.dimension, from: { ...e.location }, at, R, target: t, caster: e, hit, foes: (p, r) => players(e, p, r),
      pull: (pl, p) => { try { const dx = p.x - pl.location.x, dz = p.z - pl.location.z, l = Math.hypot(dx, dz) || 1; pl.applyKnockback(dx / l, dz / l, 0.4, 0.05); } catch { /* ignore */ } } });
  } });
export const GA = {
  gs_meteor: B("gs_meteor", 9, 34, 20, 1.8), gs_dragon_storm: B("gs_dragon_storm", 11, 30, 16, 0.22), gs_void_explosion: B("gs_void_explosion", 8, 32, 18, 1.6),
  gs_celestial_lance: B("gs_celestial_lance", 14, 28, 16, 0.8), gs_glacial_prison: B("gs_glacial_prison", 4, 26, 14, 0.9), gs_demonic_inferno: B("gs_demonic_inferno", 10, 32, 16, 0.26),
  gs_absolute_destruction: B("gs_absolute_destruction", 12, 50, 24, 2.4),
};
// quais chefes usam quais magias gigantes (a partir da 2ª fase)
export const GRAND_BY_BOSS = {
  guy_crimson: ["gs_demonic_inferno", "gs_absolute_destruction"], milim_nava: ["gs_absolute_destruction", "gs_meteor"], diablo: ["gs_demonic_inferno"],
  testarossa: ["gs_void_explosion"], ultima: ["gs_demonic_inferno"], carrera: ["gs_absolute_destruction"], rimuru_senhor_demonio: ["gs_void_explosion"],
  michael_manas: ["gs_celestial_lance"], luminous_valentine: ["gs_celestial_lance"], veldora: ["gs_dragon_storm"], velzard: ["gs_glacial_prison"],
  velgrynd: ["gs_meteor"], veldanava: ["gs_absolute_destruction", "gs_celestial_lance"], demon_lord_returner: ["gs_void_explosion"],
};

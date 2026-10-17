// systems/ultimates.js - 6.81: AS 12 SKILLS ULTIMATE (data/ultimates.js). Um único executor "ultimate" registrado no sistema de habilidades
// existente (mana, recarga, dano, maestria e eventos são os de systems/skills.js). Cada Ultimate tem coreografia própria em 5 fases:
//   1 preparação (gesto de conjuração + círculo mágico)  2 acumulação (energia convergindo)  3 lançamento  4 impacto (ondas, clarão, tremor)
//   5 dissipação (resíduo do elemento). O dano acontece no instante do impacto visual.
// Câmera: só recursos estáveis do Bedrock (comando camera fade + camerashake, apenas para jogadores próximos do impacto).
// Desempenho: partículas passam pelo orçamento por tick do fxlib (nível de detalhe do jogador); corpos 3D pelo limite do spellvfx.
import { system, world } from "@minecraft/server";
import { registerExec, registerPost, grantSkill, hasSkill, castSkill, helpers } from "./skills.js";
import { SKILLS } from "../data/skills.js";
import { ULTIMATES, ULT_UNLOCKS, GRANDS, GRAND_UNLOCKS } from "../data/ultimates.js";
const ALL_UNLOCKS = { ...ULT_UNLOCKS, ...GRAND_UNLOCKS };
import { ctx, after, mote, streak, disc, layer, burst, implode, ringFlat, column, helix, orbit, bolt, snd, T, CIRCLE, nn } from "./fxlib.js";
import { dome, vfxSpawn, vfxSize, vfxKill, vfxOk } from "./spellvfx.js";
import { addBuff } from "./effects.js";
import { castGesture } from "./castanim.js";
import { TIER_FX, tierOf } from "../data/tiers.js";
const tc = (pl, sk) => { const c = ctx(pl, 3); c.sz = TIER_FX[tierOf(sk)] * 0.75; return c; };   // 6.84: maior conforme o tier (as posições já são de grande escala)
import { getData, markDirty } from "../core/db.js";
import { getStats } from "./stats.js";
import { isLordStage } from "../data/races.js";
import { lineageOf, formOfPlayer } from "../data/lineages.js";
import { sageStage, sageText } from "./voice.js";
import { say, toast } from "../core/utils.js";

// ------------------------------------------------------------------ utilidades
const V = (x, y, z) => ({ x, y, z });
const add = (a, b, k = 1) => V(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
const up = (p, h) => V(p.x, p.y + h, p.z);
const lerp = (a, b, t) => V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const flat = (d) => { const l = Math.hypot(d.x, d.z) || 1; return V(d.x / l, 0, d.z / l); };
const rnd = (a, b) => a + Math.random() * (b - a);
const ringPts = (c, r, n, y = 0, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return V(c.x + Math.cos(a) * r, c.y + y, c.z + Math.sin(a) * r); });
const valid = (e) => { try { return e?.isValid; } catch { return false; } };
function every(ticks, step, fn, end) { let t = 0; const id = system.runInterval(() => { t += step; try { fn(t); } catch { /* ignore */ } if (t >= ticks) { system.clearRun(id); try { end?.(); } catch { /* ignore */ } } }, step); }
/** clarão + tremor de câmera para quem estiver perto do impacto */
function impactCam(dim, at, rgb, r = 36, shake = 0.45) {
  let list = []; try { list = dim.getPlayers({ location: at, maxDistance: r }); } catch { /* ignore */ }
  for (const p of list) {
    try { p.runCommand(`camera @s fade time 0.04 0.06 0.45 color ${rgb.join(" ")}`); } catch { /* ignore */ }
    try { p.runCommand(`camerashake add @s ${shake.toFixed(2)} 0.9 positional`); } catch { /* ignore */ }
  }
}
/** corpo 3D (modelos do spellvfx) que cresce até sz em grow ticks e some após life ticks */
function body(dim, name, at, sz, grow = 8, life = 40) {
  const e = vfxSpawn(dim, name, at, 0.3); if (!e) return null;
  every(grow, 1, (t) => vfxSize(e, sz * (1 - Math.pow(1 - t / grow, 3))));
  after(life, () => vfxKill(e));
  return e;
}
function moveBody(e, a, b, ticks, done) {
  every(ticks, 1, (t) => { if (vfxOk(e)) try { e.teleport(lerp(a, b, t / ticks)); } catch { /* ignore */ } }, done);
}
function blast(pl, sk, s, H, at, R, mult, o = {}) {
  const list = H.around(pl.dimension, at, R, pl);
  for (const e of list) {
    const fall = o.falloff ? Math.max(0.45, 1 - Math.hypot(e.location.x - at.x, e.location.z - at.z) / R * 0.55) : 1;
    try { H.hitOne(pl, e, sk, s, mult * fall); } catch { /* ignore */ }
    if (o.push) H.push(e, at, o.push, o.lift ?? 0.4, !!o.inward);
    if (o.debuff) { try { addBuff(e, o.debuff, o.sec ?? 4); } catch { /* ignore */ } }
  }
  return list;
}
/** fases 1 e 2 comuns: gesto, círculo mágico sob os pés e energia convergindo nas mãos */
function prepare(c, pl, o) {
  castGesture(pl, "ultimate", 0.25);   // 6.86: animação própria das Ultimates
  const f = pl.location, hand = up(f, 1.3);
  layer(c, f, { tile: o.circle ?? CIRCLE.arcane, size: o.size ?? 6, rot: 50, life: (o.dur ?? 30) / 20 + 0.6, col: o.col, a: 0.95, grow: 0.15 });
  layer(c, f, { tile: CIRCLE.sage, size: (o.size ?? 6) * 0.6, rot: -80, life: (o.dur ?? 30) / 20 + 0.4, col: o.col2 ?? o.col, a: 0.8, y: 0.12 });
  every(o.dur ?? 30, 3, (t) => {
    implode(c, hand, { col: t % 6 ? o.col : (o.col2 ?? "white"), n: 6, radius: 2.6 - t / (o.dur ?? 30), life: 0.35, size: 0.22, tile: T.spark });
    if (t % 9 === 0) column(c, f, { col: o.col, n: 5, h: 3.5, r: 1.4, tile: o.tile ?? T.star, life: 0.7 });
  });
  helix(c, f, { col: o.col2 ?? o.col, steps: 24, turns: 3, r: 1.3, h: 2.6, dur: o.dur ?? 30, tile: T.rune1, size: 0.3 });
  snd(c, o.chargeSnd ?? "mob.evocation_illager.prepare_attack", { vol: 1, pitch: 0.7 });
}
function shockwaves(c, at, R, col, n = 3, gap = 4) { for (let i = 0; i < n; i++) after(i * gap, () => ringFlat(c, at, { col, n: 26, radius: R * (0.5 + i * 0.25), life: 0.5, size: 0.5, tile: T.smoke })); }

// ------------------------------------------------------------------ as 12 coreografias
const ULT = {};

// 1. AZATHOTH: dimensão de vazio no alvo (puxa), absorção, esfera final que distorce o espaço
ULT.ult_azathoth = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), A = H.aim(pl, sk.exec.range), at = A.target ? up(A.target.location, 1) : A.point, R = sk.exec.radius, dim = pl.dimension;
  H.mark(up(pl.location, 1.3), at, at);
  prepare(c, pl, { col: "void", col2: "black", circle: CIRCLE.void, size: 7, dur: 30, chargeSnd: "mob.enderdragon.growl" });
  after(8, () => { const e = body(dim, "gravity_sphere", at, R * 0.9, 20, 70); disc(c, at, { col: "void", circle: CIRCLE.space, size: R * 2.2, life: 3.5, rot: 40, y: -0.9 }); });
  every(56, 4, (t) => {           // a dimensão do vazio: anéis girando, fragmentos sugados, puxão
    ringFlat(c, at, { col: t % 8 ? "void" : "black", n: 16, radius: R * 0.9, life: 0.6, size: 0.35, tile: T.shard, start: R });
    implode(c, at, { col: "black", n: 10, radius: R, life: 0.6, size: 0.5, tile: T.chunk });
    for (const e of H.around(dim, at, R + 2, pl)) H.push(e, at, 0.55, 0.05, true);
    if (t % 12 === 0) for (const e of blast(pl, sk, s, H, at, R, 0.12)) { try { pl.addEffect("absorption", 120, { amplifier: 1, showParticles: false }); } catch { /* ignore */ } }
  });
  after(36, () => {               // lançamento: a esfera de energia nasce acima e desce no centro do vazio
    castGesture(pl, "target");
    const top = up(at, 9), sph = body(dim, "chaos_eater", top, 4.5, 12, 40);
    if (sph) moveBody(sph, top, at, 14);
    bolt(c, up(pl.location, 2), top, { col: "violet", w: 0.3, branch: 0.3 });
    snd(c, "mob.wither.shoot", { at, vol: 1.2, pitch: 0.5 });
  });
  after(52, () => {               // impacto: o espaço se rasga
    dome(dim, "gravity_sphere", at, R * 1.15, 14); dome(dim, "aura_purple", at, R * 0.7, 10);
    burst(c, at, { col: "void", n: 60, spd: 9, life: 0.9, size: 0.6, tile: T.shard }); burst(c, at, { col: "black", n: 40, spd: 5, life: 1.2, size: 0.9, tile: T.smoke });
    shockwaves(c, at, R * 1.4, "violet", 4, 3);
    for (let i = 0; i < 8; i++) bolt(c, at, add(at, V(rnd(-R, R), rnd(-2, 6), rnd(-R, R))), { col: i % 2 ? "violet" : "white", w: 0.22 });
    impactCam(dim, at, [70, 20, 110], 40, 0.6);
    blast(pl, sk, s, H, at, R, 1, { falloff: true, push: 1.2, lift: 0.5, debuff: "degenerate", sec: 8 });
    snd(c, "random.explode", { at, vol: 2, pitch: 0.5 }); snd(c, "mob.enderdragon.death", { at, vol: 0.8, pitch: 1.6 });
  });
  after(60, () => every(30, 5, () => implode(c, at, { col: "void", n: 8, radius: 4, life: 0.5, size: 0.3, tile: T.spark })));   // resíduo
  return true;
};

// 2. SHUB-NIGGURATH: círculos de criação, chuva de armas, cópias de habilidades adquiridas
ULT.ult_shub_niggurath = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, f = pl.location, R = sk.exec.radius;
  prepare(c, pl, { col: "green", col2: "gold", circle: CIRCLE.evolve, size: 8, dur: 24, chargeSnd: "block.enchanting_table.use" });
  const fw = flat(pl.getViewDirection()), side = V(-fw.z, 0, fw.x);
  const circles = [add(add(f, fw, 2.5), V(0, 4, 0)), add(add(f, side, 3.5), V(0, 3.2, 0)), add(add(f, side, -3.5), V(0, 3.2, 0))];
  after(10, () => circles.forEach((p, i) => after(i * 4, () => {
    layer(c, p, { plane: "xy", tile: CIRCLE.evolve, size: 3.4, rot: 90, life: 3.2, col: i ? "gold" : "green", a: 1 });
    layer(c, p, { plane: "xy", tile: CIRCLE.arcane, size: 2.2, rot: -140, life: 3, col: "white", a: 0.8 });
    snd(c, "block.beacon.activate", { at: p, pitch: 1.4 + i * 0.2 });
  })));
  every(48, 2, (t) => {           // chuva de armas forjadas nos círculos
    if (t < 18) return;
    const targets = H.around(dim, f, R, pl); if (!targets.length) return;
    const e = targets[Math.floor(Math.random() * targets.length)], src = circles[t % 3], to = up(e.location, 1);
    streak(c, src, to, { col: t % 4 ? "gold" : "green", w: 0.3, life: 0.3, tile: T.shard });
    burst(c, to, { col: "gold", n: 8, spd: 3, life: 0.4, tile: T.star });
    try { H.hitOne(pl, e, sk, s, 1); } catch { /* ignore */ }
    if (t % 6 === 0) snd(c, "random.anvil_land", { at: to, vol: 0.5, pitch: 1.8 });
  });
  // cópias de habilidades já adquiridas (sem custo; nunca outra Ultimate)
  const own = (d.unlockedSkills ?? []).map((id) => SKILLS[id]).filter((x) => x && x.type === "active" && x.cat !== "Ultimate" && (x.exec?.power ?? 0) > 0 && !["dash", "teleport", "agility", "devour"].includes(x.exec?.kind));
  own.sort((a, b) => (b.exec.power ?? 0) - (a.exec.power ?? 0));
  own.slice(0, sk.exec.copies ?? 3).forEach((x, i) => after(30 + i * 12, () => {
    layer(c, pl.location, { tile: CIRCLE.evolve, size: 3, rot: 120, life: 0.8, col: "green" });
    try { castSkill(pl, x.id, { free: true }); } catch { /* ignore */ }
    toast(pl, "§2Shub-Niggurath", `§7cópia: ${x.name}`);
  }));
  after(66, () => { burst(c, up(f, 2), { col: "green", n: 30, spd: 4, life: 0.8, tile: T.leaf }); snd(c, "random.levelup", { pitch: 0.6 }); });
  return true;
};

// 3. URIEL: barreira gigantesca + prisão dimensional no alvo
ULT.ult_uriel = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, R = sk.exec.radius, center = { ...pl.location }, sec = sk.exec.sec ?? 10;
  prepare(c, pl, { col: "holy", col2: "ice", circle: CIRCLE.holy, size: 6, dur: 16, chargeSnd: "beacon.activate" });
  after(14, () => {
    castGesture(pl, "aoe");
    dome(dim, "aura_blue", center, R, sec * 20); dome(dim, "aura_yellow", center, R * 0.98, sec * 20 - 6);
    disc(c, center, { col: "holy", circle: CIRCLE.holy, size: R * 2.1, life: sec, rot: 8 });
    impactCam(dim, center, [255, 240, 190], R + 8, 0.25);
    snd(c, "beacon.power_select", { at: center, vol: 1.5, pitch: 0.6 });
  });
  every(sec * 20, 10, (t) => {    // parede da barreira (hexágonos de luz) + efeitos dentro
    if (t < 14) return;
    for (const p of ringPts(center, R, 18, 0.3, t / 20)) column(c, p, { col: t % 20 ? "holy" : "ice", n: 2, h: 6, r: 0.2, tile: T.diamond, life: 0.6 });
    for (const q of dim.getPlayers({ location: center, maxDistance: R })) { try { addBuff(q, "barrier", 2, { stats: { defense: 25, res_magic: 20 } }); } catch { /* ignore */ } }
    for (const e of H.around(dim, center, R, pl)) { try { addBuff(e, "chill", 1); } catch { /* ignore */ } }
  });
  const A = H.aim(pl, sk.exec.range), tgt = A.target;
  if (tgt) after(20, () => {      // prisão dimensional: cubo de runas girando
    const p = tgt.location;
    try { addBuff(tgt, "paralyze", 6); } catch { /* ignore */ }
    try { H.hitOne(pl, tgt, sk, s, 1.5); } catch { /* ignore */ }
    every(120, 5, () => { if (!valid(tgt)) return; const q = tgt.location;
      for (const pl2 of ["xy", "yz"]) layer(c, up(q, 1), { plane: pl2, tile: CIRCLE.space, size: 2.6, rot: 120, life: 0.35, col: "ice", a: 0.9 });
      layer(c, q, { tile: CIRCLE.holy, size: 2.6, rot: -90, life: 0.35, col: "holy" }); });
    snd(c, "random.anvil_use", { at: p, pitch: 0.5 });
  });
  return true;
};

// 4. RAPHAEL: análise automática, aceleração do pensamento, aprimoramento
ULT.ult_raphael = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, sec = sk.exec.sec ?? 20;
  prepare(c, pl, { col: "sage", col2: "mana", circle: CIRCLE.sage, size: 5, dur: 12, chargeSnd: "beacon.power_select" });
  const foes = H.around(dim, pl.location, sk.exec.radius, pl).slice(0, 8);
  after(10, () => {
    castGesture(pl, "support");
    try { addBuff(pl, "ult_raphael", sec, { stats: { intelligence: 20, cdr: 30, crit: 15, manaCost: -25 } }); } catch { /* ignore */ }
    try { pl.addEffect("speed", sec * 20, { amplifier: 1, showParticles: false }); pl.addEffect("haste", sec * 20, { amplifier: 1, showParticles: false }); } catch { /* ignore */ }
    const lines = [];
    for (const e of foes) {
      try { addBuff(e, "sloth", 8); addBuff(e, "mark", 10); } catch { /* ignore */ }
      let hp = "?"; try { const h = e.getComponent("minecraft:health"); hp = `${Math.ceil(h.currentValue)}/${Math.ceil(h.effectiveMax)}`; } catch { /* ignore */ }
      lines.push(`§b${(e.nameTag || e.typeId.split(":")[1]).replace(/_/g, " ")} §7vida ${hp}`);
      const p = up(e.location, 2.4);
      layer(c, p, { plane: "xy", tile: CIRCLE.sage, size: 1.6, rot: 120, life: 3, col: "sage" });
      streak(c, up(pl.location, 1.6), p, { col: "sage", w: 0.05, life: 0.8, tile: T.line });
      try { H.hitOne(pl, e, sk, s, 1); } catch { /* ignore */ }
    }
    try { sageText(pl, `Análise concluída. ${foes.length} alvo(s). Aceleração do pensamento: 1000×.`, { pri: 1, key: "ult.raphael", cd: 10 }); } catch { /* ignore */ }
    if (lines.length) say(pl, `§3[Raphael] §fAnálise:\n${lines.join("\n")}`);
  });
  every(sec * 20, 6, (t) => {     // interface de análise ao redor da cabeça
    if (t < 10 || !valid(pl)) return;
    const h = up(pl.location, 2.3);
    for (const p of ringPts(h, 0.9, 3, 0, t / 6)) mote(c, p, { col: "sage", size: 0.22, life: 0.35, tile: [T.glyph, T.rune1, T.rune2][t % 3] });
  });
  return true;
};

// 5. BEELZEBUTH (já existente, executor "devour"): portal de absorção + esfera que consome a trajetória
registerPost((pl, sk, s, d) => {
  if (sk?.id !== "beelzebuth") return;
  const H = helpers();
  const c = tc(pl, sk), dim = pl.dimension, fw = pl.getViewDirection(), from = add(up(pl.location, 1.4), fw, 2), to = add(from, fw, 22);
  layer(c, from, { plane: "xy", tile: CIRCLE.devour, size: 4.5, rot: 160, life: 1.8, col: "shadow", a: 1 });
  layer(c, from, { plane: "xy", tile: CIRCLE.void, size: 3, rot: -200, life: 1.6, col: "black" });
  const sph = body(dim, "chaos_eater", from, 3.4, 8, 46);
  after(8, () => {
    if (sph) moveBody(sph, from, to, 30);
    every(30, 2, (t) => {
      const p = lerp(from, to, t / 30);
      implode(c, p, { col: "black", n: 6, radius: 3.5, life: 0.35, tile: T.smoke, size: 0.5 });
      for (const e of H.around(dim, p, 3.6, pl)) {
        H.push(e, p, 0.6, 0.05, true);
        if (t % 6 === 0) { try { H.hitOne(pl, e, sk, s, 0.35); } catch { /* ignore */ } implode(c, up(e.location, 1), { col: "shadow", n: 8, radius: 1.2, life: 0.3, tile: T.spark }); }
      }
    }, () => { burst(c, to, { col: "shadow", n: 40, spd: 6, life: 0.7, tile: T.smoke, size: 0.7 }); snd(c, "mob.enderman.teleport", { at: to, pitch: 0.4 }); });
  });
});

// 6. FAUST (VELDORA): tempestade dracônica + raio que atravessa o campo
ULT.ult_faust = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, R = sk.exec.radius, sec = sk.exec.sec ?? 8;
  prepare(c, pl, { col: "bolt", col2: "wind", circle: CIRCLE.bolt, size: 7, dur: 20, chargeSnd: "mob.enderdragon.growl" });
  every(sec * 20, 3, (t) => {     // céu escuro, chuva e vento girando ao redor do conjurador
    if (!valid(pl)) return;
    const f = pl.location;
    for (const p of ringPts(f, R * 0.85, 6, 9 + Math.sin(t / 7), t / 9)) mote(c, p, { col: "black", size: 1.6, life: 0.7, tile: T.cloud, a: 0.8 });
    for (let i = 0; i < nn(c, 4); i++) { const p = V(f.x + rnd(-R, R), f.y + 9, f.z + rnd(-R, R)); streak(c, p, add(p, V(0.6, -4, 0)), { col: "water", w: 0.04, life: 0.2 }); }
    ringFlat(c, f, { col: "wind", n: 8, radius: R * 0.7, life: 0.4, tile: T.arc, size: 0.35 });
    if (t % 6 === 0) {
      const foes = H.around(dim, f, R, pl);
      const e = foes[Math.floor(Math.random() * foes.length)];
      const at = e ? up(e.location, 0.5) : V(f.x + rnd(-R, R), f.y, f.z + rnd(-R, R));
      bolt(c, up(at, 12), at, { col: t % 12 ? "bolt" : "white", w: 0.35, branch: 0.35, life: 0.25 });
      burst(c, at, { col: "bolt", n: 10, spd: 4, life: 0.35, tile: T.zig });
      if (e) { try { H.hitOne(pl, e, sk, s, 0.22); H.push(e, f, 0.4, 0.3); } catch { /* ignore */ } }
      if (t % 12 === 0) snd(c, "ambient.weather.lightning.impact", { at, vol: 0.9, pitch: rnd(0.8, 1.1) });
    }
  });
  after(sec * 20 - 6, () => {     // golpe final: raio dracônico atravessando o campo
    if (!valid(pl)) return;
    castGesture(pl, "beam");
    const a = up(pl.location, 1.5), dir = pl.getViewDirection(), b = add(a, dir, sk.exec.range);
    for (let k = 0; k < 3; k++) after(k * 2, () => bolt(c, a, b, { col: k === 1 ? "white" : "bolt", w: 0.7 - k * 0.15, jitter: 0.8, branch: 0.25, life: 0.35 }));
    for (let i = 2; i < sk.exec.range; i += 3) { const p = add(a, dir, i); ringFlat(c, p, { col: "wind", n: 6, radius: 2.2, life: 0.35, tile: T.zig, size: 0.3 });
      for (const e of H.around(dim, p, 2.6, pl)) { try { H.hitOne(pl, e, sk, s, 1 / 4); addBuff(e, "paralyze", 3); } catch { /* ignore */ } } }
    impactCam(dim, a, [210, 230, 255], 40, 0.55);
    snd(c, "ambient.weather.thunder", { at: b, vol: 2, pitch: 0.6 });
  });
  return true;
};

// 7. SATANAEL: acumulação de ira, esfera de destruição, explosão cinematográfica
ULT.ult_satanael = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, R = sk.exec.radius, A = H.aim(pl, sk.exec.range), at = A.target ? A.target.location : A.point;
  H.mark(up(pl.location, 1.3), at, at);
  prepare(c, pl, { col: "blood", col2: "ember", circle: CIRCLE.blood, size: 8, dur: 60, chargeSnd: "mob.ravager.roar" });
  const hold = up(pl.location, 5.5), sph = body(dim, "hell_flare", hold, 6, 56, 80);
  every(56, 4, (t) => {           // a ira se acumula: colunas vermelhas, rachaduras no chão, esfera crescendo
    const f = pl.location;
    column(c, f, { col: t % 8 ? "blood" : "ember", n: 6, h: 6, r: 1.8, tile: T.flame, life: 0.6 });
    for (let k = 0; k < 2; k++) { const a = rnd(0, Math.PI * 2), r = rnd(2, 6); streak(c, V(f.x + Math.cos(a) * 1.5, f.y + 0.1, f.z + Math.sin(a) * 1.5), V(f.x + Math.cos(a) * r, f.y + 0.1, f.z + Math.sin(a) * r), { col: "ember", w: 0.12, life: 0.6, tile: T.line }); }
    implode(c, hold, { col: "fire", n: 8, radius: 4 + t / 20, life: 0.4, tile: T.ember });
    if (t % 16 === 0) snd(c, "mob.blaze.breathe", { pitch: 0.5 + t / 100 });
  });
  after(58, () => {               // lançamento
    castGesture(pl, "target");
    if (sph) moveBody(sph, hold, up(at, 1), 12);
    snd(c, "mob.ghast.fireball", { at, vol: 1.5, pitch: 0.5 });
  });
  after(70, () => {               // explosão
    if (sph) vfxKill(sph);
    dome(dim, "hell_flare", at, R, 14); dome(dim, "flame_orb", at, R * 0.65, 10);
    burst(c, up(at, 1), { col: "fire", n: 70, spd: 10, life: 1, size: 0.7, tile: T.flame, up: 0.8 });
    burst(c, up(at, 1), { col: "black", n: 40, spd: 4, life: 1.6, size: 1.1, tile: T.smoke, up: 1.2 });
    shockwaves(c, at, R * 1.6, "ember", 5, 3);
    column(c, at, { col: "fire", n: 30, h: 16, r: 3, tile: T.flame, life: 1.2 });
    impactCam(dim, at, [255, 90, 30], 44, 0.8);
    blast(pl, sk, s, H, at, R, 1, { falloff: true, push: 1.6, lift: 0.7, debuff: "burn", sec: 6 });
    snd(c, "random.explode", { at, vol: 3, pitch: 0.4 }); after(4, () => snd(c, "random.explode", { at, vol: 2, pitch: 0.7 }));
  });
  after(78, () => every(40, 5, () => { column(c, at, { col: "black", n: 4, h: 6, r: R * 0.5, tile: T.smoke, life: 1.2 }); mote(c, add(at, V(rnd(-R, R) * 0.5, 0.2, rnd(-R, R) * 0.5)), { col: "ember", size: 0.3, life: 1, tile: T.ember, dir: [0, 1, 0], spd: 1 }); }));
  return true;
};

// 8. LUCIFER: aura demoníaca, distorção, três clones, cópia da habilidade mais forte
ULT.ult_lucifer = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, sec = sk.exec.sec ?? 6, R = sk.exec.radius;
  prepare(c, pl, { col: "shadow", col2: "violet", circle: CIRCLE.shadow, size: 7, dur: 18, chargeSnd: "mob.evocation_illager.prepare_summon" });
  after(14, () => { castGesture(pl, "summon"); try { addBuff(pl, "ult_lucifer", sec + 4, { stats: { strength: 15, intelligence: 15, critDmg: 30 } }); } catch { /* ignore */ } });
  every((sec + 1) * 20, 4, (t) => {
    if (t < 16 || !valid(pl)) return;
    const f = pl.location, fw = flat(pl.getViewDirection()), side = V(-fw.z, 0, fw.x);
    helix(c, f, { col: t % 8 ? "shadow" : "violet", steps: 4, turns: 0.5, r: 1.1, h: 2.4, dur: 4, phase: t / 3, tile: T.spark, size: 0.3 });
    const clones = [add(f, side, 2.6), add(f, side, -2.6), add(f, fw, -2.4)];
    clones.forEach((p, i) => {    // silhueta do clone (energia demoníaca em forma humana)
      column(c, p, { col: i === 2 ? "black" : "shadow", n: 3, h: 1.9, r: 0.3, tile: T.smoke, life: 0.35, size: 0.5 });
      mote(c, up(p, 1.75), { col: "violet", size: 0.28, life: 0.3, tile: T.eye });
      if (t % 16 === i * 4) {
        const foes = H.around(dim, f, R, pl), e = foes[(t / 4 + i) % Math.max(1, foes.length)];
        if (e) { const to = up(e.location, 1); bolt(c, up(p, 1.3), to, { col: "violet", w: 0.2, jitter: 0.3 }); burst(c, to, { col: "shadow", n: 8, spd: 3, life: 0.4 });
          try { H.hitOne(pl, e, sk, s, 0.7); } catch { /* ignore */ } }
      }
    });
  });
  // cópia: a habilidade de maior poder do jogador, sem custo
  const best = (d.unlockedSkills ?? []).map((id) => SKILLS[id]).filter((x) => x && x.type === "active" && x.cat !== "Ultimate" && (x.exec?.power ?? 0) > 0 && !["dash", "teleport", "agility", "devour"].includes(x.exec?.kind)).sort((a, b) => (b.exec.power ?? 0) - (a.exec.power ?? 0))[0];
  if (best) after(40, () => { try { castSkill(pl, best.id, { free: true }); toast(pl, "§5Lucifer", `§7cópia: ${best.name}`); } catch { /* ignore */ } });
  return true;
};

// 9. METATRON: lanças de luz caindo do céu + grande explosão luminosa (cura aliados)
ULT.ult_metatron = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, R = sk.exec.radius, center = { ...pl.location }, N = sk.exec.lances ?? 24;
  prepare(c, pl, { col: "light", col2: "gold", circle: CIRCLE.holy, size: 7, dur: 20, chargeSnd: "beacon.power_select" });
  after(16, () => { castGesture(pl, "beam"); layer(c, up(center, 14), { tile: CIRCLE.holy, size: R * 1.6, rot: 20, life: 3.4, col: "gold", a: 0.9 }); snd(c, "beacon.activate", { at: center, pitch: 1.4 }); });
  for (let i = 0; i < N; i++) after(20 + i * 2, () => {
    const foes = H.around(dim, center, R, pl), e = foes.length ? foes[i % foes.length] : null;
    const at = e ? { ...e.location } : V(center.x + rnd(-R, R) * 0.7, center.y, center.z + rnd(-R, R) * 0.7), top = up(at, 14);
    streak(c, top, at, { col: i % 3 ? "light" : "gold", w: 0.32, life: 0.3, tile: T.line });
    mote(c, top, { col: "white", size: 0.8, life: 0.3, tile: T.star });
    after(3, () => { burst(c, up(at, 0.3), { col: "holy", n: 10, spd: 3.5, life: 0.4, tile: T.star, up: 0.6 }); ringFlat(c, at, { col: "gold", n: 8, radius: 1.6, life: 0.3 });
      if (e && valid(e)) { try { H.hitOne(pl, e, sk, s, 1); } catch { /* ignore */ } } if (i % 4 === 0) snd(c, "random.orb", { at, pitch: 1.6, vol: 0.6 }); });
  });
  after(24 + N * 2, () => {
    dome(dim, "solar_grenade", center, R * 0.8, 12);
    burst(c, up(center, 1), { col: "light", n: 70, spd: 9, life: 0.9, tile: T.star, size: 0.5 });
    shockwaves(c, center, R * 1.3, "gold", 4, 3);
    impactCam(dim, center, [255, 250, 220], 44, 0.4);
    blast(pl, sk, s, H, center, R, 2.2, { falloff: true, push: 1, lift: 0.5 });
    for (const q of dim.getPlayers({ location: center, maxDistance: R })) { try { q.addEffect("regeneration", 120, { amplifier: 2 }); q.addEffect("instant_health", 1, { amplifier: 1 }); } catch { /* ignore */ } }
    snd(c, "random.explode", { at: center, vol: 1.6, pitch: 1.4 });
  });
  return true;
};

// 12. CTHULHU (Velzard): Mundo Eterno (tempo parado), Fixação Completa (cristal no alvo), Whiteout Absorb (drena tudo)
ULT.ult_cthulhu = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, sec = sk.exec.sec ?? 6, A = H.aim(pl, sk.exec.range), at = A.target ? { ...A.target.location } : A.point, R = sk.exec.radius;
  H.mark(up(pl.location, 1.3), at, at);
  prepare(c, pl, { col: "ice", col2: "frost", circle: CIRCLE.ice, size: 7, dur: 18, chargeSnd: "random.glass" });
  after(16, () => {               // Mundo Eterno: o tempo para ao redor
    const f = { ...pl.location };
    disc(c, f, { col: "ice", circle: CIRCLE.ice, size: R, life: sec, rot: 20 });
    shockwaves(c, f, R, "frost", 3, 4);
    blast(pl, sk, s, H, f, R, 0.8, { debuff: "stun", sec });
    every(sec * 20, 6, () => ringFlat(c, f, { col: "frost", n: 18, radius: R, life: 0.5, tile: T.shard }));
    snd(c, "random.glass", { at: f, vol: 1.5, pitch: 0.5 });
  });
  after(26, () => {               // Fixação Completa: cristal gigante aprisiona o alvo
    castGesture(pl, "target");
    every(24, 3, () => column(c, at, { col: "ice", n: 12, h: 9, r: 1.6, tile: T.shard, life: 0.8, size: 0.7 }));
    after(4, () => { blast(pl, sk, s, H, at, 3.5, 2.2, { debuff: "stun", sec: sec + 2, push: 0, lift: 0 }); impactCam(dim, at, [180, 230, 255], 30, 0.35); snd(c, "random.glass", { at, vol: 1.6, pitch: 0.7 }); });
  });
  after(50, () => {               // Whiteout Absorb: drena energia e vida de todos para o usuário
    implode(c, pl.location, { col: "frost", n: 40, radius: R, life: 0.8 });
    blast(pl, sk, s, H, pl.location, R, 1.6, { falloff: true });
    try { pl.addEffect("instant_health", 1, { amplifier: 2 }); pl.addEffect("absorption", 200, { amplifier: 3 }); } catch { /* ignore */ }
    try { const dd = getData(pl); dd.mana = Math.min(getStats(pl).maxMana, dd.mana + 120); } catch { /* ignore */ }
  });
  return true;
};

// 10. CTHUGHA: forma de fogo, coluna de chamas colossal, chuva de meteoros
ULT.ult_cthugha = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, sec = sk.exec.sec ?? 10, A = H.aim(pl, sk.exec.range), at = A.target ? { ...A.target.location } : A.point, R = sk.exec.radius;
  H.mark(up(pl.location, 1.3), at, at);
  prepare(c, pl, { col: "fire", col2: "ember", circle: CIRCLE.fire, size: 7, dur: 18, chargeSnd: "mob.blaze.breathe" });
  after(16, () => { try { addBuff(pl, "ult_cthugha", sec, { stats: { strength: 12, intelligence: 12, res_fire: 100 } }); pl.addEffect("fire_resistance", sec * 20, { amplifier: 0, showParticles: false }); } catch { /* ignore */ } });
  every(sec * 20, 4, (t) => {     // forma de fogo: corpo envolto em chamas, queima quem chega perto
    if (t < 16 || !valid(pl)) return;
    const f = pl.location;
    column(c, f, { col: t % 8 ? "fire" : "gold", n: 6, h: 2.6, r: 0.7, tile: T.flame, life: 0.4, size: 0.4 });
    if (t % 12 === 0) blast(pl, sk, s, H, f, 3.5, 0.25, { debuff: "burn", sec: 3 });
  });
  after(22, () => {               // coluna de chamas colossal no alvo
    castGesture(pl, "target");
    disc(c, at, { col: "fire", circle: CIRCLE.fire, size: 7, life: 1.6, rot: 120 });
    every(30, 3, () => column(c, at, { col: "fire", n: 12, h: 22, r: 2.2, tile: T.flame, life: 1, size: 0.8 }));
    after(6, () => { blast(pl, sk, s, H, at, 3.5, 2.2, { debuff: "burn", sec: 6, push: 0.4, lift: 1.2 }); snd(c, "mob.blaze.shoot", { at, vol: 1.5, pitch: 0.5 }); impactCam(dim, at, [255, 140, 40], 30, 0.35); });
  });
  for (let i = 0; i < (sk.exec.meteors ?? 10); i++) after(40 + i * 5, () => {   // meteoros flamejantes
    const hit = V(at.x + rnd(-R, R), at.y, at.z + rnd(-R, R)), sky = V(hit.x - 8, hit.y + 22, hit.z - 4);
    const m = body(dim, "fire_ball", sky, 2.6, 2, 16); if (m) moveBody(m, sky, hit, 12);
    every(12, 2, (t) => mote(c, lerp(sky, hit, t / 12), { col: "ember", size: 0.6, life: 0.6, tile: T.smoke }));
    after(12, () => { if (m) vfxKill(m); dome(dim, "flame_orb", hit, 3.2, 3); burst(c, up(hit, 0.5), { col: "fire", n: 22, spd: 6, life: 0.6, tile: T.flame, up: 0.8 });
      ringFlat(c, hit, { col: "ember", n: 14, radius: 4, life: 0.4, tile: T.smoke }); blast(pl, sk, s, H, hit, 3.6, 1, { debuff: "burn", sec: 4, push: 0.6, lift: 0.5 });
      if (i % 2 === 0) snd(c, "random.explode", { at: hit, vol: 1, pitch: 0.9 }); });
  });
  return true;
};

// 11. MICHAEL: correntes e selos de luz, grande campo de contenção
ULT.ult_michael = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, R = sk.exec.radius, sec = sk.exec.sec ?? 8, center = { ...pl.location };
  prepare(c, pl, { col: "gold", col2: "holy", circle: CIRCLE.holy, size: 7, dur: 16, chargeSnd: "random.anvil_land" });
  const foes = H.around(dim, center, R, pl);
  after(14, () => {
    castGesture(pl, "target");
    for (const e of foes) {
      const p = { ...e.location };
      disc(c, p, { col: "gold", circle: CIRCLE.holy, size: 3, life: sec, rot: 60 });
      for (const k of [0, 1, 2, 3]) { const a = (k / 4) * Math.PI * 2, anchor = V(p.x + Math.cos(a) * 3, p.y + 3.5, p.z + Math.sin(a) * 3); bolt(c, anchor, up(p, 1), { col: "gold", w: 0.12, jitter: 0.15, seg: 4, life: 0.5 }); }
      try { addBuff(e, "paralyze", sec); H.hitOne(pl, e, sk, s, 1); } catch { /* ignore */ }
    }
    snd(c, "random.anvil_use", { at: center, vol: 1.2, pitch: 0.6 });
    impactCam(dim, center, [255, 230, 150], R + 6, 0.2);
  });
  every(sec * 20, 10, (t) => {    // campo de contenção: pilares de luz + correntes renovadas + símbolos
    if (t < 14) return;
    for (const p of ringPts(center, R, 12, 0, t / 40)) column(c, p, { col: "holy", n: 3, h: 8, r: 0.15, tile: T.line, life: 0.7 });
    for (const e of foes) { if (!valid(e)) continue; const q = e.location;
      layer(c, up(q, 1), { plane: "xy", tile: CIRCLE.holy, size: 1.8, rot: 160, life: 0.55, col: "gold" });
      if (Math.hypot(q.x - center.x, q.z - center.z) > R - 1) H.push(e, center, 0.7, 0.1, true); }
  }, () => { for (const e of foes) if (valid(e)) { try { H.hitOne(pl, e, sk, s, 0.8); } catch { /* ignore */ } burst(c, up(e.location, 1), { col: "gold", n: 12, spd: 4, life: 0.5, tile: T.cross }); } });
  return true;
};

// 12. HASTUR: campo de dominação com ondas periódicas
ULT.ult_hastur = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, R = sk.exec.radius, sec = sk.exec.sec ?? 8;
  prepare(c, pl, { col: "arcane", col2: "violet", circle: CIRCLE.gravity, size: 7, dur: 14, chargeSnd: "mob.warden.sonic_charge" });
  after(12, () => { castGesture(pl, "aoe"); layer(c, pl.location, { tile: CIRCLE.gravity, size: R * 2, rot: 25, life: sec + 0.5, col: "arcane", a: 0.85 }); });
  every(sec * 20, 4, (t) => {
    if (t < 12 || !valid(pl)) return;
    const f = pl.location;
    for (const p of ringPts(f, R, 10, 0.3, -t / 15)) mote(c, p, { col: "violet", size: 0.3, life: 0.4, tile: T.glyph });
    if (t % 20 === 0) {          // onda de domínio
      ringFlat(c, f, { col: "arcane", n: 30, radius: R, life: 0.6, size: 0.5, tile: T.arc });
      blast(pl, sk, s, H, f, R, 1, { push: 1.1, lift: 0.3, debuff: "fear", sec: 3 });
      snd(c, "mob.warden.sonic_boom", { at: f, vol: 0.7, pitch: 1.3 });
    }
  }, () => {                      // onda final devastadora
    if (!valid(pl)) return;
    const f = pl.location;
    shockwaves(c, f, R * 1.4, "violet", 4, 3); dome(dim, "aura_purple", f, R, 8);
    blast(pl, sk, s, H, f, R, 3, { falloff: true, push: 2, lift: 0.6, debuff: "stun", sec: 3 });
    impactCam(dim, f, [140, 90, 255], R + 10, 0.5);
    snd(c, "mob.warden.sonic_boom", { at: f, vol: 1.5, pitch: 0.6 });
  });
  return true;
};

// ------------------------------------------------------------------ registro + liberação
export function startUltimates() {
  registerExec("ultimate", (pl, sk, s, d, H) => {
    const f = ULT[sk.id]; if (!f) return "Ultimate sem coreografia";
    try { return f(pl, sk, s, d, H); } catch (e) { console.warn(`[Etheria] Ultimate ${sk.id}: ${e}`); return "falhou"; }
  });
  system.runInterval(() => { for (const p of world.getAllPlayers()) { try { checkUnlocks(p); } catch { /* ignore */ } } }, 100);
}
const sumBoss = (d, key) => d.bossKills?.[key] ?? 0;
/** requisitos de cada Ultimate (data/ultimates.js ULT_UNLOCKS); devolve [{ok, txt}] */
export function ultReqs(d, id) {
  const u = ALL_UNLOCKS[id]; if (!u) return [];
  const R = [];
  if (u.level) R.push({ ok: (d.level ?? 0) >= u.level, txt: `nível ${u.level}` });
  if (u.races) R.push({ ok: u.races.includes(d.race) || u.races.some((r) => String(d.raceStage ?? "").startsWith(r)), txt: `raça: ${u.races.join("/")}` });
  if (u.lord) R.push({ ok: isLordStage(d.raceStage), txt: "estágio Lorde Demônio" });
  if (u.skill) R.push({ ok: hasSkill(d, u.skill), txt: `ter ${SKILLS[u.skill]?.name ?? u.skill}` });
  if (u.skillsAny) R.push({ ok: u.skillsAny.some((x) => hasSkill(d, x)), txt: `ter ${u.skillsAny.map((x) => SKILLS[x]?.name ?? x).join(" ou ")}` });
  if (u.sage) R.push({ ok: (() => { try { return sageStage(d) >= u.sage; } catch { return false; } })(), txt: "Sábio evoluído a Raphael" });
  if (u.lin) R.push({ ok: (() => { try { return lineageOf(d)?.id === u.lin && (!u.lform || formOfPlayer(d) === u.lform); } catch { return false; } })(), txt: `linhagem ${u.lin}${u.lform ? " (forma verdadeira)" : ""}` });
  if (u.elem) R.push({ ok: (d.unlockedSkills ?? []).some((x) => SKILLS[x]?.element === u.elem && SKILLS[x]?.type === "active"), txt: `ter uma magia de ${({ ice: "gelo" })[u.elem] ?? u.elem}` });
  if (u.boss) R.push({ ok: sumBoss(d, u.boss) > 0, txt: "derrotar Michael" });
  return R;
}
function checkUnlocks(p) {
  const d = getData(p); if (!d.raceChosen) return;
  for (const sk of [...ULTIMATES, ...GRANDS]) {
    if (hasSkill(d, sk.id)) continue;
    const R = ultReqs(d, sk.id); if (!R.length || !R.every((r) => r.ok)) continue;
    grantSkill(p, sk.id);
    toast(p, sk.cat === "Ultimate" ? "§6§lSKILL ULTIMATE" : "§c§lMAGIA GIGANTE", `§e${sk.name}`);
    say(p, `§6[${sk.cat === "Ultimate" ? "Ultimate" : "Magia Gigante"}] §fVocê despertou §e${sk.name}§f! §7${sk.desc}`);
    try { sageText(p, `Aviso. Os requisitos foram atingidos. ${sk.cat === "Ultimate" ? "A Skill Ultimate" : "A magia de grande escala"} «${sk.name}» foi adquirida.`, { pri: 1, key: "ult.get." + sk.id, cd: 20 }); } catch { /* ignore */ }
    try { p.playSound("ui.toast.challenge_complete", { volume: 1, pitch: 0.9 }); } catch { /* ignore */ }
    markDirty(p);
  }
}

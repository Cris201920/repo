import { playBossAnim, kindFor } from "./bossanim.js";
// systems/mobai.js - IA individual dos mobs de Tensura: cada papel (e alguns mobs) tem ataques, alcance, recarga, telegrafia e som próprios.
// Roda a cada 10 ticks só ao redor dos jogadores (máx. N mobs por varredura); sem entidades auxiliares permanentes.
import { world, system } from "@minecraft/server";
import { MOBS } from "../data/mobs.gen.js";
import { isValid, rand, dist, norm, sub } from "../core/utils.js";
import { ctx, burst, ringFlat, column, bolt, fan, implode, streak, after, T } from "./fxlib.js";
import { setAct, formOf, FORMS } from "./truedragon.js";
import { CHR, CHR_A, chronoAbilities } from "./chronoa.js";
import { BA } from "./bossabilities.js";
import { bossAbilities, dmgMul, gcdMul, profileOf } from "./bossfight.js";

const STEP = 10, MAX_PER_PLAYER = 5, RANGE = 26;
const st = new Map(); // entityId -> { next, last }

const hurtP = (pl, e, amt) => { try { pl.applyDamage(amt, { cause: "entityAttack", damagingEntity: isValid(e) ? e : undefined }); } catch { /* ignore */ } };
const eff = (en, id, sec, amp = 0) => { try { en.addEffect(id, Math.round(sec * 20), { amplifier: amp, showParticles: true }); } catch { /* ignore */ } };
const push = (pl, from, s, up = 0.3, inward = false) => {
  try { let dx = pl.location.x - from.x, dz = pl.location.z - from.z; if (inward) { dx = -dx; dz = -dz; } const l = Math.hypot(dx, dz) || 1; pl.applyKnockback(dx / l, dz / l, s, up); } catch { /* ignore */ }
};
const near = (e, pos, r) => { try { return e.dimension.getPlayers({ location: pos, maxDistance: r }); } catch { return []; } };
const sound = (e, kind, vol = 1, pitch = 1) => {
  const id = `etheria.mob.${e.typeId.slice(8)}_${kind}`;
  for (const q of near(e, e.location, 32)) { try { q.playSound(id, { location: e.location, volume: vol, pitch }); } catch { /* ignore */ } }
};
const eye = (e) => ({ x: e.location.x, y: e.location.y + 1.2, z: e.location.z });
const cx = (t, pl) => ctx(pl ?? t, 1);
const flat = (a, b) => { const d = { x: b.x - a.x, y: 0, z: b.z - a.z }; return norm(d); };
const dashTo = (e, t, s = 1.4, up = 0.25) => { try { const d = flat(e.location, t.location); e.applyKnockback(d.x, d.z, s, up); } catch { /* ignore */ } };
const blinkBehind = (e, t) => { try { const d = flat(e.location, t.location); e.teleport({ x: t.location.x + d.x * 1.6, y: t.location.y, z: t.location.z + d.z * 1.6 }, { dimension: t.dimension }); } catch { /* ignore */ } };
const H = (e, p) => (MOBS[e.typeId]?.dmg ?? 8) * p * dmgMul(e);

// cada habilidade: {id, nome, min, max, cd (s), wind (ticks de preparação), run(e, t, ctx)} — "tele" desenha a preparação
const A = {
  web_shot: { min: 4, max: 14, cd: 7, wind: 10, tele: (e, t, c) => implode(c, eye(e), { col: "white", n: 6, radius: 1.2, tile: T.line }),
    run(e, t, c) { streak(c, eye(e), eye(t), { col: "white", w: 0.12, life: 0.4 }); eff(t, "slowness", 4, 2); if (e.typeId.includes("poison")) eff(t, "poison", 4, 0); hurtP(t, e, H(e, 0.4)); sound(e, "attack", 0.8, 1.2); } },
  pounce: { min: 3, max: 9, cd: 6, wind: 8, tele: (e, t, c) => burst(c, e.location, { col: "dust", n: 6, spd: 1, up: 1 }),
    run(e, t, c) { dashTo(e, t, 1.7, 0.35); sound(e, "attack"); after(8, () => { if (isValid(e) && isValid(t) && dist(e.location, t.location) < 3) hurtP(t, e, H(e, 0.8)); }); } },
  breath: { act: "ability", min: 4, max: 16, cd: 9, wind: 14, tele: (e, t, c) => implode(c, eye(e), { col: "fire", n: 10, radius: 1.8 }),
    run(e, t, c) { const d = flat(e.location, t.location); fan(c, eye(e), d, { col: "fire", n: 26, spd: 9, life: 0.6, angle: 38, tile: T.flame });
      for (const pl of near(e, e.location, 14)) { const v = flat(e.location, pl.location); if (v.x * d.x + v.z * d.z > 0.8) { hurtP(pl, e, H(e, 0.9)); try { pl.setOnFire(4, true); } catch { /* ignore */ } } } sound(e, "attack", 1.2, 0.9); } },
  slam: { act: "tail", min: 0, max: 5, cd: 6, wind: 12, tele: (e, t, c) => ringFlat(c, e.location, { col: "dust", n: 12, radius: 2 }),
    run(e, t, c) { ringFlat(c, e.location, { col: "earth", n: 24, radius: 5, life: 0.5 }); burst(c, e.location, { col: "dust", n: 14, up: 1.5 });
      for (const pl of near(e, e.location, 5)) { hurtP(pl, e, H(e, 0.7)); push(pl, e.location, 1.3, 0.5); } sound(e, "attack", 1.1, 0.8); } },
  tide: { min: 0, max: 6, cd: 10, wind: 12, tele: (e, t, c) => ringFlat(c, e.location, { col: "water", n: 12, radius: 2 }),
    run(e, t, c) { ringFlat(c, e.location, { col: "foam", n: 24, radius: 5.5, life: 0.6, tile: T.bubble });
      for (const pl of near(e, e.location, 5.5)) { eff(pl, "slowness", 4, 1); hurtP(pl, e, H(e, 0.4)); push(pl, e.location, 0.8, 0.2); }
      try { e.addEffect("regeneration", 80, { amplifier: 2 }); } catch { /* ignore */ } sound(e, "attack"); } },
  water_blade: { min: 4, max: 15, cd: 5, wind: 8, tele: (e, t, c) => burst(c, eye(e), { col: "water", n: 6, spd: 1.4 }),
    run(e, t, c) { streak(c, eye(e), eye(t), { col: "water", w: 0.2, life: 0.35 }); hurtP(t, e, H(e, 0.7)); sound(e, "attack", 1, 1.3); } },
  wail: { min: 0, max: 9, cd: 11, wind: 14, tele: (e, t, c) => implode(c, eye(e), { col: "shadow", n: 10, radius: 2 }),
    run(e, t, c) { ringFlat(c, e.location, { col: "shadow", n: 24, radius: 8, life: 0.8 }); for (const pl of near(e, e.location, 8)) { eff(pl, "weakness", 6, 1); eff(pl, "slowness", 3, 0); } sound(e, "attack", 1.1, 0.8); } },
  dark_bolt: { min: 4, max: 16, cd: 6, wind: 10, tele: (e, t, c) => burst(c, eye(e), { col: "shadow", n: 8, spd: 1.5 }),
    run(e, t, c) { bolt(c, eye(e), eye(t), { col: "violet", w: 0.16 }); hurtP(t, e, H(e, 0.8)); eff(t, "wither", 3, 0); sound(e, "attack"); } },
  blink: { min: 5, max: 18, cd: 9, wind: 6, tele: (e, t, c) => burst(c, e.location, { col: "void", n: 10, up: 1 }),
    run(e, t, c) { blinkBehind(e, t); burst(c, e.location, { col: "void", n: 12, up: 1 }); sound(e, "attack", 0.9, 1.4); } },
  quake: { min: 0, max: 7, cd: 9, wind: 16, tele: (e, t, c) => { ringFlat(c, e.location, { col: "steel", n: 14, radius: 3 }); },
    run(e, t, c) { ringFlat(c, e.location, { col: "earth", n: 30, radius: 7, life: 0.7 }); burst(c, e.location, { col: "steel", n: 18, up: 2 });
      for (const pl of near(e, e.location, 7)) { hurtP(pl, e, H(e, 0.9)); push(pl, e.location, 1.8, 0.7); } sound(e, "attack", 1.3, 0.7); } },
  iron_skin: { min: 0, max: 30, cd: 25, wind: 4, cond: (e) => { try { const h = e.getComponent("minecraft:health"); return h.currentValue < h.effectiveMax * 0.5; } catch { return false; } },
    tele: () => {}, run(e, t, c) { eff(e, "resistance", 8, 2); burst(c, eye(e), { col: "steel", n: 16, spd: 2 }); sound(e, "ambient", 1, 0.7); } },
  charge: { min: 5, max: 16, cd: 8, wind: 12, tele: (e, t, c) => burst(c, e.location, { col: "dust", n: 8, up: 0.5, spd: 1 }),
    run(e, t, c) { dashTo(e, t, 2.2, 0.2); sound(e, "attack", 1.1); for (let i = 1; i <= 6; i++) after(i * 3, () => { if (isValid(e) && isValid(t) && dist(e.location, t.location) < 2.6) { hurtP(t, e, H(e, 0.9)); push(t, e.location, 1.2, 0.4); } }); } },
  roar: { act: "roar", min: 0, max: 10, cd: 14, wind: 14, tele: (e, t, c) => implode(c, eye(e), { col: "white", n: 8, radius: 2 }),
    run(e, t, c) { ringFlat(c, e.location, { col: "white", n: 24, radius: 9, life: 0.7, tile: T.ring }); for (const pl of near(e, e.location, 9)) { eff(pl, "weakness", 6, 1); push(pl, e.location, 0.7, 0.2); } sound(e, "ambient", 1.4, 0.9); } },
  stampede: { min: 6, max: 18, cd: 11, wind: 16, tele: (e, t, c) => ringFlat(c, e.location, { col: "earth", n: 14, radius: 2.5 }),
    run(e, t, c) { dashTo(e, t, 2.6, 0.2); sound(e, "attack", 1.3, 0.8); for (let i = 1; i <= 8; i++) after(i * 3, () => { if (!isValid(e)) return; burst(c, e.location, { col: "dust", n: 5, up: 1 }); for (const pl of near(e, e.location, 2.8)) { hurtP(pl, e, H(e, 0.5)); push(pl, e.location, 1.0, 0.4); } }); } },
  halberd_sweep: { min: 0, max: 5, cd: 5, wind: 8, tele: (e, t, c) => burst(c, eye(e), { col: "steel", n: 6, spd: 1.5 }),
    run(e, t, c) { const d = flat(e.location, t.location); fan(c, eye(e), d, { col: "steel", n: 18, spd: 6, life: 0.3, angle: 150, tile: T.line });
      for (const pl of near(e, e.location, 5)) { hurtP(pl, e, H(e, 0.8)); push(pl, e.location, 0.9, 0.3); } sound(e, "attack", 1, 1.1); } },
  holy_ray: { min: 3, max: 18, cd: 8, wind: 18, tele: (e, t, c) => { column(c, t.location, { col: "holy", n: 8, h: 4, tile: T.star }); ringFlat(c, t.location, { col: "gold", n: 12, radius: 1.5 }); },
    run(e, t, c) { column(c, t.location, { col: "light", n: 24, h: 8, r: 0.5 }); burst(c, t.location, { col: "gold", n: 16, up: 2 }); for (const pl of near(e, t.location, 2.5)) { hurtP(pl, e, H(e, 1.0)); eff(pl, "blindness", 2, 0); } sound(e, "attack", 1.1, 1.2); } },
  blood_bind: { min: 3, max: 14, cd: 12, wind: 12, tele: (e, t, c) => implode(c, t.location, { col: "blood", n: 10, radius: 2 }),
    run(e, t, c) { burst(c, t.location, { col: "blood", n: 14, up: 1 }); eff(t, "slowness", 5, 3); eff(t, "weakness", 5, 1); hurtP(t, e, H(e, 0.5)); try { e.addEffect("regeneration", 60, { amplifier: 1 }); } catch { /* ignore */ } sound(e, "attack"); } },
  gravity: { min: 3, max: 14, cd: 10, wind: 14, tele: (e, t, c) => implode(c, e.location, { col: "void", n: 14, radius: 5 }),
    run(e, t, c) { ringFlat(c, e.location, { col: "void", n: 20, radius: 8, life: 0.6 }); for (const pl of near(e, e.location, 10)) { push(pl, e.location, 1.4, 0.25, true); hurtP(pl, e, H(e, 0.35)); } sound(e, "attack", 1, 0.8); } },
  fire_wave: { act: "ability", min: 0, max: 7, cd: 8, wind: 12, tele: (e, t, c) => ringFlat(c, e.location, { col: "ember", n: 12, radius: 2 }),
    run(e, t, c) { ringFlat(c, e.location, { col: "fire", n: 30, radius: 6.5, life: 0.6, tile: T.flame }); for (const pl of near(e, e.location, 6.5)) { hurtP(pl, e, H(e, 0.8)); try { pl.setOnFire(4, true); } catch { /* ignore */ } } sound(e, "attack", 1.1); } },
  chain_bolt: { min: 3, max: 16, cd: 6, wind: 10, tele: (e, t, c) => burst(c, eye(e), { col: "bolt", n: 8, spd: 2 }),
    run(e, t, c) { bolt(c, eye(e), eye(t), { col: "bolt", w: 0.18 }); hurtP(t, e, H(e, 0.9)); for (const pl of near(t, t.location, 5)) if (pl.id !== t.id) { bolt(c, eye(t), eye(pl), { col: "bolt" }); hurtP(pl, e, H(e, 0.5)); } sound(e, "attack", 1.1, 1.3); } },
  storm: { act: "ability", min: 4, max: 22, cd: 9, wind: 20, tele: (e, t, c) => { column(c, t.location, { col: "bolt", n: 10, h: 6 }); ringFlat(c, t.location, { col: "violet", n: 14, radius: 3 }); },
    run(e, t, c) { for (let i = 0; i < 4; i++) after(i * 4, () => { if (!isValid(e)) return; const p = { x: t.location.x + rand(-4, 4), y: t.location.y, z: t.location.z + rand(-4, 4) }; bolt(c, { x: p.x, y: p.y + 14, z: p.z }, p, { col: "bolt", w: 0.3, jitter: 1 }); burst(c, p, { col: "violet", n: 10, up: 1 });
        try { for (const pl of e.dimension.getPlayers({ location: p, maxDistance: 3.5 })) { hurtP(pl, e, H(e, 0.6)); push(pl, p, 0.8, 0.4); } } catch { /* ignore */ } }); sound(e, "attack", 1.5, 0.8); } },
  gale: { min: 3, max: 12, cd: 7, wind: 10, tele: (e, t, c) => burst(c, e.location, { col: "wind", n: 8, spd: 1.5 }),
    run(e, t, c) { const d = flat(e.location, t.location); fan(c, eye(e), d, { col: "wind", n: 24, spd: 8, life: 0.5, angle: 50, tile: T.arc }); for (const pl of near(e, e.location, 10)) { const v = flat(e.location, pl.location); if (v.x * d.x + v.z * d.z > 0.6) { push(pl, e.location, 1.6, 0.4); hurtP(pl, e, H(e, 0.5)); } } sound(e, "attack", 1, 1.2); } },
  shadow_bind: { min: 2, max: 14, cd: 10, wind: 10, tele: (e, t, c) => implode(c, t.location, { col: "shadow", n: 10, radius: 2 }),
    run(e, t, c) { burst(c, t.location, { col: "black", n: 14, up: 1 }); eff(t, "slowness", 4, 2); eff(t, "blindness", 3, 0); hurtP(t, e, H(e, 0.5)); sound(e, "attack", 1, 0.9); } },
  arcane_burst: { min: 3, max: 16, cd: 6, wind: 10, tele: (e, t, c) => burst(c, eye(e), { col: "arcane", n: 8, spd: 1.4 }),
    run(e, t, c) { streak(c, eye(e), eye(t), { col: "arcane", w: 0.2, life: 0.3 }); burst(c, eye(t), { col: "violet", n: 12, spd: 2 }); hurtP(t, e, H(e, 0.8)); sound(e, "attack", 1, 1.2); } },
  leap: { min: 3, max: 10, cd: 6, wind: 6, tele: (e, t, c) => burst(c, e.location, { col: "dust", n: 4, up: 1 }), run(e, t, c) { dashTo(e, t, 1.4, 0.4); sound(e, "attack"); } },
  heal_self: { min: 0, max: 30, cd: 30, wind: 8, cond: (e) => { try { const h = e.getComponent("minecraft:health"); return h.currentValue < h.effectiveMax * 0.35; } catch { return false; } },
    tele: () => {}, run(e, t, c) { eff(e, "regeneration", 6, 3); burst(c, eye(e), { col: "green", n: 14, spd: 1.5, up: 1 }); sound(e, "ambient", 1, 1.3); } },
  // ---- Dragões Verdadeiros (forma dragão): cada golpe tem animação própria (act) ----
  bite: { act: "bite", min: 0, max: 7, cd: 4, wind: 9, tele: (e, t, c) => burst(c, eye(e), { col: "white", n: 5, spd: 1 }),
    run(e, t, c) { const d = flat(e.location, t.location); for (const pl of near(e, e.location, 8)) { const v = flat(e.location, pl.location); if (v.x * d.x + v.z * d.z > 0.4) { hurtP(pl, e, H(e, 1.1)); eff(pl, "weakness", 3, 0); push(pl, e.location, 0.7, 0.25); } } sound(e, "attack", 1.2, 0.8); } },
  claw: { act: "claw", min: 0, max: 7, cd: 5, wind: 8, tele: (e, t, c) => burst(c, eye(e), { col: "steel", n: 5, spd: 1.2 }),
    run(e, t, c) { const d = flat(e.location, t.location); fan(c, eye(e), d, { col: "steel", n: 14, spd: 6, life: 0.3, angle: 110, tile: T.line });
      for (const pl of near(e, e.location, 7)) { const v = flat(e.location, pl.location); if (v.x * d.x + v.z * d.z > 0.2) { hurtP(pl, e, H(e, 0.85)); push(pl, e.location, 1.0, 0.3); } } sound(e, "attack", 1.1, 0.9); } },
  tail_sweep: { act: "tail", min: 0, max: 10, cd: 8, wind: 12, tele: (e, t, c) => ringFlat(c, e.location, { col: "dust", n: 14, radius: 3 }),
    run(e, t, c) { ringFlat(c, e.location, { col: "earth", n: 30, radius: 9, life: 0.5 }); for (const pl of near(e, e.location, 9)) { hurtP(pl, e, H(e, 0.7)); push(pl, e.location, 1.6, 0.45); } sound(e, "attack", 1.3, 0.7); } },
  ice_breath: { act: "ability", min: 4, max: 18, cd: 9, wind: 16, tele: (e, t, c) => implode(c, eye(e), { col: "frost", n: 12, radius: 2 }),
    run(e, t, c) { const d = flat(e.location, t.location); fan(c, eye(e), d, { col: "ice", n: 30, spd: 9, life: 0.7, angle: 36, tile: T.shard });
      for (const pl of near(e, e.location, 16)) { const v = flat(e.location, pl.location); if (v.x * d.x + v.z * d.z > 0.8) { hurtP(pl, e, H(e, 0.9)); eff(pl, "slowness", 5, 2); eff(pl, "mining_fatigue", 4, 1); } } sound(e, "attack", 1.3, 1.1); } },
  dragon_flight: { act: "takeoff", min: 6, max: 26, cd: 14, wind: 18, tele: (e, t, c) => ringFlat(c, e.location, { col: "dust", n: 14, radius: 4 }),
    run(e, t, c) { eff(e, "slow_falling", 80, 0); dashTo(e, t, 2.0, 1.1); sound(e, "ambient", 1.2, 1.1);
      after(30, () => { if (!isValid(e)) return; setAct(e, "land", 20); ringFlat(c, e.location, { col: "earth", n: 28, radius: 7, life: 0.6 }); burst(c, e.location, { col: "dust", n: 16, up: 2 });
        for (const pl of near(e, e.location, 7)) { hurtP(pl, e, H(e, 0.8)); push(pl, e.location, 1.5, 0.5); } sound(e, "attack", 1.3, 0.7); }); } },
};
// papéis -> habilidades (ordem = prioridade)
const ROLES = {
  spider: ["web_shot", "pounce"], dragon: ["breath", "slam", "roar"], storm: ["storm", "roar", "breath", "heal_self"], rush: ["leap", "slam"], brute: ["slam", "charge"],
  slime: ["tide", "water_blade", "heal_self"], undead: ["wail", "dark_bolt"], demon: ["dark_bolt", "blink", "fire_wave"], golem: ["quake", "iron_skin", "charge"],
  beast: ["charge", "roar", "pounce"], beast_king: ["stampede", "halberd_sweep", "roar", "charge", "heal_self"], holy: ["holy_ray", "blood_bind"], void: ["gravity", "blink", "dark_bolt"],
  flame: ["fire_wave", "breath", "blink"], bolt: ["chain_bolt", "storm", "blink"], shadow: ["shadow_bind", "blink", "dark_bolt"], arcane: ["arcane_burst", "blink", "gravity"],
  wind: ["gale", "blink", "leap"], frost: ["arcane_burst", "tide"],
};
const BY_ID = { tt_hinata: ["holy_ray", "blink", "leap", "slam", "heal_self"], tt_shizue: ["fire_wave", "breath", "blink", "heal_self"], tt_shizue_ifrit: ["fire_wave", "breath", "slam", "heal_self"], tt_charybdis: ["tide", "slam", "water_blade", "roar"], tt_orc_disaster: ["slam", "charge", "roar", "quake"], luminous_valentine: ["holy_ray", "blood_bind", "blink", "heal_self"], rimuru_ogre_fight: ["water_blade", "tide", "blink", "heal_self"], beretta: ["quake", "iron_skin", "charge", "heal_self"],
  rain: ["tide", "water_blade", "arcane_burst", "blink", "heal_self"], milim_nava: ["breath", "slam", "charge", "fire_wave", "roar", "heal_self"], guy_crimson: ["shadow_bind", "fire_wave", "blink", "gravity", "heal_self"],
  feldway: ["holy_ray", "blink", "gravity", "dark_bolt", "heal_self"], garasha: ["charge", "slam", "blink", "holy_ray", "heal_self"],
  diablo: ["shadow_bind", "blink", "dark_bolt", "gravity", "heal_self"], testarossa: ["fire_wave", "blink", "breath", "heal_self"], ultima: ["arcane_burst", "gravity", "blink", "heal_self"],
  carrera: ["gale", "blink", "leap", "heal_self"], rimuru_senhor_demonio: ["tide", "water_blade", "gravity", "blink", "heal_self"], benimaru: ["fire_wave", "blink", "slam"], shion: ["slam", "charge", "heal_self"],
  carrion_royal_beast: ["stampede", "pounce", "roar", "halberd_sweep", "heal_self"], veldora: ["storm", "roar", "breath", "slam", "heal_self"] };
const DRAGON_A = {
  veldanava: ["bite", "claw", "tail_sweep", "storm", "breath", "ice_breath", "roar", "dragon_flight", "heal_self"],
  veldora: ["bite", "claw", "tail_sweep", "storm", "breath", "roar", "dragon_flight", "heal_self"],
  velzard: ["bite", "claw", "tail_sweep", "ice_breath", "roar", "dragon_flight", "heal_self"],
  velgrynd: ["bite", "claw", "tail_sweep", "breath", "fire_wave", "roar", "dragon_flight", "heal_self"],
};
const HUMAN_A = { veldanava: ["chain_bolt", "arcane_burst", "blink", "leap"], veldora: ["chain_bolt", "blink", "leap"], velzard: ["arcane_burst", "blink", "leap"], velgrynd: ["fire_wave", "blink", "leap"] };
const baseAbilities = (e) => {
  const id = e.typeId.slice(8);
  if (e.typeId === CHR) return chronoAbilities(e);
  if (FORMS[e.typeId]) { const f = formOf(e); return (f === "dragon" ? DRAGON_A : HUMAN_A)[id] ?? BY_ID[id]; }
  return BY_ID[id] ?? ROLES[MOBS[e.typeId]?.role] ?? ROLES.rush;
};
// bosses com perfil (data/bossprofiles.js): a lista vem da fase atual + evolução; os demais seguem a lista base
const abilitiesOf = (e) => { const base = baseAbilities(e); return e.typeId === CHR || !profileOf(e) ? base : bossAbilities(e, base); };
const GCD = { common: 6, uncommon: 5, rare: 4, legendary: 3.2, special: 2.6, boss: 1.5 };   // 6.23: chefes agem bem mais rápido (era 2,2 s) // intervalo mínimo entre ações (s) — raros agem mais

function think(e, tick) {
  const m = MOBS[e.typeId]; if (!m || e.hasTag("etheria_ally") || e.hasTag("etheria_oct_idle") || e.hasTag("etheria_minion") || e.hasTag("tdr_busy") || e.hasTag("chr_busy")) return;
  let s = st.get(e.id); if (!s) { s = { gcd: tick + 20 + Math.floor(rand(0, 40)), cds: {}, busy: false }; st.set(e.id, s); }
  if (s.busy || tick < s.gcd) return;
  const boss = m.rar === "boss" || e.hasTag("etheria_fight");
  let t, td = 1e9, best = 1e9;
  // 6.23: chefes ponderam a distância pela vida do jogador (os mais feridos viram alvo) e enxergam mais longe (32 blocos)
  for (const pl of near(e, e.location, boss ? 32 : 20)) {
    if (pl.getGameMode?.() === "creative" || pl.getGameMode?.() === "spectator") continue;
    const d = dist(pl.location, e.location); let score = d;
    if (boss) { try { const h = pl.getComponent("minecraft:health"); score = d * (0.75 + 0.25 * (h.currentValue / h.effectiveMax)); } catch { /* ignore */ } }
    if (score < best) { best = score; td = d; t = pl; }
  }
  if (!t) return;
  // 6.28 anti-travamento (chefes): sem agir e sem se mover por >= 6 s com um alvo a mais de 4 blocos (parede/estrutura/buraco) -> pequeno salto de correção na direção do alvo, no máx. 1x a cada 10 s
  if (boss) {
    const p = e.location;
    if (!s.last || dist(p, s.last) > 0.6) { s.last = { x: p.x, y: p.y, z: p.z }; s.lastAt = tick; }
    else if (td > 4 && tick - s.lastAt >= 120 && tick - (s.used ?? 0) >= 120 && tick >= (s.unstuckAt ?? 0)) {
      s.unstuckAt = tick + 200; s.lastAt = tick;
      try {
        const d = flat(p, t.location), dim = e.dimension, free = (x, y, z) => { try { return !!dim.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) })?.isAir && !!dim.getBlock({ x: Math.floor(x), y: Math.floor(y) + 1, z: Math.floor(z) })?.isAir; } catch { return false; } };
        const spots = [[2.5, 0.3], [2.5, 1.6], [5, 0.3], [5, 2], [0, 2.2]], at = spots.map(([k, up]) => ({ x: p.x + d.x * k, y: p.y + up, z: p.z + d.z * k })).find((q) => free(q.x, q.y, q.z));
        if (at) { e.teleport(at, { dimension: dim }); s.unstuck = (s.unstuck ?? 0) + 1; }
      } catch { /* ignore */ }
    }
  }
  const c = ctx(t, 1);
  for (const id of abilitiesOf(e)) {
    const a = A[id] ?? CHR_A[id] ?? BA[id]; if (!a || td < a.min || td > a.max || tick < (s.cds[id] ?? 0)) continue;
    if (a.cond && !a.cond(e)) continue;
    if (!a.cond && Math.random() > (boss ? 0.85 : 0.55)) continue; // variação: nem sempre usa a primeira opção disponível (chefes quase sempre agem)
    s.busy = true; s.used = tick; s.cds[id] = tick + a.cd * 20; s.gcd = tick + ((GCD[m.rar] ?? 5) * 20 + Math.floor(rand(0, 30))) * (e.hasTag("chr_accel") ? 0.45 : 1) * gcdMul(e);
    if (a.act && FORMS[e.typeId]) setAct(e, formOf(e) === "dragon" ? a.act : "cast", a.wind + 14);
    else if (a.act && e.typeId === CHR) setAct(e, a.act, a.wind + 16);
    else playBossAnim(e, kindFor(id), a.wind + 10);   // 6.37: animação de combate do chefe, sincronizada com a preparação
    try { a.tele(e, t, c); } catch { /* ignore */ }
    after(a.wind, () => { s.busy = false; try { if (isValid(e) && isValid(t)) a.run(e, t, ctx(t, 1)); } catch { /* ignore */ } });
    return;
  }
  // 6.23 anti-"kiting"/"pilar": o chefe não achou golpe utilizável e o alvo está longe ou muito acima/abaixo -> fecha a distância (investida ou teleporte curto), no máx. 1x a cada 8 s
  if (boss && tick >= (s.closeAt ?? 0) && (td > 12 || Math.abs(t.location.y - e.location.y) > 4)) {
    s.closeAt = tick + 160; s.gcd = tick + 30;
    try {
      const far = td > 26 || Math.abs(t.location.y - e.location.y) > 5, c2 = ctx(t, 1);
      if (far) { burst(c2, e.location, { col: "void", n: 10, up: 1 }); const d = flat(e.location, t.location); e.teleport({ x: t.location.x - d.x * 4, y: t.location.y, z: t.location.z - d.z * 4 }, { dimension: t.dimension }); burst(c2, e.location, { col: "void", n: 12, up: 1 }); }
      else dashTo(e, t, 2.0, 0.25);
    } catch { /* ignore */ }
  }
}

/** a habilidade existe em alguma tabela? (testes de consistência dos perfis de boss) */
export const abilityExists = (id) => !!(A[id] ?? CHR_A[id] ?? BA[id]);
export function startMobAI() {
  system.runInterval(() => {
    const tick = system.currentTick;
    for (const pl of world.getAllPlayers()) {
      let es; try { es = pl.dimension.getEntities({ location: pl.location, maxDistance: RANGE, families: ["monster"] }); } catch { continue; }
      let n = 0; es.sort((a, b) => (b.hasTag("etheria_fight") ? 1 : 0) - (a.hasTag("etheria_fight") ? 1 : 0));   // chefes primeiro: súditos nunca tiram a vez deles
      for (const e of es) { if (!e.typeId.startsWith("etheria:") || !MOBS[e.typeId]) continue; if (++n > MAX_PER_PLAYER) break; try { think(e, tick); } catch (er) { console.warn(`[Etheria] mobai ${e.typeId}: ${er}`); } }
    }
    if (tick % 600 < STEP) for (const id of st.keys()) { try { if (!world.getEntity(id)) st.delete(id); } catch { st.delete(id); } } // evita vazamento
  }, STEP);
}

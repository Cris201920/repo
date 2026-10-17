// systems/bossabilities.js - HABILIDADES EXCLUSIVAS dos bosses (golpes telegrafados, zonas, puxões, investidas, invocações, escudos, drenos).
// Mesmo formato de mobai.js (A): { act?, min, max, cd (s), wind (ticks de preparação), cond?, tele(e,t,c), run(e,t,c) }.
// Todo golpe forte telegrafa a área antes de acertar (dá tempo de desviar) e tem recarga; dano = dano base x fase x evolução x fator.
// Limites: no máx. 4 zonas persistentes no mundo; invocações limitadas por chefe (bossfight.spawnMinions); partículas pelo orçamento do fxlib.
import { system } from "@minecraft/server";
import { MOBS } from "../data/mobs.gen.js";
import { isValid, rand, norm, healthComp, heal, dist } from "../core/utils.js";
import { burst, ringFlat, column, bolt, fan, implode, streak, after, ctx, T } from "./fxlib.js";
import { sealPlayer, strip, openField, CLASS } from "./antiskill.js";
import { dmgMul, phaseData, profileOf, spawnMinions, minionsOf, stateOf, feed } from "./bossfight.js";

const D = (e, p) => (MOBS[e.typeId]?.dmg ?? 20) * dmgMul(e) * p;
const near = (e, pos, r) => { try { return e.dimension.getPlayers({ location: pos, maxDistance: r }).filter((p) => { const g = p.getGameMode?.(); return g !== "creative" && g !== "spectator"; }); } catch { return []; } };
const hurt = (pl, e, amt) => { try { pl.applyDamage(amt, { cause: "entityAttack", damagingEntity: isValid(e) ? e : undefined }); } catch { /* ignore */ } };
const eff = (en, id, sec, amp = 0) => { try { en.addEffect(id, Math.round(sec * 20), { amplifier: amp, showParticles: true }); } catch { /* ignore */ } };
const push = (pl, from, s, up = 0.3, inward = false) => { try { let dx = pl.location.x - from.x, dz = pl.location.z - from.z; if (inward) { dx = -dx; dz = -dz; } const l = Math.hypot(dx, dz) || 1; pl.applyKnockback(dx / l, dz / l, s, up); } catch { /* ignore */ } };
const eye = (e) => ({ x: e.location.x, y: e.location.y + 1.4, z: e.location.z });
const flat = (a, b) => norm({ x: b.x - a.x, y: 0, z: b.z - a.z });
const dashTo = (e, t, s = 1.4, up = 0.25) => { try { const d = flat(e.location, t.location); e.applyKnockback(d.x, d.z, s, up); } catch { /* ignore */ } };
const behind = (e, t, k = 1.6) => { try { const d = flat(e.location, t.location); e.teleport({ x: t.location.x + d.x * k, y: t.location.y, z: t.location.z + d.z * k }, { dimension: t.dimension }); } catch { /* ignore */ } };
const sound = (e, kind, vol = 1, pitch = 1) => { const id = `etheria.mob.${e.typeId.slice(8)}_${kind}`; try { for (const q of e.dimension.getPlayers({ location: e.location, maxDistance: 32 })) q.playSound(id, { location: e.location, volume: vol, pitch }); } catch { /* ignore */ } };
const ratio = (e) => { const h = healthComp(e); return h ? h.currentValue / h.effectiveMax : 1; };
const maxHp = (e) => healthComp(e)?.effectiveMax ?? 0;
const here = (en) => ({ x: en.location.x, y: en.location.y, z: en.location.z });
const canSummon = (e) => { const p = profileOf(e), ph = phaseData(e); return !!(p?.minion && ph?.minions && minionsOf(e).length < ph.minions.cap); };
const doSummon = (e) => { const p = profileOf(e), ph = phaseData(e); return p?.minion && ph?.minions ? spawnMinions(e, p.minion, ph.minions.n, ph.minions.cap) : 0; };

// ---- pontos de impacto telegrafados: tele() marca, run() acerta (quem saiu da área não leva dano)
const pend = new Map();
function pickPoints(t, n, spread) { const out = [here(t)]; for (let i = 1; i < n; i++) out.push({ x: t.location.x + rand(-spread, spread), y: t.location.y, z: t.location.z + rand(-spread, spread) }); return out; }
function markPoints(e, c, pts, o) { pend.set(e.id, pts); for (const p of pts) { ringFlat(c, p, { col: o.col, n: 12, radius: o.radius, life: (o.wind ?? 20) / 20 }); column(c, p, { col: o.col, n: 4, h: 2, tile: T.star }); } }
function strike(e, c, o) {
  const pts = pend.get(e.id) ?? []; pend.delete(e.id);
  pts.forEach((p, i) => after(1 + i * (o.stagger ?? 3), () => {
    if (!isValid(e)) return;
    if (o.bolt) bolt(c, { x: p.x, y: p.y + 14, z: p.z }, p, { col: o.col, w: 0.3, jitter: 1 }); else column(c, p, { col: o.col, n: 22, h: o.h ?? 8, r: Math.min(1, o.radius / 3) });
    burst(c, p, { col: o.col2 ?? o.col, n: 10, up: 1.6, spd: 1.4 }); ringFlat(c, p, { col: o.col, n: 16, radius: o.radius, life: 0.4 });
    for (const pl of near(e, p, o.radius)) { hurt(pl, e, D(e, o.dmg)); if (o.knock) push(pl, p, o.knock, 0.45); if (o.fire) { try { pl.setOnFire(o.fire, true); } catch { /* ignore */ } } for (const [id, s, a] of o.eff ?? []) eff(pl, id, s, a); }
    sound(e, "attack", 0.9, o.pitch ?? 1);
  }));
}
const STRIKE = (o) => ({ act: o.act, min: o.min ?? 0, max: o.max ?? 20, cd: o.cd, wind: o.wind,
  tele(e, t, c) { markPoints(e, c, o.self ? [here(e)] : pickPoints(t, o.n ?? 1, o.spread ?? 4), o); },
  run(e, t, c) { strike(e, c, o); } });

// ---- zonas persistentes (máx. 4 no mundo)
const zones = new Set();
export const zoneCount = () => zones.size;
function zone(e, pos, r, secs, col, fn) {
  if (zones.size >= 4) return false;
  const z = {}; zones.add(z); let t = 0; const c = ctx(undefined, 1, e.dimension);
  const h = system.runInterval(() => {
    t += 10; if (t > secs * 20 || !isValid(e)) { system.clearRun(h); zones.delete(z); return; }
    ringFlat(c, pos, { col, n: 10, radius: r, life: 0.6 }); burst(c, pos, { col, n: 2, up: 0.6, spd: 0.6 });
    for (const pl of near(e, pos, r)) fn(pl);
  }, 10);
  return true;
}
// ---- puxões em pulsos
function pulls(e, c, o) {
  for (let i = 0; i < o.pulses; i++) after(1 + i * 10, () => {
    if (!isValid(e)) return; const at = here(e);
    ringFlat(c, at, { col: o.col, n: 18, radius: o.radius * (1 - i / (o.pulses * 1.6)), life: 0.5 }); implode(c, at, { col: o.col, n: 10, radius: o.radius });
    for (const pl of near(e, at, o.radius)) { push(pl, at, o.pull, 0.2, true); hurt(pl, e, D(e, o.dmg)); if (i === 0) for (const [id, s, a] of o.eff ?? []) eff(pl, id, s, a); }
  });
  sound(e, "attack", 1.1, 0.8);
}
// ---- investidas encadeadas
function dashes(e, t, c, o) {
  for (let i = 0; i < o.n; i++) after(1 + i * o.gap, () => {
    if (!isValid(e) || !isValid(t)) return;
    if (o.blink) behind(e, t, 1.8); else dashTo(e, t, o.power, 0.2);
    burst(c, e.location, { col: o.col, n: 8, up: 1 }); sound(e, "attack", 1, 1 + i * 0.1);
    after(o.hitAt ?? 4, () => { if (isValid(e) && isValid(t) && dist(e.location, t.location) < (o.reach ?? 3.2)) { hurt(t, e, D(e, o.dmg)); push(t, e.location, o.knock ?? 0.8, 0.35); if (o.spin) ringFlat(c, e.location, { col: o.col, n: 14, radius: 3, life: 0.3 }); } });
  });
}
function lineHit(e, from, dir, len, w, dmg, c, col, fire) {
  for (let k = 1; k <= 6; k++) streak(c, from, { x: from.x + dir.x * len * k / 6, y: from.y, z: from.z + dir.z * len * k / 6 }, { col, w: 0.25, life: 0.3 });
  for (const pl of near(e, from, len + 2)) {
    const v = { x: pl.location.x - from.x, z: pl.location.z - from.z }, along = v.x * dir.x + v.z * dir.z, side = Math.abs(v.x * dir.z - v.z * dir.x);
    if (along > 0 && along < len && side < w) { hurt(pl, e, dmg); push(pl, from, 0.7, 0.3); if (fire) { try { pl.setOnFire(fire, true); } catch { /* ignore */ } } }
  }
}
const marks = new Map();   // playerId -> até (tick): "Marca do Pecador"
export const isMarked = (pl) => (marks.get(pl.id) ?? 0) > system.currentTick;

export const BA = {
  // ------------------------------------------------------------ Orc do Desastre
  summon_minions: { min: 0, max: 28, cd: 15, wind: 16, cond: canSummon,
    tele: (e, t, c) => { implode(c, eye(e), { col: "blood", n: 12, radius: 2.4 }); ringFlat(c, e.location, { col: "fire", n: 14, radius: 3 }); },
    run(e, t, c) { const n = doSummon(e); ringFlat(c, e.location, { col: "fire", n: 22, radius: 5, life: 0.6 }); burst(c, eye(e), { col: "blood", n: 14, spd: 2 }); sound(e, "ambient", 1.4, 0.7); for (const p of near(e, e.location, 40)) { try { p.sendMessage(`§2§o O chefe urra e ${n} súdito(s) atendem ao chamado!`); } catch { /* ignore */ } } } },
  devour_minion: { min: 0, max: 30, cd: 22, wind: 14, cond: (e) => ratio(e) < 0.6 && minionsOf(e).length > 0 && !!stateOf(e),
    tele: (e, t, c) => implode(c, eye(e), { col: "blood", n: 12, radius: 2.2 }),
    run(e, t, c) { const m = minionsOf(e)[0], b = stateOf(e); if (!m || !b) return; try { streak(c, m.location, eye(e), { col: "blood", w: 0.3, life: 0.4 }); m.remove(); } catch { /* ignore */ } heal(e, maxHp(e) * 0.05); feed(b, 25, "um dos seus súditos"); sound(e, "ambient", 1.2, 0.6); } },
  war_stomp: { min: 0, max: 6, cd: 9, wind: 14, tele: (e, t, c) => ringFlat(c, e.location, { col: "dust", n: 14, radius: 2.5 }),
    run(e, t, c) { ringFlat(c, e.location, { col: "earth", n: 28, radius: 6, life: 0.5 }); burst(c, e.location, { col: "dust", n: 14, up: 1.5 });
      for (const pl of near(e, e.location, 6)) { hurt(pl, e, D(e, 0.7)); push(pl, e.location, 1.2, 0.45); eff(pl, "slowness", 3, 1); }
      for (const m of minionsOf(e)) eff(m, "speed", 6, 1); sound(e, "attack", 1.3, 0.7); } },
  ground_pound: { min: 3, max: 14, cd: 12, wind: 12, tele: (e, t, c) => ringFlat(c, t.location, { col: "dust", n: 12, radius: 3 }),
    run(e, t, c) { try { const d = flat(e.location, t.location); e.applyKnockback(d.x, d.z, 1.1, 0.95); } catch { /* ignore */ }
      after(14, () => { if (!isValid(e)) return; ringFlat(c, e.location, { col: "earth", n: 30, radius: 7, life: 0.6 }); burst(c, e.location, { col: "dust", n: 18, up: 2 });
        for (const pl of near(e, e.location, 7)) { hurt(pl, e, D(e, 0.95)); push(pl, e.location, 1.5, 0.6); } sound(e, "attack", 1.4, 0.6); }); } },
  rampage: { min: 3, max: 16, cd: 16, wind: 14, tele: (e, t, c) => burst(c, e.location, { col: "fire", n: 12, up: 1, spd: 1.4 }),
    run(e, t, c) { dashes(e, t, c, { n: 3, gap: 14, power: 1.9, dmg: 0.75, col: "fire", knock: 1.0 }); } },
  calamity: { min: 0, max: 18, cd: 28, wind: 42, tele: (e, t, c) => { pend.set(e.id, [here(t)]); ringFlat(c, t.location, { col: "fire", n: 22, radius: 7, life: 2 }); column(c, t.location, { col: "blood", n: 8, h: 3 }); },
    run(e, t, c) { strike(e, c, { col: "fire", col2: "blood", radius: 7, dmg: 1.7, knock: 1.8, fire: 4, h: 10, pitch: 0.6 }); } },
  // ------------------------------------------------------------ Charybdis
  maelstrom: { min: 0, max: 14, cd: 13, wind: 16, tele: (e, t, c) => implode(c, e.location, { col: "water", n: 16, radius: 6 }), run(e, t, c) { pulls(e, c, { col: "water", radius: 11, pulses: 4, pull: 0.8, dmg: 0.22, eff: [["slowness", 3, 1]] }); } },
  tsunami: { min: 0, max: 16, cd: 15, wind: 20, tele: (e, t, c) => fan(c, eye(e), flat(e.location, t.location), { col: "water", n: 14, spd: 4, life: 0.5, angle: 60, tile: T.bubble }),
    run(e, t, c) { const d = flat(e.location, t.location); fan(c, eye(e), d, { col: "foam", n: 36, spd: 10, life: 0.8, angle: 70, tile: T.bubble }); for (const pl of near(e, e.location, 15)) { const v = flat(e.location, pl.location); if (v.x * d.x + v.z * d.z > 0.6) { hurt(pl, e, D(e, 0.9)); push(pl, e.location, 2, 0.5); eff(pl, "slowness", 4, 2); } } sound(e, "attack", 1.3, 0.8); } },
  // ------------------------------------------------------------ Guy Crimson
  crimson_domain: { min: 0, max: 16, cd: 20, wind: 18, tele: (e, t, c) => ringFlat(c, e.location, { col: "blood", n: 18, radius: 9, life: 0.9 }),
    run(e, t, c) { zone(e, here(e), 9, 6, "blood", (pl) => { eff(pl, "slowness", 2, 0); eff(pl, "weakness", 2, 0); hurt(pl, e, D(e, 0.1)); heal(e, maxHp(e) * 0.004); }); sound(e, "ambient", 1.3, 0.7); } },
  overlord_aura: { min: 0, max: 14, cd: 24, wind: 24, tele: (e, t, c) => implode(c, eye(e), { col: "shadow", n: 18, radius: 4 }),
    run(e, t, c) { ringFlat(c, e.location, { col: "blood", n: 30, radius: 12, life: 0.8 }); for (const pl of near(e, e.location, 12)) { hurt(pl, e, D(e, 0.3)); eff(pl, "slowness", 2, 4); eff(pl, "weakness", 6, 1); } sound(e, "ambient", 1.5, 0.6); } },
  crimson_nova: STRIKE({ cd: 17, wind: 44, max: 22, self: true, radius: 9, dmg: 1.9, knock: 2.2, col: "blood", col2: "ember", h: 12, pitch: 0.6, eff: [["weakness", 6, 1]] }),   // 6.23: energia VERMELHA (identidade do Guy)
  red_rain: STRIKE({ cd: 14, wind: 26, max: 24, n: 6, spread: 7, radius: 3, dmg: 1.0, knock: 1.0, col: "blood", col2: "fire", bolt: true, stagger: 3, h: 10 }),
  // ------------------------------------------------------------ Milim
  dragon_nuke: STRIKE({ cd: 20, wind: 50, max: 26, radius: 9, dmg: 2.1, knock: 2.2, col: "pink", col2: "white", fire: 3, h: 14, pitch: 0.7 }),   // 6.23: energia ROSA (identidade da Milim)
  pink_barrage: STRIKE({ cd: 13, wind: 24, max: 22, n: 5, spread: 6, radius: 3, dmg: 1.0, knock: 1.2, col: "pink", col2: "white", h: 9, pitch: 1.2, stagger: 3 }),
  dash_barrage: { min: 3, max: 16, cd: 10, wind: 8, tele: (e, t, c) => burst(c, e.location, { col: "pink", n: 10, up: 1 }), run(e, t, c) { dashes(e, t, c, { n: 4, gap: 9, power: 2.2, dmg: 0.7, col: "pink", spin: true }); } },
  // ------------------------------------------------------------ Rimuru (forma final, 6.24)
  predator_maw: { min: 0, max: 18, cd: 17, wind: 30, tele: (e, t, c) => { implode(c, eye(e), { col: "shadow", n: 20, radius: 8 }); ringFlat(c, e.location, { col: "sage", n: 20, radius: 12, life: 0.9 }); },
    run(e, t, c) {
      pulls(e, c, { col: "shadow", radius: 14, pulses: 4, pull: 1.0, dmg: 0.4, eff: [["slowness", 3, 2]] });
      after(42, () => { if (!isValid(e)) return; const hit = near(e, here(e), 5); for (const pl of hit) hurt(pl, e, D(e, 0.9)); if (hit.length) heal(e, maxHp(e) * 0.012 * hit.length); burst(c, eye(e), { col: "sage", n: 22, spd: 2.4, up: 1 }); });
    } },
  megiddo: STRIKE({ cd: 16, wind: 40, max: 26, n: 3, spread: 6, radius: 5, dmg: 1.5, knock: 1.6, col: "sage", col2: "white", bolt: true, h: 12, pitch: 1.1, stagger: 6, eff: [["slowness", 3, 1]] }),
  sovereign_wave: { min: 0, max: 16, cd: 15, wind: 22, tele: (e, t, c) => implode(c, eye(e), { col: "sage", n: 16, radius: 5 }),
    run(e, t, c) {
      for (let i = 0; i < 3; i++) after(1 + i * 8, () => {
        if (!isValid(e)) return; const r = 5 + i * 4, at = here(e);
        ringFlat(c, at, { col: "sage", n: 26, radius: r, life: 0.6, tile: T.ring });
        for (const pl of near(e, at, r + 1)) { if (Math.hypot(pl.location.x - at.x, pl.location.z - at.z) > r - 4.2) { hurt(pl, e, D(e, 0.7)); push(pl, at, 1.2, 0.5); } }   // a onda é um anel: quem pula ou fica longe escapa
      });
      sound(e, "attack", 1.4, 0.8);
    } },
  // ------------------------------------------------------------ Diablo
  puppet_strings: { min: 2, max: 16, cd: 14, wind: 14, tele: (e, t, c) => implode(c, t.location, { col: "shadow", n: 12, radius: 2 }),
    run(e, t, c) { for (let i = 0; i < 3; i++) after(1 + i * 12, () => { if (!isValid(e) || !isValid(t)) return; streak(c, eye(e), { x: t.location.x, y: t.location.y + 1, z: t.location.z }, { col: "black", w: 0.15, life: 0.4 }); eff(t, "slowness", 2, 3); eff(t, "nausea", 4, 0); hurt(t, e, D(e, 0.2)); });
      after(40, () => { if (isValid(e) && isValid(t)) { behind(e, t, 1.7); hurt(t, e, D(e, 0.9)); burst(c, t.location, { col: "shadow", n: 14, up: 1 }); } }); sound(e, "attack", 1, 0.9); } },
  abyss_rain: STRIKE({ cd: 14, wind: 24, max: 22, n: 5, spread: 5, radius: 2.6, dmg: 0.7, col: "shadow", col2: "violet", eff: [["blindness", 1, 0]] }),
  // ------------------------------------------------------------ Testarossa
  crimson_lance: { min: 2, max: 18, cd: 11, wind: 20, tele: (e, t, c) => { const d = flat(e.location, t.location); for (let k = 1; k <= 6; k++) ringFlat(c, { x: e.location.x + d.x * k * 2.6, y: e.location.y, z: e.location.z + d.z * k * 2.6 }, { col: "fire", n: 3, radius: 0.8, life: 1 }); pend.set(e.id, [d]); },
    run(e, t, c) { const d = pend.get(e.id)?.[0] ?? flat(e.location, t.location); pend.delete(e.id); lineHit(e, eye(e), d, 16, 1.8, D(e, 1.0), c, "fire", 4); sound(e, "attack", 1.2, 1.2); } },
  blood_pact: { min: 0, max: 10, cd: 18, wind: 16, tele: (e, t, c) => ringFlat(c, e.location, { col: "blood", n: 16, radius: 10, life: 0.8 }),
    run(e, t, c) { let n = 0; for (const pl of near(e, e.location, 10)) { hurt(pl, e, D(e, 0.5)); streak(c, pl.location, eye(e), { col: "blood", w: 0.2, life: 0.4 }); n++; } if (n) heal(e, maxHp(e) * Math.min(0.06, 0.03 * n)); sound(e, "ambient", 1, 0.8); } },
  // ------------------------------------------------------------ Ultima
  laser_barrage: STRIKE({ cd: 15, wind: 30, max: 24, n: 5, spread: 6, radius: 2.2, dmg: 0.75, col: "arcane", col2: "violet", bolt: true, stagger: 4 }),
  // ------------------------------------------------------------ Carrera
  wind_blades: { min: 0, max: 12, cd: 9, wind: 10, tele: (e, t, c) => burst(c, eye(e), { col: "wind", n: 8, spd: 1.8 }),
    run(e, t, c) { for (let i = 0; i < 3; i++) after(1 + i * 6, () => { if (!isValid(e) || !isValid(t)) return; const d = flat(e.location, t.location); fan(c, eye(e), d, { col: "wind", n: 18, spd: 8, life: 0.4, angle: 60 + i * 20, tile: T.arc }); for (const pl of near(e, e.location, 9)) { const v = flat(e.location, pl.location); if (v.x * d.x + v.z * d.z > 0.5) { hurt(pl, e, D(e, 0.4)); push(pl, e.location, 0.5, 0.2); } } sound(e, "attack", 0.9, 1.3 + i * 0.1); }); } },
  triple_kick: { min: 3, max: 18, cd: 14, wind: 8, tele: (e, t, c) => burst(c, e.location, { col: "wind", n: 10, up: 1 }), run(e, t, c) { dashes(e, t, c, { n: 3, gap: 9, blink: true, dmg: 0.6, col: "wind", hitAt: 3 }); } },
  // ------------------------------------------------------------ Rain / Rimuru
  water_shield: { min: 0, max: 30, cd: 26, wind: 8, tele: (e, t, c) => ringFlat(c, e.location, { col: "water", n: 14, radius: 3 }),
    run(e, t, c) { eff(e, "resistance", 5, 3); eff(e, "absorption", 10, 3); ringFlat(c, e.location, { col: "foam", n: 26, radius: 5, life: 0.5 }); for (const pl of near(e, e.location, 4.5)) { push(pl, e.location, 1.2, 0.35); hurt(pl, e, D(e, 0.25)); } sound(e, "ambient", 1, 1.3); } },
  tidal_pull: { min: 0, max: 16, cd: 14, wind: 16, tele: (e, t, c) => implode(c, e.location, { col: "water", n: 16, radius: 7 }), run(e, t, c) { pulls(e, c, { col: "water", radius: 14, pulses: 2, pull: 1.4, dmg: 0.35, eff: [["slowness", 3, 1]] }); } },
  slime_split: { min: 0, max: 26, cd: 18, wind: 12, cond: canSummon, tele: (e, t, c) => burst(c, e.location, { col: "water", n: 12, up: 1 }), run(e, t, c) { doSummon(e); burst(c, e.location, { col: "foam", n: 16, up: 1.5 }); sound(e, "ambient", 1, 1.4); } },
  sage_barrier: { min: 0, max: 30, cd: 30, wind: 8, tele: (e, t, c) => implode(c, eye(e), { col: "arcane", n: 12, radius: 2 }),
    run(e, t, c) { eff(e, "absorption", 10, 4); eff(e, "resistance", 6, 2); ringFlat(c, e.location, { col: "arcane", n: 24, radius: 4, life: 0.6 }); sound(e, "ambient", 1, 1.2); } },
  water_prison: { min: 2, max: 14, cd: 15, wind: 14, tele: (e, t, c) => implode(c, t.location, { col: "water", n: 12, radius: 2 }),
    run(e, t, c) { for (let i = 0; i < 3; i++) after(1 + i * 14, () => { if (!isValid(t)) return; ringFlat(c, t.location, { col: "water", n: 14, radius: 1.8, life: 0.4 }); column(c, t.location, { col: "foam", n: 8, h: 3, tile: T.bubble }); eff(t, "slowness", 3, 4); eff(t, "mining_fatigue", 3, 1); hurt(t, e, D(e, 0.22)); }); sound(e, "attack", 1, 1.1); } },
  // ------------------------------------------------------------ Michael / Luminous
  judgement: STRIKE({ cd: 14, wind: 30, max: 22, n: 3, spread: 4, radius: 2.4, dmg: 0.9, col: "holy", col2: "gold", eff: [["blindness", 2, 0]] }),
  holy_barrier: { min: 0, max: 30, cd: 24, wind: 10, tele: (e, t, c) => ringFlat(c, e.location, { col: "gold", n: 14, radius: 3 }),
    run(e, t, c) { eff(e, "resistance", 5, 2); ringFlat(c, e.location, { col: "holy", n: 28, radius: 6, life: 0.6 }); column(c, e.location, { col: "light", n: 14, h: 6 }); for (const pl of near(e, e.location, 5.5)) { push(pl, e.location, 1.5, 0.4); hurt(pl, e, D(e, 0.3)); } sound(e, "ambient", 1.1, 1.2); } },
  holy_cross: { min: 0, max: 22, cd: 15, wind: 26, tele: (e, t, c) => { const p = here(t); pend.set(e.id, [p]); for (let k = -3; k <= 3; k++) { ringFlat(c, { x: p.x + k * 2, y: p.y, z: p.z }, { col: "gold", n: 2, radius: 0.8, life: 1 }); ringFlat(c, { x: p.x, y: p.y, z: p.z + k * 2 }, { col: "gold", n: 2, radius: 0.8, life: 1 }); } },
    run(e, t, c) { const p = pend.get(e.id)?.[0]; pend.delete(e.id); if (!p) return; column(c, p, { col: "light", n: 24, h: 8 });
      for (const pl of near(e, p, 9)) { const dx = Math.abs(pl.location.x - p.x), dz = Math.abs(pl.location.z - p.z); if ((dx < 1.6 && dz < 8) || (dz < 1.6 && dx < 8)) { hurt(pl, e, D(e, 1.0) * (isMarked(pl) ? 1.4 : 1)); eff(pl, "blindness", 2, 0); } } sound(e, "attack", 1.2, 1.2); } },
  sin_mark: { min: 2, max: 18, cd: 18, wind: 14, tele: (e, t, c) => column(c, t.location, { col: "gold", n: 8, h: 4 }),
    run(e, t, c) { marks.set(t.id, system.currentTick + 240); if (marks.size > 50) marks.clear(); eff(t, "wither", 4, 0); eff(t, "weakness", 8, 0); hurt(t, e, D(e, 0.5)); burst(c, t.location, { col: "gold", n: 14, up: 1.5 }); sound(e, "attack", 1, 1.4); } },
  // ------------------------------------------------------------ Retornado
  soul_harvest: { min: 0, max: 10, cd: 17, wind: 16, tele: (e, t, c) => ringFlat(c, e.location, { col: "shadow", n: 16, radius: 9, life: 0.8 }),
    run(e, t, c) { let n = 0; for (const pl of near(e, e.location, 9)) { hurt(pl, e, D(e, 0.4)); streak(c, pl.location, eye(e), { col: "violet", w: 0.2, life: 0.4 }); n++; } if (n) heal(e, maxHp(e) * Math.min(0.06, 0.03 * n)); sound(e, "ambient", 1, 0.7); } },
  demon_horde: { min: 0, max: 26, cd: 20, wind: 14, cond: canSummon, tele: (e, t, c) => implode(c, eye(e), { col: "shadow", n: 12, radius: 2 }), run(e, t, c) { doSummon(e); ringFlat(c, e.location, { col: "violet", n: 20, radius: 4, life: 0.5 }); sound(e, "ambient", 1.1, 0.8); } },
  // ------------------------------------------------------------ Orthocadinaht
  web_trap: { min: 3, max: 18, cd: 16, wind: 12, tele: (e, t, c) => ringFlat(c, t.location, { col: "white", n: 12, radius: 3 }),
    run(e, t, c) { zone(e, here(t), 3.2, 8, "white", (pl) => { eff(pl, "slowness", 2, 3); eff(pl, "poison", 2, 0); }); sound(e, "attack", 1, 1.2); } },
  spider_swarm: { min: 0, max: 24, cd: 18, wind: 12, cond: canSummon, tele: (e, t, c) => burst(c, e.location, { col: "dust", n: 8, up: 1 }), run(e, t, c) { doSummon(e); burst(c, e.location, { col: "white", n: 10, up: 1 }); sound(e, "ambient", 1, 1.2); } },
  // ------------------------------------------------------------ Yuuki: Anti-Skill (regras em systems/antiskill.js / config ANTISKILL)
  anti_skill: { min: 0, max: 16, cd: 22, wind: 24, tele: (e, t, c) => { ringFlat(c, e.location, { col: "void", n: 24, radius: 9, life: 1.1 }); implode(c, eye(e), { col: "violet", n: 12, radius: 2.4 }); },
    run(e, t, c) {
      openField(e); let n = 0;
      for (const pl of near(e, e.location, 14)) { if (sealPlayer(pl)) { n++; try { pl.sendMessage("§8[Anti-Skill] §7Suas habilidades comuns foram seladas por instantes! Únicas e Supremas não são afetadas."); } catch { /* ignore */ } } }
      burst(c, e.location, { col: "violet", n: 10, up: 1, spd: 1.2 }); ringFlat(c, e.location, { col: "void", n: 28, radius: 9, life: 0.6 }); sound(e, "attack", 1, 0.8); } },
  // Yuuki: "Criador" - forja na hora uma habilidade (forma x elemento sorteados), telegrafada no ponto do alvo; efeitos curtos e recarga longa
  creation: { min: 3, max: 22, cd: 15, wind: 18, tele: (e, t, c) => { ringFlat(c, t.location, { col: "violet", n: 16, radius: 3.2, life: 0.9 }); implode(c, eye(e), { col: "white", n: 10, radius: 2 }); },
    run(e, t, c) {
      const pick = ["fire", "ice", "shadow", "void", "earth"][Math.floor(Math.random() * 5)], at = here(t);
      for (const pl of near(e, at, 3.4)) {
        hurt(pl, e, D(e, 0.55));
        if (pick === "fire") { try { pl.setOnFire(4, true); } catch { /* ignore */ } } else if (pick === "ice") eff(pl, "slowness", 4, 1); else if (pick === "shadow") eff(pl, "blindness", 2, 0); else if (pick === "void") eff(pl, "weakness", 5, 0); else eff(pl, "slowness", 3, 2);
      }
      burst(c, at, { col: pick === "fire" ? "gold" : pick === "earth" ? "dust" : pick === "ice" ? "white" : "violet", n: 16, up: 1.2, spd: 1.1 }); ringFlat(c, at, { col: "violet", n: 20, radius: 3.4, life: 0.5 }); sound(e, "attack", 1, 1.1); } },
  // ------------------------------------------------------------ Dragões Verdadeiros (golpe exclusivo, fases 2+)
  storm_domain: STRIKE({ act: "ability", cd: 16, wind: 20, max: 28, n: 6, spread: 7, radius: 3, dmg: 0.6, col: "bolt", col2: "violet", bolt: true, knock: 0.8, stagger: 4 }),
  absolute_zero: STRIKE({ act: "ability", cd: 20, wind: 36, max: 14, self: true, radius: 9, dmg: 0.8, col: "ice", col2: "frost", eff: [["slowness", 3, 4], ["mining_fatigue", 4, 1]] }),
  inferno_pillars: STRIKE({ act: "ability", cd: 15, wind: 24, max: 24, n: 5, spread: 5, radius: 2.6, dmg: 0.75, col: "fire", col2: "ember", fire: 4, h: 10 }),
  genesis: STRIKE({ act: "ability", cd: 24, wind: 56, max: 26, radius: 5.5, dmg: 1.7, knock: 1.6, col: "light", col2: "gold", eff: [["blindness", 3, 0]], h: 14 }),
};
// 6.83: usados pelas magias gigantes dos chefes (systems/grandspells.js)
export { D as bossDmg, hurt as bossHurt, near as bossNear };

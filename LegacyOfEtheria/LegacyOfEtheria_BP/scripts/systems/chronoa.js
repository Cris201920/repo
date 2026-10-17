// systems/chronoa.js - Chronoa, a Senhora do Tempo (boss de fim de jogo + NPC). Habilidade Única: CRONOS (domínio sobre o fluxo do tempo).
// Passiva  PERCEPÇÃO TEMPORAL: enxerga jogadores invisíveis por perto, prevê golpes (esquiva/contra-ataque automáticos) e escolhe a resposta pela fase.
// Ativas   Pulso Temporal · Distorção (lentidão) · Aceleração · Paralisação Temporal · Eco Temporal · Ataque Temporal · Salto Temporal · Domínio Temporal;
//          forma Lord Demônio (≤40% de vida): Bater de Asas · Mergulho Carmesim · Nova Carmesim.
// Defesa   REVERSÃO TEMPORAL: no máx. 2 vezes por luta (recarga longa), volta ~3 s no tempo (posição), cura 12% e limpa efeitos negativos.
// Fases    >70% controle básico · 70-40% percepção+ecos+aceleração · 40-15% Lord Demônio + paralisação + reversão · <15% domínio completo.
// Estados temporais (por entidade): normal / lento / acelerado / congelado - guardados em TS e expirados por tempo (nada fica preso: tudo é efeito com duração).
// Desempenho: 1 laço a cada 10 ticks só perto de jogadores, partículas por fxlib (orçamento próprio), máx. 2 ecos, 1 domínio ativo, tudo limpo na morte/despawn.
import { world, system } from "@minecraft/server";
import { MOBS } from "../data/mobs.gen.js";
import { isValid, dist, norm, rand, say, titleGuard, holdTitle } from "../core/utils.js";
import { ctx, burst, implode, ringFlat, column, bolt, streak, after, T } from "./fxlib.js";
import { setAct } from "./truedragon.js";

export const CHR = "etheria:chronoa", ECHO = "etheria:chronoa_echo";
export const SKILL_NAME = "Cronos, Senhora do Tempo";
const SCAN = 10, TRANSFORM_AT = 0.40, PROJ = ["minecraft:arrow", "minecraft:snowball", "minecraft:thrown_trident", "minecraft:small_fireball", "minecraft:fireball", "minecraft:egg", "minecraft:ender_pearl"];
const NEG = ["slowness", "weakness", "blindness", "poison", "wither", "nausea", "mining_fatigue", "hunger", "fatal_poison"];
const st = new Map();           // chronoaId -> estado de luta
export const TS = new Map();    // entityId -> { state: "lento"|"acelerado"|"congelado"|"normal", until }  (estado temporal)

export const isChronoa = (e) => { try { return e.typeId === CHR; } catch { return false; } };
const form = (e) => { try { return e.getProperty("etheria:form"); } catch { return undefined; } };
const near = (e, r, pos) => { try { return e.dimension.getPlayers({ location: pos ?? e.location, maxDistance: r }).filter((p) => { const g = p.getGameMode?.(); return g !== "creative" && g !== "spectator"; }); } catch { return []; } };
const eff = (en, id, ticks, amp = 0, show = true) => { try { en.addEffect(id, Math.round(ticks), { amplifier: amp, showParticles: show }); } catch { /* ignore */ } };
const hurt = (pl, e, amt, cause = "entityAttack") => { try { pl.applyDamage(amt, { cause, damagingEntity: isValid(e) ? e : undefined }); } catch { /* ignore */ } };
const push = (pl, from, s, up = 0.3, inward = false) => { try { let dx = pl.location.x - from.x, dz = pl.location.z - from.z; if (inward) { dx = -dx; dz = -dz; } const l = Math.hypot(dx, dz) || 1; pl.applyKnockback(dx / l, dz / l, s, up); } catch { /* ignore */ } };
const eye = (e) => ({ x: e.location.x, y: e.location.y + 1.3, z: e.location.z });
const H = (e, p) => (MOBS[CHR]?.dmg ?? 40) * p * (form(e) === "demon" ? 1.2 : 1);
const flatDir = (a, b) => norm({ x: b.x - a.x, y: 0, z: b.z - a.z });
const bar = (p, txt) => { try { p.onScreenDisplay.setActionBar(txt); } catch { /* ignore */ } };
const sfx = (e, kind, vol = 1.2, pitch = 1) => { for (const p of near(e, 40)) { try { p.playSound(`etheria.mob.chronoa_${kind}`, { location: e.location, volume: vol, pitch }); } catch { /* ignore */ } } };
const ratio = (e) => { try { const h = e.getComponent("minecraft:health"); return h.currentValue / h.effectiveMax; } catch { return 1; } };
export const phaseOf = (r) => (r > 0.70 ? 1 : r > 0.40 ? 2 : r > 0.15 ? 3 : 4);

function state(e) {
  let s = st.get(e.id);
  if (!s) { s = { phase: 1, hist: [], rewinds: 0, rewindAt: 0, dodgeAt: 0, domainUntil: 0, accelUntil: 0, intro: false, morphing: false }; st.set(e.id, s); }
  return s;
}
function tstate(en, state_, ticks) { TS.set(en.id, { state: state_, until: system.currentTick + ticks }); }

// ---------------------------------------------------------------- efeitos visuais reutilizáveis (poucas partículas, cada uma com função)
const clockRing = (c, pos, radius, col = "gold") => { ringFlat(c, pos, { col, n: 16, radius, life: 0.7, tile: T.ring }); ringFlat(c, pos, { col: "arcane", n: 10, radius: radius * 0.6, life: 0.5, tile: T.rune1 }); };
const fragments = (c, pos, n = 8) => burst(c, pos, { col: "gold", n, spd: 2.2, up: 1.2, tile: T.shard });

// ---------------------------------------------------------------- habilidades (mesmo formato do mobai: min/max/cd/wind/tele/run + act = animação)
export const CHR_A = {
  chr_pulse: { act: "cast", min: 3, max: 18, cd: 4, wind: 9, tele: (e, t, c) => burst(c, eye(e), { col: "arcane", n: 6, spd: 1.4 }),
    run(e, t, c) { bolt(c, eye(e), eye(t), { col: "violet", w: 0.16 }); fragments(c, eye(t), 5); hurt(t, e, H(e, 0.55)); eff(t, "slowness", 40, 0); sfx(e, "attack", 1, 1.3); } },
  chr_slow: { act: "temporal", min: 0, max: 11, cd: 13, wind: 14, tele: (e, t, c) => clockRing(c, e.location, 3),
    run(e, t, c) { clockRing(c, e.location, 8); ringFlat(c, e.location, { col: "violet", n: 22, radius: 8, life: 0.8 });
      for (const p of near(e, 8)) { eff(p, "slowness", 90, 2); eff(p, "weakness", 90, 0); tstate(p, "lento", 90); bar(p, "§b⏳ §7Tempo: §3LENTO"); }
      sfx(e, "ambient", 1.1, 0.8); } },
  chr_accel: { act: "dash", min: 0, max: 40, cd: 24, wind: 6, cond: (e) => !e.hasTag("chr_accel") && phaseOf(ratio(e)) >= 2,
    tele: (e, t, c) => implode(c, e.location, { col: "gold", n: 10, radius: 3 }),
    run(e, t, c) { const s = state(e); s.accelUntil = system.currentTick + 140; e.addTag("chr_accel"); tstate(e, "acelerado", 140);
      eff(e, "speed", 140, 3, false); eff(e, "strength", 140, 1, false); eff(e, "haste", 140, 1, false);
      for (let i = 0; i < 4; i++) after(i * 6, () => { if (isValid(e)) burst(c, e.location, { col: "gold", n: 6, spd: 0.6, up: 0.4, tile: T.smoke }); });
      for (const p of near(e, 30)) bar(p, "§6⏩ §eChronoa acelera o próprio tempo"); sfx(e, "ambient", 1, 1.5); } },
  chr_stop: { act: "temporal", min: 0, max: 12, cd: 26, wind: 26, cond: (e) => phaseOf(ratio(e)) >= 3,
    tele: (e, t, c) => { clockRing(c, e.location, 9, "white"); implode(c, e.location, { col: "white", n: 16, radius: 9 }); for (const p of near(e, 12)) bar(p, "§c⚠ §7Chronoa vai §fparar o tempo§7!"); },
    run(e, t, c) {
      const ps = near(e, 9); ringFlat(c, e.location, { col: "white", n: 30, radius: 9, life: 1.0, tile: T.ring });
      for (const p of ps) { eff(p, "slowness", 50, 250, false); eff(p, "weakness", 50, 250, false); eff(p, "mining_fatigue", 50, 250, false); tstate(p, "congelado", 50); bar(p, "§b❄ §fO tempo parou..."); burst(c, p.location, { col: "white", n: 6, spd: 0.1, up: 0.2, tile: T.shard }); }
      let n = 0; const freeze = () => { if (!isValid(e) || n++ > 12) return; try { for (const ty of PROJ) for (const pr of e.dimension.getEntities({ type: ty, location: e.location, maxDistance: 11 })) pr.clearVelocity(); } catch { /* ignore */ } after(4, freeze); };
      freeze(); sfx(e, "attack", 1.3, 0.6); } },
  chr_echo: { act: "echo", min: 0, max: 22, cd: 18, wind: 10, cond: (e) => phaseOf(ratio(e)) >= 2,
    tele: (e, t, c) => burst(c, e.location, { col: "arcane", n: 8, spd: 1, up: 1 }),
    run(e, t, c) {
      const cap = phaseOf(ratio(e)) >= 3 ? 2 : 1; let have = 0; try { have = e.dimension.getEntities({ type: ECHO, location: e.location, maxDistance: 48 }).length; } catch { /* ignore */ }
      for (let i = have; i < cap; i++) { const a = rand(0, Math.PI * 2); try { const k = e.dimension.spawnEntity(ECHO, { x: e.location.x + Math.cos(a) * 2.5, y: e.location.y, z: e.location.z + Math.sin(a) * 2.5 }); k.addTag("chr_echo"); burst(c, k.location, { col: "arcane", n: 8, spd: 0.8, up: 1 }); } catch { /* ignore */ } }
      sfx(e, "ambient", 0.9, 1.4); } },
  chr_strike: { act: "strike", min: 3, max: 22, cd: 15, wind: 36,
    tele(e, t, c) { const at = { x: t.location.x, y: t.location.y, z: t.location.z }; e.addTag("chr_lock"); state(e).lock = at;
      for (let i = 0; i < 4; i++) after(i * 9, () => { if (isValid(e)) { clockRing(c, at, 6 - i * 1.2, i % 2 ? "arcane" : "gold"); implode(c, { x: at.x, y: at.y + 1, z: at.z }, { col: "violet", n: 8, radius: 4 - i }); } });
      for (const p of near(e, 24)) bar(p, "§5⚠ §dAtaque Temporal! §7Saia do círculo."); },
    run(e, t, c) { const at = state(e).lock ?? t.location; e.removeTag("chr_lock");
      column(c, at, { col: "light", n: 20, h: 8, r: 0.7 }); ringFlat(c, at, { col: "gold", n: 30, radius: 7, life: 0.7, tile: T.ring }); burst(c, { x: at.x, y: at.y + 1, z: at.z }, { col: "violet", n: 20, spd: 3, up: 2, tile: T.shard });
      for (const p of near(e, 6.5, at)) { hurt(p, e, H(e, 1.1), "magic"); push(p, at, 1.4, 0.55); eff(p, "slowness", 40, 1); }
      sfx(e, "attack", 1.5, 0.7); } },
  chr_dash: { act: "dash", min: 5, max: 26, cd: 8, wind: 6, tele: (e, t, c) => burst(c, e.location, { col: "gold", n: 10, spd: 0.5, up: 0.8, tile: T.smoke }),
    run(e, t, c) { const old = { ...e.location }; const d = flatDir(e.location, t.location);
      try { e.teleport({ x: t.location.x + d.x * 1.8, y: t.location.y, z: t.location.z + d.z * 1.8 }, { dimension: t.dimension, facingLocation: t.location }); } catch { /* ignore */ }
      streak(c, { x: old.x, y: old.y + 1, z: old.z }, eye(e), { col: "gold", w: 0.3, life: 0.6 }); burst(c, e.location, { col: "gold", n: 10, spd: 1, up: 1, tile: T.spark });
      after(5, () => { if (isValid(e) && isValid(t) && dist(e.location, t.location) < 4) { hurt(t, e, H(e, 0.85)); push(t, e.location, 0.9, 0.3); } }); sfx(e, "attack", 1, 1.4); } },
  chr_domain: { act: "domain", min: 0, max: 30, cd: 50, wind: 40, cond: (e) => (phaseOf(ratio(e)) >= 4 || (form(e) === "demon" && phaseOf(ratio(e)) >= 3)) && state(e).domainUntil < system.currentTick,
    tele: (e, t, c) => { for (let i = 0; i < 4; i++) after(i * 10, () => { if (isValid(e)) { clockRing(c, e.location, 14 - i * 2.5); column(c, e.location, { col: "gold", n: 8, h: 6, r: 1 }); } }); for (const p of near(e, 30)) bar(p, "§4§l⚠ DOMÍNIO TEMPORAL"); },
    run(e, t, c) { const s = state(e); const end = system.currentTick + 240; s.domainUntil = end; tstate(e, "acelerado", 240); eff(e, "speed", 240, 2, false); eff(e, "resistance", 240, 1, false); sfx(e, "ambient", 1.5, 0.6);
      let k = 0; const pulse = () => { if (!isValid(e) || system.currentTick > end) { s.domainUntil = 0; return; }
        const ps = near(e, 14); clockRing(c, e.location, 14, k % 2 ? "violet" : "gold");
        for (const p of ps) { eff(p, "slowness", 30, 1, false); eff(p, "weakness", 30, 0, false); tstate(p, "lento", 30); }
        if (k % 3 === 2 && ps.length) { const v = ps[Math.floor(Math.random() * ps.length)]; eff(v, "slowness", 30, 250, false); tstate(v, "congelado", 30); bar(v, "§b❄ §fCongelado no domínio..."); burst(c, v.location, { col: "white", n: 6, spd: 0.1, up: 0.3, tile: T.shard }); }
        if (k % 4 === 3 && ps.length) { const v = ps[0]; try { const a = rand(0, 6.28); e.teleport({ x: v.location.x + Math.cos(a) * 3, y: v.location.y, z: v.location.z + Math.sin(a) * 3 }, { dimension: v.dimension, facingLocation: v.location }); } catch { /* ignore */ } }
        k++; after(20, pulse); };
      pulse(); } },
  // ---- forma Lord Demônio ----
  chr_gust: { act: "cast", min: 0, max: 9, cd: 8, wind: 12, cond: (e) => form(e) === "demon", tele: (e, t, c) => burst(c, e.location, { col: "wind", n: 8, spd: 1.6, up: 0.6 }),
    run(e, t, c) { const d = flatDir(e.location, t.location); ringFlat(c, e.location, { col: "ember", n: 26, radius: 8, life: 0.6, tile: T.arc });
      for (const p of near(e, 9)) { const v = flatDir(e.location, p.location); if (v.x * d.x + v.z * d.z > 0.3) { hurt(p, e, H(e, 0.6)); push(p, e.location, 1.8, 0.5); } } sfx(e, "attack", 1.3, 0.8); } },
  chr_dive: { act: "dash", min: 6, max: 24, cd: 12, wind: 14, cond: (e) => form(e) === "demon", tele: (e, t, c) => ringFlat(c, e.location, { col: "ember", n: 12, radius: 3 }),
    run(e, t, c) { eff(e, "slow_falling", 60, 0, false); try { const d = flatDir(e.location, t.location); e.applyKnockback(d.x, d.z, 2.2, 0.9); } catch { /* ignore */ }
      after(18, () => { if (!isValid(e)) return; ringFlat(c, e.location, { col: "fire", n: 28, radius: 6, life: 0.6, tile: T.flame }); burst(c, e.location, { col: "ember", n: 14, up: 2 }); for (const p of near(e, 6)) { hurt(p, e, H(e, 0.9)); push(p, e.location, 1.5, 0.5); } sfx(e, "attack", 1.3, 0.7); }); } },
  chr_nova: { act: "cast", min: 0, max: 8, cd: 14, wind: 22, cond: (e) => form(e) === "demon", tele: (e, t, c) => { implode(c, eye(e), { col: "ember", n: 14, radius: 3 }); column(c, e.location, { col: "fire", n: 8, h: 5, r: 0.8 }); },
    run(e, t, c) { ringFlat(c, e.location, { col: "fire", n: 36, radius: 8.5, life: 0.8, tile: T.flame }); ringFlat(c, e.location, { col: "gold", n: 18, radius: 5, life: 0.6 });
      for (const p of near(e, 8.5)) { hurt(p, e, H(e, 0.85), "fire"); try { p.setOnFire(4, true); } catch { /* ignore */ } push(p, e.location, 1.2, 0.4); } sfx(e, "attack", 1.5, 0.6); } },
};

/** lista de habilidades por fase/forma (ordem = prioridade) - usada pelo mobai */
export function chronoAbilities(e) {
  const p = phaseOf(ratio(e)), dem = form(e) === "demon";
  const L = p === 1 ? ["chr_pulse", "chr_slow", "chr_dash"]
    : p === 2 ? ["chr_accel", "chr_echo", "chr_strike", "chr_pulse", "chr_slow", "chr_dash"]
    : p === 3 ? ["chr_stop", "chr_strike", "chr_echo", "chr_accel", "chr_dash", "chr_slow", "chr_pulse"]
    : ["chr_domain", "chr_stop", "chr_strike", "chr_accel", "chr_echo", "chr_dash", "chr_pulse"];
  return dem ? ["chr_nova", "chr_gust", "chr_dive", ...L] : L;
}

// ---------------------------------------------------------------- transformação: Lord Demônio
function transform(e, tick) {
  const s = state(e); if (s.morphing || form(e) === "demon") return; s.morphing = true;
  e.addTag("chr_busy"); setAct(e, "transform", 54); eff(e, "resistance", 60, 4, false); eff(e, "slowness", 60, 250, false);
  const ps = near(e, 40), c = ps[0] ? ctx(ps[0], 1.3) : null;
  for (const p of ps) { say(p, "§5§l[Chronoa] §r§dO tempo se curva... §c§lLORD DEMÔNIO§r§d desperta!"); try { p.playSound("mob.wither.spawn", { location: e.location, volume: 0.7, pitch: 0.6 }); } catch { /* ignore */ } }
  if (c) for (let i = 0; i < 5; i++) after(i * 10, () => { if (!isValid(e)) return; implode(c, eye(e), { col: i % 2 ? "ember" : "gold", n: 12 + i * 4, radius: 3 + i }); column(c, e.location, { col: "violet", n: 8, h: 4 + i, r: 0.6 }); clockRing(c, e.location, 3 + i * 1.5, i % 2 ? "ember" : "gold"); });
  sfx(e, "ambient", 1.6, 0.6);
  after(52, () => {
    if (!isValid(e)) return;
    try { e.triggerEvent("etheria:to_demon"); } catch (er) { console.warn(`[Etheria] chronoa to_demon: ${er}`); }
    try { e.removeEffect("slowness"); e.removeEffect("resistance"); } catch { /* ignore */ }
    e.removeTag("chr_busy"); s.morphing = false; eff(e, "speed", 200, 1, false); eff(e, "regeneration", 100, 1, false);
    if (c) { ringFlat(c, e.location, { col: "ember", n: 40, radius: 11, life: 0.9, tile: T.ring }); burst(c, eye(e), { col: "fire", n: 30, spd: 3, up: 2, tile: T.flame }); burst(c, eye(e), { col: "gold", n: 20, spd: 2.4, up: 1.4, tile: T.shard }); }
    for (const p of near(e, 11)) push(p, e.location, 1.6, 0.5); sfx(e, "attack", 1.6, 0.6);
  });
}

// ---------------------------------------------------------------- laço principal (percepção temporal, fases, reversão, estados)
function think(e, tick) {
  const s = state(e), r = ratio(e), ph = phaseOf(r);
  if (!s.intro) { s.intro = true; for (const p of near(e, 48)) { try { if (!titleGuard.busy(p)) { holdTitle(p, 90); p.onScreenDisplay.setTitle("§5§lCHRONOA", { subtitle: `§dHABILIDADE ÚNICA: §f${SKILL_NAME}`, fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 }); } } catch { /* ignore */ } } }
  if (ph !== s.phase) {
    s.phase = ph; const msg = ph === 2 ? "§dChronoa percebe você... §7(Percepção avançada, ecos)" : ph === 3 ? "§5O tempo vacila. §7(Paralisação e reversão)" : "§4§lO TEMPO É DELA. §r§7(Domínio completo)";
    for (const p of near(e, 40)) { say(p, `§5[Chronoa] ${msg}`); } try { sfx(e, "ambient", 1.2, 0.7); } catch { /* ignore */ }
  }
  if (r <= TRANSFORM_AT && form(e) === "human") transform(e, tick);
  s.hist.push({ x: e.location.x, y: e.location.y, z: e.location.z }); if (s.hist.length > 6) s.hist.shift();
  if (e.hasTag("chr_accel") && tick > s.accelUntil) { e.removeTag("chr_accel"); try { e.removeEffect("speed"); e.removeEffect("strength"); e.removeEffect("haste"); } catch { /* ignore */ } }
  // percepção temporal: nada de invisibilidade por perto; jogadores ocultos até 16 blocos são revelados
  for (const p of near(e, 16)) { try { if (p.getEffect("invisibility")) { p.removeEffect("invisibility"); bar(p, "§5Chronoa viu através do seu disfarce."); } } catch { /* ignore */ } }
  // estados temporais vencidos
  for (const [id, v] of TS) if (tick > v.until) TS.delete(id);
}

// reversão e previsão: reagem ao dano recebido
function onHurt(ev) {
  const e = ev.hurtEntity; if (!isChronoa(e)) return;
  const s = state(e), tick = system.currentTick, r = ratio(e), ph = phaseOf(r), dmg = ev.damage ?? 0;
  const att = ev.damageSource?.damagingEntity;
  if (form(e) === "demon" && e.getProperty("etheria:act") === "none") setAct(e, "hurt", 8);
  // REVERSÃO TEMPORAL (rara): vida baixa, no máx. 2 usos, recarga de 60 s
  if (r < 0.40 && s.rewinds < 2 && tick > s.rewindAt && !e.hasTag("chr_busy")) {
    s.rewinds++; s.rewindAt = tick + 1200;
    try { const h = e.getComponent("minecraft:health"); h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + h.effectiveMax * 0.12 + dmg)); } catch { /* ignore */ }
    for (const id of NEG) { try { e.removeEffect(id); } catch { /* ignore */ } }
    const back = s.hist[0]; if (back && dist(back, e.location) > 2) { try { e.teleport(back, { dimension: e.dimension }); } catch { /* ignore */ } }
    const ps = near(e, 40), c = ps[0] ? ctx(ps[0], 1.2) : null;
    for (const p of ps) say(p, `§5[Chronoa] §d⏪ Reversão Temporal §7(${s.rewinds}/2) — o dano foi desfeito.`);
    if (c) { ringFlat(c, e.location, { col: "light", n: 30, radius: 7, life: 0.8, tile: T.ring }); implode(c, eye(e), { col: "gold", n: 18, radius: 5 }); burst(c, eye(e), { col: "white", n: 16, spd: 2, up: 1 }); }
    setAct(e, "temporal", 30); sfx(e, "ambient", 1.4, 1.6); return;
  }
  // PREVISÃO TEMPORAL: esquiva (desfaz o dano e reposiciona) com chance crescente por fase; recarga de 3 s
  const chance = [0, 0.12, 0.25, 0.35, 0.45][ph];
  if (tick > s.dodgeAt && Math.random() < chance && !e.hasTag("chr_busy")) {
    s.dodgeAt = tick + 60;
    try { const h = e.getComponent("minecraft:health"); h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + dmg)); } catch { /* ignore */ }
    const a = rand(0, Math.PI * 2); try { e.teleport({ x: e.location.x + Math.cos(a) * 3.5, y: e.location.y, z: e.location.z + Math.sin(a) * 3.5 }, { dimension: e.dimension, facingLocation: att?.location ?? e.location }); } catch { /* ignore */ }
    setAct(e, "dash", 14); const ps = near(e, 30), c = ps[0] ? ctx(ps[0], 1) : null;
    if (c) { burst(c, e.location, { col: "gold", n: 10, spd: 1, up: 1, tile: T.smoke }); streak(c, eye(e), att ? eye(att) : eye(e), { col: "arcane", w: 0.2, life: 0.4 }); }
    if (att && att.typeId === "minecraft:player") { bar(att, "§5Chronoa §dprevi§5u o seu golpe."); if (ph >= 2) { hurt(att, e, H(e, 0.45)); push(att, e.location, 0.8, 0.3); } }   // contra-ataque a partir da fase 2
    sfx(e, "attack", 0.9, 1.5);
  }
}

function clearAll(e) {
  try { for (const k of e.dimension.getEntities({ type: ECHO, location: e.location, maxDistance: 64 })) k.remove(); } catch { /* ignore */ }
  st.delete(e.id); TS.delete(e.id);
}

export function startChronoa() {
  system.runInterval(() => {
    const tick = system.currentTick, seen = new Set();
    for (const pl of world.getAllPlayers()) {
      let es; try { es = pl.dimension.getEntities({ location: pl.location, maxDistance: 80, type: CHR }); } catch { continue; }
      for (const e of es) { if (seen.has(e.id)) continue; seen.add(e.id); try { think(e, tick); } catch (er) { console.warn(`[Etheria] chronoa: ${er}`); } }
    }
    if (tick % 600 < SCAN) for (const id of st.keys()) { try { if (!world.getEntity(id)) st.delete(id); } catch { st.delete(id); } }
  }, SCAN);
  world.afterEvents.entityHurt.subscribe((ev) => { try { onHurt(ev); } catch (er) { console.warn(`[Etheria] chronoa hurt: ${er}`); } });
  world.afterEvents.entityDie.subscribe((ev) => { try { const e = ev.deadEntity; if (isChronoa(e)) { clearAll(e); for (const p of near(e, 48)) say(p, "§5[Chronoa] §7O tempo volta a fluir... Ela sorri antes de desaparecer."); } } catch { /* ignore */ } });
}

// diálogos do NPC Chronoa (conforme nível, quem está por perto e reputação futura)
export function chronoaLine(player) {
  const near_ = (() => { try { return player.dimension.getEntities({ location: player.location, maxDistance: 24 }).map((x) => x.typeId); } catch { return []; } })();
  const has = (id) => near_.includes("etheria:" + id);
  if (has("veldora")) return "§d\"Veldora... sempre barulhento. O tempo dele escorre tão devagar quanto sua paciência.\"";
  if (has("diablo")) return "§d\"Diablo. Um primordial que serve a um slime. O tempo realmente prega peças.\"";
  if (has("rimuru_tempest") || has("rimuru_senhor_demonio")) return "§d\"Rimuru Tempest... você mudou o mundo mais rápido do que o tempo previa.\"";
  if (has("shion") || has("benimaru")) return "§d\"Seus companheiros de Tempest são leais. Raro, em qualquer linha do tempo.\"";
  return null;
}

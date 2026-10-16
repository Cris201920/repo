// systems/bossfight.js - MOTOR DE BATALHA DE BOSS: introdução, fases por vida, efeitos de fase, minions com limite, mecânicas passivas,
// evolução do Orc do Desastre (devorar criaturas), Escudo de Carne, morte de boss e limpeza. Perfis em data/bossprofiles.js.
// As habilidades ficam em mobai.js (A) e bossabilities.js (BA); este módulo decide QUAL lista, QUANTO dano e QUANDO a fase muda.
// A barra de vida é a nativa (componente minecraft:boss, 1 por entidade, some sozinha na morte).
// Desempenho: 1 laço a cada 20 ticks só perto de jogadores; minions têm limite por chefe e tempo de vida; nada roda sem jogador por perto.
import { world, system, Player } from "@minecraft/server";
import { emit, EV } from "../core/bus.js";
import { PROFILES } from "../data/bossprofiles.js";
import { MOBS } from "../data/mobs.gen.js";
import { isValid, say, toast, playSound, heal, healthComp, rand } from "../core/utils.js";
import { ctx, burst, ringFlat, column, T } from "./fxlib.js";
import { SOUNDS } from "../config.js";

const SCAN = 20, FAR_HEAL_AFTER = 60, MINION_LIFE = 1800, EAT_RANGE = 4.2, FEED_RANGE = 16, MAX_LIVE = 6, SOFT_ENRAGE = 7200;
const live = new Map();          // bossId -> estado
export const keyOf = (e) => { try { return e.typeId.slice(8); } catch { return ""; } };
export const profileOf = (e) => PROFILES[keyOf(e)];
export const stateOf = (e) => live.get(e.id);
const near = (e, r, pos) => { try { return e.dimension.getPlayers({ location: pos ?? e.location, maxDistance: r }).filter((p) => { const g = p.getGameMode?.(); return g !== "creative" && g !== "spectator"; }); } catch { return []; } };
const eff = (en, id, ticks, amp = 0, show = false) => { try { en.addEffect(id, ticks, { amplifier: amp, showParticles: show }); } catch { /* ignore */ } };
const ratio = (e) => { const h = healthComp(e); return h && h.effectiveMax > 0 ? h.currentValue / h.effectiveMax : 1; };
const eye = (e) => ({ x: e.location.x, y: e.location.y + 1.5, z: e.location.z });
const maxHp = (e) => healthComp(e)?.effectiveMax ?? 0;

// 6.23: chefes de tier >= 3 (Guy, Milim, Dragões Verdadeiros) limpam as travas que facilitam a luta (levitação, lentidão forte, fraqueza, náusea...)
// — exceto a própria lentidão da transformação (tag tdr_busy/chr_busy). Tier 1-2 só ignoram levitação.
const CLEAN_T3 = ["levitation", "blindness", "nausea", "mining_fatigue", "weakness"], CLEAN_T1 = ["levitation"];
function cleanse(b) {
  const e = b.e, tier = b.p.rank ?? b.p.tier ?? 1; if (tier < 2) return;
  try {
    for (const id of tier >= 3 ? CLEAN_T3 : CLEAN_T1) { if (e.getEffect(id)) e.removeEffect(id); }
    if (tier >= 3 && !e.hasTag("tdr_busy") && !e.hasTag("chr_busy")) { const sl = e.getEffect("slowness"); if (sl && sl.amplifier >= 1 && sl.amplifier < 100) { e.removeEffect("slowness"); eff(e, "slowness", 40, 0); } }
  } catch { /* ignore */ }
}
/** aura contínua na cor de identidade do chefe (Milim rosa, Guy vermelho, cada dragão a sua) — barata: 1 anel + 1 rajada a cada ~3 s, só com jogador por perto */
function aura(b, now, ps) {
  const col = b.p.aura; if (!col || now < (b.auraAt ?? 0)) return;
  b.auraAt = now + 60;
  try { const c = ctx(ps[0], 1, b.e.dimension), e = b.e; ringFlat(c, e.location, { col, n: 8 + b.phase * 3, radius: 2 + b.phase * 0.7, life: 0.9, tile: T.ring }); burst(c, eye(e), { col, n: 4 + b.phase * 2, up: 1.2, spd: 0.7 }); } catch { /* ignore */ }
}

function register(e) {
  if (!isValid(e)) return undefined;
  if (live.has(e.id)) return live.get(e.id);
  const p = profileOf(e); if (!p || live.size >= MAX_LIVE) return undefined;
  const b = { e, id: e.id, dim: e.dimension, pos: { ...e.location }, p, phase: 0, level: 1, xp: 0, eatAt: 0, lastNear: system.currentTick, startAt: system.currentTick, intro: false, fx: [], fxAdded: false, shield: false, soft: false, final: false };
  try { if (e.hasTag("etheria_fight")) b.intro = true; else e.addTag("etheria_fight"); } catch { /* ignore */ }
  try { for (const t of e.getTags()) { const m = /^etheria_evo_(\d)$/.exec(t); if (m && p.evo) { b.level = Math.min(p.evo.xp.length, +m[1]); b.xp = p.evo.xp[b.level - 1] ?? 0; } } } catch { /* ignore */ }
  live.set(e.id, b); return b;
}

// ---- consultas usadas por mobai.js / bossabilities.js
export const phaseData = (e) => { const b = live.get(e.id); return b ? b.p.phases[b.phase] : undefined; };
export const phaseIdx = (e) => live.get(e.id)?.phase ?? 0;
export const evoLevel = (e) => live.get(e.id)?.level ?? 1;
export const dmgMul = (e) => { const b = live.get(e?.id); if (!b) return 1; return (b.p.phases[b.phase]?.dmg ?? 1) * (1 + 0.06 * (b.level - 1)); };
export const gcdMul = (e) => { const b = live.get(e?.id); if (!b) return 1; return (b.p.phases[b.phase]?.gcd ?? 1) * (1 - 0.04 * (b.level - 1)); };
/** lista de habilidades do chefe agora: base da fase + desbloqueios de evolução (+ golpe exclusivo nas fases 2+ dos dragões) */
export function bossAbilities(e, base) {
  const b = live.get(e.id); if (!b) return base;
  const ph = b.p.phases[b.phase]; let list = ph.list.length ? ph.list.slice() : (base ?? []).slice();
  if (b.p.dragon && b.phase >= 1) list = (b.p.sig ?? []).concat(list);
  for (let l = 2; l <= b.level; l++) for (const id of b.p.evo?.abilities[l] ?? []) if (!list.includes(id)) list.unshift(id);
  return list;
}

// ---- minions (limite por chefe + vida limitada + limpeza)
export function minionsOf(e) { try { return e.dimension.getEntities({ tags: [`own_${e.id}`], location: e.location, maxDistance: 80 }).filter(isValid); } catch { return []; } }
export function spawnMinions(e, type, n, cap) {
  const have = minionsOf(e).length, room = Math.max(0, Math.min(n, cap - have)); let made = 0;
  const b = live.get(e.id), ph = b?.p.phases[b.phase];
  for (let i = 0; i < room; i++) {
    const a = (i / Math.max(1, room)) * Math.PI * 2 + rand(0, 0.6), r = rand(3, 5.5), loc = { x: e.location.x + Math.cos(a) * r, y: e.location.y + 0.2, z: e.location.z + Math.sin(a) * r };
    try {
      const m = e.dimension.spawnEntity(type, loc); m.addTag("etheria_minion"); m.addTag(`own_${e.id}`); made++;
      for (const [id, amp] of ph?.fx ?? []) if (id === "speed" || id === "strength") eff(m, id, 2400, Math.max(0, amp - 1));
      system.runTimeout(() => { try { if (isValid(m)) { burst(ctx(undefined, 1, m.dimension), m.location, { col: "dust", n: 4, up: 1 }); m.remove(); } } catch { /* ignore */ } }, MINION_LIFE);
    } catch { /* espaço ocupado: tenta no próximo ciclo */ }
  }
  return made;
}
/** limpa os súditos pela última posição conhecida (na morte a entidade do chefe pode já não responder) */
function clearMinions(b) {
  let list = [];
  try { list = b.dim.getEntities({ tags: [`own_${b.id}`], location: b.pos, maxDistance: 96 }); } catch { list = []; }
  for (const m of list) { try { burst(ctx(undefined, 1, m.dimension), m.location, { col: "dust", n: 4, up: 1 }); m.remove(); } catch { /* ignore */ } }
}

// ---- fases
function enterPhase(b, idx) {
  const ph = b.p.phases[idx], e = b.e; b.phase = idx;
  for (const id of b.fx) { try { e.removeEffect(id); } catch { /* ignore */ } } b.fx = [];
  for (const [id, amp] of ph.fx) { eff(e, id, 20000000, amp - 1); b.fx.push(id); }
  { const rk = b.p.rank ?? b.p.tier ?? 1; if (rk >= 2 && !ph.fx.some((f) => f[0] === "resistance")) { eff(e, "resistance", 20000000, [0, 0, 0, 1, 1, 2][Math.min(5, rk)]); b.fx.push("resistance"); } }   // 6.23/6.28: defesa base pela categoria (rank)
  if (b.p.evo) applyEvo(b);
  b.fxAdded = true;
  if (idx > 0) {
    const pl = near(e, 64);
    for (const p of pl) { if (ph.msg) say(p, ph.msg); toast(p, `${b.p.color}§l${b.p.name}`, `§7Fase ${idx + 1}: §f${ph.name}`); playSound(p, SOUNDS.boss, 1, Math.max(0.5, 1.15 - idx * 0.15)); }
    try { const c = ctx(pl[0], 1.4, e.dimension); ringFlat(c, e.location, { col: "fire", n: 28, radius: 7, life: 0.7 }); column(c, e.location, { col: "fire", n: 14, h: 6 }); burst(c, eye(e), { col: "dust", n: 18, spd: 2 }); } catch { /* ignore */ }
    for (const m of minionsOf(e)) for (const [id, amp] of ph.fx) if (id === "speed" || id === "strength") eff(m, id, 2400, Math.max(0, amp - 1));
  }
}

// ---- Orc do Desastre: devorar e evoluir (4 níveis no máximo, XP por criatura limitado, 1 devoração a cada 2,5 s)
function applyEvo(b) {
  const e = b.e, L = b.level, ph = b.p.phases[b.phase], fxAmp = (id) => ph.fx.find((f) => f[0] === id)?.[1] ?? 0;
  try { e.setProperty("etheria:evo", L - 1); } catch { /* ignore */ }
  try { for (const t of e.getTags()) if (t.startsWith("etheria_evo_")) e.removeTag(t); e.addTag(`etheria_evo_${L}`); } catch { /* ignore */ }
  if (L >= 2) { eff(e, "strength", 20000000, Math.max(fxAmp("strength") - 1, L - 2)); eff(e, "health_boost", 20000000, L - 2); }
  if (L >= 3) eff(e, "resistance", 20000000, Math.max(fxAmp("resistance") - 1, L >= 4 ? 1 : 0));
  if (L >= 4) eff(e, "speed", 20000000, Math.max(1, fxAmp("speed") - 1));
}
export function feed(b, value, name) {
  const evo = b?.p.evo; if (!evo || !isValid(b.e)) return false;
  const v = Math.max(1, Math.min(evo.each, Math.round(value))), top = evo.xp.length;
  heal(b.e, Math.min(maxHp(b.e) * evo.healPct, v * 2));
  if (b.level >= top) { try { burst(ctx(undefined, 1, b.e.dimension), eye(b.e), { col: "fire", n: 5, spd: 1.2, up: 1 }); } catch { /* ignore */ } return true; }   // nível máximo: só cura
  b.xp = Math.min(evo.xp[top - 1], b.xp + v);
  let L = 1; for (let i = 0; i < top; i++) if (b.xp >= evo.xp[i]) L = i + 1;
  const up = L > b.level;
  try { burst(ctx(undefined, 1, b.e.dimension), eye(b.e), { col: up ? "fire" : "blood", n: up ? 22 : 8, spd: 1.6, up: 1 }); } catch { /* ignore */ }
  for (const p of near(b.e, 40)) {
    say(p, `${b.p.color}[${b.p.name}] §7devorou §f${name}${up ? "" : ` §8(${b.xp}/${evo.xp[Math.min(top - 1, b.level)]})`}`);
    if (up) { toast(p, `${b.p.color}§l${b.p.name}`, `§cEvoluiu! Nível ${L}`); playSound(p, SOUNDS.boss, 1, 1.4 - L * 0.1); say(p, `§c§l[!] §r§f${b.p.name} está ficando mais forte ao devorar criaturas! §7(Nível ${L}/${top})`); }
  }
  if (up) { b.level = L; applyEvo(b); }
  return true;
}
const NOEAT = /^etheria:(chronoa|veldora|velzard|velgrynd|veldanava|npc_)/;
function edible(en, b) {
  try {
    if (!isValid(en) || en.id === b.id || en instanceof Player) return false;
    if (en.hasTag("etheria_boss") || en.hasTag("etheria_fight") || en.hasTag("etheria_minion") || NOEAT.test(en.typeId)) return false;
    const f = en.getComponent("minecraft:type_family");
    if (f?.hasTypeFamily("etheria_boss") || f?.hasTypeFamily("npc")) return false;
    return !!(f?.hasTypeFamily("monster") || f?.hasTypeFamily("etheria_summon"));
  } catch { return false; }
}
const valueOf = (en) => MOBS[en.typeId]?.hp ?? maxHp(en) ?? 20;
function eatTick(b, now) {
  if (now < b.eatAt) return;
  let list; try { list = b.e.dimension.getEntities({ location: b.e.location, maxDistance: EAT_RANGE }); } catch { return; }
  for (const en of list) {
    if (!edible(en, b)) continue;
    const nm = MOBS[en.typeId]?.name ?? "uma criatura", v = valueOf(en);
    b.eatAt = now + 50;
    try { burst(ctx(undefined, 1, en.dimension), en.location, { col: "blood", n: 8, up: 1 }); en.remove(); } catch { continue; }
    feed(b, v, nm); return;
  }
}
function finalBlast(m) {   // fase final: súditos explodem ao morrer (pequeno; o limite de súditos já segura a quantidade)
  try { burst(ctx(undefined, 1, m.dimension), m.location, { col: "fire", n: 6, spd: 2, up: 1 }); for (const p of m.dimension.getPlayers({ location: m.location, maxDistance: 2.6 })) p.applyDamage(4, { cause: "entityExplosion" }); } catch { /* ignore */ }
}
// 6.54: quem entrou na luta (para o Grande Sábio e as conquistas) e quando cada jogador morreu pela última vez
const lastDeath = new Map();
function bossDeath(b) {
  live.delete(b.id);
  for (const [pid, at] of Object.entries(b.party ?? {})) {
    const p = world.getAllPlayers().find((x) => x.id === pid); if (!p) continue;
    try { emit(EV.BOSS_DEFEATED, { player: p, key: keyOf(b.e) || b.id, name: b.p.name, noDeath: !((lastDeath.get(pid) ?? -1) >= at) }); } catch { /* ignore */ }
  }
  try {
    let pl = []; try { pl = b.dim.getPlayers({ location: b.pos, maxDistance: 70 }); } catch { /* ignore */ }
    for (const p of pl) { say(p, `${b.p.color}§l[${b.p.name}] §r§7foi derrotado${b.p.evo && b.level > 1 ? ` §8(chegou ao nível ${b.level})` : ""}.`); try { p.playSound("random.explode", { volume: 1.2, pitch: 0.6 }); } catch { /* ignore */ } }
    const c = ctx(pl[0], 1.6, b.dim), loc = b.pos;
    ringFlat(c, loc, { col: "fire", n: 30, radius: 9, life: 0.9 }); column(c, loc, { col: "gold", n: 18, h: 8 }); burst(c, { x: loc.x, y: loc.y + 1.5, z: loc.z }, { col: "dust", n: 22, spd: 2.4, up: 1 });
  } catch { /* ignore */ }
  clearMinions(b);
}
/** criaturas mortas perto do Orc (por qualquer causa) também o alimentam; jogadores derrotados valem mais. Morte do chefe encerra tudo. */
function onAnyDeath(ev) {
  const d = ev.deadEntity; if (!d) return;
  let id; try { id = d.id; } catch { return; }
  try { if (d.typeId === "minecraft:player") lastDeath.set(id, system.currentTick); } catch { /* ignore */ }
  const own = live.get(id); if (own) { bossDeath(own); return; }
  let isMinion = false, loc, dimId;
  try { isMinion = d.hasTag("etheria_minion"); loc = d.location; dimId = d.dimension.id; } catch { return; }
  for (const b of live.values()) {
    if (!isValid(b.e) || dimId !== b.dim.id) continue;
    if (isMinion) { try { if (b.final && d.hasTag(`own_${b.id}`)) finalBlast(d); } catch { /* ignore */ } continue; }
    if (!b.p.evo) continue;
    const dx = loc.x - b.pos.x, dz = loc.z - b.pos.z; if (dx * dx + dz * dz > FEED_RANGE * FEED_RANGE) continue;
    if (d instanceof Player) feed(b, 150, d.name);
    else if (edible(d, b) || (() => { try { return d.getComponent("minecraft:type_family")?.hasTypeFamily("monster"); } catch { return false; } })()) feed(b, valueOf(d), MOBS[d.typeId]?.name ?? "uma criatura");
  }
}

// ---- laço principal (a cada 20 ticks, só perto de jogadores)
function tick() {
  const now = system.currentTick;
  for (const pl of world.getAllPlayers()) {
    let es; try { es = pl.dimension.getEntities({ location: pl.location, maxDistance: 64, families: ["etheria_boss"] }); } catch { continue; }
    for (const e of es) if (e.typeId.startsWith("etheria:") && PROFILES[keyOf(e)]) register(e);
  }
  for (const [id, b] of live) {
    const e = b.e;
    if (!isValid(e)) { live.delete(id); clearMinions(b); continue; }   // sumiu (despawn/descarregou): súditos não ficam órfãos
    try { b.pos = { ...e.location }; b.dim = e.dimension; } catch { /* ignore */ }
    const r = ratio(e); let idx = b.phase; b.p.phases.forEach((p, i) => { if (r <= p.hp && i > idx) idx = i; });
    const ps = near(e, 48);
    b.party ??= {};
    for (const p of ps) if (b.party[p.id] === undefined) {
      b.party[p.id] = now;
      try { emit(EV.BOSS_ENCOUNTER, { player: p, key: keyOf(e), name: b.p.name, hp: e.getComponent("minecraft:health")?.currentValue, maxHp: maxHp(e), phase: b.phase, mech: b.p.mech }); } catch { /* ignore */ }
    }
    if (ps.length && !b.intro) { b.intro = true; for (const p of ps) { say(p, b.p.intro); toast(p, `${b.p.color}§l${b.p.name}`, `§7${b.p.mech.split(";")[0]}`); playSound(p, SOUNDS.boss, 1, 0.8); } }
    if (!b.fxAdded || idx !== b.phase) enterPhase(b, idx);
    b.final = idx === b.p.phases.length - 1 && !!b.p.minion;
    if (ps.length) { b.lastNear = now; cleanse(b); aura(b, now, ps); }
    else { if (now - b.lastNear > FAR_HEAL_AFTER * 20) heal(e, maxHp(e) * 0.02); continue; }   // ninguém por perto: regenera e não age (evita atacar de longe e fugir)
    if (b.p.evo) eatTick(b, now);
    if (b.p.minion) {   // Escudo de Carne: com 3+ súditos ao redor o chefe resiste; derrotá-los remove a proteção
      const n = minionsOf(e).filter((m) => { const dx = m.location.x - e.location.x, dz = m.location.z - e.location.z; return dx * dx + dz * dz < 100; }).length;
      if (n >= 3) { eff(e, "resistance", 50, 0); if (!b.shield) { b.shield = true; for (const p of ps) say(p, `${b.p.color}§o Os súditos protegem o chefe: derrote-os primeiro!`); } } else b.shield = false;
    }
    if (!b.soft && now - b.startAt > SOFT_ENRAGE) { b.soft = true; eff(e, "strength", 20000000, 3); for (const p of ps) say(p, "§c§l[!] §rA luta se arrasta: o chefe perdeu a paciência (dano maior)."); }
  }
}

export function bossLive() { return [...live.values()].filter((b) => isValid(b.e)); }
export function startBossFight() {
  world.afterEvents.entityDie.subscribe((ev) => { try { onAnyDeath(ev); } catch { /* ignore */ } });
  world.afterEvents.entitySpawn.subscribe((ev) => { const e = ev.entity; try { if (e?.typeId?.startsWith("etheria:") && PROFILES[keyOf(e)]) system.run(() => register(e)); } catch { /* ignore */ } });
  system.runInterval(tick, SCAN);
}

// systems/skills.js - Aprender, equipar e lançar habilidades (executor orientado a dados)
import { isCinematic } from "./cinematic.js";
import { queueSkillAnnounce } from "./sagecore.js";
import { system, Player, ItemStack } from "@minecraft/server";
import { COMBAT, MAX_SLOTS, AUTO_EQUIP, ALLY_TAG, SOUNDS, SKILLBAR } from "../config.js";
import { getData, markDirty, saveNow, onSave } from "../core/db.js";
import { emit, EV } from "../core/bus.js";
import { EquippedSkillManager } from "./skillbar/equipped.js";
import { isSpecial } from "./skillbar/registry.js";
import { addMastery, masteryPower, masteryLevel } from "./mastery.js";
import { playSkillFx } from "./skillfx.js";
import { add, norm, dot, sub, dist, heal, healthComp, isValid, say, playSound, chance } from "../core/utils.js";
import { SKILLS } from "../data/skills.js";
import { getStats, applyDerivedStats } from "./stats.js";
import { addBuff, hasBuff } from "./effects.js";
import { fx, line, ring } from "./fx.js";
import { dealDamage, isValidTarget, markCombat, inCombat } from "./combat.js";
import { sageSay, skillSay, sysSay } from "./voice.js";
import { maybeAwaken } from "./discovery.js";
import { learn, observeSpell } from "./sageknow.js";
import { stageSpec, runStaged } from "./spellstage.js";

const cooldowns = new Map(); // playerId -> Map(key -> readyTick)
const summons = new Map();   // playerId -> [entities]
let cdHook = null;           // (player, skillId, ticks) => void : a hotbar usa para mostrar a recarga no slot

export function cdLeft(player, key) {
  const t = cooldowns.get(player.id)?.get(key) ?? 0;
  return Math.max(0, (t - system.currentTick) / 20);
}
export function setCdHook(fn) { cdHook = fn; }
function setCd(player, key, seconds) {
  let m = cooldowns.get(player.id); if (!m) { m = new Map(); cooldowns.set(player.id, m); }
  const ticks = Math.floor(seconds * 20);
  m.set(key, system.currentTick + ticks);
  if (key !== "w" && ticks > 0 && cdHook) { try { cdHook(player, key, ticks); } catch (e) { console.warn(`[Etheria] gancho de recarga ${key}: ${e}`); } }
}
/** Recargas ativas do jogador: [{ id, left }] (segundos). Não inclui a recarga interna das armas ("w"). */
export function listCooldowns(player) {
  const out = [], m = cooldowns.get(player.id); if (!m) return out;
  for (const k of m.keys()) { if (k === "w") continue; const left = cdLeft(player, k); if (left > 0) out.push({ id: k, left }); }
  return out;
}
/** Recargas persistem entre sessões (instante real em que ficam prontas), assim não dá para "zerar" saindo e entrando. */
onSave((player, d) => {
  const out = {}, wall = Date.now();
  for (const { id, left } of listCooldowns(player)) if (left > 1) out[id] = Math.floor(wall + left * 1000);
  d.cd = out;
});
export function restoreCooldowns(player) {
  const d = getData(player), wall = Date.now();
  for (const [k, at] of Object.entries(d.cd ?? {})) {
    const left = (at - wall) / 1000;
    if (left > 0.5 && SKILLS[k] && cdLeft(player, k) < left) setCd(player, k, left);
  }
}
export function dropSkillState(id) {
  try { casting.get(id)?.handle?.cancel?.("saiu"); } catch { /* ignore */ }
  casting.delete(id); cooldowns.delete(id); summons.delete(id); noteState.delete(id);
}

// ------------------------------------------------------------ aprender / equipar
const EXTRA = {};
export function registerExec(kind, fn) { EXTRA[kind] = fn; }
const POST = [];
export function registerPost(fn) { POST.push(fn); }
export const helpers = () => ({ aim, around, hitOne, mark, push });
export function hasSkill(d, id) { return d.unlockedSkills.includes(id); }
export function canLearn(d, sk) {
  if (hasSkill(d, sk.id)) return "Já aprendida";
  if (d.level < sk.level) return `Requer nível ${sk.level}`;
  if (d.skillPoints < sk.sp) return `Requer ${sk.sp} ponto(s) de habilidade`;
  for (const r of sk.req ?? []) if (!hasSkill(d, r)) return `Requer ${SKILLS[r]?.name ?? r}`;
  return null;
}
export function learnSkill(player, id) {
  const d = getData(player), sk = SKILLS[id];
  if (!sk || sk.sp <= 0) return { ok: false, msg: "Habilidade inválida." };
  const why = canLearn(d, sk);
  if (why) return { ok: false, msg: why };
  d.skillPoints -= sk.sp;
  grantSkill(player, id);
  playSound(player, SOUNDS.learn, 1, 1);
  sageSay(player, "skill_acquired"); sageSay(player, "skill_registered");
  applyDerivedStats(player); saveNow(player);
  return { ok: true, msg: `Aprendeu ${sk.name}!` };
}
export function grantSkill(player, id, opts = {}) {
  const d = getData(player), sk = SKILLS[id];
  if (!sk || hasSkill(d, id)) return;
  d.unlockedSkills.push(id); try { queueSkillAnnounce(player, id); } catch { /* ignore */ }
  try { learn(player, sk.cat === "Magia" ? "magic" : "skills", id, sk.name, {}, true); } catch { /* ignore */ }
  markDirty(player);
  emit(EV.SKILL_LEARNED, { player, id });
  // Ativas viram item na hotbar (até AUTO_EQUIP automaticamente; o resto o jogador equipa pelo menu). Nunca desloca item existente.
  if (!opts.noEquip && sk.type === "active" && d.equippedSkills.length < Math.min(AUTO_EQUIP, MAX_SLOTS)) {
    try { EquippedSkillManager.equip(player, id, { silent: true }); } catch (e) { console.warn(`[Etheria] auto-equipar ${id}: ${e}`); }
  }
}
/** Compatibilidade: `slot` é a POSIÇÃO na lista de equipadas (ordem do lançar rápido). A posição no inventário é livre (sem deslocar itens). */
export function equipSkill(player, id, slot) {
  const d = getData(player);
  if (d.equippedSkills.includes(id)) {   // já equipada: só reordena a lista
    const list = d.equippedSkills.filter((x) => x !== id); list.splice(Math.max(0, Math.min(slot ?? list.length, list.length)), 0, id);
    d.equippedSkills = list; markDirty(player); return true;
  }
  const r = EquippedSkillManager.equip(player, id, { order: slot });
  if (!r.ok) say(player, `§c${r.msg}`);
  return r.ok;
}
export function unequipSkill(player, id) { return EquippedSkillManager.unequip(player, id).ok; }

// ------------------------------------------------------------ mira e alvos
function aim(player, range) {
  const head = player.getHeadLocation(), dir = player.getViewDirection();
  let point = add(head, dir, range), target, best = range;
  try {
    for (const h of player.getEntitiesFromViewDirection({ maxDistance: range })) {
      if (!isValidTarget(h.entity, player)) continue;
      target = h.entity; best = h.distance;
      point = { x: target.location.x, y: target.location.y + 0.8, z: target.location.z };
      break;
    }
  } catch { /* ignore */ }
  try {
    const b = player.getBlockFromViewDirection({ maxDistance: range });
    if (b) {
      const p = { x: b.block.location.x + b.faceLocation.x, y: b.block.location.y + b.faceLocation.y, z: b.block.location.z + b.faceLocation.z };
      if (dist(head, p) < best) { point = p; target = undefined; }
    }
  } catch { /* ignore */ }
  return { head, dir, point, target };
}
function around(dim, center, radius, caster) {
  let list = [];
  try { list = dim.getEntities({ location: center, maxDistance: radius }); } catch { /* ignore */ }
  return list.filter((e) => isValidTarget(e, caster));
}
/** Durante a LIBERAÇÃO de uma magia em fases, golpes e empurrões entram nesta fila e só valem na CHEGADA do feitiço (ver castStaged). */
let DEFER = null;
function pushNow(e, from, strength, up = 0.3, inward = false) {
  try {
    let dx = e.location.x - from.x, dz = e.location.z - from.z;
    if (inward) { dx = -dx; dz = -dz; }
    const l = Math.hypot(dx, dz) || 1;
    e.applyKnockback(dx / l, dz / l, strength, up);
  } catch { /* ignore */ }
}
function push(e, from, strength, up = 0.3, inward = false) {
  if (DEFER) { DEFER.push({ e, run: () => pushNow(e, from, strength, up, inward) }); return; }
  pushNow(e, from, strength, up, inward);
}

// ------------------------------------------------------------ dano
function skillDamage(player, sk, s, mult = 1) {
  const ex = sk.exec;
  const statKey = { strength: "str", intelligence: "int", agility: "agi", defense: "def" }[ex.stat ?? "intelligence"] ?? "int";
  const base = (ex.power ?? 1) * masteryPower(player, sk.id) * (COMBAT.skill_base + s[statKey] + s.level * COMBAT.skill_lvl + s.atk * 0.2) * mult;
  let dmg = base * (1 + (s.elem[sk.element] ?? 0) / 100);
  let crit = false;
  if (chance(s.crit / 100)) { dmg *= s.critDmg / 100; crit = true; }
  return { dmg, crit };
}
function hitOne(player, e, sk, s, mult = 1) {
  if (DEFER) { DEFER.push({ e, hit: true, run: () => hitNow(player, e, sk, s, mult) }); return { dmg: 0, crit: false, deferred: true }; }
  return hitNow(player, e, sk, s, mult);
}
const HIT_GUARDS = [];
/** ganchos para sistemas que interceptam o golpe de uma habilidade (Predador absorvendo, Anti-Skill anulando...). Cada gancho devolve:
 *  true = golpe anulado/absorvido (sem dano) | número < 1 = golpe parcialmente resistido (dano x número e sem efeitos secundários) | falso = nada. */
export function setHitGuard(fn) { if (!HIT_GUARDS.includes(fn)) HIT_GUARDS.push(fn); }
let CAST_GUARD = null, COST_MOD = null;
/** gancho de lançamento: devolve texto = bloqueado (ex.: Selo Anti-Skill); falso = livre */
export function setCastGuard(fn) { CAST_GUARD = fn; }
/** gancho de custo: devolve multiplicador do custo de mana (>= 1 encarece) */
export function setCostMod(fn) { COST_MOD = fn; }
function hitNow(player, e, sk, s, mult = 1) {
  let resist = 1;
  for (const g of HIT_GUARDS) {
    try { const r = g(player, e, sk); if (r === true) return { dmg: 0, crit: false, absorbed: true }; if (typeof r === "number" && r < resist) resist = r; } catch { /* ignore */ }
  }
  const { dmg, crit } = skillDamage(player, sk, s, mult * resist);
  dealDamage(player, e, dmg);
  const ex = sk.exec;
  if (resist < 1) { return { dmg, crit, resisted: true }; }    // parcialmente resistido: dano reduzido, sem efeitos secundários
  if (ex.burn) { try { e.setOnFire(ex.burn, true); } catch { /* ignore */ } }
  if (ex.debuff) addBuff(e, ex.debuff.id, ex.debuff.sec, { src: player, dot: ex.debuff.id === "bleed" ? 1.5 + dmg * 0.1 : undefined });
  if (ex.drain) heal(player, dmg * ex.drain);
  if (s.lifesteal > 0) heal(player, dmg * s.lifesteal / 100);
  fx(e.dimension, { x: e.location.x, y: e.location.y + 1, z: e.location.z }, sk.element, player);
  return { dmg, crit };
}

/** Aliados invocados com mobs do addon não têm "dono" nativo: a cada 1,5 s trazem de volta quem se afastou demais ou ficou em outra dimensão. */
function leash(player, born, sec) {
  let n = 0; const total = Math.ceil((sec * 20) / 30);
  const id = system.runInterval(() => {
    n++;
    const alive = born.filter(isValid);
    if (!alive.length || !isValid(player) || n > total) { system.clearRun(id); return; }
    for (const e of alive) {
      try {
        if (e.dimension.id !== player.dimension.id || dist(e.location, player.location) > 16) {
          e.teleport({ x: player.location.x + (Math.random() - 0.5) * 3, y: player.location.y, z: player.location.z + (Math.random() - 0.5) * 3 }, { dimension: player.dimension });
        }
      } catch { /* ignore */ }
    }
  }, 30);
}

// ------------------------------------------------------------ executores
let LAST = null;
const mark = (from, to, at) => { LAST = { from, to, at: at ?? to }; };
const EXEC = {
  projectile(player, sk, s) {
    const ex = sk.exec, a = aim(player, ex.range);
    mark(a.head, a.point);
    const list = ex.radius > 0 ? around(player.dimension, a.point, ex.radius, player) : (a.target ? [a.target] : []);
    for (const e of list) hitOne(player, e, sk, s);
    return true;
  },
  target_aoe(player, sk, s) {
    const ex = sk.exec, a = aim(player, ex.range);
    mark(a.head, a.point);
    for (const e of around(player.dimension, a.point, ex.radius, player)) { hitOne(player, e, sk, s); if (ex.pull) push(e, a.point, ex.pull, 0.2, true); }
    if (ex.heal) {
      for (const p of player.dimension.getPlayers({ location: a.point, maxDistance: ex.radius })) { heal(p, ex.heal); fx(p.dimension, p.location, "heal", player); }
    }
    return true;
  },
  aoe_self(player, sk, s) {
    const ex = sk.exec, c = player.location;
    mark(c, c, c);
    for (const e of around(player.dimension, c, ex.radius, player)) { hitOne(player, e, sk, s); if (ex.knock) push(e, c, ex.knock); }
    return true;
  },
  cone(player, sk, s) {
    const ex = sk.exec, c = player.location, dir = norm(player.getViewDirection());
    const cosA = Math.cos((ex.angle / 2) * Math.PI / 180);
    const head = player.getHeadLocation();
    mark(head, add(head, dir, ex.range));
    for (const e of around(player.dimension, c, ex.range + 1, player)) {
      const v = sub({ x: e.location.x, y: e.location.y + 1, z: e.location.z }, head);
      const l = Math.hypot(v.x, v.y, v.z) || 1;
      if (l > ex.range + 1) continue;
      if (dot(norm(v), dir) < cosA) continue;
      hitOne(player, e, sk, s); if (ex.knock) push(e, c, ex.knock);
    }
    return true;
  },
  beam(player, sk, s) {
    const ex = sk.exec, head = player.getHeadLocation(), dir = norm(player.getViewDirection());
    const end = add(head, dir, ex.range);
    mark(head, end);
    const hits = [];
    for (const e of around(player.dimension, add(head, dir, ex.range / 2), ex.range / 2 + 2, player)) {
      const v = sub({ x: e.location.x, y: e.location.y + 1, z: e.location.z }, head);
      const t = dot(v, dir);
      if (t < 0 || t > ex.range) continue;
      const perp = Math.hypot(v.x - dir.x * t, v.y - dir.y * t, v.z - dir.z * t);
      if (perp <= ex.width + 0.6) hits.push({ e, t });
    }
    hits.sort((a, b) => a.t - b.t);
    for (const h of ex.pierce ? hits : hits.slice(0, 1)) hitOne(player, h.e, sk, s);
    return true;
  },
  chain(player, sk, s) {
    const ex = sk.exec, a = aim(player, ex.range);
    if (!a.target) return "Sem alvo na mira.";
    mark(a.head, { x: a.target.location.x, y: a.target.location.y + 1, z: a.target.location.z });
    const hit = new Set(); let cur = a.target, from = a.head, mult = 1;
    for (let i = 0; i < ex.jumps && cur; i++) {
      hit.add(cur.id);
      const p = { x: cur.location.x, y: cur.location.y + 1, z: cur.location.z };
      line(player.dimension, from, p, sk.element, player); hitOne(player, cur, sk, s, mult);
      mult *= 0.9; from = p;
      cur = around(player.dimension, cur.location, ex.jumpRange, player).filter((e) => !hit.has(e.id))[0];
    }
    return true;
  },
  heal(player, sk, s) {
    const ex = sk.exec, amount = ex.amount + s.int * (ex.scale ?? 0.5); mark(player.location, player.location, player.location);
    for (const p of player.dimension.getPlayers({ location: player.location, maxDistance: ex.radius })) {
      heal(p, amount); fx(p.dimension, p.location, "heal", player, p === player ? 2 : 1);
    }
    return true;
  },
  buff(player, sk, s) {
    const ex = sk.exec;
    mark(player.location, player.location, player.location);
    addBuff(player, ex.buff.id, ex.sec, { stats: ex.buff.stats, name: sk.name });
    if (ex.absorb) { try { player.addEffect("absorption", ex.sec * 20, { amplifier: ex.absorb - 1, showParticles: false }); } catch { /* ignore */ } }
    fx(player.dimension, player.location, sk.element, player, 2); ring(player.dimension, player.location, 1.2, sk.element, player);
    applyDerivedStats(player);
    return true;
  },
  dash(player, sk, s, d) {
    const ex = sk.exec, v = player.getViewDirection(), dir = norm({ x: v.x, y: 0, z: v.z });
    const start = player.location, end = add(start, dir, ex.power);
    try { player.applyKnockback(dir.x, dir.z, ex.power * 0.4, 0.15); } catch { /* ignore */ }
    mark(start, end);
    if (ex.damage) {
      for (const e of around(player.dimension, add(start, dir, ex.power / 2), ex.power / 2 + 1.5, player)) hitOne(player, e, { ...sk, exec: { ...ex, power: ex.damage } }, s);
    }
    if (d.stamina >= (sk.stamina ?? 0)) d.stamina -= sk.stamina ?? 0;
    return true;
  },
  teleport(player, sk) {
    const ex = sk.exec, a = aim(player, ex.range);
    const dir = norm(player.getViewDirection());
    let dest = a.point;
    if (a.target || dist(a.head, a.point) < ex.range - 0.5) dest = add(a.point, dir, -1.0);
    dest = { x: dest.x, y: dest.y + 0.1, z: dest.z };
    const from = player.location;
    mark(from, dest);
    try { player.teleport(dest, { checkForBlocks: true, keepVelocity: false }); } catch { return "Destino inválido."; }
    return true;
  },
  summon(player, sk) {
    const ex = sk.exec, count = Math.max(1, ex.count ?? 1), cap = Math.max(2, ex.cap ?? 2, count);
    const list = (summons.get(player.id) ?? []).filter(isValid);
    // o limite de aliados vale para o conjunto: os mais antigos saem para dar lugar aos novos (com count=1 e cap=2 é o comportamento de sempre)
    while (list.length > cap - count) { const old = list.shift(); try { old.remove(); } catch { try { old.kill(); } catch { /* ignore */ } } }
    const custom = String(ex.entity).startsWith("etheria:"), born = [], dir = norm(player.getViewDirection());
    for (let i = 0; i < count; i++) {
      const a = 0.7 + (i * Math.PI * 2) / count;
      const spot = count === 1 ? add(player.location, dir, 2) : { x: player.location.x + Math.cos(a) * 2.6, y: player.location.y, z: player.location.z + Math.sin(a) * 2.6 };
      let e;
      try { e = player.dimension.spawnEntity(ex.entity, spot); } catch { if (!born.length) return "Não foi possível invocar aqui."; break; }
      try { e.nameTag = ex.name; e.addTag(ALLY_TAG); e.getComponent("minecraft:tameable")?.tame(player); } catch { /* ignore */ }
      if (custom) { try { e.triggerEvent("etheria:ally"); } catch { /* ignore */ } }   // mobs do addon: deixa de atacar o dono e passa a atacar monstros
      try { e.addEffect("strength", ex.sec * 20, { amplifier: 2, showParticles: false }); e.addEffect("resistance", ex.sec * 20, { amplifier: 1, showParticles: false }); e.addEffect("speed", ex.sec * 20, { amplifier: 1, showParticles: false }); } catch { /* ignore */ }
      born.push(e); list.push(e);
    }
    mark(player.location, born[0].location, born[0].location);
    summons.set(player.id, list);
    if (custom) leash(player, born, ex.sec);
    system.runTimeout(() => { for (const e of born) if (isValid(e)) { fx(e.dimension, e.location, "arcane", player); try { e.remove(); } catch { try { e.kill(); } catch { /* ignore */ } } } }, ex.sec * 20);
    return true;
  },
};

// ------------------------------------------------------------ lançar
export const CAST = Object.freeze({ READY: "READY", COOLDOWN: "COOLDOWN", LOCKED: "LOCKED", NO_RESOURCE: "NO_RESOURCE", DISABLED: "DISABLED", NO_TARGET: "NO_TARGET", BUSY: "BUSY", ERROR: "ERROR" });

/** Custo real (mana/stamina) já com redução de custo e despertar. */
export function skillCost(player, sk, d = getData(player), s = getStats(player)) {
  let mod = 1; try { if (COST_MOD) mod = Math.max(1, COST_MOD(player, sk) || 1); } catch { /* ignore */ }
  return { mana: Math.ceil((sk.mana ?? 0) * (1 - s.manaCost / 100) * (d.awakened?.[sk.id] ? 0.8 : 1) * mod), stamina: sk.stamina ?? 0 };
}
/** Estados que impedem lançar (atordoamento etc.). null = livre. */
export function disabledReason(player) {
  try {
    if (hasBuff(player, "stun")) return "Você está atordoado.";
    if (hasBuff(player, "paralyze")) return "Você está paralisado.";
  } catch { /* ignore */ }
  return null;
}
/** Verifica TUDO antes de gastar qualquer coisa: desbloqueio -> estado -> recarga -> mana -> stamina. */
export function checkCast(player, id, o = {}) {
  const d = getData(player), sk = SKILLS[id];
  if (!sk || sk.type !== "active" || !hasSkill(d, id)) return { ok: false, state: CAST.LOCKED, msg: "Habilidade indisponível." };
  if (isCinematic(player)) return { ok: false, state: CAST.DISABLED, msg: "Transformação em andamento.", quiet: true };
  const dis = disabledReason(player); if (dis) return { ok: false, state: CAST.DISABLED, msg: dis };
  try { const blocked = CAST_GUARD ? CAST_GUARD(player, sk) : null; if (blocked) return { ok: false, state: CAST.DISABLED, msg: blocked }; } catch { /* ignore */ }
  const left = cdLeft(player, id);
  if (left > 0) return { ok: false, state: CAST.COOLDOWN, msg: `Recarga: ${left.toFixed(1)}s`, quiet: true, left };
  const s = getStats(player), cost = skillCost(player, sk, d, s);
  if (o.free) return { ok: true, state: CAST.READY, cost: { mana: 0, stamina: 0 }, d, s, sk };   // improvisação: o custo já foi pago pela habilidade que a chamou
  if (d.mana < cost.mana) return { ok: false, state: CAST.NO_RESOURCE, msg: `Mana insuficiente (${Math.floor(d.mana)}/${cost.mana}).`, resource: "mana", cost };
  if (cost.stamina && d.stamina < cost.stamina) return { ok: false, state: CAST.NO_RESOURCE, msg: "Stamina insuficiente.", resource: "stamina", cost };
  return { ok: true, state: CAST.READY, cost, d, s, sk };
}
/** Falas do Sábio por falha: no máximo 1 a cada `sageVoiceGap` ticks por jogador (sem spam de voz). */
const noteState = new Map();
export function noteCastFailure(player, r) {
  if (!r || r.ok) return;
  const now = system.currentTick, st = noteState.get(player.id) ?? { voice: -99999 };
  noteState.set(player.id, st);
  if (r.state === CAST.COOLDOWN || r.state === CAST.BUSY) return;   // a recarga já aparece no slot; conjuração em andamento é silenciosa
  if (now - st.voice < SKILLBAR.sageVoiceGap) return;
  st.voice = now;
  if (r.state === CAST.NO_RESOURCE) { sageSay(player, "no_mana"); sysSay(player, "magic", "dry", { cd: 1500 }); }
  else if (r.state === CAST.NO_TARGET) sageSay(player, "no_target");
}
/** Anúncio (voz) de uso: só habilidades especiais (Única/Suprema/Manas) ou se o jogador ligou "anunciar uso". */
export const announceAllowed = (player, d, sk) => isSpecial(sk.id) || !!d.settings?.skillbar?.announce;

// ------------------------------------------------------------ conjuração
const casting = new Map();   // playerId -> { id, handle }: uma conjuração em fases por jogador
export const isCasting = (player) => casting.has(player.id);
/** Interrompe a conjuração em andamento (morte, saída, troca de dimensão...). Devolve a mana. */
export function cancelCasting(player, reason = "interrompido") { try { return !!casting.get(player.id)?.handle?.cancel(reason); } catch { return false; } }

function executorFor(sk) {
  let fn = EXEC[sk.exec.kind];
  if (!fn && EXTRA[sk.exec.kind]) { const ex = EXTRA[sk.exec.kind]; fn = (pl, k, st, dd) => ex(pl, k, st, dd, { aim, around, hitOne, mark, push }); }
  return fn;
}
/** executor de uma habilidade (usado por habilidades montadas em tempo de execução, ex.: Criador) */
export const execFor = (sk) => executorFor(sk);
/** Maestria, anúncio de habilidade Única e bônus pós-uso (comum às conjurações instantâneas e em fases). */
function settle(player, id, sk, d) {
  const uni = sk.cat === "Única", ann = announceAllowed(player, d, sk), up = addMastery(player, id, uni ? 3 : 1);
  if (up) {
    say(player, `§d[Maestria] §f${sk.name} §dNv.${up}`); playSound(player, SOUNDS.learn, 0.6, 1.3);
    const ms = { 3: "m25", 5: "m50", 8: "m75", 10: "m100" }[up];
    if (uni && ms) skillSay(player, id, ms, { cd: 0 }); else if (up === 10 || up === 5) sageSay(player, "mastery_up");
    if (up >= 10) maybeAwaken(player, id);
  }
  if (uni && ann) { if (!skillSay(player, id, "act")) { /* cooldown */ } if (inCombat(player)) skillSay(player, id, "cmb"); }
}
/** Aplica a fila de golpes adiados: cada um no seu tempo (delayOf), só se conjurador e alvo ainda existirem. */
function applyQueue(player, queue, delayOf, onEach) {
  const seen = new Set();
  for (const h of queue) {
    const run = () => {
      if (!isValid(player) || !isValid(h.e)) return;
      try { h.run(); } catch (e) { console.warn(`[Etheria] golpe adiado: ${e}`); }
      if (h.hit && !seen.has(h.e.id)) { seen.add(h.e.id); try { onEach?.(h.e); } catch { /* ignore */ } }
    };
    let dly = 0; try { dly = Math.max(0, Math.round(delayOf?.(h.e) ?? 0)); } catch { dly = 0; }
    if (dly > 0) system.runTimeout(run, dly); else run();
  }
}

export function castSkill(player, id, opts = {}) {
  const chk = checkCast(player, id, opts);
  if (!chk.ok) { emit(EV.SKILL_FAILED, { player, id, state: chk.state, msg: chk.msg }); return chk; }
  const { d, s, sk, cost } = chk;
  const fn = executorFor(sk);
  if (!fn) return { ok: false, state: CAST.ERROR, msg: "Habilidade sem executor." };
  if (casting.has(player.id)) return { ok: false, state: CAST.BUSY, msg: "Conjurando...", quiet: true };
  const spec = opts.instant || d.settings?.skillbar?.staged === false ? null : stageSpec(sk);
  if (spec && sk.exec.kind === "chain" && !aim(player, sk.exec.range).target) {      // alvo obrigatório: não gasta nada nem faz formação à toa
    const res = { ok: false, state: CAST.NO_TARGET, msg: "Sem alvo na mira." }; emit(EV.SKILL_FAILED, { player, id, state: res.state, msg: res.msg }); return res;
  }
  return spec ? castStaged(player, id, { d, s, sk, cost }, spec, fn) : castInstant(player, id, { d, s, sk, cost }, fn);
}

/** Conjuração instantânea (golpes, investidas, sentidos... ou "Magias em fases" desligado): executa, mostra o visual e cobra tudo de uma vez. */
function castInstant(player, id, { d, s, sk, cost }, fn) {
  let r; LAST = null;
  const prev = DEFER; DEFER = null;
  try { r = fn(player, sk, s, d); } catch (e) { console.warn(`[Etheria] Erro em ${id}: ${e}`); return { ok: false, state: CAST.ERROR, msg: "Erro ao lançar." }; } finally { DEFER = prev; }
  if (r !== true) { const res = { ok: false, state: CAST.NO_TARGET, msg: r || "Falhou." }; emit(EV.SKILL_FAILED, { player, id, state: res.state, msg: res.msg }); return res; }
  for (const p of POST) { try { p(player, sk, s, d); } catch (e) { console.warn(`[Etheria] pós-exec ${id}: ${e}`); } }
  playSkillFx(player, sk, { pos: player.location, dir: norm(player.getViewDirection()), ...(LAST ?? {}) });
  d.mana -= cost.mana;
  settle(player, id, sk, d);
  setCd(player, id, sk.cd * (1 - s.cdr / 100));
  playSound(player, sk.exec.snd ?? SOUNDS.cast, 0.8, 1);
  if (sk.cat === "Magia" && announceAllowed(player, d, sk)) sysSay(player, "magic", "done", { cd: 3000 });
  observeSpell(player, id, player);
  markCombat(player); markDirty(player);
  emit(EV.SKILL_USED, { player, id, cost, sk });
  return { ok: true, state: CAST.READY, msg: sk.name };
}

/**
 * Conjuração em FASES. Sequência: requisitos (checkCast) -> COMPROMISSO (gasta recurso e inicia a recarga) -> FORMAÇÃO (animação/som/partículas)
 * -> LIBERAÇÃO (executor escolhe alvos; golpes ficam na fila) -> TRAJETO -> IMPACTO (dano e efeitos) -> UI -> evento para o Grande Sábio.
 * Interrompida (atordoar, morrer, trocar de dimensão) ou sem alvo na liberação: devolve a mana e deixa só 20% da recarga.
 */
function castStaged(player, id, { d, s, sk, cost }, spec, fn) {
  const startDim = player.dimension.id, cdSec = sk.cd * (1 - s.cdr / 100);
  d.mana -= cost.mana; setCd(player, id, cdSec); markDirty(player);
  const rec = { id, handle: null }; casting.set(player.id, rec);
  emit(EV.SKILL_CAST_START, { player, id, sk });
  const refund = () => {
    if (!isValid(player)) return;
    try { d.mana = Math.min(getStats(player).maxMana, d.mana + cost.mana); setCd(player, id, Math.max(0.5, cdSec * 0.2)); markDirty(player); } catch (e) { console.warn(`[Etheria] reembolso ${id}: ${e}`); }
  };
  const io = {
    guard: () => {
      if (!isValid(player)) return "saiu";
      try { const h = healthComp(player); if (h && h.currentValue <= 0) return "morreu"; } catch { /* ignore */ }
      try { if (player.dimension.id !== startDim) return "dimensão"; } catch { return "saiu"; }
      return disabledReason(player);
    },
    aimPoint: (range) => aim(player, range).point,
    execute: () => {
      casting.delete(player.id);                 // libera novas conjurações (e o improviso aninhado)
      const queue = []; let r, geo; const prev = DEFER; DEFER = queue; LAST = null;
      try { r = fn(player, sk, s, d); geo = LAST; }
      catch (e) { console.warn(`[Etheria] Erro em ${id}: ${e}`); return { ok: false, msg: "Erro ao lançar." }; }
      finally { DEFER = prev; }
      if (r !== true) return { ok: false, msg: typeof r === "string" ? r : "Falhou." };
      for (const p of POST) { try { p(player, sk, s, d); } catch (e) { console.warn(`[Etheria] pós-exec ${id}: ${e}`); } }
      return { ok: true, geo: geo ?? undefined, hits: queue };
    },
    onRelease: () => {
      settle(player, id, sk, d);
      if (sk.cat === "Magia" && announceAllowed(player, d, sk)) sysSay(player, "magic", "done", { cd: 3000 });
      observeSpell(player, id, player);
      markCombat(player); markDirty(player);
      emit(EV.SKILL_USED, { player, id, cost, sk, staged: true });
    },
    flush: (hits, delayOf, onEach) => applyQueue(player, hits, delayOf, onEach),
    onCancel: (reason) => { casting.delete(player.id); refund(); emit(EV.SKILL_CAST_CANCEL, { player, id, sk, reason }); },
    onFail: (msg) => { casting.delete(player.id); refund(); emit(EV.SKILL_FAILED, { player, id, state: CAST.NO_TARGET, msg, late: true }); },
  };
  try { rec.handle = runStaged(player, sk, spec, io); }
  catch (e) { casting.delete(player.id); console.warn(`[Etheria] conjuração ${id}: ${e}`); refund(); return { ok: false, state: CAST.ERROR, msg: "Erro ao lançar." }; }
  return { ok: true, state: CAST.READY, msg: sk.name, staged: true };
}
export function castSlot(player, slot) {
  const d = getData(player), id = d.equippedSkills[slot];
  if (!id) return { ok: false, state: CAST.LOCKED, msg: `Slot ${slot + 1} vazio.` };
  const r = castSkill(player, id);
  if (!r.ok) { if (!r.quiet) playSound(player, SOUNDS.fail, 0.6, 1); noteCastFailure(player, r); }
  return r;
}
export function cycleSlot(player) {
  const d = getData(player); if (d.equippedSkills.length === 0) return;
  d.slot = (d.slot + 1) % d.equippedSkills.length; markDirty(player);
  say(player, `§7Habilidade selecionada: §b${SKILLS[d.equippedSkills[d.slot]].name}`);
}

/** Uso de armas de longo alcance/conjuração (arco, cajado, grimório). */
export function weaponUse(player, inf) {
  const d = getData(player), s = getStats(player);
  if (inf.caster) {
    const id = d.equippedSkills[d.slot % Math.max(1, d.equippedSkills.length)];
    if (id) { const r = castSkill(player, id); if (!r.ok && !r.quiet) say(player, `§c${r.msg}`); return; }
    if (cdLeft(player, "w") > 0) return;
    if (d.mana < 5) { say(player, "§cMana insuficiente."); return; }
    d.mana -= 5; setCd(player, "w", 0.6);
    const sk = { element: "arcane", exec: { power: 0.9, stat: "intelligence" } };
    const a = aim(player, 24); line(player.dimension, a.head, a.point, "arcane", player); fx(player.dimension, a.point, "arcane", player);
    for (const e of (a.target ? [a.target] : around(player.dimension, a.point, 1.2, player))) hitOne(player, e, sk, s, 1 + s.atk * 0.05);
    playSound(player, SOUNDS.cast, 0.5, 1.4); markCombat(player); markDirty(player);
    return;
  }
  if (inf.ranged) {
    if (cdLeft(player, "w") > 0) return;
    if (d.stamina < inf.ranged.cost) { say(player, "§cStamina insuficiente."); return; }
    d.stamina -= inf.ranged.cost; setCd(player, "w", inf.ranged.cd / 20);
    const sk = { element: inf.ranged.element ?? "physical", exec: { power: 1.0, stat: "agility" } };
    const head = player.getHeadLocation(), dir = norm(player.getViewDirection());
    line(player.dimension, head, add(head, dir, inf.ranged.range), sk.element, player);
    const a = aim(player, inf.ranged.range);
    if (a.target) hitOne(player, a.target, sk, s, 1 + s.atk * 0.08);
    fx(player.dimension, a.point, sk.element, player);
    playSound(player, "random.bow", 0.8, 1); markCombat(player); markDirty(player);
  }
}

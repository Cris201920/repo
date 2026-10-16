// systems/combat.js - Dano corpo a corpo, críticos, defesa, resistências, roubo de vida e efeitos de arma
import { world, Player } from "@minecraft/server";
import { COMBAT, ELEMENTS, ALLY_TAG, SOUNDS } from "../config.js";
import { getData, markDirty } from "../core/db.js";
import { weaponHit } from "./weaponfx.js";
import { sysSay } from "./voice.js";
import { chance, heal, healthComp, isValid, playSound } from "../core/utils.js";
import { getStats } from "./stats.js";
import { addBuff } from "./effects.js";
import { fx } from "./fx.js";
import { BOSS_BY_TYPE } from "../data/bosses.js";
import { infusedHit } from "./infusion.js";
import { pressureMul } from "./power.js";

const lastCombat = new Map(); // playerId -> tick
export function markCombat(player) { if (!inCombat(player)) { try { sysSay(player, "combat", "start"); } catch { /* ignore */ } } lastCombat.set(player.id, Date.now()); }
export function inCombat(player) { return Date.now() - (lastCombat.get(player.id) ?? 0) < 5000; }

const NON_TARGET = new Set(["minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader", "minecraft:iron_golem", "minecraft:armor_stand", "minecraft:item", "minecraft:xp_orb", "minecraft:cat"]);
// ---------------------------------------------------------------- PvP (guerras entre jogadores)
// Antes (6.1 a 6.15.0) toda habilidade/golpe ignorava jogadores. Agora jogadores são alvos válidos quando o PvP está LIGADO (padrão),
// exceto: o próprio conjurador, quem está em criativo/espectador, quem tem a tag "etheria_nopvp" e jogadores da MESMA EQUIPE (tag "etheria_team_<nome>").
const PVP_KEY = "etheria:pvp";
let pvpCache;
export function pvpOn() {
  if (pvpCache === undefined) { try { pvpCache = world.getDynamicProperty(PVP_KEY) !== false; } catch { pvpCache = true; } }
  return pvpCache;
}
export function setPvp(on) { pvpCache = !!on; try { world.setDynamicProperty(PVP_KEY, !!on); } catch { /* ignore */ } }
export function teamOf(p) { try { const t = p.getTags().find((x) => x.startsWith("etheria_team_")); return t ? t.slice(13) : undefined; } catch { return undefined; } }
export function setTeam(p, name) {
  try { for (const t of p.getTags()) if (t.startsWith("etheria_team_")) p.removeTag(t); if (name) p.addTag("etheria_team_" + name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16)); } catch { /* ignore */ }
}
function pvpTarget(e, caster) {
  if (!pvpOn() || !(caster instanceof Player)) return false;
  try {
    const g = e.getGameMode?.(); if (g === "creative" || g === "spectator") return false;
    if (e.hasTag("etheria_nopvp")) return false;
    const a = teamOf(caster); if (a && a === teamOf(e)) return false;
    return !!healthComp(e);
  } catch { return false; }
}
export function isValidTarget(e, caster) {
  if (!isValid(e) || e === caster) return false;
  if (e instanceof Player) return pvpTarget(e, caster);
  const id = e.typeId;
  if (NON_TARGET.has(id) || id.startsWith("etheria:npc_") || id.startsWith("etheria:vfx_")) return false;   // 6.65: visuais 3D das magias nunca são alvo
  try { if (e.hasTag(ALLY_TAG)) return false; } catch { return false; }
  return !!healthComp(e);
}

/** Aplica dano de habilidade/efeito creditando o atacante (para XP, drops e quests). */
export function dealDamage(attacker, target, amount, o = {}) {
  if (!isValid(target) || !(amount > 0)) return 0;
  if (attacker instanceof Player) { try { amount *= pressureMul(attacker, target); } catch { /* ignore */ } }   // 6.55: pressão de poder
  try {
    target.applyDamage(amount, { cause: "entityAttack", damagingEntity: isValid(attacker) ? attacker : undefined });
    return amount;
  } catch { return 0; }
}

function applyOnHit(player, target, onHit, dmg) {
  if (!onHit || !chance(onHit.chance ?? 0.2)) return;
  switch (onHit.kind) {
    case "burn": try { target.setOnFire(onHit.sec ?? 4, true); } catch { /* ignore */ } break;
    case "bleed": addBuff(target, "bleed", onHit.sec ?? 5, { src: player, dot: 1.5 + dmg * 0.12 }); break;
    case "slow": addBuff(target, "chill", onHit.sec ?? 3); break;
    case "heal": heal(player, onHit.amount ?? 3); break;
    default: break;
  }
  fx(target.dimension, target.location, onHit.kind === "burn" ? "fire" : onHit.kind === "heal" ? "heal" : "blood", player);
}

function onHit(ev) {
  const a = ev.damagingEntity, t = ev.hitEntity;
  if (!(a instanceof Player) || !isValidTarget(t, a)) return;
  const d = getData(a), s = getStats(a);
  markCombat(a);
  let mult = 1;
  if (d.stamina >= COMBAT.melee_stamina) d.stamina -= COMBAT.melee_stamina; else mult = COMBAT.exhausted_mult;
  let dmg = Math.max(0, s.atk * mult - 1);
  const crit = chance(s.crit / 100);
  if (crit) dmg *= s.critDmg / 100;
  dmg *= 1 + (s.elem.physical ?? 0) / 100;
  let elemBonus = 0;
  if (s.weapon) for (const el of ELEMENTS) if (el !== "physical" && s.weapon.stats?.[el]) elemBonus += s.weapon.stats[el];
  dmg *= 1 + elemBonus / 100;
  if (s.weapon) { try { dmg *= weaponHit(a, t, s.weapon); } catch { /* efeitos nunca derrubam o combate */ } }
  if (dmg > 0) dealDamage(a, t, dmg);
  if (s.lifesteal > 0 && dmg > 0) heal(a, dmg * s.lifesteal / 100);
  if (s.weapon?.onHit) applyOnHit(a, t, s.weapon.onHit, dmg);
  // 6.36: infusão gravada na espada da mão (systems/infusion.js)
  if (s.weapon && dmg > 0) { try { const it = a.getComponent("minecraft:inventory")?.container?.getItem(a.selectedSlotIndex); if (it) dmg += infusedHit(a, t, dmg, it, dealDamage, isValidTarget); } catch { /* ignore */ } }
  if (crit) { sysSay(a, "combat", "crit", { cd: 2400 }); fx(t.dimension, { x: t.location.x, y: t.location.y + 1, z: t.location.z }, "physical", a); playSound(a, SOUNDS.crit, 0.6, 1.4); }
  try { a.onScreenDisplay.setActionBar(`${crit ? "§6§lCRÍTICO! " : "§c"}-${Math.round(dmg + 1)}`); } catch { /* ignore */ }
  markDirty(a);
}

function resKeyFor(cause) {
  switch (cause) {
    case "fire": case "fireTick": case "lava": return "fire";
    case "magic": case "wither": case "fireworks": return "magic";
    case "projectile": return "projectile";
    case "lightning": return "lightning";
    case "void": return "void";
    case "freezing": return "ice";
    default: return "physical";
  }
}

function onHurt(ev) {
  const v = ev.hurtEntity;
  if (!(v instanceof Player)) return;
  const s = getStats(v);
  const src = ev.damageSource; const cause = src?.cause;
  const rk = resKeyFor(cause);
  const rv = Math.max(0, s.res[rk] ?? 0) + (rk === "projectile" ? Math.max(0, s.res.physical ?? 0) : 0);
  let red = 1 - (1 - s.reduction) * (1 - Math.min(90, rv) / 100);
  if (rk !== "physical" && rk !== "magic" && rk !== "projectile") red = 1 - (1 - red) * (1 - Math.max(0, s.res.magic ?? 0) / 100);
  red = Math.min(red, COMBAT.max_reduction + 0.1);
  const dmg = ev.damage;
  const h = healthComp(v);
  markCombat(v);
  { const dd = getData(v); (dd.stat ??= { hurt: 0, dist: 0, idle: 0 }).hurt++; }
  if (h && h.currentValue > 0 && dmg > 0) heal(v, dmg * red);
  // Crítico recebido: só para golpes de monstros (usa cause "magic" para não reentrar)
  const att = src?.damagingEntity;
  if (att && !(att instanceof Player) && cause === "entityAttack" && h && h.currentValue > 0) {
    const p = BOSS_BY_TYPE[att.typeId] ? COMBAT.boss_crit_chance : COMBAT.mob_crit_chance;
    if (chance(p)) {
      try { v.applyDamage(dmg * COMBAT.mob_crit_mult, { cause: "magic" }); v.onScreenDisplay.setActionBar("§c§lGolpe crítico recebido!"); } catch { /* ignore */ }
    }
  }
}

export function startCombat() {
  world.afterEvents.entityHitEntity.subscribe(onHit);
  world.afterEvents.entityHurt.subscribe(onHurt);
}

// systems/mobskills.js - APRENDER HABILIDADES DE MOBS e CONSEGUIR O PREDADOR por chance ao derrotar monstros.
//
// · Ao matar um mob, há uma chance de absorver uma habilidade ligada à família dele (aranha → Tiro Perfurante, lobo → Instinto Selvagem...).
//   Quanto mais raro o mob, maior a chance. Cada derrota sem sucesso soma um "azar protegido" (pity) pequeno; ao conseguir, zera.
// · O Predador (Única) também sai por chance: mais comum ao matar slimes, bosses e mobs especiais. Quem já o tem (ou Gula/Beelzebuth) não rola.
// A habilidade concedida passa por grantSkill: a animação do Grande Sábio ("NOVA HABILIDADE DETECTADA") e o registro no arquivo do Sábio saem sozinhos.
import { sceneOn } from "./sageannounce.js";
import { world, Player } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { say, toast, isValid } from "../core/utils.js";
import { MOBS } from "../data/mobs.gen.js";
import { SKILLS } from "../data/skills.js";
import { ALLY_TAG } from "../config.js";
import { hasSkill, grantSkill } from "./skills.js";
import { sageVoice } from "./sage.js";
import { GreatSageLogger as Log } from "../core/logger.js";

// [expressão no id do mob, habilidades possíveis]. A 1ª regra que casa define a família.
export const FAMILY_SKILLS = [
  [/slime/, ["barrier", "mana_flow"]],
  [/goblin|hobgoblin/, ["goblin_cunning", "war_cry"]],
  [/orc|ogre/, ["war_cry", "shield_bash"]],
  [/taratect|spider|kumo|cave_spider/, ["piercing_shot", "shadow_step"]],
  [/wolf|carrion|beast|ravager|hoglin|polar_bear|fox|cat|panda/, ["beast_instinct", "wind_dash"]],
  [/imp|demon|feldway|returner|blaze|piglin|magma/, ["demon_flame", "blood_slash"]],
  [/veldora|dragon|wyrm|drake/, ["dragon_scales", "dragon_roar"]],
  [/golem|beretta|iron/, ["shield_bash", "barrier"]],
  [/angel|michael|holy|luminous|const_supreme|allay|vex/, ["holy_light", "heal"]],
  [/vampire|bat|phantom/, ["life_steal", "blood_slash"]],
  [/storm|bolt|lightning|thunder|const_lightning/, ["lightning"]],
  [/flame|fire|const_abyssal|const_demon/, ["fireball", "demon_flame"]],
  [/enderman|endermite|shulker|void|const_|avatar/, ["void_rift", "shadow_step"]],
  [/witch|evoker|illusioner|warden|shadow/, ["soul_drain", "shadow_step"]],
  [/zombie|skeleton|husk|drowned|wither|zoglin|stray/, ["undead_resilience", "life_steal"]],
  [/pillager|vindicator|ravager|bandit/, ["dark_slash", "war_cry"]],
  [/elf|archer|bow/, ["keen_eye", "piercing_shot"]],
  [/ice|frost|snow|goat/, ["ice_lance"]],
];
const TIER = { common: 1, uncommon: 1.4, rare: 2, epic: 3, legendary: 4.5, special: 6, boss: 9 };
const BASE = 0.025, PITY_STEP = 0.002, PITY_MAX = 0.03, CAP = 0.4;
const PRED_BASE = 0.008, PRED_PITY_STEP = 0.0006, PRED_PITY_MAX = 0.04, PRED_CAP = 0.15;
const PRED_ANY = ["predator", "gluttony", "beelzebuth"];

export function familyOf(typeId) {
  const short = String(typeId).replace(/^[a-z_]+:/, "");
  for (const [re, list] of FAMILY_SKILLS) if (re.test(short)) return { short, list };
  return { short, list: [] };
}
export const mobTier = (typeId) => TIER[MOBS[typeId]?.rar] ?? (MOBS[typeId]?.boss ? 9 : 1);

/** Chance (0-1) de absorver uma habilidade de um mob, dado o azar acumulado. Exportada para testes. */
export const skillChance = (typeId, pity = 0) => Math.min(CAP, BASE * mobTier(typeId) + Math.min(PITY_MAX, pity));
/** Chance (0-1) de conseguir o Predador ao derrotar este mob. */
export function predatorChance(typeId, pity = 0) {
  const short = String(typeId).replace(/^[a-z_]+:/, "");
  const k = /slime/.test(short) ? 3 : 1;
  return Math.min(PRED_CAP, PRED_BASE * k * Math.max(1, mobTier(typeId) * 0.6) + Math.min(PRED_PITY_MAX, pity));
}

/** Resolve uma derrota. `rnd` permite teste determinístico. Devolve { skill?, predator? } do que foi concedido. */
export function rollMobKill(player, typeId, rnd = Math.random) {
  const d = getData(player), got = {};
  d.mobPity ??= { s: 0, p: 0 };
  const canPred = !PRED_ANY.some((id) => hasSkill(d, id)) && d.level >= 5;
  if (canPred) {
    if (rnd() < predatorChance(typeId, d.mobPity.p)) {
      d.mobPity.p = 0; grantSkill(player, "predator"); got.predator = true;
      try { sageVoice(player, "learn"); } catch { /* ignore */ }
      toast(player, "§5§lPREDADOR", "§7Habilidade Única obtida");
      if (!sceneOn(player)) say(player, "§5§l[Grande Sábio] §r§fVocê obteve a habilidade Única §5Predador§f. Use-a em alvos feridos para devorá-los e absorver habilidades.");
    } else d.mobPity.p += PRED_PITY_STEP;
  }
  const { short, list } = familyOf(typeId);
  const open = list.filter((id) => SKILLS[id] && !hasSkill(d, id) && (SKILLS[id].level ?? 1) <= d.level + 15);
  if (open.length) {
    if (rnd() < skillChance(typeId, d.mobPity.s)) {
      const id = open[Math.min(open.length - 1, Math.floor(rnd() * open.length))];
      d.mobPity.s = 0; grantSkill(player, id); got.skill = id;
      try { sageVoice(player, "learn"); } catch { /* ignore */ }
      say(player, `§b[Grande Sábio] §fHabilidade absorvida de §e${MOBS[typeId]?.name ?? short}§f: §d${SKILLS[id].name}§f.`);
    } else d.mobPity.s += PITY_STEP;
  }
  markDirty(player);
  return got;
}

let started = false;
export function startMobSkills() {
  if (started) return; started = true;
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const dead = ev.deadEntity, killer = ev.damageSource?.damagingEntity;
      if (dead instanceof Player || !(killer instanceof Player) || !isValid(killer)) return;
      if (dead.hasTag(ALLY_TAG)) return;
      const tid = dead.typeId;
      const monster = !!dead.getComponent("minecraft:type_family")?.hasTypeFamily("monster");
      if (!MOBS[tid] && !monster) return;   // só monstros: animais comuns não concedem
      rollMobKill(killer, tid);
    } catch (e) { Log.debug(`mobskills: ${e}`, "MobSkills"); }
  });
}

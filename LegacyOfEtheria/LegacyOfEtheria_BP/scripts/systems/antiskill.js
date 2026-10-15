// systems/antiskill.js - ANTI-SKILL (Yuuki Kagurazaka). Neutraliza efeitos ELEGÍVEIS conforme regras explícitas (config ANTISKILL):
//   ANULÁVEL           habilidades comuns/incomuns/raras e efeitos nativos positivos/negativos "simples"  -> anulados por completo
//   PARCIALMENTE RESISTIDO   habilidades épicas/lendárias; chefes (efeitos fortes) -> dano x0,5 sem efeitos secundários / só parte dos efeitos removida
//   IMUNE              Únicas/Supremas/míticas/divinas, Dragões Verdadeiros, Primordiais, o próprio Yuuki e dano/knockback em geral -> nada acontece
// Três pontos de integração no sistema de skills existente (nada paralelo): gancho de golpe (setHitGuard), gancho de lançamento (setCastGuard) e custo (setCostMod).
// Contra JOGADORES: "Selo Anti-Skill" por no máx. sealSec s, com janela de imunidade depois (não encadeia) e que nunca bloqueia habilidades Únicas/Supremas.
// Executor da skill do jogador: kind "antiskill" (aura de 8 s + limpeza de positivos nos alvos próximos).
import { world, system } from "@minecraft/server";
import { SKILLS } from "../data/skills.js";
import { MOBS } from "../data/mobs.gen.js";
import { PROFILES } from "../data/bossprofiles.js";
import { ANTISKILL as AS } from "../config.js";
import { addBuff, hasBuff, clearDebuffs } from "./effects.js";
import { setHitGuard, setCastGuard, setCostMod, registerExec, cancelCasting } from "./skills.js";
import { say, isValid } from "../core/utils.js";

export const CLASS = Object.freeze({ NEGATABLE: "negatable", PARTIAL: "partial", IMMUNE: "immune" });
export const FIELD_TAG = "etheria_antiskill_field";

/** classifica uma HABILIDADE do jogador */
export function classifySkill(sk) {
  if (!sk) return CLASS.IMMUNE;
  if (AS.immuneIds.includes(sk.id) || AS.immuneCat.includes(sk.cat) || AS.immuneRarity.includes(sk.rarity) || ["devour", "dracform", "antiskill"].includes(sk.exec?.kind)) return CLASS.IMMUNE;
  if (AS.partialRarity.includes(sk.rarity)) return CLASS.PARTIAL;
  return CLASS.NEGATABLE;
}
/** classifica uma ENTIDADE como alvo da remoção de efeitos positivos */
export function classifyEntity(e) {
  try {
    if (e.typeId === "minecraft:player") return CLASS.NEGATABLE;
    if (AS.immuneEntities.includes(e.typeId)) return CLASS.IMMUNE;
    const short = e.typeId.replace(/^etheria:/, ""), tier = PROFILES[short]?.rank ?? PROFILES[short]?.tier ?? 0;
    if (tier >= 5) return CLASS.IMMUNE;
    const rar = MOBS[e.typeId]?.rar;
    if (tier >= 2 || ["boss", "legendary", "special"].includes(rar)) return CLASS.PARTIAL;
  } catch { /* ignore */ }
  return CLASS.NEGATABLE;
}

/** remove efeitos positivos conforme a classe; devolve quantos removeu */
export function strip(e, cls = classifyEntity(e)) {
  if (cls === CLASS.IMMUNE) return 0;
  let n = 0;
  for (const id of cls === CLASS.PARTIAL ? AS.positivePartial : AS.positive) { try { if (e.getEffect?.(id)) { e.removeEffect(id); n++; } } catch { /* ignore */ } }
  return n;
}

// ---------------------------------------------------------------- Selo (contra jogadores)
const sealImmune = new Map();   // playerId -> tick até o qual não pode ser selado de novo
export const sealed = (p) => { try { return hasBuff(p, "antiseal"); } catch { return false; } };
/** tenta selar um jogador; false = já imune (janela) ou protegido pela aura Anti-Skill */
export function sealPlayer(p, sec = AS.sealSec) {
  const now = system.currentTick;
  if ((sealImmune.get(p.id) ?? 0) > now || hasBuff(p, "antiaura")) return false;
  sec = Math.min(sec, AS.sealSec);
  addBuff(p, "antiseal", sec, { debuff: true, name: "Selo Anti-Skill" });
  sealImmune.set(p.id, now + (sec + AS.sealImmuneSec) * 20);
  try { cancelCasting(p, "Selo Anti-Skill"); } catch { /* ignore */ }
  strip(p, CLASS.NEGATABLE);
  return true;
}

// ---------------------------------------------------------------- ganchos
function castGuard(p, sk) {
  if (!sealed(p)) return null;
  return classifySkill(sk) === CLASS.NEGATABLE ? `Selo Anti-Skill: ${sk.name} foi anulada.` : null;
}
function costMod(p, sk) { return sealed(p) && classifySkill(sk) === CLASS.PARTIAL ? AS.partialCost : 1; }
/** Yuuki só anula golpes de habilidade enquanto o CAMPO dele está ativo (tag temporária) */
function hitGuard(attacker, target, sk) {
  if (!target?.hasTag?.(FIELD_TAG) || !sk) return false;
  const c = classifySkill(sk);
  if (c === CLASS.NEGATABLE) { try { say(attacker, `§8[Anti-Skill] §7${sk.name} foi anulada.`); } catch { /* ignore */ } return true; }
  if (c === CLASS.PARTIAL) { try { say(attacker, `§8[Anti-Skill] §7${sk.name} foi parcialmente resistida.`); } catch { /* ignore */ } return AS.partialMul; }
  return false;
}
/** abre o campo de Anti-Skill numa entidade (Yuuki) por fieldSec segundos */
export function openField(e, sec = AS.fieldSec) {
  try { e.addTag(FIELD_TAG); } catch { return; }
  system.runTimeout(() => { try { if (isValid(e)) e.removeTag(FIELD_TAG); } catch { /* ignore */ } }, Math.round(sec * 20));
}

// ---------------------------------------------------------------- aura do jogador (habilidade "anti_skill")
const auras = new Map();   // playerId -> handle
function startAura(p, sec) {
  auras.get(p.id) && system.clearRun(auras.get(p.id));
  addBuff(p, "antiaura", sec, { name: "Aura Anti-Skill", stats: { res_magic: 25 } });
  let t = 0;
  const h = system.runInterval(() => {
    t += 10;
    if (!isValid(p) || t > sec * 20) { system.clearRun(h); auras.delete(p.id); return; }
    for (const id of AS.negative) { try { if (p.getEffect(id)) p.removeEffect(id); } catch { /* ignore */ } }     // anuláveis: somem em <0,5 s
    if (t % 20 === 0) for (const b of AS.rpgPartial) { try { if (hasBuff(p, b)) clearDebuffs(p); } catch { /* ignore */ } }   // parciais: duram no máx. ~1 s
    if (sealed(p)) clearDebuffs(p);
  }, 10);
  auras.set(p.id, h);
}
export const auraOn = (p) => { try { return hasBuff(p, "antiaura"); } catch { return false; } };
export function dropAntiSkill(id) { auras.delete(id); sealImmune.delete(id); }

export function startAntiSkill() {
  setHitGuard(hitGuard); setCastGuard(castGuard); setCostMod(costMod);
  registerExec("antiskill", (player, sk, s, d, h) => {
    const sec = sk.exec.sec ?? 8, r = sk.exec.radius ?? 8;
    startAura(player, sec); clearDebuffs(player);
    const out = { negated: 0, partial: 0, immune: 0 };
    for (const e of h.around(player.dimension, player.location, r, player)) {
      const c = classifyEntity(e); if (c === CLASS.IMMUNE) { out.immune++; continue; }
      const n = strip(e, c); if (n) out[c === CLASS.PARTIAL ? "partial" : "negated"]++;
    }
    say(player, `§8[Anti-Skill] §7aura por ${sec}s. Efeitos anulados: §f${out.negated}§7 · parciais: §f${out.partial}§7 · imunes: §f${out.immune}§7.`);
    return true;
  });
  world.afterEvents.playerLeave.subscribe((ev) => dropAntiSkill(ev.playerId));
}

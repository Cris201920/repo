// systems/predator.js - Habilidade Única "Predador" (evolui para "Gula"): devora alvos fracos, guarda no estômago e concede Mimetismo.
import { registerExec, grantSkill, hasSkill, setHitGuard } from "./skills.js";
import { isProtectedPos } from "./arenas.js";
import { system, Player, BlockPermutation } from "@minecraft/server";
import { SKILLS } from "../data/skills.js";
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, playSound, toast, heal } from "../core/utils.js";
import { getStats } from "./stats.js";
import { ctx, implode, disc, burst, CIRCLE, T } from "./fxlib.js";
import { sageVoice } from "./sage.js";
import { EquippedSkillManager } from "./skillbar/equipped.js";
import { AUTO_EQUIP } from "../config.js";
import { emit, EV } from "../core/bus.js";

// quantidade de devorados -> habilidade de mimetismo
const MIMIC = [
  ["goblin", "goblin_cunning", 3], ["magic_wolf", "beast_instinct", 3], ["imp", "demon_flame", 3], ["orc", "war_cry", 4],
  ["taratect", "piercing_shot", 4], ["arcane_slime", "barrier", 3],
];
export const STOMACH_EVOLVE = 30;
/** Glutonaria evolui para Beelzebuth (Suprema) ao devorar o bastante e alcançar o nível exigido. */
export const BEELZEBUTH_EVOLVE = Object.freeze({ devoured: 120, level: 60 });

function healthOf(e) { try { return e.getComponent("minecraft:health"); } catch { return undefined; } }

function devourOne(player, e, sk, h) {
  const d = getData(player), hp = healthOf(e);
  if (!hp) return false;
  const frac = hp.currentValue / hp.effectiveMax;
  h.hitOne(player, e, sk, getStats(player), 0.6);
  const hp2 = healthOf(e);
  const dead = !hp2 || hp2.currentValue <= 0;
  if (!(dead || frac <= (sk.exec.threshold ?? 0.3))) return false;
  const typeId = e.typeId, short = typeId.split(":")[1] ?? typeId;
  const loc = { x: e.location.x, y: e.location.y + 1, z: e.location.z }, dim = e.dimension;
  try { if (!dead) e.kill(); } catch { /* ignore */ }
  d.stomach ??= {}; d.stomach[short] = (d.stomach[short] ?? 0) + 1; d.devoured = (d.devoured ?? 0) + 1;
  const s = getStats(player); d.mana = Math.min(s.maxMana, d.mana + s.maxMana * 0.08); heal(player, 4);
  const c = ctx(player);
  implode(c, loc, { col: "violet", tile: T.skull, n: 10, radius: 2, life: 0.5, size: 0.28 }); disc(c, { x: loc.x, y: loc.y - 1, z: loc.z }, { col: "shadow", circle: CIRCLE.devour, size: 2.4, life: 0.8 });
  playSound(player, "mob.enderman.teleport", 0.6, 0.6);
  for (const [fam, skill, need] of MIMIC) {
    if (short.includes(fam) && d.stomach[short] >= need && !hasSkill(d, skill)) {
      grantSkill(player, skill); toast(player, "§5Mimetismo", `§7${short} → ${skill}`); sageVoice(player, "learn");
      say(player, `§5[Predador] §fVocê dominou a habilidade §d${skill}§f ao devorar ${short}.`);
    }
  }
  if (hasSkill(d, "predator") && !hasSkill(d, "gluttony") && d.devoured >= STOMACH_EVOLVE && d.level >= 35) evolveGluttony(player);
  else if (hasSkill(d, "gluttony") && !hasSkill(d, "beelzebuth") && d.devoured >= BEELZEBUTH_EVOLVE.devoured && d.level >= BEELZEBUTH_EVOLVE.level) evolveBeelzebuth(player);
  markDirty(player);
  return true;
}

/** Evolução de uma habilidade de devoração: a antiga sai da lista e a nova entra no MESMO slot da hotbar (nada é duplicado nem perdido);
 *  se a troca no slot não for possível, guarda a antiga e equipa a nova se houver espaço. */
function evolveSkill(player, from, to, title, sub, msg) {
  const d = getData(player), wasEquipped = d.equippedSkills.includes(from);
  d.unlockedSkills = d.unlockedSkills.filter((x) => x !== from);
  grantSkill(player, to, { noEquip: true });
  if (wasEquipped) {
    const r = EquippedSkillManager.replace(player, from, to);
    if (!r.ok) { EquippedSkillManager.unequip(player, from); EquippedSkillManager.equip(player, to, { silent: true }); }
  } else if (d.equippedSkills.length < AUTO_EQUIP) EquippedSkillManager.equip(player, to, { silent: true });
  toast(player, title, sub); sageVoice(player, "evolve");
  say(player, msg);
  try { emit(EV.SAGE_SKILL_REMOVED, { player, id: from, reason: "evolved", to }); emit(EV.SAGE_SKILL_EVOLVED, { player, id: to, from: [from] }); } catch { /* ignore */ }   // skill_removed + skill_evolved (o Sábio registra)
  saveNow(player);
}
function evolveGluttony(player) {
  evolveSkill(player, "predator", "gluttony", "§5§lGULA", "§7Predador evoluiu", "§5§l[Great Sage] §r§fPredador evoluiu para §5Gula§f. Alcance e capacidade de devoração ampliados.");
}
function evolveBeelzebuth(player) {
  evolveSkill(player, "gluttony", "beelzebuth", "§5§lBEELZEBUTH", "§7Glutonaria evoluiu para Habilidade Suprema",
    "§5§l[Great Sage] §r§fGlutonaria evoluiu para §5Beelzebuth, Senhor da Gula§f. Devora até 8 alvos feridos num raio de 10 blocos.");
}

// ---------------------------------------------------------------- DEVORAR BLOCOS (remoção real, com limites e proteções)
/** Blocos que nunca são devorados: indestrutíveis, de comando, portais, recipientes (guardam itens), geradores e a base do mundo. */
const DENY = /(bedrock|barrier|command_block|structure_block|structure_void|jigsaw|end_portal|portal|spawner|chest|barrel|shulker|furnace|smoker|hopper|dropper|dispenser|brewing|lectern|beacon|ender_chest|bed$|allow|deny|border|reinforced|light_block|^minecraft:air$|water|lava)/;
/** limite de blocos por conjuração: Predador 1 | Glutonaria 5 (cruz 3D) | Beelzebuth 14 (esfera r=1,5 e meio) */
const BLOCK_CAP = { predator: 1, gluttony: 5, beelzebuth: 14 }, BLOCK_COOL_MS = 1500, MAX_MIN = 240;
const eatLog = new Map();   // playerId -> [timestamps] (limite por minuto)
export function canDevourBlock(dim, b) {
  try {
    if (!b || b.isAir || b.isLiquid) return "ar/líquido";
    if (DENY.test(b.typeId)) return "bloco protegido";
    const { x, y, z } = b.location;
    if (y <= dim.heightRange.min + 1) return "base do mundo";
    if (isProtectedPos(dim, x, y, z)) return "estrutura protegida";
    return null;
  } catch { return "inválido"; }
}
function devourBlocks(player, sk, h) {
  const d = getData(player), id = hasSkill(d, "beelzebuth") ? "beelzebuth" : hasSkill(d, "gluttony") ? "gluttony" : "predator";
  const cap = BLOCK_CAP[id], now = Date.now(), log = (eatLog.get(player.id) ?? []).filter((t) => now - t < 60000);
  if (log.length >= MAX_MIN) return 0;
  let hit; try { hit = player.getBlockFromViewDirection({ maxDistance: sk.exec.range ?? 5 }); } catch { /* ignore */ }
  const b0 = hit?.block; if (!b0) return 0;
  const dim = player.dimension, o = b0.location, list = [];
  const offs = id === "predator" ? [[0, 0, 0]] : id === "gluttony" ? [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]] : (() => { const a = []; for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (Math.abs(x) + Math.abs(y) + Math.abs(z) <= 2) a.push([x, y, z]); return a.sort((p, q) => (Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2])) - (Math.abs(q[0]) + Math.abs(q[1]) + Math.abs(q[2]))); })();
  for (const [dx, dy, dz] of offs) {
    if (list.length >= cap) break;
    let b; try { b = dim.getBlock({ x: o.x + dx, y: o.y + dy, z: o.z + dz }); } catch { continue; }
    if (!canDevourBlock(dim, b)) list.push(b);
  }
  let n = 0; const c = ctx(player);
  for (const b of list) {
    try {
      const loc = { x: b.location.x + 0.5, y: b.location.y + 0.5, z: b.location.z + 0.5 };
      b.setPermutation(BlockPermutation.resolve("minecraft:air"));
      implode(c, loc, { col: "violet", n: 4, radius: 1.4, life: 0.4, size: 0.2 }); n++;
    } catch { /* ignore */ }
  }
  if (n) {
    log.push(now); eatLog.set(player.id, log); d.blocksEaten = (d.blocksEaten ?? 0) + n; d.mana = Math.min(getStats(player).maxMana, d.mana + n * 0.6);
    disc(c, { x: o.x + 0.5, y: o.y + 0.1, z: o.z + 0.5 }, { col: "shadow", circle: CIRCLE.devour, size: 1.6 + n * 0.1, life: 0.6 });
    playSound(player, "mob.enderman.teleport", 0.5, 0.5); markDirty(player);
  }
  return n;
}

// ---------------------------------------------------------------- ABSORVER HABILIDADES DE JOGADORES (janela aberta pelo Predador)
const WINDOW_TICKS = 100;   // 5 s
const windowUntil = new Map();   // playerId -> tick
/** Habilidades que podem ser absorvidas: ativas comuns; nunca Únicas/Supremas/Divinas/Míticas nem já possuídas. */
export function canAbsorb(d, id) {
  const sk = SKILLS[id]; if (!sk || sk.type !== "active") return "não é ativa";
  if (sk.cat === "Única" || ["mythic", "divine", "legendary"].includes(sk.rarity)) return "habilidade rara demais";
  if (hasSkill(d, id)) return "já possui";
  return null;
}
export function absorbSkill(pred, src, id) {
  const d = getData(pred); if (canAbsorb(d, id)) return false;
  d.absorbed ??= {}; const keys = Object.keys(d.absorbed);
  if (keys.length >= 40) delete d.absorbed[keys[0]];
  d.absorbed[id] = { from: src?.name ?? "?", at: Date.now(), t: system.currentTick };
  grantSkill(pred, id); markDirty(pred);
  const c = ctx(pred), l = { x: pred.location.x, y: pred.location.y + 1, z: pred.location.z };
  implode(c, l, { col: "violet", tile: T.skull, n: 14, radius: 2.6, life: 0.6, size: 0.3 }); disc(c, { x: l.x, y: l.y - 1, z: l.z }, { col: "shadow", circle: CIRCLE.devour, size: 3, life: 1 });
  toast(pred, "§5Habilidade Absorvida", `§d${SKILLS[id].name} §7de ${src?.name ?? "?"}`); sageVoice(pred, "learn");
  say(pred, `§5[Predador] §fVocê absorveu §d${SKILLS[id].name}§f de §e${src?.name ?? "?"}§f. Ela já está na sua lista e pode ser usada.`);
  return true;
}
export function openAbsorbWindow(player) { windowUntil.set(player.id, system.currentTick + WINDOW_TICKS); }
export const absorbOpen = (player) => (windowUntil.get(player.id) ?? 0) > system.currentTick;
function guard(attacker, target, sk) {
  if (!(target instanceof Player) || target === attacker || !absorbOpen(target)) return false;
  const td = getData(target); if (!(hasSkill(td, "predator") || hasSkill(td, "gluttony") || hasSkill(td, "beelzebuth"))) return false;
  const id = sk.id; if (!id) return false;
  absorbSkill(target, attacker, id);          // se já tem ou é rara demais, o golpe apenas é devorado (sem dano)
  const c = ctx(target); implode(c, { x: target.location.x, y: target.location.y + 1, z: target.location.z }, { col: "violet", n: 8, radius: 1.8, life: 0.4, size: 0.25 });
  return true;
}

export function startPredator() {
  setHitGuard(guard);
  system.runInterval(() => { for (const [k, t] of windowUntil) if (t < system.currentTick) windowUntil.delete(k); }, 100);
  registerExec("devour", (player, sk, s, d, h) => {
    const ex = sk.exec, a = h.aim(player, ex.range);
    h.mark(a.head, a.point, a.point);
    openAbsorbWindow(player);   // 5 s: golpes de habilidade de outro jogador contra você são devorados e podem ser aprendidos
    const targets = ex.aoe ? h.around(player.dimension, player.location, ex.aoe, player) : (a.target ? [a.target] : []);
    if (!targets.length) {
      const nb = devourBlocks(player, sk, h);
      if (nb) { say(player, `§5[Predador] §7devorou §f${nb}§7 bloco(s).`); return true; }
      return "Nenhum alvo ao alcance. (Janela de absorção aberta por 5 s.)";
    }
    let n = 0;
    for (const e of targets.slice(0, ex.max ?? 1)) if (devourOne(player, e, sk, h)) n++;
    if (n) say(player, `§5[Predador] §7devorou ${n}. Estômago: §f${d.devoured}`);
    return true;
  });
}

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
import { sageText } from "./voice.js";
import { store, room, predTier, analyze } from "./stomach.js";
import { MOBS } from "../data/mobs.gen.js";
import { ALLY_TAG } from "../config.js";
import { mote, streak, ringFlat, orbit, helix, after } from "./fxlib.js";
import { onDevoured } from "./slimeform.js";

// quantidade de devorados -> habilidade de mimetismo
const MIMIC = [
  ["goblin", "goblin_cunning", 3], ["magic_wolf", "beast_instinct", 3], ["imp", "demon_flame", 3], ["orc", "war_cry", 4],
  ["taratect", "piercing_shot", 4], ["arcane_slime", "barrier", 3],
];
export const STOMACH_EVOLVE = 30;
/** Glutonaria evolui para Beelzebuth (Suprema) ao devorar o bastante e alcançar o nível exigido. */
export const BEELZEBUTH_EVOLVE = Object.freeze({ devoured: 120, level: 60 });

function healthOf(e) { try { return e.getComponent("minecraft:health"); } catch { return undefined; } }

// ---------------------------------------------------------------- 6.55: validação, sequência visual e Estômago real
const done = new Map();   // entityId -> tick (a mesma entidade nunca é processada duas vezes)
const head = (e) => ({ x: e.location.x, y: e.location.y + 1, z: e.location.z });
/** null = pode devorar; texto = motivo (imune/incompatível) */
export function devourBlock(d, e) {
  const id = e.typeId ?? "";
  if (e instanceof Player) return "jogadores não podem ser devorados";
  if (/^etheria:npc_|^minecraft:(villager|wandering_trader|iron_golem|armor_stand)/.test(id)) return "NPCs são imunes";
  try { if (e.hasTag(ALLY_TAG) || e.hasTag("etheria_resident") || e.hasTag("etheria_npc")) return "aliado/morador protegido"; } catch { /* ignore */ }
  const rar = MOBS[id]?.rar, tier = predTier(d);
  if (rar === "boss" && tier === "predator") return "chefes exigem Gula ou Beelzebuth";
  if ((rar === "legendary" || rar === "special") && tier !== "beelzebuth") return "seres lendários só cedem a Beelzebuth";
  if (done.has(e.id)) return "já está sendo devorado";
  return null;
}
/** sequência de captura (aura, espirais, tentáculos, partículas puxadas do alvo) — o resultado só aparece depois */
function captureFx(player, e) {
  const c = ctx(player, 1); if (c.k <= 0) return;
  const P = () => ({ x: player.location.x, y: player.location.y + 1.1, z: player.location.z });
  orbit(c, P, { col: "shadow", tile: T.smoke, n: 4, r: 1, dur: 14, step: 2, size: 0.35, speed: 2.2, a: 0.7 });
  orbit(c, P, { col: "mana", tile: T.orb, n: 3, r: 0.6, dur: 14, step: 2, size: 0.14, speed: -3 });
  helix(c, e.location, { col: "violet", tile: T.spark, steps: 22, turns: 3, r: 1.2, h: 2.4, dur: 12, size: 0.12, down: true });
  for (let i = 0; i < 5; i++) after(i * 2, () => { if (!isLive(e)) return; const a = P(), b = head(e); for (let k = 0; k < 3; k++) { const m = { x: (a.x + b.x) / 2 + (Math.random() - 0.5) * 1.6, y: (a.y + b.y) / 2 + Math.random(), z: (a.z + b.z) / 2 + (Math.random() - 0.5) * 1.6 }; streak(c, a, m, { col: "shadow", w: 0.14, life: 0.18 }); streak(c, m, b, { col: "violet", w: 0.1, life: 0.18 }); } });
}
function successFx(player, loc) {
  const c = ctx(player, 1); if (c.k <= 0) return;
  const P = () => ({ x: player.location.x, y: player.location.y + 1.1, z: player.location.z });
  for (let i = 0; i < 6; i++) after(i, () => { const a = P(); for (let k = 0; k < 8; k++) { const q = { x: loc.x + (Math.random() - 0.5) * 1.6, y: loc.y + (Math.random() - 0.3) * 1.6, z: loc.z + (Math.random() - 0.5) * 1.6 }, dx = a.x - q.x, dy = a.y - q.y, dz = a.z - q.z, m = Math.hypot(dx, dy, dz) || 1; mote(c, q, { col: k % 3 ? "violet" : "mana", tile: k % 2 ? T.spark : T.skull, size: 0.16, spd: m / 0.35, dir: [dx / m, dy / m, dz / m], life: 0.35, drag: 0 }); } });
  implode(c, loc, { col: "black", tile: T.smoke, n: 18, radius: 2.4, life: 0.5, size: 0.45, a: 0.8 });
  after(7, () => { const a = P(); burst(c, a, { col: "mana", tile: T.star, n: 18, spd: 3, life: 0.5, size: 0.12 }); ringFlat(c, { x: a.x, y: a.y - 1, z: a.z }, { col: "violet", tile: T.ring, n: 22, radius: 2.2, spd: 4, life: 0.45, size: 0.16 }); orbit(c, P, { col: "mana", tile: T.orb, n: 2, r: 0.4, dur: 20, step: 2, size: 0.18, speed: 4 }); });
  disc(c, { x: loc.x, y: loc.y - 1, z: loc.z }, { col: "shadow", circle: CIRCLE.devour, size: 3, life: 1 });
}
function failFx(player, e) {
  const c = ctx(player, 1); if (c.k <= 0 || !isLive(e)) return;
  const L = head(e);
  burst(c, L, { col: "violet", tile: T.cross, n: 12, spd: 3, life: 0.4, size: 0.16 });
  ringFlat(c, L, { col: "blood", tile: T.ring, n: 14, radius: 1.4, spd: 3, life: 0.35, size: 0.12 });
  for (let k = 0; k < 4; k++) { const a = { x: player.location.x, y: player.location.y + 1.1, z: player.location.z }; streak(c, a, { x: (a.x + L.x) / 2 + (Math.random() - 0.5), y: (a.y + L.y) / 2, z: (a.z + L.z) / 2 + (Math.random() - 0.5) }, { col: "shadow", w: 0.08, life: 0.25, a: 0.5 }); }
}
const isLive = (e) => { try { return e.isValid !== false && !!e.location; } catch { return false; } };

function devourOne(player, e, sk, h) {
  const d = getData(player), hp = healthOf(e);
  if (!hp) return false;
  const why = devourBlock(d, e);
  if (why) { failFx(player, e); try { sageText(player, `Predação impossível: ${why}.`, { pri: 3, key: "pred.deny." + why, cd: 200 }); } catch { /* ignore */ } return false; }
  if (room(d) <= 0) { failFx(player, e); try { sageText(player, "Estômago cheio. Processe ou libere conteúdos.", { pri: 3, key: "pred.full", cd: 300 }); } catch { /* ignore */ } return false; }
  captureFx(player, e);
  const frac = hp.currentValue / hp.effectiveMax;
  h.hitOne(player, e, sk, getStats(player), 0.6);
  const hp2 = healthOf(e);
  const dead = !hp2 || hp2.currentValue <= 0;
  const legendary = ["legendary", "special"].includes(MOBS[e.typeId]?.rar);
  const thr = legendary ? 0.1 : (sk.exec.threshold ?? 0.3);
  if (!(dead || frac <= thr)) { after(10, () => failFx(player, e)); try { sageText(player, `Captura falhou: o alvo resiste. Reduza a vida dele abaixo de ${Math.round(thr * 100)}%.`, { pri: 4, key: "pred.fail", cd: 160 }); } catch { /* ignore */ } return false; }
  done.set(e.id, system.currentTick); if (done.size > 200) done.delete(done.keys().next().value);
  const typeId = e.typeId, short = typeId.split(":")[1] ?? typeId;
  const loc = head(e);
  // intacto: removido SEM soltar itens (o material sai só pelo processamento, sem duplicar). Já morto pelo golpe: os itens já caíram -> só a análise é guardada.
  let stored = 0;
  if (!dead) { try { e.remove(); stored = store(player, "mobs", typeId, 1); } catch { try { e.kill(); } catch { /* ignore */ } } }
  d.stomach ??= {}; d.stomach[short] = (d.stomach[short] ?? 0) + 1; d.devoured = (d.devoured ?? 0) + 1;
  const s = getStats(player); d.mana = Math.min(s.maxMana, d.mana + s.maxMana * 0.08); heal(player, 4);
  successFx(player, loc);
  playSound(player, "mob.enderman.teleport", 0.6, 0.6);
  after(10, () => { try { analyze(player, typeId); } catch { /* ignore */ } });
  try { onDevoured(player, typeId); } catch { /* ignore */ }   // 6.80: forma humana/Mímico do slime e sorte de Ultimate
  if (!stored && dead) { try { sageText(player, "O alvo se desfez antes da captura completa. Apenas a análise foi registrada.", { pri: 4, key: "pred.dead", cd: 200 }); } catch { /* ignore */ } }
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

/** devora itens soltos no chão perto do ponto mirado (guardados no Estômago, liberáveis depois) */
function devourItems(player, at) {
  let n = 0;
  try {
    for (const it of player.dimension.getEntities({ type: "minecraft:item", location: at, maxDistance: 3.5 })) {
      if (done.has(it.id)) continue;
      const st = it.getComponent("minecraft:item")?.itemStack; if (!st) continue;
      const fit = store(player, "items", st.typeId, st.amount); if (!fit) break;
      done.set(it.id, system.currentTick);
      if (fit < st.amount) { try { st.amount -= fit; player.dimension.spawnItem(st, it.location); } catch { /* ignore */ } }
      const c = ctx(player); implode(c, it.location, { col: "violet", tile: T.spark, n: 6, radius: 1, life: 0.3, size: 0.12 });
      it.remove(); n += fit;
    }
  } catch { /* ignore */ }
  return n;
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
  sageVoice(player, "evolve");
  sageText(player, msg, { pri: 3 });   // 6.38: a evolução aparece na cena (grantSkill) e na fala do Sábio, sem título/chat soltos
  try { emit(EV.SAGE_SKILL_REMOVED, { player, id: from, reason: "evolved", to }); emit(EV.SAGE_SKILL_EVOLVED, { player, id: to, from: [from] }); } catch { /* ignore */ }   // skill_removed + skill_evolved (o Sábio registra)
  saveNow(player);
}
function evolveGluttony(player) {
  evolveSkill(player, "predator", "gluttony", "§5§lGULA", "§7Predador evoluiu", "§fPredador evoluiu para §5Gula§f. Alcance e capacidade de devoração ampliados.");
}
function evolveBeelzebuth(player) {
  evolveSkill(player, "gluttony", "beelzebuth", "§5§lBEELZEBUTH", "§7Glutonaria evoluiu para Habilidade Suprema",
    "§fGlutonaria evoluiu para §5Beelzebuth, Senhor da Gula§f. Devora até 8 alvos feridos num raio de 10 blocos.");
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
      const bid = b.typeId; if (room(d) <= 0) break;
      b.setPermutation(BlockPermutation.resolve("minecraft:air"));
      store(player, "blocks", bid, 1);
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
      const ni = devourItems(player, a.point ?? player.location);
      if (ni) { say(player, `§5[Predador] §7engoliu §f${ni}§7 item(ns). Veja no Estômago.`); return true; }
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

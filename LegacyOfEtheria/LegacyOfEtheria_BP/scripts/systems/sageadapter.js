// systems/sageadapter.js - ADAPTADORES de integração do Grande Sábio com o resto do addon.
//
// O restante do addon NÃO conhece o Sábio: ele só emite eventos no barramento (core/bus.js) ou acontece no jogo (dano, teleporte...).
// Este módulo faz duas coisas, em seções separadas:
//   1) TRADUTORES  - convertem o que acontece no addon/jogo nos eventos que o Sábio entende:
//        PLAYER_GETS_SKILL, PLAYER_EVOLVES, PLAYER_AWAKENS, PLAYER_CRAFTS, PLAYER_EQUIPS, PLAYER_ATTACKS, PLAYER_TAKES_DAMAGE,
//        PLAYER_TELEPORTS, PLAYER_CASTS_MAGIC, PLAYER_DISCOVERS_ENTITY, PLAYER_DISCOVERS_ITEM
//        skill_acquired · skill_evolved · skill_combined · skill_removed · skill_awakened · skill_mastered · magic_learned
//   2) REAÇÕES     - o Sábio registra, lembra, aprende e avisa (memória, conhecimento, cache de evolução, dicas sem spam).
// Limites do Bedrock (honestos): não existe evento de teleporte nem de fabricação no @minecraft/server 1.17.0 estável. O teleporte é
// detectado por salto de posição (>= TELEPORT_JUMP blocos em 10 ticks) e pelas habilidades de teleporte do addon; a fabricação vem da Forja do addon
// (a bancada de trabalho do Minecraft não emite evento).
// Desempenho: um único assinante de dano, um laço de 10 ticks só com leitura de posição, memória por jogador pequena e limpa na saída.
import { world, system } from "@minecraft/server";
import { on, emit, EV } from "../core/bus.js";
import { getData, markDirty } from "../core/db.js";
import { isValid } from "../core/utils.js";
import { SKILLS } from "../data/skills.js";
import { ITEMS } from "../data/items.gen.js";
import { COMBOS } from "./discovery.js";
import { sageStage, sageSay, subtitleActive } from "./voice.js";
import { learn, remember, addExp, addBond } from "./sageknow.js";
import { tipGate, TIP_PRI } from "./sagetips.js";
import { typingActive } from "./sagecore.js";
import { EvolutionManager } from "./sageevo.js";
import { resetScan, suggest } from "./sageproc.js";
import { targetName } from "./sagetarget.js";
import { GreatSageLogger as Log } from "../core/logger.js";

export const TELEPORT_JUMP = 24;       // blocos em 10 ticks (48 blocos/s: acima de qualquer deslocamento normal, inclusive élitro com foguete)
const LOOP_TICKS = 10, BATCH_TICKS = 40, RATE_TICKS = 20, RATE_KEYS = 24, TELEPORT_DEDUPE = 40;
const SPECIAL_RARITY = new Set(["legendary", "mythic", "divine"]);
const MAGIC_ELEMENTS = new Set(["arcane", "fire", "ice", "lightning", "void", "light", "shadow", "water", "wind", "earth", "blood"]);
const CAUSE_NAME = { entityAttack: "Golpe", projectile: "Projétil", fire: "Fogo", fireTick: "Queimadura", lava: "Lava", magic: "Magia", fall: "Queda", drowning: "Afogamento", suffocation: "Sufocamento",
  entityExplosion: "Explosão", blockExplosion: "Explosão", lightning: "Raio", wither: "Definhar", poison: "Veneno", freezing: "Frio", contact: "Contato", starve: "Fome", void: "Vazio" };
const pretty = (id) => String(id).split(":").pop().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const nameOf = (id) => SKILLS[id]?.name ?? pretty(id);

/** Habilidade "mágica" (Magia, Única ou de elemento mágico): vira PLAYER_CASTS_MAGIC. */
export const isMagicSkill = (sk) => !!sk && sk.type === "active" && (sk.cat === "Magia" || sk.cat === "Única" || MAGIC_ELEMENTS.has(sk.element));

// ---------------------------------------------------------------- estado por jogador (tudo é limpo na saída)
const batches = new Map();   // playerId -> { ids: [], timer }   (aquisições agrupadas na memória)
const rates = new Map();     // playerId -> Map(chave -> tick)   (limite por tipo de registro de combate)
const lastPos = new Map();   // playerId -> { x, y, z, dim }
const lastTp = new Map();    // playerId -> tick do último teleporte emitido
export function dropAdapter(id) { const b = batches.get(id); if (b?.timer) system.clearRun(b.timer); batches.delete(id); rates.delete(id); lastPos.delete(id); lastTp.delete(id); }

/** Libera no máximo uma vez por RATE_TICKS por (jogador, chave): impede que cada golpe vire escrita no conhecimento. */
function rateOk(p, key, now = system.currentTick) {
  let m = rates.get(p.id); if (!m) { m = new Map(); rates.set(p.id, m); }
  if (now - (m.get(key) ?? -9999) < RATE_TICKS) return false;
  m.delete(key); m.set(key, now);
  if (m.size > RATE_KEYS) m.delete(m.keys().next().value);
  return true;
}

// ================================================================ 1) TRADUTORES
/** Habilidade aprendida -> aquisição / evolução / combinação / magia. */
function translateSkillLearned({ player, id }) {
  const sk = SKILLS[id]; if (!sk) return;
  emit(EV.PLAYER_GETS_SKILL, { player, id, sk });
  emit(EV.SAGE_SKILL_ACQUIRED, { player, id, sk });
  const cb = COMBOS.find((c) => c.id === id);
  if (cb) emit(EV.SAGE_SKILL_COMBINED, { player, id, from: cb.from.slice() });                       // Grande Sábio, Soberano, Usurpador...
  else if (sk.req?.length) emit(EV.SAGE_SKILL_EVOLVED, { player, id, from: sk.req.slice() });        // árvore: a nova habilidade evolui as requeridas
  if (sk.cat === "Magia") emit(EV.SAGE_MAGIC_LEARNED, { player, id, sk });
}
/** Dano no jogo -> PLAYER_ATTACKS (jogador causou) e PLAYER_TAKES_DAMAGE (jogador recebeu). */
function translateHurt(ev) {
  const hurt = ev.hurtEntity, src = ev.damageSource?.damagingEntity, damage = ev.damage, cause = ev.damageSource?.cause;
  if (hurt?.typeId === "minecraft:player") emit(EV.PLAYER_TAKES_DAMAGE, { player: hurt, damage, cause, attacker: src });
  if (src?.typeId === "minecraft:player" && hurt && hurt.id !== src.id) emit(EV.PLAYER_ATTACKS, { player: src, target: hurt, damage, cause });
}
/** Habilidade usada -> PLAYER_CASTS_MAGIC / PLAYER_TELEPORTS (habilidades de teleporte do addon). */
function translateSkillUsed({ player, id, sk }) {
  sk = sk ?? SKILLS[id];
  if (isMagicSkill(sk)) emit(EV.PLAYER_CASTS_MAGIC, { player, id, sk });
  if (sk?.exec?.kind === "teleport") announceTeleport(player, "skill", { id });
}
function announceTeleport(player, via, extra = {}) {
  const now = system.currentTick; if (now - (lastTp.get(player.id) ?? -9999) < TELEPORT_DEDUPE) return false;
  lastTp.set(player.id, now); lastPos.delete(player.id);
  emit(EV.PLAYER_TELEPORTS, { player, via, ...extra }); return true;
}
/** Salto de posição: um teleporte que o addon não emitiu (pérola do ender, /tp, comandos). Não conta morte/renascimento nem troca de dimensão. */
export function detectJumps(now = system.currentTick) {
  for (const p of world.getAllPlayers()) {
    try {
      const L = p.location, dim = p.dimension.id, prev = lastPos.get(p.id);
      lastPos.set(p.id, { x: L.x, y: L.y, z: L.z, dim });
      if (!prev || prev.dim !== dim) continue;
      if (Math.hypot(L.x - prev.x, L.y - prev.y, L.z - prev.z) >= TELEPORT_JUMP) announceTeleport(p, "jump", { from: { x: prev.x, y: prev.y, z: prev.z }, to: { x: L.x, y: L.y, z: L.z } });
    } catch { /* jogador inválido neste tick */ }
  }
}

// ================================================================ 2) REAÇÕES DO SÁBIO
/** Agrupa aquisições próximas (ex.: a raça inteira ao escolher) em UMA entrada de memória. */
function queueAcquired(player, id) {
  let b = batches.get(player.id);
  if (!b) { b = { ids: [], timer: 0 }; batches.set(player.id, b); }
  if (!b.ids.includes(id)) b.ids.push(id);
  if (b.timer) return;
  b.timer = system.runTimeout(() => {
    batches.delete(player.id); if (!isValid(player)) return;
    const ids = b.ids, first = ids.slice(0, 3).map(nameOf).join(", ");
    remember(player, "skill", ids.length === 1 ? `Adquiriu ${first}` : `Adquiriu ${ids.length} habilidades (${first}${ids.length > 3 ? "..." : ""})`);
  }, BATCH_TICKS);
}
const evoNames = (ids) => ids.map(nameOf).join(" + ");

function wireReactions() {
  on(EV.SKILL_LEARNED, translateSkillLearned);
  on(EV.SKILL_USED, translateSkillUsed);
  on(EV.PLAYER_DIMENSION_CHANGE, ({ player }) => { lastPos.delete(player.id); announceTeleport(player, "dimension"); });
  on(EV.PLAYER_RESPAWN, ({ player }) => { lastPos.delete(player.id); });   // renascer não é teleporte
  on(EV.PLAYER_LEAVE, ({ playerId }) => dropAdapter(playerId));

  on(EV.SAGE_SKILL_ACQUIRED, ({ player, id }) => { EvolutionManager.invalidate(player); queueAcquired(player, id); });
  on(EV.SAGE_SKILL_EVOLVED, ({ player, id, from }) => {
    EvolutionManager.invalidate(player);
    remember(player, "evo", `Habilidade evoluída: ${evoNames(from ?? [])} → ${nameOf(id)}`);
    learn(player, "evolutions", "skev_" + id, `Evolução: ${nameOf(id)}`, {}, true); addExp(player, 12);
    sageSay(player, "skill_evolved", { cd: 3000 });
  });
  on(EV.SAGE_SKILL_COMBINED, ({ player, id, from }) => {
    EvolutionManager.invalidate(player);
    remember(player, "evo", `Combinou ${evoNames(from ?? [])} em ${nameOf(id)}`);
    learn(player, "evolutions", "cmbd_" + id, `Combinação: ${nameOf(id)}`, {}, true); addExp(player, 15);
  });
  on(EV.SAGE_SKILL_REMOVED, ({ player, id, reason }) => {
    EvolutionManager.invalidate(player);
    remember(player, "skill", `Habilidade removida: ${nameOf(id)}${reason === "evolved" ? " (evoluiu)" : ""}`);
  });
  on(EV.SAGE_SKILL_AWAKENED, ({ player }) => { EvolutionManager.invalidate(player); });   // memória, vínculo e experiência já são registrados no despertar
  on(EV.SAGE_SKILL_MASTERED, ({ player, id }) => {
    EvolutionManager.invalidate(player);
    remember(player, "skill", `Maestria máxima: ${nameOf(id)}`); addExp(player, 10); addBond(player, 1);
    sageSay(player, "mastery_up", { cd: 3000 });
  });
  on(EV.PLAYER_EVOLVES, ({ player, kind, stage, name }) => {
    EvolutionManager.invalidate(player);
    if (kind !== "race") return;
    remember(player, "evo", `Evolução racial: ${name ?? stage}`);
    learn(player, "evolutions", "race_" + stage, `Raça: ${name ?? stage}`, {}, true); addExp(player, 15); addBond(player, 2);
    if (sageStage(getData(player)) >= 1) sageSay(player, "evo_done", { cd: 3000 });
  });
  on(EV.PLAYER_CRAFTS, ({ player, result, upgrade }) => {
    EvolutionManager.invalidate(player);
    const inf = ITEMS[result]; if (!inf) return;
    learn(player, inf.kind === "weapon" ? "weapons" : inf.kind === "armor" ? "armor" : inf.kind === "material" ? "materials" : "items", result, inf.name, { r: inf.rarity }, true);
    if (upgrade) remember(player, "forge", `Equipamento evoluído: ${inf.name}`);
  });
  on(EV.PLAYER_EQUIPS, ({ player, slots }) => {
    const main = slots?.[0]; if (!main || main === "-" || sageStage(getData(player)) < 1) return;
    const inf = ITEMS[main]; if (inf?.kind !== "weapon" || !SPECIAL_RARITY.has(inf.rarity)) return;
    suggest(player, "weapon." + main, `Arma especial equipada: ${inf.name}. Agache e use o Livro para a análise especial.`, { cd: 6000, quiet: true, pri: TIP_PRI.NORMAL });
  });
  on(EV.PLAYER_ATTACKS, ({ player, target }) => {
    if (!target || target.typeId === "minecraft:player") return;
    const key = "hit:" + target.typeId; if (!rateOk(player, key)) return;
    learn(player, "combat", key, `Combate: ${targetName(target)}`, {}, true);
  });
  on(EV.PLAYER_TAKES_DAMAGE, ({ player, cause }) => {
    if (!cause) return; const key = "dmg:" + cause; if (!rateOk(player, key)) return;
    learn(player, "combat", key, `Dano sofrido: ${CAUSE_NAME[cause] ?? pretty(cause)}`, {}, true);
  });
  on(EV.PLAYER_CASTS_MAGIC, ({ player, id }) => {   // usar uma magia também a mantém "fresca" no conhecimento (LRU) e no registro de magias
    const sk = SKILLS[id]; if (!sk || !rateOk(player, "cast:" + id)) return;
    learn(player, sk.cat === "Magia" ? "magic" : "skills", id, sk.name, sk.cat === "Magia" ? { spell: true } : {}, true);
  });
  on(EV.PLAYER_TELEPORTS, ({ player, via }) => { resetScan(player); Log.debug(`teleporte (${via}) de ${player.name}`, "Adaptador"); });
  const disc = (kind) => ({ player, name }) => {
    if (sageStage(getData(player)) < 1 || typingActive(player) || subtitleActive(player)) return;
    if (tipGate(player, "info.disc." + kind, TIP_PRI.LOW) !== 2) return;
    try { player.onScreenDisplay.setActionBar(`§b✦ §fNovo registro: §b${name}`); } catch { /* ignore */ }
  };
  on(EV.PLAYER_DISCOVERS_ENTITY, disc("entity"));
  on(EV.PLAYER_DISCOVERS_ITEM, disc("item"));
  on(EV.SAGE_ANALYSIS_DONE, ({ player }) => { EvolutionManager.invalidate(player); });
  on(EV.SAGE_STAGE_CHANGED, ({ player }) => { EvolutionManager.invalidate(player); markDirty(player); });
}

let started = false;
/** Liga tradutores e reações. Idempotente: pode ser chamado de novo sem duplicar nada. */
export function startSageAdapter() {
  if (started) return; started = true;
  wireReactions();
  try { world.afterEvents.entityHurt.subscribe(translateHurt); } catch (e) { Log.warning(`entityHurt indisponível: ${e}`, "Adaptador"); }
  system.runInterval(() => { try { detectJumps(); } catch (e) { Log.error(`detector de teleporte: ${e}`, "Adaptador"); } }, LOOP_TICKS);
}

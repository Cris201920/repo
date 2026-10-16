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
import { sageText } from "./voice.js";
import { threatOf, THREAT_NAME } from "./sagecombat.js";
import { QUESTS } from "../data/quests.js";
import { RARITY } from "../data/achievements.js";
import { nearestAchievements } from "./achievements.js";

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


// ================================================================ 6.54: GRANDE SÁBIO 2.0 — reações ao progresso real (sempre pelo portão de dicas: sem spam)
const RAR_PT = { epic: "épico", legendary: "lendário", mythic: "mítico", divine: "divino", rare: "raro" };
const DANGER_PLACES = new Set(["guy_dominio", "ninho_taratect", "inferno", "octagrama", "veldora_caverna"]);
/** Fala do Sábio passando pelo portão de prioridade/recarga/silêncio (sagetips). */
function speak(player, key, text, pri = TIP_PRI.NORMAL, cd, tries = 3) {
  const g = tipGate(player, key, pri, cd);
  // fala importante barrada só pela janela de silêncio (1): tenta de novo em 3 s, em vez de se perder
  if (g === 1 && pri <= TIP_PRI.HIGH && tries > 0) { system.runTimeout(() => { if (player.isValid) speak(player, key, text, pri, cd, tries - 1); }, 60); return false; }
  if (g !== 2) return false;
  try { return sageText(player, text, { pri: pri <= TIP_PRI.HIGH ? 2 : 4, key }); } catch { return false; }
}
const maxHpOf = (e) => { try { return e.getComponent("minecraft:health")?.effectiveMax ?? 20; } catch { return 20; } };
const hpFrac = (e) => { try { const h = e.getComponent("minecraft:health"); return h.currentValue / h.effectiveMax; } catch { return 1; } };
function countItems(player, test) {
  let n = 0; try { const c = player.getComponent("minecraft:inventory")?.container; for (let i = 0; i < (c?.size ?? 0); i++) { const it = c.getItem(i); if (it && test(it.typeId)) n += it.amount; } } catch { /* ignore */ }
  return n;
}
/** Uma habilidade defensiva/de cura que o jogador REALMENTE tem (para a recomendação), ou null. */
function defensiveSkill(d) {
  const ids = d.unlockedSkills ?? [];
  const pick = ids.find((id) => /heal|regen|barrier|shield|guard|parry|evasion|resist|scales|skin/.test(id) && SKILLS[id]?.type === "active");
  return pick ? SKILLS[pick].name : null;
}
function nextGoal(d) {
  const n = nearestAchievements(d, 1)[0]; if (!n) return null;
  return `${n.a.name} (${n.p[0]}/${n.p[1]})`;
}
function wireProgress() {
  on(EV.PLAYER_LEVEL_UP, ({ player, level }) => {
    const d = getData(player), st = sageStage(d); EvolutionManager.invalidate(player);
    if ([10, 16, 25, 30, 50, 75, 100].includes(level)) remember(player, "level", `Nível ${level} alcançado`);
    if (st < 1) return;
    let race = false; try { race = EvolutionManager.check(player, true).race.available; } catch { /* ignore */ }
    if (race) { speak(player, "evo.race.ready", "Evolução racial disponível. Verifique os requisitos no Relógio, em Raça, antes de iniciar o processo.", TIP_PRI.HIGH, 6000); return; }
    if (st >= 2 && d.attributePoints >= 5) { speak(player, "info.lvl.attr", `Nível ${level}. Há ${d.attributePoints} pontos de atributo livres; recomendo distribuí-los.`, TIP_PRI.NORMAL, 2400); return; }
    if (st >= 3) { const g = nextGoal(d); if (g) speak(player, "info.lvl.goal", `Nível ${level}. Objetivo mais próximo: ${g}.`, TIP_PRI.LOW, 3600); }
  });
  on(EV.QUEST_COMPLETED, ({ player, name }) => {
    const d = getData(player), st = sageStage(d);
    remember(player, "quest", `Missão concluída: ${name}`);
    if (st < 1) return;
    const act = Object.keys(d.quests.active ?? {}).filter((id) => QUESTS[id]);
    const tail = st < 2 ? "" : act.length ? ` Missões ativas: ${act.length}. Próxima sugerida: ${QUESTS[act[0]].name}.` : " Nenhuma missão ativa: recomendo procurar novos objetivos com os moradores ou na guilda.";
    speak(player, "info.quest.done", `Missão concluída: ${name}.${tail}`, TIP_PRI.NORMAL, 600);
  });
  on(EV.BOSS_ENCOUNTER, ({ player, name, maxHp, mech }) => {
    const d = getData(player), st = sageStage(d);
    remember(player, "boss", `Encontro com ${name}`);
    if (st < 1) return;
    const th = threatOf(maxHp ?? 0, maxHpOf(player));
    let t = `Análise concluída. ${name}: nível de ameaça ${THREAT_NAME[th]}.`;
    if (st >= 2 && mech) t += ` Mecânica observada: ${String(mech).split(";")[0]}.`;
    if (st >= 3) {
      const rec = [];
      if (hpFrac(player) < 0.6) rec.push("recupere a vida antes de avançar");
      const pots = countItems(player, (id) => /hp_potion|healing/.test(id)); rec.push(pots ? `poções de vida disponíveis: ${pots}` : "nenhuma poção de vida no inventário");
      const def = defensiveSkill(d); if (th >= 2 && def) rec.push(`recomendo ${def} quando o dano aumentar`);
      t += ` Recomendação: ${rec.join("; ")}.`;
    } else if (th >= 2) t += " Recomendo utilizar habilidades defensivas.";
    speak(player, "danger.boss." + name, t, th >= 2 ? TIP_PRI.HIGH : TIP_PRI.NORMAL, 6000);
  });
  on(EV.BOSS_DEFEATED, ({ player, name, noDeath }) => {
    remember(player, "boss", `Derrotou ${name}${noDeath ? " sem cair" : ""}`); addBond(player, 1); addExp(player, 8);
    if (sageStage(getData(player)) >= 1) speak(player, "info.boss.down." + name, `Ameaça neutralizada: ${name}.${noDeath ? " Nenhuma queda registrada durante o combate." : ""}`, TIP_PRI.NORMAL, 600);
  });
  on(EV.STRONG_ENEMY_DEFEATED, ({ player, name, ratio }) => {
    remember(player, "boss", `Venceu ${name}, ${Math.round(ratio)}x mais resistente`);
    if (sageStage(getData(player)) >= 1) speak(player, "info.giant", `Inimigo muito superior derrotado: ${name}. Desempenho registrado.`, TIP_PRI.NORMAL, 1800);
  });
  on(EV.REGION_DISCOVERED, ({ player, name }) => { remember(player, "place", `Região descoberta: ${name}`); });   // a fala da região já é feita em progress.js
  on(EV.STRUCTURE_DISCOVERED, ({ player, key, name, kindName, rare }) => {
    remember(player, "place", `${kindName}: ${name}`);
    if (sageStage(getData(player)) < 1) return;
    const danger = DANGER_PLACES.has(key);
    speak(player, "info.struct." + key, `${kindName} identificada: ${name}.${rare ? " Local raro." : ""}${danger ? " Alerta: presença de inimigos de alto nível. Recomendo cautela." : ""}`, danger ? TIP_PRI.HIGH : TIP_PRI.LOW, 600);
  });
  on(EV.RARE_ITEM, ({ player, name, rarity }) => {
    remember(player, "item", `Item ${RAR_PT[rarity] ?? rarity}: ${name}`);
    if (sageStage(getData(player)) >= 1) speak(player, "info.rare." + name, `Item ${RAR_PT[rarity] ?? rarity} identificado: ${name}. Agache e use o Livro para a análise completa.`, TIP_PRI.NORMAL, 1200);
  });
  on(EV.ACHIEVEMENT_UNLOCKED, ({ player, rarity }) => {
    EvolutionManager.invalidate(player);
    const o = RARITY[rarity]?.order ?? 0; addExp(player, 2 + o * 3); if (o >= 3) addBond(player, 1);
  });
  on(EV.PLAYER_JOIN, ({ player }) => {   // boas-vindas de quem volta (a primeira entrada já tem a cena do Sábio)
    const d = getData(player); if (sageStage(d) < 2 || (d.achievements ?? []).length === 0) return;
    const g = nextGoal(d);
    speak(player, "info.welcome", `Bem-vindo de volta. Conquistas registradas: ${d.achievements.length}.${g ? ` Objetivo mais próximo: ${g}.` : ""}`, TIP_PRI.LOW, 2400);
  });
  on(EV.PLAYER_RESPAWN, ({ player }) => { if (sageStage(getData(player)) >= 1) speak(player, "info.respawn", "Reconstrução concluída. Recomendo recuperar o equipamento com cautela.", TIP_PRI.LOW, 2400); });
}

let started = false;
/** Liga tradutores e reações. Idempotente: pode ser chamado de novo sem duplicar nada. */
export function startSageAdapter() {
  if (started) return; started = true;
  wireReactions(); wireProgress();
  try { world.afterEvents.entityHurt.subscribe(translateHurt); } catch (e) { Log.warning(`entityHurt indisponível: ${e}`, "Adaptador"); }
  system.runInterval(() => { try { detectJumps(); } catch (e) { Log.error(`detector de teleporte: ${e}`, "Adaptador"); } }, LOOP_TICKS);
}

// core/bus.js - Barramento de eventos interno (EventBus)
// Desacopla Habilidades, Grande Sábio, HUD, métricas e depuração: quem emite não conhece quem escuta.
// Um ouvinte com erro NUNCA derruba os outros nem quem emitiu (o erro é contado e registrado).

export const EV = Object.freeze({
  // jogador
  PLAYER_JOIN: "PLAYER_JOIN", PLAYER_LEAVE: "PLAYER_LEAVE", PLAYER_RESPAWN: "PLAYER_RESPAWN", PLAYER_DEATH: "PLAYER_DEATH",
  PLAYER_DIMENSION_CHANGE: "PLAYER_DIMENSION_CHANGE", PLAYER_LEVEL_UP: "PLAYER_LEVEL_UP", PLAYER_EVOLVE: "PLAYER_EVOLVES", PLAYER_EVOLVES: "PLAYER_EVOLVES",   // PLAYER_EVOLVE = nome antigo (mesmo evento)
  // habilidades
  SKILL_LEARNED: "SKILL_LEARNED", SKILL_EQUIPPED: "SKILL_EQUIPPED", SKILL_UNEQUIPPED: "SKILL_UNEQUIPPED", SKILL_REPLACED: "SKILL_REPLACED",
  SKILL_USED: "SKILL_USED", SKILL_FAILED: "SKILL_FAILED", SKILL_COOLDOWN: "SKILL_COOLDOWN", SKILL_SELECTED: "SKILL_SELECTED",
  SKILL_CAST_START: "SKILL_CAST_START", SKILL_CAST_CANCEL: "SKILL_CAST_CANCEL",
  // hotbar / inventário
  HOTBAR_SYNCED: "HOTBAR_SYNCED", HOTBAR_REPAIRED: "HOTBAR_REPAIRED", HOTBAR_ROLLBACK: "HOTBAR_ROLLBACK", HOTBAR_FULL: "HOTBAR_FULL",
  // ---- integração com o Grande Sábio: o resto do addon emite, o Sábio escuta (adaptadores em systems/sageadapter.js)
  PLAYER_GETS_SKILL: "PLAYER_GETS_SKILL", PLAYER_AWAKENS: "PLAYER_AWAKENS", PLAYER_CRAFTS: "PLAYER_CRAFTS", PLAYER_EQUIPS: "PLAYER_EQUIPS",
  PLAYER_ATTACKS: "PLAYER_ATTACKS", PLAYER_TAKES_DAMAGE: "PLAYER_TAKES_DAMAGE", PLAYER_TELEPORTS: "PLAYER_TELEPORTS", PLAYER_CASTS_MAGIC: "PLAYER_CASTS_MAGIC",
  PLAYER_DISCOVERS_ENTITY: "PLAYER_DISCOVERS_ENTITY", PLAYER_DISCOVERS_ITEM: "PLAYER_DISCOVERS_ITEM",
  // eventos de habilidade que o Sábio detecta
  SAGE_SKILL_ACQUIRED: "skill_acquired", SAGE_SKILL_EVOLVED: "skill_evolved", SAGE_SKILL_COMBINED: "skill_combined", SAGE_SKILL_REMOVED: "skill_removed",
  SAGE_SKILL_AWAKENED: "skill_awakened", SAGE_SKILL_MASTERED: "skill_mastered", SAGE_MAGIC_LEARNED: "magic_learned",
  // 6.54: progresso que o Grande Sábio acompanha (emitidos onde acontecem: quests.js, bossfight.js, progress.js, achievements.js)
  QUEST_COMPLETED: "QUEST_COMPLETED", BOSS_ENCOUNTER: "BOSS_ENCOUNTER", BOSS_DEFEATED: "BOSS_DEFEATED", REGION_DISCOVERED: "REGION_DISCOVERED",
  STRUCTURE_DISCOVERED: "STRUCTURE_DISCOVERED", RARE_ITEM: "RARE_ITEM", ACHIEVEMENT_UNLOCKED: "ACHIEVEMENT_UNLOCKED", STRONG_ENEMY_DEFEATED: "STRONG_ENEMY_DEFEATED",
  // eventos do próprio Sábio
  SAGE_STAGE_CHANGED: "sage_stage_changed", SAGE_ANALYSIS_START: "analysis_started", SAGE_ANALYSIS_DONE: "analysis_finished",
  SAGE_EVOLUTION_START: "evolution_started", SAGE_EVOLUTION_DONE: "evolution_finished", SAGE_DANGER: "danger_detected",
  SAGE_TARGET_LOCKED: "sage_target_locked", SAGE_TARGET_RELEASED: "sage_target_released", SAGE_ASSESS_STATE: "sage_assess_state", SAGE_TIP: "sage_tip",
});

const handlers = new Map();   // evento -> Set<fn>
const counts = new Map();     // evento -> emissões
let handlerErrors = 0;

export function on(evt, fn) {
  let set = handlers.get(evt); if (!set) { set = new Set(); handlers.set(evt, set); }
  set.add(fn);
  return () => off(evt, fn);
}
export function once(evt, fn) {
  const wrap = (p) => { off(evt, wrap); fn(p); };
  return on(evt, wrap);
}
export function off(evt, fn) { handlers.get(evt)?.delete(fn); }

export function emit(evt, payload = {}) {
  counts.set(evt, (counts.get(evt) ?? 0) + 1);
  const set = handlers.get(evt); if (!set || set.size === 0) return 0;
  let n = 0;
  for (const fn of [...set]) {
    try { fn(payload, evt); n++; }
    catch (e) { handlerErrors++; console.warn(`[Etheria] bus ${evt}: ${e}`); }
  }
  return n;
}

export function busStats() {
  const out = { handlerErrors, events: {} };
  for (const [k, v] of counts) out.events[k] = v;
  return out;
}
export function busReset() { handlers.clear(); counts.clear(); handlerErrors = 0; }

// systems/skillbar/index.js - Ponto de entrada da hotbar de habilidades (SkillItem / SkillRegistry / EquippedSkillManager /
// HotbarLoadout / SkillManager). Prioridade de verdade: UnlockedSkills > SAVE > LOADOUT > HOTBAR (itens) > UI.
import { world, system } from "@minecraft/server";
import { getData } from "../../core/db.js";
import { on, emit, EV } from "../../core/bus.js";
import { setCdHook, restoreCooldowns } from "../skills.js";
import { sysSay } from "../voice.js";
import { startSync, requestSync, markReady, dropSync, reconcile, metrics as syncMetrics } from "./sync.js";
import { showCooldown, refreshCooldownVisuals, dropManager, metrics as mgrMetrics } from "./manager.js";
import { startInput, dropInput } from "./input.js";
import { dropUi, flash } from "./ui.js";

export { EquippedSkillManager } from "./equipped.js";
export { HotbarLoadout } from "./loadout.js";
export { SkillManager } from "./api.js";

const readySet = new Set();
export const isReady = (id) => readySet.has(id);

export function startSkillBar() {
  setCdHook(showCooldown);
  startSync();
  startInput(isReady);
  world.afterEvents.playerDimensionChange.subscribe((ev) => { try { requestSync(ev.player, "dimension", 20); emit(EV.PLAYER_DIMENSION_CHANGE, { player: ev.player }); } catch { /* ignore */ } });
  world.afterEvents.entityDie.subscribe((ev) => { try { if (ev.deadEntity?.typeId === "minecraft:player") emit(EV.PLAYER_DEATH, { player: ev.deadEntity }); } catch { /* ignore */ } });
  // vozes do sistema só em eventos relevantes (equipar manual). Nunca fala ao ativar uma habilidade comum.
  on(EV.SKILL_EQUIPPED, ({ player, silent }) => { if (!silent) { try { sysSay(player, "skills", "equip", { cd: 400 }); } catch { /* ignore */ } } });
  // conjuração em fases: falhas que só aparecem na liberação (sem alvo, destino inválido) e interrupções viram uma linha discreta na barra de ação
  on(EV.SKILL_FAILED, ({ player, msg, late }) => { if (late) flash(player, `§e${msg}`, 25); });
  on(EV.SKILL_CAST_CANCEL, ({ player, reason }) => { if (reason !== "saiu") flash(player, "§7Conjuração interrompida.", 25); });
}

/** Chamado a cada spawn/respawn/login: restaura recargas e confere os itens depois que o inventário estiver carregado. */
export function onPlayerReady(player, first = false) {
  readySet.add(player.id); markReady(player.id);
  try { getData(player); restoreCooldowns(player); } catch (e) { console.warn(`[Etheria] restaurar recargas: ${e}`); }
  requestSync(player, first ? "join" : "spawn", 10);
  system.runTimeout(() => { try { refreshCooldownVisuals(player); } catch { /* ignore */ } }, 24);
  emit(first ? EV.PLAYER_JOIN : EV.PLAYER_RESPAWN, { player });
}

export function dropSkillBar(id) { readySet.delete(id); dropSync(id); dropManager(id); dropInput(id); dropUi(id); emit(EV.PLAYER_LEAVE, { playerId: id }); }

/** Diagnóstico (comando de admin): contadores internos. */
export function skillbarMetrics() { return { sync: { ...syncMetrics }, manager: { ...mgrMetrics } }; }

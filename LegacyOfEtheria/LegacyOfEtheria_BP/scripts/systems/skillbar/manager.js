// systems/skillbar/manager.js - SkillManager: ativa a habilidade de um item e mostra a recarga no slot
// Sequência de uso (cada passo é isolado; um erro nunca deixa recurso gasto sem efeito):
//   1 detectar o item/slot (input.js) · 2 validar requisitos · 3 recarga · 4 recursos · 5 animação/som/partículas/efeito/dano
//   (castSkill + skillfx) · 6 iniciar recarga (nativa no slot + interna) · 7 atualizar a UI · 8 evento para o Grande Sábio (bus)
import { system } from "@minecraft/server";
import { SKILLBAR, SOUNDS } from "../../config.js";
import { SKILLS } from "../../data/skills.js";
import { playSound } from "../../core/utils.js";
import { emit, EV } from "../../core/bus.js";
import { castSkill, checkCast, noteCastFailure, listCooldowns, CAST } from "../skills.js";
import { cooldownCategory } from "./registry.js";
import { requestSync } from "./sync.js";
import { flash, pushHud } from "./ui.js";

export const STATE = CAST;
export const metrics = { uses: 0, ok: 0, fail: 0, debounced: 0, cdShown: 0, cdErrors: 0 };

/** Estado atual de uma habilidade para a UI (sem efeitos colaterais). */
export function skillState(player, id) { return checkCast(player, id); }

let cdWarned = false;
/** Animação nativa de recarga sobre o ícone do slot (categoria própria por habilidade). */
export function showCooldown(player, id, ticks) {
  try { player.startItemCooldown(cooldownCategory(id), Math.max(1, Math.floor(ticks))); metrics.cdShown++; }
  catch (e) { metrics.cdErrors++; if (!cdWarned) { cdWarned = true; console.warn(`[Etheria] recarga nativa indisponível: ${e}`); } }
}
/** Reaplica a animação de recarga nos itens (login/respawn): as recargas continuam valendo, só a animação some. */
export function refreshCooldownVisuals(player) {
  for (const { id, left } of listCooldowns(player)) showCooldown(player, id, left * 20);
}

const lastUse = new Map();
const lastNoRes = new Map();
export const dropManager = (id) => { lastUse.delete(id); lastNoRes.delete(id); };

/** Usa a habilidade do item (via = "use" | "block" | "menu"). Retorna o resultado do lançamento. */
export function activate(player, id, via = "use") {
  const now = system.currentTick;
  if (now - (lastUse.get(player.id) ?? -999) < SKILLBAR.useDebounce) { metrics.debounced++; return { ok: false, state: "DEBOUNCE", quiet: true }; }
  lastUse.set(player.id, now);
  metrics.uses++;
  let r;
  try { r = castSkill(player, id); }
  catch (e) { console.warn(`[Etheria] activate ${id}: ${e}`); r = { ok: false, state: CAST.ERROR, msg: "Erro ao lançar." }; }
  if (r.ok) { metrics.ok++; pushHud(player); return r; }
  metrics.fail++;
  const sk = SKILLS[id];
  switch (r.state) {
    case CAST.COOLDOWN: flash(player, `§8${sk?.name ?? "Habilidade"}: §7${Math.ceil(r.left)}s`, 15); break;           // o slot já mostra a animação
    case CAST.NO_RESOURCE:
      if (now - (lastNoRes.get(player.id) ?? -999) >= SKILLBAR.noResourceCooldown) { lastNoRes.set(player.id, now); flash(player, "§cRecursos insuficientes.", 25); playSound(player, SOUNDS.fail, 0.4, 1.2); }
      break;
    case CAST.DISABLED: flash(player, `§c${r.msg}`, 25); break;
    case CAST.BUSY: break;                                                    // já há uma conjuração em andamento: silêncio
    case CAST.NO_TARGET: flash(player, `§e${r.msg}`, 25); break;
    case CAST.LOCKED: flash(player, "§cHabilidade indisponível.", 25); requestSync(player, "locked", 1); break;
    default: flash(player, `§c${r.msg ?? "Não foi possível lançar."}`, 25);
  }
  noteCastFailure(player, r);
  return r;
}

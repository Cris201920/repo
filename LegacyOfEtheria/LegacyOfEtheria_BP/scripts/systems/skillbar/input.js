// systems/skillbar/input.js - Entrada: usa a habilidade do item na mão e detecta a troca de slot
// Só eventos REAIS do @minecraft/server 1.17.0: afterEvents.itemUse, beforeEvents.playerInteractWithBlock e a leitura de
// player.selectedSlotIndex (não existe evento de troca de slot: leitura leve a cada `pollTicks`, somente de jogadores prontos).
import { world, system, Player } from "@minecraft/server";
import { SKILLBAR } from "../../config.js";
import { getData } from "../../core/db.js";
import { inventory, isValid } from "../../core/utils.js";
import { emit, EV } from "../../core/bus.js";
import { skillIdOfItem } from "./registry.js";
import { activate } from "./manager.js";
import { onSelect, pushHud } from "./ui.js";

const lastSel = new Map();   // playerId -> { slot, id }
export const dropInput = (id) => lastSel.delete(id);

function blockInteractOn(p) {
  try { return getData(p).settings?.skillbar?.blockInteract !== false; } catch { return true; }
}

export function startInput(isReady) {
  // 1) Usar o item da habilidade (toque/clique em uso). Funciona no ar e, se o jogo mandar, em cima de blocos.
  world.afterEvents.itemUse.subscribe((ev) => {
    try {
      const p = ev.source, it = ev.itemStack;
      if (!(p instanceof Player) || !it) return;
      const id = skillIdOfItem(it.typeId); if (id === null) return;
      activate(p, id, "use");
    } catch (e) { console.warn(`[Etheria] itemUse habilidade: ${e}`); }
  });

  // 2) Com uma habilidade na mão, tocar num bloco interativo (baú, bancada, porta) lança a habilidade em vez de abrir o bloco.
  //    Agachar libera a interação normal. (Evento "before": só cancela; o lançamento é adiado para o próximo tick.)
  try {
    world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
      const it = ev.itemStack; if (!it) return;
      const id = skillIdOfItem(it.typeId); if (id === null) return;
      const p = ev.player;
      if (p.isSneaking || !blockInteractOn(p)) return;
      ev.cancel = true;
      if (ev.isFirstEvent) system.run(() => { try { if (isValid(p)) activate(p, id, "block"); } catch (e) { console.warn(`[Etheria] interação habilidade: ${e}`); } });
    });
  } catch (e) { console.warn(`[Etheria] playerInteractWithBlock indisponível: ${e}`); }

  // 3) Troca de slot: feedback discreto (som suave + linha da habilidade na HUD)
  system.runInterval(() => {
    let players; try { players = world.getAllPlayers(); } catch { return; }
    for (const p of players) {
      if (isReady && !isReady(p.id)) continue;
      try {
        const slot = p.selectedSlotIndex, prev = lastSel.get(p.id);
        if (prev && prev.slot === slot) continue;
        const c = inventory(p), s = c?.getSlot(slot);
        const id = s && s.hasItem() ? skillIdOfItem(s.typeId) : null;
        lastSel.set(p.id, { slot, id });
        if (id !== null) { onSelect(p, id); emit(EV.SKILL_SELECTED, { player: p, id, slot }); }
        else if (prev && prev.id !== null) pushHud(p);   // saiu de uma habilidade: limpa a linha
      } catch { /* jogador inválido neste tick */ }
    }
  }, SKILLBAR.pollTicks);
}

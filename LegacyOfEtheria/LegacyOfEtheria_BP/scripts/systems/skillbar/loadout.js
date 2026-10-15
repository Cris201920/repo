// systems/skillbar/loadout.js - HotbarLoadout: onde cada habilidade equipada "mora" (slot do inventário)
// É só uma visão dos dados salvos (d.loadout.pos); o estado FÍSICO real é lido do inventário em sync.js.
// Três camadas independentes (nunca misturadas):
//   Desbloqueadas (d.unlockedSkills)  -> o que o jogador APRENDEU (progresso; nunca se perde)
//   Equipadas     (d.equippedSkills)  -> as que ele escolheu carregar como item (até MAX_SLOTS)
//   Hotbar        (d.loadout.pos)     -> em qual slot cada item fica (0-8 = hotbar, 9-35 = mochila)
import { HOTBAR_SIZE, INV_SIZE } from "../../config.js";

export const HotbarLoadout = {
  /** Slot salvo da habilidade (0-35) ou -1 se ainda não foi colocada. */
  slotOf(d, id) { const p = d.loadout?.pos?.[id]; return Number.isInteger(p) ? p : -1; },
  /** Equipadas que estão na hotbar, ordenadas por slot: [{ slot, id }]. */
  hotbar(d) {
    return d.equippedSkills.map((id) => ({ id, slot: this.slotOf(d, id) })).filter((e) => e.slot >= 0 && e.slot < HOTBAR_SIZE).sort((a, b) => a.slot - b.slot);
  },
  /** Equipadas fora da hotbar (na mochila ou ainda sem item): [id]. */
  bag(d) { return d.equippedSkills.filter((id) => { const s = this.slotOf(d, id); return s < 0 || s >= HOTBAR_SIZE; }); },
  /** Qual habilidade equipada (se houver) ocupa o slot salvo. */
  idAt(d, slot) { for (const id of d.equippedSkills) if (this.slotOf(d, id) === slot) return id; return null; },
  /** Registra a posição (somente dados). Garante um id por slot. */
  set(d, id, slot) {
    if (!d.loadout) d.loadout = { v: 1, pos: {} }; if (!d.loadout.pos) d.loadout.pos = {};
    if (!Number.isInteger(slot) || slot < 0 || slot >= INV_SIZE) { delete d.loadout.pos[id]; return; }
    for (const k of Object.keys(d.loadout.pos)) if (k !== id && d.loadout.pos[k] === slot) delete d.loadout.pos[k];
    d.loadout.pos[id] = slot;
  },
  clear(d, id) { if (d.loadout?.pos) delete d.loadout.pos[id]; },
  /** Texto "Slot N" (1-9) para a hotbar, "Mochila" fora dela e "—" se ainda sem item. */
  label(d, id) { const s = this.slotOf(d, id); return s < 0 ? "—" : s < HOTBAR_SIZE ? `Slot ${s + 1}` : "Mochila"; },
};

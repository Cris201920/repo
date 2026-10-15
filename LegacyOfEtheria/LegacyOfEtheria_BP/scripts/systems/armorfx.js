import { sageText } from "./voice.js";
// systems/armorfx.js - Conjuntos de armadura: contagem de peças, mensagens de equipar/remover, aura (conjunto completo) e passivas.
// Roda a cada 20 ticks só nos jogadores; partículas respeitam o nível de detalhe (fxlib). Sem entidades auxiliares.
import { world, system } from "@minecraft/server";
import { ITEMS } from "../data/items.gen.js";
import { SET_DEFS, PASSIVES } from "../data/armor.gen.js";
import { getData } from "../core/db.js";
import { say, isValid } from "../core/utils.js";
import { ctx, mote, ringFlat, column, burst, T } from "./fxlib.js";

const SLOTS = ["Head", "Chest", "Legs", "Feet"];
const state = new Map(); // playerId -> { sets: {id:n}, tick }
const AURA_COL = { void: "void", earth: "earth", ice: "ice", fire: "fire", bolt: "bolt", holy: "holy", green: "toxic", blood: "blood", arcane: "arcane", shadow: "shadow" };

/** Quantas peças de cada conjunto o jogador está usando. */
export function setCounts(player) {
  const out = {}; let eq; try { eq = player.getComponent("minecraft:equippable"); } catch { return out; }
  if (!eq) return out;
  for (const s of SLOTS) { let it; try { it = eq.getEquipment(s); } catch { /* ignore */ } const inf = it && ITEMS[it.typeId]; if (inf?.kind === "armor" && inf.set) out[inf.set] = (out[inf.set] ?? 0) + 1; }
  return out;
}
export const fullSet = (player) => { for (const [id, n] of Object.entries(setCounts(player))) if (n >= 4 && SET_DEFS[id]) return id; return null; };

const eff = (e, id, ticks, amp = 0, show = false) => { try { e.addEffect(id, ticks, { amplifier: amp, showParticles: show }); } catch { /* ignore */ } };
const hpFrac = (p) => { try { const h = p.getComponent("minecraft:health"); return h.currentValue / h.effectiveMax; } catch { return 1; } };
const foes = (p, r) => { try { return p.dimension.getEntities({ location: p.location, maxDistance: r, families: ["monster"], excludeTags: ["etheria_ally"] }).slice(0, 12); } catch { return []; } };

// passivas: id -> (player, tick, ctx) — roda a cada 20 ticks com o conjunto COMPLETO
const PASS = {
  guard: (p) => { if (hpFrac(p) < 0.35) eff(p, "resistance", 60, 0); },
  arcane_ward: (p) => eff(p, "absorption", 60, 1),
  shadow_veil: (p) => { if (p.isSneaking) { eff(p, "invisibility", 40, 0); eff(p, "speed", 40, 1); } },
  dragon_scales: (p) => { eff(p, "resistance", 60, 0); eff(p, "fire_resistance", 60, 0); },
  star_guard: (p) => { eff(p, "regeneration", 60, 0); eff(p, "absorption", 60, 0); },
  void_veil: (p) => { eff(p, "night_vision", 260, 0); eff(p, "slow_falling", 60, 0); },
  stone_skin: (p) => eff(p, "resistance", 60, hpFrac(p) < 0.5 ? 1 : 0),
  frost_aura: (p) => { for (const e of foes(p, 7)) eff(e, "slowness", 50, 1, true); },
  flame_aura: (p) => { eff(p, "fire_resistance", 60, 0); for (const e of foes(p, 5)) { try { e.setOnFire(3, true); } catch { /* ignore */ } } },
  storm_step: (p) => { eff(p, "speed", 60, 1); },
  holy_regen: (p) => { if (hpFrac(p) < 0.8) eff(p, "regeneration", 60, 0); },
  toxic_cloud: (p) => { try { p.removeEffect("poison"); } catch { /* ignore */ } for (const e of foes(p, 5)) eff(e, "poison", 60, 0, true); },
  blood_pact: (p) => { if (hpFrac(p) < 0.5) eff(p, "strength", 60, 0); },
};

function announce(p, id, before, now) {
  const def = SET_DEFS[id]; if (!def) return;
  const name = def.name;
  if (now > before) {
    try { p.playSound(now >= 4 ? "random.levelup" : "armor.equip_iron", { volume: 0.7, pitch: now >= 4 ? 1.3 : 1 }); } catch { /* ignore */ }
    // 6.38: sem chat — o bônus ativado vira uma fala curta do Sábio; contagem parcial sem bônus fica só na descrição do item
    if (now >= 2 && now <= 4 && def.b[now]) sageText(p, `Conjunto ${name}: ${now} peças — bônus ${def.b[now].text}.`, { pri: 6, key: "set." + name + now });
    if (now >= 4) {
      try { p.onScreenDisplay.setActionBar(`§6✦ §e${name} §6— conjunto completo!${def.passive ? " §7" + (PASSIVES[def.passive] ?? "").split(":")[0] : ""}`); } catch { /* ignore */ }
      if (def.ptext) say(p, `§6[Passiva] §f${def.ptext}`);
      const c = ctx(p, 1), pos = { x: p.location.x, y: p.location.y, z: p.location.z }, k = AURA_COL[def.aura] ?? "gold";
      ringFlat(c, pos, { col: k, n: 18, radius: 2.2, life: 0.6, size: 0.3, tile: T.ring }); column(c, pos, { col: k, n: 10, h: 2.4, life: 0.8, size: 0.25, tile: T.spark }); burst(c, { x: pos.x, y: pos.y + 1, z: pos.z }, { col: "white", n: 8, spd: 1.5, size: 0.2, tile: T.star });
    }
  } else if (now < before) {
    try { p.playSound("armor.equip_generic", { volume: 0.6, pitch: 0.8 }); } catch { /* ignore */ }
    say(p, `§7[Conjunto ${name}] §8${now}/4 peças.${before >= 4 ? " §cPassiva desativada." : ""}`);
    if (before >= 4) { const c = ctx(p, 1); burst(c, { x: p.location.x, y: p.location.y + 1, z: p.location.z }, { col: AURA_COL[def.aura] ?? "gray", n: 6, spd: 0.8, size: 0.2, tile: T.blob }); }
  }
}

let n = 0;
function tick() {
  n++;
  for (const p of world.getAllPlayers()) {
    if (!isValid(p)) continue;
    const now = setCounts(p), s = state.get(p.id) ?? { sets: {} }, prev = s.sets;
    for (const id of new Set([...Object.keys(now), ...Object.keys(prev)])) { const a = prev[id] ?? 0, b = now[id] ?? 0; if (a !== b) announce(p, id, a, b); }
    s.sets = now; state.set(p.id, s);
    for (const [id, cnt] of Object.entries(now)) {
      const def = SET_DEFS[id]; if (!def) continue;
      if (cnt >= 4) {
        PASS[def.passive]?.(p);
        if (def.aura) { // aura do conjunto completo (só conjuntos mágicos); a cada 40 ticks para poupar partículas
          if (n % 2 === 0) { const c = ctx(p, 1), k = AURA_COL[def.aura] ?? "gold", L = p.location; mote(c, { x: L.x + (Math.random() - .5) * .9, y: L.y + .2 + Math.random() * 1.6, z: L.z + (Math.random() - .5) * .9 }, { col: k, dir: [0, 1, 0], spd: .5, size: .2, life: .9, tile: def.aura === "bolt" ? T.spark : T.blob }); }
        }
      } else if (cnt >= 2 && def.aura && n % 4 === 0) { const c = ctx(p, 0.5), L = p.location; mote(c, { x: L.x, y: L.y + 1, z: L.z }, { col: AURA_COL[def.aura] ?? "gold", dir: [0, 1, 0], spd: .3, size: .15, life: .6, tile: T.spark }); }
    }
  }
}
export function startArmorFx() { system.runInterval(tick, 20); world.afterEvents.playerLeave.subscribe((e) => state.delete(e.playerId)); }

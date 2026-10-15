// systems/residents.js - 6.44: MORADORES DAS ESTRUTURAS DO MUNDO (Reino Sagrado de Luminus, Domínio de Guy Crimson).
// As estruturas são geradas por systems/worldgen.js (registro salvo no mundo). Quando um jogador chega perto (e o chunk está carregado),
// cada posto de morador é preenchido UMA vez: tag única por estrutura + posto, sem duplicar; quem some é reposto depois de um tempo.
// Personagens (ex.: Hinata) nascem calmos (diálogo, systems/characters.js) e ficam perto do posto; NPCs comuns usam home + passeio.
import { world, system } from "@minecraft/server";
import { WGEN, wgRecords } from "./worldgen.js";
import { isValid } from "../core/utils.js";
import { CHARACTERS } from "../data/characters.js";
import { MOBS } from "../data/mobs.gen.js";

// [tipo, dx, dz] a partir do centro da estrutura (o portão fica no lado +Z)
export const RESIDENTS = {
  luminus_reino: [["etheria:tt_hinata", 0, -8], ["etheria:npc_lm_knight", -5, 50], ["etheria:npc_lm_knight", 5, 50], ["etheria:npc_lm_knight", -22, 4], ["etheria:npc_lm_knight", 22, 4], ["etheria:npc_lm_knight", 0, 24]],
  ceu_veldanava: [["etheria:sabio_branco", 6, 40]],                                    // Guardião da Memória, na chegada do Domínio de Veldanava
  guy_dominio: [["etheria:npc_gc_envoy", 0, -10], ["etheria:npc_gc_soldier", -5, 40], ["etheria:npc_gc_soldier", 5, 40], ["etheria:npc_gc_servant", -8, 6], ["etheria:npc_gc_merchant", 9, 2]],
};
const NEAR = 96, RESPAWN = 12000, LEASH = 6;
const TAG = "etheria_wres", CALM = "etheria_calm", DUEL = "etheria_duel";
const gone = new Map();      // tag do posto -> tick em que sumiu
const SEEN_KEY = "etheria:wres";   // postos já preenchidos alguma vez (salvo no mundo): só esses esperam o tempo de reposição
let SEEN = null;
const seen = () => { if (SEEN) return SEEN; try { SEEN = JSON.parse(world.getDynamicProperty(SEEN_KEY) ?? "{}") ?? {}; } catch { SEEN = {}; } return SEEN; };
const markSeen = (tag) => { const s = seen(); if (s[tag]) return; s[tag] = 1; try { world.setDynamicProperty(SEEN_KEY, JSON.stringify(s)); } catch { /* ignore */ } };
const homes = new Map();     // tag do posto -> { posição, dimensão } (personagens)
const blockAt = (dim, x, y, z) => { try { return dim.getBlock({ x, y, z }); } catch { return undefined; } };
function standAt(dim, x, y, z) {
  const ok = (px, py, pz) => { const a = blockAt(dim, px, py, pz), b = blockAt(dim, px, py + 1, pz), g = blockAt(dim, px, py - 1, pz); return a && b && g && a.isAir && b.isAir && !g.isAir && !g.isLiquid; };
  for (const dy of [0, 1, -1, 2, -2, 3, -3, 4, 5, 6, 7, 8]) for (let r = 0; r <= 4; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    if (ok(x + dx, y + dy, z + dz)) return { x: x + dx + 0.5, y: y + dy, z: z + dz + 0.5 };
  }
  return null;
}
const slotTag = (rec, i) => `wr_${rec.k}_${rec.x}_${rec.z}_${i}`;
const charId = (t) => t.slice(8);

export function ensureResidents(rec, now = system.currentTick) {
  const list = RESIDENTS[rec.k], def = WGEN[rec.k]; if (!list || !def) return { spawned: 0, present: 0 };
  let dim; try { dim = world.getDimension(rec.d); } catch { return { spawned: 0, present: 0 }; }
  const baseY = rec.y + def.floor + 1; if (!blockAt(dim, rec.x, baseY, rec.z)) return { spawned: 0, present: 0 };   // chunk ainda não carregado
  let spawned = 0, present = 0;
  list.forEach(([type, dx, dz], i) => {
    const tag = slotTag(rec, i);
    let ents = []; try { ents = dim.getEntities({ tags: [tag] }).filter(isValid); } catch { /* ignore */ }
    if (ents.length > 1) for (const x of ents.slice(1)) { try { x.remove(); } catch { /* ignore */ } }
    if (ents.length) { present++; gone.delete(tag); markSeen(tag); if (CHARACTERS[charId(type)] && !homes.has(tag)) homes.set(tag, { ...ents[0].location, d: rec.d }); return; }
    if (seen()[tag]) {                                   // já existiu: sumiu (morreu ou está num chunk ainda não carregado) -> espera antes de repor
      if (!gone.has(tag)) gone.set(tag, now);
      if (now - gone.get(tag) < RESPAWN) return;
    }
    if (!MOBS[type] && !type.includes(":npc_")) return;
    const pos = standAt(dim, rec.x + dx, baseY, rec.z + dz); if (!pos) return;
    try {
      const e = dim.spawnEntity(type, pos); e.addTag(TAG); e.addTag(tag); spawned++; gone.delete(tag); markSeen(tag);
      const C = CHARACTERS[charId(type)];
      if (C) { e.addTag(CALM); try { e.triggerEvent("etheria:calm"); } catch { /* ignore */ } try { e.nameTag = C.name; } catch { /* ignore */ } homes.set(tag, { ...pos, d: rec.d }); }
    } catch { /* tenta no próximo ciclo */ }
  });
  return { spawned, present };
}

export function startResidents() {
  system.runInterval(() => {
    try {
      const ps = world.getAllPlayers(); if (!ps.length) return;
      for (const rec of wgRecords()) {
        if (!RESIDENTS[rec.k]) continue;
        if (!ps.some((p) => p.dimension.id === rec.d && Math.hypot(p.location.x - rec.x, p.location.z - rec.z) < NEAR)) continue;
        ensureResidents(rec);
      }
    } catch (e) { console.warn(`[Etheria] moradores: ${e}`); }
  }, 100);
  // personagens calmos ficam perto do posto (passeiam, mas não se perdem); em duelo, ficam livres
  system.runInterval(() => {
    for (const [tag, h] of homes) {
      let e; try { e = world.getDimension(h.d ?? "minecraft:overworld").getEntities({ tags: [tag] })[0]; } catch { continue; }
      if (!e || !isValid(e) || e.hasTag(DUEL) || !e.hasTag(CALM)) continue;
      if (Math.hypot(e.location.x - h.x, e.location.z - h.z) > LEASH || Math.abs(e.location.y - h.y) > 4) { try { e.teleport({ x: h.x, y: h.y, z: h.z }); } catch { /* ignore */ } }
    }
  }, 40);
}

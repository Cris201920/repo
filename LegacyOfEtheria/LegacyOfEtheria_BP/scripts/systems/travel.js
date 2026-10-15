// systems/travel.js - REGISTRO DE LOCAIS DO MUNDO (WORLD_LOCATIONS), viagem posterior entre cidades já conhecidas e identificação do local na chegada.
// Cada local sabe: como garantir a estrutura (ensure -> cb(ponto seguro | null)), o nome exibido e o subtítulo. Nunca se viaja para um destino vazio:
// se a estrutura não pôde ser garantida (ou o ponto de entrada não é seguro), a viagem é cancelada com aviso.
import { world, system } from "@minecraft/server";
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, toast, playSound } from "../core/utils.js";
import { SETTLEMENTS, FACTIONS } from "../data/factions.js";
import { REGION_CITIES } from "../data/origins.js";
import { ensureTempest, tempestInfo } from "./tempest.js";
import { ensureSettlement, settlementInfo } from "./settlements.js";

const COOLDOWN_TICKS = 20 * 30;          // 30 s entre viagens (evita spam de construção/teleporte)
const lastTravel = new Map();            // playerId -> tick

/** WORLD_LOCATIONS: id -> { id, name, sub, ensure(cb, progress), info() } */
export const WORLD_LOCATIONS = {
  tempest: { id: "tempest", name: "TEMPEST", sub: "Reino de Jura Tempest", ensure: (cb, progress) => ensureTempest(cb, 0, progress), info: () => tempestInfo() },
};
for (const def of Object.values(REGION_CITIES)) {
  WORLD_LOCATIONS[def.id] = { id: def.id, name: def.name.toUpperCase(), sub: FACTIONS[def.faction]?.name ?? "", ensure: (cb) => ensureSettlement(def, cb), info: () => settlementInfo(def.id) };
}
for (const def of Object.values(SETTLEMENTS)) {
  if (WORLD_LOCATIONS[def.id]) continue;
  WORLD_LOCATIONS[def.id] = { id: def.id, name: def.name.toUpperCase(), sub: FACTIONS[def.faction]?.name ?? "", ensure: (cb) => ensureSettlement(def, cb), info: () => settlementInfo(def.id) };
}
export const LOCATION_LIST = Object.values(WORLD_LOCATIONS);

/** "place" de uma origem (data/origins.js) -> id do local. */
export function locationOfPlace(place) {
  if (place === "tempest") return "tempest";
  const [kind, id] = String(place).split(":");
  return kind === "settlement" || kind === "city" ? id : null;
}

export const visitedOf = (d) => (Array.isArray(d.visited) ? d.visited : (d.visited = []));
export function markVisited(player, id) {
  if (!WORLD_LOCATIONS[id]) return false;
  const d = getData(player), v = visitedOf(d);
  if (v.includes(id)) return false;
  v.push(id); markDirty(player); return true;
}

/** Anuncia o local na tela ("[ TEMPEST ] Reino de Jura Tempest"). */
export function announceLocation(player, id) {
  const L = WORLD_LOCATIONS[id]; if (!L) return;
  try { toast(player, `§b§l[ ${L.name} ]`, `§7${L.sub}`); } catch { /* ignore */ }
}

/** Leva o jogador a um local JÁ CONHECIDO: garante a estrutura, valida o ponto e só então teleporta. cb(ok) opcional. */
export function travelTo(player, id, cb = () => {}) {
  const L = WORLD_LOCATIONS[id]; if (!L) { say(player, "§cLocal desconhecido."); return cb(false); }
  const d = getData(player);
  if (!visitedOf(d).includes(id)) { say(player, "§cVocê ainda não conhece esse lugar."); return cb(false); }
  const now = system.currentTick, last = lastTravel.get(player.id) ?? -1e9;
  if (now - last < COOLDOWN_TICKS) { say(player, `§eAguarde ${Math.ceil((COOLDOWN_TICKS - (now - last)) / 20)}s para viajar de novo.`); return cb(false); }
  lastTravel.set(player.id, now);
  const pid = player.id;
  say(player, `§7Preparando a viagem para §f${L.name}§7...`);
  L.ensure((pos) => {
    const p = world.getAllPlayers().find((x) => x.id === pid); if (!p) return cb(false);
    if (!pos) { lastTravel.delete(pid); say(p, `§c${L.name} ainda não pôde ser preparada. Tente de novo em instantes.`); return cb(false); }
    try { p.teleport({ x: pos.x, y: pos.y, z: pos.z }, { dimension: world.getDimension("minecraft:overworld"), rotation: { x: 0, y: pos.yaw ?? 0 } }); }
    catch (e) { console.warn(`[Etheria] viagem: ${e}`); say(p, "§cNão consegui te levar até lá. Tente de novo."); return cb(false); }
    try { playSound(p, "mob.endermen.portal", 0.8, 1); } catch { /* ignore */ }
    announceLocation(p, id); cb(true);
  });
}

/** Marca como conhecido o local onde o jogador está (a cada ~5 s): chegar perto de uma cidade já construída a torna destino de viagem. */
export function startTravelWatch() {
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        if (p.dimension.id !== "minecraft:overworld") continue;
        const l = p.location;
        for (const L of LOCATION_LIST) {
          const i = L.info(); if (!i || i.built === false || (i.total !== undefined && i.done < Math.ceil(i.total * 0.5))) continue;
          if (Math.hypot(l.x - i.x, l.z - i.z) < 70 && markVisited(p, L.id)) { announceLocation(p, L.id); say(p, `§6[Mundo] §f${L.name} agora é um destino de viagem. Use §e!mundo§f > Territórios > Viajar.`); }
        }
      } catch { /* ignore */ }
    }
  }, 100);
}

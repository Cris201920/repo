// systems/structures.js - Gera estruturas portadas (dados em data/structures.gen.js) no mundo.
// Colocação progressiva (poucos blocos por tick) para não travar o celular. Natural: perto de jogadores, 1 por célula de 256x256.
import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";
import { STRUCTURES } from "../data/structures.gen.js";
import { say, pick, chance, toast } from "../core/utils.js";
import { WORLD } from "../data/arenas.gen.js";
import { withLoaded } from "./arenas.js";
import { placeFile, clampOrigin } from "./placer.js";

const PER_TICK = 450;
const permCache = new Map();
const FALLBACK = "minecraft:stone_bricks";

function perm(entry) {
  const key = JSON.stringify(entry);
  if (permCache.has(key)) return permCache.get(key);
  let p;
  try { p = BlockPermutation.resolve(entry[0], entry[1] ?? {}); } catch {
    try { p = BlockPermutation.resolve(entry[0]); } catch { p = BlockPermutation.resolve(FALLBACK); }
  }
  permCache.set(key, p);
  return p;
}

const busy = new Set();

/** 6.24: colocação INSTANTÂNEA (structureManager.place do .mcstructure world_<id>); se o arquivo falhar, cai no método antigo bloco a bloco e registra o erro */
export function placeStructure(dim, origin, id, done) {
  const s = STRUCTURES[id], w = WORLD[id];
  if (!s) return false;
  if (!w) return placeProgressive(dim, origin, id, done);
  const o = clampOrigin(dim, origin, w.size ?? s.size), tag = id + o.x + o.z;
  if (busy.has(tag)) return false;
  busy.add(tag);
  withLoaded(dim, o.x, o.z, w.size ?? s.size, (loaded) => {
    busy.delete(tag);
    const err = loaded ? placeFile(dim, w.id, o) : "chunks não carregados";
    if (!err) { finish(dim, o, s); done?.(); return; }
    console.warn(`[Etheria] estrutura ${w.id} (${s.name}): ${err}; usando a colocação bloco a bloco.`);
    placeProgressive(dim, o, id, done);
  });
  return true;
}

function placeProgressive(dim, origin, id, done) {
  const s = STRUCTURES[id];
  if (!s || busy.has(id + origin.x + origin.z)) return false;
  const tag = id + origin.x + origin.z; busy.add(tag);
  const pal = s.pal.map(perm);
  let ri = 0, xi = 0;
  const h = system.runInterval(() => {
    let n = 0;
    try {
      while (n < PER_TICK && ri < s.runs.length) {
        const r = s.runs[ri];
        while (xi < r[3] && n < PER_TICK) {
          const b = dim.getBlock({ x: origin.x + r[0] + xi, y: origin.y + r[1], z: origin.z + r[2] });
          if (b) b.setPermutation(pal[r[4]]);
          xi++; n++;
        }
        if (xi >= r[3]) { ri++; xi = 0; }
      }
    } catch { /* chunk descarregado: tenta de novo no próximo tick */ }
    if (ri >= s.runs.length) { system.clearRun(h); busy.delete(tag); finish(dim, origin, s); done?.(); }
  }, 1);
  return true;
}

function finish(dim, origin, s) {
  const cx = origin.x + Math.floor(s.size[0] / 2), cz = origin.z + Math.floor(s.size[2] / 2);
  try {
    // baú de recompensa no centro, sobre o piso da estrutura
    const top = { x: cx, y: origin.y + 1, z: cz };
    const b = dim.getBlock(top);
    b.setPermutation(BlockPermutation.resolve("minecraft:chest"));
    const inv = b.getComponent("minecraft:inventory")?.container;
    for (const [it, c] of s.loot) inv?.addItem(new ItemStack(`etheria:${it}`, c));
    for (const [m, c] of s.mobs) for (let i = 0; i < c; i++) {
      try { dim.spawnEntity(`etheria:${m}`, { x: cx + (Math.random() * 10 - 5), y: origin.y + 2, z: cz + (Math.random() * 10 - 5) }); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function seen() { try { return JSON.parse(world.getDynamicProperty("etheria:structs") ?? "{}"); } catch { return {}; } }
function markSeen(o) { try { world.setDynamicProperty("etheria:structs", JSON.stringify(o)); } catch { /* ignore */ } }

export function surfaceY(dim, x, z) {
  try {
    const b = dim.getTopmostBlock({ x, z });
    if (!b) return undefined;
    if (b.typeId.includes("water") || b.typeId.includes("lava")) return undefined;
    return b.location.y;
  } catch { return undefined; }
}

function weighted() {
  const bag = [];
  for (const [id, s] of Object.entries(STRUCTURES)) for (let i = 0; i < s.w; i++) bag.push(id);
  return pick(bag);
}

export function spawnNear(player, id) {
  const dim = player.dimension, l = player.location;
  const ang = Math.random() * Math.PI * 2, d = 40 + Math.random() * 25;
  const x = Math.floor(l.x + Math.cos(ang) * d), z = Math.floor(l.z + Math.sin(ang) * d);
  const y = surfaceY(dim, x, z);
  if (y === undefined) return false;
  const s = STRUCTURES[id];
  return placeStructure(dim, { x, y: y - 1, z }, id, () => {
    say(player, `§6[Etheria] §fEstrutura revelada: §e${s.name}§7 (${x}, ${y}, ${z})`);
  });
}

export function startStructures() {
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      if (p.dimension.id !== "minecraft:overworld" || !chance(0.12)) continue;
      const cx = Math.floor(p.location.x / 256), cz = Math.floor(p.location.z / 256);
      const k = `${cx},${cz}`, S = seen();
      if (S[k]) continue;
      if (spawnNear(p, weighted())) { S[k] = 1; markSeen(S); toast(p, "§6Estrutura antiga", "§7algo surgiu por perto..."); }
    }
  }, 400);
}

export const STRUCT_IDS = Object.keys(STRUCTURES);

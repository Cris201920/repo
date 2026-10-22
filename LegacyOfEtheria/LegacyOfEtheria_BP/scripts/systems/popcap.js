// systems/popcap.js - 7.x: LIMITE DE MOBS DO ADDON (menos lag). Os mobs nascem naturalmente (spawn_rules) e nas estruturas; este laço só
// garante que não se acumulem: a cada 10 s conta os mobs SELVAGENS do addon (comuns, incomuns e raros de até 800 de vida, sem tag e sem nome)
// carregados perto de cada jogador e no mundo; acima do limite remove os MAIS DISTANTES, nunca a menos de capKeepDist blocos de um jogador.
// Nunca toca em chefes/lendários, moradores, guardas de estrutura (tag), invocações, entidades com nome ou domadas. Números: config.js SPAWN.
import { world, system } from "@minecraft/server";
import { MOBS } from "../data/mobs.gen.js";
import { SPAWN } from "../config.js";

const WILD = new Set(["common", "uncommon", "rare"]);   // especiais (personagens como Carrion), lendários e chefes nunca
export const isWild = (e) => {
  try {
    const m = MOBS[e.typeId]; if (!m || !WILD.has(m.rar) || (m.hp ?? 0) > 800) return false;
    if (e.nameTag) return false;
    if (e.getTags().length) return false;                          // morador, guarda de estrutura, errante, invocação...
    if (e.getComponent?.("minecraft:is_tamed")) return false;
    return true;
  } catch { return false; }
};
const d2 = (a, b) => { const x = a.x - b.x, z = a.z - b.z; return x * x + z * z; };
export const capStats = { last: 0, removed: 0, seen: 0 };

/** uma passada do limitador numa dimensão. Devolve quantos removeu. */
export function capDimension(dim, players) {
  if (!players.length) return 0;
  const seen = new Map();
  for (const p of players) {
    let list = []; try { list = dim.getEntities({ location: p.location, maxDistance: 96 }); } catch { /* ignore */ }
    for (const e of list) if (!seen.has(e.id) && isWild(e)) seen.set(e.id, e);
  }
  const all = [...seen.values()].map((e) => { let m = Infinity; for (const p of players) m = Math.min(m, d2(e.location, p.location)); return { e, m }; });
  const keep2 = SPAWN.capKeepDist * SPAWN.capKeepDist, kill = new Set();
  // por jogador: dentro de 64 blocos
  for (const p of players) {
    const mine = all.filter((x) => d2(x.e.location, p.location) <= 64 * 64 && !kill.has(x.e.id)).sort((a, b) => b.m - a.m);
    for (let i = 0; mine.length - i > SPAWN.capPerPlayer && i < mine.length; i++) if (mine[i].m > keep2) kill.add(mine[i].e.id);
  }
  // no mundo
  const rest = all.filter((x) => !kill.has(x.e.id)).sort((a, b) => b.m - a.m);
  for (let i = 0; rest.length - i > SPAWN.capWorld && i < rest.length; i++) if (rest[i].m > keep2) kill.add(rest[i].e.id);
  let n = 0;
  for (const x of all) if (kill.has(x.e.id)) { try { x.e.remove(); n++; } catch { /* ignore */ } }
  capStats.seen = all.length; capStats.removed += n; capStats.last = n;
  return n;
}
export function startPopCap() {
  system.runInterval(() => {
    try {
      const by = new Map();
      for (const p of world.getAllPlayers()) { const id = p.dimension.id; if (!by.has(id)) by.set(id, { dim: p.dimension, ps: [] }); by.get(id).ps.push(p); }
      for (const { dim, ps } of by.values()) capDimension(dim, ps);
    } catch (e) { console.warn(`[Etheria] limitador de mobs: ${e}`); }
  }, SPAWN.capEvery);
}

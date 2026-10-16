// systems/bossspawn.js - aparição GARANTIDA de bosses/personagens raros (as regras naturais de spawn têm chance baixa demais e concorrem com ~150 mobs).
// A cada 3-6 minutos (aleatório), cada jogador na superfície do Overworld atrai um boss adequado ao nível dele, 40-70 blocos à frente/ao redor,
// no topo do terreno. Máx. 1 boss errante por jogador e 4 no mundo; os que ficam abandonados por 20 min sem ninguém perto somem.
// Admin: !boss [id] força a aparição (id parcial vale), !boss lista.
import { world, system } from "@minecraft/server";
import { MOBS } from "../data/mobs.gen.js";
import { getData } from "../core/db.js";
import { say, toast, playSound, isValid, rand, pick } from "../core/utils.js";
import { ADMIN_TAG } from "../config.js";
import { placeArena, keyOfBoss } from "./arenas.js";
import { auditCmd } from "./bossreg.js";

const TAG = "etheria_roam_boss";
const MIN_LEVEL = { special: 5, rare: 1, legendary: 15, boss: 25 };
const WEIGHT = { special: 3, legendary: 2, boss: 1, rare: 2 };
const EXCLUDE = /(_angel|_royal_beast|_\d)$/;   // 6.26: variantes Kumo voltam ao sorteio (antes eram inalcançáveis); formas _angel/_royal_beast são transformações do original
const POOL = Object.entries(MOBS).filter(([id, m]) => MIN_LEVEL[m.rar] && m.rar !== "rare" && !EXCLUDE.test(id.replace(/^etheria:/, ""))).map(([id, m]) => ({ id: id.replace(/^etheria:/, ""), name: m.name, rar: m.rar, hp: m.hp }));
const RAR_COLOR = { special: "§b", legendary: "§6", boss: "§c" };
const next = new Map();   // playerId -> tick
const spawnedAt = new Map(); // entityId -> tick

const interval = () => Math.floor(rand(3600, 7200));            // 3-6 min
const level = (p) => { try { return getData(p).level ?? 1; } catch { return 1; } };

// 6.55: chefes de alto nível sem arena/reino/estrutura próprios entram no sorteio errante a partir de um nível mínimo (sempre alcançáveis no Sobrevivência)
const LATE = { yuuki_kagurazaka: 75 };
function choose(lv) {
  const ok = POOL.filter((b) => lv >= MIN_LEVEL[b.rar] && (b.hp <= 400 + lv * 60 || (LATE[b.id] && lv >= LATE[b.id])));
  const all = ok.length ? ok : POOL.filter((b) => b.rar === "special").slice(0, 3);
  let tot = 0; for (const b of all) tot += WEIGHT[b.rar] ?? 1;
  let r = Math.random() * tot; for (const b of all) { r -= WEIGHT[b.rar] ?? 1; if (r <= 0) return b; }
  return pick(all);
}

function surfaceSpot(p) {
  const dim = p.dimension;
  for (let i = 0; i < 8; i++) {
    const a = rand(0, Math.PI * 2), d = rand(40, 70), x = Math.floor(p.location.x + Math.cos(a) * d), z = Math.floor(p.location.z + Math.sin(a) * d);
    try {
      const top = dim.getTopmostBlockHeight({ x, z }); if (top == null || top < -60) continue;
      const b = dim.getBlock({ x, y: top, z }); if (!b || b.isLiquid) continue;
      return { x: x + 0.5, y: top + 1.2, z: z + 0.5 };
    } catch { /* chunk não carregado: tenta outro ponto */ }
  }
  return null;
}

const roaming = () => { try { return world.getDimension("minecraft:overworld").getEntities({ tags: [TAG] }).filter(isValid); } catch { return []; } };

export function summonRoaming(p, id) {
  const def = id ? POOL.find((b) => b.id === id) ?? { id, name: MOBS["etheria:" + id]?.name ?? id, rar: "boss" } : choose(level(p));
  const loc = surfaceSpot(p); if (!loc) return false;
  const announce = (e) => { const c = RAR_COLOR[def.rar] ?? "§c"; say(p, `${c}§l⚠ ${def.name} §r§7surgiu por perto! Prepare-se.`); toast(p, `${c}${def.name}`, "§7Um inimigo poderoso apareceu"); playSound(p, "mob.wither.spawn", 0.6, 1.3); };
  const make = (at) => { try { const e = p.dimension.spawnEntity("etheria:" + def.id, at); e.addTag(TAG); spawnedAt.set(e.id, system.currentTick); announce(e); return true; } catch { return false; } };
  const key = keyOfBoss(def.id);
  if (!key) return make(loc);
  // 6.24: boss com arena exclusiva -> a estrutura é colocada na hora e ele nasce nela
  let ok = true, returned = false;
  placeArena(p.dimension, key, { x: loc.x, y: Math.floor(loc.y - 1.2), z: loc.z }, (res) => { const r = make(res.ok ? res.spawn : loc) || make(loc); if (!returned) ok = r; });
  returned = true;
  return ok;
}

function tickSpawner() {
  const now = system.currentTick, live = roaming();
  for (const p of world.getAllPlayers()) {
    if (!isValid(p)) continue;
    if (!next.has(p.id)) { next.set(p.id, now + Math.floor(rand(2400, 4200))); continue; }   // 2-3,5 min depois de entrar
    if (now < next.get(p.id)) continue;
    if (p.dimension.id !== "minecraft:overworld") { next.set(p.id, now + 1200); continue; }
    const mine = live.filter((e) => { try { const dx = e.location.x - p.location.x, dz = e.location.z - p.location.z; return dx * dx + dz * dz < 150 * 150; } catch { return false; } });
    if (mine.length >= 1 || live.length >= 4) { next.set(p.id, now + 1200); continue; }
    next.set(p.id, now + interval()); summonRoaming(p);
  }
  for (const e of live) {   // limpeza de bosses abandonados
    const t0 = spawnedAt.get(e.id) ?? now; if (!spawnedAt.has(e.id)) spawnedAt.set(e.id, now);
    if (now - t0 < 24000) continue;
    let far = true; try { far = e.dimension.getPlayers({ location: e.location, maxDistance: 128 }).length === 0; } catch { /* ignore */ }
    if (far) { try { e.remove(); } catch { /* ignore */ } spawnedAt.delete(e.id); }
  }
}

export function bossCmd(p, args) {
  if (!p.hasTag(ADMIN_TAG)) return say(p, "§cApenas administradores (tag §f" + ADMIN_TAG + "§c).");
  const q = (args[0] ?? "").toLowerCase();
  if (q === "auditar") return auditCmd(p);
  if (!q || q === "lista") return say(p, "§6[Etheria] §7Bosses errantes: §f" + POOL.map((b) => b.id).join(", ") + "§7. Uso: §f!boss <id>");
  const hit = POOL.find((b) => b.id === q) ?? POOL.find((b) => b.id.includes(q));
  if (!hit) return say(p, "§cNenhum boss com esse nome. Use §f!boss lista§c.");
  if (!summonRoaming(p, hit.id)) say(p, "§cNão achei um ponto livre perto; tente de novo em campo aberto.");
}

export function startBossSpawn() { system.runInterval(tickSpawner, 100); }

/** ids que o sorteio errante pode invocar (auditoria de bosses) */
export const bossPoolIds = () => POOL.map((b) => b.id);

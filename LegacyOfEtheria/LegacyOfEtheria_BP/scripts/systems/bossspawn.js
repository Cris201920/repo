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
import { menu } from "./ui/forms.js";
import { markDirty } from "../core/db.js";

const TAG = "etheria_roam_boss";
const MIN_LEVEL = { special: 5, rare: 1, legendary: 15, boss: 25 };
const WEIGHT = { special: 3, legendary: 2, boss: 1, rare: 2 };
const EXCLUDE = /(_angel|_royal_beast|_\d)$/;   // 6.26: variantes Kumo voltam ao sorteio (antes eram inalcançáveis); formas _angel/_royal_beast são transformações do original
const POOL = Object.entries(MOBS).filter(([id, m]) => MIN_LEVEL[m.rar] && m.rar !== "rare" && !EXCLUDE.test(id.replace(/^etheria:/, ""))).map(([id, m]) => ({ id: id.replace(/^etheria:/, ""), name: m.name, rar: m.rar, hp: m.hp }));
const RAR_COLOR = { special: "§b", legendary: "§6", boss: "§c" };
const next = new Map();   // playerId -> tick
const spawnedAt = new Map(); // entityId -> tick

const interval = () => Math.floor(rand(2400, 4800));            // 6.99: 2-4 min (antes 3-6)
const level = (p) => { try { return getData(p).level ?? 1; } catch { return 1; } };

// 6.55: chefes de alto nível sem arena/reino/estrutura próprios entram no sorteio errante a partir de um nível mínimo (sempre alcançáveis no Sobrevivência)
const LATE = { yuuki_kagurazaka: 75 };
// 6.99: antes o filtro era "vida <= 400 + nível×60" e os chefes grandes (Veldora 40000 de vida) nunca apareciam.
// Agora cada chefe tem um nível mínimo por faixa de vida — a maioria entra no mundo ao longo da progressão.
export function reqLevel(b) {
  if (LATE[b.id]) return LATE[b.id];
  if (b.rar !== "boss") return MIN_LEVEL[b.rar] ?? 1;
  return b.hp <= 3000 ? 25 : b.hp <= 15000 ? 45 : b.hp <= 26000 ? 60 : b.hp <= 38000 ? 72 : 85;
}
function choose(lv) {
  const ok = POOL.filter((b) => lv >= reqLevel(b));
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
    if (mine.length >= 1 || live.length >= 6) { next.set(p.id, now + 1200); continue; }
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


// ---------------------------------------------------------------- 6.99: ALTAR DE INVOCAÇÃO (Relógio > Altar de Invocação, ou !invocar)
// Paga moedas para chamar qualquer chefe já liberado pelo seu nível; ele nasce por perto (com a arena dele, se tiver).
export const summonCost = (b) => Math.max(200, Math.round((b.hp ?? 1000) / 8 / 50) * 50);
const lastSummon = new Map();
export function openSummonAltar(p, page = 0) {
  const d = getData(p), lv = d.level ?? 1, list = [...POOL].sort((a, b) => reqLevel(a) - reqLevel(b) || a.hp - b.hp);
  const per = 12, pages = Math.ceil(list.length / per), cur = list.slice(page * per, page * per + per);
  const btns = cur.map((b) => {
    const need = reqLevel(b), cost = summonCost(b), ok = lv >= need;
    return { text: `${ok ? (RAR_COLOR[b.rar] ?? "§c") : "§8"}§l${b.name}\n§r${ok ? `§6${cost} moedas` : `§8nível ${need}`}`, icon: "menu_ranking", run: () => confirmSummon(p, b) };
  });
  if (page > 0) btns.push({ text: "§l« Anterior", icon: "menu_ranking", run: () => openSummonAltar(p, page - 1) });
  if (page < pages - 1) btns.push({ text: "§lPróxima »", icon: "menu_ranking", run: () => openSummonAltar(p, page + 1) });
  menu(p, "§l§cALTAR DE INVOCAÇÃO", `§7Pague moedas para invocar um chefe perto de você (campo aberto, na superfície).\n§7Você tem §6${d.coins} moedas§7 · nível §e${lv}§7 · página ${page + 1}/${pages}`, btns);
}
function confirmSummon(p, b) {
  const d = getData(p), need = reqLevel(b), cost = summonCost(b);
  if ((d.level ?? 1) < need) return say(p, `§c${b.name} só pode ser invocado a partir do nível ${need}.`);
  if (p.dimension.id !== "minecraft:overworld") return say(p, "§cO altar só funciona no mundo normal (Overworld).");
  if (system.currentTick - (lastSummon.get(p.id) ?? -99999) < 1200) return say(p, "§cO altar ainda está recarregando (1 minuto entre invocações).");
  if (roaming().filter((e) => { try { const dx = e.location.x - p.location.x, dz = e.location.z - p.location.z; return dx * dx + dz * dz < 150 * 150; } catch { return false; } }).length >= 2) return say(p, "§cJá há chefes demais por perto. Derrote-os primeiro.");
  if ((d.coins ?? 0) < cost) return say(p, `§cMoedas insuficientes: ${b.name} custa §6${cost}§c.`);
  menu(p, `§l§c${b.name}`, `§7Invocar §f${b.name}§7 por §6${cost} moedas§7?\n§7Vida: §c${b.hp}§7 · Raridade: §f${b.rar}`, [
    { text: "§l§aINVOCAR", icon: "menu_ranking", run: () => {
      const dd = getData(p); if ((dd.coins ?? 0) < cost) return say(p, "§cMoedas insuficientes.");
      dd.coins -= cost; markDirty(p); lastSummon.set(p.id, system.currentTick);
      if (!summonRoaming(p, b.id)) { dd.coins += cost; markDirty(p); say(p, "§cNão achei um ponto livre perto; vá para campo aberto e tente de novo (moedas devolvidas)."); }
    } },
    { text: "§lVoltar", icon: "menu_ranking", run: () => openSummonAltar(p) },
  ]);
}

// systems/bossspawn.js - aparição GARANTIDA de bosses/personagens raros (as regras naturais de spawn têm chance baixa demais e concorrem com ~150 mobs).
// 7.x (lag): a cada 6-10 minutos (aleatório; o 1º em 5-8 min), cada jogador na superfície do Overworld atrai um boss adequado ao nível dele, 40-70 blocos
// ao redor, no topo do terreno, SEM colocar arena na hora. Máx. 1 por jogador e 3 no mundo; não chama se já houver chefe/lendário natural por perto;
// os abandonados somem em 5 min sem ninguém a 96 blocos. Números em config.js (SPAWN). O Altar e o !boss continuam com a arena exclusiva.
// Admin: !boss [id] força a aparição (id parcial vale), !boss lista.
import { world, system } from "@minecraft/server";
import { MOBS } from "../data/mobs.gen.js";
import { getData } from "../core/db.js";
import { say, toast, playSound, isValid, rand, pick } from "../core/utils.js";
import { ADMIN_TAG, SPAWN } from "../config.js";
import { placeArena, keyOfBoss } from "./arenas.js";
import { auditCmd } from "./bossreg.js";
import { menu } from "./ui/forms.js";
import { markDirty } from "../core/db.js";

const TAG = "etheria_roam_boss";
const MIN_LEVEL = { special: 5, rare: 1, legendary: 15, boss: 25 };
const WEIGHT = { special: 3, legendary: 2, boss: 1, rare: 2 };
const EXCLUDE = /(^feldway_angel|_royal_beast|_\d)$/;   // 8.7: só a forma angelical do Feldway (o Anjo Caído entra)   // 6.26: variantes Kumo voltam ao sorteio (antes eram inalcançáveis); formas _angel/_royal_beast são transformações do original
const POOL = Object.entries(MOBS).filter(([id, m]) => MIN_LEVEL[m.rar] && m.rar !== "rare" && !EXCLUDE.test(id.replace(/^etheria:/, ""))).map(([id, m]) => ({ id: id.replace(/^etheria:/, ""), name: m.name, rar: m.rar, hp: m.hp, region: m.region ?? "overworld", minLv: m.minLv }));
// 8.7: no sorteio NATURAL só a Rainha Taratect representa as aranhas (o Altar continua com todas); chefes com região só nascem nela
const NATURAL_SKIP = /^(taratect(?!_queen$)|tt_.*spider)/;
const DIM_REGION = { "minecraft:the_end": "end", "minecraft:nether": "nether" };
const RAR_COLOR = { special: "§b", legendary: "§6", boss: "§c" };
const next = new Map();   // playerId -> tick
const spawnedAt = new Map(); // entityId -> tick

const interval = () => Math.floor(rand(SPAWN.roamEvery[0], SPAWN.roamEvery[1]));   // 7.x: 6-10 min (antes 2-4) — menos lag
const level = (p) => { try { return getData(p).level ?? 1; } catch { return 1; } };

// 6.55: chefes de alto nível sem arena/reino/estrutura próprios entram no sorteio errante a partir de um nível mínimo (sempre alcançáveis no Sobrevivência)
const LATE = { yuuki_kagurazaka: 75 };
// 6.99: antes o filtro era "vida <= 400 + nível×60" e os chefes grandes (Veldora 40000 de vida) nunca apareciam.
// Agora cada chefe tem um nível mínimo por faixa de vida — a maioria entra no mundo ao longo da progressão.
export function reqLevel(b) {
  if (b.minLv) return b.minLv;
  if (LATE[b.id]) return LATE[b.id];
  if (b.rar !== "boss") return MIN_LEVEL[b.rar] ?? 1;
  return b.hp <= 3000 ? 25 : b.hp <= 15000 ? 45 : b.hp <= 26000 ? 60 : b.hp <= 38000 ? 72 : 85;
}
function choose(lv, region = "overworld") {
  const here = POOL.filter((b) => b.region === region && !NATURAL_SKIP.test(b.id));
  const ok = here.filter((b) => lv >= reqLevel(b));
  if (!ok.length && region !== "overworld") return null;   // Vazio/Inferno/Oceano: sem chefe abaixo do nível mínimo
  const all = ok.length ? ok : here.filter((b) => b.rar === "special").slice(0, 3);
  let tot = 0; for (const b of all) tot += WEIGHT[b.rar] ?? 1;
  let r = Math.random() * tot; for (const b of all) { r -= WEIGHT[b.rar] ?? 1; if (r <= 0) return b; }
  return pick(all);
}

/** 8.7: ponto de aparição por região — Inferno: chão livre perto da altura do jogador (o teto de rocha engana o "topo");
 *  Oceano: dentro da água; demais: topo do terreno (sem líquido) */
function regionSpot(p, region) {
  if (region === "overworld" || region === "end") return surfaceSpot(p);
  const dim = p.dimension;
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2), d = rand(region === "ocean" ? 24 : 30, region === "ocean" ? 48 : 56), x = Math.floor(p.location.x + Math.cos(a) * d), z = Math.floor(p.location.z + Math.sin(a) * d);
    try {
      if (region === "ocean") {
        const top = dim.getTopmostBlockHeight({ x, z }); const b = top == null ? null : dim.getBlock({ x, y: top, z });
        if (b?.isLiquid && b.typeId.includes("water")) return { x: x + 0.5, y: top - 1.5, z: z + 0.5 };
        continue;
      }
      const y0 = Math.floor(p.location.y);
      for (let dy = 0; dy <= 12; dy++) for (const y of [y0 + dy, y0 - dy]) {
        const f = dim.getBlock({ x, y: y - 1, z }), a1 = dim.getBlock({ x, y, z }), a2 = dim.getBlock({ x, y: y + 1, z });
        if (f && a1 && a2 && f.isSolid && !f.isLiquid && a1.isAir && a2.isAir) return { x: x + 0.5, y: y + 0.1, z: z + 0.5 };
      }
    } catch { /* chunk não carregado */ }
  }
  return null;
}
/** região do jogador para o sorteio: End = Vazio, Nether = Inferno, sobre/dentro do mar = Oceano (metade das vezes) */
function regionOf(p) {
  const r = DIM_REGION[p.dimension.id]; if (r) return r;
  try {
    const x = Math.floor(p.location.x), z = Math.floor(p.location.z), top = p.dimension.getTopmostBlockHeight({ x, z });
    const b = p.dimension.getBlock({ x, y: top, z });
    if ((p.isInWater || (b?.isLiquid && b.typeId.includes("water"))) && Math.random() < 0.5) return "ocean";
  } catch { /* ignore */ }
  return "overworld";
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

const DIMS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
const roaming = () => { const out = []; for (const d of DIMS) { try { out.push(...world.getDimension(d).getEntities({ tags: [TAG] }).filter(isValid)); } catch { /* ignore */ } } return out; };

export function summonRoaming(p, id, arena = true, region = "overworld") {
  const def = id ? POOL.find((b) => b.id === id) ?? { id, name: MOBS["etheria:" + id]?.name ?? id, rar: "boss" } : choose(level(p), region);
  if (!def) return false;
  const loc = regionSpot(p, id ? (DIM_REGION[p.dimension.id] ?? "overworld") : region); if (!loc) return false;
  const announce = (e) => { const c = RAR_COLOR[def.rar] ?? "§c"; say(p, `${c}§l⚠ ${def.name} §r§7surgiu por perto! Prepare-se.`); toast(p, `${c}${def.name}`, "§7Um inimigo poderoso apareceu"); playSound(p, "mob.wither.spawn", 0.6, 1.3); };
  const make = (at) => { try { const e = p.dimension.spawnEntity("etheria:" + def.id, at); e.addTag(TAG); spawnedAt.set(e.id, system.currentTick); announce(e); return true; } catch { return false; } };
  const key = arena ? keyOfBoss(def.id) : null;   // 7.x: o errante natural não coloca arena na hora (estrutura grande = travada)
  if (!key) return make(loc);
  // 6.24: boss com arena exclusiva -> a estrutura é colocada na hora e ele nasce nela
  let ok = true, returned = false;
  placeArena(p.dimension, key, { x: loc.x, y: Math.floor(loc.y - 1.2), z: loc.z }, (res) => { const r = make(res.ok ? res.spawn : loc) || make(loc); if (!returned) ok = r; });
  returned = true;
  return ok;
}

/** já existe um chefe/lendário (natural ou não) perto do jogador? então não chama outro */
const BIG = new Set(Object.entries(MOBS).filter(([, m]) => m.rar === "boss" || m.rar === "legendary" || m.rar === "special").map(([id]) => id));
function bigNear(p) {
  try { return p.dimension.getEntities({ location: p.location, maxDistance: SPAWN.roamSkipNear }).some((e) => BIG.has(e.typeId)); } catch { return false; }
}
function tickSpawner() {
  const now = system.currentTick, live = roaming();
  for (const p of world.getAllPlayers()) {
    if (!isValid(p)) continue;
    if (!next.has(p.id)) { next.set(p.id, now + Math.floor(rand(SPAWN.roamFirst[0], SPAWN.roamFirst[1]))); continue; }   // 5-8 min depois de entrar
    if (now < next.get(p.id)) continue;
    const mine = live.filter((e) => { try { if (e.dimension.id !== p.dimension.id) return false; const dx = e.location.x - p.location.x, dz = e.location.z - p.location.z; return dx * dx + dz * dz < SPAWN.roamNear * SPAWN.roamNear; } catch { return false; } });
    if (mine.length >= 1 || live.length >= SPAWN.roamWorldMax || bigNear(p)) { next.set(p.id, now + 2400); continue; }
    const region = regionOf(p);
    next.set(p.id, now + interval() * (region === "overworld" ? 1 : SPAWN.regionEveryMult)); summonRoaming(p, undefined, SPAWN.roamArena, region);
  }
  for (const e of live) {   // limpeza de bosses abandonados
    const t0 = spawnedAt.get(e.id) ?? now; if (!spawnedAt.has(e.id)) spawnedAt.set(e.id, now);
    if (now - t0 < SPAWN.roamAbandon) continue;
    let far = true; try { far = e.dimension.getPlayers({ location: e.location, maxDistance: SPAWN.roamAbandonDist }).length === 0; } catch { /* ignore */ }
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

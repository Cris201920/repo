// systems/worldgen.js - ESTRUTURAS NOVAS DO MUNDO (6.25): reino de Milim, reino dos homens-lagarto, vilas de ogros, acampamentos goblins, ruínas, caverna de Veldora,
// domínios de Guy e Veldanava. Dados: data/wgen.gen.js (gerado por tools/wg_emit.py). Colocação INSTANTÂNEA (uma chamada structureManager.place).
// Regras de posicionamento (geração aleatória): solo plano (variação máx. por tipo), sem água sob a pegada, solo compatível com a facção/bioma, água/lama por perto
// (lagartos), distância mínima de Tempest, das cidades/assentamentos, do spawn do mundo, das arenas de boss e de qualquer outra estrutura já gerada (registro salvo no mundo).
// Tempest, Luminus (boss) e as cidades existentes NÃO são tocadas por este sistema.
import { world, system, ItemStack } from "@minecraft/server";
import { WGEN } from "../data/wgen.gen.js";
import { SETTLEMENT_LIST } from "../data/factions.js";
import { isProtectedPos } from "./arenas.js";
import { loadRegion, placeFile, enqueue, clampOrigin } from "./placer.js";
import { settlementInfo } from "./settlements.js";
import { tempestInfo } from "./tempest.js";
import { say, toast } from "../core/utils.js";

const REC = "etheria:wgrec", SEEN = "etheria:wgseen", MAX_REC = 80, CELL = 320, TICK = 600;
export const wgKeys = () => Object.keys(WGEN);
export { WGEN };
export const results = new Map();   // chave -> {ok, at, err, tick, chests, mobs}

const rd = (k, d) => { try { const r = JSON.parse(world.getDynamicProperty(k) ?? ""); return r ?? d; } catch { return d; } };
const wr = (k, v) => { try { world.setDynamicProperty(k, JSON.stringify(v)); } catch { /* ignore */ } };
const records = () => { const r = rd(REC, []); return Array.isArray(r) ? r : []; };
/** 6.44: registro das estruturas geradas (usado por systems/residents.js para povoar reinos/domínios) */
export const wgRecords = () => records();
const blockAt = (dim, x, y, z) => { try { return dim.getBlock({ x, y, z }); } catch { return undefined; } };

const LOOT = {
  1: [["minecraft:bread", 2, 5, 0.8], ["minecraft:arrow", 6, 16, 0.6], ["minecraft:iron_ingot", 1, 4, 0.6], ["etheria:goblin_ear", 1, 3, 0.5], ["etheria:hp_potion_s", 1, 2, 0.4], ["minecraft:gold_nugget", 3, 9, 0.5]],
  2: [["minecraft:iron_ingot", 3, 8, 0.8], ["minecraft:gold_ingot", 2, 5, 0.6], ["etheria:mana_crystal", 1, 3, 0.6], ["etheria:hp_potion_s", 1, 3, 0.6], ["minecraft:golden_apple", 1, 1, 0.2], ["etheria:arcane_ingot", 1, 2, 0.3], ["minecraft:emerald", 1, 4, 0.4]],
  3: [["minecraft:diamond", 1, 4, 0.7], ["minecraft:gold_ingot", 4, 10, 0.8], ["etheria:arcane_ingot", 2, 4, 0.6], ["etheria:mana_crystal", 3, 6, 0.8], ["etheria:demonite_shard", 1, 3, 0.5], ["minecraft:enchanted_golden_apple", 1, 1, 0.08], ["minecraft:emerald", 3, 8, 0.7]],
};
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function fillChests(dim, key, o) {
  const def = WGEN[key]; let ok = 0, bad = 0;
  for (const [x, y, z, tier] of def.chests) {
    try {
      const b = blockAt(dim, o.x + x, o.y + y, o.z + z), inv = b?.getComponent("minecraft:inventory")?.container;
      if (!inv) { bad++; continue; }
      for (const [id, a, c, p] of LOOT[tier] ?? LOOT[1]) if (Math.random() < p) { try { inv.addItem(new ItemStack(id, rnd(a, c))); } catch { /* item inexistente: ignora */ } }
      ok++;
    } catch { bad++; }
  }
  return { ok, bad };
}
function spawnMobs(dim, key, o) {
  const def = WGEN[key]; let n = 0;
  for (const [t, x, y, z] of def.mobs) { try { const e = dim.spawnEntity(t, { x: o.x + x + 0.5, y: o.y + y, z: o.z + z + 0.5 }); try { e.addTag("etheria_smob"); } catch { /* ignore */ } n++; } catch { /* ignore */ } }   // 7.x: guardas da estrutura (o limitador de lag não os remove)
  return n;
}

/** Coloca a estrutura: anchor = {x, z, y (altura do solo no centro)}; o piso da estrutura (índice F) substitui o bloco de solo. cb({ok, at, err}) é SEMPRE chamado. */
export function placeWgen(dim, key, anchor, cb, opts = {}) {
  const def = WGEN[key];
  const done = (res) => { results.set(key, { ...res, tick: system.currentTick }); try { cb?.(res); } catch (e) { console.warn(`[Etheria] wgen ${key} cb: ${e}`); } };
  if (!def) return done({ ok: false, err: `estrutura "${key}" não registrada` });
  const [sx, , sz] = def.size;
  enqueue((next) => {
    const o = clampOrigin(dim, { x: Math.floor(anchor.x) - (sx >> 1), y: Math.floor(anchor.y) - def.floor, z: Math.floor(anchor.z) - (sz >> 1) }, def.size);
    loadRegion(dim, o.x, o.z, sx, sz, (loaded, why) => {
      try {
        if (!loaded) return done({ ok: false, err: `chunks não carregados: ${why}` });
        const err = placeFile(dim, def.id, o);
        if (err) { console.warn(`[Etheria] FALHA estrutura ${key} (${def.id}): ${err}`); return done({ ok: false, err }); }
        const f = blockAt(dim, o.x + (sx >> 1), o.y + def.floor, o.z + (sz >> 1));
        if (!f || f.typeId === "minecraft:air") { console.warn(`[Etheria] estrutura ${key}: piso não encontrado após colocar`); return done({ ok: false, err: "piso não encontrado após a colocação" }); }
        const rec = records(); rec.push({ k: key, d: dim.id, x: o.x + (sx >> 1), z: o.z + (sz >> 1), y: o.y, sep: def.sep, sx, sz }); wr(REC, rec.slice(-MAX_REC));
        const loot = fillChests(dim, key, o), mobs = (opts.noMobs || def.manual) ? 0 : spawnMobs(dim, key, o);
        done({ ok: true, at: o, center: { x: o.x + (sx >> 1), y: o.y + def.floor, z: o.z + (sz >> 1) }, entry: { x: o.x + def.entry[0] + 0.5, y: o.y + def.entry[1], z: o.z + def.entry[2] + 0.5 }, chests: loot.ok, chestsFailed: loot.bad, mobs });
      } finally { next(); }
    });
  });
}

/** estrutura deste tipo já colocada perto de (x, z)? (anti-duplicação dos comandos manuais) */
export function findWgen(dim, key, x, z, r = 0) {
  const def = WGEN[key]; if (!def) return undefined;
  const R = r || Math.max(def.size[0], def.size[2]);
  return records().find((q) => q.k === key && q.d === dim.id && Math.hypot(q.x - x, q.z - z) < R);
}

// ---------------------------------------------------------------- regras de posicionamento
const LEAF = /leaves|log|vine|snow_layer|bamboo|cactus|mushroom|wood|azalea|moss_carpet|tall|grass$|fern|flower|petals|dead_bush|sugar_cane|kelp|waterlily/;
export function groundAt(dim, x, z) {
  try {
    let b = dim.getTopmostBlock({ x, z }); let n = 0;
    while (b && LEAF.test(b.typeId) && !/grass_block|mossy/.test(b.typeId) && n++ < 30) b = dim.getBlock({ x, y: b.location.y - 1, z });
    return b ?? undefined;
  } catch { return undefined; }
}
/** analisa o local; devolve {ok, y, why} */
export function checkSite(dim, x, z, key) {
  const def = WGEN[key], [sx, , sz] = def.size, rx = Math.floor(sx * 0.38), rz = Math.floor(sz * 0.38), re = new RegExp(def.ground);
  let lo = 1e9, hi = -1e9, wet = 0, good = 0, n = 0, yc;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const px = x + Math.round(i * rx / 2), pz = z + Math.round(j * rz / 2), b = groundAt(dim, px, pz);
    if (!b) return { ok: false, why: "chunk não carregado" };
    n++;
    if (b.isLiquid || /water|lava|ice/.test(b.typeId)) { wet++; continue; }
    const y = b.location.y; lo = Math.min(lo, y); hi = Math.max(hi, y);
    if (re.test(b.typeId)) good++;
    if (i === 0 && j === 0) yc = y;
  }
  if (wet > n * 0.12 && !def.near) return { ok: false, why: "água sob a pegada" };
  if (wet > n * 0.4) return { ok: false, why: "água demais" };
  if (hi - lo > def.flat) return { ok: false, why: `terreno irregular (${hi - lo} > ${def.flat})` };
  if (good < n * 0.5) return { ok: false, why: "solo incompatível com o bioma/facção" };
  if (yc === undefined) return { ok: false, why: "centro sem solo" };
  if (def.near) {                                          // lagartos: pântano — exige água/lama perto
    const nr = new RegExp(def.near); let hit = false;
    for (let a = 0; a < 16 && !hit; a++) { const d = 18 + (a % 3) * 10, b = groundAt(dim, Math.round(x + d * Math.cos(a * 0.39)), Math.round(z + d * Math.sin(a * 0.39))); if (b && nr.test(b.typeId)) hit = true; }
    if (!hit) return { ok: false, why: "sem pântano/água por perto" };
  }
  return { ok: true, y: yc };
}
/** conflitos: cidades, Tempest, spawn, arenas e outras estruturas já geradas */
export function conflict(dim, x, z, key) {
  const def = WGEN[key], R = Math.max(def.size[0], def.size[2]) / 2 + 24;
  if (dim.id === "minecraft:overworld" && Math.hypot(x, z) < 200 + R) return "perto do spawn/Tempest";
  try { const t = tempestInfo(); if (t && Math.hypot(x - t.x, z - t.z) < 260 + R) return "perto de Tempest"; } catch { /* ignore */ }
  try { for (const s of SETTLEMENT_LIST) { const i = settlementInfo(s.id); if (i && Math.hypot(x - i.x, z - i.z) < 120 + R) return `perto de ${s.name}`; } } catch { /* ignore */ }
  for (const r of records()) { if (r.d !== dim.id) continue; if (Math.hypot(x - r.x, z - r.z) < Math.max(def.sep, r.sep ?? 100)) return `perto de outra estrutura (${r.k})`; }
  const [sx, , sz] = def.size;
  for (const [a, b] of [[0, 0], [sx / 2, 0], [-sx / 2, 0], [0, sz / 2], [0, -sz / 2], [sx / 2, sz / 2], [-sx / 2, -sz / 2]]) if (isProtectedPos(dim, Math.round(x + a), 70, Math.round(z + b))) return "sobreporia arena de boss";
  return null;
}

// ---------------------------------------------------------------- geração aleatória
function pickKey(bag) { const t = bag.reduce((s, k) => s + WGEN[k].w, 0); let r = Math.random() * t; for (const k of bag) { r -= WGEN[k].w; if (r <= 0) return k; } return bag[0]; }
// 6.55: estruturas BÁSICAS (acampamentos, vilas, ruínas, postos = não raras) ~35% menos frequentes: em 35% das células (escolhidas de forma
// fixa pela coordenada, sem salvar nada) só as raras podem surgir. Reinos, lendárias, portais e as CIDADES (systems/settlements.js) não mudam.
export const BASIC_SKIP = 0.35;
export const quietCell = (cx, cz) => { let h = (cx * 73856093) ^ (cz * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) % 1000 < BASIC_SKIP * 1000; };
function tryGenerate(p) {
  const dim = p.dimension, l = p.location, tries = [];
  const quiet = quietCell(Math.floor(l.x / CELL), Math.floor(l.z / CELL));
  for (let i = 0; i < 4; i++) { const a = Math.random() * 6.283, d = 80 + Math.random() * 70; tries.push([Math.floor(l.x + Math.cos(a) * d), Math.floor(l.z + Math.sin(a) * d)]); }
  const keys = wgKeys();
  for (const [x, z] of tries) {
    const bag = keys.filter((k) => !WGEN[k].manual && k !== "veldanava_dominio" && (!WGEN[k].rare || Math.random() < 0.18) && (WGEN[k].rare || !quiet));   // 6.46: Veldanava só na dimensão própria
    if (!bag.length) continue;
    const key = pickKey(bag), why = conflict(dim, x, z, key); if (why) continue;
    const s = checkSite(dim, x, z, key); if (!s.ok) continue;
    placeWgen(dim, key, { x, y: s.y, z }, (res) => {
      if (res.ok) { say(p, `§6[Etheria] §fVocê sente algo à distância: §e${WGEN[key].name}§7 (${Math.round(res.center.x)}, ${Math.round(res.center.z)})`); try { toast(p, "§6Local descoberto", `§7${WGEN[key].name}`); } catch { /* ignore */ } }
    });
    return true;
  }
  return false;
}
export function startWorldgen() {
  system.runInterval(() => {
    try {
      const seen = rd(SEEN, {}), left = records().length < MAX_REC;
      for (const p of world.getAllPlayers()) {
        if (!left || p.dimension.id !== "minecraft:overworld" || Math.random() > 0.35) continue;
        const k = `${Math.floor(p.location.x / CELL)},${Math.floor(p.location.z / CELL)}`, n = seen[k] ?? 0;
        if (n >= 100) continue;
        if (tryGenerate(p)) { seen[k] = 100; wr(SEEN, seen); } else { seen[k] = n + 1; if (n % 4 === 0) wr(SEEN, seen); }
      }
    } catch (e) { console.warn(`[Etheria] worldgen: ${e}`); }
  }, TICK);
}

/** relatório de integridade: a estrutura existe, o tamanho confere, baús e mobs dentro da caixa */
export function verifyWgen() {
  const out = [];
  for (const k of wgKeys()) {
    const d = WGEN[k]; let ok = true, why = "";
    try {
      const s = world.structureManager.get(d.id);
      if (!s) { ok = false; why = "arquivo .mcstructure não encontrado"; }
      else if (s.size.x !== d.size[0] || s.size.y !== d.size[1] || s.size.z !== d.size[2]) { ok = false; why = "tamanho divergente"; }
    } catch (e) { ok = false; why = String(e); }
    const inside = ([x, y, z]) => x >= 0 && y >= 0 && z >= 0 && x < d.size[0] && y < d.size[1] && z < d.size[2];
    if (ok && (!d.chests.every((c) => inside(c)) || !d.mobs.every((m) => inside(m.slice(1))))) { ok = false; why = "baú/mob fora da caixa"; }
    out.push({ id: k, name: d.name, ok, why });
  }
  return out;
}

// systems/natgen.js - 9.0/9.3: ATIVAÇÃO das estruturas de GERAÇÃO NATIVA (o gerador do mundo já as colocou com os chunks; nada é colocado aqui).
// 9.3: SEM BLOCOS MARCADORES. Cada estrutura é reconhecida pelos PRÓPRIOS blocos: um bloco raro dela (âncora: baú, atril, mesa de
// encantamento, vaso) e ~12 blocos vizinhos de tipo fixo (assinatura, data/natgen.gen.js) testados nas 4 rotações do gerador.
// Sem varredura periódica: só quando um jogador ENTRA num chunk novo, os chunks ainda não vistos num raio de 3 entram numa fila e são
// verificados aos poucos (no máximo WORLDGEN.scanChunks a cada WORLDGEN.scanEvery ticks), com UMA consulta nativa containsBlock por chunk.
// Jogador parado = zero trabalho. Achou: gera guardas/chefe (posições giradas), registra no worldgen e grava a estrutura como ativada
// (propriedade do mundo) para nunca repetir. Mundos de 9.0-9.2: se ainda houver o light_block_0 + terracota no centro, devolve o bloco original.
import * as mc from "@minecraft/server";
import { NATIVE } from "../data/natgen.gen.js";
import { WORLDGEN } from "../config.js";
import { addRecord, wgRecords } from "./worldgen.js";
import { finishWorld } from "./structures.js";
import { toast } from "../core/utils.js";

const { world, system, BlockPermutation } = mc;
const YR = { "minecraft:overworld": [-20, 300], "minecraft:nether": [8, 120], "minecraft:the_end": [8, 160] };
const MISS_OK = 1;                       // tolera 1 bloco da assinatura quebrado/trocado (o gerador garante >= 3 diferenças em qualquer posição falsa)
const DONE = "etheria:natdone", MAX_DONE = 600, MAX_QUEUE = 160, MAX_RETRY = 6;
const LEGACY_MARK = "minecraft:light_block_0";
// por dimensão: tipos de âncora (filtro do containsBlock) e as estruturas de cada tipo
const BY_DIM = {};
for (const [k, d] of Object.entries(NATIVE)) {
  const m = (BY_DIM[d.dim] ??= { types: [], keys: {} });
  if (!m.keys[d.anchor]) { m.keys[d.anchor] = []; m.types.push(d.anchor); }
  m.keys[d.anchor].push(k);
}
const seen = new Set();                  // chunks já verificados (memória; depois de reiniciar, a lista DONE impede repetir)
const queue = [], queued = new Set(), retries = new Map(), lastChunk = new Map();
export const natLog = [];                // últimas ativações (diagnóstico / testes)
export const natStats = { chunks: 0, contains: 0, getBlock: 0, activated: 0 };

/** gira (dx, dz) r vezes 90° no sentido horário (visto de cima): norte -> leste */
export function rot(dx, dz, r) { for (let i = 0; i < (r & 3); i++) [dx, dz] = [-dz, dx]; return [dx, dz]; }

let done = null;
const doneSet = () => { if (!done) { try { const a = JSON.parse(world.getDynamicProperty(DONE) ?? "[]"); done = new Set(Array.isArray(a) ? a : []); } catch { done = new Set(); } } return done; };
function markDone(k) {
  const s = doneSet(); s.add(k);
  let a = [...s]; if (a.length > MAX_DONE) { a = a.slice(-MAX_DONE); done = new Set(a); }
  try { world.setDynamicProperty(DONE, JSON.stringify(a)); } catch { /* ignore */ }
}
const UNLOADED = {};
function typeAt(dim, x, y, z) {
  natStats.getBlock++;
  let b; try { b = dim.getBlock({ x, y, z }); } catch { throw UNLOADED; }
  if (!b) throw UNLOADED;
  return b.typeId;
}
function perm(name, states) { try { return BlockPermutation.resolve(name, states ?? {}); } catch { try { return BlockPermutation.resolve(name); } catch { return undefined; } } }

/** a âncora em W é a da estrutura key? devolve a rotação (0-3) ou -1. Lança UNLOADED se algum bloco da assinatura não está carregado. */
export function matchAt(dim, W, key) {
  const d = NATIVE[key];
  for (let r = 0; r < 4; r++) {
    let miss = 0;
    for (const [dx, dy, dz, ti] of d.sig) {
      const [rx, rz] = rot(dx, dz, r);
      if (typeAt(dim, W.x + rx, W.y + dy, W.z + rz) !== d.types[ti] && ++miss > MISS_OK) break;
    }
    if (miss <= MISS_OK) return r;
  }
  return -1;
}

/** ativa a estrutura key cuja âncora está em W com rotação r; true se ativou agora */
export function activate(dim, W, key, r) {
  const d = NATIVE[key];
  const [crx, crz] = rot(d.c[0], d.c[2], r), cx = W.x + crx, cz = W.z + crz, oy = W.y + d.c[1], floorY = oy + d.floor;
  const id = `${dim.id[10]}${cx},${cz}`;
  if (doneSet().has(id)) return false;
  // já ativada pela versão 9.0-9.2 (registro do worldgen / baú central das portadas)?
  const old = wgRecords().some((q) => q.nat && q.k === key && q.d === dim.id && Math.abs(q.x - cx) <= 2 && Math.abs(q.z - cz) <= 2);
  let legacyChest = false;
  try { legacyChest = d.src === "world" && d.restore[1][0] !== "minecraft:chest" && dim.getBlock({ x: cx, y: oy + 1, z: cz })?.typeId === "minecraft:chest"; } catch { /* ignore */ }
  if (old || legacyChest) { markDone(id); return false; }
  // marcadores antigos (9.0-9.2) ainda no centro: devolve os blocos originais
  try {
    const mb = dim.getBlock({ x: cx, y: oy + d.L, z: cz }), tb = dim.getBlock({ x: cx, y: oy + d.L + 1, z: cz });
    if (mb?.typeId === LEGACY_MARK && tb?.typeId.endsWith("_glazed_terracotta")) {
      for (const [i, b] of [[0, mb], [1, tb]]) { const p = perm(...d.restore[i]); if (p) try { b.setPermutation(p); } catch { /* ignore */ } }
    }
  } catch { /* ignore */ }
  let mobs = 0;
  for (const [t, dx, dy, dz] of d.mobs) {
    const [rx, rz] = rot(dx, dz, r);
    try { const e = dim.spawnEntity(t, { x: W.x + rx + 0.5, y: W.y + dy, z: W.z + rz + 0.5 }); try { e.addTag("etheria_smob"); } catch { /* ignore */ } mobs++; } catch { /* ignore */ }
  }
  if (d.src === "world") { try { finishWorld(dim, { x: cx - (d.size[0] >> 1), y: oy, z: cz - (d.size[2] >> 1) }, key); } catch { /* ignore */ } }
  else addRecord({ k: key, d: dim.id, x: cx, z: cz, y: oy, sep: d.sep, sx: d.size[0], sz: d.size[2], nat: 1 });
  markDone(id); natStats.activated++;
  natLog.push({ key, x: cx, y: floorY, z: cz, r, mobs, tick: system.currentTick }); if (natLog.length > 20) natLog.shift();
  if (d.src === "dg") for (const p of dim.getPlayers({ location: { x: cx, y: floorY, z: cz }, maxDistance: 64 })) { try { toast(p, "§6Masmorra", `§7${d.name}`); } catch { /* ignore */ } }
  return true;
}

/** verifica um chunk (16x16 colunas): devolve o número de estruturas ativadas, ou -1 se algo não está carregado (tentar depois) */
export function scanChunk(dim, chx, chz) {
  const m = BY_DIM[dim.id]; if (!m) return 0;
  if (!mc.BlockVolume || typeof dim.containsBlock !== "function") return 0;
  const [y0, y1] = YR[dim.id] ?? YR["minecraft:overworld"], x = chx * 16, z = chz * 16;
  const vol = new mc.BlockVolume({ x, y: y0, z }, { x: x + 15, y: y1, z: z + 15 }), filter = { includeTypes: m.types };
  natStats.contains++;
  try { if (!dim.containsBlock(vol, filter, false)) return 0; } catch { return -1; }
  let n = 0, retry = false, locs;
  try { locs = [...dim.getBlocks(vol, filter, false).getBlockLocationIterator()]; } catch { return -1; }
  for (const W of locs) {
    let t; try { t = typeAt(dim, W.x, W.y, W.z); } catch { retry = true; continue; }
    for (const key of m.keys[t] ?? []) {
      let r; try { r = matchAt(dim, W, key); } catch { retry = true; break; }
      if (r >= 0) { if (activate(dim, W, key, r)) n++; break; }
    }
  }
  return retry ? -1 : n;
}

/** jogador entrou num chunk novo: põe na fila os chunks ainda não vistos em volta (mais perto primeiro) */
function enqueueAround(p, dim, pcx, pcz) {
  const R = WORLDGEN.scanRadius ?? 3, add = [];
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    const k = `${dim.id[10]}${pcx + dx},${pcz + dz}`;
    if (!seen.has(k) && !queued.has(k)) add.push([dx * dx + dz * dz, pcx + dx, pcz + dz, k]);
  }
  add.sort((a, b) => a[0] - b[0]);
  // os novos (onde o jogador está agora) passam à frente; os antigos que sobrarem atrás são descartados se ele já foi embora
  queue.unshift(...add.map(([, cx, cz, k]) => { queued.add(k); return [dim.id, cx, cz, k]; }));
  while (queue.length > MAX_QUEUE) queued.delete(queue.pop()[3]);
}
const nearPlayer = (dimId, cx, cz, R) => world.getAllPlayers().some((p) => p.dimension.id === dimId && Math.abs(Math.floor(p.location.x / 16) - cx) <= R + 1 && Math.abs(Math.floor(p.location.z / 16) - cz) <= R + 1);

export function natTick() {
  for (const p of world.getAllPlayers()) {
    const dim = p.dimension; if (!BY_DIM[dim.id]) continue;
    const pcx = Math.floor(p.location.x / 16), pcz = Math.floor(p.location.z / 16), ck = `${dim.id[10]}${pcx},${pcz}`;
    if (lastChunk.get(p.id) === ck) continue;                 // parado no mesmo chunk: nada a fazer
    lastChunk.set(p.id, ck); enqueueAround(p, dim, pcx, pcz);
  }
  const R = WORLDGEN.scanRadius ?? 3;
  for (let n = 0; n < (WORLDGEN.scanChunks ?? 2) && queue.length;) {
    const [dimId, cx, cz, k] = queue.shift(); queued.delete(k);
    if (seen.has(k) || !nearPlayer(dimId, cx, cz, R)) continue;  // o jogador já foi embora: verifica quando voltar
    n++; natStats.chunks++;
    let res = 0; try { res = scanChunk(world.getDimension(dimId), cx, cz); } catch { res = -1; }
    if (res >= 0) { seen.add(k); retries.delete(k); continue; }
    // algo ainda não carregado: tenta de novo algumas vezes; depois sai da fila SEM marcar como visto (volta quando o jogador mudar de chunk)
    const t = (retries.get(k) ?? 0) + 1;
    if (t >= MAX_RETRY) retries.delete(k); else { retries.set(k, t); queue.push([dimId, cx, cz, k]); queued.add(k); }
  }
  if (seen.size > 60000) seen.clear();
  if (lastChunk.size > 64) lastChunk.clear();
}

export function startNatgen() {
  system.runInterval(() => { try { natTick(); } catch (e) { console.warn(`[Etheria] natgen: ${e}`); } }, WORLDGEN.scanEvery ?? 25);
}
export const nativeKeys = () => Object.keys(NATIVE);

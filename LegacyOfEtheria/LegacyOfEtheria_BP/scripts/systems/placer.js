// systems/placer.js - NÚCLEO ÚNICO de colocação de estruturas .mcstructure (arenas, reinos, ruínas, Tempest, estruturas de mundo).
// Por que existe (6.29): a colocação falhava com erro no chat porque (1) o Tempest esperava só 3 ticks pelo carregamento de áreas a 700+ blocos,
// (2) a verificação de carregamento olhava só 5 pontos da pegada (estruturas de 97–145 blocos tinham chunks de borda descarregados) e
// (3) cada sistema criava os próprios tickingareas sem limite (o mundo aceita no máximo 10). Aqui:
//   - TODOS os chunks da pegada são conferidos (um bloco por chunk) antes do place;
//   - a área é carregada com tickingareas RETANGULARES (≤ 100 chunks cada, o máximo do Bedrock) em slots fixos e reaproveitados;
//   - um trabalho por vez (fila), então nunca se passa do limite de tickingareas;
//   - a altura é ajustada aos limites da dimensão (nada de LocationOutOfWorldBoundaries);
//   - erro só aparece se a colocação falhar de verdade, com o motivo real.
// 9.3 (lag/"blocos invisíveis"): estruturas grandes (pegada > 48) são colocadas em LADRILHOS de 32x32 colunas (tools/wg_tiles.py), um passo
// a cada WORLDGEN.tileGap ticks, na mesma posição -> o mesmo resultado bloco a bloco, sem o pico de 1,6 milhão de posições num tick só.
// Trabalhos automáticos (exploração) usam auto=true: só forçam (tickingarea) até WORLDGEN.autoForceMax chunks ainda não carregados da
// pegada (a borda); se faltar mais, desistem sem custo e a célula tenta de novo depois. Comandos, arenas de chefe e Tempest podem carregar tudo.
import { world, system } from "@minecraft/server";
import { TILES } from "../data/tiles.gen.js";
import { WORLDGEN } from "../config.js";

const SLOTS = 6;                 // tickingareas próprios simultâneos (o mundo aceita 10; sobram 4 para o jogador/outros pacotes)
const RECT = 10;                 // lado máximo (em chunks) de cada tickingarea retangular: 10x10 = 100 chunks
const slotName = (i) => `etheria_ld${i}`;
const LEGACY = ["etheria_tc", ...Array.from({ length: 8 }, (_, k) => `etheria_tc_${k}`), ...Array.from({ length: 40 }, (_, k) => `etheria_ar${k + 1}`)];

const cmd = (dim, c) => { try { const r = dim.runCommand(c); return r?.successCount === undefined ? true : r.successCount > 0; } catch { return false; } };

/** faixa de altura válida da dimensão */
export function heightRange(dim) {
  try { const h = dim.heightRange; if (h && typeof h.min === "number") return { min: h.min, max: h.max }; } catch { /* ignore */ }
  return dim.id === "minecraft:overworld" ? { min: -64, max: 320 } : { min: 0, max: 256 };
}
function probeY(dim) { const h = heightRange(dim); return Math.max(h.min, Math.min(64, h.max - 1)); }

/** o chunk que contém (x, z) está carregado? */
export function chunkLoaded(dim, x, z, y = probeY(dim)) {
  try { return dim.getBlock({ x: Math.floor(x), y, z: Math.floor(z) }) !== undefined; } catch { return false; }
}
/** lista de chunks [cx, cz] que a caixa x0..x0+sx-1, z0..z0+sz-1 toca */
export function chunksOf(x0, z0, sx, sz) {
  const out = [];
  const c0 = Math.floor(x0 / 16), c1 = Math.floor((x0 + sx - 1) / 16), d0 = Math.floor(z0 / 16), d1 = Math.floor((z0 + sz - 1) / 16);
  for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) out.push([cx, cz]);
  return out;
}
/** quantos chunks da caixa ainda não estão carregados */
export function unloadedCount(dim, x0, z0, sx, sz, stopAbove = Infinity) {
  const y = probeY(dim);
  let n = 0; for (const [cx, cz] of chunksOf(x0, z0, sx, sz)) if (!chunkLoaded(dim, cx * 16 + 8, cz * 16 + 8, y) && ++n > stopAbove) break;
  return n;
}
export function regionLoaded(dim, x0, z0, sx, sz) {
  const y = probeY(dim);
  return chunksOf(x0, z0, sx, sz).every(([cx, cz]) => chunkLoaded(dim, cx * 16 + 8, cz * 16 + 8, y));
}
/** quebra a caixa em retângulos de no máximo RECT x RECT chunks (cada um vira um tickingarea) */
function rects(x0, z0, sx, sz) {
  const c0 = Math.floor(x0 / 16), c1 = Math.floor((x0 + sx - 1) / 16), d0 = Math.floor(z0 / 16), d1 = Math.floor((z0 + sz - 1) / 16), out = [];
  for (let a = c0; a <= c1; a += RECT) for (let b = d0; b <= d1; b += RECT) out.push([a * 16, b * 16, Math.min(c1, a + RECT - 1) * 16 + 15, Math.min(d1, b + RECT - 1) * 16 + 15]);
  return out;
}
function freeSlots(dim) { for (let i = 0; i < SLOTS; i++) cmd(dim, `tickingarea remove ${slotName(i)}`); }

// ------------------------------------------------------------------ fila (um trabalho por vez)
const queue = [];
let running = false;
export const placerBusy = () => running || queue.length > 0;
/** job(done): executa e chama done() quando terminar. Roda na hora se a fila estiver livre. */
export function enqueue(job) { queue.push(job); pump(); }
/** trabalho prioritário (nascimento em Tempest): passa à frente da fila de arenas/estruturas do mundo */
export function enqueueFirst(job) { queue.unshift(job); pump(); }
function pump() {
  if (running) return;
  const job = queue.shift(); if (!job) return;
  running = true;
  let finished = false;
  const done = () => { if (finished) return; finished = true; running = false; system.run(pump); };
  try { job(done); } catch (e) { console.warn(`[Etheria] colocação: ${e}`); done(); }
}

/**
 * Garante a caixa carregada e chama cb(ok, motivo, release). Quem chama DEVE chamar release() quando terminar de usar a área
 * (libera os tickingareas). timeout em ticks (padrão 30 s: terreno nunca gerado demora no celular).
 */
export function holdRegion(dim, x0, z0, sx, sz, cb, timeout = 600, auto = false) {
  const max = WORLDGEN.autoForceMax ?? 40, miss = unloadedCount(dim, x0, z0, sx, sz, auto ? max : 0);
  if (!miss) { cb(true, null, () => {}); return; }
  // 9.3: automático (exploração) só força poucos chunks (a borda da pegada); muitos fora do alcance = tenta depois, mais perto
  if (auto && miss > max) { cb(false, "longe demais da área carregada (tenta depois)", () => {}); return; }
  const rs = rects(x0, z0, sx, sz);
  if (rs.length > SLOTS) { cb(false, `área grande demais (${rs.length} blocos de 10x10 chunks; máximo ${SLOTS})`, () => {}); return; }
  freeSlots(dim);
  const y = probeY(dim);
  let added = 0;
  rs.forEach(([ax, az, bx, bz], i) => { if (cmd(dim, `tickingarea add ${ax} ${y} ${az} ${bx} ${y} ${bz} ${slotName(i)}`)) added++; });
  let t = 0, released = false;
  const release = () => { if (!released) { released = true; freeSlots(dim); } };
  // 9.3: cada chunk confirmado sai da lista; a verificação para no primeiro que falta (1 leitura por espera, cada chunk lido ~1 vez)
  const pending = chunksOf(x0, z0, sx, sz);
  const h = system.runInterval(() => {
    t += 4;
    while (pending.length && chunkLoaded(dim, pending[0][0] * 16 + 8, pending[0][1] * 16 + 8, y)) pending.shift();
    const ok = pending.length === 0;
    if (!ok && t < timeout) return;
    system.clearRun(h);
    let why = null;
    if (!ok) why = added < rs.length ? "o mundo atingiu o limite de 10 tickingareas (use /tickingarea remove_all e tente de novo)" : "o terreno demorou demais para carregar";
    try { cb(ok, why, release); } catch (e) { release(); throw e; }
  }, 4);
}
/** como holdRegion, mas libera a área logo depois do cb (uso síncrono) */
export function loadRegion(dim, x0, z0, sx, sz, cb, timeout = 600) {
  holdRegion(dim, x0, z0, sx, sz, (ok, why, release) => { try { cb(ok, why); } finally { release(); } }, timeout);
}

/** origem ajustada aos limites de altura da dimensão */
export function clampOrigin(dim, o, size) {
  const h = heightRange(dim), y = Math.max(h.min, Math.min(Math.floor(o.y), h.max - size[1]));
  return { x: Math.floor(o.x), y, z: Math.floor(o.z) };
}

/** a estrutura existe no pacote? devolve o tamanho ou null (9.3: também quando só existem os ladrilhos) */
export function structureSize(id) {
  if (tilesOf(id)) return TILES[id].size.slice();
  try { const s = world.structureManager.get(id); return s ? [s.size.x, s.size.y, s.size.z] : null; } catch { return null; }
}
const tileOk = new Map();
/** passos de ladrilhos da estrutura, se TODOS os arquivos estão no pacote (resultado guardado); senão null */
export function tilesOf(id) {
  const t = TILES[id]; if (!t) return null;
  if (!tileOk.has(id)) {
    let ok = true;
    try { for (const st of t.steps) for (const [tid] of st) if (!world.structureManager.get(tid)) { ok = false; break; } } catch { ok = false; }
    tileOk.set(id, ok);
  }
  return tileOk.get(id) ? t.steps : null;
}
/** medição (simulador / !lag): posições de estrutura colocadas por tick */
export const placerStats = { places: 0, cells: 0, maxTickCells: 0, tick: -1, tickCells: 0 };
function count(id, size) {
  const v = size ? size[0] * size[1] * size[2] : 0, t = system.currentTick;
  if (placerStats.tick !== t) { placerStats.tick = t; placerStats.tickCells = 0; }
  placerStats.places++; placerStats.cells += v; placerStats.tickCells += v;
  placerStats.maxTickCells = Math.max(placerStats.maxTickCells, placerStats.tickCells);
}
const placeOne = (id, dim, o) => { world.structureManager.place(id, dim, o, { includeEntities: false, includeBlocks: true }); };

/** Coloca agora (área já carregada). Devolve null se deu certo ou o motivo do erro. */
export function placeFile(dim, id, o) {
  let size = null;
  try { const s = world.structureManager.get(id); size = s ? [s.size.x, s.size.y, s.size.z] : null; } catch { /* ignore */ }
  if (!size) {
    // 9.3: só há os ladrilhos no pacote -> todos agora (uso síncrono raro; o normal é placeFileAsync)
    const steps = tilesOf(id); if (!steps) return `arquivo ${id}.mcstructure não foi encontrado no pacote de comportamento`;
    try { for (const st of steps) for (const [tid, ox, oz] of st) { placeOne(tid, dim, { x: o.x + ox, y: o.y, z: o.z + oz }); count(tid, sizeOfTile(id, ox, oz)); } return null; } catch (e) { return String(e?.message ?? e); }
  }
  let err = null;
  try { placeOne(id, dim, o); count(id, size); return null; } catch (e) { err = String(e?.message ?? e); }
  // mesma estrutura por outro caminho (nome entre aspas por causa do ":")
  if (cmd(dim, `structure load "${id}" ${o.x} ${o.y} ${o.z}`)) { count(id, size); return null; }
  return err;
}
const sizeOfTile = (id, ox, oz) => { const s = TILES[id].size; return [Math.min(32, s[0] - ox), s[1], Math.min(32, s[2] - oz)]; };

/**
 * 9.3: coloca em ladrilhos, um passo a cada WORLDGEN.tileGap ticks (área já carregada por quem chama); cb(err|null) no fim.
 * Sem ladrilhos no pacote: a original numa chamada (como antes). Se um chunk descarregar no meio (jogador voou para longe), a área
 * restante é segura com tickingarea só até terminar (nunca fica estrutura pela metade); se nem assim der, o erro.
 */
export function placeFileAsync(dim, id, o, cb) {
  const steps = tilesOf(id);
  if (!steps) { cb(placeFile(dim, id, o)); return; }
  const gap = Math.max(1, WORLDGEN.tileGap ?? 2), size = TILES[id].size;
  let k = 0, held = false, release = () => {};
  const end = (err) => { release(); cb(err); };
  const run = () => {
    try {
      for (const [tid, ox, oz] of steps[k]) { placeOne(tid, dim, { x: o.x + ox, y: o.y, z: o.z + oz }); count(tid, sizeOfTile(id, ox, oz)); }
    } catch (e) {
      if (held) return end(String(e?.message ?? e));
      held = true;
      return holdRegion(dim, o.x, o.z, size[0], size[2], (ok, why, rel) => { release = rel; if (!ok) end(`chunks não carregados: ${why}`); else run(); });
    }
    if (++k < steps.length) system.runTimeout(run, gap); else end(null);
  };
  run();
}

/**
 * Trabalho completo e enfileirado: carrega a pegada inteira, coloca e chama cb({ok, err, at}).
 * at = origem real (já ajustada à altura).
 */
export function placeQueued(dim, id, origin, size, cb, timeout, auto = false) {
  enqueue((done) => {
    const o = clampOrigin(dim, origin, size);
    holdRegion(dim, o.x, o.z, size[0], size[2], (ok, why, release) => {
      const fin = (res) => { try { cb(res); } catch (e) { console.warn(`[Etheria] colocação ${id} cb: ${e}`); } release(); done(); };
      if (!ok) return fin({ ok: false, err: `chunks não carregados: ${why}`, at: o });
      placeFileAsync(dim, id, o, (err) => fin(err ? { ok: false, err, at: o } : { ok: true, at: o }));
    }, timeout, auto);
  });
}

/** limpeza de tickingareas deixados por versões antigas (que podiam esgotar o limite de 10 do mundo) */
export function startPlacer() {
  system.runTimeout(() => {
    // 6.36: os slots só são limpos se nenhum trabalho estiver usando (antes, isto apagava as áreas do nascimento em Tempest no meio do carregamento)
    try { const d = world.getDimension("minecraft:overworld"); for (const n of LEGACY) cmd(d, `tickingarea remove ${n}`); if (!running) freeSlots(d); } catch { /* ignore */ }
  }, 2);
}

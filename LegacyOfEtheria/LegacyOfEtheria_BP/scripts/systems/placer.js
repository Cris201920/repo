// systems/placer.js - NÚCLEO ÚNICO de colocação de estruturas .mcstructure (arenas, reinos, ruínas, Tempest, estruturas de mundo).
// Por que existe (6.29): a colocação falhava com erro no chat porque (1) o Tempest esperava só 3 ticks pelo carregamento de áreas a 700+ blocos,
// (2) a verificação de carregamento olhava só 5 pontos da pegada (estruturas de 97–145 blocos tinham chunks de borda descarregados) e
// (3) cada sistema criava os próprios tickingareas sem limite (o mundo aceita no máximo 10). Aqui:
//   - TODOS os chunks da pegada são conferidos (um bloco por chunk) antes do place;
//   - a área é carregada com tickingareas RETANGULARES (≤ 100 chunks cada, o máximo do Bedrock) em slots fixos e reaproveitados;
//   - um trabalho por vez (fila), então nunca se passa do limite de tickingareas;
//   - a altura é ajustada aos limites da dimensão (nada de LocationOutOfWorldBoundaries);
//   - erro só aparece se a colocação falhar de verdade, com o motivo real.
import { world, system } from "@minecraft/server";

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
export function holdRegion(dim, x0, z0, sx, sz, cb, timeout = 600) {
  if (regionLoaded(dim, x0, z0, sx, sz)) { cb(true, null, () => {}); return; }
  const rs = rects(x0, z0, sx, sz);
  if (rs.length > SLOTS) { cb(false, `área grande demais (${rs.length} blocos de 10x10 chunks; máximo ${SLOTS})`, () => {}); return; }
  freeSlots(dim);
  const y = probeY(dim);
  let added = 0;
  rs.forEach(([ax, az, bx, bz], i) => { if (cmd(dim, `tickingarea add ${ax} ${y} ${az} ${bx} ${y} ${bz} ${slotName(i)}`)) added++; });
  let t = 0, released = false;
  const release = () => { if (!released) { released = true; freeSlots(dim); } };
  const h = system.runInterval(() => {
    t += 4;
    const ok = regionLoaded(dim, x0, z0, sx, sz);
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

/** a estrutura existe no pacote? devolve o tamanho ou null */
export function structureSize(id) {
  try { const s = world.structureManager.get(id); return s ? [s.size.x, s.size.y, s.size.z] : null; } catch { return null; }
}

/** Coloca agora (área já carregada). Devolve null se deu certo ou o motivo do erro. */
export function placeFile(dim, id, o) {
  if (!structureSize(id)) return `arquivo ${id}.mcstructure não foi encontrado no pacote de comportamento`;
  let err = null;
  try { world.structureManager.place(id, dim, o, { includeEntities: false, includeBlocks: true }); return null; } catch (e) { err = String(e?.message ?? e); }
  // mesma estrutura por outro caminho (nome entre aspas por causa do ":")
  if (cmd(dim, `structure load "${id}" ${o.x} ${o.y} ${o.z}`)) return null;
  return err;
}

/**
 * Trabalho completo e enfileirado: carrega a pegada inteira, coloca e chama cb({ok, err, at}).
 * at = origem real (já ajustada à altura).
 */
export function placeQueued(dim, id, origin, size, cb, timeout) {
  enqueue((done) => {
    const o = clampOrigin(dim, origin, size);
    loadRegion(dim, o.x, o.z, size[0], size[2], (ok, why) => {
      let res;
      if (!ok) res = { ok: false, err: `chunks não carregados: ${why}`, at: o };
      else { const err = placeFile(dim, id, o); res = err ? { ok: false, err, at: o } : { ok: true, at: o }; }
      try { cb(res); } catch (e) { console.warn(`[Etheria] colocação ${id} cb: ${e}`); }
      done();
    }, timeout);
  });
}

/** limpeza de tickingareas deixados por versões antigas (que podiam esgotar o limite de 10 do mundo) */
export function startPlacer() {
  system.runTimeout(() => {
    try { const d = world.getDimension("minecraft:overworld"); for (const n of LEGACY) cmd(d, `tickingarea remove ${n}`); freeSlots(d); } catch { /* ignore */ }
  }, 40);
}

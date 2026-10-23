// systems/natgen.js - 9.0: ATIVAÇÃO das estruturas de GERAÇÃO NATIVA (o gerador do mundo já as colocou com os chunks; nada é colocado aqui).
// Cada estrutura nativa tem no centro um light_block_0 (invisível) e, logo acima, uma terracota vitrificada (cor = qual estrutura,
// face = rotação sorteada pelo gerador). A cada 5 s, para cada jogador, verifica no máximo alguns chunks ainda não vistos perto dele
// (uma consulta nativa containsBlock por chunk, sem varrer bloco a bloco em JS). Achou: devolve os 2 blocos originais, gera guardas/chefe
// (posições giradas conforme a rotação), registra no worldgen (progresso/moradores) e nunca mais ativa (o marcador some).
import * as mc from "@minecraft/server";
import { NATIVE } from "../data/natgen.gen.js";
import { WORLDGEN } from "../config.js";
import { addRecord } from "./worldgen.js";
import { finishWorld } from "./structures.js";
import { toast } from "../core/utils.js";

const { world, system, BlockPermutation } = mc;
const MARK = "minecraft:light_block_0";
const YR = { "minecraft:overworld": [-20, 300], "minecraft:nether": [8, 120], "minecraft:the_end": [8, 160] };
const BY_MARK = new Map(Object.entries(NATIVE).map(([k, d]) => [d.dim + "|" + d.marker, k]));
const ROT = { 2: 0, 5: 1, 3: 2, 4: 3 };     // facing_direction da terracota (posta virada ao norte) -> giros de 90° no sentido horário
const seen = new Set();
export const natLog = [];                     // últimas ativações (diagnóstico / testes)

/** gira (dx, dz) r vezes 90° no sentido horário (visto de cima): norte -> leste */
export function rot(dx, dz, r) { for (let i = 0; i < (r & 3); i++) [dx, dz] = [-dz, dx]; return [dx, dz]; }

function perm(name, states) { try { return BlockPermutation.resolve(name, states ?? {}); } catch { try { return BlockPermutation.resolve(name); } catch { return undefined; } } }

/** ativa a estrutura cujo marcador está em loc; true se ativou */
export function activateAt(dim, loc) {
  let tb; try { tb = dim.getBlock({ x: loc.x, y: loc.y + 1, z: loc.z }); } catch { return false; }
  if (!tb) return false;
  const key = BY_MARK.get(dim.id + "|" + tb.typeId), d = key && NATIVE[key];
  let mb; try { mb = dim.getBlock(loc); } catch { return false; }
  if (!d || !mb) return false;   // light block posto por jogador (sem a terracota certa em cima): não mexe
  let r = 0; try { r = ROT[tb.permutation.getState("facing_direction")] ?? 0; } catch { /* ignore */ }
  for (const [i, b] of [[0, mb], [1, tb]]) { const p = perm(...d.restore[i]); if (p) try { b.setPermutation(p); } catch { /* ignore */ } }
  const oy = loc.y - d.L, cx = loc.x, cz = loc.z, floorY = oy + d.floor;
  let mobs = 0;
  for (const [t, dx, y, dz] of d.mobs) {
    const [rx, rz] = rot(dx, dz, r);
    try { const e = dim.spawnEntity(t, { x: cx + rx + 0.5, y: oy + y, z: cz + rz + 0.5 }); try { e.addTag("etheria_smob"); } catch { /* ignore */ } mobs++; } catch { /* ignore */ }
  }
  if (d.src === "world") { try { finishWorld(dim, { x: cx - (d.size[0] >> 1), y: oy, z: cz - (d.size[2] >> 1) }, key); } catch { /* ignore */ } }
  else addRecord({ k: key, d: dim.id, x: cx, z: cz, y: oy, sep: d.sep, sx: d.size[0], sz: d.size[2], nat: 1 });
  natLog.push({ key, x: cx, y: floorY, z: cz, r, mobs, tick: system.currentTick }); if (natLog.length > 20) natLog.shift();
  if (d.src === "dg") for (const p of dim.getPlayers({ location: { x: cx, y: floorY, z: cz }, maxDistance: 64 })) { try { toast(p, "§6Masmorra", `§7${d.name}`); } catch { /* ignore */ } }
  return true;
}

/** procura marcadores num chunk (16x16 colunas); devolve: número ativado, ou -1 se o chunk não está carregado */
export function scanChunk(dim, chx, chz) {
  const [y0, y1] = YR[dim.id] ?? YR["minecraft:overworld"], x = chx * 16, z = chz * 16;
  if (!mc.BlockVolume || typeof dim.containsBlock !== "function") return 0;
  const vol = new mc.BlockVolume({ x, y: y0, z }, { x: x + 15, y: y1, z: z + 15 }), filter = { includeTypes: [MARK] };
  try { if (!dim.containsBlock(vol, filter, false)) return 0; } catch { return -1; }
  let n = 0;
  try { for (const l of dim.getBlocks(vol, filter, false).getBlockLocationIterator()) if (activateAt(dim, l)) n++; } catch { return -1; }
  return n;
}

function tick() {
  const R = WORLDGEN.scanRadius ?? 3, max = WORLDGEN.scanChunks ?? 8;
  for (const p of world.getAllPlayers()) {
    const dim = p.dimension; if (!YR[dim.id]) continue;
    const pcx = Math.floor(p.location.x / 16), pcz = Math.floor(p.location.z / 16), todo = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { const k = `${dim.id[10]}${pcx + dx},${pcz + dz}`; if (!seen.has(k)) todo.push([dx * dx + dz * dz, pcx + dx, pcz + dz, k]); }
    todo.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz, k] of todo.slice(0, max)) if (scanChunk(dim, cx, cz) >= 0) seen.add(k);
  }
  if (seen.size > 60000) seen.clear();
}

export function startNatgen() {
  system.runInterval(() => { try { tick(); } catch (e) { console.warn(`[Etheria] natgen: ${e}`); } }, WORLDGEN.scanEvery ?? 100);
}
export const nativeKeys = () => Object.keys(NATIVE);

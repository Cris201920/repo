// systems/arenas.js - REGISTRO CENTRAL boss -> estrutura exclusiva + colocação INSTANTÂNEA (uma chamada de structureManager.place, sem animação de construção).
// Dados: data/arenas.gen.js (gerado por tools/arenas.py): ARENAS[chave] = {id, entity, name, size, floor, spawn}; WORLD[id] = estruturas de mundo.
// Fluxo: boss invocado (sigilo, !boss, aparição errante) -> placeArena() -> (1) reaproveita arena já colocada perto (anti-duplicação, salva no mundo) ou
// (2) garante os chunks carregados (tickingarea só se preciso) -> (3) place + verificação do piso -> (4) callback com o ponto de nascimento do boss.
// Falha = erro registrado + aviso aos jogadores com o NOME do boss e da estrutura; o boss ainda nasce (sem arena) para a invocação não ser desperdiçada.
import { world, system } from "@minecraft/server";
import { ARENAS, WORLD } from "../data/arenas.gen.js";
import { say } from "../core/utils.js";
import { loadRegion, holdRegion, placeFileAsync, enqueue, clampOrigin, structureSize } from "./placer.js";

const KEY = "etheria:arenas", REUSE_R = 96, MAX_REC = 120;
export const results = new Map();            // chave -> {ok, reused?, at, err?, tick}   (relatório / testes)
const busy = new Set();

export const arenaKeys = () => Object.keys(ARENAS);
/** chave da arena a partir do tipo da entidade ("etheria:guy_crimson", "etheria:boss_void_lord") ou da própria chave */
export function keyOfBoss(idOrType) {
  const id = String(idOrType).replace(/^etheria:/, "");
  if (ARENAS[id]) return id;
  return Object.keys(ARENAS).find((k) => ARENAS[k].entity === id);
}
const read = () => { try { const r = JSON.parse(world.getDynamicProperty(KEY) ?? "[]"); return Array.isArray(r) ? r : []; } catch { return []; } };
const write = (r) => { try { world.setDynamicProperty(KEY, JSON.stringify(r.slice(-MAX_REC))); } catch { /* ignore */ } };
const blockAt = (dim, x, y, z) => { try { return dim.getBlock({ x, y, z }); } catch { return undefined; } };

/** chama cb(true) assim que TODOS os chunks da pegada estão carregados (na hora, se já estiverem; senão com tickingareas do núcleo placer.js). */
export function withLoaded(dim, x0, z0, size, cb) {
  enqueue((next) => loadRegion(dim, x0, z0, size[0], size[2], (ok) => { try { cb(ok); } finally { next(); } }));
}
const warnPlayers = (dim, anchor, msg) => { try { for (const p of dim.getPlayers({ location: anchor, maxDistance: 96 })) say(p, msg); } catch { /* ignore */ } console.warn(`[Etheria] ${msg.replace(/§./g, "")}`); };

/**
 * Coloca (ou reaproveita) a arena exclusiva do boss. anchor = centro desejado {x, y (bloco do piso), z}.
 * cb({ok, reused, spawn:{x,y,z}, center, err}) é chamado SEMPRE (na mesma chamada quando a área já está carregada).
 */
export function placeArena(dim, key, anchor, cb) {
  const reg = ARENAS[key];
  const done = (res) => { results.set(key, { ...res, at: res.at ?? anchor, tick: system.currentTick }); try { cb?.(res); } catch (e) { console.warn(`[Etheria] arena ${key} cb: ${e}`); } };
  if (!reg) return done({ ok: false, err: `boss "${key}" sem arena registrada` });
  const [sx, sy, sz] = reg.size, ax = Math.floor(anchor.x), ay = Math.floor(anchor.y), az = Math.floor(anchor.z);
  const spawnOf = (o) => ({ x: o.x + reg.spawn[0] + 0.5, y: o.y + reg.spawn[1], z: o.z + reg.spawn[2] + 0.5 });
  // anti-duplicação: já existe uma arena deste boss perto?
  const recs = read(), old = recs.find((r) => r.k === key && r.d === dim.id && Math.hypot(r.x + (sx >> 1) - ax, r.z + (sz >> 1) - az) < REUSE_R);
  if (old) {
    const f = blockAt(dim, old.x + reg.spawn[0], old.y + reg.floor, old.z + reg.spawn[2]);
    if (f && f.typeId !== "minecraft:air") return done({ ok: true, reused: true, spawn: spawnOf(old), center: { x: old.x + (sx >> 1), y: old.y + reg.floor, z: old.z + (sz >> 1) }, at: old });
    write(recs.filter((r) => r !== old));            // a arena foi destruída/descarregada: gera de novo
  }
  const bk = `${key}@${dim.id}`; if (busy.has(bk)) return done({ ok: false, err: "geração já em andamento" });
  busy.add(bk);
  enqueue((next) => {
    const o = clampOrigin(dim, { x: ax - (sx >> 1), y: ay - reg.floor, z: az - (sz >> 1) }, reg.size);
    holdRegion(dim, o.x, o.z, sx, sz, (loaded, why, release) => {
      const fin = (res) => { busy.delete(bk); try { done(res); } finally { release(); next(); } };
      if (!loaded) { warnPlayers(dim, anchor, `§c[Etheria] Arena de ${reg.name}: ${why}; o boss nasce sem a estrutura.`); return fin({ ok: false, err: `chunks não carregados: ${why}` }); }
      // 9.3: arenas de 61x61 em 4 ladrilhos (placer.placeFileAsync, ~0,3 s) em vez de uma chamada só
      placeFileAsync(dim, reg.id, o, (err) => {
        const f = err ? undefined : blockAt(dim, o.x + reg.spawn[0], o.y + reg.floor, o.z + reg.spawn[2]);
        if (err || !f || f.typeId === "minecraft:air") {
          const why2 = err ?? "piso não encontrado após a colocação";
          warnPlayers(dim, anchor, `§c[Etheria] Falha ao gerar a estrutura §f${reg.id}§c (${reg.name}, boss ${reg.entity}): ${why2}`);
          return fin({ ok: false, err: why2 });
        }
        const rr = read(); rr.push({ k: key, d: dim.id, x: o.x, y: o.y, z: o.z }); write(rr);
        fin({ ok: true, reused: false, spawn: spawnOf(o), center: { x: o.x + (sx >> 1), y: o.y + reg.floor, z: o.z + (sz >> 1) }, at: o });
      });
    });
  });
}

/** ponto de ancoragem na frente do jogador, no nível dos pés */
export function anchorFromPlayer(p, ahead = 14) {
  let d = { x: 0, z: 1 }; try { const v = p.getViewDirection(); const l = Math.hypot(v.x, v.z) || 1; d = { x: v.x / l, z: v.z / l }; } catch { /* ignore */ }
  return { x: Math.floor(p.location.x + d.x * ahead), y: Math.floor(p.location.y) - 1, z: Math.floor(p.location.z + d.z * ahead) };
}

/** lista de verificação: cada arena/estrutura existe no pacote (structureManager.get) e tem o tamanho esperado */
export function verifyAll() {
  const out = [];
  const chk = (id, size, name, boss) => {
    const sz = structureSize(id);   // 9.3: original ou ladrilhos
    out.push({ id, name, boss, ok: !!sz && sz[0] === size[0] && sz[1] === size[1] && sz[2] === size[2], size: sz });
  };
  for (const [k, a] of Object.entries(ARENAS)) chk(a.id, a.size, a.name, a.entity);
  for (const [k, w] of Object.entries(WORLD)) chk(w.id, w.size, w.name, "(mundo)");
  return out;
}
export function startArenas() {
  system.runTimeout(() => { try { const bad = verifyAll().filter((r) => !r.ok); for (const b of bad) console.warn(`[Etheria] estrutura inválida/ausente: ${b.id} (${b.name}) tamanho=${b.size}`); } catch (e) { console.warn(`[Etheria] verificação de estruturas: ${e}`); } }, 200);
}
export { ARENAS, WORLD };

/** Posição dentro de uma arena registrada (estrutura de boss) ou perto do ponto de spawn do mundo: blocos protegidos contra o Predador. */
export function isProtectedPos(dim, x, y, z) {
  try {
    for (const r of read()) {
      if (r.d !== dim.id) continue;
      const reg = ARENAS[r.k]; if (!reg) continue;
      if (x >= r.x && x < r.x + reg.size[0] && y >= r.y && y < r.y + reg.size[1] && z >= r.z && z < r.z + reg.size[2]) return true;
    }
    const sp = world.getDefaultSpawnLocation?.(); if (sp && dim.id === "minecraft:overworld" && Math.hypot(x - sp.x, z - sp.z) < 24) return true;
  } catch { /* ignore */ }
  return false;
}

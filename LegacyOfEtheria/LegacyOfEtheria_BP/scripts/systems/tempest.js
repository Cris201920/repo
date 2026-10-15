// systems/tempest.js - Cidade de Tempest (mapa 512x512 convertido de mundo Java -> 64 ladrilhos .mcstructure).
// Fluxo: (1) escolhe um terreno plano e seco longe do spawn; (2) quando um jogador chega perto, coloca os ladrilhos mais próximos,
// um por vez, carregando a área com "tickingarea" só durante a colocação; (3) ao colocar o ladrilho que contém um ponto de NPC, gera o NPC.
// Estado salvo na propriedade dinâmica do mundo (sobrevive a reinício). Nada aqui apaga estruturas antigas: elas continuam no mundo.
import { world, system } from "@minecraft/server";
import { TEMPEST } from "../data/tempest.gen.js";
import { say } from "../core/utils.js";
import { canBuild } from "../core/perm.js";
import { enqueue, holdRegion, placeFile, clampOrigin } from "./placer.js";

const KEY = "etheria:tempest";
const AREA = "etheria_tc";
const NEAR = 110;            // distância (blocos) do jogador até o ladrilho para começar a colocá-lo
const SEARCH_R = [700, 1000, 1300];
const NPC_ROLE = ["guild", "merchant", "smith", "trainer", "quest", "master", "merchant", "smith", "guild", "quest"];
const half = TEMPEST.size / 2;

let S = null;   // {x,y,z, done:{id:1}, npcs:{i:1}, ann:0}
let busy = false, searching = false, tick = 0;

function load() {
  if (S) return S;
  try { S = JSON.parse(world.getDynamicProperty(KEY) ?? "null"); } catch { S = null; }
  // versões antigas marcavam ladrilhos que FALHARAM como "feitos" (valor 2) e a cidade ficava incompleta para sempre: volta a tentar
  if (S?.done) for (const k of Object.keys(S.done)) if (S.done[k] !== 1) delete S.done[k];
  return S;
}
function save() { try { world.setDynamicProperty(KEY, JSON.stringify(S)); } catch { /* ignore */ } }
const ow = () => world.getDimension("minecraft:overworld");
function cmd(dim, c) { try { dim.runCommand(c); return true; } catch { return false; } }
function blockAt(dim, x, y, z) { try { return dim.getBlock({ x, y, z }); } catch { return undefined; } }

function loadArea(dim, x, z, done, give = 160) {
  cmd(dim, `tickingarea remove ${AREA}`);
  const ok = cmd(dim, `tickingarea add circle ${Math.round(x)} 64 ${Math.round(z)} 4 ${AREA}`);
  let t = 0;
  const h = system.runInterval(() => {
    t += 5;
    const b = blockAt(dim, Math.round(x), 64, Math.round(z));
    if (b || t >= give) { system.clearRun(h); done(!!b); }
  }, 5);
  return ok;
}
const freeArea = (dim) => cmd(dim, `tickingarea remove ${AREA}`);

// ------------------------------------------------------------ escolha do local
function sample(dim, cx, cz) {
  const hs = []; let wet = false;
  for (const dx of [-56, 0, 56]) for (const dz of [-56, 0, 56]) {
    let b; try { b = dim.getTopmostBlock({ x: cx + dx, z: cz + dz }); } catch { b = undefined; }
    if (!b) return null;
    const id = b.typeId; if (id.includes("water") || id.includes("lava") || id.includes("ice")) wet = true;
    hs.push(b.location.y);
  }
  const mn = Math.min(...hs), mx = Math.max(...hs);
  return { wet, range: mx - mn, y: mx };
}
function findSite(done) {
  if (searching) return; searching = true;
  const dim = ow(); let sp; try { sp = world.getDefaultSpawnLocation(); } catch { sp = { x: 0, z: 0 }; }
  const cands = []; for (const r of SEARCH_R) for (let a = 0; a < 8; a++) cands.push({ x: Math.round(sp.x + Math.cos(a * Math.PI / 4 + r) * r), z: Math.round(sp.z + Math.sin(a * Math.PI / 4 + r) * r) });
  let i = 0, best = null;
  const next = () => {
    if (i >= cands.length) {
      // GARANTIA: se nenhum terreno plano e seco foi achado, usa um local fixo (nunca deixa a cidade sem posição)
      if (!best) { const fx = Math.round(sp.x + 700), fz = Math.round(sp.z); let fy = 64; try { fy = dim.getTopmostBlock({ x: fx, z: fz })?.location.y ?? 64; } catch { /* ignore */ } best = { x: fx, z: fz, y: fy, range: 99, fallback: true }; }
      freeArea(dim); searching = false; done(best); return;
    }
    const c = cands[i++];
    loadArea(dim, c.x, c.z, (ok) => {
      const r = ok ? sample(dim, c.x, c.z) : null;
      if (r && !r.wet) {
        const sc = r.range; if (!best || sc < best.range) best = { x: c.x, z: c.z, y: r.y, range: sc };
        if (sc <= 6) { freeArea(dim); searching = false; done(best); return; }
      }
      system.runTimeout(next, 5);
    });
  };
  next();
}

// ------------------------------------------------------------ colocação
function tileCenter(t) { return { x: S.x + t.ox + 32, z: S.z + t.oz + 32 }; }
function nearestPending() {
  let best = null, bd = NEAR * NEAR;
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== "minecraft:overworld") continue;
    const l = p.location;
    for (const t of TEMPEST.tiles) {
      if (S.done[t.id]) continue;
      const c = tileCenter(t), dx = Math.max(0, Math.abs(l.x - c.x) - 32), dz = Math.max(0, Math.abs(l.z - c.z) - 32), d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = t; }
    }
  }
  return best;
}
function spawnNpcs(t) {
  const dim = ow();
  TEMPEST.npcs.forEach((n, i) => {
    if (S.npcs[i] || n[0] < t.ox || n[0] >= t.ox + 64 || n[1] < t.oz || n[1] >= t.oz + 64) return;
    try { dim.spawnEntity(`etheria:npc_${NPC_ROLE[i % NPC_ROLE.length]}`, { x: S.x + n[0] + 0.5, y: S.y + 1, z: S.z + n[1] + 0.5 }); S.npcs[i] = 1; } catch { /* tenta no próximo ciclo */ }
  });
}
/** Coloca um ladrilho (área já carregada). Núcleo placer.js: API structureManager e, se falhar, "structure load" (mesmo arquivo). */
function placeOne(dim, t) {
  const at = clampOrigin(dim, { x: S.x + t.ox, y: S.y + t.dy, z: S.z + t.oz }, [t.sx, t.sy, t.sz]);
  const err = placeFile(dim, t.id, at);
  if (!err) return true;
  S.err = (S.err ?? 0) + 1; S.lastErr = `${t.id}: ${err}`; console.warn(`[Etheria] Tempest ${t.id}: ${err}`); return false;
}
function placeTile(t, after) {
  const dim = ow(), c = tileCenter(t);
  loadArea(dim, c.x, c.z, (ok) => {
    let res = false;
    if (ok) {
      if (placeOne(dim, t)) { S.done[t.id] = 1; res = true; system.runTimeout(() => { spawnNpcs(t); save(); }, 20); }
      else { S.fail = (S.fail ?? 0) + 1; }
    }
    freeArea(dim); save(); after(res);
  });
}
function announce(p) {
  if (S.ann) return; S.ann = 1; save();
  say(p, `§6[Etheria] §fVocê sente uma presença enorme à distância: a §eCidade de Tempest§f surgiu em §e${S.x}, ${S.y}, ${S.z}§f. Use §e!tempest§f para ver a rota.`);
}

/** Ponto seguro de entrada (calculado dos ladrilhos reais em tools/tempest_pack.py: chão plano, seco, 3 blocos de ar acima, olhando para o centro).
 *  O centro do mapa fica DENTRO de uma torre de diorito: nunca se usa o centro como destino. */
export function tempestSpawn() {
  if (!S) return null;
  const sp = TEMPEST.spawn ?? { x: 0, y: 2, z: 0, yaw: 0 };
  return { x: S.x + sp.x + 0.5, y: S.y + sp.y, z: S.z + sp.z + 0.5, yaw: sp.yaw ?? 0 };
}
/** O ponto de entrada é válido? chão sólido, 2 blocos de ar para o jogador, ladrilho que o contém já colocado. */
function spawnValid(dim) {
  const p = tempestSpawn(); if (!p) return false;
  const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
  const g = blockAt(dim, bx, by - 1, bz), f = blockAt(dim, bx, by, bz), h = blockAt(dim, bx, by + 1, bz);
  return !!(g && !g.isAir && !g.isLiquid && f && f.isAir && h && h.isAir);
}
function tileOf(rx, rz) { return TEMPEST.tiles.find((t) => rx >= t.ox && rx < t.ox + 64 && rz >= t.oz && rz < t.oz + 64); }

export function tempestInfo() { return S ? { x: S.x, y: S.y, z: S.z, done: Object.keys(S.done).length, total: TEMPEST.tiles.length } : null; }

const complete = () => !!S && TEMPEST.tiles.every((t) => S.done[t.id]);
export const tempestReady = () => load() && complete();
let autoRun = false, autoTries = 0;
/** GERAÇÃO AUTOMÁTICA no carregamento do mundo: assim que existe um jogador (a API só acessa a dimensão com o mundo ativo), localiza o terreno e coloca
 *  TODOS os ladrilhos de uma vez (lotes de 8 com tickingarea próprio, ~1 s), sem depender de distância nem de chance. Não repete: o estado salvo (S.done) impede
 *  duplicação; se algum ladrilho falhar, tenta de novo a cada 10 s (até 12 vezes). Ao concluir define o ponto de spawn do mundo na entrada da cidade. */
function autoGenerate() {
  if (autoRun || (load() && complete() && S.spawnSet)) return;
  autoRun = true;
  const players = () => world.getAllPlayers();
  const tell = (m) => { for (const p of players()) say(p, m); };
  if (!(load() && complete())) tell("§6[Tempest] §7Gerando a Cidade de Tempest...");
  ensureTempest((sp) => {
    autoRun = false;
    if (S && complete() && sp) {
      if (!S.spawnSet) {
        S.spawnSet = 1; save();
        try { world.setDefaultSpawnLocation({ x: Math.floor(sp.x), y: Math.floor(sp.y), z: Math.floor(sp.z) }); } catch (e) { console.warn(`[Etheria] spawn do mundo: ${e}`); }
        tell(`§6[Tempest] §aA Cidade de Tempest está pronta em §e${S.x}, ${S.y}, ${S.z}§a. Use §e!tempest ir§a para ir até lá.`);
      }
      return;
    }
    if (++autoTries <= 12) system.runTimeout(autoGenerate, 200);
    else console.warn("[Etheria] Tempest: não foi possível concluir a geração automática (veja !tempest).");
  });
}

export function startTempest() {
  // geração automática imediata: ao entrar o primeiro jogador (ou, se o script iniciar com jogadores já no mundo, logo em seguida)
  world.afterEvents.playerSpawn.subscribe((ev) => { if (ev.initialSpawn) system.runTimeout(autoGenerate, 10); });
  system.runTimeout(() => { if (world.getAllPlayers().length) autoGenerate(); }, 20);
  system.runInterval(() => {
    if (busy || searching || world.getAllPlayers().length === 0) return;
    tick++;
    if (!load()) { if (tick > 2) { busy = true; findSite((s) => { busy = false; if (s) { S = { x: s.x, y: s.y, z: s.z, done: {}, npcs: {}, ann: 0 }; save(); } }); } return; }
    const t = nearestPending(); if (!t) return;
    busy = true; placeTile(t, () => { busy = false; });
    const p = world.getAllPlayers()[0]; if (p) announce(p);
  }, 40);
}

// ------------------------------------------------------------ comando: !tempest [tp | aqui | refazer]
export function tempestCmd(p, args) {
  const a = (args[0] ?? "").toLowerCase();
  // !tempest ir | tp  (QUALQUER jogador): garante que a cidade existe (coloca o que faltar) e leva à entrada segura
  if (a === "ir" || a === "tp" || a === "go") {
    say(p, "§6[Tempest] §7Preparando a viagem...");
    return ensureTempest((sp) => {
      if (!sp) return say(p, "§c[Tempest] A cidade ainda não ficou pronta (terreno carregando). Tente de novo em alguns segundos.");
      try { p.teleport({ x: sp.x, y: sp.y, z: sp.z }, { dimension: ow(), rotation: { x: 0, y: sp.yaw ?? 0 }, keepVelocity: false }); say(p, "§aTeleportado à entrada de Tempest."); } catch (e) { say(p, `§cNão consegui teleportar: ${e}`); }
    });
  }
  if (a === "aqui" || a === "refazer" || a === "gerar") {
    if (!canBuild(p)) return say(p, "§cSem permissão (precisa ser operador/administrador ou estar sozinho no mundo).");
    if (busy || searching) return say(p, "§7[Tempest] A cidade já está sendo construída. Aguarde.");
    return buildTempestAt(p);
  }
  const i = load() && tempestInfo();
  if (!i) return say(p, "§7A Cidade de Tempest ainda está sendo localizada. Aguarde alguns segundos ou use §e!tempest aqui§7.");
  const l = p.location, dx = Math.round(i.x - l.x), dz = Math.round(i.z - l.z);
  say(p, `§6[Tempest] §fCentro: §e${i.x}, ${i.y}, ${i.z}§f · distância §e${Math.round(Math.hypot(dx, dz))}§f blocos · construída: §e${i.done}/${i.total}§f ladrilhos${S.lastErr && i.done < i.total ? `§c (último erro: ${S.lastErr})` : ""}.`);
}

// ------------------------------------------------------------ garantia para a sala de origem (21.1–21.10): a cidade EXISTE antes do teleporte.
// Localiza o terreno se preciso, coloca TODOS os ladrilhos que faltam (um a um, cada um com a área carregada, sem depender de jogadores por perto),
// gera os NPCs de cada ladrilho e confere o centro. Chamadas repetidas não duplicam nada (S.done). Devolve {x,y,z} ou null.
export function ensureTempest(cb, tries = 0, progress = null) {
  if (busy || searching) { if (tries > 300) return cb(null); return system.runTimeout(() => ensureTempest(cb, tries + 1, progress), 20); }
  const dim = ow();
  const begin = () => {
    busy = true;
    const total = TEMPEST.tiles.length, PASSES = 2, PER_TICK = 4;
    const doneCount = () => TEMPEST.tiles.filter((t) => S.done[t.id]).length;
    const finish = () => {
      const sp = TEMPEST.spawn ?? { x: 0, z: 0 }, st = tileOf(sp.x, sp.z);
      enqueue((next) => holdRegion(dim, Math.floor(S.x + sp.x) - 8, Math.floor(S.z + sp.z) - 8, 16, 16, (ok, _why, release) => {
        // só devolve o ponto se o ladrilho do spawn foi colocado E o ponto é seguro (chão sólido + 2 blocos de ar)
        const valid = ok && (!st || !!S.done[st.id]) && spawnValid(dim);
        release(); next(); busy = false; save();
        cb(valid ? tempestSpawn() : null);
      }, 300));
    };
    // Ondas: cada quadrante (4x4 ladrilhos = 256x256 blocos) é carregado INTEIRO de uma vez (4 tickingareas de 10x10 chunks),
    // os 16 ladrilhos são colocados (4 por tick, para não travar o celular) e só então a área é liberada.
    const runPass = (pass) => {
      const todo = TEMPEST.tiles.filter((t) => !S.done[t.id]);
      if (todo.length === 0 || pass >= PASSES) return finish();
      const groups = new Map();
      for (const t of todo) { const k = `${Math.floor((t.ox + half) / 256)},${Math.floor((t.oz + half) / 256)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
      const list = [...groups.values()];
      const wave = (gi) => {
        if (gi >= list.length) return runPass(pass + 1);
        const g = list[gi], x0 = Math.min(...g.map((t) => t.ox)), z0 = Math.min(...g.map((t) => t.oz));
        const x1 = Math.max(...g.map((t) => t.ox + t.sx)), z1 = Math.max(...g.map((t) => t.oz + t.sz));
        enqueue((next) => holdRegion(dim, S.x + x0, S.z + z0, x1 - x0, z1 - z0, (ok, why, release) => {
          if (!ok) { S.lastErr = `quadrante ${gi + 1}: ${why}`; release(); next(); save(); return wave(gi + 1); }
          let i = 0;
          const step = () => {
            try {
              for (let n = 0; n < PER_TICK && i < g.length; n++, i++) { const t = g[i]; if (placeOne(dim, t)) { S.done[t.id] = 1; spawnNpcs(t); } }
            } catch (e) { console.warn(`[Etheria] Tempest: ${e}`); }
            if (progress) { try { progress(doneCount(), total); } catch { /* ignore */ } }
            if (i < g.length) return system.runTimeout(step, 1);
            save(); release(); next(); wave(gi + 1);
          };
          step();
        }, 900));
      };
      wave(0);
    };
    runPass(0);
  };
  if (!load()) {
    busy = true;
    if (progress) progress(-1, 0);   // procurando terreno
    findSite((s) => {
      if (!s) { busy = false; return cb(null); }
      S = { x: s.x, y: s.y, z: s.z, done: {}, npcs: {}, ann: 0 }; save(); begin();
    });
    return;
  }
  begin();
}

/** Constrói a cidade inteira AGORA, com o centro à frente do jogador (a borda começa ~16 blocos à frente). Estruturas antigas não são apagadas. */
export function buildTempestAt(p, done) {
  const l = p.location; let d = { x: 0, z: 1 };
  try { const v = p.getViewDirection(); const n = Math.hypot(v.x, v.z) || 1; d = { x: v.x / n, z: v.z / n }; } catch { /* ignore */ }
  const cx = Math.floor(l.x + d.x * (half + 16)), cz = Math.floor(l.z + d.z * (half + 16));
  let y = Math.floor(l.y) - 1;
  try { const b = ow().getTopmostBlock({ x: Math.floor(l.x), z: Math.floor(l.z) }); if (b && !b.isLiquid) y = b.location.y; } catch { /* ignore */ }
  S = { x: cx, y, z: cz, done: {}, npcs: {}, ann: 1, spawnSet: 1 }; save();
  say(p, `§6[Tempest] §fConstruindo a §eCidade de Tempest§f agora (centro ${cx}, ${y}, ${cz})...`);
  let last = -1;
  ensureTempest((sp) => {
    const i = tempestInfo();
    if (sp) say(p, `§a[Tempest] Cidade completa: ${i.done}/${i.total} ladrilhos. Use §e!tempest ir§a para ir à entrada.`);
    else say(p, `§c[Tempest] Construída ${i?.done ?? 0}/${i?.total ?? 64}. ${S?.lastErr ? "Motivo: " + S.lastErr : "Entrada ainda não verificada."} Use §e!tempest aqui§c de novo para completar.`);
    done?.(sp);
  }, 0, (n, total) => { if (n >= 0 && n - last >= 16) { last = n; say(p, `§7[Tempest] ${n}/${total} ladrilhos colocados...`); } });
}

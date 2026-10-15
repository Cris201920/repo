// systems/settlements.js - TERRITÓRIOS do mundo vivo: Dwargon, Cidadela Carmesim, Acampamento da Horda e Santuário do Mestre.
// Cada território: (1) escolhe um terreno plano (sem água) na distância/ângulo definidos em data/factions.js; (2) quando um jogador chega perto,
// constrói a vila proceduralmente com poucos comandos "fill" por tick (leve para celular) com tickingarea só durante a obra;
// (3) gera os NPCs do território e repõe os que sumiram (com espera); (4) Tempest recebe os NPCs extras sobre a cidade já importada.
// Estado persistente na propriedade dinâmica do mundo. Nada aqui apaga estruturas antigas fora da área da vila.
import { world, system } from "@minecraft/server";
import { SETTLEMENTS, SETTLEMENT_LIST, TEMPEST_EXTRA, FACTIONS } from "../data/factions.js";
import { tempestInfo } from "./tempest.js";
import { say } from "../core/utils.js";
import { ADMIN_TAG } from "../config.js";

const KEY = "etheria:settle";
const AREA = "etheria_st";
const BUILD_NEAR = 100, SPAWN_NEAR = 70, PER_TICK = 10, RESPAWN_CD = 6000, ORC_CD = 12000;
const OFFS = [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60], [100, 100], [-100, -100], [100, -100], [-100, 100]];

let S = null, searching = false, building = false, tick = 0;
const cd = new Map();     // `${id}` -> último respawn (tick)

function load() {
  if (S) return S;
  try { S = JSON.parse(world.getDynamicProperty(KEY) ?? "{}"); } catch { S = {}; }
  if (!S || typeof S !== "object") S = {};
  return S;
}
function save() { try { world.setDynamicProperty(KEY, JSON.stringify(S)); } catch { /* ignore */ } }
const ow = () => world.getDimension("minecraft:overworld");
// Um comando "fill" que não muda nenhum bloco (ex.: ar sobre ar) tem successCount 0 mas NÃO é erro.
// Antes isso contava como falha e o laço tentava de novo 40 vezes por comando, deixando a cidade quase parada.
// Agora só exceção conta como falha.
function cmd(dim, c) { try { dim.runCommand(c); return true; } catch { return false; } }
function blockAt(dim, x, y, z) { try { return dim.getBlock({ x, y, z }); } catch { return undefined; } }

function loadArea(dim, x, z, done, give = 160, rad = 3) {
  cmd(dim, `tickingarea remove ${AREA}`);
  const ok = cmd(dim, `tickingarea add circle ${Math.round(x)} 64 ${Math.round(z)} ${rad} ${AREA}`);
  let t = 0;
  const h = system.runInterval(() => {
    t += 5;
    const b = blockAt(dim, Math.round(x), 64, Math.round(z));
    if (b || t >= give) { system.clearRun(h); done(!!b); }
  }, 5);
  return ok;
}
const freeArea = (dim) => cmd(dim, `tickingarea remove ${AREA}`);

/** Ponto de entrada SEGURO de uma cidade procedural: a praça ao sul do centro (o centro tem o mastro da bandeira / a fogueira; o Santuário tem o anel de pilares a 8 blocos).
 *  Pés em y+1 sobre o piso (y), olhando para o centro (yaw 180 = norte). */
export function entryOf(def, q) { return { x: q.x + 0.5, y: q.y + 1, z: q.z + (def.style === "hermit" ? 5 : 8) + 0.5, yaw: 180 }; }
function entryValid(dim, def, q) {
  const e = entryOf(def, q), bx = Math.floor(e.x), by = Math.floor(e.y), bz = Math.floor(e.z);
  const g = blockAt(dim, bx, by - 1, bz), f = blockAt(dim, bx, by, bz), h = blockAt(dim, bx, by + 1, bz);
  return !!(g && !g.isAir && !g.isLiquid && f && f.isAir && h && h.isAir);
}

export function settlementInfo(id) { const s = load()[id]; return s?.x !== undefined ? { x: s.x, y: s.y, z: s.z, built: !!s.built } : null; }

// ------------------------------------------------------------ escolha do local
function sample(dim, cx, cz, r) {
  const hs = []; let wet = false;
  for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]]) {
    let b; try { b = dim.getTopmostBlock({ x: cx + dx, z: cz + dz }); } catch { b = undefined; }
    if (!b) return null;
    const id = b.typeId; if (id.includes("water") || id.includes("lava") || id.includes("ice")) wet = true;
    hs.push(b.location.y);
  }
  const mn = Math.min(...hs), mx = Math.max(...hs);
  return { wet, range: mx - mn, y: Math.round(hs.slice().sort((a, b) => a - b)[Math.floor(hs.length / 2)]) };
}
function findSite(def, done) {
  if (searching) return; searching = true;
  const dim = ow(); let sp; try { sp = world.getDefaultSpawnLocation(); } catch { sp = { x: 0, z: 0 }; }
  const a = def.angle * Math.PI / 180, bx = sp.x + Math.cos(a) * def.dist, bz = sp.z + Math.sin(a) * def.dist;
  let i = 0, best = null;
  const finish = () => { freeArea(dim); searching = false; done(best); };
  const next = () => {
    if (i >= OFFS.length) return finish();
    const c = { x: Math.round(bx + OFFS[i][0]), z: Math.round(bz + OFFS[i][1]) }; i++;
    loadArea(dim, c.x, c.z, (ok) => {
      const r = ok ? sample(dim, c.x, c.z, def.radius + 2) : null;
      if (r && !r.wet) {
        if (!best || r.range < best.range) best = { x: c.x, z: c.z, y: r.y, range: r.range };
        if (r.range <= 3) return finish();
      }
      system.runTimeout(next, 5);
    }, 120, 2);
  };
  next();
}

// ------------------------------------------------------------ plantas (comandos fill relativos ao centro; y=0 é o piso da vila)
const PAL = {
  dwarf: { base: "stone", floor: "polished_deepslate", plaza: "deepslate_bricks", wall: "deepslate_bricks", trim: "polished_blackstone_bricks", roof: "dark_oak_planks", glass: "glass_pane", light: "lantern", banner: "orange_wool", wood: "dark_oak_planks", fence: "dark_oak_fence", core: "blast_furnace" },
  guy: { base: "blackstone", floor: "polished_blackstone_bricks", plaza: "red_nether_bricks", wall: "polished_blackstone_bricks", trim: "red_nether_bricks", roof: "nether_bricks", glass: "glass_pane", light: "soul_lantern", banner: "red_wool", wood: "crimson_planks", fence: "nether_brick_fence", core: "blast_furnace" },
  orc: { base: "coarse_dirt", floor: "coarse_dirt", plaza: "gravel", wall: "spruce_log", trim: "stripped_spruce_log", roof: "hay_block", glass: "spruce_planks", light: "lantern", banner: "green_wool", wood: "spruce_planks", fence: "spruce_fence", core: "campfire" },
  hermit: { base: "stone", floor: "mossy_stone_bricks", plaza: "smooth_stone", wall: "mossy_stone_bricks", trim: "quartz_pillar", roof: "quartz_block", glass: "glass_pane", light: "sea_lantern", banner: "purple_wool", wood: "birch_planks", fence: "birch_fence", core: "chiseled_quartz_block" },
};

function plan(def) {
  const P = PAL[def.style] ?? PAL.dwarf, R = def.radius, out = [];
  const box = (x1, y1, z1, x2, y2, z2, blk, mode = "") => out.push({ a: [x1, y1, z1], b: [x2, y2, z2], blk, mode });
  const one = (x, y, z, blk) => box(x, y, z, x, y, z, blk);
  const house = (cx, cz, hw, hd, h, door) => {         // casa oca com porta virada para `door` ('n','s','e','w'), janelas e telhado em pirâmide
    box(cx - hw, 1, cz - hd, cx + hw, h, cz + hd, P.wall, "hollow");
    box(cx - hw, 1, cz - hd, cx - hw, 1, cz + hd, P.trim); box(cx + hw, 1, cz - hd, cx + hw, 1, cz + hd, P.trim);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(cx + sx * hw, 1, cz + sz * hd, cx + sx * hw, h, cz + sz * hd, P.trim);
    const dx = door === "e" ? hw : door === "w" ? -hw : 0, dz = door === "s" ? hd : door === "n" ? -hd : 0;
    if (dx) box(cx + dx, 1, cz, cx + dx, 2, cz, "air"); else box(cx, 1, cz + dz, cx, 2, cz + dz, "air");
    for (const o of [-2, 2]) {
      if (door !== "n") one(cx + o, 3, cz - hd, P.glass); if (door !== "s") one(cx + o, 3, cz + hd, P.glass);
    }
    for (let k = 0; k < 4 && hw - k >= 0 && hd - k >= 0; k++) box(cx - hw - 1 + k, h + 1 + k, cz - hd - 1 + k, cx + hw + 1 - k, h + 1 + k, cz + hd + 1 - k, P.roof);
    one(cx, 2, cz, P.light);
  };
  const tower = (cx, cz, h) => {
    box(cx - 2, 1, cz - 2, cx + 2, h, cz + 2, P.wall, "hollow"); box(cx - 3, h, cz - 3, cx + 3, h, cz + 3, P.trim);
    for (const [ox, oz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) box(cx + ox, h + 1, cz + oz, cx + ox, h + 1, cz + oz, P.trim);
    box(cx, 1, cz + 2, cx, 2, cz + 2, "air"); one(cx, h + 1, cz, P.light);
  };
  // terreno: limpa o ar acima, preenche a base e assenta o piso
  box(-R - 2, 1, -R - 2, R + 2, 7, R + 2, "air"); box(-R - 2, 8, -R - 2, R + 2, 13, R + 2, "air");
  box(-R - 2, -4, -R - 2, R + 2, -1, R + 2, P.base);
  box(-R - 2, 0, -R - 2, R + 2, 0, R + 2, P.floor);
  box(-6, 0, -6, 6, 0, 6, P.plaza); box(-1, 0, -R - 2, 1, 0, -6, P.plaza); box(-1, 0, 6, 1, 0, R + 2, P.plaza); box(-R - 2, 0, -1, -6, 0, 1, P.plaza); box(6, 0, -1, R + 2, 0, 1, P.plaza);

  if (def.style === "hermit") {
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, x = Math.round(Math.cos(a) * 8), z = Math.round(Math.sin(a) * 8); box(x, 1, z, x, 6, z, P.trim); one(x, 7, z, P.light); }
    box(-2, 1, -2, 2, 1, 2, P.wall); box(-1, 2, -1, 1, 2, 1, P.trim); one(0, 3, 0, P.core);
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { box(x, 1, z, x, 2, z, P.fence); one(x, 3, z, P.light); }
    return out;
  }
  // muralha com portão ao sul
  const wh = def.style === "orc" ? 4 : 6, wt = def.style === "orc" ? 0 : 1;
  box(-R, 1, -R, R, wh, -R + wt, P.wall); box(-R, 1, R - wt, R, wh, R, P.wall); box(-R, 1, -R, -R + wt, wh, R, P.wall); box(R - wt, 1, -R, R, wh, R, P.wall);
  box(-R, wh + 1, -R, R, wh + 1, -R, def.style === "orc" ? P.fence : P.trim); box(-R, wh + 1, R, R, wh + 1, R, def.style === "orc" ? P.fence : P.trim);
  box(-R, wh + 1, -R, -R, wh + 1, R, def.style === "orc" ? P.fence : P.trim); box(R, wh + 1, -R, R, wh + 1, R, def.style === "orc" ? P.fence : P.trim);
  box(-3, 1, R - 2, 3, wh - 1, R + 1, "air"); box(-4, wh - 1, R - 1, 4, wh, R, P.trim); box(-4, 1, R - 1, -4, wh, R, P.trim); box(4, 1, R - 1, 4, wh, R, P.trim);
  for (const [x, z] of [[-R, -R], [R, -R], [-R, R], [R, R]]) tower(x, z, def.style === "orc" ? 8 : 10);
  // poste de estandarte central + lampiões da praça
  box(0, 1, 0, 0, 9, 0, P.fence); box(1, 6, 0, 3, 9, 0, P.banner); box(-3, 6, 0, -1, 9, 0, P.banner); one(0, 10, 0, P.light);
  for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [-3, 10], [3, 10]]) { box(x, 1, z, x, 3, z, P.fence); one(x, 4, z, P.light); }
  if (def.style === "orc") {
    for (const [x, z, d] of [[-14, -14, "s"], [14, -14, "s"], [-14, 12, "e"], [14, 12, "w"], [-8, -16, "s"]]) house(x, z, 2, 2, 3, d);
    box(-1, 1, 3, 1, 1, 5, P.floor); one(0, 1, 4, P.core); box(-1, 1, 3, -1, 1, 3, "hay_block");
    return out;
  }
  for (const [x, z] of [[-16, -16], [16, -16], [-16, 14], [16, 14]]) house(x, z, 3, 3, 4, x < 0 ? "e" : "w");
  // salão principal no fundo (norte), porta virada para a praça
  box(-6, 1, -R + 1, 6, 6, -15, P.wall, "hollow"); box(-7, 7, -R + 1, 7, 7, -14, P.roof); box(-5, 8, -R + 2, 5, 8, -15, P.roof); box(-3, 9, -R + 3, 3, 9, -16, P.roof);
  box(-2, 1, -15, 2, 4, -15, "air"); box(-3, 1, -15, -3, 5, -15, P.trim); box(3, 1, -15, 3, 5, -15, P.trim);
  for (const x of [-5, -3, 3, 5]) one(x, 3, -R + 1, P.glass);
  box(-1, 1, -R + 3, 1, 1, -R + 3, P.trim); one(0, 2, -R + 3, P.core); box(-4, 1, -17, -4, 3, -17, P.fence); box(4, 1, -17, 4, 3, -17, P.fence); one(-4, 4, -17, P.light); one(4, 4, -17, P.light);
  if (def.style === "dwarf") { box(-12, 1, -12, -8, 1, -12, "anvil"); one(-9, 1, -6, "anvil"); one(-8, 1, -4, "blast_furnace"); one(-10, 1, -4, "smithing_table"); }
  return out;
}

function expand(ops, o) {
  const cmds = [];
  for (const op of ops) {
    const x1 = o.x + Math.min(op.a[0], op.b[0]), x2 = o.x + Math.max(op.a[0], op.b[0]), z1 = o.z + Math.min(op.a[2], op.b[2]), z2 = o.z + Math.max(op.a[2], op.b[2]);
    const y1 = o.y + Math.min(op.a[1], op.b[1]), y2 = o.y + Math.max(op.a[1], op.b[1]);
    const vol = (x2 - x1 + 1) * (z2 - z1 + 1);
    const maxH = Math.max(1, Math.floor(30000 / vol));
    for (let y = y1; y <= y2; y += maxH) cmds.push(`fill ${x1} ${y} ${z1} ${x2} ${Math.min(y2, y + maxH - 1)} ${z2} ${op.blk.includes(":") ? op.blk : "minecraft:" + op.blk}${op.mode ? " " + op.mode : ""}`);
  }
  return cmds;
}

// ------------------------------------------------------------ construção
function buildSettlement(def, st, done, perTick = PER_TICK) {
  const dim = ow(), cmds = expand(plan(def), { x: st.x, y: st.y, z: st.z });
  let i = 0, fails = 0; const skipped = [];
  // comando que falha por exceção (área ainda não carregada, por exemplo) é repetido; se esgotar as tentativas vai para a lista de pulados e é refeito no fim
  const finish = (rounds) => {
    if (!skipped.length || rounds >= 3) return done(skipped.length);
    system.runTimeout(() => {
      for (let k = skipped.length - 1; k >= 0; k--) if (cmd(dim, skipped[k])) skipped.splice(k, 1);
      finish(rounds + 1);
    }, 20);
  };
  const h = system.runInterval(() => {
    let n = 0;
    while (n < perTick && i < cmds.length) {
      if (cmd(dim, cmds[i])) { i++; fails = 0; } else { fails++; if (fails > 40) { skipped.push(cmds[i]); i++; fails = 0; } else break; }
      n++;
    }
    if (i >= cmds.length) { system.clearRun(h); finish(0); }
  }, 1);
}

function nearestPlayer(x, z, max) {
  let best = null, bd = max * max;
  for (const p of world.getAllPlayers()) {
    if (p.dimension.id !== "minecraft:overworld") continue;
    const dx = p.location.x - x, dz = p.location.z - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// ------------------------------------------------------------ NPCs
function standAt(dim, x, y, z) {
  const free = (px, py, pz) => { const a = blockAt(dim, px, py, pz), b = blockAt(dim, px, py + 1, pz), g = blockAt(dim, px, py - 1, pz); return a && b && g && a.isAir && b.isAir && !g.isAir && !g.isLiquid; };
  for (let r = 0; r <= 4; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    if (free(x + dx, y, z + dz)) return { x: x + dx + 0.5, y, z: z + dz + 0.5 };
  }
  return null;
}
function ensureNpcs(key, c, npcs, mobs) {
  const dim = ow();
  if (!blockAt(dim, c.x, c.y, c.z)) return;
  const tag = "st_" + key, have = {}, haveMob = {};
  let ents; try { ents = dim.getEntities({ tags: [tag], location: { x: c.x, y: c.y, z: c.z }, maxDistance: 90 }); } catch { return; }
  for (const e of ents) { if (e.typeId.startsWith("etheria:npc_")) have[e.typeId] = (have[e.typeId] ?? 0) + 1; else haveMob[e.typeId] = (haveMob[e.typeId] ?? 0) + 1; }
  const first = !c.st.spawned, now = system.currentTick;
  const need = []; const cnt = {};
  for (const [role, dx, dz] of npcs) { const t = "etheria:npc_" + role; cnt[t] = (cnt[t] ?? 0) + 1; if (cnt[t] > (have[t] ?? 0)) need.push([t, dx, dz]); }
  const mneed = []; for (const [t, n] of mobs ?? []) for (let k = (haveMob[t] ?? 0); k < n; k++) mneed.push([t, (k % 2 ? 1 : -1) * (5 + k * 2), 3 + k * 2]);
  if (!first && now - (cd.get(key) ?? -1e9) < RESPAWN_CD) return;
  if (!need.length && !mneed.length) { if (first) { c.st.spawned = 1; save(); } return; }
  for (const [t, dx, dz] of need) {
    const pos = standAt(dim, c.x + dx, c.y + 1, c.z + dz); if (!pos) continue;
    try { const e = dim.spawnEntity(t, pos); e.addTag(tag); } catch { /* tenta no próximo ciclo */ }
  }
  if (!first || mneed.length) for (const [t, dx, dz] of mneed) {
    if (!first && now - (cd.get(key + "m") ?? -1e9) < ORC_CD) break;
    const pos = standAt(dim, c.x + dx, c.y + 1, c.z + dz); if (!pos) continue;
    try { const e = dim.spawnEntity(t, pos); e.addTag(tag); } catch { /* ignore */ }
    cd.set(key + "m", now);
  }
  cd.set(key, now); if (first) { c.st.spawned = 1; save(); }
}

// ------------------------------------------------------------ laço principal (barato: 1 passo por 40 ticks)
function step() {
  if (world.getAllPlayers().length === 0 || searching || building) return;
  tick++;
  const st = load();
  for (const def of SETTLEMENT_LIST) {
    const s = st[def.id];
    if (!s || s.x === undefined) { if (tick > 3) findSite(def, (b) => { if (b) { st[def.id] = { x: b.x, y: b.y, z: b.z, built: 0, spawned: 0 }; save(); } }); return; }
    const p = nearestPlayer(s.x, s.z, BUILD_NEAR);
    if (!s.built) {
      if (!p) continue;
      building = true; const dim = ow();
      loadArea(dim, s.x, s.z, (ok) => {
        if (!ok) { freeArea(dim); building = false; return; }
        buildSettlement(def, s, (missing) => {
          s.fail = missing ? (s.fail ?? 0) + 1 : 0;
          s.built = !missing || s.fail >= 3 ? 1 : 0;   // faltou comando: tenta de novo (até 3 vezes) em vez de declarar a cidade pronta
          save(); freeArea(dim); building = false;
          const q = nearestPlayer(s.x, s.z, 160);
          if (q) say(q, `§6[Mundo] §f${FACTIONS[def.faction].color}${def.name}§f foi avistada em §e${s.x}, ${s.z}§f. Use §e!mundo§f para ver os territórios.`);
        });
      }, 160, 3);
      return;
    }
    if (nearestPlayer(s.x, s.z, SPAWN_NEAR)) ensureNpcs(def.id, { x: s.x, y: s.y, z: s.z, st: s }, def.npcs, def.mobs);
  }
  const ti = tempestInfo();
  if (ti && ti.done >= Math.ceil(ti.total * 0.5) && nearestPlayer(ti.x, ti.z, SPAWN_NEAR + 20)) {
    if (!st.tempest) st.tempest = {};
    ensureNpcs("tempest", { x: ti.x, y: ti.y, z: ti.z, st: st.tempest }, TEMPEST_EXTRA, []);
  }
}

export function startSettlements() { system.runInterval(step, 40); }

// ------------------------------------------------------------ comando: !aldeia [lista | tp <id> | refazer <id>]
export function settlementsCmd(p, args) {
  const a = (args[0] ?? "").toLowerCase(), admin = p.hasTag(ADMIN_TAG), st = load();
  if (a === "tp" || a === "refazer") {
    if (!admin) return say(p, "§cSem permissão.");
    const s = st[args[1]]; if (!s || s.x === undefined) return say(p, "§7Território desconhecido ou ainda não localizado. Ids: " + SETTLEMENT_LIST.map((d) => d.id).join(", "));
    if (a === "tp") {
      // garante que a cidade esteja construída antes de levar o admin (evita cair em terreno vazio)
      const def = SETTLEMENT_LIST.find((d) => d.id === args[1]);
      if (!def) return say(p, "§cTerritório inválido.");
      return ensureSettlement(def, (pos) => {
        if (!pos) return say(p, "§cNão foi possível construir o território agora, tente de novo.");
        try { p.teleport({ x: pos.x, y: pos.y, z: pos.z }, { rotation: { x: 0, y: pos.yaw ?? 0 } }); say(p, "§aTeleportado."); } catch { say(p, "§cTeleporte falhou."); }
      });
    }
    s.built = 0; s.spawned = 0; save(); return say(p, "§aO território será reconstruído quando você chegar perto.");
  }
  for (const d of SETTLEMENT_LIST) { const s = st[d.id]; say(p, `${FACTIONS[d.faction].color}${d.name}§7: ${s?.x !== undefined ? `§f${s.x}, ${s.z} §7(${Math.round(Math.hypot(s.x - p.location.x, s.z - p.location.z))} blocos${s.built ? "" : ", ainda não visitado"})` : "ainda sendo localizado"}`); }
}
// ------------------------------------------------------------ garantia para a sala de origem (21.x): a cidade está construída antes do teleporte
/** cb({x,y,z}) com o ponto de entrada da cidade já construída, ou cb(null) se não foi possível. Construção única (built), sem duplicar. */
export function ensureSettlement(def, cb, tries = 0) {
  if (building || searching) { if (tries > 300) return cb(null); return system.runTimeout(() => ensureSettlement(def, cb, tries + 1), 20); }
  const dim = ow(), st = load();
  const check = (q, ok) => (ok && entryValid(dim, def, q) ? entryOf(def, q) : null);   // só devolve o ponto se ele é seguro (chão sólido + 2 blocos de ar)
  const existing = st[def.id];
  building = true;
  if (existing && existing.x !== undefined && existing.built) {
    return loadArea(dim, existing.x, existing.z, (ok) => { freeArea(dim); building = false; cb(check(existing, ok)); }, 160, 3);
  }
  const build = (q) => loadArea(dim, q.x, q.z, (ok) => {
    if (!ok) { freeArea(dim); building = false; return cb(null); }
    buildSettlement(def, q, (missing) => {
      q.fail = missing ? (q.fail ?? 0) + 1 : 0;
      q.built = !missing || q.fail >= 3 ? 1 : 0; save();
      try { ensureNpcs(def.id, { x: q.x, y: q.y, z: q.z, st: q }, def.npcs, def.mobs); } catch { /* o laço principal completa */ }
      system.runTimeout(() => { const r = check(q, true); freeArea(dim); building = false; save(); cb(r); }, 40);
    }, 80);   // pela porta da origem: mais comandos por tick, a cidade fica pronta bem mais rápido
  }, 160, 3);
  if (existing && existing.x !== undefined) return build(existing);
  findSite(def, (b) => {
    if (!b) { building = false; return cb(null); }
    st[def.id] = { x: b.x, y: b.y, z: b.z, built: 0, spawned: 0 }; save();
    build(st[def.id]);
  });
}

export const __test = { plan, expand, PAL, entryOf };

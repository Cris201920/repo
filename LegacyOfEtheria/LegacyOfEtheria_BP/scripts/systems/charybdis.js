// systems/charybdis.js - 6.55: NÚCLEO DE CARÍBDIS (etheria:charybdis_core) — invocação da Caríbdis por carga de energia (inspirado na obra).
// 1) Obtenção: 5% ao derrotar um Megalodonte (a cria de Caríbdis); no Criativo, aba de itens; admin: !nucleo.
// 2) Instalação: usar o item mirando um bloco coloca o núcleo (bloco "conduíte" como âncora visual) sobre ele.
// 3) Carga: cada criatura (não jogador) derrotada a até 16 blocos do núcleo carrega energia = vida máxima real / 5 (1-200) — conta UMA vez por entidade.
//    A carga para no máximo (CFG.need); o progresso fica salvo no mundo (dynamic property) e aparece em partículas + ao tocar no núcleo.
// 4) Ativação: carregado, o núcleo pulsa; tocar nele (interagir) invoca Caríbdis na arena própria (Redemoinho de Charybdis), colocada no local:
//    a arena garante espaço livre para o tamanho do chefe (nunca nasce dentro de blocos). Se a arena falhar, nada é invocado e o núcleo continua carregado.
// 5) Segurança: 1 Caríbdis por mundo (CFG.maxWorld), trava de invocação por núcleo (sem cliques repetidos), núcleo consumido ao invocar,
//    quebrar o núcleo devolve o item (sem duplicar o conduíte), núcleos destruídos por explosão somem do registro.
// 6) Recompensa ao derrotar a Caríbdis invocada: itens reais do addon (Núcleo de Evolução, Núcleo de Gelo, Fragmento de Demonita) + moedas ao invocador.
import { world, system, ItemStack, BlockPermutation, Player } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { say, playSound, isValid, healthComp } from "../core/utils.js";
import { MOBS } from "../data/mobs.gen.js";
import { ADMIN_TAG } from "../config.js";
import { placeArena } from "./arenas.js";
import { ctx, mote, ringFlat, column, burst, implode, orbit, after, T } from "./fxlib.js";
import { sageText } from "./voice.js";

export const CORE_ID = "etheria:charybdis_core", BOSS = "etheria:tt_charybdis", ANCHOR = "minecraft:conduit";
export const CFG = { need: 1000, radius: 16, maxWorld: 1, maxCores: 16, dropChance: 0.05,
  reward: [["etheria:evolution_core", 2], ["etheria:frost_core", 3], ["etheria:demonite_shard", 4]], coins: 2000 };
const KEY = "etheria:charyb_cores";
const counted = new Set();   // entidades já contabilizadas
const read = () => { try { const r = JSON.parse(world.getDynamicProperty(KEY) ?? "[]"); return Array.isArray(r) ? r : []; } catch { return []; } };
const write = (r) => { try { world.setDynamicProperty(KEY, JSON.stringify(r.slice(-CFG.maxCores))); } catch { /* ignore */ } };
const same = (c, dim, l) => c.d === dim.id && c.x === Math.floor(l.x) && c.y === Math.floor(l.y) && c.z === Math.floor(l.z);
export const coresList = read;

export function installCore(player, b) {
  const dim = player.dimension, at = { x: b.location.x, y: b.location.y + 1, z: b.location.z };
  let tgt; try { tgt = dim.getBlock(at); } catch { /* ignore */ }
  if (!tgt || !tgt.isAir) return "Precisa de espaço livre em cima do bloco.";
  const r = read(); if (r.length >= CFG.maxCores) return "Limite de núcleos no mundo atingido.";
  if (r.some((c) => c.d === dim.id && Math.hypot(c.x - at.x, c.z - at.z) < CFG.radius * 2)) return "Já existe um núcleo perto daqui.";
  try { tgt.setPermutation(BlockPermutation.resolve(ANCHOR)); } catch { return "Não foi possível instalar aqui."; }
  r.push({ id: Date.now().toString(36), d: dim.id, x: at.x, y: at.y, z: at.z, e: 0, owner: player.name, pid: player.id, busy: 0 }); write(r);
  const c = ctx(player); implode(c, { x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5 }, { col: "water", tile: T.spark, n: 20, radius: 2.5, life: 0.5, size: 0.14 });
  playSound(player, "conduit.activate", 1, 0.7);
  try { sageText(player, `Núcleo de Caríbdis instalado. Derrote criaturas a até ${CFG.radius} blocos dele para carregá-lo.`, { pri: 3, key: "charyb.inst", cd: 100 }); } catch { /* ignore */ }
  return null;
}

function onDie(ev) {
  const e = ev.deadEntity; if (!e || e instanceof Player) return;
  let id, tid, loc, dim; try { id = e.id; tid = e.typeId; loc = e.location; dim = e.dimension; } catch { return; }
  if (counted.has(id)) return; counted.add(id); if (counted.size > 500) counted.delete(counted.values().next().value);
  // recompensa da Caríbdis invocada
  if (tid === BOSS) {
    const r = read(), c = r.find((x) => x.boss === id);
    if (c) { write(r.filter((x) => x !== c)); reward(c, dim, loc); }
    return;
  }
  if (tid === "etheria:tt_megalodon" && Math.random() < CFG.dropChance) { try { dim.spawnItem(new ItemStack(CORE_ID, 1), loc); } catch { /* ignore */ } }
  const r = read(); let changed = false;
  for (const c of r) {
    if (c.boss || c.d !== dim.id || c.e >= CFG.need || Math.hypot(c.x + 0.5 - loc.x, c.y - loc.y, c.z + 0.5 - loc.z) > CFG.radius) continue;
    const hp = MOBS[tid]?.hp ?? healthComp(e)?.effectiveMax ?? 10;
    c.e = Math.min(CFG.need, c.e + Math.max(1, Math.min(200, Math.round(hp / 5)))); changed = true;
    try { const k = ctx(undefined, 1, dim); implode(k, { x: c.x + 0.5, y: c.y + 0.6, z: c.z + 0.5 }, { col: "water", tile: T.spark, n: 8, radius: 3, life: 0.5, size: 0.12 }); } catch { /* ignore */ }
    if (c.e >= CFG.need) { for (const p of dim.getPlayers({ location: { x: c.x, y: c.y, z: c.z }, maxDistance: 48 })) { try { sageText(p, "Núcleo de Caríbdis totalmente carregado. Interaja com ele para invocar Caríbdis.", { pri: 2, key: "charyb.full", cd: 200 }); } catch { /* ignore */ } } }
    break;   // cada morte carrega um único núcleo
  }
  if (changed) write(r);
}

function reward(c, dim, loc) {
  for (const [it, n] of CFG.reward) { try { dim.spawnItem(new ItemStack(it, n), loc); } catch { /* ignore */ } }
  for (const p of world.getAllPlayers()) {
    if (p.id !== c.pid) continue;
    const d = getData(p); d.coins = (d.coins ?? 0) + CFG.coins; markDirty(p);
    say(p, `§b§l[Caríbdis] §r§fDerrotada! Recompensa do núcleo: §e${CFG.coins} moedas§f e materiais lendários no local da batalha.`);
    try { sageText(p, "Caríbdis neutralizada. O núcleo se desfez; recompensa registrada.", { pri: 2, key: "charyb.win", cd: 100 }); } catch { /* ignore */ }
  }
}

export function trySummon(player, c) {
  const r = read(), cur = r.find((x) => x.id === c.id); if (!cur) return "Núcleo não encontrado.";
  if (cur.e < CFG.need) return `Carga insuficiente: ${cur.e}/${CFG.need}.`;
  if (cur.busy && system.currentTick - cur.busy < 600) return "A invocação já está em andamento.";
  if (cur.boss) return "A Caríbdis deste núcleo ainda está ativa.";
  const dim = player.dimension;
  let alive = 0; try { alive = dim.getEntities({ type: BOSS }).length; } catch { /* ignore */ }
  if (alive >= CFG.maxWorld) return "Já existe uma Caríbdis ativa no mundo.";
  cur.busy = system.currentTick; write(r);
  const o = { x: cur.x + 0.5, y: cur.y + 0.5, z: cur.z + 0.5 }, k = ctx(player, 1);
  // preparação: o núcleo puxa a água/energia ao redor e sobe uma coluna antes do chefe surgir
  for (let i = 0; i < 4; i++) after(i * 6, () => implode(k, o, { col: i % 2 ? "water" : "foam", tile: T.drop, n: 24, radius: 8, flat: 0.3, life: 0.6, size: 0.18 }));
  after(26, () => { column(k, o, { col: "water", tile: T.bubble, n: 40, h: 14, life: 1.2, r: 2, size: 0.25 }); ringFlat(k, o, { col: "foam", tile: T.ring, n: 30, radius: 6, spd: 9, life: 0.6, size: 0.2 }); });
  try { playSound(player, "conduit.attack", 1, 0.5); } catch { /* ignore */ }
  after(30, () => {
    try { dim.getBlock({ x: cur.x, y: cur.y, z: cur.z })?.setPermutation(BlockPermutation.resolve("minecraft:air")); } catch { /* ignore */ }
    placeArena(dim, "tt_charybdis", { x: cur.x, y: cur.y - 1, z: cur.z }, (res) => {
      const rr = read(), cc = rr.find((x) => x.id === cur.id); if (!cc) return;
      if (!res.ok) { cc.busy = 0; write(rr); try { dim.getBlock({ x: cur.x, y: cur.y, z: cur.z })?.setPermutation(BlockPermutation.resolve(ANCHOR)); } catch { /* ignore */ } if (isValid(player)) say(player, "§c[Caríbdis] Sem espaço seguro para a arena aqui; o núcleo continua carregado."); return; }
      try {
        const e = dim.spawnEntity(BOSS, res.spawn); e.addTag("etheria_core_boss");
        cc.boss = e.id; write(rr);
        const kk = ctx(player, 1); burst(kk, { x: res.spawn.x, y: res.spawn.y + 3, z: res.spawn.z }, { col: "water", tile: T.drop, n: 60, spd: 8, up: 1.5, life: 1, size: 0.22, acc: [0, -10, 0] });
        orbit(kk, () => (isValid(e) ? { x: e.location.x, y: e.location.y + 4, z: e.location.z } : null), { col: "foam", tile: T.bubble, n: 6, r: 5, dur: 40, step: 2, size: 0.3, speed: 1.4 });
        for (const p of dim.getPlayers({ location: res.spawn, maxDistance: 96 })) { say(p, "§b§l⚠ CARÍBDIS DESPERTOU! §r§7A Calamidade dos Mares foi invocada pelo núcleo."); try { p.playSound("mob.elderguardian.curse", { volume: 1, pitch: 0.6 }); } catch { /* ignore */ } }
      } catch { cc.busy = 0; write(rr); if (isValid(player)) say(player, "§c[Caríbdis] A invocação falhou; o núcleo continua carregado."); }
    });
  });
  return null;
}

function coreAt(dim, l) { return read().find((c) => same(c, dim, l)); }
let beat = 0;
function tick() {
  beat++;
  const r = read(); if (!r.length) return;
  let changed = false;
  for (const c of r) {
    if (c.boss) continue;
    let dim; try { dim = world.getDimension(c.d); } catch { continue; }
    let ps = []; try { ps = dim.getPlayers({ location: { x: c.x, y: c.y, z: c.z }, maxDistance: 48 }); } catch { /* ignore */ }
    if (!ps.length) continue;
    // núcleo destruído por explosão/comandos: some do registro (sem devolver)
    let b; try { b = dim.getBlock({ x: c.x, y: c.y, z: c.z }); } catch { continue; }
    if (b && b.typeId !== ANCHOR && !c.busy) { c.dead = true; changed = true; continue; }
    const k = ctx(ps[0], 1), o = { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 }, f = c.e / CFG.need, full = f >= 1;
    const n = Math.max(3, Math.round(24 * f));
    ringFlat(k, { x: o.x, y: c.y + 0.05, z: o.z }, { col: full ? "white" : "water", tile: T.ring, n, radius: 1 + f * 1.5, spd: 0.2, life: 0.9, size: 0.12 });   // anel = carga
    for (let i = 0; i < (full ? 6 : 2); i++) mote(k, { x: o.x + (Math.random() - 0.5) * 2, y: o.y, z: o.z + (Math.random() - 0.5) * 2 }, { col: "foam", tile: T.bubble, size: 0.12, spd: 1 + f, dir: [0, 1, 0], life: 1 });
    if (full && beat % 2 === 0) column(k, o, { col: "water", tile: T.spark, n: 10, h: 6, life: 0.8, r: 0.6, size: 0.12 });
  }
  if (changed) write(r.filter((c) => !c.dead));
}

export function startCharybdis() {
  world.afterEvents.entityDie.subscribe(onDie);
  system.runInterval(tick, 20);
  world.afterEvents.itemUse.subscribe((ev) => {
    const p = ev.source, it = ev.itemStack; if (it?.typeId !== CORE_ID) return;
    let hit; try { hit = p.getBlockFromViewDirection({ maxDistance: 6 }); } catch { /* ignore */ }
    if (!hit?.block) return say(p, "§7Mire um bloco para instalar o Núcleo de Caríbdis.");
    const err = installCore(p, hit.block);
    if (err) return say(p, "§c[Caríbdis] " + err);
    try { const inv = p.getComponent("minecraft:inventory").container, s = inv.getItem(p.selectedSlotIndex); if (s?.typeId === CORE_ID) { if (s.amount > 1) { s.amount--; inv.setItem(p.selectedSlotIndex, s); } else inv.setItem(p.selectedSlotIndex, undefined); } } catch { /* ignore */ }
  });
  try {
    world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
      const b = ev.block; if (b?.typeId !== ANCHOR) return;
      const c = coreAt(b.dimension, b.location); if (!c) return;
      ev.cancel = true; const p = ev.player;
      system.run(() => {
        if (c.e < CFG.need) { say(p, `§b[Núcleo de Caríbdis] §7Carga: §f${c.e}/${CFG.need}§7. Derrote criaturas a até ${CFG.radius} blocos.`); return; }
        const err = trySummon(p, c); if (err) say(p, "§c[Caríbdis] " + err);
      });
    });
  } catch { /* versão sem o evento */ }
  try {
    world.beforeEvents.playerBreakBlock.subscribe((ev) => {
      const b = ev.block; if (b?.typeId !== ANCHOR) return;
      const c = coreAt(b.dimension, b.location); if (!c) return;
      ev.cancel = true; const p = ev.player, l = { ...b.location }, dim = b.dimension;
      system.run(() => {   // remove sem soltar o conduíte e devolve o núcleo (a carga se perde)
        if (c.busy) return;
        try { dim.getBlock(l)?.setPermutation(BlockPermutation.resolve("minecraft:air")); } catch { /* ignore */ }
        write(read().filter((x) => x.id !== c.id));
        try { dim.spawnItem(new ItemStack(CORE_ID, 1), { x: l.x + 0.5, y: l.y + 0.5, z: l.z + 0.5 }); } catch { /* ignore */ }
        say(p, "§7[Caríbdis] Núcleo recolhido (a carga acumulada se perdeu).");
      });
    });
  } catch { /* versão sem o evento */ }
}
/** admin: !nucleo -> recebe um Núcleo de Caríbdis (testes) */
export function coreCmd(p) {
  if (!p.hasTag(ADMIN_TAG)) return say(p, "§cApenas administradores.");
  try { p.getComponent("minecraft:inventory").container.addItem(new ItemStack(CORE_ID, 1)); say(p, "§b[Caríbdis] §7Núcleo entregue."); } catch { say(p, "§cFalha ao entregar o núcleo."); }
}

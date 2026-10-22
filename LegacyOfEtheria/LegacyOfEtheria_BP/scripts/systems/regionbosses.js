// systems/regionbosses.js - 8.7 (Etapa 7a): mecânicas próprias dos chefes por região que o motor de batalha (bossfight.js) não cobre.
//  • Anjo Guardião: guarda um posto (volta se for levado a mais de 48 blocos), chama anjos guardiões e fica INVULNERÁVEL enquanto eles
//    viverem; sem eles, ergue o Domo de Proteção (absorção + resistência por 15 s, recarga 20 s).
//  • Rei Goblin: nasce com escolta (goblins + Capitães Goblin) que o segue; enquanto ela estiver perto ele recebe menos dano.
// Leve: 1 laço a cada 20 ticks, só entidades a até 96 blocos de algum jogador; nada roda sem jogador por perto.
import { world, system } from "@minecraft/server";
import { GUARDIAN, ESCORT } from "../data/regionbosses.js";
import { isValid, say, dist, rand } from "../core/utils.js";
import { ctx, ringFlat, column, burst, T } from "./fxlib.js";

const GA = "etheria:angel_guardian", GK = "etheria:boss_goblin_king";
const MIN_TAG = "etheria_guard_minion", ESC_TAG = "etheria_escort";
const gst = new Map();    // guardião id -> { home, domeAt, nextSummon, warned }
const kst = new Map();    // rei id -> { warned }
let tick = 0;

const eff = (e, id, ticks, amp) => { try { e.addEffect(id, ticks, { amplifier: amp, showParticles: false }); } catch { /* ignore */ } };
const players = (e, r) => { try { return e.dimension.getPlayers({ location: e.location, maxDistance: r }).filter((p) => { const g = p.getGameMode?.(); return g !== "creative" && g !== "spectator"; }); } catch { return []; } };
const around = (e, r, opt) => { try { return e.dimension.getEntities({ location: e.location, maxDistance: r, ...opt }).filter(isValid); } catch { return []; } };
const tell = (e, r, msg) => { for (const p of players(e, r)) say(p, msg); };

function homeOf(e) {
  let h = gst.get(e.id)?.home;
  if (h) return h;
  try { const s = e.getDynamicProperty("etheria:home"); if (typeof s === "string") h = JSON.parse(s); } catch { /* ignore */ }
  if (!h) { h = { x: e.location.x, y: e.location.y, z: e.location.z }; try { e.setDynamicProperty("etheria:home", JSON.stringify(h)); } catch { /* ignore */ } }
  return h;
}

/** Anjo Guardião: um passo do laço (20 ticks) */
function guardianStep(e) {
  let s = gst.get(e.id); if (!s) { s = { home: homeOf(e), domeAt: -9999, nextSummon: 0, warned: false }; gst.set(e.id, s); }
  const ps = players(e, GUARDIAN.aggro + 16); if (!ps.length) return;
  const c = ctx(ps[0], 1, e.dimension);
  // posto: não se afasta mais de 48 blocos
  if (dist(e.location, s.home) > GUARDIAN.leash) {
    try { burst(c, e.location, { col: "gold", n: 10, up: 1 }); e.teleport({ x: s.home.x, y: s.home.y + 0.5, z: s.home.z }); column(c, s.home, { col: "gold", n: 10, h: 4 }); } catch { /* ignore */ }
  }
  const mins = around(e, 40, { tags: [MIN_TAG] });
  // invoca os anjos guardiões quando alguém se aproxima (e de novo a cada 45 s se todos caírem)
  if (!mins.length && tick >= s.nextSummon && ps.some((p) => dist(p.location, e.location) < GUARDIAN.aggro)) {
    s.nextSummon = tick + GUARDIAN.resummon;
    for (let i = 0; i < GUARDIAN.minionCap; i++) {
      const a = (i / GUARDIAN.minionCap) * Math.PI * 2, at = { x: e.location.x + Math.cos(a) * 3, y: e.location.y + 0.5, z: e.location.z + Math.sin(a) * 3 };
      try { const m = e.dimension.spawnEntity(GUARDIAN.minions[i % GUARDIAN.minions.length], at); m.addTag(MIN_TAG); m.nameTag = "§eAnjo da Guarda"; column(c, at, { col: "gold", n: 8, h: 3 }); } catch { /* ignore */ }
    }
    tell(e, 48, "§e§lO Anjo Guardião chama a guarda celeste! §r§7Derrube os anjos para quebrar a proteção.");
    s.warned = true;
    return;
  }
  if (mins.length) {   // protegido pelos guardiões: dano anulado
    eff(e, "resistance", 30, 4);
    try { ringFlat(c, e.location, { col: "gold", n: 10, radius: 1.6, life: 0.8, tile: T.ring }); } catch { /* ignore */ }
    return;
  }
  if (s.warned) { s.warned = false; tell(e, 48, "§6O escudo da guarda se partiu: o Anjo Guardião está vulnerável!"); }
  // Domo de Proteção: 15 s ativo, recarga 20 s
  const since = tick - s.domeAt;
  if (since >= (GUARDIAN.domeSec + GUARDIAN.domeCd) * 20) {
    s.domeAt = tick; eff(e, "absorption", GUARDIAN.domeSec * 20, 4); eff(e, "resistance", GUARDIAN.domeSec * 20, 1);
    tell(e, 40, "§e✦ Domo de Proteção §7(15 s)");
  }
  if (tick - s.domeAt < GUARDIAN.domeSec * 20) { try { ringFlat(c, { x: e.location.x, y: e.location.y + 1, z: e.location.z }, { col: "gold", n: 16, radius: 2.6, life: 1, tile: T.ring }); } catch { /* ignore */ } }
}

/** Rei Goblin: escolta ao nascer */
function spawnEscort(k) {
  const types = [...Array(ESCORT.goblins).fill("etheria:goblin"), ...Array(ESCORT.captains).fill("etheria:hobgoblin")];
  types.forEach((t, i) => {
    const a = (i / types.length) * Math.PI * 2, at = { x: k.location.x + Math.cos(a) * 2.5, y: k.location.y + 0.3, z: k.location.z + Math.sin(a) * 2.5 };
    try {
      const m = k.dimension.spawnEntity(t, at); m.addTag(ESC_TAG); m.setDynamicProperty?.("etheria:king", k.id);
      if (t === "etheria:hobgoblin") { m.nameTag = ESCORT.captainName; eff(m, "strength", 20 * 600, 1); eff(m, "resistance", 20 * 600, 0); eff(m, "health_boost", 20 * 600, 4); }
    } catch { /* ignore */ }
  });
}
function kingStep(k) {
  let s = kst.get(k.id); if (!s) { s = { warned: false }; kst.set(k.id, s); }
  if (!players(k, 64).length) return;
  const esc = around(k, 40, { tags: [ESC_TAG] });
  for (const m of esc) {   // a escolta segue o rei
    try { if (dist(m.location, k.location) > ESCORT.follow) m.teleport({ x: k.location.x + rand(-2, 2), y: k.location.y + 0.3, z: k.location.z + rand(-2, 2) }); } catch { /* ignore */ }
  }
  const close = esc.filter((m) => dist(m.location, k.location) < ESCORT.range).length;
  if (close) { eff(k, "resistance", 30, close >= 3 ? 2 : 1); if (!s.warned) { s.warned = true; tell(k, 48, "§a§lA escolta protege o Rei Goblin! §r§7Derrube os goblins para feri-lo de verdade."); } }
  else if (s.warned) { s.warned = false; tell(k, 48, "§2A escolta caiu: o Rei Goblin está exposto!"); }
}

/** invocações órfãs (o chefe sumiu/morreu): soltam a tag e o nome para o limitador de mobs cuidar delas */
function orphans(dim, ps) {
  for (const [tag, type] of [[MIN_TAG, GA], [ESC_TAG, GK]]) {
    for (const p of ps) {
      let list = []; try { list = dim.getEntities({ location: p.location, maxDistance: 96, tags: [tag] }); } catch { continue; }
      for (const m of list) {
        let boss = []; try { boss = dim.getEntities({ location: m.location, maxDistance: 56, type }); } catch { /* ignore */ }
        if (!boss.length) { try { m.removeTag(tag); m.nameTag = ""; } catch { /* ignore */ } }
      }
    }
  }
}

export function startRegionBosses() {
  try {
    world.afterEvents.entitySpawn.subscribe((ev) => {
      const e = ev.entity; let t; try { t = e.typeId; } catch { return; }
      if (t === GK) system.runTimeout(() => { if (isValid(e)) spawnEscort(e); }, 10);
      else if (t === GA) system.runTimeout(() => { if (isValid(e)) homeOf(e); }, 2);
    });
    world.afterEvents.entityDie.subscribe((ev) => { try { const id = ev.deadEntity.id; gst.delete(id); kst.delete(id); } catch { /* ignore */ } });
  } catch (e) { console.warn(`[Etheria] chefes por região: ${e}`); }
  system.runInterval(() => {
    tick += 20;
    const by = new Map();
    for (const p of world.getAllPlayers()) { const id = p.dimension.id; if (!by.has(id)) by.set(id, { dim: p.dimension, ps: [] }); by.get(id).ps.push(p); }
    for (const { dim, ps } of by.values()) {
      const seen = new Set();
      for (const p of ps) {
        let list = []; try { list = dim.getEntities({ location: p.location, maxDistance: 96, families: ["etheria_boss"] }); } catch { continue; }
        for (const e of list) {
          if (seen.has(e.id) || !isValid(e)) continue; seen.add(e.id);
          try { if (e.typeId === GA) guardianStep(e); else if (e.typeId === GK) kingStep(e); } catch (err) { console.warn(`[Etheria] chefe ${e.typeId}: ${err}`); }
        }
      }
      if (tick % 400 === 0) orphans(dim, ps);
    }
  }, 20);
}

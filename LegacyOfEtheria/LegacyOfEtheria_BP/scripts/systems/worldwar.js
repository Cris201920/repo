// systems/worldwar.js - EVENTOS DE GUERRA do mundo vivo: invasões que atacam uma nação enquanto há jogadores por perto.
// Ondas de criaturas nascem fora da muralha, avançam sobre o centro; os guardas da nação lutam junto com os jogadores.
// Ao vencer: XP, moedas e reputação para quem participou, contagem de defesas (missões "defesa") e mudança de relações. Dados em WAR_EVENTS.
import { world, system } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { say, toast, playSound, randInt } from "../core/utils.js";
import { SOUNDS, ADMIN_TAG } from "../config.js";
import { addXp } from "./level.js";
import { addFactionRep, relation, wd, changeRelation } from "./factions.js";
import { onWorldEvent } from "./quests.js";
import { tempestInfo } from "./tempest.js";
import { settlementInfo } from "./settlements.js";

export const WAR_EVENTS = {
  orc_raid: { id: "orc_raid", name: "Invasão da Horda Orc", place: "tempest", faction: "tempest", foe: "orc", need: -2,
    waves: [[["etheria:orc", 4], ["etheria:goblin", 4]], [["etheria:orc", 5], ["etheria:hobgoblin", 3]], [["etheria:orc", 5], ["etheria:hobgoblin", 3]]],
    xp: 350, coins: 220, rep: 60, spillover: [["dwarf", 15]], dipl: [], start: "A Horda orc cerca Tempest!", win: "A invasão foi repelida! Tempest está a salvo." },
  mine_breach: { id: "mine_breach", name: "Brecha nas Minas de Dwargon", place: "dwargon", faction: "dwarf", foe: "monster", need: -99,
    waves: [[["etheria:dungeon_crawler", 4]], [["etheria:skeleton_knight", 4], ["etheria:dungeon_crawler", 2]], [["etheria:drake_whelp", 3], ["etheria:skeleton_knight", 3]]],
    xp: 450, coins: 300, rep: 70, spillover: [["tempest", 15]], dipl: [["tempest", "dwarf", 1]], start: "Criaturas romperam as minas de Dwargon!", win: "A brecha foi selada! Os anões agradecem." },
};
const COOLDOWN_MS = 25 * 60 * 1000, RAID_TICKS = 7200, SCAN = 600;
let ACTIVE = null;       // {ev, c:{x,y,z}, wave, nextWave, spawned, startTick, parts:Set, announced}

const ow = () => world.getDimension("minecraft:overworld");
const lastEnd = () => { const v = world.getDynamicProperty("etheria:warcd"); return typeof v === "number" ? v : 0; };

function centerOf(place) {
  if (place === "tempest") { const t = tempestInfo(); return t && t.done >= Math.ceil(t.total * 0.5) ? { x: t.x, y: t.y + 1, z: t.z } : null; }
  const s = settlementInfo(place); return s?.built ? { x: s.x, y: s.y + 1, z: s.z } : null;
}
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
function near(c, max) { return world.getAllPlayers().filter((p) => p.dimension.id === "minecraft:overworld" && dist2(p.location, c) < max * max); }
function broadcast(c, text, max = 140) { for (const p of near(c, max)) say(p, text); }

function ground(dim, x, z, c) {
  try { const b = dim.getTopmostBlock({ x, z }); if (b && !b.typeId.includes("water") && !b.typeId.includes("lava")) return b.location.y + 1; } catch { /* ignore */ }
  return c.y;
}
function spawnWave(w) {
  const dim = ow(), c = ACTIVE.c, side = Math.random() * Math.PI * 2;
  let n = 0;
  for (const [type, count] of ACTIVE.ev.waves[w]) for (let i = 0; i < count; i++) {
    const a = side + (i * 0.35), r = 30 + Math.random() * 6, x = Math.round(c.x + Math.cos(a) * r), z = Math.round(c.z + Math.sin(a) * r);
    try { const e = dim.spawnEntity(type, { x: x + 0.5, y: ground(dim, x, z, c), z: z + 0.5 }); e.addTag("war_raid"); n++; } catch { /* ignore */ }
  }
  ACTIVE.spawned += n;
  broadcast(c, `§c§l[Guerra] §r§f${w === 0 ? ACTIVE.ev.start : `Nova onda de inimigos (${w + 1}/${ACTIVE.ev.waves.length})!`}`);
  for (const p of near(c, 100)) { playSound(p, SOUNDS.boss, 1, 0.5); toast(p, "§c§l" + ACTIVE.ev.name, `§7onda ${w + 1}/${ACTIVE.ev.waves.length}`); }
}
function raiders() { try { return ow().getEntities({ tags: ["war_raid"], location: ACTIVE.c, maxDistance: 160 }); } catch { return []; } }

function startEvent(ev, c) {
  ACTIVE = { ev, c, wave: 0, nextWave: 0, spawned: 0, startTick: system.currentTick, parts: new Set() };
  spawnWave(0);
}
function finish(win) {
  const A = ACTIVE; ACTIVE = null;
  try { world.setDynamicProperty("etheria:warcd", Date.now() + COOLDOWN_MS); } catch { /* ignore */ }
  for (const e of (() => { try { return ow().getEntities({ tags: ["war_raid"], location: A.c, maxDistance: 200 }); } catch { return []; } })()) { try { e.remove(); } catch { /* ignore */ } }
  const pl = world.getAllPlayers().filter((p) => A.parts.has(p.id));
  if (!win) { for (const p of near(A.c, 140)) say(p, `§6[Guerra] §7${A.ev.name}: os invasores recuaram com a chegada da noite, mas os danos ficaram. A cidade conta com você na próxima.`); return; }
  for (const p of pl) {
    try {
      const d = getData(p); d.coins += A.ev.coins + d.level * 10; markDirty(p);
      addXp(p, A.ev.xp + d.level * 25);
      addFactionRep(p, A.ev.faction, A.ev.rep, "defesa", true);
      for (const [f, n] of A.ev.spillover ?? []) addFactionRep(p, f, n, "", false);
      wd(d).defends = (wd(d).defends ?? 0) + 1; markDirty(p);
      onWorldEvent(p, "defense");
      say(p, `§a§l[Vitória] §r§f${A.ev.win} §7+${A.ev.xp + d.level * 25} XP, +${A.ev.coins + d.level * 10} moedas`);
      playSound(p, SOUNDS.levelup, 1, 0.8);
    } catch { /* ignore */ }
  }
  for (const [a, b, dv] of A.ev.dipl ?? []) changeRelation(a, b, dv, pl[0]);
}

function tickWar() {
  if (!ACTIVE) return;
  const A = ACTIVE, now = system.currentTick;
  for (const p of near(A.c, 70)) A.parts.add(p.id);
  if (near(A.c, 160).length === 0) return finish(false);
  const r = raiders();
  if (r.length === 0 && A.wave + 1 >= A.ev.waves.length) return finish(A.parts.size > 0);
  if (r.length <= 2 && A.wave + 1 < A.ev.waves.length && now >= A.nextWave) { A.wave++; A.nextWave = now + 200; spawnWave(A.wave); return; }
  if (now - A.startTick > RAID_TICKS) return finish(A.spawned > 0 && r.length < A.spawned * 0.4);
  for (const e of r) {                 // marcham sobre o centro (impulso curto, só enquanto longe do centro)
    try {
      const dx = A.c.x - e.location.x, dz = A.c.z - e.location.z, l = Math.hypot(dx, dz);
      if (l > 12) e.applyImpulse({ x: dx / l * 0.28, y: 0.08, z: dz / l * 0.28 });
    } catch { /* ignore */ }
  }
}

function scan() {
  if (ACTIVE || world.getAllPlayers().length === 0 || Date.now() < lastEnd()) return;
  if (Math.random() > 0.3) return;
  const cands = Object.values(WAR_EVENTS).filter((ev) => (ev.need <= -99 || relation(ev.faction, ev.foe) <= ev.need) && centerOf(ev.place));
  if (!cands.length) return;
  const ev = cands[randInt(0, cands.length - 1)], c = centerOf(ev.place);
  if (near(c, 60).length === 0) return;
  startEvent(ev, c);
}

export function startWorldWar() { system.runInterval(tickWar, 20); system.runInterval(scan, SCAN); }

// !guerra [lista | iniciar <id> | parar]
export function warCmd(p, args) {
  const a = (args[0] ?? "").toLowerCase();
  if (!a || a === "lista") return say(p, `§6[Guerra] §7Eventos: ${Object.values(WAR_EVENTS).map((e) => `§f${e.id}§7 (${e.name})`).join(", ")}. ${ACTIVE ? `Em andamento: §c${ACTIVE.ev.name}§7.` : "Nenhum em andamento."} Eles ocorrem sozinhos quando você está perto de uma nação ameaçada.`);
  if (!p.hasTag(ADMIN_TAG)) return say(p, "§cSem permissão.");
  if (a === "parar") { if (ACTIVE) finish(false); return say(p, "§aEvento encerrado."); }
  if (a === "iniciar") {
    const ev = WAR_EVENTS[args[1]]; if (!ev) return say(p, "§7Ids: " + Object.keys(WAR_EVENTS).join(", "));
    if (ACTIVE) return say(p, "§cJá existe um evento em andamento.");
    const c = centerOf(ev.place); if (!c) return say(p, "§cO território ainda não foi construído.");
    if (near(c, 140).length === 0) return say(p, "§cVá até o território primeiro."); startEvent(ev, c); return say(p, "§aEvento iniciado.");
  }
}

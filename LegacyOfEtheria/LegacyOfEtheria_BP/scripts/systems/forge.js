// systems/forge.js - Forja Mágica / Demoníaca / Divina: fabricação, evolução de equipamento e reparo, com receitas liberadas por progressão
// e integradas ao Grande Sábio (análise de materiais, mensagens de fabricação, receitas armazenadas no Sábio).
import { world, system } from "@minecraft/server";
import { ITEMS } from "../data/items.gen.js";
import { FORGE, STATIONS, REPAIR_MAT, SET_DEFS, PASSIVES } from "../data/armor.gen.js";
import { RARITY } from "../config.js";
import { getData, markDirty, saveNow } from "../core/db.js";
import { countItem, removeItem, giveItem, inventory, say, fmt } from "../core/utils.js";
import { menu } from "./ui/forms.js";
import { sageStage } from "./voice.js";
import { stageName, learn, remember } from "./sageknow.js";
import { emit, EV } from "../core/bus.js";

const VAN = { "minecraft:iron_ingot": "Lingote de Ferro" };
export const nameOfId = (id) => ITEMS[id]?.name ?? VAN[id] ?? id.split(":").pop().replace(/_/g, " ");
const iconOf = (id) => (id.startsWith("etheria:") ? `textures/items/etheria_${id.slice(8)}` : undefined);
const rcol = (id) => RARITY[ITEMS[id]?.rarity]?.color ?? "§f";
const rname = (id) => RARITY[ITEMS[id]?.rarity]?.name ?? "";
const SAGE_COL = ["§b", "§b", "§6", "§d", "§e"];
const sageHead = (p) => { const s = sageStage(getData(p)); return `${SAGE_COL[s] ?? "§b"}[${stageName(s)}]§r`; };

// ------------------------------------------------------------------ desbloqueio por progressão
export function lockReason(p, r) {
  const d = getData(p), u = r.unlock ?? {};
  if (u.lvl && d.level < u.lvl) return `Nível ${u.lvl} necessário`;
  if (u.boss && Object.values(d.bossKills ?? {}).filter((n) => n > 0).length < u.boss) return `Derrote ${u.boss} chefe(s) diferente(s)`;
  if (u.stage && sageStage(d) < u.stage) return `Requer ${stageName(u.stage)}`;
  return null;
}
const store = (p) => { const d = getData(p); d.forge ??= { known: {}, made: 0 }; return d.forge; };
export const isKnown = (p, r) => !!store(p).known[r.id];
function learnRecipe(p, r, how) {
  const f = store(p); if (f.known[r.id]) return false;
  f.known[r.id] = 1; markDirty(p);
  learn(p, "items", r.result, nameOfId(r.result), {}, true);
  remember(p, "know", `Receita registrada: ${nameOfId(r.result)} (${how})`);
  return true;
}
const has = (p, mats) => mats.every(([id, q]) => countItem(p, id) >= q);
const missing = (p, mats) => mats.filter(([id, q]) => countItem(p, id) < q);

/** Receitas que produzem ou usam o item — usado pela Análise do Grande Sábio. */
export function recipesFor(typeId) { return FORGE.filter((r) => r.result === typeId || r.mats.some(([m]) => m === typeId)); }
export function recipeLines(p, typeId) {
  const out = [];
  for (const r of recipesFor(typeId).slice(0, 5)) {
    const lock = lockReason(p, r);
    out.push(`${r.result === typeId ? "Fabrica-se" : "Usado para fazer"}: ${nameOfId(r.result)} §8(${STATIONS[r.station]}${lock ? ", " + lock : ""})`);
    if (!lock) learnRecipe(p, r, "Análise do Sábio");
  }
  return out;
}

// ------------------------------------------------------------------ equipamento
function statLine(id) {
  const inf = ITEMS[id]; if (!inf) return "";
  const parts = Object.entries(inf.stats ?? {}).map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`);
  return parts.join("§8, §7");
}
function setInfo(id) {
  const inf = ITEMS[id]; if (!inf?.set) return "";
  const def = SET_DEFS[inf.set]; if (!def) return "";
  return `§dConjunto: §f${def.name}\n` + [2, 3, 4].map((n) => `§7(${n}) ${def.b[n].text}`).join("\n") + (def.ptext ? `\n§6Passiva (4): §f${def.ptext}` : "");
}

// ------------------------------------------------------------------ interface
export function openForge(p, station) {
  const title = `§l${STATIONS[station]}`;
  const d = getData(p), sg = `${sageHead(p)} `;
  const mine = FORGE.filter((r) => r.station === station);
  const rdy = mine.filter((r) => !lockReason(p, r) && has(p, r.mats)).length;
  menu(p, title, `§7Estação de fabricação. Receitas: §f${mine.length}§7 • Prontas para fabricar: §a${rdy}\n§8${sg}${rdy ? "Materiais suficientes para fabricação." : "Selecione uma receita para analisar a estrutura."}`, [
    { text: "§l§2Fabricar\n§r§8Armaduras, lingotes e peças", icon: "textures/items/etheria_" + (station === "magic_forge" ? "dragotite_ingot" : station === "demon_forge" ? "dragotite_abyss_ingot" : "dragotite_star_ingot"), run: () => list(p, station, "craft") },
    { text: "§l§5Evoluir equipamento\n§r§8Aprimore uma peça existente", icon: "textures/items/etheria_evolution_core", run: () => list(p, station, "upgrade") },
    { text: "§l§6Reparar\n§r§8Restaura a durabilidade", icon: "textures/items/etheria_arcane_ingot", run: () => repairMenu(p, station) },
    { text: "§l§7Fechar", run: () => {} },
  ]);
}

function list(p, station, kind) {
  const mine = FORGE.filter((r) => r.station === station && r.kind === kind);
  if (!mine.length) return menu(p, `§l${STATIONS[station]}`, "§7Nenhuma receita desta categoria nesta estação.", [{ text: "§lVoltar", run: () => openForge(p, station) }]);
  const state = (r) => lockReason(p, r) ? 2 : has(p, r.mats) ? 0 : 1;
  const sorted = [...mine].sort((a, b) => state(a) - state(b) || (ITEMS[a.result]?.name ?? "").localeCompare(ITEMS[b.result]?.name ?? ""));
  const btn = sorted.map((r) => {
    const st = state(r), tag = st === 0 ? "§a[PRONTA]" : st === 1 ? "§e[FALTAM MATERIAIS]" : "§c[BLOQUEADA]";
    return { text: `${rcol(r.result)}${nameOfId(r.result)}${r.count > 1 ? " §fx" + r.count : ""}\n${tag} §8${st === 2 ? lockReason(p, r) : rname(r.result)}`, icon: iconOf(r.result), run: () => detail(p, station, r) };
  });
  btn.push({ text: "§lVoltar", run: () => openForge(p, station) });
  menu(p, `§l${STATIONS[station]} §8• ${kind === "craft" ? "Fabricar" : "Evoluir"}`, `§7Receitas: §f${mine.length}  §a[PRONTA]§7 tudo em mãos  §e[FALTAM]§7 faltam itens  §c[BLOQUEADA]§7 requisito de progressão.`, btn);
}

function detail(p, station, r) {
  const lock = lockReason(p, r), ok = !lock && has(p, r.mats), miss = missing(p, r.mats), res = r.result;
  if (!lock) learnRecipe(p, r, "Forja");
  const L = [];
  L.push(`${rcol(res)}§l${nameOfId(res)}§r §8• ${rname(res)} • ${STATIONS[station]}`);
  const inf = ITEMS[res];
  if (inf) { L.push(`§7${statLine(res)}`); if (inf.kind === "armor") L.push(`§7Proteção §f${inf.protection} §8• §7Durabilidade §f${inf.durability}`); const si = setInfo(res); if (si) L.push(si); }
  L.push("");
  L.push(`${sageHead(p)} §fAnalisando estrutura da armadura...`);
  if (lock) L.push(`§c🔒 ${lock}.`);
  else if (ok) L.push("§a✔ Materiais suficientes para fabricação.");
  else L.push(`§eMaterial necessário: §f${nameOfId(miss[0][0])}§e.`);
  L.push("", "§7Materiais (necessário • possui • falta):");
  const btn = r.mats.map(([id, q]) => { const n = countItem(p, id), c = n >= q ? "§a" : "§c"; return { text: `${rcol(id)}${nameOfId(id)}\n${c}${q} necessário §8• ${c}${n} possui §8• ${n >= q ? "§aok" : "§cfalta " + (q - n)}`, icon: iconOf(id), run: () => detail(p, station, r) }; });
  btn.push({ text: lock ? "§c§lBloqueada" : ok ? `§a§l${r.kind === "upgrade" ? "Evoluir" : "Fabricar"}${r.count > 1 ? " x" + r.count : ""}` : "§e§lFaltam materiais", icon: iconOf(res), run: () => (lock || !ok ? detail(p, station, r) : craft(p, station, r)) });
  btn.push({ text: "§lVoltar", run: () => list(p, station, r.kind) });
  menu(p, `§l${nameOfId(res)}`, L.join("\n"), btn);
}

export function craft(p, station, r) {
  if (lockReason(p, r) || !has(p, r.mats)) return say(p, `§c${sageHead(p)} Materiais insuficientes.`);
  learnRecipe(p, r, "Forja");
  for (const [id, q] of r.mats) removeItem(p, id, q);
  giveItem(p, r.result, r.count ?? 1);
  const f = store(p); f.made = (f.made ?? 0) + 1; markDirty(p); saveNow(p);
  try { emit(EV.PLAYER_CRAFTS, { player: p, station, recipe: r.id, result: r.result, count: r.count ?? 1, upgrade: r.kind === "upgrade" }); } catch { /* ignore */ }
  try { p.playSound(station === "divine_forge" ? "random.totem" : "random.anvil_use", { volume: 0.8, pitch: 1.1 }); } catch { /* ignore */ }
  say(p, `§a[Forja] §f${nameOfId(r.result)}${r.count > 1 ? " x" + r.count : ""} §afabricado${r.kind === "upgrade" ? " (evolução)" : ""}!`);
  say(p, `${sageHead(p)} §7Estrutura registrada. Receitas conhecidas: §f${Object.keys(store(p).known).length}§7/${FORGE.length}.`);
  try { p.onScreenDisplay.setActionBar(`§6✦ §e${nameOfId(r.result)}`); } catch { /* ignore */ }
  if (ITEMS[r.result]?.kind === "armor") { const sd = SET_DEFS[ITEMS[r.result].set]; if (sd?.ptext) say(p, `§8Passiva do conjunto: ${sd.ptext}`); }
  detail(p, station, r);
}

// ------------------------------------------------------------------ reparo
const REP_N = { common: 2, uncommon: 3, rare: 4, epic: 5, legendary: 6, mythic: 7, divine: 8 };
export function repairCost(inf, frac) {
  const base = REP_N[inf.rarity] ?? 3, out = [[REPAIR_MAT[inf.set] ?? "minecraft:iron_ingot", Math.max(1, Math.ceil(base * frac))]];
  if (["epic", "legendary", "mythic", "divine"].includes(inf.rarity)) out.push(["etheria:mana_crystal", Math.max(1, Math.ceil(base * frac / 2))]);
  if (["legendary", "mythic", "divine"].includes(inf.rarity)) out.push(["etheria:celestial_crystal", 1]);
  return out;
}
function damaged(p) {
  const c = inventory(p), out = []; if (!c) return out;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i); const inf = it && ITEMS[it.typeId]; if (!inf || inf.kind !== "armor") continue;
    let dur; try { dur = it.getComponent("minecraft:durability"); } catch { /* ignore */ }
    if (dur && dur.damage > 0) out.push({ i, it, inf, frac: dur.damage / dur.maxDurability });
  }
  return out;
}
function repairMenu(p, station) {
  const L = damaged(p);
  if (!L.length) return menu(p, `§l${STATIONS[station]} §8• Reparar`, "§7Nenhuma armadura danificada no inventário.", [{ text: "§lVoltar", run: () => openForge(p, station) }]);
  const btn = L.map((x) => { const cost = repairCost(x.inf, x.frac), ok = has(p, cost); return { text: `${rcol(x.it.typeId)}${x.inf.name}\n${ok ? "§a" : "§c"}${cost.map(([id, q]) => q + "x " + nameOfId(id)).join(", ")} §8• dano ${Math.round(x.frac * 100)}%`, icon: iconOf(x.it.typeId), run: () => doRepair(p, station, x.i) }; });
  btn.push({ text: "§lVoltar", run: () => openForge(p, station) });
  menu(p, `§l${STATIONS[station]} §8• Reparar`, "§7Armaduras comuns usam o metal-base; as mágicas exigem cristais de mana; as lendárias, também cristal celestial.", btn);
}
function doRepair(p, station, slot) {
  const c = inventory(p), it = c?.getItem(slot); const inf = it && ITEMS[it.typeId]; if (!inf) return;
  const dur = it.getComponent("minecraft:durability"); if (!dur || dur.damage <= 0) return;
  const cost = repairCost(inf, dur.damage / dur.maxDurability);
  if (!has(p, cost)) return say(p, `§c[Forja] Material necessário: ${nameOfId(missing(p, cost)[0][0])}.`);
  for (const [id, q] of cost) removeItem(p, id, q);
  dur.damage = 0; c.setItem(slot, it);
  try { p.playSound("random.anvil_use", { volume: 0.6, pitch: 1.3 }); } catch { /* ignore */ }
  say(p, `§a[Forja] §f${inf.name} §areparado por completo.`);
  repairMenu(p, station);
}

export function startForge() {
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    const bid = ev.block?.typeId; if (!bid?.startsWith("etheria:")) return;
    const id = bid.slice(8); if (!STATIONS[id]) return;
    if (ev.player.isSneaking) return;   // agachado: permite colocar blocos sobre a forja
    ev.cancel = true;
    const p = ev.player, st = id;
    system.run(() => openForge(p, st));
  });
}

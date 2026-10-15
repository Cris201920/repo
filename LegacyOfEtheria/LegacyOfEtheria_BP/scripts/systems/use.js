// systems/use.js - O que acontece ao usar itens: menu (Relógio), Tomo, consumíveis, sigilos de boss, armas de conjuração/arco
import { world, system, Player } from "@minecraft/server";
import { MENU_ITEM, SOUNDS } from "../config.js";
import { getData, markDirty, saveNow } from "../core/db.js";
import { heal, removeItem, say, playSound } from "../core/utils.js";
import { ITEMS } from "../data/items.gen.js";
import { getStats } from "./stats.js";
import { addXp } from "./level.js";
import { weaponUse, cycleSlot } from "./skills.js";
import { useSigil } from "./bosses.js";
import { nameOf } from "./items.js";
import { fx } from "./fx.js";
import { openMain, openQuickCast, openRacePick } from "./ui/menus.js";

/** Consome 1 unidade do item e aplica seu efeito. Retorna {ok,msg}. */
export function applyConsumable(player, id) {
  const inf = ITEMS[id], d = getData(player), s = getStats(player);
  if (!inf?.use) return { ok: false, msg: "Esse item não pode ser usado." };
  const u = inf.use;
  if (u.hp) { try { const h = player.getComponent("minecraft:health"); if (h.currentValue >= h.effectiveMax && !u.mana && !u.stamina) return { ok: false, msg: "Sua vida já está cheia." }; } catch { /* ignore */ } }
  if (!removeItem(player, id, 1)) return { ok: false, msg: "Você não tem esse item." };
  if (u.hp) { heal(player, u.hp); fx(player.dimension, player.location, "heal", player); }
  if (u.mana) d.mana = Math.min(s.maxMana, d.mana + u.mana);
  if (u.stamina) d.stamina = Math.min(s.maxStamina, d.stamina + u.stamina);
  if (u.skillPoints) d.skillPoints += u.skillPoints;
  if (u.coins) d.coins += u.coins;
  markDirty(player);
  if (u.xp) addXp(player, u.xp);
  playSound(player, SOUNDS.ok, 0.8, 1.2);
  saveNow(player);
  return { ok: true, msg: `Usou ${nameOf(id)}§r.` };
}

const last = new Map();
function onUse(ev) {
  const p = ev.source, item = ev.itemStack;
  if (!(p instanceof Player) || !item) return;
  const now = system.currentTick;
  if (now - (last.get(p.id) ?? -99) < 4) return;
  last.set(p.id, now);
  const id = item.typeId;
  if (id === MENU_ITEM) { system.run(() => (getData(p).raceChosen ? openMain(p) : openRacePick(p))); return; }
  if (id === "etheria:skill_tome") { system.run(() => openQuickCast(p)); return; }
  const inf = ITEMS[id]; if (!inf) return;
  if (inf.kind === "consumable") { const r = applyConsumable(p, id); say(p, `${r.ok ? "§a" : "§c"}${r.msg}`); return; }
  if (inf.kind === "artifact" && inf.use?.boss) {
    const r = useSigil(p, id);
    if (r.ok) removeItem(p, id, 1); else if (r.msg) say(p, `§c${r.msg}`);
    return;
  }
  if (inf.kind === "weapon") {
    if (inf.caster && p.isSneaking) { cycleSlot(p); return; }
    if (inf.caster || inf.ranged) weaponUse(p, inf);
  }
}
export function startUse() { world.afterEvents.itemUse.subscribe(onUse); }

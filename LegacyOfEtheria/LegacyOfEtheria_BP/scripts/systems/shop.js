// systems/shop.js - Comerciante (comprar/vender), Ferreiro (forja) e Treinador
import { ItemStack } from "@minecraft/server";
import { SOUNDS, COMBAT, MAX_LEVEL } from "../config.js";
import { getData, markDirty, saveNow } from "../core/db.js";
import { giveItem, countItem, removeItem, inventory, playSound } from "../core/utils.js";
import { ITEMS } from "../data/items.gen.js";
import { forgeCost, forgeOf, ensureLore, nameOf } from "./items.js";
import { applyDerivedStats } from "./stats.js";
import { addXp } from "./level.js";

export function shopCatalog() {
  return Object.values(ITEMS).filter((i) => i.price > 0 && !i.boss && ["weapon", "armor", "accessory", "consumable", "artifact"].includes(i.kind) && i.rarity !== "divine")
    .sort((a, b) => a.price - b.price);
}
export function buy(player, id, qty = 1) {
  const d = getData(player), inf = ITEMS[id];
  if (!inf || !(inf.price > 0)) return { ok: false, msg: "Item indisponível." };
  const total = inf.price * qty;
  if (d.coins < total) return { ok: false, msg: `Moedas insuficientes (${d.coins}/${total}).` };
  d.coins -= total;
  const c = inventory(player);
  if (c && ["weapon", "armor", "accessory"].includes(inf.kind) && qty === 1) {
    const it = new ItemStack(id, 1); ensureLore(it);
    const left = c.addItem(it); if (left) player.dimension.spawnItem(left, player.location);
  } else giveItem(player, id, qty);
  markDirty(player); saveNow(player); playSound(player, SOUNDS.coins);
  return { ok: true, msg: `Comprou ${qty}x ${nameOf(id)} por ${total} moedas.` };
}
export function sellable(player) {
  const c = inventory(player), out = new Map();
  if (!c) return [];
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i); const inf = it && ITEMS[it.typeId];
    if (inf && inf.sell > 0) out.set(it.typeId, (out.get(it.typeId) ?? 0) + it.amount);
  }
  return [...out.entries()].map(([id, n]) => ({ id, n, inf: ITEMS[id] }));
}
export function sell(player, id, qty) {
  const d = getData(player), inf = ITEMS[id];
  if (!inf || !(inf.sell > 0)) return { ok: false, msg: "Esse item não pode ser vendido." };
  qty = Math.min(qty, countItem(player, id));
  if (qty <= 0 || !removeItem(player, id, qty)) return { ok: false, msg: "Você não tem esse item." };
  const gain = inf.sell * qty; d.coins += gain;
  markDirty(player); saveNow(player); playSound(player, SOUNDS.coins);
  return { ok: true, msg: `Vendeu ${qty}x ${nameOf(id)} por ${gain} moedas.` };
}
export function depositCoinItems(player) {
  const n = countItem(player, "etheria:etheria_coin"); if (n <= 0) return { ok: false, msg: "Você não tem Moedas de Etheria no inventário." };
  removeItem(player, "etheria:etheria_coin", n); getData(player).coins += n; markDirty(player); saveNow(player);
  return { ok: true, msg: `Depositou ${n} moedas.` };
}

// ---- Ferreiro
function held(player) {
  const c = inventory(player); const slot = player.selectedSlotIndex;
  const it = c?.getItem(slot);
  return { c, slot, it, inf: it && ITEMS[it.typeId] };
}
export function forgeInfo(player) {
  const { it, inf } = held(player);
  if (!inf || !["weapon", "armor", "accessory"].includes(inf.kind)) return null;
  const lv = forgeOf(it);
  return { inf, level: lv, cost: forgeCost(inf, lv), maxed: lv >= COMBAT.max_forge };
}
export function forgeUpgrade(player) {
  const d = getData(player), { c, slot, it, inf } = held(player);
  if (!inf || !["weapon", "armor", "accessory"].includes(inf.kind)) return { ok: false, msg: "Segure uma arma, armadura ou acessório Etheria." };
  const lv = forgeOf(it);
  if (lv >= COMBAT.max_forge) return { ok: false, msg: "Esse item já está no máximo (+10)." };
  const cost = forgeCost(inf, lv);
  if (d.coins < cost.coins) return { ok: false, msg: `Moedas insuficientes (${d.coins}/${cost.coins}).` };
  if (countItem(player, "etheria:arcane_ingot") < cost.ingots) return { ok: false, msg: `Requer ${cost.ingots} Barra(s) Arcana(s).` };
  d.coins -= cost.coins; removeItem(player, "etheria:arcane_ingot", cost.ingots);
  const it2 = c.getItem(slot);
  const lore = (it2.getLore() ?? []).filter((l) => !/Forja \+/.test(l)); lore.push(`§8Forja +${lv + 1}`); it2.setLore(lore);
  ensureLore(it2); c.setItem(slot, it2);
  applyDerivedStats(player); markDirty(player); saveNow(player); playSound(player, SOUNDS.forge);
  return { ok: true, msg: `${nameOf(inf.id)} §rforjado para +${lv + 1}!` };
}
export function refreshHeldLore(player) {
  const { c, slot, it, inf } = held(player);
  if (!inf) return { ok: false, msg: "Segure um item Etheria." };
  if (ensureLore(it)) c.setItem(slot, it);
  return { ok: true, msg: "Tooltip atualizado." };
}

// ---- Treinador
export function resetCost(d) { return d.level * 50; }
export function resetAttributes(player) {
  const d = getData(player), cost = resetCost(d);
  if (d.coins < cost) return { ok: false, msg: `Requer ${cost} moedas.` };
  let refunded = 0;
  for (const k of Object.keys(d.attributes)) { refunded += d.attributes[k] - 5; d.attributes[k] = 5; }
  d.coins -= cost; d.attributePoints += refunded;
  applyDerivedStats(player); markDirty(player); saveNow(player);
  return { ok: true, msg: `Atributos redistribuídos! +${refunded} pontos.` };
}
export function trainXp(player) {
  const d = getData(player); const cost = d.level * 30;
  if (d.level >= MAX_LEVEL) return { ok: false, msg: "Você já está no nível máximo." };
  if (d.coins < cost) return { ok: false, msg: `Requer ${cost} moedas.` };
  const gain = d.level * 20;
  d.coins -= cost; addXp(player, gain);
  markDirty(player); saveNow(player);
  return { ok: true, msg: `Treino concluído! +${gain} XP.` };
}
export { ItemStack };

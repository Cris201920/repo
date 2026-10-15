// systems/npcs.js - NPCs funcionais (Mestre de Classe, Comerciante, Ferreiro, Treinador, Guilda, Viajante de Missões)
import { originInteract } from "./origin.js";
import { world, system, Player } from "@minecraft/server";
import { getData } from "../core/db.js";
import { say, fmt } from "../core/utils.js";
import { ITEMS } from "../data/items.gen.js";
import { RARITY } from "../config.js";
import { menu } from "./ui/forms.js";
import { openSkills, openEquip, openClass, openRace, openRacePick, openGuild, openQuestBoard } from "./ui/menus.js";
import { onTalk, deliverAt } from "./quests.js";
import { shopCatalog, buy, sellable, sell, depositCoinItems, forgeInfo, forgeUpgrade, refreshHeldLore, resetAttributes, resetCost, trainXp } from "./shop.js";
import { nameOf, fmtStat, scaled } from "./items.js";
import { fx } from "./fx.js";
import { chronoaLine } from "./chronoa.js";
import { summonRoaming } from "./bossspawn.js";
import { WORLD_NPCS } from "../data/worldnpcs.gen.js";
import { openWorldNpc } from "./worldnpc.js";

const ROLES = { "etheria:npc_master": "master", "etheria:npc_merchant": "merchant", "etheria:npc_smith": "smith", "etheria:npc_trainer": "trainer", "etheria:npc_guild": "guild", "etheria:npc_quest": "quest", "etheria:npc_chronoa": "chronoa" };
const NAMES = { master: "Mestre de Classe", merchant: "Comerciante", smith: "Ferreiro", trainer: "Treinador", guild: "Recepcionista da Guilda", quest: "Viajante de Missões", chronoa: "Chronoa" };
for (const [k, v] of Object.entries(WORLD_NPCS)) { ROLES["etheria:npc_" + k] = k; NAMES[k] = v.name; }
const msg = (p, r) => say(p, `${r.ok ? "§a" : "§c"}${r.msg}`);

export function openNpc(player, role) {
  const d = getData(player);
  onTalk(player, role);
  for (const m of deliverAt(player, role)) say(player, `§a${m}`);
  const head = `§7${NAMES[role]} §8| §6${fmt(d.coins)} moedas`;
  if (WORLD_NPCS[role]) return openWorldNpc(player, role);
  switch (role) {
    case "master":
      return menu(player, "§l§dMESTRE DE CLASSE", `${head}\n§f"O poder exige um caminho. Escolha o seu."`, [
        { text: "§lEscolher / trocar classe", icon: "menu_class", run: () => openClass(player) },
        { text: "§lRaça e evolução", icon: "menu_race", run: () => (d.raceChosen ? openRace(player) : openRacePick(player)) },
        { text: "§lHabilidades: aprender e trocar\n§r§7Equipar, guardar e mudar de slot", icon: "menu_skills", run: () => openSkills(player) },
        { text: "Fechar" },
      ]);
    case "merchant": return openMerchant(player);
    case "smith": return openSmith(player);
    case "trainer":
      return menu(player, "§l§cTREINADOR", `${head}\n§f"Força vem do treino!"`, [
        { text: `§lRedistribuir atributos\n§r§7Custa ${resetCost(d)} moedas`, icon: "menu_status", run: () => { msg(player, resetAttributes(player)); } },
        { text: `§lTreino de combate\n§r§7Custa ${d.level * 30} moedas (+${d.level * 20} XP)`, icon: "menu_skills", run: () => { msg(player, trainXp(player)); openNpc(player, "trainer"); } },
        { text: "§lTrocar habilidades equipadas\n§r§7Muda quais habilidades ficam na hotbar", icon: "menu_skills", run: () => openEquip(player) },
        { text: "Fechar" },
      ]);
    case "guild": return openGuild(player);
    case "quest": return openQuestBoard(player, "quest");
    case "chronoa": return openChronoa(player, head);
    default: return WORLD_NPCS[role] ? openWorldNpc(player, role) : undefined;
  }
}

// ---------------------------------------------------------------- Chronoa
function openChronoa(player, head) {
  const d = getData(player), line = chronoaLine(player) || "§d\"O tempo é um rio, viajante. Eu apenas escolho onde ele corre mais depressa.\"";
  menu(player, "§l§5CHRONOA", `${head}\n${line}`, [
    { text: "§lConversar\n§r§7Lições sobre o tempo", icon: "menu_skills", run: () => { say(player, "§5[Chronoa] §7Percepção temporal vence força bruta: quem prevê o golpe, não o sofre. Treine esquivas e reflexos."); openNpc(player, "chronoa"); } },
      { text: "§lBênção do Tempo\n§r§7Custa 400 moedas (Velocidade e Regeneração, 2 min)", icon: "menu_status", run: () => {
        if ((d.coins || 0) < 400) { say(player, "§cMoedas insuficientes."); return; }
        d.coins -= 400;
        try { player.addEffect("speed", 2400, { amplifier: 1, showParticles: false }); player.addEffect("regeneration", 2400, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
        say(player, "§5[Chronoa] §7O tempo corre a seu favor. Por pouco."); } },
    { text: "§lDesafiar Chronoa\n§r§7Invoca a Senhora do Tempo (boss)", icon: "menu_skills", run: () => { if (!summonRoaming(player, "chronoa")) say(player, "§cNão achei um ponto livre; tente em campo aberto."); } },
    { text: "Fechar" },
  ]);
}

// ---------------------------------------------------------------- comerciante
function openMerchant(player) {
  const d = getData(player);
  menu(player, "§l§6COMERCIANTE", `§7Suas moedas: §6${fmt(d.coins)}`, [
    { text: "§lComprar armas", icon: "textures/items/etheria_flame_sword", run: () => openBuy(player, ["weapon"], 0) },
    { text: "§lComprar armaduras", icon: "textures/items/etheria_knight_chest", run: () => openBuy(player, ["armor"], 0) },
    { text: "§lAcessórios e consumíveis", icon: "textures/items/etheria_hp_potion_l", run: () => openBuy(player, ["accessory", "consumable", "artifact"], 0) },
    { text: "§lVender itens", icon: "menu_inventory", run: () => openSell(player) },
    { text: "Depositar Moedas de Etheria", run: () => { msg(player, depositCoinItems(player)); openMerchant(player); } },
    { text: "Fechar" },
  ]);
}
function openBuy(player, kinds, page) {
  const list = shopCatalog().filter((i) => kinds.includes(i.kind)), per = 7, pages = Math.max(1, Math.ceil(list.length / per));
  const b = list.slice(page * per, page * per + per).map((inf) => ({ text: `${nameOf(inf.id)}\n§r§6${fmt(inf.price)} moedas`, icon: "textures/items/" + inf.id.replace("etheria:", "etheria_"), run: () => openBuyDetail(player, inf.id, kinds, page) }));
  if (page > 0) b.push({ text: "« Anterior", run: () => openBuy(player, kinds, page - 1) });
  if (page < pages - 1) b.push({ text: "Próxima »", run: () => openBuy(player, kinds, page + 1) });
  b.push({ text: "§7« Voltar", icon: "back", run: () => openMerchant(player) });
  menu(player, "§l§6COMPRAR", `§7Moedas: §6${fmt(getData(player).coins)}   §8Página ${page + 1}/${pages}`, b);
}
function openBuyDetail(player, id, kinds, page) {
  const inf = ITEMS[id], stats = Object.entries(inf.stats ?? {}).map(([k, v]) => fmtStat(k, v)).join("\n");
  const stackable = inf.kind === "consumable";
  const b = [{ text: `§a§lComprar 1 §r§6(${fmt(inf.price)})`, run: () => { msg(player, buy(player, id, 1)); openBuyDetail(player, id, kinds, page); } }];
  if (stackable) b.push({ text: `Comprar 5 §6(${fmt(inf.price * 5)})`, run: () => { msg(player, buy(player, id, 5)); openBuyDetail(player, id, kinds, page); } });
  b.push({ text: "§7« Voltar", icon: "back", run: () => openBuy(player, kinds, page) });
  menu(player, nameOf(id), `${RARITY[inf.rarity].color}${RARITY[inf.rarity].name}\n\n§a${stats || "§7Sem atributos"}\n${inf.onHit ? `\n§6Habilidade: ${inf.onHit.name}` : ""}\n\n§7Suas moedas: §6${fmt(getData(player).coins)}`, b);
}
function openSell(player) {
  const list = sellable(player);
  const b = list.slice(0, 20).map((e) => ({ text: `${nameOf(e.id)} §7x${e.n}\n§r§6${e.inf.sell} cada`, icon: "textures/items/" + e.id.replace("etheria:", "etheria_"), run: () => openSellDetail(player, e.id) }));
  b.push({ text: "§7« Voltar", icon: "back", run: () => openMerchant(player) });
  menu(player, "§l§6VENDER", list.length ? "§7Toque no item para vender." : "§7Você não tem itens vendáveis.", b);
}
function openSellDetail(player, id) {
  const inf = ITEMS[id], have = sellable(player).find((e) => e.id === id)?.n ?? 0;
  menu(player, nameOf(id), `§7Você tem §f${have}§7. Preço: §6${inf.sell}§7 cada.`, [
    { text: `Vender 1 (§6${inf.sell}§r)`, run: () => { msg(player, sell(player, id, 1)); openSell(player); } },
    { text: `Vender tudo (§6${inf.sell * have}§r)`, run: () => { msg(player, sell(player, id, have)); openSell(player); } },
    { text: "§7« Voltar", icon: "back", run: () => openSell(player) },
  ]);
}

// ---------------------------------------------------------------- ferreiro
function openSmith(player) {
  const d = getData(player), f = forgeInfo(player);
  const body = f ? `§7Item na mão: ${nameOf(f.inf.id)} §8(+${f.level})\n${f.maxed ? "§6Forja máxima!" : `§7Custo: §6${fmt(f.cost.coins)} moedas §7+ §d${f.cost.ingots}x Barra Arcana\n§7Cada nível: +6% nos atributos`}\n\n§7Moedas: §6${fmt(d.coins)}`
    : "§7Segure uma arma, armadura ou acessório Etheria para forjá-lo.";
  menu(player, "§l§6FERREIRO", body, [
    { text: "§l§6Forjar item (+1)", icon: "textures/items/etheria_berserker_axe", run: () => { msg(player, forgeUpgrade(player)); openSmith(player); } },
    { text: "Atualizar tooltip do item", run: () => { msg(player, refreshHeldLore(player)); openSmith(player); } },
    { text: "Fechar" },
  ]);
}

// ---------------------------------------------------------------- eventos
const lastTalk = new Map();
function interact(player, entity) {
  if (originInteract(player, entity)) return;   // NPCs da sala de origem (systems/origin.js)
  const role = ROLES[entity?.typeId]; if (!role) return;
  const now = system.currentTick;
  if (now - (lastTalk.get(player.id) ?? -99) < 10) return;
  lastTalk.set(player.id, now);
  system.run(() => { fx(entity.dimension, { x: entity.location.x, y: entity.location.y + 2.2, z: entity.location.z }, "arcane", player); openNpc(player, role); });
}
export function startNpcs() {
  world.afterEvents.entitySpawn.subscribe((e) => {
    const role = ROLES[e.entity?.typeId];
    if (role) { try { e.entity.nameTag = `§6${NAMES[role]}`; } catch { /* ignore */ } }
  });
  const ev = world.afterEvents.playerInteractWithEntity;
  if (ev?.subscribe) {
    ev.subscribe((e) => interact(e.player, e.target));
  } else {
    // Fallback: o NPC dispara o evento "etheria:interact" (componente minecraft:interact) e usamos o jogador mais próximo.
    world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
      if (e.eventId !== "etheria:interact") return;
      const ent = e.entity; if (!ROLES[ent?.typeId]) return;
      const near = ent.dimension.getPlayers({ location: ent.location, maxDistance: 6, closest: 1 })[0];
      if (near instanceof Player) interact(near, ent);
    });
  }
}
export { NAMES as NPC_NAMES, ROLES as NPC_ROLES };

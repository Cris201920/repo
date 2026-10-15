// systems/worldnpc.js - INTERAÇÃO dos NPCs das nações: diálogo por reputação, missões, aulas com requisitos, lojas por facção, cura, forja anã,
// juramento de aliança, notícias/diplomacia, escolta e a tela "Mundo" (reputação, relações, territórios, história). Tudo com consequência real.
import { system, ItemStack } from "@minecraft/server";
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, fmt, giveItem, countItem, removeItem, inventory, pick, playSound } from "../core/utils.js";
import { menu } from "./ui/forms.js";
import { ITEMS } from "../data/items.gen.js";
import { SKILLS } from "../data/skills.js";
import { RARITY, RARITY_ORDER, SOUNDS } from "../config.js";
import { QUESTS } from "../data/quests.js";
import { LESSONS, DWARF_RECIPES } from "../data/teachers.js";
import { GREET, KIND_LINES, NPC_DEF } from "../data/worldnpcs.js";
import { WORLD_NPCS } from "../data/worldnpcs.gen.js";
import { FACTIONS, FACTION_LIST, PLAYER_FACTIONS, ALLY_AT, TIERS, tierOf, SETTLEMENTS } from "../data/factions.js";
import { repOf, tierFor, isAlly, hasFlag, relation, relationName, priceMult, refused, swearOath, breakOath, oathCheck, wd, addFactionRep, setFlag } from "./factions.js";
import { acceptQuest, abandonQuest, canAccept, describe, isDone, onTalk, deliverAt } from "./quests.js";
import { grantSkill } from "./skills.js";
import { ensureLore, nameOf } from "./items.js";
import { forgeInfo, forgeUpgrade } from "./shop.js";
import { applyDerivedStats, getStats, getHealth } from "./stats.js";
import { tempestInfo } from "./tempest.js";
import { settlementInfo } from "./settlements.js";
import { LOCATION_LIST, travelTo, visitedOf } from "./travel.js";
import { bossTotal, raceDepth } from "../data/lineages.js";

const back = (fn) => ({ text: "§7« Voltar", icon: "back", run: fn });
const msg = (p, r) => say(p, `${r.ok ? "§a" : "§c"}${r.msg}`);
const bar = (v, n = 12) => { const f = Math.max(0, Math.min(n, Math.round(v * n))); return "§a" + "█".repeat(f) + "§8" + "█".repeat(n - f); };
const repBar = (rep) => bar((rep + 1000) / 2000);
const rarIdx = (r) => RARITY_ORDER.indexOf(r);

export const isWorldNpc = (typeId) => !!WORLD_NPCS[typeId?.replace("etheria:npc_", "")];

// ---------------------------------------------------------------- diálogo
function greeting(d, role) {
  const meta = WORLD_NPCS[role], def = NPC_DEF[role] ?? {};
  const t = tierFor(d, meta.faction).id, lines = GREET[meta.faction]?.[t] ?? ["..."];
  const out = [pick(lines)];
  if (!["enemy", "hostile"].includes(t)) {
    out.push(`§7"${pick(KIND_LINES[meta.kind] ?? ["..."])}"`);
    if (def.lines?.length) out.push(pick(def.lines));
    const q = (def.quests ?? []).find((id) => d.quests.active[id]);
    if (q) out.push(`§e(Missão em andamento: ${QUESTS[q].name})`);
  }
  return out.join("\n");
}

export function openWorldNpc(player, role) {
  const d = getData(player), meta = WORLD_NPCS[role]; if (!meta) return;
  const F = FACTIONS[meta.faction], def = NPC_DEF[role] ?? {};
  onTalk(player, role);
  const w = wd(d); if (!w.flags["met_" + meta.faction]) { w.flags["met_" + meta.faction] = 1; markDirty(player); }
  for (const m of deliverAt(player, role)) say(player, `§a${m}`);
  const tier = tierFor(d, meta.faction), rep = repOf(d, meta.faction);
  const head = `${F.color}${meta.name} §8| ${F.color}${F.short}: ${tier.color}${tier.name}${isAlly(d, meta.faction) ? " §b(aliado)" : ""} §8| §6${fmt(d.coins)} moedas`;
  const body = `${head}\n${greeting(d, role)}`;
  if (refused(d, meta.faction)) return menu(player, `${F.color}§l${meta.name}`, `${body}\n\n§cEste NPC se recusa a atendê-lo. Melhore a reputação com ${F.short} (missões, abater inimigos da nação).`, [
    { text: "§lReputação e relações", run: () => openWorld(player) }, { text: "Fechar" }]);
  const b = [];
  if (def.quests?.length) b.push({ text: "§l§eMissões\n§r§7Pedidos desta pessoa", icon: "menu_quests", run: () => openNpcQuests(player, role) });
  if (def.teaches?.length) b.push({ text: "§l§bAprender técnicas\n§r§7Ensina habilidades (com requisitos)", icon: "menu_skills", run: () => openTeacher(player, role) });
  if (def.shop) b.push({ text: "§l§6Loja\n§r§7Itens e preços da nação", icon: "menu_inventory", run: () => openFacShop(player, role, 0) });
  if (def.heal) b.push({ text: `§l§aCuração\n§r§7${healCost(d, meta.faction)} moedas`, icon: "menu_status", run: () => { msg(player, heal(player, meta.faction)); openWorldNpc(player, role); } });
  if (def.cook) b.push({ text: `§l§6Refeição da casa\n§r§7${mealCost(d, meta.faction)} moedas (3 min de bônus)`, icon: "menu_status", run: () => { msg(player, meal(player, meta.faction)); openWorldNpc(player, role); } });
  if (def.forge) b.push({ text: "§l§6Forjar item (+1)\n§r§7Com desconto da reputação", icon: "textures/items/etheria_berserker_axe", run: () => openDwarfForge(player, role) });
  if (def.recipes) b.push({ text: "§l§6Encomendas da Forja Anã\n§r§7Equipamentos raros", icon: "textures/items/etheria_dragotite_sword", run: () => openRecipes(player, role) });
  if (def.oath) b.push({ text: `§l§bAliança com ${F.short}\n§r§7${isAlly(d, meta.faction) ? "Você é aliado" : "Juramento e benefícios"}`, icon: "menu_guild", run: () => openOath(player, role) });
  if (def.escort) b.push({ text: "§l§aChamar escolta\n§r§7Dois guardas o acompanham (aliados)", icon: "menu_class", run: () => { msg(player, callEscort(player, meta.faction)); } });
  if (def.news) b.push({ text: "§l§dNotícias e diplomacia\n§r§7Relações entre as nações", icon: "menu_ranking", run: () => openNews(player, role) });
  b.push({ text: "§l§7Mundo, reputação e história", icon: "menu_race", run: () => openWorld(player) });
  b.push({ text: "Fechar" });
  menu(player, `${F.color}§l${meta.name}`, body, b);
}

// ---------------------------------------------------------------- missões
function openNpcQuests(player, role) {
  const d = getData(player), def = NPC_DEF[role], list = def.quests.map((id) => QUESTS[id]).filter(Boolean);
  const b = list.map((q) => {
    const act = d.quests.active[q.id], why = act ? null : canAccept(d, q), dn = isDone(d, q.id);
    const tag = dn ? "§a[concluída]" : act ? "§e[em andamento]" : why ? `§c${why}` : "§aDisponível";
    return { text: `§l${q.name}\n§r${tag}`, icon: "menu_quests", run: () => openQuestDetail(player, role, q.id) };
  });
  b.push(back(() => openWorldNpc(player, role)));
  menu(player, "§l§eMissões", "§7Escolha uma missão. A recompensa vale XP, moedas, itens e reputação.", b);
}
function openQuestDetail(player, role, id) {
  const d = getData(player), q = QUESTS[id], act = d.quests.active[id], why = act ? null : canAccept(d, q);
  const r = q.reward ?? {};
  const rew = [r.xp ? `${r.xp} XP` : "", r.coins ? `${r.coins} moedas` : "", ...Object.entries(r.frep ?? {}).map(([f, n]) => `${n > 0 ? "+" : ""}${n} rep. ${FACTIONS[f]?.short ?? f}`), ...(r.items ?? []).map(([i, n]) => `${n}x ${nameOf(i)}`)].filter(Boolean).join("§7, §e");
  const body = [`§f${q.desc}`, "", "§e§lObjetivos", ...(act ? describe(player, id) : q.objectives.map((o) => `§7• §f${o.label ?? o.type} §7(${o.n ?? 1})`)), "", `§7Nível mínimo: §f${q.minLevel ?? 1}`, `§7Recompensa: §e${rew}`].join("\n");
  const b = [];
  if (!act && !why && !isDone(d, id)) b.push({ text: "§a§lAceitar missão", icon: "menu_quests", run: () => { msg(player, acceptQuest(player, id)); openNpcQuests(player, role); } });
  if (act) b.push({ text: "§cAbandonar missão", run: () => { abandonQuest(player, id); openNpcQuests(player, role); } });
  if (why && !act) b.push({ text: `§c${why}` });
  b.push(back(() => openNpcQuests(player, role)));
  menu(player, `§e${q.name}`, body, b);
}

// ---------------------------------------------------------------- aulas
export function lessonReqs(player, id) {
  const d = getData(player), L = LESSONS[id], sk = SKILLS[id], out = [];
  const ck = (ok, t) => out.push({ ok, text: `${ok ? "§a[x]" : "§c[ ]"} §f${t}` });
  if (L.lvl) ck(d.level >= L.lvl, `Nível ${L.lvl} (${d.level})`);
  for (const [f, n] of Object.entries(L.rep ?? {})) ck(repOf(d, f) >= n, `Reputação ${FACTIONS[f].short} ${n} (${repOf(d, f)})`);
  if (L.anyAlly) ck(PLAYER_FACTIONS.some((f) => isAlly(d, f)), "Ser aliado de uma nação");
  if (L.quest) ck(d.quests.completed.includes(L.quest), `Missão: ${QUESTS[L.quest]?.name ?? L.quest}`);
  if (L.boss) ck((d.bossKills[L.boss] ?? 0) > 0, `Derrotar: ${L.boss}`);
  if (L.kills) ck(d.kills >= L.kills, `${L.kills} abates (${d.kills})`);
  if (L.flag) ck(hasFlag(d, L.flag), `Desbloqueio do mundo: ${L.flag}`);
  for (const s of L.skills ?? []) ck(d.unlockedSkills.includes(s), `Saber ${SKILLS[s]?.name ?? s}`);
  if (L.item) ck(countItem(player, L.item[0]) >= L.item[1], `${L.item[1]}x ${nameOf(L.item[0])} (${countItem(player, L.item[0])})`);
  if (L.cost) ck(d.coins >= L.cost, `${fmt(L.cost)} moedas`);
  return out;
}
export function learnLesson(player, id, role) {
  const d = getData(player), L = LESSONS[id], sk = SKILLS[id];
  if (!L || !sk) return { ok: false, msg: "Aula inválida." };
  if (d.unlockedSkills.includes(id)) return { ok: false, msg: "Você já sabe esta técnica." };
  const miss = lessonReqs(player, id).filter((r) => !r.ok); if (miss.length) return { ok: false, msg: "Requisitos pendentes." };
  const meta = WORLD_NPCS[role]; d.coins -= Math.round((L.cost ?? 0) * priceMult(d, meta.faction)); if (L.item) removeItem(player, L.item[0], L.item[1]);
  grantSkill(player, id); wd(d).taught = (wd(d).taught ?? 0) + 1; markDirty(player); saveNow(player);
  playSound(player, SOUNDS.learn ?? "random.levelup", 1, 1);
  return { ok: true, msg: `Você aprendeu ${sk.name}!` };
}
function openTeacher(player, role) {
  const d = getData(player), def = NPC_DEF[role], meta = WORLD_NPCS[role];
  const b = def.teaches.map((id) => {
    const sk = SKILLS[id], learned = d.unlockedSkills.includes(id), ready = !learned && lessonReqs(player, id).every((r) => r.ok);
    return { text: `§l${sk.name}\n§r${learned ? "§a[aprendida]" : ready ? "§a★ Pronta para aprender" : "§7ver requisitos"}`, icon: "skill_" + id, run: () => openLesson(player, role, id) };
  });
  b.push(back(() => openWorldNpc(player, role)));
  menu(player, `§b§l${meta.name}`, `§f"Você deseja aprender uma técnica? Prove que está preparado."\n§7Moedas: §6${fmt(d.coins)}`, b);
}
function openLesson(player, role, id) {
  const d = getData(player), L = LESSONS[id], sk = SKILLS[id], meta = WORLD_NPCS[role];
  const reqs = lessonReqs(player, id), ready = reqs.every((r) => r.ok) && !d.unlockedSkills.includes(id);
  const body = [`${RARITY[sk.rarity]?.color ?? "§f"}${RARITY[sk.rarity]?.name ?? ""} §7- ${sk.type === "passive" ? "passiva" : `mana ${sk.mana}, recarga ${sk.cd}s`}`, `§f${sk.desc}`, "",
    "§e§lRequisitos", ...reqs.map((r) => r.text), L.cost ? `§8Preço com a sua reputação: ${Math.round(L.cost * priceMult(d, meta.faction))} moedas` : ""].filter(Boolean).join("\n");
  const b = [];
  if (d.unlockedSkills.includes(id)) b.push({ text: "§a[Já aprendida]" });
  else if (ready) b.push({ text: "§a§lAprender agora", icon: "menu_skills", run: () => { msg(player, learnLesson(player, id, role)); openTeacher(player, role); } });
  b.push(back(() => openTeacher(player, role)));
  menu(player, `§b${sk.name}`, body, b);
}

// ---------------------------------------------------------------- lojas
export function shopList(d, role) {
  const def = NPC_DEF[role].shop, meta = WORLD_NPCS[role], max = rarIdx(def.maxRarity ?? "rare"), rep = repOf(d, meta.faction);
  return Object.values(ITEMS).filter((i) => i.price > 0 && !i.boss && def.kinds.includes(i.kind) && rarIdx(i.rarity) <= max && i.rarity !== "divine")
    .map((i) => ({ i, gate: def.gate?.[i.rarity] ?? 0 })).sort((a, b) => a.i.price - b.i.price).map((x) => ({ ...x, locked: rep < x.gate }));
}
export function buyFrom(player, role, id) {
  const d = getData(player), meta = WORLD_NPCS[role], x = shopList(d, role).find((e) => e.i.id === id);
  if (!x) return { ok: false, msg: "Este NPC não vende isso." };
  if (x.locked) return { ok: false, msg: `Requer reputação ${x.gate} com ${FACTIONS[meta.faction].short}.` };
  const price = Math.max(1, Math.round(x.i.price * priceMult(d, meta.faction)));
  if (d.coins < price) return { ok: false, msg: `Moedas insuficientes (${d.coins}/${price}).` };
  d.coins -= price;
  const c = inventory(player);
  if (c && ["weapon", "armor", "accessory"].includes(x.i.kind)) { const it = new ItemStack(id, 1); ensureLore(it); const left = c.addItem(it); if (left) player.dimension.spawnItem(left, player.location); }
  else giveItem(player, id, 1);
  markDirty(player); saveNow(player); playSound(player, SOUNDS.coins);
  return { ok: true, msg: `Comprou ${nameOf(id)} por ${price} moedas.` };
}
function openFacShop(player, role, page) {
  const d = getData(player), meta = WORLD_NPCS[role], list = shopList(d, role), per = 7, pages = Math.max(1, Math.ceil(list.length / per));
  const b = list.slice(page * per, page * per + per).map((x) => ({ text: `${x.locked ? "§8" : ""}${nameOf(x.i.id)}\n§r${x.locked ? `§c[rep. ${x.gate}]` : `§6${Math.round(x.i.price * priceMult(d, meta.faction))} moedas`}`,
    icon: "textures/items/" + x.i.id.replace("etheria:", "etheria_"), run: () => { msg(player, buyFrom(player, role, x.i.id)); openFacShop(player, role, page); } }));
  if (page > 0) b.push({ text: "« Anterior", run: () => openFacShop(player, role, page - 1) });
  if (page < pages - 1) b.push({ text: "Próxima »", run: () => openFacShop(player, role, page + 1) });
  b.push(back(() => openWorldNpc(player, role)));
  menu(player, `§6§l${meta.name}`, `§7Moedas: §6${fmt(d.coins)}  §8Página ${page + 1}/${pages}\n§7Preço: x${priceMult(d, meta.faction)} (reputação). Itens mais raros exigem reputação.`, b);
}

// ---------------------------------------------------------------- cura e refeição
const healCost = (d, f) => Math.round((40 + d.level * 4) * priceMult(d, f));
const mealCost = (d, f) => Math.round((60 + d.level * 2) * priceMult(d, f));
export function heal(player, f) {
  const d = getData(player), c = healCost(d, f); if (d.coins < c) return { ok: false, msg: `Moedas insuficientes (${c}).` };
  d.coins -= c; try { player.addEffect("instant_health", 2, { amplifier: 4, showParticles: false }); player.addEffect("regeneration", 200, { amplifier: 1, showParticles: false }); } catch { /* ignore */ }
  const s = getStats(player); d.mana = s.maxMana; markDirty(player); playSound(player, SOUNDS.levelup ?? "random.levelup", 0.6, 1.4);
  return { ok: true, msg: "Você foi curado e a mana restaurada." };
}
export function meal(player, f) {
  const d = getData(player), c = mealCost(d, f); if (d.coins < c) return { ok: false, msg: `Moedas insuficientes (${c}).` };
  d.coins -= c; try { player.addEffect("regeneration", 3600, { amplifier: 0, showParticles: false }); player.addEffect("speed", 3600, { amplifier: 0, showParticles: false }); player.addEffect("saturation", 100, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
  markDirty(player); return { ok: true, msg: "Refeição deliciosa! Regeneração e velocidade por 3 minutos." };
}

// ---------------------------------------------------------------- Forja Anã
function openDwarfForge(player, role) {
  const d = getData(player), f = forgeInfo(player), disc = priceMult(d, "dwarf");
  const body = f ? `§7Item: ${nameOf(f.inf.id)} §8(+${f.level})\n${f.maxed ? "§6Forja máxima!" : `§7Custo: §6${Math.round(f.cost.coins * disc)} moedas §7(desc. ${Math.round((1 - disc) * 100)}%) §7+ §d${f.cost.ingots}x Barra Arcana`}` : "§7Segure uma arma, armadura ou acessório Etheria.";
  menu(player, "§6§lForja Anã", body, [
    { text: "§l§6Forjar (+1)", icon: "textures/items/etheria_berserker_axe", run: () => {
      const fi = forgeInfo(player), r = forgeUpgrade(player);
      if (r.ok && fi && disc < 1) { const back2 = Math.floor(fi.cost.coins * (1 - disc)); d.coins += back2; markDirty(player); }
      msg(player, r); openDwarfForge(player, role); } },
    back(() => openWorldNpc(player, role)),
  ]);
}
export function recipeReqs(player, r) {
  const d = getData(player), out = [], ck = (ok, t) => out.push({ ok, text: `${ok ? "§a[x]" : "§c[ ]"} §f${t}` });
  ck(d.level >= r.lvl, `Nível ${r.lvl} (${d.level})`); ck(repOf(d, "dwarf") >= r.rep, `Reputação Anões ${r.rep} (${repOf(d, "dwarf")})`);
  if (r.quest) ck(d.quests.completed.includes(r.quest), `Missão: ${QUESTS[r.quest]?.name ?? r.quest}`);
  if (r.ally) ck(isAlly(d, "dwarf"), "Ser aliado de Dwargon");
  for (const [id, n] of r.mats) ck(countItem(player, id) >= n, `${n}x ${nameOf(id)} (${countItem(player, id)})`);
  const price = Math.round(r.cost * priceMult(d, "dwarf")); ck(d.coins >= price, `${fmt(price)} moedas`);
  return out;
}
export function craftRecipe(player, i) {
  const d = getData(player), r = DWARF_RECIPES[i]; if (!r || !ITEMS[r.give]) return { ok: false, msg: "Encomenda inválida." };
  if (recipeReqs(player, r).some((x) => !x.ok)) return { ok: false, msg: "Requisitos pendentes." };
  d.coins -= Math.round(r.cost * priceMult(d, "dwarf")); for (const [id, n] of r.mats) removeItem(player, id, n);
  const it = new ItemStack(r.give, 1); ensureLore(it); const c = inventory(player); const left = c?.addItem(it); if (left) player.dimension.spawnItem(left, player.location);
  markDirty(player); saveNow(player); playSound(player, SOUNDS.forge ?? "random.anvil_use");
  return { ok: true, msg: `A Forja Anã entregou: ${nameOf(r.give)}!` };
}
function openRecipes(player, role) {
  const b = DWARF_RECIPES.map((r, i) => { const ok = recipeReqs(player, r).every((x) => x.ok); return { text: `${nameOf(r.give)}\n§r${ok ? "§a★ Pronto para encomendar" : "§7ver requisitos"}`, icon: "textures/items/" + r.give.replace("etheria:", "etheria_"), run: () => openRecipe(player, role, i) }; });
  b.push(back(() => openWorldNpc(player, role)));
  menu(player, "§6§lEncomendas da Forja Anã", "§7Equipamentos raros forjados pelos mestres de Dwargon. Exigem materiais, reputação e, às vezes, missões.", b);
}
function openRecipe(player, role, i) {
  const r = DWARF_RECIPES[i], reqs = recipeReqs(player, r), ok = reqs.every((x) => x.ok), st = ITEMS[r.give]?.stats ?? {};
  const body = [nameOf(r.give), "", ...Object.entries(st).slice(0, 6).map(([k, v]) => `§7${k}: §f${v}`), "", "§e§lRequisitos", ...reqs.map((x) => x.text)].join("\n");
  const b = []; if (ok) b.push({ text: "§a§lEncomendar", run: () => { msg(player, craftRecipe(player, i)); openRecipes(player, role); } });
  b.push(back(() => openRecipes(player, role)));
  menu(player, "§6Encomenda", body, b);
}

// ---------------------------------------------------------------- aliança, escolta, notícias
function openOath(player, role) {
  const d = getData(player), meta = WORLD_NPCS[role], F = FACTIONS[meta.faction], f = meta.faction, why = oathCheck(d, f), ally = isAlly(d, f);
  const ben = { tempest: "Descontos de aliado, escolta de guardas, mestres liberam técnicas e novas missões.", dwarf: "Encomendas lendárias da Forja, preços de aliado e técnicas defensivas.",
    guy: "Mercadorias lendárias e técnicas raríssimas do Domínio.", orc: "A Horda o trata como irmão: fúria, resistência e absorção." }[f] ?? "";
  const body = [`${F.color}§l${F.name}`, `§7Reputação: ${repBar(repOf(d, f))} §f${repOf(d, f)}`, "", `§aBenefícios: §f${ben}`, "", ally ? "§bVocê é aliado desta nação." : why ? `§cPendente: ${why}` : "§aVocê cumpre todos os requisitos!",
    "§8Algumas alianças são incompatíveis (nações em guerra entre si)."].join("\n");
  const b = [];
  if (!ally && !why) b.push({ text: "§b§lJurar aliança", icon: "menu_guild", run: () => { msg(player, swearOath(player, f)); openOath(player, role); } });
  if (ally) b.push({ text: "§cRomper aliança (-80 de reputação)", run: () => { msg(player, breakOath(player, f)); openOath(player, role); } });
  b.push(back(() => openWorldNpc(player, role)));
  menu(player, `${F.color}§lAliança`, body, b);
}
const escortAt = new Map();
export function callEscort(player, f) {
  const d = getData(player); if (!isAlly(d, f)) return { ok: false, msg: "Só aliados podem chamar escolta." };
  const now = Date.now(); if ((escortAt.get(player.id) ?? 0) > now) return { ok: false, msg: `Escolta indisponível por mais ${Math.ceil((escortAt.get(player.id) - now) / 1000)}s.` };
  const type = { tempest: "etheria:npc_tp_guard", dwarf: "etheria:npc_dw_guard", guy: "etheria:npc_gc_soldier", orc: "etheria:npc_orc_warrior" }[f]; if (!type) return { ok: false, msg: "Sem escolta." };
  let n = 0;
  for (let i = 0; i < 2; i++) { try { const e = player.dimension.spawnEntity(type, { x: player.location.x + (i ? 2 : -2), y: player.location.y, z: player.location.z + 1 }); e.addTag("etheria_escort"); system.runTimeout(() => { try { if (e.isValid) e.remove(); } catch { /* ignore */ } }, 2400); n++; } catch { /* ignore */ } }
  if (!n) return { ok: false, msg: "Não foi possível chamar a escolta aqui." };
  escortAt.set(player.id, now + 600000); return { ok: true, msg: "Dois soldados o escoltarão por 2 minutos." };
}
function openNews(player, role) {
  const d = getData(player), pairs = [];
  for (let i = 0; i < FACTION_LIST.length; i++) for (let j = i + 1; j < FACTION_LIST.length; j++) pairs.push([FACTION_LIST[i], FACTION_LIST[j]]);
  const lines = pairs.map(([a, b]) => `${a.color}${a.short} §7↔ ${b.color}${b.short}§7: ${relationName(relation(a.id, b.id))}`);
  menu(player, "§d§lNotícias e diplomacia", ["§f\"Eis o que se comenta entre as nações:\"", "", ...lines, "", "§7As relações mudam com os seus feitos: derrotar chefes, concluir missões diplomáticas e proteger cidades."].join("\n"), [back(() => openWorldNpc(player, role))]);
}

// ---------------------------------------------------------------- tela Mundo
const STORY = [
  ["Conhecer Tempest", (d) => hasFlag(d, "met_tempest")], ["Receber uma missão e concluí-la", (d) => d.quests.completed.length > 0], ["Aprender uma técnica com um mestre", (d) => (wd(d).taught ?? 0) > 0],
  ["Defender Tempest de um ataque", (d) => (wd(d).defends ?? 0) > 0], ["Derrotar um chefe", (d) => bossTotal(d) > 0], ["Conhecer o Reino Anão", (d) => hasFlag(d, "met_dwarf")], ["Descobrir Guy Crimson", (d) => hasFlag(d, "met_guy")],
  ["Conhecer a Horda orc", (d) => hasFlag(d, "met_orc")], ["Quebrar a Horda (Orc do Desastre)", (d) => hasFlag(d, "orc_broken")], ["Tornar-se aliado de uma nação", (d) => PLAYER_FACTIONS.some((f) => isAlly(d, f))],
  ["Encontrar o Mestre Lendário", (d) => hasFlag(d, "met_hermit")], ["Aprender uma técnica lendária", (d) => d.unlockedSkills.includes("legend_resolve") || d.unlockedSkills.includes("sword_sovereign") || d.unlockedSkills.includes("overlord_presence")],
];
export const storyProgress = (d) => STORY.map(([t, f]) => ({ text: t, ok: !!f(d) }));
export function openWorld(player) {
  const d = getData(player);
  const lines = PLAYER_FACTIONS.map((f) => { const F = FACTIONS[f], r = repOf(d, f), t = tierOf(r); return `${F.color}${F.short} ${repBar(r)} ${t.color}${t.name} §8(${r})${isAlly(d, f) ? " §b[ALIADO]" : ""}`; });
  menu(player, "§l§dMUNDO VIVO", ["§e§lReputação", ...lines, "", "§7Faixas: Inimigo < Hostil < Desconfiado < Neutro < Amigável < Aliado (300) < Campeão (650)"].join("\n"), [
    { text: "§l§dDiplomacia\n§r§7Relações entre as nações", icon: "menu_ranking", run: () => openDiplomacy(player) },
    { text: "§l§bTerritórios\n§r§7Onde ficam as nações", icon: "menu_race", run: () => openPlaces(player) },
    { text: "§l§6História\n§r§7Sua jornada pelo mundo", icon: "menu_quests", run: () => openStory(player) },
    { text: "§l§7Detalhes de uma facção", icon: "menu_guild", run: () => openFactionList(player) },
    back(() => import("./ui/menus.js").then((m) => m.openMain(player))),
  ]);
}
function openDiplomacy(player) {
  const lines = []; for (let i = 0; i < FACTION_LIST.length; i++) for (let j = i + 1; j < FACTION_LIST.length; j++) { const a = FACTION_LIST[i], b = FACTION_LIST[j]; lines.push(`${a.color}${a.short} §7↔ ${b.color}${b.short}§7: ${relationName(relation(a.id, b.id))}`); }
  menu(player, "§d§lDiplomacia", ["§7Relações atuais entre as nações:", "", ...lines].join("\n"), [back(() => openWorld(player))]);
}
function openPlaces(player) {
  const l = player.location, lines = [], t = tempestInfo();
  const dist = (x, z) => Math.round(Math.hypot(x - l.x, z - l.z));
  if (t) lines.push(`§b${FACTIONS.tempest.capital}: §f${t.x}, ${t.y}, ${t.z} §7(${dist(t.x, t.z)} blocos)`); else lines.push("§bTempest: §7ainda sendo localizada");
  for (const s of Object.values(SETTLEMENTS)) { const i = settlementInfo(s.id); lines.push(`${FACTIONS[s.faction].color}${s.name}: ${i ? `§f${i.x}, ${i.z} §7(${dist(i.x, i.z)} blocos${i.built ? "" : ", ainda não visitada"})` : "§7ainda sendo localizada"}`); }
  // viagem posterior (21.14): só para lugares já conhecidos (visitados ou escolhidos na origem); a estrutura é garantida antes do teleporte
  const known = visitedOf(getData(player));
  const trips = LOCATION_LIST.filter((L) => known.includes(L.id)).map((L) => ({ text: `§a§lViajar: §r§f${L.name}`, run: () => travelTo(player, L.id) }));
  menu(player, "§b§lTerritórios", ["§7Cada nação tem identidade própria. Viaje para descobri-las:", "", ...lines, "", trips.length ? "§7Toque em um lugar conhecido para viajar." : "§7Visite uma cidade para poder voltar a ela por aqui."].join("\n"), [...trips, back(() => openWorld(player))]);
}
function openStory(player) {
  const d = getData(player), s = storyProgress(d), done = s.filter((x) => x.ok).length;
  menu(player, "§6§lHistória", [`§7Progresso: §f${done}/${s.length}`, bar(done / s.length, 14), "", ...s.map((x) => `${x.ok ? "§a[x]" : "§7[ ]"} §f${x.text}`)].join("\n"), [back(() => openWorld(player))]);
}
function openFactionList(player) {
  const b = PLAYER_FACTIONS.concat(["hermit"]).map((f) => ({ text: `${FACTIONS[f].color}§l${FACTIONS[f].short}`, run: () => openFaction(player, f) }));
  b.push(back(() => openWorld(player))); menu(player, "§l§7Facções", "§7Toque para ver detalhes.", b);
}
function openFaction(player, f) {
  const d = getData(player), F = FACTIONS[f];
  const body = [`${F.color}§l${F.name}`, `§7Capital: §f${F.capital}`, "", `§f${F.desc}`, "", `§bCultura: §f${F.culture}`, `§aEnsina: §f${F.ally}`, `§cInimigos: §f${F.enemies}`, "",
    ...(PLAYER_FACTIONS.includes(f) ? [`§7Reputação: ${repBar(repOf(d, f))} §f${repOf(d, f)} ${tierFor(d, f).color}(${tierFor(d, f).name})`] : []),
    ...FACTION_LIST.filter((g) => g.id !== f).map((g) => `${g.color}${g.short}§7: ${relationName(relation(f, g.id))}`)].join("\n");
  menu(player, `${F.color}${F.short}`, body, [back(() => openFactionList(player))]);
}

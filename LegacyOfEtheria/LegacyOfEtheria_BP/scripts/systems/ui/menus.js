import { system } from "@minecraft/server";
// systems/ui/menus.js - Menus principais do jogador (celular: botões grandes, textos curtos, sempre com "Voltar")
import { ModalFormData } from "@minecraft/server-ui";
import { ATTRIBUTES, MAX_LEVEL, MAX_SLOTS, RARITY, STAT_LABELS, FX_LEVELS, FX_LABELS, xpToNext } from "../../config.js";
import { getData, markDirty, saveNow } from "../../core/db.js";
import { bar, fmt, say } from "../../core/utils.js";
import { SKILLS, SKILL_LIST } from "../../data/skills.js";
import { RACES, RACE_LIST, stageOf, raceOf, nextStages, isLordStage } from "../../data/races.js";
import { raceCardText, raceSheet, raceStyle, evoReqs, evoProgress, progressBar, reqLines, treeLines, RACE_LOOK, STAGE_LOOK } from "../../data/racecard.js";
import { CLASSES, CLASS_LIST } from "../../data/classes.js";
import { QUESTS } from "../../data/quests.js";
import { GUILD_RANKS, GUILD_REP, GUILD_REWARDS, ACHIEVEMENTS } from "../../data/misc.js";
import { getStats, getHealth, applyDerivedStats } from "../stats.js";
import { learnSkill, canLearn, castSlot, cdLeft, hasSkill, skillCost } from "../skills.js";
import { openHotbar, openSlotPick, hotbarSummary } from "../skillbar/ui.js";
import { HotbarLoadout } from "../skillbar/loadout.js";
import { chooseRace, evolve, evolveCheck, chooseClass, classCheck, refreshName } from "../race.js";
import { acceptQuest, abandonQuest, canAccept, describe, isDone } from "../quests.js";
import { joinGuild, claimRewards, claimable } from "../guild.js";
import { getRanking } from "../ranking.js";
import { listBuffs } from "../effects.js";
import { nameOf } from "../items.js";
import { menu, show } from "./forms.js";
import { openPowers } from "../powers.js";
import { FLIGHT } from "../../config.js";
import { flightOn, setFlightOn, flightRequirements } from "../flight.js";
import { ITEMS } from "../../data/items.gen.js";
import { inventory } from "../../core/utils.js";
import { applyConsumable } from "../use.js";
import { countItem } from "../../core/utils.js";
import { fx, ring } from "../fx.js";
import { LINEAGE_LIST, LINEAGES, LINEAGE_FORMS, LINEAGE_RACE, lineageLock, tierState, formLock, lineageOf, formOfPlayer, raceDepth } from "../../data/lineages.js";
import { chooseLineage, setForm, endForm } from "../lineage.js";
import { openWorld } from "../worldnpc.js";

const R = (k) => RARITY[k];
const back = (fn) => ({ text: "§7« Voltar", icon: "back", run: fn });
const msg = (player, r) => say(player, `${r.ok ? "§a" : "§c"}${r.msg}`);

// ---------------------------------------------------------------- principal
export function openMain(player) {
  const d = getData(player);
  menu(player, "§l§6LEGACY OF ETHERIA", `§eNv.${d.level} §7| §6${fmt(d.coins)} moedas\n§aAtributos: ${d.attributePoints}  §bHabilidades: ${d.skillPoints}`, [
    { text: "§lStatus", icon: "menu_status", run: () => openStatus(player) },
    { text: "§lHabilidades", icon: "menu_skills", run: () => openSkills(player) },
    { text: "§lInventário", icon: "menu_inventory", run: () => openInventory(player) },
    { text: "§lMissões", icon: "menu_quests", run: () => openQuests(player) },
    { text: "§lRaça", icon: "menu_race", run: () => openRace(player) },
    { text: "§lClasse", icon: "menu_class", run: () => openClass(player) },
    { text: "§lGuilda", icon: "menu_guild", run: () => openGuild(player) },
    { text: "§lMundo e Facções\n§r§7Reputação, diplomacia e territórios", icon: "menu_ranking", run: () => openWorld(player) },
    { text: "§lConquistas e Títulos", icon: "menu_ranking", run: () => openAchievements(player) },
    { text: "§lRanking", icon: "menu_ranking", run: () => openRanking(player) },
    { text: "§lConfigurações", icon: "menu_settings", run: () => openSettings(player) },
  ]);
}

// ---------------------------------------------------------------- status / atributos
export function openStatus(player) {
  const d = getData(player), s = getStats(player), hp = getHealth(player), st = stageOf(d), r = raceOf(d);
  const need = d.level >= MAX_LEVEL ? 0 : xpToNext(d.level);
  const attrs = Object.entries(ATTRIBUTES).map(([k, v]) => `§7${v.label}: §f${d.attributes[k]}${s[{ strength: "str", defense: "def", intelligence: "int", agility: "agi", vitality: "vit" }[k]] !== d.attributes[k] ? ` §8(total ${s[{ strength: "str", defense: "def", intelligence: "int", agility: "agi", vitality: "vit" }[k]]})` : ""}`).join("\n");
  const body =
    `§cHP ${bar(hp.cur, hp.max, 12, "§c")} §f${Math.ceil(hp.cur)}/${Math.ceil(hp.max)}\n§9MP ${bar(d.mana, s.maxMana, 12, "§9")} §f${Math.floor(d.mana)}/${s.maxMana}\n§aST ${bar(d.stamina, s.maxStamina, 12, "§a")} §f${Math.floor(d.stamina)}/${s.maxStamina}\n\n` +
    `§eNível ${d.level} §7(${d.level >= MAX_LEVEL ? "MAX" : `${fmt(d.xp)}/${fmt(need)} XP`})\n§7Título: §f${d.title}\n§7Raça: ${r.color}${st.name}  §7Classe: §f${d.class ? CLASSES[d.class].name : "—"}\n§7Moedas: §6${fmt(d.coins)}  §7Abates: §c${fmt(d.kills)}\n\n${attrs}\n\n` +
    `§7Ataque §f${s.atk.toFixed(1)} §7| Crítico §f${s.crit.toFixed(0)}% §7(x${(s.critDmg / 100).toFixed(2)})\n§7Redução de dano §f${(s.reduction * 100).toFixed(0)}% §7| Roubo de vida §f${s.lifesteal.toFixed(0)}%\n§7Recarga §f-${s.cdr.toFixed(0)}% §7| Custo de mana §f-${s.manaCost.toFixed(0)}%\n\n§aPontos de atributo: ${d.attributePoints}\n§bPontos de habilidade: ${d.skillPoints}`;
  menu(player, "§l§6STATUS", body, [
    { text: "§l+ Distribuir atributos", icon: "menu_status", run: () => openAttributes(player) },
    { text: "Trocar título", icon: "menu_ranking", run: () => openTitles(player) },
    back(() => openMain(player)),
  ]);
}
const amount = new Map();
export function openAttributes(player) {
  const d = getData(player), n = amount.get(player.id) ?? 1;
  const keys = Object.keys(ATTRIBUTES);
  const b = keys.map((k) => ({ text: `${ATTRIBUTES[k].label}  §f${d.attributes[k]}  §a+${n}`, icon: "attr_" + k, run: () => {
    let spent = 0;
    for (let i = 0; i < n && d.attributePoints > 0; i++) { d.attributePoints--; d.attributes[k]++; spent++; }
    if (spent === 0) say(player, "§cSem pontos de atributo."); else { applyDerivedStats(player); saveNow(player); }
    openAttributes(player);
  } }));
  b.push({ text: `Pontos por toque: §ex${n}§r (alterar)`, icon: "menu_settings", run: () => { amount.set(player.id, n === 1 ? 5 : n === 5 ? 10 : 1); openAttributes(player); } });
  b.push(back(() => openStatus(player)));
  menu(player, "§l§aATRIBUTOS", `§7Pontos disponíveis: §a${d.attributePoints}\n§8Vitalidade: +vida | Inteligência: +mana | Agilidade: +stamina/crítico | Força: +ataque | Defesa: -dano`, b);
}
export function openTitles(player) {
  const d = getData(player);
  const b = d.titles.map((t) => ({ text: (t === d.title ? "§a[x] " : "") + t, run: () => { d.title = t; markDirty(player); say(player, `§aTítulo: ${t}`); refreshName(player); openTitles(player); } }));
  b.push(back(() => openStatus(player)));
  menu(player, "§l§6TÍTULOS", `§7Desbloqueie títulos com conquistas. Atual: §f${d.title}`, b);
}

// ---------------------------------------------------------------- habilidades
export function openSkills(player) {
  const d = getData(player);
  menu(player, "§l§bHABILIDADES", `§bPontos de habilidade: ${d.skillPoints}\n§7Equipadas: §f${d.equippedSkills.length}/${MAX_SLOTS}\n\n${hotbarSummary(player)}`, [
    { text: "§lHotbar de habilidades", icon: "menu_skills", run: () => openHotbar(player, () => openSkills(player)) },
    { text: "§lLançar (toque rápido)", icon: "skill_fireball", run: () => openQuickCast(player) },
    { text: "§lAprender habilidades", icon: "skill_fireball", run: () => openLearn(player, 0) },
    { text: "§lEquipar / guardar", icon: "menu_class", run: () => openEquip(player) },
    { text: "Passivas e raciais", icon: "skill_regeneration", run: () => openPassives(player) },
    { text: "§l§5Árvore de Poderes\n§r§7evoluções, requisitos e efeitos", icon: "menu_skills", run: () => openPowers(player, () => openSkills(player)) },
    back(() => openMain(player)),
  ]);
}
export function openQuickCast(player) {
  const d = getData(player);
  if (d.equippedSkills.length === 0) { say(player, "§cNenhuma habilidade equipada. Abra Habilidades > Equipar."); return; }
  const s = getStats(player);
  const b = d.equippedSkills.map((id, i) => {
    const sk = SKILLS[id], cd = cdLeft(player, id), cost = skillCost(player, sk, d, s).mana;
    return { text: `§l${sk.name}\n§r§9${cost} mana ${cd > 0 ? `§c(${cd.toFixed(0)}s)` : "§a(pronta)"}`, icon: "skill_" + id, run: () => { const r = castSlot(player, i); if (!r.ok) say(player, `§c${r.msg}`); } };
  });
  b.push({ text: "Fechar" });
  menu(player, "§l§bLANÇAR", `§9Mana: ${Math.floor(d.mana)}/${s.maxMana}`, b);
}
const TREE = () => SKILL_LIST.filter((s) => s.sp > 0).sort((a, b) => a.level - b.level);
export function openLearn(player, page) {
  const d = getData(player), list = TREE(), per = 7, pages = Math.ceil(list.length / per);
  const slice = list.slice(page * per, page * per + per);
  const b = slice.map((sk) => {
    const why = canLearn(d, sk);
    const tag = hasSkill(d, sk.id) ? "§a[x] aprendida" : why ? `§c${why}` : "§eAprender";
    return { text: `${R(sk.rarity).color}${sk.name}${sk.type === "passive" ? " §7(passiva)" : ""}\n§r${tag}`, icon: "skill_" + sk.id, run: () => openSkillDetail(player, sk.id, page) };
  });
  if (page > 0) b.push({ text: "« Página anterior", run: () => openLearn(player, page - 1) });
  if (page < pages - 1) b.push({ text: "Próxima página »", run: () => openLearn(player, page + 1) });
  b.push(back(() => openSkills(player)));
  menu(player, "§l§bAPRENDER", `§bPontos: ${d.skillPoints}   §7Página ${page + 1}/${pages}`, b);
}
export function openSkillDetail(player, id, page) {
  const d = getData(player), sk = SKILLS[id], why = canLearn(d, sk);
  const body = `${R(sk.rarity).color}${R(sk.rarity).name} §7• ${sk.cat} • ${sk.type === "active" ? "Ativa" : "Passiva"}\n\n§f${sk.desc}\n\n` +
    (sk.type === "active" ? `§9Mana: ${sk.mana}  §7Recarga: ${sk.cd}s\n` : "") + `§7Nível: ${sk.level}  Custo: ${sk.sp} pt\n` + (sk.req?.length ? `§7Requer: ${sk.req.map((r) => SKILLS[r].name).join(", ")}\n` : "") + (why ? `\n§c${why}` : "");
  const b = [];
  if (!why) b.push({ text: "§a§lAprender", icon: "skill_" + id, run: () => { msg(player, learnSkill(player, id)); openLearn(player, page); } });
  b.push(back(() => openLearn(player, page)));
  menu(player, `§l${sk.name}`, body, b);
}
export function openEquip(player) {
  const d = getData(player);
  const list = d.unlockedSkills.map((id) => SKILLS[id]).filter((s) => s && s.type === "active");
  if (list.length === 0) { say(player, "§cVocê ainda não tem habilidades ativas."); return openSkills(player); }
  const b = list.map((sk) => {
    const eq = d.equippedSkills.includes(sk.id);
    return { text: `${eq ? `§a[${HotbarLoadout.label(d, sk.id)}] ` : "§7"}${sk.name}`, icon: "skill_" + sk.id, run: () => openSlotPick(player, sk.id, () => openEquip(player)) };
  });
  b.push(back(() => openSkills(player)));
  menu(player, "§l§bEQUIPAR / GUARDAR", `§7Toque numa habilidade para escolher o slot da hotbar ou guardá-la.\n§7Equipadas: §f${d.equippedSkills.length}/${MAX_SLOTS}  §8(habilidade guardada continua aprendida)`, b);
}
function openPassives(player) {
  const d = getData(player);
  const list = d.unlockedSkills.map((id) => SKILLS[id]).filter((s) => s && s.type === "passive");
  const lines = list.map((s) => `${R(s.rarity).color}${s.name} §7- ${s.desc}`);
  const b = [];
  if (hasSkill(d, FLIGHT.skill)) {
    const on = flightOn(d);
    b.push({ text: `§lVoo Livre: ${on ? "§aATIVADO" : "§cDESATIVADO"}\n§r§7Toque para ${on ? "desativar" : "ativar"}`, icon: "skill_" + FLIGHT.skill, run: () => { say(player, setFlightOn(player, !on).msg); openPassives(player); } });
  } else {
    lines.push(`§8Voo Livre (bloqueado): nível 50 + 5 pontos + Teletransporte, ou progressão de raça/forma (${flightRequirements()}).`);
  }
  b.push(back(() => openSkills(player)));
  menu(player, "§l§bPASSIVAS", lines.length ? lines.join("\n") : "§7Nenhuma passiva ainda.", b);
}

// ---------------------------------------------------------------- inventário
export function openInventory(player) {
  const s = getStats(player);
  const names = { Mainhand: "Mão", Offhand: "Acessório", Head: "Cabeça", Chest: "Peito", Legs: "Pernas", Feet: "Pés" };
  const eq = s.eq.length ? s.eq.map((e) => `§7${names[e.slot]}: ${nameOf(e.info.id)}${e.forge ? ` §8+${e.forge}` : ""}`).join("\n") : "§7Nenhum equipamento Etheria equipado.";
  menu(player, "§l§6INVENTÁRIO", `${eq}\n\n§7Ataque §f${s.atk.toFixed(1)} §7| Def §f${(s.reduction * 100).toFixed(0)}% §7| Crít §f${s.crit.toFixed(0)}%`, [
    { text: "§lConsumíveis", icon: "menu_inventory", run: () => openConsumables(player) },
    { text: "Itens e materiais", icon: "menu_inventory", run: () => openMaterials(player) },
    back(() => openMain(player)),
  ]);
}
function collect(player, kinds) {
  const c = inventory(player), map = new Map();
  if (c) for (let i = 0; i < c.size; i++) { const it = c.getItem(i), inf = it && ITEMS[it.typeId]; if (inf && kinds.includes(inf.kind)) map.set(it.typeId, (map.get(it.typeId) ?? 0) + it.amount); }
  return [...map.entries()];
}
function openConsumables(player) {
  const list = collect(player, ["consumable"]);
  const b = list.map(([id, n]) => ({ text: `${nameOf(id)} §7x${n}`, icon: "textures/items/" + id.replace("etheria:", "etheria_"), run: () => { const r = applyConsumable(player, id); if (r) msg(player, r); openConsumables(player); } }));
  b.push(back(() => openInventory(player)));
  menu(player, "§l§eCONSUMÍVEIS", list.length ? "§7Toque para usar." : "§7Você não tem consumíveis.", b);
}
function openMaterials(player) {
  const list = collect(player, ["material", "artifact", "quest"]);
  const body = list.length ? list.map(([id, n]) => `${nameOf(id)} §7x${n}`).join("\n") : "§7Nada por aqui.";
  menu(player, "§l§6MATERIAIS", body, [back(() => openInventory(player))]);
}

// ---------------------------------------------------------------- missões
export function openQuests(player) {
  const d = getData(player), ids = Object.keys(d.quests.active);
  const b = ids.map((id) => ({ text: `§l${QUESTS[id].name}\n§r${describe(player, id)[0] ?? ""}`, icon: "menu_quests", run: () => openQuestDetail(player, id) }));
  b.push(back(() => openMain(player)));
  menu(player, "§l§eMISSÕES", `§7Ativas: ${ids.length}/6   Concluídas: ${d.quests.completed.length}\n§8Aceite missões com o Viajante ou a Guilda.`, b);
}
function openQuestDetail(player, id) {
  const q = QUESTS[id];
  menu(player, `§l${q.name}`, `§7${q.desc}\n\n${describe(player, id).join("\n")}`, [
    { text: "§cAbandonar missão", run: () => { abandonQuest(player, id); say(player, "§7Missão abandonada."); openQuests(player); } },
    back(() => openQuests(player)),
  ]);
}
export function openQuestBoard(player, giver) {
  const d = getData(player);
  const list = Object.values(QUESTS).filter((q) => q.giver === giver);
  const b = list.map((q) => {
    const why = canAccept(d, q);
    return { text: `§l${q.name}\n§r${why ? `§c${why}` : "§aDisponível"}`, icon: "menu_quests", run: () => openQuestOffer(player, q.id, giver) };
  });
  b.push({ text: "Fechar" });
  menu(player, giver === "guild" ? "§l§6QUADRO DA GUILDA" : "§l§6MISSÕES", "§7Toque numa missão para ver detalhes.", b);
}
function openQuestOffer(player, id, giver) {
  const d = getData(player), q = QUESTS[id], why = canAccept(d, q), r = q.reward ?? {};
  const rw = [r.xp && `${r.xp} XP`, r.coins && `${r.coins} moedas`, r.sp && `${r.sp} pt. habilidade`, r.rep && `${r.rep} reputação`, ...(r.items ?? []).map(([i, n]) => `${n}x ${nameOf(i)}`)].filter(Boolean).join("§7, §e");
  const b = [];
  if (!why) b.push({ text: "§a§lAceitar missão", icon: "menu_quests", run: () => { msg(player, acceptQuest(player, id)); openQuestBoard(player, giver); } });
  b.push(back(() => openQuestBoard(player, giver)));
  menu(player, `§l${q.name}`, `§7${q.desc}\n\n${q.objectives.map((o) => `§f• ${o.label ?? o.type} ×${o.n ?? 1}`).join("\n")}\n\n§7Recompensa: §e${rw}${why ? `\n\n§c${why}` : ""}`, b);
}

// ---------------------------------------------------------------- raça
/** Feedback de toque antes da ação (botões de raça e evolução): o botão reage com som e anel de energia, e só então a tela seguinte abre. */
function pressFx(player, evo, after) {
  try {
    player.playSound(evo ? "random.levelup" : "random.click", { volume: 0.6, pitch: evo ? 1.2 : 1.5 });
    ring(player.dimension, player.location, evo ? 1.2 : 0.6, evo ? "transform" : "light", player);
  } catch { /* ignore */ }
  system.runTimeout(() => { try { after(); } catch (e) { console.warn(`[Etheria] feedback de botão: ${e}`); } }, evo ? 12 : 4);
}
export function openRacePick(player, idx = 0) {
  // 6.14: ficha com barras comparativas (relativas à melhor raça), estilo de jogo, botões com o NOME da raça anterior/próxima e lista com estilo
  const n = RACE_LIST.length, i = ((idx % n) + n) % n, r = RACE_LIST[i], st = r.stages[r.root];
  const prev = RACE_LIST[(i - 1 + n) % n], nxt = RACE_LIST[(i + 1) % n];
  const evo = st.next.length ? `\n§7Evolui para: §f${st.next.map((x) => r.stages[x].name).join("§7, §f")}` : "";
  menu(player, `${r.color}§l${r.name} §r§8(${i + 1}/${n})`, `§e§lESCOLHA SUA RAÇA§r  §8(permanente)\n§f${r.desc}\n\n${raceSheet(RACE_LIST, r, st, (s) => SKILLS[s]?.name ?? s)}${evo}`, [
    { text: `§a§lEscolher ${r.name}`, icon: "race_" + r.id, run: () => pressFx(player, false, () => openRaceConfirm(player, r.id)) },
    { text: `§7« ${prev.name}`, run: () => openRacePick(player, i - 1) },
    { text: `§7${nxt.name} »`, run: () => openRacePick(player, i + 1) },
    { text: "§bVer todas as raças", run: () => openRaceList(player) },
  ]);
}
function openRaceList(player, view = false) {
  const b = RACE_LIST.map((r, i) => ({ text: `${r.color}§l${r.name} §r§8- ${raceStyle(RACE_LIST, r.stages[r.root])}\n§r§7${r.bonus}`, icon: "race_" + r.id, run: () => (view ? openRaceView(player, i) : openRacePick(player, i)) }));
  if (view) b.push(back(() => openRace(player)));
  menu(player, view ? "§l§6RAÇAS DO MUNDO" : "§l§6ESCOLHA SUA RAÇA", view ? "§7Compare as raças e veja as árvores de evolução. Sua raça já foi escolhida." : "§7Sua raça define atributos, habilidades raciais e caminhos de evolução. Toque numa raça para ver a ficha completa.\n§cA escolha é permanente. §7Logo depois você escolhe sua classe.", b);
}
/** Ficha somente leitura (depois que a raça já foi escolhida): barras + árvore completa com o nível de cada estágio. */
function openRaceView(player, idx) {
  const r = RACE_LIST[idx], st = r.stages[r.root], tree = [];
  const walk = (id, depth) => { const x = r.stages[id]; tree.push((depth ? "  ".repeat(depth - 1) + "§8|- " : "") + `§f${x.name}${x.minLevel > 1 ? ` §8(Nv.${x.minLevel}${x.cost ? `, ${x.cost} moedas` : ""})` : ""}`); for (const n of x.next) walk(n, depth + 1); };
  walk(r.root, 0);
  menu(player, `${r.color}§l${r.name}`, `§f${r.desc}\n\n${raceSheet(RACE_LIST, r, st, (s) => SKILLS[s]?.name ?? s)}\n\n§e§lÁrvore de evolução\n${tree.join("\n")}`, [back(() => openRaceList(player, true))]);
}
function openRaceConfirm(player, id) {
  const r = RACES[id], st = r.stages[r.root], idx = RACE_LIST.findIndex((x) => x.id === id);
  menu(player, `${r.color}§lConfirmar: ${r.name}`, `§f${r.desc}\n\n§7Estilo: ${raceStyle(RACE_LIST, st)}\n§a+ ${r.bonus}\n§c- ${r.penalty}\n\n§cEsta escolha é permanente.\n§7Em seguida você escolhe a sua classe inicial.`, [
    { text: "§a§lConfirmar raça", icon: "race_" + id, run: () => { if (chooseRace(player, id)) { say(player, `§aVocê agora é ${r.name}!`); system.runTimeout(() => openClass(player, true), 50); } } },
    { text: "§7« Voltar", run: () => openRacePick(player, idx) },
  ]);
}
export function openRace(player) {
  const d = getData(player);
  if (!d.raceChosen) return openRacePick(player);
  const r = raceOf(d), st = stageOf(d), next = nextStages(d);
  const have = (id) => countItem(player, id);
  const info = next.map((n) => ({ n, prog: evoProgress(d, n, have), ready: !evolveCheck(player, n) }));
  const anyReady = info.some((x) => x.ready), best = info.slice().sort((a, b) => b.prog - a.prog)[0];
  const skills = st.skills.map((s) => SKILLS[s]?.name).filter(Boolean).join(", ") || "—";
  const look = RACE_LOOK[STAGE_LOOK[st.id] ?? r.id];
  const L = [
    `${r.color}§l${r.name} §r§7- estágio ${stageDepth(r, st)}/${stageMax(r)}   §eNv.${d.level}`,
    anyReady ? "§a§l>> EVOLUÇÃO DISPONÍVEL <<" : best ? `§7Próxima evolução: §f${next.length > 1 ? "escolha entre " + next.map((x) => x.name).join(" ou ") : best.n.name}` : "§6Você alcançou a forma suprema.",
    best ? `§eProgresso §r${progressBar(best.prog)}` : "",
    "",
    `§a+ ${r.bonus}`, `§c- ${r.penalty}`,
    look ? `§bAparência: §f${look}` : "",
    `§bHabilidades raciais: §f${skills}`,
    "", "§e§lÁrvore de evolução", ...treeLines(r, d, have),
  ].filter((x) => x !== undefined);
  const b = info.map(({ n, prog, ready }) => ({ text: ready ? `§a§l★ Evoluir: ${n.name}\n§r§aPronto! Toque para confirmar` : `§8§l${n.name}\n§r§c[BLOQUEADA] §7${Math.floor(prog * 100)}% - ver o que falta`, icon: "race_" + r.id, run: () => (ready ? pressFx(player, true, () => openEvolveConfirm(player, n.id)) : openEvolveConfirm(player, n.id)) }));
  b.push(lordButton(player, d));
  if (d.race === LINEAGE_RACE) { const L = lineageOf(d); b.push({ text: L ? `§l${L.color}Linhagem: ${L.name}\n§r§7${LINEAGE_FORMS[formOfPlayer(d)].name} - árvore, formas e trocar` : "§l§6ESCOLHA SUA LINHAGEM DRACÔNICA\n§r§eVeldora, Velzard, Velgrynd, Veldanava", icon: "race_dragonoid", run: () => openLineage(player) }); }
  b.push({ text: "§l§bFichas e comparação de raças\n§r§7Outras raças e seus traços", icon: "menu_race", run: () => openRaceList(player, true) });
  b.push(back(() => openMain(player)));
  menu(player, anyReady ? `§a§l★ ${st.name}` : `${r.color}§l${st.name}`, L.join("\n"), b);
  if (anyReady) { try { player.playSound("random.levelup", { volume: 0.4, pitch: 1.4 }); fx(player.dimension, player.location, "transform", player, 1); } catch { /* ignore */ } }
}
/** Opções de Lord Demônio da raça do jogador que ainda estão à frente (ou no estágio atual): [{ld, from, ready_here}] */
function lordOptions(d) {
  const r = raceOf(d), cur = d.raceStage, out = [];
  for (const ld of Object.values(r.stages)) {
    if (!isLordStage(ld.id)) continue;
    let c = r.stages[ld.from], ok = false;
    while (c) { if (c.id === cur) { ok = true; break; } c = c.from ? r.stages[c.from] : null; }
    if (ok) out.push({ ld, from: r.stages[ld.from], here: ld.from === cur });
  }
  return out;
}
function lordButton(player, d) {
  const icon = "race_" + d.race;
  if (isLordStage(d.raceStage)) return { text: "§5§lLord Demônio\n§r§aVocê já é Lord Demônio", icon, run: () => openLordDemon(player) };
  const opts = lordOptions(d), have = (id) => countItem(player, id);
  if (!opts.length) return { text: "§5§lLord Demônio\n§r§7Indisponível para o seu estágio", icon, run: () => openLordDemon(player) };
  const here = opts.find((o) => o.here);
  if (here) { const ready = !evolveCheck(player, here.ld); return { text: ready ? "§5§lLord Demônio\n§r§aPronto! Toque para evoluir" : `§5§lLord Demônio\n§r§7${Math.floor(evoProgress(d, here.ld, have) * 100)}% - ver requisitos`, icon, run: () => openLordDemon(player) }; }
  return { text: "§5§lLord Demônio\n§r§7Evolua até o estágio final primeiro", icon, run: () => openLordDemon(player) };
}
export function openLordDemon(player) {
  const d = getData(player), r = raceOf(d), have = (id) => countItem(player, id);
  const b = [];
  let body;
  if (isLordStage(d.raceStage)) {
    body = ["§5§lLord Demônio", "", "§aVocê já alcançou esta forma.", "", `§7Habilidade: §f${SKILLS.lord_demon_dominion?.name ?? "Domínio do Lord Demônio"}`].join("\n");
  } else {
    const opts = lordOptions(d);
    if (!opts.length) body = "§5§lLord Demônio\n\n§7Sua raça chega ao Lord Demônio a partir do estágio final. Continue evoluindo.";
    else {
      const L = ["§5§lLord Demônio", "§7Todas as raças podem evoluir para Lord Demônio a partir do estágio final.", ""];
      for (const o of opts) {
        const ready = !evolveCheck(player, o.ld);
        L.push(`§e§l${o.from.name} §r§7→ §5§lLord Demônio`);
        if (o.here) { L.push(ready ? "§a§l>> PRONTO PARA EVOLUIR <<" : `§eProgresso §r${progressBar(evoProgress(d, o.ld, have))}`, ...reqLines(d, o.ld, have)); }
        else L.push(`§c[ ] §fEvolua primeiro até §l${o.from.name}`, `§7Depois: nível ${o.ld.minLevel}, ${o.ld.cost} moedas e ${o.ld.kills} abates.`);
        L.push("");
        if (o.here) b.push(ready ? { text: "§a§lEvoluir para Lord Demônio", icon: "race_" + d.race, run: () => pressFx(player, true, () => openEvolveConfirm(player, o.ld.id)) } : { text: "§8§lVer o que falta", icon: "race_" + d.race, run: () => openEvolveConfirm(player, o.ld.id) });
      }
      body = L.join("\n");
    }
  }
  b.push(back(() => openRace(player)));
  menu(player, "§5§lLORD DEMÔNIO", body, b);
}
function stageDepth(r, st) { let n = 1; for (let c = st; c.from; c = r.stages[c.from]) n++; return n; }
function stageMax(r) { let m = 1; for (const s of Object.values(r.stages)) m = Math.max(m, stageDepth(r, s)); return m; }
function openEvolveConfirm(player, id) {
  const d = getData(player), r = raceOf(d), n = r.stages[id];
  const attrs = Object.entries(n.attrs).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? "§a+" : "§c"}${v} ${ATTRIBUTES[k].label}`).join("§7, ");
  const have = (id) => countItem(player, id), prog = evoProgress(d, n, have), ready = !evolveCheck(player, n);
  const body = [
    ready ? "§a§l>> EVOLUÇÃO DISPONÍVEL <<" : `§eProgresso §r${progressBar(prog)}`,
    "", "§e§lRequisitos", ...(reqLines(d, n, have).length ? reqLines(d, n, have) : ["§a[x] §fNenhum"]),
    "", attrs, `§7Novas habilidades: §f${n.skills.map((s) => SKILLS[s]?.name).join(", ") || "—"}`,
    "§cOs bônus substituem os do estágio atual.",
  ].join("\n");
  const b = [];
  if (ready) b.push({ text: "§a§lEvoluir agora", icon: "race_" + d.race, run: () => pressFx(player, true, () => msg(player, evolve(player, id))) });
  b.push(back(() => openRace(player)));
  menu(player, `${ready ? "§a" : "§d"}§lEVOLUIR: ${n.name}`, body, b);
}

// ---------------------------------------------------------------- classe
export function openClass(player, first = false) {
  const d = getData(player);
  // disponíveis primeiro (ordem do jogo), bloqueadas depois com o requisito
  const rows = CLASS_LIST.map((c) => ({ c, why: d.class === c.id ? null : classCheck(player, c) }));
  const ok = rows.filter((x) => !x.why || d.class === x.c.id), locked = rows.filter((x) => x.why && d.class !== x.c.id);
  const mk = ({ c, why }) => ({ text: `${why ? "§8" : "§l"}${c.name}${d.class === c.id ? " §a(atual)" : ""}\n§r${why ? `§c${why}` : d.class === c.id ? "§7" + c.style : "§7" + c.style}`, icon: "class_" + c.id, run: () => openClassConfirm(player, c.id, first) });
  const b = [...ok.map(mk), ...locked.map(mk)];
  if (first) b.push({ text: "§7Decidir depois (Relógio > Classe)", run: () => say(player, "§7Você pode escolher a classe a qualquer momento no §fRelógio §7> §fClasse§7.") }); else b.push(back(() => openMain(player)));
  menu(player, first ? "§l§6ESCOLHA SUA CLASSE" : "§l§6CLASSE", `${first ? "§eAgora escolha a classe inicial. §7Guerreiro e Mago são gratuitos desde o nível 1; as outras liberam com nível e moedas.\n\n" : ""}§7Atual: §f${d.class ? CLASSES[d.class].name : "nenhuma"}\n§8Troque de classe com o Mestre de Classe (custa moedas).`, b);
}
function openClassConfirm(player, id, first = false) {
  const d = getData(player), c = CLASSES[id], why = classCheck(player, c);
  const attrs = Object.entries(c.attrs).map(([k, v]) => `${v > 0 ? "§a+" : "§c"}${v} ${ATTRIBUTES[k].label}`).join("§7, ");
  const stats = Object.entries(c.stats).map(([k, v]) => `§a+${v} ${STAT_LABELS[k] ?? k}`).join("§7, ");
  const cost = d.class ? c.cost + d.level * 50 : c.cost;
  const b = [];
  if (!why) b.push({ text: `§a§lEscolher (${cost} moedas)`, icon: "class_" + id, run: () => { msg(player, chooseClass(player, id)); } });
  b.push(back(() => openClass(player, first)));
  menu(player, `§l${c.name}`, `§f${c.style}\n\n${attrs}\n${stats}\n\n§7Habilidades: §b${c.skills.map((s) => SKILLS[s].name).join(", ")}\n§7Requer nível ${c.minLevel}${why ? `\n\n§c${why}` : ""}`, b);
}

// ---------------------------------------------------------------- guilda
export function openGuild(player) {
  const d = getData(player), g = d.guild;
  if (!g.id) {
    return menu(player, "§l§6GUILDA", "§7Você ainda não é membro. Entre para receber missões, reputação e recompensas por rank (F até SSS).", [
      { text: "§a§lEntrar na Guilda", icon: "menu_guild", run: () => { msg(player, joinGuild(player)); openGuild(player); } },
      back(() => openMain(player)),
    ]);
  }
  const next = g.rank < GUILD_RANKS.length - 1 ? `${g.reputation}/${GUILD_REP[g.rank + 1]}` : "MAX";
  const pend = claimable(d).length;
  menu(player, "§l§6GUILDA", `§7Rank: §6§l${GUILD_RANKS[g.rank]}\n§7Reputação: §f${next}\n${pend ? `§a${pend} recompensa(s) para resgatar!` : ""}`, [
    { text: "§lQuadro de missões", icon: "menu_quests", run: () => openQuestBoard(player, "guild") },
    { text: `§lResgatar recompensas${pend ? ` §a(${pend})` : ""}`, icon: "menu_guild", run: () => { msg(player, claimRewards(player)); openGuild(player); } },
    back(() => openMain(player)),
  ]);
}

// ---------------------------------------------------------------- conquistas / ranking / config
export function openAchievements(player) {
  const d = getData(player);
  const body = ACHIEVEMENTS.map((a) => `${d.achievements.includes(a.id) ? "§a[x]" : "§8[ ]"} §f${a.name} §8- ${a.desc}`).join("\n");
  menu(player, "§l§6CONQUISTAS", `§7${d.achievements.length}/${ACHIEVEMENTS.length}\n\n${body}`, [
    { text: "Trocar título", icon: "menu_ranking", run: () => openTitles(player) }, back(() => openMain(player)),
  ]);
}
export function openRanking(player) {
  const list = getRanking();
  const body = list.length ? list.map((e, i) => `§6${i + 1}. §f${e.n} §7- Nv.${e.l} §8(${e.r}) §c${e.k} abates §5${e.b} bosses`).join("\n") : "§7Ainda sem registros.";
  menu(player, "§l§6RANKING", body, [back(() => openMain(player))]);
}
export function openSettings(player) {
  const d = getData(player), st = d.settings, sb = st.skillbar;
  const f = new ModalFormData().title("§lCONFIGURAÇÕES")
    .toggle("HUD na tela", st.hud).toggle("HUD compacta (1 linha)", st.compact).toggle("Mostrar missão na HUD", st.tracker)
    .dropdown("Efeitos visuais (partículas)", FX_LEVELS.map((k) => FX_LABELS[k]), Math.max(0, FX_LEVELS.indexOf(st.fx)))
    .toggle("Habilidades: anunciar o uso por voz", sb.announce).toggle("Habilidades: som ao selecionar o slot", sb.selectSound)
    .toggle("Habilidades: mostrar custo ao selecionar", sb.selectInfo).toggle("Habilidades: faixa na HUD", sb.strip)
    .toggle("Habilidade na mão lança em vez de abrir baús (agache para abrir)", sb.blockInteract)
    .toggle("Magias em fases (formação, trajeto e impacto)", sb.staged !== false);
  show(player, f, (r) => {
    const [hud, compact, tracker, fx, announce, selSound, selInfo, strip, blockInteract, staged] = r.formValues;
    st.hud = !!hud; st.compact = !!compact; st.tracker = !!tracker; st.fx = FX_LEVELS[fx] ?? "high";
    sb.announce = !!announce; sb.selectSound = !!selSound; sb.selectInfo = !!selInfo; sb.strip = !!strip; sb.blockInteract = !!blockInteract; sb.staged = staged !== false;
    markDirty(player); saveNow(player); say(player, "§aConfigurações salvas.");
  });
}

// ---------------------------------------------------------------- linhagens dracônicas
const stars = (n) => "§6" + "★".repeat(n) + "§8" + "★".repeat(5 - n);
const skillName = (id) => SKILLS[id]?.name ?? id;
export function openLineage(player) {
  const d = getData(player), cur = lineageOf(d);
  const L = [
    "§6§lESCOLHA SUA LINHAGEM DRACÔNICA",
    cur ? `§7Linhagem atual: ${cur.color}§l${cur.name} §r§7- forma: §f${LINEAGE_FORMS[formOfPlayer(d)].name}` : "§7A linhagem define aparência, atributos, habilidades, evolução e estilo de combate.",
    d.race !== LINEAGE_RACE ? "§cDisponível apenas para a raça Dragonoide." : "",
  ].filter(Boolean);
  const b = LINEAGE_LIST.map((l) => {
    const lock = lineageLock(d, l);
    return { text: `${lock && d.lineage !== l.id ? "§8" : l.color}§l${l.name}§r §7- ${l.concept}\n${cur?.id === l.id ? "§a[x] Sua linhagem" : lock ? `§c[Bloqueada] ${lock}` : `${stars(l.difficulty)} §7toque para ver`}`, icon: "race_dragonoid", run: () => openLineageView(player, l.id) };
  });
  if (cur) b.push({ text: "§l§dFormas e transformação\n§r§7Dragonoide, Forma Dracônica, Dragão Verdadeiro", icon: "menu_race", run: () => openForms(player) });
  b.push(back(() => openRace(player)));
  menu(player, "§6§lLinhagem Dracônica", L.join("\n"), b);
}
function openLineageView(player, id) {
  const d = getData(player), l = LINEAGES[id], lock = lineageLock(d, l), cur = d.lineage === id;
  const attrs = Object.entries(l.attrs).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? "§a+" : "§c"}${v} ${ATTRIBUTES[k].label}`).join("§7, ");
  const ts = tierState(d, l);
  const tree = ts.map((t, i) => `${t.ok && cur ? "§a[x]" : "§7[ ]"} §fNv.${t.lvl}${t.depth > 1 ? ` (estágio ${t.depth})` : ""}${t.bosses ? ` + ${t.bosses} chefes` : ""} §7→ §b${skillName(t.skill)}${SKILLS[t.skill]?.type === "passive" ? " §8(passiva)" : ""}`);
  const u = l.unlock ?? {};
  const body = [
    `${l.color}§l${l.name} §r§7- ${l.title}`, `§7Conceito: §f${l.concept}   §7Dificuldade: ${stars(l.difficulty)}`, "", `§f${l.desc}`, "",
    `§a+ ${l.pros}`, `§c- ${l.cons}`, "", `§bBônus: §f${attrs || "—"}`,
    "§e§lÁrvore de habilidades", `§7Inicial: §f${skillName(l.tiers[0].skill)}`, ...tree, "",
    "§e§lFormas", ...Object.entries(LINEAGE_FORMS).filter(([k]) => k !== "base").map(([k, f]) => `§7${f.name}: Nv.${f.lvl}, estágio ${f.depth}`),
    "", "§e§lRequisitos", `${d.level >= (u.lvl ?? 1) ? "§a[x]" : "§c[ ]"} §fNível ${u.lvl ?? 1} (${d.level})`,
    u.depth ? `${raceDepth(d) >= u.depth ? "§a[x]" : "§c[ ]"} §fEstágio ${u.depth} da raça (${raceDepth(d)})` : "", u.bosses ? `${lock && lock.includes("chefes") ? "§c[ ]" : "§a[x]"} §f${u.bosses} chefes derrotados` : "",
    d.lineage && !cur ? "§eTrocar de linhagem custa 10000 moedas." : "",
  ].filter((x) => x !== "");
  const b = [];
  if (!cur && !lock) b.push({ text: d.lineage ? "§l§aTrocar para esta linhagem\n§r§710000 moedas" : "§l§aSeguir esta linhagem\n§r§7Escolha gratuita", icon: "race_dragonoid", run: () => { msg(player, chooseLineage(player, id)); } });
  b.push(back(() => openLineage(player)));
  menu(player, `${l.color}§l${l.name}`, body.join("\n"), b);
}
function openForms(player) {
  const d = getData(player), l = lineageOf(d); if (!l) return openLineage(player);
  const cur = formOfPlayer(d), cool = Math.max(0, Math.ceil(((d.lcool ?? 0) - Date.now()) / 1000));
  const body = [`${l.color}§l${l.name} §r§7- forma atual: §f${LINEAGE_FORMS[cur].name}`, cool ? `§eRecarga: ${cool}s` : "", `§7Mana: §b${Math.floor(d.mana)}`, "",
    "§7Cada forma gasta mana por segundo e fortalece o corpo (Força, Defesa, Vitalidade, vida), com efeitos e aura da linhagem. O tamanho do jogador não muda (limite do Minecraft): o modelo da forma é maior, com asas, focinho e espinhos."].filter(Boolean);
  const b = [];
  for (const [k, f] of Object.entries(LINEAGE_FORMS)) {
    if (k === "base") continue;
    const lock = formLock(d, l, k);
    if (cur === k) b.push({ text: `§l§cEncerrar ${f.name}\n§r§7Voltar ao Dragonoide`, icon: "back", run: () => { msg(player, endForm(player, true)); } });
    else b.push({ text: `${lock ? "§8" : "§a"}§l${f.name}\n§r${lock ? "§c[Bloqueada] " + lock : `§7Gasta ${f.drain} de mana/s`}`, icon: "race_dragonoid", run: () => { msg(player, lock ? { ok: false, msg: lock } : setForm(player, k)); } });
  }
  b.push(back(() => openLineage(player)));
  menu(player, "§d§lFormas Dracônicas", body.join("\n"), b);
}

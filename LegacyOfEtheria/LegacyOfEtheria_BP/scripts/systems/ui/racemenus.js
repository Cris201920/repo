// systems/ui/racemenus.js - RAÇA, EVOLUÇÃO E NÍVEL no padrão da interface nova (6.34): tela animada temática (ui/server_form.json),
// painel de detalhes à esquerda (trilha da árvore, barras, requisitos com valores reais) e cartões com estado à direita.
// Mesmos dados e as mesmas ações de antes (chooseRace, evolve, Lord Demônio, linhagem); só a apresentação e a organização mudaram.
import { system } from "@minecraft/server";
import { getData } from "../../core/db.js";
import { bar, fmt, say, countItem } from "../../core/utils.js";
import { ATTRIBUTES, MAX_LEVEL, ATTR_POINTS_PER_LEVEL, SKILL_POINT_EVERY, xpToNext } from "../../config.js";
import { SKILLS } from "../../data/skills.js";
import { RACES, RACE_LIST, stageOf, raceOf, nextStages, isLordStage } from "../../data/races.js";
import { raceSheet, raceStyle, evoReqs, evoProgress, RACE_LOOK, STAGE_LOOK } from "../../data/racecard.js";
import { CLASSES } from "../../data/classes.js";
import { LINEAGE_RACE, LINEAGES, LINEAGE_FORMS, lineageOf, formOfPlayer, raceDepth, bossTotal } from "../../data/lineages.js";
import { AGILITY_LINES, AGI_GATES } from "../../data/agility.js";
import { getStats, getHealth } from "../stats.js";
import { chooseRace, evolve, evolveCheck } from "../race.js";
import { hasSkill } from "../skills.js";
import { menu } from "./forms.js";
import { openLineage, openClass, openAttributes, openTitles } from "./menus.js";
import { openPowers } from "../powers.js";

const SEP = "§8▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬";
const RACE_THEME = { slime: "sage", demon: "world", vampire: "world", undead: "ciel", angel: "raphael", human: "raphael", dragonoid: "raphael", dwarf: "raphael", elf: "ciel", lizardman: "sage" };
const themeOf = (raceId) => RACE_THEME[raceId] ?? "tree";
const skillName = (s) => SKILLS[s]?.name ?? s;
const have = (player) => (id) => countItem(player, id);
const pct = (f) => `${Math.floor(Math.min(1, f) * 100)}%`;
const reqBar = (R) => { const ok = R.filter((r) => r.ok).length; return `${bar(ok, Math.max(1, R.length), 10, ok === R.length ? "§a" : "§e")} §7${ok}/${R.length}`; };
const reqRows = (R) => (R.length ? R.map((r) => `${r.ok ? "§a✔" : "§c✘"} ${r.ok ? "§7" : "§f"}${r.label} §8(${fmt(Math.min(r.cur, r.need))}/${fmt(r.need)})`) : ["§a✔ §7Nenhum requisito"]);
function depthOf(r, st) { let n = 1; for (let c = st; c?.from; c = r.stages[c.from]) n++; return n; }
function maxDepth(r) { let m = 1; for (const s of Object.values(r.stages)) m = Math.max(m, depthOf(r, s)); return m; }
/** caminho da raiz até o estágio atual */
function pathTo(r, st) { const p = []; for (let c = st; c; c = c.from ? r.stages[c.from] : null) p.unshift(c); return p; }

// ------------------------------------------------------------------ árvore visual
/** trilha: o caminho já percorrido (●), o estágio atual, e as ramificações seguintes com o avanço de cada uma */
function trail(player, d, r) {
  const st = stageOf(d), path = pathTo(r, st), L = [], H = have(player);
  path.forEach((s, i) => {
    const cur = s.id === st.id;
    L.push(`${cur ? "§a" : "§2"}● §l${s.name}§r${s.minLevel > 1 ? ` §8Nv.${s.minLevel}` : ""}${cur ? " §a« ATUAL" : ""}`);
    if (!cur) L.push("§2│");
  });
  const walk = (id, pre, last) => {
    const s = r.stages[id], R = evoReqs(d, s, H), ok = !evolveCheck(player, s), lord = isLordStage(s.id);
    const col = ok ? "§e" : lord ? "§5" : "§8";
    L.push(`${pre}${last ? "└─" : "├─"}${col}${ok ? "★" : "○"} §l${s.name}§r ${ok ? "§e(pronta)" : `${reqBar(R)}`}`);
    const kids = s.next ?? [];
    kids.forEach((k, j) => walk(k, pre + (last ? "   " : "│  "), j === kids.length - 1));
  };
  const nx = st.next ?? [];
  nx.forEach((k, j) => walk(k, "§8", j === nx.length - 1));
  if (!nx.length) L.push("§6★ Forma final da raça");
  return L.join("\n");
}

// ------------------------------------------------------------------ RAÇA (tela principal)
export function openRaceV2(player, back) {
  const d = getData(player);
  if (!d.raceChosen) return openRacePickV2(player, 0);
  const r = raceOf(d), st = stageOf(d), next = nextStages(d), H = have(player);
  const info = next.map((n) => ({ n, R: evoReqs(d, n, H), prog: evoProgress(d, n, H), ready: !evolveCheck(player, n) }));
  const ready = info.filter((x) => x.ready);
  const look = RACE_LOOK[STAGE_LOOK[st.id] ?? r.id];
  const need = d.level >= MAX_LEVEL ? 0 : xpToNext(d.level);
  const body = [
    `${r.color}§l${r.name.toUpperCase()} §r§7· estágio §f${depthOf(r, st)}/${maxDepth(r)}`,
    `§f${st.name}${isLordStage(st.id) ? " §5(Lord Demônio)" : ""}`,
    ready.length ? "§e§l★ EVOLUÇÃO DISPONÍVEL" : next.length ? "§7Próxima evolução: escolha um caminho à direita" : "§6Forma final alcançada",
    SEP,
    `§eNível ${d.level}${d.level >= MAX_LEVEL ? " §6(MÁX.)" : ""}  ${d.level >= MAX_LEVEL ? "" : `${bar(d.xp, need, 10, "§e")} §7${fmt(d.xp)}/${fmt(need)} XP`}`,
    SEP,
    "§l§fTRILHA DE EVOLUÇÃO", trail(player, d, r),
    SEP,
    `§a+ ${r.bonus}`, `§c- ${r.penalty}`,
    `§bHabilidades raciais: §f${st.skills.map(skillName).join(", ") || "—"}`,
    ...(look ? [`§7Aparência: §f${look}`] : []),
  ].join("\n");
  const B = info.map(({ n, R, ready: ok }) => ({
    text: ok ? `§e§l★ ${n.name}\n§r§aDISPONÍVEL · toque para evoluir` : `§8§l${n.name}\n§r§7${isLordStage(n.id) ? "Lord Demônio · " : ""}${R.filter((x) => x.ok).length}/${R.length} requisitos · ${pct(evoProgress(d, n, H))}`,
    icon: "race_" + r.id, run: () => openEvolveV2(player, n.id, back),
  }));
  B.push({ text: "§l§5Lord Demônio\n§r§7caminho do Verdadeiro Lorde Demônio", icon: "race_" + r.id, run: () => openLordV2(player, back) });
  if (d.race === LINEAGE_RACE) { const Lg = lineageOf(d); B.push({ text: Lg ? `§l${Lg.color}Linhagem: ${Lg.name}\n§r§7${LINEAGE_FORMS[formOfPlayer(d)].name} · árvore e formas` : "§l§6Escolher linhagem dracônica\n§r§7Veldora, Velzard, Velgrynd, Veldanava", icon: "race_dragonoid", run: () => openLineage(player) }); }
  B.push({ text: "§l§eNível e evolução de nível\n§r§7o que cada nível libera", icon: "menu_status", run: () => openLevelV2(player, () => openRaceV2(player, back)) });
  B.push({ text: "§l§bComparar raças\n§r§7fichas e árvores de todas as raças", icon: "menu_race", run: () => openRaceListV2(player, true, back) });
  B.push({ text: "§7« Voltar", icon: "back", run: () => back?.() });
  menu(player, `${r.color}§l${st.name.toUpperCase()}`, body, B, themeOf(r.id));
  if (ready.length) { try { player.playSound("random.levelup", { volume: 0.35, pitch: 1.4 }); } catch { /* ignore */ } }
}

// ------------------------------------------------------------------ EVOLUÇÃO (detalhe de um estágio)
export function openEvolveV2(player, id, back) {
  const d = getData(player), r = raceOf(d), st = stageOf(d), n = r.stages[id], H = have(player);
  if (!n) return openRaceV2(player, back);
  const R = evoReqs(d, n, H), ready = !evolveCheck(player, n);
  const keys = Object.keys(ATTRIBUTES);
  const cmp = keys.map((k) => { const a = st.attrs?.[k] ?? 0, b = n.attrs?.[k] ?? 0; return b === a ? null : `§7${ATTRIBUTES[k].label}: §f${a} §8» ${b > a ? "§a▲" : "§c▼"} §f${b}`; }).filter(Boolean);
  const newSkills = (n.skills ?? []).filter((s) => !hasSkill(d, s)).map(skillName);
  const body = [
    `${r.color}§l${n.name.toUpperCase()}`, `§7${st.name} §8» §f${n.name}${isLordStage(n.id) ? " §5(Lord Demônio)" : ""}`,
    ready ? "§e§l★ PRONTA PARA EVOLUIR" : "§8○ BLOQUEADA",
    SEP, `§l§fREQUISITOS  ${reqBar(R)}`, ...reqRows(R),
    SEP, "§l§fO QUE MUDA", ...(cmp.length ? cmp : ["§7Atributos iguais aos atuais"]),
    `§7Novas habilidades: §f${newSkills.join(", ") || "—"}`,
    ...(n.next?.length ? [`§7Depois: §f${n.next.map((x) => r.stages[x].name).join("§7 ou §f")}`] : []),
    "§8Os bônus do novo estágio substituem os do atual.",
  ].join("\n");
  const B = [];
  if (ready) B.push({ text: "§a§lEVOLUIR AGORA\n§r§7inicia a cerimônia de evolução", icon: "race_" + d.race, run: () => { try { player.playSound("random.levelup", { volume: 0.6, pitch: 1.2 }); } catch { /* ignore */ } system.runTimeout(() => { const res = evolve(player, id); if (!res.ok) say(player, `§c${res.msg}`); }, 8); } });
  B.push({ text: "§7« Árvore da raça", icon: "back", run: () => openRaceV2(player, back) });
  menu(player, `${ready ? "§e" : "§d"}§lEVOLUIR: ${n.name.toUpperCase()}`, body, B, isLordStage(n.id) ? "world" : themeOf(r.id));
}

// ------------------------------------------------------------------ LORD DEMÔNIO
export function openLordV2(player, back) {
  const d = getData(player), r = raceOf(d), H = have(player);
  const opts = Object.values(r.stages).filter((s) => isLordStage(s.id)).map((ld) => {
    let c = r.stages[ld.from], onPath = false; while (c) { if (c.id === d.raceStage) { onPath = true; break; } c = c.from ? r.stages[c.from] : null; }
    return { ld, from: r.stages[ld.from], onPath, here: ld.from === d.raceStage };
  }).filter((o) => o.onPath || isLordStage(d.raceStage));
  const L = ["§5§lCAMINHO DO LORD DEMÔNIO", "§7Qualquer raça desperta como Lord Demônio a partir do estágio final da sua árvore.", SEP];
  const B = [];
  if (isLordStage(d.raceStage)) L.push("§a● Você já é Lord Demônio.", `§7Habilidade: §f${skillName("lord_demon_dominion")}`);
  else if (!opts.length) L.push("§7Evolua até o estágio final da sua raça para abrir este caminho.");
  for (const o of opts) {
    const R = evoReqs(d, o.ld, H), ok = !evolveCheck(player, o.ld);
    L.push(`§f§l${o.from.name} §r§8» §5§lLord Demônio`, o.here ? `${ok ? "§e★ pronto" : reqBar(R)}` : "§7○ evolua primeiro até este estágio", ...(o.here ? reqRows(R) : []), "");
    if (o.here) B.push({ text: ok ? "§5§l★ Despertar como Lord Demônio\n§r§aFestival da Colheita" : "§8§lLord Demônio\n§r§7ver requisitos", icon: "race_" + d.race, run: () => openEvolveV2(player, o.ld.id, back) });
  }
  B.push({ text: "§7« Árvore da raça", icon: "back", run: () => openRaceV2(player, back) });
  menu(player, "§5§lLORD DEMÔNIO", L.join("\n"), B, "world");
}

// ------------------------------------------------------------------ ESCOLHA / COMPARAÇÃO DE RAÇAS
function treeOf(r) {
  const L = [];
  const walk = (id, pre, last, root) => {
    const s = r.stages[id];
    L.push(`${root ? "" : `${pre}${last ? "└─" : "├─"}`}${isLordStage(s.id) ? "§5" : "§f"}${s.name}${s.minLevel > 1 ? ` §8Nv.${s.minLevel}` : ""}`);
    const k = s.next ?? []; k.forEach((x, j) => walk(x, root ? "§8" : pre + (last ? "   " : "│  "), j === k.length - 1, false));
  };
  walk(r.root, "", true, true);
  return L.join("\n");
}
export function openRacePickV2(player, idx = 0) {
  const n = RACE_LIST.length, i = ((idx % n) + n) % n, r = RACE_LIST[i], st = r.stages[r.root];
  const prev = RACE_LIST[(i - 1 + n) % n], nxt = RACE_LIST[(i + 1) % n];
  const body = [`§e§lESCOLHA SUA RAÇA §r§8(${i + 1}/${n} · permanente)`, `${r.color}§l${r.name.toUpperCase()}`, `§f${r.desc}`, SEP,
    raceSheet(RACE_LIST, r, st, skillName), SEP, "§l§fÁRVORE DE EVOLUÇÃO", treeOf(r), SEP,
    `§bAgilidades Supremas: §f${AGILITY_LINES[r.id]?.name ?? "—"}`].join("\n");
  menu(player, `${r.color}§l${r.name.toUpperCase()}`, body, [
    { text: `§a§lESCOLHER ${r.name.toUpperCase()}\n§r§7confirmar na próxima tela`, icon: "race_" + r.id, run: () => openRaceConfirmV2(player, r.id) },
    { text: `§l« ${prev.name}\n§r§7${raceStyle(RACE_LIST, prev.stages[prev.root])}`, icon: "race_" + prev.id, run: () => openRacePickV2(player, i - 1) },
    { text: `§l${nxt.name} »\n§r§7${raceStyle(RACE_LIST, nxt.stages[nxt.root])}`, icon: "race_" + nxt.id, run: () => openRacePickV2(player, i + 1) },
    { text: "§l§bTodas as raças\n§r§7lista com estilo e bônus", icon: "menu_race", run: () => openRaceListV2(player, false) },
  ], themeOf(r.id));
}
function openRaceConfirmV2(player, id) {
  const r = RACES[id], st = r.stages[r.root], idx = RACE_LIST.findIndex((x) => x.id === id);
  menu(player, `${r.color}§lCONFIRMAR: ${r.name.toUpperCase()}`, [`${r.color}§l${r.name}`, `§f${r.desc}`, SEP, `§7Estilo: ${raceStyle(RACE_LIST, st)}`, `§a+ ${r.bonus}`, `§c- ${r.penalty}`, SEP, "§cEsta escolha é permanente.", "§7Em seguida você escolhe a classe inicial."].join("\n"), [
    { text: "§a§lCONFIRMAR RAÇA", icon: "race_" + id, run: () => { if (chooseRace(player, id)) { say(player, `§aVocê agora é ${r.name}!`); system.runTimeout(() => openClass(player, true), 50); } } },
    { text: "§7« Voltar", icon: "back", run: () => openRacePickV2(player, idx) },
  ], themeOf(id));
}
export function openRaceListV2(player, view = false, back) {
  const d = getData(player);
  const B = RACE_LIST.map((r, i) => ({ text: `${r.color}§l${r.name}${d.race === r.id ? " §a●" : ""}\n§r§7${raceStyle(RACE_LIST, r.stages[r.root])}`, icon: "race_" + r.id, run: () => (view ? openRaceViewV2(player, i, back) : openRacePickV2(player, i)) }));
  if (view) B.push({ text: "§7« Voltar", icon: "back", run: () => openRaceV2(player, back) });
  menu(player, view ? "§l§6RAÇAS DO MUNDO" : "§l§6ESCOLHA SUA RAÇA", [view ? "§l§fRAÇAS DO MUNDO" : "§e§lESCOLHA SUA RAÇA", SEP, "§7Cada raça tem atributos, habilidades raciais, uma árvore de evolução própria, o caminho do Lord Demônio e uma linha de Agilidades Supremas.", ...(view ? [] : ["", "§cA escolha é permanente."])].join("\n"), B);
}
function openRaceViewV2(player, idx, back) {
  const r = RACE_LIST[idx], st = r.stages[r.root];
  menu(player, `${r.color}§l${r.name.toUpperCase()}`, [`${r.color}§l${r.name.toUpperCase()}`, `§f${r.desc}`, SEP, raceSheet(RACE_LIST, r, st, skillName), SEP, "§l§fÁRVORE DE EVOLUÇÃO", treeOf(r)].join("\n"),
    [{ text: "§7« Raças", icon: "back", run: () => openRaceListV2(player, true, back) }], themeOf(r.id));
}

// ------------------------------------------------------------------ NÍVEL E EVOLUÇÃO DE NÍVEL
/** marcos reais à frente do jogador: evolução da raça, agilidades, linhagem e pontos */
function milestones(player, d) {
  const out = [], r = raceOf(d);
  for (const n of nextStages(d)) if (n.minLevel > d.level) out.push([n.minLevel, `${r.color}Evolução: §f${n.name}`]);
  const L = AGILITY_LINES[d.race];
  if (L) L.stages.forEach((sk, i) => { if (!hasSkill(d, sk.id) && AGI_GATES[i].level > d.level) out.push([AGI_GATES[i].level, `§bAgilidade: §f${sk.name}`]); });
  const Lg = lineageOf(d);
  if (Lg) for (const t of Lg.tiers) if (t.lvl > d.level && !hasSkill(d, t.skill)) out.push([t.lvl, `${Lg.color}Linhagem: §f${skillName(t.skill)}`]);
  for (const f of Object.values(LINEAGE_FORMS)) if (Lg && f.lvl > d.level) out.push([f.lvl, `§6Forma: §f${f.name}`]);
  const nextSp = d.level + (SKILL_POINT_EVERY - (d.level % SKILL_POINT_EVERY));
  if (nextSp <= MAX_LEVEL) out.push([nextSp, "§bPonto de habilidade"]);
  return out.sort((a, b) => a[0] - b[0]).slice(0, 7);
}
export function openLevelV2(player, back) {
  const d = getData(player), s = getStats(player), hp = getHealth(player), r = raceOf(d), st = stageOf(d);
  const need = d.level >= MAX_LEVEL ? 0 : xpToNext(d.level), ms = milestones(player, d);
  const body = [
    `§e§lNÍVEL ${d.level}${d.level >= MAX_LEVEL ? " §6(MÁXIMO)" : ""}`, `${r.color}${st.name} §7· ${d.class ? CLASSES[d.class]?.name ?? "—" : "sem classe"} §7· ${d.title}`,
    d.level >= MAX_LEVEL ? "§6Nível máximo alcançado." : `${bar(d.xp, need, 14, "§e")} §f${fmt(d.xp)}/${fmt(need)} XP\n§7Faltam §f${fmt(need - d.xp)} XP §7para o nível ${d.level + 1}`,
    SEP,
    `§cVida ${bar(hp.cur, hp.max, 10, "§c")} §f${Math.ceil(hp.cur)}/${Math.ceil(hp.max)}`, `§9Mana ${bar(d.mana, s.maxMana, 10, "§9")} §f${Math.floor(d.mana)}/${s.maxMana}`, `§aStamina ${bar(d.stamina, s.maxStamina, 10, "§a")} §f${Math.floor(d.stamina)}/${s.maxStamina}`,
    SEP,
    "§l§fA CADA NÍVEL", `§a+${ATTR_POINTS_PER_LEVEL} pontos de atributo §7· §b+1 ponto de habilidade a cada ${SKILL_POINT_EVERY} níveis`,
    `§7Disponíveis: §a${d.attributePoints} atributo §7· §b${d.skillPoints} habilidade`,
    SEP, "§l§fPRÓXIMOS MARCOS", ...(ms.length ? ms.map(([lv, t]) => `${lv <= d.level ? "§a★" : "§8○"} §eNv.${lv} §r${t}`) : ["§6Todos os marcos de nível alcançados"]),
    SEP, "§l§fATRIBUTOS", ...Object.entries(ATTRIBUTES).map(([k, v]) => `§7${v.label}: §f${d.attributes[k]}`),
    `§7Ataque §f${s.atk.toFixed(1)} §7· Crítico §f${s.crit.toFixed(0)}% §7· Redução §f${(s.reduction * 100).toFixed(0)}%`,
  ].join("\n");
  menu(player, `§e§lNÍVEL ${d.level}`, body, [
    { text: `§a§lDistribuir atributos\n§r§7${d.attributePoints} ponto(s) disponível(is)`, icon: "menu_status", run: () => openAttributes(player) },
    { text: "§l§dEvolução da raça\n§r§7árvore, requisitos e Lord Demônio", icon: "race_" + d.race, run: () => openRaceV2(player, () => openLevelV2(player, back)) },
    { text: "§l§5Árvore de Poderes\n§r§7linhas, agilidades e linhagens", icon: "menu_skills", run: () => openPowers(player, () => openLevelV2(player, back)) },
    { text: "§lTítulos\n§r§7trocar o título exibido", icon: "menu_ranking", run: () => openTitles(player) },
    { text: "§7« Voltar", icon: "back", run: () => back?.() },
  ], themeOf(d.race));
}

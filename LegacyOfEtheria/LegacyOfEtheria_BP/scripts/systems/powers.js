// systems/powers.js - ÁRVORE DE PODERES (Expansão Suprema). Camada de consulta + progressão sobre os sistemas JÁ existentes (Sábio, Predador, Linhagens, Anti-Skill, Voo):
// nada é duplicado nem removido; o estado vem do que já é salvo (habilidades desbloqueadas, estágio do Sábio, devorados, linhagem, chefes derrotados), então persiste após reiniciar.
// Acesso: Relógio > Habilidades > Árvore de Poderes, ou !poderes. Também registra chefes-MOB derrotados em d.bossKills (antes só os chefes de sigilo contavam).
import { world } from "@minecraft/server";
import { system } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { SKILLS } from "../data/skills.js";
import { MOBS } from "../data/mobs.gen.js";
import { RARITY } from "../config.js";
import { LINES, LINE, POWER_CLASS } from "../data/powers.js";
import { LINEAGES, tierState, bossTotal } from "../data/lineages.js";
import { hasSkill, grantSkill } from "./skills.js";
import { openCreator } from "./creator.js";
import { sageStage } from "./voice.js";
import { evoReq, stageName } from "./sageknow.js";
import { STOMACH_EVOLVE, BEELZEBUTH_EVOLVE } from "./predator.js";
import { classifySkill, CLASS } from "./antiskill.js";
import { flightEligible, flightRequirements } from "./flight.js";
import { FLIGHT } from "../config.js";
import { BOSS_BY_TYPE } from "../data/bosses.js";
const BOSS_RARITIES = ["boss", "legendary", "special"];
import { menu, sageThemeOf } from "./ui/forms.js";
import { AGILITY_LINES, AGI_GATES } from "../data/agility.js";
import { agilityReq, agilityAwaken } from "./agility.js";
import { RACES } from "../data/races.js";
import { openRace as openRaceMenu } from "./ui/menus.js";
import { openSage as openSageBook } from "./sage.js";
import { say, toast, isValid, bar } from "../core/utils.js";

const CLS_COL = { common: "§7", unique: "§d", supreme: "§6" };
const CLASS_TXT = { [CLASS.NEGATABLE]: "§aAnulável", [CLASS.PARTIAL]: "§eParcialmente resistida", [CLASS.IMMUNE]: "§cImune" };
const R = (ok, text) => ({ ok: !!ok, text });

/** requisitos do estágio (lista [{ok,text}]) */
export function stageReq(player, line, st) {
  const d = getData(player), out = [];
  if (line.id === "sage") return evoReq(player, st.sage).map((r) => R(r.ok, r.text));
  if (line.id === "predator") {
    const g = st.gate ?? {}, prev = line.stages[line.stages.indexOf(st) - 1];
    if (prev) out.push(R(hasSkill(d, prev.skill), `Possuir ${prev.name}`));
    else out.push(R(hasSkill(d, "predator"), "Raça Slime começa com Predador"));
    if (g.level) out.push(R(d.level >= g.level, `Nível ${g.level} (${d.level})`));
    if (g.devoured) { const n = g.devoured === "STOMACH" ? STOMACH_EVOLVE : BEELZEBUTH_EVOLVE.devoured; out.push(R((d.devoured ?? 0) >= n, `${n} alvos devorados (${d.devoured ?? 0})`)); }
    if (st.id === "beelzebuth") out.push(R(d.level >= BEELZEBUTH_EVOLVE.level, `Nível ${BEELZEBUTH_EVOLVE.level} (${d.level})`));
    return out;
  }
  if (line.id === "veldora") {
    const L = LINEAGES.veldora;
    out.push(R(d.race === "dragonoid" && d.lineage === "veldora", "Dragonoide da linhagem Veldora"));
    for (const t of tierState(d, L)) if (st.tiers.includes(t.skill) && !hasSkill(d, t.skill)) out.push(R(t.ok, `${SKILLS[t.skill]?.name ?? t.skill}: Nv.${t.lvl}, estágio ${t.depth}${t.bosses ? `, ${t.bosses} chefes (${bossTotal(d)})` : ""}`));
    return out;
  }
  if (line.id === "yuuki") {
    const g = st.gate; out.push(R(d.level >= g.level, `Nível ${g.level} (${d.level})`), R((d.bossKills?.[g.boss] ?? 0) > 0, `Derrotar ${MOBS["etheria:" + g.boss]?.name ?? g.boss}`));
    if (g.skill) out.push(R(hasSkill(d, g.skill), `Possuir ${SKILLS[g.skill]?.name ?? g.skill}`));
    return out;
  }
  if (line.id === "flight") {
    const sk = SKILLS.free_flight;
    out.push(R(flightEligible(d), `Progressão: ${flightRequirements()} (ou forma Dracônica/Verdadeira)`));
    out.push(R(d.level >= sk.level && hasSkill(d, "teleport") && d.skillPoints >= sk.sp, `Alternativa: nível ${sk.level}, Teletransporte e ${sk.sp} pontos de habilidade`));
    return out;
  }
  return out;
}
export const stageOwned = (player, line, st) => {
  const d = getData(player);
  return line.id === "sage" ? sageStage(d) >= st.sage : hasSkill(d, st.skill);
};
/** estado da linha: cada estágio ganha {owned, req, next} (next = primeiro não possuído) */
export function lineState(player, id) {
  const line = LINE[id]; let nextSeen = false;
  const stages = line.stages.map((st) => {
    const owned = stageOwned(player, line, st), req = owned ? [] : stageReq(player, line, st);
    const next = !owned && !nextSeen; if (next) nextSeen = true;
    return { ...st, owned, req, next, ready: !owned && req.length > 0 && req.every((r) => r.ok) };
  });
  return { line, stages, current: [...stages].reverse().find((s) => s.owned) ?? null, upcoming: stages.find((s) => s.next) ?? null };
}

// ---------------------------------------------------------------- progressão automática (Anti-Skill)
export function powersProgress(player) {
  const d = getData(player);
  if (!hasSkill(d, "anti_skill") && d.level >= 60 && (d.bossKills?.yuuki_kagurazaka ?? 0) > 0) {
    grantSkill(player, "anti_skill"); toast(player, "§8§lANTI-SKILL", "§7Poder de Yuuki conquistado");
    say(player, "§8§l[Anti-Skill] §r§7Você derrotou Yuuki Kagurazaka e dominou a §fAnti-Skill§7. Veja as regras em Habilidades > Árvore de Poderes.");
    markDirty(player); return true;
  }
  if (!hasSkill(d, "creator") && hasSkill(d, "anti_skill") && d.level >= 70 && (d.bossKills?.yuuki_kagurazaka ?? 0) > 0) {
    grantSkill(player, "creator"); toast(player, "§5§lCRIADOR", "§7Poder de Yuuki conquistado");
    say(player, "§5§l[Criador] §r§7Você dominou o §fCriador§7: forje suas próprias habilidades em Habilidades > Árvore de Poderes > Criador (ou §f!criar§7).");
    markDirty(player); return true;
  }
  return false;
}

// ---------------------------------------------------------------- UI
export function skillFacts(id) {
  const sk = SKILLS[id]; if (!sk) return [];
  const ex = sk.exec ?? {}, L = [];
  const cls = sk.cat === "Única" ? (["mythic", "divine"].includes(sk.rarity) ? "supreme" : "unique") : ["legendary", "divine", "mythic"].includes(sk.rarity) ? "unique" : "common";
  L.push(`${RARITY[sk.rarity]?.color ?? "§f"}${RARITY[sk.rarity]?.name ?? sk.rarity} §7· ${CLS_COL[cls]}${POWER_CLASS[cls]} §7· ${sk.type === "active" ? "Ativa" : "Passiva"} · elemento ${sk.element ?? "—"}`);
  if (sk.type === "active") L.push(`§9Mana ${sk.mana ?? 0}${sk.stamina ? `, stamina ${sk.stamina}` : ""} §7· recarga §f${sk.cd ?? 0}s${ex.range ? ` §7· alcance §f${ex.range}` : ""}${ex.radius ? ` §7· raio §f${ex.radius}` : ""}`);
  else L.push("§7Passiva: sem custo e sem recarga.");
  L.push(`§7Contra Anti-Skill: ${CLASS_TXT[classifySkill(sk)]}`);
  if (sk.req?.length) L.push(`§7Compatível/requer: §f${sk.req.map((r) => SKILLS[r]?.name ?? r).join(", ")}`);
  return L;
}
// ---------------------------------------------------------------- UI (6.29): painel de detalhes à esquerda, cartões à direita (ui/server_form.json)
const ST = { owned: "§a✔ DESBLOQUEADA", ready: "§e★ DISPONÍVEL", next: "§6● PRÓXIMA", locked: "§8○ BLOQUEADA" };
const stateOf = (s) => (s.owned ? "owned" : s.ready ? "ready" : s.next ? "next" : "locked");
const CARD_COL = { owned: "§a", ready: "§e", next: "§6", locked: "§8" };
const reqBar = (req) => { const ok = req.filter((r) => r.ok).length; return `${bar(ok, Math.max(1, req.length), 10, ok === req.length ? "§a" : "§e")} §7${ok}/${req.length}`; };
const SEP = "§8▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬";
const themeOfLine = (player, id) => (id === "sage" ? sageThemeOf(sageStage(getData(player))) : id === "yuuki" ? "world" : "tree");
/** trilha visual da linha: estágios ligados verticalmente com o estado de cada um */
function trail(stages) {
  const L = [];
  stages.forEach((s, i) => {
    const k = stateOf(s), c = CARD_COL[k];
    L.push(`${c}${s.owned ? "●" : "○"} §l${s.name}§r ${CLS_COL[s.cls] ?? "§7"}[${POWER_CLASS[s.cls] ?? s.cls}]${s.owned && !stages[i + 1]?.owned ? " §a« ATUAL" : ""}${s.next && !s.owned ? " §6« PRÓXIMA" : ""}`);
    if (!s.owned && s.req?.length) L.push(`${c}│ §r${reqBar(s.req)}`);
    if (i < stages.length - 1) L.push(`${c}│`);
  });
  return L.join("\n");
}
function cardOf(s, icon, run) {
  const k = stateOf(s);
  return { text: `${CARD_COL[k]}§l${s.name}\n§r${ST[k]}${!s.owned && s.req?.length ? ` §8· ${s.req.filter((r) => r.ok).length}/${s.req.length}` : ""}`, icon, run };
}
export function openStage(player, lineId, stageId, back) {
  const S = lineState(player, lineId), st = S.stages.find((x) => x.id === stageId), k = stateOf(st);
  const L = [`${CLS_COL[st.cls]}§l${st.name}`, `§7${POWER_CLASS[st.cls]} · ${S.line.name.split(" → ")[0]}`, ST[k], SEP];
  if (st.skill) L.push(...skillFacts(st.skill), SEP);
  L.push("§l§fEFEITOS REAIS", ...st.feats.map((f) => `§7• §f${f}`));
  if (!st.owned) L.push(SEP, `§l§fREQUISITOS  ${reqBar(st.req)}`, ...st.req.map((r) => `${r.ok ? "§a✔" : "§c✘"} ${r.ok ? "§7" : "§f"}${r.text}`));
  if (st.evolvesTo) L.push(SEP, `§7Próximo estágio: §b${st.evolvesTo}`);
  if (S.line.rules) L.push(SEP, "§l§fREGRAS", ...S.line.rules.map((r) => `§7• ${r}`));
  menu(player, `§l${CLS_COL[st.cls]}${st.name.toUpperCase()}`, L.join("\n"), [...(st.id === "creator" && st.owned ? [{ text: "§l§5Abrir a forja do Criador", icon: "skill_creator", run: () => openCreator(player, () => openStage(player, lineId, stageId, back)) }] : []),
    ...(lineId === "sage" ? [{ text: "§l§bLivro do Sábio\n§r§7evolução e requisitos completos", icon: "menu_skills", run: () => openSageBook(player) }] : []),
    { text: "§7« Voltar à linha", icon: "back", run: () => openLine(player, lineId, back) }], themeOfLine(player, lineId));
}
export function openLine(player, lineId, back) {
  const S = lineState(player, lineId), l = S.line;
  const body = [`§l${CLS_COL[l.cls]}${l.name}`, `§7${l.who} · ${POWER_CLASS[l.cls]}`, SEP, `§f${l.about}`, SEP,
    `§7Atual: ${S.current ? `§a${S.current.name}` : "§8nenhum estágio"}`, `§7Próxima: ${S.upcoming ? `§f${S.upcoming.name}${S.upcoming.ready ? " §e(pronta)" : ""}` : "§6linha completa"}`, SEP, trail(S.stages)].join("\n");
  menu(player, `§l${CLS_COL[l.cls]}${l.name.split(" → ")[0].toUpperCase()}`, body, [...S.stages.map((s) => cardOf(s, s.skill ? "skill_" + s.skill : "menu_skills", () => openStage(player, lineId, s.id, back))),
    { text: "§7« Linhas de Poder", icon: "back", run: () => openLines(player, back) }], themeOfLine(player, lineId));
}
function openLines(player, back) {
  const rows = LINES.map((l) => ({ l, S: lineState(player, l.id) }));
  const body = ["§l§dLINHAS DE PODER", "§7Habilidades Únicas e Supremas e suas evoluções.", SEP,
    ...rows.map(({ l, S }) => `${CLS_COL[l.cls]}§l${l.name.split(" → ")[0]}§r\n§7  ${S.current ? `§a${S.current.name}` : "§8bloqueada"}${S.upcoming ? ` §8» §f${S.upcoming.name}${S.upcoming.ready ? " §e★" : ""}` : " §6(máximo)"}`)].join("\n");
  menu(player, "§l§5LINHAS DE PODER", body, [...rows.map(({ l, S }) => ({ text: `${CLS_COL[l.cls]}§l${l.name.split(" → ")[0]}\n§r§7${S.stages.filter((x) => x.owned).length}/${S.stages.length} · ${S.upcoming ? (S.upcoming.ready ? "§e★ evolução disponível" : `próx.: ${S.upcoming.name}`) : "§6completa"}`,
    icon: S.stages[0].skill ? "skill_" + S.stages[0].skill : "menu_skills", run: () => openLine(player, l.id, back) })), { text: "§7« Árvore de Poderes", icon: "back", run: () => openPowers(player, back) }]);
}

// ---------------------------------------------------------------- Agilidades Supremas
function agiStages(player, race) {
  const d = getData(player), L = AGILITY_LINES[race]; let nextSeen = false;
  return L.stages.map((sk, i) => {
    const owned = hasSkill(d, sk.id), req = owned ? [] : agilityReq(player, race, i), next = !owned && !nextSeen; if (next) nextSeen = true;
    return { id: sk.id, name: sk.name, skill: sk.id, cls: AGI_GATES[i].cls, owned, req, next, ready: !owned && req.every((r) => r.ok), sk };
  });
}
function openAgiStage(player, race, id, back) {
  const st = agiStages(player, race).find((x) => x.id === id), k = stateOf(st), L = AGILITY_LINES[race], sk = st.sk;
  const body = [`${CLS_COL[st.cls]}§l${sk.name}`, `§7${POWER_CLASS[st.cls]} · ${L.name}`, ST[k], SEP, ...skillFacts(id), SEP, "§l§fO QUE FAZ", `§f${sk.desc}`,
    ...(sk.dodge ? [`§7Esquiva: §f${Math.round(sk.dodge.chance * 100)}%§7 · recarga §f${sk.dodge.cd}s§7 (Agilidade alta aumenta a chance)`] : []),
    ...(st.owned ? [] : [SEP, `§l§fREQUISITOS  ${reqBar(st.req)}`, ...st.req.map((r) => `${r.ok ? "§a✔" : "§c✘"} ${r.ok ? "§7" : "§f"}${r.text}`)])].join("\n");
  const B = [];
  if (st.ready) B.push({ text: "§l§eDESPERTAR AGORA\n§r§7conceder a habilidade", icon: "skill_" + id, run: () => { const r = agilityAwaken(player, id); say(player, `${r.ok ? "§a" : "§c"}${r.msg}`); if (!r.ok) openAgiStage(player, race, id, back); } });
  B.push({ text: "§7« Voltar à linha", icon: "back", run: () => openAgiLine(player, race, back) });
  menu(player, `§l${CLS_COL[st.cls]}${sk.name.toUpperCase()}`, body, B);
}
function openAgiLine(player, race, back) {
  const L = AGILITY_LINES[race], stages = agiStages(player, race), d = getData(player), mine = d.race === race;
  const body = [`§l${L.col}${L.name}`, `§7Agilidades Supremas · ${RACES[race]?.name ?? race}${mine ? " §a(sua raça)" : " §8(outra raça: só consulta)"}`, SEP,
    "§7Comum (Nv.10) → Única (Nv.35, raça evoluída) → Suprema (Nv.70, 3º estágio da raça, 2 chefes).", SEP, trail(stages)].join("\n");
  menu(player, `§l${L.col}${L.name.toUpperCase()}`, body, [...stages.map((s) => cardOf(s, "skill_" + s.id, () => openAgiStage(player, race, s.id, back))), { text: "§7« Agilidades Supremas", icon: "back", run: () => openAgility(player, back) }]);
}
export function openAgility(player, back) {
  const d = getData(player), races = Object.keys(AGILITY_LINES).sort((a, b) => (a === d.race ? -1 : b === d.race ? 1 : 0));
  const mine = AGILITY_LINES[d.race], ms = mine ? agiStages(player, d.race) : [];
  const body = ["§l§bAGILIDADES SUPREMAS", "§7Cada raça tem a sua linha de mobilidade: investidas, passos dimensionais, esquiva automática, arranques aéreos e aceleração sobrenatural.", SEP,
    mine ? `§fSua linha: ${mine.col}§l${mine.name}§r\n${ms.map((s) => `${CARD_COL[stateOf(s)]}${s.owned ? "●" : "○"} ${s.name}`).join("\n")}` : "§7Escolha uma raça para liberar a sua linha."].join("\n");
  menu(player, "§l§bAGILIDADES SUPREMAS", body, [...races.map((r) => { const L = AGILITY_LINES[r], st = agiStages(player, r), n = st.filter((x) => x.owned).length;
    return { text: `${L.col}§l${L.name}${r === d.race ? " §a●" : ""}\n§r§7${RACES[r]?.name ?? r} · ${n}/3${st.some((x) => x.ready) ? " §e★ pronta" : ""}`, icon: "skill_" + L.stages[0].id, run: () => openAgiLine(player, r, back) }; }),
    { text: "§7« Árvore de Poderes", icon: "back", run: () => openPowers(player, back) }]);
}

// ---------------------------------------------------------------- Linhagens dracônicas (consulta dos tiers reais)
function openLineages(player, back) {
  const d = getData(player), mine = LINEAGES[d.lineage];
  const body = ["§l§6LINHAGENS DRACÔNICAS", "§7Só para Dragonoides. Cada tier é concedido sozinho ao cumprir nível, estágio da raça e chefes.", SEP,
    ...Object.values(LINEAGES).map((L) => { const ts = tierState(d, L), own = ts.filter((t) => hasSkill(d, t.skill)).length; return `${L.color}§l${L.name}§r §7${L.title}${mine?.id === L.id ? " §a(sua)" : ""}\n§7  ${own}/${ts.length} tiers`; })].join("\n");
  menu(player, "§l§6LINHAGENS DRACÔNICAS", body, [...Object.values(LINEAGES).map((L) => ({ text: `${L.color}§l${L.name}\n§r§7${L.title}`, icon: "menu_race", run: () => {
    const ts = tierState(d, L);
    const B = ["§l" + L.color + L.name + " §7— " + L.title, `§f${L.desc}`, SEP, ...ts.map((t) => { const has = hasSkill(d, t.skill); return `${has ? "§a●" : t.ok ? "§e★" : "§8○"} §f${SKILLS[t.skill]?.name ?? t.skill}${t.stage ? ` §7(${t.stage})` : ""}\n§7  Nv.${t.lvl} · estágio ${t.depth}${t.bosses ? ` · ${t.bosses} chefes` : ""}${has ? " §a✔" : ""}`; })].join("\n");
    menu(player, `§l${L.color}${L.name.toUpperCase()}`, B, [{ text: "§7« Linhagens", icon: "back", run: () => openLineages(player, back) }]);
  } })), { text: "§7« Árvore de Poderes", icon: "back", run: () => openPowers(player, back) }]);
}

/** ÁRVORE DE PODERES: painel do jogador + categorias */
export function openPowers(player, back) {
  const d = getData(player), rows = LINES.map((l) => lineState(player, l.id));
  const owned = rows.reduce((a, S) => a + S.stages.filter((x) => x.owned).length, 0), total = rows.reduce((a, S) => a + S.stages.length, 0);
  const ready = rows.filter((S) => S.upcoming?.ready).length;
  const ag = AGILITY_LINES[d.race] ? agiStages(player, d.race) : [], agOwn = ag.filter((x) => x.owned).length;
  const body = ["§l§dÁRVORE DE PODERES", SEP,
    `§7Raça: §f${RACES[d.race]?.name ?? "—"} §7· Nível §f${d.level}`, `§7Grande Sábio: §b${stageName(sageStage(d))}`, `§7Chefes derrotados: §f${Object.values(d.bossKills ?? {}).reduce((a, b) => a + b, 0)} §7· Devorados: §f${d.devoured ?? 0}`, SEP,
    `§fLinhas de Poder  ${bar(owned, Math.max(1, total), 10, "§d")} §7${owned}/${total}`, `§fAgilidades Supremas  ${bar(agOwn, 3, 10, "§b")} §7${agOwn}/3`, ...(ready ? [`§e★ ${ready} evolução(ões) pronta(s)`] : []), SEP,
    "§a● desbloqueada  §e★ disponível  §6○ próxima  §8○ bloqueada"].join("\n");
  menu(player, "§l§5ÁRVORE DE PODERES", body, [
    { text: `§l§dLinhas de Poder\n§r§7Sábio, Predador, Veldora, Anti-Skill, Voo · ${owned}/${total}`, icon: "skill_beelzebuth", run: () => openLines(player, back) },
    { text: `§l§bAgilidades Supremas\n§r§7uma linha por raça · sua: ${agOwn}/3`, icon: AGILITY_LINES[d.race] ? "skill_" + AGILITY_LINES[d.race].stages[0].id : "menu_skills", run: () => openAgility(player, back) },
    { text: "§l§6Linhagens Dracônicas\n§r§7Veldora, Velzard, Velgrynd, Veldanava", icon: "menu_race", run: () => openLineages(player, back) },
    { text: "§l§fEvolução da Raça\n§r§7estágios, requisitos e Lord Demônio", icon: "menu_race", run: () => openRaceMenu(player) },
    { text: "§l§bGrande Sábio\n§r§7análise, conhecimento e evolução", icon: "menu_skills", run: () => openSageBook(player) },
    { text: "§7« Voltar", icon: "back", run: () => back?.() },
  ]);
}

export function startPowers() {
  system.runInterval(() => { for (const p of world.getAllPlayers()) { try { powersProgress(p); } catch { /* ignore */ } } }, 200);
  // chefes-MOB derrotados passam a contar em bossKills (progressão por "derrotar chefes"); chefes de sigilo continuam em drops.js
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const e = ev.deadEntity; if (!e || e.typeId === "minecraft:player" || !e.typeId.startsWith("etheria:")) return;
      const m = MOBS[e.typeId]; if (!m || !BOSS_RARITIES.includes(m.rar)) return;
      if (e.hasTag("etheria_minion") || BOSS_BY_TYPE[e.typeId]) return;   // sigilos: já contados em drops.js
      const key = e.typeId.slice(8), who = new Map();
      const by = ev.damageSource?.damagingEntity; if (by?.typeId === "minecraft:player" && isValid(by)) who.set(by.id, by);
      try { for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 48 })) who.set(p.id, p); } catch { /* ignore */ }
      for (const p of who.values()) { const d = getData(p); d.bossKills ??= {}; d.bossKills[key] = (d.bossKills[key] ?? 0) + 1; markDirty(p); powersProgress(p); }
    } catch { /* ignore */ }
  });
}

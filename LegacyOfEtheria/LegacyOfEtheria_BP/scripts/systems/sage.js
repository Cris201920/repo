// systems/sage.js - SÁBIO -> GRANDE SÁBIO -> RAPHAEL -> CIEL (Manas)
// Sistema vivo de suporte: análise (criaturas, itens, blocos, habilidades, magias), Enciclopédia, memória, processos paralelos,
// alertas/sugestões, comandos de chat, evoluções com requisitos configuráveis (config.js · SAGE_EVO) e identidade própria por estágio.
// Nada aqui dá itens/habilidades de graça nem age sem autorização: o jogador continua no controle.
import { world, system } from "@minecraft/server";
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, toast, playSound, removeItem, countItem, fmt, bar, isValid, healthComp } from "../core/utils.js";
import { SAGE_BASE, SAGE_EVO, SAGE_LEARN, RARITY, STAT_LABELS, AUTO_EQUIP } from "../config.js";
import { menu as baseMenu, sageThemeOf, sageMenu } from "./ui/forms.js";
import { openSkills } from "./ui/menus.js";
import { openRaceV2, openSageEvolution } from "./ui/racemenus.js";
import { MOBS } from "../data/mobs.gen.js";
import { SET_DEFS } from "../data/armor.gen.js";
import { recipeLines } from "./forge.js";
import { ITEMS } from "../data/items.gen.js";
import { BOSSES } from "../data/bosses.js";
import { SKILLS } from "../data/skills.js";
import { RACES } from "../data/races.js";
import { hasSkill } from "./skills.js";
import { EquippedSkillManager } from "./skillbar/equipped.js";
import { skillIdOfItem } from "./skillbar/registry.js";
import { masteryLevel, masteryXp, masteryNeed, MASTERY_MAX } from "./mastery.js";
import { applyDerivedStats, dropStats } from "./stats.js";
import { STOMACH_EVOLVE, BEELZEBUTH_EVOLVE } from "./predator.js";
import { openStomachUI } from "./stomach.js";
import { coreBegin, coreResult, coreFail, resistsAnalysis, sceneChant, sageEvolveScene, openCoreSettings, corePulse, coreActive } from "./sagecore.js";
import { sageSay, sageStage, sageCfg, setVoiceOpt, sysSay, setVoiceHook, sageText } from "./voice.js";
import { conditions, combine, COMBOS, awakened } from "./discovery.js";
import { inCombat } from "./combat.js";
import { CATS, kb, kcount, learn, remember, addBond, addExp, evoReq, evoReady, learnBonus, prog, stageName, setSpellHook } from "./sageknow.js";
import { playCircle, miniCircle, spellCircle, skillCircle, reactVoice, evolveSequence, frontOf, dropCircle, sageSnd } from "./sagecircle.js";
import { assessToggle, assessActive, assessState, assessLabel, assessSelect } from "./sageassess.js";
import { lockTarget, releaseTarget, isLocked, detectTarget, lockInfo, dropTarget } from "./sagetarget.js";
import { TIP_FREQ, TIP_FREQ_ORDER } from "./sagetips.js";
import { dropAssess } from "./sageassess.js";
import { dropSageSave } from "./sagesave.js";
import { emit, EV } from "../core/bus.js";
import { noteAnalysis } from "../core/metrics.js";
import { weaponLook } from "./weaponfx.js";
import { FORGE } from "../data/armor.gen.js";
import { debugReport } from "./sagedebug.js";
import { reportSelfTests } from "./sagetests.js";
import { TASKS, ELEM_NAME, weaknessOf, suggestSkill, bossThreats, taskAvailable, procResult, modOn, alert as sAlert, suggest as sSuggest, setAnalyzer, startSageProc, dropProc } from "./sageproc.js";

export const SAGE_BOOK = "etheria:sage_book";
const INS = "§8INFORMAÇÃO INSUFICIENTE";
const COL = ["§b", "§b", "§6", "§d", "§e"];
const MODS = [   // módulos do Grande Sábio (estágio mínimo; "toggle" = pode ser desligado)
  { id: "accel", n: "Aceleração do Pensamento", min: 2, d: "Análises mais rápidas, previsão de golpes fortes e cálculo de dano/distância." },
  { id: "eval", n: "Avaliação Analítica", min: 0, d: "Ficha completa da entidade: vida, fraquezas, habilidades, estado e ameaça." },
  { id: "parallel", n: "Processamento Paralelo", min: 2, d: "Vários processos internos ao mesmo tempo, sem bloquear você." },
  { id: "cancel", n: "Anulação de Canto", min: 2, d: "Reduz o dano mágico recebido (+8% / +14% / +18% de resistência mágica)." },
  { id: "creation", n: "All of Creation · Universalidade do Conhecimento", min: 2, d: "Tenta compreender fenômenos observados; sem dados suficientes: ANÁLISE INCOMPLETA." },
  { id: "analysis", n: "Análise", min: 0, d: "Analisa criaturas, itens, blocos, habilidades e magias." },
  { id: "archive", n: "Arquivo de Conhecimento", min: 0, d: "Enciclopédia e memória salvas no seu progresso." },
  { id: "strategy", n: "Suporte Estratégico", min: 2, d: "Alertas, sugestões e recomendações de combate." },
];
const AUTO = ["OBSERVAR", "SUGERIR", "AUTOMATIZAR", "EXECUTAR COM AUTORIZAÇÃO"];
const DECOR = (s) => s;
const V = {  // eventos -> sons portados do mod (efeitos; a voz é do voice.js)
  open: "etheria.sage.sfx.open", close: "etheria.sage.sfx.close", analyze: "etheria.sage.sfx.open", done: "etheria.sage.sfx.skill", fail: "etheria.sage.sfx.fail", learn: "etheria.sage.sfx.skill",
  evolve: "etheria.sage.tier.ultimate", ritual: "etheria.sage.ceremony.true_demon_lord", tier_common: "etheria.sage.tier.common", tier_unique: "etheria.sage.tier.unique", tier_ultimate: "etheria.sage.tier.ultimate",
};
export function sageVoice(player, ev) { const sg = sageCfg(getData(player)); if (sg.voice === false || sg.sfx === false) return; if (V[ev]) playSound(player, V[ev], 0.9 * sg.volume / 100, 1); }

const st = (p) => sageStage(getData(p));
/** todos os menus do Sábio usam o tema do estágio atual */
const menu = (p, t, b, B) => baseMenu(p, t, b, B, sageThemeOf(st(p)));
const head = (p) => `${COL[st(p)]}[${stageName(st(p))}]§r`;
const sayS = (p, m) => say(p, `${head(p)} §f${m}`);
const row = (label, v) => (v === undefined || v === null || v === "" ? `§7${label}: ${INS}` : `§7${label}: §f${v}`);
const back = (fn) => ({ text: "Voltar", run: fn });
const pretty = (id) => id.split(":").pop().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const sageData = (d) => { const sg = sageCfg(d); sg.archive ??= {}; return sg; };
const modEnabled = (p, id) => { const sg = sageCfg(getData(p)), m = MODS.find((x) => x.id === id); return st(p) >= (m?.min ?? 0) && modOn(sg, id); };

export function isHostile(e) { try { return e && e.typeId?.startsWith("etheria:") && !e.hasTag("etheria_ally") && (MOBS[e.typeId] || e.typeId.includes("boss_")); } catch { return false; } }
function lookTarget(player, dist = 16) {
  try { for (const h of player.getEntitiesFromViewDirection({ maxDistance: dist })) if (h.entity.typeId !== "minecraft:player") return h.entity; } catch { /* ignore */ }
  return undefined;
}
const heldItem = (p) => { try { return p.getComponent("minecraft:inventory").container.getItem(p.selectedSlotIndex); } catch { return undefined; } };

// ------------------------------------------------------------------ análise de ENTIDADES
const PHASES = ["ENTIDADE DETECTADA", "CÍRCULO SURGE", "ANÉIS GIRANDO", "RUNAS APARECEM", "INFORMAÇÕES PROCESSADAS", "DADOS ORGANIZADOS", "ANÁLISE CONCLUÍDA"];
const powerOf = (t) => { const h = healthComp(t)?.effectiveMax ?? 0; return t.typeId.includes("boss_") ? 3 : h >= 150 ? 2 : h >= 40 ? 1 : 0; };
function threatLabel(player, t) {
  const h = healthComp(t)?.effectiveMax, ph = healthComp(player)?.effectiveMax; if (!h || !ph) return undefined;
  const r = h / ph; return r < 0.5 ? "§aBAIXA" : r < 1.5 ? "§eMÉDIA" : r < 4 ? "§6ALTA" : "§c§lEXTREMA";
}
function entityInfo(player, t, entry, lb) {
  const typeId = t.typeId, m = MOBS[typeId], th = bossThreats(typeId), n = entry.n, s = st(player);
  const name = m?.name ?? th?.boss.name ?? pretty(typeId), hc = healthComp(t), hp = hc?.currentValue, mx = hc?.effectiveMax;
  let fam = []; try { fam = t.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? []; } catch { /* ignore */ }
  fam = fam.filter((f) => !["mob", "monster", "etheria_fx"].includes(f));
  let eff = []; try { eff = t.getEffects().map((e) => e.typeId.replace("minecraft:", "")); } catch { /* ignore */ }
  const w = weaknessOf(typeId), L = [`§l${name}`, `§7Análises: §f${n}`];
  L.push(row("RAÇA/FAMÍLIA", fam.length ? fam.join(", ") : undefined));
  L.push(row("NÍVEL", mx ? (mx < 20 ? "Fraco" : mx < 60 ? "Comum" : mx < 150 ? "Forte" : mx < 400 ? "Elite" : "Calamidade") + " §8(classe estimada pela vida)" : undefined));
  L.push(`§cVIDA: §f${Math.ceil(hp ?? entry.hp ?? 0)}${mx ? `/${Math.ceil(mx)}` : ""}`);
  L.push(row("ENERGIA", undefined));
  L.push(row("DEFESA", n >= 3 && th?.abilities.includes("barrier") ? "Possui barreira temporária" : undefined));
  L.push(row("ATAQUE", n >= 2 && th ? `Base ${th.boss.dmgBase} (×fase)` : undefined));
  L.push(row("RESISTÊNCIAS", n >= 2 && th?.elems.length ? `Afinidade: ${th.elems.map((e) => ELEM_NAME[e]).join(", ")}` : undefined));
  L.push(row("FRAQUEZAS CONHECIDAS", n >= 2 && w.els.length ? `${w.els.map((e) => ELEM_NAME[e]).join(", ")} §8(${w.note})` : undefined));
  L.push(row("HABILIDADES DETECTADAS", n >= 3 && th ? th.abilities.join(", ") : undefined));
  L.push(row("EFEITOS", eff.length ? eff.join(", ") : "Nenhum"));
  const pct = hp && mx ? hp / mx : 1; L.push(row("ESTADO", `${pct > 0.7 ? "Saudável" : pct > 0.3 ? "Ferido" : "Crítico"} (${Math.round(pct * 100)}%)`));
  try { L.push(row("DISTÂNCIA", `${Math.hypot(t.location.x - player.location.x, t.location.y - player.location.y, t.location.z - player.location.z).toFixed(1)} blocos`)); } catch { /* ignore */ }
  L.push(`§7AMEAÇA ESTIMADA: ${threatLabel(player, t) ?? INS}`);
  if (m && n >= 4) L.push(`§aRecompensa: §f${m.xp} XP, ${m.coins[0]}-${m.coins[1]} moedas`);
  if (m && n >= 6) L.push(`§6Drops: §f${m.drops.map((x) => pretty(x[0])).join(", ")}`);
  if (lb.adv && mx) { const atk = Math.max(1, Math.round(getData(player).level * 1.6 + 4)); L.push(`§bAnálise avançada: §f~${Math.ceil((hp ?? mx) / atk)} golpes comuns para abater`); }
  if (s >= 3 && th) L.push(`§dRaphael: §fmapa de fases = ${th.boss.phases.length}; recomendo ${th.elems.length ? `resistência a ${th.elems.map((e) => ELEM_NAME[e]).join("/")}` : "manter distância"}.`);
  if (n < 6) L.push("§8(analise mais vezes para revelar mais)");
  return L;
}

const analyzing = new Set();
let evolving = new Set();
/** Analisa uma entidade. opts: { silent } (análise rápida de combate com círculo reduzido). Aceita `true` como atalho de silent. */
export function analyze(player, target, opts = {}) {
  if (opts === true) opts = { silent: true };
  const silent = !!opts.silent, d = getData(player), sg = sageData(d), s = st(player);
  if (!target || !isValid(target)) return silent ? undefined : sageText(player, "Nenhum alvo na mira.");
  if (!modEnabled(player, "analysis")) return sageText(player, "O módulo de Análise está desligado.");
  if (analyzing.has(player.id) || evolving.has(player.id)) return;
  const typeId = target.typeId, known = !!sg.archive[typeId], lb = learnBonus(d);
  const cost = known || silent ? 0 : SAGE_BASE.mana;
  let dd = Infinity; try { dd = Math.hypot(target.location.x - player.location.x, target.location.y - player.location.y, target.location.z - player.location.z); } catch { /* ignore */ }
  if (dd > lb.range + 4) return silent ? undefined : sageText(player, `Alvo fora do alcance (${lb.range} blocos).`);
  if (d.mana < cost) return sageText(player, "Mana insuficiente para análise.");
  d.mana -= cost; analyzing.add(player.id);
  const aTick = system.currentTick, aMs = Date.now();
  try { emit(EV.SAGE_ANALYSIS_START, { player, target, silent }); } catch { /* ignore */ }
  const accel = modEnabled(player, "accel") ? 0.72 : 1, ticks = Math.max(20, Math.round(SAGE_BASE.analyzeTicks * lb.speed * accel * (s >= 3 ? 0.85 : 1)));
  const power = powerOf(target), loc = { x: target.location.x, y: target.location.y, z: target.location.z };
  if (!silent && resistsAnalysis(player, target, power)) { analyzing.delete(player.id); d.mana += cost; sageVoice(player, "fail"); coreFail(player); return; }
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true; analyzing.delete(player.id);
    if (!isValid(target)) { if (!silent) { sageSay(player, "incomplete", { cd: 0 }); sayS(player, "ANÁLISE INCOMPLETA: o alvo desapareceu."); } return; }
    let hp = 0; try { hp = target.getComponent("minecraft:health").currentValue; } catch { /* ignore */ }
    const e = sg.archive[typeId] ??= { n: 0, hp }; const before = sg.analyses;
    e.n++; e.hp = hp; sg.analyses++; addExp(player, silent ? 1 : 3);
    const isBoss = typeId.includes("boss_"), th = bossThreats(typeId);
    learn(player, isBoss ? "bosses" : "creatures", typeId, MOBS[typeId]?.name ?? th?.boss.name ?? pretty(typeId), {}, true);
    tierCheck(player, before, sg.analyses);
    if (s >= 3 && inCombat(player)) addBond(player, 1);
    markDirty(player);
    try { noteAnalysis(system.currentTick - aTick, Date.now() - aMs); emit(EV.SAGE_ANALYSIS_DONE, { player, target, typeId, silent, ticks: system.currentTick - aTick }); } catch { /* ignore */ }
    if (silent) { const w = weaknessOf(typeId), sk = suggestSkill(player, w.els); if (sk && s >= 3) { try { player.onScreenDisplay.setActionBar(`§d[${stageName(s)}] §fFraco a ${w.els.map((x) => ELEM_NAME[x]).join("/")} §7→ §e${sk.name}`); } catch { /* ignore */ } } return; }
    sageVoice(player, e.n === 1 ? "tier_unique" : "done");
    sageSay(player, "an_done", { cd: 0 });
    if (e.n === 1) { sageSay(player, "ds_added"); sageSay(player, "an_registered"); } else { if (e.n >= 2) sageSay(player, "an_resist"); if (e.n >= 3) sageSay(player, "an_extra"); if (e.n >= 4) sageSay(player, "an_detail"); }
    if (s >= 4 && Math.random() < 0.35) sageSay(player, "ci_pleased");
    const L = entityInfo(player, target, e, lb), w = weaknessOf(typeId), sk = e.n >= 2 ? suggestSkill(player, w.els) : null;
    if (sk) { L.push(`§bSugestão: §f${sk.name}${sk.slot >= 0 ? ` (slot ${sk.slot + 1})` : ""}`); sSuggest(player, "weak." + typeId, `Alvo vulnerável: use ${sk.name}.`, { cd: 3000, quiet: true, action: sk.slot >= 0 ? { type: "cast", id: sk.id } : null }); }
    say(player, `${COL[s]}§l[${stageName(s)}]§r\n${L.join("\n")}`);
    try { coreResult(player, L.map((x) => x.replace(/§./g, "").toUpperCase()).filter((x) => x && !x.startsWith("(")).slice(0, 6), { known: e.n > 1 }); } catch { /* ignore */ }
    saveNow(player);
  };
  if (silent) { if (s >= 1 && inCombat(player)) miniCircle(player, loc, { size: 1.6 + power * 0.4 }); system.runTimeout(finish, 12); return; }
  sageVoice(player, "analyze"); sageSay(player, known ? "an_start" : "an_unknown", { cd: 0 }); sageSay(player, "an_progress");
  coreBegin(player, "ANALISANDO...");
  const ui = system.runInterval(() => {
    const k = Math.min(1, (system.currentTick - t0) / ticks), idx = Math.min(PHASES.length - 1, Math.floor(k * (PHASES.length - 1)));
    try { player.onScreenDisplay.setActionBar(`${COL[s]}[${stageName(s).toUpperCase()}] §8» §f${PHASES[idx]} ${bar(Math.round(k * ticks), ticks, 10, COL[s])}`); } catch { /* ignore */ }
    if (k >= 1 || finished) system.clearRun(ui);
  }, 2); const t0 = system.currentTick;
  const c = playCircle(player, loc, { kind: "analysis", power, dur: ticks, size: 2.4 + power * 0.7, onDone: finish });
  if (!c) system.runTimeout(finish, ticks);   // fx desligado / círculo já ativo
}
function tierCheck(player, before, now) {
  for (const t of SAGE_LEARN) if (before < t.at && now >= t.at) { sageSay(player, "learn_tier", { cd: 0 }); sayS(player, `§aAprendizado por uso: ${t.text}.`); remember(player, "learn", t.text); }
}

// ------------------------------------------------------------------ análise de ITENS e BLOCOS
function classify(typeId, inf) {
  if (inf?.kind === "weapon" || /sword|axe|bow|staff|scythe|spear|dagger|club|grimoire|scepter|blade|fang|halberd|trident/.test(typeId)) return "weapons";
  if (/ingot|core|fragment|ore|dust|gem|crystal|shard|scale|ear|tusk|fang|essence|thread|silk|bone|leather|stick|coal|diamond|emerald|quartz/.test(typeId)) return "materials";
  return "items";
}
// ---- análise de ARMAS e ARMADURAS: durabilidade, dano/defesa, elemento, padrão de golpe, material, proprietário, restrições, evolução, conjunto
const WTYPE = { sword: "Espada", katana: "Katana", axe: "Machado", staff: "Cajado", bow: "Arco", dagger: "Adaga", spear: "Lança", scythe: "Foice", club: "Clava", halberd: "Alabarda", scepter: "Cetro", grimoire: "Grimório" };
const SLOT_NAME = { Head: "Capacete", Chest: "Peitoral", Legs: "Calça", Feet: "Botas" };
const PATTERN = { slash: "Corte", embers: "Brasas", rift: "Fenda", light: "Luz", shadow: "Sombra", pierce: "Perfuração", crush: "Esmagamento", reap: "Colheita", iai: "Iai (saque rápido)", wind: "Vento", dragon: "Dragão", holyfire: "Fogo sagrado", quake: "Tremor", death: "Morte", soul: "Alma", card: "Carta", exterm: "Extermínio", ashen: "Cinzas" };
const MATERIAL = [[/dragotite_abyss/, "Dragotite do Abismo"], [/dragotite_earth/, "Dragotite da Terra"], [/dragotite_frost/, "Dragotite Glacial"], [/dragotite_scorch/, "Dragotite Escaldante"], [/dragotite_storm/, "Dragotite da Tempestade"], [/dragotite_star/, "Dragotite Estelar"],
  [/dragotite/, "Dragotite"], [/obsidian/, "Obsidiana"], [/amethyst/, "Ametista"], [/resonarium/, "Resonarium"], [/neptunium/, "Netúnio"], [/warden/, "Essência do Warden"], [/infused_iron|iron/, "Ferro"], [/celestial/, "Cristal Celestial"], [/void/, "Fragmento do Vazio"]];
const SUBTYPE = [[/great_sword|claymore/, "Montante (espada grande)"], [/katana/, "Katana"], [/long_sword/, "Espada longa"], [/short_sword/, "Espada curta"], [/dagger/, "Adaga"], [/rapier/, "Florete"], [/blade/, "Lâmina"]];
const OWNER = { rimuru_sword: "Rimuru Tempest", rimuru_katana: "Rimuru Tempest" };   // só donos canônicos CERTOS; o resto não é inventado
const durLine = (it) => { try { const du = it.getComponent("minecraft:durability"); if (du && du.maxDurability > 0) { const left = du.maxDurability - du.damage; return `${left}/${du.maxDurability} (${Math.round(left * 100 / du.maxDurability)}%)`; } } catch { /* sem componente */ } return undefined; };
/** Linhas extras de equipamento (armas e armaduras). `it` pode ser undefined (só os dados do item). */
export function gearLines(player, it, inf) {
  const id = it?.typeId ?? inf.id, short = id.replace("etheria:", ""), L = [], atk = inf.stats?.atk, look = inf.kind === "weapon" ? weaponLook(id) : null, mat = MATERIAL.find(([re]) => re.test(short));
  L.push(row("DURABILIDADE", it ? durLine(it) : undefined), row("MATERIAL (pelo item)", mat?.[1]));
  if (inf.kind === "weapon") {
    L.push(row("TIPO", SUBTYPE.find(([re]) => re.test(short))?.[1] ?? WTYPE[inf.wtype] ?? inf.wtype), row("DANO", atk ? `${atk} de ataque${inf.stats.crit ? ` · crítico +${inf.stats.crit}%` : ""}` : undefined));
    L.push(row("ELEMENTO", look ? (ELEM_NAME[look.el] ?? look.el) : undefined));
  } else {
    L.push(row("PEÇA", SLOT_NAME[inf.slot] ?? inf.slot), row("DEFESA", inf.protection !== undefined ? `${inf.protection} de proteção · ${inf.stats?.defense ?? 0} de defesa` : undefined));
    const sd = inf.set && SET_DEFS[inf.set]; L.push(row("RESISTÊNCIA / ELEMENTO", sd?.el ? ELEM_NAME[sd.el] ?? sd.el : undefined), row("HABILIDADE PASSIVA", sd?.ptext || undefined));
  }
  L.push(row("PROPRIETÁRIO", `${OWNER[short] ?? "sem dono registrado"} · portador: ${player.name}`), row("RESTRIÇÕES", "nenhuma de nível ou raça (o addon não impõe)"));
  const up = FORGE.filter((r) => r.kind === "upgrade" && r.mats.some((m) => m[0] === id)).map((r) => ITEMS[r.result]?.name ?? r.result);
  L.push(row("EVOLUÇÃO (Forja)", up.length ? up.slice(0, 3).join(", ") : undefined));
  const special = inf.kind === "weapon" && (["legendary", "mythic", "divine"].includes(inf.rarity) || inf.boss);   // espada especial: análise especial
  if (special) L.push("§6§lANÁLISE ESPECIAL§r", row("PADRÃO DE GOLPE", look ? PATTERN[look.pat] ?? look.pat : undefined), row("GOLPE PESADO", "4º golpe encadeado"), row("REAÇÃO", "habilidades do mesmo elemento intensificam o efeito da arma"));
  return L;
}
/** Analisa TODO o equipamento vestido (mão, capacete, peitoral, calça, botas) e o bônus do conjunto. */
export function analyzeGear(player) {
  const eq = player.getComponent("minecraft:equippable"), L = ["§l§bEQUIPAMENTO"], sets = {};
  for (const slot of ["Mainhand", "Head", "Chest", "Legs", "Feet"]) {
    let it; try { it = eq?.getEquipment(slot); } catch { /* ignore */ }
    const inf = it && ITEMS[it.typeId]; if (!it) { L.push(`§7${slot === "Mainhand" ? "Mão" : SLOT_NAME[slot]}: §8vazio`); continue; }
    L.push(`§7${slot === "Mainhand" ? "Mão" : SLOT_NAME[slot]}: §f${inf?.name ?? pretty(it.typeId)}${inf?.rarity ? ` ${RARITY[inf.rarity]?.color ?? ""}(${RARITY[inf.rarity]?.name ?? inf.rarity})` : ""} §8${durLine(it) ?? ""}`);
    if (inf?.kind === "armor" && inf.set) sets[inf.set] = (sets[inf.set] ?? 0) + 1;
    try { learn(player, inf?.kind === "armor" ? "armor" : inf?.kind === "weapon" ? "weapons" : "items", it.typeId, inf?.name ?? pretty(it.typeId), {}, true); } catch { /* ignore */ }
  }
  for (const [k, n] of Object.entries(sets)) { const sd = SET_DEFS[k]; if (!sd) continue; const b = [2, 3, 4].filter((q) => n >= q).map((q) => sd.b[q]?.text).filter(Boolean); L.push(`§bConjunto ${sd.name}: §f${n}/4 §7${b.length ? b.join("; ") : "sem bônus ainda"}${n >= 4 && sd.ptext ? `\n§8Passiva: ${sd.ptext}` : ""}`); }
  say(player, `${COL[st(player)]}§l[${stageName(st(player))}]§r\n${L.join("\n")}`);
}
function itemLines(player, it) {
  const typeId = it.typeId, inf = ITEMS[typeId], L = [`§l${inf?.name ?? pretty(typeId)}`];
  const cat = classify(typeId, inf);
  L.push(row("MATERIAL", inf ? ({ weapon: "Arma", armor: "Armadura", accessory: "Acessório", consumable: "Consumível", material: "Material" }[inf.kind] ?? inf.kind) + (inf.wtype ? ` (${inf.wtype})` : "") : cat === "materials" ? "Material de criação" : undefined));
  L.push(row("RARIDADE", inf?.rarity ? `${RARITY[inf.rarity]?.color ?? ""}${RARITY[inf.rarity]?.name ?? inf.rarity}` : undefined));
  const stats = Object.entries(inf?.stats ?? {}).map(([k, v]) => `${STAT_LABELS[k] ?? k} ${v > 0 ? "+" : ""}${v}`);
  L.push(row("PROPRIEDADES", stats.length ? stats.join(", ") : undefined));
  const eff = []; if (inf?.onHit?.name) eff.push(`${inf.onHit.name} (${Math.round((inf.onHit.chance ?? 0.2) * 100)}%)`); if (inf?.set) eff.push(`Conjunto: ${SET_DEFS[inf.set]?.name ?? inf.set}`); if (inf?.heal) eff.push(`Cura ${inf.heal}`); if (inf?.mana) eff.push(`Mana ${inf.mana}`);
  L.push(row("EFEITOS", eff.length ? eff.join(", ") : undefined));
  { const sd = inf?.set && SET_DEFS[inf.set]; if (sd) L.push(row("BÔNUS DE CONJUNTO", `(2) ${sd.b[2].text}; (3) ${sd.b[3].text}; (4) ${sd.b[4].text}${sd.ptext ? "; Passiva: " + sd.ptext : ""}`)); }
  const src = Object.entries(MOBS).filter(([, m]) => m.drops.some((x) => x[0] === typeId)).map(([, m]) => m.name);
  L.push(row("ORIGEM", src.length ? `Drop de ${src.slice(0, 4).join(", ")}` : undefined));
  L.push(row("USOS", inf ? (inf.kind === "weapon" ? "Equipar na mão (forja até +10)" : inf.kind === "armor" ? "Equipar no corpo (forja até +10)" : inf.kind === "consumable" ? "Usar (consumível)" : "Ingrediente") : undefined));
  { const rl = recipeLines(player, typeId); L.push(row("RECEITAS RELACIONADAS", rl.length ? rl.join("; ") : undefined)); }
  L.push(row("VALOR", inf?.price ? `${fmt(inf.price)} moedas (venda ${fmt(inf.sell ?? 0)})` : undefined));
  L.push(row("COMPATIBILIDADES", inf?.kind === "weapon" ? "Efeitos de arma reagem a habilidades do mesmo elemento" : undefined));
  if (inf?.kind === "weapon" || inf?.kind === "armor") L.push(...gearLines(player, it, inf));
  return { L, cat, name: inf?.name ?? pretty(typeId) };
}
export function analyzeItem(player) {
  const d = getData(player), s = st(player);
  if (!modEnabled(player, "analysis")) return sageText(player, "O módulo de Análise está desligado.");
  const it = heldItem(player);
  if (!it) { try { const b = player.getBlockFromViewDirection({ maxDistance: 8 })?.block; if (b) return analyzeBlock(player, b); } catch { /* ignore */ } return sayS(player, "Segure um item ou mire em um bloco para analisar."); }
  { const sid = skillIdOfItem(it.typeId); if (sid !== null && SKILLS[sid]) return analyzeSkill(player, sid); }   // item de habilidade da hotbar: analisa a HABILIDADE
  if (analyzing.has(player.id)) return; analyzing.add(player.id);
  sageSay(player, "it_start", { cd: 0 }); sageVoice(player, "analyze"); coreBegin(player, "ANALISANDO ESTRUTURA...", "ANALYZING", "ITEM DETECTADO.");
  const { L, cat, name } = itemLines(player, it), inf = ITEMS[it.typeId];
  const colr = ({ common: "white", uncommon: "green", rare: "water", epic: "violet", legendary: "gold", mythic: "fire", divine: "holy" })[inf?.rarity ?? "common"] ?? "sage";
  skillCircle(player, colr, { dur: 44, onDone: () => {
    analyzing.delete(player.id); const r = learn(player, cat, it.typeId, name, {}, true); sg0(player).analyses++; addExp(player, 1); markDirty(player);
    sageSay(player, r.isNew ? "it_done" : "an_done", { cd: 0 }); say(player, `${COL[s]}§l[${stageName(s)}]§r\n${L.join("\n")}`);
    if (r.isNew) sageSay(player, "ds_added"); saveNow(player);
    try { coreResult(player, L.map((x) => x.replace(/§./g, "").toUpperCase()).filter((x) => x && !x.endsWith(": —")).slice(0, 6), { known: !r.isNew }); } catch { /* ignore */ }
  } });
}
const sg0 = (p) => sageCfg(getData(p));
export function analyzeBlock(player, b) {
  const s = st(player); let tags = []; try { tags = b.getTags?.() ?? []; } catch { /* ignore */ }
  const L = [`§l${pretty(b.typeId)}`, row("MATERIAL", tags.find((t) => ["stone", "wood", "dirt", "sand", "metal", "plant", "diamond_pick_diggable"].includes(t)) ?? undefined), row("PROPRIEDADES", tags.length ? tags.slice(0, 6).join(", ") : undefined),
    row("LÍQUIDO", b.isLiquid ? "Sim" : "Não"), row("EFEITOS", undefined), row("USOS", undefined), row("VALOR", undefined)];
  if (analyzing.has(player.id)) return; analyzing.add(player.id); sageSay(player, "it_start", { cd: 0 });
  skillCircle(player, "earth", { dur: 36, onDone: () => { analyzing.delete(player.id); const r = learn(player, "blocks", b.typeId, pretty(b.typeId), {}, true); sg0(player).analyses++; addExp(player, 1); markDirty(player); sageSay(player, r.isNew ? "it_done" : "an_done", { cd: 0 }); say(player, `${COL[s]}§l[${stageName(s)}]§r\n${L.join("\n")}`); } });
}

// ------------------------------------------------------------------ análise de HABILIDADES e MAGIAS
function evolutionsOf(id) { return Object.values(SKILLS).filter((x) => x.req?.includes(id)).map((x) => x.name); }
export function skillLines(player, id) {
  const d = getData(player), sk = SKILLS[id]; if (!sk) return ["§cHabilidade desconhecida."];
  const lv = masteryLevel(player, id), cmb = COMBOS.filter((c) => c.from.includes(id)), L = [`§l${sk.name}`];
  L.push(row("CATEGORIA", sk.cat), row("RARIDADE", sk.rarity ? `${RARITY[sk.rarity]?.color ?? ""}${RARITY[sk.rarity]?.name ?? sk.rarity}` : undefined));
  L.push(row("NÍVEL / MASTERY", hasSkill(d, id) ? `Req. Nv.${sk.level ?? 1} · Maestria ${lv}/${MASTERY_MAX}${awakened(d, id) ? " §6(Despertada)" : ""}` : `Req. Nv.${sk.level ?? 1}`));
  L.push(row("CUSTO", sk.type === "active" ? `${sk.mana} mana${sk.stamina ? ` · ${sk.stamina} stamina` : ""}` : sk.trigger ? `Passiva · ${sk.mana} mana ao disparar` : "Passiva"), row("COOLDOWN", sk.type === "active" || sk.trigger ? `${sk.cd}s` : undefined));
  const eff = []; if (sk.element) eff.push(ELEM_NAME[sk.element] ?? sk.element); if (sk.exec?.kind) eff.push(sk.exec.kind); if (sk.exec?.power) eff.push(`poder ×${sk.exec.power}`);
  for (const [k, v] of Object.entries(sk.stats ?? {})) eff.push(`${STAT_LABELS[k] ?? k} ${v > 0 ? "+" : ""}${v}`);
  L.push(row("EFEITOS", eff.length ? eff.join(", ") : undefined));
  const rq = []; if (sk.req?.length) rq.push(...sk.req.map((r) => SKILLS[r]?.name ?? r)); if (sk.unlock) rq.push(...conditions(d, id).map((c) => `${c.ok ? "✔" : "✘"} ${c.text}`)); if (sk.unlock?.combine) rq.push("Combinação de habilidades");
  L.push(row("REQUISITOS", rq.length ? rq.join("; ") : sk.sp ? `${sk.sp} ponto(s) de habilidade` : undefined));
  const ev = evolutionsOf(id); if (sk.cat === "Única") ev.push("Despertar (maestria 10)");
  L.push(row("EVOLUÇÃO POSSÍVEL", ev.length ? ev.join(", ") : undefined));
  const compat = [...new Set(cmb.flatMap((c) => c.from.filter((k) => k !== id).map((k) => SKILLS[k]?.name ?? k)))];
  L.push(row("COMPATÍVEIS", compat.length ? compat.join(", ") : undefined), row("COMBINAÇÕES", cmb.length ? cmb.map((c) => `→ ${SKILLS[c.id]?.name}`).join(", ") : undefined));
  return L;
}
export function analyzeSkill(player, id) {
  const s = st(player), sk = SKILLS[id]; if (!sk) return;
  if (!modEnabled(player, "analysis")) return sageText(player, "O módulo de Análise está desligado.");
  if (analyzing.has(player.id)) return; analyzing.add(player.id); sageSay(player, "sk_start", { cd: 0 }); coreBegin(player, "PROCESSANDO ESTRUTURA...", "PROCESSING", "HABILIDADE DETECTADA.");
  skillCircle(player, sk.element ?? "sage", { dur: 52, onDone: () => {
    analyzing.delete(player.id); const r = learn(player, sk.cat === "Magia" ? "magic" : "skills", id, sk.name, {}, true); sg0(player).analyses++; addExp(player, 2); markDirty(player);
    sageSay(player, "sk_done", { cd: 0 }); try { coreResult(player, [sk.name.toUpperCase(), "HABILIDADE REGISTRADA."], { known: !r.isNew }); } catch { /* ignore */ } say(player, `${COL[s]}§l[${stageName(s)}]§r\n${skillLines(player, id).join("\n")}\n§8Armazenado no banco de conhecimento.`); if (r.isNew) sageSay(player, "ds_added");
  } });
}
const FORM = { projectile: "Projétil", target_aoe: "Área no alvo", aoe_self: "Área ao redor", cone: "Cone", beam: "Raio contínuo", chain: "Corrente", heal: "Cura", buff: "Aprimoramento", dash: "Investida", teleport: "Teletransporte", summon: "Invocação" };
export function spellLines(player, id, caster) {
  const sk = SKILLS[id], ex = sk.exec ?? {}, same = Object.values(SKILLS).filter((x) => x.id !== id && x.element === sk.element && x.type === "active" && x.exec?.kind !== ex.kind).slice(0, 3).map((x) => x.name);
  return [`§l${sk.name}`, row("ELEMENTO", sk.element ? ELEM_NAME[sk.element] ?? sk.element : undefined), row("ESTRUTURA", ex.kind), row("POTÊNCIA", ex.power ? `×${ex.power}${ex.stat ? ` (escala com ${ex.stat})` : ""}` : undefined),
    row("ALCANCE", ex.range ? `${ex.range} blocos` : undefined), row("FORMA", FORM[ex.kind] ?? ex.kind), row("ENERGIA", sk.mana ? `${sk.mana} mana` : undefined),
    row("EFEITOS", (ex.burn || ex.slow || ex.stun || sk.effects) ? "Efeito de status associado" : undefined), row("POSSÍVEIS VARIAÇÕES", same.length ? same.join(", ") : undefined)];
}
const chantAt = new Map();
/** Observação de magia (própria ou de outro conjurador): captura no centro do círculo e decomposição em camadas. */
function onSpell(player, id, caster) {
  const d = getData(player), sg = sageCfg(d), sk = SKILLS[id], s = st(player);
  if (!sk || sk.type !== "active" || s < 1) return;
  if (!modEnabled(player, "analysis")) return;
  const magic = sk.cat === "Magia" || sk.cat === "Única" || ["arcane", "fire", "ice", "lightning", "void", "light", "shadow", "water", "wind", "earth", "blood"].includes(sk.element);
  if (!magic) return;
  if (s >= 2 && modEnabled(player, "cancel") && sk.cat === "Magia" && (chantAt.get(player.id + id) ?? 0) < Date.now() - 240000) { chantAt.set(player.id + id, Date.now()); sceneChant(player, sk.name); }
  sg.obs ??= {}; const key = "sp." + id; sg.obs[key] = (sg.obs[key] ?? 0) + 1;
  if (sg.obs[key] > 3 || analyzing.has(player.id) || evolving.has(player.id)) return;
  const need = 2, n = sg.obs[key]; analyzing.add(player.id);
  sageSay(player, "sp_start", { cd: 0 }); coreBegin(player, "NOVA ESTRUTURA MÁGICA DETECTADA.", "PROCESSING", "ANÁLISE DE MAGIA");
  spellCircle(player, player.location, sk.element ?? "arcane", { dur: n >= need ? 80 : 56, onDone: () => {
    analyzing.delete(player.id);
    if (n < need) { sageSay(player, "incomplete", { cd: 0 }); try { player.onScreenDisplay.setActionBar(`${COL[s]}ANÁLISE INCOMPLETA §8(${n}/${need}) §7— observe de novo para registrar`); } catch { /* ignore */ } return; }
    const r = learn(player, "magic", id, sk.name, { spell: true }, true); sg.analyses++; addExp(player, 4); markDirty(player);
    sageSay(player, "sp_done", { cd: 0 }); try { coreResult(player, [sk.name.toUpperCase(), `ELEMENTO: ${(ELEM_NAME[sk.element] ?? "—").toUpperCase()}`, `CUSTO: ${sk.mana ?? 0} MANA`], { known: !r.isNew }); } catch { /* ignore */ } say(player, `${COL[s]}§l[${stageName(s)}]§r\n${spellLines(player, id, caster).join("\n")}\n§bANÁLISE CONCLUÍDA.`); if (r.isNew) sageSay(player, "ds_added");
  } });
}
setSpellHook(onSpell);

// ------------------------------------------------------------------ evolução do Sábio
const TO_FLAG = { 2: "gs", 3: "raphael", 4: "ciel" };
export function startEvolution(player, to) {
  const d = getData(player), sg = sageData(d), cur = st(player);
  if (evolving.has(player.id)) return; if ((to === 2 && cur >= 2) || (to === 3 && (cur !== 2)) || (to === 4 && cur !== 3)) return sayS(player, "Evolução indisponível neste estágio.");
  if (!evoReady(player, to)) return sayS(player, "Os requisitos ainda não foram cumpridos.");
  if (to === 3) { const cfg = SAGE_EVO.raph; if (!removeItem(player, cfg.item, cfg.n)) return; d.coins -= cfg.coins; }
  evolving.add(player.id); markDirty(player); try { sageEvolveScene(player, to); } catch { /* ignore */ } sageVoice(player, "ritual"); sageSay(player, "evo_proc", { cd: 0, force: true });
  try { emit(EV.SAGE_EVOLUTION_START, { player, to }); } catch { /* ignore */ }
  evolveSequence(player, to, () => {
    sg[TO_FLAG[to]] = true; const nm = stageName(to); evolving.delete(player.id);
    try { emit(EV.SAGE_STAGE_CHANGED, { player, from: cur, to }); emit(EV.SAGE_EVOLUTION_DONE, { player, from: cur, to }); } catch { /* ignore */ }
    for (const t of [nm]) if (!d.titles.includes(t)) d.titles.push(t);
    dropStats(player.id); applyDerivedStats(player); sageVoice(player, "evolve");
    sageSay(player, `stage_${to}`, { cd: 0, force: true }); toast(player, `${COL[to]}§l${nm.toUpperCase()}`, to === 4 ? "§7Manas · consciência desperta" : to === 3 ? "§7Evolução a Ultimate Skill" : "§7Nova interface liberada");
    say(player, `${COL[to]}§l[${nm}] §r§fEvolução concluída. ${to === 2 ? "Novos módulos: Aceleração, Processamento Paralelo, Anulação de Canto, All of Creation e Suporte Estratégico." : to === 3 ? "Otimização, Síntese, Previsão, Gerenciamento e Análise Avançada. Autonomia configurável." : "Conversação, Personalidade, Memória Avançada, Decisões, Preferências e Cooperação."}`);
    learn(player, "evolutions", `sage_${to}`, `Sábio → ${nm}`, {}, true); remember(player, "evo", `Evolução: ${nm}`); addExp(player, 30); if (to === 4) addBond(player, 10);
    saveNow(player);
  });
}

// ------------------------------------------------------------------ MENUS
function bars(player) {
  const p = prog(player), b = (v, c) => bar(Math.round(v * 20), 20, 10, c);
  return `§7SABEDORIA ${b(p.wisdom, "§d")}\n§7ANÁLISE ${b(p.analysis, "§b")}\n§7CONHECIMENTO ${b(p.knowledge, "§a")}\n§7MASTERY ${b(p.mastery, "§6")}\n§7PROCESSAMENTO ${b(p.processing, "§3")}\n§7EXPERIÊNCIA ${b(p.exp, "§e")} §8Nv.${p.lvl}`;
}
/** 6.58b: tela principal do Grande Sábio igual ao vídeo (opções em volta do icosaedro). A lista completa continua em "MAIS…". */
export function openSage(player) {
  const s = st(player); sageVoice(player, "open");
  let tod = 6000; try { tod = world.getTimeOfDay(); } catch { /* ignore */ }
  const hello = tod < 6000 || tod >= 23000 ? "Bom dia." : tod < 12000 ? "Boa tarde." : "Boa noite.";
  const name = ["SÁBIO", "SÁBIO", "GRANDE SÁBIO", "RAPHAEL", "CIEL"][s];
  // 7.x: atalhos para as telas do hospedeiro (Raça, Habilidades, Evolução); Observações, Alocação e Crescimento do Sábio ficam em MAIS…
  sageMenu(player, name, hello, [
    { label: "CONFIGURAÇÕES", run: () => openVoice(player) },
    { label: "ANALISAR", run: () => openAnalysis(player) },
    { label: "HABILIDADES", run: () => openSkills(player) },
    { label: "EVOLUÇÃO", run: () => openSageEvolution(player, () => openSage(player)) },
    { label: "REGISTROS", run: () => openEncyclopedia(player) },
    { label: "RAÇA", run: () => openRaceV2(player, () => openSage(player)) },
    { label: "MODO DE BATALHA", run: () => openBattleMode(player) },
    { label: "MAIS…", run: () => openSageFull(player) },
  ]);
}
function openObservations(player) {
  menu(player, "§l§aOBSERVAÇÕES", "§7O que o Sábio observou e mantém em processamento.", [
    { text: "§lCRIATURAS", icon: "menu_quests", run: () => openCategory(player, "creatures") },
    { text: "§lITENS\n§r§8arma na mão · estômago do Predador", icon: "menu_inventory", run: () => openItems(player) },
    { text: "§lEQUIPAMENTO", icon: "menu_inventory", run: () => analyzeGear(player) },
    { text: "§lPROCESSOS", icon: "menu_status", run: () => openProcesses(player) },
    { text: "§lMEMÓRIA", icon: "menu_quests", run: () => openMemory(player) },
    { text: "§lSUGESTÕES", icon: "menu_status", run: () => openTips(player) },
    back(() => openSage(player))]);
}
function openBattleMode(player) {
  menu(player, "§l§cMODO DE BATALHA", "§7Percepção de combate e alvo.", [
    { text: `§lMODO ASSESS\n§r§8${assessActive(player) ? `§a${assessLabel(assessState(player))}§8 · toque para sair` : "percepção ampliada · auras · filtro"}`, icon: "menu_skills", run: () => assessToggle(player) },
    { text: `§lALVO\n§r§8${isLocked(player) ? `travado: §f${lockInfo(player)?.name ?? "?"}§8 · toque para soltar` : "travar o alvo da mira"}`, icon: "menu_skills", run: () => { if (isLocked(player)) releaseTarget(player); else lockTarget(player); } },
    { text: "§lMAGIAS", icon: "menu_skills", run: () => openSkillsMenu(player, true) },
    back(() => openSage(player))]);
}
export function openSageFull(player) {
  const d = getData(player), sg = sageData(d), s = st(player);
  const t = `${COL[s]}§l${["SÁBIO", "SÁBIO", "GRANDE SÁBIO", "RAPHAEL, REI DA SABEDORIA", "CIEL"][s]}`;
  const B = [
    { text: "§lANÁLISE\n§r§8criaturas · itens · blocos · habilidades · magias", icon: "menu_skills", run: () => openAnalysis(player) },
    { text: "§lCONHECIMENTO\n§r§8Enciclopédia do Grande Sábio", icon: "menu_quests", run: () => openEncyclopedia(player) },
    { text: "§lHABILIDADES", icon: "menu_skills", run: () => openSkillsMenu(player, false) },
    { text: "§lMAGIAS", icon: "menu_skills", run: () => openSkillsMenu(player, true) },
    { text: "§lCRIATURAS", icon: "menu_quests", run: () => openCategory(player, "creatures") },
    { text: "§lITENS\n§r§8arma na mão · estômago do Predador", icon: "menu_inventory", run: () => openItems(player) },
    { text: "§lEQUIPAMENTO\n§r§8arma, armadura e bônus de conjunto", icon: "menu_inventory", run: () => analyzeGear(player) },
    { text: "§lCRESCIMENTO DO SÁBIO\n§r§8Sábio → Grande Sábio → Raphael → Ciel", icon: "menu_race", run: () => openEvolution(player) },
    { text: "§lOBSERVAÇÕES", icon: "menu_quests", run: () => openObservations(player) },
    { text: `§lMODO ASSESS\n§r§8${assessActive(player) ? `§a${assessLabel(assessState(player))}§8 · toque para sair` : "percepção ampliada · auras · filtro"}`, icon: "menu_skills", run: () => assessToggle(player) },
    { text: `§lALVO\n§r§8${isLocked(player) ? `travado: §f${lockInfo(player)?.name ?? "?"}§8 · toque para soltar` : "travar o alvo da mira"}`, icon: "menu_skills", run: () => { if (isLocked(player)) releaseTarget(player); else lockTarget(player); } },
    { text: "§lPROCESSOS", icon: "menu_status", run: () => openProcesses(player) },
    { text: "§lMEMÓRIA", icon: "menu_quests", run: () => openMemory(player) },
    { text: "§lSUGESTÕES", icon: "menu_status", run: () => openTips(player) },
    { text: "§lNÚCLEO\n§r§8interface viva · animações · partículas · demonstrações", icon: "menu_settings", run: () => openCoreSettings(player, () => openSage(player)) },
    { text: `§lCONFIGURAÇÕES\n§r§8voz ${sg.voice === false ? "desligada" : "ligada"} · ${sg.volume}%`, icon: "menu_settings", run: () => openVoice(player) },
  ];
  if (s >= 3) B.push({ text: "§lOTIMIZAÇÃO", icon: "menu_skills", run: () => openOptimize(player) }, { text: "§lSÍNTESE", icon: "menu_skills", run: () => openCombine(player) }, { text: "§lPREVISÃO", icon: "menu_status", run: () => openPredict(player) },
    { text: "§lGERENCIAMENTO\n§r§8conjunto recomendado de habilidades", icon: "menu_skills", run: () => openManage(player) }, { text: "§lANÁLISE AVANÇADA", icon: "menu_skills", run: () => openAdvanced(player) });
  if (s >= 4) B.push({ text: "§lCONVERSAÇÃO", icon: "menu_quests", run: () => openTalk(player) }, { text: "§lPERSONALIDADE", icon: "menu_race", run: () => openPersonality(player) }, { text: "§lMEMÓRIA AVANÇADA", icon: "menu_quests", run: () => openMemory(player, true) },
    { text: "§lDECISÕES", icon: "menu_status", run: () => openDecisions(player) }, { text: "§lPREFERÊNCIAS", icon: "menu_settings", run: () => openPrefs(player) }, { text: "§lCOOPERAÇÃO", icon: "menu_settings", run: () => openAuto(player) });
  B.push(back(() => openSage(player)));
  menu(player, t, `${bars(player)}\n\n§7Análises: §f${sg.analyses}  §7Registros: §f${kcount(d)}`, B);
}
function openAnalysis(player) {
  const B = [
    { text: "§lAlvo na mira\n§r§8(8 mana; gratuito se já arquivado)", icon: "menu_skills", run: () => analyze(player, lookTarget(player)) },
    { text: "§lItem na mão / bloco na mira", icon: "menu_inventory", run: () => analyzeItem(player) },
    { text: "§lHabilidade…", icon: "menu_skills", run: () => openSkillsMenu(player, false) },
    { text: "§lMagia…", icon: "menu_skills", run: () => openSkillsMenu(player, true) },
    back(() => openSage(player))];
  menu(player, "§l§bANÁLISE", "§7Escolha o que analisar. As análises aumentam o conhecimento e liberam melhorias por uso.", B);
}
function openEncyclopedia(player) {
  const d = getData(player), k = kb(d);
  menu(player, "§l§aENCICLOPÉDIA DO GRANDE SÁBIO", `§7Tudo o que você descobriu fica registrado.\n§7Total de registros: §f${kcount(d)}`, CATS.map(([id, name]) => ({ text: `§l${name}\n§r§8${Object.keys(k[id]).length} registro(s)`, icon: "menu_quests", run: () => openCategory(player, id) })).concat([back(() => openSage(player))]));
}
function openCategory(player, cat) {
  const d = getData(player), k = kb(d)[cat], name = CATS.find((c) => c[0] === cat)[1], ids = Object.keys(k);
  if (!ids.length) return menu(player, `§l§a${name.toUpperCase()}`, "§7Nada registrado ainda.", [back(() => openEncyclopedia(player))]);
  menu(player, `§l§a${name.toUpperCase()}`, "§7Escolha uma entrada:", ids.slice(0, 40).map((id) => ({ text: `${k[id].name ?? pretty(id)} §8x${k[id].n}`, run: () => openEntry(player, cat, id) })).concat([back(() => openEncyclopedia(player))]));
}
function openEntry(player, cat, id) {
  const d = getData(player), sg = sageData(d), e = kb(d)[cat][id]; let body;
  if (cat === "creatures" || cat === "bosses") body = infoLines(id, sg.archive[id] ?? { n: e.n }).join("\n");
  else if ((cat === "skills" || cat === "magic") && SKILLS[id]) body = (cat === "magic" && e.spell ? spellLines(player, id, player) : skillLines(player, id)).join("\n");
  else if (ITEMS[id]) body = itemLines(player, { typeId: id }).L.join("\n");
  else body = `§l${e.name}\n§7Registrado ${e.n}x.`;
  menu(player, `§l§a${e.name ?? pretty(id)}`, body, [back(() => openCategory(player, cat))]);
}
function infoLines(typeId, entry) {
  const m = MOBS[typeId], th = bossThreats(typeId), n = entry.n, w = weaknessOf(typeId), L = [`§l${m?.name ?? th?.boss.name ?? pretty(typeId)}`, `§7Análises: §f${n}`, `§cVida: §f${Math.ceil(entry.hp ?? 0)}${m ? `/${m.hp}` : ""}`];
  L.push(row("FRAQUEZAS CONHECIDAS", n >= 2 && w.els.length ? w.els.map((e) => ELEM_NAME[e]).join(", ") : undefined)); if (n >= 2) L.push(`§7${w.note}`);
  if (th) L.push(row("HABILIDADES DETECTADAS", n >= 3 ? th.abilities.join(", ") : undefined));
  if (n >= 4 && m) L.push(`§aRecompensa: §f${m.xp} XP, ${m.coins[0]}-${m.coins[1]} moedas`);
  if (n >= 6 && m) L.push(`§6Drops: §f${m.drops.map((x) => pretty(x[0])).join(", ")}`);
  return L;
}
function openSkillsMenu(player, magic) {
  const d = getData(player), ids = d.unlockedSkills.filter((id) => SKILLS[id] && (magic ? SKILLS[id].cat === "Magia" : SKILLS[id].cat !== "Magia"));
  const B = ids.slice(0, 40).map((id) => ({ text: `${SKILLS[id].name}\n§r§8Maestria ${masteryLevel(player, id)}/${MASTERY_MAX}${awakened(d, id) ? " ★" : ""}`, icon: `skill_${id}`, run: () => (magic ? analyzeSpellKnown(player, id) : analyzeSkill(player, id)) }));
  B.push({ text: "§lMaestria das Habilidades", run: () => openMastery(player) }, { text: "§lHabilidades Únicas\n§r§8(condições de descoberta)", run: () => openUniques(player) }, back(() => openSage(player)));
  menu(player, magic ? "§l§5MAGIAS" : "§l§bHABILIDADES", ids.length ? "§7Toque para analisar." : "§7Nenhuma disponível.", B);
}
function analyzeSpellKnown(player, id) { const sg = sageCfg(getData(player)); sg.obs ??= {}; sg.obs["sp." + id] = Math.max(sg.obs["sp." + id] ?? 0, 1); onSpell(player, id, player); }
function openItems(player) {
  menu(player, "§l§bITENS", "§7Analise o item da sua mão ou o bloco na mira.", [{ text: "§lAnalisar item/bloco", icon: "menu_inventory", run: () => analyzeItem(player) }, { text: "§lArmas registradas", run: () => openCategory(player, "weapons") },
    { text: "§lMateriais registrados", run: () => openCategory(player, "materials") }, { text: "§lItens registrados", run: () => openCategory(player, "items") }, { text: "§lEstômago (Predador)", icon: "menu_inventory", run: () => openStomach(player) }, back(() => openSage(player))]);
}
function openMastery(player) {
  const d = getData(player), ids = Object.keys(d.mastery ?? {});
  const body = ids.length ? ids.map((id) => { const lv = masteryLevel(player, id), xp = masteryXp(player, id); return `§f${SKILLS[id]?.name ?? id} §dNv.${lv}/${MASTERY_MAX} §8(${xp}${lv < MASTERY_MAX ? `/${masteryNeed(lv)}` : ""}) §7+${lv * 5}% poder`; }).join("\n") : "§7Use habilidades para ganhar maestria.";
  menu(player, "§l§bMAESTRIA", body, [back(() => openSkillsMenu(player, false))]);
}
function openUniques(player) {
  const d = getData(player), ids = Object.keys(SKILLS).filter((i) => SKILLS[i].cat === "Única" && SKILLS[i].unlock);
  const lines = ids.map((id) => { const sk = SKILLS[id], has = hasSkill(d, id), cond = conditions(d, id), done = cond.filter((c) => c.ok).length, aw = awakened(d, id) ? " §6★" : ""; return has ? `§a✔ §f${sk.name}${aw}` : COMBOS.some((c) => c.id === id) ? `§8? §7${sk.name} §8(por combinação)` : `§7${done}/${cond.length} §8${sk.name}`; });
  menu(player, "§l§dHABILIDADES ÚNICAS", "§7Únicas são descobertas ao cumprir condições, não compradas.\n§7★ = Despertada\n\n" + lines.join("\n"), [back(() => openSkillsMenu(player, false))]);
}
function openCombine(player) {
  const d = getData(player);
  menu(player, "§l§bSÍNTESE / COMBINAR", "§7Combine habilidades de maestria 3+ para formar uma Única superior. Somente combinações com lógica.", COMBOS.map((cb) => {
    const has = hasSkill(d, cb.id), ok = cb.from.every((k) => hasSkill(d, k) && masteryLevel(player, k) >= cb.mastery);
    return { text: `${has ? "§a✔ " : ok ? "§e" : "§8"}${SKILLS[cb.id].name}\n§r§8${cb.from.map((k) => SKILLS[k].name).join(" + ")}`, icon: "menu_skills", run: () => { const r = has ? { ok: false, msg: "Já possui." } : combine(player, cb.id); say(player, r.ok ? `${head(player)} §f${r.msg}` : `§c${r.msg}`); } };
  }).concat([back(() => openSage(player))]));
}
function openStomach(player) {   // 6.55: Estômago completo (systems/stomach.js): criaturas, itens, materiais, análise, processamento, histórico
  sysSay(player, "inv", "stomach");
  openStomachUI(player, () => openItems(player));
}
function openTips(player) {
  const d = getData(player), sg = sageData(d), tips = [];
  if (d.skillPoints > 0) tips.push(`§bVocê tem ${d.skillPoints} ponto(s) de habilidade para gastar.`);
  if (d.attributePoints > 0) tips.push(`§aVocê tem ${d.attributePoints} ponto(s) de atributo.`);
  if (!d.equippedSkills.length) tips.push("§eEquipe habilidades no Tomo para lançá-las com um toque.");
  const t = lookTarget(player); if (t) { const w = weaknessOf(t.typeId), sk = suggestSkill(player, w.els); tips.push(`§dAlvo: ${w.note}${sk ? ` → use §e${sk.name}` : ""}`); }
  for (const x of (sg.sug ?? []).slice(0, 5)) tips.push(`§b✦ §f${x.text}`);
  if (!tips.length) tips.push("§7Sem sugestões no momento. Continue explorando.");
  menu(player, "§l§bSUGESTÕES", tips.join("\n\n") + `\n\n§8Autonomia: §f${AUTO[sg.auto ?? 1]}`, [back(() => openSage(player))]);
}
function openMemory(player, adv = false) {
  const sg = sageCfg(getData(player)), mem = (sg.mem ?? []).slice().reverse(), T = { boss: "§c", evo: "§d", know: "§a", learn: "§b", death: "§8", ach: "§6", quest: "§e", place: "§3", item: "§5", level: "§a" };   // 6.54: + conquistas, missões, lugares, itens, níveis
  const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - (t ?? Date.now())) / 60000)); return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };
  const body = mem.length ? mem.slice(0, adv ? 25 : 15).map((m) => `${T[m.type] ?? "§7"}• §f${m.text} §8${ago(m.t)}`).join("\n") : "§7Ainda não há memórias.";
  menu(player, adv ? "§l§eMEMÓRIA AVANÇADA" : "§l§bMEMÓRIA", body + (adv ? `\n\n§7Padrões: §f${patternSummary(player)}` : ""), [back(() => openSage(player))]);
}
function patternSummary(player) {
  const d = getData(player), top = Object.entries(d.mastery ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => SKILLS[k]?.name ?? k);
  const els = {}; for (const id of d.unlockedSkills) { const e = SKILLS[id]?.element; if (e) els[e] = (els[e] ?? 0) + 1; } const fav = Object.entries(els).sort((a, b) => b[1] - a[1])[0];
  return `${top.length ? `mais usadas: ${top.join(", ")}` : "sem habilidades dominadas"}${fav ? ` · afinidade: ${ELEM_NAME[fav[0]]}` : ""}`;
}
function openProcesses(player) {
  const sg = sageData(getData(player)), s = st(player), res = procResult(player);
  const mods = MODS.map((m) => `${s >= m.min ? (modOn(sg, m.id) ? "§a●" : "§c○") : "§8🔒"} §f${m.n}${s >= m.min ? "" : ` §8(${stageName(m.min)})`}`).join("\n");
  const tasks = TASKS.map((t, i) => `${taskAvailable(sg, s, t) ? "§a▶" : "§8■"} §7PROCESSO ${i + 1} §f${t.name}§8: ${taskAvailable(sg, s, t) ? `§7${res[t.id] ?? "aguardando"}` : `§8(${stageName(t.min)})`}`).join("\n");
  menu(player, "§l§3PROCESSOS", `§7Processos ativos em paralelo (não bloqueiam você):\n${tasks}\n\n§7Módulos:\n${mods}`, [{ text: "§lLigar/desligar módulos", icon: "menu_settings", run: () => openModules(player) }, back(() => openSage(player))]);
}
function openModules(player) {
  const sg = sageData(getData(player)), s = st(player);
  menu(player, "§l§3MÓDULOS", "§7Toque para ligar ou desligar.", MODS.filter((m) => s >= m.min).map((m) => ({ text: `${modOn(sg, m.id) ? "§a●" : "§c○"} §l${m.n}\n§r§8${m.d.slice(0, 60)}`, icon: "menu_settings", run: () => { sg.mods[m.id] = !modOn(sg, m.id); markDirty(player); dropStats(player.id); applyDerivedStats(player); openModules(player); } })).concat([back(() => openProcesses(player))]));
}
function openEvolution(player) {
  const d = getData(player), sg = sageData(d), s = st(player), to = s >= 4 ? 0 : s >= 3 ? 4 : s >= 2 ? 3 : 2;
  const near = Object.keys(d.mastery ?? {}).filter((id) => SKILLS[id]?.cat === "Única" && !awakened(d, id) && masteryLevel(player, id) >= 7).map((id) => `§f${SKILLS[id].name} §7Nv.${masteryLevel(player, id)}/10 → despertar`);
  const cmb = COMBOS.filter((c) => !hasSkill(d, c.id) && c.from.some((k) => hasSkill(d, k))).map((c) => `§7${c.from.map((k) => SKILLS[k]?.name ?? k).join(" + ")} → §f${SKILLS[c.id].name}`);
  let body = `§7Estágio atual: ${COL[s]}§l${stageName(s)}§r\n§7Linha: §fSábio → Grande Sábio → Raphael (Rei da Sabedoria) → Ciel (Manas)\n`;
  const B = [];
  if (to) {
    const rq = evoReq(player, to), ok = rq.every((r) => r.ok);
    body += `\n§lRequisitos para ${stageName(to)}§r\n` + rq.map((r) => `${r.ok ? "§a✔" : "§c✘"} §f${r.text} §8[${r.tag}]`).join("\n");
    B.push({ text: ok ? `§a§lIniciar evolução → ${stageName(to)}` : "§8Requisitos pendentes", icon: "menu_race", run: () => { if (ok) startEvolution(player, to); else { sageVoice(player, "fail"); sageSay(player, "evo_insuf"); openEvolution(player); } } });
  } else body += "\n§6Estágio máximo alcançado: Ciel.";
  body += `\n\n§lÁrvore de evolução de habilidades§r\n${near.length ? near.join("\n") : "§8Nenhuma Única perto do despertar."}\n${cmb.length ? cmb.slice(0, 4).join("\n") : "§8Nenhuma combinação em andamento."}`;
  body += `\n\n§8[CANÔNICO] = vem da obra · [ADAPTAÇÃO] = criado para este addon`;
  B.push(back(() => openSage(player)));
  menu(player, "§l§dEVOLUÇÃO", body, B);
}
const onoff = (v) => (v ? "§aLIGADO" : "§cDESLIGADO");
const UI_MODES = [["discreet", "Discreta"], ["normal", "Normal"], ["full", "Completa"]];
function openVoice(player) {
  const sg = sageCfg(getData(player)), s = st(player), again = () => openVoice(player), flip = (k, def = true) => { sg[k] = (sg[k] ?? def) === false; markDirty(player); again(); };
  const vol = (v) => { setVoiceOpt(player, "volume", Math.max(0, Math.min(100, v))); again(); };
  const uiI = Math.max(0, UI_MODES.findIndex((m) => m[0] === (sg.ui ?? "normal"))), tf = TIP_FREQ[sg.tipFreq] ?? TIP_FREQ.normal;
  menu(player, "§l§bCONFIGURAÇÕES", `§7Estágio da voz: §f${stageName(s)}\n§7A voz, o som e o círculo ficam mais sofisticados a cada estágio.\n§7Efeitos visuais do jogo: Núcleo → Partículas (Extremo/Ultra/Alto/Médio/Reduzido).\n§8Tudo é salvo no seu personagem (memória do Sábio, versão ${sg.sv ?? 1}).`, [
    { text: `§lVoz: ${sg.voice === false ? "§cDESATIVADA" : "§aATIVADA"}`, icon: "menu_settings", run: () => { setVoiceOpt(player, "voice", sg.voice === false); again(); } },
    { text: `§lVolume: §f${sg.volume}%\n§r§8toque para +20% (volta a 0 após 100%)`, icon: "menu_settings", run: () => vol(sg.volume >= 100 ? 0 : sg.volume + 20) },
    { text: `§lSábio discreto: ${onoff(sg.quiet !== false)}\n§r§8só aparece em evolução de raça e novas habilidades`, icon: "menu_settings", run: () => { setVoiceOpt(player, "quiet", sg.quiet === false); again(); } },
    { text: `§lEfeitos sonoros do Sábio: ${sg.sfx === false ? "§cDESATIVADOS" : "§aATIVADOS"}`, icon: "menu_settings", run: () => { setVoiceOpt(player, "sfx", sg.sfx === false); again(); } },
    { text: `§lPartículas do Sábio (auras e destaques): ${onoff(sg.parts !== false)}`, icon: "menu_settings", run: () => flip("parts") },
    { text: `§lAnimações do núcleo: ${onoff(sg.anim !== false)}`, icon: "menu_settings", run: () => flip("anim") },
    { text: `§lModo cinematográfico: ${onoff(!!sg.cinematic)}\n§r§8cenas mais longas e solenes`, icon: "menu_settings", run: () => flip("cinematic", false) },
    { text: `§lDicas contextuais: ${onoff(sg.tips !== false)}\n§r§8avisos críticos continuam sempre`, icon: "menu_settings", run: () => flip("tips") },
    { text: `§lFrequência dos avisos: §f${tf.label}\n§r§8toque para alternar`, icon: "menu_settings", run: () => { sg.tipFreq = TIP_FREQ_ORDER[(TIP_FREQ_ORDER.indexOf(sg.tipFreq ?? "normal") + 1) % TIP_FREQ_ORDER.length]; markDirty(player); again(); } },
    { text: `§lAnálise (módulo): ${onoff(modOn(sg, "analysis"))}`, icon: "menu_settings", run: () => { sg.mods ??= {}; sg.mods.analysis = !modOn(sg, "analysis"); markDirty(player); again(); } },
    { text: `§lInterface: §f${UI_MODES[uiI][1]}\n§r§8discreta mostra só avisos importantes`, icon: "menu_settings", run: () => { sg.ui = UI_MODES[(uiI + 1) % UI_MODES.length][0]; markDirty(player); again(); } },
    { text: `§lModo desempenho: ${onoff(!!sg.perf)}\n§r§8menos varreduras, auras e filtro desligados`, icon: "menu_settings", run: () => flip("perf", false) },
    { text: `§lLegendas: ${sg.subs === false ? "§cDESATIVADAS" : "§aATIVADAS"}`, icon: "menu_settings", run: () => { setVoiceOpt(player, "subs", sg.subs === false); again(); } },
    { text: `§8Modo debug (técnico): ${onoff(!!sg.debug)}`, icon: "menu_settings", run: () => { sg.debug = !sg.debug; markDirty(player); again(); } },
    ...(sg.debug ? [{ text: "§8Relatório de debug (chat)", icon: "menu_status", run: () => { for (const l of debugReport(player)) say(player, l); } }, { text: "§8Testes automáticos do Sábio (chat)", icon: "menu_status", run: () => { reportSelfTests(player); } }] : []),
    { text: "§8Testar voz e círculo", icon: "menu_skills", run: () => { sageSay(player, "boot", { cd: 0, force: true }); const f = frontOf(player, 3, 0); playCircle(player, { x: player.location.x, y: player.location.y, z: player.location.z }, { kind: "idle", dur: 50, power: 1, size: 3 }); again(); } },
    back(() => openSage(player))]);
}
// ---- Raphael
function openOptimize(player) {
  const d = getData(player), act = d.unlockedSkills.filter((id) => SKILLS[id]?.type === "active"), eq = d.equippedSkills, lines = [];
  const dup = {}; for (const id of eq) { const e = SKILLS[id]?.element; if (e) dup[e] = (dup[e] ?? 0) + 1; }
  for (const [e, n] of Object.entries(dup)) if (n >= 3) lines.push(`§e• ${n} habilidades equipadas de ${ELEM_NAME[e]}: diversifique elementos contra resistências.`);
  const miss = ["fire", "ice", "lightning"].filter((e) => !eq.some((id) => SKILLS[id]?.element === e) && act.some((id) => SKILLS[id].element === e)); if (miss.length) lines.push(`§e• Você possui habilidades de ${miss.map((e) => ELEM_NAME[e]).join("/")} fora dos slots.`);
  const unused = act.filter((id) => !(d.mastery?.[id] > 0)).length; if (unused) lines.push(`§e• ${unused} habilidade(s) ativa(s) nunca usada(s): ganhe maestria nelas.`);
  const syn = COMBOS.filter((c) => !hasSkill(d, c.id) && c.from.every((k) => hasSkill(d, k))); for (const c of syn) lines.push(`§b• Sinergia: ${c.from.map((k) => SKILLS[k].name).join(" + ")} → ${SKILLS[c.id].name} (maestria ${c.mastery}).`);
  sageSay(player, lines.length ? "rf_synergy" : "rf_optimize", { cd: 0 });
  menu(player, "§l§dOTIMIZAÇÃO", lines.length ? lines.join("\n") : "§aSuas habilidades já estão bem organizadas.", [back(() => openSage(player))]);
}
function openPredict(player) {
  const d = getData(player), L = [];
  for (const id of Object.keys(d.mastery ?? {})) { const sk = SKILLS[id]; if (!sk) continue; const lv = masteryLevel(player, id); if (lv < MASTERY_MAX) { const left = masteryNeed(lv) - masteryXp(player, id); L.push([left, `§f${sk.name} §7→ maestria ${lv + 1} em ~${Math.max(1, Math.ceil(left / (sk.cat === "Única" ? 3 : 1)))} uso(s)`]); } }
  L.sort((a, b) => a[0] - b[0]); const lines = L.slice(0, 6).map((x) => x[1]);
  sageSay(player, "rf_predict", { cd: 0 });
  menu(player, "§l§dPREVISÃO", (lines.length ? lines.join("\n") : "§7Sem dados suficientes.") + `\n\n§7Próxima evolução do Sábio: §f${st(player) >= 4 ? "—" : stageName(st(player) >= 3 ? 4 : st(player) >= 2 ? 3 : 2)}`, [back(() => openSage(player))]);
}
function openManage(player) {
  const d = getData(player), pool = d.unlockedSkills.filter((id) => SKILLS[id]?.type === "active");
  const score = (id) => masteryLevel(player, id) * 2 + ({ common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, divine: 7 }[SKILLS[id].rarity] ?? 1);
  const picked = [], els = new Set(); for (const id of pool.slice().sort((a, b) => score(b) - score(a))) { if (picked.length >= AUTO_EQUIP) break; const e = SKILLS[id].element ?? id; if (els.has(e) && pool.length > AUTO_EQUIP * 1.5) continue; els.add(e); picked.push(id); }
  menu(player, "§l§dGERENCIAMENTO", `§7Conjunto recomendado (variedade de elementos + maestria):\n${picked.map((id, i) => `§f${i + 1}. ${SKILLS[id].name}`).join("\n") || "§7—"}\n\n§8Nada é alterado sem a sua escolha.`, [
    { text: picked.length ? "§aEquipar conjunto recomendado" : "§8Nada a aplicar", run: () => {
      if (!picked.length) return;
      let n = 0, why = "";   // só equipa o que falta; não guarda nada que o jogador já tenha equipado e não desloca itens da hotbar
      for (const id of picked) { if (d.equippedSkills.includes(id)) continue; const r = EquippedSkillManager.equip(player, id); if (r.ok) n++; else { why = r.msg; break; } }
      sayS(player, n ? `${n} habilidade(s) equipada(s) na hotbar.` : (why || "O conjunto recomendado já está equipado.")); addBond(player, 1); sageSay(player, "rf_optimize", { cd: 0 });
    } }, back(() => openSage(player))]);
}
function openAdvanced(player) {
  const t = lookTarget(player, 24); if (!t) return menu(player, "§l§dANÁLISE AVANÇADA", "§7Mire em uma criatura.", [back(() => openSage(player))]);
  const sg = sageData(getData(player)), e = sg.archive[t.typeId] ?? { n: 0 }; const L = entityInfo(player, t, { ...e, n: Math.max(e.n, 6) }, { ...learnBonus(getData(player)), adv: true });
  menu(player, "§l§dANÁLISE AVANÇADA", L.join("\n"), [back(() => openSage(player))]);
}
function openAuto(player) {
  const sg = sageData(getData(player)), s = st(player), max = s >= 3 ? 3 : 1;
  menu(player, "§l§bAUTONOMIA", `§7Quanto o ${stageName(s)} pode agir. O controle é sempre seu.\n§7Atual: §f${AUTO[sg.auto ?? 1]}\n§8OBSERVAR: só alertas · SUGERIR: dicas · AUTOMATIZAR: análise automática · EXECUTAR: pergunta antes de agir.`,
    AUTO.slice(0, max + 1).map((n, i) => ({ text: `${(sg.auto ?? 1) === i ? "§a● " : "§7○ "}${n}`, icon: "menu_settings", run: () => { sg.auto = i; markDirty(player); sageSay(player, "rf_auto", { cd: 0 }); openAuto(player); } })).concat([back(() => (s >= 4 ? openSage(player) : openVoice(player)))]));
}
// ---- Ciel
const TOPICS = [["recommend", "Quais são suas recomendações?"], ["status", "Como estamos?"], ["learned", "O que você aprendeu?"], ["memory", "Do que você se lembra?"], ["feel", "Como você está se sentindo?"]];
export function cielReply(player, topic) {
  const d = getData(player), sg = sageData(d), h = healthComp(player), frac = h ? h.currentValue / h.effectiveMax : 1;
  switch (topic) {
    case "recommend": { const s = (sg.sug ?? []).slice(0, 3).map((x) => x.text); return s.length ? `Minhas recomendações: ${s.join(" ")}` : frac < 0.5 ? "Recomendo recuperar sua vida antes de qualquer outra coisa." : "Nada urgente. Sugiro continuar explorando e treinando a habilidade que você menos usou."; }
    case "status": return `Estamos no nível ${d.level}, com ${sg.analyses} análises e ${kcount(d)} registros. Nosso vínculo está em ${sg.bond ?? 0}.`;
    case "learned": { const k = (sg.mem ?? []).filter((m) => m.type === "know" || m.type === "learn").slice(-3).map((m) => m.text); return k.length ? `Aprendi recentemente: ${k.join("; ")}.` : "Ainda estou observando. Mostre-me algo novo."; }
    case "memory": { const b = (sg.mem ?? []).filter((m) => m.type === "boss").slice(-1)[0]; return b ? `Eu me lembro: ${b.text}. Foi uma luta que me ensinou muito.` : (sg.mem?.length ? `Minha memória mais recente: ${sg.mem[sg.mem.length - 1].text}.` : "Ainda não tenho memórias suficientes. Vamos criar algumas."); }
    case "feel": return frac < 0.35 ? "Estou preocupada com você. Sua integridade está baixa." : inCombat(player) ? "Concentrada. Estou monitorando tudo." : "Tranquila. Fico bem quando você está seguro.";
    default: return "Estou aqui.";
  }
}
function openTalk(player) {
  menu(player, "§l§eCONVERSAÇÃO", "§7Fale com Ciel. Você também pode escrever no chat: §fCiel, ...", TOPICS.map(([id, t]) => ({ text: t, icon: "menu_quests", run: () => { const r = cielReply(player, id); sageSay(player, id === "feel" ? "ci_greet" : "ci_pleased", { cd: 0 }); menu(player, "§l§eCIEL", `§f${r}`, [back(() => openTalk(player))]); } })).concat([back(() => openSage(player))]));
}
function personality(player) {
  const d = getData(player), sg = sageData(d), t = [];
  if (sg.analyses >= 50) t.push("Curiosa"); if ((sg.bond ?? 0) >= 40) t.push("Leal"); if (Object.values(d.bossKills ?? {}).reduce((a, b) => a + b, 0) >= 5) t.push("Corajosa");
  if ((sg.dec ?? []).filter((x) => x.ok).length >= 3) t.push("Cooperativa"); if ((d.stat?.hurt ?? 0) >= 50) t.push("Protetora"); return t.length ? t : ["Atenta"];
}
function openPersonality(player) {
  const sg = sageData(getData(player)), mood = (() => { const h = healthComp(player); return h && h.currentValue / h.effectiveMax < 0.35 ? "Preocupada" : inCombat(player) ? "Concentrada" : "Serena"; })();
  menu(player, "§l§ePERSONALIDADE", `§7Traços: §f${personality(player).join(", ")}\n§7Humor: §f${mood}\n§7Vínculo: §f${sg.bond ?? 0}\n§7Estilo: §f${["Silenciosa", "Normal", "Comunicativa"][sg.chat ?? 1]}\n\n§8Os traços surgem do que fazemos juntos.`, [back(() => openSage(player))]);
}
function openDecisions(player) {
  const sg = sageData(getData(player)); const L = (sg.dec ?? []).slice(0, 12).map((x) => `${x.ok ? "§a✔" : "§c✘"} §f${x.text}`);
  menu(player, "§l§eDECISÕES", L.length ? L.join("\n") : "§7Nenhuma decisão registrada. Use Cooperação → EXECUTAR COM AUTORIZAÇÃO.", [back(() => openSage(player))]);
}
function openPrefs(player) {
  const sg = sageData(getData(player)), n = ["Silenciosa", "Normal", "Comunicativa"];
  menu(player, "§l§ePREFERÊNCIAS", `§7Frequência de fala espontânea: §f${n[sg.chat ?? 1]}`, [{ text: `§lFrequência: ${n[sg.chat ?? 1]}`, icon: "menu_settings", run: () => { sg.chat = ((sg.chat ?? 1) + 1) % 3; markDirty(player); openPrefs(player); } }, { text: "Voz e efeitos", run: () => openVoice(player) }, back(() => openSage(player))]);
}

// ------------------------------------------------------------------ comandos de chat (texto livre dirigido ao Sábio)
const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const NAMES = [["grande sabio", 2], ["raphael", 3], ["rafael", 3], ["ciel", 4], ["sabio", 0]];
const FAQ = [[/(como|o que).*(evolu)/, "Abra o Livro → EVOLUÇÃO: lá estão os requisitos do próximo estágio."], [/mana/, "Mana é a energia das habilidades e magias; regenera com o tempo e com Inteligência."],
  [/maestria|mastery/, "Cada uso de uma habilidade dá maestria. No nível 10, Únicas despertam."], [/unica|unique/, "Habilidades Únicas são descobertas por condições (veja Habilidades → Únicas) ou por combinação."],
  [/ajuda|comandos/, "Experimente: \"Sábio, analise.\" · \"explique\" · \"quais são minhas opções?\" · \"existe uma evolução?\" · \"analise esta habilidade\"."]];
function handleChat(p, msg) {
  const m = norm(msg); let name = null, rest = "";
  for (const [n, min] of NAMES) { const r = new RegExp(`^${n}\\b[\\s,:!.;-]*(.*)$`).exec(m); if (r) { name = [n, min]; rest = r[1]; break; } }
  if (!name) return false; const s = st(p);
  if (s < name[1]) { say(p, `§7[Sistema] ${name[0] === "grande sabio" ? "O Grande Sábio" : name[0] === "ciel" ? "Ciel" : "Raphael"} ainda não despertou.`); return true; }
  sageSay(p, "cmd_ok", { cd: 600 });
  const has = (re) => re.test(rest), tgt = () => lookTarget(p, learnBonus(getData(p)).range);
  if (has(/crescimento|evolu\w* (do |de )?(sabio|voce|sua)/)) return openEvolution(p), true;
  if (has(/evolu/) && !has(/habilidade/)) return openSageEvolution(p, () => openSage(p)), true;
  if (has(/\bra(c|ç)a/)) return openRaceV2(p, () => openSage(p)), true;
  if (has(/habilidade|skill/) && !has(/analis/)) return openSkills(p), true;
  if (has(/opco|menu|quais sao minhas/)) return openSage(p), true;
  if (has(/otimiz/) && s >= 3) return openOptimize(p), true;
  if (has(/assess|escane|percep/)) return assessToggle(p), true;
  if (has(/trav(ar|a)|fixar|focar/)) { lockTarget(p, tgt()); return true; }
  if (has(/solt(ar|e)|liberar/)) { if (!releaseTarget(p)) sayS(p, "Nenhum alvo travado."); return true; }
  if (has(/analis/)) {
    if (has(/habilidade|skill/)) return openSkillsMenu(p, false), true; if (has(/magia/)) return openSkillsMenu(p, true), true;
    if (has(/item|arma|espada|bloco/)) return analyzeItem(p), true;
    const t = tgt(); if (t) analyze(p, t); else if (heldItem(p)) analyzeItem(p); else sayS(p, "Não há alvo na mira. Mire em uma criatura ou segure um item."); return true;
  }
  if (has(/explic/)) { const t = tgt(); if (t) analyze(p, t); else if (heldItem(p)) analyzeItem(p); else sayS(p, FAQ.find(([re]) => re.test(rest))?.[1] ?? "Mire em algo ou segure um item e peça: \"explique\"."); return true; }
  if (has(/recomend|sugest|sugira/)) { if (s >= 4) say(p, `§e[Ciel] §f${cielReply(p, "recommend")}`); else openTips(p); return true; }
  if (has(/memoria|lembra/)) { if (s >= 4) say(p, `§e[Ciel] §f${cielReply(p, "memory")}`); else openMemory(p); return true; }
  if (s >= 4 && has(/oi|ola|bom dia|boa noite|boa tarde|tudo bem|como (voce )?(esta|vai)|obrigad/)) { say(p, `§e[Ciel] §f${has(/obrigad/) ? "Fico feliz em poder ajudar." : cielReply(p, "feel")}`); sageSay(p, has(/obrigad/) ? "ci_thanks" : "ci_greet", { cd: 0 }); return true; }
  const faq = FAQ.find(([re]) => re.test(rest)); if (faq) { sayS(p, faq[1]); return true; }
  sageSay(p, "cmd_unknown", { cd: 0 }); sayS(p, "Comando não reconhecido. Diga \"ajuda\"."); return true;
}

// ------------------------------------------------------------------ eventos e laço
export function startSage() {
  setAnalyzer(analyze); startSageProc(); setVoiceHook((p, i) => { reactVoice(p, i); try { if (coreActive(p)) corePulse(p, 0.8); } catch { /* ignore */ } });
  world.afterEvents.itemUse.subscribe((ev) => {
    if (ev.itemStack?.typeId !== SAGE_BOOK) return;
    const p = ev.source;
    system.run(() => {
      if (assessActive(p)) { if (!assessSelect(p)) assessToggle(p); return; }     // no Modo Assess: o Livro seleciona o alvo da mira (ou sai do modo)
      return p.isSneaking ? analyze(p, lookTarget(p, learnBonus(getData(p)).range)) : openSage(p);
    });
  });
  // O evento de chat NÃO existe no @minecraft/server 1.17.0 estável (só em beta): detecta antes de assinar, senão a inicialização inteira cai.
  // Alternativa estável: /scriptevent etheria:sabio <texto>   (ex.: /scriptevent etheria:sabio analisar)
  const chatSig = world.beforeEvents?.chatSend;
  if (chatSig && typeof chatSig.subscribe === "function") {
    chatSig.subscribe((ev) => {
      const msg = ev.message; if (!msg || msg.startsWith("!")) return;
      const p = ev.sender; system.run(() => { try { handleChat(p, msg); } catch (e) { console.warn(`[Etheria] chat sábio: ${e}`); } });
    });
  }
  try {
    system.afterEvents.scriptEventReceive.subscribe((ev) => {
      if (ev.id !== "etheria:sabio" && ev.id !== "etheria:sage") return;
      const p = ev.sourceEntity; if (!p || p.typeId !== "minecraft:player") return;
      const txt = (ev.message ?? "").trim(); if (!txt) return;
      try { if (!handleChat(p, /^(grande sabio|raphael|rafael|ciel|sabio)\b/i.test(norm(txt)) ? txt : "sabio " + txt)) sageText(p, "Não entendi."); } catch (e) { console.warn(`[Etheria] scriptevent sábio: ${e}`); }
    });
  } catch (e) { console.warn(`[Etheria] scriptevent indisponível: ${e}`); }
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const dead = ev.deadEntity, src = ev.damageSource?.damagingEntity;
      if (dead?.typeId === "minecraft:player") { remember(dead, "death", "Você caiu em combate"); return; }
      if (src?.typeId === "minecraft:player" && dead?.typeId?.includes("boss_")) {
        const th = bossThreats(dead.typeId), nm = th?.boss.name ?? pretty(dead.typeId); learn(src, "bosses", dead.typeId, nm, {}, true); remember(src, "boss", `Derrotou ${nm}`); addBond(src, 3); addExp(src, 15);
        if (st(src) >= 4 && sageCfg(getData(src)).chat !== 0) sageSay(src, "ci_proud", { cd: 6000 });
      }
    } catch { /* ignore */ }
  });
  system.runInterval(() => {            // raças, evoluções, fenômenos (barato: 1x a cada 5 s)
    for (const p of world.getAllPlayers()) {
      try {
        const d = getData(p), sg = sageCfg(d), s = st(p);
        const r = RACES[d.race]; if (r) learn(p, "races", d.race, r.name, {}, true); if (d.raceStage && r?.stages?.[d.raceStage]) learn(p, "evolutions", `race_${d.raceStage}`, `Raça: ${r.stages[d.raceStage].name ?? d.raceStage}`, {}, true);
        if (s >= 2 && modEnabled(p, "creation")) {
          const tod = world.getTimeOfDay(), ph = tod < 1000 ? "Amanhecer" : tod >= 12000 && tod < 13000 ? "Anoitecer" : tod >= 17000 && tod < 19000 ? "Meia-noite" : null, dim = p.dimension.id.replace("minecraft:", "");
          sg.obs ??= {};
          for (const [id, name] of [[ph && "time_" + ph, ph && `Fenômeno: ${ph}`], [dim !== "overworld" && "dim_" + dim, dim !== "overworld" && `Dimensão: ${pretty(dim)}`]]) {
            if (!id) continue; sg.obs[id] = (sg.obs[id] ?? 0) + 1; if (sg.obs[id] === 2) { learn(p, "phenomena", id, name); } else if (sg.obs[id] === 1) { try { p.onScreenDisplay.setActionBar(`${COL[s]}${name}: ANÁLISE INCOMPLETA`); } catch { /* ignore */ } }
          }
        }
      } catch { /* ignore */ }
    }
  }, 100);
}
export const dropSage = (id) => { evolving.delete(id); analyzing.delete(id); dropCircle(id); dropProc(id); dropTarget(id); dropAssess(id); dropSageSave(id); };

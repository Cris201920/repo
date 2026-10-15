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
import { menu } from "./ui/forms.js";
import { say, toast, isValid } from "../core/utils.js";

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
const mark = (s) => (s.owned ? "§a[x]" : s.next ? (s.ready ? "§e[!]" : "§7[>]") : "§8[ ]");
export function openStage(player, lineId, stageId, back) {
  const S = lineState(player, lineId), st = S.stages.find((x) => x.id === stageId);
  const L = [`${CLS_COL[st.cls]}§l${st.name} §r§7(${POWER_CLASS[st.cls]})`, st.owned ? "§aDesbloqueado" : st.ready ? "§eProntos os requisitos — veja como evoluir" : "§cBloqueado", ""];
  if (st.skill) L.push(...skillFacts(st.skill), "");
  L.push("§lEfeitos reais:", ...st.feats.map((f) => `§7• §f${f}`));
  if (!st.owned) L.push("", "§lRequisitos:", ...st.req.map((r) => `${r.ok ? "§a✔" : "§c✘"} §f${r.text}`));
  if (st.evolvesTo) L.push("", `§7Evolui para: §b${st.evolvesTo}`);
  if (S.line.rules) L.push("", "§lRegras de proteção:", ...S.line.rules.map((r) => `§7• ${r}`));
  menu(player, `§l${st.name}`, L.join("\n"), [...(st.id === "creator" && st.owned ? [{ text: "§l§5Abrir a forja do Criador", icon: "skill_creator", run: () => openCreator(player, () => openStage(player, lineId, stageId, back)) }] : []), { text: "Voltar", run: () => openLine(player, lineId, back) }]);
}
export function openLine(player, lineId, back) {
  const S = lineState(player, lineId), l = S.line;
  const body = [`§l${l.name}`, `§7${l.who} · classe ${CLS_COL[l.cls]}${POWER_CLASS[l.cls]}`, "", `§f${l.about}`, "", ...S.stages.map((s) => `${mark(s)} ${CLS_COL[s.cls]}${s.name}${s.owned ? " §a(ativa)" : s.next && s.req.length ? ` §7(${s.req.filter((r) => r.ok).length}/${s.req.length} requisitos)` : ""}`)].join("\n");
  menu(player, "§l§5ÁRVORE DE PODERES", body, [...S.stages.map((s) => ({ text: `${mark(s)} ${s.name}\n§r§7${s.owned ? "desbloqueado" : s.ready ? "pronto" : "bloqueado"}`, icon: s.skill ? "skill_" + s.skill : "menu_skills", run: () => openStage(player, lineId, s.id, back) })), { text: "Voltar", run: () => openPowers(player, back) }]);
}
export function openPowers(player, back) {
  const rows = LINES.map((l) => { const S = lineState(player, l.id); return { l, S }; });
  const body = ["§7Consulte as linhas de poder, o que cada estágio faz de verdade e o que falta para evoluir.", "", ...rows.map(({ l, S }) => `${CLS_COL[l.cls]}${l.name}§r §7→ ${S.current ? `§a${S.current.name}` : "§8nenhum estágio"}${S.upcoming ? ` §7· próximo: §f${S.upcoming.name}${S.upcoming.ready ? " §e(pronto)" : ""}` : " §6(máximo)"}`)].join("\n");
  const b = rows.map(({ l, S }) => ({ text: `${CLS_COL[l.cls]}§l${l.who.split(" ")[0]}: ${l.name.split(" → ")[0]}...\n§r§7${S.current ? S.current.name : "bloqueado"}${S.upcoming ? ` → ${S.upcoming.name}` : ""}`, icon: S.stages[0].skill ? "skill_" + S.stages[0].skill : "menu_skills", run: () => openLine(player, l.id, back) }));
  b.push({ text: "Voltar", run: () => back?.() });
  menu(player, "§l§5ÁRVORE DE PODERES", body, b);
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

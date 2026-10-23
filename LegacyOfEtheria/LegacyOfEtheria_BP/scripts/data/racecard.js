// data/racecard.js - Ficha de raça (estilo "Human: Stats / Magicule / Spirit"): números derivados das mesmas fórmulas de stats.js, sem inventar valores.
import { STAT_LABELS, ATTRIBUTES } from "../config.js";

// aparência: o que cada raça mostra no corpo (desenhado na própria entidade do jogador, só em 3ª pessoa: tools/racepart.py + systems/raceparts.js)
export const RACE_LOOK = {
  demon: "Chifres curvos, asas de morcego e cauda em ponta de lança",
  vampire: "Asas de morcego escuras",
  dragonoid: "Chifres para trás, grandes asas de dragão e cauda de escamas",
  lizardman: "Cauda de escamas",
  ogre: "Chifres de carneiro",
  beastkin: "Cauda peluda",
  elf: "Asas de penas translúcidas",
  angel: "Asas de penas brancas e halo dourado",
  angel_arch: "Asas grandes de penas brancas e halo",
  angel_cherub: "Quatro asas de penas e halo radiante",
  angel_seraph: "Seis asas de penas douradas e halo radiante",
  fallen: "Asas de penas negras",
  fallen_lord: "Quatro asas negras e chifres curvos",
};
/** Aparência por ESTÁGIO (o Anjo ganha mais asas a cada evolução; os Caídos têm asas negras). */
export const STAGE_LOOK = { angel_1: "angel", angel_2: "angel", angel_3: "angel_arch", angel_4: "angel_cherub", angel_5: "angel_seraph",
  angel_f1: "fallen", angel_f2: "fallen", angel_f3: "fallen", angel_f4: "fallen_lord", angel_f5: "fallen_lord", fall_2: "fallen", fall_3: "fallen", fall_4: "fallen_lord", fall_5: "fallen_lord" };
const ITEM_NAMES = { "etheria:demonite_shard": "Fragmento de Demonite" };
const BASE_ATTR = 5, TRAIT_KEYS = Object.keys(STAT_LABELS);

/** Números de uma raça num estágio (nível 1). */
export function stageNumbers(stage, level = 1) {
  const A = (k) => Math.max(1, Math.round(BASE_ATTR + (stage.attrs?.[k] ?? 0)));
  const st = stage.stats ?? {}, str = A("strength"), int = A("intelligence"), agi = A("agility"), vit = A("vitality"), def = A("defense");
  const hp = 20 + Math.max(0, Math.min(600, Math.round((vit - 5) * 2 + level + (st.hp ?? 0))));
  return {
    hp, atk: Math.round((str * 0.6 + level * 0.2 + 1) * 10) / 10, speed: Math.round((0.1 + agi * 0.004) * 1000) / 1000,
    mana: Math.round(20 + int * 5 + level * 2 + (st.mana ?? 0)), stamina: Math.round(100 + agi * 2 + vit * 2 + (st.stamina ?? 0)),
    reduction: Math.round(def / (def + 60) * 100), crit: Math.round((5 + agi * 0.25 + (st.crit ?? 0)) * 10) / 10,
  };
}
/** Linhas de traços raciais (stage.stats), em pt-BR. */
export function traitLines(stage) {
  return Object.entries(stage.stats ?? {}).filter(([k, v]) => v && TRAIT_KEYS.includes(k)).map(([k, v]) => `${v > 0 ? "§a+" : "§c"}${v} ${STAT_LABELS[k]}`);
}
/** Texto completo da ficha. */
export function raceCardText(race, stage, skillName = (s) => s) {
  const n = stageNumbers(stage), look = RACE_LOOK[STAGE_LOOK[stage.id] ?? race.id];
  return [
    `§b§lAtributos`,
    `§f - ${n.hp} Vida`, `§f - ${n.atk} Dano de ataque`, `§f - ${n.speed} Velocidade de movimento`, `§f - ${n.reduction}% Redução de dano`, `§f - ${n.crit}% Crítico`,
    `§b§lMagicule`, `§f ${n.mana} de mana inicial §7(cresce com Inteligência e nível)`, `§f ${n.stamina} de stamina`,
    `§b§lEspírito`, `§f ${race.bonus}`, `§c ${race.penalty}`,
    traitLines(stage).length ? `§b§lTraços raciais\n§f ${traitLines(stage).join("§7, ")}` : "",
    look ? `§b§lAparência\n§f ${look}` : "",
    `§b§lHabilidades\n§f ${stage.skills.map(skillName).join(", ") || "—"}`,
  ].filter(Boolean).join("\n");
}

// ---- 6.14: ficha visual (barras comparativas entre as raças) + etiqueta de estilo de jogo ----
const BAR_N = 10;
const barStr = (v, [lo, hi], col) => { const k = hi > lo ? Math.max(2, Math.min(BAR_N, 2 + Math.round(((v - lo) / (hi - lo)) * (BAR_N - 2)))) : 5; return `${col}${"█".repeat(k)}§8${"█".repeat(BAR_N - k)}`; };
let _MAX = null, _MIN = null;
function maxes(list) {   // _MAX/_MIN: melhor e pior raça em cada número (as barras mostram a posição dentro dessa faixa, então diferenças pequenas continuam visíveis)
  if (_MAX) return _MAX;
  const keys = ["hp", "atk", "speed", "mana", "stamina", "reduction", "crit"];
  _MAX = Object.fromEntries(keys.map((k) => [k, -Infinity])); _MIN = Object.fromEntries(keys.map((k) => [k, Infinity]));
  for (const r of list) { const n = stageNumbers(r.stages[r.root]); for (const k of keys) { _MAX[k] = Math.max(_MAX[k], n[k]); _MIN[k] = Math.min(_MIN[k], n[k]); } }
  return _MAX;
}
const rng = (k) => [_MIN[k], _MAX[k]];
/** Estilo de jogo sugerido pela raça (maior pontuação relativa entre os papéis). */
export function raceStyle(list, stage) {
  const M = maxes(list), n = stageNumbers(stage);
  const pos = (k) => (_MAX[k] > _MIN[k] ? (n[k] - _MIN[k]) / (_MAX[k] - _MIN[k]) : 0.5);
  const sc = { "§c§lTanque": (pos("hp") + pos("reduction")) / 2, "§6§lGuerreiro": pos("atk"), "§b§lMago": pos("mana"), "§a§lVeloz": (pos("speed") + pos("crit")) / 2 };
  return Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0];
}
/** Ficha com barras: cada barra é relativa à melhor raça do jogo naquele atributo. */
export function raceSheet(list, race, stage, skillName = (s) => s) {
  const M = maxes(list), n = stageNumbers(stage), look = RACE_LOOK[STAGE_LOOK[stage.id] ?? race.id], tl = traitLines(stage);
  return [
    `§7Estilo: ${raceStyle(list, stage)}`,
    `§fVida §7${n.hp}
  ${barStr(n.hp, rng("hp"), "§c")}`,
    `§fAtaque §7${n.atk}
  ${barStr(n.atk, rng("atk"), "§6")}`,
    `§fDefesa §7${n.reduction}%
  ${barStr(n.reduction, rng("reduction"), "§9")}`,
    `§fVelocidade §7${n.speed}
  ${barStr(n.speed, rng("speed"), "§a")}`,
    `§fMana §7${n.mana}
  ${barStr(n.mana, rng("mana"), "§b")}`,
    `§fStamina §7${n.stamina}   §fCrítico §7${n.crit}%`,
    `§a+ ${race.bonus}`, `§c- ${race.penalty}`,
    tl.length ? `§b§lTraços§r §f${tl.join("§7, ")}` : "",
    look ? `§b§lAparência§r §f${look}` : "",
    `§b§lHabilidades§r §f${stage.skills.map(skillName).join(", ") || "—"}`,
  ].filter(Boolean).join("\n");
}

// ---- 6.15: tela dinâmica da raça (progresso, requisitos marcados, árvore) ----
/** Requisitos para evoluir PARA um estágio, com valor atual e se já foi cumprido. */
export function evoReqs(d, stage, have = () => 0) {
  const R = [];
  if (stage.minLevel > 1) R.push({ label: `Nível ${stage.minLevel}`, cur: d.level, need: stage.minLevel });
  if (stage.cost) R.push({ label: `${stage.cost} moedas`, cur: d.coins, need: stage.cost });
  if (stage.kills) R.push({ label: `${stage.kills} abates`, cur: d.kills ?? 0, need: stage.kills });
  if (stage.item) R.push({ label: `${stage.item[1]}x ${ITEM_NAMES[stage.item[0]] ?? stage.item[0].replace("etheria:", "").replace(/_/g, " ")}`, cur: have(stage.item[0]), need: stage.item[1] });
  if (stage.boss) R.push({ label: "Derrotar o chefe do reino", cur: (d.bossKills?.[stage.boss] ?? 0) > 0 ? 1 : 0, need: 1 });
  for (const r of R) r.ok = r.cur >= r.need;
  return R;
}
/** 0..1: média do avanço em cada requisito. */
export function evoProgress(d, stage, have) {
  const R = evoReqs(d, stage, have); if (!R.length) return 1;
  return R.reduce((a, r) => a + Math.min(1, r.cur / r.need), 0) / R.length;
}
const bar10 = (f, col) => { const k = Math.max(0, Math.min(10, Math.round(f * 10))); return `${col}${"█".repeat(k)}§8${"█".repeat(10 - k)}`; };
export const progressBar = (f) => `${bar10(f, f >= 1 ? "§a" : f >= 0.6 ? "§e" : "§c")} §f${Math.floor(f * 100)}%`;
export const reqLines = (d, stage, have) => evoReqs(d, stage, have).map((r) => (r.ok ? `§a[x] §f${r.label}` : `§c[ ] §7${r.label} §8(${Math.floor(r.cur)}/${r.need})`));
/** Árvore da raça: ● atual, [x] já percorrido, ► disponível agora, * bloqueado (mostra o que falta). */
export function treeLines(race, d, have) {
  const out = [], cur = d.raceStage, path = new Set();
  for (let id = cur; id; id = race.stages[id].from) path.add(id);
  const walk = (id, depth) => {
    const st = race.stages[id], pad = depth ? "  ".repeat(depth - 1) + "§8|- " : "";
    let tag;
    if (id === cur) tag = `§e● §l${st.name}§r §e(você)`;
    else if (path.has(id)) tag = `§a[x] ${st.name}`;
    else {
      const ready = race.stages[cur]?.next.includes(id);
      if (ready) { const ok = evoReqs(d, st, have).every((r) => r.ok); tag = ok ? `§a§l► ${st.name} §r§a(disponível)` : `§e► ${st.name} §7(${Math.floor(evoProgress(d, st, have) * 100)}%)`; }
      else tag = `§8* ${st.name} §8(Nv.${st.minLevel})`;
    }
    out.push(pad + tag);
    for (const n of st.next) walk(n, depth + 1);
  };
  walk(race.root, 0); return out;
}

/** o que muda de um estágio para outro (texto do Grande Sábio): atributos, traços e habilidades novas (owned: id -> já tem?) */
export function evoChanges(from, to, owned = () => false) {
  const attrs = Object.keys(ATTRIBUTES).map((k) => { const a = from?.attrs?.[k] ?? 0, b = to?.attrs?.[k] ?? 0; return a === b ? null : `${b > a ? "§a▲" : "§c▼"} §f${ATTRIBUTES[k].label} ${b - a > 0 ? "+" : ""}${b - a}`; }).filter(Boolean);
  const keys = new Set([...Object.keys(from?.stats ?? {}), ...Object.keys(to?.stats ?? {})].filter((k) => TRAIT_KEYS.includes(k)));
  const stats = [...keys].map((k) => { const a = from?.stats?.[k] ?? 0, b = to?.stats?.[k] ?? 0; return a === b ? null : `${b > a ? "§a▲" : "§c▼"} §f${STAT_LABELS[k]} ${b - a > 0 ? "+" : ""}${b - a}`; }).filter(Boolean);
  return { attrs, stats, skills: (to?.skills ?? []).filter((s) => !owned(s)) };
}

// ---- 8.9: CARTÃO DO CARROSSEL DE RAÇAS (estilo do vídeo de referência: "Magicule / Aura / Alignment", selo de dificuldade) ----
/** dificuldade da raça inicial: 0 Fácil, 1 Normal, 2 Difícil, 3 Extremo (selo colorido no cartão do pacote Sábio UI) */
export const RACE_DIFF = { human: 0, beastkin: 0, dwarf: 0, goblin: 1, ogre: 1, lizardman: 1, elf: 2, slime: 2, demon: 2, vampire: 2, angel: 2, dragonoid: 3, undead: 3 };
export const DIFF_NAMES = ["Fácil", "Normal", "Difícil", "Extremo"];
export const RACE_ALIGN = { angel: "Luz", demon: "Trevas", vampire: "Trevas", undead: "Trevas" };
const kfmt = (v) => (v >= 1000 ? `${(Math.round(v / 100) / 10).toString().replace(/\.0$/, "")}k` : String(v));
/** faixas do cartão: Mana e Aura (Vida + Stamina) do nível 1 até o nível da 1ª evolução, pelas mesmas fórmulas de stats.js */
export function raceCardRanges(race) {
  const st = race.stages[race.root];
  const cap = Math.max(2, Math.min(...(st.next ?? []).map((x) => race.stages[x]?.minLevel ?? 25), 25));
  const a = stageNumbers(st, 1), b = stageNumbers(st, cap);
  return { mana: `${kfmt(a.mana)} - ${kfmt(b.mana)}`, aura: `${kfmt(a.hp + a.stamina)} - ${kfmt(b.hp + b.stamina)}`, align: RACE_ALIGN[race.id] ?? "Padrão" };
}
// larguras (px, com o espaço entre letras) da fonte padrão do Minecraft: alinha a coluna de valores com espaços
const NARROW = { "i": 2, "!": 2, ".": 2, ",": 2, ":": 2, ";": 2, "|": 2, "'": 2, "í": 2, "l": 3, "`": 3, "I": 4, "t": 4, " ": 4, "[": 4, "]": 4, "f": 5, "k": 5, "<": 5, ">": 5, "(": 5, ")": 5, "\"": 5, "*": 5 };
export const textWidth = (s) => [...String(s).replace(/§./g, "")].reduce((w, c) => w + (NARROW[c] ?? 6), 0);
/** "rótulo" + espaços até a coluna px */
export const padTo = (label, px) => label + " ".repeat(Math.max(1, Math.round((px - textWidth(label)) / 4)));

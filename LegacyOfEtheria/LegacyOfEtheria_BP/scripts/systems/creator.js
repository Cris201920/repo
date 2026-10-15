// systems/creator.js - CRIADOR (habilidade Única de Yuuki Kagurazaka): forja de habilidades próprias.
// Fluxo: Habilidades > Árvore de Poderes > Yuuki > Criador (ou `!criar`) -> escolher espaço -> forma -> elemento -> confirmar (custa pontos de habilidade).
// A receita fica em d.creations[espaço] = { form, elem } (salvo com o jogador). Cada espaço é uma habilidade ativa (created_1..5) já registrada em data/skills.js:
// ela vai para a hotbar como qualquer outra e o executor "creation" monta o efeito a partir da receita, REUSANDO os executores existentes (projétil, raio, cone, explosão, onda, buff).
// Regras: custo em pontos de habilidade; espaços liberados por nível; mana/recarga do espaço; refazer troca a receita (pontos gastos de novo); dano/efeitos passam pelos ganchos normais (Anti-Skill, resistências).
import { registerExec, execFor, hasSkill, grantSkill } from "./skills.js";
import { getData, markDirty, saveNow } from "../core/db.js";
import { SKILLS } from "../data/skills.js";
import { CREATOR, FORMS, ELEM, SOUND } from "../data/creations.js";
import { say, toast } from "../core/utils.js";
import { menu } from "./ui/forms.js";

export const slotSkill = (n) => `created_${n}`;
export const recipeOf = (d, n) => d.creations?.[n] ?? null;
export const recipeName = (r) => (r ? `${FORMS[r.form]?.name ?? r.form} de ${ELEM[r.elem]?.name ?? r.elem}` : null);
export const slotLocked = (d, n) => (d.level < CREATOR.slots[n].level ? `Nível ${CREATOR.slots[n].level}` : null);

/** monta a habilidade efetiva (cópia de SKILLS.created_n com forma/elemento/poder da receita). Devolve null se não houver receita válida. */
export function buildCreated(slot, recipe) {
  const base = SKILLS[slotSkill(slot)], S = CREATOR.slots[slot], F = FORMS[recipe?.form], E = ELEM[recipe?.elem];
  if (!base || !S || !F || !E) return null;
  const t = S.tier, rider = E.rider(t) ?? {};
  let exec;
  if (F.defensive) {
    exec = { kind: "buff", sec: 10 + 2 * t, absorb: 2 + 2 * t, buff: { id: "creation_barrier", stats: { defense: 4 + 4 * t, res_magic: 8 + 4 * t, ["res_" + recipe.elem]: 25 + 10 * t } } };
  } else {
    exec = F.build(t, S.power * (rider.powerMul ?? 1));
    if (rider.burn) exec.burn = rider.burn;
    if (rider.debuff) exec.debuff = rider.debuff;
    if (exec.knock !== undefined) exec.knock += rider.knockBonus ?? 0;
  }
  exec.snd = SOUND[recipe.form];
  return { ...base, name: recipeName(recipe), element: recipe.elem, exec };
}

export function forge(player, slot, form, elem) {
  const d = getData(player), S = CREATOR.slots[slot];
  if (!hasSkill(d, CREATOR.skill)) return { ok: false, msg: "Você ainda não possui o Criador." };
  if (!S || !FORMS[form] || !ELEM[elem]) return { ok: false, msg: "Receita inválida." };
  const lock = slotLocked(d, slot); if (lock) return { ok: false, msg: `Espaço bloqueado: ${lock}.` };
  if (d.skillPoints < S.sp) return { ok: false, msg: `Requer ${S.sp} ponto(s) de habilidade (você tem ${d.skillPoints}).` };
  d.skillPoints -= S.sp; d.creations ??= {}; d.creations[slot] = { form, elem };
  if (!hasSkill(d, slotSkill(slot))) grantSkill(player, slotSkill(slot));
  markDirty(player); saveNow(player);
  return { ok: true, msg: `Criou §f${recipeName(d.creations[slot])}§r (espaço ${slot}).` };
}

// ---------------------------------------------------------------- UI
export function openCreator(player, back) {
  const d = getData(player);
  if (!hasSkill(d, CREATOR.skill)) return say(player, `§cVocê precisa do Criador (nível ${CREATOR.minLevel}, derrotar Yuuki Kagurazaka e ter a Anti-Skill). Veja Habilidades > Árvore de Poderes.`);
  const rows = [1, 2, 3, 4, 5].map((n) => {
    const S = CREATOR.slots[n], lock = slotLocked(d, n), r = recipeOf(d, n);
    return { n, S, lock, r, text: `${lock ? "§8[ ]" : r ? "§a[x]" : "§e[+]"} Espaço ${n} · ${S.label}\n§r§7${lock ? `bloqueado (${lock})` : r ? recipeName(r) : `vazio · ${S.sp} pt`}` };
  });
  const body = ["§lCRIADOR", "§7Forje habilidades próprias: forma + elemento. Elas vão para a sua hotbar como qualquer outra.", `§7Pontos de habilidade: §f${d.skillPoints}`, "",
    ...rows.map((x) => `§7Espaço ${x.n} (${x.S.label}): §f${x.lock ? "bloqueado" : x.r ? recipeName(x.r) : "vazio"} §7· mana ${x.S.mana} · recarga ${x.S.cd}s · ${x.S.sp} pt`)].join("\n");
  menu(player, "§l§5CRIADOR", body, [...rows.map((x) => ({ text: x.text, icon: "skill_creator", run: () => (x.lock ? openCreator(player, back) : pickForm(player, x.n, back)) })), { text: "Voltar", run: () => back?.() }]);
}
function pickForm(player, slot, back) {
  const keys = Object.keys(FORMS);
  menu(player, `§l§5ESPAÇO ${slot}: FORMA`, ["§7Escolha a forma da habilidade:", "", ...keys.map((k) => `§f${FORMS[k].name}§7: ${FORMS[k].desc}`)].join("\n"),
    [...keys.map((k) => ({ text: FORMS[k].name, run: () => pickElem(player, slot, k, back) })), { text: "Voltar", run: () => openCreator(player, back) }]);
}
function pickElem(player, slot, form, back) {
  const keys = Object.keys(ELEM);
  menu(player, `§l§5ESPAÇO ${slot}: ELEMENTO`, `§7Forma: §f${FORMS[form].name}\n§7Escolha o elemento:`,
    [...keys.map((k) => ({ text: ELEM[k].name, run: () => confirm(player, slot, form, k, back) })), { text: "Voltar", run: () => pickForm(player, slot, back) }]);
}
function confirm(player, slot, form, elem, back) {
  const d = getData(player), S = CREATOR.slots[slot], r = { form, elem }, sk = buildCreated(slot, r), old = recipeOf(d, slot), ex = sk?.exec ?? {};
  const L = [`§l${recipeName(r)}`, `§7Espaço ${slot} (${S.label}) · mana ${S.mana} · recarga ${S.cd}s`, `§7${FORMS[form].desc}`,
    ex.power ? `§7Poder x${ex.power.toFixed(1)}${ex.radius ? ` · raio ${ex.radius.toFixed(1)}` : ""}${ex.range ? ` · alcance ${ex.range}` : ""}` : `§7Absorção ${ex.absorb ?? 0} · ${ex.sec ?? 0}s`,
    `§7Custo: §f${S.sp} ponto(s) de habilidade §7(você tem ${d.skillPoints})`, old ? `§cSubstitui: ${recipeName(old)}` : ""].filter(Boolean).join("\n");
  menu(player, "§l§5FORJAR?", L, [
    { text: "§l§aForjar", run: () => { const res = forge(player, slot, form, elem); say(player, `§5[Criador] §r${res.msg}`); if (res.ok) toast(player, "§5§lCRIAÇÃO", `§f${recipeName(r)}`); openCreator(player, back); } },
    { text: "Voltar", run: () => pickElem(player, slot, form, back) },
  ]);
}

export function startCreator() {
  registerExec("creator_forge", (player) => { openCreator(player); return true; });
  registerExec("creation", (player, sk, s, d) => {
    const slot = sk.exec.slot, built = buildCreated(slot, recipeOf(d, slot));
    if (!built) return "Esta criação ainda não foi forjada (use o Criador).";
    const fn = execFor(built); if (!fn) return "Forma sem executor.";
    return fn(player, built, s, d);
  });
}

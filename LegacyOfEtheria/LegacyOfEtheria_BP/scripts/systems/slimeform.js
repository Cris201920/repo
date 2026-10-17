// systems/slimeform.js - 6.80: FORMA SLIME, FORMA HUMANA e MÍMICO (só a raça Slime) + sorte de Ultimate do Predador (qualquer raça com o Predador).
// - O Slime começa na forma slime (modelo etheria_player_slime). Ao devorar um humano com o Predador, libera a forma humana e passa a
//   alternar livremente entre slime e humano (menu da raça > Forma do Slime).
// - Mímico: o slime pode assumir a forma de qualquer criatura do catálogo (data/mimicforms.gen.js) que já tenha devorado.
// - Sorte do Predador: cada criatura devorada tem uma chance muito pequena (com proteção de azar) de despertar uma Skill Ultimate.
// O visual é feito pelas propriedades etheria:slime / etheria:mimic (RP: tools/slime_mimic_wire.py).
import { getData, markDirty } from "../core/db.js";
import { MIMIC_FORMS } from "../data/mimicforms.gen.js";
import { SKILLS } from "../data/skills.js";
import { grantSkill, hasSkill } from "./skills.js";
import { say, toast, playSound } from "../core/utils.js";
import { sageText } from "./voice.js";
import { ctx, burst, implode } from "./fxlib.js";

const HUMAN_RX = /villager|pillager|vindicator|evoker|witch|wandering_trader|adventurer|(?<!spider_|skeleton_)knight(?!_spider)|human|hero|bandit|soldier|paladin|merchant|^minecraft:player$/;   // 6.99: cavaleiro esqueleto não conta
const PRED_LINE = ["predator", "gluttony", "beelzebuth"];
const ULT_BASE = 0.002, ULT_STEP = 0.00015, ULT_MAX = 0.02;   // "muito sortudo": 0,2% por devoração, sobe até 2% com o azar acumulado

export const isSlime = (d) => !!d.raceChosen && d.race === "slime";
export function slimeState(d) { d.slimeF ??= { form: "slime", human: false, mimic: 0, eaten: {} }; d.slimeF.eaten ??= {}; return d.slimeF; }

/** aplica as propriedades visuais (chamado por applyRaceLook e ao trocar de forma) */
export function applySlimeForm(player, d = getData(player)) {
  const s = isSlime(d) ? slimeState(d) : null;
  const mim = s ? (s.mimic | 0) : 0, slime = !!s && !mim && s.form === "slime";
  try { if (player.getProperty("etheria:slime") !== slime) player.setProperty("etheria:slime", slime); } catch { /* BP antigo */ }
  try { if (player.getProperty("etheria:mimic") !== mim) player.setProperty("etheria:mimic", mim); } catch { /* BP antigo */ }
}

/** formas do Mímico já liberadas (criaturas devoradas que existem no catálogo) */
export function mimicAvailable(d) {
  const s = slimeState(d);
  const ids = new Set([...Object.keys(s.eaten), ...Object.keys(d.stom?.mobs ?? {}), ...Object.keys(d.stom?.analyzed ?? {})]);
  return MIMIC_FORMS.filter((f) => [...ids].some((id) => f.rx.test(id)));
}

function formFx(player, col) {
  try { const c = ctx(player); implode(c, player.location, { col, n: 18, radius: 1.6 }); burst(c, { x: player.location.x, y: player.location.y + 0.6, z: player.location.z }, { col, n: 14, spd: 0.6, up: 0.3 }); } catch { /* ignore */ }
  try { playSound(player, "mob.slime.big", 0.8, 0.9); } catch { /* ignore */ }
}

/** troca de forma: "slime" | "human" | número do Mímico */
export function setSlimeForm(player, form) {
  const d = getData(player); if (!isSlime(d)) return false;
  const s = slimeState(d);
  if (form === "human" && !s.human) { say(player, "§b[Slime] §7Devore um humano com o Predador para aprender a forma humana."); return false; }
  if (typeof form === "number") {
    if (form && !mimicAvailable(d).some((f) => f.i === form)) return false;
    s.mimic = form;
  } else { s.mimic = 0; s.form = form; }
  markDirty(player); applySlimeForm(player, d); formFx(player, typeof form === "number" && form ? "void" : "water");
  const name = typeof form === "number" ? (form ? MIMIC_FORMS.find((f) => f.i === form)?.name : null) : (form === "human" ? "Forma humana" : "Forma slime");
  if (name) toast(player, "§bMímico", `§7${name}`);
  return true;
}

function rollUltimate(player, d) {
  if (!PRED_LINE.some((id) => hasSkill(d, id))) return;
  d.ultPity = (d.ultPity ?? 0) + 1;
  const chance = Math.min(ULT_MAX, ULT_BASE + d.ultPity * ULT_STEP);
  if (Math.random() >= chance) return;
  const pool = Object.values(SKILLS).filter((sk) => sk.cat === "Ultimate" && !PRED_LINE.includes(sk.id) && !hasSkill(d, sk.id));
  if (!pool.length) return;
  const sk = pool[Math.floor(Math.random() * pool.length)];
  d.ultPity = 0;
  grantSkill(player, sk.id);
  toast(player, "§6§lSKILL ULTIMATE", `§e${sk.name}`);
  say(player, `§6[Predador] §fUma sorte absurda: ao devorar, você despertou a Skill Ultimate §e${sk.name}§f!`);
  try { sageText(player, `Aviso. Durante a predação, a Skill Ultimate «${sk.name}» foi adquirida.`, { pri: 1, key: "pred.ult", cd: 20 }); } catch { /* ignore */ }
  try { playSound(player, "ui.toast.challenge_complete", 1, 1); } catch { /* ignore */ }
}

/** chamado pelo Predador a cada criatura devorada com sucesso */
export function onDevoured(player, typeId) {
  const d = getData(player);
  try { rollUltimate(player, d); } catch { /* ignore */ }
  if (!isSlime(d)) { markDirty(player); return; }
  const s = slimeState(d), had = new Set(mimicAvailable(d).map((f) => f.i));
  s.eaten[typeId] = 1;
  if (!s.human && HUMAN_RX.test(typeId)) {
    s.human = true;
    toast(player, "§b§lFORMA HUMANA", "§7liberada pelo Mímico");
    say(player, "§b[Slime] §fVocê devorou um humano e aprendeu a §bforma humana§f. Alterne em §eRaça › Forma do Slime§f.");
    try { sageText(player, "Aviso. Informação sobre a forma humana analisada. A transformação em humano agora é possível.", { pri: 2, key: "slime.human", cd: 40 }); } catch { /* ignore */ }
  }
  for (const f of mimicAvailable(d)) if (!had.has(f.i)) toast(player, "§5Mímico", `§7nova forma: ${f.name}`);
  markDirty(player);
}

/** menu: Raça › Forma do Slime */
export function openSlimeForms(player, back, menu) {
  const d = getData(player); const s = slimeState(d); const av = mimicAvailable(d);
  const cur = s.mimic ? MIMIC_FORMS.find((f) => f.i === s.mimic)?.name : (s.form === "human" ? "Humana" : "Slime");
  const body = [`§7Forma atual: §b${cur}`, s.human ? "§aForma humana liberada." : "§8Forma humana: devore um humano com o Predador.",
    `§7Mímico: §f${av.length}/${MIMIC_FORMS.length} §7formas (criaturas devoradas).`].join("\n");
  const B = [
    { text: "§b§lForma Slime\n§r§7o corpo original", icon: "race_slime", run: () => setSlimeForm(player, "slime") },
    { text: s.human ? "§f§lForma Humana\n§r§7alternar livremente" : "§8§lForma Humana\n§r§7bloqueada", icon: "race_human", run: () => setSlimeForm(player, "human") },
    ...av.map((f) => ({ text: `§5§l${f.name}\n§r§7Mímico`, icon: "race_slime", run: () => setSlimeForm(player, f.i) })),
    { text: "§7« Voltar", icon: "back", run: () => back?.() },
  ];
  menu(player, "§b§lFORMA DO SLIME", body, B, "sage");
}

// systems/sagecore.js - 6.38: CAMADA DE COMPATIBILIDADE do Grande Sábio.
// O sistema antigo (núcleo geométrico de partículas na frente da câmera, anel de glifos, texto "digitado" no título/barra e as cenas próprias)
// foi REMOVIDO a pedido do jogador. O Grande Sábio oficial agora é:
//   - systems/sageannounce.js : cena da Voz do Mundo (habilidade, evolução, nível, análise, cerimônias);
//   - systems/voice.js        : fila automática de falas (dicas, alertas, análises) com voz em português, legenda e indicador circular no canto.
// Os nomes exportados abaixo continuam existindo para os outros sistemas (sage.js, sageproc.js, sageassess.js...), mas tudo é encaminhado ao sistema novo.
import { announceSkill, announceEvolution, announceCeremony, announceLordAwakening, announceAnalysis, raceKey } from "./sageannounce.js";
import { RACES } from "../data/races.js";
import { system } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { isValid } from "../core/utils.js";
import { SKILLS } from "../data/skills.js";
import { sageStage, sageCfg, sageText, sageSpeaking, sageSay } from "./voice.js";
import { kb, kcount, stageName } from "./sageknow.js";

export const DUR_LABEL = { short: "Curta", normal: "Normal", long: "Longa" };
const cfg = (p) => sageCfg(getData(p));
export const enabled = (p) => { try { return cfg(p).core !== false; } catch { return false; } };
export const animOn = (p) => { try { return cfg(p).core !== false && getData(p).settings.fx !== "off"; } catch { return false; } };
export const CINEMATIC_K = 1.35;
export const STATES = { IDLE: {}, DETECTING: {}, ANALYZING: {}, PROCESSING: {}, CALCULATING: {}, RESULT: {}, ARCHIVED: {}, EVOLVING: {}, FAIL: {} };
const alive = (p) => { try { return p && isValid(p); } catch { return false; } };

// ------------------------------------------------------------------ núcleo visual antigo: removido (funções mantidas sem efeito)
export function coreOn() { return null; }
export function coreState() { return null; }
export function coreOff() { /* removido */ }
export const coreActive = () => false;
export const coreInfo = () => ({ state: null, stage: null, layers: 0 });
export function corePulse() { /* removido */ }
export function coreAlert() { /* removido: o alerta aparece pelo indicador do Sábio (voice.js) */ }
export const RING_ID = "etheria:sage_ring";
export const RING_GAP = 160;
export const RING_FX = [];
export const ringEnabled = () => false;
export function sageRing() { /* removido */ }

// ------------------------------------------------------------------ texto: agora sempre pela fila do Sábio (legenda + indicador + voz)
export const typingActive = (p) => sageSpeaking(p);
const plain = (s) => String(s ?? "").replace(/§./g, "").trim();
const cap = (s) => { const t = plain(s); return t ? t.charAt(0) + t.slice(1).toLowerCase() : t; };
/** antes: digitava linhas na barra; agora: uma fala de texto do Sábio (a última linha é a mais importante) */
export function typeText(p, lines, o = {}) {
  const txt = (lines ?? []).map(cap).filter(Boolean).slice(-2).join(" · ");
  if (alive(p) && txt) sageText(p, txt, { pri: o.pri ?? 5 });
  if (o.onDone) system.runTimeout(() => { try { o.onDone(); } catch { /* ignore */ } }, 20);
}
export function slam(p, title, sub = "") { if (alive(p)) sageText(p, `${cap(title)}${sub ? " — " + cap(sub) : ""}`, { pri: 4 }); }

// ------------------------------------------------------------------ análise (usada por sage.js / sageassess.js)
export function coreBegin(p, label = "ANALISANDO...") { if (alive(p)) sageText(p, cap(label), { pri: 5, cd: 40, key: "an.begin" }); }
/** rows: ["NOME: ...", "VIDA: ...", ...] -> cena de análise (nome) + resumo curto na fala do Sábio */
export function coreResult(p, rows = [], opt = {}) {
  if (!alive(p)) return;
  const first = plain(rows[0] ?? ""), name = first.includes(":") ? first.split(":").slice(1).join(":").trim() : first;
  if (name && !opt.known) announceAnalysis(p, name);
  const rest = rows.slice(1, 4).map(plain).filter(Boolean).join(" · ");
  if (rest) sageText(p, rest, { pri: 5 });
}
export function coreFail(p) {
  if (!alive(p)) return;
  if (!sageSay(p, "incomplete")) sageText(p, "Análise insuficiente. O alvo resistiu à análise.", { pri: 4 });
}
/** O alvo é muito superior? Evita revelar tudo de imediato (nunca bloqueia: após 2 tentativas a análise passa). */
export function resistsAnalysis(p, target, power) {
  try {
    const sg = cfg(p), s = sageStage(getData(p)), id = target.typeId; sg.res ??= {};
    if (sg.archive?.[id] || (sg.res[id] ?? 0) >= 2) return false;
    const chance = power >= 3 ? (s >= 3 ? 0 : s === 2 ? 0.35 : 0.8) : power === 2 ? (s >= 1 ? 0 : 0.45) : 0;
    if (Math.random() < chance) { sg.res[id] = (sg.res[id] ?? 0) + 1; markDirty(p); return true; }
  } catch { /* ignore */ }
  return false;
}

// ------------------------------------------------------------------ anúncio de habilidades -> cena da Voz do Mundo
export function tierOfSkill(id) {
  const sk = SKILLS[id]; if (!sk) return "common";
  if (sk.rarity === "divine" || sk.cat === "Ultimate" || sk.cat === "Manas") return "ultimate";
  if (sk.cat === "Única") return "unique";
  if (/resist|imunidade|imune/i.test(`${sk.id} ${sk.name}`) || (sk.type === "passive" && Object.keys(sk.stats ?? {}).some((k) => k.startsWith("res_")) && !sk.exec)) return "resistance";
  if (sk.cat === "Racial" || sk.cat === "Intrínseca") return "intrinsic";
  if (sk.cat === "Extra" || ["epic", "legendary", "mythic"].includes(sk.rarity)) return "extra";
  return "common";
}
export function queueSkillAnnounce(p, id) { if (alive(p) && SKILLS[id]) announceSkill(p, { id, name: SKILLS[id].name, tier: tierOfSkill(id) }); }
export function announceSkills(p, ids) { for (const id of ids ?? []) queueSkillAnnounce(p, id); }

// ------------------------------------------------------------------ evolução -> cena da Voz do Mundo
const TDL = (id) => /^demon_4$/.test(id) || /_ld$/.test(id);
export function evolutionScene(p, stage) {
  if (!alive(p)) return;
  const id = stage?.id ?? "", from = RACES[stage?.race]?.stages?.[stage?.from]?.name ?? "?";
  const evo = { from, to: stage?.name ?? "?", fromKey: raceKey(stage?.from, from), toKey: raceKey(stage?.id, stage?.name) };
  if (TDL(id)) announceLordAwakening(p, evo);
  else if (id === "human_2a") announceCeremony(p, "hero_egg", evo);
  else if (id === "human_3a") announceCeremony(p, "true_hero", evo);
  else announceEvolution(p, evo.from, evo.to, stage?.from, stage?.id);
}
export function sageEvolveScene(p, to) { if (alive(p)) announceEvolution(p, stageName(to - 1), stageName(to)); }

// ------------------------------------------------------------------ módulos do Sábio (antes eram cenas de partículas): agora falas curtas
export function sceneAccel(p) { sageText(p, "Aceleração de Pensamento ativada. Velocidade de processamento ×3.", { pri: 5 }); }
export function sceneParallel(p, labels = ["Análise", "Combate", "Ambiente", "Habilidade"]) { sageText(p, `Processamento paralelo ativo: ${labels.map(cap).join(", ")}.`, { pri: 5 }); }
export function sceneChant(p, spellName = "") { sageText(p, spellName ? `Anulação de Canto: ${spellName}.` : "Processamento direto disponível. Anulação de Canto.", { pri: 5 }); }
export function sceneCreation(p) {
  const d = getData(p), k = kb(d), n = (c) => Object.keys(k[c] ?? {}).length;
  sageText(p, `All of Creation: ${n("skills")} habilidades, ${n("magic")} magias, ${n("creatures")} criaturas — ${kcount(d)} registros.`, { pri: 5 });
}

// ------------------------------------------------------------------ configurações (só o que existe no sistema novo)
import { menu as baseMenu, sageThemeOf } from "./ui/forms.js";
const menu = (p, t, b, B) => baseMenu(p, t, b, B, sageThemeOf(sageStage(getData(p))));
import { FX_LEVELS, FX_LABELS } from "../config.js";
export function openCoreSettings(p, back) {
  const d = getData(p), sg = cfg(p), st = d.settings, onoff = (v) => (v ? "§aLIGADO" : "§cDESLIGADO");
  const tg = (key, label) => ({ text: `§l${label}: ${onoff(sg[key] !== false)}`, icon: "menu_settings", run: () => { sg[key] = sg[key] === false; markDirty(p); openCoreSettings(p, back); } });
  menu(p, "§l§bGRANDE SÁBIO", "§7Falas automáticas com voz em português, legenda e indicador no canto da tela.\n§8Tudo é salvo no seu personagem.", [
    tg("voice", "Voz (áudio)"), tg("subs", "Legenda"), tg("tips", "Dicas automáticas"),
    { text: `§lVolume da voz: §f${sg.volume ?? 80}%`, icon: "menu_settings", run: () => { sg.volume = ({ 0: 40, 40: 60, 60: 80, 80: 100, 100: 0 })[sg.volume ?? 80] ?? 80; markDirty(p); openCoreSettings(p, back); } },
    { text: `§lIdioma da voz: §f${sg.style === "mod" ? "Japonês (pacote Voz)" : "Português"}`, icon: "menu_settings", run: () => { sg.style = sg.style === "mod" ? "pt" : "mod"; markDirty(p); openCoreSettings(p, back); } },
    { text: `§lPartículas: §f${FX_LABELS[st.fx] ?? st.fx}\n§r§8toque para alternar`, icon: "menu_settings", run: () => { st.fx = FX_LEVELS[(FX_LEVELS.indexOf(st.fx) + 1) % FX_LEVELS.length]; markDirty(p); openCoreSettings(p, back); } },
    { text: "§lVoltar", run: () => back?.() },
  ]);
}
export function dropCore() { /* nada a limpar */ }
export function startSageCore() { /* o sistema antigo não roda mais */ }

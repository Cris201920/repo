// systems/voice.js - Sistema de voz contextual: Grande Sábio + identidade vocal de cada Habilidade Única.
// Fila por jogador com prioridade (1 = máxima ... 5 = mínima), interrupção só por prioridade 1, cooldown por fala,
// efeito de ativação -> pausa -> voz -> efeito de finalização, legenda com fade/brilho na action bar e configurações do jogador.
import { world, system } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { VOICE } from "../data/voice.gen.js";
import { SKILLS } from "../data/skills.js";

const PRE = 6, GAP = 6, FADE = 6;           // ticks: pausa após efeito de ativação, intervalo entre falas, fade
const QMAX = 4;
// Prioridades (1 emergência · 2 evolução · 3 despertar · 4 aquisição de Única · 5 análise importante · 6 ativação especial · 7 comum)
const priOf = (k) => k.startsWith("dg_") || k.startsWith("al_") ? (k === "dg_attention" ? 5 : 1) : k.startsWith("evo_") || k === "stage_1" || k === "stage_2" || k === "stage_3" || k === "stage_4" ? 2 : k.startsWith("awk_") ? 3
  : k.startsWith("birth_") || k === "unique_acquired" ? 4 : k.startsWith("an_") || k === "ds_unique" || k === "skill_evolved" ? 5 : k.startsWith("cmb_") || k.startsWith("ds_") || k === "skill_acquired" ? 6 : 7;
// Voz ORIGINAL do mod (restaurada): evento -> som portado do Grande Sábio/Rafael
const MODV = { an_start: "voice.kaiseki_kaishi", an_progress: "voice.kaiseki_chuu", an_done: "voice.kaiseki_kanryou", an_unknown: "voice.kaiseki_mode", an_extra: "voice.kaiseki_kakunin", an_resist: "voice.kaiseki_kantei",
  an_registered: "voice.gakushuu_kakunin", an_detail: "voice.taishou_kanryou", birth_analyzing: "voice.kaiseki_kaishi", birth_done: "voice.kaiseki_kanryou", birth_unique: "voice.no_kakutoku", birth_acquired: "voice.seiko_shimashita",
  skill_acquired: "voice.no_kakutoku", skill_registered: "voice.seiko_shimashita", skill_available: "voice.shounin", unique_acquired: "voice.no_kakutoku", mastery_up: "voice.gakushuu_kanryou", skill_evolved: "raphael.shinka_shimashita",
  no_mana: "voice.maso_fusoku", no_target: "voice.kaiseki_fuka", cooldown: "voice.jiki_shousou", evo_ready: "voice.shinka_jouken", evo_proc: "voice.e_no_shinka", evo_done: "raphael.shinka_shimashita", evo_insuf: "voice.dankai_fusoku",
  awk_cond: "raphael.jouken", awk_start: "raphael.kakuchou", awk_link: "raphael.heiretsu_kaishi", awk_done: "raphael.gentei_toppa", cmb_compat: "raphael.gaitou", cmb_possible: "raphael.juri", cmb_done: "raphael.saikouchiku",
  dg_attention: "voice.sentou_mode", dg_threat: "voice.sentou_mode", dg_high: "voice.seizon_kakuritsu", dg_low_hp: "voice.seizon_kakuritsu", ds_knowledge: "voice.gakushuu_kanryou", ds_added: "voice.gakushuu_kakunin",
  ds_unique: "voice.shinka_jouken", boot: "voice.kidou", stage_1: "raphael.kakuchou", stage_2: "raphael.chie_no_ou", stage_3: "raphael.chie_no_ou", suggest: "voice.ryoukai",
  it_start: "voice.kaiseki_kaishi", it_done: "voice.kaiseki_kanryou", sk_start: "voice.kaiseki_kaishi", sk_done: "voice.kaiseki_kanryou", sp_start: "raphael.bunki", sp_done: "voice.gakushuu_kanryou",
  incomplete: "voice.kaiseki_chuudan", insufficient: "voice.zentei_fusoku", kb_new: "voice.gakushuu_kakunin", learn_tier: "voice.gakushuu_kanryou", cmd_ok: "voice.ryoukai", cmd_unknown: "voice.kaiseki_fuka",
  evo_gs_ready: "voice.shinka_jouken", evo_rf_ready: "voice.shinka_jouken", al_energy: "voice.maso_fusoku", al_ambush: "voice.sentou_mode", al_superior: "voice.seizon_kakuritsu", al_attack: "voice.sentou_mode",
  sg_combo: "raphael.gaitou", rf_optimize: "raphael.saikouchiku", rf_synergy: "raphael.gaitou", rf_predict: "raphael.juri" };
const st = new Map();                         // playerId -> { q: [], cur, t0, cds: Map }

export function sageCfg(d) {
  const sg = (d.sage ??= { archive: {}, voice: true, raphael: false, analyses: 0 });
  sg.volume ??= 80; sg.sfx ??= true; sg.subs ??= true; sg.style ??= "mod"; sg.seen ??= {};
  if (sg.gs === undefined) sg.gs = !!sg.raphael || sg.analyses >= 20 || d.level >= 35;   // migração: quem já era Grande Sábio continua
  sg.ciel ??= false; sg.mods ??= {}; sg.auto ??= 1; sg.exp ??= 0; sg.bond ??= 0; sg.tasks ??= 0;
  // configurações do Sábio (voz, volume, efeitos, partículas, animações, cinematográfico, dicas, análise, interface, desempenho, frequência, debug)
  sg.tips ??= true; sg.tipFreq ??= "normal"; sg.cinematic ??= false; sg.perf ??= false; sg.ui ??= "normal"; sg.debug ??= false; sg.parts ??= true;
  return sg;
}
/** Estágio do Sábio: 0 inicial · 1 Sábio · 2 Grande Sábio · 3 Raphael · 4 Ciel (explícito e salvo no save). */
export function sageStage(d) {
  const sg = sageCfg(d);
  if (sg.ciel) return 4;
  if (sg.raphael) return 3;
  if (sg.gs) return 2;
  if (sg.analyses >= 5 || d.level >= 15) return 1;
  return 0;
}
let hook = null;
export const setVoiceHook = (fn) => { hook = fn; };
const S = (p) => { let x = st.get(p.id); if (!x) { x = { q: [], cur: null, t0: 0, cds: new Map() }; st.set(p.id, x); } return x; };
export const subtitleActive = (p) => !!st.get(p.id)?.cur;
/** Estado da fila de voz (modo debug): tamanho da fila, fala atual e última fala. */
export function voiceInfo(p) { const x = st.get(p.id); return { queue: x?.q.length ?? 0, current: x?.cur?.key ?? null, last: x?.last ?? null, lastAt: x?.lastAt ?? 0 }; }
export function dropVoice(id) { st.delete(id); }

function enqueue(player, item) {
  const d = getData(player), sg = sageCfg(d); if (sg.voice === false) return false;
  const x = S(player), now = system.currentTick;
  if (item.cd > 0) { if ((x.cds.get(item.key) ?? 0) > now) return false; x.cds.set(item.key, now + item.cd); }
  if (x.q.some((i) => i.key === item.key) || x.cur?.key === item.key) return false;
  if (item.pri <= 3 && x.cur && x.cur.pri - item.pri >= 3) { stopCurrent(player, x); x.q.unshift(item); return true; }  // interrupção por prioridade mais alta
  x.q.push(item); x.q.sort((a, b) => a.pri - b.pri || a.at - b.at);
  while (x.q.length > QMAX) x.q.pop();                       // descarta as de menor prioridade
  return true;
}
function stopCurrent(player, x) {
  if (x.cur?.sound) { try { player.runCommand(`stopsound @s ${x.cur.sound}`); } catch { /* ignore */ } }
  x.cur = null; x.until = 0;
}

/** Fala do Grande Sábio. opts: { cd (ticks), force } */
export function sageSay(player, key, opts = {}) {
  const ln = VOICE.lines[key]; if (!ln) return false;
  const d = getData(player), stage = sageStage(d);
  if (ln.s > stage && !opts.force) return false;
  const adv = stage >= 2, pri = priOf(key), sg = sageCfg(d);
  const mv = sg.style !== "pt" ? MODV[key] : null;
  const useMod = mv && stage <= 3;                           // Ciel tem voz própria (sem clipes do mod)
  const sfx = stage >= 4 ? "_c" : stage === 3 ? "_r" : stage === 2 ? "_b" : "";
  const sound = useMod ? `etheria.sage.${mv}` : `etheria.voice.sage.${key}${sfx}`;
  const dur = useMod ? (VOICE.mod[mv] ?? 50) : ({ "": ln.d, _b: ln.db, _r: ln.dr, _c: ln.dc }[sfx] ?? ln.d);
  return enqueue(player, { key: "sage." + key, who: ["SÁBIO", "SÁBIO", "GRANDE SÁBIO", "RAPHAEL", "CIEL"][stage] ?? "SÁBIO", sound, text: ln.t, dur, pri, cd: opts.cd ?? (pri <= 4 ? 0 : 200), at: system.currentTick, tone: ["§b", "§b", "§3", "§d", "§e"][stage] ?? "§b", sage: true, stage });
}
/** Fala de um SISTEMA do jogo (identidade vocal própria): main, combat, skills, magic, race, raceevo, inv. */
const SYSNAME = { main: "SISTEMA", combat: "COMBATE", skills: "HABILIDADES", magic: "MAGIA", race: "RAÇAS", raceevo: "EVOLUÇÃO RACIAL", inv: "INVENTÁRIO" };
const SYSPRI = { main: 7, combat: 6, skills: 7, magic: 7, race: 7, raceevo: 2, inv: 7 };
const SYSTONE = { main: "§f", combat: "§c", skills: "§a", magic: "§5", race: "§e", raceevo: "§6", inv: "§7" };
export function sysSay(player, sys, key, opts = {}) {
  const ln = VOICE.sys?.[sys]?.[key]; if (!ln) return false;
  const pri = opts.pri ?? (sys === "raceevo" && key === "ready" ? 5 : SYSPRI[sys] ?? 7);
  return enqueue(player, { key: `sys.${sys}.${key}`, who: SYSNAME[sys], sound: `etheria.voice.sys.${sys}.${key}`, text: ln.t, dur: ln.d, pri, cd: opts.cd ?? (sys === "combat" ? 1200 : 300), at: system.currentTick, tone: SYSTONE[sys], sage: false });
}
/** Fala própria de uma Habilidade Única: kind = act | cmb | awk | an | evo | fail | spec | m25 | m50 | m75 | m100 */
export function skillSay(player, skillId, kind, opts = {}) {
  const u = VOICE.uniques[skillId]; if (!u) return false;
  const ln = u.lines[kind] ?? VOICE.profiles[u.profile]?.[kind]; if (!ln) return false;
  const sound = u.lines[kind] ? `etheria.voice.u.${skillId}.${kind}` : `etheria.voice.p.${u.profile}.${kind}`;
  return enqueue(player, { key: `u.${skillId}.${kind}`, who: (SKILLS[skillId]?.name ?? skillId).toUpperCase(), sound, text: ln.t, dur: ln.d, pri: { act: 6, cmb: 7, awk: 3, evo: 2, an: 5, fail: 7, spec: 6 }[kind] ?? 7, cd: opts.cd ?? (kind === "act" ? 1800 : kind === "cmb" ? 2400 : 400), at: system.currentTick, tone: "§d", sage: false });
}

function subtitle(player, x, now) {
  const sg = sageCfg(getData(player)), c = x.cur; if (!sg.subs) return;
  const el = now - x.t0, total = PRE + c.dur + 10;
  const glow = Math.floor(el / 8) % 2 ? "§3" : c.tone;
  const icon = `${glow}${c.sage ? "◈" : "✦"} §l${c.who}§r`;
  let body;
  if (el < PRE) body = "§8· · ·";                                   // indicador de processamento
  else {
    const fi = Math.min(1, (el - PRE) / FADE), fo = Math.min(1, (total - el) / FADE);
    const k = Math.min(fi, fo), col = k > 0.75 ? "§f" : k > 0.4 ? "§7" : "§8";
    body = `${col}"${c.text}"`;
  }
  try { player.onScreenDisplay.setActionBar(`${icon} §8» ${body}`); } catch { /* ignore */ }
}

function tickPlayer(player, now) {
  const x = st.get(player.id); if (!x) return;
  const d = getData(player), sg = sageCfg(d);
  if (x.cur) {
    const c = x.cur, el = now - x.t0;
    if (!x.voiced && el >= PRE) { x.voiced = true; try { hook?.(player, { dur: c.dur, sage: c.sage, stage: c.stage }); } catch { /* ignore */ } try { if (sg.volume > 0) player.playSound(c.sound, { volume: Math.max(0.05, sg.volume / 100), pitch: 1 }); } catch { /* ignore */ } }
    subtitle(player, x, now);
    if (el >= PRE + c.dur) {
      if (sg.sfx !== false && sg.volume > 0) { try { player.playSound("etheria.voice.sfx.off", { volume: 0.35 * sg.volume / 100 }); } catch { /* ignore */ } }
      x.cur = null; x.gapUntil = now + GAP;
    }
    return;
  }
  if (x.gapUntil > now || !x.q.length) return;
  const c = x.q.shift(); x.cur = c; x.t0 = now; x.voiced = false; x.last = c.key; x.lastAt = now;
  if (sg.sfx !== false && sg.volume > 0) { try { player.playSound("etheria.voice.sfx.on", { volume: 0.35 * sg.volume / 100 }); } catch { /* ignore */ } }
}

export function startVoice() {
  system.runInterval(() => {
    const now = system.currentTick;
    for (const p of world.getAllPlayers()) { try { tickPlayer(p, now); } catch { /* ignore */ } }
  }, 2);
}
export function setVoiceOpt(player, k, v) { const sg = sageCfg(getData(player)); sg[k] = v; markDirty(player); }

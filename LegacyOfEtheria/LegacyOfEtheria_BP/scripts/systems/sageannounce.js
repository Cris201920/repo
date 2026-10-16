// systems/sageannounce.js - ANÚNCIOS DO GRANDE SÁBIO (6.31): o mesmo SISTEMA do mod de referência (Great Sage para Tensura), reimplementado para Bedrock.
// Nada é copiado do mod: só o comportamento. Áudios = os que já estão no pacote de recursos (sounds/etheria/sage/*), medidos em data/sagevoice.gen.js.
//
// MODELO (igual ao de referência)
//   Anúncio = PASSOS de áudio (som + instante em ms) + LINHAS (CEREMONY | RACE_FROM | RACE_TO | ANALYSED | TIER | SKILL), cada uma com revealAtMs.
//   A linha aparece no instante em que a fala dela começa; cada fala ocupa "duração do áudio + 30 ms"; sem áudio (nomes de habilidade/raça),
//   usa o tempo reserva: 620 ms por nome, 520 ms por categoria, 1600 ms por cerimônia.
//   Montagem:  sfx.open (0 ms, não atrasa)
//     cerimônia:  CEREMONY + fala da cerimônia [+ "tsuzukete" + RACE_FROM + "yori" + RACE_TO + "e_no_shinka"]
//     evolução:   ["koku" + "shinka_jouken"] + 2600 ms + "shounin" + RACE_FROM + "yori" + RACE_TO + "e_no_shinka"
//     análise:    ["koku"] + ANALYSED + nome + "kaiseki_kanryou"
//     habilidades:["koku"]
//     categorias (ordem extra, unique, ultimate, intrinsic, common, resistance): ["tsuzukete" se algo veio antes] + TIER + fala da categoria + SKILL x N
//     fim: "no_kakutoku" + "seiko_shimashita" (só anúncios de habilidades); sfx.skill em cada SKILL/ANALYSED
//     duração = máx(cursor + 550 ms + (cerimônia ? 2 s de espera : 0), 1700 ms)
//   GERENCIADOR: habilidades que chegam enquanto uma cerimônia/evolução/anúncio está aberto são ABSORVIDAS na mesma cena (a montagem é refeita;
//   o que já tocou não repete). O resto espera numa fila. Cerimônias que listam habilidades ficam abertas por mais 2 s para absorver.
// TELA: ui/hud_screen.json — fundo do núcleo animado (véu escuro nos anúncios, preto total + campo cósmico nas cerimônias), título, linhas
//   digitadas (420 ms por linha) e "impacto" a cada nome (onda de choque + clarão, recriando o título), legendas sincronizadas, paginação.
import { world, system } from "@minecraft/server";
import { DUR, CUES } from "../data/sagevoice.gen.js";
import { SKILL_CLIP, RACE_CLIP, SAGE_CLIP } from "../data/sagevoicemap.js";
import { getData, markDirty } from "../core/db.js";
import { nextStages, isLordStage } from "../data/races.js";
import { titleGuard } from "../core/utils.js";
import { VOICE } from "../data/voice.gen.js";
import { sageCfg, sageStage } from "./voice.js";

export const VOICE_MARK = "§w§v§x";
const THEME = { world: "§t§w", sage: "§t§s", raphael: "§t§r", ciel: "§t§c", tree: "§t§p" };
const FX = { none: "", open: "§1§9", slam: "§2§8" };
export const TIER_ORDER = ["extra", "unique", "ultimate", "intrinsic", "common", "resistance"];
const TIER_COL = { ultimate: "§c", unique: "§6", extra: "§e", intrinsic: "§a", common: "§f", resistance: "§b" };
const TXT = {
  pt: {
    tier: { extra: "HABILIDADE EXTRA", unique: "HABILIDADE ÚNICA", ultimate: "HABILIDADE ULTIMATE", intrinsic: "HABILIDADE INTRÍNSECA", common: "HABILIDADE COMUM", resistance: "RESISTÊNCIA" },
    ceremony: { hero_egg: "OVO DE HERÓI", demon_lord_seed: "SEMENTE DE LORDE DEMÔNIO", harvest_festival: "FESTIVAL DA COLHEITA", true_hero: "VERDADEIRO HERÓI", true_demon_lord: "VERDADEIRO LORDE DEMÔNIO" },
    sub: {
      demon_lord_seed: ["Aviso.", "Confirmada a aquisição da Semente de Lorde Demônio.", "Obtido o direito de devorar almas.", "Ao oferecer o número necessário de almas, o despertar como Verdadeiro Lorde Demônio se torna possível."],
      harvest_festival: ["Aviso.", "As condições foram cumpridas.", "O Festival da Colheita começa agora.", "Com as almas como preço, a evolução existencial será executada.", "Perda temporária de consciência confirmada.", "Recomenda-se ir para um local seguro."],
      hero_egg: ["Aviso.", "Confirmada a aquisição do Ovo de Herói.", "O receptáculo da alma começa a se transformar.", "Aguarde a hora do despertar."],
      true_hero: ["Aviso.", "Confirmado o cumprimento das condições de despertar.", "O indivíduo designado, o hospedeiro, desperta como Verdadeiro Herói.", "O receptáculo da alma foi reconstruído.", "Todos os valores de habilidade aumentaram drasticamente."],
      true_demon_lord: ["Aviso.", "O Festival da Colheita foi concluído.", "O indivíduo designado, o hospedeiro, despertou como Verdadeiro Lorde Demônio.", "Confirmados o aumento de todos os valores de habilidade e a evolução dos subordinados.", "Em seguida, relatarei as habilidades adquiridas."],
      evolution: ["Aviso.", "O hospedeiro cumpre as condições de evolução da espécie. Evolução solicitada à Voz do Mundo.", "...... Aprovação confirmada. O indivíduo designado, o hospedeiro,", "evoluiu com sucesso. Aumento do valor de existência e reestruturação das habilidades inatas confirmados."],
      analysis: "Análise concluída.",
      level: "Aviso. O valor de existência do hospedeiro aumentou.",
    },
    levelup: "SUBIU DE NÍVEL", level: "NÍVEL", attr: (n) => `+${n} pontos de atributo`, skillpt: "+1 ponto de habilidade", evo: "Condições de evolução cumpridas",
  },
  en: {
    tier: { extra: "EXTRA SKILL", unique: "UNIQUE SKILL", ultimate: "ULTIMATE SKILL", intrinsic: "INTRINSIC SKILL", common: "COMMON SKILL", resistance: "RESISTANCE" },
    ceremony: { hero_egg: "HERO EGG", demon_lord_seed: "DEMON LORD SEED", harvest_festival: "HARVEST FESTIVAL", true_hero: "TRUE HERO", true_demon_lord: "TRUE DEMON LORD" },
    sub: {
      demon_lord_seed: ["Notice.", "The Demon Lord Seed has been acquired.", "The right to devour souls is now held.", "Offer enough souls and awakening as a True Demon Lord becomes possible."],
      harvest_festival: ["Notice.", "The conditions are fulfilled.", "The Harvest Festival begins.", "With souls as the price, existential evolution will be carried out.", "A temporary loss of consciousness is confirmed.", "Moving somewhere safe is advised."],
      hero_egg: ["Notice.", "The Hero's Egg has been acquired.", "The vessel of the soul begins to change.", "Wait for the hour of awakening."],
      true_hero: ["Notice.", "The awakening conditions are fulfilled.", "The designated individual, the host, awakens as a True Hero.", "The vessel of the soul is rebuilt.", "Every ability value rises sharply."],
      true_demon_lord: ["Notice.", "The Harvest Festival is over.", "The designated individual, the host, has awakened as a True Demon Lord.", "Every ability value has risen, and the subordinates have evolved.", "Next, I will report the skills acquired."],
      evolution: ["Notice.", "The host meets the conditions for species evolution. Evolution is requested of the Voice of the World.", "...... Approval confirmed. The designated individual, the host,", "has evolved. Existence value rises and innate skills are restructured."],
      analysis: "Analysis complete.",
      level: "Notice. The host's existence value has increased.",
    },
    levelup: "LEVEL UP", level: "LEVEL", attr: (n) => `+${n} attribute points`, skillpt: "+1 skill point", evo: "Evolution conditions met",
  },
};
const CEREMONY_THEME = { hero_egg: "raphael", demon_lord_seed: "world", harvest_festival: "world", true_hero: "raphael", true_demon_lord: "world" };
const LISTS_SKILLS = { hero_egg: false, demon_lord_seed: false, harvest_festival: false, true_hero: true, true_demon_lord: true };
const HOLD_MS = 2000, TYPE_MS = 420, PAGE = 9, NAME_MS = 620, TIER_MS = 520, CER_MS = 1600;

// 6.38: VOZ EM PORTUGUÊS (padrão). "pt:<fala>" = clipe etheria.voice.sage.<fala><estágio>; "sys:<sistema>.<fala>" = etheria.voice.sys.*.
// Os clipes japoneses do pacote Voz só tocam se o jogador escolher "Japonês" nas configurações do Grande Sábio.
let SFX = "";   // sufixo do estágio do Sábio (""/_b/_r/_c) da cena sendo montada
const SND = (k) => k.startsWith("pt:") ? `etheria.voice.sage.${k.slice(3)}${SFX}` : k.startsWith("sys:") ? `etheria.voice.sys.${k.slice(4)}` : `etheria.sage.${k}`;
const ptDur = (k) => { const ln = VOICE.lines[k]; if (!ln) return 0; return ({ "": ln.d, _b: ln.db, _r: ln.dr, _c: ln.dc }[SFX] ?? ln.d) * 50; };
const dur = (k) => !k ? 0 : k.startsWith("pt:") ? ptDur(k.slice(3)) : k.startsWith("sys:") ? ((() => { const [a, b] = k.slice(4).split("."); return (VOICE.sys?.[a]?.[b]?.d ?? 0) * 50; })()) : (DUR[k] ?? 0);
const PT = { "voice.koku": "pt:dg_attention", "voice.shinka_jouken": "pt:evo_ready", "voice.shounin": "pt:evo_proc", "voice.e_no_shinka": "pt:evo_done", "voice.kaiseki_kanryou": "pt:an_done", "voice.no_kakutoku": "pt:skill_acquired" };
let PTMODE = false;
/** traduz a chave de áudio da cena para o clipe em português (ou nenhum: nomes/categorias em japonês não têm equivalente falado) */
const tr = (k) => { if (!PTMODE || !k || k.startsWith("sfx.") || k.startsWith("pt:") || k.startsWith("sys:")) return k; if (PT[k]) return PT[k]; if (k.startsWith("ceremony.")) return "pt:awk_start"; return ""; };
// 6.55: as vozes sintetizadas (pt:/sys:) foram retiradas -> as cenas tocam só as GRAVAÇÕES ORIGINAIS (japonês do mod) e o texto aparece na tela
const voiceMode = (p) => { try { const d = getData(p); PTMODE = false; const st = sageStage(d); SFX = st >= 4 ? "_c" : st === 3 ? "_r" : st === 2 ? "_b" : ""; } catch { PTMODE = true; SFX = ""; } };
const lang = (p) => { try { return getData(p)?.settings?.voiceLang === "en" ? "en" : "pt"; } catch { return "pt"; } };
const enabled = (p) => { try { return getData(p)?.settings?.cinematic !== false; } catch { return true; } };
const ok = (p) => { try { return p.isValid; } catch { return false; } };

/** emit: igual à referência — com áudio, agenda o passo e avança duração + 30 ms; sem áudio, avança o tempo reserva */
function emit(steps, key, at, fallback) { key = tr(key); const d = key ? dur(key) : 0; if (d <= 0) return at + fallback; steps.push({ key, at }); return at + d + 30; }

/** áudio que fala o nome: habilidade (mesmo id ou mapa), raça (id do estágio) ou etapa do Sábio */
export const skillKey = (id) => { const k = SKILL_CLIP[id] ?? id; return DUR[`skill.${k}`] ? `skill.${k}` : ""; };
export const raceKey = (stageId, name) => { const k = RACE_CLIP[stageId] ?? SAGE_CLIP[name]; return k && DUR[`race.${k}`] ? `race.${k}` : k && DUR[`skill.${k}`] ? `skill.${k}` : ""; };
/** monta o anúncio. o = { ceremony?, evolution?: {from, to}, analysis?: {name}, entries: [{id, name, tier}], notice } */
export function build(o, L) {
  const steps = [], lines = [], sub = []; let c = 0;
  emit(steps, "sfx.open", 0, 0);   // abre o núcleo sem atrasar a fala
  const T = TXT[L];
  if (o.ceremony) {
    lines.push({ type: "CEREMONY", text: T.ceremony[o.ceremony], at: c });
    const start = c; c = emit(steps, `ceremony.${o.ceremony}`, c, CER_MS);
    cueSubtitles(sub, T.sub[o.ceremony], CUES[o.ceremony] ?? [], start);
    if (o.evolution) {
      c = emit(steps, "voice.tsuzukete", c, 0);
      lines.push({ type: "RACE_FROM", text: o.evolution.from, at: c }); c = emit(steps, o.evolution.fromKey, c, NAME_MS);
      c = emit(steps, "voice.yori", c, 0);
      lines.push({ type: "RACE_TO", text: o.evolution.to, at: c }); c = emit(steps, o.evolution.toKey, c, NAME_MS);
      c = emit(steps, "voice.e_no_shinka", c, 0);
    }
  } else if (o.evolution) {
    const S = T.sub.evolution;
    if (o.notice) { sub.push({ text: S[0], at: c }); c = emit(steps, "voice.koku", c, 0); sub.push({ text: S[1], at: c }); c = emit(steps, "voice.shinka_jouken", c, CER_MS); }
    c += 2600;
    sub.push({ text: S[2], at: c }); c = emit(steps, "voice.shounin", c, 700);
    lines.push({ type: "RACE_FROM", text: o.evolution.from, at: c }); c = emit(steps, o.evolution.fromKey, c, NAME_MS);
    c = emit(steps, "voice.yori", c, 0);
    lines.push({ type: "RACE_TO", text: o.evolution.to, at: c }); c = emit(steps, o.evolution.toKey, c, NAME_MS);
    sub.push({ text: S[3], at: c }); c = emit(steps, "voice.e_no_shinka", c, 0);
  } else if (o.analysis) {
    if (o.notice) c = emit(steps, "voice.koku", c, 0);
    lines.push({ type: "ANALYSED", text: o.analysis.name, at: c }); c = emit(steps, o.analysis.key, c, NAME_MS);
    sub.push({ text: T.sub.analysis, at: c }); c = emit(steps, "voice.kaiseki_kanryou", c, 0);
  } else if (o.info) {
    c = emit(steps, "voice.koku", c, 0);
    lines.push({ type: "TIER", tier: o.info.tier ?? "intrinsic", text: o.info.header, at: c }); c += 700;
    lines.push({ type: "SKILL", text: `§a§l${o.info.name}`, at: c }); c += NAME_MS + 200;
    if (o.info.hint) { lines.push({ type: "RACE_FROM", text: o.info.hint, at: c }); c += 600; }
  } else if (o.level) {
    sub.push({ text: T.sub.level, at: c }); c = emit(steps, "voice.koku", c, 0); if (PTMODE) c = emit(steps, "sys:main.levelup", c, 0);
    lines.push({ type: "TIER", tier: "extra", text: T.levelup, at: c }); c += 700;
    lines.push({ type: "SKILL", text: `§e§l${T.level} ${o.level.to}`, at: c }); c += NAME_MS + 200;
    for (const x of [T.attr(o.level.attr), o.level.skillPt ? T.skillpt : "", o.level.evo ? `${T.evo}: §a${o.level.evo}` : ""]) if (x) { lines.push({ type: "RACE_FROM", text: x, at: c }); c += 520; }
  } else if (o.notice) c = emit(steps, "voice.koku", c, 0);
  // categorias, na ordem configurada; o que não estiver na ordem vai ao fim
  const groups = new Map();
  for (const e of o.entries ?? []) { const t = TIER_ORDER.includes(e.tier) ? e.tier : "common"; if (!groups.has(t)) groups.set(t, []); groups.get(t).push(e); }
  let before = !!(o.ceremony || o.evolution || o.analysis || o.level);
  for (const t of TIER_ORDER) {
    const g = groups.get(t); if (!g) continue;
    if (before) c = emit(steps, "voice.tsuzukete", c, 0);
    before = true;
    lines.push({ type: "TIER", text: T.tier[t], tier: t, at: c }); c = emit(steps, `tier.${t}`, c, TIER_MS);
    for (const e of g) { lines.push({ type: "SKILL", text: e.name, tier: t, at: c }); c = emit(steps, skillKey(e.id), c, NAME_MS); }
  }
  if (o.notice && (o.entries ?? []).length && !o.ceremony && !o.evolution) {
    if (PTMODE) c = emit(steps, (o.entries ?? []).some((e) => e.tier === "unique" || e.tier === "ultimate") ? "pt:unique_acquired" : "pt:skill_acquired", c, 0);
    else { c = emit(steps, "voice.no_kakutoku", c, 0); c = emit(steps, "voice.seiko_shimashita", c, 0); }
  }
  for (const l of lines) if (l.type === "SKILL" || l.type === "ANALYSED") steps.push({ key: "sfx.skill", at: l.at });
  steps.sort((a, b) => a.at - b.at);
  const durationMs = Math.max(c + 550 + (o.ceremony ? HOLD_MS : 0), 1700);
  return { lines, steps, sub, durationMs, theme: o.ceremony ? CEREMONY_THEME[o.ceremony] : o.evolution ? "raphael" : o.theme ?? "sage" };
}
/** distribui as frases da legenda pelos trechos de fala detectados no áudio (proporcional ao tamanho do texto, sempre em ordem) */
function cueSubtitles(out, texts, segs, base) {
  if (!texts?.length) return;
  if (!segs.length) { texts.forEach((t, i) => out.push({ text: t, at: base + i * 1800, until: base + (i + 1) * 1800 })); return; }
  const total = texts.reduce((a, t) => a + t.length, 0), span = segs[segs.length - 1][1] - segs[0][0];
  let acc = 0, si = 0;
  texts.forEach((t, i) => {
    const want = segs[0][0] + (acc / total) * span; acc += t.length;
    if (i === 0) si = 0; else { let best = si + 1; for (let k = si + 1; k < segs.length - (texts.length - 1 - i); k++) if (Math.abs(segs[k][0] - want) < Math.abs(segs[best][0] - want)) best = k; si = Math.min(best, segs.length - 1); }
    out.push({ text: t, at: base + segs[si][0] });
  });
  out.forEach((x, i) => { x.until = i + 1 < out.length ? out[i + 1].at : base + segs[segs.length - 1][1] + 900; });
}

// ------------------------------------------------------------------ gerenciador por jogador
const S = new Map();   // pid -> { cur: {o, A, t0, nextStep, played:Set, lastLines, lastFx, open:bool, deadlineMs}, queue: [], pending: [], pendTimer }
const st = (p) => { let s = S.get(p.id); if (!s) S.set(p.id, s = { cur: null, queue: [], pending: [], pendTimer: 0 }); return s; };
/** a cena nova está ligada para este jogador? (então os avisos antigos de "habilidade obtida" não aparecem) */
export const sceneOn = (p) => enabled(p);
export const announcing = (p) => { try { return !!S.get(p.id)?.cur; } catch { return false; } };
titleGuard.busy = (p) => announcing(p);

function nowMs(s) { return (system.currentTick - s.cur.t0) * 50; }
/** a cena aberta ainda aceita habilidades? (referência: cerimônia/evolução/anúncio abertos até a lista terminar + espera) */
function canAbsorb(s) { const c = s.cur; return !!c && c.open && nowMs(s) < c.A.durationMs; }

function startNow(p, o) {
  voiceMode(p); const s = st(p), L = lang(p), A = build(o, L);
  s.cur = { o, A, L, t0: system.currentTick, nextStep: 0, shown: -1, page: 0, fxCount: 0, open: o.ceremony ? LISTS_SKILLS[o.ceremony] : true, lastSub: null };
  renderFrame(p, true);
}
function rebuild(p) { voiceMode(p); const s = st(p), c = s.cur; const A = build(c.o, c.L); c.A = A; c.nextStep = A.steps.findIndex((x) => x.at > nowMs(s)); if (c.nextStep < 0) c.nextStep = A.steps.length; }

/** enfileira um anúncio (ou começa já) */
function submitAnn(p, o) { const s = st(p); if (!s.cur) startNow(p, o); else s.queue.push(o); }

/** habilidade recebida: absorve na cena aberta, senão agrupa as que chegarem em ~1 s (como a referência) */
export function announceSkill(p, entry) {
  if (!ok(p)) return;
  const s = st(p);
  if (!enabled(p)) { try { p.sendMessage(`${TIER_COL[entry.tier] ?? "§f"}[${TXT[lang(p)].tier[entry.tier] ?? entry.tier}] §f${entry.name}`); } catch { /* ignore */ } return; }
  if (canAbsorb(s) && !s.cur.o.entries.some((e) => e.id === entry.id)) { s.cur.o.entries.push(entry); s.cur.A.durationMs = Math.max(s.cur.A.durationMs, nowMs(s) + 800); rebuild(p); return; }
  const q = s.queue.find((o) => !o.ceremony && !o.evolution && !o.analysis) ?? (s.queue.find((o) => o.ceremony && LISTS_SKILLS[o.ceremony]));
  if (q && !q.entries.some((e) => e.id === entry.id)) { q.entries.push(entry); return; }
  s.pending.push(entry);
  if (s.pendTimer) system.clearRun(s.pendTimer);
  s.pendTimer = system.runTimeout(() => { s.pendTimer = 0; const list = s.pending.splice(0); if (list.length && ok(p)) submitAnn(p, { entries: list, notice: true }); }, 20);
}
export function announceCeremony(p, type, evolution) {
  if (!ok(p) || !TXT.pt.ceremony[type]) return;
  if (!enabled(p)) { try { p.sendMessage(`§c§l${TXT[lang(p)].ceremony[type]}§r §7${TXT[lang(p)].sub[type].join(" ")}`); } catch { /* ignore */ } return; }
  const s = st(p); if (LISTS_SKILLS[type] && s.pendTimer) { system.clearRun(s.pendTimer); s.pendTimer = 0; }
  const entries = LISTS_SKILLS[type] ? s.pending.splice(0) : [];
  submitAnn(p, { ceremony: type, evolution, entries, notice: false });
}
/** Lorde Demônio: Festival da Colheita e, em seguida, Verdadeiro Lorde Demônio, que relata as habilidades adquiridas */
export function announceLordAwakening(p, evolution) {
  if (!ok(p)) return;
  const s = st(p); if (s.pendTimer) { system.clearRun(s.pendTimer); s.pendTimer = 0; }
  if (!enabled(p)) { announceCeremony(p, "true_demon_lord"); return; }
  submitAnn(p, { ceremony: "harvest_festival", entries: [], notice: false });
  submitAnn(p, { ceremony: "true_demon_lord", evolution, entries: s.pending.splice(0), notice: false });
}
export function announceEvolution(p, from, to, fromId, toId) {
  if (!ok(p)) return;
  if (!enabled(p)) { try { p.sendMessage(`§6${from} §7» §6${to}`); } catch { /* ignore */ } return; }
  const s = st(p); if (s.pendTimer) { system.clearRun(s.pendTimer); s.pendTimer = 0; }
  submitAnn(p, { evolution: { from, to, fromKey: raceKey(fromId, from), toKey: raceKey(toId, to) }, entries: s.pending.splice(0), notice: true });
}
/** subiu de nível: mostrado na cena da Voz do Mundo (6.36) em vez de chat + título + barra. info = { attr, skillPt, evo } */
export function announceLevel(p, to, info = {}) {
  if (!ok(p)) return;
  if (!enabled(p)) { try { p.sendMessage(`§6§l[Etheria]§r §eNível §f${to}§e!`); } catch { /* ignore */ } return; }
  const s = st(p), c = s.cur;
  // vários níveis seguidos: atualiza o anúncio que ainda está na fila em vez de empilhar cenas
  const q = s.queue.find((x) => x.level); if (q) { q.level = { ...q.level, ...info, to, attr: (q.level.attr ?? 0) + (info.attr ?? 0) }; return; }
  if (c?.o.level && nowMs(s) < 600) { c.o.level = { ...c.o.level, ...info, to, attr: (c.o.level.attr ?? 0) + (info.attr ?? 0) }; rebuild(p); return; }
  submitAnn(p, { level: { to, ...info }, entries: [], theme: "sage" });
}
/** aviso curto na cena (ex.: evolução disponível). Se houver um anúncio de nível na fila/tela, vira uma linha dele. */
export function announceInfo(p, header, name, hint = "", tier = "intrinsic") {
  if (!ok(p)) return;
  if (!enabled(p)) { try { p.sendMessage(`§a§l${header}§r §f${name}`); } catch { /* ignore */ } return; }
  const s = st(p), q = s.queue.find((x) => x.level) ?? (s.cur?.o.level ? s.cur.o : null);
  if (q && tier === "intrinsic") { q.level.evo = name; if (q === s.cur?.o) rebuild(p); return; }
  submitAnn(p, { info: { header, name, hint, tier }, entries: [], theme: "sage" });
}
export function announceAnalysis(p, name) { if (ok(p) && enabled(p)) submitAnn(p, { analysis: { name }, entries: [], notice: true }); }

// ------------------------------------------------------------------ desenho (a cada tick)
function lineText(l, t, L) {
  if (l.type === "CEREMONY") return null;
  const k = Math.min(1, Math.max(0, (t - l.at) / TYPE_MS));
  const full = l.type === "TIER" ? `${TIER_COL[l.tier]}§l${l.text}` : l.type === "SKILL" ? `§f${l.text}` : l.type === "ANALYSED" ? `§b${l.text}` : l.type === "RACE_TO" ? `§6§l${l.text}` : `§7${l.text}`;
  if (l.type === "SKILL" || l.type === "ANALYSED") return full;           // nomes entram de uma vez (impacto)
  const raw = l.text, n = Math.max(1, Math.ceil(raw.length * k));       // categorias e raças são digitadas
  return full.slice(0, full.length - raw.length + n) + (k < 1 ? "§8_" : "");
}
function renderFrame(p, first = false) {
  const s = st(p), c = s.cur; if (!c) return;
  const t = nowMs(s), A = c.A;
  // sons no instante certo
  while (c.nextStep < A.steps.length && A.steps[c.nextStep].at <= t) {
    const k = A.steps[c.nextStep++].key; voiceMode(p);
    let vol = 1; try { const sg = sageCfg(getData(p)); vol = k.startsWith("sfx.") ? 1 : sg.voice === false ? 0 : Math.max(0.05, (sg.volume ?? 80) / 100); } catch { /* ignore */ }
    if (vol > 0) { try { p.playSound(SND(k), { volume: vol, pitch: 1 }); } catch { /* ignore */ } }
  }
  const vis = A.lines.filter((l) => l.at <= t);
  const cer = A.lines.find((l) => l.type === "CEREMONY" && l.at <= t);
  const list = vis.filter((l) => l.type !== "CEREMONY");
  // paginação: a página atual começa na primeira linha que ainda cabe
  const pageStart = Math.floor(Math.max(0, list.length - 1) / PAGE) * PAGE;
  const body = list.slice(pageStart).map((l) => lineText(l, t, c.L)).join("\n");
  const subs = A.sub.filter((x) => x.at <= t), last = subs[subs.length - 1], narr = last && t < (last.until ?? last.at + 2600) ? last.text : "";
  const subtitle = `${body}${narr ? `${body ? "\n\n" : "\n\n\n\n\n\n\n"}§7${narr}` : ""}` || " ";
  const newSlam = vis.filter((l) => l.type === "SKILL" || l.type === "ANALYSED").length;
  const fx = first ? "open" : newSlam > c.fxCount ? "slam" : null;
  if (newSlam > c.fxCount) c.fxCount = newSlam;
  const title = `${VOICE_MARK}${THEME[A.theme] ?? THEME.sage}${c.o.ceremony ? "§3§7" : ""}${FX[fx ?? "none"]}§r${cer ? `§c§l${cer.text}` : ""}`;
  try {
    if (fx || c.lastTitle !== title.replace(/§1§9|§2§8/, "")) { p.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 0, stayDuration: 400, fadeOutDuration: 0 }); c.lastTitle = title.replace(/§1§9|§2§8/, ""); c.lastSub = subtitle; c.keep = system.currentTick; }
    else if (subtitle !== c.lastSub) { p.onScreenDisplay.updateSubtitle(subtitle); c.lastSub = subtitle; }
    if (system.currentTick - (c.keep ?? 0) > 300) { p.onScreenDisplay.setTitle(title.replace(/§1§9|§2§8/, ""), { subtitle, fadeInDuration: 0, stayDuration: 400, fadeOutDuration: 0 }); c.keep = system.currentTick; }
  } catch { /* ignore */ }
  if (t >= A.durationMs) finish(p);
}
function finish(p) {
  const s = st(p); s.cur = null;
  try { p.onScreenDisplay.setTitle(" ", { subtitle: " ", fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 }); } catch { /* ignore */ }
  const next = s.queue.shift(); if (next && ok(p)) system.runTimeout(() => { if (ok(p) && !st(p).cur) startNow(p, next); }, 6);
}
export function announceClear(p) { const s = S.get(p.id); if (s) { s.cur = null; s.queue = []; } try { p.onScreenDisplay.setTitle(" ", { subtitle: " ", fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 }); } catch { /* ignore */ } }

export function startAnnouncements() {
  system.runInterval(() => {
    for (const [pid, s] of S) {
      if (!s.cur) continue;
      const p = world.getEntity?.(pid) ?? world.getAllPlayers().find((x) => x.id === pid);
      if (!p || !ok(p)) { S.delete(pid); continue; }
      try { renderFrame(p); } catch (e) { console.warn(`[Etheria] anúncio: ${e}`); announceClear(p); }
    }
  }, 1);
  world.afterEvents.playerLeave.subscribe((ev) => S.delete(ev.playerId));
  system.runInterval(() => {   // Semente de Lorde Demônio: a primeira vez que o caminho para Lorde Demônio se abre (nível do estágio atingido)
    for (const p of world.getAllPlayers()) {
      try { const d = getData(p); if (d.sageCer?.dls) continue; const lord = nextStages(d).find((x) => x && isLordStage(x.id)); if (!lord || d.level < lord.minLevel) continue;
        d.sageCer = { ...(d.sageCer ?? {}), dls: 1 }; markDirty(p); announceCeremony(p, "demon_lord_seed"); } catch { /* ignore */ }
    }
  }, 200);
  world.afterEvents.playerSpawn.subscribe((ev) => { if (!announcing(ev.player)) system.runTimeout(() => { if (!announcing(ev.player)) { try { ev.player.onScreenDisplay.setTitle(" ", { fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 }); } catch { /* ignore */ } } }, 5); });
}

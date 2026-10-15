// systems/sageknow.js - Arquivo de conhecimento (Enciclopédia), memória, progressão interna e requisitos de evolução do Sábio.
// Sem dependência de sage.js (evita import circular): skills/discovery/combat podem registrar fatos aqui.
import { getData, markDirty } from "../core/db.js";
import { SAGE_EVO, SAGE_LEARN, SAGE_BASE } from "../config.js";
import { sageCfg, sageSay } from "./voice.js";
import { countItem } from "../core/utils.js";
import { emit, EV } from "../core/bus.js";

// Categorias da base de conhecimento (SKILLS · MOBS · RAÇAS · ITENS · ARMAS · ARMADURAS · MAGIAS · MATERIAIS · ESTRUTURAS · EVOLUÇÕES · AMBIENTE · COMBATE).
// "creatures" = MOBS, "phenomena" = AMBIENTE; "blocks", "bosses" e "recipes" são extras do addon.
export const CATS = [["creatures", "Criaturas"], ["skills", "Habilidades"], ["magic", "Magias"], ["items", "Itens"], ["weapons", "Armas"], ["armor", "Armaduras"], ["materials", "Materiais"], ["races", "Raças"],
  ["blocks", "Blocos"], ["structures", "Estruturas"], ["bosses", "Bosses"], ["phenomena", "Ambiente e fenômenos"], ["recipes", "Receitas"], ["evolutions", "Evoluções"], ["combat", "Combate"]];
const EXPW = { creatures: 4, skills: 6, magic: 6, items: 3, weapons: 4, armor: 4, materials: 3, races: 5, blocks: 2, structures: 8, bosses: 10, phenomena: 6, recipes: 4, evolutions: 12, combat: 5 };
/** LIMITES: a base nunca cresce sem fim (o save do jogador é um texto de tamanho finito). Passou do teto, sai o registro menos recente. */
export const KB_CAP = Object.freeze({ creatures: 90, skills: 160, magic: 60, items: 70, weapons: 110, armor: 70, materials: 50, races: 24, blocks: 40, structures: 24, bosses: 24, phenomena: 30, recipes: 100, evolutions: 60, combat: 30 });
/** Categorias pequenas e valiosas: nunca são descartadas (o tamanho delas já é limitado pelo próprio jogo). */
const KB_PINNED = new Set(["bosses", "structures", "evolutions", "races"]);
export const KB_NAME_MAX = 40, KB_MEM_MAX = 40, KB_OBS_MAX = 160, KB_SEEN_MAX = 160, KB_ARCHIVE_MAX = 120, KB_RES_MAX = 80;
export const KNOW_TARGET = 120;
export const STAGE_NAME = ["Sábio", "Sábio", "Grande Sábio", "Raphael", "Ciel"];
export const stageName = (st) => STAGE_NAME[st] ?? "Sábio";

export function kb(d) {
  const sg = sageCfg(d); sg.know ??= {};
  for (const [k] of CATS) sg.know[k] ??= {};
  if (!sg.knowMig) { sg.knowMig = true; for (const [id, e] of Object.entries(sg.archive ?? {})) sg.know.creatures[id] ??= { n: e.n ?? 1, name: id.split(":")[1] }; }
  return sg.know;
}
export const kcount = (d) => { const k = kb(d); let n = 0; for (const [c] of CATS) n += Object.keys(k[c]).length; return n; };

/** Registra conhecimento. Retorna { isNew, entry }. */
export function learn(player, cat, id, name, extra = {}, quiet = false) {
  const d = getData(player), sg = sageCfg(d), k = kb(d)[cat]; if (!k) return { isNew: false };
  let e = k[id], isNew = false;
  if (!e) {
    trim(k, cat, 1);                                                    // abre espaço ANTES de inserir (limite por categoria)
    e = k[id] = { n: 0, name: clip(name ?? id), ...extra }; isNew = true; sg.exp = (sg.exp ?? 0) + (EXPW[cat] ?? 2); sg.learnedAt = Date.now();
  } else if (!KB_PINNED.has(cat)) { delete k[id]; k[id] = e; }          // acessado agora: vai para o fim (o mais antigo fica no início)
  e.n = Math.min(9999, e.n + 1); if (name) e.name = clip(name);
  if (isNew) {
    markDirty(player); if (["bosses", "structures", "phenomena", "evolutions", "races"].includes(cat)) remember(player, "know", `Registrado (${CATS.find((c) => c[0] === cat)[1]}): ${e.name}`); if (!quiet) sageSay(player, "kb_new", { cd: 900 });
    const kind = DISCOVERY_EVENT[cat]; if (kind) { try { emit(kind, { player, cat, id, name: e.name }); } catch { /* ignore */ } }   // PLAYER_DISCOVERS_ENTITY / _ITEM
  }
  return { isNew, entry: e };
}
/** Categoria da base -> evento de descoberta (o Sábio escuta; ver sageadapter.js). */
const DISCOVERY_EVENT = { creatures: EV.PLAYER_DISCOVERS_ENTITY, bosses: EV.PLAYER_DISCOVERS_ENTITY, items: EV.PLAYER_DISCOVERS_ITEM, weapons: EV.PLAYER_DISCOVERS_ITEM, armor: EV.PLAYER_DISCOVERS_ITEM, materials: EV.PLAYER_DISCOVERS_ITEM };
const clip = (t) => { const x = String(t ?? ""); return x.length > KB_NAME_MAX ? x.slice(0, KB_NAME_MAX - 1) + "…" : x; };
/** Remove os registros menos recentes de `k` até caber `room` novos. Retorna quantos saíram. */
function trim(k, cat, room = 0) {
  const cap = (KB_CAP[cat] ?? 40) * (KB_PINNED.has(cat) ? 3 : 1);   // categorias "fixas" quase nunca saem, mas têm teto duro (o save tem tamanho finito)
  const keys = Object.keys(k); let over = keys.length + room - cap, out = 0;
  if (over <= 0) return 0;
  for (const id of keys) { if (over <= 0) break; if (k[id]?.pin) continue; delete k[id]; over--; out++; }
  return out;
}
const trimMap = (m, max) => {
  if (!m || typeof m !== "object" || Array.isArray(m)) return 0;
  const keys = Object.keys(m); let over = keys.length - max, out = 0;
  for (const key of keys) { if (over <= 0) break; delete m[key]; over--; out++; }
  return out;
};
/** Aplica TODOS os limites da memória do Sábio (idempotente e barato quando já está dentro). Retorna quantos itens foram descartados. */
export function enforceLimits(sg) {
  let out = 0;
  if (sg.know && typeof sg.know === "object") for (const [c] of CATS) if (sg.know[c]) { for (const [id, e] of Object.entries(sg.know[c])) if (!e || typeof e !== "object") { delete sg.know[c][id]; out++; } out += trim(sg.know[c], c); }
  out += trimMap(sg.obs, KB_OBS_MAX) + trimMap(sg.seen, KB_SEEN_MAX) + trimMap(sg.archive, KB_ARCHIVE_MAX) + trimMap(sg.res, KB_RES_MAX);
  if (Array.isArray(sg.mem)) while (sg.mem.length > KB_MEM_MAX) { sg.mem.shift(); out++; }
  if (Array.isArray(sg.sug)) while (sg.sug.length > 8) { sg.sug.pop(); out++; }
  if (Array.isArray(sg.dec)) while (sg.dec.length > 12) { sg.dec.pop(); out++; }
  return out;
}

/** Fachada da base de conhecimento (KnowledgeDatabase): consulta e registro por categoria, sempre dentro dos limites. */
export const KnowledgeDatabase = Object.freeze({
  categories: () => CATS.map(([id, label]) => ({ id, label, cap: KB_CAP[id] ?? 40 })),
  add: (player, cat, id, name, extra, quiet) => learn(player, cat, id, name, extra, quiet),
  has: (player, cat, id) => !!kb(getData(player))[cat]?.[id],
  get: (player, cat, id) => kb(getData(player))[cat]?.[id],
  count: (player, cat) => { const k = kb(getData(player)); return cat ? Object.keys(k[cat] ?? {}).length : kcount(getData(player)); },
  limit: (cat) => KB_CAP[cat] ?? 40,
  enforce: (player) => enforceLimits(sageCfg(getData(player))),
});

export function addExp(player, n) { const sg = sageCfg(getData(player)); sg.exp = (sg.exp ?? 0) + n; }
export function addBond(player, n) { const sg = sageCfg(getData(player)); sg.bond = Math.min(999, (sg.bond ?? 0) + n); markDirty(player); }

/** Memória cronológica (últimos 40 fatos importantes). */
export function remember(player, type, text) {
  const sg = sageCfg(getData(player)); sg.mem ??= []; sg.mem.push({ t: Date.now(), type, text }); while (sg.mem.length > KB_MEM_MAX) sg.mem.shift(); markDirty(player);
}

export const masteryTotal = (d) => Object.values(d.mastery ?? {}).reduce((a, xp) => a + Math.min(10, Math.floor(Math.sqrt(xp / 4))), 0);
const bossTotal = (d) => Object.values(d.bossKills ?? {}).reduce((a, b) => a + b, 0);

/** Requisitos de evolução para o estágio `to` (2 Grande Sábio · 3 Raphael · 4 Ciel). Retorna lista [{ok, text, tag}]. */
export function evoReq(player, to) {
  const d = getData(player), sg = sageCfg(d), cfg = to === 2 ? SAGE_EVO.gs : to === 3 ? SAGE_EVO.raph : SAGE_EVO.ciel, out = [];
  const A = (ok, text, tag = "ADAPTAÇÃO") => out.push({ ok, text, tag });
  A(d.level >= cfg.level, `Nível ${cfg.level} (${d.level})`);
  A(sg.analyses >= cfg.analyses, `${cfg.analyses} análises (${sg.analyses})`);
  A(kcount(d) >= cfg.knowledge, `${cfg.knowledge} registros de conhecimento (${kcount(d)})`);
  if (cfg.masteryTotal) A(masteryTotal(d) >= cfg.masteryTotal, `Maestria acumulada ${cfg.masteryTotal} (${masteryTotal(d)})`);
  if (to === 3) {
    A(d.coins >= cfg.coins, `${cfg.coins} moedas (${d.coins})`);
    const have = countItem(player, cfg.item); A(have >= cfg.n, `${cfg.n}x Fragmento do Vazio (${have})`);
    A(true, "Evento de evolução: Ritual de Raphael (a evolução do mestre libera o salto)", "CANÔNICO");
  }
  if (to === 4) {
    A((sg.bond ?? 0) >= cfg.bond, `Vínculo ${cfg.bond} (${sg.bond ?? 0}) — cresce ao lutar, vencer chefes e despertar habilidades`);
    A(Object.keys(d.awakened ?? {}).length >= cfg.awakened, `${cfg.awakened} habilidade despertada (${Object.keys(d.awakened ?? {}).length})`);
    A(bossTotal(d) >= cfg.bossKills, `${cfg.bossKills} chefes derrotados (${bossTotal(d)})`);
    A(true, "Evento de evolução: Ritual da Consciência (desenvolvimento de ego → Manas)", "CANÔNICO");
  }
  return out;
}
export const evoReady = (player, to) => evoReq(player, to).every((r) => r.ok);

/** Benefícios de aprendizado (por quantidade de análises). */
export function learnBonus(d) {
  const sg = sageCfg(d); let speed = 1, range = SAGE_BASE.range, adv = false; const got = [];
  for (const t of SAGE_LEARN) if (sg.analyses >= t.at) { if (t.speed) speed = t.speed; if (t.range) range = t.range; if (t.adv) adv = true; got.push(t); }
  return { speed, range, adv, got };
}

/** Seis barras internas 0..1 + nível do Sábio. */
export function prog(player) {
  const d = getData(player), sg = sageCfg(d), st = sg.ciel ? 4 : sg.raphael ? 3 : sg.gs ? 2 : 0;
  const next = st >= 4 ? null : evoReq(player, st >= 3 ? 4 : st >= 2 ? 3 : 2), wis = next ? next.filter((r) => r.ok).length / next.length : 1;
  const tiers = SAGE_LEARN.map((t) => t.at), nt = tiers.find((t) => sg.analyses < t) ?? tiers[tiers.length - 1], pt = [0, ...tiers][Math.max(0, tiers.indexOf(nt))] ?? 0;
  const lvl = Math.floor(Math.sqrt((sg.exp ?? 0) / 10)) + 1, base = Math.pow(lvl - 1, 2) * 10, nextXp = Math.pow(lvl, 2) * 10;
  const mods = st >= 4 ? 8 : st >= 3 ? 8 : st >= 2 ? 8 : 3;
  return { wisdom: wis, analysis: Math.min(1, (sg.analyses - pt) / Math.max(1, nt - pt)), knowledge: Math.min(1, kcount(d) / KNOW_TARGET), mastery: Math.min(1, masteryTotal(d) / 60),
    processing: Math.min(1, (mods / 8) * 0.6 + Math.min(0.4, (sg.tasks ?? 0) / 500)), exp: Math.min(1, ((sg.exp ?? 0) - base) / Math.max(1, nextXp - base)), lvl };
}

// ligações sem import circular: skills.js chama observeSpell; sage.js registra o observador
let spellHook = null;
export const setSpellHook = (fn) => { spellHook = fn; };
export const observeSpell = (player, id, caster) => { try { spellHook?.(player, id, caster); } catch { /* ignore */ } };

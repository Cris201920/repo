// core/db.js - Persistência via Dynamic Properties (JSON em uma única chave por jogador) + cache
import { system } from "@minecraft/server";
import { PROP_KEY, SAVE_INTERVAL_TICKS, DATA_VERSION, DEFAULT_FX, SKILLBAR } from "../config.js";
import { isValid } from "./utils.js";
import { migrate, sanitize } from "./migrate.js";

export function createDefaultData() {
  return {
    v: DATA_VERSION,
    level: 1, xp: 0,
    attributes: { strength: 5, defense: 5, intelligence: 5, agility: 5, vitality: 5 },
    attributePoints: 0, skillPoints: 0,
    mana: 40, stamina: 110,
    race: "human", raceStage: "human_1", raceChosen: false, kit: false, class: null, title: "Aventureiro",
    titles: ["Aventureiro"], achievements: [], visited: [],
    unlockedSkills: [], equippedSkills: [], slot: 0,
    loadout: { v: 1, pos: {} },      // habilidade -> slot do inventário onde o item dela fica (0-8 hotbar, 9-35 mochila)
    skillInst: {},                   // habilidade -> id único da instância do item (anti-duplicação)
    cd: {},                          // habilidade -> instante (ms, relógio real) em que fica pronta de novo (recargas persistem entre sessões)
    quests: { active: {}, completed: [], daily: {} },
    mastery: {}, stomach: {}, devoured: 0, absorbed: {}, blocksEaten: 0, mobPity: { s: 0, p: 0 }, sage: { archive: {}, voice: true, raphael: false, analyses: 0, volume: 80, sfx: true, subs: true, seen: {} }, sageGiven: false,
    stat: { hurt: 0, dist: 0, idle: 0, lastX: null, lastZ: null }, awakened: {},
    coins: 0, rank: 0, kills: 0, bossKills: {},
    guild: { id: null, rank: 0, reputation: 0, claimed: [] },
    settings: { hud: true, fx: DEFAULT_FX, compact: false, tracker: true, skillbar: { ...SKILLBAR.defaults } },
  };
}

// ---------------------------------------------------------------- armazenamento em PARTES
// O Bedrock limita cada propriedade dinâmica de texto (~32 mil caracteres). Um save maior que isso FALHA e o jogador perde o progresso
// sem aviso. writeBig/readBig dividem o texto em partes (chave, chave.1, chave.2...) e remontam na leitura; um texto pequeno continua
// sendo gravado exatamente como antes (compatível com saves antigos). A chave principal é gravada por último, então ela só aponta
// para as partes quando todas já estão no lugar.
export const CHUNK = 24000;        // caracteres por propriedade (margem para acentos e códigos de cor, que ocupam mais de 1 byte)
const HEAD = "~C";
const MAX_PARTS = 64;
const partsOf = (raw) => { if (typeof raw !== "string" || !raw.startsWith(HEAD)) return 1; const i = raw.indexOf(":"), n = parseInt(raw.slice(2, i), 10); return i > 2 && n >= 1 && n <= MAX_PARTS ? n : 1; };
function cut(text) {
  const out = []; let i = 0;
  while (i < text.length) {
    let e = Math.min(text.length, i + CHUNK);
    if (e < text.length) { const c = text.charCodeAt(e - 1); if (c >= 0xd800 && c <= 0xdbff) e--; }   // nunca separa um par de substituição (emoji)
    out.push(text.slice(i, e)); i = e;
  }
  return out;
}
/** Grava `text` em `key` (em partes se for grande). Devolve quantas partes foram usadas. Lança erro se a gravação falhar. */
// 9.2 (desempenho): nº de partes já gravadas por jogador+chave. Evita ler a 1ª parte inteira (até 24 mil caracteres) a cada save só para
// saber quantas partes antigas apagar. Só writeBig/readBig mexem nessas chaves; sem cache (1ª gravação da sessão) lê como antes.
const partsKnown = new Map();
export function writeBig(player, key, text) {
  const pk = player.id + "|" + key, prev = partsKnown.get(pk) ?? partsOf(player.getDynamicProperty(key));
  if (text.length <= CHUNK) {
    player.setDynamicProperty(key, text);
    for (let i = 1; i < prev; i++) player.setDynamicProperty(`${key}.${i}`, undefined);
    partsKnown.set(pk, 1);
    return 1;
  }
  const parts = cut(text);
  if (parts.length > MAX_PARTS) throw new Error(`texto grande demais (${text.length})`);
  for (let i = 1; i < parts.length; i++) player.setDynamicProperty(`${key}.${i}`, parts[i]);
  player.setDynamicProperty(key, `${HEAD}${parts.length}:${parts[0]}`);
  for (let i = parts.length; i < prev; i++) player.setDynamicProperty(`${key}.${i}`, undefined);
  partsKnown.set(pk, parts.length);
  return parts.length;
}
/** Lê o texto gravado por writeBig (ou o texto simples antigo). undefined se não existe; lança erro se faltar alguma parte. */
export function readBig(player, key) {
  const raw = player.getDynamicProperty(key);
  if (typeof raw !== "string") return undefined;
  if (!raw.startsWith(HEAD)) return raw;
  const n = partsOf(raw); if (n === 1 && !/^~C1:/.test(raw)) return raw;
  let out = raw.slice(raw.indexOf(":") + 1);
  for (let i = 1; i < n; i++) {
    const part = player.getDynamicProperty(`${key}.${i}`);
    if (typeof part !== "string") throw new Error(`parte ${i + 1}/${n} de ${key} ausente`);
    out += part;
  }
  return out;
}

const cache = new Map();   // player.id -> data
const dirty = new Set();
const players = new Map(); // player.id -> Player (para o flush)
const saveHooks = [];      // (player, data) => void | string, chamados imediatamente antes de gravar (ex.: congelar recargas)
const loadHooks = [];      // (player, data) => void, chamados logo depois de ler o save e ANTES da migração (ex.: memória do Sábio)
/** Gancho de gravação. Se devolver o NOME de um campo de topo (ex.: "sage"), o campo foi gravado em outro lugar e sai do save principal. */
export function onSave(fn) { saveHooks.push(fn); }
export function onLoad(fn) { loadHooks.push(fn); }

function merge(base, saved) {
  for (const k of Object.keys(saved ?? {})) {
    if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) merge(base[k], saved[k]);
    else base[k] = saved[k];
  }
  return base;
}

export function getData(player) {
  let d = cache.get(player.id);
  if (d) return d;
  d = createDefaultData();
  let savedV = DATA_VERSION;
  try {
    let raw; try { raw = readBig(player, PROP_KEY); } catch (e) { raw = player.getDynamicProperty(PROP_KEY); console.warn(`[Etheria] Save em partes incompleto de ${player.name}: ${e}`); }
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        savedV = Number.isInteger(parsed?.v) ? parsed.v : 1;   // lê a versão SALVA antes de mesclar (a migração depende dela)
        merge(d, parsed);
      }
      catch (e) {
        // Save corrompido: guarda o texto original antes que o autosave o sobrescreva
        try { player.setDynamicProperty(PROP_KEY + "_backup", raw); } catch { /* ignore */ }
        console.warn(`[Etheria] Save corrompido de ${player.name}; backup em ${PROP_KEY}_backup. ${e}`);
      }
    }
  } catch (e) {
    console.warn(`[Etheria] Falha ao ler dados de ${player.name}: ${e}`);
  }
  d.v = savedV;
  for (const h of loadHooks) { try { h(player, d); } catch (e) { console.warn(`[Etheria] gancho de carga de ${player.name}: ${e}`); } }
  try {
    const ran = migrate(d, savedV, DATA_VERSION);
    const fixes = sanitize(d);
    if (ran.length || fixes.length) { dirty.add(player.id); console.warn(`[Etheria] save de ${player.name}: migração ${ran.join(",") || "-"} saneamento ${fixes.join(",") || "-"}`); }
  } catch (e) { console.warn(`[Etheria] migração/saneamento de ${player.name}: ${e}`); }
  cache.set(player.id, d);
  players.set(player.id, player);
  return d;
}

export function markDirty(player) { dirty.add(player.id); players.set(player.id, player); }

const lastJson = new Map();   // 9.2: último texto gravado por jogador (o save principal só é escrito por saveNow)
export function saveNow(player) {
  const d = cache.get(player.id);
  if (!d) return;
  const external = [];
  for (const h of saveHooks) { try { const r = h(player, d); if (typeof r === "string") external.push(r); } catch (e) { console.warn(`[Etheria] gancho de save: ${e}`); } }
  try {
    let out = d;
    if (external.length) { out = { ...d }; for (const k of external) delete out[k]; }   // campos gravados à parte não entram de novo no save principal
    const json = JSON.stringify(out);
    if (json === lastJson.get(player.id)) { dirty.delete(player.id); return; }   // 9.2: nada mudou desde a última gravação: não regrava
    if (json.length > CHUNK * 3) { console.warn(`[Etheria] Save de ${player.name} muito grande (${json.length}).`); }
    writeBig(player, PROP_KEY, json);
    lastJson.set(player.id, json);
    dirty.delete(player.id);
  } catch (e) {
    console.warn(`[Etheria] Falha ao salvar ${player.name}: ${e}`);
  }
}

export function forget(playerId) {
  const p = players.get(playerId);
  if (p && dirty.has(playerId) && isValid(p)) saveNow(p);
  cache.delete(playerId); dirty.delete(playerId); players.delete(playerId); lastJson.delete(playerId);
  for (const k of [...partsKnown.keys()]) if (k.startsWith(playerId + "|")) partsKnown.delete(k);
}

export function startAutosave() {
  system.runInterval(() => {
    for (const id of [...dirty]) {
      const p = players.get(id);
      if (p && isValid(p)) saveNow(p); else dirty.delete(id);
    }
  }, SAVE_INTERVAL_TICKS);
}

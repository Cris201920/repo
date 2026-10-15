// systems/sagesave.js - Persistência do Grande Sábio (great_sage/save): namespace próprio, VERSÃO e MIGRAÇÕES.
//
// A memória do Sábio (estágio, conhecimento, configurações) fica FORA do save principal do jogador, em quatro propriedades dinâmicas:
//   great_sage:memory_version   número da versão do formato (SAGE_SAVE_VERSION)
//   great_sage:stage            estágio (Grande Sábio / Raphael / Ciel), análises, experiência, vínculo
//   great_sage:settings         preferências (voz, volume, efeitos, dicas, modo debug...)
//   great_sage:knowledge        enciclopédia, memória cronológica, observações, sugestões
// Motivos: (1) a base de conhecimento é a única parte do save que cresce com o tempo; separá-la impede que ela estoure o limite do
// save principal e faça o jogo parar de salvar; (2) se o save principal for perdido/corrompido o Sábio é restaurado por aqui;
// (3) o formato tem versão própria, então mudanças futuras (v2, v3...) migram os dados antigos em vez de apagá-los.
//
// Segurança dos dados:
//  · um campo só sai do save principal DEPOIS que as quatro propriedades foram gravadas; se qualquer gravação falhar, o Sábio continua
//    dentro do save principal (nada se perde) e a próxima tentativa recomeça;
//  · ao carregar, estágios nunca regridem (OU lógico) e contadores usam o MAIOR valor; registros que só existem de um dos lados são mantidos;
//  · textos grandes são gravados em partes (core/db.js writeBig), e só o que mudou é regravado.
import { onLoad, onSave, writeBig, readBig, markDirty, getData } from "../core/db.js";
import { GreatSageLogger as Log } from "../core/logger.js";
import { enforceLimits } from "./sageknow.js";

export const SAGE_SAVE_VERSION = 1;
export const SAGE_KEYS = Object.freeze({ version: "great_sage:memory_version", stage: "great_sage:stage", knowledge: "great_sage:knowledge", settings: "great_sage:settings" });
const STAGE_FIELDS = new Set(["gs", "raphael", "ciel", "analyses", "exp", "bond", "tasks", "learnedAt", "seenEvo", "sv"]);
const KNOW_FIELDS = new Set(["know", "knowMig", "archive", "mem", "obs", "seen", "sug", "dec", "res"]);   // o resto vai para "settings"
const COUNTERS = ["analyses", "exp", "bond", "tasks"], FLAGS = ["gs", "raphael", "ciel"];
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// ---------------------------------------------------------------- migrações (chave = versão de ORIGEM; cada passo é idempotente e não apaga nada)
export const SAGE_MIGRATIONS = {
  // v0 (campos soltos no save principal, sem versão) -> v1 (memória própria): normaliza tipos e formatos
  0(sg) {
    for (const k of ["archive", "seen", "mods", "know", "obs", "res"]) if (!isObj(sg[k])) sg[k] = {};
    for (const k of ["mem", "sug", "dec"]) if (sg[k] !== undefined && !Array.isArray(sg[k])) sg[k] = [];
    for (const k of COUNTERS) if (sg[k] !== undefined && !(Number.isFinite(sg[k]) && sg[k] >= 0)) sg[k] = 0;
    for (const cat of Object.keys(sg.know)) {
      const m = sg.know[cat];
      if (!isObj(m)) { sg.know[cat] = {}; continue; }
      for (const [id, e] of Object.entries(m)) if (!isObj(e)) m[id] = { n: 1, name: String(e ?? id) };   // formato antigo -> {n, name}
    }
  },
  // Exemplo para o futuro:  1(sg) { ...transforma a estrutura da v1 na da v2... }
};

/** Leva `sg` da versão `from` até SAGE_SAVE_VERSION. Um passo que falhe é registrado e não interrompe o login. Retorna os passos aplicados. */
export function migrateSage(sg, from = 0) {
  let v = Number.isInteger(from) && from >= 0 ? from : 0; const ran = [];
  for (; v < SAGE_SAVE_VERSION; v++) {
    const step = SAGE_MIGRATIONS[v];
    if (step) { try { step(sg); ran.push(v); } catch (e) { Log.error(`migração do Sábio v${v}->v${v + 1}: ${e}`); } }
  }
  if (!(sg.sv > SAGE_SAVE_VERSION)) sg.sv = SAGE_SAVE_VERSION;   // dado de versão futura não é rebaixado
  return ran;
}

// ---------------------------------------------------------------- divisão / união
/** Separa o estado do Sábio nas três partes gravadas. Todo campo vai para exatamente uma parte (nada se perde). */
export function splitSage(sg) {
  const stage = {}, knowledge = {}, settings = {};
  for (const [k, v] of Object.entries(sg)) (STAGE_FIELDS.has(k) ? stage : KNOW_FIELDS.has(k) ? knowledge : settings)[k] = v;
  return { stage, knowledge, settings };
}
/** União segura: `ns` (gravado à parte) é a base; do `main` entram só estágios mais avançados, contadores maiores e registros que faltam. */
export function unionSage(ns, main) {
  if (!isObj(main)) return ns;
  for (const f of FLAGS) if (main[f] === true) ns[f] = true;
  for (const f of COUNTERS) if (Number.isFinite(main[f])) ns[f] = Math.max(Number.isFinite(ns[f]) ? ns[f] : 0, main[f]);
  for (const f of KNOW_FIELDS) {
    if (!isObj(main[f])) continue;
    if (!isObj(ns[f])) { if (ns[f] === undefined) ns[f] = main[f]; continue; }
    for (const [k, v] of Object.entries(main[f])) {
      if (ns[f][k] === undefined) ns[f][k] = v;
      else if (isObj(v) && isObj(ns[f][k])) for (const [k2, v2] of Object.entries(v)) if (ns[f][k][k2] === undefined) ns[f][k][k2] = v2;   // conhecimento: categoria -> registros
    }
  }
  return ns;
}

// ---------------------------------------------------------------- carga e gravação
const written = new Map();   // playerId -> último texto gravado de cada parte (só o que mudou é regravado)
export const dropSageSave = (id) => written.delete(id);

function readParts(player) {
  const rd = (k) => { const t = readBig(player, SAGE_KEYS[k]); return t ? JSON.parse(t) : undefined; };
  return { stage: rd("stage"), settings: rd("settings"), knowledge: rd("knowledge") };
}

/** Gancho de carga (db.getData): restaura a memória do Sábio, migra se a versão for antiga e aplica os limites. */
function load(player, d) {
  const main = isObj(d.sage) ? d.sage : {};
  let sg = main, from = Number.isInteger(main.sv) ? main.sv : 0, restored = false;
  let ver; try { ver = player.getDynamicProperty(SAGE_KEYS.version); } catch { /* ignore */ }
  if (typeof ver === "number") {
    try {
      const p = readParts(player);
      if (p.stage || p.settings || p.knowledge) {
        const ns = Object.assign({}, p.settings ?? {}, p.stage ?? {}, p.knowledge ?? {});
        from = Math.min(ver, from); sg = unionSage(ns, main); restored = true;
      }
    } catch (e) { Log.error(`ler memória do Sábio de ${player.name}: ${e}`); }   // segue com o que veio do save principal
  }
  const ran = migrateSage(sg, from), cut = enforceLimits(sg);
  d.sage = sg;
  if (!restored || ran.length || cut) markDirty(player);   // 1ª vez (legado) ou migrou/podou: grava no formato novo logo
  if (ran.length) Log.info(`memória do Sábio de ${player.name} migrada (${ran.join(",")}) para v${SAGE_SAVE_VERSION}`);
}

/** Gancho de gravação (db.saveNow): grava as partes que mudaram. Devolve "sage" quando tudo foi gravado (o campo sai do save principal). */
function save(player, d) {
  const sg = d.sage; if (!isObj(sg)) return undefined;
  enforceLimits(sg); sg.sv = SAGE_SAVE_VERSION;
  const { stage, knowledge, settings } = splitSage(sg), out = { stage: JSON.stringify(stage), settings: JSON.stringify(settings), knowledge: JSON.stringify(knowledge) };
  const last = written.get(player.id) ?? {};
  try {
    for (const k of ["stage", "settings", "knowledge"]) if (last[k] !== out[k]) { writeBig(player, SAGE_KEYS[k], out[k]); last[k] = out[k]; }
    if (last.version !== SAGE_SAVE_VERSION) { player.setDynamicProperty(SAGE_KEYS.version, SAGE_SAVE_VERSION); last.version = SAGE_SAVE_VERSION; }   // por último
    written.set(player.id, last);
    return "sage";
  } catch (e) {
    written.delete(player.id);
    Log.error(`salvar memória do Sábio de ${player.name} (fica no save principal): ${e}`);
    return undefined;
  }
}

let started = false;
/** Liga os ganchos no db. Precisa acontecer ANTES do primeiro getData de qualquer jogador (main.js importa este módulo no topo). */
export function startSageSave() { if (started) return; started = true; onLoad(load); onSave(save); }

/** GreatSage.save(): grava agora (força). Retorna true se as partes foram gravadas. */
export function saveGreatSageState(player) { return save(player, getData(player)) === "sage"; }
/** GreatSage.load(): relê as partes gravadas e as une ao estado atual. Retorna true se havia dados gravados. */
export function loadGreatSageState(player) {
  const d = getData(player);
  try {
    const p = readParts(player); if (!(p.stage || p.settings || p.knowledge)) return false;
    d.sage = unionSage(Object.assign({}, p.settings ?? {}, p.stage ?? {}, p.knowledge ?? {}), d.sage);
    migrateSage(d.sage, Math.min(Number(player.getDynamicProperty(SAGE_KEYS.version)) || 0, d.sage.sv ?? 0)); enforceLimits(d.sage); markDirty(player);
    return true;
  } catch (e) { Log.error(`GreatSage.load: ${e}`); return false; }
}

startSageSave();

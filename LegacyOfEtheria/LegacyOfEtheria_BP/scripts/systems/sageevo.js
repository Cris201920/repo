// systems/sageevo.js - EvolutionManager: condições de evolução do Sábio (Grande Sábio · Raphael · Ciel) e da raça, com CACHE.
// Nada aqui varre o mundo a cada tick: o resultado de check() vale por EVO_TTL ticks e é descartado na hora por invalidate() quando algo
// relevante muda (habilidade adquirida/evoluída, análise concluída, despertar, maestria, evolução, forja). Só lê dados: nunca evolui sozinho.
import { system } from "@minecraft/server";
import { getData } from "../core/db.js";
import { sageStage } from "./voice.js";
import { evoReq, stageName } from "./sageknow.js";
import { nextStages } from "../data/races.js";
import { evolveCheck } from "./race.js";
import { GreatSageLogger as Log } from "../core/logger.js";

export const EVO_TTL = 100;   // ticks (5 s) de validade do cache
const cache = new Map();      // playerId -> resultado
let hits = 0, misses = 0;

/** Estágio de destino da próxima evolução do Sábio: 2 Grande Sábio · 3 Raphael · 4 Ciel · 0 = já no máximo. */
export const nextSageStage = (stage) => (stage >= 4 ? 0 : stage >= 3 ? 4 : stage >= 2 ? 3 : 2);

function compute(player) {
  const d = getData(player), stage = sageStage(d), target = nextSageStage(stage);
  let requirements = [];
  if (target) { try { requirements = evoReq(player, target); } catch (e) { Log.error(`requisitos de evolução: ${e}`, "Evolução"); } }
  const missing = requirements.filter((r) => !r.ok).map((r) => r.text);
  // evolução de raça (nível, moedas, abates, chefe do reino)
  const options = [];
  try { for (const st of nextStages(d)) options.push({ id: st.id, name: st.name, why: evolveCheck(player, st) }); } catch (e) { Log.error(`evolução de raça: ${e}`, "Evolução"); }
  return {
    stage, stageName: stageName(stage), target, evolution: target ? stageName(target) : null,
    available: !!target && requirements.length > 0 && missing.length === 0, requirements, missing,
    race: { available: options.some((o) => !o.why), options },
    at: system.currentTick, cached: false,
  };
}

/** { stage, stageName, target, evolution, available, requirements:[{ok,text,tag}], missing:[texto], race:{available,options}, at, cached }.
 *  `force` ignora o cache. O cache também cai sozinho se o estágio do Sábio mudou. */
function check(player, force = false) {
  const now = system.currentTick, c = cache.get(player.id);
  if (!force && c && now - c.at < EVO_TTL && c.stage === sageStage(getData(player))) { hits++; return { ...c, cached: true }; }
  misses++;
  const r = compute(player); cache.set(player.id, r); return r;
}

export const EvolutionManager = Object.freeze({
  check,
  /** Descarta o resultado guardado (algo que influencia a evolução mudou). */
  invalidate: (player) => { cache.delete(player.id); },
  /** Atalho: a próxima evolução do Sábio já pode ser iniciada? */
  ready: (player) => check(player).available,
  stats: () => ({ hits, misses, entries: cache.size }),
  drop: (id) => { cache.delete(id); },
  reset: () => { cache.clear(); hits = 0; misses = 0; },
});
export const dropEvo = (id) => cache.delete(id);

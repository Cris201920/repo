// systems/sagetests.js - TESTES AUTOMÁTICOS do Grande Sábio, executáveis dentro do jogo:  /scriptevent etheria:sagetest
// Regra: o teste NUNCA altera o progresso do jogador (nada de evoluir, analisar de verdade, dar habilidade ou gastar mana).
// Ele valida o mecanismo: estados do Sábio, migração, salvar/carregar (leitura de volta das propriedades gravadas), trava de alvo, cache de
// evolução, processamento paralelo, medição de combate, porteiro anti-spam, barramento de eventos e limpeza (destroy).
// Quando algo não pode ser testado sem efeito colateral (ex.: nenhum alvo por perto), o item aparece como PULADO, nunca como aprovado.
import { system, world } from "@minecraft/server";
import { getData } from "../core/db.js";
import { say, isValid } from "../core/utils.js";
import { on, off, emit } from "../core/bus.js";
import { sageCfg, sageStage } from "./voice.js";
import { kcount, enforceLimits, KB_CAP } from "./sageknow.js";
import { SAGE_SAVE_VERSION, migrateSage, splitSage, unionSage, saveGreatSageState, loadGreatSageState } from "./sagesave.js";
import { detectTarget, lockTarget, releaseTarget, isLocked, analyzable } from "./sagetarget.js";
import { EvolutionManager } from "./sageevo.js";
import { processNow, procInfo, TASKS, taskAvailable } from "./sageproc.js";
import { combatSnapshot, threatOf, THREAT } from "./sagecombat.js";
import { tipGate, TIP_PRI } from "./sagetips.js";
import { assessActive, nextState, ASSESS } from "./sageassess.js";
import { GreatSageLogger as Log } from "../core/logger.js";

const PASS = true, FAIL = false, SKIP = null;
/** JSON com chaves ordenadas: compara o CONTEÚDO, não a ordem em que as chaves foram inseridas. */
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
const scanTarget = (p) => { try { return detectTarget(p, 24) ?? p.dimension.getEntities({ location: p.location, maxDistance: 12 }).find((e) => analyzable(e)); } catch { return undefined; } };

/** Cada teste devolve [resultado, detalhe]; uma exceção vira FALHA com a mensagem (o Sábio nunca derruba o addon por causa de um teste). */
const TESTS = [
  ["inicialização", () => [PASS, "módulos ligados"]],
  ["estados SAGE · GREAT_SAGE · RAPHAEL · CIEL", () => {
    const mk = (sg, level = 1) => ({ level, sage: { archive: {}, ...sg } });
    const got = [sageStage(mk({ analyses: 5 })), sageStage(mk({ gs: true })), sageStage(mk({ gs: true, raphael: true })), sageStage(mk({ gs: true, raphael: true, ciel: true })), sageStage(mk({ gs: false, analyses: 0 }))];
    const ok = got.join() === "1,2,3,4,0"; return [ok, `estágios ${got.join(",")} (esperado 1,2,3,4,0)`];
  }],
  ["migração do save (versão antiga -> atual)", () => {
    const old = { know: { creatures: { a: "Goblin" } }, mem: "ruim", analyses: -3 }, ran = migrateSage(old, 0);
    const ok = old.sv === SAGE_SAVE_VERSION && old.know.creatures.a?.n === 1 && Array.isArray(old.mem) && old.analyses === 0 && ran.length >= 1;
    return [ok, `v${old.sv}, passos ${ran.join(",") || "-"}`];
  }],
  ["divisão e união do save (nada se perde)", () => {
    const sg = { gs: true, analyses: 7, know: { creatures: { x: { n: 2, name: "X" } } }, volume: 60, mem: [{ t: 1, type: "a", text: "b" }] };
    const parts = splitSage(JSON.parse(JSON.stringify(sg))), back = Object.assign({}, parts.settings, parts.stage, parts.knowledge);
    const merged = unionSage(back, { raphael: true, analyses: 3 });
    const ok = back.gs && back.know.creatures.x.n === 2 && back.volume === 60 && back.mem.length === 1 && merged.raphael === true && merged.analyses === 7;
    return [ok, "estágio OU, contador MAIOR, registros mantidos"];
  }],
  ["limites da base de conhecimento", () => {
    const sg = { know: { creatures: {} }, obs: {} }; for (let i = 0; i < KB_CAP.creatures + 30; i++) sg.know.creatures["c" + i] = { n: 1, name: "c" + i };
    const cut = enforceLimits(sg), n = Object.keys(sg.know.creatures).length;
    return [n === KB_CAP.creatures && cut === 30 && sg.know.creatures["c" + (KB_CAP.creatures + 29)] !== undefined, `${n}/${KB_CAP.creatures} (o mais antigo sai primeiro)`];
  }],
  ["salvar e carregar (leitura de volta)", (p) => {
    const before = stable(splitSage(sageCfg(getData(p)))), saved = saveGreatSageState(p), loaded = loadGreatSageState(p), after = stable(splitSage(sageCfg(getData(p))));
    return [saved && loaded && before === after, `${saved ? "gravou" : "NÃO gravou"} · ${loaded ? "leu" : "NÃO leu"} · ${before === after ? "idêntico" : "DIFERENTE"} · ${kcount(getData(p))} registros`];
  }],
  ["alvo: detectar · travar · soltar", (p) => {
    const t = scanTarget(p); if (!t) return [SKIP, "nenhuma entidade analisável por perto"];
    const locked = lockTarget(p, t, { silent: true, noAnalysis: true, force: true }), held = isLocked(p), freed = releaseTarget(p, "manual", true);
    return [locked && held && freed && !isLocked(p), `alvo ${t.typeId.split(":").pop()}`];
  }],
  ["evolução: verificação com cache", (p) => {
    const a = EvolutionManager.check(p, true), b = EvolutionManager.check(p);
    const shape = Array.isArray(a.requirements) && Array.isArray(a.missing) && typeof a.available === "boolean" && "evolution" in a;
    return [shape && b.cached === true && (a.target === 0 || a.requirements.length > 0), a.target ? `${a.evolution}: ${a.available ? "disponível" : `faltam ${a.missing.length}`}` : "estágio máximo"];
  }],
  ["processamento paralelo", (p) => {
    const sg = sageCfg(getData(p)), st = sageStage(getData(p)), avail = TASKS.filter((t) => taskAvailable(sg, st, t)).length;
    if (!avail) return [SKIP, "nenhuma tarefa disponível neste estágio"];
    const r = processNow(p), n = TASKS.filter((t) => t.id in r && taskAvailable(sg, st, t)).length, info = procInfo(p);
    return [n === avail, `${n} de ${avail} tarefa(s) disponível(is) neste estágio executada(s) agora (${info.tasks} no total)`];
  }],
  ["combate: ameaça e medição", (p) => {
    const snap = combatSnapshot(p), ok = typeof snap.count === "number" && Array.isArray(snap.ready) && threatOf(1, 100) === THREAT.LOW && threatOf(1000, 20) === THREAT.EXTREME;
    return [ok, `${snap.count} hostil(is) · ${snap.ready.length} habilidade(s) pronta(s)`];
  }],
  ["perigo: aviso crítico sem spam", (p) => {
    const first = tipGate(p, "selftest.danger", TIP_PRI.CRITICAL), again = tipGate(p, "selftest.danger", TIP_PRI.CRITICAL);
    return [first === 2 && again === 0, "crítico passa; repetição imediata é bloqueada"];
  }],
  ["modo assess: máquina de estados", () => {
    const ok = nextState(ASSESS.OFF, "toggle") === ASSESS.ENTERING && nextState(ASSESS.ACTIVE, "aim") === ASSESS.SCANNING && nextState(ASSESS.LOCKED_TARGET, "abort") === ASSESS.EXITING && nextState(ASSESS.OFF, "aim") === null;
    return [ok, "OFF→ENTERING→ACTIVE→SCANNING→LOCKED_TARGET→EXITING"];
  }],
  ["barramento de eventos", () => {
    let hits = 0; const a = () => { hits++; }, boom = () => { throw new Error("teste"); }, b = () => { hits += 10; };
    on("selftest", boom); on("selftest", a); on("selftest", b); emit("selftest", {}); off("selftest", boom); off("selftest", a); off("selftest", b);
    return [hits === 11, "um ouvinte com erro não derruba os outros"];
  }],
];

/** Executa a bateria para `p`. Devolve [{ name, ok (true | false | null = pulado), detail }]. */
export function runSelfTests(p) {
  const out = [];
  for (const [name, fn] of TESTS) {
    try { const [ok, detail] = fn(p); out.push({ name, ok, detail }); }
    catch (e) { out.push({ name, ok: FAIL, detail: `erro: ${e}` }); Log.error(`teste "${name}": ${e}`, "Testes"); }
  }
  // limpeza (destroy) só quando não atrapalha o jogador: sem trava de alvo e sem Modo Assess
  out.push(destroyTest(p));
  return out;
}
function destroyTest(p) {
  if (assessActive(p) || isLocked(p)) return { name: "destroy (limpeza do estado em memória)", ok: SKIP, detail: "pulado: há alvo travado ou Modo Assess ativo" };
  try { const { destroyPlayerState } = HOOKS; if (!destroyPlayerState) return { name: "destroy (limpeza do estado em memória)", ok: SKIP, detail: "sem gancho" }; destroyPlayerState(p); return { name: "destroy (limpeza do estado em memória)", ok: !isLocked(p) && !assessActive(p), detail: "estado do jogador liberado e reconstruído sob demanda" }; }
  catch (e) { return { name: "destroy (limpeza do estado em memória)", ok: FAIL, detail: `erro: ${e}` }; }
}
/** O facade (greatsage.js) registra aqui a função que limpa o estado do jogador, sem este módulo importar o resto. */
const HOOKS = {};
export const setTestHooks = (h) => Object.assign(HOOKS, h);

/** Mostra o resultado no chat do jogador (resumo + uma linha por teste). */
export function reportSelfTests(p, results = runSelfTests(p)) {
  const pass = results.filter((r) => r.ok === true).length, fail = results.filter((r) => r.ok === false).length, skip = results.filter((r) => r.ok === null).length;
  say(p, `§b[Sábio] §fTestes automáticos: §a${pass} ok §f· ${fail ? `§c${fail} falha(s)` : "§a0 falhas"} §f· §e${skip} pulado(s)`);
  for (const r of results) say(p, `${r.ok === true ? "§a✔" : r.ok === false ? "§c✘" : "§e⏭"} §7${r.name} §8— ${r.detail}`);
  return { pass, fail, skip, results };
}
export const selfTestSummary = (results) => ({ pass: results.filter((r) => r.ok === true).length, fail: results.filter((r) => r.ok === false).length, skip: results.filter((r) => r.ok === null).length });

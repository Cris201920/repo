// systems/sageproc.js - Processamento paralelo do Sábio: tarefas internas, alertas (sem spam), sugestões e autonomia.
// Um único laço (a cada 10 ticks) distribui tarefas com prazos próprios por jogador; consultas ao mundo são compartilhadas e em cache.
import { coreAlert } from "./sagecore.js";
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getData, markDirty } from "../core/db.js";
import { isValid, say, healthComp } from "../core/utils.js";
import { SKILLS } from "../data/skills.js";
import { BOSSES } from "../data/bosses.js";
import { MOBS } from "../data/mobs.gen.js";
import { sageSay, sageStage, sageCfg } from "./voice.js";
import { evoReady, learn, remember, addBond, stageName } from "./sageknow.js";
import { activeBosses } from "./bosses.js";
import { inCombat } from "./combat.js";
import { hasSkill, castSkill, cdLeft } from "./skills.js";
import { COMBOS, awakened } from "./discovery.js";
import { masteryLevel } from "./mastery.js";
import { sageSnd } from "./sagecircle.js";
import { tipGate, TIP_PRI, priorityOf, dropTips } from "./sagetips.js";
import { ITEMS } from "../data/items.gen.js";
import { emit, EV } from "../core/bus.js";
import { GreatSageLogger as Log } from "../core/logger.js";
import { measure, noteQueue } from "../core/metrics.js";
import { hostilesOf, combatSnapshot, THREAT_NAME, dropCombat, forgetHostiles } from "./sagecombat.js";
import { EvolutionManager, dropEvo } from "./sageevo.js";

export const ELEM_NAME = { fire: "Fogo", ice: "Gelo", lightning: "Raio", arcane: "Arcano", shadow: "Sombra", physical: "Físico", earth: "Terra", water: "Água", wind: "Vento", light: "Luz", blood: "Sangue", void: "Vazio" };
const WEAK = [["taratect", ["fire", "light"], "Aranha mágica: frágil a fogo e luz"], ["goblin", ["fire"], "Goblins: frágeis a fogo"], ["orc", ["lightning", "ice"], "Orcs: lentos, sofrem com raio e gelo"],
  ["wolf", ["physical", "earth"], "Lobos: ágeis, sofrem com golpes pesados"], ["slime", ["lightning", "fire"], "Slimes: instáveis a raio/fogo"], ["imp", ["ice", "light"], "Demônios: sofrem com gelo e luz"],
  ["boss_", ["shadow"], "Boss: observe as fases e a barra de vida"]];
export function weaknessOf(typeId) { const w = WEAK.find((x) => typeId.includes(x[0])); return w ? { els: w[1], note: w[2] } : { els: [], note: "Sem dados de fraqueza." }; }
/** Melhor habilidade ativa conhecida/equipada contra os elementos fracos. */
export function suggestSkill(player, els) {
  const d = getData(player), pool = d.equippedSkills.concat(d.unlockedSkills).filter((id, i, a) => a.indexOf(id) === i);
  for (const el of els) { const id = pool.find((x) => SKILLS[x]?.type === "active" && SKILLS[x].element === el); if (id) return { id, name: SKILLS[id].name, slot: d.equippedSkills.indexOf(id) }; }
  return null;
}
const BOSS_ELEM = { fire_breath: "fire", meteors: "fire", void_pull: "void", void_shards: "void", drain: "shadow" };
export function bossThreats(typeId) {
  const b = Object.values(BOSSES).find((x) => x.type === typeId); if (!b) return null;
  const abil = new Set(); for (const ph of b.phases) for (const a of ph.abilities) abil.add(a[0]);
  return { boss: b, abilities: [...abil], elems: [...new Set([...abil].map((a) => BOSS_ELEM[a]).filter(Boolean))] };
}

export const TASKS = [
  { id: "hp", name: "Monitorar vida e energia", min: 0, every: 20 },
  { id: "danger", name: "Verificar perigo", min: 1, every: 40 },
  { id: "scan", name: "Analisar inimigo", min: 2, every: 40 },
  { id: "dmg", name: "Calcular dano", min: 2, every: 60 },
  { id: "skill", name: "Analisar habilidades e combinações", min: 2, every: 200 },
  { id: "evo", name: "Procurar evolução", min: 2, every: 300 },
  { id: "ambush", name: "Detectar emboscada", min: 2, every: 40 },
  { id: "combat", name: "Analisar combate", min: 2, every: 40 },
  { id: "route", name: "Calcular rota mais segura", min: 3, every: 100 },
  { id: "ore", name: "Detectar minérios próximos", min: 1, every: 100 },
  { id: "gear", name: "Verificar equipamento", min: 1, every: 100 },
  { id: "pattern", name: "Reconhecer padrões e memórias", min: 4, every: 400 },
];
const NEG = ["poison", "wither", "weakness", "slowness", "blindness", "nausea", "hunger", "mining_fatigue", "darkness"];
const NEG_NAME = { poison: "Veneno", wither: "Definhar", weakness: "Fraqueza", slowness: "Lentidão", blindness: "Cegueira", nausea: "Náusea", hunger: "Fome", mining_fatigue: "Fadiga", darkness: "Escuridão" };

const state = new Map();    // playerId -> { next: Map(task->tick), res: {task: text}, cds: Map, nb: {tick, list}, lastAlert }
const S = (p) => { let s = state.get(p.id); if (!s) { s = { next: new Map(), res: {}, cds: new Map(), nb: { t: -999, list: [] }, lastAlert: 0, lastAsk: 0, q: [], queued: 0, due: 0, ran: 0, lastAt: 0 }; state.set(p.id, s); } return s; };
export const QUEUE_MAX = 8;
/** FILA DE PRIORIDADE do processamento paralelo: tarefas avulsas (prioridade menor = executa primeiro, mesmo id substitui a anterior).
 *  Cada tarefa roda uma única vez, antes das tarefas periódicas, e o resultado aparece em procResult(p)[id]. Cheia: sai a de menor prioridade. */
export function queueTask(p, id, fn, pri = 5) {
  const s = S(p), at = s.q.findIndex((t) => t.id === id); if (at >= 0) s.q.splice(at, 1);
  s.q.push({ id, fn, pri, seq: ++queueSeq }); s.q.sort((a, b) => a.pri - b.pri || a.seq - b.seq);
  while (s.q.length > QUEUE_MAX) s.q.pop();
  return s.q.length;
}
let queueSeq = 0;
export const dropProc = (id) => { state.delete(id); gearSig.delete(id); dropTips(id); dropCombat(id); dropEvo(id); };
export const procResult = (p) => S(p).res;
/** Estado do processamento paralelo (modo debug): tarefas vencidas que esperaram a vez, última passada e resultados. */
export const procInfo = (p) => { const s = state.get(p.id); return { queued: s ? s.q.length + s.due : 0, ran: s?.ran ?? 0, lastAt: s?.lastAt ?? 0, results: s?.res ?? {}, tasks: TASKS.length }; };
/** Esquece caches de varredura (ex.: depois de um teleporte): a próxima passada consulta o mundo de novo. */
export const resetScan = (p) => { try { forgetHostiles(p); } catch { /* ignore */ } };
export const modOn = (sg, id) => sg.mods?.[id] !== false;
let analyzer = null;
export const setAnalyzer = (fn) => { analyzer = fn; };
/** Roda a análise do Sábio (registrada por sage.js) sem importá-lo: usado pela trava de alvo e pelo Modo Assess. */
export const runAnalyzer = (p, t, o = {}) => analyzer?.(p, t, o);

export function taskAvailable(sg, stage, t) { return stage >= t.min && (modOn(sg, "parallel") || stage < 2 || t.id === "hp" || t.id === "danger"); }

/** Hostis próximos: uma única consulta compartilhada (cache de 20 ticks) com o CombatManager. */
const nearby = (p, s, now) => hostilesOf(p, now);
function cd(s, key, ticks, now) { if ((s.cds.get(key) ?? 0) > now) return false; s.cds.set(key, now + ticks); return true; }

// ------------------------------------------------------------------ alertas e sugestões
/** Alerta com prioridade, recarga por tipo e silêncio entre dicas (sagetips). Volta true se foi emitido.
 *  o: { urgent (sobe para ALTO), pri (TIP_PRI), soft (só barra de ação + som discreto, sem cena do núcleo) } */
export function alert(p, key, voiceKey, msg, ticks, o = {}) {
  const base = o.pri ?? priorityOf(key), pri = o.urgent ? Math.min(base, TIP_PRI.HIGH) : base;
  if (tipGate(p, "al." + key, pri, ticks) !== 2) return false;
  if (voiceKey) sageSay(p, voiceKey, { cd: 0 });
  sageSnd(p, "mini", 0.5, 0.8);
  if (!o.soft) { try { coreAlert(p, pri <= TIP_PRI.HIGH || /perigo|superior|emboscada|poderoso|cr[ií]tica/i.test(msg ?? "") ? "danger" : "info"); } catch { /* ignore */ } }
  if (msg) { try { p.onScreenDisplay.setActionBar(`${pri <= TIP_PRI.CRITICAL ? "§c⚠" : pri === TIP_PRI.HIGH ? "§6⚠" : "§b✦"} §f${msg}`); } catch { /* ignore */ } }
  try { emit(EV.SAGE_TIP, { player: p, key, pri, text: msg }); if (pri <= TIP_PRI.HIGH) emit(EV.SAGE_DANGER, { player: p, key, pri, text: msg }); } catch { /* ignore */ }   // danger_detected
  return true;
}
/** Aviso CRÍTICO (morte iminente, ameaça extrema, evolução disponível, habilidade perigosa, falha crítica de análise): ignora recarga e silêncio. */
export const criticalWarning = (p, key, voiceKey, msg) => alert(p, key, voiceKey, msg, 0, { pri: TIP_PRI.CRITICAL });
/** Registra sugestão (sempre) e a anuncia conforme o nível de autonomia. action: {type:'cast', id} */
export function suggest(p, key, text, o = {}) {
  const sg = sageCfg(getData(p)), s = S(p), now = system.currentTick; sg.sug ??= [];
  const pri = o.pri ?? priorityOf(key), gate = tipGate(p, "sg." + key, pri, o.cd ?? 6000);   // 0 em recarga · 1 só registra · 2 anuncia
  if (gate === 0) return false;
  sg.sug = sg.sug.filter((x) => x.k !== key); sg.sug.unshift({ k: key, text, t: Date.now(), action: o.action ?? null }); while (sg.sug.length > 8) sg.sug.pop(); markDirty(p);
  if (gate < 2) return true;                                   // registrada na lista de sugestões; o anúncio espera o silêncio acabar
  const mode = sg.auto ?? 1, st = sageStage(getData(p));
  if (mode >= 1) {
    if (o.voice) sageSay(p, o.voice);
    if (!o.quiet) { try { p.onScreenDisplay.setActionBar(`${pri <= TIP_PRI.CRITICAL ? "§c⚠" : "§b✦"} §f${text}`); } catch { /* ignore */ } }
  }
  try { emit(EV.SAGE_TIP, { player: p, key, pri, text }); } catch { /* ignore */ }
  if (mode >= 3 && st >= 3 && o.action?.type === "cast" && now - s.lastAsk > 600) askAuthorize(p, o.action, text);
  return true;
}
/** EXECUTAR COM AUTORIZAÇÃO: o Sábio nunca age sozinho; pergunta e só executa com "Sim". */
function askAuthorize(p, action, text) {
  const s = S(p); s.lastAsk = system.currentTick; const sk = SKILLS[action.id]; if (!sk || !hasSkill(getData(p), action.id)) return;
  const f = new ActionFormData().title(`§l§b${stageName(sageStage(getData(p))).toUpperCase()}`).body(`§f${text}\n\n§7Executar §e${sk.name}§7 agora?\n§8(custos normais de mana e recarga)`).button("§aSim, executar").button("§cNão");
  f.show(p).then((r) => {
    const sg = sageCfg(getData(p)); sg.dec ??= [];
    if (r.canceled || r.selection !== 0) { sg.dec.unshift({ t: Date.now(), ok: false, text: `Recusado: ${sk.name}` }); }
    else { const res = castSkill(p, action.id); sg.dec.unshift({ t: Date.now(), ok: !!res.ok, text: `Executado com autorização: ${sk.name}` }); if (res.ok) addBond(p, 1); else say(p, `§c[Sábio] ${res.msg}`); }
    while (sg.dec.length > 12) sg.dec.pop(); markDirty(p);
  }).catch(() => { /* ignore */ });
}

// ------------------------------------------------------------------ tarefas
function runTask(p, t, s, now, d, sg, stage) {
  switch (t.id) {
    case "hp": {
      const h = healthComp(p); if (!h) return "—";
      const frac = h.currentValue / h.effectiveMax, maxM = Math.max(1, d.maxMana ?? d.mana + 1);
      if (frac < 0.2) { if (stage >= 4 && sg.chat !== 0) alert(p, "lowhp", "ci_worry", "Integridade crítica!", 1200, { urgent: true }); else alert(p, "lowhp", "dg_low_hp", "Integridade crítica!", 1200, { urgent: true }); }
      else if (frac < 0.4) {
        alert(p, "hp", null, "A integridade do usuário está abaixo do nível recomendado.", undefined, { soft: true });
        if (inCombat(p)) suggest(p, "defend", "Vida em 40%: recomendo defender, esquivar ou recuar.", { cd: 900 });
      }
      if (d.mana < 8 && inCombat(p)) { alert(p, "mana", "al_energy", "Energia baixa.", 1500); suggest(p, "weapon", "Energia insuficiente: mude para a arma ou use uma poção.", { cd: 1500, quiet: true }); }
      let neg = []; try { neg = p.getEffects().map((e) => e.typeId.replace("minecraft:", "")).filter((x) => NEG.includes(x)); } catch { /* ignore */ }
      if (neg.length && stage >= 1) alert(p, "eff", "al_effect", `Efeito negativo: ${neg.map((x) => NEG_NAME[x]).join(", ")}`, 1500);
      return `Vida ${Math.round(frac * 100)}% · Mana ${Math.round(d.mana)}${neg.length ? ` · ${neg.length} efeito(s) negativo(s)` : ""}`;
    }
    case "danger": {
      const bs = activeBosses().find((b) => { try { return b.e.dimension === p.dimension && Math.hypot(b.e.location.x - p.location.x, b.e.location.z - p.location.z) < 36; } catch { return false; } });
      if (bs) {
        sageSay(p, "dg_attention", { cd: 4000 }); sageSay(p, "dg_threat", { cd: 4000 }); sageSay(p, "dg_high", { cd: 6000 }); sageSay(p, "dg_detail", { cd: 8000 });
        const th = bossThreats(bs.e.typeId); if (th?.elems.length) suggest(p, "res." + bs.e.typeId, `Boss ${th.boss.name}: recomendo resistência a ${th.elems.map((e) => ELEM_NAME[e]).join("/")}.`, { cd: 9000, voice: "sg_resist" });
        return `Boss detectado: ${bs.e.typeId.split("boss_")[1] ?? "?"}`;
      }
      const list = nearby(p, s, now), h = healthComp(p), big = list.find((e) => { const eh = healthComp(e); return eh && h && eh.effectiveMax > h.effectiveMax * 4; });
      if (big && stage >= 1) { alert(p, "superior", "al_superior", "Inimigo muito superior detectado!", 3000); return "Inimigo muito superior"; }
      if (list.length && stage >= 1) alert(p, "enemy", null, "Presença hostil detectada.", undefined, { soft: true });
      return list.length ? `${list.length} hostil(is) próximo(s)` : "Sem perigo";
    }
    case "scan": {
      if (!analyzer || (sg.auto ?? 1) < 2 && stage < 3) return "Aguardando comando";
      const list = nearby(p, s, now); const t0 = list.find((e) => { try { return isValid(e) && (MOBS[e.typeId] || e.typeId.includes("boss_")); } catch { return false; } });
      if (t0 && modOn(sg, "analysis") && (stage >= 3 || (sg.auto ?? 1) >= 2)) { analyzer(p, t0, { silent: true }); return `Analisando ${MOBS[t0.typeId]?.name ?? t0.typeId}`; }
      return "Nenhum alvo novo";
    }
    case "dmg": {
      const list = nearby(p, s, now); if (!list.length) return "—";
      const e = list[0], eh = healthComp(e); if (!eh) return "—";
      const atk = Math.max(1, Math.round((d.level ?? 1) * 1.6 + 4)); const hits = Math.ceil(eh.currentValue / atk);
      return `${e.typeId.split(":")[1]}: ~${hits} golpe(s) para abater`;
    }
    case "skill": {
      for (const cb of COMBOS) { if (hasSkill(d, cb.id)) continue; if (cb.from.every((k) => hasSkill(d, k) && masteryLevel(p, k) >= cb.mastery)) { suggest(p, "cmb." + cb.id, `Possível combinação detectada: ${cb.from.map((k) => SKILLS[k].name).join(" + ")} → ${SKILLS[cb.id].name}.`, { cd: 24000, voice: "sg_combo" }); return `Combinação: ${SKILLS[cb.id].name}`; } }
      for (const [id, xp] of Object.entries(d.mastery ?? {})) { if (SKILLS[id]?.cat === "Única" && !awakened(d, id) && masteryLevel(p, id) >= 9) { suggest(p, "awk." + id, `${SKILLS[id].name} está próxima do despertar (maestria 10).`, { cd: 24000 }); return `Despertar próximo: ${SKILLS[id].name}`; } }
      return "Sem sinergias novas";
    }
    case "evo": {
      const ev = EvolutionManager.check(p);                         // com cache: não recalcula a cada passada
      if (!ev.target) return "Estágio máximo alcançado";
      if (!ev.available) return `Evolução para ${ev.evolution}: faltam ${ev.missing.length} requisito(s)`;
      const to = ev.target; sg.seenEvo ??= {};
      if (!sg.seenEvo[to]) { sg.seenEvo[to] = 1; sageSay(p, to === 2 ? "evo_gs_ready" : to === 3 ? "evo_rf_ready" : "evo_ci_ready", { cd: 0 }); suggest(p, "evo." + to, "Condições de evolução detectadas. Abra o Livro → EVOLUÇÃO.", { cd: 12000, pri: TIP_PRI.CRITICAL }); }
      return `Evolução para ${stageName(to)} possível`;
    }
    case "combat": {
      if (!inCombat(p)) return "Sem combate";
      const c = combatSnapshot(p, now); if (!c.count) return "Combate: sem inimigos próximos";
      const w = c.nearestType ? weaknessOf(c.nearestType) : { els: [] };
      if (c.hpPct < 0.35 && c.takenPerSec > 0) suggest(p, "fight.retreat", "Defesa recomendada: vida baixa e o dano continua. Recue ou use uma poção.", { cd: 1200, pri: TIP_PRI.HIGH });
      else if (c.lowestPct < 0.25) suggest(p, "fight.vuln", "Alvo vulnerável: finalize o inimigo mais ferido.", { cd: 1200, quiet: true });
      const rd = c.ready.find((id) => w.els.includes(SKILLS[id]?.element));
      if (rd) suggest(p, "fight.skill", `Uso de habilidade recomendado: ${SKILLS[rd].name} (${ELEM_NAME[SKILLS[rd].element] ?? "?"}).`, { cd: 1500, quiet: true, action: { type: "cast", id: rd } });
      return `${c.count} inimigo(s) · ameaça ${THREAT_NAME[c.threat]} · causado ${c.dps.toFixed(1)}/s · recebido ${c.takenPerSec.toFixed(1)}/s`;
    }
    case "ambush": {
      const list = nearby(p, s, now).filter((e) => { try { return Math.hypot(e.location.x - p.location.x, e.location.z - p.location.z) < 10; } catch { return false; } });
      if (list.length >= 3) { alert(p, "ambush", "al_ambush", `Emboscada! ${list.length} inimigos próximos.`, 1800, { urgent: true }); return `Emboscada (${list.length})`; }
      return "Sem emboscada";
    }
    case "route": {
      try { const l = p.location, b = p.dimension.getBlock({ x: l.x, y: l.y - 1, z: l.z }), n = p.dimension.getBlock({ x: l.x + 1, y: l.y - 1, z: l.z });
        if ([b, n].some((x) => x?.typeId === "minecraft:lava")) { suggest(p, "lava", "Lava próxima: existe uma rota mais segura.", { cd: 1200, voice: "sg_route" }); return "Lava detectada"; } } catch { /* ignore */ }
      return "Rota segura";
    }
    case "pattern": {
      const mem = sg.mem ?? []; const bosses = mem.filter((m) => m.type === "boss").length;
      if (stage >= 4 && sg.chat !== 0 && bosses >= 1 && !inCombat(p) && cd(s, "pat", 24000, now)) { sageSay(p, "ci_memory", { cd: 0 }); return "Memória relacionada encontrada"; }
      return `${mem.length} fatos na memória`;
    }
    case "ore": return scanOre(p, s, now);
    case "gear": return checkGear(p, s, now);
    default: return "—";
  }
}

// ------------------------------------------------------------------ minério e equipamento
const ORE_RE = /(^|_)ore$|ancient_debris/;
/** Grade esparsa (passo 2) de 13x7x13 blocos ao redor do jogador, com origem alternando a cada rodada: ~200 consultas a cada 5 s, só se houver dicas ligadas. */
function scanOre(p, s, now) {
  const sg = sageCfg(getData(p)); if (sg.tips === false || sg.perf || inCombat(p)) return "Aguardando";
  const l = p.location, ox = Math.floor(l.x), oy = Math.floor(l.y), oz = Math.floor(l.z), ph = Math.floor(now / 100) % 2, found = new Map(); let n = 0;
  for (let dx = -6 + ph; dx <= 6; dx += 2) for (let dy = -3; dy <= 3; dy += 2) for (let dz = -6 + ph; dz <= 6; dz += 2) {
    let b; try { b = p.dimension.getBlock({ x: ox + dx, y: oy + dy, z: oz + dz }); } catch { continue; }
    const t = b?.typeId; if (t && ORE_RE.test(t)) { n++; found.set(t, (found.get(t) ?? 0) + 1); }
  }
  for (const t of found.keys()) { try { learn(p, "materials", t, t.split(":").pop().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), {}, true); } catch { /* ignore */ } }
  if (n >= 3) { alert(p, "ore", null, "Detectada concentração de minério.", undefined, { soft: true }); return `Minério: ${n} pontos`; }
  return n ? `Minério isolado (${n})` : "Sem minério";
}
const GEAR_SLOTS = ["Mainhand", "Head", "Chest", "Legs", "Feet"];
const gearSig = new Map();   // playerId -> assinatura do equipamento (para PLAYER_EQUIPS)
/** Durabilidade baixa (aviso ALTO) e registro de armas/armaduras usadas no conhecimento; emite PLAYER_EQUIPS quando o equipamento muda. */
function checkGear(p, s, now) {
  let eq; try { eq = p.getComponent("minecraft:equippable"); } catch { /* ignore */ }
  if (!eq) return "—";
  const sig = []; let worst = null;
  for (const slot of GEAR_SLOTS) {
    let it; try { it = eq.getEquipment(slot); } catch { /* ignore */ }
    sig.push(it?.typeId ?? "-");
    if (!it) continue;
    const inf = ITEMS[it.typeId];
    if (inf && (inf.kind === "weapon" || inf.kind === "armor")) { try { learn(p, inf.kind === "weapon" ? "weapons" : "armor", it.typeId, inf.name, { r: inf.rarity }, true); } catch { /* ignore */ } }
    try {
      const du = it.getComponent("minecraft:durability");
      if (du && du.maxDurability > 0) { const left = du.maxDurability - du.damage, frac = left / du.maxDurability; if (frac <= 0.1 && (!worst || frac < worst.frac)) worst = { frac, name: inf?.name ?? it.typeId.split(":").pop().replace(/_/g, " ") }; }
    } catch { /* sem componente de durabilidade */ }
  }
  const key = sig.join("|"), prev = gearSig.get(p.id); gearSig.set(p.id, key);
  if (prev !== undefined && prev !== key) { try { emit(EV.PLAYER_EQUIPS, { player: p, slots: sig }); } catch { /* ignore */ } }
  if (worst) { alert(p, "durability", null, `Durabilidade do equipamento baixa: ${worst.name}.`, undefined, { soft: true }); return `Equipamento: ${worst.name} quase quebrando`; }
  return "Equipamento em ordem";
}
export const dropGear = (id) => gearSig.delete(id);

export const PROC_INTERVAL = 10, MAX_TASKS_PER_PASS = 3;
/** Uma passada do processamento paralelo para UM jogador: executa as tarefas vencidas, por ordem de prioridade (a ordem de TASKS), no máximo `limit`.
 *  As que vencem além do limite ficam na fila (queued) e entram na próxima passada. Um erro numa tarefa não impede as outras. */
function passFor(p, now, limit = MAX_TASKS_PER_PASS) {
  const d = getData(p), sg = sageCfg(d), stage = sageStage(d), s = S(p); let ran = 0, due = 0;
  while (s.q.length && ran < limit) {                              // 1º a fila de prioridade (tarefas avulsas)
    const t = s.q.shift(); ran++;
    const rk = Object.keys(s.res); if (rk.length > 40 && !(t.id in s.res)) delete s.res[rk[0]];   // resultados de tarefas avulsas não crescem sem fim
    try { s.res[t.id] = t.fn(p) ?? "ok"; } catch (e) { s.res[t.id] = "—"; Log.error(`tarefa avulsa ${t.id}: ${e}`, "Processos"); }
  }
  for (const t of TASKS) {                                         // 2º as tarefas periódicas, na ordem de prioridade
    if (!taskAvailable(sg, stage, t) || (s.next.get(t.id) ?? 0) > now) continue;
    if (ran >= limit) { due++; continue; }
    const per = t.every * (stage >= 3 ? 0.75 : 1) * (modOn(sg, "accel") && stage >= 2 ? 0.8 : 1) * (sg.perf ? 2 : 1);   // modo desempenho: tarefas na metade da frequência
    s.next.set(t.id, now + Math.round(per) + ((p.id.length + t.id.length) % 7)); ran++;
    try { s.res[t.id] = runTask(p, t, s, now, d, sg, stage); } catch (e) { s.res[t.id] = "—"; Log.error(`tarefa ${t.id}: ${e}`, "Processos"); }
    sg.tasks = (sg.tasks ?? 0) + 1;
  }
  s.due = due; s.queued = due + s.q.length; s.ran = ran; s.lastAt = now; noteQueue(s.queued);
  return ran;
}
/** GreatSage.process(): executa AGORA todas as tarefas disponíveis uma vez (sem esperar o prazo). Os avisos continuam passando pelo porteiro anti-spam. */
export function processNow(p, now = system.currentTick) {
  const s = S(p); s.next.clear(); passFor(p, now, TASKS.length);
  return { ...s.res };
}

export function startSageProc() {
  system.runInterval(() => {
    const now = system.currentTick;
    for (const p of world.getAllPlayers()) {
      try { measure("scan", () => passFor(p, now)); } catch (e) { Log.error(`sageproc: ${e}`, "Processos"); }
    }
  }, PROC_INTERVAL);
  // ataque poderoso detectado (Aceleração do Pensamento: previsão/identificação de golpes fortes)
  world.afterEvents.entityHurt.subscribe((ev) => {
    try {
      const p = ev.hurtEntity; if (p?.typeId !== "minecraft:player") return;
      const h = healthComp(p); if (!h || ev.damage < h.effectiveMax * 0.3) return;
      const stage = sageStage(getData(p)); if (stage >= 1) alert(p, "bighit", "al_attack", "Ataque poderoso detectado!", 900, { urgent: true });
    } catch { /* ignore */ }
  });
}

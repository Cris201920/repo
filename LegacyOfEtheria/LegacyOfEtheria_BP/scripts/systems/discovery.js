// systems/discovery.js - Descoberta de Habilidades Únicas, combinação, despertar (maestria 10) e estatísticas de progresso.
import { sceneOn } from "./sageannounce.js";
import { world, system } from "@minecraft/server";
import { getData, markDirty, saveNow } from "../core/db.js";
import { SKILLS } from "../data/skills.js";
import { VOICE } from "../data/voice.gen.js";
import { grantSkill, hasSkill } from "./skills.js";
import { masteryLevel, MASTERY_MAX } from "./mastery.js";
import { applyDerivedStats } from "./stats.js";
import { sageSay, skillSay, sageCfg, sysSay, sageText } from "./voice.js";
import { ctx, disc, helix, column, burst, ringFlat, CIRCLE, T, after } from "./fxlib.js";
import { toast, say, playSound } from "../core/utils.js";
import { nextStages } from "../data/races.js";
import { evolveCheck } from "./race.js";
import { SOUNDS, RARITY, STARTER_WEIGHT, UNIQUE_HARD, MAX_LEVEL } from "../config.js";
const PRED_LINE = ["predator", "gluttony", "beelzebuth"];
/** 6.87: quem tem a linha do Predador mantém as regras antigas; os demais têm Únicas mais difíceis */
export const hardUnique = (d) => !PRED_LINE.some((k) => hasSkill(d, k));
/** 6.98: quantas Únicas o personagem tem e quantas o núcleo suporta */
export const uniqueCount = (d) => Object.keys(SKILLS).filter((k) => SKILLS[k].cat === "Única" && hasSkill(d, k)).length;
export const uniqueCap = (d) => UNIQUE_HARD.capBase + Math.floor((d.level ?? 1) / UNIQUE_HARD.capPerLevels) + (hardUnique(d) ? 0 : UNIQUE_HARD.capPred);
import { menu } from "./ui/forms.js";
import { learn, remember, addBond, addExp } from "./sageknow.js";
import { emit, EV } from "../core/bus.js";

export const COMBOS = [
  { id: "great_sage", from: ["analyst", "researcher", "perceptor"], mastery: 3 },
  { id: "ruler", from: ["generalissimo", "pride"], mastery: 3 },
  { id: "usurper", from: ["envy", "lust"], mastery: 3 },
];
const COMBO_SET = new Set(COMBOS.map((c) => c.id));

export const stat = (d) => (d.stat ??= { hurt: 0, dist: 0, idle: 0, lastX: null, lastZ: null });
const sum = (o) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);

/** Retorna [{ok, text}] das condições de descoberta de uma Única. */
export function conditions(d, id) {
  let u = SKILLS[id]?.unlock; if (!u) return [];
  const sg = sageCfg(d), s = stat(d), out = [];
  const add = (ok, text) => out.push({ ok, text });
  const H = hardUnique(d), U = UNIQUE_HARD, mult = H ? U.mult : U.predMult, lvAdd = H ? U.levelAdd : U.predLevelAdd, mAdd = H ? U.masteryAdd : U.predMasteryAdd;
  const M = (n) => Math.ceil(n * mult);   // 6.98: requisitos maiores para todos (a linha do Predador só tem menos acréscimo)
  u = { ...u, level: u.level ? Math.min(MAX_LEVEL ?? 100, u.level + lvAdd) : u.level, kills: u.kills && M(u.kills), analyses: u.analyses && M(u.analyses),
    discoveries: u.discoveries && M(u.discoveries), mastery_total: u.mastery_total && M(u.mastery_total), bossKills: u.bossKills && M(u.bossKills), boss: u.boss && M(u.boss),
    devoured: u.devoured && M(u.devoured), coins: u.coins && M(u.coins), hurt: u.hurt && M(u.hurt), idle: u.idle && M(u.idle), distance: u.distance && M(u.distance),
    mastery: u.mastery && Object.fromEntries(Object.entries(u.mastery).map(([k, v]) => [k, Math.min(10, v + mAdd)])) };
  if (u.level) add(d.level >= u.level, `Nível ${u.level}`);
  if (u.kills) add(d.kills >= u.kills, `${u.kills} abates (${d.kills})`);
  if (u.analyses) add(sg.analyses >= u.analyses, `${u.analyses} análises (${sg.analyses})`);
  if (u.discoveries) add(Object.keys(sg.archive).length >= u.discoveries, `${u.discoveries} registros no arquivo`);
  if (u.skills) for (const k of u.skills) add(hasSkill(d, k), `Possuir ${SKILLS[k]?.name ?? k}`);
  if (u.mastery) for (const [k, v] of Object.entries(u.mastery)) add((d.mastery?.[k] ?? 0) >= v * v * 4, `${SKILLS[k]?.name ?? k} Nv.${v}`);
  if (u.mastery_total) add(sum(d.mastery) >= u.mastery_total * 4, `Maestria acumulada ${u.mastery_total}`);
  if (u.bossKills) add(sum(d.bossKills) >= u.bossKills, `${u.bossKills} boss(es) derrotado(s)`);
  if (u.boss) add(sum(d.bossKills) >= u.boss, `${u.boss} boss derrotado`);
  if (u.devoured) add((d.devoured ?? 0) >= u.devoured, `${u.devoured} criaturas devoradas (${d.devoured ?? 0})`);
  if (u.coins) add(d.coins >= u.coins, `${u.coins} moedas`);
  if (u.hurt) add(s.hurt >= u.hurt, `Sofrer ${u.hurt} golpes (${s.hurt})`);
  if (u.idle) add(s.idle >= u.idle * 300, `Meditar ${u.idle * 5} min parado`);
  if (u.distance) add(s.dist >= u.distance * 1000, `Percorrer ${u.distance * 1000} blocos`);
  if (out.length && !SKILLS[id]?.unlock?.combine) {   // 6.98: limite de Únicas no núcleo e espera entre descobertas
    const n = uniqueCount(d), cap = uniqueCap(d);
    add(n < cap, `Espaço no núcleo para Únicas (${n}/${cap}; +1 a cada ${U.capPerLevels} níveis)`);
    const left = Math.ceil(((d.lastUniqueAt ?? 0) + U.cooldownMin * 60000 - Date.now()) / 60000);
    add(left <= 0, left > 0 ? `Núcleo estabilizando (faltam ${left} min)` : "Núcleo estável");
  }
  return out;
}

function discover(player, id) {
  try { getData(player).lastUniqueAt = Date.now(); } catch { /* ignore */ }
  const d = getData(player), sk = SKILLS[id];
  grantSkill(player, id); applyDerivedStats(player);
  try { learn(player, "evolutions", "disc_" + id, `Descoberta: ${sk.name}`, {}, true); remember(player, "know", `Descobriu ${sk.name}`); addExp(player, 10); } catch { /* ignore */ }
  if (sceneOn(player)) return;   // 6.35: a cena da Voz do Mundo anuncia (sem título, chat, voz e partículas duplicados)
  sageSay(player, "unique_acquired"); sageSay(player, "ds_knowledge");
  skillSay(player, id, "act", { cd: 0 });
  toast(player, "§d§lHABILIDADE ÚNICA", `§f${sk.name}`);
  say(player, `§d[Única] §fVocê obteve §d${sk.name}§f. §7${sk.desc}`);
  playSound(player, SOUNDS.mythic, 1, 1);
  const c = ctx(player, 2);
  disc(c, player.location, { col: "violet", circle: CIRCLE.evolve, size: 5, life: 2.5, rot: 40 });
  helix(c, player.location, { col: "gold", tile: T.star, r: 1.2, h: 4, steps: 20, turns: 3, dur: 30 });
  saveNow(player);
}

/** Verificação periódica (1x/s). */
function tickPlayer(p, full = true) {
  const d = getData(p), s = stat(d), sg = sageCfg(d);
  // estatísticas: distância e imobilidade
  const L = p.location;
  if (s.lastX !== null) {
    const m = Math.hypot(L.x - s.lastX, L.z - s.lastZ);
    if (m < 0.3) s.idle += 1; else s.idle = Math.max(0, s.idle - 0); if (m > 0.3 && m < 40) s.dist += m;
  }
  s.lastX = L.x; s.lastZ = L.z;
  if (!full) return;   // 9.2 (desempenho): estatísticas a cada 1 s; a varredura de Únicas/combinações/evolução a cada 5 s
  // descoberta
  for (const id of Object.keys(SKILLS)) {
    const sk = SKILLS[id]; if (sk.cat !== "Única" || !sk.unlock || hasSkill(d, id) || COMBO_SET.has(id)) continue;
    const cs = conditions(d, id); if (!cs.length) continue;
    if (cs.every((c) => c.ok)) { if (system.currentTick - (sg.seen.lastDisc ?? -9999) < 200) continue; sg.seen.lastDisc = system.currentTick; discover(p, id); markDirty(p); return; }
    if (!sg.seen["hint_" + id] && cs.filter((c) => c.ok).length >= Math.ceil(cs.length * 0.7) && cs.length > 1) { sg.seen["hint_" + id] = true; sageSay(p, "ds_unique"); }
  }
  // combinação disponível
  for (const cb of COMBOS) {
    if (hasSkill(d, cb.id) || sg.seen["cmb_" + cb.id]) continue;
    if (cb.from.every((k) => hasSkill(d, k) && masteryLevel(p, k) >= cb.mastery)) { sg.seen["cmb_" + cb.id] = true; sageSay(p, "cmb_compat"); sageSay(p, "cmb_possible"); sageText(p, `§fCombinação disponível: §d${SKILLS[cb.id].name}§f. Abra o livro do Sábio → Combinar habilidades.`); markDirty(p); }
  }
  // evolução racial disponível
  try {
    if (!sg.seen["evo_" + d.raceStage]) { const ok = nextStages(d).some((st) => !evolveCheck(p, st)); if (ok) { sg.seen["evo_" + d.raceStage] = true; sysSay(p, "raceevo", "ready", { cd: 0 }); sageSay(p, "evo_ready"); markDirty(p); } }
  } catch { /* ignore */ }
}

export function combine(player, id) {
  const d = getData(player), cb = COMBOS.find((c) => c.id === id);
  if (!cb || hasSkill(d, id)) return { ok: false, msg: "Combinação indisponível." };
  const need = cb.mastery + (hardUnique(d) ? UNIQUE_HARD.masteryAdd : 0);   // 6.87
  const miss = cb.from.find((k) => !hasSkill(d, k) || masteryLevel(player, k) < need);
  if (miss) return { ok: false, msg: `Requer ${SKILLS[miss]?.name ?? miss} (maestria ${need}).` };
  const c = ctx(player, 2), p = player.location;
  sageSay(player, "cmb_done");
  disc(c, p, { col: "sage", circle: CIRCLE.sage, size: 5, life: 3, rot: 60 });
  for (const k of cb.from) after(10, () => ringFlat(c, p, { col: "violet", tile: T.rune1, radius: 2, n: 8, life: 1 }));
  after(30, () => { discover(player, id); burst(c, { x: p.x, y: p.y + 1, z: p.z }, { col: "gold", tile: T.star, n: 16, spd: 4 }); });
  return { ok: true, msg: `Combinando em ${SKILLS[id].name}...` };
}

// ------------------------------------------------------------------ despertar (maestria máxima de uma Única)
export function awakened(d, id) { return !!d.awakened?.[id]; }
export function maybeAwaken(player, id) {
  const d = getData(player), sk = SKILLS[id];
  if (!sk || sk.cat !== "Única" || awakened(d, id) || masteryLevel(player, id) < MASTERY_MAX) return;
  d.awakened ??= {}; d.awakened[id] = true; markDirty(player);
  try { learn(player, "evolutions", "awk_" + id, `Despertar: ${sk.name}`, {}, true); remember(player, "evo", `Despertou ${sk.name}`); addBond(player, 5); addExp(player, 20); } catch { /* ignore */ }
  try { emit(EV.PLAYER_AWAKENS, { player, id }); emit(EV.SAGE_SKILL_AWAKENED, { player, id }); } catch { /* ignore */ }   // skill_awakened
  const c = ctx(player, 2), p = player.location;
  system.runTimeout(() => {
    sageSay(player, "awk_cond", { cd: 0 }); sageSay(player, "awk_start", { cd: 0 });
    disc(c, p, { col: "gold", circle: CIRCLE.evolve, size: 7, life: 5, rot: 30 });
    helix(c, p, { col: "violet", tile: T.star, r: 1.6, h: 5, steps: 26, turns: 3, dur: 50 });
    after(50, () => { column(c, p, { col: "white", tile: T.line, n: 18, h: 10, life: 1.4, r: 1 }); burst(c, { x: p.x, y: p.y + 1, z: p.z }, { col: "gold", tile: T.star, n: 22, spd: 6 }); });
    after(60, () => { skillSay(player, id, "awk", { cd: 0 }); sageSay(player, "awk_link", { cd: 0 }); sageSay(player, "awk_done", { cd: 0 }); });
    after(70, () => {
      if (!d.titles.includes(`Despertar: ${sk.name}`)) d.titles.push(`Despertar: ${sk.name}`);
      toast(player, "§6§lDESPERTAR", `§f${sk.name}`); say(player, `§6[Despertar] §f${sk.name} alcançou sua forma plena: §a+30% de poder§f, §a-20% de custo de mana§f.`);
      playSound(player, SOUNDS.mythic, 1, 0.8); saveNow(player);
    });
  }, 20);
}

export function startDiscovery() {
  let beat = 0;
  system.runInterval(() => { const full = beat++ % 5 === 0; for (const p of world.getAllPlayers()) { try { tickPlayer(p, full); } catch (e) { console.warn(`[Etheria] discovery: ${e}`); } } }, 20);
}

// ------------------------------------------------------------------ Única inicial (sorteada uma única vez no primeiro início)
const NO_STARTER = new Set(["predator", "gluttony", "beelzebuth", "stomach"]);
function starterPool() {
  return Object.values(SKILLS).filter((s) => s.cat === "Única" && !NO_STARTER.has(s.id) && !s.unlock?.combine && STARTER_WEIGHT[s.rarity]);
}
export function rollStarter(hard = false) {
  const W = (s) => STARTER_WEIGHT[s.rarity] * (hard ? UNIQUE_HARD.starterRare[s.rarity] ?? 1 : 1);
  const pool = starterPool(); let tot = 0; for (const s of pool) tot += W(s);
  let r = Math.random() * tot; for (const s of pool) { r -= W(s); if (r <= 0) return s.id; }
  return pool[pool.length - 1].id;
}
/** Concede e apresenta a Única inicial. Só age se o personagem ainda não tem uma salva (não re-sorteia ao morrer/relogar). */
export function grantStarter(player) {
  const d = getData(player);
  if (d.starterUnique) return false;
  const hard = hardUnique(d);
  if (hard && Math.random() >= UNIQUE_HARD.starterChance) {   // 6.87: nem todo mundo nasce com uma Única
    d.starterUnique = "none"; saveNow(player);
    try { sageText(player, "Análise concluída. Nenhuma Habilidade Única despertou no nascimento. Ela ainda pode ser descoberta pela experiência.", { pri: 2, key: "starter.none", cd: 0 }); } catch { /* ignore */ }
    return false;
  }
  const id = rollStarter(hard), sk = SKILLS[id], R = RARITY[sk.rarity];
  d.starterUnique = id; d.lastUniqueAt = Date.now();      // FASE 7 (primeiro, por segurança): salva permanentemente
  grantSkill(player, id); applyDerivedStats(player); saveNow(player);
  if (sceneOn(player)) return true;   // 6.35: só a cena da Voz do Mundo
  const c = ctx(player, 2), p = player.location;
  // FASE 1 — descoberta
  disc(c, p, { col: "violet", circle: CIRCLE.evolve, size: 6, life: 4, rot: 40 });
  toast(player, "§d§l[ NOVA HABILIDADE ÚNICA ]", "§7Algo desperta dentro de você...");
  playSound(player, SOUNDS.mythic, 1, 1);
  // FASE 4 — partículas
  helix(c, p, { col: "gold", tile: T.star, r: 1.3, h: 5, steps: 24, turns: 3, dur: 40 });
  // FASE 3 — voz (Sábio -> habilidade)
  for (const k of ["birth_analyzing", "birth_done", "birth_unique", "birth_acquired"]) sageSay(player, k, { cd: 0 });
  skillSay(player, id, "act", { cd: 0 });
  // FASE 2 — nome / FASE 6 — descrição
  after(50, () => {
    toast(player, `${R.color}§l${sk.name}`, `§7${R.name} · Habilidade Única`);
    say(player, `§d§l[ NOVA HABILIDADE ÚNICA ]§r\n§f${R.color}${sk.name} §8(${R.name})\n§7${sk.desc}\n§8Efeito principal: ${sk.type === "active" ? `ativa · ${sk.mana} mana · recarga ${sk.cd}s` : "passiva permanente"}`);
    column(c, p, { col: "white", tile: T.line, n: 16, h: 9, life: 1.3, r: 1 }); burst(c, { x: p.x, y: p.y + 1, z: p.z }, { col: "gold", tile: T.star, n: 20, spd: 5 });
  });
  // FASE 5 — ícone (tela com o ícone da habilidade)
  after(300, () => menu(player, "§l§d[ NOVA HABILIDADE ÚNICA ]", `${R.color}§l${sk.name}\n§r§7Raridade: ${R.color}${R.name}\n\n§f${sk.desc}\n\n§8${sk.type === "active" ? `Ativa — custo ${sk.mana} de mana, recarga ${sk.cd}s. Equipada automaticamente.` : "Passiva — sempre ativa."}\n§8As demais Únicas são descobertas por progressão, maestria e combinação.`, [{ text: `§l${sk.name}`, icon: "skill_" + id, run: () => {} }, { text: "Continuar", run: () => {} }]));
  return true;
}

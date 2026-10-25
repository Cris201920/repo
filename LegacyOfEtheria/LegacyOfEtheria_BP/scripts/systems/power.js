// systems/power.js - 6.55: CLASSIFICAÇÃO DE PODER, AURA MÁGICA, BRILHO PRATEADO E PRESSÃO DE PODER.
// Tudo calculado com dados REAIS do addon (nada inventado):
//   jogador: nível, profundidade da evolução racial (quantas evoluções desde a raiz), Lord Demônio, raridade das habilidades aprendidas e vida máxima;
//   criatura/chefe: vida máxima real (componente de vida) + raridade em MOBS (boss/legendary/special) + tier do perfil de batalha.
// Classes (estilo Tensura): F, E, D, C, B, A, S, SS e Catástrofe.
//
// AURA (jogador): estágio visual pela classe (0 = nada, 4 = lendária), cor pela raça, mais intensa em combate.
//   Brilho prateado (estética inspirada no "Instinto Superior", SÓ visual): pontos de luz prateados orbitando o corpo, faíscas subindo devagar,
//   linhas finas contornando o corpo e pequenos lampejos. Liberado na classe S+ (ou habilidade Divina / Ciel); ligado em Configurações.
//   Fica mais forte em bloqueios da Barreira, esquivas e vida baixa (pulse()).
// PRESSÃO: chefe com classe 2+ acima do jogador -> alerta do Sábio, aviso discreto na tela e penalidade proporcional enquanto estiver perto
//   (Fraqueza/Lentidão leves). Compensações reais: habilidade de vontade/resistência, Lord Demônio, Raphael/Ciel e Barreira ativa reduzem a diferença.
// 9.8: AURA DA RAÇA (raceSmoke): demônio / caído / Lord Demônio soltam FUMAÇA preta-roxa com veios vermelhos subindo; anjos, NÉVOA de luz
//   branca com pó de luz dourado e anel de luz. Cresce a cada evolução (tierOf: altura, volume, densidade; Lord: coluna alta + halo de fumaça).
//   1 chamada (etheria:aurasmoke, variable.count partículas) por jogador a cada 10 ticks; fraca em repouso, forte em combate/voo; nível de FX
//   100/55/25% e o MESMO teto de partículas vivas por jogador das asas (particlewings.liveBudget). Outras raças: aura de sempre.
// 9.9: AS OUTRAS RAÇAS (data/racepw.js) também: raceAuraKind devolve { kind: "race", race } e a aura sai na paleta da raça (fumaça/luz + traço
//   que sobe: gotas, folhas, chamas, almas, morcegos, fagulhas; halo nos estágios finais/Lorde), crescendo do fiapo baixo à coluna/halo.
// Laço único a cada 10 ticks, só para jogadores; partículas pelo orçamento do fxlib (respeita a qualidade escolhida, "desligado" = nada).
import { world, system, Player } from "@minecraft/server";
import { getData } from "../core/db.js";
import { isValid, healthComp } from "../core/utils.js";
import { SKILLS } from "../data/skills.js";
import { RACES } from "../data/races.js";
import { MOBS } from "../data/mobs.gen.js";
import { ctx, mote, streak, ringFlat, burst, orbit, T, emitMany } from "./fxlib.js";
import { inCombat } from "./combat.js";
import { sageText, sageStage } from "./voice.js";
import { emit, EV } from "../core/bus.js";
import { addHudLine } from "./hudhooks.js";
import { bodyOfStage, tierOf } from "./raceparts.js";
import { isLordStage } from "../data/races.js";
import { liveBudget } from "./particlewings.js";
import { PW_RACES, RACE_PW } from "../data/racepw.js";
import { lineageOf } from "../data/lineages.js";

export const RANKS = [
  { id: "F", name: "F", col: "§7" }, { id: "E", name: "E", col: "§f" }, { id: "D", name: "D", col: "§a" }, { id: "C", name: "C", col: "§2" },
  { id: "B", name: "B", col: "§b" }, { id: "A", name: "A", col: "§9" }, { id: "S", name: "S", col: "§6" }, { id: "SS", name: "SS", col: "§c" },
  { id: "CAT", name: "Catástrofe", col: "§4" },
];
const P_TH = [15, 30, 50, 75, 105, 140, 180, 250];          // pontuação do jogador -> classe
const HP_TH = [60, 150, 300, 1000, 3000, 8000, 18000, 35000]; // vida máxima da criatura -> classe
const RW = { common: 1, uncommon: 2, rare: 4, epic: 7, legendary: 12, mythic: 18, divine: 26 };
const cls = (v, th) => { let i = 0; while (i < th.length && v >= th[i]) i++; return i; };

/** profundidade da evolução racial (0 = estágio inicial) */
export function raceDepth(d) {
  const r = RACES[d.race]; let s = r?.stages?.[d.raceStage], n = 0;
  while (s?.from && n < 12) { n++; s = r.stages[s.from]; }
  return n;
}
/** Pontuação e classe de poder do jogador. */
export function playerPower(p) {
  const d = getData(p), depth = raceDepth(d), lord = /_ld$|^demon_4$/.test(d.raceStage ?? "");
  let sk = 0, divine = false;
  for (const id of d.unlockedSkills ?? []) { const s = SKILLS[id]; if (!s) continue; sk += RW[s.rarity] ?? 1; if (s.rarity === "divine") divine = true; }
  const hp = healthComp(p)?.effectiveMax ?? 20;
  const score = Math.round(d.level + depth * 10 + (lord ? 30 : 0) + Math.min(70, sk / 3) + Math.min(40, hp / 20));
  return { score, rank: cls(score, P_TH), depth, lord, divine, skills: sk };
}
/** Classe de poder de qualquer criatura (vida máxima real + raridade + tier de perfil). */
export function entityRank(e) {
  if (e instanceof Player) return playerPower(e).rank;
  const m = MOBS[e.typeId], hp = healthComp(e)?.effectiveMax ?? m?.hp ?? 20;
  let r = cls(hp, HP_TH);
  if (m?.rar === "legendary") r = Math.max(r, 6); else if (m?.rar === "boss") r = Math.max(r, 4);
  if (/veldora|velzard|velgrynd|veldanava|guy_crimson|milim_nava/.test(e.typeId)) r = 8;   // Dragões Verdadeiros e Lordes primordiais
  return Math.min(8, r);
}
export const isBossType = (id) => ["boss", "legendary", "special"].includes(MOBS[id]?.rar);
export const rankLabel = (r) => `${RANKS[r].col}${RANKS[r].name}§r`;

// ---------------------------------------------------------------- compensações (reduzem a diferença de poder)
const WILL = /will|haki|resist|ruler|king|lord|sovereign|authority|aura|vontade|soberan/i;
function compensation(p, d) {
  let c = 0; const why = [];
  if ((d.unlockedSkills ?? []).some((id) => WILL.test(id) || WILL.test(SKILLS[id]?.name ?? ""))) { c++; why.push("vontade/resistência"); }
  if (/_ld$|^demon_4$/.test(d.raceStage ?? "")) { c++; why.push("Lord Demônio"); }
  if (sageStage(d) >= 3) { c++; why.push("análise de Raphael/Ciel"); }
  return { c: Math.min(2, c), why };
}

// ---------------------------------------------------------------- AURA
const RACE_COL = { human: ["steel", "white"], slime: ["mana", "water"], goblin: ["green", "earth"], demon: ["blood", "black"], elf: ["green", "wind"],
  angel: ["holy", "gold"], dragonoid: ["gold", "fire"], beastkin: ["ember", "gold"], undead: ["toxic", "shadow"], ogre: ["fire", "ember"],
  lizardman: ["water", "green"], vampire: ["blood", "violet"], dwarf: ["earth", "gold"] };
const SILVER = [0.86, 0.9, 1];
const st = new Map();   // playerId -> { pulse, prevRank, warnAt, near }
const S = (p) => { let x = st.get(p.id); if (!x) st.set(p.id, (x = { pulse: 0, prevRank: -1, warnAt: 0, pressAt: 0 })); return x; };
/** intensifica a aura por alguns instantes (bloqueio da barreira, esquiva, perigo) */
export function pulse(p, ticks = 30) { try { const x = S(p); x.pulse = Math.max(x.pulse, system.currentTick + ticks); } catch { /* ignore */ } }
export const auraStage = (rank) => (rank <= 1 ? 0 : rank <= 3 ? 1 : rank <= 5 ? 2 : rank <= 6 ? 3 : 4);
export function silverUnlocked(d, pw) { return pw.rank >= 6 || pw.divine || sageStage(d) >= 4; }
/** modo de aura: "auto" (aura da raça), "silver" (brilho prateado, se liberado) ou "off" */
export const auraMode = (d) => d.settings?.aura ?? "auto";

const at = (l, y) => ({ x: l.x, y: l.y + y, z: l.z });
// ---------------------------------------------------------------- 9.8: AURA DA RAÇA (fumaça / luz que cresce com a evolução)
const ANGEL_BODIES = new Set(["angel", "angel_arch", "angel_cherub", "angel_seraph"]);
const AFX = { extreme: 1, ultra: 1, high: 1, medium: 0.55, low: 0.25 };
/** "dark" (demônio, caído, Lord Demônio), "light" (anjo) ou null (outras raças: aura de sempre) + estágio (1-6) e Lorde */
export function raceAuraKind(d) {
  if (!d?.raceChosen || !d.raceStage) return null;
  const st = d.raceStage, lord = isLordStage(st) || st === "demon_4", t = Math.max(1, tierOf(d));
  if (ANGEL_BODIES.has(bodyOfStage(st))) return { kind: "light", t, lord };
  if (PW_RACES.has(d.race)) {   // 9.9: outras raças (Lorde Demônio delas também): aura na paleta da raça; linhagem dracônica fica com a aura de sempre
    let lin = null; try { lin = lineageOf(d); } catch { /* ignore */ }
    return lin ? null : { kind: "race", race: d.race, t, lord };
  }
  if (d.race === "demon" || /^(angel_f|fall_)/.test(st) || lord) return { kind: "dark", t, lord, fallen: d.race === "angel" };
  return null;
}
/** parâmetros do emissor etheria:aurasmoke por tipo/estágio (puro; usado também pelo simulador). act: 0,7 repouso, 1,2 voo, 1,6 combate */
export function auraVars(k, act = 1, f = 1) {
  const t = k.t, L = k.lord;
  if (k.kind === "dark") {
    const ring = L || t >= 5 ? 0.16 : t >= 4 ? 0.08 : 0;
    return { count: Math.min(120, Math.round((3 + 4.5 * t) * (L ? 1.3 : 1) * act * f)), life: 0.9 + 0.22 * t, hgt: (0.35 + 0.3 * t) * (L ? 1.15 : 1), rise: 0.35 + 0.16 * t,
      rad: 0.4 + 0.07 * t, sz: 0.13 + 0.045 * t, grow: 1, swl: 40 + 10 * t, a: Math.min(0.72, 0.45 + 0.05 * t),
      cr: k.fallen ? 0.06 : 0.05, cg: 0.03, cb: k.fallen ? 0.1 : 0.06,                                     // fumaça preta (caído: mais roxa)
      vein: 0.12 + 0.03 * t, vw: 0.05, vh: 0.22 + 0.05 * t, vr: 0.88, vg: 0.06, vb: 0.08, va: 1, vu: 48, vv: 16,   // veios vermelhos subindo
      ring, ry: 2.15, rr: 0.5 + 0.05 * t, rs: 0.22 + 0.04 * t, gr: 0.07, gg: 0.02, gb: 0.09, ra: 0.75, ru: 16, rv: 16, dvx: 0, dvz: 0 };   // halo de fumaça (Lord)
  }
  if (k.kind === "race") {   // 9.9: estágio 1 = fiapos baixos e discretos; finais/Lorde = coluna alta + halo
    const A = RACE_PW[k.race]?.aura ?? RACE_PW.human.aura;
    const ring = L ? 0.16 : t >= 4 ? 0.1 : t >= 3 ? 0.05 : 0;
    return { count: Math.min(120, Math.round((3 + 3.8 * t) * A.cK * (L ? 1.3 : 1) * act * f)), life: 0.85 + 0.18 * t, hgt: (0.2 + 0.27 * t) * A.hK * (L ? 1.2 : 1),
      rise: (0.25 + 0.13 * t) * A.rK, rad: 0.38 + 0.06 * t, sz: (0.1 + 0.04 * t) * A.szK, grow: 1, swl: A.swl + 5 * t, a: Math.min(A.amax, A.a0 + 0.06 + 0.04 * t),
      cr: A.smoke[0], cg: A.smoke[1], cb: A.smoke[2],
      vein: Math.min(0.5, A.vfrac + 0.02 * t), vw: A.vw * (1 + 0.08 * t), vh: A.vh * (1 + 0.08 * t), vr: A.vein[0], vg: A.vein[1], vb: A.vein[2], va: 1, vu: A.vu, vv: A.vv,
      ring, ry: A.ry, rr: 0.45 + 0.05 * t, rs: 0.1 + 0.025 * t, gr: A.ring[0], gg: A.ring[1], gb: A.ring[2], ra: A.ra, ru: A.ru, rv: A.rv, dvx: 0, dvz: 0 };
  }
  return { count: Math.min(120, Math.round((3 + 4 * t) * (L ? 1.2 : 1) * act * f)), life: 1.0 + 0.18 * t, hgt: 0.5 + 0.28 * t, rise: 0.3 + 0.12 * t,
    rad: 0.4 + 0.06 * t, sz: 0.16 + 0.04 * t, grow: 1, swl: 60, a: Math.min(0.5, 0.28 + 0.03 * t),
    cr: 1, cg: 0.97, cb: 0.88,                                                                                  // névoa de luz branca
    vein: Math.min(0.55, 0.35 + 0.03 * t), vw: 0.07 + 0.012 * t, vh: 0.07 + 0.012 * t, vr: 1, vg: 0.84, vb: 0.32, va: 1, vu: 16, vv: 0,   // pó de luz dourado
    ring: t >= 4 ? 0.2 : t >= 3 ? 0.1 : 0, ry: 1.0, rr: 0.8 + 0.05 * t, rs: 0.07 + 0.01 * t, gr: 1, gg: 0.88, gb: 0.45, ra: 1, ru: 32, rv: 16, dvx: 0, dvz: 0 };   // anel de luz
}
function raceSmoke(p, d, now, hot) {
  const k = raceAuraKind(d); if (!k) return false;
  const c = ctx(p, 1); if (c.k <= 0) return true;
  c.pid = p.id;
  let fly = false; try { fly = !p.isOnGround || (p.getProperty("etheria:fly") ?? 0) > 0; } catch { /* ignore */ }
  const V = auraVars(k, hot ? 1.6 : fly ? 1.2 : 0.7, AFX[c.lv] ?? c.k);
  const n = liveBudget(c, now, V.count, V.life, 1); if (!n) return true;
  V.count = n; emitMany(c, "etheria:aurasmoke", p.location, V);
  return true;
}
function playerAura(p, d, pw, now) {
  const mode = auraMode(d); if (mode === "off") return;
  const x = S(p), fight = inCombat(p), hot = x.pulse > now, low = (() => { const h = healthComp(p); return h ? h.currentValue / h.effectiveMax < 0.3 : false; })();
  const stage = auraStage(pw.rank); const silver = mode === "silver" && silverUnlocked(d, pw);
  let rs = false; try { rs = raceSmoke(p, d, now, fight || hot || low); } catch { /* ignore */ }   // 9.8: fumaça/luz da raça (substitui a camada 1)
  if (!silver && stage === 0) return;
  if (!silver && !fight && !hot && stage < 3 && beat % 3 !== 0) return;   // fora de combate auras fracas pulsam devagar
  const c = ctx(p, 1); if (c.k <= 0) return;
  const L = p.location, k = (fight ? 1.4 : 1) * (hot || low ? 1.6 : 1);
  if (silver) { silverGlow(c, p, L, k, now, hot || low); return; }
  const [c1, c2] = RACE_COL[d.race] ?? ["mana", "white"];
  const ph = now / 6;
  // 1: pequenas partículas ao redor do corpo
  if (!rs) for (let i = 0; i < Math.round((1 + stage) * k); i++) { const a = Math.random() * 6.283, r = 0.45 + Math.random() * 0.35;
    mote(c, { x: L.x + Math.cos(a) * r, y: L.y + 0.1 + Math.random() * 1.8, z: L.z + Math.sin(a) * r }, { col: i % 2 ? c1 : c2, tile: T.spark, size: 0.07 + stage * 0.015, spd: 0.5, dir: [0, 1, 0], life: 0.6, a: 0.85 }); }
  // 2: órbitas mais densas
  if (stage >= 2) for (let i = 0; i < 2 + stage; i++) { const a = ph + (i / (2 + stage)) * 6.283, y = 0.3 + ((i * 0.37 + now * 0.01) % 1.6);
    mote(c, { x: L.x + Math.cos(a) * 0.75, y: L.y + y, z: L.z + Math.sin(a) * 0.75 }, { col: c1, tile: T.orb, size: 0.09, spd: 0.7, dir: [-Math.sin(a), 0.15, Math.cos(a)], life: 0.45, drag: 0 }); }
  // 3: correntes de energia e ondas
  if (stage >= 3 && (fight || hot || beat % 2 === 0)) { ringFlat(c, at(L, 0.05), { col: c2, tile: T.ring, n: 10, radius: 1.6, life: 0.5, size: 0.12, a: 0.7 });
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.283, b = { x: L.x + Math.cos(a) * 0.6, y: L.y + 0.2, z: L.z + Math.sin(a) * 0.6 }; streak(c, b, { x: b.x, y: b.y + 1.4 + Math.random(), z: b.z }, { col: c1, w: 0.05, life: 0.3, a: 0.8 }); } }
  // 4: camadas lendárias (anéis em alturas diferentes + rajada)
  if (stage >= 4 && (fight || hot || beat % 4 === 0)) { for (const y of [0.3, 1.1, 1.9]) ringFlat(c, at(L, y), { col: y > 1 ? c2 : c1, tile: T.spark, n: 8, radius: 0.9, spd: 1.2, life: 0.35, size: 0.08 }); burst(c, at(L, 1.1), { col: c1, tile: T.star, n: 5, spd: 1.5, life: 0.5, size: 0.1 }); }
}
/** Brilho prateado: delicado, abundante e sem cobrir o corpo (partículas pequenas, translúcidas, rentes ao contorno). */
function silverGlow(c, p, L, k, now, hot) {
  const n = Math.round(6 * k), ph = now / 5;
  for (let i = 0; i < n; i++) {   // pontos de luz orbitando em alturas diferentes (pernas, tronco, braços, cabeça)
    const a = ph * (i % 2 ? 1 : -1) + (i / n) * 6.283, y = [0.25, 0.7, 1.1, 1.45, 1.8][i % 5], r = y > 1.6 ? 0.42 : 0.5;
    mote(c, { x: L.x + Math.cos(a) * r, y: L.y + y, z: L.z + Math.sin(a) * r }, { col: i % 3 ? SILVER : "white", tile: T.spark, size: 0.05 + Math.random() * 0.04, spd: 0.35, dir: [-Math.sin(a), 0.25, Math.cos(a)], life: 0.5, a: 0.9, drag: 0.2 });
  }
  for (let i = 0; i < Math.round(3 * k); i++) {   // faíscas subindo devagar
    const a = Math.random() * 6.283, r = 0.3 + Math.random() * 0.3;
    mote(c, { x: L.x + Math.cos(a) * r, y: L.y + Math.random() * 1.6, z: L.z + Math.sin(a) * r }, { col: SILVER, tile: T.blob, size: 0.035, spd: 0.4, dir: [0, 1, 0], life: 1.1, a: 0.75, grow: -0.2 });
  }
  if (beat % 2 === 0 || hot) for (let i = 0; i < 2; i++) {   // linhas finas contornando o corpo
    const a = Math.random() * 6.283, b = { x: L.x + Math.cos(a) * 0.48, y: L.y + 0.1, z: L.z + Math.sin(a) * 0.48 };
    streak(c, b, { x: b.x, y: b.y + 1.7, z: b.z }, { col: SILVER, w: 0.025, life: 0.25, a: 0.6 });
  }
  if (Math.random() < (hot ? 0.6 : 0.2)) mote(c, { x: L.x + (Math.random() - 0.5), y: L.y + 0.4 + Math.random() * 1.3, z: L.z + (Math.random() - 0.5) }, { col: "white", tile: T.star, size: 0.16, life: 0.15, a: 1, grow: -1 });   // lampejos
  if (hot) ringFlat(c, at(L, 0.9), { col: SILVER, tile: T.spark, n: 10, radius: 1.1, spd: 1.6, life: 0.3, size: 0.05 });   // ondas sutis no perigo
}

// ---------------------------------------------------------------- PRESSÃO DE PODER + aura dos chefes
const PRESS_R = 18;
function pressure(p, d, pw, now) {
  let boss = null, br = -1;
  try { for (const e of p.dimension.getEntities({ location: p.location, maxDistance: PRESS_R, families: ["mob"] })) { if (!isBossType(e.typeId)) continue; const r = entityRank(e); if (r > br) { br = r; boss = e; } } } catch { return; }
  const x = S(p); if (!boss) { x.boss = null; x.press = ""; return; }
  const comp = compensation(p, d), gap = br - pw.rank - comp.c;
  x.boss = { id: boss.id, gap };
  bossAura(p, boss, br, gap, now);
  if (gap < 2) return;
  // penalidade proporcional (renovada a cada 10 ticks enquanto estiver perto): -1 gap = fraqueza I; 4+ = fraqueza II + lentidão I
  try { p.addEffect("weakness", 30, { amplifier: gap >= 4 ? 1 : 0, showParticles: false }); if (gap >= 4) p.addEffect("slowness", 30, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
  x.press = `§4◆ §cPressão §8(${rankLabel(br)} §8vs ${rankLabel(pw.rank)}§8)`;   // 6.69: nome do chefe já está na barra dele x.pressAt = now + 30;
  if (now >= x.warnAt) {
    x.warnAt = now + 2400;
    const nm = MOBS[boss.typeId]?.name ?? "o alvo";
    const tip = comp.why.length ? ` Fatores que reduzem a pressão: ${comp.why.join(", ")}.` : " Evoluir a raça, aprender habilidades de vontade ou resistência ou fortalecer o Sábio reduz a pressão.";
    try { sageText(p, `Alerta. A presença de ${nm} (classe ${RANKS[br].name}) excede muito a sua (classe ${RANKS[pw.rank].name}). Seus golpes perderão força enquanto estiver perto.${tip}`, { pri: 2, key: "power.press." + boss.typeId, cd: 2400 }); } catch { /* ignore */ }
    emit(EV.BOSS_PRESSURE, { player: p, boss, gap, rank: br });
  }
}
const BOSS_COL = { 4: ["ember", "fire"], 5: ["violet", "void"], 6: ["gold", "holy"], 7: ["blood", "black"], 8: ["white", "mana"] };
function bossAura(p, e, r, gap, now) {
  if (r < 4 || !isValid(e)) return;
  const c = ctx(p, 1, e.dimension); if (c.k <= 0) return;
  const L = e.location, [c1, c2] = BOSS_COL[r] ?? BOSS_COL[4], big = gap >= 2 ? 1.6 : 1, h = Math.min(6, (e.getComponent?.("minecraft:collision_box")?.height ?? 2.4));
  for (let i = 0; i < Math.round((2 + (r - 4) * 2) * big); i++) { const a = Math.random() * 6.283, rr = 0.8 + Math.random();
    mote(c, { x: L.x + Math.cos(a) * rr, y: L.y + Math.random() * h, z: L.z + Math.sin(a) * rr }, { col: i % 2 ? c1 : c2, tile: T.spark, size: 0.12, spd: 1, dir: [0, 1, 0], life: 0.7 }); }
  if (r >= 6 && beat % 2 === 0) ringFlat(c, at(L, 0.1), { col: c1, tile: T.ring, n: 12 + (r - 6) * 6, radius: 2.5 + r * 0.3, life: 0.7, size: 0.18 });
  if (r >= 8 && beat % 4 === 0) { orbit(c, () => (isValid(e) ? at(e.location, h * 0.5) : null), { col: c2, tile: T.orb, n: 4, r: 2.2, dur: 20, step: 2, size: 0.2, speed: 1.5 }); burst(c, at(L, h * 0.6), { col: c1, tile: T.star, n: 8, spd: 3, life: 0.6, size: 0.18 }); }
  if (gap >= 2 && beat % 4 === 0) ringFlat(c, at(p.location, 0.05), { col: "blood", tile: T.ring, n: 10, radius: 1.4, life: 0.4, size: 0.12, a: 0.6 });   // pressão chegando ao jogador
}
/** multiplicador de dano do jogador contra o chefe que o pressiona (1 = sem penalidade; mínimo 0,4) */
export function pressureMul(p, target) {
  const b = st.get(p.id)?.boss; if (!b || b.gap < 2 || target?.id !== b.id) return 1;
  return Math.max(0.4, 1 - 0.15 * (b.gap - 1));
}
/** consulta para a barreira: diferença de poder do chefe mais forte perto do jogador (0 se nenhum) */
export const pressureGap = (p) => st.get(p.id)?.boss?.gap ?? 0;

let beat = 0;
function tick() {
  const now = system.currentTick; beat++;
  for (const p of world.getAllPlayers()) {
    try {
      const d = getData(p), pw = playerPower(p), x = S(p);
      if (x.prevRank >= 0 && pw.rank > x.prevRank) {
        try { sageText(p, `Classe de poder elevada: ${RANKS[x.prevRank].name} para ${RANKS[pw.rank].name}. A aura mágica ficou mais intensa.`, { pri: 3, key: "power.rank", cd: 600 }); } catch { /* ignore */ }
        pulse(p, 60);
      }
      x.prevRank = pw.rank;
      playerAura(p, d, pw, now);
      if (beat % 2 === 0) pressure(p, d, pw, now);
    } catch { /* um jogador com erro não para os outros */ }
  }
}
export function dropPower(id) { st.delete(id); }
export function startPower() {
  system.runInterval(tick, 10);
  world.afterEvents.playerLeave.subscribe((ev) => dropPower(ev.playerId));
  addHudLine((p) => { const x = st.get(p.id); return x?.press && system.currentTick < x.pressAt ? x.press : ""; });   // aviso discreto na HUD
}

// systems/cinematic.js - EVOLUÇÃO CINEMATOGRÁFICA EM 3ª PESSOA. Disparada pelo EVENTO REAL de evolução/transformação (race.evolve, lineage.setForm),
// nunca por habilidade comum. A forma NOVA só é aplicada no momento da transformação (callback `change`), garantidamente UMA vez, mesmo se o jogador
// morrer, sair do mundo ou houver erro. Três categorias: common (rápida), power (acúmulo + ondas), supreme (círculos múltiplos, raios, onda de choque grande, pose final).
// CÂMERA: o Bedrock não oferece câmera livre estável pela API de script; usamos o comando nativo /camera (câmera livre orbitando o personagem, com
// verificação de blocos no caminho) e, se o comando não existir/falhar, o preset de 3ª pessoa frontal; se nada funcionar a evolução segue só com os efeitos
// e a animação corporal (outros jogadores sempre veem). Nada é permanente: a câmera e o controle SEMPRE voltam ao fim, por erro, morte ou saída.
// CONTROLE: /inputpermission (bloqueia movimento) com plano B por efeitos (lentidão + sem pulo) que expiram sozinhos. Habilidades ficam bloqueadas (isCinematic).
// Desempenho: no máx. 3 sequências simultâneas (as demais evoluem sem cinemática), passo a cada 2 ticks, partículas pelo orçamento do fxlib. Config: CINEMATIC em config.js.
import { world, system } from "@minecraft/server";
import { ctx, burst, implode, ringFlat, column, disc, bolt, CIRCLE, T } from "./fxlib.js";
import { getData } from "../core/db.js";
import { isValid } from "../core/utils.js";
import { CINEMATIC } from "../config.js";
import { playTransform } from "./raceparts.js";

const TAG = "etheria_cine", STEP = 2, MAX_ACTIVE = 3;
export const TIERS = {
  common:  { len: 70,  chg: 42,  rings: 2, waves: 1, shock: 7,  circles: 1, bolts: 0, cam: 2 },
  power:   { len: 120, chg: 78,  rings: 4, waves: 3, shock: 11, circles: 2, bolts: 0, cam: 3 },
  supreme: { len: 190, chg: 124, rings: 6, waves: 5, shock: 18, circles: 3, bolts: 6, cam: 5 },
};
const active = new Map();     // playerId -> {player, t, applied, change, h, cam, lock, cleanup}
const held = new Set();       // 7.x: sequências externas (ex.: evolução de 60 s do Lord Demônio, systems/lordevo.js) que também bloqueiam habilidades
export const holdCinematic = (id, on) => { if (on) held.add(id); else held.delete(id); };
export const isCinematic = (p) => { try { return active.has(p.id) || held.has(p.id); } catch { return false; } };
export const cinematicCount = () => active.size;
const cmd = (p, c) => { try { p.runCommand(c); return true; } catch { return false; } };
const ok = (p) => { try { return p.isValid; } catch { return false; } };

/** categoria pela etapa: Lord Demônio e Forma Verdadeira = supreme; nível >= 55 (ou forma dracônica) = power; resto = common */
export function tierOfStage(st, kind) {
  if (kind === "lord" || kind === "true") return "supreme";
  if (kind === "dragon") return "power";
  const lv = st?.minLevel ?? 0; return lv >= 80 ? "supreme" : lv >= 55 ? "power" : "common";
}
/** cores (2) por raça / linhagem para a sequência */
export function cineColors(player, kind) {
  let d; try { d = getData(player); } catch { d = {}; }
  const LIN = { veldora: ["bolt", "violet"], velzard: ["frost", "ice"], velgrynd: ["fire", "ember"], veldanava: ["gold", "light"] };
  if ((kind === "dragon" || kind === "true") && LIN[d.lineage]) return LIN[d.lineage];
  if (kind === "lord") return ["void", "blood"];
  const RACE = { slime: ["sage", "water"], demon: ["blood", "shadow"], vampire: ["blood", "violet"], dragonoid: ["fire", "gold"], lizardman: ["green", "water"], ogre: ["ember", "earth"], beastkin: ["wind", "earth"], elf: ["green", "wind"], angel: ["holy", "light"], human: ["light", "gold"], goblin: ["green", "toxic"] };
  return RACE[d.race] ?? ["arcane", "light"];
}

// ---------------------------------------------------------------- câmera
const solid = (b) => { try { return !!b && !b.isAir && !b.isLiquid; } catch { return false; } };
export function safeCam(dim, base, pos) {
  let p = { ...pos };
  for (let i = 0; i < 7; i++) {
    let a, b; try { a = dim.getBlock({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }); b = dim.getBlock({ x: Math.floor(p.x), y: Math.floor(p.y) + 1, z: Math.floor(p.z) }); } catch { break; }
    if (!solid(a) && !solid(b)) break;
    p = { x: base.x + (p.x - base.x) * 0.8, y: p.y + 0.25, z: base.z + (p.z - base.z) * 0.8 };   // aproxima do personagem e sobe até ficar livre
  }
  return p;
}
function camFrames(tier, len, chg) {
  const s = TIERS[tier], c = (t, ang, R, h, ease) => ({ t, ang, R, h, ease });
  if (s.cam === 2) return [c(0, 35, 4.2, 1.9, 0.4), c(chg, -10, 3.4, 1.8, chg / 20), c(len - 14, 0, 3.0, 1.7, 0.5)];
  if (s.cam === 3) return [c(0, 40, 4.8, 2.0, 0.4), c(Math.round(chg * 0.5), 130, 4.2, 2.4, chg * 0.5 / 20), c(chg, 200, 5.4, 2.8, chg * 0.5 / 20), c(len - 18, 0, 3.2, 1.7, 0.8)];
  return [c(0, 30, 5.2, 2.0, 0.4), c(Math.round(chg * 0.3), 120, 4.4, 2.2, chg * 0.3 / 20), c(Math.round(chg * 0.6), 210, 3.8, 2.6, chg * 0.3 / 20), c(chg - 4, 300, 3.2, 2.0, chg * 0.4 / 20),
    c(chg + 6, 360, 7.0, 3.8, 0.35), c(len - 24, 0, 3.4, 1.6, 1.3)];
}
export function setCam(S, f) {
  if (!S.camOn) return;
  const p = S.player, L = S.base0, a = (f.ang * Math.PI) / 180, dx = S.dir.x * Math.cos(a) - S.dir.z * Math.sin(a), dz = S.dir.x * Math.sin(a) + S.dir.z * Math.cos(a);
  const pos = safeCam(p.dimension, p.location, { x: L.x + dx * f.R, y: L.y + f.h, z: L.z + dz * f.R }), c = `${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`;
  if (!cmd(p, `camera @s set minecraft:free ease ${Math.max(0.05, f.ease).toFixed(2)} in_out_sine pos ${c} facing ${L.x.toFixed(2)} ${(L.y + 1.1).toFixed(2)} ${L.z.toFixed(2)}`)) S.camOn = false;
}

// ---------------------------------------------------------------- limpeza (sempre volta tudo)
function finish(S, why) {
  if (S.done) return; S.done = true;
  try { if (S.h !== undefined) system.clearRun(S.h); } catch { /* ignore */ }
  active.delete(S.id);
  if (!S.applied) { S.applied = true; try { S.change?.(); } catch (e) { console.warn(`[Etheria] cinemática change: ${e}`); } }   // a evolução NUNCA se perde
  const p = S.player;
  if (ok(p)) {
    if (S.cam) { cmd(p, "camera @s clear"); }
    if (S.lockPerm) cmd(p, "inputpermission set @s movement enabled");
    for (const e of S.fxAdded) { try { p.removeEffect(e); } catch { /* ignore */ } }
    try { p.removeTag(TAG); } catch { /* ignore */ }
    try { p.setProperty("etheria:tfx", "none"); } catch { /* ignore */ }
  }
  if (why && why !== "end") console.warn(`[Etheria] cinemática encerrada: ${why}`);
}
function addFx(S, id, ticks, amp) { try { S.player.addEffect(id, ticks, { amplifier: amp, showParticles: false }); S.fxAdded.push(id); } catch { /* ignore */ } }

/**
 * Toca a evolução. o = { kind: "evo"|"lord"|"dragon"|"true", tier?, col?, col2?, change: () => void }.
 * Devolve true se a cinemática assumiu (change será chamado no momento certo, uma vez); false = quem chamou deve aplicar a mudança na hora.
 */
export function playCinematic(player, o) {
  try {
    if (!CINEMATIC.enabled || !ok(player) || active.has(player.id) || held.has(player.id) || active.size >= MAX_ACTIVE) return false;
    let d; try { d = getData(player); } catch { d = {}; }
    if (d.settings?.cinematic === false) return false;
    const tier = o.tier ?? "common", sp = TIERS[tier] ?? TIERS.common, k = Math.max(0.5, Math.min(2, CINEMATIC.length ?? 1));
    const len = Math.round(sp.len * k), chg = Math.round(sp.chg * k), [c1, c2] = o.col ? [o.col, o.col2 ?? o.col] : cineColors(player, o.kind);
    let v = { x: 0, z: 1 }; try { const w = player.getViewDirection(); const l = Math.hypot(w.x, w.z) || 1; v = { x: w.x / l, z: w.z / l }; } catch { /* ignore */ }
    const S = { id: player.id, player, t: 0, applied: false, change: o.change, done: false, fxAdded: [], dir: v, base0: { ...player.location }, camOn: CINEMATIC.camera !== false, cam: false, lockPerm: false };
    active.set(player.id, S);
    try { player.addTag(TAG); } catch { /* ignore */ }
    // controle: bloqueia movimento só durante a sequência; plano B por efeitos
    S.lockPerm = cmd(player, "inputpermission set @s movement disabled");
    if (!S.lockPerm) { addFx(S, "slowness", len + 10, 5); addFx(S, "jump_boost", len + 10, 200); }
    addFx(S, "resistance", len + 20, 4);        // ser atingido não interrompe nem mata no meio da cena
    playTransform(player, o.kind, len * 50 + 300);
    const frames = S.camOn ? camFrames(tier, len, chg) : []; let fi = 0;
    const fxp = (p) => ctx(player, p);
    const mid = () => ({ x: player.location.x, y: player.location.y + 1, z: player.location.z }), feet = () => ({ x: player.location.x, y: player.location.y + 0.1, z: player.location.z });
    try { player.playSound("beacon.activate", { volume: 1, pitch: 0.7 }); } catch { /* ignore */ }
    if (S.camOn) S.cam = true;
    S.h = system.runInterval(() => {
      try {
        if (!ok(player) || S.done) { finish(S, "jogador inválido"); return; }
        const t = S.t; S.t += STEP;
        // posiciona o personagem imóvel (se o bloqueio nativo falhou, o plano B já o segura)
        while (fi < frames.length && frames[fi].t <= t) { setCam(S, frames[fi]); if (!S.camOn && S.cam) { S.cam = cmd(player, "camera @s set minecraft:third_person_front"); } fi++; }
        const i = Math.min(1, t / chg), f = S.lowfx ? 0.5 : 1;
        if (t === 0) {
          disc(fxp(1), feet(), { col: c1, circle: CIRCLE.evolve, size: 2 + sp.circles * 1.2, life: chg / 20 });
          ringFlat(fxp(1), feet(), { col: c1, n: 18, radius: 3, life: 0.8, tile: T.ring });
        }
        if (t < chg) {
          if (t % 4 === 0) implode(fxp(1), mid(), { col: i > 0.6 ? c2 : c1, n: Math.round((4 + i * 8) * f), radius: 3.6 - i * 2.4, life: 0.5 });
          if (t % 8 === 0) ringFlat(fxp(1), feet(), { col: c1, n: 16, radius: 4.2 - 3.2 * i, life: 0.6, tile: T.ring });
          if (t % 6 === 0) column(fxp(1), feet(), { col: c2, n: Math.round((3 + i * 5) * f), h: 2 + i * (3 + sp.rings), r: 0.5 });
          if (sp.circles > 1 && t === Math.round(chg * 0.4)) disc(fxp(1), { ...feet(), y: feet().y + 0.05 }, { col: c2, circle: CIRCLE.arcane, size: 3.4 + sp.circles, life: (chg - t) / 20 });
          if (sp.circles > 2 && t === Math.round(chg * 0.7)) disc(fxp(1), { ...feet(), y: feet().y + 0.08 }, { col: c1, circle: CIRCLE.holy, size: 6, life: (chg - t) / 20 });
          if (sp.bolts && t > chg * 0.5 && t % 12 === 0) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 3, p0 = feet(); bolt(fxp(1), { x: p0.x + Math.cos(a) * r, y: p0.y + 12, z: p0.z + Math.sin(a) * r }, { x: p0.x + Math.cos(a) * r, y: p0.y, z: p0.z + Math.sin(a) * r }, { col: c2, w: 0.3, jitter: 1 }); }
          if (t % 20 === 0) { try { player.playSound("random.orb", { volume: 0.8, pitch: 0.7 + i * 0.9 }); } catch { /* ignore */ } }
        }
        if (!S.applied && t >= chg) {                       // ---- O MOMENTO DA TRANSFORMAÇÃO: flash, troca de forma, explosão e onda de choque
          S.applied = true;
          cmd(player, "camera @s fade time 0.05 0.12 0.5 color 255 255 255");
          try { S.change?.(); } catch (e) { console.warn(`[Etheria] cinemática change: ${e}`); }
          const c = fxp(1.4), at = feet();
          burst(c, mid(), { col: c2, n: Math.round(28 * f), spd: 3.2, up: 2 }); burst(c, mid(), { col: "white", n: Math.round(16 * f), spd: 1.6, up: 1 });
          for (let w = 0; w < sp.waves; w++) system.runTimeout(() => { if (ok(player)) ringFlat(fxp(1.2), feet(), { col: w % 2 ? c2 : c1, n: 30, radius: 3 + (sp.shock - 3) * (w + 1) / sp.waves, life: 0.7, tile: T.ring }); }, w * 4);
          column(c, at, { col: c2, n: 16, h: 6 + sp.rings * 1.5, r: 0.8 });
          try { player.playSound("random.explode", { volume: 1, pitch: 0.8 }); player.playSound(tier === "supreme" ? "mob.enderdragon.growl" : "random.levelup", { volume: 1, pitch: tier === "supreme" ? 0.7 : 1 }); } catch { /* ignore */ }
          if (tier === "supreme") try { player.playSound("ambient.weather.thunder", { volume: 0.8, pitch: 0.9 }); } catch { /* ignore */ }
        } else if (S.applied && t > chg && t % 8 === 0 && t < len - 10) {   // aura residual enquanto o personagem faz a pose
          burst(fxp(1), mid(), { col: c1, n: Math.round(5 * f), spd: 0.8, up: 1.2 }); ringFlat(fxp(1), feet(), { col: c2, n: 12, radius: 1.8, life: 0.7 });
        }
        if (t >= len) finish(S, "end");
      } catch (e) { console.warn(`[Etheria] cinemática: ${e}`); finish(S, "erro"); }
    }, STEP);
    system.runTimeout(() => finish(S, "tempo limite"), len + 60);   // rede de segurança: câmera e controle nunca ficam presos
    return true;
  } catch (e) { console.warn(`[Etheria] playCinematic: ${e}`); const S = active.get(player?.id); if (S) finish(S, "erro ao iniciar"); return false; }
}

export function startCinematic() {
  world.afterEvents.entityDie.subscribe((ev) => { try { const S = active.get(ev.deadEntity?.id); if (S) finish(S, "morte"); } catch { /* ignore */ } });
  world.beforeEvents.playerLeave.subscribe((ev) => { try { const S = active.get(ev.player?.id); if (S) system.run(() => finish(S, "saída")); } catch { /* ignore */ } });
  world.afterEvents.playerSpawn.subscribe((ev) => {      // restos de uma sessão interrompida (queda do jogo): devolve câmera e controle
    try { const p = ev.player; if (p.hasTag(TAG) && !active.has(p.id)) { cmd(p, "camera @s clear"); cmd(p, "inputpermission set @s movement enabled"); p.removeTag(TAG); } } catch { /* ignore */ }
  });
}

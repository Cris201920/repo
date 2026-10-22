// systems/lordevo.js - EVOLUÇÃO PARA LORD DEMÔNIO EM 1 MINUTO (pedido do jogador), no estilo das cenas do Grande Sábio / Voz do Mundo.
// Fases (ticks; 20 ticks = 1 s):
//   0-200    (0-10 s)  AVISO: Festival da Colheita (Voz do Mundo), a aura escurece, círculo do vazio no chão, tela escurece em pulsos
//   200-600  (10-30 s) FRAGMENTOS: fragmentos de alma e relâmpagos SUBINDO do chão, anéis em espiral, círculo arcano
//   600-1000 (30-50 s) CORPO: tremor de câmera crescente, partículas densas no corpo, implosões; a raça antiga se desfaz
//   1000-1200 (50-60 s) RENASCIMENTO: clarão branco, a forma nova entra (change), explosão + ondas de choque, etheria:tfx = "lord" até o fim
// Segurança: o jogador fica imóvel (inputpermission; plano B por efeitos) e invulnerável (Resistência V + vida cheia a cada segundo + volta à âncora
// se for empurrado). Tudo é liberado ao terminar, ao morrer, ao sair ou ao mudar de dimensão. A evolução NUNCA se perde: `change` é chamado uma única
// vez (no renascimento, ou na interrupção). Se o jogo cair no meio, race.js conclui a evolução pendente quando o jogador volta (d.lordEvo).
// Só usa sons que o projeto já usa (vanilla + cerimônias do Sábio já existentes). Reentrada: um jogador só tem UMA sequência (Map por id).
import { world, system } from "@minecraft/server";
import { ctx, burst, implode, ringFlat, column, disc, bolt, helix, CIRCLE, T } from "./fxlib.js";
import { holdCinematic, setCam } from "./cinematic.js";
import { playTransform } from "./raceparts.js";
import { sageText } from "./voice.js";
import { announceCeremony, sceneOn } from "./sageannounce.js";
import { addHudOverride } from "./hudhooks.js";
import { getData } from "../core/db.js";
import { CINEMATIC } from "../config.js";

export const LORD_EVO = { len: 1200, step: 2, p1: 200, p2: 600, p3: 1000 };
const TAG = "etheria_lordevo", C1 = "void", C2 = "blood";
const runs = new Map();   // playerId -> estado
export const lordEvolving = (p) => { try { return runs.has(p.id); } catch { return false; } };
export const lordRuns = () => runs.size;
const ok = (p) => { try { return p.isValid; } catch { return false; } };
const cmd = (p, c) => { try { p.runCommand(c); return true; } catch { return false; } };
const snd = (p, id, v = 1, pi = 1) => { try { p.playSound(id, { volume: v, pitch: pi }); } catch { /* ignore */ } };

// falas por fase: texto do Sábio (fila com prioridade; se a Voz do Mundo estiver na tela, tenta de novo) + linha no chat (sempre aparece)
export const LORD_LINES = [
  [0, "Aviso. Condições para o despertar como Lorde Demônio confirmadas. Iniciando o Festival da Colheita."],
  [200, "Processo evolutivo iniciado. Fragmentando o corpo espiritual..."],
  [400, "Absorvendo as almas oferecidas. Progresso: 50%."],
  [600, "Reconstrução do corpo físico em andamento. Não interrompa o processo."],
  [800, "Energia mágica excedente detectada. Estabilizando o núcleo..."],
  [1000, "Evolução concluída. Renascimento como Lorde Demônio confirmado."],
];
function speak(S, i, txt, tries = 0) {
  const p = S.player; if (!ok(p) || S.done) return;
  let shown = false; try { shown = sageText(p, txt, { pri: 1, cd: 0, key: `sage.evo_lord${i}` }); } catch { /* ignore */ }
  if (!shown && tries < 4) system.runTimeout(() => speak(S, i, txt, tries + 1), 30);
}
function chat(p, txt) { try { p.sendMessage(`§5§l[Voz do Mundo] §r§d${txt}`); } catch { /* ignore */ } }
function near(S, r = 32) { try { return S.player.dimension.getPlayers({ location: S.player.location, maxDistance: r }).filter((q) => q.id !== S.player.id); } catch { return []; } }

function lock(S) {
  const p = S.player;
  S.lockPerm = cmd(p, "inputpermission set @s movement disabled");
  if (!S.lockPerm) S.fallback = true;
  guard(S);
}
/** mantém imóvel e invulnerável (chamado a cada 20 ticks e no início) */
function guard(S) {
  const p = S.player;
  try { p.addEffect("resistance", 60, { amplifier: 4, showParticles: false }); } catch { /* ignore */ }     // Resistência V = 100% de redução
  try { p.addEffect("fire_resistance", 60, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
  try { p.addEffect("slow_falling", 60, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
  if (S.fallback) { try { p.addEffect("slowness", 60, { amplifier: 6, showParticles: false }); p.addEffect("jump_boost", 60, { amplifier: 200, showParticles: false }); } catch { /* ignore */ } }
  try { const h = p.getComponent("minecraft:health"); if (h && h.currentValue < h.effectiveMax) h.setCurrentValue(h.effectiveMax); } catch { /* ignore */ }
  try { p.extinguishFire?.(); } catch { /* ignore */ }
}
function anchor(S) {
  const p = S.player, L = p.location, A = S.base;
  if (Math.hypot(L.x - A.x, L.z - A.z) > 1.2 || Math.abs(L.y - A.y) > 2.5) { try { p.teleport(A, { keepVelocity: false }); } catch { /* ignore */ } }
}

function release(S, why) {
  if (S.done) return; S.done = true;
  try { system.clearRun(S.h); } catch { /* ignore */ }
  try { system.clearRun(S.safety); } catch { /* ignore */ }
  runs.delete(S.id); holdCinematic(S.id, false);
  if (!S.applied) { S.applied = true; try { S.change?.(); } catch (e) { console.warn(`[Etheria] Lord Demônio change: ${e}`); } }   // a evolução nunca se perde
  const p = S.player;
  if (ok(p)) {
    if (S.cam) cmd(p, "camera @s clear");
    if (S.lockPerm) cmd(p, "inputpermission set @s movement enabled");
    for (const e of ["slowness", "jump_boost", "darkness", "slow_falling"]) { try { p.removeEffect(e); } catch { /* ignore */ } }
    try { p.addEffect("resistance", 60, { amplifier: 4, showParticles: false }); } catch { /* ignore */ }   // 3 s de folga ao voltar
    try { p.removeTag(TAG); } catch { /* ignore */ }
    try { p.setProperty("etheria:tfx", "none"); } catch { /* ignore */ }
  }
  if (why && why !== "end") console.warn(`[Etheria] evolução do Lord Demônio encerrada: ${why}`);
}

// ---------------------------------------------------------------- câmera: órbita lenta que se aproxima; afasta no renascimento
const CAM = [[0, 30, 6.0, 2.6, 0.5], [200, 110, 5.2, 2.4, 9], [400, 200, 4.6, 2.2, 9], [600, 280, 3.8, 2.0, 9], [800, 350, 3.2, 1.9, 9], [996, 360, 3.0, 1.8, 0.2], [1004, 380, 8.0, 4.2, 0.5], [1100, 420, 5.5, 2.4, 4]];

function frame(S) {
  const p = S.player, t = S.t, f = S.low ? 0.5 : 1, fx = (k = 1) => ctx(p, k);
  const L = p.location, mid = { x: L.x, y: L.y + 1, z: L.z }, feet = { x: L.x, y: L.y + 0.1, z: L.z };
  while (S.ci < CAM.length && CAM[S.ci][0] <= t) { const [, ang, R, h, ease] = CAM[S.ci]; if (S.cam) setCam(S, { ang, R, h, ease }); S.ci++; }
  for (const [at, txt] of LORD_LINES) if (t === at) { const i = LORD_LINES.findIndex((x) => x[0] === at); if (at > 0 || !sceneOn(p)) speak(S, i, txt); chat(p, txt); }
  if (t % 20 === 0) { guard(S); anchor(S); }
  // ---------------- fase 1: aviso e aura escurecendo
  if (t === 0) {
    disc(fx(), feet, { col: C1, circle: CIRCLE.void, size: 4.5, life: LORD_EVO.p1 / 20 });
    try { p.addEffect("darkness", LORD_EVO.p1 + 40, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
    snd(p, "beacon.activate", 1, 0.5); snd(p, "mob.wither.ambient", 0.6, 0.6);
    try { if (sceneOn(p)) announceCeremony(p, "harvest_festival"); } catch { /* ignore */ }   // áudio já existente da Voz do Mundo
    for (const q of near(S, 48)) { try { q.sendMessage(`§5§l[Voz do Mundo] §r§d${p.name}§7 iniciou a evolução para §5§lLorde Demônio§r§7...`); } catch { /* ignore */ } }
  }
  if (t < LORD_EVO.p1) {
    const k = t / LORD_EVO.p1;
    if (t % 6 === 0) implode(fx(), mid, { col: C1, tile: T.smoke, n: Math.round((5 + k * 8) * f), radius: 4.2 - k * 2, life: 0.6 });
    if (t % 20 === 0) ringFlat(fx(), feet, { col: C1, n: 18, radius: 4 - k * 2, life: 0.8, tile: T.ring });
    if (t % 60 === 30) cmd(p, "camera @s fade time 0.3 0.4 0.5 color 0 0 0");          // tela escurece em pulsos
    if (t % 40 === 0) snd(p, "random.orb", 0.6, 0.5 + k * 0.3);
  }
  // ---------------- fase 2: fragmentos e relâmpagos subindo
  if (t === LORD_EVO.p1) { cmd(p, "camera @s fade time 0.2 0.6 0.8 color 20 0 30"); disc(fx(), { ...feet, y: feet.y + 0.05 }, { col: C2, circle: CIRCLE.arcane, size: 6, life: (LORD_EVO.p2 - t) / 20 }); snd(p, "ambient.weather.thunder", 0.7, 1.2); }
  if (t >= LORD_EVO.p1 && t < LORD_EVO.p2) {
    const k = (t - LORD_EVO.p1) / (LORD_EVO.p2 - LORD_EVO.p1);
    if (t % 4 === 0) column(fx(), feet, { col: t % 8 ? C2 : C1, tile: T.shard, n: Math.round((4 + k * 6) * f), h: 3 + k * 6, r: 1.6 - k * 0.6 });
    if (t % 16 === 0) { const a = Math.random() * 6.283, r = 2 + Math.random() * 2.5; bolt(fx(), { x: L.x + Math.cos(a) * r, y: L.y, z: L.z + Math.sin(a) * r }, { x: L.x + Math.cos(a) * r * 0.4, y: L.y + 9 + k * 6, z: L.z + Math.sin(a) * r * 0.4 }, { col: C2, w: 0.3, jitter: 1 }); }
    if (t % 24 === 0) ringFlat(fx(), { ...feet, y: feet.y + k * 4 }, { col: C1, n: 20, radius: 2.4, life: 0.7, tile: T.ring });
    if (t % 50 === 0) snd(p, "ambient.weather.lightning.impact", 0.5, 1.3);
  }
  // ---------------- fase 3: corpo se transformando (tremor + partículas densas)
  if (t === LORD_EVO.p2) { cmd(p, "camera @s fade time 0.3 0.8 0.8 color 0 0 0"); playTransform(p, "evo", 3300); snd(p, "mob.warden.sonic_charge", 0.8, 0.7); }
  if (t >= LORD_EVO.p2 && t < LORD_EVO.p3) {
    const k = (t - LORD_EVO.p2) / (LORD_EVO.p3 - LORD_EVO.p2);
    if (t % 40 === 0) cmd(p, `camerashake add @s ${(0.08 + k * 0.4).toFixed(2)} 2.1 positional`);
    if (t % 4 === 0) burst(fx(), mid, { col: t % 8 ? C1 : C2, tile: T.ember, n: Math.round((6 + k * 10) * f), spd: 0.9 + k, up: 1 });
    if (t % 6 === 0) implode(fx(), mid, { col: C2, tile: T.spark, n: Math.round((6 + k * 8) * f), radius: 2.6, life: 0.5 });
    if (t % 30 === 0) helix(fx(), L, { col: C1, tile: T.ring, steps: 18, turns: 2, r: 1.2, h: 2.4, dur: 14, size: 0.12, life: 0.6 });
    if (t === 800) playTransform(p, "evo", 3300);
    if (t % 40 === 20) snd(p, "mob.wither.ambient", 0.4 + k * 0.5, 0.5 + k * 0.4);
  }
  // ---------------- fase 4: explosão final e renascimento
  if (!S.applied && t >= LORD_EVO.p3) {
    S.applied = true;
    cmd(p, "camera @s fade time 0.05 0.25 0.9 color 255 255 255");
    try { S.change?.(); } catch (e) { console.warn(`[Etheria] Lord Demônio change: ${e}`); }
    playTransform(p, "lord", 3300); S.tfxAt = t;
    const c = fx(1.4);
    burst(c, mid, { col: C2, n: Math.round(40 * f), spd: 4, up: 2 }); burst(c, mid, { col: "white", n: Math.round(20 * f), spd: 2, up: 1 });
    for (let w = 0; w < 5; w++) system.runTimeout(() => { if (ok(p) && !S.done) ringFlat(ctx(p, 1.2), { x: p.location.x, y: p.location.y + 0.1, z: p.location.z }, { col: w % 2 ? C2 : C1, n: 32, radius: 3 + w * 3.2, life: 0.7, tile: T.ring }); }, w * 4);
    column(c, feet, { col: C2, n: 24, h: 16, r: 1 });
    snd(p, "random.explode", 1, 0.7); snd(p, "mob.enderdragon.growl", 1, 0.6); snd(p, "ambient.weather.thunder", 1, 0.8);
    cmd(p, "camerashake add @s 0.7 1.2 positional");
    try { for (const q of world.getAllPlayers()) q.sendMessage(`§5§l[Voz do Mundo] §r§fConfirmado: §d${p.name}§f despertou como §5§lLorde Demônio§r§f.`); } catch { /* ignore */ }
  } else if (S.applied && t > LORD_EVO.p3) {
    if (t - S.tfxAt >= 66 && t < LORD_EVO.len - 10) { playTransform(p, "lord", 3300); S.tfxAt = t; }   // a animação "lord" cobre a fase final inteira
    if (t % 8 === 0) { burst(fx(), mid, { col: C1, n: Math.round(6 * f), spd: 0.8, up: 1.2 }); ringFlat(fx(), feet, { col: C2, n: 12, radius: 1.8, life: 0.7 }); }
  }
}

/**
 * Inicia a sequência de 60 s. o = { change: () => void }. Devolve false se o jogador já está evoluindo (reentrada) ou é inválido.
 * `change` é chamado exatamente uma vez (renascimento aos 50 s ou na interrupção).
 */
export function startLordEvolution(player, o = {}) {
  if (!ok(player) || runs.has(player.id)) return false;
  let d; try { d = getData(player); } catch { d = {}; }
  let v = { x: 0, z: 1 }; try { const w = player.getViewDirection(); const l = Math.hypot(w.x, w.z) || 1; v = { x: w.x / l, z: w.z / l }; } catch { /* ignore */ }
  const S = { id: player.id, player, t: 0, ci: 0, applied: false, done: false, change: o.change, dim: player.dimension?.id, base: { ...player.location }, base0: { ...player.location }, dir: v,
    camOn: CINEMATIC.camera !== false && d.settings?.cinematic !== false, cam: false, low: ["low", "off"].includes(d.settings?.fx), tfxAt: 0 };
  runs.set(S.id, S); holdCinematic(S.id, true);
  try { player.addTag(TAG); } catch { /* ignore */ }
  S.cam = S.camOn;
  lock(S);
  S.h = system.runInterval(() => {
    try {
      if (S.done) return;
      if (!ok(player)) return release(S, "jogador inválido");
      if (player.dimension?.id !== S.dim) return release(S, "mudou de dimensão");
      frame(S); S.t += LORD_EVO.step;
      if (S.t > LORD_EVO.len) release(S, "end");
    } catch (e) { console.warn(`[Etheria] evolução do Lord Demônio: ${e}`); release(S, "erro"); }
  }, LORD_EVO.step);
  S.safety = system.runTimeout(() => release(S, "tempo limite"), LORD_EVO.len + 100);   // rede de segurança
  return true;
}
/** interrompe (morte, saída, comando) — a evolução é aplicada mesmo assim */
export function stopLordEvolution(id, why = "interrompida") { const S = runs.get(id); if (S) release(S, why); }
/** progresso (0-1) para a HUD e testes */
export function lordProgress(p) { const S = runs.get(p?.id); return S ? Math.min(1, S.t / LORD_EVO.len) : -1; }

export function startLordEvo() {
  try { world.afterEvents.entityDie.subscribe((ev) => { try { stopLordEvolution(ev.deadEntity?.id, "morte"); } catch { /* ignore */ } }); } catch { /* ignore */ }
  try { world.beforeEvents.playerLeave.subscribe((ev) => { const id = ev.player?.id; system.run(() => stopLordEvolution(id, "saída")); }); } catch { /* ignore */ }
  try { world.afterEvents.playerDimensionChange.subscribe((ev) => { try { stopLordEvolution(ev.player?.id, "mudou de dimensão"); } catch { /* ignore */ } }); } catch { /* ignore */ }
  try {
    world.afterEvents.playerSpawn.subscribe((ev) => {   // restos de uma sessão interrompida: devolve câmera e controle
      try { const p = ev.player; if (p.hasTag(TAG) && !runs.has(p.id)) { cmd(p, "camera @s clear"); cmd(p, "inputpermission set @s movement enabled"); p.removeTag(TAG); } } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
  addHudOverride((p) => {
    const k = lordProgress(p); if (k < 0) return null;
    const n = Math.round(k * 20), left = Math.max(0, Math.ceil((1 - k) * LORD_EVO.len / 20));
    const ph = k < 1 / 6 ? "Aviso" : k < 0.5 ? "Fragmentação" : k < 5 / 6 ? "Reconstrução" : "Renascimento";
    return `§5§lLORD DEMÔNIO §r§d${ph}\n§5${"|".repeat(n)}§8${"|".repeat(20 - n)} §f${left}s`;
  });
}

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
import { announcing, sceneOn } from "./sageannounce.js";
import { addHudOverride } from "./hudhooks.js";
import { getData } from "../core/db.js";
import { CINEMATIC } from "../config.js";

export const LORD_EVO = { len: 1800, step: 2, p1: 140, p2: 140, p3: 140 };   // 7 s de almas no mundo + cerimônia de tela cheia (~50 s) até acabar; len = limite de segurança
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
  [60, "Absorvendo as almas oferecidas."],
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
    if (why === "end") { cmd(p, "camera @s fade time 0.05 0.25 0.9 color 255 255 255"); snd(p, "random.explode", 0.8, 0.8); }
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
const CAM = [[0, 30, 6.0, 2.6, 0.5], [60, 110, 4.6, 2.2, 6], [130, 170, 3.2, 1.9, 4]];

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
    for (const q of near(S, 48)) { try { q.sendMessage(`§5§l[Voz do Mundo] §r§d${p.name}§7 iniciou a evolução para §5§lLorde Demônio§r§7...`); } catch { /* ignore */ } }
  }
  if (t < LORD_EVO.p1) {
    const k = t / LORD_EVO.p1;
    if (t % 6 === 0) implode(fx(), mid, { col: C1, tile: T.smoke, n: Math.round((5 + k * 8) * f), radius: 4.2 - k * 2, life: 0.6 });
    if (t % 20 === 0) ringFlat(fx(), feet, { col: C1, n: 18, radius: 4 - k * 2, life: 0.8, tile: T.ring });
    if (t % 60 === 30) cmd(p, "camera @s fade time 0.3 0.4 0.5 color 0 0 0");          // tela escurece em pulsos
    if (t % 40 === 0) snd(p, "random.orb", 0.6, 0.5 + k * 0.3);
    // almas negras de chama rosa girando e subindo ao redor do corpo (cena do vídeo)
    if (t % 2 === 0) {
      const a = t * 0.22, r = 2.6 - k * 0.8;
      for (let i = 0; i < 3; i++) { const b = a + i * 2.094, q = { x: L.x + Math.cos(b) * r, y: L.y + 0.6 + ((t * 0.03 + i * 0.7) % 2.2), z: L.z + Math.sin(b) * r };
        burst(fx(), q, { col: "pink", tile: T.flame, n: Math.max(1, Math.round(2 * f)), spd: 0.15, up: 0.4 }); implode(fx(), q, { col: C1, tile: T.smoke, n: Math.max(1, Math.round(2 * f)), radius: 0.7, life: 0.4 }); }
    }
  }
  // ---------------- despertar: a evolução é aplicada e a cerimônia de tela cheia assume (Festival da Colheita → Verdadeiro Lorde Demônio → nome → habilidades)
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
    if (t > LORD_EVO.p3 + 120 && !announcing(p)) return release(S, "end");   // a cerimônia acabou: devolve o controle
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
    const n = Math.round(k * 20), left = Math.max(0, Math.ceil((LORD_EVO.len / 20) * (1 - k)));
    const ph = k < LORD_EVO.p1 / LORD_EVO.len ? "Absorção das almas" : "Despertar";
    return `§5§lLORD DEMÔNIO §r§d${ph}\n§5${"|".repeat(n)}§8${"|".repeat(20 - n)} §f${left}s`;
  });
}

// systems/flight.js - VOO LIVRE (habilidade passiva "free_flight").
// HONESTIDADE TÉCNICA: @minecraft/server 1.17.0 NÃO expõe o voo nativo do modo Criativo (não há como ligar "mayfly"/isFlying em um jogador
// de sobrevivência). Este voo é, portanto, um CONTROLADOR POR SCRIPT usando só APIs estáveis (isJumping, isSneaking, isOnGround, getVelocity,
// addEffect/removeEffect). Não é o voo criativo nativo:
//   - decolar: SEGURAR "pular" ~0,4 s, ou tocar pular 2x no ar; subir: segurar pular, ou olhar para cima andando (6.58);
//   - descer: AGACHAR (shift / botão de agachar no celular) -> solta a levitação, mantém queda lenta controlada;
//   - pairar: sem tocar em subir/descer, um controlador mantém a velocidade vertical perto de 0 (oscila alguns centímetros);
//   - horizontal: movimentos normais do jogo (WASD / joystick), com bônus de velocidade opcional;
//   - pousar: encostar no chão sem pular desliga o voo; a queda lenta (slow_falling) evita dano de queda.
// Estado: d.flight = { on } é salvo com o jogador (sobrevive a morte, relog, troca de dimensão). O estado "no ar" é só de sessão e é limpo ao morrer/sair.
import { world, system } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { FLIGHT } from "../config.js";
import { SKILLS } from "../data/skills.js";
import { hasSkill, grantSkill } from "./skills.js";
import { say } from "../core/utils.js";
import { RACES } from "../data/races.js";
import { formOfPlayer } from "../data/lineages.js";
import { wingedStage } from "./raceparts.js";
import { takeoffFx, iceWingFx, iceWings } from "./flightfx.js";

const st = new Map();   // playerId -> { air, held, ground, vx, vz, taps, lastJump, mode }
export const flightOn = (d) => d.flight?.on !== false;                  // padrão: ligada ao desbloquear
export const flightUnlocked = (d) => hasSkill(d, FLIGHT.skill);
export const isFlying = (p) => !!st.get(p.id)?.air;
export const dropFlight = (id) => { st.delete(id); };

const eff = (p, id, ticks, amp = 0) => { try { p.addEffect(id, ticks, { amplifier: amp, showParticles: false }); } catch { /* ignore */ } };
const unEff = (p, id) => { try { p.removeEffect(id); } catch { /* ignore */ } };
// 6.58: estado visual do voo para as asas/caudas (RP): 0 chão · 1 pairando · 2 subindo/decolando · 3 planando/voo rápido · 4 descendo
const FLY_PROP = "etheria:fly";
function setMode(p, s, m) { if (s.mode === m) return; s.mode = m; try { p.setProperty(FLY_PROP, m); } catch { /* ignore */ } }

/** liga/desliga a habilidade (menu e !voo). Desligar em pleno ar é seguro: queda lenta por safeTicks. */
export function setFlightOn(player, on) {
  const d = getData(player);
  if (!flightUnlocked(d)) return { ok: false, msg: "Voo Livre ainda está bloqueado." };
  d.flight = { ...(d.flight ?? {}), on: !!on }; markDirty(player);
  if (!on) land(player, true);
  return { ok: true, msg: on ? "§bVoo Livre ativado. §7Segure pular (ou toque 2x) para decolar." : "§7Voo Livre desativado. Você desce em segurança." };
}
export const toggleFlight = (player) => setFlightOn(player, !flightOn(getData(player)));

function land(p, safe) {
  const s = st.get(p.id); if (s) { s.air = false; s.held = 0; s.ground = 0; setMode(p, s, 0); }
  unEff(p, "levitation");
  if (safe) eff(p, "slow_falling", FLIGHT.safeTicks, 0);
}

function inactiveGameMode(p) { try { const g = p.getGameMode?.(); return g === "creative" || g === "spectator" || g === "Creative" || g === "Spectator"; } catch { return false; } }

/** 6.58: VOO REFEITO. Causas do voo "bugado" encontradas no controlador antigo:
 *   (1) velocidade horizontal: o efeito "speed" não age no ar -> voava quase parado;  (2) pairar com pulsos de levitação de 3 ticks -> sobe/desce
 *   tremendo;  (3) pouso: 4 ticks encostando no chão já encerrava o voo;  (4) celular: agachar é alternado -> ficava descendo sem querer.
 * Agora: a velocidade é ESCRITA a cada tick (applyKnockback = definir movimento). A direção vem da ENTRADA REAL do jogador, medida pela diferença
 * entre a velocidade de agora e a que o controlador deixou no tick anterior (o que sobra é o teclado/joystick); sem entrada, desacelera suave.
 * Vertical: pular sobe, agachar desce, e OLHAR para cima/baixo enquanto se move sobe/desce (controle confortável no celular). Pairar = vy 0. */
export function stepFlight(p) {
  const d = getData(p);
  let s = st.get(p.id); if (!s) { s = { air: false, held: 0, ground: 0, vx: 0, vz: 0, taps: 0, lastJump: false, tapAt: -99, t: 0, mode: -1 }; st.set(p.id, s); }
  s.t++;
  if (!flightUnlocked(d) || !flightOn(d) || inactiveGameMode(p)) { if (s.air) land(p, true); else setMode(p, s, 0); return; }
  if (p.isGliding || p.isInWater || p.isClimbing) { if (s.air) land(p, true); s.held = 0; return; }
  let jump = false, sneak = false, ground = false, sprint = false;
  try { jump = !!p.isJumping; sneak = !!p.isSneaking; ground = !!p.isOnGround; sprint = !!p.isSprinting; } catch { /* ignore */ }
  const step = FLIGHT.tick;
  // decolar: segurar pular ~0,4 s, ou tocar pular 2x no ar (como no criativo)
  const edge = jump && !s.lastJump; s.lastJump = jump;
  if (edge) { if (!ground && s.t - s.tapAt <= 7 / step) s.taps = 2; else s.taps = 1; s.tapAt = s.t; }
  s.held = jump ? s.held + step : Math.max(0, s.held - step * 2);
  if (!s.air) {
    if (s.held >= FLIGHT.holdJump || s.taps >= 2) { s.air = true; s.ground = 0; s.taps = 0; s.lift = 6; s.sneakArm = !sneak; s.sneakT = 0; s.vx = 0; s.vz = 0; eff(p, "slow_falling", FLIGHT.safeTicks, 0); unEff(p, "levitation"); takeoffFx(p); }
    else { setMode(p, s, 0); return; }
  }
  if (FLIGHT.staminaPerSec > 0) {
    const cost = FLIGHT.staminaPerSec * step / 20;
    if ((d.stamina ?? 0) < cost) { land(p, true); say(p, "§7[Voo] sem energia: pouso controlado."); return; }
    d.stamina -= cost;
  }
  let v = { x: 0, y: 0, z: 0 }; try { v = p.getVelocity(); } catch { /* ignore */ }
  let pitch = 0; try { pitch = p.getRotation().x; } catch { /* ignore */ }   // + olhando para baixo
  // entrada horizontal = velocidade atual - o que restaria do tick anterior pelo arrasto do ar
  const DRAG = Math.pow(0.91, step);
  let ix = v.x - s.vx * DRAG, iz = v.z - s.vz * DRAG; const il = Math.hypot(ix, iz);
  const moving = il > FLIGHT.inputMin;
  const cap = sprint ? FLIGHT.sprintSpeed : FLIGHT.speed;
  let hx = s.vx * FLIGHT.brake, hz = s.vz * FLIGHT.brake;                  // sem entrada: freia suave (não para de golpe)
  if (moving) { const k = FLIGHT.accel; hx = s.vx + (ix / il) * cap * k; hz = s.vz + (iz / il) * cap * k; }
  const hl = Math.hypot(hx, hz); if (hl > cap) { hx *= cap / hl; hz *= cap / hl; }
  if (hl < 0.004) { hx = 0; hz = 0; }
  // 6.58b: agachar no CELULAR é alternado (fica ligado). Só conta como "descer" se foi apertado DEPOIS de decolar e por até
  // FLIGHT.sneakMax ticks seguidos; para descer mais, solte e aperte de novo. Agachado ao decolar = ignorado até soltar.
  if (!sneak) { s.sneakArm = true; s.sneakT = 0; } else if (s.sneakArm) s.sneakT += step;
  const sneakDown = sneak && s.sneakArm && s.sneakT <= FLIGHT.sneakMax;
  // vertical
  let vy = FLIGHT.hoverLift;                                               // pairar: compensa a gravidade da queda lenta
  if (s.lift > 0) { s.lift--; vy = FLIGHT.rise * 1.3; }                    // impulso de decolagem
  else if (jump) vy = FLIGHT.rise;
  else if (sneakDown) vy = -FLIGHT.rise;
  else if (moving && Math.abs(pitch) > 30) vy = Math.max(-FLIGHT.rise, Math.min(FLIGHT.rise, -Math.sin(pitch * Math.PI / 180) * Math.hypot(hx, hz) * 1.2));
  // pouso: só ao encostar no chão DESCENDO (ou parado sem subir) por ~0,4 s; voar rente ao chão em movimento não pousa
  if (ground && vy <= FLIGHT.hoverLift && !jump && (sneakDown || Math.hypot(hx, hz) < 0.08)) { s.ground += step; if (s.ground >= FLIGHT.landTicks || sneakDown) { land(p, true); return; } } else s.ground = 0;
  eff(p, "slow_falling", 30, 0);                                          // nunca há dano de queda enquanto voa
  const hs = Math.hypot(hx, hz);
  try { p.applyKnockback(hs > 0 ? hx / hs : 0, hs > 0 ? hz / hs : 0, hs, vy); s.vx = hx; s.vz = hz; }
  catch {   // reserva (API indisponível): controle antigo por levitação
    s.vx = v.x; s.vz = v.z;
    if (vy > 0.05) eff(p, "levitation", 6, FLIGHT.riseAmp); else if (vy < -0.05) unEff(p, "levitation"); else if (v.y < -FLIGHT.hoverBand) eff(p, "levitation", 3, 0); else unEff(p, "levitation");
  }
  setMode(p, s, s.lift > 0 || vy > 0.12 ? 2 : vy < -0.12 ? 4 : hs > cap * 0.55 ? 3 : 1);
  if (s.t % 2 === 0 && iceWings(d)) iceWingFx(p, s.mode, s.t);   // 6.58b: asas de cristal de gelo (Velzard)
}

/** concede a habilidade por progressão (retroativo para quem já está no estágio). Nunca concede a quem não cumpre. */
export function flightEligible(d) {
  try {
    if (d.raceChosen && FLIGHT.stages.includes(d.raceStage)) return true;
    if (d.raceChosen && wingedStage(d.raceStage)) return true;                         // 6.48: toda raça com asas no corpo voa
    if (FLIGHT.trueDragonForm && ["true", "draconic"].includes(formOfPlayer(d))) return true;
  } catch { /* ignore */ }
  return false;
}
export function flightProgress(p) {
  const d = getData(p); if (flightUnlocked(d) || !flightEligible(d)) return false;
  grantSkill(p, FLIGHT.skill, { noEquip: true });
  say(p, "§b§l[Voo Livre] §r§7Seu poder permite voar! Ative/desative em §fHabilidades > Passivas§7 (ou §f!voo§7). Segure §fpular§7 para decolar; §fagachar§7 para descer.");
  return true;
}
/** descrição dos requisitos (menu). */
export function flightRequirements() {
  const all = new Set(FLIGHT.stages); for (const r of Object.values(RACES)) for (const id of Object.keys(r.stages)) if (wingedStage(id)) all.add(id);
  const names = [...all].map((id) => { for (const r of Object.values(RACES)) if (r.stages[id]) return r.stages[id].name; return id; });
  return [...new Set(names)].join(", ");
}

export function startFlight() {
  system.runInterval(() => { for (const p of world.getAllPlayers()) { try { stepFlight(p); } catch { /* ignore */ } } }, FLIGHT.tick);
  system.runInterval(() => { for (const p of world.getAllPlayers()) { try { flightProgress(p); } catch { /* ignore */ } } }, 200);
  world.afterEvents.entityDie.subscribe((ev) => { try { const e = ev.deadEntity; if (e?.typeId === "minecraft:player") dropFlight(e.id); } catch { /* ignore */ } });
  world.afterEvents.playerSpawn.subscribe((ev) => { try { dropFlight(ev.player.id); unEff(ev.player, "levitation"); } catch { /* ignore */ } });
  world.afterEvents.playerLeave.subscribe((ev) => dropFlight(ev.playerId));
}

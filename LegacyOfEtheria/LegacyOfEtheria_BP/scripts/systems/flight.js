// systems/flight.js - VOO LIVRE (habilidade passiva "free_flight").
// HONESTIDADE TÉCNICA: @minecraft/server 1.17.0 NÃO expõe o voo nativo do modo Criativo (não há como ligar "mayfly"/isFlying em um jogador
// de sobrevivência). Este voo é, portanto, um CONTROLADOR POR SCRIPT usando só APIs estáveis (isJumping, isSneaking, isOnGround, getVelocity,
// addEffect/removeEffect). Não é o voo criativo nativo:
//   - decolar/subir: SEGURAR "pular" (teclado: espaço; celular: botão de pular) ~0,4 s no ar ou no chão -> levitação curta e renovada;
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

const st = new Map();   // playerId -> { air, held, ground, last }
export const flightOn = (d) => d.flight?.on !== false;                  // padrão: ligada ao desbloquear
export const flightUnlocked = (d) => hasSkill(d, FLIGHT.skill);
export const isFlying = (p) => !!st.get(p.id)?.air;
export const dropFlight = (id) => { st.delete(id); };

const eff = (p, id, ticks, amp = 0) => { try { p.addEffect(id, ticks, { amplifier: amp, showParticles: false }); } catch { /* ignore */ } };
const unEff = (p, id) => { try { p.removeEffect(id); } catch { /* ignore */ } };

/** liga/desliga a habilidade (menu e !voo). Desligar em pleno ar é seguro: queda lenta por safeTicks. */
export function setFlightOn(player, on) {
  const d = getData(player);
  if (!flightUnlocked(d)) return { ok: false, msg: "Voo Livre ainda está bloqueado." };
  d.flight = { ...(d.flight ?? {}), on: !!on }; markDirty(player);
  if (!on) land(player, true);
  return { ok: true, msg: on ? "§bVoo Livre ativado. §7Segure pular para decolar." : "§7Voo Livre desativado. Você desce em segurança." };
}
export const toggleFlight = (player) => setFlightOn(player, !flightOn(getData(player)));

function land(p, safe) {
  const s = st.get(p.id); if (s) { s.air = false; s.held = 0; }
  unEff(p, "levitation");
  if (safe) eff(p, "slow_falling", FLIGHT.safeTicks, 0);
}

function inactiveGameMode(p) { try { const g = p.getGameMode?.(); return g === "creative" || g === "spectator" || g === "Creative" || g === "Spectator"; } catch { return false; } }

/** um passo do controlador para um jogador (exportado para testes). */
export function stepFlight(p) {
  const d = getData(p);
  let s = st.get(p.id); if (!s) { s = { air: false, held: 0, ground: 0 }; st.set(p.id, s); }
  if (!flightUnlocked(d) || !flightOn(d) || inactiveGameMode(p)) { if (s.air) land(p, true); return; }
  if (p.isGliding || p.isInWater || p.isClimbing) { if (s.air) land(p, true); s.held = 0; return; }
  let jump = false, sneak = false, ground = false;
  try { jump = !!p.isJumping; sneak = !!p.isSneaking; ground = !!p.isOnGround; } catch { /* ignore */ }
  const step = FLIGHT.tick;
  s.held = jump ? s.held + step : Math.max(0, s.held - step * 2);
  if (!s.air) {
    if (s.held >= FLIGHT.holdJump) { s.air = true; s.ground = 0; eff(p, "slow_falling", FLIGHT.safeTicks, 0); }
    else return;
  }
  // custo opcional
  if (FLIGHT.staminaPerSec > 0) {
    const cost = FLIGHT.staminaPerSec * step / 20;
    if ((d.stamina ?? 0) < cost) { land(p, true); say(p, "§7[Voo] sem energia: pouso controlado."); return; }
    d.stamina -= cost;
  }
  // pouso: no chão, sem subir, por 2 ciclos
  if (ground && !jump) { s.ground++; if (s.ground >= 2 || sneak) { land(p, true); return; } } else s.ground = 0;
  eff(p, "slow_falling", 30, 0);                       // nunca há dano de queda enquanto voa
  if (FLIGHT.speedAmp >= 0) { let cur = -1; try { cur = p.getEffect("speed")?.amplifier ?? -1; } catch { /* ignore */ } if (cur < FLIGHT.speedAmp) eff(p, "speed", 20, FLIGHT.speedAmp); }
  // vertical
  let vy = 0; try { vy = p.getVelocity().y; } catch { /* ignore */ }
  if (jump) eff(p, "levitation", 6, FLIGHT.riseAmp);   // subir
  else if (sneak) unEff(p, "levitation");              // descer (queda lenta controlada)
  else if (vy < -FLIGHT.hoverBand) eff(p, "levitation", 3, 0);   // pairar: empurra de volta
  else if (vy > FLIGHT.hoverBand) unEff(p, "levitation");
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

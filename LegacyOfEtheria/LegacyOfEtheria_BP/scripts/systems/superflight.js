// systems/superflight.js - 8.1 SUPER VOO (estilo herói), por cima do Voo Livre (systems/flight.js):
//   entrar: no ar, segurar o movimento ~1 s (ou correr) -> voa para onde a CÂMERA aponta, acelerando até ~44 blocos/s;
//   estrondo sônico (anel + som) ao passar da velocidade de som; rastro de vento;
//   mergulhar no chão rápido = IMPACTO: cratera (fora de cidades/estruturas/arenas), onda de choque, dano e empurrão em volta, pose de pouso de herói;
//   golpear um mob em super voo = AGARRA (vai junto, à frente); golpear de novo = ARREMESSA na direção da câmera;
//   sair: soltar o movimento, ou agachar (freia e volta ao voo normal).
// Visual: propriedade NUMÉRICA etheria:sfly (1 super voo · 2 carregando · 3 pouso de herói) -> animation.tensura.race.superfly (RP).
import { world, system } from "@minecraft/server";
import { TURBO } from "../config.js";
import { getData, markDirty } from "../core/db.js";
import { isProtectedPos } from "./arenas.js";
import { tempestInfo } from "./tempest.js";
import { settlementInfo } from "./settlements.js";
import { SETTLEMENT_LIST } from "../data/factions.js";

const Q = new Map();          // playerId -> { on, sp, fwd, idle, boom, carry, pose, poseT }
const PROP = "etheria:sfly";
const NO_BREAK = /bedrock|barrier|command_block|structure|jigsaw|end_portal|portal|chest|shulker|barrel|spawner|water|lava|air|reinforced|light_block|allow|deny|border|etheria:/;

const fx = (dim, id, l) => { try { dim.spawnParticle(id, l); } catch { /* ignore */ } };
const snd = (p, id, vol = 1, pitch = 1) => { try { p.dimension.playSound(id, p.location, { volume: vol, pitch }); } catch { /* ignore */ } };
const shake = (p, a, t) => { try { p.runCommand(`camerashake add @s ${a} ${t} positional`); } catch { /* ignore */ } };
function setPose(p, q, v, t = 0) { q.poseT = t; if (q.pose === v) return; q.pose = v; try { p.setProperty(PROP, v); } catch { /* BP antigo */ } }
function blockedForm(p) {
  try { const lf = p.getProperty("etheria:lform"); if (lf === "true" || lf === "draconic") return true; if (p.getProperty("etheria:slime") || (p.getProperty("etheria:mimic") ?? 0) > 0) return true; } catch { /* ignore */ }
  return false;
}
export const superOn = (p) => !!Q.get(p.id)?.on;
function state(p) { let q = Q.get(p.id); if (!q) { q = { on: false, sp: 0, fwd: 0, idle: 0, boom: false, carry: null, pose: -1, poseT: 0 }; Q.set(p.id, q); } return q; }

function release(p, q, throwIt) {
  const e = q.carry; q.carry = null; if (!e?.isValid) return;
  if (throwIt) {
    let v = { x: 0, y: 0, z: 1 }; try { v = p.getViewDirection(); } catch { /* ignore */ }
    try { e.applyKnockback(v.x, v.z, 3.2 + q.sp, 0.35 + Math.max(0, v.y)); } catch { /* jogador/sem física */ }
    try { e.applyDamage(6 + Math.round(q.sp * 4), { cause: "entityAttack", damagingEntity: p }); } catch { /* ignore */ }
    fx(p.dimension, "etheria:fx_is_trailed_shockwave", e.location); snd(p, "mob.warden.sonic_boom", 0.6, 1.4); shake(p, 0.25, 0.3);
  }
}
/** encerra o super voo (volta ao voo normal ou ao chão) */
export function endSuper(p, keepPose = false) {
  const q = Q.get(p.id); if (!q) return;
  release(p, q, false); q.on = false; q.sp = 0; q.fwd = 0; q.idle = 0; q.boom = false;
  if (!keepPose && q.pose !== 3) setPose(p, q, 0);
}
export const dropSuper = (id) => Q.delete(id);

/** área onde a cratera NÃO quebra blocos: Tempest, cidades, arenas de chefe */
function safeZone(dim, x, y, z) {
  try { if (isProtectedPos(dim, x, y, z)) return true; } catch { /* ignore */ }
  if (dim.id !== "minecraft:overworld") return false;
  try { const t = tempestInfo(); if (t && Math.hypot(x - t.x, z - t.z) < 230) return true; } catch { /* ignore */ }
  try { for (const s of SETTLEMENT_LIST) { const i = settlementInfo(s.id); if (i && Math.hypot(x - i.x, z - i.z) < 110) return true; } } catch { /* ignore */ }
  return false;
}
/** IMPACTO: onda de choque, dano em área e cratera (limitada) */
export function impact(p, sp) {
  const dim = p.dimension, l = p.location, r = Math.min(TURBO.craterMax, 2 + Math.floor(sp * 1.2));
  fx(dim, "minecraft:huge_explosion_emitter", l); fx(dim, "etheria:impact_ring", l); fx(dim, "etheria:fx_is_shockwave", l); fx(dim, "etheria:fx_is_ring_smoke", l);
  snd(p, "random.explode", 1.4, 0.7); snd(p, "mob.warden.sonic_boom", 0.8, 0.6); shake(p, 0.9, 0.6);
  try {
    for (const e of dim.getEntities({ location: l, maxDistance: r + 3 })) {
      if (e.id === p.id || e.typeId === "minecraft:item") continue;
      const dx = e.location.x - l.x, dz = e.location.z - l.z, dl = Math.hypot(dx, dz) || 1;
      try { e.applyDamage(Math.round(5 + sp * 7), { cause: "entityAttack", damagingEntity: p }); } catch { /* ignore */ }
      try { e.applyKnockback(dx / dl, dz / dl, 1.6 + sp, 0.55); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  const d = getData(p); if (d.flight?.crater === false || safeZone(dim, Math.floor(l.x), Math.floor(l.y), Math.floor(l.z))) return;
  let n = 0; const cx = Math.floor(l.x), cy = Math.floor(l.y) - 1, cz = Math.floor(l.z);
  for (let dy = 0; dy >= -Math.ceil(r * 0.6) && n < TURBO.craterBlocks; dy--) {
    const rr = r * Math.sqrt(1 - (dy / (r * 0.75)) ** 2);
    for (let dx = -r; dx <= r && n < TURBO.craterBlocks; dx++) for (let dz = -r; dz <= r && n < TURBO.craterBlocks; dz++) {
      if (dx * dx + dz * dz > rr * rr) continue;
      try { const b = dim.getBlock({ x: cx + dx, y: cy + dy, z: cz + dz }); if (!b || NO_BREAK.test(b.typeId)) continue; b.setType("minecraft:air"); n++; } catch { /* fora do mundo/descarregado */ }
    }
  }
}

/**
 * Passo do super voo, chamado pelo controlador de voo a cada tick. inp = { moving, sprint, sneak, ground, s } (s = estado do voo normal).
 * Devolve false (voo normal segue), "fly" (super voo escreveu o movimento) ou "land" (impacto: o voo deve pousar).
 */
export function superStep(p, inp) {
  if (!TURBO.on) return false;
  const q = state(p), s = inp.s, d = getData(p);
  if (blockedForm(p)) { if (q.on) endSuper(p); return false; }
  q.fwd = inp.moving ? q.fwd + 1 : 0;
  if (!q.on) {
    if (inp.moving && !inp.sneak && !inp.ground && (inp.sprint || q.fwd >= TURBO.holdTicks)) {
      q.on = true; q.sp = Math.max(TURBO.start, Math.hypot(s.vx, s.vz)); q.boom = false; q.idle = 0;
      setPose(p, q, 1); snd(p, "mob.enderdragon.flap", 1, 1.4); fx(p.dimension, "etheria:wind_swirl", p.location);
    } else return false;
  }
  // saída: agachar freia; soltar o movimento por ~0,4 s desliga
  q.idle = inp.moving ? 0 : q.idle + 1;
  if (inp.sneak || q.idle > 8) { s.vx *= 0.5; s.vz *= 0.5; endSuper(p); return false; }
  if (TURBO.staminaPerSec > 0) { const c = TURBO.staminaPerSec / 20; if ((d.stamina ?? 0) < c) { endSuper(p); return false; } d.stamina -= c; }
  let v = { x: 0, y: 0, z: 1 }; try { v = p.getViewDirection(); } catch { /* ignore */ }
  q.sp = Math.min(TURBO.max, q.sp + TURBO.accel);
  // impacto: encostou no chão mergulhando rápido
  if (inp.ground && v.y < -0.25 && q.sp >= TURBO.impactMin) { const sp = q.sp; endSuper(p, true); setPose(p, q, 3, 18); impact(p, sp); return "land"; }
  let vy = v.y * q.sp; if (inp.ground && vy < 0.05) vy = 0.12;          // rente ao chão: desliza, não raspa
  const hx = v.x * q.sp, hz = v.z * q.sp, hs = Math.hypot(hx, hz);
  try { p.applyKnockback(hs > 0 ? hx / hs : 0, hs > 0 ? hz / hs : 0, hs, vy); } catch { /* ignore */ }
  s.vx = hx; s.vz = hz;
  try { p.addEffect("slow_falling", 30, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
  // estrondo sônico (uma vez por arrancada)
  if (!q.boom && q.sp >= TURBO.boom) {
    q.boom = true; const l = p.location;
    fx(p.dimension, "etheria:fx_is_shockwave", l); fx(p.dimension, "etheria:fx_is_ring_smoke", l); snd(p, "mob.warden.sonic_boom", 1, 1.2); shake(p, 0.35, 0.4);
  }
  // rastro
  if (s.t % 2 === 0) { const l = p.location; fx(p.dimension, q.sp >= TURBO.boom ? "etheria:fx_is_trailed_shockwave" : "etheria:wind_swirl", { x: l.x - v.x * 1.6, y: l.y + 0.9 - v.y * 1.6, z: l.z - v.z * 1.6 }); }
  // carregando: o alvo vai à frente
  if (q.carry) {
    const e = q.carry;
    if (!e.isValid) q.carry = null;
    else { const l = p.location; try { e.teleport({ x: l.x + v.x * 1.4, y: l.y + 0.2 + v.y * 1.4, z: l.z + v.z * 1.4 }, { keepVelocity: false }); } catch { q.carry = null; } }
  }
  setPose(p, q, q.carry ? 2 : 1);
  return "fly";
}

export function startSuperFlight() {
  world.afterEvents.entityHitEntity.subscribe((ev) => {
    try {
      const p = ev.damagingEntity, e = ev.hitEntity; if (p?.typeId !== "minecraft:player" || !e?.isValid) return;
      const q = Q.get(p.id); if (!q?.on) return;
      if (q.carry) { release(p, q, true); setPose(p, q, 1); return; }
      let hp = 0; try { hp = e.getComponent("minecraft:health")?.effectiveMax ?? 0; } catch { /* ignore */ }
      if (hp > TURBO.carryMaxHp || e.typeId === "minecraft:ender_dragon") return;
      q.carry = e; setPose(p, q, 2); snd(p, "random.pop", 0.6, 0.6);
    } catch { /* ignore */ }
  });
  // pose de pouso de herói: some sozinha
  system.runInterval(() => {
    for (const [id, q] of Q) {
      if (q.pose !== 3 || --q.poseT > 0) continue;
      const p = world.getAllPlayers().find((x) => x.id === id); if (p) setPose(p, q, 0); else Q.delete(id);
    }
  }, 1);
  world.afterEvents.playerLeave.subscribe((ev) => dropSuper(ev.playerId));
  world.afterEvents.entityDie.subscribe((ev) => { try { if (ev.deadEntity?.typeId === "minecraft:player") { const q = Q.get(ev.deadEntity.id); if (q) { q.carry = null; q.on = false; } } } catch { /* ignore */ } });
}
/** !cratera: liga/desliga a quebra de blocos do impacto */
export function toggleCrater(p) {
  const d = getData(p); const on = d.flight?.crater === false; d.flight = { ...(d.flight ?? {}), crater: on }; markDirty(p);
  return on ? "§6[Super Voo] §fImpacto agora abre crateras §7(nunca em Tempest, cidades ou arenas)." : "§6[Super Voo] §7Impacto sem quebrar blocos (só onda de choque e dano).";
}

// systems/tamedragons.js - 8.8 (Etapa 7b): DRAGÕES DOMÁVEIS (Carmim, Gelo, Tempestade; entidades de tools/tame_dragons.py).
// O BP cuida de domar/seguir/atacar/curar/montar; aqui fica só o que o JSON não faz:
//  • VOO DA MONTARIA: montado, olhe para CIMA para decolar; no ar o dragão voa para onde você olha (frente = W, se o jogo informar o
//    direcional; senão voa sempre para a frente); olhe para BAIXO perto do chão para pousar. Queda lenta enquanto voa (sem dano de queda no BP).
//  • dragão domado acompanha o dono que está voando alto (sobe até ele), e os selvagens às vezes alçam voo curto (mostra subir/planar).
// O estado visual do voo (propriedade etheria:fly) vem de systems/mobflight.js (família etheria_flyer). Leve: o laço por tick só olha jogadores montados.
import { world, system } from "@minecraft/server";
import { TAME_DRAGONS } from "../data/tamedragons.gen.js";
import { isValid, say } from "../core/utils.js";

const SPEED = 0.62, CLIMB = 0.55, GRAV = 0.08;
const flying = new Map();   // id do dragão -> tick em que decolou
let tick = 0;
export const isFlying = (id) => flying.has(id);
export const isTameDragon = (e) => { try { return !!TAME_DRAGONS[e.typeId]; } catch { return false; } };

const mount = (p) => { try { const r = p.getComponent("minecraft:riding")?.entityRidingOn; return r && isTameDragon(r) && isValid(r) ? r : undefined; } catch { return undefined; } };
const forward = (p) => { try { const v = p.inputInfo?.getMovementVector?.(); if (v && typeof v.y === "number") return Math.max(0, Math.min(1, v.y)); } catch { /* ignore */ } return 1; };
const slowFall = (e) => { try { e.addEffect("slow_falling", 50, { amplifier: 0, showParticles: false }); } catch { /* ignore */ } };

/** um tick de controle de voo de um dragão montado. Devolve o estado: "chao" | "decolou" | "voando" | "pousou" */
export function steer(p, d) {
  const v = p.getViewDirection(), ground = !!d.isOnGround, on = flying.has(d.id);
  if (!on) {
    if (v.y < 0.5) return "chao";
    flying.set(d.id, tick); slowFall(d);
    try { d.applyImpulse({ x: v.x * 0.3, y: 0.9, z: v.z * 0.3 }); } catch { /* ignore */ }
    try { p.onScreenDisplay?.setActionBar?.("§b✈ Voo: olhe para onde quer ir · olhe para baixo perto do chão para pousar"); } catch { /* ignore */ }
    return "decolou";
  }
  if (ground && v.y < -0.3 && tick - flying.get(d.id) > 20) { flying.delete(d.id); return "pousou"; }
  const f = forward(p), s = SPEED * (0.25 + 0.75 * f);
  try {
    d.clearVelocity();
    d.applyImpulse({ x: v.x * s, y: Math.max(-0.9, Math.min(CLIMB, v.y * s)) + GRAV, z: v.z * s });
  } catch { /* ignore */ }
  if (tick % 40 === 0) slowFall(d);
  return "voando";
}

function ownerOf(e) {
  try { const t = e.getComponent("minecraft:tameable"); const id = t?.tamedToPlayerId ?? t?.tamedToPlayer?.id; if (!id) return undefined; return world.getAllPlayers().find((p) => p.id === id); } catch { return undefined; }
}
const tamed = (e) => { try { return !!e.getComponent("minecraft:is_tamed"); } catch { return false; } };

/** a cada 20 ticks: domados sobem até o dono que voa; selvagens dão voos curtos de vez em quando */
function companions() {
  const seen = new Set();
  for (const p of world.getAllPlayers()) {
    let list = []; try { list = p.dimension.getEntities({ location: p.location, maxDistance: 48, families: ["etheria_tame_dragon"] }); } catch { continue; }
    for (const e of list) {
      if (seen.has(e.id) || !isValid(e)) continue; seen.add(e.id);
      try {
        if (e.getComponent("minecraft:rideable")?.getRiders?.().length) continue;
        if (tamed(e)) {
          const o = ownerOf(e); if (!o || o.dimension.id !== e.dimension.id) continue;
          const dy = o.location.y - e.location.y, dx = o.location.x - e.location.x, dz = o.location.z - e.location.z, h = Math.hypot(dx, dz);
          if (dy > 4 && h < 40) { slowFall(e); e.applyImpulse({ x: dx / Math.max(h, 1) * 0.35, y: Math.min(0.8, dy * 0.12), z: dz / Math.max(h, 1) * 0.35 }); }
        } else if (e.isOnGround && Math.random() < 0.06) {
          const a = Math.random() * 6.283; slowFall(e); e.applyImpulse({ x: Math.cos(a) * 0.5, y: 0.95, z: Math.sin(a) * 0.5 });
        }
      } catch { /* ignore */ }
    }
  }
}

export function startTameDragons() {
  try {
    world.afterEvents.dataDrivenEntityTrigger.subscribe((ev) => {
      try {
        if (ev.eventId !== "etheria:tamed" || !isTameDragon(ev.entity)) return;
        const e = ev.entity, nm = TAME_DRAGONS[e.typeId].name;
        for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 10 })) say(p, `§a[Etheria] §f${nm} §adomado! §7Interaja para montar · olhe para cima para voar · cure com a mesma comida.`);
      } catch { /* ignore */ }
    });
  } catch { /* evento indisponível nesta versão */ }
  system.runInterval(() => {
    tick++;
    const ridden = new Set();
    for (const p of world.getAllPlayers()) {
      const d = mount(p); if (!d) continue;
      ridden.add(d.id);
      try { steer(p, d); } catch { /* ignore */ }
    }
    for (const id of flying.keys()) if (!ridden.has(id)) flying.delete(id);
    if (tick % 20 === 0) companions();
  }, 1);
}

// systems/mobflight.js - ETAPA 4: estado VISUAL do voo dos mobs voadores (anjos e dragões, família etheria_flyer).
// Escreve a propriedade NUMÉRICA etheria:fly (0 chão · 1 pairando · 2 subindo · 3 planando · 4 mergulho/ataque), lida pelas animações do RP
// (tools/mob_flight.py). Roda a cada 4 ticks; só toca na propriedade quando o estado muda.
import { world, system } from "@minecraft/server";

const FAM = "etheria_flyer", PROP = "etheria:fly", DIMS = ["overworld", "nether", "the_end"];
const FLYERS = new Set(["etheria:feldway_angel", "etheria:zalario", "etheria:dino", "etheria:pico", "etheria:garasha",
  "etheria:veldanava", "etheria:velzard", "etheria:velgrynd",
  "etheria:void_dragon", "etheria:fallen_angel", "etheria:angel_guardian"]);   // 8.7: chefes por região que voam
const hitAt = new Map();   // id -> tick do último golpe (mergulho no ataque)
let tick = 0;

/** estado do voo a partir do chão/velocidade (e do último ataque) */
export function flyState(onGround, v, sinceHit) {
  if (sinceHit !== undefined && sinceHit < 16) return 4;
  if (onGround) return 0;
  if (v.y < -0.2) return 4;
  if (v.y > 0.06) return 2;
  return Math.hypot(v.x, v.z) > 0.12 ? 3 : 1;
}

export function startMobFlight() {
  try {
    world.afterEvents.entityHitEntity.subscribe((ev) => {
      try { const e = ev.damagingEntity; if (e && FLYERS.has(e.typeId)) hitAt.set(e.id, tick); } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
  system.runInterval(() => {
    tick += 4;
    for (const dim of DIMS) {
      let list = [];
      try { list = world.getDimension(dim).getEntities({ families: [FAM] }); } catch { continue; }
      for (const e of list) {
        try {
          let g = false, v = { x: 0, y: 0, z: 0 };
          try { g = !!e.isOnGround; v = e.getVelocity(); } catch { /* ignore */ }
          const h = hitAt.get(e.id), s = flyState(g, v, h === undefined ? undefined : tick - h);
          if (e.getProperty(PROP) !== s) e.setProperty(PROP, s);
        } catch { /* ignore */ }
      }
    }
    if (tick % 200 === 0) for (const [id, t] of hitAt) if (tick - t > 40) hitAt.delete(id);
  }, 4);
}

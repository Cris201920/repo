// systems/bossanim.js - 6.37: ANIMAÇÕES DE COMBATE DOS CHEFES (RP/animations/etheria_boss_combat.animation.json, geradas por tools/boss_anims.py).
// Cada habilidade escolhida pela IA (systems/mobai.js) toca a animação do tipo certo no início da preparação ("wind"): o impacto da animação (~0,45 s)
// coincide com o golpe. Ataques corpo a corpo tocam "swing" e o chefe reage ao dano com "flinch" (no máx. 1x a cada 1,5 s, nunca durante um golpe).
import { world, system } from "@minecraft/server";
import { BOSS_ANIM } from "../data/bossanim.gen.js";

const KIND = {
  slam: "slam", quake: "slam", war_stomp: "slam", ground_pound: "slam", calamity: "slam", stampede: "slam", earth_slam: "slam", iron_skin: "roar",
  claw: "swing", halberd_sweep: "swing", crimson_lance: "swing", dash_barrage: "swing", triple_kick: "swing", wind_blades: "swing", holy_cross: "swing", judgement: "swing",
  charge: "lunge", pounce: "lunge", leap: "lunge", rampage: "lunge", blink: "lunge", bite: "lunge", predator_maw: "lunge", devour_minion: "lunge", dragon_flight: "lunge",
  roar: "roar", wail: "roar", summon_minions: "roar", demon_horde: "roar", war_drums: "roar", overlord_aura: "roar", spider_swarm: "roar", soul_harvest: "roar", blood_pact: "roar", heal_self: "cast",
  breath: "breath", ice_breath: "breath", fire_wave: "breath", dragon_nuke: "breath", tsunami: "breath", laser_barrage: "breath",
  tail_sweep: "spin", maelstrom: "spin", sovereign_wave: "spin", crimson_nova: "spin",
};
export const kindFor = (id) => KIND[id] ?? "cast";
const busyUntil = new Map(), lastFlinch = new Map();
export function playBossAnim(e, kind, holdTicks = 20) {
  const a = BOSS_ANIM[e?.typeId]; if (!a || !a.k.includes(kind)) return false;
  try { e.playAnimation(`animation.etheria.bc.${a.g}.${kind}`, { blendOutTime: 0.25 }); } catch { return false; }
  busyUntil.set(e.id, system.currentTick + holdTicks);
  return true;
}
export const animBusy = (e) => (busyUntil.get(e.id) ?? 0) > system.currentTick;
export function startBossAnims() {
  // golpe corpo a corpo do chefe
  try {
    world.afterEvents.entityHitEntity.subscribe((ev) => {
      const e = ev.damagingEntity; if (!e || !BOSS_ANIM[e.typeId] || animBusy(e)) return;
      playBossAnim(e, Math.random() < 0.75 ? "swing" : "lunge", 14);
    });
  } catch { /* evento indisponível */ }
  // reação ao dano
  try {
    world.afterEvents.entityHurt.subscribe((ev) => {
      const e = ev.hurtEntity; if (!e || !BOSS_ANIM[e.typeId] || animBusy(e)) return;
      const now = system.currentTick; if (now - (lastFlinch.get(e.id) ?? -999) < 30) return;
      lastFlinch.set(e.id, now); playBossAnim(e, "flinch", 6);
    });
  } catch { /* ignore */ }
  system.runInterval(() => { if (busyUntil.size > 300) busyUntil.clear(); if (lastFlinch.size > 300) lastFlinch.clear(); }, 1200);
}

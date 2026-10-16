// data/misc.js - Guilda, conquistas, bônus de conjunto e mapa de partículas
const E = "etheria:";

export const GUILD_RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"];
export const GUILD_REP = [0, 50, 150, 350, 700, 1400, 2800, 5000, 9000]; // reputação mínima por rank
export const GUILD_REWARDS = [
  null,
  { coins: 100, items: [[E + "hp_potion_s", 3]] },
  { coins: 250, items: [[E + "mp_potion_s", 3], [E + "ring_vigor", 1]] },
  { coins: 600, items: [[E + "hp_potion_l", 2]] },
  { coins: 1500, items: [[E + "skill_scroll", 1]] },
  { coins: 4000, items: [[E + "amulet_guardian", 1]] },
  { coins: 9000, items: [[E + "xp_scroll", 3]] },
  { coins: 20000, items: [[E + "skill_scroll", 2]] },
  { coins: 50000, items: [[E + "amulet_arcane", 1]] },
];

// 6.54: as conquistas (com raridade, progresso e recompensa) ficam em data/achievements.js — reexportadas aqui para quem já importava de misc.js
export { ACHIEVEMENTS, ACH_CATS, RARITY, ACH_BY_ID } from "./achievements.js";

// Bônus de conjunto de armadura (por quantidade de peças). Multiplicados pelo tier do conjunto.
export const SET_BONUS = {
  2: { defense: 2, vitality: 1 },
  4: { defense: 5, vitality: 3, strength: 2, crit: 3 },
};

// elemento -> partícula (ids em RP/particles/*.particle.json, prefixo etheria:)
export const FX_MAP = {
  fire: "fire_burst", ice: "ice_shard", lightning: "lightning_arc", wind: "wind_swirl", water: "water_splash", earth: "earth_chunk",
  light: "light_ray", shadow: "shadow_wisp", void: "void_rift", heal: "heal_glow", teleport: "teleport_flash", transform: "transform_ring",
  levelup: "level_up", legendary: "legendary_aura", blood: "blood_mist", arcane: "arcane_spark", physical: "impact_ring", boss: "boss_aura",
};

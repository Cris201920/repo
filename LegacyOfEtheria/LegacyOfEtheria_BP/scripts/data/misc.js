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

// Conquistas: check(d) -> bool. Concedem título e moedas.
const bk = (d) => Object.values(d.bossKills ?? {}).reduce((a, b) => a + b, 0);
export const ACHIEVEMENTS = [
  { id: "first_blood", name: "Primeiro Sangue", desc: "Derrote 1 inimigo.", title: "Novato", coins: 20, check: (d) => d.kills >= 1 },
  { id: "hunter", name: "Caçador", desc: "Derrote 100 inimigos.", title: "Caçador", coins: 150, check: (d) => d.kills >= 100 },
  { id: "slayer", name: "Exterminador", desc: "Derrote 1000 inimigos.", title: "Exterminador", coins: 1500, check: (d) => d.kills >= 1000 },
  { id: "lv10", name: "Veterano", desc: "Alcance o nível 10.", title: "Veterano", coins: 100, check: (d) => d.level >= 10 },
  { id: "lv25", name: "Herói", desc: "Alcance o nível 25.", title: "Herói", coins: 500, check: (d) => d.level >= 25 },
  { id: "lv50", name: "Lenda Viva", desc: "Alcance o nível 50.", title: "Lenda Viva", coins: 2500, check: (d) => d.level >= 50 },
  { id: "lv100", name: "Ascendido", desc: "Alcance o nível 100.", title: "Ascendido", coins: 20000, check: (d) => d.level >= 100 },
  { id: "king_slayer", name: "Regicida Goblin", desc: "Derrote o Rei Goblin.", title: "Regicida", coins: 500, check: (d) => (d.bossKills.goblin_king ?? 0) >= 1 },
  { id: "void_breaker", name: "Quebra-Vazio", desc: "Derrote o Senhor do Vazio.", title: "Quebra-Vazio", coins: 3000, check: (d) => (d.bossKills.void_lord ?? 0) >= 1 },
  { id: "ember_tamer", name: "Domador de Brasas", desc: "Derrote o Tirano Brasa.", title: "Domador de Brasas", coins: 5000, check: (d) => (d.bossKills.ember_tyrant ?? 0) >= 1 },
  { id: "boss_hunter", name: "Matador de Chefes", desc: "Derrote 10 bosses.", title: "Matador de Chefes", coins: 6000, check: (d) => bk(d) >= 10 },
  { id: "rich", name: "Magnata", desc: "Tenha 10.000 moedas.", title: "Magnata", coins: 0, check: (d) => d.coins >= 10000 },
  { id: "questor", name: "Herói das Missões", desc: "Complete 10 missões.", title: "Herói das Missões", coins: 800, check: (d) => d.quests.completed.length >= 10 },
  { id: "guild_b", name: "Aventureiro Rank B", desc: "Alcance o rank B da guilda.", title: "Veterano da Guilda", coins: 1000, check: (d) => d.guild.id && d.guild.rank >= 4 },
  { id: "guild_s", name: "Lenda da Guilda", desc: "Alcance o rank S da guilda.", title: "Lenda da Guilda", coins: 5000, check: (d) => d.guild.id && d.guild.rank >= 6 },
  { id: "evolved", name: "Evolução", desc: "Evolua sua raça pela primeira vez.", title: "Evoluído", coins: 300, check: (d) => !d.raceStage.endsWith("_1") },
  { id: "ascended_race", name: "Forma Suprema", desc: "Alcance o estágio final da raça.", title: "Forma Suprema", coins: 5000, check: (d) => /_(3[ab]|4)$/.test(d.raceStage) },
];

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

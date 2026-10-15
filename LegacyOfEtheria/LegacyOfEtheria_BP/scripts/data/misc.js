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
import { SKILLS } from "./skills.js";
const SKILL_CATS = Object.fromEntries(Object.values(SKILLS).map((k) => [k.id, k.cat]));
const SKILL_ELEM = Object.fromEntries(Object.values(SKILLS).map((k) => [k.id, k.element]));
export const ACH_CATS = [["Missões", "menu_quests"], ["Combate", "menu_status"], ["Magia", "menu_skills"], ["Evolução", "menu_race"], ["Exploração", "menu_ranking"], ["Personagens", "menu_guild"], ["Lenda", "menu_class"]];
export const ACHIEVEMENTS = [
  { id: "first_blood", cat: "Combate", name: "Primeiro Sangue", desc: "Derrote 1 inimigo.", title: "Novato", coins: 20, check: (d) => d.kills >= 1 },
  { id: "hunter", cat: "Combate", name: "Caçador", desc: "Derrote 100 inimigos.", title: "Caçador", coins: 150, check: (d) => d.kills >= 100 },
  { id: "slayer", cat: "Combate", name: "Exterminador", desc: "Derrote 1000 inimigos.", title: "Exterminador", coins: 1500, check: (d) => d.kills >= 1000 },
  { id: "lv10", cat: "Evolução", name: "Veterano", desc: "Alcance o nível 10.", title: "Veterano", coins: 100, check: (d) => d.level >= 10 },
  { id: "lv25", cat: "Evolução", name: "Herói", desc: "Alcance o nível 25.", title: "Herói", coins: 500, check: (d) => d.level >= 25 },
  { id: "lv50", cat: "Evolução", name: "Lenda Viva", desc: "Alcance o nível 50.", title: "Lenda Viva", coins: 2500, check: (d) => d.level >= 50 },
  { id: "lv100", cat: "Evolução", name: "Ascendido", desc: "Alcance o nível 100.", title: "Ascendido", coins: 20000, check: (d) => d.level >= 100 },
  { id: "king_slayer", cat: "Combate", name: "Regicida Goblin", desc: "Derrote o Rei Goblin.", title: "Regicida", coins: 500, check: (d) => (d.bossKills.goblin_king ?? 0) >= 1 },
  { id: "void_breaker", cat: "Combate", name: "Quebra-Vazio", desc: "Derrote o Senhor do Vazio.", title: "Quebra-Vazio", coins: 3000, check: (d) => (d.bossKills.void_lord ?? 0) >= 1 },
  { id: "ember_tamer", cat: "Combate", name: "Domador de Brasas", desc: "Derrote o Tirano Brasa.", title: "Domador de Brasas", coins: 5000, check: (d) => (d.bossKills.ember_tyrant ?? 0) >= 1 },
  { id: "boss_hunter", cat: "Combate", name: "Matador de Chefes", desc: "Derrote 10 bosses.", title: "Matador de Chefes", coins: 6000, check: (d) => bk(d) >= 10 },
  { id: "rich", cat: "Missões", name: "Magnata", desc: "Tenha 10.000 moedas.", title: "Magnata", coins: 0, check: (d) => d.coins >= 10000 },
  { id: "questor", cat: "Missões", name: "Herói das Missões", desc: "Complete 10 missões.", title: "Herói das Missões", coins: 800, check: (d) => d.quests.completed.length >= 10 },
  { id: "guild_b", cat: "Missões", name: "Aventureiro Rank B", desc: "Alcance o rank B da guilda.", title: "Veterano da Guilda", coins: 1000, check: (d) => d.guild.id && d.guild.rank >= 4 },
  { id: "guild_s", cat: "Missões", name: "Lenda da Guilda", desc: "Alcance o rank S da guilda.", title: "Lenda da Guilda", coins: 5000, check: (d) => d.guild.id && d.guild.rank >= 6 },
  { id: "evolved", cat: "Evolução", name: "Evolução", desc: "Evolua sua raça pela primeira vez.", title: "Evoluído", coins: 300, check: (d) => !d.raceStage.endsWith("_1") },
  // 6.43: conquistas dos personagens (eventos reais registrados em d.world.chars / flags / missões)
  { id: "disciple", cat: "Personagens", name: "Discípulo", desc: "Conclua a prova de discípulo de um personagem.", title: "Discípulo", coins: 500, check: (d) => Object.keys(d.world?.flags ?? {}).some((k) => k.startsWith("disc_")) },
  { id: "challenger", cat: "Personagens", name: "Desafiante", desc: "Vença um duelo contra um membro do Conselho de Tempest.", title: "Desafiante", coins: 1000, check: (d) => Object.values(d.world?.chars ?? {}).some((c) => (c.wins ?? 0) > 0) },
  { id: "council_friend", cat: "Personagens", name: "Amigo do Conselho", desc: "Converse com Rimuru, Benimaru, Shion, Shuna e Ranga.", title: "Amigo de Tempest", coins: 300, check: (d) => ["rimuru_tempest", "benimaru", "shion", "shuna", "ranga"].every((k) => d.world?.chars?.[k]?.met) },
  { id: "tempest_guardian", cat: "Missões", name: "Guardião de Tempest", desc: "Conclua as missões de defesa de Tempest.", title: "Guardião de Tempest", coins: 2000, check: (d) => ["tp_leader_defend", "tp_defend_city2", "tp_orc_aftermath"].every((q) => d.quests.completed.includes(q)) },
  { id: "council_champion", cat: "Personagens", name: "Campeão do Conselho", desc: "Vença Rimuru, Benimaru, Shion e Shuna em duelo.", title: "Campeão de Tempest", coins: 6000, check: (d) => ["rimuru_tempest", "benimaru", "shion", "shuna"].every((k) => (d.world?.chars?.[k]?.wins ?? 0) > 0) },
  // 6.46: exploração, combate, magia, missões e lenda (eventos reais: flags do mundo, missões concluídas, armas usadas, tipos de inimigos, habilidades)
  { id: "first_step", cat: "Missões", name: "Primeiro Passo", desc: "Conclua sua primeira missão.", title: "Iniciante", coins: 50, check: (d) => d.quests.completed.length >= 1 },
  { id: "adventurer", cat: "Missões", name: "Aventureiro", desc: "Conclua 5 missões.", title: "Aventureiro", coins: 400, check: (d) => d.quests.completed.length >= 5 },
  { id: "dimension_explorer", cat: "Exploração", name: "Explorador Dimensional", desc: "Entre no Domínio de Veldanava.", title: "Viajante das Estrelas", coins: 1500, check: (d) => !!d.world?.flags?.visited_veldanava },
  { id: "luminus_visitor", cat: "Exploração", name: "Peregrino da Luz", desc: "Visite o Reino Sagrado de Luminus.", title: "Peregrino", coins: 300, check: (d) => !!d.world?.flags?.region_luminus },
  { id: "world_traveler", cat: "Exploração", name: "Andarilho", desc: "Visite Tempest, Luminus, o Domínio de Guy e Dwargon.", title: "Andarilho", coins: 1200, check: (d) => ["region_tempest", "region_luminus", "region_guy", "region_dwargon"].every((k) => d.world?.flags?.[k]) },
  { id: "weapon_master", cat: "Combate", name: "Mestre das Armas", desc: "Ataque com 4 tipos diferentes de arma.", title: "Mestre das Armas", coins: 800, check: (d) => Object.keys(d.world?.wtypes ?? {}).length >= 4 },
  { id: "monster_hunter", cat: "Combate", name: "Caçador de Monstros", desc: "Derrote 15 tipos diferentes de criaturas.", title: "Caçador de Monstros", coins: 900, check: (d) => Object.keys(d.world?.killTypes ?? {}).length >= 15 },
  { id: "magic_awakening", cat: "Magia", name: "Despertar Mágico", desc: "Aprenda uma habilidade da categoria Magia.", title: "Desperto", coins: 200, check: (d) => d.unlockedSkills.some((id) => SKILL_CATS[id] === "Magia") },
  { id: "elementalist", cat: "Magia", name: "Elementalista", desc: "Tenha habilidades de 4 elementos diferentes.", title: "Elementalista", coins: 1000, check: (d) => new Set(d.unlockedSkills.map((id) => SKILL_ELEM[id]).filter(Boolean)).size >= 4 },
  { id: "veldanava_heir", cat: "Exploração", name: "Herdeiro da Memória", desc: "Conclua o Juízo da Luz no Domínio de Veldanava.", title: "Herdeiro de Veldanava", coins: 8000, check: (d) => !!d.world?.flags?.veldanava_trial },
  { id: "tensura_legend", cat: "Lenda", name: "Lenda de Tensura", desc: "Herdeiro da Memória, Campeão do Conselho e discípulo de um mestre.", title: "Lenda de Tensura", coins: 25000,
    check: (d) => !!d.world?.flags?.veldanava_trial && ["rimuru_tempest", "benimaru", "shion", "shuna"].every((k) => (d.world?.chars?.[k]?.wins ?? 0) > 0) && Object.keys(d.world?.flags ?? {}).some((k) => k.startsWith("disc_")) },
  { id: "ascended_race", cat: "Evolução", name: "Forma Suprema", desc: "Alcance o estágio final da raça.", title: "Forma Suprema", coins: 5000, check: (d) => /_(3[ab]|4)$/.test(d.raceStage) },
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

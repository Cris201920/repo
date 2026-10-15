// data/factions.js - MUNDO VIVO: facções, reputação, diplomacia, territórios, consequências de chefes. 100% em dados.
// Para criar uma facção: uma entrada em FACTIONS (+ relações em DIPLOMACY_BASE, regras em REP_KILL/BOSS_EFFECTS e NPCs em data/worldnpcs.js).
export const FACTIONS = {
  tempest: { id: "tempest", name: "Federação de Tempest", short: "Tempest", color: "§b", capital: "Cidade de Tempest",
    desc: "Nação de monstros e humanos de todas as raças, fundada por Rimuru Tempest. Pacífica, próspera e acolhedora, mas defende seus cidadãos com firmeza.",
    culture: "Cidade organizada, pedra clara e madeira, estandartes azuis, comércio livre.", ally: "Combate, magia, energia e cura.", enemies: "Hordas orcs e monstros." },
  dwarf: { id: "dwarf", name: "Reino Anão de Dwargon", short: "Anões", color: "§6", capital: "Fortaleza de Dwargon",
    desc: "Reino subterrâneo de ferreiros e engenheiros. Orgulhosos, desconfiados de forasteiros e donos da melhor forja do mundo.",
    culture: "Fortaleza de pedra escura e ferro, forjas, minas e lanternas, estandartes laranja.", ally: "Forja, equipamentos raros e técnicas defensivas.", enemies: "Quem ameaça as minas." },
  guy: { id: "guy", name: "Domínio de Guy Crimson", short: "Guy Crimson", color: "§c", capital: "Cidadela Carmesim",
    desc: "O território do Rei Demônio mais antigo. Soldados disciplinados, servos leais e uma política fria: só o poder é respeitado.",
    culture: "Fortaleza de basalto negro e tijolo vermelho, brasas e estandartes rubros.", ally: "Habilidades raríssimas e magia poderosa.", enemies: "Os fracos e os traidores." },
  orc: { id: "orc", name: "Horda do Orc do Desastre", short: "Orcs", color: "§2", capital: "Acampamento da Horda",
    desc: "Orcs liderados pelo temido Orc do Desastre: um exército faminto que devora o que derrota e cresce com isso.",
    culture: "Paliçadas de madeira bruta, fardos de feno e espinhos, estandartes verdes.", ally: "Fúria, absorção e resistência.", enemies: "Tempest e Anões." },
  hermit: { id: "hermit", name: "Mestres Errantes", short: "Mestres", color: "§d", capital: "Santuário Escondido",
    desc: "Mestres lendários que vivem longe das nações e só ensinam a quem provar valor.",
    culture: "Santuários isolados e silenciosos.", ally: "Habilidades lendárias.", enemies: "Ninguém." },
};
export const FACTION_LIST = Object.values(FACTIONS);
export const PLAYER_FACTIONS = ["tempest", "dwarf", "guy", "orc"];   // as que têm reputação do jogador

// faixas de reputação (rep de -1000 a 1000)
export const TIERS = [
  { min: -1e9, id: "enemy",    name: "Inimigo",   color: "§4" },
  { min: -500, id: "hostile",  name: "Hostil",    color: "§c" },
  { min: -150, id: "wary",     name: "Desconfiado", color: "§6" },
  { min: 0,    id: "neutral",  name: "Neutro",    color: "§7" },
  { min: 100,  id: "friendly", name: "Amigável",  color: "§a" },
  { min: 300,  id: "ally",     name: "Aliado",    color: "§b" },
  { min: 650,  id: "champion", name: "Campeão",   color: "§e" },
];
export const REP_MIN = -1000, REP_MAX = 1000, ALLY_AT = 300;
export function tierOf(rep) { let t = TIERS[0]; for (const x of TIERS) if (rep >= x.min) t = x; return t; }

// relações entre facções: -3 guerra, -2 hostil, -1 desconfiada, 0 neutra, 1 amigável, 2 aliada
export const RELATION_NAMES = { "-3": "Em guerra", "-2": "Hostil", "-1": "Desconfiada", "0": "Neutra", "1": "Amigável", "2": "Aliada" };
export const RELATION_COLORS = { "-3": "§4", "-2": "§c", "-1": "§6", "0": "§7", "1": "§a", "2": "§b" };
export const DIPLOMACY_BASE = [
  ["tempest", "dwarf", 1], ["tempest", "guy", 0], ["tempest", "orc", -3], ["tempest", "hermit", 1],
  ["dwarf", "guy", -1], ["dwarf", "orc", -2], ["dwarf", "hermit", 0],
  ["guy", "orc", -1], ["guy", "hermit", 0], ["orc", "hermit", -1],
];
// o jogador não pode ser aliado de duas facções que estão em guerra/hostis entre si
export const INCOMPATIBLE_AT = -2;

// quem ganha/perde reputação ao matar cada criatura (typeId)
const E = "etheria:";
export const REP_KILL = {
  [E + "orc"]: { tempest: 2, dwarf: 1, orc: -5 }, [E + "tt_orc_lord"]: { tempest: 6, dwarf: 3, orc: -10 }, [E + "tt_orc_disaster"]: { tempest: 10, dwarf: 4, orc: -20 }, [E + "goblin"]: { tempest: 1 }, [E + "hobgoblin"]: { tempest: 2 },
  [E + "skeleton_knight"]: { tempest: 1, dwarf: 1 }, [E + "dungeon_crawler"]: { dwarf: 2 }, [E + "drake_whelp"]: { tempest: 1, dwarf: 1 },
};
// dano em NPCs: facção do NPC -> penalidade (acerto, morte); aliados da facção também se incomodam (metade)
export const CRIME = { hit: -4, kill: -60, ally_share: 0.4 };
// guardas desconfiam/atacam conforme a faixa
export const GUARD_RULES = { warnBelow: -150, attackBelow: -500, damage: 3, every: 60 };

// consequências de derrotar chefes (key de data/bosses.js ou mob typeId)
export const BOSS_EFFECTS = {
  goblin_king: { rep: { tempest: 80, dwarf: 20 }, say: "Tempest agradece: o terror dos goblins acabou.", unlock: "road_dwarf", quests: ["tp_dwarf_envoy"] },
  void_lord: { rep: { tempest: 120, guy: 60, dwarf: 40 }, say: "O Vazio recuou. Até o Domínio Carmesim notou o seu feito.", unlock: "guy_notice", quests: ["gc_envoy_trial"], dipl: [["tempest", "guy", 1]] },
  ember_tyrant: { rep: { dwarf: 120, tempest: 80, orc: -30 }, say: "Os anões celebram: a brasa que ameaçava as minas foi apagada.", unlock: "dwarf_deep_forge", quests: ["dw_deep_forge"], dipl: [["tempest", "dwarf", 1]] },
  chronoa: { rep: { guy: 100, tempest: 100 }, say: "Derrotar a Senhora do Tempo chamou a atenção dos poderosos.", unlock: "hermit_time", quests: ["hm_legend_trial"] },
  [E + "tt_orc_disaster"]: { rep: { tempest: 200, dwarf: 80, orc: -200 }, say: "A Horda perdeu o seu líder. Tempest e Dwargon respiram aliviadas.", unlock: "orc_broken", quests: ["tp_orc_aftermath"], dipl: [["tempest", "dwarf", 2]] },
  [E + "guy_crimson"]: { rep: { guy: 150 }, say: "Guy Crimson o reconhece: poucos sobrevivem ao seu olhar.", unlock: "guy_respect", dipl: [] },
};

// territórios: posição relativa ao spawn do mundo (distância, ângulo em graus) e estilo da construção procedural. Tempest usa a cidade já existente (systems/tempest.js).
export const SETTLEMENTS = {
  dwargon: { id: "dwargon", faction: "dwarf", name: "Fortaleza de Dwargon", dist: 480, angle: 145, radius: 22, style: "dwarf", unlockFlag: null,
    npcs: [["dw_king", 0, -14], ["dw_guard", -4, 18], ["dw_guard", 4, 18], ["dw_guard", -18, 0], ["dw_guard", 18, 0], ["dw_smith", -8, -6], ["dw_merchant", 8, -6], ["dw_miner", -12, 8], ["dw_miner", 12, 8],
           ["dw_engineer", 12, -10], ["dw_weapon_master", -12, -10], ["dw_artisan", 0, 6], ["dw_tavern", 6, 10]] },
  crimson: { id: "crimson", faction: "guy", name: "Cidadela Carmesim", dist: 760, angle: 255, radius: 22, style: "guy", unlockFlag: null,
    npcs: [["gc_envoy", 0, -14], ["gc_soldier", -4, 18], ["gc_soldier", 4, 18], ["gc_soldier", -16, -2], ["gc_soldier", 16, -2], ["gc_merchant", 8, -5], ["gc_master", -9, -7], ["gc_servant", 0, 6], ["gc_servant", -6, 9]] },
  orc_camp: { id: "orc_camp", faction: "orc", name: "Acampamento da Horda", dist: 330, angle: 318, radius: 20, style: "orc", unlockFlag: null,
    npcs: [["orc_commander", 0, -12], ["orc_warrior", -4, 16], ["orc_warrior", 4, 16], ["orc_warrior", -14, 2], ["orc_warrior", 14, 2], ["orc_trader", 8, -4]], mobs: [["etheria:orc", 4]] },
  hermit: { id: "hermit", faction: "hermit", name: "Santuário do Mestre Lendário", dist: 940, angle: 70, radius: 12, style: "hermit", unlockFlag: null,
    npcs: [["hm_sage", 0, 0]] },
};
export const SETTLEMENT_LIST = Object.values(SETTLEMENTS);

// pontos extras de NPCs em Tempest (offsets a partir do centro da cidade, junto às praças já usadas pela cidade importada)
export const TEMPEST_EXTRA = [
  ["tp_leader", 0, -14], ["tp_guard", -3, 20], ["tp_guard", 3, 20], ["tp_guard", -19, 2], ["tp_guard", 19, 2], ["tp_guard", 0, -26], ["tp_merchant", 15, -11], ["tp_alchemist", -13, -11], ["tp_cook", 13, 13], ["tp_healer", -16, 13],
  ["tp_citizen", -9, -15], ["tp_citizen", 9, -15], ["tp_farmer", -15, 9], ["tp_messenger", 2, 16], ["tp_adventurer", 6, -21],
  ["tp_sword_master", -5, -25], ["tp_spear_master", 5, -25], ["tp_mage_master", -2, -29], ["tp_combat_master", 2, -29], ["tp_energy_master", -9, -22], ["tp_heal_master", 9, -22],
];

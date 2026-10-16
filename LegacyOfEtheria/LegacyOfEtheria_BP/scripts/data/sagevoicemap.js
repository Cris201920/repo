// data/sagevoicemap.js - qual áudio do pacote de vozes diz o NOME de cada habilidade/raça do addon (etheria.sage.skill.<clip> / etheria.sage.race.<clip>).
// Habilidades com o mesmo id do áudio não precisam estar aqui. Sem áudio = tempo reserva de 620 ms (mesmo comportamento do sistema de referência).
export const SKILL_CLIP = {
  absorb_dissolve: "absorb_and_dissolve", heat_sense: "sense_heat_source", noxious_breath: "poisonous_breath", paralyzing_breath: "paralysing_breath",
  range_barrier: "ranged_barrier", self_regen: "self_regeneration", regeneration: "self_regeneration", regen_infinite: "infinite_regeneration",
  thread_manip: "sticky_steel_thread", ultrasonic: "ultrasonic_waves", earth_manip: "earth_manipulation", gravity_manip: "gravity_manipulation",
  hydro_propulsion: "hydraulic_propulsion", molecular_manip: "molecular_manipulation", sage_extra: "sage", water_current: "water_current_control",
  water_manip: "water_manipulation", wind_manip: "wind_manipulation", thought_accel: "thought_acceleration", starving: "starved",
};
/** nomes falados das etapas do Sábio (evolução Sábio -> Grande Sábio -> Raphael) */
export const SAGE_CLIP = { "Sábio": "sage", "Grande Sábio": "great_sage", "Raphael": "raphael_wisdom", "Raphael, Rei da Sabedoria": "raphael_wisdom" };
export const RACE_CLIP = {
  human_1: "human", human_3b: "enlightened_human", slime_1: "slime", slime_2: "demon_slime", slime_3a: "god_slime",
  goblin_1: "goblin", goblin_3a: "hobgoblin", goblin_3b: "enlightened_hobgoblin", goblin_4: "hobgoblin_saint",
  demon_1: "lesser_daemon", demon_3a: "greater_daemon", demon_3b: "arch_daemon", demon_4: "daemon_lord",
  elf_1: "elf", elf_3a: "elf_saint", elf_3b: "enlightened_elf", angel_1: "angel", angel_3: "archangel", angel_5: "divine_angel",
  angel_f1: "fallen_angel", angel_f2: "fallen_angel", angel_f3: "fallen_angel", angel_f4: "fallen_angel", angel_f5: "fallen_angel",
  dragonoid_1: "dragonewt", dragonoid_3a: "ancient_dragon", dragonoid_3b: "dragon", beastkin_1: "beastfolk", beastkin_3a: "beast_lord",
  undead_1: "undead", undead_2a: "death_knight", undead_2b: "skeleton_mage", undead_3a: "wight_lord", undead_3b: "lich",
  ogre_1: "ogre", ogre_2: "spirit_oni", ogre_3: "kijin", lizard_1: "lizardman", lizard_3: "dragonewt",
  vampire_1: "vampire", vampire_2: "blood_noble", vampire_3: "vampire_lord", dwarf_1: "dwarf", dwarf_3: "dwarf_saint",
  ogre_4a: "kijin", ogre_4b: "kijin", lizard_4: "dragonewt", vampire_3b: "vampire_lord", vampire_4: "vampire_lord", dwarf_3b: "dwarf_saint",
};

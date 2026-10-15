// data/origins.js - SALA DE ORIGEM (primeiro spawn). Para adicionar uma região basta uma entrada em SPAWN_ORIGINS: a sala, os NPCs e o teleporte se ajustam sozinhos.
//   spawn: { dist, angle } = posição relativa ao spawn do mundo (graus; mesma convenção de data/factions.js SETTLEMENTS), ou { tempest: true } = a cidade de Tempest (systems/tempest.js).
//   npc:   typeId de um NPC já existente (o visual vem de tools/content.py); npcName: nome exibido acima dele.
//   place: a cidade/estrutura que É carregada antes do teleporte (nunca se teleporta para um lugar vazio):
//          "tempest" = a cidade de Tempest (tiles .mcstructure em systems/tempest.js); "settlement:<id>" = uma das cidades de data/factions.js SETTLEMENTS;
//          "city:<id>" = uma cidade de REGION_CITIES abaixo (construída uma vez, com a mesma planta procedural das vilas).
//   Ajuste dist/angle para o lugar real de cada região; o sistema não depende de coordenadas fixas no código.
export const ORIGIN_ROOM = { x: 0, y: 250, z: 0, half: 12, ring: 8, tag: "etheria_origin", kv: "etheria:origin_room" };

export const SPAWN_ORIGINS = {
  cidade_gas: { id: "cidade_gas", name: "Cidade do Gás", npc: "etheria:npc_merchant", npcName: "Mercadora da Cidade do Gás", spawn: { dist: 120, angle: 0 }, place: "city:cidade_gas",
    ask: "Deseja começar sua jornada na Cidade do Gás?", desc: "Cidade de vapor e comércio: oficinas, mercados e guildas." },
  terras: { id: "terras", name: "Terras Selvagens", npc: "etheria:npc_trainer", npcName: "Guia das Terras Selvagens", spawn: { dist: 200, angle: 90 }, place: "city:terras",
    ask: "Deseja começar sua jornada nas terras selvagens?", desc: "Campos e florestas livres, cheias de monstros e recursos." },
  reinos: { id: "reinos", name: "Reinos", npc: "etheria:npc_master", npcName: "Arauto dos Reinos", spawn: { dist: 160, angle: 200 }, place: "settlement:dwargon",
    ask: "Deseja começar sua jornada em um dos reinos?", desc: "Cortes, estradas e nobres: o caminho para as grandes cidades." },
  tempest: { id: "tempest", name: "Tempest", npc: "etheria:npc_tp_leader", npcName: "Líder de Tempest", spawn: { tempest: true }, place: "tempest",
    ask: "Deseja começar sua jornada em Tempest, a cidade onde monstros e humanos vivem em paz?", desc: "A cidade de Rimuru: monstros e humanos convivendo." },
  demonios: { id: "demonios", name: "Território Demoníaco", npc: "etheria:npc_orc_commander", npcName: "Emissário Demoníaco", spawn: { dist: 560, angle: 20 }, place: "settlement:crimson",
    ask: "Deseja começar sua jornada no território demoníaco?", desc: "Chamas e sombras: poder para quem não tem medo de Lord Demônios." },
  dragoes: { id: "dragoes", name: "Território dos Dragões", npc: "etheria:npc_hm_sage", npcName: "Sábio Ancestral", spawn: { dist: 700, angle: 110 }, place: "settlement:hermit",
    ask: "Deseja começar sua jornada no território dos dragões?", desc: "Montanhas antigas onde os dragões guardam a linhagem primordial." },
};
export const ORIGIN_LIST = Object.values(SPAWN_ORIGINS);

// Cidades que não existem em data/factions.js: construídas com a planta procedural (systems/settlements.js). Mesmo formato de SETTLEMENTS.
export const REGION_CITIES = {
  cidade_gas: { id: "cidade_gas", name: "Cidade do Gás", faction: "dwarf", style: "dwarf", dist: 120, angle: 0, radius: 22,
    npcs: [["merchant", 0, -14], ["smith", -8, -6], ["guild", 8, -6], ["quest", 0, 8]], mobs: [] },
  terras: { id: "terras", name: "Acampamento das Terras Selvagens", faction: "hermit", style: "hermit", dist: 200, angle: 90, radius: 18,
    npcs: [["trainer", 0, -10], ["quest", -6, 4], ["merchant", 6, 4]], mobs: [] },
};

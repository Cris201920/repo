// data/regionbosses.js - 8.7 (Etapa 7a): PERFIS DE BATALHA dos chefes por região (entidades geradas por tools/region_bosses.py).
// Mesmo formato do D de bossprofiles2.js: id -> [nome, cor, tier, aura, fala, mecânica, assinatura[], minion|null, [listas por fase], [nomes das fases], [msgs]]
// As habilidades são ids reais de mobai.js / bossabilities.js. Região/nível mínimo ficam em mobs.gen.js (campos region/minLv).
export const REGION_D = {
  // ---- Vazio (End): Dragão do Vazio + Cavaleiro do Vazio + Rainha do Vazio (+ o Senhor do Vazio de data/bosses.js)
  void_dragon: ["Dragão do Vazio", "§5", 3, "void", "O Vazio devora estrelas... e devorará você.", "Sopro do Vazio, gravidade e Chuva do Abismo; na fase final a gravidade colapsa e cai a Bomba Dracônica.",
    ["abyss_rain", "dragon_nuke"], null,
    [["breath", "bite", "tail_sweep", "claw"], ["breath", "gravity", "abyss_rain", "tail_sweep", "roar"], ["dragon_nuke", "abyss_rain", "gravity_collapse", "breath", "heal_self"]],
    ["Fenda", "Abismo", "Colapso"], ["§5O Dragão do Vazio rasga o céu!", "§5O Vazio entra em colapso!"]],
  void_knight: ["Cavaleiro do Vazio", "§5", 2, "void", "Minha lâmina dourada corta até o nada.", "Investidas e cortes em sequência; prende com correntes sombrias e some pelo Vazio.",
    ["dash_barrage", "crimson_lance"], null,
    [["charge", "halberd_sweep", "blink"], ["shadow_bind", "charge", "halberd_sweep", "dash_barrage"], ["crimson_lance", "dash_barrage", "blink", "shadow_bind", "heal_self"]],
    ["Sentinela", "Lâmina Dourada", "Execução"], ["§5O cavaleiro ergue a espada dourada!", "§5O Cavaleiro do Vazio não recua mais!"]],
  void_queen: ["Rainha do Vazio", "§d", 3, "void", "Ajoelhe-se: o Vazio tem uma rainha.", "Fios de marionete, Chuva do Abismo e Colheita de Almas; convoca rastejadores do Vazio.",
    ["puppet_strings", "abyss_rain", "soul_harvest", "summon_minions"], "etheria:dungeon_crawler",
    [["dark_bolt", "blink", "gravity"], ["puppet_strings", "abyss_rain", "dark_bolt", "summon_minions"], ["soul_harvest", "abyss_rain", "puppet_strings", "gravity", "heal_self"]],
    ["Coroa", "Marionetes", "Eclipse do Vazio"], ["§dA rainha puxa os fios!", "§dO eclipse do Vazio cobre tudo!"]],
  // ---- Inferno: Anjo Caído
  fallen_angel: ["Anjo Caído", "§4", 3, "blood", "O céu me expulsou. O Inferno me coroou.", "Lança Carmesim, pilares de chama negra e Chuva Rubra; colhe almas para se curar.",
    ["crimson_lance", "inferno_pillars", "red_rain", "soul_harvest"], null,
    [["dark_bolt", "fire_wave", "blink"], ["crimson_lance", "inferno_pillars", "fire_wave", "blink"], ["red_rain", "soul_harvest", "crimson_lance", "inferno_pillars", "heal_self"]],
    ["Queda", "Chama Negra", "Coroa do Inferno"], ["§4As asas negras se abrem em brasa!", "§4O Anjo Caído clama pelo Inferno!"]],
  // ---- Mundo normal: Anjo Guardião (domo e escudo de guardiões em systems/regionbosses.js)
  angel_guardian: ["Anjo Guardião", "§e", 2, "gold", "Esta terra está sob a minha guarda.", "Domo de proteção (absorção + resistência por 15 s, recarga 20 s); fica invulnerável enquanto os anjos guardiões viverem; não se afasta mais de 48 blocos do posto.",
    ["holy_cross", "judgement"], null,
    [["holy_ray", "blink", "slam"], ["judgement", "holy_ray", "blink"], ["holy_cross", "judgement", "holy_ray", "heal_self"]],
    ["Vigia", "Sentença", "Luz Colossal"], ["§eO guardião pronuncia a sentença!", "§eA luz colossal desce do céu!"]],
  // ---- Oceano: Guardiã Cristalina com o Tridente dos Dragões Marinhos
  crystal_tide: ["Guardiã Cristalina das Marés", "§b", 2, "ice", "As marés obedecem ao meu tridente.", "Lâminas d'água e redemoinho; a Prisão de Água prende quem foge e o tridente chama o tsunami.",
    ["maelstrom", "water_prison", "tsunami"], null,
    [["water_blade", "tide", "blink"], ["maelstrom", "water_blade", "tide", "water_prison"], ["tsunami", "maelstrom", "water_prison", "water_blade", "heal_self"]],
    ["Maré", "Redemoinho", "Tsunami de Cristal"], ["§bO redemoinho de cristal se forma!", "§bO tridente chama o TSUNAMI!"]],
};

// Anjo Guardião: domo e posto
export const GUARDIAN = { leash: 48, domeSec: 15, domeCd: 20, minions: ["etheria:pico", "etheria:gracia"], minionCap: 3, resummon: 900, aggro: 24 };
// Rei Goblin: escolta que nasce junto e o protege (dano reduzido enquanto ela estiver perto)
export const ESCORT = { goblins: 4, captains: 2, range: 14, follow: 18, captainName: "§6Capitão Goblin" };

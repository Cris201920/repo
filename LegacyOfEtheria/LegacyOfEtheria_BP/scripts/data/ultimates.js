// data/ultimates.js - 6.81: as 12 SKILLS ULTIMATE (adaptações inspiradas em Tensura; nomes como referência de design, efeitos originais do addon).
// Todas usam exec.kind "ultimate" (systems/ultimates.js): coreografia em fases (preparação, acumulação, lançamento, impacto, dissipação)
// com o MESMO dano/mana/recarga do sistema de habilidades. Liberação: tabela ULT_UNLOCKS (evolução de raça, linhagem, chefes, árvore de poder)
// e a sorte do Predador (systems/slimeform.js) — sem sistema paralelo de progressão.
const U = (id, o) => ({ id, type: "active", sp: 0, req: [], cat: "Ultimate", rarity: "divine", level: 60, ...o, exec: { kind: "ultimate", stat: "intelligence", ...o.exec } });
export const ULTIMATES = [
  U("ult_azathoth", { name: "Azathoth, Deus do Vazio", element: "void", mana: 220, cd: 150, level: 90,
    desc: "Abre uma dimensão de vazio no alvo que puxa e consome tudo, absorve a energia dos atingidos e termina com uma esfera de energia que distorce o espaço.",
    exec: { range: 32, radius: 12, power: 7.5, snd: "mob.wither.spawn" } }),
  U("ult_shub_niggurath", { name: "Shub-Niggurath, Deus da Colheita", element: "arcane", mana: 200, cd: 140, level: 85,
    desc: "Três círculos de criação invocam uma chuva de armas sobre os inimigos e recriam até três habilidades suas, sem custo.",
    exec: { range: 24, radius: 14, power: 1.1, copies: 3, snd: "block.enchanting_table.use" } }),
  U("ult_uriel", { name: "Uriel, Senhor dos Votos", element: "holy", mana: 180, cd: 120, level: 80,
    desc: "Ergue uma barreira gigantesca (16 blocos) por 10 s: aliados dentro ganham barreira, inimigos ficam lentos; o alvo é selado numa prisão dimensional.",
    exec: { range: 28, radius: 16, power: 1.6, sec: 10, snd: "beacon.activate" } }),
  U("ult_raphael", { name: "Raphael, Senhor da Sabedoria", element: "arcane", mana: 120, cd: 90, level: 75,
    desc: "Análise automática de todos os inimigos (vida, ameaça), aceleração do pensamento (inimigos em câmera lenta) e magias aprimoradas por 20 s.",
    exec: { range: 24, radius: 22, power: 0.6, sec: 20, snd: "beacon.power_select" } }),
  U("ult_faust", { name: "Faust (Veldora), Senhor da Investigação", element: "lightning", mana: 210, cd: 140, level: 85,
    desc: "Tempestade dracônica de 8 s ao redor (raios, ventos e chuva) e golpe final: um raio de energia dracônica que atravessa o campo de batalha.",
    exec: { range: 40, radius: 14, power: 6, sec: 8, snd: "ambient.weather.thunder" } }),
  U("ult_satanael", { name: "Satanael, Senhor da Ira", element: "fire", mana: 230, cd: 160, level: 90,
    desc: "Acumula a ira por 3 s numa esfera de destruição que cresce acima de você e a lança: explosão cinematográfica com várias ondas de choque.",
    exec: { range: 30, radius: 14, power: 8, snd: "random.explode" } }),
  U("ult_lucifer", { name: "Lucifer, Senhor do Orgulho", element: "shadow", mana: 190, cd: 130, level: 85,
    desc: "Aura demoníaca que distorce o ar, três clones mágicos que disparam energia demoníaca e a cópia da sua habilidade mais forte, sem custo.",
    exec: { range: 26, radius: 18, power: 1.2, sec: 6, snd: "mob.evocation_illager.prepare_summon" } }),
  U("ult_metatron", { name: "Metatron, Senhor da Pureza", element: "light", mana: 200, cd: 140, level: 85,
    desc: "Dezenas de lanças de luz surgem no céu e caem sobre os inimigos; termina numa grande explosão luminosa que cura os aliados.",
    exec: { range: 30, radius: 18, power: 1.0, lances: 24, snd: "beacon.power_select" } }),
  U("ult_cthugha", { name: "Cthugha, Senhor das Chamas", element: "fire", mana: 210, cd: 140, level: 85,
    desc: "Forma de fogo por 10 s (queima tudo ao redor), uma coluna de chamas colossal no alvo e uma chuva de meteoros flamejantes.",
    exec: { range: 30, radius: 12, power: 1.4, meteors: 10, sec: 10, snd: "mob.blaze.shoot" } }),
  U("ult_michael", { name: "Michael, Senhor da Justiça", element: "holy", mana: 200, cd: 140, level: 90,
    desc: "Correntes de luz e selos prendem todos os inimigos ao redor (paralisia) dentro de um grande campo de contenção por 8 s.",
    exec: { range: 24, radius: 16, power: 1.8, sec: 8, snd: "random.anvil_land" } }),
  U("ult_hastur", { name: "Hastur, Senhor da Dominação", element: "arcane", mana: 180, cd: 120, level: 80,
    desc: "Campo de dominação de 16 blocos por 8 s: ondas de energia periódicas empurram e aterrorizam os inimigos; a última onda é devastadora.",
    exec: { range: 20, radius: 16, power: 0.8, sec: 8, snd: "mob.warden.sonic_boom" } }),
];
// Liberação (verificada a cada 5 s em systems/ultimates.js). Campos: race/races, lord, stage, level, skill(s), lin+lform, boss, sage (estágio do Sábio), devoured.
export const ULT_UNLOCKS = {
  ult_azathoth:       { races: ["slime"], lord: true, level: 90, skill: "beelzebuth", why: "Slime Lorde Demônio, nível 90, com Beelzebuth" },
  ult_shub_niggurath: { level: 85, skillsAny: ["creator", "creation"], why: "nível 85 com uma habilidade de criação" },
  ult_uriel:          { level: 80, skillsAny: ["barrier", "range_barrier", "divine_shield"], lord: true, why: "Lorde Demônio nível 80 com uma barreira" },
  ult_raphael:        { level: 75, sage: 3, why: "nível 75 com o Sábio evoluído a Raphael" },
  ult_faust:          { level: 85, lin: "veldora", lform: "true", why: "linhagem Veldora em forma verdadeira, nível 85" },
  ult_satanael:       { races: ["demon", "ogre"], lord: true, level: 90, why: "Demônio ou Ogro Lorde Demônio, nível 90" },
  ult_lucifer:        { races: ["fallen", "fallen_lord", "vampire"], lord: true, level: 85, why: "Caído ou Vampiro Lorde Demônio, nível 85" },
  ult_metatron:       { races: ["angel_seraph", "angel_cherub", "angel_arch"], level: 85, why: "anjo superior (Arcanjo, Querubim ou Serafim), nível 85" },
  ult_cthugha:        { level: 85, skillsAny: ["black_flame", "hell_flare", "drago_nova"], why: "nível 85 com uma chama suprema" },
  ult_michael:        { level: 90, boss: "michael_manas", why: "derrotar Michael, nível 90" },
  ult_hastur:         { races: ["elf", "beastkin", "dragonoid", "lizardman", "dragonewt", "dragonewt_w"], lord: true, level: 85, why: "Lorde Demônio de elfo/fera/dragão, nível 85" },
};

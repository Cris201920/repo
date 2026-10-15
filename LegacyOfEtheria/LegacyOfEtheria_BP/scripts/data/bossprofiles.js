// data/bossprofiles.js - PERFIL DE BATALHA de cada boss (fases, habilidades por fase, mecânica única, minions, evolução).
// Chave = id do mob sem "etheria:". phases[i]: entra quando vida <= hp * máx (monótono: nunca volta atrás).
//   fx   efeitos permanentes da fase [[efeito, nível(1=I)]]     list  habilidades da fase (ids de systems/mobai.js ou systems/bossabilities.js)
//   gcd  multiplicador do intervalo entre ações (<1 = mais rápido)   dmg  multiplicador de dano das habilidades   minions {n, cap}
// mech = descrição da mecânica ÚNICA; sig = habilidades exclusivas deste boss.
// Os bosses de sigilo (Rei Goblin, Senhor do Vazio, Tirano Brasa) têm as fases em data/bosses.js; Chronoa tem sistema próprio (systems/chronoa.js).
const P = (hp, name, msg, list, o = {}) => ({ hp, name, msg, list, fx: o.fx ?? [], gcd: o.gcd ?? 1, dmg: o.dmg ?? 1, minions: o.minions ?? null });

export const PROFILES = {
  tt_orc_disaster: {
    name: "Orc do Desastre", color: "§2", tier: 2, intro: "§2§lO Orc do Desastre ergue o machado: \"FOME... TUDO SERÁ DEVORADO!\"",
    mech: "Devora criaturas (inclusive os seus invocados) e evolui de nível 1 a 4; invoca Mini Orcs que o protegem.", minion: "etheria:mini_orc",
    evo: { xp: [0, 120, 320, 650], each: 150, healPct: 0.05, abilities: { 2: ["ground_pound"], 3: ["rampage"], 4: ["calamity"] } },
    phases: [
      P(1.0, "Fome", "", ["summon_minions", "slam", "charge"], { minions: { n: 3, cap: 4 } }),
      P(0.70, "Fúria", "§c§lO Orc do Desastre entra em FÚRIA e urra por mais súditos!", ["summon_minions", "war_stomp", "charge", "slam", "roar"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.85, dmg: 1.15, minions: { n: 4, cap: 6 } }),
      P(0.40, "Voracidade", "§4§lO Orc do Desastre devora os próprios súditos para se curar!", ["devour_minion", "summon_minions", "war_stomp", "charge", "quake", "slam"], { fx: [["speed", 1], ["strength", 2]], gcd: 0.7, dmg: 1.3, minions: { n: 5, cap: 8 } }),
      P(0.15, "Calamidade", "§4§lCALAMIDADE! O Orc do Desastre assume a forma final!", ["rampage", "devour_minion", "summon_minions", "war_stomp", "quake"], { fx: [["speed", 2], ["strength", 2], ["resistance", 1]], gcd: 0.55, dmg: 1.5, minions: { n: 6, cap: 10 } }),
    ],
  },
  tt_charybdis: {
    name: "Charybdis", color: "§3", tier: 2, intro: "§3§lO mar ruge: Charybdis emerge do redemoinho!", mech: "Maelstrom: redemoinho que puxa e fere; Tsunami em leque.", sig: ["maelstrom", "tsunami"],
    phases: [P(1.0, "Maré", "", ["water_blade", "tide", "slam"]), P(0.65, "Correnteza", "§b§lO redemoinho se forma!", ["maelstrom", "tide", "water_blade", "slam"], { fx: [["speed", 1]], gcd: 0.85, dmg: 1.1 }),
      P(0.30, "Tsunami", "§9§lCharybdis invoca um TSUNAMI!", ["tsunami", "maelstrom", "tide", "water_blade"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.7, dmg: 1.25 })],
  },
  guy_crimson: {
    name: "Guy Crimson", color: "§c", aura: "blood", tier: 3, intro: "§c§lGuy Crimson: \"Ajoelhem-se diante do Rei Demônio mais antigo.\"", mech: "Domínio Carmesim: zona que drena e enfraquece; Pressão do Rei Demônio paralisa; Nova Carmesim e Chuva Rubra punem quem fica parado.", sig: ["crimson_domain", "overlord_aura", "crimson_nova", "red_rain"],
    phases: [P(1.0, "Rei Demônio", "", ["shadow_bind", "fire_wave", "blink", "crimson_lance"], { fx: [["resistance", 1]] }),
      P(0.65, "Domínio", "§4§lGuy estende o DOMÍNIO CARMESIM!", ["crimson_domain", "crimson_nova", "gravity", "shadow_bind", "fire_wave", "blink"], { fx: [["speed", 1], ["strength", 1], ["resistance", 1]], gcd: 0.8, dmg: 1.2 }),
      P(0.30, "Opressão", "§c§lA presença de Guy esmaga o ar: o céu sangra!", ["overlord_aura", "red_rain", "crimson_nova", "crimson_domain", "gravity", "blink", "heal_self"], { fx: [["speed", 2], ["strength", 2], ["resistance", 2]], gcd: 0.6, dmg: 1.4 })],
  },
  milim_nava: {
    name: "Milim Nava", color: "§d", aura: "pink", tier: 3, intro: "§d§lMilim: \"Haha! Vamos brincar!\"", mech: "Frenesi da Destruidora: fica mais rápida a cada fase; Dragon Nuke rosa telegrafado; Chuva de Esferas e investidas em sequência.", sig: ["dragon_nuke", "dash_barrage", "pink_barrage"],
    phases: [P(1.0, "Brincadeira", "", ["charge", "slam", "roar", "dash_barrage"], { fx: [["resistance", 1]] }),
      P(0.70, "Empolgação", "§d§lMilim se anima: \"Agora sim!\"", ["dash_barrage", "pink_barrage", "breath", "charge", "slam"], { fx: [["speed", 1], ["strength", 1], ["resistance", 1]], gcd: 0.8, dmg: 1.2 }),
      P(0.40, "Destruição", "§d§lMilim carrega o DRAGON NUKE!", ["dragon_nuke", "pink_barrage", "dash_barrage", "fire_wave", "breath", "roar"], { fx: [["speed", 1], ["strength", 2], ["resistance", 2]], gcd: 0.65, dmg: 1.35 }),
      P(0.15, "Fúria Total", "§5§lMilim está falando sério!", ["dragon_nuke", "pink_barrage", "dash_barrage", "breath", "heal_self"], { fx: [["speed", 2], ["strength", 3], ["resistance", 2]], gcd: 0.5, dmg: 1.55 })],
  },
  diablo: {
    name: "Diablo", color: "§8", tier: 2, intro: "§8§lDiablo: \"Kufufufu... que presa interessante.\"", mech: "Marionetes: prende o alvo em fios sombrios; Chuva do Abismo pune quem fica parado.", sig: ["puppet_strings", "abyss_rain"],
    phases: [P(1.0, "Mordomo", "", ["shadow_bind", "dark_bolt", "blink"]), P(0.6, "Marionetista", "§5§lFios sombrios cercam você!", ["puppet_strings", "abyss_rain", "blink", "dark_bolt"], { fx: [["speed", 1]], gcd: 0.8, dmg: 1.15 }),
      P(0.25, "Primordial", "§8§lDiablo revela o seu poder verdadeiro!", ["abyss_rain", "puppet_strings", "gravity", "blink", "heal_self"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.6, dmg: 1.3 })],
  },
  testarossa: {
    name: "Testarossa", color: "§c", tier: 2, intro: "§c§lTestarossa: \"Eu serei breve, e você será cinzas.\"", mech: "Lança Carmesim atravessa em linha; Pacto de Sangue cura nela a cada jogador atingido.", sig: ["crimson_lance", "blood_pact"],
    phases: [P(1.0, "Marquesa", "", ["fire_wave", "blink", "breath"]), P(0.6, "Lança", "§c§lLanças carmesim surgem!", ["crimson_lance", "fire_wave", "blink", "breath"], { fx: [["speed", 1]], gcd: 0.8, dmg: 1.15 }),
      P(0.25, "Pacto", "§4§lO sangue é o seu pagamento!", ["blood_pact", "crimson_lance", "fire_wave", "heal_self"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.6, dmg: 1.3 })],
  },
  ultima: {
    name: "Ultima", color: "§5", tier: 2, intro: "§5§lUltima: \"Vou apagar você com um sorriso!\"", mech: "Barragem de Lasers do céu, telegrafada por círculos no chão.", sig: ["laser_barrage"],
    phases: [P(1.0, "Sorridente", "", ["arcane_burst", "blink", "gravity"]), P(0.6, "Lasers", "§d§lLasers caem do céu!", ["laser_barrage", "arcane_burst", "gravity", "blink"], { fx: [["speed", 1]], gcd: 0.8, dmg: 1.15 }),
      P(0.25, "Sobrecarga", "§5§lUltima sobrecarrega!", ["laser_barrage", "gravity", "arcane_burst", "heal_self"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.6, dmg: 1.3 })],
  },
  carrera: {
    name: "Carrera", color: "§e", tier: 2, intro: "§e§lCarrera: \"Vou te cortar antes que você pisque.\"", mech: "Lâminas de Vento em sequência e Chute Tempestade com teleporte triplo.", sig: ["wind_blades", "triple_kick"],
    phases: [P(1.0, "Gentil", "", ["gale", "leap", "blink"]), P(0.6, "Lâminas", "§e§lO vento afia!", ["wind_blades", "gale", "blink", "leap"], { fx: [["speed", 1]], gcd: 0.8, dmg: 1.15 }),
      P(0.25, "Tempestade", "§6§lCarrera desaparece no vento!", ["triple_kick", "wind_blades", "gale", "heal_self"], { fx: [["speed", 2], ["strength", 1]], gcd: 0.55, dmg: 1.3 })],
  },
  rain: {
    name: "Rain", color: "§9", tier: 2, intro: "§9§lRain: \"As águas lembram de tudo.\"", mech: "Maré Viva puxa e fere em área; Escudo de Água absorve golpes.", sig: ["water_shield", "tidal_pull"],
    phases: [P(1.0, "Calma", "", ["water_blade", "tide", "blink"]), P(0.6, "Maré Viva", "§b§lA maré sobe!", ["tidal_pull", "water_blade", "tide", "blink"], { fx: [["speed", 1]], gcd: 0.8, dmg: 1.15 }),
      P(0.25, "Dilúvio", "§9§lUm dilúvio cai!", ["water_shield", "tidal_pull", "water_blade", "heal_self"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.6, dmg: 1.3 })],
  },
  rimuru_senhor_demonio: {
    name: "Rimuru, Senhor Demônio", color: "§b", aura: "sage", tier: 3, intro: "§b§lRimuru: \"Vamos ver até onde vai a sua força.\"", mech: "FORMA FINAL: Divisão Slime, Barreira do Grande Sábio, Predador Supremo (puxa e drena em área), Megiddo (raios em área) e Ondas Soberanas.", minion: "etheria:arcane_slime", sig: ["slime_split", "sage_barrier", "predator_maw", "megiddo", "sovereign_wave"],
    phases: [P(1.0, "Calmo", "", ["water_blade", "tide", "blink", "megiddo"], { fx: [["resistance", 1]] }),
      P(0.70, "Divisão", "§b§lRimuru se divide em slimes e as asas de slime se abrem!", ["slime_split", "sovereign_wave", "water_blade", "gravity", "blink", "megiddo"], { fx: [["speed", 1], ["strength", 1], ["resistance", 1]], gcd: 0.8, dmg: 1.2, minions: { n: 2, cap: 4 } }),
      P(0.40, "Grande Sábio", "§3§lO Grande Sábio assume o controle: PREDADOR SUPREMO!", ["sage_barrier", "predator_maw", "megiddo", "sovereign_wave", "slime_split", "gravity", "heal_self"], { fx: [["speed", 1], ["strength", 2], ["resistance", 2]], gcd: 0.65, dmg: 1.35, minions: { n: 3, cap: 5 } }),
      P(0.15, "Senhor Demônio", "§9§lA FORMA FINAL! Rimuru libera todo o seu poder!", ["predator_maw", "megiddo", "sovereign_wave", "sage_barrier", "blink", "heal_self"], { fx: [["speed", 2], ["strength", 3], ["resistance", 2]], gcd: 0.5, dmg: 1.55, minions: { n: 3, cap: 6 } })],
  },
  michael_manas: {
    name: "Michael", color: "§f", tier: 2, intro: "§f§lMichael: \"Em nome da luz, eu o julgo.\"", mech: "Colunas de Julgamento (telegrafadas) e Barreira Sagrada que repele.", sig: ["judgement", "holy_barrier"],
    phases: [P(1.0, "Sentinela", "", ["holy_ray", "blink", "blood_bind"]), P(0.6, "Julgamento", "§e§lColunas de luz descem!", ["judgement", "holy_ray", "blink"], { fx: [["speed", 1]], gcd: 0.8, dmg: 1.15 }),
      P(0.25, "Descida", "§f§lA luz o consome!", ["holy_barrier", "judgement", "holy_ray", "heal_self"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.6, dmg: 1.3 })],
  },
  luminous_valentine: {
    name: "Luminous Valentine", color: "§e", tier: 2, intro: "§e§lLuminous: \"Você não tem lugar neste mundo.\"", mech: "Cruz Sagrada atravessa em duas linhas; Marca do Pecador aumenta o dano da cruz.", sig: ["holy_cross", "sin_mark"],
    phases: [P(1.0, "Rainha Vampira", "", ["holy_ray", "blood_bind", "blink"]), P(0.6, "Cruz", "§e§lA Cruz Sagrada se ergue!", ["holy_cross", "holy_ray", "blood_bind", "blink"], { fx: [["speed", 1]], gcd: 0.8, dmg: 1.15 }),
      P(0.25, "Pecado", "§6§lVocê foi marcado!", ["sin_mark", "holy_cross", "holy_ray", "heal_self"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.6, dmg: 1.3 })],
  },
  demon_lord_returner: {
    name: "Senhor Demônio Retornado", color: "§4", tier: 2, intro: "§4§lO Senhor Demônio Retornado desperta: \"Almas... preciso de almas.\"", mech: "Colheita de Almas cura nele; Horda Demoníaca invoca imps.", minion: "etheria:imp", sig: ["soul_harvest", "demon_horde"],
    phases: [P(1.0, "Retornado", "", ["dark_bolt", "blink", "fire_wave"]), P(0.6, "Colheita", "§4§lAlmas são ceifadas!", ["soul_harvest", "dark_bolt", "blink", "fire_wave"], { fx: [["speed", 1]], gcd: 0.8, dmg: 1.15 }),
      P(0.25, "Horda", "§c§lUma horda de demônios é chamada!", ["demon_horde", "soul_harvest", "fire_wave", "heal_self"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.6, dmg: 1.3, minions: { n: 3, cap: 5 } })],
  },
  rimuru_ogre_fight: {
    name: "Rimuru (Luta do Ogro)", color: "§b", aura: "sage", tier: 3, intro: "§b§lRimuru: \"Eu não vou recuar.\"", mech: "Prisão de Água prende e desacelera; Barreira do Grande Sábio absorve; Divisão Slime e Predador na fase final.", sig: ["water_prison"],
    phases: [P(1.0, "Teste", "", ["water_blade", "tide", "blink"], { fx: [["resistance", 0]] }),
      P(0.65, "Prisão", "§b§lUma prisão de água se fecha!", ["water_prison", "water_blade", "tide", "blink", "heal_self"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.8, dmg: 1.2 }),
      P(0.35, "Grande Sábio", "§b§lO Grande Sábio assume o combate!", ["sage_barrier", "slime_split", "water_prison", "water_blade", "blink", "heal_self"], { fx: [["speed", 1], ["strength", 2], ["resistance", 1]], gcd: 0.65, dmg: 1.35 }),
      P(0.15, "Predador", "§9§lPredador! A água engole tudo!", ["predator_maw", "slime_split", "sage_barrier", "water_prison", "heal_self"], { fx: [["speed", 2], ["strength", 2], ["resistance", 2]], gcd: 0.5, dmg: 1.5 })],
  },
  taratect_orthocadinaht_kumo: {
    name: "Orthocadinaht", color: "§8", tier: 2, intro: "§8§lOrthocadinaht: as teias vibram...", mech: "Teia Armadilha lenta e envenena quem pisa; Enxame de aranhas.", minion: "etheria:tt_black_spider", sig: ["web_trap", "spider_swarm"],
    phases: [P(1.0, "Caçadora", "", ["web_shot", "pounce"]), P(0.6, "Teia", "§8§lO chão vira teia!", ["web_trap", "web_shot", "pounce"], { fx: [["speed", 1]], gcd: 0.8, dmg: 1.15 }),
      P(0.25, "Enxame", "§8§lO enxame desperta!", ["spider_swarm", "web_trap", "pounce", "heal_self"], { fx: [["speed", 1], ["strength", 1]], gcd: 0.6, dmg: 1.3, minions: { n: 3, cap: 6 } })],
  },
  // Dragões Verdadeiros — DOIS ESTÁGIOS: 1) forma humanoide (100%); 2) Dragão Verdadeiro (<= 65% da vida, transformação única em systems/truedragon.js); fase final (<= 30%).
  // Voo e golpes de dragão ficam em truedragon.js/mobai.js; aqui entram as fases, o aura e o golpe exclusivo (a partir do estágio 2).
  veldora: { name: "Veldora", color: "§5", aura: "bolt", tier: 3, dragon: true, intro: "§5§lVeldora: \"Kwahahaha! Que a tempestade o receba!\"", mech: "Domínio da Tempestade: raios do céu em área. Aos 65% revela a forma de Dragão Verdadeiro.", sig: ["storm_domain"],
    phases: [P(1.0, "Estágio 1: Tempestade", "", [], { fx: [["resistance", 1]] }), P(0.65, "Estágio 2: Dragão", "§5§lVeldora ruge: o céu escurece e a verdadeira forma desperta!", [], { fx: [["speed", 1], ["strength", 1], ["resistance", 2]], gcd: 0.8, dmg: 1.25 }), P(0.30, "Cataclismo", "§d§lA TEMPESTADE DE VELDORA!", [], { fx: [["speed", 1], ["strength", 2], ["resistance", 2]], gcd: 0.6, dmg: 1.45 })] },
  velzard: { name: "Velzard", color: "§b", aura: "ice", tier: 3, dragon: true, intro: "§b§lVelzard: \"Que o silêncio do gelo o envolva.\"", mech: "Zero Absoluto: congela quem estiver perto. Aos 65% revela a forma de Dragão Verdadeiro.", sig: ["absolute_zero"],
    phases: [P(1.0, "Estágio 1: Gelo", "", [], { fx: [["resistance", 1]] }), P(0.65, "Estágio 2: Dragão", "§b§lA nevasca engole o campo: Velzard assume a forma de Dragão!", [], { fx: [["speed", 1], ["strength", 1], ["resistance", 2]], gcd: 0.8, dmg: 1.25 }), P(0.30, "Zero", "§3§lZERO ABSOLUTO!", [], { fx: [["speed", 1], ["strength", 2], ["resistance", 2]], gcd: 0.6, dmg: 1.45 })] },
  velgrynd: { name: "Velgrynd", color: "§c", aura: "fire", tier: 3, dragon: true, intro: "§c§lVelgrynd: \"Vamos ver se você sobrevive ao meu fogo.\"", mech: "Pilares de Inferno surgem sob os pés. Aos 65% revela a forma de Dragão Verdadeiro.", sig: ["inferno_pillars"],
    phases: [P(1.0, "Estágio 1: Brasa", "", [], { fx: [["resistance", 1]] }), P(0.65, "Estágio 2: Dragão", "§c§lO fogo carmesim se espalha: Velgrynd assume a forma de Dragão!", [], { fx: [["speed", 1], ["strength", 1], ["resistance", 2]], gcd: 0.8, dmg: 1.25 }), P(0.30, "Carmesim", "§4§lO FOGO CARMESIM!", [], { fx: [["speed", 1], ["strength", 2], ["resistance", 2]], gcd: 0.6, dmg: 1.45 })] },
  veldanava: { name: "Veldanava", color: "§6", aura: "gold", tier: 4, dragon: true, intro: "§6§lVeldanava: \"Poucos já viram a forma original.\"", mech: "Gênese: pilar de luz primordial telegrafado. Aos 65% revela a forma original; abaixo de 30% a Gênese se repete mais rápido.", sig: ["genesis"],
    phases: [P(1.0, "Estágio 1: Origem", "", [], { fx: [["resistance", 2]] }), P(0.65, "Estágio 2: Forma Original", "§6§lVeldanava cria e destrói: a forma original desperta!", [], { fx: [["speed", 1], ["strength", 2], ["resistance", 3]], gcd: 0.75, dmg: 1.3 }), P(0.30, "Gênese", "§e§lGÊNESE!", [], { fx: [["speed", 1], ["strength", 3], ["resistance", 3]], gcd: 0.55, dmg: 1.5 })] },
};
import { EXTRA } from "./bossprofiles2.js";
for (const [k, v] of Object.entries(EXTRA)) if (!PROFILES[k]) PROFILES[k] = v;
export const PROFILE_LIST = Object.keys(PROFILES);

// ---- 6.28: HIERARQUIA DE PODER (1 Inicial · 2 Intermediário · 3 Avançado · 4 Lendário · 5 Supremo). `tier` (mecânica antiga) continua; `rank` é a categoria
// única e consistente com a vida/dano reais do boss (que já inclui o reforço do build). Regra: faixas de vida, nunca abaixo do tier do perfil.
import { MOBS } from "./mobs.gen.js";
export const RANK_NAMES = ["", "Inicial", "Intermediário", "Avançado", "Lendário", "Supremo"];
export const RANK_HP = [0, 0, 300, 1000, 3000, 6500];   // vida mínima de cada categoria
export function rankOf(id, p = PROFILES[id]) {
  const hp = MOBS["etheria:" + id]?.hp ?? 0; let r = 1;
  for (let i = 1; i <= 5; i++) if (hp >= RANK_HP[i]) r = i;
  return Math.max(r, p?.tier >= 3 ? 3 : (p?.tier ?? 1));
}
for (const [k, p] of Object.entries(PROFILES)) p.rank = rankOf(k, p);

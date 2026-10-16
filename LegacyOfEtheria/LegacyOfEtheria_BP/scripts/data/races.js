// data/races.js - Raças e árvore de evolução. Para criar uma nova raça, adicione uma entrada em RACES
// com um estágio raiz (id terminando em _1) e seus estágios filhos (campo `from`).
//
// attrs  = bônus TOTAL de atributos naquele estágio (substitui o do estágio anterior; negativos = penalidade)
// stats  = bônus extras (ver STAT_LABELS em config.js)   skills = habilidades concedidas
// minLevel/cost/kills/boss/item = requisitos para evoluir PARA este estágio

const S = (id, name, from, o) => ({ id, name, from, minLevel: 1, cost: 0, attrs: {}, stats: {}, skills: [], ...o });

/** LORD DEMÔNIO PARA TODAS AS RAÇAS: cada estágio final (sem evolução seguinte) ganha a opção "Lord Demônio" (id <estágio>_ld), com os requisitos do Lord Demônio original
 *  (nível >= 80 e acima do estágio de origem, 15.000 moedas, 300 abates) e a habilidade lord_demon_dominion. Os atributos nunca ficam abaixo dos do estágio de origem.
 *  O Lord Demônio original (demon_4, a partir do Senhor Demoníaco) continua como está. */
export const isLordStage = (id) => id === "demon_4" || /_ld$/.test(id ?? "");
const LORD_ATTRS = { strength: 12, defense: 8, intelligence: 10, agility: 4, vitality: 9 };
function addLordStages(stages) {
  const leaves = stages.filter((s) => !isLordStage(s.id) && !stages.some((x) => x.from === s.id));
  for (const l of leaves) {
    const attrs = {}; for (const k of Object.keys(LORD_ATTRS)) attrs[k] = Math.max(l.attrs[k] ?? 0, LORD_ATTRS[k]);
    stages.push(S(`${l.id}_ld`, "Lord Demônio", l.id, { minLevel: Math.max(80, (l.minLevel ?? 1) + 5), cost: 15000, kills: 300, attrs, stats: { ...l.stats, hp: (l.stats?.hp ?? 0) + 30 }, skills: ["lord_demon_dominion"] }));
  }
}

function build(id, o, stages) {
  addLordStages(stages);
  const map = {};
  for (const s of stages) { s.race = id; map[s.id] = s; }
  for (const s of stages) s.next = stages.filter((x) => x.from === s.id).map((x) => x.id);
  // TRAÇOS RACIAIS: bônus próprios da raça, somados aos stats de CADA estágio e crescendo 40% por nível de evolução (o Slime não é igual ao Dragonoide).
  if (o.traits) for (const s of stages) {
    let depth = 0; for (let c = s; c.from; c = map[c.from]) depth++;
    const k = 1 + depth * 0.4, st = { ...s.stats };
    for (const [key, v] of Object.entries(o.traits)) st[key] = Math.round(((st[key] ?? 0) + v * k) * 10) / 10;
    s.stats = st;
  }
  return { id, ...o, root: stages[0].id, stages: map };
}

export const RACES = {
  human: build("human", { name: "Humano", color: "§f", desc: "Versáteis e adaptáveis. Aprendem rápido.", bonus: "+10% de XP, atributos equilibrados", penalty: "Nenhum destaque natural" , traits: { xp: 10, crit: 2 }}, [
    S("human_1", "Humano", null, { attrs: { strength: 1, defense: 1, intelligence: 1, agility: 1, vitality: 1 }, skills: ["human_will"] }),
    S("human_2a", "Herói", "human_1", { minLevel: 25, cost: 800, attrs: { strength: 3, defense: 3, intelligence: 1, agility: 1, vitality: 2 }, skills: ["war_cry"] }),
    S("human_2b", "Sábio", "human_1", { minLevel: 25, cost: 800, attrs: { strength: 0, defense: 1, intelligence: 5, agility: 2, vitality: 1 }, skills: ["mana_flow"] }),
    S("human_3a", "Campeão Humano", "human_2a", { minLevel: 60, cost: 4000, attrs: { strength: 6, defense: 6, intelligence: 2, agility: 2, vitality: 5 }, skills: ["divine_shield"] }),
    S("human_3b", "Arquimago Humano", "human_2b", { minLevel: 60, cost: 4000, attrs: { strength: 0, defense: 2, intelligence: 10, agility: 3, vitality: 2 }, skills: ["mana_burst"] }),
  ]),
  slime: build("slime", { name: "Slime", color: "§b", desc: "Frágil no início, mas nasce com o Predador e o Great Sage. Devora para crescer.", bonus: "Predador, Mimetismo, +3 Inteligência", penalty: "Força e defesa baixas" , traits: { res_physical: 10, manaRegen: 15, res_magic: 5 }}, [
    S("slime_1", "Slime", null, { attrs: { strength: -2, defense: 0, intelligence: 3, agility: 1, vitality: 2 }, skills: ["predator"] }),
    S("slime_2", "Slime Demoníaco", "slime_1", { minLevel: 25, cost: 1000, attrs: { strength: 2, defense: 2, intelligence: 6, agility: 3, vitality: 4 }, skills: ["soul_drain"] }),
    S("slime_3a", "Slime Soberano", "slime_2", { minLevel: 55, cost: 5000, kills: 100, attrs: { strength: 6, defense: 6, intelligence: 10, agility: 4, vitality: 8 }, stats: { hp: 20 }, skills: ["barrier"] }),
    S("slime_3b", "Slime Sábio", "slime_2", { minLevel: 55, cost: 5000, attrs: { strength: 2, defense: 4, intelligence: 14, agility: 5, vitality: 5 }, skills: ["mana_burst"] }),
  ]),
  goblin: build("goblin", { name: "Goblin", color: "§a", desc: "Pequenos, ágeis e astutos. Crescem de forma impressionante.", bonus: "+3 Agilidade, +15% de moedas", penalty: "Pouca vida e defesa" , traits: { coin: 15, crit: 5, critDmg: 10 }}, [
    S("goblin_1", "Goblin", null, { attrs: { strength: -1, defense: -1, intelligence: 1, agility: 3, vitality: -1 }, skills: ["goblin_cunning"] }),
    S("goblin_2a", "Goblin Guerreiro", "goblin_1", { minLevel: 20, cost: 600, attrs: { strength: 3, defense: 1, intelligence: 0, agility: 4, vitality: 1 }, skills: ["dark_slash"] }),
    S("goblin_2b", "Goblin Xamã", "goblin_1", { minLevel: 20, cost: 600, attrs: { strength: 0, defense: 0, intelligence: 4, agility: 3, vitality: 0 }, skills: ["heal"] }),
    S("goblin_3a", "Hobgoblin", "goblin_2a", { minLevel: 45, cost: 3000, kills: 150, attrs: { strength: 6, defense: 4, intelligence: 0, agility: 3, vitality: 4 }, skills: ["war_cry"] }),
    S("goblin_3b", "Goblin Arcano", "goblin_2b", { minLevel: 45, cost: 3000, kills: 150, attrs: { strength: 0, defense: 1, intelligence: 8, agility: 4, vitality: 1 }, skills: ["lightning"] }),
    S("goblin_4", "Rei Goblin", "goblin_3a", { minLevel: 80, cost: 15000, boss: "goblin_king", attrs: { strength: 10, defense: 8, intelligence: 3, agility: 4, vitality: 8 }, stats: { hp: 20 }, skills: ["royal_decree"] }),
  ]),
  demon: build("demon", { name: "Demônio", color: "§c", desc: "Seres das chamas e das sombras, mestres da magia ofensiva.", bonus: "+3 Inteligência, Chama Infernal", penalty: "Menos vida e defesa" , traits: { fire: 12, shadow: 12, res_fire: 12 }}, [
    S("demon_1", "Demônio", null, { attrs: { strength: 2, defense: -1, intelligence: 3, agility: 0, vitality: -1 }, skills: ["demon_flame"] }),
    S("demon_2a", "Demônio Guerreiro", "demon_1", { minLevel: 25, cost: 900, attrs: { strength: 5, defense: 2, intelligence: 2, agility: 0, vitality: 2 }, skills: ["blood_slash"] }),
    S("demon_2b", "Feiticeiro Demoníaco", "demon_1", { minLevel: 25, cost: 900, attrs: { strength: 1, defense: 0, intelligence: 7, agility: 2, vitality: 1 }, skills: ["soul_drain"] }),
    S("demon_3a", "Senhor Demoníaco", "demon_2a", { minLevel: 60, cost: 4500, attrs: { strength: 8, defense: 5, intelligence: 5, agility: 2, vitality: 5 }, skills: ["void_rift"] }),
    S("demon_3b", "Arquidemônio", "demon_2b", { minLevel: 60, cost: 4500, attrs: { strength: 2, defense: 2, intelligence: 12, agility: 3, vitality: 3 }, skills: ["dragon_breath"] }),
    // LORD DEMÔNIO (restaurado): evolução do Senhor Demoníaco. Cerimônia própria em systems/sagecore.js (evolutionScene, TDL) e falas do Grande Sábio em systems/race.js.
    S("demon_4", "Lord Demônio", "demon_3a", { minLevel: 80, cost: 15000, kills: 300, attrs: { strength: 12, defense: 8, intelligence: 10, agility: 4, vitality: 9 }, stats: { hp: 30 }, skills: ["lord_demon_dominion"] }),
  ]),
  elf: build("elf", { name: "Elfo", color: "§b", desc: "Graciosos e longevos, afinados com a mana e o arco.", bonus: "+3 Agilidade, +2 Inteligência", penalty: "Frágeis" , traits: { manaRegen: 20, cdr: 4, crit: 4 }}, [
    S("elf_1", "Elfo", null, { attrs: { strength: -1, defense: -1, intelligence: 2, agility: 3, vitality: -1 }, skills: ["elf_grace"] }),
    S("elf_2a", "Elfo Arqueiro", "elf_1", { minLevel: 22, cost: 700, attrs: { strength: 1, defense: 0, intelligence: 1, agility: 6, vitality: 0 }, skills: ["piercing_shot"] }),
    S("elf_2b", "Elfo Mago", "elf_1", { minLevel: 22, cost: 700, attrs: { strength: 0, defense: 0, intelligence: 6, agility: 2, vitality: 0 }, skills: ["ice_lance"] }),
    S("elf_3a", "Ranger Supremo", "elf_2a", { minLevel: 55, cost: 4000, attrs: { strength: 3, defense: 2, intelligence: 2, agility: 10, vitality: 2 }, skills: ["keen_eye"] }),
    S("elf_3b", "Elfo Sábio", "elf_2b", { minLevel: 55, cost: 4000, attrs: { strength: 0, defense: 2, intelligence: 10, agility: 4, vitality: 2 }, skills: ["holy_light"] }),
  ]),
  // ANJO — árvore baseada em config/mysticism/race/angel_config.toml (modpack de referência): Lesser Angel -> Greater Angel -> Arch Angel -> Cherub -> Seraph;
  // ramo "Fallen ... Angel" (cai com essências de demônio: 1/3/5/7/10 no mesmo patamar, aqui Fragmento de Demonite) e linha escura Lesser/Greater/Arch Fallen -> Fallen Lord -> Fallen.
  // EP do original -> nível: 20000 = Nv 25, 140000 = Nv 50, 300000 = Nv 70. Querubim/Serafim não têm EP na referência (auras fixas): requisitos adaptados.
  angel: build("angel", { name: "Anjo", color: "§e", desc: "Seres celestiais de asas de pena e halo. Resistem à magia, dominam a luz e planam pelos ares. Podem cair em trevas ao abraçar a essência de demônios.", bonus: "Asas e halo, queda lenta, resistência mágica, luz", penalty: "Menos força bruta", traits: { res_magic: 12, res_void: 8, light: 12, manaRegen: 15 }}, [
    S("angel_1", "Anjo Menor", null, { attrs: { strength: -1, defense: 1, intelligence: 3, agility: 1, vitality: 1 }, stats: { hp: 5 }, skills: ["angel_grace", "angel_glide", "heal"] }),
    S("angel_2", "Anjo Maior", "angel_1", { minLevel: 25, cost: 1500, attrs: { strength: 1, defense: 3, intelligence: 5, agility: 2, vitality: 3 }, stats: { hp: 15 }, skills: ["divine_shield"] }),
    S("angel_3", "Arcanjo", "angel_2", { minLevel: 50, cost: 6000, attrs: { strength: 4, defense: 6, intelligence: 8, agility: 3, vitality: 6 }, stats: { hp: 30 }, skills: ["holy_light"] }),
    S("angel_4", "Querubim", "angel_3", { minLevel: 75, cost: 20000, kills: 300, attrs: { strength: 7, defense: 9, intelligence: 12, agility: 5, vitality: 10 }, stats: { hp: 55, mana: 30 }, skills: ["holy_lance", "lionheart"] }),
    S("angel_5", "Serafim", "angel_4", { minLevel: 95, cost: 50000, boss: "void_lord", attrs: { strength: 10, defense: 13, intelligence: 18, agility: 7, vitality: 14 }, stats: { hp: 90, mana: 60 }, skills: ["megiddo", "master_physician"] }),
    S("angel_f1", "Anjo Menor Caído", "angel_1", { minLevel: 10, cost: 300, item: ["etheria:demonite_shard", 1], attrs: { strength: 1, defense: 0, intelligence: 3, agility: 2, vitality: 1 }, stats: { hp: 5 }, skills: ["shadow_step"] }),
    S("angel_f2", "Anjo Maior Caído", "angel_2", { minLevel: 25, cost: 1500, item: ["etheria:demonite_shard", 3], attrs: { strength: 3, defense: 2, intelligence: 5, agility: 3, vitality: 3 }, stats: { hp: 15 }, skills: ["dark_slash"] }),
    S("angel_f3", "Arcanjo Caído", "angel_3", { minLevel: 50, cost: 6000, item: ["etheria:demonite_shard", 5], attrs: { strength: 6, defense: 4, intelligence: 8, agility: 4, vitality: 6 }, stats: { hp: 30 }, skills: ["soul_drain"] }),
    S("angel_f4", "Querubim Caído", "angel_4", { minLevel: 75, cost: 20000, item: ["etheria:demonite_shard", 7], attrs: { strength: 9, defense: 7, intelligence: 12, agility: 6, vitality: 10 }, stats: { hp: 55, mana: 30 }, skills: ["void_rift"] }),
    S("angel_f5", "Serafim Caído", "angel_5", { minLevel: 95, cost: 50000, item: ["etheria:demonite_shard", 10], attrs: { strength: 13, defense: 10, intelligence: 18, agility: 8, vitality: 14 }, stats: { hp: 90, mana: 60 }, skills: ["black_flame"] }),
    S("fall_2", "Caído Maior", "angel_f1", { minLevel: 25, cost: 1500, attrs: { strength: 4, defense: 2, intelligence: 5, agility: 4, vitality: 3 }, stats: { hp: 15 }, skills: ["dark_slash"] }),
    S("fall_3", "Grande Caído", "fall_2", { minLevel: 50, cost: 6000, attrs: { strength: 8, defense: 4, intelligence: 8, agility: 5, vitality: 6 }, stats: { hp: 30 }, skills: ["soul_drain"] }),
    S("fall_4", "Senhor Caído", "fall_3", { minLevel: 70, cost: 30000, kills: 250, attrs: { strength: 12, defense: 7, intelligence: 12, agility: 6, vitality: 10 }, stats: { hp: 55, mana: 30 }, skills: ["void_rift"] }),
    S("fall_5", "Caído", "fall_4", { minLevel: 95, cost: 60000, boss: "void_lord", attrs: { strength: 16, defense: 10, intelligence: 18, agility: 8, vitality: 14 }, stats: { hp: 90, mana: 60 }, skills: ["black_flame", "megiddo"] }),
  ]),
  dragonoid: build("dragonoid", { name: "Dragonoide", color: "§6", desc: "Descendentes de dragões, com escamas e fôlego flamejante.", bonus: "+3 Defesa, resistência ao fogo", penalty: "Menos agilidade" , traits: { res_fire: 25, res_physical: 6, hp: 15 }}, [
    S("dragonoid_1", "Dragonoide", null, { attrs: { strength: 2, defense: 3, intelligence: 0, agility: -1, vitality: 2 }, skills: ["dragon_scales"] }),
    S("dragonoid_2a", "Dragonoide Guerreiro", "dragonoid_1", { minLevel: 30, cost: 1200, attrs: { strength: 6, defense: 5, intelligence: 0, agility: 0, vitality: 4 }, skills: ["dragon_roar"] }),
    S("dragonoid_2b", "Dragonoide Arcano", "dragonoid_1", { minLevel: 30, cost: 1200, attrs: { strength: 2, defense: 3, intelligence: 6, agility: 0, vitality: 3 }, skills: ["fireball"] }),
    S("dragonoid_3a", "Draco Ancestral", "dragonoid_2a", { minLevel: 65, cost: 6000, attrs: { strength: 10, defense: 8, intelligence: 2, agility: 1, vitality: 8 }, stats: { hp: 20 }, skills: ["dragon_breath", "dragon_transform"] }),
    S("dragonoid_3b", "Dragão Arcano", "dragonoid_2b", { minLevel: 65, cost: 6000, attrs: { strength: 4, defense: 6, intelligence: 10, agility: 1, vitality: 6 }, skills: ["dragon_breath", "dragon_transform"] }),
  ]),
  beastkin: build("beastkin", { name: "Beastkin", color: "§e", desc: "Povo-fera: instintos aguçados, velocidade e ferocidade.", bonus: "+3 Agilidade, +2 Força, velocidade", penalty: "Pouca inteligência" , traits: { crit: 6, stamina: 15, physical: 6 }}, [
    S("beastkin_1", "Beastkin", null, { attrs: { strength: 2, defense: -1, intelligence: -1, agility: 3, vitality: 1 }, skills: ["beast_instinct"] }),
    S("beastkin_2a", "Lobo-Guerreiro", "beastkin_1", { minLevel: 20, cost: 600, attrs: { strength: 4, defense: 0, intelligence: -1, agility: 5, vitality: 2 }, skills: ["wind_dash"] }),
    S("beastkin_2b", "Caçador Beastkin", "beastkin_1", { minLevel: 20, cost: 600, attrs: { strength: 2, defense: 0, intelligence: 0, agility: 7, vitality: 1 }, skills: ["keen_eye"] }),
    S("beastkin_3a", "Licantropo", "beastkin_2a", { minLevel: 50, cost: 3500, attrs: { strength: 9, defense: 2, intelligence: 0, agility: 7, vitality: 5 }, skills: ["blood_slash"] }),
    S("beastkin_3b", "Predador", "beastkin_2b", { minLevel: 50, cost: 3500, attrs: { strength: 5, defense: 1, intelligence: 0, agility: 12, vitality: 3 }, skills: ["shadow_step"] }),
  ]),
  undead: build("undead", { name: "Morto-vivo", color: "§8", desc: "Retornaram da morte. Resistentes, mas amaldiçoados.", bonus: "+3 Vitalidade, roubo de vida", penalty: "Pouca agilidade" , traits: { lifesteal: 4, res_ice: 15, res_void: 10 }}, [
    S("undead_1", "Morto-vivo", null, { attrs: { strength: 0, defense: 2, intelligence: 1, agility: -1, vitality: 3 }, skills: ["undead_resilience"] }),
    S("undead_2a", "Cavaleiro Morto-vivo", "undead_1", { minLevel: 25, cost: 900, attrs: { strength: 4, defense: 5, intelligence: 0, agility: 0, vitality: 4 }, skills: ["shield_bash"] }),
    S("undead_2b", "Necromante", "undead_1", { minLevel: 25, cost: 900, attrs: { strength: 0, defense: 1, intelligence: 6, agility: 0, vitality: 3 }, skills: ["soul_drain"] }),
    S("undead_3a", "Lorde Morto-vivo", "undead_2a", { minLevel: 60, cost: 4500, attrs: { strength: 8, defense: 9, intelligence: 1, agility: 0, vitality: 9 }, skills: ["life_steal"] }),
    S("undead_3b", "Lich", "undead_2b", { minLevel: 60, cost: 4500, attrs: { strength: 0, defense: 4, intelligence: 12, agility: 0, vitality: 6 }, skills: ["void_rift"] }),
  ]),

  // ---- raças de Tensura (traços próprios) ----
  ogre: build("ogre", { name: "Ogro", color: "§4", desc: "Povo-oni: força bruta e vitalidade imensas. Ao receber um nome, evoluem para Oni e Kijin.", bonus: "+3 Força, +3 Vitalidade, +25 de vida", penalty: "Pouca inteligência e mana", traits: { hp: 25, physical: 10, res_physical: 6 } }, [
    S("ogre_1", "Ogro", null, { attrs: { strength: 3, defense: 1, intelligence: -2, agility: -1, vitality: 3 }, skills: ["war_cry"] }),
    S("ogre_2", "Oni", "ogre_1", { minLevel: 30, cost: 1500, attrs: { strength: 7, defense: 3, intelligence: 1, agility: 2, vitality: 6 }, skills: ["blood_slash"] }),
    S("ogre_3", "Kijin", "ogre_2", { minLevel: 65, cost: 7000, attrs: { strength: 12, defense: 6, intelligence: 4, agility: 5, vitality: 10 }, skills: ["dark_slash"] }),
    // 6.52: ramos finais do Kijin (Tensura: Benimaru -> Oni das Chamas Espirituais; Shion -> Oni da Fúria)
    S("ogre_4a", "Oni das Chamas Espirituais", "ogre_3", { minLevel: 82, cost: 12000, kills: 200, attrs: { strength: 14, defense: 7, intelligence: 9, agility: 7, vitality: 11 }, stats: { fire: 15, res_fire: 15 }, skills: ["hellflame", "black_flame"] }),
    S("ogre_4b", "Oni da Fúria", "ogre_3", { minLevel: 82, cost: 12000, kills: 200, attrs: { strength: 17, defense: 9, intelligence: 3, agility: 5, vitality: 14 }, stats: { physical: 12, hp: 25 }, skills: ["berserker", "earth_slam"] }),
  ]),
  lizardman: build("lizardman", { name: "Homem-Lagarto", color: "§3", desc: "Guerreiros anfíbios das águas e pântanos, ágeis e de pele rígida.", bonus: "+3 Agilidade, dano de água, resistência física", penalty: "Pouca mana", traits: { water: 14, res_physical: 8, res_ice: -10, crit: 3 } }, [
    S("lizard_1", "Homem-Lagarto", null, { attrs: { strength: 1, defense: 2, intelligence: -1, agility: 3, vitality: 1 }, skills: ["piercing_shot"] }),
    S("lizard_2", "Guerreiro Lagarto", "lizard_1", { minLevel: 25, cost: 900, attrs: { strength: 4, defense: 4, intelligence: 0, agility: 5, vitality: 3 }, skills: ["wind_dash"] }),
    S("lizard_3b", "Grande Chefe dos Pântanos", "lizard_2", { minLevel: 60, cost: 5000, attrs: { strength: 9, defense: 9, intelligence: 2, agility: 6, vitality: 8 }, stats: { water: 12, res_physical: 6 }, skills: ["water_current", "water_blade"] }),   // 6.52: caminho de Abil, o chefe dos homens-lagarto
    S("lizard_3", "Dragonewt", "lizard_2", { minLevel: 60, cost: 5000, attrs: { strength: 8, defense: 7, intelligence: 3, agility: 8, vitality: 6 }, skills: ["dragon_scales"] }),
    S("lizard_4", "Dragonato Celeste", "lizard_3", { minLevel: 80, cost: 11000, kills: 200, attrs: { strength: 11, defense: 9, intelligence: 5, agility: 11, vitality: 8 }, stats: { res_physical: 6, crit: 4 }, skills: ["storm_scales", "thunder_breath"] }),   // 6.52: dragonatos alados de Gabiru (voam)
  ]),
  vampire: build("vampire", { name: "Vampiro", color: "§5", desc: "Nobres da noite: sedentos de sangue, rápidos e mágicos.", bonus: "Roubo de vida, dano de sangue e sombra", penalty: "Fraco ao fogo", traits: { lifesteal: 6, blood: 12, shadow: 8, res_fire: -10 } }, [
    S("vampire_1", "Vampiro", null, { attrs: { strength: 1, defense: -1, intelligence: 3, agility: 2, vitality: 0 }, skills: ["life_steal"] }),
    S("vampire_2b", "Vampiro da Névoa", "vampire_1", { minLevel: 28, cost: 1100, attrs: { strength: 2, defense: 1, intelligence: 5, agility: 6, vitality: 2 }, stats: { shadow: 8 }, skills: ["shadow_step"] }),   // 6.52: ramo furtivo
    S("vampire_3b", "Senhor da Noite", "vampire_2b", { minLevel: 62, cost: 5500, attrs: { strength: 5, defense: 3, intelligence: 10, agility: 9, vitality: 5 }, stats: { shadow: 12, lifesteal: 3 }, skills: ["blood_rain", "dark_bolt"] }),
    S("vampire_2", "Vampiro Nobre", "vampire_1", { minLevel: 28, cost: 1100, attrs: { strength: 3, defense: 1, intelligence: 6, agility: 4, vitality: 2 }, skills: ["blood_slash"] }),
    S("vampire_3", "Vampiro Ancestral", "vampire_2", { minLevel: 62, cost: 5500, attrs: { strength: 6, defense: 3, intelligence: 11, agility: 6, vitality: 5 }, skills: ["soul_drain"] }),
    S("vampire_4", "Vampiro Verdadeiro (Progenitor)", "vampire_3", { minLevel: 85, cost: 14000, kills: 250, attrs: { strength: 8, defense: 5, intelligence: 14, agility: 8, vitality: 7 }, stats: { lifesteal: 5, blood: 15 }, skills: ["blood_drain", "death_storm"] }),   // 6.52: linhagem de Luminus
  ]),
  dwarf: build("dwarf", { name: "Anão", color: "§6", desc: "Mestres ferreiros das montanhas: baixos, firmes e ricos.", bonus: "+3 Defesa, +20% de moedas, resistência física", penalty: "Pouca agilidade", traits: { coin: 20, res_physical: 10, earth: 10, hp: 10 } }, [
    S("dwarf_1", "Anão", null, { attrs: { strength: 1, defense: 3, intelligence: 0, agility: -2, vitality: 2 }, skills: ["shield_bash"] }),
    S("dwarf_2b", "Anão de Batalha", "dwarf_1", { minLevel: 25, cost: 900, attrs: { strength: 5, defense: 5, intelligence: 0, agility: 0, vitality: 4 }, stats: { physical: 6 }, skills: ["earth_slam"] }),   // 6.52: ramo guerreiro
    S("dwarf_3b", "Rei Heroico", "dwarf_2b", { minLevel: 60, cost: 5000, attrs: { strength: 10, defense: 9, intelligence: 3, agility: 2, vitality: 9 }, stats: { earth: 10, hp: 15 }, skills: ["dwarf_hammer", "stone_skin"] }),   // caminho de Gazel Dwargo
    S("dwarf_2", "Mestre Ferreiro", "dwarf_1", { minLevel: 25, cost: 900, attrs: { strength: 3, defense: 6, intelligence: 1, agility: -1, vitality: 4 }, skills: ["barrier"] }),
    S("dwarf_3", "Rei Anão", "dwarf_2", { minLevel: 60, cost: 5000, attrs: { strength: 6, defense: 11, intelligence: 3, agility: 0, vitality: 8 }, skills: ["divine_shield"] }),
  ]),
};
export const RACE_LIST = Object.values(RACES);

export function stageOf(d) {
  const r = RACES[d.race] ?? RACES.human;
  return r.stages[d.raceStage] ?? r.stages[r.root];
}
export function raceOf(d) { return RACES[d.race] ?? RACES.human; }
export function nextStages(d) { const s = stageOf(d); return s.next.map((id) => raceOf(d).stages[id]); }

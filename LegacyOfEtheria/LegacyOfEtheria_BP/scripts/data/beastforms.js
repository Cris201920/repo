// data/beastforms.js - 7.x: TRANSFORMAÇÕES DA RAÇA BEASTKIN (a raça de Carrion, o Rei Besta). Executor em systems/beastforms.js.
// Cada forma é uma habilidade ativa (Racial) com custo de mana + stamina, duração e recarga; dá atributos, dano e velocidade fortes enquanto dura.
// body = corpo do jogador durante a forma (propriedade etheria:bform; modelos de tools/beast_bodies.py).
// depth = profundidade mínima do estágio da raça (0 = Beastkin, 1 = Lobo-Guerreiro/Caçador, 2 = Licantropo/Predador, 3 = Lord Demônio).
export const BEAST_FORMS = {
  beast_form: {
    name: "Forma Fera", short: "Fera", level: 10, depth: 0, mana: 25, stamina: 20, sec: 30, cd: 45, rarity: "rare", col: ["earth", "gold"], body: 1,
    desc: "Desperta o sangue de fera: o corpo vira uma besta curvada de pernas de fera, garras longas, presas, orelhas e cauda (~1,15x). +8 Força, +6 Agilidade, +4 Defesa, +10% de crítico, Velocidade I e Força I por 30s.",
    stats: { strength: 8, agility: 6, defense: 4, crit: 10, critDmg: 10 }, vanilla: [["speed", 0], ["strength", 0]],
    msg: "Forma Fera: os instintos de caça despertam.",
  },
  beast_king: {
    name: "Rei Besta", short: "Rei Besta", level: 40, depth: 1, mana: 45, stamina: 35, sec: 35, cd: 90, rarity: "epic", col: ["gold", "blood"], body: 2,
    desc: "A forma de Carrion, o Rei Besta: corpo musculoso com juba dourada densa, chifres, garras grandes, ombreiras e cauda de leão (~1,35x). +16 Força, +10 Agilidade, +8 Defesa, +6 Vitalidade, 8% de roubo de vida, +30% de dano crítico, Velocidade II, Força II e Resistência I por 35s. Ao ativar, um rugido empurra os inimigos.",
    stats: { strength: 16, agility: 10, defense: 8, vitality: 6, lifesteal: 8, crit: 12, critDmg: 30, atk: 4 }, vanilla: [["speed", 1], ["strength", 1], ["resistance", 0]],
    roar: { radius: 7, power: 1.6, knock: 1.4 },
    msg: "Rei Besta: a majestade de Carrion se manifesta.",
  },
  royal_beast: {
    name: "Besta Real", short: "Besta Real", level: 70, depth: 2, mana: 80, stamina: 50, sec: 40, cd: 150, rarity: "legendary", col: ["blood", "gold"], body: 3,
    desc: "Forma Besta Real (Carrion liberado): um monstro de costelas expostas, espinhos dorsais, quatro olhos vermelhos, quatro presas, juba flamejante e garras de lâmina (~1,6x). +28 Força, +14 Agilidade, +14 Defesa, +10 Vitalidade, 12% de roubo de vida, +50% de dano crítico, Velocidade II, Força III, Resistência II e Regeneração I por 40s. Ao ativar, uma pisada de guerra causa dano e arremessa tudo ao redor.",
    stats: { strength: 28, agility: 14, defense: 14, vitality: 10, lifesteal: 12, crit: 15, critDmg: 50, atk: 10, res_physical: 15 }, vanilla: [["speed", 1], ["strength", 2], ["resistance", 1], ["regeneration", 0]],
    roar: { radius: 9, power: 3.2, knock: 2.0 },
    msg: "Besta Real: o rei das feras libera todo o seu poder.",
  },
};
export const BEAST_FORM_IDS = Object.keys(BEAST_FORMS);

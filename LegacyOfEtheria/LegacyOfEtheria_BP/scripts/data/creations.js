// data/creations.js - Habilidade Única "Criador" (Yuuki Kagurazaka): o jogador FORJA suas próprias habilidades combinando FORMA x ELEMENTO.
// 5 espaços fixos (created_1..5, definidos em data/skills.js); cada espaço tem um porte (poder, mana, recarga, custo em pontos de habilidade, nível mínimo).
// A receita fica salva em d.creations[espaço] e o executor "creation" (systems/creator.js) monta o efeito a partir dela.
export const CREATOR = {
  skill: "creator", minLevel: 70, boss: "yuuki_kagurazaka", needSkill: "anti_skill",
  slots: {
    1: { tier: 1, mana: 28, cd: 8, power: 1.7, sp: 1, level: 70, label: "Menor" },
    2: { tier: 1, mana: 28, cd: 8, power: 1.7, sp: 1, level: 70, label: "Menor" },
    3: { tier: 2, mana: 50, cd: 16, power: 3.0, sp: 2, level: 80, label: "Maior" },
    4: { tier: 2, mana: 50, cd: 16, power: 3.0, sp: 2, level: 80, label: "Maior" },
    5: { tier: 3, mana: 85, cd: 40, power: 5.2, sp: 3, level: 90, label: "Suprema" },
  },
};
// forma -> como o efeito é montado (t = porte 1..3; p = poder do espaço). Usa os executores que já existem em systems/skills.js.
export const FORMS = {
  projectile: { name: "Projétil", desc: "Esfera que explode no ponto mirado.", build: (t, p) => ({ kind: "projectile", range: 30, radius: 1.8 + 0.5 * t, power: p, stat: "intelligence" }) },
  beam: { name: "Raio", desc: "Feixe que atravessa todos à frente.", build: (t, p) => ({ kind: "beam", range: 30 + 2 * t, width: 1.0 + 0.2 * t, power: p * 0.9, stat: "intelligence", pierce: true }) },
  cone: { name: "Cone", desc: "Rajada em arco à frente, com repulsão.", build: (t, p) => ({ kind: "cone", range: 7 + t, angle: 80, power: p, stat: "intelligence", knock: 1.4 }) },
  blast: { name: "Explosão", desc: "Detonação no ponto mirado, em área.", build: (t, p) => ({ kind: "target_aoe", range: 24, radius: 3.5 + t, power: p, stat: "intelligence" }) },
  wave: { name: "Onda", desc: "Onda ao seu redor que empurra os inimigos.", build: (t, p) => ({ kind: "aoe_self", radius: 4.5 + t, power: p * 0.9, stat: "intelligence", knock: 1.8 }) },
  barrier: { name: "Barreira", desc: "Escudo: absorção, defesa e resistência ao elemento escolhido.", defensive: true },
};
// elemento -> nome e efeito secundário (só formas ofensivas). Efeitos curtos: sem ciclos de atordoamento (stun só no porte 2+, 1 s).
export const ELEM = {
  fire: { name: "Fogo", rider: (t) => ({ burn: 3 + t }) },
  ice: { name: "Gelo", rider: (t) => ({ debuff: { id: "chill", sec: 4 + t } }) },
  lightning: { name: "Raio", rider: (t) => (t >= 2 ? { debuff: { id: "stun", sec: 1 } } : {}) },
  wind: { name: "Vento", rider: () => ({ knockBonus: 0.6 }) },
  earth: { name: "Terra", rider: (t) => ({ debuff: { id: "sloth", sec: 2 + t } }) },
  water: { name: "Água", rider: (t) => ({ debuff: { id: "chill", sec: 2 + t } }) },
  light: { name: "Luz", rider: () => ({ powerMul: 1.1 }) },
  shadow: { name: "Sombra", rider: (t) => ({ debuff: { id: "fear", sec: 2 + t } }) },
  void: { name: "Vazio", rider: (t) => ({ debuff: { id: "weak", sec: 3 + t } }) },
};
export const SOUND = { projectile: "mob.blaze.shoot", beam: "mob.evocation_illager.cast_spell", cone: "random.splash", blast: "random.explode", wave: "mob.ender_dragon.flap", barrier: "random.orb" };

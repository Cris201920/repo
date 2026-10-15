// data/bosses.js - Comportamento dos bosses (vida/dano base ficam em entities/*.json, geradas pelo build).
// Para criar um boss novo: adicione a entidade em tools/content.py (BOSSES) e uma entrada aqui.
//
// phases[i].hp   = o boss entra na fase i quando vida <= hp * máx (fase 0 = 100%)
// phases[i].fx   = efeitos vanilla aplicados ao boss ao entrar na fase
// abilities: [nome, recargaSegundos, parâmetros]
//   smash{radius,dmg,knock}  charge{power}  summon{type,n,cap}  roar{radius,dmg,weak}  fire_breath{range,angle,dmg,burn}
//   meteors{count,dmg,radius,delay}  void_pull{radius,dmg,pull}  void_shards{dmg}  blink{}  drain{radius,dmg,heal}
//   barrier{sec}  enrage{}
// dmg = multiplicador sobre o dano base do boss (dmgBase)
export const BOSSES = {
  goblin_king: {
    key: "goblin_king", type: "etheria:boss_goblin_king", name: "Rei Goblin", color: "§a", sigil: "etheria:goblin_sigil", dmgBase: 20, range: 24,
    intro: "§aO Rei Goblin ruge: \"Esta terra é MINHA!\"",
    phaseMsg: ["", "§e§lO Rei Goblin acelera!", "§c§lO Rei Goblin chama seus súditos!", "§4§lO Rei Goblin está ENFURECIDO!"],
    phases: [
      { hp: 1.0, abilities: [["smash", 6, { radius: 4.5, dmg: 1.0, knock: 1.0 }]] },
      { hp: 0.75, fx: [["speed", 1]], abilities: [["smash", 6, { radius: 4.5, dmg: 1.1, knock: 1.2 }], ["charge", 10, { power: 2.4 }]] },
      { hp: 0.5, fx: [["speed", 1]], abilities: [["war_drums", 20, { radius: 22, sec: 10 }], ["smash", 6, { radius: 5, dmg: 1.2, knock: 1.2 }], ["summon", 18, { type: "etheria:goblin", n: 3, cap: 6 }], ["charge", 10, { power: 2.4 }]] },
      { hp: 0.25, fx: [["speed", 2], ["strength", 1]], abilities: [["roar", 14, { radius: 8, dmg: 0.8, weak: 6 }], ["summon", 20, { type: "etheria:hobgoblin", n: 2, cap: 4 }], ["smash", 5, { radius: 5.5, dmg: 1.4, knock: 1.5 }], ["charge", 8, { power: 2.8 }]] },
    ],
    xp: 1200, coins: [300, 500], particles: "boss_aura",
  },
  void_lord: {
    key: "void_lord", type: "etheria:boss_void_lord", name: "Senhor do Vazio", color: "§5", sigil: "etheria:void_sigil", dmgBase: 30, range: 32,
    intro: "§5O Senhor do Vazio emerge da fenda... \"Tudo retornará ao nada.\"",
    phaseMsg: ["", "§d§lO Vazio se agita!", "§5§lO Senhor do Vazio rasga a realidade!"],
    phases: [
      { hp: 1.0, abilities: [["void_shards", 7, { dmg: 1.0 }], ["blink", 12, {}]] },
      { hp: 0.6, fx: [["speed", 1]], abilities: [["void_pull", 12, { radius: 12, dmg: 0.9, pull: 1.4 }], ["void_shards", 6, { dmg: 1.1 }], ["summon", 22, { type: "etheria:dungeon_crawler", n: 2, cap: 4 }]] },
      { hp: 0.3, fx: [["speed", 1], ["strength", 1]], abilities: [["reality_tear", 16, { n: 3, radius: 3.2, sec: 6, dmg: 0.3 }], ["meteors", 12, { count: 5, dmg: 1.4, radius: 3, delay: 30, fx: "void" }], ["void_pull", 10, { radius: 14, dmg: 1.1, pull: 1.6 }], ["drain", 16, { radius: 8, dmg: 0.9, heal: 0.04 }], ["barrier", 25, { sec: 5 }]] },
    ],
    xp: 6000, coins: [1500, 2500], particles: "void_rift",
  },
  ember_tyrant: {
    key: "ember_tyrant", type: "etheria:boss_ember_tyrant", name: "Tirano Brasa", color: "§6", sigil: "etheria:ember_sigil", dmgBase: 38, range: 30,
    intro: "§6O Tirano Brasa incendeia o céu: \"Queimem!\"",
    phaseMsg: ["", "§6§lO Tirano lança meteoros!", "§c§lO Tirano convoca seus filhotes!", "§4§lO Tirano entra em FRENESI!"],
    phases: [
      { hp: 1.0, abilities: [["fire_breath", 8, { range: 9, angle: 60, dmg: 1.0, burn: 5 }], ["smash", 7, { radius: 5, dmg: 1.0, knock: 1.4 }]] },
      { hp: 0.7, abilities: [["fire_breath", 7, { range: 10, angle: 60, dmg: 1.1, burn: 5 }], ["meteors", 14, { count: 4, dmg: 1.3, radius: 3, delay: 30, fx: "fire" }], ["charge", 10, { power: 2.6 }]] },
      { hp: 0.4, fx: [["speed", 1]], abilities: [["magma_floor", 15, { n: 4, radius: 3, sec: 6, dmg: 0.3 }], ["summon", 20, { type: "etheria:drake_whelp", n: 2, cap: 4 }], ["fire_breath", 6, { range: 10, angle: 70, dmg: 1.2, burn: 6 }], ["meteors", 12, { count: 5, dmg: 1.3, radius: 3, delay: 30, fx: "fire" }]] },
      { hp: 0.15, fx: [["speed", 2], ["strength", 2]], abilities: [["roar", 12, { radius: 9, dmg: 1.0, weak: 6 }], ["meteors", 8, { count: 7, dmg: 1.4, radius: 3.2, delay: 25, fx: "fire" }], ["fire_breath", 5, { range: 11, angle: 80, dmg: 1.3, burn: 8 }], ["smash", 5, { radius: 6, dmg: 1.3, knock: 1.6 }]] },
    ],
    xp: 9000, coins: [2500, 4000], particles: "legendary_aura",
  },
};
export const BOSS_BY_TYPE = Object.fromEntries(Object.values(BOSSES).map((b) => [b.type, b]));

// data/skillmods/angelic.js - 6.46: MÓDULO DE HABILIDADES "Angelicais" (exemplo da camada modular).
// Cada módulo é só uma lista de definições no mesmo formato de data/skills.js; o registro (registerSkillModule) valida tudo
// (id único, campos obrigatórios, tipo de execução conhecido, pré-requisitos existentes) antes de incluir. Nada de lógica nova aqui:
// a execução usa os tipos que o motor já sabe rodar (cone, dash, target_aoe...), então funciona no multiplayer como as demais.
export default {
  id: "angelic", name: "Habilidades Angelicais", color: "§e",
  skills: [
    { id: "holy_blade", type: "active", sp: 2, req: ["holy_light"], name: "Lâmina Sagrada", cat: "Combate", element: "holy", rarity: "epic", mana: 30, cd: 9, level: 32,
      desc: "Um arco de luz sagrada em leque à sua frente. Fere com força e empurra os inimigos.",
      exec: { kind: "cone", range: 6, angle: 75, power: 2.1, stat: "strength", knock: 1.6, snd: "beacon.power" } },
    { id: "wings_of_light", type: "active", sp: 2, req: ["holy_blade"], name: "Asas de Luz", cat: "Mobilidade", element: "holy", rarity: "epic", mana: 24, cd: 12, level: 36,
      desc: "Avanço veloz envolto em luz que fere quem estiver no caminho.",
      exec: { kind: "dash", power: 7, damage: 1.1, stat: "agility", snd: "mob.enderdragon.flap" } },
  ],
};

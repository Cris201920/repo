// data/classes.js - Classes. Adicione novas entradas aqui para criar classes.
// attrs = bônus de atributos; stats = bônus extras; skills = habilidades concedidas ao escolher a classe
export const CLASSES = {
  warrior:   { id: "warrior", name: "Guerreiro", icon: "slash", minLevel: 1, cost: 0, style: "Corpo a corpo equilibrado, muita stamina.",
               attrs: { strength: 3, defense: 2, vitality: 2 }, stats: { stamina: 20 }, skills: ["power_strike"] },
  mage:      { id: "mage", name: "Mago", icon: "star", minLevel: 1, cost: 0, style: "Dano mágico à distância, muita mana.",
               attrs: { intelligence: 6, agility: 1 }, stats: { mana: 30, manaCost: 10 }, skills: ["arcane_surge", "fireball"] },
  archer:    { id: "archer", name: "Arqueiro", icon: "dash", minLevel: 1, cost: 0, style: "Precisão e mobilidade; golpes perfurantes.",
               attrs: { agility: 5, strength: 2, intelligence: 1 }, stats: { crit: 5, stamina: 15 }, skills: ["piercing_shot", "wind_dash"] },
  assassin:  { id: "assassin", name: "Assassino", icon: "fang", minLevel: 1, cost: 0, style: "Críticos devastadores e investidas.",
               attrs: { agility: 5, strength: 2 }, stats: { crit: 8, critDmg: 30 }, skills: ["shadow_step", "dark_slash"] },
  knight:    { id: "knight", name: "Cavaleiro", icon: "shield", minLevel: 1, cost: 0, style: "Tanque resistente que atordoa inimigos.",
               attrs: { defense: 6, vitality: 3, strength: 2 }, stats: { res_physical: 10 }, skills: ["shield_bash", "barrier"] },
  paladin:   { id: "paladin", name: "Paladino", icon: "sun", minLevel: 1, cost: 0, style: "Defesa sagrada, cura e escudos.",
               attrs: { defense: 3, vitality: 3, strength: 1, intelligence: 2 }, stats: { res_magic: 10 }, skills: ["divine_shield", "heal"] },
  summoner:  { id: "summoner", name: "Invocador", icon: "summon", minLevel: 1, cost: 0, style: "Convoca aliados; recargas menores.",
               attrs: { intelligence: 5, vitality: 2, defense: 1 }, stats: { mana: 40, cdr: 15 }, skills: ["summon_guardian"] },
  berserker: { id: "berserker", name: "Berserker", icon: "drop", minLevel: 1, cost: 0, style: "Fúria: dano enorme e roubo de vida, pouca defesa.",
               attrs: { strength: 6, vitality: 2, defense: -2, agility: 1 }, stats: { lifesteal: 3 }, skills: ["berserk_rage"] },
};
export const CLASS_LIST = Object.values(CLASSES);

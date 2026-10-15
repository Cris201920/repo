// data/teachers.js - APRENDIZADO: cada habilidade ensinada por um mestre tem requisitos reais (nível, reputação, missão, chefe, item, moedas, aliança).
// Campos de LESSONS[skillId]: lvl, rep {facção: mínimo}, anyAlly (precisa ser aliado de qualquer facção), quest (id concluída), boss (chave derrotada), item [id, n] (consumido),
//   cost (moedas), kills (abates totais), flag (desbloqueio do mundo), skills (pré-requisitos já aprendidos).
// Os mestres e o que ensinam ficam em data/worldnpcs.js (campo teaches).
const E = "etheria:";
export const LESSONS = {
  // Espada
  sword_flash:   { lvl: 5,  cost: 300 },
  sword_whirl:   { lvl: 20, cost: 1500, rep: { tempest: 40 }, quest: "tp_sword_trial" },
  sword_charge:  { lvl: 30, cost: 3500, rep: { tempest: 100 }, skills: ["sword_flash"], kills: 150 },
  sword_sovereign: { lvl: 70, cost: 40000, rep: { tempest: 300 }, quest: "tp_sword_legend", boss: "void_lord", item: [E + "evolution_core", 1], skills: ["sword_whirl", "sword_charge"] },
  // Lança
  spear_thrust:  { lvl: 8,  cost: 400 },
  spear_dive:    { lvl: 25, cost: 2200, rep: { tempest: 60 }, skills: ["spear_thrust"] },
  // Combate
  parry_stance:  { lvl: 6,  cost: 350 },
  evasion_step:  { lvl: 10, cost: 600, skills: ["parry_stance"] },
  counter_strike: { lvl: 24, cost: 2400, rep: { tempest: 60 }, skills: ["parry_stance"], kills: 100 },
  // Magia (técnicas já existentes, agora também ensinadas por um mestre)
  ice_lance:     { lvl: 5,  cost: 400, skills: ["fireball"] },
  lightning:     { lvl: 12, cost: 1500, rep: { tempest: 30 }, skills: ["ice_lance"] },
  barrier:       { lvl: 8,  cost: 700 },
  teleport:      { lvl: 18, cost: 3000, rep: { tempest: 80 }, skills: ["wind_dash"] },
  void_rift:     { lvl: 42, cost: 20000, rep: { tempest: 200 }, boss: "void_lord", skills: ["mana_burst"] },
  // Energia
  mana_flow:     { lvl: 10, cost: 900 },
  focus_aura:    { lvl: 18, cost: 2000, rep: { tempest: 40 } },
  power_surge:   { lvl: 40, cost: 12000, rep: { tempest: 200 }, quest: "tp_energy_trial", skills: ["focus_aura"] },
  // Cura
  heal:          { lvl: 2,  cost: 150 },
  regeneration:  { lvl: 5,  cost: 500 },
  holy_light:    { lvl: 30, cost: 8000, rep: { tempest: 100 }, skills: ["heal"] },
  mass_heal:     { lvl: 45, cost: 18000, rep: { tempest: 250 }, quest: "tp_heal_trial", skills: ["holy_light"] },
  // Anões
  forge_blessing: { lvl: 20, cost: 3000, rep: { dwarf: 60 } },
  stone_skin:    { lvl: 35, cost: 9000, rep: { dwarf: 200 }, quest: "dw_miner_cave" },
  dwarf_hammer:  { lvl: 45, cost: 16000, rep: { dwarf: 300 }, quest: "dw_deep_forge", skills: ["forge_blessing"] },
  // Guy Crimson
  crimson_authority: { lvl: 50, cost: 30000, rep: { guy: 200 }, quest: "gc_envoy_trial" },
  crimson_wave:  { lvl: 60, cost: 45000, rep: { guy: 300 }, skills: ["crimson_authority"], boss: "void_lord" },
  overlord_presence: { lvl: 75, cost: 80000, rep: { guy: 450 }, skills: ["crimson_wave"], item: [E + "void_fragment", 4], flag: "guy_respect" },
  // Orcs
  orc_hide:      { lvl: 15, cost: 1500, rep: { orc: 60 } },
  orc_fury:      { lvl: 25, cost: 4000, rep: { orc: 150 }, quest: "orc_trial" },
  devour_flesh:  { lvl: 40, cost: 12000, rep: { orc: 300 }, skills: ["orc_fury"], kills: 300 },
  // Lendária
  legend_resolve: { lvl: 90, cost: 150000, anyAlly: true, quest: "hm_legend_trial", boss: "chronoa", item: [E + "evolution_core", 2] },
};
// receitas da Forja Anã (NPC dw_smith): exige reputação/nível/missão e materiais; entrega o item pronto
export const DWARF_RECIPES = [
  { give: E + "dragotite_sword", mats: [[E + "dragotite_ingot", 6]], cost: 1500, lvl: 20, rep: 40 },
  { give: E + "dragotite_chest", mats: [[E + "dragotite_ingot", 8]], cost: 1800, lvl: 20, rep: 40 },
  { give: E + "dragotite_great_sword", mats: [[E + "dragotite_ingot", 10], [E + "earth_core", 2]], cost: 4000, lvl: 30, rep: 120 },
  { give: E + "dragotite_earth_sword", mats: [[E + "dragotite_earth_ingot", 6]], cost: 9000, lvl: 45, rep: 200, quest: "dw_deep_forge" },
  { give: E + "dragotite_frost_sword", mats: [[E + "dragotite_frost_ingot", 6]], cost: 9000, lvl: 45, rep: 200, quest: "dw_deep_forge" },
  { give: E + "dragotite_storm_sword", mats: [[E + "dragotite_storm_ingot", 6]], cost: 9000, lvl: 45, rep: 200, quest: "dw_deep_forge" },
  { give: E + "dragotite_scorch_sword", mats: [[E + "dragotite_scorch_ingot", 6]], cost: 9000, lvl: 45, rep: 200, quest: "dw_deep_forge" },
  { give: E + "dragotite_star_sword", mats: [[E + "dragotite_star_ingot", 6], [E + "evolution_core", 1]], cost: 60000, lvl: 70, rep: 450, quest: "dw_deep_forge", ally: true },
];

// data/skills.js - Habilidades 100% em dados. Para criar uma nova, basta adicionar uma entrada aqui
// (e um ícone em RP/textures/ui/etheria/skill_<id>.png, gerado pelo build a partir de tools/content.py).
//
// type: "active" | "passive"      cat: categoria exibida no menu
// exec.kind: projectile | target_aoe | aoe_self | cone | beam | chain | heal | buff | dash | teleport | summon
// exec.stat: atributo que escala o dano (strength | intelligence | agility | defense)
// passivas: stats (somados aos atributos) e effects (efeitos vanilla mantidos ativos)

const A = (id, o) => ({ id, type: "active", sp: 1, req: [], ...o });
const P = (id, o) => ({ id, type: "passive", mana: 0, cd: 0, sp: 1, req: [], ...o });

export const SKILLS = {};
function def(s) { SKILLS[s.id] = s; }

// ---------------------------------------------------------------- ATIVAS
def(A("predator", { name: "Predador", cat: "Única", element: "shadow", rarity: "mythic", mana: 15, cd: 6, level: 1, sp: 0,
  desc: "Habilidade Única. Ataca e devora alvos enfraquecidos (≤30% de vida), guardando-os no estômago. Concede Mimetismo.",
  exec: { kind: "devour", range: 5, power: 1.0, stat: "intelligence", threshold: 0.3, max: 1 } }));
def(A("gluttony", { name: "Glutonaria", cat: "Única", element: "shadow", rarity: "divine", mana: 30, cd: 8, level: 1, sp: 0,
  desc: "Evolução do Predador (Glutonaria). Devora vários alvos ao redor (≤40% de vida).",
  exec: { kind: "devour", range: 8, aoe: 6, max: 4, power: 1.6, stat: "intelligence", threshold: 0.4 } }));

def(A("fireball", { name: "Bola de Fogo", cat: "Magia", element: "fire", rarity: "common", mana: 12, cd: 3, level: 1,
  desc: "Lança uma esfera de fogo que explode e queima o alvo.",
  exec: { kind: "projectile", range: 28, radius: 2.2, power: 1.5, stat: "intelligence", burn: 4, snd: "mob.blaze.shoot" } }));
def(A("ice_lance", { name: "Lança de Gelo", cat: "Magia", element: "ice", rarity: "uncommon", mana: 14, cd: 4, level: 5, req: ["fireball"],
  desc: "Dardo gélido que causa dano e deixa o alvo lento.",
  exec: { kind: "projectile", range: 30, radius: 1.6, power: 1.6, stat: "intelligence", debuff: { id: "chill", sec: 5 }, snd: "random.glass" } }));
def(A("lightning", { name: "Raio", cat: "Magia", element: "lightning", rarity: "rare", mana: 22, cd: 6, level: 10, sp: 2, req: ["ice_lance"],
  desc: "Descarga elétrica que salta entre até 4 inimigos próximos.",
  exec: { kind: "chain", range: 24, jumps: 4, jumpRange: 6, power: 1.7, stat: "intelligence", snd: "ambient.weather.lightning.impact" } }));
def(A("energy_lance", { name: "Lança de Energia", cat: "Magia", element: "arcane", rarity: "rare", mana: 20, cd: 5, level: 12, sp: 2, req: ["fireball"],
  desc: "Raio de energia pura que atravessa todos os inimigos em linha.",
  exec: { kind: "beam", range: 32, width: 1.3, power: 1.8, stat: "intelligence", pierce: true, snd: "mob.evocation_illager.cast_spell" } }));
def(A("mana_burst", { name: "Explosão de Mana", cat: "Magia", element: "arcane", rarity: "rare", mana: 40, cd: 12, level: 24, sp: 3, req: ["energy_lance"],
  desc: "Libera mana em uma onda explosiva ao seu redor.",
  exec: { kind: "aoe_self", radius: 7, power: 3.0, stat: "intelligence", knock: 1.6, snd: "random.explode" } }));
def(A("dark_slash", { name: "Corte Sombrio", cat: "Combate", element: "shadow", rarity: "common", mana: 10, cd: 3, level: 1,
  desc: "Golpe em arco com energia sombria à sua frente.",
  exec: { kind: "cone", range: 4.5, angle: 80, power: 1.5, stat: "strength", snd: "mob.player.hurt" } }));
def(A("impact", { name: "Impacto", cat: "Combate", element: "physical", rarity: "common", mana: 10, cd: 4, level: 1,
  desc: "Golpe poderoso que arremessa o inimigo à frente.",
  exec: { kind: "cone", range: 3.2, angle: 50, power: 1.4, stat: "strength", knock: 1.8, snd: "random.anvil_land" } }));
def(A("earth_slam", { name: "Impacto Sísmico", cat: "Combate", element: "earth", rarity: "uncommon", mana: 22, cd: 8, level: 12, req: ["impact"],
  desc: "Golpeia o chão e atordoa quem estiver perto.",
  exec: { kind: "aoe_self", radius: 5, power: 2.0, stat: "strength", knock: 0.8, debuff: { id: "stun", sec: 2 }, snd: "random.explode" } }));
def(A("water_surge", { name: "Maré Viva", cat: "Magia", element: "water", rarity: "uncommon", mana: 20, cd: 7, level: 14, req: ["ice_lance"],
  desc: "Onda d'água que empurra e fere inimigos em um cone.",
  exec: { kind: "cone", range: 8, angle: 70, power: 1.6, stat: "intelligence", knock: 2.2, snd: "random.splash" } }));
def(A("wind_dash", { name: "Investida do Vento", cat: "Mobilidade", element: "wind", rarity: "common", mana: 8, cd: 5, level: 4, stamina: 15,
  desc: "Avança rapidamente na direção que você olha.",
  exec: { kind: "dash", power: 6, damage: 0.8, stat: "agility", snd: "mob.horse.gallop" } }));
def(A("teleport", { name: "Teletransporte", cat: "Mobilidade", element: "arcane", rarity: "rare", mana: 25, cd: 8, level: 16, sp: 2, req: ["wind_dash"],
  desc: "Teleporta até o ponto que você está mirando (até 16 blocos).",
  exec: { kind: "teleport", range: 16, snd: "mob.endermen.portal" } }));
def(A("heal", { name: "Cura", cat: "Suporte", element: "light", rarity: "common", mana: 18, cd: 8, level: 2,
  desc: "Recupera vida sua e de aliados próximos.",
  exec: { kind: "heal", radius: 5, amount: 14, stat: "intelligence", scale: 0.6, snd: "random.levelup" } }));
def(A("holy_light", { name: "Luz Sagrada", cat: "Suporte", element: "light", rarity: "epic", mana: 45, cd: 14, level: 30, sp: 3, req: ["heal"],
  desc: "Coluna de luz que fere os malignos e cura aliados.",
  exec: { kind: "target_aoe", range: 22, radius: 5, power: 2.6, stat: "intelligence", heal: 12, snd: "beacon.activate" } }));
def(A("barrier", { name: "Barreira", cat: "Suporte", element: "arcane", rarity: "uncommon", mana: 20, cd: 15, level: 8,
  desc: "Escudo mágico que absorve dano por alguns segundos.",
  exec: { kind: "buff", sec: 10, absorb: 3, buff: { id: "barrier", stats: { defense: 6, res_magic: 15 } }, snd: "random.orb" } }));
def(A("blood_slash", { name: "Corte Sanguíneo", cat: "Combate", element: "blood", rarity: "rare", mana: 18, cd: 6, level: 20, sp: 2, req: ["dark_slash"],
  desc: "Corte que faz o alvo sangrar e rouba vida.",
  exec: { kind: "cone", range: 4.2, angle: 70, power: 1.8, stat: "strength", debuff: { id: "bleed", sec: 6 }, drain: 0.25, snd: "mob.player.hurt" } }));
def(A("void_rift", { name: "Fenda do Vazio", cat: "Magia", element: "void", rarity: "epic", mana: 50, cd: 16, level: 40, sp: 3, req: ["mana_burst"],
  desc: "Abre uma fenda que puxa e despedaça inimigos.",
  exec: { kind: "target_aoe", range: 20, radius: 6, power: 3.2, stat: "intelligence", pull: 1.2, snd: "mob.endermen.portal" } }));
def(A("summon_guardian", { name: "Guardião Espectral", cat: "Invocação", element: "arcane", rarity: "epic", mana: 45, cd: 30, level: 28, sp: 3,
  desc: "Invoca um lobo espectral aliado por 40 segundos.",
  exec: { kind: "summon", sec: 40, entity: "minecraft:wolf", name: "§bGuardião Espectral", snd: "mob.evocation_illager.prepare_summon" } }));
def(A("dragon_breath", { name: "Sopro do Dragão", cat: "Magia", element: "fire", rarity: "legendary", mana: 70, cd: 25, level: 50, sp: 4, req: ["fireball", "mana_burst"],
  desc: "Cone devastador de chamas dracônicas.",
  exec: { kind: "cone", range: 9, angle: 60, power: 4.2, stat: "intelligence", burn: 8, snd: "mob.enderdragon.growl" } }));

// ---------------------------------------------------------------- PASSIVAS
def(P("regeneration", { name: "Regeneração", cat: "Passiva", rarity: "common", level: 3, desc: "Recupera vida lentamente.", effects: [{ id: "regeneration", amp: 0 }] }));
def(P("strength_up", { name: "Força Aprimorada", cat: "Passiva", rarity: "common", level: 5, desc: "+4 Força.", stats: { strength: 4 } }));
def(P("defense_up", { name: "Defesa Aprimorada", cat: "Passiva", rarity: "common", level: 5, desc: "+4 Defesa.", stats: { defense: 4 } }));
def(P("speed_up", { name: "Velocidade", cat: "Passiva", rarity: "common", level: 6, desc: "Move-se mais rápido.", effects: [{ id: "speed", amp: 0 }] }));
def(P("vitality_up", { name: "Vigor Vital", cat: "Passiva", rarity: "uncommon", level: 8, desc: "+4 Vitalidade.", stats: { vitality: 4 } }));
def(P("night_vision", { name: "Visão Noturna", cat: "Passiva", rarity: "uncommon", level: 8, desc: "Enxerga no escuro.", effects: [{ id: "night_vision", amp: 0 }] }));
def(P("mana_flow", { name: "Fluxo de Mana", cat: "Passiva", rarity: "uncommon", level: 10, desc: "+30% regeneração de mana.", stats: { manaRegen: 30 } }));
def(P("fire_resist", { name: "Resistência ao Fogo", cat: "Passiva", rarity: "uncommon", level: 12, desc: "Imune ao fogo e à lava.", effects: [{ id: "fire_resistance", amp: 0 }], stats: { res_fire: 20 } }));
def(P("keen_eye", { name: "Olhar Aguçado", cat: "Passiva", rarity: "rare", level: 15, sp: 2, desc: "+8% chance crítica e +15% dano crítico.", stats: { crit: 8, critDmg: 15 } }));
def(P("life_steal", { name: "Roubo de Vida", cat: "Passiva", rarity: "rare", level: 22, sp: 2, req: ["regeneration"], desc: "Recupera 4% do dano causado.", stats: { lifesteal: 4 } }));

// Voo Livre (systems/flight.js): voo controlado por script (não é o voo criativo nativo; ver limitações no cabeçalho de flight.js).
// Aprendível por todos só em nível alto (nível 50, 5 pontos, exige Teletransporte); raças/formas voadoras recebem por progressão (config FLIGHT.stages).
def(P("free_flight", { name: "Voo Livre", cat: "Passiva", rarity: "legendary", level: 50, sp: 5, req: ["teleport"],
  desc: "Voe sem Elytra. SEGURE PULAR para decolar e subir; AGACHE para descer; sem tocar em nada você paira. Mova-se normalmente para os lados. Pousar desliga o voo e não causa dano de queda. Ative/desative neste menu ou com !voo. Sem custo e sem recarga." }));

// ---------------------------------------------------------------- RACIAIS (concedidas pela raça/evolução)
def(P("human_will", { name: "Vontade Humana", cat: "Racial", rarity: "uncommon", level: 1, sp: 0, desc: "+10% de XP ganho.", stats: { xp: 10 } }));
def(P("goblin_cunning", { name: "Astúcia Goblin", cat: "Racial", rarity: "uncommon", level: 1, sp: 0, desc: "+3 Agilidade e +15% de moedas.", stats: { agility: 3, coin: 15 } }));
def(A("demon_flame", { name: "Chama Demoníaca", cat: "Racial", element: "fire", rarity: "rare", mana: 20, cd: 7, level: 1, sp: 0,
  desc: "Chamas demoníacas em cone à sua frente.",
  exec: { kind: "cone", range: 6, angle: 55, power: 1.7, stat: "intelligence", burn: 5, snd: "mob.blaze.shoot" } }));
def(P("angel_grace", { name: "Graça Angelical", cat: "Racial", rarity: "rare", level: 1, sp: 0, desc: "+3 Inteligência, +2 Defesa e +10% de resistência mágica.", stats: { intelligence: 3, defense: 2, res_magic: 10 } }));
def(P("angel_glide", { name: "Asas Sagradas", cat: "Racial", rarity: "rare", level: 1, sp: 0, desc: "Suas asas seguram o corpo no ar: você cai devagar e não sofre dano de queda. Agache para cair normalmente." }));
def(P("elf_grace", { name: "Graça Élfica", cat: "Racial", rarity: "uncommon", level: 1, sp: 0, desc: "+3 Agilidade e +3 Inteligência.", stats: { agility: 3, intelligence: 3 } }));
def(P("dragon_scales", { name: "Escamas Dracônicas", cat: "Racial", rarity: "rare", level: 1, sp: 0, desc: "+4 Defesa e 15% de resistência ao fogo.", stats: { defense: 4, res_fire: 15 } }));
def(P("beast_instinct", { name: "Instinto Bestial", cat: "Racial", rarity: "uncommon", level: 1, sp: 0, desc: "+2 Agilidade, +4% crítico e velocidade.", stats: { agility: 2, crit: 4 }, effects: [{ id: "speed", amp: 0 }] }));
def(P("undead_resilience", { name: "Resiliência Morta-viva", cat: "Racial", rarity: "rare", level: 1, sp: 0, desc: "+2 Vitalidade e 3% de roubo de vida.", stats: { vitality: 2, lifesteal: 3 } }));
// Raciais de evolução
def(A("war_cry", { name: "Grito de Guerra", cat: "Racial", element: "physical", rarity: "epic", mana: 30, cd: 20, level: 1, sp: 0,
  desc: "Ruge e fortalece você por 15s.", exec: { kind: "buff", sec: 15, buff: { id: "war_cry", stats: { strength: 8, defense: 4 } }, snd: "mob.ravager.roar" } }));
def(A("royal_decree", { name: "Decreto Real", cat: "Racial", element: "light", rarity: "legendary", mana: 55, cd: 40, level: 1, sp: 0,
  desc: "Invoca um servo leal e fortalece você.", exec: { kind: "summon", sec: 50, entity: "minecraft:wolf", name: "§6Servo Real", snd: "mob.ravager.roar" } }));
def(A("soul_drain", { name: "Dreno de Alma", cat: "Racial", element: "shadow", rarity: "epic", mana: 30, cd: 10, level: 1, sp: 0,
  desc: "Drena a vida dos inimigos próximos.", exec: { kind: "aoe_self", radius: 6, power: 1.8, stat: "intelligence", drain: 0.5, snd: "mob.wither.ambient" } }));
def(A("dragon_roar", { name: "Rugido Dracônico", cat: "Racial", element: "fire", rarity: "legendary", mana: 50, cd: 20, level: 1, sp: 0,
  desc: "Rugido que queima e arremessa os inimigos.", exec: { kind: "aoe_self", radius: 8, power: 2.8, stat: "strength", knock: 1.8, burn: 5, snd: "mob.enderdragon.growl" } }));

// ---------------------------------------------------------------- CLASSE (concedidas pela classe)
def(A("power_strike", { name: "Golpe Poderoso", cat: "Classe", element: "physical", rarity: "uncommon", mana: 12, cd: 4, level: 1, sp: 0,
  desc: "Golpe pesado em cone.", exec: { kind: "cone", range: 4, angle: 70, power: 1.9, stat: "strength", knock: 1.0, snd: "random.anvil_land" } }));
def(A("arcane_surge", { name: "Surto Arcano", cat: "Classe", element: "arcane", rarity: "rare", mana: 25, cd: 25, level: 1, sp: 0,
  desc: "+8 Inteligência e +50% regen. de mana por 20s.", exec: { kind: "buff", sec: 20, buff: { id: "arcane_surge", stats: { intelligence: 8, manaRegen: 50 } }, snd: "mob.evocation_illager.cast_spell" } }));
def(A("shadow_step", { name: "Passo Sombrio", cat: "Classe", element: "shadow", rarity: "rare", mana: 14, cd: 6, level: 1, sp: 0, stamina: 12,
  desc: "Avança entre os inimigos cortando tudo no caminho.", exec: { kind: "dash", power: 7, damage: 1.6, stat: "agility", snd: "mob.endermen.teleport" } }));
def(A("divine_shield", { name: "Escudo Divino", cat: "Classe", element: "light", rarity: "rare", mana: 25, cd: 20, level: 1, sp: 0,
  desc: "Absorve dano e aumenta resistências por 12s.", exec: { kind: "buff", sec: 12, absorb: 5, buff: { id: "divine_shield", stats: { defense: 10, res_magic: 20, res_physical: 10 } }, snd: "beacon.activate" } }));
def(A("piercing_shot", { name: "Disparo Perfurante", cat: "Classe", element: "physical", rarity: "rare", mana: 14, cd: 4, level: 1, sp: 0,
  desc: "Flecha de energia que atravessa inimigos.", exec: { kind: "beam", range: 36, width: 1.0, power: 1.9, stat: "agility", pierce: true, snd: "random.bow" } }));
def(A("shield_bash", { name: "Escudada", cat: "Classe", element: "physical", rarity: "uncommon", mana: 12, cd: 6, level: 1, sp: 0,
  desc: "Golpe de escudo que atordoa.", exec: { kind: "cone", range: 3.5, angle: 60, power: 1.4, stat: "strength", knock: 1.4, debuff: { id: "stun", sec: 2 }, snd: "item.shield.block" } }));
def(A("berserk_rage", { name: "Fúria Berserker", cat: "Classe", element: "blood", rarity: "rare", mana: 20, cd: 30, level: 1, sp: 0,
  desc: "+10 Força e 8% de roubo de vida por 15s, mas -5 de Defesa.", exec: { kind: "buff", sec: 15, buff: { id: "berserk_rage", stats: { strength: 10, lifesteal: 8, defense: -5 } }, snd: "mob.ravager.roar" } }));

import { PACK } from "./skillpack.gen.js";
for (const s of PACK) def(s);
import { AGILITY_SKILLS } from "./agility.js";
for (const s of AGILITY_SKILLS) def(s);   // Agilidades Supremas (uma linha por raça)

export const SKILL_LIST = Object.values(SKILLS);
export function learnable() { return SKILL_LIST.filter((s) => s.sp > 0); }

// ---------------------------------------------------------------- LORD DEMÔNIO / TRANSFORMAÇÃO DRACÔNICA (restaurados)
def(P("lord_demon_dominion", { name: "Domínio do Lord Demônio", cat: "Racial", rarity: "legendary", level: 1, sp: 0, desc: "Energia demoníaca do Lord Demônio: +4 Força, +4 Inteligência e 25% de resistência ao fogo.", stats: { strength: 4, intelligence: 4, res_fire: 25 } }));
// Transformação Dracônica: liga/desliga a forma de Dragão (systems/lineage.js, executor "dracform"). Só é concedida ao chegar nas formas finais da linha Dragonoide.
def(A("dragon_transform", { name: "Transformação Dracônica", cat: "Racial", element: "fire", rarity: "legendary", mana: 0, cd: 4, level: 1, sp: 0,
  desc: "Assume a forma de Dragão da sua linhagem (ou desfaz a forma). Aumenta atributos e vida, muda o modelo e dá habilidades dracônicas. A raça original continua registrada.",
  exec: { kind: "dracform" } }));

// ---------------------------------------------------------------- LINHAGENS DRACÔNICAS (concedidas por systems/lineage.js; árvore em data/lineages.js)
// Veldora (tempestade)
// 6.28.0 - etapas tardias da linhagem (ver data/lineages.js tiers com `bosses`). "Rei do Caos" = etapa superior pedida; o nome/detalhes canônicos não puderam ser confirmados na referência consultada (ver docs).
def(A("storm_wall", { name: "Muralha da Tempestade", cat: "Racial", element: "wind", rarity: "epic", mana: 38, cd: 26, level: 1, sp: 0,
  desc: "Ergue uma muralha de vento e relâmpagos: absorve dano, aumenta a defesa e a resistência a raios por 12s.", exec: { kind: "buff", sec: 12, absorb: 8, buff: { id: "storm_wall", stats: { defense: 10, res_lightning: 40, res_magic: 15 } }, snd: "ambient.weather.thunder" } }));
// Anti-Skill (Yuuki Kagurazaka): regras em config ANTISKILL e systems/antiskill.js. Obtida ao derrotar Yuuki (nível 60) pela Árvore de Poderes.
def(A("anti_skill", { name: "Anti-Skill", cat: "Única", element: "void", rarity: "mythic", mana: 45, cd: 24, level: 1, sp: 0,
  desc: "Aura de 8s: anula seus efeitos negativos simples (veneno, lentidão, fraqueza...), resiste em parte a atordoamento e paralisia e remove os efeitos positivos de inimigos num raio de 8 (chefes só perdem parte; Dragões Verdadeiros e Únicas são imunes).",
  exec: { kind: "antiskill", sec: 8, radius: 8, snd: "mob.evocation_illager.cast_spell" } }));
// Criador (Yuuki Kagurazaka): forja habilidades próprias (forma x elemento) nos espaços created_1..5. Regras em data/creations.js e systems/creator.js. O nome canônico/versão exata do poder de Yuuki não foi confirmado; "Criador" é a leitura usada.
def(A("creator", { name: "Criador", cat: "Única", element: "arcane", rarity: "mythic", mana: 0, cd: 1, level: 1, sp: 0,
  desc: "Habilidade Única de Yuuki: abre a forja onde você cria suas próprias habilidades combinando uma FORMA (projétil, raio, cone, explosão, onda, barreira) e um ELEMENTO. 5 espaços (Menor x2 no nv70, Maior x2 no nv80, Suprema no nv90); cada criação custa pontos de habilidade, fica salva e pode ser refeita.",
  exec: { kind: "creator_forge" } }));
for (const [n, t] of [[1, "I"], [2, "II"], [3, "III"], [4, "IV"], [5, "V"]]) {
  const sl = { 1: [28, 8], 2: [28, 8], 3: [50, 16], 4: [50, 16], 5: [85, 40] }[n];
  def(A("created_" + n, { name: "Criação " + t, cat: "Única", element: "arcane", rarity: "epic", mana: sl[0], cd: sl[1], level: 1, sp: 0,
    desc: "Habilidade forjada pelo Criador (espaço " + t + "). Forma e elemento definidos na forja: Habilidades > Árvore de Poderes > Criador.", exec: { kind: "creation", slot: n } }));
}
def(A("chaos_king", { name: "Tempestade do Caos", cat: "Única", element: "lightning", rarity: "divine", mana: 120, cd: 90, level: 1, sp: 0,
  desc: "Etapa Rei do Caos: libera a tempestade do Dragão em uma grande área (raio 14), com dano devastador, atordoamento curto e repulsão. Recarga longa; não destrói blocos.", exec: { kind: "target_aoe", range: 30, radius: 14, power: 9.0, stat: "intelligence", debuff: { id: "stun", sec: 2 }, knock: 1.4, snd: "ambient.weather.thunder" } }));
def(P("storm_scales", { name: "Escamas da Tempestade", cat: "Racial", rarity: "rare", level: 1, sp: 0, desc: "+2 Agilidade, +2 Vitalidade e 20% de resistência a raios.", stats: { agility: 2, vitality: 2, res_lightning: 20 } }));
def(A("windlash", { name: "Vendaval Cortante", cat: "Racial", element: "wind", rarity: "rare", mana: 16, cd: 5, level: 1, sp: 0,
  desc: "Lâmina de vento em arco que corta e empurra os inimigos à frente.", exec: { kind: "cone", range: 7, angle: 80, power: 1.9, stat: "intelligence", knock: 1.6, snd: "mob.horse.gallop" } }));
def(A("thunder_roar", { name: "Trovão Dracônico", cat: "Racial", element: "lightning", rarity: "epic", mana: 34, cd: 9, level: 1, sp: 0,
  desc: "Raio dracônico que salta entre até 5 inimigos.", exec: { kind: "chain", range: 26, jumps: 5, jumpRange: 7, power: 2.3, stat: "intelligence", snd: "ambient.weather.lightning.impact" } }));
def(P("tempest_aura", { name: "Aura da Tempestade", cat: "Racial", rarity: "epic", level: 1, sp: 0, desc: "+6 Inteligência, +4 Agilidade, 25% de resistência a raios e vento, +15% de regeneração de mana.", stats: { intelligence: 6, agility: 4, res_lightning: 25, res_wind: 25, manaRegen: 15 } }));
def(A("draconic_tempest", { name: "Tempestade Dracônica", cat: "Racial", element: "lightning", rarity: "legendary", mana: 85, cd: 40, level: 1, sp: 0,
  desc: "Desencadeia uma tempestade de raios e vento ao seu redor.", exec: { kind: "aoe_self", radius: 12, power: 5.4, stat: "intelligence", knock: 2.2, snd: "ambient.weather.thunder" } }));
// Velzard (gelo)
def(P("frost_scales", { name: "Escamas Glaciais", cat: "Racial", rarity: "rare", level: 1, sp: 0, desc: "+3 Defesa e 25% de resistência ao gelo.", stats: { defense: 3, res_ice: 25 } }));
def(A("frost_breath", { name: "Sopro Congelante", cat: "Racial", element: "ice", rarity: "rare", mana: 18, cd: 6, level: 1, sp: 0,
  desc: "Cone de frio extremo que deixa os alvos lentos.", exec: { kind: "cone", range: 8, angle: 60, power: 1.8, stat: "intelligence", debuff: { id: "chill", sec: 6 }, snd: "random.glass" } }));
def(A("absolute_freeze", { name: "Congelamento Absoluto", cat: "Racial", element: "ice", rarity: "epic", mana: 38, cd: 12, level: 1, sp: 0,
  desc: "Congela uma área: os inimigos ficam atordoados.", exec: { kind: "target_aoe", range: 22, radius: 6, power: 2.4, stat: "intelligence", debuff: { id: "stun", sec: 3 }, snd: "random.glass" } }));
def(P("temperature_control", { name: "Controle de Temperatura", cat: "Racial", rarity: "epic", level: 1, sp: 0, desc: "30% de resistência ao gelo, 20% ao fogo, +30 de mana e +4 Inteligência.", stats: { intelligence: 4, mana: 30, res_ice: 30, res_fire: 20 } }));
def(A("glacial_domain", { name: "Domínio Glacial", cat: "Racial", element: "ice", rarity: "legendary", mana: 85, cd: 40, level: 1, sp: 0,
  desc: "Um inverno súbito congela tudo ao redor.", exec: { kind: "aoe_self", radius: 12, power: 5.0, stat: "intelligence", debuff: { id: "stun", sec: 3 }, knock: 0.6, snd: "random.glass" } }));
// Velgrynd (fogo)
def(P("ember_scales", { name: "Escamas de Brasa", cat: "Racial", rarity: "rare", level: 1, sp: 0, desc: "+2 Força e 30% de resistência ao fogo.", stats: { strength: 2, res_fire: 30 } }));
def(A("flame_dash", { name: "Investida Flamejante", cat: "Racial", element: "fire", rarity: "rare", mana: 14, cd: 5, level: 1, sp: 0, stamina: 12,
  desc: "Avança numa explosão de calor, queimando quem atravessa.", exec: { kind: "dash", power: 8, damage: 1.5, stat: "agility", snd: "mob.blaze.shoot" } }));
def(A("inferno_breath", { name: "Sopro do Inferno", cat: "Racial", element: "fire", rarity: "epic", mana: 36, cd: 9, level: 1, sp: 0,
  desc: "Cone de chamas dracônicas em alta velocidade.", exec: { kind: "cone", range: 10, angle: 60, power: 3.6, stat: "intelligence", burn: 8, snd: "mob.blaze.shoot" } }));
def(P("crimson_heat", { name: "Calor Carmesim", cat: "Racial", rarity: "epic", level: 1, sp: 0, desc: "+5 Força, +4 Agilidade, 30% de resistência ao fogo e velocidade aumentada.", stats: { strength: 5, agility: 4, res_fire: 30 }, effects: [{ id: "speed", amp: 0 }] }));
def(A("dragon_inferno", { name: "Inferno Dracônico", cat: "Racial", element: "fire", rarity: "legendary", mana: 85, cd: 40, level: 1, sp: 0,
  desc: "Chuva de fogo dracônico sobre o alvo.", exec: { kind: "target_aoe", range: 24, radius: 9, power: 6.0, stat: "intelligence", burn: 10, snd: "mob.enderdragon.growl" } }));
// Veldanava (primordial)
def(P("divine_scales", { name: "Escamas Divinas", cat: "Racial", rarity: "epic", level: 1, sp: 0, desc: "+3 Defesa, +3 Inteligência, 15% de resistência mágica e +5% de XP.", stats: { defense: 3, intelligence: 3, res_magic: 15, xp: 5 } }));
def(A("creation_light", { name: "Luz da Criação", cat: "Racial", element: "light", rarity: "epic", mana: 40, cd: 12, level: 1, sp: 0,
  desc: "Coluna de luz primordial: fere os malignos e cura quem estiver na área.", exec: { kind: "target_aoe", range: 24, radius: 6, power: 2.6, stat: "intelligence", heal: 18, snd: "beacon.activate" } }));
def(A("primordial_authority", { name: "Autoridade Primordial", cat: "Racial", element: "light", rarity: "legendary", mana: 60, cd: 45, level: 1, sp: 0,
  desc: "Sua vontade é lei: fortalece você por 15s e cria uma barreira de energia divina.", exec: { kind: "buff", sec: 15, absorb: 6, buff: { id: "primordial_authority", stats: { strength: 8, defense: 8, intelligence: 10 } }, snd: "beacon.power_select" } }));
def(P("primordial_energy", { name: "Energia Primordial", cat: "Racial", rarity: "legendary", level: 1, sp: 0, desc: "+5 Força, +8 Inteligência, +5 Vitalidade, +40 de mana e +25% de regeneração de mana.", stats: { strength: 5, intelligence: 8, vitality: 5, mana: 40, manaRegen: 25 } }));
def(A("genesis_ray", { name: "Raio da Gênese", cat: "Racial", element: "light", rarity: "divine", mana: 110, cd: 50, level: 1, sp: 0,
  desc: "Feixe de criação pura que atravessa tudo em linha.", exec: { kind: "beam", range: 40, width: 2.2, power: 6.5, stat: "intelligence", pierce: true, snd: "beacon.activate" } }));

// ---------------------------------------------------------------- TÉCNICAS DOS MESTRES (ensinadas por NPCs: data/teachers.js; sp 0 = não aparecem na árvore comum)
// Espada
def(A("sword_flash", { name: "Corte Relâmpago", cat: "Espada", element: "physical", rarity: "uncommon", mana: 10, cd: 3, level: 1, sp: 0,
  desc: "Corte rapidíssimo em arco curto à frente.", exec: { kind: "cone", range: 4, angle: 50, power: 1.7, stat: "strength", snd: "mob.player.attack.sweep" } }));
def(A("sword_whirl", { name: "Giro de Lâminas", cat: "Espada", element: "physical", rarity: "rare", mana: 20, cd: 7, level: 1, sp: 0,
  desc: "Gira a lâmina atingindo todos ao redor.", exec: { kind: "aoe_self", radius: 4.5, power: 2.2, stat: "strength", knock: 1.0, snd: "mob.player.attack.sweep" } }));
def(A("sword_charge", { name: "Investida da Espada", cat: "Espada", element: "physical", rarity: "rare", mana: 18, cd: 8, level: 1, sp: 0, stamina: 12,
  desc: "Ataque carregado: avança e corta quem estiver no caminho.", exec: { kind: "dash", power: 7, damage: 2.2, stat: "strength", snd: "mob.player.attack.strong" } }));
def(A("sword_sovereign", { name: "Corte do Soberano", cat: "Espada", element: "physical", rarity: "legendary", mana: 60, cd: 24, level: 1, sp: 0,
  desc: "Técnica lendária: onda de corte que atravessa tudo em linha.", exec: { kind: "beam", range: 26, width: 2.0, power: 5.2, stat: "strength", pierce: true, snd: "mob.player.attack.strong" } }));
// Lança
def(A("spear_thrust", { name: "Estocada", cat: "Lança", element: "physical", rarity: "uncommon", mana: 10, cd: 3, level: 1, sp: 0,
  desc: "Estocada perfurante de longo alcance.", exec: { kind: "beam", range: 7, width: 0.9, power: 1.9, stat: "strength", pierce: true, snd: "mob.player.attack.strong" } }));
def(A("spear_dive", { name: "Mergulho da Lança", cat: "Lança", element: "wind", rarity: "rare", mana: 18, cd: 8, level: 1, sp: 0, stamina: 12,
  desc: "Investida veloz com a lança à frente.", exec: { kind: "dash", power: 8, damage: 1.9, stat: "agility", snd: "mob.horse.gallop" } }));
// Combate
def(A("parry_stance", { name: "Postura de Defesa", cat: "Combate", element: "physical", rarity: "uncommon", mana: 14, cd: 14, level: 1, sp: 0,
  desc: "Bloqueio perfeito: absorve dano e reforça a defesa por 8s.", exec: { kind: "buff", sec: 8, absorb: 4, buff: { id: "parry_stance", stats: { defense: 8 } }, snd: "random.anvil_land" } }));
def(A("counter_strike", { name: "Contra-ataque", cat: "Combate", element: "physical", rarity: "rare", mana: 16, cd: 8, level: 1, sp: 0,
  desc: "Golpe seco que arremessa o inimigo.", exec: { kind: "cone", range: 3.4, angle: 60, power: 2.0, stat: "strength", knock: 2.4, snd: "random.anvil_land" } }));
def(A("evasion_step", { name: "Passo de Esquiva", cat: "Combate", element: "wind", rarity: "uncommon", mana: 8, cd: 5, level: 1, sp: 0, stamina: 10,
  desc: "Esquiva rápida na direção que você olha.", exec: { kind: "dash", power: 5, damage: 0, stat: "agility", snd: "mob.horse.gallop" } }));
// Energia
def(A("focus_aura", { name: "Aura de Foco", cat: "Energia", element: "arcane", rarity: "rare", mana: 25, cd: 25, level: 1, sp: 0,
  desc: "Concentra a energia: +Inteligência e +Agilidade por 20s.", exec: { kind: "buff", sec: 20, buff: { id: "focus_aura", stats: { intelligence: 8, agility: 5 } }, snd: "random.orb" } }));
def(A("power_surge", { name: "Surto de Poder", cat: "Energia", element: "arcane", rarity: "epic", mana: 40, cd: 40, level: 1, sp: 0,
  desc: "Libera energia: +Força e +Defesa por 15s.", exec: { kind: "buff", sec: 15, buff: { id: "power_surge", stats: { strength: 10, defense: 6 } }, snd: "beacon.power_select" } }));
// Cura
def(A("mass_heal", { name: "Cura em Massa", cat: "Suporte", element: "light", rarity: "epic", mana: 45, cd: 20, level: 1, sp: 0,
  desc: "Onda de luz que cura você e todos os aliados num raio de 9 blocos.", exec: { kind: "heal", radius: 9, amount: 22, stat: "intelligence", scale: 0.8, snd: "random.levelup" } }));
// Anões
def(A("forge_blessing", { name: "Bênção da Forja", cat: "Racial", element: "fire", rarity: "rare", mana: 22, cd: 30, level: 1, sp: 0,
  desc: "A força do aço anão: +Defesa e +Força por 20s.", exec: { kind: "buff", sec: 20, buff: { id: "forge_blessing", stats: { defense: 9, strength: 5 } }, snd: "random.anvil_use" } }));
def(P("stone_skin", { name: "Pele de Pedra", cat: "Racial", rarity: "epic", level: 1, sp: 0, desc: "+5 Defesa, +3 Vitalidade e 15% de resistência física.", stats: { defense: 5, vitality: 3, res_physical: 15 } }));
def(A("dwarf_hammer", { name: "Martelo de Dwargon", cat: "Racial", element: "earth", rarity: "epic", mana: 30, cd: 12, level: 1, sp: 0,
  desc: "Golpe de martelo que atordoa os inimigos ao redor.", exec: { kind: "aoe_self", radius: 5, power: 2.6, stat: "strength", knock: 0.8, debuff: { id: "stun", sec: 2 }, snd: "random.anvil_land" } }));
// Guy Crimson
def(A("crimson_wave", { name: "Onda Carmesim", cat: "Racial", element: "blood", rarity: "legendary", mana: 55, cd: 18, level: 1, sp: 0,
  desc: "Onda de energia rubra que atravessa os inimigos.", exec: { kind: "beam", range: 30, width: 2.0, power: 4.6, stat: "intelligence", pierce: true, snd: "mob.wither.shoot" } }));
def(A("overlord_presence", { name: "Presença do Soberano", cat: "Racial", element: "void", rarity: "legendary", mana: 60, cd: 30, level: 1, sp: 0,
  desc: "Uma aura esmagadora paralisa os inimigos ao redor.", exec: { kind: "aoe_self", radius: 9, power: 2.2, stat: "intelligence", debuff: { id: "stun", sec: 3 }, snd: "mob.wither.ambient" } }));
def(P("crimson_authority", { name: "Autoridade Carmesim", cat: "Racial", rarity: "legendary", level: 1, sp: 0, desc: "+6 Inteligência, +5 Força, +10% de crítico e 4% de roubo de vida.", stats: { intelligence: 6, strength: 5, crit: 10, lifesteal: 4 } }));
// Orcs
def(A("orc_fury", { name: "Fúria Orc", cat: "Racial", element: "blood", rarity: "rare", mana: 20, cd: 25, level: 1, sp: 0,
  desc: "Fúria bruta: +Força e roubo de vida por 15s, mas menos defesa.", exec: { kind: "buff", sec: 15, buff: { id: "orc_fury", stats: { strength: 12, defense: -4, lifesteal: 8 } }, snd: "mob.ravager.roar" } }));
def(A("devour_flesh", { name: "Devorar Carne", cat: "Racial", element: "blood", rarity: "epic", mana: 24, cd: 10, level: 1, sp: 0,
  desc: "Mordida que drena a vida do alvo.", exec: { kind: "cone", range: 3.4, angle: 50, power: 2.2, stat: "strength", drain: 0.6, snd: "mob.player.hurt" } }));
def(P("orc_hide", { name: "Couro Orc", cat: "Racial", rarity: "rare", level: 1, sp: 0, desc: "+4 Vitalidade, +3 Defesa e +15 de vida.", stats: { vitality: 4, defense: 3, hp: 15 } }));
// Lendário
def(A("legend_resolve", { name: "Resolução Lendária", cat: "Única", element: "light", rarity: "mythic", mana: 70, cd: 60, level: 1, sp: 0,
  desc: "Habilidade lendária: fortalece tudo por 20s e cura uma grande parte da vida.", exec: { kind: "buff", sec: 20, absorb: 10, buff: { id: "legend_resolve", stats: { strength: 12, defense: 12, intelligence: 12, agility: 6 } }, snd: "beacon.power_select" } }));

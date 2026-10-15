// data/agility.js - AGILIDADES SUPREMAS (6.29): uma linha de mobilidade própria para CADA raça, com 3 estágios (Comum → Única → Suprema),
// integrada à Árvore de Poderes (systems/powers.js) e executada por systems/agility.js (exec.kind "agility").
// Modos (exec.mode) — cada um é uma mecânica real diferente:
//   surge     investida veloz: impulso para a frente, golpeia quem estiver no caminho (dano, empurrão), rastro de ar deslocado
//   blink     deslocamento instantâneo de curta distância (destino seguro: chão + 2 blocos livres), imagem residual
//   phase     passo dimensional: reaparece ÀS COSTAS do alvo na mira (ou à frente, sem alvo) e o próximo golpe é crítico
//   airdash   movimentação aérea: salto/arranque no ar (funciona em pleno voo/queda), queda amortecida; slam = impacto ao aterrissar
//   overdrive aceleração sobrenatural: velocidade, salto e pressa por alguns segundos, com rastro de imagens residuais
//   rift      deslocamento dimensional longo: atravessa até o ponto da mira (até 32 blocos), invisível por instantes
// Passivas (dodge): esquiva automática — chance de anular um golpe recebido e escorregar para o lado (recarga própria).
// Requisitos por estágio (verificados nos dados reais do jogador): raça · nível · profundidade de evolução da raça · chefes derrotados.

const A = (id, o) => ({ id, type: "active", sp: 0, req: [], cat: "Agilidade Suprema", ...o });
const P = (id, o) => ({ id, type: "passive", mana: 0, cd: 0, sp: 0, req: [], cat: "Agilidade Suprema", ...o });

/** requisitos padrão de cada estágio (o 3º é Supremo: exige chefes derrotados) */
export const AGI_GATES = [
  { level: 10, depth: 1, bosses: 0, cls: "common" },
  { level: 35, depth: 2, bosses: 0, cls: "unique" },
  { level: 70, depth: 3, bosses: 2, cls: "supreme" },
];

// race -> { name, col (cor do tema), stages: [skill, skill, skill] }
export const AGILITY_LINES = {
  human: { name: "Passos do Herói", col: "§f", fx: ["light", "gold"], stages: [
    A("agi_human_1", { name: "Investida Ágil", element: "light", rarity: "uncommon", mana: 8, stamina: 10, cd: 4, level: 10, desc: "Avança 7 blocos golpeando quem estiver no caminho.", exec: { kind: "agility", mode: "surge", dist: 7, damage: 1.0, stat: "agility", snd: "mob.horse.gallop" } }),
    P("agi_human_2", { name: "Reflexos Aprimorados", element: "light", rarity: "epic", level: 35, desc: "Esquiva automática: 12% de chance de anular um golpe e escorregar para o lado (recarga 6 s). +4 Agilidade.", stats: { agility: 4 }, dodge: { chance: 0.12, cd: 6 } }),
    A("agi_human_3", { name: "Aceleração Heroica", element: "gold", rarity: "mythic", mana: 40, cd: 30, level: 70, desc: "Aceleração sobrenatural por 10 s: Velocidade III, Salto II, Pressa II e imagens residuais.", exec: { kind: "agility", mode: "overdrive", sec: 10, speed: 2, jump: 1, haste: 1, snd: "beacon.power_select" } }),
  ] },
  slime: { name: "Corpo Sem Forma", col: "§b", fx: ["sage", "water"], stages: [
    A("agi_slime_1", { name: "Salto Elástico", element: "water", rarity: "uncommon", mana: 6, cd: 3, level: 10, desc: "Corpo de slime: arranque elástico no chão OU no ar, sem dano de queda.", exec: { kind: "agility", mode: "airdash", power: 1.6, up: 0.7, snd: "mob.slime.big" } }),
    A("agi_slime_2", { name: "Deslize Viscoso", element: "water", rarity: "epic", mana: 14, stamina: 8, cd: 5, level: 35, desc: "Desliza 9 blocos deixando os atingidos lentos.", exec: { kind: "agility", mode: "surge", dist: 9, damage: 1.2, stat: "intelligence", slow: 3, snd: "mob.slime.attack" } }),
    A("agi_slime_3", { name: "Passo Dimensional do Predador", element: "void", rarity: "mythic", mana: 35, cd: 12, level: 70, desc: "Movimento dimensional: atravessa o espaço até o ponto da mira (até 32 blocos), invisível por 2 s.", exec: { kind: "agility", mode: "rift", range: 32, invis: 2, snd: "mob.endermen.portal" } }),
  ] },
  goblin: { name: "Passos da Matilha", col: "§a", fx: ["green", "toxic"], stages: [
    A("agi_goblin_1", { name: "Fuga Rasteira", element: "wind", rarity: "uncommon", mana: 6, cd: 4, level: 10, desc: "Deslocamento instantâneo de 6 blocos.", exec: { kind: "agility", mode: "blink", dist: 6, snd: "mob.endermen.portal" } }),
    A("agi_goblin_2", { name: "Bote do Lobo", element: "wind", rarity: "epic", mana: 16, cd: 7, level: 35, desc: "Reaparece às costas do alvo na mira (até 16 blocos); desfere um golpe crítico pelas costas.", exec: { kind: "agility", mode: "phase", range: 16, crit: 1.5, snd: "mob.wolf.growl" } }),
    A("agi_goblin_3", { name: "Matilha Fantasma", element: "green", rarity: "mythic", mana: 38, cd: 28, level: 70, desc: "Aceleração sobrenatural por 12 s (Velocidade III, Salto II) com imagens residuais.", exec: { kind: "agility", mode: "overdrive", sec: 12, speed: 2, jump: 1, haste: 0, snd: "mob.wolf.bark" } }),
  ] },
  demon: { name: "Trilha Infernal", col: "§c", fx: ["fire", "shadow"], stages: [
    A("agi_demon_1", { name: "Passo Sombrio", element: "shadow", rarity: "uncommon", mana: 8, cd: 4, level: 10, desc: "Some na sombra e reaparece 7 blocos à frente.", exec: { kind: "agility", mode: "blink", dist: 7, snd: "mob.endermen.portal" } }),
    A("agi_demon_2", { name: "Salto Infernal", element: "fire", rarity: "epic", mana: 16, cd: 6, level: 35, desc: "Arranque aéreo envolto em chamas; ao aterrissar, explode queimando ao redor.", exec: { kind: "agility", mode: "airdash", power: 2.0, up: 0.9, slam: { radius: 4, damage: 1.6, stat: "intelligence", burn: 3 }, snd: "mob.blaze.shoot" } }),
    A("agi_demon_3", { name: "Deslocamento Abissal", element: "void", rarity: "mythic", mana: 38, cd: 12, level: 70, desc: "Rasga o espaço até o ponto da mira (até 32 blocos) e fica invisível por 2 s.", exec: { kind: "agility", mode: "rift", range: 32, invis: 2, snd: "mob.wither.shoot" } }),
  ] },
  elf: { name: "Dança dos Ventos", col: "§b", fx: ["wind", "green"], stages: [
    A("agi_elf_1", { name: "Passo do Vento", element: "wind", rarity: "uncommon", mana: 7, stamina: 8, cd: 3, level: 10, desc: "Investida leve de 8 blocos.", exec: { kind: "agility", mode: "surge", dist: 8, damage: 0.8, stat: "agility", snd: "mob.horse.gallop" } }),
    P("agi_elf_2", { name: "Esquiva Silvestre", element: "wind", rarity: "epic", level: 35, desc: "Esquiva automática: 15% de chance de anular um golpe (recarga 5 s). +5 Agilidade.", stats: { agility: 5 }, dodge: { chance: 0.15, cd: 5 } }),
    A("agi_elf_3", { name: "Rajada Celeste", element: "wind", rarity: "mythic", mana: 30, cd: 8, level: 70, desc: "Movimentação aérea avançada: três arranques seguidos no ar, sem dano de queda.", exec: { kind: "agility", mode: "airdash", power: 2.2, up: 0.8, charges: 3, snd: "mob.phantom.flap" } }),
  ] },
  angel: { name: "Asas da Luz", col: "§e", fx: ["holy", "light"], stages: [
    A("agi_angel_1", { name: "Planar Celeste", element: "holy", rarity: "uncommon", mana: 8, cd: 4, level: 10, desc: "Arranque com as asas: sobe e plana sem dano de queda.", exec: { kind: "agility", mode: "airdash", power: 1.4, up: 1.0, glide: 3, snd: "mob.phantom.flap" } }),
    A("agi_angel_2", { name: "Asa Luminosa", element: "light", rarity: "epic", mana: 16, cd: 5, level: 35, desc: "Investida de luz de 10 blocos que cega quem atravessa.", exec: { kind: "agility", mode: "surge", dist: 10, damage: 1.4, stat: "intelligence", blind: 2, snd: "beacon.activate" } }),
    A("agi_angel_3", { name: "Passo Divino", element: "holy", rarity: "mythic", mana: 36, cd: 12, level: 70, desc: "Deslocamento divino até o ponto da mira (até 32 blocos), cura 15% da vida.", exec: { kind: "agility", mode: "rift", range: 32, invis: 1, heal: 0.15, snd: "beacon.power_select" } }),
  ] },
  dragonoid: { name: "Voo do Dragão", col: "§6", fx: ["fire", "gold"], stages: [
    A("agi_dragonoid_1", { name: "Investida Dracônica", element: "fire", rarity: "uncommon", mana: 10, stamina: 12, cd: 5, level: 10, desc: "Arremetida de 7 blocos com força de dragão.", exec: { kind: "agility", mode: "surge", dist: 7, damage: 1.6, stat: "strength", knock: 1.2, snd: "mob.enderdragon.flap" } }),
    A("agi_dragonoid_2", { name: "Voo Rasante", element: "fire", rarity: "epic", mana: 16, cd: 5, level: 35, desc: "Arranque aéreo poderoso; ao aterrissar, onda de choque de fogo.", exec: { kind: "agility", mode: "airdash", power: 2.4, up: 0.8, slam: { radius: 5, damage: 2.0, stat: "strength", burn: 2 }, snd: "mob.enderdragon.flap" } }),
    A("agi_dragonoid_3", { name: "Investida Supersônica", element: "gold", rarity: "mythic", mana: 40, stamina: 20, cd: 14, level: 70, desc: "Rompe a barreira do som: 16 blocos de investida com estrondo sônico que arremessa os inimigos.", exec: { kind: "agility", mode: "surge", dist: 16, damage: 3.2, stat: "strength", knock: 2.2, boom: true, snd: "mob.warden.sonic_boom" } }),
  ] },
  beastkin: { name: "Instinto Selvagem", col: "§e", fx: ["earth", "wind"], stages: [
    A("agi_beastkin_1", { name: "Bote Feral", element: "earth", rarity: "uncommon", mana: 6, stamina: 10, cd: 3, level: 10, desc: "Salta sobre a presa: investida de 7 blocos.", exec: { kind: "agility", mode: "surge", dist: 7, damage: 1.2, stat: "agility", snd: "mob.cat.hiss" } }),
    P("agi_beastkin_2", { name: "Reflexo Bestial", element: "earth", rarity: "epic", level: 35, desc: "Esquiva automática: 18% de chance de anular um golpe (recarga 5 s). +3 Agilidade, +2 Força.", stats: { agility: 3, strength: 2 }, dodge: { chance: 0.18, cd: 5 } }),
    A("agi_beastkin_3", { name: "Velocidade Bestial", element: "wind", rarity: "mythic", mana: 36, cd: 26, level: 70, desc: "Aceleração sobrenatural por 12 s: Velocidade IV, Salto III e Pressa I.", exec: { kind: "agility", mode: "overdrive", sec: 12, speed: 3, jump: 2, haste: 0, snd: "mob.ravager.roar" } }),
  ] },
  undead: { name: "Passos Espectrais", col: "§8", fx: ["shadow", "black"], stages: [
    A("agi_undead_1", { name: "Passo Espectral", element: "shadow", rarity: "uncommon", mana: 8, cd: 4, level: 10, desc: "Atravessa 6 blocos como um espectro.", exec: { kind: "agility", mode: "blink", dist: 6, snd: "mob.vex.charge" } }),
    A("agi_undead_2", { name: "Névoa Fantasma", element: "shadow", rarity: "epic", mana: 16, cd: 7, level: 35, desc: "Reaparece às costas do alvo na mira e desfere um golpe que drena vida.", exec: { kind: "agility", mode: "phase", range: 16, crit: 1.4, drain: 0.3, snd: "mob.vex.ambient" } }),
    A("agi_undead_3", { name: "Caminhar entre Mundos", element: "void", rarity: "mythic", mana: 36, cd: 12, level: 70, desc: "Cruza o limiar da morte até o ponto da mira (até 32 blocos), invisível por 3 s.", exec: { kind: "agility", mode: "rift", range: 32, invis: 3, snd: "mob.wither.ambient" } }),
  ] },
  ogre: { name: "Fúria Oni", col: "§4", fx: ["ember", "earth"], stages: [
    A("agi_ogre_1", { name: "Arremetida Oni", element: "earth", rarity: "uncommon", mana: 8, stamina: 14, cd: 5, level: 10, desc: "Arremetida brutal de 6 blocos que derruba quem estiver no caminho.", exec: { kind: "agility", mode: "surge", dist: 6, damage: 1.8, stat: "strength", knock: 1.6, snd: "mob.ravager.stun" } }),
    A("agi_ogre_2", { name: "Salto Kijin", element: "earth", rarity: "epic", mana: 18, cd: 7, level: 35, desc: "Salto alto; ao cair, impacto que atordoa ao redor.", exec: { kind: "agility", mode: "airdash", power: 1.2, up: 1.2, slam: { radius: 5, damage: 2.4, stat: "strength", stun: 1 }, snd: "mob.irongolem.throw" } }),
    A("agi_ogre_3", { name: "Passo Relâmpago Oni", element: "bolt", rarity: "mythic", mana: 40, stamina: 20, cd: 14, level: 70, desc: "Corte-relâmpago: 14 blocos em um piscar, golpeando tudo no trajeto.", exec: { kind: "agility", mode: "surge", dist: 14, damage: 3.4, stat: "strength", knock: 1.2, boom: true, snd: "ambient.weather.lightning.impact" } }),
  ] },
  lizardman: { name: "Correnteza", col: "§3", fx: ["water", "foam"], stages: [
    A("agi_lizardman_1", { name: "Deslize Aquático", element: "water", rarity: "uncommon", mana: 7, stamina: 8, cd: 4, level: 10, desc: "Investida de 7 blocos (12 dentro d'água).", exec: { kind: "agility", mode: "surge", dist: 7, wet: 12, damage: 1.1, stat: "agility", snd: "random.splash" } }),
    P("agi_lizardman_2", { name: "Reflexo Reptiliano", element: "water", rarity: "epic", level: 35, desc: "Esquiva automática: 15% de chance de anular um golpe (recarga 5 s). +3 Agilidade, +2 Defesa.", stats: { agility: 3, defense: 2 }, dodge: { chance: 0.15, cd: 5 } }),
    A("agi_lizardman_3", { name: "Corrente Abissal", element: "water", rarity: "mythic", mana: 34, cd: 24, level: 70, desc: "Aceleração por 12 s: Velocidade III, Golfinho e respiração aquática.", exec: { kind: "agility", mode: "overdrive", sec: 12, speed: 2, jump: 1, haste: 0, water: true, snd: "random.splash" } }),
  ] },
  vampire: { name: "Asas da Noite", col: "§5", fx: ["blood", "violet"], stages: [
    A("agi_vampire_1", { name: "Revoada de Morcegos", element: "shadow", rarity: "uncommon", mana: 8, cd: 4, level: 10, desc: "Desfaz-se em morcegos e reaparece 7 blocos à frente.", exec: { kind: "agility", mode: "blink", dist: 7, snd: "mob.bat.takeoff" } }),
    A("agi_vampire_2", { name: "Passo Sanguíneo", element: "blood", rarity: "epic", mana: 16, cd: 7, level: 35, desc: "Reaparece às costas do alvo na mira; golpe crítico pelas costas que drena vida.", exec: { kind: "agility", mode: "phase", range: 18, crit: 1.6, drain: 0.4, snd: "mob.bat.takeoff" } }),
    A("agi_vampire_3", { name: "Noite Eterna", element: "void", rarity: "mythic", mana: 38, cd: 12, level: 70, desc: "Atravessa a escuridão até o ponto da mira (até 32 blocos), invisível por 3 s.", exec: { kind: "agility", mode: "rift", range: 32, invis: 3, snd: "mob.wither.shoot" } }),
  ] },
  dwarf: { name: "Passo da Montanha", col: "§6", fx: ["earth", "steel"], stages: [
    A("agi_dwarf_1", { name: "Rolamento Blindado", element: "earth", rarity: "uncommon", mana: 6, stamina: 10, cd: 4, level: 10, desc: "Rola 5 blocos com Resistência II por 2 s.", exec: { kind: "agility", mode: "surge", dist: 5, damage: 1.0, stat: "defense", resist: 2, snd: "random.anvil_land" } }),
    P("agi_dwarf_2", { name: "Passo Firme", element: "earth", rarity: "epic", level: 35, desc: "Esquiva automática: 10% de chance de anular um golpe (recarga 6 s). +4 Defesa.", stats: { defense: 4 }, dodge: { chance: 0.10, cd: 6 } }),
    A("agi_dwarf_3", { name: "Avalanche de Pedra", element: "earth", rarity: "mythic", mana: 38, stamina: 20, cd: 14, level: 70, desc: "Investida de 12 blocos como uma avalanche, com onda de choque que atordoa.", exec: { kind: "agility", mode: "surge", dist: 12, damage: 3.0, stat: "strength", knock: 1.8, stun: 1, boom: true, snd: "random.explode" } }),
  ] },
};
export const AGILITY_SKILLS = Object.values(AGILITY_LINES).flatMap((l) => l.stages);
/** id da habilidade -> { race, idx } */
export const AGILITY_OF = Object.fromEntries(Object.entries(AGILITY_LINES).flatMap(([race, l]) => l.stages.map((s, idx) => [s.id, { race, idx }])));

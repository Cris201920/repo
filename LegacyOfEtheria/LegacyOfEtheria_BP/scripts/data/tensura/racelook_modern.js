// Aparência de cada raça (índices das partes geradas no build a partir do mod):
// wings 1 pequena 2 média 3 grande 4 rasgada (demônio) 5 dragão 6 anjo 7 harpia 8 morcego 9 dourada
// horns 1 único pequeno 2 único 3 duplo pequeno 4 duplo 5 zigue-zague 6 curvo 7 carneiro 8 lagarto 9 dragão dourado
// tail 1 demônio 2 lagarto 3 dragão vermelho 4 pelo 5 dragão  | ears 1 goblin 2 elfo 3 fera 4 tritão
// halo 1 dourada 2 arcana 3 flamejante 4 sombria | aura 1 trevas 2 sagrada 3 dracônica 4 água 5 morcegos 6 terra 7 almas 8 natureza
export const RACE_LOOK = {
  angel: { wings: 6 }, angel_guardian: { wings: 6, aura: 2 }, angel_healer: { wings: 6, halo: 1, aura: 2 }, archangel: { wings: 9, halo: 1, aura: 2 }, holy_angel: { wings: 6, halo: 1, aura: 2 }, seraph: { wings: 9, halo: 2, aura: 2 },
  slime: {}, demon_slime: { aura: 4 }, god_slime: { wings: 3, aura: 1, halo: 4 }, metal_slime: { aura: 6 },
  goblin: { ears: 1 }, hobgoblin: { ears: 1 }, enlightened_hobgoblin: { ears: 1, aura: 8 }, hobgoblin_saint: { ears: 1, halo: 1, aura: 2 },
  ogre: { horns: 3 }, enlightened_ogre: { horns: 3, aura: 6 }, kijin: { body: 1, horns: 4 }, mystic_oni: { body: 2, horns: 4, aura: 2 }, wicked_oni: { body: 2, horns: 7, aura: 1 },
  divine_oni: { body: 2, horns: 4, halo: 1, aura: 2 }, death_oni: { body: 2, horns: 5, aura: 7 }, spirit_oni: { body: 2, horns: 2, aura: 7 },
  orc: {}, high_orc: {}, orc_lord: { aura: 6 }, orc_disaster: { horns: 3, aura: 1 }, spirit_boar: { horns: 7, aura: 7 }, divine_boar: { horns: 7, halo: 1, aura: 2 },
  human: {}, enlightened_human: { aura: 8 }, human_saint: { halo: 1, aura: 2 }, divine_human: { wings: 6, halo: 1, aura: 2 }, divine_fighter: { aura: 6 },
  lizardman: { tail: 2, horns: 8 }, dragonewt: { body: 3, tail: 2, horns: 8, aura: 3 }, true_dragonewt: { body: 3, tail: 5, horns: 8, wings: 5, aura: 3 },
  divine_dragon: { body: 3, tail: 5, horns: 9, wings: 5, halo: 3, aura: 3 },
  dragonoid: { tail: 3, horns: 6 }, dragon_lord: { tail: 3, horns: 6, wings: 5, aura: 3 }, true_dragon: { tail: 5, horns: 9, wings: 5, aura: 3, halo: 3 },
  giant: {}, ancient_giant: { aura: 6 }, divine_giant: { halo: 1, aura: 6 },
  harpy: { wings: 7 }, harpy_queen: { wings: 7, aura: 8 }, spirit_bird: { wings: 6, aura: 2 }, divine_bird: { wings: 9, halo: 1, aura: 2 },
  merfolk: { ears: 4, aura: 4 }, enlightened_merfolk: { ears: 4, aura: 4 }, merfolk_saint: { ears: 4, halo: 1, aura: 4 }, divine_fish: { ears: 4, halo: 2, aura: 4 },
  lesser_daemon: { wings: 1, horns: 1, tail: 1 }, greater_daemon: { body: 4, wings: 2, horns: 3, tail: 1, aura: 1 }, arch_daemon: { body: 5, wings: 3, horns: 4, tail: 1, aura: 1 },
  daemon_lord: { body: 5, wings: 3, horns: 7, tail: 1, aura: 1, halo: 4 }, devil_lord: { body: 5, wings: 4, horns: 6, tail: 1, aura: 1, halo: 4 },
  vampire: { wings: 8, aura: 5 }, vampire_lord: { wings: 8, aura: 5 }, divine_vampire: { wings: 8, aura: 5, halo: 4 }, vampire_overcomer: { wings: 4, aura: 5 },
  elf: { ears: 2 }, enlightened_elf: { ears: 2, aura: 8 }, elf_saint: { ears: 2, halo: 1, aura: 8 }, divine_elf: { ears: 2, halo: 1, wings: 6, aura: 2 },
  dwarf: {}, enlightened_dwarf: { aura: 6 }, dwarf_saint: { halo: 1, aura: 6 }, divine_dwarf: { halo: 1, aura: 2 },
  beastfolk: { ears: 3, tail: 4 }, beast_lord: { ears: 3, tail: 4, aura: 6 }, divine_beast: { ears: 3, tail: 4, halo: 1, aura: 2 }, spirit_beast: { ears: 3, tail: 4, aura: 7 },
  // v6.1 — novas linhas
  night_stalker: { wings: 8, aura: 5, ears: 2 }, dragonewt_human: { body: 3, horns: 8, aura: 3, wings: 5 }, caitsith: { ears: 3, tail: 4, aura: 7 }, okami: { ears: 3, tail: 4, aura: 6 },
  cyclops: { horns: 1, aura: 6 }, true_hero: { halo: 1, wings: 6, aura: 2 }, fascinator_elf: { ears: 2, wings: 1, halo: 2, aura: 8 },
  insect: {}, insectar: { body: 6, wings: 1, aura: 8 }, spirit_insect: { body: 6, wings: 2, aura: 7 }, divine_insect: { body: 6, wings: 3, halo: 1, aura: 2 },
  fairy: { wings: 1, aura: 8 }, dryad: { wings: 1, ears: 2, aura: 8 }, elemental_spirit: { wings: 2, halo: 2, aura: 3 }, great_spirit: { wings: 6, halo: 2, aura: 2 },
  direwolf: { ears: 3, tail: 4 }, tempest_wolf: { ears: 3, tail: 4, aura: 7 }, tempest_starwolf: { ears: 3, tail: 4, aura: 1, halo: 4 },
  wight: { aura: 7 }, ghoul: { aura: 1 }, wight_king: { horns: 2, aura: 7 }, spirit_skeleton: { aura: 7, halo: 4 }, divine_skeleton: { halo: 4, aura: 7 },
};

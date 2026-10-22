// GERADO por tools/build.py a partir de tools/content.py - não edite à mão.
export const ITEMS = {
 "etheria:iron_blade": {
  "id": "etheria:iron_blade",
  "name": "Lâmina de Ferro Reforçado",
  "rarity": "common",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 6,
   "strength": 2
  },
  "price": 120,
  "sell": 30
 },
 "etheria:knight_sword": {
  "id": "etheria:knight_sword",
  "name": "Espada do Cavaleiro",
  "rarity": "uncommon",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 9,
   "strength": 4,
   "defense": 2
  },
  "price": 420,
  "sell": 100
 },
 "etheria:flame_sword": {
  "id": "etheria:flame_sword",
  "name": "Espada Flamejante",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 14,
   "strength": 15,
   "crit": 5,
   "fire": 10
  },
  "onHit": {
   "kind": "burn",
   "sec": 5,
   "chance": 0.25,
   "name": "Chama Infernal"
  },
  "price": 3500,
  "sell": 800
 },
 "etheria:void_sword": {
  "id": "etheria:void_sword",
  "name": "Espada do Vazio",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 20,
   "strength": 20,
   "crit": 8,
   "void": 15,
   "lifesteal": 3
  },
  "onHit": {
   "kind": "bleed",
   "sec": 6,
   "chance": 0.3,
   "name": "Fissura do Vazio"
  },
  "price": 9000,
  "sell": 2200
 },
 "etheria:celestial_blade": {
  "id": "etheria:celestial_blade",
  "name": "Lâmina Celestial",
  "rarity": "mythic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 28,
   "strength": 25,
   "intelligence": 10,
   "crit": 10,
   "light": 20
  },
  "onHit": {
   "kind": "heal",
   "amount": 3,
   "chance": 0.2,
   "name": "Bênção Celestial"
  },
  "price": 22000,
  "sell": 5000
 },
 "etheria:shadow_dagger": {
  "id": "etheria:shadow_dagger",
  "name": "Adaga Sombria",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "dagger",
  "stats": {
   "atk": 5,
   "agility": 8,
   "crit": 12,
   "critDmg": 20
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Corte Venenoso"
  },
  "price": 1400,
  "sell": 300
 },
 "etheria:wyrm_spear": {
  "id": "etheria:wyrm_spear",
  "name": "Lança Dracônica",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "spear",
  "stats": {
   "atk": 16,
   "strength": 12,
   "vitality": 4,
   "fire": 8
  },
  "onHit": {
   "kind": "burn",
   "sec": 3,
   "chance": 0.2,
   "name": "Sopro de Wyrm"
  },
  "price": 3800,
  "sell": 900
 },
 "etheria:berserker_axe": {
  "id": "etheria:berserker_axe",
  "name": "Machado Berserker",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "axe",
  "stats": {
   "atk": 15,
   "strength": 10,
   "lifesteal": 4,
   "defense": -2
  },
  "price": 1600,
  "sell": 350
 },
 "etheria:storm_bow": {
  "id": "etheria:storm_bow",
  "name": "Arco da Tempestade",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "bow",
  "ranged": {
   "range": 40,
   "element": "lightning",
   "cost": 8,
   "cd": 14
  },
  "stats": {
   "atk": 12,
   "agility": 10,
   "crit": 8
  },
  "price": 3200,
  "sell": 700
 },
 "etheria:arcane_staff": {
  "id": "etheria:arcane_staff",
  "name": "Cajado Arcano",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "staff",
  "caster": true,
  "stats": {
   "atk": 3,
   "intelligence": 12,
   "manaCost": 10
  },
  "price": 1500,
  "sell": 320
 },
 "etheria:void_grimoire": {
  "id": "etheria:void_grimoire",
  "name": "Grimório do Vazio",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "tome",
  "caster": true,
  "stats": {
   "intelligence": 18,
   "void": 12,
   "manaCost": 15
  },
  "price": 4200,
  "sell": 1000
 },
 "etheria:reaper_scythe": {
  "id": "etheria:reaper_scythe",
  "name": "Foice Ceifadora",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "scythe",
  "stats": {
   "atk": 22,
   "strength": 14,
   "intelligence": 8,
   "lifesteal": 6
  },
  "onHit": {
   "kind": "bleed",
   "sec": 6,
   "chance": 0.3,
   "name": "Ceifa de Almas"
  },
  "price": 8500,
  "sell": 2000
 },
 "etheria:goblin_king_club": {
  "id": "etheria:goblin_king_club",
  "name": "Clava do Rei Goblin",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "club",
  "stats": {
   "atk": 18,
   "strength": 14,
   "vitality": 6
  },
  "onHit": {
   "kind": "slow",
   "sec": 3,
   "chance": 0.3,
   "name": "Pancada Atordoante"
  },
  "price": 0,
  "sell": 900,
  "boss": true
 },
 "etheria:ember_fang": {
  "id": "etheria:ember_fang",
  "name": "Presa do Tirano Brasa",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 24,
   "strength": 18,
   "fire": 18
  },
  "onHit": {
   "kind": "burn",
   "sec": 6,
   "chance": 0.35,
   "name": "Brasa Voraz"
  },
  "price": 0,
  "sell": 2500,
  "boss": true
 },
 "etheria:void_scepter": {
  "id": "etheria:void_scepter",
  "name": "Cetro do Senhor do Vazio",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "staff",
  "caster": true,
  "stats": {
   "atk": 4,
   "intelligence": 26,
   "void": 20,
   "manaCost": 20,
   "critDmg": 15
  },
  "price": 0,
  "sell": 2600,
  "boss": true
 },
 "etheria:iron_reinforced_helmet": {
  "id": "etheria:iron_reinforced_helmet",
  "name": "Capacete de Ferro Reforçado",
  "rarity": "common",
  "kind": "armor",
  "stats": {
   "defense": 2
  },
  "set": "iron_reinforced",
  "slot": "Head",
  "price": 200,
  "sell": 48,
  "protection": 1,
  "durability": 153
 },
 "etheria:iron_reinforced_chest": {
  "id": "etheria:iron_reinforced_chest",
  "name": "Peitoral de Ferro Reforçado",
  "rarity": "common",
  "kind": "armor",
  "stats": {
   "defense": 4
  },
  "set": "iron_reinforced",
  "slot": "Chest",
  "price": 350,
  "sell": 84,
  "protection": 2,
  "durability": 268
 },
 "etheria:iron_reinforced_legs": {
  "id": "etheria:iron_reinforced_legs",
  "name": "Calças de Ferro Reforçado",
  "rarity": "common",
  "kind": "armor",
  "stats": {
   "defense": 3
  },
  "set": "iron_reinforced",
  "slot": "Legs",
  "price": 275,
  "sell": 66,
  "protection": 1,
  "durability": 211
 },
 "etheria:iron_reinforced_boots": {
  "id": "etheria:iron_reinforced_boots",
  "name": "Botas de Ferro Reforçado",
  "rarity": "common",
  "kind": "armor",
  "stats": {
   "defense": 2
  },
  "set": "iron_reinforced",
  "slot": "Feet",
  "price": 175,
  "sell": 42,
  "protection": 1,
  "durability": 134
 },
 "etheria:knight_helmet": {
  "id": "etheria:knight_helmet",
  "name": "Capacete do Cavaleiro",
  "rarity": "uncommon",
  "kind": "armor",
  "stats": {
   "defense": 4,
   "vitality": 1
  },
  "set": "knight",
  "slot": "Head",
  "price": 918,
  "sell": 192,
  "protection": 2,
  "durability": 211
 },
 "etheria:knight_chest": {
  "id": "etheria:knight_chest",
  "name": "Peitoral do Cavaleiro",
  "rarity": "uncommon",
  "kind": "armor",
  "stats": {
   "defense": 6,
   "vitality": 2
  },
  "set": "knight",
  "slot": "Chest",
  "price": 1608,
  "sell": 336,
  "protection": 4,
  "durability": 369
 },
 "etheria:knight_legs": {
  "id": "etheria:knight_legs",
  "name": "Calças do Cavaleiro",
  "rarity": "uncommon",
  "kind": "armor",
  "stats": {
   "defense": 5,
   "vitality": 1
  },
  "set": "knight",
  "slot": "Legs",
  "price": 1263,
  "sell": 264,
  "protection": 3,
  "durability": 290
 },
 "etheria:knight_boots": {
  "id": "etheria:knight_boots",
  "name": "Botas do Cavaleiro",
  "rarity": "uncommon",
  "kind": "armor",
  "stats": {
   "defense": 3,
   "vitality": 1
  },
  "set": "knight",
  "slot": "Feet",
  "price": 804,
  "sell": 168,
  "protection": 2,
  "durability": 184
 },
 "etheria:arcane_helmet": {
  "id": "etheria:arcane_helmet",
  "name": "Capacete Arcano",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "intelligence": 4,
   "defense": 1,
   "manaRegen": 5
  },
  "set": "arcane",
  "slot": "Head",
  "price": 2242,
  "sell": 432,
  "protection": 3,
  "durability": 268
 },
 "etheria:arcane_chest": {
  "id": "etheria:arcane_chest",
  "name": "Peitoral Arcano",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "intelligence": 8,
   "defense": 2,
   "manaRegen": 8
  },
  "set": "arcane",
  "slot": "Chest",
  "price": 3924,
  "sell": 756,
  "protection": 5,
  "durability": 470
 },
 "etheria:arcane_legs": {
  "id": "etheria:arcane_legs",
  "name": "Calças Arcana",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "intelligence": 6,
   "defense": 1,
   "manaRegen": 6
  },
  "set": "arcane",
  "slot": "Legs",
  "price": 3083,
  "sell": 594,
  "protection": 4,
  "durability": 369
 },
 "etheria:arcane_boots": {
  "id": "etheria:arcane_boots",
  "name": "Botas Arcana",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "intelligence": 4,
   "defense": 1,
   "manaRegen": 4
  },
  "set": "arcane",
  "slot": "Feet",
  "price": 1962,
  "sell": 378,
  "protection": 3,
  "durability": 235
 },
 "etheria:shadow_helmet": {
  "id": "etheria:shadow_helmet",
  "name": "Capacete Sombrio",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 5,
   "crit": 2,
   "defense": 3
  },
  "set": "shadow",
  "slot": "Head",
  "price": 4222,
  "sell": 768,
  "protection": 4,
  "durability": 326
 },
 "etheria:shadow_chest": {
  "id": "etheria:shadow_chest",
  "name": "Peitoral Sombrio",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 9,
   "crit": 3,
   "defense": 4
  },
  "set": "shadow",
  "slot": "Chest",
  "price": 7389,
  "sell": 1344,
  "protection": 7,
  "durability": 571
 },
 "etheria:shadow_legs": {
  "id": "etheria:shadow_legs",
  "name": "Calças Sombria",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 7,
   "crit": 2,
   "defense": 4
  },
  "set": "shadow",
  "slot": "Legs",
  "price": 5805,
  "sell": 1056,
  "protection": 6,
  "durability": 448
 },
 "etheria:shadow_boots": {
  "id": "etheria:shadow_boots",
  "name": "Botas Sombria",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 4,
   "crit": 2,
   "defense": 2
  },
  "set": "shadow",
  "slot": "Feet",
  "price": 3694,
  "sell": 672,
  "protection": 4,
  "durability": 285
 },
 "etheria:dragon_helmet": {
  "id": "etheria:dragon_helmet",
  "name": "Capacete do Dragão",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "strength": 5,
   "vitality": 5,
   "defense": 6,
   "res_fire": 7
  },
  "set": "dragon",
  "slot": "Head",
  "price": 6898,
  "sell": 1200,
  "protection": 5,
  "durability": 384
 },
 "etheria:dragon_chest": {
  "id": "etheria:dragon_chest",
  "name": "Peitoral do Dragão",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "strength": 8,
   "vitality": 8,
   "defense": 11,
   "res_fire": 12
  },
  "set": "dragon",
  "slot": "Chest",
  "price": 12072,
  "sell": 2100,
  "protection": 9,
  "durability": 672
 },
 "etheria:dragon_legs": {
  "id": "etheria:dragon_legs",
  "name": "Calças do Dragão",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "strength": 7,
   "vitality": 7,
   "defense": 9,
   "res_fire": 9
  },
  "set": "dragon",
  "slot": "Legs",
  "price": 9485,
  "sell": 1650,
  "protection": 7,
  "durability": 528
 },
 "etheria:dragon_boots": {
  "id": "etheria:dragon_boots",
  "name": "Botas do Dragão",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "strength": 4,
   "vitality": 4,
   "defense": 6,
   "res_fire": 6
  },
  "set": "dragon",
  "slot": "Feet",
  "price": 6036,
  "sell": 1050,
  "protection": 5,
  "durability": 336
 },
 "etheria:celestial_helmet": {
  "id": "etheria:celestial_helmet",
  "name": "Capacete Celestial",
  "rarity": "mythic",
  "kind": "armor",
  "stats": {
   "strength": 4,
   "intelligence": 4,
   "agility": 4,
   "vitality": 4,
   "defense": 8,
   "light": 8
  },
  "set": "celestial",
  "slot": "Head",
  "price": 10302,
  "sell": 1728,
  "protection": 6,
  "durability": 441
 },
 "etheria:celestial_chest": {
  "id": "etheria:celestial_chest",
  "name": "Peitoral Celestial",
  "rarity": "mythic",
  "kind": "armor",
  "stats": {
   "strength": 7,
   "intelligence": 7,
   "agility": 7,
   "vitality": 7,
   "defense": 15,
   "light": 15
  },
  "set": "celestial",
  "slot": "Chest",
  "price": 18030,
  "sell": 3024,
  "protection": 11,
  "durability": 772
 },
 "etheria:celestial_legs": {
  "id": "etheria:celestial_legs",
  "name": "Calças Celestial",
  "rarity": "mythic",
  "kind": "armor",
  "stats": {
   "strength": 6,
   "intelligence": 6,
   "agility": 6,
   "vitality": 6,
   "defense": 11,
   "light": 11
  },
  "set": "celestial",
  "slot": "Legs",
  "price": 14166,
  "sell": 2376,
  "protection": 9,
  "durability": 607
 },
 "etheria:celestial_boots": {
  "id": "etheria:celestial_boots",
  "name": "Botas Celestial",
  "rarity": "mythic",
  "kind": "armor",
  "stats": {
   "strength": 4,
   "intelligence": 4,
   "agility": 4,
   "vitality": 4,
   "defense": 7,
   "light": 7
  },
  "set": "celestial",
  "slot": "Feet",
  "price": 9015,
  "sell": 1512,
  "protection": 5,
  "durability": 386
 },
 "etheria:void_helmet": {
  "id": "etheria:void_helmet",
  "name": "Capacete do Vazio",
  "rarity": "divine",
  "kind": "armor",
  "stats": {
   "intelligence": 14,
   "defense": 11,
   "void": 14,
   "lifesteal": 2
  },
  "set": "void",
  "slot": "Head",
  "price": 14462,
  "sell": 2352,
  "protection": 7,
  "durability": 499
 },
 "etheria:void_chest": {
  "id": "etheria:void_chest",
  "name": "Peitoral do Vazio",
  "rarity": "divine",
  "kind": "armor",
  "stats": {
   "intelligence": 24,
   "defense": 19,
   "void": 24,
   "lifesteal": 3
  },
  "set": "void",
  "slot": "Chest",
  "price": 25309,
  "sell": 4116,
  "protection": 13,
  "durability": 873
 },
 "etheria:void_legs": {
  "id": "etheria:void_legs",
  "name": "Calças do Vazio",
  "rarity": "divine",
  "kind": "armor",
  "stats": {
   "intelligence": 19,
   "defense": 15,
   "void": 19,
   "lifesteal": 3
  },
  "set": "void",
  "slot": "Legs",
  "price": 19886,
  "sell": 3234,
  "protection": 10,
  "durability": 686
 },
 "etheria:void_boots": {
  "id": "etheria:void_boots",
  "name": "Botas do Vazio",
  "rarity": "divine",
  "kind": "armor",
  "stats": {
   "intelligence": 12,
   "defense": 10,
   "void": 12,
   "lifesteal": 2
  },
  "set": "void",
  "slot": "Feet",
  "price": 12654,
  "sell": 2058,
  "protection": 6,
  "durability": 436
 },
 "etheria:ring_vigor": {
  "id": "etheria:ring_vigor",
  "name": "Anel do Vigor",
  "rarity": "rare",
  "kind": "accessory",
  "stats": {
   "vitality": 5,
   "defense": 1
  },
  "slot": "Offhand",
  "price": 1200,
  "sell": 250
 },
 "etheria:ring_mana": {
  "id": "etheria:ring_mana",
  "name": "Anel de Mana",
  "rarity": "rare",
  "kind": "accessory",
  "stats": {
   "intelligence": 6,
   "manaRegen": 20
  },
  "slot": "Offhand",
  "price": 1300,
  "sell": 260
 },
 "etheria:ring_fury": {
  "id": "etheria:ring_fury",
  "name": "Anel da Fúria",
  "rarity": "epic",
  "kind": "accessory",
  "stats": {
   "strength": 5,
   "crit": 6
  },
  "slot": "Offhand",
  "price": 2800,
  "sell": 600
 },
 "etheria:amulet_guardian": {
  "id": "etheria:amulet_guardian",
  "name": "Amuleto do Guardião",
  "rarity": "epic",
  "kind": "accessory",
  "stats": {
   "defense": 8,
   "vitality": 4
  },
  "slot": "Offhand",
  "price": 3200,
  "sell": 700
 },
 "etheria:amulet_arcane": {
  "id": "etheria:amulet_arcane",
  "name": "Amuleto Arcano",
  "rarity": "legendary",
  "kind": "accessory",
  "stats": {
   "intelligence": 10,
   "manaCost": 10,
   "critDmg": 10
  },
  "slot": "Offhand",
  "price": 7000,
  "sell": 1600
 },
 "etheria:mana_crystal": {
  "id": "etheria:mana_crystal",
  "name": "Cristal de Mana",
  "rarity": "common",
  "kind": "material",
  "sell": 15
 },
 "etheria:arcane_ingot": {
  "id": "etheria:arcane_ingot",
  "name": "Barra Arcana",
  "rarity": "uncommon",
  "kind": "material",
  "sell": 45
 },
 "etheria:demonite_shard": {
  "id": "etheria:demonite_shard",
  "name": "Pedra Demoníaca",
  "rarity": "rare",
  "kind": "material",
  "sell": 90
 },
 "etheria:celestial_crystal": {
  "id": "etheria:celestial_crystal",
  "name": "Cristal Celestial",
  "rarity": "epic",
  "kind": "material",
  "sell": 260
 },
 "etheria:void_fragment": {
  "id": "etheria:void_fragment",
  "name": "Fragmento do Vazio",
  "rarity": "epic",
  "kind": "material",
  "sell": 240
 },
 "etheria:dragon_essence": {
  "id": "etheria:dragon_essence",
  "name": "Essência Dracônica",
  "rarity": "epic",
  "kind": "material",
  "sell": 220
 },
 "etheria:goblin_ear": {
  "id": "etheria:goblin_ear",
  "name": "Orelha de Goblin",
  "rarity": "common",
  "kind": "material",
  "sell": 4
 },
 "etheria:orc_tusk": {
  "id": "etheria:orc_tusk",
  "name": "Presa de Orc",
  "rarity": "common",
  "kind": "material",
  "sell": 10
 },
 "etheria:wolf_fang": {
  "id": "etheria:wolf_fang",
  "name": "Presa de Lobo Mágico",
  "rarity": "uncommon",
  "kind": "material",
  "sell": 18
 },
 "etheria:slime_core": {
  "id": "etheria:slime_core",
  "name": "Núcleo de Slime",
  "rarity": "common",
  "kind": "material",
  "sell": 8
 },
 "etheria:ancient_bone": {
  "id": "etheria:ancient_bone",
  "name": "Osso Ancestral",
  "rarity": "common",
  "kind": "material",
  "sell": 9
 },
 "etheria:imp_horn": {
  "id": "etheria:imp_horn",
  "name": "Chifre de Diabrete",
  "rarity": "uncommon",
  "kind": "material",
  "sell": 22
 },
 "etheria:hp_potion_s": {
  "id": "etheria:hp_potion_s",
  "name": "Poção de Vida Menor",
  "rarity": "common",
  "kind": "consumable",
  "use": {
   "hp": 12
  },
  "price": 40,
  "sell": 10
 },
 "etheria:hp_potion_l": {
  "id": "etheria:hp_potion_l",
  "name": "Poção de Vida Maior",
  "rarity": "rare",
  "kind": "consumable",
  "use": {
   "hp": 40
  },
  "price": 160,
  "sell": 40
 },
 "etheria:mp_potion_s": {
  "id": "etheria:mp_potion_s",
  "name": "Poção de Mana Menor",
  "rarity": "common",
  "kind": "consumable",
  "use": {
   "mana": 30
  },
  "price": 40,
  "sell": 10
 },
 "etheria:mp_potion_l": {
  "id": "etheria:mp_potion_l",
  "name": "Poção de Mana Maior",
  "rarity": "rare",
  "kind": "consumable",
  "use": {
   "mana": 120
  },
  "price": 160,
  "sell": 40
 },
 "etheria:stamina_potion": {
  "id": "etheria:stamina_potion",
  "name": "Poção de Vigor",
  "rarity": "uncommon",
  "kind": "consumable",
  "use": {
   "stamina": 80
  },
  "price": 60,
  "sell": 15
 },
 "etheria:xp_scroll": {
  "id": "etheria:xp_scroll",
  "name": "Pergaminho de Experiência",
  "rarity": "rare",
  "kind": "consumable",
  "use": {
   "xp": 250
  },
  "price": 500,
  "sell": 100
 },
 "etheria:skill_scroll": {
  "id": "etheria:skill_scroll",
  "name": "Pergaminho de Habilidade",
  "rarity": "epic",
  "kind": "consumable",
  "use": {
   "skillPoints": 1
  },
  "price": 2500,
  "sell": 500
 },
 "etheria:coin_pouch": {
  "id": "etheria:coin_pouch",
  "name": "Bolsa de Moedas",
  "rarity": "uncommon",
  "kind": "consumable",
  "use": {
   "coins": 100
  },
  "price": 0,
  "sell": 60
 },
 "etheria:skill_tome": {
  "id": "etheria:skill_tome",
  "name": "Tomo de Habilidades",
  "rarity": "rare",
  "kind": "artifact",
  "caster": true,
  "stats": {},
  "price": 0,
  "sell": 0
 },
 "etheria:goblin_sigil": {
  "id": "etheria:goblin_sigil",
  "name": "Sigilo do Rei Goblin",
  "rarity": "epic",
  "kind": "artifact",
  "use": {
   "boss": "goblin_king"
  },
  "price": 1500,
  "sell": 300
 },
 "etheria:void_sigil": {
  "id": "etheria:void_sigil",
  "name": "Sigilo do Senhor do Vazio",
  "rarity": "legendary",
  "kind": "artifact",
  "use": {
   "boss": "void_lord"
  },
  "price": 6000,
  "sell": 1200
 },
 "etheria:ember_sigil": {
  "id": "etheria:ember_sigil",
  "name": "Sigilo do Tirano Brasa",
  "rarity": "legendary",
  "kind": "artifact",
  "use": {
   "boss": "ember_tyrant"
  },
  "price": 6000,
  "sell": 1200
 },
 "etheria:goblin_totem": {
  "id": "etheria:goblin_totem",
  "name": "Totem Goblin",
  "rarity": "uncommon",
  "kind": "quest",
  "price": 0,
  "sell": 0
 },
 "etheria:ancient_map": {
  "id": "etheria:ancient_map",
  "name": "Mapa Ancestral",
  "rarity": "rare",
  "kind": "quest",
  "price": 0,
  "sell": 0
 },
 "etheria:guild_badge": {
  "id": "etheria:guild_badge",
  "name": "Insígnia da Guilda",
  "rarity": "rare",
  "kind": "quest",
  "price": 0,
  "sell": 0
 },
 "etheria:etheria_coin": {
  "id": "etheria:etheria_coin",
  "name": "Moeda de Etheria",
  "rarity": "common",
  "kind": "material",
  "sell": 1
 },
 "etheria:sage_book": {
  "id": "etheria:sage_book",
  "name": "Livro do Great Sage",
  "rarity": "mythic",
  "kind": "artifact",
  "price": 0,
  "sell": 0
 },
 "etheria:uraku_katana": {
  "id": "etheria:uraku_katana",
  "name": "Katana Uraku",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 15,
   "agility": 8,
   "crit": 9
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Corte Limpo"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:kusanagi": {
  "id": "etheria:kusanagi",
  "name": "Kusanagi",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 22,
   "strength": 14,
   "wind": 15
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.3,
   "name": "Lâmina do Vento"
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:green_dragon_blade": {
  "id": "etheria:green_dragon_blade",
  "name": "Lâmina do Dragão Verde",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "strength": 12,
   "vitality": 4
  },
  "onHit": {
   "kind": "burn",
   "sec": 3,
   "chance": 0.2,
   "name": "Fôlego do Dragão"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dyrnwyn": {
  "id": "etheria:dyrnwyn",
  "name": "Dyrnwyn",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 24,
   "strength": 16,
   "fire": 18
  },
  "onHit": {
   "kind": "burn",
   "sec": 6,
   "chance": 0.35,
   "name": "Chama Justa"
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:gandiva": {
  "id": "etheria:gandiva",
  "name": "Gandiva",
  "rarity": "mythic",
  "kind": "weapon",
  "wtype": "bow",
  "ranged": {
   "range": 45,
   "element": "physical",
   "cost": 8,
   "cd": 12
  },
  "stats": {
   "atk": 26,
   "agility": 18,
   "crit": 14
  },
  "price": 24000,
  "sell": 6000
 },
 "etheria:geb": {
  "id": "etheria:geb",
  "name": "Geb",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "axe",
  "stats": {
   "atk": 23,
   "strength": 18,
   "earth": 15
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Fissura de Terra"
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:dead_mans_hand": {
  "id": "etheria:dead_mans_hand",
  "name": "Mão do Morto",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "dagger",
  "stats": {
   "atk": 13,
   "agility": 12,
   "crit": 16
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.3,
   "name": "Mão da Morte"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:ruyi_jingu_bang": {
  "id": "etheria:ruyi_jingu_bang",
  "name": "Ruyi Jingu Bang",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "spear",
  "stats": {
   "atk": 21,
   "strength": 15,
   "vitality": 8
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:soul_serpent_blade": {
  "id": "etheria:soul_serpent_blade",
  "name": "Lâmina da Serpente de Almas",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 17,
   "intelligence": 8,
   "lifesteal": 4
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Mordida de Alma"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:wild_card": {
  "id": "etheria:wild_card",
  "name": "Carta Coringa",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "dagger",
  "stats": {
   "atk": 9,
   "agility": 10,
   "crit": 12
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:extermination_blade": {
  "id": "etheria:extermination_blade",
  "name": "Lâmina de Extermínio",
  "rarity": "mythic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 30,
   "strength": 22,
   "crit": 12
  },
  "onHit": {
   "kind": "bleed",
   "sec": 6,
   "chance": 0.35,
   "name": "Extermínio"
  },
  "price": 24000,
  "sell": 6000
 },
 "etheria:caedros_ashen_halberd": {
  "id": "etheria:caedros_ashen_halberd",
  "name": "Alabarda Cinzenta de Caedros",
  "rarity": "mythic",
  "kind": "weapon",
  "wtype": "spear",
  "stats": {
   "atk": 32,
   "strength": 24,
   "vitality": 10
  },
  "onHit": {
   "kind": "burn",
   "sec": 5,
   "chance": 0.3,
   "name": "Cinzas de Caedros"
  },
  "price": 24000,
  "sell": 6000
 },
 "etheria:dragotite_short_sword": {
  "id": "etheria:dragotite_short_sword",
  "name": "Espada Curta de Dragotita",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 10,
   "agility": 6
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:dragotite_sword": {
  "id": "etheria:dragotite_sword",
  "name": "Espada de Dragotita",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 14,
   "strength": 6
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:dragotite_long_sword": {
  "id": "etheria:dragotite_long_sword",
  "name": "Espada Longa de Dragotita",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 17,
   "strength": 9
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:dragotite_katana": {
  "id": "etheria:dragotite_katana",
  "name": "Katana de Dragotita",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 15,
   "agility": 9,
   "crit": 7
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:dragotite_great_sword": {
  "id": "etheria:dragotite_great_sword",
  "name": "Montante de Dragotita",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 22,
   "strength": 14,
   "defense": 2
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:dragotite_abyss_short_sword": {
  "id": "etheria:dragotite_abyss_short_sword",
  "name": "Espada Curta de Dragotita Abissal",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 12,
   "agility": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.28,
   "name": "Corte Abissal"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_abyss_sword": {
  "id": "etheria:dragotite_abyss_sword",
  "name": "Espada de Dragotita Abissal",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "strength": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.28,
   "name": "Corte Abissal"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_abyss_long_sword": {
  "id": "etheria:dragotite_abyss_long_sword",
  "name": "Espada Longa de Dragotita Abissal",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 21,
   "strength": 11
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.28,
   "name": "Corte Abissal"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_abyss_katana": {
  "id": "etheria:dragotite_abyss_katana",
  "name": "Katana de Dragotita Abissal",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 19,
   "agility": 11,
   "crit": 9
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.28,
   "name": "Corte Abissal"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_abyss_great_sword": {
  "id": "etheria:dragotite_abyss_great_sword",
  "name": "Montante de Dragotita Abissal",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 28,
   "strength": 18,
   "defense": 2
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.28,
   "name": "Corte Abissal"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_earth_short_sword": {
  "id": "etheria:dragotite_earth_short_sword",
  "name": "Espada Curta de Dragotita da Terra",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 12,
   "agility": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Fissura Rochosa"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_earth_sword": {
  "id": "etheria:dragotite_earth_sword",
  "name": "Espada de Dragotita da Terra",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "strength": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Fissura Rochosa"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_earth_long_sword": {
  "id": "etheria:dragotite_earth_long_sword",
  "name": "Espada Longa de Dragotita da Terra",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 21,
   "strength": 11
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Fissura Rochosa"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_earth_katana": {
  "id": "etheria:dragotite_earth_katana",
  "name": "Katana de Dragotita da Terra",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 19,
   "agility": 11,
   "crit": 9
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Fissura Rochosa"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_earth_great_sword": {
  "id": "etheria:dragotite_earth_great_sword",
  "name": "Montante de Dragotita da Terra",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 28,
   "strength": 18,
   "defense": 2
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Fissura Rochosa"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_frost_short_sword": {
  "id": "etheria:dragotite_frost_short_sword",
  "name": "Espada Curta de Dragotita Gélida",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 12,
   "agility": 8
  },
  "onHit": {
   "kind": "slow",
   "sec": 4,
   "chance": 0.3,
   "name": "Geada Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_frost_sword": {
  "id": "etheria:dragotite_frost_sword",
  "name": "Espada de Dragotita Gélida",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "strength": 8
  },
  "onHit": {
   "kind": "slow",
   "sec": 4,
   "chance": 0.3,
   "name": "Geada Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_frost_long_sword": {
  "id": "etheria:dragotite_frost_long_sword",
  "name": "Espada Longa de Dragotita Gélida",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 21,
   "strength": 11
  },
  "onHit": {
   "kind": "slow",
   "sec": 4,
   "chance": 0.3,
   "name": "Geada Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_frost_katana": {
  "id": "etheria:dragotite_frost_katana",
  "name": "Katana de Dragotita Gélida",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 19,
   "agility": 11,
   "crit": 9
  },
  "onHit": {
   "kind": "slow",
   "sec": 4,
   "chance": 0.3,
   "name": "Geada Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_frost_great_sword": {
  "id": "etheria:dragotite_frost_great_sword",
  "name": "Montante de Dragotita Gélida",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 28,
   "strength": 18,
   "defense": 2
  },
  "onHit": {
   "kind": "slow",
   "sec": 4,
   "chance": 0.3,
   "name": "Geada Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_scorch_short_sword": {
  "id": "etheria:dragotite_scorch_short_sword",
  "name": "Espada Curta de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 12,
   "agility": 8
  },
  "onHit": {
   "kind": "burn",
   "sec": 5,
   "chance": 0.3,
   "name": "Brasa Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_scorch_sword": {
  "id": "etheria:dragotite_scorch_sword",
  "name": "Espada de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "strength": 8
  },
  "onHit": {
   "kind": "burn",
   "sec": 5,
   "chance": 0.3,
   "name": "Brasa Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_scorch_long_sword": {
  "id": "etheria:dragotite_scorch_long_sword",
  "name": "Espada Longa de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 21,
   "strength": 11
  },
  "onHit": {
   "kind": "burn",
   "sec": 5,
   "chance": 0.3,
   "name": "Brasa Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_scorch_katana": {
  "id": "etheria:dragotite_scorch_katana",
  "name": "Katana de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 19,
   "agility": 11,
   "crit": 9
  },
  "onHit": {
   "kind": "burn",
   "sec": 5,
   "chance": 0.3,
   "name": "Brasa Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_scorch_great_sword": {
  "id": "etheria:dragotite_scorch_great_sword",
  "name": "Montante de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 28,
   "strength": 18,
   "defense": 2
  },
  "onHit": {
   "kind": "burn",
   "sec": 5,
   "chance": 0.3,
   "name": "Brasa Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_storm_short_sword": {
  "id": "etheria:dragotite_storm_short_sword",
  "name": "Espada Curta de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 12,
   "agility": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.3,
   "name": "Descarga Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_storm_sword": {
  "id": "etheria:dragotite_storm_sword",
  "name": "Espada de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "strength": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.3,
   "name": "Descarga Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_storm_long_sword": {
  "id": "etheria:dragotite_storm_long_sword",
  "name": "Espada Longa de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 21,
   "strength": 11
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.3,
   "name": "Descarga Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_storm_katana": {
  "id": "etheria:dragotite_storm_katana",
  "name": "Katana de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 19,
   "agility": 11,
   "crit": 9
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.3,
   "name": "Descarga Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_storm_great_sword": {
  "id": "etheria:dragotite_storm_great_sword",
  "name": "Montante de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 28,
   "strength": 18,
   "defense": 2
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.3,
   "name": "Descarga Dracônica"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:dragotite_star_short_sword": {
  "id": "etheria:dragotite_star_short_sword",
  "name": "Espada Curta de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 15,
   "agility": 9
  },
  "onHit": {
   "kind": "heal",
   "amount": 4,
   "chance": 0.3,
   "name": "Luz Estelar"
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:dragotite_star_sword": {
  "id": "etheria:dragotite_star_sword",
  "name": "Espada de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 21,
   "strength": 9
  },
  "onHit": {
   "kind": "heal",
   "amount": 4,
   "chance": 0.3,
   "name": "Luz Estelar"
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:dragotite_star_long_sword": {
  "id": "etheria:dragotite_star_long_sword",
  "name": "Espada Longa de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 26,
   "strength": 14
  },
  "onHit": {
   "kind": "heal",
   "amount": 4,
   "chance": 0.3,
   "name": "Luz Estelar"
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:dragotite_star_katana": {
  "id": "etheria:dragotite_star_katana",
  "name": "Katana de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 22,
   "agility": 14,
   "crit": 10
  },
  "onHit": {
   "kind": "heal",
   "amount": 4,
   "chance": 0.3,
   "name": "Luz Estelar"
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:dragotite_star_great_sword": {
  "id": "etheria:dragotite_star_great_sword",
  "name": "Montante de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 33,
   "strength": 21,
   "defense": 3
  },
  "onHit": {
   "kind": "heal",
   "amount": 4,
   "chance": 0.3,
   "name": "Luz Estelar"
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:claymore": {
  "id": "etheria:claymore",
  "name": "Claymore",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 16,
   "strength": 9
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:dreadsword": {
  "id": "etheria:dreadsword",
  "name": "Espada do Terror",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 17,
   "strength": 8,
   "crit": 6
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.28,
   "name": "Corte do Terror"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:boreal_blade": {
  "id": "etheria:boreal_blade",
  "name": "Lâmina Boreal",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 19,
   "strength": 9,
   "ice": 12
  },
  "onHit": {
   "kind": "slow",
   "sec": 4,
   "chance": 0.3,
   "name": "Sopro Boreal"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:amethyst_rapier": {
  "id": "etheria:amethyst_rapier",
  "name": "Rapieira de Ametista",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "dagger",
  "stats": {
   "atk": 13,
   "agility": 11,
   "crit": 12
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.3,
   "name": "Estocada Cristalina"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:fiery_dagger": {
  "id": "etheria:fiery_dagger",
  "name": "Adaga Flamejante",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "dagger",
  "stats": {
   "atk": 10,
   "agility": 8,
   "fire": 8
  },
  "onHit": {
   "kind": "burn",
   "sec": 4,
   "chance": 0.3,
   "name": "Brasa Rápida"
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:obsidian_katana": {
  "id": "etheria:obsidian_katana",
  "name": "Katana de Obsidiana",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "agility": 10,
   "crit": 9
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.3,
   "name": "Corte de Obsidiana"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:warden_sword": {
  "id": "etheria:warden_sword",
  "name": "Espada do Warden",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 23,
   "strength": 14,
   "vitality": 6
  },
  "onHit": {
   "kind": "bleed",
   "sec": 6,
   "chance": 0.33,
   "name": "Eco Profundo"
  },
  "price": 10000,
  "sell": 2500
 },
 "etheria:resonarium_sword": {
  "id": "etheria:resonarium_sword",
  "name": "Espada de Ressonarium",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 16,
   "agility": 7,
   "intelligence": 5
  },
  "onHit": {
   "kind": "slow",
   "sec": 3,
   "chance": 0.25,
   "name": "Ressonância"
  },
  "price": 4000,
  "sell": 1000
 },
 "etheria:neptunium_sword": {
  "id": "etheria:neptunium_sword",
  "name": "Espada de Neptúnio",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 12,
   "agility": 5,
   "water": 8
  },
  "onHit": {
   "kind": "slow",
   "sec": 3,
   "chance": 0.25,
   "name": "Maré"
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:sky_sword": {
  "id": "etheria:sky_sword",
  "name": "Espada do Céu",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 12,
   "agility": 7,
   "wind": 8
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:depth_sword": {
  "id": "etheria:depth_sword",
  "name": "Espada das Profundezas",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 13,
   "strength": 6
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Pressão Abissal"
  },
  "price": 1800,
  "sell": 450
 },
 "etheria:infused_iron_sword": {
  "id": "etheria:infused_iron_sword",
  "name": "Espada de Ferro Infundido",
  "rarity": "uncommon",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 9,
   "strength": 4
  },
  "price": 800,
  "sell": 200
 },
 "etheria:rimuru_katana": {
  "id": "etheria:rimuru_katana",
  "name": "Katana de Rimuru",
  "rarity": "mythic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 28,
   "agility": 16,
   "crit": 14,
   "intelligence": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 6,
   "chance": 0.35,
   "name": "Lâmina Devoradora"
  },
  "price": 24000,
  "sell": 6000
 },
 "etheria:rimuru_sword": {
  "id": "etheria:rimuru_sword",
  "name": "Espada de Rimuru",
  "rarity": "mythic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 26,
   "agility": 13,
   "crit": 12,
   "intelligence": 10
  },
  "onHit": {
   "kind": "slow",
   "sec": 4,
   "chance": 0.3,
   "name": "Corte Gelatinoso"
  },
  "price": 22000,
  "sell": 5500
 },
 "etheria:reid_dragon_sword": {
  "id": "etheria:reid_dragon_sword",
  "name": "Espada do Dragão [Reid]",
  "rarity": "mythic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 27,
   "strength": 12,
   "crit": 14,
   "agility": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.25,
   "name": "Corte do Santo da Espada"
  },
  "price": 24000,
  "sell": 6000
 },
 "etheria:rimuru_outfit_chest": {
  "id": "etheria:rimuru_outfit_chest",
  "name": "Casaco de Rimuru Tempest",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "vitality": 10,
   "intelligence": 10,
   "manaRegen": 14,
   "defense": 5
  },
  "set": "rimuru_outfit",
  "slot": "Chest",
  "price": 6200,
  "sell": 1240,
  "protection": 8,
  "durability": 620
 },
 "etheria:rimuru_outfit_legs": {
  "id": "etheria:rimuru_outfit_legs",
  "name": "Calça de Rimuru Tempest",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "vitality": 7,
   "agility": 8,
   "defense": 4
  },
  "set": "rimuru_outfit",
  "slot": "Legs",
  "price": 5200,
  "sell": 1040,
  "protection": 6,
  "durability": 520
 },
 "etheria:rimuru_outfit_boots": {
  "id": "etheria:rimuru_outfit_boots",
  "name": "Botas de Rimuru Tempest",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "agility": 8,
   "defense": 2
  },
  "set": "rimuru_outfit",
  "slot": "Feet",
  "price": 4400,
  "sell": 880,
  "protection": 3,
  "durability": 440
 },
 "etheria:milim_berserker_helmet": {
  "id": "etheria:milim_berserker_helmet",
  "name": "Tiara Berserker de Milim",
  "rarity": "mythic",
  "kind": "armor",
  "stats": {
   "strength": 8,
   "crit": 6,
   "defense": 3
  },
  "set": "milim_berserker",
  "slot": "Head",
  "price": 5200,
  "sell": 1040,
  "protection": 4,
  "durability": 520
 },
 "etheria:milim_berserker_chest": {
  "id": "etheria:milim_berserker_chest",
  "name": "Peitoral Berserker de Milim",
  "rarity": "mythic",
  "kind": "armor",
  "stats": {
   "strength": 14,
   "vitality": 10,
   "defense": 6
  },
  "set": "milim_berserker",
  "slot": "Chest",
  "price": 7600,
  "sell": 1520,
  "protection": 9,
  "durability": 760
 },
 "etheria:milim_berserker_legs": {
  "id": "etheria:milim_berserker_legs",
  "name": "Grevas Berserker de Milim",
  "rarity": "mythic",
  "kind": "armor",
  "stats": {
   "strength": 9,
   "agility": 6,
   "defense": 5
  },
  "set": "milim_berserker",
  "slot": "Legs",
  "price": 6600,
  "sell": 1320,
  "protection": 7,
  "durability": 660
 },
 "etheria:milim_berserker_boots": {
  "id": "etheria:milim_berserker_boots",
  "name": "Botas Berserker de Milim",
  "rarity": "mythic",
  "kind": "armor",
  "stats": {
   "agility": 9,
   "defense": 3
  },
  "set": "milim_berserker",
  "slot": "Feet",
  "price": 5600,
  "sell": 1120,
  "protection": 4,
  "durability": 560
 },
 "etheria:dragotite_ingot": {
  "id": "etheria:dragotite_ingot",
  "name": "Lingote de Dragotita",
  "rarity": "rare",
  "kind": "material",
  "sell": 120
 },
 "etheria:dragotite_abyss_ingot": {
  "id": "etheria:dragotite_abyss_ingot",
  "name": "Lingote de Dragotita Abissal",
  "rarity": "epic",
  "kind": "material",
  "sell": 320
 },
 "etheria:dragotite_earth_ingot": {
  "id": "etheria:dragotite_earth_ingot",
  "name": "Lingote de Dragotita da Terra",
  "rarity": "epic",
  "kind": "material",
  "sell": 320
 },
 "etheria:dragotite_frost_ingot": {
  "id": "etheria:dragotite_frost_ingot",
  "name": "Lingote de Dragotita Gélida",
  "rarity": "epic",
  "kind": "material",
  "sell": 320
 },
 "etheria:dragotite_scorch_ingot": {
  "id": "etheria:dragotite_scorch_ingot",
  "name": "Lingote de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "material",
  "sell": 320
 },
 "etheria:dragotite_storm_ingot": {
  "id": "etheria:dragotite_storm_ingot",
  "name": "Lingote de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "material",
  "sell": 320
 },
 "etheria:dragotite_star_ingot": {
  "id": "etheria:dragotite_star_ingot",
  "name": "Lingote de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "material",
  "sell": 900
 },
 "etheria:earth_core": {
  "id": "etheria:earth_core",
  "name": "Núcleo da Terra",
  "rarity": "rare",
  "kind": "material",
  "sell": 110
 },
 "etheria:frost_core": {
  "id": "etheria:frost_core",
  "name": "Núcleo Congelante",
  "rarity": "rare",
  "kind": "material",
  "sell": 110
 },
 "etheria:storm_core": {
  "id": "etheria:storm_core",
  "name": "Núcleo da Tempestade",
  "rarity": "rare",
  "kind": "material",
  "sell": 110
 },
 "etheria:evolution_core": {
  "id": "etheria:evolution_core",
  "name": "Núcleo de Evolução",
  "rarity": "legendary",
  "kind": "material",
  "sell": 1200
 },
 "etheria:dragotite_helmet": {
  "id": "etheria:dragotite_helmet",
  "name": "Capacete de Dragotita",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "defense": 5,
   "vitality": 2,
   "strength": 2
  },
  "set": "dragotite",
  "slot": "Head",
  "price": 2242,
  "sell": 432,
  "protection": 3,
  "durability": 268
 },
 "etheria:dragotite_chest": {
  "id": "etheria:dragotite_chest",
  "name": "Peitoral de Dragotita",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "defense": 9,
   "vitality": 4,
   "strength": 4
  },
  "set": "dragotite",
  "slot": "Chest",
  "price": 3924,
  "sell": 756,
  "protection": 5,
  "durability": 470
 },
 "etheria:dragotite_legs": {
  "id": "etheria:dragotite_legs",
  "name": "Calças de Dragotita",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "defense": 7,
   "vitality": 3,
   "strength": 3
  },
  "set": "dragotite",
  "slot": "Legs",
  "price": 3083,
  "sell": 594,
  "protection": 4,
  "durability": 369
 },
 "etheria:dragotite_boots": {
  "id": "etheria:dragotite_boots",
  "name": "Botas de Dragotita",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "defense": 5,
   "vitality": 2,
   "strength": 2
  },
  "set": "dragotite",
  "slot": "Feet",
  "price": 1962,
  "sell": 378,
  "protection": 3,
  "durability": 235
 },
 "etheria:dragotite_abyss_helmet": {
  "id": "etheria:dragotite_abyss_helmet",
  "name": "Capacete de Dragotita Abissal",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 5,
   "crit": 3,
   "void": 5,
   "defense": 5
  },
  "set": "dragotite_abyss",
  "slot": "Head",
  "price": 6898,
  "sell": 1200,
  "protection": 5,
  "durability": 384
 },
 "etheria:dragotite_abyss_chest": {
  "id": "etheria:dragotite_abyss_chest",
  "name": "Peitoral de Dragotita Abissal",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 9,
   "crit": 5,
   "void": 9,
   "defense": 9
  },
  "set": "dragotite_abyss",
  "slot": "Chest",
  "price": 12072,
  "sell": 2100,
  "protection": 9,
  "durability": 672
 },
 "etheria:dragotite_abyss_legs": {
  "id": "etheria:dragotite_abyss_legs",
  "name": "Calças de Dragotita Abissal",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 7,
   "crit": 4,
   "void": 7,
   "defense": 7
  },
  "set": "dragotite_abyss",
  "slot": "Legs",
  "price": 9485,
  "sell": 1650,
  "protection": 7,
  "durability": 528
 },
 "etheria:dragotite_abyss_boots": {
  "id": "etheria:dragotite_abyss_boots",
  "name": "Botas de Dragotita Abissal",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 4,
   "crit": 2,
   "void": 4,
   "defense": 4
  },
  "set": "dragotite_abyss",
  "slot": "Feet",
  "price": 6036,
  "sell": 1050,
  "protection": 5,
  "durability": 336
 },
 "etheria:dragotite_earth_helmet": {
  "id": "etheria:dragotite_earth_helmet",
  "name": "Capacete de Dragotita da Terra",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "defense": 10,
   "vitality": 5,
   "earth": 5
  },
  "set": "dragotite_earth",
  "slot": "Head",
  "price": 6898,
  "sell": 1200,
  "protection": 5,
  "durability": 384
 },
 "etheria:dragotite_earth_chest": {
  "id": "etheria:dragotite_earth_chest",
  "name": "Peitoral de Dragotita da Terra",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "defense": 18,
   "vitality": 9,
   "earth": 9
  },
  "set": "dragotite_earth",
  "slot": "Chest",
  "price": 12072,
  "sell": 2100,
  "protection": 9,
  "durability": 672
 },
 "etheria:dragotite_earth_legs": {
  "id": "etheria:dragotite_earth_legs",
  "name": "Calças de Dragotita da Terra",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "defense": 14,
   "vitality": 7,
   "earth": 7
  },
  "set": "dragotite_earth",
  "slot": "Legs",
  "price": 9485,
  "sell": 1650,
  "protection": 7,
  "durability": 528
 },
 "etheria:dragotite_earth_boots": {
  "id": "etheria:dragotite_earth_boots",
  "name": "Botas de Dragotita da Terra",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "defense": 9,
   "vitality": 4,
   "earth": 4
  },
  "set": "dragotite_earth",
  "slot": "Feet",
  "price": 6036,
  "sell": 1050,
  "protection": 5,
  "durability": 336
 },
 "etheria:dragotite_frost_helmet": {
  "id": "etheria:dragotite_frost_helmet",
  "name": "Capacete de Dragotita Gélida",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 5,
   "defense": 5,
   "ice": 8,
   "manaRegen": 5
  },
  "set": "dragotite_frost",
  "slot": "Head",
  "price": 6898,
  "sell": 1200,
  "protection": 5,
  "durability": 384
 },
 "etheria:dragotite_frost_chest": {
  "id": "etheria:dragotite_frost_chest",
  "name": "Peitoral de Dragotita Gélida",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 9,
   "defense": 9,
   "ice": 13,
   "manaRegen": 9
  },
  "set": "dragotite_frost",
  "slot": "Chest",
  "price": 12072,
  "sell": 2100,
  "protection": 9,
  "durability": 672
 },
 "etheria:dragotite_frost_legs": {
  "id": "etheria:dragotite_frost_legs",
  "name": "Calças de Dragotita Gélida",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 7,
   "defense": 7,
   "ice": 11,
   "manaRegen": 7
  },
  "set": "dragotite_frost",
  "slot": "Legs",
  "price": 9485,
  "sell": 1650,
  "protection": 7,
  "durability": 528
 },
 "etheria:dragotite_frost_boots": {
  "id": "etheria:dragotite_frost_boots",
  "name": "Botas de Dragotita Gélida",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 4,
   "defense": 4,
   "ice": 7,
   "manaRegen": 5
  },
  "set": "dragotite_frost",
  "slot": "Feet",
  "price": 6036,
  "sell": 1050,
  "protection": 5,
  "durability": 336
 },
 "etheria:dragotite_scorch_helmet": {
  "id": "etheria:dragotite_scorch_helmet",
  "name": "Capacete de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "strength": 6,
   "fire": 8,
   "defense": 4,
   "res_fire": 9
  },
  "set": "dragotite_scorch",
  "slot": "Head",
  "price": 6898,
  "sell": 1200,
  "protection": 5,
  "durability": 384
 },
 "etheria:dragotite_scorch_chest": {
  "id": "etheria:dragotite_scorch_chest",
  "name": "Peitoral de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "strength": 11,
   "fire": 13,
   "defense": 7,
   "res_fire": 16
  },
  "set": "dragotite_scorch",
  "slot": "Chest",
  "price": 12072,
  "sell": 2100,
  "protection": 9,
  "durability": 672
 },
 "etheria:dragotite_scorch_legs": {
  "id": "etheria:dragotite_scorch_legs",
  "name": "Calças de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "strength": 9,
   "fire": 11,
   "defense": 5,
   "res_fire": 12
  },
  "set": "dragotite_scorch",
  "slot": "Legs",
  "price": 9485,
  "sell": 1650,
  "protection": 7,
  "durability": 528
 },
 "etheria:dragotite_scorch_boots": {
  "id": "etheria:dragotite_scorch_boots",
  "name": "Botas de Dragotita Flamejante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "strength": 6,
   "fire": 7,
   "defense": 3,
   "res_fire": 8
  },
  "set": "dragotite_scorch",
  "slot": "Feet",
  "price": 6036,
  "sell": 1050,
  "protection": 5,
  "durability": 336
 },
 "etheria:dragotite_storm_helmet": {
  "id": "etheria:dragotite_storm_helmet",
  "name": "Capacete de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 8,
   "lightning": 8,
   "crit": 3,
   "defense": 3
  },
  "set": "dragotite_storm",
  "slot": "Head",
  "price": 6898,
  "sell": 1200,
  "protection": 5,
  "durability": 384
 },
 "etheria:dragotite_storm_chest": {
  "id": "etheria:dragotite_storm_chest",
  "name": "Peitoral de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 13,
   "lightning": 13,
   "crit": 5,
   "defense": 4
  },
  "set": "dragotite_storm",
  "slot": "Chest",
  "price": 12072,
  "sell": 2100,
  "protection": 9,
  "durability": 672
 },
 "etheria:dragotite_storm_legs": {
  "id": "etheria:dragotite_storm_legs",
  "name": "Calças de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 11,
   "lightning": 11,
   "crit": 4,
   "defense": 4
  },
  "set": "dragotite_storm",
  "slot": "Legs",
  "price": 9485,
  "sell": 1650,
  "protection": 7,
  "durability": 528
 },
 "etheria:dragotite_storm_boots": {
  "id": "etheria:dragotite_storm_boots",
  "name": "Botas de Dragotita da Tempestade",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 7,
   "lightning": 7,
   "crit": 2,
   "defense": 2
  },
  "set": "dragotite_storm",
  "slot": "Feet",
  "price": 6036,
  "sell": 1050,
  "protection": 5,
  "durability": 336
 },
 "etheria:dragotite_star_helmet": {
  "id": "etheria:dragotite_star_helmet",
  "name": "Capacete de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "strength": 5,
   "intelligence": 5,
   "agility": 5,
   "vitality": 6,
   "defense": 10,
   "light": 10
  },
  "set": "dragotite_star",
  "slot": "Head",
  "price": 14462,
  "sell": 2352,
  "protection": 7,
  "durability": 499
 },
 "etheria:dragotite_star_chest": {
  "id": "etheria:dragotite_star_chest",
  "name": "Peitoral de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "strength": 8,
   "intelligence": 8,
   "agility": 8,
   "vitality": 11,
   "defense": 17,
   "light": 17
  },
  "set": "dragotite_star",
  "slot": "Chest",
  "price": 25309,
  "sell": 4116,
  "protection": 13,
  "durability": 873
 },
 "etheria:dragotite_star_legs": {
  "id": "etheria:dragotite_star_legs",
  "name": "Calças de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "strength": 7,
   "intelligence": 7,
   "agility": 7,
   "vitality": 9,
   "defense": 13,
   "light": 13
  },
  "set": "dragotite_star",
  "slot": "Legs",
  "price": 19886,
  "sell": 3234,
  "protection": 10,
  "durability": 686
 },
 "etheria:dragotite_star_boots": {
  "id": "etheria:dragotite_star_boots",
  "name": "Botas de Dragotita Estelar",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "strength": 4,
   "intelligence": 4,
   "agility": 4,
   "vitality": 6,
   "defense": 8,
   "light": 8
  },
  "set": "dragotite_star",
  "slot": "Feet",
  "price": 12654,
  "sell": 2058,
  "protection": 6,
  "durability": 436
 },
 "etheria:priest_helmet": {
  "id": "etheria:priest_helmet",
  "name": "Capacete do Sacerdote",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "vitality": 4,
   "light": 4,
   "manaRegen": 6,
   "defense": 2
  },
  "set": "priest",
  "slot": "Head",
  "price": 2242,
  "sell": 432,
  "protection": 3,
  "durability": 268
 },
 "etheria:priest_chest": {
  "id": "etheria:priest_chest",
  "name": "Peitoral do Sacerdote",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "vitality": 8,
   "light": 8,
   "manaRegen": 11,
   "defense": 4
  },
  "set": "priest",
  "slot": "Chest",
  "price": 3924,
  "sell": 756,
  "protection": 5,
  "durability": 470
 },
 "etheria:priest_legs": {
  "id": "etheria:priest_legs",
  "name": "Calças do Sacerdote",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "vitality": 6,
   "light": 6,
   "manaRegen": 8,
   "defense": 3
  },
  "set": "priest",
  "slot": "Legs",
  "price": 3083,
  "sell": 594,
  "protection": 4,
  "durability": 369
 },
 "etheria:priest_boots": {
  "id": "etheria:priest_boots",
  "name": "Botas do Sacerdote",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "vitality": 4,
   "light": 4,
   "manaRegen": 5,
   "defense": 2
  },
  "set": "priest",
  "slot": "Feet",
  "price": 1962,
  "sell": 378,
  "protection": 3,
  "durability": 235
 },
 "etheria:plagued_helmet": {
  "id": "etheria:plagued_helmet",
  "name": "Capacete do Pestilento",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "vitality": 4,
   "defense": 3,
   "res_poison": 6,
   "shadow": 2
  },
  "set": "plagued",
  "slot": "Head",
  "price": 2242,
  "sell": 432,
  "protection": 3,
  "durability": 268
 },
 "etheria:plagued_chest": {
  "id": "etheria:plagued_chest",
  "name": "Peitoral do Pestilento",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "vitality": 8,
   "defense": 6,
   "res_poison": 11,
   "shadow": 4
  },
  "set": "plagued",
  "slot": "Chest",
  "price": 3924,
  "sell": 756,
  "protection": 5,
  "durability": 470
 },
 "etheria:plagued_legs": {
  "id": "etheria:plagued_legs",
  "name": "Calças do Pestilento",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "vitality": 6,
   "defense": 4,
   "res_poison": 8,
   "shadow": 3
  },
  "set": "plagued",
  "slot": "Legs",
  "price": 3083,
  "sell": 594,
  "protection": 4,
  "durability": 369
 },
 "etheria:plagued_boots": {
  "id": "etheria:plagued_boots",
  "name": "Botas do Pestilento",
  "rarity": "rare",
  "kind": "armor",
  "stats": {
   "vitality": 4,
   "defense": 3,
   "res_poison": 5,
   "shadow": 2
  },
  "set": "plagued",
  "slot": "Feet",
  "price": 1962,
  "sell": 378,
  "protection": 3,
  "durability": 235
 },
 "etheria:pyromancer_helmet": {
  "id": "etheria:pyromancer_helmet",
  "name": "Capacete do Piromante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 6,
   "fire": 8,
   "res_fire": 7,
   "defense": 1
  },
  "set": "pyromancer",
  "slot": "Head",
  "price": 4222,
  "sell": 768,
  "protection": 4,
  "durability": 326
 },
 "etheria:pyromancer_chest": {
  "id": "etheria:pyromancer_chest",
  "name": "Peitoral do Piromante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 11,
   "fire": 13,
   "res_fire": 13,
   "defense": 2
  },
  "set": "pyromancer",
  "slot": "Chest",
  "price": 7389,
  "sell": 1344,
  "protection": 7,
  "durability": 571
 },
 "etheria:pyromancer_legs": {
  "id": "etheria:pyromancer_legs",
  "name": "Calças do Piromante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 9,
   "fire": 11,
   "res_fire": 10,
   "defense": 2
  },
  "set": "pyromancer",
  "slot": "Legs",
  "price": 5805,
  "sell": 1056,
  "protection": 6,
  "durability": 448
 },
 "etheria:pyromancer_boots": {
  "id": "etheria:pyromancer_boots",
  "name": "Botas do Piromante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 6,
   "fire": 7,
   "res_fire": 6,
   "defense": 1
  },
  "set": "pyromancer",
  "slot": "Feet",
  "price": 3694,
  "sell": 672,
  "protection": 4,
  "durability": 285
 },
 "etheria:cryomancer_helmet": {
  "id": "etheria:cryomancer_helmet",
  "name": "Capacete do Criomante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 6,
   "ice": 8,
   "defense": 3,
   "manaRegen": 7
  },
  "set": "cryomancer",
  "slot": "Head",
  "price": 4222,
  "sell": 768,
  "protection": 4,
  "durability": 326
 },
 "etheria:cryomancer_chest": {
  "id": "etheria:cryomancer_chest",
  "name": "Peitoral do Criomante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 11,
   "ice": 13,
   "defense": 4,
   "manaRegen": 13
  },
  "set": "cryomancer",
  "slot": "Chest",
  "price": 7389,
  "sell": 1344,
  "protection": 7,
  "durability": 571
 },
 "etheria:cryomancer_legs": {
  "id": "etheria:cryomancer_legs",
  "name": "Calças do Criomante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 9,
   "ice": 11,
   "defense": 4,
   "manaRegen": 10
  },
  "set": "cryomancer",
  "slot": "Legs",
  "price": 5805,
  "sell": 1056,
  "protection": 6,
  "durability": 448
 },
 "etheria:cryomancer_boots": {
  "id": "etheria:cryomancer_boots",
  "name": "Botas do Criomante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "intelligence": 6,
   "ice": 7,
   "defense": 2,
   "manaRegen": 6
  },
  "set": "cryomancer",
  "slot": "Feet",
  "price": 3694,
  "sell": 672,
  "protection": 4,
  "durability": 285
 },
 "etheria:electromancer_helmet": {
  "id": "etheria:electromancer_helmet",
  "name": "Capacete do Eletromante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 6,
   "lightning": 8,
   "cdr": 4,
   "defense": 1
  },
  "set": "electromancer",
  "slot": "Head",
  "price": 4222,
  "sell": 768,
  "protection": 4,
  "durability": 326
 },
 "etheria:electromancer_chest": {
  "id": "etheria:electromancer_chest",
  "name": "Peitoral do Eletromante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 11,
   "lightning": 13,
   "cdr": 6,
   "defense": 2
  },
  "set": "electromancer",
  "slot": "Chest",
  "price": 7389,
  "sell": 1344,
  "protection": 7,
  "durability": 571
 },
 "etheria:electromancer_legs": {
  "id": "etheria:electromancer_legs",
  "name": "Calças do Eletromante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 9,
   "lightning": 11,
   "cdr": 5,
   "defense": 2
  },
  "set": "electromancer",
  "slot": "Legs",
  "price": 5805,
  "sell": 1056,
  "protection": 6,
  "durability": 448
 },
 "etheria:electromancer_boots": {
  "id": "etheria:electromancer_boots",
  "name": "Botas do Eletromante",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "agility": 6,
   "lightning": 7,
   "cdr": 3,
   "defense": 1
  },
  "set": "electromancer",
  "slot": "Feet",
  "price": 3694,
  "sell": 672,
  "protection": 4,
  "durability": 285
 },
 "etheria:cultist_helmet": {
  "id": "etheria:cultist_helmet",
  "name": "Capacete do Cultista",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "strength": 4,
   "lifesteal": 2,
   "blood": 6,
   "defense": 3
  },
  "set": "cultist",
  "slot": "Head",
  "price": 4222,
  "sell": 768,
  "protection": 4,
  "durability": 326
 },
 "etheria:cultist_chest": {
  "id": "etheria:cultist_chest",
  "name": "Peitoral do Cultista",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "strength": 7,
   "lifesteal": 3,
   "blood": 11,
   "defense": 4
  },
  "set": "cultist",
  "slot": "Chest",
  "price": 7389,
  "sell": 1344,
  "protection": 7,
  "durability": 571
 },
 "etheria:cultist_legs": {
  "id": "etheria:cultist_legs",
  "name": "Calças do Cultista",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "strength": 5,
   "lifesteal": 2,
   "blood": 9,
   "defense": 4
  },
  "set": "cultist",
  "slot": "Legs",
  "price": 5805,
  "sell": 1056,
  "protection": 6,
  "durability": 448
 },
 "etheria:cultist_boots": {
  "id": "etheria:cultist_boots",
  "name": "Botas do Cultista",
  "rarity": "epic",
  "kind": "armor",
  "stats": {
   "strength": 3,
   "lifesteal": 2,
   "blood": 6,
   "defense": 2
  },
  "set": "cultist",
  "slot": "Feet",
  "price": 3694,
  "sell": 672,
  "protection": 4,
  "durability": 285
 },
 "etheria:archevoker_helmet": {
  "id": "etheria:archevoker_helmet",
  "name": "Capacete do Arquievocador",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "intelligence": 11,
   "manaRegen": 16,
   "mana": 48,
   "defense": 3,
   "arcane": 8
  },
  "set": "archevoker",
  "slot": "Head",
  "price": 10302,
  "sell": 1728,
  "protection": 6,
  "durability": 441
 },
 "etheria:archevoker_chest": {
  "id": "etheria:archevoker_chest",
  "name": "Peitoral do Arquievocador",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "intelligence": 20,
   "manaRegen": 27,
   "mana": 84,
   "defense": 6,
   "arcane": 14
  },
  "set": "archevoker",
  "slot": "Chest",
  "price": 18030,
  "sell": 3024,
  "protection": 11,
  "durability": 772
 },
 "etheria:archevoker_legs": {
  "id": "etheria:archevoker_legs",
  "name": "Calças do Arquievocador",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "intelligence": 15,
   "manaRegen": 22,
   "mana": 66,
   "defense": 4,
   "arcane": 11
  },
  "set": "archevoker",
  "slot": "Legs",
  "price": 14166,
  "sell": 2376,
  "protection": 9,
  "durability": 607
 },
 "etheria:archevoker_boots": {
  "id": "etheria:archevoker_boots",
  "name": "Botas do Arquievocador",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "intelligence": 10,
   "manaRegen": 14,
   "mana": 42,
   "defense": 3,
   "arcane": 7
  },
  "set": "archevoker",
  "slot": "Feet",
  "price": 9015,
  "sell": 1512,
  "protection": 5,
  "durability": 386
 },
 "etheria:shadowwalker_helmet": {
  "id": "etheria:shadowwalker_helmet",
  "name": "Capacete do Andarilho das Sombras",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "agility": 11,
   "crit": 7,
   "shadow": 8,
   "defense": 3,
   "critDmg": 11
  },
  "set": "shadowwalker",
  "slot": "Head",
  "price": 10302,
  "sell": 1728,
  "protection": 6,
  "durability": 441
 },
 "etheria:shadowwalker_chest": {
  "id": "etheria:shadowwalker_chest",
  "name": "Peitoral do Andarilho das Sombras",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "agility": 20,
   "crit": 12,
   "shadow": 14,
   "defense": 6,
   "critDmg": 20
  },
  "set": "shadowwalker",
  "slot": "Chest",
  "price": 18030,
  "sell": 3024,
  "protection": 11,
  "durability": 772
 },
 "etheria:shadowwalker_legs": {
  "id": "etheria:shadowwalker_legs",
  "name": "Calças do Andarilho das Sombras",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "agility": 15,
   "crit": 9,
   "shadow": 11,
   "defense": 4,
   "critDmg": 15
  },
  "set": "shadowwalker",
  "slot": "Legs",
  "price": 14166,
  "sell": 2376,
  "protection": 9,
  "durability": 607
 },
 "etheria:shadowwalker_boots": {
  "id": "etheria:shadowwalker_boots",
  "name": "Botas do Andarilho das Sombras",
  "rarity": "legendary",
  "kind": "armor",
  "stats": {
   "agility": 10,
   "crit": 6,
   "shadow": 7,
   "defense": 3,
   "critDmg": 10
  },
  "set": "shadowwalker",
  "slot": "Feet",
  "price": 9015,
  "sell": 1512,
  "protection": 5,
  "durability": 386
 },
 "etheria:taratect_silk": {
  "id": "etheria:taratect_silk",
  "name": "Seda de Taratect",
  "rarity": "uncommon",
  "kind": "material",
  "sell": 20
 },
 "etheria:poison_gland": {
  "id": "etheria:poison_gland",
  "name": "Glândula de Veneno",
  "rarity": "rare",
  "kind": "material",
  "sell": 60
 },
 "etheria:tt_dead_end_rainbow": {
  "id": "etheria:tt_dead_end_rainbow",
  "name": "Dead End Rainbow (Hinata)",
  "rarity": "mythic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 30,
   "agility": 14,
   "crit": 12,
   "strength": 8
  },
  "price": 24000,
  "sell": 6000
 },
 "etheria:tt_shizue_sword": {
  "id": "etheria:tt_shizue_sword",
  "name": "Espada de Shizue Izawa",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 24,
   "agility": 12,
   "crit": 10,
   "intelligence": 6
  },
  "price": 16000,
  "sell": 4000
 },
 "etheria:tt_sword_of_tempest": {
  "id": "etheria:tt_sword_of_tempest",
  "name": "Espada de Tempest",
  "rarity": "mythic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 29,
   "agility": 13,
   "crit": 12,
   "intelligence": 8
  },
  "price": 22000,
  "sell": 5500
 },
 "etheria:tt_katana": {
  "id": "etheria:tt_katana",
  "name": "Katana do Tempest",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "agility": 12,
   "crit": 10
  },
  "price": 6000,
  "sell": 1500
 },
 "etheria:tt_ice_blade": {
  "id": "etheria:tt_ice_blade",
  "name": "Lâmina de Gelo",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 17,
   "agility": 10,
   "intelligence": 6
  },
  "price": 5500,
  "sell": 1375
 },
 "etheria:tt_crimson_lotus_edge": {
  "id": "etheria:tt_crimson_lotus_edge",
  "name": "Lâmina do Lótus Carmesim",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 22,
   "agility": 11,
   "crit": 9
  },
  "price": 12000,
  "sell": 3000
 },
 "etheria:tt_spatial_blade": {
  "id": "etheria:tt_spatial_blade",
  "name": "Lâmina Espacial",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 19,
   "agility": 11,
   "intelligence": 7
  },
  "price": 7000,
  "sell": 1750
 },
 "etheria:tt_spatial_blades": {
  "id": "etheria:tt_spatial_blades",
  "name": "Lâminas Espaciais",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "dagger",
  "stats": {
   "atk": 12,
   "agility": 14,
   "crit": 9
  },
  "price": 3000,
  "sell": 750
 },
 "etheria:tt_gobuta_kodachi": {
  "id": "etheria:tt_gobuta_kodachi",
  "name": "Kodachi de Gobuta",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "dagger",
  "stats": {
   "atk": 11,
   "agility": 12,
   "crit": 8
  },
  "price": 2500,
  "sell": 625
 },
 "etheria:tt_kunai": {
  "id": "etheria:tt_kunai",
  "name": "Kunai",
  "rarity": "uncommon",
  "kind": "weapon",
  "wtype": "dagger",
  "stats": {
   "atk": 8,
   "agility": 10,
   "crit": 7
  },
  "price": 900,
  "sell": 225
 },
 "etheria:tt_battle_axe": {
  "id": "etheria:tt_battle_axe",
  "name": "Machado de Batalha",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "axe",
  "stats": {
   "atk": 16,
   "strength": 8
  },
  "price": 3500,
  "sell": 875
 },
 "etheria:tt_orc_axe": {
  "id": "etheria:tt_orc_axe",
  "name": "Machado Orc",
  "rarity": "uncommon",
  "kind": "weapon",
  "wtype": "axe",
  "stats": {
   "atk": 13,
   "strength": 6
  },
  "price": 1500,
  "sell": 375
 },
 "etheria:tt_orc_cleaver": {
  "id": "etheria:tt_orc_cleaver",
  "name": "Cutelo Orc",
  "rarity": "uncommon",
  "kind": "weapon",
  "wtype": "axe",
  "stats": {
   "atk": 12,
   "strength": 6
  },
  "price": 1300,
  "sell": 325
 },
 "etheria:tt_battle_hammer": {
  "id": "etheria:tt_battle_hammer",
  "name": "Martelo de Batalha",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "axe",
  "stats": {
   "atk": 17,
   "strength": 9
  },
  "price": 3800,
  "sell": 950
 },
 "etheria:tt_mace": {
  "id": "etheria:tt_mace",
  "name": "Maça",
  "rarity": "uncommon",
  "kind": "weapon",
  "wtype": "axe",
  "stats": {
   "atk": 11,
   "strength": 5
  },
  "price": 1100,
  "sell": 275
 },
 "etheria:tt_ogre_eater": {
  "id": "etheria:tt_ogre_eater",
  "name": "Devorador de Ogros",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "axe",
  "stats": {
   "atk": 20,
   "strength": 10
  },
  "price": 8000,
  "sell": 2000
 },
 "etheria:tt_goblin_bat": {
  "id": "etheria:tt_goblin_bat",
  "name": "Taco do Goblin",
  "rarity": "common",
  "kind": "weapon",
  "wtype": "axe",
  "stats": {
   "atk": 7,
   "strength": 3
  },
  "price": 300,
  "sell": 75
 },
 "etheria:yamato": {
  "id": "etheria:yamato",
  "name": "Yamato",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 26,
   "agility": 12,
   "crit": 14,
   "void": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.3,
   "name": "Corte Dimensional"
  },
  "price": 12000,
  "sell": 3000
 },
 "etheria:mirror_sword_gold": {
  "id": "etheria:mirror_sword_gold",
  "name": "Espada Espelhada Dourada",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 20,
   "crit": 10,
   "light": 8
  },
  "price": 4800,
  "sell": 1200
 },
 "etheria:mirror_sword_blood": {
  "id": "etheria:mirror_sword_blood",
  "name": "Espada Espelhada Sangrenta",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 21,
   "crit": 8,
   "blood": 10
  },
  "onHit": {
   "kind": "bleed",
   "sec": 5,
   "chance": 0.25,
   "name": "Reflexo Sangrento"
  },
  "price": 4800,
  "sell": 1200
 },
 "etheria:eagle_claw": {
  "id": "etheria:eagle_claw",
  "name": "Garra da Águia",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 19,
   "agility": 10,
   "wind": 8
  },
  "price": 4800,
  "sell": 1200
 },
 "etheria:eagle_fang": {
  "id": "etheria:eagle_fang",
  "name": "Presa da Águia",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 20,
   "crit": 9,
   "wind": 6
  },
  "price": 4800,
  "sell": 1200
 },
 "etheria:re_dagger": {
  "id": "etheria:re_dagger",
  "name": "Adaga Gêmea",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "dagger",
  "stats": {
   "atk": 11,
   "agility": 8,
   "crit": 6
  },
  "price": 2200,
  "sell": 550
 },
 "etheria:re_sword_1": {
  "id": "etheria:re_sword_1",
  "name": "Lâmina Ametista Sombria",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "void": 6
  },
  "price": 4800,
  "sell": 1200
 },
 "etheria:re_sword_2": {
  "id": "etheria:re_sword_2",
  "name": "Lâmina de Brasa Negra",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "fire": 6
  },
  "onHit": {
   "kind": "burn",
   "sec": 3,
   "chance": 0.2,
   "name": "Brasa"
  },
  "price": 4800,
  "sell": 1200
 },
 "etheria:re_sword_3": {
  "id": "etheria:re_sword_3",
  "name": "Lâmina Esmeralda Sombria",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 16,
   "wind": 5
  },
  "price": 2200,
  "sell": 550
 },
 "etheria:re_sword_4": {
  "id": "etheria:re_sword_4",
  "name": "Lâmina da Noite Azul",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 18,
   "ice": 6
  },
  "onHit": {
   "kind": "slow",
   "sec": 3,
   "chance": 0.2,
   "name": "Gelo Noturno"
  },
  "price": 4800,
  "sell": 1200
 },
 "etheria:re_sword_5": {
  "id": "etheria:re_sword_5",
  "name": "Espada Violeta",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 15,
   "arcane": 5
  },
  "price": 2200,
  "sell": 550
 },
 "etheria:re_sword_6": {
  "id": "etheria:re_sword_6",
  "name": "Espada de Jade",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 15,
   "earth": 5
  },
  "price": 2200,
  "sell": 550
 },
 "etheria:re_sword_7": {
  "id": "etheria:re_sword_7",
  "name": "Espada Carmesim",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 16,
   "blood": 5
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.2,
   "name": "Corte Carmesim"
  },
  "price": 2200,
  "sell": 550
 },
 "etheria:re_sword_8": {
  "id": "etheria:re_sword_8",
  "name": "Espada de Ferro Antigo",
  "rarity": "uncommon",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 11,
   "strength": 3
  },
  "price": 900,
  "sell": 225
 },
 "etheria:re_sword_9": {
  "id": "etheria:re_sword_9",
  "name": "Espada Estelar",
  "rarity": "epic",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 20,
   "light": 6
  },
  "price": 4800,
  "sell": 1200
 },
 "etheria:re_sword_10": {
  "id": "etheria:re_sword_10",
  "name": "Espada de Prata",
  "rarity": "uncommon",
  "kind": "weapon",
  "wtype": "sword",
  "stats": {
   "atk": 12,
   "strength": 3
  },
  "price": 900,
  "sell": 225
 },
 "etheria:re_scythe": {
  "id": "etheria:re_scythe",
  "name": "Foice de Osso",
  "rarity": "rare",
  "kind": "weapon",
  "wtype": "scythe",
  "stats": {
   "atk": 17,
   "shadow": 5
  },
  "onHit": {
   "kind": "bleed",
   "sec": 4,
   "chance": 0.2,
   "name": "Ceifa"
  },
  "price": 2200,
  "sell": 550
 },
 "etheria:sea_dragons_trident": {
  "id": "etheria:sea_dragons_trident",
  "name": "Tridente dos Dragões Marinhos",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "spear",
  "stats": {
   "atk": 24,
   "strength": 8,
   "water": 12,
   "lightning": 8
  },
  "onHit": {
   "kind": "slow",
   "sec": 3,
   "chance": 0.2,
   "name": "Maré"
  },
  "price": 12000,
  "sell": 3000
 },
 "etheria:archangel_lance": {
  "id": "etheria:archangel_lance",
  "name": "Lança do Arcanjo",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "spear",
  "stats": {
   "atk": 25,
   "strength": 12,
   "intelligence": 10,
   "crit": 6,
   "light": 16
  },
  "onHit": {
   "kind": "heal",
   "amount": 3,
   "chance": 0.2,
   "name": "Luz do Arcanjo"
  },
  "price": 16000,
  "sell": 4000
 },
 "etheria:shadow_scythe": {
  "id": "etheria:shadow_scythe",
  "name": "Foice Sombria",
  "rarity": "legendary",
  "kind": "weapon",
  "wtype": "scythe",
  "stats": {
   "atk": 26,
   "strength": 16,
   "intelligence": 6,
   "lifesteal": 8
  },
  "onHit": {
   "kind": "bleed",
   "sec": 6,
   "chance": 0.3,
   "name": "Ceifa Sombria"
  },
  "price": 16000,
  "sell": 4000
 }
};

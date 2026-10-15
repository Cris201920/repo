// GERADO por tools/skillpack.py
export const PACK = [
{
"id": "absorb_dissolve",
"name": "Absorver e Dissolver",
"type": "active",
"cat": "Intrínseca",
"element": "void",
"rarity": "rare",
"mana": 14,
"cd": 6,
"level": 5,
"sp": 1,
"req": [],
"desc": "Dissolve o alvo à frente, causando dano contínuo e absorvendo parte como mana.",
"exec": {
"kind": "link",
"range": 5,
"sec": 3,
"power": 0.9,
"stat": "intelligence",
"manaGain": 0.35,
"snd": "mob.slime.big"
}
},
{
"id": "bulletproof",
"name": "Colete à Prova de Balas",
"type": "passive",
"cat": "Intrínseca",
"rarity": "uncommon",
"mana": 0,
"cd": 0,
"level": 8,
"sp": 1,
"req": [],
"desc": "Resistência a projéteis e golpes físicos (+15% res. física, +3 Defesa).",
"stats": {
"defense": 3,
"res_physical": 15,
"res_projectile": 25
}
},
{
"id": "combustion",
"name": "Combustão",
"type": "active",
"cat": "Intrínseca",
"element": "fire",
"rarity": "rare",
"mana": 22,
"cd": 9,
"level": 10,
"sp": 2,
"req": [],
"desc": "Detona uma combustão ao seu redor, queimando todos os inimigos próximos.",
"exec": {
"kind": "aoe_self",
"radius": 5.5,
"power": 2.2,
"stat": "intelligence",
"burn": 6,
"knock": 0.8,
"snd": "random.explode"
}
},
{
"id": "flame_breath",
"name": "Sopro de Chamas",
"type": "active",
"cat": "Intrínseca",
"element": "fire",
"rarity": "uncommon",
"mana": 14,
"cd": 5,
"level": 6,
"sp": 1,
"req": [],
"desc": "Sopra um jato de chamas em cone.",
"exec": {
"kind": "cone",
"range": 7,
"angle": 40,
"power": 1.8,
"stat": "intelligence",
"burn": 5,
"snd": "mob.blaze.shoot"
}
},
{
"id": "heat_sense",
"name": "Sensor de Calor",
"type": "active",
"cat": "Intrínseca",
"element": "fire",
"rarity": "common",
"mana": 8,
"cd": 12,
"level": 4,
"sp": 1,
"req": [],
"desc": "Detecta seres vivos num raio de 24 blocos, destacando-os por 10s.",
"exec": {
"kind": "sense",
"radius": 24,
"sec": 10,
"snd": "beacon.activate"
}
},
{
"id": "noxious_breath",
"name": "Hálito Nocivo",
"type": "active",
"cat": "Intrínseca",
"element": "shadow",
"rarity": "uncommon",
"mana": 14,
"cd": 8,
"level": 8,
"sp": 1,
"req": [],
"desc": "Nuvem tóxica em cone que envenena.",
"exec": {
"kind": "cone",
"range": 6,
"angle": 60,
"power": 0.8,
"stat": "intelligence",
"debuff": {
"id": "poison",
"sec": 8
},
"snd": "mob.spider.say"
}
},
{
"id": "paralyzing_breath",
"name": "Respiração Paralisante",
"type": "active",
"cat": "Intrínseca",
"element": "lightning",
"rarity": "rare",
"mana": 20,
"cd": 14,
"level": 14,
"sp": 2,
"req": [
"noxious_breath"
],
"desc": "Respiração que paralisa os inimigos à frente por 4s.",
"exec": {
"kind": "cone",
"range": 6,
"angle": 50,
"power": 0.6,
"stat": "intelligence",
"debuff": {
"id": "paralyze",
"sec": 4
},
"snd": "mob.guardian.curse"
}
},
{
"id": "range_barrier",
"name": "Barreira de Alcance",
"type": "active",
"cat": "Intrínseca",
"element": "arcane",
"rarity": "rare",
"mana": 22,
"cd": 20,
"level": 12,
"sp": 2,
"req": [],
"desc": "Domo de proteção: absorção e resistência por 15s.",
"exec": {
"kind": "buff",
"sec": 15,
"absorb": 6,
"buff": {
"id": "barrier",
"stats": {
"defense": 8,
"res_magic": 15,
"res_projectile": 30
}
},
"snd": "beacon.activate"
}
},
{
"id": "self_regen",
"name": "Regeneração Própria",
"type": "passive",
"cat": "Intrínseca",
"rarity": "uncommon",
"mana": 0,
"cd": 0,
"level": 6,
"sp": 1,
"req": [],
"desc": "Seu corpo se regenera continuamente.",
"effects": [
{
"id": "regeneration",
"amp": 0
}
]
},
{
"id": "regen_ultra",
"name": "Regeneração: Ultravelocidade",
"type": "passive",
"cat": "Intrínseca",
"rarity": "epic",
"mana": 0,
"cd": 0,
"level": 25,
"sp": 2,
"req": [
"self_regen"
],
"desc": "Regeneração em altíssima velocidade.",
"stats": {
"vitality": 3
},
"effects": [
{
"id": "regeneration",
"amp": 1
}
]
},
{
"id": "regen_infinite",
"name": "Regeneração: Infinita",
"type": "passive",
"cat": "Intrínseca",
"rarity": "legendary",
"mana": 0,
"cd": 0,
"level": 55,
"sp": 4,
"req": [
"regen_ultra"
],
"desc": "Regeneração praticamente ilimitada.",
"stats": {
"vitality": 8,
"hp": 40
},
"effects": [
{
"id": "regeneration",
"amp": 2
}
]
},
{
"id": "thread_manip",
"name": "Manipulação de Threads",
"type": "active",
"cat": "Intrínseca",
"element": "physical",
"rarity": "rare",
"mana": 18,
"cd": 10,
"level": 9,
"sp": 2,
"req": [],
"desc": "Fios que prendem os inimigos numa área, imobilizando-os.",
"exec": {
"kind": "bind",
"range": 16,
"radius": 4,
"sec": 5,
"power": 0.8,
"stat": "agility",
"debuff": {
"id": "paralyze",
"sec": 3
},
"snd": "mob.spider.step"
}
},
{
"id": "thunder_breath",
"name": "Sopro de Trovão",
"type": "active",
"cat": "Intrínseca",
"element": "lightning",
"rarity": "epic",
"mana": 30,
"cd": 10,
"level": 20,
"sp": 3,
"req": [],
"desc": "Rajada elétrica que atravessa todos os inimigos à frente.",
"exec": {
"kind": "beam",
"range": 22,
"width": 1.4,
"power": 3.0,
"stat": "intelligence",
"pierce": true,
"snd": "ambient.weather.thunder"
}
},
{
"id": "ultrasonic",
"name": "Onda Ultrassônica",
"type": "active",
"cat": "Intrínseca",
"element": "wind",
"rarity": "rare",
"mana": 18,
"cd": 8,
"level": 12,
"sp": 2,
"req": [],
"desc": "Onda sônica que empurra e atordoa tudo ao redor.",
"exec": {
"kind": "wave",
"radius": 8,
"power": 1.4,
"stat": "intelligence",
"knock": 1.6,
"debuff": {
"id": "stun",
"sec": 2
},
"snd": "mob.warden.sonic_boom"
}
},
{
"id": "vampirism",
"name": "Vampirismo",
"type": "active",
"cat": "Intrínseca",
"element": "blood",
"rarity": "epic",
"mana": 18,
"cd": 9,
"level": 18,
"sp": 3,
"req": [],
"desc": "Drena a vida do alvo ao longo de 4s e a transfere para você.",
"exec": {
"kind": "link",
"range": 6,
"sec": 4,
"power": 1.3,
"stat": "intelligence",
"heal": 0.6,
"snd": "mob.phantom.bite"
}
},
{
"id": "black_flame",
"name": "Chama Negra",
"type": "active",
"cat": "Extra",
"element": "shadow",
"rarity": "epic",
"mana": 30,
"cd": 7,
"level": 24,
"sp": 3,
"req": [],
"desc": "Chamas negras que queimam e degeneram o alvo e os próximos a ele.",
"exec": {
"kind": "projectile",
"range": 26,
"radius": 2.8,
"power": 2.8,
"stat": "intelligence",
"burn": 8,
"debuff": {
"id": "degenerate",
"sec": 5
},
"snd": "mob.blaze.shoot"
}
},
{
"id": "black_lightning",
"name": "Raio Negro",
"type": "active",
"cat": "Extra",
"element": "shadow",
"rarity": "epic",
"mana": 28,
"cd": 8,
"level": 26,
"sp": 3,
"req": [
"lightning"
],
"desc": "Raio sombrio que atravessa a linha de visão.",
"exec": {
"kind": "beam",
"range": 30,
"width": 0.9,
"power": 3.2,
"stat": "intelligence",
"pierce": true,
"snd": "ambient.weather.thunder"
}
},
{
"id": "black_thunder",
"name": "Trovão Negro",
"type": "active",
"cat": "Extra",
"element": "shadow",
"rarity": "legendary",
"mana": 55,
"cd": 18,
"level": 40,
"sp": 4,
"req": [
"black_lightning"
],
"desc": "Convoca trovões negros que caem repetidamente na área marcada.",
"exec": {
"kind": "storm",
"range": 26,
"radius": 6,
"sec": 4,
"strikes": 8,
"power": 3.4,
"stat": "intelligence",
"debuff": {
"id": "stun",
"sec": 1
},
"snd": "ambient.weather.thunder"
}
},
{
"id": "death_storm",
"name": "Tempestade da Morte",
"type": "active",
"cat": "Extra",
"element": "void",
"rarity": "mythic",
"mana": 80,
"cd": 40,
"level": 60,
"sp": 5,
"req": [
"black_thunder"
],
"desc": "Tempestade mortal que degenera tudo numa grande área por vários segundos.",
"exec": {
"kind": "storm",
"range": 24,
"radius": 10,
"sec": 7,
"strikes": 18,
"power": 3.0,
"stat": "intelligence",
"debuff": {
"id": "degenerate",
"sec": 6
},
"snd": "mob.wither.spawn"
}
},
{
"id": "earth_manip",
"name": "Manipulação da Terra",
"type": "active",
"cat": "Extra",
"element": "earth",
"rarity": "rare",
"mana": 24,
"cd": 9,
"level": 16,
"sp": 2,
"req": [],
"desc": "Eleva pilares de terra que arremessam e atordoam.",
"exec": {
"kind": "target_aoe",
"range": 18,
"radius": 4,
"power": 2.3,
"stat": "strength",
"debuff": {
"id": "stun",
"sec": 2
},
"snd": "dig.gravel"
}
},
{
"id": "fire_manip",
"name": "Manipulação do Fogo",
"type": "active",
"cat": "Extra",
"element": "fire",
"rarity": "rare",
"mana": 26,
"cd": 12,
"level": 18,
"sp": 2,
"req": [],
"desc": "Controla um campo de chamas que queima quem estiver dentro.",
"exec": {
"kind": "field",
"range": 18,
"radius": 4.5,
"sec": 5,
"power": 0.7,
"stat": "intelligence",
"burn": 3,
"snd": "fire.fire"
}
},
{
"id": "gravity_manip",
"name": "Manipulação da Gravidade",
"type": "active",
"cat": "Extra",
"element": "void",
"rarity": "epic",
"mana": 34,
"cd": 14,
"level": 30,
"sp": 3,
"req": [],
"desc": "Campo gravitacional que puxa e comprime os inimigos.",
"exec": {
"kind": "field",
"range": 20,
"radius": 6,
"sec": 5,
"power": 0.6,
"stat": "intelligence",
"pull": 0.5,
"snd": "mob.endermen.portal"
}
},
{
"id": "hellflame",
"name": "Chama Infernal",
"type": "active",
"cat": "Extra",
"element": "fire",
"rarity": "epic",
"mana": 36,
"cd": 12,
"level": 28,
"sp": 3,
"req": [],
"desc": "Chamas do inferno devastam uma área ampla.",
"exec": {
"kind": "target_aoe",
"range": 22,
"radius": 6,
"power": 3.0,
"stat": "intelligence",
"burn": 10,
"snd": "mob.ghast.fireball"
}
},
{
"id": "hydro_propulsion",
"name": "Propulsão Hidráulica",
"type": "active",
"cat": "Extra",
"element": "water",
"rarity": "uncommon",
"mana": 12,
"cd": 6,
"level": 8,
"sp": 1,
"req": [],
"desc": "Jato de água que impulsiona você para frente e empurra quem estiver no caminho.",
"exec": {
"kind": "dash",
"power": 9,
"damage": 1.4,
"stat": "agility",
"snd": "liquid.swim"
},
"stamina": 10
},
{
"id": "magic_improv",
"name": "Improvisação Mágica",
"type": "active",
"cat": "Extra",
"element": "arcane",
"rarity": "rare",
"mana": 22,
"cd": 10,
"level": 14,
"sp": 2,
"req": [],
"desc": "Lança uma habilidade conhecida aleatória sem custo adicional.",
"exec": {
"kind": "improvise",
"snd": "mob.evocation_illager.cast_spell"
}
},
{
"id": "magic_manip",
"name": "Manipulação Mágica",
"type": "active",
"cat": "Extra",
"element": "arcane",
"rarity": "epic",
"mana": 30,
"cd": 30,
"level": 22,
"sp": 3,
"req": [],
"desc": "Controle total da mana: +10 Int., +80% regen. de mana e -15% recarga por 20s.",
"exec": {
"kind": "buff",
"sec": 20,
"buff": {
"id": "arcane_surge",
"stats": {
"intelligence": 10,
"manaRegen": 80,
"cdr": 15
}
},
"snd": "beacon.power_select"
}
},
{
"id": "magic_sense",
"name": "Sentido Mágico",
"type": "active",
"cat": "Extra",
"element": "arcane",
"rarity": "uncommon",
"mana": 10,
"cd": 14,
"level": 10,
"sp": 1,
"req": [],
"desc": "Percebe fontes de mana (criaturas) num raio de 32 blocos por 12s.",
"exec": {
"kind": "sense",
"radius": 32,
"sec": 12,
"snd": "beacon.activate"
}
},
{
"id": "molecular_manip",
"name": "Manipulação Molecular",
"type": "active",
"cat": "Extra",
"element": "physical",
"rarity": "legendary",
"mana": 40,
"cd": 12,
"level": 38,
"sp": 4,
"req": [],
"desc": "Corte molecular: raio finíssimo que dilacera tudo na linha.",
"exec": {
"kind": "beam",
"range": 34,
"width": 0.5,
"power": 4.2,
"stat": "intelligence",
"pierce": true,
"debuff": {
"id": "bleed",
"sec": 6
},
"snd": "random.anvil_break"
}
},
{
"id": "perfect_memory",
"name": "Memória Perfeita",
"type": "passive",
"cat": "Extra",
"rarity": "rare",
"mana": 0,
"cd": 0,
"level": 18,
"sp": 2,
"req": [],
"desc": "Nada é esquecido: -8% recarga, +10% XP.",
"stats": {
"cdr": 8,
"xp": 10
}
},
{
"id": "sage_extra",
"name": "Sábio",
"type": "passive",
"cat": "Extra",
"rarity": "epic",
"mana": 0,
"cd": 0,
"level": 28,
"sp": 3,
"req": [],
"desc": "Inteligência elevada: +6 Int., +40% regen. de mana, +30 mana.",
"stats": {
"intelligence": 6,
"manaRegen": 40,
"mana": 30
}
},
{
"id": "space_travel",
"name": "Viagem Espacial",
"type": "active",
"cat": "Extra",
"element": "arcane",
"rarity": "legendary",
"mana": 55,
"cd": 30,
"level": 45,
"sp": 4,
"req": [
"teleport"
],
"desc": "Salto espacial de longo alcance.",
"exec": {
"kind": "teleport",
"range": 64,
"snd": "mob.endermen.portal"
}
},
{
"id": "water_blade",
"name": "Lâmina de Água",
"type": "active",
"cat": "Extra",
"element": "water",
"rarity": "uncommon",
"mana": 14,
"cd": 4,
"level": 9,
"sp": 1,
"req": [],
"desc": "Corte de água pressurizada que atravessa os inimigos.",
"exec": {
"kind": "beam",
"range": 16,
"width": 1.6,
"power": 1.9,
"stat": "intelligence",
"pierce": true,
"snd": "liquid.splash"
}
},
{
"id": "water_current",
"name": "Controle da Corrente de Água",
"type": "active",
"cat": "Extra",
"element": "water",
"rarity": "rare",
"mana": 22,
"cd": 10,
"level": 15,
"sp": 2,
"req": [],
"desc": "Corrente que arrasta os inimigos para longe.",
"exec": {
"kind": "field",
"range": 16,
"radius": 5,
"sec": 4,
"power": 0.5,
"stat": "intelligence",
"push": 0.7,
"snd": "liquid.swim"
}
},
{
"id": "water_manip",
"name": "Manipulação da Água",
"type": "active",
"cat": "Extra",
"element": "water",
"rarity": "rare",
"mana": 24,
"cd": 10,
"level": 17,
"sp": 2,
"req": [],
"desc": "Chuva pressurizada que fere inimigos e cura aliados na área.",
"exec": {
"kind": "storm",
"range": 20,
"radius": 6,
"sec": 4,
"strikes": 8,
"power": 1.6,
"stat": "intelligence",
"healAllies": 2,
"snd": "liquid.splash"
}
},
{
"id": "wind_manip",
"name": "Manipulação do Vento",
"type": "active",
"cat": "Extra",
"element": "wind",
"rarity": "rare",
"mana": 20,
"cd": 7,
"level": 13,
"sp": 2,
"req": [],
"desc": "Rajada cortante de vento em cone, arremessando os inimigos.",
"exec": {
"kind": "cone",
"range": 9,
"angle": 70,
"power": 1.9,
"stat": "intelligence",
"knock": 2.0,
"snd": "mob.phantom.swoop"
}
},
{
"id": "analyst",
"name": "Analista",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 12,
"cd": 8,
"level": 1,
"sp": 0,
"req": [],
"desc": "Analisa o alvo, marcando-o e expondo suas fraquezas.",
"exec": {
"kind": "mark",
"range": 20,
"sec": 12,
"analyze": true,
"power": 0,
"snd": "beacon.activate"
},
"unlock": {
"level": 8,
"analyses": 3
}
},
{
"id": "berserker",
"name": "Berserker",
"type": "active",
"cat": "Única",
"element": "blood",
"rarity": "epic",
"mana": 24,
"cd": 40,
"level": 1,
"sp": 0,
"req": [],
"desc": "Remove os limites: grande poder de ataque às custas da defesa.",
"exec": {
"kind": "buff",
"sec": 20,
"buff": {
"id": "berserk_rage",
"stats": {
"strength": 16,
"lifesteal": 8,
"defense": -6,
"crit": 10
}
},
"snd": "mob.ravager.roar"
},
"unlock": {
"level": 15,
"kills": 150
}
},
{
"id": "degenerate",
"name": "Degenerar",
"type": "active",
"cat": "Única",
"element": "void",
"rarity": "epic",
"mana": 28,
"cd": 14,
"level": 1,
"sp": 0,
"req": [],
"desc": "Degenera a matéria dos inimigos na área.",
"exec": {
"kind": "target_aoe",
"range": 18,
"radius": 5,
"power": 1.8,
"stat": "intelligence",
"debuff": {
"id": "degenerate",
"sec": 8
},
"snd": "mob.wither.ambient"
},
"unlock": {
"level": 30,
"skills": [
"soul_drain"
]
}
},
{
"id": "dilettante",
"name": "Diletante",
"type": "active",
"cat": "Única",
"element": "arcane",
"rarity": "rare",
"mana": 20,
"cd": 20,
"level": 1,
"sp": 0,
"req": [],
"desc": "Aprende rápido: +20% XP e +1 em todos os atributos; improvisa habilidades.",
"exec": {
"kind": "improvise",
"snd": "mob.evocation_illager.cast_spell"
},
"unlock": {
"level": 12,
"mastery_total": 10
}
},
{
"id": "envy",
"name": "Inveja",
"type": "active",
"cat": "Única",
"element": "shadow",
"rarity": "epic",
"mana": 26,
"cd": 22,
"level": 1,
"sp": 0,
"req": [],
"desc": "Rouba a força de um alvo: enfraquece-o e fortalece você.",
"exec": {
"kind": "steal",
"range": 12,
"sec": 15,
"power": 0.6,
"stat": "intelligence",
"snd": "mob.evocation_illager.cast_spell"
},
"unlock": {
"level": 22,
"kills": 300
}
},
{
"id": "generalissimo",
"name": "Generalíssimo",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "legendary",
"mana": 40,
"cd": 45,
"level": 1,
"sp": 0,
"req": [],
"desc": "Convoca soldados leais e fortalece os aliados próximos.",
"exec": {
"kind": "summon",
"sec": 50,
"entity": "minecraft:iron_golem",
"name": "§6Soldado",
"snd": "mob.ravager.roar"
},
"unlock": {
"level": 35,
"boss": 1
}
},
{
"id": "artisan",
"name": "Artesão Piedoso",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 25,
"cd": 18,
"level": 1,
"sp": 0,
"req": [],
"desc": "Restaura aliados e concede +20% de moedas.",
"exec": {
"kind": "heal",
"radius": 8,
"amount": 14,
"scale": 0.6,
"snd": "random.levelup"
},
"unlock": {
"level": 18,
"coins": 2000
}
},
{
"id": "gourmet",
"name": "Gourmet",
"type": "active",
"cat": "Única",
"element": "physical",
"rarity": "rare",
"mana": 18,
"cd": 20,
"level": 1,
"sp": 0,
"req": [],
"desc": "Saboreia a energia ao redor: recupera vida, mana e stamina.",
"exec": {
"kind": "feast",
"snd": "random.burp"
},
"unlock": {
"level": 10,
"devoured": 5
}
},
{
"id": "great_sage",
"name": "Grande Sábio",
"type": "passive",
"cat": "Única",
"rarity": "legendary",
"mana": 0,
"cd": 0,
"level": 1,
"sp": 0,
"req": [],
"desc": "Assistente interno: análise, memória, sugestões. Concede +10 Int., +60% regen. de mana e -10% recarga.",
"stats": {
"intelligence": 10,
"manaRegen": 60,
"cdr": 10
},
"unlock": {
"combine": 1
}
},
{
"id": "ambition",
"name": "Ambição",
"type": "active",
"cat": "Única",
"element": "physical",
"rarity": "epic",
"mana": 20,
"cd": 50,
"level": 1,
"sp": 0,
"req": [],
"desc": "Ganância por poder: +30% XP, +25% moedas e mais Força por 25s.",
"exec": {
"kind": "buff",
"sec": 25,
"buff": {
"id": "ambition",
"stats": {
"xp": 30,
"coin": 25,
"strength": 8
}
},
"snd": "random.levelup"
},
"unlock": {
"level": 25,
"coins": 5000
}
},
{
"id": "healer",
"name": "Curandeiro",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 22,
"cd": 10,
"level": 1,
"sp": 0,
"req": [],
"desc": "Cura todos ao redor.",
"exec": {
"kind": "heal",
"radius": 10,
"amount": 18,
"scale": 0.8,
"snd": "random.levelup"
},
"unlock": {
"level": 6,
"skills": [
"heal"
]
}
},
{
"id": "master_physician",
"name": "Mestre Médico",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "epic",
"mana": 40,
"cd": 25,
"level": 1,
"sp": 0,
"req": [],
"desc": "Cura intensa e remove efeitos negativos.",
"exec": {
"kind": "heal",
"radius": 10,
"amount": 40,
"scale": 1.2,
"cleanse": true,
"snd": "random.levelup"
},
"unlock": {
"level": 32,
"mastery": {
"healer": 5
}
}
},
{
"id": "investigator",
"name": "Investigador",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 14,
"cd": 14,
"level": 1,
"sp": 0,
"req": [],
"desc": "Revela e marca criaturas num grande raio.",
"exec": {
"kind": "sense",
"radius": 28,
"sec": 15,
"mark": true,
"snd": "beacon.activate"
},
"unlock": {
"level": 14,
"analyses": 8
}
},
{
"id": "lionheart",
"name": "Coração de Leão",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "epic",
"mana": 26,
"cd": 35,
"level": 1,
"sp": 0,
"req": [],
"desc": "Coragem inabalável: grande defesa, absorção e imunidade ao medo.",
"exec": {
"kind": "buff",
"sec": 20,
"absorb": 8,
"buff": {
"id": "divine_shield",
"stats": {
"defense": 12,
"res_physical": 15,
"res_magic": 15,
"vitality": 6
}
},
"snd": "beacon.activate"
},
"unlock": {
"level": 28,
"bossKills": 1
}
},
{
"id": "lust",
"name": "Luxúria",
"type": "active",
"cat": "Única",
"element": "blood",
"rarity": "epic",
"mana": 26,
"cd": 18,
"level": 1,
"sp": 0,
"req": [],
"desc": "Seduz os inimigos próximos, enfraquecendo-os e drenando sua energia.",
"exec": {
"kind": "aoe_self",
"radius": 7,
"power": 1.0,
"stat": "intelligence",
"drain": 0.8,
"debuff": {
"id": "weak",
"sec": 8
},
"snd": "mob.evocation_illager.prepare_attack"
},
"unlock": {
"level": 24,
"kills": 200
}
},
{
"id": "maker",
"name": "Fabricante",
"type": "active",
"cat": "Única",
"element": "arcane",
"rarity": "rare",
"mana": 30,
"cd": 40,
"level": 1,
"sp": 0,
"req": [],
"desc": "Fabrica um golem de combate por 45s.",
"exec": {
"kind": "summon",
"sec": 45,
"entity": "minecraft:iron_golem",
"name": "§bConstruto",
"snd": "mob.irongolem.hit"
},
"unlock": {
"level": 20,
"items_crafted": 0,
"coins": 1500
}
},
{
"id": "martial_master",
"name": "Mestre Marcial",
"type": "active",
"cat": "Única",
"element": "physical",
"rarity": "epic",
"mana": 18,
"cd": 8,
"level": 1,
"sp": 0,
"req": [],
"desc": "Sequência de três golpes velozes com contra-ataque.",
"exec": {
"kind": "combo",
"hits": 3,
"range": 4,
"angle": 80,
"power": 1.5,
"stat": "strength",
"knock": 0.8,
"snd": "random.anvil_land"
},
"unlock": {
"level": 16,
"kills": 120
}
},
{
"id": "mathematician",
"name": "Matemático",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 16,
"cd": 25,
"level": 1,
"sp": 0,
"req": [],
"desc": "Calcula pontos fracos: +40% crítico e +60% dano crítico por 10s.",
"exec": {
"kind": "buff",
"sec": 10,
"buff": {
"id": "mathematician",
"stats": {
"crit": 40,
"critDmg": 60,
"intelligence": 4
}
},
"snd": "beacon.power_select"
},
"unlock": {
"level": 20,
"analyses": 15
}
},
{
"id": "merciless",
"name": "Impiedoso",
"type": "active",
"cat": "Única",
"element": "shadow",
"rarity": "epic",
"mana": 22,
"cd": 12,
"level": 1,
"sp": 0,
"req": [],
"desc": "Executa inimigos feridos: dano triplo contra alvos com menos de 35% de vida.",
"exec": {
"kind": "execute",
"range": 6,
"power": 2.2,
"stat": "strength",
"threshold": 0.35,
"mult": 3.0,
"snd": "random.anvil_land"
},
"unlock": {
"level": 26,
"kills": 400
}
},
{
"id": "musician",
"name": "Músico",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 24,
"cd": 20,
"level": 1,
"sp": 0,
"req": [],
"desc": "Melodia que acelera e regenera aliados e atordoa inimigos.",
"exec": {
"kind": "wave",
"radius": 9,
"power": 0.8,
"stat": "intelligence",
"knock": 0.3,
"debuff": {
"id": "stun",
"sec": 1.5
},
"buffAllies": {
"id": "speed_regen",
"sec": 12
},
"snd": "note.harp"
},
"unlock": {
"level": 14,
"discoveries": 3
}
},
{
"id": "oppressor",
"name": "Opressor",
"type": "active",
"cat": "Única",
"element": "void",
"rarity": "legendary",
"mana": 30,
"cd": 18,
"level": 1,
"sp": 0,
"req": [],
"desc": "Presença esmagadora: derruba e atordoa tudo ao redor.",
"exec": {
"kind": "wave",
"radius": 9,
"power": 1.6,
"stat": "strength",
"knock": -0.8,
"debuff": {
"id": "fear",
"sec": 5
},
"snd": "mob.wither.spawn"
},
"unlock": {
"level": 34,
"bossKills": 2
}
},
{
"id": "perceptor",
"name": "Perceptor",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 12,
"cd": 12,
"level": 1,
"sp": 0,
"req": [],
"desc": "Percepção aguçada: +10% crítico e revela criaturas.",
"exec": {
"kind": "sense",
"radius": 26,
"sec": 10,
"snd": "beacon.activate"
},
"unlock": {
"level": 16,
"analyses": 6
},
"stats": {
"crit": 10,
"agility": 3
}
},
{
"id": "planner",
"name": "Planejador",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 22,
"cd": 30,
"level": 1,
"sp": 0,
"req": [],
"desc": "Planeja o combate: -12% de recarga e -10% de custo de mana por 25s.",
"exec": {
"kind": "buff",
"sec": 25,
"buff": {
"id": "planner",
"stats": {
"cdr": 12,
"manaCost": 10,
"intelligence": 4
}
},
"snd": "beacon.power_select"
},
"unlock": {
"level": 22,
"mastery_total": 25
}
},
{
"id": "pride",
"name": "Orgulho",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "legendary",
"mana": 36,
"cd": 40,
"level": 1,
"sp": 0,
"req": [],
"desc": "Orgulho inabalável: grandes bônus em todos os atributos e resistência mágica.",
"exec": {
"kind": "buff",
"sec": 20,
"buff": {
"id": "pride",
"stats": {
"strength": 8,
"defense": 8,
"intelligence": 8,
"res_magic": 15
}
},
"snd": "beacon.activate"
},
"unlock": {
"level": 38,
"bossKills": 2
}
},
{
"id": "puppeteer",
"name": "Marionetista",
"type": "active",
"cat": "Única",
"element": "shadow",
"rarity": "epic",
"mana": 26,
"cd": 16,
"level": 1,
"sp": 0,
"req": [],
"desc": "Fios invisíveis controlam os inimigos, paralisando-os.",
"exec": {
"kind": "bind",
"range": 18,
"radius": 5,
"sec": 6,
"power": 1.0,
"stat": "intelligence",
"debuff": {
"id": "paralyze",
"sec": 4
},
"snd": "mob.spider.step"
},
"unlock": {
"level": 24,
"skills": [
"thread_manip"
]
}
},
{
"id": "researcher",
"name": "Pesquisador",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 12,
"cd": 14,
"level": 1,
"sp": 0,
"req": [],
"desc": "Pesquisa o ambiente: +15% XP e detecta criaturas.",
"exec": {
"kind": "sense",
"radius": 24,
"sec": 10,
"snd": "beacon.activate"
},
"unlock": {
"level": 12,
"analyses": 5
},
"stats": {
"xp": 15,
"intelligence": 3
}
},
{
"id": "retaliator",
"name": "Retaliador",
"type": "active",
"cat": "Única",
"element": "physical",
"rarity": "epic",
"mana": 24,
"cd": 24,
"level": 1,
"sp": 0,
"req": [],
"desc": "Devolve a dor: onda de contra-ataque e grande resistência por 10s.",
"exec": {
"kind": "wave",
"radius": 6,
"power": 2.0,
"stat": "strength",
"knock": 1.4,
"buffSelf": {
"id": "retaliator",
"sec": 10,
"stats": {
"defense": 10,
"res_physical": 25
}
},
"snd": "random.anvil_land"
},
"unlock": {
"level": 26,
"hurt": 300
}
},
{
"id": "ruler",
"name": "Governante",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "legendary",
"mana": 44,
"cd": 50,
"level": 1,
"sp": 0,
"req": [],
"desc": "Decreto: convoca um servo real e fortalece todos os atributos.",
"exec": {
"kind": "summon",
"sec": 60,
"entity": "minecraft:iron_golem",
"name": "§6Guarda Real",
"buffSelf": {
"id": "ruler",
"sec": 30,
"stats": {
"strength": 6,
"defense": 6,
"intelligence": 6
}
},
"snd": "mob.ravager.roar"
},
"unlock": {
"combine": 1
}
},
{
"id": "severer",
"name": "Severer",
"type": "active",
"cat": "Única",
"element": "physical",
"rarity": "epic",
"mana": 28,
"cd": 10,
"level": 1,
"sp": 0,
"req": [],
"desc": "Corte decisivo: raio fino que decepa tudo na linha.",
"exec": {
"kind": "beam",
"range": 20,
"width": 0.6,
"power": 3.6,
"stat": "strength",
"pierce": true,
"debuff": {
"id": "bleed",
"sec": 6
},
"snd": "random.anvil_break"
},
"unlock": {
"level": 30,
"kills": 500
}
},
{
"id": "dark_attacker",
"name": "Atacante Sombrio",
"type": "active",
"cat": "Única",
"element": "shadow",
"rarity": "epic",
"mana": 20,
"cd": 8,
"level": 1,
"sp": 0,
"req": [],
"desc": "Avança pelas sombras cortando tudo e ficando invisível brevemente.",
"exec": {
"kind": "dash",
"power": 10,
"damage": 2.4,
"stat": "agility",
"invisible": 3,
"snd": "mob.endermen.teleport"
},
"unlock": {
"level": 20,
"kills": 180
}
},
{
"id": "sloth",
"name": "Preguiça",
"type": "active",
"cat": "Única",
"element": "void",
"rarity": "rare",
"mana": 20,
"cd": 18,
"level": 1,
"sp": 0,
"req": [],
"desc": "Letargia: inimigos próximos ficam lentos e fracos.",
"exec": {
"kind": "wave",
"radius": 10,
"power": 0.2,
"stat": "intelligence",
"knock": 0,
"debuff": {
"id": "sloth",
"sec": 10
},
"snd": "mob.wither.ambient"
},
"unlock": {
"level": 18,
"idle": 1
}
},
{
"id": "spearhead",
"name": "Ponta de Lança",
"type": "active",
"cat": "Única",
"element": "physical",
"rarity": "epic",
"mana": 20,
"cd": 9,
"level": 1,
"sp": 0,
"req": [],
"desc": "Investida de lança: avanço perfurante de grande dano.",
"exec": {
"kind": "dash",
"power": 12,
"damage": 3.0,
"stat": "strength",
"snd": "random.anvil_land"
},
"unlock": {
"level": 22,
"kills": 250
}
},
{
"id": "starving",
"name": "Faminto",
"type": "active",
"cat": "Única",
"element": "blood",
"rarity": "epic",
"mana": 24,
"cd": 12,
"level": 1,
"sp": 0,
"req": [],
"desc": "Fome insaciável: drena a vida de todos ao redor.",
"exec": {
"kind": "aoe_self",
"radius": 6,
"power": 1.6,
"stat": "intelligence",
"drain": 1.0,
"snd": "mob.phantom.bite"
},
"unlock": {
"level": 18,
"devoured": 10
}
},
{
"id": "survivor",
"name": "Sobrevivente",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "rare",
"mana": 28,
"cd": 40,
"level": 1,
"sp": 0,
"req": [],
"desc": "Sobrevive a qualquer coisa: cura imediata e resistência por 12s.",
"exec": {
"kind": "buff",
"sec": 12,
"absorb": 6,
"heal": 14,
"buff": {
"id": "survivor",
"stats": {
"defense": 8,
"vitality": 6,
"res_physical": 15,
"res_magic": 15
}
},
"snd": "random.levelup"
},
"unlock": {
"level": 16,
"hurt": 150
},
"stats": {
"vitality": 4
}
},
{
"id": "chosen_one",
"name": "O Escolhido",
"type": "active",
"cat": "Única",
"element": "light",
"rarity": "mythic",
"mana": 40,
"cd": 40,
"level": 1,
"sp": 0,
"req": [],
"desc": "Explosão sagrada que fere inimigos e cura aliados.",
"exec": {
"kind": "target_aoe",
"range": 24,
"radius": 7,
"power": 3.4,
"stat": "intelligence",
"heal": 16,
"snd": "beacon.activate"
},
"unlock": {
"level": 50,
"bossKills": 4
},
"stats": {
"strength": 3,
"defense": 3,
"intelligence": 3,
"agility": 3,
"vitality": 3
}
},
{
"id": "traveler",
"name": "Viajante",
"type": "active",
"cat": "Única",
"element": "wind",
"rarity": "rare",
"mana": 22,
"cd": 14,
"level": 1,
"sp": 0,
"req": [],
"desc": "Viaja pelo espaço: teletransporte de médio alcance e velocidade.",
"exec": {
"kind": "teleport",
"range": 40,
"snd": "mob.endermen.portal"
},
"unlock": {
"level": 18,
"distance": 1
},
"stats": {
"agility": 3
},
"effects": [
{
"id": "speed",
"amp": 0
}
]
},
{
"id": "usurper",
"name": "Usurpador",
"type": "active",
"cat": "Única",
"element": "void",
"rarity": "legendary",
"mana": 30,
"cd": 24,
"level": 1,
"sp": 0,
"req": [],
"desc": "Usurpa o poder do alvo: enfraquece-o e assume sua força.",
"exec": {
"kind": "steal",
"range": 14,
"sec": 20,
"power": 0.8,
"stat": "intelligence",
"snd": "mob.evocation_illager.cast_spell"
},
"unlock": {
"combine": 1
}
},
{
"id": "fury",
"name": "Fúria",
"type": "active",
"cat": "Única",
"element": "blood",
"rarity": "epic",
"mana": 24,
"cd": 35,
"level": 1,
"sp": 0,
"req": [],
"desc": "Fúria explosiva: grande ataque e crítico, defesa reduzida.",
"exec": {
"kind": "buff",
"sec": 15,
"buff": {
"id": "fury",
"stats": {
"strength": 12,
"crit": 15,
"critDmg": 40,
"defense": -4
}
},
"snd": "mob.ravager.roar"
},
"unlock": {
"level": 20,
"hurt": 200
}
},
{
"id": "beast_roar",
"name": "Rugido da Fera",
"type": "active",
"cat": "Intrínseca",
"element": "physical",
"rarity": "rare",
"mana": 16,
"cd": 12,
"level": 10,
"sp": 2,
"req": [],
"desc": "Rugido bestial: empurra e aterroriza os inimigos ao redor (medo por 5s).",
"exec": {
"kind": "wave",
"radius": 8,
"power": 1.2,
"stat": "strength",
"knock": 1.2,
"debuff": {
"id": "fear",
"sec": 5
},
"snd": "mob.ravager.roar"
}
},
{
"id": "blood_drain",
"name": "Dreno de Sangue",
"type": "active",
"cat": "Intrínseca",
"element": "blood",
"rarity": "uncommon",
"mana": 12,
"cd": 7,
"level": 8,
"sp": 1,
"req": [],
"desc": "Suga o sangue do alvo por 3s, causando dano contínuo e recuperando parte como vida.",
"exec": {
"kind": "link",
"range": 5,
"sec": 3,
"power": 0.85,
"stat": "intelligence",
"heal": 0.5,
"snd": "mob.phantom.bite"
}
},
{
"id": "ogre_flame",
"name": "Chama Ogra",
"type": "active",
"cat": "Intrínseca",
"element": "fire",
"rarity": "rare",
"mana": 24,
"cd": 9,
"level": 18,
"sp": 2,
"req": [
"flame_breath"
],
"desc": "Chama primitiva de ogro que escala com Força: explode no alvo e o queima por 8s.",
"exec": {
"kind": "target_aoe",
"range": 16,
"radius": 3.5,
"power": 2.4,
"stat": "strength",
"burn": 8,
"snd": "mob.blaze.shoot"
}
},
{
"id": "steel_body",
"name": "Corpo de Aço",
"type": "active",
"cat": "Extra",
"element": "physical",
"rarity": "rare",
"mana": 20,
"cd": 25,
"level": 14,
"sp": 2,
"req": [],
"desc": "Endurece o corpo como aço por 15s: +10 Defesa, +20% res. física, +15% res. a projéteis e absorção.",
"exec": {
"kind": "buff",
"sec": 15,
"absorb": 3,
"buff": {
"id": "steel_body",
"stats": {
"defense": 10,
"res_physical": 20,
"res_projectile": 15
}
},
"snd": "item.shield.block"
}
},
{
"id": "thought_accel",
"name": "Aceleração de Pensamento",
"type": "active",
"cat": "Extra",
"element": "arcane",
"rarity": "epic",
"mana": 28,
"cd": 40,
"level": 26,
"sp": 3,
"req": [],
"desc": "Acelera o pensamento por 12s: +8 Int., +8 Agi., -20% de recarga e +60% de regeneração de mana.",
"exec": {
"kind": "buff",
"sec": 12,
"buff": {
"id": "thought_accel",
"stats": {
"intelligence": 8,
"agility": 8,
"cdr": 20,
"manaRegen": 60
}
},
"snd": "beacon.power_select"
}
},
{
"id": "universal_perception",
"name": "Percepção Universal",
"type": "active",
"cat": "Extra",
"element": "arcane",
"rarity": "epic",
"mana": 18,
"cd": 20,
"level": 24,
"sp": 3,
"req": [],
"desc": "Percepção total: detecta e marca toda criatura num raio de 40 blocos por 20s. Passivo: +6% de crítico.",
"exec": {
"kind": "sense",
"radius": 40,
"sec": 20,
"mark": true,
"snd": "beacon.activate"
},
"stats": {
"crit": 6
}
},
{
"id": "wind_blade",
"name": "Lâmina de Vento",
"type": "active",
"cat": "Extra",
"element": "wind",
"rarity": "uncommon",
"mana": 13,
"cd": 4,
"level": 9,
"sp": 1,
"req": [],
"desc": "Corte de vento comprimido que atravessa todos os inimigos em linha.",
"exec": {
"kind": "beam",
"range": 20,
"width": 1.5,
"power": 1.8,
"stat": "intelligence",
"pierce": true,
"snd": "mob.phantom.swoop"
}
},
{
"id": "disintegration",
"name": "Desintegração",
"type": "active",
"cat": "Extra",
"element": "void",
"rarity": "epic",
"mana": 40,
"cd": 14,
"level": 34,
"sp": 3,
"req": [],
"desc": "Esfera de desintegração: dilacera a matéria na área do alvo e a degenera por 8s.",
"exec": {
"kind": "target_aoe",
"range": 22,
"radius": 3.5,
"power": 3.5,
"stat": "intelligence",
"debuff": {
"id": "degenerate",
"sec": 8
},
"snd": "mob.wither.break_block"
}
},
{
"id": "blood_rain",
"name": "Chuva de Sangue",
"type": "active",
"cat": "Extra",
"element": "blood",
"rarity": "epic",
"mana": 46,
"cd": 22,
"level": 30,
"sp": 3,
"req": [
"blood_slash"
],
"desc": "Chuva rubra sobre a área: fere e faz sangrar os inimigos enquanto restaura aliados.",
"exec": {
"kind": "storm",
"range": 20,
"radius": 6,
"sec": 5,
"strikes": 10,
"power": 1.9,
"stat": "intelligence",
"debuff": {
"id": "bleed",
"sec": 5
},
"healAllies": 2,
"snd": "ambient.weather.rain"
}
},
{
"id": "haki",
"name": "Haki",
"type": "active",
"cat": "Extra",
"element": "void",
"rarity": "epic",
"mana": 32,
"cd": 30,
"level": 32,
"sp": 3,
"req": [
"beast_roar"
],
"desc": "Presença dominadora: aterroriza tudo num raio de 15 blocos por 10s e fortalece você por 12s.",
"exec": {
"kind": "wave",
"radius": 15,
"power": 0.25,
"stat": "strength",
"knock": 0,
"debuff": {
"id": "fear",
"sec": 10
},
"buffSelf": {
"id": "haki",
"sec": 12,
"stats": {
"strength": 6,
"defense": 4,
"crit": 8
}
},
"snd": "mob.enderdragon.growl"
}
},
{
"id": "dark_bolt",
"name": "Projétil Sombrio",
"type": "active",
"cat": "Magia",
"element": "shadow",
"rarity": "uncommon",
"mana": 14,
"cd": 3.5,
"level": 6,
"sp": 1,
"req": [
"dark_slash"
],
"desc": "Esfera de energia sombria que explode no alvo e o enfraquece por 4s.",
"exec": {
"kind": "projectile",
"range": 28,
"radius": 1.8,
"power": 1.7,
"stat": "intelligence",
"debuff": {
"id": "weak",
"sec": 4
},
"snd": "mob.wither.shoot"
}
},
{
"id": "holy_lance",
"name": "Lança Sagrada",
"type": "active",
"cat": "Magia",
"element": "light",
"rarity": "rare",
"mana": 24,
"cd": 6,
"level": 22,
"sp": 2,
"req": [
"energy_lance"
],
"desc": "Lança de luz que atravessa todos os inimigos em linha.",
"exec": {
"kind": "beam",
"range": 30,
"width": 1.1,
"power": 2.6,
"stat": "intelligence",
"pierce": true,
"snd": "mob.evocation_illager.cast_spell"
}
},
{
"id": "lion_roar_punch",
"name": "Soco do Leão Rugido",
"type": "active",
"cat": "Combate",
"element": "physical",
"rarity": "epic",
"mana": 22,
"cd": 9,
"level": 24,
"sp": 3,
"req": [
"impact"
],
"desc": "Soco com o rugido de um leão: arremessa e atordoa quem estiver à frente.",
"exec": {
"kind": "cone",
"range": 4,
"angle": 50,
"power": 3.0,
"stat": "strength",
"knock": 3.0,
"debuff": {
"id": "stun",
"sec": 2
},
"snd": "random.anvil_land"
}
},
{
"id": "summon_demons",
"name": "Invocar Demônios",
"type": "active",
"cat": "Invocação",
"element": "shadow",
"rarity": "epic",
"mana": 55,
"cd": 45,
"level": 36,
"sp": 4,
"req": [
"summon_guardian"
],
"desc": "Invoca 3 diabretes aliados por 45s. Eles atacam os monstros próximos e seguem você.",
"exec": {
"kind": "summon",
"sec": 45,
"entity": "etheria:imp",
"count": 3,
"cap": 3,
"name": "§cDiabrete",
"snd": "mob.evocation_illager.prepare_summon"
}
},
{
"id": "orc_army",
"name": "Exército Orc",
"type": "active",
"cat": "Invocação",
"element": "physical",
"rarity": "epic",
"mana": 70,
"cd": 60,
"level": 44,
"sp": 4,
"req": [
"summon_demons"
],
"desc": "Convoca 4 orcs aliados por 45s: um pequeno exército que luta ao seu lado.",
"exec": {
"kind": "summon",
"sec": 45,
"entity": "etheria:orc",
"count": 4,
"cap": 4,
"name": "§2Soldado Orc",
"snd": "mob.ravager.roar"
}
},
{
"id": "megiddo",
"name": "Megiddo",
"type": "active",
"cat": "Ultimate",
"element": "light",
"rarity": "mythic",
"mana": 120,
"cd": 60,
"level": 70,
"sp": 6,
"req": [
"holy_lance",
"holy_light"
],
"desc": "Raio sagrado supremo: um feixe colossal de luz que atravessa e incinera tudo à frente.",
"exec": {
"kind": "beam",
"range": 40,
"width": 2.6,
"power": 6.2,
"stat": "intelligence",
"pierce": true,
"burn": 6,
"snd": "beacon.power_select"
}
},
{
"id": "drago_nova",
"name": "Drago Nova",
"type": "active",
"cat": "Ultimate",
"element": "void",
"rarity": "mythic",
"mana": 100,
"cd": 55,
"level": 65,
"sp": 5,
"req": [
"dragon_breath"
],
"desc": "Nova dracônica: libera toda a energia do dragão numa explosão devastadora ao seu redor.",
"exec": {
"kind": "aoe_self",
"radius": 12,
"power": 5.0,
"stat": "intelligence",
"knock": 2.4,
"debuff": {
"id": "stun",
"sec": 2
},
"snd": "mob.enderdragon.growl"
}
},
{
"id": "storm_dragon",
"name": "Dragão da Tempestade",
"type": "active",
"cat": "Ultimate",
"element": "lightning",
"rarity": "mythic",
"mana": 90,
"cd": 45,
"level": 66,
"sp": 5,
"req": [
"thunder_breath",
"lightning"
],
"desc": "Um dragão de relâmpagos salta de alvo em alvo (até 8), paralisando cada um por 2s.",
"exec": {
"kind": "chain",
"range": 32,
"jumps": 8,
"jumpRange": 9,
"power": 4.4,
"stat": "intelligence",
"debuff": {
"id": "paralyze",
"sec": 2
},
"snd": "ambient.weather.thunder"
}
},
{
"id": "world_end",
"name": "Fim do Mundo",
"type": "active",
"cat": "Ultimate",
"element": "void",
"rarity": "mythic",
"mana": 140,
"cd": 120,
"level": 80,
"sp": 6,
"req": [
"death_storm"
],
"desc": "Uma esfera do vazio desaba do céu sobre a área marcada, puxando e aniquilando tudo (degeneração por 10s).",
"exec": {
"kind": "target_aoe",
"range": 30,
"radius": 12,
"power": 7.0,
"stat": "intelligence",
"pull": 1.5,
"debuff": {
"id": "degenerate",
"sec": 10
},
"snd": "mob.wither.spawn"
}
},
{
"id": "beelzebuth",
"name": "Beelzebuth, Senhor da Gula",
"type": "active",
"cat": "Ultimate",
"element": "shadow",
"rarity": "divine",
"mana": 45,
"cd": 8,
"level": 1,
"sp": 0,
"req": [],
"desc": "Evolução da Glutonaria. Devora até 8 alvos feridos (≤50% de vida) num raio de 10 blocos e absorve a energia deles.",
"exec": {
"kind": "devour",
"range": 12,
"aoe": 10,
"max": 8,
"power": 2.8,
"stat": "intelligence",
"threshold": 0.5,
"snd": "mob.enderman.teleport"
}
}
];

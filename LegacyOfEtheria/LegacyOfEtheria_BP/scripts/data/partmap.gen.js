// GERADO por tools/partports.py a partir das partículas dos mods de referência - não edite à mão.
// PART_FX: chave (elemento do addon OU id de habilidade) -> ids etheria:fx_* (ordem = importância; sem entrada própria a habilidade usa o elemento).
// PART_COL: chave -> nome de cor (PAL de systems/fxlib.js) para tingir as partículas que aceitam tinta.
// PART_INFO: id -> { k: tipo de colocação (flame flare bolt thunder spark thread cloud bubble glow wing fall ring slash burst column ground trail orb), c: 1 se aceita tinta }.
export const PART_FX = {
 "fire": [
  "etheria:fx_flame",
  "etheria:fx_is_dragon_fire",
  "etheria:fx_blue_flame",
  "etheria:fx_purple_flame",
  "etheria:fx_is_fiery_smoke",
  "etheria:fx_is_embers",
  "etheria:fx_is_blastwave"
 ],
 "ice": [
  "etheria:fx_is_snowflake",
  "etheria:fx_is_blastwave",
  "etheria:fx_is_bubble_pop",
  "etheria:fx_is_fog",
  "etheria:fx_is_zap"
 ],
 "lightning": [
  "etheria:fx_thunder_spark",
  "etheria:fx_white_lightning",
  "etheria:fx_is_electricity"
 ],
 "wind": [
  "etheria:fx_is_trace",
  "etheria:fx_is_shockwave",
  "etheria:fx_sakura",
  "etheria:fx_is_fog",
  "etheria:fx_is_ring_smoke"
 ],
 "water": [
  "etheria:fx_water_bubble",
  "etheria:fx_is_bubble_pop",
  "etheria:fx_is_blastwave",
  "etheria:fx_is_fog",
  "etheria:fx_is_trace"
 ],
 "earth": [
  "etheria:fx_is_zap",
  "etheria:fx_is_blastwave",
  "etheria:fx_is_fog",
  "etheria:fx_is_shockwave",
  "etheria:fx_is_ember_ash"
 ],
 "light": [
  "etheria:fx_white_flame",
  "etheria:fx_white_flare",
  "etheria:fx_yellow_spirit",
  "etheria:fx_is_cleanse",
  "etheria:fx_is_wisp",
  "etheria:fx_white_thunder",
  "etheria:fx_holy_smoke"
 ],
 "shadow": [
  "etheria:fx_black_flame",
  "etheria:fx_black_flare",
  "etheria:fx_judgement_smoke",
  "etheria:fx_bats",
  "etheria:fx_is_ender_slash",
  "etheria:fx_black_lightning"
 ],
 "void": [
  "etheria:fx_chaos_eater",
  "etheria:fx_death_lightning",
  "etheria:fx_deathshine",
  "etheria:fx_black_thunder",
  "etheria:fx_is_ring_smoke",
  "etheria:fx_is_fog"
 ],
 "heal": [
  "etheria:fx_yellow_spirit",
  "etheria:fx_is_cleanse",
  "etheria:fx_is_wisp",
  "etheria:fx_white_flame",
  "etheria:fx_is_firefly"
 ],
 "teleport": [
  "etheria:fx_deathshine",
  "etheria:fx_is_ender_slash",
  "etheria:fx_is_portal"
 ],
 "transform": [
  "etheria:fx_white_thunder",
  "etheria:fx_white_flare",
  "etheria:fx_is_blastwave",
  "etheria:fx_yellow_spirit",
  "etheria:fx_is_cleanse"
 ],
 "levelup": [
  "etheria:fx_yellow_spirit",
  "etheria:fx_white_flare",
  "etheria:fx_is_wisp",
  "etheria:fx_is_cleanse",
  "etheria:fx_sakura"
 ],
 "legendary": [
  "etheria:fx_white_flame",
  "etheria:fx_sun",
  "etheria:fx_yellow_spirit",
  "etheria:fx_is_wisp",
  "etheria:fx_is_ring_smoke"
 ],
 "blood": [
  "etheria:fx_is_blood",
  "etheria:fx_bats",
  "etheria:fx_chaos_eater",
  "etheria:fx_is_blood_ground",
  "etheria:fx_cleave"
 ],
 "arcane": [
  "etheria:fx_is_wisp",
  "etheria:fx_death_lightning",
  "etheria:fx_is_zap",
  "etheria:fx_is_blastwave",
  "etheria:fx_is_trace",
  "etheria:fx_is_portal"
 ],
 "physical": [
  "etheria:fx_is_shockwave",
  "etheria:fx_cleave",
  "etheria:fx_is_blastwave",
  "etheria:fx_is_trace",
  "etheria:fx_is_spark"
 ],
 "boss": [
  "etheria:fx_black_flare",
  "etheria:fx_black_flame",
  "etheria:fx_chaos_eater",
  "etheria:fx_bats",
  "etheria:fx_judgement_smoke"
 ],
 "predator": [
  "etheria:fx_chaos_eater",
  "etheria:fx_black_flame",
  "etheria:fx_bats"
 ],
 "gluttony": [
  "etheria:fx_chaos_eater",
  "etheria:fx_black_flare",
  "etheria:fx_bats",
  "etheria:fx_judgement_smoke"
 ],
 "beelzebuth": [
  "etheria:fx_chaos_eater",
  "etheria:fx_black_flare",
  "etheria:fx_black_flame",
  "etheria:fx_bats",
  "etheria:fx_deathshine"
 ],
 "starving": [
  "etheria:fx_chaos_eater",
  "etheria:fx_is_blood",
  "etheria:fx_black_flare"
 ],
 "fireball": [
  "etheria:fx_flame",
  "etheria:fx_is_embers",
  "etheria:fx_is_blastwave"
 ],
 "dragon_breath": [
  "etheria:fx_is_dragon_fire",
  "etheria:fx_flame",
  "etheria:fx_is_fiery_smoke",
  "etheria:fx_is_flame_strike"
 ],
 "fire_manip": [
  "etheria:fx_flame",
  "etheria:fx_blue_flame",
  "etheria:fx_purple_flame",
  "etheria:fx_is_embers"
 ],
 "hellflame": [
  "etheria:fx_purple_flame",
  "etheria:fx_black_flame",
  "etheria:fx_is_fiery_smoke",
  "etheria:fx_is_dragon_fire"
 ],
 "combustion": [
  "etheria:fx_flame",
  "etheria:fx_is_fiery_smoke",
  "etheria:fx_is_blastwave",
  "etheria:fx_is_embers"
 ],
 "flame_breath": [
  "etheria:fx_flame",
  "etheria:fx_is_dragon_fire",
  "etheria:fx_is_embers"
 ],
 "heat_sense": [
  "etheria:fx_flame",
  "etheria:fx_is_embers",
  "etheria:fx_is_firefly"
 ],
 "demon_flame": [
  "etheria:fx_purple_flame",
  "etheria:fx_black_flame",
  "etheria:fx_is_embers"
 ],
 "ogre_flame": [
  "etheria:fx_flame",
  "etheria:fx_purple_flame",
  "etheria:fx_is_embers"
 ],
 "drago_nova": [
  "etheria:fx_is_dragon_fire",
  "etheria:fx_black_flare",
  "etheria:fx_is_fiery_smoke",
  "etheria:fx_is_blastwave",
  "etheria:fx_is_flame_strike"
 ],
 "dragon_roar": [
  "etheria:fx_is_dragon_fire",
  "etheria:fx_is_fiery_smoke",
  "etheria:fx_is_shockwave"
 ],
 "black_flame": [
  "etheria:fx_black_flame",
  "etheria:fx_black_flare",
  "etheria:fx_purple_flame"
 ],
 "black_lightning": [
  "etheria:fx_black_lightning",
  "etheria:fx_death_lightning",
  "etheria:fx_black_thunder"
 ],
 "black_thunder": [
  "etheria:fx_black_thunder",
  "etheria:fx_black_lightning",
  "etheria:fx_black_flare"
 ],
 "death_storm": [
  "etheria:fx_death_lightning",
  "etheria:fx_deathshine",
  "etheria:fx_black_thunder",
  "etheria:fx_chaos_eater"
 ],
 "thunder_breath": [
  "etheria:fx_thunder_spark",
  "etheria:fx_white_thunder",
  "etheria:fx_is_electricity"
 ],
 "paralyzing_breath": [
  "etheria:fx_paralysis",
  "etheria:fx_thunder_spark",
  "etheria:fx_is_electricity"
 ],
 "storm_dragon": [
  "etheria:fx_white_thunder",
  "etheria:fx_thunder_spark",
  "etheria:fx_is_electricity",
  "etheria:fx_white_lightning"
 ],
 "noxious_breath": [
  "etheria:fx_poison",
  "etheria:fx_is_acid",
  "etheria:fx_is_acid_bubble",
  "etheria:fx_is_fog"
 ],
 "absorb_dissolve": [
  "etheria:fx_is_acid",
  "etheria:fx_is_acid_bubble",
  "etheria:fx_is_bubble_pop",
  "etheria:fx_is_fog"
 ],
 "thread_manip": [
  "etheria:fx_thread",
  "etheria:fx_is_trace"
 ],
 "puppeteer": [
  "etheria:fx_thread",
  "etheria:fx_judgement_smoke",
  "etheria:fx_is_trace"
 ],
 "molecular_manip": [
  "etheria:fx_thread",
  "etheria:fx_is_trace",
  "etheria:fx_white_lightning"
 ],
 "water_manip": [
  "etheria:fx_water_bubble",
  "etheria:fx_is_bubble_pop",
  "etheria:fx_is_blastwave"
 ],
 "water_blade": [
  "etheria:fx_water_bubble",
  "etheria:fx_is_trace",
  "etheria:fx_is_bubble_pop"
 ],
 "water_current": [
  "etheria:fx_water_bubble",
  "etheria:fx_is_fog",
  "etheria:fx_is_ring_smoke"
 ],
 "hydro_propulsion": [
  "etheria:fx_water_bubble",
  "etheria:fx_is_trace",
  "etheria:fx_is_blastwave"
 ],
 "water_surge": [
  "etheria:fx_water_bubble",
  "etheria:fx_is_bubble_pop",
  "etheria:fx_is_blastwave",
  "etheria:fx_is_fog"
 ],
 "ice_lance": [
  "etheria:fx_is_snowflake",
  "etheria:fx_is_blastwave",
  "etheria:fx_is_bubble_pop"
 ],
 "vampirism": [
  "etheria:fx_bats",
  "etheria:fx_is_blood",
  "etheria:fx_is_blood_ground"
 ],
 "blood_drain": [
  "etheria:fx_is_blood",
  "etheria:fx_bats",
  "etheria:fx_is_blood_ground"
 ],
 "blood_rain": [
  "etheria:fx_is_blood",
  "etheria:fx_is_blood_ground",
  "etheria:fx_bats"
 ],
 "blood_slash": [
  "etheria:fx_cleave",
  "etheria:fx_is_blood",
  "etheria:fx_is_blood_ground"
 ],
 "lust": [
  "etheria:fx_is_blood",
  "etheria:fx_is_wisp",
  "etheria:fx_bats"
 ],
 "holy_light": [
  "etheria:fx_white_flame",
  "etheria:fx_holy_smoke",
  "etheria:fx_yellow_spirit",
  "etheria:fx_is_cleanse"
 ],
 "holy_lance": [
  "etheria:fx_white_flare",
  "etheria:fx_white_thunder",
  "etheria:fx_yellow_spirit"
 ],
 "megiddo": [
  "etheria:fx_holy_smoke",
  "etheria:fx_white_flare",
  "etheria:fx_sun",
  "etheria:fx_white_thunder",
  "etheria:fx_yellow_spirit"
 ],
 "healer": [
  "etheria:fx_yellow_spirit",
  "etheria:fx_is_cleanse",
  "etheria:fx_is_wisp"
 ],
 "master_physician": [
  "etheria:fx_yellow_spirit",
  "etheria:fx_is_cleanse",
  "etheria:fx_is_wisp",
  "etheria:fx_is_firefly"
 ],
 "chosen_one": [
  "etheria:fx_white_flame",
  "etheria:fx_sun",
  "etheria:fx_white_thunder",
  "etheria:fx_yellow_spirit"
 ],
 "divine_shield": [
  "etheria:fx_is_ring_smoke",
  "etheria:fx_white_flame",
  "etheria:fx_is_wisp"
 ],
 "royal_decree": [
  "etheria:fx_is_soul_fire",
  "etheria:fx_white_flare",
  "etheria:fx_is_soulfire_ray"
 ],
 "dark_slash": [
  "etheria:fx_is_ender_slash",
  "etheria:fx_black_flame",
  "etheria:fx_cleave"
 ],
 "severer": [
  "etheria:fx_cleave",
  "etheria:fx_is_trace",
  "etheria:fx_is_ender_slash"
 ],
 "dark_attacker": [
  "etheria:fx_is_ender_slash",
  "etheria:fx_bats",
  "etheria:fx_cleave"
 ],
 "shadow_step": [
  "etheria:fx_is_ender_slash",
  "etheria:fx_judgement_smoke",
  "etheria:fx_deathshine"
 ],
 "soul_drain": [
  "etheria:fx_chaos_eater",
  "etheria:fx_judgement_smoke",
  "etheria:fx_is_soul_fire"
 ],
 "dark_bolt": [
  "etheria:fx_black_lightning",
  "etheria:fx_black_flame",
  "etheria:fx_is_ender_slash"
 ],
 "degenerate": [
  "etheria:fx_death_lightning",
  "etheria:fx_chaos_eater",
  "etheria:fx_deathshine"
 ],
 "gravity_manip": [
  "etheria:fx_is_ring_smoke",
  "etheria:fx_is_blastwave",
  "etheria:fx_death_lightning",
  "etheria:fx_chaos_eater"
 ],
 "wind_blade": [
  "etheria:fx_cleave",
  "etheria:fx_is_trace",
  "etheria:fx_sakura"
 ],
 "wind_dash": [
  "etheria:fx_is_trace",
  "etheria:fx_is_shockwave",
  "etheria:fx_is_fog"
 ],
 "ultrasonic": [
  "etheria:fx_is_shockwave",
  "etheria:fx_is_ring_smoke",
  "etheria:fx_is_blastwave"
 ],
 "space_travel": [
  "etheria:fx_deathshine",
  "etheria:fx_is_portal",
  "etheria:fx_is_ender_slash",
  "etheria:fx_is_firefly"
 ],
 "traveler": [
  "etheria:fx_deathshine",
  "etheria:fx_is_portal",
  "etheria:fx_sakura"
 ],
 "summon_guardian": [
  "etheria:fx_is_soul_fire",
  "etheria:fx_is_soulfire_ray",
  "etheria:fx_is_wisp"
 ],
 "summon_demons": [
  "etheria:fx_purple_flame",
  "etheria:fx_black_flame",
  "etheria:fx_chaos_eater",
  "etheria:fx_is_soul_fire"
 ],
 "orc_army": [
  "etheria:fx_is_soul_fire",
  "etheria:fx_is_soulfire_ray",
  "etheria:fx_is_embers"
 ],
 "world_end": [
  "etheria:fx_death_lightning",
  "etheria:fx_deathshine",
  "etheria:fx_black_thunder",
  "etheria:fx_sun"
 ],
 "haki": [
  "etheria:fx_white_thunder",
  "etheria:fx_is_shockwave",
  "etheria:fx_is_blastwave",
  "etheria:fx_death_lightning"
 ]
};
export const PART_COL = {"fire": "fire", "ice": "ice", "lightning": "bolt", "wind": "wind", "water": "water", "earth": "earth", "light": "holy", "shadow": "violet", "void": "void", "heal": "green", "teleport": "violet", "transform": "gold", "levelup": "gold", "legendary": "gold", "blood": "blood", "arcane": "arcane", "physical": "steel", "boss": "violet"};
export const PART_INFO = {"etheria:fx_flame": {"k": "flame", "c": 0}, "etheria:fx_blue_flame": {"k": "flame", "c": 0}, "etheria:fx_purple_flame": {"k": "flame", "c": 0}, "etheria:fx_black_flame": {"k": "flame", "c": 0}, "etheria:fx_white_flame": {"k": "flame", "c": 1}, "etheria:fx_black_flare": {"k": "flare", "c": 0}, "etheria:fx_white_flare": {"k": "flare", "c": 1}, "etheria:fx_black_lightning": {"k": "bolt", "c": 0}, "etheria:fx_white_lightning": {"k": "bolt", "c": 1}, "etheria:fx_black_thunder": {"k": "thunder", "c": 0}, "etheria:fx_white_thunder": {"k": "thunder", "c": 1}, "etheria:fx_thunder_spark": {"k": "spark", "c": 0}, "etheria:fx_thread": {"k": "thread", "c": 1}, "etheria:fx_poison": {"k": "cloud", "c": 0}, "etheria:fx_paralysis": {"k": "cloud", "c": 0}, "etheria:fx_water_bubble": {"k": "bubble", "c": 0}, "etheria:fx_chaos_eater": {"k": "flame", "c": 0}, "etheria:fx_yellow_spirit": {"k": "glow", "c": 0}, "etheria:fx_bats": {"k": "wing", "c": 0}, "etheria:fx_charybdis_scales": {"k": "fall", "c": 0}, "etheria:fx_sakura": {"k": "fall", "c": 0}, "etheria:fx_deathshine": {"k": "column", "c": 0}, "etheria:fx_death_lightning": {"k": "bolt", "c": 0}, "etheria:fx_judgement_smoke": {"k": "cloud", "c": 1}, "etheria:fx_holy_smoke": {"k": "cloud", "c": 1}, "etheria:fx_sun": {"k": "orb", "c": 0}, "etheria:fx_cleave": {"k": "slash", "c": 1}, "etheria:fx_is_fire": {"k": "flame", "c": 0}, "etheria:fx_is_dragon_fire": {"k": "flame", "c": 0}, "etheria:fx_is_embers": {"k": "flame", "c": 0}, "etheria:fx_is_soul_fire": {"k": "flame", "c": 0}, "etheria:fx_is_fiery_smoke": {"k": "cloud", "c": 0}, "etheria:fx_is_flame_strike": {"k": "slash", "c": 0}, "etheria:fx_is_ender_slash": {"k": "slash", "c": 0}, "etheria:fx_is_electricity": {"k": "bolt", "c": 0}, "etheria:fx_is_blastwave": {"k": "ring", "c": 1}, "etheria:fx_is_shockwave": {"k": "ring", "c": 1}, "etheria:fx_is_ring_smoke": {"k": "ring", "c": 1}, "etheria:fx_is_trailed_shockwave": {"k": "ring", "c": 1}, "etheria:fx_is_snowflake": {"k": "fall", "c": 1}, "etheria:fx_is_fog": {"k": "cloud", "c": 1}, "etheria:fx_is_acid": {"k": "bubble", "c": 1}, "etheria:fx_is_acid_bubble": {"k": "bubble", "c": 0}, "etheria:fx_is_bubble_pop": {"k": "bubble", "c": 1}, "etheria:fx_is_blood": {"k": "burst", "c": 0}, "etheria:fx_is_blood_ground": {"k": "ground", "c": 0}, "etheria:fx_is_cleanse": {"k": "glow", "c": 0}, "etheria:fx_is_wisp": {"k": "glow", "c": 0}, "etheria:fx_is_firefly": {"k": "glow", "c": 0}, "etheria:fx_is_trace": {"k": "trail", "c": 1}, "etheria:fx_is_soulfire_ray": {"k": "trail", "c": 0}, "etheria:fx_is_zap": {"k": "spark", "c": 1}, "etheria:fx_is_spark": {"k": "spark", "c": 1}, "etheria:fx_is_ember_ash": {"k": "spark", "c": 1}, "etheria:fx_is_portal": {"k": "spark", "c": 1}};

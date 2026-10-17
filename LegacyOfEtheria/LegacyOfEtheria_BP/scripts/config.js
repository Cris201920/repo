// config.js - Constantes e balanceamento (edite aqui, sem mexer na lógica)
export const BUILD_PROFILE = "quality"; // o build troca para "performance" na versão leve
export const VERSION = "8.0.0";
export const PROP_KEY = "etheria:data";
export const WORLD_RANK_KEY = "etheria:ranking";
export const DATA_VERSION = 3;          // v3: hotbar de habilidades (loadout, instâncias, recargas salvas)

export const MAX_LEVEL = 100;
export const ATTR_POINTS_PER_LEVEL = 3;
export const SKILL_POINT_EVERY = 2;       // 1 ponto de habilidade a cada N níveis
export const SAVE_INTERVAL_TICKS = 100;   // salva só jogadores "sujos"
export const MASTER_TICK = 20;            // laço principal: HUD, regen, buffs (1x por segundo)
export const MENU_ITEM = "minecraft:clock";
export const ADMIN_TAG = "etheria_admin";
export const ALLY_TAG = "etheria_ally";
export const MAX_SLOTS = 9;               // máximo de habilidades equipadas (cada uma vira um item físico no inventário)
export const HOTBAR_SIZE = 9;             // slots da hotbar do Minecraft
export const INV_SIZE = 36;               // slots do inventário do jogador (0-8 hotbar, 9-35 mochila)
export const AUTO_EQUIP = 4;              // ao aprender, equipa sozinha até N habilidades (o resto fica desbloqueado; equipe pelo menu)

// ---------------------------------------------------------------- Hotbar de habilidades (itens)
export const SKILLBAR = {
  itemPrefix: "etheria:sk_",              // etheria:sk_<id da habilidade>
  cdPrefix: "etheria_cd_",                // categoria de recarga nativa (1 por habilidade) -> animação de recarga no slot
  sidKey: "etheria:sid",                  // propriedade dinâmica: id único da instância (anti-duplicação)
  sigKey: "etheria:sig",                  // propriedade dinâmica: assinatura do texto (lore) para só atualizar quando mudar
  syncTicks: 40,                          // varredura de conferência do inventário (2 s)
  pollTicks: 2,                           // detecção de troca de slot (não existe evento nativo)
  useDebounce: 3,                         // ticks mínimos entre dois usos do mesmo jogador
  noResourceCooldown: 30,                 // ticks entre avisos de "Recursos insuficientes."
  sageVoiceGap: 300,                      // ticks mínimos entre falas do Sábio por falta de recurso
  special: ["Única", "Ultimate", "Manas"],// categorias que anunciam o uso por padrão
  defaults: { announce: false, selectSound: true, selectInfo: true, blockInteract: true, strip: true, staged: true },
};

export const ATTRIBUTES = {
  strength:     { label: "Força" },
  defense:      { label: "Defesa" },
  intelligence: { label: "Inteligência" },
  agility:      { label: "Agilidade" },
  vitality:     { label: "Vitalidade" },
};
export const STAT_LABELS = {
  atk: "Ataque", strength: "Força", defense: "Defesa", intelligence: "Inteligência", agility: "Agilidade", vitality: "Vitalidade",
  crit: "Crítico %", critDmg: "Dano crítico %", lifesteal: "Roubo de vida %", manaRegen: "Regen. mana %", manaCost: "Custo de mana -%",
  cdr: "Recarga -%", hp: "Vida", mana: "Mana", stamina: "Stamina", xp: "XP %", coin: "Moedas %",
  fire: "Dano de fogo %", ice: "Dano de gelo %", lightning: "Dano de raio %", wind: "Dano de vento %", water: "Dano de água %", earth: "Dano de terra %",
  light: "Dano de luz %", void: "Dano do vazio %", shadow: "Dano sombrio %", blood: "Dano de sangue %", arcane: "Dano arcano %", physical: "Dano físico %",
  res_fire: "Res. fogo %", res_ice: "Res. gelo %", res_lightning: "Res. raio %", res_void: "Res. vazio %", res_magic: "Res. mágica %", res_physical: "Res. física %",
};
export const ELEMENTS = ["fire", "ice", "lightning", "wind", "water", "earth", "light", "void", "shadow", "blood", "arcane", "physical"];

// Raridades: mult = multiplicador de atributos; drop = multiplicador de chance de drop
export const RARITY = {
  common:    { name: "Comum",    color: "§f", mult: 1.0,  drop: 1.0 },
  uncommon:  { name: "Incomum",  color: "§a", mult: 1.15, drop: 0.7 },
  rare:      { name: "Raro",     color: "§9", mult: 1.35, drop: 0.45 },
  epic:      { name: "Épico",    color: "§5", mult: 1.6,  drop: 0.25 },
  legendary: { name: "Lendário", color: "§6", mult: 2.0,  drop: 0.1 },
  mythic:    { name: "Mítico",   color: "§c", mult: 2.6,  drop: 0.04 },
  divine:    { name: "Divino",   color: "§b", mult: 3.4,  drop: 0.01 },
};
export const STARTER_WEIGHT = { rare: 14, epic: 10, legendary: 3.5, mythic: 1.2 };
// 6.87: Únicas mais difíceis para quem NÃO tem a linha do Predador (Predador/Gula/Beelzebuth). Quem tem o Predador mantém as regras antigas.
//   mult: requisitos numéricos de descoberta (abates, análises, chefes, distância...) · levelAdd: nível extra · masteryAdd: +nível de maestria
//   starterChance: chance de nascer com uma Única · starterRare: peso das Únicas lendárias/míticas no sorteio inicial
export const UNIQUE_HARD = { mult: 3.0, levelAdd: 20, masteryAdd: 2, starterChance: 0.15, starterRare: { legendary: 0.25, mythic: 0.15 },
  predMult: 1.8, predLevelAdd: 8, predMasteryAdd: 1,          // 6.98: a linha do Predador também tem requisitos maiores (só que menos)
  capBase: 1, capPerLevels: 30, capPred: 1, cooldownMin: 90 };   // limite de Únicas por nível e espera entre descobertas // sorteio da Única inicial (usa a raridade existente)
export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "divine"];

// Combate (tudo balanceável aqui)
export const COMBAT = {
  melee_stamina: 2,           // custo de stamina por golpe
  exhausted_mult: 0.5,        // dano com stamina zerada
  base_crit: 5,               // % base
  base_crit_dmg: 150,         // % do dano
  def_k: 60,                  // reduction = def/(def+def_k)
  max_reduction: 0.75,
  mob_crit_chance: 0.05,
  boss_crit_chance: 0.10,
  mob_crit_mult: 0.5,         // dano extra no crítico recebido
  skill_base: 8,              // skill dmg = power*(skill_base + stat + level*skill_lvl)
  skill_lvl: 0.4,
  forge_bonus: 0.06,          // +6% de stats por nível de forja
  max_forge: 10,
};
export const REGEN = { mana_base: 2, mana_int: 0.15, stamina_base: 5, stamina_agi: 0.15, combat_pause_ticks: 100 };

// XP necessário para sair do nível `level` para o próximo
// 6.14: curva ~25% mais leve (antes 50*L^1.5 + 25*L) para subir de nível um pouco mais rápido
export function xpToNext(level) { return Math.floor(38 * Math.pow(level, 1.5) + 19 * level); }
// bônus global de XP por abate (mobs e bosses); somado ao bônus de stats (xpPct)
export const XP_RATE = 1.25;

export const DEFAULT_MOB_XP = 5;
export const VANILLA_MOB_XP = {
  "minecraft:zombie": 8, "minecraft:skeleton": 8, "minecraft:spider": 7, "minecraft:creeper": 10, "minecraft:enderman": 25,
  "minecraft:witch": 20, "minecraft:blaze": 20, "minecraft:wither_skeleton": 30, "minecraft:ender_dragon": 1500,
  "minecraft:wither": 1200, "minecraft:warden": 2000,
};

/** Cinemática de evolução em 3ª pessoa (câmera livre + controle bloqueado só durante a cena; jogador pode desligar em settings.cinematic) */
export const CINEMATIC = { enabled: true, camera: true, length: 1 };

export const SOUNDS = {
  levelup: "random.levelup", hit: "random.orb", crit: "random.anvil_land", cast: "mob.evocation_illager.cast_spell",
  heal: "random.levelup", error: "note.bass", ok: "random.orb", boss: "mob.enderdragon.growl", coins: "random.orb",
  teleport: "mob.endermen.portal", forge: "random.anvil_use", quest: "random.toast",
  evolve: "etheria.sage.ceremony.true_demon_lord", rare: "etheria.sage.tier.unique", learn: "etheria.sage.sfx.skill", open: "etheria.sage.sfx.open", fail: "etheria.sage.sfx.fail", mythic: "etheria.sage.tier.ultimate",
};

export const FX_LEVELS = ["extreme", "ultra", "high", "medium", "low", "off"];
export const FX_LABELS = { extreme: "EXTREMO (versão visual mais completa)", ultra: "Ultra (todos os detalhes)", high: "Alto (bonito)", medium: "Médio (menos partículas)", low: "Reduzido (simplificado)", off: "Desligado" };
export const DEFAULT_FX = BUILD_PROFILE === "performance" ? "low" : "high";

// ---------------------------------------------------------------- Sábio -> Grande Sábio -> Raphael -> Ciel
// Requisitos CONFIGURÁVEIS. Marcação: [CANÔNICO] vem da obra · [ADAPTAÇÃO] foi inventado para este addon (não é oficial).
export const SAGE_EVO = {
  // Sábio -> Grande Sábio  [ADAPTAÇÃO: na obra o Grande Sábio nasce da fusão de habilidades do Rimuru]
  gs:   { level: 20, analyses: 20, knowledge: 10, masteryTotal: 6, ach: 3 },
  // Grande Sábio -> Raphael  [CANÔNICO: evolução ocorre após a evolução do mestre (Demon Lord) · ADAPTAÇÃO: números e itens]
  raph: { level: 40, analyses: 80, knowledge: 30, masteryTotal: 20, coins: 1000, item: "etheria:void_fragment", n: 3, ach: 12, rare: 1 },
  // Raphael -> Ciel (Manas)  [CANÔNICO: consciência/ego surge do vínculo com o mestre · ADAPTAÇÃO: vínculo, despertar e chefes como requisito]
  ciel: { level: 70, analyses: 300, knowledge: 80, bond: 60, awakened: 1, bossKills: 5, ach: 25, legend: 1 },
};
// Aprendizado por uso: análises -> benefício [ADAPTAÇÃO]
export const SAGE_LEARN = [
  { at: 100, text: "Análise 25% mais rápida", speed: 0.75 },
  { at: 500, text: "Alcance de análise ampliado (24 blocos)", range: 24 },
  { at: 1000, text: "Análise avançada (ameaça e dano estimado)", adv: true },
];
export const SAGE_BASE = { analyzeTicks: 48, range: 16, mana: 8 };

// ---- Voo Livre (systems/flight.js). Tudo configurável aqui.
export const FLIGHT = {
  skill: "free_flight",
  tick: 1,              // período do controlador (ticks) — 6.58: 1 tick = voo suave
  holdJump: 8,          // ticks segurando "pular" para decolar (ou subir)
  riseAmp: 2,           // levitação ao subir (Bedrock: ~0,9 bloco/s por nível => nível 3 ~ 2,7 b/s)
  speedAmp: 0,          // efeito de velocidade enquanto voa (-1 = desligado); nunca rebaixa um efeito mais forte já ativo
  staminaPerSec: 0,     // custo opcional contínuo (0 = voo gratuito, padrão)
  safeTicks: 100,       // queda lenta após desligar/pousar (sem dano de queda)
  hoverBand: 0.03,      // tolerância vertical (blocos/tick) do controle de pairar (só no modo reserva por levitação)
  speed: 0.55,          // 6.58: velocidade de cruzeiro (blocos/tick, ~11 b/s); correndo: sprintSpeed (~18 b/s)
  sprintSpeed: 0.9,
  accel: 0.22,          // fração da velocidade máxima ganha por tick com entrada
  brake: 0.86,          // sem entrada: velocidade mantida por tick (freio suave)
  rise: 0.42,           // subir/descer (blocos/tick)
  hoverLift: 0.0098,    // pairar: anula a gravidade da queda lenta (0,01 × arrasto 0,98)
  inputMin: 0.012,      // menor "sobra" de velocidade reconhecida como entrada do jogador
  sneakMax: 80,         // ticks máximos de "descer" por toque em agachar (celular: agachar alternado não prende o voo)
  landTicks: 8,         // ticks no chão (descendo/parado) para pousar
  // Progressão: estágios de raça que concedem a habilidade (sem duplicar efeitos; só concede, nunca dá a todos)
  stages: ["demon_3a", "demon_3b", "demon_4", "dragonoid_3a", "dragonoid_3b", "angel_3", "angel_4", "angel_5", "angel_f3", "angel_f4", "angel_f5", "fall_3", "fall_4", "fall_5", "vampire_3", "slime_3a", "slime_3b"],
  trueDragonForm: true, // linhagem dracônica na Forma Verdadeira (ou Dracônica) também concede
};

// ---- Anti-Skill (systems/antiskill.js). Regras EXPLÍCITAS do que pode ser neutralizado.
export const ANTISKILL = {
  // habilidades (por raridade/categoria): anulável | parcialmente resistida | imune
  partialRarity: ["epic", "legendary"],          // dano x partialMul, sem efeitos secundários; mana x partialCost sob Selo
  immuneRarity: ["mythic", "divine"],
  immuneCat: ["Única"],                          // Habilidades Únicas/Supremas nunca são anuladas
  immuneIds: ["predator", "gluttony", "beelzebuth", "anti_skill", "chaos_king", "legend_resolve", "dragon_transform"],
  partialMul: 0.5, partialCost: 1.5,
  // Selo (contra jogadores): duração máxima, janela de imunidade depois (sem encadear) e campo do Yuuki
  sealSec: 6, sealImmuneSec: 10, fieldSec: 8,
  // efeitos nativos POSITIVOS que a Anti-Skill remove de alvos (anulável) ou remove em parte (chefes)
  positive: ["strength", "speed", "resistance", "regeneration", "absorption", "invisibility", "fire_resistance", "jump_boost", "haste", "night_vision", "health_boost"],
  positivePartial: ["strength", "speed", "regeneration", "absorption", "invisibility"],
  negative: ["poison", "wither", "weakness", "slowness", "nausea", "mining_fatigue", "blindness", "hunger"],   // anuláveis no usuário da aura
  rpgPartial: ["stun", "paralyze", "degenerate"],                                                          // debuffs do RPG: duram no máx. 1 s sob a aura
  immuneEntities: ["etheria:veldora", "etheria:velzard", "etheria:velgrynd", "etheria:veldanava", "etheria:chronoa", "etheria:milim_nava", "etheria:guy_crimson", "etheria:rimuru_senhor_demonio", "etheria:yuuki_kagurazaka"],
};

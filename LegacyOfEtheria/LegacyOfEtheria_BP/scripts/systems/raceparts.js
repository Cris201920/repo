// systems/raceparts.js - TRAÇOS RACIAIS NO CORPO (asas, chifres, cauda): sem item. O jogador "já nasce" com eles.
// O Behavior Pack sobrescreve minecraft:player com a propriedade "etheria:race" (enum, client_sync) e o Resource Pack desenha a geometria da raça
// só em 3ª pessoa / para os outros jogadores (tools/racepart.py). Aqui só definimos o valor da propriedade: a raça escolhida, ou "none".
// A raça NÃO é item: as asas/chifres/cauda fazem parte do modelo do personagem (propriedade etheria:race = raça atual, estágio incluso).
// Remove, uma vez por entrada, os itens "Traços Raciais" (etheria:race_parts_*) que versões anteriores entregavam.
import { isLordStage } from "../data/races.js";
import { EquipmentSlot, world, system } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { inventory } from "../core/utils.js";
import { RACE_LOOK, STAGE_LOOK } from "../data/racecard.js";
import { lineageOf, formOfPlayer } from "../data/lineages.js";
import { RACE_LOOK as TENSURA_LOOK } from "../data/tensura/racelook_tensura.js";

export const RACE_PROP = "etheria:race";
export const LIN_PROP = "etheria:lin", LFORM_PROP = "etheria:lform";   // linhagem dracônica e forma (enum client_sync)
const LEGACY_PREFIX = "etheria:race_parts_";   // itens de traços das versões antigas (6.6.0): só são removidos
function hasItem(c, id) { for (let i = 0; i < c.size; i++) { try { if (c.getItem(i)?.typeId === id) return true; } catch { /* ignore */ } } return false; }

/** Valor da propriedade para uma raça: o próprio id se a raça tem traços, senão "none". */
export const lookOf = (race, stage) => { const k = STAGE_LOOK[stage] ?? race; return Object.prototype.hasOwnProperty.call(RACE_LOOK, k) ? k : "none"; };

let warned = false;
// ---------------------------------------------------------------- aparência por raça e ESTÁGIO (todos os estágios, sem aproximação por raça-base)
// Traços do Tensura (asas, chifres, cauda, orelhas, halo, corpo, aura): propriedades tensura:* desenhadas no corpo (tools/tensura_race.py).
// Cada estágio aponta para uma entrada da tabela do Tensura (data/tensura/racelook_tensura.js) OU para um objeto próprio {wings, horns, tail, ears, halo, aura, body}.
// Querubim, Serafim e Senhor Caído têm 4/6 asas: usam o corpo multi-asa do Etheria (propriedade etheria:race), que o Tensura não possui.
const TPARTS = ["wings", "horns", "tail", "ears", "halo", "aura", "body"];
export const STAGE_LOOK_MAP = {
  // humano
  human_1: "human", human_2a: "enlightened_human", human_2b: "enlightened_human", human_3a: "divine_fighter", human_3b: "human_saint",
  // slime
  slime_1: "slime", slime_2: "demon_slime", slime_3a: "god_slime", slime_3b: { halo: 2, aura: 4 },
  // goblin
  goblin_1: "goblin", goblin_2a: "goblin", goblin_2b: "goblin", goblin_3a: "hobgoblin", goblin_3b: "enlightened_hobgoblin", goblin_4: "hobgoblin_saint",
  // demônio (Lord Demônio = Devil Lord: corpo, asas rasgadas, chifres curvos, cauda, aura e halo sombrio)
  demon_1: "lesser_daemon", demon_2a: "greater_daemon", demon_2b: "greater_daemon", demon_3a: "arch_daemon", demon_3b: "daemon_lord", demon_4: "devil_lord",
  // elfo
  elf_1: "elf", elf_2a: "elf", elf_2b: "enlightened_elf", elf_3a: "elf_saint", elf_3b: "divine_elf",
  // anjo (1-3 Tensura; 4-5 corpo multi-asa do Etheria) e caídos
  angel_1: "angel", angel_2: "angel_guardian", angel_3: "archangel", angel_4: {}, angel_5: {},
  angel_f1: "fallen_angel", angel_f2: "fallen_angel", angel_f3: "fallen_angel", angel_f4: {}, angel_f5: {},
  fall_2: "fallen_angel", fall_3: "fallen_angel", fall_4: {}, fall_5: {},
  // dragonoide: corpo próprio (kit corporal 3 = escamas) desde o 1º estágio
  dragonoid_1: { body: 3, tail: 3, horns: 6 }, dragonoid_2a: "dragonewt", dragonoid_2b: "dragonewt", dragonoid_3a: "true_dragonewt", dragonoid_3b: "divine_dragon",
  // bestial
  beastkin_1: "beastfolk", beastkin_2a: "okami", beastkin_2b: "beastfolk", beastkin_3a: "beast_lord", beastkin_3b: "spirit_beast",
  // morto-vivo (sem entrada no Tensura: aura de trevas/almas e halo sombrio nos superiores)
  undead_1: {}, undead_2a: { aura: 1 }, undead_2b: { aura: 7 }, undead_3a: { aura: 1, halo: 4 }, undead_3b: { aura: 7, halo: 4 },
  // ogro, lagarto, vampiro, anão
  ogre_1: "ogre", ogre_2: "mystic_oni", ogre_3: "kijin",
  lizard_1: "lizardman", lizard_2: "lizardman", lizard_3: "dragonewt",
  vampire_1: "vampire", vampire_2: "vampire_lord", vampire_3: "divine_vampire",
  dwarf_1: "dwarf", dwarf_2: "enlightened_dwarf", dwarf_3: "dwarf_saint",
};
// estágios cujo corpo vem do Etheria (etheria:race): 4 e 6 asas
export const ETHERIA_BODY = { angel_4: "angel_cherub", angel_5: "angel_seraph", angel_f4: "fallen_lord", angel_f5: "fallen_lord", fall_4: "fallen_lord", fall_5: "fallen_lord" };
/** Traços {parte: valor} de um estágio (vazio se não houver). */
const mapKey = (id) => (Object.prototype.hasOwnProperty.call(STAGE_LOOK_MAP, id) ? id : (isLordStage(id) ? "demon_4" : id));   // Lord Demônio de qualquer raça (<estágio>_ld) usa a aparência de Lord Demônio
export function lookOfStage(stage) {
  const e = STAGE_LOOK_MAP[mapKey(stage)];
  if (e && typeof e === "object") return e;
  return (e && TENSURA_LOOK[e]) || {};
}
let warnedT = false;
/** Define as partes do Tensura para o estágio atual. Com linhagem dracônica ativa, o corpo é o da linhagem: todas ficam em 0 (Dragonoide em linhagem usa só o kit corporal de escamas). */
function applyTensuraLook(player, d, lineageActive) {
  let look = lineageActive ? (d.race === "dragonoid" ? { body: 3 } : {}) : lookOfStage(d.raceStage);
  if (!lineageActive && !Object.prototype.hasOwnProperty.call(STAGE_LOOK_MAP, mapKey(d.raceStage))) look = {};
  for (const part of TPARTS) {
    const v = look[part] ?? 0;
    try { if (player.getProperty(`tensura:${part}`) !== v) player.setProperty(`tensura:${part}`, v); }
    catch (e) { if (!warnedT) { warnedT = true; console.warn(`[Etheria] propriedade tensura:${part} indisponível: ${e}`); } }
  }
  return look;
}

/** Aplica a aparência da raça atual do jogador (no corpo, pelas propriedades). Com announce, avisa (pt-BR) quando a raça tem traços. Devolve os traços aplicados ou null se falhou. */
export function applyRaceLook(player, announce = false) {
  let d; try { d = getData(player); } catch { return null; }
  const body = d.raceChosen ? (ETHERIA_BODY[d.raceStage] ?? "none") : "none";   // 4/6 asas: corpo multi-asa do Etheria; senão "none"
  try {
    if (player.getProperty(RACE_PROP) !== body) player.setProperty(RACE_PROP, body);
  } catch (e) {
    if (!warned) { warned = true; console.warn(`[Etheria] propriedade ${RACE_PROP} indisponível (player.json do BP não carregou?): ${e}`); }
    return null;
  }
  let lineageActive = false;
  try {   // linhagem dracônica: com linhagem escolhida o corpo usa o conjunto da linhagem (e o do Dragonoide comum fica oculto)
    const L = d.raceChosen ? lineageOf(d) : null, lin = L ? L.id : "none", lf = L ? formOfPlayer(d) : "base";
    lineageActive = !!L;
    if (player.getProperty(LIN_PROP) !== lin) player.setProperty(LIN_PROP, lin);
    if (player.getProperty(LFORM_PROP) !== lf) player.setProperty(LFORM_PROP, lf);
  } catch { /* propriedades de linhagem indisponíveis */ }
  let look = null;
  try { look = d.raceChosen ? applyTensuraLook(player, d, lineageActive) : applyTensuraLook(player, { raceStage: null, race: null }, false); } catch { /* ignore */ }
  if (announce && d.raceChosen && (body !== "none" || (look && Object.keys(look).length))) {
    try { player.sendMessage(`§b[Grande Sábio] §fSeus traços raciais fazem parte do seu corpo e aparecem em 3ª pessoa.`); } catch { /* ignore */ }
  }
  return look;
}

/** Remove do inventário e dos slots de equipamento os itens antigos "Traços Raciais" (não são mais usados). Não toca em nenhum outro item. Devolve quantos removeu. */
export function cleanLegacyRaceItems(player) {
  let n = 0;
  const c = inventory(player);
  if (c) for (let i = 0; i < c.size; i++) {
    try { const it = c.getItem(i); if (it && typeof it.typeId === "string" && it.typeId.startsWith(LEGACY_PREFIX)) { c.setItem(i, undefined); n++; } } catch { /* ignore */ }
  }
  let eq; try { eq = player.getComponent("minecraft:equippable"); } catch { eq = undefined; }
  if (eq) for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand]) {
    try { const it = eq.getEquipment(slot); if (it && it.typeId.startsWith(LEGACY_PREFIX)) { eq.setEquipment(slot, undefined); n++; } } catch { /* ignore */ }
  }
  try { const d = getData(player); if (d.racePartsGiven !== undefined) { delete d.racePartsGiven; markDirty(player); } } catch { /* ignore */ }
  if (n > 0) { try { player.sendMessage("§b[Grande Sábio] §7Item de traços de outra raça removido."); } catch { /* ignore */ } }
  return n;
}

// ---------------------------------------------------------------- Anjo: Asas Sagradas (planar)
// Sem API de voo no Bedrock: o planar usa "slow_falling" (cai devagar e sem dano de queda), renovado enquanto o anjo cai no ar sem estar agachado.
export function startAngelGlide() {
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        const d = getData(p); if (d.race !== "angel" || !d.raceChosen) continue;
        if (p.isOnGround || p.isSneaking || p.isInWater || p.isGliding) continue;
        if (p.getVelocity().y < -0.35) p.addEffect("slow_falling", 40, { amplifier: 0, showParticles: false });
      } catch { /* ignore */ }
    }
  }, 5);
}

// ---------------------------------------------------------------- transformação visível em 3ª pessoa (animação da raça, todos os jogadores veem)
// etheria:tfx: "evo" (evolução de raça), "lord" (Lord Demônio), "dragon" (Forma Dracônica), "true" (Forma Verdadeira). Fica ativa ~3,3 s; o cliente toca a animação correspondente.
export const TFX_PROP = "etheria:tfx";
export function playTransform(player, kind, ms = 3300) {
  if (!player || !["evo", "lord", "dragon", "true"].includes(kind)) return;
  try { player.setProperty(TFX_PROP, "none"); } catch { return; }      // reinicia a animação mesmo se repetida
  system.runTimeout(() => { try { if (player.isValid) player.setProperty(TFX_PROP, kind); } catch { /* ignore */ } }, 2);
  system.runTimeout(() => { try { if (player.isValid) player.setProperty(TFX_PROP, "none"); } catch { /* ignore */ } }, 2 + Math.round(ms / 50));
}

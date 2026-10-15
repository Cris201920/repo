// data/lineages.js - LINHAGENS DRACÔNICAS (100% em dados). Para criar uma nova linhagem basta adicionar uma entrada em LINEAGES:
//   1) skills da árvore em data/skills.js;  2) o visual em tools/racepart.py (LINEAGE_PARTS, mesmo id);  3) o id em RACE_LINEAGE_LOOKS abaixo não é preciso: o enum é gerado do mesmo id.
// Cada tier: { lvl: nível mínimo, depth: profundidade mínima do estágio da raça (1..3), skill: id } -> concedida automaticamente por systems/lineage.js.
// Formas (FORMS): "base" = Dragonoide (traços da raça), "draconic" = Forma Dracônica, "true" = Dragão Verdadeiro (ver LINEAGE_FORMS).
import { RACES } from "./races.js";

export const LINEAGE_RACE = "dragonoid";

export const LINEAGE_FORMS = {
  base:     { name: "Dragonoide",         lvl: 1,  depth: 1, drain: 0,  fx: 1, effects: [] },
  draconic: { name: "Forma Dracônica",    lvl: 50, depth: 3, drain: 3,  fx: 2, mult: 1, cool: 20 },
  true:     { name: "Dragão Verdadeiro",  lvl: 90, depth: 3, drain: 6,  fx: 3, mult: 2, cool: 60 },
};

export const LINEAGES = {
  veldora: {
    id: "veldora", name: "Veldora", title: "Dragão da Tempestade", color: "§b", element: "lightning", fxKey: "lightning", fx2: "wind",
    concept: "Tempestade, vento e trovão", difficulty: 2,
    desc: "A linhagem do Dragão da Tempestade: energia dracônica bruta, raios e ventos de grande área. Um poder direto, ruidoso e difícil de conter.",
    pros: "Ataques elétricos e de vento em grande área; resistência elemental.", cons: "Pouca defesa física; consome muita mana nas habilidades de área.",
    unlock: { lvl: 1 },
    attrs: { strength: 1, defense: 0, intelligence: 2, agility: 2, vitality: 1 }, stats: { mana: 10, res_lightning: 10 },
    effects: { draconic: [["speed", 0], ["strength", 0]], true: [["speed", 1], ["strength", 1], ["resistance", 0]] },
    tiers: [
      { lvl: 1,  depth: 1, skill: "storm_scales" },
      { lvl: 20, depth: 2, skill: "windlash" },
      { lvl: 40, depth: 2, skill: "thunder_roar" },
      { lvl: 65, depth: 3, skill: "tempest_aura" },
      { lvl: 90, depth: 3, skill: "draconic_tempest" },
      // 6.28.0 - etapas posteriores (poder do Dragão da Tempestade): exigem também chefes derrotados (campo `bosses`), não só nível.
      { lvl: 45, depth: 2, bosses: 3,  skill: "black_lightning", stage: "Veldora Tempest" },
      { lvl: 55, depth: 3, bosses: 6,  skill: "storm_wall",      stage: "Veldora Tempest" },
      { lvl: 75, depth: 3, bosses: 15, skill: "black_thunder",   stage: "Veldora Tempest" },
      { lvl: 95, depth: 3, bosses: 30, skill: "chaos_king",      stage: "Rei do Caos (Chaos King)" },
    ],
    mob: "etheria:veldora",
  },
  velzard: {
    id: "velzard", name: "Velzard", title: "Dragão do Gelo", color: "§3", element: "ice", fxKey: "ice", fx2: "ice",
    concept: "Gelo, frio extremo e controle de temperatura", difficulty: 3,
    desc: "A linhagem do Dragão de Gelo: congelamento, controle de temperatura e uma aura gélida. Estilo de controle: imobiliza antes de destruir.",
    pros: "Controle de grupos (lentidão e congelamento); alta resistência ao gelo e ao fogo.", cons: "Dano bruto menor; habilidades de alto custo de mana.",
    unlock: { lvl: 1 },
    attrs: { strength: 0, defense: 2, intelligence: 3, agility: 0, vitality: 1 }, stats: { mana: 15, res_ice: 15 },
    effects: { draconic: [["resistance", 0], ["speed", 0]], true: [["resistance", 1], ["speed", 0], ["regeneration", 0]] },
    tiers: [
      { lvl: 1,  depth: 1, skill: "frost_scales" },
      { lvl: 20, depth: 2, skill: "frost_breath" },
      { lvl: 40, depth: 2, skill: "absolute_freeze" },
      { lvl: 65, depth: 3, skill: "temperature_control" },
      { lvl: 90, depth: 3, skill: "glacial_domain" },
    ],
    mob: "etheria:velzard",
  },
  velgrynd: {
    id: "velgrynd", name: "Velgrynd", title: "Dragão do Fogo", color: "§c", element: "fire", fxKey: "fire", fx2: "fire",
    concept: "Fogo, calor, energia e velocidade", difficulty: 3,
    desc: "A linhagem do Dragão de Fogo: ataques flamejantes, velocidade e mobilidade elevadas. Estilo agressivo: investe, queima e recua.",
    pros: "Mobilidade e dano de fogo altos; resistência ao fogo.", cons: "Vida menor que as outras linhagens; vulnerável ao gelo.",
    unlock: { lvl: 1 },
    attrs: { strength: 2, defense: 0, intelligence: 1, agility: 2, vitality: 0 }, stats: { res_fire: 15, res_ice: -10 },
    effects: { draconic: [["speed", 1], ["strength", 0]], true: [["speed", 1], ["strength", 1], ["fire_resistance", 0]] },
    tiers: [
      { lvl: 1,  depth: 1, skill: "ember_scales" },
      { lvl: 20, depth: 2, skill: "flame_dash" },
      { lvl: 40, depth: 2, skill: "inferno_breath" },
      { lvl: 65, depth: 3, skill: "crimson_heat" },
      { lvl: 90, depth: 3, skill: "dragon_inferno" },
    ],
    mob: "etheria:velgrynd",
  },
  veldanava: {
    id: "veldanava", name: "Veldanava", title: "Dragão Primordial", color: "§e", element: "light", fxKey: "light", fx2: "light",
    concept: "Criação, energia divina e autoridade", difficulty: 5,
    desc: "A linhagem do primeiro Dragão Verdadeiro: poder primordial, luz da criação e autoridade. Versátil, mas só revela o verdadeiro potencial a quem trilha toda a progressão.",
    pros: "Habilidades versáteis (cura, barreira e dano divino); bônus de XP.", cons: "Exige nível 80, Dragonoide evoluído e 5 chefes derrotados; começa fraca e cresce devagar.",
    unlock: { lvl: 80, depth: 3, bosses: 5 },
    attrs: { strength: 1, defense: 1, intelligence: 1, agility: 1, vitality: 1 }, stats: {},
    effects: { draconic: [["resistance", 0], ["regeneration", 0]], true: [["resistance", 1], ["regeneration", 1], ["strength", 1]] },
    tiers: [
      { lvl: 80,  depth: 3, skill: "divine_scales" },
      { lvl: 85,  depth: 3, skill: "creation_light" },
      { lvl: 90,  depth: 3, skill: "primordial_authority" },
      { lvl: 95,  depth: 3, skill: "primordial_energy" },
      { lvl: 100, depth: 3, skill: "genesis_ray" },
    ],
    mob: "etheria:veldanava",
  },
};
export const LINEAGE_LIST = Object.values(LINEAGES);
export const LINEAGE_ID_ENUM = LINEAGE_LIST.map((l) => l.id);   // espelho do enum etheria:lin (tools/racepart.py LINEAGE_PARTS)

/** profundidade do estágio da raça (1 = inicial) */
export function raceDepth(d) {
  const r = RACES[d.race]; if (!r) return 0;
  let n = 1, c = r.stages[d.raceStage]; while (c && c.from) { n++; c = r.stages[c.from]; } return n;
}
export const bossTotal = (d) => Object.values(d.bossKills ?? {}).reduce((a, b) => a + b, 0);

/** null se a linhagem pode ser escolhida; senão o motivo */
export function lineageLock(d, L) {
  if (d.race !== LINEAGE_RACE || !d.raceChosen) return "Só para a raça Dragonoide";
  const u = L.unlock ?? {};
  if (u.lvl && d.level < u.lvl) return `Requer nível ${u.lvl}`;
  if (u.depth && raceDepth(d) < u.depth) return `Requer evolução avançada da raça (estágio ${u.depth})`;
  if (u.bosses && bossTotal(d) < u.bosses) return `Requer ${u.bosses} chefes derrotados (${bossTotal(d)})`;
  return null;
}
/** tiers ainda não liberados / liberados do jogador */
export function tierState(d, L) {
  const depth = raceDepth(d);
  return L.tiers.map((t) => ({ ...t, ok: d.level >= t.lvl && depth >= t.depth && (!t.bosses || bossTotal(d) >= t.bosses) }));
}
export function formLock(d, L, form) {
  const f = LINEAGE_FORMS[form]; if (!f) return "Forma inválida";
  if (d.level < f.lvl) return `Requer nível ${f.lvl}`;
  if (raceDepth(d) < f.depth) return `Requer evolução avançada da raça (estágio ${f.depth})`;
  return null;
}

// Relações: reação de personagens/chefes à linhagem do jogador. chave = typeId; valor = { default, <lineageId>: frase, hostile?: true }.
// Para adicionar: nova entrada aqui (nenhum código novo).
export const RELATIONS = {
  "etheria:veldora":   { name: "Veldora", veldora: "§bVeldora: §fGwahaha! Sinto a minha tempestade em você, jovem da minha linhagem!", velzard: "§bVeldora: §fO gelo de minha irmã... Velzard escolheu bem seus herdeiros.", velgrynd: "§bVeldora: §fO calor de Velgrynd? Gwahaha, aquela megera!", veldanava: "§bVeldora: §fEssa aura... é do Ancestral! Respeito, filhote do primeiro de nós.", default: "§bVeldora: §fKufufu... uma criatura curiosa." },
  "etheria:velzard":   { name: "Velzard", velzard: "§3Velzard: §fSeu frio me é familiar. Sinto-me quase orgulhosa.", veldora: "§3Velzard: §fO cheiro de tempestade... aquele tolo do meu irmão.", velgrynd: "§3Velzard: §fFogo? Minha irmã mais velha ainda faz escola.", veldanava: "§3Velzard: §fVocê carrega a marca do Ancestral. Cuidado com esse poder.", default: "§3Velzard: §fPouco me interessa. Siga seu caminho." },
  "etheria:velgrynd":  { name: "Velgrynd", velgrynd: "§cVelgrynd: §fAh! Chama da minha chama! Mostre-me o que sabe fazer!", veldora: "§cVelgrynd: §fMais um do Veldora? Barulhento como o mestre.", velzard: "§cVelgrynd: §fGelo... Velzard anda recrutando.", veldanava: "§cVelgrynd: §fO poder do Ancestral... não o desperdice, pirralho.", default: "§cVelgrynd: §fDiverta-me ou saia da minha frente." },
  "etheria:veldanava": { name: "Veldanava", veldanava: "§eVeldanava: §fVocê carrega minha autoridade. Mostre que a merece.", default: "§eVeldanava: §fApenas os dignos ficam diante de mim." },
  "etheria:guy_crimson": { name: "Guy Crimson", veldora: "§cGuy: §fUm herdeiro da Tempestade? Hm. Interessante.", velzard: "§cGuy: §fHerdeiro do Gelo... Já vi mestres piores.", velgrynd: "§cGuy: §fFogo dracônico! Isso me diverte.", veldanava: "§cGuy: §fO sangue do Primordial. Finalmente algo digno da minha atenção.", default: "§cGuy: §fFraco demais para me interessar." },
  "etheria:rain": { name: "Rimuru", veldora: "§9Rimuru: §fVeldora! Olha, você tem a marca do meu amigo!", default: "§9Rimuru: §fOlá! Seja bem-vindo a Tempest." },
  "etheria:milim_nava": { name: "Milim", veldanava: "§dMilim: §fWoah! Você cheira ao velho Ancestral! Vamos lutar!", velgrynd: "§dMilim: §fFogo! Também gosto de fogo!", default: "§dMilim: §fUau, você parece forte! Luta comigo?" },
};

export const lineageOf = (d) => (d && d.race === LINEAGE_RACE && d.lineage ? LINEAGES[d.lineage] ?? null : null);
export const formOfPlayer = (d) => (lineageOf(d) && LINEAGE_FORMS[d.lform] ? d.lform : "base");
/** Bônus de stats da linhagem e da forma (usado por stats.js). */
export function lineageStats(d) {
  const L = lineageOf(d); if (!L) return null;
  const out = [L.attrs, L.stats], F = LINEAGE_FORMS[d.lform];
  if (F && F.mult) out.push({ strength: 6 * F.mult, defense: 6 * F.mult, vitality: 5 * F.mult, agility: 2 * F.mult, hp: 25 * F.mult });
  return out;
}

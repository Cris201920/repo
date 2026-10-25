// data/racepw.js - 9.9: PALETAS E FORMAS das asas de partículas e da aura de fumaça/luz das OUTRAS raças do jogador (mesmo esquema do
// Demônio/Caído e do Anjo da 9.8, que continuam em systems/particlewings.js e systems/power.js sem mudança).
// Usado por systems/particlewings.js (asas: etheria:wingfan_race + etheria:wingsmoke), systems/power.js (aura: etheria:aurasmoke) e
// systems/raceparts.js (PW_RACES: a asa do Tensura dessas raças fica desligada; quem desenha a asa são as partículas).
// Cores 0-1. line = cor das penas de dentro (base do degradê) · vein = cor das pontas (cresce para glint a cada estágio) · base = penas
// curtas da raiz (base) · glint = fagulhas/pólen/brasas · smoke = baforadas das asas (sa = opacidade).
// aura: smoke/a0..amax = fumaça/luz · vein = traço que sobe (vu/vv = tile do atlas 128x128: gotas, folhas, chamas, almas, morcegos, fagulhas)
// · ring = halo (estágios finais e Lorde; ry = altura, ru/rv = tile) · cK/hK/rK/szK = densidade/altura/subida/tamanho · swl = giro (graus/s).
// Sem dependências (pode ser importado por qualquer sistema e pelo simulador).

/** Raças do jogador com asas/aura de partículas próprias (Lorde Demônio de cada uma mantém a paleta da raça). */
export const PW_RACES = new Set(["human", "slime", "goblin", "elf", "dragonoid", "beastkin", "undead", "ogre", "lizardman", "vampire", "dwarf"]);

// formas do leque (somadas à tabela de estados do anjo: repouso alto/fechado, voo aberto, planeio largo, mergulho recolhido)
// dlo/dhi = desvio dos ângulos · nK = riscos · lenK = envergadura · wK = largura dos riscos · lp = penas longas (1) x curtas (0)
// cov = cobertura curta e grossa · blur = borrões largos (membrana/brilho) · fing/fj = "dedos" (n de dedos e espalhamento; 0 = leque contínuo)
// red = fração de penas da base · spk = fração de fagulhas nas baforadas · smk = baforadas · pairs = pares (2 = 4 lóbulos) · a = opacidade
export const PW_SHAPE = {
  dragon: { dlo: -12, dhi: 10, nK: 0.55, lenK: 1.28, wK: 1.6, lp: 0.85, cov: 0.03, blur: 0.16, fing: 5, fj: 0.22, red: 0.12, spk: 0.6, smk: 1.1, pairs: 1, a: 1, lag: 26 },
  bat: { dlo: -2, dhi: 16, nK: 0.6, lenK: 1.1, wK: 1.15, lp: 0.8, cov: 0.05, blur: 0.18, fing: 4, fj: 0.12, red: 0.26, spk: 0.25, smk: 1.0, pairs: 1, a: 1, lag: 30 },
  fairy: { dlo: 4, dhi: 8, nK: 0.7, lenK: 0.7, wK: 0.5, lp: 0.3, cov: 0, blur: 0.12, fing: 0, fj: 0, red: 0.05, spk: 0.7, smk: 0.7, pairs: 2, a: 0.85, lag: 44 },
  fan: { dlo: 0, dhi: 0, nK: 0.62, lenK: 0.92, wK: 0.95, lp: 0.66, cov: 0.16, blur: 0.08, fing: 0, fj: 0, red: 0.12, spk: 0.35, smk: 0.9, pairs: 1, a: 0.95, lag: 32 },
  aura: { dlo: 6, dhi: -4, nK: 0.36, lenK: 0.72, wK: 0.75, lp: 0.55, cov: 0.06, blur: 0.3, fing: 0, fj: 0, red: 0.08, spk: 0.3, smk: 0.45, pairs: 1, a: 0.6, lag: 32 },
};

const TILE = { spark: [16, 0], drop: [64, 0], ember: [32, 16], smoke: [16, 16], flame: [0, 16], bubble: [16, 32], skull: [48, 32], leaf: [112, 32], bat: [0, 48], orb: [48, 48], ring: [48, 0] };
const au = (o) => ({ cK: 1, hK: 1, rK: 1, szK: 1, swl: 45, ry: 2.1, vw: 0.07, vh: 0.09, vfrac: 0.2, ra: 0.8, ...o, vu: TILE[o.vt][0], vv: TILE[o.vt][1], ru: TILE[o.rt][0], rv: TILE[o.rt][1] });

export const RACE_PW = {
  // Humano: branco-azulado / prata, luz limpa; Lorde = "aura alada" discreta
  human: { name: "Humano", shape: "aura", line: [0.92, 0.95, 1.0], vein: [0.66, 0.76, 0.94], base: [0.78, 0.84, 0.95], glint: [1, 1, 1], smoke: [0.86, 0.9, 0.98], sa: 0.28,
    aura: au({ smoke: [0.85, 0.9, 1.0], a0: 0.2, amax: 0.4, vein: [0.95, 0.97, 1.0], vt: "spark", vfrac: 0.3, vw: 0.06, vh: 0.06, ring: [0.75, 0.85, 1.0], rt: "orb", cK: 0.85 }) },
  // Slime: azul-água / ciano translúcido, gotas e baforadas viscosas (sobem devagar, grandes)
  slime: { name: "Slime", shape: "aura", line: [0.35, 0.85, 0.95], vein: [0.2, 0.55, 0.95], base: [0.55, 0.95, 1.0], glint: [0.75, 1, 1], smoke: [0.3, 0.7, 0.95], sa: 0.45,
    aura: au({ smoke: [0.3, 0.72, 0.95], a0: 0.28, amax: 0.5, vein: [0.6, 0.95, 1.0], vt: "bubble", vfrac: 0.25, vw: 0.09, vh: 0.09, ring: [0.35, 0.8, 1.0], rt: "drop", rK: 0.55, szK: 1.25, swl: 25 }) },
  // Goblin: verde-musgo / oliva com marrom, poeira de terra
  goblin: { name: "Goblin", shape: "aura", line: [0.42, 0.5, 0.2], vein: [0.3, 0.44, 0.14], base: [0.42, 0.3, 0.16], glint: [0.7, 0.8, 0.35], smoke: [0.32, 0.3, 0.18], sa: 0.55,
    aura: au({ smoke: [0.3, 0.32, 0.16], a0: 0.3, amax: 0.55, vein: [0.6, 0.72, 0.25], vt: "ember", vw: 0.05, vh: 0.05, ring: [0.45, 0.33, 0.18], rt: "smoke", cK: 0.85 }) },
  // Elfo: esmeralda / verde-folha e branco-prata, pólen e folhas luminosas; asas leves de fada em 4 lóbulos
  elf: { name: "Elfo", shape: "fairy", line: [0.86, 1.0, 0.9], vein: [0.2, 0.85, 0.45], base: [0.88, 0.92, 0.98], glint: [0.85, 1.0, 0.55], smoke: [0.6, 0.95, 0.65], sa: 0.3,
    aura: au({ smoke: [0.45, 0.85, 0.55], a0: 0.2, amax: 0.42, vein: [0.75, 1.0, 0.5], vt: "leaf", vfrac: 0.3, vw: 0.09, vh: 0.09, ring: [0.9, 1.0, 0.85], rt: "spark", swl: 70 }) },
  // Dragonoide/Dragonato: laranja-brasa / ouro com vermelho, faíscas e fumaça de fogo; asas largas de dragão
  dragonoid: { name: "Dragonoide", shape: "dragon", line: [1.0, 0.55, 0.12], vein: [1.0, 0.82, 0.3], base: [0.85, 0.12, 0.05], glint: [1, 0.7, 0.2], smoke: [0.2, 0.12, 0.08], sa: 0.6,
    aura: au({ smoke: [0.25, 0.14, 0.08], a0: 0.38, amax: 0.62, vein: [1.0, 0.55, 0.12], vt: "flame", vfrac: 0.25, vw: 0.1, vh: 0.16, ring: [1.0, 0.75, 0.25], rt: "ember", rK: 1.2 }) },
  // Bestial: âmbar / dourado-terra com marrom, poeira e pelos (anel de poeira nos pés)
  beastkin: { name: "Bestial", shape: "fan", line: [0.85, 0.62, 0.25], vein: [0.95, 0.8, 0.4], base: [0.45, 0.28, 0.14], glint: [1, 0.85, 0.45], smoke: [0.55, 0.42, 0.28], sa: 0.45,
    aura: au({ smoke: [0.55, 0.42, 0.26], a0: 0.28, amax: 0.5, vein: [0.95, 0.75, 0.35], vt: "ember", vw: 0.05, vh: 0.08, ring: [0.7, 0.52, 0.3], rt: "smoke", ry: 0.2 }) },
  // Morto-vivo: verde-doente / cinza-azulado, névoa fantasma e almas
  undead: { name: "Morto-vivo", shape: "fan", line: [0.55, 0.75, 0.45], vein: [0.6, 0.68, 0.78], base: [0.3, 0.45, 0.25], glint: [0.7, 1, 0.6], smoke: [0.5, 0.6, 0.62], sa: 0.4,
    aura: au({ smoke: [0.45, 0.55, 0.55], a0: 0.28, amax: 0.5, vein: [0.7, 1.0, 0.75], vt: "skull", vfrac: 0.12, vw: 0.14, vh: 0.14, ring: [0.55, 0.85, 0.6], rt: "smoke", swl: 30 }) },
  // Ogro: vermelho-ferrugem / brasa escura com cinza, fumaça pesada (grande, sobe devagar)
  ogre: { name: "Ogro", shape: "fan", line: [0.6, 0.2, 0.1], vein: [0.95, 0.38, 0.1], base: [0.35, 0.33, 0.33], glint: [1, 0.45, 0.15], smoke: [0.22, 0.2, 0.2], sa: 0.7,
    aura: au({ smoke: [0.24, 0.21, 0.2], a0: 0.42, amax: 0.68, vein: [1.0, 0.4, 0.12], vt: "ember", vw: 0.05, vh: 0.08, ring: [0.3, 0.28, 0.28], rt: "smoke", szK: 1.35, rK: 0.65 }) },
  // Homem-lagarto: verde-água / turquesa com dourado, vapor
  lizardman: { name: "Homem-lagarto", shape: "fan", line: [0.25, 0.75, 0.68], vein: [0.2, 0.85, 0.85], base: [0.9, 0.72, 0.25], glint: [1, 0.85, 0.4], smoke: [0.75, 0.92, 0.9], sa: 0.3,
    aura: au({ smoke: [0.7, 0.9, 0.88], a0: 0.2, amax: 0.4, vein: [0.3, 0.9, 0.85], vt: "drop", vw: 0.07, vh: 0.09, ring: [0.95, 0.78, 0.3], rt: "ember", rK: 1.3 }) },
  // Vampiro: carmesim / rubi e preto, névoa de sangue e morcegos de fumaça; asas pontiagudas de morcego com base vermelha
  vampire: { name: "Vampiro", shape: "bat", line: [0.14, 0.02, 0.04], vein: [0.75, 0.05, 0.12], base: [0.9, 0.08, 0.1], glint: [1, 0.2, 0.25], smoke: [0.35, 0.02, 0.06], sa: 0.5,
    aura: au({ smoke: [0.4, 0.03, 0.07], a0: 0.26, amax: 0.45, vein: [0.1, 0.02, 0.04], vt: "bat", vfrac: 0.14, vw: 0.16, vh: 0.12, ring: [0.85, 0.06, 0.1], rt: "drop" }) },
  // Anão: cobre / bronze / laranja-forja com fagulhas
  dwarf: { name: "Anão", shape: "fan", line: [0.75, 0.42, 0.2], vein: [1.0, 0.6, 0.2], base: [0.6, 0.45, 0.22], glint: [1, 0.78, 0.3], smoke: [0.3, 0.25, 0.2], sa: 0.55,
    aura: au({ smoke: [0.3, 0.25, 0.2], a0: 0.32, amax: 0.55, vein: [1.0, 0.7, 0.25], vt: "spark", vfrac: 0.25, vw: 0.07, vh: 0.07, ring: [0.85, 0.5, 0.2], rt: "ember", rK: 1.1 }) },
};
// Lorde de humano/slime/goblin: asas discretas ("aura alada"); demais Lordes: leque moderado da raça (Bestial/Ogro/Lagarto/Morto-vivo/Anão)

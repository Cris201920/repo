// data/tiers.js - 6.84: TIERS DE PODER das magias e o TAMANHO de cada tier.
//   0 Básica (comum/incomum)  1 Avançada (rara/épica)  2 Única (lendária/mítica, ou categoria Única)  3 Ultimate (divina ou categoria Ultimate)
// AREA: multiplica a área REAL de efeito (raio/largura/alcance de corte) — aplicado uma vez no carregamento (data/skills.js).
// FX:   multiplica o tamanho de TODO o visual da magia (partículas, rastros, círculos, corpos 3D) — aplicado no contexto de efeitos.
export const TIER_NAMES = ["Básica", "Avançada", "Única", "Ultimate"];
export const TIER_AREA = [1.0, 1.2, 1.45, 1.75];
export const TIER_FX = [0.85, 1.15, 1.55, 2.1];
const RANK = { common: 0, uncommon: 0, rare: 1, epic: 1, legendary: 2, mythic: 2, divine: 3 };
export function tierOf(sk) {
  if (!sk) return 1;
  if (sk.cat === "Ultimate") return 3;
  let r = RANK[sk.rarity] ?? 1;
  if (sk.cat === "Única" && r < 2) r = 2;
  return r;
}
const AREA_KINDS = new Set(["aoe_self", "target_aoe", "field", "storm", "cone", "wave", "projectile", "beam", "chain", "bind", "execute", "combo"]);
/** escala a área real de uma habilidade pelo tier (idempotente: marca sk._tierArea) */
export function applyTierArea(sk) {
  const ex = sk?.exec; if (!ex || sk._tierArea || !AREA_KINDS.has(ex.kind)) return;
  const m = TIER_AREA[tierOf(sk)];
  if (typeof ex.radius === "number") ex.radius = Math.round(ex.radius * m * 10) / 10;
  if (typeof ex.width === "number") ex.width = Math.round(ex.width * m * 10) / 10;
  if (typeof ex.jumpRange === "number") ex.jumpRange = Math.round(ex.jumpRange * m * 10) / 10;
  sk._tierArea = m; sk.tier = TIER_NAMES[tierOf(sk)];
}

// data/skillcolors.js - 6.46: IDENTIDADE VISUAL das habilidades por categoria/elemento (só cor; não muda regras, custos ou efeitos).
//  elemental: cor do elemento · cura/suporte: verde · demoníacas (sangue/sombra/vazio): vermelho/roxo/cinza escuro ·
//  angelicais (luz/sagrado): amarelo-claro/branco · dracônicas (Racial de dragão): laranja · supremas (Ultimate/Manas/divina): dourado em negrito.
export const ELEMENT_COLOR = { fire: "§c", ice: "§b", lightning: "§e", bolt: "§e", arcane: "§d", physical: "§f", earth: "§6", water: "§9", wind: "§a", green: "§2",
  light: "§e", holy: "§f", gold: "§6", blood: "§4", shadow: "§8", void: "§5" };
export const GROUP = (sk) => {
  if (!sk) return "comum";
  if (sk.cat === "Ultimate" || sk.cat === "Manas" || sk.rarity === "divine") return "suprema";
  if (sk.cat === "Suporte" && /cura|heal|regen/i.test(`${sk.id} ${sk.name}`)) return "cura";
  if (["blood", "shadow", "void"].includes(sk.element)) return "demoníaca";
  if (["light", "holy"].includes(sk.element)) return "angelical";
  if (/drag|dragon|dracon/i.test(sk.id)) return "dracônica";
  return "elemental";
};
const GROUP_COLOR = { suprema: "§6§l", cura: "§a", dracônica: "§6" };
export function skillColor(sk) { const g = GROUP(sk); return GROUP_COLOR[g] ?? ELEMENT_COLOR[sk?.element] ?? "§f"; }
export const GROUP_LABEL = { suprema: "Suprema", cura: "Cura", demoníaca: "Demoníaca", angelical: "Angelical", dracônica: "Dracônica", elemental: "Elemental", comum: "Comum" };

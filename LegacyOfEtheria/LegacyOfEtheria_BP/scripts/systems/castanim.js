// systems/castanim.js - 6.57: GESTOS DE MAGIA DO JOGADOR (animações animation.etheria.cast.*, tools/race_styles.py).
// Conjuração em fases: mãos juntas carregando enquanto a magia se forma. Ao lançar: gesto conforme o TIPO real da habilidade
// (projétil, raio, explosão ao redor, área no alvo, suporte, corte, investida, devorar, invocação). Agilidade e forma dracônica têm animação própria.
import { on, EV } from "../core/bus.js";

const KIND = {
  projectile: "projectile", chain: "projectile", mark: "projectile", steal: "projectile",
  beam: "beam", wave: "beam", storm: "beam",
  aoe_self: "aoe", field: "aoe", antiskill: "aoe",
  target_aoe: "target", bind: "target",
  heal: "support", buff: "support", sense: "support", link: "support",
  cone: "slash", execute: "slash", combo: "slash", improvise: "slash",
  dash: "dash", teleport: "dash",
  devour: "devour", feast: "devour",
  summon: "summon", creation: "summon", creator_forge: "summon",
};
const play = (p, id, blend = 0.2) => { try { p.playAnimation(`animation.etheria.cast.${id}`, { blendOutTime: blend }); } catch { /* ignore */ } };
export const gestureOf = (sk) => KIND[sk?.exec?.kind] ?? null;
export function startCastAnim() {
  on(EV.SKILL_CAST_START, ({ player, sk }) => { if (gestureOf(sk)) play(player, "charge", 0.15); });
  on(EV.SKILL_USED, ({ player, sk }) => { const g = gestureOf(sk); if (g) play(player, g); });
}

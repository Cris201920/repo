// systems/skillfx.js - Executa as fases visuais de uma habilidade: cast -> travel -> impact.
import { releaseFx, impactFx } from "./elementfx.js";
import { system } from "@minecraft/server";
import { ctx, after, skillPart } from "./fxlib.js";
import { recipeFor } from "../data/fxrecipes.js";
import { ELEMENT_VFX, familyOf } from "../data/elementvfx.js";
import { masteryLevel } from "./mastery.js";
import { getData } from "../core/db.js";
import { norm } from "../core/utils.js";
import { grandFx } from "../data/fxgrand.js";
import { spellBody } from "./spellvfx.js";

export function playSkillFx(player, sk, geo) {
  if (sk?.exec?.kind === "ultimate") return;   // 6.81: Skills Ultimate têm coreografia própria (systems/ultimates.js)
  const c = ctx(player); if (c.k <= 0) return;
  const r = recipeFor(sk), ml = masteryLevel(player, sk.id), tier = ml >= 7 ? 3 : ml >= 3 ? 2 : 1;
  const dir = geo.dir ?? norm(player.getViewDirection());
  const v = { pos: geo.pos ?? player.location, from: geo.from ?? player.getHeadLocation(), to: geo.to ?? geo.at ?? player.location, at: geo.at ?? geo.to ?? player.location, dir, tier, sk };
  const run = (fn) => { try { fn?.(c, v); } catch { /* efeitos nunca derrubam a habilidade */ } };
  // partículas portadas dos mods de referência (flipbooks de RP/particles/fx_*.json) somam-se ao visual de cada fase
  const part = (ph) => run((cx, vv) => skillPart(cx, sk, ph, vv));
  // 6.36: camadas do elemento (preparação -> ativação -> trajetória -> impacto -> resíduo) somadas à coreografia própria
  const E = ELEMENT_VFX[familyOf(sk)] ?? null;
  run(r.cast); part("cast"); if (E) { run(E.prep); after(1, () => run(E.act)); }
  const d = Math.hypot(v.to.x - v.from.x, v.to.y - v.from.y, v.to.z - v.from.z);
  after(2, () => { run(r.travel); part("travel"); if (E) run(E.trail); });
  const hitT = 2 + Math.min(10, Math.ceil(d / 3));
  run((cx, vv) => releaseFx(cx, vv, sk, hitT));   // 6.82: identidade do elemento (lançamento + rastro)
  after(hitT, () => { run(r.impact); part("impact"); if (E) { run(E.impact); run(E.residue); } run((cx, vv) => impactFx(cx, vv, sk)); });
  // 6.55: camada de grandeza (densidade por raridade + composição própria do elemento), no mesmo tempo do impacto real
  run((cx, vv) => grandFx(cx, vv, sk, (f) => after(hitT, () => f(vv.at)), hitT));
  // 6.65: corpo 3D da magia (modelo + textura animada do mod) na mesma trajetória e no mesmo impacto
  run((cx, vv) => spellBody(cx, vv, sk, hitT));
}

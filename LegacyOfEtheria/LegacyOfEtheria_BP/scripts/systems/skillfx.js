// systems/skillfx.js - Executa as fases visuais de uma habilidade: cast -> travel -> impact.
import { system } from "@minecraft/server";
import { ctx, after, skillPart } from "./fxlib.js";
import { recipeFor } from "../data/fxrecipes.js";
import { masteryLevel } from "./mastery.js";
import { getData } from "../core/db.js";
import { norm } from "../core/utils.js";

export function playSkillFx(player, sk, geo) {
  const c = ctx(player); if (c.k <= 0) return;
  const r = recipeFor(sk), ml = masteryLevel(player, sk.id), tier = ml >= 7 ? 3 : ml >= 3 ? 2 : 1;
  const dir = geo.dir ?? norm(player.getViewDirection());
  const v = { pos: geo.pos ?? player.location, from: geo.from ?? player.getHeadLocation(), to: geo.to ?? geo.at ?? player.location, at: geo.at ?? geo.to ?? player.location, dir, tier, sk };
  const run = (fn) => { try { fn?.(c, v); } catch { /* efeitos nunca derrubam a habilidade */ } };
  // partículas portadas dos mods de referência (flipbooks de RP/particles/fx_*.json) somam-se ao visual de cada fase
  const part = (ph) => run((cx, vv) => skillPart(cx, sk, ph, vv));
  run(r.cast); part("cast");
  const d = Math.hypot(v.to.x - v.from.x, v.to.y - v.from.y, v.to.z - v.from.z);
  after(2, () => { run(r.travel); part("travel"); });
  after(2 + Math.min(10, Math.ceil(d / 3)), () => { run(r.impact); part("impact"); });
}

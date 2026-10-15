// systems/fx.js - Partículas e sons com 3 níveis (alto/reduzido/desligado) para poupar o celular
import { FX_MAP } from "../data/misc.js";
import { getData } from "../core/db.js";
import { playSound } from "../core/utils.js";

export function level(caster) {
  try { const v = caster ? getData(caster).settings.fx : "high"; return v === "extreme" ? "ultra" : v; } catch { return "high"; }
}
function spawn(dim, loc, id) {
  try { dim.spawnParticle(`etheria:${FX_MAP[id] ?? id}`, loc); } catch { /* partícula inexistente */ }
}
/** Partícula pontual. scale>1 gera um segundo ponto levemente deslocado (apenas no nível alto). */
export function fx(dim, loc, id, caster, scale = 1) {
  const lv = level(caster); if (lv === "off") return;
  spawn(dim, loc, id);
  if ((lv === "high" || lv === "ultra") && scale > 1) spawn(dim, { x: loc.x, y: loc.y + 0.6, z: loc.z }, id);
}
/** Linha de partículas entre dois pontos. */
export function line(dim, a, b, id, caster) {
  const lv = level(caster); if (lv === "off") return;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz) || 1;
  const step = (lv === "high" || lv === "ultra") ? 2 : 5, max = (lv === "high" || lv === "ultra") ? 14 : 5;
  const n = Math.min(max, Math.max(1, Math.floor(len / step)));
  for (let i = 1; i <= n; i++) { const t = i / n; spawn(dim, { x: a.x + dx * t, y: a.y + dy * t, z: a.z + dz * t }, id); }
}
/** Anel de partículas ao redor de um centro. */
export function ring(dim, c, radius, id, caster) {
  const lv = level(caster); if (lv === "off") return;
  const n = (lv === "high" || lv === "ultra") ? 10 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    spawn(dim, { x: c.x + Math.cos(a) * radius, y: c.y + 0.2, z: c.z + Math.sin(a) * radius }, id);
  }
}
export function sfx(player, id, volume = 1, pitch = 1) { if (id) playSound(player, id, volume, pitch); }

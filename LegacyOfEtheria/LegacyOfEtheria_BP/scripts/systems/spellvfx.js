// systems/spellvfx.js - 6.65: MAGIAS EM 3D (modelos + texturas animadas do mod Tensura, gerados por tools/spell_models.py).
// Cada magia ganha um corpo visível que segue a MESMA trajetória e o MESMO instante de impacto já calculados pela habilidade
// (systems/skillfx.js -> playSkillFx), somado às partículas (não substitui nada, não cria outro sistema de dano):
//   projétil / corrente / raio / marca  -> esfera ou bola de fogo voando da mão até o alvo, virada para a direção do voo
//   área (ao redor, no alvo, campo, tempestade) -> CÚPULA que cresce até o RAIO REAL do dano (exec.radius), segura e se desfaz
//   golpes (cone, execução, combo, onda) -> LÂMINA em meia-lua que corta para a frente
//   projéteis também abrem uma esfera de impacto pequena no fim.
// Desempenho: no máx. MAXV visuais vivos; desligado com partículas em "off"; cada entidade some sozinha em 6 s (timer) mesmo se o script parar.
import { system } from "@minecraft/server";
import { VFX } from "../data/spellvfx.gen.js";
import { BIG } from "../data/fxgrand.js";

const MAXV = 14, PROP = "etheria:sz";
const live = new Set();
const PROJ = { fire: "fire_ball", lightning: "lightning_sphere", bolt: "yellow_lightning", ice: "frost_ball", water: "water_ball", wind: "wind_sphere", earth: "mud_shot",
  light: "solar_grenade", holy: "solar_grenade", gold: "solar_grenade", shadow: "black_fire_ball", void: "gravity_sphere", blood: "aura_red", arcane: "aura_purple", green: "acid_ball", physical: "aura_yellow" };
const DOME = { fire: "flame_orb", lightning: "lightning_sphere", bolt: "yellow_lightning", ice: "aura_blue", water: "aura_blue", wind: "wind_sphere", earth: "heat_sphere",
  light: "solar_grenade", holy: "solar_grenade", gold: "solar_grenade", shadow: "gravity_sphere", void: "gravity_sphere", blood: "aura_red", arcane: "aura_purple", green: "aura_yellow", physical: "aura_yellow" };
const BLADE = { wind: "wind_blade", water: "water_blade", ice: "water_blade", green: "poison_blade", blood: "poison_blade", void: "dimension_cut", shadow: "dimension_cut", arcane: "space_cut" };
const FLY = new Set(["projectile", "chain", "beam", "mark", "steal"]);
const AREA = new Set(["aoe_self", "target_aoe", "field", "storm"]);
const SLASH = new Set(["cone", "execute", "combo", "wave"]);
const UNIT = 14 / 16;   // casca da esfera: 14 px = 0,875 bloco em escala 1

const ok = (e) => { try { return e?.isValid; } catch { return false; } };
const kill = (e) => { live.delete(e); try { if (ok(e)) e.remove(); } catch { /* ignore */ } };
const setSz = (e, v) => { try { if (ok(e)) e.setProperty(PROP, Math.max(0, Math.min(64, v))); } catch { /* ignore */ } };
const yawPitch = (d) => ({ y: (Math.atan2(-d.x, d.z) * 180) / Math.PI, x: (-Math.asin(Math.max(-1, Math.min(1, d.y))) * 180) / Math.PI });
function spawn(dim, name, pos, sz, dir) {
  if (!VFX[name] || live.size >= MAXV) return null;
  let e = null; try { e = dim.spawnEntity(`etheria:vfx_${name}`, pos); } catch { return null; }
  live.add(e); setSz(e, sz);
  if (dir) { try { e.teleport(pos, { rotation: yawPitch(dir) }); } catch { /* ignore */ } }
  return e;
}
/** passo a passo por tick (t de 0 a n) */
function steps(n, f, end) { let k = 0; const id = system.runInterval(() => { k++; try { f(k); } catch { /* ignore */ } if (k >= n) { system.clearRun(id); try { end?.(); } catch { /* ignore */ } } }, 1); }
/** cúpula/esfera que cresce até "to", segura e encolhe */
export function dome(dim, name, at, radius, hold = 6) {
  const e = spawn(dim, name, at, 0.2); if (!e) return;
  const full = (radius * 2) / UNIT, grow = 7;
  steps(grow + hold + 6, (k) => setSz(e, k <= grow ? full * (1 - Math.pow(1 - k / grow, 3)) : k <= grow + hold ? full : full * (1 - (k - grow - hold) / 6)), () => kill(e));
}

/** chamado por playSkillFx com o mesmo v (from/to/at/dir) e o mesmo instante de impacto (hitT) */
export function spellBody(c, v, sk, hitT) {
  if (!c || c.k <= 0 || !c.dim) return;
  const kind = sk?.exec?.kind, el = sk?.element ?? "arcane", big = BIG(sk), dim = c.dim;
  if (FLY.has(kind)) {
    const name = big && el === "fire" ? "hell_flare" : PROJ[el] ?? "aura_purple";
    const a = v.from, b = v.to, n = Math.max(2, hitT), d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, L = Math.hypot(d.x, d.y, d.z) || 1;
    const dir = { x: d.x / L, y: d.y / L, z: d.z / L }, rot = yawPitch(dir), sz = (big ? 2.2 : 1.3) * (VFX[name].kind === "shell" ? 1 : 1.4);
    const e = spawn(dim, name, a, sz, dir); if (!e) return;
    steps(n, (k) => { if (!ok(e)) return; const t = k / n; e.teleport({ x: a.x + d.x * t, y: a.y + d.y * t, z: a.z + d.z * t }, { rotation: rot }); },
      () => { kill(e); dome(dim, DOME[el] ?? "aura_purple", v.at ?? b, big ? 2.6 : 1.3, 2); });
  } else if (AREA.has(kind)) {
    const R = Math.max(2, Math.min(24, sk.exec?.radius ?? 5));
    system.runTimeout(() => dome(dim, big && el === "fire" ? "hell_flare" : DOME[el] ?? "aura_purple", v.at ?? v.pos, R, big ? 10 : 6), Math.max(1, hitT));
  } else if (SLASH.has(kind)) {
    const name = BLADE[el] ?? "aura_slash", f = v.dir ?? { x: 0, y: 0, z: 1 }, a = { x: v.pos.x + f.x * 0.8, y: v.pos.y + 1.1, z: v.pos.z + f.z * 0.8 };
    const reach = Math.max(4, Math.min(12, sk.exec?.range ?? 6)), n = 6, sz = big ? 3.2 : 1.9;
    const e = spawn(dim, name, a, sz * 0.6, f); if (!e) return; const rot = yawPitch({ x: f.x, y: 0, z: f.z });
    steps(n, (k) => { if (!ok(e)) return; const t = k / n; e.teleport({ x: a.x + f.x * reach * t, y: a.y, z: a.z + f.z * reach * t }, { rotation: rot }); setSz(e, sz * (0.6 + 0.6 * t)); }, () => kill(e));
  }
}
export const vfxLive = () => live.size;

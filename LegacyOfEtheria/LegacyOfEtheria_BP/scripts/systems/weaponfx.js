// systems/weaponfx.js - Identidade visual por arma: rastro de golpe, impacto próprio, golpe pesado (4º golpe encadeado),
// animação de equipar e reação a habilidades do mesmo elemento. Cada arma tem cores/sprite/padrão de impacto próprios.
import { world, system } from "@minecraft/server";
import { ctx, mote, streak, disc, burst, implode, ringFlat, column, fan, arc, helix, orbit, after, sl, T, CIRCLE } from "./fxlib.js";
import { registerPost } from "./skills.js";
import { getStats } from "./stats.js";
import { norm } from "../core/utils.js";
import { SWORD_FX } from "../data/swordfx.gen.js";
import { LOOK85 } from "../data/weapons85.gen.js";
import { slashMove, hitFx, xcut, moveFor, MOVE_ANIM, setCombo, comboOf, imbueTick, basis } from "./swordvfx.js";
import { infusionOf, INFUSIONS } from "./infusion.js";
import { vfxSpawn, vfxSize, vfxKill, vfxOk } from "./spellvfx.js";
import { ITEMS } from "../data/items.gen.js";
import { getData } from "../core/db.js";
import { isValid } from "../core/utils.js";

// id -> [corA, corB, sprite, padrão de impacto, círculo, elemento da arma]
const W = {
  iron_blade: ["steel", "white", "spark", "slash", "arcane", "physical"], knight_sword: ["steel", "gold", "diamond", "slash", "holy", "physical"],
  flame_sword: ["fire", "ember", "flame", "embers", "fire", "fire"], void_sword: ["void", "violet", "orb", "rift", "void", "void"],
  celestial_blade: ["holy", "white", "star", "light", "holy", "light"], shadow_dagger: ["black", "violet", "wing", "shadow", "shadow", "shadow"],
  wyrm_spear: ["gold", "earth", "diamond", "pierce", "earth", "physical"], berserker_axe: ["blood", "ember", "flame", "crush", "blood", "blood"],
  ember_fang: ["ember", "gold", "fang", "embers", "fire", "fire"], reaper_scythe: ["shadow", "sage", "skull", "reap", "shadow", "shadow"],
  goblin_king_club: ["earth", "dust", "chunk", "crush", "earth", "earth"], arcane_staff: ["arcane", "mana", "rune1", "rift", "arcane", "arcane"],
  void_scepter: ["void", "gold", "rune3", "rift", "void", "void"], storm_bow: ["bolt", "white", "zig", "pierce", "bolt", "lightning"], void_grimoire: ["void", "arcane", "rune2", "rift", "void", "void"],
  uraku_katana: ["steel", "white", "line", "iai", "wind", "physical"], kusanagi: ["wind", "green", "cloud", "wind", "wind", "wind"],
  green_dragon_blade: ["green", "gold", "flame", "dragon", "fire", "fire"], dyrnwyn: ["fire", "gold", "flame", "holyfire", "fire", "fire"],
  gandiva: ["bolt", "gold", "star", "pierce", "bolt", "lightning"], geb: ["earth", "dust", "chunk", "quake", "earth", "earth"],
  dead_mans_hand: ["blood", "black", "skull", "death", "blood", "blood"], ruyi_jingu_bang: ["gold", "ember", "ring", "pierce", "holy", "physical"],
  soul_serpent_blade: ["sage", "violet", "skull", "soul", "devour", "shadow"], wild_card: ["pink", "white", "star", "card", "arcane", "arcane"],
  extermination_blade: ["black", "blood", "line", "exterm", "shadow", "shadow"], caedros_ashen_halberd: ["ember", "black", "ember", "ashen", "fire", "fire"],
  // 6.52: armas do Tensura que ainda não tinham identidade própria (cada uma com cor, sprite, impacto e círculo coerentes com a obra)
  tt_katana: ["steel", "white", "line", "iai", "wind", "physical"], tt_gobuta_kodachi: ["steel", "green", "leaf", "slash", "wind", "physical"],
  tt_kunai: ["black", "steel", "line", "pierce", "shadow", "shadow"], tt_spatial_blade: ["void", "arcane", "orb", "rift", "space", "void"],
  tt_spatial_blades: ["arcane", "violet", "diamond", "rift", "space", "void"], tt_sword_of_tempest: ["bolt", "white", "zig", "wind", "bolt", "lightning"],
  tt_crimson_lotus_edge: ["blood", "fire", "flame", "embers", "fire", "fire"], tt_ice_blade: ["ice", "frost", "flake", "pierce", "ice", "ice"],
  tt_shizue_sword: ["fire", "ember", "flame", "holyfire", "fire", "fire"], tt_dead_end_rainbow: ["pink", "holy", "star", "light", "holy", "light"],
  reid_dragon_sword: ["gold", "fire", "fang", "dragon", "fire", "fire"], tt_battle_axe: ["steel", "dust", "chunk", "crush", "earth", "physical"],
  tt_orc_axe: ["blood", "earth", "chunk", "crush", "blood", "physical"], tt_orc_cleaver: ["blood", "black", "fang", "crush", "blood", "blood"],
};
const look = (typeId) => { const k = (typeId ?? "").replace("etheria:", ""), r = W[k] ?? SWORD_FX[k] ?? LOOK85[k]; return r ? { A: r[0], B: r[1], tile: T[r[2]], pat: r[3], circle: CIRCLE[r[4]] ?? 0, el: r[5] } : null; };
/** Identidade visual da arma (elemento e padrão de golpe) para a análise do Sábio; null se a arma não tem identidade própria. */
export const weaponLook = look;
const up = (p, y = 1) => ({ x: p.x, y: p.y + y, z: p.z });

function impact(c, L, at, heavy, from) {
  const k = heavy ? 1.7 : 1, P = up(at, 1), n = (x) => Math.round(x * k);
  switch (L.pat) {
    case "slash": mote(c, P, { col: "white", tile: T.cross, size: 1.2 * k, life: 0.18, grow: -1 }); burst(c, P, { col: L.A, tile: T.spark, n: n(8), spd: 4, size: 0.2, life: 0.25 }); break;
    case "embers": burst(c, P, { col: L.A, tile: L.tile, n: n(10), spd: 2.5, size: 0.3, up: 1.4, acc: [0, 2, 0] }); disc(c, at, { col: L.B, circle: L.circle, size: 1.6 * k, life: 0.7 }); break;
    case "rift": implode(c, P, { col: L.B, tile: L.tile, n: n(8), radius: 1.6, life: 0.4 }); disc(c, at, { col: L.A, circle: L.circle, size: 2 * k, life: 0.9, rot: 70 }); break;
    case "light": column(c, at, { col: L.A, tile: T.line, n: n(8), h: 4, life: 0.7, r: 0.4 }); ringFlat(c, at, { col: L.B, tile: T.ring, radius: 2 * k, n: 10, life: 0.4 }); break;
    case "shadow": burst(c, P, { col: "black", tile: T.smoke, n: n(6), spd: 1.6, size: 0.5, a: 0.8 }); streak(c, { x: at.x - 0.7, y: at.y + 1.6, z: at.z }, { x: at.x + 0.7, y: at.y + 0.5, z: at.z }, { col: L.B, w: 0.12, life: 0.22 }); break;
    case "pierce": if (from) streak(c, from, P, { col: L.A, w: 0.1, life: 0.25 }); ringFlat(c, P, { col: L.B, tile: T.ring, radius: 1.4 * k, n: 8, life: 0.3 }); break;
    case "crush": ringFlat(c, at, { col: L.B, tile: T.chunk, radius: 2.4 * k, n: n(12), life: 0.5, size: 0.35, lift: 0.4 }); burst(c, at, { col: L.A, tile: L.tile, n: n(6), spd: 3, up: 1.5, acc: [0, -9, 0] }); break;
    case "reap": if (from) arc(c, from, norm({ x: at.x - from.x, y: 0, z: at.z - from.z }), { col: L.A, radius: 2.6, angle: 180, n: 7, tilt: 1.2, w: 0.2, life: 0.3, delay: 0.3 }); burst(c, P, { col: L.B, tile: T.skull, n: n(3), spd: 1.2, size: 0.28 }); break;
    case "iai": for (const o of [-0.5, 0.5]) streak(c, { x: at.x - 1.4, y: at.y + 1.6 + o, z: at.z - o }, { x: at.x + 1.4, y: at.y + 0.6 - o, z: at.z + o }, { col: o < 0 ? L.A : "white", w: 0.05, life: 0.18 }); break;
    case "wind": fan(c, P, from ? norm({ x: at.x - from.x, y: 0, z: at.z - from.z }) : { x: 1, y: 0, z: 0 }, { col: L.A, tile: T.cloud, n: n(8), angle: 100, spd: 5, size: 0.4, a: 0.7 }); break;
    case "dragon": column(c, at, { col: L.A, tile: L.tile, n: n(8), h: 3, life: 0.8, r: 0.5 }); burst(c, P, { col: L.B, tile: T.spark, n: n(6), spd: 3, size: 0.25 }); break;
    case "holyfire": column(c, at, { col: L.A, tile: L.tile, n: n(8), h: 3.5, life: 0.8, r: 0.5 }); ringFlat(c, at, { col: L.B, tile: T.ring, radius: 2.2 * k, n: 10, life: 0.4 }); break;
    case "quake": ringFlat(c, at, { col: L.A, tile: T.chunk, radius: 3.4 * k, n: n(14), life: 0.6, size: 0.4, lift: 0.5 }); disc(c, at, { col: L.B, circle: L.circle, size: 3 * k, life: 0.8 }); break;
    case "death": burst(c, P, { col: L.A, tile: T.drop, n: n(8), spd: 2.5, acc: [0, -9, 0], size: 0.25 }); burst(c, up(at, 1.6), { col: L.B, tile: T.skull, n: 2, spd: 0.8, size: 0.3 }); break;
    case "soul": if (from) implode(c, up(from, 1.2), { col: L.A, tile: T.skull, n: n(5), radius: 1.5, life: 0.4, size: 0.22 }); burst(c, P, { col: L.B, tile: T.orb, n: n(5), spd: 1.5, size: 0.25 }); break;
    case "card": burst(c, P, { col: L.A, tile: T.star, n: n(8), spd: 3, size: 0.3 }); burst(c, P, { col: L.B, tile: T.diamond, n: n(4), spd: 2, size: 0.3 }); break;
    case "exterm": for (let i = 0; i < 3; i++) streak(c, { x: at.x - 1.2, y: at.y + 2 - i * 0.6, z: at.z - 0.6 + i * 0.6 }, { x: at.x + 1.2, y: at.y + 0.4 + i * 0.3, z: at.z + 0.6 - i * 0.6 }, { col: i === 1 ? L.B : L.A, w: 0.1, life: 0.25 }); break;
    case "ashen": for (let i = 0; i < n(8); i++) after(i, () => mote(c, { x: at.x + (Math.random() - 0.5) * 2, y: at.y + 3, z: at.z + (Math.random() - 0.5) * 2 }, { col: i % 2 ? L.A : L.B, tile: L.tile, size: 0.3, life: 0.7, dir: [0, -1, 0], spd: 3 })); break;
    default: burst(c, P, { col: L.A, tile: L.tile, n: n(6), spd: 3 });
  }
}


// ------------------------------------------------------------------ raridade visual (0 comum … 6 divina): detalhes, efeitos, aura e som crescem com o nível
const TIER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, divine: 6 };
const tierOf = (id) => TIER[ITEMS[id]?.rarity] ?? 0;
const PATS = new Set(["slash", "embers", "rift", "light", "shadow", "pierce", "crush", "reap", "iai", "wind", "dragon", "holyfire", "quake", "death", "soul", "card", "exterm", "ashen"]);
const patOf = (L) => (PATS.has(L.pat) ? L.pat : "slash");
const sfx = (p, name, vol = 1, pitch = 1, at) => { try { p.playSound(`etheria.sword.${name}`, { volume: vol, pitch, ...(at ? { location: at } : {}) }); } catch { /* ignore */ } };
const fxOff = (p) => { try { return getData(p).settings.fx === "off"; } catch { return false; } };

// pontas da lâmina/mão estimadas a partir da vista (sem acesso ao osso do modelo)
function bladePts(p) {
  const h = p.getHeadLocation(), v = p.getViewDirection(), l = Math.hypot(v.x, v.z) || 1, r = { x: v.z / l, z: -v.x / l };
  const hand = { x: h.x + v.x * 0.8 + r.x * 0.35, y: h.y + v.y * 0.8 - 0.45, z: h.z + v.z * 0.8 + r.z * 0.35 };
  const tip = { x: h.x + v.x * 2.1 + r.x * 0.25, y: h.y + v.y * 2.1 - 0.3, z: h.z + v.z * 2.1 + r.z * 0.25 };
  return { hand, tip };
}

const combo = new Map(); // playerId -> { n, at }
const GENERIC = { A: "steel", B: "white", tile: T.spark, pat: "slash", circle: 0, el: "physical" };   // armas sem identidade própria
/** 3D: lâmina de aura que voa para a frente no golpe pesado das armas lendárias+ (corpos 3D das magias, systems/spellvfx.js). */
const AURA = { void: "dimension_cut", shadow: "dimension_cut", wind: "wind_blade", water: "water_blade", ice: "water_blade", arcane: "space_cut", blood: "poison_blade" };
function auraBlade(p, L) {
  const B = basis(p.getViewDirection()), a = { x: p.location.x + B.F.x * 0.8, y: p.location.y + 1.1, z: p.location.z + B.F.z * 0.8 };
  const e = vfxSpawn(p.dimension, AURA[L.el] ?? "aura_slash", a, 1.2, B.F); if (!e) return;
  for (let k = 1; k <= 6; k++) after(k, () => { if (!vfxOk(e)) return; try { e.teleport({ x: a.x + B.F.x * 1.3 * k, y: a.y, z: a.z + B.F.z * 1.3 * k }); } catch { /* ignore */ } vfxSize(e, 1.2 + k * 0.25); });
  after(7, () => vfxKill(e));
}
/** Chamado a cada golpe corpo a corpo. Retorna multiplicador de dano (golpe pesado = 1.25 nas armas com identidade). */
export function weaponHit(player, target, info) {
  const L0 = look(info?.id), L = L0 ?? GENERIC;
  const now = system.currentTick, c0 = combo.get(player.id), n = c0 && now - c0.at < 50 ? c0.n + 1 : 1;
  combo.set(player.id, { n, at: now });
  const step = ((n - 1) % 4) + 1, heavy = step === 4, tier = tierOf(info?.id), pat = patOf(L), c = ctx(player), dir = norm(player.getViewDirection()), from = player.location, tp = target.location;
  const move = moveFor(info?.wtype, step);
  setCombo(player, MOVE_ANIM[move], move === "heavy" ? 13 : 11);   // 8.5: golpe diferente no modelo em 3ª pessoa
  sfx(player, `${pat}_${heavy ? "heavy" : "hit"}`, 0.9, 0.95 + Math.random() * 0.1, tp);
  // 8.5: meia-lua no plano do golpe (lateral, revés, estocada, pesado) + impacto em camadas
  slashMove(c, player, move, L, tier);
  after(move === "thrust" ? 4 : 5, () => { if (isValid(target)) hitFx(c, target.location, L, tier, heavy, dir); });
  if (L0) impact(c, L, tp, heavy, from);
  // camadas por raridade no impacto
  if (tier >= 4 && step >= 3) disc(c, tp, { col: L.A, circle: L.circle, size: 1.4 + tier * 0.25, life: 0.6, rot: 90 });   // 8.5: círculo só na carga/golpe pesado
  if (tier >= 6) column(c, tp, { col: "white", tile: T.line, n: 8, h: 5, life: 0.8, r: 0.4 });
  // sequência do golpe especial: carga (3º golpe) → energia concentrada → corte pesado (4º) → dissipação
  if (step === 3) { const b = bladePts(player); sfx(player, `${pat}_charge`, 0.8); implode(c, b.tip, { col: L.A, tile: L.tile, n: 8 + tier * 2, radius: 1.8, life: 0.45, size: 0.22 }); sl(c, "glow", b.tip, { col: L.B, size: 0.5, life: 0.5, grow: 0.6, tile: 4 }); try { player.onScreenDisplay.setActionBar("§e⚡ ENERGIA CONCENTRADA"); } catch { /* ignore */ } }
  if (heavy) {
    try { player.onScreenDisplay.setActionBar("§6§lGOLPE PESADO"); } catch { /* ignore */ }
    const B = basis(dir);
    after(6, () => { if (isValid(target)) xcut(c, { x: target.location.x, y: target.location.y + 1.1, z: target.location.z }, B, { A: L.A, size: 1.1 + tier * 0.06 }); });
    if (tier >= 4) after(4, () => { if (isValid(player)) auraBlade(player, L); });
    after(10, () => { if (isValid(player)) { burst(c, up(tp, 1), { col: L.B, tile: T.spark, n: 10 + tier * 2, spd: 2.2, size: 0.18, life: 0.7, up: 1 }); ringFlat(c, tp, { col: L.A, tile: T.diamond, n: 12, radius: 3, life: 0.6 }); } });   // dissipação
  }
  return L0 && heavy ? 1.25 : 1;
}

// ------------------------------------------------------------------ rastro que ACOMPANHA o movimento da lâmina (amostragem a cada 2 ticks)
const tipLast = new Map(), swingCd = new Map();
function trailTick(p, L, tier) {
  const { tip, hand } = bladePts(p), prev = tipLast.get(p.id); tipLast.set(p.id, tip);
  if (!prev) return;
  const d = Math.hypot(tip.x - prev.x, tip.y - prev.y, tip.z - prev.z);
  if (d < 0.35 || d > 4.5) return;                       // só quando a lâmina realmente se move (giro/golpe); ignora teleporte
  const c = ctx(p), k = Math.min(1, d / 1.6);
  if (comboOf(p) > 0) return;   // 8.5: durante o golpe a meia-lua do combo já desenha o corte
  const md = { x: (prev.x + tip.x) / 2, y: (prev.y + tip.y) / 2, z: (prev.z + tip.z) / 2 }, dv = [(tip.x - prev.x) / d, (tip.y - prev.y) / d, (tip.z - prev.z) / d];
  sl(c, "ribbon", md, { dir: dv, sx: 0.12 + tier * 0.02 + k * 0.1, sy: d * 0.62, col: L.A, a: 0.6, life: 0.3 + tier * 0.03, tile: 0 });
  sl(c, "ribbon", md, { dir: dv, sx: 0.04 + k * 0.03, sy: d * 0.62, col: tier >= 3 ? L.B : "white", a: 0.9, life: 0.22, tile: 1 });
  if (tier >= 5 && Math.random() < 0.6) mote(c, tip, { col: L.B, tile: L.tile, size: 0.14, life: 0.5, dir: [0, 0.4, 0], spd: 0.4 });
  if (d > 0.9 && (swingCd.get(p.id) ?? 0) < system.currentTick) { swingCd.set(p.id, system.currentTick + 8); sfx(p, `${patOf(L)}_swing`, 0.45 + 0.1 * tier, 0.95 + Math.random() * 0.1); }   // som de corte no ar (com recarga)
}

// ------------------------------------------------------------------ equipar / desequipar / aura de empunhadura
const held = new Map();
function activate(p, L, tier, id) {
  const c = ctx(p), { hand } = bladePts(p), pat = patOf(L);
  sfx(p, `${pat}_draw`, 0.8, 1);
  if (tier < 1) return;
  disc(c, p.location, { col: L.A, circle: L.circle, size: 1.5 + tier * 0.25, life: 0.8, rot: 60 });
  orbit(c, () => ({ x: p.location.x, y: p.location.y + 1, z: p.location.z }), { col: L.B, tile: L.tile, n: 2, r: 0.8, dur: 10, life: 0.3, size: 0.22 });
  if (tier >= 2) { sfx(p, `activate${tier >= 5 ? 3 : tier >= 3 ? 2 : 1}`, 0.7); implode(c, hand, { col: L.A, tile: T.spark, n: 6 + tier * 2, radius: 1.3, life: 0.4, size: 0.2 }); }   // energia → ...
  if (tier >= 3) after(8, () => { if (isValid(p)) ringFlat(c, p.location, { col: L.B, tile: T.rune1, n: 10 + tier * 2, radius: 1.6, life: 0.7, size: 0.2 }); });                          // ... runas ativam
  if (tier >= 4) after(14, () => { if (isValid(p)) helix(c, p.location, { col: L.A, tile: T.glyph, r: 0.9, h: 2.4, steps: 14, turns: 2, dur: 16 }); });                                   // ... aura surge
  if (tier >= 5) after(22, () => { if (isValid(p)) { column(c, p.location, { col: L.B, tile: T.star, n: 8, h: 3, life: 0.9, r: 0.6 }); try { p.onScreenDisplay.setActionBar(`§l${ITEMS[id]?.name ?? ""}`); } catch { /* ignore */ } } });
}
function deactivate(p, L, tier) {   // guardar: o efeito se desfaz gradualmente
  if (tier < 2) return; const c = ctx(p), at = { x: p.location.x, y: p.location.y + 1, z: p.location.z };
  burst(c, at, { col: L.A, tile: T.spark, n: 4 + tier * 2, spd: 0.8, size: 0.15, life: 1.0, a: 0.7, up: 0.5 }); try { p.playSound("etheria.sword.activate1", { volume: 0.35, pitch: 0.6 }); } catch { /* ignore */ }
}
function tickHeld(p) {
  let id; try { id = p.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId; } catch { return; }
  const was = held.get(p.id);
  if (was !== id) {
    held.set(p.id, id); tipLast.delete(p.id);
    const Lo = look(was); if (Lo) deactivate(p, Lo, tierOf(was));
    const L = look(id); if (!L || fxOff(p)) return; activate(p, L, tierOf(id), id);
  }
}
function auraTick(p) {   // aura de empunhadura: só armas épicas+ e só com detalhe médio+
  const id = held.get(p.id), L = look(id); if (!L) return; const tier = tierOf(id); if (tier < 3 || fxOff(p)) return;
  let lv = "high"; try { lv = getData(p).settings.fx; } catch { /* ignore */ }
  if (lv === "low") return;
  const c = ctx(p), { hand, tip } = bladePts(p);
  mote(c, { x: hand.x + (tip.x - hand.x) * Math.random(), y: hand.y + (tip.y - hand.y) * Math.random(), z: hand.z + (tip.z - hand.z) * Math.random() }, { col: L.A, tile: L.tile, size: 0.1 + tier * 0.01, life: 0.7, dir: [0, 1, 0], spd: 0.3, a: 0.8 });
  if (tier >= 4 && lv !== "medium") mote(c, tip, { col: L.B, tile: T.star, size: 0.16, life: 0.5, a: 0.7 });
  if (tier >= 5 && Math.random() < 0.3) { const q = p.location; mote(c, { x: q.x + (Math.random() - 0.5) * 1.2, y: q.y + 0.1, z: q.z + (Math.random() - 0.5) * 1.2 }, { col: L.A, tile: T.ring, size: 0.4, life: 0.8, a: 0.4 }); }
}
// 8.5: brilho de magia na lâmina (infusão gravada = forte; arma elemental rara+ = suave)
let imbN = 0;
function imbueHeld(p) {
  const id = held.get(p.id); if (!id || fxOff(p) || comboOf(p) > 0) return;
  let it; try { it = p.getComponent("minecraft:inventory").container.getItem(p.selectedSlotIndex); } catch { return; }
  const iid = it ? infusionOf(it) : null, L = look(id), tier = tierOf(id);
  if (iid) { const I = INFUSIONS[iid]; imbueTick(ctx(p), p, I.col, L?.B ?? "white", true, imbN); return; }
  if (L && L.el !== "physical" && tier >= 2) imbueTick(ctx(p), p, L.A, L.B, false, imbN);
}
export function startWeaponFx() {
  system.runInterval(() => { imbN++; for (const p of world.getAllPlayers()) { try { imbueHeld(p); } catch { /* ignore */ } } }, 2);
  system.runInterval(() => { for (const p of world.getAllPlayers()) tickHeld(p); }, 10);
  system.runInterval(() => { for (const p of world.getAllPlayers()) { try { auraTick(p); } catch { /* ignore */ } } }, 8);
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      const id = held.get(p.id), L = id && look(id); if (!L || fxOff(p)) { tipLast.delete(p.id); continue; }
      try { trailTick(p, L, tierOf(id)); } catch { /* ignore */ }
    }
  }, 2);
  // habilidade do mesmo elemento da arma: a lâmina reage (aura + hélice)
  registerPost((player, sk) => {
    const w = getStats(player).weapon, L = look(w?.id); if (!L || !sk.element) return;
    if (L.el !== sk.element) return;
    const c = ctx(player);
    helix(c, player.location, { col: L.A, tile: L.tile, r: 0.7, h: 2, steps: 10, turns: 2, dur: 10 });
    ringFlat(c, player.location, { col: L.B, tile: T.ring, radius: 1.8, n: 10, life: 0.4 });
  });
}

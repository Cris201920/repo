// systems/trident.js - 8.5 ETAPA 5: TRIDENTE DOS DRAGÕES MARINHOS (etheria:sea_dragons_trident, modelo do sea-dragons-trident enviado).
// Corpo a corpo: igual às outras armas (systems/combat.js + combo de estocadas em weaponfx/swordvfx).
// Arremesso: botão de USAR. O braço faz a animação de arremesso (etheria:combo = 5), o tridente voa (entidade visual etheria:vfx_trident,
// inclinada pela propriedade etheria:pitch) até o primeiro bloco/inimigo na mira (até 30 blocos), causa dano de perfuração, abre um
// respingo de água e chama um RAIO no ponto de impacto (dano em área pequena), depois volta para a mão. Recarga: 2 s (cooldown do item).
import { world, system, Player } from "@minecraft/server";
import { ctx, sl, bolt, disc, after, CIRCLE } from "./fxlib.js";
import { setCombo, basis } from "./swordvfx.js";
import { getStats } from "./stats.js";
import { dealDamage, isValidTarget, markCombat } from "./combat.js";
import { isValid } from "../core/utils.js";

export const TRIDENT = "etheria:sea_dragons_trident";
const RANGE = 30, SPEED = 1.8, CD = 40;
const cd = new Map();
const snd = (p, id, at, vol = 1, pitch = 1) => { try { p.dimension.playSound(id, at, { volume: vol, pitch }); } catch { /* ignore */ } };
const ok = (e) => { try { return !!e?.isValid; } catch { return false; } };

/** Primeiro alvo na mira: inimigo válido ou bloco sólido (o que vier antes). */
function aim(p, from, dir) {
  let dist = RANGE, hit = null;
  try {
    const b = p.dimension.getBlockFromRay(from, dir, { maxDistance: RANGE, includeLiquidBlocks: false, includePassableBlocks: false });
    if (b) { const q = { x: b.block.location.x + b.faceLocation.x, y: b.block.location.y + b.faceLocation.y, z: b.block.location.z + b.faceLocation.z }; dist = Math.min(dist, Math.hypot(q.x - from.x, q.y - from.y, q.z - from.z)); }
  } catch { /* ignore */ }
  try {
    for (const h of p.dimension.getEntitiesFromRay(from, dir, { maxDistance: RANGE }) ?? []) {
      if (h.distance < dist && isValidTarget(h.entity, p)) { dist = h.distance; hit = h.entity; }
    }
  } catch { /* ignore */ }
  return { dist: Math.max(1.5, dist), hit };
}

function impact(p, c, at, hit, power) {
  const atk = Math.max(6, getStats(p).atk ?? 10);
  if (hit && isValid(hit)) { dealDamage(p, hit, atk * 1.5 * power); markCombat(p); }
  snd(p, "item.trident.hit", at, 1, 0.9);
  // respingo de água
  for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.7; sl(c, "drop", { x: at.x, y: at.y + 0.3, z: at.z }, { dir: [Math.cos(a) * r, 1, Math.sin(a) * r], spd: 3 + Math.random() * 3, acc: [0, -14, 0], drag: 0.4, size: 0.1 + Math.random() * 0.06, col: i % 3 ? "water" : "foam", life: 0.7, tile: 6, a: 0.9 }); }
  for (let i = 0; i < 4; i++) sl(c, "drop", { x: at.x + (Math.random() - 0.5), y: at.y + 0.4, z: at.z + (Math.random() - 0.5) }, { size: 0.55, grow: 1.4, col: "foam", life: 0.8, tile: 7, a: 0.55, dir: [0, 1, 0], spd: 0.4 });
  sl(c, "ring", { x: at.x, y: at.y + 0.08, z: at.z }, { size: 0.8, grow: 3, col: "water", life: 0.45 });
  disc(c, at, { col: "water", circle: CIRCLE.water, size: 2.6, life: 0.9, rot: 60 });
  // raio dos mares (2 ticks depois)
  after(3, () => {
    const top = { x: at.x + (Math.random() - 0.5) * 2, y: at.y + 14, z: at.z + (Math.random() - 0.5) * 2 };
    bolt(c, top, { x: at.x, y: at.y + 0.2, z: at.z }, { col: "bolt", w: 0.22, life: 0.3, jitter: 0.7, branch: 0.35 });
    bolt(c, top, { x: at.x, y: at.y + 0.2, z: at.z }, { col: "white", w: 0.08, life: 0.22, jitter: 0.5 });
    sl(c, "flash", { x: at.x, y: at.y + 1, z: at.z }, { size: 2.2, col: "white", life: 0.25, rot: 30 });
    sl(c, "glow", { x: at.x, y: at.y + 0.8, z: at.z }, { size: 1.4, grow: 1, col: "bolt", life: 0.35, tile: 4, a: 0.8 });
    sl(c, "ring", { x: at.x, y: at.y + 0.1, z: at.z }, { size: 1.2, grow: 4, col: "bolt", life: 0.4 });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; sl(c, "spark", { x: at.x, y: at.y + 0.4, z: at.z }, { dir: [Math.cos(a), 0.6, Math.sin(a)], spd: 5, acc: [0, -10, 0], drag: 1, sx: 0.05, sy: 0.3, col: i % 2 ? "bolt" : "white", life: 0.35 }); }
    snd(p, "item.trident.thunder", at, 0.8, 1.1);
    try {
      for (const e of p.dimension.getEntities({ location: at, maxDistance: 2.8 })) if (isValidTarget(e, p)) dealDamage(p, e, atk * 0.6 * power);
    } catch { /* ignore */ }
  });
}

export function throwTrident(p) {
  const now = system.currentTick; if ((cd.get(p.id) ?? -99) > now) return false;
  cd.set(p.id, now + CD); try { p.startItemCooldown?.("etheria_trident", CD); } catch { /* ignore */ }
  setCombo(p, 5, 9);
  snd(p, "item.trident.throw", p.location, 1, 1);
  after(2, () => {
    if (!isValid(p)) return;
    const dir = p.getViewDirection(), B = basis(dir), h = p.getHeadLocation();
    const from = { x: h.x + B.R.x * 0.3 + dir.x * 0.6, y: h.y - 0.1 + dir.y * 0.6, z: h.z + B.R.z * 0.3 + dir.z * 0.6 };
    const { dist, hit } = aim(p, from, dir), n = Math.max(2, Math.ceil(dist / SPEED)), c = ctx(p), power = 1;
    const yaw = (Math.atan2(-dir.x, dir.z) * 180) / Math.PI, pitch = (-Math.asin(Math.max(-1, Math.min(1, dir.y))) * 180) / Math.PI;
    let e = null; try { e = p.dimension.spawnEntity("etheria:vfx_trident", from); e.setProperty("etheria:pitch", Math.max(-90, Math.min(90, pitch))); e.teleport(from, { rotation: { x: 0, y: yaw } }); } catch { e = null; }
    let prev = from;
    for (let k = 1; k <= n; k++) {
      after(k, () => {
        const t = Math.min(1, (k * SPEED) / dist), q = { x: from.x + dir.x * dist * t, y: from.y + dir.y * dist * t, z: from.z + dir.z * dist * t };
        if (ok(e)) { try { e.teleport(q, { rotation: { x: 0, y: yaw } }); } catch { /* ignore */ } }
        const md = { x: (prev.x + q.x) / 2, y: (prev.y + q.y) / 2, z: (prev.z + q.z) / 2 };
        sl(c, "ribbon", md, { dir: [dir.x, dir.y, dir.z], sx: 0.22, sy: SPEED * 0.62, col: "water", a: 0.55, life: 0.35, tile: 0 });
        sl(c, "ribbon", md, { dir: [dir.x, dir.y, dir.z], sx: 0.06, sy: SPEED * 0.62, col: "white", a: 0.8, life: 0.2, tile: 1 });
        if (k % 2) sl(c, "drop", q, { dir: [0, 1, 0], spd: 0.5, acc: [0, -10, 0], size: 0.09, col: "water", life: 0.5, tile: 6 });
        prev = q;
        if (k === n) {
          impact(p, c, q, hit, power);
          // volta para a mão (lealdade)
          const back = 8;
          after(4, () => { try { if (ok(e)) e.setProperty("etheria:pitch", Math.max(-90, Math.min(90, -pitch))); } catch { /* ignore */ } });
          for (let j = 1; j <= back; j++) after(4 + j, () => {
            if (!ok(e) || !isValid(p)) return; const hh = p.getHeadLocation(), u = j / back;
            const r = { x: q.x + (hh.x - q.x) * u, y: q.y + (hh.y - 0.4 - q.y) * u, z: q.z + (hh.z - q.z) * u };
            try { e.teleport(r, { rotation: { x: 0, y: yaw + 180 } }); } catch { /* ignore */ }
            if (j % 2) sl(c, "glow", r, { size: 0.25, col: "water", life: 0.3, tile: 4, a: 0.7 });
          });
          after(5 + back, () => { try { if (ok(e)) e.remove(); } catch { /* ignore */ } if (isValid(p)) snd(p, "item.trident.return", p.location, 0.8, 1); });
        }
      });
    }
  });
  return true;
}

export function startTrident() {
  world.afterEvents.itemUse.subscribe((ev) => {
    const p = ev.source; if (!(p instanceof Player) || ev.itemStack?.typeId !== TRIDENT) return;
    system.run(() => { try { throwTrident(p); } catch { /* ignore */ } });
  });
}

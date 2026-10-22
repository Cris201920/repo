// systems/swordvfx.js - 8.5 ETAPA 5: efeitos de ESPADA no estilo NightfallCraft.
//   - meia-lua de corte desenhada em 3 camadas (núcleo branco, brilho da cor da arma, sombra interna) que "varre" em 3 ticks no plano
//     do golpe do combo (lateral, diagonal, vertical) + faíscas que saltam do gume;
//   - estocada: lâmina de luz reta + clarão na ponta + cone de faíscas;
//   - impacto: clarão em estrela, núcleo brilhante, faíscas com gravidade, anel de choque e, no golpe pesado, corte em X no alvo;
//   - imbuição: brilho contínuo ao longo da lâmina enquanto a arma infundida (ou elemental) está na mão + ritual ao infundir;
//   - propriedade numérica etheria:combo do jogador (1 lateral · 2 diagonal · 3 estocada · 4 pesado · 5 arremesso) para as animações
//     de 3ª pessoa (RP/animations/etheria_combo.animation.json, tools/combat_anims.py); volta a 0 sozinha.
// Tudo passa pelo orçamento de partículas de fxlib (níveis de detalhe / desligado).
import { system } from "@minecraft/server";
import { sl, disc, after, CIRCLE } from "./fxlib.js";
import { isValid } from "../core/utils.js";

const v3 = (x, y, z) => ({ x, y, z });
const ad = (a, b, s = 1) => v3(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
const sc = (a, s) => v3(a.x * s, a.y * s, a.z * s);
const ln = (a) => Math.hypot(a.x, a.y, a.z) || 1e-6;
const nz = (a) => sc(a, 1 / ln(a));
const D = Math.PI / 180;
/** Base horizontal do jogador: F frente, R direita (Minecraft: olhando +Z, a direita é -X), U cima. */
export function basis(dir) {
  const l = Math.hypot(dir.x, dir.z) || 1, F = v3(dir.x / l, 0, dir.z / l);
  return { F, R: v3(-F.z, 0, F.x), U: v3(0, 1, 0) };
}
const arr = (v) => [v.x, v.y, v.z];

/** Uma fita (segmento) do rastro: centro no meio de a-b, alinhada a b-a. */
function ribbon(c, a, b, o) {
  const d = v3(b.x - a.x, b.y - a.y, b.z - a.z), L = ln(d);
  sl(c, "ribbon", v3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), { dir: arr(sc(d, 1 / L)), sx: o.w, sy: L * 0.62 + (o.ext ?? 0), col: o.col, a: o.a, life: o.life, tile: o.tile ?? 0 });
}

/**
 * Meia-lua no plano (F, S), S = R·cos(roll) + U·sin(roll). Ângulos em graus, positivos para o lado S.
 * o: {C centro, F, R, U, roll, a0, a1, r, w, n, delay, sweep, A, B, core, life, sparks}
 */
export function crescent(c, o) {
  const S = ad(sc(o.R, Math.cos(o.roll * D)), o.U, Math.sin(o.roll * D)), n = Math.max(6, Math.round((o.n ?? 12) * Math.min(1, c.k + 0.3)));
  const P = (t, r) => { const a = (o.a0 + (o.a1 - o.a0) * t) * D; return ad(ad(o.C, o.F, Math.cos(a) * r), S, Math.sin(a) * r); };
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2, prof = Math.pow(Math.sin(Math.PI * tm), 0.7), w = o.w * (0.25 + 0.75 * prof);
    after((o.delay ?? 2) + Math.floor(tm * (o.sweep ?? 3)), () => {
      ribbon(c, P(t0, o.r), P(t1, o.r), { w: w * 2.2, col: o.A, a: 0.62, life: (o.life ?? 0.3) + 0.06, tile: 0 });                        // brilho
      ribbon(c, P(t0, o.r + 0.05), P(t1, o.r + 0.05), { w: w * 0.55, col: o.core ?? "white", a: 1, life: o.life ?? 0.3, tile: 1 });        // núcleo
      ribbon(c, P(t0, o.r - w * 0.9), P(t1, o.r - w * 0.9), { w: w * 1.2, col: o.B, a: 0.32, life: (o.life ?? 0.3) + 0.12, tile: 0 });  // sombra interna
      if ((o.sparks ?? 0) > 0 && i % 2 === 0 && Math.random() < o.sparks) {
        const q = P(tm, o.r), out = nz(v3(q.x - o.C.x, (q.y - o.C.y) + 0.3, q.z - o.C.z));
        sl(c, "spark", q, { dir: arr(out), spd: 3 + Math.random() * 3, acc: [0, -9, 0], drag: 1.5, sx: 0.045, sy: 0.24, col: i % 4 ? o.B : "white", life: 0.35 });
      }
    });
  }
}

/** Estocada: lâmina de luz reta para a frente. */
export function thrust(c, o) {
  const a = ad(o.C, o.F, 0.4), b = ad(o.C, o.F, o.len ?? 3.4);
  after(o.delay ?? 3, () => {
    ribbon(c, a, b, { w: o.w * 2.2, col: o.A, a: 0.6, life: 0.32, tile: 0 });
    ribbon(c, a, b, { w: o.w * 0.6, col: o.core ?? "white", a: 1, life: 0.24, tile: 1 });
    sl(c, "flash", b, { size: 0.55 + o.w, col: "white", life: 0.18, rot: Math.random() * 90 });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2, rr = ad(ad(o.F, o.R, Math.cos(ang) * 0.8), o.U, Math.sin(ang) * 0.8);
      sl(c, "spark", b, { dir: arr(nz(rr)), spd: 4.5, drag: 2, sx: 0.04, sy: 0.22, col: i % 2 ? o.B : o.A, life: 0.25 });
    }
  });
  after((o.delay ?? 3) + 1, () => ribbon(c, ad(a, o.F, 0.5), ad(b, o.F, 0.6), { w: o.w * 1.2, col: o.B, a: 0.35, life: 0.3, tile: 0 }));
}

/** Corte em X (golpe pesado) centrado num ponto, no plano de frente para o atacante. */
export function xcut(c, at, B, o) {
  const k = o.size ?? 1.2;
  for (const [s, dl] of [[1, 0], [-1, 2]]) {
    const a = ad(ad(at, B.R, k * s), B.U, k), b = ad(ad(at, B.R, -k * s), B.U, -k);
    after(dl, () => {
      ribbon(c, a, b, { w: 0.5, col: o.A, a: 0.65, life: 0.36, tile: 0 });
      ribbon(c, a, b, { w: 0.14, col: "white", a: 1, life: 0.28, tile: 1 });
    });
  }
}

/** Impacto no alvo: clarão, núcleo, faíscas, anel; tudo na cor da arma. */
export function hitFx(c, at, L, tier, heavy, dir) {
  const P = v3(at.x, at.y + 1, at.z), k = heavy ? 1.6 : 1;
  sl(c, "flash", P, { size: (0.7 + tier * 0.06) * k, col: "white", life: 0.16, rot: Math.random() * 90 });
  sl(c, "glow", P, { size: 0.45 * k, col: L.A, life: 0.26, grow: 1.2, a: 0.8, tile: 4 });
  const n = Math.round((7 + tier) * k);
  for (let i = 0; i < n; i++) {
    const d = nz(v3(dir.x + (Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 0.9, dir.z + (Math.random() - 0.5) * 1.6));
    sl(c, "spark", P, { dir: arr(d), spd: 4 + Math.random() * 4, acc: [0, -12, 0], drag: 1.2, sx: 0.05, sy: 0.28, col: i % 3 ? L.A : "white", life: 0.32 + Math.random() * 0.15 });
  }
  if (heavy || tier >= 2) sl(c, "ring", v3(at.x, at.y + 0.08, at.z), { size: 0.9 * k, grow: 2.6, col: L.B, life: 0.35, a: 0.85 });
}

// ------------------------------------------------------------------ golpes do combo (sincronizados com as animações de 3ª pessoa)
export const MOVE_ANIM = { h: 1, d: 2, thrust: 3, heavy: 4 };
const SEQ = { spear: ["thrust", "h", "thrust", "heavy"], default: ["h", "d", "thrust", "heavy"] };
/** Golpe do passo 1..4 conforme o tipo de arma (lança/tridente: estocadas). */
export const moveFor = (wtype, step) => (SEQ[wtype] ?? SEQ.default)[(step - 1) % 4];
/** Desenha o golpe: centro no peito do jogador; cada golpe tem plano e ângulo próprios. */
export function slashMove(c, p, move, L, tier) {
  const B = basis(p.getViewDirection()), C = ad(ad(p.location, B.U, 1.2), B.F, 0.15), w = 0.38 + tier * 0.035, r = 2.0 + tier * 0.08;
  const base = { C, F: B.F, R: B.R, U: B.U, A: L.A, B: L.B, sparks: 0.5 + tier * 0.08 };
  if (move === "h") crescent(c, { ...base, roll: 12, a0: 82, a1: -82, r, w, n: 12, delay: 3, sweep: 3 });
  else if (move === "d") crescent(c, { ...base, roll: 140, a0: 80, a1: -80, r, w, n: 12, delay: 3, sweep: 3 });
  else if (move === "thrust") thrust(c, { C: ad(C, B.U, -0.15), F: B.F, R: B.R, U: B.U, A: L.A, B: L.B, w: 0.18 + tier * 0.02, len: 3.2 + tier * 0.1, delay: 4 });
  else {   // pesado: meia-lua vertical grande de cima para baixo + segunda camada atrasada
    crescent(c, { ...base, roll: 90, a0: 105, a1: -55, r: r + 0.5, w: w * 1.5, n: 16, delay: 4, sweep: 3, life: 0.4, sparks: 1 });
    crescent(c, { ...base, roll: 90, a0: 95, a1: -45, r: r - 0.2, w: w * 0.8, n: 10, delay: 6, sweep: 2, A: L.B, B: L.A, life: 0.3, sparks: 0 });
    after(7, () => { sl(c, "ring", v3(p.location.x + B.F.x * 2.2, p.location.y + 0.08, p.location.z + B.F.z * 2.2), { size: 1.4, grow: 3.4, col: L.A, life: 0.45, a: 0.9 }); });
  }
}

// ------------------------------------------------------------------ propriedade de animação do combo
const tok = new Map();
/** Liga a animação de golpe (1..5) e a desliga sozinha depois de `ticks`. */
export function setCombo(p, v, ticks = 11) {
  try { p.setProperty("etheria:combo", v); } catch { return; }   // BP antigo sem a propriedade
  const t = (tok.get(p.id) ?? 0) + 1; tok.set(p.id, t);
  if (tok.size > 500) tok.clear();
  system.runTimeout(() => { if (tok.get(p.id) !== t || !isValid(p)) return; try { p.setProperty("etheria:combo", 0); } catch { /* ignore */ } }, ticks);
}
export const comboOf = (p) => { try { return p.getProperty("etheria:combo") ?? 0; } catch { return 0; } };

// ------------------------------------------------------------------ imbuição: lâmina brilhando na mão
/** Mão e ponta estimadas pelo CORPO (3ª pessoa: braço ao lado, lâmina para a frente e para cima a ~35°). */
export function bladeLine(p, len = 1.05) {
  const B = basis(p.getViewDirection()); let y = 0.72; try { if (p.isSneaking) y -= 0.25; } catch { /* ignore */ }
  const hand = ad(ad(ad(p.location, B.R, 0.36), B.U, y), B.F, 0.22);
  return { hand, tip: ad(ad(hand, B.U, 0.57 * len), B.F, 0.82 * len), B };
}
/** Chamado a cada 2 ticks para quem segura arma infundida/elemental. strong = infusão gravada (mais brilho). */
export function imbueTick(c, p, A, B2, strong, n) {
  const { hand, tip } = bladeLine(p), at = (t) => v3(hand.x + (tip.x - hand.x) * t, hand.y + (tip.y - hand.y) * t, hand.z + (tip.z - hand.z) * t);
  for (let i = 0; i < (strong ? 3 : 2); i++) sl(c, "glow", at(0.25 + Math.random() * 0.75), { size: (strong ? 0.2 : 0.15) + Math.random() * 0.08, col: A, a: strong ? 0.7 : 0.5, life: 0.24, dir: [0, 1, 0], spd: 0.15, tile: 4 });
  if (n % 3 === 0) ribbon(c, at(0.18), tip, { w: strong ? 0.26 : 0.18, col: A, a: strong ? 0.42 : 0.28, life: 0.34, tile: 0 });
  if (strong && n % 3 === 1) ribbon(c, at(0.22), tip, { w: 0.07, col: "white", a: 0.55, life: 0.22, tile: 1 });
  if (n % 5 === 0) sl(c, "spark", at(0.4 + Math.random() * 0.6), { dir: [(Math.random() - 0.5) * 0.4, 1, (Math.random() - 0.5) * 0.4], spd: 1.1, drag: 0.8, sx: 0.035, sy: 0.15, col: B2, life: 0.5 });
}
/** Ritual ao infundir a espada: círculo no chão, espiral de energia entrando na lâmina e clarão final. */
export function imbueRitual(c, p, A, B2, circle = "arcane") {
  const at = p.location;
  disc(c, at, { col: A, circle: CIRCLE[circle] ?? 0, size: 3.2, life: 1.6, rot: 80 });
  for (let i = 0; i < 18; i++) {
    after(i, () => {
      if (!isValid(p)) return; const { hand, tip } = bladeLine(p), t = i / 18, a = t * Math.PI * 5, r = 1.6 * (1 - t);
      const tgt = v3(hand.x + (tip.x - hand.x) * 0.6, hand.y + (tip.y - hand.y) * 0.6, hand.z + (tip.z - hand.z) * 0.6);
      sl(c, "glow", v3(tgt.x + Math.cos(a) * r, tgt.y - 0.6 * (1 - t) + 0.2, tgt.z + Math.sin(a) * r), { size: 0.25, col: i % 2 ? A : B2, a: 0.9, life: 0.35, tile: 4 });
    });
  }
  after(19, () => {
    if (!isValid(p)) return; const { hand, tip } = bladeLine(p);
    ribbon(c, hand, tip, { w: 0.6, col: A, a: 0.9, life: 0.6, tile: 0 }); ribbon(c, hand, tip, { w: 0.16, col: "white", a: 1, life: 0.45, tile: 1 });
    sl(c, "flash", tip, { size: 1.1, col: "white", life: 0.3, rot: 45 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; sl(c, "spark", tip, { dir: [Math.cos(a), 0.4, Math.sin(a)], spd: 3, drag: 1.5, sx: 0.04, sy: 0.2, col: i % 2 ? A : B2, life: 0.4 }); }
    sl(c, "ring", v3(at.x, at.y + 0.08, at.z), { size: 1, grow: 3, col: A, life: 0.5 });
  });
}

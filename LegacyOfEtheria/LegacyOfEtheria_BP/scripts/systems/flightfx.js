// systems/flightfx.js - 6.58b: efeitos do VOO como no vídeo de referência 6.
//   decolagem: anéis de vento que se abrem em volta do jogador + círculo mágico sob os pés (todas as raças que voam)
//   linhagem Velzard (dragão de gelo): ASAS DE CRISTAL DE GELO desenhadas por partículas atrás dos ombros enquanto voa, batendo
//   conforme o estado do voo (pairar/subir batem, planar abre e fica quase parada). Passa pelo orçamento de partículas do fxlib.
import { ctx, mote, ringFlat, disc, after, nn, T, CIRCLE } from "./fxlib.js";
import { getData } from "../core/db.js";
import { lineageOf, formOfPlayer } from "../data/lineages.js";

export function takeoffFx(p) {
  try {
    const c = ctx(p, 1); if (c.k <= 0) return; const at = p.location;
    disc(c, at, { col: "wind", circle: CIRCLE.wind, size: 2.6, life: 0.8, rot: 120, grow: 0.5 });
    for (let i = 0; i < 3; i++) after(i * 2, () => ringFlat(c, { x: at.x, y: at.y + 0.4 + i * 0.5, z: at.z }, { col: i % 2 ? "white" : "wind", tile: T.ring, n: 20, radius: 2.4 + i * 0.8, start: 0.6, life: 0.45, size: 0.18 }));
  } catch { /* efeitos nunca derrubam o voo */ }
}
// contorno de uma asa (x para o lado, y para cima, a partir do meio das costas): lóbulo superior grande + inferior menor
const WING = [[0.25, 1.45], [0.7, 1.85], [1.25, 2.2], [1.75, 2.15], [1.95, 1.8], [1.7, 1.45], [1.25, 1.3], [0.7, 1.25],
  [0.9, 1.05], [1.35, 0.85], [1.45, 0.55], [1.1, 0.45], [0.6, 0.7], [0.3, 1.0]];
export const iceWings = (d) => lineageOf(d)?.id === "velzard" && formOfPlayer(d) === "base";   // na forma de dragão o modelo já tem asas
export function iceWingFx(p, mode, t) {
  try {
    const c = ctx(p, 1); if (c.k <= 0) return;
    const yaw = (p.getRotation().y * Math.PI) / 180, fx = -Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;   // frente e direita
    const flap = mode === 3 ? 0.08 * Math.sin(t * 0.4) : Math.sin(t * (mode === 2 ? 1.1 : 0.7)) * 0.45;              // ângulo de batida (rad)
    const L = p.location, back = 0.35;
    for (const sd of [1, -1]) for (let i = 0; i < WING.length; i++) {
      if ((i + t) % 2) continue;   // metade dos pontos por tick (alterna) -> leve no celular
      const [wx, wy] = WING[i], out = wx * Math.cos(flap), bk = back + wx * Math.sin(flap) * 0.9;
      const pos = { x: L.x + rx * out * sd - fx * bk, y: L.y + wy, z: L.z + rz * out * sd - fz * bk };
      mote(c, pos, { col: i % 3 ? "ice" : "white", tile: T.shard, size: 0.2, spd: 0, life: 0.22, grow: 0, a: 0.9 });
    }
  } catch { /* ignore */ }
}

// 9.4: ASAS DEMONÍACAS DE PENAS (Demônio, Lord Demônio e Anjo Caído): fumaça/bolhas pretas com fagulhas vermelhas saindo das asas ao
// decolar e a cada batida. Poucos disparos (o chamador limita a frequência por estado), contagem escalada pelo nível de FX do jogador.
function wingPts(p) {
  const yaw = (p.getRotation().y * Math.PI) / 180, fx = -Math.sin(yaw), fz = Math.cos(yaw);
  return { L: p.location, fx, fz, rx: -fz, rz: fx };
}
export function demonWingFx(p, mode) {
  try {
    const c = ctx(p, 1); if (c.k <= 0) return;
    const { L, fx, fz, rx, rz } = wingPts(p), n = nn(c, mode === 2 ? 2 : 1);
    for (const sd of [1, -1]) for (let i = 0; i < n; i++) {
      const out = 0.5 + Math.random() * 1.6, up = 1.0 + Math.random() * 1.1, bk = 0.35 + Math.random() * 0.4;
      const pos = { x: L.x + rx * out * sd - fx * bk, y: L.y + up, z: L.z + rz * out * sd - fz * bk };
      mote(c, pos, { col: "black", tile: T.smoke, size: 0.32 + Math.random() * 0.25, dir: [-fx * 0.3, -0.6, -fz * 0.3], spd: 0.6, drag: 1.2, life: 0.9, grow: 0.7, a: 0.85 });
    }
    if (Math.random() < 0.5 * c.k) {
      const sd = Math.random() < 0.5 ? 1 : -1, out = 0.3 + Math.random() * 0.6;
      mote(c, { x: L.x + rx * out * sd - fx * 0.4, y: L.y + 1.3 + Math.random() * 0.5, z: L.z + rz * out * sd - fz * 0.4 }, { col: "blood", tile: T.ember, size: 0.12, dir: [0, 1, 0], spd: 0.4, life: 0.6, grow: -0.6 });
    }
  } catch { /* efeitos nunca derrubam o voo */ }
}
export function demonTakeoffFx(p) {
  try {
    const c = ctx(p, 1); if (c.k <= 0) return;
    const { L, fx, fz, rx, rz } = wingPts(p), n = nn(c, 5);
    for (const sd of [1, -1]) for (let i = 0; i < n; i++) {
      const out = 0.4 + (i / n) * 2.0, up = 0.8 + Math.random() * 1.6;
      mote(c, { x: L.x + rx * out * sd - fx * 0.5, y: L.y + up, z: L.z + rz * out * sd - fz * 0.5 },
        { col: "black", tile: i % 3 ? T.smoke : T.bubble, size: 0.4 + Math.random() * 0.3, dir: [rx * sd, -0.4, rz * sd], spd: 1.4, drag: 1.6, life: 1.1, grow: 0.8, a: 0.9 });
    }
    for (let i = 0; i < nn(c, 4); i++) mote(c, { x: L.x - fx * 0.4, y: L.y + 1.4, z: L.z - fz * 0.4 },
      { col: "blood", tile: T.ember, size: 0.14, dir: [Math.random() - 0.5, 1, Math.random() - 0.5], spd: 2.2, drag: 1.5, life: 0.7, grow: -0.6 });
  } catch { /* ignore */ }
}

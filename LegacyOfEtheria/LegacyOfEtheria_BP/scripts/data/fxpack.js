// data/fxpack.js - Coreografia visual das habilidades do Skill Pack (Intrínsecas, Extras e Únicas).
// Cada habilidade tem uma combinação própria de padrões (cast + travel + impact), cores, sprite e círculo mágico.
// Tokens cast: D disco · I implosão · O órbita · H hélice · R anel · C coluna · B explosão · F leque · G glifos
// Tokens travel: T rastro · S traço · B raio · A arco · F leque · D duplo · K sucção (alvo->conjurador) · X dispersão · N nenhum · Z espiral
// Tokens impact: B explosão · R anel · C coluna · I implosão · D disco · X cruz · W chuva · P pilares · S choque · L lâminas
import { mote, streak, disc, burst, implode, ringFlat, column, fan, arc, bolt, helix, orbit, after, T, CIRCLE } from "../systems/fxlib.js";

const up = (p, y = 1) => ({ x: p.x, y: p.y + y, z: p.z });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

// [id, cast, travel, impact, corA, corB, sprite, círculo, rotação]
const ROWS = [
  ["absorb_dissolve", "D+I", "K", "I+B", "void", "sage", "bubble", "devour", -50],
  ["combustion", "R+B", "N", "S+C", "fire", "ember", "flame", "fire", 40],
  ["flame_breath", "B", "F", "B+R", "fire", "gold", "flame", "fire", 0],
  ["heat_sense", "R+G", "N", "R", "ember", "gold", "eye", "fire", 20],
  ["noxious_breath", "I", "F", "W", "toxic", "shadow", "smoke", "shadow", 0],
  ["paralyzing_breath", "O", "D", "X+R", "bolt", "frost", "zig", "bolt", 70],
  ["range_barrier", "D+O", "N", "R+D", "arcane", "violet", "diamond", "arcane", 15],
  ["thread_manip", "G", "X", "P", "white", "steel", "line", "wind", 30],
  ["thunder_breath", "I+C", "B", "C+B", "bolt", "white", "zig", "bolt", 100],
  ["ultrasonic", "R", "N", "S+R", "wind", "white", "ring", "wind", 0],
  ["vampirism", "B", "K", "I+C", "blood", "ember", "drop", "blood", 90],
  ["black_flame", "D+B", "T", "C+D", "shadow", "ember", "flame", "shadow", -30],
  ["black_lightning", "O+I", "B", "X", "black", "violet", "zig", "shadow", 120],
  ["black_thunder", "D+C", "N", "W+C", "black", "bolt", "zig", "shadow", -80],
  ["death_storm", "D+R+H", "N", "W+D", "void", "black", "skull", "void", 55],
  ["earth_manip", "D", "N", "P+B", "earth", "dust", "chunk", "earth", 0],
  ["fire_manip", "G+R", "N", "D+C", "fire", "gold", "ember", "fire", -20],
  ["gravity_manip", "D+I", "N", "I+D", "void", "violet", "orb", "gravity", 70],
  ["hellflame", "H+D", "A", "P+D", "ember", "fire", "flame", "fire", 160],
  ["hydro_propulsion", "R", "Z", "S", "water", "foam", "bubble", "water", 0],
  ["magic_improv", "G+O", "X", "X+B", "arcane", "gold", "rune1", "arcane", 200],
  ["magic_manip", "H+C", "N", "R", "mana", "arcane", "rune2", "arcane", -60],
  ["magic_sense", "G+R", "N", "I", "mana", "white", "eye", "arcane", 35],
  ["molecular_manip", "I", "D", "L", "white", "steel", "line", "space", 0],
  ["space_travel", "D+H", "Z", "D+I", "violet", "arcane", "star", "space", 160],
  ["water_blade", "B", "A", "L+R", "water", "frost", "drop", "water", 0],
  ["water_current", "D", "F", "R+W", "water", "foam", "bubble", "water", 120],
  ["water_manip", "H", "N", "W", "water", "foam", "drop", "water", 20],
  ["wind_manip", "R", "F", "B+S", "wind", "white", "cloud", "wind", 60],
  ["analyst", "G+D", "S", "X+I", "sage", "white", "eye", "sage", 30],
  ["berserker", "D+C+O", "N", "R", "blood", "ember", "flame", "blood", 140],
  ["degenerate", "D", "N", "I+W", "void", "toxic", "skull", "void", -40],
  ["dilettante", "G+H", "X", "B+R", "arcane", "pink", "note", "arcane", -120],
  ["envy", "I+G", "K", "I+X", "shadow", "toxic", "eye", "shadow", 10],
  ["generalissimo", "D+R+C", "N", "P+X", "gold", "white", "star", "holy", 25],
  ["artisan", "H+R", "N", "C+R", "holy", "green", "leaf", "holy", 10],
  ["gourmet", "I+B", "N", "R+B", "ember", "gold", "heart", "fire", 0],
  ["ambition", "C+O", "N", "S", "gold", "ember", "star", "holy", 70],
  ["healer", "D+H", "N", "C", "green", "holy", "cross", "holy", 0],
  ["master_physician", "H+C+R", "N", "R+C", "green", "white", "cross", "sage", 45],
  ["investigator", "O+R", "N", "X+R", "sage", "gold", "eye", "sage", -30],
  ["lionheart", "D+O", "N", "S+D", "gold", "ember", "diamond", "holy", 0],
  ["lust", "R+I", "K", "B+R", "pink", "blood", "heart", "blood", 20],
  ["maker", "G+D", "N", "P+C", "steel", "arcane", "gear", "arcane", 90],
  ["martial_master", "B", "A", "X+S", "white", "steel", "spark", "wind", 0],
  ["mathematician", "G+O+R", "N", "R", "mana", "sage", "rune3", "sage", 0],
  ["merciless", "I", "S", "X+B", "black", "blood", "claw", "shadow", 0],
  ["musician", "H+O", "X", "R+W", "gold", "pink", "note", "holy", 0],
  ["oppressor", "R+I+D", "N", "S+I", "void", "black", "skull", "void", -90],
  ["perceptor", "O", "N", "R+X", "light", "sage", "eye", "sage", 0],
  ["planner", "G+R", "N", "D", "mana", "gold", "rune2", "arcane", 0],
  ["pride", "C+D", "N", "R+B", "gold", "white", "star", "holy", 130],
  ["puppeteer", "G+F", "X", "P+R", "shadow", "white", "line", "shadow", 15],
  ["researcher", "O+G", "N", "I", "sage", "light", "rune1", "sage", 60],
  ["retaliator", "I+R", "N", "S+X", "steel", "blood", "chunk", "earth", 0],
  ["ruler", "D+C+H", "N", "C+D", "gold", "violet", "wing", "holy", -25],
  ["severer", "I", "S", "L+X", "white", "blood", "line", "wind", 0],
  ["dark_attacker", "B", "Z", "L+B", "black", "violet", "wing", "shadow", 0],
  ["sloth", "R+D", "N", "I+R", "void", "shadow", "cloud", "shadow", -10],
  ["spearhead", "I", "D", "X+C", "steel", "gold", "diamond", "wind", 0],
  ["starving", "I+D", "N", "I+S", "blood", "black", "fang", "devour", 180],
  ["survivor", "C+R", "N", "D+B", "green", "gold", "heart", "holy", 0],
  ["chosen_one", "C+H+D", "N", "C+P", "holy", "white", "star", "holy", 0],
  ["traveler", "R", "Z", "R+B", "wind", "violet", "star", "space", 100],
  ["usurper", "G+I", "K", "X+D", "void", "gold", "claw", "void", 45],
  ["fury", "B+C", "N", "S+B", "blood", "fire", "ember", "blood", -150],
  // ---- habilidades criadas a partir da planilha de ícones (cada uma com combinação própria de padrões, cores e sprite)
  ["beast_roar", "R+I", "N", "S+R", "earth", "dust", "claw", "earth", 0],
  ["blood_drain", "I+R", "K", "I+R", "blood", "pink", "drop", "blood", 30],
  ["ogre_flame", "B+R", "A", "C+B", "fire", "ember", "flame", "fire", 140],
  ["steel_body", "D+C", "N", "R+S", "steel", "white", "chunk", "earth", 0],
  ["thought_accel", "G+O+I", "N", "D+R", "mana", "sage", "rune3", "sage", 90],
  ["universal_perception", "O+R+G", "N", "R+X", "sage", "white", "eye", "sage", -45],
  ["wind_blade", "B", "A", "L+S", "wind", "white", "cloud", "wind", 20],
  ["disintegration", "I+G", "X", "I+L", "void", "white", "shard", "void", 80],
  ["blood_rain", "H+D", "N", "W+R", "blood", "ember", "drop", "blood", 10],
  ["haki", "R+C+O", "N", "S+R", "violet", "white", "star", "space", 60],
  ["dark_bolt", "D+I", "T", "B+R", "shadow", "violet", "orb", "shadow", -20],
  ["holy_lance", "I+C", "D", "X+C", "holy", "white", "star", "holy", 0],
  ["lion_roar_punch", "I+B", "S", "X+S", "gold", "white", "claw", "holy", 0],
  ["summon_demons", "D+G+C", "N", "P+B", "shadow", "ember", "skull", "devour", 90],
  ["orc_army", "D+R+B", "N", "P+R", "green", "steel", "fang", "earth", 0],
  ["megiddo", "I+C+D", "D", "X+C+R", "light", "gold", "star", "holy", 15],
  ["drago_nova", "D+I+R", "N", "S+B+D", "void", "ember", "flame", "fire", -70],
  ["storm_dragon", "O+I+C", "B", "C+B+S", "bolt", "white", "zig", "bolt", 100],
  ["world_end", "D+R+H", "N", "I+D+S", "black", "violet", "orb", "space", 30],
  ["beelzebuth", "D+I+G", "N", "I+D+B", "black", "violet", "fang", "devour", -120],
];

const cast = (tok, c, v, A, B, tile, circ, rot) => {
  for (const t of tok.split("+")) switch (t) {
    case "D": disc(c, v.pos, { col: A, circle: CIRCLE[circ] ?? 0, size: 2.4 + v.tier * 0.5, life: 0.9, rot }); break;
    case "I": implode(c, up(v.pos, 1.2), { col: B, tile: T[tile], n: 10, radius: 1.8, life: 0.45 }); break;
    case "O": orbit(c, () => up(v.pos, 1), { col: A, tile: T[tile], n: 3, r: 1, dur: 12, life: 0.35 }); break;
    case "H": helix(c, v.pos, { col: A, tile: T[tile], r: 0.9, h: 2.2, steps: 10, turns: 1.5 }); break;
    case "R": ringFlat(c, v.pos, { col: A, tile: T.ring, radius: 2.6, n: 14, life: 0.45, size: 0.5 }); break;
    case "C": column(c, v.pos, { col: A, tile: T[tile], n: 8, h: 3, life: 0.9, r: 0.6 }); break;
    case "B": burst(c, up(v.pos, 1.2), { col: B, tile: T[tile], n: 8, spd: 2, size: 0.3 }); break;
    case "F": burst(c, up(v.pos, 1.3), { col: A, tile: T[tile], n: 6, spd: 1, size: 0.3 }); break;
    case "G": ringFlat(c, v.pos, { col: A, tile: T.rune1 + (rot % 3 + 3) % 3, radius: 1.4, n: 8, life: 0.8, size: 0.35, lift: 0.5 }); break;
  }
};
const travel = (tok, c, v, A, B, tile) => {
  const n = Math.min(9, Math.max(2, Math.floor(len(v.from, v.to) / 2)));
  switch (tok) {
    case "T": for (let i = 1; i <= n; i++) after(i * 0.6, () => mote(c, lerp(v.from, v.to, i / n), { col: A, tile: T[tile], size: 0.32, life: 0.5, spd: 0.2, dir: [0, 0.3, 0] })); break;
    case "S": streak(c, v.from, v.to, { col: A, w: 0.2, life: 0.3 }); streak(c, v.from, v.to, { col: B, w: 0.07, life: 0.22 }); break;
    case "B": bolt(c, v.from, v.to, { col: A, branch: 0.4, jitter: 0.6 }); break;
    case "A": arc(c, v.pos, v.dir, { col: A, radius: 2.4, angle: 150, n: 7, tilt: 1, w: 0.2, life: 0.3, delay: 0.5 }); break;
    case "F": for (let i = 0; i < 3; i++) { const q = lerp(v.from, v.to, (i + 1) / 4); burst(c, q, { col: i % 2 ? B : A, tile: T[tile], n: 6, spd: 2.2, size: 0.45, life: 0.5 }); } break;
    case "D": for (const o of [-0.3, 0.3]) streak(c, { x: v.from.x + o, y: v.from.y, z: v.from.z }, { x: v.to.x + o, y: v.to.y, z: v.to.z }, { col: o < 0 ? A : B, w: 0.1, life: 0.3 }); break;
    case "K": for (let i = 1; i <= n; i++) after(i * 0.7, () => mote(c, lerp(v.to, v.from, i / n), { col: A, tile: T[tile], size: 0.25, life: 0.4, spd: 0.4, dir: [0, 0.2, 0] })); break;
    case "X": for (let i = 0; i < n + 3; i++) after(i * 0.5, () => mote(c, lerp(v.from, v.to, Math.random()), { col: i % 2 ? A : B, tile: T[tile], size: 0.3, life: 0.6, spd: 0.8, dir: [Math.random() - 0.5, Math.random(), Math.random() - 0.5] })); break;
    case "Z": for (let i = 1; i <= n + 3; i++) after(i * 0.5, () => { const a = i * 1.1, q = lerp(v.from, v.to, i / (n + 3)); mote(c, { x: q.x + Math.cos(a) * 0.7, y: q.y + 0.8 + Math.sin(a) * 0.5, z: q.z + Math.sin(a) * 0.7 }, { col: i % 2 ? A : B, tile: T[tile], size: 0.28, life: 0.5, spd: 0.1 }); }); break;
  }
};
const impact = (tok, c, v, A, B, tile, circ, rot) => {
  for (const t of tok.split("+")) switch (t) {
    case "B": burst(c, up(v.at, 0.8), { col: A, tile: T[tile], n: 12, spd: 3.5, size: 0.35, up: 0.6 }); break;
    case "R": ringFlat(c, v.at, { col: B, tile: T.ring, radius: 3 + v.tier * 0.4, n: 14, life: 0.45, size: 0.55 }); break;
    case "C": column(c, v.at, { col: A, tile: T[tile], n: 8, h: 3.5, life: 0.8, r: 0.7 }); break;
    case "I": implode(c, up(v.at, 1), { col: B, tile: T[tile], n: 10, radius: 2.2, life: 0.5 }); break;
    case "D": disc(c, v.at, { col: A, circle: CIRCLE[circ] ?? 0, size: 3.5 + v.tier, life: 1.4, rot: -rot }); break;
    case "X": mote(c, up(v.at, 1), { col: "white", tile: T.cross, size: 1.4, life: 0.2, grow: -1 }); burst(c, up(v.at, 1), { col: A, tile: T.spark, n: 8, spd: 5, size: 0.2, life: 0.3 }); break;
    case "W": for (let i = 0; i < 10; i++) after(i * 1.2, () => mote(c, { x: v.at.x + (Math.random() - 0.5) * 4, y: v.at.y + 4, z: v.at.z + (Math.random() - 0.5) * 4 }, { col: i % 2 ? A : B, tile: T[tile], size: 0.3, life: 0.5, dir: [0, -1, 0], spd: 7 })); break;
    case "P": for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; after(i, () => column(c, { x: v.at.x + Math.cos(a) * 1.8, y: v.at.y, z: v.at.z + Math.sin(a) * 1.8 }, { col: i % 2 ? A : B, tile: T[tile], n: 4, h: 2.5, life: 0.6, r: 0.25 })); } break;
    case "S": ringFlat(c, v.at, { col: A, tile: T.spark, radius: 5, n: 18, life: 0.35, size: 0.4, spd: 15 }); break;
    case "L": for (let i = 0; i < 3; i++) { const o = (i - 1) * 0.9; streak(c, { x: v.at.x - 1 + o * 0.3, y: v.at.y + 1.8 - i * 0.4, z: v.at.z + o }, { x: v.at.x + 1 + o * 0.3, y: v.at.y + 0.4 + i * 0.3, z: v.at.z - o }, { col: i % 2 ? B : A, w: 0.14, life: 0.25 }); } break;
  }
};

export const LOOK = {};
export const PACK_RECIPES = {};
for (const [id, c, t, i, A, B, tile, circ, rot] of ROWS) {
  LOOK[id] = { A, B, tile: T[tile], circle: CIRCLE[circ] ?? 0 };
  PACK_RECIPES[id] = {
    cast: (cx, v) => cast(c, cx, v, A, B, tile, circ, rot),
    travel: (cx, v) => travel(t, cx, v, A, B, tile),
    impact: (cx, v) => { impact(i, cx, v, A, B, tile, circ, rot); if (v.tier > 2) after(6, () => ringFlat(cx, v.at, { col: B, tile: T.star, radius: 4, n: 10, life: 0.5, size: 0.4 })); },
  };
}
export const FXPACK_SIGNATURES = ROWS.map((r) => `${r[1]}|${r[2]}|${r[3]}|${r[4]}|${r[5]}|${r[6]}`);
export const FXPACK_IDS = ROWS.map((r) => r[0]);

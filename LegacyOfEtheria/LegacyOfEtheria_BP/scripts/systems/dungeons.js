// systems/dungeons.js - 8.8 (Etapa 7b): MASMORRAS DOS CHEFES POR REGIÃO nascendo sozinhas ao explorar (como as vilas), uma por dimensão/terreno:
//   mundo normal (terra): Castelo Celestial (Anjo Guardião) e Masmorra do Rei Goblin · oceano fundo: Santuário Submerso (Guardiã Cristalina)
//   Inferno: Fortaleza Sombria (Anjo Caído) · End (ilhas externas): Santuário do Vazio (Rainha do Vazio).
// Estruturas e dados: tools/dungeons.py -> structures/etheria/dg_*.mcstructure + data/dungeons.gen.js (registradas no WGEN de worldgen.js,
// que coloca o arquivo de uma vez, enche os baús pela loot table e gera chefe + guardas). Aqui só se escolhe o LOCAL.
// Leve: 1 verificação a cada 30 s, só para ~30% dos jogadores, no máximo 1 masmorra por célula de 512x512 por dimensão, poucas leituras de bloco.
import { world, system } from "@minecraft/server";
import { WGEN, placeWgen, checkSite, conflict, wgRecords } from "./worldgen.js";
import { say, toast } from "../core/utils.js";

const SEEN = "etheria:dgseen", CELL = 512, TICK = 600, MAX_EACH = 12;
const DIMKIND = { "minecraft:overworld": "overworld", "minecraft:nether": "nether", "minecraft:the_end": "end" };
const rd = () => { try { const r = JSON.parse(world.getDynamicProperty(SEEN) ?? "{}"); return r && typeof r === "object" ? r : {}; } catch { return {}; } };
const wr = (v) => { try { world.setDynamicProperty(SEEN, JSON.stringify(v)); } catch { /* ignore */ } };
const blockAt = (dim, x, y, z) => { try { return dim.getBlock({ x, y, z }); } catch { return undefined; } };
const top = (dim, x, z) => { try { return dim.getTopmostBlock({ x, z }); } catch { return undefined; } };
const SOFT = /water|seagrass|kelp|bubble|coral_fan|sea_pickle/;
const dgKeys = (where) => Object.keys(WGEN).filter((k) => WGEN[k].dg === where);
const count = (k) => wgRecords().filter((r) => r.k === k).length;

/** oceano: superfície de água e fundo a pelo menos (altura da estrutura + 1) blocos; fundo quase plano */
export function oceanSite(dim, x, z, key) {
  const def = WGEN[key], need = def.size[1] - def.floor + 1, ys = [];
  for (const [dx, dz] of [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12]]) {
    const t = top(dim, x + dx, z + dz); if (!t) return { ok: false, why: "chunk não carregado" };
    if (!/water/.test(t.typeId)) return { ok: false, why: "não é oceano" };
    let y = t.location.y, b = t, n = 0;
    while (b && SOFT.test(b.typeId) && n++ < 80) { y--; b = blockAt(dim, x + dx, y, z + dz); }
    if (!b) return { ok: false, why: "fundo não encontrado" };
    if (t.location.y - y < need) return { ok: false, why: "raso demais" };
    ys.push(y);
  }
  if (Math.max(...ys) - Math.min(...ys) > def.flat) return { ok: false, why: "fundo irregular" };
  return { ok: true, y: ys[0] };
}
/** Inferno: chão de caverna (sólido, sem lava) com espaço livre acima, perto da altura do jogador; os cantos com chão parecido */
function caveFloor(dim, x, z, y0, y1) {
  let air = 0;
  for (let y = y1; y >= y0; y--) {
    const b = blockAt(dim, x, y, z); if (!b) return undefined;
    if (b.isAir) { air++; continue; }
    if (air >= 6 && !b.isLiquid && !/lava|fire|magma/.test(b.typeId)) return y;
    air = 0;
  }
  return undefined;
}
export function netherSite(dim, x, z, py) {
  const y0 = Math.max(32, Math.round(py) - 24), y1 = Math.min(108, Math.round(py) + 24);
  const yc = caveFloor(dim, x, z, y0, y1); if (yc === undefined) return { ok: false, why: "sem chão de caverna" };
  let good = 0;
  for (const [dx, dz] of [[14, 14], [-14, 14], [14, -14], [-14, -14]]) { const y = caveFloor(dim, x + dx, z + dz, yc - 8, yc + 8); if (y !== undefined) good++; }
  return good >= 2 ? { ok: true, y: yc } : { ok: false, why: "caverna pequena" };
}
/** End: só nas ilhas externas (longe da ilha central e do dragão), sobre pedra do End */
export function endSite(dim, x, z) {
  if (Math.hypot(x, z) < 500) return { ok: false, why: "perto da ilha central" };
  const t = top(dim, x, z); if (!t) return { ok: false, why: "chunk não carregado" };
  return /end_stone/.test(t.typeId) ? { ok: true, y: t.location.y } : { ok: false, why: "sem ilha" };
}

function pick(keys) { const t = keys.reduce((s, k) => s + (WGEN[k].w || 1), 0); let r = Math.random() * t; for (const k of keys) { r -= WGEN[k].w || 1; if (r <= 0) return k; } return keys[0]; }

/** tenta achar um local e colocar uma masmorra perto do jogador; true se começou a colocar */
export function tryDungeon(p) {
  const dim = p.dimension, kind = DIMKIND[dim.id]; if (!kind) return false;
  const l = p.location;
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * 6.283, d = 64 + Math.random() * 48, x = Math.floor(l.x + Math.cos(a) * d), z = Math.floor(l.z + Math.sin(a) * d);
    let key, site;
    if (kind === "overworld") {
      const t = top(dim, x, z); if (!t) continue;
      if (/water/.test(t.typeId)) { key = dgKeys("ocean").find((k) => count(k) < MAX_EACH); if (key) site = oceanSite(dim, x, z, key); }
      else { const ks = dgKeys("land").filter((k) => count(k) < MAX_EACH); if (ks.length) { key = pick(ks); if (!conflict(dim, x, z, key)) site = checkSite(dim, x, z, key); } }
    } else {
      key = dgKeys(kind).find((k) => count(k) < MAX_EACH); if (!key) return false;
      site = kind === "nether" ? netherSite(dim, x, z, l.y) : endSite(dim, x, z);
    }
    if (!key || !site?.ok || conflict(dim, x, z, key)) continue;
    const name = WGEN[key].name;
    placeWgen(dim, key, { x, y: site.y, z }, (res) => {
      if (!res.ok) return;
      say(p, `§6[Etheria] §fUma presença poderosa desperta: §e${name}§7 (${Math.round(res.center.x)}, ${Math.round(res.center.y)}, ${Math.round(res.center.z)})`);
      try { toast(p, "§6Masmorra descoberta", `§7${name}`); } catch { /* ignore */ }
    });
    return true;
  }
  return false;
}

export function startDungeons() {
  system.runInterval(() => {
    try {
      let seen = null;
      for (const p of world.getAllPlayers()) {
        if (!DIMKIND[p.dimension.id] || Math.random() > 0.3) continue;
        seen ??= rd();
        const k = `${p.dimension.id.slice(10, 12)}${Math.floor(p.location.x / CELL)},${Math.floor(p.location.z / CELL)}`, n = seen[k] ?? 0;
        if (n >= 100) continue;
        if (tryDungeon(p)) { seen[k] = 100; wr(seen); } else { seen[k] = n + 1; if (n % 4 === 0) wr(seen); }
      }
    } catch (e) { console.warn(`[Etheria] masmorras: ${e}`); }
  }, TICK);
}

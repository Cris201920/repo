// systems/structcmd.js - GERAÇÃO INSTANTÂNEA de qualquer estrutura do addon (6.29), sem depender de exploração, bioma ou sorte.
// !gerar                -> menu (celular) com todas as estruturas por categoria
// !gerar <nome> [forcar] -> coloca na hora, à frente do jogador, apoiada no chão real (nada dentro do solo ou flutuando)
//   ex.: !gerar tempest | !gerar guy (Domínio de Guy Crimson) | !gerar arena guy_crimson | !gerar milim_reino | !gerar octagrama
// Também por /scriptevent etheria:cmd gerar <nome>. Permissão: core/perm.js (6.40: só no modo criativo).
import { system } from "@minecraft/server";
import { say } from "../core/utils.js";
import { canBuild, canSpawnStructures, CREATIVE_ONLY } from "../core/perm.js";
import { WGEN, wgKeys, placeWgen, groundAt, findWgen } from "./worldgen.js";
import { ARENAS, arenaKeys, placeArena } from "./arenas.js";
import { WORLD } from "../data/arenas.gen.js";
import { STRUCTURES } from "../data/structures.gen.js";
import { placeStructure } from "./structures.js";
import { buildTempestAt } from "./tempest.js";
import { ensureOctagrama } from "./octagrama.js";
import { menu } from "./ui/forms.js";

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^etheria:/, "").replace(/[\s-]+/g, "_");
const ALIAS = { guy: "wg:guy_dominio", guy_crimson: "wg:guy_dominio", dominio_guy: "wg:guy_dominio", milim: "wg:milim_reino", luminus: "wg:luminus_reino",
  veldora: "wg:veldora_caverna", veldanava: "wg:veldanava_dominio", lagartos: "wg:lagarto_reino", ogros: "wg:ogros_vila", goblins: "wg:goblin_acampamento", taratect: "wg:ninho_taratect" };

/** todas as entradas geráveis: {ref, name, kind} */
export function allStructures() {
  const out = [{ ref: "tempest", name: "Cidade de Tempest (512x512)", kind: "Cidade" }];
  for (const k of wgKeys()) out.push({ ref: `wg:${k}`, name: WGEN[k].name, kind: WGEN[k].realm ? "Reino/Portal" : "Mundo" });
  for (const k of arenaKeys()) out.push({ ref: `arena:${k}`, name: `${ARENAS[k].name} (arena de ${k})`, kind: "Arena de boss" });
  for (const k of Object.keys(WORLD)) if (STRUCTURES[k]) out.push({ ref: `world:${k}`, name: STRUCTURES[k].name, kind: "Clássica" });
  return out;
}
/** resolve o texto do jogador para uma ou mais entradas */
export function resolve(args) {
  const words = args.map(norm).filter((w) => w && w !== "forcar" && w !== "force");
  if (!words.length) return [];
  const wantArena = words[0] === "arena"; const q = (wantArena ? words.slice(1) : words).join("_");
  const all = allStructures();
  if (!q) return wantArena ? all.filter((e) => e.ref.startsWith("arena:")) : [];
  if (!wantArena && ALIAS[q]) return all.filter((e) => e.ref === ALIAS[q]);
  const exact = all.filter((e) => e.ref.split(":").pop() === q || e.ref.split(":").pop() === q.replace(/^(arena|wg|world)_/, ""));
  const pool = (wantArena ? all.filter((e) => e.ref.startsWith("arena:")) : all);
  const ex = exact.filter((e) => pool.includes(e));
  if (ex.length) return ex.length > 1 && !wantArena ? ex.filter((e) => !e.ref.startsWith("arena:")).concat(ex.filter((e) => e.ref.startsWith("arena:"))).slice(0, 1) : ex.slice(0, 1);
  return pool.filter((e) => e.ref.includes(q) || norm(e.name).includes(q));
}

function ahead(p, dist) {
  let d = { x: 0, z: 1 };
  try { const v = p.getViewDirection(); const n = Math.hypot(v.x, v.z) || 1; d = { x: v.x / n, z: v.z / n }; } catch { /* ignore */ }
  const x = Math.floor(p.location.x + d.x * dist), z = Math.floor(p.location.z + d.z * dist);
  // chão real no centro (ignora folhas/plantas); se o chunk ainda não carregou, usa a altura dos pés do jogador
  let y = Math.floor(p.location.y) - 1;
  const g = groundAt(p.dimension, x, z);
  if (g && !g.isLiquid) y = g.location.y; else if (g?.isLiquid) y = g.location.y;
  return { x, y, z };
}

/** coloca uma entrada já resolvida */
export function generate(p, entry, force = false) {
  const [kind, key] = entry.ref.includes(":") ? entry.ref.split(":") : [entry.ref, entry.ref];
  const dim = p.dimension, t0 = system.currentTick;
  const took = () => `${((system.currentTick - t0) / 20).toFixed(1)} s`;
  if (kind === "tempest") return buildTempestAt(p);
  if (kind === "wg") {
    const def = WGEN[key];
    if (key === "octagrama") { say(p, "§6[Etheria] §7Gerando o Octagrama..."); return ensureOctagrama((r) => say(p, r.ok ? `§a[Etheria] Octagrama ${r.reused ? "já existia (reaproveitado)" : "gerado"}. Entrada: ${Math.floor(r.entry.x)}, ${Math.floor(r.entry.y)}, ${Math.floor(r.entry.z)}` : `§c[Etheria] Octagrama: ${r.err}`)); }
    const a = ahead(p, Math.max(def.size[0], def.size[2]) / 2 + 6);
    const old = findWgen(dim, key, a.x, a.z);
    if (old && !force) return say(p, `§e[Etheria] ${def.name} já existe aqui perto (${old.x}, ${old.z}). Use §f!gerar ${key} forcar§e para colocar outra.`);
    say(p, `§6[Etheria] §7Gerando §f${def.name}§7...`);
    return placeWgen(dim, key, a, (r) => say(p, r.ok
      ? `§a[Etheria] ${def.name} gerada em ${took()} §7(${r.center.x}, ${r.center.y}, ${r.center.z}) · baús: ${r.chests} · mobs: ${r.mobs}`
      : `§c[Etheria] ${def.name} não foi gerada: ${r.err}`), { noMobs: !!def.realm });
  }
  if (kind === "arena") {
    const reg = ARENAS[key], a = ahead(p, Math.max(reg.size[0], reg.size[2]) / 2 + 4);
    say(p, `§6[Etheria] §7Gerando §f${reg.name}§7...`);
    return placeArena(dim, key, a, (r) => say(p, r.ok
      ? `§a[Etheria] ${reg.name} ${r.reused ? "já existia aqui (reaproveitada)" : `gerada em ${took()}`} §7(${Math.floor(r.center.x)}, ${Math.floor(r.center.y)}, ${Math.floor(r.center.z)})`
      : `§c[Etheria] ${reg.name} não foi gerada: ${r.err}`));
  }
  if (kind === "world") {
    const w = WORLD[key], s = STRUCTURES[key], a = ahead(p, Math.max(w.size[0], w.size[2]) / 2 + 6);
    const ok = placeStructure(dim, { x: a.x - (w.size[0] >> 1), y: a.y - 1, z: a.z - (w.size[2] >> 1) }, key, () => say(p, `§a[Etheria] ${s.name} gerada em ${took()} §7(${a.x}, ${a.y}, ${a.z})`));
    return say(p, ok ? `§6[Etheria] §7Gerando §f${s.name}§7...` : "§7Essa estrutura já está sendo gerada.");
  }
}

function openMenu(p, kind) {
  if (!canSpawnStructures(p)) return say(p, CREATIVE_ONLY);
  const all = allStructures();
  if (!kind) {
    const kinds = [...new Set(all.map((e) => e.kind))];
    return menu(p, "§l§6GERAR ESTRUTURA", "§7Colocação instantânea à sua frente, apoiada no chão.", kinds.map((k) => ({ text: `§l${k}\n§r§7${all.filter((e) => e.kind === k).length} estruturas`, run: () => openMenu(p, k) })));
  }
  const list = all.filter((e) => e.kind === kind);
  menu(p, `§l§6${kind.toUpperCase()}`, "§7Escolha a estrutura:", [...list.map((e) => ({ text: e.name, run: () => generate(p, e) })), { text: "§7« Voltar", run: () => openMenu(p) }]);
}
export const openStructMenu = (p) => openMenu(p);

/** !gerar [nome] [forcar] */
export function structCmd(p, args, trusted = false) {
  if (!canSpawnStructures(p)) return say(p, CREATIVE_ONLY);   // 6.40: só no criativo, por qualquer rota
  if (!args.length || norm(args[0]) === "lista" || norm(args[0]) === "menu") return openMenu(p);
  const force = args.some((a) => ["forcar", "force"].includes(norm(a)));
  const r = resolve(args);
  if (!r.length) return say(p, `§c[Etheria] Estrutura "${args.join(" ")}" não existe. §7Use §f!gerar§7 (menu) ou um destes: §ftempest, guy, ${wgKeys().slice(0, 8).join(", ")}...`);
  if (r.length > 1) return menu(p, "§l§6QUAL ESTRUTURA?", `§7"${args.join(" ")}" combina com várias:`, r.slice(0, 20).map((e) => ({ text: e.name, run: () => generate(p, e, force) })));
  generate(p, r[0], force);
}

// systems/bossreg.js - REGISTRO CENTRAL DE BOSSES: para cada boss/lendário/especial do addon, entidade, local próprio e método(s) de aparição, com auditoria automática.
// Métodos: arena (estrutura exclusiva, colocada na hora ao invocar), octagrama (cerimonial no salão dos Lordes), errante (sorteio garantido a cada 3-6 min por jogador),
// forma (transformação de outro boss, nasce junto do original), sigilo (item de invocação), admin (!boss <id>, vale para todos).
import { MOBS } from "../data/mobs.gen.js";
import { ARENAS } from "../data/arenas.gen.js";
import { WGEN } from "../data/wgen.gen.js";
import { bossPoolIds } from "./bossspawn.js";
import { say } from "../core/utils.js";
import { COUNCIL, REALMS } from "./realms.js";
import { RESIDENTS } from "./residents.js";
import { CORE_ID } from "./charybdis.js";

const FORM = /(_angel|_royal_beast|_\d)$/;
export const BOSS_RARITIES = ["boss", "legendary", "special"];
export const bossIds = () => Object.entries(MOBS).filter(([, m]) => BOSS_RARITIES.includes(m.rar)).map(([id]) => id.replace(/^etheria:/, ""));

export function bossEntry(id) {
  const m = MOBS["etheria:" + id], methods = [], where = [];
  if (!m) return { id, ok: false, methods, where, why: "entidade ausente em MOBS" };
  const arena = Object.entries(ARENAS).find(([, a]) => a.entity === id);
  if (arena) { methods.push("arena"); where.push(`${arena[1].name} (${arena[1].id})`); }
  const oct = (WGEN.octagrama?.lords ?? []).find((l) => l[0] === id);
  if (oct) { methods.push("octagrama"); where.push(`Octagrama: trono/posto (${oct[1]}, ${oct[2]}, ${oct[3]})`); }
  for (const [rid, R] of Object.entries(REALMS)) {            // 6.27: moradores-boss dos reinos (Inferno / Céu de Veldanava / Reino dos Espíritos)
    const l = (WGEN[R.key]?.lords ?? []).find((x) => x[0] === id);
    if (l) { methods.push("reino"); where.push(`${R.name}: altar/posto (${l[1]}, ${l[2]}, ${l[3]}) — comando !${rid}`); }
  }
  if (COUNCIL.includes(id)) { methods.push("conselho"); where.push("Conselho de Tempest: junto ao ponto de entrada da Cidade de Tempest (!tempest)"); }
  for (const [wk, w] of Object.entries(WGEN)) {                // estruturas errantes com o boss dentro (ex.: Ninho Taratect)
    if (!w.manual && (w.mobs ?? []).some((m) => m[0] === "etheria:" + id)) { methods.push("estrutura"); where.push(`${w.name} (${wk}) — gerada pelo mundo`); }
  }
  for (const [sk, list] of Object.entries(RESIDENTS)) if (list.some((r) => r[0] === "etheria:" + id)) { methods.push("morador"); where.push(`morador fixo da estrutura ${sk}`); }   // 6.55
  if (id === "tt_charybdis") { methods.push("núcleo"); where.push(`Núcleo de Caríbdis (${CORE_ID}): carregue com abates e invoque`); }
  if (bossPoolIds().includes(id)) methods.push("errante");
  if (FORM.test(id) && MOBS["etheria:" + id.replace(FORM, "")]) { methods.push("forma"); where.push(`transformação de ${id.replace(FORM, "")}`); }
  methods.push("admin");
  const real = methods.filter((x) => x !== "admin");
  return { id, name: m.name, rar: m.rar, ok: real.length > 0, methods, where, why: real.length ? "" : "sem método de aparição (só admin)" };
}
export function auditBosses() { return bossIds().map(bossEntry); }

export function auditCmd(p) {
  const rows = auditBosses(), bad = rows.filter((r) => !r.ok), noPlace = rows.filter((r) => r.ok && !r.where.length);
  say(p, `§6[Etheria] §7Bosses: §f${rows.length}§7 | com método de aparição: §a${rows.length - bad.length}§7 | sem: §c${bad.length}${bad.length ? " (" + bad.map((b) => b.id).join(", ") + ")" : ""}§7 | sem estrutura própria (errantes): §f${noPlace.length}§7.`);
}

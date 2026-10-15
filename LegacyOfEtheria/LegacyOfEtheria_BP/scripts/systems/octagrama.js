// systems/octagrama.js - O OCTAGRAMA: salão dos Lordes Demônios (estrutura data/wgen.gen.js -> "octagrama"). Uma ÚNICA instância no mundo (posição salva), colocação instantânea,
// e os 8 Lordes + 5 Primordiais realmente INVOCADOS nos seus tronos (lista em WGEN.octagrama.lords). Regras:
//  - sem duplicar: antes de nascer, procura entidade com a tag do integrante; sobras são removidas;
//  - sem ressurreição automática: morreu => fica registrado (etheria:oct.dead); só `!octagrama reset` (admin) os traz de volta;
//  - ao voltar à região (jogador a <150 blocos), quem nunca morreu e sumiu (descarregado/limpo) é reposto uma vez;
//  - cerimonial: nascem "parados" (tag etheria_oct_idle: presos ao trono, sem habilidades) até serem atacados; depois lutam normalmente.
import { world, system } from "@minecraft/server";
import { WGEN, placeWgen } from "./worldgen.js";
import { withLoaded } from "./arenas.js";
import { MOBS } from "../data/mobs.gen.js";
import { say, isValid } from "../core/utils.js";
import { ADMIN_TAG } from "../config.js";

const KEY = "etheria:oct", TAG = "etheria_oct", IDLE = "etheria_oct_idle", AT = { x: 4200, z: 4200 };
export const OCT_ID = "octagrama";
const rd = () => { try { return JSON.parse(world.getDynamicProperty(KEY) ?? "null"); } catch { return null; } };
const wr = (s) => { try { world.setDynamicProperty(KEY, JSON.stringify(s)); } catch { /* ignore */ } };
export const octState = () => rd();
export const octLords = () => WGEN[OCT_ID]?.lords ?? [];
const dimOf = (s) => world.getDimension(s?.d ?? "minecraft:overworld");
const home = (s, l) => ({ x: s.x + l[1] + 0.5, y: s.y + l[2], z: s.z + l[3] + 0.5 });
const nameOf = (id) => MOBS["etheria:" + id]?.name ?? id;
const tagOf = (id) => `${TAG}_${id}`;

function residents(dim, id) { try { return dim.getEntities({ tags: [tagOf(id)] }).filter(isValid); } catch { return []; } }

/** invoca os integrantes que faltam (nunca os que já existem ou morreram). Devolve {spawned, present, dead, failed} */
export function ensureResidents(s) {
  const dim = dimOf(s), out = { spawned: [], present: [], dead: [], failed: [] };
  s.dead ??= {}; s.spawned ??= {};
  for (const l of octLords()) {
    const id = l[0], list = residents(dim, id);
    if (list.length > 1) for (const extra of list.slice(1)) { try { extra.remove(); } catch { /* ignore */ } }   // sem cópias
    if (list.length) { out.present.push(id); continue; }
    if (s.dead[id]) { out.dead.push(id); continue; }
    try {
      const p = home(s, l), e = dim.spawnEntity("etheria:" + id, p);
      e.addTag(TAG); e.addTag(tagOf(id)); e.addTag(IDLE); try { e.nameTag = nameOf(id); } catch { /* ignore */ }
      try { e.setDynamicProperty?.("oct_home", JSON.stringify(p)); } catch { /* ignore */ }
      s.spawned[id] = true; out.spawned.push(id);
    } catch (e) { out.failed.push(`${id}: ${e}`); }
  }
  wr(s);
  if (out.failed.length) console.warn(`[Etheria] Octagrama: falhou ${out.failed.join("; ")}`);
  return out;
}

/** gera (ou reaproveita) o Octagrama e invoca os integrantes. cb({ok, reused, entry, residents}) é sempre chamado. */
export function ensureOctagrama(cb) {
  const dim = world.getDimension("minecraft:overworld"); let s = rd();
  const finish = (r) => { try { cb?.(r); } catch (e) { console.warn(`[Etheria] octagrama cb: ${e}`); } };
  const def = WGEN[OCT_ID]; if (!def) return finish({ ok: false, err: "estrutura octagrama não registrada" });
  if (s?.built) {
    const f = (() => { try { return dim.getBlock({ x: s.x + (def.size[0] >> 1), y: s.y + def.floor, z: s.z + (def.size[2] >> 1) }); } catch { return undefined; } })();
    if (f && f.typeId !== "minecraft:air") { const r = ensureResidents(s); return finish({ ok: true, reused: true, entry: entryOf(s), residents: r }); }
    if (!f) { return withLoaded(dim, s.x, s.z, def.size, (ok) => finish(ok ? (() => { const r = ensureResidents(s); return { ok: true, reused: true, entry: entryOf(s), residents: r }; })() : { ok: false, err: "chunks não carregados" })); }
    s.built = false;                                    // foi destruído: gera de novo
  }
  const sx = AT.x, sz = AT.z;
  withLoaded(dim, sx - 8, sz - 8, [16, 4, 16], (ok) => {
    if (!ok) return finish({ ok: false, err: "chunks não carregados" });
    let y = 64; try { y = dim.getTopmostBlockHeight({ x: sx, z: sz }); } catch { /* ignore */ }
    placeWgen(dim, OCT_ID, { x: sx, y, z: sz }, (res) => {
      if (!res.ok) return finish({ ok: false, err: res.err });
      s = { built: true, d: dim.id, x: res.at.x, y: res.at.y, z: res.at.z, spawned: {}, dead: {} };
      const r = ensureResidents(s); finish({ ok: true, reused: false, entry: entryOf(s), residents: r });
    }, { noMobs: true });
  });
}
const entryOf = (s) => { const d = WGEN[OCT_ID]; return { x: s.x + d.entry[0] + 0.5, y: s.y + d.entry[1], z: s.z + d.entry[2] + 0.5 }; };

/** !octagrama [ir|gerar|reset|status] */
export function octCmd(p, args) {
  const q = (args[0] ?? "ir").toLowerCase(), admin = p.hasTag(ADMIN_TAG);
  if (q === "status") {
    const s = rd(); if (!s?.built) return say(p, "§7[Octagrama] ainda não foi gerado. Use §f!octagrama§7.");
    const live = octLords().filter((l) => residents(dimOf(s), l[0]).length).map((l) => nameOf(l[0]));
    return say(p, `§5[Octagrama] §7em (${s.x}, ${s.y}, ${s.z}). Presentes: §f${live.join(", ") || "nenhum"}§7. Derrotados: §c${Object.keys(s.dead ?? {}).map(nameOf).join(", ") || "nenhum"}§7.`);
  }
  if (q === "reset") {
    if (!admin) return say(p, "§cSem permissão.");
    const s = rd(); if (!s?.built) return say(p, "§7Nada para repor."); s.dead = {}; wr(s); const r = ensureResidents(s);
    return say(p, `§5[Octagrama] §7repostos: §f${r.spawned.map(nameOf).join(", ") || "nenhum"}§7.`);
  }
  say(p, "§5[Octagrama] §7Abrindo o salão dos Lordes Demônios...");
  ensureOctagrama((res) => {
    if (!res.ok) return say(p, `§c[Octagrama] falhou: ${res.err}`);
    const e = res.entry;
    try { p.teleport({ x: e.x, y: e.y, z: e.z }, { dimension: world.getDimension("minecraft:overworld"), rotation: { x: 0, y: 180 }, keepVelocity: false }); } catch (er) { return say(p, `§c[Octagrama] não consegui teleportar: ${er}`); }
    const r = res.residents;
    say(p, `§5§l[Octagrama] §r§7${res.reused ? "salão já existia (reaproveitado)" : "salão gerado instantaneamente"}. Presentes: §f${r.present.length + r.spawned.length}§7 | invocados agora: §f${r.spawned.length}§7${r.dead.length ? ` | derrotados: §c${r.dead.length}` : ""}${r.failed.length ? ` | §cfalhas: ${r.failed.length}` : ""}§7. Os Lordes ficam em seus tronos até serem atacados.`);
  });
}

export function startOctagrama() {
  // cerimonial: preso ao trono, sem se mover até ser provocado
  system.runInterval(() => {
    try {
      const s = rd(); if (!s?.built) return;
      const dim = dimOf(s);
      for (const e of dim.getEntities({ tags: [IDLE] })) {
        if (!isValid(e)) continue;
        const id = (e.getTags().find((t) => t.startsWith(TAG + "_") && t !== IDLE) ?? "").slice(TAG.length + 1), l = octLords().find((x) => x[0] === id); if (!l) continue;
        const h = home(s, l), dx = e.location.x - h.x, dz = e.location.z - h.z, dy = e.location.y - h.y;
        if (dx * dx + dz * dz > 2.25 || Math.abs(dy) > 2) { try { e.teleport(h); } catch { /* ignore */ } }
        try { e.clearVelocity(); e.addEffect("slowness", 40, { amplifier: 250, showParticles: false }); } catch { /* ignore */ }
      }
    } catch (er) { console.warn(`[Etheria] octagrama hold: ${er}`); }
  }, 10);
  // provocado -> luta de verdade
  world.afterEvents.entityHurt.subscribe((ev) => {
    try {
      const e = ev.hurtEntity; if (!e?.hasTag?.(IDLE) || e.hasTag("etheria_calm")) return;   // 6.43: Conselho calmo só luta por desafio
      e.removeTag(IDLE); try { e.removeEffect("slowness"); } catch { /* ignore */ }
      const by = ev.damageSource?.damagingEntity; if (by?.typeId === "minecraft:player") say(by, `§c§l[Octagrama] §r§7${e.nameTag || "O Lorde"} foi provocado e luta!`);
    } catch { /* ignore */ }
  });
  // morte registrada: sem ressurreição automática
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const e = ev.deadEntity; if (!e?.hasTag?.(TAG)) return;
      const id = (e.getTags().find((t) => t.startsWith(TAG + "_") && t !== IDLE) ?? "").slice(TAG.length + 1), s = rd(); if (!s || !id) return;
      s.dead ??= {}; s.dead[id] = true; wr(s);
    } catch { /* ignore */ }
  });
  // manutenção ao voltar à região: repõe quem sumiu sem morrer; remove cópias
  system.runInterval(() => {
    try {
      const s = rd(); if (!s?.built) return; const d = WGEN[OCT_ID]; if (!d) return;
      const cx = s.x + (d.size[0] >> 1), cz = s.z + (d.size[2] >> 1);
      if (!world.getAllPlayers().some((p) => p.dimension.id === s.d && Math.hypot(p.location.x - cx, p.location.z - cz) < 150)) return;
      ensureResidents(s);
    } catch (er) { console.warn(`[Etheria] octagrama manutenção: ${er}`); }
  }, 600);
}

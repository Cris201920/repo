// systems/realms.js - OS TRÊS REINOS (6.27): Inferno, Céu de Veldanava e Reino dos Espíritos + Conselho de Tempest.
// Dimensões personalizadas não existem em addons Bedrock: cada reino é uma estrutura-ilha enorme (data/wgen.gen.js: inferno, ceu_veldanava, espiritos) colocada longe de tudo
// em uma dimensão REAL (Inferno = Nether, Céu = Overworld em altitude, Espíritos = End). Aqui: colocação única (posição salva), portais perto do spawn (3 estruturas), portais de retorno
// dentro dos reinos, comandos, ponto de chegada seguro, rede de segurança contra queda, população (espíritos/diabretes/guardiões) e moradores-boss (Constelações etc.) cerimoniais:
//  - sem duplicar (tag por morador), sem ressurreição automática (registro de mortes), repostos só se sumirem sem morrer; ficam parados até serem atacados.
// O Conselho de Tempest (Rimuru Tempest, Benimaru, Shion) mora na própria Tempest (tempestSpawn) — a cidade NÃO é duplicada nem alterada.
// Início do Demônio: escolher a raça Demônio (primeira escolha) leva o jogador ao Inferno uma única vez (demonStart). Outras raças não são afetadas.
import { world, system } from "@minecraft/server";
import { WGEN, placeWgen, checkSite, wgKeys } from "./worldgen.js";
import { withLoaded } from "./arenas.js";
import { tempestInfo, tempestSpawn } from "./tempest.js";
import { MOBS } from "../data/mobs.gen.js";
import { say, toast, isValid } from "../core/utils.js";
import { ADMIN_TAG } from "../config.js";
import { getData, markDirty } from "../core/db.js";
import { wd } from "./factions.js";
import { checkAchievements } from "./achievements.js";
import { sageText } from "./voice.js";

export const REALMS = {
  inferno: { key: "inferno", portal: "portal_inferno", dim: "minecraft:nether", at: { x: 2400, z: 2400 }, top: 64, name: "Inferno", color: "§c", fall: 18 },
  // 6.46: DOMÍNIO DE VELDANAVA — separado do mundo normal: fica no The End, muito longe da ilha principal (céu cósmico, sem terreno em volta).
  // Addons do Bedrock não podem registrar dimensões novas; esta é a dimensão real separada disponível. Ilha principal + anexo ligado por ponte.
  ceu: { key: "ceu_veldanava", portal: "portal_ceu", dim: "minecraft:the_end", at: { x: -9000, z: 9000 }, top: 110, name: "Domínio de Veldanava", color: "§e", fall: 50, minLevel: 40, annex: "veldanava_dominio" },
  espiritos: { key: "espiritos", portal: "portal_espiritos", dim: "minecraft:the_end", at: { x: 4400, z: 4400 }, top: 64, name: "Reino dos Espíritos", color: "§b", fall: 30 },
};
export const COUNCIL = ["rimuru_tempest", "benimaru", "shion", "shuna"];   // 6.43: Shuna (textura enviada pelo jogador)
const KEY = "etheria:realms", RET = "etheria:ret", STARTED = "etheria:inf_start", PEND = "etheria:inf_pend", RES = "etheria_res", IDLE = "etheria_oct_idle", POPT = "etheria_pop";
const rd = () => { try { const r = JSON.parse(world.getDynamicProperty(KEY) ?? "null"); return r && typeof r === "object" ? r : { r: {}, g: {}, dead: {} }; } catch { return { r: {}, g: {}, dead: {} }; } };
let ST = null;
const st = () => (ST ??= Object.assign({ r: {}, g: {}, dead: {} }, rd()));
const save = () => { try { world.setDynamicProperty(KEY, JSON.stringify(st())); } catch { /* ignore */ } };
const dimOf = (id) => world.getDimension(id);
const nameOf = (id) => MOBS["etheria:" + id]?.name ?? id;
const gp = (p, k) => { try { return p.getDynamicProperty(k); } catch { return undefined; } };
const sp = (p, k, v) => { try { p.setDynamicProperty(k, v); } catch { /* ignore */ } };
export const realmIds = () => Object.keys(REALMS);
export const realmState = (id) => st().r[id];
const defOf = (id) => WGEN[REALMS[id].key];
const safeFx = (p, ticks = 200) => { try { p.addEffect("slow_falling", ticks, { amplifier: 0, showParticles: false }); p.addEffect("resistance", Math.min(ticks, 200), { amplifier: 3, showParticles: false }); if (ticks > 0) p.addEffect("fire_resistance", ticks, { amplifier: 0, showParticles: false }); } catch { /* ignore */ } };

// ------------------------------------------------------------------ colocação do reino
export function entryOf(id) { const s = st().r[id], d = defOf(id); return s?.built ? { x: s.x + d.entry[0] + 0.5, y: s.y + d.entry[1], z: s.z + d.entry[2] + 0.5 } : null; }
export function gateOf(id) { const s = st().r[id], d = defOf(id); return s?.built && d.gate ? { x: s.x + d.gate[0] + 0.5, y: s.y + d.gate[1], z: s.z + d.gate[2] + 0.5 } : null; }
const centerOf = (id) => { const s = st().r[id], d = defOf(id); return s?.built ? { x: s.x + (d.size[0] >> 1), y: s.y + d.floor, z: s.z + (d.size[2] >> 1) } : null; };

/** gera (ou reaproveita) o reino e garante moradores/população. cb({ok, reused, entry, err}) é SEMPRE chamado. */
export function ensureRealm(id, cb) {
  const R = REALMS[id], def = defOf(id), S = st(), fin = (r) => { try { cb?.(r); } catch (e) { console.warn(`[Etheria] reino ${id} cb: ${e}`); } };
  if (!R || !def) return fin({ ok: false, err: "reino não registrado" });
  const dim = dimOf(R.dim); let s = S.r[id];
  if (s && (s.dim ?? (id === "ceu" ? "minecraft:overworld" : R.dim)) !== R.dim) { delete S.r[id]; s = undefined; save(); }   // 6.46: o Céu antigo (Overworld) dá lugar ao Domínio na dimensão própria
  const finishOk = (reused) => { try { ensureGroup(id); ensurePop(id, true); } catch (e) { console.warn(`[Etheria] reino ${id} moradores: ${e}`); } fin({ ok: true, reused, entry: entryOf(id) }); };
  if (s?.built) {
    const probe = () => { try { return dim.getBlock({ x: s.x + (def.size[0] >> 1), y: s.y + def.floor, z: s.z + (def.size[2] >> 1) }); } catch { return undefined; } };
    const f = probe();
    if (f && f.typeId !== "minecraft:air") return finishOk(true);
    if (!f) return withLoaded(dim, s.x, s.z, def.size, (ok) => { if (!ok) return fin({ ok: false, err: "chunks não carregados" }); const g = probe(); if (g && g.typeId !== "minecraft:air") return finishOk(true); s.built = false; ensureRealm(id, cb); });
    s.built = false;                                         // foi destruído: gera de novo
  }
  withLoaded(dim, R.at.x - 8, R.at.z - 8, [16, 4, 16], (ok) => {
    if (!ok) return fin({ ok: false, err: "chunks não carregados" });
    placeWgen(dim, R.key, { x: R.at.x, y: R.top, z: R.at.z }, (res) => {
      if (!res.ok) return fin({ ok: false, err: res.err });
      S.r[id] = { built: true, x: res.at.x, y: res.at.y, z: res.at.z, pop: 0, dim: R.dim }; save();
      if (R.annex) placeAnnex(id);
      finishOk(false);
    }, { noMobs: true });
  });
}

// ------------------------------------------------------------------ 6.46: anexo do reino (ruínas/templo extra) ligado por uma ponte suspensa
export function placeAnnex(id, cb) {
  const R = REALMS[id], S = st(), s = S.r[id], def = defOf(id), A = WGEN[R.annex]; if (!s?.built || !A) return cb?.(false);
  if (s.annex?.built) { bridge(id); return cb?.(true); }
  const dim = dimOf(R.dim), cx = s.x + (def.size[0] >> 1), cz = s.z + (def.size[2] >> 1), ax = cx + (def.size[0] >> 1) + 24 + (A.size[0] >> 1), y = s.y + def.floor;
  placeWgen(dim, R.annex, { x: ax, y, z: cz }, (res) => {
    if (!res.ok) return cb?.(false);
    s.annex = { built: true, x: res.at.x, y: res.at.y, z: res.at.z }; save(); bridge(id); cb?.(true);
  }, { noMobs: true });
}
function bridge(id) {
  const R = REALMS[id], s = st().r[id], def = defOf(id), A = WGEN[R.annex]; if (!s?.annex?.built || s.bridge) return;
  const dim = dimOf(R.dim), y = s.y + def.floor, cz = s.z + (def.size[2] >> 1), x0 = s.x + def.size[0] - 2, x1 = s.annex.x + 1;
  try {
    dim.runCommand(`fill ${x0} ${y} ${cz - 2} ${x1} ${y} ${cz + 2} quartz_block`);
    dim.runCommand(`fill ${x0} ${y + 1} ${cz - 2} ${x1} ${y + 1} ${cz - 2} quartz_slab`); dim.runCommand(`fill ${x0} ${y + 1} ${cz + 2} ${x1} ${y + 1} ${cz + 2} quartz_slab`);
    for (let x = x0; x <= x1; x += 6) { dim.runCommand(`setblock ${x} ${y + 1} ${cz - 2} end_rod`); dim.runCommand(`setblock ${x} ${y + 1} ${cz + 2} end_rod`); }
    s.bridge = 1; save();
  } catch { /* chunks ainda não carregados: tenta na próxima manutenção */ }
}

// ------------------------------------------------------------------ moradores-boss cerimoniais (grupos: inferno, ceu, espiritos, council)
const tagOf = (gk, id) => `${RES}_${gk}_${id}`;
function groupInfo(gk) {
  if (gk === "council") {
    const i = tempestInfo(), p = tempestSpawn(); if (!i || !p || !i.done) return null;
    return { dim: dimOf("minecraft:overworld"), list: COUNCIL.map((id, k) => ({ id, pos: { x: p.x + [0, 2.5, -2.5, 0][k], y: p.y, z: p.z + [-2, 1, 1, 3][k] } })) };
  }
  const s = st().r[gk], d = REALMS[gk] && defOf(gk); if (!s?.built || !d) return null;
  return { dim: dimOf(REALMS[gk].dim), list: (d.lords ?? []).map((l) => ({ id: l[0], pos: { x: s.x + l[1] + 0.5, y: s.y + l[2], z: s.z + l[3] + 0.5 } })) };
}
const found = (dim, gk, id) => { try { return dim.getEntities({ tags: [tagOf(gk, id)] }).filter(isValid); } catch { return []; } };
export function ensureGroup(gk) {
  const g = groupInfo(gk); const out = { spawned: [], present: [], dead: [], failed: [] }; if (!g) return out;
  const S = st(); S.dead[gk] ??= {};
  for (const m of g.list) {
    const list = found(g.dim, gk, m.id);
    if (list.length > 1) for (const x of list.slice(1)) { try { x.remove(); } catch { /* ignore */ } }
    if (list.length) { out.present.push(m.id); continue; }
    if (S.dead[gk][m.id]) { out.dead.push(m.id); continue; }
    if (!MOBS["etheria:" + m.id]) { out.failed.push(`${m.id}: entidade ausente`); continue; }
    try {
      const e = g.dim.spawnEntity("etheria:" + m.id, m.pos);
      e.addTag(RES); e.addTag(tagOf(gk, m.id)); e.addTag(IDLE); try { e.nameTag = nameOf(m.id); } catch { /* ignore */ }
      if (gk === "council") { e.addTag(CALM); try { e.triggerEvent("etheria:calm"); } catch { /* ignore */ } }   // 6.43: Conselho pacífico (diálogo; luta só por desafio)
      out.spawned.push(m.id);
    } catch (e) { out.failed.push(`${m.id}: ${e}`); }
  }
  save();
  if (out.failed.length) console.warn(`[Etheria] reinos: moradores de ${gk} falharam: ${out.failed.join("; ")}`);
  return out;
}
const homeOf = (gk, id) => groupInfo(gk)?.list.find((m) => m.id === id)?.pos;
export const residentHome = homeOf;
const CALM = "etheria_calm";
/** 6.43: um morador que caiu num duelo (systems/characters.js) volta a existir: apaga o registro de morte. */
export function reviveResident(gk, id) { const S = st(); if (S.dead[gk]?.[id]) { delete S.dead[gk][id]; save(); } }

// ------------------------------------------------------------------ população (inimigos comuns do reino; repostos ao voltar)
export function ensurePop(id, first = false) {
  const s = st().r[id], d = defOf(id); if (!s?.built || !d?.pop?.length) return 0;
  const dim = dimOf(REALMS[id].dim), tag = `${POPT}_${id}`; let n = 0;
  const byType = {}; for (const m of d.pop) (byType[m[0]] ??= []).push(m);
  for (const [t, list] of Object.entries(byType)) {
    let have = 0; try { have = dim.getEntities({ tags: [tag], type: t }).filter(isValid).length; } catch { /* ignore */ }
    const want = first && s.pop ? 0 : Math.ceil(list.length * 0.7), miss = first && !s.pop ? list.length - have : Math.max(0, want - have);
    for (let k = 0; k < miss; k++) {
      const m = list[(k + have) % list.length];
      try { const e = dim.spawnEntity(t, { x: s.x + m[1] + 0.5, y: s.y + m[2], z: s.z + m[3] + 0.5 }); e.addTag(tag); n++; } catch { /* ignore */ }
    }
  }
  if (first && !s.pop) { s.pop = 1; save(); }
  return n;
}

// ------------------------------------------------------------------ portais perto do spawn (Overworld)
const RING = [[22, 0], [0, 22], [-22, 0], [0, -22], [34, 12], [-34, 12], [12, 34], [-12, -34], [48, 0], [0, 48], [-48, 0], [0, -48], [60, 30], [-60, 30], [30, 60], [-30, -60], [80, 0], [0, 80], [-80, 0], [0, -80]];
let portalTry = 0;
function ensurePortals() {
  const S = st(), ow = dimOf("minecraft:overworld"), players = world.getAllPlayers().filter((p) => p.dimension.id === "minecraft:overworld"); if (!players.length) return;
  let base; try { base = world.getDefaultSpawnLocation(); } catch { base = { x: 0, z: 0 }; }
  const near = players.some((p) => Math.hypot(p.location.x - base.x, p.location.z - base.z) < 150); if (!near) return;
  for (const [id, R] of Object.entries(REALMS)) {
    if (S.g[id]?.built) { const g = S.g[id]; try { const b = ow.getBlock({ x: g.x + 6, y: g.y + 1, z: g.z + 6 }); if (b && b.typeId === "minecraft:air") { /* centro livre: ok */ } } catch { /* ignore */ } continue; }
    const def = WGEN[R.portal]; if (!def) continue;
    const k = (portalTry++ + realmIds().indexOf(id) * 3) % RING.length, x = Math.floor(base.x + RING[k][0]), z = Math.floor(base.z + RING[k][1]);
    if (S.g[id]?.busy) continue;
    const site = checkSite(ow, x, z, R.portal); if (!site.ok) continue;
    if (Object.values(S.g).some((g) => g?.built && Math.hypot(g.x - x, g.z - z) < 24)) continue;      // não junta os portais
    S.g[id] = { busy: 1 };
    placeWgen(ow, R.portal, { x, y: site.y, z }, (res) => {
      if (!res.ok) { delete S.g[id]; return; }
      S.g[id] = { built: true, x: res.at.x, y: res.at.y, z: res.at.z }; save();
      for (const p of world.getAllPlayers()) say(p, `§6[Etheria] §fUm portal para o ${R.color}§l${R.name}§r§f apareceu perto do spawn: §e${S.g[id].x + 6}, ${S.g[id].y + 1}, ${S.g[id].z + 6}§f. Fique 2 segundos sobre a plataforma central (ou use §e!${id === "ceu" ? "ceu" : id}§f).`);
    }, { noMobs: true });
  }
}
const portalPos = (id) => { const g = st().g[id], d = WGEN[REALMS[id].portal]; return g?.built && d?.gate ? { x: g.x + d.gate[0] + 0.5, y: g.y + d.gate[1], z: g.z + d.gate[2] + 0.5 } : null; };

// ------------------------------------------------------------------ viagem
export function realmAt(p) {
  for (const id of realmIds()) {
    if (p.dimension.id !== REALMS[id].dim) continue; const c = centerOf(id); if (!c) continue;
    if (Math.hypot(p.location.x - c.x, p.location.z - c.z) < 90 && p.location.y > c.y - 70 && p.location.y < c.y + 80) return id;
  }
  return null;
}
export function enterRealm(p, id, o = {}) {
  const R = REALMS[id]; if (!R) return;
  if (R.minLevel && !o.start) { let lv = 0; try { lv = getData(p).level; } catch { /* ignore */ } if (lv < R.minLevel) { say(p, `${R.color}[${R.name}] §cA passagem não reage. Requer nível ${R.minLevel} (você: ${lv}).`); try { sageText(p, `Acesso negado ao ${R.name}: nível ${R.minLevel} necessário.`, { pri: 4, key: "realm.lvl." + id, cd: 600 }); } catch { /* ignore */ } return o.fail?.({ ok: false, err: "nível" }); } }
  if (!o.silent) say(p, `${R.color}§l[${R.name}] §r§7Abrindo o caminho...`);
  ensureRealm(id, (res) => {
    if (!isValid(p)) return;
    if (!res.ok) { if (!o.silent) say(p, `§c[${R.name}] não consegui abrir o reino agora: ${res.err}. Tente de novo em instantes.`); return o.fail?.(res); }
    const e = res.entry; if (!realmAt(p)) sp(p, RET, JSON.stringify({ d: p.dimension.id, x: p.location.x, y: p.location.y, z: p.location.z }));
    const c = centerOf(id);
    withLoaded(dimOf(R.dim), Math.floor(e.x) - 6, Math.floor(e.z) - 6, [12, 4, 12], () => {
      if (!isValid(p)) return;
      try { p.teleport(e, { dimension: dimOf(R.dim), rotation: { x: 0, y: id === "inferno" || id === "espiritos" ? 180 : 180 }, keepVelocity: false }); } catch (er) { say(p, `§c[${R.name}] não consegui teleportar: ${er}`); return o.fail?.({ ok: false, err: String(er) }); }
      safeFx(p, 300); try { p.setDynamicProperty("etheria:rgrace", system.currentTick + 120); } catch { /* ignore */ }
      toast(p, `${R.color}§l${R.name}`, o.start ? "§7Sua jornada de demônio começa aqui" : "§7Chegada segura — o portal de retorno está ao lado");
      if (id === "ceu") { try { const w = wd(getData(p)); w.flags.visited_veldanava = 1; markDirty(p); checkAchievements(p); sageText(p, "Domínio de Veldanava confirmado. Fora do mundo normal. O Guardião da Memória aguarda na chegada.", { pri: 4, key: "realm.ceu", cd: 1200 }); } catch { /* ignore */ } }
      say(p, `${R.color}§l[${R.name}] §r§7Você chegou. O portal de retorno fica logo atrás de você (${c ? "§f!voltar§7 também funciona" : ""}).`);
      o.ok?.();
    });
  });
}
export function leaveRealm(p) {
  let r = null; try { r = JSON.parse(gp(p, RET) ?? "null"); } catch { /* ignore */ }
  let dest;
  if (r && !(r.d === "minecraft:overworld" && r.y > 150 && Math.hypot(r.x + 5200, r.z - 5200) < 90)) dest = { loc: { x: r.x, y: r.y, z: r.z }, dim: dimOf(r.d) };
  else { let b; try { b = world.getDefaultSpawnLocation(); } catch { b = { x: 0, y: 80, z: 0 }; } dest = { loc: { x: b.x + 0.5, y: Math.max(b.y, 70) + 1, z: b.z + 0.5 }, dim: dimOf("minecraft:overworld") }; }
  try { p.teleport(dest.loc, { dimension: dest.dim, keepVelocity: false }); safeFx(p, 200); say(p, "§a[Reinos] Você voltou."); } catch (e) { say(p, `§c[Reinos] não consegui voltar: ${e}`); }
}

// ------------------------------------------------------------------ Demônio: início no Inferno (uma vez, só na primeira escolha de raça)
export function demonStart(p) {
  if (gp(p, STARTED)) return;
  sp(p, PEND, 1);
  say(p, "§c§l[Inferno] §r§7Demônios nascem no Inferno. Você será levado para lá...");
  system.runTimeout(() => { if (isValid(p)) enterRealm(p, "inferno", { start: true, ok: () => { sp(p, STARTED, 1); sp(p, PEND, 0); }, fail: () => { /* o laço de retentativa tenta de novo */ } }); }, 60);
}
function retryPending() {
  for (const p of world.getAllPlayers()) {
    if (!gp(p, PEND) || gp(p, STARTED)) continue;
    if (realmAt(p) === "inferno") { sp(p, STARTED, 1); sp(p, PEND, 0); continue; }
    const n = (gp(p, "etheria:inf_try") ?? 0) + 1; sp(p, "etheria:inf_try", n); if (n > 6) { sp(p, PEND, 0); say(p, "§c[Inferno] não consegui te levar automaticamente. Use §f!inferno§c."); continue; }
    enterRealm(p, "inferno", { start: true, silent: n > 1, ok: () => { sp(p, STARTED, 1); sp(p, PEND, 0); } });
  }
}

// ------------------------------------------------------------------ comandos
export function realmCmd(p, name, args = []) {
  const admin = p.hasTag(ADMIN_TAG), q = (args[0] ?? "").toLowerCase();
  if (name === "voltar") return realmAt(p) ? leaveRealm(p) : say(p, "§7Você não está em um dos reinos.");
  if (name === "reinos") {
    if (q === "reset") {
      if (!admin) return say(p, "§cSem permissão.");
      const S = st(); S.dead = {}; save(); for (const gk of [...realmIds(), "council"]) ensureGroup(gk); return say(p, "§a[Reinos] registro de derrotados limpo; moradores repostos.");
    }
    const lines = realmIds().map((id) => { const s = st().r[id], g = st().g[id], R = REALMS[id]; return `${R.color}${R.name}§7: ${s?.built ? `gerado em §f${s.x},${s.y},${s.z}` : "ainda não gerado"}${g?.built ? ` | portal §f${g.x + 6},${g.y + 1},${g.z + 6}` : ""} §7— §f!${id}`; });
    return say(p, "§6[Reinos] §7Comandos: §f!inferno §7| §f!ceu §7(Domínio de Veldanava) §7| §f!espiritos §7| §f!voltar\n" + lines.join("\n"));
  }
  const id = name === "ceu" ? "ceu" : name; if (!REALMS[id]) return;
  if (q === "status") {
    const s = st().r[id]; if (!s?.built) return say(p, `§7[${REALMS[id].name}] ainda não gerado.`);
    const g = groupInfo(id); const live = (g?.list ?? []).filter((m) => found(g.dim, id, m.id).length).map((m) => nameOf(m.id));
    return say(p, `${REALMS[id].color}[${REALMS[id].name}] §7em (${s.x}, ${s.y}, ${s.z}). Moradores-boss presentes: §f${live.join(", ") || "nenhum"}§7. Derrotados: §c${Object.keys(st().dead[id] ?? {}).map(nameOf).join(", ") || "nenhum"}§7.`);
  }
  if (realmAt(p) === id) return say(p, `§7Você já está no ${REALMS[id].name}. Use §f!voltar§7 para sair.`);
  enterRealm(p, id);
}

// ------------------------------------------------------------------ laços
const dwell = new Map();
export function startRealms() {
  // gatilho dos portais: 2 s sobre a plataforma central
  system.runInterval(() => {
    try {
      const S = st();
      for (const p of world.getAllPlayers()) {
        const gm = p.getGameMode?.(); if (gm === "spectator") continue;
        let hit = null; const L = p.location, did = p.dimension.id;
        if ((gp(p, "etheria:rgrace") ?? 0) > system.currentTick) { dwell.delete(p.id); continue; }
        for (const id of realmIds()) {
          const R = REALMS[id], pos = portalPos(id), back = gateOf(id);
          if (pos && did === "minecraft:overworld" && Math.abs(L.x - pos.x) < 1.6 && Math.abs(L.z - pos.z) < 1.6 && Math.abs(L.y - pos.y) < 2.5) hit = { id, act: "in" };
          if (back && did === R.dim && Math.abs(L.x - back.x) < 1.6 && Math.abs(L.z - back.z) < 1.6 && Math.abs(L.y - back.y) < 2.5) hit = { id, act: "out" };
        }
        const cur = dwell.get(p.id);
        if (!hit) { if (cur) dwell.delete(p.id); continue; }
        const n = cur && cur.k === hit.id + hit.act ? cur.n + 1 : 1; dwell.set(p.id, { k: hit.id + hit.act, n });
        try { p.dimension.spawnParticle("minecraft:totem_particle", { x: L.x, y: L.y + 1, z: L.z }); } catch { /* ignore */ }
        if (n === 1) toast(p, hit.act === "in" ? `${REALMS[hit.id].color}§l${REALMS[hit.id].name}` : "§aRetorno", "§7Fique parado na plataforma...");
        if (n >= 4) { dwell.delete(p.id); if (hit.act === "in") enterRealm(p, hit.id); else leaveRealm(p); }
      }
    } catch (er) { console.warn(`[Etheria] reinos portais: ${er}`); }
  }, 10);
  // rede de segurança: caiu da ilha -> volta à chegada
  system.runInterval(() => {
    try {
      for (const p of world.getAllPlayers()) {
        for (const id of realmIds()) {
          const R = REALMS[id], c = centerOf(id); if (!c || p.dimension.id !== R.dim) continue;
          if (Math.hypot(p.location.x - c.x, p.location.z - c.z) > 120) continue;
          if (p.location.y < R.top - R.fall && p.location.y > -64) { const e = entryOf(id); if (e) { try { p.teleport(e, { dimension: dimOf(R.dim), keepVelocity: false }); safeFx(p, 160); say(p, `§e[${R.name}] §7Você caiu da ilha e foi resgatado na chegada.`); } catch { /* ignore */ } } }
        }
      }
    } catch (er) { console.warn(`[Etheria] reinos queda: ${er}`); }
  }, 20);
  // moradores cerimoniais: presos ao posto até serem atacados (o octagrama.js remove a tag IDLE ao receber dano)
  system.runInterval(() => {
    try {
      for (const gk of [...realmIds(), "council"]) {
        const g = groupInfo(gk); if (!g) continue;
        let list = []; try { list = g.dim.getEntities({ tags: [RES, IDLE] }); } catch { /* ignore */ }
        for (const e of list) {
          if (!isValid(e)) continue;
          const t = e.getTags().find((x) => x.startsWith(`${RES}_${gk}_`)); if (!t) continue;
          const h = homeOf(gk, t.slice(RES.length + gk.length + 2)); if (!h) continue;
          const dx = e.location.x - h.x, dz = e.location.z - h.z, dy = e.location.y - h.y;
          if (dx * dx + dz * dz > 6.25 || Math.abs(dy) > 3) { try { e.teleport(h); } catch { /* ignore */ } }
          try { e.clearVelocity(); e.addEffect("slowness", 40, { amplifier: 250, showParticles: false }); } catch { /* ignore */ }
          if (gk === "council" && !e.hasTag(CALM) && !e.hasTag("etheria_duel")) { e.addTag(CALM); try { e.triggerEvent("etheria:calm"); } catch { /* ignore */ } }
        }
      }
    } catch (er) { console.warn(`[Etheria] reinos moradores: ${er}`); }
  }, 10);
  // morte registrada (sem ressurreição automática)
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const e = ev.deadEntity; if (!e?.hasTag?.(RES)) return;
      const t = e.getTags().find((x) => x.startsWith(RES + "_")); if (!t) return;
      const rest = t.slice(RES.length + 1), i = rest.indexOf("_"), gk = rest.slice(0, i), id = rest.slice(i + 1), S = st();
      S.dead[gk] ??= {}; S.dead[gk][id] = true; save();
    } catch { /* ignore */ }
  });
  // manutenção: perto de um reino/Tempest repõe quem sumiu sem morrer e a população
  system.runInterval(() => {
    try {
      const ps = world.getAllPlayers(); if (!ps.length) return;
      for (const id of realmIds()) {
        const c = centerOf(id); if (!c) continue;
        if (ps.some((p) => p.dimension.id === REALMS[id].dim && Math.hypot(p.location.x - c.x, p.location.z - c.z) < 120)) { ensureGroup(id); ensurePop(id); if (REALMS[id].annex) placeAnnex(id); }
      }
      const i = tempestInfo(), t = i && tempestSpawn();
      if (t && ps.some((p) => p.dimension.id === "minecraft:overworld" && Math.hypot(p.location.x - t.x, p.location.z - t.z) < 140)) ensureGroup("council");
    } catch (er) { console.warn(`[Etheria] reinos manutenção: ${er}`); }
  }, 600);
  system.runInterval(() => { try { ensurePortals(); retryPending(); } catch (er) { console.warn(`[Etheria] reinos portais/pend: ${er}`); } }, 200);
}
export const realmGroups = () => [...realmIds(), "council"];
export const residentIds = () => { const o = {}; for (const id of realmIds()) o[id] = (defOf(id)?.lords ?? []).map((l) => l[0]); o.council = COUNCIL.slice(); return o; };

// systems/beastforms.js - 7.x: TRANSFORMAÇÕES DA RAÇA BEASTKIN (Carrion, o Rei Besta): Forma Fera, Rei Besta e Besta Real.
// São habilidades ativas (itens na hotbar como as outras), executor "beastform": custo de mana (cobrado pelo sistema de habilidades) + stamina,
// duração e recarga próprias. Só uma forma por vez (a nova substitui a anterior). Liberadas pelo nível + estágio da raça (syncBeastForms).
// Visual: animação de evolução curta (etheria:tfx "evo"), rugido, partículas de terra/ouro/sangue e uma aura que acompanha o jogador enquanto dura.
import { world, system } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { registerExec, grantSkill } from "./skills.js";
import { addBuff, hasBuff } from "./effects.js";
import { applyDerivedStats, dropStats } from "./stats.js";
import { ctx, burst, ringFlat, column, implode, T } from "./fxlib.js";
import { playTransform } from "./raceparts.js";
import { sageText } from "./voice.js";
import { addHudLine } from "./hudhooks.js";
import { toast } from "../core/utils.js";
import { BEAST_FORMS, BEAST_FORM_IDS } from "../data/beastforms.js";
import { RACES } from "../data/races.js";

const BUFF = "beastform";
const live = new Map();   // playerId -> { id, end }
const depthOf = (d) => { const R = RACES[d.race]; let n = 0; for (let c = R?.stages?.[d.raceStage]; c?.from; c = R.stages[c.from]) n++; return n; };
export const beastFormOf = (p) => { const x = live.get(p?.id); return x && x.end > system.currentTick ? x.id : null; };

/** concede as formas que o nível/estágio já liberam (só Beastkin). Devolve as novas. */
export function syncBeastForms(player, quiet = false) {
  let d; try { d = getData(player); } catch { return []; }
  if (!d.raceChosen || d.race !== "beastkin") return [];
  const got = [], depth = depthOf(d);
  for (const id of BEAST_FORM_IDS) {
    const f = BEAST_FORMS[id];
    if (d.unlockedSkills.includes(id) || d.level < f.level || depth < f.depth) continue;
    grantSkill(player, id); got.push(id);
  }
  if (got.length && !quiet) { try { toast(player, "§6§lTRANSFORMAÇÃO", `§f${BEAST_FORMS[got[got.length - 1]].name}`); } catch { /* ignore */ } }
  return got;
}
/** requisito exibido (menu/teste) */
export function formLockReason(d, id) {
  const f = BEAST_FORMS[id]; if (!f) return "Forma inválida.";
  if (d.race !== "beastkin") return "Só a raça Beastkin (a raça de Carrion) pode assumir esta forma.";
  if (d.level < f.level) return `Requer nível ${f.level}.`;
  if (depthOf(d) < f.depth) return `Requer evoluir a raça (estágio ${f.depth + 1}).`;
  return null;
}

function activate(player, sk, s, d, tools) {
  const id = sk.exec.form, f = BEAST_FORMS[id];
  const why = formLockReason(d, id); if (why) return why;
  if ((sk.stamina ?? 0) > 0 && d.stamina < sk.stamina) return "Stamina insuficiente.";
  d.stamina = Math.max(0, d.stamina - (sk.stamina ?? 0));
  addBuff(player, BUFF, f.sec, { name: f.short, stats: f.stats, vanilla: f.vanilla });
  live.set(player.id, { id, end: system.currentTick + f.sec * 20 });
  dropStats(player.id); applyDerivedStats(player); markDirty(player);
  // visual da transformação
  try { playTransform(player, "evo", 1600); } catch { /* ignore */ }
  const [c1, c2] = f.col, L = player.location, c = ctx(player, 1.2), mid = { x: L.x, y: L.y + 1, z: L.z };
  implode(c, mid, { col: c1, tile: T.claw, n: 18, radius: 3, life: 0.5 });
  column(c, L, { col: c2, tile: T.fang, n: 16, h: 4 + f.depth * 2, r: 0.9 });
  for (let w = 0; w < 2 + f.depth; w++) system.runTimeout(() => { try { if (player.isValid) ringFlat(ctx(player, 1), { x: player.location.x, y: player.location.y + 0.1, z: player.location.z }, { col: w % 2 ? c2 : c1, tile: T.ring, n: 24, radius: 2 + w * 2, life: 0.6 }); } catch { /* ignore */ } }, 3 + w * 4);
  try { player.playSound("mob.ravager.roar", { volume: 1, pitch: 1.1 - f.depth * 0.15 }); } catch { /* ignore */ }
  if (f.depth >= 2) { try { player.playSound("random.explode", { volume: 0.7, pitch: 0.8 }); } catch { /* ignore */ } }
  // rugido / pisada de guerra: dano + arremesso ao redor (pelo motor de dano das habilidades)
  if (f.roar && tools?.around && tools?.hitOne) {
    const ex = { ...sk.exec, kind: "aoe_self", radius: f.roar.radius, power: f.roar.power, stat: "strength", knock: f.roar.knock };
    for (const e of tools.around(player.dimension, L, f.roar.radius, player)) { try { tools.hitOne(player, e, { ...sk, exec: ex }, s); tools.push?.(e, L, f.roar.knock); } catch { /* ignore */ } }
    burst(c, mid, { col: c2, tile: T.chunk, n: 24, spd: 4, up: 1.4 });
  }
  try { toast(player, `§6§l${f.name.toUpperCase()}`, `§7${f.sec}s · recarga ${f.cd}s`); } catch { /* ignore */ }
  try { sageText(player, f.msg, { pri: 4, key: `beast.${id}`, cd: 200 }); } catch { /* ignore */ }
  return true;
}
registerExec("beastform", activate);

function aura() {
  const now = system.currentTick;
  for (const [pid, x] of live) {
    if (x.end <= now) { live.delete(pid); continue; }
    const p = world.getAllPlayers().find((q) => q.id === pid); if (!p) { live.delete(pid); continue; }
    try {
      if (!hasBuff(p, BUFF)) { live.delete(pid); dropStats(pid); applyDerivedStats(p); continue; }   // buff limpo (morte etc.)
      const f = BEAST_FORMS[x.id], c = ctx(p, 0.6), L = p.location;
      burst(c, { x: L.x, y: L.y + 1, z: L.z }, { col: f.col[(now / 10) % 2 | 0], tile: T.ember, n: 3 + f.depth * 2, spd: 0.6, up: 0.9 });
      if (x.end - now <= 60 && (x.end - now) % 20 < 10) ringFlat(c, { x: L.x, y: L.y + 0.1, z: L.z }, { col: "white", tile: T.ring, n: 12, radius: 1.2, life: 0.4 });
      if (x.end - now <= 10) { live.delete(pid); dropStats(pid); try { sageText(p, `${f.name} encerrada.`, { pri: 6, key: `beast.end.${x.id}`, cd: 100 }); } catch { /* ignore */ } system.runTimeout(() => { try { if (p.isValid) applyDerivedStats(p); } catch { /* ignore */ } }, 12); }
    } catch { /* ignore */ }
  }
}
export function startBeastForms() {
  system.runInterval(aura, 10);
  system.runInterval(() => { for (const p of world.getAllPlayers()) { try { syncBeastForms(p); } catch { /* ignore */ } } }, 200);
  addHudLine((p) => { const id = beastFormOf(p); if (!id) return ""; const x = live.get(p.id); return `§6✦ ${BEAST_FORMS[id].short} ${Math.ceil((x.end - system.currentTick) / 20)}s`; });
  try { world.afterEvents.playerLeave.subscribe((ev) => live.delete(ev.playerId)); } catch { /* ignore */ }
}

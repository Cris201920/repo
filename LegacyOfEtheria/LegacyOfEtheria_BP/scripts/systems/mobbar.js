// systems/mobbar.js - 8.7 (Etapa 7a): BARRA DE VIDA DO ALVO na barra de ação: nome + ▰▰▰▱▱ colorida pela porcentagem + vida.
// Aparece ao MIRAR num mob (até 24 blocos) ou por 8 s depois de bater/apanhar dele; chefes ganham a marca ☠ e a vida em números.
// Leve: atualiza a cada 5 ticks só para quem tem alvo; a mira é testada a cada 10 ticks; nada roda sem alvo.
// Entra como uma linha da HUD (hudhooks) e, com a HUD desligada, ocupa a barra de ação sozinha.
import { world, system, Player } from "@minecraft/server";
import { MOBS } from "../data/mobs.gen.js";
import { SPAWN } from "../config.js";
import { getData } from "../core/db.js";
import { isValid, healthComp } from "../core/utils.js";
import { addHudTop } from "./hudhooks.js";
import { renderHud } from "./loop.js";

const SEG = 12, SKIP = new Set(["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand", "minecraft:painting", "minecraft:fishing_hook", "minecraft:falling_block"]);
const st = new Map();   // playerId -> { eid, e, until, aim, line, sent }
const BIG = new Set(["boss", "legendary", "special"]);

export const barColor = (f) => (f > 0.6 ? "§a" : f > 0.3 ? "§e" : f > 0.15 ? "§6" : "§c");
const short = (n) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(Math.ceil(n)));
function nameOf(e) {
  try { if (e.nameTag) return e.nameTag.replace(/§./g, ""); } catch { /* ignore */ }
  const m = MOBS[e.typeId]; if (m) return m.name;
  const s = e.typeId.replace(/^[^:]+:/, "").replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1);
}
/** texto da barra (exportado para teste/prévia) */
export function barLine(name, cur, max, boss = false) {
  const f = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0, n = Math.round(f * SEG), col = barColor(f);
  const fill = cur > 0 ? Math.max(1, n) : 0;
  return `${boss ? "§4☠ " : ""}§l${col}${name.slice(0, 22)}§r ${col}${"▰".repeat(fill)}§8${"▱".repeat(SEG - fill)} §f${Math.round(f * 100)}%${boss ? ` §7${short(cur)}/${short(max)}` : ""}`;
}
function lineFor(e) {
  const h = healthComp(e); if (!h || h.effectiveMax <= 0) return "";
  const m = MOBS[e.typeId], boss = !!(m && BIG.has(m.rar)) || e.typeId.startsWith("etheria:boss_");
  return barLine(nameOf(e), h.currentValue, h.effectiveMax, boss);
}
const okTarget = (e) => { try { return isValid(e) && !(e instanceof Player) && !SKIP.has(e.typeId) && !!healthComp(e); } catch { return false; } };

function mark(p, e) {
  if (!okTarget(e)) return;
  const s = st.get(p.id) ?? {}; s.e = e; s.eid = e.id; s.until = system.currentTick + SPAWN.barHold; st.set(p.id, s);
}

function step() {
  const now = system.currentTick, aimNow = now % 10 < SPAWN.barEvery;
  for (const p of world.getAllPlayers()) {
    let s = st.get(p.id);
    if (aimNow) {
      let hit; try { hit = p.getEntitiesFromViewDirection({ maxDistance: SPAWN.barRange })?.[0]?.entity; } catch { /* ignore */ }
      if (hit && okTarget(hit)) { s = s ?? {}; s.aim = hit; st.set(p.id, s); } else if (s) s.aim = undefined;
    }
    if (!s) continue;
    let t = s.aim && isValid(s.aim) ? s.aim : undefined;
    if (!t && s.e && now < s.until && isValid(s.e)) { try { if (s.e.dimension.id === p.dimension.id) t = s.e; } catch { /* ignore */ } }
    const line = t ? lineFor(t) : "";
    if (!line && !s.line) { if (!s.aim && !(now < s.until)) st.delete(p.id); continue; }
    if (line === s.line && now - (s.sent ?? 0) < 20) continue;
    s.line = line; s.sent = now;
    try {
      const d = getData(p);
      if (d.settings?.hud) renderHud(p, d); else if (line) p.onScreenDisplay.setActionBar(line);
    } catch { /* ignore */ }
  }
}

export function startMobBar() {
  addHudTop((p) => st.get(p.id)?.line ?? "");
  try {
    world.afterEvents.entityHurt.subscribe((ev) => {
      try {
        const v = ev.hurtEntity, src = ev.damageSource?.damagingEntity;
        if (src instanceof Player && !(v instanceof Player)) mark(src, v);
        else if (v instanceof Player && src && !(src instanceof Player)) { const s = st.get(v.id); if (!s || !(system.currentTick < s.until)) mark(v, src); }
      } catch { /* ignore */ }
    });
    world.afterEvents.entityDie.subscribe((ev) => {
      let id; try { id = ev.deadEntity.id; } catch { return; }
      for (const s of st.values()) if (s.eid === id) { s.until = system.currentTick + 30; }   // mostra 0% por 1,5 s e some
    });
  } catch (e) { console.warn(`[Etheria] barra de vida: ${e}`); }
  system.runInterval(step, SPAWN.barEvery);
}

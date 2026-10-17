// systems/loop.js - Laço principal (1x/s): regeneração, passivas, HUD, missões vivas, auras e buffs
import { world, system } from "@minecraft/server";
import { MASTER_TICK, REGEN, MAX_LEVEL, xpToNext, RARITY } from "../config.js";
import { getData, markDirty } from "../core/db.js";
import { fmt } from "../core/utils.js";
import { SKILLS } from "../data/skills.js";
import { getStats, getHealth, applyDerivedStats, applyPassiveEffects } from "./stats.js";
import { tickEffects, listBuffs } from "./effects.js";
import { inCombat } from "./combat.js";
import { hudSkillLines, hudSelectedLine, setHudRenderer, flashActive } from "./skillbar/ui.js";
import { tickQuests, trackerLine } from "./quests.js";
import { fx, level as fxLevel } from "./fx.js";
import { ensureLore } from "./items.js";
import { subtitleActive } from "./voice.js";
import { typingActive } from "./sagecore.js";
import { hudExtra, hudOverride } from "./hudhooks.js";
import { inventory } from "../core/utils.js";

let tickCount = 0;
const short = (n) => (n.length > 9 ? n.slice(0, 8) + "." : n);

// 6.89: barras gráficas (font/glyph_E3.png) no lugar dos corações vanilla, que ficam escondidos
const G = (i) => String.fromCharCode(0xE300 + i);
const BAR = { hp: [G(0x10), G(0x11)], mp: [G(0x13), G(0x14)], st: [G(0x15), G(0x16)] };
function bar(kind, cur, max, n) {
  const f = max > 0 ? Math.max(0, Math.min(1, cur / max)) * n : 0, full = Math.floor(f), half = f - full >= 0.5 ? 1 : 0;
  return "§r" + G(0x17) + BAR[kind][0].repeat(full) + (half ? BAR[kind][1] : "") + G(0x12).repeat(n - full - half) + G(0x18);
}
export function barLine(p, d, s) {
  const hp = getHealth(p);
  return `${G(0)}${bar("hp", hp.cur, hp.max, 10)} §c${Math.ceil(hp.cur)}§7/${Math.ceil(hp.max)}   §r${G(1)}${bar("mp", d.mana, s.maxMana, 10)} §9${Math.floor(d.mana)}§7/${s.maxMana}`
    + `\n§r${G(2)}${bar("st", d.stamina, s.maxStamina, 6)} §a${Math.floor(d.stamina)}§7/${s.maxStamina}`;
}

function hideVanillaHearts(p) {
  try { p.runCommand("hud @s hide health"); } catch { /* comando ausente em versões antigas */ }
}

function hudText(p, d, s) {
  let t = barLine(p, d, s);
  if (d.settings.compact) return t;
  t += `   §6${fmt(d.coins)}$`;   // 6.69: dinheiro na mesma linha (barra menor)   // 6.36: nível/XP saem da barra (o nível aparece na cena da Voz do Mundo e no menu de status)
  const sel = hudSelectedLine(p, d, s); if (sel) t += "\n" + sel;                 // habilidade na mão: custo e estado
  const strip = hudSkillLines(p, d, s); if (strip.length) t += "\n" + strip.join("\n");   // faixa das equipadas (número = slot da hotbar)
  const buffs = listBuffs(p);
  if (buffs.length) t += "\n" + buffs.slice(0, 4).map((b) => `${b.debuff ? "§c" : "§a"}${short(b.name)} ${b.left}s`).join(" ");
  if (d.settings.tracker) { const q = trackerLine(p); if (q) t += "\n" + q; }
  for (const l of hudExtra(p)) t += "\n" + l;     // alvo travado do Sábio, painel de debug...
  return t;
}

function perPlayer(p) {
  const d = getData(p), s = getStats(p);
  if (d.mana < s.maxMana) { d.mana = Math.min(s.maxMana, d.mana + s.manaRegen); markDirty(p); }
  if (d.stamina < s.maxStamina) { d.stamina = Math.min(s.maxStamina, d.stamina + s.staminaRegen * (inCombat(p) ? REGEN.combat_pause_ticks / 250 : 1)); markDirty(p); }
  if (tickCount % 3 === 0) { applyDerivedStats(p); applyPassiveEffects(p); }
  if (tickCount % 10 === 1) { if (d.settings.hud) hideVanillaHearts(p); else try { p.runCommand("hud @s reset health"); } catch { /* ignore */ } }
  if (Object.keys(d.quests.active).length) tickQuests(p);
  // tooltip automático do item na mão (itens criados por receita não têm lore)
  try {
    const c = inventory(p), it = c?.getItem(p.selectedSlotIndex);
    if (it && it.typeId.startsWith("etheria:") && ensureLore(it)) c.setItem(p.selectedSlotIndex, it);
  } catch { /* ignore */ }
  // aura para equipamento lendário ou superior
  if (tickCount % 3 === 0 && ["high", "ultra"].includes(fxLevel(p)) && s.eq.some((e) => ["legendary", "mythic", "divine"].includes(e.info.rarity))) {
    fx(p.dimension, { x: p.location.x, y: p.location.y + 0.2, z: p.location.z }, "legendary", p);
  }
  renderHud(p, d, s);
}

/** Desenha a HUD agora. Não sobrescreve legenda de voz, texto digitado do Grande Sábio nem mensagem rápida de habilidade. */
export function renderHud(p, d = getData(p), s = getStats(p)) {
  if (!d.settings.hud || subtitleActive(p) || flashActive(p) || typingActive(p)) return;
  try { p.onScreenDisplay.setActionBar(hudOverride(p) ?? hudText(p, d, s)); } catch { /* ignore */ }   // Modo Assess substitui a HUD inteira
}

export function startLoop() {
  setHudRenderer((p) => renderHud(p));
  system.runInterval(() => {
    tickCount++;
    for (const p of world.getAllPlayers()) { try { perPlayer(p); } catch (e) { console.warn(`[Etheria] loop ${p.name}: ${e}`); } }
    tickEffects();
  }, MASTER_TICK);
}
export { RARITY };

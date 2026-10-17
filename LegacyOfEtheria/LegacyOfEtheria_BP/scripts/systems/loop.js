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

// 6.90: HUD igual à do mod (ui/hud_screen.json, tools/mod_hud.py). A actionbar começa com um cabeçalho ASCII de 49 caracteres
// que a JSON UI lê (barras e números) e corta do texto exibido: ETHUD + hp/mp/xp/st (00..40) + 3 textos de 11 + nível(3).
const STEPS = 40;
const step = (c, m) => String(m > 0 ? Math.round(Math.max(0, Math.min(1, c / m)) * STEPS) : 0).padStart(2, "0");
const num = (n) => (n >= 100000 ? `${Math.floor(n / 1000)}k` : String(Math.floor(n)));
const field = (t, w) => { t = t.slice(0, w); const l = Math.floor((w - t.length) / 2); return " ".repeat(l) + t + " ".repeat(w - t.length - l); };
export function hudHeader(p, d, s) {
  const hp = getHealth(p), need = xpToNext(d.level);
  return "ETHUD" + step(hp.cur, hp.max) + step(d.mana, s.maxMana) + step(d.level >= MAX_LEVEL ? 1 : d.xp, d.level >= MAX_LEVEL ? 1 : need) + step(d.stamina, s.maxStamina)
    + field(`${num(Math.ceil(hp.cur))}/${num(Math.ceil(hp.max))}`, 11) + field(`${num(d.mana)}/${num(s.maxMana)}`, 11) + field(`${num(d.stamina)}/${num(s.maxStamina)}`, 11)
    + field(String(d.level), 3);
}

function hideVanillaHearts(p) {
  try { p.runCommand("hud @s hide health"); } catch { /* comando ausente em versões antigas */ }
}

function hudText(p, d, s) {
  let t = hudHeader(p, d, s);
  if (d.settings.compact) return t;
  t += `§6${fmt(d.coins)}$`;   // 6.69: dinheiro na mesma linha (barra menor)   // 6.36: nível/XP saem da barra (o nível aparece na cena da Voz do Mundo e no menu de status)
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

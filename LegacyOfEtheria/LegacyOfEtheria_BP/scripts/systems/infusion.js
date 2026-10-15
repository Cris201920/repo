// systems/infusion.js - 6.36: INFUSÃO DE HABILIDADE NAS ESPADAS.
// A infusão é gravada NO ITEM (propriedade dinâmica do ItemStack + linha de lore "Infusão: ..."), não no jogador: trocar de espada troca o poder,
// passar a espada para outro jogador leva a infusão junto. Ativação automática no golpe (funciona igual no celular, sem botão extra),
// com custo de mana, recarga por jogador, dano real (applyDamage creditando o atacante) e proteção contra dano duplicado no mesmo tick.
import { world, system, Player } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { say, playSound } from "../core/utils.js";
import { ITEMS } from "../data/items.gen.js";
import { SKILLS } from "../data/skills.js";
import { ELEMENT_VFX, familyOf } from "../data/elementvfx.js";
import { ctx, vfx, vbolt } from "./fxlib.js";
import { menu } from "./ui/forms.js";

export const PROP = "etheria:infusion";
export const TIERS = { basic: { name: "Básica", lvl: 5, cost: 300 }, intermediate: { name: "Intermediária", lvl: 20, cost: 1200 }, advanced: { name: "Avançada", lvl: 40, cost: 4000 }, legendary: { name: "Lendária", lvl: 70, cost: 15000 } };
/** cat: categoria de espada que aceita a infusão (além das lendárias/míticas, que aceitam todas, e das básicas, aceitas por qualquer espada) */
export const INFUSIONS = {
  gale_cut:     { name: "Corte do Vendaval", fam: "wind", cat: "common", tier: "basic", mana: 8, cd: 30, mult: 0.25, col: "wind", effect: "pierce", desc: "Lâmina de ar que atravessa até 4 blocos à frente." },
  blue_wave:    { name: "Onda Azul de Rimuru", fam: "blue", cat: "blue", tier: "intermediate", mana: 14, cd: 50, mult: 0.35, col: "mana", effect: "wave", desc: "Onda de energia azul que atinge quem estiver a 2,5 blocos do alvo." },
  hellfire:     { name: "Chama Infernal", fam: "fire", cat: "fire", tier: "intermediate", mana: 14, cd: 50, mult: 0.3, col: "fire", effect: "burn", desc: "Incendeia o alvo por 4 s e explode em brasas." },
  holy_edge:    { name: "Lâmina Sagrada", fam: "light", cat: "light", tier: "intermediate", mana: 12, cd: 50, mult: 0.25, col: "holy", effect: "heal", desc: "O golpe cura você em 3 de vida." },
  black_bolt:   { name: "Raio Negro", fam: "black_lightning", cat: "electric", tier: "advanced", mana: 18, cd: 60, mult: 0.45, col: "violet", effect: "chain", chain: 2, desc: "Raio negro que salta para mais 2 inimigos próximos." },
  abyss_shards: { name: "Fragmentos do Abismo", fam: "dark", cat: "dark", tier: "advanced", mana: 18, cd: 60, mult: 0.4, col: "violet", effect: "slow", desc: "Fragmentos violeta que deixam o alvo lento." },
  storm_dragon: { name: "Fúria do Dragão da Tempestade", fam: "black_lightning", cat: "legendary", tier: "legendary", mana: 30, cd: 100, mult: 0.8, col: "violet", effect: "chain", chain: 4, desc: "Raio negro lendário: salta para mais 4 inimigos." },
};
const WEAPON_CATS = (id, inf) => {
  const c = new Set(["common"]);
  if (/storm|tempest|thunder|lightning/.test(id)) c.add("electric");
  if (/flame|scorch|ember|fiery|shizue|fire/.test(id)) c.add("fire");
  if (/frost|ice|boreal|neptunium|rimuru|water|obsidian_katana/.test(id)) c.add("blue");
  if (/abyss|void|dread|crimson|reaper|shadow|obsidian|dead_mans/.test(id)) c.add("dark");
  if (/celestial|sky|dyrnwyn|holy|reid|rainbow|star/.test(id)) c.add("light");
  if (inf && (inf.rarity === "legendary" || inf.rarity === "mythic")) c.add("legendary");
  return c;
};
export const isSword = (typeId) => { const i = ITEMS[typeId]; return !!i && i.kind === "weapon" && (i.wtype === "sword" || i.wtype === "dagger"); };
export function compatible(typeId, iid) {
  const I = INFUSIONS[iid]; if (!I || !isSword(typeId)) return false;
  const cats = WEAPON_CATS(typeId, ITEMS[typeId]);
  return I.tier === "basic" || cats.has("legendary") || cats.has(I.cat);
}
/** requisitos do jogador: nível do tier + conhecer pelo menos uma habilidade da mesma família visual (a "habilidade compatível") */
export function playerReq(p, iid) {
  const I = INFUSIONS[iid], d = getData(p), T = TIERS[I.tier];
  if ((d.level ?? 1) < T.lvl) return `Requer nível ${T.lvl}`;
  if (I.tier !== "basic") {
    const known = (d.unlockedSkills ?? []).some((sid) => familyOf(SKILLS[sid]) === I.fam);
    if (!known) return "Requer conhecer uma habilidade do mesmo elemento";
  }
  if ((d.coins ?? 0) < T.cost) return `Requer ${T.cost} moedas`;
  return null;
}
export function infusionOf(item) {
  if (!item) return null;
  try { const v = item.getDynamicProperty(PROP); if (typeof v === "string" && INFUSIONS[v]) return v; } catch { /* ignore */ }
  try { for (const l of item.getLore() ?? []) { const m = /Infusão: (.+)$/.exec(l.replace(/§./g, "")); if (m) { const k = Object.keys(INFUSIONS).find((x) => INFUSIONS[x].name === m[1].trim()); if (k) return k; } } } catch { /* ignore */ }
  return null;
}
export const infusionLore = (iid) => (iid && INFUSIONS[iid] ? [`§5✦ Infusão: §d${INFUSIONS[iid].name}`, `§8${TIERS[INFUSIONS[iid].tier].name} · ${INFUSIONS[iid].mana} mana · recarga ${INFUSIONS[iid].cd / 20}s`] : []);

// ------------------------------------------------------------------ aplicar / remover (no item da mão)
function heldSlot(p) { try { const inv = p.getComponent("minecraft:inventory").container; return { inv, slot: p.selectedSlotIndex, item: inv.getItem(p.selectedSlotIndex) }; } catch { return null; } }
function writeItem(h, iid) {
  const it = h.item;
  try { it.setDynamicProperty(PROP, iid ?? undefined); } catch { /* versão sem propriedades em itens: fica só a lore */ }
  let lore = []; try { lore = (it.getLore() ?? []).filter((l) => !/Infusão:|mana · recarga/.test(l.replace(/§./g, ""))); } catch { /* ignore */ }
  try { it.setLore([...lore, ...infusionLore(iid)]); } catch { /* ignore */ }
  h.inv.setItem(h.slot, it);
}
export function applyInfusion(p, iid) {
  const h = heldSlot(p); if (!h?.item) return "Segure uma espada na mão.";
  if (!isSword(h.item.typeId)) return "Só espadas e adagas aceitam infusão.";
  if (!compatible(h.item.typeId, iid)) return "Esta espada não é compatível com essa infusão.";
  const why = playerReq(p, iid); if (why) return why;
  const d = getData(p); d.coins -= TIERS[INFUSIONS[iid].tier].cost; markDirty(p);
  writeItem(h, iid);
  try { const c = ctx(p); const E = ELEMENT_VFX[INFUSIONS[iid].fam]; const v = { pos: p.location, at: p.location, from: p.getHeadLocation(), to: p.location, dir: p.getViewDirection(), tier: 2 }; E?.prep(c, v); E?.impact(c, v); } catch { /* ignore */ }
  playSound(p, "random.levelup", 0.7, 1.3);
  return null;
}
export function removeInfusion(p) {
  const h = heldSlot(p); if (!h?.item || !infusionOf(h.item)) return "A espada na mão não tem infusão.";
  writeItem(h, null); return null;
}

// ------------------------------------------------------------------ golpe infundido
const cdUntil = new Map(), hitGuard = new Map();
/** chamado por combat.onHit depois do dano normal. Devolve o dano extra aplicado (0 se não ativou). */
export function infusedHit(p, target, baseDmg, item, dealDamage, isValidTarget) {
  const iid = infusionOf(item); if (!iid) return 0;
  const I = INFUSIONS[iid], now = system.currentTick;
  if ((cdUntil.get(p.id) ?? 0) > now) return 0;
  const d = getData(p); if ((d.mana ?? 0) < I.mana) return 0;
  const gk = target.id + ":" + now; if (hitGuard.has(gk)) return 0;   // anti dano duplicado (dois eventos no mesmo tick)
  hitGuard.set(gk, 1); if (hitGuard.size > 200) hitGuard.clear();
  d.mana -= I.mana; markDirty(p); cdUntil.set(p.id, now + I.cd);
  const extra = Math.max(2, baseDmg * I.mult), at = target.location, c = ctx(p);
  const v = { pos: p.location, from: p.getHeadLocation(), to: at, at, dir: p.getViewDirection(), tier: I.tier === "legendary" ? 3 : I.tier === "advanced" ? 2 : 1 };
  const E = ELEMENT_VFX[I.fam];
  try { E?.act(c, v); E?.trail(c, v); E?.impact(c, v); E?.residue(c, v); } catch { /* visual nunca derruba o golpe */ }
  dealDamage(p, target, extra);
  const near = (r) => { try { return p.dimension.getEntities({ location: at, maxDistance: r }).filter((e) => e !== target && isValidTarget(e, p)); } catch { return []; } };
  switch (I.effect) {
    case "burn": try { target.setOnFire(4, true); } catch { /* ignore */ } break;
    case "heal": try { const h = p.getComponent("minecraft:health"); h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 3)); } catch { /* ignore */ } break;
    case "slow": try { target.addEffect("slowness", 60, { amplifier: 1 }); } catch { /* ignore */ } break;
    case "wave": for (const e of near(2.5).slice(0, 5)) dealDamage(p, e, extra * 0.6); break;
    case "chain": {
      let from = { x: at.x, y: at.y + 1, z: at.z };
      for (const e of near(6).slice(0, I.chain ?? 2)) { const to = { x: e.location.x, y: e.location.y + 1, z: e.location.z }; vbolt(c, from, to, { branch: 0.3, w: 0.5 }); dealDamage(p, e, extra * 0.5); from = to; }
      break;
    }
    case "pierce": {
      const dir = p.getViewDirection();
      try { for (const e of p.dimension.getEntities({ location: { x: at.x + dir.x * 2, y: at.y, z: at.z + dir.z * 2 }, maxDistance: 2.2 }).filter((e) => e !== target && isValidTarget(e, p)).slice(0, 3)) dealDamage(p, e, extra * 0.7); } catch { /* ignore */ }
      break;
    }
  }
  return extra;
}

// ------------------------------------------------------------------ brilho na lâmina (enquanto a espada infundida está na mão)
function bladeGlow() {
  for (const p of world.getAllPlayers()) {
    let it; try { it = p.getComponent("minecraft:inventory").container.getItem(p.selectedSlotIndex); } catch { continue; }
    if (!it || !isSword(it.typeId)) continue;
    const iid = infusionOf(it); if (!iid) continue;
    const c = ctx(p); if (c.k <= 0) continue;
    try {
      const l = p.location, v = p.getViewDirection(), r = { x: -v.z, z: v.x }, n = Math.hypot(r.x, r.z) || 1;
      const hand = { x: l.x + (r.x / n) * -0.38 + v.x * 0.5, y: l.y + 1.05 + Math.random() * 0.6, z: l.z + (r.z / n) * -0.38 + v.z * 0.5 };
      const I = INFUSIONS[iid];
      vfx(c, I.fam === "fire" ? "ember" : I.fam === "dark" ? "shard" : "glow", hand, { col: I.col, size: 0.12, life: 0.4, spd: 0.25, dir: [0, 1, 0], tile: 0 });
    } catch { /* ignore */ }
  }
}

// ------------------------------------------------------------------ interface (Relógio > Habilidades > Infusão da Espada)
export function openInfusion(p, back) {
  const h = heldSlot(p), it = h?.item;
  if (!it || !isSword(it.typeId)) return menu(p, "§l§5INFUSÃO DA ESPADA", "§7Segure a espada que vai receber a infusão e abra esta tela de novo.\n\n§8A infusão fica gravada na própria espada.", [{ text: "§7« Voltar", run: () => back?.() }]);
  const cur = infusionOf(it), name = ITEMS[it.typeId]?.name ?? it.typeId;
  const cats = [...WEAPON_CATS(it.typeId, ITEMS[it.typeId])].join(", ");
  const body = `§fEspada: §e${name}\n§7Categorias: §f${cats}\n§7Infusão atual: ${cur ? "§d" + INFUSIONS[cur].name + "\n§8" + INFUSIONS[cur].desc : "§8nenhuma"}\n\n§7Ativa sozinha ao acertar um golpe (mana + recarga). Básicas servem em qualquer espada; lendárias e míticas aceitam todas.`;
  const btn = Object.entries(INFUSIONS).map(([id, I]) => {
    const ok = compatible(it.typeId, id), why = ok ? playerReq(p, id) : "incompatível com esta espada";
    return { text: `${why ? "§8" : "§d§l"}${I.name}\n§r§7${TIERS[I.tier].name} · ${why ?? `${TIERS[I.tier].cost} moedas`}`, run: () => openOne(p, id, back) };
  });
  if (cur) btn.unshift({ text: "§c§lRemover infusão", run: () => { const e = removeInfusion(p); say(p, e ? "§c" + e : "§7Infusão removida."); openInfusion(p, back); } });
  btn.push({ text: "§7« Voltar", run: () => back?.() });
  menu(p, "§l§5INFUSÃO DA ESPADA", body, btn);
}
function openOne(p, id, back) {
  const I = INFUSIONS[id], h = heldSlot(p), ok = h?.item && compatible(h.item.typeId, id), why = ok ? playerReq(p, id) : "incompatível com esta espada";
  menu(p, `§l§5${I.name.toUpperCase()}`, `§7${I.desc}\n\n§fNível: §e${TIERS[I.tier].name}\n§fCusto: §e${I.mana} mana §7por ativação\n§fRecarga: §e${I.cd / 20}s\n§fDano extra: §e+${Math.round(I.mult * 100)}%§7 do golpe\n§fCategoria: §e${I.cat}\n\n${why ? "§c" + why : "§aPronta para aplicar (" + TIERS[I.tier].cost + " moedas)."}`, [
    ...(why ? [] : [{ text: "§a§lAPLICAR NESTA ESPADA", run: () => { const e = applyInfusion(p, id); say(p, e ? "§c" + e : `§d${I.name} §7foi infundida na espada.`); openInfusion(p, back); } }]),
    { text: "§7« Voltar", run: () => openInfusion(p, back) },
  ]);
}

export function startInfusion() { system.runInterval(bladeGlow, 8); }
export const __test = { WEAPON_CATS };

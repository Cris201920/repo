// systems/factions.js - MUNDO VIVO: reputação por facção, alianças do jogador, diplomacia entre facções, crime, guardas e consequências de chefes.
// Dados em data/factions.js. Estado do jogador em d.world {rep, ally, flags}; relações entre facções ficam na propriedade dinâmica do mundo "etheria:dipl".
import { world, system, Player } from "@minecraft/server";
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, toast, playSound } from "../core/utils.js";
import { FACTIONS, PLAYER_FACTIONS, TIERS, REP_MIN, REP_MAX, ALLY_AT, tierOf, DIPLOMACY_BASE, INCOMPATIBLE_AT, RELATION_NAMES, RELATION_COLORS, REP_KILL, CRIME, GUARD_RULES, BOSS_EFFECTS } from "../data/factions.js";
import { QUESTS } from "../data/quests.js";
import { WORLD_NPCS } from "../data/worldnpcs.gen.js";
import { onBoss } from "./quests.js";

// ---------------------------------------------------------------- estado do jogador
export function wd(d) {
  if (!d.world || typeof d.world !== "object") d.world = {};
  const w = d.world;
  if (!w.rep || typeof w.rep !== "object") w.rep = {};
  if (!w.ally || typeof w.ally !== "object") w.ally = {};
  if (!w.flags || typeof w.flags !== "object") w.flags = {};
  if (!Number.isFinite(w.defends)) w.defends = 0;
  return w;
}
export const repOf = (d, f) => wd(d).rep[f] ?? 0;
export const tierFor = (d, f) => tierOf(repOf(d, f));
export const isAlly = (d, f) => !!wd(d).ally[f];
export const hasFlag = (d, k) => !!wd(d).flags[k];
export function setFlag(player, k) { const w = wd(getData(player)); if (w.flags[k]) return; w.flags[k] = 1; markDirty(player); say(player, `§d[Mundo] §7Novo conteúdo desbloqueado: §f${k}`); }

// ---------------------------------------------------------------- diplomacia entre facções
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
let dipl = null;
function loadDipl() {
  if (dipl) return dipl;
  dipl = {};
  try { const raw = world.getDynamicProperty("etheria:dipl"); if (raw) dipl = JSON.parse(raw); } catch { dipl = {}; }
  return dipl;
}
function saveDipl() { try { world.setDynamicProperty("etheria:dipl", JSON.stringify(dipl)); } catch { /* ignore */ } }
export function relation(a, b) {
  if (a === b) return 2;
  const k = key(a, b), o = loadDipl();
  if (k in o) return o[k];
  const base = DIPLOMACY_BASE.find((r) => key(r[0], r[1]) === k);
  return base ? base[2] : 0;
}
export const relationName = (v) => `${RELATION_COLORS[v] ?? "§7"}${RELATION_NAMES[v] ?? "Neutra"}`;
export function changeRelation(a, b, dv, player) {
  const cur = relation(a, b), nv = Math.max(-3, Math.min(2, cur + dv));
  if (nv === cur) return nv;
  loadDipl()[key(a, b)] = nv; saveDipl();
  const fa = FACTIONS[a], fb = FACTIONS[b];
  if (fa && fb) for (const p of world.getAllPlayers()) { try { say(p, `§d§l[Diplomacia] §r§f${fa.color}${fa.short}§f e ${fb.color}${fb.short}§f: ${relationName(cur)} §f→ ${relationName(nv)}`); } catch { /* ignore */ } }
  return nv;
}

// ---------------------------------------------------------------- reputação
export function addFactionRep(player, f, n, why = "", spill = true) {
  if (!FACTIONS[f] || !n) return;
  const d = getData(player), w = wd(d), old = w.rep[f] ?? 0, before = tierOf(old);
  const nv = Math.max(REP_MIN, Math.min(REP_MAX, Math.round(old + n)));
  if (nv === old) return;
  w.rep[f] = nv; markDirty(player);
  const after = tierOf(nv), F = FACTIONS[f];
  if (Math.abs(n) >= 5 || after.id !== before.id) say(player, `${F.color}§l[${F.short}] §r§7${n > 0 ? "+" : ""}${n} reputação${why ? ` (${why})` : ""} §8| ${after.color}${after.name} §8(${nv})`);
  if (after.id !== before.id) {
    toast(player, `${F.color}§l${F.short}`, `${after.color}${after.name}`);
    if (nv > old) playSound(player, "random.levelup", 0.6, 1.2); else playSound(player, "mob.villager.no", 0.8, 1);
  }
  if (w.ally[f] && nv < ALLY_AT - 50) { delete w.ally[f]; say(player, `${F.color}§l[${F.short}] §r§cA aliança foi rompida: a sua reputação caiu demais.`); }
  // efeitos em cadeia pela diplomacia: aliados da facção gostam (25%), inimigos em guerra se incomodam (25%)
  if (spill) for (const g of PLAYER_FACTIONS) {
    if (g === f) continue;
    const rel = relation(f, g);
    if (rel >= 2) addFactionRep(player, g, Math.trunc(n * 0.25), "", false);
    else if (rel <= -3 && n > 0) addFactionRep(player, g, -Math.max(1, Math.trunc(n * 0.25)), "", false);
  }
}

// ---------------------------------------------------------------- aliança do jogador
const OATH_QUEST = { tempest: "tp_leader_defend", dwarf: "dw_king_audience", guy: "gc_envoy_trial", orc: "orc_trial" };
export function oathCheck(d, f) {
  if (!OATH_QUEST[f]) return "Esta facção não aceita juramentos.";
  if (isAlly(d, f)) return "Você já é aliado.";
  if (repOf(d, f) < ALLY_AT) return `Requer reputação ${ALLY_AT} (você tem ${repOf(d, f)})`;
  const q = OATH_QUEST[f];
  if (!d.quests.completed.includes(q)) return `Requer concluir a missão "${QUESTS[q]?.name ?? q}"`;
  for (const g of Object.keys(wd(d).ally)) if (wd(d).ally[g] && relation(f, g) <= INCOMPATIBLE_AT) return `Incompatível com a sua aliança com ${FACTIONS[g].short}`;
  return null;
}
export function swearOath(player, f) {
  const d = getData(player), why = oathCheck(d, f); if (why) return { ok: false, msg: why };
  wd(d).ally[f] = 1; markDirty(player); saveNow(player);
  const F = FACTIONS[f]; toast(player, `${F.color}§lALIANÇA`, `§7Aliado de ${F.short}`); playSound(player, "random.levelup", 1, 0.8);
  say(player, `${F.color}§l[${F.short}] §r§fVocê agora é §baliado§f de ${F.name}!`);
  return { ok: true, msg: `Aliança com ${F.short} jurada!` };
}
export function breakOath(player, f) {
  const d = getData(player); if (!isAlly(d, f)) return { ok: false, msg: "Você não é aliado." };
  delete wd(d).ally[f]; markDirty(player); addFactionRep(player, f, -80, "aliança rompida");
  return { ok: true, msg: `Aliança com ${FACTIONS[f].short} rompida.` };
}
/** multiplicador de preço pela reputação (aliado paga menos; quem é visto com desconfiança paga mais) */
export function priceMult(d, f) {
  const t = tierFor(d, f).id;
  return { enemy: 9, hostile: 9, wary: 1.25, neutral: 1, friendly: 0.95, ally: 0.85, champion: 0.75 }[t] ?? 1;
}
/** o serviço está bloqueado? (inimigos/hostis não são atendidos) */
export const refused = (d, f) => ["enemy", "hostile"].includes(tierFor(d, f).id);

// ---------------------------------------------------------------- consequências de chefes
function applyBossEffects(player, eff) {
  for (const [f, n] of Object.entries(eff.rep ?? {})) addFactionRep(player, f, n, "chefe derrotado");
  if (eff.say) say(player, `§d§l[Mundo] §r§f${eff.say}`);
  if (eff.unlock) setFlag(player, eff.unlock);
  for (const q of eff.quests ?? []) say(player, `§d[Mundo] §7Nova missão disponível: §f${QUESTS[q]?.name ?? q}`);
}
export function onBossDefeated(player, bossKey) {
  const eff = BOSS_EFFECTS[bossKey]; if (!eff) return;
  applyBossEffects(player, eff);
  for (const [a, b, dv] of eff.dipl ?? []) changeRelation(a, b, dv, player);
}

// ---------------------------------------------------------------- ganchos de mundo
const crimeAt = new Map(), warnAt = new Map();
const npcOf = (e) => { const id = e?.typeId; if (!id || !id.startsWith("etheria:npc_")) return null; return WORLD_NPCS[id.slice(12)] ?? null; };
function allyShare(player, f, n) { for (const g of PLAYER_FACTIONS) if (g !== f && relation(f, g) >= 2) addFactionRep(player, g, Math.trunc(n * CRIME.ally_share), "", false); }

export function startFactions() {
  // matar criaturas: reputação por facção + consequências de chefes (mobs)
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const v = ev.deadEntity, k = ev.damageSource?.damagingEntity;
      if (!(k instanceof Player)) return;
      const npc = npcOf(v);
      if (npc) { addFactionRep(k, npc.faction, CRIME.kill, "assassinato"); allyShare(k, npc.faction, CRIME.kill); say(k, "§c§l[Crime] §r§cVocê matou um cidadão. Os guardas saberão disso."); return; }
      const rk = REP_KILL[v.typeId];
      if (rk) for (const [f, n] of Object.entries(rk)) addFactionRep(k, f, n, "", true);
      const eff = BOSS_EFFECTS[v.typeId] ?? BOSS_EFFECTS[v.typeId.replace("etheria:", "")];
      if (eff) {
        let ps = []; try { ps = v.dimension.getPlayers({ location: v.location, maxDistance: 48 }); } catch { /* ignore */ }
        if (!ps.some((p) => p.id === k.id)) ps.push(k);
        const bk = v.typeId.replace("etheria:", "");
        for (const p of ps) { try { const dd = getData(p); dd.bossKills[bk] = (dd.bossKills[bk] ?? 0) + 1; markDirty(p); onBoss(p, bk); applyBossEffects(p, eff); } catch { /* ignore */ } }
        for (const [a, b, dv] of eff.dipl ?? []) changeRelation(a, b, dv, k);
      }
    } catch { /* ignore */ }
  });
  // agredir NPCs de uma nação: crime (com intervalo para não repetir a cada golpe)
  world.afterEvents.entityHurt.subscribe((ev) => {
    try {
      const h = ev.hurtEntity, k = ev.damageSource?.damagingEntity;
      if (!(k instanceof Player)) return;
      const npc = npcOf(h); if (!npc) return;
      const now = system.currentTick, last = crimeAt.get(k.id) ?? -999; if (now - last < 20) return; crimeAt.set(k.id, now);
      addFactionRep(k, npc.faction, CRIME.hit, "agressão"); allyShare(k, npc.faction, CRIME.hit);
      if (npc.kind !== "guard") say(k, `§c[${FACTIONS[npc.faction].short}] §7"Ele nos atacou! Chamem os guardas!"`);
    } catch { /* ignore */ }
  });
  // guardas: avisam quem está desconfiado e atacam quem é hostil à nação (1 laço, só perto dos guardas)
  system.runInterval(() => {
    const tick = system.currentTick;
    for (const p of world.getAllPlayers()) {
      try {
        const gs = p.dimension.getEntities({ location: p.location, maxDistance: 14, families: ["etheria_guard"] });
        if (gs.length === 0) continue;
        const d = getData(p), seenF = new Set();
        for (const g of gs) {
          const npc = npcOf(g); if (!npc || seenF.has(npc.faction)) continue; seenF.add(npc.faction);
          const rep = repOf(d, npc.faction), kk = p.id + npc.faction;
          if (rep <= GUARD_RULES.attackBelow) {
            p.applyDamage(GUARD_RULES.damage, { cause: "entityAttack", damagingEntity: g });
            try { const dx = p.location.x - g.location.x, dz = p.location.z - g.location.z, l = Math.hypot(dx, dz) || 1; p.applyKnockback(dx / l, dz / l, 0.5, 0.2); } catch { /* ignore */ }
            if (tick - (warnAt.get(kk) ?? -999) > 200) { warnAt.set(kk, tick); say(p, `§c[${FACTIONS[npc.faction].short}] §cGuardas! Há um inimigo dentro da cidade!`); }
          } else if (rep <= GUARD_RULES.warnBelow && tick - (warnAt.get(kk) ?? -999) > 600) {
            warnAt.set(kk, tick); say(p, `§6[${FACTIONS[npc.faction].short}] §7O guarda o encara: "Já sei quem você é. Um passo em falso e acabou."`);
          }
        }
      } catch { /* ignore */ }
    }
    if (warnAt.size > 300) warnAt.clear();
    if (crimeAt.size > 300) crimeAt.clear();
  }, GUARD_RULES.every);
}

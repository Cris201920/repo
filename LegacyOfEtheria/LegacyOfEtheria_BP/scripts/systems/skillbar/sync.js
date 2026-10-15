// systems/skillbar/sync.js - Sincronização inventário <-> dados (anti-duplicação, restauração, snapshot/rollback)
//
// Fluxo: scanInventory() -> planSync() (função PURA, testável) -> applyPlan() (com snapshot, verificação e rollback).
// Princípios (nesta ordem): UnlockedSkills (progresso) > SAVE (loadout/instâncias) > itens físicos > UI.
//  - Só mexe em itens de habilidade (`etheria:sk_*`). Itens do jogador (espada, armadura, materiais, livros) NUNCA são
//    removidos, trocados ou recriados pela sincronização; se algo não-habilidade mudar, tudo é desfeito (rollback).
//  - Não limpa nem recria o inventário: opera slot a slot.
//  - Cada habilidade equipada tem EXATAMENTE uma instância (id único); cópias e itens órfãos são removidos.
//  - Item sem espaço para recriar => fica pendente (nada é jogado no chão, nada se perde) e é reavisado depois.
import { world, system, EquipmentSlot } from "@minecraft/server";
import { SKILLBAR, INV_SIZE, HOTBAR_SIZE } from "../../config.js";
import { getData, markDirty } from "../../core/db.js";
import { inventory, isValid, say } from "../../core/utils.js";
import { emit, EV } from "../../core/bus.js";
import { skillIdOfItem, hasItemType } from "./registry.js";
import { createSkillItem, readInstance, newSid, skillLore } from "./item.js";

export const metrics = { scans: 0, plans: 0, created: 0, removedDup: 0, removedOrphan: 0, stamped: 0, relored: 0, rollbacks: 0, errors: 0, failedOps: 0, noSpace: 0, moves: 0 };

// ------------------------------------------------------------------ varredura (somente leitura)
function slotInfo(s, i) {
  const typeId = s.typeId;
  const e = { i, typeId, amount: s.amount, skill: skillIdOfItem(typeId), sid: null, sig: null };
  if (e.skill !== null) Object.assign(e, readInstance(s));
  return e;
}
function scanCursor(player) {
  try {
    const it = player.getComponent("minecraft:cursor_inventory")?.item; if (!it) return null;
    const skill = skillIdOfItem(it.typeId);
    return skill === null ? { typeId: it.typeId, skill: null } : { typeId: it.typeId, skill, ...readInstance(it) };
  } catch { return null; }
}
function offhandSlot(player) { try { return player.getComponent("minecraft:equippable")?.getEquipmentSlot(EquipmentSlot.Offhand); } catch { return undefined; } }
function scanOffhand(player) {
  try { const s = offhandSlot(player); if (!s || !s.hasItem()) return null; const e = slotInfo(s, "offhand"); return e; } catch { return null; }
}
export function scanInventory(player) {
  const c = inventory(player); if (!c) return null;
  metrics.scans++;
  const slots = new Array(INV_SIZE).fill(null), size = Math.min(c.size ?? INV_SIZE, INV_SIZE);
  for (let i = 0; i < size; i++) {
    try { const s = c.getSlot(i); if (s.hasItem()) slots[i] = slotInfo(s, i); } catch { /* slot ilegível: ignora */ }
  }
  return { slots, size, cursor: scanCursor(player), offhand: scanOffhand(player) };
}

// ------------------------------------------------------------------ plano (função pura)
/**
 * state: resultado de scanInventory. want: { equipped:[ids], pos:{id:slot}, inst:{id:sid}, selected:int, sigOf:(id)=>sig, mkSid:()=>sid }
 * Retorna { ops, pos, inst, missing }. Nenhuma API do jogo é chamada aqui.
 */
export function planSync(state, want) {
  const ops = [], missing = [], pos = { ...want.pos }, inst = { ...want.inst };
  const occupied = state.slots.map((e) => !!e);
  const eq = new Set(want.equipped);
  const found = new Map();
  const consider = (id, ref) => {
    if (!eq.has(id)) { ops.push({ type: "remove", loc: ref.loc, skill: id, reason: "orphan" }); if (typeof ref.loc === "number") occupied[ref.loc] = false; return; }
    if (!found.has(id)) found.set(id, []);
    found.get(id).push(ref);
  };
  state.slots.forEach((e) => { if (e && e.skill !== null) consider(e.skill, { loc: e.i, sid: e.sid, sig: e.sig }); });
  if (state.offhand && state.offhand.skill !== null) consider(state.offhand.skill, { loc: "offhand", sid: state.offhand.sid, sig: state.offhand.sig });
  if (state.cursor && state.cursor.skill !== null) consider(state.cursor.skill, { loc: "cursor", sid: state.cursor.sid, sig: state.cursor.sig });

  const pickFree = (id) => {
    const p = pos[id];
    if (Number.isInteger(p) && p >= 0 && p < state.size && !occupied[p]) return p;
    for (let i = 0; i < Math.min(HOTBAR_SIZE, state.size); i++) if (!occupied[i]) return i;
    for (let i = HOTBAR_SIZE; i < state.size; i++) if (!occupied[i]) return i;
    return -1;
  };
  const rank = (id, r) => (r.sid && r.sid === inst[id] ? 0 : 100) + (typeof r.loc === "number" ? r.loc : r.loc === "offhand" ? 50 : 60);

  for (const id of want.equipped) {
    const list = (found.get(id) ?? []).sort((a, b) => rank(id, a) - rank(id, b));
    if (list.length) {
      const keep = list[0];
      for (const extra of list.slice(1)) {
        ops.push({ type: "remove", loc: extra.loc, skill: id, reason: "duplicate" });
        if (typeof extra.loc === "number") occupied[extra.loc] = false;
      }
      if (keep.sid && keep.sid === inst[id]) { /* instância legítima */ }
      else if (keep.sid) inst[id] = keep.sid;                                   // adota a única instância existente (ex.: save restaurado)
      else if (keep.loc !== "cursor") { const sid = want.mkSid(); inst[id] = sid; ops.push({ type: "stamp", loc: keep.loc, skill: id, sid }); }
      if (typeof keep.loc === "number") pos[id] = keep.loc;
      if (typeof keep.loc === "number" && keep.loc !== want.selected && want.sigOf) {
        const sig = want.sigOf(id);
        if (sig && keep.sig !== sig) ops.push({ type: "relore", loc: keep.loc, skill: id });
      }
    } else {
      const slot = pickFree(id);
      if (slot < 0) { missing.push(id); continue; }
      const sid = want.mkSid(); inst[id] = sid; occupied[slot] = true; pos[id] = slot;
      ops.push({ type: "create", slot, skill: id, sid });
    }
  }
  for (const id of Object.keys(pos)) if (!eq.has(id)) delete pos[id];
  for (const id of Object.keys(inst)) if (!eq.has(id)) delete inst[id];
  // remoções primeiro (liberam slots), depois marcações, criações e textos
  const order = { remove: 0, stamp: 1, create: 2, relore: 3 };
  ops.sort((a, b) => order[a.type] - order[b.type]);
  return { ops, pos, inst, missing };
}

// ------------------------------------------------------------------ snapshot / verificação / rollback
function snapshot(c) {
  const items = [], manifest = [];
  for (let i = 0; i < INV_SIZE; i++) {
    let it; try { it = c.getItem(i); } catch { it = undefined; }
    items.push(it);
    manifest.push(it && skillIdOfItem(it.typeId) === null ? `${it.typeId}:${it.amount}:${it.nameTag ?? ""}` : "");
  }
  return { items, manifest };
}
function manifestNow(c) {
  const m = [];
  for (let i = 0; i < INV_SIZE; i++) {
    try { const s = c.getSlot(i); m.push(s.hasItem() && skillIdOfItem(s.typeId) === null ? `${s.typeId}:${s.amount}:${s.nameTag ?? ""}` : ""); } catch { m.push("?"); }
  }
  return m;
}
const sameManifest = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
function rollback(c, snap) {
  for (let i = 0; i < INV_SIZE; i++) { try { c.setItem(i, snap.items[i]); } catch { /* melhor esforço */ } }
}

// ------------------------------------------------------------------ aplicação
function execOp(player, c, op) {
  if (op.type === "remove") {
    if (op.loc === "cursor") player.getComponent("minecraft:cursor_inventory")?.clear();
    else if (op.loc === "offhand") offhandSlot(player)?.setItem(undefined);
    else c.setItem(op.loc, undefined);
    return;
  }
  if (op.type === "stamp") {
    const s = op.loc === "offhand" ? offhandSlot(player) : c.getSlot(op.loc);
    s.setDynamicProperty(SKILLBAR.sidKey, op.sid); return;
  }
  if (op.type === "create") {
    const s = c.getSlot(op.slot);
    if (s.hasItem()) throw new Error(`slot ${op.slot} ocupado`);
    c.setItem(op.slot, createSkillItem(player, op.skill, op.sid)); return;
  }
  if (op.type === "relore") {
    const s = op.loc === "offhand" ? offhandSlot(player) : c.getSlot(op.loc);
    const { lines, sig } = skillLore(player, op.skill);
    s.setLore(lines); s.setDynamicProperty(SKILLBAR.sigKey, sig); return;
  }
}
export function applyPlan(player, plan) {
  const res = { ok: true, applied: 0, failed: 0, rolledBack: false, created: [], removed: [], stamped: 0, relored: 0 };
  const c = inventory(player);
  if (!c || plan.ops.length === 0) return res;
  const snap = snapshot(c);
  const failedCreate = new Set();
  for (const op of plan.ops) {
    try {
      execOp(player, c, op); res.applied++;
      if (op.type === "create") { res.created.push(op.skill); metrics.created++; }
      else if (op.type === "remove") { res.removed.push(op.skill); op.reason === "duplicate" ? metrics.removedDup++ : metrics.removedOrphan++; }
      else if (op.type === "stamp") { res.stamped++; metrics.stamped++; }
      else if (op.type === "relore") { res.relored++; metrics.relored++; }
    } catch (e) {
      res.failed++; metrics.failedOps++;
      if (op.type === "create") failedCreate.add(op.skill);
      console.warn(`[Etheria] sync ${op.type} ${op.skill}: ${e}`);
    }
  }
  // verificação: nada que NÃO seja item de habilidade pode ter mudado
  let after; try { after = manifestNow(c); } catch { after = null; }
  if (!after || !sameManifest(snap.manifest, after)) {
    rollback(c, snap); res.rolledBack = true; res.ok = false; metrics.rollbacks++;
    console.warn(`[Etheria] sync de ${player.name}: item de outro tipo mudou durante a sincronização; revertido.`);
    emit(EV.HOTBAR_ROLLBACK, { player });
    return res;
  }
  res.failedCreate = failedCreate;
  return res;
}

// ------------------------------------------------------------------ reconciliação (dados <-> inventário)
const lastNotice = new Map();   // playerId -> tick do último aviso "sem espaço"
const fails = new Map();        // playerId -> {n, until}

function alive(player) {
  try { const h = player.getComponent("minecraft:health"); return !h || h.currentValue > 0; } catch { return true; }
}

/** Confere e corrige os itens de habilidade do jogador. Idempotente e seguro para chamar a qualquer momento. */
export function reconcile(player, reason = "periodic", opts = {}) {
  if (!isValid(player) || !alive(player)) return null;
  const f = fails.get(player.id);
  if (f && f.until > system.currentTick && !opts.force) return null;
  try {
    const d = getData(player);
    const state = scanInventory(player); if (!state) return null;
    const plan = planSync(state, {
      equipped: d.equippedSkills.filter(hasItemType), pos: d.loadout?.pos ?? {}, inst: d.skillInst ?? {}, selected: opts.keepSelected === false ? -1 : player.selectedSlotIndex,
      sigOf: (id) => skillLore(player, id).sig, mkSid: newSid,
    });
    metrics.plans++;
    const res = applyPlan(player, plan);
    if (res.rolledBack || res.failed > 0) {   // falha persistente (ex.: tipo de item inválido): espera cada vez mais antes de tentar de novo, sem spam de log
      const n = (fails.get(player.id)?.n ?? 0) + 1;
      fails.set(player.id, { n, until: system.currentTick + Math.min(1200, 40 * 2 ** Math.min(n, 5)) });
      if (res.rolledBack) return res;
    } else fails.delete(player.id);
    // grava só o que mudou
    let changed = false;
    const inst = { ...plan.inst }; for (const id of res.failedCreate ?? []) delete inst[id];
    const pos = { ...plan.pos }; for (const id of res.failedCreate ?? []) delete pos[id];
    if (JSON.stringify(inst) !== JSON.stringify(d.skillInst)) { d.skillInst = inst; changed = true; }
    if (JSON.stringify(pos) !== JSON.stringify(d.loadout.pos)) { d.loadout.pos = pos; changed = true; }
    if (changed) markDirty(player);
    if (plan.missing.length) {
      metrics.noSpace++;
      const now = system.currentTick;
      if (now - (lastNotice.get(player.id) ?? -9999) > 1200) {
        lastNotice.set(player.id, now);
        say(player, "§e[Habilidades] §7Inventário cheio: libere um espaço para receber o item de uma habilidade equipada.");
        emit(EV.HOTBAR_FULL, { player, missing: plan.missing });
      }
    }
    if (res.applied > 0) {
      emit(EV.HOTBAR_SYNCED, { player, reason, ...res });
      if (res.removed.length || res.created.length) emit(EV.HOTBAR_REPAIRED, { player, reason, created: res.created, removed: res.removed });
    }
    return res;
  } catch (e) {
    metrics.errors++;
    const n = (fails.get(player.id)?.n ?? 0) + 1;
    fails.set(player.id, { n, until: system.currentTick + Math.min(400, 20 * n) });
    console.warn(`[Etheria] reconcile ${player.name}: ${e}`);
    return null;
  }
}

// ------------------------------------------------------------------ operações explícitas sobre itens
/** Remove (se existir) o item físico de uma habilidade — usado ao desequipar. Nada além do item da habilidade é tocado. */
export function removeSkillItem(player, id) {
  const state = scanInventory(player); if (!state) return 0;
  const ops = [];
  state.slots.forEach((e) => { if (e && e.skill === id) ops.push({ type: "remove", loc: e.i, skill: id, reason: "orphan" }); });
  if (state.offhand?.skill === id) ops.push({ type: "remove", loc: "offhand", skill: id, reason: "orphan" });
  if (state.cursor?.skill === id) ops.push({ type: "remove", loc: "cursor", skill: id, reason: "orphan" });
  if (!ops.length) return 0;
  const res = applyPlan(player, { ops });
  return res.removed.length;
}

function multiset(c) {
  const m = new Map();
  for (let i = 0; i < INV_SIZE; i++) {
    try { const s = c.getSlot(i); if (!s.hasItem()) continue; const k = `${s.typeId}:${s.amount}:${s.nameTag ?? ""}:${readInstance(s).sid ?? ""}`; m.set(k, (m.get(k) ?? 0) + 1); } catch { /* ignore */ }
  }
  return m;
}
const sameMulti = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

/**
 * Move o item da habilidade para `toSlot` (0-35). Se o destino tiver outro item (qualquer tipo), os dois TROCAM de lugar:
 * nada é descartado nem sobrescrito. Verifica que o conjunto de itens não mudou; senão desfaz.
 */
export function moveSkillItem(player, id, toSlot) {
  if (!Number.isInteger(toSlot) || toSlot < 0 || toSlot >= INV_SIZE) return { ok: false, reason: "slot" };
  const c = inventory(player); if (!c) return { ok: false, reason: "inv" };
  const d = getData(player);
  reconcile(player, "pre-move", { force: true });
  const state = scanInventory(player);
  const from = state?.slots.findIndex((e) => e && e.skill === id) ?? -1;
  if (from < 0) return { ok: false, reason: "absent" };
  if (from === toSlot) return { ok: true, same: true, from, to: toSlot };
  const snap = snapshot(c), before = multiset(c);
  let swapped = false;
  try { c.swapItems(from, toSlot, c); swapped = true; } catch (e) { console.warn(`[Etheria] swapItems: ${e}`); }
  if (!swapped) {   // alternativa manual (troca de dois slots)
    try { const a = c.getItem(from), b = c.getItem(toSlot); c.setItem(toSlot, a); c.setItem(from, b); } catch (e) { console.warn(`[Etheria] troca manual: ${e}`); }
  }
  if (!sameMulti(before, multiset(c))) { rollback(c, snap); metrics.rollbacks++; return { ok: false, reason: "rollback" }; }
  metrics.moves++;
  d.loadout.pos[id] = toSlot;
  const other = state.slots[toSlot];
  if (other && other.skill && other.skill !== id) d.loadout.pos[other.skill] = from;
  markDirty(player);
  return { ok: true, from, to: toSlot, swappedWith: other?.typeId ?? null, otherSkill: other?.skill ?? null };
}

/** Quantos slots do inventário estão livres (para avisar antes de equipar). */
export function freeSlots(player) {
  const s = scanInventory(player); if (!s) return 0;
  return s.slots.reduce((n, e) => n + (e ? 0 : 1), 0);
}
/** Descrição dos 9 slots da hotbar (para o menu). */
export function describeHotbar(player) {
  const s = scanInventory(player), out = [];
  for (let i = 0; i < HOTBAR_SIZE; i++) { const e = s?.slots[i]; out.push({ slot: i, empty: !e, skill: e?.skill ?? null, typeId: e?.typeId ?? null, amount: e?.amount ?? 0 }); }
  return out;
}
export function skillSlotOf(player, id) {
  const s = scanInventory(player); if (!s) return -1;
  return s.slots.findIndex((e) => e && e.skill === id);
}

// ------------------------------------------------------------------ agendamento
const pending = new Map();   // playerId -> { reason, at }
const ready = new Set();     // jogadores já inicializados
export const markReady = (id) => ready.add(id);
export function requestSync(player, reason = "event", delay = 2) {
  const at = system.currentTick + delay, cur = pending.get(player.id);
  if (!cur || cur.at > at) pending.set(player.id, { reason, at });
}
export function dropSync(id) { pending.delete(id); ready.delete(id); lastNotice.delete(id); fails.delete(id); }

export function startSync() {
  system.runInterval(() => {
    const now = system.currentTick;
    let players; try { players = world.getAllPlayers(); } catch { return; }
    for (const p of players) {
      if (!ready.has(p.id)) continue;
      const req = pending.get(p.id);
      if (req && req.at <= now) { pending.delete(p.id); reconcile(p, req.reason); continue; }
      if (now % SKILLBAR.syncTicks < 5) { try { reconcile(p, "periodic"); } catch (e) { metrics.errors++; } }
    }
  }, 5);
  // Item de habilidade no chão (qualquer caminho que escape do bloqueio): remove e a conferência recria o item no inventário.
  try {
    world.afterEvents.entitySpawn.subscribe((ev) => {
      try {
        const e = ev.entity; if (!e || e.typeId !== "minecraft:item") return;
        const it = e.getComponent("minecraft:item")?.itemStack;
        if (it && skillIdOfItem(it.typeId) !== null) { e.remove(); }
      } catch { /* entidade já inválida */ }
    });
  } catch (e) { console.warn(`[Etheria] entitySpawn indisponível: ${e}`); }
}

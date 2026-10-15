// core/utils.js - Funções utilitárias sem dependência de sistemas
import { ItemStack } from "@minecraft/server";

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function isValid(e) {
  try { return !!e && (typeof e.isValid === "function" ? e.isValid() : !!e.isValid); } catch { return false; }
}
export function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
export function add(a, b, s = 1) { return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s }; }
export function norm(v) { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; }
export function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
export function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }

export function bar(cur, max, len = 10, color = "§a") {
  const f = Math.round(clamp(cur / Math.max(1, max), 0, 1) * len);
  return color + "█".repeat(f) + "§8" + "█".repeat(len - f) + "§r";
}
export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}
export function roman(n) { return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] ?? String(n); }

export function inventory(player) {
  try { return player.getComponent("minecraft:inventory")?.container; } catch { return undefined; }
}
export function giveItem(player, typeId, count = 1) {
  const c = inventory(player); if (!c) return false;
  const it = new ItemStack(typeId, count);
  const left = c.addItem(it);
  if (left) { try { player.dimension.spawnItem(left, player.location); } catch { /* ignore */ } }
  return true;
}
export function countItem(player, typeId) {
  const c = inventory(player); if (!c) return 0;
  let n = 0;
  for (let i = 0; i < c.size; i++) { const it = c.getItem(i); if (it && it.typeId === typeId) n += it.amount; }
  return n;
}
export function removeItem(player, typeId, count) {
  const c = inventory(player); if (!c || countItem(player, typeId) < count) return false;
  let left = count;
  for (let i = 0; i < c.size && left > 0; i++) {
    const it = c.getItem(i);
    if (!it || it.typeId !== typeId) continue;
    if (it.amount <= left) { left -= it.amount; c.setItem(i, undefined); }
    else { it.amount -= left; c.setItem(i, it); left = 0; }
  }
  return true;
}
export function healthComp(e) { try { return e.getComponent("minecraft:health"); } catch { return undefined; } }
export function heal(e, amount) {
  const h = healthComp(e); if (!h) return;
  try { h.setCurrentValue(clamp(h.currentValue + amount, 0, h.effectiveMax)); } catch { /* entidade inválida */ }
}
export function playSound(player, id, volume = 1, pitch = 1) {
  try { player.playSound(id, { volume, pitch }); } catch { /* ignore */ }
}
export function say(player, msg) { try { player.sendMessage(msg); } catch { /* ignore */ } }
export function toast(player, title, sub = "") {
  try { player.onScreenDisplay.setTitle(title, { stayDuration: 40, fadeInDuration: 5, fadeOutDuration: 10, subtitle: sub }); } catch { /* ignore */ }
}

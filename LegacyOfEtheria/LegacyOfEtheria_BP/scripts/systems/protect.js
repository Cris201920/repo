// systems/protect.js - PROTEÇÃO DE ITENS IMPORTANTES: o que o jogador não pode perder ao morrer.
//
// Usa a proteção NATIVA do Bedrock (ItemStack/ContainerSlot.keepOnDeath): o item sobrevive à morte e volta no inventário, sem script no momento da morte.
//   · Livro do Sábio e Tomo de Habilidades: além disso ficam travados no inventário (lockMode = inventory): não caem no chão, não vão para baú.
//   · Itens de evolução e de "upar": pergaminhos de experiência e de habilidade, artefatos (sigilos), itens de missão, anéis e amuletos,
//     materiais épicos e lendários (núcleo de evolução, essências, lingotes raros, cristais) e a espada inicial.
// Como o item pode chegar por saque, troca ou fabricação (sem a marca), uma varredura leve (a cada 10 ticks, só o inventário do jogador, só leitura
// do tipo) marca o que faltar. Nada é recriado nem movido: só a marca é ligada no mesmo slot, então nada duplica e nada se perde.
// Rede de segurança: ao RENASCER, se o Livro/Tomo/Relógio não estiverem no inventário (ex.: itens antigos sem a marca), eles são devolvidos UMA vez.
// Limites (honestos): morte por /kill em modo criativo, itens já perdidos antes desta versão e a regra "keepInventory" do mundo não são tratados aqui.
import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import { getData } from "../core/db.js";
import { inventory } from "../core/utils.js";
import { ITEMS } from "../data/items.gen.js";
import { GreatSageLogger as Log } from "../core/logger.js";

const SWEEP_TICKS = 10, RESTORE_DELAY = 40;
const LOCKED = new Set(["etheria:sage_book", "etheria:skill_tome"]);
const KEEP_IDS = new Set(["etheria:xp_scroll", "etheria:skill_scroll", "etheria:coin_pouch", "etheria:iron_blade", "etheria:evolution_core"]);
const KEEP_KINDS = new Set(["artifact", "quest", "accessory"]);
const KEEP_MATERIAL_RARITY = new Set(["epic", "legendary", "mythic", "divine"]);

const cache = new Map();   // typeId -> 0 (nada) | 1 (mantém na morte) | 2 (mantém e trava)
/** Política de proteção de um tipo de item. */
export function protectionOf(typeId) {
  let v = cache.get(typeId); if (v !== undefined) return v;
  const inf = ITEMS[typeId];
  v = LOCKED.has(typeId) ? 2 : (KEEP_IDS.has(typeId) || (inf && (KEEP_KINDS.has(inf.kind) || (inf.kind === "material" && KEEP_MATERIAL_RARITY.has(inf.rarity))))) ? 1 : 0;
  cache.set(typeId, v); return v;
}
export const isProtected = (typeId) => protectionOf(typeId) > 0;

const stats = { sweeps: 0, marked: 0, restored: 0, errors: 0 };
export const protectStats = () => ({ ...stats });

/** Liga a marca nos slots do inventário que ainda não a têm. Devolve quantos slots foram marcados. */
export function sweepProtect(player) {
  const c = inventory(player); if (!c) return 0;
  let n = 0;
  for (let i = 0; i < c.size; i++) {
    try {
      const it = c.getItem(i); if (!it) continue;
      const pol = protectionOf(it.typeId); if (!pol) continue;
      const slot = c.getSlot(i);
      if (!slot.keepOnDeath) { slot.keepOnDeath = true; n++; }
      if (pol === 2 && slot.lockMode !== ItemLockMode.inventory) { slot.lockMode = ItemLockMode.inventory; n++; }
    } catch (e) { stats.errors++; Log.debug(`proteção slot ${i}: ${e}`, "Proteção"); }
  }
  stats.sweeps++; stats.marked += n; return n;
}

/** Cria o item já protegido (usado ao devolver o que faltar). */
export function protectedStack(typeId, count = 1) {
  const it = new ItemStack(typeId, count);
  try { it.keepOnDeath = true; } catch { /* ignore */ }
  if (protectionOf(typeId) === 2) { try { it.lockMode = ItemLockMode.inventory; } catch { /* ignore */ } }
  return it;
}

const has = (c, typeId) => { for (let i = 0; i < c.size; i++) { try { if (c.getItem(i)?.typeId === typeId) return true; } catch { /* ignore */ } } return false; };

/** Devolve o Livro do Sábio, o Tomo e o Relógio se sumiram do inventário (só depois de renascer). Cada um só se o jogador já os recebeu um dia. */
export function restoreEssentials(player) {
  const c = inventory(player), d = getData(player); if (!c) return [];
  const want = [];
  if (d.sageGiven) want.push(["etheria:sage_book", "Livro do Grande Sábio"]);
  if (d.kit) want.push(["etheria:skill_tome", "Tomo de Habilidades"], ["minecraft:clock", "Relógio"]);
  const given = [];
  for (const [id, name] of want) {
    if (has(c, id)) continue;
    try {
      const left = c.addItem(protectedStack(id));
      if (left) { try { player.dimension.spawnItem(left, player.location); } catch { /* ignore */ } }
      given.push(name); stats.restored++;
    } catch (e) { stats.errors++; Log.error(`restaurar ${id}: ${e}`, "Proteção"); }
  }
  if (given.length) { try { player.sendMessage(`§b[Sábio] §7Itens essenciais devolvidos: §f${given.join(", ")}§7.`); } catch { /* ignore */ } }
  return given;
}

let started = false;
export function startProtect() {
  if (started) return; started = true;
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) { try { sweepProtect(p); } catch (e) { stats.errors++; } }
  }, SWEEP_TICKS);
  // renascer: espera os itens mantidos voltarem e só então confere o que falta
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (ev.initialSpawn) return;
    const p = ev.player;
    system.runTimeout(() => { try { if (p.isValid) { sweepProtect(p); restoreEssentials(p); } } catch (e) { stats.errors++; } }, RESTORE_DELAY);
  });
}

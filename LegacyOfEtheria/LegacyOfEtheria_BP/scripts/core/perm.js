// core/perm.js - Quem pode gerar estruturas/arenas na hora: tag de administrador, operador do mundo, ou o único jogador (mundo solo).
import { world } from "@minecraft/server";
import { ADMIN_TAG } from "../config.js";

export function canBuild(p) {
  try { if (p.hasTag(ADMIN_TAG)) return true; } catch { /* ignore */ }
  try { if (world.getAllPlayers().length <= 1) return true; } catch { /* ignore */ }
  try { if ((p.playerPermissionLevel ?? 0) >= 2) return true; } catch { /* ignore */ }   // 2 = Operador
  try { if ((p.commandPermissionLevel ?? 0) >= 1) return true; } catch { /* ignore */ }
  try { if (typeof p.isOp === "function" && p.isOp()) return true; } catch { /* ignore */ }
  return false;
}

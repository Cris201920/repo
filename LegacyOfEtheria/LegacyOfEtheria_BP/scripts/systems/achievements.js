// systems/achievements.js - Conquistas e títulos (6.54: Grande Sábio 2.0)
// - confere as conquistas de data/achievements.js só com o estado REAL do jogador (chamado depois de cada mudança relevante);
// - registra ordem e horário de cada desbloqueio (d.achLog), nunca duplica (o id entra uma vez em d.achievements);
// - recompensa: moedas e título (como antes) + XP pela raridade, entregue uma vez, depois de conferir tudo (sem recursão no meio);
// - aviso: cena da Voz do Mundo com a raridade; vários desbloqueios de uma vez (ex.: primeira entrada depois de atualizar o addon)
//   viram UM resumo, sem encher a tela; tudo também fica na Memória do Grande Sábio e emite ACHIEVEMENT_UNLOCKED no barramento.
import { announceInfo } from "./sageannounce.js";
import { getData, markDirty } from "../core/db.js";
import { say, playSound } from "../core/utils.js";
import { ACHIEVEMENTS, RARITY } from "../data/achievements.js";
import { SOUNDS } from "../config.js";
import { emit, EV } from "../core/bus.js";
import { remember } from "./sageknow.js";
import { sageText } from "./voice.js";

import { addXp } from "./level.js";   // ciclo level <-> achievements só é usado em tempo de execução (seguro em módulos ES)
function xpLater(player, xp) { try { addXp(player, xp); } catch { /* ignore */ } }
const rar = (a) => RARITY[a.rarity] ?? RARITY.comum;
export const rewardXp = (a) => a.xp ?? rar(a).xp;
/** [atual, meta] de uma conquista acumulativa (ou null). */
export function achProgress(d, a) { try { return a.prog ? a.prog(d) : null; } catch { return null; } }
/** As n conquistas bloqueadas mais perto de serem concluídas (para as recomendações do Sábio). */
export function nearestAchievements(d, n = 3) {
  const got = new Set(d.achievements);
  return ACHIEVEMENTS.filter((a) => !got.has(a.id)).map((a) => { const p = achProgress(d, a); return { a, p, f: p ? p[0] / Math.max(1, p[1]) : 0 }; })
    .filter((x) => x.p && x.f > 0).sort((x, y) => y.f - x.f).slice(0, n);
}

export function checkAchievements(player) {
  const d = getData(player); d.achLog ??= [];
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (d.achievements.includes(a.id)) continue;
    let ok = false; try { ok = !!a.check(d); } catch { ok = false; }
    if (!ok) continue;
    d.achievements.push(a.id);
    d.achLog.push({ id: a.id, t: Date.now(), n: d.achievements.length });
    if (d.achLog.length > 200) d.achLog.shift();
    if (a.title && !d.titles.includes(a.title)) d.titles.push(a.title);
    if (a.coins) d.coins += a.coins;
    got.push(a);
  }
  if (!got.length) return [];
  markDirty(player);
  const xp = got.reduce((s, a) => s + rewardXp(a), 0);
  for (const a of got) {
    try { remember(player, "ach", `Conquista ${rar(a).name}: ${a.name}`); } catch { /* ignore */ }
    try { emit(EV.ACHIEVEMENT_UNLOCKED, { player, id: a.id, name: a.name, rarity: a.rarity }); } catch { /* ignore */ }
  }
  if (got.length <= 2) {
    for (const a of got) {
      const R = rar(a), rew = [a.coins ? `+${a.coins} moedas` : "", `+${rewardXp(a)} XP`, a.title ? `título "${a.title}"` : ""].filter(Boolean).join(" · ");
      announceInfo(player, `CONQUISTA ${R.name.toUpperCase()}`, a.name, `${a.desc}  ${rew}`, R.tier);
      say(player, `${R.col}§l[Conquista ${R.name}]§r §f${a.name} §8— §7${a.desc} §8(${rew})`);
    }
  } else {
    const best = got.slice().sort((x, y) => rar(y).order - rar(x).order)[0], R = rar(best);
    announceInfo(player, `${got.length} CONQUISTAS`, best.name, `e mais ${got.length - 1} · +${xp} XP · veja no Relógio > Conquistas`, R.tier);
    say(player, `§6§l[Conquistas]§r §f${got.length} registradas: ${got.map((a) => `${rar(a).col}${a.name}`).join("§7, ")} §8(+${xp} XP)`);
  }
  playSound(player, SOUNDS.quest);
  // fala do Sábio só para as raras de verdade (sem voz a cada conquista comum)
  const top = got.reduce((m, a) => (rar(a).order > rar(m).order ? a : m), got[0]);
  if (rar(top).order >= 3) { try { sageText(player, `Conquista ${rar(top).name.toLowerCase()} registrada: ${top.name}. Excelente progresso.`, { pri: 3, key: "ach." + top.id }); } catch { /* ignore */ } }
  xpLater(player, xp);
  return got;
}

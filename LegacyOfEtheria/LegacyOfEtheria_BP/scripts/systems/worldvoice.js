// systems/worldvoice.js - VOZ DO MUNDO (6.29): cerimônia em TELA CHEIA animada, no estilo do anime (despertar de Lorde Demônio, evolução do Sábio,
// habilidades adquiridas). O título leva o marcador invisível "§w§v§x" + código de tema; o pacote de recursos (ui/hud_screen.json) reconhece e desenha:
// fundo preto, núcleo animado (estrelas, raios girando, icosaedro em wireframe, brilho pulsante), título grande e o texto revelado aqui, linha por linha.
// O script só controla O QUE aparece e QUANDO; a animação roda na própria interface (flip-book de 24 quadros), sem custo de partículas.
// Segurança: a tela some sozinha ao terminar, ao morrer, ao sair do mundo ou por erro (título sem marcador). Opção do jogador: d.settings.cinematic === false.
import { world, system } from "@minecraft/server";
import { getData } from "../core/db.js";
import { titleGuard } from "../core/utils.js";

export const VOICE_MARK = "§w§v§x";
const TH = { world: "§t§w", sage: "§t§s", raphael: "§t§r", ciel: "§t§c", tree: "§t§p" };
const active = new Map();   // playerId -> { token, title, sub, keep }
const ok = (p) => { try { return p.isValid; } catch { return false; } };
export const voiceActive = (p) => { try { return active.has(p.id); } catch { return false; } };
titleGuard.busy = voiceActive;
export const voiceEnabled = (p) => { try { return getData(p)?.settings?.cinematic !== false; } catch { return true; } };

function render(p, s) {
  try { p.onScreenDisplay.setTitle(`${VOICE_MARK}${TH[s.theme] ?? TH.world}§r${s.title}`, { subtitle: s.sub || " ", fadeInDuration: 0, stayDuration: 200, fadeOutDuration: 0 }); } catch { /* ignore */ }
}
/** apaga a tela da Voz do Mundo (título sem marcador = a interface volta ao jogo) */
export function voiceClear(p) {
  try { const s = active.get(p.id); if (s?.keep) system.clearRun(s.keep); } catch { /* ignore */ }
  try { active.delete(p.id); } catch { /* ignore */ }
  try { p.onScreenDisplay.setTitle(" ", { subtitle: " ", fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 }); p.onScreenDisplay.setActionBar(" "); } catch { /* ignore */ }
}
const snd = (p, id, v = 1, pitch = 1) => { try { p.playSound(id, { volume: v, pitch }); } catch { /* ignore */ } };

/**
 * worldVoice(p, {
 *   theme: "world" | "sage" | "raphael" | "ciel" | "tree",
 *   title: "§cVERDADEIRO LORDE DEMÔNIO",
 *   sound: "etheria.sage.ceremony.true_demon_lord",          // opcional, toca na abertura
 *   narration: ["O Festival da Colheita está completo.", ...], // aparecem uma a uma sob o título
 *   groups: [{ title?: "Predador", header: "HABILIDADE ÚNICA", col: "§6", items: ["Mimetismo", ...], snd?: "etheria.sage.tier.unique" }],
 *   pace: 1 (multiplicador de tempo), onDone })
 * Duração típica: 6–20 s. Uma cerimônia por vez por jogador (a nova substitui a anterior).
 */
export function worldVoice(p, o) {
  if (!ok(p)) return false;
  if (!voiceEnabled(p)) {   // sem cinemática: resumo no chat
    try { p.sendMessage(`${o.title}§r\n§7${(o.narration ?? []).join(" ")}${(o.groups ?? []).map((g) => `\n${g.col ?? "§e"}${g.header}: §f${g.items.join(", ")}`).join("")}`); } catch { /* ignore */ }
    o.onDone?.(); return false;
  }
  const prev = active.get(p.id); if (prev?.keep) system.clearRun(prev.keep);
  const token = Symbol(), k = o.pace ?? 1, T = (n) => Math.max(1, Math.round(n * k));
  const s = { token, theme: o.theme ?? "world", title: o.title, sub: "" };
  active.set(p.id, s);
  const live = () => ok(p) && active.get(p.id)?.token === token;
  const at = (t, fn) => system.runTimeout(() => { if (live()) { try { fn(); } catch (e) { console.warn(`[Etheria] Voz do Mundo: ${e}`); } } }, Math.max(1, t));
  // mantém a tela viva entre as etapas (o título expira em 10 s sem novo envio)
  s.keep = system.runInterval(() => { if (!live()) { system.clearRun(s.keep); return; } render(p, s); }, 100);
  render(p, s);
  if (o.sound) snd(p, o.sound, 1);
  snd(p, "etheria.sage.sfx.open", 0.8);
  let t = T(30);
  for (const line of o.narration ?? []) {
    at(t, () => { s.sub = `§f${line}`; render(p, s); }); t += T(Math.max(46, Math.min(90, 22 + line.length * 1.1)));
  }
  for (const g of o.groups ?? []) {
    const col = g.col ?? "§e";
    at(t, () => { if (g.title) s.title = g.title; s.sub = `${col}§l${g.header}§r`; render(p, s); snd(p, g.snd ?? "etheria.sage.tier.extra", 1); }); t += T(24);
    const shown = [];
    for (const it of g.items.slice(0, 8)) {
      at(t, () => { shown.push(it); s.sub = `${col}§l${g.header}§r\n${shown.map((x) => `§f${x}`).join("\n")}`; render(p, s); snd(p, "etheria.sage.sfx.skill", 0.8, 1.05); }); t += T(22);
    }
    if (g.items.length > 8) at(t, () => { s.sub += `\n§7+${g.items.length - 8}`; render(p, s); });
    t += T(26);
  }
  t += T(o.hold ?? 36);
  at(t, () => { voiceClear(p); o.onDone?.(); });
  return true;
}

export function startWorldVoice() {
  // ao entrar/renascer nunca fica preso na tela da cerimônia
  world.afterEvents.playerSpawn.subscribe((ev) => { system.runTimeout(() => { if (!active.has(ev.player.id)) voiceClear(ev.player); }, 5); });
  world.afterEvents.entityDie.subscribe((ev) => { try { const e = ev.deadEntity; if (e?.typeId === "minecraft:player" && active.has(e.id)) voiceClear(e); } catch { /* ignore */ } });
  world.afterEvents.playerLeave.subscribe((ev) => active.delete(ev.playerId));
}

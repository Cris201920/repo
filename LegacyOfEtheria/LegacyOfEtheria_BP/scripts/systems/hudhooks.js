// systems/hudhooks.js - Pontos de extensão da HUD (action bar), sem dependências: quem tem algo a mostrar se registra aqui
// e o laço principal (loop.js) apenas consulta. Evita imports circulares entre a HUD e os sistemas do Grande Sábio.
const extra = [];      // fn(player) -> string | ""   linhas somadas ao fim da HUD normal
const override = [];   // fn(player) -> string | null  texto que SUBSTITUI a HUD inteira (ex.: Modo Assess)

const top = [];       // 8.7: linhas que vêm logo abaixo da primeira (barra de vida do alvo) e nunca são cortadas
export const addHudLine = (fn) => { extra.push(fn); };
export const addHudTop = (fn) => { top.push(fn); };
export function hudTop(p) {
  const out = [];
  for (const f of top) { try { const s = f(p); if (s) out.push(s); } catch { /* ignore */ } }
  return out;
}
export const addHudOverride = (fn) => { override.push(fn); };

/** Linhas extras (alvo travado, depuração...). Um provedor com erro é ignorado. */
export function hudExtra(p) {
  const out = [];
  for (const f of extra) { try { const s = f(p); if (s) out.push(s); } catch { /* ignore */ } }
  return out;
}
/** Texto que substitui a HUD, ou null para a HUD normal. */
export function hudOverride(p) {
  for (const f of override) { try { const s = f(p); if (s) return s; } catch { /* ignore */ } }
  return null;
}

// systems/ui/forms.js - Helpers de formulários (botões grandes, ícones próprios, retry se o jogador estiver com o chat aberto)
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

export const ICON = (name) => `textures/ui/etheria/${name}`;

export function show(player, form, cb, tries = 0) {
  form.show(player).then((r) => {
    if (r.canceled && r.cancelationReason === "UserBusy" && tries < 25) { system.runTimeout(() => show(player, form, cb, tries + 1), 10); return; }
    if (r.canceled) return;
    cb(r);
  }).catch((e) => console.warn(`[Etheria] Falha no formulário: ${e}`));
}

/** Menu de botões. buttons: [{ text, icon?, run }] */
export function menu(player, title, body, buttons) {
  const f = new ActionFormData().title(title).body(body);
  for (const b of buttons) { if (b.icon) f.button(b.text, b.icon.startsWith("textures/") ? b.icon : ICON(b.icon)); else f.button(b.text); }
  show(player, f, (r) => { try { buttons[r.selection]?.run?.(); } catch (e) { console.warn(`[Etheria] Erro no menu "${title}": ${e}`); } });
}

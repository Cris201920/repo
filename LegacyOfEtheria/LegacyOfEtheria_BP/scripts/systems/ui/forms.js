// systems/ui/forms.js - Helpers de formulários (botões grandes, ícones próprios, retry se o jogador estiver com o chat aberto)
// 6.29: INTERFACE TEMÁTICA. O título leva um marcador invisível (§e§t§h + código do tema) que o pacote de recursos (ui/server_form.json) reconhece
// para desenhar a tela cheia animada: fundo vivo do núcleo (raios, estrelas, icosaedro), moldura, faixa de título, painel de detalhes (texto) à esquerda
// e lista de cartões (botões) à direita, cada um com rolagem própria. Sem o marcador, o jogo usa o formulário original (fallback garantido).
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getData } from "../../core/db.js";

export const ICON = (name) => `textures/ui/${name.startsWith("etheria/") || name.startsWith("modskills/") ? name : "etheria/" + name}`;
export const UI_BASE = "§e§t§h";
/** temas: world = Voz do Mundo/Lorde Demônio (vermelho), sage = Grande Sábio (azul), raphael (dourado), ciel (violeta), tree = Árvore de Poderes/padrão (roxo e ouro) */
export const THEME = Object.freeze({ world: "§t§w", sage: "§t§s", raphael: "§t§r", ciel: "§t§c", tree: "§t§p" });
let ctxTheme = null;
/** executa fn com um tema padrão para todos os menus abertos dentro dela */
export function withTheme(theme, fn) { const prev = ctxTheme; ctxTheme = theme; try { return fn(); } finally { ctxTheme = prev; } }
/** tema do Sábio conforme o estágio: Grande Sábio (azul) → Raphael (dourado) → Ciel (violeta) */
export function sageThemeOf(stage) { return stage >= 4 ? "ciel" : stage >= 3 ? "raphael" : "sage"; }
const classic = (player) => { try { return getData(player)?.settings?.classicUi === true; } catch { return false; } };
/** título com o marcador do tema (ou o título puro se o jogador escolheu a interface clássica) */
export function themed(player, title, theme) {
  if (classic(player) || String(title).startsWith(UI_BASE)) return title;
  return UI_BASE + (THEME[theme ?? ctxTheme] ?? THEME.tree) + "§r" + title;
}

export function show(player, form, cb, tries = 0) {
  form.show(player).then((r) => {
    if (r.canceled && r.cancelationReason === "UserBusy" && tries < 25) { system.runTimeout(() => show(player, form, cb, tries + 1), 10); return; }
    if (r.canceled) return;
    cb(r);
  }).catch((e) => console.warn(`[Etheria] Falha no formulário: ${e}`));
}

/** Menu de botões. buttons: [{ text, icon?, run }]. theme opcional (padrão: o de withTheme ou "tree"). */
export function menu(player, title, body, buttons, theme) {
  const f = new ActionFormData().title(themed(player, title, theme)).body(body);
  // 6.56: o botão do jogo é cinza-claro: cores claras (§7 cinza, §f branco, §e amarelo) na 2ª linha ficavam ilegíveis -> escurecidas
  const legible = (t) => String(t).replace(/§7/g, "§8").replace(/(\n[^\n]*)§f/g, "$1§0").replace(/(\n[^\n]*)§e/g, "$1§6");
  for (const b of buttons) { const tx = legible(b.text); if (b.icon) f.button(tx, b.icon.startsWith("textures/") ? b.icon : ICON(b.icon)); else f.button(tx); }
  show(player, f, (r) => { try { buttons[r.selection]?.run?.(); } catch (e) { console.warn(`[Etheria] Erro no menu "${title}": ${e}`); } });
}

// 6.56: CARTÃO DE ESCOLHA DE RAÇA (ui/server_form.json -> eth_card_form): retrato do rosto da raça, faixa do nome, ficha e botões em linha.
const CARD = "§t§k";
const RACE_CODE = { human: "0", slime: "1", goblin: "2", demon: "3", elf: "4", angel: "5", dragonoid: "6", beastkin: "7", undead: "8", ogre: "9", lizardman: "a", vampire: "b", dwarf: "c" };
export function cardMenu(player, raceId, name, body, buttons) {
  if (classic(player)) return menu(player, name, body, buttons);
  const f = new ActionFormData().title(`${UI_BASE}${CARD}§k§r§${RACE_CODE[raceId] ?? "0"}§r${name}`).body(body);
  for (const b of buttons) f.button(b.text);
  show(player, f, (r) => { try { buttons[r.selection]?.run?.(); } catch (e) { console.warn(`[Etheria] Erro no cartão de raça: ${e}`); } });
}

// 6.58b: MENU DO GRANDE SÁBIO no estilo do vídeo de referência (ui/server_form.json -> eth_sage_form): fundo verde, icosaedro girando no
// centro, até 8 opções em caixas "[ ]" em volta (posições fixas por índice) e a fala do Sábio num balão. buttons: [{ label, run }]
const SAGEN = "§t§n";
export function sageMenu(player, title, say, buttons) {
  if (classic(player)) return menu(player, title, say, buttons.map((b) => ({ text: `§l${b.label}`, run: b.run })));
  const f = new ActionFormData().title(`${UI_BASE}${SAGEN}§r${title}`).body(say);
  for (const b of buttons.slice(0, 8)) f.button(b.label);
  show(player, f, (r) => { try { buttons[r.selection]?.run?.(); } catch (e) { console.warn(`[Etheria] Erro no menu do Sábio: ${e}`); } });
}

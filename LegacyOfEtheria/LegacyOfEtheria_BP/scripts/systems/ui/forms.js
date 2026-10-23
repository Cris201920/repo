// systems/ui/forms.js - Helpers de formulários (botões grandes, ícones próprios, retry se o jogador estiver com o chat aberto)
// 6.29: INTERFACE TEMÁTICA. O título leva um marcador invisível (§e§t§h + código do tema) que o pacote de recursos (ui/server_form.json) reconhece
// para desenhar a tela cheia animada: fundo vivo do núcleo (raios, estrelas, icosaedro), moldura, faixa de título, painel de detalhes (texto) à esquerda
// e lista de cartões (botões) à direita, cada um com rolagem própria. Sem o marcador, o jogo usa o formulário original (fallback garantido).
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import * as ServerUI from "@minecraft/server-ui";   // 8.9: uiManager (fecha a cena sozinha) só se a versão do jogo tiver; sem ela, o jogador toca em "Pular »"
import { getData } from "../../core/db.js";

export const ICON = (name) => `textures/ui/${name.startsWith("etheria/") || name.startsWith("modskills/") ? name : "etheria/" + name}`;
export const UI_BASE = "§e§t§h";
/** temas: world = Voz do Mundo/Lorde Demônio (vermelho), sage = Grande Sábio (azul), raphael (dourado), ciel (violeta), tree = Árvore de Poderes/padrão (roxo e ouro),
 *  arch = 8.13 "Ability Archive" do vídeo (lista com nomes coloridos à esquerda e detalhe à direita; sempre com o visual do Sábio) */
export const THEME = Object.freeze({ world: "§t§w", sage: "§t§s", raphael: "§t§r", ciel: "§t§c", tree: "§t§p", arch: "§t§v" });
let ctxTheme = null;
/** executa fn com um tema padrão para todos os menus abertos dentro dela */
export function withTheme(theme, fn) { const prev = ctxTheme; ctxTheme = theme; try { return fn(); } finally { ctxTheme = prev; } }
/** tema do Sábio conforme o estágio: Grande Sábio (azul) → Raphael (dourado) → Ciel (violeta) */
export function sageThemeOf(stage) { return stage >= 4 ? "ciel" : stage >= 3 ? "raphael" : "sage"; }
const classic = (player) => { try { return getData(player)?.settings?.classicUi === true; } catch { return false; } };
/** título com o marcador do tema (ou o título puro se o jogador escolheu a interface clássica) */
// 8.x: VISUAL DO GRANDE SÁBIO (pacote OPCIONAL "Legacy of Etheria Sábio UI", tools/gen_sage_ui.py). O marcador SG ("§j§q") vai logo depois de
// UI_BASE. O pacote principal NÃO procura por ele: o título continua com os mesmos marcadores de antes (§e§t§h + tema/cartão), então sem o pacote
// opcional tudo aparece exatamente como na versão estável; e "§j"/"§q" são códigos de cor que o jogo esconde (nunca aparecem no texto).
// Com o pacote opcional ativo (acima do principal), o server_form.json dele troca só as telas com SG pela tela cheia verde do Sábio.
export const SG = "§j§q";
const SG_THEMES = new Set(["sage", "raphael", "ciel", "arch"]);
/** tema + "+sg" pede o visual do Sábio numa tela que não é do Sábio (ex.: "tree+sg" na árvore da raça) */
export const sgTheme = (theme) => `${theme ?? "tree"}+sg`;
export function themed(player, title, theme) {
  if (classic(player) || String(title).startsWith(UI_BASE)) return title;
  let th = theme ?? ctxTheme, sg = false;
  if (typeof th === "string" && th.endsWith("+sg")) { sg = true; th = th.slice(0, -3); }
  if (SG_THEMES.has(th)) sg = true;
  return UI_BASE + (sg ? SG : "") + (THEME[th] ?? THEME.tree) + "§r" + title;
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
  const tt = themed(player, title, theme), dark = tt.includes(THEME.arch);   // 8.13: Ability Archive = linhas escuras, cores claras ficam
  const f = new ActionFormData().title(tt).body(body);
  // 6.56: o botão do jogo é cinza-claro: cores claras (§7 cinza, §f branco, §e amarelo) na 2ª linha ficavam ilegíveis -> escurecidas
  // 8.x: também a 1ª linha: verde/ciano/amarelo/rosa/branco claros sumiam no botão claro (cinza do jogo e o verde-claro do Sábio UI) -> tons escuros
  const legible = (t) => String(t).replace(/§7/g, "§8").replace(/(\n[^\n]*)§f/g, "$1§0").replace(/(\n[^\n]*)§e/g, "$1§6")
    .replace(/§a/g, "§2").replace(/§b/g, "§3").replace(/§e/g, "§6").replace(/§d/g, "§5").replace(/§f/g, "§0");
  for (const b of buttons) { const tx = dark ? String(b.text) : legible(b.text); if (b.icon) f.button(tx, b.icon.startsWith("textures/") ? b.icon : ICON(b.icon)); else f.button(tx); }
  show(player, f, (r) => { try { buttons[r.selection]?.run?.(); } catch (e) { console.warn(`[Etheria] Erro no menu "${title}": ${e}`); } });
}

// 6.56: CARTÃO DE ESCOLHA DE RAÇA (ui/server_form.json -> eth_card_form): retrato do rosto da raça, faixa do nome, ficha e botões em linha.
const CARD = "§t§k";
const RACE_CODE = { human: "0", slime: "1", goblin: "2", demon: "3", elf: "4", angel: "5", dragonoid: "6", beastkin: "7", undead: "8", ogre: "9", lizardman: "a", vampire: "b", dwarf: "c" };
/** 8.9: extra = códigos invisíveis a mais para o pacote Sábio UI (selo de dificuldade "§l§r§N", modo "Confirmar?" "§t§y"); o principal os ignora */
export function cardMenu(player, raceId, name, body, buttons, extra = "") {
  if (classic(player)) return menu(player, name, body, buttons);
  const f = new ActionFormData().title(`${UI_BASE}${SG}${CARD}§k§r§${RACE_CODE[raceId] ?? "0"}${extra}§r${name}`).body(body);
  for (const b of buttons) f.button(b.text);
  show(player, f, (r) => { try { buttons[r.selection]?.run?.(); } catch (e) { console.warn(`[Etheria] Erro no cartão de raça: ${e}`); } });
}

// 6.58b: MENU DO GRANDE SÁBIO no estilo do vídeo de referência (ui/server_form.json -> eth_sage_form): fundo verde, icosaedro girando no
// centro, até 8 opções em caixas "[ ]" em volta (posições fixas por índice) e a fala do Sábio num balão. buttons: [{ label, run }]
const SAGEN = "§t§n";
export function sageMenu(player, title, say, buttons) {
  if (classic(player)) return menu(player, title, say, buttons.map((b) => ({ text: `§l${b.label}`, run: b.run })));
  const f = new ActionFormData().title(`${UI_BASE}${SG}${SAGEN}${THEME.sage}§r${title}`).body(say);   // 8.x: + tema do Sábio (moldura azul no pacote principal)
  for (const b of buttons.slice(0, 8)) f.button(b.label);
  show(player, f, (r) => { try { buttons[r.selection]?.run?.(); } catch (e) { console.warn(`[Etheria] Erro no menu do Sábio: ${e}`); } });
}

// 8.9: CENAS DA REENCARNAÇÃO (pacote Sábio UI -> eth_sg_intro_form / eth_sg_outro_form): tela cheia estrelada com legendas e animação
// própria do JSON UI (nada no HUD). É um formulário de 1 botão ("Pular »"/"Continuar »"): ao tocar, fechar (Esc) ou acabar o tempo,
// segue para next(). Sem o pacote opcional, o principal mostra um formulário comum com o mesmo texto e o mesmo botão.
const SCENE = { intro: "§t§i", outro: "§t§o" };
// 8.13: data = textos de botões a mais (as RODADAS da abertura: marcador + nome da habilidade; a tela as desenha, não são tocáveis);
// sounds = [[tick, som]] tocados enquanto a cena estiver aberta (só sons que o pacote já tem).
export function scene(player, kind, title, body, button, next, autoTicks = 0, data = [], sounds = []) {
  let done = false;
  const go = () => { if (done) return; done = true; try { next?.(); } catch (e) { console.warn(`[Etheria] cena ${kind}: ${e}`); } };
  if (classic(player)) return go();
  const f = new ActionFormData().title(`${UI_BASE}${SG}${SCENE[kind] ?? ""}${THEME.sage}§r${title}`).body(body);
  f.button(button);
  for (const t of data) f.button(t);
  for (const [tick, id] of sounds) system.runTimeout(() => { if (!done) try { player.playSound(id, { volume: 0.7 }); } catch { /* ignore */ } }, tick);
  const open = (tries) => f.show(player).then((r) => {
    if (r.canceled && r.cancelationReason === "UserBusy" && tries < 25) { system.runTimeout(() => open(tries + 1), 10); return; }
    go();
  }).catch((e) => { console.warn(`[Etheria] Falha na cena: ${e}`); go(); });
  open(0);
  if (autoTicks > 0) system.runTimeout(() => { if (done) return; try { ServerUI.uiManager?.closeAllForms?.(player); } catch { /* versão sem uiManager: espera o toque */ } }, autoTicks);
}

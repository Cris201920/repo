# Gera LegacyOfEtheria_RP/ui/server_form.json e ui/hud_screen.json (JSON UI) — interface temática animada do Etheria.
# Formulários: título começando com o marcador invisível "§e§t§h" + código de tema usam a tela cheia animada; qualquer outro usa o formulário ORIGINAL do jogo.
# HUD: título com "§w§v§x" mostra a cerimônia da Voz do Mundo (tela cheia, fundo animado, título + texto revelado pelo script).
import json, sys, os
RP = sys.argv[1]
BASE = "§e§t§h"
THEMES = {"world": "§t§w", "sage": "§t§s", "raphael": "§t§r", "ciel": "§t§c", "tree": "§t§p"}
HUDMARK = "§w§v§x"
CARD = "§t§k"   # 6.56: cartão de escolha de raça
RACE_CODES = {r: "0123456789abc"[i] for i, r in enumerate(["human", "slime", "goblin", "demon", "elf", "angel", "dragonoid", "beastkin", "undead", "ogre", "lizardman", "vampire", "dwarf"])}
has = lambda var, code: f"(not (({var} - '{code}') = {var}))"
lacks = lambda var, code: f"(({var} - '{code}') = {var})"

# ------------------------------------------------------------------ fundo animado em camadas (6.35): texturas pequenas, tingidas pelo tema
TCOL = {"world": [1.0, 0.2, 0.24], "sage": [0.3, 0.68, 1.0], "raphael": [1.0, 0.76, 0.28], "ciel": [0.74, 0.48, 1.0], "tree": [0.66, 0.38, 1.0]}
def light(c): return [round(0.55 + 0.45 * v, 3) for v in c]
def anim_defs(ns, sfx="", rel=False):
    A = {}
    for k in range(4):   # raios: cada camada acende 0,5 s, apaga 0,5 s e espera; 4 camadas defasadas = giro contínuo
        A[f"eth_ray{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 0.5, "next": f"@{ns}.eth_ray{k}_in"}
        A[f"eth_ray{k}_in"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 0.0, "to": 1.0, "duration": 0.5, "next": f"@{ns}.eth_ray{k}_out"}
        A[f"eth_ray{k}_out"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 1.0, "to": 0.0, "duration": 0.5, "next": f"@{ns}.eth_ray{k}_wait"}
        A[f"eth_ray{k}_wait"] = {"anim_type": "wait", "duration": 1.0, "next": f"@{ns}.eth_ray{k}_in"}
    for k in range(2):   # wireframe alterna duas rotações
        A[f"eth_wire{k}_a"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 1.0 - k, "to": float(k), "duration": 1.6, "next": f"@{ns}.eth_wire{k}_b"}
        A[f"eth_wire{k}_b"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": float(k), "to": 1.0 - k, "duration": 1.6, "next": f"@{ns}.eth_wire{k}_a"}
    for k in range(6):   # 6.36: círculo mágico (6 quadros de 5°, troca suave = rotação contínua)
        A[f"eth_circ{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 0.2, "next": f"@{ns}.eth_circ{k}_in"}
        A[f"eth_circ{k}_in"] = {"anim_type": "alpha", "easing": "linear", "from": 0.0, "to": 0.9, "duration": 0.2, "next": f"@{ns}.eth_circ{k}_out"}
        A[f"eth_circ{k}_out"] = {"anim_type": "alpha", "easing": "linear", "from": 0.9, "to": 0.0, "duration": 0.2, "next": f"@{ns}.eth_circ{k}_wait"}
        A[f"eth_circ{k}_wait"] = {"anim_type": "wait", "duration": 0.8, "next": f"@{ns}.eth_circ{k}_in"}
    A["eth_scan"] = {"anim_type": "offset", "easing": "in_out_sine", "from": [0, -12], "to": [0, 340], "duration": 2.6, "next": f"@{ns}.eth_scan_back"}
    A["eth_scan_back"] = {"anim_type": "offset", "easing": "in_out_sine", "from": [0, 340], "to": [0, -12], "duration": 2.6, "next": f"@{ns}.eth_scan"}
    for k in range(2):   # partículas sobem e somem; 2 camadas defasadas
        A[f"eth_mote{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 1.5, "next": f"@{ns}.eth_mote{k}_up"}
        A[f"eth_mote{k}_up"] = {"anim_type": "offset", "easing": "linear", "from": [0, 24], "to": [0, -24], "duration": 3.0, "next": f"@{ns}.eth_mote{k}_up"}
        A[f"eth_motea{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 1.5, "next": f"@{ns}.eth_motea{k}_in"}
        A[f"eth_motea{k}_in"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 0.0, "to": 0.85, "duration": 1.5, "next": f"@{ns}.eth_motea{k}_out"}
        A[f"eth_motea{k}_out"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 0.85, "to": 0.0, "duration": 1.5, "next": f"@{ns}.eth_motea{k}_in"}
    A["eth_hex_a"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 0.2, "to": 0.6, "duration": 1.2, "next": f"@{ns}.eth_hex_b"}
    A["eth_hex_b"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 0.6, "to": 0.2, "duration": 1.2, "next": f"@{ns}.eth_hex_a"}
    A["eth_brk_a"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 0.45, "to": 1.0, "duration": 0.8, "next": f"@{ns}.eth_brk_b"}
    A["eth_brk_b"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 1.0, "to": 0.45, "duration": 0.8, "next": f"@{ns}.eth_brk_a"}
    for k in range(2):   # pulsos contínuos saindo do núcleo
        A[f"eth_pulse{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 0.9, "next": f"@{ns}.eth_pulse{k}_s"}
        A[f"eth_pulse{k}_s"] = {"anim_type": "size", "easing": "out_quad", "from": [40, 40], "to": [380, 380], "duration": 1.8, "next": f"@{ns}.eth_pulse{k}_s"}
        # 6.55: variante proporcional (janela dos anúncios): mesmo pulso, medido pela altura da janela
        A[f"eth_pulse{k}_start_r"] = {"anim_type": "wait", "duration": 0.001 + k * 0.9, "next": f"@{ns}.eth_pulse{k}_s_r"}
        A[f"eth_pulse{k}_s_r"] = {"anim_type": "size", "easing": "out_quad", "from": ["17%y", "17%y"], "to": ["160%y", "160%y"], "duration": 1.8, "next": f"@{ns}.eth_pulse{k}_s_r"}
        A[f"eth_pulsea{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 0.9, "next": f"@{ns}.eth_pulsea{k}_a"}
        A[f"eth_pulsea{k}_a"] = {"anim_type": "alpha", "easing": "linear", "from": 0.55, "to": 0.0, "duration": 1.8, "next": f"@{ns}.eth_pulsea{k}_a"}
    A["eth_core_a"] = {"anim_type": "size", "easing": "in_out_sine", "from": [56, 56], "to": [84, 84], "duration": 0.9, "next": f"@{ns}.eth_core_b"}
    A["eth_core_b"] = {"anim_type": "size", "easing": "in_out_sine", "from": [84, 84], "to": [56, 56], "duration": 0.9, "next": f"@{ns}.eth_core_a"}
    A["eth_core_a_r"] = {"anim_type": "size", "easing": "in_out_sine", "from": ["24%y", "24%y"], "to": ["36%y", "36%y"], "duration": 0.9, "next": f"@{ns}.eth_core_b_r"}
    A["eth_core_b_r"] = {"anim_type": "size", "easing": "in_out_sine", "from": ["36%y", "36%y"], "to": ["24%y", "24%y"], "duration": 0.9, "next": f"@{ns}.eth_core_a_r"}
    A["eth_scan_r"] = {"anim_type": "offset", "easing": "in_out_sine", "from": [0, "-5%"], "to": [0, "98%"], "duration": 2.6, "next": f"@{ns}.eth_scan_back_r"}
    A["eth_scan_back_r"] = {"anim_type": "offset", "easing": "in_out_sine", "from": [0, "98%"], "to": [0, "-5%"], "duration": 2.6, "next": f"@{ns}.eth_scan_r"}
    return A
def frame_cycle(A, ns, name, n, step, amax=1.0):
    """n quadros com troca suave em sequência (rotação contínua): quadro k acende e apaga em 'step' e espera o resto do ciclo"""
    for k in range(n):
        A[f"{name}{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * step, "next": f"@{ns}.{name}{k}_in"}
        A[f"{name}{k}_in"] = {"anim_type": "alpha", "easing": "linear", "from": 0.0, "to": amax, "duration": step, "next": f"@{ns}.{name}{k}_out"}
        A[f"{name}{k}_out"] = {"anim_type": "alpha", "easing": "linear", "from": amax, "to": 0.0, "duration": step, "next": f"@{ns}.{name}{k}_wait"}
        A[f"{name}{k}_wait"] = {"anim_type": "wait", "duration": max(0.001, (n - 2) * step), "next": f"@{ns}.{name}{k}_in"}
def video_anims(ns):
    A = {}
    frame_cycle(A, ns, "eth_vr", 8, 0.25); frame_cycle(A, ns, "eth_vw", 8, 0.25, 0.6); frame_cycle(A, ns, "eth_vx", 12, 0.15, 0.9)
    A["eth_vstar_a"] = {"anim_type": "size", "easing": "in_out_sine", "from": [190, 48], "to": [250, 62], "duration": 0.7, "next": f"@{ns}.eth_vstar_b"}
    A["eth_vstar_b"] = {"anim_type": "size", "easing": "in_out_sine", "from": [250, 62], "to": [190, 48], "duration": 0.7, "next": f"@{ns}.eth_vstar_a"}
    for k in range(2):   # anel elíptico tingido que se expande (o "anel vermelho" do vídeo)
        A[f"eth_vring{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 1.6, "next": f"@{ns}.eth_vring{k}_s"}
        A[f"eth_vring{k}_s"] = {"anim_type": "size", "easing": "out_quad", "from": [60, 26], "to": [760, 330], "duration": 3.2, "next": f"@{ns}.eth_vring{k}_s"}
        A[f"eth_vringa{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 1.6, "next": f"@{ns}.eth_vringa{k}_a"}
        A[f"eth_vringa{k}_a"] = {"anim_type": "alpha", "easing": "linear", "from": 0.45, "to": 0.0, "duration": 3.2, "next": f"@{ns}.eth_vringa{k}_a"}
    return A
def fx_video(ns, var, glob, base_layer):
    """6.56: camadas IDÊNTICAS ao vídeo do mod Great Sage (fundo estrelado, raios girando, poliedro de arame, estrela central, anel elíptico)"""
    g = {"binding_type": "global"} if glob else {}
    def vb(expr):
        b = {"binding_name": var}; b.update(g)
        return [b, {"binding_type": "view", "source_property_name": expr, "target_property_name": "#visible"}]
    full = lambda tex, **kw: {"type": "image", "texture": f"textures/ui/etheria/{tex}", "size": ["100%", "100%"], "keep_ratio": False, "fill": True, **kw}
    ctr = lambda tex, sz, **kw: {"type": "image", "texture": f"textures/ui/etheria/{tex}", "size": sz, "anchor_from": "center", "anchor_to": "center", **kw}
    out = [{"vbg": full("ov_v_bg", layer=base_layer)}]
    for th, code in THEMES.items():
        c = TCOL[th]; ctrls = []
        for k in range(8): ctrls.append({f"vr{k}": full(f"ov_v_rays_{k}", color=c, alpha=0.0, layer=base_layer + 1, anims=[f"@{ns}.eth_vr{k}_start"])})
        for k in range(8): ctrls.append({f"vw{k}": full(f"ov_v_rayw_{k}", alpha=0.0, layer=base_layer + 2, anims=[f"@{ns}.eth_vw{k}_start"])})
        for k in range(2): ctrls.append({f"vring{k}": ctr("fx_ring", [60, 26], color=light(c), alpha=0.0, layer=base_layer + 2, anims=[f"@{ns}.eth_vring{k}_start", f"@{ns}.eth_vringa{k}_start"])})
        for k in range(12): ctrls.append({f"vx{k}": full(f"ov_v_wire_{k}", alpha=0.0, layer=base_layer + 3, anims=[f"@{ns}.eth_vx{k}_start"])})
        ctrls.append({"vstar": ctr("ov_v_star", [220, 55], layer=base_layer + 4, anims=[f"@{ns}.eth_vstar_a"])})
        out.append({f"vtheme_{th}": {"type": "panel", "size": ["100%", "100%"], "bindings": vb(has(var, code)), "controls": ctrls}})
    return out

def fx_layers(ns, var, glob, base_layer, rel=False):
    R = "_r" if rel else ""   # 6.55: rel=True -> círculos/núcleo/pulsos medidos pela altura do contêiner (anúncios em janela, não em tela cheia)
    g = {"binding_type": "global"} if glob else {}
    def vb(expr):
        b = {"binding_name": var}; b.update(g)
        return [b, {"binding_type": "view", "source_property_name": expr, "target_property_name": "#visible"}]
    full = lambda tex, **kw: {"type": "image", "texture": f"textures/ui/etheria/{tex}", "size": ["100%", "100%"], "keep_ratio": False, "fill": True, **kw}
    out = [{"bg": full("ov_bg", layer=base_layer)}]
    for th, code in THEMES.items():
        c = TCOL[th]
        ctrls = [{"nebula": full("ov_nebula", color=c, layer=base_layer + 1)}]
        for k in range(4): ctrls.append({f"rays{k}": full(f"ov_rays_{k}", color=c, alpha=0.0, layer=base_layer + 2, anims=[f"@{ns}.eth_ray{k}_start"])})
        for k in range(2): ctrls.append({f"wire{k}": full(f"ov_wire_{k}", color=light(c), layer=base_layer + 3, anims=[f"@{ns}.eth_wire{k}_a"])})
        ctrls.append({"hex": full("ov_hex", color=c, alpha=0.3, layer=base_layer + 1, anims=[f"@{ns}.eth_hex_a"])})
        ctr = lambda tex, sz, **kw: {"type": "image", "texture": f"textures/ui/etheria/{tex}", "size": sz, "anchor_from": "center", "anchor_to": "center", "offset": [0, "-3%"], **kw}
        for k in range(6):
            ctrls.append({f"circ_o{k}": ctr(f"ov_circle_{k}", ["92%y", "92%y"] if rel else [230, 230], color=light(c), alpha=0.0, layer=base_layer + 3, anims=[f"@{ns}.eth_circ{k}_start"])})
            ctrls.append({f"circ_i{k}": ctr(f"ov_circle_{5 - k}", ["48%y", "48%y"] if rel else [120, 120], color=c, alpha=0.0, layer=base_layer + 3, anims=[f"@{ns}.eth_circ{k}_start"])})
        for k in range(2):
            ctrls.append({f"pulse{k}": ctr("fx_ring", ["17%y", "17%y"] if rel else [40, 40], color=light(c), alpha=0.0, layer=base_layer + 3, anims=[f"@{ns}.eth_pulse{k}_start{R}", f"@{ns}.eth_pulsea{k}_start"])})
            ctrls.append({f"motes{k}": full(f"ov_motes_{k}", color=light(c), alpha=0.0, layer=base_layer + 4, anims=[f"@{ns}.eth_mote{k}_start", f"@{ns}.eth_motea{k}_start"])})
        ctrls.append({"scan": {"type": "image", "texture": "textures/ui/etheria/ov_scan", "size": ["100%", 8], "keep_ratio": False, "anchor_from": "top_middle", "anchor_to": "top_middle", "color": light(c), "alpha": 0.7, "layer": base_layer + 4, "anims": [f"@{ns}.eth_scan{R}"]}})
        ctrls.append({"brackets": full("ov_brackets", color=light(c), layer=base_layer + 5, anims=[f"@{ns}.eth_brk_a"])})
        ctrls.append({"core": {"type": "image", "texture": "textures/ui/etheria/ov_core", "size": ["28%y", "28%y"] if rel else [70, 70], "anchor_from": "center", "anchor_to": "center", "offset": [0, "-3%"], "color": light(c), "layer": base_layer + 4, "anims": [f"@{ns}.eth_core_a{R}"]}})
        out.append({f"theme_{th}": {"type": "panel", "size": ["100%", "100%"], "bindings": vb(has(var, code)), "controls": ctrls}})
    return out

flip = {"anim_type": "flip_book", "initial_uv": [0, 0], "frame_count": 24, "frame_step": 170, "fps": 12, "looping": True, "easing": "linear"}

def vis(var, expr, global_=False):
    b = {"binding_name": var}
    if global_: b["binding_type"] = "global"
    return [b, {"binding_type": "view", "source_property_name": expr, "target_property_name": "#visible"}]

sf = {"namespace": "server_form"}
# a factory original cria o formulário dentro de um painel 0x0; com 100% a tela temática pode ocupar a tela toda (o formulário original continua 225x200, centralizado)
sf["main_screen_content"] = {"type": "panel", "size": ["100%", "100%"], "controls": [{"server_form_factory": {"type": "factory", "control_ids": {"long_form": "@server_form.long_form", "custom_form": "@server_form.custom_form"}}}]}
sf["long_form"] = {"type": "panel", "size": ["100%", "100%"], "controls": [
    {"vanilla_form@server_form.eth_vanilla_long_form": {"bindings": vis("#title_text", lacks("#title_text", BASE))}},
    {"etheria_form@server_form.eth_form": {"bindings": vis("#title_text", f"({has('#title_text', BASE)} and {lacks('#title_text', CARD)})")}},
    {"card_form@server_form.eth_card_form": {"bindings": vis("#title_text", has("#title_text", CARD))}},   # 6.56: escolha de raça (cartão)
]}
# cópia EXATA do long_form original (1.21.80)
sf["eth_vanilla_long_form@common_dialogs.main_panel_no_buttons"] = {"$title_panel": "common_dialogs.standard_title_label", "$title_size": ["100% - 15px", 10], "$title_max_size": ["100% - 15px", 10], "size": [225, 200], "$text_name": "#title_text", "$title_text_binding_type": "none", "$child_control": "server_form.long_form_panel", "layer": 2}
sf.update(anim_defs("server_form"))
def theme_layer(th, code):
    return {f"theme_{th}": {"type": "panel", "size": ["100%", "100%"], "bindings": vis("#title_text", has("#title_text", code)), "controls": [
        {"shade": {"type": "image", "texture": "textures/ui/Black", "size": ["100%", "100%"], "alpha": 0.35, "layer": 2}},
        {"card": {"type": "image", "texture": f"textures/ui/etheria/frame_{th}", "size": ["94%", "90%"], "layer": 3}},
        {"band": {"type": "image", "texture": f"textures/ui/etheria/band_{th}", "size": ["70%", 22], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, "5% + 2px"], "layer": 4}},
    ]}}
scroll = lambda content: {"$show_background": False, "size": ["100%", "100%"], "$scrolling_content": content, "$scroll_size": [5, "100% - 4px"], "$scrolling_pane_size": ["100% - 4px", "100% - 2px"], "$scrolling_pane_offset": [2, 0], "$scroll_bar_right_padding_size": [0, 0]}
col_frames = lambda: [{f"f_{th}": {"type": "image", "texture": f"textures/ui/etheria/frame_{th}", "size": ["100%", "100%"], "alpha": 0.85, "layer": 0, "bindings": vis("#title_text", has("#title_text", code))}} for th, code in THEMES.items()]
sf["eth_form"] = {"type": "panel", "size": ["100%", "100%"], "layer": 2, "controls":
    fx_layers("server_form", "#title_text", False, 0) + [theme_layer(th, code) for th, code in THEMES.items()] + [
    {"title": {"type": "label", "text": "#title_text", "bindings": [{"binding_name": "#title_text"}], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, "5% + 8px"], "size": ["66%", 10], "text_alignment": "center", "font_size": "large", "shadow": True, "color": [1, 1, 1], "layer": 6}},
    {"close@common.close_button": {"anchor_from": "top_right", "anchor_to": "top_right", "offset": ["-3% - 4px", "5% + 2px"], "layer": 8}},
    {"columns": {"type": "stack_panel", "orientation": "horizontal", "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, "5% + 28px"], "size": ["94% - 16px", "90% - 34px"], "layer": 5, "controls": [
        {"info": {"type": "panel", "size": ["44%", "100%"], "controls": col_frames() + [{"scroll@common.scrolling_panel": dict(scroll("server_form.eth_text_content"), layer=2)}]}},
        {"gap": {"type": "panel", "size": [6, "100%"]}},
        {"list": {"type": "panel", "size": ["fill", "100%"], "controls": col_frames() + [{"scroll@common.scrolling_panel": dict(scroll("server_form.eth_buttons_content"), layer=2)}]}},
    ]}},
]}
sf["eth_text_content"] = {"type": "stack_panel", "size": ["100% - 4px", "100%c"], "orientation": "vertical", "anchor_from": "top_left", "anchor_to": "top_left", "controls": [
    {"pad_top": {"type": "panel", "size": ["100%", 4]}},
    {"text_panel": {"type": "panel", "size": ["100%", "100%c"], "controls": [{"main_label": {"type": "label", "offset": [5, 0], "color": [1, 1, 1], "size": ["100% - 10px", "default"], "anchor_from": "top_left", "anchor_to": "top_left", "text": "#form_text"}}]}},
    {"pad_bottom": {"type": "panel", "size": ["100%", 6]}},
]}
sf["eth_buttons_content"] = {"type": "stack_panel", "size": ["100% - 4px", "100%c"], "orientation": "vertical", "anchor_from": "top_left", "anchor_to": "top_left", "controls": [
    {"pad_top": {"type": "panel", "size": ["100%", 4]}},
    {"buttons_panel": {"type": "panel", "size": ["100%", "100%c"], "controls": [{"long_form_dynamic_buttons_panel@server_form.long_form_dynamic_buttons_panel": {}}]}},
    {"pad_bottom": {"type": "panel", "size": ["100%", 4]}},
]}
os.makedirs(os.path.join(RP, "ui"), exist_ok=True)
# ------------------------------------------------------------------ 6.56: CARTÃO DE ESCOLHA DE RAÇA (estilo do mod de referência)
# Título: BASE + CARD + "§k§r§<código da raça>" + nome. Retrato: imagem fixa por raça, visível conforme o código no título.
# Botões em linha embaixo do cartão: « anterior | SELECIONAR | próxima » | (lista) — mesma coleção form_buttons do formulário original.
CARD_W, CARD_H = 250, 196
card_portraits = [{f"face_{rid}": {"type": "image", "texture": f"textures/ui/etheria/race_face_{rid}", "size": [26, 26], "layer": 8,
    "bindings": vis("#title_text", has("#title_text", f"§k§r§{RACE_CODES[rid]}"))}} for rid in RACE_CODES]
sf["eth_card_button"] = {"type": "panel", "size": [70, 24], "controls": [
    {"form_button@common_buttons.light_text_button": {"$pressed_button_name": "button.form_button_click", "anchor_from": "center", "anchor_to": "center", "size": ["100% - 4px", 22],
        "$button_text": "#form_button_text", "$button_text_binding_type": "collection", "$button_text_grid_collection_name": "form_buttons", "$button_text_max_size": ["100%", 20],
        "bindings": [{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}]}}]}
sf["eth_card_form"] = {"type": "panel", "size": ["100%", "100%"], "layer": 2, "controls": [
    {"shade": {"type": "image", "texture": "textures/ui/Black", "size": ["100%", "100%"], "alpha": 0.55, "layer": 1}},
    {"card": {"type": "panel", "size": [CARD_W, CARD_H], "anchor_from": "center", "anchor_to": "center", "offset": [0, -14], "layer": 3, "controls": [
        {"bg": {"type": "image", "texture": "textures/ui/etheria/card_bg", "size": ["100%", "100%"], "keep_ratio": False, "layer": 1}},
        {"frame": {"type": "image", "texture": "textures/ui/etheria/card_frame", "size": [38, 38], "anchor_from": "top_left", "anchor_to": "top_left", "offset": [8, 6], "layer": 6,
            "controls": [{"portraits": {"type": "panel", "size": [26, 26], "anchor_from": "center", "anchor_to": "center", "controls": card_portraits}}]}},
        {"banner": {"type": "image", "texture": "textures/ui/etheria/card_banner", "size": [190, 26], "anchor_from": "top_left", "anchor_to": "top_left", "offset": [50, 12], "layer": 6, "keep_ratio": False,
            "controls": [{"name": {"type": "label", "text": "#title_text", "bindings": [{"binding_name": "#title_text"}], "size": ["100% - 12px", 10], "anchor_from": "center", "anchor_to": "center", "text_alignment": "center", "color": [1, 1, 1], "shadow": True, "layer": 7}}]}},
        {"info": {"type": "panel", "size": ["100% - 18px", "100% - 56px"], "anchor_from": "top_left", "anchor_to": "top_left", "offset": [9, 48], "layer": 5, "controls": [
            {"scroll@common.scrolling_panel": dict(scroll("server_form.eth_text_content"), layer=2)}]}},
    ]}},
    {"arrows": {"type": "stack_panel", "orientation": "horizontal", "size": ["100%c", 24], "anchor_from": "center", "anchor_to": "center", "offset": [0, CARD_H // 2 + 2], "layer": 6,
        "factory": {"name": "buttons", "control_name": "server_form.eth_card_button"}, "collection_name": "form_buttons",
        "bindings": [{"binding_name": "#form_button_length", "binding_name_override": "#collection_length"}]}},
    {"close@common.close_button": {"anchor_from": "center", "anchor_to": "center", "offset": [CARD_W // 2 - 4, -CARD_H // 2 - 10], "layer": 8}},
]}
json.dump(sf, open(os.path.join(RP, "ui/server_form.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)

hud = {"namespace": "hud"}
CER = "§3§7"   # cerimônia: preto total; sem ele, véu escuro (o mundo aparece ao fundo, como nos anúncios de habilidade)
hud["root_panel"] = {"modifications": [{"array_name": "controls", "operation": "insert_back", "value": [{"eth_world_voice@hud.eth_world_voice": {}}]}]}
# o título é recriado a cada "impacto": efeitos de um disparo só vivem dentro dele (abertura do núcleo e onda de choque de cada nome)
hud["hud_title_text"] = {"modifications": [{"array_name": "controls", "operation": "insert_back", "value": [{"eth_title_fx@hud.eth_title_fx": {}}]}]}
hud.update(anim_defs("hud")); hud.update(video_anims("hud"))
hud["eth_ring_open_size"] = {"anim_type": "size", "easing": "out_expo", "from": [40, 18], "to": [520, 230], "duration": 1.1}
hud["eth_ring_open_alpha"] = {"anim_type": "alpha", "easing": "linear", "from": 1.0, "to": 0.0, "duration": 0.9}
hud["eth_flash_open_size"] = {"anim_type": "size", "easing": "out_expo", "from": [40, 40], "to": [760, 760], "duration": 0.9}
hud["eth_flash_open_alpha"] = {"anim_type": "alpha", "easing": "in_quad", "from": 1.0, "to": 0.0, "duration": 0.9}
hud["eth_ring_slam_size"] = {"anim_type": "size", "easing": "out_expo", "from": [16, 16], "to": [300, 300], "duration": 0.5}
hud["eth_ring_slam_alpha"] = {"anim_type": "alpha", "easing": "linear", "from": 0.95, "to": 0.0, "duration": 0.5}
hud["eth_flash_slam_size"] = {"anim_type": "size", "easing": "out_expo", "from": [60, 60], "to": [260, 260], "duration": 0.3}
hud["eth_flash_slam_alpha"] = {"anim_type": "alpha", "easing": "linear", "from": 0.8, "to": 0.0, "duration": 0.3}
img = lambda tex, sa, aa, layer: {"type": "image", "texture": f"textures/ui/etheria/{tex}", "anchor_from": "center", "anchor_to": "center", "size": [1, 1], "layer": layer, "anims": [f"@hud.{sa}", f"@hud.{aa}"], "disable_anim_fast_forward": True}
hud["eth_title_fx"] = {"type": "panel", "size": [0, 0], "layer": 150, "bindings": vis("#hud_title_text_string", has("#hud_title_text_string", HUDMARK), True), "controls": [
    {"open": {"type": "panel", "size": [0, 0], "bindings": vis("#hud_title_text_string", has("#hud_title_text_string", "§1§9"), True), "controls": [
        {"flash": img("fx_flash", "eth_flash_open_size", "eth_flash_open_alpha", 1)}, {"ring": img("fx_ring", "eth_ring_open_size", "eth_ring_open_alpha", 2)}]}},
    {"slam": {"type": "panel", "size": [0, 0], "bindings": vis("#hud_title_text_string", has("#hud_title_text_string", "§2§8"), True), "controls": [
        {"flash": img("fx_flash", "eth_flash_slam_size", "eth_flash_slam_alpha", 1)}, {"ring": img("fx_ring", "eth_ring_slam_size", "eth_ring_slam_alpha", 2)}]}},
]}
hud["eth_world_voice"] = {"type": "panel", "size": ["100%", "100%"], "layer": 60, "bindings": vis("#hud_title_text_string", has("#hud_title_text_string", HUDMARK), True), "controls": [
    {"black": {"type": "image", "texture": "textures/ui/Black", "size": ["100%", "100%"], "layer": 60, "bindings": vis("#hud_title_text_string", has("#hud_title_text_string", CER), True)}},
    # 6.56: IDÊNTICO ao vídeo do mod: tela cheia (cerimônias e anúncios), fundo estrelado, raios, poliedro de arame e estrela central
] + fx_video("hud", "#hud_title_text_string", True, 61) + [
    {"title": {"type": "label", "text": "#text", "localize": False, "font_size": "extra_large", "shadow": True, "text_alignment": "center", "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, "24%"], "size": ["90%", "default"], "layer": 63,
        "bindings": [{"binding_name": "#hud_title_text_string", "binding_name_override": "#text", "binding_type": "global"}]}},
    {"lines": {"type": "label", "text": "#text", "localize": False, "font_size": "normal", "shadow": True, "text_alignment": "center", "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, "38%"], "size": ["80%", "default"], "layer": 63,
        "bindings": [{"binding_name": "#hud_subtitle_text_string", "binding_name_override": "#text", "binding_type": "global"}]}},
]}
json.dump(hud, open(os.path.join(RP, "ui/hud_screen.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("ok")

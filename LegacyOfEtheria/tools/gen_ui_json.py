# Gera LegacyOfEtheria_RP/ui/server_form.json e ui/hud_screen.json (JSON UI) — interface temática animada do Etheria.
# Formulários: título começando com o marcador invisível "§e§t§h" + código de tema usam a tela cheia animada; qualquer outro usa o formulário ORIGINAL do jogo.
# HUD: título com "§w§v§x" mostra a cerimônia da Voz do Mundo (tela cheia, fundo animado, título + texto revelado pelo script).
import json, sys, os
RP = sys.argv[1]
BASE = "§e§t§h"
THEMES = {"world": "§t§w", "sage": "§t§s", "raphael": "§t§r", "ciel": "§t§c", "tree": "§t§p"}
HUDMARK = "§w§v§x"
has = lambda var, code: f"(not (({var} - '{code}') = {var}))"
lacks = lambda var, code: f"(({var} - '{code}') = {var})"
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
    {"etheria_form@server_form.eth_form": {"bindings": vis("#title_text", has("#title_text", BASE))}},
]}
# cópia EXATA do long_form original (1.21.80)
sf["eth_vanilla_long_form@common_dialogs.main_panel_no_buttons"] = {"$title_panel": "common_dialogs.standard_title_label", "$title_size": ["100% - 15px", 10], "$title_max_size": ["100% - 15px", 10], "size": [225, 200], "$text_name": "#title_text", "$title_text_binding_type": "none", "$child_control": "server_form.long_form_panel", "layer": 2}
sf["eth_fx_anim"] = flip
def theme_layer(th, code):
    return {f"theme_{th}": {"type": "panel", "size": ["100%", "100%"], "bindings": vis("#title_text", has("#title_text", code)), "controls": [
        {"fx": {"type": "image", "texture": f"textures/ui/etheria/fx_{th}", "size": ["100%", "100%"], "uv_size": [320, 170], "uv": "@server_form.eth_fx_anim", "disable_anim_fast_forward": True, "layer": 1}},
        {"shade": {"type": "image", "texture": "textures/ui/Black", "size": ["100%", "100%"], "alpha": 0.35, "layer": 2}},
        {"card": {"type": "image", "texture": f"textures/ui/etheria/frame_{th}", "size": ["94%", "90%"], "layer": 3}},
        {"band": {"type": "image", "texture": f"textures/ui/etheria/band_{th}", "size": ["70%", 22], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, "5% + 2px"], "layer": 4}},
    ]}}
scroll = lambda content: {"$show_background": False, "size": ["100%", "100%"], "$scrolling_content": content, "$scroll_size": [5, "100% - 4px"], "$scrolling_pane_size": ["100% - 4px", "100% - 2px"], "$scrolling_pane_offset": [2, 0], "$scroll_bar_right_padding_size": [0, 0]}
col_frames = lambda: [{f"f_{th}": {"type": "image", "texture": f"textures/ui/etheria/frame_{th}", "size": ["100%", "100%"], "alpha": 0.85, "layer": 0, "bindings": vis("#title_text", has("#title_text", code))}} for th, code in THEMES.items()]
sf["eth_form"] = {"type": "panel", "size": ["100%", "100%"], "layer": 2, "controls":
    [theme_layer(th, code) for th, code in THEMES.items()] + [
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
json.dump(sf, open(os.path.join(RP, "ui/server_form.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)

hud = {"namespace": "hud"}
hud["root_panel"] = {"modifications": [{"array_name": "controls", "operation": "insert_back", "value": [{"eth_world_voice@hud.eth_world_voice": {}}]}]}
hud["eth_fx_anim"] = flip
hud["eth_world_voice"] = {"type": "panel", "size": ["100%", "100%"], "layer": 60, "bindings": vis("#hud_title_text_string", has("#hud_title_text_string", HUDMARK), True), "controls": [
    {"black": {"type": "image", "texture": "textures/ui/Black", "size": ["100%", "100%"], "layer": 60}},
] + [{f"fx_{th}": {"type": "image", "texture": f"textures/ui/etheria/fx_{th}", "size": ["100%", "100%"], "uv_size": [320, 170], "uv": "@hud.eth_fx_anim", "disable_anim_fast_forward": True, "layer": 61,
        "bindings": vis("#hud_title_text_string", has("#hud_title_text_string", code), True)}} for th, code in THEMES.items()] + [
    {"title": {"type": "label", "text": "#text", "localize": False, "font_size": "extra_large", "shadow": True, "text_alignment": "center", "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, "22%"], "size": ["90%", "default"], "layer": 63,
        "bindings": [{"binding_name": "#hud_title_text_string", "binding_name_override": "#text", "binding_type": "global"}]}},
    {"lines": {"type": "label", "text": "#text", "localize": False, "font_size": "normal", "shadow": True, "text_alignment": "center", "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, "36%"], "size": ["80%", "default"], "layer": 63,
        "bindings": [{"binding_name": "#hud_subtitle_text_string", "binding_name_override": "#text", "binding_type": "global"}]}},
]}
json.dump(hud, open(os.path.join(RP, "ui/hud_screen.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("ok")

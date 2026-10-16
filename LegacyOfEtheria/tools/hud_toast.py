# 6.66 - NOTIFICAÇÃO DE CANTO DO GRANDE SÁBIO (como nos vídeos do mod): icosaedro girando no canto superior esquerdo + caixa com a fala
# digitada ("Aviso. Nível 12 alcançado.", "Conquista registrada: ..."). Usada em SUBIR DE NÍVEL e CONQUISTAS.
# Canal: título = marcador TOAST (invisível) e subtítulo = texto. O título padrão do jogo (hud_title_text) é redefinido IGUAL ao original
# do jogo, só com uma regra a mais: fica escondido quando o marcador TOAST está no título (para o texto não aparecer no meio da tela).
# Edita só o hud_screen.json atual (não regenera o resto da interface). Idempotente. Uso: python3 tools/hud_toast.py
import json, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
UI = os.path.join(RP, "textures/ui/etheria"); HP = os.path.join(RP, "ui/hud_screen.json")
TOAST = "§w§n§t"
has = lambda var, code: f"(not (({var} - '{code}') = {var}))"
lacks = lambda var, code: f"(({var} - '{code}') = {var})"
def vis(expr): return [{"binding_name": "#hud_title_text_string", "binding_type": "global"}, {"binding_type": "view", "source_property_name": expr, "target_property_name": "#visible"}]
G = [0.72, 1.0, 0.84]

def icons():   # ícone pequeno: recorte central dos quadros do icosaedro da Voz do Mundo (mesma arte), 64 px
    for k in range(12):
        im = Image.open(os.path.join(UI, f"ov_v_wire_{k}.png")).convert("RGBA"); W, H = im.size; s = int(H * 0.62)
        im.crop((W // 2 - s // 2, H // 2 - s // 2, W // 2 + s // 2, H // 2 + s // 2)).resize((64, 64), Image.LANCZOS).save(os.path.join(UI, f"sg_ico_{k}.png"))
    b = Image.new("RGBA", (64, 16), (6, 18, 13, 215)); px = b.load()
    for x in range(64):
        for y in range(16):
            if x in (0, 63) or y in (0, 15): px[x, y] = (150, 205, 175, 255)
    b.save(os.path.join(UI, "sg_toast_box.png"))

VANILLA_TITLE = {   # cópia fiel do hud_title_text do jogo (1.21) + visibilidade
  "type": "stack_panel", "orientation": "vertical", "offset": [0, -19], "layer": 1, "alpha": "@hud.anim_title_text_alpha_in", "propagate_alpha": True,
  "bindings": vis(lacks("#hud_title_text_string", TOAST)),
  "controls": [
    {"title_frame": {"type": "panel", "size": ["100%", "100%cm"], "controls": [
      {"title_background": {"type": "image", "size": ["100%sm + 30px", "100%sm + 6px"], "texture": "textures/ui/hud_tip_text_background", "alpha": "@hud.anim_title_background_alpha_in"}},
      {"title": {"type": "label", "anchor_from": "top_middle", "anchor_to": "top_middle", "color": "$title_command_text_color", "enable_profanity_filter": True, "text": "#text", "layer": 31,
        "localize": False, "font_size": "extra_large", "variables": [{"requires": "(not $title_shadow)", "$show_shadow": False}, {"requires": "$title_shadow", "$show_shadow": True}],
        "shadow": "$show_shadow", "text_alignment": "center", "offset": [0, 6],
        "bindings": [{"binding_name": "#hud_title_text_string", "binding_name_override": "#text", "binding_type": "global"}]}}]}},
    {"subtitle_frame": {"type": "panel", "size": ["100%", "100%cm"], "controls": [
      {"subtitle_background": {"type": "image", "size": ["100%sm + 20px", "100%sm + 5px"], "offset": [0, 16], "texture": "textures/ui/hud_tip_text_background",
        "variables": [{"requires": "$subtitle_initially_visible", "$subtitle_bg": "@hud.anim_title_background_alpha_in"}, {"requires": "(not $subtitle_initially_visible)", "$subtitle_bg": "@hud.anim_subtitle_background_alpha_in"}],
        "alpha": "$subtitle_bg"}},
      {"subtitle": {"type": "label", "anchor_from": "top_middle", "anchor_to": "top_middle", "color": "$title_command_text_color", "enable_profanity_filter": True, "text": "#text", "layer": 31,
        "localize": False, "font_size": "large",
        "variables": [{"requires": "$subtitle_initially_visible", "$anim_type": 1.0}, {"requires": "(not $subtitle_initially_visible)", "$anim_type": "@hud.anim_subtitle_text_alpha_in"},
                      {"requires": "(not $title_shadow)", "$show_shadow": False}, {"requires": "$title_shadow", "$show_shadow": True}],
        "shadow": "$show_shadow", "alpha": "$anim_type", "text_alignment": "center", "offset": [1, 19],
        "bindings": [{"binding_name": "#hud_subtitle_text_string", "binding_name_override": "#text", "binding_type": "global"}]}}]}},
    {"eth_title_fx@hud.eth_title_fx": {}}]}   # mesmo lugar de antes (fim do título)

def main():
    icons()
    H = json.load(open(HP))
    H["hud_title_text"] = VANILLA_TITLE
    H["eth_sage_toast"] = {"type": "panel", "size": [210, 40], "anchor_from": "top_left", "anchor_to": "top_left", "offset": [4, 4], "layer": 70,
      "bindings": vis(has("#hud_title_text_string", TOAST)), "controls": [
        {"ico": {"type": "panel", "size": [30, 30], "anchor_from": "top_left", "anchor_to": "top_left", "controls": [
            {f"i{k}": {"type": "image", "texture": f"textures/ui/etheria/sg_ico_{k}", "size": ["100%", "100%"], "color": G, "alpha": 0.0, "anims": [f"@hud.eth_vx{k}_start"]}} for k in range(12)]}},
        {"box": {"type": "image", "texture": "textures/ui/etheria/sg_toast_box", "size": ["100%c + 10px", 14], "anchor_from": "top_left", "anchor_to": "top_left", "offset": [6, 28], "layer": 2,
            "keep_ratio": False, "controls": [
            {"txt": {"type": "label", "text": "#text", "localize": False, "size": ["default", 10], "anchor_from": "left_middle", "anchor_to": "left_middle", "offset": [5, 0],
                "color": [0.9, 1.0, 0.94], "shadow": False, "layer": 3,
                "bindings": [{"binding_name": "#hud_subtitle_text_string", "binding_name_override": "#text", "binding_type": "global"}]}}]}}]}
    rp = H["root_panel"]["modifications"][0]["value"]
    if not any("eth_sage_toast@hud.eth_sage_toast" in x for x in rp): rp.append({"eth_sage_toast@hud.eth_sage_toast": {}})
    json.dump(H, open(HP, "w"), ensure_ascii=False, indent=1)
    print("ok")
if __name__ == "__main__": main()

"""HUD igual à do mod Tensura (moldura + barras de HP/mana/aura) em JSON UI, alimentada pela actionbar.
Texturas recortadas do jar do mod (uso pessoal, fora do git): python3 tools/mod_hud.py <tensura-1.19.2-*.jar>
A actionbar começa com um cabeçalho ASCII de 49 caracteres (ver HUD_HEADER em systems/loop.js):
  ETHUD hp mp xp st (00..40) | hpTxt(11) mpTxt(11) stTxt(11) | nivel(3)"""
import io, json, os, sys, zipfile
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), "..")
RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
OUT = os.path.join(RP, "textures", "ui", "etheria", "modhud")
STEPS = 40
BARS = {"hp": ("hp_bars/hp_bar.png", (44, 5)), "xp": ("hp_bars/shp_bar.png", (44, 19)),
        "mp": ("mana_bar.png", (5, 46)), "st": ("aura_bar.png", (5, 57))}
FIELDS = {"hp": (5, 7), "mp": (7, 9), "xp": (9, 11), "st": (11, 13), "hpTxt": (13, 24), "mpTxt": (24, 35), "stTxt": (35, 46), "lv": (46, 49)}
HEADER_LEN = 49

def textures(jar):
    z = zipfile.ZipFile(jar); P = "assets/tensura/textures/player_hud/"
    img = lambda n: Image.open(io.BytesIO(z.read(P + n))).convert("RGBA")
    os.makedirs(OUT, exist_ok=True)
    img("main_hud.png").crop((0, 0, 150, 67)).save(os.path.join(OUT, "frame.png"))
    fr = img("main_hud.png").crop((0, 0, 150, 67)); px = fr.load(); sh = Image.new("RGBA", fr.size, (0, 0, 0, 0)); sp = sh.load()
    for y in range(44, 67):                       # brilho branco do vidro das barras de mana/aura: vai por cima do preenchimento
        for x in range(150):
            if px[x, y][:3] == (255, 255, 255) and px[x, y][3]: sp[x, y] = (255, 255, 255, 150)
    sh.save(os.path.join(OUT, "glass.png"))
    for k, (f, _) in BARS.items():
        b = img(f)
        for s in range(STEPS + 1):
            w = round(b.width * s / STEPS); c = Image.new("RGBA", b.size, (0, 0, 0, 0))
            if w: c.paste(b.crop((0, 0, w, b.height)), (0, 0))
            c.save(os.path.join(OUT, f"{k}_{s:02d}.png"))
    return {k: img(f).size for k, (f, _) in BARS.items()}

def sub(a, b): return f"(('%.{b}s' * $atext) - ('%.{a}s' * $atext))"
HAS = "(('%.5s' * $atext) = 'ETHUD')"

def label(text_expr, offset, size, scale=0.75, color=(1, 1, 1)):
    return {"type": "label", "anchor_from": "top_left", "anchor_to": "top_left", "offset": offset, "size": size, "layer": 8,
            "text": "#text", "text_alignment": "center", "font_scale_factor": scale, "shadow": True, "color": list(color), "localize": False,
            "bindings": [{"binding_type": "view", "source_property_name": text_expr, "target_property_name": "#text"}]}

def ui(sizes):
    ctl = [{"frame": {"type": "image", "texture": "textures/ui/etheria/modhud/frame", "size": [150, 67], "layer": 1}}]
    for k, (_, (x, y)) in BARS.items():
        a, b = FIELDS[k]; w, h = sizes[k]
        ctl.append({f"bar_{k}": {"type": "image", "anchor_from": "top_left", "anchor_to": "top_left", "offset": [x, y], "size": [w, h], "layer": 4,
                    "texture": f"textures/ui/etheria/modhud/{k}_00",
                    "bindings": [{"binding_type": "view", "source_property_name": f"('textures/ui/etheria/modhud/{k}_' + {sub(a, b)})", "target_property_name": "#texture"}]}})
    ctl.append({"glass": {"type": "image", "anchor_from": "top_left", "anchor_to": "top_left", "offset": [0, 0], "size": [150, 67], "texture": "textures/ui/etheria/modhud/glass", "layer": 6}})
    ctl.append({"hp_txt": label(sub(*FIELDS["hpTxt"]), [44, 6], [101, 9])})
    ctl.append({"mp_txt": label(sub(*FIELDS["mpTxt"]), [5, 47], [67, 9])})
    ctl.append({"st_txt": label(sub(*FIELDS["stTxt"]), [5, 58], [57, 9])})
    ctl.append({"lv_cap": label("('Nv')", [5, 8], [35, 9], 0.75, (0.85, 0.85, 0.85))})
    ctl.append({"lv_txt": label(sub(*FIELDS["lv"]), [5, 18], [35, 14], 1.5, (1, 0.85, 0.3))})
    bars = {"type": "panel", "anchor_from": "top_left", "anchor_to": "top_left", "offset": [3, 3], "size": [150, 67], "layer": 40,
            "bindings": [{"binding_type": "view", "source_property_name": HAS, "target_property_name": "#visible"}], "controls": ctl}

    def msg(expr, vis):
        return {"type": "image", "anchor_from": "center", "anchor_to": "center", "size": ["100%c + 12px", "100%c + 5px"], "offset": [0, "50%-68px"],
                "texture": "textures/ui/hud_tip_text_background", "alpha": "@hud.anim_actionbar_text_background_alpha_out",
                "bindings": [{"binding_type": "view", "source_property_name": vis, "target_property_name": "#visible"}],
                "controls": [{"actionbar_message": {"type": "label", "anchor_from": "center", "anchor_to": "center", "color": "$tool_tip_text", "layer": 31,
                              "text": "#text", "localize": False, "alpha": "@hud.anim_actionbar_text_alpha_out",
                              "bindings": [{"binding_type": "view", "source_property_name": expr, "target_property_name": "#text"}]}}]}
    return {"type": "panel", "size": ["100%", "100%"], "$atext": "$actionbar_text",
            "controls": [{"eth_mod_hud": bars},
                         {"msg_hud": msg(f"($atext - ('%.{HEADER_LEN}s' * $atext))", f"({HAS} and (not (('%.{HEADER_LEN + 1}s' * $atext) = ('%.{HEADER_LEN}s' * $atext))))")},
                         {"msg_plain": msg("$atext", f"(not {HAS})")}]}

if __name__ == "__main__":
    sizes = textures(sys.argv[1])
    p = os.path.join(RP, "ui", "hud_screen.json"); D = json.load(open(p))
    D["hud_actionbar_text"] = ui(sizes)
    D["eth_sage_toast"]["offset"] = [4, 74]          # abaixo da HUD do mod
    json.dump(D, open(p, "w"), indent=1, ensure_ascii=False); print("ok", sizes)

"""HUD igual à do mod Tensura (moldura + barras de HP/mana/aura) em JSON UI, alimentada pela actionbar.
Texturas recortadas do jar do mod (uso pessoal, fora do git): python3 tools/mod_hud.py <tensura-1.19.2-*.jar>
O título (setTitle) carrega um cabeçalho ASCII de 49 caracteres (hudHeader em systems/loop.js):
  6.96: "Q#" + hp mp xp st (1 caractere cada, 0-9a-z = 36 níveis) + nível(3) = 9 caracteres.
  O Bedrock só leu os campos até o 9º caractere (%.Ns com N de 2 dígitos falhou no jogo), então tudo cabe em 9."""
import io, json, os, sys, zipfile
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), "..")
RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
OUT = os.path.join(RP, "textures", "ui", "etheria", "modhud")
CODES = "0123456789abcdefghijklmnopqrstuvwxyz"; STEPS = len(CODES) - 1
BARS = {"hp": ("hp_bars/hp_bar.png", (44, 5)), "xp": ("hp_bars/shp_bar.png", (44, 19)),
        "mp": ("mana_bar.png", (5, 46)), "st": ("aura_bar.png", (5, 57))}
FIELDS = {"hp": (2, 3), "mp": (3, 4), "xp": (4, 5), "st": (5, 6), "lv": (6, 9)}
HEADER_LEN = 9

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
            c.save(os.path.join(OUT, f"{k}_{CODES[s]}.png"))
    return {k: img(f).size for k, (f, _) in BARS.items()}

B = "#hud_title_text_string"
def sub(a, b): return f"(('%.{b}s' * {B}) - ('%.{a}s' * {B}))"
HAS = f"(not (({B} - 'Q#') = {B}))"
GLOBAL = {"binding_name": B, "binding_type": "global"}

def label(text_expr, offset, size, scale=0.75, color=(1, 1, 1)):
    return {"type": "label", "anchor_from": "top_left", "anchor_to": "top_left", "offset": offset, "size": size, "layer": 8,
            "text": "#text", "text_alignment": "center", "font_scale_factor": scale, "shadow": True, "color": list(color), "localize": False,
            "bindings": [GLOBAL, {"binding_type": "view", "source_property_name": text_expr, "target_property_name": "#text"}]}

def ui(sizes):
    """Painel no root_panel lendo o título (canal já usado pelo Sábio). O título com ETHUD não aparece na tela (hud_title_text)."""
    ctl = [{"frame": {"type": "image", "texture": "textures/ui/etheria/modhud/frame", "size": [150, 67], "layer": 1}}]
    for k, (_, (x, y)) in BARS.items():
        a, b = FIELDS[k]; w, h = sizes[k]
        ctl.append({f"bar_{k}": {"type": "image", "anchor_from": "top_left", "anchor_to": "top_left", "offset": [x, y], "size": [w, h], "layer": 4,
                    "texture": f"textures/ui/etheria/modhud/{k}_0",
                    "bindings": [GLOBAL, {"binding_type": "view", "source_property_name": f"('textures/ui/etheria/modhud/{k}_' + {sub(a, b)})", "target_property_name": "#texture"}]}})
    ctl.append({"glass": {"type": "image", "anchor_from": "top_left", "anchor_to": "top_left", "offset": [0, 0], "size": [150, 67], "texture": "textures/ui/etheria/modhud/glass", "layer": 6}})
    ctl.append({"lv_cap": {"type": "label", "anchor_from": "top_left", "anchor_to": "top_left", "offset": [5, 8], "size": [35, 9], "layer": 8, "text": "Nv",
                           "text_alignment": "center", "font_scale_factor": 0.75, "shadow": True, "color": [0.85, 0.85, 0.85], "localize": False}})
    ctl.append({"lv_txt": label(sub(*FIELDS["lv"]), [5, 18], [35, 14], 1.5, (1, 0.85, 0.3))})
    return {"type": "panel", "anchor_from": "top_left", "anchor_to": "top_left", "offset": [3, 3], "size": [150, 67], "layer": 40,
            "bindings": [GLOBAL, {"binding_type": "view", "source_property_name": HAS, "target_property_name": "#visible"}], "controls": ctl}

if __name__ == "__main__":
    sizes = textures(sys.argv[1])
    p = os.path.join(RP, "ui", "hud_screen.json"); D = json.load(open(p))
    D.pop("hud_actionbar_text", None)                # 6.90 tentou pela actionbar ($actionbar_text não funciona em bindings)
    D["eth_mod_hud"] = ui(sizes)
    ins = D["root_panel"]["modifications"][0]["value"]
    if "--ligar" in sys.argv and not any("eth_mod_hud@hud.eth_mod_hud" in x for x in ins): ins.insert(0, {"eth_mod_hud@hud.eth_mod_hud": {}})   # 7.0: desligado por padrão
    vb = [x for x in D["hud_title_text"]["bindings"] if x.get("target_property_name") == "#visible"][0]
    vb["source_property_name"] = "(((#hud_title_text_string - '§w§n§t') = #hud_title_text_string) and ((#hud_title_text_string - 'Q#') = #hud_title_text_string))"
    D["eth_sage_toast"]["offset"] = [4, 74]          # abaixo da HUD do mod
    json.dump(D, open(p, "w"), indent=1, ensure_ascii=False); print("ok", sizes)

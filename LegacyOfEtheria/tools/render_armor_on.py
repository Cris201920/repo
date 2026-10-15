# Boneco (humanoid.custom) vestindo as 4 peças de um conjunto, como o jogo desenha (cubos em coordenadas absolutas). Conferência visual.
import json, os, sys, glob
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from tensura_armor import model_of
from swords import render_icon, Model
from render_entity import HUM, GEO, RP
def wear(set_id, view=(180, 8, 0), size=230):
    skin = Image.new("RGBA", (64, 64), (205, 170, 140, 255))
    base = model_of(HUM); parts = [(base, skin)]
    for part in ("helmet", "chest", "legs", "boots"):
        a = os.path.join(RP, f"attachables/{set_id}_{part}.attachable.json")
        if not os.path.exists(a): continue
        d = json.load(open(a))["minecraft:attachable"]["description"]
        g = GEO.get(d["geometry"]["default"]); t = os.path.join(RP, d["textures"]["default"] + ".png")
        if g and os.path.exists(t): parts.append((model_of(g), Image.open(t).convert("RGBA")))
    # um modelo só: junta as texturas lado a lado no atlas do renderizador
    W = sum(max(64, im.width) for _, im in parts); H = max(im.height for _, im in parts)
    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0)); M = Model(W, H); x = 0
    for m, im in parts:
        sc = im.width / m.tw
        atlas.alpha_composite(im, (x, 0))
        for c in m.cubes:
            uv = {k: {"uv": [v["uv"][0] * sc + x, v["uv"][1] * sc], "uv_size": [v["uv_size"][0] * sc, v["uv_size"][1] * sc]} for k, v in c["uv"].items()}
            M.box(c["origin"], c["size"], uv, c.get("rotation"), c.get("pivot"))
        x += max(64, im.width)
    M.opaque = False
    return render_icon(M, atlas, size=size, view=view)
if __name__ == "__main__":
    ids = sys.argv[2:]; sh = Image.new("RGBA", (len(ids) * 240, 480), (70, 74, 82, 255)); dr = ImageDraw.Draw(sh)
    for i, s in enumerate(ids):
        sh.alpha_composite(wear(s), (i * 240 + 5, 5)); sh.alpha_composite(wear(s, view=(0, 8, 0)), (i * 240 + 5, 240)); dr.text((i * 240 + 5, 462), s, fill=(255, 255, 255))
    sh.save(sys.argv[1])

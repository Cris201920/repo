# 6.52 - ÍCONES HD das espadas reconstruídas (tools/sword_hd.py): renderiza o próprio modelo 3D novo, em alta resolução com
# antisserrilhado (renderizador de ícones de tools/swords.py), na diagonal clássica do Minecraft (cabo embaixo à esquerda).
# O ícone antigo (imagem do mod) fica guardado em tools/sword_src/<id>_icon.png.
import json, os, sys, math
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from swords import render_icon
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SRC = os.path.join(os.path.dirname(__file__), "sword_src")
VIEW = (90, 0, 0)
def rot_x(v, ang, piv):
    a = -math.radians(ang); y, z = v[1] - piv[1], v[2] - piv[2]
    return [v[0], y * math.cos(a) - z * math.sin(a) + piv[1], y * math.sin(a) + z * math.cos(a) + piv[2]]
class M:
    def __init__(s, cubes, tw): s.cubes = cubes; s.tw = tw
def flat_cubes(G):
    bones = {b["name"]: b for b in G["bones"]}; hd = bones["eth_hd"]; ang = hd["rotation"][0]; Pb = hd["pivot"]; out = []
    for c in hd["cubes"]:
        c2 = json.loads(json.dumps(c))
        if c.get("rotation"):
            p = c["pivot"]; p2 = rot_x(p, ang, Pb)
            c2["origin"] = [c["origin"][i] + p2[i] - p[i] for i in range(3)]; c2["pivot"] = p2; c2["rotation"] = [c["rotation"][0] + ang, 0, 0]
        else:
            c2["rotation"] = [ang, 0, 0]; c2["pivot"] = list(Pb)
        out.append(c2)
    out += [json.loads(json.dumps(c)) for c in bones["eth_model"].get("cubes", [])]   # empunhadura fiel (referencial da imagem)
    return out
def icon(sid, size=64):
    G = json.load(open(os.path.join(RP, f"models/entity/etheria_w_{sid}.geo.json")))["minecraft:geometry"][0]
    if not any(b["name"] == "eth_hd" for b in G["bones"]): return None
    tex = Image.open(os.path.join(RP, f"textures/attachable/w_{sid}.png")).convert("RGBA")
    return render_icon(M(flat_cubes(G), G["description"]["texture_width"]), tex, size=size, view=VIEW, fill=0.94, outline=3)
def main(ids=None):
    import re
    ids = ids or sorted(f[len("etheria_w_"):-len(".geo.json")] for f in os.listdir(os.path.join(RP, "models/entity")) if f.startswith("etheria_w_"))
    n = 0
    for sid in ids:
        im = icon(sid)
        if im is None: continue
        ip = os.path.join(RP, f"textures/items/etheria_{sid}.png"); bak = os.path.join(SRC, f"{sid}_icon.png")
        if os.path.exists(ip) and not os.path.exists(bak): Image.open(ip).save(bak)
        im.save(ip); n += 1
    print(n, "ícones HD")
if __name__ == "__main__": main(sys.argv[1:] or None)

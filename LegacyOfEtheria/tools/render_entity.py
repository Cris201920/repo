# Renderiza entidades do RP (frente) para conferência visual: python3 tools/render_entity.py saida.png id1 id2 ...
import json, os, sys, glob
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from tensura_armor import model_of
from swords import render_icon
RP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "LegacyOfEtheria_RP")
GEO = {}
for f in glob.glob(os.path.join(RP, "models/entity/**/*.json"), recursive=True):
    try: g = json.load(open(f))
    except Exception: continue
    for d in g.get("minecraft:geometry", []): GEO[d["description"]["identifier"]] = d
HUM = {"description": {"identifier": "geometry.humanoid.custom", "texture_width": 64, "texture_height": 64}, "bones": [
  {"name": "head", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}, {"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5}]},
  {"name": "body", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}]},
  {"name": "rightArm", "pivot": [-5, 22, 0], "cubes": [{"origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}]},
  {"name": "leftArm", "pivot": [5, 22, 0], "cubes": [{"origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]}]},
  {"name": "rightLeg", "pivot": [-1.9, 12, 0], "cubes": [{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}]},
  {"name": "leftLeg", "pivot": [1.9, 12, 0], "cubes": [{"origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]}]}]}
GEO["geometry.humanoid.custom"] = HUM
def client(idn):
    for f in glob.glob(os.path.join(RP, "entity/*.json")):
        d = json.load(open(f))["minecraft:client_entity"]["description"]
        if d["identifier"] == "etheria:" + idn: return d
def render(idn, size=220, view=(180, 8, 0)):
    d = client(idn); geo = GEO.get(list(d["geometry"].values())[0]); tex = Image.open(os.path.join(RP, list(d["textures"].values())[0] + ".png")).convert("RGBA")
    m = model_of(geo); m.opaque = False
    return render_icon(m, tex, size=size, view=view)
if __name__ == "__main__":
    ids = sys.argv[2:]; sh = Image.new("RGBA", (len(ids) * 230, 250), (70, 74, 82, 255)); dr = ImageDraw.Draw(sh)
    for i, n in enumerate(ids):
        try: sh.alpha_composite(render(n), (i * 230 + 5, 5))
        except Exception as e: dr.text((i * 230 + 5, 100), str(e)[:30], fill=(255, 80, 80))
        dr.text((i * 230 + 5, 232), n, fill=(255, 255, 255))
    sh.save(sys.argv[1])

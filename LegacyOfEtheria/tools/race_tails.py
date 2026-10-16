# 6.59b - CAUDAS SEGMENTADAS GROSSAS (demônio, dragonoide, dragonewt e linhagens dracônicas).
# Antes: cada segmento era um bloco fino deslocado 1,5 para trás do anterior ("escadinha" de blocos de 1-2 px, sem textura).
# Agora: segmentos encadeados no mesmo eixo (como a cauda do homem-lagarto), curvados por ROTAÇÃO de cada articulação, grossos na base e
# afinando até a ponta, com uma leve sobreposição nas juntas (sem frestas). Dragões ganham espinhos dorsais e placas mais claras na barriga;
# o demônio ganha a ponta em losango. Texturas de 256 px recebem um ladrilho de escamas próprio (desenhado aqui, arte original) num canto livre.
# Só mexe nos ossos tail*: asas, chifres e o resto do modelo ficam intactos. Animações (tools/race_wings.py tail_anim) continuam valendo.
# Uso: python3 tools/race_tails.py   (idempotente: refaz a partir das medidas, não acumula)
import json, glob, os, colorsys
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
E = json.load(open(os.path.join(RP, "entity/player.entity.json")))["minecraft:client_entity"]["description"]
STYLE = {"demon": dict(base=2.9, tip=0.9, rot0=34, bend=5, spikes=False, spade=True),
         "dragonoid": dict(base=3.4, tip=1.0, rot0=48, bend=7, spikes=True, spade=False),
         "dragonewt": dict(base=3.0, tip=0.9, rot0=48, bend=7, spikes=True, spade=False),
         "dragonewt_w": dict(base=3.2, tip=0.9, rot0=48, bend=7, spikes=True, spade=False)}
LIN = dict(base=3.4, tip=1.0, rot0=48, bend=7, spikes=True, spade=False)
SEG = 2.5

def face_uv(u, v, w, h): return {k: {"uv": [u, v], "uv_size": [w, h]} for k in ("north", "south", "east", "west", "up", "down")}
def free_spot(img, w, h):
    a = img.split()[-1].load(); W, H = img.size
    for y in range(H - h, -1, -4):
        for x in range(W - w, -1, -4):
            if all(a[x + i, y + j] == 0 for i in range(0, w, 2) for j in range(0, h, 2)): return x, y
    return None
def scale_tile(base, belly):
    t = Image.new("RGBA", (16, 8), base + (255,)); d = ImageDraw.Draw(t)
    h, l, s = colorsys.rgb_to_hls(*[c / 255 for c in base]); dark = tuple(int(c * 255) for c in colorsys.hls_to_rgb(h, max(0, l * 0.62), s))
    hi = tuple(int(c * 255) for c in colorsys.hls_to_rgb(h, min(1, l * 1.25 + 0.05), s))
    for row in range(0, 8, 2):   # escamas em meia-lua alternadas
        for col in range(-1, 8, 2):
            x = col + (row // 2 % 2); d.point((x, row + 1), fill=dark); d.point((x + 1, row + 1), fill=dark); d.point((x, row), fill=hi)
    d.rectangle([8, 0, 15, 7], fill=belly + (255,))
    for y in range(1, 8, 2): d.line([(8, y), (15, y)], fill=tuple(int(c * 0.82) for c in belly) + (255,))   # placas da barriga
    return t
def build(path, race):
    D = json.load(open(path)); G = D["minecraft:geometry"][0]; B = {b["name"]: b for b in G["bones"]}
    tails = sorted([n for n in B if n.startswith("tail") and n[4:].isdigit()], key=lambda n: int(n[4:]))
    if len(tails) < 3: return False
    S = STYLE.get(race, LIN); n = len(tails)
    old0 = B[tails[0]]["cubes"][0]; seg_uv = old0["uv"]; spike_uv = (B[tails[0]]["cubes"][1]["uv"] if len(B[tails[0]]["cubes"]) > 1 else seg_uv)
    last = B[tails[-1]]["cubes"]; spade_uv = (last[1]["uv"] if len(last) > 1 else seg_uv)
    tw = G["description"].get("texture_width", 64)
    if tw >= 256 and seg_uv.get("east", {}).get("uv_size") != [8, 8]:   # ladrilho de escamas próprio (só na 1ª vez: idempotente)
        tk = E["textures"].get(f"etheria_race_{race}")
        if tk:
            tp = os.path.join(RP, tk + ".png"); img = Image.open(tp).convert("RGBA")
            u0, v0 = seg_uv["north"]["uv"]; base = img.getpixel((u0 + 2, v0 + 2))[:3]
            spot = getattr(build, "spots", {}).get(tp) or free_spot(img, 16, 8)
            if spot:
                h, l, s = colorsys.rgb_to_hls(*[c / 255 for c in base]); belly = tuple(int(c * 255) for c in colorsys.hls_to_rgb(h, min(0.85, l * 1.45 + 0.12), s * 0.7))
                img.paste(scale_tile(base, belly), spot); img.save(tp); build.__dict__.setdefault("spots", {})[tp] = spot
                seg_uv = face_uv(spot[0], spot[1], 8, 8); belly_uv = face_uv(spot[0] + 8, spot[1], 8, 8)
                seg_uv["north"] = belly_uv["north"]   # lado de baixo/frente (-z) = barriga
    x0, y0, z0 = B[tails[0]]["pivot"]
    for k, name in enumerate(tails):
        b = B[name]; t = k / max(1, n - 1); w = S["base"] + (S["tip"] - S["base"]) * t ** 0.8
        py = y0 - k * SEG; b["pivot"] = [0, round(py, 3), z0]
        b["rotation"] = [S["rot0"], 0, 0] if k == 0 else [S["bend"] * (1 if k < n - 2 else -0.6), 0, 0]
        cubes = [{"origin": [round(-w / 2, 3), round(py - SEG - 0.25, 3), round(z0 - w / 2, 3)], "size": [round(w, 3), SEG + 0.45, round(w, 3)], "uv": seg_uv}]
        if S["spikes"] and k < n - 1:   # espinho dorsal (lado de trás, +z), maior no meio da cauda
            hgt = 0.6 + 1.1 * (1 - abs(t - 0.35) * 1.6)
            cubes.append({"origin": [-0.25, round(py - SEG * 0.75, 3), round(z0 + w / 2 - 0.15, 3)], "size": [0.5, round(SEG * 0.55, 3), round(max(0.4, hgt), 3)], "uv": spike_uv, "inflate": 0})
        if S["spade"] and k == n - 1:   # ponta em losango
            cy = py - SEG - 1.2
            cubes.append({"origin": [-1.3, round(cy - 1.3, 3), round(z0 - 0.3, 3)], "size": [2.6, 2.6, 0.6], "uv": spade_uv, "pivot": [0, round(cy, 3), z0], "rotation": [0, 0, 45]})
        b["cubes"] = cubes
    json.dump(D, open(path, "w"), indent=1); return True
def main():
    done = []
    for f in sorted(glob.glob(os.path.join(RP, "models/entity/etheria_race_*.geo.json"))):
        race = os.path.basename(f)[len("etheria_race_"):-len(".geo.json")]
        if race in ("lizardman", "beastkin"): continue    # já são segmentadas corretamente
        if race in STYLE or race.startswith("lin_"):
            if build(f, race): done.append(race)
    print("caudas refeitas:", len(done), done)
if __name__ == "__main__": main()

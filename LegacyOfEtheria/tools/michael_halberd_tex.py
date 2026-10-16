# 6.54 - textura PRÓPRIA da alabarda do Michael (o PNG original do mod não pôde ser obtido).
# Pinta cada face de cada cubo do osso weapon_root no layout de UV do modelo: haste dourada escura com anéis,
# lâminas e pontas brancas/douradas, frisos dourados finos, e um núcleo de luz (alfa 0 = emissivo no entity_emissive_alpha).
# Uso: python3 tools/michael_halberd_tex.py <michael_afk.geo.json> <saida.png>
import json, sys, math
from PIL import Image

GOLD = (222, 178, 74); GOLD_D = (150, 104, 36); GOLD_L = (255, 228, 140); WHITE = (244, 244, 236); SILVER = (206, 212, 224); GLOW = (255, 246, 196)

def faces_box(c):
    """faces (nome, x, y, w, h) do UV em caixa do Bedrock"""
    (w, h, d), (u, v) = c["size"], c["uv"]
    W, H, D = max(1, math.ceil(w)), max(1, math.ceil(h)), max(1, math.ceil(d))
    return [("up", u + D, v, W, D), ("down", u + D + W, v, W, D), ("east", u, v + D, D, H), ("north", u + D, v + D, W, H),
            ("west", u + D + W, v + D, D, H), ("south", u + 2 * D + W, v + D, W, H)]

def faces_dict(c):
    out = []
    for n, f in c["uv"].items():
        (u, v), (w, h) = f["uv"], f["uv_size"]
        x0, x1, y0, y1 = sorted((u, u + w))[0], sorted((u, u + w))[1], sorted((v, v + h))[0], sorted((v, v + h))[1]
        out.append((n, math.floor(x0), math.floor(y0), max(1, math.ceil(x1 - x0)), max(1, math.ceil(y1 - y0))))
    return out

def role(c, zmin, zmax):
    w, h, d = c["size"]; z = c["origin"][2] + d / 2; t = (z - zmin) / max(1, zmax - zmin)
    if max(w, h, d) > 60: return "shaft"
    if min(w, h, d) <= 0.01: return "fin"              # plano (lâmina fina)
    if max(w, h, d) <= 1.0: return "trim"
    if t < 0.32 or t > 0.9: return "blade"             # cabeça/pontas nas extremidades
    return "guard"

def shade(col, k): return tuple(max(0, min(255, int(c * k))) for c in col)

def paint(img, x, y, w, h, kind, face, seed):
    px = img.load(); top = {"up": 1.12, "down": 0.78, "north": 1.0, "south": 0.95, "east": 0.9, "west": 0.9}.get(face, 1)
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            if not (0 <= X < img.width and 0 <= Y < img.height): continue
            edge = i == 0 or j == 0 or i == w - 1 or j == h - 1
            if kind == "shaft":
                ring = (i + j * 0) % 12 in (0, 1) if w > h else (j % 12) in (0, 1)
                base = GOLD_L if ring else (GOLD_D if (i + j) % 7 == 0 else shade(GOLD, 0.82))
                a = 255
                if not ring and w > 4 and h > 2 and 0 < j < h - 1 and j == h // 2: base, a = GLOW, 0   # veio de luz ao longo da haste
            elif kind == "blade":
                g = j / max(1, h - 1) if h > 1 else 0.5
                base = tuple(int(WHITE[k] * (1 - g * 0.25) + SILVER[k] * g * 0.25) for k in range(3)); a = 255
                if edge: base = GOLD
                elif (i + j + seed) % 9 == 0: base, a = GLOW, 0
            elif kind == "fin":
                base, a = (GLOW, 0) if not edge else (GOLD_L, 255)
            elif kind == "trim":
                base, a = GOLD_L, 255
            else:   # guard / ornamentos
                base = GOLD if not edge else GOLD_D; a = 255
                if (i * 3 + j + seed) % 11 == 0: base = GOLD_L
            px[X, Y] = (*shade(base, top), a)

def main(geo_p, out_p):
    G = json.load(open(geo_p))["minecraft:geometry"][0]; tw, th = G["description"]["texture_width"], G["description"]["texture_height"]
    w = next(b for b in G["bones"] if b["name"] == "weapon_root"); cubes = w["cubes"]
    zs = [c["origin"][2] for c in cubes] + [c["origin"][2] + c["size"][2] for c in cubes]; zmin, zmax = min(zs), max(zs)
    img = Image.new("RGBA", (tw, th), (0, 0, 0, 0)); n = 0
    # cubos maiores primeiro: os pequenos (frisos) ficam por cima quando o layout compartilha pixels
    for k, c in enumerate(sorted(cubes, key=lambda c: -c["size"][0] * max(c["size"][1], .1) * c["size"][2])):
        kind = role(c, zmin, zmax)
        for face, x, y, fw, fh in (faces_dict(c) if isinstance(c["uv"], dict) else faces_box(c)):
            paint(img, x, y, fw, fh, kind, face, k); n += 1
    img.save(out_p); print("ok:", len(cubes), "cubos,", n, "faces pintadas ->", out_p)

if __name__ == "__main__": main(sys.argv[1], sys.argv[2])

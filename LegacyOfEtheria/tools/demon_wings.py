# 6.75 - ASAS DO DEMÔNIO PROFISSIONAIS (jogador, etheria_race_demon).
# Antes: cada dedo tinha um RETÂNGULO de membrana pendurado (leque listrado, buracos e sobras). Agora a membrana é desenhada em
# polígonos exatos: um triângulo entre cada par de dedos (no referencial do dedo de cima, então acompanha o leque), o painel do
# pulso até a ponta do último dedo e o painel do braço até a cintura. A borda de fuga é curva (arcos recortados entre as pontas),
# como asa de morcego/dragão. Textura nova pintada na área livre (linhas 128+): degradê do bordo para o centro, veias saindo do
# pulso, borda escura. Membrana em 2 lâminas (volume). Dedos afinam da base para a ponta, garra do polegar no pulso.
import json, os, copy, shutil, math, random
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
GP = os.path.join(RP, "models/entity/etheria_race_demon.geo.json"); TP = os.path.join(RP, "textures/entity/etheria_race_demon.png")
SD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "race_geo_src")
os.makedirs(SD, exist_ok=True)
for a, b in ((GP, "demon.geo.json"), (TP, "demon.png")):
    if not os.path.exists(os.path.join(SD, b)): shutil.copy(a, os.path.join(SD, b))
D = json.load(open(os.path.join(SD, "demon.geo.json"))); G = D["minecraft:geometry"][0]; B = {b["name"]: b for b in G["bones"]}
TEX = Image.open(os.path.join(SD, "demon.png")).convert("RGBA"); TEX = TEX.copy()
PX = 3                                   # pixels por unidade na membrana (alta definição)
random.seed(7)

def rot(p, ang, c):
    a = math.radians(ang); x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(a) - y * math.sin(a), c[1] + x * math.sin(a) + y * math.cos(a))
def curve(p, q, toward, bow=0.28, n=10):
    """arco de p até q puxado na direção de 'toward' (borda de fuga recortada)"""
    m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2); c = (m[0] + (toward[0] - m[0]) * bow, m[1] + (toward[1] - m[1]) * bow)
    return [((1 - t) ** 2 * p[0] + 2 * (1 - t) * t * c[0] + t * t * q[0], (1 - t) ** 2 * p[1] + 2 * (1 - t) * t * c[1] + t * t * q[1]) for t in [i / n for i in range(n + 1)]]

# ---------- empacotador simples na área livre da textura ----------
shelf = {"x": 0, "y": 130, "h": 0}
def alloc(w, h):
    if shelf["x"] + w > 248: shelf["x"], shelf["y"], shelf["h"] = 0, shelf["y"] + shelf["h"] + 1, 0
    x, y = shelf["x"], shelf["y"]; shelf["x"] += w + 1; shelf["h"] = max(shelf["h"], h)
    assert y + h <= 256, "sem espaço na textura"
    return x, y
SOLID = (252, 252)   # pixel sólido para as laterais finas das lâminas
TEX.putpixel(SOLID, (58, 8, 16, 255))

def paint(poly, vein_from, edge_pts):
    """pinta o polígono (unidades locais) e devolve (u, v, w, h, xmin, ymin, W, H)"""
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]; xmin, xmax, ymin, ymax = min(xs), max(xs), min(ys), max(ys)
    W, H = xmax - xmin, ymax - ymin; w, h = math.ceil(W * PX), math.ceil(H * PX); u, v = alloc(w, h)
    toP = lambda p: ((p[0] - xmin) * PX, (ymax - p[1]) * PX)
    mask = Image.new("L", (w, h), 0); ImageDraw.Draw(mask).polygon([toP(p) for p in poly], fill=255)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0)); px = img.load(); mk = mask.load()
    vf = toP(vein_from); diag = math.hypot(w, h)
    for y in range(h):
        for x in range(w):
            if not mk[x, y]: continue
            d = math.hypot(x - vf[0], y - vf[1]) / diag                     # perto do pulso = mais escuro (couro grosso)
            t = min(1, d * 1.5); n = random.randint(-6, 6)
            r = int(62 + 70 * t + n); g = int(9 + 12 * t + n // 3); b = int(18 + 18 * t + n // 2)
            px[x, y] = (r, g, b, 255)
    dr = ImageDraw.Draw(img)
    for e in edge_pts:                                                       # veias: do pulso até pontos da borda de fuga
        a = toP(e); mid = ((vf[0] + a[0]) / 2 + random.uniform(-2, 2), (vf[1] + a[1]) / 2 + random.uniform(-2, 2))
        dr.line([vf, mid, a], fill=(40, 4, 10, 255), width=1)
    # borda escura (contorno do polígono)
    edge = mask.filter(__import__("PIL.ImageFilter", fromlist=["x"]).MinFilter(3))
    em = edge.load()
    for y in range(h):
        for x in range(w):
            if mk[x, y] and not em[x, y]: px[x, y] = (34, 3, 8, 255)
    img.putalpha(mask)
    TEX.paste(img, (u, v), img)
    return u, v, w, h, xmin, ymin, W, H

def panel(poly, vein_from, edge_pts, z, mirror):
    u, v, w, h, xmin, ymin, W, H = paint(poly, vein_from, edge_pts)
    side = {"uv": list(SOLID), "uv_size": [1, 1]}
    cubes = []
    for dz in (-0.16, 0.16):
        nf = {"uv": [u + w, v], "uv_size": [-w, h]} if mirror else {"uv": [u, v], "uv_size": [w, h]}
        sf = {"uv": [u, v], "uv_size": [w, h]} if mirror else {"uv": [u + w, v], "uv_size": [-w, h]}
        x0 = -xmin - W if mirror else xmin
        cubes.append({"origin": [round(x0, 4), round(ymin, 4), round(z + dz, 4)], "size": [round(W, 4), round(H, 4), 0],
                      "uv": {"north": nf, "south": sf}})
    return cubes, (u, v, w, h)

def finger(c):
    o, s = c["origin"], c["size"]; a = copy.deepcopy(c); b = copy.deepcopy(c)
    a["size"] = [s[0] * 0.55, s[1], s[2]]
    b["origin"] = [o[0] + (s[0] * 0.55 if o[0] >= 0 else 0), o[1] + 0.2, o[2] + 0.2]; b["size"] = [s[0] * 0.45, s[1] - 0.4, s[2] - 0.4]
    if o[0] < 0: a["origin"] = [o[0] + s[0] * 0.45, o[1], o[2]]
    return [a, b]
def claw(base, x, y, z, sg, rz):
    c = copy.deepcopy(base); c["origin"] = [x, y, z]; c["size"] = [0.9, 1.6, 0.8]
    c["pivot"] = [x + 0.45, y + 1.6, z + 0.4]; c["rotation"] = [0, 0, sg * rz]
    t = copy.deepcopy(c); t["origin"] = [x + 0.15, y - 0.9, z + 0.15]; t["size"] = [0.6, 1.0, 0.5]; t["rotation"] = [0, 0, sg * (rz + 35)]
    return [c, t]

# ---------- geometria em referencial do lado esquerdo (x+); o direito é o espelho ----------
Wr = (20.4, 21.5); E = (10.275, 21.5); R0 = (1.5, 21.5)
rots = [B[f"wingF{i}_l"]["rotation"][2] for i in range(5)]
lens = [B[f"wingF{i}_l"]["cubes"][0]["size"][0] for i in range(5)]
tip = lambda i, ang: (Wr[0] + lens[i] * math.cos(math.radians(ang)), Wr[1] + lens[i] * math.sin(math.radians(ang)))
cache = {}
def build_left():
    out = {}
    for i in range(4):                       # entre dedos: no referencial do dedo i (dedo i em ângulo 0)
        d = rots[i + 1] - rots[i]; A = tip(i, 0); Bp = tip(i + 1, d)
        A2 = (A[0] + 0.3, A[1] + 0.25)                           # encaixa por baixo do dedo
        poly = [(Wr[0] - 0.4, Wr[1] + 0.4), A2] + curve(A, Bp, Wr, 0.30)[1:-1] + [Bp]
        out[f"wingF{i}"] = (poly, Wr, curve(A, Bp, Wr, 0.30)[2:-2:3], 2.6)
    # pulso -> ponta do último dedo -> sob o cotovelo (referencial wingC: dedo 4 a rots[4])
    T = tip(4, rots[4]); Ec = rot(E, 10, Wr)                     # cotovelo no referencial C (C gira -10 em relação a B)
    K = (Ec[0] + (T[0] - Wr[0]) * 0.62, Ec[1] + (T[1] - Wr[1]) * 0.62)
    poly = [(Wr[0] + 0.5, Wr[1] + 0.5), (T[0] + 0.3, T[1] - 0.1)] + curve(T, K, Wr, 0.25)[1:] + [(Ec[0], Ec[1] + 0.5)]
    out["wingC"] = (poly, Wr, curve(T, K, Wr, 0.25)[2:-1:3], 2.6)
    # braço: ombro -> cotovelo -> pulso (repouso) -> descendo até a cintura (referencial wingA)
    Wa = rot(Wr, -46, E); Ka = rot(rot(K, -10, Wr), -46, E); S = (1.6, 11.8)
    poly = [(R0[0], R0[1] + 0.4), (E[0], E[1] + 0.5), (Wa[0] - 0.3, Wa[1] + 0.4), Ka] + curve(Ka, S, (E[0] - 3, E[1]), 0.22)[1:]
    out["wingA"] = (poly, E, curve(Ka, S, E, 0.22)[2:-1:3] + [Ka], 2.6)
    return out
L = build_left()
for sd, mirror in (("l", False), ("r", True)):
    # remove as membranas antigas (lâminas finas) e afina os dedos
    for n in ["wingA", "wingB"] + [f"wingF{i}" for i in range(5)] + ["wingC"]:
        b = B[f"{n}_{sd}"]; b["cubes"] = [c for c in b.get("cubes", []) if min(c["size"]) >= 0.6]
    for i in range(5):
        F = B[f"wingF{i}_{sd}"]; F["cubes"] = finger(F["cubes"][0]) + F["cubes"][1:]
    for n, (poly, vf, ed, z) in L.items():
        key = n
        if key not in cache: cache[key] = None
        cubes, reg = panel(poly, vf, ed, z, mirror) if cache[key] is None else (None, cache[key])
        if cubes is None:   # lado direito: reaproveita a mesma pintura, só espelha a UV
            u, v, w, h = reg; cubes = []
            xs = [p[0] for p in poly]; ys = [p[1] for p in poly]; xmin, ymin = min(xs), min(ys); W, H = max(xs) - xmin, max(ys) - ymin
            for dz in (-0.16, 0.16):
                cubes.append({"origin": [round(-xmin - W, 4), round(ymin, 4), round(z + dz, 4)], "size": [round(W, 4), round(H, 4), 0],
                              "uv": {"north": {"uv": [u + w, v], "uv_size": [-w, h]}, "south": {"uv": [u, v], "uv_size": [w, h]}}})
        else: cache[key] = reg
        if n.startswith("wingF") or n == "wingC":   # membrana num osso próprio (dobradiça no dedo/pulso) para poder ondular e acompanhar o leque
            par = B[f"{n}_{sd}"]; wb = {"name": f"wingW{n[5:] or 'C'}_{sd}", "parent": par["name"], "pivot": list(par["pivot"]), "cubes": cubes}
            G["bones"].insert(G["bones"].index(par) + 1, wb)
        else: B[f"{n}_{sd}"]["cubes"] += cubes
    C = B[f"wingC_{sd}"]; sg = -1 if mirror else 1
    C["cubes"] += claw(B[f"wingF0_{sd}"]["cubes"][2], C["pivot"][0] - 0.45, C["pivot"][1] + 1.6, 2.2, sg, 25)
G["description"]["visible_bounds_width"] = 8
json.dump(D, open(GP, "w"), indent=1); TEX.save(TP)
# animação dos dedos e da membrana
AP = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(AP))
bones = AN["animations"]["animation.etheria.race_demon"]["bones"]
for k in [k for k in bones if k.startswith(("wingF", "wingM", "wingW"))]: del bones[k]
# leque: f = quanto cada par de dedos vizinhos fecha (graus). Chão: fecha um pouco (agachado fecha muito); ar: abre e pulsa com a batida.
# O último dedo fica fixo e os outros giram (4-i)*f; a membrana entre dedos escala na vertical sin(24-f)/sin(24) para continuar presa.
FL = "math.sin(query.life_time * (query.vertical_speed < -1.0 ? 90 : 640) - 60)"
f = f"(query.is_on_ground ? (query.is_sneaking ? 14 : 6 + math.sin(query.life_time * 70) * 1.5) : (query.vertical_speed < -1.0 ? -5 : -2 + {FL} * 4))"
amp = "(query.is_on_ground ? 2.5 : (query.vertical_speed < -1.0 ? 4 : 9))"
spd = "(query.is_on_ground ? 120 : (query.vertical_speed < -1.0 ? 90 : 640))"
for sd, sg in (("l", 1), ("r", -1)):
    for i in range(5):
        if i < 4: bones[f"wingF{i}_{sd}"] = {"rotation": [0, 0, f"{-sg} * {4 - i} * {f}"]}
        wb = f"wingW{i}_{sd}" if i < 4 else f"wingWC_{sd}"
        bones[wb] = {"rotation": [f"math.sin(query.life_time * {spd} - {80 + i * 25}) * {amp}", 0, 0]}   # ondulação (pega vento)
        if i < 4: bones[wb]["scale"] = [1, f"math.sin(24 - {f}) / 0.40674", 1]
json.dump(AN, open(AP, "w"), indent=1)
print("demônio ok; textura usada até a linha", shelf["y"] + shelf["h"])

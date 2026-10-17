# 6.75 - ASAS DO DEMÔNIO PROFISSIONAIS (jogador, etheria_race_demon).
# Antes: cada dedo tinha um RETÂNGULO de membrana pendurado (leque listrado, buracos e sobras). Agora a membrana é desenhada em
# polígonos exatos: um triângulo entre cada par de dedos (no referencial do dedo de cima, então acompanha o leque), o painel do
# pulso até a ponta do último dedo e o painel do braço até a cintura. A borda de fuga é curva (arcos recortados entre as pontas),
# como asa de morcego/dragão. Textura nova pintada na área livre (linhas 128+): degradê do bordo para o centro, veias saindo do
# pulso, borda escura. Membrana em 2 lâminas (volume). Dedos afinam da base para a ponta, garra do polegar no pulso.
# 6.78: cauda mais grossa. Com o argumento "lord" gera a FORMA LORDE DEMÔNIO (etheria_race_demon_lord): asas maiores e negras com veias
# carmesim, segundo par de chifres, coroa de espinhos flutuando atrás da cabeça, ombreiras de espinhos, cauda ainda mais grossa com
# espinhos dorsais e lâmina maior. Rodar: python3 tools/demon_wings.py && python3 tools/demon_wings.py lord
import json, os, copy, shutil, math, random, sys
from PIL import Image, ImageDraw
LORD = len(sys.argv) > 1 and sys.argv[1] == "lord"; VAR = "demon_lord" if LORD else "demon"
PAL = dict(base=(70, 16, 92), vein=(30, 4, 30), hi=(200, 34, 60)) if LORD else dict(base=(150, 22, 36), vein=(52, 6, 14), hi=(150, 30, 44))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
GP0 = os.path.join(RP, "models/entity/etheria_race_demon.geo.json"); TP0 = os.path.join(RP, "textures/entity/etheria_race_demon.png")
GP = os.path.join(RP, f"models/entity/etheria_race_{VAR}.geo.json"); TP = os.path.join(RP, f"textures/entity/etheria_race_{VAR}.png")
SD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "race_geo_src")
os.makedirs(SD, exist_ok=True)
for a, b in ((GP0, "demon.geo.json"), (TP0, "demon.png")):
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
    from PIL import ImageFilter
    lv = [mask]                                                              # distância até a borda (camadas de erosão)
    for _ in range(6): lv.append(lv[-1].filter(ImageFilter.MinFilter(3)))
    lvl = [l.load() for l in lv]
    blot = Image.new("L", (w, h), 0); bd = ImageDraw.Draw(blot)              # manchas de pele (baixa frequência)
    for _ in range(max(2, w * h // 260)):
        cx, cy, r = random.uniform(0, w), random.uniform(0, h), random.uniform(1.5, 4.5)
        bd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=random.randint(40, 110))
    blot = blot.filter(ImageFilter.GaussianBlur(1.6)).load()
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0)); px = img.load(); mk = mask.load()
    vf = toP(vein_from); diag = math.hypot(w, h)
    for y in range(h):
        for x in range(w):
            if not mk[x, y]: continue
            dist = sum(1 for l in lvl[1:] if l[x, y])                        # 0 = borda ... 6 = miolo
            t = min(1, math.hypot(x - vf[0], y - vf[1]) / diag * 1.5)       # pulso escuro -> centro mais claro (couro mais fino)
            light = 0.55 + 0.45 * t
            if dist == 0: light = 0.35                                       # contorno
            elif dist == 1: light *= 0.72                                    # bordo engrossado
            elif dist in (2, 3): light *= 1.12                               # brilho logo atrás do bordo (volume)
            light *= 1 - blot[x, y] / 1400
            px[x, y] = tuple(min(255, int(c * light)) for c in PAL["base"]) + (255,)
    dr = ImageDraw.Draw(img)
    def vein(p0, p1, wid=1):
        mid = ((p0[0] + p1[0]) / 2 + random.uniform(-1.6, 1.6), (p0[1] + p1[1]) / 2 + random.uniform(-1.6, 1.6))
        dr.line([(p0[0] + 1, p0[1]), (mid[0] + 1, mid[1]), (p1[0] + 1, p1[1])], fill=PAL["hi"] + (255,), width=1)   # brilho ao lado
        dr.line([p0, mid, p1], fill=PAL["vein"] + (255,), width=wid)
        return mid
    for e in edge_pts:                                                       # veias principais + ramificações
        a = toP(e); m = vein(vf, a, 1)
        for f in (0.55,):
            q = (vf[0] + (a[0] - vf[0]) * f, vf[1] + (a[1] - vf[1]) * f); ang = math.atan2(a[1] - vf[1], a[0] - vf[0]) + random.choice((-1, 1)) * random.uniform(0.35, 0.6)
            ln = math.hypot(a[0] - vf[0], a[1] - vf[1]) * random.uniform(0.18, 0.3)
            vein(q, (q[0] + math.cos(ang) * ln, q[1] + math.sin(ang) * ln))
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
    sg = -1 if mirror else 1
    Bb = B[f"wingB_{sd}"]; ex = Bb["pivot"][0]; dk = B[f"wingB_{sd}"]["cubes"][2]; gd = B[f"wingB_{sd}"]["cubes"][1]
    for o, sz, rz, src in (((ex - 0.7, 21.6, 1.9), (1.4, 2.4, 1.4), 38, dk), ((ex - 0.45, 23.6, 2.15), (0.9, 2.0, 0.9), 58, dk), ((ex - 0.25, 25.2, 2.35), (0.5, 1.3, 0.5), 75, dk)):
        c = copy.deepcopy(src); c["origin"] = [o[0], o[1], o[2]]; c["size"] = list(sz); c["pivot"] = [ex, 21.6, 2.6]; c["rotation"] = [0, 0, sg * rz]
        Bb["cubes"].append(c)                                                # espinho curvo no cotovelo 
    C = B[f"wingC_{sd}"]
    C["cubes"] += claw(B[f"wingF0_{sd}"]["cubes"][2], C["pivot"][0] - 0.45, C["pivot"][1] + 1.6, 2.2, sg, 25)
# ---------- cauda mais grossa (lorde: ainda mais, com espinhos dorsais) ----------
TK = 2.2 if LORD else 1.7
for i in range(7):
    tb = B[f"tail{i}"]; c = tb["cubes"][0]; o, sz = c["origin"], c["size"]
    nx, nz = sz[0] * TK, sz[2] * TK; c["origin"] = [o[0] - (nx - sz[0]) / 2, o[1], o[2] - (nz - sz[2]) / 2]; c["size"] = [nx, sz[1] + 0.3, nz]
    if i == 6:
        sp = tb["cubes"][1]; k = 1.6 if LORD else 1.3
        sp["size"] = [sp["size"][0] * k, sp["size"][1] * k, 0.9]; sp["origin"] = [-sp["size"][0] / 2, sp["origin"][1] - 1.0, sp["origin"][2]]
    if LORD and i < 6:   # espinhos dorsais
        sd_ = copy.deepcopy(c); h = 1.6 - i * 0.18
        sd_["origin"] = [-0.3, o[1] + 0.6, o[2] + nz - (nz - sz[2]) / 2 - 0.2]; sd_["size"] = [0.6, h, 0.6]
        sd_["pivot"] = [0, o[1] + 0.6, sd_["origin"][2]]; sd_["rotation"] = [55, 0, 0]
        tb["cubes"].append(sd_)
if LORD:
    U = lambda u, v: {"uv": {f: {"uv": [u, v], "uv_size": [1, 1]} for f in ("north", "south", "east", "west", "up", "down")}}
    dk, gd = U(1, 1), U(17, 1)                                     # negro (barra da asa) e dourado (garras)
    def cube(src, o, sz, piv=None, rot=None):
        c = copy.deepcopy(src); c["origin"] = list(o); c["size"] = list(sz)
        if piv: c["pivot"] = list(piv); c["rotation"] = list(rot)
        return c
    # segundo par de chifres: maiores, curvos para trás (cópia girada do chifre principal)
    for sd, sg in (("l", 1), ("r", -1)):
        h = copy.deepcopy(B[f"horn_{sd}"]); t = copy.deepcopy(B[f"horn_{sd}_tip"])
        h["name"] = f"horn2_{sd}"; t["name"] = f"horn2_{sd}_tip"; t["parent"] = h["name"]
        h["pivot"] = [sg * 3.2, 31.5, -1.5]; h["rotation"] = [-58, sg * -18, sg * 10]
        for c in h["cubes"] + t["cubes"]: c["origin"][2] += 2.4; c["origin"][1] -= 0.6
        t["pivot"] = [t["pivot"][0], t["pivot"][1] - 0.6, t["pivot"][2] + 2.4]
        G["bones"] += [h, t]
    # coroa de espinhos flutuando atrás da cabeça
    crown = {"name": "lord_crown", "parent": "head", "pivot": [0, 30.5, 5.2], "cubes": []}
    r = 4.4
    for k in range(12):                      # anel negro (segmentos tangentes) + 6 espinhos para fora com ponta dourada
        a = k * 30; cx, cy = math.sin(math.radians(a)) * r, 30.5 + math.cos(math.radians(a)) * r
        crown["cubes"].append(cube(dk, (cx - 1.2, cy - 0.35, 5.0), (2.4, 0.7, 0.7), (cx, cy, 5.35), (0, 0, -a)))
        if k % 2 == 0:
            ln = 2.6 if k % 4 == 0 else 1.7
            crown["cubes"].append(cube(dk, (cx - 0.35, cy + 0.2, 5.05), (0.7, ln, 0.6), (cx, cy, 5.35), (0, 0, -a)))
            crown["cubes"].append(cube(gd, (cx - 0.2, cy + 0.2 + ln, 5.15), (0.4, 0.6, 0.4), (cx, cy, 5.35), (0, 0, -a)))
    G["bones"].append(crown)
    # ombreiras de espinhos
    for sd, sg in (("l", 1), ("r", -1)):
        pb = {"name": f"lord_pauldron_{sd}", "parent": "body", "pivot": [sg * 5, 24, 0], "cubes": []}
        for j, (dy, dz, ln, ang) in enumerate(((0.2, -1.2, 2.6, 30), (0.0, 0.2, 3.2, 22), (-0.2, 1.5, 2.4, 14))):
            x0 = sg * 5.2 - 0.4
            pb["cubes"].append(cube(gd if j == 1 else dk, (x0, 24 + dy, dz), (0.8, ln, 0.8), (sg * 5.2, 24 + dy, dz + 0.4), (0, 0, -sg * ang)))
        pb["cubes"].append(cube(dk, (sg * 5.6 - 1.6 if sg > 0 else sg * 5.6 - 1.6, 23.2, -2.2), (3.2, 1.2, 4.4)))
        G["bones"].append(pb)
G["description"]["identifier"] = f"geometry.etheria_race_{VAR}"
G["description"]["visible_bounds_width"] = 9 if LORD else 8
json.dump(D, open(GP, "w"), indent=1); TEX.save(TP)
# animação dos dedos e da membrana
AP = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(AP))
if LORD:
    AN["animations"]["animation.etheria.race_demon_lord"] = copy.deepcopy(AN["animations"]["animation.etheria.race_demon"])
bones = AN["animations"][f"animation.etheria.race_{VAR}"]["bones"]
for k in [k for k in bones if k.startswith(("wingF", "wingM", "wingW"))]: del bones[k]
# leque: f = quanto cada par de dedos vizinhos fecha (graus). Chão: fecha um pouco (agachado fecha muito); ar: abre e pulsa com a batida.
# O último dedo fica fixo e os outros giram (4-i)*f; a membrana entre dedos escala na vertical sin(24-f)/sin(24) para continuar presa.
FL = "math.sin(query.life_time * (query.vertical_speed < -1.0 ? 90 : 640) - 60)"
f = f"(query.is_on_ground ? (query.is_sneaking ? 14 : 6 + math.sin(query.life_time * 70) * 1.5) : (query.vertical_speed < -1.0 ? -5 : -2 + {FL} * 4))"
amp = "(query.is_on_ground ? 2.5 : (query.vertical_speed < -1.0 ? 4 : 9))"
spd = "(query.is_on_ground ? 120 : (query.vertical_speed < -1.0 ? 90 : 640))"
for sd, sg in (("l", 1), ("r", -1)):
    bones[f"wing_{sd}"]["scale"] = 1.45 if LORD else 1.2
    if LORD:
        bones[f"horn_{sd}"] = {**bones.get(f"horn_{sd}", {}), "scale": 1.3}
        bones[f"lord_pauldron_{sd}"] = {"scale": [1, "1 + math.sin(query.life_time * 40) * 0.02", 1]}
    for i in range(5):
        if i < 4: bones[f"wingF{i}_{sd}"] = {"rotation": [0, 0, f"{-sg} * {4 - i} * {f}"]}
        wb = f"wingW{i}_{sd}" if i < 4 else f"wingWC_{sd}"
        bones[wb] = {"rotation": [f"math.sin(query.life_time * {spd} - {80 + i * 25}) * {amp}", 0, 0]}   # ondulação (pega vento)
        if i < 4: bones[wb]["scale"] = [1, f"math.sin(24 - {f}) / 0.40674", 1]
if LORD:   # coroa gira devagar e flutua
    bones["lord_crown"] = {"rotation": [0, 0, "query.life_time * 25"], "position": [0, "math.sin(query.life_time * 90) * 0.35", 0]}
json.dump(AN, open(AP, "w"), indent=1)
print("demônio ok; textura usada até a linha", shelf["y"] + shelf["h"])

"""APOSENTADO NA 9.5 (substituído por tools/particle_wings.py: asas de PARTÍCULAS). Só roda com --force.
9.4 - ASAS DEMONÍACAS DE PENAS (referência: vídeo de mod Java, asas negras de penas longas em lâmina, detalhes vermelhos na base).
Substitui as asas das raças DEMÔNIO (demon, demon_lord = Lord Demônio) e ANJO CAÍDO (fallen, fallen_dl, fallen_lord, fallen_lord_lord)
do jogador e as asas dos mobs Anjo Caído / Pico / Garasha (geometry.etheria_mobwing_fallen, ossos mw_*).

Geometria: ~50 penas por asa em 3 camadas (coberturas curtas por cima, rêmiges primárias/secundárias/terciárias, camada extra por
baixo), cada pena em 1-3 cubos finos girados (curvatura), ossos hierárquicos: raiz (ombro) -> úmero -> antebraço -> mão, e grupos de
penas (T, S0-S2, P0-P2, K0, K1, X, Y) que dobram ao longo do braço para fechar a asa (alta e estreita em repouso).
Textura procedural (PIL): o atlas das penas ocupa a METADE DIREITA da textura da raça (a textura passa de 256x256 para 512x256;
a metade esquerda é a textura antiga, intacta). UV por face, ~3 px por unidade, sem esticar.
Animação (arquivo pequeno, etheria_dfw.animation.json): só query.anim_time / is_on_ground / is_sneaking / modified_move_speed /
query.property, loops de 3600 s; estados ligados a propriedades NUMÉRICAS (etheria:tier > 0 e etheria:fly 0-4):
repouso/andando/agachado, no ar (pulo), pairando, decolando/subindo, planando, mergulho. Penas extras por estágio (tier >= 3 e >= 5).
Uso: python3 tools/demon_feather_wings.py && python3 tools/split_race_anims.py
(idempotente; rode DEPOIS de demon_wings.py / mob_flight.py, que geravam as asas antigas)"""
import json, os, math, random, re
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SRC = os.path.join(ROOT, "tools/race_src/etheria_race_parts.animation.json")
T = "query.anim_time"; TIER = "query.property('etheria:tier')"
AX = 256                                   # início do atlas das penas (metade direita)
# ------------------------------------------------------------------ paletas (por modelo)
PAL = {
    "demon": dict(red=(204, 22, 38), deep=(112, 8, 18), sheen=(34, 28, 60), tip=(26, 16, 36), redr=0.4, edge=False),
    "lord": dict(red=(232, 30, 44), deep=(134, 10, 22), sheen=(44, 22, 50), tip=(40, 10, 22), redr=0.6, edge=True),
    "fallen": dict(red=(192, 20, 40), deep=(102, 8, 22), sheen=(46, 36, 92), tip=(30, 22, 54), redr=0.3, edge=False),
    "fallen_lord": dict(red=(214, 24, 44), deep=(118, 8, 24), sheen=(50, 34, 96), tip=(36, 18, 52), redr=0.5, edge=True),
}
MODELS = {"demon": ("demon", 0.95), "demon_lord": ("lord", 1.08), "fallen": ("fallen", 1.0), "fallen_dl": ("fallen_lord", 1.1),
          "fallen_lord": ("fallen_lord", 1.05), "fallen_lord_lord": ("fallen_lord", 1.15)}
MOB_K = 1.1
# ------------------------------------------------------------------ atlas: modelos de pena (u, v, W, H) na metade direita
KINDS = {"P": (4, 72), "S": (4, 54), "T": (2, 42), "K": (3, 26), "R": (2, 18), "X": (2, 84), "A": (1, 64)}   # tipo: (variantes, altura px)
TPL = {}
_x = AX + 2
for kind, (nv, h) in KINDS.items():
    for i in range(nv):
        TPL[(kind, i)] = (_x, 2, 10, h); _x += 12
assert _x <= 512

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def mix(c, d, k): return tuple(int(c[i] + (d[i] - c[i]) * k) for i in range(3))

def paint_feather(kind, var, pal, rng):
    W, H = TPL[(kind, var)][2:]
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); px = im.load()
    red_rachis = (var == 1 and kind in ("P", "S", "X")) or (var == 2 and rng.random() < pal["redr"]) or kind == "R"
    base_len = {"K": 0.3, "R": 1.0, "A": 1.0}.get(kind, 0.16)
    taper0 = {"P": 0.55, "X": 0.5, "S": 0.62, "T": 0.6, "K": 0.55, "R": 0.5, "A": 2}.get(kind, 0.6)
    notches = [(rng.uniform(0.25, 0.9), rng.choice((-1, 1)), rng.uniform(0.35, 0.75)) for _ in range({"K": 1, "R": 0, "A": 0}.get(kind, 4))]
    cx = (W - 1) / 2
    for y in range(H):
        v = (y + 0.5) / H
        hw = 0.62 + 0.38 * smooth(0, 0.14, v)
        if v > taper0: hw *= max(0.0, 1 - ((v - taper0) / (1 - taper0)) ** 1.5)
        if kind == "A": hw = 1.0
        for x in range(W):
            dx = (x - cx) / (W / 2); side = 1 if dx > 0 else -1
            lim = hw * (0.86 if side < 0 and kind in ("P", "X") else 1.0)
            if abs(dx) > lim + 0.02: continue
            cut = False
            for nv, sd, dep in notches:            # entalhes oblíquos: barbas separadas
                if sd == side and abs(dx) > lim * (1 - dep) and abs(v - (nv + 0.035 * (abs(dx) - lim * (1 - dep)) * 2)) < 0.6 / H: cut = True
            if cut: continue
            c = (12, 10, 16)
            sh = smooth(0.15, 0.4, v) * (1 - smooth(0.62, 0.9, v)) * max(0.0, 1 - abs(dx + 0.35 * side * 0) * 0.9) * 0.6
            c = mix(c, pal["sheen"], sh * (0.7 if side > 0 else 1.0))
            if (x + y // 2) % 3 == 0: c = mix(c, (0, 0, 0), 0.35)                       # barbas
            if v > 0.78: c = mix(c, pal["tip"], smooth(0.78, 1.0, v) * 0.9)              # ponta em degradê
            if v < base_len:                                                               # base vermelha
                k = 1 - smooth(base_len * 0.25, base_len, v); c = mix(c, pal["deep"], k * 0.95)
                if v < base_len * 0.3: c = mix(c, pal["red"], (1 - v / (base_len * 0.3)) * 0.85)
            if kind == "R": c = mix(pal["deep"], pal["red"], 0.55 + 0.45 * (1 - v)) if abs(dx) < 0.55 else mix(pal["deep"], (20, 6, 10), 0.4)
            if abs(x - cx) < 0.6 or (W % 2 == 0 and abs(x - cx) < 1.0 and x > cx):        # ráquis
                if red_rachis and kind != "A": c = mix(mix(pal["red"], pal["deep"], smooth(0.0, 0.6, v)), c, smooth(0.45, 0.75, v))
                else: c = mix(c, (64, 58, 76), 0.6 * (1 - smooth(0.5, 1.0, v)))
            if pal["edge"] and abs(dx) > lim - 0.22 and v < 0.5 and kind in ("P", "S", "X"): c = mix(c, pal["red"], 0.55 * (1 - v / 0.5))
            if abs(dx) > lim - 0.2: c = mix(c, (0, 0, 0), 0.4)
            if kind == "A":
                c = mix((22, 8, 12), (8, 4, 6), abs(dx))
                if abs(dx) < 0.3: c = mix(c, pal["red"], 0.75 * (0.6 + 0.4 * math.sin(v * 40)))
            n = rng.randint(-5, 5); c = tuple(max(0, min(255, ch + n)) for ch in c)
            px[x, y] = (*c, 255)
    return im

def make_texture(var, path):
    src = Image.open(path).convert("RGBA")
    old = src.crop((0, 0, 256, 256))                       # metade esquerda: textura antiga (idempotente)
    out = Image.new("RGBA", (512, 256), (0, 0, 0, 0)); out.paste(old, (0, 0))
    rng = random.Random(94)
    for (kind, i), (u, v, w, h) in TPL.items(): out.paste(paint_feather(kind, i, PAL[var], rng), (u, v))
    out.save(path)

# ------------------------------------------------------------------ geometria
def rotm(rx, ry, rz):                                     # convenção Bedrock (como no renderizador): Rz(rz) Ry(-ry) Rx(-rx)
    x, y, z = (math.radians(v) for v in (-rx, -ry, rz))
    Rx = [[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]]
    Ry = [[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]]
    Rz = [[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]]
    mm = lambda A, B: [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return mm(Rz, mm(Ry, Rx))
def apply(M, v): return [sum(M[i][k] * v[k] for k in range(3)) for i in range(3)]
r3 = lambda v: [round(x, 3) for x in v]

def faces(tpl, f0, f1):
    u, v, W, H = tpl; a, b = v + f0 * H, max(v + f0 * H + 0.5, v + f1 * H); c = u + W // 2 + 2
    big = {"uv": [u, round(a, 3)], "uv_size": [W, round(b - a, 3)]}; side = {"uv": [c, round(a, 3)], "uv_size": [1, round(b - a, 3)]}
    dot = {"uv": [c, round(a, 3)], "uv_size": [1, 1]}
    return {"north": big, "south": dict(big), "east": side, "west": dict(side), "up": dot, "down": dict(dot)}

def feather(base, alpha, L, w, tpl, nseg=2, curl=0.0, bend=0.0, th=0.6, tilt=0.0):
    """pena pendurada (eixo -y) girada alpha graus para fora (+x), em nseg segmentos; devolve cubos"""
    fr = {1: [1.0], 2: [0.52, 0.48], 3: [0.36, 0.34, 0.30]}[nseg]; out = []; p = list(base); f0 = 0.0
    for k, f in enumerate(fr):
        lk = L * f; ext = 0.25 if k else 0.0                   # sobreposição entre segmentos (sem fresta)
        rx, rz = tilt + bend * k, alpha + curl * k
        out.append({"origin": r3([p[0] - w / 2, p[1] - lk, p[2] - th / 2]), "size": r3([w, lk + ext, th]), "pivot": r3(p),
                    "rotation": r3([rx, 0, rz]), "uv": faces(tpl, f0, f0 + f)})
        d = apply(rotm(rx, 0, rz), [0, -1, 0]); p = [p[i] + d[i] * lk for i in range(3)]; f0 += f
    return out

def wing(K, var):
    """asa ESQUERDA (+x); devolve lista de ossos {name, parent, pivot, cubes} com nomes genéricos (R, A, B, C, grupos)"""
    S = [2.0, 22.0, 2.9]
    def seg(start, ang, ln): d = [math.cos(math.radians(ang)), math.sin(math.radians(ang)), 0]; return [start[i] + d[i] * ln * K for i in range(3)], d
    E, dA = seg(S, 18, 8); Wr, dB = seg(E, 4, 11); Tip, dC = seg(Wr, -8, 9)
    at = lambda a, d, ln, s, dz=0.0: [a[0] + d[0] * ln * K * s, a[1] + d[1] * ln * K * s, a[2] + dz]
    rng = random.Random(7)
    def tp(kind, i): n = KINDS[kind][0]; return TPL[(kind, i % n)]
    B = {}
    def bone(n, parent, piv): B[n] = {"name": n, "parent": parent, "pivot": r3(piv), "cubes": []}; return B[n]["cubes"]
    bone("R", None, S); armA = bone("A", "R", S); armB = bone("B", "A", E); armC = bone("C", "B", Wr)
    armA += feather(S, 108, 8.4 * K, 2.4, TPL[("A", 0)], 1, th=1.6)
    armB += feather(E, 94, 11.4 * K, 2.0, TPL[("A", 0)], 1, th=1.4)
    armC += feather(Wr, 82, 9.4 * K, 1.6, TPL[("A", 0)], 1, th=1.2)
    th = 0.6
    # terciárias + escapulares vermelhas (úmero)
    c = bone("T", "A", at(S, dA, 8, 0.65))
    for i, (s, al, L) in enumerate(zip([0.35, 0.55, 0.72, 0.88, 1.0], [-10, -6, -2, 2, 5], [12, 13, 14, 15, 15.5])):
        c += feather(at(S, dA, 8, s, 0.3 + 0.07 * i), al, L * 1.1 * K, 2.8, tp("T", i), 2, curl=-2, bend=4)
    for i, (s, al) in enumerate(zip([0.2, 0.45, 0.7], [-14, -6, 2])):
        c += feather(at(S, dA, 8, s, 1.0 + 0.06 * i), al, 6.5 * K, 3.2, tp("R", i), 1)
    # secundárias (antebraço), 3 grupos
    for g, idx, sp in (("S0", range(0, 4), 0.15), ("S1", range(4, 8), 0.5), ("S2", range(8, 11), 0.85)):
        c = bone(g, "B", at(E, dB, 11, sp))
        for i in idx:
            s = 0.02 + 0.96 * i / 10
            c += feather(at(E, dB, 11, s, 0.07 * i), 2 + 24 * i / 10, (19.5 + 3 * i / 10) * K, 2.1, tp("S", i), 2, curl=2, bend=5)
    # primárias (mão), 3 grupos
    PL = [21, 22, 23, 24, 25, 26, 27, 27, 26, 24]
    for g, idx, sp in (("P0", range(0, 4), 0.15), ("P1", range(4, 7), 0.55), ("P2", range(7, 10), 0.9)):
        c = bone(g, "C", at(Wr, dC, 9, sp))
        for i in idx:
            s = i / 9
            c += feather(at(Wr, dC, 9, s, 0.8 + 0.07 * i), 28 + 62 * i / 9, PL[i] * 1.15 * K, 1.9 - 0.2 * i / 9, tp("P", i), 3, curl=4, bend=4)
    # coberturas (por cima): antebraço (2 fileiras, a de cima vermelha) e mão
    c = bone("K0", "B", at(E, dB, 11, 0.5))
    for i in range(8):
        s = 0.05 + 0.9 * i / 7
        c += feather(at(E, dB, 11, s, 1.35 + 0.05 * i), 8 + 14 * i / 7, (7.5 + 1.0 * i / 7) * K, 2.6, tp("K", i), 1, tilt=6)
    for i in range(3):
        s = 0.04 + 0.2 * i
        c += feather(at(E, dB, 11, s, 1.8 + 0.05 * i), 6 + 4 * i, (4.6 - 0.5 * i) * K, 2.6, tp("R", i), 1, tilt=8)
    c = bone("K1", "C", at(Wr, dC, 9, 0.4))
    for i in range(5):
        c += feather(at(Wr, dC, 9, 0.8 * i / 4, 1.5 + 0.05 * i), 34 + 32 * i / 4, (9.5 + 1 * i / 4) * K, 2.4, tp("K", i + 1), 1, tilt=6)
    # extras por estágio: primárias externas longas (tier >= 3) e 2ª camada de secundárias por baixo (tier >= 5)
    c = bone("X", "C", Tip)
    for i, (al, L) in enumerate(zip([96, 103, 110], [29, 30, 28])):
        c += feather(at(Wr, dC, 9, 0.92 + 0.04 * i, -0.4 - 0.07 * i), al, L * 1.12 * K, 1.7, tp("X", i), 3, curl=3, bend=4)
    c = bone("Y", "B", at(E, dB, 11, 0.5))
    for i in range(5):
        c += feather(at(E, dB, 11, 0.1 + 0.2 * i, -0.5 - 0.06 * i), 6 + 3.5 * i, (23 + 0.6 * i) * K, 1.9, tp("S", i + 1), 2, curl=2, bend=6)
    return list(B.values())

GROUPS = ["T", "S0", "S1", "S2", "P0", "P1", "P2", "K0", "K1", "X", "Y"]
def names(kind):
    if kind == "player":
        return lambda g, sd: {"R": f"dfw_{sd}"}.get(g, f"dfw{g}_{sd}")
    return lambda g, sd: {"R": f"mw_wing_{sd}", "A": f"mw_wingA_{sd}", "B": f"mw_wingB_{sd}", "C": f"mw_wingC_{sd}"}.get(g, f"mw_df{g}_{sd}")

def mirror_cube(c):
    o, s, pv, r = c["origin"], c["size"], c["pivot"], c["rotation"]
    uv = dict(c["uv"]); uv["east"], uv["west"] = uv["west"], uv["east"]
    return {"origin": r3([-(o[0] + s[0]), o[1], o[2]]), "size": s, "pivot": r3([-pv[0], pv[1], pv[2]]), "rotation": r3([r[0], -r[1], -r[2]]), "uv": uv}

def wing_bones(K, var, kind, root_parent="body"):
    L = wing(K, var); nm = names(kind); out = []
    for sd in ("l", "r"):
        for b in L:
            nb = {"name": nm(b["name"], sd), "parent": nm(b["parent"], sd) if b["parent"] else root_parent,
                  "pivot": b["pivot"] if sd == "l" else r3([-b["pivot"][0], *b["pivot"][1:]]),
                  "cubes": b["cubes"] if sd == "l" else [mirror_cube(c) for c in b["cubes"]]}
            out.append(nb)
    return out

def build_player():
    n = 0
    for model, (var, K) in MODELS.items():
        gp = os.path.join(RP, f"models/entity/etheria_race_{model}.geo.json"); D = json.load(open(gp)); G = D["minecraft:geometry"][0]
        old = {b["name"] for b in G["bones"] if b["name"].startswith(("wing", "dfw"))}
        G["bones"] = [b for b in G["bones"] if b["name"] not in old]
        G["bones"] += wing_bones(K, var, "player")
        G["description"].update(texture_width=512, texture_height=256, visible_bounds_width=11, visible_bounds_height=7, visible_bounds_offset=[0, 1.5, 0])
        json.dump(D, open(gp, "w"), separators=(",", ":"))
        make_texture(var, os.path.join(RP, f"textures/entity/etheria_race_{model}.png"))
        n += sum(len(b["cubes"]) for b in G["bones"] if b["name"].startswith("dfw"))
    return n

def build_mob():
    bones = [{"name": "root", "pivot": [0, 0, 0]}, {"name": "waist", "parent": "root", "pivot": [0, 12, 0]}, {"name": "body", "parent": "waist", "pivot": [0, 24, 0]}]
    bones += wing_bones(MOB_K, "fallen", "mob")
    G = {"description": {"identifier": "geometry.etheria_mobwing_fallen", "texture_width": 512, "texture_height": 256, "visible_bounds_width": 11,
                         "visible_bounds_height": 7, "visible_bounds_offset": [0, 1.5, 0]}, "bones": bones}
    json.dump({"format_version": "1.12.0", "minecraft:geometry": [G]}, open(os.path.join(RP, "models/entity/etheria_mobwing_fallen.geo.json"), "w"), separators=(",", ":"))
    return sum(len(b.get("cubes", [])) for b in bones)

# ------------------------------------------------------------------ animações
FOLD = {"T": 82, "S0": 88, "S1": 80, "S2": 72, "P0": 54, "P1": 36, "P2": 16, "K0": 74, "K1": 34, "X": 4, "Y": 82}
LAG = {"T": 150, "S0": 140, "S1": 125, "S2": 110, "P0": 100, "P1": 85, "P2": 70, "K0": 130, "K1": 90, "X": 60, "Y": 135}
def sn(F, lag=0): return f"math.sin({T} * {F} - {lag})" if lag else f"math.sin({T} * {F})"
def fmt(x): return str(round(x, 2)) if isinstance(x, (int, float)) else x

def state(F, rx, ry, rz, b, c, fold, wave=0.0, wF=None):
    """rx/ry/rz/b/c: expressões (asa esquerda); fold: expressão 0..1 (1 = fechada ao longo do braço); wave: ondulação das penas (graus)"""
    return dict(F=F, rx=rx, ry=ry, rz=rz, b=b, c=c, fold=fold, wave=wave, wF=wF or F)

def bones_for(st, nm):
    out = {}
    for sd, sg in (("l", ""), ("r", "-")):
        neg = lambda e: e if sg == "" else (f"-({e})" if not isinstance(e, (int, float)) else -e)
        out[nm("R", sd)] = {"rotation": [fmt(st["rx"]), neg(fmt(st["ry"])), neg(fmt(st["rz"]))]}
        out[nm("B", sd)] = {"rotation": [0, 0, neg(fmt(st["b"]))]}
        out[nm("C", sd)] = {"rotation": [0, 0, neg(fmt(st["c"]))]}
        for g in GROUPS:
            e = f"{FOLD[g]} * {st['fold']}"
            if st["wave"]: e += f" + {sn(st['wF'], LAG[g])} * {st['wave']}"
            out[nm(g, sd)] = {"rotation": [0, 0, neg(e)]}
    return out

MV = "math.min(1, query.modified_move_speed * 3)"; SNK = "(query.is_sneaking ? 1 : 0)"
def player_states():
    F = 300
    return {
        "ground": state(F, f"6 + 8 * {SNK}", f"-24 - 18 * {SNK}", f"58 - 18 * {SNK} + {sn(80)} * 2.5 + {sn(f'(150 + 190 * {MV})')} * 5 * {MV}",
                        f"-14 + {sn(80, 40)} * 1.5", f"10 + {sn(80, 80)} * 1.5", f"(1 + 0.05 * {SNK})", 1.2, 80),
        "air": state(380, f"4 + {sn(380, 90)} * 6", -8, f"26 + {sn(380)} * 30", f"-6 + {sn(380, 45)} * 12", f"8 + {sn(380, 90)} * 16",
                     f"(0.42 + 0.18 * {sn(380, 100)})", 3),
        "hover": state(F, f"-2 + {sn(F, 90)} * 8", -10, f"10 + {sn(F)} * 34", f"-4 + {sn(F, 45)} * 16", f"6 + {sn(F, 90)} * 20",
                       f"(0.06 + 0.16 * {sn(F, 100)})", 4),
        "rise": state(430, f"-4 + {sn(430, 90)} * 10", -6, f"16 + {sn(430)} * 44", f"-4 + {sn(430, 45)} * 20", f"6 + {sn(430, 90)} * 26",
                      f"(0.1 + 0.22 * {sn(430, 100)})", 5),
        "glide": state(70, f"2 + {sn(70, 90)} * 1.5", -6, f"4 + {sn(70)} * 3", f"-2 + {sn(70, 45)} * 2", f"4 + {sn(70, 90)} * 3", "(-0.12)", 2.5, 140),
        "dive": state(160, 10, -58, f"26 + {sn(600)} * 2", -10, -6, "0.55", 1.5, 600),
    }
P_COND = {"ground": "query.is_on_ground", "air": "!query.is_on_ground && query.property('etheria:fly') == 0"}
for k, v in (("hover", 1), ("rise", 2), ("glide", 3), ("dive", 4)): P_COND[k] = f"!query.is_on_ground && query.property('etheria:fly') == {v}"

def build_anims():
    nm = names("player"); A = {}
    A["animation.etheria.dfw.base"] = {"loop": True, "animation_length": 3600, "bones": {
        **{f"dfw_{sd}": {"scale": f"0.85 + 0.07 * {TIER}"} for sd in "lr"},
        **{f"dfwX_{sd}": {"scale": f"{TIER} >= 3 ? 1 : 0"} for sd in "lr"}, **{f"dfwY_{sd}": {"scale": f"{TIER} >= 5 ? 1 : 0"} for sd in "lr"}}}
    for k, st in player_states().items():
        A[f"animation.etheria.dfw.{k}"] = {"loop": True, "animation_length": 3600, "bones": bones_for(st, nm)}
    for a in A.values():                                    # canais escalares -> vetor
        for b in a["bones"].values():
            if "scale" in b and not isinstance(b["scale"], list): b["scale"] = [b["scale"]] * 3
    old = os.path.join(RP, "animations/etheria_dfw.animation.json")
    if os.path.exists(old): os.remove(old)
    ks = list(A); sizes = []
    for part, keys in (("a", ks[:4]), ("b", ks[4:])):              # 2 arquivos pequenos (~10 KB)
        p = os.path.join(RP, f"animations/etheria_dfw_{part}.animation.json")
        json.dump({"format_version": "1.8.0", "animations": {k: A[k] for k in keys}}, open(p, "w"), separators=(",", ":")); sizes.append(os.path.getsize(p))
    # mobs: os estados do mob (mw_ground ... mw_dive) já giram mw_wing/B/C; aqui só o fechamento das penas + ajuste da raiz
    mn = names("mob"); M = {}
    MOB = {"ground": state(80, 8, -14, f"72 + {sn(80)} * 2", -12, 10, "1", 1.2),
           "hover": state(300, 0, 0, 0, 0, 0, f"(0.06 + 0.16 * {sn(300, 100)})", 4),
           "rise": state(430, 0, 0, 0, 0, 0, f"(0.1 + 0.2 * {sn(430, 100)})", 5),
           "glide": state(70, 0, 0, 0, 0, 0, "(-0.12)", 2.5, 140),
           "dive": state(160, 6, -40, 28, -8, -6, "0.55", 1.5, 600)}
    for k, st in MOB.items():
        bb = bones_for(st, mn)
        bb = {b: v for b, v in bb.items() if any(x not in (0, "0", "-0", "-(0)") for x in v["rotation"])}
        M[f"animation.etheria.dfw_mob.{k}"] = {"loop": True, "animation_length": 3600, "bones": bb}
    json.dump({"format_version": "1.8.0", "animations": M}, open(os.path.join(RP, "animations/etheria_dfw_mob.animation.json"), "w"), separators=(",", ":"))
    return sizes, os.path.getsize(os.path.join(RP, "animations/etheria_dfw_mob.animation.json"))

def wire():
    # jogador
    ep = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(ep)); de = E["minecraft:client_entity"]["description"]
    sa = de["scripts"]["animate"]; sa[:] = [x for x in sa if not (isinstance(x, dict) and any(k.startswith("dfw_") for k in x)) and x != "dfw_base"]
    de["animations"]["dfw_base"] = "animation.etheria.dfw.base"; sa.append({"dfw_base": f"{TIER} > 0"})
    for k, c in P_COND.items():
        de["animations"][f"dfw_{k}"] = f"animation.etheria.dfw.{k}"; sa.append({f"dfw_{k}": f"{TIER} > 0 && {c}"})
    json.dump(E, open(ep, "w"), indent=1, ensure_ascii=False)
    # mobs com as asas caídas
    for mob in ("fallen_angel", "pico", "garasha"):
        p = os.path.join(RP, f"entity/{mob}.entity.json"); s = open(p).read(); ind = 2 if '\n  "' in s else 1
        E = json.loads(s); D = E["minecraft:client_entity"]["description"]
        assert D["geometry"].get("wings") == "geometry.etheria_mobwing_fallen", mob
        an = D["scripts"]["animate"]; an[:] = [a for a in an if not (isinstance(a, dict) and any(k.startswith("dfm_") for k in a))]
        for k, v in (("ground", 0), ("hover", 1), ("rise", 2), ("glide", 3), ("dive", 4)):
            D["animations"][f"dfm_{k}"] = f"animation.etheria.dfw_mob.{k}"; an.append({f"dfm_{k}": f"query.property('etheria:fly') == {v}"})
        open(p, "w").write(json.dumps(E, indent=ind, ensure_ascii=False) + ("\n" if s.endswith("\n") else ""))
    # fonte das animações das raças: tira os ossos das asas antigas; transformações (evolução/lorde) passam para a raiz nova
    AN = json.load(open(SRC)); A = AN["animations"]; n = 0
    bodies = ["demon", "demon_lord", "fallen", "fallen_dl", "fallen_lord", "fallen_lord_lord"]
    for key, a in A.items():
        m = re.match(r"animation\.etheria\.tfx_(evo|lord|dragon|true)_(demon|fallen|fallen_lord)$", key)
        if key.startswith("animation.etheria.race_") and key[len("animation.etheria.race_"):] in bodies:
            for b in [b for b in a.get("bones", {}) if b.startswith("wing")]: del a["bones"][b]; n += 1
        elif m:
            bs = a.get("bones", {})
            for sd in "lr":
                if f"wing_{sd}" in bs: bs[f"dfw_{sd}"] = bs[f"wing_{sd}"]
            for b in [b for b in bs if b.startswith("wing")]: del bs[b]; n += 1
    json.dump(AN, open(SRC, "w"), indent=1)
    return n

def patch_mob_flight():
    p = os.path.join(ROOT, "tools/mob_flight.py"); s = open(p).read()
    old = "    for kind in sorted({v[0] for v in ANGELS.values()}):\n"
    new = old + "        if kind == \"fallen\": continue   # 9.4: asas de penas demoníacas geradas por tools/demon_feather_wings.py\n"
    if new not in s: s = s.replace(old, new); open(p, "w").write(s)

if __name__ == "__main__":
    import sys
    if "--force" not in sys.argv:   # 9.5: aposentado (o usuário não quer penas em cubos); as asas agora são partículas
        sys.exit("demon_feather_wings.py aposentado na 9.5: as asas demoníacas são partículas (tools/particle_wings.py + scripts/systems/particlewings.js). Use --force para regerar as penas.")
    pc = build_player(); mc = build_mob(); sz = build_anims(); nr = wire(); patch_mob_flight()
    print("cubos (6 modelos do jogador):", pc, "| mob:", mc, "| animação jogador/mob:", sz, "bytes | ossos antigos tirados das animações:", nr)

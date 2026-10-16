# 6.67 - FORMAS DE DRAGÃO DO JOGADOR NO VISUAL DO ANIME (Veldanava, Velgrynd, Velzard). Veldora fica com o modelo original (pedido do jogador).
# Base: o modelo original (tools/dragon_src) com os MESMOS ossos -> andar/correr/voar/planar/pouso/ataque/rugido continuam valendo.
# Textura PRÓPRIA do jogador (textures/entity/etheria_pdrg_<linhagem>.png; os chefes não mudam): cada face de cada cubo é repintada conforme
# a direção (costas / lado / barriga) e a parte do corpo (asa, membrana, cabeça, garras), com o padrão do dragão e o sombreado do original.
#   Veldanava  corpo azul-lavanda com escamas, barriga clara em placas, ARMADURA escura com frisos ciano brilhantes, asas escuras com veios
#              ciano, chifres grandes curvos para trás, HALO de luz acima da cabeça, presas no queixo, olhos dourados
#   Velgrynd   serpente: corpo vermelho com escamas em rede, barriga creme em placas com borda dourada, CORPO ALONGADO (cauda longa e grossa),
#              lâminas claras saindo do corpo, bigodes azuis longos, crista vermelha angulosa, asas carmesim
#   Velzard    branco-lilás, espinhos triangulares escuros nas costas/ombros/cauda, crista LARANJA na cabeça, juba azul caindo pelo pescoço,
#              cristais de gelo nos ombros/costas/cauda, asas de gelo
#   Dragão Verdadeiro (osso x_true, só nessa forma): coroa extra + anel de energia da cor do dragão.
# Peças novas = cubos presos aos ossos existentes (chifres/bigodes/juba em "contas" encadeadas, sem rotação -> sempre no lugar).
# Uso: python3 tools/dragon_forms.py   (idempotente: sempre parte de tools/dragon_src e da textura original)
import json, os, math, copy, hashlib
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dragon_src")
TH = 640   # textura 512x640: 512 linhas originais + 128 de ladrilhos das peças novas

PAL = {
  "veldanava": dict(main=(168, 182, 228), back=(140, 152, 210), belly=(222, 230, 248), wing=(58, 66, 92), wbone=(44, 48, 68), claw=(48, 50, 64),
                    pat="scales", T=dict(armor=(54, 60, 80), glow=(120, 255, 250), horn=(70, 74, 100), hornt=(150, 160, 200), eye=(255, 205, 60), halo=(170, 255, 255), tusk=(225, 228, 240), spike=(120, 130, 185))),
  "velgrynd":  dict(main=(196, 36, 38), back=(176, 28, 32), belly=(238, 226, 204), wing=(176, 34, 40), wbone=(110, 18, 22), claw=(40, 30, 40),
                    pat="mesh", T=dict(blade=(226, 236, 214), gold=(232, 192, 92), whisker=(90, 150, 255), crest=(210, 40, 40), eye=(255, 220, 70), body=(196, 36, 38), bodyb=(238, 226, 204), glow=(255, 190, 80), spike=(226, 236, 214))),
  "velzard":   dict(main=(234, 232, 248), back=(214, 210, 238), belly=(250, 250, 255), wing=(196, 226, 250), wbone=(170, 190, 225), claw=(70, 60, 70),
                    pat="cracks", T=dict(spike=(62, 46, 46), crest=(250, 150, 30), mane=(84, 132, 232), crystal=(150, 216, 255), crystal2=(205, 240, 255), eye=(230, 70, 60), glow=(190, 245, 255), horn=(240, 240, 250))),
}
def R(rx, ry, rz):
    x, y, z = [math.radians(v) for v in (rx, ry, rz)]
    Rx = np.array([[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]]); Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    Rz = np.array([[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]]); return Rz @ Ry @ Rx
def corners(c):
    o, s = np.array(c["origin"], float), np.array(c["size"], float)
    P = [o + s * np.array([i, j, k]) for i in (0, 1) for j in (0, 1) for k in (0, 1)]
    if c.get("rotation"):
        r = R(-c["rotation"][0], -c["rotation"][1], c["rotation"][2]); pv = np.array(c.get("pivot", [0, 0, 0]), float)
        P = [r @ (p - pv) + pv for p in P]
    return np.array(P)
def bbox(b):
    P = np.vstack([corners(c) for c in b.get("cubes", [])]); return P.min(0), P.max(0)
def surface(b, z, win=3.0):
    P = np.vstack([corners(c) for c in b.get("cubes", []) if max(c["size"]) > 4])
    near = P[np.abs(P[:, 2] - z) <= win]
    if not len(near): near = P[np.argsort(np.abs(P[:, 2] - z))[:4]]
    return near[:, 1].max()

# ------------------------------------------------------------------ pintura por face
def patt(kind, x, y):
    if kind == "scales": return 0.82 if (y % 4 == 0 and (x + (y // 4) * 2) % 4 in (0, 1)) or ((x + (y // 4) * 2) % 4 == 0 and y % 4 in (1, 2)) else 1.0
    if kind == "mesh": return 0.62 if ((x + y) % 6 == 0 or (x - y) % 6 == 0) else 1.0
    h = int(hashlib.md5(f"{x // 7},{y // 9}".encode()).hexdigest()[:4], 16)   # rachaduras de gelo esparsas
    return 0.84 if (h % 5 == 0 and (x + y * 2) % 7 == 0) or (h % 7 == 0 and x % 9 == (y // 3) % 9) else 1.0
def face_rects(c):
    u, v = c["uv"]; w, h, d = [max(1, math.ceil(s - 1e-6)) for s in c["size"]]
    return {"up": (u + d, v, w, d), "down": (u + d + w, v, w, d), "east": (u, v + d, d, h), "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h), "south": (u + 2 * d + w, v + d, w, h)}
def paint_body(src, G, P):
    W, H = src.size; out = Image.new("RGBA", (W, TH), (0, 0, 0, 0)); S = np.asarray(src).astype(float); O = np.zeros((TH, W, 4))
    for b in G["bones"]:
        n = b["name"]
        for c in b.get("cubes", []):
            if not isinstance(c.get("uv"), list): continue
            small = max(c["size"]) < 3.2; wing = "wing" in n; membrane = wing and 0 in [round(s, 3) for s in c["size"]]
            for f, (x0, y0, fw, fh) in face_rects(c).items():
                x1, y1 = min(W, x0 + fw), min(H, y0 + fh)
                if x1 <= x0 or y1 <= y0: continue
                reg = S[y0:y1, x0:x1]; a = reg[:, :, 3] > 10
                if not a.any(): continue
                lum = reg[:, :, :3].mean(2); m = lum[a].mean() or 1
                if membrane: col, pk = P["wing"], None
                elif wing: col, pk = P["wbone"], None
                elif small or "hand" in n or "thumb" in n: col, pk = P["claw"], None
                elif f == "down": col, pk = P["belly"], "plates"
                elif f == "up": col, pk = P["back"], P["pat"]
                else: col, pk = P["main"], P["pat"]
                for yy in range(y1 - y0):
                    for xx in range(x1 - x0):
                        if not a[yy, xx]: continue
                        sh = max(0.55, min(1.25, 0.95 + (lum[yy, xx] - m) / 255 * 1.6))
                        X, Y = x0 + xx, y0 + yy
                        k = (0.8 if Y % 3 == 0 else 1.0) if pk == "plates" else (patt(pk, X, Y) if pk else 1.0)
                        if membrane and P["pat"] == "scales" and (X * 3 + Y) % 23 == 0: O[Y, X] = (*P["T"]["glow"], 255); continue   # veios ciano
                        O[Y, X] = (*[min(255, v * sh * k) for v in col], 255)
    return Image.fromarray(O.astype(np.uint8)).copy()
def tiles(img, T):   # ladrilhos 16x16 nas linhas 512+ ; devolve uv por nome
    px = img.load(); uv = {}
    for i, (name, col) in enumerate(T.items()):
        x0, y0 = (i % 32) * 16, 512 + (i // 32) * 16
        for y in range(16):
            for x in range(16):
                f = 1.15 - 0.3 * (y / 15) + (0.07 if (x + y) % 5 == 0 else 0)
                if name in ("body",): f *= patt("mesh", x, y)
                if name in ("bodyb",): f *= 0.8 if y % 3 == 0 else 1.0
                px[x0 + x, y0 + y] = tuple(max(0, min(255, int(v * f))) for v in col) + (255,)
        uv[name] = {k: {"uv": [x0, y0], "uv_size": [16, 16]} for k in ("north", "south", "east", "west", "up", "down")}
    return uv
def tile2(top, bot):   # cubo com costas/lados de um ladrilho e barriga de outro
    d = copy.deepcopy(top); d["down"] = copy.deepcopy(bot["down"]); return d

def cube(o, s, uv, rot=None, piv=None):
    c = {"origin": [round(v, 3) for v in o], "size": [round(v, 3) for v in s], "uv": uv}
    if rot: c["rotation"] = rot; c["pivot"] = [round(v, 3) for v in (piv or o)]
    return c
def beads(pts, r0, r1, uv):   # "contas" encadeadas ao longo de uma curva: chifres, bigodes, juba, halo
    out = []
    for i, p in enumerate(pts):
        t = i / max(1, len(pts) - 1); r = r0 + (r1 - r0) * t
        out.append(cube([p[0] - r / 2, p[1] - r / 2, p[2] - r / 2], [r, r, r], uv))
    return out
def curve(p0, dirs, step):   # polilinha: lista de direções (dx,dy,dz) aplicadas em sequência
    pts = [np.array(p0, float)]
    for d in dirs:
        d = np.array(d, float); d /= np.linalg.norm(d); pts.append(pts[-1] + d * step)
    return pts
def arc(p0, n, step, d0, turn):   # curva suave: direção inicial d0 girando "turn" graus por passo no plano (y,z) e (x)
    pts = [np.array(p0, float)]; d = np.array(d0, float); d /= np.linalg.norm(d)
    for _ in range(n):
        pts.append(pts[-1] + d * step)
        a = math.radians(turn[0]); y, z = d[1], d[2]; d[1], d[2] = y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a)
        d[0] += turn[1]; d /= np.linalg.norm(d)
    return pts
def diamond_spike(at, s, uv, lean=0):   # espinho triangular: prisma girado 45° com metade enterrada no corpo
    x, y, z = at; return cube([x - s * 0.18, y - s / 2, z - s / 2], [s * 0.36, s, s], uv, [45 + lean, 0, 0], [x, y, z])

def build(lin):
    D = json.load(open(os.path.join(SRC, f"etheria_pdrg_{lin}.geo.json"))); G = D["minecraft:geometry"][0]; B = {b["name"]: b for b in G["bones"]}
    P = PAL[lin]
    src = Image.open(os.path.join(RP, f"textures/entity/etheria_{lin}.png")).convert("RGBA")
    img = paint_body(src, G, P); U = tiles(img, P["T"])
    G["description"]["texture_height"] = TH; G["description"]["visible_bounds_width"] = 24; G["description"]["visible_bounds_height"] = 16
    # asas com corpo: membrana dupla
    for b in G["bones"]:
        if "wing" in b["name"]:
            extra = []
            for c in b.get("cubes", []):
                if 0 in c["size"] and max(c["size"]) > 20:
                    k = c["size"].index(0); c2 = copy.deepcopy(c); c2["origin"][k] += 1.3; extra.append(c2)
            b["cubes"] += extra
    hd = B["d_head"]; skull = max(hd["cubes"], key=lambda c: c["size"][0] * c["size"][1] * max(c["size"][2], 0.5))
    Pk = corners(skull); smn, smx = Pk.min(0), Pk.max(0); top, back, front = smx[1], smx[2], smn[2]
    # olhos
    for s in (1, -1): hd["cubes"].append(cube([s * smx[0] - (0.3 if s > 0 else 0.9), top - 5.5, front + 3], [1.2, 2.2, 4], U["eye"]))
    dorsal = [("d_neck3", 6), ("d_neck2", 7), ("d_neck1", 8), ("d_upper_body", 9), ("d_body", 8), ("d_tail1", 6.5), ("d_tail2", 5), ("d_tail3", 4), ("d_tail4", 3)]
    if lin == "veldanava":
        for s in (1, -1):   # chifres grandes curvos (sobem, vão para trás e curvam para baixo/fora)
            hd["cubes"] += beads(arc([s * 6.5, top - 1, back - 5], 16, 2.6, [s * 0.35, 1.0, 0.5], (-14, s * 0.05)), 5.2, 1.4, U["horn"])
            hd["cubes"] += beads(arc([s * 4, smn[1] + 1, front + 4], 5, 2.0, [s * 0.15, -1.0, -0.35], (8, 0)), 2.6, 1.0, U["tusk"])   # presas/barba
        cy, cz = top + 16, back - 4   # halo (sempre — marca do Veldanava)
        hd["cubes"] += beads([(math.cos(a) * 13, cy + math.sin(a) * 2.5, cz + math.sin(a) * 13 * 0.35) for a in np.linspace(0, 2 * math.pi, 30, endpoint=False)], 2.2, 2.2, U["halo"])
        ub = B["d_upper_body"]; mn, mx = bbox(ub)   # armadura escura com frisos ciano no peito e nas pernas
        ub["cubes"] += [cube([-12, mn[1] + 4, mn[2] - 1.2], [24, 20, 2], U["armor"]), cube([-8, mn[1] + 10, mn[2] - 1.8], [16, 1.2, 1], U["glow"]),
                        cube([-0.6, mn[1] + 4, mn[2] - 1.8], [1.2, 20, 1], U["glow"]), cube([-11, mn[1] + 18, mn[2] - 1.8], [22, 1.2, 1], U["glow"])]
        for lg in ("d_left_leg", "d_right_leg"):
            b = B[lg]; mn, mx = bbox(b); x = (mn[0] + mx[0]) / 2
            b["cubes"] += [cube([x - 6, mn[1] + 8, mn[2] - 1.0], [12, 16, 1.6], U["armor"]), cube([x - 3, mn[1] + 15, mn[2] - 1.5], [6, 1.2, 0.8], U["glow"])]
        for name, h in dorsal:
            b = B[name]; mn, mx = bbox(b)
            for i in range(2):
                z = mn[2] + (mx[2] - mn[2]) * (i + 0.5) / 2; b["cubes"].append(diamond_spike([0, surface(b, z) - 0.6, z], h * 0.8, U["spike"], -10))
        for b in G["bones"]:   # veios ciano nas membranas
            if "wing" in b["name"]:
                for c in [c for c in b.get("cubes", []) if 0 in c["size"] and max(c["size"]) > 20][:1]:
                    k = c["size"].index(0); W = c["size"][0]
                    for f in (0.3, 0.62):
                        v = copy.deepcopy(c); v["uv"] = U["glow"]; v["origin"][0] += W * f; v["size"] = [1.0, c["size"][1] * 0.9, 0.6]; v["origin"][k] -= 0.3; b["cubes"].append(v)
    elif lin == "velgrynd":
        # corpo de serpente: cauda bem mais grossa e longa (continua depois da ponta original)
        prev = None
        for i, name in enumerate(["d_tail1", "d_tail2", "d_tail3", "d_tail4", "d_tail5"]):
            b = B[name]; mn, mx = bbox(b); w = 17 - i * 2.4; yc = (mn[1] + mx[1]) / 2 + 2
            b["cubes"].append(cube([-w / 2, yc - w / 2, mn[2] - 1], [w, w, mx[2] - mn[2] + 2], tile2(U["body"], U["bodyb"])))
            b["cubes"] += [cube([-w / 2 - 0.4, yc - w * 0.2, mn[2]], [0.6, 1.2, mx[2] - mn[2]], U["gold"]), cube([w / 2 - 0.2, yc - w * 0.2, mn[2]], [0.6, 1.2, mx[2] - mn[2]], U["gold"])]
            for s in (1, -1):   # lâminas claras saindo do corpo
                zc = (mn[2] + mx[2]) / 2; b["cubes"].append(cube([s * w / 2 - 0.5, yc + w * 0.2, zc - 1], [1.0, 2.2, 9 - i], U["blade"], [-28, s * 35, 0], [s * w / 2, yc + w * 0.2, zc]))
            if name == "d_tail5":
                z0 = mx[2]
                for k in range(6):   # prolongamento da serpente, afinando
                    w2 = max(2.5, w - 1.4 * (k + 1)); b["cubes"].append(cube([-w2 / 2, yc - w2 / 2, z0 + k * 14], [w2, w2, 15], tile2(U["body"], U["bodyb"])))
                    if k % 2 == 0:
                        for s in (1, -1): b["cubes"].append(cube([s * w2 / 2 - 0.5, yc + w2 * 0.2, z0 + k * 14 + 6], [1.0, 2.0, 7], U["blade"], [-28, s * 35, 0], [s * w2 / 2, yc + w2 * 0.2, z0 + k * 14 + 7]))
        for name, h in dorsal[:5]:
            b = B[name]; mn, mx = bbox(b)
            for i in range(2):
                z = mn[2] + (mx[2] - mn[2]) * (i + 0.5) / 2; y = surface(b, z) - 0.6
                b["cubes"].append(cube([-0.5, y - 0.5, z - 1], [1.0, h * 1.3, 2.2], U["blade"], [-35, 0, 0], [0, y, z]))
        for s in (1, -1):   # bigodes longos azuis (do focinho para trás) + crista angulosa
            hd["cubes"] += beads(arc([s * 5, smn[1] + 6, front - 6], 22, 2.4, [s * 0.5, 0.35, 1.0], (-3, s * 0.06)), 1.3, 0.7, U["whisker"])
            hd["cubes"] += [cube([s * 6 - 1, top - 2, back - 10], [2, 8, 10], U["crest"], [-35, s * 12, s * 15], [s * 6, top - 2, back - 8]),
                            cube([s * 7.5 - 0.8, top - 4, back - 4], [1.6, 6, 12], U["blade"], [-25, s * 25, 0], [s * 7.5, top - 4, back - 2])]
    else:   # velzard
        for name, h in dorsal:
            b = B[name]; mn, mx = bbox(b); n = 3 if name in ("d_upper_body", "d_body") else 2
            for i in range(n):
                z = mn[2] + (mx[2] - mn[2]) * (i + 0.5) / n; b["cubes"].append(diamond_spike([0, surface(b, z) - 0.4, z], h * 1.15, U["spike"], -12))
        ub = B["d_upper_body"]; mn, mx = bbox(ub)
        for s in (1, -1):   # espinhos dos ombros
            ub["cubes"] += [diamond_spike([s * 16, mx[1] - 4, mn[2] + 10], 9, U["spike"], -5), diamond_spike([s * 18, mx[1] - 9, mn[2] + 18], 7, U["spike"], 0)]
        for i, (x, z, h, rx, rz) in enumerate([(-12, 6, 13, -20, 25), (12, 6, 13, -20, -25), (-9, 22, 10, 15, 15), (9, 22, 10, 15, -15), (-19, 14, 8, 0, 40), (19, 14, 8, 0, -40), (-4, 28, 7, 25, 10), (4, 28, 7, 25, -10)]):
            ub["cubes"].append(cube([x - 1.8, mx[1] - 3, z - 1.8], [3.6, h, 3.6], U["crystal" if i % 2 else "crystal2"], [rx, 30 * (i % 3), rz], [x, mx[1] - 3, z]))
        for name in ("d_tail2", "d_tail3"):
            b = B[name]; mn, mx = bbox(b)
            for s in (1, -1): b["cubes"].append(cube([s * 4 - 1.2, mx[1] - 2, (mn[2] + mx[2]) / 2 - 1.2], [2.4, 7, 2.4], U["crystal"], [-15, 20, s * 35], [s * 4, mx[1] - 2, (mn[2] + mx[2]) / 2]))
        hd["cubes"] += [cube([-1, top - 2, front + 2], [2, 13, 18], U["crest"], [-28, 0, 0], [0, top - 2, front + 10])]   # crista laranja
        for s in (1, -1): hd["cubes"] += beads(arc([s * 5.5, top - 1, back - 6], 9, 2.4, [s * 0.25, 0.9, 0.7], (-12, 0)), 3.2, 1.2, U["horn"])
        for k, x in enumerate((-4, -1.5, 1.5, 4)):   # juba azul: do topo da cabeça descendo pelo pescoço
            pts = [np.array([x, top + 1, back - 2 + k], float)]
            for name in ("d_neck3", "d_neck2", "d_neck1"):
                b = B[name]; mn, mx = bbox(b)
                for t in (0.25, 0.75):
                    z = mn[2] + (mx[2] - mn[2]) * t; pts.append(np.array([x * 1.3, surface(b, z) + 1.5 + (k % 2), z + 2], float))
            dense = []
            for a, b2 in zip(pts, pts[1:]):
                for t in np.linspace(0, 1, 4, endpoint=False): dense.append(a + (b2 - a) * t)
            hd["cubes"] += beads(dense, 3.0, 1.6, U["mane"])
    # Dragão Verdadeiro: coroa + anel de energia (osso x_true, escala 0 nas outras formas)
    T = P["T"]; gk = "glow" if "glow" in U else "halo"
    ring = beads([(math.cos(a) * 18, top + 24 + math.sin(a) * 18, back + 6) for a in np.linspace(0, 2 * math.pi, 36, endpoint=False)], 1.8, 1.8, U[gk])
    crown = []
    for i, x in enumerate((-6, -3, 0, 3, 6)):
        crown += beads(curve([x, top + 1, back - 8 + abs(x)], [[x * 0.08, 1, 0.25]] * (4 if x else 6), 2.2), 2.4, 1.0, U["spike" if "spike" in U else "horn"])
    G["bones"].append({"name": "x_true", "parent": "d_head", "pivot": [0, top + 24, back + 6], "cubes": crown})
    G["bones"].append({"name": "x_true_halo", "parent": "x_true", "pivot": [0, top + 24, back + 6], "cubes": ring})
    img.save(os.path.join(RP, f"textures/entity/etheria_pdrg_{lin}.png"))
    json.dump(D, open(os.path.join(RP, f"models/entity/etheria_pdrg_{lin}.geo.json"), "w"), indent=1)
    return sum(len(b.get("cubes", [])) for b in G["bones"])

def wire():
    ap = os.path.join(RP, "animations/etheria_pdrg_forms.animation.json")
    json.dump({"format_version": "1.8.0", "animations": {"animation.etheria_pdrg.true_extras": {"loop": True, "bones": {
        "x_true": {"scale": ["query.property('etheria:lform') == 'true' ? 1 : 0"] * 3},
        "x_true_halo": {"rotation": [0, 0, "query.life_time * 25"]}}}}}, open(ap, "w"), indent=1)
    ep = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(ep)); Dd = E["minecraft:client_entity"]["description"]
    for l in PAL: Dd["textures"][f"drg_{l}"] = f"textures/entity/etheria_pdrg_{l}"
    Dd["animations"]["drg_true_extras"] = "animation.etheria_pdrg.true_extras"
    am = Dd["scripts"]["animate"]
    if not any(isinstance(x, dict) and "drg_true_extras" in x for x in am): am.append({"drg_true_extras": "variable.etheria_dragon"})
    json.dump(E, open(ep, "w"), indent=1)

if __name__ == "__main__":
    for l in PAL: print(l, "cubos:", build(l))
    wire(); print("ok")

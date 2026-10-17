"""6.94 - Segunda evolução dracônica (corpo etheria_race_dragonewt_w e _lord): DOIS PARES de asas grandes de morcego/dragão
como na referência (lilás no bordo, violeta perto do corpo, dedos ósseos escuros, garra no polegar e ganchos nas pontas).
Cada asa: raiz -> braço -> antebraço -> 4 dedos; membranas pintadas em polígonos exatos (triângulos entre dedos com borda
de fuga recortada + painel do último dedo até a cintura). Texturas passam de 256 para 512 (o conteúdo antigo fica no canto,
UVs antigas continuam valendo); as membranas vão na área nova. Animação: respiração parada, bater de asas com o par de
baixo defasado, planeio aberto, asas fechadas agachado; dedos abrem/fecham e a membrana ondula.
Rodar: python3 tools/drake_wings.py"""
import json, os, copy, math, random, shutil
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "race_geo_src"); os.makedirs(SD, exist_ok=True)
PX = 4
VARS = {"dragonewt_w": dict(base=(206, 176, 232), deep=(92, 62, 176), vein=(70, 44, 120), bone=(58, 40, 92), claw=(28, 20, 40), edge=(48, 30, 84)),
        "dragonewt_w_lord": dict(base=(196, 150, 230), deep=(70, 30, 140), vein=(46, 14, 80), bone=(34, 20, 60), claw=(214, 176, 70), edge=(30, 12, 50))}

def rotp(p, a, c=(0, 0)):
    a = math.radians(a); x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(a) - y * math.sin(a), c[1] + x * math.sin(a) + y * math.cos(a))
def curve(p, q, toward, bow=0.3, n=12):
    m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2); c = (m[0] + (toward[0] - m[0]) * bow, m[1] + (toward[1] - m[1]) * bow)
    return [((1 - t) ** 2 * p[0] + 2 * (1 - t) * t * c[0] + t * t * q[0], (1 - t) ** 2 * p[1] + 2 * (1 - t) * t * c[1] + t * t * q[1]) for t in [i / n for i in range(n + 1)]]

# asa esquerda (x+), em unidades do modelo do jogador; o par de baixo é menor e aponta para baixo
PAIRS = {
    "U": dict(R=(1.6, 23.2), E=(10.5, 30.5), W=(21.5, 28.0), fingers=[(38, 22), (8, 27), (-26, 25), (-60, 21)], body=(1.8, 13.5), th=1.25, z=2.7),
    "D": dict(R=(1.4, 19.6), E=(8.0, 17.6), W=(15.0, 12.4), fingers=[(-8, 17), (-36, 19), (-64, 17), (-92, 14)], body=(1.4, 9.5), th=1.0, z=2.9),
}

class Tex:
    def __init__(self, img): self.img = img; self.x, self.y, self.h = 0, 258, 0
    def alloc(self, w, h):
        if self.x + w > 510: self.x, self.y, self.h = 0, self.y + self.h + 1, 0
        assert self.y + h <= 511, "textura cheia"
        x, y = self.x, self.y; self.x += w + 1; self.h = max(self.h, h); return x, y

def paint(T, pal, poly, wrist, rng):
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]; xmin, xmax, ymin, ymax = min(xs), max(xs), min(ys), max(ys)
    W, H = xmax - xmin, ymax - ymin; w, h = max(2, math.ceil(W * PX)), max(2, math.ceil(H * PX)); u, v = T.alloc(w, h)
    toP = lambda p: ((p[0] - xmin) * PX, (ymax - p[1]) * PX)
    mask = Image.new("L", (w, h), 0); ImageDraw.Draw(mask).polygon([toP(p) for p in poly], fill=255)
    lv = [mask]
    for _ in range(5): lv.append(lv[-1].filter(ImageFilter.MinFilter(3)))
    L = [l.load() for l in lv]; mk = mask.load()
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0)); px = img.load()
    wf = toP(wrist); diag = math.hypot(w, h) or 1
    for y in range(h):
        for x in range(w):
            if not mk[x, y]: continue
            d = sum(1 for l in L[1:] if l[x, y])
            t = min(1, math.hypot(x - wf[0], y - wf[1]) / diag * 1.25)            # perto do pulso: violeta escuro; longe: lilás claro
            col = [pal["deep"][i] + (pal["base"][i] - pal["deep"][i]) * t for i in range(3)]
            k = 1.0
            if d == 0: col = list(pal["edge"])
            elif d == 1: k = 0.78
            elif d in (2, 3): k = 1.1
            k *= 1 + 0.05 * math.sin((x * 0.9 + y * 0.35) * 0.55)                  # estrias finas da pele (como as linhas da arte)
            px[x, y] = tuple(max(0, min(255, int(c * k))) for c in col) + (255,)
    dr = ImageDraw.Draw(img)
    for _ in range(5):                                                        # veias saindo do pulso
        a = rng.uniform(0, 2 * math.pi); ln = diag * rng.uniform(0.35, 0.8)
        p1 = (wf[0] + math.cos(a) * ln, wf[1] + math.sin(a) * ln); m = ((wf[0] + p1[0]) / 2 + rng.uniform(-3, 3), (wf[1] + p1[1]) / 2 + rng.uniform(-3, 3))
        dr.line([wf, m, p1], fill=pal["vein"] + (200,), width=1)
    img.putalpha(Image.composite(img.split()[3], Image.new("L", (w, h), 0), mask))
    T.img.paste(img, (u, v), img)
    return u, v, w, h, xmin, ymin, W, H

def flat(reg, z, mirror):
    u, v, w, h, xmin, ymin, W, H = reg; out = []
    for dz in (-0.12, 0.12):
        nf = {"uv": [u + w, v], "uv_size": [-w, h]} if mirror else {"uv": [u, v], "uv_size": [w, h]}
        sf = {"uv": [u, v], "uv_size": [w, h]} if mirror else {"uv": [u + w, v], "uv_size": [-w, h]}
        x0 = -xmin - W if mirror else xmin
        out.append({"origin": [round(x0, 4), round(ymin, 4), round(z + dz, 4)], "size": [round(W, 4), round(H, 4), 0], "uv": {"north": nf, "south": sf}})
    return out

def solid(T, col):
    u, v = T.alloc(2, 2); ImageDraw.Draw(T.img).rectangle([u, v, u + 1, v + 1], fill=col + (255,))
    return {f: {"uv": [u, v], "uv_size": [1, 1]} for f in ("north", "south", "east", "west", "up", "down")}

def stick(p0, p1, th, z, uv, mirror, taper=1.0):
    """osso fino de p0 a p1 no plano da asa (gira só em z)"""
    sg = -1 if mirror else 1
    a = math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0])); L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    out = []
    for k, (f0, f1, t) in enumerate(((0, 0.55, th), (0.5, 1.0, th * 0.62 * taper))):
        x0 = sg * p0[0]; ln = L * (f1 - f0)
        o = [x0 + (L * f0 if sg > 0 else -L * f1), p0[1] - t / 2, z - t / 2]
        out.append({"origin": [round(c, 4) for c in o], "size": [round(ln, 4), round(t, 4), round(t, 4)], "pivot": [round(x0, 4), round(p0[1], 4), round(z, 4)],
                    "rotation": [0, 0, round(sg * a, 3)], "uv": copy.deepcopy(uv)})
    return out

def hook(p, ang, size, z, uv, mirror):
    sg = -1 if mirror else 1; x = sg * p[0]
    return [{"origin": [round(x - size * 0.3, 4), round(p[1] - size, 4), round(z - size * 0.3, 4)], "size": [round(size * 0.6, 4), round(size, 4), round(size * 0.6, 4)],
             "pivot": [round(x, 4), round(p[1], 4), round(z, 4)], "rotation": [0, 0, round(sg * ang, 2)], "uv": copy.deepcopy(uv)}]

def build(var):
    pal = VARS[var]; rng = random.Random(11)
    gp = os.path.join(RP, f"models/entity/etheria_race_{var}.geo.json"); tp = os.path.join(RP, f"textures/entity/etheria_race_{var}.png")
    for a, b in ((gp, f"{var}.geo.json"), (tp, f"{var}.png")):
        if not os.path.exists(os.path.join(SD, b)): shutil.copy(a, os.path.join(SD, b))
    D = json.load(open(os.path.join(SD, f"{var}.geo.json"))); G = D["minecraft:geometry"][0]
    old = Image.open(os.path.join(SD, f"{var}.png")).convert("RGBA")
    img = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); img.paste(old, (0, 0)); T = Tex(img)
    G["description"]["texture_width"] = 512; G["description"]["texture_height"] = 512
    G["description"]["visible_bounds_width"] = 10; G["description"]["visible_bounds_height"] = 5
    G["bones"] = [b for b in G["bones"] if not b["name"].startswith("wing")]
    BONE, CLAW = solid(T, pal["bone"]), solid(T, pal["claw"])
    regs = {}
    for P, c in PAIRS.items():
        R, E, Wr, z = c["R"], c["E"], c["W"], c["z"]
        tips = [(Wr[0] + ln * math.cos(math.radians(a)), Wr[1] + ln * math.sin(math.radians(a))) for a, ln in c["fingers"]]
        polys = {}
        for i in range(3):                                           # entre dedos
            A, B = tips[i], tips[i + 1]
            polys[f"m{i}"] = [Wr, A] + curve(A, B, Wr, 0.32)[1:-1] + [B]
        T3 = tips[3]; Bd = c["body"]
        polys["m3"] = [R, E, Wr, T3] + curve(T3, Bd, Wr, 0.26)[1:]      # último dedo -> cintura, passando pelo braço
        polys["mA"] = [R, (E[0] - 0.6, E[1] + 0.9), (Wr[0] - 1.2, Wr[1] + 0.8), Wr, E]   # bordo de ataque (pequeno, à frente do braço)
        for k, poly in polys.items(): regs[(P, k)] = paint(T, pal, poly, Wr, rng)
        for sd, mirror in (("l", False), ("r", True)):
            sg = -1 if mirror else 1
            X = lambda p: [round(sg * p[0], 4), round(p[1], 4), z]
            bones = []
            bones.append({"name": f"dw{P}_root_{sd}", "parent": "body", "pivot": X(R), "cubes": hook((R[0] + 0.4, R[1] + 0.6), 0, 1.6, z, BONE, mirror)})
            bones.append({"name": f"dw{P}_arm_{sd}", "parent": f"dw{P}_root_{sd}", "pivot": X(R),
                          "cubes": stick(R, E, c["th"] * 1.25, z, BONE, mirror) + flat(regs[(P, "mA")], z, mirror) + flat(regs[(P, "m3")], z, mirror)
                          + hook(E, 25, 1.5, z, CLAW, mirror)})
            bones.append({"name": f"dw{P}_fore_{sd}", "parent": f"dw{P}_arm_{sd}", "pivot": X(E),
                          "cubes": stick(E, Wr, c["th"], z, BONE, mirror) + hook((Wr[0] - 0.3, Wr[1] + 0.6), 20, 2.2 if P == "U" else 1.7, z, CLAW, mirror)})   # garra do polegar
            for i, (a, ln) in enumerate(c["fingers"]):
                cubes = stick(Wr, tips[i], c["th"] * 0.75, z, BONE, mirror, taper=0.8) + hook(tips[i], a + 110, 1.1, z, CLAW, mirror)
                bones.append({"name": f"dw{P}_f{i}_{sd}", "parent": f"dw{P}_fore_{sd}", "pivot": X(Wr), "cubes": cubes})
                if i < 3: bones.append({"name": f"dw{P}_m{i}_{sd}", "parent": f"dw{P}_f{i}_{sd}", "pivot": X(Wr), "cubes": flat(regs[(P, f"m{i}")], z, mirror)})
            G["bones"] += bones
    G["description"]["identifier"] = f"geometry.etheria_race_{var}"
    json.dump(D, open(gp, "w"), indent=1); img.save(tp)

# ---------- animação ----------
def anim_bones():
    t = "query.anim_time"
    g, fall = "query.is_on_ground", "(!query.is_on_ground && query.vertical_speed < -1.0)"
    fly = "(!query.is_on_ground && query.vertical_speed >= -1.0)"; sn = "(query.is_sneaking && query.is_on_ground)"
    mv = "math.min(1, query.modified_move_speed * 3)"
    B = {}
    for P, k, ph in (("U", 1.0, 0), ("D", 0.72, 70)):            # par de baixo defasado (bate depois) e menor amplitude
        for sd, sg in (("l", 1), ("r", -1)):
            flap = f"math.sin({t} * 540 - {ph})"
            br = f"math.sin({t} * 80 - {ph})"
            # raiz: sobe/desce (z) e varre para frente/trás (y)
            rz = (f"{sg} * ({g} * (6 * {br} + 4 * {mv} * math.sin({t} * 300 - {ph}) - 34 * {sn} * {k}) + {fly} * (38 * {k} * {flap} - 6) + {fall} * (-14 + 3 * {br}))")
            ry = (f"{-sg} * ({g} * (36 + 20 * {sn}) + {fly} * (16 * {k} * math.sin({t} * 540 - {ph + 70})) + {fall} * 4)")
            rx = f"{g} * (2 * {br}) + {fly} * (6 * math.sin({t} * 540 - {ph + 40}))"
            B[f"dw{P}_root_{sd}"] = {"rotation": [rx, ry, rz]}
            # cotovelo e pulso dobram atrasados (onda na asa) e fecham quando agachado
            B[f"dw{P}_arm_{sd}"] = {"rotation": [0, 0, f"{sg} * ({fly} * 14 * {k} * math.sin({t} * 540 - {ph + 50}) + {g} * (3 * {br} - 20 * {sn}))"]}
            B[f"dw{P}_fore_{sd}"] = {"rotation": [0, f"{-sg} * ({fly} * 10 * math.sin({t} * 540 - {ph + 95}) + {sn} * 35)",
                                                  f"{sg} * ({fly} * 18 * {k} * math.sin({t} * 540 - {ph + 90}) + {g} * (-4 * {br} - 30 * {sn}) + {fall} * 4)"]}
            for i in range(4):
                close = f"({g} * (2.5 + 2 * {br}) + {sn} * 7 + {fly} * (1.5 + 2.5 * math.sin({t} * 540 - {ph + 120})))"
                B[f"dw{P}_f{i}_{sd}"] = {"rotation": [0, 0, f"{sg} * {3 - i} * {close} * -1"]}
                if i < 3:   # membrana pega vento: ondula
                    amp = f"({g} * 1.5 + {fly} * 5 + {fall} * 3)"
                    B[f"dw{P}_m{i}_{sd}"] = {"rotation": [f"math.sin({t} * (query.is_on_ground ? 160 : 620) - {ph + 60 + i * 35}) * {amp}", 0, 0]}
    return B

def main():
    for v in VARS: build(v)
    ap = os.path.join(RP, "animations/etheria_race_parts.animation.json"); A = json.load(open(ap))
    for v in VARS:
        an = A["animations"][f"animation.etheria.race_{v}"]
        an["bones"] = {k: x for k, x in an["bones"].items() if not k.startswith("wing")}
        an["bones"].update(anim_bones()); an["loop"] = True; an["animation_length"] = 3600
        an["bones"] = json.loads(json.dumps(an["bones"]).replace("query.life_time", "query.anim_time"))
    json.dump(A, open(ap, "w"), indent=1)
    print("asas duplas ok")

if __name__ == "__main__":
    main()

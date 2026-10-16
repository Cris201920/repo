# 6.47 - RAÇAS REMODELADAS (peças por cima do jogador): asas de membrana articuladas (demônio, vampiro, dracônico),
# chifres de kijin (ogro) e asas de fada translúcidas (elfo). Mesma técnica das asas de penas (tools/angels.py):
# ossos articulados + placas finas com textura recortada (alfa) desenhada aqui. Mantém tudo o que não é substituído (cauda, espinho, auréola).
# As animações de raça (animation.etheria.race_<raça>) ganham as partes novas: respiração parado, abertura ao andar, batida no ar.
import json, os, sys, math
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import angels as A
from race_wings import wing_anim, tail_anim
RP = A.RP
hx = A.hexc

def p_membrane(c0, c1, vein, scallop=3, depth=0.22, wedge=False):
    """membrana 16x64 (u = ao longo do dedo, v = afastando do dedo): degradê, veias finas paralelas ao dedo, rugas diagonais,
    borda livre recortada em arcos (alfa) e leve translucidez"""
    def f(img, x, y, w, h):
        px = img.load()
        for j in range(h):
            for i in range(w):
                u, v = i / (w - 1), j / (h - 1)
                if wedge:                                                             # cunha: u = ao longo do dedo, v = em direção ao próximo dedo
                    if v > 0.06 + 1.02 * u or u > 1 - depth * math.sin(math.pi * v): px[x + i, y + j] = (0, 0, 0, 0); continue
                    arc = 1.0
                else:
                    arc = 1 - depth * (1 - abs(math.sin((v * scallop) * math.pi)))   # recorte na borda (lado oposto ao osso)
                    if u > arc: px[x + i, y + j] = (0, 0, 0, 0); continue
                c = A.mix(c0, c1, u / arc)
                if j % 7 == 0: c = A.mix(c, vein, 0.45)                               # veias paralelas ao dedo
                if (i * 3 + j) % 13 == 0: c = A.shade(c, 0.85)                        # rugas
                if u > arc - 0.08: c = A.shade(c, 0.65)                               # borda escura
                if u < 0.06: c = A.shade(c, 1.2)                                      # junto ao osso
                px[x + i, y + j] = c[:3] + (225,)
        px[x + w - 1, y] = (0, 0, 0, 0); px[x, y + h - 1] = (0, 0, 0, 0)                 # pixels transparentes para as laterais finas
    return f
def p_fairy(c0, c1, vein):
    """asa de fada 16x64: oval translúcida com nervuras"""
    def f(img, x, y, w, h):
        px = img.load(); cx = (w - 1) / 2
        for j in range(h):
            t = j / (h - 1); half = (w / 2) * math.sin(math.pi * min(1, max(0.0, t)) ** 0.8)
            for i in range(w):
                dx = abs(i - cx)
                if dx > half: px[x + i, y + j] = (0, 0, 0, 0); continue
                c = A.mix(c0, c1, t)
                if dx < 0.6 or abs(dx - half * 0.55) < 0.45 or (j % 9 == 0 and dx < half - 1): c = A.mix(c, vein, 0.6)
                if dx > half - 1: c = A.shade(vein, 1.0)
                px[x + i, y + j] = c[:3] + (150,)
    return f

class Tiles:
    def __init__(s, at): s.at = at
    def big(s, name, painter, w=32, h=32):
        if name not in s.at.slots:
            x, y = s.at.free_f.pop(0); painter(s.at.img, x, y, 16, 64); s.at.slots[name] = (x, y, 16, 64)
        return s.at.slots[name]

def faces_mem(t, size, clear=None):
    """membrana: u ao longo do dedo (eixo X da placa). As laterais finas usam um pixel TRANSPARENTE da textura (sem linhas no contorno)."""
    x, y, w, h = t
    cx, cy = clear if clear else (x + w - 1, y)
    f = {"uv": [x, y], "uv_size": [w, h]}; edge = {"uv": [cx, cy], "uv_size": [1, 1]}
    return {"north": f, "south": {"uv": [x + w, y], "uv_size": [-w, h]}, "east": edge, "west": edge, "up": edge, "down": edge}

def membrane_wings(g, at, C, span=1.0, pre="wing"):
    bone_t = at.tile("mbone", A.p_metal(hx(C["bone"]))); claw_t = at.tile("claw", A.p_metal(hx(C["claw"])))
    scale_t = at.tile("scale", A.p_metal(hx(C.get("scale", C["bone"])), hx(C["bone"]), 2))
    mem = at.feather("membrane", p_membrane(hx(C["m0"]), hx(C["m1"]), hx(C["vein"]), C.get("scallop", 3), C.get("depth", 0.22)))
    wmem = at.feather("membrane_w", p_membrane(hx(C["m0"]), hx(C["m1"]), hx(C["vein"]), C.get("scallop", 3), C.get("depth", 0.22), wedge=True))
    knot = at.tile("knot", A.p_metal(A.shade(hx(C["bone"]), 1.5)))
    T, NF = 0.18, C.get("fingers", 4)
    for side, sg in (("l", 1), ("r", -1)):
        X = lambda v: v * sg
        def box(bone, x0, yy, z0, w, h, d, uv, rot=None, piv=None):
            g.cube(bone, [X(x0) if sg > 0 else X(x0 + w), yy, z0], [w, h, d], uv, rot=[rot[0], X(rot[1]), X(rot[2])] if rot else None, pivot=[X(piv[0]), piv[1], piv[2]] if piv else None)
        L1, L2 = 6.5 * span, 7.5 * span
        g.bone(f"{pre}_{side}", [X(1.5), 21.5, 2.3], "body", [-6, X(-32), X(34)])
        a = g.bone(f"{pre}A_{side}", [X(1.5), 21.5, 2.6], f"{pre}_{side}")["name"]
        box(a, 1.5, 20.6, 2.0, L1 * 0.55, 1.8, 1.6, A.faces_tile(bone_t, [L1 * 0.55, 1.8, 1.6]))                         # braço: grosso no ombro
        box(a, 1.5 + L1 * 0.5, 20.8, 2.15, L1 * 0.5, 1.4, 1.3, A.faces_tile(bone_t, [L1 * 0.5, 1.4, 1.3]))                # e afinando
        box(a, 1.5 + L1 - 0.9, 20.55, 1.95, 1.8, 1.9, 1.7, A.faces_tile(knot, [1.8, 1.9, 1.7]))                            # nó do cotovelo
        if C.get("spikes"):
            for k in range(3): box(a, 2.2 + k * 2, 22.1, 2.45, 0.7, 1.3 - k * 0.2, 0.7, A.faces_tile(claw_t, [0.7, 1.3, 0.7]), rot=[0, 0, -30], piv=[2.5 + k * 2, 22.1, 2.8])
        box(a, 1.5 + L1 - 1, 21.6, 2.2, 1, 1.6, 1, A.faces_tile(claw_t, [1, 1.6, 1]), rot=[0, 0, -25], piv=[1.5 + L1 - 0.5, 21.6, 2.6])   # espinho do cotovelo
        if C.get("scale"):
            for k in range(int(L1 // 1.4)): box(a, 1.8 + k * 1.4, 21.9, 2.1, 1.3, 0.6, 1.4, A.faces_tile(scale_t, [1.3, 0.6, 1.4]))
        box(a, 1.6, 21 - 6 * span, 2.55, L1 - 0.2, 6 * span, T, faces_mem(mem, [L1, 6, T]), rot=[0, 0, 90], piv=[1.6, 21, 2.55])   # membrana braço-corpo
        x1 = 1.5 + L1
        b = g.bone(f"{pre}B_{side}", [X(x1), 21.5, 2.6], a, [0, 0, X(-38)])["name"]
        box(b, x1, 20.85, 2.2, L2, 1.2, 1.1, A.faces_tile(bone_t, [L2, 1.2, 1.1]))
        box(b, x1 + L2 - 0.8, 20.65, 2.05, 1.6, 1.6, 1.4, A.faces_tile(knot, [1.6, 1.6, 1.4]))                                # nó do pulso
        if C.get("spikes"):
            for k in range(3): box(b, x1 + 1 + k * 2.2, 22.0, 2.45, 0.6, 1.1 - k * 0.2, 0.6, A.faces_tile(claw_t, [0.6, 1.1, 0.6]), rot=[0, 0, -30], piv=[x1 + 1.3 + k * 2.2, 22.0, 2.75])
        if C.get("scale"):
            for k in range(int(L2 // 1.4)): box(b, x1 + 0.3 + k * 1.4, 21.85, 2.2, 1.2, 0.55, 1.2, A.faces_tile(scale_t, [1.2, 0.55, 1.2]))
        x2 = x1 + L2
        c = g.bone(f"{pre}C_{side}", [X(x2), 21.5, 2.6], b, [0, 0, X(-10)])["name"]
        box(c, x2 - 0.2, 21.4, 2.15, 1.3, 2.6, 1.2, A.faces_tile(claw_t, [1.3, 2.6, 1.2]), rot=[0, 0, -35], piv=[x2, 21.5, 2.6])      # polegar com garra
        angs = [10 + k * (100 / max(1, NF - 1)) for k in range(NF)]                    # dedos abrindo para BAIXO em leque
        for k, ang in enumerate(angs):
            ln = (13 - k * 1.1) * span
            f = g.bone(f"{pre}F{k}_{side}", [X(x2), 21.5, 2.6], c, [0, 0, X(ang)])["name"]
            box(f, x2, 21.15, 2.3, ln, 0.75, 0.75, A.faces_tile(bone_t, [ln, 0.75, 0.75]))
            box(f, x2 + ln - 0.3, 21.0, 2.25, 1.1, 0.9, 0.9, A.faces_tile(claw_t, [1.1, 0.9, 0.9]), rot=[0, 0, 30], piv=[x2 + ln, 21.4, 2.6])   # garrinha na ponta
            step = 100 / max(1, NF - 1)
            gap = (ln * math.tan(math.radians(step)) + 0.6) if k < NF - 1 else ln * 0.5
            box(f, x2 + 0.15, 21.2 - gap, 2.45 + 0.012 * k, ln - 0.2, gap, T, faces_mem(wmem if k < NF - 1 else mem, [ln, gap, T], (wmem[0], wmem[1] + wmem[3] - 1) if k < NF - 1 else None))   # cunha até o próximo dedo
def fairy_wings(g, at, C):
    t = at.feather("fairy", p_fairy(hx(C["m0"]), hx(C["m1"]), hx(C["vein"])))
    for side, sg in (("l", 1), ("r", -1)):
        X = lambda v: v * sg
        g.bone(f"wing_{side}", [X(1.0), 21.5, 2.3], "body", [0, X(-28), 0])
        for k, (ln, wd, ang) in enumerate([(15, 6, -118), (11, 4.6, -62)]):        # par de cima (aberto para cima/fora) e de baixo
            g.cube(f"wing_{side}", [X(1.0) - wd / 2, 21.5 - ln, 2.5 + 0.03 * k], [wd, ln, 0.12], A.faces_feather(t, [wd, ln, 0.12]),
                   rot=[0, 0, X(ang)], pivot=[X(1.0), 21.5, 2.5])
def kijin_horns(g, at, C):
    t = at.tile("horn", A.p_metal(hx(C["horn"]), A.shade(hx(C["horn"]), 0.75), 1)); tip = at.tile("horntip", A.p_metal(hx(C["tip"])))
    for side, sg in (("l", 1), ("r", -1)):
        X = lambda v: v * sg
        for n in (f"horn_{side}", f"horn_{side}_tip"):
            b = g.idx.get(n)
            if b: b["cubes"] = []
        base = g.idx[f"horn_{side}"]; base["pivot"] = [X(2.3), 31.6, -2.6]; base["rotation"] = [-14, 0, X(18)]
        y = 31.4
        for k, (w, h) in enumerate([(2.2, 1.6), (1.9, 1.6), (1.6, 1.5)]):              # base larga com anéis (cada segmento um pouco menor)
            g.cube(base["name"], [X(2.3) - w / 2, y, -2.6 - w / 2], [w, h, w], A.faces_tile(t, [w, h, w])); y += h
        tb = g.idx[f"horn_{side}_tip"]; tb["parent"] = base["name"]; tb["pivot"] = [X(2.3), y, -2.6]; tb["rotation"] = [-24, 0, X(-6)]
        for k, (w, h) in enumerate([(1.3, 1.5), (1.0, 1.4), (0.7, 1.2), (0.4, 1.0)]):
            g.cube(tb["name"], [X(2.3) - w / 2, y, -2.6 - w / 2], [w, h, w], A.faces_tile(tip if k > 1 else t, [w, h, w])); y += h
RACES = {
  "demon":     dict(kind="membrane", m0="#7a1420", m1="#2a0508", vein="#b0303c", bone="#1c1416", claw="#d8c8a0", span=1.0, fingers=4, spikes=True),
  "vampire":   dict(kind="membrane", m0="#3a0c1c", m1="#100408", vein="#8a1430", bone="#100a0e", claw="#c8c0c8", span=0.82, scallop=5, depth=0.32, fingers=4),
  "dragonoid": dict(kind="membrane", m0="#e8782e", m1="#8a2010", vein="#ffc060", bone="#5a3418", claw="#efe2c0", scale="#b04a1e", span=1.3, fingers=5, spikes=True, depth=0.16),
  "dragonewt_w": dict(kind="membrane", m0="#4fb85a", m1="#1d5a2c", vein="#b8f07a", bone="#2a4a24", claw="#e8f0d0", scale="#2e7a3a", span=1.1, fingers=4, spikes=True, depth=0.18),   # 6.52: Dragonato Celeste
  "ogre":      dict(kind="horns", horn="#efe6d0", tip="#c8b48a"),
  "elf":       dict(kind="fairy", m0="#e8fff4", m1="#a8e8ff", vein="#ffffff"),
}
def main():
    ap = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(ap))
    for race, C in RACES.items():
        tp = os.path.join(RP, f"textures/entity/etheria_race_{race}.png"); gp = os.path.join(RP, f"models/entity/etheria_race_{race}.geo.json")
        src = os.path.join(os.path.dirname(__file__), "race_src", f"{race}.png"); os.makedirs(os.path.dirname(src), exist_ok=True)
        if not os.path.exists(src): Image.open(tp).convert("RGBA").save(src)
        img = Image.new("RGBA", (A.TW, A.TH), (0, 0, 0, 0)); img.paste(Image.open(src).convert("RGBA"), (0, 0)); at = A.Atlas(img)
        d = json.load(open(gp)); G = d["minecraft:geometry"][0]
        drop = (lambda n: n.startswith("wing")) if C["kind"] in ("membrane", "fairy") else (lambda n: False)
        keep = [b for b in G["bones"] if not drop(b["name"])]
        g = A.Geo(G["description"]["identifier"]); g.bones = keep; g.idx = {b["name"]: b for b in keep}
        for b in keep: b.setdefault("cubes", [])
        if C["kind"] == "membrane": membrane_wings(g, at, C, C["span"])
        elif C["kind"] == "fairy": fairy_wings(g, at, C)
        elif C["kind"] == "horns": kijin_horns(g, at, C)
        out = g.json(); out["minecraft:geometry"][0]["description"]["visible_bounds_width"] = 6
        img.save(tp); json.dump(out, open(gp, "w"), indent=1)
        key = f"animation.etheria.race_{race}"
        if C["kind"] == "membrane" and key in AN["animations"]:
            bones = {k: v for k, v in AN["animations"][key]["bones"].items() if not k.startswith("wing")}
            bones.update(wing_anim(["wing"]))
            tails = sorted([b["name"] for b in g.bones if b["name"].startswith("tail")], key=lambda n: int(n[4:]) if n[4:].isdigit() else 99)
            if tails: bones.update(tail_anim(tails))
            AN["animations"][key]["bones"] = bones
        print(race, C["kind"], sum(len(b.get("cubes", [])) for b in g.bones), "cubos")
    if "animation.etheria.race_dragonewt" in AN["animations"]:   # dragonato sem asas: só a cauda nova
        AN["animations"]["animation.etheria.race_dragonewt"]["bones"].update(tail_anim([f"tail{i}" for i in range(7)]))
    json.dump(AN, open(ap, "w"), indent=1)
if __name__ == "__main__": main()

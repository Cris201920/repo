# 6.48 - CORPOS DETALHADOS DAS RAÇAS SEM ASAS: bestial (orelhas de lobo + cauda peluda), homem-lagarto (crista, barbatanas, espinhos
# dorsais e cauda escamada com placas) e dragonato jovem (dragonoide sem asas: chifres, espinho e cauda; estágios 1-2 do dragonoide e
# lagarto 3). Mesma técnica de tools/race_parts.py: ossos articulados + texturas desenhadas aqui (atlas 256x256).
# Também reescreve as animações animation.etheria.race_<raça> (cauda abanando/balançando, orelhas mexendo, barbatanas abrindo ao correr).
import json, os, sys, math, random
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import angels as A
RP = A.RP
hx = A.hexc

def p_fur(base, tip=None):
    """pelagem 16x16: fios verticais com variação, ponta mais clara"""
    def f(img, x, y, w, h):
        px = img.load(); rnd = random.Random(sum(base[:3]) * 7)
        for i in range(w):
            k0 = rnd.uniform(0.85, 1.12); off = rnd.randint(0, 3)
            for j in range(h):
                k = k0 * (1.1 - 0.25 * ((j + off) % 6) / 6)
                if (i + j // 3) % 4 == 0: k *= 0.82
                c = A.shade(base, k)
                if tip and j < 3: c = A.mix(c, tip, 0.5)
                px[x + i, y + j] = c
    return f
def p_scale(base, dark, light):
    """escamas 16x16 em losango com brilho na borda superior"""
    def f(img, x, y, w, h):
        px = img.load()
        for j in range(h):
            for i in range(w):
                row = j // 3; u = (i + (2 if row % 2 else 0)) % 4; v = j % 3
                c = base
                if v == 0 and u in (1, 2): c = light
                elif u == 0 or v == 2: c = dark
                px[x + i, y + j] = A.shade(c, 1.06 - 0.12 * j / h)
    return f

class Box:
    def __init__(s, g): s.g = g
    def __call__(s, bone, o, size, t, rot=None, piv=None):
        s.g.cube(bone, o, size, A.faces_tile(t, size), rot=rot, pivot=piv)

def chain(g, box, pre, parent, top, segs, rots, tex):
    """cauda: ossos encadeados; cada segmento pende do pivô (eixo -Y em repouso) e a curva vem das rotações dos ossos.
    segs = [(comprimento, largura, textura|None)]"""
    x0, y, z = top; par = parent; names = []
    for k, ((ln, w, t), r) in enumerate(zip(segs, rots)):
        n = f"{pre}{k}"; g.bone(n, [x0, y, z], par, r); names.append(n)
        box(n, [x0 - w / 2, y - ln - 0.15, z - w / 2], [w, ln + 0.3, w], t or tex)
        par = n; y -= ln
    return names

def base_geo(gid, keep_from=None):
    g = A.Geo(gid)
    g.bone("root", [0, 0, 0]); g.bone("waist", [0, 12, 0], "root"); g.bone("body", [0, 24, 0], "waist"); g.bone("head", [0, 24, 0], "body")
    return g

# ------------------------------------------------------------------ bestial
def beastkin(at):
    fur = hx("#8a5a34"); g = base_geo("geometry.etheria_race_beastkin"); box = Box(g)
    tf = at.tile("fur", p_fur(fur)); tl = at.tile("furl", p_fur(A.shade(fur, 1.2))); tw = at.tile("furw", p_fur(hx("#f2ebe0")))
    tin = at.tile("ear_in", A.p_skin(hx("#e8a8a0"))); tdk = at.tile("furd", p_fur(A.shade(fur, 0.7)))
    for side, sg in (("l", 1), ("r", -1)):
        X = lambda v: v * sg
        e = g.bone(f"ear_{side}", [X(2.6), 32, -0.6], "head", [0, X(-8), X(-16)])["name"]
        yy = 31.8
        for w, h, d in [(2.8, 1.3, 1.4), (2.2, 1.2, 1.2), (1.5, 1.1, 1.0), (0.8, 1.0, 0.8)]:   # orelha triangular em degraus
            box(e, [X(2.6) - w / 2, yy, -0.6 - d / 2], [w, h, d], tf if w > 1 else tdk); yy += h
        yy = 32.0
        for w, h in [(1.8, 1.2), (1.2, 1.1), (0.6, 1.0)]:                                       # parte interna rosada (frente)
            box(e, [X(2.6) - w / 2, yy, -0.6 - 0.75], [w, h, 0.1], tin); yy += h
        box(e, [X(2.6) - 0.9, 32.6, -1.42], [1.8, 0.6, 0.1], tl)                                  # tufo de pelo claro na base
    segs = [(1.6, 1.8, None), (1.8, 2.6, None), (2.0, 3.1, None), (2.0, 3.3, None), (1.8, 3.0, None), (1.6, 2.5, tw), (1.2, 1.6, tw)]
    rots = [[62, 0, 0], [10, 0, 0], [10, 0, 0], [8, 0, 0], [6, 0, 0], [4, 0, 0], [2, 0, 0]]
    names = chain(g, box, "tail", "body", [0, 12.6, 2.0], segs, rots, tf)
    for k, n in enumerate(names[1:5], 1):                                                         # tufos laterais (volume da cauda)
        b = g.idx[n]; px, py, pz = b["pivot"]; ln, w, _ = segs[k]
        box(n, [px - w / 2 - 0.3, py - ln * 0.8, pz - w / 2 + 0.3], [w + 0.6, ln * 0.6, w - 0.6], tl)
    return g, names
def beastkin_anim(names):
    walk = "math.min(1, query.modified_move_speed * 3)"; sneak = "(query.is_sneaking ? 1 : 0)"
    out = {}
    for k, n in enumerate(names):
        out[n] = {"rotation": [f"math.sin(query.life_time * 110 - {k * 20}) * 3 + {sneak} * {8 if k == 0 else 3}",
                               f"math.sin(query.life_time * (140 + 260 * {walk}) - {k * 28}) * (7 + 9 * {walk})", 0]}
    for side, sg in (("l", 1), ("r", -1)):   # orelhas: mexidinha de vez em quando, deitam um pouco ao correr
        out[f"ear_{side}"] = {"rotation": [f"-10 * {walk}", 0,
                                           f"{sg} * (math.pow(math.max(0, math.sin(query.life_time * 45 + {sg})), 24) * -14 + 6 * {walk})"]}
    return out

# ------------------------------------------------------------------ homem-lagarto
def lizardman(at):
    g = base_geo("geometry.etheria_race_lizardman"); box = Box(g)
    ts = at.tile("scale", p_scale(hx("#3f7a3a"), hx("#244a22"), hx("#7ab85a")))
    tb = at.tile("belly", p_scale(hx("#b8c47a"), hx("#8a9a54"), hx("#dfe6a8")))
    tr = at.tile("ridge", A.p_metal(hx("#c86a2a"), hx("#7a3412"), 1)); tm = at.tile("fin", A.p_skin(hx("#e09040")))
    # crista na cabeça: placas finas crescendo para trás
    c = g.bone("crest", [0, 32, 0], "head")["name"]
    for k, (z, h) in enumerate([(-3.2, 0.8), (-1.8, 1.4), (-0.4, 2.0), (1.0, 2.5), (2.4, 2.4), (3.6, 1.8)]):
        box(c, [-0.2, 31.9, z], [0.4, h, 1.3], tr, rot=[-18, 0, 0], piv=[0, 32, z])
    # barbatanas laterais (atrás das bochechas), 3 raios com membrana
    for side, sg in (("l", 1), ("r", -1)):
        X = lambda v: v * sg
        fb = g.bone(f"frill_{side}", [X(4.0), 28.5, 1.6], "head", [0, X(28), 0])["name"]
        for k, (ang, ln) in enumerate([(-28, 3.4), (0, 4.0), (28, 3.2)]):
            box(fb, [X(4.0) - 0.15, 28.35, 1.6], [0.3, 0.3, ln], tr, rot=[ang, 0, 0], piv=[X(4.0), 28.5, 1.6])
            box(fb, [X(4.0) - 0.05, 28.5 - (0.0 if ang >= 0 else 1.6), 1.6], [0.1, 1.6, ln * 0.85], tm, rot=[ang * 0.5, 0, 0], piv=[X(4.0), 28.5, 1.6])
    # espinhos nas costas
    sp = g.bone("spine", [0, 24, 2], "body")["name"]
    for k, y in enumerate([22.6, 20.6, 18.6, 16.6, 14.6]):
        h = 1.6 - k * 0.15
        box(sp, [-0.2, y - 1.2, 2.0], [0.4, 1.2, h], tr, rot=[-30, 0, 0], piv=[0, y, 2.0])
    # cauda grossa e longa, afinando, com placas dorsais
    segs = [(2.4, 3.2, None), (2.4, 2.8, None), (2.4, 2.4, None), (2.4, 2.0, None), (2.2, 1.6, None), (2.0, 1.2, None), (1.8, 0.9, None), (1.4, 0.6, None)]
    rots = [[64, 0, 0], [6, 0, 0], [4, 0, 0], [2, 0, 0], [-2, 0, 0], [-4, 0, 0], [-4, 0, 0], [-4, 0, 0]]
    names = chain(g, box, "tail", "body", [0, 12.4, 1.8], segs, rots, ts)
    for k, n in enumerate(names):
        px, py, pz = g.idx[n]["pivot"]; ln, w, _ = segs[k]
        box(n, [px - w / 2 + 0.1, py - ln + 0.1, pz - w / 2 - 0.05], [w - 0.2, ln - 0.2, 0.2], tb)                 # ventre claro (frente)
        if k < 7: box(n, [px - 0.15, py - ln * 0.8, pz + w / 2 - 0.1], [0.3, ln * 0.6, 0.6 + 0.08 * (7 - k)], tr)  # placa dorsal
    return g, names
def lizard_anim(names):
    walk = "math.min(1, query.modified_move_speed * 3)"; sneak = "(query.is_sneaking ? 1 : 0)"
    out = {}
    for k, n in enumerate(names):
        out[n] = {"rotation": [f"math.sin(query.life_time * 70 - {k * 22}) * 2 + {sneak} * {6 if k == 0 else 0}",
                               f"math.sin(query.life_time * (60 + 120 * {walk}) - {k * 30}) * (4 + 6 * {walk})", 0]}
    for side, sg in (("l", 1), ("r", -1)):   # barbatanas abrem ao correr e "respiram" parado
        out[f"frill_{side}"] = {"rotation": [0, f"{sg} * (18 * {walk} + math.sin(query.life_time * 50) * 4)", 0]}
    out["crest"] = {"rotation": [f"math.sin(query.life_time * 40) * 2 - 6 * {walk}", 0, 0]}
    return out

# ------------------------------------------------------------------ dragonato jovem (dragonoide sem asas)
def dragonewt():
    src = json.load(open(os.path.join(RP, "models/entity/etheria_race_dragonoid.geo.json")))
    G = src["minecraft:geometry"][0]
    G["bones"] = [b for b in G["bones"] if not b["name"].startswith("wing")]
    G["description"]["identifier"] = "geometry.etheria_race_dragonewt"
    return src

def main():
    ap = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(ap)); anims = AN["animations"]
    for race, fn, an in (("beastkin", beastkin, beastkin_anim), ("lizardman", lizardman, lizard_anim)):
        img = Image.new("RGBA", (A.TW, A.TH), (0, 0, 0, 0)); at = A.Atlas(img)
        g, names = fn(at)
        out = g.json(); out["minecraft:geometry"][0]["description"]["visible_bounds_width"] = 6
        img.save(os.path.join(RP, f"textures/entity/etheria_race_{race}.png"))
        json.dump(out, open(os.path.join(RP, f"models/entity/etheria_race_{race}.geo.json"), "w"), indent=1)
        anims[f"animation.etheria.race_{race}"] = {"loop": True, "bones": an(names)}
        print(race, sum(len(b.get("cubes", [])) for b in g.bones), "cubos")
    dn = dragonewt()
    json.dump(dn, open(os.path.join(RP, "models/entity/etheria_race_dragonewt.geo.json"), "w"), indent=1)
    Image.open(os.path.join(RP, "textures/entity/etheria_race_dragonoid.png")).save(os.path.join(RP, "textures/entity/etheria_race_dragonewt.png"))
    anims["animation.etheria.race_dragonewt"] = {"loop": True, "bones": {k: v for k, v in anims["animation.etheria.race_dragonoid"]["bones"].items() if not k.startswith("wing")}}
    print("dragonewt", sum(len(b.get("cubes", [])) for b in dn["minecraft:geometry"][0]["bones"]), "cubos")
    # 6.52: Dragonato Celeste (lizard_4): o mesmo corpo do dragonato em verde-esmeralda; as asas de membrana são
    # acrescentadas por tools/race_parts.py (RACES["dragonewt_w"]), que parte da paleta salva em race_src/dragonewt_w.png
    import colorsys
    src = Image.open(os.path.join(os.path.dirname(__file__), "race_src", "dragonoid.png")).convert("RGBA"); px = src.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            r2, g2, b2 = colorsys.hls_to_rgb((h + 0.24) % 1.0, l * 0.92, min(1, sat * 0.85))
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    src.save(os.path.join(os.path.dirname(__file__), "race_src", "dragonewt_w.png")); src.save(os.path.join(RP, "textures/entity/etheria_race_dragonewt_w.png"))
    dw = json.loads(json.dumps(dn)); dw["minecraft:geometry"][0]["description"]["identifier"] = "geometry.etheria_race_dragonewt_w"
    json.dump(dw, open(os.path.join(RP, "models/entity/etheria_race_dragonewt_w.geo.json"), "w"), indent=1)
    anims["animation.etheria.race_dragonewt_w"] = json.loads(json.dumps(anims["animation.etheria.race_dragonewt"]))
    json.dump(AN, open(ap, "w"), indent=1)
if __name__ == "__main__": main()

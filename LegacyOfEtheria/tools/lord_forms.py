# 6.79 - FORMA LORDE DEMÔNIO DE CADA RAÇA (como os Lordes Demônio do anime): cada corpo de raça ganha a sua versão "_lord", gerada a
# partir do próprio modelo (mesmos ossos -> as animações da raça continuam valendo) com:
#  - paleta de Lorde própria da raça (tinta sobre a textura da raça);
#  - asas/chifres/orelhas maiores (escala na raiz, pela animação);
#  - insígnia de Lorde no estilo da raça: coroa de espinhos (demônio caído/vampiro), auréola negra-dourada (anjos), tiara de cristal
#    flutuante (fada/elfa — Ramiris), anel de chamas (ogro), juba de presas no pescoço (homem-fera — Carrion), anel dracônico
#    (dragonoide — Milim), crista coroada (homem-lagarto/dragonato).
# O jogo escolhe a versão pela propriedade etheria:lord (true nos estágios de Lorde) — o enum etheria:race fica com 16 valores.
# O Demônio usa tools/demon_wings.py lord (asas refeitas). Rodar: python3 tools/lord_forms.py
import json, os, copy, math, colorsys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
M = lambda r: os.path.join(RP, f"models/entity/etheria_race_{r}.geo.json"); T = lambda r: os.path.join(RP, f"textures/entity/etheria_race_{r}.png")
# raça: (tinta (h, s, v) ou None, força da tinta, multiplicador de brilho, estilo, cor escura, cor de destaque, escala asas, escala chifres)
LORDS = {
    "vampire":      ((0.98, 0.85, 0.45), 0.55, 0.70, "spikes", (26, 6, 12), (200, 30, 50), 1.30, 1.3),
    "dragonoid":    (None, 0.0, 0.85, "dragon", (40, 10, 30), (255, 190, 60), 1.30, 1.4),
    "lizardman":    ((0.40, 0.70, 0.40), 0.45, 0.80, "crest", (12, 40, 26), (230, 200, 70), 1.0, 1.35),
    "dragonewt":    ((0.40, 0.70, 0.40), 0.35, 0.80, "crest", (12, 40, 26), (230, 200, 70), 1.0, 1.35),
    "dragonewt_w":  ((0.40, 0.70, 0.40), 0.35, 0.80, "crest", (12, 40, 26), (230, 200, 70), 1.30, 1.35),
    "ogre":         ((0.00, 0.85, 0.50), 0.50, 0.75, "flame", (40, 6, 6), (255, 120, 30), 1.0, 1.45),
    "beastkin":     ((0.10, 0.75, 0.55), 0.40, 0.80, "mane", (46, 26, 10), (240, 190, 70), 1.0, 1.0),
    "elf":          ((0.78, 0.60, 0.70), 0.50, 0.90, "tiara", (40, 20, 70), (190, 120, 255), 1.40, 1.0),
    "angel":        (None, 0.0, 0.30, "halo", (20, 18, 24), (240, 200, 90), 1.25, 1.0),
    "angel_arch":   (None, 0.0, 0.30, "halo", (20, 18, 24), (240, 200, 90), 1.25, 1.0),
    "angel_cherub": (None, 0.0, 0.30, "halo", (20, 18, 24), (240, 200, 90), 1.15, 1.0),
    "angel_seraph": (None, 0.0, 0.30, "halo", (20, 18, 24), (240, 200, 90), 1.12, 1.0),
    "fallen":       ((0.98, 0.80, 0.40), 0.40, 0.75, "spikes", (20, 6, 10), (220, 40, 50), 1.30, 1.3),
    "fallen_lord":  ((0.98, 0.80, 0.40), 0.40, 0.75, "spikes", (20, 6, 10), (220, 40, 50), 1.25, 1.3),
}
DK, AC, GL = (250, 250), (251, 250), (252, 250)   # pixels sólidos para a insígnia (escuro, destaque, brilho)

def tint(img, hsv, k, mul):
    px = img.load(); w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0: continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if hsv:
                th, ts, tv = hsv
                hh = th if ss < 0.15 else (hh + ((th - hh + 0.5) % 1 - 0.5) * k) % 1
                ss = ss + (ts - ss) * k; vv = vv * (1 - k) + min(vv, tv + vv * 0.5) * k
            gold = 0.08 < hh < 0.17 and ss > 0.45 and vv > 0.55   # dourados (garras, bordas) ficam claros
            vv = min(1, vv * (1.0 if gold else mul))
            r2, g2, b2 = colorsys.hsv_to_rgb(hh, ss, vv); px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)

def U(p):
    return {"uv": {f: {"uv": list(p), "uv_size": [1, 1]} for f in ("north", "south", "east", "west", "up", "down")}}
def cube(src, o, sz, piv=None, rot=None):
    c = copy.deepcopy(src); c["origin"] = [round(v, 4) for v in o]; c["size"] = [round(v, 4) for v in sz]
    if piv is not None: c["pivot"] = [round(v, 4) for v in piv]; c["rotation"] = list(rot)
    return c

def insignia(style):
    dk, ac, gl = U(DK), U(AC), U(GL); cs = []
    if style in ("spikes", "flame", "halo", "dragon"):        # anel vertical atrás da cabeça (plano xy)
        r = {"halo": 4.6, "dragon": 5.2}.get(style, 4.4); n = 14 if style == "halo" else 12; seg = 2 * r * math.sin(math.pi / n) + 0.25
        for k in range(n):
            a = k * 360 / n; cx, cy = math.sin(math.radians(a)) * r, 30.5 + math.cos(math.radians(a)) * r
            th = 1.0 if style == "halo" else 0.7
            cs.append(cube(dk if style != "halo" else ac, (cx - seg / 2, cy - th / 2, 5.0), (seg, th, 0.7), (cx, cy, 5.35), (0, 0, -a)))
            if style == "halo" and k % 2 == 0:
                cs.append(cube(gl, (cx - 0.3, cy + 0.4, 5.1), (0.6, 0.6, 0.5), (cx, cy, 5.35), (0, 0, -a)))
            if style in ("spikes", "flame") and (k % 2 == 0 or style == "flame"):
                ln = (2.8 if k % 4 == 0 else 1.8) if style == "spikes" else (1.4 + (k * 37 % 5) * 0.5)
                cs.append(cube(dk if style == "spikes" else ac, (cx - 0.35, cy + 0.2, 5.05), (0.7, ln, 0.6), (cx, cy, 5.35), (0, 0, -a)))
                cs.append(cube(ac if style == "spikes" else gl, (cx - 0.2, cy + 0.2 + ln, 5.15), (0.4, 0.7, 0.4), (cx, cy, 5.35), (0, 0, -a)))
            if style == "dragon" and k % 3 == 0:
                cs.append(cube(ac, (cx - 0.5, cy + 0.2, 5.0), (1.0, 1.6, 0.7), (cx, cy, 5.35), (0, 0, -a)))
        return {"name": "lord_crown", "parent": "head", "pivot": [0, 30.5, 5.2], "cubes": cs}, "z"
    if style in ("tiara", "crest"):                          # tiara/crista horizontal sobre a testa (plano xz)
        r = 4.9; n = 16; seg = 2 * r * math.sin(math.pi / n) + 0.25; y = 32.6 if style == "tiara" else 32.2
        for k in range(n):
            a = k * 360 / n; cx, cz = math.sin(math.radians(a)) * r, math.cos(math.radians(a)) * r
            cs.append(cube(ac if style == "tiara" else dk, (cx - seg / 2, y, cz - 0.3), (seg, 0.5, 0.6), (cx, y, cz), (0, a, 0)))
            front = abs(((a + 180) % 360) - 180) > 120               # parte da frente (z negativo)
            if style == "tiara" and k % 2 == 0:
                h = 2.0 if front else 1.0
                cs.append(cube(gl, (cx - 0.25, y + 0.5, cz - 0.25), (0.5, h, 0.5)))
            if style == "crest" and k % 2 == 0:
                cs.append(cube(dk, (cx - 0.35, y + 0.4, cz - 0.35), (0.8, 3.0 if front else 1.8, 0.8), (cx, y, cz), (-12 if cz < 0 else 12, 0, 0)))
                cs.append(cube(ac, (cx - 0.2, y + (3.4 if front else 2.2), cz - 0.2), (0.4, 0.8, 0.4), (cx, y, cz), (-12 if cz < 0 else 12, 0, 0)))
        cs.append(cube(gl, (-0.7, y - 0.2, -5.6), (1.4, 1.4, 0.8), (0, y + 0.5, -5.2), (0, 0, 45)))   # gema frontal
        return {"name": "lord_crown", "parent": "head", "pivot": [0, y, 0], "cubes": cs}, "y"
    if style == "mane":                                      # juba de presas em volta do pescoço (homem-fera)
        r = 5.3; n = 16; y = 23.0
        for k in range(n):
            a = k * 360 / n; cx, cz = math.sin(math.radians(a)) * r, math.cos(math.radians(a)) * r * 0.75
            cs.append(cube(dk, (cx - 1.1, y, cz - 0.5), (2.2, 1.4, 1.0), (cx, y, cz), (0, a, 0)))
            cs.append(cube(ac if k % 2 else gl, (cx - 0.4, y + 1.0, cz - 0.4), (0.8, 3.0, 0.8), (cx, y + 1.0, cz), (-35 * math.cos(math.radians(a)), 0, 25 * math.sin(math.radians(a)))))
        return {"name": "lord_crown", "parent": "body", "pivot": [0, y, 0], "cubes": cs}, "none"

def build(race, cfg):
    hsv, k, mul, style, dk, ac, wsc, hsc = cfg
    D = json.load(open(M(race))); G = D["minecraft:geometry"][0]
    G["description"]["identifier"] = f"geometry.etheria_race_{race}_lord"
    names = {b["name"] for b in G["bones"]}
    if "head" not in names:
        par = "body" if "body" in names else None
        hb = {"name": "head", "pivot": [0, 24, 0]}
        if par: hb["parent"] = par
        G["bones"].insert(1, hb)
    G["bones"] = [b for b in G["bones"] if b["name"] != "lord_crown"]
    crown, axis = insignia(style); G["bones"].append(crown)
    G["description"]["visible_bounds_width"] = max(G["description"].get("visible_bounds_width", 6), 8)
    json.dump(D, open(M(race + "_lord"), "w"), indent=1)
    img = Image.open(T(race)).convert("RGBA"); tint(img, hsv, k, mul)
    gl = tuple(min(255, int(c * 1.25 + 30)) for c in ac)
    for p, c in ((DK, dk), (AC, ac), (GL, gl)): img.putpixel(p, c + (255,))
    img.save(T(race + "_lord"))
    return axis

AP = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(AP))
for race, cfg in LORDS.items():
    axis = build(race, cfg); wsc, hsc = cfg[6], cfg[7]
    an = copy.deepcopy(AN["animations"][f"animation.etheria.race_{race}"]); bones = an["bones"]
    def scale(n, f):
        b = bones.setdefault(n, {}); s = b.get("scale", 1)
        b["scale"] = (round(s * f, 3) if isinstance(s, (int, float)) else [f"({v}) * {f}" if isinstance(v, str) else v * f for v in s]) if f != 1 else s
    for side in ("l", "r"):
        for w in ("wing", "wing2", "wing3"):
            if any(b["name"] == f"{w}_{side}" for b in json.load(open(M(race)))["minecraft:geometry"][0]["bones"]): scale(f"{w}_{side}", wsc)
        if hsc != 1:
            for h in ("horn", "ear"):
                if any(b["name"] == f"{h}_{side}" for b in json.load(open(M(race)))["minecraft:geometry"][0]["bones"]): scale(f"{h}_{side}", hsc if h == "horn" else 1.25)
    if "halo" in bones: scale("halo", 1.2)
    rot = {"z": [0, 0, "query.life_time * 22"], "y": [0, "query.life_time * 30", 0], "none": [0, 0, 0]}[axis]
    bones["lord_crown"] = {"rotation": rot, "position": [0, "math.sin(query.life_time * 90) * 0.3" if axis != "none" else 0, 0]}
    AN["animations"][f"animation.etheria.race_{race}_lord"] = an
    print("lorde:", race)
json.dump(AN, open(AP, "w"), indent=1)

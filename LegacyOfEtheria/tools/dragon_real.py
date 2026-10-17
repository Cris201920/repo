# 6.88 - DRAGÕES VERDADEIROS NA FORMA REAL DE CADA UM (forma do jogador: dracônica e verdadeira). Antes os três usavam o esqueleto/corpo do
# Veldora recolorido. Agora cada um tem um modelo próprio, feito do zero, com os MESMOS nomes de ossos (d_*) -> andar, correr, voar, planar,
# pousar, atacar, rugir e o surgimento continuam funcionando:
#   VELZARD   (Dragão do Gelo Branco)  quadrúpede esguio e elegante, pescoço longo, branco-lilás, espinhos escuros nas costas, crista laranja,
#             juba azul, asas de CRISTAL de gelo, cristais nos ombros e na ponta da cauda
#   VELGRYND  (Dragão das Chamas)      SERPENTE oriental: corpo muito longo e sinuoso (cauda + 6 segmentos extras), patas curtas com garras,
#             chifres-galhada dourados, bigodes longos, juba de fogo; nadadeiras de chama no lugar de asas grandes
#   VELDANAVA (Rei Dragão Estelar)     quadrúpede majestoso, branco e dourado, DOIS pares de asas de penas, coroa de chifres dourados,
#             auréola de luz, constelações brilhando no corpo
# Textura própria 256x256 por dragão (ladrilhos pintados: escamas, placas da barriga, membrana/penas/cristal, chifre, garra, olhos, brilho).
# Também: animações de repouso próprias (quadrúpede/serpente) e passada das patas dianteiras.
# Uso: python3 tools/dragon_real.py
import json, os, math, random
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
TS = 32                                                     # ladrilho 32x32 num atlas 512x512 (mais definição)

# ------------------------------------------------------------------ texturas
def tile_img(kind, a, b, c=None, seed=1):
    rnd = random.Random(seed); im = Image.new("RGBA", (TS, TS), a + (255,)); d = ImageDraw.Draw(im)
    if kind == "scales":
        for y in range(-2, TS, 4):
            for x in range(-4 + (y // 4 % 2) * 2, TS, 4):
                d.arc([x, y, x + 4, y + 4], 0, 180, fill=b + (255,)); d.point((x + 2, y + 1), fill=tuple(min(255, v + 25) for v in a) + (255,))
    elif kind == "plates":
        for y in range(0, TS, 4): d.line([(0, y), (TS, y)], fill=b + (255,)); d.line([(0, y + 1), (TS, y + 1)], fill=tuple(min(255, v + 18) for v in a) + (255,))
    elif kind == "membrane":
        for y in range(TS): d.line([(0, y), (TS, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * y / TS) for i in range(3)) + (255,))
        for x in (3, 8, 13): d.line([(x, 0), (x + rnd.randint(-2, 2), TS)], fill=c + (255,) if c else b + (255,))
    elif kind == "feathers":
        for y in range(0, TS, 3):
            for x in range(-2 + (y // 3 % 2) * 2, TS, 4): d.polygon([(x, y), (x + 4, y), (x + 2, y + 4)], fill=(a if (x + y) % 2 else b) + (255,))
        d.line([(0, 0), (TS, 0)], fill=c + (255,) if c else b + (255,))
    elif kind == "crystal":
        for i in range(6):
            x, y = rnd.randint(0, TS), rnd.randint(0, TS); d.polygon([(x, y - 4), (x + 3, y), (x, y + 4), (x - 3, y)], fill=(b if i % 2 else (255, 255, 255)) + (210,))
    elif kind == "fire":
        for y in range(TS): d.line([(0, y), (TS, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * y / TS) for i in range(3)) + (255,))
        for _ in range(5): x = rnd.randint(0, TS); d.line([(x, TS), (x + rnd.randint(-3, 3), rnd.randint(2, 9))], fill=(255, 240, 160, 255))
    elif kind == "metal":
        for y in range(TS): t = abs(math.sin(y / TS * math.pi)); d.line([(0, y), (TS, y)], fill=tuple(int(a[i] * (1 - t * 0.4) + b[i] * t * 0.4) for i in range(3)) + (255,))
    elif kind == "stars":
        for _ in range(4): x, y = rnd.randint(1, TS - 2), rnd.randint(1, TS - 2); d.point((x, y), fill=b + (255,)); d.point((x + 1, y), fill=b + (180,)); d.point((x, y + 1), fill=b + (180,))
    elif kind == "eye":   # olho de dragão: órbita escura, íris em degradê, pupila em fenda, brilho
        T = TS
        d.rectangle([0, 0, T, T], fill=a + (255,))
        d.ellipse([1, T * 0.18, T - 2, T * 0.82], fill=(12, 8, 12, 255))
        for r in range(int(T * 0.3), 0, -1):
            k = r / (T * 0.3); col = tuple(int(b[i] * (1.15 - 0.45 * k)) for i in range(3))
            d.ellipse([T / 2 - r * 1.45, T / 2 - r, T / 2 + r * 1.45, T / 2 + r], fill=tuple(min(255, v) for v in col) + (255,))
        d.polygon([(T / 2, T * 0.2), (T / 2 + 2.2, T / 2), (T / 2, T * 0.8), (T / 2 - 2.2, T / 2)], fill=(8, 4, 8, 255))
        d.ellipse([T * 0.28, T * 0.3, T * 0.28 + 4, T * 0.3 + 3], fill=(255, 255, 255, 235))
    elif kind == "solid":
        pass
    if kind in ("scales", "plates", "metal", "membrane", "feathers"):   # volume: borda superior clara, base mais escura, ruído fino
        px = im.load()
        for yy in range(TS):
            f = 1.12 - 0.3 * (yy / (TS - 1))
            for xx in range(TS):
                r_, g_, b_, a_ = px[xx, yy]; n = rnd.randint(-7, 7)
                px[xx, yy] = (max(0, min(255, int(r_ * f) + n)), max(0, min(255, int(g_ * f) + n)), max(0, min(255, int(b_ * f) + n)), a_)
    return im
TILES = ["back", "side", "belly", "wing", "wbone", "horn", "claw", "eye", "glow", "acc1", "acc2", "mane", "teeth", "mouth", "acc3", "spike"]
DRAGONS = {
  # VELZARD (referência do jogador): serpente branco-lilás, espinhos triangulares marrom-escuros por todo o corpo, crista LARANJA grande,
  # juba AZUL esvoaçante, boca vermelha, cristais de gelo ao redor (no lugar de asas)
  "velzard": dict(plan="serpent", s=1.0, neck=1.0, wings="crystal",
    tiles=dict(back=("scales", (222, 216, 242), (186, 180, 218)), side=("scales", (238, 234, 252), (204, 198, 230)), belly=("plates", (250, 248, 255), (214, 210, 236)),
               wing=("crystal", (176, 222, 252), (120, 190, 250)), wbone=("crystal", (200, 236, 255), (140, 200, 250)), horn=("metal", (250, 150, 30), (255, 210, 120)),
               claw=("solid", (70, 62, 76), (0, 0, 0)), eye=("eye", (60, 50, 80), (120, 215, 255)), glow=("solid", (190, 245, 255), (0, 0, 0)), acc1=("crystal", (150, 216, 255), (100, 170, 255)),
               acc2=("metal", (255, 140, 20), (255, 200, 90)), mane=("membrane", (90, 140, 240), (50, 90, 200), (140, 180, 255)), teeth=("solid", (240, 240, 250), (0, 0, 0)),
               mouth=("solid", (200, 40, 50), (0, 0, 0)), acc3=("solid", (205, 240, 255), (0, 0, 0)), spike=("metal", (60, 44, 42), (100, 76, 66)))),
  # VELDANAVA (referência do jogador): dragão azul-TURQUESA, pescoço longo e arqueado com crista de escamas espinhosas, barriga creme em
  # anéis, asas ENORMES erguidas de penas/lâminas turquesa-pálidas, chifres-espinho para trás
  "veldanava": dict(plan="quad", s=1.12, neck=1.45, wings="feather",
    tiles=dict(back=("scales", (62, 140, 158), (38, 100, 120)), side=("scales", (84, 160, 176), (52, 118, 138)), belly=("plates", (236, 220, 206), (196, 174, 160)),
               wing=("feathers", (196, 226, 230), (150, 196, 206), (104, 160, 176)), wbone=("metal", (70, 140, 156), (120, 190, 200)), horn=("metal", (52, 120, 140), (150, 210, 220)),
               claw=("solid", (40, 60, 70), (0, 0, 0)), eye=("eye", (30, 70, 84), (255, 214, 90)), glow=("solid", (170, 240, 245), (0, 0, 0)), acc1=("metal", (60, 140, 156), (120, 196, 206)),
               acc2=("solid", (170, 240, 245), (0, 0, 0)), mane=("feathers", (90, 170, 186), (60, 130, 150), (40, 100, 120)), teeth=("solid", (240, 236, 226), (0, 0, 0)),
               mouth=("solid", (90, 40, 50), (0, 0, 0)), acc3=("solid", (200, 240, 245), (0, 0, 0)), spike=("metal", (44, 112, 132), (96, 174, 190)))),
  # VELGRYND (referência do jogador): serpente de corpo CREME/branco com placas VERMELHAS nas costas, lâminas claras saindo do corpo,
  # asas VERMELHAS de morcego, cabeça vermelha com chifres para trás, bigodes azuis
  "velgrynd": dict(plan="serpent", s=1.0, neck=1.0, wings="bat",
    tiles=dict(back=("scales", (200, 32, 40), (140, 16, 24)), side=("scales", (242, 232, 218), (208, 194, 174)), belly=("plates", (246, 238, 226), (214, 200, 180)),
               wing=("membrane", (214, 44, 48), (150, 20, 28), (110, 10, 18)), wbone=("metal", (150, 20, 28), (220, 60, 60)), horn=("metal", (236, 226, 210), (255, 250, 240)),
               claw=("solid", (40, 30, 36), (0, 0, 0)), eye=("eye", (120, 20, 26), (255, 196, 40)), glow=("solid", (255, 150, 40), (0, 0, 0)), acc1=("metal", (200, 32, 40), (240, 90, 90)),
               acc2=("solid", (90, 150, 255), (0, 0, 0)), mane=("membrane", (214, 44, 48), (150, 20, 28), (110, 10, 18)), teeth=("solid", (245, 240, 230), (0, 0, 0)),
               mouth=("solid", (60, 10, 10), (0, 0, 0)), acc3=("solid", (255, 236, 160), (0, 0, 0)), spike=("metal", (240, 236, 226), (255, 255, 255)))),
}
def atlas(name, cfg):
    im = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    for i, t in enumerate(TILES):
        spec = cfg["tiles"][t]; im.paste(tile_img(spec[0], spec[1], spec[2], spec[3] if len(spec) > 3 else None, seed=i * 7 + len(name)), ((i % 16) * TS, (i // 16) * TS))
    return im
UVT = {t: [(i % 16) * TS, (i // 16) * TS] for i, t in enumerate(TILES)}
def faces(tile, top=None, bottom=None, side=None):
    f = {k: {"uv": UVT[side or tile], "uv_size": [TS, TS]} for k in ("north", "south", "east", "west")}
    f["up"] = {"uv": UVT[top or tile], "uv_size": [TS, TS]}; f["down"] = {"uv": UVT[bottom or tile], "uv_size": [TS, TS]}
    return f

# ------------------------------------------------------------------ geometria
def rod(p0, p1, w, h, tile, **fk):
    """caixa de p0 até p1 (largura w, altura h) orientada pela direção (rotação de cubo em torno de p0)"""
    d = [p1[i] - p0[i] for i in range(3)]; L = math.sqrt(sum(x * x for x in d)) or 0.01
    dx, dy, dz = (x / L for x in d)
    rx = math.degrees(math.asin(max(-1, min(1, dy)))); ry = math.degrees(math.atan2(-dx, dz))
    return {"origin": [round(p0[0] - w / 2, 3), round(p0[1] - h / 2, 3), round(p0[2], 3)], "size": [round(w, 3), round(h, 3), round(L, 3)],
            "pivot": [round(p0[0], 3), round(p0[1], 3), round(p0[2], 3)], "rotation": [round(rx, 2), round(ry, 2), 0], "uv": faces(tile, **fk)}
def box(c, s, tile, **fk):
    return {"origin": [round(c[0] - s[0] / 2, 3), round(c[1] - s[1] / 2, 3), round(c[2] - s[2] / 2, 3)], "size": [round(v, 3) for v in s], "uv": faces(tile, **fk)}
def taper(pts, w0, w1, tile, hk=1.0, **fk):
    out = []
    for i in range(len(pts) - 1):
        t = i / max(1, len(pts) - 2); w = w0 + (w1 - w0) * t
        out.append(rod(pts[i], pts[i + 1], w, w * hk, tile, **fk))
    return out
SKIN = dict(top="back", bottom="belly", side="side")
class Geo:
    def __init__(self): self.bones = []; self.idx = {}
    def bone(self, name, parent, pivot, cubes=None):
        b = {"name": name, "pivot": [round(v, 3) for v in pivot]}
        if parent: b["parent"] = parent
        if cubes: b["cubes"] = cubes
        self.bones.append(b); self.idx[name] = b; return b
    def add(self, name, cubes): self.idx[name].setdefault("cubes", []).extend(cubes)

def mirror(p): return (-p[0], p[1], p[2])
def wing(g, side, base, sg, cfg, scale=1.0, pre="d", feathered=False, crystal=False, small=False):
    """asa: base -> top -> mid -> low (mesmos ossos do original); membrana/penas/cristal pendurados sob cada vareta"""
    S = scale
    pb = base; pt = (base[0] + sg * 20 * S, base[1] + 22 * S, base[2] + 8 * S); pm = (pt[0] + sg * 48 * S, pt[1] + 16 * S, pt[2] + 10 * S); pl = (pm[0] + sg * 46 * S, pm[1] - 24 * S, pm[2] + 10 * S)
    tip = (pl[0] + sg * 22 * S, pl[1] - 40 * S, pl[2] + 6 * S)
    n = lambda k: f"{pre}_{side}_wing_{k}"
    g.bone(n("base"), "d_upper_body", pb, [rod(pb, pt, 6 * S, 6 * S, "wbone")])
    g.bone(n("top"), n("base"), pt, [rod(pt, pm, 5 * S, 5 * S, "wbone")])
    g.bone(n("mid"), n("top"), pm, [rod(pm, pl, 4 * S, 4 * S, "wbone")])
    g.bone(n("low"), n("mid"), pl, [rod(pl, tip, 3 * S, 3 * S, "wbone")])
    mat = "wing"
    def panel(a, b, depth, steps=4):        # membrana: tiras descendo da vareta (borda inferior recortada)
        cs = []
        for k in range(steps):
            t0, t1 = k / steps, (k + 1) / steps
            x0, x1 = a[0] + (b[0] - a[0]) * t0, a[0] + (b[0] - a[0]) * t1
            y0 = a[1] + (b[1] - a[1]) * (t0 + t1) / 2; z0 = a[2] + (b[2] - a[2]) * (t0 + t1) / 2
            dd = depth * (1 - 0.35 * abs(0.5 - (t0 + t1) / 2) * 2) * (0.85 if k % 2 else 1)
            th = 3 if crystal else (2.4 if feathered else 1.2)
            cs.append(box(((x0 + x1) / 2, y0 - dd / 2, z0 + 1.5), (abs(x1 - x0) + 0.6, dd, th), mat))
            if feathered:   # penas: pontas soltas na borda
                cs.append(box(((x0 + x1) / 2, y0 - dd - 4 * S, z0 + 1.5), (abs(x1 - x0) * 0.6, 8 * S, 1.6), mat))
            if crystal and k % 2 == 0:
                cs.append(box(((x0 + x1) / 2, y0 - dd - 3 * S, z0 + 1.5), (4 * S, 10 * S, 4 * S), "acc1"))
        return cs
    D = 0.7 if small else 1.0
    g.add(n("top"), panel(pt, pm, 46 * S * D)); g.add(n("mid"), panel(pm, pl, 56 * S * D)); g.add(n("low"), panel(pl, tip, 40 * S * D, 3))

def head(g, cfg, pivot, s, kind):
    x, y, z = pivot
    cs = [rod((0, y + 2 * s, z + 2 * s), (0, y, z - 26 * s), 20 * s, 18 * s, "side", top="back", bottom="belly")]                        # crânio
    cs.append(rod((0, y - 2 * s, z - 24 * s), (0, y - 5 * s, z - (44 if kind != "serpent" else 48) * s), 13 * s, 11 * s, "side", top="back", bottom="belly"))   # focinho
    cs += [box((sg * 10.3 * s, y + 4.5 * s, z - 15 * s), (1.2 * s, 5 * s, 9 * s), "eye") for sg in (1, -1)]                                  # olhos na face do crânio (antes ficavam dentro)
    cs += [box((sg * 8 * s, y + 8 * s, z - 16 * s), (5 * s, 3 * s, 14 * s), "back") for sg in (1, -1)]                                       # sobrancelhas
    cs += [box((sg * 3.5 * s, y - 1 * s, z - 44.2 * s), (2 * s, 1.6 * s, 2 * s), "claw") for sg in (1, -1)]                                  # narinas (escuras, pequenas)
    cs += [box((sg * 5.5 * s, y - 9 * s, z - (24 + k * 4.5) * s), (1.4 * s, 3 * s, 1.4 * s), "teeth") for sg in (1, -1) for k in range(4)]   # dentes de cima
    cs += [box((sg * 10.2 * s, y + 7.6 * s, z - 15 * s), (2.2 * s, 1.4 * s, 11 * s), "back") for sg in (1, -1)]                             # pálpebra/arcada sobre o olho
    cs += [rod((sg * 8 * s, y + 10 * s, z - 12 * s), (sg * 13 * s, y + 14 * s, z - 4 * s), 2.5 * s, 2.5 * s, "spike") for sg in (1, -1)]       # espinhos da sobrancelha
    cs += [rod((sg * 9 * s, y - 2 * s, z - 8 * s), (sg * 15 * s, y - 6 * s, z + 2 * s), 2 * s, 2 * s, "spike") for sg in (1, -1)]            # espinhos da mandíbula
    if kind == "velzard":   # crista laranja grande varrida para trás + chifre fino na testa
        cs.append(rod((0, y + 8 * s, z - 22 * s), (0, y + 30 * s, z + 18 * s), 3 * s, 16 * s, "acc2"))
        cs.append(rod((0, y + 14 * s, z - 6 * s), (0, y + 26 * s, z + 30 * s), 2.5 * s, 10 * s, "acc2"))
        cs.append(rod((0, y + 6 * s, z - 34 * s), (0, y + 14 * s, z - 46 * s), 2 * s, 2 * s, "horn"))
    elif kind == "veldanava":   # chifres grandes curvos para trás + chifres menores
        for sg in (1, -1):
            cs += taper([(sg * 7 * s, y + 9 * s, z - 6 * s), (sg * 12 * s, y + 18 * s, z + 8 * s), (sg * 14 * s, y + 22 * s, z + 24 * s), (sg * 12 * s, y + 20 * s, z + 40 * s), (sg * 8 * s, y + 14 * s, z + 50 * s)], 7 * s, 2 * s, "horn")
            cs += taper([(sg * 9 * s, y + 3 * s, z - 2 * s), (sg * 16 * s, y + 6 * s, z + 10 * s), (sg * 18 * s, y + 4 * s, z + 22 * s)], 3.5 * s, 1.5 * s, "horn")
            cs.append(box((sg * 10.5 * s, y + 2 * s, z - 20 * s), (1, 2 * s, 14 * s), "glow"))   # frisos ciano no rosto
    else:   # velgrynd: chifres vermelho/creme varridos para trás
        for sg in (1, -1):
            cs += taper([(sg * 6 * s, y + 9 * s, z - 4 * s), (sg * 10 * s, y + 16 * s, z + 10 * s), (sg * 12 * s, y + 20 * s, z + 28 * s), (sg * 11 * s, y + 18 * s, z + 42 * s)], 5 * s, 1.8 * s, "horn")
            cs.append(rod((sg * 10 * s, y + 2 * s, z - 6 * s), (sg * 22 * s, y + 6 * s, z + 8 * s), 4 * s, 2 * s, "acc1"))   # barbatanas das bochechas
    g.bone("d_head", "d_neck3", pivot, cs)
    jaw = [rod((0, y - 8 * s, z - 14 * s), (0, y - 11 * s, z - 40 * s), 11 * s, 4 * s, "belly")]
    jaw += [box((sg * 4 * s, y - 6 * s, z - (20 + k * 5) * s), (1.2 * s, 3 * s, 1.2 * s), "teeth") for sg in (1, -1) for k in range(4)]
    jaw += [box((0, y - 9 * s, z - 26 * s), (8 * s, 1, 22 * s), "mouth")]   # língua/boca
    g.bone("d_lower_jaw", "d_head", (0, y - 6 * s, z - 12 * s), jaw)
    if kind == "velzard":   # juba azul longa esvoaçando para trás (x_mane*, animadas por "parts")
        for k in range(3):
            sg = (-1, 0, 1)[k]; p0 = (sg * 5 * s, y + 10 * s, z + 4 * s)
            g.bone(f"x_mane{k + 1}", "d_head", p0, taper([p0, (sg * 10 * s, y + 14 * s, z + 26 * s), (sg * 16 * s, y + 6 * s, z + 50 * s), (sg * 18 * s, y - 6 * s, z + 72 * s)], 9 * s, 4 * s, "mane", hk=0.5))
    if kind == "velgrynd":   # bigodes (x_whisk_*, animados por "parts")
        for side, sg in (("l", 1), ("r", -1)):
            p0 = (sg * 6 * s, y - 4 * s, z - 40 * s)
            g.bone(f"x_whisk_{side}", "d_head", p0, taper([p0, (sg * 18 * s, y - 8 * s, z - 34 * s), (sg * 30 * s, y - 16 * s, z - 20 * s), (sg * 38 * s, y - 26 * s, z - 2 * s)], 2.2 * s, 1 * s, "acc2"))

def leg(g, name, parent, hip, foot_z, s, thick, tile="side", claws=True, upper_len=30, lower_len=None):
    """perna (osso + parte inferior + pata com garras) do quadril até o chão"""
    knee = (hip[0] * 1.08, hip[1] - upper_len * s, hip[2] + 6 * s); foot = (hip[0] * 1.1, 6 * s, foot_z)
    g.bone(name, parent, hip, [rod(hip, knee, thick * s, thick * 1.1 * s, tile, top="back", bottom="belly")])
    low = [rod(knee, foot, thick * 0.72 * s, thick * 0.8 * s, tile, top="back", bottom="belly"), box((foot[0], 3.5 * s, foot[2] - 4 * s), (thick * 1.0 * s, 7 * s, 15 * s), tile, top="back")]
    if claws: low += [rod((foot[0] + k * 3.5 * s, 3 * s, foot[2] - 11 * s), (foot[0] + k * 4.2 * s, 0.5, foot[2] - 17 * s), 2 * s, 2.2 * s, "claw") for k in (-1, 0, 1)]
    g.bone(name + "_lower", name, knee, low)
    return knee, foot

# ------------------------------------------------------------------ 6.93: dragões-serpente orientais (Velzard / Velgrynd)
def _v(a, b, k=1.0): return tuple(a[i] + b[i] * k for i in range(3))
def _sub(a, b): return tuple(a[i] - b[i] for i in range(3))
def _nrm(a):
    L = math.sqrt(sum(x * x for x in a)) or 1e-6; return tuple(x / L for x in a)
def _cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def _dot(a, b): return sum(a[i] * b[i] for i in range(3))

def seg(p0, p1, w, h, n, tile="side", top="back", bottom="belly"):
    """caixa de p0 a p1 com a face de cima virada para n (costas): rotação completa (rx, ry, rz)"""
    t = _nrm(_sub(p1, p0)); L = math.sqrt(sum(x * x for x in _sub(p1, p0)))
    n = _nrm(_v(n, t, -_dot(n, t))); x = _cross(n, t)
    R = [[x[0], n[0], t[0]], [x[1], n[1], t[1]], [x[2], n[2], t[2]]]
    b = math.asin(max(-1, min(1, -R[2][0]))); a = math.atan2(R[2][1], R[2][2]); c = math.atan2(R[1][0], R[0][0])
    return {"origin": [round(p0[0] - w / 2, 3), round(p0[1] - h / 2, 3), round(p0[2], 3)], "size": [round(w, 3), round(h, 3), round(L, 3)],
            "pivot": [round(v, 3) for v in p0], "rotation": [round(-math.degrees(a), 2), round(-math.degrees(b), 2), round(math.degrees(c), 2)],
            "uv": faces(tile, top=top, bottom=bottom, side=tile)}

def coil_path(k):
    """corpo em '6' na vertical (como nas artes/vídeo): cabeça no alto, pescoço desce pelas costas, volta completa, cauda para baixo"""
    def bez(p, q, r, u, N):
        return [tuple((1 - t) ** 3 * p[i] + 3 * (1 - t) ** 2 * t * q[i] + 3 * (1 - t) * t * t * r[i] + t ** 3 * u[i] for i in range(3)) for t in [j / N for j in range(N)]]
    C, R = (66, 6), 34
    loop0 = (-2, C[0] + R * math.sin(math.radians(40)), C[1] + R * math.cos(math.radians(40)))
    pts = bez((0, 150, -4), (0, 166, 18), (-2, 124, 44), loop0, 30)
    th0, th1 = 40, -400
    for j in range(80):
        th = th0 + (th1 - th0) * j / 80; u = j / 80
        r = R * (1 + 0.12 * u)
        pts.append((-2 + 14 * u, C[0] + r * math.sin(math.radians(th)), C[1] + r * math.cos(math.radians(th))))
    e = pts[-1]
    pts += bez(e, (12, e[1] - 22, e[2] + 14), (14, 18, 74), (10, 6, 112), 30)[1:] + [(8, 4, 124)]
    pts = [(p[0] * k, p[1] * k, p[2] * k) for p in pts]
    # reamostra em passos iguais
    out = [pts[0]]; acc = 0.0; step = 9.5 * k
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]; L = math.sqrt(sum((b[j] - a[j]) ** 2 for j in range(3)))
        while acc + L >= step:
            f = (step - acc) / L; a = tuple(a[j] + (b[j] - a[j]) * f for j in range(3)); out.append(a); L -= step - acc; acc = 0.0
        acc += L
    return out

def coil_serpent(g, name, cfg):
    s = cfg["s"]; vz = name == "velzard"; k = 0.86 * s
    P = coil_path(k); M = len(P) - 1
    def tan(i): return _nrm(_sub(P[min(i + 1, M)], P[max(i - 1, 0)]))
    def dors(i):
        t = tan(i); return _nrm((0, t[2], -t[1])) if abs(t[1]) + abs(t[2]) > 1e-3 else (0, 1, 0)
    def wid(i):
        if i < 4: return (14 + i * 1.5) * s
        return max(5.0, 21 - max(0, i - 10) * 0.62) * s
    names = ["d_neck3", "d_neck2", "d_neck1", "d_upper_body", "d_body"] + [f"d_tail{j}" for j in range(1, 6)] + [f"x_serp{j}" for j in range(1, M - 9)]
    parent = {"d_neck3": "d_neck2", "d_neck2": "d_neck1", "d_neck1": "d_upper_body", "d_upper_body": "d_body", "d_body": "d_All"}
    tailn = names[5:]
    for j, nm in enumerate(tailn): parent[nm] = "d_body" if j == 0 else tailn[j - 1]
    pivot = {"d_neck3": P[1], "d_neck2": P[2], "d_neck1": P[3], "d_upper_body": P[4], "d_body": P[5]}
    seg_of = {"d_neck3": 0, "d_neck2": 1, "d_neck1": 2, "d_upper_body": 3, "d_body": 4}
    for j, nm in enumerate(tailn): pivot[nm] = P[5 + j]; seg_of[nm] = 5 + j
    order = ["d_body", "d_upper_body", "d_neck1", "d_neck2", "d_neck3"] + tailn
    for nm in order:
        i = seg_of[nm]; w = wid(i); n = dors(i); t = tan(i); lat = _cross(n, t)
        a, b = P[i], P[i + 1]; mid = tuple((a[q] + b[q]) / 2 for q in range(3))
        cs = [seg(a, _v(b, t, 1.5 * s), w, w * 0.92, n)]
        cs.append(seg(_v(a, n, -w * 0.4), _v(_v(b, t, 0.6 * s), n, -w * 0.4), w * 0.78, w * 0.2, n, tile="belly", top="belly", bottom="belly"))   # placas da barriga
        if i % 3 == 1 and i < M - 6:   # tufos/escamas eriçadas atrás das placas (volume)
            for sg in (1, -1): cs.append(rod(_v(_v(mid, lat, sg * w * 0.46), n, -w * 0.12), _v(_v(_v(mid, lat, sg * w * 0.62), t, w * 0.5), n, -w * 0.05), w * 0.18, w * 0.3, "side"))
        if vz:   # espinhos escuros grandes nas costas (alternando tamanho) + espinhos laterais
            if i % 2 == 0 and i > 1:
                hs = max(5, w * 0.85)
                base = _v(mid, n, w * 0.38)
                cs.append(rod(base, _v(_v(base, n, hs), t, hs * 0.6), w * 0.42, w * 0.42, "spike")); cs.append(rod(_v(_v(base, n, hs * 0.55), t, hs * 0.3), _v(_v(base, n, hs * 1.15), t, hs * 0.8), w * 0.22, w * 0.22, "spike"))
            if i % 4 == 1 and i > 4:
                for sg in (1, -1):
                    base = _v(mid, lat, sg * w * 0.42)
                    cs.append(rod(base, _v(_v(_v(base, lat, sg * w * 0.55), t, w * 0.4), n, w * 0.25), w * 0.32, w * 0.32, "spike"))
        else:    # Velgrynd: crista vermelha contínua + lâminas brancas nas laterais
            base = _v(mid, n, w * 0.36)
            cs.append(rod(base, _v(_v(base, n, max(4, w * 0.45)), t, w * 0.5), 2.6 * s, w * 0.75, "acc1"))
            if i % 3 == 0 and i > 3:
                for sg in (1, -1):
                    base = _v(mid, lat, sg * w * 0.44)
                    cs.append(rod(base, _v(_v(_v(base, lat, sg * w * 0.65), t, w * 0.55), n, w * 0.3), 2.2 * s, 3.6 * s, "spike"))
        if nm == tailn[-1]:   # tufo da ponta da cauda
            tip = P[M]; t2 = tan(M - 1); n2 = dors(M - 1); l2 = _cross(n2, t2)
            for ang in (-50, -25, 0, 25, 50):
                d = _nrm(_v(_v(t2, n2, math.sin(math.radians(ang))), l2, 0.25 * math.sin(math.radians(ang * 2))))
                cs.append(rod(tip, _v(tip, d, (16 - abs(ang) / 8) * s), 3 * s, 5 * s, "acc1" if not vz else ("acc3" if ang % 50 else "acc1")))
        g.bone(nm, parent[nm], pivot[nm], cs)
    # pescoço: crina (Velzard azul) / espinhos (Velgrynd)
    for j, nm in enumerate(("d_neck3", "d_neck2", "d_neck1")):
        i = seg_of[nm]; n = dors(i); t = tan(i); p = _v(P[i], n, wid(i) * 0.4)
        g.bone(f"x_mane{j + 1}", nm, p, taper([p, _v(_v(p, n, 7 * s), t, 12 * s), _v(_v(p, n, 9 * s), t, 26 * s), _v(_v(p, n, 6 * s), t, 40 * s)], 8 * s, 2.5 * s, "mane", hk=0.45) if vz
               else [rod(p, _v(_v(p, n, 9 * s), t, 6 * s), 2.5 * s, 7 * s, "acc1")])
    head(g, cfg, (0, P[0][1] + 2 * s, P[0][2] - 2 * s), s * 1.22, name)
    if not vz:   # Velgrynd: crina vermelha caindo do pescoço + bigodes longos
        for j, nm in enumerate(("d_neck3", "d_neck2", "d_neck1")):
            i = seg_of[nm]; n = dors(i); t = tan(i); lat = _cross(n, t)
            for sg in (1, -1):
                p = _v(_v(P[i], n, wid(i) * 0.3), lat, sg * wid(i) * 0.35)
                g.add(nm, taper([p, _v(_v(_v(p, n, 5 * s), t, 10 * s), lat, sg * 4 * s), _v(_v(_v(p, n, 3 * s), t, 22 * s), lat, sg * 7 * s)], 5 * s, 1.5 * s, "mane", hk=0.45))
    if vz:   # mechas longas da juba saindo da nuca
        hp = g.idx["d_head"]["pivot"]
        for kk, sg in ((4, -1), (5, 1)):
            p0 = (sg * 4 * s, hp[1] + 10 * s, hp[2] + 4 * s)
            g.bone(f"x_mane{kk}", "d_head", p0, taper([p0, (sg * 8 * s, hp[1] + 18 * s, hp[2] + 24 * s), (sg * 12 * s, hp[1] + 12 * s, hp[2] + 46 * s), (sg * 14 * s, hp[1] + 0 * s, hp[2] + 64 * s)], 7 * s, 2.5 * s, "mane", hk=0.5))
    # patinhas com garras: dianteiras no ombro (d_*_arm), traseiras no meio da volta (d_*_leg)
    def limb(base_bone, i, side, sg, pre):
        n = dors(i); t = tan(i); lat = _cross(n, t); w = wid(i)
        sh = _v(_v(P[i], lat, sg * w * 0.42), n, -w * 0.15)
        el = _v(_v(_v(sh, lat, sg * 9 * s), n, -6 * s), t, -5 * s)
        wr = _v(_v(el, n, -9 * s), t, -7 * s)
        g.bone(f"{pre}_{side}_{'arm' if pre == 'A' else 'leg'}".replace("A_", "d_").replace("L_", "d_"), base_bone, sh, [rod(sh, el, 5.5 * s, 6 * s, "side", top="back", bottom="belly")])
        nm = f"d_{side}_{'arm' if pre == 'A' else 'leg'}"
        g.bone(f"{nm}_lower", nm, el, [rod(el, wr, 4.5 * s, 5 * s, "side", top="back", bottom="belly")])
        claws = [rod(wr, _v(_v(_v(wr, t, -6 * s), n, -3 * s), lat, kk * 2.6 * s), 1.6 * s, 1.8 * s, "claw") for kk in (-1, 0, 1)]
        g.bone(f"d_{side}_hand" if pre == "A" else f"{nm}_foot", f"{nm}_lower", wr, [box(wr, (5 * s, 4 * s, 5 * s), "side", top="back")] + claws)
        if pre == "A":
            g.bone(f"d_{side}_hand_lower", f"d_{side}_hand", wr, []); g.bone(f"d_{side}_thumb", f"d_{side}_arm_lower", wr, [])
    for side, sg in (("left", 1), ("right", -1)):
        limb("d_upper_body", 4, side, sg, "A")
        hi = 5 + 14; limb(tailn[14], hi, side, sg, "L")
    # asas: Velgrynd = asas vermelhas de morcego; Velzard = asas de cristal de gelo
    i = 4; n = dors(i); sh = _v(P[i], n, wid(i) * 0.45)
    if vz:
        for side, sg in (("left", -1), ("right", 1)):
            b0 = (sh[0] + sg * 5 * s, sh[1], sh[2]); t_ = _v(b0, (sg * 10 * s, 14 * s, 6 * s)); m_ = _v(t_, (sg * 12 * s, 10 * s, 8 * s)); l_ = _v(m_, (sg * 8 * s, -6 * s, 8 * s))
            cr = lambda q, h, w_: rod(q, (q[0] + sg * w_, q[1] + h, q[2] + 2 * s), 6 * s, 6 * s, "acc1")
            g.bone(f"d_{side}_wing_base", "d_upper_body", b0, [cr(b0, 16 * s, 5 * s)])
            g.bone(f"d_{side}_wing_top", f"d_{side}_wing_base", t_, [cr(t_, 24 * s, 9 * s), rod(t_, (t_[0] + sg * 4 * s, t_[1] + 14 * s, t_[2] + 8 * s), 4 * s, 4 * s, "acc3")])
            g.bone(f"d_{side}_wing_mid", f"d_{side}_wing_top", m_, [cr(m_, 20 * s, 11 * s)])
            g.bone(f"d_{side}_wing_low", f"d_{side}_wing_mid", l_, [cr(l_, 12 * s, 9 * s)])
        # cristais de gelo flutuando em volta da espiral (presos aos segmentos)
        for j in range(8, M - 4, 5):
            nm = next(x for x in order if seg_of[x] == j) if any(seg_of[x] == j for x in order) else None
            if not nm: continue
            n = dors(j); t = tan(j); lat = _cross(n, t); c0 = _v(P[j], n, wid(j) * 0.9)
            for sg in (1, -1):
                q = _v(c0, lat, sg * wid(j) * 0.9)
                g.add(nm, [rod(q, _v(_v(q, n, 10 * s), lat, sg * 4 * s), 5 * s, 5 * s, "acc1" if j % 2 else "acc3")])
    else:
        for side, sg in (("left", -1), ("right", 1)):
            wing(g, side, (sh[0] + sg * 6 * s, sh[1], sh[2]), sg, cfg, scale=s * 0.62)

def build(name, cfg):
    g = Geo(); s = cfg["s"]; quad = cfg["plan"] == "quad"
    g.bone("d_All", None, (0, 0, 0))
    if quad:
        hips, chest = (0, 66 * s, 30 * s), (0, 72 * s, -24 * s)
        g.bone("d_body", "d_All", (0, 66 * s, 28 * s), [rod(hips, chest, 32 * s, 32 * s, "side", **{"top": "back", "bottom": "belly"}),
             rod((0, 54 * s, 28 * s), (0, 58 * s, -20 * s), 24 * s, 10 * s, "belly")])
        g.bone("d_upper_body", "d_body", (0, 72 * s, -22 * s), [rod((0, 74 * s, -18 * s), (0, 78 * s, -44 * s), 38 * s, 38 * s, "side", top="back", bottom="belly")]
             + [box((sg * 18 * s, 84 * s, -30 * s), (12 * s, 16 * s, 18 * s), "side", top="back") for sg in (1, -1)])
        N = cfg["neck"]
        n0, n1, n2, n3 = (0, 86 * s, -42 * s), (0, (86 + 22 * N) * s, -58 * s), (0, (86 + 44 * N) * s, -68 * s), (0, (86 + 62 * N) * s, -74 * s)
        g.bone("d_neck1", "d_upper_body", n0, [rod(n0, n1, 22 * s, 22 * s, "side", top="back", bottom="belly")])
        g.bone("d_neck2", "d_neck1", n1, [rod(n1, n2, 18 * s, 18 * s, "side", top="back", bottom="belly")])
        g.bone("d_neck3", "d_neck2", n2, [rod(n2, n3, 15 * s, 15 * s, "side", top="back", bottom="belly")])
        head(g, cfg, (0, n3[1] + 2 * s, n3[2] - 2 * s), s, name)
        for side, sg in (("left", 1), ("right", -1)):   # patas dianteiras (ossos d_*_arm*, mesmos nomes do original)
            sh = (sg * 20 * s, 74 * s, -34 * s); elbow = (sg * 23 * s, 42 * s, -38 * s); wr = (sg * 24 * s, 12 * s, -34 * s)
            g.bone(f"d_{side}_arm", "d_upper_body", sh, [rod(sh, elbow, 14 * s, 15 * s, "side", top="back", bottom="belly")])
            g.bone(f"d_{side}_arm_lower", f"d_{side}_arm", elbow, [rod(elbow, wr, 10 * s, 11 * s, "side", top="back", bottom="belly")])
            g.bone(f"d_{side}_hand", f"d_{side}_arm_lower", wr, [box((wr[0], 4 * s, wr[2] - 5 * s), (13 * s, 8 * s, 16 * s), "side", top="back")])
            g.bone(f"d_{side}_hand_lower", f"d_{side}_hand", (wr[0], 4 * s, wr[2] - 12 * s), [rod((wr[0] + k * 4 * s, 3 * s, wr[2] - 12 * s), (wr[0] + k * 4.6 * s, 0.4, wr[2] - 19 * s), 2.2 * s, 2.4 * s, "claw") for k in (-1, 0, 1)])
            g.bone(f"d_{side}_thumb", f"d_{side}_arm_lower", (wr[0] - sg * 5 * s, 10 * s, wr[2]), [rod((wr[0] - sg * 5 * s, 10 * s, wr[2]), (wr[0] - sg * 7 * s, 6 * s, wr[2] - 6 * s), 2 * s, 2 * s, "claw")])
            leg(g, f"d_{side}_leg", "d_All", (sg * 18 * s, 64 * s, 32 * s), 40 * s, s, 18, upper_len=28)
        tail = [(0, 64 * s, 46 * s), (0, 58 * s, 76 * s), (0, 50 * s, 106 * s), (0, 44 * s, 134 * s), (0, 40 * s, 160 * s), (0, 38 * s, 184 * s)]
        widths = [22, 17, 13, 9, 6]
        for i in range(5):
            g.bone(f"d_tail{i + 1}", "d_body" if i == 0 else f"d_tail{i}", tail[i], [rod(tail[i], tail[i + 1], widths[i] * s, widths[i] * s, "side", top="back", bottom="belly")])
        # costas: espinhos (Velzard escuros; Veldanava dourados e menores)
        spk = "spike"; hspk = 12 if name == "veldanava" else (9 if name == "velzard" else 5)
        for i, z in enumerate((-36, -20, -4, 12, 26)): g.add("d_upper_body" if z < -14 else "d_body", [rod((0, (88 if z < -14 else 80) * s, z * s), (0, (88 + hspk + (2 if i % 2 else 0)) * s if z < -14 else (80 + hspk) * s, (z + 6) * s), 3.5 * s, 7 * s, spk)])
        for i in range(1, 5): g.add(f"d_tail{i}", [rod((0, tail[i - 1][1] + widths[i - 1] * s * 0.45, tail[i - 1][2] + 6 * s), (0, tail[i - 1][1] + (widths[i - 1] * 0.45 + hspk * 0.7) * s, tail[i - 1][2] + 12 * s), 2.8 * s, 5 * s, spk)])
        # asas
        feathered = cfg.get("wings") == "feather"; crystal = False
        for side, sg in (("left", -1), ("right", 1)):
            wing(g, side, (sg * 12 * s, 92 * s, -24 * s), sg, cfg, scale=s * (1.35 if feathered else 1.0), feathered=feathered, crystal=crystal)
        if feathered:   # asas erguidas (pose de repouso apontando para cima, como na referência)
            for side, sg in (("left", -1), ("right", 1)): g.idx[f"d_{side}_wing_base"]["rotation"] = [0, 0, sg * 52]
        if False:   # (segundo par desativado)
            for side, sg in (("left", -1), ("right", 1)):
                b = (sg * 14 * s, 84 * s, -14 * s)
                g.bone(f"x_wing2_{side}", f"d_{side}_wing_base", b)
                g.idx[f"x_wing2_{side}"]["rotation"] = [0, 0, sg * -28]
                tmp = Geo(); tmp.bone("d_upper_body", None, (0, 0, 0)); wing(tmp, side, b, sg, cfg, scale=s * 0.62, pre="x2", feathered=True, small=True)
                for bb in tmp.bones[1:]:
                    if bb.get("parent") == "d_upper_body": bb["parent"] = f"x_wing2_{side}"
                    g.bones.append(bb); g.idx[bb["name"]] = bb
        # extras de cada dragão
        if name == "velzard":
            g.bone("x_cryst", "d_upper_body", (0, 90 * s, -30 * s), [rod((sg * 16 * s, 86 * s, -30 * s + k * 8 * s), (sg * (22 + k * 2) * s, (100 + k * 3) * s, (-26 + k * 8) * s), 4 * s, 4 * s, "acc1") for sg in (1, -1) for k in range(3)]
                   + [rod((0, 38 * s, 184 * s), (0, 44 * s, 196 * s), 6 * s, 6 * s, "acc1"), rod((0, 38 * s, 184 * s), (0, 32 * s, 194 * s), 4 * s, 4 * s, "acc3")])
            for k, nb in enumerate(("d_neck1", "d_neck2", "d_neck3")):   # juba azul caindo pelo pescoço
                p = g.idx[nb]["pivot"]
                g.bone(f"x_mane{k + 1}", nb, (0, p[1] + 6 * s, p[2] + 6 * s), [box((0, p[1] + 4 * s, p[2] + 8 * s), (16 * s - k * 3 * s, 18 * s, 6 * s), "mane")])
        for nb in ("d_neck1", "d_neck2", "d_neck3"):   # anéis de placas sob o pescoço
            pp = g.idx[nb]["pivot"]; g.add(nb, [box((0, pp[1] - 8 * s + k * 5 * s, pp[2] - 8 * s - k * 4 * s), (14 * s, 2.5 * s, 6 * s), "belly") for k in range(3)])
        g.add("d_body", [box((0, 52 * s, z * s), (22 * s, 2.5 * s, 5 * s), "belly") for z in range(-14, 30, 8)])
        if name == "veldanava":   # crista de escamas espinhosas ao longo do pescoço
            for nb in ("d_neck1", "d_neck2", "d_neck3"):
                pp = g.idx[nb]["pivot"]
                g.add(nb, [rod((0, pp[1] + 9 * s, pp[2] - 2 * s + k * 6 * s), (0, pp[1] + 22 * s, pp[2] + 6 * s + k * 6 * s), 4 * s, 9 * s, "spike") for k in range(2)])
    else:   # 6.93: SERPENTE oriental em espiral (Velzard / Velgrynd), ver coil_serpent()
        coil_serpent(g, name, cfg)
    # ---------- 6.88.1: mais detalhes
    if name == "velzard" and "x_cryst" in g.idx:   # mais cristais de gelo ao redor do corpo + 2 mechas extras na juba
        g.add("x_cryst", [rod((sg * (26 + k * 6) * s, 30 * s, (60 + k * 40) * s), (sg * (36 + k * 6) * s, (58 - k * 4) * s, (66 + k * 40) * s), (10 - k) * s, (10 - k) * s, "acc1" if k % 2 else "acc3") for sg in (1, -1) for k in range(4)])
        hp = g.idx["d_head"]["pivot"]
        for k, sg in ((4, -2), (5, 2)):
            p0 = (sg * 4 * s, hp[1] + 12 * s, hp[2] + 6 * s)
            g.bone(f"x_mane{k}", "d_head", p0, taper([p0, (sg * 9 * s, hp[1] + 18 * s, hp[2] + 30 * s), (sg * 14 * s, hp[1] + 10 * s, hp[2] + 56 * s), (sg * 18 * s, hp[1] - 2 * s, hp[2] + 80 * s)], 7 * s, 3 * s, "mane", hk=0.5))
    if name == "velgrynd":   # garras nas pontas das asas + lâminas/brasas no pescoço
        for side, sg in (("left", -1), ("right", 1)):
            for nb in ("top", "mid"):
                b_ = g.idx[f"d_{side}_wing_{nb}"]; pv = b_["pivot"]
                g.add(f"d_{side}_wing_{nb}", [rod(pv, (pv[0] + sg * 3 * s, pv[1] + 7 * s, pv[2] - 2 * s), 2.4 * s, 2.4 * s, "horn")])
        for nb in ("d_neck1", "d_neck2", "d_neck3"):
            pp = g.idx[nb]["pivot"]; g.add(nb, [rod((sg * 9 * s, pp[1] + 2 * s, pp[2]), (sg * 20 * s, pp[1] + 8 * s, pp[2] + 8 * s), 2.5 * s, 4 * s, "spike") for sg in (1, -1)])
    if name == "veldanava":   # leque de espinhos na ponta da cauda + espinhos-barbatana na mandíbula + penas extras nas asas
        tp = g.idx["d_tail5"]["pivot"]
        g.add("d_tail5", [rod((0, tp[1], tp[2] + 20 * s), (sg * 10 * s, tp[1] + 6 * s, tp[2] + 36 * s), 3 * s, 6 * s, "spike") for sg in (-1, 0, 1)])
        hp = g.idx["d_head"]["pivot"]
        g.add("d_lower_jaw", [rod((sg * 6 * s, hp[1] - 10 * s, hp[2] - 10 * s), (sg * 14 * s, hp[1] - 18 * s, hp[2] + 4 * s), 2.5 * s, 2.5 * s, "spike") for sg in (1, -1)])
        for side, sg in (("left", -1), ("right", 1)):
            pv = g.idx[f"d_{side}_wing_mid"]["pivot"]
            g.add(f"d_{side}_wing_mid", [box((pv[0] + sg * (10 + k * 10) * s, pv[1] - (70 + k * 6) * s, pv[2] + 2), (8 * s, 26 * s, 1.6), "wing") for k in range(4)])
    # forma verdadeira (só aparece com lform == true): coroa + anel de energia
    hp = g.idx["d_head"]["pivot"]
    crown = [rod((math.sin(a) * 9 * s, hp[1] + 12 * s, hp[2] - 2 * s + math.cos(a) * 9 * s), (math.sin(a) * 11 * s, hp[1] + 22 * s, hp[2] - 2 * s + math.cos(a) * 11 * s), 2.2 * s, 2.2 * s, "glow") for a in [k * 0.9 for k in range(7)]]
    g.bone("x_true", "d_head", (0, hp[1] + 12 * s, hp[2]), crown)
    ring_c = (0, 120 * s, 20 * s) if quad else (0, 90 * s, 10 * s)
    g.bone("x_true_halo", "x_true", ring_c, [rod((math.cos(a) * 34 * s, ring_c[1] + math.sin(a) * 34 * s, ring_c[2]), (math.cos(a + 0.4) * 34 * s, ring_c[1] + math.sin(a + 0.4) * 34 * s, ring_c[2]), 2.5 * s, 2.5 * s, "glow") for a in [k * 0.4 for k in range(16)]])
    # cristais/espinhos presos ao corpo mas espalhados pela cauda ficavam parados no ar quando a cauda ondula:
    # cada peça passa para o segmento da cauda (d_tail*/x_serp*) onde ela está
    chain = [b for b in g.bones if b["name"].startswith(("d_tail", "x_serp"))]
    for b in list(g.bones):
        if b["name"] != "x_cryst" or b.get("parent") not in ("d_body", "d_upper_body"): continue
        keep = []
        for c in b.get("cubes", []):
            cz = c["origin"][2] + c["size"][2] / 2
            seg = [t for t in chain if t["pivot"][2] <= cz]
            if not seg: keep.append(c); continue
            t = seg[-1]; nb = next((x for x in g.bones if x["name"] == f"x_cryst_{t['name']}"), None)
            if nb is None: nb = {"name": f"x_cryst_{t['name']}", "parent": t["name"], "pivot": list(t["pivot"]), "cubes": []}; g.bones.append(nb)
            nb["cubes"].append(c)
        b["cubes"] = keep
    return g

def write(name, cfg):
    g = build(name, cfg)
    ys = [c["origin"][1] + c["size"][1] for b in g.bones for c in b.get("cubes", [])]
    desc = lambda ident: {"identifier": ident, "texture_width": 512, "texture_height": 512, "visible_bounds_width": 30, "visible_bounds_height": 20, "visible_bounds_offset": [0, 6, 0]}
    for ident, fn in ((f"geometry.etheria_pdrg_{name}", f"etheria_pdrg_{name}"), (f"geometry.etheria_pdrg_{name}_boss", f"etheria_pdrg_{name}_boss")):
        json.dump({"format_version": "1.12.0", "minecraft:geometry": [{"description": desc(ident), "bones": g.bones}]}, open(os.path.join(RP, f"models/entity/{fn}.geo.json"), "w"), indent=1)
    atlas(name, cfg).save(os.path.join(RP, f"textures/entity/etheria_pdrg_{name}.png"))
    return len(g.bones), sum(len(b.get("cubes", [])) for b in g.bones)

# ------------------------------------------------------------------ animações de repouso + passada das patas dianteiras
def anims():
    ap = os.path.join(RP, "animations/etheria_pdrg_real.animation.json"); A = {}
    S = "math.sin(query.life_time"
    for name, cfg in DRAGONS.items():
        quad = cfg["plan"] == "quad"
        b = {"d_body": {"position": [0, f"{S} * 70) * 0.6", 0]}, "d_upper_body": {"rotation": [f"{S} * 70) * 1.2", 0, 0]},
             "d_neck1": {"rotation": [f"{S} * 70 - 30) * 2", f"{S} * 22) * 4", 0]}, "d_neck2": {"rotation": [f"{S} * 70 - 50) * 1.5", f"{S} * 22 - 30) * 4", 0]},
             "d_head": {"rotation": [f"{S} * 70 - 70) * 2", f"{S} * 18) * 8", 0]},
             "d_left_wing_base": {"rotation": [0, 0, f"(-8 + {S} * 60) * 3)" if quad else f"{S} * 120) * 10"]}, "d_right_wing_base": {"rotation": [0, 0, f"(8 - {S} * 60) * 3)" if quad else f"-{S} * 120) * 10"]}}
        for i in range(1, 6 if quad else 1): b[f"d_tail{i}"] = {"rotation": [f"{S} * 50 - {i * 20}) * {2 if quad else 5}", f"{S} * 40 - {i * 35}) * {4 + i * (2 if quad else 4)}", 0]}
        b["d_lower_jaw"] = {"rotation": [f"Math.max(0, {S} * 23) - 0.85) * 120", 0, 0]}   # abre a boca de vez em quando (respiro/rosnado)
        b["d_left_wing_top"] = {"rotation": [0, f"{S} * 80) * 3", f"{S} * 80 - 40) * 2"]}; b["d_right_wing_top"] = {"rotation": [0, f"-{S} * 80) * 3", f"-{S} * 80 - 40) * 2"]}
        if False:   # (6.93: ondulação das serpentes em etheria_pdrg_serpent.animation.json)
            for i in range(1, 7): b[f"x_serp{i}"] = {"rotation": [f"{S} * 45 - {i * 40}) * 6", f"{S} * 35 - {i * 45}) * 10", 0]}
        for k in range(1, 6): b[f"x_mane{k}"] = {"rotation": [f"{S} * 90 - {k * 30}) * 6", f"{S} * 60 - {k * 50}) * 8", 0]}
        A[f"animation.etheria_pdrg_{name}.idle"] = {"loop": True, "bones": b}
        mv = "Math.min(1,query.modified_move_speed)"; ph = "(query.modified_distance_moved*24)"
        if quad:
            A[f"animation.etheria_pdrg_{name}.gait"] = {"loop": True, "bones": {
                "d_left_arm": {"rotation": [f"-Math.cos({ph})*16*{mv}", 0, 0]}, "d_right_arm": {"rotation": [f"Math.cos({ph})*16*{mv}", 0, 0]},
                "d_left_arm_lower": {"rotation": [f"Math.max(0,-Math.sin({ph}))*-22*{mv}", 0, 0]}, "d_right_arm_lower": {"rotation": [f"Math.max(0,Math.sin({ph}))*-22*{mv}", 0, 0]}}}
        else:
            A[f"animation.etheria_pdrg_{name}.gait"] = {"loop": True, "bones": {**{f"d_tail{i}": {"rotation": [0, f"Math.sin({ph} - {i * 40})*{8 + i * 2}*{mv}", 0]} for i in range(1, 6)},
                "d_body": {"rotation": [0, f"Math.sin({ph})*6*{mv}", 0]}, "d_left_arm": {"rotation": [f"-Math.cos({ph})*22*{mv}", 0, 0]}, "d_right_arm": {"rotation": [f"Math.cos({ph})*22*{mv}", 0, 0]}}}
    json.dump({"format_version": "1.8.0", "animations": A}, open(ap, "w"), indent=1)
    # remove as versões antigas destes três do arquivo comum (a de Veldora continua lá)
    op = os.path.join(RP, "animations/etheria_pdrg.animation.json"); O = json.load(open(op))
    for name in DRAGONS: O["animations"].pop(f"animation.etheria_pdrg_{name}.idle", None)
    json.dump(O, open(op, "w"), indent=1)

def wire():
    pe = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(pe)); D = E["minecraft:client_entity"]["description"]
    for name in DRAGONS:
        D["textures"][f"drg_{name}"] = f"textures/entity/etheria_pdrg_{name}"; D["textures"][f"drg_{name}_boss"] = f"textures/entity/etheria_pdrg_{name}"
        D["animations"][f"drg_gait_{name}"] = f"animation.etheria_pdrg_{name}.gait"
    an = [x for x in D["scripts"]["animate"] if not (isinstance(x, dict) and any(k.startswith("drg_gait_") for k in x))]
    for name in DRAGONS:
        an.append({f"drg_gait_{name}": f"query.property('etheria:lin') == '{name}' && (query.property('etheria:lform') == 'true' || query.property('etheria:lform') == 'draconic') && query.is_on_ground && query.modified_move_speed > 0.05"})
    D["scripts"]["animate"] = an
    open(pe, "w").write(json.dumps(E, indent=1, ensure_ascii=False) + "\n")

if __name__ == "__main__":
    for name, cfg in DRAGONS.items(): print(name, "ossos/cubos:", write(name, cfg))
    anims(); wire()
    import anim_time_fix, serpent_float   # noqa: E401  (anim_time_fix roda ao importar)
    serpent_float.main(); print("ok")

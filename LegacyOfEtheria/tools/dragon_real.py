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
    else:   # SERPENTE (Velzard / Velgrynd): corpo longuíssimo e grosso, patas curtas, cabeça grande
        vz = name == "velzard"
        p = [(0, 46 * s, 40 * s), (0, 52 * s, 6 * s), (0, 64 * s, -26 * s)]
        g.bone("d_body", "d_All", p[0], [rod(p[0], p[1], 30 * s, 30 * s, "side", top="back", bottom="belly")])
        g.bone("d_upper_body", "d_body", p[1], [rod(p[1], p[2], 28 * s, 28 * s, "side", top="back", bottom="belly")])
        n0, n1, n2, n3 = p[2], (0, 82 * s, -46 * s), (0, 100 * s, -56 * s), (0, 114 * s, -60 * s)
        g.bone("d_neck1", "d_upper_body", n0, [rod(n0, n1, 25 * s, 25 * s, "side", top="back", bottom="belly")])
        g.bone("d_neck2", "d_neck1", n1, [rod(n1, n2, 22 * s, 22 * s, "side", top="back", bottom="belly")])
        g.bone("d_neck3", "d_neck2", n2, [rod(n2, n3, 20 * s, 20 * s, "side", top="back", bottom="belly")])
        head(g, cfg, (0, n3[1] + 2 * s, n3[2] - 2 * s), s * 1.25, name)
        for side, sg in (("left", 1), ("right", -1)):   # patas curtas com garras
            sh = (sg * 14 * s, 58 * s, -18 * s); elbow = (sg * 20 * s, 34 * s, -22 * s); wr = (sg * 21 * s, 10 * s, -20 * s)
            g.bone(f"d_{side}_arm", "d_upper_body", sh, [rod(sh, elbow, 10 * s, 11 * s, "side", top="back", bottom="belly")])
            g.bone(f"d_{side}_arm_lower", f"d_{side}_arm", elbow, [rod(elbow, wr, 8 * s, 9 * s, "side", top="back", bottom="belly")])
            g.bone(f"d_{side}_hand", f"d_{side}_arm_lower", wr, [box((wr[0], 3 * s, wr[2] - 4 * s), (11 * s, 6 * s, 12 * s), "side", top="back")])
            g.bone(f"d_{side}_hand_lower", f"d_{side}_hand", (wr[0], 3 * s, wr[2] - 9 * s), [rod((wr[0] + k * 3.4 * s, 2.5 * s, wr[2] - 9 * s), (wr[0] + k * 4 * s, 0.4, wr[2] - 16 * s), 2 * s, 2.2 * s, "claw") for k in (-1, 0, 1)])
            g.bone(f"d_{side}_thumb", f"d_{side}_arm_lower", (wr[0], 8 * s, wr[2]), [])
            leg(g, f"d_{side}_leg", "d_All", (sg * 13 * s, 46 * s, 30 * s), 30 * s, s, 13, upper_len=20)
        pts = [(0, 46 * s, 40 * s)]
        for i in range(11): pts.append((math.sin(i * 0.8) * 26 * s, max(14, 44 + 30 * math.sin(i * 0.7 + 0.9) - i * 1.8) * s, (40 + (i + 1) * 26) * s))
        names = [f"d_tail{i}" for i in range(1, 6)] + [f"x_serp{i}" for i in range(1, 7)]
        for i, nm in enumerate(names):
            w = max(7, 30 - i * 2.2) * s
            par = "d_body" if i == 0 else names[i - 1]
            cs = [rod(pts[i], pts[i + 1], w, w, "side", top="back", bottom="belly")]
            mid = [(pts[i][k] + pts[i + 1][k]) / 2 for k in range(3)]
            cs += [box((mid[0], mid[1] - w * 0.5 + 1, mid[2] + o_ * 7 * s), (w * 0.75, 2.5 * s, 4 * s), "belly") for o_ in (-1, 0, 1)]   # anéis da barriga
            if vz:   # espinhos triangulares escuros: topo + laterais alternadas
                k_ = max(0.45, 1 - i * 0.06)
                cs.append(rod((pts[i][0], pts[i][1] + w * 0.4, pts[i][2] + 6 * s), (pts[i][0], pts[i][1] + w * 0.4 + 22 * s * k_, pts[i][2] + 20 * s), 13 * s * k_, 13 * s * k_, "spike"))
                cs.append(rod((pts[i][0], pts[i][1] + w * 0.4 + 10 * s * k_, pts[i][2] + 13 * s), (pts[i][0], pts[i][1] + w * 0.4 + 26 * s * k_, pts[i][2] + 24 * s), 6 * s * k_, 6 * s * k_, "spike"))
                sd = 1 if i % 2 else -1
                cs.append(rod((pts[i][0] + sd * w * 0.45, pts[i][1] + w * 0.1, pts[i][2] + 14 * s), (pts[i][0] + sd * (w * 0.45 + 16 * s), pts[i][1] + 6 * s, pts[i][2] + 22 * s), 9 * s, 9 * s, "spike"))
            else:    # placas vermelhas nas costas + lâminas claras
                cs.append(rod((pts[i][0], pts[i][1] + w * 0.5, pts[i][2] + 4 * s), (pts[i][0], pts[i][1] + w * 0.5 + 6 * s, pts[i][2] + 18 * s), w * 0.8, 3 * s, "acc1"))
                if i % 2 == 0:
                    for sd in (1, -1): cs.append(rod((pts[i][0] + sd * w * 0.45, pts[i][1], pts[i][2] + 10 * s), (pts[i][0] + sd * (w * 0.45 + 12 * s), pts[i][1] + 6 * s, pts[i][2] + 18 * s), 2.5 * s, 4 * s, "spike"))
            if i == len(names) - 1: cs += [rod(pts[-1], (pts[-1][0], pts[-1][1] + 10 * s, pts[-1][2] + 18 * s), 9 * s, 4 * s, "acc1" if not vz else "acc1"), rod(pts[-1], (pts[-1][0], pts[-1][1] - 6 * s, pts[-1][2] + 18 * s), 9 * s, 4 * s, "acc1")]
            g.bone(nm, par, pts[i], cs)
        for nb in ("d_upper_body", "d_neck1", "d_neck2"):   # espinhos/placas também no pescoço
            pp = g.idx[nb]["pivot"]
            g.add(nb, [rod((0, pp[1] + 12 * s, pp[2] - 6 * s), (0, pp[1] + (24 if vz else 18) * s, pp[2] + 4 * s), (7 if vz else 14) * s, (7 if vz else 3) * s, "spike" if vz else "acc1")])
        if vz:   # cristais de gelo no lugar das asas (ossos de asa -> aglomerados de cristal) + cristais extras
            for side, sg in (("left", -1), ("right", 1)):
                b0 = (sg * 12 * s, 70 * s, -16 * s); t = (sg * 24 * s, 86 * s, -10 * s); m = (sg * 36 * s, 96 * s, -2 * s); l = (sg * 44 * s, 90 * s, 6 * s)
                cr = lambda q, h, w: rod(q, (q[0] + sg * w, q[1] + h, q[2] + 2 * s), 7 * s, 7 * s, "acc1")
                g.bone(f"d_{side}_wing_base", "d_upper_body", b0, [cr(b0, 18 * s, 6 * s)])
                g.bone(f"d_{side}_wing_top", f"d_{side}_wing_base", t, [cr(t, 26 * s, 10 * s), rod(t, (t[0] + sg * 4 * s, t[1] + 16 * s, t[2] + 8 * s), 5 * s, 5 * s, "acc3")])
                g.bone(f"d_{side}_wing_mid", f"d_{side}_wing_top", m, [cr(m, 22 * s, 12 * s)])
                g.bone(f"d_{side}_wing_low", f"d_{side}_wing_mid", l, [cr(l, 14 * s, 10 * s)])
            g.bone("x_cryst", "d_body", (0, 60 * s, 20 * s), [rod((sg * 20 * s, 50 * s, z * s), (sg * 34 * s, 74 * s, (z + 6) * s), 8 * s, 8 * s, "acc1") for sg in (1, -1) for z in (10, 40)])
        else:    # Velgrynd: asas VERMELHAS de morcego
            for side, sg in (("left", -1), ("right", 1)):
                wing(g, side, (sg * 12 * s, 72 * s, -20 * s), sg, cfg, scale=s * 0.9)
    # ---------- 6.88.1: mais detalhes
    if name == "velzard":   # mais cristais de gelo ao redor do corpo + 2 mechas extras na juba
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
        for i in range(1, 6): b[f"d_tail{i}"] = {"rotation": [f"{S} * 50 - {i * 20}) * {2 if quad else 5}", f"{S} * 40 - {i * 35}) * {4 + i * (2 if quad else 4)}", 0]}
        b["d_lower_jaw"] = {"rotation": [f"Math.max(0, {S} * 23) - 0.85) * 120", 0, 0]}   # abre a boca de vez em quando (respiro/rosnado)
        b["d_left_wing_top"] = {"rotation": [0, f"{S} * 80) * 3", f"{S} * 80 - 40) * 2"]}; b["d_right_wing_top"] = {"rotation": [0, f"-{S} * 80) * 3", f"-{S} * 80 - 40) * 2"]}
        if not quad:   # corpo inteiro ondulando como serpente (segmentos extras)
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
    anims(); wire(); print("ok")

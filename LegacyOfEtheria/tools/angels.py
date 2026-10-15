# 6.45 - ANJOS REMODELADOS (referências enviadas pelo jogador: Garasha, Pico, Obera, Zalario, Dino).
# Cada anjo: a skin atual (do pacote do jogador) continua sendo a base do corpo; por cima o gerador constrói peças 3D próprias:
#   asas articuladas (ombro -> braço -> antebraço -> mão, com penas separadas: coberteiras, secundárias e primárias),
#   volume de cabelo (mechas, rabo-de-cavalo, cabelo longo), armadura (ombreiras, grevas, corselete), capa/abas do casaco e arma na mão.
# Textura final 128x128: skin 64x64 no canto + atlas de materiais desenhados aqui (metal com brilho, tecido, cabelo com fios, penas com raque).
# Garasha não existia no addon: a skin base dela é desenhada aqui a partir da referência (cabelo rosa, corselete dourado, armadura prateada).
# Saída: RP textures/entity/etheria_<id>.png, models/entity/etheria_<id>_skin.geo.json, animations/etheria_angels.animation.json
import json, os, math, random
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
TW = TH = 256

# ---------------------------------------------------------------- cores
def hexc(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (c[3] if len(c) > 3 else 255,)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)

# ---------------------------------------------------------------- atlas de materiais
class Atlas:
    """aloca blocos no espaço livre da textura 128x128 (fora da skin 64x64 do canto)"""
    def __init__(s, img):
        s.img = img; s.d = ImageDraw.Draw(img); s.slots = {}
        s.free16 = [(x, y) for y in range(0, 256, 16) for x in range(64, 256, 16)]          # lado direito: blocos 16x16
        s.free_f = [(x, y) for y in (64, 128, 192) for x in range(0, 64, 16)]                  # embaixo à esquerda: 12 penas 16x64
    def tile(s, name, painter):
        if name not in s.slots:
            x, y = s.free16.pop(0); painter(s.img, x, y, 16, 16); s.slots[name] = (x, y, 16, 16)
        return s.slots[name]
    def feather(s, name, painter):
        if name not in s.slots:
            x, y = s.free_f.pop(0); painter(s.img, x, y, 16, 64); s.slots[name] = (x, y, 16, 64)
        return s.slots[name]

def p_metal(base, trim=None, tw=0):
    def f(img, x, y, w, h):
        px = img.load()
        for j in range(h):
            for i in range(w):
                t = j / (h - 1); c = shade(base, 1.18 - 0.38 * t)                     # brilho no alto, sombra embaixo
                if abs(i - j * 0.6 - 3) < 1.2: c = shade(base, 1.45)                   # reflexo diagonal
                px[x + i, y + j] = c
        if trim:
            for j in range(h):
                for i in range(w):
                    if i < tw or j < tw or i >= w - tw or j >= h - tw: px[x + i, y + j] = shade(trim, 1.15 - 0.25 * (j / h))
        for i in range(w): px[x + i, y + h - 1] = shade(trim or base, 0.55)          # contorno inferior
    return f
def p_cloth(base, trim=None, tw=0, fold=True):
    def f(img, x, y, w, h):
        px = img.load(); rnd = random.Random(hash(base) & 0xffff)
        for j in range(h):
            for i in range(w):
                k = 1.0 + (0.08 if fold and i % 4 == 1 else 0) - (0.1 if fold and i % 4 == 3 else 0) + rnd.uniform(-0.03, 0.03)
                px[x + i, y + j] = shade(base, k * (1.06 - 0.16 * j / h))
        if trim:
            for j in range(h):
                for i in range(w):
                    if i < tw or i >= w - tw or j >= h - tw: px[x + i, y + j] = shade(trim, 1.1 - 0.2 * (j / h))
    return f
def p_hair(base):
    def f(img, x, y, w, h):
        px = img.load(); rnd = random.Random(sum(base[:3]))
        for i in range(w):
            k0 = rnd.uniform(0.82, 1.15)
            for j in range(h):
                k = k0 * (1.12 - 0.3 * j / h)
                if i % 3 == 0: k *= 0.8                                                    # separação dos fios
                if j < 3 and i % 3 == 1: k *= 1.25                                         # brilho do topo
                px[x + i, y + j] = shade(base, k)
    return f
def p_skin(base):
    def f(img, x, y, w, h):
        px = img.load()
        for j in range(h):
            for i in range(w): px[x + i, y + j] = shade(base, 1.04 - 0.12 * j / h)
    return f
def p_blade(steel, edge):
    def f(img, x, y, w, h):
        px = img.load()
        for j in range(h):
            for i in range(w):
                c = shade(steel, 1.15 - 0.25 * j / h)
                if i in (0, w - 1): c = shade(edge, 1.25)
                if i == w // 2: c = shade(steel, 0.8)                                     # sulco central
                px[x + i, y + j] = c
    return f
def p_feather(base, tip, edge=None, shaft=None, mid=None, round_tip=True):
    """pena 16x64: raque central clara que afina, barbas diagonais, degradê base->meio->ponta, bordo de ataque mais estreito,
    contorno de destaque (edge) e ponta arredondada; transparente fora do contorno"""
    mid = mid or mix(base, tip, 0.5)
    def f(img, x, y, w, h):
        px = img.load(); cx = (w - 1) * 0.42
        for j in range(h):
            t = j / (h - 1)
            prof = math.sin(min(1.0, t / 0.18) * math.pi / 2)                       # alarga perto da base
            if t > 0.78: prof *= max(0.0, 1 - ((t - 0.78) / 0.22) ** (1.6 if round_tip else 1.0))
            lw, rw = (cx + 0.5) * prof, (w - 1 - cx + 0.5) * prof                    # bordo de ataque (esq.) mais estreito
            col = mix(base, mid, t / 0.55) if t < 0.55 else mix(mid, tip, (t - 0.55) / 0.45)
            for i in range(w):
                dx = i - cx
                if dx < -lw or dx > rw: px[x + i, y + j] = (0, 0, 0, 0); continue
                c = col
                if (j * 2 + int(abs(dx) * 3)) % 6 == 0: c = shade(c, 0.86)              # barbas diagonais
                if (j * 2 + int(abs(dx) * 3)) % 6 == 3: c = shade(c, 1.07)
                d_edge = min(dx + lw, rw - dx)
                if d_edge < 1.0: c = shade(edge, 1.0) if edge else shade(c, 0.72)       # contorno
                elif d_edge < 2.0 and edge: c = mix(c, edge, 0.35)
                if abs(dx) < 0.55 + 0.6 * (1 - t): c = shade(shaft or mix(base, (255, 255, 255, 255), 0.45), 1.15 - 0.2 * t)   # raque que afina
                px[x + i, y + j] = c
    return f

# ---------------------------------------------------------------- geometria
def faces_tile(t, size):
    x, y, w, h = t; sx, sy, sz = [max(0.01, abs(v)) for v in size]
    def r(a, b): return {"uv": [x, y], "uv_size": [max(1, min(w, round(a))), max(1, min(h, round(b)))]}
    return {"north": r(sx, sy), "south": r(sx, sy), "east": r(sz, sy), "west": r(sz, sy), "up": r(sx, sz), "down": r(sx, sz)}
def faces_feather(t, size):
    x, y, w, h = t
    f = {"uv": [x, y], "uv_size": [w, h]}; edge = {"uv": [x + w // 2, y], "uv_size": [1, h]}; cap = {"uv": [x + w // 2, y], "uv_size": [1, 1]}
    return {"north": f, "south": {"uv": [x + w, y], "uv_size": [-w, h]}, "east": edge, "west": edge, "up": cap, "down": cap}
class Geo:
    def __init__(s, gid): s.gid = gid; s.bones = []; s.idx = {}
    def bone(s, name, pivot, parent=None, rot=None):
        b = {"name": name, "pivot": [round(v, 3) for v in pivot]}
        if parent: b["parent"] = parent
        if rot: b["rotation"] = [round(v, 3) for v in rot]
        b["cubes"] = []; s.bones.append(b); s.idx[name] = b; return b
    def cube(s, bone, origin, size, uv, rot=None, pivot=None, inflate=None):
        c = {"origin": [round(v, 3) for v in origin], "size": [round(v, 3) for v in size], "uv": uv}
        if rot: c["rotation"] = [round(v, 3) for v in rot]; c["pivot"] = [round(v, 3) for v in (pivot or origin)]
        if inflate: c["inflate"] = inflate
        s.idx[bone]["cubes"].append(c)
    def json(s):
        for b in s.bones:
            if not b["cubes"]: del b["cubes"]
        return {"format_version": "1.16.0", "minecraft:geometry": [{"description": {"identifier": s.gid, "texture_width": TW, "texture_height": TH,
                "visible_bounds_width": 5, "visible_bounds_height": 4, "visible_bounds_offset": [0, 1.5, 0]}, "bones": s.bones}]}

def base_body(g, slim=False):
    """humanoide padrão (skin 64x64 + camada externa); mesmos nomes de ossos das animações do jogo e do combate dos chefes"""
    aw = 3 if slim else 4
    g.bone("root", [0, 0, 0])
    g.bone("body", [0, 24, 0], "root"); g.bone("head", [0, 24, 0], "body")
    g.bone("rightArm", [-5, 22, 0], "body"); g.bone("leftArm", [5, 22, 0], "body")
    g.bone("rightLeg", [-1.9, 12, 0], "root"); g.bone("leftLeg", [1.9, 12, 0], "root")
    g.cube("head", [-4, 24, -4], [8, 8, 8], [0, 0]); g.cube("head", [-4, 24, -4], [8, 8, 8], [32, 0], inflate=0.5)
    g.cube("body", [-4, 12, -2], [8, 12, 4], [16, 16]); g.cube("body", [-4, 12, -2], [8, 12, 4], [16, 32], inflate=0.25)
    g.cube("rightArm", [-4 - aw, 12, -2], [aw, 12, 4], [40, 16]); g.cube("rightArm", [-4 - aw, 12, -2], [aw, 12, 4], [40, 32], inflate=0.25)
    g.cube("leftArm", [4, 12, -2], [aw, 12, 4], [32, 48]); g.cube("leftArm", [4, 12, -2], [aw, 12, 4], [48, 48], inflate=0.25)
    g.cube("rightLeg", [-3.9, 0, -2], [4, 12, 4], [0, 16]); g.cube("rightLeg", [-3.9, 0, -2], [4, 12, 4], [0, 32], inflate=0.25)
    g.cube("leftLeg", [-0.1, 0, -2], [4, 12, 4], [16, 48]); g.cube("leftLeg", [-0.1, 0, -2], [4, 12, 4], [0, 48], inflate=0.25)

def wings(g, A, feat_cov, feat_sec, feat_pri, bar, span=1.0, alt=None, small=None, pre="wing", root_rot=(-8, -34, 26), y0=21.5, parent="body"):
    """asa esquerda (+X) e direita (-X, espelhada). Ossos: wing_<l|r> (ombro) -> wingA (braço) -> wingB (antebraço) -> wingC (mão) -> alula.
    Penas em camadas sobrepostas (pequenas coberteiras, grandes coberteiras, secundárias, primárias abertas como dedos);
    pose de descanso em arco acima dos ombros. alt = pena alternada (duas cores)."""
    small = small or feat_cov
    T = 0.22                                                                        # espessura das penas (placas finas, dupla face)
    for side, sg in (("l", 1), ("r", -1)):
        X = lambda v: v * sg
        def box(bone, x0, yy, z0, w, h, d, uv, rot=None, piv=None):
            g.cube(bone, [X(x0) if sg > 0 else X(x0 + w), yy + dy_, z0], [w, h, d], uv, rot=[rot[0], X(rot[1]), X(rot[2])] if rot else None, pivot=[X(piv[0]), piv[1] + dy_, piv[2]] if piv else None)
        L1, L2, L3 = 6 * span, 8 * span, 7.5 * span
        dy_ = y0 - 21.5                                                                 # pares extras (serafim/querubim): mesma asa, mais baixa
        g.bone(f"{pre}_{side}", [X(1.2), y0, 2.2], parent, [root_rot[0], X(root_rot[1]), X(root_rot[2])])
        a = g.bone(f"{pre}A_{side}", [X(1.2), y0, 2.6], f"{pre}_{side}")["name"]
        x0, x1 = 1.2, 1.2 + L1
        box(a, x0, 20.7, 2.2, L1, 1.6, 1.1, faces_tile(bar, [L1, 1.6, 1.1]))
        for k in range(int(L1 / 1.1)):                                                  # pequenas coberteiras (escamadas, 2 fileiras)
            fx = x0 + 0.2 + k * 1.1
            box(a, fx, 18.2, 3.05, 1.7, 3.0, T, faces_feather(small, [1.7, 3, T]), rot=[6, 0, -4], piv=[fx + 0.85, 21, 3])
            box(a, fx + 0.5, 16.2, 2.95, 1.9, 4.2, T, faces_feather(feat_cov, [1.9, 4.2, T]), rot=[6, 0, -6], piv=[fx + 1.4, 20, 3])
        for k in range(int(L1 / 1.6)):                                                  # terciárias (perto do corpo)
            fx = x0 + 0.3 + k * 1.6; ln = 9 + k * 0.6
            box(a, fx, 21 - ln, 2.65, 2.4, ln, T, faces_feather(feat_sec, [2.4, ln, T]), rot=[10, 0, -2 - k * 2], piv=[fx + 1.2, 21, 2.7])
        b = g.bone(f"{pre}B_{side}", [X(x1), y0, 2.6], a, [0, 0, X(-22)])["name"]
        x2 = x1 + L2
        box(b, x1, 20.8, 2.25, L2, 1.4, 1.0, faces_tile(bar, [L2, 1.4, 1.0]))
        for k in range(int(L2 / 1.2)):
            fx = x1 + 0.1 + k * 1.2
            box(b, fx, 18.4, 3.0, 1.6, 2.8, T, faces_feather(small, [1.6, 2.8, T]), rot=[6, 0, -4], piv=[fx + 0.8, 21, 3])
            box(b, fx + 0.3, 16.0, 2.9, 1.9, 4.6, T, faces_feather(feat_cov if not alt or k % 2 == 0 else alt, [1.9, 4.6, T]), rot=[6, 0, -6], piv=[fx + 1.2, 20.5, 3])
        n2 = int(L2 / 1.35)
        for k in range(n2):                                                             # secundárias (fileira longa e regular)
            fx = x1 + 0.15 + k * 1.35; ln = 12.5 + k * 0.35; t = feat_sec if not alt or k % 2 == 0 else alt
            box(b, fx, 21 - ln, 2.6 - 0.02 * k, 2.5, ln, T, faces_feather(t, [2.5, ln, T]), rot=[9, 0, -3 - k * 1.2], piv=[fx + 1.25, 21, 2.6])
        c = g.bone(f"{pre}C_{side}", [X(x2), y0, 2.6], b, [0, 0, X(-26)])["name"]
        x3 = x2 + L3
        box(c, x2, 20.9, 2.3, L3, 1.2, 0.9, faces_tile(bar, [L3, 1.2, 0.9]))
        for k in range(int(L3 / 1.3)):
            fx = x2 + 0.1 + k * 1.3
            box(c, fx, 18.6, 2.95, 1.6, 2.6, T, faces_feather(small, [1.6, 2.6, T]), rot=[6, 0, -4], piv=[fx + 0.8, 21, 3])
        for k in range(8):                                                              # primárias abertas em leque ("dedos")
            fx = x2 + 0.4 + k * 0.9; ln = 15.5 + k * 1.15; ang = -4 - k * 7.5; t = feat_pri if not alt or k % 2 == 1 else alt
            box(c, fx, 21.3 - ln, 2.5 - 0.03 * k, 2.6, ln, T, faces_feather(t, [2.6, ln, T]), rot=[7, 0, ang], piv=[fx + 1.3, 21.3, 2.5])
        al = g.bone(f"{pre}Al_{side}", [X(x2), y0 + 0.3, 2.8], c, [0, 0, X(-35)])["name"]       # álula
        for k in range(2):
            box(al, x2 - 0.2 + k * 0.8, 21.6, 2.85, 1.4, 4 + k, T, faces_feather(small, [1.4, 4 + k, T]), rot=[0, 0, -70 - k * 10], piv=[x2 + 0.5, 21.8, 2.9])

# ---------------------------------------------------------------- skin base da Garasha (referência: cabelo rosa/vermelho longo, corselete dourado,
# ombreiras escuras, braço com manopla dourada, calça preta, grevas e botas prateadas, tabardo branco na frente)
def garasha_skin():
    im = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); px = im.load()
    SK = hexc("#e9b896"); HA = hexc("#d8284c"); HAd = shade(HA, 0.7); EY = hexc("#9a9aa6"); GD = hexc("#e2b83a"); BK = hexc("#22202a"); SV = hexc("#c8ccd4"); WT = hexc("#ece8e0")
    def rect(x, y, w, h, c, k0=1.0, k1=1.0):
        for j in range(h):
            for i in range(w): px[x + i, y + j] = shade(c, k0 + (k1 - k0) * (j / max(1, h - 1)))
    # cabeça: topo/laterais/trás de cabelo, frente com rosto
    rect(8, 0, 8, 8, HA, 1.1, 0.95); rect(16, 0, 8, 8, HAd)                                   # topo / baixo
    for fx in (0, 16, 24): rect(fx, 8, 8, 8, HA, 1.05, 0.85)                                 # direita, esquerda, trás
    rect(8, 8, 8, 8, SK)                                                                      # rosto
    rect(8, 8, 8, 2, HA, 1.1, 1.0); px[8, 10] = HA; px[15, 10] = HA; px[8, 11] = HAd; px[15, 11] = HAd   # franja e laterais
    for (ex, c) in ((10, EY), (13, EY)): px[ex, 12] = shade(c, 1.2); px[ex, 13] = shade(c, 0.7)
    px[11, 12] = WT; px[12, 12] = WT if False else SK
    px[11, 15] = shade(SK, 0.8); px[12, 15] = shade(SK, 0.8)                                  # boca
    for i in range(8): px[8 + i, 9] = shade(HA, 0.9)
    # camada externa da cabeça: mechas soltas
    for i in range(8):
        px[40 + i, 8] = HA; px[56 + i, 8 + (i % 3)] = HA
    for j in range(8): px[32, 8 + j] = HA; px[48 + 7, 8 + j] = HA
    # corpo: corselete dourado com cordão, ombros escuros, tabardo branco na cintura
    rect(20, 20, 8, 12, GD, 1.15, 0.85); rect(20, 20, 8, 3, BK)
    for j in range(23, 31, 2): px[23, j] = shade(GD, 0.6); px[24, j] = shade(GD, 0.6)
    rect(20, 29, 8, 3, WT); rect(32, 20, 8, 12, shade(GD, 0.8), 1.0, 0.8); rect(32, 20, 8, 3, BK)   # costas
    rect(16, 20, 4, 12, shade(GD, 0.75)); rect(28, 20, 4, 12, shade(GD, 0.75)); rect(20, 16, 8, 4, BK); rect(28, 16, 8, 4, BK)
    # braços: ombro escuro, braço de pele, manopla dourada
    for (ax, ay) in ((40, 16), (32, 48)):
        rect(ax + 4, ay, 4, 4, BK); rect(ax + 8, ay, 4, 4, GD)
        for fx in range(0, 16, 4): rect(ax + fx, ay + 4, 4, 4, BK); rect(ax + fx, ay + 8, 4, 4, SK); rect(ax + fx, ay + 12, 4, 4, GD, 1.1, 0.8)
    # pernas: calça preta e greva prateada
    for (lx, ly) in ((0, 16), (16, 48)):
        rect(lx + 4, ly, 4, 4, BK); rect(lx + 8, ly, 4, 4, SV)
        for fx in range(0, 16, 4): rect(lx + fx, ly + 4, 4, 5, BK, 1.0, 0.8); rect(lx + fx, ly + 9, 4, 7, SV, 1.2, 0.85)
    return im

# ---------------------------------------------------------------- cada anjo
ANGELS = {
  "garasha": {"skin": None, "hair": "#d8284c", "wing": ("#2a2632", "#16141c", "#0e0d12"), "wedge": "#c9a23a", "bar": "#24212a", "metal": "#c8ccd4", "trim": "#e2b83a", "cloth": "#22202a", "accent": "#ece8e0",
              "hairstyle": "long", "armor": ["pauldrons", "greaves", "tabard", "shield"], "weapon": "sword", "span": 1.0},
  "pico":    {"hair": "#f2d45a", "wing": ("#3a3446", "#1c1a24", "#0f0e14"), "wedge": "#5a5068", "bar": "#1e1b24", "metal": "#d8d8e4", "trim": "#e4c25a", "cloth": "#b28ad8", "accent": "#f0f0f6",
              "hairstyle": "twintails", "armor": ["coat_tails"], "weapon": "spear", "span": 0.92},
  "obera":   {"hair": "#16141c", "wing": None, "metal": "#eef0f6", "trim": "#e2b83a", "cloth": "#7a4ab8", "accent": "#eef0f6",
              "hairstyle": "long", "armor": ["pauldrons", "greaves", "cape"], "weapon": None},
  "zalario": {"hair": "#16141c", "wing": ("#ffffff", "#eef0f8", "#d8dcec"), "wedge": "#e8c860", "bar": "#e4e4f0", "metal": "#4a2a6a", "trim": "#e2b83a", "cloth": "#f2f2f6", "accent": "#e2b83a",
              "hairstyle": "long", "armor": ["pauldrons", "greaves", "sash"], "weapon": None, "span": 1.05},
  "dino":    {"hair": "#dfe2ea", "wing": ("#f4f4f8", "#c8c8d4", "#8a8696"), "wedge": "#3a3640", "bar": "#2e2a34", "metal": "#2a2630", "trim": "#d9b440", "cloth": "#1c1a22", "accent": "#a8232c",
              "hairstyle": "spiky", "armor": ["coat_tails", "collar"], "weapon": "sword", "span": 1.0, "alt": "#2a2632"},
}

def build(aid, A):
    src = os.path.join(RP, f"textures/entity/etheria_{aid}.png")
    skin = garasha_skin() if aid == "garasha" else Image.open(os.path.join(os.path.dirname(__file__), "angel_src", f"{aid}.png") if os.path.exists(os.path.join(os.path.dirname(__file__), "angel_src", f"{aid}.png")) else src).convert("RGBA").crop((0, 0, 64, 64))
    img = Image.new("RGBA", (TW, TH), (0, 0, 0, 0)); img.paste(skin, (0, 0))
    at = Atlas(img)
    H = hexc(A["hair"]); M = hexc(A["metal"]); T = hexc(A["trim"]); C = hexc(A["cloth"]); AC = hexc(A["accent"])
    hair = at.tile("hair", p_hair(H)); metal = at.tile("metal", p_metal(M, T, 2)); metal_plain = at.tile("metal2", p_metal(M))
    cloth = at.tile("cloth", p_cloth(C, T, 1)); cloth_plain = at.tile("cloth2", p_cloth(C)); accent = at.tile("accent", p_cloth(AC, T, 1, fold=False))
    g = Geo(f"geometry.etheria_{aid}_skin"); base_body(g)
    # ---- cabelo
    st = A["hairstyle"]
    if st == "long":
        g.bone("hair_back", [0, 25, 4], "head")
        g.cube("hair_back", [-4.5, 13, 3.6], [9, 12, 1.4], faces_tile(hair, [9, 12, 1.4]))
        g.cube("hair_back", [-4.2, 9.5, 3.9], [8.4, 4, 1.0], faces_tile(hair, [8.4, 4, 1.0]), rot=[8, 0, 0], pivot=[0, 13, 4])
        for sx in (-4.6, 3.6):
            g.cube("head", [sx, 21, -3.2], [1, 6, 3], faces_tile(hair, [1, 6, 3]))                 # mechas laterais na frente das orelhas
    elif st == "twintails":
        for side, sx in (("l", 4.2), ("r", -6.2)):
            b = g.bone(f"tail_{side}", [sx + 1, 30, 1], "head", [0, 0, 12 if side == "l" else -12])
            g.cube(b["name"], [sx, 29, 0], [2, 2, 2], faces_tile(accent, [2, 2, 2]))                # laço
            g.cube(b["name"], [sx + 0.2, 18, 0.2], [1.8, 11, 1.8], faces_tile(hair, [1.8, 11, 1.8]))
            g.cube(b["name"], [sx + 0.5, 15, 0.5], [1.2, 3, 1.2], faces_tile(hair, [1.2, 3, 1.2]))
        g.cube("head", [-4.4, 29.5, -4.6], [8.8, 2.2, 1.2], faces_tile(hair, [8.8, 2.2, 1.2]))     # franja
    elif st == "spiky":
        for i, (x, z, rx, rz) in enumerate([(-3, -2, -20, 20), (0, -3, -30, 0), (3, -2, -20, -20), (-3, 2, 25, 18), (0, 3, 30, 0), (3, 2, 25, -18), (0, 0, 0, 0)]):
            g.cube("head", [x - 1, 31.5, z - 1], [2, 3.5, 2], faces_tile(hair, [2, 3.5, 2]), rot=[rx, 0, rz], pivot=[x, 31.5, z])
    # ---- armadura e roupa
    ar = A["armor"]
    if "pauldrons" in ar:
        for arm, sx in (("rightArm", -9), ("leftArm", 3.6)):
            g.cube(arm, [sx, 21.5, -2.8], [5.4, 3.4, 5.6], faces_tile(metal, [5.4, 3.4, 5.6]))
            g.cube(arm, [sx + 0.4, 20.2, -2.5], [4.6, 1.4, 5], faces_tile(metal_plain, [4.6, 1.4, 5]))
            g.cube(arm, [sx + 0.3, 12, -2.4], [4.8, 3.2, 4.8], faces_tile(metal, [4.8, 3.2, 4.8]))   # braçadeira/manopla
    if "greaves" in ar:
        for leg, sx in (("rightLeg", -4.2), ("leftLeg", -0.4)):
            g.cube(leg, [sx, 0, -2.4], [4.6, 5.5, 4.8], faces_tile(metal, [4.6, 5.5, 4.8]))
            g.cube(leg, [sx + 0.8, 5.5, -2.9], [3, 2.2, 1], faces_tile(metal_plain, [3, 2.2, 1]))  # joelheira
    if "tabard" in ar:
        g.cube("body", [-2.5, 6.5, -2.6], [5, 6, 0.4], faces_tile(accent, [5, 6, 0.4]))
    if "shield" in ar:
        b = g.bone("shield", [6, 15, 0], "leftArm")
        g.cube("shield", [8.2, 10, -4.5], [1, 9, 9], faces_tile(metal, [1, 9, 9]))
        g.cube("shield", [9.0, 13.5, -1], [0.8, 2, 2], faces_tile(metal_plain, [0.8, 2, 2]))
    if "coat_tails" in ar:
        b = g.bone("coat", [0, 12, 0], "body")
        g.cube("coat", [-4.4, 3, 2.1], [8.8, 9, 0.6], faces_tile(cloth, [8.8, 9, 0.6]), rot=[10, 0, 0], pivot=[0, 12, 2.4])
        for sx in (-4.6, 4.0):
            g.cube("coat", [sx, 4, -2.2], [0.6, 8, 4.4], faces_tile(cloth, [0.6, 8, 4.4]))
    if "cape" in ar:
        b = g.bone("cape", [0, 24, 2.4], "body", [6, 0, 0])
        g.cube("cape", [-5, 4, 2.4], [10, 20, 0.6], faces_tile(cloth, [10, 20, 0.6]))
    if "sash" in ar:
        g.cube("body", [-3, 2, -2.5], [6, 10, 0.4], faces_tile(cloth, [6, 10, 0.4]))
        g.bone("sash_back", [0, 12, 2.3], "body", [8, 0, 0]); g.cube("sash_back", [-4, 1, 2.3], [8, 11, 0.5], faces_tile(cloth, [8, 11, 0.5]))
    if "collar" in ar:
        g.cube("body", [-4.6, 22.5, -2.6], [9.2, 3, 5.2], faces_tile(cloth, [9.2, 3, 5.2]))
        g.cube("body", [-1, 20.5, -2.75], [2, 2, 0.4], faces_tile(accent, [2, 2, 0.4]))           # lenço vermelho
    # ---- arma na mão direita (aponta para a frente, -Z)
    wp = A.get("weapon")
    if wp:
        b = g.bone("weapon", [-6, 12, 0], "rightArm")
        steel = at.tile("blade", p_blade(hexc("#d4d8e2"), hexc("#ffffff"))); grip = at.tile("grip", p_cloth(hexc("#3a2a20"), fold=False)); gold = at.tile("gold", p_metal(T))
        if wp == "sword":
            g.cube("weapon", [-6.5, 11, -2.5], [1, 2, 4], faces_tile(grip, [1, 2, 4]))
            g.cube("weapon", [-7.5, 10.5, -3.5], [3, 3, 1], faces_tile(gold, [3, 3, 1]))
            g.cube("weapon", [-6.4, 10.9, -20], [0.8, 2.2, 16.5], faces_tile(steel, [0.8, 2.2, 16.5]))
            g.cube("weapon", [-6.3, 11.4, -21.5], [0.6, 1.2, 1.5], faces_tile(steel, [0.6, 1.2, 1.5]))
        elif wp == "spear":
            g.cube("weapon", [-6.4, 11.4, -20], [0.8, 0.8, 32], faces_tile(grip, [0.8, 0.8, 32]))
            g.cube("weapon", [-6.9, 10.9, -21], [1.8, 1.8, 1.4], faces_tile(gold, [1.8, 1.8, 1.4]))
            g.cube("weapon", [-6.6, 10.6, -27], [1.2, 2.4, 6], faces_tile(steel, [1.2, 2.4, 6]))
    # ---- asas
    if A.get("wing"):
        cb, cs, ct = [hexc(c) for c in A["wing"]]
        bar = at.tile("wingbar", p_cloth(hexc(A["bar"]), fold=False))
        ed = hexc(A["wedge"]) if A.get("wedge") else None
        small = at.feather("small", p_feather(shade(cb, 1.1), cb, ed, round_tip=True))
        cov = at.feather("cov", p_feather(cb, cs, ed)); sec = at.feather("sec", p_feather(cb, cs, ed, mid=mix(cb, cs, 0.6)))
        pri = at.feather("pri", p_feather(cs, ct, ed, mid=mix(cs, ct, 0.35), round_tip=False))
        alt = at.feather("alt", p_feather(hexc(A["alt"]), shade(hexc(A["alt"]), 0.8), ed)) if A.get("alt") else None
        wings(g, A, cov, sec, pri, bar, A.get("span", 1.0), alt, small)
    img.save(os.path.join(RP, f"textures/entity/etheria_{aid}.png"))
    json.dump(g.json(), open(os.path.join(RP, f"models/entity/etheria_{aid}_skin.geo.json"), "w"), indent=1)
    return g

def anims(aid, g):
    names = {b["name"] for b in g.bones}; out = {}
    fly = "(query.is_on_ground ? 0.0 : 1.0)"
    bones = {}
    if "wing_l" in names:
        for side, sg in (("l", 1), ("r", -1)):
            bones[f"wing_{side}"] = {"rotation": [f"math.sin(query.life_time * 160) * 2 * {fly}", f"{sg} * (-6 * {fly} + math.sin(query.life_time * 70) * 2)",
                                                  f"{sg} * (math.sin(query.life_time * 90) * 3 + {fly} * (14 + math.sin(query.life_time * 720) * 32))"]}
            bones[f"wingB_{side}"] = {"rotation": [0, 0, f"{sg} * ({fly} * math.sin(query.life_time * 720 - 40) * 14 + math.sin(query.life_time * 90 - 30) * 2)"]}
            bones[f"wingC_{side}"] = {"rotation": [0, 0, f"{sg} * ({fly} * math.sin(query.life_time * 720 - 80) * 18 + math.sin(query.life_time * 90 - 60) * 3)"]}
    for hb in ("hair_back", "cape", "coat", "sash_back"):
        if hb in names: bones[hb] = {"rotation": [f"math.sin(query.life_time * 120) * 2 + math.clamp(query.modified_move_speed, 0, 1) * 18 + {fly} * 22", 0, 0]}
    for tb, sg in (("tail_l", 1), ("tail_r", -1)):
        if tb in names: bones[tb] = {"rotation": [f"math.sin(query.life_time * 140) * 4 + math.clamp(query.modified_move_speed, 0, 1) * 14", 0, f"{sg} * math.sin(query.life_time * 110) * 4"]}
    out[f"animation.etheria.angel.{aid}.idle"] = {"loop": True, "bones": bones}
    return out

def entity(aid, A, has_anim):
    p = os.path.join(RP, f"entity/{aid}.entity.json")
    if os.path.exists(p): d = json.load(open(p))
    else:
        d = json.load(open(os.path.join(RP, "entity/pico.entity.json")))
        d = json.loads(json.dumps(d).replace("etheria:pico", f"etheria:{aid}").replace("etheria_pico", f"etheria_{aid}"))
    de = d["minecraft:client_entity"]["description"]
    de["textures"] = {"default": f"textures/entity/etheria_{aid}"}; de["geometry"] = {"default": f"geometry.etheria_{aid}_skin"}
    an = de.setdefault("animations", {}); an["angel"] = f"animation.etheria.angel.{aid}.idle"
    sc = de.setdefault("scripts", {}); am = sc.setdefault("animate", [])
    if not any((isinstance(x, str) and x == "angel") or (isinstance(x, dict) and "angel" in x) for x in am): am.append("angel")
    if aid == "garasha": de["spawn_egg"] = {"base_color": "#d8284c", "overlay_color": "#e2b83a"}
    json.dump(d, open(p, "w"), indent=1)

def main():
    os.makedirs(os.path.join(os.path.dirname(__file__), "angel_src"), exist_ok=True)
    allanim = {}
    for aid, A in ANGELS.items():
        srcdir = os.path.join(os.path.dirname(__file__), "angel_src", f"{aid}.png"); cur = os.path.join(RP, f"textures/entity/etheria_{aid}.png")
        if aid != "garasha" and not os.path.exists(srcdir) and os.path.exists(cur):          # guarda a skin original do jogador (a textura final é sobrescrita)
            Image.open(cur).convert("RGBA").crop((0, 0, 64, 64)).save(srcdir)
        g = build(aid, A); allanim.update(anims(aid, g)); entity(aid, A, True)
        print(aid, len(g.bones), "ossos,", sum(len(b.get("cubes", [])) for b in g.bones), "cubos")
    json.dump({"format_version": "1.10.0", "animations": allanim}, open(os.path.join(RP, "animations/etheria_angels.animation.json"), "w"), indent=1)
if __name__ == "__main__": main()

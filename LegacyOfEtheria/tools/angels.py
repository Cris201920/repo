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
TW = TH = 128

# ---------------------------------------------------------------- cores
def hexc(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (c[3] if len(c) > 3 else 255,)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)

# ---------------------------------------------------------------- atlas de materiais
class Atlas:
    """aloca blocos no espaço livre da textura 128x128 (fora da skin 64x64 do canto)"""
    def __init__(s, img):
        s.img = img; s.d = ImageDraw.Draw(img); s.slots = {}
        s.free16 = [(x, y) for y in range(0, 128, 16) for x in range(64, 128, 16)]          # lado direito: 32 blocos 16x16
        s.free_f = [(x, y) for y in (64, 96) for x in range(0, 64, 8)]                         # embaixo à esquerda: 16 penas 8x32
    def tile(s, name, painter):
        if name not in s.slots:
            x, y = s.free16.pop(0); painter(s.img, x, y, 16, 16); s.slots[name] = (x, y, 16, 16)
        return s.slots[name]
    def feather(s, name, painter):
        if name not in s.slots:
            x, y = s.free_f.pop(0); painter(s.img, x, y, 8, 32); s.slots[name] = (x, y, 8, 32)
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
def p_feather(base, tip, edge=None, shaft=None):
    """pena 8x32: raque central clara, barbas com degradê base->ponta, ponta arredondada (transparente nos cantos)"""
    def f(img, x, y, w, h):
        px = img.load(); cx = (w - 1) / 2
        for j in range(h):
            t = j / (h - 1)
            half = w / 2 * (0.75 + 0.25 * math.sin(min(1, t * 1.2) * math.pi / 2)) if t < 0.85 else w / 2 * max(0.25, (1 - t) / 0.15)
            for i in range(w):
                dx = abs(i - cx)
                if dx > half: px[x + i, y + j] = (0, 0, 0, 0); continue
                c = mix(base, tip, t)
                if dx > half - 1.1: c = shade(edge or c, 0.8 if not edge else 1.0)
                if (j + int(dx)) % 4 == 0: c = shade(c, 0.9)                               # barbas
                if dx < 0.6: c = shade(shaft or base, 1.35)                                # raque
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

def wings(g, A, feat_cov, feat_sec, feat_pri, bar, span=1.0, alt=None):
    """asa esquerda (+X) e direita (-X, espelhada). Ossos: wing_<l|r> (ombro) -> wingA (braço) -> wingB (antebraço) -> wingC (mão).
    Penas como placas finas (0,4) de textura própria; primárias em leque. alt = pena alternada (asas de duas cores)."""
    for side, sg in (("l", 1), ("r", -1)):
        X = lambda v: v * sg
        root = g.bone(f"wing_{side}", [X(1.5), 21.5, 2.2], "body", [0, X(-28), X(14)])
        L1, L2, L3 = 7 * span, 8 * span, 7 * span
        a = g.bone(f"wingA_{side}", [X(1.5), 21.5, 2.6], f"wing_{side}")
        x0 = 1.5; x1 = x0 + L1
        g.cube(a["name"], [X(x0) if sg > 0 else X(x1), 20.6, 2.1], [L1, 1.8, 1.2], faces_tile(bar, [L1, 1.8, 1.2]))
        for k in range(int(L1 // 2)):                                                   # coberteiras (curtas, em camadas)
            fx = x0 + 0.3 + k * 2; t = feat_cov if not alt or k % 2 == 0 else alt
            g.cube(a["name"], [X(fx) if sg > 0 else X(fx + 2.2), 15.2, 2.75 + 0.05 * k], [2.2, 5.6, 0.35], faces_feather(t, [2.2, 5.6, 0.35]))
        b = g.bone(f"wingB_{side}", [X(x1), 21.5, 2.6], a["name"], [0, 0, X(6)])
        x2 = x1 + L2
        g.cube(b["name"], [X(x1) if sg > 0 else X(x2), 20.8, 2.2], [L2, 1.4, 1.0], faces_tile(bar, [L2, 1.4, 1.0]))
        for k in range(int(L2 // 1.8)):                                                 # secundárias (médias)
            fx = x1 + 0.2 + k * 1.8; ln = 11 + k * 0.5; t = feat_sec if not alt or k % 2 == 0 else alt
            g.cube(b["name"], [X(fx) if sg > 0 else X(fx + 2.2), 21 - ln, 2.55 + 0.04 * k], [2.2, ln, 0.35], faces_feather(t, [2.2, ln, 0.35]))
        c = g.bone(f"wingC_{side}", [X(x2), 21.5, 2.6], b["name"], [0, 0, X(10)])
        x3 = x2 + L3
        g.cube(c["name"], [X(x2) if sg > 0 else X(x3), 20.9, 2.25], [L3, 1.2, 0.9], faces_tile(bar, [L3, 1.2, 0.9]))
        for k in range(6):                                                              # primárias em leque (as mais longas)
            fx = x2 + 0.6 + k * 1.15; ln = 15 + k * 1.3; ang = X(-6 - k * 9); t = feat_pri if not alt or k % 2 == 1 else alt
            g.cube(c["name"], [X(fx) if sg > 0 else X(fx + 2.4), 21.2 - ln, 2.45 - 0.03 * k], [2.4, ln, 0.35], faces_feather(t, [2.4, ln, 0.35]),
                   rot=[0, 0, ang], pivot=[X(fx + 1.2), 21.2, 2.5])

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
  "garasha": {"skin": None, "hair": "#d8284c", "wing": ("#1c1a22", "#2a2630", "#d9b440"), "bar": "#24212a", "metal": "#c8ccd4", "trim": "#e2b83a", "cloth": "#22202a", "accent": "#ece8e0",
              "hairstyle": "long", "armor": ["pauldrons", "greaves", "tabard", "shield"], "weapon": "sword", "span": 1.15},
  "pico":    {"hair": "#f2d45a", "wing": ("#16141c", "#211e28", "#3a3442"), "bar": "#1e1b24", "metal": "#d8d8e4", "trim": "#e4c25a", "cloth": "#b28ad8", "accent": "#f0f0f6",
              "hairstyle": "twintails", "armor": ["coat_tails"], "weapon": "spear", "span": 1.0},
  "obera":   {"hair": "#16141c", "wing": None, "metal": "#eef0f6", "trim": "#e2b83a", "cloth": "#7a4ab8", "accent": "#eef0f6",
              "hairstyle": "long", "armor": ["pauldrons", "greaves", "cape"], "weapon": None},
  "zalario": {"hair": "#16141c", "wing": ("#f4f4fa", "#e8e8f2", "#ffffff"), "bar": "#dcdce8", "metal": "#4a2a6a", "trim": "#e2b83a", "cloth": "#f2f2f6", "accent": "#e2b83a",
              "hairstyle": "long", "armor": ["pauldrons", "greaves", "sash"], "weapon": None, "span": 1.2},
  "dino":    {"hair": "#dfe2ea", "wing": ("#f0f0f4", "#3a3640", "#d9b440"), "bar": "#2e2a34", "metal": "#2a2630", "trim": "#d9b440", "cloth": "#1c1a22", "accent": "#a8232c",
              "hairstyle": "spiky", "armor": ["coat_tails", "collar"], "weapon": "sword", "span": 1.1, "alt": True},
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
        cov = at.feather("cov", p_feather(cb, cs)); sec = at.feather("sec", p_feather(cs, mix(cs, ct, 0.4), shade(ct, 0.8)))
        pri = at.feather("pri", p_feather(cs, ct, shade(ct, 0.9)))
        alt = at.feather("alt", p_feather(hexc("#3a3640"), hexc("#1c1a22"))) if A.get("alt") else None
        if aid == "dino": cov = at.feather("cov2", p_feather(cb, mix(cb, ct, 0.2)))
        wings(g, A, cov, sec, pri, bar, A.get("span", 1.0), alt)
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

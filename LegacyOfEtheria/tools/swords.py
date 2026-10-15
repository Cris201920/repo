# tools/swords.py - ESPADAS 3D HD (6.33). Gera, para cada espada/adaga do addon:
#   RP/models/entity/etheria_w_<id>.geo.json   geometria 3D (presa ao osso rightItem do jogador pelo nome, como as armaduras)
#   RP/attachables/w_<id>.attachable.json      o modelo aparece na mão (1ª e 3ª pessoa)
#   RP/textures/attachable/w_<id>.png          textura HD (128x128 procedural, ou a textura original dos modelos convertidos)
#   RP/textures/items/etheria_<id>.png         ícone HD (64x64) renderizado do PRÓPRIO modelo 3D
# Duas fontes de modelo:
#   (1) modelos 3D reais enviados pelo usuário (Java/Blockbench) -> convertidos elemento a elemento (cubos, rotações, UV por face)
#   (2) gerador procedural: lâmina com núcleo + gume chanfrado (espessura real), sulco, ponta afinada em degraus de 0,5 px,
#       guarda com ornamentos por tema, cabo com faixas, pomo com gema. Temas: aço, fogo, gelo, tempestade, terra, abismo/demoníaco,
#       estelar/cósmico, sagrado, dracônico, sculk, água, ametista, obsidiana, prismático. Arquétipos: adaga, curta, espada, longa,
#       katana (curva + tsuba), montante, rapieira.
# Uso: python3 tools/swords.py <pasta_modelos_espadas> <pasta_cit_rimuru>
import os, sys, json, math, random, subprocess
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "LegacyOfEtheria_BP"), os.path.join(ROOT, "LegacyOfEtheria_RP")
SRC_MODELS, SRC_CIT = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else (None, None)
TB_DIR = sys.argv[3] if len(sys.argv) > 3 else None   # assets/tensura_blade do Tensura-Blade (uso pessoal)
OBJ_MODELS = {"reid_dragon_sword": ("models/item/training_blade_drawn.obj", "textures/item/dragon_sword.png", "textures/item/dragon_sword_glow.png")}
HAND = (-6.0, 11.5, 0.0)        # ponto da empunhadura no espaço do modelo do jogador (braço direito em repouso)
HOLD_ROT = [55.0, 0.0, 0.0]     # lâmina para a frente e para cima (~35° acima da horizontal)
AT = 128                        # resolução do atlas procedural

# ------------------------------------------------------------------ itens do addon
def load_weapons():
    js = f"import('{BP}/scripts/data/items.gen.js').then(m=>console.log(JSON.stringify(Object.values(m.ITEMS).filter(v=>v.kind==='weapon'))))"
    return json.loads(subprocess.check_output(["node", "--input-type=module", "-e", js]))

THEMES = {   # lâmina, gume, guarda, acento, cabo, gema, brilho (energia), runas
  "steel":    dict(blade=(178, 186, 198), edge=(236, 240, 246), guard=(120, 112, 104), accent=(196, 160, 84), grip=(70, 44, 30), gem=(70, 130, 220), glow=None, rune=None),
  "fire":     dict(blade=(150, 64, 40), edge=(255, 196, 92), guard=(70, 34, 24), accent=(232, 150, 40), grip=(56, 20, 16), gem=(255, 90, 30), glow=(255, 140, 40), rune=(255, 210, 120)),
  "ice":      dict(blade=(150, 205, 235), edge=(235, 250, 255), guard=(90, 130, 170), accent=(200, 230, 250), grip=(40, 60, 90), gem=(120, 220, 255), glow=(140, 230, 255), rune=(220, 250, 255)),
  "storm":    dict(blade=(70, 96, 150), edge=(200, 235, 255), guard=(40, 50, 80), accent=(250, 220, 90), grip=(30, 36, 60), gem=(90, 220, 255), glow=(120, 220, 255), rune=(255, 240, 140)),
  "earth":    dict(blade=(138, 112, 78), edge=(212, 196, 150), guard=(86, 66, 44), accent=(110, 170, 80), grip=(60, 44, 28), gem=(90, 190, 90), glow=None, rune=(170, 220, 120)),
  "abyss":    dict(blade=(46, 30, 62), edge=(168, 90, 220), guard=(26, 18, 34), accent=(150, 30, 50), grip=(24, 14, 26), gem=(200, 30, 60), glow=(190, 70, 255), rune=(230, 60, 80)),
  "demon":    dict(blade=(40, 26, 30), edge=(200, 40, 50), guard=(30, 20, 22), accent=(170, 24, 36), grip=(30, 12, 14), gem=(230, 20, 40), glow=(255, 50, 60), rune=(255, 70, 70)),
  "cosmic":   dict(blade=(36, 34, 80), edge=(200, 190, 255), guard=(40, 36, 70), accent=(240, 210, 120), grip=(26, 22, 50), gem=(160, 120, 255), glow=(170, 150, 255), rune=(255, 240, 200)),
  "holy":     dict(blade=(226, 226, 236), edge=(255, 255, 255), guard=(218, 176, 70), accent=(255, 226, 120), grip=(240, 236, 222), gem=(120, 200, 255), glow=(255, 236, 160), rune=(255, 220, 110)),
  "dragon":   dict(blade=(84, 130, 90), edge=(210, 236, 190), guard=(60, 74, 50), accent=(210, 170, 70), grip=(50, 40, 26), gem=(240, 90, 40), glow=(140, 255, 120), rune=(220, 255, 170)),
  "sculk":    dict(blade=(24, 52, 60), edge=(60, 220, 210), guard=(16, 30, 36), accent=(40, 170, 170), grip=(18, 26, 30), gem=(60, 240, 230), glow=(70, 250, 240), rune=(110, 255, 245)),
  "water":    dict(blade=(60, 140, 170), edge=(200, 250, 255), guard=(40, 90, 110), accent=(110, 220, 210), grip=(30, 60, 70), gem=(80, 200, 255), glow=(110, 230, 255), rune=None),
  "amethyst": dict(blade=(150, 100, 200), edge=(230, 200, 255), guard=(90, 60, 120), accent=(210, 170, 250), grip=(60, 40, 80), gem=(200, 130, 255), glow=(210, 160, 255), rune=None),
  "obsidian": dict(blade=(30, 24, 44), edge=(150, 110, 210), guard=(20, 16, 30), accent=(110, 70, 170), grip=(26, 20, 34), gem=(150, 80, 230), glow=None, rune=None),
  "prism":    dict(blade=(230, 236, 250), edge=(255, 255, 255), guard=(200, 200, 220), accent=(255, 200, 230), grip=(220, 220, 236), gem=(255, 120, 200), glow=(255, 255, 255), rune=(255, 160, 220)),
  "nightblue": dict(blade=(22, 24, 34), edge=(120, 200, 255), guard=(28, 30, 42), accent=(214, 178, 92), grip=(16, 22, 44), gem=(70, 170, 255), glow=(90, 190, 255), rune=(150, 220, 255)),
  "knight":   dict(blade=(214, 218, 228), edge=(250, 252, 255), guard=(176, 150, 92), accent=(232, 206, 120), grip=(46, 52, 92), gem=(90, 140, 230), glow=None, rune=None),
  "sakura":   dict(blade=(200, 206, 214), edge=(250, 250, 255), guard=(60, 40, 40), accent=(240, 150, 180), grip=(130, 30, 50), gem=(255, 150, 190), glow=None, rune=None),
}
def theme_of(w):
    i = w["id"]
    if i.endswith("rimuru_katana") or i.endswith("obsidian_katana"): return "nightblue"
    if i.endswith("knight_sword") or i.endswith("iron_blade") or i.endswith("infused_iron_sword"): return "knight"
    for keys, th in [(("flame", "scorch", "ember", "fiery", "shizue"), "fire"), (("frost", "ice", "boreal"), "ice"), (("storm", "tempest"), "storm"),
                     (("earth", "geb"), "earth"), (("abyss", "void", "dread", "dead_mans"), "abyss"), (("crimson", "reaper", "shadow"), "demon"),
                     (("star", "celestial", "spatial"), "cosmic"), (("rainbow",), "prism"), (("sky", "dyrnwyn"), "holy"), (("dragon", "wyrm", "kusanagi"), "dragon"),
                     (("warden", "resonarium", "depth"), "sculk"), (("neptunium",), "water"), (("amethyst",), "amethyst"), (("obsidian",), "obsidian"),
                     (("gobuta", "kodachi"), "sakura"), (("katana",), "sakura" if "dragotite" not in i else "steel")]:
        if any(k in i for k in keys): return th
    return "steel"
def arch_of(w):
    i = w["id"]
    if w.get("wtype") == "dagger": return "rapier" if "rapier" in i else "dagger"
    if "katana" in i or "kodachi" in i: return "katana"
    if "great_sword" in i or "claymore" in i or "dreadsword" in i or "ogre_eater" in i: return "great"
    if "long_sword" in i or "dyrnwyn" in i: return "long"
    if "short_sword" in i: return "short"
    return "sword"
RARITY_RANK = {"common": 0, "uncommon": 1, "rare": 2, "epic": 3, "legendary": 4, "mythic": 5}

# ------------------------------------------------------------------ pintura do atlas (128x128)
REG = {  # x, y, w, h
  "flat": (0, 0, 32, 128), "edge": (32, 0, 8, 128), "guard": (40, 0, 32, 32), "accent": (72, 0, 32, 32), "gem": (104, 0, 16, 16),
  "grip": (40, 32, 16, 64), "dark": (56, 32, 16, 32), "glow": (72, 32, 32, 32), "gem2": (104, 16, 16, 16), "pommel": (104, 32, 24, 24), "scale": (56, 64, 32, 32),
}
def lerp(a, b, t): return tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3))
def mul(c, f): return tuple(max(0, min(255, int(v * f))) for v in c)
def paint(theme, rank, seed, arch):
    T = THEMES[theme]; rnd = random.Random(seed)
    im = Image.new("RGBA", (AT, AT), (0, 0, 0, 255)); px = im.load()
    noise = lambda: rnd.uniform(-1, 1)
    # lâmina: gradiente transversal (centro mais escuro = espinha), brilho longitudinal, sulco, runas
    x0, y0, w, h = REG["flat"]
    for y in range(h):
        for x in range(w):
            t = abs(x - (w - 1) / 2) / ((w - 1) / 2)              # 0 centro .. 1 borda
            c = lerp(mul(T["blade"], 0.78), T["blade"], min(1, t * 1.3))
            if t > 0.72: c = lerp(c, T["edge"], (t - 0.72) / 0.28)  # chanfro do gume
            c = mul(c, 1 + 0.10 * math.sin(y / 9.0) + 0.04 * noise())
            if abs(x - (w - 1) / 2) < 2.2 and 10 < y < h - 6 and arch != "katana": c = mul(c, 0.55)   # sulco (fuller)
            if arch == "katana" and t > 0.55: c = lerp(c, (240, 244, 250), 0.35 + 0.25 * math.sin(y / 3.1 + x) ** 2)   # hamon
            px[x0 + x, y0 + y] = c + (255,)
    if T["rune"] and rank >= 3:   # runas gravadas ao longo do sulco
        d = ImageDraw.Draw(im)
        for k in range(14, h - 16, 9):
            cx, cy = x0 + w // 2, y0 + k; g = rnd.randrange(4)
            pts = [[(cx - 2, cy), (cx + 2, cy), (cx, cy + 4)], [(cx - 2, cy), (cx, cy + 4), (cx + 2, cy)], [(cx, cy), (cx, cy + 5)], [(cx - 2, cy + 2), (cx + 2, cy + 2)]][g]
            d.line(pts, fill=T["rune"] + ((70 if T["glow"] and rank >= 4 else 255),), width=1)
    # gume
    x0, y0, w, h = REG["edge"]
    for y in range(h):
        for x in range(w): px[x0 + x, y0 + y] = mul(T["edge"], 0.85 + 0.15 * (x / w) + 0.05 * noise()) + (255,)
    # metais da guarda/acento com gravação
    for name, base in (("guard", T["guard"]), ("accent", T["accent"]), ("pommel", T["guard"])):
        x0, y0, w, h = REG[name]
        for y in range(h):
            for x in range(w):
                c = mul(base, 0.75 + 0.45 * (1 - y / h) + 0.06 * noise())
                if (x + y) % 8 == 0 or (x - y) % 8 == 0: c = mul(c, 1.25)     # filigrana em losango
                if x in (0, w - 1) or y in (0, h - 1): c = mul(c, 0.6)
                px[x0 + x, y0 + y] = c + (255,)
    # cabo: enrolado em losangos (tsuka-ito na katana)
    x0, y0, w, h = REG["grip"]
    for y in range(h):
        for x in range(w):
            k = ((x + y) // 4 + (x - y) // 4) % 2
            c = mul(T["grip"], 0.7 + 0.5 * k + 0.05 * noise())
            if arch == "katana" and ((x + y) % 8 < 2 or (x - y) % 8 < 2): c = mul(T["accent"], 0.9)
            px[x0 + x, y0 + y] = c + (255,)
    # gemas facetadas
    for name, base in (("gem", T["gem"]), ("gem2", T["accent"])):
        x0, y0, w, h = REG[name]
        for y in range(h):
            for x in range(w):
                dx, dy = (x - 7.5) / 7.5, (y - 7.5) / 7.5; r = math.hypot(dx, dy)
                c = lerp(mul(base, 1.6), mul(base, 0.45), min(1, r)); c = mul(c, 1.2 if (x // 4 + y // 4) % 2 else 0.95)
                if (x - 4) ** 2 + (y - 4) ** 2 < 4: c = (255, 255, 255)
                px[x0 + x, y0 + y] = c + ((60 if rank >= 4 else 255),)
    x0, y0, w, h = REG["dark"]
    for y in range(h):
        for x in range(w): px[x0 + x, y0 + y] = mul(T["guard"], 0.45 + 0.1 * noise()) + (255,)
    x0, y0, w, h = REG["glow"]
    gl = T["glow"] or T["edge"]
    for y in range(h):
        for x in range(w):
            r = math.hypot(x - 15.5, y - 15.5) / 16
            px[x0 + x, y0 + y] = lerp((255, 255, 255), gl, min(1, r)) + ((0 if T["glow"] else 255),)
    x0, y0, w, h = REG["scale"]
    for y in range(h):
        for x in range(w):
            k = ((x + (y // 4 % 2) * 2) % 4) / 4
            px[x0 + x, y0 + y] = mul(T["accent"] if theme == "dragon" else T["guard"], 0.6 + 0.6 * (1 - k) + 0.05 * noise()) + (255,)
    if theme in ("cosmic", "prism"):   # estrelas na lâmina
        x0, y0, w, h = REG["flat"]
        for _ in range(60):
            x, y = rnd.randrange(w), rnd.randrange(h); px[x0 + x, y0 + y] = (255, 255, 240, 255)
    return im

# ------------------------------------------------------------------ 6.36: pintura em ALTA RESOLUÇÃO (sem aspecto de pixel)
# Mesmo layout de REG (coordenadas do atlas 128), mas desenhado em 128*HD px: o modelo continua declarando 128x128 e o jogo
# usa a imagem maior (UV normalizado), então cada pixel do modelo vira HDxHD texels lisos.
HD = 4
def paint_hd(theme, rank, seed, arch):
    import numpy as np
    from PIL import ImageFilter
    T = THEMES[theme]; rnd = np.random.default_rng(abs(hash(seed)) % (2 ** 32)); S = HD
    W = AT * S; img = np.zeros((W, W, 4), np.float32); img[..., 3] = 255
    A = lambda c: np.array(c, np.float32)
    def region(name):
        x, y, w, h = REG[name]; return slice(y * S, (y + h) * S), slice(x * S, (x + w) * S), w * S, h * S
    def grid(w, h): yy, xx = np.mgrid[0:h, 0:w].astype(np.float32); return xx, yy
    def noise(h, w, sc=6.0, amp=1.0):
        n = rnd.standard_normal((max(2, int(h / sc)), max(2, int(w / sc)))).astype(np.float32)
        im = Image.fromarray(((n - n.min()) / (np.ptp(n) + 1e-6) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        return (np.asarray(im, np.float32) / 255 - 0.5) * 2 * amp
    # --- lâmina: chanfro do gume, espinha, sulco com gravação, polimento longitudinal e reflexo
    ys, xs, w, h = region("flat"); xx, yy = grid(w, h)
    t = np.abs(xx - (w - 1) / 2) / ((w - 1) / 2)                       # 0 centro .. 1 gume
    base = A(T["blade"]); edge = A(T["edge"])
    shade = 0.72 + 0.28 * np.clip(t * 1.4, 0, 1)
    col = base[None, None, :] * shade[..., None]
    bev = np.clip((t - 0.66) / 0.34, 0, 1)[..., None]
    col = col * (1 - bev) + edge[None, None, :] * bev * (0.9 + 0.1 * np.cos(yy / h * 9)[..., None])
    brushed = noise(h, w, sc=1.2, amp=0.035) + noise(h, w, sc=24, amp=0.05)
    col *= (1 + brushed + 0.08 * np.sin(yy / (h / 7.0)))[..., None]
    spec = np.exp(-((xx - w * 0.36) / (w * 0.05)) ** 2) * 0.35        # reflexo especular
    col += 255 * spec[..., None]
    if arch != "katana":
        ful = np.exp(-((xx - (w - 1) / 2) / (w * 0.06)) ** 2) * ((yy > h * 0.08) & (yy < h * 0.92))
        col *= (1 - 0.42 * ful)[..., None]
    else:   # hamon ondulado (linha temperada) perto do gume
        wave = 0.62 + 0.06 * np.sin(yy / (h / 26.0)) + 0.025 * np.sin(yy / (h / 71.0))
        hm = np.clip(1 - np.abs(t - wave) / 0.05, 0, 1) ** 1.5
        hcol = A(T["glow"] if T["glow"] else (245, 248, 255))
        col = col * (1 - 0.75 * hm[..., None]) + hcol[None, None, :] * 0.75 * hm[..., None]
        col[t > wave] = col[t > wave] * 0.75 + A((236, 240, 248)) * 0.25 if not T["glow"] else col[t > wave] * 0.8 + hcol * 0.2
    img[ys, xs, :3] = col
    # gravação (runas finas e filigrana) ao longo do sulco
    if rank >= 2:
        im = Image.fromarray(np.clip(img[ys, xs, :3], 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
        rc = tuple(int(v) for v in (T["rune"] or T["accent"]))
        cx = w / 2
        for k in range(int(h * 0.12), int(h * 0.82), int(S * 7)):
            g = rnd.integers(0, 5); sz = S * 1.6
            if g == 0: d.ellipse([cx - sz, k - sz, cx + sz, k + sz], outline=rc, width=max(1, S // 2))
            elif g == 1: d.line([(cx - sz, k + sz), (cx, k - sz), (cx + sz, k + sz)], fill=rc, width=max(1, S // 2))
            elif g == 2: d.line([(cx, k - sz), (cx, k + sz)], fill=rc, width=max(1, S // 2)); d.line([(cx - sz, k), (cx + sz, k)], fill=rc, width=max(1, S // 3))
            elif g == 3: d.arc([cx - sz, k - sz, cx + sz, k + sz], 200, 340, fill=rc, width=max(1, S // 2))
            else: d.polygon([(cx, k - sz), (cx + sz * 0.7, k), (cx, k + sz), (cx - sz * 0.7, k)], outline=rc)
        for side in (-1, 1):   # filetes paralelos
            xline = cx + side * w * 0.2
            d.line([(xline, h * 0.06), (xline, h * 0.9)], fill=tuple(int(v * 0.8) for v in rc), width=max(1, S // 3))
        img[ys, xs, :3] = np.asarray(im.filter(ImageFilter.GaussianBlur(0.4)), np.float32)
    if theme in ("cosmic", "prism"):
        for _ in range(140):
            x0, y0 = rnd.integers(0, w), rnd.integers(0, h); r = rnd.uniform(0.5, 1.6) * S / 2
            yy0, xx0 = np.ogrid[0:h, 0:w]
    # --- gume (fio): degradê fino com brilho
    ys, xs, w, h = region("edge"); xx, yy = grid(w, h)
    g = 0.82 + 0.25 * (xx / w) + noise(h, w, sc=1.5, amp=0.03)
    img[ys, xs, :3] = A(T["edge"])[None, None, :] * g[..., None]
    # --- metais (guarda, acento, pomo): metal escovado + filigrana curva + borda chanfrada
    for name, basec in (("guard", T["guard"]), ("accent", T["accent"]), ("pommel", T["guard"])):
        ys, xs, w, h = region(name); xx, yy = grid(w, h)
        v = 0.7 + 0.5 * (1 - yy / h) + noise(h, w, sc=1.3, amp=0.04)
        col = A(basec)[None, None, :] * v[..., None]
        fil = (np.sin(xx / (S * 1.6) + np.sin(yy / (S * 2.2)) * 2) > 0.92) | (np.sin(yy / (S * 1.6) + np.cos(xx / (S * 2.2)) * 2) > 0.94)
        col[fil] *= 1.3
        border = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)) / (S * 1.2)
        col *= np.clip(0.55 + 0.45 * border, 0.55, 1.12)[..., None]
        img[ys, xs, :3] = col
    # --- cabo: trama em losango com sombra (tsuka-ito na katana) e pele por baixo
    ys, xs, w, h = region("grip"); xx, yy = grid(w, h)
    per = S * 6
    u = ((xx + yy) % per) / per; v2 = ((xx - yy) % per) / per
    band = np.minimum(np.abs(u - 0.5), np.abs(v2 - 0.5)) * 2
    wrap = np.clip(1 - band * 1.6, 0, 1)
    under = A(T["accent"] if arch == "katana" else T["grip"]) * 0.75
    col = under[None, None, :] * (1 - wrap[..., None]) + A(T["grip"])[None, None, :] * (0.65 + 0.6 * wrap)[..., None]
    col *= (1 + noise(h, w, sc=1.3, amp=0.05))[..., None]
    img[ys, xs, :3] = col
    # --- gemas lapidadas: facetas radiais, núcleo luminoso e brilho especular
    for name, basec in (("gem", T["gem"]), ("gem2", T["accent"])):
        ys, xs, w, h = region(name); xx, yy = grid(w, h)
        dx, dy = (xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2); r = np.sqrt(dx ** 2 + dy ** 2); ang = np.arctan2(dy, dx)
        facet = 0.85 + 0.25 * np.cos(np.round(ang / (np.pi / 4)) * (np.pi / 4) * 3)
        col = A(basec)[None, None, :] * ((1.6 - r) * facet)[..., None]
        hl = np.exp(-(((xx - w * 0.33) / (w * 0.1)) ** 2 + ((yy - h * 0.3) / (h * 0.1)) ** 2))
        col += 255 * hl[..., None]
        img[ys, xs, :3] = col
        if rank >= 4: img[ys, xs, 3] = 60
    ys, xs, w, h = region("dark"); xx, yy = grid(w, h)
    img[ys, xs, :3] = A(T["guard"])[None, None, :] * (0.42 + noise(h, w, sc=2, amp=0.05))[..., None]
    ys, xs, w, h = region("glow"); xx, yy = grid(w, h)
    gl = A(T["glow"] or T["edge"]); r = np.sqrt((xx - w / 2) ** 2 + (yy - h / 2) ** 2) / (w / 2)
    img[ys, xs, :3] = (A((255, 255, 255))[None, None, :] * (1 - np.clip(r, 0, 1))[..., None] + gl[None, None, :] * np.clip(r, 0, 1)[..., None])
    img[ys, xs, 3] = 0 if T["glow"] else 255
    ys, xs, w, h = region("scale"); xx, yy = grid(w, h)
    sx_ = S * 4; row = (yy // sx_).astype(int); off = (row % 2) * sx_ / 2
    lx = ((xx + off) % sx_) / sx_; ly = (yy % sx_) / sx_
    sc_ = np.clip(1 - np.sqrt((lx - 0.5) ** 2 + (ly - 0.15) ** 2) * 1.4, 0, 1)
    img[ys, xs, :3] = A(T["accent"] if theme == "dragon" else T["guard"])[None, None, :] * (0.45 + 0.75 * sc_)[..., None]
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGBA")
    if theme in ("cosmic", "prism"):
        d = ImageDraw.Draw(out); x0, y0, w0, h0 = [v * S for v in REG["flat"]]
        for _ in range(120):
            x, y, r = x0 + rnd.uniform(0, w0), y0 + rnd.uniform(0, h0), rnd.uniform(0.4, 1.4) * S / 2
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 240, 255))
    return out

def smooth_up(tex, k=4):
    """amplia texturas de pixel art (modelos convertidos) sem serrilhado: vizinho mais próximo + suavização + nitidez"""
    from PIL import ImageFilter
    big = tex.resize((tex.width * k, tex.height * k), Image.NEAREST)
    rgb = big.convert("RGB").filter(ImageFilter.GaussianBlur(k * 0.35)).filter(ImageFilter.UnsharpMask(radius=k, percent=80, threshold=2))
    out = rgb.convert("RGBA"); out.putalpha(big.split()[3]); return out

# ------------------------------------------------------------------ montagem procedural (lâmina ao longo de +Y, largura em Z, espessura em X)
class Model:
    def __init__(s, tw=AT, th=AT): s.cubes, s.tw, s.th = [], tw, th
    def box(s, o, size, faces, rot=None, pivot=None):
        c = {"origin": [round(v, 4) for v in o], "size": [round(v, 4) for v in size], "uv": faces}
        if rot: c["rotation"] = rot; c["pivot"] = [round(v, 4) for v in pivot]
        s.cubes.append(c)
def rect(name, sub=None):
    x, y, w, h = REG[name]
    if sub: fx0, fy0, fx1, fy1 = sub; return [x + w * fx0, y + h * fy0, w * (fx1 - fx0), h * (fy1 - fy0)]
    return [x, y, w, h]
def faces_all(name, sub=None):
    r = rect(name, sub); f = {"uv": [round(r[0], 3), round(r[1], 3)], "uv_size": [round(r[2], 3), round(r[3], 3)]}
    return {k: dict(f) for k in ("north", "south", "east", "west", "up", "down")}

ARCH = {   # comprimento da lâmina, largura máx., espessura do núcleo, cabo, guarda (largura), curvatura
  "dagger": dict(L=10, W=2.2, T=1.0, grip=4, guard=4.5, curve=0),
  "rapier": dict(L=19, W=1.2, T=0.8, grip=5, guard=5.0, curve=0),
  "short":  dict(L=15, W=2.6, T=1.0, grip=5, guard=6.0, curve=0),
  "sword":  dict(L=20, W=3.0, T=1.0, grip=5.5, guard=7.0, curve=0),
  "long":   dict(L=25, W=3.0, T=1.0, grip=7, guard=8.0, curve=0),
  "katana": dict(L=25, W=2.3, T=0.9, grip=8.5, guard=4.0, curve=1.8),
  "great":  dict(L=31, W=5.4, T=1.5, grip=9.5, guard=12.0, curve=0),
}
def build_katana(theme, rank, iid):
    """v3 (6.36): katana da referência — sori contínuo (segmentos girados pela tangente), kissaki em diagonal do lado do gume,
    hamon brilhante, habaki dourado, tsuba oval vazada com aro, tsuka com ito em losango, kashira e fita (sageo) curta."""
    A = ARCH["katana"]; m = Model(); L, W, Tk, C = A["L"], A["W"], A["T"], A["curve"]
    T = THEMES[theme]; hamon = "glow" if T["glow"] else "edge"
    gy = 0.0; yb = gy + 1.0
    zc = lambda f: C * f * f                       # curva (para +Z = lado das costas)
    slope = lambda f: 2 * C * f / L
    tip = 3.2; y = 0.0
    while y < L - 0.01:
        st = 1.0 if L - y > tip + 0.01 else 0.5
        f = y / L; rest = L - y
        w = W if rest > tip else max(0.25, W * rest / tip)
        z0 = zc(f) + (W - w) / 2                    # a ponta corta o lado do GUME (-Z): as costas seguem retas até a ponta
        ang = -math.degrees(math.atan(slope(f + st / (2 * L))))
        pv = [0, yb + y, zc(f)]
        v0, v1 = max(0, 1 - (y + st) / L), 1 - y / L
        fa = faces_all("flat", (0.5 - 0.5 * w / W, v0, 0.5 + 0.5 * w / W, v1))
        fe = {"uv": rect("edge", (0, v0, 1, v1))[:2], "uv_size": rect("edge", (0, v0, 1, v1))[2:]}
        fa["north"] = fa["south"] = fe
        m.box([-Tk * 0.4, yb + y, z0 - w / 2], [Tk * 0.8, st + 0.06, w], fa, rot=[ang, 0, 0], pivot=pv)                  # corpo (shinogi-ji)
        m.box([-Tk * 0.55, yb + y, z0 + w * 0.05], [Tk * 1.1, st + 0.06, w * 0.42], faces_all("dark" if theme == "nightblue" else "flat", (0, v0, 1, v1) if theme != "nightblue" else None), rot=[ang, 0, 0], pivot=pv)   # costas grossas (mune)
        if rest > tip * 0.6:
            m.box([-Tk * 0.46, yb + y, z0 - w / 2 - 0.05], [Tk * 0.92, st + 0.06, 0.75 if theme == "nightblue" else 0.42], faces_all(hamon), rot=[ang, 0, 0], pivot=pv)          # hamon / gume brilhante
        y += st
    # habaki (colar dourado) e tsuba oval com aro e furos
    m.box([-0.75, yb - 0.2, -1.35], [1.5, 1.5, 2.7], faces_all("accent"))
    for r in (0, 30, 60):
        m.box([-0.32, gy, -2.0], [0.64, 1.0, 4.0] if r == 0 else [0.64, 1.0, 4.0], faces_all("guard"), rot=[0, r, 0], pivot=[0, gy, 0])
        m.box([-0.32, gy, -2.0], [0.64, 1.0, 4.0], faces_all("guard"), rot=[0, -r, 0], pivot=[0, gy, 0])
    m.box([-2.15, gy + 0.25, -2.15], [4.3, 0.5, 4.3], faces_all("accent"), rot=[0, 45, 0], pivot=[0, gy, 0])           # aro
    for sz in (-1, 1): m.box([-0.4, gy - 0.02, sz * 1.3 - 0.35], [0.8, 1.04, 0.7], faces_all("dark"))                    # furos (udenuki-ana)
    # tsuka: núcleo + ito cruzado + menuki + kashira + sageo
    gl = A["grip"]
    m.box([-0.62, gy - gl, -0.72], [1.24, gl, 1.44], faces_all("grip"))
    for k in range(int(gl * 2)):
        yy = gy - gl + 0.5 * k + 0.1
        m.box([-0.7, yy, -0.8], [1.4, 0.32, 1.6], faces_all("accent" if theme != "nightblue" else "glow" if k % 4 == 0 and rank >= 4 else "grip"), rot=[0, 0, 22 if k % 2 else -22], pivot=[0, yy + 0.16, 0])
    m.box([-0.78, gy - gl * 0.5 - 0.6, -0.4], [1.56, 1.2, 0.8], faces_all("accent"))                                          # menuki
    m.box([-0.82, gy - gl - 0.9, -0.92], [1.64, 0.95, 1.84], faces_all("accent"))                                              # kashira
    m.box([-0.2, gy - gl - 3.2, -0.25], [0.4, 2.4, 0.5], faces_all("gem"), rot=[18, 0, 0], pivot=[0, gy - gl - 0.9, 0])         # sageo (fita)
    if rank >= 4 and T["glow"]:
        m.box([-0.3, gy - gl - 3.6, -0.3], [0.6, 0.6, 0.6], faces_all("glow"), rot=[45, 0, 45], pivot=[0, gy - gl - 3.3, 0])   # pingente de energia
    return m

def build_great(theme, rank, iid):
    """v3 (6.36): montante da referência roxa — lâmina larga com veio central brilhante, serrilha na base, ponta em losango,
    guarda larga com chifres virados para a lâmina e cabo longo de duas mãos."""
    A = ARCH["great"]; m = Model(); L, W, Tk = A["L"], A["W"], A["T"]
    T = THEMES[theme]; vein = "glow" if T["glow"] else "accent"
    gy = 0.0; gh = 1.8; yb = gy + gh; tip = 6.0; y = 0.0
    while y < L - 0.01:
        st = 1.0 if L - y > tip + 0.01 else 0.5
        rest = L - y; f = y / L
        w = W * (1 - 0.12 * f) if rest > tip else max(0.3, W * (1 - 0.12 * (1 - tip / L)) * rest / tip)
        v0, v1 = max(0, 1 - (y + st) / L), 1 - y / L
        fa = faces_all("flat", (0.5 - 0.5 * min(1, w / W), v0, 0.5 + 0.5 * min(1, w / W), v1))
        fa["north"] = fa["south"] = {"uv": rect("edge", (0, v0, 1, v1))[:2], "uv_size": rect("edge", (0, v0, 1, v1))[2:]}
        m.box([-Tk * 0.3, yb + y, -w / 2], [Tk * 0.6, st, w], fa)                         # gume largo
        m.box([-Tk * 0.5, yb + y, -w * 0.36], [Tk, st, w * 0.72], faces_all("flat", (0.2, v0, 0.8, v1)))   # corpo
        if 1.0 < y < L - tip - 1:
            m.box([-Tk * 0.62, yb + y, -w * 0.12], [Tk * 1.24, st, w * 0.24], faces_all(vein))   # veio central (brilha nos temas com energia)
        y += st
    for i in range(3):   # serrilha da base
        for sz in (-1, 1):
            yy = yb + 1.2 + i * 1.6
            m.box([-Tk * 0.25, yy, sz * W / 2 - 0.5], [Tk * 0.5, 1.1, 1.0], faces_all("edge"), rot=[sz * 40, 0, 0], pivot=[0, yy, sz * W / 2])
    # guarda
    G = A["guard"]
    m.box([-1.2, gy, -G / 2], [2.4, gh, G], faces_all("guard"))
    m.box([-1.35, gy + 0.35, -G / 2 + 0.8], [2.7, gh - 0.7, G - 1.6], faces_all("accent"))
    m.box([-1.5, gy + 0.2, -1.4], [3.0, gh + 0.4, 2.8], faces_all("gem" if rank >= 2 else "accent"))
    for sz in (-1, 1):
        zt = sz * G / 2
        m.box([-0.7, gy, zt - 0.7], [1.4, 3.2, 1.4], faces_all("dark"), rot=[-sz * 28, 0, 0], pivot=[0, gy, zt])
        m.box([-0.5, gy + 2.8, zt - 0.5], [1.0, 2.0, 1.0], faces_all("accent"), rot=[-sz * 52, 0, 0], pivot=[0, gy + 2.8, zt])
    gl = A["grip"]
    m.box([-0.7, gy - gl, -0.7], [1.4, gl, 1.4], faces_all("grip"))
    for k in range(1, int(gl), 2): m.box([-0.82, gy - k - 0.3, -0.82], [1.64, 0.5, 1.64], faces_all("accent"))
    m.box([-1.2, gy - gl - 1.8, -1.2], [2.4, 1.8, 2.4], faces_all("pommel"))
    m.box([-0.7, gy - gl - 2.7, -0.7], [1.4, 1.0, 1.4], faces_all("gem"), rot=[0, 45, 0], pivot=[0, gy - gl - 2.2, 0])
    return m

def build_procedural(theme, arch, rank, iid):
    if arch == "katana": return build_katana(theme, rank, iid)
    if arch == "great": return build_great(theme, rank, iid)
    """v2 (6.35): seção em losango (gume fino, corpo, espinha), ponta em passos de 0,5 px, ornamentos 3D por tema"""
    A = ARCH[arch]; m = Model(); L, W, Tk = A["L"], A["W"], A["T"]
    rnd = random.Random(iid)
    gy = 0.0
    guard_h = 1.4 if arch != "katana" else 0.8
    yb = gy + guard_h
    edge = lambda v0, v1: {"uv": rect("edge", (0, v0, 1, v1))[:2], "uv_size": rect("edge", (0, v0, 1, v1))[2:]}
    def layer(y0, hgt, w, thick, zoff, v0, v1, mat="flat"):
        f = faces_all(mat, (0.5 - 0.5 * min(1, w / W), v0, 0.5 + 0.5 * min(1, w / W), v1))
        if mat == "flat": f["north"] = f["south"] = edge(v0, v1)
        m.box([-thick / 2, y0, -w / 2 + zoff], [thick, hgt, w], f)
    # --- lâmina
    y = yb; tip_len = max(3.0, L * 0.22)
    while y < yb + L - 0.01:
        k = y - yb; f = k / L; rest = L - k
        step = 0.5 if rest <= tip_len + 0.01 else 1.0
        w = W if rest > tip_len else W * max(0.12, rest / tip_len)
        if arch == "rapier": w = W * (1 - 0.55 * f)
        if arch == "katana": w = W * (0.92 if rest > 3 else max(0.22, rest / 3))
        zoff = (A["curve"] * (f ** 2)) if A["curve"] else 0.0
        v0, v1 = max(0, 1 - (k + step) / L), 1 - k / L
        layer(y, step, w, Tk * 0.45, zoff, v0, v1)                       # gume (fino e largo)
        layer(y, step, w * 0.68, Tk * 0.85, zoff, v0, v1)                 # corpo
        if arch != "katana": layer(y, step, max(0.25, w * 0.22), Tk * 1.15, zoff, v0, v1)   # espinha central
        if arch not in ("katana", "rapier") and w > 0.6:   # 6.36 (estilo Tensura-Blade): núcleo em losango, cubo girado 45° — chanfro real do gume
            q = min(w * 0.62, W * 0.55) / 1.4142
            m.box([-q / 2, y, -q / 2 + zoff], [q, step, q], faces_all("flat", (0.3, v0, 0.7, v1)), rot=[0, 45, 0], pivot=[0, y, zoff])
        y += step
    blade_top = yb + L
    # --- ornamentos por tema (ao longo da lâmina)
    mid = lambda t: yb + L * t
    if theme == "fire" and rank >= 2:
        for i, t in enumerate((0.18, 0.38, 0.58)):
            sgn = 1 if i % 2 == 0 else -1
            m.box([-0.2, mid(t), sgn * W / 2 - (0.3 if sgn > 0 else 1.1)], [0.4, 1.6, 1.4], faces_all("glow"), rot=[sgn * 35, 0, 0], pivot=[0, mid(t), sgn * W / 2])
    if theme == "ice" and rank >= 2:
        for i, t in enumerate((0.12, 0.30, 0.5)):
            sgn = 1 if i % 2 else -1
            m.box([-0.35, mid(t), sgn * W / 2 - 0.35], [0.7, 1.8 - i * 0.3, 0.7], faces_all("edge"), rot=[sgn * 50, 0, 20], pivot=[0, mid(t), sgn * W / 2])
    if theme == "storm" and rank >= 2:
        z = 0.0
        for i in range(int(L * 0.7)):
            z = 0.35 if i % 2 == 0 else -0.35
            m.box([-Tk * 0.62, yb + 1 + i, z - 0.15], [Tk * 1.24, 1.0, 0.3], faces_all("glow"))
    if theme in ("cosmic", "prism") and rank >= 3:
        for j, t in enumerate((0.35, 0.62)):
            r = W * 0.9 + 0.6
            for sx in (-1, 1):
                m.box([-0.1, mid(t) - 0.1, -r], [0.2, 0.2, 2 * r], faces_all("glow" if THEMES[theme]["glow"] else "accent"), rot=[0, 0, (25 + j * 30) * sx], pivot=[0, mid(t), 0])
        m.box([-0.6, blade_top - L * 0.12, -0.6], [1.2, 1.2, 1.2], faces_all("gem"), rot=[45, 45, 0], pivot=[0, blade_top - L * 0.12 + 0.6, 0])
    if theme in ("demon", "abyss") and rank >= 2:
        for i in range(1, int(L * 0.75), 2):
            m.box([-Tk * 0.2, yb + i, W / 2 - 0.15], [Tk * 0.4, 0.9, 1.0], faces_all("edge"), rot=[-40, 0, 0], pivot=[0, yb + i + 0.4, W / 2])
        m.box([-Tk * 0.7, yb + 0.6, -0.55], [Tk * 1.4, 1.1, 1.1], faces_all("gem"))          # olho
    if theme == "dragon":
        for i in range(1, int(L * 0.7), 2):
            m.box([-0.15, yb + i, -0.4], [0.3, 1.2, 0.8], faces_all("scale"), rot=[-30, 0, 0], pivot=[0, yb + i, 0])
    if theme == "sculk" and rank >= 2:
        for i, t in enumerate((0.1, 0.25, 0.4)):
            m.box([-0.2, mid(t), -W / 2 - 0.9], [0.4, 0.4, 1.2], faces_all("glow"), rot=[0, 0, 30 - i * 15], pivot=[0, mid(t), -W / 2])
    if rank >= 4 and THEMES[theme]["glow"] and arch not in ("katana", "rapier"):
        m.box([-Tk * 0.6, yb + 1.5, -0.2], [Tk * 1.2, L * 0.62, 0.4], faces_all("glow"))     # veio de energia
    # --- guarda
    G = A["guard"]
    if arch == "katana":
        for r in (0, 45):
            m.box([-1.9, gy, -1.9], [3.8, guard_h, 3.8], faces_all("guard"), rot=[0, r, 0], pivot=[0, gy, 0])
        m.box([-0.65, yb - 0.1, -1.3], [1.3, 1.3, 2.6], faces_all("accent"))
    else:
        m.box([-0.95, gy, -G / 2], [1.9, guard_h, G], faces_all("guard"))
        m.box([-1.1, gy + 0.2, -G / 2 + 0.6], [2.2, guard_h - 0.4, G - 1.2], faces_all("accent"))    # friso
        m.box([-0.75, gy + guard_h, -1.3], [1.5, 0.9, 2.6], faces_all("accent"))                      # colar
        tips = {"holy": "wing", "prism": "wing", "dragon": "claw", "demon": "horn", "abyss": "horn", "cosmic": "ring", "fire": "flame", "ice": "crystal"}.get(theme, "ball" if rank >= 2 else None)
        if arch in ("dagger", "rapier") and tips in ("horn", "claw", "wing"): tips = "ball"   # adagas: guarda compacta
        for sgn in (-1, 1):
            zt = sgn * G / 2
            if tips == "wing":
                for j in range(4):
                    m.box([-0.35, gy + 0.2 + j * 0.55, zt - (0 if sgn > 0 else 3.2 - j * 0.6)], [0.7, 0.55, 3.2 - j * 0.6], faces_all("accent" if j % 2 else "guard"), rot=[sgn * (22 + j * 13), 0, 0], pivot=[0, gy + 0.6, zt])
            elif tips in ("horn", "claw"):
                m.box([-0.55, gy, zt - 0.55], [1.1, 2.8, 1.1], faces_all("dark" if tips == "horn" else "scale"), rot=[-sgn * 30, 0, 0], pivot=[0, gy, zt])
                m.box([-0.38, gy + 2.4, zt - 0.38], [0.76, 1.6, 0.76], faces_all("dark" if tips == "horn" else "accent"), rot=[-sgn * 58, 0, 0], pivot=[0, gy + 2.4, zt])
            elif tips == "ring":
                m.box([-0.3, gy - 0.7, zt - 1.1], [0.6, 2.8, 2.2], faces_all("glow"), rot=[sgn * 45, 0, 0], pivot=[0, gy + 0.7, zt])
            elif tips == "flame":
                m.box([-0.3, gy, zt - 0.6], [0.6, 2.2, 1.2], faces_all("glow"), rot=[-sgn * 25, 0, 0], pivot=[0, gy, zt])
            elif tips == "crystal":
                m.box([-0.45, gy, zt - 0.45], [0.9, 2.4, 0.9], faces_all("edge"), rot=[-sgn * 35, 0, 15], pivot=[0, gy, zt])
            elif tips == "ball":
                m.box([-0.85, gy - 0.15, zt - 0.85], [1.7, 1.7, 1.7], faces_all("gem2"))
        if rank >= 2: m.box([-1.15, gy + 0.05, -0.8], [2.3, 1.3, 1.6], faces_all("gem"))
    # --- cabo com faixas e pomo
    gl = A["grip"]
    m.box([-0.6, gy - gl, -0.6], [1.2, gl, 1.2], faces_all("grip"))
    for k in range(1, int(gl), 2): m.box([-0.72, gy - k - 0.3, -0.72], [1.44, 0.45, 1.44], faces_all("accent" if arch != "katana" else "grip"))
    if arch == "katana": m.box([-0.78, gy - gl - 0.8, -0.88], [1.56, 0.8, 1.76], faces_all("accent"))
    else:
        m.box([-1.0, gy - gl - 1.5, -1.0], [2.0, 1.5, 2.0], faces_all("pommel"))
        m.box([-0.7, gy - gl - 1.2, -1.15], [1.4, 0.9, 2.3], faces_all("accent"))
        if rank >= 3: m.box([-0.6, gy - gl - 2.2, -0.6], [1.2, 0.9, 1.2], faces_all("gem"))
        if theme in ("holy", "prism") and rank >= 3:   # auréola no pomo
            m.box([-0.15, gy - gl - 3.4, -1.4], [0.3, 0.3, 2.8], faces_all("accent")); m.box([-0.15, gy - gl - 3.4, -1.4], [0.3, 0.3, 2.8], faces_all("accent"), rot=[90, 0, 0], pivot=[0, gy - gl - 3.25, 0])
    return m

# ------------------------------------------------------------------ conversão de modelos Java (elementos)
def java_model(path, texw=None, texh=None, ident=None):
    d = json.load(open(path)); ts = d.get("texture_size") or [16, 16]
    E = d["elements"]; tw, th = texw or ts[0], texh or ts[1]
    m = Model(tw, th)
    # eixo da lâmina = maior extensão; a ponta é o lado mais fino (menor seção perto do fim)
    mn = [min(e["from"][i] for e in E) for i in range(3)]; mx = [max(e["to"][i] for e in E) for i in range(3)]
    ax = max(range(3), key=lambda i: mx[i] - mn[i])
    def section(lo, hi):   # área total da seção perto de uma ponta
        return sum((e["to"][(ax + 1) % 3] - e["from"][(ax + 1) % 3]) * (e["to"][(ax + 2) % 3] - e["from"][(ax + 2) % 3]) for e in E if e["from"][ax] < hi and e["to"][ax] > lo)
    span = mx[ax] - mn[ax]
    tip_hi = section(mx[ax] - span * 0.12, mx[ax]) <= section(mn[ax], mn[ax] + span * 0.12)   # ponta no fim de maior coordenada?
    # empunhadura: ponto a ~10% do comprimento a partir da ponta oposta (cabo)
    grip_c = [(mn[i] + mx[i]) / 2 for i in range(3)]
    grip_c[ax] = mn[ax] + span * 0.10 if tip_hi else mx[ax] - span * 0.10
    # mapeia o eixo da lâmina para +Y (permutação de eixos com sinal, sem rotações arbitrárias)
    if ax == 1: P = (0, 1, 2); S = (1, 1 if tip_hi else -1, 1)
    elif ax == 2: P = (0, 2, 1); S = (1, 1 if tip_hi else -1, 1)
    else: P = (2, 0, 1); S = (1, 1 if tip_hi else -1, 1)
    # P[k] = eixo de origem que vira o eixo k de destino
    FACE = {0: ("east", "west"), 1: ("up", "down"), 2: ("south", "north")}
    def mapf(name):
        for src, (pos, neg) in FACE.items():
            if name in (pos, neg):
                dst = P.index(src); sgn = S[dst]; positive = (name == pos) == (sgn > 0)
                return FACE[dst][0 if positive else 1]
    def mp(v):
        out = [0, 0, 0]
        for k in range(3): out[k] = (v[P[k]] - grip_c[P[k]]) * S[k]
        return out
    for e in E:
        a, b = mp(e["from"]), mp(e["to"])
        o = [min(a[k], b[k]) for k in range(3)]; sz = [abs(b[k] - a[k]) for k in range(3)]
        fs = {}
        for fn, f in (e.get("faces") or {}).items():
            uv = f.get("uv") or [0, 0, 16, 16]
            u0, v0, u1, v1 = uv[0] * tw / 16, uv[1] * th / 16, uv[2] * tw / 16, uv[3] * th / 16
            if f.get("rotation") == 180: u0, v0, u1, v1 = u1, v1, u0, v0
            fs[mapf(fn)] = {"uv": [round(u0, 3), round(v0, 3)], "uv_size": [round(u1 - u0, 3), round(v1 - v0, 3)]}
        rot = pivot = None
        r = e.get("rotation")
        if r and r.get("angle"):
            src = "xyz".index(r["axis"]); dst = P.index(src); ang = r["angle"] * S[dst]
            # sinal: o Bedrock gira X e Y no sentido oposto ao das coordenadas Java (mesma conversão do Blockbench)
            rv = [0, 0, 0]; rv[dst] = -ang if dst in (0, 1) else ang
            rot, pivot = rv, mp(r["origin"])
        m.box(o, sz, fs, rot, pivot)
    return m

# ------------------------------------------------------------------ modelos .obj de cubos (Tensura-Blade, uso pessoal): o brilho é "assado" na textura
def obj_model(objp, texp, glowp, scale=0.62):
    from obj2cubes import cubes as obj_cubes
    base = Image.open(texp).convert("RGBA"); glow = Image.open(glowp).convert("RGBA")
    tw, th = base.size
    cs, _ = obj_cubes(objp, tw, th)
    B = [c for c in cs if c["mat"] != "dragon_glow"]; G = [c for c in cs if c["mat"] == "dragon_glow"]
    out = base.copy(); px = out.load(); gp = glow.load()
    for c in out.getdata(): pass
    # cada cubo de brilho cobre um cubo base: copia os pixels acesos para a face equivalente e marca alfa 0 (= emissivo no entity_emissive_alpha)
    def key(c): return tuple(round(v, 1) for v in c["origin"] + c["size"])
    lit = 0
    for g in G:
        b = min(B, key=lambda c: sum(abs(x - y) for x, y in zip(c["origin"] + c["size"], g["origin"] + g["size"])))
        for fn, uv in g["uv"].items():
            bu = b["uv"].get(fn)
            if not bu: continue
            gx, gy = uv["uv"]; gw, gh = uv["uv_size"]; bx, by = bu["uv"]; bw, bh = bu["uv_size"]
            n = max(1, int(round(max(abs(bw), abs(bh)))))
            for i in range(int(abs(bw)) or 1):
                for j in range(int(abs(bh)) or 1):
                    fu, fv = (i + 0.5) / max(1, abs(bw)), (j + 0.5) / max(1, abs(bh))
                    sx = int(gx + fu * gw) if gw >= 0 else int(gx + fu * gw - 1e-6)
                    sy = int(gy + fv * gh) if gh >= 0 else int(gy + fv * gh - 1e-6)
                    tx = int(bx + fu * bw) if bw >= 0 else int(bx + fu * bw - 1e-6)
                    ty = int(by + fv * bh) if bh >= 0 else int(by + fv * bh - 1e-6)
                    if 0 <= sx < tw and 0 <= sy < th and 0 <= tx < tw and 0 <= ty < th and gp[sx, sy][3] > 40:
                        r, g2, b2, _ = gp[sx, sy]; px[tx, ty] = (r, g2, b2, 0); lit += 1
    # pixels opacos do resto = 255 (o alfa 0 fica só no brilho)
    for y in range(th):
        for x in range(tw):
            r, g2, b2, a = px[x, y]
            if a not in (0,) and a < 255: px[x, y] = (r, g2, b2, 255)
    m = Model(tw, th)
    ys = [c["origin"][1] for c in B] + [c["origin"][1] + c["size"][1] for c in B]
    # empunhadura: centro do cabo = ponto mais baixo + 9% do comprimento (lâmina para +Y)
    y0 = min(ys) + (max(ys) - min(ys)) * 0.13
    xs = [c["origin"][0] + c["size"][0] / 2 for c in B]; zs = [c["origin"][2] + c["size"][2] / 2 for c in B]
    cx, cz = sum(xs) / len(xs), sum(zs) / len(zs)
    T = lambda p: [(p[0] - cx) * scale, (p[1] - y0) * scale, (p[2] - cz) * scale]
    for c in B:
        o = T(c["origin"]); sz = [v * scale for v in c["size"]]
        m.box(o, sz, c["uv"], c.get("rotation"), T(c["pivot"]) if "pivot" in c else None)
    m.yaw = 90
    return m, out, lit

# ------------------------------------------------------------------ exportação
def geo_json(gid, m):
    bones = [{"name": "rightArm", "pivot": [-5, 22, 0]}, {"name": "rightItem", "parent": "rightArm", "pivot": [-6, 15, 1]},
             {"name": "eth_weapon", "parent": "rightItem", "pivot": list(HAND), "rotation": HOLD_ROT, "cubes": []}]
    if getattr(m, "yaw", 0):
        bones.append({"name": "eth_model", "parent": "eth_weapon", "pivot": list(HAND), "rotation": [0, m.yaw, 0], "cubes": []})
    tgt = bones[-1]
    for c in m.cubes:
        c2 = json.loads(json.dumps(c))
        c2["origin"] = [round(c["origin"][k] + HAND[k], 4) for k in range(3)]
        if "pivot" in c: c2["pivot"] = [round(c["pivot"][k] + HAND[k], 4) for k in range(3)]
        tgt["cubes"].append(c2)
    return {"format_version": "1.16.0", "minecraft:geometry": [{"description": {"identifier": gid, "texture_width": m.tw, "texture_height": m.th,
            "visible_bounds_width": 4, "visible_bounds_height": 4.5, "visible_bounds_offset": [0, 1.25, 0]}, "bones": bones}]}
def attachable_json(iid, gid, tex, emissive):
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {"identifier": iid,
        "materials": {"default": "entity_emissive_alpha" if emissive else "entity_alphatest", "enchanted": "entity_alphatest_glint"},
        "textures": {"default": tex, "enchanted": "textures/misc/enchanted_item_glint"}, "geometry": {"default": gid},
        "render_controllers": ["controller.render.item_default"]}}}

# ------------------------------------------------------------------ renderizador de ícones (projeção ortográfica + pintor)
def corners(c):
    o, s = c["origin"], c["size"]
    pts = {}
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1): pts[(dx, dy, dz)] = [o[0] + s[0] * dx, o[1] + s[1] * dy, o[2] + s[2] * dz]
    if c.get("rotation"):
        rx, ry, rz = [math.radians(a) for a in c["rotation"]]; p0 = c["pivot"]
        def R(v):
            x, y, z = v[0] - p0[0], v[1] - p0[1], v[2] - p0[2]
            # convenção Bedrock (X e Y invertidos em relação à regra da mão direita)
            ax_, ay_ = -rx, -ry
            y, z = y * math.cos(ax_) - z * math.sin(ax_), y * math.sin(ax_) + z * math.cos(ax_)
            x, z = x * math.cos(ay_) + z * math.sin(ay_), -x * math.sin(ay_) + z * math.cos(ay_)
            x, y = x * math.cos(rz) - y * math.sin(rz), x * math.sin(rz) + y * math.cos(rz)
            return [x + p0[0], y + p0[1], z + p0[2]]
        pts = {k: R(v) for k, v in pts.items()}
    return pts
FACEPTS = {  # cantos (ordem: topo-esq, topo-dir, baixo-dir, baixo-esq na textura)
  "north": [(1, 1, 0), (0, 1, 0), (0, 0, 0), (1, 0, 0)], "south": [(0, 1, 1), (1, 1, 1), (1, 0, 1), (0, 0, 1)],
  "east": [(1, 1, 1), (1, 1, 0), (1, 0, 0), (1, 0, 1)], "west": [(0, 1, 0), (0, 1, 1), (0, 0, 1), (0, 0, 0)],
  "up": [(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)], "down": [(0, 0, 1), (1, 0, 1), (1, 0, 0), (0, 0, 0)],
}
def render_icon(m, tex, size=64, view=(-78, 14, -45), fill=0.86, outline=5):
    S = 4; W = size * S
    yaw, pitch, roll = [math.radians(a) for a in view]
    def V(p):
        x, y, z = p
        x, z = x * math.cos(yaw) + z * math.sin(yaw), -x * math.sin(yaw) + z * math.cos(yaw)
        y, z = y * math.cos(pitch) - z * math.sin(pitch), y * math.sin(pitch) + z * math.cos(pitch)
        x, y = x * math.cos(roll) - y * math.sin(roll), x * math.sin(roll) + y * math.cos(roll)
        return (x, y, z)
    polys = []
    for c in m.cubes:
        P = corners(c)
        for fn, uv in c["uv"].items():
            if not uv: continue
            q = [V(P[k]) for k in FACEPTS[fn]]
            n = ((q[1][0] - q[0][0]) * (q[3][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[3][0] - q[0][0]))
            polys.append((sum(p[2] for p in q) / 4, q, uv, fn))
    if not polys: return Image.new("RGBA", (size, size))
    xs = [p[0] for _, q, _, _ in polys for p in q]; ys = [p[1] for _, q, _, _ in polys for p in q]
    sc = (W * fill) / max(max(xs) - min(xs), max(ys) - min(ys)); cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    light = {"up": 1.0, "north": 0.82, "south": 0.82, "east": 0.68, "west": 0.95, "down": 0.5}
    texrgb = tex.convert("RGBA")
    for z, q, uv, fn in sorted(polys, key=lambda t: t[0]):
        dst = [((p[0] - cx) * sc + W / 2, W / 2 - (p[1] - cy) * sc) for p in q]
        k_ = texrgb.width / m.tw; u0, v0 = [q * k_ for q in uv["uv"]]; uw, vh = [q * k_ for q in uv["uv_size"]]
        src = [(u0, v0), (u0 + uw, v0), (u0 + uw, v0 + vh), (u0, v0 + vh)]
        # só a caixa da face é transformada (muito mais rápido que a tela inteira)
        bx0 = max(0, int(math.floor(min(p[0] for p in dst))) - 1); by0 = max(0, int(math.floor(min(p[1] for p in dst))) - 1)
        bx1 = min(W, int(math.ceil(max(p[0] for p in dst))) + 2); by1 = min(W, int(math.ceil(max(p[1] for p in dst))) + 2)
        if bx1 - bx0 < 1 or by1 - by0 < 1: continue
        dl = [(p[0] - bx0, p[1] - by0) for p in dst]
        try:
            coeffs = persp(dl, src)
            warped = texrgb.transform((bx1 - bx0, by1 - by0), Image.PERSPECTIVE, coeffs, Image.BILINEAR if texrgb.width > m.tw else Image.NEAREST)
        except Exception: continue
        mask = Image.new("L", (bx1 - bx0, by1 - by0), 0); ImageDraw.Draw(mask).polygon(dl, fill=255)
        r, g, b, a = warped.split(); a = a.point(lambda v: 255)     # ícone opaco (o alfa da textura é brilho, não transparência)
        if texrgb.mode == "RGBA" and m.tw != AT and not getattr(m, "opaque", False): a = warped.split()[3].point(lambda v: 255 if v > 20 else 0)
        f = light.get(fn, 0.8)
        shaded = Image.merge("RGBA", (r.point(lambda v: int(v * f)), g.point(lambda v: int(v * f)), b.point(lambda v: int(v * f)), a))
        m2 = Image.composite(mask, Image.new("L", mask.size, 0), a)
        out.paste(shaded, (bx0, by0), m2)
    # contorno escuro (leitura no inventário) + redução
    alpha = out.split()[3]; edge = alpha.filter(ImageFilter.MaxFilter(outline))
    outline = Image.new("RGBA", (W, W), (12, 10, 18, 255)); base = Image.new("RGBA", (W, W), (0, 0, 0, 0)); base.paste(outline, (0, 0), edge); base.alpha_composite(out)
    small = base.resize((size, size), Image.LANCZOS)
    if size >= 96: small = Image.merge("RGBA", (*small.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=1)).split(), small.split()[3]))
    return small
def persp(dst, src):
    # coeficientes PIL: mapeia ponto de SAÍDA (dst) -> ENTRADA (src)
    import numpy as np
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    return list(np.linalg.solve(np.array(A, float), np.array(B, float)))

# ------------------------------------------------------------------ principal
CONVERTED = {   # item -> (modelo, textura)
  # "rimuru_katana": substituída pela katana v3 (referência preta/azul)
  "_rimuru_katana_old": ("SlimeThroneExtras/assets/stextras/models/item/rimuru_katana.json", "SlimeThroneExtras/assets/stextras/textures/item/rimuru_katana.png"),
  "uraku_katana": ("tensura_minesura/assets/tensura_minesura/models/item/uraku_katana.json", "tensura_minesura/assets/tensura_minesura/textures/item/uraku_katana.png"),
  "green_dragon_blade": ("tensura_minesura/assets/tensura_minesura/models/item/green_dragon_blade.json", "tensura_minesura/assets/tensura_minesura/textures/item/green_dragon_blade_0.png"),
  "soul_serpent_blade": ("tensura_minesura/assets/tensura_minesura/models/item/soul_serpent_blade.json", "tensura_minesura/assets/tensura_minesura/textures/item/soul_serpent_blade.png"),
  "extermination_blade": ("tensuramoreskills/assets/tensuramoreskills/models/item/extermination_blade.json", "tensuramoreskills/assets/tensuramoreskills/textures/item/extermination_blade.png"),
  "rimuru_sword": ("@CIT/rimurus_sword.json", "@CIT/rimurus_sword.png"),
}
def main():
    W = [w for w in load_weapons() if w.get("wtype") in ("sword", "dagger")]
    os.makedirs(os.path.join(RP, "textures/attachable"), exist_ok=True)
    report = []
    for w in W:
        iid = w["id"]; sid = iid.split(":")[1]; rank = RARITY_RANK.get(w.get("rarity"), 1)
        gid = f"geometry.etheria_w_{sid}"; texrel = f"textures/attachable/w_{sid}"
        view = (-78, 14, -45)
        if sid in OBJ_MODELS and TB_DIR:
            o, t, g = [os.path.join(TB_DIR, p) for p in OBJ_MODELS[sid]]
            m, tex, _ = obj_model(o, t, g); src = "convertido (obj Tensura-Blade)"; emissive = True; view = (12, 14, -45)
        elif sid in CONVERTED and SRC_MODELS:
            mp_, tp_ = [p.replace("@CIT", SRC_CIT) if p.startswith("@CIT") else os.path.join(SRC_MODELS, p) for p in CONVERTED[sid]]
            tex = Image.open(tp_).convert("RGBA"); m = java_model(mp_, tex.size[0], tex.size[1]); src = "convertido"
            emissive = False
        else:
            th, ar = theme_of(w), arch_of(w)
            tex = paint_hd(th, rank, sid, ar); m = build_procedural(th, ar, rank, sid); src = f"procedural {ar}/{th} HD"
            emissive = rank >= 4 and THEMES[th]["glow"] is not None
            if not emissive: tex.putalpha(255)
        if tex.width <= AT: tex = smooth_up(tex, max(1, (AT * HD) // tex.width) if tex.width < AT * HD else 1)
        tex.quantize(256, method=Image.Quantize.FASTOCTREE).save(os.path.join(RP, texrel + ".png"), optimize=True)
        json.dump(geo_json(gid, m), open(os.path.join(RP, f"models/entity/etheria_w_{sid}.geo.json"), "w"), indent=1)
        json.dump(attachable_json(iid, gid, texrel, emissive), open(os.path.join(RP, f"attachables/w_{sid}.attachable.json"), "w"), indent=1)
        it = tex.copy(); it.putalpha(255) if emissive else None
        icon = render_icon(m, it, size=160, view=view, fill=0.97, outline=9); icon.quantize(256, method=Image.Quantize.FASTOCTREE).save(os.path.join(RP, f"textures/items/etheria_{sid}.png"))
        report.append((sid, src, len(m.cubes)))
    for r in report: print(*r)
    print(len(report), "armas")
if __name__ == "__main__": main()

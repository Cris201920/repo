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
  "sakura":   dict(blade=(200, 206, 214), edge=(250, 250, 255), guard=(60, 40, 40), accent=(240, 150, 180), grip=(130, 30, 50), gem=(255, 150, 190), glow=None, rune=None),
}
def theme_of(w):
    i = w["id"]
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
  "katana": dict(L=24, W=2.2, T=0.9, grip=8, guard=3.6, curve=2.2),
  "great":  dict(L=30, W=5.0, T=1.4, grip=9, guard=11.0, curve=0),
}
def build_procedural(theme, arch, rank, iid):
    A = ARCH[arch]; m = Model(); L, W, Tk = A["L"], A["W"], A["T"]
    gy = 0.0                                  # topo do cabo / base da guarda
    guard_h = 1.4 if arch != "katana" else 0.8
    yb = gy + guard_h                         # base da lâmina
    # --- lâmina: segmentos de 1 px (ponta afinando em degraus de 0,5 px); katana curva (deslocamento em Z)
    segs = int(L); tip = max(3, int(L * 0.22))
    for k in range(segs):
        y0 = yb + k; f = k / segs
        w = W if k < segs - tip else W * max(0.18, (segs - k) / tip)
        if arch == "rapier": w = W * (1 - 0.5 * f)
        if arch == "katana": w = W * (0.9 if k < segs - 3 else max(0.25, (segs - k) / 3))
        zoff = (A["curve"] * (f ** 2)) if A["curve"] else 0.0
        v0, v1 = 1 - (k + 1) / segs, 1 - k / segs
        sub = (0.5 - 0.5 * w / W, v0, 0.5 + 0.5 * w / W, v1)
        flat = {"uv": None}
        # núcleo (espinha), mais grosso
        core_w = max(0.3, w * 0.55)
        fc = faces_all("flat", (0.5 - 0.5 * core_w / W, v0, 0.5 + 0.5 * core_w / W, v1))
        fc["north"] = fc["south"] = {"uv": rect("edge", (0, v0, 1, v1))[:2], "uv_size": rect("edge", (0, v0, 1, v1))[2:]}
        m.box([-Tk / 2, y0, -core_w / 2 + zoff], [Tk, 1, core_w], fc)
        # gume chanfrado: mais fino, mais largo
        fe = faces_all("flat", sub)
        fe["north"] = fe["south"] = {"uv": rect("edge", (0, v0, 1, v1))[:2], "uv_size": rect("edge", (0, v0, 1, v1))[2:]}
        m.box([-Tk / 4, y0, -w / 2 + zoff], [Tk / 2, 1, w], fe)
        # serrilhado demoníaco / escamas dracônicas
        if theme in ("demon", "abyss") and rank >= 3 and k % 3 == 1 and k < segs - tip:
            m.box([-Tk / 4, y0 + 0.2, w / 2 + zoff - 0.2], [Tk / 2, 0.7, 0.9], faces_all("edge"), rot=[-35, 0, 0], pivot=[0, y0 + 0.5, w / 2 + zoff])
        if theme == "dragon" and k % 2 == 0 and k < segs - tip:
            m.box([-Tk * 0.75, y0, -0.35 + zoff], [Tk * 1.5, 0.8, 0.7], faces_all("scale"))
    # --- guarda
    G = A["guard"]
    if arch == "katana":   # tsuba: octógono (dois quadrados a 45°) + habaki
        for r in (0, 45):
            m.box([-0.5, gy, -1.8], [1.0, guard_h, 3.6], faces_all("guard"), rot=[0, r, 0], pivot=[0, gy, 0]) if False else \
            m.box([-1.8, gy, -1.8], [3.6, guard_h, 3.6], faces_all("guard"), rot=[0, r, 0], pivot=[0, gy, 0])
        m.box([-0.6, yb, -1.3], [1.2, 1.2, 2.6], faces_all("accent"))
    else:
        m.box([-0.9, gy, -G / 2], [1.8, guard_h, G], faces_all("guard"))
        m.box([-0.7, gy + guard_h, -1.2], [1.4, 0.8, 2.4], faces_all("accent"))          # ricasso / colar
        tips = {"holy": "wing", "dragon": "claw", "demon": "horn", "abyss": "horn", "cosmic": "ring"}.get(theme, "ball" if rank >= 2 else None)
        for s in (-1, 1):
            zt = s * G / 2
            if tips == "wing":
                for j in range(3):
                    m.box([-0.4, gy + 0.3 + j * 0.7, zt - (0 if s > 0 else 2.6)], [0.8, 0.6, 2.6 - j * 0.6], faces_all("accent"), rot=[s * (25 + j * 12), 0, 0], pivot=[0, gy + 0.6, zt])
            elif tips in ("horn", "claw"):
                m.box([-0.5, gy, zt - 0.5], [1.0, 2.6, 1.0], faces_all("dark" if tips == "horn" else "scale"), rot=[-s * 30, 0, 0], pivot=[0, gy, zt])
                m.box([-0.35, gy + 2.2, zt - 0.35], [0.7, 1.4, 0.7], faces_all("dark" if tips == "horn" else "accent"), rot=[-s * 55, 0, 0], pivot=[0, gy + 2.2, zt])
            elif tips == "ring":
                m.box([-0.3, gy - 0.6, zt - 1.0], [0.6, 2.6, 2.0], faces_all("glow"), rot=[s * 45, 0, 0], pivot=[0, gy + 0.7, zt])
            elif tips == "ball":
                m.box([-0.8, gy - 0.1, zt - 0.8], [1.6, 1.6, 1.6], faces_all("gem2"))
        if rank >= 2:   # gema central (dos dois lados)
            m.box([-1.1, gy + 0.05, -0.75], [2.2, 1.3, 1.5], faces_all("gem"))
    # --- cabo com faixas
    gl = A["grip"]
    m.box([-0.6, gy - gl, -0.6], [1.2, gl, 1.2], faces_all("grip"))
    for k in range(1, int(gl), 2):
        m.box([-0.7, gy - k - 0.3, -0.7], [1.4, 0.4, 1.4], faces_all("accent" if arch != "katana" else "grip"))
    # --- pomo
    if arch == "katana": m.box([-0.75, gy - gl - 0.8, -0.85], [1.5, 0.8, 1.7], faces_all("accent"))
    else:
        m.box([-0.95, gy - gl - 1.4, -0.95], [1.9, 1.4, 1.9], faces_all("pommel"))
        if rank >= 3: m.box([-0.6, gy - gl - 2.1, -0.6], [1.2, 0.8, 1.2], faces_all("gem"))
    # --- energia (lendárias e míticas): núcleo luminoso no sulco
    if rank >= 4 and THEMES[theme]["glow"] and arch not in ("katana", "rapier"):
        m.box([-Tk / 2 - 0.05, yb + 2, -0.35], [Tk + 0.1, L * 0.6, 0.7], faces_all("glow"))
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

# ------------------------------------------------------------------ exportação
def geo_json(gid, m):
    bones = [{"name": "rightArm", "pivot": [-5, 22, 0]}, {"name": "rightItem", "parent": "rightArm", "pivot": [-6, 15, 1]},
             {"name": "eth_weapon", "parent": "rightItem", "pivot": list(HAND), "rotation": HOLD_ROT, "cubes": []}]
    for c in m.cubes:
        c2 = json.loads(json.dumps(c))
        c2["origin"] = [round(c["origin"][k] + HAND[k], 4) for k in range(3)]
        if "pivot" in c: c2["pivot"] = [round(c["pivot"][k] + HAND[k], 4) for k in range(3)]
        bones[2]["cubes"].append(c2)
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
def render_icon(m, tex, size=64, view=(-78, 14, -45)):
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
    sc = (W * 0.86) / max(max(xs) - min(xs), max(ys) - min(ys)); cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    light = {"up": 1.0, "north": 0.82, "south": 0.82, "east": 0.68, "west": 0.95, "down": 0.5}
    texrgb = tex.convert("RGBA")
    for z, q, uv, fn in sorted(polys, key=lambda t: t[0]):
        dst = [((p[0] - cx) * sc + W / 2, W / 2 - (p[1] - cy) * sc) for p in q]
        u0, v0 = uv["uv"]; uw, vh = uv["uv_size"]
        src = [(u0, v0), (u0 + uw, v0), (u0 + uw, v0 + vh), (u0, v0 + vh)]
        try:
            coeffs = persp(dst, src)
            warped = texrgb.transform((W, W), Image.PERSPECTIVE, coeffs, Image.NEAREST)
        except Exception: continue
        mask = Image.new("L", (W, W), 0); ImageDraw.Draw(mask).polygon(dst, fill=255)
        r, g, b, a = warped.split(); a = a.point(lambda v: 255)     # ícone opaco (o alfa da textura é brilho, não transparência)
        if texrgb.mode == "RGBA" and m.tw != AT: a = warped.split()[3].point(lambda v: 255 if v > 20 else 0)
        f = light.get(fn, 0.8)
        shaded = Image.merge("RGBA", (r.point(lambda v: int(v * f)), g.point(lambda v: int(v * f)), b.point(lambda v: int(v * f)), a))
        m2 = Image.composite(mask, Image.new("L", (W, W), 0), a)
        out.paste(shaded, (0, 0), m2)
    # contorno escuro (leitura no inventário) + redução
    alpha = out.split()[3]; edge = alpha.filter(ImageFilter.MaxFilter(5))
    outline = Image.new("RGBA", (W, W), (12, 10, 18, 255)); base = Image.new("RGBA", (W, W), (0, 0, 0, 0)); base.paste(outline, (0, 0), edge); base.alpha_composite(out)
    return base.resize((size, size), Image.LANCZOS)
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
  "rimuru_katana": ("SlimeThroneExtras/assets/stextras/models/item/rimuru_katana.json", "SlimeThroneExtras/assets/stextras/textures/item/rimuru_katana.png"),
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
        if sid in CONVERTED and SRC_MODELS:
            mp_, tp_ = [p.replace("@CIT", SRC_CIT) if p.startswith("@CIT") else os.path.join(SRC_MODELS, p) for p in CONVERTED[sid]]
            tex = Image.open(tp_).convert("RGBA"); m = java_model(mp_, tex.size[0], tex.size[1]); src = "convertido"
            emissive = False
        else:
            th, ar = theme_of(w), arch_of(w)
            tex = paint(th, rank, sid, ar); m = build_procedural(th, ar, rank, sid); src = f"procedural {ar}/{th}"
            emissive = rank >= 4 and THEMES[th]["glow"] is not None
            if not emissive: tex.putalpha(255)
        tex.save(os.path.join(RP, texrel + ".png"))
        json.dump(geo_json(gid, m), open(os.path.join(RP, f"models/entity/etheria_w_{sid}.geo.json"), "w"), indent=1)
        json.dump(attachable_json(iid, gid, texrel, emissive), open(os.path.join(RP, f"attachables/w_{sid}.attachable.json"), "w"), indent=1)
        icon = render_icon(m, tex); icon.save(os.path.join(RP, f"textures/items/etheria_{sid}.png"))
        report.append((sid, src, len(m.cubes)))
    for r in report: print(*r)
    print(len(report), "armas")
if __name__ == "__main__": main()

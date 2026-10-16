# 6.52 - SKINS DOS FIÉIS DO DRAGÃO (Domínio de Milim Nava), desenhadas pixel a pixel a partir da descrição canônica (wiki de Tensura):
#   Middray  - Sumo Sacerdote, dragonato alto e musculoso, careca, marca no meio da testa, vestes de sacerdote (azul, como os Fiéis).
#   Hermes   - assistente de Middray, cabelo prateado, olhos azuis, vestes de sacerdote, marca na testa.
#   Stella   - aprendiz de sacerdote guerreira, cabelo azul em maria-chiquinha fina, olhos azuis, tiara, roupa azul.
# Layout padrão 64x64 (braços largos) + camada externa. Stella ganha geometria própria com as maria-chiquinhas em 3D (UV na área livre).
import json, os, random
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
def hx(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
def sh(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (c[3],)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
CLEAR = (0, 0, 0, 0)

# caixas: nome -> (origem u, v, largura, altura, profundidade) no layout padrão; faces: top, bottom, right, front, left, back
BOX = {"head": (0, 0, 8, 8, 8), "hat": (32, 0, 8, 8, 8), "body": (16, 16, 8, 12, 4), "jacket": (16, 32, 8, 12, 4),
       "rarm": (40, 16, 4, 12, 4), "rsleeve": (40, 32, 4, 12, 4), "larm": (32, 48, 4, 12, 4), "lsleeve": (48, 48, 4, 12, 4),
       "rleg": (0, 16, 4, 12, 4), "rpants": (0, 32, 4, 12, 4), "lleg": (16, 48, 4, 12, 4), "lpants": (0, 48, 4, 12, 4)}
def faces(u, v, w, h, d):
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d), "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
            "left": (u + d + w, v + d, d, h), "back": (u + d + w + d, v + d, w, h)}
class Skin:
    def __init__(s, seed): s.im = Image.new("RGBA", (64, 64), CLEAR); s.px = s.im.load(); s.rnd = random.Random(seed)
    def paint(s, box, fn):
        """fn(face, x, y, w, h) -> cor (ou None = transparente). x,y dentro da face; y=0 é o alto (frente/costas/lados) ."""
        for f, (u, v, w, h) in faces(*BOX[box]).items():
            for y in range(h):
                for x in range(w):
                    c = fn(f, x, y, w, h)
                    if c is not None: s.px[u + x, v + y] = c
    def set(s, box, face, x, y, c):
        u, v, w, h = faces(*BOX[box])[face]; s.px[u + x, v + y] = c
    def noise(s, c, a=0.05): return sh(c, 1 + s.rnd.uniform(-a, a))

# ------------------------------------------------------------------ peças comuns
def face_skin(S, skin, top=None):
    """cabeça: pele com sombreado (o alto pode ser outra cor = cabelo)"""
    def f(face, x, y, w, h):
        if face == "top": return S.noise(top or sh(skin, 1.04), 0.04)
        if face == "bottom": return sh(skin, 0.8)
        k = 1.04 - 0.1 * (y / h)
        if face in ("right", "left") and (x == 0 or x == w - 1): k *= 0.94
        return S.noise(sh(skin, k), 0.02)
    S.paint("head", f)
def eyes(S, iris, white=(250, 250, 250, 255), y=4, brow=None, stern=False):
    for (a, b) in ((1, 2), (5, 6)):
        S.set("head", "front", a, y, white if a < 4 else sh(iris, 1.25)); S.set("head", "front", b, y, sh(iris, 1.25) if a < 4 else white)
        S.set("head", "front", a, y + 1, sh(iris, 0.75) if a < 4 else iris); S.set("head", "front", b, y + 1, iris if a < 4 else sh(iris, 0.75))
        if not stern:
            S.set("head", "front", a if a < 4 else b, y, white)    # brilho
        if brow: S.set("head", "front", a, y - 1, brow); S.set("head", "front", b, y - 1, brow)
def mouth(S, c, y=6, wide=False):
    for x in ((3, 4) if not wide else (2, 3, 4, 5)): S.set("head", "front", x, y, c)

def robe_body(S, base, trim, sash, inner=None, open_chest=None, emblem=None):
    """túnica de sacerdote: dobras verticais, gola em V com debrum, faixa na cintura, emblema dracônico dourado nas costas"""
    def f(face, x, y, w, h):
        if face == "top": return sh(base, 1.05)
        if face == "bottom": return sh(base, 0.7)
        c = base
        fold = (x % 3 == 2) and face in ("front", "back")
        k = 1.08 - 0.22 * (y / h) - (0.08 if fold else 0)
        if face in ("right", "left"): k *= 0.88
        c = sh(c, k)
        if y in (7, 8): c = sh(sash, 1.0 if y == 7 else 0.82)                         # faixa
        if face == "front":
            v = abs(x - 3.5)
            if y < 6 and v < 3 - y * 0.45:                                            # gola em V
                c = open_chest(x, y) if open_chest else (inner or sh(trim, 0.9))
            elif y < 7 and abs(v - (3 - y * 0.45)) < 0.6: c = trim                     # debrum da gola
            if y > 8 and x in (3, 4): c = sh(trim, 0.95 if x == 3 else 0.8)            # aba central
        if face == "back" and emblem and 1 <= y <= 5 and 2 <= x <= 5:                 # emblema do dragão
            e = emblem[y - 1][x - 2]
            if e != ".": c = sh(trim, 1.15 if e == "#" else 0.85)
        return S.noise(c, 0.03)
    S.paint("body", f)
def plain_leg(S, box, base, boot, boot_h=3, stripe=None):
    def f(face, x, y, w, h):
        if face == "top": return sh(base, 1.0)
        if face == "bottom": return sh(boot, 0.6)
        c = boot if y >= h - boot_h else base
        k = 1.05 - 0.2 * (y / h)
        if face in ("right", "left"): k *= 0.9
        if y == h - boot_h and c == boot: k *= 1.2
        if stripe and face == "front" and y < h - boot_h and x == (1 if box == "rleg" else 2): c = stripe
        return S.noise(sh(c, k), 0.03)
    S.paint(box, f)
def sleeve_arm(S, box, cloth, cuff, skin, cuff_y=9, bare_from=None):
    def f(face, x, y, w, h):
        if face == "top": return sh(cloth if bare_from is None else skin, 1.05)
        if face == "bottom": return sh(skin, 0.85)
        if bare_from is not None and y >= bare_from:
            c = skin
            k = 1.04 - 0.12 * ((y - bare_from) / max(1, h - bare_from))
            if x in (0, w - 1): k *= 0.9                                                # volume do músculo
            if y in (bare_from + 2, bare_from + 3) and face == "front" and x in (1, 2): k *= 1.08
            if y >= h - 2: c, k = cuff, 1.0                                            # bracelete
            return S.noise(sh(c, k), 0.02)
        if y >= h - 1: return sh(skin, 0.95)                                           # mão
        c = cuff if cuff_y <= y < cuff_y + 2 else cloth
        k = 1.06 - 0.2 * (y / h) - (0.07 if x == 2 and face in ("front", "back") else 0)
        if face in ("right", "left"): k *= 0.9
        return S.noise(sh(c, k), 0.03)
    S.paint(box, f)
def overlay_clear(S):
    for b in ("hat", "jacket", "rsleeve", "lsleeve", "rpants", "lpants"): S.paint(b, lambda *a: CLEAR)
def robe_skirt(S, base, trim, length=8):
    """saia da túnica na camada externa das pernas (cai sobre as calças)"""
    for box in ("rpants", "lpants"):
        def f(face, x, y, w, h, box=box):
            if face in ("top", "bottom") or y >= length: return None
            if (face == "left" and box == "rpants") or (face == "right" and box == "lpants"): return None   # entre as pernas
            c = trim if y >= length - 1 else base
            k = 1.0 - 0.18 * (y / length) - (0.08 if x % 2 and face in ("front", "back") else 0)
            if face in ("right", "left"): k *= 0.88
            return S.noise(sh(c, k), 0.03)
        S.paint(box, f)
EMBLEM = ["..#.", ".##.", "####", ".##.", "#..#"]

# ------------------------------------------------------------------ Middray
def middray():
    S = Skin(11); skin = hx("#c98e66"); robe = hx("#2f5aa8"); trim = hx("#e2c160"); sash = hx("#f2f2f6"); pants = hx("#1f3c78")
    face_skin(S, skin, top=sh(skin, 1.08))
    for x in range(8):                                                       # cabeça raspada: leve brilho no topo
        S.set("head", "top", x, 3, sh(skin, 1.15)); S.set("head", "top", x, 4, sh(skin, 1.12))
    brow = hx("#3a2010")
    for x in (1, 2, 5, 6): S.set("head", "front", x, 3, brow)                # sobrancelhas grossas, olhar sério
    S.set("head", "front", 1, 4, (245, 240, 230, 255)); S.set("head", "front", 2, 4, hx("#4a2a14"))
    S.set("head", "front", 5, 4, hx("#4a2a14")); S.set("head", "front", 6, 4, (245, 240, 230, 255))
    for x in (1, 2, 5, 6): S.set("head", "front", x, 5, sh(skin, 0.9))        # olheira leve
    S.set("head", "front", 3, 2, hx("#8a1a2a")); S.set("head", "front", 4, 2, hx("#a02434"))   # marca no meio da testa
    S.set("head", "front", 3, 5, sh(skin, 0.85)); S.set("head", "front", 4, 5, sh(skin, 0.85))  # nariz
    mouth(S, hx("#7a3a2a"), y=6, wide=True); S.set("head", "front", 2, 6, sh(skin, 0.8)); S.set("head", "front", 5, 6, sh(skin, 0.8))
    for x in range(8): S.set("head", "front", x, 7, sh(skin, 0.88))          # queixo largo
    chest = lambda x, y: sh(skin, 1.0 - 0.06 * y + (0.06 if x in (2, 5) else 0) - (0.1 if x in (3, 4) and y > 2 else 0))  # peitoral à mostra
    robe_body(S, robe, trim, sash, open_chest=chest, emblem=EMBLEM)
    for box in ("rarm", "larm"): sleeve_arm(S, box, robe, trim, skin, bare_from=3)   # sem mangas: braços musculosos
    for box in ("rleg", "lleg"): plain_leg(S, box, pants, hx("#5a3a22"), boot_h=2, stripe=trim)
    overlay_clear(S)
    def mantle(face, x, y, w, h):                                            # ombreira/manto curto nos ombros
        if face == "top": return sh(robe, 1.15)
        if y < 3 and face != "bottom": return S.noise(sh(trim if y == 2 else robe, 1.05 - 0.05 * y), 0.03)
        return None
    S.paint("rsleeve", mantle); S.paint("lsleeve", mantle)
    robe_skirt(S, robe, trim, length=7)
    return S.im

# ------------------------------------------------------------------ Hermes
def hermes():
    S = Skin(23); skin = hx("#f0cfb4"); hair = hx("#c9ceda"); robe = hx("#3a68b8"); trim = hx("#e8d27a"); sash = hx("#f4f4fa"); inner = hx("#f4f4fa")
    face_skin(S, skin)
    eyes(S, hx("#3a7ae0"), y=4, brow=None)
    S.set("head", "front", 3, 2, hx("#e8c050")); S.set("head", "front", 4, 2, hx("#f0d070"))   # marca dourada na testa
    mouth(S, hx("#c07a6a"), y=6)
    def hairf(face, x, y, w, h):                                            # cabelo prateado: franja, laterais até a orelha, nuca
        hk = 1.12 - 0.25 * (y / h) - (0.1 if x % 3 == 1 else 0)
        c = sh(hair, hk)
        if face == "top": return S.noise(sh(hair, 1.1 - (0.1 if x % 3 == 1 else 0)), 0.03)
        if face == "front": return S.noise(c, 0.02) if y < 2 or (y == 2 and x in (0, 1, 6, 7)) or (y < 5 and x in (0, 7)) else None
        if face in ("right", "left"): return S.noise(c, 0.02) if y < 5 or (face == "right" and x < 2 and y < 6) or (face == "left" and x > 5 and y < 6) else None
        if face == "back": return S.noise(c, 0.02) if y < 7 else None
        return None
    for f_, (u, v, w, h) in faces(*BOX["head"]).items():
        for y in range(h):
            for x in range(w):
                c = hairf(f_, x, y, w, h)
                if c: S.px[u + x, v + y] = c
    def hatf(face, x, y, w, h):                                             # camada externa: volume do cabelo + mechas
        if face == "top": return S.noise(sh(hair, 1.15 - (0.12 if (x + y) % 4 == 0 else 0)), 0.03)
        if face == "front": return S.noise(sh(hair, 1.12), 0.03) if y == 0 or (y == 1 and x in (0, 2, 5, 7)) else None
        if face in ("right", "left", "back"): return S.noise(sh(hair, 1.05 - 0.2 * y / h - (0.1 if x % 2 else 0)), 0.03) if y < (6 if face != "back" else 8) else None
        return None
    overlay_clear(S); S.paint("hat", hatf)
    robe_body(S, robe, trim, sash, inner=inner, emblem=EMBLEM)
    for box in ("rarm", "larm"): sleeve_arm(S, box, robe, sash, skin, cuff_y=9)
    for box in ("rleg", "lleg"): plain_leg(S, box, hx("#2a4a8a"), hx("#3a2a24"), boot_h=3)
    robe_skirt(S, robe, trim, length=10)
    def cuff(face, x, y, w, h):                                             # punhos largos (camada externa)
        if face in ("top", "bottom"): return None
        return S.noise(sh(trim if y == 10 else sash, 1.0 - 0.05 * (y - 8)), 0.02) if 8 <= y <= 10 else None
    S.paint("rsleeve", cuff); S.paint("lsleeve", cuff)
    return S.im

# ------------------------------------------------------------------ Stella
def stella():
    S = Skin(37); skin = hx("#f6dcc6"); hair = hx("#3c78d8"); dress = hx("#3f74c8"); trim = hx("#f4f4fa"); gold = hx("#e8c860")
    face_skin(S, skin)
    eyes(S, hx("#2a64d0"), y=4)
    S.set("head", "front", 1, 6, hx("#f0b0b0")); S.set("head", "front", 6, 6, hx("#f0b0b0"))  # bochechas
    S.set("head", "front", 3, 6, hx("#c06a6a")); S.set("head", "front", 4, 6, hx("#c06a6a"))
    def hairf(face, x, y, w, h):
        c = sh(hair, 1.12 - 0.3 * (y / h) - (0.1 if x % 2 else 0))
        if face == "top": return S.noise(sh(hair, 1.12 - (0.1 if x % 2 else 0)), 0.03) if not (y == 2) else sh(trim, 1.0)   # tiara branca
        if face == "front":
            if y == 0: return sh(trim, 1.0)                                         # tiara
            if y < 3 and not (y == 2 and 2 <= x <= 5): return S.noise(c, 0.02)       # franja
            if x in (0, 7) and y < 6: return S.noise(c, 0.02)
            return None
        if face in ("right", "left"): return sh(trim, 1.0) if y == 0 and x in (2, 3) else (S.noise(c, 0.02) if y < 6 else None)
        if face == "back": return S.noise(c, 0.02)
        return None
    for f_, (u, v, w, h) in faces(*BOX["head"]).items():
        for y in range(h):
            for x in range(w):
                c = hairf(f_, x, y, w, h)
                if c: S.px[u + x, v + y] = c
    overlay_clear(S)
    def hatf(face, x, y, w, h):
        if face == "top": return S.noise(sh(hair, 1.15 - (0.12 if x % 3 == 0 else 0)), 0.03) if y != 2 else trim
        if face == "front": return trim if y == 0 and 1 <= x <= 6 else None
        if face in ("right", "left"): return trim if y == 0 and x in (2, 3) else None
        if face == "back": return S.noise(sh(hair, 1.05 - 0.15 * y / h), 0.03) if y < 7 else None
        return None
    S.paint("hat", hatf)
    robe_body(S, dress, trim, gold, inner=trim, emblem=EMBLEM)
    for box in ("rarm", "larm"): sleeve_arm(S, box, dress, trim, skin, cuff_y=8)
    for box in ("rleg", "lleg"): plain_leg(S, box, skin, hx("#2a3a6a"), boot_h=5)   # meias/botas altas
    robe_skirt(S, dress, trim, length=6)
    # maria-chiquinhas 3D: textura na área livre (56..63, 0..15)
    for y in range(16):
        for x in range(8):
            S.px[56 + x, y] = S.noise(sh(hair, 1.1 - 0.35 * (y / 15) - (0.1 if x % 2 else 0)), 0.03)
    for x in range(8): S.px[56 + x, 0] = trim                                  # laço
    return S.im

def stella_geo():
    g = json.load(open(os.path.join(RP, "models/entity/etheria_benimaru_skin.geo.json")))
    G = g["minecraft:geometry"][0]; G["description"]["identifier"] = "geometry.etheria_stella_skin"
    head = next(b for b in G["bones"] if b["name"] == "head")
    uv = lambda w, h: {k: {"uv": [56, 0], "uv_size": [w, h]} for k in ("north", "south", "east", "west", "up", "down")}
    for sx in (1, -1):   # duas mechas finas presas atrás das orelhas, caindo até o meio das costas
        x0 = 4.2 if sx > 0 else -5.6
        head["cubes"] = head.get("cubes", []) + [
            {"origin": [x0, 26.5, 0.5], "size": [1.4, 5.5, 1.4], "uv": uv(2, 8), "rotation": [8, 0, 6 * sx], "pivot": [x0 + 0.7, 32, 1.2]},
            {"origin": [x0 + 0.2 * sx, 21.5, 1.0], "size": [1.0, 5.2, 1.0], "uv": uv(2, 8), "rotation": [10, 0, 4 * sx], "pivot": [x0 + 0.7, 32, 1.2]},
            {"origin": [x0 - 0.1, 31.0, 0.2], "size": [1.6, 1.0, 1.6], "uv": {k: {"uv": [56, 0], "uv_size": [2, 1]} for k in ("north", "south", "east", "west", "up", "down")}, "rotation": [8, 0, 6 * sx], "pivot": [x0 + 0.7, 32, 1.2]}]
    return g

def main():
    out = {}
    for n, fn in (("middray", middray), ("hermes", hermes), ("stella", stella)):
        im = fn(); im.save(os.path.join(RP, f"textures/entity/etheria_{n}.png")); out[n] = im
        if n == "stella": json.dump(stella_geo(), open(os.path.join(RP, "models/entity/etheria_stella_skin.geo.json"), "w"), indent=1)
        else:
            g = json.load(open(os.path.join(RP, "models/entity/etheria_benimaru_skin.geo.json"))); g["minecraft:geometry"][0]["description"]["identifier"] = f"geometry.etheria_{n}_skin"
            json.dump(g, open(os.path.join(RP, f"models/entity/etheria_{n}_skin.geo.json"), "w"), indent=1)
        print(n, "ok")
if __name__ == "__main__": main()

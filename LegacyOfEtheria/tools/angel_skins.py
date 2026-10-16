# 6.52 - SKINS BASE DOS ANJOS refeitas pixel a pixel a partir das ilustrações enviadas pelo jogador (Garasha, Pico, Obera, Zalario, Dino).
# As skins originais do mod estavam com rosto/roupa quebrados. Aqui só a skin 64x64; asas, cabelo 3D, armaduras e armas continuam em tools/angels.py.
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from milim_skins import Skin, hx, sh, mix, faces, BOX, CLEAR

def head(S, skin, hair, fringe=2, side=5, back=8, part=None, top_hl=True):
    """cabeça com cabelo: topo, franja (linhas), laterais (até a linha 'side'), nuca (até 'back')"""
    def f(face, x, y, w, h):
        hk = 1.1 - 0.28 * (y / h) - (0.08 if x % 3 == 1 else 0)
        hc = S.noise(sh(hair, hk), 0.03)
        if face == "top": return S.noise(sh(hair, 1.12 if (top_hl and y in (3, 4)) else 1.0 - (0.08 if x % 3 == 1 else 0)), 0.03)
        if face == "bottom": return sh(skin, 0.8)
        if face == "back": return hc if y < back else S.noise(sh(skin, 0.9), 0.02)
        if face in ("right", "left"):
            if y < side: return hc
            if y < side + 2 and ((face == "right" and x < 3) or (face == "left" and x > 4)): return hc
            return S.noise(sh(skin, 0.95 - 0.06 * (y / h)), 0.02)
        # frente
        if y < fringe and not (part and x in part and y == fringe - 1): return hc
        if x in (0, 7) and y < side: return hc
        return S.noise(sh(skin, 1.03 - 0.08 * (y / h)), 0.02)
    S.paint("head", f)
def px(S, box, face, pts, c):
    for x, y in pts: S.set(box, face, x, y, c)
def anime_eyes(S, iris, y=4, lash=None, white=(250, 250, 250, 255), stern=False):
    L = lash or sh(iris, 0.35)
    # olho direito do personagem (x 1-2) e esquerdo (x 5-6): cílio em cima, íris em 2 linhas, brilho
    for a, b in ((1, 2), (5, 6)):
        S.set("head", "front", a, y - 1, L); S.set("head", "front", b, y - 1, L)
        inner, outer = (b, a) if a < 4 else (a, b)
        S.set("head", "front", outer, y, white); S.set("head", "front", inner, y, sh(iris, 1.2))
        S.set("head", "front", outer, y + 1, sh(iris, 0.7) if not stern else white); S.set("head", "front", inner, y + 1, iris)
def mouth(S, c, y=6, xs=(3, 4)):
    lip = mix(c, hx("#b04a4a"), 0.45)
    for x in xs: S.set("head", "front", x, y, lip)

def fill(S, box, fn):
    S.paint(box, fn)
def cloth(S, base, k_top=1.08, k_bot=0.85, side_k=0.88, fold=True):
    def g(face, x, y, w, h):
        if face == "top": return sh(base, 1.05)
        if face == "bottom": return sh(base, 0.7)
        k = k_top + (k_bot - k_top) * (y / h)
        if face in ("right", "left"): k *= side_k
        if fold and face in ("front", "back") and x % 3 == 2: k *= 0.93
        return S.noise(sh(base, k), 0.03)
    return g

# ------------------------------------------------------------------ Garasha: cabelo vermelho longo, olhos cinza, corselete amarelo com cordão,
# gola preta, ombreiras pretas, manoplas pretas e luvas amarelas, cinto de corda branco, tabardo branco com leão preto, calça preta, grevas prateadas
def garasha():
    S = Skin(101); SK = hx("#e3aa86"); HA = hx("#d22c4c"); YE = hx("#e2b72e"); BK = hx("#24222a"); WT = hx("#eeeae2"); SV = hx("#c8ccd6")
    head(S, SK, HA, fringe=2, side=7, back=8)
    anime_eyes(S, hx("#8c8c98"), stern=True); mouth(S, sh(SK, 0.78))
    px(S, "head", "front", [(1, 2), (2, 2), (5, 2), (6, 2)], sh(HA, 0.55))       # sobrancelhas
    def body(face, x, y, w, h):
        base = cloth(S, YE)(face, x, y, w, h)
        if face in ("top", "bottom"): return sh(BK, 1.0)
        if y < 2: return S.noise(sh(BK, 1.1 - 0.1 * y), 0.03)                   # gola alta preta
        if face == "front":
            if y == 1 and x in (3, 4): return SV
            if y in (2, 3) and x in (1, 2, 5, 6): return sh(YE, 1.15)            # busto
            if 3 <= y <= 7 and x in (3, 4): return sh(YE, 0.6) if y % 2 else sh(WT, 0.9)   # cordão do corselete
            if x in (0, 7): return sh(YE, 0.78)
        if face == "back" and x in (3, 4) and 2 <= y <= 7: return sh(YE, 0.6) if y % 2 else sh(WT, 0.85)
        if y == 8: return sh(WT, 0.95 if (x + y) % 2 else 0.8)                   # cinto de corda trançada
        if y > 8: return S.noise(sh(BK, 1.0 - 0.1 * (y - 9)), 0.03)              # quadril (calça)
        return base
    fill(S, "body", body)
    def arm(face, x, y, w, h):
        if face == "top": return BK
        if face == "bottom": return sh(YE, 0.8)
        if y < 3: return S.noise(sh(BK, 1.12 - 0.05 * y), 0.03)                   # ombreira
        if y < 6: return S.noise(sh(SK, 1.02 - 0.04 * (y - 3) - (0.08 if x in (0, w - 1) else 0)), 0.02)
        if y < 10: return S.noise(sh(BK, 1.05 - 0.05 * (y - 6) - (0.1 if x in (0, w - 1) else 0)), 0.03)   # manopla preta
        return S.noise(sh(YE, 1.05 - 0.1 * (y - 10)), 0.03)                       # luva amarela
    fill(S, "rarm", arm); fill(S, "larm", arm)
    def leg(face, x, y, w, h):
        if face == "top": return BK
        if face == "bottom": return sh(SV, 0.7)
        if y < 6: return S.noise(sh(BK, 1.05 - 0.15 * (y / 6) - (0.08 if x % 2 and face == "front" else 0)), 0.03)   # calça larga
        k = 1.25 - 0.4 * ((y - 6) / 6) - (0.15 if x in (0, w - 1) else 0)
        if y == 6: k = 1.35
        return S.noise(sh(SV, k), 0.02)                                           # greva/bota prateada
    fill(S, "rleg", leg); fill(S, "lleg", leg)
    for b in ("hat", "jacket", "rsleeve", "lsleeve", "rpants", "lpants"): fill(S, b, lambda *a: CLEAR)
    def hat(face, x, y, w, h):                                                  # mechas soltas por cima
        if face == "top": return S.noise(sh(HA, 1.15 - (0.12 if (x + y) % 3 == 0 else 0)), 0.03)
        if face == "front": return S.noise(sh(HA, 1.12), 0.03) if y == 0 or (y == 1 and x in (0, 1, 6, 7)) or (x in (0, 7) and y < 7) else None
        if face in ("right", "left", "back"): return S.noise(sh(HA, 1.05 - 0.2 * y / h - (0.1 if x % 2 else 0)), 0.03)
        return None
    fill(S, "hat", hat)
    def tabard(face, x, y, w, h, box=None):                                      # tabardo branco na frente das coxas (camada externa)
        if face != "front" or y > 6: return None
        if (box == "rpants" and x == 0) or (box == "lpants" and x == 3): return None
        return S.noise(sh(WT, 1.0 - 0.04 * y), 0.02) if y < 6 else sh(BK, 0.9)
    fill(S, "rpants", lambda *a: tabard(*a, box="rpants")); fill(S, "lpants", lambda *a: tabard(*a, box="lpants"))
    # leão rampante preto no tabardo (atravessa as duas pernas)
    for (bx, pts) in (("rpants", [(3, 1), (2, 2), (3, 2), (2, 3), (3, 3), (1, 4), (3, 4)]), ("lpants", [(0, 1), (1, 1), (0, 2), (0, 3), (1, 3), (0, 4), (1, 5)])):
        px(S, bx, "front", pts, sh(BK, 1.0))
    return S.im

# ------------------------------------------------------------------ Pico: maria-chiquinha loira, olhos verdes, jaqueta lilás com faixa branca
# e filetes dourados, gola preta alta, fivela prateada, saia preta pregueada, meias 7/8 listradas lilás/branco, sapatos roxos
def pico():
    S = Skin(102); SK = hx("#f7dcc8"); HA = hx("#f0d264"); LV = hx("#b89ad8"); WT = hx("#f4f2f8"); BK = hx("#25222c"); GD = hx("#e2c050"); PU = hx("#8a5ab8")
    head(S, SK, HA, fringe=3, side=6, back=7)
    anime_eyes(S, hx("#3caa5a")); mouth(S, sh(SK, 0.75), xs=(3, 4))
    def body(face, x, y, w, h):
        if face in ("top", "bottom"): return sh(LV, 1.0) if face == "top" else BK
        if y < 2: return S.noise(sh(BK, 1.05), 0.03)                              # gola alta preta
        if face == "front":
            if x in (3, 4): return S.noise(sh(WT, 1.0 - 0.03 * y), 0.02)          # faixa central branca
            if x in (2, 5): return sh(GD, 1.05)                                    # filete dourado
            if y == 8: return hx("#c8ccd6") if x in (1, 6) else BK
        if y == 8: return BK                                                     # cinto
        if y > 8: return S.noise(sh(BK, 1.05 - 0.06 * (y - 9) - (0.1 if x % 2 else 0)), 0.03)   # saia preta pregueada
        return cloth(S, LV)(face, x, y, w, h)
    fill(S, "body", body)
    def arm(face, x, y, w, h):
        if face == "top": return LV
        if face == "bottom": return sh(SK, 0.85)
        if y >= 10: return S.noise(sh(BK, 1.0), 0.03) if y < 11 else S.noise(SK, 0.02)   # luva preta sem dedos
        c = WT if (face == "front" and x == 1 and y < 8) else LV
        return S.noise(sh(c, 1.07 - 0.2 * (y / h) - (0.08 if face in ("left", "right") else 0)), 0.03)
    fill(S, "rarm", arm); fill(S, "larm", arm)
    def leg(face, x, y, w, h):
        if face == "top": return BK
        if face == "bottom": return sh(PU, 0.6)
        if y < 2: return S.noise(sh(BK, 0.95), 0.03)                              # barra da saia
        if y < 3: return S.noise(sh(SK, 1.0), 0.02)                               # coxa
        if y < 9: return S.noise(sh(LV if x % 2 == 0 else WT, 1.05 - 0.04 * (y - 3)), 0.02)   # meia listrada
        if y < 10: return sh(WT, 0.95)                                            # cano da bota
        return S.noise(sh(PU, 1.05 - 0.15 * (y - 10)), 0.03)                       # sapato roxo
    fill(S, "rleg", leg); fill(S, "lleg", leg)
    for b in ("hat", "jacket", "rsleeve", "lsleeve", "rpants", "lpants"): fill(S, b, lambda *a: CLEAR)
    def hat(face, x, y, w, h):
        if face == "top": return S.noise(sh(HA, 1.15 - (0.1 if x % 3 == 0 else 0)), 0.03)
        if face == "front": return S.noise(sh(HA, 1.1), 0.03) if y == 0 or (y == 1 and x in (0, 2, 5, 7)) else None
        if face in ("right", "left"): return S.noise(sh(HA, 1.05 - 0.2 * y / h), 0.03) if y < 5 else None
        if face == "back": return S.noise(sh(HA, 1.05 - 0.2 * y / h), 0.03) if y < 7 else None
        return None
    fill(S, "hat", hat)
    def skirt(face, x, y, w, h, box=None):                                      # saia rodada (camada externa das pernas)
        if face in ("top", "bottom") or y > 2: return None
        if (box == "rpants" and face == "left") or (box == "lpants" and face == "right"): return None
        return S.noise(sh(BK, 1.05 - 0.08 * y - (0.12 if x % 2 else 0)), 0.03)
    fill(S, "rpants", lambda *a: skirt(*a, box="rpants")); fill(S, "lpants", lambda *a: skirt(*a, box="lpants"))
    return S.im

# ------------------------------------------------------------------ Obera: cabelo preto longo, marcas na testa, olhos violeta, armadura branca
# com arabescos dourados, corpete roxo, luvas roxas, meia-calça preta, grevas brancas/douradas
def obera():
    S = Skin(103); SK = hx("#f2dccc"); HA = hx("#17151c"); WT = hx("#eef0f6"); GD = hx("#e0b83a"); PU = hx("#8858c8"); BK = hx("#1e1c24")
    head(S, SK, HA, fringe=2, side=7, back=8)
    anime_eyes(S, hx("#8a7aa8"), stern=True); mouth(S, sh(SK, 0.8))
    px(S, "head", "front", [(3, 2), (4, 2)], hx("#7a5a9a"))   # marca na testa
    def body(face, x, y, w, h):
        if face in ("top", "bottom"): return WT
        if face == "front":
            if y < 5:
                c = WT
                if (y == 1 and x in (1, 2, 5, 6)) or (y == 2 and x in (3, 4)) or (y == 4 and x in (0, 7)): c = GD   # arabescos dourados
                return S.noise(sh(c, 1.05 - 0.03 * y), 0.02)
            if y < 9: return S.noise(sh(PU, 1.08 - 0.05 * (y - 5)), 0.03) if not (y == 5 and x in (2, 5)) else GD   # corpete roxo
            return S.noise(sh(WT, 1.0 - 0.05 * (y - 9)), 0.02) if x not in (3, 4) else GD                         # faixa branca do quadril
        if face == "back": return S.noise(sh(WT if y < 5 else PU, 1.0 - 0.02 * y), 0.03)
        return S.noise(sh(WT if y < 5 else PU, 0.9), 0.03)
    fill(S, "body", body)
    def arm(face, x, y, w, h):
        if face == "top": return WT
        if face == "bottom": return PU
        if y < 4: return S.noise(sh(WT if not (y == 3) else GD, 1.08 - 0.04 * y), 0.02)     # ombreira branca/dourada
        if y < 8: return S.noise(sh(hx("#5a3a2a"), 1.0), 0.03) if face != "front" or x else S.noise(sh(hx("#5a3a2a"), 0.9), 0.03)
        return S.noise(sh(PU, 1.06 - 0.1 * (y - 8)), 0.03)                                  # luva roxa
    fill(S, "rarm", arm); fill(S, "larm", arm)
    def leg(face, x, y, w, h):
        if face == "top": return BK
        if face == "bottom": return sh(GD, 0.8)
        if y < 4: return S.noise(sh(BK, 1.0 - 0.05 * y), 0.03)                              # meia-calça preta
        c = GD if (y in (4, 8) or (y == 11)) else WT
        return S.noise(sh(c, 1.1 - 0.04 * (y - 4) - (0.1 if x in (0, w - 1) else 0)), 0.02)   # greva branca com frisos dourados
    fill(S, "rleg", leg); fill(S, "lleg", leg)
    for b in ("hat", "jacket", "rsleeve", "lsleeve", "rpants", "lpants"): fill(S, b, lambda *a: CLEAR)
    def hat(face, x, y, w, h):
        if face == "top": return S.noise(sh(HA, 1.2 - (0.15 if (x + y) % 3 == 0 else 0)), 0.03)
        if face == "front": return S.noise(sh(HA, 1.15), 0.03) if y == 0 or (x in (0, 7) and y < 8) else None
        if face in ("right", "left", "back"): return S.noise(sh(HA, 1.15 - 0.15 * y / h - (0.1 if x % 2 else 0)), 0.03)
        return None
    fill(S, "hat", hat)
    return S.im

# ------------------------------------------------------------------ Zalario: cabelo preto longo, marca na testa, olhos âmbar, armadura roxo-escura
# com espinhos dourados, gola branca alta, mangas brancas, braçadeiras roxas, calça branca, botas roxas com dourado
def zalario():
    S = Skin(104); SK = hx("#e6c4a4"); HA = hx("#16141c"); PU = hx("#3a2650"); GD = hx("#e2b83a"); WT = hx("#eeeef4")
    head(S, SK, HA, fringe=2, side=7, back=8)
    anime_eyes(S, hx("#a07038"), stern=True); mouth(S, sh(SK, 0.78))
    px(S, "head", "front", [(3, 2)], hx("#8a5a4a")); px(S, "head", "front", [(4, 2)], hx("#7a4a3a"))   # marca na testa
    px(S, "head", "front", [(1, 2), (2, 2), (5, 2), (6, 2)], sh(HA, 1.2))
    def body(face, x, y, w, h):
        if face in ("top", "bottom"): return WT if face == "top" else PU
        if y < 2: return S.noise(sh(WT, 1.0), 0.02)                                         # gola branca
        if face == "front":
            if (y == 2 and x in (0, 1, 6, 7)) or (y == 3 and x in (2, 5)) or (y == 4 and x in (3, 4)): return GD   # "V" dourado
            if y == 7 and 2 <= x <= 5: return GD
            if y == 8 and x in (3, 4): return sh(GD, 1.1)                                     # fivela
            if y > 8: return S.noise(sh(WT, 1.0 - 0.04 * (y - 9)), 0.02)
        if y > 8: return S.noise(sh(WT, 0.95), 0.02)
        return S.noise(sh(PU, 1.15 - 0.25 * (y / h) - (0.1 if face in ("left", "right") else 0)), 0.03)
    fill(S, "body", body)
    def arm(face, x, y, w, h):
        if face == "top": return PU
        if face == "bottom": return sh(SK, 0.85)
        if y < 3: return S.noise(sh(PU, 1.1) if y < 2 else GD, 0.03)                          # ombro
        if y < 6: return S.noise(sh(WT, 1.0 - 0.03 * y), 0.02)                               # manga branca
        if y < 10: return S.noise(sh(GD if y in (6, 9) else PU, 1.05), 0.03)                  # braçadeira
        return S.noise(sh(SK, 1.0 - 0.05 * (y - 10)), 0.02)
    fill(S, "rarm", arm); fill(S, "larm", arm)
    def leg(face, x, y, w, h):
        if face == "top": return WT
        if face == "bottom": return sh(PU, 0.6)
        if y < 5: return S.noise(sh(WT, 1.02 - 0.04 * y - (0.06 if x % 2 and face == "front" else 0)), 0.02)
        c = GD if y in (5, 11) or (face == "front" and y == 7 and x in (1, 2)) else PU
        return S.noise(sh(c, 1.1 - 0.05 * (y - 5)), 0.03)
    fill(S, "rleg", leg); fill(S, "lleg", leg)
    for b in ("hat", "jacket", "rsleeve", "lsleeve", "rpants", "lpants"): fill(S, b, lambda *a: CLEAR)
    def hat(face, x, y, w, h):
        if face == "top": return S.noise(sh(HA, 1.2 - (0.15 if x % 3 == 0 else 0)), 0.03)
        if face == "front": return S.noise(sh(HA, 1.15), 0.03) if y == 0 or (y == 1 and x in (0, 1, 2, 5, 6, 7)) or (x in (0, 7) and y < 8) else None
        if face in ("right", "left", "back"): return S.noise(sh(HA, 1.15 - 0.15 * y / h - (0.1 if x % 2 else 0)), 0.03)
        return None
    fill(S, "hat", hat)
    return S.im

# ------------------------------------------------------------------ Dino: cabelo prateado espetado, olhos cinza, sorriso de canto, lenço vermelho,
# casaco preto com debrum dourado, cinto, protetores prateados no braço, faixas vermelhas no pulso, luvas pretas, calça e botas pretas
def dino():
    S = Skin(105); SK = hx("#f0d6c0"); HA = hx("#dfe2ea"); BK = hx("#1e1c24"); GD = hx("#d9b440"); RD = hx("#b0242c"); SV = hx("#b8bcc8")
    head(S, SK, HA, fringe=2, side=5, back=7)
    anime_eyes(S, hx("#8a8a96")); px(S, "head", "front", [(3, 6), (4, 6)], sh(SK, 0.7)); S.set("head", "front", 5, 6, hx("#f8f8f8"))   # sorriso de canto
    def body(face, x, y, w, h):
        if face in ("top", "bottom"): return BK
        if face == "front":
            if y < 2 and 2 <= x <= 5: return S.noise(sh(RD, 1.05 - 0.1 * y), 0.03)        # lenço vermelho
            if x in (3, 4) and y >= 2: return GD if x == 3 else sh(BK, 0.8)               # fechamento do casaco
            if y == 7: return sh(hx("#3a3442"), 1.0) if x not in (3, 4) else GD           # cinto
            if x in (0, 7) and y < 2: return GD
        if face == "back" and y < 2: return S.noise(sh(RD, 0.9), 0.03) if 2 <= x <= 5 else BK
        return S.noise(sh(BK, 1.12 - 0.2 * (y / h) - (0.06 if x % 3 == 2 else 0)), 0.02)
    fill(S, "body", body)
    def arm(face, x, y, w, h):
        if face == "top": return BK
        if face == "bottom": return BK
        if 4 <= y < 8 and face in ("front", "right", "left"): return S.noise(sh(SV, 1.1 - 0.05 * (y - 4)), 0.02)   # protetor prateado
        if y in (9, 10): return S.noise(sh(RD, 1.0), 0.03)                                    # faixa vermelha
        if y == 11: return BK                                                                # luva preta
        return S.noise(sh(BK, 1.1 - 0.2 * (y / h)), 0.02) if not (y == 3) else GD
    fill(S, "rarm", arm); fill(S, "larm", arm)
    def leg(face, x, y, w, h):
        if face == "top": return BK
        if face == "bottom": return sh(BK, 0.7)
        if y == 7: return sh(BK, 1.25)                                                       # cano da bota
        return S.noise(sh(BK, 1.08 - 0.15 * (y / h) - (0.08 if x % 2 and face == "front" else 0)), 0.02)
    fill(S, "rleg", leg); fill(S, "lleg", leg)
    for b in ("hat", "jacket", "rsleeve", "lsleeve", "rpants", "lpants"): fill(S, b, lambda *a: CLEAR)
    def hat(face, x, y, w, h):
        if face == "top": return S.noise(sh(HA, 1.12 - (0.15 if (x + y) % 3 == 0 else 0)), 0.03)
        if face == "front": return S.noise(sh(HA, 1.08), 0.03) if y == 0 or (y == 1 and x in (0, 1, 3, 6, 7)) else None
        if face in ("right", "left"): return S.noise(sh(HA, 1.05 - 0.15 * y / h), 0.03) if y < 5 else None
        if face == "back": return S.noise(sh(HA, 1.05 - 0.15 * y / h), 0.03) if y < 7 else None
        return None
    fill(S, "hat", hat)
    def coat(face, x, y, w, h):                                                         # barra do casaco com debrum dourado sobre as coxas
        if face in ("top", "bottom") or y > 5: return None
        return S.noise(sh(GD if y == 5 else BK, 1.05 - 0.04 * y), 0.02)
    fill(S, "jacket", lambda face, x, y, w, h: (GD if (face == "front" and x in (0, 7) and y > 1) else None))
    return S.im

SKINS = {"garasha": garasha, "pico": pico, "obera": obera, "zalario": zalario, "dino": dino}

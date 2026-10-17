"""Gera font/glyph_E3.png: barras gráficas de HP/MP/ST para a HUD (actionbar).
U+E300 coração, E301 cristal de mana, E302 raio de stamina,
E310.. segmentos: HP cheio/meio, vazio, MP cheio/meio, ST cheio/meio, ponta esq., ponta dir."""
from PIL import Image, ImageDraw
import os
C = 32
im = Image.new("RGBA", (C * 16, C * 16), (0, 0, 0, 0))

def cell(i): return (i % 16) * C, (i // 16) * C

def put(i, fn):
    g = Image.new("RGBA", (C, C), (0, 0, 0, 0)); fn(ImageDraw.Draw(g), g); im.paste(g, cell(i))

def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)
Y0, Y1 = 9, 23   # faixa vertical da barra

def seg(col, frac):
    def f(d, g):
        d.rectangle([0, Y0, C - 1, Y1], fill=(18, 14, 22, 255))              # moldura
        d.rectangle([0, Y0 + 2, C - 1, Y1 - 2], fill=(44, 38, 52, 255))      # fundo vazio
        w = int(C * frac)
        if w:
            for y in range(Y0 + 2, Y1 - 1):
                t = (y - Y0 - 2) / (Y1 - Y0 - 4)
                k = 1.45 - 0.75 * t if t < 0.35 else 1.0 - 0.45 * (t - 0.35)
                d.line([0, y, w - 1, y], fill=shade(col, k))
            d.line([0, Y0 + 3, w - 1, Y0 + 3], fill=shade(col, 1.9))          # brilho
        d.line([C - 1, Y0 + 2, C - 1, Y1 - 2], fill=(18, 14, 22, 120))       # divisória sutil
    return f

def cap(left):
    def f(d, g):
        x0, x1 = 0, 11
        d.rectangle([x0, Y0 - 1, x1, Y1 + 1], fill=(18, 14, 22, 255))
        gx = (x0 + 2, x1) if left else (x0, x1 - 2)
        d.rectangle([gx[0], Y0 + 1, gx[1], Y1 - 1], fill=(196, 160, 76, 255))
        d.rectangle([gx[0] + (1 if left else 0), Y0 + 3, gx[1] - (0 if left else 1), Y1 - 3], fill=(120, 92, 40, 255))
    return f

def heart(d, g):
    col, dk = (232, 40, 56), (120, 10, 24)
    d.ellipse([3, 6, 16, 19], fill=dk); d.ellipse([15, 6, 28, 19], fill=dk)
    d.polygon([(3, 14), (28, 14), (15.5, 28)], fill=dk)
    d.ellipse([5, 8, 15, 17], fill=col); d.ellipse([16, 8, 26, 17], fill=col)
    d.polygon([(5, 14), (26, 14), (15.5, 25)], fill=col)
    d.ellipse([7, 9, 11, 13], fill=(255, 190, 196))

def crystal(d, g):
    d.polygon([(16, 2), (27, 14), (16, 30), (5, 14)], fill=(20, 40, 120))
    d.polygon([(16, 5), (24, 14), (16, 27), (8, 14)], fill=(60, 120, 245))
    d.polygon([(16, 5), (24, 14), (16, 14)], fill=(140, 200, 255))
    d.line([(11, 11), (14, 8)], fill=(235, 250, 255), width=2)

def bolt(d, g):
    pts = [(19, 2), (7, 18), (15, 18), (11, 30), (25, 12), (17, 12), (21, 2)]
    d.polygon(pts, fill=(20, 80, 20)); d.polygon([(x + (1 if x < 16 else -1), y + (1 if y < 16 else -1)) for x, y in pts], fill=(110, 230, 90))

HP, MP, ST = (226, 36, 52), (52, 118, 245), (90, 210, 70)
put(0x00, heart); put(0x01, crystal); put(0x02, bolt)
put(0x10, seg(HP, 1)); put(0x11, seg(HP, 0.5)); put(0x12, seg(HP, 0))
put(0x13, seg(MP, 1)); put(0x14, seg(MP, 0.5))
put(0x15, seg(ST, 1)); put(0x16, seg(ST, 0.5))
put(0x17, cap(True)); put(0x18, cap(False))
out = os.path.join(os.path.dirname(__file__), "..", "LegacyOfEtheria_RP", "font", "glyph_E3.png")
im.save(out); print("ok", out)

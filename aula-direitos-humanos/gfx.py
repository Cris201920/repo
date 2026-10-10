"""Biblioteca gráfica da videoaula: cores, fontes, texto, sprites suavizados e ícones."""
import math
import os
from collections import OrderedDict

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1920, 1080, 30

C = dict(
    navy0=(6, 15, 34), navy=(11, 27, 58), navy2=(17, 39, 80), panel=(21, 46, 92),
    panel2=(30, 60, 114), white=(255, 255, 255), gold=(201, 162, 75), gold2=(233, 208, 140),
    g1=(205, 212, 226), g2=(145, 156, 177), g3=(74, 89, 122), red=(222, 104, 104),
    green=(126, 205, 156), blue=(122, 168, 235), teal=(124, 205, 197),
)

FONT_FILES = dict(
    serif_b="SourceSerifPro-Bold.ttf", serif="SourceSerifPro-Regular.ttf",
    serif_sb="SourceSerifPro-Semibold.ttf", serif_i="SourceSerifPro-It.ttf",
    sans="SourceSansPro-Regular.ttf", sans_sb="SourceSansPro-Semibold.ttf",
    sans_b="SourceSansPro-Bold.ttf", sans_i="SourceSansPro-It.ttf",
)
_fonts = {}


def font(fk, size):
    k = (fk, size)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(os.path.join(HERE, "fonts", FONT_FILES[fk]), size)
    return _fonts[k]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))


# ----------------------------------------------------------------- cache LRU
class LRU(OrderedDict):
    def __init__(self, cap):
        super().__init__()
        self.cap = cap

    def get_or(self, key, fn):
        if key in self:
            self.move_to_end(key)
            return self[key]
        v = fn()
        self[key] = v
        if len(self) > self.cap:
            self.popitem(last=False)
        return v


_cache = LRU(1500)


# --------------------------------------------------------------- composição
def _mask(spr, alpha):
    a = spr.getchannel("A")
    if alpha >= 0.999:
        return a
    return a.point(lambda v: int(v * alpha))


def put(img, spr, x, y, alpha=1.0, scale=1.0, anchor="c"):
    """Cola um sprite RGBA. (x,y) é o centro (anchor 'c') ou o canto sup. esq. ('tl')."""
    if alpha <= 0.003:
        return
    if abs(scale - 1) > 1e-3:
        spr = spr.resize((max(1, int(spr.width * scale)), max(1, int(spr.height * scale))), Image.BILINEAR)
    if anchor == "c":
        x, y = x - spr.width / 2, y - spr.height / 2
    img.paste(spr.convert("RGB"), (int(round(x)), int(round(y))), _mask(spr, alpha))


class SD:
    """Desenho em supersampling: recebe coordenadas 1x e desenha em ss×."""

    def __init__(self, im, ss):
        self.im, self.d, self.ss = im, ImageDraw.Draw(im), ss

    def _s(self, v):
        return [c * self.ss for c in v]

    def _pts(self, pts):
        return [(x * self.ss, y * self.ss) for x, y in pts]

    def ellipse(self, box, fill=None, outline=None, width=1):
        self.d.ellipse(self._s(box), fill=fill, outline=outline, width=max(1, int(width * self.ss)))

    def circle(self, cx, cy, r, fill=None, outline=None, width=1):
        self.ellipse((cx - r, cy - r, cx + r, cy + r), fill, outline, width)

    def rrect(self, box, r, fill=None, outline=None, width=1):
        self.d.rounded_rectangle(self._s(box), radius=r * self.ss, fill=fill, outline=outline,
                                 width=max(1, int(width * self.ss)))

    def rect(self, box, fill=None, outline=None, width=1):
        self.d.rectangle(self._s(box), fill=fill, outline=outline, width=max(1, int(width * self.ss)))

    def poly(self, pts, fill=None, outline=None, width=1):
        self.d.polygon(self._pts(pts), fill=fill, outline=outline)

    def line(self, pts, fill, width, cap=True):
        p = self._pts(pts)
        self.d.line(p, fill=fill, width=max(1, int(width * self.ss)), joint="curve")
        if cap:
            r = width * self.ss / 2
            for x, y in (p[0], p[-1]):
                self.d.ellipse((x - r, y - r, x + r, y + r), fill=fill)

    def arc(self, box, a0, a1, fill, width=1):
        self.d.arc(self._s(box), a0, a1, fill=fill, width=max(1, int(width * self.ss)))

    def pie(self, box, a0, a1, fill):
        self.d.pieslice(self._s(box), a0, a1, fill=fill)

    def dashed_circle(self, cx, cy, r, fill, width, n=28, frac=0.55, rot=0.0):
        for i in range(n):
            a0 = rot + i * 360 / n
            self.arc((cx - r, cy - r, cx + r, cy + r), a0, a0 + 360 / n * frac, fill, width)


def make_sprite(w, h, fn, ss=3):
    im = Image.new("RGBA", (int(w * ss), int(h * ss)), (0, 0, 0, 0))
    fn(SD(im, ss))
    return im.resize((int(w), int(h)), Image.LANCZOS)


def sprite(key, w, h, fn, ss=3):
    return _cache.get_or(("spr", key, w, h), lambda: make_sprite(w, h, fn, ss))


def dyn(img, x, y, w, h, fn, ss=3, alpha=1.0):
    """Desenho dinâmico (não cacheado) num ladrilho com origem (x,y) no canto sup. esq."""
    spr = make_sprite(w, h, fn, ss)
    put(img, spr, x, y, alpha, anchor="tl")


# --------------------------------------------------------------------- texto
def _text_layer(s, fk, size, fill):
    def mk():
        f = font(fk, size)
        asc, desc = f.getmetrics()
        w = int(f.getlength(s)) + 8
        im = Image.new("RGBA", (w, asc + desc + 8), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((4, 4), s, font=f, fill=fill + (255,))
        return im
    return _cache.get_or(("txt", s, fk, size, fill), mk)


def text(img, x, y, s, fk="sans", size=32, fill=C["white"], a="l", alpha=1.0):
    if not s:
        return 0
    spr = _text_layer(s, fk, size, fill)
    ox = {"l": 0, "m": spr.width / 2, "r": spr.width}[a] - 4
    put(img, spr, x - ox - 4 + 4, y - 4, alpha, anchor="tl")
    return spr.width - 8


def text_w(s, fk, size):
    return font(fk, size).getlength(s)


def parse_rich(s):
    """Texto com [[destaque]] -> lista de palavras; palavra = [(trecho, destaque?)]; '\n' = quebra."""
    words, cur, buf, hl, i = [], [], "", False, 0

    def flush():
        nonlocal buf
        if buf:
            cur.append((buf, hl))
            buf = ""
    while i < len(s):
        if s.startswith("[[", i):
            flush(); hl = True; i += 2; continue
        if s.startswith("]]", i):
            flush(); hl = False; i += 2; continue
        ch = s[i]
        if ch in " \n":
            flush()
            if cur:
                words.append(cur); cur = []
            if ch == "\n":
                words.append("\n")
        else:
            buf += ch
        i += 1
    flush()
    if cur:
        words.append(cur)
    return words


def wrap_rich(s, fk, size, maxw, hl_fk=None):
    """Quebra em linhas: cada linha = [(pedaços, largura)]."""
    hl_fk = hl_fk or fk
    lines, cur, curw = [], [], 0.0
    sp = text_w(" ", fk, size)
    for wd in parse_rich(s):
        if wd == "\n":
            lines.append(cur)
            cur, curw = [], 0.0
            continue
        w = sum(text_w(t, hl_fk if h else fk, size) for t, h in wd)
        if cur and curw + sp + w > maxw:
            lines.append(cur)
            cur, curw = [], 0.0
        curw += (sp if cur else 0) + w
        cur.append((wd, w))
    if cur:
        lines.append(cur)
    return lines


def line_w(ln, sp):
    return sum(w for _, w in ln) + sp * (len(ln) - 1)


def rich(img, x, y, s, fk="sans", size=32, fill=C["white"], hl=C["gold2"], maxw=900, a="l",
         alpha=1.0, lh=1.28, hl_fk=None):
    """Texto com quebra automática e destaque [[...]]. Retorna a altura usada."""
    lines = wrap_rich(s, fk, size, maxw, hl_fk)
    sp = text_w(" ", fk, size)
    yy = y
    for ln in lines:
        tw = line_w(ln, sp)
        xx = {"l": x, "m": x - tw / 2, "r": x - tw}[a]
        for wd, w in ln:
            for tok, h in wd:
                f2 = hl_fk if (h and hl_fk) else fk
                text(img, xx, yy, tok, f2, size, hl if h else fill, "l", alpha)
                xx += text_w(tok, f2, size)
            xx += sp
        yy += size * lh
    return yy - y


def rich_height(s, fk, size, maxw, lh=1.28, hl_fk=None):
    return len(wrap_rich(s, fk, size, maxw, hl_fk)) * size * lh


# ------------------------------------------------------------ elementos de UI
def card_sprite(w, h, r=22, fill=C["panel"], outline=None, ow=2, accent=None):
    def fn(sd):
        sd.rrect((2, 2, w - 2, h - 2), r, fill=fill, outline=outline, width=ow)
        if accent:
            sd.rrect((2, 2, w - 2, 12), 6, fill=accent)
    return sprite(("card", fill, outline, ow, accent, r), w, h, fn, ss=2)


def card(img, x, y, w, h, alpha=1.0, fill=C["panel"], outline=C["g3"], accent=None, r=22, ow=2):
    put(img, card_sprite(w, h, r, fill, outline, ow, accent), x, y, alpha, anchor="tl")


def pill(img, cx, cy, s, size=26, fill=C["gold"], fg=C["navy0"], alpha=1.0, fk="sans_b", padx=26, h=None):
    h = h or int(size * 1.9)
    w = int(text_w(s, fk, size) + 2 * padx)
    put(img, card_sprite(w, h, h // 2, fill, None, 1), cx, cy, alpha)
    text(img, cx, cy - size * 0.68, s, fk, size, fg, "m", alpha)
    return w


def arrow_dyn(img, p0, p1, col=C["gold"], width=6, prog=1.0, alpha=1.0, head=24, dashed=False):
    x0, y0 = p0
    x1, y1 = p1
    x1 = lerp(x0, x1, prog)
    y1 = lerp(y0, y1, prog)
    pad = head + width + 6
    bx, by = min(x0, x1) - pad, min(y0, y1) - pad
    bw, bh = abs(x1 - x0) + 2 * pad, abs(y1 - y0) + 2 * pad

    def fn(sd):
        ax, ay, bx2, by2 = x0 - bx, y0 - by, x1 - bx, y1 - by
        ang = math.atan2(by2 - ay, bx2 - ax)
        L = math.hypot(bx2 - ax, by2 - ay)
        if L < 2:
            return
        tx, ty = bx2 - math.cos(ang) * head * 0.7, by2 - math.sin(ang) * head * 0.7
        if dashed:
            n = int(L // 22)
            for i in range(n):
                s0, s1 = i * 22 / L, (i * 22 + 12) / L
                sd.line([(lerp(ax, bx2, s0), lerp(ay, by2, s0)), (lerp(ax, bx2, s1), lerp(ay, by2, s1))], col, width, cap=False)
        else:
            sd.line([(ax, ay), (tx, ty)], col, width)
        if L > head:
            sd.poly([(bx2, by2),
                     (bx2 - math.cos(ang - 0.45) * head, by2 - math.sin(ang - 0.45) * head),
                     (bx2 - math.cos(ang + 0.45) * head, by2 - math.sin(ang + 0.45) * head)], fill=col)
    dyn(img, bx, by, bw, bh, fn, alpha=alpha)


# -------------------------------------------------------------------- ícones
def draw_bust(sd, cx, cy, s, col, extra=None):
    sd.circle(cx, cy - 0.20 * s, 0.20 * s, fill=col)
    sd.pie((cx - 0.40 * s, cy + 0.04 * s, cx + 0.40 * s, cy + 0.84 * s), 180, 360, col)
    sd.rect((cx - 0.40 * s, cy + 0.44 * s, cx + 0.40 * s, cy + 0.84 * s), fill=col)


def draw_person(sd, x, y, h, col, d=1, arms=(15, 15), legs=(6, -6), skin=None):
    """Figura em pé; (x, y) = pés. Ângulos em graus, 0 = para baixo, +90 = à frente."""
    skin = skin or col
    sd.circle(x, y - 0.90 * h, 0.085 * h, fill=skin)
    hip = (x, y - 0.44 * h)
    sh = (x, y - 0.76 * h)
    sd.line([sh, hip], col, 0.15 * h)
    for a in arms:
        r = math.radians(a)
        sd.line([sh, (x + d * math.sin(r) * 0.30 * h, sh[1] + math.cos(r) * 0.30 * h)], col, 0.062 * h)
    for a in legs:
        r = math.radians(a)
        sd.line([hip, (x + d * math.sin(r) * 0.44 * h, hip[1] + math.cos(r) * 0.44 * h)], col, 0.075 * h)


def draw_scales(sd, cx, cy, s, tilt, col, acc):
    """Balança. (cx,cy) = centro do fulcro; retorna centros dos pratos (esq, dir)."""
    sd.rect((cx - 0.022 * s, cy, cx + 0.022 * s, cy + 0.62 * s), fill=col)
    sd.poly([(cx - 0.20 * s, cy + 0.66 * s), (cx + 0.20 * s, cy + 0.66 * s),
             (cx + 0.13 * s, cy + 0.60 * s), (cx - 0.13 * s, cy + 0.60 * s)], fill=col)
    sd.rrect((cx - 0.24 * s, cy + 0.64 * s, cx + 0.24 * s, cy + 0.70 * s), 0.02 * s, fill=col)
    r = math.radians(tilt)
    L = 0.42 * s
    p_r = (cx + math.cos(r) * L, cy - math.sin(r) * L)  # tilt > 0: prato direito sobe
    p_l = (cx - math.cos(r) * L, cy + math.sin(r) * L)
    sd.line([p_l, p_r], col, 0.028 * s)
    sd.circle(cx, cy, 0.05 * s, fill=acc)
    centers = []
    for p in (p_l, p_r):
        py = p[1] + 0.34 * s
        sd.line([p, (p[0] - 0.15 * s, py)], acc, 0.008 * s + 1, cap=False)
        sd.line([p, (p[0] + 0.15 * s, py)], acc, 0.008 * s + 1, cap=False)
        sd.pie((p[0] - 0.17 * s, py - 0.08 * s, p[0] + 0.17 * s, py + 0.08 * s), 0, 180, col)
        sd.circle(p[0], p[1], 0.018 * s, fill=acc)
        centers.append((p[0], py))
    return centers


def ic_courthouse(sd, w, h, col, acc):
    sd.poly([(0.04 * w, 0.30 * h), (0.5 * w, 0.04 * h), (0.96 * w, 0.30 * h)], fill=col)
    sd.circle(0.5 * w, 0.20 * h, 0.04 * w, fill=acc)
    sd.rect((0.06 * w, 0.32 * h, 0.94 * w, 0.38 * h), fill=col)
    for i in range(5):
        x = 0.12 * w + i * 0.19 * w
        sd.rrect((x, 0.42 * h, x + 0.10 * w, 0.78 * h), 3, fill=col)
    sd.rect((0.06 * w, 0.80 * h, 0.94 * w, 0.86 * h), fill=col)
    sd.rect((0.0, 0.88 * h, w, 0.97 * h), fill=col)


def ic_book(sd, w, h, col, acc, spine):
    sd.rrect((0.10 * w, 0.04 * h, 0.92 * w, 0.96 * h), 10, fill=col)
    sd.rrect((0.10 * w, 0.04 * h, 0.24 * w, 0.96 * h), 10, fill=spine)
    sd.rect((0.30 * w, 0.18 * h, 0.82 * w, 0.20 * h), fill=acc)
    sd.rect((0.30 * w, 0.72 * h, 0.82 * w, 0.74 * h), fill=acc)
    cx, cy, R = 0.56 * w, 0.46 * h, 0.17 * w
    pts = []
    for i in range(10):
        r = R if i % 2 == 0 else R * 0.42
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    sd.poly(pts, fill=acc)
    sd.rect((0.36 * w, 0.80 * h, 0.76 * w, 0.82 * h), fill=acc)
    sd.rect((0.42 * w, 0.86 * h, 0.70 * w, 0.88 * h), fill=acc)


def ic_treaty(sd, w, h, col, acc, ink):
    sd.rrect((0.12 * w, 0.04 * h, 0.88 * w, 0.96 * h), 8, fill=col)
    for i in range(5):
        y = 0.14 * h + i * 0.09 * h
        sd.rect((0.22 * w, y, 0.78 * w if i % 2 == 0 else 0.66 * w, y + 0.018 * h), fill=ink)
    # globo
    cx, cy, R = 0.5 * w, 0.66 * h, 0.15 * w
    sd.circle(cx, cy, R, outline=ink, width=3)
    sd.ellipse((cx - R * 0.45, cy - R, cx + R * 0.45, cy + R), outline=ink, width=2)
    sd.line([(cx - R, cy), (cx + R, cy)], ink, 2, cap=False)
    # selo
    sd.poly([(0.66 * w, 0.80 * h), (0.74 * w, 0.99 * h), (0.80 * w, 0.92 * h), (0.86 * w, 0.99 * h), (0.86 * w, 0.80 * h)], fill=acc)
    sd.circle(0.76 * w, 0.78 * h, 0.075 * w, fill=acc)
    sd.circle(0.76 * w, 0.78 * h, 0.04 * w, outline=col, width=2)


def ic_shield(sd, w, h, col, inner=None):
    pts = [(0.5 * w, 0.02 * h), (0.92 * w, 0.16 * h), (0.88 * w, 0.52 * h), (0.5 * w, 0.98 * h),
           (0.12 * w, 0.52 * h), (0.08 * w, 0.16 * h)]
    sd.poly(pts, fill=col)
    if inner:
        sd.poly([(0.5 * w, 0.10 * h), (0.83 * w, 0.21 * h), (0.80 * w, 0.50 * h), (0.5 * w, 0.88 * h),
                 (0.20 * w, 0.50 * h), (0.17 * w, 0.21 * h)], fill=inner)


def ic_bubble(sd, w, h, col, ink):
    sd.rrect((0.04 * w, 0.06 * h, 0.96 * w, 0.72 * h), 0.16 * h, fill=col)
    sd.poly([(0.22 * w, 0.70 * h), (0.16 * w, 0.96 * h), (0.46 * w, 0.70 * h)], fill=col)
    for i, ww in enumerate((0.62, 0.50, 0.38)):
        y = 0.20 * h + i * 0.15 * h
        sd.rrect((0.18 * w, y, 0.18 * w + ww * w, y + 0.07 * h), 0.035 * h, fill=ink)


def ic_cross(sd, w, h, col, fg):
    sd.rrect((0.04 * w, 0.04 * h, 0.96 * w, 0.96 * h), 0.2 * w, fill=col)
    sd.rect((0.40 * w, 0.20 * h, 0.60 * w, 0.80 * h), fill=fg)
    sd.rect((0.20 * w, 0.40 * h, 0.80 * w, 0.60 * h), fill=fg)


def ic_ballot(sd, w, h, col, acc, paper_y=None):
    sd.rrect((0.10 * w, 0.40 * h, 0.90 * w, 0.96 * h), 8, fill=col)
    sd.rrect((0.28 * w, 0.40 * h, 0.72 * w, 0.48 * h), 4, fill=C["navy0"])


def ic_paper(sd, w, h, col, ink):
    sd.rrect((0.0, 0.0, w, h), 4, fill=col)
    sd.rect((0.18 * w, 0.28 * h, 0.82 * w, 0.40 * h), fill=ink)
    sd.rect((0.18 * w, 0.52 * h, 0.62 * w, 0.64 * h), fill=ink)


def ic_check(sd, w, h, col, width=8):
    sd.line([(0.12 * w, 0.54 * h), (0.40 * w, 0.82 * h), (0.90 * w, 0.20 * h)], col, width)


def ic_x(sd, w, h, col, width=8):
    sd.line([(0.15 * w, 0.15 * h), (0.85 * w, 0.85 * h)], col, width)
    sd.line([(0.85 * w, 0.15 * h), (0.15 * w, 0.85 * h)], col, width)


def ic_globe(sd, w, h, col, width=4):
    cx, cy, R = w / 2, h / 2, min(w, h) / 2 - width
    sd.circle(cx, cy, R, outline=col, width=width)
    sd.ellipse((cx - R * 0.5, cy - R, cx + R * 0.5, cy + R), outline=col, width=width * 0.7)
    sd.line([(cx, cy - R), (cx, cy + R)], col, width * 0.7, cap=False)
    sd.line([(cx - R, cy), (cx + R, cy)], col, width * 0.7, cap=False)
    sd.arc((cx - R, cy - R * 0.55, cx + R, cy + R * 0.55), 0, 360, col, width * 0.7)


def ic_lock(sd, w, h, col, ink):
    sd.arc((0.22 * w, 0.04 * h, 0.78 * w, 0.64 * h), 180, 360, col, 0.10 * w)
    sd.line([(0.27 * w, 0.34 * h), (0.27 * w, 0.50 * h)], col, 0.10 * w, cap=False)
    sd.line([(0.73 * w, 0.34 * h), (0.73 * w, 0.50 * h)], col, 0.10 * w, cap=False)
    sd.rrect((0.10 * w, 0.44 * h, 0.90 * w, 0.96 * h), 0.10 * w, fill=col)
    sd.circle(0.5 * w, 0.66 * h, 0.07 * w, fill=ink)
    sd.rect((0.485 * w, 0.66 * h, 0.515 * w, 0.82 * h), fill=ink)


def ic_heart(sd, w, h, col):
    sd.circle(0.30 * w, 0.32 * h, 0.22 * w, fill=col)
    sd.circle(0.70 * w, 0.32 * h, 0.22 * w, fill=col)
    sd.poly([(0.10 * w, 0.42 * h), (0.90 * w, 0.42 * h), (0.5 * w, 0.92 * h)], fill=col)


def ic_gem(sd, w, h, col, light):
    sd.poly([(0.22 * w, 0.10 * h), (0.78 * w, 0.10 * h), (0.98 * w, 0.38 * h), (0.5 * w, 0.96 * h), (0.02 * w, 0.38 * h)], fill=col)
    sd.poly([(0.22 * w, 0.10 * h), (0.5 * w, 0.38 * h), (0.02 * w, 0.38 * h)], fill=light)
    sd.poly([(0.78 * w, 0.10 * h), (0.5 * w, 0.38 * h), (0.98 * w, 0.38 * h)], fill=mix(col, light, 0.5))


def ic_magnifier(sd, w, h, col):
    sd.circle(0.40 * w, 0.40 * h, 0.28 * w, outline=col, width=0.07 * w)
    sd.line([(0.62 * w, 0.62 * h), (0.92 * w, 0.92 * h)], col, 0.09 * w)


def ic_mark(sd, w, h, col):
    sd.rrect((0.12 * w, 0.04 * h, 0.88 * w, 0.96 * h), 8, outline=col, width=3)
    for i in range(5):
        y = 0.2 * h + i * 0.15 * h
        sd.rect((0.24 * w, y, 0.76 * w if i % 2 == 0 else 0.6 * w, y + 0.03 * h), fill=col)


def ic_box(sd, w, h, col, acc):
    sd.rrect((0.06 * w, 0.18 * h, 0.94 * w, 0.94 * h), 6, fill=col)
    sd.rect((0.06 * w, 0.18 * h, 0.94 * w, 0.34 * h), fill=acc)
    sd.rect((0.42 * w, 0.18 * h, 0.58 * w, 0.94 * h), fill=acc)


def icon(name, w, h=None, **kw):
    h = h or w
    fns = dict(courthouse=ic_courthouse, book=ic_book, treaty=ic_treaty, shield=ic_shield, bubble=ic_bubble,
               cross=ic_cross, ballot=ic_ballot, paper=ic_paper, check=ic_check, x=ic_x, globe=ic_globe,
               lock=ic_lock, heart=ic_heart, gem=ic_gem, magnifier=ic_magnifier, mark=ic_mark, box=ic_box)
    return sprite((name, tuple(sorted(kw.items()))), w, h, lambda sd: fns[name](sd, w, h, **kw))


def bust_icon(size, col):
    return sprite(("bust", col), size, size, lambda sd: draw_bust(sd, size / 2, size * 0.40, size * 0.75 * 1.0, col))


def build_background():
    ys = np.linspace(0, 1, H)[:, None]
    xs = np.linspace(0, 1, W)[None, :]
    top = np.array(C["navy2"], float)
    bot = np.array(C["navy0"], float)
    base = top[None, None, :] * (1 - ys[..., None]) + bot[None, None, :] * ys[..., None]
    base = np.broadcast_to(base, (H, W, 3)).copy()
    d = np.sqrt(((xs - 0.5) * 1.1) ** 2 + ((ys - 0.45) * 1.0) ** 2)
    vig = 1 - 0.55 * np.clip(d - 0.25, 0, 1)
    base *= vig[..., None]
    glow = np.exp(-(((xs - 0.82) / 0.22) ** 2 + ((ys - 0.18) / 0.3) ** 2))
    base += glow[..., None] * np.array([10, 18, 34])
    im = Image.fromarray(np.clip(base, 0, 255).astype("uint8"))
    # grade de pontos discreta
    px = im.load()
    for yy in range(40, H, 60):
        for xx in range(40, W, 60):
            r, g, b = px[xx, yy]
            px[xx, yy] = (min(255, r + 14), min(255, g + 18), min(255, b + 26))
    return im


_bg = None


def background():
    global _bg
    if _bg is None:
        _bg = build_background()
    return _bg

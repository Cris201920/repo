"""Motor de vídeo da aula: desenho vetorial (Pillow), animações, legendas, voz (espeak-ng/MBROLA) e montagem (ffmpeg).

Tudo é gerado por código — nenhuma imagem de banco externo. Cada elemento visual tem função didática."""
from __future__ import annotations

import math
import re
import subprocess
import tempfile
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1920, 1080, 24

# ----------------------------------------------------------------------------- paleta
NAVY = (8, 22, 46)
NAVY_2 = (13, 34, 68)
NAVY_3 = (20, 48, 92)
WHITE = (244, 247, 252)
GOLD = (212, 175, 90)
GOLD_SOFT = (176, 146, 78)
GRAY = (150, 164, 188)
GRAY_D = (86, 102, 130)
RED = (226, 96, 96)
GREEN = (110, 200, 160)
CYAN = (110, 190, 230)

FONT_DIRS = ["/usr/share/fonts/opentype/inter", "/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/crosextra",
             "/usr/share/fonts/truetype/liberation"]
FONT_FILES = {
    "sans": "Inter-Regular.otf", "sans-med": "Inter-Medium.otf", "sans-semi": "Inter-SemiBold.otf", "sans-bold": "Inter-Bold.otf",
    "serif": "Caladea-Bold.ttf", "serif-reg": "Caladea-Regular.ttf",
}
_font_cache: dict = {}


def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    key = (kind, size)
    if key in _font_cache:
        return _font_cache[key]
    name = FONT_FILES.get(kind, FONT_FILES["sans"])
    fallbacks = [name, "DejaVuSerif-Bold.ttf" if "serif" in kind else "DejaVuSans.ttf", "DejaVuSans.ttf"]
    for fn in fallbacks:
        for d in FONT_DIRS:
            p = Path(d) / fn
            if p.exists():
                _font_cache[key] = ImageFont.truetype(str(p), size)
                return _font_cache[key]
    _font_cache[key] = ImageFont.load_default()
    return _font_cache[key]


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def ease_out(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def ease_io(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------------------- ícones (coordenadas 0..100)
class Pen:
    """Desenha em 0..100 com superamostragem 4x e devolve um sprite RGBA."""

    def __init__(self, size: int, ss: int = 4):
        self.size, self.ss = size, ss
        self.N = size * ss
        self.im = Image.new("RGBA", (self.N, self.N), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.k = self.N / 100.0

    def p(self, *v):
        return [x * self.k for x in v]

    def rect(self, x0, y0, x1, y1, fill=None, outline=None, w=0, r=0):
        box = self.p(x0, y0, x1, y1)
        if r:
            self.d.rounded_rectangle(box, radius=r * self.k, fill=fill, outline=outline, width=int(w * self.k))
        else:
            self.d.rectangle(box, fill=fill, outline=outline, width=int(w * self.k))

    def ell(self, x0, y0, x1, y1, fill=None, outline=None, w=0):
        self.d.ellipse(self.p(x0, y0, x1, y1), fill=fill, outline=outline, width=int(w * self.k))

    def poly(self, pts, fill=None, outline=None, w=0):
        flat = [c * self.k for pt in pts for c in pt]
        self.d.polygon(flat, fill=fill)
        if outline:
            self.d.line(flat + flat[:2], fill=outline, width=int(w * self.k), joint="curve")

    def line(self, pts, fill, w=3, cap=True):
        flat = [c * self.k for pt in pts for c in pt]
        self.d.line(flat, fill=fill, width=int(w * self.k), joint="curve")
        if cap:
            r = w * self.k / 2
            for x, y in (pts[0], pts[-1]):
                self.d.ellipse([x * self.k - r, y * self.k - r, x * self.k + r, y * self.k + r], fill=fill)

    def arc(self, box, a0, a1, fill, w=3):
        self.d.arc(self.p(*box), a0, a1, fill=fill, width=int(w * self.k))

    def done(self) -> Image.Image:
        return self.im.resize((self.size, self.size), Image.LANCZOS)


def _person(pen: Pen, cx, top, scale, col):
    pen.ell(cx - 13 * scale, top, cx + 13 * scale, top + 26 * scale, fill=col)
    pen.d.pieslice(pen.p(cx - 28 * scale, top + 32 * scale, cx + 28 * scale, top + 32 * scale + 62 * scale), 180, 360, fill=col)


def icon(name: str, size: int, col=WHITE, acc=GOLD, **kw) -> Image.Image:
    pen = Pen(size)
    c, a = rgba(col), rgba(acc)
    d = pen
    if name == "scales":
        tilt = kw.get("tilt", 0.0)               # graus; + inclina para a direita
        d.rect(47, 20, 53, 82, fill=c, r=2)
        d.rect(30, 80, 70, 88, fill=c, r=3)
        cx, cy, L = 50, 26, 32
        ang = math.radians(tilt)
        lx, ly = cx - L * math.cos(ang), cy - L * math.sin(ang)
        rx, ry = cx + L * math.cos(ang), cy + L * math.sin(ang)
        d.line([(lx, ly), (rx, ry)], c, 4)
        d.ell(cx - 5, cy - 5, cx + 5, cy + 5, fill=a)
        for px, py in ((lx, ly), (rx, ry)):
            d.line([(px, py), (px - 12, py + 30)], c, 1.6, cap=False)
            d.line([(px, py), (px + 12, py + 30)], c, 1.6, cap=False)
            d.d.pieslice(d.p(px - 15, py + 22, px + 15, py + 42), 0, 180, fill=a)
    elif name == "book":
        d.rect(24, 18, 78, 82, fill=c, r=4)
        d.rect(30, 18, 78, 82, fill=rgba(NAVY_3), r=4, outline=c, w=1.5)
        for y in (34, 46, 58):
            d.line([(40, y), (68, y)], a, 2.2)
    elif name == "constitution":
        d.rect(20, 10, 80, 90, fill=rgba(NAVY_3), outline=a, w=2.4, r=4)
        d.rect(26, 16, 74, 84, outline=a, w=1, r=2)
        pts = []
        for i in range(10):
            r = 15 if i % 2 == 0 else 6.5
            ang = math.radians(-90 + i * 36)
            pts.append((50 + r * math.cos(ang), 38 + r * math.sin(ang)))
        d.poly(pts, fill=a)
        for y in (62, 70, 78):
            d.line([(36, y), (64, y)], c, 2)
    elif name == "treaty":
        d.poly([(24, 8), (68, 8), (82, 22), (82, 92), (24, 92)], fill=c)
        d.poly([(68, 8), (68, 22), (82, 22)], fill=rgba(GRAY))
        for y in (30, 42, 54):
            d.line([(34, y), (70, y)], rgba(NAVY_3), 2.4)
        d.line([(60, 82), (66, 96)], a, 5, cap=False)
        d.line([(74, 82), (68, 96)], a, 5, cap=False)
        d.ell(52, 62, 82, 92, fill=a)
        d.ell(58, 68, 76, 86, outline=rgba(NAVY), w=2)
    elif name == "courthouse":
        d.poly([(50, 8), (6, 34), (94, 34)], fill=c)
        d.rect(10, 36, 90, 43, fill=c)
        for i in range(5):
            x = 16 + i * 17
            d.rect(x, 46, x + 10, 78, fill=c, r=1.5)
        d.rect(6, 80, 94, 87, fill=c)
        d.rect(2, 87, 98, 94, fill=a)
    elif name == "person":
        _person(d, 50, 8, 1.0, c)
    elif name == "halo_person":
        _person(d, 50, 20, 0.95, c)
        d.ell(34, 4, 66, 14, outline=a, w=2.6)
    elif name == "people":
        _person(d, 24, 30, 0.55, rgba(CYAN))
        _person(d, 76, 30, 0.55, rgba(GREEN))
        _person(d, 50, 14, 0.7, c)
    elif name == "shield":
        d.poly([(50, 6), (88, 20), (88, 50), (50, 94), (12, 50), (12, 20)], fill=c)
        d.poly([(50, 16), (78, 27), (78, 49), (50, 82), (22, 49), (22, 27)], fill=rgba(NAVY_3))
        if kw.get("check", True):
            d.line([(36, 50), (47, 62), (66, 38)], a, 6)
    elif name == "chain":
        d.d.rounded_rectangle(d.p(8, 36, 46, 64), radius=14 * d.k, outline=c, width=int(5 * d.k))
        d.d.rounded_rectangle(d.p(54, 36, 92, 64), radius=14 * d.k, outline=c, width=int(5 * d.k))
        for (x0, y0, x1, y1) in ((46, 28, 52, 20), (50, 72, 56, 80), (48, 50, 56, 50)):
            d.line([(x0, y0), (x1, y1)], a, 3)
        d.poly([(44, 44), (56, 44), (56, 56), (44, 56)], fill=rgba(NAVY_2))
    elif name == "equal":
        d.ell(10, 10, 90, 90, outline=c, w=4)
        d.rect(28, 36, 72, 44, fill=a, r=3)
        d.rect(28, 56, 72, 64, fill=a, r=3)
    elif name == "megaphone":
        d.poly([(14, 40), (40, 40), (78, 16), (78, 84), (40, 60), (14, 60)], fill=c)
        d.rect(24, 58, 36, 82, fill=c, r=3)
        for r_, w_ in ((14, 3), (24, 3)):
            d.arc((80 - r_ + 4, 50 - r_, 80 + r_ + 4, 50 + r_), -50, 50, a, w_)
    elif name == "speech":
        d.rect(8, 14, 92, 70, fill=c, r=12)
        d.poly([(28, 68), (28, 90), (50, 68)], fill=c)
        for x in (32, 50, 68):
            d.ell(x - 5, 36, x + 5, 46, fill=rgba(NAVY_3))
    elif name == "ballot":
        d.rect(16, 44, 84, 90, fill=c, r=5)
        d.rect(30, 52, 70, 58, fill=rgba(NAVY_3), r=2)
        d.poly([(30, 10), (70, 10), (70, 46), (30, 46)], fill=rgba(WHITE), outline=a, w=1.5)
        d.line([(38, 28), (46, 36), (62, 18)], a, 4)
    elif name == "cross":
        d.rect(10, 10, 90, 90, fill=c, r=16)
        d.rect(42, 22, 58, 78, fill=rgba(NAVY_3), r=3)
        d.rect(22, 42, 78, 58, fill=rgba(NAVY_3), r=3)
    elif name == "hand_stop":
        for i, (x, top) in enumerate(((26, 24), (40, 12), (54, 8), (68, 14))):
            d.rect(x, top, x + 11, 60, fill=c, r=5.5)
        d.rect(24, 44, 80, 86, fill=c, r=14)
        d.poly([(24, 58), (6, 46), (12, 38), (28, 50)], fill=c)
    elif name == "check":
        d.ell(8, 8, 92, 92, fill=a)
        d.line([(28, 52), (44, 68), (74, 34)], rgba(NAVY), 8)
    elif name == "warn":
        d.poly([(50, 8), (94, 88), (6, 88)], fill=a)
        d.rect(46, 34, 54, 62, fill=rgba(NAVY), r=3)
        d.ell(45, 68, 55, 78, fill=rgba(NAVY))
    elif name == "question":
        d.ell(6, 6, 94, 94, outline=a, w=4)
        d.d.arc(d.p(32, 22, 68, 56), 180, 400, fill=a, width=int(6 * d.k))
        d.line([(60, 46), (50, 58), (50, 66)], a, 6)
        d.ell(45, 74, 55, 84, fill=a)
    elif name == "gavel":
        d.rect(14, 16, 54, 40, fill=c, r=5)
        d.line([(34, 40), (72, 78)], c, 8)
        d.rect(52, 84, 94, 92, fill=a, r=3)
    else:
        raise ValueError(f"ícone desconhecido: {name}")
    return pen.done()


def person_pose(size: int, progress: float, mode: str, col=WHITE, acc=GOLD) -> Image.Image:
    """Figura humana animada. mode='action': levanta uma caixa (prestação). mode='stop': estende a palma (abstenção)."""
    pen = Pen(size)
    c, a = rgba(col), rgba(acc)
    p = ease_io(progress)
    pen.ell(36, 8, 60, 32, fill=c)
    pen.d.pieslice(pen.p(24, 38, 72, 112), 180, 360, fill=c)
    if mode == "action":
        # braço esquerdo sobe; caixa acompanha a mão
        ang = math.radians(100 - 130 * p)         # 100° (baixo) -> -30° (alto)
        sx, sy = 60, 52
        hx, hy = sx + 30 * math.cos(ang), sy + 30 * math.sin(ang)
        pen.line([(sx, sy), (hx, hy)], c, 7)
        bx, by = hx - 4, hy - 20
        pen.rect(bx - 14, by - 8, bx + 14, by + 12, fill=a, r=2)
        pen.line([(bx - 14, by + 1), (bx + 14, by + 1)], rgba(NAVY), 1.5, cap=False)
        pen.line([(36, 52), (28, 80)], c, 7)
    else:
        sx, sy = 60, 52
        hx, hy = sx + 18 + 8 * p, sy - 4 - 6 * p
        pen.line([(sx, sy), (hx, hy)], c, 7)
        palm = (hx + 4, hy - 8, hx + 30, hy + 22)
        pen.rect(*palm, fill=a, r=6)
        for i in range(4):
            x = palm[0] + 1.0 + i * 6.4
            pen.rect(x, palm[1] - 13 * p, x + 5.2, palm[1] + 6, fill=a, r=2.6)
        pen.line([(36, 52), (28, 80)], c, 7)
    return pen.done()


# ----------------------------------------------------------------------------- texto
def wrap_text(text: str, fnt, max_w: int) -> list[str]:
    lines, cur = [], ""
    dummy = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    for para in text.split("\n"):
        cur = ""
        for word in para.split(" "):
            test = (cur + " " + word).strip()
            if dummy.textlength(test, font=fnt) <= max_w or not cur:
                cur = test
            else:
                lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


def text_sprite(text: str, size: int, color=WHITE, kind="sans-semi", max_w: int | None = None, align="left",
                line_h: float = 1.25, hl: dict | None = None, shadow: bool = False) -> Image.Image:
    f = font(kind, size)
    lines = wrap_text(text, f, max_w) if max_w else text.split("\n")
    d0 = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    widths = [d0.textlength(l, font=f) for l in lines]
    w = int(max(widths) + 8)
    lh = int(size * line_h)
    h = lh * len(lines) + 8
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, line in enumerate(lines):
        x = 4 if align == "left" else (w - widths[i]) / 2 if align == "center" else w - 4 - widths[i]
        y = 4 + i * lh
        if shadow:
            d.text((x + 2, y + 3), line, font=f, fill=(0, 0, 0, 120))
        d.text((x, y), line, font=f, fill=rgba(color))
    return im


def rich_text_sprite(text: str, size: int, terms: list[str], color=WHITE, hl=GOLD, kind="sans-med", max_w=1500,
                     align="center") -> Image.Image:
    """Texto com destaque dourado para termos jurídicos (usado nas legendas)."""
    f = font(kind, size)
    fb = font("sans-bold", size)
    lines = wrap_text(text, f, max_w)
    d0 = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
    lh = int(size * 1.3)
    pat = re.compile("(" + "|".join(re.escape(t) for t in sorted(terms, key=len, reverse=True)) + ")", re.IGNORECASE) if terms else None

    def segments(line):
        parts = pat.split(line) if pat else [line]
        return [(p, bool(pat and pat.fullmatch(p))) for p in parts if p]

    widths = [sum(d0.textlength(p, font=fb if term else f) for p, term in segments(l)) for l in lines]
    w, h = int(max(widths)) + 16, lh * len(lines) + 6
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, line in enumerate(lines):
        x = (w - widths[i]) / 2 if align == "center" else 4
        y = 3 + i * lh
        for part, is_term in segments(line):
            ff = fb if is_term else f
            d.text((x, y), part, font=ff, fill=rgba(hl if is_term else color))
            x += d0.textlength(part, font=ff)
    return im


# ----------------------------------------------------------------------------- elementos e cenas
@dataclass
class El:
    make: Callable[[], Image.Image]
    x: int
    y: int
    anchor: str = "tl"                         # tl | mm | tc | tr | ml
    at: tuple = (0, 0.0)                       # (índice da frase, deslocamento em s)
    dur: float = 0.6
    anim: str = "fade_up"                      # fade | fade_up | pop | wipe | none
    until: tuple | None = None
    dynamic: Callable[[float], Image.Image] | None = None   # recebe tempo local (s) desde o aparecimento
    _sprite: Image.Image | None = field(default=None, repr=False)
    label: str = ""

    def sprite(self) -> Image.Image:
        if self._sprite is None:
            self._sprite = self.make()
        return self._sprite

    def origin(self, spr: Image.Image) -> tuple[int, int]:
        w, h = spr.size
        if self.anchor == "mm":
            return self.x - w // 2, self.y - h // 2
        if self.anchor == "tc":
            return self.x - w // 2, self.y
        if self.anchor == "tr":
            return self.x - w, self.y
        if self.anchor == "ml":
            return self.x, self.y - h // 2
        return self.x, self.y


@dataclass
class Phrase:
    text: str
    pause: float = 0.28


@dataclass
class Scene:
    sid: str
    tag: str
    block: int
    phrases: list[Phrase]
    tail: float = 0.35
    els: list[El] = field(default_factory=list)
    motif: str | None = None
    notes: str = ""                              # direção de arte/animação para o roteiro
    extra: float = 0.0                           # silêncio adicional ao final (ex.: tempo de reflexão)
    # preenchidos na montagem da linha do tempo:
    t0: float = 0.0
    t1: float = 0.0
    ph_times: list[tuple[float, float]] = field(default_factory=list)

    def add(self, el: El) -> El:
        self.els.append(el)
        return el


def txt(text, x, y, size=44, color=WHITE, kind="sans-semi", anchor="tl", at=(0, 0.0), max_w=None, align="left",
        anim="fade_up", dur=0.6, until=None, line_h=1.25) -> El:
    return El(lambda: text_sprite(text, size, color, kind, max_w, align, line_h), x, y, anchor, at, dur, anim, until, label=text)


def ico(name, x, y, size=160, anchor="mm", at=(0, 0.0), col=WHITE, acc=GOLD, anim="pop", dur=0.6, until=None, **kw) -> El:
    return El(lambda: icon(name, size, col, acc, **kw), x, y, anchor, at, dur, anim, until, label=f"[ícone {name}]")


def panel(w, h, fill=NAVY_2, border=GOLD_SOFT, radius=28, bw=2, alpha=235, glow=False) -> Image.Image:
    pad = 30 if glow else 0
    im = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    if glow:
        g = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(g).rounded_rectangle((pad, pad, pad + w, pad + h), radius=radius, fill=rgba(border, 90))
        im.alpha_composite(g.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((pad, pad, pad + w, pad + h), radius=radius, fill=rgba(fill, alpha), outline=rgba(border), width=bw)
    return im


def box(x, y, w, h, at=(0, 0.0), fill=NAVY_2, border=GOLD_SOFT, anchor="tl", anim="fade_up", dur=0.6, radius=28, glow=False, until=None) -> El:
    return El(lambda: panel(w, h, fill, border, radius, glow=glow), x - (30 if glow and anchor == "tl" else 0),
              y - (30 if glow and anchor == "tl" else 0), anchor, at, dur, anim, until, label="[painel]")


def pill(text, x, y, size=34, color=NAVY, fill=GOLD, anchor="mm", at=(0, 0.0), anim="pop", dur=0.5, kind="sans-bold", pad=(30, 14)) -> El:
    def make():
        t = text_sprite(text, size, color, kind)
        w, h = t.size[0] + 2 * pad[0], t.size[1] + 2 * pad[1] - 8
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(im).rounded_rectangle((0, 0, w - 1, h - 1), radius=h // 2, fill=rgba(fill))
        im.alpha_composite(t, (pad[0], pad[1] - 4))
        return im
    return El(make, x, y, anchor, at, dur, anim, label=text)


def arrow_el(x0, y0, x1, y1, color=GOLD, w=8, at=(0, 0.0), anim="wipe", dur=0.6, head=26) -> El:
    def make():
        pw, ph = abs(x1 - x0) + 80, abs(y1 - y0) + 80
        ox, oy = min(x0, x1) - 40, min(y0, y1) - 40
        im = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        a = (x0 - ox, y0 - oy)
        b = (x1 - ox, y1 - oy)
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        end = (b[0] - head * 0.6 * math.cos(ang), b[1] - head * 0.6 * math.sin(ang))
        d.line([a, end], fill=rgba(color), width=w)
        d.polygon([b, (b[0] - head * math.cos(ang - 0.45), b[1] - head * math.sin(ang - 0.45)),
                   (b[0] - head * math.cos(ang + 0.45), b[1] - head * math.sin(ang + 0.45))], fill=rgba(color))
        return im
    return El(make, min(x0, x1) - 40, min(y0, y1) - 40, "tl", at, dur, anim, label="[seta]")


def dyn(fn: Callable[[float], Image.Image], x, y, anchor="mm", at=(0, 0.0), dur=0.5, until=None) -> El:
    return El(lambda: fn(0.0), x, y, anchor, at, dur, "fade", until, dynamic=fn, label="[animação]")


# ----------------------------------------------------------------------------- fundo e legendas
TERMS = ["Direitos Humanos", "direito-pretensão", "direito-liberdade", "direito-poder", "direito-imunidade", "liberdade", "igualdade",
         "dignidade", "universalidade", "essencialidade", "superioridade normativa", "preferenciabilidade", "reciprocidade",
         "fundamentalidade formal", "fundamentalidade material", "subjetivo", "objetivo", "conduta ativa", "conduta passiva",
         "pretensão", "imunidade", "poder", "formal", "material", "direito a ter direitos", "Constituição", "tratados internacionais"]

_bg_cache: dict = {}


def background(scene: Scene) -> Image.Image:
    key = (scene.block, scene.motif)
    if key in _bg_cache:
        return _bg_cache[key].copy()
    base = Image.new("RGB", (W, H), NAVY)
    px = Image.linear_gradient("L").resize((W, H))
    top = Image.new("RGB", (W, H), NAVY_3)
    base = Image.composite(Image.new("RGB", (W, H), (5, 12, 28)), top, px)   # topo claro -> base escura
    base = base.convert("RGBA")
    d = ImageDraw.Draw(base)
    # linhas finas (grade sutil) e vinheta
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 120):
        gd.line([(x, 0), (x, H)], fill=(255, 255, 255, 6))
    for y in range(0, H, 120):
        gd.line([(0, y), (W, y)], fill=(255, 255, 255, 6))
    base.alpha_composite(grid)
    vign = Image.new("L", (W, H), 0)
    ImageDraw.Draw(vign).ellipse((-W * 0.25, -H * 0.35, W * 1.25, H * 1.35), fill=255)
    vign = vign.filter(ImageFilter.GaussianBlur(220))
    dark = Image.new("RGBA", (W, H), (2, 6, 16, 150))
    base.alpha_composite(Image.composite(Image.new("RGBA", (W, H), (0, 0, 0, 0)), dark, vign))
    if scene.motif:
        m = icon(scene.motif, 760, WHITE, GOLD)
        faint = Image.new("RGBA", m.size, (0, 0, 0, 0))
        r, g, b, a = m.split()
        faint = Image.merge("RGBA", (r, g, b, a.point(lambda v: int(v * 0.045))))
        base.alpha_composite(faint, (W - 800, 150))
    # cabeçalho
    base.alpha_composite(text_sprite("AULA · DIREITOS HUMANOS", 22, GRAY, "sans-semi"), (64, 36))
    if scene.tag:
        t = text_sprite(scene.tag, 26, GOLD, "sans-bold")
        base.alpha_composite(t, (64, 70))
    # progresso por blocos (7)
    for i in range(1, 8):
        col = GOLD if i == scene.block else (GRAY_D if i > scene.block else GOLD_SOFT)
        d.rounded_rectangle((W - 64 - (8 - i) * 46, 48, W - 64 - (8 - i) * 46 + 34, 56), radius=4, fill=rgba(col))
    _bg_cache[key] = base
    return base.copy()


_sub_cache: dict = {}


def subtitle_sprite(text: str) -> Image.Image:
    if text in _sub_cache:
        return _sub_cache[text]
    t = rich_text_sprite(text, 40, TERMS)
    w, h = t.size[0] + 80, t.size[1] + 36
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, w - 1, h - 1), radius=22, fill=(3, 8, 20, 205))
    im.alpha_composite(t, (40, 16))
    _sub_cache[text] = im
    return im


# ----------------------------------------------------------------------------- composição de quadros
def el_state(el: El, scene: Scene, t: float):
    """Devolve (sprite, x, y, alpha) se o elemento estiver visível em t; senão None."""
    idx, off = el.at
    start = (scene.ph_times[min(idx, len(scene.ph_times) - 1)][0] if scene.ph_times else scene.t0) + off
    if t < start:
        return None
    if el.until is not None:
        u_idx, u_off = el.until
        end = (scene.ph_times[min(u_idx, len(scene.ph_times) - 1)][0] if scene.ph_times else scene.t0) + u_off
        if t >= end + 0.35:
            return None
        fade_out = 1.0 if t < end else max(0.0, 1 - (t - end) / 0.35)
    else:
        fade_out = 1.0
    p = ease_out((t - start) / el.dur) if el.dur > 0 else 1.0
    spr = el.dynamic(t - start) if el.dynamic else el.sprite()
    x, y = el.origin(spr)
    alpha = p * fade_out
    if el.anim == "fade_up":
        y += int((1 - p) * 34)
    elif el.anim == "pop":
        s = 0.86 + 0.14 * p
        if s < 0.999:
            w, h = spr.size
            spr = spr.resize((max(1, int(w * s)), max(1, int(h * s))), Image.BILINEAR)
            x += (w - spr.size[0]) // 2
            y += (h - spr.size[1]) // 2
    elif el.anim == "wipe":
        w, h = spr.size
        cw = max(1, int(w * p))
        spr = spr.crop((0, 0, cw, h))
        alpha = fade_out
    return spr, x, y, alpha


def is_animating(scene: Scene, t: float) -> bool:
    for el in scene.els:
        idx, off = el.at
        start = (scene.ph_times[min(idx, len(scene.ph_times) - 1)][0] if scene.ph_times else scene.t0) + off
        if el.dynamic and t >= start and (el.until is None or t < start + 60):
            return True
        if start <= t < start + el.dur + 0.05:
            return True
        if el.until is not None:
            u_idx, u_off = el.until
            end = scene.ph_times[min(u_idx, len(scene.ph_times) - 1)][0] + u_off
            if end <= t < end + 0.4:
                return True
    return False


def signature(scene: Scene, t: float):
    vis = tuple(i for i, el in enumerate(scene.els) if el_state(el, scene, t) is not None and not el.dynamic)
    ph = next((i for i, (a, b) in enumerate(scene.ph_times) if a - 0.02 <= t < b + 0.12), -1)
    return (scene.sid, vis, ph)


def render_frame(scene: Scene, t: float, fade: float = 1.0) -> Image.Image:
    img = background(scene)
    for el in scene.els:
        st = el_state(el, scene, t)
        if st is None:
            continue
        spr, x, y, a = st
        if a <= 0:
            continue
        if a < 0.999:
            r, g, b, al = spr.split()
            spr = Image.merge("RGBA", (r, g, b, al.point(lambda v, a=a: int(v * a))))
        _paste_clipped(img, spr, x, y)
    ph = next((i for i, (a, b) in enumerate(scene.ph_times) if a - 0.02 <= t < b + 0.12), -1)
    if ph >= 0 and scene.phrases[ph].text:
        sub = subtitle_sprite(scene.phrases[ph].text)
        img.alpha_composite(sub, ((W - sub.size[0]) // 2, H - sub.size[1] - 46))
    out = img.convert("RGB")
    if fade < 1.0:
        out = Image.blend(Image.new("RGB", (W, H), (4, 10, 24)), out, fade)
    return out


def _paste_clipped(img, spr, x, y):
    sx, sy = max(0, -x), max(0, -y)
    if sx >= spr.size[0] or sy >= spr.size[1]:
        return
    img.alpha_composite(spr.crop((sx, sy, spr.size[0], spr.size[1])), (max(0, x), max(0, y)))


# ----------------------------------------------------------------------------- voz e áudio
def tts_phrase(text: str, out: Path, voice: str = "mb-br1", speed: int = 150, pitch: int = 50) -> float:
    """Sintetiza uma frase com espeak-ng (voz brasileira MBROLA) e devolve a duração em segundos."""
    spoken = text.replace("—", ",").replace("–", ",")
    subprocess.run(["espeak-ng", "-v", voice, "-s", str(speed), "-p", str(pitch), "-w", str(out), spoken], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with wave.open(str(out), "rb") as w:
        return w.getnframes() / w.getframerate()


def read_wav_mono_float(path: Path):
    import numpy as np
    with wave.open(str(path), "rb") as w:
        sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        data = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1:
        data = data.reshape(-1, ch).mean(axis=1)
    return data, sr


def resample(x, sr_from: int, sr_to: int):
    import numpy as np
    if sr_from == sr_to:
        return x
    n = int(len(x) * sr_to / sr_from)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def ambient_music(seconds: float, sr: int = 44100):
    """Trilha ambiente instrumental discreta (pad de cordas sintetizado: Am – F – C – G), original e livre de direitos."""
    import numpy as np
    chords = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (261.63, 329.63, 392.0), (196.0, 246.94, 293.66)]
    seg = 12.0
    n = int(seconds * sr)
    t = np.arange(n) / sr
    out = np.zeros(n, dtype=np.float32)
    for ci, ch in enumerate(chords):
        env = np.zeros(n, dtype=np.float32)
        period = seg * len(chords)
        ph = (t % period) - ci * seg
        m = (ph >= -2) & (ph < seg + 2)
        env[m] = np.clip((ph[m] + 2) / 4, 0, 1) * np.clip((seg + 2 - ph[m]) / 4, 0, 1)
        for f in ch:
            for det, amp in ((0.0, 1.0), (0.6, 0.6), (-0.7, 0.6)):
                out += (env * amp * np.sin(2 * np.pi * (f + det) * t)).astype(np.float32) * 0.05
            out += (env * np.sin(2 * np.pi * (f / 2) * t) * 0.04).astype(np.float32)
    out *= (0.85 + 0.15 * np.sin(2 * np.pi * t / 9.0)).astype(np.float32)          # respiração lenta
    fade = np.clip(np.minimum(t, seconds - t) / 3.0, 0, 1).astype(np.float32)
    return out * fade


def write_wav_stereo(path: Path, mono, sr: int = 44100):
    import numpy as np
    data = np.clip(mono, -1, 1)
    pcm = (np.stack([data, data], axis=1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())

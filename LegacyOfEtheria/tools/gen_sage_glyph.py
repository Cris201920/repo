# Indicador do Grande Sábio na legenda: glifos .. (anel girando + núcleo pulsando),  (em espera). RP/font/glyph_E2.png (16x16 células de 32 px).
import math, os
from PIL import Image, ImageDraw, ImageFilter
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "LegacyOfEtheria_RP/font/glyph_E2.png")
C = 32; sheet = Image.new("RGBA", (C * 16, C * 16), (0, 0, 0, 0))
def frame(k, idle=False):
    S = 4; W = C * S; im = Image.new("RGBA", (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = W / 2
    pulse = 0.8 + 0.2 * math.sin(k / 8 * 2 * math.pi)
    r = W * 0.18 * pulse   # núcleo
    for i in range(12, 0, -1):
        a = int(255 * (1 - i / 12) ** 1.6); rr = r * (1 + i * 0.12)
        d.ellipse([c - rr, c - rr, c + rr, c + rr], fill=(90, 220, 255, a // 3))
    d.ellipse([c - r, c - r, c + r, c + r], fill=(200, 250, 255, 255))
    R = W * 0.42; base = 0 if idle else k * 45
    d.ellipse([c - R, c - R, c + R, c + R], outline=(60, 170, 230, 150), width=S * 2)
    if not idle:
        for off, w in ((0, 5), (180, 3)):
            d.arc([c - R, c - R, c + R, c + R], base + off, base + off + 90, fill=(140, 240, 255, 255), width=S * w)
        for i in range(3):   # pontos orbitando
            a = math.radians(base * 1.5 + i * 120); x, y = c + math.cos(a) * R, c + math.sin(a) * R
            d.ellipse([x - S * 2.2, y - S * 2.2, x + S * 2.2, y + S * 2.2], fill=(255, 255, 255, 255))
    return im.filter(ImageFilter.GaussianBlur(S * 0.3)).resize((C, C), Image.LANCZOS)
for k in range(8): sheet.alpha_composite(frame(k), ((k % 16) * C, 0))
sheet.alpha_composite(frame(0, idle=True), (8 * C, 0))
sheet.save(OUT); print("ok", OUT)

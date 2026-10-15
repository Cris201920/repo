# Camadas da tela da Voz do Mundo / menus (6.35): texturas pequenas (≤512 px) em vez da tira de 24 quadros, que o jogo reduzia a poucos pixels.
# Brancas (com alfa) para serem tingidas pela cor do tema no JSON UI ("color"). Arte procedural original.
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops
OUT = sys.argv[1]; W, H = 512, 288; random.seed(11)
def save(im, n): im.save(os.path.join(OUT, n), optimize=True); print(n, os.path.getsize(os.path.join(OUT, n)))
# fundo: preto-azulado + estrelas + vinheta (neutro)
bg = Image.new("RGB", (W, H), (5, 5, 10)); d = ImageDraw.Draw(bg)
for _ in range(260):
    x, y, b = random.uniform(0, W), random.uniform(0, H), random.random(); r = 0.6 if b < 0.85 else 1.3
    d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(int(90 + 160 * b) for _ in range(3)))
vig = Image.new("L", (W, H), 0); vd = ImageDraw.Draw(vig)
for k in range(30): f = k / 30; vd.ellipse([-W * 0.25 * (1 - f), -H * 0.45 * (1 - f), W * (1 + 0.25 * (1 - f)), H * (1 + 0.45 * (1 - f))], fill=int(255 * f))
bg = Image.composite(bg, Image.new("RGB", (W, H), (0, 0, 0)), vig.filter(ImageFilter.GaussianBlur(20))); save(bg, "ov_bg.png")
cx, cy = W / 2, H * 0.47
def white_alpha(L):   # máscara L -> imagem branca com alfa
    im = Image.new("RGBA", (W, H), (255, 255, 255, 0)); im.putalpha(L); return im
# nebulosa (tingida pelo tema)
neb = Image.new("L", (W, H), 0); nd = ImageDraw.Draw(neb)
for _ in range(18):
    x, y, r = cx + random.gauss(0, 90), cy + random.gauss(0, 50), random.uniform(30, 90); nd.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6], fill=random.randint(30, 70))
nd.ellipse([cx - 120, cy - 70, cx + 120, cy + 70], fill=90)
save(white_alpha(neb.filter(ImageFilter.GaussianBlur(28))), "ov_nebula.png")
# raios: 16 por camada, 4 camadas defasadas (giram por troca suave)
base = [(k * 2 * math.pi / 16 + random.uniform(-0.1, 0.1), random.uniform(0.55, 1.0), random.uniform(1.0, 2.0)) for k in range(16)]
for layer in range(4):
    L = Image.new("L", (W * 2, H * 2), 0); ld = ImageDraw.Draw(L)
    for a0, br, wd in base:
        a = a0 + layer * (2 * math.pi / 16) / 4
        ld.line([(cx * 2, cy * 2), (cx * 2 + math.cos(a) * W * 2, cy * 2 + math.sin(a) * W * 2)], fill=int(255 * br), width=int(wd * 3))
    L = L.filter(ImageFilter.GaussianBlur(3)).resize((W, H), Image.LANCZOS)
    save(white_alpha(L), f"ov_rays_{layer}.png")
# wireframe (icosaedro) em duas rotações
p = (1 + 5 ** 0.5) / 2
V = [(-1, p, 0), (1, p, 0), (-1, -p, 0), (1, -p, 0), (0, -1, p), (0, 1, p), (0, -1, -p), (0, 1, -p), (p, 0, -1), (p, 0, 1), (-p, 0, -1), (-p, 0, 1)]
E = [(i, j) for i in range(12) for j in range(i + 1, 12) if abs(sum((a - b) ** 2 for a, b in zip(V[i], V[j])) - 4) < 1e-6]
for k, ang in enumerate((0.0, 0.6)):
    L = Image.new("L", (W * 2, H * 2), 0); ld = ImageDraw.Draw(L)
    for s, off in ((H * 0.30, 0.0), (H * 0.34, 0.8)):
        P = []
        for x, y, z in V:
            a = ang + off; x, z = x * math.cos(a) + z * math.sin(a), -x * math.sin(a) + z * math.cos(a)
            y, z = y * math.cos(0.5) - z * math.sin(0.5), y * math.sin(0.5) + z * math.cos(0.5)
            P.append((cx * 2 + x / 1.9 * s * 2 / (1 + z * 0.08), cy * 2 + y / 1.9 * s * 2 / (1 + z * 0.08)))
        for i, j in E: ld.line([P[i], P[j]], fill=170, width=2)
    save(white_alpha(L.resize((W, H), Image.LANCZOS)), f"ov_wire_{k}.png")
# núcleo
C = Image.new("L", (128, 128), 0); cd = ImageDraw.Draw(C)
for r in range(64, 0, -1): cd.ellipse([64 - r, 64 - r, 64 + r, 64 + r], fill=int(255 * (1 - r / 64) ** 1.8))
c = Image.new("RGBA", (128, 128), (255, 255, 255, 0)); c.putalpha(C); save(c, "ov_core.png")

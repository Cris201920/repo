# Gera as texturas animadas (flip-book vertical) da Voz do Mundo / núcleo do Sábio: estrelas, raios girando, icosaedro em wireframe e brilho central.
# Arte procedural original (não usa nada do mod). Uso: python3 gen_ui_frames.py <pasta textures/ui/etheria>
import sys, math, random, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
W, H, N = 320, 170, 24
THEMES = {  # raio, núcleo/wireframe, brilho
  "world":   ((235, 40, 50), (235, 235, 245), (255, 235, 230)),
  "sage":    ((40, 150, 255), (200, 235, 255), (220, 245, 255)),
  "raphael": ((255, 185, 40), (255, 240, 200), (255, 245, 210)),
  "ciel":    ((170, 90, 255), (240, 225, 255), (250, 240, 255)),
  "tree":    ((150, 70, 230), (255, 215, 120), (255, 230, 170)),
}
# icosaedro
p = (1 + 5 ** 0.5) / 2
V = [(-1, p, 0), (1, p, 0), (-1, -p, 0), (1, -p, 0), (0, -1, p), (0, 1, p), (0, -1, -p), (0, 1, -p), (p, 0, -1), (p, 0, 1), (-p, 0, -1), (-p, 0, 1)]
E = sorted({tuple(sorted((i, j))) for i in range(12) for j in range(12) if i < j and abs(sum((a - b) ** 2 for a, b in zip(V[i], V[j])) - 4) < 1e-6})
# eixo de 5 dobras = vértice 0 normalizado; rotacionar 72° em N quadros fecha o laço sem emenda
ax = V[0]; L = math.sqrt(sum(c * c for c in ax)); ax = tuple(c / L for c in ax)
def rot(v, axis, a):
    x, y, z = v; u, w, t = axis; c, s = math.cos(a), math.sin(a); d = u * x + w * y + t * z
    return (u * d * (1 - c) + x * c + (-t * y + w * z) * s, w * d * (1 - c) + y * c + (t * x - u * z) * s, t * d * (1 - c) + z * c + (-w * x + u * y) * s)
random.seed(7)
STARS = [(random.uniform(0, W), random.uniform(0, H), random.random()) for _ in range(140)]
RAYS = [(k * 2 * math.pi / 16 + random.uniform(-0.12, 0.12), random.uniform(0.6, 1.0), random.uniform(1.0, 2.2)) for k in range(16)]
def frame(i, th):
    ray, wire, glow = THEMES[th]; t = i / N
    S = 3; img = Image.new("RGB", (W * S, H * S), (6, 5, 10)); dr = ImageDraw.Draw(img, "RGBA")
    cx, cy = W * S / 2, H * S * 0.47
    for (x, y, b) in STARS:
        tw = 0.5 + 0.5 * math.sin(2 * math.pi * (t * 2 + b * 7))
        a = int(60 + 150 * b * tw); r = S * (0.6 if b < 0.85 else 1.1)
        dr.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=(220, 220, 235, a))
    # raios: 16 com simetria de 22.5°, giram um setor por laço
    rays = Image.new("RGB", img.size, (0, 0, 0)); rd = ImageDraw.Draw(rays)
    for (a0, br, wd) in RAYS:
        a = a0 + t * 2 * math.pi / 16
        R = W * S
        x2, y2 = cx + math.cos(a) * R, cy + math.sin(a) * R
        col = tuple(int(c * br) for c in ray)
        rd.line([(cx, cy), (x2, y2)], fill=col, width=int(S * wd * 1.4))
    rays = rays.filter(ImageFilter.GaussianBlur(S * 1.6))
    img = ImageChops.add(img, rays)
    sharp = Image.new("RGB", img.size, (0, 0, 0)); sd = ImageDraw.Draw(sharp)
    for (a0, br, wd) in RAYS:
        a = a0 + t * 2 * math.pi / 16
        sd.line([(cx, cy), (cx + math.cos(a) * W * S, cy + math.sin(a) * W * S)], fill=tuple(int(c * 0.55 * br) for c in ray), width=max(1, int(S * 0.6)))
    img = ImageChops.add(img, sharp)
    # anel de choque suave (respira)
    ring = Image.new("RGB", img.size, (0, 0, 0)); rg = ImageDraw.Draw(ring)
    rr = H * S * (0.30 + 0.05 * math.sin(2 * math.pi * t))
    rg.ellipse([cx - rr * 1.9, cy - rr * 0.8, cx + rr * 1.9, cy + rr * 0.8], outline=tuple(int(c * 0.5) for c in ray), width=int(S * 2))
    img = ImageChops.add(img, ring.filter(ImageFilter.GaussianBlur(S * 2.5)))
    # icosaedro em wireframe girando (2 cópias desencontradas, como o núcleo do vídeo)
    wf = Image.new("RGB", img.size, (0, 0, 0)); wd_ = ImageDraw.Draw(wf)
    for k, (scale, off) in enumerate(((H * S * 0.30, 0.0), (H * S * 0.34, 0.6))):
        ang = t * 2 * math.pi / 5 * (1 if k == 0 else -1) + off
        P = []
        for v in V:
            v2 = rot(v, ax, ang); v2 = rot(v2, (1, 0, 0), 0.5 + k * 0.4); v2 = rot(v2, (0, 0, 1), 0.3 * k)
            z = v2[2] + 4.0; P.append((cx + v2[0] / z * 4 * scale / 1.9, cy + v2[1] / z * 4 * scale / 1.9, v2[2]))
        for a, b in E:
            depth = (P[a][2] + P[b][2]) / 2; al = 0.45 + 0.25 * (depth / p)
            wd_.line([P[a][:2], P[b][:2]], fill=tuple(int(c * 0.62 * max(0.15, al)) for c in wire), width=max(1, int(S * 0.7)))
    img = ImageChops.add(img, wf.filter(ImageFilter.GaussianBlur(S * 0.4)))
    # núcleo brilhante (pulsa)
    core = Image.new("RGB", img.size, (0, 0, 0)); cd = ImageDraw.Draw(core)
    pr = S * (6 + 2 * math.sin(2 * math.pi * t * 2))
    for k in range(6, 0, -1):
        r = pr * k * 1.6; f = 1.0 / k
        cd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(int(c * f) for c in glow))
    img = ImageChops.add(img, core.filter(ImageFilter.GaussianBlur(S * 3)))
    # vinheta
    vig = Image.new("L", img.size, 0); vd = ImageDraw.Draw(vig)
    for k in range(40):
        f = k / 40; vd.ellipse([-W * S * 0.3 * (1 - f), -H * S * 0.5 * (1 - f), W * S * (1 + 0.3 * (1 - f)), H * S * (1 + 0.5 * (1 - f))], fill=int(255 * f))
    img = Image.composite(img, Image.new("RGB", img.size, (0, 0, 0)), vig.filter(ImageFilter.GaussianBlur(S * 8)))
    return img.resize((W, H), Image.LANCZOS)
for th in THEMES:
    strip = Image.new("RGB", (W, H * N))
    for i in range(N): strip.paste(frame(i, th), (0, i * H))
    strip.save(os.path.join(OUT, f"fx_{th}.png"), optimize=True)
    print(th, os.path.getsize(os.path.join(OUT, f"fx_{th}.png")))
# moldura (nineslice) dos painéis: fundo escuro translúcido + borda dupla com brilho
for th, (ray, wire, glow) in THEMES.items():
    S = 32; im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, S - 1, S - 1], fill=(8, 8, 16, 205))
    d.rectangle([0, 0, S - 1, S - 1], outline=ray + (255,))
    d.rectangle([2, 2, S - 3, S - 3], outline=tuple(int(c * 0.5) for c in ray) + (200,))
    for (x, y) in ((0, 0), (S - 4, 0), (0, S - 4), (S - 4, S - 4)): d.rectangle([x, y, x + 3, y + 3], fill=glow + (255,))
    im.save(os.path.join(OUT, f"frame_{th}.png"))
    open(os.path.join(OUT, f"frame_{th}.json"), "w").write('{ "nineslice_size": 6, "base_size": [ 32, 32 ] }\n')
# faixa do título
for th, (ray, wire, glow) in THEMES.items():
    im = Image.new("RGBA", (128, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for x in range(128):
        a = int(220 * (1 - abs(x - 63.5) / 64) ** 0.6)
        d.line([(x, 2), (x, 13)], fill=tuple(int(c * 0.35) for c in ray) + (a,))
    d.line([(0, 1), (127, 1)], fill=ray + (160,)); d.line([(0, 14), (127, 14)], fill=ray + (160,))
    im.save(os.path.join(OUT, f"band_{th}.png"))

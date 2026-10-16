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

# ------------------------------------------------------------------ 6.36: mais animação (como no vídeo de referência)
# círculo mágico: 6 quadros de 5° (simetria de 30°) trocados em sequência = rotação contínua
S2 = 256; cx2 = cy2 = S2 / 2
def magic_circle(rot):
    L = Image.new("L", (S2 * 2, S2 * 2), 0); d = ImageDraw.Draw(L); c = S2
    for r, wdt in ((246, 4), (232, 2), (170, 3), (156, 2)): d.ellipse([c - r, c - r, c + r, c + r], outline=230, width=wdt)
    a0 = math.radians(rot)
    for k in range(12):   # hexagrama duplo + runas
        a = a0 + k * math.pi / 6
        d.line([(c + math.cos(a) * 232, c + math.sin(a) * 232), (c + math.cos(a + 2 * math.pi / 3) * 232, c + math.sin(a + 2 * math.pi / 3) * 232)], fill=150, width=2)
        x, y = c + math.cos(a + 0.26) * 200, c + math.sin(a + 0.26) * 200
        d.rectangle([x - 7, y - 7, x + 7, y + 7], outline=255, width=2); d.line([(x - 7, y), (x + 7, y)], fill=255, width=2)
        x, y = c + math.cos(a) * 163, c + math.sin(a) * 163; d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=255)
    for k in range(72):   # marcações finas
        a = a0 + k * math.pi / 36; r0 = 236 if k % 3 else 226
        d.line([(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * 246, c + math.sin(a) * 246)], fill=200, width=2)
    L = L.resize((S2, S2), Image.LANCZOS)
    im = Image.new("RGBA", (S2, S2), (255, 255, 255, 0)); im.putalpha(L); return im
for k in range(6): save(magic_circle(k * 5), f"ov_circle_{k}.png")
# linha de varredura (horizontal, some nas pontas)
sc = Image.new("L", (256, 16), 0); sd = ImageDraw.Draw(sc)
for x in range(256):
    f = math.sin(math.pi * x / 255) ** 1.5
    for y in range(16): sc.putpixel((x, y), int(255 * f * math.exp(-((y - 8) / 2.6) ** 2)))
im = Image.new("RGBA", (256, 16), (255, 255, 255, 0)); im.putalpha(sc); save(im, "ov_scan.png")
# partículas (motes) que sobem: duas camadas defasadas
for k in range(2):
    L = Image.new("L", (W, H), 0); d = ImageDraw.Draw(L); rnd = random.Random(40 + k)
    for _ in range(70):
        x, y, r = rnd.uniform(0, W), rnd.uniform(0, H), rnd.choice((1.0, 1.0, 1.5, 2.2))
        d.ellipse([x - r, y - r, x + r, y + r], fill=rnd.randint(150, 255))
    save(white_alpha(L.filter(ImageFilter.GaussianBlur(0.6))), f"ov_motes_{k}.png")
# grade hexagonal fraca
L = Image.new("L", (W, H), 0); d = ImageDraw.Draw(L); R6 = 14
for row in range(-1, int(H / (R6 * 1.5)) + 2):
    for col in range(-1, int(W / (R6 * 1.732)) + 2):
        x = col * R6 * 1.732 + (row % 2) * R6 * 0.866; y = row * R6 * 1.5
        pts = [(x + R6 * math.cos(math.pi / 6 + i * math.pi / 3), y + R6 * math.sin(math.pi / 6 + i * math.pi / 3)) for i in range(6)]
        d.polygon(pts, outline=70)
vig2 = Image.new("L", (W, H), 0); ImageDraw.Draw(vig2).ellipse([W * 0.1, H * 0.05, W * 0.9, H * 0.95], fill=255)
save(white_alpha(ImageChops.multiply(L, vig2.filter(ImageFilter.GaussianBlur(40)))), "ov_hex.png")
# cantos (colchetes) de enquadramento
L = Image.new("L", (W, H), 0); d = ImageDraw.Draw(L); m, ln = 14, 46
for sx, sy in ((0, 0), (1, 0), (0, 1), (1, 1)):
    x0 = m if sx == 0 else W - m; y0 = m if sy == 0 else H - m; dx = 1 if sx == 0 else -1; dy = 1 if sy == 0 else -1
    d.line([(x0, y0), (x0 + dx * ln, y0)], fill=255, width=3); d.line([(x0, y0), (x0, y0 + dy * ln * 0.7)], fill=255, width=3)
    d.line([(x0 + dx * 6, y0 + dy * 6), (x0 + dx * ln * 0.6, y0 + dy * 6)], fill=150, width=1)
save(white_alpha(L), "ov_brackets.png")

# ------------------------------------------------------------------ 6.56: estilo IDÊNTICO ao vídeo do mod Great Sage (Voz do Mundo)
# fundo azul-escuro com estrelas pequenas | ~32 raios finos que giram (tingidos) + raios brancos finos | poliedro de arame branco girando
# estrela central com reflexo horizontal. Rotação contínua = N quadros com troca suave (o JSON UI não gira imagens).
VW, VH = 640, 360; vcx, vcy = VW / 2, VH * 0.5
def wa(L):
    im = Image.new("RGBA", L.size, (255, 255, 255, 0)); im.putalpha(L); return im
rv = random.Random(7)
bgv = Image.new("RGB", (VW, VH), (4, 6, 14)); d = ImageDraw.Draw(bgv)
for _ in range(420):
    x, y = rv.uniform(0, VW), rv.uniform(0, VH); b = rv.random() ** 2.2
    v = int(60 + 150 * b); d.point((x, y), fill=(v, v, min(255, v + 20)))
    if b > 0.8: d.point((x + 1, y), fill=(v // 2, v // 2, v // 2))
save(bgv, "ov_v_bg.png")
NR = 32; RAY = [(rv.uniform(-0.04, 0.04), rv.uniform(0.45, 1.0), rv.choice((1, 1, 2, 2, 3))) for _ in range(4)]   # padrão repete a cada 4 raios
def rays(frame, nfr, white=False):
    L = Image.new("L", (VW * 2, VH * 2), 0); ld = ImageDraw.Draw(L); rot = (frame / nfr) * (2 * math.pi / NR) * 4
    for k in range(NR):
        jit, br, wd = RAY[k % 4]
        if white and k % 4 != 1: continue
        a = k * 2 * math.pi / NR + jit + rot; r0 = 10 if white else 22
        x0, y0 = vcx * 2 + math.cos(a) * r0, vcy * 2 + math.sin(a) * r0 * 0.9
        x1, y1 = vcx * 2 + math.cos(a) * VW * 2.2, vcy * 2 + math.sin(a) * VW * 2.2 * 0.9
        ld.line([(x0, y0), (x1, y1)], fill=int((200 if white else 255) * br), width=(1 if white else wd) * 2)
    L = L.filter(ImageFilter.GaussianBlur(1.2 if white else 2.4)).resize((VW, VH), Image.LANCZOS)
    if not white:   # brilho largo em volta dos raios (o "glow" vermelho do vídeo)
        L = ImageChops.lighter(L, L.filter(ImageFilter.GaussianBlur(6)).point(lambda v: int(v * 0.7)))
    return wa(L)
NFR = 8
for f in range(NFR): save(rays(f, NFR), f"ov_v_rays_{f}.png"); save(rays(f, NFR, True), f"ov_v_rayw_{f}.png")
# poliedro de arame: icosaedro + dodecaedro girando no eixo de um vértice (simetria de 72° -> laço perfeito em 12 quadros)
ico = V; dod = []
for i in range(12):
    for j in range(i + 1, 12):
        for k in range(j + 1, 12):
            if all(abs(sum((a - b) ** 2 for a, b in zip(ico[x], ico[y])) - 4) < 1e-6 for x, y in ((i, j), (j, k), (i, k))):
                dod.append(tuple((ico[i][t] + ico[j][t] + ico[k][t]) / 3 for t in range(3)))
dodE = [(i, j) for i in range(len(dod)) for j in range(i + 1, len(dod)) if abs(math.dist(dod[i], dod[j]) - min(math.dist(dod[0], dod[q]) for q in range(1, len(dod)))) < 1e-3]
ax = [c / math.sqrt(sum(v * v for v in ico[0])) for c in ico[0]]
def rot_axis(p, a):
    x, y, z = p; ux, uy, uz = ax; c, s = math.cos(a), math.sin(a); dot = x * ux + y * uy + z * uz
    return (x * c + (uy * z - uz * y) * s + ux * dot * (1 - c), y * c + (uz * x - ux * z) * s + uy * dot * (1 - c), z * c + (ux * y - uy * x) * s + uz * dot * (1 - c))
def wire(frame, nfr):
    L = Image.new("L", (VW * 2, VH * 2), 0); ld = ImageDraw.Draw(L); a = (frame / nfr) * (2 * math.pi / 5)
    for verts, edges, sc, extra, fill in ((ico, E, VH * 0.40, 0.0, 175), (ico, E, VH * 0.27, 0.6, 70)):
        P = []
        for v in verts:
            x, y, z = rot_axis(v, a + extra)
            y, z = y * math.cos(0.45) - z * math.sin(0.45), y * math.sin(0.45) + z * math.cos(0.45)   # inclinação fixa
            k = sc / 1.9 * 2 / (1 + z * 0.12); P.append((vcx * 2 + x * k, vcy * 2 + y * k))
        for i, j in edges: ld.line([P[i], P[j]], fill=fill, width=2)
    return wa(L.resize((VW, VH), Image.LANCZOS))
NW = 12
for f in range(NW): save(wire(f, NW), f"ov_v_wire_{f}.png")
# estrela central com reflexo horizontal (lens flare)
SW, SH = 512, 128; L = Image.new("L", (SW, SH), 0); d = ImageDraw.Draw(L)
for r in range(40, 0, -1): d.ellipse([SW / 2 - r, SH / 2 - r, SW / 2 + r, SH / 2 + r], fill=int(255 * (1 - r / 40) ** 2.4))
for x in range(SW):
    f = (1 - abs(x - SW / 2) / (SW / 2)) ** 3
    for y in range(-2, 3): L.putpixel((x, int(SH / 2) + y), max(L.getpixel((x, int(SH / 2) + y)), int(255 * f * (1 if y == 0 else 0.35))))
for a in (math.radians(25), math.radians(-25)):   # dois reflexos diagonais curtos
    d.line([(SW / 2 - math.cos(a) * 60, SH / 2 - math.sin(a) * 60), (SW / 2 + math.cos(a) * 60, SH / 2 + math.sin(a) * 60)], fill=110, width=1)
save(wa(L.filter(ImageFilter.GaussianBlur(0.8))), "ov_v_star.png")

# ------------------------------------------------------------------ 6.58: cena de AQUISIÇÃO DE HABILIDADE idêntica ao vídeo de referência (v7)
# mundo visível escurecido, anel de traços dourados radiais em volta da lista, pontos dourados flutuando, moldura de cantos dourada
GOLD = (255, 214, 72)
def gold_alpha(L, col=GOLD):
    im = Image.new("RGBA", L.size, col + (0,)); im.putalpha(L); return im
def s_ring(frame, nfr):
    S = 512; L = Image.new("L", (S, S), 0); d = ImageDraw.Draw(L); rnd = random.Random(70); c = S / 2; R = S * 0.46
    N = 72; off = frame * (2 * math.pi / N) / nfr
    for k in range(N):
        a = k * 2 * math.pi / N + off; ln = rnd.choice((5, 8, 12, 16)); r0 = R + rnd.uniform(-10, 10); br = rnd.randint(120, 255)
        if rnd.random() < 0.18: continue   # falhas no anel, como no vídeo
        if rnd.random() < 0.25:            # pontinho quadrado
            x, y = c + math.cos(a) * r0, c + math.sin(a) * r0; d.rectangle([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=br); continue
        d.line([(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * (r0 + ln), c + math.sin(a) * (r0 + ln))], fill=br, width=3)
    return gold_alpha(L.filter(ImageFilter.GaussianBlur(0.5)))
for f in range(6): save(s_ring(f, 6), f"ov_s_ring_{f}.png")
def s_motes(k):
    L = Image.new("L", (W, H), 0); d = ImageDraw.Draw(L); rnd = random.Random(80 + k)
    for _ in range(26):
        x, y = rnd.uniform(0.18, 0.82) * W, rnd.uniform(0.05, 0.95) * H; s = rnd.choice((1.5, 2, 2.5)); d.rectangle([x - s, y - s, x + s, y + s], fill=rnd.randint(150, 255))
    return gold_alpha(L)
for k in range(3): save(s_motes(k), f"ov_s_motes_{k}.png")
def s_frame():
    Wf, Hf = 256, 224; L = Image.new("L", (Wf, Hf), 0); d = ImageDraw.Draw(L); a = 30; t = 3
    for (x, y, sx, sy) in ((2, 2, 1, 1), (Wf - 3, 2, -1, 1), (2, Hf - 3, 1, -1), (Wf - 3, Hf - 3, -1, -1)):
        d.line([(x, y), (x + sx * a, y)], fill=255, width=t); d.line([(x, y), (x, y + sy * a * 0.45)], fill=255, width=t)
    d.line([(Wf * 0.18, 2), (Wf * 0.82, 2)], fill=150, width=1); d.line([(Wf * 0.18, Hf - 3), (Wf * 0.82, Hf - 3)], fill=150, width=1)
    return gold_alpha(L)
save(s_frame(), "ov_s_frame.png")

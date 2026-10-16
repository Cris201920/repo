# 6.67 - ÍCONES DAS TRANSFORMAÇÕES DRACÔNICAS (pixel art original, 32x32 na moldura hexagonal dourada do addon; item 64x64).
#   skill_dragon_transform / etheria_sk_dragon_transform : cabeça de dragão em chamas (habilidade Transformação Dracônica)
#   lin_<linhagem>            : emblema de cada linhagem (cabeça + símbolo: raio, cristais, chamas, halo)
#   form_<linhagem>_draconic  : Forma Dracônica       form_<linhagem>_true : Dragão Verdadeiro (coroa + anel de energia)
# Uso: python3 tools/dragon_icons.py
import os, math
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); UI = os.path.join(ROOT, "LegacyOfEtheria_RP/textures/ui/etheria"); IT = os.path.join(ROOT, "LegacyOfEtheria_RP/textures/items")
HEAD = [   # cabeça de perfil, virada para a direita (18x16): H chifre, O contorno, M corpo, S sombra, B mandíbula, T dentes, E olho
 "....H.............",
 "....HH......H.....",
 ".....HH....HH.....",
 "......HOOOOHO.....",
 ".....OMMMMMMMOO...",
 "....OMMMMMMMMMMOO.",
 "...OMMMEEMMMMMMMMO",
 "...OMMMMMMMMMMMMMO",
 "..OMMMMMMMSSSSSSSO",
 "..OMMMMMMOTOTOTOO.",
 "..OMMMMMMMBBBBBO..",
 "..OMMMMMMBBBBO....",
 ".OMMMMMMMOOO......",
 ".OMMMMMMO.........",
 "OMMMMMMO..........",
 "OMMMMMO...........",
]
LIN = {
  "veldora":   dict(M=(52, 78, 150), S=(30, 44, 96), B=(150, 190, 235), H=(30, 30, 50), E=(120, 240, 255), G=(120, 230, 255), A=(255, 240, 90)),
  "velzard":   dict(M=(228, 228, 246), S=(170, 170, 210), B=(250, 250, 255), H=(250, 150, 30), E=(230, 70, 60), G=(150, 216, 255), A=(205, 240, 255)),
  "velgrynd":  dict(M=(200, 38, 40), S=(130, 20, 24), B=(240, 228, 206), H=(226, 236, 214), E=(255, 220, 70), G=(255, 160, 40), A=(255, 230, 120)),
  "veldanava": dict(M=(170, 184, 230), S=(110, 120, 175), B=(225, 232, 250), H=(60, 66, 92), E=(255, 205, 60), G=(140, 255, 250), A=(255, 255, 220)),
  "transform": dict(M=(214, 98, 40), S=(150, 50, 24), B=(250, 210, 150), H=(80, 40, 30), E=(255, 240, 120), G=(255, 140, 30), A=(255, 220, 90)),
}
FILL = (22, 16, 32, 255)
def frame():
    base = Image.open(os.path.join(UI, "race_dragonoid.png")).convert("RGBA"); px = base.load(); out = base.copy(); po = out.load()
    for y in range(32):
        for x in range(32):
            r, g, b, a = px[x, y]
            gold = a > 0 and r > 150 and g > 110 and b < 110 and abs(r - g) < 90
            if a > 0 and not gold:
                po[x, y] = FILL
    # o conteúdo antigo (laranja) também some
    for y in range(32):
        for x in range(32):
            r, g, b, a = po[x, y]
            if a > 0 and r > 150 and g < 110: po[x, y] = FILL
    return out
def inside(fr, x, y): r, g, b, a = fr.getpixel((x, y)); return (r, g, b, a) == FILL
def put(img, fr, x, y, c):
    if 0 <= x < 32 and 0 <= y < 32 and inside(fr, x, y): img.putpixel((x, y), tuple(c) + (255,))
def draw_head(img, fr, C, ox, oy):
    for j, row in enumerate(HEAD):
        for i, ch in enumerate(row):
            if ch == ".": continue
            c = {"O": tuple(int(v * 0.35) for v in C["S"]), "T": (245, 245, 245)}.get(ch, C.get(ch, C["M"]))
            put(img, fr, ox + i, oy + j, c)
def motif(img, fr, lin, C):
    G, A = C["G"], C["A"]
    if lin == "veldora":
        for x, y in [(24, 18), (23, 19), (24, 20), (25, 20), (24, 21), (23, 22), (22, 23), (24, 22)]: put(img, fr, x, y, A)
        for x, y in [(21, 21), (26, 18)]: put(img, fr, x, y, G)
    elif lin == "velzard":
        for cx, cy in ((23, 20), (26, 23)):
            for dx, dy in ((0, -2), (0, -1), (0, 0), (0, 1), (-1, 0), (1, 0)): put(img, fr, cx + dx, cy + dy, G if dy else A)
    elif lin in ("velgrynd", "transform"):
        for x, y, c in [(22, 22, G), (23, 21, G), (23, 22, A), (24, 20, G), (24, 21, A), (25, 22, G), (21, 23, G), (24, 23, A), (26, 21, G), (25, 19, A)]: put(img, fr, x, y, c)
    elif lin == "veldanava":
        for t in range(16):
            a = t * math.pi / 8; put(img, fr, 12 + round(math.cos(a) * 5), 6 + round(math.sin(a) * 1.4), G)
        for x, y in [(25, 20), (24, 21), (25, 21), (26, 21), (25, 22)]: put(img, fr, x, y, A)
def icon(lin, true=False, flames=False):
    fr = frame(); img = fr.copy(); C = LIN[lin]
    if true:   # anel de energia atrás da cabeça
        for t in range(48):
            a = t * math.pi / 24; put(img, fr, 15 + round(math.cos(a) * 10), 16 + round(math.sin(a) * 10), C["G"])
    draw_head(img, fr, C, 7, 9)
    motif(img, fr, lin, C)
    if true:   # coroa: pontas extras nos chifres
        for x, y in [(9, 7), (10, 6), (13, 7), (14, 6), (17, 8), (18, 7)]: put(img, fr, x, y, C["A"])
    if flames:
        for x, y in [(6, 24), (7, 23), (6, 22), (5, 25), (8, 24), (27, 12), (26, 11), (27, 10)]: put(img, fr, x, y, C["G"])
    return img
def item64(img32):
    old = Image.open(os.path.join(IT, "etheria_sk_dragon_transform.png")).convert("RGBA")
    big = img32.resize((64, 64), Image.NEAREST); out = old.copy()
    for y in range(4, 60):
        for x in range(4, 60):
            if x >= 52 and y >= 52: continue   # marca do canto do item
            out.putpixel((x, y), big.getpixel((x, y)))
    return out
if __name__ == "__main__":
    t = icon("transform", flames=True); t.save(os.path.join(UI, "skill_dragon_transform.png")); item64(t).save(os.path.join(IT, "etheria_sk_dragon_transform.png"))
    for l in ("veldora", "velzard", "velgrynd", "veldanava"):
        icon(l).save(os.path.join(UI, f"lin_{l}.png")); icon(l).save(os.path.join(UI, f"form_{l}_draconic.png")); icon(l, True).save(os.path.join(UI, f"form_{l}_true.png"))
    print("ok")

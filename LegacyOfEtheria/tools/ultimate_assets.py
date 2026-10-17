# 6.81 - ícones e itens das 12 Skills Ultimate (data/ultimates.js): BP/items/sk_<id>.json, RP textures/items/etheria_sk_<id>.png (64),
# textures/ui/etheria/skill_<id>.png (32), item_texture.json e nomes nos .lang. Ícones desenhados aqui (emblema por Ultimate sobre medalhão do elemento).
import json, os, re, math
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
src = open(os.path.join(BP, "scripts/data/ultimates.js")).read()
ULT = re.findall(r'[UG]\("((?:ult|gs)_\w+)", \{ name: "([^"]+)", element: "(\w+)"', src)
ULT = ULT + [("stomach", "Estômago do Predador", "shadow")]
PAL = {"void": ((20, 6, 40), (150, 80, 255)), "arcane": ((30, 18, 60), (170, 130, 255)), "holy": ((60, 48, 10), (255, 230, 140)), "lightning": ((16, 26, 56), (255, 240, 120)),
       "fire": ((60, 12, 4), (255, 140, 40)), "shadow": ((14, 6, 24), (170, 70, 220)), "light": ((60, 56, 30), (255, 250, 210)), "ice": ((10, 30, 60), (170, 230, 255))}
FRAME = {"void": (150, 90, 255), "arcane": (175, 120, 255), "holy": (255, 205, 90), "lightning": (110, 210, 255), "fire": (255, 110, 70), "shadow": (200, 80, 230), "light": (255, 225, 120), "ice": (140, 220, 255)}
S = 256
import random
from PIL import ImageChops
def glow(base, layer, rad, strength=1.0):
    g = layer.filter(ImageFilter.GaussianBlur(rad))
    if strength != 1: g = Image.eval(g, lambda v: min(255, int(v * strength)))
    base.alpha_composite(g); base.alpha_composite(layer)
def radial(d, cx, cy, r, inner, outer, steps=60):
    for i in range(steps, 0, -1):
        t = i / steps; c = tuple(int(inner[k] * (1 - t) + outer[k] * t) for k in range(len(inner)))
        rr = r * t; d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=c)
def background(el):
    a, b = PAL[el]; im = Image.new("RGBA", (S, S), (0, 0, 0, 255)); d = ImageDraw.Draw(im)
    radial(d, 128, 120, 190, tuple(min(255, int(x * 0.55 + 10)) for x in b) + (255,), a + (255,))
    rnd = random.Random(hash(el) & 0xffff)
    fog = Image.new("RGBA", (S, S), (0, 0, 0, 0)); fd = ImageDraw.Draw(fog)
    for _ in range(26):                                      # névoa suave (manchas grandes desfocadas)
        x, y, r = rnd.randint(0, S), rnd.randint(0, S), rnd.randint(30, 70)
        fd.ellipse([x - r, y - r, x + r, y + r], fill=(0, 0, 0, rnd.randint(18, 40)) if rnd.random() < 0.6 else b + (rnd.randint(10, 22),))
    im.alpha_composite(fog.filter(ImageFilter.GaussianBlur(22)))
    vig = Image.new("L", (S, S), 0); ImageDraw.Draw(vig).ellipse([-40, -40, S + 40, S + 40], fill=255)
    dark = Image.new("RGBA", (S, S), (0, 0, 0, 150)); dark.putalpha(ImageChops.invert(vig.filter(ImageFilter.GaussianBlur(30))).point(lambda v: int(v * 0.6)))
    im.alpha_composite(dark)
    for _ in range(40):
        x, y = rnd.randint(16, S - 16), rnd.randint(16, S - 16); d.point((x, y), fill=b + (rnd.randint(80, 200),))
    return im
def star(d, cx, cy, r1, r2, n, col, rot=0):
    pts = []
    for i in range(n * 2):
        r = r1 if i % 2 == 0 else r2; ang = rot + i * math.pi / n
        pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
    d.polygon(pts, fill=col)
def L(): return Image.new("RGBA", (S, S), (0, 0, 0, 0))
W, G, K = (255, 255, 255, 255), (255, 214, 96, 255), (8, 4, 14, 255)
def art(uid, el):
    a, b = PAL[el]; B = b + (255,); bg = background(el)
    l = L(); d = ImageDraw.Draw(l)
    if uid == "ult_azathoth":                                # buraco negro com disco de acreção
        for i in range(10):
            t = i / 10; c = (int(255 * (1 - t) + 120 * t), int(200 * (1 - t) + 40 * t), 255, 255)
            d.ellipse([28 + i * 3, 96 + i * 2, 228 - i * 3, 160 - i * 2], outline=c, width=3)
        glow(bg, l, 10, 1.4); l = L(); d = ImageDraw.Draw(l)
        radial(d, 128, 128, 52, (0, 0, 0, 255), (40, 10, 80, 255)); d.ellipse([84, 84, 172, 172], outline=(220, 180, 255, 255), width=3)
        d.arc([28, 96, 228, 160], 200, 340, fill=(255, 230, 255, 255), width=6)
        for k in range(14): x, y = random.Random(k).randint(20, 236), random.Random(k + 50).randint(20, 236); star(d, x, y, 5, 1.5, 4, W)
    elif uid == "ult_shub_niggurath":                        # árvore da criação com três frutos-círculo
        d.rectangle([118, 140, 138, 230], fill=(90, 60, 30, 255)); 
        for k, (x, y) in enumerate(((128, 70), (70, 120), (186, 120))):
            radial(d, x, y, 36, (255, 250, 200, 255), [(120, 255, 140, 255), (255, 200, 80, 255), (170, 130, 255, 255)][k])
            d.ellipse([x - 36, y - 36, x + 36, y + 36], outline=W, width=3); star(d, x, y, 18, 6, 4, W)
            d.line([(128, 150), (x, y + 30)], fill=(110, 80, 40, 255), width=10)
        glow(bg, l, 9, 1.2); l = L(); d = ImageDraw.Draw(l)
        for x in range(60, 200, 20): d.line([(x, 238), (128, 200)], fill=(70, 160, 70, 255), width=4)
    elif uid == "ult_uriel":                                 # escudo-cúpula hexagonal
        d.pieslice([30, 50, 226, 246], 180, 360, fill=(120, 190, 255, 140)); d.arc([30, 50, 226, 246], 180, 360, fill=W, width=6)
        for r in range(3):
            for k in range(-3, 4):
                cx, cy = 128 + k * 26 + (r % 2) * 13, 80 + r * 22
                if (cx - 128) ** 2 + (cy - 148) ** 2 < 92 ** 2: d.regular_polygon((cx, cy, 12), 6, outline=(255, 245, 200, 255), width=2)
        d.rectangle([24, 146, 232, 154], fill=G)
        glow(bg, l, 8, 1.3); l = L(); d = ImageDraw.Draw(l); star(d, 128, 60, 22, 7, 4, W)
    elif uid == "ult_raphael":                               # olho da sabedoria com íris dourada e runas
        d.ellipse([28, 82, 228, 174], fill=(235, 250, 255, 255)); radial(d, 128, 128, 44, (255, 240, 160, 255), (60, 170, 220, 255)); d.ellipse([110, 110, 146, 146], fill=K)
        d.ellipse([118, 112, 130, 124], fill=W)
        glow(bg, l, 9, 1.2); l = L(); d = ImageDraw.Draw(l)
        d.arc([22, 70, 234, 186], 200, 340, fill=G, width=5); d.arc([22, 70, 234, 186], 20, 160, fill=G, width=5)
        for k in range(8): ang = k * math.pi / 4; x, y = 128 + math.cos(ang) * 104, 128 + math.sin(ang) * 104; d.regular_polygon((x, y, 8), 4, rotation=45, fill=(140, 255, 230, 255))
    elif uid == "ult_faust":                                 # nuvem de tempestade, raio dracônico e chifres de dragão
        for x, y, r in ((80, 70, 40), (128, 56, 48), (178, 72, 40), (104, 86, 36), (156, 88, 36)): d.ellipse([x - r, y - r, x + r, y + r], fill=(70, 80, 120, 255))
        d.polygon([(48, 70), (24, 20), (70, 58)], fill=(200, 220, 255, 255)); d.polygon([(208, 70), (232, 20), (186, 58)], fill=(200, 220, 255, 255))
        glow(bg, l, 6, 1.0); l = L(); d = ImageDraw.Draw(l)
        d.polygon([(138, 80), (92, 160), (126, 160), (100, 244), (178, 138), (142, 138), (168, 80)], fill=(255, 248, 170, 255))
        d.line([(92, 160), (60, 200)], fill=(180, 240, 255, 255), width=5); d.line([(178, 138), (214, 172)], fill=(180, 240, 255, 255), width=5)
        glow(bg, l, 12, 1.6); l = L(); d = ImageDraw.Draw(l)
    elif uid == "ult_satanael":                              # esfera de destruição com chifres e chamas
        for k in range(11): ang = -math.pi / 2 + (k - 5) * 0.28; d.polygon([(128 + math.cos(ang) * 56, 140 + math.sin(ang) * 56), (128 + math.cos(ang) * (110 + (k % 2) * 14), 140 + math.sin(ang) * (110 + (k % 2) * 14)), (128 + math.cos(ang + 0.14) * 58, 140 + math.sin(ang + 0.14) * 58)], fill=(255, 80, 30, 255))
        glow(bg, l, 10, 1.3); l = L(); d = ImageDraw.Draw(l)
        radial(d, 128, 140, 60, (255, 250, 200, 255), (200, 20, 10, 255))
        d.polygon([(84, 100), (60, 40), (100, 90)], fill=(30, 10, 10, 255)); d.polygon([(172, 100), (196, 40), (156, 90)], fill=(30, 10, 10, 255))
        glow(bg, l, 6, 1.0); l = L(); d = ImageDraw.Draw(l)
    elif uid == "ult_lucifer":                               # asas negras + estrela da manhã
        for sg in (-1, 1):
            for k in range(5): d.polygon([(128, 140), (128 + sg * (36 + k * 20), 60 + k * 20), (128 + sg * (24 + k * 18), 104 + k * 22)], fill=(70, 30, 100, 255), outline=(220, 150, 255, 255))
        glow(bg, l, 6, 1.0); l = L(); d = ImageDraw.Draw(l)
        star(d, 128, 124, 62, 16, 4, (255, 240, 255, 255)); star(d, 128, 124, 34, 10, 4, (210, 130, 255, 255), math.pi / 4)
        glow(bg, l, 12, 1.6); l = L(); d = ImageDraw.Draw(l)
    elif uid == "ult_metatron":                              # lanças de luz caindo com asas
        for sg in (-1, 1):
            for k in range(4): d.ellipse([128 + sg * (40 + k * 18) - 22, 70 + k * 12, 128 + sg * (40 + k * 18) + 22, 92 + k * 12], fill=(255, 250, 220, 200))
        glow(bg, l, 6, 1.0); l = L(); d = ImageDraw.Draw(l)
        for k, x in enumerate(range(68, 200, 22)):
            y0 = 30 + (k % 3) * 18; d.polygon([(x, 236), (x - 6, y0 + 40), (x, y0), (x + 6, y0 + 40)], fill=[W, G][k % 2])
        glow(bg, l, 10, 1.5); l = L(); d = ImageDraw.Draw(l)
    elif uid == "ult_cthugha":                               # espírito de chamas
        d.polygon([(128, 18), (160, 70), (200, 60), (190, 120), (214, 160), (170, 230), (86, 230), (42, 160), (66, 120), (56, 60), (96, 70)], fill=(255, 90, 20, 255))
        glow(bg, l, 12, 1.4); l = L(); d = ImageDraw.Draw(l)
        d.polygon([(128, 70), (160, 130), (150, 200), (106, 200), (96, 130)], fill=(255, 210, 80, 255)); d.polygon([(128, 120), (142, 170), (114, 170)], fill=W)
        d.ellipse([104, 140, 120, 156], fill=K); d.ellipse([136, 140, 152, 156], fill=K)
        glow(bg, l, 6, 1.0); l = L(); d = ImageDraw.Draw(l)
    elif uid == "ult_michael":                               # espada da justiça com correntes
        d.polygon([(120, 30), (128, 12), (136, 30), (136, 178), (120, 178)], fill=(235, 240, 255, 255)); d.line([(128, 30), (128, 176)], fill=(170, 190, 230, 255), width=3)
        d.rectangle([80, 176, 176, 190], fill=G); d.rectangle([122, 190, 134, 230], fill=(150, 100, 40, 255)); d.ellipse([116, 226, 140, 246], fill=G)
        glow(bg, l, 10, 1.4); l = L(); d = ImageDraw.Draw(l)
        for sg in (-1, 1):
            for k in range(6): x, y = 128 + sg * (26 + k * 16), 120 + k * 16; d.ellipse([x - 11, y - 8, x + 11, y + 8], outline=(255, 225, 130, 255), width=6)
    elif uid == "ult_hastur":                                # coroa da dominação com tentáculos de energia
        for k in range(5): d.arc([20 + k * 10, 120 + k * 4, 236 - k * 10, 240 - k * 4], 15 + k * 6, 165 - k * 6, fill=(170, 120, 255, 255), width=5)
        glow(bg, l, 8, 1.3); l = L(); d = ImageDraw.Draw(l)
        d.polygon([(56, 150), (56, 70), (92, 110), (128, 46), (164, 110), (200, 70), (200, 150)], fill=G, outline=(120, 70, 20, 255))
        d.rectangle([56, 140, 200, 160], fill=(230, 180, 70, 255))
        for x in (92, 128, 164): d.ellipse([x - 9, 141, x + 9, 159], fill=(150, 80, 255, 255))
        glow(bg, l, 5, 0.9); l = L(); d = ImageDraw.Draw(l)
    elif uid == "gs_meteor":
        for k in range(10): d.line([(40 + k * 4, 30 + k * 2), (150 + k * 2, 150)], fill=(255, 140 + k * 8, 40, 120), width=10)
        glow(bg, l, 10, 1.3); l = L(); d = ImageDraw.Draw(l)
        radial(d, 160, 160, 54, (255, 240, 180, 255), (200, 60, 10, 255)); d.polygon([(130, 140), (150, 130), (146, 152)], fill=(90, 40, 20, 255)); d.polygon([(170, 176), (190, 170), (182, 190)], fill=(90, 40, 20, 255))
    elif uid == "gs_dragon_storm":
        for x, y, r in ((70, 60, 40), (128, 46, 48), (186, 62, 40)): d.ellipse([x - r, y - r, x + r, y + r], fill=(60, 66, 100, 255))
        glow(bg, l, 4, 0.8); l = L(); d = ImageDraw.Draw(l)
        for x0 in (70, 128, 186): d.line([(x0, 90), (x0 - 18, 150), (x0 + 6, 160), (x0 - 12, 236)], fill=(255, 245, 150, 255), width=9)
        glow(bg, l, 12, 1.6); l = L(); d = ImageDraw.Draw(l)
    elif uid == "gs_void_explosion":
        d.ellipse([40, 40, 216, 216], outline=(170, 100, 255, 255), width=10); d.ellipse([70, 70, 186, 186], outline=(230, 200, 255, 255), width=5)
        for k in range(12): ang = k * math.pi / 6; d.line([(128 + math.cos(ang) * 30, 128 + math.sin(ang) * 30), (128 + math.cos(ang) * 120, 128 + math.sin(ang) * 120)], fill=(200, 140, 255, 200), width=4)
        glow(bg, l, 10, 1.4); l = L(); d = ImageDraw.Draw(l); radial(d, 128, 128, 34, (255, 255, 255, 255), (120, 40, 220, 255))
    elif uid == "gs_celestial_lance":
        d.ellipse([60, 196, 196, 226], outline=G, width=6)
        for x in (78, 128, 178): d.polygon([(x, 210), (x - 10, 70), (x, 26), (x + 10, 70)], fill=W)
        glow(bg, l, 10, 1.4); l = L(); d = ImageDraw.Draw(l)
    elif uid == "gs_glacial_prison":
        for k, x in enumerate(range(50, 220, 28)): h = 150 - abs(x - 135) * 0.9; d.polygon([(x - 14, 220), (x, 220 - h), (x + 14, 220)], fill=[(180, 235, 255, 255), (120, 200, 255, 255)][k % 2], outline=W)
        glow(bg, l, 8, 1.2); l = L(); d = ImageDraw.Draw(l); d.ellipse([110, 150, 146, 186], fill=(40, 60, 90, 255))
    elif uid == "gs_demonic_inferno":
        d.rectangle([20, 200, 236, 236], fill=(200, 40, 20, 255))
        for x in (60, 128, 196): d.polygon([(x - 22, 210), (x - 10, 110), (x, 40 + (x % 3) * 10), (x + 12, 110), (x + 22, 210)], fill=(255, 110, 20, 255))
        glow(bg, l, 12, 1.4); l = L(); d = ImageDraw.Draw(l)
        for x in (60, 128, 196): d.polygon([(x - 8, 210), (x, 120), (x + 8, 210)], fill=(255, 230, 120, 255))
    elif uid == "gs_absolute_destruction":
        for k in range(16): ang = k * math.pi / 8; d.line([(128, 128), (128 + math.cos(ang) * 124, 128 + math.sin(ang) * 124)], fill=(255, 60, 60, 160), width=6)
        glow(bg, l, 12, 1.5); l = L(); d = ImageDraw.Draw(l)
        radial(d, 128, 128, 60, (255, 230, 220, 255), (160, 0, 20, 255))
        for k in range(5): ang = k * 1.3; d.line([(128, 128), (128 + math.cos(ang) * 58, 128 + math.sin(ang) * 58)], fill=K, width=4)
    elif uid == "stomach":                                   # bocarra do Predador com o redemoinho do estômago
        for k in range(7): d.arc([40 + k * 10, 40 + k * 10, 216 - k * 10, 216 - k * 10], k * 50, k * 50 + 200, fill=(150 + k * 12, 70, 230, 255), width=7)
        glow(bg, l, 9, 1.3); l = L(); d = ImageDraw.Draw(l)
        radial(d, 128, 128, 40, (10, 0, 20, 255), (90, 20, 140, 255))
        for k in range(10): ang = k * math.pi / 5; x, y = 128 + math.cos(ang) * 64, 128 + math.sin(ang) * 64; d.polygon([(x, y), (128 + math.cos(ang + 0.15) * 44, 128 + math.sin(ang + 0.15) * 44), (128 + math.cos(ang - 0.15) * 44, 128 + math.sin(ang - 0.15) * 44)], fill=(240, 235, 255, 255))
        for x in (104, 152): d.ellipse([x - 9, 92, x + 9, 110], fill=(255, 230, 90, 255))
    glow(bg, l, 4, 0.8)
    return bg
# moldura pela RARIDADE, no mesmo padrão dos ícones de habilidade do addon (anel claro externo + anel escuro + gema no canto)
RAR_FRAME = {"divine": ((175, 243, 249), (57, 139, 146)), "mythic": ((250, 166, 160), (147, 46, 39)), "legendary": ((255, 226, 140), (146, 111, 33))}
def pixelize(im, el, n=32, rar="divine"):
    sm = im.resize((n, n), Image.LANCZOS).convert("RGB").quantize(colors=28, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGBA")
    px = sm.load(); fr, dark = RAR_FRAME[rar]
    for i in range(n):                                       # moldura: borda colorida, linha escura interna, cantos
        for (x, y) in ((i, 0), (i, n - 1), (0, i), (n - 1, i)): px[x, y] = fr + (255,)
        for (x, y) in ((i, 1), (i, n - 2), (1, i), (n - 2, i)):
            if 1 <= x <= n - 2 and 1 <= y <= n - 2: px[x, y] = dark + (255,)
    for (x, y) in ((0, 0), (n - 1, 0), (0, n - 1), (n - 1, n - 1)): px[x, y] = (0, 0, 0, 0)
    for (x, y) in ((n - 4, n - 3), (n - 3, n - 4), (n - 3, n - 3), (n - 2, n - 3), (n - 3, n - 2)): px[x, y] = fr + (255,)   # gema do canto
    return sm
for uid, name, el in ULT:
    big = art(uid, el); px = pixelize(big, el, 32, "divine" if uid.startswith("ult_") else "mythic")
    short = uid
    px.resize((64, 64), Image.NEAREST).save(os.path.join(RP, f"textures/items/etheria_sk_{short}.png"))
    px.save(os.path.join(RP, f"textures/ui/etheria/skill_{short}.png"))
    item = {"format_version": "1.21.60", "minecraft:item": {"description": {"identifier": f"etheria:sk_{short}", "menu_category": {"category": "none"}},
        "components": {"minecraft:icon": {"textures": {"default": f"etheria_sk_{short}"}}, "minecraft:display_name": {"value": f"§6{name}"},
                       "minecraft:max_stack_size": 1, "minecraft:cooldown": {"category": f"etheria_cd_{short}", "duration": 0.05}, "minecraft:glint": True}}}
    json.dump(item, open(os.path.join(BP, f"items/sk_{short}.json"), "w"), indent=1)
it = os.path.join(RP, "textures/item_texture.json"); J = json.load(open(it))
for uid, _, _ in ULT: J["texture_data"][f"etheria_sk_{uid}"] = {"textures": f"textures/items/etheria_sk_{uid}"}
json.dump(J, open(it, "w"), indent=1)
for lang in ("pt_BR", "en_US"):
    p = os.path.join(RP, f"texts/{lang}.lang"); L = open(p, encoding="utf-8").read().splitlines()
    L = [l for l in L if not re.match(r"item\.etheria:sk_ult_", l)]
    L += [f"item.etheria:sk_{uid}={name}" for uid, name, _ in ULT]
    open(p, "w", encoding="utf-8").write("\n".join(L) + "\n")
# prévia
sheet = Image.new("RGBA", (6 * 140, 4 * 160), (34, 36, 48, 255)); dd = ImageDraw.Draw(sheet)
for i, (uid, name, el) in enumerate(ULT):
    ic = Image.open(os.path.join(RP, f"textures/items/etheria_sk_{uid}.png")).resize((128, 128), Image.NEAREST)
    x, y = (i % 6) * 140 + 6, (i // 6) * 160 + 6; sheet.alpha_composite(ic, (x, y)); dd.text((x, y + 132), name.split(",")[0], fill=(230, 230, 230))
os.makedirs("/home/user/repo/previews", exist_ok=True); sheet.save("/home/user/repo/previews/ultimates_icones.png")
print(len(ULT), "ultimates")

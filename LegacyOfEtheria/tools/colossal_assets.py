# 8.6 - ícones e itens das MAGIAS COLOSSAIS (BP/scripts/data/colossal.js): BP/items/sk_<id>.json, RP textures/items/etheria_sk_<id>.png (64),
# textures/ui/etheria/skill_<id>.png (32), item_texture.json e nomes nos .lang. Arte desenhada aqui (sem arquivos de mods). Idempotente.
import json, os, re, math, random
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
src = open(os.path.join(BP, "scripts/data/colossal.js"), encoding="utf-8").read()
SK = re.findall(r'C\("(cs_\w+)", \{ name: "([^"]+)", element: "(\w+)", rarity: "(\w+)"', src)
S = 256
BG = {"arcane": ((24, 12, 52), (170, 120, 255)), "light": ((60, 52, 20), (255, 245, 200)), "fire": ((60, 14, 4), (255, 150, 50)), "lightning": ((14, 16, 40), (255, 240, 130)),
      "earth": ((40, 26, 12), (220, 170, 100)), "gold": ((54, 38, 6), (255, 215, 90))}
FRAME = {"legendary": ((255, 226, 140), (146, 111, 33)), "epic": ((214, 150, 255), (98, 40, 140))}
W, G, K = (255, 255, 255, 255), (255, 214, 96, 255), (8, 4, 14, 255)
def L(): return Image.new("RGBA", (S, S), (0, 0, 0, 0))
def glow(base, layer, rad, k=1.0):
    g = layer.filter(ImageFilter.GaussianBlur(rad))
    if k != 1: g = Image.eval(g, lambda v: min(255, int(v * k)))
    base.alpha_composite(g); base.alpha_composite(layer)
def radial(d, cx, cy, r, inner, outer, steps=50):
    for i in range(steps, 0, -1):
        t = i / steps; c = tuple(int(inner[k] * (1 - t) + outer[k] * t) for k in range(4)); rr = r * t
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=c)
def background(el):
    a, b = BG[el]; im = Image.new("RGBA", (S, S), a + (255,)); d = ImageDraw.Draw(im)
    radial(d, 128, 128, 180, tuple(min(255, int(x * 0.5 + 12)) for x in b) + (255,), a + (255,))
    return im
def ring_runes(d, cx, cy, r, n, col, w=5):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=w)
    for k in range(n):
        a = k * 2 * math.pi / n; x, y = cx + math.cos(a) * (r - 14), cy + math.sin(a) * (r - 14)
        d.line([(x - 5, y - 6), (x + 5, y + 6)], fill=col, width=4); d.line([(x + 5, y - 6), (x, y)], fill=col, width=4)
def art(uid, el):
    bg = background(el); l = L(); d = ImageDraw.Draw(l)
    if uid == "cs_runic_seal":                                    # círculo de runas em perspectiva + pilares
        for k, r in enumerate((112, 84, 54)): ring_runes(d, 128, 128, r, 10 - k * 2, (190, 140, 255, 255) if k % 2 == 0 else (240, 220, 255, 255))
        for k in range(5):
            a = -math.pi / 2 + k * 2 * math.pi / 5; b = a + 2 * 2 * math.pi / 5
            d.line([(128 + math.cos(a) * 84, 128 + math.sin(a) * 84), (128 + math.cos(b) * 84, 128 + math.sin(b) * 84)], fill=(220, 190, 255, 255), width=4)
        glow(bg, l, 9, 1.4); l = L(); d = ImageDraw.Draw(l); radial(d, 128, 128, 24, W, (170, 120, 255, 255))
    elif uid == "cs_heaven_pillar":                               # selo no céu + coluna de luz até o chão
        d.ellipse([40, 18, 216, 58], outline=G, width=6); d.ellipse([70, 26, 186, 50], outline=W, width=3)
        d.polygon([(104, 40), (152, 40), (170, 236), (86, 236)], fill=(255, 245, 200, 200))
        glow(bg, l, 12, 1.5); l = L(); d = ImageDraw.Draw(l)
        d.rectangle([118, 40, 138, 236], fill=W); d.ellipse([50, 214, 206, 246], outline=G, width=5)
    elif uid == "cs_ringed_sun":                                  # sol com três anéis inclinados
        radial(d, 128, 128, 66, (255, 250, 210, 255), (230, 90, 20, 255))
        glow(bg, l, 14, 1.4); l = L(); d = ImageDraw.Draw(l)
        for k, (w, h, c) in enumerate(((226, 70, G), (200, 120, (255, 140, 60, 255)), (160, 200, (255, 240, 170, 255)))):
            ring = Image.new("RGBA", (S, S), (0, 0, 0, 0)); ImageDraw.Draw(ring).ellipse([128 - w / 2, 128 - h / 2, 128 + w / 2, 128 + h / 2], outline=c, width=6)
            l.alpha_composite(ring.rotate([-18, 30, 70][k], center=(128, 128)))
    elif uid == "cs_tempest_judgement":                           # nuvens negras e três raios
        for x, y, r in ((60, 50, 40), (118, 38, 50), (184, 52, 42), (150, 70, 36), (90, 72, 34)): d.ellipse([x - r, y - r, x + r, y + r], fill=(46, 40, 70, 255))
        glow(bg, l, 4, 0.8); l = L(); d = ImageDraw.Draw(l)
        for x0, k in ((70, 0), (128, 1), (186, 2)): d.line([(x0, 92), (x0 - 16, 140), (x0 + 8, 152), (x0 - 10, 236 - k * 10)], fill=(255, 245, 160, 255), width=9 if k == 1 else 6)
        glow(bg, l, 12, 1.6); l = L(); d = ImageDraw.Draw(l)
        for x0 in (70, 128, 186): d.line([(x0, 92), (x0 - 16, 140), (x0 + 8, 152)], fill=W, width=3)
    elif uid == "cs_cataclysm_wave":                              # cratera e onda de choque
        for k, r in enumerate((118, 96, 74)): d.ellipse([128 - r, 170 - r * 0.38, 128 + r, 170 + r * 0.38], outline=(230, 190, 120, 255 - k * 50), width=7 - k)
        glow(bg, l, 8, 1.3); l = L(); d = ImageDraw.Draw(l)
        d.ellipse([84, 154, 172, 186], fill=(30, 18, 10, 255))
        rnd = random.Random(7)
        for _ in range(12):
            x, y = 128 + rnd.randint(-70, 70), 150 - rnd.randint(10, 110); s = rnd.randint(6, 13); d.polygon([(x, y - s), (x + s, y), (x, y + s), (x - s, y + 2)], fill=(150, 110, 70, 255))
        for k in range(7):
            a = math.pi + k * math.pi / 6; d.line([(128, 170), (128 + math.cos(a) * 60, 170 + math.sin(a) * 34)], fill=(255, 220, 160, 255), width=3)
    elif uid == "cs_coin_circle":                                 # anel de moedas ao redor de um núcleo dourado
        for k in range(12):
            a = k * 2 * math.pi / 12; x, y = 128 + math.cos(a) * 92, 128 + math.sin(a) * 92
            d.ellipse([x - 17, y - 17, x + 17, y + 17], fill=G, outline=(150, 100, 20, 255), width=4); d.rectangle([x - 3, y - 9, x + 3, y + 9], fill=(170, 120, 30, 255))
        glow(bg, l, 9, 1.3); l = L(); d = ImageDraw.Draw(l)
        radial(d, 128, 128, 40, W, (255, 200, 60, 255)); d.ellipse([60, 60, 196, 196], outline=(255, 240, 180, 255), width=3)
    glow(bg, l, 4, 0.8)
    return bg
def pixelize(im, rar, n=32):
    sm = im.resize((n, n), Image.LANCZOS).convert("RGB").quantize(colors=28, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGBA")
    px = sm.load(); fr, dark = FRAME[rar]
    for i in range(n):
        for (x, y) in ((i, 0), (i, n - 1), (0, i), (n - 1, i)): px[x, y] = fr + (255,)
        for (x, y) in ((i, 1), (i, n - 2), (1, i), (n - 2, i)):
            if 1 <= x <= n - 2 and 1 <= y <= n - 2: px[x, y] = dark + (255,)
    for (x, y) in ((0, 0), (n - 1, 0), (0, n - 1), (n - 1, n - 1)): px[x, y] = (0, 0, 0, 0)
    for (x, y) in ((n - 4, n - 3), (n - 3, n - 4), (n - 3, n - 3), (n - 2, n - 3), (n - 3, n - 2)): px[x, y] = fr + (255,)
    return sm
for uid, name, el, rar in SK:
    px = pixelize(art(uid, el), rar)
    px.resize((64, 64), Image.NEAREST).save(os.path.join(RP, f"textures/items/etheria_sk_{uid}.png"))
    px.save(os.path.join(RP, f"textures/ui/etheria/skill_{uid}.png"))
    item = {"format_version": "1.21.60", "minecraft:item": {"description": {"identifier": f"etheria:sk_{uid}", "menu_category": {"category": "none"}},
        "components": {"minecraft:icon": {"textures": {"default": f"etheria_sk_{uid}"}}, "minecraft:display_name": {"value": f"§6{name}"},
                       "minecraft:max_stack_size": 1, "minecraft:cooldown": {"category": f"etheria_cd_{uid}", "duration": 0.05}, "minecraft:glint": True}}}
    json.dump(item, open(os.path.join(BP, f"items/sk_{uid}.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
it = os.path.join(RP, "textures/item_texture.json"); J = json.load(open(it))
for uid, _, _, _ in SK: J["texture_data"][f"etheria_sk_{uid}"] = {"textures": f"textures/items/etheria_sk_{uid}"}
json.dump(J, open(it, "w"), indent=1)
for lang in ("pt_BR", "en_US"):
    p = os.path.join(RP, f"texts/{lang}.lang"); Ls = open(p, encoding="utf-8").read().splitlines()
    Ls = [x for x in Ls if not x.startswith("item.etheria:sk_cs_")] + [f"item.etheria:sk_{uid}={name}" for uid, name, _, _ in SK]
    open(p, "w", encoding="utf-8").write("\n".join(Ls) + "\n")
if __name__ == "__main__":
    sheet = Image.new("RGBA", (len(SK) * 140, 160), (34, 36, 48, 255)); dd = ImageDraw.Draw(sheet)
    for i, (uid, name, el, rar) in enumerate(SK):
        sheet.paste(Image.open(os.path.join(RP, f"textures/items/etheria_sk_{uid}.png")).resize((128, 128), Image.NEAREST), (i * 140 + 6, 6)); dd.text((i * 140 + 6, 140), name[:22], fill=(240, 240, 240))
    out = os.environ.get("PREVIEW")
    if out: sheet.save(out)
    print(len(SK), "magias colossais:", ", ".join(u for u, *_ in SK))

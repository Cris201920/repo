# 6.81 - ícones e itens das 12 Skills Ultimate (data/ultimates.js): BP/items/sk_<id>.json, RP textures/items/etheria_sk_<id>.png (64),
# textures/ui/etheria/skill_<id>.png (32), item_texture.json e nomes nos .lang. Ícones desenhados aqui (emblema por Ultimate sobre medalhão do elemento).
import json, os, re, math
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
src = open(os.path.join(BP, "scripts/data/ultimates.js")).read()
ULT = re.findall(r'U\("(ult_\w+)", \{ name: "([^"]+)", element: "(\w+)"', src)
PAL = {"void": ((20, 6, 40), (150, 80, 255)), "arcane": ((30, 18, 60), (170, 130, 255)), "holy": ((60, 48, 10), (255, 230, 140)), "lightning": ((20, 30, 60), (255, 240, 120)),
       "fire": ((60, 12, 4), (255, 140, 40)), "shadow": ((14, 6, 24), (170, 70, 220)), "light": ((60, 56, 30), (255, 250, 210))}
S = 256
def medal(el):
    a, b = PAL[el]; im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for r in range(120, 0, -2):
        t = r / 120; c = tuple(int(b[i] * (1 - t) * 0.9 + a[i] * t) for i in range(3))
        d.ellipse([128 - r, 128 - r, 128 + r, 128 + r], fill=c + (255,))
    d.ellipse([10, 10, 246, 246], outline=(255, 215, 110, 255), width=10); d.ellipse([24, 24, 232, 232], outline=b + (200,), width=4)
    for k in range(8):
        ang = k * math.pi / 4; x, y = 128 + math.cos(ang) * 116, 128 + math.sin(ang) * 116
        d.regular_polygon((x, y, 9), 4, rotation=45, fill=(255, 225, 130, 255))
    return im, d
def star(d, cx, cy, r1, r2, n, col, rot=0):
    pts = []
    for i in range(n * 2):
        r = r1 if i % 2 == 0 else r2; ang = rot + i * math.pi / n
        pts.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
    d.polygon(pts, fill=col)
W, G, K = (255, 255, 255, 255), (255, 220, 110, 255), (10, 6, 16, 255)
def emblem(uid, d, b):
    B = b + (255,)
    if uid == "ult_azathoth":
        for r, c in ((70, B), (52, (60, 20, 120, 255)), (34, K)): d.ellipse([128 - r, 128 - r, 128 + r, 128 + r], fill=c)
        for k in range(5): d.arc([40 + k * 6, 40 + k * 6, 216 - k * 6, 216 - k * 6], k * 70, k * 70 + 120, fill=W, width=6)
    elif uid == "ult_shub_niggurath":
        for k, (x, y) in enumerate(((128, 82), (88, 154), (168, 154))): d.ellipse([x - 36, y - 36, x + 36, y + 36], outline=[G, (120, 255, 140, 255), W][k], width=9); star(d, x, y, 16, 6, 4, G)
    elif uid == "ult_uriel":
        d.pieslice([46, 60, 210, 230], 180, 360, fill=B); d.rectangle([46, 144, 210, 150], fill=G)
        for x in range(60, 200, 28): d.line([(x, 146), (x + 14, 96)], fill=W, width=4)
    elif uid == "ult_raphael":
        d.ellipse([46, 92, 210, 164], fill=W); d.ellipse([98, 98, 158, 158], fill=B); d.ellipse([116, 116, 140, 140], fill=K)
        for k in range(6): ang = k * math.pi / 3; d.line([(128 + math.cos(ang) * 92, 128 + math.sin(ang) * 92), (128 + math.cos(ang) * 112, 128 + math.sin(ang) * 112)], fill=G, width=6)
    elif uid == "ult_faust":
        d.polygon([(150, 34), (82, 138), (124, 138), (100, 222), (178, 104), (134, 104), (164, 34)], fill=(255, 245, 140, 255))
        for k in range(3): d.arc([30 + k * 10, 50 + k * 10, 226 - k * 10, 206 - k * 10], 200 + k * 30, 260 + k * 30, fill=(150, 255, 230, 255), width=5)
    elif uid == "ult_satanael":
        d.ellipse([70, 80, 186, 196], fill=(255, 90, 20, 255)); d.ellipse([92, 102, 164, 174], fill=(255, 220, 90, 255))
        for k in range(9): ang = -math.pi / 2 + (k - 4) * 0.33; d.polygon([(128 + math.cos(ang) * 50, 138 + math.sin(ang) * 50), (128 + math.cos(ang) * 112, 138 + math.sin(ang) * 112), (128 + math.cos(ang + 0.12) * 52, 138 + math.sin(ang + 0.12) * 52)], fill=(200, 20, 20, 255))
    elif uid == "ult_lucifer":
        for sg in (-1, 1):
            for k in range(4): d.polygon([(128, 120), (128 + sg * (40 + k * 22), 70 + k * 18), (128 + sg * (30 + k * 20), 110 + k * 22)], fill=(30, 10, 40, 255), outline=B)
        star(d, 128, 150, 34, 14, 5, B, -math.pi / 2)
    elif uid == "ult_metatron":
        for k, x in enumerate(range(70, 200, 30)): d.polygon([(x, 220), (x - 8, 70 + (k % 2) * 20), (x, 40 + (k % 2) * 20), (x + 8, 70 + (k % 2) * 20)], fill=[W, G][k % 2])
    elif uid == "ult_cthugha":
        d.polygon([(128, 28), (176, 120), (196, 176), (128, 228), (60, 176), (80, 120)], fill=(255, 110, 20, 255)); d.polygon([(128, 90), (156, 150), (128, 206), (100, 150)], fill=(255, 230, 100, 255))
    elif uid == "ult_michael":
        d.rectangle([120, 40, 136, 200], fill=W); d.rectangle([84, 150, 172, 162], fill=G); d.polygon([(120, 40), (128, 24), (136, 40)], fill=W)
        for k in range(6): x = 52 + k * 30; d.ellipse([x - 10, 196, x + 10, 216], outline=G, width=5)
    elif uid == "ult_hastur":
        d.polygon([(64, 150), (64, 84), (96, 116), (128, 70), (160, 116), (192, 84), (192, 150)], fill=G)
        for k in range(3): d.arc([40 - k * 6, 130 - k * 4, 216 + k * 6, 230 + k * 4], 20, 160, fill=B, width=6)
for uid, name, el in ULT:
    im, d = medal(el); emblem(uid, d, PAL[el][1])
    im = im.filter(ImageFilter.SMOOTH)
    short = uid
    im.resize((64, 64), Image.LANCZOS).save(os.path.join(RP, f"textures/items/etheria_sk_{short}.png"))
    im.resize((32, 32), Image.LANCZOS).save(os.path.join(RP, f"textures/ui/etheria/skill_{short}.png"))
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
sheet = Image.new("RGBA", (6 * 140, 2 * 160), (34, 36, 48, 255)); dd = ImageDraw.Draw(sheet)
for i, (uid, name, el) in enumerate(ULT):
    ic = Image.open(os.path.join(RP, f"textures/items/etheria_sk_{uid}.png")).resize((128, 128), Image.NEAREST)
    x, y = (i % 6) * 140 + 6, (i // 6) * 160 + 6; sheet.alpha_composite(ic, (x, y)); dd.text((x, y + 132), name.split(",")[0], fill=(230, 230, 230))
os.makedirs("/home/user/repo/previews", exist_ok=True); sheet.save("/home/user/repo/previews/ultimates_icones.png")
print(len(ULT), "ultimates")

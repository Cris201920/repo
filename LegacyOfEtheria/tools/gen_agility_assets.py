# Gera os recursos das Agilidades Supremas a partir de BP/scripts/data/agility.js: ícones (UI e item), itens da hotbar (sk_<id>), item_texture.json e traduções.
# Arte procedural original: emblema por modo (investida, deslocamento, passo dimensional, aéreo, aceleração, fenda, esquiva) nas cores da raça; moldura por estágio.
import json, os, subprocess, sys, math
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "LegacyOfEtheria_BP"), os.path.join(ROOT, "LegacyOfEtheria_RP")
data = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", f"import('{BP}/scripts/data/agility.js').then(m=>console.log(JSON.stringify(m.AGILITY_LINES)))"]))
PAL = {"fire": (255, 140, 30), "ember": (255, 80, 15), "gold": (255, 215, 80), "violet": (190, 115, 255), "shadow": (110, 60, 160), "black": (40, 25, 60), "void": (150, 80, 255), "water": (70, 140, 255),
       "foam": (205, 235, 255), "earth": (160, 115, 65), "dust": (190, 165, 125), "wind": (180, 255, 230), "light": (255, 250, 205), "holy": (255, 235, 155), "blood": (215, 25, 40), "green": (100, 255, 115),
       "white": (255, 255, 255), "steel": (200, 210, 230), "sage": (115, 255, 230), "toxic": (140, 255, 50), "arcane": (165, 130, 255), "ice": (140, 225, 255)}
TIER = [((150, 110, 70), (90, 60, 35)), ((200, 210, 230), (110, 120, 140)), ((255, 210, 90), (160, 110, 20))]
def mode_of(sk): return "dodge" if sk.get("dodge") else sk["exec"]["mode"]
def icon(sk, cols, tier, S=64):
    a, b = PAL.get(cols[0], (255, 255, 255)), PAL.get(cols[1], (255, 255, 255))
    im = Image.new("RGBA", (S, S), (10, 10, 18, 255)); d = ImageDraw.Draw(im)
    for r in range(S // 2, 0, -1):   # fundo radial na cor da raça
        f = r / (S / 2); c = tuple(int(10 + (x * 0.35) * (1 - f)) for x in a); d.ellipse([S / 2 - r, S / 2 - r, S / 2 + r, S / 2 + r], fill=c + (255,))
    g = Image.new("RGBA", (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(g); m = mode_of(sk); W = max(2, S // 16)
    if m == "surge":
        for i, y in enumerate((0.30, 0.5, 0.70)):
            gd.line([(S * 0.12, S * y), (S * (0.62 if i != 1 else 0.7), S * y)], fill=(a if i != 1 else b) + (255,), width=W)
        gd.polygon([(S * 0.62, S * 0.22), (S * 0.9, S * 0.5), (S * 0.62, S * 0.78)], fill=b + (255,))
    elif m == "blink":
        for i in range(3): x = S * (0.18 + i * 0.22); al = 90 + i * 80; gd.ellipse([x, S * 0.3, x + S * 0.22, S * 0.7], outline=(a if i < 2 else b) + (al,), width=W)
        gd.polygon([(S * 0.74, S * 0.36), (S * 0.9, S * 0.5), (S * 0.74, S * 0.64)], fill=b + (255,))
    elif m == "phase":
        gd.arc([S * 0.14, S * 0.14, S * 0.86, S * 0.86], 200, 520, fill=a + (255,), width=W)
        gd.line([(S * 0.3, S * 0.72), (S * 0.72, S * 0.3)], fill=b + (255,), width=W + 1); gd.polygon([(S * 0.72, S * 0.3), (S * 0.8, S * 0.2), (S * 0.66, S * 0.26)], fill=(255, 255, 255, 255))
    elif m == "airdash":
        for k in (-1, 1):
            pts = [(S * 0.5, S * 0.55), (S * (0.5 + k * 0.38), S * 0.3), (S * (0.5 + k * 0.3), S * 0.5), (S * (0.5 + k * 0.36), S * 0.62)]
            gd.polygon(pts, fill=a + (230,))
        gd.polygon([(S * 0.5, S * 0.15), (S * 0.64, S * 0.38), (S * 0.36, S * 0.38)], fill=b + (255,)); gd.line([(S * 0.5, S * 0.38), (S * 0.5, S * 0.85)], fill=b + (255,), width=W)
    elif m == "overdrive":
        for i in range(3):
            y = S * (0.22 + i * 0.2); gd.line([(S * 0.25, y), (S * 0.5, y + S * 0.14), (S * 0.75, y)], fill=(a if i % 2 else b) + (255,), width=W + 1)
    elif m == "rift":
        gd.ellipse([S * 0.24, S * 0.12, S * 0.76, S * 0.88], outline=a + (255,), width=W + 1); gd.ellipse([S * 0.36, S * 0.28, S * 0.64, S * 0.72], outline=b + (255,), width=W)
        gd.ellipse([S * 0.45, S * 0.45, S * 0.55, S * 0.55], fill=(255, 255, 255, 255))
    elif m == "dodge":
        gd.arc([S * 0.18, S * 0.18, S * 0.82, S * 0.82], 120, 330, fill=a + (255,), width=W + 1)
        gd.polygon([(S * 0.5, S * 0.2), (S * 0.74, S * 0.32), (S * 0.68, S * 0.66), (S * 0.5, S * 0.8), (S * 0.32, S * 0.66), (S * 0.26, S * 0.32)], outline=b + (255,), width=W)
    glow = g.filter(ImageFilter.GaussianBlur(S / 20)); im = Image.alpha_composite(im, glow); im = Image.alpha_composite(im, g)
    d = ImageDraw.Draw(im); t1, t2 = TIER[tier]
    d.rectangle([0, 0, S - 1, S - 1], outline=t1 + (255,), width=max(1, S // 32)); d.rectangle([S // 32 + 1, S // 32 + 1, S - S // 32 - 2, S - S // 32 - 2], outline=t2 + (255,), width=1)
    for i in range(tier + 1): d.rectangle([S * 0.08 + i * S * 0.1, S * 0.84, S * 0.08 + i * S * 0.1 + S * 0.06, S * 0.9], fill=t1 + (255,))
    return im
itx_p = os.path.join(RP, "textures/item_texture.json"); itx = json.load(open(itx_p))
langs = {f: open(os.path.join(RP, "texts", f), encoding="utf8").read() for f in ("pt_BR.lang", "en_US.lang")}
n = 0
for race, L in data.items():
    for tier, sk in enumerate(L["stages"]):
        sid = sk["id"]; ic = icon(sk, L["fx"], tier)
        ic.convert("RGBA").save(os.path.join(RP, f"textures/ui/etheria/skill_{sid}.png"))
        if sk["type"] != "active": n += 1; continue
        ic.save(os.path.join(RP, f"textures/items/etheria_sk_{sid}.png"))
        itx["texture_data"][f"etheria_sk_{sid}"] = {"textures": f"textures/items/etheria_sk_{sid}"}
        item = {"format_version": "1.21.60", "minecraft:item": {"description": {"identifier": f"etheria:sk_{sid}", "menu_category": {"category": "none"}}, "components": {
            "minecraft:icon": {"textures": {"default": f"etheria_sk_{sid}"}}, "minecraft:display_name": {"value": f"§b{sk['name']}"}, "minecraft:max_stack_size": 1,
            "minecraft:cooldown": {"category": f"etheria_cd_{sid}", "duration": 0.05}}}}
        json.dump(item, open(os.path.join(BP, f"items/sk_{sid}.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
        line = f"item.etheria:sk_{sid}={sk['name']}"
        for f in langs:
            if f"item.etheria:sk_{sid}=" not in langs[f]: langs[f] = langs[f].rstrip("\n") + "\n" + line + "\n"
        n += 1
json.dump(itx, open(itx_p, "w", encoding="utf8"), ensure_ascii=False, indent=1)
for f, txt in langs.items(): open(os.path.join(RP, "texts", f), "w", encoding="utf8").write(txt)
print("agilidades:", n)

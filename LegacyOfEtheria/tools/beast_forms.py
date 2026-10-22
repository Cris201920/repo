"""7.x - ITENS/ÍCONES DAS TRANSFORMAÇÕES DA RAÇA BEASTKIN (Carrion): beast_form, beast_king, royal_beast.
Cria (idempotente): BP/items/sk_<id>.json (mesmo formato dos outros itens de habilidade), RP/textures/items/etheria_sk_<id>.png (64 px),
RP/textures/ui/etheria/skill_<id>.png (ícone do menu), entradas no item_texture.json e nomes nos .lang.
Os ícones partem do ícone da pata (etheria_sk_beast_roar.png): cores por forma + coroa (Rei Besta) e coroa com presas (Besta Real).
Uso: python3 tools/beast_forms.py"""
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "LegacyOfEtheria_BP"), os.path.join(ROOT, "LegacyOfEtheria_RP")
FORMS = {  # id: (nome, cor do item §, cor da pata, cor da moldura, coroa)
    "beast_form": ("Forma Fera", "§9", (205, 120, 45), (150, 95, 50), 0),
    "beast_king": ("Rei Besta", "§5", (240, 190, 60), (230, 180, 40), 1),
    "royal_beast": ("Besta Real", "§6", (215, 40, 40), (250, 200, 70), 2),
}

def icon(paw, frame, crown):
    src = Image.open(os.path.join(RP, "textures/items/etheria_sk_beast_roar.png")).convert("RGBA").resize((64, 64), Image.NEAREST)
    px = src.load(); W, H = src.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if not a: continue
            if r > 120 and r > g * 1.6 and r > b * 1.6:              # pata vermelha -> cor da forma (mantém o sombreado)
                k = r / 220; px[x, y] = (min(255, int(paw[0] * k)), min(255, int(paw[1] * k)), min(255, int(paw[2] * k)), a)
            elif b > 150 and b > r * 1.4:                             # moldura azul -> cor da moldura
                k = b / 230; px[x, y] = (min(255, int(frame[0] * k)), min(255, int(frame[1] * k)), min(255, int(frame[2] * k)), a)
    if crown:
        d = ImageDraw.Draw(src); g, dk = (255, 210, 60), (120, 80, 10)
        pts = [(22, 14), (24, 7), (28, 12), (32, 5), (36, 12), (40, 7), (42, 14)]
        d.polygon(pts + [(42, 16), (22, 16)], fill=g, outline=dk)
        for x in (24, 32, 40): d.point((x, 7 if x != 32 else 5), fill=(255, 255, 255))
        if crown > 1:   # presas de Besta Real
            for x in (18, 46): d.polygon([(x - 2, 44), (x + 2, 44), (x, 52)], fill=(245, 245, 235), outline=(90, 90, 80))
    return src

def main():
    it_path = os.path.join(RP, "textures/item_texture.json"); IT = json.load(open(it_path, encoding="utf-8")); itc = False
    for sid, (name, col, paw, frame, crown) in FORMS.items():
        item = {"format_version": "1.21.60", "minecraft:item": {"description": {"identifier": f"etheria:sk_{sid}", "menu_category": {"category": "none"}},
            "components": {"minecraft:icon": {"textures": {"default": f"etheria_sk_{sid}"}}, "minecraft:display_name": {"value": f"{col}{name}"},
                           "minecraft:max_stack_size": 1, "minecraft:cooldown": {"category": f"etheria_cd_{sid}", "duration": 0.05}}}}
        open(os.path.join(BP, "items", f"sk_{sid}.json"), "w", encoding="utf-8").write(json.dumps(item, ensure_ascii=False, indent=1))
        im = icon(paw, frame, crown)
        im.save(os.path.join(RP, "textures/items", f"etheria_sk_{sid}.png"))
        im.resize((32, 32), Image.LANCZOS).save(os.path.join(RP, "textures/ui/etheria", f"skill_{sid}.png"))
        key = f"etheria_sk_{sid}"
        if key not in IT["texture_data"]: IT["texture_data"][key] = {"textures": f"textures/items/{key}"}; itc = True
        for lang in ("pt_BR.lang", "en_US.lang"):
            p = os.path.join(RP, "texts", lang); txt = open(p, encoding="utf-8").read(); line = f"item.etheria:sk_{sid}={name}"
            if line not in txt: open(p, "w", encoding="utf-8").write(txt.rstrip("\n") + "\n" + line + "\n")
    if itc: open(it_path, "w", encoding="utf-8").write(json.dumps(IT, ensure_ascii=False, indent=1))
    print("ok:", ", ".join(FORMS))

if __name__ == "__main__": main()

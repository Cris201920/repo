# 6.56 - Texturas da tela de ESCOLHA DE RAÇA no estilo do mod de referência (cartão cinza com borda clara, faixa escura do nome com
# brilho ciano, retrato do rosto da raça numa moldura ciano). Retratos = rostos 16x16 em pixel art próprios (arte original), um por raça.
# Uso: python3 tools/race_card_ui.py
import os, math
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, "LegacyOfEtheria_RP/textures/ui/etheria")

def card():
    W, H = 256, 200; im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], fill=(232, 232, 232, 255))          # borda clara externa
    d.rectangle([3, 3, W - 4, H - 4], fill=(120, 120, 120, 255))          # filete escuro
    d.rectangle([5, 5, W - 6, H - 6], fill=(78, 78, 80, 245))             # fundo cinza
    d.line([(5, 5), (W - 6, 5)], fill=(105, 105, 108, 255)); d.line([(5, 5), (5, H - 6)], fill=(105, 105, 108, 255))
    im.save(os.path.join(OUT, "card_bg.png"))
def banner():
    W, H = 192, 28; base = Image.new("RGBA", (W, H), (0, 0, 0, 0)); g = Image.new("L", (W, H), 0); gd = ImageDraw.Draw(g)
    gd.rounded_rectangle([2, 2, W - 3, H - 3], radius=12, outline=255, width=3)
    glow = g.filter(ImageFilter.GaussianBlur(2.2)); cyan = Image.new("RGBA", (W, H), (40, 225, 255, 255)); cyan.putalpha(glow); base.alpha_composite(cyan)
    d = ImageDraw.Draw(base); d.rounded_rectangle([4, 4, W - 5, H - 5], radius=10, fill=(8, 34, 42, 255), outline=(110, 240, 255, 255), width=1)
    base.save(os.path.join(OUT, "card_banner.png"))
def frame():
    S = 48; base = Image.new("RGBA", (S, S), (0, 0, 0, 0)); g = Image.new("L", (S, S), 0); gd = ImageDraw.Draw(g)
    gd.ellipse([3, 3, S - 4, S - 4], outline=255, width=3)
    for k in range(12):   # faíscas em volta (o brilho "elétrico" da referência)
        a = k * math.pi / 6 + 0.2; r1, r2 = S / 2 - 3, S / 2 - 0.5
        gd.line([(S / 2 + math.cos(a) * r1, S / 2 + math.sin(a) * r1), (S / 2 + math.cos(a + 0.12) * r2, S / 2 + math.sin(a + 0.12) * r2)], fill=200, width=1)
    glow = g.filter(ImageFilter.GaussianBlur(1.6)); cyan = Image.new("RGBA", (S, S), (40, 220, 255, 255)); cyan.putalpha(glow); base.alpha_composite(cyan)
    ImageDraw.Draw(base).ellipse([6, 6, S - 7, S - 7], fill=(10, 30, 40, 255), outline=(150, 245, 255, 255))
    base.save(os.path.join(OUT, "card_frame.png"))
def btn(name, fill, edge):
    W, H = 96, 24; im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], fill=(20, 20, 20, 255)); d.rectangle([1, 1, W - 2, H - 2], fill=fill)
    d.line([(1, 1), (W - 2, 1)], fill=edge); d.line([(1, 1), (1, H - 2)], fill=edge); d.line([(1, H - 3), (W - 2, H - 3)], fill=(70, 70, 70, 255))
    im.save(os.path.join(OUT, name))

# ------------------------------------------------------------------ retratos 16x16 (rosto de frente)
SK = {"pele": (219, 168, 128), "pele_s": (186, 134, 98)}
def face(skin, hair, eyes=(60, 90, 200), extra=None, mouth=(120, 60, 50), hair_rows=4, beard=None):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); px = im.load()
    for y in range(16):
        for x in range(16):
            if 2 <= x <= 13 and 2 <= y <= 15: px[x, y] = skin
    for y in range(2, 2 + hair_rows):
        for x in range(2, 14): px[x, y] = hair
    for y in range(2 + hair_rows, 2 + hair_rows + 3): px[2, y] = hair; px[13, y] = hair
    for x in (4, 5): px[x, 9] = (245, 245, 245); px[5, 9] = eyes
    for x in (10, 11): px[x, 9] = (245, 245, 245); px[10, 9] = eyes
    for x in (6, 7, 8, 9): px[x, 12] = mouth
    if beard:
        for y in range(11, 16):
            for x in range(3, 13):
                if not (y == 12 and 6 <= x <= 9): px[x, y] = beard
    if extra: extra(px)
    return im
def horns(col):
    def f(px):
        for x, y in ((3, 1), (3, 0), (2, 0), (12, 1), (12, 0), (13, 0)): px[x, y] = col
    return f
def halo(px):
    for x in range(4, 12): px[x, 0] = (255, 225, 90)
def ears(col, tall=False):
    def f(px):
        for y in range(5, 9 if tall else 8): px[1, y] = col; px[14, y] = col
        if tall: px[0, 5] = col; px[15, 5] = col
    return f
def animal_ears(col):
    def f(px):
        for x, y in ((3, 1), (4, 1), (3, 0), (11, 1), (12, 1), (12, 0)): px[x, y] = col
    return f
def chain(*fs):
    def f(px):
        for g in fs: g(px)
    return f
def scales(col):
    def f(px):
        for x, y in ((3, 10), (12, 10), (4, 11), (11, 11), (3, 13), (12, 13)): px[x, y] = col
    return f
def fangs(px): px[6, 13] = (250, 250, 250); px[9, 13] = (250, 250, 250)
def slime():
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([1, 3, 14, 15], fill=(70, 150, 255, 255)); d.ellipse([3, 4, 9, 8], fill=(150, 205, 255, 255))
    d.point([(5, 9), (10, 9)], fill=(20, 30, 60, 255)); d.line([(6, 12), (9, 12)], fill=(30, 70, 140, 255))
    return im
FACES = {
    "human": face(SK["pele"], (90, 60, 30)),
    "slime": slime(),
    "goblin": face((110, 170, 80), (50, 70, 30), eyes=(200, 40, 30), extra=ears((110, 170, 80), True)),
    "demon": face((205, 120, 120), (40, 20, 30), eyes=(255, 60, 40), extra=chain(horns((60, 20, 30)), fangs)),
    "elf": face((236, 200, 165), (240, 225, 150), eyes=(60, 170, 90), extra=ears((236, 200, 165), True)),
    "angel": face((240, 210, 180), (250, 245, 220), eyes=(80, 160, 230), extra=halo),
    "dragonoid": face((200, 150, 110), (160, 40, 30), eyes=(255, 190, 40), extra=chain(horns((240, 200, 120)), scales((190, 80, 40)))),
    "beastkin": face(SK["pele"], (180, 110, 50), eyes=(240, 180, 40), extra=animal_ears((180, 110, 50))),
    "undead": face((150, 165, 150), (60, 60, 70), eyes=(120, 255, 160), mouth=(70, 80, 70)),
    "ogre": face((215, 150, 120), (200, 40, 40), eyes=(250, 200, 60), extra=chain(horns((245, 240, 230)), fangs)),
    "lizardman": face((90, 150, 90), (60, 110, 60), eyes=(250, 220, 60), hair_rows=3, extra=scales((60, 110, 70))),
    "vampire": face((235, 225, 225), (30, 25, 35), eyes=(220, 20, 30), extra=fangs),
    "dwarf": face(SK["pele"], (150, 80, 30), beard=(160, 90, 40)),
}
def portraits():
    for rid, f in FACES.items():
        big = f.resize((64, 64), Image.NEAREST)
        sh = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); sh.alpha_composite(big)
        sh.save(os.path.join(OUT, f"race_face_{rid}.png"))

if __name__ == "__main__":
    card(); banner(); frame(); btn("card_btn.png", (128, 128, 128, 255), (200, 200, 200, 255)); btn("card_btn_sel.png", (40, 140, 40, 255), (120, 220, 120, 255))
    portraits(); print("ok:", len(FACES), "retratos")

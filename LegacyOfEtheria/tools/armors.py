# tools/armors.py - ARMADURAS (6.35): refaz todos os conjuntos (menos o do Dragão, que fica como está) no formato confiável do jogo:
# geometria oficial geometry.humanoid.armor.* + textura HD 128x64 no layout padrão de armadura (UV x2) + ícones novos 32x32.
# Cada conjunto tem paleta e motivo próprios (placas metálicas, mantos com barra, escamas, runas, estrelas, raios...). Arte procedural original.
import os, json, random, math
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
K = 2   # escala do layout 64x32 -> 128x64

SETS = {   # base, escuro, acabamento, gema, estilo (metal|cloth|scale), motivo
  "arcane":        ((70, 70, 170), (34, 30, 90), (200, 210, 235), (120, 220, 255), "metal", "rune"),
  "archevoker":    ((70, 66, 74), (36, 32, 40), (226, 186, 80), (90, 220, 120), "cloth", "emblem"),
  "celestial":     ((236, 236, 244), (176, 176, 196), (236, 190, 70), (120, 200, 255), "metal", "wing"),
  "cryomancer":    ((120, 190, 230), (60, 110, 160), (236, 248, 255), (180, 240, 255), "cloth", "snow"),
  "cultist":       ((110, 26, 36), (54, 12, 18), (224, 214, 180), (220, 40, 40), "cloth", "skull"),
  "dragotite":     ((96, 120, 118), (46, 60, 60), (190, 200, 196), (110, 230, 200), "scale", "scale"),
  "dragotite_abyss": ((70, 40, 96), (30, 16, 44), (170, 120, 220), (220, 60, 255), "scale", "scale"),
  "dragotite_earth": ((116, 92, 60), (60, 46, 28), (130, 180, 90), (110, 220, 90), "scale", "scale"),
  "dragotite_frost": ((150, 200, 230), (80, 130, 170), (236, 250, 255), (160, 240, 255), "scale", "scale"),
  "dragotite_scorch": ((160, 60, 30), (80, 26, 14), (250, 180, 70), (255, 120, 30), "scale", "scale"),
  "dragotite_star":  ((40, 44, 100), (18, 18, 50), (240, 210, 110), (255, 240, 160), "scale", "stars"),
  "dragotite_storm": ((60, 90, 150), (26, 40, 80), (250, 220, 90), (130, 230, 255), "scale", "bolt"),
  "electromancer": ((40, 52, 110), (18, 24, 60), (250, 220, 70), (120, 220, 255), "cloth", "bolt"),
  "iron_reinforced": ((170, 174, 182), (96, 100, 110), (214, 218, 226), (200, 70, 60), "metal", "rivets"),
  "knight":        ((160, 166, 178), (84, 90, 104), (226, 190, 80), (60, 110, 220), "metal", "tabard"),
  "plagued":       ((98, 120, 60), (52, 62, 30), (150, 120, 80), (170, 240, 60), "cloth", "mask"),
  "priest":        ((240, 238, 228), (190, 186, 170), (226, 186, 80), (90, 160, 240), "cloth", "cross"),
  "pyromancer":    ((176, 50, 30), (90, 22, 14), (250, 170, 60), (255, 200, 60), "cloth", "flame"),
  "shadow":        ((44, 40, 52), (20, 18, 26), (130, 80, 200), (170, 90, 255), "metal", "rune"),
  "shadowwalker":  ((56, 60, 66), (24, 26, 30), (70, 200, 180), (90, 255, 220), "cloth", "hood"),
  "void":          ((30, 20, 50), (12, 8, 22), (160, 100, 240), (210, 140, 255), "metal", "stars"),
}
def boxfaces(u, v, w, h, d):
    """faces de uma caixa no layout de UV de caixa (em pixels do 64x32)"""
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d), "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
            "left": (u + d + w, v + d, d, h), "back": (u + d + w + d, v + d, w, h)}
HEAD = boxfaces(0, 0, 8, 8, 8); BODY = boxfaces(16, 16, 8, 12, 4); ARM = boxfaces(40, 16, 4, 12, 4); LEG = boxfaces(0, 16, 4, 12, 4)

def mul(c, f): return tuple(max(0, min(255, int(x * f))) for x in c)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def paint_face(px, rect, S, part, face, rnd, region="full"):
    base, dark, trim, gem, style, motif = S
    u, v, w, h = [x * K for x in rect]
    y0 = 0
    if region == "boots": y0 = int(h * 0.62)
    if region == "waist": h = int(h * 0.42)
    for y in range(y0, h):
        for x in range(w):
            t = y / max(1, h - 1)
            c = mix(mul(base, 1.12), mul(base, 0.82), t)
            if style == "metal":
                if (y - y0) % 8 == 7: c = mul(c, 0.62)            # junta das placas
                if (y - y0) % 8 == 0: c = mul(c, 1.18)            # brilho da borda da placa
            elif style == "cloth":
                c = mul(c, 0.92 + 0.10 * math.sin(x * 1.3 + y * 0.15))   # dobras
            elif style == "scale":
                sx, sy = x % 6, (y + (x // 6 % 2) * 3) % 6
                c = mul(c, 1.15 - 0.07 * sy) if sy < 5 else mul(dark, 1.0)
            c = mul(c, 1 + 0.05 * rnd.uniform(-1, 1))
            # acabamento nas bordas da face
            edge_v = (x < 2 or x >= w - 2) and w >= 16          # bordas verticais só nas faces largas (as estreitas viravam listras)
            if edge_v or y - y0 < 2 or y >= h - 2:
                if face != "top" and face != "bottom": c = mul(trim, 0.85 + 0.15 * ((x + y) % 2))
            px[u + x, v + y] = c + (255,)
    # motivos nas frentes
    d = lambda x, y, col: px.__setitem__((u + int(x), v + int(y)), col + (255,))
    if face == "front":
        cx = w // 2
        if part == "head":
            if motif in ("hood", "mask") or style == "cloth":
                for y in range(int(h * 0.30), int(h * 0.95)):
                    for x in range(int(w * 0.22), int(w * 0.78)): d(x, y, mul(dark, 0.45))     # abertura do capuz
                if motif == "mask":
                    for x in range(int(w * 0.35), int(w * 0.65)):
                        for y in range(int(h * 0.55), int(h * 0.95)): d(x, y, mul(trim, 1.0))   # bico da máscara
            else:
                for x in range(int(w * 0.15), int(w * 0.85)):
                    for y in (int(h * 0.42), int(h * 0.42) + 1): d(x, y, (12, 10, 16))          # viseira
                for y in range(int(h * 0.42), int(h * 0.9)): d(cx - 1, y, mul(trim, 1.0)); d(cx, y, mul(trim, 1.0))
                d(cx - 1, int(h * 0.2), gem); d(cx, int(h * 0.2), gem)
        if part == "body" and region == "full":
            gy = int(h * 0.30)
            for k in range(5):                                                                   # gema central em losango
                for x in range(cx - 4 + k, cx + 4 - k): d(x, gy + k, mul(gem, 1.2 - k * 0.12)); d(x, gy - k, mul(gem, 1.25 - k * 0.1))
            if motif == "tabard":
                for y in range(gy + 5, h - 2):
                    for x in range(cx - 4, cx + 4): d(x, y, mul(gem, 0.8))
            if motif in ("cross",):
                for y in range(gy + 6, h - 3): d(cx - 1, y, trim); d(cx, y, trim)
                for x in range(cx - 5, cx + 5): d(x, gy + 10, trim)
            if motif == "wing":
                for k in range(8): d(cx + 5 + k, gy - 2 + k // 2, trim); d(cx - 6 - k, gy - 2 + k // 2, trim)
            if motif == "skull":
                for x in range(cx - 3, cx + 3):
                    for y in range(gy + 8, gy + 13): d(x, y, trim)
                d(cx - 2, gy + 10, (20, 0, 0)); d(cx + 1, gy + 10, (20, 0, 0))
    if motif in ("rune", "bolt", "flame", "snow", "stars") and face in ("front", "back", "left", "right"):
        n = 3 if face == "front" else 1
        for _ in range(n):
            x, y = rnd.randrange(2, max(3, w - 3)), rnd.randrange(max(y0 + 2, 2), max(y0 + 3, h - 4))
            if motif == "stars": d(x, y, (255, 255, 230)); continue
            if motif == "snow":
                for k in (-1, 0, 1): d(x + k, y, (240, 250, 255)); d(x, y + k, (240, 250, 255))
                continue
            for k in range(3):
                col = mul(gem, 1.2) if motif != "flame" else mix((255, 220, 80), (255, 90, 20), k / 3)
                d(x + (k % 2 if motif == "bolt" else 0), y + k, col)

def paint_set(name, S):
    rnd = random.Random(name)
    l1 = Image.new("RGBA", (64 * K, 32 * K), (0, 0, 0, 0)); l2 = Image.new("RGBA", (64 * K, 32 * K), (0, 0, 0, 0))
    p1, p2 = l1.load(), l2.load()
    for f, r in HEAD.items(): paint_face(p1, r, S, "head", f, rnd)
    for f, r in BODY.items(): paint_face(p1, r, S, "body", f, rnd)
    for f, r in ARM.items(): paint_face(p1, r, S, "arm", f, rnd)
    for f, r in LEG.items(): paint_face(p1, r, S, "leg", f, rnd, "boots" if f not in ("top",) else "full")
    for f, r in BODY.items(): paint_face(p2, r, S, "body", f, rnd, "waist")
    for f, r in LEG.items(): paint_face(p2, r, S, "leg", f, rnd)
    return l1, l2

# ------------------------------------------------------------------ ícones 32x32 (pixel art com contorno, mesma paleta)
SHAPES = {
  "helmet": [(8, 6), (24, 6), (27, 12), (27, 24), (21, 24), (21, 18), (11, 18), (11, 24), (5, 24), (5, 12)],
  "chest":  [(6, 5), (12, 5), (16, 9), (20, 5), (26, 5), (30, 11), (26, 15), (25, 28), (7, 28), (6, 15), (2, 11)],
  "legs":   [(7, 4), (25, 4), (26, 28), (19, 28), (16, 13), (13, 28), (6, 28)],
  "boots":  [(4, 9), (12, 9), (12, 21), (15, 21), (15, 27), (3, 27)],
}
def icon(name, S, part):
    base, dark, trim, gem, style, motif = S
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    polys = [SHAPES[part]] if part != "boots" else [SHAPES["boots"], [(x + 14, y) for x, y in SHAPES["boots"]]]
    for P in polys:
        dr.polygon(P, fill=base + (255,))
    # sombreamento: metade de baixo mais escura, faixa de acabamento no topo
    px = im.load()
    for y in range(32):
        for x in range(32):
            if px[x, y][3]:
                c = mix(mul(base, 1.2), mul(base, 0.7), y / 31)
                if style == "scale" and (x + (y // 3) % 2 * 2) % 4 == 0: c = mul(c, 0.8)
                px[x, y] = c + (255,)
    for P in polys:
        top = min(y for _, y in P); dr.line([(min(x for x, y in P if y == top), top), (max(x for x, y in P if y == top), top)], fill=trim + (255,), width=2)
    if part == "chest": dr.polygon([(16, 11), (19, 15), (16, 19), (13, 15)], fill=gem + (255,)); dr.line([(16, 19), (16, 27)], fill=trim + (255,))
    if part == "helmet":
        if style == "cloth" or motif in ("hood", "mask"): dr.rectangle([12, 12, 20, 18], fill=mul(dark, 0.4) + (255,))
        else: dr.line([(9, 13), (23, 13)], fill=(14, 12, 18, 255), width=2); dr.point([(16, 8)], fill=gem + (255,))
    if part == "legs": dr.line([(7, 9), (25, 9)], fill=trim + (255,))
    if part == "helmet" and name in ("void", "shadow", "cultist", "dragotite_abyss", "dragotite_scorch", "dragotite_storm"):
        for sx in (1, -1):   # chifres
            dr.polygon([(16 + sx * 8, 8), (16 + sx * 13, 1), (16 + sx * 11, 9)], fill=trim + (255,))
    if part == "helmet" and name in ("celestial", "priest", "arcane"):
        for sx in (1, -1): dr.polygon([(16 + sx * 10, 10), (16 + sx * 15, 4), (16 + sx * 14, 12)], fill=trim + (255,))   # asas
    if part == "helmet" and name in ("knight", "iron_reinforced"):
        dr.polygon([(14, 6), (18, 6), (17, 0), (15, 0)], fill=mul(gem, 1.0) + (255,))   # crista
    if part == "chest" and name in ("celestial", "dragotite_star", "priest"):
        for sx in (1, -1): dr.line([(16 + sx * 9, 7), (16 + sx * 14, 3)], fill=trim + (255,), width=2)
    if part == "boots": dr.line([(3, 25), (15, 25)], fill=trim + (255,)); dr.line([(17, 25), (29, 25)], fill=trim + (255,))
    # contorno escuro
    a = im.split()[3]; out = Image.new("RGBA", (32, 32), (0, 0, 0, 0)); po = out.load(); pa = a.load()
    for y in range(32):
        for x in range(32):
            if not pa[x, y] and any(0 <= x + dx < 32 and 0 <= y + dy < 32 and pa[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): po[x, y] = mul(dark, 0.35) + (255,)
    out.alpha_composite(im); return out

GEO = {"helmet": ("geometry.humanoid.armor.helmet", "_1", "variable.helmet_layer_visible = 0.0;"), "chest": ("geometry.humanoid.armor.chestplate", "_1", "variable.chest_layer_visible = 0.0;"),
       "legs": ("geometry.humanoid.armor.leggings", "_2", "variable.leg_layer_visible = 0.0;"), "boots": ("geometry.humanoid.armor.boots", "_1", "variable.boot_layer_visible = 0.0;")}
# 6.36: o jogador pediu para manter estes conjuntos com o modelo ORIGINAL (geometry.etheria_a_*, textura etheria_a_*): o gerador não toca neles
KEEP_ORIGINAL = ("priest", "cryomancer", "electromancer", "dragotite")
def main():
    for name, S in SETS.items():
        if name.startswith(KEEP_ORIGINAL): continue
        if os.path.exists(os.path.join(RP, f"textures/models/armor/etheria_t_{name}.png")): continue   # modelo detalhado do Tensura (tools/tensura_armor.py)
        l1, l2 = paint_set(name, S)
        l1.save(os.path.join(RP, f"textures/models/armor/etheria_{name}_1.png")); l2.save(os.path.join(RP, f"textures/models/armor/etheria_{name}_2.png"))
        for part, (geo, layer, setup) in GEO.items():
            f = os.path.join(RP, f"attachables/{name}_{part}.attachable.json")
            a = json.load(open(f)); desc = a["minecraft:attachable"]["description"]
            desc["geometry"] = {"default": geo}; desc["textures"]["default"] = f"textures/models/armor/etheria_{name}{layer}"
            desc["materials"] = {"default": "armor", "enchanted": "armor_enchanted"}; desc["scripts"] = {"parent_setup": setup}; desc["render_controllers"] = ["controller.render.armor"]
            desc.pop("animations", None)
            json.dump(a, open(f, "w"), indent=1)
            icon(name, S, part).save(os.path.join(RP, f"textures/items/etheria_{name}_{part}.png"))
    print(len(SETS), "conjuntos refeitos (Dragão mantido)")
if __name__ == "__main__": main()

#!/usr/bin/env python3
"""8.9 - RETRATOS DE CORPO INTEIRO das raças iniciais para o carrossel de raças do pacote opcional Sábio UI (tools/gen_sage_ui.py).
Cada retrato = boneco do jogador (pele procedural com as cores da raça) + o corpo Etheria da raça (asas/chifres/cauda, o mesmo .geo do
pacote principal), renderizado em 3/4 pelo renderizador de ícones do projeto (tools/swords.render_icon). Saída: PNG 112x224 transparente.
Uso direto (prévia): python3 tools/race_portraits.py <pasta_saida>"""
import os, sys, json, random
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from swords import Model, render_icon
from tensura_armor import model_of

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
# corpo Etheria do estágio inicial (systems/raceparts.js bodyOfStage(<raça>_1)); sem corpo = só o boneco
BODY = {"demon": "demon", "angel": "angel", "dragonoid": "dragonewt", "beastkin": "beastkin", "ogre": "ogre", "lizardman": "lizardman", "vampire": "vampire"}
# pele, cabelo, roupa, detalhe, calça, bota, olhos
PAL = {
    "human":     ((228, 184, 150), (92, 60, 38), (58, 92, 150), (200, 170, 90), (70, 58, 48), (46, 36, 30), (60, 110, 200)),
    "slime":     ((196, 226, 246), (120, 190, 235), (236, 240, 246), (60, 140, 220), (40, 46, 60), (24, 28, 36), (230, 190, 60)),
    "goblin":    ((112, 160, 72), (34, 34, 30), (120, 86, 52), (170, 140, 80), (78, 60, 40), (50, 38, 28), (230, 60, 40)),
    "demon":     ((178, 160, 190), (30, 26, 36), (110, 22, 34), (210, 170, 70), (34, 30, 40), (20, 18, 24), (240, 50, 50)),
    "elf":       ((240, 214, 186), (236, 214, 120), (60, 128, 70), (220, 200, 120), (92, 76, 52), (70, 54, 36), (70, 170, 110)),
    "angel":     ((246, 222, 200), (250, 226, 130), (238, 238, 246), (226, 190, 80), (220, 220, 232), (200, 176, 110), (90, 160, 240)),
    "dragonoid": ((214, 170, 130), (176, 40, 30), (60, 50, 56), (200, 80, 40), (52, 40, 40), (34, 26, 26), (250, 170, 40)),
    "beastkin":  ((214, 170, 124), (150, 96, 50), (96, 120, 70), (190, 150, 90), (90, 70, 50), (60, 44, 32), (210, 160, 40)),
    "undead":    ((150, 162, 150), (60, 64, 70), (70, 66, 80), (120, 110, 130), (50, 50, 58), (30, 30, 34), (120, 220, 255)),
    "ogre":      ((204, 132, 110), (236, 236, 236), (40, 40, 52), (170, 40, 40), (52, 48, 56), (30, 28, 32), (230, 80, 60)),
    "lizardman": ((84, 150, 120), (40, 90, 70), (130, 100, 60), (190, 160, 90), (90, 72, 50), (60, 46, 34), (240, 210, 60)),
    "vampire":   ((236, 226, 232), (26, 22, 30), (34, 20, 30), (170, 20, 40), (28, 24, 30), (16, 14, 18), (220, 20, 40)),
    "dwarf":     ((222, 168, 130), (196, 98, 40), (110, 74, 44), (190, 160, 90), (80, 64, 50), (54, 40, 30), (80, 120, 180)),
}
HUM = {"description": {"identifier": "h", "texture_width": 64, "texture_height": 64}, "bones": [
    {"name": "head", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}, {"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5}]},
    {"name": "body", "pivot": [0, 24, 0], "cubes": [{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}]},
    {"name": "rightArm", "pivot": [-5, 22, 0], "cubes": [{"origin": [-8, 12, -2], "size": [4, 12, 4], "uv": [40, 16]}]},
    {"name": "leftArm", "pivot": [5, 22, 0], "cubes": [{"origin": [4, 12, -2], "size": [4, 12, 4], "uv": [32, 48]}]},
    {"name": "rightLeg", "pivot": [-1.9, 12, 0], "cubes": [{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}]},
    {"name": "leftLeg", "pivot": [1.9, 12, 0], "cubes": [{"origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]}]}]}

def skin(rid):
    """pele 64x64 (layout padrão) com as cores da raça: cabelo em volume (camada do chapéu), olhos, roupa com cinto, calça e botas"""
    sk, hair, shirt, acc, pants, boot, eye = PAL[rid]
    rnd = random.Random(rid); im = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); px = im.load()
    def jit(c, k=10): v = rnd.randint(-k, k); return tuple(max(0, min(255, x + v)) for x in c) + (255,)
    def box(u, v, w, h, d, colf):
        """pinta a caixa de UV inteira; colf(face, x, y) -> cor (y = linha de cima p/ baixo nas faces laterais)"""
        faces = {"up": (u + d, v, w, d), "down": (u + d + w, v, d and w, d), "east": (u, v + d, d, h), "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h), "south": (u + d + w + d, v + d, w, h)}
        for f, (x0, y0, fw, fh) in faces.items():
            for yy in range(fh):
                for xx in range(fw):
                    c = colf(f, xx, yy, fw, fh)
                    if c: px[x0 + xx, y0 + yy] = c
    # cabeça (frente = north)
    def head(f, x, y, fw, fh):
        if f == "up": return jit(hair, 8)
        if f == "down": return jit(sk, 4)
        if f == "south": return jit(hair, 8) if y < 7 else jit(sk, 4)
        if f in ("east", "west"): return jit(hair, 8) if y < 3 or (y < 6 and ((x < 4) == (f == "east"))) else jit(sk, 4)
        if y < 2 or (y == 2 and x in (0, 1, 3, 6, 7)): return jit(hair, 8)
        if y == 4 and x in (1, 6): return (250, 250, 250, 255)
        if y == 4 and x in (2, 5): return eye + (255,)
        if y == 6 and x in (3, 4): return tuple(int(c * 0.78) for c in sk) + (255,)
        return jit(sk, 3)
    box(0, 0, 8, 8, 8, head)
    def hat(f, x, y, fw, fh):   # volume do cabelo
        if f == "up": return jit(hair, 10)
        if f == "south": return jit(hair, 10) if y < 6 else None
        if f in ("east", "west"): return jit(hair, 10) if y < 3 else None
        if f == "north": return jit(hair, 10) if y < 1 else None
        return None
    box(32, 0, 8, 8, 8, hat)
    def torso(f, x, y, fw, fh):
        if f in ("up", "down"): return jit(shirt, 6)
        if y in (8, 9): return jit((40, 30, 24), 4) if not (f == "north" and x in (3, 4)) else acc + (255,)
        if f == "north" and y < 2 and 2 <= x <= 5: return jit(sk, 3)
        if f == "north" and (x in (1, 6)) and y < 8: return jit(acc, 6)
        return jit(shirt, 7)
    box(16, 16, 8, 12, 4, torso)
    def arm(f, x, y, fw, fh):
        if f == "up": return jit(shirt, 6)
        if f == "down": return jit(sk, 3)
        if y >= 9: return jit(sk, 4)
        if y == 8: return jit(acc, 6)
        return jit(shirt, 7)
    box(40, 16, 4, 12, 4, arm); box(32, 48, 4, 12, 4, arm)
    def leg(f, x, y, fw, fh):
        if f == "up": return jit(pants, 6)
        if f == "down": return jit(boot, 4)
        if y >= 9: return jit(boot, 5)
        return jit(pants, 6)
    box(0, 16, 4, 12, 4, leg); box(16, 48, 4, 12, 4, leg)
    return im

def portrait(rid, view=(222, 5, 0)):
    """corpo inteiro em 3/4; o enquadramento segue o BONECO (asas grandes passam da borda, como no cartão de referência)"""
    sk = skin(rid); m = model_of(HUM); tex = sk; ghost = None
    b = BODY.get(rid)
    gp = os.path.join(RP, f"models/entity/etheria_race_{b}.geo.json") if b else None
    tp = os.path.join(RP, f"textures/entity/etheria_race_{b}.png") if b else None
    if gp and os.path.exists(gp) and os.path.exists(tp):
        g = json.load(open(gp))["minecraft:geometry"][0]; rt = Image.open(tp).convert("RGBA")
        TW, TH = g["description"]["texture_width"], g["description"]["texture_height"]; p = rt.width / TW
        atlas = Image.new("RGBA", (int((64 + TW) * p), int(max(64, TH) * p)), (0, 0, 0, 0))
        atlas.paste(sk.resize((int(64 * p), int(64 * p)), Image.NEAREST), (0, 0)); ghost = atlas.copy(); atlas.paste(rt, (int(64 * p), 0))
        rm = model_of(g); base = Model(64 + TW, max(64, TH)); base.cubes = list(m.cubes)
        for c in rm.cubes:
            c = dict(c); c["uv"] = {f: (dict(uv, uv=[uv["uv"][0] + 64, uv["uv"][1]]) if uv else uv) for f, uv in c["uv"].items()}; base.cubes.append(c)
        m, tex = base, atlas
    m.opaque = False
    S = 512; im = render_icon(m, tex, size=S, view=view, fill=0.94, outline=3)
    # mesmo modelo com as peças da raça transparentes = caixa só do boneco, na mesma escala
    hb = (render_icon(m, ghost, size=S, view=view, fill=0.94, outline=3) if ghost is not None else im).getbbox()
    W, H = 112, 224; k = (H * 0.84) / (hb[3] - hb[1])
    big = im.resize((int(S * k), int(S * k)), Image.LANCZOS)
    cx = (hb[0] + hb[2]) / 2 * k; top = hb[3] * k - (H - 5)   # pés a 5 px da base; chifres/halo cabem em cima
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0)); out.paste(big, (int(W / 2 - cx), int(-top)), big)
    return out

if __name__ == "__main__":
    d = sys.argv[1]; os.makedirs(d, exist_ok=True)
    sheet = Image.new("RGBA", (112 * len(PAL), 224), (10, 14, 30, 255))
    for i, r in enumerate(PAL):
        p = portrait(r); p.save(os.path.join(d, f"race_{r}.png")); sheet.alpha_composite(p, (i * 112, 0))
    sheet.save(os.path.join(d, "_sheet.png")); print("ok", len(PAL))

# 6.80 - FORMA SLIME DO JOGADOR (raça Slime, estilo Rimuru): gota azul translúcida com pico, olhos ovais, brilho no topo.
# Gera models/entity/etheria_player_slime.geo.json, textures/entity/etheria_player_slime.png e animation.etheria.slime_form
# (respira parado, pula em saltinhos ao andar com amassa-e-estica no pouso, estica no ar, pisca).
import json, os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
TW = TH = 64
img = Image.new("RGBA", (TW, TH), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
A = 215                                                     # translucidez do gel
def grad(x0, y0, w, h, top, bot):
    for y in range(h):
        t = y / max(1, h - 1); c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        d.line([(x0, y0 + y), (x0 + w - 1, y0 + y)], fill=c + (A,))
SIDE = (0, 0, 32, 16); TOP = (32, 0, 16, 16); BOT = (48, 0, 16, 16)
grad(*SIDE, (150, 225, 255), (60, 150, 230))               # lateral: claro em cima, azul mais fundo embaixo
grad(*TOP, (190, 240, 255), (160, 230, 255)); grad(*BOT, (50, 130, 210), (40, 110, 190))
img.putpixel((0, 20), (16, 22, 40, 255)); img.putpixel((1, 20), (255, 255, 255, 255)); img.putpixel((2, 20), (120, 200, 255, 255))
img.save(os.path.join(RP, "textures/entity/etheria_player_slime.png"))

def faces(u, v, w, h):
    return {f: {"uv": [u, v], "uv_size": [w, h]} for f in ("north", "south", "east", "west")} | {"up": {"uv": [TOP[0], TOP[1]], "uv_size": [16, 16]}, "down": {"uv": [BOT[0], BOT[1]], "uv_size": [16, 16]}}
# perfil de gota: largura por altura (base achatada larga, ombro arredondado, topo afunilando num pico)
import math
H = 10.0; N = 12; cubes = []
def width(t):                     # t = 0 (chão) .. 1 (topo)
    if t < 0.08: return 12.5 + t / 0.08 * 2.0
    return 14.5 * math.sqrt(max(0.0, 1 - ((t - 0.08) / 0.95) ** 2.2)) + 0.6
for i in range(N):
    y0 = H * i / N; h = H / N + 0.02; w = width((i + 0.5) / N)
    v0 = int(16 * (1 - (y0 + h) / H)); vh = max(1, int(16 * h / H)); c = w * 0.72            # seção octogonal: duas caixas em cruz
    for sx, sz in ((w, c), (c, w)):
        cubes.append({"origin": [round(-sx / 2, 3), round(y0, 3), round(-sz / 2, 3)], "size": [round(sx, 3), round(h, 3), round(sz, 3)], "uv": faces(SIDE[0], max(0, v0), 32, vh)})
cubes.append({"origin": [-1.0, 9.6, -0.2], "size": [2, 1.0, 2], "uv": faces(0, 0, 4, 2), "pivot": [0, 9.9, 0.8], "rotation": [-25, 0, 0]})   # pico
cubes.append({"origin": [-0.6, 10.3, 0.6], "size": [1.2, 0.6, 1.2], "uv": faces(0, 0, 2, 1), "pivot": [0, 10.5, 1.2], "rotation": [-45, 0, 0]})
eye = lambda x: {"origin": [x, 3.6, -7.45], "size": [1.4, 3.4, 0.25], "uv": {f: {"uv": [0, 20], "uv_size": [1, 1]} for f in ("north", "south", "east", "west", "up", "down")}}
shine = {"origin": [-5.0, 7.0, -5.3], "size": [1.8, 0.6, 0.2], "uv": {f: {"uv": [1, 20], "uv_size": [1, 1]} for f in ("north", "south", "east", "west", "up", "down")}}
geo = {"format_version": "1.12.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.etheria_player_slime", "texture_width": TW, "texture_height": TH,
                    "visible_bounds_width": 3, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0.5, 0]},
    "bones": [{"name": "slime_root", "pivot": [0, 0, 0]},
              {"name": "slime_body", "parent": "slime_root", "pivot": [0, 0, 0], "cubes": cubes + [shine]},
              {"name": "slime_eyes", "parent": "slime_body", "pivot": [0, 5.3, -7.3], "cubes": [eye(-3.6), eye(2.2)]}]}]}
json.dump(geo, open(os.path.join(RP, "models/entity/etheria_player_slime.geo.json"), "w"), indent=1)

mv = "math.min(1, query.modified_move_speed * 2.5)"; hop = "math.abs(math.sin(query.anim_time * 300))"
air = "(query.is_on_ground ? 0 : 1)"
anim = {"format_version": "1.8.0", "animations": {"animation.etheria.slime_form": {"loop": True, "bones": {
    "slime_root": {"position": [0, f"{hop} * 3.2 * {mv} * (1 - {air})", 0]},
    "slime_body": {"scale": [
        f"1 + math.sin(query.life_time * 140) * 0.035 + (1 - {hop}) * 0.16 * {mv} * (1 - {air}) - 0.1 * {air}",
        f"1 - math.sin(query.life_time * 140) * 0.045 - (1 - {hop}) * 0.22 * {mv} * (1 - {air}) + {hop} * 0.08 * {mv} + 0.18 * {air}",
        f"1 + math.sin(query.life_time * 140) * 0.035 + (1 - {hop}) * 0.16 * {mv} * (1 - {air}) - 0.1 * {air}"],
        "rotation": [f"-6 * {mv}", 0, f"math.sin(query.anim_time * 150) * 3 * {mv}"]},
    "slime_eyes": {"scale": [1, "(math.mod(query.life_time, 3.7) < 0.12) ? 0.15 : 1", 1]}}}}}
json.dump(anim, open(os.path.join(RP, "animations/etheria_slime_form.animation.json"), "w"), indent=1)
print("slime ok")

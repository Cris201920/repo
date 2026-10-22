# tools/sword_vfx.py - 8.5 ETAPA 5: partículas de ESPADA no estilo NightfallCraft (rastro de corte brilhante, clarão de impacto,
# anel de choque, faíscas, brilho de imbuição, gotas d'água do tridente).
# Gera (idempotente, pode rodar quantas vezes quiser):
#   RP/textures/particle/etheria_slash.png   atlas 4x2 de 64 px, tons de cinza (a cor vem de variable.r/g/b no script)
#   RP/particles/etheria_sl_*.json           6 emissores parametrizados pelas mesmas variáveis Molang de systems/fxlib.js
# Tiles: 0 fita suave (brilho largo) · 1 fita de núcleo (linha branca fina com halo) · 2 clarão estrela · 3 anel · 4 brilho redondo
#        5 faísca alongada · 6 gota d'água · 7 névoa
# Uso: python3 tools/sword_vfx.py
import json, math, os
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
S = 64
AT = Image.new("RGBA", (S * 4, S * 2), (0, 0, 0, 0))

def tile(i, fn):
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); px = im.load()
    for y in range(S):
        for x in range(S):
            v = fn((x + 0.5) / S * 2 - 1, (y + 0.5) / S * 2 - 1)   # coordenadas -1..1
            v = max(0.0, min(1.0, v))
            if v > 0.004: px[x, y] = (255, 255, 255, int(round(v * 255)))
    AT.alpha_composite(im, ((i % 4) * S, (i // 4) * S))

ends = lambda y, k=0.18: min(1.0, (1 - abs(y)) / k)                 # pontas suaves ao longo do comprimento (eixo y = direção)
tile(0, lambda x, y: (math.exp(-(x / 0.42) ** 2) * 0.75 + math.exp(-(x / 0.12) ** 2) * 0.35) * ends(y, 0.3))
tile(1, lambda x, y: (math.exp(-(x / 0.07) ** 2) + math.exp(-(x / 0.3) ** 2) * 0.35) * ends(y, 0.12))
def star(x, y):
    r = math.hypot(x, y); a = math.atan2(y, x)
    rays = max(0.0, 1 - r / (0.15 + 0.85 * abs(math.cos(2 * a)) ** 24)) ** 1.6       # 4 pontas longas
    rays2 = max(0.0, 1 - r / (0.08 + 0.45 * abs(math.cos(2 * a + math.pi / 2)) ** 30)) ** 2 * 0.6
    return rays + rays2 + math.exp(-(r / 0.22) ** 2) * 0.9
tile(2, star)
tile(3, lambda x, y: math.exp(-((math.hypot(x, y) - 0.8) / 0.05) ** 2) + math.exp(-((math.hypot(x, y) - 0.78) / 0.16) ** 2) * 0.35)
tile(4, lambda x, y: math.exp(-(math.hypot(x, y) / 0.38) ** 2) * 0.9 + math.exp(-(math.hypot(x, y) / 0.12) ** 2) * 0.4)
tile(5, lambda x, y: max(0.0, 1 - abs(x) / (0.16 * (1 - abs(y)) + 1e-6)) * (1 - abs(y)) ** 0.4 if abs(y) < 1 else 0)
def drop(x, y):
    yy = (y - 0.25) / 0.65; w = 0.42 * math.sqrt(max(0.0, (1 - yy) / 2)) * (1 + yy) if -1 < yy < 1 else 0
    body = max(0.0, 1 - abs(x) / (w + 1e-6)) ** 0.6 if w > 0 else 0
    hl = math.exp(-(((x + 0.12) / 0.08) ** 2 + ((y - 0.35) / 0.12) ** 2))
    return min(1.0, body * 0.75 + hl * 0.5)
tile(6, drop)
import random
random.seed(85)
blobs = [(random.uniform(-0.45, 0.45), random.uniform(-0.45, 0.45), random.uniform(0.18, 0.35)) for _ in range(9)]
tile(7, lambda x, y: min(1.0, sum(math.exp(-((x - bx) ** 2 + (y - by) ** 2) / (r * r)) for bx, by, r in blobs) * 0.45) * max(0.0, 1 - math.hypot(x, y)) ** 0.5)
os.makedirs(os.path.join(RP, "textures/particle"), exist_ok=True)
AT.save(os.path.join(RP, "textures/particle/etheria_slash.png"))

# ------------------------------------------------------------------ emissores
TEX = "textures/particle/etheria_slash"
def uv(tile_expr):
    return {"texture_width": S * 4, "texture_height": S * 2, "uv": [f"math.mod({tile_expr}, 4) * {S}", f"math.floor(({tile_expr}) / 4) * {S}"], "uv_size": [S, S]}
def base(motion=True):
    c = {"minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_lifetime_once": {"active_time": 0.05},
         "minecraft:emitter_shape_point": {"direction": ["variable.dx", "variable.dy", "variable.dz"]},
         "minecraft:particle_lifetime_expression": {"max_lifetime": "variable.life"}}
    if motion:
        c["minecraft:particle_initial_speed"] = "variable.spd"
        c["minecraft:particle_motion_dynamic"] = {"linear_acceleration": ["variable.ax", "variable.ay", "variable.az"], "linear_drag_coefficient": "variable.drag"}
    return c
AGE = "(v.particle_age / v.particle_lifetime)"
FADE = f"variable.a * math.min(1, v.particle_age * 25) * (1 - math.pow({AGE}, 1.6))"
tint = lambda a=FADE: {"minecraft:particle_appearance_tinting": {"color": ["variable.r", "variable.g", "variable.b", a]}}
CUSTOM_DIR = {"mode": "custom", "custom_direction": ["variable.dx", "variable.dy", "variable.dz"]}
P = {
  # fita do rastro: alinhada ao segmento do arco, afina enquanto some (meia-lua que "se fecha")
  "etheria_sl_ribbon": ("particles_add", dict(base(False), **{"minecraft:particle_appearance_billboard": {
      "size": [f"variable.sx * (1 - 0.6 * {AGE})", "variable.sy"], "facing_camera_mode": "lookat_direction", "direction": CUSTOM_DIR, "uv": uv("variable.tile")}}, **tint())),
  # clarão do impacto: estrela que abre rápido e some
  "etheria_sl_flash": ("particles_add", dict(base(False), **{"minecraft:particle_initial_spin": {"rotation": "variable.rot"},
      "minecraft:particle_appearance_billboard": {"size": [f"variable.size * (0.35 + 0.65 * math.min(1, {AGE} * 4))"] * 2, "facing_camera_mode": "rotate_xyz", "uv": uv("2")}}, **tint())),
  # anel de choque deitado no chão (cresce)
  "etheria_sl_ring": ("particles_add", dict(base(False), **{"minecraft:particle_appearance_billboard": {
      "size": [f"variable.size * (0.25 + variable.grow * {AGE})"] * 2, "facing_camera_mode": "emitter_transform_xz", "uv": uv("3")}}, **tint())),
  # faísca alongada na direção da velocidade (com gravidade/arrasto vindos do script)
  "etheria_sl_spark": ("particles_add", dict(base(), **{"minecraft:particle_appearance_billboard": {
      "size": [f"variable.sx * (1 - {AGE})", f"variable.sy * (1 - 0.5 * {AGE})"], "facing_camera_mode": "lookat_direction", "direction": {"mode": "derive_from_velocity", "min_speed_threshold": 0.01}, "uv": uv("5")}}, **tint())),
  # brilho redondo (imbuição na lâmina, núcleo do impacto, partículas de energia)
  "etheria_sl_glow": ("particles_add", dict(base(), **{"minecraft:particle_appearance_billboard": {
      "size": [f"variable.size * (1 + variable.grow * {AGE})"] * 2, "facing_camera_mode": "lookat_xyz", "uv": uv("variable.tile")}}, **tint())),
  # gota/névoa d'água (mistura normal, cai com gravidade)
  "etheria_sl_drop": ("particles_blend", dict(base(), **{"minecraft:particle_appearance_billboard": {
      "size": [f"variable.size * (1 + variable.grow * {AGE})"] * 2, "facing_camera_mode": "lookat_xyz", "uv": uv("variable.tile")}}, **tint())),
}
for k, (mat, comps) in P.items():
    d = {"format_version": "1.10.0", "particle_effect": {"description": {"identifier": "etheria:" + k[8:], "basic_render_parameters": {"material": mat, "texture": TEX}}, "components": comps}}
    json.dump(d, open(os.path.join(RP, f"particles/{k}.json"), "w"), indent=1)
print("atlas etheria_slash.png +", len(P), "partículas")

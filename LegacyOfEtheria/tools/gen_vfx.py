# 6.36 - Partículas próprias das habilidades em camadas (raio negro, brasa, fragmento sombrio, lâmina de vento, onda de choque).
# Gera textures/particle/etheria_vfx.png (atlas 8x4 de 32 px) e RP/particles/vfx_*.json. Todas usam as variáveis Molang de fxlib (r,g,b,a,size,life,...).
import json, math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
S = 32; AT = Image.new("RGBA", (S * 8, S * 4), (0, 0, 0, 0)); rnd = random.Random(5)
def put(i, im): AT.alpha_composite(im, ((i % 8) * S, (i // 8) * S))
def glow_line(d, pts, w, col): d.line(pts, fill=col, width=w, joint="curve")
# 0-3: raio negro (núcleo escuro violeta + contorno branco-azulado), 4 quadros diferentes para tremeluzir
for f in range(4):
    big = Image.new("RGBA", (S * 4, S * 4), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    pts = [(S * 2 + rnd.uniform(-10, 10), 0)]
    for k in range(1, 7): pts.append((S * 2 + rnd.uniform(-34, 34), k * S * 4 / 6))
    br = [(pts[3][0], pts[3][1]), (pts[3][0] + rnd.choice((-1, 1)) * 40, pts[3][1] + 30)]
    for w, c in ((22, (150, 200, 255, 90)), (12, (235, 245, 255, 255)), (6, (40, 10, 70, 255))):
        glow_line(d, pts, w, c); glow_line(d, br, max(2, w // 2), c)
    put(f, big.filter(ImageFilter.GaussianBlur(1.2)).resize((S, S), Image.LANCZOS))
# 4: brasa (ponto quente com halo)
im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); px = im.load()
for y in range(S):
    for x in range(S):
        r = math.hypot(x - 15.5, y - 15.5) / 16; a = max(0, 1 - r) ** 2.2
        px[x, y] = (255, int(255 * (1 - r * 0.6)), int(255 * max(0, 1 - r * 2)), int(255 * a))
put(4, im)
# 5: fragmento (losango cristalino)
im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.polygon([(16, 1), (25, 13), (16, 31), (8, 14)], fill=(220, 200, 255, 255)); d.polygon([(16, 1), (25, 13), (16, 16)], fill=(255, 255, 255, 255)); d.line([(16, 1), (16, 31)], fill=(150, 110, 220, 255))
put(5, im)
# 6: lâmina de vento (meia-lua)
im = Image.new("RGBA", (S * 4, S * 4), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
for k in range(10): d.arc([8 + k, 20 + k, S * 4 - 8 - k, S * 4 + 60 - k], 200, 340, fill=(255, 255, 255, 255 - k * 22), width=3)
put(6, im.filter(ImageFilter.GaussianBlur(1)).resize((S, S), Image.LANCZOS))
# 7: anel de onda de choque
im = Image.new("RGBA", (S * 4, S * 4), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
for k in range(6): d.ellipse([6 + k * 2, 6 + k * 2, S * 4 - 6 - k * 2, S * 4 - 6 - k * 2], outline=(255, 255, 255, 255 - k * 40), width=3)
put(7, im.filter(ImageFilter.GaussianBlur(1.5)).resize((S, S), Image.LANCZOS))
# 8-11: fumaça/escuridão (4 quadros) | 12: orbe | 13: cruz de luz | 14: runa | 15: faísca alongada
for f in range(4):
    im = Image.new("L", (S, S), 0); d = ImageDraw.Draw(im)
    for _ in range(9): x, y, r = rnd.uniform(8, 24), rnd.uniform(8, 24), rnd.uniform(4, 9 - f); d.ellipse([x - r, y - r, x + r, y + r], fill=rnd.randint(110, 200))
    im = im.filter(ImageFilter.GaussianBlur(2.5)); c = Image.new("RGBA", (S, S), (255, 255, 255, 0)); c.putalpha(im); put(8 + f, c)
im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); px = im.load()
for y in range(S):
    for x in range(S):
        r = math.hypot(x - 15.5, y - 15.5) / 15.5; a = 1 if r < 0.55 else max(0, 1 - (r - 0.55) / 0.45) ** 1.5
        px[x, y] = (255, 255, 255, int(255 * a * (0.75 if 0.35 < r < 0.55 else 1)))
put(12, im)
im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.line([(16, 0), (16, 31)], fill=(255, 255, 255, 255), width=3); d.line([(0, 16), (31, 16)], fill=(255, 255, 255, 255), width=3)
put(13, im.filter(ImageFilter.GaussianBlur(1)))
im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.ellipse([3, 3, 28, 28], outline=(255, 255, 255, 255), width=2)
for k in range(6): a = k * math.pi / 3; d.line([(16 + math.cos(a) * 6, 16 + math.sin(a) * 6), (16 + math.cos(a) * 12, 16 + math.sin(a) * 12)], fill=(255, 255, 255, 255), width=2)
put(14, im)
im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.line([(16, 2), (16, 29)], fill=(255, 255, 255, 255), width=2)
put(15, im.filter(ImageFilter.GaussianBlur(0.8)))
os.makedirs(os.path.join(RP, "textures/particle"), exist_ok=True)
AT.save(os.path.join(RP, "textures/particle/etheria_vfx.png"))

UV = lambda tile: {"texture_width": S * 8, "texture_height": S * 4, "uv": [f"({tile})*{S}" if isinstance(tile, str) and "%" not in tile else tile, 0], "uv_size": [S, S]}
def P(ident, comps, material="particles_blend"):
    return {"format_version": "1.10.0", "particle_effect": {"description": {"identifier": ident, "basic_render_parameters": {"material": material, "texture": "textures/particle/etheria_vfx"}}, "components": comps}}
base = lambda: {"minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_lifetime_once": {"active_time": 0.05},
                "minecraft:emitter_shape_point": {"direction": ["variable.dx", "variable.dy", "variable.dz"]},
                "minecraft:particle_lifetime_expression": {"max_lifetime": "variable.life"}, "minecraft:particle_initial_speed": "variable.spd",
                "minecraft:particle_motion_dynamic": {"linear_acceleration": ["variable.ax", "variable.ay", "variable.az"], "linear_drag_coefficient": "variable.drag"}}
fade = "variable.a * math.min(1, v.particle_age * 12) * (1 - math.pow(v.particle_age / v.particle_lifetime, 2))"
tint = {"minecraft:particle_appearance_tinting": {"color": ["variable.r", "variable.g", "variable.b", fade]}}
sz = "variable.size*(1+variable.grow*v.particle_age/v.particle_lifetime)"
def uvtile(expr_u, expr_v="0"): return {"texture_width": S * 8, "texture_height": S * 4, "uv": [f"({expr_u})*{S}", f"({expr_v})*{S}"], "uv_size": [S, S]}
FX = {
  # raio negro: troca de quadro a cada 1/20 s (tremeluz), alinhado à direção do raio
  "vfx_bolt": dict(base(), **{"minecraft:particle_appearance_billboard": {"size": ["variable.sx", "variable.sy"], "facing_camera_mode": "lookat_direction",
      "direction": {"mode": "custom", "custom_direction": ["variable.dx", "variable.dy", "variable.dz"]}, "uv": uvtile("math.mod(math.floor(v.particle_age * 20 + variable.seed), 4)")}}, **tint),
  "vfx_ember": dict(base(), **{"minecraft:particle_appearance_billboard": {"size": [sz, sz], "facing_camera_mode": "lookat_xyz", "uv": uvtile("4")},
      "minecraft:particle_motion_dynamic": {"linear_acceleration": ["variable.ax + math.sin(v.particle_age * 400) * 1.5", "variable.ay", "variable.az + math.cos(v.particle_age * 400) * 1.5"], "linear_drag_coefficient": "variable.drag"}}, **tint),
  "vfx_shard": dict(base(), **{"minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-540, 540)"},
      "minecraft:particle_appearance_billboard": {"size": [sz, sz], "facing_camera_mode": "rotate_xyz", "uv": uvtile("5")}}, **tint),
  "vfx_blade": dict(base(), **{"minecraft:particle_appearance_billboard": {"size": [sz, sz], "facing_camera_mode": "lookat_direction",
      "direction": {"mode": "custom", "custom_direction": ["variable.dx", "variable.dy", "variable.dz"]}, "uv": uvtile("6")}}, **tint),
  "vfx_wave": dict(base(), **{"minecraft:particle_appearance_billboard": {"size": [sz, sz], "facing_camera_mode": "emitter_transform_xz", "uv": uvtile("7")}}, **tint),
  "vfx_smoke": dict(base(), **{"minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-60, 60)"},
      "minecraft:particle_appearance_billboard": {"size": [sz, sz], "facing_camera_mode": "rotate_xyz", "uv": uvtile("math.min(3, math.floor(v.particle_age / v.particle_lifetime * 4))", "1")}}, **tint),
  "vfx_glow": dict(base(), **{"minecraft:particle_appearance_billboard": {"size": [sz, sz], "facing_camera_mode": "lookat_xyz", "uv": uvtile("4 + variable.tile", "1")}}, **tint),
}
for k, comps in FX.items():
    mat = "particles_alpha" if k == "vfx_smoke" else "particles_blend"
    json.dump(P(f"etheria:{k}", comps, mat), open(os.path.join(RP, f"particles/{k}.json"), "w"), indent=1)
print("ok", len(FX))

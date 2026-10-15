# 6.36 - Partículas com as TEXTURAS DO MOD Tensura (uso pessoal): quadros de animação viram uma tira vertical e uma partícula flipbook
# etheria:tx_<nome>, tingível pelas mesmas variáveis Molang de fxlib (r,g,b,a,size,life,...). Ampliadas 4x com suavização (sem pixel).
import json, os, sys, re
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SETS = {   # nome -> (pasta relativa a textures/, prefixo dos quadros, material)
  "black_lightning": ("particle", "black_lightning_spark_", "particles_blend"), "purple_lightning": ("particle", "dark_purple_lightning_spark_", "particles_blend"),
  "red_lightning": ("particle", "dark_red_lightning_spark_", "particles_blend"), "lightning": ("particle", "lightning_spark_", "particles_blend"),
  "fire": ("particle", "fire_particle_", "particles_blend"), "black_fire": ("particle", "black_fire_particle_", "particles_alpha"),
  "plasma": ("particle", "plasma_fire_particle_", "particles_blend"), "gust": ("particle", "gust_", "particles_alpha"), "heat": ("particle", "heat_particle_", "particles_blend"),
  "bubble_pop": ("particle", "bubble_pop_", "particles_alpha"), "hell_flare": ("entity/projectiles/hell_flare", "hell_flare_", "particles_blend"),
  "lightning_ball": ("entity/projectiles/lightning_sphere", "lightning_ball_", "particles_blend"), "fire_bolt": ("entity/projectiles/fire_bolt", "firebolt_", "particles_blend"),
}
SINGLE = {"magic_circle": ("fx/magic_circle.png", "particles_blend")}
def smooth(im, k):
    big = im.resize((im.width * k, im.height * k), Image.NEAREST)
    rgb = big.convert("RGB").filter(ImageFilter.GaussianBlur(k * 0.4)).filter(ImageFilter.UnsharpMask(radius=k, percent=70, threshold=2))
    a = big.split()[3].filter(ImageFilter.GaussianBlur(k * 0.4)); out = rgb.convert("RGBA"); out.putalpha(a); return out
def particle(ident, tex, n, fw, fh, mat, flat=False):
    uv = {"texture_width": fw, "texture_height": fh * n, "flipbook": {"base_UV": [0, 0], "size_UV": [fw, fh], "step_UV": [0, fh], "frames_per_second": "variable.fps", "max_frame": n, "stretch_to_lifetime": True, "loop": False}} if n > 1 else {"texture_width": fw, "texture_height": fh, "uv": [0, 0], "uv_size": [fw, fh]}
    sz = "variable.size*(1+variable.grow*v.particle_age/v.particle_lifetime)"
    return {"format_version": "1.10.0", "particle_effect": {"description": {"identifier": ident, "basic_render_parameters": {"material": mat, "texture": tex}}, "components": {
        "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"direction": ["variable.dx", "variable.dy", "variable.dz"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "variable.life"}, "minecraft:particle_initial_speed": "variable.spd",
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360) * (1 - variable.flat)", "rotation_rate": "0"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": ["variable.ax", "variable.ay", "variable.az"], "linear_drag_coefficient": "variable.drag"},
        "minecraft:particle_appearance_billboard": {"size": [sz, sz], "facing_camera_mode": "emitter_transform_xz" if flat else "rotate_xyz", "uv": uv},
        "minecraft:particle_appearance_tinting": {"color": ["variable.r", "variable.g", "variable.b", "variable.a * math.min(1, v.particle_age * 12) * (1 - math.pow(v.particle_age / v.particle_lifetime, 3))"]}}}}
def main(TA):
    out = os.path.join(RP, "textures/particle/tensura"); os.makedirs(out, exist_ok=True); made = []
    for name, (folder, pre, mat) in SETS.items():
        d = os.path.join(TA, "textures", folder)
        fr = sorted([f for f in os.listdir(d) if f.startswith(pre) and re.fullmatch(re.escape(pre) + r"\d+\.png", f)], key=lambda f: int(re.findall(r"(\d+)\.png", f)[0]))
        if not fr: continue
        ims = [Image.open(os.path.join(d, f)).convert("RGBA") for f in fr]; w, h = ims[0].size
        k = max(1, min(8, 64 // max(w, h)))
        strip = Image.new("RGBA", (w * k, h * k * len(ims)), (0, 0, 0, 0))
        for i, im in enumerate(ims): strip.alpha_composite(smooth(im.resize((w, h)), k), (0, i * h * k))
        strip.save(os.path.join(out, name + ".png"), optimize=True)
        json.dump(particle(f"etheria:tx_{name}", f"textures/particle/tensura/{name}", len(ims), w * k, h * k, mat), open(os.path.join(RP, f"particles/tx_{name}.json"), "w"), indent=1)
        made.append(f"{name}({len(ims)} quadros {w}px->{w*k}px)")
    for name, (rel, mat) in SINGLE.items():
        im = Image.open(os.path.join(TA, "textures", rel)).convert("RGBA"); k = max(1, min(4, 256 // im.width))
        smooth(im, k).save(os.path.join(out, name + ".png"), optimize=True)
        json.dump(particle(f"etheria:tx_{name}", f"textures/particle/tensura/{name}", 1, im.width * k, im.height * k, mat, flat=True), open(os.path.join(RP, f"particles/tx_{name}.json"), "w"), indent=1)
        made.append(f"{name}({im.width}px->{im.width*k}px)")
    print(len(made), "partículas:", ", ".join(made))
if __name__ == "__main__": main(sys.argv[1])

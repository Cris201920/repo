# 6.65 - MAGIAS EM 3D como no mod Tensura: entidades de efeito com MODELO próprio e TEXTURA ANIMADA do mod (uso pessoal; texturas fora do git).
# Formatos (medidos nas texturas do mod, mesmo layout "embrulhado" do Minecraft):
#   shell  esfera = núcleo 12x12x12 (uv 0,28) + casca transparente 14x14x14 (uv 0,0), girando em sentidos opostos  (64x64)
#   ball   bola   = núcleo 6x6x6 (uv 0,32) + chama/rastro em dois planos cruzados (sprite 24x16)                    (48x44)
#   core   núcleo grande 12x12x12 (uv 0,64)                                                                     (96x88)
#   blade  lâmina = placa deitada 32x16 com a meia-lua                                                           (128x64)
# Animação: quadros empilhados numa tira vertical + uv_anim no render controller (12 quadros/s). Escala pela propriedade etheria:sz
# (o script cresce a cúpula até o raio REAL do dano). Brilho total (material emissivo). Sem IA, sem colisão, some sozinha (timer).
# Uso: python3 tools/spell_models.py <assets/tensura do jar>
import json, os, sys, glob
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
P = os.path.join(sys.argv[1], "textures/entity/projectiles") if len(sys.argv) > 1 else None
V = {   # nome: (formato, fonte: pasta com quadros ou arquivo único)
  "hell_flare": ("shell", "hell_flare"), "flame_orb": ("shell", "flame_orb"), "gravity_sphere": ("shell", "gravity_sphere"),
  "lightning_sphere": ("shell", "lightning_sphere"), "yellow_lightning": ("shell", "lightning_ball"), "solar_grenade": ("shell", "solar_grenade"),
  "heat_sphere": ("shell", "heat_sphere"), "wind_sphere": ("shell", "wind_sphere"),
  "aura_blue": ("shell", "aura_bullet/blue_aura_bullet.png"), "aura_purple": ("shell", "aura_bullet/purple_aura_bullet.png"),
  "aura_red": ("shell", "aura_bullet/red_aura_bullet.png"), "aura_yellow": ("shell", "aura_bullet/yellow_aura_bullet.png"), "aura_pink": ("shell", "aura_bullet/pink_aura_bullet.png"),
  "fire_ball": ("ball", "fire_ball"), "black_fire_ball": ("ball", "black_fire_ball"), "plasma_ball": ("ball", "plasma_ball"), "fire_bolt": ("ball", "fire_bolt"),
  "acid_ball": ("ball", "acid_ball.png"), "poison_ball": ("ball", "poison_ball.png"), "water_ball": ("ball", "water_ball.png"), "chaos_eater": ("ball", "chaos_eater.png"),
  "frost_ball": ("core", "frost_ball.png"), "mud_shot": ("core", "mud_shot.png"),
  "wind_blade": ("blade", "wind_blade"), "water_blade": ("blade", "water_blade"), "poison_blade": ("blade", "poison_blade"), "dimension_cut": ("blade", "dimension_cut"),
  "aura_slash": ("blade", "aura_slash.png"), "space_cut": ("blade", "space_cut.png"),
}
SIZE = {"shell": (64, 64), "ball": (48, 44), "core": (96, 88), "blade": (128, 64)}
def face(u, v, w, h): return {k: {"uv": [u, v], "uv_size": [w, h]} for k in ("north", "south", "east", "west", "up", "down")}
GEO = {
  "shell": [{"name": "root", "pivot": [0, 0, 0]},
            {"name": "core", "parent": "root", "pivot": [0, 0, 0], "cubes": [{"origin": [-6, -6, -6], "size": [12, 12, 12], "uv": [0, 28]}]},
            {"name": "shell", "parent": "root", "pivot": [0, 0, 0], "cubes": [{"origin": [-7, -7, -7], "size": [14, 14, 14], "uv": [0, 0]}]}],
  "ball": [{"name": "root", "pivot": [0, 0, 0]},
           {"name": "core", "parent": "root", "pivot": [0, 0, 0], "cubes": [{"origin": [-3, -3, -3], "size": [6, 6, 6], "uv": [0, 32]}]},
           {"name": "trail", "parent": "root", "pivot": [0, 0, 0], "cubes": [
               {"origin": [0, -8, -4], "size": [0, 16, 24], "uv": face(0, 0, 24, 16)},
               {"origin": [0, -8, -4], "size": [0, 16, 24], "uv": face(24, 16, 24, 16), "pivot": [0, 0, 0], "rotation": [0, 0, 90]}]}],
  "core": [{"name": "root", "pivot": [0, 0, 0]},
           {"name": "core", "parent": "root", "pivot": [0, 0, 0], "cubes": [{"origin": [-6, -6, -6], "size": [12, 12, 12], "uv": [0, 64]}]}],
  "blade": [{"name": "root", "pivot": [0, 0, 0]},
            {"name": "blade", "parent": "root", "pivot": [0, 0, 0], "cubes": [{"origin": [-16, 0, -8], "size": [32, 0, 16], "uv": face(0, 0, 128, 64)}]}],
}
ANIM = {"format_version": "1.8.0", "animations": {"animation.etheria.vfx.live": {"loop": True, "bones": {
  "root": {"scale": ["query.property('etheria:sz') * (1 + 0.05 * math.sin(query.life_time * 1100))"] * 3},
  "core": {"rotation": ["query.life_time * 140", "query.life_time * 210", 0]},
  "shell": {"rotation": [0, "-query.life_time * 120", "query.life_time * 70"]}}}}}
RC = {"format_version": "1.8.0", "render_controllers": {"controller.render.etheria_vfx": {
  "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"],
  "uv_anim": {"offset": [0.0, "math.floor(math.mod(query.life_time * 12, variable.n)) / variable.n"], "scale": [1.0, "1.0 / variable.n"]}}}}

def frames(src):
    p = os.path.join(P, src)
    if os.path.isdir(p): return [Image.open(f).convert("RGBA") for f in sorted(glob.glob(p + "/*.png"), key=lambda s: int(''.join(c for c in os.path.basename(s) if c.isdigit()) or 0))]
    return [Image.open(p).convert("RGBA")]
def main():
    os.makedirs(os.path.join(RP, "textures/entity/spell"), exist_ok=True)
    for d in ("models/entity", "entity", "animations", "render_controllers"): os.makedirs(os.path.join(RP, d), exist_ok=True)
    os.makedirs(os.path.join(BP, "entities"), exist_ok=True)
    for kind, bones in GEO.items():
        w, h = SIZE[kind]
        json.dump({"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": f"geometry.etheria_vfx_{kind}", "texture_width": w, "texture_height": h,
            "visible_bounds_width": 8, "visible_bounds_height": 8, "visible_bounds_offset": [0, 0, 0]}, "bones": bones}]},
            open(os.path.join(RP, f"models/entity/etheria_vfx_{kind}.geo.json"), "w"), indent=1)
    json.dump(ANIM, open(os.path.join(RP, "animations/etheria_vfx.animation.json"), "w"), indent=1)
    json.dump(RC, open(os.path.join(RP, "render_controllers/etheria_vfx.render_controllers.json"), "w"), indent=1)
    out = {}
    for name, (kind, src) in V.items():
        n = 1
        if P:
            fr = frames(src); w, h = SIZE[kind]; n = len(fr)
            strip = Image.new("RGBA", (w, h * n), (0, 0, 0, 0))
            for i, im in enumerate(fr): strip.paste(im.crop((0, 0, w, h)), (0, h * i))
            strip.save(os.path.join(RP, f"textures/entity/spell/{name}.png"))
        else:
            tp = os.path.join(RP, f"textures/entity/spell/{name}.png")
            if os.path.exists(tp): n = Image.open(tp).height // SIZE[kind][1]
        ident = f"etheria:vfx_{name}"; out[name] = {"kind": kind, "frames": n}
        json.dump({"format_version": "1.10.0", "minecraft:client_entity": {"description": {
            "identifier": ident, "materials": {"default": "entity_emissive_alpha"}, "textures": {"default": f"textures/entity/spell/{name}"},
            "geometry": {"default": f"geometry.etheria_vfx_{kind}"}, "render_controllers": ["controller.render.etheria_vfx"],
            "animations": {"live": "animation.etheria.vfx.live"},
            "scripts": {"initialize": [f"variable.n = {n};"], "animate": ["live"]}}}}, open(os.path.join(RP, f"entity/vfx_{name}.entity.json"), "w"), indent=1)
        json.dump({"format_version": "1.21.0", "minecraft:entity": {
            "description": {"identifier": ident, "is_spawnable": False, "is_summonable": True,
                "properties": {"etheria:sz": {"type": "float", "range": [0.0, 64.0], "default": 1.0, "client_sync": True}}},
            "component_groups": {"etheria:vfx_gone": {"minecraft:instant_despawn": {}}},
            "components": {
                "minecraft:collision_box": {"width": 0.01, "height": 0.01},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:damage_sensor": {"triggers": {"cause": "all", "deals_damage": "no"}},
                "minecraft:health": {"value": 1, "max": 1},
                "minecraft:fire_immune": True,
                "minecraft:knockback_resistance": {"value": 1},
                "minecraft:type_family": {"family": ["etheria_vfx", "inanimate"]},
                "minecraft:timer": {"looping": False, "time": 6, "time_down_event": {"event": "etheria:vfx_end"}}},
            "events": {"etheria:vfx_end": {"add": {"component_groups": ["etheria:vfx_gone"]}}}}},
            open(os.path.join(BP, f"entities/vfx_{name}.json"), "w"), indent=1)
    js = "// gerado por tools/spell_models.py: visuais 3D das magias (formato e número de quadros)\nexport const VFX = " + json.dumps(out) + ";\n"
    open(os.path.join(BP, "scripts/data/spellvfx.gen.js"), "w").write(js)
    print("visuais:", len(out))
if __name__ == "__main__": main()

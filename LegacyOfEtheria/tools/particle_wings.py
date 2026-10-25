"""9.5 - ASAS DE PARTÍCULAS (Demônio, Lord Demônio, Anjo Caído e mobs Anjo Caído / Pico / Garasha).
As asas desses corpos deixam de ser cubos: são desenhadas por partículas em script (BP scripts/systems/particlewings.js).
Este gerador (idempotente) faz a parte do Resource Pack:
  1) esvazia os ossos de asa (wing* / mw_wing*) das geometrias da raça e do mob: os ossos ficam (as animações antigas continuam
     válidas, sem avisos de osso ausente), só os cubos saem. Chifres, cauda, coroa, ombreiras e corpo ficam intactos.
  2) gera a textura do traço de pena (textures/particle/etheria_wingfx.png, 64x64 = 4 colunas de 16x64) e a partícula
     etheria:wingline (billboard alongado na direção base->ponta, sem movimento, sem laço, vida curta) em particles/wingline.json.
Ordem do pipeline: demon_wings.py -> mob_flight.py -> particle_wings.py (este por último; ele sempre remove os cubos de asa).
tools/demon_feather_wings.py (asas de penas em cubos da 8.17) foi aposentado: só roda com --force.
Uso: python3 tools/particle_wings.py"""
import json, os, re, math
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
MODELS = ["demon", "demon_lord", "fallen", "fallen_dl", "fallen_lord", "fallen_lord_lord"]
WING = re.compile(r"^(mw_)?(wing|dfw)")

def strip(path):
    D = json.load(open(path)); n = 0
    for G in D["minecraft:geometry"]:
        for b in G["bones"]:
            if WING.match(b["name"]) and b.get("cubes"): n += len(b["cubes"]); b["cubes"] = []
    json.dump(D, open(path, "w"), separators=(",", ":"))
    return n

def texture(path):
    # 4 colunas 16x64: 0 lâmina em fuso (preta, pontas finas) · 1 fuso largo e macio (borrão) · 2 fio fino · 3 brasa alongada (vermelho)
    W, H = 64, 64; im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); px = im.load()
    def spindle(col, maxw, core, soft, power=1.0):
        for y in range(H):
            v = (y + 0.5) / H; prof = math.sin(math.pi * v) ** power      # fuso simétrico: a orientação da textura não importa
            hw = maxw * prof
            for x in range(16):
                d = abs((x + 0.5) - 8) / 8
                if hw <= 0.02: continue
                a = max(0.0, 1 - (d / hw) ** soft) if d < hw else 0.0
                a = a * (0.55 + 0.45 * prof)
                if a <= 0: continue
                px[col * 16 + x, y] = (255, 255, 255, min(255, int(255 * a * core)))
    spindle(0, 0.62, 1.0, 3.0, 0.8)
    spindle(1, 0.95, 0.75, 1.6, 0.6)
    spindle(2, 0.30, 1.0, 4.0, 0.5)
    spindle(3, 0.55, 1.0, 1.8, 1.2)
    im.save(path)

PARTICLE = {"format_version": "1.10.0", "particle_effect": {
    "description": {"identifier": "etheria:wingline", "basic_render_parameters": {"material": "particles_blend", "texture": "textures/particle/etheria_wingfx"}},
    "components": {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0], "direction": ["variable.dx", "variable.dy", "variable.dz"]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "variable.life"},
        "minecraft:particle_appearance_billboard": {
            "size": ["variable.sx * (1 - 0.35 * v.particle_age / v.particle_lifetime)", "variable.sy"],
            "facing_camera_mode": "lookat_direction",
            "direction": {"mode": "custom", "custom_direction": ["variable.dx", "variable.dy", "variable.dz"]},
            "uv": {"texture_width": 64, "texture_height": 64, "uv": ["variable.tu*16", 0], "uv_size": [16, 64]}},
        "minecraft:particle_appearance_tinting": {"color": ["variable.r", "variable.g", "variable.b",
            "variable.a * math.min(1, v.particle_age * 14) * (1 - math.pow(v.particle_age / v.particle_lifetime, 3))"]}}}}

def main():
    tot = 0
    for m in MODELS: tot += strip(os.path.join(RP, f"models/entity/etheria_race_{m}.geo.json"))
    tot += strip(os.path.join(RP, "models/entity/etheria_mobwing_fallen.geo.json"))
    texture(os.path.join(RP, "textures/particle/etheria_wingfx.png"))
    json.dump(PARTICLE, open(os.path.join(RP, "particles/wingline.json"), "w"), indent=1)
    print(f"cubos de asa removidos: {tot}; partícula etheria:wingline + textura etheria_wingfx.png")

if __name__ == "__main__":
    main()

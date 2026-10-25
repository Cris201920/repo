"""9.5 - ASAS DE PARTÍCULAS (Demônio, Lord Demônio, Anjo Caído e mobs Anjo Caído / Pico / Garasha).
As asas desses corpos deixam de ser cubos: são desenhadas por partículas em script (BP scripts/systems/particlewings.js).
Este gerador (idempotente) faz a parte do Resource Pack:
  1) esvazia os ossos de asa (wing* / mw_wing*) das geometrias da raça e do mob: os ossos ficam (as animações antigas continuam
     válidas, sem avisos de osso ausente), só os cubos saem. Chifres, cauda, coroa, ombreiras e corpo ficam intactos.
  2) gera a textura do traço de pena (textures/particle/etheria_wingfx.png, 64x64 = 4 colunas de 16x64) e a partícula
     etheria:wingline (billboard alongado na direção base->ponta, sem movimento, sem laço, vida curta) em particles/wingline.json.
Ordem do pipeline: demon_wings.py -> mob_flight.py -> particle_wings.py (este por último; ele sempre remove os cubos de asa).
tools/demon_feather_wings.py (asas de penas em cubos da 8.17) foi aposentado: só roda com --force.
9.6: etheria:wingfan (UMA chamada solta o leque inteiro das duas asas: 20-160 riscos) e etheria:wingsmoke (baforadas + fagulhas).
Uso: python3 tools/particle_wings.py"""
import json, os, re, math, random
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
    # 4 colunas 16x64: 0 PINCELADA (fuso com fibras de comprimentos diferentes -> pontas serrilhadas, "pincel") · 1 fuso largo e macio (borrão)
    # 2 fio fino · 3 brasa alongada (vermelho). Ruído com semente fixa: o arquivo sai igual a cada execução.
    W, H = 64, 64; im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); px = im.load()
    rnd = random.Random(96)
    def spindle(col, maxw, core, soft, power=1.0, fibers=False):
        cut = [(rnd.uniform(0.0, 0.22), rnd.uniform(0.0, 0.22), rnd.uniform(0.7, 1.0)) for _ in range(16)]   # fibra: corte em cima/embaixo, opacidade
        for y in range(H):
            v = (y + 0.5) / H; prof = math.sin(math.pi * v) ** power      # fuso simétrico: a orientação da textura não importa
            hw = maxw * prof
            for x in range(16):
                d = abs((x + 0.5) - 8) / 8
                if hw <= 0.02: continue
                a = max(0.0, 1 - (d / hw) ** soft) if d < hw else 0.0
                a = a * (0.55 + 0.45 * prof)
                if fibers:
                    c0, c1, op = cut[x]
                    if v < c0 or v > 1 - c1: a *= 0.0
                    a *= op
                if a <= 0: continue
                px[col * 16 + x, y] = (255, 255, 255, min(255, int(255 * a * core)))
    spindle(0, 0.95, 1.0, 5.0, 0.38, fibers=True)
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

# ---------------------------------------------------------------- 9.6: LEQUE EM UMA CHAMADA (etheria:wingfan) e FUMAÇA (etheria:wingsmoke)
# O script manda UMA chamada por corpo (as duas asas): emitter_rate_instant solta variable.count riscos; cada risco escolhe pelo
# variable.particle_random_1..4 o ângulo no leque (r1), o comprimento (r2), o lado/largura (r3) e o tipo (r4: base vermelha / cobertura curta e
# grossa / pena / borrão largo). Posição = ombro do lado + direção da pena * (meio comprimento) + deriva * idade (particle_motion_parametric).
# Vetores no MUNDO calculados pelo script (sem trigonometria de yaw no Molang): ux/uz = para fora com a varredura para trás, por lado;
# tx/tz = inclinação para trás; ângulos em graus (math.sin/cos do Molang usam graus). Só componentes/funções já usados no projeto e no vanilla.
R1, R2, R3, R4 = (f"v.particle_random_{i}" for i in (1, 2, 3, 4))
SIDE = lambda a, b: f"({R3}<0.5?{a}:{b})"
TH = f"(v.lo+v.dh*{R1}+v.amp*math.sin(v.ph-v.lag*{R1}))"
DX = f"(math.cos({TH})*{SIDE('v.ux1', 'v.ux2')}+v.tx)"
DY = f"math.sin({TH})"
DZ = f"(math.cos({TH})*{SIDE('v.uz1', 'v.uz2')}+v.tz)"
KL = f"({R4}<v.red?(0.3+0.25*{R2}):({R4}<v.red+v.cov?0.55:1))"
LEN = f"(v.len*(1-v.lp+v.lp*math.pow({R1},0.6))*(0.72+0.56*{R2})*{KL})"
WR = f"({R3}<0.5?{R3}*2:{R3}*2-1)"
ROOT = f"(v.arm*{R1}*(0.75+0.25*{R2}))"   # raiz da pena ao longo do "braço" da asa (vetor a1/a2 por lado): penas de dentro no ombro, de fora na ponta
KW = f"({R4}<v.red?0.75:({R4}>1-v.blur?2.2:({R4}<v.red+v.cov?1.8:1)))"
AGE = "(v.particle_age/v.particle_lifetime)"
COLOR = lambda c: f"({R4}<v.red?v.b{c}:v.l{c}+(v.v{c}-v.l{c})*{R1}*{R2})"
FAN = {"format_version": "1.10.0", "particle_effect": {
    "description": {"identifier": "etheria:wingfan", "basic_render_parameters": {"material": "particles_blend", "texture": "textures/particle/etheria_wingfx"}},
    "components": {
        "minecraft:emitter_rate_instant": {"num_particles": "math.clamp(variable.count, 1, 200)"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "variable.life"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"{SIDE('v.ox1', 'v.ox2')}+{SIDE('v.ax1', 'v.ax2')}*{ROOT}+{DX}*(0.08+{LEN}*0.5)+v.dvx*v.particle_age",
            f"{SIDE('v.ay1', 'v.ay2')}*{ROOT}+{DY}*(0.08+{LEN}*0.5)+v.dvy*v.particle_age",
            f"{SIDE('v.oz1', 'v.oz2')}+{SIDE('v.az1', 'v.az2')}*{ROOT}+{DZ}*(0.08+{LEN}*0.5)+v.dvz*v.particle_age"]},
        "minecraft:particle_appearance_billboard": {
            "size": [f"v.w*(0.6+0.8*{WR})*{KW}*(1-0.3*{AGE})", f"{LEN}*0.5"],
            "facing_camera_mode": "lookat_direction",
            "direction": {"mode": "custom", "custom_direction": [DX, DY, DZ]},
            "uv": {"texture_width": 64, "texture_height": 64, "uv": [f"({R4}<v.red?48:({R4}>1-v.blur?16:0))", 0], "uv_size": [16, 64]}},
        "minecraft:particle_appearance_tinting": {"color": [COLOR("r"), COLOR("g"), COLOR("b"),
            f"v.a*({R4}>1-v.blur?0.4:1)*math.min(1,v.particle_age*14)*(1-math.pow({AGE},3))"]}}}}
THS = f"(v.lo+v.dh*{R1})"
SDX = f"(math.cos({THS})*{SIDE('v.ux1', 'v.ux2')}+v.tx)"
SDZ = f"(math.cos({THS})*{SIDE('v.uz1', 'v.uz2')}+v.tz)"
SDIST = f"(v.len*(0.25+0.75*{R2}))"
EASE = "(v.particle_age*(1-0.3*v.particle_age))"
SPK = f"({R4}<v.spk)"
SMOKE = {"format_version": "1.10.0", "particle_effect": {
    "description": {"identifier": "etheria:wingsmoke", "basic_render_parameters": {"material": "particles_blend", "texture": "textures/particle/etheria_atlas"}},
    "components": {
        "minecraft:emitter_rate_instant": {"num_particles": "math.clamp(variable.count, 1, 80)"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "variable.life"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"{SIDE('v.ox1', 'v.ox2')}+{SDX}*{SDIST}+({SDX}*v.spd*(0.4+0.6*{R2})+v.dvx)*{EASE}",
            f"math.sin({THS})*{SDIST}+(math.sin({THS})*v.spd*(0.4+0.6*{R2})+v.dvy+({SPK}?1.2:0))*{EASE}",
            f"{SIDE('v.oz1', 'v.oz2')}+{SDZ}*{SDIST}+({SDZ}*v.spd*(0.4+0.6*{R2})+v.dvz)*{EASE}"]},
        "minecraft:particle_appearance_billboard": {
            "size": [f"({SPK}?0.05+0.04*{R2}:v.sz*(0.6+0.8*{WR})*(0.7+0.9*{AGE}))"] * 2,
            "facing_camera_mode": "lookat_xyz",
            "uv": {"texture_width": 128, "texture_height": 128, "uv": [f"({SPK}?32:({R3}<0.5?16:96))", f"({SPK}?16:({R3}<0.5?16:48))"], "uv_size": [16, 16]}},
        "minecraft:particle_appearance_tinting": {"color": [f"({SPK}?v.gr:v.cr)", f"({SPK}?v.gg:v.cg)", f"({SPK}?v.gb:v.cb)",
            f"({SPK}?1-{AGE}:v.a*math.min(1,v.particle_age*10)*(1-math.pow({AGE},2)))"]}}}}

def main():
    tot = 0
    for m in MODELS: tot += strip(os.path.join(RP, f"models/entity/etheria_race_{m}.geo.json"))
    tot += strip(os.path.join(RP, "models/entity/etheria_mobwing_fallen.geo.json"))
    texture(os.path.join(RP, "textures/particle/etheria_wingfx.png"))
    json.dump(PARTICLE, open(os.path.join(RP, "particles/wingline.json"), "w"), indent=1)
    json.dump(FAN, open(os.path.join(RP, "particles/wingfan.json"), "w"), indent=1)
    json.dump(SMOKE, open(os.path.join(RP, "particles/wingsmoke.json"), "w"), indent=1)
    print(f"cubos de asa removidos: {tot}; partículas etheria:wingline / wingfan / wingsmoke + textura etheria_wingfx.png")

if __name__ == "__main__":
    main()

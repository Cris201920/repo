# 6.58b - ANIMAÇÕES DE AÇÃO DO JOGADOR por anatomia (soma-se às posturas de tools/race_styles.py e às animações normais do jogo).
# Estilo = propriedade etheria:rstyle (none = humano). Só em 3ª pessoa, fora da forma de dragão e sem montaria.
#   pulo (subindo) · queda (braços abertos para equilibrar) · pouso (agacha e absorve, reinicia a cada pouso)
#   VOO (propriedade etheria:fly do script de voo): pairar (pernas balançando), subir (tronco para trás), planar (tronco deitado para a frente,
#   pernas esticadas, braços para trás; bestial com braços à frente; leve/angelical com braços abertos), descer (pernas à frente)
#   ataque corpo a corpo (golpe próprio de cada anatomia: pesado gira o tronco, bestial dá bote com garra, dracônico torce, leve estoca rápido,
#   demoníaco corta largo, slime se lança, morto-vivo avança rígido, goblin estoca baixo) · dano (recuo proporcional ao peso) · morte
# Golpe, dano e pouso são CONTROLADORES (esperar -> tocar -> esperar): reiniciam a cada uso e nunca ficam presos.
# Uso: python3 tools/race_actions.py   (idempotente)
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
STY = ["none", "heavy", "beast", "draconic", "light", "demonic", "slime", "undead", "goblin"]
BASE = "!variable.is_first_person && variable.etheria_dragon == 0.0 && !query.is_riding"
PROP = lambda s: f"query.property('etheria:rstyle') == '{s}'"
FLY = "query.property('etheria:fly')"
T = "query.life_time"
def k(*frames):   # {"0.0": [..], ...}
    return {f"{t}": v for t, v in frames}

# ------------------------------------------------------------- poses contínuas (comuns a todos, com ajustes por anatomia)
def air_rise(s):
    tuck = {"heavy": 10, "beast": 28, "slime": 0, "undead": 6}.get(s, 18)
    return {"loop": True, "bones": {"rightLeg": {"rotation": [-tuck, 0, 2]}, "leftLeg": {"rotation": [-tuck * 0.4, 0, -2]},
        "rightArm": {"rotation": [-20, 0, 12]}, "leftArm": {"rotation": [-20, 0, -12]}, "body": {"rotation": [-4 if s != "beast" else 10, 0, 0]}}}
def air_fall(s):
    spread = {"heavy": 22, "light": 40, "slime": 30, "undead": 10}.get(s, 32)
    return {"loop": True, "bones": {"rightArm": {"rotation": [f"-30 + 6 * math.sin({T} * 400)", 0, spread]}, "leftArm": {"rotation": [f"-30 + 6 * math.sin({T} * 400 + 90)", 0, -spread]},
        "rightLeg": {"rotation": [f"-10 + 8 * math.sin({T} * 300)", 0, 6]}, "leftLeg": {"rotation": [f"6 - 8 * math.sin({T} * 300)", 0, -6]}, "body": {"rotation": [-6, 0, 0]}, "head": {"rotation": [8, 0, 0]}}}
def fly_hover(s):
    return {"loop": True, "bones": {"rightLeg": {"rotation": [f"8 * math.sin({T} * 120)", 0, 3]}, "leftLeg": {"rotation": [f"-8 * math.sin({T} * 120)", 0, -3]},
        "rightArm": {"rotation": [-10, 0, 18 if s == "light" else 10]}, "leftArm": {"rotation": [-10, 0, -18 if s == "light" else -10]},
        "root": {"position": [0, f"0.6 * math.sin({T} * 160)", 0]}}}
def fly_climb(s):
    return {"loop": True, "bones": {"waist": {"rotation": [-10, 0, 0]}, "head": {"rotation": [-12, 0, 0]}, "rightLeg": {"rotation": [-14, 0, 2]}, "leftLeg": {"rotation": [-6, 0, -2]},
        "rightArm": {"rotation": [22, 0, 14]}, "leftArm": {"rotation": [22, 0, -14]}}}
def fly_glide(s):
    arms = {"beast": [-160, 0, 8], "light": [10, 0, 55], "heavy": [30, 0, 18]}.get(s, [35, 0, 12])
    return {"loop": True, "bones": {"waist": {"rotation": [48, f"-6 * math.clamp(query.yaw_speed / 240, -1, 1)", f"-14 * math.clamp(query.yaw_speed / 240, -1, 1)"]},
        "head": {"rotation": [-42, 0, 0]}, "rightLeg": {"rotation": [f"40 + 4 * math.sin({T} * 200)", 0, 3]}, "leftLeg": {"rotation": [f"40 - 4 * math.sin({T} * 200)", 0, -3]},
        "rightArm": {"rotation": arms}, "leftArm": {"rotation": [arms[0], 0, -arms[2]]}}}
def fly_desc(s):
    return {"loop": True, "bones": {"waist": {"rotation": [6, 0, 0]}, "rightLeg": {"rotation": [-18, 0, 4]}, "leftLeg": {"rotation": [-12, 0, -4]},
        "rightArm": {"rotation": [-24, 0, 26]}, "leftArm": {"rotation": [-24, 0, -26]}}}

# ------------------------------------------------------------- golpes (0,45 s; preparação -> impacto -> volta)
ATK = {
  "none":     {"body": [[0, 0, 0], [0, 16, 0], [4, -20, 0], [0, 0, 0]], "leftArm": [[0, 0, 0], [-10, 0, -10], [14, 0, -4], [0, 0, 0]]},
  "heavy":    {"body": [[0, 0, 0], [-6, 30, 0], [10, -34, 0], [0, 0, 0]], "leftArm": [[0, 0, 0], [-30, 0, -20], [10, 0, -8], [0, 0, 0]], "rightLeg": [[0, 0, 0], [0, 0, 6], [-12, 0, 8], [0, 0, 0]], "leftLeg": [[0, 0, 0], [0, 0, -6], [10, 0, -8], [0, 0, 0]]},
  "beast":    {"body": [[0, 0, 0], [-8, 10, 0], [22, -10, 0], [0, 0, 0]], "leftArm": [[0, 0, 0], [-120, 0, -20], [10, 0, 10], [0, 0, 0]], "rightLeg": [[0, 0, 0], [10, 0, 0], [-24, 0, 0], [0, 0, 0]]},
  "draconic": {"body": [[0, 0, 0], [0, 24, 0], [6, -28, 0], [0, 0, 0]], "head": [[0, 0, 0], [0, -10, 0], [6, 12, 0], [0, 0, 0]], "leftArm": [[0, 0, 0], [-20, 0, -16], [16, 0, -6], [0, 0, 0]]},
  "light":    {"body": [[0, 0, 0], [0, 10, 0], [6, -12, 0], [0, 0, 0]], "rightLeg": [[0, 0, 0], [0, 0, 0], [-16, 0, 0], [0, 0, 0]], "leftArm": [[0, 0, 0], [-8, 0, -24], [4, 0, -30], [0, 0, 0]]},
  "demonic":  {"body": [[0, 0, 0], [-4, 36, 0], [12, -40, 0], [0, 0, 0]], "head": [[0, 0, 0], [6, -14, 0], [10, 16, 0], [0, 0, 0]], "leftArm": [[0, 0, 0], [-40, 0, -40], [20, 0, -10], [0, 0, 0]]},
  "slime":    {"body": [[0, 0, 0], [-10, 0, 0], [26, 0, 0], [0, 0, 0]], "root": [[0, 0, 0], [0, -1, -1], [0, 0.5, 2.5], [0, 0, 0]]},
  "undead":   {"body": [[0, 0, 0], [-4, 6, 0], [14, -6, 0], [0, 0, 0]], "leftArm": [[0, 0, 0], [-70, 0, -6], [-80, 0, -2], [0, 0, 0]], "head": [[0, 0, 0], [0, 0, 8], [10, 0, 12], [0, 0, 0]]},
  "goblin":   {"body": [[0, 0, 0], [6, 14, 0], [24, -12, 0], [0, 0, 0]], "rightLeg": [[0, 0, 0], [-14, 0, 0], [-24, 0, 0], [0, 0, 0]], "leftLeg": [[0, 0, 0], [10, 0, 0], [16, 0, 0], [0, 0, 0]]},
}
def attack(s):
    bones = {}
    for b, fr in ATK[s].items():
        key = "position" if b == "root" else "rotation"
        bones[b] = {key: k((0.0, fr[0]), (0.14, fr[1]), (0.26, fr[2]), (0.45, fr[3]))}
    return {"loop": False, "animation_length": 0.45, "bones": bones}
def hurt(s):
    a = {"heavy": 0.5, "slime": 0.8, "light": 1.3, "undead": 0.4}.get(s, 1.0)
    return {"loop": False, "animation_length": 0.35, "bones": {
        "waist": {"rotation": k((0.0, [0, 0, 0]), (0.07, [-12 * a, 0, 4 * a]), (0.35, [0, 0, 0]))}, "head": {"rotation": k((0.0, [0, 0, 0]), (0.07, [-16 * a, 0, -6 * a]), (0.35, [0, 0, 0]))},
        "rightArm": {"rotation": k((0.0, [0, 0, 0]), (0.07, [-20 * a, 0, 16 * a]), (0.35, [0, 0, 0]))}, "leftArm": {"rotation": k((0.0, [0, 0, 0]), (0.07, [-20 * a, 0, -16 * a]), (0.35, [0, 0, 0]))}}}
def land(s):
    d = {"heavy": 1.4, "slime": 1.8, "light": 0.6}.get(s, 1.0)
    return {"loop": False, "animation_length": 0.4, "bones": {
        "root": {"position": k((0.0, [0, 0, 0]), (0.08, [0, -1.6 * d, 0]), (0.4, [0, 0, 0]))}, "waist": {"rotation": k((0.0, [0, 0, 0]), (0.08, [14 * d, 0, 0]), (0.4, [0, 0, 0]))},
        "rightLeg": {"rotation": k((0.0, [0, 0, 0]), (0.08, [-22 * d, 0, 6]), (0.4, [0, 0, 0]))}, "leftLeg": {"rotation": k((0.0, [0, 0, 0]), (0.08, [-22 * d, 0, -6]), (0.4, [0, 0, 0]))},
        "rightArm": {"rotation": k((0.0, [0, 0, 0]), (0.08, [-14, 0, 22]), (0.4, [0, 0, 0]))}, "leftArm": {"rotation": k((0.0, [0, 0, 0]), (0.08, [-14, 0, -22]), (0.4, [0, 0, 0]))}}}
def death(s):
    return {"loop": "hold_on_last_frame", "animation_length": 0.8, "bones": {
        "waist": {"rotation": k((0.0, [0, 0, 0]), (0.3, [-18, 0, 8]), (0.8, [-10, 0, 14]))}, "head": {"rotation": k((0.0, [0, 0, 0]), (0.3, [-20, 0, 0]), (0.8, [10, 12, 0]))},
        "rightArm": {"rotation": k((0.0, [0, 0, 0]), (0.3, [-40, 0, 40]), (0.8, [-10, 0, 60]))}, "leftArm": {"rotation": k((0.0, [0, 0, 0]), (0.3, [-40, 0, -40]), (0.8, [-10, 0, -60]))}}}

CONT = {"rise": (air_rise, f"!query.is_on_ground && !query.is_in_water && query.vertical_speed > 0.2 && {FLY} == 0"),
        "fall": (air_fall, f"!query.is_on_ground && !query.is_in_water && query.vertical_speed < -0.4 && {FLY} == 0 && !query.is_gliding"),
        "hover": (fly_hover, f"{FLY} == 1"), "climb": (fly_climb, f"{FLY} == 2"), "glide": (fly_glide, f"{FLY} == 3"), "desc": (fly_desc, f"{FLY} == 4")}
ONE = {"death": (death, "!query.is_alive"), "attack": (attack, "variable.attack_time > 0 && query.is_alive"), "hurt": (hurt, "query.hurt_time > 0 && query.is_alive"), "land": (land, f"({T} - variable.etheria_land) < 0.1 && {FLY} == 0")}

def main():
    A, C = {}, {}
    for s in STY:
        for n, (fn, _) in {**CONT, **ONE}.items(): A[f"animation.etheria.ract.{s}.{n}"] = fn(s)
    for n, (_, cond) in ONE.items():
        C[f"controller.animation.etheria.ract.{n}"] = {"initial_state": "wait", "states": {
            "wait": {"transitions": [{"play": f"({cond}) && {BASE}"}]},
            "play": {"animations": [{f"ract_{s}_{n}": PROP(s)} for s in STY], "blend_transition": 0.1, "transitions": [{"wait": f"query.all_animations_finished && !({cond})"}]}}}
    json.dump({"format_version": "1.8.0", "animations": A}, open(os.path.join(RP, "animations/etheria_race_actions.animation.json"), "w"), indent=1)
    json.dump({"format_version": "1.10.0", "animation_controllers": C}, open(os.path.join(RP, "animation_controllers/etheria_race_actions.animation_controllers.json"), "w"), indent=1)
    ep = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(ep)); D = E["minecraft:client_entity"]["description"]
    an = D["animations"]; am = D["scripts"]["animate"]
    for key in [x for x in an if x.startswith("ract_")]: an.pop(key)
    am[:] = [x for x in am if not ((isinstance(x, dict) and any(q.startswith("ract_") for q in x)) or (isinstance(x, str) and x.startswith("ract_")))]
    for s in STY:
        for n in {**CONT, **ONE}: an[f"ract_{s}_{n}"] = f"animation.etheria.ract.{s}.{n}"
        for n, (_, cond) in CONT.items(): am.append({f"ract_{s}_{n}": f"{PROP(s)} && ({cond}) && {BASE}"})
    for n in ONE: an[f"ract_ctrl_{n}"] = f"controller.animation.etheria.ract.{n}"; am.append(f"ract_ctrl_{n}")
    json.dump(E, open(ep, "w"), indent=1)
    print("ok:", len(A), "animações,", len(C), "controladores")
if __name__ == "__main__": main()

# 6.57 - ANIMAÇÕES DE CORPO DO JOGADOR por tipo de raça + GESTOS DE MAGIA.
# Postura (soma-se às animações normais do jogo; só em 3ª pessoa): propriedade etheria:rstyle definida pelo script conforme a raça.
#   heavy (ogro, anão)     ombros curvados, braços afastados, passo pesado com balanço lateral do tronco
#   beast (bestial)        agachado de predador, cabeça erguida, corre inclinado para a frente
#   draconic (dragonoide, homem-lagarto)  peito estufado, braços um pouco para trás, tronco gira com o passo
#   light (elfo, anjo)     postura leve e ereta, mãos abertas, balanço suave e "flutuante"
#   demonic (demônio, vampiro, caídos)  curvado e ameaçador, cabeça baixa, braços soltos
#   slime                  quica ao andar (tronco, cabeça e braços sobem e descem juntos)
#   undead (morto-vivo)    rígido, braços meio erguidos, cabeça inclinada, passo arrastado
#   goblin                 corcunda e agitado, braços balançando mais
# Todos inclinam o tronco ao correr (query.is_sprinting).
# Gestos de magia (tocados pelo script com playAnimation, como os golpes de agilidade): conjuração (mãos juntas carregando) e
# liberação por tipo de magia (projétil, raio, explosão ao redor, área no alvo, cura/buff, corte, investida, devorar, invocação).
# Uso: python3 tools/race_styles.py   (idempotente)
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
STYLES = ["none", "heavy", "beast", "draconic", "light", "demonic", "slime", "undead", "goblin"]
W = "math.min(1, query.modified_move_speed * 4)"            # 0 parado .. 1 andando
SW = "math.sin(query.modified_distance_moved * 38.17)"      # mesma fase do passo do jogo
BR = "math.sin(query.life_time * 90)"                       # respiração
SPR = "(query.is_sprinting ? 1 : 0)"

def r(x=0, y=0, z=0): return [x, y, z]
POSE = {   # 9.7: posturas HUMANAS e eretas (traço de estilo sutil; nada de corcunda de fera/goblin/demônio ou braços de zumbi)
  "heavy": {"body": r(f"2 + 1 * {BR}", f"3 * {SW} * {W}", f"2 * {SW} * {W}"), "head": r(-2, 0, f"-1 * {SW} * {W}"),
            "rightArm": r(f"-2 * {BR}", 0, "5"), "leftArm": r(f"-2 * {BR}", 0, "-5"), "rightLeg": r(0, 0, 1), "leftLeg": r(0, 0, -1)},
  "beast": {"body": r(f"3 + 6 * {SPR}", 0, f"1.5 * {SW} * {W}"), "head": r(f"-3 - 4 * {SPR}", 0, 0),
            "rightArm": r(f"-4 - 8 * {SPR}", 0, 4), "leftArm": r(f"-4 - 8 * {SPR}", 0, -4)},
  "draconic": {"body": r(f"-3 + {BR}", f"4 * {SW} * {W}", 0), "head": r(f"-3", f"-2 * {SW} * {W}", 0),
               "rightArm": r(6, 0, 5), "leftArm": r(6, 0, -5)},
  "light": {"body": r(f"-2 + {BR}", 0, f"1.5 * {SW} * {W}"), "head": r(f"-4 + 1.5 * {BR}", 0, 0),
            "rightArm": r(f"-6 + 2 * {BR}", 0, f"10 + 3 * {BR}"), "leftArm": r(f"-6 + 2 * {BR}", 0, f"-10 - 3 * {BR}")},
  "demonic": {"body": r(f"-2 + {BR}", f"2 * {SW} * {W}", 0), "head": r(-3, 0, f"1.5 * math.sin(query.life_time * 40)"),
              "rightArm": r(f"2", 0, 4), "leftArm": r(f"2", 0, -4)},
  "slime": {"body": {"rotation": r(0, 0, f"2 * {SW} * {W}"), "position": r(0, f"math.abs({SW}) * 1.2 * {W} + 0.3 * {BR}", 0)},
            "head": {"position": r(0, f"math.abs({SW}) * 1.2 * {W} + 0.3 * {BR}", 0)},
            "rightArm": {"rotation": r(0, 0, 14), "position": r(0, f"math.abs({SW}) * 1.2 * {W}", 0)},
            "leftArm": {"rotation": r(0, 0, -14), "position": r(0, f"math.abs({SW}) * 1.2 * {W}", 0)}},
  "undead": {"body": r(1, 0, f"2 * {SW} * {W}"), "head": r(3, 0, 4),
             "rightArm": r(f"-6 + 2 * {BR}", 0, 4), "leftArm": r(f"-4 + 2 * {BR}", 0, -4)},
  "goblin": {"body": r(f"4 + 1.5 * {BR}", f"4 * {SW} * {W}", 0), "head": r(-3, f"3 * math.sin(query.life_time * 70)", 0),
             "rightArm": r(f"-4 - 8 * {SW} * {W}", 0, 7), "leftArm": r(f"-4 + 8 * {SW} * {W}", 0, -7)},
}
def pose_anim(st):
    bones = {}
    for b, v in POSE[st].items():
        bones[b] = v if isinstance(v, dict) else {"rotation": v}
    lean = bones.setdefault("body", {}); rot = lean.get("rotation", [0, 0, 0])
    rot = [f"({rot[0]}) + 10 * {SPR}" if isinstance(rot[0], str) else f"{rot[0]} + 10 * {SPR}", rot[1], rot[2]]   # tronco inclina ao correr
    lean["rotation"] = rot
    return {"loop": True, "animation_length": 3600, "bones": bones}

def kf(*frames): return {f"{t}": v for t, v in frames}
Z = [0, 0, 0]
CAST = {
  # conjuração (fase de formação): mãos juntas à frente, energia acumulando (pequeno tremor)
  "charge": (1.2, True, {"rightArm": kf((0.0, Z), (0.25, [-55, 20, 0]), (1.2, [-60, 22, 0])), "leftArm": kf((0.0, Z), (0.25, [-55, -20, 0]), (1.2, [-60, -22, 0])),
            "body": kf((0.0, Z), (0.25, [6, 0, 0]), (1.2, [8, 0, 0])), "head": kf((0.0, Z), (0.3, [6, 0, 0]), (1.2, [4, 0, 0]))}),
  "projectile": (0.55, False, {"rightArm": kf((0.0, Z), (0.12, [-20, 0, 18]), (0.22, [-100, 4, 0]), (0.4, [-92, 0, 0]), (0.55, Z)),
            "body": kf((0.0, Z), (0.12, [0, 16, 0]), (0.22, [6, -14, 0]), (0.55, Z)), "leftArm": kf((0.0, Z), (0.22, [20, 0, -8]), (0.55, Z))}),
  "beam": (0.9, False, {"rightArm": kf((0.0, Z), (0.15, [-92, 8, 0]), (0.75, [-90, 6, 0]), (0.9, Z)), "leftArm": kf((0.0, Z), (0.15, [-92, -8, 0]), (0.75, [-90, -6, 0]), (0.9, Z)),
            "body": kf((0.0, Z), (0.15, [-6, 0, 0]), (0.75, [-8, 0, 0]), (0.9, Z)), "rightLeg": kf((0.0, Z), (0.15, [-14, 0, 0]), (0.9, Z)), "leftLeg": kf((0.0, Z), (0.15, [12, 0, 0]), (0.9, Z))}),
  "aoe": (0.8, False, {"rightArm": kf((0.0, Z), (0.25, [-170, 0, 10]), (0.4, [-30, 0, 20]), (0.8, Z)), "leftArm": kf((0.0, Z), (0.25, [-170, 0, -10]), (0.4, [-30, 0, -20]), (0.8, Z)),
            "body": kf((0.0, Z), (0.25, [-10, 0, 0]), (0.4, [24, 0, 0]), (0.8, Z)), "head": kf((0.0, Z), (0.25, [-20, 0, 0]), (0.4, [12, 0, 0]), (0.8, Z)),
            "rightLeg": kf((0.0, Z), (0.4, [-22, 0, 6]), (0.8, Z)), "leftLeg": kf((0.0, Z), (0.4, [-22, 0, -6]), (0.8, Z))}),
  "target": (0.75, False, {"rightArm": kf((0.0, Z), (0.25, [-175, 0, -6]), (0.45, [-115, 0, 0]), (0.75, Z)), "head": kf((0.0, Z), (0.25, [-22, 0, 0]), (0.45, [-4, 0, 0]), (0.75, Z)),
            "leftArm": kf((0.0, Z), (0.25, [-20, 0, -20]), (0.75, Z)), "body": kf((0.0, Z), (0.25, [-6, 0, 0]), (0.75, Z))}),
  "support": (0.9, False, {"rightArm": kf((0.0, Z), (0.3, [-40, 0, 70]), (0.7, [-40, 0, 66]), (0.9, Z)), "leftArm": kf((0.0, Z), (0.3, [-40, 0, -70]), (0.7, [-40, 0, -66]), (0.9, Z)),
            "head": kf((0.0, Z), (0.3, [-18, 0, 0]), (0.9, Z)), "body": kf((0.0, Z), (0.3, [-6, 0, 0]), (0.9, Z))}),
  "slash": (0.5, False, {"rightArm": kf((0.0, Z), (0.12, [-120, 50, 0]), (0.28, [-70, -60, 0]), (0.5, Z)), "body": kf((0.0, Z), (0.12, [0, 30, 0]), (0.28, [8, -30, 0]), (0.5, Z)),
            "leftArm": kf((0.0, Z), (0.28, [-30, 0, -30]), (0.5, Z)), "rightLeg": kf((0.0, Z), (0.28, [-20, 0, 0]), (0.5, Z))}),
  "dash": (0.5, False, {"body": kf((0.0, Z), (0.1, [28, 0, 0]), (0.35, [24, 0, 0]), (0.5, Z)), "rightArm": kf((0.0, Z), (0.1, [55, 0, 12]), (0.5, Z)),
            "leftArm": kf((0.0, Z), (0.1, [55, 0, -12]), (0.5, Z)), "rightLeg": kf((0.0, Z), (0.1, [-40, 0, 0]), (0.5, Z)), "leftLeg": kf((0.0, Z), (0.1, [30, 0, 0]), (0.5, Z))}),
  "devour": (0.85, False, {"rightArm": kf((0.0, Z), (0.3, [-70, 0, 85]), (0.5, [-85, -10, 0]), (0.85, Z)), "leftArm": kf((0.0, Z), (0.3, [-70, 0, -85]), (0.5, [-85, 10, 0]), (0.85, Z)),
            "body": kf((0.0, Z), (0.3, [-8, 0, 0]), (0.5, [14, 0, 0]), (0.85, Z)), "head": kf((0.0, Z), (0.3, [-10, 0, 0]), (0.5, [10, 0, 0]), (0.85, Z))}),
  "summon": (0.8, False, {"rightArm": kf((0.0, Z), (0.3, [-160, 0, 0]), (0.6, [-150, 0, 0]), (0.8, Z)), "leftArm": kf((0.0, Z), (0.3, [-40, 0, -30]), (0.8, Z)),
            "head": kf((0.0, Z), (0.3, [-25, 0, 0]), (0.8, Z)), "body": kf((0.0, Z), (0.3, [-8, 0, 0]), (0.8, Z))}),
}
def cast_anims():
    out = {}
    for k, (ln, loop, bones) in CAST.items():
        out[f"animation.etheria.cast.{k}"] = {"animation_length": ln, "loop": loop, "bones": {b: {"rotation": v} for b, v in bones.items()}}
    return out

def main():
    A = {f"animation.etheria.rstyle.{s}": pose_anim(s) for s in POSE}
    A.update(cast_anims())
    json.dump({"format_version": "1.8.0", "animations": A}, open(os.path.join(RP, "animations/etheria_race_style.animation.json"), "w"), indent=1)
    # propriedade do jogador (BP)
    pp = os.path.join(BP, "entities/player.json"); P = json.load(open(pp))
    P["minecraft:entity"]["description"].setdefault("properties", {})["etheria:rstyle"] = {"type": "enum", "values": STYLES, "default": "none", "client_sync": True}
    json.dump(P, open(pp, "w"), indent=1)
    # entidade cliente do jogador (RP): animações + condições (só 3ª pessoa, fora da forma de dragão)
    ep = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(ep)); D = E["minecraft:client_entity"]["description"]
    an = D["scripts"]["animate"]
    an[:] = [x for x in an if not (isinstance(x, dict) and any(k.startswith("etheria_rstyle_") for k in x))]
    for s in POSE:
        D["animations"][f"etheria_rstyle_{s}"] = f"animation.etheria.rstyle.{s}"
        an.append({f"etheria_rstyle_{s}": f"query.property('etheria:rstyle') == '{s}' && !variable.is_first_person && variable.etheria_dragon == 0.0 && !query.is_riding"})
    for k in CAST: D["animations"].pop(f"etheria_cast_{k}", None)   # gestos tocados por script (playAnimation), não precisam de entrada
    json.dump(E, open(ep, "w"), indent=1)
    print("ok:", len(POSE), "posturas,", len(CAST), "gestos de magia")
if __name__ == "__main__": main()

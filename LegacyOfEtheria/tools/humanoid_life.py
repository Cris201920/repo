# 6.55 - "VIDA" para todas as entidades humanoides do addon (chefes, personagens, NPCs e mobs que usavam só animation.humanoid.*).
# Soma-se às animações vanilla (não substitui andar/atacar): só mexe em ossos padrão head/body/rightArm/leftArm/rightLeg/leftLeg.
#   idle      respiração + balanço dos braços quando parado (fase e velocidade aleatórias por entidade -> ninguém sincronizado)
#   stance    postura de combate (pernas abertas, braços erguidos, tronco inclinado) quando tem alvo e está parado — só hostis/chefes
#   swing     torção do tronco e contrapeso do braço livre durante o golpe (preparação -> golpe -> recuperação) — sincronizado com attack_time
#   hurt      recuo ao receber dano (query.hurt_time)
#   talk/wave NPCs: gestos de conversa com o jogador perto e aceno ao se aproximar (distância da câmera), sem perseguir nem atacar
# Uso: python3 tools/humanoid_life.py   (idempotente)
import json, glob, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
T = "math.sin((query.life_time * 75 + v.ph) * v.sp)"   # graus/s de fase
A = {
  "animation.etheria.life.idle": {"loop": True, "bones": {
    "body": {"rotation": [f"1.2 * {T}", 0, 0]},
    "head": {"rotation": [f"-1.5 * {T} + 2 * math.sin(query.life_time * 23 + v.ph)", f"6 * math.sin(query.life_time * 17 + v.ph * 2)", 0]},
    "rightArm": {"rotation": [f"-2 * {T}", 0, f"2.5 + 2 * {T}"]},
    "leftArm": {"rotation": [f"-2 * {T}", 0, f"-2.5 - 2 * {T}"]}}},
  "animation.etheria.life.stance": {"loop": True, "bones": {
    "body": {"rotation": [6, 0, 0]},
    "rightArm": {"rotation": [f"-28 + 3 * {T}", -8, 6]},
    "leftArm": {"rotation": [f"-20 + 3 * {T}", 10, -6]},
    "rightLeg": {"rotation": [-4, 8, 4]},
    "leftLeg": {"rotation": [4, -8, -4]},
    "head": {"rotation": [-4, 0, 0]}}},
  "animation.etheria.life.swing": {"loop": False, "animation_length": 0.5, "bones": {
    "body": {"rotation": {"0.0": [0, 0, 0], "0.12": [4, 22, 0], "0.28": [8, -26, 0], "0.5": [0, 0, 0]}},
    "leftArm": {"rotation": {"0.0": [0, 0, 0], "0.12": [-10, 0, -12], "0.28": [18, 0, -6], "0.5": [0, 0, 0]}},
    "rightLeg": {"rotation": {"0.0": [0, 0, 0], "0.28": [-10, 0, 0], "0.5": [0, 0, 0]}},
    "leftLeg": {"rotation": {"0.0": [0, 0, 0], "0.28": [8, 0, 0], "0.5": [0, 0, 0]}}}},
  "animation.etheria.life.hurt": {"loop": False, "animation_length": 0.35, "bones": {
    "body": {"rotation": {"0.0": [0, 0, 0], "0.08": [-9, 0, 3], "0.35": [0, 0, 0]}},
    "head": {"rotation": {"0.0": [0, 0, 0], "0.08": [-14, 0, -4], "0.35": [0, 0, 0]}},
    "rightArm": {"rotation": {"0.0": [0, 0, 0], "0.08": [-16, 0, 14], "0.35": [0, 0, 0]}},
    "leftArm": {"rotation": {"0.0": [0, 0, 0], "0.08": [-16, 0, -14], "0.35": [0, 0, 0]}}}},
  "animation.etheria.life.talk": {"loop": True, "bones": {
    "rightArm": {"rotation": [f"-22 + 12 * math.sin(query.life_time * 160 + v.ph)", -10, f"8 + 4 * math.sin(query.life_time * 90)"]},
    "leftArm": {"rotation": [f"-8 + 6 * math.sin(query.life_time * 120 + v.ph + 60)", 6, -5]},
    "head": {"rotation": [f"3 * math.sin(query.life_time * 140 + v.ph)", 0, 0]}}},
  "animation.etheria.life.wave": {"loop": False, "animation_length": 1.6, "bones": {
    "rightArm": {"rotation": {"0.0": [0, 0, 0], "0.25": [-160, 0, 20], "0.5": [-160, 0, -5], "0.75": [-160, 0, 20], "1.0": [-160, 0, -5], "1.3": [-160, 0, 15], "1.6": [0, 0, 0]}},
    "head": {"rotation": {"0.0": [0, 0, 0], "0.3": [-6, 0, 4], "1.3": [-6, 0, 4], "1.6": [0, 0, 0]}}}},
}
# controlador do aceno: dispara uma vez quando o jogador chega perto (e só volta a acenar depois que ele se afasta)
CTRL = {"format_version": "1.10.0", "animation_controllers": {"controller.animation.etheria.life.greet": {"initial_state": "far", "states": {
  "far": {"transitions": [{"near": "query.distance_from_camera < 5 && !query.is_moving"}]},
  "near": {"animations": ["life_wave"], "transitions": [{"talk": "query.all_animations_finished"}, {"far": "query.distance_from_camera > 7"}], "blend_transition": 0.2},
  "talk": {"animations": ["life_talk"], "transitions": [{"far": "query.distance_from_camera > 7 || query.is_moving"}], "blend_transition": 0.3}}}}}

def families():
    out = {}
    for f in glob.glob(os.path.join(BP, "entities", "*.json")):
        try: e = json.load(open(f))["minecraft:entity"]
        except Exception: continue
        c = e.get("components", {}); h = c.get("minecraft:health", {})
        out[e["description"]["identifier"]] = (set(c.get("minecraft:type_family", {}).get("family", [])), h.get("max") or h.get("value") or 20)
    return out

def main():
    json.dump({"format_version": "1.8.0", "animations": A}, open(os.path.join(RP, "animations", "etheria_life.animation.json"), "w"), indent=1)
    os.makedirs(os.path.join(RP, "animation_controllers"), exist_ok=True)
    json.dump(CTRL, open(os.path.join(RP, "animation_controllers", "etheria_life.animation_controllers.json"), "w"), indent=1)
    fam = families(); n = {"npc": 0, "hostil": 0}
    for f in sorted(glob.glob(os.path.join(RP, "entity", "*.json"))):
        E = json.load(open(f)); D = E["minecraft:client_entity"]["description"]; an = D.get("animations") or {}
        if an.get("move") != "animation.humanoid.move" and an.get("walk") != "animation.etheria.biped_walk": continue
        fl, hp = fam.get(D["identifier"], (set(), 20)); npc = "npc" in fl or "etheria_npc" in fl
        an.update({"life_idle": "animation.etheria.life.idle", "life_swing": "animation.etheria.life.swing", "life_hurt": "animation.etheria.life.hurt"})
        if npc: an.update({"life_talk": "animation.etheria.life.talk", "life_wave": "animation.etheria.life.wave", "life_greet": "controller.animation.etheria.life.greet"})
        else: an["life_stance"] = "animation.etheria.life.stance"
        D["animations"] = an
        sc = D.setdefault("scripts", {})
        ini = [x for x in sc.get("initialize", []) if "v.ph" not in x] + ["v.ph = math.random(0, 360); v.sp = math.random(0.85, 1.2);"]
        sc["initialize"] = ini
        am = [x for x in sc.get("animate", []) if not (isinstance(x, dict) and any(k.startswith("life_") for k in x)) and x not in ("life_greet", "os_life_swing", "os_life_hurt")]   # 6.58: depois rode tools/oneshot_ctrl.py
        am += [{"life_idle": "!query.is_moving && variable.attack_time <= 0"}, {"life_swing": "variable.attack_time > 0.0"}, {"life_hurt": "query.hurt_time > 0"}]
        if npc: am.append("life_greet")
        else: am.append({"life_stance": "query.has_target && !query.is_moving && variable.attack_time <= 0"})
        sc["animate"] = am
        json.dump(E, open(f, "w"), indent=1)
        n["npc" if npc else "hostil"] += 1
    print("ok:", n)
if __name__ == "__main__": main()

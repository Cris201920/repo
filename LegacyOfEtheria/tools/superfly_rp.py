"""8.1 - VISUAL DO SUPER VOO.
- Peças do mod (asas, caudas, chifres, orelhas, halo, kits) ganham a hierarquia root > waist > body > head do jogador, para acompanhar a pose
  quando o corpo inteiro gira (sem isso ficariam paradas no ar).
- animation.tensura.race.superfly (arquivo tensura_race, como a cauda e as asas que animam no jogo), ligada por etheria:sfly > 0:
  1 voo de herói (deitado, braço direito à frente, pernas balançando) · 2 carregando (os dois braços à frente) · 3 pouso de herói (ajoelhado).
Uso: python3 tools/superfly_rp.py (idempotente)"""
import json, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
def wrap_geos():
    n = 0
    for f in glob.glob(os.path.join(RP, "models/entity/tensura/race/*.geo.json")):
        D = json.load(open(f)); ch = False
        for g in D["minecraft:geometry"]:
            B = g["bones"]; names = {b["name"] for b in B}
            if "root" in names: continue
            add = [{"name": "root", "pivot": [0, 0, 0]}, {"name": "waist", "parent": "root", "pivot": [0, 12, 0]}]
            if "body" not in names: add.append({"name": "body", "parent": "waist", "pivot": [0, 24, 0]})
            for b in B:
                if b.get("parent") in names: continue
                b["parent"] = "waist" if b["name"] == "body" else "body"
            g["bones"] = add + B; ch = True; n += 1
        if ch: json.dump(D, open(f, "w"), indent=1)
    return n
SF = "query.property('etheria:sfly')"
FLY = f"(({SF} == 1 || {SF} == 2) ? 1 : 0)"; CAR = f"({SF} == 2 ? 1 : 0)"; LND = f"({SF} == 3 ? 1 : 0)"
T = "query.anim_time"
def anim():
    return {"loop": True, "animation_length": 3600, "bones": {
        "root": {"rotation": [f"{FLY} * (82 + math.sin({T} * 120) * 3)", 0, f"{FLY} * math.sin({T} * 90) * 4"],
                 "position": [0, f"{FLY} * 14 - {LND} * 4", f"{FLY} * -10"]},
        "body": {"rotation": [f"{LND} * 30", 0, 0]},
        "head": {"rotation": [f"{FLY} * -68 + {LND} * -20", 0, 0]},
        "rightArm": {"rotation": [f"{FLY} * (-172 + math.sin({T} * 200) * 3) + {LND} * -30", 0, f"{FLY} * 6 + {LND} * 12"]},
        "leftArm": {"rotation": [f"{CAR} * -172 + ({FLY} - {CAR}) * (8 + math.sin({T} * 200 + 90) * 3) + {LND} * 35", 0, f"({FLY} - {CAR}) * -10 + {CAR} * -6 + {LND} * -45"]},
        "rightLeg": {"rotation": [f"{FLY} * (4 + math.sin({T} * 520) * 5) + {LND} * -45", 0, f"{FLY} * 3"]},
        "leftLeg": {"rotation": [f"{FLY} * (2 - math.sin({T} * 520) * 5) + {LND} * 60", 0, f"{FLY} * -3"]},
    }}
def main():
    n = wrap_geos()
    tp = os.path.join(RP, "animations/tensura_race.animation.json"); TA = json.load(open(tp))
    TA["animations"]["animation.tensura.race.superfly"] = anim(); json.dump(TA, open(tp, "w"), indent=1)
    ep = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(ep)); de = E["minecraft:client_entity"]["description"]
    de["animations"]["tr_superfly"] = "animation.tensura.race.superfly"
    if not any(isinstance(x, dict) and "tr_superfly" in x for x in de["scripts"]["animate"]): de["scripts"]["animate"].append({"tr_superfly": f"{SF} > 0 && !variable.is_first_person"})
    json.dump(E, open(ep, "w"), indent=1, ensure_ascii=False)
    print("geometrias do mod ajustadas:", n)
if __name__ == "__main__": main()

"""Velzard e Velgrynd como no anime: dragões-serpente que flutuam e nadam no ar.
Gera animations/etheria_pdrg_serpent.animation.json (onda que corre pelo corpo d_body -> d_tail* -> x_serp*,
pescoço erguido, pernas traseiras recolhidas, braços dobrados, corpo pairando) e liga no jogador e nos chefes."""
import json, os
RP = os.path.join(os.path.dirname(__file__), "..", "LegacyOfEtheria_RP")
SERP = ("velzard", "velgrynd")
MV = "math.min(1, query.modified_move_speed * 2.5)"          # 0 parado .. 1 em movimento
T = "query.anim_time"

def f(v): return round(v, 2)

def chain(l):
    g = json.load(open(os.path.join(RP, "models", "entity", f"etheria_pdrg_{l}.geo.json")))["minecraft:geometry"][0]
    names = [b["name"] for b in g["bones"]]
    return ["d_body"] + [n for n in names if n.startswith("d_tail")] + sorted([n for n in names if n.startswith("x_serp")], key=lambda n: int(n[6:]))

def anim(l):
    """6.93: corpo em espiral (modelo já enrolado); a onda corre da cabeça à cauda e a espiral 'respira' enquanto flutua"""
    B = {}
    sp = f"(120 + 160 * {MV})"
    B["d_All"] = {"position": [0, f"6 + math.sin({T} * 70) * 2.5", f"-4 * {MV}"],
                  "rotation": [f"math.sin({T} * 50) * 2 - 8 * {MV}", f"math.sin({T} * 35) * 5", f"math.sin({T} * 45) * 2"]}
    ch = chain(l); N = len(ch)
    for i, b in enumerate(ch):
        u = i / max(1, N - 1)
        ay = 1.4 + 2.6 * u * u                                   # quase parado no tronco, solto na cauda
        ax = 0.9 + 1.4 * u
        B[b] = {"rotation": [f"math.sin({T} * {sp} * 0.8 - {i * 24}) * ({f(ax)} + 1.2 * {MV})",
                             f"math.sin({T} * {sp} - {i * 28}) * ({f(ay)} + 2 * {MV})",
                             f"math.sin({T} * {sp} - {i * 28 + 90}) * {f(1 + u)}"]}
    for i, b in enumerate(("d_neck1", "d_neck2", "d_neck3")):
        B[b] = {"rotation": [f"math.sin({T} * {sp} * 0.8 + {(i + 1) * 30}) * 2.5", f"math.sin({T} * {sp} + {(i + 1) * 34}) * 3.5", 0]}
    B["d_head"] = {"rotation": [f"math.sin({T} * 90 + 160) * 3", f"math.sin({T} * {sp} + 150) * -5", f"math.sin({T} * 60) * 3"]}
    B["d_lower_jaw"] = {"rotation": [f"math.max(0, math.sin({T} * 45)) * 10", 0, 0]}
    for side, ph in (("left", 0), ("right", 180)):          # patinhas "remando" no ar, garras abrindo e fechando
        B[f"d_{side}_arm"] = {"rotation": [f"math.sin({T} * 110 + {ph}) * 16", 0, 0]}
        B[f"d_{side}_arm_lower"] = {"rotation": [f"math.sin({T} * 110 + {ph} + 60) * 14", 0, 0]}
        B[f"d_{side}_hand"] = {"rotation": [f"math.sin({T} * 150 + {ph}) * 14", 0, 0]}
        B[f"d_{side}_leg"] = {"rotation": [f"math.sin({T} * 110 + {ph} + 90) * 14", 0, 0]}
        B[f"d_{side}_leg_lower"] = {"rotation": [f"math.sin({T} * 110 + {ph} + 150) * 12", 0, 0]}
    for k in range(1, 6):
        B[f"x_mane{k}"] = {"rotation": [f"math.sin({T} * 100 - {k * 35}) * 7", f"math.sin({T} * 70 - {k * 50}) * 9", 0]}
    return {"loop": True, "animation_length": 3600, "bones": B}

def main():
    A = {f"animation.etheria_pdrg_{l}.serpent": anim(l) for l in SERP}
    json.dump({"format_version": "1.8.0", "animations": A}, open(os.path.join(RP, "animations", "etheria_pdrg_serpent.animation.json"), "w"), indent=1)
    # jogador: liga a serpente e tira deles o andar/respirar de quadrúpede
    p = os.path.join(RP, "entity", "player.entity.json"); E = json.load(open(p)); D = E["minecraft:client_entity"]["description"]
    FORM = "(query.property('etheria:lform') == 'true' || query.property('etheria:lform') == 'draconic')"
    NOT = " && query.property('etheria:lin') != 'velzard' && query.property('etheria:lin') != 'velgrynd'"
    an = D["scripts"]["animate"]
    for x in an:
        if not isinstance(x, dict): continue
        k = list(x)[0]
        if k in ("drg_walk", "drg_run", "drg_breathe", "drg_land") and NOT not in x[k]: x[k] += NOT
        if k in ("drg_gait_velzard", "drg_gait_velgrynd"): x[k] = "false"
    for l in SERP:
        D["animations"][f"drg_serpent_{l}"] = f"animation.etheria_pdrg_{l}.serpent"
        if not any(isinstance(x, dict) and f"drg_serpent_{l}" in x for x in an):
            an.append({f"drg_serpent_{l}": f"query.property('etheria:lin') == '{l}' && {FORM}"})
    open(p, "w").write(json.dumps(E, indent=1, ensure_ascii=False) + "\n")
    # chefes: no lugar do andar de quadrúpede, nadam no ar
    for l in SERP:
        p = os.path.join(RP, "entity", f"{l}.entity.json"); E = json.load(open(p)); D = E["minecraft:client_entity"]["description"]
        D["animations"]["serpent"] = f"animation.etheria_pdrg_{l}.serpent"
        for k in ("walk", "run", "gait"): D["animations"].pop(k, None)
        an = [x for x in D["scripts"]["animate"] if not (isinstance(x, dict) and list(x)[0] in ("walk", "run", "gait"))]
        if not any(isinstance(x, dict) and "serpent" in x for x in an): an.insert(1, {"serpent": "query.property('etheria:form') == 'dragon'"})
        D["scripts"]["animate"] = an
        json.dump(E, open(p, "w"), indent=1)
    print("ok")

if __name__ == "__main__":
    main()

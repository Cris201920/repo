"""Velzard e Velgrynd: dragões-serpente que nadam no ar (modelo do usuário, corpo longo esticado - ver dragon_bd.py).
Gera animations/etheria_pdrg_serpent.animation.json:
  .serpent  onda que corre do peito até a ponta da cauda (d_body -> d_tail* -> x_serp*) e continua pelo pescoço,
            corpo pairando, cabeça estável olhando em volta, bigodes/patas remando; mais rápida e ampla ao se mover
  .serpent_fly  voo: corpo esticado, patas recolhidas, onda forte
  .idle / .gait  (respiração/mandíbula; gait vazio - a serpente não anda)
Só usa query.anim_time, query.modified_move_speed e math.* (animation_length 3600 nas de loop).
Liga no jogador (só as linhas dos dragões-serpente) e nos chefes."""
import json, os
RP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "LegacyOfEtheria_RP")
SERP = ("velzard", "velgrynd")
MV = "math.min(1, query.modified_move_speed * 2.5)"          # 0 parado .. 1 em movimento
T = "query.anim_time"

def f(v): return round(v, 2)

def chain(l):
    g = json.load(open(os.path.join(RP, "models", "entity", f"etheria_pdrg_{l}.geo.json")))["minecraft:geometry"][0]
    names = [b["name"] for b in g["bones"]]
    return ["d_body"] + sorted([n for n in names if n.startswith("d_tail")]) + sorted([n for n in names if n.startswith("x_serp")], key=lambda n: int(n[6:]))

def wave(l):
    """onda viajante: ângulo de cada junta = A(u) sen(w t - fase*i); soma limitada (sem 'enrolar')"""
    B = {}; ch = chain(l); N = len(ch)
    sp = f"(150 + 130 * {MV})"; k = 1.0
    for i, b in enumerate(ch):
        u = i / max(1, N - 1)
        ay = (6.5 + 5.5 * u) * k; ax = (2.6 + 3.0 * u) * k
        B[b] = {"rotation": [f"math.sin({T} * {sp} * 0.7 - {i * 19}) * {f(ax)}",
                             f"math.sin({T} * {sp} - {i * 24}) * ({f(ay)} + {f(2.5 * k)} * {MV})",
                             f"math.sin({T} * {sp} - {i * 24 + 90}) * {f(1.2 + u)}"]}
    # a onda continua pelo peito e pescoço (cadeia invertida: sinal oposto), cabeça compensa e olha em volta
    for j, b in enumerate(("d_upper_body", "d_neck1", "d_neck2", "d_neck3")):
        B[b] = {"rotation": [f"math.sin({T} * {sp} * 0.7 + {(j + 1) * 19}) * {f(-2.2 * k)}", f"math.sin({T} * {sp} + {(j + 1) * 24}) * {f(-4.0 * k * (1 - 0.15 * j))}", 0]}
    B["d_head"] = {"rotation": [f"math.sin({T} * {sp} * 0.7 + 95) * {f(5 * k)} + math.sin({T} * 31) * 4",
                                f"math.sin({T} * {sp} + 120) * {f(9 * k)} + math.sin({T} * 23) * 10", f"math.sin({T} * 41) * 3"]}
    B["d_All"] = {"position": [0, f"math.sin({T} * 62) * 4", 0],
                  "rotation": [f"math.sin({T} * 44) * 2 - 3 * {MV}", f"math.sin({T} * 29) * 4", f"math.sin({T} * {sp} * 0.5) * 2.5"]}
    return B

def anim(l):
    B = wave(l)
    B["d_lower_jaw"] = {"rotation": [f"math.pow(math.max(0, math.sin({T} * 47)), 3) * 14", 0, 0]}
    for side, ph in (("left", 0), ("right", 180)):          # patas remando no ar, garras abrindo e fechando; recolhe ao se mover
        B[f"d_{side}_arm"] = {"rotation": [f"math.sin({T} * 110 + {ph}) * 18 + 25 * {MV}", 0, f"math.sin({T} * 90 + {ph}) * 6"]}
        B[f"d_{side}_arm_lower"] = {"rotation": [f"math.sin({T} * 110 + {ph} + 60) * 16 - 20 * {MV}", 0, 0]}
        B[f"d_{side}_hand"] = {"rotation": [f"math.sin({T} * 150 + {ph}) * 18", 0, 0]}
        B[f"d_{side}_leg"] = {"rotation": [f"math.sin({T} * 110 + {ph} + 90) * 16 + 30 * {MV}", 0, 0]}
        B[f"d_{side}_leg_lower"] = {"rotation": [f"math.sin({T} * 110 + {ph} + 150) * 14 - 15 * {MV}", 0, 0]}
        B[f"d_{side}_leg_foot"] = {"rotation": [f"math.sin({T} * 150 + {ph} + 40) * 16", 0, 0]}
    for s_, sg in (("l", 1), ("r", -1)):                     # bigodes ondulando
        B[f"x_whisk_{s_}"] = {"rotation": [f"math.sin({T} * 130 + {30 if sg > 0 else 90}) * 9", f"{sg} * math.sin({T} * 90) * 12", f"math.sin({T} * 70) * 5"]}
    return {"loop": True, "animation_length": 3600, "bones": B}

def fly(l):
    """voo (soma-se à .serpent, que já acelera a onda com a velocidade): patas coladas ao corpo, bigodes para trás,
    corpo inclinado no sentido do voo, cauda estendida"""
    B = {"d_All": {"rotation": [f"-5 + math.sin({T} * 70) * 2", 0, 0]}, "d_neck1": {"rotation": [8, 0, 0]}, "d_neck2": {"rotation": [6, 0, 0]}, "d_head": {"rotation": [-10, 0, 0]}}
    for side in ("left", "right"):
        B[f"d_{side}_arm"] = {"rotation": [55, 0, 0]}; B[f"d_{side}_arm_lower"] = {"rotation": [-35, 0, 0]}; B[f"d_{side}_hand"] = {"rotation": [30, 0, 0]}
        B[f"d_{side}_leg"] = {"rotation": [60, 0, 0]}; B[f"d_{side}_leg_lower"] = {"rotation": [-30, 0, 0]}
    for s_, sg in (("l", 1), ("r", -1)):
        B[f"x_whisk_{s_}"] = {"rotation": [f"20 + math.sin({T} * 200) * 6", f"{sg} * 18", 0]}
    return {"loop": True, "animation_length": 3600, "bones": B}

def idle(l):
    return {"loop": True, "animation_length": 3600, "bones": {
        "d_upper_body": {"position": [0, f"math.sin({T} * 80) * 0.6", 0]},
        "d_neck1": {"rotation": [f"math.sin({T} * 80 - 30) * 1.5", 0, 0]}}}

def main():
    A = {}
    for l in SERP:
        A[f"animation.etheria_pdrg_{l}.serpent"] = anim(l)
        A[f"animation.etheria_pdrg_{l}.serpent_fly"] = fly(l)
        A[f"animation.etheria_pdrg_{l}.idle"] = idle(l)
        A[f"animation.etheria_pdrg_{l}.gait"] = {"loop": True, "animation_length": 3600, "bones": {}}
    json.dump({"format_version": "1.8.0", "animations": A}, open(os.path.join(RP, "animations", "etheria_pdrg_serpent.animation.json"), "w"), indent=1)
    # jogador: liga a serpente e tira deles o andar/respirar/voar de quadrúpede
    p = os.path.join(RP, "entity", "player.entity.json"); E = json.load(open(p)); D = E["minecraft:client_entity"]["description"]
    FORM = "(query.property('etheria:lform') == 'true' || query.property('etheria:lform') == 'draconic')"
    NOT = " && query.property('etheria:lin') != 'velzard' && query.property('etheria:lin') != 'velgrynd'"
    an = D["scripts"]["animate"]
    for x in an:
        if not isinstance(x, dict): continue
        k = list(x)[0]
        if k in ("drg_walk", "drg_run", "drg_breathe", "drg_land", "drg_fly", "drg_glide") and NOT not in x[k]: x[k] += NOT
        if k in ("drg_gait_velzard", "drg_gait_velgrynd"): x[k] = "false"
    for l in SERP:
        D["animations"][f"drg_serpent_{l}"] = f"animation.etheria_pdrg_{l}.serpent"
        D["animations"][f"drg_serp_fly_{l}"] = f"animation.etheria_pdrg_{l}.serpent_fly"
        if not any(isinstance(x, dict) and f"drg_serpent_{l}" in x for x in an):
            an.append({f"drg_serpent_{l}": f"query.property('etheria:lin') == '{l}' && {FORM}"})
        if not any(isinstance(x, dict) and f"drg_serp_fly_{l}" in x for x in an):
            an.append({f"drg_serp_fly_{l}": f"query.property('etheria:lin') == '{l}' && {FORM} && !query.is_on_ground && !query.is_in_water"})
    open(p, "w").write(json.dumps(E, indent=1, ensure_ascii=False) + "\n")
    # chefes: nadam no ar; voo próprio de serpente
    for l in SERP:
        p = os.path.join(RP, "entity", f"{l}.entity.json"); E = json.load(open(p)); D = E["minecraft:client_entity"]["description"]
        D["animations"]["serpent"] = f"animation.etheria_pdrg_{l}.serpent"
        D["animations"]["fly"] = f"animation.etheria_pdrg_{l}.serpent_fly"
        for k in ("walk", "run", "gait"): D["animations"].pop(k, None)
        an = [x for x in D["scripts"]["animate"] if not (isinstance(x, dict) and list(x)[0] in ("walk", "run", "gait"))]
        if not any(isinstance(x, dict) and "serpent" in x for x in an): an.insert(1, {"serpent": "query.property('etheria:form') == 'dragon'"})
        D["scripts"]["animate"] = an
        json.dump(E, open(p, "w"), indent=1)
    # partes genéricas do jogador: a onda antiga de x_serp1..6 (da espiral) somava com a nova
    p = os.path.join(RP, "animations", "etheria_pdrg_forms.animation.json"); F = json.load(open(p))
    parts = F["animations"].get("animation.etheria_pdrg.parts", {}).get("bones", {})
    for k in [k for k in parts if k.startswith("x_serp")]: parts.pop(k)
    json.dump(F, open(p, "w"), indent=1)
    print("ok")

if __name__ == "__main__":
    main()

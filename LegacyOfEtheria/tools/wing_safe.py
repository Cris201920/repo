"""8.0 - BATIDA DE ASA NO MESMO MOLDE DA CAUDA DO MOD (a única animação de raça confirmada no jogo):
- só consultas que a cauda usa: query.anim_time, query.is_on_ground, query.is_sneaking, query.modified_move_speed
  (sem query.vertical_speed e sem variáveis do pre_animation);
- uma animação própria (animation.tensura.race.ewings, no arquivo tensura_race) ligada por propriedade NUMÉRICA
  (etheria:tier > 0), como a cauda (tensura:tail > 0);
- os ossos de asa saem das animações das raças (ficam só a escala), para não somar duas vezes.
Cobre: corpo Etheria (wing, wing2, wing3 + B/C), Dragonato alado (dwU/dwD), forma humana das linhagens e asas do mod.
Uso: python3 tools/wing_safe.py && python3 tools/split_race_anims.py"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SRC = os.path.join(ROOT, "tools/race_src/etheria_race_parts.animation.json")
MV = "math.min(1, query.modified_move_speed * 3)"
F = f"(query.is_on_ground ? (150 + 190 * {MV}) : 560)"                                   # graus/s: parado lenta, andando média, no ar rápida
A = f"(query.is_on_ground ? (query.is_sneaking ? 0 : (0.4 + 0.3 * {MV})) : 1)"            # força 0..1
AIR = "(query.is_on_ground ? 0 : 1)"; SN = "((query.is_sneaking && query.is_on_ground) ? 1 : 0)"
def S(lag): return f"math.sin(query.anim_time * {F} - {lag})"
def etheria_bones():
    out = {}
    for i, pre in enumerate(("wing", "wing2", "wing3")):
        lag = i * 30
        for sd, sg in (("l", 1), ("r", -1)):
            out[f"{pre}_{sd}"] = {"rotation": [f"{S(lag)} * 5 * {AIR}", f"{sg} * (18 * {SN} - 8 * {AIR})", f"{sg} * ({S(lag)} * 44 * {A} + 8 * {AIR} - 16 * {SN})"]}
            out[f"{pre}B_{sd}"] = {"rotation": [0, 0, f"{sg} * ({S(lag + 50)} * 25 * {A} - 10 * {SN})"]}
            out[f"{pre}C_{sd}"] = {"rotation": [0, 0, f"{sg} * ({S(lag + 95)} * 30 * {A} - 12 * {SN})"]}
    return out
def drake_bones():
    B = {}
    for P, k, ph in (("U", 1.0, 0), ("D", 0.72, 70)):
        for sd, sg in (("l", 1), ("r", -1)):
            B[f"dw{P}_root_{sd}"] = {"rotation": [f"{S(ph + 40)} * 6 * {A}", f"{-sg} * (36 * (1 - {AIR}) + 20 * {SN} + {16 * k} * {S(ph + 70)} * {A} * {AIR})",
                                                  f"{sg} * ({38 * k} * {S(ph)} * {A} - 6 * {AIR} - {34 * k} * {SN})"]}
            B[f"dw{P}_arm_{sd}"] = {"rotation": [0, 0, f"{sg} * ({14 * k} * {S(ph + 50)} * {A} - 20 * {SN})"]}
            B[f"dw{P}_fore_{sd}"] = {"rotation": [0, f"{-sg} * (10 * {S(ph + 95)} * {A} + 35 * {SN})", f"{sg} * ({18 * k} * {S(ph + 90)} * {A} - 30 * {SN})"]}
            close = f"(2.5 * (1 - {AIR}) + 7 * {SN} + 2.5 * {S(ph + 120)} * {A} + 1.5 * {AIR})"
            for i in range(4):
                B[f"dw{P}_f{i}_{sd}"] = {"rotation": [0, 0, f"{-sg * (3 - i)} * {close}"]}
                if i < 3: B[f"dw{P}_m{i}_{sd}"] = {"rotation": [f"{S(ph + 60 + i * 35)} * (1.5 + 3.5 * {A})", 0, 0]}
    return B
def lerp(a, b): return f"({a} + ({b} - {a}) * {AIR})"
def mod_wing_bones():
    out = {}
    for sd, sg in (("left", 1), ("right", -1)):
        m = "" if sg > 0 else "-"
        out[f"{sd}_wing"] = {"rotation": [f"{lerp(8, 28)} + {S(0)} * (3 + 5 * {AIR})", f"{m}({lerp(26, 12)} + {S(0)} * 36 * {A})", f"{m}({lerp(27, 46)} + {S(0)} * 14 * {A})"],
                             "scale": "(0.85 + 0.07 * query.property('etheria:tier'))"}
        out[f"{sd}_wing_mid"] = {"rotation": [lerp(0, -2), f"{m}({lerp(-22, 22)} + {S(50)} * 26 * {A})", f"{m}({S(50)} * 5 * {A})"]}
        out[f"{sd}_wing_end"] = {"rotation": [f"{lerp(0, -6)} + {S(95)} * 6 * {A}", f"{m}({lerp(62, -6)} + {S(95)} * 28 * {A})", 0]}
    return out
WING = re.compile(r"^(wing\d?[BC]?_[lr]|dw[UD]_.*_[lr])$")
def main():
    AN = json.load(open(SRC)); n = 0
    for key, a in AN["animations"].items():
        if not key.startswith("animation.etheria.race_"): continue
        for b in list(a.get("bones", {})):
            v = a["bones"][b]
            if WING.match(b) and "rotation" in v:
                del v["rotation"]; n += 1
                if not v: del a["bones"][b]
    json.dump(AN, open(SRC, "w"), indent=1)
    tp = os.path.join(RP, "animations/tensura_race.animation.json"); TA = json.load(open(tp)); T = TA["animations"]
    T["animation.tensura.race.ewings"] = {"loop": True, "animation_length": 3600, "bones": {**etheria_bones(), **drake_bones()}}
    for w in ("w_idle", "w_walk", "w_fly"): T[f"animation.tensura.race.{w}"]["bones"].update(mod_wing_bones())
    json.dump(TA, open(tp, "w"), indent=1)
    ep = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(ep)); de = E["minecraft:client_entity"]["description"]
    de["animations"]["tr_ewings"] = "animation.tensura.race.ewings"
    sa = de["scripts"]["animate"]
    if not any(isinstance(x, dict) and "tr_ewings" in x for x in sa): sa.append({"tr_ewings": "query.property('etheria:tier') > 0"})
    pre = de["scripts"]["pre_animation"]; pre[:] = [s for s in pre if not s.startswith("variable.wb_")]
    json.dump(E, open(ep, "w"), indent=1, ensure_ascii=False)
    s = json.dumps(T["animation.tensura.race.ewings"]) + json.dumps(T["animation.tensura.race.w_fly"])
    print("rotações de asa tiradas das raças:", n, "| vertical_speed/variable na batida:", "vertical_speed" in s, "variable." in s)
if __name__ == "__main__": main()

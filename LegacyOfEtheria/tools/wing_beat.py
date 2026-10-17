"""7.6 - BATIDA DE ASA ÚNICA para todas as raças (corpo Etheria, asas do mod, Dragonato alado e linhagens).
A fase da batida (variable.wb_ph) é ACUMULADA no pre_animation do jogador: a velocidade muda suave entre parado/andando/voando
(antes sin(anim_time * F) dava saltos ao trocar F). Amplitude e abertura também interpolam (wb_a, wb_k, wb_f, wb_s, wb_gd).
  parado: batida calma e visível · andando: média · voando: forte e rápida · caindo rápido: abertas planando · agachado: recolhidas.
Uso: python3 tools/wing_beat.py (idempotente)"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
PRE = [
    "variable.wb_air = query.is_on_ground ? 0.0 : 1.0;",
    "variable.wb_fall = (!query.is_on_ground && query.vertical_speed < -1.0) ? 1.0 : 0.0;",
    "variable.wb_sn = (query.is_sneaking && query.is_on_ground) ? 1.0 : 0.0;",
    "variable.wb_mv = math.min(1, query.modified_move_speed * 3);",
    "variable.wb_dt = math.min(0.1, query.delta_time);",
    "variable.wb_ph = math.mod(variable.wb_ph + variable.wb_dt * (variable.wb_air ? (variable.wb_fall ? 140 : 560) : (150 + 190 * variable.wb_mv)), 360);",
    "variable.wb_t = math.min(1, variable.wb_dt * 6);",
    "variable.wb_k = math.lerp(variable.wb_k, variable.wb_air * (1 - variable.wb_fall), variable.wb_t);",
    "variable.wb_f = math.lerp(variable.wb_f, variable.wb_fall, variable.wb_t);",
    "variable.wb_s = math.lerp(variable.wb_s, variable.wb_sn, variable.wb_t);",
    "variable.wb_gd = math.lerp(variable.wb_gd, 1 - variable.wb_air, variable.wb_t);",
    "variable.wb_a = math.lerp(variable.wb_a, variable.wb_air ? (variable.wb_fall ? 0.15 : 1.0) : (variable.wb_sn ? 0.0 : 0.4 + 0.3 * variable.wb_mv), variable.wb_t);",
]
def S(lag): return f"math.sin(variable.wb_ph - {lag})" if lag else "math.sin(variable.wb_ph)"
A, K, F, SN, GD, MV = "variable.wb_a", "variable.wb_k", "variable.wb_f", "variable.wb_s", "variable.wb_gd", "variable.wb_mv"

def etheria(pres):   # asas de penas/membrana do corpo Etheria (wing, wing2, wing3 + segmentos B/C)
    out = {}
    for i, pre in enumerate(pres):
        lag = i * 30
        for sd, sg in (("l", 1), ("r", -1)):
            out[f"{pre}_{sd}"] = {"rotation": [
                f"{S(lag)} * 5 * {K} - 8 * {F}",
                f"{sg} * (18 * {SN} - 8 * {K} - 12 * {F} + 6 * {MV} * {GD})",
                f"{sg} * ({S(lag)} * 44 * {A} + 8 * {K} + 14 * {F} - 16 * {SN})"]}
            out[f"{pre}B_{sd}"] = {"rotation": [0, 0, f"{sg} * ({S(lag + 50)} * 25 * {A} - 10 * {SN} - 6 * {F})"]}
            out[f"{pre}C_{sd}"] = {"rotation": [0, 0, f"{sg} * ({S(lag + 95)} * 30 * {A} - 12 * {SN} - 4 * {F})"]}
    return out

def lerp(a, b): return f"math.lerp({a}, {b}, {K})"
def mod_wings():     # asas do mod (left_wing / _mid / _end): semiabertas no chão, abertas no voo
    out = {}
    for sd, sg in (("left", 1), ("right", -1)):
        m = "" if sg > 0 else "-"
        out[f"{sd}_wing"] = {"rotation": [f"{lerp(8, 28)} + {S(0)} * (3 + 5 * {K})",
                                          f"{m}({lerp(26, 12)} + {S(0)} * 36 * {A})",
                                          f"{m}({lerp(27, 46)} + {S(0)} * 14 * {A})"]}
        out[f"{sd}_wing_mid"] = {"rotation": [f"{lerp(0, -2)}", f"{m}({lerp(-22, 22)} + {S(50)} * 26 * {A})", f"{m}({S(50)} * 5 * {A})"]}
        out[f"{sd}_wing_end"] = {"rotation": [f"{lerp(0, -6)} + {S(95)} * 6 * {A}", f"{m}({lerp(62, -6)} + {S(95)} * 28 * {A})", 0]}
    return out

def drake():         # Dragonato alado: dois pares (U em cima, D embaixo defasado)
    B = {}
    for P, k, ph in (("U", 1.0, 0), ("D", 0.72, 70)):
        for sd, sg in (("l", 1), ("r", -1)):
            B[f"dw{P}_root_{sd}"] = {"rotation": [f"{S(ph + 40)} * 6 * {A}",
                                                  f"{-sg} * (36 * {GD} + 20 * {SN} + 16 * {k} * {S(ph + 70)} * {A} * {K} + 4 * {F})",
                                                  f"{sg} * ({38 * k} * {S(ph)} * {A} - 6 * {K} - 14 * {F} - {34 * k} * {SN})"]}
            B[f"dw{P}_arm_{sd}"] = {"rotation": [0, 0, f"{sg} * ({14 * k} * {S(ph + 50)} * {A} - 20 * {SN})"]}
            B[f"dw{P}_fore_{sd}"] = {"rotation": [0, f"{-sg} * (10 * {S(ph + 95)} * {A} + 35 * {SN})",
                                                  f"{sg} * ({18 * k} * {S(ph + 90)} * {A} - 30 * {SN} + 4 * {F})"]}
            close = f"(2.5 * {GD} + 7 * {SN} + 2.5 * {S(ph + 120)} * {A} + 1.5 * {K})"
            for i in range(4):
                B[f"dw{P}_f{i}_{sd}"] = {"rotation": [0, 0, f"{-sg * (3 - i)} * {close}"]}
                if i < 3: B[f"dw{P}_m{i}_{sd}"] = {"rotation": [f"{S(ph + 60 + i * 35)} * (1.5 + 3.5 * {A})", 0, 0]}
    return B

def lineage():       # forma humana das linhagens (wing_l/_r varrem em y)
    return {"wing_l": {"rotation": [0, f"-(32 + {S(0)} * 28 * {A} + 10 * {K})", f"{S(0)} * 18 * {A}"]},
            "wing_r": {"rotation": [0, f"(32 + {S(0)} * 28 * {A} + 10 * {K})", f"-({S(0)} * 18 * {A})"]}}

def main():
    ap = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(ap)); n = {"etheria": 0, "drake": 0, "lin": 0}
    for key, a in AN["animations"].items():
        if not key.startswith("animation.etheria.race_"): continue
        bones = a.get("bones", {})
        if key.startswith("animation.etheria.race_lin_"):
            if "wing_l" in bones: bones.update(lineage()); n["lin"] += 1
        elif any(b.startswith("dwU_") for b in bones):
            bones.update({k: v for k, v in drake().items() if k in bones}); n["drake"] += 1
        else:
            pres = sorted({m.group(1) for b in bones if (m := re.match(r"^(wing\d?)_[lr]$", b))})
            if pres:
                for k, v in etheria(pres).items():
                    if k in bones: bones[k] = {**v, **({"scale": bones[k]["scale"]} if "scale" in bones[k] else {})}
                n["etheria"] += 1
    json.dump(AN, open(ap, "w"), indent=1)
    tp = os.path.join(RP, "animations/tensura_race.animation.json"); TA = json.load(open(tp))
    for w in ("w_idle", "w_walk", "w_fly"): TA["animations"][f"animation.tensura.race.{w}"]["bones"].update(mod_wings())
    json.dump(TA, open(tp, "w"), indent=1)
    ep = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(ep))
    pre = E["minecraft:client_entity"]["description"]["scripts"]["pre_animation"]
    pre[:] = [s for s in pre if not s.startswith("variable.wb_")] + PRE
    json.dump(E, open(ep, "w"), indent=1, ensure_ascii=False)
    print("asas:", n, "+ asas do mod (idle/walk/fly)")
if __name__ == "__main__": main()

# 7.7 - caudas: a cauda curva lilás do mod (tensura:tail = 1, Caído) é minúscula -> 1,5x; Bestial (cauda própria do corpo) abana mais
def tails():
    tp = os.path.join(RP, "animations/tensura_race.animation.json"); TA = json.load(open(tp))
    TA["animations"]["animation.tensura.race.tail"]["bones"].setdefault("tail", {})["scale"] = "query.property('tensura:tail') == 1 ? 1.5 : 1.0"
    json.dump(TA, open(tp, "w"), indent=1)
    ap = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(ap)); n = 0
    for key in ("animation.etheria.race_beastkin", "animation.etheria.race_beastkin_lord"):
        for b, v in AN["animations"][key]["bones"].items():
            if re.match(r"^tail\d$", b) and "rotation" in v:
                v["rotation"] = [re.sub(r"\) \* 3 \+", ") * 6 - 8 * (query.is_on_ground ? 0 : 1) +", str(v["rotation"][0])),
                                 str(v["rotation"][1]).replace("(7 + 9 * ", "(15 + 15 * "), v["rotation"][2]]; n += 1
    json.dump(AN, open(ap, "w"), indent=1); print("caudas: arch 1,5x + bestial", n, "ossos")
if __name__ == "__main__": tails()

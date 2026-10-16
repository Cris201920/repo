# 6.62 - BATIDA DAS ASAS em todos os estados, com fórmulas curtas e SÓ consultas já usadas no visual estável (6.57):
# query.is_on_ground, query.vertical_speed, query.modified_move_speed, query.is_sneaking, query.life_time.
#   parado: batida suave e lenta · andando: batida média · no ar: batida forte e rápida · caindo rápido: abertas planando
#   agachado no chão: recolhidas. Base -> meio -> ponta atrasadas (a onda percorre a asa), pares de asas defasados.
# Só reescreve os ossos wing* das animações animation.etheria.race_*. Uso: python3 tools/wing_flap.py  (idempotente)
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
AIR = "(query.is_on_ground ? 0 : 1)"
GLIDE = "((!query.is_on_ground && query.vertical_speed < -1.0) ? 1 : 0)"
WALK = "math.min(1, query.modified_move_speed * 3)"
SNEAK = "((query.is_sneaking && query.is_on_ground) ? 1 : 0)"
def wing(pres):
    out = {}
    for i, pre in enumerate(pres):
        lag = i * 30
        # frequência (graus/s) e amplitude por estado; escolhidas por ternário (curto e barato)
        F = f"(query.is_on_ground ? (200 + 140 * {WALK}) : (query.vertical_speed < -1.0 ? 90 : 640))"
        A = f"(query.is_on_ground ? (10 + 10 * {WALK}) * (1 - {SNEAK}) : (query.vertical_speed < -1.0 ? 5 : 44))"
        for side, sg in (("l", 1), ("r", -1)):
            out[f"{pre}_{side}"] = {"rotation": [
                f"math.sin(query.life_time * {F} - {lag}) * 5 * {AIR} - 8 * {GLIDE}",
                f"{sg} * (18 * {SNEAK} - 8 * {AIR} - 12 * {GLIDE} + 6 * {WALK} * (1 - {AIR}))",
                f"{sg} * (math.sin(query.life_time * {F} - {lag}) * {A} + 16 * {AIR} + 14 * {GLIDE} - 16 * {SNEAK})"]}
            out[f"{pre}B_{side}"] = {"rotation": [0, 0, f"{sg} * (math.sin(query.life_time * {F} - 50 - {lag}) * {A} * 0.45 - 10 * {SNEAK} - 6 * {GLIDE})"]}
            out[f"{pre}C_{side}"] = {"rotation": [0, 0, f"{sg} * (math.sin(query.life_time * {F} - 95 - {lag}) * {A} * 0.55 - 12 * {SNEAK} - 4 * {GLIDE})"]}
    return out
def main():
    ap = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(ap)); n = 0
    for key, a in AN["animations"].items():
        if not key.startswith("animation.etheria.race_") or key.startswith("animation.etheria.race_lin_"): continue   # linhagens: animação própria dos dragões
        bones = a.get("bones", {})
        pres = sorted({m.group(1) for b in bones if (m := re.match(r"^(wing\d?)_[lr]$", b))})
        if pres: bones.update(wing(pres)); n += 1
    json.dump(AN, open(ap, "w"), indent=1)
    print("animações com asas:", n)
if __name__ == "__main__": main()

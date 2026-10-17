"""7.8 - ASAS POR ESTÁGIO e EVOLUÇÃO das asas.
- etheria:tier (BP, int 0-6) = número do estágio da raça (+1 no Lorde Demônio): as asas crescem a cada evolução
  (0,92x no 1º estágio ... 1,2x no 5º), em todos os corpos com asas e nas asas do mod.
- Evolução (etheria:tfx = evo/lord): as asas nascem, abrem e dão batidas fortes antes de assentar (todas as raças com asas).
- Dragonato e Dragonato alado (Dragonoide 1/2, Homem-Lagarto 3/4) e as peças do mod (asas/cauda) ganham animação de evolução.
Uso: python3 tools/evo_wings.py (idempotente)"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
TS = "(0.85 + 0.07 * query.property('etheria:tier'))"
ROOTS = re.compile(r"^(wing\d?_[lr]|dw[UD]_root_[lr])$")
GROW = "math.clamp(query.anim_time / 1.2, 0, 1)"
ENV = "math.clamp((query.anim_time - 0.9) / 0.4, 0, 1) * math.clamp((3.0 - query.anim_time) / 0.7, 0, 1)"
def burst(sg, amp=42, axis=2):
    r = [0, 0, 0]; r[axis] = f"{sg} * math.sin((query.anim_time - 0.9) * 420) * {amp} * {ENV}"; return r
def sgn(b): return 1 if b.endswith("_l") else -1

def main():
    # BP: propriedade do estágio
    pp = os.path.join(BP, "entities/player.json"); P = json.load(open(pp))
    P["minecraft:entity"]["description"]["properties"]["etheria:tier"] = {"type": "int", "range": [0, 6], "default": 0, "client_sync": True}
    json.dump(P, open(pp, "w"), indent=1, ensure_ascii=False)
    ap = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(ap)); A = AN["animations"]; n = {"tier": 0, "burst": 0}
    for key, a in A.items():
        bones = a.get("bones", {})
        if key.startswith("animation.etheria.race_") and not key.startswith("animation.etheria.race_lin_"):
            for b, v in bones.items():
                if ROOTS.match(b):
                    s = v.get("scale", 1)
                    if "etheria:tier" not in json.dumps(s):
                        v["scale"] = TS if s in (1, "1") else f"{s} * {TS}"; n["tier"] += 1
        if re.match(r"animation\.etheria\.tfx_(evo|lord)_(?!lin_)", key):
            for b, v in bones.items():
                if ROOTS.match(b): v["rotation"] = burst(sgn(b)); n["burst"] += 1
    # evolução do Dragonato / Dragonato alado (não existia): chifres e asas duplas nascem e batem
    for body in ("dragonewt", "dragonewt_w"):
        base = A[f"animation.etheria.race_{body}"]["bones"]
        for kind in ("evo", "lord"):
            bn = {}
            for b in base:
                if b.startswith("horn") and not b.endswith("tip"): bn[b] = {"scale": [GROW] * 3}
                if ROOTS.match(b): bn[b] = {"scale": [GROW] * 3, "rotation": burst(sgn(b))}
            A[f"animation.etheria.tfx_{kind}_{body}"] = {"loop": False, "animation_length": 3.0, "bones": bn}
    json.dump(AN, open(ap, "w"), indent=1)
    # peças do mod: asas por estágio + evolução (asas e cauda nascem; asas batem forte)
    tp = os.path.join(RP, "animations/tensura_race.animation.json"); TA = json.load(open(tp)); T = TA["animations"]
    for w in ("w_idle", "w_walk", "w_fly", "w_fold"):
        for side in ("left_wing", "right_wing"): T[f"animation.tensura.race.{w}"]["bones"].setdefault(side, {})["scale"] = TS
    T["animation.tensura.race.tfx_evo"] = {"loop": False, "animation_length": 3.0, "bones": {
        "left_wing": {"scale": [GROW] * 3, "rotation": burst(1, 38, 1)}, "right_wing": {"scale": [GROW] * 3, "rotation": burst(-1, 38, 1)},
        "tail": {"scale": [GROW] * 3}, "tr_lt0": {"scale": [GROW] * 3}}}
    json.dump(TA, open(tp, "w"), indent=1)
    # player.entity: liga as novas animações
    ep = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(ep)); de = E["minecraft:client_entity"]["description"]
    anim, sa = de["animations"], de["scripts"]["animate"]
    names = {(x if isinstance(x, str) else next(iter(x))) for x in sa}
    want = {"tr_tfx_evo": ("animation.tensura.race.tfx_evo", "(query.property('etheria:tfx') == 'evo' || query.property('etheria:tfx') == 'lord') && (query.property('tensura:wings') > 0 || query.property('tensura:tail') > 0)")}
    for body in ("dragonewt", "dragonewt_w"):
        for kind in ("evo", "lord"):
            want[f"etheria_tfx_{kind}_{body}"] = (f"animation.etheria.tfx_{kind}_{body}", f"(query.property('etheria:race') == '{body}' && query.property('etheria:lin') == 'none') && query.property('etheria:tfx') == '{kind}'")
    for k, (a, c) in want.items():
        anim[k] = a
        if k not in names: sa.append({k: c})
    json.dump(E, open(ep, "w"), indent=1, ensure_ascii=False)
    print(n, "+ tfx dragonato/mod ligados:", len(want))
if __name__ == "__main__": main()

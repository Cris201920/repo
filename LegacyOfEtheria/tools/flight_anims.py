# 6.58 - Aplica as animações de VOO novas (tools/race_wings.py: wing_anim/tail_anim) às animações de raça JÁ EXISTENTES, sem refazer
# modelos nem texturas (os modelos de asa que o jogador aprovou ficam intactos) e registra a propriedade etheria:fly no jogador (BP).
# Uso: python3 tools/flight_anims.py   (idempotente)
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from race_wings import wing_anim, tail_anim, PRE
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
ap = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(ap)); n = 0
for key, a in AN["animations"].items():
    if not key.startswith("animation.etheria.race_"): continue
    bones = a.get("bones", {})
    pres = sorted({m.group(1) for b in bones if (m := re.match(r"^(wing\d?)_[lr]$", b))})
    tails = sorted([b for b in bones if re.match(r"^tail\d+$", b)], key=lambda x: int(x[4:]))
    if pres: bones.update(wing_anim(pres)); n += 1
    if tails: bones.update(tail_anim(tails))
json.dump(AN, open(ap, "w"), indent=1)
pp = os.path.join(BP, "entities/player.json"); P = json.load(open(pp))
P["minecraft:entity"]["description"].setdefault("properties", {})["etheria:fly"] = {"type": "int", "range": [0, 4], "default": 0, "client_sync": True}
json.dump(P, open(pp, "w"), indent=1)
ep = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(ep)); sc = E["minecraft:client_entity"]["description"]["scripts"]
pa = [x for x in sc.get("pre_animation", []) if "v.ef_" not in x]
i = next((k + 1 for k, x in enumerate(pa) if "variable.etheria_air =" in x), len(pa))   # depois de etheria_land/etheria_air
sc["pre_animation"] = pa[:i] + PRE + pa[i:]
json.dump(E, open(ep, "w"), indent=1)
print("animações com asas:", n)

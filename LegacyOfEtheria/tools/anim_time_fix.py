"""Animações procedurais (sem keyframes) com loop e sem animation_length duram 0 s e reiniciam todo frame:
query.life_time/anim_time ficam ~0 e a parte (asas, cauda...) parece congelada. Dá duração longa e usa anim_time."""
import json, glob, os, re
RP = os.path.join(os.path.dirname(__file__), "..", "LegacyOfEtheria_RP")
n = 0
for f in glob.glob(os.path.join(RP, "animations", "*.json")):
    raw = open(f).read(); D = json.loads(raw); ch = False
    for k, v in D["animations"].items():
        s = json.dumps(v)
        if "animation_length" in v or v.get("loop") is not True: continue
        if "query.life_time" not in s and "query.anim_time" not in s: continue
        v2 = json.loads(s.replace("query.life_time", "query.anim_time")); v2["animation_length"] = 3600
        D["animations"][k] = v2; ch = True; n += 1
    if ch: json.dump(D, open(f, "w"), indent=1 if "\n" in raw[:200] else None)
print("corrigidas", n)

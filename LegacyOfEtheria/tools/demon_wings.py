# 6.74 - ASAS DO DEMÔNIO MAIS MODELADAS (jogador, etheria_race_demon), sem textura nova (reaproveita as UVs do próprio modelo):
#  - membrana de cada dedo em 2 lâminas (volume), mantendo o recorte da textura;
#  - membranas intermediárias entre os dedos (wingM*) fecham os buracos do leque;
#  - dedos afinam da base para a ponta; garra do polegar no pulso;
#  - animação: dedos abrem o leque no ar e se fecham no chão, com ondulação da membrana.
import json, os, copy, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
GP = os.path.join(RP, "models/entity/etheria_race_demon.geo.json")
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "race_geo_src", "demon.geo.json")
os.makedirs(os.path.dirname(SRC), exist_ok=True)
if not os.path.exists(SRC): shutil.copy(GP, SRC)
D = json.load(open(SRC)); G = D["minecraft:geometry"][0]; B = {b["name"]: b for b in G["bones"]}

def strips(p, k=1.0):
    """membrana em 2 lâminas (volume) mantendo o recorte da textura; k escala comprimento/altura (membranas intermediárias)."""
    o, s = p["origin"], p["size"]; top = o[1] + s[1]; out = []
    for dz in (-0.18, 0.18):
        n = copy.deepcopy(p); n["size"] = [s[0] * k, s[1] * k, 0.4]; n["origin"] = [o[0], top - s[1] * k, o[2] + 0.075 + dz]
        out.append(n)
    return out

def finger(c):
    """dedo de espessura constante -> base grossa + ponta fina"""
    o, s = c["origin"], c["size"]; a = copy.deepcopy(c); b = copy.deepcopy(c)
    a["size"] = [s[0] * 0.55, s[1], s[2]]
    b["origin"] = [o[0] + s[0] * 0.55, o[1] + 0.2, o[2] + 0.2]; b["size"] = [s[0] * 0.45, s[1] - 0.4, s[2] - 0.4]
    return [a, b]

def claw(base, x, y, z, sg, rz):
    c = copy.deepcopy(base); c["origin"] = [x, y, z]; c["size"] = [0.9, 1.6, 0.8]
    c["pivot"] = [x + 0.45, y + 1.6, z + 0.4]; c["rotation"] = [0, 0, sg * rz]
    t = copy.deepcopy(c); t["origin"] = [x + 0.15, y - 0.9, z + 0.15]; t["size"] = [0.6, 1.0, 0.5]; t["rotation"] = [0, 0, sg * (rz + 35)]
    return [c, t]

new_bones = []
for sd, sg in (("l", 1), ("r", -1)):
    fingers = [B[f"wingF{i}_{sd}"] for i in range(5)]
    for i, F in enumerate(fingers):
        bone_c, knob, mem = F["cubes"]
        F["cubes"] = finger(bone_c) + strips(mem)
        F["cubes"].append(knob)   # ponta do dedo (garra original)
    for i in range(4):   # membranas intermediárias entre dedos vizinhos
        A, Bn = fingers[i], fingers[i + 1]
        ra, rb = A["rotation"][2], Bn["rotation"][2]
        ka = (Bn["cubes"][0]["size"][0] / 0.55 + A["cubes"][0]["size"][0] / 0.55) / 2 / (A["cubes"][0]["size"][0] / 0.55) * 0.95
        src_mem = copy.deepcopy([c for c in json.load(open(SRC))["minecraft:geometry"][0]["bones"] if c["name"] == A["name"]][0]["cubes"][2])
        src_mem["origin"][2] += 0.12
        new_bones.append({"name": f"wingM{i}_{sd}", "parent": f"wingC_{sd}", "pivot": list(A["pivot"]), "rotation": [0, 0, (ra + rb) / 2],
                          "cubes": strips(src_mem, ka)})
    # garra do polegar no pulso
    C = B[f"wingC_{sd}"]; C["cubes"] = C["cubes"] + claw(fingers[0]["cubes"][-1], C["pivot"][0] - 0.45, C["pivot"][1] + 1.6, 2.2, sg, 25)
idx = max(i for i, b in enumerate(G["bones"]) if b["name"].startswith("wingF"))
G["bones"][idx + 1:idx + 1] = new_bones
json.dump(D, open(GP, "w"), indent=1)

# animação dos dedos: leque abre no ar, fecha no chão; ondulação leve que corre da base para a ponta
AP = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(AP))
bones = AN["animations"]["animation.etheria.race_demon"]["bones"]
for k in [k for k in bones if k.startswith(("wingF", "wingM"))]: del bones[k]
spread = "(query.is_on_ground ? (query.is_sneaking ? -5 : -2.5) : 3)"
for sd, sg in (("l", 1), ("r", -1)):
    for i in range(5):
        bones[f"wingF{i}_{sd}"] = {"rotation": [0, f"math.sin(query.life_time * 160 - {i * 30}) * 2", f"{sg} * ({i} * {spread})"]}
    for i in range(4):
        bones[f"wingM{i}_{sd}"] = {"rotation": [0, f"math.sin(query.life_time * 160 - {i * 30 + 15}) * 2", f"{sg} * ({i + 0.5} * {spread})"]}
json.dump(AN, open(AP, "w"), indent=1)
print("demônio ok", len(G["bones"]), "ossos")

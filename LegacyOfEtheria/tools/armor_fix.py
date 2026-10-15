# 6.42 - ARMADURAS ENQUADRADAS NO PERSONAGEM: corrige as geometrias de armadura (attachables) para o esqueleto do jogador do Bedrock.
#  1) Os modelos GeckoLib do mod trazem as peças dos braços do lado trocado (a peça "rightArm" fica em +X, onde está o braço ESQUERDO
#     do jogador no Bedrock): a ombreira aparecia no braço errado e se mexia com o outro braço. Aqui o osso é trocado pelo lado
#     onde a peça realmente está (o mesmo vale para pernas, se ocorrer).
#  2) Os ossos do esqueleto (head/body/braços/pernas) recebem os mesmos pivôs do jogador (ex.: perna em y=12, não 22), sem pai e sem
#     rotação de repouso - assim a peça gira junto com o membro ao andar/atacar em vez de "descolar".
# Idempotente. Uso: python3 tools/armor_fix.py
import json, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
PIV = {"head": [0, 24, 0], "body": [0, 24, 0], "rightArm": [-5, 22, 0], "leftArm": [5, 22, 0], "rightLeg": [-1.9, 12, 0], "leftLeg": [1.9, 12, 0]}
SIDE = {"rightArm": -1, "leftArm": 1, "rightLeg": -1, "leftLeg": 1}
OPP = {"rightArm": "leftArm", "leftArm": "rightArm", "rightLeg": "leftLeg", "leftLeg": "rightLeg"}

def root_of(bones, name):
    by = {b["name"]: b for b in bones}; b = by[name]
    while b.get("parent") and b["parent"] in by: b = by[b["parent"]]
    return b["name"]

def fix_geometry(G):
    bones = G["bones"]; changed = False
    names = {b["name"] for b in bones}
    mean = {}
    for b in bones:
        r = root_of(bones, b["name"])
        for c in b.get("cubes", []): mean.setdefault(r, []).append(c["origin"][0] + c["size"][0] / 2)
    mx = {k: sum(v) / len(v) for k, v in mean.items()}
    swap = {}
    for a, b in (("rightArm", "leftArm"), ("rightLeg", "leftLeg")):
        wa = a in mx and mx[a] * SIDE[a] < 0; wb = b in mx and mx[b] * SIDE[b] < 0
        if (wa or wb) and not (a in mx and not wa) and not (b in mx and not wb):
            swap[a], swap[b] = b, a
    if swap:
        for b in bones:
            if b["name"] in swap: b["name"] = swap[b["name"]]
            elif b.get("parent") in swap: b["parent"] = swap[b["parent"]]
        changed = True
    for b in bones:
        if b["name"] in PIV:
            if b.get("pivot") != PIV[b["name"]] or b.get("parent") or b.get("rotation"):
                b["pivot"] = list(PIV[b["name"]]); b.pop("parent", None); b.pop("rotation", None); changed = True
    return changed, swap

def main():
    geos = {}
    for f in glob.glob(os.path.join(RP, "models/entity/*.json")):
        try: d = json.load(open(f))
        except Exception: continue
        for G in d.get("minecraft:geometry", []): geos[G["description"]["identifier"]] = f
    files = set()
    for a in glob.glob(os.path.join(RP, "attachables/*.json")):
        if os.path.basename(a).startswith(("w_", "pose_test")): continue
        gid = json.load(open(a))["minecraft:attachable"]["description"]["geometry"]["default"]
        if gid in geos: files.add(geos[gid])
    n = 0
    for f in sorted(files):
        d = json.load(open(f)); ch = False
        for G in d["minecraft:geometry"]:
            c, sw = fix_geometry(G); ch |= c
            if sw: print("lado corrigido:", G["description"]["identifier"], sw)
        if ch: json.dump(d, open(f, "w"), indent=1); n += 1
    print(n, "geometrias de armadura ajustadas ao esqueleto do jogador")
if __name__ == "__main__": main()

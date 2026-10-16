# 6.62 - ASAS COM VOLUME (pedido: "tá muito fina, mais grossa, com profundidade").
# Antes: membranas com 0,18 de espessura e penas com 0,22 — de lado pareciam folhas de papel.
# Agora: membranas 0,6; penas 0,55 em camadas levemente defasadas na profundidade (efeito de plumagem); ossos/articulações da asa
# (braço, antebraço, dedos) com no mínimo 1,4 de grossura. A espessura cresce a partir do CENTRO de cada peça, então o desenho e o
# encaixe das asas aprovadas não mudam — só ganham corpo. UV por face: a textura continua a mesma.
# Só mexe em ossos wing*. Idempotente (alvos absolutos). Uso: python3 tools/wing_depth.py
import json, glob, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
MEMBRANE, FEATHER, SPAR = 0.6, 0.55, 1.4
def is_feather(c):   # penas: placas com textura própria (uv grande); membranas: placas finas largas
    u = c.get("uv", {}); n = u.get("north", {}) if isinstance(u, dict) else {}
    return abs(n.get("uv_size", [0, 0])[1]) >= 32
def main():
    n_geo = n_cube = 0
    for f in sorted(glob.glob(os.path.join(RP, "models/entity/etheria_race_*.geo.json"))):
        D = json.load(open(f)); G = D["minecraft:geometry"][0]; ch = False
        for b in G["bones"]:
            if not b["name"].startswith("wing"): continue
            for i, c in enumerate(b.get("cubes", [])):
                s, o = list(c["size"]), list(c["origin"])
                ax = min(range(3), key=lambda k: s[k]); mid = sorted(range(3), key=lambda k: s[k])[1]
                plate = is_feather(c) or s[ax] < 0.5 or abs(s[ax] - MEMBRANE) < 0.01 or abs(s[ax] - FEATHER) < 0.01
                if plate:                                                          # placa (pena ou membrana)
                    tgt = FEATHER if is_feather(c) else MEMBRANE
                    if s[ax] >= tgt - 0.01: continue                               # já engrossada
                    layer = (0.12 if i % 2 else -0.12) if is_feather(c) else 0.0   # camadas da plumagem (só na 1ª vez)
                    o[ax] -= (tgt - s[ax]) / 2 - layer; s[ax] = tgt
                elif s[ax] < SPAR and s[mid] < SPAR * 1.6 and max(s) > 2.5:     # osso da asa (braço/antebraço/dedo)
                    for k in (ax, mid):
                        if s[k] < SPAR: o[k] -= (SPAR - s[k]) / 2; s[k] = SPAR
                else: continue
                if [round(x, 3) for x in s] != c["size"]:
                    c["size"] = [round(x, 3) for x in s]; c["origin"] = [round(x, 3) for x in o]; ch = True; n_cube += 1
        if ch: json.dump(D, open(f, "w"), indent=1); n_geo += 1
    print("modelos:", n_geo, "| peças engrossadas:", n_cube)
if __name__ == "__main__": main()

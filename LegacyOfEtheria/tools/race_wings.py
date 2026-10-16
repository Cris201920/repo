# 6.46 - ASAS DAS RAÇAS ANGELICAIS DO JOGADOR (anjo, arcanjo, querubim, serafim, caído, lorde caído) com o mesmo construtor das asas dos anjos
# (tools/angels.py): asas articuladas com penas em camadas. Querubim 2 pares, serafim 3 pares, arcanjo maior.
# Mantém o que não é asa (auréola, chifres) com a paleta original (copiada no canto da textura nova, mesmas coordenadas de UV).
# Também reescreve só a parte das ASAS das animações de raça (animation.etheria.race_<raça>): respiração parado, abertura ao andar,
# batida forte no ar e recolhimento ao agachar.
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import angels as A
RP = A.RP
RACES = {   # cores das penas (base, meio, ponta), borda, barra, envergadura, pares [(prefixo, rotação raiz, altura)]
  "angel":        dict(w=("#ffffff", "#eef0f8", "#d8dcec"), edge="#e8d27a", bar="#e6e6f0", span=1.5, pairs=[("wing", (-6, -24, 44), 22.5)]),
  "angel_arch":   dict(w=("#ffffff", "#f2f2fa", "#e2c860"), edge="#e2b83a", bar="#e6e6f0", span=1.7, pairs=[("wing", (-6, -24, 46), 22.5)]),
  "angel_cherub": dict(w=("#fff8f0", "#f4ecf8", "#e0d4f0"), edge="#e8c8a8", bar="#ece8f2", span=1.25, pairs=[("wing", (-6, -24, 50), 22.5), ("wing2", (-4, -30, 6), 19.0)]),
  "angel_seraph": dict(w=("#ffffff", "#fff4d8", "#ffd27a"), edge="#ffb84a", bar="#f2ecd8", span=1.2, pairs=[("wing", (-8, -22, 62), 23.5), ("wing2", (-4, -28, 22), 20.5), ("wing3", (-2, -34, -18), 17.5)]),
  "fallen":       dict(w=("#4a4652", "#2a2630", "#16141a"), edge="#5a5466", bar="#24212a", span=1.45, pairs=[("wing", (-6, -24, 40), 22.5)]),
  "fallen_lord":  dict(w=("#2a2630", "#16141c", "#0a090c"), edge="#8a2a3a", bar="#1c1a22", span=1.4, pairs=[("wing", (-6, -24, 44), 22.5)]),
}
def hx(c): return A.hexc(c)

def build(race, R):
    tp = os.path.join(RP, f"textures/entity/etheria_race_{race}.png"); gp = os.path.join(RP, f"models/entity/etheria_race_{race}.geo.json")
    src = os.path.join(os.path.dirname(__file__), "race_src", f"{race}.png")
    os.makedirs(os.path.dirname(src), exist_ok=True)
    if not os.path.exists(src): Image.open(tp).convert("RGBA").save(src)                  # paleta original (auréola, chifres)
    pal = Image.open(src).convert("RGBA")
    img = Image.new("RGBA", (A.TW, A.TH), (0, 0, 0, 0)); img.paste(pal, (0, 0))
    at = A.Atlas(img)
    d = json.load(open(gp)); G = d["minecraft:geometry"][0]
    keep = [b for b in G["bones"] if not b["name"].startswith("wing")]
    g = A.Geo(G["description"]["identifier"]); g.bones = keep; g.idx = {b["name"]: b for b in keep}
    for b in keep: b.setdefault("cubes", [])
    cb, cs, ct = [hx(c) for c in R["w"]]; ed = hx(R["edge"])
    small = at.feather("small", A.p_feather(A.shade(cb, 1.05), cb, ed)); cov = at.feather("cov", A.p_feather(cb, cs, ed))
    sec = at.feather("sec", A.p_feather(cb, cs, ed, mid=A.mix(cb, cs, 0.6))); pri = at.feather("pri", A.p_feather(cs, ct, ed, mid=A.mix(cs, ct, 0.35), round_tip=False))
    bar = at.tile("bar", A.p_cloth(hx(R["bar"]), fold=False))
    for pre, rot, y in R["pairs"]:
        A.wings(g, {}, cov, sec, pri, bar, R["span"], None, small, pre=pre, root_rot=rot, y0=y, bj=-14, cj=-18, root_x=2.0)
    out = g.json(); out["minecraft:geometry"][0]["description"].update({k: v for k, v in G["description"].items() if k.startswith("visible")})
    out["minecraft:geometry"][0]["description"]["visible_bounds_width"] = 6
    img.save(tp); json.dump(out, open(gp, "w"), indent=1)
    return [p for p, _, _ in R["pairs"]]

# 6.58: estados do VOO vindos do script (propriedade do jogador etheria:fly): 0 chão · 1 pairando · 2 subindo/decolando · 3 planando · 4 descendo.
FP = "query.property('etheria:fly')"
def _st():
    hov, clb, gld, dsc = (f"({FP} == {k} ? 1 : 0)" for k in (1, 2, 3, 4))
    flyer = f"({FP} > 0 ? 1 : 0)"; air = f"(({FP} == 0 && !query.is_on_ground) ? 1 : 0)"   # pulo/queda sem voar: asas meio abertas (equilíbrio)
    gnd = f"(1 - {flyer} - {air})"
    lnd = "((query.life_time - variable.etheria_land) < 0.45 ? 1 : 0)"                     # pouso: abre e freia, depois recolhe
    turn = "math.clamp(query.yaw_speed / 240, -1, 1)"                                          # curvas: uma asa sobe e a outra desce (inclinação)
    return hov, clb, gld, dsc, flyer, air, gnd, lnd, turn
def wing_anim(pres):
    """6.58: asas com estados reais do voo — recolher (agachado no chão), abrir, decolar/subir (batida forte e rápida), pairar (batida média),
    planar (abertas, ondulação lenta, inclinam nas curvas), descer (abertas para trás, batida curta), pouso (abre e freia) e pulo sem voar
    (meio abertas). As fases encadeiam base -> meio -> ponta (atraso por segmento e por par de asas)."""
    hov, clb, gld, dsc, flyer, air, gnd, lnd, turn = _st()
    walk = "math.min(1, query.modified_move_speed * 3)"; sneak = "(query.is_sneaking ? 1 : 0)"
    W = f"(300 * {dsc} + 420 * {hov} + 640 * {clb} + 90 * {gld} + 160 * {gnd} + 160 * {air})"   # frequência (graus/s)
    AMP = f"(12 * {dsc} + 30 * {hov} + 46 * {clb} + 4 * {gld} + 8 * {air})"                    # amplitude da batida
    OPEN = f"(16 * {hov} + 12 * {clb} + 28 * {gld} + 30 * {dsc} + 14 * {air} + 34 * {lnd})"     # abertura média
    out = {}
    for i, pre in enumerate(pres):
        lag = i * 25
        ph = f"math.sin(query.life_time * {W} - {lag})"
        for side, sg in (("l", 1), ("r", -1)):
            out[f"{pre}_{side}"] = {"rotation": [
                f"{ph} * 4 * ({hov} + {clb}) - 8 * {gld} + 10 * {dsc} - 12 * {lnd}",
                f"{sg} * (-6 * {flyer} + 10 * {walk} * {gnd} + 18 * {sneak} * {gnd} + math.sin(query.life_time * 60) * 5 * {gnd} - 14 * {gld} - 8 * {dsc})",
                f"{sg} * (math.sin(query.life_time * 80 - {lag}) * 6 * {gnd} + {OPEN} + {ph} * {AMP} - 14 * {sneak} * {gnd}) + 12 * {turn} * ({gld} + {hov} + {clb})"]}
            out[f"{pre}B_{side}"] = {"rotation": [0, 0, f"{sg} * (math.sin(query.life_time * {W} - 45 - {lag}) * {AMP} * 0.4 + math.sin(query.life_time * 80 - 30) * 2 * {gnd} - 10 * {sneak} * {gnd} - 6 * {gld} + 8 * {lnd})"]}
            out[f"{pre}C_{side}"] = {"rotation": [0, 0, f"{sg} * (math.sin(query.life_time * {W} - 90 - {lag}) * {AMP} * 0.5 + math.sin(query.life_time * 80 - 60) * 3 * {gnd} - 12 * {sneak} * {gnd} - 4 * {gld} + 10 * {lnd})"]}
    return out

def tail_anim(names):
    """6.58: cauda segmentada que reage a tudo: balanço lento parado, mais rápido andando, erguida correndo, sobe no pulo e fica para cima
    na queda, reta para trás voando (ondula como leme e acompanha as curvas), abaixada agachado. Cada segmento atrasa a onda (chicote)."""
    hov, clb, gld, dsc, flyer, air, gnd, lnd, turn = _st()
    walk = "math.min(1, query.modified_move_speed * 3)"; sneak = "(query.is_sneaking ? 1 : 0)"
    rise = "(query.vertical_speed > 0.5 ? 1 : 0)"; fall = "(query.vertical_speed < -0.5 ? 1 : 0)"
    out = {}
    for k, n in enumerate(names):
        r0 = k == 0
        out[n] = {"rotation": [
            f"math.sin(query.life_time * 90 - {k * 25}) * 3 * {gnd} + {-10 if r0 else -3} * {walk} * {gnd} + {-18 if r0 else -4} * {flyer} + {10 if r0 else 2} * {sneak} * {gnd}"
            f" + {air} * ({8 if r0 else 3} * {rise} - {16 if r0 else 5} * {fall}) + {6 if r0 else 2} * {lnd} + {4 if r0 else 1} * {dsc}",
            f"math.sin(query.life_time * (70 + 140 * {walk} + 60 * {flyer}) - {k * 30}) * (6 + 6 * {walk} - 2 * {flyer}) - {turn} * {6 if r0 else 3} * {flyer}", 0]}
    return out

def main():
    ap = os.path.join(RP, "animations/etheria_race_parts.animation.json"); AN = json.load(open(ap))
    for race, R in RACES.items():
        pres = build(race, R)
        key = f"animation.etheria.race_{race}"
        if key in AN["animations"]:
            bones = {k: v for k, v in AN["animations"][key]["bones"].items() if not k.startswith("wing")}
            bones.update(wing_anim(pres)); AN["animations"][key]["bones"] = bones
        print(race, "pares de asas:", len(pres))
    json.dump(AN, open(ap, "w"), indent=1)
if __name__ == "__main__": main()

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

def wing_anim(pres):
    """6.52: asas com 4 estados — parado (respira), andando (abre um pouco), voando/subindo (batida forte) e
    planando ao cair (abertas e quase paradas); agachado recolhe. As fases encadeiam base -> meio -> ponta."""
    fly = "(1 - query.is_on_ground)"; walk = "math.min(1, query.modified_move_speed * 3)"; sneak = "(query.is_sneaking ? 1 : 0)"
    glide = "(query.is_on_ground ? 0 : (query.vertical_speed < -1.0 ? 1 : 0))"; flap = f"({fly} * (1 - {glide}))"
    out = {}
    for i, pre in enumerate(pres):
        lag = i * 25
        for side, sg in (("l", 1), ("r", -1)):
            out[f"{pre}_{side}"] = {"rotation": [f"math.sin(query.life_time * 160 - {lag}) * 2 * {flap} - 6 * {glide}",
                                                 f"{sg} * (-6 * {fly} + 10 * {walk} * (1 - {fly}) + 18 * {sneak} + math.sin(query.life_time * 60) * 5 * (1 - {fly}) - 14 * {glide})",
                                                 f"{sg} * (math.sin(query.life_time * 80 - {lag}) * 6 * (1 - {fly}) + {flap} * (14 + math.sin(query.life_time * 560 - {lag}) * 42) + {glide} * (24 + math.sin(query.life_time * 90) * 3) - 14 * {sneak})"]}
            out[f"{pre}B_{side}"] = {"rotation": [0, 0, f"{sg} * ({flap} * math.sin(query.life_time * 600 - 45 - {lag}) * 16 + math.sin(query.life_time * 80 - 30) * 2 * (1 - {fly}) - 10 * {sneak} - 6 * {glide})"]}
            out[f"{pre}C_{side}"] = {"rotation": [0, 0, f"{sg} * ({flap} * math.sin(query.life_time * 600 - 90 - {lag}) * 20 + math.sin(query.life_time * 80 - 60) * 3 * (1 - {fly}) - 12 * {sneak} - 4 * {glide})"]}
    return out

def tail_anim(names):
    """6.52: cauda que reage ao movimento: balanço lento parado, mais rápido andando, erguida correndo,
    reta para trás voando, abaixada agachado. Cada segmento atrasa a onda (efeito de chicote)."""
    walk = "math.min(1, query.modified_move_speed * 3)"; fly = "(1 - query.is_on_ground)"; sneak = "(query.is_sneaking ? 1 : 0)"
    out = {}
    for k, n in enumerate(names):
        lift = "-10" if k == 0 else "-3"
        out[n] = {"rotation": [f"math.sin(query.life_time * 90 - {k * 25}) * 3 * (1 - {fly}) + {lift} * {walk} * (1 - {fly}) + {'-18' if k == 0 else '-4'} * {fly} + {'10' if k == 0 else '2'} * {sneak}",
                               f"math.sin(query.life_time * (70 + 140 * {walk}) - {k * 30}) * (6 + 6 * {walk}) * (1 - 0.6 * {fly})", 0]}
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

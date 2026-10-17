# 6.70 - PEÇAS DE RAÇA TENSURA (asas, cauda arcana, orelhas, cauda de lagarto): profundidade + animações.
# Planos de espessura zero viram "lâminas" de 5 camadas (UV por face, mesma silhueta da textura) => volume visível de lado.
# Cauda de lagarto ganha ossos próprios (tr_lt*) para a onda não pegar em ossos "bone" de outros modelos.
# Reescreve animation.tensura.race.* (menos auras): respiração das asas, batida com follow-through, onda da cauda, orelhas mexendo.
import json, os, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); MD = os.path.join(RP, "models/entity/tensura/race")
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tensura_race_src")
LAYERS = [-0.3, -0.15, 0, 0.15, 0.3]

def src(name):
    os.makedirs(SRC, exist_ok=True); s = os.path.join(SRC, name)
    if not os.path.exists(s): shutil.copy(os.path.join(MD, name), s)
    return json.load(open(s))

def faces(c):
    (sx, sy, sz), (u, v), m = c["size"], c["uv"], c.get("mirror", False)
    if sx == 0:   # plano X: east/west
        a, b = {"uv": [u, v + sz], "uv_size": [sz, sy]}, {"uv": [u + sz, v + sz], "uv_size": [sz, sy]}
        if m: a, b = {"uv": [u + sz + sz, v + sz], "uv_size": [-sz, sy]}, {"uv": [u + sz, v + sz], "uv_size": [-sz, sy]}
        return 0, {"east": a, "west": b}
    a, b = {"uv": [u, v], "uv_size": [sx, sy]}, {"uv": [u + sx, v], "uv_size": [sx, sy]}   # plano Z: north/south
    if m: a, b = {"uv": [u + sx, v], "uv_size": [-sx, sy]}, {"uv": [u + sx + sx, v], "uv_size": [-sx, sy]}
    return 2, {"north": a, "south": b}

def thicken(geo):
    for b in geo["bones"]:
        out = []
        for c in b.get("cubes", []):
            if 0 not in c["size"]: out.append(c); continue
            ax, f = faces(c)
            for o in LAYERS:
                n = {k: v for k, v in c.items() if k not in ("uv", "mirror")}
                n["origin"] = list(c["origin"]); n["origin"][ax] += o; n["uv"] = f
                out.append(n)
        if out: b["cubes"] = out

def save(name, d): json.dump(d, open(os.path.join(MD, name), "w"), indent=1)

for name in ["wings.geo.json", "arch_tail.geo.json", "ears.geo.json"]:
    d = src(name)
    for g in d["minecraft:geometry"]: thicken(g)
    save(name, d)
d = src("liz_tail.geo.json")
ren = {"Tail": "tr_lt0", "bone": "tr_lt1", "bone2": "tr_lt2", "bone3": "tr_lt3", "bone4": "tr_lt4"}
for b in d["minecraft:geometry"][0]["bones"]:
    b["name"] = ren.get(b["name"], b["name"])
    if b.get("parent") in ren: b["parent"] = ren[b["parent"]]
save("liz_tail.geo.json", d)

# ---------- animações ----------
T = "query.life_time"
def wave(i, amp, ph):  # onda com atraso por segmento, mais forte andando
    return f"math.sin({T} * 110 - {ph * i}) * ({amp} + query.modified_move_speed * {amp * 3})"
def side(rot, s):  # espelha Y/Z para a asa direita
    return [rot[0], f"-({rot[1]})" if isinstance(rot[1], str) else -rot[1], f"-({rot[2]})" if isinstance(rot[2], str) else -rot[2]]
def wings(base, extra):
    out = {}
    for seg, (rx, ry, rz) in base.items():
        r = [f"{rx} + {extra[seg][0]}", f"{ry} + {extra[seg][1]}", f"{rz} + {extra[seg][2]}"]
        out["left_" + seg] = {"rotation": r}
        out["right_" + seg] = {"rotation": side(r, -1)}
    return out
br = f"math.sin({T} * 100)"
ap = os.path.join(RP, "animations/tensura_race.animation.json")
A = json.load(open(ap)); an = A["animations"]
# parado: respiração (abre/fecha leve) com a ponta atrasada
an["animation.tensura.race.w_idle"] = {"loop": True, "bones": {**wings(
    {"wing": (-17.5, 60, 0), "wing_mid": (0, -135, 0), "wing_end": (0, 140, 0)},
    {"wing": (f"{br} * 2", f"{br} * 4", f"{br} * 3"), "wing_mid": (0, f"math.sin({T} * 100 - 40) * -5", 0),
     "wing_end": (0, f"math.sin({T} * 100 - 80) * 6", 0)}),
    "tail": {"rotation": [f"-35 + {br} * 3", f"math.sin({T} * 70) * 6", 0]},
    "tail_mid": {"rotation": [f"35 + math.sin({T} * 100 - 40) * 4", f"math.sin({T} * 70 - 40) * 8", 0]},
    "tail_end": {"rotation": [f"47.5 + math.sin({T} * 100 - 80) * 5", f"math.sin({T} * 70 - 80) * 10", 0]}}}
# voo: batida com subida rápida/descida forte e follow-through; mais rápida subindo, planando caindo
fs = f"(query.vertical_speed > 0.05 ? 520 : (query.vertical_speed < -0.15 ? 200 : 380))"
fl = f"math.sin({T} * {fs})"
fl2 = f"math.sin({T} * {fs} - 50)"; fl3 = f"math.sin({T} * {fs} - 95)"
an["animation.tensura.race.w_fly"] = {"loop": True, "bones": {**wings(
    {"wing": (28, 12, 46), "wing_mid": (-2, 22, 0), "wing_end": (-6, -6, 0)},
    {"wing": (f"{fl} * 8", f"{fl} * 30", f"{fl} * 14"), "wing_mid": (0, f"{fl2} * 22", f"{fl2} * 4"),
     "wing_end": (f"{fl3} * 6", f"{fl3} * 24", 0)}),
    "tail": {"rotation": [f"-20 + {fl2} * 6", f"math.sin({T} * 90) * 5", 0]},
    "tail_mid": {"rotation": [f"10 + {fl3} * 8", 0, 0]}, "tail_end": {"rotation": [f"12 + {fl3} * 10", 0, 0]}}}
# cauda (sem asas): onda em cascata + leve balanço vertical; agachado fica rente
dip = "(query.is_sneaking ? 18 : 0)"
an["animation.tensura.race.tail"] = {"loop": True, "bones": {
    "tail": {"rotation": [f"-10 + {dip} + math.sin({T} * 160) * 3", wave(0, 7, 0), 0]},
    "tail_mid": {"rotation": [f"math.sin({T} * 160 - 40) * 4", wave(1, 9, 45), 0]},
    "tail_end": {"rotation": [f"math.sin({T} * 160 - 80) * 5", wave(2, 11, 45), 0]},
    **{f"tr_lt{i}": {"rotation": [f"{'-8 + ' + dip + ' + ' if i == 0 else ''}math.sin({T} * 160 - {i * 35}) * {2 + i}",
                                  wave(i, 5 + i * 2, 40), 0]} for i in range(5)}}}
# auréola: gira, flutua e inclina devagar
an["animation.tensura.race.halo"] = {"loop": True, "bones": {"halo": {"scale": 0.2,
    "rotation": [f"90 + math.sin({T} * 60) * 6", f"math.cos({T} * 50) * 6", f"{T} * 40"],
    "position": [0, f"6.5 + math.sin({T} * 120) * 0.35", 0]}}}
# orelhas: tremidinha ocasional, abaixam agachado, balançam andando
tw = lambda ph: f"(math.sin({T} * 23 + {ph}) > 0.96 ? math.sin({T} * 1400) * 14 : 0)"
mv = f"math.sin(query.anim_time * 400) * query.modified_move_speed * 20"
an["animation.tensura.race.ears"] = {"loop": True, "bones": {
    "left_ear": {"scale": 1.5, "rotation": [f"{mv}", 0, f"{tw(0)} + (query.is_sneaking ? -20 : 0) + math.sin({T} * 90) * 2"]},
    "right_ear": {"scale": 1.5, "rotation": [f"{mv}", 0, f"-({tw(1.7)}) + (query.is_sneaking ? 20 : 0) - math.sin({T} * 90) * 2"]}}}
json.dump(A, open(ap, "w"), indent=1)
print("ok")

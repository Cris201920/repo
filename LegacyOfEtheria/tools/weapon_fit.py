# 8.9.2 - ENCAIXE DAS ARMAS NA MÃO (1ª e 3ª pessoa), arma por arma, a partir da geometria REAL.
# Problema (prints do jogo): espadas/lanças flutuavam acima/ao lado do ombro e tinham tamanhos absurdos. Causas:
#   - a 3ª pessoa somava +6,+9,+1 ao osso ligado (calibração errada) -> arma ~9 px acima da mão e 6 px para fora;
#   - o cabo era procurado sempre no eixo Z, mas metade dos modelos tem a lâmina no eixo Y (ou diagonal) -> cabo errado;
#   - nenhuma escala na 3ª pessoa (modelos de 10 a 53 unidades).
# Método (mesmo esquema de uma katana de add-on do Marketplace que funciona no jogo: osso ligado com pivô no fim do cabo,
# rotação de repouso [90,0,0], lâmina em +Y; 3ª pessoa só desloca; 1ª pessoa gira [-21.1,59.9,-66.5] e desloca [5.77,5.41,4.29]):
#   1) nuvem de pontos dos cubos (com rotações de cubo/osso) -> eixo principal = lâmina; 2º eixo = largura da lâmina;
#   2) cabo = projeção, no eixo, do ponto de empunhadura do modelo original (onde o mod segurava) -> lado do pomo;
#   3) escala para o comprimento-alvo do tipo (adaga 11, espada 18, katana 21, montante 24, machado 16, foice 28, haste 32);
#   4) a geometria vira: eth_weapon (ligado à mão, pivô [-6,14,0], rot [90,0,0], sem cubos) -> eth_fix (gira o modelo para
#      lâmina em +Y / largura em +Z) -> eth_body (o antigo eth_weapon, transladado para o cabo ficar 4,5 acima do pivô).
#      Só há translação e rotação de ossos: as UVs não mudam.
# Idempotente: desfaz o encaixe anterior (registro em weapon_grip.json -> "fit") antes de recalcular.
import json, math, os
import numpy as np

PIV = np.array([-6.0, 14.0, 0.0]); REST = [90.0, 0.0, 0.0]; GRIP_UP = 4.5
FP_ROT = [-21.1, 59.9, -66.5]; FP_POS = [5.77, 5.41, 4.29]
TP_TILT = 35.0                                   # lâmina 35° acima da horizontal na 3ª pessoa (ref. sem inclinação: 0)
TP_GRIP = np.array([-0.5, 0.0, 2.5])             # onde a katana de referência deixa o centro do cabo (relativo ao pivô ligado)
TARGET = {"dagger": 11, "short": 14, "sword": 18, "katana": 21, "great": 24, "axe": 16, "scythe": 28, "pole": 32}
KIND = {  # por id de geometria (o resto é deduzido do nome)
    "re_dagger": "short", "fiery_dagger": "dagger", "shadow_dagger": "dagger", "tt_kunai": "dagger", "tt_spatial_blades": "dagger",
    "tt_gobuta_kodachi": "short", "tt_crimson_lotus_edge": "short", "extermination_blade": "sword",
    "yamato": "katana", "kusanagi": "katana", "uraku_katana": "katana", "rimuru_katana": "katana", "tt_katana": "katana",
    "claymore": "great", "celestial_blade": "great", "mirror_sword_gold": "great", "mirror_sword_blood": "great",
    "reid_dragon_sword": "great", "re_sword_9": "great", "re_sword_1": "great", "re_sword_3": "great", "re_sword_4": "great",
    "re_sword_10": "great", "eagle_fang": "great", "tt_dead_end_rainbow": "katana", "tt_shizue_sword": "katana",
    "tt_ice_blade": "katana", "soul_serpent_blade": "katana", "green_dragon_blade": "great", "boreal_blade": "katana",
    "berserker_axe": "axe", "dead_mans_hand": "axe", "geb": "axe", "goblin_king_club": "axe", "tt_battle_axe": "axe",
    "tt_orc_axe": "axe", "tt_orc_cleaver": "axe", "re_scythe": "scythe", "reaper_scythe": "scythe",
    "caedros_ashen_halberd": "pole", "sea_dragons_trident": "pole", "wyrm_spear": "pole"}
def kind_of(sid):
    if sid in KIND: return KIND[sid]
    for k, v in (("great_sword", "great"), ("short_sword", "short"), ("long_sword", "katana"), ("katana", "katana"), ("dagger", "dagger"),
                 ("scythe", "scythe"), ("spear", "pole"), ("lance", "pole"), ("halberd", "pole"), ("trident", "pole"), ("axe", "axe")):
        if k in sid: return v
    return "sword"

def Rm(rx, ry, rz):
    x, y, z = [math.radians(v) for v in (rx, ry, rz)]
    Rx = np.array([[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]])
    Ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    Rz = np.array([[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]])
    return Rz @ Ry @ Rx
def brot(r):                                     # rotação de osso/cubo do Bedrock (X e Y invertidos)
    return Rm(-r[0], -r[1], r[2])
def to_euler(R):                                 # inverso de brot (R = Rz(c) Ry(b) Rx(a); a=-rx, b=-ry, c=rz), com caso de trava (gimbal)
    if abs(R[2, 0]) > 0.99999:
        b = -math.copysign(math.pi / 2, R[2, 0]); c = 0.0; a = math.atan2(-R[2, 0] * R[0, 1], R[1, 1])
    else:
        b = -math.asin(R[2, 0]); a = math.atan2(R[2, 1], R[2, 2]); c = math.atan2(R[1, 0], R[0, 0])
    e = [round(-math.degrees(a), 3) + 0.0, round(-math.degrees(b), 3) + 0.0, round(math.degrees(c), 3) + 0.0]
    assert np.abs(brot(e) - R).max() < 1e-3, ("euler", e)
    return e
def M4(rot, piv):
    m = np.eye(4); r = brot(rot); p = np.array(piv, float); m[:3, :3] = r; m[:3, 3] = p - r @ p; return m

def subtree(bones, root):
    names = {root}; ch = True
    while ch:
        ch = False
        for b in bones:
            if b.get("parent") in names and b["name"] not in names: names.add(b["name"]); ch = True
    return [b for b in bones if b["name"] in names]

def cloud(bones, root):
    """pontos (cantos dos cubos) e pesos no espaço do osso ligado (sem a rotação do próprio osso ligado)"""
    by = {b["name"]: b for b in bones}; W = {}
    def world(n):
        if n in W: return W[n]
        b = by[n]; m = np.eye(4) if n == root else M4(b.get("rotation", [0, 0, 0]), b.get("pivot", [0, 0, 0]))
        if n != root and b.get("parent") in by: m = world(b["parent"]) @ m
        W[n] = m; return m
    P, Wt = [], []
    for b in subtree(bones, root):
        for c in b.get("cubes", []):
            m = world(b["name"])
            if c.get("rotation"): m = m @ M4(c["rotation"], c.get("pivot", [0, 0, 0]))
            inf = c.get("inflate", 0); o = np.array(c["origin"], float) - inf; s = np.array(c["size"], float) + 2 * inf
            vol = max(0.05, float(np.prod(np.maximum(s, 0.25)))) / 8
            for i in range(8):
                pt = o + s * np.array([(i >> 0) & 1, (i >> 1) & 1, (i >> 2) & 1])
                P.append((m @ np.array([*pt, 1.0]))[:3]); Wt.append(vol)
    return np.array(P), np.array(Wt)

def translate(bones, names, v):
    for b in bones:
        if b["name"] not in names: continue
        if b.get("pivot") is not None: b["pivot"] = [round(b["pivot"][i] + v[i], 4) for i in range(3)]
        for c in b.get("cubes", []):
            c["origin"] = [round(c["origin"][i] + v[i], 4) for i in range(3)]
            if c.get("pivot"): c["pivot"] = [round(c["pivot"][i] + v[i], 4) for i in range(3)]

def undo(G, rec):
    bones = G["bones"]; names = [b["name"] for b in bones]
    if "eth_fix" not in names or "eth_body" not in names: return
    body = next(b for b in bones if b["name"] == "eth_body"); bound = next(b for b in bones if b["name"] == "eth_weapon")
    sub = {b["name"] for b in subtree(bones, "eth_body")}
    translate(bones, sub, [-x for x in rec["v"]])
    body["name"] = "eth_weapon"; body.pop("parent", None); body["binding"] = bound["binding"]
    body["pivot"] = rec["orig_pivot"]; body["rotation"] = rec["orig_rot"]
    if not any(body["rotation"]): body.pop("rotation")
    for b in bones:
        if b.get("parent") == "eth_body": b["parent"] = "eth_weapon"
    G["bones"] = [b for b in bones if b is not bound and b["name"] != "eth_fix"]
    G["bones"].sort(key=lambda b: b["name"] != "eth_weapon")

def analyse(G, shift):
    bones = G["bones"]; w = next(b for b in bones if b["name"] == "eth_weapon")
    Po = np.array(w["pivot"], float); Ro = w.get("rotation", [0, 0, 0])
    P, Wt = cloud(bones, "eth_weapon")
    Rw = M4(Ro, Po); P = (Rw @ np.c_[P, np.ones(len(P))].T).T[:, :3]        # inclui a rotação de repouso do antigo osso
    c = (P * Wt[:, None]).sum(0) / Wt.sum(); X = P - c
    ev, evec = np.linalg.eigh((X * Wt[:, None]).T @ X); d = evec[:, -1]
    t = X @ d; tmin, tmax = t.min(), t.max(); L = tmax - tmin
    # empunhadura do modelo original: o mod segurava a arma no pivô do osso (mod_weapons/glTF) ou na mão do braço (espadas2)
    hand = Po.copy() if abs(Po[1] - 15) > 0.5 else np.array([-6.0, 13.0, 0.0])
    H = Rw @ np.array([*(hand + np.array(shift)), 1.0]); H = H[:3]
    th = (H - c) @ d
    if abs(th - tmax) < abs(th - tmin): d, t, th, tmin, tmax = -d, -t, -th, -tmax, -tmin   # d: pomo -> ponta
    frac = (th - tmin) / L
    return dict(P=P, Wt=Wt, c=c, d=d, t=t, tmin=tmin, L=L, frac=frac, H=H, Po=Po, Ro=Ro)

def fit(gp, sid, grips, write=True):
    g = json.load(open(gp)); G = g["minecraft:geometry"][0]
    rec = grips.setdefault(sid, {"shift": [0, 0, 0]})
    if "fit" in rec: undo(G, rec["fit"])
    A = analyse(G, rec.get("shift", [0, 0, 0])); d, c, L = A["d"], A["c"], A["L"]
    kind = kind_of(sid); lo, hi = (0.3, 0.5) if kind == "pole" else (0.08, 0.3)
    frac = min(hi, max(lo, A["frac"])) if 0 <= A["frac"] <= 0.55 else (0.4 if kind == "pole" else 0.15)
    g_pt = c + d * (A["tmin"] + frac * L)
    # 2º eixo (largura da lâmina) no plano perpendicular; sinal: lado "pesado" (cabeça do machado/foice) para baixo
    X = A["P"] - c; Xp = X - np.outer(X @ d, d); Wt = A["Wt"]
    ev, evec = np.linalg.eigh((Xp * Wt[:, None]).T @ Xp); w = evec[:, -1]; w = w - (w @ d) * d; w /= np.linalg.norm(w)
    far = (A["t"] - A["tmin"]) > 0.55 * L
    if far.any() and (Xp[far] @ w * Wt[far]).sum() > 0: w = -w
    s = round(min(1.6, max(0.3, TARGET[kind] / L)), 3)
    h = g_pt - d * (GRIP_UP / s)                              # "fim do cabo" equivalente ao da katana de referência
    v = PIV - h
    Rc = np.c_[[0, 1, 0], [0, 0, 1], [1, 0, 0]] @ np.array([d, w, np.cross(d, w)])   # d->+Y, w->+Z, dxw->+X
    rc = to_euler(Rc)
    out = dict(kind=kind, L=round(float(L), 2), frac=round(float(A["frac"]), 3), s=s, v=[round(float(x), 4) for x in v], rc=rc,
               orig_pivot=[float(x) for x in A["Po"]], orig_rot=[float(x) for x in A["Ro"]])
    if not write: return out, A
    bones = G["bones"]; old = next(b for b in bones if b["name"] == "eth_weapon"); bind = old.pop("binding")
    sub = {b["name"] for b in subtree(bones, "eth_weapon")}
    old["name"] = "eth_body"; old["parent"] = "eth_fix"
    for b in bones:
        if b.get("parent") == "eth_weapon": b["parent"] = "eth_body"
    old["parent"] = "eth_fix"
    sub = (sub - {"eth_weapon"}) | {"eth_body"}
    translate(bones, sub, v)
    G["bones"] = [{"name": "eth_weapon", "binding": bind, "pivot": PIV.tolist(), "rotation": REST},
                  {"name": "eth_fix", "parent": "eth_weapon", "pivot": PIV.tolist(), "rotation": rc}] + bones
    D = G["description"]; D["visible_bounds_width"] = max(D.get("visible_bounds_width", 4), 6); D["visible_bounds_height"] = max(D.get("visible_bounds_height", 4), 6)
    json.dump(g, open(gp, "w"), indent=1)
    rec["fit"] = out
    return out, A

def anims(rec):
    s = rec["s"]
    Rt = brot([REST[0] - TP_TILT, 0, 0]); tp = TP_GRIP - Rt @ np.array([0, GRIP_UP, 0])
    return ({"loop": True, "bones": {"eth_weapon": {"rotation": [-TP_TILT, 0, 0], "position": [round(-tp[0], 3), round(tp[1], 3), round(tp[2], 3)], "scale": s}}},
            {"loop": True, "bones": {"eth_weapon": {"rotation": FP_ROT, "position": FP_POS, "scale": s}}})

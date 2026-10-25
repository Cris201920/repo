# 9.7 - CORPOS DAS TRANSFORMAÇÕES BEASTKIN (Carrion, o Rei Besta): Forma Fera, Rei Besta e Besta Real.
# Gerador idempotente: escreve (1) as 3 geometrias do JOGADOR transformado (RP/models/entity/etheria_beastform_{fera,rei,real}.geo.json),
# (2) as 3 texturas procedurais (atlas 256 px, amostras 32x32 de pelagem/garra/osso/olho; UV por face sem esticar),
# (3) 2 animações pequenas (vida: respiração/cauda/mandíbula/pulo por anim_time/modified_move_speed/is_on_ground; ataque curto),
# (4) o render controller próprio (etheria_player_beastform.render_controllers.json, troca por ÍNDICE da propriedade numérica etheria:bform),
# (5) os ajustes MÍNIMOS no player.entity.json (+3 geometrias/texturas, +2 animações, +2 "animate", +1 render controller, escala,
#     corpo normal/peças de raça escondidos pela mesma variável das formas dracônicas/slime) e no BP player.json
#     (propriedade etheria:bform int 0..3 client_sync + hitbox um pouco maior por grupo de componentes / eventos etheria:bform_N).
# Os ossos seguem o esqueleto humanoide do jogador (head, body, rightArm, leftArm, rightLeg, leftLeg, rightItem, leftItem), então as
# animações vanilla (andar, atacar, olhar, nadar, montar) continuam valendo; ossos extras: root, waist, jaw, ear_*, mane, tail0..5.
# Rode de novo depois de tools/slime_mimic_wire.py (ele reescreve a linha variable.etheria_dragon).
import json, math, os, random
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
TW = 256; SW = 32                      # atlas 256 px, amostras 32x32 (8x8 = 64 materiais)
FORMS = ["fera", "rei", "real"]
FACTOR = {"fera": 1.15, "rei": 1.35, "real": 1.6}     # altura final relativa ao jogador normal (32 px * 0.9375)
HITBOX = {1: (0.7, 1.85), 2: (0.8, 1.95), 3: (0.9, 1.95)}   # largura cresce; altura <= 1.95 para ainda passar em portas/túneis de 2 blocos
R2 = lambda v: round(v, 3)

# ------------------------------------------------------------------ texturas
def vnoise(rng, n, cells):
    g = rng.random((cells + 1, cells + 1)); xs = np.linspace(0, cells, n, endpoint=False)
    i = xs.astype(int); f = xs - i; f = f * f * (3 - 2 * f)
    a = g[i][:, i]; b = g[i][:, i + 1]; c = g[i + 1][:, i]; d = g[i + 1][:, i + 1]
    fy, fx = f[:, None], f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def fur(rng, base, dark, light=None, stripes=None, strands=70, scar=None):
    base, dark = np.array(base, float), np.array(dark, float); light = np.array(light if light else [min(255, c * 1.18 + 12) for c in base], float)
    n = 0.6 * vnoise(rng, SW, 4) + 0.4 * vnoise(rng, SW, 9)
    img = base[None, None, :] * (0.84 + 0.3 * n[:, :, None]) + rng.normal(0, 5, (SW, SW, 1))
    for _ in range(strands):                                    # fios de pelo (traços verticais curtos)
        x, y, L = rng.integers(0, SW), rng.integers(0, SW), rng.integers(2, 6); col = dark if rng.random() < 0.6 else light
        for k in range(L):
            yy = (y + k) % SW; t = 0.55 * (1 - k / (L + 1)); img[yy, x] = img[yy, x] * (1 - t) + col * t
    if stripes is not None:                                     # listras de tigre (faixas onduladas)
        sc = np.array(stripes, float); w = vnoise(rng, SW, 3)
        for y in range(SW):
            for x in range(SW):
                if math.sin((y * 0.55 + x * 0.18) + w[y, x] * 5.0) > 0.72: img[y, x] = img[y, x] * 0.25 + sc * 0.75
    if scar is not None:                                        # cicatrizes (riscos diagonais claros)
        sc = np.array(scar, float)
        for _ in range(3):
            x, y = rng.integers(0, SW), rng.integers(0, SW)
            for k in range(rng.integers(6, 12)): img[(y + k) % SW, (x + k) % SW] = sc; img[(y + k) % SW, (x + k + 1) % SW] = sc * 0.8
    return img

def grad(rng, top, bot, n=10, noise=6):
    top, bot = np.array(top, float), np.array(bot, float); img = np.zeros((SW, SW, 3))
    for y in range(SW): t = min(1.0, y / max(1, n - 1)); img[y, :] = top * (1 - t) + bot * t
    return img + rng.normal(0, noise, (SW, SW, 1))

def flat(rng, col, noise=4): return np.array(col, float)[None, None, :] + rng.normal(0, noise, (SW, SW, 1)) + np.zeros((SW, SW, 3))

def plate(rng, col, rim):
    img = flat(rng, col, 5); rim = np.array(rim, float)
    for y in range(SW):
        if y % 6 in (0,): img[y, :] = rim                       # frisos dourados a cada 6 px
        if y % 6 == 1: img[y, :] *= 0.7
    return img

def flame(rng):
    img = np.zeros((SW, SW, 3)); n = vnoise(rng, SW, 6)
    for y in range(SW):
        for x in range(SW):
            t = (y / SW) * 0.8 + n[y, x] * 0.4
            img[y, x] = np.array([255, 235, 120]) * (1 - t) + np.array([210, 50, 15]) * t if t < 1 else (90, 15, 10)
    return img + rng.normal(0, 6, (SW, SW, 1))

def eye(rng, core, rim):
    img = flat(rng, rim, 3); img[8:24, 8:24] = core; img[13:19, 13:19] = [255, 255, 235]
    return img

PAL = {
    "fera": dict(
        fur=lambda r: fur(r, (170, 104, 52), (92, 54, 28)), fur_dark=lambda r: fur(r, (104, 62, 32), (56, 32, 18)),
        fur_light=lambda r: fur(r, (226, 196, 150), (170, 130, 90), strands=40), fur_s=lambda r: fur(r, (168, 102, 50), (80, 45, 22), stripes=(74, 40, 20)),
        skin=lambda r: flat(r, (40, 28, 26)), claw=lambda r: grad(r, (240, 230, 205), (95, 82, 70), 9), teeth=lambda r: flat(r, (244, 238, 222), 3),
        eye=lambda r: eye(r, (255, 210, 50), (255, 170, 30)), mouth=lambda r: flat(r, (110, 30, 36)), ear_in=lambda r: flat(r, (205, 140, 128), 6),
        horn=lambda r: grad(r, (222, 208, 176), (120, 100, 80), 10)),
    "rei": dict(
        fur=lambda r: fur(r, (214, 158, 62), (130, 84, 30)), fur_dark=lambda r: fur(r, (150, 98, 38), (84, 50, 20)),
        fur_light=lambda r: fur(r, (246, 224, 172), (200, 160, 100), strands=40), fur_s=lambda r: fur(r, (214, 158, 62), (90, 52, 22), stripes=(52, 30, 16)),
        mane=lambda r: fur(r, (238, 196, 92), (168, 108, 36), light=(255, 236, 150), strands=160), mane_dark=lambda r: fur(r, (168, 104, 40), (96, 56, 22), strands=140),
        skin=lambda r: flat(r, (36, 26, 24)), claw=lambda r: grad(r, (250, 244, 224), (60, 50, 44), 10), teeth=lambda r: flat(r, (246, 240, 224), 3),
        eye=lambda r: eye(r, (255, 236, 90), (255, 190, 40)), mouth=lambda r: flat(r, (120, 26, 34)), ear_in=lambda r: flat(r, (200, 136, 120), 6),
        horn=lambda r: grad(r, (236, 222, 190), (110, 86, 64), 12), plate=lambda r: plate(r, (58, 52, 66), (232, 184, 66)),
        gold=lambda r: grad(r, (255, 226, 120), (190, 130, 40), 12, 8)),
    "real": dict(
        fur=lambda r: fur(r, (122, 42, 32), (54, 18, 16), strands=90), fur_dark=lambda r: fur(r, (58, 22, 22), (24, 10, 10)),
        fur_light=lambda r: fur(r, (176, 92, 62), (110, 50, 34), strands=40), fur_s=lambda r: fur(r, (118, 40, 30), (40, 14, 12), stripes=(255, 150, 40)),
        scar=lambda r: fur(r, (116, 40, 32), (50, 16, 14), scar=(236, 150, 140)), mane=flame, mane_dark=lambda r: fur(r, (70, 20, 16), (30, 8, 8), light=(200, 70, 20), strands=150),
        skin=lambda r: flat(r, (26, 14, 14)), claw=lambda r: grad(r, (238, 228, 200), (40, 26, 24), 14), teeth=lambda r: flat(r, (240, 232, 208), 4),
        eye=lambda r: eye(r, (255, 40, 24), (190, 10, 10)), mouth=lambda r: flat(r, (80, 8, 14)), bone=lambda r: grad(r, (240, 230, 204), (150, 128, 100), 24, 8),
        horn=lambda r: grad(r, (60, 40, 36), (225, 205, 170), 14), plate=lambda r: plate(r, (226, 214, 186), (120, 30, 20)),
        gold=lambda r: grad(r, (255, 210, 110), (200, 100, 30), 12, 8)),
}
ANCHORED = {"claw", "horn", "bone", "mane", "gold"}           # gradiente alinhado ao topo da face (ponta escura / brasa)

def build_texture(form):
    rng = np.random.default_rng(97 + FORMS.index(form)); atlas = np.zeros((TW, TW, 4), np.uint8); slots = {}
    for i, (m, fn) in enumerate(PAL[form].items()):
        u, v = (i % 8) * SW, (i // 8) * SW; img = np.clip(fn(rng), 0, 255)
        atlas[v:v + SW, u:u + SW, :3] = img.astype(np.uint8); atlas[v:v + SW, u:u + SW, 3] = 255; slots[m] = (u, v)
    return Image.fromarray(atlas, "RGBA"), slots

# ------------------------------------------------------------------ geometria
class Geo:
    def __init__(s, ident, slots, seed):
        s.ident, s.slots, s.rng, s.bones, s.B, s.stretch = ident, slots, random.Random(seed), [], {}, 0
    def bone(s, name, parent=None, pivot=(0, 0, 0), rot=None):
        b = {"name": name, "pivot": [R2(v) for v in pivot]}
        if parent: b["parent"] = parent
        if rot and any(rot): b["rotation"] = [R2(v) for v in rot]
        b["cubes"] = []; s.bones.append(b); s.B[name] = b; return name
    def _uv(s, m, sx, sy, sz):
        u0, v0 = s.slots[m]; out = {}
        for f, (w, h) in {"north": (sx, sy), "south": (sx, sy), "east": (sz, sy), "west": (sz, sy), "up": (sx, sz), "down": (sx, sz)}.items():
            if w > SW or h > SW: s.stretch += 1
            w, h = min(w, SW), min(h, SW)
            if m in ANCHORED and f not in ("up", "down"): du, dv = s.rng.randint(0, int(SW - math.ceil(w))), 0
            else: du, dv = s.rng.randint(0, int(SW - math.ceil(w))), s.rng.randint(0, int(SW - math.ceil(h)))
            out[f] = {"uv": [u0 + du, v0 + dv], "uv_size": [R2(w), R2(h)]}
        return out
    def box(s, bn, o, sz, m, rot=None, piv=None, inf=0):
        c = {"origin": [R2(v) for v in o], "size": [R2(v) for v in sz], "uv": s._uv(m, *sz)}
        if rot and any(abs(r) > 1e-4 for r in rot): c["rotation"] = [R2(v) for v in rot]; c["pivot"] = [R2(v) for v in (piv or o)]
        if inf: c["inflate"] = inf
        s.B[bn]["cubes"].append(c)
    def seg(s, bn, p0, p1, w, d, m, inf=0):
        """cubo (w x L x d) que vai de p0 até p1 (gira em X e depois Z em torno de p0)."""
        dx, dy, dz = (p1[i] - p0[i] for i in range(3)); L = math.sqrt(dx * dx + dy * dy + dz * dz)
        th = math.degrees(math.asin(max(-1, min(1, dz / L)))); ph = math.degrees(math.atan2(dx, -dy))
        s.box(bn, (p0[0] - w / 2, p0[1] - L, p0[2] - d / 2), (w, L, d), m, (th, 0, ph), p0, inf)
    def tufts(s, bn, pts, m, w=(1.2, 2.2), L=(2, 4), out=(0, -1, 0), spread=0.6):
        for p in pts:
            l = s.rng.uniform(*L); ww = s.rng.uniform(*w); dv = [out[i] + s.rng.uniform(-spread, spread) for i in range(3)]
            n = math.sqrt(sum(v * v for v in dv)) or 1; s.seg(bn, p, [p[i] + dv[i] / n * l for i in range(3)], ww, ww * 0.8, m)
    def json(s, scale_note):
        n = sum(len(b["cubes"]) for b in s.bones)
        bones = [dict(b) if b["cubes"] else {k: v for k, v in b.items() if k != "cubes"} for b in s.bones]
        return {"format_version": "1.12.0", "minecraft:geometry": [{"description": {
            "identifier": s.ident, "texture_width": TW, "texture_height": TW, "visible_bounds_width": 5, "visible_bounds_height": 5,
            "visible_bounds_offset": [0, 1.5, 0]}, "bones": bones}]}, n

def arc(cx, cy, cz, rx, ry, a0, a1, n):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / max(1, n - 1))), cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / max(1, n - 1))), cz) for i in range(n)]

# Parâmetros por forma (unidades = pixels do modelo; o corpo é desenhado ereto e o osso "body" inclina para a frente)
P = {
    "fera": dict(hip=12, hipx=2.4, torso=(10, 12.5, 6), belly=(8, 5, 5), hunch=24, sh=(6.2, 23.2), head=(7, 6, 6), snout=(4, 3, 4.2),
                 up=(3.6, 5.5), fore=(4.2, 5.5), hand=(4, 2.6, 3.6), claw=(0.8, 4.0), nclaw=4, leg=(4.4, 3.2, 2.8), paw=(3.8, 1.5, 4.4),
                 tail=[(3.0, 3.0, 3.6), (3.6, 3.6, 3.6), (3.4, 3.4, 3.6), (3.0, 3.0, 3.4), (2.4, 2.4, 3.0), (1.6, 1.6, 2.2)], trot=[38, -12, -14, -10, -8, -6]),
    "rei": dict(hip=13, hipx=3.0, torso=(14, 14, 8.5), belly=(11, 6, 7), hunch=18, sh=(8.6, 26), head=(8, 7, 7), snout=(5, 3.6, 4.4),
                up=(5.0, 6.5), fore=(5.6, 6.5), hand=(5, 3, 4.6), claw=(1.0, 5.0), nclaw=4, leg=(5.4, 4.0, 3.4), paw=(4.6, 1.8, 5.2),
                tail=[(2.2, 2.2, 4)] * 5 + [(1.8, 1.8, 3.6)], trot=[30, -12, -12, -10, -6, -4]),
    "real": dict(hip=14, hipx=3.6, torso=(18, 15.5, 11), belly=(14, 6.5, 9), hunch=28, sh=(10.6, 28.4), head=(8.4, 6.6, 7.4), snout=(5.4, 3.6, 8),
                 up=(5.8, 8.5), fore=(6.4, 8.5), hand=(5.4, 3, 5), claw=(1.0, 8.0), nclaw=4, leg=(6.4, 4.6, 4.0), paw=(5.2, 2, 6),
                 tail=[(4.2, 4.2, 4.2), (3.8, 3.8, 4.2), (3.2, 3.2, 4.2), (2.8, 2.8, 4), (2.2, 2.2, 4), (1.6, 1.6, 3.6)], trot=[26, -10, -10, -8, -6, -6]),
}

def build(form, slots):
    p = P[form]; G = Geo(f"geometry.etheria_beastform_{form}", slots, 970 + FORMS.index(form)); R = G.rng
    F, K, X = form == "fera", form == "rei", form == "real"
    hip = p["hip"]; tw, th, td = p["torso"]; top = hip + th
    G.bone("root", None, (0, 0, 0))
    G.bone("waist", "root", (0, hip, 0))
    G.bone("body", "waist", (0, hip, 0), (p["hunch"], 0, 0))
    # ---------------- tronco
    G.box("waist", (-tw * 0.4, hip - 2.5, -td * 0.42), (tw * 0.8, 4, td * 0.84), "fur_dark")                     # quadril
    G.box("body", (-p["belly"][0] / 2, hip + 1, -p["belly"][2] / 2), p["belly"], "fur_light" if not X else "scar")  # barriga
    G.box("body", (-tw / 2, hip + 5.5, -td / 2), (tw, th - 5.5, td), "fur" if F else "fur_s")                         # peito
    G.box("body", (-tw / 2 + 1, top - 1.5, -td / 2 + 0.5), (tw - 2, 3, td - 1), "fur_dark")                          # trapézio
    if F:   # peito claro + tufos do dorso + gola de pelo
        G.box("body", (-3.5, hip + 6, -td / 2 - 0.6), (7, 5.5, 1), "fur_light")
        G.tufts("body", [(x, top - 1, -1) for x in (-4, -2, 0, 2, 4)], "fur_dark", (1.6, 2.4), (2.5, 3.8), (0, 0.2, 1))
        G.tufts("body", [(R.uniform(-3, 3), y, td / 2 - 0.5) for y in (hip + 4, hip + 6.5, hip + 9, hip + 11)], "fur_dark", (1.4, 2.2), (2, 3.2), (0, -0.6, 1))
        G.tufts("body", [(x, top - 0.6, -td / 2 + 0.6) for x in (-3, -1.2, 1.2, 3)], "fur_light", (1.6, 2.2), (2, 3), (0, -0.5, -1))
        G.tufts("body", [(s * tw / 2, hip + y, 0) for s in (-1, 1) for y in (3, 6)], "fur", (1.4, 2), (1.6, 2.6), (0, -1, 0), 0.4)
    if K:   # peitoral, abdômen marcado, cinto dourado, tanga de pelo
        for s in (-1, 1): G.box("body", (s * 3.4 - 3.2, hip + 8.5, -td / 2 - 0.8), (6.4, 4.6, 1.2), "fur_light")
        for r in range(3):
            for s in (-1, 1): G.box("body", (s * 1.6 - 1.4, hip + 1.6 + r * 2.2, -p["belly"][2] / 2 - 0.6), (2.8, 1.8, 1), "fur_light")
        G.box("waist", (-tw * 0.42, hip - 1.2, -td * 0.45), (tw * 0.84, 1.6, td * 0.9), "gold")
        for x in (-3.5, -1.2, 1.2, 3.5): G.seg("waist", (x, hip - 1.2, -td * 0.45), (x * 1.1, hip - 6, -td * 0.5 - 1), 2.2, 0.8, "mane_dark")
        G.tufts("body", [(x, top - 3 - abs(x) * 0.3, td / 2) for x in (-5, -2.5, 0, 2.5, 5)], "mane_dark", (2.2, 3), (3, 5), (0, -0.4, 1))
    if X:   # costelas expostas, espinhos dorsais, corcunda, cicatrizes e placas ósseas
        G.box("body", (-tw / 2 + 2, top - 6, td / 2 - 1), (tw - 4, 6, 3), "fur_dark")                                  # corcunda
        for s in (-1, 1):
            for r in range(5):
                y = hip + 4.5 + r * 2.1
                G.box("body", (s * (tw / 2 + 0.2) - (0.8 if s > 0 else 0), y, -td / 2 + 1.2 + r * 0.2), (0.8, 1.0, td - 3), "bone")   # costelas
        for i in range(8):                                                                                             # espinhos dorsais
            y = top + 1 - i * 2.0; h = 7 - abs(i - 2) * 0.9; z = td / 2 + 2 + (1 if i < 3 else 0)
            G.seg("body", (0, y, z - 2.2), (0, y + h * 0.75, z - 2.2 + h * 0.7), 1.6 - i * 0.08, 2.4 - i * 0.1, "bone")
        for s in (-1, 1): G.box("body", (s * 3.6 - 3.2, hip + 8, -td / 2 - 0.8), (6.4, 5, 1.2), "fur_dark")             # peitorais
        G.box("body", (-p["belly"][0] / 2 + 1, hip + 1.4, -p["belly"][2] / 2 - 0.5), (p["belly"][0] - 2, 4.6, 1), "bone")  # placa ventral
        G.box("waist", (-tw * 0.42, hip - 1.2, -td * 0.45), (tw * 0.84, 1.6, td * 0.9), "bone")
        for x in (-5, -2, 2, 5): G.seg("waist", (x, hip - 1.2, -td * 0.45), (x * 1.2, hip - 6.5, -td * 0.5 - 1.5), 2.4, 0.8, "fur_dark")
        G.tufts("body", [(s * (tw / 2 - 1), y, R.uniform(-2, 2)) for s in (-1, 1) for y in (hip + 3, hip + 6)], "fur_dark", (1.6, 2.4), (2, 3), (s, -1, 0), 0.3)
    # ---------------- juba (Rei: densa e longa sobre ombros/pescoço; Real: espinhos flamejantes) / gola (Fera)
    G.bone("mane", "body", (0, top, 0))
    if K or X:
        mm = ("mane", "mane_dark")
        for ring, (ry, rl, n) in enumerate([(0, 6.5, 14), (-2.5, 7.5, 12), (2.0, 5, 12)]):
            for i in range(n):
                a = math.radians(180 + 180 * i / (n - 1)) if ring != 2 else math.radians(360 * i / n)
                x, z = math.cos(a) * (tw / 2 - 1.2), math.sin(a) * (td / 2 + 0.4) * -1
                y = top + ry
                out = (math.cos(a) * 0.8, -0.9 if ring != 2 else 0.4, -math.sin(a) * 0.8 + (0.6 if ring == 1 else 0))
                if X and ring == 2: out = (out[0] * 0.6, 1.2, out[2] + 0.5)
                l = rl + R.uniform(-1, 1.6); w = R.uniform(2.2, 3.4) if K else R.uniform(1.6, 2.4)
                G.seg("mane", (x, y, z), (x + out[0] * l, y + out[1] * l, z + out[2] * l), w, w * 0.85, mm[(i + ring) % 2] if K else ("mane" if ring == 2 or i % 3 else "mane_dark"))
                if X and ring == 2 and i % 2 == 0: G.seg("mane", (x + out[0] * l, y + out[1] * l, z + out[2] * l), (x + out[0] * (l + 3), y + out[1] * (l + 3), z + out[2] * (l + 3)), 0.9, 0.9, "bone")
        if K:   # juba que desce pelas costas
            G.tufts("mane", [(x, top - 1, td / 2 - 0.4) for x in (-4.5, -1.5, 1.5, 4.5)], "mane", (2.8, 3.4), (6, 8), (0, -1, 0.35), 0.15)
    if F:   # gola de pelo espessa ao redor do pescoço + pelagem do dorso
        for i in range(14):
            a = math.radians(360 * i / 14); x, z = math.cos(a) * (tw / 2 - 1.5), -math.sin(a) * (td / 2 - 0.3)
            o = (math.cos(a) * 0.7, -0.8, -math.sin(a) * 0.7 + 0.3); l = 3 + R.uniform(0, 1.4); w = R.uniform(1.8, 2.6)
            G.seg("mane", (x, top - 0.6, z), (x + o[0] * l, top - 0.6 + o[1] * l, z + o[2] * l), w, w * 0.85, ("fur", "fur_dark", "fur_light")[i % 3] if i % 7 else "fur_dark")
        G.tufts("body", [(R.uniform(-3.5, 3.5), hip + R.uniform(3, 11), td / 2 - 0.3) for _ in range(8)], "fur", (1.4, 2.2), (1.8, 2.8), (0, -0.7, 1), 0.4)
    # ---------------- cabeça
    hw, hh, hd = p["head"]; sw, shh, sd = p["snout"]; ny = top - (0.5 if not X else 1.2); nz = -td * 0.2 - (1.0 if X else 0)
    G.bone("head", "body", (0, ny, nz), (-p["hunch"] + (-6 if X else -2), 0, 0))
    hz0 = nz - hd + 1.5; hy0 = ny + 0.5
    G.box("head", (-hw / 2, hy0, hz0), (hw, hh, hd), "scar" if X else "fur")
    G.box("head", (-sw / 2, hy0 + 0.3, hz0 - sd), (sw, shh - (0.6 if X else 0), sd), "fur_light" if not X else "fur")                  # focinho
    stop = hy0 + 0.3 + shh - (0.6 if X else 0); ey0 = stop + 0.3                                                                       # topo do focinho / olhos acima dele
    G.box("head", (-sw * 0.25, stop - 1.0, hz0 - sd - 0.4), (sw * 0.5, 1.1, 1.0), "skin")                                               # nariz
    eyes = [(-1, ey0, 1.7, 1.0), (1, ey0, 1.7, 1.0)]
    if X: eyes += [(-1, ey0 + 1.3, 1.1, 0.7), (1, ey0 + 1.3, 1.1, 0.7)]                                                                # 4 olhos
    G.box("head", (-hw / 2 - 0.2, eyes[-1][1] + eyes[-1][3] + 0.1, hz0 - 0.6), (hw + 0.4, 1.0, 1.0), "fur_dark")                     # sobrancelha
    for s, ey, ew, eh in eyes:
        ex = s * (hw / 2 - 1.5) - ew / 2 if eh > 0.8 else s * (hw / 2 - 2.7) - ew / 2
        G.box("head", (ex, ey, hz0 - 0.25), (ew, eh, 0.4), "eye")
        if not X: G.box("head", (ex + ew / 2 - 0.15, ey, hz0 - 0.35), (0.3, eh, 0.15), "skin")                                         # pupila em fenda
    # dentes de cima / presas
    tz0, tz1 = hz0 - sd + 0.4, hz0 - 0.2
    nt = 2 if F else (3 if K else 5)
    for s in (-1, 1):
        for i in range(nt):
            z = tz0 + (tz1 - tz0) * (i + 0.5) / nt; G.box("head", (s * (sw / 2 - 0.5) - 0.35, hy0 - 0.7, z - 0.35), (0.7, 1.0, 0.7), "teeth")
        fl = 2.4 if F else (3.2 if K else 3.4)
        G.seg("head", (s * (sw / 2 - 0.7), hy0 + 0.4, tz0 + 0.5), (s * (sw / 2 - 0.5), hy0 + 0.4 - fl, tz0 + 0.1), 0.9, 0.9, "teeth")       # presa superior
        if X:   # 4 presas: as de baixo saem do focinho para fora e para baixo (javali) — mais 2 na mandíbula
            G.seg("head", (s * (sw / 2), hy0 + 1.2, tz0 + 2.5), (s * (sw / 2 + 2.2), hy0 - 2.6, tz0 + 0.8), 1.2, 1.2, "bone")
            G.seg("head", (s * (sw / 2 + 2.2), hy0 - 2.6, tz0 + 0.8), (s * (sw / 2 + 2.0), hy0 - 4.2, tz0 - 0.6), 0.9, 0.9, "bone")
    # mandíbula (osso próprio — abre ao respirar/atacar)
    G.bone("jaw", "head", (0, hy0 + 0.2, hz0 + 0.5))
    jl = sd + 0.8 - (0.4 if F else 0)
    G.box("jaw", (-sw / 2 + 0.3, hy0 - 1.4, hz0 - jl + 0.4), (sw - 0.6, 1.5, jl), "fur_light" if not X else "fur_dark")
    G.box("jaw", (-sw / 2 + 0.6, hy0 + 0.1, hz0 - jl + 0.6), (sw - 1.2, 0.3, jl - 0.6), "mouth")
    for s in (-1, 1):
        for i in range(nt):
            z = hz0 - jl + 0.8 + (jl - 1.2) * (i + 0.5) / nt; G.box("jaw", (s * (sw / 2 - 0.8) - 0.3, hy0 + 0.1, z - 0.3), (0.6, 0.8, 0.6), "teeth")
        G.seg("jaw", (s * (sw / 2 - 0.9), hy0 - 0.2, hz0 - jl + 1.0), (s * (sw / 2 - 0.6), hy0 + (1.6 if not X else 2.6), hz0 - jl + 0.6), 0.8, 0.8, "teeth" if not X else "bone")
    if X: G.box("jaw", (-1.2, hy0 - 2.0, hz0 - jl + 1.4), (2.4, 0.8, 2.5), "fur_dark")                                                   # queixo
    # orelhas
    for s, nm in ((1, "ear_l"), (-1, "ear_r")):
        ex, ey, ez = s * (hw / 2 - 1.3), hy0 + hh - 0.4, hz0 + hd * 0.55
        G.bone(nm, "head", (ex, ey, ez))
        if F:
            G.seg(nm, (ex, ey, ez), (ex + s * 1.2, ey + 5.0, ez + 0.6), 2.6, 1.2, "fur")
            G.seg(nm, (ex, ey, ez - 0.45), (ex + s * 1.1, ey + 4.0, ez + 0.1), 1.4, 0.4, "ear_in")
            G.seg(nm, (ex + s * 1.2, ey + 4.6, ez + 0.6), (ex + s * 1.5, ey + 6.4, ez + 0.8), 1.0, 0.8, "fur_dark")
        elif K:
            G.seg(nm, (ex, ey, ez), (ex + s * 1.6, ey + 3.0, ez + 0.4), 2.6, 1.2, "fur")
            G.seg(nm, (ex, ey, ez - 0.45), (ex + s * 1.4, ey + 2.4, ez), 1.4, 0.4, "ear_in")
        else:
            G.seg(nm, (ex, ey, ez), (ex + s * 2.6, ey + 3.0, ez + 1.6), 2.0, 1.0, "fur_dark")
            G.seg(nm, (ex + s * 2.6, ey + 3.0, ez + 1.6), (ex + s * 3.8, ey + 4.6, ez + 3.2), 1.0, 0.8, "fur_dark")
    # chifres (Rei: curvos para trás; Real: grandes, curvando para a frente)
    if K or X:
        for s in (-1, 1):
            if K: pts = [(s * 2.6, hy0 + hh - 0.6, hz0 + 2.2), (s * 4.4, hy0 + hh + 2.0, hz0 + 3.2), (s * 5.4, hy0 + hh + 3.6, hz0 + 5.6), (s * 5.2, hy0 + hh + 3.4, hz0 + 8.0)]; ws = [1.8, 1.4, 1.0]
            else: pts = [(s * 3.0, hy0 + hh - 0.8, hz0 + 2.8), (s * 6.0, hy0 + hh + 1.4, hz0 + 4.2), (s * 8.0, hy0 + hh + 4.6, hz0 + 3.0), (s * 8.4, hy0 + hh + 7.2, hz0 + 0.4), (s * 7.8, hy0 + hh + 8.6, hz0 - 1.6)]; ws = [2.4, 2.0, 1.6, 1.0]
            for i in range(len(pts) - 1): G.seg("head", pts[i], pts[i + 1], ws[i], ws[i], "horn")
    # juba ao redor do rosto (Rei: leão; Real: coroa de espinhos flamejantes); Fera: bochechas peludas
    if F:
        G.tufts("head", [(s * hw / 2, hy0 + 1.2 + k * 1.4, hz0 + 1.5) for s in (-1, 1) for k in range(3)], "fur_light", (1.2, 1.8), (2, 3), (0, -0.5, 0.4), 0.5)
        for s in (-1, 1): G.tufts("head", [(s * hw / 2, hy0 + 1.6 + k * 1.4, hz0 + 2) for k in range(2)], "fur", (1.2, 1.6), (1.6, 2.4), (s, -0.4, 0.3), 0.3)
        G.tufts("head", [(x, hy0 + hh, hz0 + hd - 1) for x in (-1.5, 0, 1.5)], "fur_dark", (1.2, 1.8), (2, 3), (0, 0.4, 1), 0.3)
    else:
        n = 18 if K else 16; rx, ry = hw / 2 + 0.8, hh / 2 + 1.2; cy = hy0 + hh / 2
        for i in range(n):
            a = math.radians(-60 + 300 * i / (n - 1) - 30)
            x, y = math.cos(a) * rx, cy + math.sin(a) * ry; z = hz0 + 1.6
            l = (4.5 if K else 5) + R.uniform(-0.8, 1.6); o = (math.cos(a), math.sin(a) * 0.9 + (-0.4 if K else 0.4), 0.55)
            m = ("mane", "mane_dark")[i % 2] if K else ("mane" if i % 3 else "mane_dark")
            G.seg("head", (x * 0.8, y, z), (x * 0.8 + o[0] * l, y + o[1] * l, z + o[2] * l), R.uniform(2.0, 2.8), 1.8, m)
            if X and i % 2 == 0: G.seg("head", (x * 0.8 + o[0] * l, y + o[1] * l, z + o[2] * l), (x * 0.8 + o[0] * (l + 2.6), y + o[1] * (l + 2.6), z + o[2] * (l + 2.6)), 0.8, 0.8, "bone")
        G.tufts("head", [(x, hy0 + hh, hz0 + hd * 0.6) for x in (-2.4, -0.8, 0.8, 2.4)], "mane" if K else "mane", (1.8, 2.6), (3, 5), (0, 0.6, 1), 0.3)
    # ---------------- braços
    sx, sy = p["sh"]; (uw, ul), (fw, fl), (hw2, hh2, hd2) = p["up"], p["fore"], p["hand"]; cw, cl = p["claw"]
    arm_rot = -p["hunch"] - (14 if F else (8 if K else 18))
    for s, nm, it in ((1, "leftArm", "leftItem"), (-1, "rightArm", "rightItem")):
        x = s * sx; G.bone(nm, "body", (x, sy, 0), (arm_rot, 0, s * -(4 if F else 6)))
        elbow = (x + s * 0.6, sy - ul - 1.2, 0.4); wrist = (x + s * 0.4, elbow[1] - fl, -0.4)
        G.box(nm, (x - uw / 2 - 0.4, sy - 2.6, -uw / 2 - 0.4), (uw + 0.8, 4, uw + 0.8), "fur_dark" if F else "fur")                    # ombro
        G.seg(nm, (x, sy - 1, 0), elbow, uw, uw, "fur" if not X else "fur_s")
        G.seg(nm, elbow, wrist, fw, fw, "fur" if F else ("fur_s" if K else "fur"), 0)
        G.box(nm, (wrist[0] - hw2 / 2, wrist[1] - hh2, wrist[2] - hd2 / 2), (hw2, hh2, hd2), "fur_dark" if not X else "skin")          # mão
        if F: G.tufts(nm, [(x + s * (fw / 2), elbow[1] - k * 1.7, R.uniform(-1, 1)) for k in range(3)] + [(x, elbow[1] - 1 - k * 1.8, fw / 2) for k in range(3)], "fur_dark", (1.4, 2.0), (2, 3.2), (s * 0.7, -0.6, 0.4), 0.3)
        if K:
            G.box(nm, (wrist[0] - fw / 2 - 0.4, wrist[1] + 0.4, -fw / 2 - 0.4), (fw + 0.8, 2.0, fw + 0.8), "gold")                         # bracelete
            G.tufts(nm, [(x + s * (fw / 2), elbow[1] - 1.2 - k * 1.8, R.uniform(-1, 1)) for k in range(3)], "mane_dark", (1.6, 2.2), (2, 3), (s, -0.5, 0.3), 0.3)
            # ombreira de pelo + placas
            for k in range(3): G.box(nm, (x - uw / 2 - 1.4 + (s > 0) * 0.0 - k * 0.2 * (s < 0), sy + 0.6 - k * 1.7, -uw / 2 - 1.4), (uw + 2.8, 1.6, uw + 2.8), "plate", (0, 0, s * (14 + k * 6)), (x, sy, 0))
            G.tufts(nm, [(x + s * 1, sy + 1.6, z) for z in (-2, 0, 2)], "mane", (2.2, 3), (3, 4.2), (s * 0.5, 0.8, 0.2), 0.3)
        if X:
            for k in range(3): G.box(nm, (x - uw / 2 - 1.6, sy + 0.8 - k * 1.8, -uw / 2 - 1.6), (uw + 3.2, 1.8, uw + 3.2), "plate", (0, 0, s * (16 + k * 6)), (x, sy, 0))
            for k, (dx, dy, dz) in enumerate([(0.6, 1.0, 0), (0.3, 1.0, -0.6), (0.3, 1.0, 0.7)]):                                       # espinhos da ombreira
                b0 = (x + s * (1.5 + k * 0.4), sy + 2.4, (k - 1) * 1.8); G.seg(nm, b0, (b0[0] + s * dx * 4, b0[1] + dy * 4.5, b0[2] + dz * 3), 1.4 - k * 0.2, 1.4 - k * 0.2, "bone")
            G.seg(nm, (elbow[0], elbow[1], 1.6), (elbow[0] + s * 0.4, elbow[1] + 0.6, 5.2), 1.2, 1.2, "bone")                           # espinho do cotovelo
            for k in range(3): G.seg(nm, (x + s * fw / 2, elbow[1] - 1.2 - k * 2.4, 0), (x + s * (fw / 2 + 2.2), elbow[1] - k * 2.4, 0.8), 0.8, 0.8, "bone")
            G.box(nm, (wrist[0] - fw / 2 - 0.3, wrist[1] + 0.6, -fw / 2 - 0.3), (fw + 0.6, 1.4, fw + 0.6), "bone")
        # garras (longas; Real = lâminas)
        n = p["nclaw"]
        for k in range(n):
            cx = wrist[0] + s * 0 + (k - (n - 1) / 2) * (hw2 - 1) / (n - 1) * (1 if k < n - 1 else 1)
            cz = wrist[2] - hd2 / 2 + 0.6
            if k == n - 1: cx, cz = wrist[0] - s * (hw2 / 2 - 0.4), wrist[2] + 0.2      # polegar (lado de dentro)
            b0 = (cx, wrist[1] - hh2 + 0.4, cz); L = cl * (0.6 if k == n - 1 else 1)
            if X:
                G.seg(nm, b0, (cx, b0[1] - L, cz - L * 0.35), cw, 0.6, "claw")
            elif K:
                mid = (cx, b0[1] - L * 0.6, cz - L * 0.25); G.seg(nm, b0, mid, cw * 1.1, cw * 1.1, "claw"); G.seg(nm, mid, (cx, mid[1] - L * 0.45, mid[2] - L * 0.35), cw * 0.8, cw * 0.8, "claw")
            else:
                G.seg(nm, b0, (cx, b0[1] - L, cz - L * 0.4), cw, cw, "claw")
        G.bone(it, nm, (wrist[0], wrist[1] - hh2 / 2, wrist[2] - 1))
    # ---------------- pernas digitígradas (joelho para a frente, jarrete para trás, apoio nos dedos)
    lw, sw2, mw = p["leg"]; pw, ph, pd = p["paw"]
    for s, nm in ((1, "leftLeg"), (-1, "rightLeg")):
        x = s * p["hipx"]; G.bone(nm, "root", (x, hip, 0))
        knee = (x + s * 0.3, hip * 0.58, -hip * 0.2); hock = (x + s * 0.2, hip * 0.27, hip * 0.17); ball = (x, ph * 0.6, -0.6)
        G.seg(nm, (x, hip + 0.8, 0), knee, lw, lw + 0.6, "fur" if not X else "fur_s")
        G.seg(nm, knee, hock, sw2, sw2, "fur" if F else "fur_dark" if X else "fur")
        G.seg(nm, hock, ball, mw, mw, "fur_dark")
        G.box(nm, (x - pw / 2, 0, -pd + 0.6), (pw, ph, pd), "fur_dark" if not X else "skin")
        for k in range(3):
            tx = x + (k - 1) * (pw / 3); G.seg(nm, (tx, ph * 0.6, -pd + 0.8), (tx, 0.0, -pd - (1.2 if F else 1.6 if K else 2.2)), 0.7 if F else 0.9, 0.7 if F else 0.9, "claw")
        if F: G.tufts(nm, [(x + s * lw / 2, hip * 0.8, 0), (x, hip * 0.7, lw / 2), (x + s * sw2 / 2, hip * 0.42, 1)], "fur_dark", (1.4, 2), (2, 3), (s * 0.6, -0.6, 0.6), 0.3)
        if K:
            G.box(nm, (x - lw / 2 - 0.3, hip - 1.8, -lw / 2 - 0.6), (lw + 0.6, 2, lw + 1.2), "plate")
            G.tufts(nm, [(x + s * sw2 / 2, hip * 0.4, 0.8), (x, hip * 0.33, sw2 / 2 + 0.4)], "mane_dark", (1.6, 2.2), (2, 3.2), (s * 0.4, -0.6, 0.8), 0.3)
        if X:
            G.seg(nm, (knee[0], knee[1], knee[2] - lw / 2 + 0.4), (knee[0], knee[1] + 1.4, knee[2] - lw / 2 - 2.6), 1.4, 1.4, "bone")   # espinho do joelho
            G.seg(nm, (hock[0], hock[1] + 0.6, hock[2] + sw2 / 2), (hock[0], hock[1] + 2.4, hock[2] + sw2 / 2 + 2.6), 1.0, 1.0, "bone")  # esporão
            G.tufts(nm, [(x + s * lw / 2, hip * 0.85, 0), (x + s * lw / 2, hip * 0.72, -1)], "fur_dark", (1.6, 2.2), (2, 3), (s * 0.7, -0.6, 0.3), 0.3)
    # ---------------- cauda (cadeia tail0..tail5; reto para trás no modelo, as rotações de repouso curvam)
    ty, tz = hip - 0.5, td * 0.36; z = tz; parent = "waist"
    for i, ((w, h, L), r) in enumerate(zip(p["tail"], p["trot"])):
        nm = f"tail{i}"; G.bone(nm, parent, (0, ty, z), (r, 0, 0)); parent = nm
        mat = ("fur" if i < 4 else "fur_light") if F else ("fur_s" if K else ("fur_s" if i % 2 else "fur"))
        G.box(nm, (-w / 2, ty - h / 2, z), (w, h, L), mat)
        if F and i in (1, 2, 3): G.tufts(nm, [(s * w / 2, ty, z + L / 2) for s in (-1, 1)] + [(0, ty + h / 2, z + L / 2)], "fur" if i < 3 else "fur_light", (1.4, 2), (1.6, 2.4), (0, 0.3, 0.6), 0.6)
        if X:
            G.seg(nm, (0, ty + h / 2 - 0.3, z + L * 0.3), (0, ty + h / 2 + 2.8 - i * 0.3, z + L * 0.9), 1.2 - i * 0.08, 1.4 - i * 0.1, "bone")
            if i >= 2:
                for s in (-1, 1): G.seg(nm, (s * w / 2, ty, z + L * 0.5), (s * (w / 2 + 2.0), ty + 0.5, z + L * 0.9), 0.8, 0.8, "bone")
        z += L
    if K:   # tufo na ponta (leão)
        G.tufts("tail5", [(0, ty, z - 0.4)] * 7, "mane", (1.8, 2.6), (3, 4.4), (0, -0.2, 1), 0.9)
        G.box("tail5", (-1.6, ty - 1.6, z - 1.4), (3.2, 3.2, 3.2), "mane_dark")
    if X:   # lâmina na ponta
        G.seg("tail5", (0, ty, z - 0.6), (0, ty + 1.2, z + 4.6), 2.4, 0.6, "bone")
    if F:
        G.box("tail5", (-1.4, ty - 1.4, z - 2.0), (2.8, 2.8, 2.6), "fur_light")
    return G

# ------------------------------------------------------------------ animações (pequenas; só anim_time / modified_move_speed / is_on_ground / property)
def anims():
    S = "query.modified_move_speed"; AIR = "(1 - query.is_on_ground)"
    life = {"loop": True, "animation_length": 3600, "bones": {
        "root": {"position": [0, f"math.abs(math.sin(query.anim_time * 400)) * math.min({S}, 1) * 1.2", 0]},
        "body": {"rotation": [f"math.sin(query.anim_time * 110) * 1.6 + math.min({S}, 1) * 10 - {AIR} * 8", 0, 0]},
        "jaw": {"rotation": [f"5 + math.sin(query.anim_time * 110) * 4 + math.min({S}, 1) * 8 + {AIR} * 10", 0, 0]},
        "mane": {"rotation": [f"math.sin(query.anim_time * 110 + 40) * 2 - math.min({S}, 1) * 6", 0, f"math.sin(query.anim_time * 70) * 1.5"]},
        "ear_l": {"rotation": [0, 0, "math.max(0, math.sin(query.anim_time * 47) - 0.85) * 120"]},
        "ear_r": {"rotation": [0, 0, "-math.max(0, math.sin(query.anim_time * 53 + 90) - 0.85) * 120"]},
        "leftArm": {"rotation": [f"-{AIR} * 35", 0, f"-{AIR} * 18"]},
        "rightArm": {"rotation": [f"-{AIR} * 35", 0, f"{AIR} * 18"]},
        "leftLeg": {"rotation": [f"-{AIR} * 28", 0, 0]},
        "rightLeg": {"rotation": [f"-{AIR} * 12", 0, 0]},
    }}
    for i in range(6):
        life["bones"][f"tail{i}"] = {"rotation": [f"math.sin(query.anim_time * 120 - {i * 35}) * 3 - math.min({S}, 1) * {6 - i} + {AIR} * 6",
                                                  f"math.sin(query.anim_time * 90 - {i * 40}) * ({4 + i} + math.min({S}, 1) * 10)", 0]}
    atk = {"animation_length": 0.4, "bones": {
        "jaw": {"rotation": {"0.0": [0, 0, 0], "0.12": [28, 0, 0], "0.4": [0, 0, 0]}},
        "body": {"rotation": {"0.0": [0, 0, 0], "0.15": [10, -8, 0], "0.4": [0, 0, 0]}},
        "head": {"rotation": {"0.0": [0, 0, 0], "0.12": [-12, 0, 0], "0.4": [0, 0, 0]}},
        "leftArm": {"rotation": {"0.0": [0, 0, 0], "0.1": [-60, 0, -25], "0.25": [-20, 0, 20], "0.4": [0, 0, 0]}},
    }}
    return {"format_version": "1.10.0", "animations": {"animation.etheria.bform.life": life, "animation.etheria.bform.attack": atk}}

# ------------------------------------------------------------------ fiação (RP player.entity + render controller, BP player.json)
BF = "query.property('etheria:bform')"
def scale_of(H):
    return {f: round(FACTOR[f] * 30.0 / H[f], 3) for f in FORMS}

def wire(H):
    sc = scale_of(H)
    RC = {"format_version": "1.8.0", "render_controllers": {"controller.render.etheria_player_beastform": {
        "arrays": {"geometries": {"Array.bg": [f"Geometry.bform_{f}" for f in FORMS]}, "textures": {"Array.bt": [f"Texture.bform_{f}" for f in FORMS]}},
        "geometry": f"Array.bg[math.clamp({BF} - 1, 0, 2)]", "materials": [{"*": "Material.default"}], "textures": [f"Array.bt[math.clamp({BF} - 1, 0, 2)]"]}}}
    json.dump(RC, open(os.path.join(RP, "render_controllers/etheria_player_beastform.render_controllers.json"), "w"), indent=1)
    pe = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(pe)); D = E["minecraft:client_entity"]["description"]
    for f in FORMS:
        D["geometry"][f"bform_{f}"] = f"geometry.etheria_beastform_{f}"; D["textures"][f"bform_{f}"] = f"textures/entity/etheria_beastform_{f}"
    D["animations"]["bform_life"] = "animation.etheria.bform.life"; D["animations"]["bform_attack"] = "animation.etheria.bform.attack"
    an = [x for x in D["scripts"]["animate"] if not (isinstance(x, dict) and any(k.startswith("bform_") for k in x))]
    an.append({"bform_life": f"{BF} > 0"}); an.append({"bform_attack": f"{BF} > 0 && variable.attack_time > 0"})
    D["scripts"]["animate"] = an
    pre = D["scripts"]["pre_animation"]; tag = f" || {BF} > 0"
    for k, line in enumerate(pre):
        if line.startswith("variable.etheria_dragon = (") and tag not in line:
            i = line.rindex(") ? 1.0 : 0.0;"); pre[k] = line[:i] + tag + line[i:]
    rcs = []; cond = f"!variable.is_first_person && !variable.map_face_icon && !query.is_spectator && {BF} > 0 && query.property('etheria:mimic') == 0 && !query.property('etheria:slime')"
    hide = f" && {BF} == 0"
    for x in D["render_controllers"]:
        if isinstance(x, dict) and "controller.render.etheria_player_beastform" in x: continue
        if isinstance(x, dict) and "controller.render.player.third_person" in x:
            v = x["controller.render.player.third_person"].replace(hide, ""); x = {"controller.render.player.third_person": v + hide}
        rcs.append(x)
    rcs.append({"controller.render.etheria_player_beastform": cond}); D["render_controllers"] = rcs
    base = D["scripts"]["scale"]
    if base.startswith(f"{BF} > 0 ?"): base = base.split(")) : (", 1)[1][:-1]
    D["scripts"]["scale"] = f"{BF} > 0 ? ({BF} == 1 ? {sc['fera']} : ({BF} == 2 ? {sc['rei']} : {sc['real']})) : ({base})"
    open(pe, "w").write(json.dumps(E, indent=1, ensure_ascii=False) + "\n")
    # BP
    pj = os.path.join(BP, "entities/player.json"); B = json.load(open(pj)); M = B["minecraft:entity"]; props = M["description"]["properties"]
    props["etheria:bform"] = {"type": "int", "range": [0, 3], "default": 0, "client_sync": True}
    assert len(props) <= 32
    cg = M.setdefault("component_groups", {}); evs = M.setdefault("events", {}); names = [f"etheria:bform_{n}" for n in (1, 2, 3)]
    for n, (w, h) in HITBOX.items(): cg[f"etheria:bform_{n}"] = {"minecraft:collision_box": {"width": w, "height": h}}
    evs["etheria:bform_0"] = {"remove": {"component_groups": names}}
    for n in (1, 2, 3): evs[f"etheria:bform_{n}"] = {"sequence": [{"remove": {"component_groups": [x for x in names if x != f"etheria:bform_{n}"]}}, {"add": {"component_groups": [f"etheria:bform_{n}"]}}]}
    open(pj, "w").write(json.dumps(B, indent=1, ensure_ascii=False) + "\n")
    return sc

def height(geo):
    """altura aproximada do modelo em pé (px) aplicando as rotações de repouso — usada para calcular a escala alvo."""
    g = geo["minecraft:geometry"][0]; bones = {b["name"]: b for b in g["bones"]}; W = {}
    def rot(r):
        x, y, z = [math.radians(v) for v in r]
        Rx = np.array([[1, 0, 0], [0, math.cos(-x), -math.sin(-x)], [0, math.sin(-x), math.cos(-x)]]); Ry = np.array([[math.cos(-y), 0, math.sin(-y)], [0, 1, 0], [-math.sin(-y), 0, math.cos(-y)]])
        Rz = np.array([[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]]); return Rz @ Ry @ Rx
    def M(r, p):
        m = np.eye(4); R = rot(r); m[:3, :3] = R; m[:3, 3] = np.array(p) - R @ np.array(p); return m
    def world(n):
        if n not in W:
            b = bones[n]; m = M(b.get("rotation", [0, 0, 0]), b["pivot"]); W[n] = (world(b["parent"]) @ m) if b.get("parent") else m
        return W[n]
    ys = []
    for n, b in bones.items():
        for c in b.get("cubes", []):
            m = world(n)
            if c.get("rotation"): m = m @ M(c["rotation"], c["pivot"])
            o, s = c["origin"], c["size"]
            for dx in (0, s[0]):
                for dy in (0, s[1]):
                    for dz in (0, s[2]): ys.append((m @ np.array([o[0] + dx, o[1] + dy, o[2] + dz, 1]))[1])
    return max(ys)

def main():
    H = {}; info = {}
    for f in FORMS:
        tex, slots = build_texture(f); tex.save(os.path.join(RP, f"textures/entity/etheria_beastform_{f}.png"))
        G = build(f, slots); geo, n = G.json(None)
        open(os.path.join(RP, f"models/entity/etheria_beastform_{f}.geo.json"), "w").write(json.dumps(geo, separators=(",", ":")) + "\n")
        H[f] = height(geo); info[f] = (n, G.stretch)
    json.dump(anims(), open(os.path.join(RP, "animations/etheria_beastform.animation.json"), "w"), indent=1)
    sc = wire(H)
    for f in FORMS: print(f"{f}: {info[f][0]} cubos, altura {H[f]:.1f} px, escala {sc[f]} (x{FACTOR[f]} do jogador), faces esticadas {info[f][1]}")

if __name__ == "__main__":
    main()

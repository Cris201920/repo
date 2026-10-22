"""8.4 - DRAGÕES VERDADEIROS A PARTIR DOS MODELOS DO USUÁRIO (.bdengine, Block Display Engine).
Fontes (fora do git, ver .git/info/exclude): tools/dragon_src/bd/dragon_serpente.bdengine (serpente oriental) e
tools/dragon_src/bd/dragon_gelo.bdengine (dragão branco alado). Mapeamento:
  * serpente  -> VELGRYND (vermelho/creme/dourado) e VELZARD (branco-lilás/azul-gelo): o corpo do modelo original é uma
    hélice vertical; aqui ele é DESENROLADO ao longo de uma coluna nova longa e ondulada (dragão chinês voando)
  * dragão alado branco -> VELDANAVA (branco com dourado/turquesa), GIGANTE: pescoço erguido, cauda esticada para trás,
    asas abertas e simétricas (a asa direita do modelo, espelhada)
Cada display de bloco/item vira um cubo Bedrock (matriz 4x4 -> centro, tamanho e rotação por decomposição QR). Os cubos são
presos a ossos ao longo da coluna (mesmos nomes que o resto do pipeline espera: d_*, x_serp*) e pintados num atlas próprio
1024x1024 (ladrilhos com detalhe: escamas, placas, chifres, crina/nadadeiras recortadas, olhos).
Depois chama serpent_float.main() e dragon_acts.main() (animações) e grava escalas/colisão.
Uso: python3 tools/dragon_bd.py   (idempotente)"""
import gzip, json, math, os, random, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
SRC = os.path.join(HERE, "dragon_src", "bd")
NAMES = ("velzard", "velgrynd", "veldanava")      # dragões convertidos daqui (dragon_real.py / dragon_hd.py pulam estes)
TW = 1024; T = 64                                  # atlas 1024, ladrilho 64

# ================================================================== leitura do .bdengine
def load_scene(path):
    raw = gzip.open(path).read(); i = raw.find(b'[{"isCollection"')
    return json.JSONDecoder().raw_decode(raw[i:].decode("utf8", "replace"))[0][0]
def displays(path):
    out = []
    def walk(n, P):
        for c in n.get("children", []):
            m = P @ np.array(c["transforms"], float).reshape(4, 4)
            if c.get("isCollection"): walk(c, m)
            else: out.append((c["name"], bool(c.get("isItemDisplay")), m))
    r = load_scene(path); walk(r, np.array(r["transforms"], float).reshape(4, 4)); return out
E = 0.02
def shape(name, item):
    """caixas (em unidades de bloco 0..1) que aproximam o modelo de cada bloco/item"""
    b = name.split("[")[0]
    if item: return [((-.5, -.5, -1 / 32), (.5, .5, 1 / 32))]
    if "candle" in b: return [((7 / 16, 0, 7 / 16), (9 / 16, 6 / 16, 9 / 16))]
    if b == "pointed_dripstone": return [((5 / 16, 0, 5 / 16), (11 / 16, 11 / 16, 11 / 16))] if "direction=up" in name else [((5 / 16, 5 / 16, 5 / 16), (11 / 16, 1, 11 / 16))]
    if b in ("cobweb", "soul_fire", "pumpkin_stem"): return [((0, 0, .5 - E), (1, 1, .5 + E)), ((.5 - E, 0, 0), (.5 + E, 1, 1))]
    if "wall_fan" in b: return [((0, 4 / 16, 0), (14 / 16, 5 / 16, 1))]
    if b.endswith("_pane"): return [((7 / 16, 0, 7 / 16), (9 / 16, 1, 9 / 16))]
    return [((0, 0, 0), (1, 1, 1))]
def raw_cubes(path, K=16):
    """lista de cubos {i, block, item, c (centro px), s (tamanho px), R (3x3)}; i = índice do display"""
    out = []
    for di, (name, item, m) in enumerate(displays(path)):
        A = m[:3, :3]; t = m[:3, 3]
        for a, b in shape(name, item):
            a = np.array(a, float); b = np.array(b, float)
            Q, U = np.linalg.qr(A @ np.diag(b - a))
            sg = np.sign(np.diag(U)); sg[sg == 0] = 1; Q = Q * sg; U = (U.T * sg).T
            if np.linalg.det(Q) < 0: Q[:, 2] *= -1; U[2] *= -1
            out.append(dict(i=di, k=len(out), block=name.split("[")[0], item=item, c=(A @ ((a + b) / 2) + t) * K, s=np.abs(np.diag(U)) * K, R=Q))
    return out

# ================================================================== coluna (spine) e remapeamento
UP = np.array([0., 1., 0.])
def _n(v): L = np.linalg.norm(v); return v / L if L > 1e-9 else v
class Spine:
    """polilinha reamostrada (passo ds) com referencial (t = tangente cauda->cabeça, n = costas, b = t x n)"""
    def __init__(self, pts, ds=1.0):
        pts = [np.array(p, float) for p in pts]; out = [pts[0]]; acc = 0.0
        for a, b in zip(pts, pts[1:]):
            L = np.linalg.norm(b - a); u = ds - acc
            while u <= L: out.append(a + (b - a) * u / L); u += ds
            acc = L - (u - ds)
        if np.linalg.norm(out[-1] - pts[-1]) > 1e-6: out.append(pts[-1])
        P = np.array(out); N = len(P)
        Tn = np.array([_n(P[min(i + 1, N - 1)] - P[max(i - 1, 0)]) for i in range(N)])
        for _ in range(3):   # suaviza tangentes
            Tn = np.array([_n(Tn[max(i - 2, 0):i + 3].mean(0)) for i in range(N)])
        Nn = []; prev = None
        for i in range(N):
            t = Tn[i]; w = np.linalg.norm(np.cross(t, UP)); nu = _n(UP - t * (t @ UP))
            if prev is None: n = nu
            else:
                tr = _n(prev - t * (t @ prev))                     # transporte do anterior
                k = min(1, max(0, (w - 0.35) / 0.3))                # perto da vertical usa só o transporte
                n = _n(tr * (1 - k) + nu * k)
            Nn.append(n); prev = n
        self.P, self.T, self.N = P, Tn, np.array(Nn); self.B = np.cross(self.T, self.N); self.ds = ds; self.L = (N - 1) * ds
    def idx(self, s): return int(max(0, min(len(self.P) - 1, round(s / self.ds))))
    def F(self, s):
        i = self.idx(s); return np.column_stack([self.T[i], self.N[i], self.B[i]])
    def at(self, s): return self.P[self.idx(s)]
    def nearest(self, p):
        d = np.linalg.norm(self.P - p, axis=1); i = int(np.argmin(d)); return i * self.ds, d[i]

def remap(cubes, old, new, assign, fat=1.0, kmap=None):
    """move cada cubo do referencial da coluna antiga para o da nova. assign[cube_i] = s fixo (grupo rígido) ou None (mais perto).
    fat: engorda a seção (offsets laterais/costas e tamanho). Devolve cópias com c, R, s novos e o parâmetro 'u' (s ao longo da coluna)"""
    out = []
    for c in cubes:
        s0 = assign.get(c["i"])
        if s0 is None: s0, _ = old.nearest(c["c"])
        Fo, Fn = old.F(s0), new.F(s0)
        loc = Fo.T @ (c["c"] - old.at(s0))
        k = fat if kmap is None else kmap(c, s0)
        loc = loc * np.array([k if assign.get(c["i"]) is not None else 1.0, k, k])
        d = dict(c); d["c"] = new.at(s0) + Fn @ loc; d["R"] = Fn @ Fo.T @ c["R"]; d["s"] = c["s"] * k; d["u"] = s0
        out.append(d)
    return out

def mirror_x(c, x0=0.0):
    F = np.diag([-1., 1., 1.]); d = dict(c); d["c"] = c["c"].copy(); d["c"][0] = 2 * x0 - c["c"][0]; d["R"] = F @ c["R"] @ F
    return d
def rigid(c, Rm, piv, off=np.zeros(3)):
    d = dict(c); d["c"] = Rm @ (c["c"] - piv) + piv + off; d["R"] = Rm @ c["R"]; return d
def rot(axis, deg):
    a = math.radians(deg); x, y, z = _n(np.array(axis, float)); C, S = math.cos(a), math.sin(a)
    return np.array([[C + x * x * (1 - C), x * y * (1 - C) - z * S, x * z * (1 - C) + y * S],
                     [y * x * (1 - C) + z * S, C + y * y * (1 - C), y * z * (1 - C) - x * S],
                     [z * x * (1 - C) - y * S, z * y * (1 - C) + x * S, C + z * z * (1 - C)]])
def euler(R):
    """matriz -> rotação de cubo Bedrock (mesma convenção de dragon_real.seg / renderizador)"""
    b = math.asin(max(-1, min(1, -R[2][0]))); a = math.atan2(R[2][1], R[2][2]); c = math.atan2(R[1][0], R[0][0])
    return [round(-math.degrees(a), 3), round(-math.degrees(b), 3), round(math.degrees(c), 3)]
def ends(c):
    """extremidades do eixo mais longo do cubo"""
    ax = int(np.argmax(c["s"])); h = c["R"][:, ax] * c["s"][ax] / 2; return c["c"] - h, c["c"] + h

# ================================================================== textura
def sh(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def noise_fill(im, rnd, amp=6):
    px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a: n = rnd.randint(-amp, amp); px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)), a)
def tile(kind, a, b, c=None, seed=1):
    rnd = random.Random(seed); im = Image.new("RGBA", (T, T), a + (255,)); d = ImageDraw.Draw(im)
    if kind == "scales":           # escamas imbricadas com volume
        sz = 12
        for row, y in enumerate(range(-sz // 2, T + sz, sz * 2 // 3)):
            for x in range(-sz + (row % 2) * sz // 2, T + sz, sz):
                base = sh(a, rnd.uniform(0.92, 1.07))
                d.ellipse([x, y, x + sz, y + sz + 2], fill=sh(b, 0.8) + (255,))
                d.ellipse([x + 1, y, x + sz - 1, y + sz], fill=base + (255,))
                d.ellipse([x + 3, y + 1, x + sz - 4, y + sz // 2], fill=sh(base, 1.12) + (255,))
                d.arc([x + 1, y, x + sz - 1, y + sz], 25, 155, fill=sh(b, 0.85) + (255,), width=1)
                d.point((x + 4, y + 2), fill=(255, 255, 255, 150))
        noise_fill(im, rnd, 4)
    elif kind == "plates":         # placas da barriga chanfradas
        for y in range(0, T, 10):
            d.rectangle([0, y, T, y + 9], fill=a + (255,)); d.line([(0, y), (T, y)], fill=sh(a, 1.15) + (255,)); d.line([(0, y + 1), (T, y + 1)], fill=sh(a, 1.07) + (255,))
            d.line([(0, y + 8), (T, y + 8)], fill=sh(b, 0.95) + (255,)); d.line([(0, y + 9), (T, y + 9)], fill=sh(b, 0.75) + (255,))
            for _ in range(2): x = rnd.randint(4, T - 4); d.line([(x, y + 3), (x + rnd.randint(-2, 2), y + 6)], fill=sh(b, 0.9) + (160,))
        noise_fill(im, rnd, 3)
    elif kind == "ridge":          # placas dorsais com borda dourada/clara
        for y in range(0, T, 16):
            d.polygon([(0, y + 15), (T // 2, y), (T, y + 15)], fill=a + (255,)); d.line([(0, y + 15), (T // 2, y), (T, y + 15)], fill=(c or sh(a, 1.4)) + (255,), width=2)
            d.line([(T // 2, y + 2), (T // 2, y + 15)], fill=sh(b, 0.9) + (255,))
        noise_fill(im, rnd, 4)
    elif kind == "horn":           # chifre com anéis e brilho
        for y in range(T):
            t = abs(math.sin(y / T * math.pi)); d.line([(0, y), (T, y)], fill=mix(a, b, t * 0.5) + (255,))
        for y in range(4, T, 9): d.line([(0, y), (T, y + 2)], fill=sh(a, 0.75) + (255,), width=2); d.line([(0, y + 2), (T, y + 4)], fill=sh(b, 1.12) + (200,))
        for x in range(6, T, 17): d.line([(x, 0), (x + 3, T)], fill=sh(b, 1.2) + (110,))
        noise_fill(im, rnd, 3)
    elif kind == "membrane":       # membrana com veias
        for y in range(T): d.line([(0, y), (T, y)], fill=mix(a, b, y / T) + (255,))
        vc = c or sh(b, 0.7)
        for x0 in (8, 26, 44, 58):
            pts = [(x0, 0)]; x = x0
            for y in range(8, T + 8, 8): x += rnd.randint(-3, 3); pts.append((x, y))
            d.line(pts, fill=vc + (255,), width=2)
            for k in range(2, len(pts) - 1, 2): d.line([pts[k], (pts[k][0] + rnd.choice((-7, 7)), pts[k][1] + 8)], fill=vc + (180,), width=1)
        noise_fill(im, rnd, 3)
    elif kind == "flame":          # crina de chama/gelo recortada (alpha)
        im = Image.new("RGBA", (T, T), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        for k in range(7):
            x = 4 + k * 9 + rnd.randint(-2, 2); h = rnd.randint(30, 60)
            d.polygon([(x - 7, T), (x + rnd.randint(-6, 6), T - h), (x + 7, T)], fill=mix(a, b, k / 7) + (255,))
            d.polygon([(x - 3, T), (x + rnd.randint(-3, 3), T - h * 0.6), (x + 3, T)], fill=(c or sh(a, 1.25)) + (255,))
    elif kind == "crystal":        # cristais de gelo recortados (alpha)
        im = Image.new("RGBA", (T, T), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        for k in range(6):
            x = 6 + k * 10 + rnd.randint(-2, 2); h = rnd.randint(28, 62); w = rnd.randint(5, 8)
            d.polygon([(x - w, T), (x - w, T - h * 0.7), (x, T - h), (x + w, T - h * 0.7), (x + w, T)], fill=mix(a, b, k / 6) + (255,))
            d.polygon([(x, T), (x, T - h), (x + w, T - h * 0.7), (x + w, T)], fill=sh(mix(a, b, k / 6), 1.15) + (255,))
            d.line([(x, T - h), (x, T)], fill=(c or (255, 255, 255)) + (255,))
    elif kind == "fan":            # leque/nadadeira com raios (alpha)
        im = Image.new("RGBA", (T, T), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.pieslice([-T * 0.1, -T * 0.1, T * 1.1, T * 1.9], 200, 340, fill=a + (255,))
        for k in range(9):
            ang = math.radians(205 + k * 16.5); d.line([(T / 2, T * 0.9), (T / 2 + math.cos(ang) * T * 0.62, T * 0.9 + math.sin(ang) * T * 0.95)], fill=b + (255,), width=2)
        for k in range(10):
            ang = math.radians(203 + k * 15); x, y = T / 2 + math.cos(ang) * T * 0.6, T * 0.9 + math.sin(ang) * T * 0.92
            d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(0, 0, 0, 0))
    elif kind == "feather":        # pena (alpha)
        im = Image.new("RGBA", (T, T), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.ellipse([T * 0.22, 2, T * 0.78, T - 2], fill=a + (255,)); d.ellipse([T * 0.36, 8, T * 0.64, T - 10], fill=sh(a, 1.08) + (255,))
        d.line([(T / 2, 2), (T / 2, T)], fill=b + (255,), width=2)
        for y in range(8, T - 6, 6): d.line([(T / 2, y), (T * 0.25, y + 6)], fill=sh(a, 0.85) + (255,)); d.line([(T / 2, y), (T * 0.75, y + 6)], fill=sh(a, 0.85) + (255,))
    elif kind == "clawsprite":     # garras curvas (alpha)
        im = Image.new("RGBA", (T, T), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        for k in range(3):
            x = 10 + k * 18; d.polygon([(x, T - 4), (x + 12, T - 4), (x + 16, T * 0.45), (x + 8, 4)], fill=a + (255,)); d.line([(x + 3, T - 8), (x + 9, 8)], fill=b + (255,), width=2)
    elif kind == "eye":            # olho de dragão
        d.rectangle([0, 0, T, T], fill=a + (255,)); d.ellipse([2, T * 0.16, T - 3, T * 0.84], fill=(10, 6, 10, 255))
        for r in range(int(T * 0.31), 0, -1):
            k = r / (T * 0.31); d.ellipse([T / 2 - r * 1.42, T / 2 - r, T / 2 + r * 1.42, T / 2 + r], fill=tuple(min(255, int(b[i] * (1.25 - 0.55 * k))) for i in range(3)) + (255,))
        d.polygon([(T / 2, T * 0.18), (T / 2 + 4, T / 2), (T / 2, T * 0.82), (T / 2 - 4, T / 2)], fill=(6, 2, 6, 255))
        d.ellipse([T * 0.27, T * 0.28, T * 0.27 + 8, T * 0.28 + 6], fill=(255, 255, 255, 240))
    elif kind == "glow":
        for r in range(T // 2, 0, -1): d.ellipse([T / 2 - r, T / 2 - r, T / 2 + r, T / 2 + r], fill=mix(b, a, r / (T / 2)) + (255,))
    elif kind == "fur":            # pelagem/crina sólida em mechas
        for x in range(0, T, 3):
            col = sh(mix(a, b, rnd.random()), rnd.uniform(0.9, 1.1)); d.line([(x, 0), (x + rnd.randint(-3, 3), T)], fill=col + (255,), width=3)
        noise_fill(im, rnd, 3)
    else:                          # sólido com ruído e borda
        noise_fill(im, rnd, 5); d.rectangle([0, 0, T - 1, T - 1], outline=sh(a, 0.85) + (255,))
    return im

class Atlas:
    def __init__(self, spec, seed=1):
        self.uv = {}; self.im = Image.new("RGBA", (TW, TW), (0, 0, 0, 0)); self.alpha = set()
        for k, (role, sp) in enumerate(spec.items()):
            u, v = (k % (TW // T)) * T, (k // (TW // T)) * T
            self.im.paste(tile(sp[0], sp[1], sp[2], sp[3] if len(sp) > 3 else None, seed=seed * 31 + k * 7), (u, v)); self.uv[role] = (u, v)
            if sp[0] in ("flame", "crystal", "fan", "feather", "clawsprite"): self.alpha.add(role)
def face_uv(atlas, role, c, rnd, D=3.0):
    """UV por face: densidade ~D texels por pixel de modelo, deslocamento aleatório dentro do ladrilho; sprites recortados usam o ladrilho todo"""
    u0, v0 = atlas.uv[role]; sx, sy, sz = c["s"]
    dims = {"north": (sx, sy), "south": (sx, sy), "east": (sz, sy), "west": (sz, sy), "up": (sx, sz), "down": (sx, sz)}
    out = {}
    for f, (w, h) in dims.items():
        if role in atlas.alpha:
            flat = min(c["s"]); big = [f for f, (w, h) in dims.items() if min(w, h) > flat * 1.5 or flat > 0.6]
            if f in big: out[f] = {"uv": [u0, v0], "uv_size": [T, T]}
            else: out[f] = {"uv": [u0 + T // 2, v0 + T // 2], "uv_size": [1, 1]}
            continue
        uw, vh = max(2, min(T, round(w * D))), max(2, min(T, round(h * D)))
        out[f] = {"uv": [u0 + rnd.randint(0, T - uw), v0 + rnd.randint(0, T - vh)], "uv_size": [uw, vh]}
    return out

# ================================================================== saída
def bedrock_cube(c, atlas, rnd):
    s = np.maximum(c["s"], 0.02); o = c["c"] - s / 2
    return {"origin": [round(float(v), 3) for v in o], "size": [round(float(v), 3) for v in s], "pivot": [round(float(v), 3) for v in c["c"]],
            "rotation": euler(c["R"]), "uv": face_uv(atlas, c["role"], c, rnd)}
def geo_bones(name, bones, atlas):
    rnd = random.Random(len(name)); out = []
    for b in bones:
        bb = {"name": b["name"], "pivot": [round(float(v), 3) for v in b["pivot"]]}
        if b.get("parent"): bb["parent"] = b["parent"]
        if b.get("cubes"): bb["cubes"] = [bedrock_cube(c, atlas, rnd) for c in b["cubes"]]
        out.append(bb)
    return out
def write_geo(name, bones, atlas, bounds):
    out = geo_bones(name, bones, atlas)
    for ident, fn in ((f"geometry.etheria_pdrg_{name}", f"etheria_pdrg_{name}"), (f"geometry.etheria_pdrg_{name}_boss", f"etheria_pdrg_{name}_boss")):
        desc = {"identifier": ident, "texture_width": TW, "texture_height": TW, "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1], "visible_bounds_offset": [0, bounds[2], 0]}
        json.dump({"format_version": "1.12.0", "minecraft:geometry": [{"description": desc, "bones": out}]}, open(os.path.join(RP, f"models/entity/{fn}.geo.json"), "w"), separators=(",", ":"))
    atlas.im.save(os.path.join(RP, f"textures/entity/etheria_pdrg_{name}.png"))
    return len(out), sum(len(b.get("cubes", [])) for b in out)

# ================================================================== SERPENTE (Velgrynd / Velzard)
S_HEAD = list(range(80, 111)) + list(range(115, 137)) + list(range(161, 185))      # cabeça rígida (inclui bigodes e crina do alto)
S_WHISK = {"x_whisk_l": list(range(130, 137)), "x_whisk_r": list(range(178, 185))}
S_HORN = set(range(97, 109))
S_FIN = list(range(74, 80))                                                          # nadadeira da ponta da cauda
S_LIMBS = [([185], [186], list(range(187, 199)), "arm"), ([199], [200], list(range(201, 213)), "arm"),
           ([213], [214, 215], list(range(216, 224)), "leg"), ([224], [225, 226], list(range(227, 235)), "leg")]
BODY_BLOCKS = {"cyan_concrete", "stripped_warped_hyphae", "waxed_exposed_chiseled_copper", "waxed_chiseled_copper", "stripped_acacia_wood", "raw_copper_block",
               "waxed_oxidized_copper", "weathered_chiseled_copper", "waxed_weathered_copper", "red_concrete", "red_terracotta", "cracked_nether_bricks",
               "crimson_hyphae", "black_glazed_terracotta"}
BELLY_BLOCKS = {"orange_concrete", "orange_terracotta", "jack_o_lantern", "honeycomb_block", "raw_gold_block", "gold_block", "yellow_concrete_powder", "orange_concrete_powder", "nether_wart_block"}

def serpent_old_spine(C):
    ring = [c for c in C if c["i"] <= 73 and c["block"] in BODY_BLOCKS | BELLY_BLOCKS | {"black_concrete"} and 30 <= c["c"][1] <= 168 and not c["item"]]
    P = np.array([c["c"] for c in ring])
    A = np.c_[2 * P[:, 0], 2 * P[:, 2], np.ones(len(P))]; cx, cz, k0 = np.linalg.lstsq(A, P[:, 0] ** 2 + P[:, 2] ** 2, rcond=None)[0]
    R = math.sqrt(k0 + cx * cx + cz * cz)
    o = np.argsort(P[:, 1]); th = np.degrees(np.arctan2(P[o, 2] - cz, P[o, 0] - cx)); un = [th[0]]
    for t in th[1:]: un.append(un[-1] + (t - un[-1] + 180) % 360 - 180)
    k, b = np.polyfit(un, P[o, 1], 1)                                                  # y(θ)
    th0 = (30 - b) / k; th1 = (166 - b) / k
    hel = [(cx + R * math.cos(math.radians(t)), k * t + b, cz + R * math.sin(math.radians(t))) for t in np.linspace(th0, th1, 400)]
    tail = (cx + (R - 4) * math.cos(math.radians(th0 + 22)), 28.0, cz + (R - 4) * math.sin(math.radians(th0 + 22)))
    neck = [(17.5, 180, -11), (15.5, 191, -7), (12, 205, -3), (8, 217, -4), (3, 224, -9)]
    return Spine([tail] + hel + neck)

def serpent_new_spine(L):
    """corpo longo esticado e ondulado (S lateral + onda vertical suave), pescoço subindo até a cabeça"""
    pts = [np.zeros(3)]; d = None
    for i in range(int(L)):
        u = i / L; w = (L - i)
        env = 1 - min(1, max(0, (u - 0.7) / 0.14))
        yaw = math.radians(26 * math.sin(2 * math.pi * w / (L * 0.56) + 0.6) * env)
        ramp = min(1, max(0, (u - 0.84) / 0.16)); ramp = ramp * ramp * (3 - 2 * ramp)
        pitch = math.radians(9 * math.sin(2 * math.pi * w / (L * 0.47)) * env + 78 * ramp + 4)
        d = np.array([math.sin(yaw) * math.cos(pitch), math.sin(pitch), -math.cos(yaw) * math.cos(pitch)])
        pts.append(pts[-1] + d)
    pts.append(pts[-1] + d * (L - int(L)))
    return Spine(pts)

def serpent(roles_of):
    C = raw_cubes(os.path.join(SRC, "dragon_serpente.bdengine"))
    old = serpent_old_spine(C); new = serpent_new_spine(old.L)
    assign = {}
    for i in S_HEAD: assign[i] = old.L
    for i in S_FIN: assign[i] = 0.0
    for up, lo, hand, kind in S_LIMBS:
        root = min(ends(next(c for c in C if c["i"] == up[0])), key=lambda p: old.nearest(p)[1])
        s0, _ = old.nearest(root)
        for i in up + lo + hand: assign[i] = s0
    FAT = 1.35
    M = remap(C, old, new, assign, fat=FAT)
    # posiciona: x centrado, cauda/barriga perto do chão, origem no peito
    L = old.L; pz = new.at(0.74 * L)
    lo = min(c["c"][1] - max(c["s"]) / 2 for c in M if c["i"] not in S_HEAD)
    off = np.array([-np.mean([c["c"][0] for c in M]), 8 - lo, -pz[2]])
    for c in M: c["c"] = c["c"] + off
    sp = lambda s: new.at(s) + off
    # ossos ao longo da coluna
    cuts = {"d_neck3": (0.953, 1.01), "d_neck2": (0.906, 0.953), "d_neck1": (0.86, 0.906), "d_upper_body": (0.78, 0.86), "d_body": (0.70, 0.78)}
    tail = []; n = 20; a = 0.70
    for j in range(n):
        b0 = a - 0.70 / n; nm = f"d_tail{j + 1}" if j < 5 else f"x_serp{j - 4}"; cuts[nm] = (max(-0.01, b0), a); tail.append(nm); a = b0
    bones = [{"name": "d_All", "pivot": [0, 0, 0], "cubes": []}]
    pv = lambda u: sp(u * L)
    bones.append({"name": "d_body", "parent": "d_All", "pivot": pv(0.74), "cubes": []})
    bones.append({"name": "d_upper_body", "parent": "d_body", "pivot": pv(0.78), "cubes": []})
    prev = "d_upper_body"
    for nm, u in (("d_neck1", 0.86), ("d_neck2", 0.906), ("d_neck3", 0.953)):
        bones.append({"name": nm, "parent": prev, "pivot": pv(u), "cubes": []}); prev = nm
    prev = "d_body"
    for nm in tail:
        bones.append({"name": nm, "parent": prev, "pivot": pv(cuts[nm][1]), "cubes": []}); prev = nm
    B = {b["name"]: b for b in bones}
    def seg_of(u):
        for nm, (a_, b_) in cuts.items():
            if a_ <= u < b_: return nm
        return "d_neck3" if u >= 1 else tail[-1]
    # cabeça e mandíbula
    hb = sp(L); Fh = new.F(L)
    head = {"name": "d_head", "parent": "d_neck3", "pivot": hb, "cubes": []}
    jaw = {"name": "d_lower_jaw", "parent": "d_head", "pivot": None, "cubes": []}
    wh = {k: {"name": k, "parent": "d_head", "pivot": None, "cubes": []} for k in S_WHISK}
    limbs = []
    for c in M:
        c["role"] = roles_of(c, c["u"] / L)
        if c["i"] in S_HEAD:
            wk = next((k for k, v in S_WHISK.items() if c["i"] in v), None)
            if wk: wh[wk]["cubes"].append(c)
            elif c["i"] in S_JAW: jaw["cubes"].append(c)
            else: head["cubes"].append(c)
        elif any(c["i"] in up + lo + hd for up, lo, hd, _ in S_LIMBS): continue
        else: B[seg_of(c["u"] / L)]["cubes"].append(c)
    bones += [head, jaw] + list(wh.values())
    for k, b in wh.items():   # raiz do bigode = ponta mais perto da cabeça
        b["pivot"] = min((p for c in b["cubes"] for p in ends(c)), key=lambda p: np.linalg.norm(p - hb))
    jc = [c["c"] for c in jaw["cubes"]]; jaw["pivot"] = (np.max(jc, 0) + np.min(jc, 0)) / 2 if jc else hb
    # mandíbula gira na junta de trás (lado oposto ao focinho)
    fwd = _n(np.mean([c["c"] for c in head["cubes"]], 0) - hb)
    if jc: jaw["pivot"] = min((p for c in jaw["cubes"] for p in ends(c)), key=lambda p: (p - hb) @ fwd)
    for up, lo, hd, kind in S_LIMBS:
        cu = [c for c in M if c["i"] in up]; cl = [c for c in M if c["i"] in lo]; ch = [c for c in M if c["i"] in hd]
        root = min(ends(cu[0]), key=lambda p: np.linalg.norm(p - sp(cu[0]["u"])))
        elbow = max(ends(cu[0]), key=lambda p: np.linalg.norm(p - root))
        wrist = max((p for c in cl for p in ends(c)), key=lambda p: np.linalg.norm(p - elbow))
        side = "left" if root[0] > 0 else "right"; par = seg_of(cu[0]["u"] / L)
        if kind == "arm":
            limbs += [{"name": f"d_{side}_arm", "parent": par, "pivot": root, "cubes": cu}, {"name": f"d_{side}_arm_lower", "parent": f"d_{side}_arm", "pivot": elbow, "cubes": cl},
                      {"name": f"d_{side}_hand", "parent": f"d_{side}_arm_lower", "pivot": wrist, "cubes": ch}, {"name": f"d_{side}_hand_lower", "parent": f"d_{side}_hand", "pivot": wrist, "cubes": []},
                      {"name": f"d_{side}_thumb", "parent": f"d_{side}_arm_lower", "pivot": wrist, "cubes": []}]
        else:
            limbs += [{"name": f"d_{side}_leg", "parent": par, "pivot": root, "cubes": cu}, {"name": f"d_{side}_leg_lower", "parent": f"d_{side}_leg", "pivot": elbow, "cubes": cl},
                      {"name": f"d_{side}_leg_foot", "parent": f"d_{side}_leg_lower", "pivot": wrist, "cubes": ch}]
    bones += limbs
    # asas (o modelo não tem): ossos vazios para as animações genéricas não falharem
    for side in ("left", "right"):
        prev = "d_upper_body"
        for k in ("base", "top", "mid", "low"):
            bones.append({"name": f"d_{side}_wing_{k}", "parent": prev, "pivot": pv(0.82), "cubes": []}); prev = f"d_{side}_wing_{k}"
    return bones, M, L
S_JAW = set()

# ================================================================== DRAGÃO ALADO (Veldanava)
G_RINGS = [(81, 82), (86, 87), (91, 92), (101, 102), (106, 107), (96, 97), (111, 112), (116, 117), (121, 122), (126, 127), (131, 132), (136, 137), (141, 142), (146, 147), (277, 278)]
G_HEAD = set(range(0, 81)) | {255, 256, 268, 269, 270}
G_JAW = {41, 42, 59, 60, 61, 78, 79}
G_EYES = {4, 5, 6, 10, 11, 12}
G_HORNS = set(range(13, 41))
G_LEGS = [([151, 152], [153], list(range(293, 298)), "arm"), ([154, 155], [156], list(range(288, 293)), "arm"),
          ([282, 283], [284], list(range(298, 303)), "leg"), ([285, 286], [287], list(range(303, 308)), "leg")]
G_WING = {"base": list(range(165, 169)) + [214, 223, 224], "top": list(range(169, 173)) + list(range(215, 219)) + [225, 226] + list(range(248, 252)),
          "mid": list(range(181, 185)) + list(range(189, 193)) + [219, 221, 222] + list(range(227, 231)) + list(range(233, 237)) + [252, 253],
          "low": list(range(185, 189)) + [220, 231, 232, 254]}
G_WING_OLD = set(range(157, 165)) | set(range(173, 181)) | set(range(193, 214)) | set(range(237, 248))   # asa esquerda original (dobrada): trocada pelo espelho da direita

WING_SWEEP, WING_DROP = 30, -8
def winged(roles_of):
    C = raw_cubes(os.path.join(SRC, "dragon_gelo.bdengine"))
    for c in C: c["i"] = c["k"]                                    # aqui os grupos usam o índice do cubo
    C = [c for c in C if c["k"] not in G_WING_OLD]
    byk = {c["k"]: c for c in C}
    ring = [np.mean([byk[a]["c"]] + [byk[b + j]["c"] for j in range(4)], 0) for a, b in G_RINGS]
    tipdir = _n(ring[-1] - ring[-2]); hd = _n(ring[0] - ring[1])
    pts = [ring[-1] + tipdir * 6] + ring[::-1] + [ring[0] + hd * 9]
    old = Spine(pts)
    s_ring = [old.nearest(p)[0] for p in ring]                    # posição de cada anel na coluna
    s_sh, s_hip = s_ring[4], s_ring[6]                            # ombro (anel 106) e quadril (anel 111)
    L = old.L
    endpitch = math.degrees(math.asin(old.T[-1][1]))
    def pitch(s):
        if s < s_hip:                                              # cauda: ponta erguida, desce um pouco e sobe até o quadril
            u = s / s_hip; return -16 * (1 - u) ** 2 + 10 * math.sin(math.pi * u) * 0.8 + 4 * u
        if s < s_sh: return 5.0
        u = (s - s_sh) / (L - s_sh)
        if u < 0.12: return 5 + 35 * u / 0.12                                # pescoço em S de cisne: sobe forte e curva para a frente
        a0, a1, a2 = 40.0, 82.0, endpitch + 30
        if u < 0.3: return a0 + (a1 - a0) * (u - 0.12) / 0.18
        if u < 0.55: return a1
        return a1 + (a2 - a1) * ((u - 0.55) / 0.45) ** 1.2
    P = [np.zeros(3)]
    for i in range(int(L)):
        p = math.radians(pitch(i + 0.5)); P.append(P[-1] + np.array([0, math.sin(p), -math.cos(p)]))
    new = Spine(P + [P[-1] + (P[-1] - P[-2]) * (L - int(L))])
    assign = {k: L for k in G_HEAD}
    s_mid = (s_sh + s_hip) / 2                                     # patas e asas presas ao tronco (referencial do meio do tronco)
    for up, lo, hd_, kind in G_LEGS:
        for k in up + lo + hd_: assign[k] = s_mid
    for part in G_WING.values():
        for k in part: assign[k] = s_mid
    M = remap(C, old, new, assign, fat=1.0)
    # patas e asas: transformação rígida única do tronco (eixo quadril->ombro antigo -> eixo novo)
    def frame(t):
        t = _n(t); n = _n(UP - t * (t @ UP)); return np.column_stack([t, n, np.cross(t, n)])
    Rb = frame(new.at(s_sh) - new.at(s_hip)) @ frame(ring[4] - ring[6]).T
    oc = (ring[4] + ring[6]) / 2; nc = (new.at(s_sh) + new.at(s_hip)) / 2
    rigid_k = {k for g in G_LEGS for part in g[:3] for k in part} | {k for part in G_WING.values() for k in part}
    for c in M:
        if c["k"] in rigid_k:
            o = next(x for x in C if x["k"] == c["k"]); c["c"] = nc + Rb @ (o["c"] - oc); c["R"] = Rb @ o["R"]; c["s"] = o["s"]
    byk2 = {c["k"]: c for c in M}
    # pose de repouso da asa direita: varre para trás e abaixa um pouco (em torno do ombro)
    arm0 = byk2[165]; shp = min(ends(arm0), key=lambda p: abs(p[0] - nc[0]))
    Rw = rot((0, 0, 1), WING_DROP) @ rot(UP, -WING_SWEEP)
    for part in G_WING.values():
        for k in part: byk2[k].update(rigid(byk2[k], Rw, shp))
    # asa esquerda = espelho da direita (em relação ao plano x = 0 da coluna nova)
    x0 = float(nc[0]); wl = []
    for part, ks in G_WING.items():
        for k in ks: m = mirror_x(byk2[k], x0); m["k"] = m["i"] = 10000 + k; m["wing"] = ("left", part); wl.append(m)
        for k in ks: byk2[k]["wing"] = ("right", part)
    M += wl
    # chão nos pés, x centrado, origem no meio do tronco
    feet = [c for c in M if any(c["k"] in g[2] for g in G_LEGS)]
    lo = min(c["c"][1] - 1.5 for c in feet); mid = new.at((s_sh + s_hip) / 2)
    off = np.array([-x0, -lo, -mid[2]])
    for c in M: c["c"] = c["c"] + off
    sp = lambda s: new.at(s) + off
    bones = [{"name": "d_All", "pivot": [0, 0, 0], "cubes": []}]
    sm = (s_sh + s_hip) / 2
    cuts = [("d_body", s_hip, sm), ("d_upper_body", sm, s_sh)]
    nk = [s_sh + (L - s_sh) * j / 3 for j in range(4)]
    cuts += [("d_neck1", nk[0], nk[1]), ("d_neck2", nk[1], nk[2]), ("d_neck3", nk[2], L + 1)]
    tk = [s_hip * (1 - j / 5) for j in range(6)]
    cuts += [(f"d_tail{j + 1}", tk[j + 1] if j < 4 else -1, tk[j]) for j in range(5)]
    piv = {"d_body": sp(sm), "d_upper_body": sp(sm), "d_neck1": sp(nk[0]), "d_neck2": sp(nk[1]), "d_neck3": sp(nk[2])}
    par = {"d_body": "d_All", "d_upper_body": "d_body", "d_neck1": "d_upper_body", "d_neck2": "d_neck1", "d_neck3": "d_neck2"}
    for j in range(5): piv[f"d_tail{j + 1}"] = sp(tk[j]); par[f"d_tail{j + 1}"] = "d_body" if j == 0 else f"d_tail{j}"
    B = {}
    for nm, a, b in cuts: B[nm] = {"name": nm, "parent": par[nm], "pivot": piv[nm], "cubes": []}
    def seg_of(s):
        for nm, a, b in cuts:
            if a <= s < b: return nm
        return "d_neck3"
    head = {"name": "d_head", "parent": "d_neck3", "pivot": sp(L), "cubes": []}
    jaw = {"name": "d_lower_jaw", "parent": "d_head", "pivot": None, "cubes": []}
    wings = {(sd, p): {"name": f"d_{sd}_wing_{p}", "parent": None, "pivot": None, "cubes": []} for sd in ("left", "right") for p in G_WING}
    legs = []
    legset = {k for g in G_LEGS for part in g[:3] for k in part}
    for c in M:
        c["role"] = roles_of(c, c["u"] / L)
        if "wing" in c: wings[c["wing"]]["cubes"].append(c)
        elif c["k"] in G_JAW: jaw["cubes"].append(c)
        elif c["k"] in G_HEAD: head["cubes"].append(c)
        elif c["k"] in legset: continue
        else: B[seg_of(c["u"])]["cubes"].append(c)
    # juntas da asa: ombro, cotovelo, pulso
    for sd in ("left", "right"):
        arm = [c for c in wings[(sd, "base")]["cubes"] if c["k"] % 10000 in range(165, 169)]
        fore = [c for c in wings[(sd, "top")]["cubes"] if c["k"] % 10000 in range(169, 173)]
        ac = np.mean([c["c"] for c in arm], 0); fc = np.mean([c["c"] for c in fore], 0)
        a0, a1 = ends(arm[0]); sh_ = min((a0, a1), key=lambda p: abs(p[0])); el = max((a0, a1), key=lambda p: abs(p[0]))
        f0, f1 = ends(fore[0]); wr = max((f0, f1), key=lambda p: np.linalg.norm(p - el))
        prev = "d_upper_body"
        for p, pv in (("base", sh_), ("top", el), ("mid", wr), ("low", wr)):
            w = wings[(sd, p)]; w["parent"] = prev; w["pivot"] = pv; prev = w["name"]
    for up, lo_, hd_, kind in G_LEGS:
        cu = [byk2[k] for k in up]; cl = [byk2[k] for k in lo_]; ch = [byk2[k] for k in hd_]
        root = max((p for c in cu for p in ends(c)), key=lambda p: p[1])
        knee = min(ends(cu[-1]), key=lambda p: p[1]); ankle = min(ends(cl[0]), key=lambda p: p[1])
        side = "left" if root[0] > 0 else "right"; parent = seg_of(cu[0]["u"])
        if kind == "arm":
            legs += [{"name": f"d_{side}_arm", "parent": "d_upper_body", "pivot": root, "cubes": cu}, {"name": f"d_{side}_arm_lower", "parent": f"d_{side}_arm", "pivot": knee, "cubes": cl},
                     {"name": f"d_{side}_hand", "parent": f"d_{side}_arm_lower", "pivot": ankle, "cubes": ch}, {"name": f"d_{side}_hand_lower", "parent": f"d_{side}_hand", "pivot": ankle, "cubes": []},
                     {"name": f"d_{side}_thumb", "parent": f"d_{side}_arm_lower", "pivot": ankle, "cubes": []}]
        else:
            legs += [{"name": f"d_{side}_leg", "parent": "d_body", "pivot": root, "cubes": cu}, {"name": f"d_{side}_leg_lower", "parent": f"d_{side}_leg", "pivot": knee, "cubes": cl},
                     {"name": f"d_{side}_leg_foot", "parent": f"d_{side}_leg_lower", "pivot": ankle, "cubes": ch}]
    jc = jaw["cubes"]
    fwd = _n(np.mean([c["c"] for c in head["cubes"]], 0) - head["pivot"])
    jaw["pivot"] = min((p for c in jc for p in ends(c)), key=lambda p: (p - head["pivot"]) @ fwd) if jc else head["pivot"]
    order = ["d_body", "d_upper_body", "d_neck1", "d_neck2", "d_neck3"] + [f"d_tail{j}" for j in range(1, 6)]
    bones += [B[n] for n in order] + [head, jaw] + legs + [wings[(sd, p)] for sd in ("left", "right") for p in ("base", "top", "mid", "low")]
    return bones, M, L

# ================================================================== papéis (qual ladrilho cada cubo usa) e paletas
def serp_role(c, u):
    i, b = c["i"], c["block"]
    if i in S_HORN: return "horn"
    if b == "gold_ingot": return "eye"
    if b == "gold_nugget": return "tooth"
    if b.endswith("_pane"): return "whisker"
    if b == "mutton": return "clawsprite"
    if b == "feather": return "feather"
    if i in S_FIN or "wall_fan" in b: return "fin"
    if b == "fire_coral": return "mane"
    if b == "dead_brain_coral_fan": return "mane2"
    if b == "horn_coral": return "mane3"
    if any(i in g[0] + g[1] + g[2] for g in S_LIMBS): return "claw" if max(c["s"]) < 7 else "limb"
    if i in S_HEAD:
        if b == "black_concrete": return "headdark"
        if b == "nether_wart_block": return "mouth"
        if b in BELLY_BLOCKS: return "belly"
        return "head"
    if b == "black_concrete": return "back"
    if b in BELLY_BLOCKS: return "belly"
    return f"body{min(3, int(u * 4))}"

def serp_spec(p):
    return {"body0": ("scales", p["b0"], sh(p["b0"], 0.6)), "body1": ("scales", p["b1"], sh(p["b1"], 0.6)), "body2": ("scales", p["b2"], sh(p["b2"], 0.6)),
            "body3": ("scales", p["b3"], sh(p["b3"], 0.6)), "back": ("ridge", p["back"], sh(p["back"], 0.6), p["edge"]), "belly": ("plates", p["belly"], p["belly2"]),
            "head": ("scales", p["head"], sh(p["head"], 0.6)), "headdark": ("ridge", p["hdark"], sh(p["hdark"], 0.6), p["edge"]), "horn": ("horn", p["horn"], p["horn2"]),
            "eye": ("eye", p["eye0"], p["eye"]), "tooth": ("horn", p["tooth"], (255, 255, 255)), "whisker": ("horn", p["whisk"], p["whisk2"]),
            "mane": (p["mk"], p["m1"], p["m1b"], p["mc"]), "mane2": (p["mk"], p["m2"], p["m2b"], p["mc"]), "mane3": (p["mk"], p["m3"], p["m3b"], p["mc"]),
            "feather": ("feather", p["feather"], p["feather2"]), "fin": ("fan", p["fin"], p["fin2"]), "clawsprite": ("clawsprite", p["claw"], p["claw2"]),
            "claw": ("horn", p["claw"], p["claw2"]), "limb": ("scales", p["b3"], sh(p["b3"], 0.6)), "mouth": ("solid", p["mouth"], (0, 0, 0))}
PAL = {
  # VELGRYND: carmesim profundo perto da cabeça -> escarlate -> laranja-rubi na cauda; costas vinho com borda dourada; barriga creme;
  # chifres marfim-dourado; crina de chamas douradas/laranja; olhos âmbar; bigodes dourados
  "velgrynd": dict(b0=(226, 86, 46), b1=(214, 58, 42), b2=(196, 36, 40), b3=(176, 24, 36), back=(122, 14, 26), edge=(244, 196, 84), belly=(247, 233, 206), belly2=(212, 188, 150),
                   head=(198, 30, 38), hdark=(120, 12, 22), horn=(248, 238, 210), horn2=(226, 178, 86), eye0=(70, 10, 14), eye=(255, 196, 40), tooth=(250, 244, 226),
                   whisk=(238, 190, 76), whisk2=(255, 236, 150), mk="flame", m1=(255, 186, 56), m1b=(255, 96, 30), m2=(250, 120, 40), m2b=(214, 38, 30), m3=(255, 222, 110), m3b=(255, 150, 46),
                   mc=(255, 244, 190), feather=(255, 232, 170), feather2=(214, 150, 60), fin=(232, 62, 40), fin2=(255, 204, 84), claw=(60, 32, 26), claw2=(226, 188, 120), mouth=(110, 18, 30)),
  # VELZARD: branco-lilás perto da cabeça -> azul-gelo na cauda; costas azul-gelo com borda branca; barriga branca; chifres de cristal;
  # crina de cristais de gelo; olhos ciano; bigodes azul-claros
  "velzard": dict(b0=(190, 220, 250), b1=(208, 224, 250), b2=(224, 224, 250), b3=(236, 232, 252), back=(112, 156, 226), edge=(236, 248, 255), belly=(250, 250, 255), belly2=(204, 212, 238),
                  head=(238, 234, 252), hdark=(128, 150, 216), horn=(176, 218, 255), horn2=(236, 248, 255), eye0=(40, 50, 92), eye=(120, 232, 255), tooth=(246, 249, 255),
                  whisk=(150, 204, 255), whisk2=(232, 246, 255), mk="crystal", m1=(206, 236, 255), m1b=(120, 180, 250), m2=(232, 246, 255), m2b=(160, 200, 255), m3=(196, 176, 244), m3b=(140, 196, 255),
                  mc=(255, 255, 255), feather=(246, 249, 255), feather2=(170, 200, 240), fin=(184, 222, 255), fin2=(110, 160, 232), claw=(70, 82, 124), claw2=(206, 224, 255), mouth=(92, 60, 124)),
}
def gelo_role(c, u):
    k, b = c["k"] % 10000, c["block"]
    if "wing" in c:
        if b == "pointed_dripstone": return "gold"
        if b == "cobweb" or min(c["s"]) < 1.5: return "membrane"
        return "wbone"
    if k in G_EYES: return "eye" if b == "soul_fire" else "gold"
    if k in G_HORNS or b == "pumpkin_stem": return "horn"
    if b == "black_candle" or b == "pointed_dripstone": return "claw"
    if b == "reinforced_deepslate": return "ridge"
    if "wall_fan" in b: return "fin"
    if b == "pearlescent_froglight": return "belly"
    if b in ("white_candle",): return "horn"
    if k in G_HEAD or k in G_JAW: return "head"
    return "scales"
VELDANAVA_SPEC = {"scales": ("scales", (248, 248, 252), (206, 212, 228)), "belly": ("plates", (252, 246, 232), (222, 196, 140)), "head": ("scales", (252, 252, 255), (210, 216, 232)),
                  "ridge": ("ridge", (240, 200, 92), (168, 118, 38), (255, 244, 190)), "fin": ("fan", (96, 224, 214), (34, 150, 160)), "horn": ("horn", (250, 236, 196), (228, 182, 80)),
                  "gold": ("horn", (238, 192, 80), (255, 236, 160)), "claw": ("horn", (226, 180, 70), (255, 230, 150)), "eye": ("glow", (90, 255, 236), (220, 255, 250)),
                  "wbone": ("horn", (246, 246, 250), (230, 196, 110)), "membrane": ("membrane", (250, 252, 255), (150, 226, 222), (226, 186, 84))}
GELO_SCALE = 1.5                     # escala embutida no modelo da Veldanava (o chefe ganha o resto no scripts.scale)

def scale_bones(bones, k):
    for b in bones:
        b["pivot"] = np.array(b["pivot"], float) * k
        for c in b.get("cubes", []): c["c"] = c["c"] * k; c["s"] = c["s"] * k
    return bones

def extents(bones):
    P = []
    for b in bones:
        for c in b.get("cubes", []):
            h = np.abs(c["R"]) @ (c["s"] / 2); P += [c["c"] - h, c["c"] + h]
    P = np.array(P); return P.min(0), P.max(0)

# ================================================================== tamanhos (escala do chefe na forma de dragão, colisão da forma de dragão)
SIZE = {"velzard": (1.1, (6.0, 6.0)), "velgrynd": (1.1, (6.0, 6.0)), "veldanava": (round(4.0 / GELO_SCALE, 3), (12.0, 12.0))}

def build_all():
    rep = {}
    sb, sm, sl = serpent(serp_role)
    for name in ("velgrynd", "velzard"):
        mn, mx = extents(sb); sc = SIZE[name][0]
        bw = math.ceil(max(mx[0] - mn[0], mx[2] - mn[2]) / 16 * 1.15) + 4; bh = math.ceil((mx[1] - mn[1]) / 16 * 1.15) + 4
        rep[name] = write_geo(name, sb, Atlas(serp_spec(PAL[name]), seed=len(name)), (bw, bh, round(bh / 2, 1))) + (round((mx[2] - mn[2]) / 16, 1), round((mx[1] - mn[1]) / 16, 1))
    gb, gm, gl = winged(gelo_role); scale_bones(gb, GELO_SCALE)
    mn, mx = extents(gb)
    bw = math.ceil(max(mx[0] - mn[0], mx[2] - mn[2]) / 16 * 1.15) + 4; bh = math.ceil((mx[1] - mn[1]) / 16 * 1.15) + 4
    rep["veldanava"] = write_geo("veldanava", gb, Atlas(VELDANAVA_SPEC, seed=9), (bw, bh, round(bh / 2, 1))) + (round((mx[0] - mn[0]) / 16, 1), round((mx[2] - mn[2]) / 16, 1), round((mx[1] - mn[1]) / 16, 1))
    return rep

def sizes():
    for name, (sc, (cw, ch)) in SIZE.items():
        ep = os.path.join(RP, f"entity/{name}.entity.json"); E = json.load(open(ep)); s_ = E["minecraft:client_entity"]["description"].setdefault("scripts", {})
        old = s_.get("scale", "1.0")
        s_["scale"] = re.sub(r"== 'dragon' \\? [0-9.]+", f"== 'dragon' ? {sc}", old) if "'dragon'" in str(old) else str(sc)
        json.dump(E, open(ep, "w"), indent=1, ensure_ascii=False)
        bp = os.path.join(BP, f"entities/{name}.json"); Bj = json.load(open(bp)); txt = json.dumps(Bj)
        cols = re.findall(r'"minecraft:collision_box": \\{"width": ([0-9.]+), "height": ([0-9.]+)\\}', txt)
        if cols:
            big = max(cols, key=lambda x: float(x[0]))
            txt = txt.replace(f'"minecraft:collision_box": {{"width": {big[0]}, "height": {big[1]}}}', f'"minecraft:collision_box": {{"width": {cw}, "height": {ch}}}')
            json.dump(json.loads(txt), open(bp, "w"), indent=1, ensure_ascii=False)

def main():
    rep = build_all()
    for k, v in rep.items(): print(k, "ossos/cubos/tamanho(blocos, escala 1):", v)
    sizes()
    import serpent_float, dragon_acts
    serpent_float.main(); dragon_acts.main()
    print("ok")

if __name__ == "__main__":
    main()

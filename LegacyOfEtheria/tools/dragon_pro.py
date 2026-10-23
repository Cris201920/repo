"""8.9 - DRAGÕES PROFISSIONAIS: geometria e textura 100% procedurais (sem texturas externas), alta definição.
Substitui os modelos convertidos dos .bdengine (dragon_bd.py) e o Dragão Marinho antigo (sea_dragon.py):
  * VELDANAVA (alado; também Dragão do Vazio e Dragão Carmim domável, mesma geometria, texturas próprias):
      asa com estrutura real - úmero, antebraço, polegar com garra, 4 dedos longos articulados (ossos d_*_wing_f1..f4) e
      MEMBRANA em painéis finos recortados (alpha) com borda festonada entre os dedos, veias e borda escura; envergadura
      ~2,2x o comprimento cabeça-quadril; corpo octogonal (cubo + chanfro), escamas em relevo (placas sobrepostas), placas
      ventrais, crista de espinhos, cabeça com crânio, sobrancelhas, focinho afilado, narinas, olhos brilhantes, chifres
      curvos em segmentos, espinhos das bochechas, MANDÍBULA separada com dentes e língua; patas com dedos e garras; cauda
      afilada com espinhos e lâmina em leque.
  * VELZARD / VELGRYND (serpentes; também Dragão de Gelo e Dragão da Tempestade domáveis): corpo longo octogonal com
      escamas em relevo, placas ventrais, nadadeira dorsal recortada, juba no pescoço/cabeça, chifres-galhada, bigodes
      longos (x_whisk_l/r), barba, mandíbula separada com dentes, 4 patas com garras de águia, leque na ponta da cauda.
  * DRAGÃO MARINHO: leviatã com os mesmos recursos (barbatanas com raios e membrana recortada, coroa de espinhos, babados).
Nomes de ossos/pivôs compatíveis com as animações existentes (d_*, x_serp*, x_whisk_*, sd_*). Atlas 1024 por dragão:
ladrilhos de 128 px (escamas imbricadas sombreadas, placas, chifres, olhos, boca, juba...) + regiões das membranas.
Uso: python3 tools/dragon_pro.py [--no-anims]   (idempotente; chamado também por dragon_bd.py / sea_dragon.py)"""
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from dragon_bd import rot, euler, _n, Spine, serpent_new_spine
ROOT = os.path.dirname(HERE); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
TW = 1024; T = 128; TILE_ROWS = 4                                     # ladrilhos em cima (4 x 8), membranas embaixo
I3 = np.eye(3)
def A(*v): return np.array(v[0] if len(v) == 1 else v, float)

# ================================================================== geometria
def frame(z, up=(0, 1, 0)):
    """colunas (x, y, z): z = direção dada, y = 'up' ortogonalizado, x = y × z"""
    z = _n(A(z)); u = A(up); y = u - z * (z @ u)
    if np.linalg.norm(y) < 1e-6: y = A(0, 0, 1) - z * z[2]
    y = _n(y); return np.column_stack([np.cross(y, z), y, z])

class Model:
    def __init__(s): s.B = {}; s.order = []
    def bone(s, name, parent, pivot):
        s.B[name] = {"name": name, "parent": parent, "pivot": A(pivot), "cubes": []}; s.order.append(name); return name
    def cube(s, bone, c, size, R=None, mat="skin", **kw):
        d = dict(c=A(c), s=np.abs(A(size)), R=I3 if R is None else R, mat=mat); d.update(kw); s.B[bone]["cubes"].append(d); return d
    def ncubes(s): return sum(len(b["cubes"]) for b in s.B.values())

class Pen:
    """desenha num osso com uma transformação local (origem O, rotação Q)"""
    def __init__(s, m, bone, O=(0, 0, 0), Q=I3): s.m, s.bone, s.O, s.Q = m, bone, A(O), Q
    def P(s, p): return s.O + s.Q @ A(p)
    def at(s, bone): return Pen(s.m, bone, s.O, s.Q)
    def box(s, c, size, R=I3, mat="skin", **kw): return s.m.cube(s.bone, s.P(c), size, s.Q @ R, mat, **kw)
    def beam(s, p0, p1, w, h, up=(0, 1, 0), mat="skin", ext=0.0, roll=0.0, **kw):
        p0, p1 = A(p0), A(p1); L = np.linalg.norm(p1 - p0)
        R = frame(s.Q @ (p1 - p0), s.Q @ A(up))
        if roll: R = R @ rot((0, 0, 1), roll)
        return s.m.cube(s.bone, s.O + s.Q @ ((p0 + p1) / 2), (w, h, L + ext), R, mat, **kw)
    def chain(s, p0, d0, length, n, w0, w1, axis, bend, mats, up=(0, 1, 0), h_ratio=1.0, ext=0.6):
        """chifre/garra/dedo curvo em n segmentos; devolve a ponta"""
        p = A(p0); d = _n(A(d0)); Rb = rot(axis, bend / max(1, n))
        for k in range(n):
            w = w0 + (w1 - w0) * k / max(1, n - 1); q = p + d * length / n
            mat = mats[min(len(mats) - 1, int(k * len(mats) / n))] if isinstance(mats, (list, tuple)) else mats
            s.beam(p, q, w, w * h_ratio, up, mat, ext=ext * w); p = q; d = Rb @ d
        return p
    def spike(s, base, d, L, w, mats=("spike0", "spike1"), up=(0, 1, 0)):
        d = _n(A(d)); b = A(base); m = b + d * L * 0.45
        s.beam(b - d * w * 0.3, m, w, w, up, mats[0]); s.beam(m, b + d * L, w * 0.5, w * 0.5, up, mats[1], ext=w * 0.2)
    def sprite(s, base, d, L, W, normal, tile, **kw):
        """plano recortado (alpha): a imagem vai da base (embaixo) até a ponta (em cima)"""
        d = _n(s.Q @ A(d)); nrm = s.Q @ A(normal); nrm = _n(nrm - d * (d @ nrm)); R = np.column_stack([np.cross(nrm, d), nrm, d])
        return s.m.cube(s.bone, s.P(base) + d * L / 2, (W, 0.25, L), R, tile, sprite=True, **kw)

def mirror_cube(c):
    F = np.diag([-1., 1., 1.]); d = dict(c); d["c"] = F @ c["c"]; d["R"] = F @ c["R"] @ F; d["mir"] = not c.get("mir", False); return d

# ================================================================== painéis de membrana (polígono plano recortado)
class Panels:
    def __init__(s): s.list = []
    def add(s, m, bone, pts, trailing, style, thick=0.35, dz=0.0):
        """pts: polígono 3D (pts[0] = raiz das veias, ex. pulso); trailing: arestas (i, j) com borda festonada"""
        P = [A(p) for p in pts]; n = np.zeros(3)
        for i in range(1, len(P) - 1): n += np.cross(P[i] - P[0], P[i + 1] - P[0])
        n = _n(n); cen = np.mean(P[1:], 0); z = _n((cen - P[0]) - n * ((cen - P[0]) @ n)); x = np.cross(n, z)
        R = np.column_stack([x, n, z]); L = [R.T @ (p - P[0]) for p in P]
        xs = [l[0] for l in L]; zs = [l[2] for l in L]; x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
        c = P[0] + R @ A((x0 + x1) / 2, dz, (z0 + z1) / 2)
        cube = m.cube(bone, c, (x1 - x0, thick, z1 - z0), R, "panel", panel=len(s.list))
        s.list.append(dict(loc=[(l[0], l[2]) for l in L], rect=(x0, x1, z0, z1), trailing=trailing, style=style))
        return cube

def scallop(a, b, inward, depth, waves=1, serr=0.0, n=28):
    out = []
    for k in range(n + 1):
        t = k / n; e = math.sin(math.pi * t) ** 0.85 * depth + serr * abs(math.sin(math.pi * t * waves * 3))
        out.append(a + (b - a) * t + inward * e)
    return out

# ================================================================== pintura procedural
def C(c): return tuple(int(max(0, min(255, v))) for v in c)
def lerp(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def to_img(rgb, alpha=None):
    a = np.full(rgb.shape[:2], 255, np.uint8) if alpha is None else alpha.astype(np.uint8)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), a]), "RGBA")
def grad(c0, c1, t):
    c0, c1 = np.array(c0, float), np.array(c1, float); return c0 + (c1 - c0) * np.clip(t, 0, 1)[..., None]
def noise(rng, amp, smooth=0):
    n = rng.normal(0, 1, (T, T))
    if smooth:
        im = Image.fromarray(((n - n.min()) / (np.ptp(n) + 1e-9) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(smooth))
        n = (np.array(im, float) / 255 - 0.5) * 3.5
    return n * amp

def p_scales(base, dark, light, rng, nx=8, ny=12, keel=False):
    """escamas imbricadas (fileiras de baixo sobrepõem as de cima) com volume, borda escura, brilho e variação por escama"""
    yy, xx = np.mgrid[0:T, 0:T] + 0.5; dx, dy = T / nx, T / ny
    best = np.full((T, T), -1e9); U = np.zeros((T, T)); Vv = np.zeros((T, T)); ID = np.zeros((T, T), int)
    rx, ry = dx * 0.62, dy * 1.55
    for ro in (-2, -1, 0, 1):
        r = np.floor(yy / dy) + ro; cy = r * dy; sh = (np.mod(r, 2)) * dx / 2
        for co in (-1, 0, 1):
            c = np.floor((xx - sh) / dx) + co; cx = c * dx + sh
            u = (xx - cx) / rx; v = (yy - cy) / ry
            ins = (u * u + v * v <= 1) & (v >= -0.15); upd = ins & (r > best)
            best = np.where(upd, r, best); U = np.where(upd, u, U); Vv = np.where(upd, v, Vv)
            ID = np.where(upd, (np.mod(r, ny) * nx + np.mod(c, nx)).astype(int), ID)
    var = np.random.RandomState(int(rng.integers(1 << 30))).uniform(0.86, 1.1, nx * ny + 1)[ID]
    rr = np.sqrt(U * U + Vv * Vv)
    col = grad(light, base, Vv ** 0.7) * var[..., None]
    if keel: col *= (1.06 - 0.12 * np.clip(np.abs(U) * 3, 0, 1))[..., None]
    rim = np.clip((rr - 0.78) / 0.2, 0, 1); col = col * (1 - 0.55 * rim[..., None]) + np.array(dark, float) * 0.55 * rim[..., None]
    spec = np.exp(-(((U + 0.25) / 0.22) ** 2 + ((Vv - 0.22) / 0.16) ** 2)); col += 70 * spec[..., None]
    col += noise(rng, 5)[..., None]
    col = np.where((best > -1e8)[..., None], col, np.array(dark, float))
    return to_img(col)

def p_plates(base, dark, light, rng, n=5):
    yy, xx = np.mgrid[0:T, 0:T] + 0.5; bh = T / n
    v = np.mod(yy + 3.0 * ((xx / T - 0.5) * 2) ** 2, bh) / bh
    col = grad(light, base, v ** 0.8)
    seam = np.clip((v - 0.86) / 0.14, 0, 1) + np.clip((0.06 - v) / 0.06, 0, 1) * 0.6
    col = col * (1 - 0.5 * seam[..., None]) + np.array(dark, float) * 0.5 * seam[..., None]
    mid = np.exp(-((xx - T / 2) / 5) ** 2) * 0.08; col *= (1 - mid)[..., None]
    col += noise(rng, 4)[..., None] + noise(rng, 6, 3)[..., None]
    return to_img(col)

def p_scute(base, dark, light, rng):
    """uma escama grande (placa em relevo): escudo com quilha central e bisel"""
    yy, xx = np.mgrid[0:T, 0:T] + 0.5; u = (xx - T / 2) / (T * 0.47); v = (yy - T * 0.06) / (T * 0.9)
    shape = (np.abs(u) <= (1 - np.clip(v - 0.45, 0, 1) ** 1.6 * 1.9)) & (v >= 0) & (v <= 1)
    col = grad(light, base, v * 0.8 + np.abs(u) * 0.3)
    col *= (1.08 - 0.22 * np.clip(np.abs(u) * 2.5, 0, 1) ** 0.7)[..., None]
    edge = shape & ~np.array(Image.fromarray((shape * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9)), bool)
    col = np.where(edge[..., None], np.array(dark, float), col)
    col += noise(rng, 5)[..., None]
    col = np.where(shape[..., None], col, np.array(dark, float))
    return to_img(col)

def p_streak(base, dark, light, rng, rings=0):
    yy, xx = np.mgrid[0:T, 0:T] + 0.5
    st = noise(rng, 1.0, 0)
    st = np.array(Image.fromarray(((st - st.min()) / (np.ptp(st) + 1e-9) * 255).astype(np.uint8)).resize((T, 8)).resize((T, T), Image.BILINEAR), float) / 255
    col = grad(dark, light, 0.35 + 0.65 * st * 0.6 + 0.4 * np.abs(np.sin(xx / T * math.pi)))
    col = col * 0.5 + np.array(base, float) * 0.5
    if rings:
        r = np.abs(np.sin(yy / T * math.pi * rings)); col *= (0.82 + 0.18 * r ** 0.4)[..., None]
    col += noise(rng, 4)[..., None]
    return to_img(col)

def p_eye(iris, glow, rng):
    yy, xx = np.mgrid[0:T, 0:T] + 0.5; u = (xx - T / 2) / (T / 2); v = (yy - T / 2) / (T / 2)
    r = np.sqrt(u * u * 0.8 + v * v)
    col = grad(glow, iris, np.clip(r / 0.85, 0, 1) ** 1.3)
    col = np.where((r > 0.86)[..., None], np.array((18, 14, 22), float), col)
    ring = np.exp(-((r - 0.83) / 0.05) ** 2); col = col * (1 - 0.5 * ring[..., None])
    pup = (np.abs(u) < 0.13 * np.sqrt(np.clip(1 - (v / 0.78) ** 2, 0, 1))); col = np.where(pup[..., None], np.array((10, 6, 12), float), col)
    hl = np.exp(-(((u + 0.32) / 0.12) ** 2 + ((v + 0.35) / 0.1) ** 2)); col += 200 * hl[..., None]
    for k in range(40):                                               # estrias da íris
        a = rng.uniform(0, 2 * math.pi); m = (np.abs(np.arctan2(v, u) - a) < 0.02) & (r > 0.2) & (r < 0.8); col[m] *= 0.85
    return to_img(col)

def p_mouth(base, dark, rng, ridges=7):
    yy, xx = np.mgrid[0:T, 0:T] + 0.5
    col = grad(base, dark, 0.5 + 0.5 * np.sin(yy / T * math.pi * ridges * 2) ** 2 * 0.6)
    col += noise(rng, 6, 2)[..., None]; return to_img(col)

def p_flat(base, light, rng, amp=5):
    yy, xx = np.mgrid[0:T, 0:T] + 0.5
    col = grad(base, light, 0.5 + 0.5 * np.sin(yy / T * math.pi * 2) * 0.5) + noise(rng, amp)[..., None]
    return to_img(col)

def p_metal(base, light, rng):
    yy, xx = np.mgrid[0:T, 0:T] + 0.5
    t = 0.5 + 0.5 * np.sin((xx + yy * 0.6) / T * math.pi * 3)
    col = grad(base, light, t ** 1.5) + noise(rng, 4)[..., None]; return to_img(col)

def p_hair(c0, c1, rng, kind="mane"):
    """sprites recortados (alpha): juba (mechas), nadadeira (leque com raios e borda festonada), lâmina da cauda, barba"""
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if kind in ("mane", "beard"):
        n = 15 if kind == "mane" else 10
        for k in range(n):
            x0 = T / 2 + (k / (n - 1) - 0.5) * T * 0.55; ang = (k / (n - 1) - 0.5) * (1.3 if kind == "mane" else 0.7) + rng.uniform(-0.12, 0.12)
            L = T * rng.uniform(0.7, 0.95); w = rng.uniform(5, 9); pts = []
            for j in range(13):
                t = j / 12; a = ang * (0.4 + t) + math.sin(t * 3 + k) * 0.18
                pts.append((x0 + math.sin(a) * L * t, T - 2 - math.cos(a) * L * t, w * (1 - t) ** 0.8 + 0.6))
            for j in range(12):
                (xa, ya, wa), (xb, yb, wb) = pts[j], pts[j + 1]; t = j / 11
                col = C(lerp(c0, c1, t) if k % 3 else lerp(lerp(c0, (255, 255, 255), 0.15), c1, t))
                d.line([(xa, ya), (xb, yb)], fill=col + (255,), width=max(1, int((wa + wb) / 2)))
    elif kind in ("fin", "dorsal"):
        rays = 7 if kind == "fin" else 6; poly = [(T / 2 - 4, T - 1)]; tips = []
        for k in range(rays):
            t = k / (rays - 1)
            if kind == "fin": a = -1.15 + 2.3 * t; L = T * (0.96 - 0.18 * abs(t - 0.5)); tip = (T / 2 + math.sin(a) * L * 0.55, T - 2 - math.cos(a) * L)
            else: tip = (6 + t * (T - 12), T * (0.06 + 0.2 * abs(math.sin(t * 9))))
            tips.append(tip)
        base = [(T / 2 + (k / (rays - 1) - 0.5) * (8 if kind == "fin" else T - 20), T - 1) for k in range(rays)]
        outline = [base[0]]
        for k in range(rays):
            outline.append(tips[k])
            if k < rays - 1:
                mx, my = (tips[k][0] + tips[k + 1][0]) / 2, (tips[k][1] + tips[k + 1][1]) / 2
                outline.append((mx + (T / 2 - mx) * 0.12, my + (T - my) * 0.22))
        outline.append(base[-1])
        d.polygon(outline, fill=C(lerp(c0, c1, 0.55)) + (255,))
        a = np.array(im); al = a[..., 3] > 0; yy = np.mgrid[0:T, 0:T][0]
        a[..., :3] = np.where(al[..., None], np.clip(grad(c0, c1, 1 - yy / T) + noise(rng, 5)[..., None], 0, 255), 0).astype(np.uint8)
        im = Image.fromarray(a, "RGBA"); d = ImageDraw.Draw(im)
        for k in range(rays): d.line([base[k], tips[k]], fill=C(lerp(c0, (20, 20, 30), 0.35)) + (255,), width=3)
        d.line(outline[1:-1], fill=C(lerp(c1, (255, 255, 255), 0.35)) + (255,), width=2)
    elif kind == "spade":
        pts = [(T / 2, 2), (T * 0.86, T * 0.42), (T * 0.66, T * 0.62), (T * 0.62, T - 2), (T * 0.38, T - 2), (T * 0.34, T * 0.62), (T * 0.14, T * 0.42)]
        d.polygon(pts, fill=C(c0) + (255,))
        a = np.array(im); al = a[..., 3] > 0; yy, xx = np.mgrid[0:T, 0:T]
        a[..., :3] = np.where(al[..., None], np.clip(grad(c1, c0, yy / T) * (1 - 0.25 * np.abs(xx - T / 2)[..., None] / T) + noise(rng, 5)[..., None], 0, 255), 0).astype(np.uint8)
        im = Image.fromarray(a, "RGBA"); d = ImageDraw.Draw(im)
        d.line([(T / 2, 6), (T / 2, T - 2)], fill=C(lerp(c0, (0, 0, 0), 0.4)) + (255,), width=3)
        for k in range(5): y = T * (0.3 + k * 0.12); d.line([(T / 2, y + 8), (T / 2 - 22 + k * 2, y - 6)], fill=C(lerp(c0, (0, 0, 0), 0.3)) + (255,), width=2); d.line([(T / 2, y + 8), (T / 2 + 22 - k * 2, y - 6)], fill=C(lerp(c0, (0, 0, 0), 0.3)) + (255,), width=2)
        d.line(pts + [pts[0]], fill=C(lerp(c1, (255, 255, 255), 0.4)) + (255,), width=2)
    return im

def paint_panel(sz, poly, root, trailing, M, rng):
    """membrana: polígono (px) com bordas festonadas; cor mais clara no meio, veias saindo da raiz, borda escura"""
    W, H = sz; pts = [A(p) for p in poly]; cen = np.mean(pts, 0); outline = []
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        if (i, (i + 1) % len(pts)) in trailing:
            e = b - a; nrm = A(-e[1], e[0]); nrm = _n(nrm if nrm @ (cen - (a + b) / 2) > 0 else -nrm)
            outline += scallop(a, b, nrm, np.linalg.norm(e) * 0.13, waves=1, serr=np.linalg.norm(e) * 0.012)[:-1]
        else: outline.append(a)
    mask = Image.new("L", (W, H), 0); ImageDraw.Draw(mask).polygon([tuple(p) for p in outline], fill=255)
    m = np.array(mask, float) / 255
    blur = np.array(mask.filter(ImageFilter.GaussianBlur(max(3, min(W, H) / 14))), float) / 255
    t = np.clip((blur - 0.45) * 2.2, 0, 1)
    col = grad(M["edge"], M["mid"], t)
    nz = rng.normal(0, 1, (H, W)); nz = np.array(Image.fromarray(((nz - nz.min()) / (np.ptp(nz) + 1e-9) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)), float) / 255
    col *= (0.92 + 0.16 * nz)[..., None]
    im = to_img(col, m * 255); d = ImageDraw.Draw(im)
    r = pts[root]; far = [p for k, p in enumerate(outline) if np.linalg.norm(p - r) > 0.55 * max(np.linalg.norm(q - r) for q in outline)]
    vc = C(M["vein"]) + (255,)
    for k in range(0, len(far), max(1, len(far) // 7)):
        tgt = far[k]; mid = (r + tgt) / 2 + rng.normal(0, 1, 2) * np.linalg.norm(tgt - r) * 0.06; seg = []
        for j in range(16):
            u = j / 15; seg.append(tuple((1 - u) ** 2 * r + 2 * (1 - u) * u * mid + u * u * tgt))
        for j in range(15): d.line([seg[j], seg[j + 1]], fill=vc, width=max(1, int(3.2 - j * 0.16)))
        for j in (5, 9):                                              # ramificações
            q = A(seg[j]); dirv = _n(A(seg[j + 1]) - q); side = A(-dirv[1], dirv[0]) * rng.choice([-1, 1])
            e = q + (dirv * 0.6 + side * 0.8) * np.linalg.norm(tgt - r) * 0.16; d.line([tuple(q), tuple(e)], fill=vc, width=1)
    for i in range(len(pts)):
        if (i, (i + 1) % len(pts)) not in trailing and root in (i, (i + 1) % len(pts)):
            d.line([tuple(pts[i]), tuple(pts[(i + 1) % len(pts)])], fill=C(M["bone"]) + (255,), width=5)
    d.line([tuple(p) for p in outline] + [tuple(outline[0])], fill=C(M["rim"]) + (255,), width=2)
    a = np.array(im); a[..., 3] = np.where(m > 0.5, 255, 0); a[..., :3] = np.where(m[..., None] > 0.5, a[..., :3], 0)
    return Image.fromarray(a.astype(np.uint8), "RGBA")

# ------------------------------------------------------------------ paletas
def pal(**k): return k
PALETTES = {
    "veldanava": pal(dorsal=((228, 232, 244), (120, 130, 168), (255, 255, 255)), flank=((240, 242, 250), (150, 158, 190), (255, 255, 255)),
                     belly=((246, 232, 196), (170, 136, 80), (255, 250, 228)), head=((236, 238, 248), (130, 140, 176), (255, 255, 255)),
                     horn=((150, 104, 34), (255, 238, 170)), spike=((176, 128, 40), (255, 236, 160)), claw=((120, 90, 40), (250, 236, 190)),
                     teeth=((210, 204, 186), (255, 252, 240)), eye=((20, 150, 160), (150, 255, 240)), mouth=((120, 34, 56), (60, 10, 24)),
                     tongue=((180, 70, 96), (230, 120, 140)), dark=((26, 22, 34), (60, 56, 70)), gold=((176, 128, 40), (255, 238, 170)),
                     wbone=((212, 206, 196), (250, 246, 236)), memb=dict(mid=(236, 248, 248), edge=(168, 206, 214), vein=(196, 168, 104), rim=(150, 112, 50), bone=(214, 200, 170)),
                     mane=((60, 200, 196), (190, 255, 246)), fin=((40, 170, 176), (170, 255, 240)), whisk=((200, 170, 90), (255, 240, 190))),
    "void_dragon": pal(dorsal=((44, 26, 70), (10, 6, 20), (96, 60, 140)), flank=((58, 34, 92), (14, 8, 28), (110, 70, 160)),
                       belly=((96, 56, 140), (30, 14, 50), (170, 120, 220)), head=((48, 28, 76), (10, 6, 20), (100, 64, 150)),
                       horn=((20, 12, 30), (190, 120, 255)), spike=((30, 16, 46), (200, 120, 255)), claw=((16, 10, 24), (170, 120, 230)),
                       teeth=((190, 180, 210), (250, 240, 255)), eye=((180, 20, 170), (255, 150, 250)), mouth=((70, 10, 70), (24, 4, 30)),
                       tongue=((120, 30, 110), (180, 70, 170)), dark=((6, 2, 10), (30, 18, 40)), gold=((90, 40, 150), (220, 160, 255)),
                       wbone=((40, 24, 60), (90, 60, 130)), memb=dict(mid=(96, 40, 150), edge=(36, 14, 60), vein=(190, 110, 255), rim=(20, 6, 34), bone=(50, 28, 74)),
                       mane=((120, 40, 200), (230, 160, 255)), fin=((110, 40, 190), (240, 170, 255)), whisk=((140, 80, 210), (230, 190, 255))),
    "dragon_carmim": pal(dorsal=((150, 26, 30), (54, 6, 10), (220, 70, 56)), flank=((178, 40, 36), (70, 10, 12), (236, 96, 70)),
                         belly=((236, 168, 92), (140, 70, 30), (255, 214, 150)), head=((160, 30, 32), (54, 6, 10), (226, 80, 60)),
                         horn=((46, 32, 26), (240, 222, 186)), spike=((40, 16, 14), (230, 120, 60)), claw=((30, 20, 16), (220, 200, 170)),
                         teeth=((214, 204, 180), (255, 250, 236)), eye=((220, 120, 10), (255, 236, 120)), mouth=((110, 20, 20), (50, 6, 8)),
                         tongue=((170, 50, 50), (220, 100, 90)), dark=((20, 6, 6), (60, 20, 16)), gold=((170, 100, 20), (255, 220, 120)),
                         wbone=((90, 20, 20), (160, 50, 40)), memb=dict(mid=(214, 82, 50), edge=(110, 20, 20), vein=(90, 10, 14), rim=(250, 160, 60), bone=(120, 30, 26)),
                         mane=((200, 80, 20), (255, 200, 90)), fin=((210, 90, 20), (255, 210, 100)), whisk=((200, 120, 40), (255, 220, 140))),
    "velzard": pal(dorsal=((206, 214, 246), (104, 112, 176), (250, 252, 255)), flank=((222, 232, 252), (130, 146, 200), (255, 255, 255)),
                   belly=((196, 232, 250), (90, 150, 196), (240, 252, 255)), head=((228, 232, 252), (120, 128, 190), (255, 255, 255)),
                   horn=((120, 170, 230), (236, 252, 255)), spike=((110, 160, 226), (220, 246, 255)), claw=((80, 120, 190), (230, 246, 255)),
                   teeth=((214, 224, 236), (255, 255, 255)), eye=((20, 110, 200), (170, 240, 255)), mouth=((90, 50, 110), (40, 16, 50)),
                   tongue=((150, 90, 160), (200, 140, 210)), dark=((20, 24, 48), (50, 60, 90)), gold=((150, 190, 240), (240, 252, 255)),
                   wbone=((180, 200, 240), (240, 248, 255)), memb=dict(mid=(220, 236, 255), edge=(140, 170, 220), vein=(120, 150, 210), rim=(90, 110, 180), bone=(170, 190, 230)),
                   mane=((236, 236, 255), (176, 200, 255)), fin=((150, 210, 255), (236, 250, 255)), whisk=((200, 220, 255), (255, 255, 255))),
    "velgrynd": pal(dorsal=((196, 36, 40), (80, 8, 18), (250, 96, 70)), flank=((218, 62, 48), (100, 16, 20), (255, 130, 90)),
                    belly=((250, 222, 164), (170, 120, 60), (255, 246, 214)), head=((206, 44, 42), (80, 8, 18), (255, 110, 80)),
                    horn=((170, 112, 30), (255, 236, 150)), spike=((180, 110, 30), (255, 226, 140)), claw=((150, 100, 30), (255, 236, 170)),
                    teeth=((230, 222, 200), (255, 252, 240)), eye=((220, 120, 0), (255, 244, 140)), mouth=((110, 16, 24), (50, 4, 10)),
                    tongue=((180, 50, 60), (230, 100, 100)), dark=((26, 6, 8), (70, 20, 20)), gold=((180, 120, 30), (255, 236, 150)),
                    wbone=((160, 30, 30), (230, 80, 60)), memb=dict(mid=(240, 120, 70), edge=(150, 30, 30), vein=(120, 20, 20), rim=(250, 200, 100), bone=(170, 40, 34)),
                    mane=((250, 214, 140), (255, 120, 60)), fin=((240, 120, 50), (255, 222, 140)), whisk=((240, 200, 120), (255, 244, 200))),
    "dragon_gelo": pal(dorsal=((70, 140, 204), (16, 46, 100), (150, 210, 250)), flank=((110, 184, 236), (30, 80, 140), (190, 236, 255)),
                       belly=((222, 244, 255), (110, 170, 214), (255, 255, 255)), head=((84, 154, 214), (16, 46, 100), (160, 220, 255)),
                       horn=((150, 200, 240), (250, 255, 255)), spike=((170, 220, 250), (250, 255, 255)), claw=((60, 100, 160), (220, 240, 255)),
                       teeth=((220, 232, 240), (255, 255, 255)), eye=((0, 160, 220), (190, 255, 255)), mouth=((40, 40, 90), (14, 14, 40)),
                       tongue=((110, 90, 150), (160, 140, 200)), dark=((8, 20, 40), (30, 50, 80)), gold=((150, 200, 240), (250, 255, 255)),
                       wbone=((80, 150, 210), (170, 220, 250)), memb=dict(mid=(170, 220, 250), edge=(60, 120, 180), vein=(40, 90, 150), rim=(20, 60, 110), bone=(70, 140, 200)),
                       mane=((240, 250, 255), (150, 210, 255)), fin=((120, 200, 250), (240, 252, 255)), whisk=((200, 236, 255), (255, 255, 255))),
    "dragon_tempestade": pal(dorsal=((38, 58, 112), (8, 10, 30), (80, 120, 190)), flank=((56, 120, 180), (14, 30, 70), (110, 190, 240)),
                             belly=((160, 226, 255), (60, 120, 170), (230, 250, 255)), head=((40, 64, 120), (8, 10, 30), (90, 130, 200)),
                             horn=((170, 140, 30), (255, 246, 160)), spike=((200, 170, 40), (255, 248, 170)), claw=((40, 40, 60), (220, 220, 240)),
                             teeth=((220, 226, 236), (255, 255, 255)), eye=((230, 200, 20), (255, 255, 200)), mouth=((40, 30, 80), (14, 10, 30)),
                             tongue=((120, 80, 140), (170, 120, 190)), dark=((6, 8, 20), (30, 36, 60)), gold=((200, 170, 40), (255, 248, 170)),
                             wbone=((40, 60, 110), (90, 130, 190)), memb=dict(mid=(80, 150, 210), edge=(20, 40, 90), vein=(240, 230, 120), rim=(10, 20, 50), bone=(40, 60, 110)),
                             mane=((160, 228, 255), (255, 248, 160)), fin=((90, 180, 240), (255, 250, 170)), whisk=((255, 240, 140), (255, 255, 220))),
    "sea_dragon": pal(dorsal=((50, 108, 128), (14, 44, 60), (100, 170, 180)), flank=((80, 152, 168), (26, 76, 94), (140, 210, 214)),
                      belly=((180, 214, 202), (90, 140, 136), (230, 246, 236)), head=((56, 118, 136), (14, 44, 60), (110, 180, 190)),
                      horn=((150, 168, 160), (236, 246, 236)), spike=((20, 50, 64), (110, 200, 200)), claw=((20, 34, 44), (180, 200, 200)),
                      teeth=((228, 232, 220), (255, 255, 250)), eye=((40, 160, 60), (200, 255, 150)), mouth=((80, 20, 34), (34, 6, 14)),
                      tongue=((150, 60, 80), (200, 110, 120)), dark=((6, 18, 24), (24, 44, 52)), gold=((90, 190, 190), (200, 255, 240)),
                      wbone=((30, 70, 86), (70, 130, 146)), memb=dict(mid=(110, 200, 206), edge=(36, 100, 120), vein=(30, 80, 100), rim=(16, 50, 66), bone=(40, 90, 106)),
                      mane=((50, 120, 130), (150, 230, 226)), fin=((60, 160, 176), (180, 250, 240)), whisk=((120, 200, 200), (220, 255, 250))),
}
SETS = {"skin": ("dorsal", "flank", "belly"), "head": ("headtop", "headside", "belly"), "limb": ("flank", "flank", "flank"), "plate": ("dorsal", "dorsal", "belly")}

class Atlas:
    """1024x1024: 32 ladrilhos de 128 (4 linhas) + regiões das membranas (prateleiras na metade de baixo)"""
    TILES = ["dorsal", "flank", "belly", "headtop", "headside", "scute", "horn0", "horn1", "horn2", "horn3", "spike0", "spike1", "claw", "teeth", "eye",
             "mouth", "tongue", "dark", "gold", "wbone", "memb", "mane", "fin", "dorsalfin", "spade", "beard", "whisk", "scute2"]
    def __init__(s, P, seed=7):
        s.P = P; s.im = Image.new("RGBA", (TW, TW), (0, 0, 0, 0)); s.uv = {}; rng = np.random.default_rng(seed); s.rng = rng
        for k, name in enumerate(s.TILES):
            u, v = (k % 8) * T, (k // 8) * T; s.uv[name] = (u, v); s.im.paste(s.paint(name, rng), (u, v))
        s.alpha = {"mane", "fin", "dorsalfin", "spade", "beard"}
        s.shelf = [0, TILE_ROWS * T, 0]                      # x, y, altura da prateleira
    def paint(s, name, rng):
        P = s.P; d, f, b, h = P["dorsal"], P["flank"], P["belly"], P["head"]
        if name == "dorsal": return p_scales(d[0], d[1], d[2], rng, 7, 10, keel=True)
        if name == "flank": return p_scales(f[0], f[1], f[2], rng, 9, 14)
        if name == "belly": return p_plates(b[0], b[1], b[2], rng)
        if name == "headtop": return p_scales(h[0], h[1], h[2], rng, 11, 16)
        if name == "headside": return p_scales(lerp(h[0], f[0], 0.5), h[1], h[2], rng, 13, 18)
        if name == "scute": return p_scute(d[0], d[1], d[2], rng)
        if name == "scute2": return p_scute(f[0], f[1], f[2], rng)
        if name.startswith("horn"):
            k = int(name[-1]) / 3; c0, c1 = P["horn"]; base = lerp(c0, c1, k * 0.85)
            return p_streak(base, lerp(base, (0, 0, 0), 0.35), lerp(base, (255, 255, 255), 0.35), rng, rings=5)
        if name.startswith("spike"):
            k = int(name[-1]); c0, c1 = P["spike"]; base = lerp(c0, c1, 0.25 + 0.6 * k)
            return p_streak(base, lerp(base, (0, 0, 0), 0.3), lerp(base, (255, 255, 255), 0.3), rng)
        if name == "claw": return p_streak(lerp(*P["claw"], 0.4), P["claw"][0], P["claw"][1], rng)
        if name == "teeth": return p_streak(lerp(*P["teeth"], 0.6), P["teeth"][0], P["teeth"][1], rng)
        if name == "eye": return p_eye(P["eye"][0], P["eye"][1], rng)
        if name == "mouth": return p_mouth(P["mouth"][0], P["mouth"][1], rng)
        if name == "tongue": return p_mouth(P["tongue"][1], P["tongue"][0], rng, 3)
        if name == "dark": return p_flat(P["dark"][0], P["dark"][1], rng)
        if name == "gold": return p_metal(P["gold"][0], P["gold"][1], rng)
        if name == "wbone": return p_streak(lerp(*P["wbone"], 0.5), P["wbone"][0], P["wbone"][1], rng, rings=3)
        if name == "memb": return p_flat(P["memb"]["edge"], P["memb"]["mid"], rng, 6)
        if name == "whisk": return p_streak(lerp(*P["whisk"], 0.5), P["whisk"][0], P["whisk"][1], rng)
        if name == "mane": return p_hair(P["mane"][0], P["mane"][1], rng, "mane")
        if name == "beard": return p_hair(P["mane"][1], P["mane"][0], rng, "beard")
        if name == "fin": return p_hair(P["fin"][0], P["fin"][1], rng, "fin")
        if name == "dorsalfin": return p_hair(P["fin"][0], P["fin"][1], rng, "dorsal")
        if name == "spade": return p_hair(P["fin"][0], P["fin"][1], rng, "spade")
        raise KeyError(name)
    def alloc(s, w, h):
        x, y, sh = s.shelf
        if x + w > TW: x, y, sh = 0, y + sh, 0
        if y + h > TW: raise RuntimeError("atlas cheio")
        s.shelf = [x + w + 2, y, max(sh, h + 2)]; return x, y

# ------------------------------------------------------------------ UV por face
FACES = {"north": ((0, 0, -1), (0, 1)), "south": ((0, 0, 1), (0, 1)), "east": ((1, 0, 0), (2, 1)), "west": ((-1, 0, 0), (2, 1)), "up": ((0, 1, 0), (0, 2)), "down": ((0, -1, 0), (0, 2))}
def face_uvs(c, atlas, panels_uv, rnd, D):
    out = {}; flip = c.get("mir", False)
    if c["mat"] == "panel":
        u, v, w, h = panels_uv[c["panel"]]
        out = {"up": {"uv": [u, v], "uv_size": [w, h]}, "down": {"uv": [u, v + h], "uv_size": [w, -h]}}
    elif c.get("sprite"):
        u, v = atlas.uv[c["mat"]]
        out = {"up": {"uv": [u, v], "uv_size": [T, T]}, "down": {"uv": [u, v + T], "uv_size": [T, -T]}}
    else:
        for f, (n, (ia, ib)) in FACES.items():
            if f in c.get("hide", ()): continue
            mat = c["mat"]
            if mat in SETS:
                ny = (c["R"] @ A(n))[1]; tri = SETS[mat]; mat = tri[0] if ny > 0.5 else tri[2] if ny < -0.55 else tri[1]
                if mat in ("headtop", "headside") and c.get("hmat"): mat = c["hmat"]
            u0, v0 = atlas.uv[mat]
            if f in c.get("full", ()) or (mat in ("scute", "scute2") and f == "up"): out[f] = {"uv": [u0 + 1, v0 + 1], "uv_size": [T - 2, T - 2]}; continue
            w, h = c["s"][ia], c["s"][ib]
            uw, vh = max(2, min(T - 2, round(w * D))), max(2, min(T - 2, round(h * D)))
            out[f] = {"uv": [u0 + 1 + rnd.randint(0, T - 2 - uw), v0 + 1 + rnd.randint(0, T - 2 - vh)], "uv_size": [uw, vh]}
    if flip:
        for f in out.values(): f["uv"][0] += f["uv_size"][0]; f["uv_size"][0] = -f["uv_size"][0]
    return out

def r3(v): return [round(float(x), 3) for x in v]
def geo_json(m, ident, atlas, panels_uv, D, seed=3):
    rnd = random.Random(seed); bones = []; P = []
    for n in m.order:
        b = m.B[n]; bb = {"name": n, "pivot": r3(b["pivot"])}
        if b["parent"]: bb["parent"] = b["parent"]
        cs = []
        for c in b["cubes"]:
            s = np.maximum(c["s"], 0.05); o = c["c"] - s / 2; e = euler(c["R"])
            cc = {"origin": r3(o), "size": r3(s)}
            if any(abs(x) > 1e-3 for x in e): cc["pivot"] = r3(c["c"]); cc["rotation"] = e
            cc["uv"] = face_uvs(c, atlas, panels_uv, rnd, D); cs.append(cc)
            h = np.abs(c["R"]) @ (s / 2); P += [c["c"] - h, c["c"] + h]
        if cs: bb["cubes"] = cs
        bones.append(bb)
    P = np.array(P); mn, mx = P.min(0), P.max(0)
    bw = math.ceil(max(mx[0] - mn[0], mx[2] - mn[2]) / 16 * 1.1) + 4; bh = math.ceil((mx[1] - mn[1]) / 16 * 1.1) + 4
    desc = {"identifier": ident, "texture_width": TW, "texture_height": TW, "visible_bounds_width": bw, "visible_bounds_height": bh, "visible_bounds_offset": [0, round(bh / 2, 1), 0]}
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": desc, "bones": bones}]}, (mn, mx)

def bake(m, panels, names, D, seed=11):
    """pinta um atlas por paleta (mesmo layout de UV) e devolve (texturas, panels_uv)"""
    out = {}; puv = None
    for nm in names:
        at = Atlas(PALETTES[nm], seed=seed); rng = np.random.default_rng(seed + 5); uvs = []
        for k, p in enumerate(panels.list):
            x0, x1, z0, z1 = p["rect"]; sx, sz = x1 - x0, z1 - z0; L = max(sx, sz)
            kpx = min(240, max(80, L * 2.0)) / L; w, h = max(16, round(sx * kpx)), max(16, round(sz * kpx))
            u, v = at.alloc(w, h)
            poly = [((x1 - x) / sx * w, (z1 - z) / sz * h) for x, z in p["loc"]]
            st = dict(PALETTES[nm]["memb"]); st.update(p["style"] or {})
            at.im.paste(paint_panel((w, h), poly, 0, set(p["trailing"]), st, rng), (u, v)); uvs.append((u, v, w, h))
        out[nm] = at
        if puv is None: puv = uvs
    return out, puv

# 6.52 - ESPADAS EM 3D DE VERDADE (HD), reconstruídas a partir da imagem original do mod.
# As espadas que no mod são uma imagem 16x16/32x32 extrudada pixel a pixel (aparência "pixelada") viram um modelo 3D:
#   - a imagem original é MEDIDA: eixo cabo->ponta, perfil de largura da lâmina a cada ponto (inclusive curvatura das katanas),
#     posição e largura da guarda, comprimento do cabo e do pomo, e as cores reais de cada parte (lâmina, fio, guarda, cabo, pomo);
#   - geometria: lâmina em segmentos com espinha grossa e fio fino (bisel), afinando até a ponta; guarda com volume; cabo com
#     anéis de empunhadura; pomo com remate. Tudo no mesmo referencial do modelo antigo (posição na mão calibrada em 6.42 continua valendo);
#   - textura HD 128x128 pintada com as cores medidas: degradê metálico, sulco (fuller), brilho do fio, empunhadura trançada, metal da guarda.
# Ícone do inventário continua a imagem original do mod. Armas com modelo 3D próprio no mod e armas que não são espadas não são tocadas.
# A arma original (antes da reconstrução) é guardada em tools/sword_src/<id>.json (geometria) para poder voltar.
import json, os, re, math, colorsys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SRC = os.path.join(os.path.dirname(__file__), "sword_src")
SWORDY = re.compile(r"sword|katana|blade|rapier|dagger|kodachi|edge|kunai|wild_card|dyrnwyn|kusanagi|ember_fang|claymore|dreadsword|fang")
NOT = re.compile(r"axe|scythe|halberd|club|bow|spear|gandiva|dead_end_rainbow|ice_blade|shizue_sword")
TW = 128
TILT_SIGN = -1

def hx(c): return tuple(int(v) for v in c[:3]) + (255,)
def sh(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
def sat(c): return colorsys.rgb_to_hsv(*(v / 255 for v in c[:3]))[1]
def median(cols, key=lum):
    cols = sorted(cols, key=key); return cols[len(cols) // 2] if cols else (128, 128, 128, 255)

# ------------------------------------------------------------------ análise da imagem
def analyze(im, gfrac):
    w, h = im.size; px = im.load()
    op = [(c, r) for r in range(h) for c in range(w) if px[c, r][3] > 20]
    pc, pr = min(op, key=lambda q: q[0] + (h - 1 - q[1])); tc, tr = max(op, key=lambda q: q[0] + (h - 1 - q[1]))
    ax, ay = tc - pc, -(tr - pr); L = math.hypot(ax, ay); ux, uy = ax / L, ay / L; nx, ny = -uy, ux
    pts = []
    for c, r in op:
        dx, dy = c - pc, -(r - pr)
        pts.append((dx * ux + dy * uy, dx * nx + dy * ny, px[c, r]))
    nb = int(L) + 2; bins = [[] for _ in range(nb)]
    for s, d, col in pts: bins[max(0, min(nb - 1, int(round(s))))].append((d, col))
    prof = []
    for b in bins:
        if not b: prof.append(None); continue
        ds = [d for d, _ in b]; prof.append({"lo": min(ds), "hi": max(ds), "w": max(ds) - min(ds) + 1, "c": (min(ds) + max(ds)) / 2, "cols": [c for _, c in b]})
    # guarda: bin mais largo entre 8% e 45% do comprimento (cor diferente da lâmina)
    lo_i, hi_i = max(1, int(L * 0.06)), max(2, int(L * 0.45))
    cand = [(prof[i]["w"], i) for i in range(lo_i, hi_i + 1) if i < len(prof) and prof[i]]
    gw, gi = max(cand) if cand else (2, int(L * 0.25))
    blade_bins = [p for p in prof[gi + 1:] if p]
    blade_w = [p["w"] for p in blade_bins] or [1]
    # se não há guarda marcada (lâmina tão larga quanto a guarda), usa a fração de empunhadura do mod
    if gw <= max(blade_w) + 0.5: gi = max(1, int(round(L * gfrac * 1.7))); gw = max(blade_w) + 1.2
    grip_bins = [p for p in prof[1:gi] if p]; pommel_bins = [p for p in prof[:2] if p]
    blade_cols = [c for p in blade_bins for c in p["cols"]]
    center = [c for p in blade_bins for (d, c) in zip([0] * len(p["cols"]), p["cols"])]
    edge_cols = []
    for p in blade_bins:
        edge_cols += [c for c in p["cols"] if lum(c) >= lum(median(p["cols"]))]
    bm = median(blade_cols); be = median(edge_cols) if edge_cols else sh(bm, 1.25)
    if lum(be) < lum(bm) + 12: be = mix(bm, (255, 255, 255, 255), 0.35)
    gcols = [c for p in prof[max(0, gi - 1):gi + 2] if p for c in p["cols"]]
    grip = median([c for p in grip_bins for c in p["cols"]]) if grip_bins else sh(bm, 0.5)
    pom = median([c for p in pommel_bins for c in p["cols"]]) if pommel_bins else grip
    guard = median(gcols, key=lambda c: sat(c) * 255 + lum(c) * 0.2) if gcols else sh(bm, 0.8)
    accent = max(blade_cols + gcols, key=lambda c: sat(c) * (lum(c) > 40)) if (blade_cols + gcols) else guard
    # perfil limpo da lâmina: centro por ajuste quadrático (mantém a curva das katanas), largura suavizada e afinando na ponta
    bi = [i for i in range(gi + 1, len(prof)) if prof[i]]
    if len(bi) >= 3:
        n = len(bi); xs = [float(i) for i in bi]; ys = [prof[i]["c"] for i in bi]
        mx = sum(xs) / n
        def fit(deg):
            # mínimos quadrados simples (grau 1 ou 2)
            import itertools
            X = [[(x - mx) ** p for p in range(deg + 1)] for x in xs]
            M = [[sum(X[r][a] * X[r][b] for r in range(n)) for b in range(deg + 1)] for a in range(deg + 1)]
            V = [sum(X[r][a] * ys[r] for r in range(n)) for a in range(deg + 1)]
            for c in range(deg + 1):                      # eliminação de Gauss
                piv = max(range(c, deg + 1), key=lambda r: abs(M[r][c])); M[c], M[piv] = M[piv], M[c]; V[c], V[piv] = V[piv], V[c]
                if abs(M[c][c]) < 1e-9: return None
                for r in range(deg + 1):
                    if r != c:
                        f_ = M[r][c] / M[c][c]; M[r] = [M[r][k] - f_ * M[c][k] for k in range(deg + 1)]; V[r] -= f_ * V[c]
            return [V[c] / M[c][c] for c in range(deg + 1)]
        co = fit(2 if n >= 6 else 1) or [sum(ys) / n]
        ws = [prof[i]["w"] for i in bi]
        ys_bak = ys; ys = ws; cw = fit(2 if n >= 6 else 1) or [sum(ws) / n]; ys = ys_bak    # largura: curva suave (sem serrilhado)
        sm = [max(0.8, sum(cw[p] * (i - mx) ** p for p in range(len(cw)))) for i in bi]
        base_w = sorted(sm)[int(n * 0.6)] if n else 1
        for j, i in enumerate(bi):
            prof[i]["c"] = sum(co[p] * (i - mx) ** p for p in range(len(co)))
            t = j / max(1, n - 1)
            w_ = min(sm[j], base_w * 1.08)
            if t > 0.72: w_ = w_ * (1 - (t - 0.72) / 0.28 * 0.6)
            prof[i]["w"] = max(0.7, w_ * 0.72)          # sem o contorno escuro do sprite (que entra na medida)
    along = []
    for i in bi:
        cols = prof[i]["cols"]; along.append((median(cols), max(cols, key=lum)))
    return {"L": L, "axis": (ux, uy), "handle": (pc, pr), "gi": gi, "gw": gw, "prof": prof, "along": along, "blade": bm, "edge": be,
            "guard": guard, "grip": grip, "pommel": pom, "accent": accent, "size": (w, h)}

# ------------------------------------------------------------------ textura HD (atlas 128x128)
class Atlas:
    def __init__(s): s.im = Image.new("RGBA", (TW, TW), (0, 0, 0, 0)); s.px = s.im.load(); s.slots = {}; s.x = 0; s.y = 0; s.rowh = 0
    def add(s, name, w, h, painter):
        if s.x + w > TW: s.x = 0; s.y += s.rowh; s.rowh = 0
        x, y = s.x, s.y; painter(s.px, x, y, w, h); s.slots[name] = (x, y, w, h); s.x += w; s.rowh = max(s.rowh, h); return s.slots[name]
def p_blade(base, edge, fuller=True, along=None):
    """face da lâmina: u = comprimento, v = largura (fio - espinha - fio); sulco central escuro, brilho no fio, reflexo diagonal.
    along = [(cor_base, cor_fio)] ao longo do comprimento (cores medidas na imagem original: preserva degradês e lâminas multicoloridas)"""
    def f(px, x, y, w, h):
        for j in range(h):
            v = j / (h - 1); dist = abs(v - 0.5) * 2            # 0 espinha, 1 fio
            for i in range(w):
                u = i / (w - 1)
                if along:
                    t = u * (len(along) - 1); a = int(t); b = min(len(along) - 1, a + 1); fr = t - a
                    base = mix(along[a][0], along[b][0], fr); edge = mix(along[a][1], along[b][1], fr)
                c = mix(sh(base, 0.82), sh(base, 1.12), 1 - abs(dist - 0.45))
                if fuller and dist < 0.18 and u < 0.82: c = sh(base, 0.68 + 0.2 * dist)         # sulco
                if dist > 0.78: c = mix(c, edge, (dist - 0.78) / 0.22)                           # fio
                if abs(v - 0.32) < 0.05 or abs(v - 0.68) < 0.05: c = mix(c, (255, 255, 255, 255), 0.18)   # brilho longitudinal (aresta do bisel)
                if dist > 0.96: c = sh(edge, 1.08)
                px[x + i, y + j] = c
    return f
def p_edge(edge):
    def f(px, x, y, w, h):
        for j in range(h):
            for i in range(w): px[x + i, y + j] = sh(edge, 1.15 - 0.15 * abs(j / (h - 1) - 0.5) * 2)
    return f
def p_metal(base, trim):
    def f(px, x, y, w, h):
        for j in range(h):
            for i in range(w):
                t = j / (h - 1); c = sh(base, 1.2 - 0.45 * t)
                if abs(i - j * 0.7 - 2) < 1.0: c = sh(base, 1.45)
                if i < 1 or j < 1 or i >= w - 1 or j >= h - 1: c = sh(trim, 0.85)
                px[x + i, y + j] = c
    return f
def p_grip(base):
    def f(px, x, y, w, h):
        for j in range(h):
            for i in range(w):
                band = ((i + j) // 3) % 2; c = sh(base, 1.05 if band else 0.72)
                if (i + j) % 3 == 0: c = sh(base, 0.55)
                px[x + i, y + j] = c
    return f
def faces(t, size, axis_len="z"):
    """mapeia a tile inteira em cada face (o detalhe vem da resolução 128)"""
    x, y, w, h = t; f = {"uv": [x, y], "uv_size": [w, h]}
    return {k: f for k in ("north", "south", "east", "west", "up", "down")}
def faces_blade(tb, te, seg, nseg):
    x, y, w, h = tb; sw = w / nseg
    side = {"uv": [x + sw * seg, y], "uv_size": [sw, h]}
    ex, ey, ew, eh = te; edg = {"uv": [ex + ew * seg / nseg, ey], "uv_size": [ew / nseg, eh]}
    return {"west": side, "east": {"uv": [x + sw * (seg + 1), y], "uv_size": [-sw, h]}, "up": edg, "down": edg, "north": edg, "south": edg}

# ------------------------------------------------------------------ geometria
def build(A, S, gs, gd, at):
    w, h = A["size"]; k = 16.0 / w * S
    tb = at.add("blade", 64, 16, p_blade(A["blade"], A["edge"], along=A.get("along")))
    te = at.add("edge", 32, 4, p_edge(A["edge"]))
    tg = at.add("guard", 16, 16, p_metal(A["guard"], mix(A["guard"], A["accent"], 0.5)))
    tp = at.add("pommel", 16, 16, p_metal(A["pommel"], A["guard"]))
    tr = at.add("grip", 16, 16, p_grip(A["grip"]))
    cubes = []
    def box(s0, s1, d_center, width, thick, uv, inflate=None, tilt=0.0):
        """caixa ao longo do eixo da arma: s (px) de s0 a s1, centro lateral d (px), largura (px), espessura (unidades)"""
        z0, z1 = (s0 - gs) * k, (s1 - gs) * k
        c = {"origin": [round(-thick / 2, 4), round((d_center - gd - width / 2) * k, 4), round(z0, 4)], "size": [round(thick, 4), round(width * k, 4), round(z1 - z0, 4)], "uv": uv}
        if inflate: c["inflate"] = inflate
        if abs(tilt) > 0.3:      # segue a tangente da curva (lâmina curva sem degraus)
            c["rotation"] = [round(tilt, 2), 0, 0]; c["pivot"] = [0, round((d_center - gd) * k, 4), round((z0 + z1) / 2, 4)]
        cubes.append(c)
    prof = A["prof"]; gi = A["gi"]; gw = A["gw"]
    cen = lambda i: (prof[i]["c"] if 0 <= i < len(prof) and prof[i] else 0.0)
    # lâmina em segmentos: espinha (grossa, 55% da largura) + plano até o fio (fino); afina até a ponta
    bins = [(i, prof[i]) for i in range(gi + 1, len(prof)) if prof[i]]
    if not bins: return cubes
    n = len(bins); nseg = min(10, max(4, n))
    for j in range(nseg):
        a = bins[int(j * n / nseg)][0]; b = bins[min(n - 1, int((j + 1) * n / nseg))][0] if j < nseg - 1 else bins[-1][0] + 1
        seg_bins = [prof[i] for i in range(a, max(a + 1, b)) if prof[i]]
        wid = max(0.9, sum(p["w"] for p in seg_bins) / len(seg_bins)); cc = sum(p["c"] for p in seg_bins) / len(seg_bins)
        if j == nseg - 1: wid = max(0.5, wid * 0.55)                                   # ponta
        tip = j >= nseg - 2
        ca, cb = cen(a), cen(min(len(prof) - 1, max(a + 1, b)))
        tilt = TILT_SIGN * math.degrees(math.atan2(cb - ca, max(1.0, b - a)))
        box(a - 0.55, b - 0.45, cc, wid, 0.22 * k * (0.7 if tip else 1.0), faces_blade(tb, te, j, nseg), tilt=tilt)          # plano até o fio
        box(a - 0.55, b - 0.45 - (0.6 if j == nseg - 1 else 0), cc, wid * 0.5, 0.5 * k * (0.75 if tip else 1.0), faces_blade(tb, te, j, nseg), tilt=tilt)   # espinha
    return cubes

def main():
    os.makedirs(SRC, exist_ok=True)
    W = json.load(open(os.path.join(os.path.dirname(__file__), "mod_weapons.json")))
    done = []
    for sid in sorted(W):
        if not SWORDY.search(sid) or NOT.search(sid): continue
        gp = os.path.join(RP, f"models/entity/etheria_w_{sid}.geo.json"); tp = os.path.join(RP, f"textures/attachable/w_{sid}.png")
        if not (os.path.exists(gp) and os.path.exists(tp)): continue
        src_g = os.path.join(SRC, f"{sid}.geo.json"); src_t = os.path.join(SRC, f"{sid}.png")
        if not os.path.exists(src_g):
            G = json.load(open(gp)); bones = G["minecraft:geometry"][0]["bones"]; model = next(b for b in bones if b["name"] == "eth_model")
            xs = {round(c["size"][0], 3) for c in model.get("cubes", [])}
            if len(xs) != 1 or len(model.get("cubes", [])) < 4: continue          # não é imagem extrudada (modelo 3D do mod): não mexe
            json.dump(G, open(src_g, "w")); Image.open(tp).save(src_t)
        G = json.load(open(src_g)); im = Image.open(src_t).convert("RGBA")
        D = G["minecraft:geometry"][0]; bones = D["bones"]; model = next(b for b in bones if b["name"] == "eth_model")
        S = model["cubes"][0]["size"][0]                                              # espessura = escala de mão (mod_weapons.extrude)
        hand = model["pivot"]
        # ponto de empunhadura EXATO do modelo antigo (origem local = mão): cada cubo é uma sequência de pixels (uv west = [coluna, linha])
        A = analyze(im, 0.14); k = 16.0 / im.width * S
        c0 = model["cubes"][0]; col, row = c0["uv"]["west"]["uv"]
        gc = col - (c0["origin"][2] - hand[2]) / k; gr = row + (c0["origin"][1] - hand[1]) / k
        pc, pr = A["handle"]; ux, uy = A["axis"]; dx, dy = gc - pc, -(gr - pr)
        gs, gd = dx * ux + dy * uy, dx * (-uy) + dy * ux
        at = Atlas(); cubes = build(A, S, gs, gd, at)
        # empunhadura FIEL: os pixels da imagem original até logo depois da guarda (guarda, cabo, pomo e ornamentos)
        # viram cubos com volume (1,8x a espessura antiga), mapeados na própria imagem colada no atlas
        ox, oy = TW - im.width, TW - im.height; at.im.paste(im, (ox, oy))
        cut = A["gi"] + 1.2; ux_, uy_ = A["axis"]; pc_, pr_ = A["handle"]
        for c in model["cubes"]:
            c0, r = c["uv"]["west"]["uv"]; n = int(round(c["size"][2] / k))
            for i in range(n):
                col = c0 + i; dx, dy = col - pc_, -(r - pr_); sp = dx * ux_ + dy * uy_
                if sp > cut: continue
                th = S * 1.8; u, v = ox + col, oy + r; f1 = {"uv": [u, v], "uv_size": [1, 1]}
                cubes.append({"origin": [round(c["origin"][0] - hand[0] - (th - S) / 2, 4), round(c["origin"][1] - hand[1], 4), round(c["origin"][2] - hand[2] + i * k, 4)],
                              "size": [round(th, 4), round(k, 4), round(k, 4)], "uv": {kk: f1 for kk in ("north", "south", "east", "west", "up", "down")}, "_old": True})
        for c in cubes:
            c["origin"] = [round(c["origin"][i] + hand[i], 4) for i in range(3)]
            if "pivot" in c: c["pivot"] = [round(c["pivot"][i] + hand[i], 4) for i in range(3)]
        # orienta o eixo da arma (que construí ao longo de +Z) na diagonal da imagem: rotação em X
        ang = math.degrees(math.atan2(uy, ux))
        hilt = [c for c in cubes if c.pop("_old", False)]; blade = [c for c in cubes if c not in hilt]
        hd = {"name": "eth_hd", "parent": "eth_model", "pivot": list(hand), "rotation": [round(ang, 3), 0, 0], "cubes": blade}
        model2 = {k2: v for k2, v in model.items() if k2 != "cubes"}; model2["cubes"] = hilt
        D2 = json.loads(json.dumps(D)); D2["bones"] = [b if b["name"] != "eth_model" else model2 for b in D2["bones"]] + [hd]
        D2["description"].update({"texture_width": TW, "texture_height": TW})
        json.dump({"format_version": "1.16.0", "minecraft:geometry": [D2]}, open(gp, "w"))
        at.im.save(tp)
        done.append(sid)
    print(len(done), "espadas reconstruídas:", " ".join(done))
if __name__ == "__main__": main()

# 9.0 - CENA DO GRANDE SÁBIO (aquisição de habilidade / evolução) MAIS VIVA, como no mod "Great Sage" de Tensura.
# Mantém tudo o que já existe na cena (raios finos, icosaedro, estrela, anéis) e SOMA camadas, só com o que o jogo já usa neste arquivo:
# imagens + animações alpha/size/offset em laço (wait -> a -> b -> a). Sem bindings novos, sem eventos, sem propriedades novas.
#   - feixes largos e suaves (4 texturas, tingidas pelo tema) que pulsam em ritmos diferentes = espessura/brilho variável dos raios
#   - anel de choque liso (troca a textura pixelada fx_ring 128 px por um anel suave) nos dois anéis que já expandem
#   - brilho radial no centro pulsando (tingido) e reflexo horizontal (anamórfico) pulsando
#   - poeira estelar em 2 camadas com deriva lenta (paralaxe) e cintilação
#   - 2º poliedro (dodecaedro com nós) girando em OUTRO eixo e no sentido contrário, por troca de 12 quadros (como o icosaedro)
# Elementos brancos ficam UMA vez fora dos painéis de tema; os tingidos ficam em cada tema (cor = cor dos raios do tema).
# Idempotente: remove o que ele mesmo pôs (chaves eth_v9*, controles v9_*) e põe de novo. Uso: python3 tools/sage_scene_fx.py
# Rodar DEPOIS de tools/gen_ui_json.py (que regera o hud_screen.json inteiro). Desfazer: python3 tools/sage_scene_fx.py --remove
import json, math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
UI = os.path.join(RP, "textures/ui/etheria"); HP = os.path.join(RP, "ui/hud_screen.json")
TX = "textures/ui/etheria/"

def wa(L):
    im = Image.new("RGBA", L.size, (255, 255, 255, 0)); im.putalpha(L); return im
def save(im, n): im.save(os.path.join(UI, n), optimize=True)

# ------------------------------------------------------------------ texturas (procedurais, brancas com alfa)
def beams(k):   # feixes largos: cunha que alarga com a distância + núcleo; 7 por camada, ângulos próprios
    W, H = 320, 180; S = 2; cx, cy = W * S / 2, H * S / 2; rnd = random.Random(900 + k)
    L = Image.new("L", (W * S, H * S), 0); d = ImageDraw.Draw(L); core = Image.new("L", L.size, 0); dc = ImageDraw.Draw(core)
    for j in range(7):
        a = (j + rnd.uniform(-0.35, 0.35)) * 2 * math.pi / 7 + k * 0.21; br = rnd.uniform(0.45, 1.0); sp = rnd.uniform(0.003, 0.010); w0 = rnd.uniform(1.0, 2.5) * S
        R = W * S * 1.3; r0 = 8 * S; ux, uy = math.cos(a), math.sin(a) * 0.92; nx, ny = -uy, ux
        p = [(cx + ux * r0 + nx * w0, cy + uy * r0 + ny * w0), (cx + ux * R + nx * (w0 + R * sp), cy + uy * R + ny * (w0 + R * sp)),
             (cx + ux * R - nx * (w0 + R * sp), cy + uy * R - ny * (w0 + R * sp)), (cx + ux * r0 - nx * w0, cy + uy * r0 - ny * w0)]
        d.polygon(p, fill=int(210 * br)); dc.line([(cx + ux * r0, cy + uy * r0), (cx + ux * R, cy + uy * R)], fill=int(255 * br), width=S)
    L = ImageChops.lighter(L.filter(ImageFilter.GaussianBlur(2.6 * S)), core.filter(ImageFilter.GaussianBlur(1.6 * S)).point(lambda v: min(255, int(v * 1.3))))
    fade = Image.new("L", L.size, 255); fd = ImageDraw.Draw(fade)   # some perto do centro (o núcleo é a estrela)
    for r in range(60, 0, -2): fd.ellipse([cx - r * S * 2.6, cy - r * S * 2.6, cx + r * S * 2.6, cy + r * S * 2.6], fill=int(255 * (r / 60) ** 0.5))
    return wa(ImageChops.multiply(L, fade).resize((W, H), Image.LANCZOS))
def ring():     # anel liso: halo gaussiano + núcleo fino
    N = 256; c = N / 2; L = Image.new("L", (N, N), 0); px = L.load()
    for y in range(N):
        for x in range(N):
            r = math.hypot(x + 0.5 - c, y + 0.5 - c) / c; v = 0.55 * math.exp(-((r - 0.84) / 0.07) ** 2) + 0.75 * math.exp(-((r - 0.86) / 0.018) ** 2) + 0.18 * math.exp(-((r - 0.80) / 0.16) ** 2)
            px[x, y] = min(255, int(255 * v))
    return wa(L)
def glow():
    N = 128; c = N / 2; L = Image.new("L", (N, N), 0); px = L.load()
    for y in range(N):
        for x in range(N):
            r = min(1.0, math.hypot(x + 0.5 - c, y + 0.5 - c) / c); px[x, y] = int(255 * ((1 - r) ** 2.4))
    return wa(L)
def flare():
    W, H = 512, 32; L = Image.new("L", (W, H), 0); px = L.load()
    for y in range(H):
        for x in range(W):
            fx = (1 - abs(x + 0.5 - W / 2) / (W / 2)) ** 2.2; dy = y + 0.5 - H / 2
            px[x, y] = min(255, int(255 * fx * (0.9 * math.exp(-(dy / 1.6) ** 2) + 0.28 * math.exp(-(dy / 6) ** 2))))
    return wa(L)
def dust(k):    # poeira estelar: pontos finos (camada 0) | pontos maiores e cintilantes em cruz (camada 1)
    W, H = 480, 270; S = 2; rnd = random.Random(70 + k); L = Image.new("L", (W * S, H * S), 0); d = ImageDraw.Draw(L)
    for _ in range(150 if k == 0 else 30):
        x, y = rnd.uniform(0, W * S), rnd.uniform(0, H * S); b = rnd.uniform(0.35, 1.0)
        r = (0.8 if k == 0 else rnd.choice((1.0, 1.0, 1.4))) * S; d.ellipse([x - r, y - r, x + r, y + r], fill=int(255 * b))
        if k == 1 and b > 0.88:
            q = 4 * S; d.line([(x - q, y), (x + q, y)], fill=int(150 * b), width=S); d.line([(x, y - q), (x, y + q)], fill=int(150 * b), width=S)
    return wa(L.filter(ImageFilter.GaussianBlur(0.35 * S)).resize((W, H), Image.LANCZOS))
# dodecaedro (vértices = centros das faces do icosaedro) girando no eixo de uma FACE, com inclinação diferente do icosaedro da cena
P_ = (1 + 5 ** 0.5) / 2
ICO = [(-1, P_, 0), (1, P_, 0), (-1, -P_, 0), (1, -P_, 0), (0, -1, P_), (0, 1, P_), (0, -1, -P_), (0, 1, -P_), (P_, 0, -1), (P_, 0, 1), (-P_, 0, -1), (-P_, 0, 1)]
d2 = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b))
DOD = [tuple((ICO[i][t] + ICO[j][t] + ICO[k][t]) / 3 for t in range(3)) for i in range(12) for j in range(i + 1, 12) for k in range(j + 1, 12)
       if all(abs(d2(ICO[x], ICO[y]) - 4) < 1e-6 for x, y in ((i, j), (j, k), (i, k)))]
_m = min(math.dist(DOD[0], DOD[q]) for q in range(1, len(DOD)))
DODE = [(i, j) for i in range(len(DOD)) for j in range(i + 1, len(DOD)) if abs(math.dist(DOD[i], DOD[j]) - _m) < 1e-3]
AX = [c / math.sqrt(sum(v * v for v in ICO[5])) for c in ICO[5]]
def rot_axis(p, a):
    x, y, z = p; ux, uy, uz = AX; c, s = math.cos(a), math.sin(a); dot = x * ux + y * uy + z * uz
    return (x * c + (uy * z - uz * y) * s + ux * dot * (1 - c), y * c + (uz * x - ux * z) * s + uy * dot * (1 - c), z * c + (ux * y - uy * x) * s + uz * dot * (1 - c))
def wireb(f, n=12):
    W, H = 400, 225; S = 2; cx, cy = W * S / 2, H * S / 2; L = Image.new("L", (W * S, H * S), 0); d = ImageDraw.Draw(L)
    a = -(f / n) * (2 * math.pi / 5); R = H * S * 0.40; rad = math.sqrt(sum(v * v for v in DOD[0])); P = []
    for v in DOD:
        x, y, z = rot_axis(v, a)
        y, z = y * math.cos(-0.95) - z * math.sin(-0.95), y * math.sin(-0.95) + z * math.cos(-0.95)
        x, y = x * math.cos(0.42) - y * math.sin(0.42), x * math.sin(0.42) + y * math.cos(0.42)
        k = R / rad / (1 + z * 0.10); P.append((cx + x * k, cy + y * k, z))
    for i, j in DODE: d.line([P[i][:2], P[j][:2]], fill=150 if P[i][2] + P[j][2] < 0 else 90, width=S)
    for x, y, z in P:
        r = (2.2 if z < 0 else 1.5) * S; d.ellipse([x - r, y - r, x + r, y + r], fill=235 if z < 0 else 140)
    return wa(L.filter(ImageFilter.GaussianBlur(0.4 * S)).resize((W, H), Image.LANCZOS))

def textures():
    for k in range(4): save(beams(k), f"ov_v_beam_{k}.png")
    for k in range(12): save(wireb(k), f"ov_v_wirb_{k}.png")
    save(ring(), "ov_v_ring.png"); save(glow(), "ov_v_glow.png"); save(flare(), "ov_v_flare.png")
    for k in range(2): save(dust(k), f"ov_v_dust_{k}.png")

# ------------------------------------------------------------------ JSON UI
def anims(D):
    A = {}
    def loop(name, typ, lo, hi, dur, start=0.0, ease="in_out_sine"):
        A[f"{name}_s"] = {"anim_type": "wait", "duration": round(start + 0.001, 3), "next": f"@hud.{name}_a"}
        A[f"{name}_a"] = {"anim_type": typ, "easing": ease, "from": lo, "to": hi, "duration": dur, "next": f"@hud.{name}_b"}
        A[f"{name}_b"] = {"anim_type": typ, "easing": ease, "from": hi, "to": lo, "duration": dur, "next": f"@hud.{name}_a"}
        return f"@hud.{name}_s"
    out = {}
    for k, (lo, hi, dur, st) in enumerate(((0.15, 0.85, 0.55, 0.0), (0.05, 0.70, 0.80, 0.30), (0.20, 0.80, 0.67, 0.55), (0.05, 0.65, 0.95, 0.15))):
        out[f"beam{k}"] = loop(f"eth_v9b{k}", "alpha", lo, hi, dur, st)
    out["glow"] = loop("eth_v9g", "size", [70, 70], [118, 118], 0.9)
    out["glowa"] = loop("eth_v9ga", "alpha", 0.35, 0.7, 0.45, 0.2)
    out["flare"] = loop("eth_v9f", "size", [240, 7], [470, 12], 1.25)
    out["flarea"] = loop("eth_v9fa", "alpha", 0.45, 0.95, 0.62, 0.1)
    out["dust0"] = loop("eth_v9d0", "offset", [-7, -3], [7, 3], 6.0)
    out["dust1"] = loop("eth_v9d1", "offset", [6, -4], [-6, 4], 3.8)
    out["dust1a"] = loop("eth_v9d1a", "alpha", 0.2, 0.9, 0.7)
    out["poly"] = []
    for k in range(12):   # mesma troca de quadros do icosaedro (vx), mais lenta: 12 x 0.2 s = 2.4 s por volta de 72°
        A[f"eth_v9y{k}_start"] = {"anim_type": "wait", "duration": round(k * 0.2 + 0.001, 3), "next": f"@hud.eth_v9y{k}_in"}
        A[f"eth_v9y{k}_in"] = {"anim_type": "alpha", "easing": "linear", "from": 0.0, "to": 0.75, "duration": 0.2, "next": f"@hud.eth_v9y{k}_out"}
        A[f"eth_v9y{k}_out"] = {"anim_type": "alpha", "easing": "linear", "from": 0.75, "to": 0.0, "duration": 0.2, "next": f"@hud.eth_v9y{k}_wait"}
        A[f"eth_v9y{k}_wait"] = {"anim_type": "wait", "duration": 2.0, "next": f"@hud.eth_v9y{k}_in"}
        out["poly"].append(f"@hud.eth_v9y{k}_start")
    return A, out

def img(tex, size, layer, alpha, anims_, color=None, center=False, fill=True):
    n = {"type": "image", "texture": TX + tex, "size": size}
    if center: n.update({"anchor_from": "center", "anchor_to": "center"})
    if fill: n.update({"keep_ratio": False, "fill": True})
    if color: n["color"] = color
    n.update({"alpha": alpha, "layer": layer, "anims": anims_}); return n

def patch(add=True):   # add=False desfaz (volta à cena 8.12: sem camadas v9 e anéis fx_ring)
    D = json.load(open(HP, encoding="utf-8")); before = json.dumps(D, ensure_ascii=False, indent=1)
    for k in [k for k in D if k.startswith("eth_v9")]: del D[k]
    wv = D["eth_world_voice"]; wv["controls"] = [c for c in wv["controls"] if not next(iter(c)).startswith("v9_")]
    A, an = anims(D)
    if add: D.update(A)
    themes = []
    for c in wv["controls"]:
        (name, node), = c.items()
        if not name.startswith("vtheme_"): continue
        themes.append(name)
        node["controls"] = [x for x in node["controls"] if not next(iter(x)).startswith("v9_")]
        col = next(v["color"] for x in node["controls"] for kk, v in x.items() if kk == "vr0")
        soft = [round(0.45 + 0.55 * v, 3) for v in col]
        for x in node["controls"]:
            (kk, v), = x.items()
            if kk in ("vring0", "vring1"): v["texture"] = TX + ("ov_v_ring" if add else "fx_ring")
        extra = [{f"v9_beam{k}": img(f"ov_v_beam_{k}", ["100%", "100%"], 62, 0.0, [an[f"beam{k}"]], color=col)} for k in range(4)]
        extra.append({"v9_glow": img("ov_v_glow", [90, 90], 62, 0.5, [an["glow"], an["glowa"]], color=soft, center=True, fill=False)})
        node["controls"] = (extra if add else []) + node["controls"]
    # brancos (uma vez): poeira logo após o fundo; poliedro 2 e reflexo depois dos temas (antes do texto)
    i_bg = next(i for i, c in enumerate(wv["controls"]) if next(iter(c)) == "vbg")
    dust = [{"v9_dust0": img("ov_v_dust_0", ["110%", "110%"], 62, 0.8, [an["dust0"]], center=True)},
            {"v9_dust1": img("ov_v_dust_1", ["110%", "110%"], 62, 0.6, [an["dust1"], an["dust1a"]], center=True)}]
    if add: wv["controls"][i_bg + 1:i_bg + 1] = dust
    i_tx = next(i for i, c in enumerate(wv["controls"]) if next(iter(c)) == "title")
    poly = {"v9_poly": {"type": "panel", "size": ["78%", "78%"], "anchor_from": "center", "anchor_to": "center",
                        "controls": [{f"y{k}": img(f"ov_v_wirb_{k}", ["100%", "100%"], 64, 0.0, [an["poly"][k]])} for k in range(12)]}}
    fl = {"v9_flare": img("ov_v_flare", [240, 7], 65, 0.4, [an["flare"], an["flarea"]], color=[0.85, 0.93, 1.0], center=True, fill=False)}
    if add: wv["controls"][i_tx:i_tx] = [poly, fl]
    for c in D["eth_title_fx"]["controls"]:   # clarão de entrada/revelação: o anel também fica liso
        for x in next(iter(c.values()))["controls"]:
            if "ring" in x: x["ring"]["texture"] = TX + ("ov_v_ring" if add else "fx_ring")
    after = json.dumps(D, ensure_ascii=False, indent=1)
    if after != before: open(HP, "w", encoding="utf-8").write(after)
    json.load(open(HP, encoding="utf-8"))
    print(f"hud_screen.json {'alterado' if after != before else 'sem mudança'} | {len(after.encode())} bytes | temas: {', '.join(themes)}")

if __name__ == "__main__":
    import sys
    if "--remove" in sys.argv: patch(False)
    else: textures(); patch()

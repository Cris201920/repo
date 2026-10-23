# 9.1 - MOVIMENTO da cena do Grande Sábio (aquisição de habilidade / evolução), medido no vídeo do mod (videoplayback_1, 30 fps):
#   raios vermelhos: ~32-38 visíveis, simetria de 16 (repete a cada 22,5°), giram ~9°/s no sentido horário, largura mediana 3,5°
#                    (2,5°..12°), brilho pulsa ~1 vez/s com subida rápida; linhas brancas: ~13-16 retas pelo centro que aparecem,
#                    derivam ~2°/s e somem; núcleo: cintila irregular com quedas curtas a cada ~2 s; poliedro gira em 3D sem
#                    voltar à mesma pose em 8 s; texto entra digitando (~0,2-0,3 s por linha) e sai em cascata (0,1 s/linha).
# O que este gerador faz (só tipos já usados no hud_screen.json ou no hud_screen.json vanilla; sem bindings novos):
#   - poliedros com flip_book (como "auto_save_animation" do vanilla: tira HORIZONTAL, frame_step = largura do quadro, "uv"/"uv_size"):
#     icosaedro 24 quadros por 72° (eixo de 5 dobras com bamboleio, 12 fps) e dodecaedro 24 quadros por 120° (eixo de 3 dobras,
#     sentido contrário, 8 fps), com perspectiva e arestas sombreadas pela profundidade. Cada tira é cortada em 3 fatias verticais
#     (3 imagens lado a lado) para nenhuma textura passar de 2048 px de largura. Troca 60 + 12 imagens por 6.
#   - raios: 8 texturas novas = o MESMO leque de simetria 16 girado 2,8125° a cada quadro, com cintilação e nós de brilho que
#     correm para fora ao longo do raio; troca suave a cada 0,3125 s = 22,5° em 2,5 s = 9°/s (igual ao mod).
#   - linhas brancas: 8 texturas com retas que nascem, derivam ~1,2° e somem (vida de 3 quadros).
#   - feixes largos: pulso de 1 s com subida de 0,1 s e queda lenta, em sequência (varredura); núcleo, estrela e reflexo com
#     pulsação não linear (cadeias de mesma duração total, então ficam em fase); anéis com expansão out_cubic e brilho que some
#     no fim; faíscas que voam para fora (textura de traços escalando a partir do centro, 2 camadas defasadas); estrelas do fundo
#     com aproximação lenta (zoom 100%->140% em 10 s, 2 camadas que se revezam).
# Não muda: texto (vem do script), gatilhos, modo discreto, server_form.json. Texturas antigas ficam (o menu do Sábio usa ov_v_wire_*).
# Ordem: tools/gen_ui_json.py -> tools/sage_scene_fx.py -> tools/sage_motion_fx.py. Idempotente.
# Desfazer (volta exatamente à cena 8.13): python3 tools/sage_motion_fx.py --remove
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
UI = os.path.join(RP, "textures/ui/etheria"); HP = os.path.join(RP, "ui/hud_screen.json"); TX = "textures/ui/etheria/"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sage_scene_fx as V9   # só para recriar o que a 9.0 tinha (v9_poly) no --remove

NF, SLICES = 24, 3
def wa(L):
    im = Image.new("RGBA", L.size, (255, 255, 255, 0)); im.putalpha(L); return im
def save(im, n): im.save(os.path.join(UI, n), optimize=True)

# ------------------------------------------------------------------ poliedros (flip_book)
P_ = (1 + 5 ** 0.5) / 2
ICO = V9.ICO; DOD = V9.DOD; DODE = V9.DODE
ICOE = [(i, j) for i in range(12) for j in range(i + 1, 12) if abs(V9.d2(ICO[i], ICO[j]) - 4) < 1e-6]
def unit(v): n = math.sqrt(sum(c * c for c in v)); return tuple(c / n for c in v)
def rot(p, ax, a):
    x, y, z = p; ux, uy, uz = ax; c, s = math.cos(a), math.sin(a); d = x * ux + y * uy + z * uz
    return (x * c + (uy * z - uz * y) * s + ux * d * (1 - c), y * c + (uz * x - ux * z) * s + uy * d * (1 - c), z * c + (ux * y - uy * x) * s + uz * d * (1 - c))
def align(ax):   # rotação que leva o eixo 'ax' para (0,-1,0) (vertical da tela)
    t = (0.0, -1.0, 0.0); c = sum(a * b for a, b in zip(ax, t)); k = (ax[1] * t[2] - ax[2] * t[1], ax[2] * t[0] - ax[0] * t[2], ax[0] * t[1] - ax[1] * t[0])
    if sum(v * v for v in k) < 1e-9: return lambda p: p
    k = unit(k); a = math.acos(max(-1, min(1, c))); return lambda p: rot(p, k, a)
def poly_frame(V, E, f, N, period, axis, sign, tilt, wob, roll, size, nodes):
    S = 3; W = size * S; c = W / 2; L = Image.new("L", (W, W), 0); d = ImageDraw.Draw(L)
    ph = 2 * math.pi * f / N; spin = sign * period * f / N; up = align(axis)
    tl = tilt + wob * math.sin(ph); rl = roll * math.cos(ph)
    rad = max(math.sqrt(sum(v * v for v in p)) for p in V); P = []
    for v in V:
        x, y, z = up(rot(v, axis, spin))
        y, z = y * math.cos(tl) - z * math.sin(tl), y * math.sin(tl) + z * math.cos(tl)   # inclina o eixo para a câmera
        x, y = x * math.cos(rl) - y * math.sin(rl), x * math.sin(rl) + y * math.cos(rl)   # pequeno rolamento (bamboleio)
        k = (W * 0.43 / rad) * 3.2 / (3.2 - z / rad); P.append((c + x * k, c + y * k, z / rad))
    for i, j in sorted(E, key=lambda e: P[e[0]][2] + P[e[1]][2]):   # de trás para a frente
        zm = (P[i][2] + P[j][2]) / 2; t = (zm + 1) / 2
        d.line([P[i][:2], P[j][:2]], fill=int(255 * (0.22 + 0.78 * t ** 1.5)), width=max(1, int(round((0.55 + 0.95 * t) * S))))
    if nodes:
        for x, y, z in P:
            t = (z + 1) / 2; r = (0.8 + 1.4 * t) * S; d.ellipse([x - r, y - r, x + r, y + r], fill=int(255 * (0.35 + 0.65 * t)))
    L = L.filter(ImageFilter.GaussianBlur(0.45 * S)).resize((size, size), Image.LANCZOS)
    glow = L.filter(ImageFilter.GaussianBlur(2.0)).point(lambda v: int(v * 0.45))
    return Image.fromarray(np.maximum(np.asarray(L), np.asarray(glow)))
def strip_slices(frames, name):
    sz = frames[0].size[0]; sw = sz // SLICES
    for s in range(SLICES):
        st = Image.new("L", (sw * len(frames), sz), 0)
        for i, fr in enumerate(frames): st.paste(fr.crop((s * sw, 0, (s + 1) * sw, sz)), (i * sw, 0))
        save(wa(st), f"{name}_s{s}.png")
    return sw, sz
ICO_PX, DOD_PX = 252, 216   # 3 fatias x 24 quadros: 84*24 = 2016 px e 72*24 = 1728 px de largura
def poly_textures():
    ax5 = unit(ICO[0]); ax3 = unit(DOD[0])
    ico = [poly_frame(ICO, ICOE, f, NF, 2 * math.pi / 5, ax5, -1, -0.62, 0.10, 0.06, ICO_PX, False) for f in range(NF)]
    dod = [poly_frame(DOD, DODE, f, NF, 2 * math.pi / 3, ax3, 1, -0.95, 0.08, 0.05, DOD_PX, True) for f in range(NF)]
    return strip_slices(ico, "ov_m_ico"), strip_slices(dod, "ov_m_dod"), ico, dod

# ------------------------------------------------------------------ raios (simetria 16, girando por troca suave)
W_, H_ = 640, 360
def smooth_noise(n, rnd, k=5):
    v = np.array([rnd.random() for _ in range(n)]); out = v.copy()
    for _ in range(k): out = (np.roll(out, 1) + out + np.roll(out, -1)) / 3
    return (out - out.min()) / (out.max() - out.min() + 1e-9)
def ray_textures():
    yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32); dx, dy = xx + 0.5 - W_ / 2, yy + 0.5 - H_ / 2
    r = np.hypot(dx, dy); th = np.degrees(np.arctan2(dy, dx)); rnd = random.Random(911); SEC = 22.5; STEP = SEC / 8
    # 3 raios por setor (o mod tem ~2 por setor + alguns largos): principal, secundário fino e brilho largo
    cls = [(0.0, 1.6, 1.00, 0.020), (9.5, 1.0, 0.62, 0.028), (15.0, 4.6, 0.17, 0.014)]   # (ângulo no setor, sigma°, brilho, nós/px)
    B = [0.45 + 0.55 * smooth_noise(128, rnd, 3) for _ in cls]                    # cintilação: b_k(j) = B[(8j+k) % 128]
    for i in range(128):
        if rnd.random() < 0.07: B[0][i] = 1.15   # picos rápidos (subida brusca)
    near = np.clip((r - 18) / 70, 0, 1) ** 1.4; far = np.clip(1.15 - r / 420, 0.35, 1)
    for k in range(8):
        acc = np.zeros_like(r)
        for ci, (off, sg, br, kn) in enumerate(cls):
            for j in range(16):
                a0 = j * SEC + off + k * STEP; dth = (th - a0 + 180) % 360 - 180
                g = np.exp(-0.5 * (dth / (sg * (0.75 + 0.25 * np.clip(120 / (r + 1), 0, 1.6)))) ** 2)
                knots = 0.72 + 0.28 * np.sin(2 * math.pi * (r * kn - (8 * j + k) / 8 * 2 + j * 0.37))   # nós correndo para fora
                acc += g * br * B[ci][(8 * j + k) % 128] * knots
        core = np.zeros_like(r)
        for j in range(16):   # fio central mais brilhante no raio principal
            dth = (th - (j * SEC + k * STEP) + 180) % 360 - 180; core += np.exp(-0.5 * (dth / 0.35) ** 2) * B[0][(8 * j + k) % 128]
        v = np.clip((acc * 0.85 + core * 0.35) * near * far, 0, 1)
        save(wa(Image.fromarray((v * 255).astype(np.uint8))), f"ov_m_rot_{k}.png")
def white_textures():
    rnd = random.Random(1337); lines = []
    for n in range(36):   # vida de 3 quadros (troca a cada 0,25 s): nasce, deriva ~1,2°/quadro e some
        lines.append((rnd.uniform(0, 180), rnd.choice((-1, 1)) * rnd.uniform(0.6, 1.6), n % 8, rnd.uniform(0.55, 1.35), rnd.uniform(0.35, 1.25), rnd.uniform(0.5, 1.0), rnd.choice((1, 1, 2))))
    S = 2; R = math.hypot(W_, H_) / 2 * S; cx, cy = W_ * S / 2, H_ * S / 2
    for k in range(8):
        L = Image.new("L", (W_ * S, H_ * S), 0); d = ImageDraw.Draw(L)
        for a, drift, b, l1, l2, br, w in lines:
            age = (k - b) % 8
            if age > 2: continue
            lum = (0.45, 1.0, 0.45)[age] * br; aa = math.radians(a + drift * age); ux, uy = math.cos(aa), math.sin(aa)
            for seg in range(12):   # mais forte perto do centro
                t0, t1 = seg / 12, (seg + 1) / 12; f = (1 - t0) ** 0.8
                for sgn, ll in ((1, l1), (-1, l2)):
                    p0 = (cx + sgn * ux * R * ll * t0, cy + sgn * uy * R * ll * t0); p1 = (cx + sgn * ux * R * ll * t1, cy + sgn * uy * R * ll * t1)
                    d.line([p0, p1], fill=int(255 * lum * f), width=w * S)
        L = L.filter(ImageFilter.GaussianBlur(0.5 * S)).resize((W_, H_), Image.LANCZOS)
        save(wa(L), f"ov_m_wht_{k}.png")
def spark_texture():   # traços radiais: escalando a partir do centro viram faíscas voando para fora
    N = 256; S = 2; c = N * S / 2; rnd = random.Random(77); L = Image.new("L", (N * S, N * S), 0); d = ImageDraw.Draw(L)
    for _ in range(90):
        a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(0.10, 0.95) * c; ln = (0.025 + 0.06 * r / c) * c; b = rnd.uniform(0.4, 1.0)
        ux, uy = math.cos(a), math.sin(a); d.line([(c + ux * r, c + uy * r), (c + ux * (r + ln), c + uy * (r + ln))], fill=int(255 * b), width=S)
        d.ellipse([c + ux * (r + ln) - 1.2 * S, c + uy * (r + ln) - 1.2 * S, c + ux * (r + ln) + 1.2 * S, c + uy * (r + ln) + 1.2 * S], fill=int(255 * b))
    save(wa(L.filter(ImageFilter.GaussianBlur(0.5 * S)).resize((N, N), Image.LANCZOS)), "ov_m_spark.png")
def dust_textures():   # duas camadas equivalentes (pontos finos + alguns brilhantes) para o zoom em revezamento
    W, H = 480, 270; S = 2
    for k in range(2):
        rnd = random.Random(500 + k); L = Image.new("L", (W * S, H * S), 0); d = ImageDraw.Draw(L)
        for _ in range(170):
            x, y = rnd.uniform(0, W * S), rnd.uniform(0, H * S); b = rnd.uniform(0.2, 0.85) ** 1.3; rr = rnd.choice((0.6, 0.7, 0.8, 1.1)) * S
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=int(255 * b))
            if b > 0.74: q = 3 * S; d.line([(x - q, y), (x + q, y)], fill=int(140 * b), width=S); d.line([(x, y - q), (x, y + q)], fill=int(140 * b), width=S)
        save(wa(L.filter(ImageFilter.GaussianBlur(0.35 * S)).resize((W, H), Image.LANCZOS)), f"ov_m_dust_{k}.png")
def textures():
    poly_textures(); ray_textures(); white_textures(); spark_texture(); dust_textures()

# ------------------------------------------------------------------ JSON UI
PFX = "eth_mv_"
def anims():
    A = {}
    def chain(name, typ, steps, start=0.0):   # steps: [(from, to, dur, easing)], laço fechado
        A[f"{PFX}{name}_s"] = {"anim_type": "wait", "duration": round(start + 0.001, 4), "next": f"@hud.{PFX}{name}_0"}
        for i, (a, b, dur, e) in enumerate(steps):
            A[f"{PFX}{name}_{i}"] = {"anim_type": typ, "easing": e, "from": a, "to": b, "duration": dur, "next": f"@hud.{PFX}{name}_{(i + 1) % len(steps)}"}
        return f"@hud.{PFX}{name}_s"
    out = {}
    st = 0.3125   # raios: 8 quadros x 2,8125° -> 22,5° em 2,5 s = 9°/s
    for k in range(8):
        A[f"{PFX}r{k}_s"] = {"anim_type": "wait", "duration": round(k * st + 0.001, 4), "next": f"@hud.{PFX}r{k}_in"}
        A[f"{PFX}r{k}_in"] = {"anim_type": "alpha", "easing": "linear", "from": 0.0, "to": 1.0, "duration": st, "next": f"@hud.{PFX}r{k}_out"}
        A[f"{PFX}r{k}_out"] = {"anim_type": "alpha", "easing": "linear", "from": 1.0, "to": 0.0, "duration": st, "next": f"@hud.{PFX}r{k}_w"}
        A[f"{PFX}r{k}_w"] = {"anim_type": "wait", "duration": 6 * st, "next": f"@hud.{PFX}r{k}_in"}
        out[f"r{k}"] = f"@hud.{PFX}r{k}_s"
    for k, (per, lo, hi) in enumerate(((1.0, 0.08, 0.85), (1.0, 0.05, 0.70), (1.0, 0.10, 0.80), (1.0, 0.04, 0.65))):   # pulso de 1 s em varredura
        out[f"beam{k}"] = chain(f"b{k}", "alpha", [(lo, hi, 0.1, "out_quad"), (hi, lo, per - 0.1, "out_cubic")], k * 0.25)
    # núcleo: ciclo de 2,2 s com cintilação e uma queda curta (como o mod); estrela e reflexo usam o MESMO total (ficam em fase)
    out["glowa"] = chain("ga", "alpha", [(0.55, 0.95, 0.06, "out_quad"), (0.95, 0.62, 0.30, "out_cubic"), (0.62, 0.82, 0.10, "in_out_sine"),
                                          (0.82, 0.50, 0.44, "in_out_sine"), (0.50, 0.22, 0.14, "in_quad"), (0.22, 0.30, 0.22, "linear"),
                                          (0.30, 0.95, 0.07, "out_quad"), (0.95, 0.55, 0.87, "out_cubic")])
    out["glow"] = chain("gs", "size", [([76, 76], [124, 124], 0.06, "out_quad"), ([124, 124], [92, 92], 0.40, "out_cubic"), ([92, 92], [104, 104], 0.40, "in_out_sine"),
                                        ([104, 104], [64, 64], 0.36, "in_quad"), ([64, 64], [128, 128], 0.07, "out_quad"), ([128, 128], [76, 76], 0.91, "out_cubic")])
    out["star"] = chain("st", "size", [([196, 49], [262, 66], 0.06, "out_quad"), ([262, 66], [214, 54], 0.40, "out_cubic"), ([214, 54], [226, 57], 0.40, "in_out_sine"),
                                        ([226, 57], [176, 44], 0.36, "in_quad"), ([176, 44], [270, 68], 0.07, "out_quad"), ([270, 68], [196, 49], 0.91, "out_cubic")])
    out["flare"] = chain("fs", "size", [([260, 7], [480, 12], 0.06, "out_quad"), ([480, 12], [330, 8], 0.40, "out_cubic"), ([330, 8], [360, 9], 0.40, "in_out_sine"),
                                         ([360, 9], [220, 6], 0.36, "in_quad"), ([220, 6], [500, 13], 0.07, "out_quad"), ([500, 13], [260, 7], 0.91, "out_cubic")])
    out["flarea"] = chain("fa", "alpha", [(0.45, 1.0, 0.06, "out_quad"), (1.0, 0.6, 0.40, "out_cubic"), (0.6, 0.7, 0.40, "in_out_sine"),
                                           (0.7, 0.25, 0.36, "in_quad"), (0.25, 1.0, 0.07, "out_quad"), (1.0, 0.45, 0.91, "out_cubic")])
    for k in range(2):   # anéis: expansão rápida que desacelera, brilho que fica e some no fim; 2 em fila (meio ciclo de atraso)
        out[f"ring{k}"] = chain(f"rs{k}", "size", [([40, 17], [820, 350], 2.8, "out_cubic")], k * 1.4)
        out[f"ringa{k}"] = chain(f"ra{k}", "alpha", [(0.0, 0.6, 0.12, "out_quad"), (0.6, 0.0, 2.68, "in_sine")], k * 1.4)
        out[f"spark{k}"] = chain(f"ks{k}", "size", [([40, 40], [640, 640], 1.6, "in_quad")], k * 0.8)
        out[f"sparka{k}"] = chain(f"ka{k}", "alpha", [(0.0, 0.85, 0.25, "out_quad"), (0.85, 0.0, 1.35, "in_quad")], k * 0.8)
        out[f"dust{k}"] = chain(f"ds{k}", "size", [(["100%", "100%"], ["140%", "140%"], 10.0, "linear")], k * 5.0)
        out[f"dusta{k}"] = chain(f"da{k}", "alpha", [(0.0, 0.7, 2.0, "in_out_sine"), (0.7, 0.7, 6.0, "linear"), (0.7, 0.0, 2.0, "in_out_sine")], k * 5.0)
    return A, out
def flip(name, fps):
    return {"anim_type": "flip_book", "initial_uv": [0, 0], "frame_count": NF, "frame_step": 0, "fps": fps, "looping": True, "reversible": False, "easing": "linear"}
def poly_panel(name, tex, px, fps, size, offset, alpha):
    sw = px // SLICES; anchors = ("left_middle", "center", "right_middle")
    ctrls = [{f"s{s}": {"type": "image", "texture": TX + f"{tex}_s{s}", "size": ["33.4%", "100%"], "anchor_from": anchors[s], "anchor_to": anchors[s],
                         "uv_size": [sw, px], "uv": f"@hud.{PFX}fb_{name}", "keep_ratio": False, "disable_anim_fast_forward": True, "alpha": alpha, "layer": 64}}
             for s in range(SLICES)]
    return {f"mv_{name}": {"type": "panel", "size": size, "anchor_from": "center", "anchor_to": "center", "offset": offset, "controls": ctrls}}
def ctr(tex, size, layer, alpha, an, color=None):
    n = {"type": "image", "texture": TX + tex, "size": size, "anchor_from": "center", "anchor_to": "center"}
    if color: n["color"] = color
    n.update({"alpha": alpha, "layer": layer, "anims": an}); return n

def themes(wv): return [(k, v) for c in wv["controls"] for k, v in c.items() if k.startswith("vtheme_")]
def child(node, name): return next((v for c in node["controls"] for k, v in c.items() if k == name), None)
def restore(D):
    """volta à cena 8.13 (o que gen_ui_json + sage_scene_fx geraram)"""
    for k in [k for k in D if k.startswith(PFX)]: del D[k]
    wv = D["eth_world_voice"]; wv["controls"] = [c for c in wv["controls"] if not next(iter(c)).startswith("mv_")]
    for name, node in themes(wv):
        for k in range(8):
            if child(node, f"vr{k}"): child(node, f"vr{k}").update({"texture": TX + f"ov_v_rays_{k}", "anims": [f"@hud.eth_vr{k}_start"]})
            if child(node, f"vw{k}"): child(node, f"vw{k}").update({"texture": TX + f"ov_v_rayw_{k}", "anims": [f"@hud.eth_vw{k}_start"]})
        for k in range(2):
            if child(node, f"vring{k}"): child(node, f"vring{k}")["anims"] = [f"@hud.eth_vring{k}_start", f"@hud.eth_vringa{k}_start"]
        if child(node, "vstar"): child(node, "vstar")["anims"] = ["@hud.eth_vstar_a"]
        for k in range(4):
            if child(node, f"v9_beam{k}"): child(node, f"v9_beam{k}")["anims"] = [f"@hud.eth_v9b{k}_s"]
        if child(node, "v9_glow"): child(node, "v9_glow")["anims"] = ["@hud.eth_v9g_s", "@hud.eth_v9ga_s"]
        if not child(node, "vx0"):   # icosaedro antigo: 12 quadros por troca de alfa, depois do vring1
            i = next(i for i, c in enumerate(node["controls"]) if next(iter(c)) == "vstar")
            node["controls"][i:i] = [{f"vx{k}": {"type": "image", "texture": TX + f"ov_v_wire_{k}", "size": ["100%", "100%"], "keep_ratio": False, "fill": True,
                                                 "alpha": 0.0, "layer": 64, "anims": [f"@hud.eth_vx{k}_start"]}} for k in range(12)]
    names = [next(iter(c)) for c in wv["controls"]]
    if "eth_v9d0_s" in D:   # a 9.0 está aplicada: devolve as animações dela e o dodecaedro de 12 quadros
        _, an = V9.anims(D)
        for c in wv["controls"]:
            (k, v), = c.items()
            if k == "v9_dust0": v["texture"] = TX + "ov_v_dust_0"; v["anims"] = [an["dust0"]]
            if k == "v9_dust1": v["texture"] = TX + "ov_v_dust_1"; v["anims"] = [an["dust1"], an["dust1a"]]
            if k == "v9_flare": v["anims"] = [an["flare"], an["flarea"]]
        if "v9_poly" not in names and "v9_flare" in names:
            i = names.index("v9_flare")
            wv["controls"][i:i] = [{"v9_poly": {"type": "panel", "size": ["78%", "78%"], "anchor_from": "center", "anchor_to": "center",
                                                "controls": [{f"y{k}": V9.img(f"ov_v_wirb_{k}", ["100%", "100%"], 64, 0.0, [an["poly"][k]])} for k in range(12)]}}]
def apply(D):
    A, an = anims(); D.update(A)
    D[f"{PFX}fb_ico"] = dict(flip("ico", 12), frame_step=ICO_PX // SLICES)
    D[f"{PFX}fb_dod"] = dict(flip("dod", 8), frame_step=DOD_PX // SLICES)
    wv = D["eth_world_voice"]
    for name, node in themes(wv):
        node["controls"] = [c for c in node["controls"] if not next(iter(c)).startswith("vx")]
        for k in range(8):
            child(node, f"vr{k}").update({"texture": TX + f"ov_m_rot_{k}", "anims": [an[f"r{k}"]]})
            child(node, f"vw{k}")["texture"] = TX + f"ov_m_wht_{k}"
        for k in range(2): child(node, f"vring{k}")["anims"] = [an[f"ring{k}"], an[f"ringa{k}"]]
        child(node, "vstar")["anims"] = [an["star"]]
        for k in range(4):
            if child(node, f"v9_beam{k}"): child(node, f"v9_beam{k}")["anims"] = [an[f"beam{k}"]]
        if child(node, "v9_glow"): child(node, "v9_glow")["anims"] = [an["glow"], an["glowa"]]
    wv["controls"] = [c for c in wv["controls"] if next(iter(c)) != "v9_poly"]
    for c in wv["controls"]:
        (k, v), = c.items()
        if k in ("v9_dust0", "v9_dust1"): i = k[-1]; v["texture"] = TX + f"ov_m_dust_{i}"; v["anims"] = [an[f"dust{i}"], an[f"dusta{i}"]]
        if k == "v9_flare": v["anims"] = [an["flare"], an["flarea"]]
    i = next(i for i, c in enumerate(wv["controls"]) if next(iter(c)) in ("v9_flare", "title"))
    sparks = [{f"mv_spark{k}": ctr("ov_m_spark", [40, 40], 63, 0.0, [an[f"spark{k}"], an[f"sparka{k}"]], color=[1.0, 0.96, 0.92])} for k in range(2)]
    wv["controls"][i:i] = sparks + [poly_panel("ico", "ov_m_ico", ICO_PX, 12, ["92%y", "92%y"], [0, "2%"], 0.62),
                                    poly_panel("dod", "ov_m_dod", DOD_PX, 8, ["66%y", "66%y"], [0, "1%"], 0.38)]
def patch(add=True):
    D = json.load(open(HP, encoding="utf-8")); before = json.dumps(D, ensure_ascii=False, indent=1)
    restore(D)
    if add: apply(D)
    after = json.dumps(D, ensure_ascii=False, indent=1)
    if after != before: open(HP, "w", encoding="utf-8").write(after)
    json.load(open(HP, encoding="utf-8"))
    print(f"hud_screen.json {'alterado' if after != before else 'sem mudança'} | {len(after.encode())} bytes")

if __name__ == "__main__":
    if "--remove" in sys.argv: patch(False)
    else:
        if "--json-only" not in sys.argv: textures()
        patch()

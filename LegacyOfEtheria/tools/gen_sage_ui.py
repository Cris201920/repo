#!/usr/bin/env python3
"""8.x - PACOTE OPCIONAL "Legacy of Etheria Sábio UI" (pasta LegacyOfEtheria_SageUI/): telas no estilo do Grande Sábio dos vídeos
(tela cheia escura com o mundo escurecido, moldura verde-ciano holográfica, título grande digitando, texto revelado linha a linha,
icosaedro girando, botões do Sábio). Aplica-se a: escolha de raça (carrossel/ficha/Escolher), análise e "Confirmar renascimento",
árvore/evolução da raça, habilidades/Registro do Sábio (ficha Tensura) e o menu do Livro do Sábio.

SEGURANÇA: o pacote principal (LegacyOfEtheria_RP) NÃO muda. Este pacote traz uma cópia COMPLETA do ui/server_form.json do principal
(todas as chaves eth_* idênticas) + as telas novas eth_sg_*; como um pacote acima substitui o arquivo inteiro, a cópia é refeita daqui
a partir do principal (rode de novo sempre que o server_form.json principal mudar; o build.sh já roda com --sync).
Se o mundo não abrir, basta desativar este pacote: os scripts continuam iguais e o principal mostra o visual estável.

Marcadores (systems/ui/forms.js): título = "§e§t§h" + "§j§q" (SG) + tema/cartão + "§r" + texto.
  - SG + "§t§k"  -> eth_sg_card_form  (8.9: carrossel de raças do vídeo: céu estrelado, cartão alto, retrato de corpo inteiro
                    textures/ui/etheria_sg/race_<id> (tools/race_portraits.py), selo "§l§r§N", ficha, < ESCOLHER >; "§t§y" = "Confirmar?")
  - SG + "§t§i"  -> eth_sg_intro_form (8.9: abertura "Sorteio." ... faixa vermelha com a aptidão)  | SG + "§t§o" -> eth_sg_outro_form (esfera final)
  - SG + "§t§n"  -> eth_sg_book_form  (menu do Livro do Sábio: icosaedro, fala, opções)
  - SG (outros)  -> eth_sg_form       (ficha à esquerda, botões do Sábio à direita)
  O principal não procura "§j§q", então lá esses títulos caem nas telas de sempre (eth_form / eth_card_form).

Uso: python3 tools/gen_sage_ui.py          (texturas + manifesto + server_form.json + validação)
     python3 tools/gen_sage_ui.py --sync   (só refaz/valida o server_form.json; não precisa de PIL)
     python3 tools/gen_sage_ui.py --check  (só valida o que está no disco)
Sai com código 1 (sem gravar) se a validação falhar."""
import json, os, re, sys, copy, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN_RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
PACK = os.path.join(ROOT, "LegacyOfEtheria_SageUI")
NS = "server_form"
TEX = "textures/ui/etheria_sg"
BASE, CARD, SAGEN, SG = "§e§t§h", "§t§k", "§t§n", "§j§q"
INTRO, OUTRO, CONFIRM = "§t§i", "§t§o", "§t§y"     # 8.9: cenas da reencarnação e modo "Confirmar?" do cartão (systems/ui/forms.js scene / cardMenu)
DIFF = [("Fácil", [0.45, 0.95, 0.5], (70, 220, 110)), ("Normal", [1.0, 0.75, 0.3], (240, 170, 60)), ("Difícil", [1.0, 0.38, 0.36], (235, 70, 70)), ("Extremo", [0.85, 0.5, 1.0], (190, 110, 245))]
NAVY_TXT = [0.86, 0.9, 0.97]
CW = 184   # largura do cartão do carrossel (px de UI)
RACE_CODES = {r: "0123456789abc"[i] for i, r in enumerate(["human", "slime", "goblin", "demon", "elf", "angel", "dragonoid", "beastkin", "undead", "ogre", "lizardman", "vampire", "dwarf"])}
# UUIDs fixos deste pacote (gerados uma vez; NÃO trocar, senão o mundo perde o pacote ativado)
HEADER_UUID = "5b1f3c2e-8a47-4d1e-9c6b-2f7e0a9d4c31"
MODULE_UUID = "c3e8a91d-6f02-4b7a-a5d4-81e9f2b3c6a7"
GREEN = [0.55, 1.0, 0.82]   # verde-ciano do Sábio
CYAN = [0.45, 0.95, 1.0]

has = lambda code: f"(not ((#title_text - '{code}') = #title_text))"
lacks = lambda code: f"((#title_text - '{code}') = #title_text)"
def vis(expr): return [{"binding_name": "#title_text"}, {"binding_type": "view", "source_property_name": expr, "target_property_name": "#visible"}]
def AND(*e): return "(" + " and ".join(e) + ")"
T = lambda n: f"{TEX}/{n}"

# ------------------------------------------------------------------ texturas (PIL) - pequenas, nineslice onde estica
def geodesic_frames(n, S):
    """esfera de linhas do vídeo (288-294 s): icosaedro subdividido (frequência 3), linhas finas azuladas, as de trás mais apagadas;
    n quadros girando 72° em volta de um eixo de 5 dobras (o quadro n volta a ser o 0 -> laço sem salto)"""
    from PIL import Image, ImageDraw
    ph = (1 + 5 ** 0.5) / 2
    V = [(-1, ph, 0), (1, ph, 0), (-1, -ph, 0), (1, -ph, 0), (0, -1, ph), (0, 1, ph), (0, -1, -ph), (0, 1, -ph), (ph, 0, -1), (ph, 0, 1), (-ph, 0, -1), (-ph, 0, 1)]
    nrm = lambda v: tuple(c / math.sqrt(sum(x * x for x in v)) for c in v)
    V = [nrm(v) for v in V]
    E0 = [(i, j) for i in range(12) for j in range(i + 1, 12) if abs(sum(a * b for a, b in zip(V[i], V[j])) - 1 / 5 ** 0.5) < 1e-6]
    F = [(i, j, k) for (i, j) in E0 for k in range(j + 1, 12) if (i, k) in E0 and (j, k) in E0]
    pts, edges, f = {}, set(), 3
    def P(a, b, c, u, v):
        w = f - u - v; p = nrm(tuple((V[a][t] * w + V[b][t] * u + V[c][t] * v) / f for t in range(3))); key = tuple(round(x, 5) for x in p)
        pts.setdefault(key, p); return key
    for (a, b, c) in F:
        for u in range(f + 1):
            for v in range(f + 1 - u):
                p0 = P(a, b, c, u, v)
                if u + v < f: edges.add(frozenset((p0, P(a, b, c, u + 1, v)))); edges.add(frozenset((p0, P(a, b, c, u, v + 1)))); edges.add(frozenset((P(a, b, c, u + 1, v), P(a, b, c, u, v + 1))))
    ax = V[5]   # eixo de 5 dobras (vértice) -> giro de 72° fecha o laço
    def rot(p, ang):
        c, s = math.cos(ang), math.sin(ang); d_ = sum(p[t] * ax[t] for t in range(3)); cr = (ax[1] * p[2] - ax[2] * p[1], ax[2] * p[0] - ax[0] * p[2], ax[0] * p[1] - ax[1] * p[0])
        return tuple(p[t] * c + cr[t] * s + ax[t] * d_ * (1 - c) for t in range(3))
    tilt = lambda p: (p[0], p[1] * math.cos(0.5) - p[2] * math.sin(0.5), p[1] * math.sin(0.5) + p[2] * math.cos(0.5))
    out = []
    for k in range(n):
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im); R = S * 0.47
        q = {key: tilt(rot(p, k * (2 * math.pi / 5) / n)) for key, p in pts.items()}
        for e in sorted(edges, key=lambda e: sum(q[x][2] for x in e)):
            a, b = tuple(e); za = (q[a][2] + q[b][2]) / 2; al = int(70 + 120 * (za + 1) / 2)
            d.line([(S / 2 + q[a][0] * R, S / 2 + q[a][1] * R), (S / 2 + q[b][0] * R, S / 2 + q[b][1] * R)], fill=(110, 160, 215, al), width=1)
        out.append(im)
    return out

def gen_textures():
    from PIL import Image, ImageDraw
    out = os.path.join(PACK, TEX); os.makedirs(out, exist_ok=True)
    made = set()
    def save(img, name, nine=None):
        p = os.path.join(out, name + ".png"); img.save(p, optimize=True); made.add(name)
        if nine is not None:
            w, h = img.size
            open(os.path.join(out, name + ".json"), "w").write(json.dumps({"nineslice_size": nine, "base_size": [w, h]}) + "\n")
        elif os.path.exists(os.path.join(out, name + ".json")): os.remove(os.path.join(out, name + ".json"))
    # fundo: mundo escurecido, brilho verde no centro, grade hexagonal fraca, vinheta
    W, H = 320, 180; bg = Image.new("RGBA", (W, H)); px = bg.load()
    for y in range(H):
        for x in range(W):
            dx, dy = (x - W / 2) / (W / 2), (y - H / 2) / (H / 2); d = min(1.0, math.sqrt(dx * dx * 0.8 + dy * dy))
            g = int(34 * (1 - d) ** 1.4); a = int(255 * (0.64 + 0.28 * d ** 1.6))
            if (x % 16 == 0 or y % 16 == 0) and d < 0.95: g += 10; a = min(255, a + 6)
            px[x, y] = (0, g + 4, int(g * 0.72) + 3, a)
    save(bg, "sg_bg")
    def box(w, h, fill, line, corner, r=0, ins=0, clen=4, thick=1):
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle([ins, ins, w - 1 - ins, h - 1 - ins], radius=r, fill=fill, outline=line, width=thick)
        if corner:
            for (cx, cy, sx, sy) in [(ins, ins, 1, 1), (w - 1 - ins, ins, -1, 1), (ins, h - 1 - ins, 1, -1), (w - 1 - ins, h - 1 - ins, -1, -1)]:
                for t in range(2):
                    d.line([cx + sx * t, cy, cx + sx * t, cy + sy * clen], fill=corner); d.line([cx, cy + sy * t, cx + sx * clen, cy + sy * t], fill=corner)
        return im
    save(box(48, 48, None, (60, 225, 190, 150), (170, 255, 230, 255), ins=3, clen=11), "sg_frame", 12)
    save(box(32, 32, (2, 22, 16, 205), (50, 205, 170, 220), (150, 255, 225, 255), ins=0, clen=6), "sg_panel", 8)
    save(box(64, 18, (3, 34, 30, 225), (90, 240, 220, 255), None, r=7, thick=1), "sg_title", 8)
    save(box(32, 16, (2, 26, 20, 225), (90, 240, 210, 230), (170, 255, 230, 255), clen=3), "sg_bubble", 5)
    for name, fill, line in [("sg_btn", (196, 240, 222, 238), (28, 160, 138, 255)), ("sg_btn_h", (150, 255, 228, 250), (0, 205, 175, 255)), ("sg_btn_p", (112, 216, 190, 255), (0, 140, 118, 255))]:
        im = box(32, 16, fill, line, (235, 255, 250, 255), clen=3)
        ImageDraw.Draw(im).line([2, 1, 29, 1], fill=(255, 255, 255, 120)); save(im, name, 4)
    # cortinas da "digitação": cobrem o texto e escorregam para fora, com a linha de cursor brilhante na borda
    # (alongadas: a linha do cursor fica fina mesmo esticada no painel inteiro)
    cv = Image.new("RGBA", (4, 256), (2, 19, 14, 255)); ImageDraw.Draw(cv).rectangle([0, 0, 3, 2], fill=(130, 255, 225, 255)); save(cv, "sg_curtain_v")
    ch = Image.new("RGBA", (128, 8), (3, 33, 29, 255)); ImageDraw.Draw(ch).rectangle([0, 1, 1, 6], fill=(150, 255, 235, 255)); save(ch, "sg_curtain_h")
    # anel do retrato (marcas a cada 30°)
    R = 64; ring = Image.new("RGBA", (R, R), (0, 0, 0, 0)); d = ImageDraw.Draw(ring)
    d.ellipse([3, 3, R - 4, R - 4], outline=(110, 250, 220, 255), width=2); d.ellipse([8, 8, R - 9, R - 9], outline=(60, 200, 170, 150), width=1)
    for k in range(12):
        a = k * math.pi / 6; c, s = math.cos(a), math.sin(a)
        d.line([R / 2 + c * 25, R / 2 + s * 25, R / 2 + c * 30, R / 2 + s * 30], fill=(170, 255, 235, 255), width=1)
    save(ring, "sg_ring")
    # 8.9b ---- reencarnação IDÊNTICA ao vídeo (cores medidas por amostragem de pixels nos quadros 259-290 s do vídeo de referência):
    # céu = degradê vertical (10,33,62) no alto -> (4,18,36) embaixo, com um clarão fraco no alto à esquerda; estrelas = pontinhos/tracinhos brancos
    import random
    rnd = random.Random(89); SW, SH = 384, 216; sky = Image.new("RGBA", (SW, SH)); px = sky.load()
    for y in range(SH):
        for x in range(SW):
            v = y / (SH - 1); g_ = max(0.0, 1 - math.hypot((x - SW * 0.3) / SW, (y - SH * 0.2) / SH) * 1.6)
            px[x, y] = (int(10 - 6 * v + 6 * g_), int(33 - 15 * v + 10 * g_), int(62 - 26 * v + 14 * g_), 255)
    d = ImageDraw.Draw(sky)
    for _ in range(230):
        x, y = rnd.randrange(SW), rnd.randrange(SH); v = rnd.choice([120, 160, 200, 255])
        d.point((x, y), fill=(v, v, min(255, v + 20), 255))
        if v == 255 and rnd.random() < 0.3: d.point((x + 1, y), fill=(200, 210, 255, 255))
    for _ in range(14):   # tracinhos (como no vídeo)
        x, y = rnd.randrange(SW - 4), rnd.randrange(SH); d.line([x, y, x + rnd.choice([2, 3]), y], fill=(235, 240, 255, 255))
    save(sky, "sg_stars")
    tw_ = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); tp = tw_.load()
    for y in range(16):
        for x in range(16):
            r_ = math.hypot(x - 7.5, y - 7.5); a = max(0.0, 1 - r_ / 7.5) ** 2.2
            if abs(x - 7.5) < 1 or abs(y - 7.5) < 1: a = max(a, max(0.0, 1 - r_ / 8) * 0.8)
            tp[x, y] = (235, 242, 255, int(255 * min(1.0, a * 1.4)))
    save(tw_, "sg_twinkle")
    # cartão do vídeo: preto opaco (0,0,3), borda branca fina (228,240,255), cantos arredondados; moldura do retrato cinza (92,93,102);
    # SELECT = retângulo preto de borda branca (toque/realce = verde-azulado escuro (30,55,56), medido nos quadros 283/285 s)
    save(box(32, 32, (0, 0, 3, 255), (228, 240, 255, 255), None, r=5), "sg_card", 8)
    save(box(32, 32, (8, 26, 50, 30), (143, 161, 187, 255), None, r=5), "sg_card_side", 8)       # cartões vizinhos: só o contorno (143,161,187)
    save(box(32, 32, (24, 48, 80, 110), (226, 234, 255, 255), None, r=5), "sg_card_side_h", 8)
    save(box(32, 32, (30, 55, 56, 160), (255, 255, 255, 255), None, r=5), "sg_card_side_p", 8)
    save(box(24, 24, (0, 0, 0, 255), (92, 93, 102, 255), None, r=5), "sg_pframe", 7)
    save(box(24, 12, (0, 0, 0, 255), (232, 234, 237, 255), None, r=3), "sg_pill", 4)
    save(box(24, 12, (30, 55, 56, 255), (240, 244, 246, 255), None, r=3), "sg_pill_h", 4)
    save(box(24, 12, (44, 80, 82, 255), (255, 255, 255, 255), None, r=3), "sg_pill_p", 4)
    save(box(24, 12, (0, 0, 0, 120), (150, 160, 185, 200), None, r=3), "sg_pill_dim", 4)
    for k, (_, _, rgb) in enumerate(DIFF):   # selo "Hard" do vídeo: miolo escuro tingido, borda clara tingida, texto na cor
        fill = tuple(int(c * 0.28) for c in rgb) + (255,); line = tuple(int(c * 0.45 + 255 * 0.55) for c in rgb) + (255,)
        save(box(24, 10, fill, line, None, r=4), f"sg_badge{k}", 4)
    save(box(16, 16, None, (235, 238, 245, 255), None), "sg_thin", 3)
    for nm, pts in {"tl": [(0, 15), (0, 0), (15, 0)], "tr": [(0, 0), (15, 0), (15, 15)], "bl": [(0, 0), (0, 15), (15, 15)], "br": [(0, 15), (15, 15), (15, 0)]}.items():
        bk = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); ImageDraw.Draw(bk).line(pts, fill=(96, 96, 102, 255), width=1); save(bk, f"sg_brk_{nm}")   # cantoneiras do quadro preto
    # "A Ampulheta": hexágono quase invisível + brilho azul no centro (como no quadro de 265.5 s)
    hx = Image.new("RGBA", (128, 128), (0, 0, 0, 0)); d = ImageDraw.Draw(hx)
    d.polygon([(64 + 61 * math.cos(math.pi / 6 + k * math.pi / 3), 64 + 61 * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)], outline=(80, 120, 170, 46))
    d.line([(64, 3), (64, 125)], fill=(80, 120, 170, 22)); save(hx, "sg_hex")
    gl = Image.new("RGBA", (64, 64)); gp = gl.load()
    for y in range(64):
        for x in range(64):
            a = max(0.0, 1 - math.hypot(x - 31.5, (y - 31.5) * 1.15) / 31.5) ** 1.8; gp[x, y] = (40, 96, 180, int(150 * a))
    save(gl, "sg_glow")
    # esfera final: geodésica de linhas finas (icosaedro subdividido 3x), 12 quadros girando 72° (volta perfeita) -> sg_geo_0..11
    for k, im_ in enumerate(geodesic_frames(12, 384)): save(im_, f"sg_geo_{k}")
    # assinatura branca ("Sorteio." = o desenho no quadro preto do vídeo)
    sg = Image.new("RGBA", (200, 90), (0, 0, 0, 0)); d = ImageDraw.Draw(sg); pts = []
    for k in range(240):
        t = k / 239; x = 18 + 150 * t; y = 64 - 30 * math.sin(t * math.pi * 3.2) * (0.6 + 0.4 * math.sin(t * 7)) - 14 * t
        if 0.42 < t < 0.55: y -= 18 * math.sin((t - 0.42) / 0.13 * math.pi)
        pts.append((x, y))
    d.line(pts, fill=(235, 238, 245, 255), width=3, joint="curve"); d.ellipse([166, 10, 176, 20], fill=(255, 255, 255, 255))
    save(sg, "sg_sign")
    # faixa vermelha (medida em 270 s): bordas (81,7,9) -> meio (145,14,21) na vertical, clarão elíptico (233,35,37) no centro, filete claro em cima/embaixo
    BW, BH = 256, 64; bn = Image.new("RGBA", (BW, BH)); bp = bn.load()
    for y in range(BH):
        for x in range(BW):
            v = 1 - abs(y - (BH - 1) / 2) / ((BH - 1) / 2); base = (81 + 64 * v, 7 + 7 * v, 9 + 12 * v)
            g_ = math.exp(-(((x - BW * 0.5) / (BW * 0.2)) ** 2 + ((y - BH * 0.5) / (BH * 0.16)) ** 2))
            bp[x, y] = (min(255, int(base[0] + (233 - base[0]) * g_)), int(base[1] + (35 - base[1]) * g_), int(base[2] + (37 - base[2]) * g_), 255)
    for x in range(BW): bp[x, 0] = bp[x, BH - 1] = (176, 52, 58, 255)
    save(bn, "sg_banner")
    # 8.9b ---- JANELA TENSURA (menus "Magic"/"Status Menu" do vídeo, 316/318 s): painel azul-marinho (32,43,64) de borda preta + filete
    # (82,90,114), seção esquerda (24,33,52), seção direita com moldura cinza chanfrada (154,159,172)/(80,80,80) e miolo (25,28,39),
    # campo cinza "Preset 1", caixas (4,26,45)/(38,56,76), abas (34,46,80) e ícones redondos com aro octogonal
    def bevel(w, h, layers, fill):
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im); i = 0
        for (col, t) in layers:
            for _ in range(t): d.rectangle([i, i, w - 1 - i, h - 1 - i], outline=col); i += 1
        d.rectangle([i, i, w - 1 - i, h - 1 - i], fill=fill); return im
    save(bevel(32, 32, [((0, 2, 8, 255), 1), ((82, 90, 114, 255), 1)], (32, 43, 64, 250)), "tz_win", 6)
    save(bevel(32, 32, [((14, 19, 32, 255), 1)], (24, 33, 52, 255)), "tz_left", 4)
    save(bevel(32, 32, [((154, 159, 172, 255), 1), ((80, 80, 82, 255), 3), ((39, 43, 49, 255), 1)], (25, 28, 39, 255)), "tz_right", 8)
    fld = bevel(24, 12, [((150, 150, 156, 255), 1)], (84, 84, 88, 255)); ImageDraw.Draw(fld).line([(0, 0), (23, 0)], fill=(48, 48, 52, 255)); ImageDraw.Draw(fld).line([(0, 0), (0, 11)], fill=(48, 48, 52, 255)); save(fld, "tz_field", 3)
    save(bevel(24, 24, [((38, 56, 76, 255), 1)], (4, 26, 45, 255)), "tz_box", 4)
    save(bevel(10, 10, [((36, 36, 40, 255), 1)], (92, 92, 96, 255)), "tz_num", 3)
    save(bevel(10, 10, [((36, 36, 40, 255), 1)], (70, 150, 78, 255)), "tz_num_on", 3)
    save(bevel(24, 24, [((0, 2, 8, 255), 1), ((82, 90, 114, 255), 1)], (34, 46, 80, 255)), "tz_tab", 5)
    tab_on = bevel(24, 24, [((0, 2, 8, 255), 1), ((82, 90, 114, 255), 1)], (32, 43, 64, 255)); ImageDraw.Draw(tab_on).rectangle([2, 21, 21, 23], fill=(32, 43, 64, 255)); save(tab_on, "tz_tab_on", 5)
    for nm, fill in [("tz_row", (178, 180, 186)), ("tz_row_h", (208, 211, 218)), ("tz_row_p", (150, 152, 160))]:   # linhas da lista "Creator" (cinza claro)
        rw = bevel(32, 16, [((30, 30, 34, 255), 1)], fill + (255,)); ImageDraw.Draw(rw).line([(1, 1), (30, 1)], fill=(232, 232, 238, 255)); save(rw, nm, 3)
    ob = Image.new("RGBA", (48, 48), (0, 0, 0, 0)); ImageDraw.Draw(ob).ellipse([2, 2, 45, 45], fill=(12, 16, 28, 255)); save(ob, "tz_orb_bg")
    oc = lambda ap: [(24 + ap / math.cos(math.pi / 8) * math.cos(math.pi / 8 + k * math.pi / 4), 24 + ap / math.cos(math.pi / 8) * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
    orb = Image.new("RGBA", (48, 48), (0, 0, 0, 0)); d = ImageDraw.Draw(orb)
    d.polygon(oc(23.5), fill=(8, 8, 16, 255)); d.polygon(oc(22.5), fill=(150, 170, 215, 255)); d.polygon(oc(20), fill=(92, 112, 165, 255)); d.polygon(oc(18), fill=(8, 8, 16, 255))
    m = Image.new("L", (48, 48), 0); ImageDraw.Draw(m).polygon(oc(17), fill=255); al = orb.split()[3]; al.paste(0, mask=m); orb.putalpha(al); save(orb, "tz_orb")
    # retratos de corpo inteiro (tools/race_portraits.py), recortados no corpo (proporção 1:2) para encher a moldura como no vídeo
    import race_portraits
    for rid in RACE_CODES:
        pim = race_portraits.portrait(rid); bb = pim.getbbox() or (0, 0) + pim.size
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2; w2 = max(bb[2] - bb[0] + 4, (bb[3] - bb[1] + 6) / 2); h2 = 2 * w2
        crop = Image.new("RGBA", (int(w2), int(h2)), (0, 0, 0, 0)); crop.alpha_composite(pim.crop((int(cx - w2 / 2), int(cy - h2 / 2), int(cx - w2 / 2) + int(w2), int(cy - h2 / 2) + int(h2))))
        crop.save(os.path.join(out, f"race_{rid}.png"), optimize=True); made.add(f"race_{rid}")
    # limpeza: texturas de versões antigas que nada mais usa (o pacote fica só com o que o server_form.json referencia)
    for fn in os.listdir(out):
        stem, ext = os.path.splitext(fn)
        if ext in (".png", ".json") and stem not in made: os.remove(os.path.join(out, fn))
    # ícone do pacote
    ic = Image.new("RGBA", (128, 128), (2, 14, 10, 255)); d = ImageDraw.Draw(ic)
    d.rectangle([4, 4, 123, 123], outline=(80, 235, 200, 255), width=3)
    ico = os.path.join(MAIN_RP, "textures/ui/etheria/sg_ico_0.png")
    if os.path.exists(ico):
        g = Image.open(ico).convert("RGBA").resize((96, 96), Image.NEAREST); r_, g_, b_, a_ = g.split()
        tint = Image.merge("RGBA", (r_.point(lambda v: v * 120 // 255), g_.point(lambda v: v), b_.point(lambda v: v * 215 // 255), a_.point(lambda v: min(255, v * 3))))
        ic.alpha_composite(tint, (16, 16))
    ic.alpha_composite(ring.resize((76, 76), Image.NEAREST), (26, 26))
    ic.save(os.path.join(PACK, "pack_icon.png"), optimize=True)

def gen_manifest():
    m = {"format_version": 2, "header": {"name": "§aLegacy of Etheria §2Sábio UI", "description": "OPCIONAL: telas no estilo do Grande Sábio (raça, evolução, habilidades, Livro do Sábio). Coloque ACIMA do pacote principal. Se algo der errado, desative só este pacote.",
         "uuid": HEADER_UUID, "version": [1, 0, 0], "min_engine_version": [1, 21, 80]},
         "modules": [{"type": "resources", "uuid": MODULE_UUID, "version": [1, 0, 0]}]}
    os.makedirs(PACK, exist_ok=True)
    open(os.path.join(PACK, "manifest.json"), "w", encoding="utf8").write(json.dumps(m, ensure_ascii=False, indent=1) + "\n")

# ------------------------------------------------------------------ JSON UI
def anims():
    A = {}
    for k in range(12):   # icosaedro: 12 quadros (sg_ico_0..11 do pacote principal) acendendo em sequência = rotação
        A[f"eth_sgx{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 0.12, "next": f"@{NS}.eth_sgx{k}_in"}
        A[f"eth_sgx{k}_in"] = {"anim_type": "alpha", "easing": "linear", "from": 0.0, "to": 0.95, "duration": 0.12, "next": f"@{NS}.eth_sgx{k}_out"}
        A[f"eth_sgx{k}_out"] = {"anim_type": "alpha", "easing": "linear", "from": 0.95, "to": 0.0, "duration": 0.12, "next": f"@{NS}.eth_sgx{k}_wait"}
        A[f"eth_sgx{k}_wait"] = {"anim_type": "wait", "duration": 1.2, "next": f"@{NS}.eth_sgx{k}_in"}
    # "digitação": cortina parada um instante e depois escorrega para fora (uma vez só, a cada abertura do formulário)
    A["eth_sg_type_v_start"] = {"anim_type": "wait", "duration": 0.25, "next": f"@{NS}.eth_sg_type_v"}
    A["eth_sg_type_v"] = {"anim_type": "offset", "easing": "linear", "from": [0, 0], "to": [0, "100%"], "duration": 1.8}
    A["eth_sg_type_h_start"] = {"anim_type": "wait", "duration": 0.1, "next": f"@{NS}.eth_sg_type_h"}
    A["eth_sg_type_h"] = {"anim_type": "offset", "easing": "linear", "from": [0, 0], "to": ["100%", 0], "duration": 0.7}
    A["eth_sg_glow_a"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 0.55, "to": 1.0, "duration": 0.9, "next": f"@{NS}.eth_sg_glow_b"}
    A["eth_sg_glow_b"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 1.0, "to": 0.55, "duration": 0.9, "next": f"@{NS}.eth_sg_glow_a"}
    return A

def img(tex, size, **kw): return {"type": "image", "texture": tex, "size": size, **kw}
def backdrop():
    """fundo comum das telas do Sábio: mundo escurecido + brilho verde, partículas, varredura e moldura de cantos"""
    return [
        {"sg_bg": img(T("sg_bg"), ["100%", "100%"], keep_ratio=False, fill=True, layer=1)},
        {"sg_motes": img("textures/ui/etheria/ov_motes_0", ["100%", "100%"], keep_ratio=False, color=GREEN, alpha=0.0, layer=2, anims=[f"@{NS}.eth_mote0_start", f"@{NS}.eth_motea0_start"])},
        {"sg_scan": img("textures/ui/etheria/ov_scan", ["100%", 6], keep_ratio=False, anchor_from="top_middle", anchor_to="top_middle", color=GREEN, alpha=0.45, layer=3, anims=[f"@{NS}.eth_scan_r"])},
        {"sg_frame": img(T("sg_frame"), ["100% - 6px", "100% - 6px"], anchor_from="center", anchor_to="center", layer=4, alpha=1.0, anims=[f"@{NS}.eth_sg_glow_a"])},
        {"sg_head": {"type": "label", "text": "§l[ GRANDE SÁBIO ]", "anchor_from": "top_left", "anchor_to": "top_left", "offset": [10, 7], "size": ["default", 10], "color": GREEN, "shadow": True, "layer": 6}},
        {"close@common.close_button": {"anchor_from": "top_right", "anchor_to": "top_right", "offset": [-6, 5], "layer": 12}},
    ]
def curtain_v(layer=20):
    return {"sg_type": {"type": "panel", "size": ["100%", "100%"], "clips_children": True, "layer": layer, "controls": [
        {"cur": img(T("sg_curtain_v"), ["100%", "100%"], keep_ratio=False, anchor_from="top_left", anchor_to="top_left", layer=1, anims=[f"@{NS}.eth_sg_type_v_start"])}]}}
def curtain_h(layer=20):
    return {"sg_type_t": {"type": "panel", "size": ["100%", "100%"], "clips_children": True, "layer": layer, "controls": [
        {"cur": img(T("sg_curtain_h"), ["100%", "100%"], keep_ratio=False, anchor_from="top_left", anchor_to="top_left", layer=1, anims=[f"@{NS}.eth_sg_type_h_start"])}]}}
def scroll(content): return {"$show_background": False, "size": ["100%", "100%"], "$scrolling_content": content, "$scroll_size": [5, "100% - 4px"], "$scrolling_pane_size": ["100% - 4px", "100% - 2px"], "$scrolling_pane_offset": [2, 0], "$scroll_bar_right_padding_size": [0, 0]}
def text_panel(size, anchor, offset, layer=5):
    """painel holográfico com a ficha (#form_text) rolável e a cortina de digitação por cima"""
    return {"type": "panel", "size": size, "anchor_from": anchor, "anchor_to": anchor, "offset": offset, "layer": layer, "controls": [
        {"plate": img(T("sg_panel"), ["100%", "100%"], layer=1)},
        {"body": {"type": "panel", "size": ["100% - 6px", "100% - 6px"], "anchor_from": "center", "anchor_to": "center", "layer": 2, "controls": [
            {"scroll@common.scrolling_panel": dict(scroll(f"{NS}.eth_text_content"), layer=2)}, curtain_v()]}}]}
def title_band(size, anchor, offset, layer=6, font="large"):
    """faixa do título (#title_text grande) com a cortina horizontal (o nome 'digita')"""
    return {"type": "image", "texture": T("sg_title"), "size": size, "anchor_from": anchor, "anchor_to": anchor, "offset": offset, "layer": layer, "controls": [
        {"name": {"type": "label", "text": "#title_text", "bindings": [{"binding_name": "#title_text"}], "size": ["100% - 14px", "default"], "anchor_from": "center", "anchor_to": "center",
                  "text_alignment": "center", "font_size": font, "color": [1, 1, 1], "shadow": True, "layer": 2}},
        {"clip": {"type": "panel", "size": ["100% - 4px", "100% - 4px"], "anchor_from": "center", "anchor_to": "center", "layer": 3, "controls": [curtain_h(1)]}}]}
def sg_button(row_h, btn_h, text_max_h):
    """botão do Sábio = o MESMO light_text_button da coleção form_buttons do cartão/formulário original, só com as texturas trocadas"""
    return {"type": "panel", "size": ["100%", row_h], "controls": [
        {"form_button@common_buttons.light_text_button": {"$pressed_button_name": "button.form_button_click", "anchor_from": "center", "anchor_to": "center", "size": ["100% - 4px", btn_h],
            "$button_text": "#form_button_text", "$button_text_binding_type": "collection", "$button_text_grid_collection_name": "form_buttons", "$button_text_max_size": ["100% - 6px", text_max_h],
            "$default_button_texture": T("sg_btn"), "$hover_button_texture": T("sg_btn_h"), "$pressed_button_texture": T("sg_btn_p"),
            "$default_text_color": [0.02, 0.2, 0.14], "$hover_text_color": [0.0, 0.1, 0.07], "$pressed_text_color": [0.0, 0.1, 0.07], "$border_visible": False,
            "bindings": [{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}]}}]}
def button_list(row):
    return {"type": "stack_panel", "orientation": "vertical", "size": ["100% - 4px", "100%c"], "anchor_from": "top_left", "anchor_to": "top_left", "offset": [2, 2],
            "factory": {"name": "buttons", "control_name": f"{NS}.{row}"}, "collection_name": "form_buttons",
            "bindings": [{"binding_name": "#form_button_length", "binding_name_override": "#collection_length"}]}

# ------------------------------------------------------------------ 8.9b: reencarnação IDÊNTICA ao vídeo (abertura, carrossel, esfera final)
# Medidas tiradas dos quadros do vídeo de referência (videos_unidos_1, 255-292 s) em % da ALTURA da tela (o vídeo corta as laterais, a
# altura é a única régua confiável): cartão = tela inteira de altura e 61% da altura de largura; retrato em 5.3%/4.6% do cartão com
# 40.3% x 84.5%; texto a partir de 50.4% da largura e 9.2% da altura; selo em 50.6%/5.5% (13% x 2.7%); SELECT com 82.8% x 4.4% a 5.1%
# da base; cartões vizinhos = 56.6% do cartão, vão de 4.6% da largura do cartão, 2% acima do centro; legenda = barra preta de 4.2% na base.
TWK = [(6, 12, 7), (18, 70, 5), (27, 30, 6), (38, 86, 5), (47, 8, 7), (58, 62, 5), (66, 22, 6), (74, 80, 7), (83, 44, 5), (92, 14, 6), (12, 44, 5), (88, 90, 5)]
CAP_TXT = [0.88, 0.89, 0.92]
CARD_MARK = ["<", "ESCOLHER", ">"]   # texto dos 3 botões do cartão (systems/ui/racemenus.js openRacePickV2), nesta ordem
def fade(name, t_in, t_out=None, a=1.0, fd=0.35):
    """cadeia de alpha: espera t_in, aparece em fd s, (some em t_out). O controle começa com alpha 0."""
    A = {f"{name}_w": {"anim_type": "wait", "duration": max(0.001, t_in), "next": f"@{NS}.{name}_i"},
         f"{name}_i": {"anim_type": "alpha", "easing": "linear", "from": 0.0, "to": a, "duration": fd}}
    if t_out is not None:
        A[f"{name}_i"]["next"] = f"@{NS}.{name}_h"
        A[f"{name}_h"] = {"anim_type": "wait", "duration": max(0.001, t_out - t_in - 2 * fd), "next": f"@{NS}.{name}_o"}
        A[f"{name}_o"] = {"anim_type": "alpha", "easing": "linear", "from": a, "to": 0.0, "duration": fd}
    return A
def reinc_anims():
    A = {}
    for v, dur in enumerate([0.8, 1.25, 1.7]):   # cintilar das estrelas (3 ritmos)
        A[f"eth_sgtw_v{v}_a"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 0.08, "to": 1.0, "duration": dur, "next": f"@{NS}.eth_sgtw_v{v}_b"}
        A[f"eth_sgtw_v{v}_b"] = {"anim_type": "alpha", "easing": "in_out_sine", "from": 1.0, "to": 0.08, "duration": dur, "next": f"@{NS}.eth_sgtw_v{v}_a"}
    for k in range(len(TWK)): A[f"eth_sgtw{k}"] = {"anim_type": "wait", "duration": round(0.001 + (k * 0.37) % 1.6, 3), "next": f"@{NS}.eth_sgtw_v{k % 3}_a"}
    # abertura: a MESMA ordem e as mesmas durações das partes do vídeo (legenda 1.25 s, assinatura desenhada em 2.3 s, "A Ampulheta" junto
    # com "Aptidão encontrada.", faixa entrando da esquerda em 0.4 s), sem os 5 s de quadro vazio, para caber nos 9.5 s da cena (autoTicks 190)
    A["eth_sgi_fr_w"] = {"anim_type": "wait", "duration": 4.5, "next": f"@{NS}.eth_sgi_fr_o"}
    A["eth_sgi_fr_o"] = {"anim_type": "alpha", "easing": "linear", "from": 1.0, "to": 0.0, "duration": 0.3}
    A["eth_sgi_sign_w"] = {"anim_type": "wait", "duration": 2.0, "next": f"@{NS}.eth_sgi_sign"}
    A["eth_sgi_sign"] = {"anim_type": "offset", "easing": "linear", "from": [0, 0], "to": ["100%", 0], "duration": 2.3}
    A.update(fade("eth_sgi_l1", 0.15, 1.4, fd=0.2)); A.update(fade("eth_sgi_l2", 1.5, 2.75, fd=0.2)); A.update(fade("eth_sgi_l3", 4.8, 6.5, fd=0.2))
    A.update(fade("eth_sgi_hg", 4.8, 6.6, fd=0.25)); A.update(fade("eth_sgi_hs", 5.6, 6.6, a=0.85, fd=0.25))
    A.update(fade("eth_sgi_bn", 6.9, fd=0.2)); A.update(fade("eth_sgi_bs", 7.3, a=0.95))
    A["eth_sgi_slide_w"] = {"anim_type": "wait", "duration": 6.9, "next": f"@{NS}.eth_sgi_slide"}
    A["eth_sgi_slide"] = {"anim_type": "offset", "easing": "out_cubic", "from": ["-100%", "-11.5%"], "to": [0, "-11.5%"], "duration": 0.4}
    A.update(fade("eth_sgi_skip", 0.6, a=0.85))
    # final: esfera geodésica (71% da altura, 8.8% acima do centro) gira devagar; legendas na barra preta
    A["eth_sgo_grow"] = {"anim_type": "size", "easing": "out_cubic", "from": ["100%y", "8%"], "to": ["100%y", "71%"], "duration": 0.7}
    for k in range(12):   # 12 quadros da geodésica, 0.25 s cada (volta de 72° em 3 s)
        A[f"eth_sgg{k}_start"] = {"anim_type": "wait", "duration": 0.001 + k * 0.25, "next": f"@{NS}.eth_sgg{k}_in"}
        A[f"eth_sgg{k}_in"] = {"anim_type": "alpha", "easing": "linear", "from": 0.0, "to": 1.0, "duration": 0.25, "next": f"@{NS}.eth_sgg{k}_out"}
        A[f"eth_sgg{k}_out"] = {"anim_type": "alpha", "easing": "linear", "from": 1.0, "to": 0.0, "duration": 0.25, "next": f"@{NS}.eth_sgg{k}_wait"}
        A[f"eth_sgg{k}_wait"] = {"anim_type": "wait", "duration": 2.5, "next": f"@{NS}.eth_sgg{k}_in"}
    A.update(fade("eth_sgo_l1", 0.2, 1.5, fd=0.2)); A.update(fade("eth_sgo_l2", 1.6, 3.6, fd=0.2)); A.update(fade("eth_sgo_l3", 3.7, 5.1, fd=0.2)); A.update(fade("eth_sgo_l4", 5.2, fd=0.2))
    A.update(fade("eth_sgo_skip", 1.0, a=0.85))
    return A
def stars():
    """fundo das telas da reencarnação: céu azul-marinho (textura) + estrelas que cintilam (poucos controles, só alpha)"""
    return [{"st_bg": img(T("sg_stars"), ["100%", "100%"], keep_ratio=False, fill=True, layer=1)}] + [
        {f"tw{k}": img(T("sg_twinkle"), [sz, sz], anchor_from="top_left", anchor_to="top_left", offset=[f"{x}%", f"{y}%"], alpha=0.08, layer=2, anims=[f"@{NS}.eth_sgtw{k}"])}
        for k, (x, y, sz) in enumerate(TWK)]
def lbl(text, scale=1.0, color=None, **kw):
    L = {"type": "label", "text": text, "size": ["default", "default"], "color": color or [1, 1, 1], "font_scale_factor": scale, **kw}
    if text.startswith("#"): L["bindings"] = [{"binding_name": text}]
    return L
def legend(text, bindings=None, anim=None):
    """legenda do vídeo: barra preta de 4.2% da altura colada na base, texto claro centralizado (barra e texto aparecem/somem juntos)"""
    t = lbl(text, 0.62, CAP_TXT, anchor_from="center", anchor_to="center", offset=[0, "6%"], layer=1)
    L = img("textures/ui/Black", ["100%", "4.2%"], keep_ratio=False, anchor_from="bottom_middle", anchor_to="bottom_middle", layer=30, controls=[{"t": t}])
    if bindings: L["bindings"] = bindings
    if anim:
        for c in (L, t): c["alpha"] = 0.0; c["anims"] = [f"@{NS}.{anim}_w"]
    return L
def tap_row(anim):
    """botão único da cena ("Pular »" / "Continuar »") discreto no canto inferior direito, sobre a barra da legenda"""
    return {"type": "stack_panel", "orientation": "horizontal", "size": ["100%c", "4.2%"], "anchor_from": "bottom_right", "anchor_to": "bottom_right", "offset": [-4, 0], "layer": 40,
            "alpha": 0.0, "anims": [f"@{NS}.{anim}_w"], "factory": {"name": "buttons", "control_name": f"{NS}.eth_sg_tap_btn"}, "collection_name": "form_buttons",
            "bindings": [{"binding_name": "#form_button_length", "binding_name_override": "#collection_length"}]}
def text_btn(size, af, at, offset, tex, txt=(1, 1, 1), scale=0.62, max_size=("100% - 4px", "100%"), **extra):
    """o MESMO light_text_button da coleção form_buttons (padrão do cartão original), com texturas próprias e escala de fonte do jogo"""
    B = {"$pressed_button_name": "button.form_button_click", "size": size, "anchor_from": af, "anchor_to": at, "offset": offset,
         "$button_text": "#form_button_text", "$button_text_binding_type": "collection", "$button_text_grid_collection_name": "form_buttons", "$button_text_max_size": list(max_size),
         "$button_font_scale_factor": scale, "$default_button_texture": T(tex), "$hover_button_texture": T(tex + "_h"), "$pressed_button_texture": T(tex + "_p"),
         "$default_text_color": list(txt), "$hover_text_color": [1, 1, 1], "$pressed_text_color": [1, 1, 1], "$border_visible": False,
         "bindings": [{"binding_type": "collection_details", "binding_collection_name": "form_buttons"}], **extra}
    return {"form_button@common_buttons.light_text_button": B}
def card_variant(k, marker, inner):
    """variante da linha da fábrica do cartão. Cada botão do formulário vira uma linha do tamanho do CARTÃO numa pilha horizontal
    (linha k começa k cartões à direita); a variante só aparece se o texto do botão (#form_button_text) tiver o marcador e volta k
    larguras para a esquerda, então tudo dentro dela se posiciona em % do próprio cartão. Mesmo padrão de binding do dynamic_button do jogo
    (binding "collection" num filho da linha + binding "view" para #visible)."""
    return {f"v{k}": {"type": "panel", "size": ["100%", "100%"], "offset": [f"-{k * 100}%" if k else 0, 0], "controls": [inner], "bindings": [
        {"binding_type": "collection", "binding_collection_name": "form_buttons", "binding_name": "#form_button_text"},
        {"binding_type": "view", "source_property_name": f"(not ((#form_button_text - '{marker}') = #form_button_text))", "target_property_name": "#visible"}]}}
def reinc_defs():
    D = reinc_anims()
    # ficha do cartão: o mesmo #form_text, em letra pequena como no vídeo (texto ~23 letras por linha na coluna da direita)
    D["eth_sg_card_text"] = {"type": "stack_panel", "size": ["100% - 2px", "100%c"], "orientation": "vertical", "anchor_from": "top_left", "anchor_to": "top_left", "controls": [
        {"text_panel": {"type": "panel", "size": ["100%", "100%c"], "controls": [
            {"main_label": {"type": "label", "offset": [0, 0], "color": [1, 1, 1], "size": ["100%", "default"], "anchor_from": "top_left", "anchor_to": "top_left", "text": "#form_text", "font_scale_factor": 0.55}}]}},
        {"pad_bottom": {"type": "panel", "size": ["100%", 6]}}]}
    side = lambda k, af, at, dx: text_btn(["56.6%", "56.6%"], af, at, [dx, "-2%"], "sg_card_side", txt=(0.36, 0.45, 0.6), scale=1.0)
    D["eth_sg_card_row"] = {"type": "panel", "size": ["100%", "100%"], "controls": [
        card_variant(0, CARD_MARK[0], side(0, "left_middle", "right_middle", "-4.6%")),                    # cartão vizinho da esquerda = raça anterior
        card_variant(1, CARD_MARK[1], text_btn(["82.8%", "4.4%"], "bottom_middle", "bottom_middle", [0, "-5.1%"], "sg_pill", scale=0.62)),   # ESCOLHER
        card_variant(2, CARD_MARK[2], side(2, "right_middle", "left_middle", "4.6%"))]}                    # cartão vizinho da direita = próxima raça
    D["eth_sg_tap_btn"] = {"type": "panel", "size": ["22%y", "100%"], "controls": [text_btn(["100%", "80%"], "center", "center", [0, 0], "sg_pill_dim", txt=(0.86, 0.9, 0.97), scale=0.55)]}
    fr = lambda: [f"@{NS}.eth_sgi_fr_w"]
    brk = lambda nm, a, off: {f"b_{nm}": img(T(f"sg_brk_{nm}"), ["100%y", "7.7%"], keep_ratio=False, anchor_from=a, anchor_to=a, offset=off, layer=3, anims=fr())}
    D["eth_sg_intro_form"] = {"type": "panel", "size": ["100%", "100%"], "layer": 2, "controls": stars() + [
        # quadro preto do "desenho" (6.2%..89.8% da altura), borda branca fina, cantoneiras cinza por dentro
        {"draw": {"type": "panel", "size": ["100% - 22px", "83.6%"], "anchor_from": "center", "anchor_to": "center", "offset": [0, "-2.1%"], "layer": 4, "controls": [
            {"black": img("textures/ui/Black", ["100%", "100%"], keep_ratio=False, layer=1, anims=fr())},
            {"thin": img(T("sg_thin"), ["100%", "100%"], keep_ratio=False, layer=2, anims=fr())},
            brk("tl", "top_left", [3, 3]), brk("tr", "top_right", [-3, 3]), brk("bl", "bottom_left", [3, -3]), brk("br", "bottom_right", [-3, -3]),
            {"sign": {"type": "panel", "size": ["46%", "38%"], "anchor_from": "center", "anchor_to": "center", "offset": [0, "-6%"], "layer": 4, "clips_children": True, "controls": [
                {"ink": img(T("sg_sign"), ["100%", "100%"], keep_ratio=False, layer=1, anims=fr())},
                {"cover": img("textures/ui/Black", ["100%", "100%"], keep_ratio=False, anchor_from="top_left", anchor_to="top_left", layer=2, anims=[f"@{NS}.eth_sgi_sign_w"])}]}}]}},
        # "A Ampulheta" (43% da altura) com o hexágono apagado e o brilho azul; frase embaixo (78%)
        {"hx": img(T("sg_hex"), ["108%y", "45%"], keep_ratio=False, anchor_from="center", anchor_to="center", offset=[0, "-1%"], alpha=0.0, layer=3, anims=[f"@{NS}.eth_sgi_hg_w"])},
        {"hl": img(T("sg_glow"), ["130%y", "40%"], keep_ratio=False, anchor_from="center", anchor_to="center", offset=[0, "-6%"], alpha=0.0, layer=3, anims=[f"@{NS}.eth_sgi_hg_w"])},
        {"hg": lbl("A Ampulheta", 0.8, [0.95, 0.97, 1], anchor_from="center", anchor_to="center", offset=[0, "-7%"], layer=6, alpha=0.0, anims=[f"@{NS}.eth_sgi_hg_w"])},
        {"hs": lbl("Era, estreitou-se, conteve-se.", 0.62, [0.7, 0.76, 0.88], anchor_from="center", anchor_to="center", offset=[0, "28%"], layer=6, alpha=0.0, anims=[f"@{NS}.eth_sgi_hs_w"])},
        # faixa vermelha: 14.6%..62.3% da altura (47.7%), largura toda, entra da esquerda; nome da aptidão grande no meio, nome embaixo (67%)
        {"banner": {"type": "panel", "size": ["100%", "47.7%"], "anchor_from": "center", "anchor_to": "center", "offset": ["-100%", "-11.5%"], "layer": 7, "anims": [f"@{NS}.eth_sgi_slide_w"], "controls": [
            {"red": img(T("sg_banner"), ["100%", "100%"], keep_ratio=False, layer=1, alpha=0.0, anims=[f"@{NS}.eth_sgi_bn_w"])},
            {"name": {"type": "label", "text": "#title_text", "bindings": [{"binding_name": "#title_text"}], "anchor_from": "center", "anchor_to": "center", "size": ["100% - 24px", "default"],
                      "text_alignment": "center", "font_size": "large", "color": [1, 0.96, 0.96], "shadow": False, "layer": 2, "alpha": 0.0, "anims": [f"@{NS}.eth_sgi_bn_w"]}}]}},
        {"bsub": lbl("#form_text", 0.7, CAP_TXT, anchor_from="center", anchor_to="center", offset=[0, "17%"], layer=7, alpha=0.0, anims=[f"@{NS}.eth_sgi_bs_w"])},
        {"l1": legend("Sorteio.", anim="eth_sgi_l1")}, {"l2": legend("O último desejo.", anim="eth_sgi_l2")}, {"l3": legend("Aptidão encontrada.", anim="eth_sgi_l3")},
        {"skip": tap_row("eth_sgi_skip")},
    ]}
    D["eth_sg_outro_form"] = {"type": "panel", "size": ["100%", "100%"], "layer": 2, "controls": stars() + [
        {"sphere": {"type": "panel", "size": ["100%y", "71%"], "anchor_from": "center", "anchor_to": "center", "offset": [0, "-8.8%"], "layer": 4, "anims": [f"@{NS}.eth_sgo_grow"], "controls":
            [{f"g{k}": img(T(f"sg_geo_{k}"), ["100%", "100%"], keep_ratio=False, anchor_from="center", anchor_to="center", alpha=0.0, layer=1, anims=[f"@{NS}.eth_sgg{k}_start"])} for k in range(12)]
            + [{"core": img("textures/ui/etheria/ov_core", ["14%", "14%"], keep_ratio=False, anchor_from="center", anchor_to="center", color=[0.35, 0.7, 1.0], layer=3, anims=[f"@{NS}.eth_sg_glow_a"])},
               {"dot": img(T("sg_twinkle"), ["5%", "5%"], keep_ratio=False, anchor_from="center", anchor_to="center", color=[0.75, 0.92, 1.0], layer=4)}]}},
        {"l1": legend("Confirmado.", anim="eth_sgo_l1")}, {"l2": legend("Reencarnação completa.", anim="eth_sgo_l2")},
        {"l3": legend("Para o mundo.", anim="eth_sgo_l3")}, {"l4": legend("Boa sorte.", anim="eth_sgo_l4")},
        {"skip": tap_row("eth_sgo_skip")},
    ]}
    # ---- cartão do carrossel
    D["eth_sg_card_form"] = {"type": "panel", "size": ["100%", "100%"], "layer": 2, "controls": stars() + [
        {"card": {"type": "panel", "size": ["61%y", "100%"], "anchor_from": "center", "anchor_to": "center", "layer": 5, "controls": [
            {"frame": img(T("sg_card"), ["100%", "100%"], keep_ratio=False, layer=1)},
            {"name": {"type": "label", "text": "#title_text", "bindings": [{"binding_name": "#title_text"}], "anchor_from": "top_middle", "anchor_to": "top_middle", "offset": [0, "1.1%"],
                      "size": ["90%", "default"], "text_alignment": "center", "color": [1, 1, 1], "font_scale_factor": 0.8, "layer": 3}},
            {"pic": img(T("sg_pframe"), ["40.3%", "84.5%"], keep_ratio=False, anchor_from="top_left", anchor_to="top_left", offset=["5.3%", "4.6%"], layer=2, controls=[
                {f"p_{rid}": img(T(f"race_{rid}"), ["100% - 2px", "100% - 2px"], anchor_from="center", anchor_to="center", layer=1, bindings=vis(has(f"§k§r§{c}")))} for rid, c in RACE_CODES.items()])},
            *[{f"badge{k}": img(T(f"sg_badge{k}"), ["13%", "2.7%"], keep_ratio=False, anchor_from="top_left", anchor_to="top_left", offset=["50.6%", "5.5%"], layer=2, bindings=vis(has(f"§l§r§{k}")), controls=[
                {"t": lbl(nm, 0.5, col, anchor_from="center", anchor_to="center", layer=1)}])} for k, (nm, col, _) in enumerate(DIFF)],
            {"info": {"type": "panel", "size": ["47%", "79%"], "anchor_from": "top_left", "anchor_to": "top_left", "offset": ["50.4%", "9.2%"], "layer": 3, "controls": [
                {"scroll@common.scrolling_panel": dict(scroll(f"{NS}.eth_sg_card_text"), **{"$scroll_size": [2, "100% - 4px"]}, layer=1)}]}},
            {"btns": {"type": "stack_panel", "orientation": "horizontal", "size": ["100%", "100%"], "anchor_from": "top_left", "anchor_to": "top_left", "layer": 6,
                      "factory": {"name": "buttons", "control_name": f"{NS}.eth_sg_card_row"}, "collection_name": "form_buttons",
                      "bindings": [{"binding_name": "#form_button_length", "binding_name_override": "#collection_length"}]}},
        ]}},
        {"leg_pick": legend("Agora escolha uma forma.", vis(lacks(CONFIRM)))},
        {"leg_conf": legend("Confirmar?", vis(has(CONFIRM)))},
        {"close@common.close_button": {"anchor_from": "top_right", "anchor_to": "top_right", "offset": [-6, 5], "layer": 12}},
    ]}
    return D

# ------------------------------------------------------------------ 8.9b: JANELA TENSURA (habilidades, Registro, ficha, evolução...)
# Cópia do menu "Magic" do vídeo (316 s): abas quadradas em cima à esquerda, título centrado acima, painel azul-marinho de borda
# preta + filete, seção esquerda com os ícones redondos (aro octogonal) e seção direita com moldura cinza chanfrada, faixa 1..9,
# campo cinza ("Preset 1" -> nome do Sábio) e caixa azul com a ficha. Proporções do vídeo: janela 1.65:1 com 64% da altura da tela;
# esquerda 0.8%..48.3%, direita 49.6%..99.2% da largura; dentro da direita: faixa 1..9 a 14.5%, campo a 26.7%, ficha de 37% a 93%.
TZ_TXT = [0.12, 0.12, 0.14]
def tz_defs():
    D = {}
    icon_bind = [{"binding_name": "#form_button_texture", "binding_name_override": "#texture", "binding_type": "collection", "binding_collection_name": "form_buttons"},
                 {"binding_name": "#form_button_texture_file_system", "binding_name_override": "#texture_file_system", "binding_type": "collection", "binding_collection_name": "form_buttons"},
                 {"binding_type": "view", "source_property_name": "(not ((#texture = '') or (#texture = 'loading')))", "target_property_name": "#visible"}]
    # linha da lista: botão cinza-claro (lista "Creator"/"Ability Archive") + ícone do botão dentro do aro octogonal (menu "Magic").
    # O ícone segue o dynamic_button do próprio jogo: painel com binding no filho "image" (sem ícone, o aro some).
    D["eth_sg_tz_row"] = {"type": "panel", "size": ["100%", 30], "controls": [
        text_btn(["100% - 2px", 26], "center", "center", [0, 0], "tz_row", txt=TZ_TXT, scale=0.8, max_size=("100% - 35px", 20),
                 **{"$anchor": "left_middle", "$text_alignment": "left", "$new_ui_label_offset": [31, 0], "$hover_text_color": [0.05, 0.05, 0.07], "$pressed_text_color": [0.05, 0.05, 0.07]}),
        {"orb": {"type": "panel", "size": [27, 27], "anchor_from": "left_middle", "anchor_to": "left_middle", "offset": [1, 0], "layer": 6,
                 "bindings": [{"binding_type": "view", "source_control_name": "image", "resolve_sibling_scope": True, "source_property_name": "(not (#texture = ''))", "target_property_name": "#visible"}],
                 "controls": [{"bg": img(T("tz_orb_bg"), ["100%", "100%"], layer=1)},
                              {"image": {"type": "image", "size": [17, 17], "layer": 2, "bindings": icon_bind}},
                              {"ring": img(T("tz_orb"), ["100%", "100%"], layer=3)}]}}]}
    D["eth_sg_tz_list"] = button_list("eth_sg_tz_row")
    D["eth_sg_tz_text"] = {"type": "stack_panel", "size": ["100% - 2px", "100%c"], "orientation": "vertical", "anchor_from": "top_left", "anchor_to": "top_left", "controls": [
        {"text_panel": {"type": "panel", "size": ["100%", "100%c"], "controls": [
            {"main_label": {"type": "label", "offset": [3, 2], "color": [0.92, 0.94, 0.98], "size": ["100% - 6px", "default"], "anchor_from": "top_left", "anchor_to": "top_left", "text": "#form_text", "font_scale_factor": 0.7}}]}},
        {"pad_bottom": {"type": "panel", "size": ["100%", 6]}}]}
    tabs = [("textures/ui/etheria/sg_ico_0", [0.9, 0.62, 1.0]), ("textures/ui/etheria/menu_skills", None), ("textures/ui/etheria/menu_class", None)]
    tab_ctl = []
    for i, (ic, col) in enumerate(tabs):
        icon = img(ic, ["62%", "62%"], anchor_from="center", anchor_to="center", layer=1, **({"color": col} if col else {}))
        tab_ctl.append({f"tab{i}": img(T("tz_tab_on" if i == 0 else "tz_tab"), ["9%", "15%"], keep_ratio=False, anchor_from="top_left", anchor_to="bottom_left",
                                       offset=[f"{[2.0, 13.6, 24.3][i]}%", 2 if i == 0 else 0], layer=3 if i == 0 else 1, controls=[{"ic": icon}])})
    nums = {"nums": {"type": "stack_panel", "orientation": "horizontal", "size": ["78%", "5.4%"], "anchor_from": "top_left", "anchor_to": "top_left", "offset": ["9.6%", "14.5%"], "layer": 3, "controls": [
        {f"n{k}": img(T("tz_num_on" if k == 1 else "tz_num"), ["11.1%", "100%"], keep_ratio=False, controls=[{"t": lbl(str(k), 0.6, [0.95, 0.95, 0.97], anchor_from="center", anchor_to="center", layer=1)}])} for k in range(1, 10)]}}
    sage_name = [("Raphael", has("§t§r")), ("Ciel", has("§t§c")), ("Grande Sábio", AND(lacks("§t§r"), lacks("§t§c")))]
    field = {"field": img(T("tz_field"), ["80%", "7.7%"], keep_ratio=False, anchor_from="top_left", anchor_to="top_left", offset=["9.6%", "26.7%"], layer=3, controls=[
        {f"s{i}": lbl(nm, 0.85, [0.97, 0.97, 0.99], anchor_from="left_middle", anchor_to="left_middle", offset=[4, 0], layer=1, shadow=True, bindings=vis(ex))} for i, (nm, ex) in enumerate(sage_name)]}
    D["eth_sg_form"] = {"type": "panel", "size": ["100%", "100%"], "layer": 2, "controls": [
        {"win": {"type": "panel", "size": ["165%y", "64%"], "anchor_from": "center", "anchor_to": "center", "offset": [0, "5%"], "layer": 5, "controls": tab_ctl + [
            {"frame": img(T("tz_win"), ["100%", "100%"], keep_ratio=False, layer=2)},
            {"title": {"type": "label", "text": "#title_text", "bindings": [{"binding_name": "#title_text"}], "anchor_from": "top_middle", "anchor_to": "bottom_middle", "offset": ["10%", -4],
                       "size": ["default", "default"], "color": [1, 1, 1], "shadow": True, "font_scale_factor": 0.9, "layer": 4}},
            {"close@common.close_button": {"anchor_from": "top_right", "anchor_to": "bottom_right", "offset": [0, -1], "layer": 12}},
            {"left": {"type": "panel", "size": ["47.5%", "97.4%"], "anchor_from": "top_left", "anchor_to": "top_left", "offset": ["0.8%", "1.3%"], "layer": 3, "controls": [
                {"bg": img(T("tz_left"), ["100%", "100%"], keep_ratio=False, layer=1)},
                {"in": {"type": "panel", "size": ["100% - 4px", "100% - 4px"], "anchor_from": "center", "anchor_to": "center", "layer": 2, "controls": [
                    {"scroll@common.scrolling_panel": dict(scroll(f"{NS}.eth_sg_tz_list"), **{"$scroll_size": [3, "100% - 4px"]}, layer=1)}]}}]}},
            {"right": {"type": "panel", "size": ["49.6%", "97.4%"], "anchor_from": "top_left", "anchor_to": "top_left", "offset": ["49.6%", "1.3%"], "layer": 3, "controls": [
                {"bg": img(T("tz_right"), ["100%", "100%"], keep_ratio=False, layer=1)}, nums, field,
                {"box": img(T("tz_box"), ["80%", "56%"], keep_ratio=False, anchor_from="top_left", anchor_to="top_left", offset=["9.6%", "37%"], layer=3, controls=[
                    {"in": {"type": "panel", "size": ["100% - 2px", "100% - 2px"], "anchor_from": "center", "anchor_to": "center", "layer": 1, "controls": [
                        {"scroll@common.scrolling_panel": dict(scroll(f"{NS}.eth_sg_tz_text"), **{"$scroll_size": [3, "100% - 4px"]}, layer=1)}]}}])}]}},
        ]}},
    ]}
    return D

def sage_defs():
    D = {}
    D.update(anims())
    D["eth_sg_btn_s"] = sg_button(25, 23, 10)        # 1 linha (Livro do Sábio)
    D["eth_sg_list_s"] = button_list("eth_sg_btn_s")
    D.update(reinc_defs())
    D.update(tz_defs())
    ico = lambda size: [{f"x{k}": img(f"textures/ui/etheria/sg_ico_{k}", size, keep_ratio=False, anchor_from="center", anchor_to="center", color=GREEN, alpha=0.0, layer=1, anims=[f"@{NS}.eth_sgx{k}_start"])} for k in range(12)]
    # ---- Livro do Sábio: icosaedro + círculo mágico verde, fala do Sábio num balão, opções à direita
    D["eth_sg_book_form"] = {"type": "panel", "size": ["100%", "100%"], "layer": 2, "controls": backdrop() + [
        {"core": {"type": "panel", "size": [132, 132], "anchor_from": "left_middle", "anchor_to": "left_middle", "offset": ["6% + 10px", 22], "layer": 5, "controls":
            [{f"c{k}": img(f"textures/ui/etheria/ov_circle_{k}", [132, 132], anchor_from="center", anchor_to="center", color=GREEN, alpha=0.0, layer=1, anims=[f"@{NS}.eth_circ{k}_start"])} for k in range(6)]
            + ico([84, 84])
            + [{"glow": img("textures/ui/etheria/ov_core", [34, 34], anchor_from="center", anchor_to="center", color=GREEN, layer=3, anims=[f"@{NS}.eth_sg_glow_a"])}]}},
        {"title": title_band(["40%", 22], "top_left", ["6%", 22], layer=7, font="large")},
        {"bubble": img(T("sg_bubble"), ["30%", 24], keep_ratio=False, anchor_from="top_left", anchor_to="top_left", offset=["6% + 16px", 50], layer=8, controls=[
            {"say": {"type": "label", "text": "#form_text", "bindings": [{"binding_name": "#form_text"}], "size": ["100% - 10px", "default"], "anchor_from": "center", "anchor_to": "center", "text_alignment": "center", "color": [0.85, 1, 0.94], "layer": 1}},
            {"clip": {"type": "panel", "size": ["100% - 4px", "100% - 4px"], "anchor_from": "center", "anchor_to": "center", "layer": 2, "controls": [curtain_h(1)]}}])},
        {"list": {"type": "panel", "size": ["44%", "100% - 30px"], "anchor_from": "top_right", "anchor_to": "top_right", "offset": [-10, 22], "layer": 9, "controls": [
            {"plate": img(T("sg_frame"), ["100%", "100%"], alpha=0.7, layer=1)},
            {"scroll@common.scrolling_panel": dict(scroll(f"{NS}.eth_sg_list_s"), layer=2)}]}},
    ]}
    return D

def build(main):
    sf = copy.deepcopy(main)
    lf = sf["long_form"]["controls"]
    def ctl(name):
        for c in lf:
            for k, v in c.items():
                if k.split("@")[0] == name: return v
        raise KeyError(name)
    for name in ("etheria_form", "card_form"):   # telas do principal: só quando NÃO houver o marcador do Sábio
        b = ctl(name)["bindings"][1]; b["source_property_name"] = AND(b["source_property_name"], lacks(SG))
    lf.append({f"sg_form@{NS}.eth_sg_form": {"bindings": vis(AND(has(SG), lacks(CARD), lacks(SAGEN), lacks(INTRO), lacks(OUTRO)))}})
    lf.append({f"sg_card_form@{NS}.eth_sg_card_form": {"bindings": vis(AND(has(SG), has(CARD)))}})
    lf.append({f"sg_book_form@{NS}.eth_sg_book_form": {"bindings": vis(AND(has(SG), has(SAGEN), lacks(CARD)))}})
    lf.append({f"sg_intro_form@{NS}.eth_sg_intro_form": {"bindings": vis(AND(has(SG), has(INTRO), lacks(CARD)))}})
    lf.append({f"sg_outro_form@{NS}.eth_sg_outro_form": {"bindings": vis(AND(has(SG), has(OUTRO), lacks(CARD)))}})
    for k, v in sage_defs().items():
        assert k not in sf, f"chave já existe no principal: {k}"
        sf[k] = v
    return sf

# ------------------------------------------------------------------ VALIDADOR
VANILLA_NS = {"common", "common_buttons", "common_dialogs", "settings_common"}
VANILLA_TEX = {"textures/ui/Black", "textures/ui/White"}
VANILLA_SF = {"long_form_panel", "long_form_dynamic_buttons_panel", "custom_form", "dynamic_button", "dynamic_label", "dynamic_header"}   # do server_form original do jogo (os pacotes se somam a ele)
ANIM_TYPES = {"alpha", "offset", "size", "wait", "flip_book", "color", "uv", "clip", "aspect_ratio"}
FONT_SIZES = {"small", "normal", "large", "extra_large"}
SIZE_RE = re.compile(r"^(fill|default|-?\d+(\.\d+)?%(c|cm|sm|x|y)?|-?\d+(\.\d+)?px|(-?\d+(\.\d+)?%(c|cm|sm|x|y)?)( [+-] \d+(\.\d+)?(px|%(c|cm|sm|x|y)?))+)$")

def validate(sf, main, pack_dir):
    errs, warns = [], []
    main_names = {k.split("@")[0] for k in main if k not in ("namespace", "long_form")}
    try: json.loads(json.dumps(sf, ensure_ascii=False))
    except Exception as e: errs.append(f"JSON inválido: {e}")
    if sf.get("namespace") != NS: errs.append("namespace")
    defs = {k.split("@")[0]: k for k in sf if k != "namespace"}
    if len(defs) != len(sf) - 1: errs.append("nomes de topo duplicados (mesmo nome com heranças diferentes)")
    for k, v in main.items():   # cópia completa do principal
        if k == "long_form": continue
        if k not in sf: errs.append(f"falta chave do principal: {k}")
        elif sf[k] != v: errs.append(f"chave do principal alterada: {k}")
    edges = {n: set() for n in defs}
    def ref(owner, target, where):
        if not target.startswith(NS + "."):
            ns = target.split(".")[0]
            if ns not in VANILLA_NS: errs.append(f"{where}: namespace desconhecido '{target}'")
            return
        t = target[len(NS) + 1:]
        if t in VANILLA_SF and t not in defs: return
        if t not in defs: errs.append(f"{where}: referência inexistente '{target}'")
        else: edges[owner].add(t)
    def tex_ok(t):
        if t in VANILLA_TEX or not t.startswith("textures/"): return True
        return any(os.path.exists(os.path.join(d, t + e)) for d in (pack_dir, MAIN_RP) for e in (".png", ".tga", ".jpg"))
    def walk(owner, node, path):
        if isinstance(node, list):
            for i, x in enumerate(node): walk(owner, x, f"{path}[{i}]")
            return
        if not isinstance(node, dict): return
        if node.get("anim_type") is not None and path.count("/") == 0:
            a = node
            if a["anim_type"] not in ANIM_TYPES: errs.append(f"{path}: anim_type inválido")
            if not (isinstance(a.get("duration"), (int, float)) and a["duration"] > 0): errs.append(f"{path}: duration")
            if a["anim_type"] in ("alpha",) and not all(isinstance(a.get(x), (int, float)) for x in ("from", "to")): errs.append(f"{path}: alpha from/to")
            if a["anim_type"] in ("offset", "size") and not all(isinstance(a.get(x), list) and len(a[x]) == 2 for x in ("from", "to")): errs.append(f"{path}: {a['anim_type']} from/to")
            if "next" in a: ref(owner, a["next"][1:], path + ".next")
            return
        for key, val in node.items():
            if key == "controls":
                if not isinstance(val, list): errs.append(f"{path}: controls não é lista"); continue
                seen = set()
                for i, c in enumerate(val):
                    if not (isinstance(c, dict) and len(c) == 1): errs.append(f"{path}.controls[{i}]: item deve ter 1 chave"); continue
                    (ck, cv), = c.items(); nm = ck.split("@")[0]
                    if nm in seen:
                        if owner in main_names: warns.append(f"{path}: filho repetido '{nm}' (já era assim no principal estável)")
                        else: errs.append(f"{path}: filho repetido '{nm}'")
                    seen.add(nm)
                    if "@" in ck: ref(owner, ck.split("@", 1)[1], f"{path}/{nm}")
                    walk(owner, cv, f"{path}/{nm}")
                continue
            if key == "anims":
                for a in val:
                    if not (isinstance(a, str) and a.startswith("@")): errs.append(f"{path}: anim inválida {a}")
                    else: ref(owner, a[1:], path + ".anims")
                continue
            if key == "factory":
                if "control_name" in val: ref(owner, val["control_name"], path + ".factory")
                for cid in (val.get("control_ids") or {}).values(): ref(owner, cid.lstrip("@"), path + ".factory")
                continue
            if key in ("$scrolling_content", "$child_control", "$title_panel"): ref(owner, val, path + "." + key)
            if (key == "texture" or (key.startswith("$") and key.endswith("_texture"))) and isinstance(val, str) and not tex_ok(val): errs.append(f"{path}: textura inexistente {val}")
            if key == "font_size" and val not in FONT_SIZES: errs.append(f"{path}: font_size {val}")
            if key in ("size", "offset") and isinstance(val, list):
                if len(val) != 2: errs.append(f"{path}: {key} precisa de 2 valores")
                for x in val:
                    if isinstance(x, str) and not x.startswith("$") and not SIZE_RE.match(x): errs.append(f"{path}: {key} '{x}' inválido")
            if key in ("color",) and isinstance(val, list) and not (len(val) in (3, 4) and all(isinstance(c, (int, float)) and 0 <= c <= 1 for c in val)): errs.append(f"{path}: color")
            if key in ("alpha",) and isinstance(val, (int, float)) and not 0 <= val <= 1: errs.append(f"{path}: alpha")
            if key == "bindings":
                for b in val:
                    e = b.get("source_property_name")
                    if e and e.count("(") != e.count(")"): errs.append(f"{path}: parênteses na expressão")
            walk(owner, val, f"{path}.{key}")
    for full in sf:
        if full == "namespace": continue
        nm = full.split("@")[0]
        if "@" in full: ref(nm, full.split("@", 1)[1], full)
        walk(nm, sf[full], nm)
    # ciclos (herança/filhos/fábricas/animações)
    state = {}
    def dfs(n, stack):
        state[n] = 1
        for m in edges.get(n, ()):
            if state.get(m) == 1:
                if not (sf[defs[m]].get("anim_type") and sf[defs[n]].get("anim_type")): errs.append(f"ciclo: {' > '.join(stack + [m])}")
            elif not state.get(m): dfs(m, stack + [m])
        state[n] = 2
    for n in defs:
        if not state.get(n): dfs(n, [n])
    # rotas do long_form: exatamente uma tela por tipo de título
    probe = {"vanilla": "Título", "eth": BASE + "§t§s§rX", "card": BASE + CARD + "§k§r§1§rX", "sg": BASE + SG + "§t§s§rX", "sgcard": BASE + SG + CARD + "§k§r§1§rX", "sgbook": BASE + SG + SAGEN + "§t§s§rX",
             "sgintro": BASE + SG + INTRO + "§t§s§rX", "sgoutro": BASE + SG + OUTRO + "§t§s§rX", "sgconfirm": BASE + SG + CARD + "§k§r§4§l§r§2" + CONFIRM + "§rX"}
    want = {"vanilla": "vanilla_form", "eth": "etheria_form", "card": "card_form", "sg": "sg_form", "sgcard": "sg_card_form", "sgbook": "sg_book_form", "sgintro": "sg_intro_form", "sgoutro": "sg_outro_form", "sgconfirm": "sg_card_form"}
    for pk, title in probe.items():
        shown = [k.split("@")[0] for c in sf["long_form"]["controls"] for k, v in c.items() if eval_vis(v["bindings"][1]["source_property_name"], title)]
        if shown != [want[pk]]: errs.append(f"rota '{pk}': mostra {shown}, esperado {want[pk]}")
    # o principal (sem o pacote) também precisa mandar cada título para uma tela só
    for pk, title in probe.items():
        shown = [k.split("@")[0] for c in main["long_form"]["controls"] for k, v in c.items() if eval_vis(v["bindings"][1]["source_property_name"], title)]
        if len(shown) != 1: errs.append(f"principal, rota '{pk}': {shown}")
    if warns: print(f"avisos: {len(warns)} (ex.: {warns[0]})")
    return errs

def eval_vis(expr, title):
    """avalia as expressões de visibilidade usadas aqui: (#title_text - 'x') = #title_text, not, and"""
    py = re.sub(r"\(#title_text - '([^']*)'\) = #title_text", lambda m: repr(m.group(1) not in title), expr)
    if re.search(r"#|'", py.replace("True", "").replace("False", "")): raise ValueError("expressão não suportada: " + expr)
    return eval(py, {"__builtins__": {}}, {})

def main_():
    args = set(sys.argv[1:])
    main = json.load(open(os.path.join(MAIN_RP, "ui/server_form.json"), encoding="utf8"))
    out = os.path.join(PACK, "ui/server_form.json")
    if "--check" in args:
        sf = json.load(open(out, encoding="utf8"))
    else:
        if "--sync" not in args: gen_textures(); gen_manifest()
        sf = build(main)
    errs = validate(sf, main, PACK)
    m = json.load(open(os.path.join(PACK, "manifest.json"), encoding="utf8"))
    uu = [m["header"]["uuid"]] + [x["uuid"] for x in m["modules"]]
    for other in ("LegacyOfEtheria_RP", "LegacyOfEtheria_BP", "LegacyOfEtheria_Voz"):
        p = os.path.join(ROOT, other, "manifest.json")
        if os.path.exists(p):
            o = json.load(open(p, encoding="utf8")); ou = [o["header"]["uuid"]] + [x["uuid"] for x in o.get("modules", [])]
            if set(uu) & set(ou): errs.append(f"UUID repetido com {other}")
    if len(set(uu)) != len(uu): errs.append("UUID repetido no manifesto")
    if errs:
        print("FALHOU (nada gravado):"); [print(" -", e) for e in errs[:60]]; sys.exit(1)
    if "--check" not in args:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        txt = json.dumps(sf, ensure_ascii=False, indent=1)
        if not os.path.exists(out) or open(out, encoding="utf8").read() != txt: open(out, "w", encoding="utf8").write(txt)
    new = [k for k in sf if k not in main]
    print(f"OK: {len(sf) - 1} chaves ({len(main) - 1} do principal + {len(new)} do Sábio), {os.path.getsize(out)} bytes, validação sem erros")

if __name__ == "__main__":
    main_()

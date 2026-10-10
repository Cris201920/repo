"""Cenas da videoaula: cada função desenha um quadro em função do tempo da cena."""
import math

from gfx import *  # noqa: F401,F403
from gfx import C, W, H, font, text, rich, rich_height, text_w, card, pill, put, dyn, icon, bust_icon, sprite
from gfx import clamp, ease, smooth, lerp, mix, draw_person, draw_scales, draw_bust, arrow_dyn, wrap_rich


class Ctx:
    def __init__(self, img, t, T, ts):
        self.img, self.t, self.T, self.ts = img, t, T, ts  # ts: início de cada segmento + fim

    def at(self, k, f=0.0, delay=0.0):
        k = min(k, len(self.ts) - 2)
        return self.ts[k] + f * (self.ts[k + 1] - self.ts[k]) + delay

    def p(self, k, d=0.7, f=0.0, delay=0.0):
        return ease((self.t - self.at(k, f, delay)) / d)

    def since(self, k, f=0.0):
        return max(0.0, self.t - self.at(k, f))

    def seg(self):
        s = 0
        for i in range(len(self.ts) - 1):
            if self.t >= self.ts[i]:
                s = i
        return s


def title(S, s, y=88, size=58):
    p = S.p(0, 0.8)
    text(S.img, 90 - (1 - p) * 40, y, s, "serif_b", size, C["white"], "l", p)
    w = text_w(s, "serif_b", size)
    S.img.paste(C["gold"], (90, y + size + 18, 90 + int(min(w, 1700) * p), y + size + 22))


def panel_title(S, x, y, s, sub, alpha=1.0):
    text(S.img, x, y, s, "serif_b", 36, C["gold2"], "l", alpha)
    text(S.img, x, y + 48, sub, "sans", 30, C["g1"], "l", alpha)


# =================================================================== ABERTURA
def sc_abertura(S):
    img = S.img
    p = S.p(0, 0.9)
    text(img, 110, 285 + (1 - p) * 30, "VIDEOAULA  ·  DIREITO E CONCURSOS PÚBLICOS", "sans_sb", 28, C["gold"], "l", p)
    text(img, 110 - (1 - p) * 60, 335, "Direitos", "serif_b", 140, C["white"], "l", p)
    text(img, 110 - (1 - p) * 60, 470, "Humanos", "serif_b", 140, C["white"], "l", p)
    img.paste(C["gold"], (112, 650, 112 + int(560 * p), 655))
    rich(img, 110, 685, "Revisão completa para a faculdade de Direito e para concursos", "sans", 38, C["g1"], maxw=820, alpha=p)
    # emblema
    cx, cy = 1400, 450
    put(img, sprite("emb", 700, 700, lambda sd: (sd.circle(350, 350, 300, fill=C["navy2"]),
                                                    sd.circle(350, 350, 300, outline=C["gold"], width=4),
                                                    sd.circle(350, 350, 270, outline=C["g3"], width=2))), cx, cy, p)
    ang = S.t * 12
    dyn(img, cx - 330, cy - 330, 660, 660,
        lambda sd: sd.dashed_circle(330, 330, 318, C["gold2"], 3, n=48, frac=0.4, rot=ang), alpha=p)
    tilt = 4 * math.sin(S.t * 0.9)
    dyn(img, cx - 260, cy - 260, 520, 560,
        lambda sd: draw_scales(sd, 260, 150, 430, tilt, C["white"], C["gold"]), alpha=p)
    for i, s in enumerate(["Compreender", "Diferenciar", "Memorizar", "Reconhecer na prova"]):
        q = S.p(1, 0.6, delay=i * 0.55)
        x = 110 + i * 440
        w = int(text_w(s, "sans_sb", 30)) + 100
        card(img, x, 830 - (1 - q) * 20, w, 76, q, fill=C["panel"], outline=C["gold"], r=38)
        put(img, icon("check", 34, 34, col=C["gold2"], width=7), x + 44, 868 - (1 - q) * 20, q)
        text(img, x + 74, 846 - (1 - q) * 20, s, "sans_sb", 30, C["white"], "l", q)


# ==================================================================== CONCEITO
def sc_conceito(S):
    img = S.img
    title(S, "O que são Direitos Humanos?")
    p0 = S.p(0, 0.8)
    text(img, 960, 190, "Conjunto de direitos indispensáveis a uma vida pautada em:", "sans", 38, C["g1"], "m", p0)
    xs = [480, 960, 1440]
    names = ["LIBERDADE", "IGUALDADE", "DIGNIDADE"]
    fr = [0.62, 0.77, 0.90]
    ex = ["Liberdade de expressão: manifestar uma opinião.", "Igualdade perante a lei: todos tratados de forma igual.",
          "Proteção contra tratamentos desumanos."]
    for i in range(3):
        q = S.p(0, 0.8, fr[i])
        cx, cy = xs[i], 410
        put(img, sprite("med", 300, 300, lambda sd: (sd.circle(150, 150, 140, fill=C["panel"]),
                                                       sd.circle(150, 150, 140, outline=C["gold"], width=4))), cx, cy, q, scale=0.7 + 0.3 * q)
        if i == 0:
            bob = 4 * math.sin(S.t * 2)
            put(img, icon("bubble", 160, 130, col=C["white"], ink=C["navy2"]), cx, cy + bob, q)
        elif i == 1:
            tl = 5 * math.sin(S.t * 1.4) * (1 - ease((S.t - S.at(2)) / 0.8)) if S.t > S.at(1) else 0
            dyn(img, cx - 110, cy - 110, 220, 230, lambda sd: draw_scales(sd, 110, 62, 190, 0, C["white"], C["gold"]), alpha=q)
        else:
            put(img, icon("shield", 140, 160, col=C["white"], inner=C["navy2"]), cx, cy - 4, q)
            put(img, icon("heart", 60, 56, col=C["gold"]), cx, cy - 12, q)
        text(img, cx, 580, names[i], "serif_b", 46, C["gold2"], "m", q)
        e = S.p(i + 1, 0.7)
        card(img, cx - 215, 650 - (1 - e) * 20, 430, 120, e, outline=C["gold"] if S.seg() == i + 1 else C["g3"])
        rich(img, cx, 668 - (1 - e) * 20, ex[i], "sans", 30, C["white"], maxw=380, a="m", alpha=e, lh=1.2)
    for x in (720, 1200):
        text(img, x, 335, "+", "sans_b", 90, C["gold"], "m", S.p(0, 0.6, 0.8))
    q = S.p(4, 0.8)
    card(img, 150, 810, 1620, 84, q, fill=C["panel2"], outline=C["gold"], r=42)
    text(img, 960, 830, "PROTEGER AS PESSOAS   ·   CONDIÇÕES FUNDAMENTAIS   ·   EXISTÊNCIA DIGNA", "sans_b", 32, C["gold2"], "m", q)


# =================================================================== ESTRUTURA
def _estrutura_anim(img, kind, t, cx, cy, alpha):
    """Mini-animações (240×240) de cada estrutura; t = tempo desde a ativação."""
    if kind == 0:  # pretensão: exige -> recebe
        ph = (t % 3.6) / 3.6
        put(img, bust_icon(120, C["white"]), cx - 105, cy + 20, alpha)
        put(img, icon("cross", 84, 84, col=C["teal"], fg=C["navy"]), cx + 100, cy - 10, alpha)
        a = ease(ph / 0.28)
        if ph < 0.62:
            arrow_dyn(img, (cx - 55, cy - 20), (cx + 45, cy - 20), C["gold"], 6, a, alpha * (1 if ph < 0.55 else 0.5))
            text(img, cx - 5, cy - 62, "EXIGE", "sans_b", 24, C["gold2"], "m", alpha * a)
        if ph > 0.38:
            m = ease((ph - 0.38) / 0.4)
            put(img, icon("heart", 40, 38, col=C["green"]), lerp(cx + 60, cx - 60, m), cy + 50, alpha * (1 - clamp((ph - 0.9) / 0.1)))
            arrow_dyn(img, (cx + 55, cy + 50), (cx - 55, cy + 50), C["green"], 4, m, alpha * 0.8, head=18, dashed=True)
    elif kind == 1:  # liberdade: esfera de autonomia
        rot = t * 18
        dyn(img, cx - 125, cy - 125, 250, 250, lambda sd: (sd.circle(125, 125, 100, fill=mix(C["panel"], C["gold"], 0.12)),
                                                              sd.dashed_circle(125, 125, 96, C["gold"], 4, n=26, frac=0.55, rot=rot)), alpha=alpha)
        put(img, bust_icon(110, C["white"]), cx - 12, cy + 22, alpha)
        b = ease(((t % 3.2) - 0.2) / 0.5) * (1 - ease(((t % 3.2) - 2.6) / 0.4))
        put(img, icon("bubble", 88, 74, col=C["gold2"], ink=C["navy2"]), cx + 42, cy - 62, alpha * b, scale=0.6 + 0.4 * b)
        text(img, cx, cy + 113, "AUTONOMIA", "sans_b", 22, C["gold2"], "m", alpha)
    elif kind == 2:  # poder: voto -> efeito jurídico
        ph = (t % 3.6) / 3.6
        put(img, icon("ballot", 150, 130, col=C["white"], acc=C["gold"]), cx, cy + 40, alpha)
        d = ease(ph / 0.4)
        py = lerp(cy - 95, cy + 5, d)
        if ph < 0.45:
            put(img, icon("paper", 52, 66, col=C["gold2"], ink=C["navy2"]), cx, py, alpha)
        else:
            m = ease((ph - 0.45) / 0.3)
            put(img, icon("check", 70, 70, col=C["green"], width=9), cx, cy - 55, alpha * m, scale=0.5 + 0.5 * m)
            r = 30 + 90 * ease((ph - 0.5) / 0.45)
            fade = 1 - clamp((ph - 0.5) / 0.45)
            dyn(img, cx - 125, cy - 125, 250, 250, lambda sd: sd.circle(125, 125 - 30, r, outline=C["gold"], width=4), alpha=alpha * fade * 0.8)
        text(img, cx, cy + 113, "EFEITO JURÍDICO", "sans_b", 22, C["gold2"], "m", alpha)
    else:  # imunidade: escudo repele interferência
        ph = (t % 3.0) / 3.0
        put(img, icon("courthouse", 84, 76, col=C["g2"], acc=C["navy"]), cx - 98, cy - 62, alpha)
        put(img, bust_icon(110, C["white"]), cx + 62, cy + 28, alpha)
        a = ease(ph / 0.35)
        if ph < 0.6:
            arrow_dyn(img, (cx - 72, cy - 35), (cx - 6, cy - 2), C["red"], 6, a, alpha * (1 - clamp((ph - 0.5) / 0.1)), head=20)
        hit = clamp((ph - 0.33) / 0.1) * (1 - clamp((ph - 0.5) / 0.3))
        put(img, icon("shield", 112, 130, col=mix(C["gold"], C["gold2"], hit), inner=C["navy2"]), cx - 14, cy + 6, alpha, scale=1 + 0.06 * hit)
        text(img, cx, cy + 113, "BLINDAGEM", "sans_b", 22, C["gold2"], "m", alpha)


ESTRUTURA = [
    ("DIREITO-PRETENSÃO", "Exigir de alguém uma conduta ou prestação", "Ex.: receber prestação de saúde, presentes os requisitos jurídicos."),
    ("DIREITO-LIBERDADE", "Esfera de autonomia, sem interferências indevidas", "Ex.: manifestar uma opinião, dentro dos limites jurídicos."),
    ("DIREITO-PODER", "Exercer competência e produzir efeitos jurídicos por ato reconhecido pelo Direito", "Ex.: votar, observados os requisitos legais."),
    ("DIREITO-IMUNIDADE", "Proteção contra interferência ou sujeição ao poder de outro ou de autoridade", "Ex.: proteção contra ingerência indevida de autoridade."),
]


def _estrutura(S, activation, done=None):
    """activation[i] = segmento em que o cartão i ganha vida (None = ainda não); done[i] = cartão já concluído."""
    img = S.img
    for i, (nm, ph, exm) in enumerate(ESTRUTURA):
        x, y, w, h = 90 + i * 445, 200, 405, 620
        base = S.p(0, 0.7, delay=0.15 * i) if done is None else 1.0
        k = activation[i]
        is_done = bool(done and done[i])
        live = 1.0 if is_done else (S.p(k, 0.6) if k is not None else 0.0)
        t_anim = S.t + 3.0 if is_done else (S.since(k) if k is not None else 0.0)
        current = k is not None and not is_done and S.seg() == k
        card(img, x, y, w, h, base, outline=C["gold"] if current else C["g3"], ow=3 if current else 2)
        put(img, sprite("numdot", 52, 52, lambda sd: sd.circle(26, 26, 24, fill=C["gold"])), x + 44, y + 44, base)
        text(img, x + 44, y + 22, str(i + 1), "sans_b", 32, C["navy0"], "m", base)
        text(img, x + 84, y + 31, nm, "serif_b", 27, C["gold2"], "l", base)
        if live > 0.01:
            _estrutura_anim(img, i, t_anim, x + w // 2, y + 235, live)
            rich(img, x + w // 2, y + 382 + (1 - live) * 14, ph, "sans_sb", 27, C["white"], maxw=355, a="m", alpha=live, lh=1.2)
            rich(img, x + w // 2, y + 522 + (1 - live) * 14, exm, "sans_i", 25, C["g1"], maxw=355, a="m", alpha=live, lh=1.2)
        else:
            text(img, x + w // 2, y + 300, "?", "serif_b", 120, C["g3"], "m", base * 0.7)


def sc_estrutura1(S):
    title(S, "Estrutura: quatro maneiras de compreender um direito", size=50)
    _estrutura(S, [1, 2, None, None])


def sc_estrutura2(S):
    title(S, "Estrutura: quatro maneiras de compreender um direito", size=50)
    # cartões 1 e 2 já concluídos; 3 e 4 ganham vida
    _estrutura(S, [None, None, 0, 1], done=[True, True, False, False])
    q = S.p(2, 0.8)
    labels = ["EXIGE", "PROTEGE A AUTONOMIA", "PRODUZ EFEITOS JURÍDICOS", "PROTEGE CONTRA INTERFERÊNCIA"]
    for i, s in enumerate(labels):
        pill(S.img, 90 + i * 445 + 202, 874, s, 21, C["gold"], C["navy0"], q * ease((S.t - S.at(2) - 0.3 * i) / 0.5), padx=18)


# ================================================================ CUMPRIMENTO
def _anim_ativa(img, t, x0, y0, alpha):
    """Pessoa que age (entrega uma prestação) – tela 340×170 a partir de (x0+20, y0+22)."""
    ph = (t % 3.4) / 3.4
    m = ease((ph - 0.15) / 0.55)
    ox, oy = x0 + 20, y0 + 22
    dyn(img, ox, oy, 340, 170, lambda sd: (
        draw_person(sd, 70, 160, 135, C["white"], 1, arms=(55 + 15 * m, 60), legs=(7, -7)),
        draw_person(sd, 270, 160, 135, C["gold2"], -1, arms=(40 + 25 * m, 50), legs=(7, -7)),
    ), alpha=alpha)
    bx = lerp(ox + 105, ox + 235, m)
    put(img, icon("box", 38, 36, col=C["gold"], acc=C["gold2"]), bx, oy + 82, alpha * (1 - clamp((ph - 0.92) / 0.08)))
    text(img, x0 + 190, y0 + 8, "AGIR · PRESTAR", "sans_b", 22, C["gold2"], "m", alpha)


def _anim_passiva(img, t, x0, y0, alpha):
    """Autoridade que se abstém: a interferência é 'cortada'."""
    ph = (t % 3.4) / 3.4
    ox, oy = x0 + 20, y0 + 22
    dyn(img, ox, oy, 340, 170, lambda sd: (
        draw_person(sd, 70, 160, 135, C["g2"], 1, arms=(6, -6), legs=(7, -7)),
        draw_person(sd, 270, 160, 135, C["white"], -1, arms=(6, -6), legs=(7, -7)),
        sd.rrect((57, 20, 83, 28), 3, fill=C["gold"]),
        sd.rrect((62, 12, 78, 22), 4, fill=C["gold"]),
        sd.circle(70, 76, 5, fill=C["gold2"]),
    ), alpha=alpha)
    a = ease(ph / 0.45)
    arrow_dyn(img, (ox + 110, oy + 72), (ox + 235, oy + 72), C["red"], 5, a, alpha * (1 - clamp((ph - 0.75) / 0.25)), head=18, dashed=True)
    xs = ease((ph - 0.4) / 0.2)
    put(img, icon("x", 54, 54, col=C["red"], width=9), ox + 170, oy + 72, alpha * xs, scale=0.6 + 0.4 * xs)
    text(img, x0 + 190, y0 + 8, "ABSTER-SE", "sans_b", 22, C["gold2"], "m", alpha)


def sc_cumprimento1(S):
    img = S.img
    title(S, "Cumprimento: dois pontos de vista")
    # painel esquerdo (ativo) / direito (a seguir)
    card(img, 90, 200, 840, 640, S.p(0, 0.7), outline=C["gold"], ow=3)
    panel_title(S, 130, 222, "PONTO DE VISTA SUBJETIVO", "Quem tem a incumbência?", S.p(0, 0.7))
    card(img, 990, 200, 840, 640, S.p(0, 0.7, 0.2) * 0.55, outline=C["g3"])
    panel_title(S, 1030, 222, "PONTO DE VISTA OBJETIVO", "Qual conduta é exigida?", S.p(0, 0.7, 0.2) * 0.4)
    text(img, 1410, 470, "?", "serif_b", 200, C["g3"], "m", S.p(0, 0.7, 0.3) * 0.7)
    text(img, 1410, 700, "a seguir", "sans_i", 30, C["g2"], "m", S.p(0, 0.7, 0.3))
    rows = [("ESTADO", "Saúde e segurança pública", "courthouse"), ("PARTICULAR", "Empregador não pode discriminar o trabalhador", "bust"),
            ("AMBOS", "Proteção da criança: dever da família, da sociedade e do Estado", "both")]
    for i, (nm, ex, ic) in enumerate(rows):
        q = S.p(i + 1, 0.7)
        y = 330 + i * 146
        cur = S.seg() == i + 1
        card(img, 120, y, 780, 136, q, fill=C["panel2"], outline=C["gold"] if cur else C["g3"], ow=3 if cur else 2, r=18)
        cx = 195
        if ic == "courthouse":
            put(img, icon("courthouse", 96, 88, col=C["white"], acc=C["gold"]), cx, y + 68, q)
        elif ic == "bust":
            put(img, bust_icon(92, C["white"]), cx, y + 72, q)
        else:
            put(img, icon("courthouse", 66, 60, col=C["white"], acc=C["gold"]), cx - 28, y + 66, q)
            put(img, bust_icon(64, C["gold2"]), cx + 34, y + 76, q)
        text(img, 285, y + 16, nm, "sans_b", 34, C["gold2"], "l", q)
        rich(img, 285, y + 66, ex, "sans", 27, C["white"], maxw=590, alpha=q, lh=1.15)
    q = S.p(4, 0.8)
    card(img, 120, 776, 780, 52, q, fill=C["gold"], outline=None, r=26)
    text(img, 510, 784, "NÃO É RESPONSABILIDADE EXCLUSIVA DO ESTADO", "sans_b", 29, C["navy0"], "m", q)


def sc_cumprimento2(S):
    img = S.img
    title(S, "Cumprimento: dois pontos de vista")
    card(img, 90, 200, 840, 580, 1, outline=C["g3"])
    panel_title(S, 130, 222, "PONTO DE VISTA SUBJETIVO", "Quem tem a incumbência?")
    for i, (nm, ic) in enumerate([("ESTADO", "courthouse"), ("PARTICULAR", "bust"), ("AMBOS", "both")]):
        y = 350 + i * 130
        card(img, 130, y, 760, 104, 1, fill=C["panel2"], outline=C["g3"], r=18)
        if ic == "courthouse":
            put(img, icon("courthouse", 74, 68, col=C["white"], acc=C["gold"]), 200, y + 52)
        elif ic == "bust":
            put(img, bust_icon(72, C["white"]), 200, y + 54)
        else:
            put(img, icon("courthouse", 48, 44, col=C["white"], acc=C["gold"]), 180, y + 50)
            put(img, bust_icon(48, C["gold2"]), 226, y + 56)
        text(img, 280, y + 28, nm, "sans_b", 36, C["white"], "l")
    card(img, 990, 200, 840, 580, S.p(0, 0.7), outline=C["gold"], ow=3)
    panel_title(S, 1030, 222, "PONTO DE VISTA OBJETIVO", "Qual conduta é exigida?", S.p(0, 0.7))
    for i, (nm, ph, anim, k) in enumerate([("CONDUTA ATIVA", "Exige uma ação, uma prestação ou uma medida para efetivar o direito.", _anim_ativa, 0),
                                              ("CONDUTA PASSIVA", "Exige abstenção: deixar de praticar interferência indevida.", _anim_passiva, 1)]):
        q = S.p(k, 0.7, 0.15 if k == 0 else 0.0)
        y = 350 + i * 215
        cur = S.seg() == k
        card(img, 1020, y, 780, 195, q, fill=C["panel2"], outline=C["gold"] if cur else C["g3"], ow=3 if cur else 2, r=18)
        anim(img, S.since(k, 0.1) if k == 0 else S.since(k), 1020, y, q)
        text(img, 1405, y + 24, nm, "sans_b", 32, C["gold2"], "l", q)
        rich(img, 1405, y + 72, ph, "sans", 27, C["white"], maxw=380, alpha=q, lh=1.18)
    q = S.p(2, 0.8)
    for x, a, b in ((90, "SUBJETIVO", "QUEM tem a incumbência"), (990, "OBJETIVO", "QUAL conduta é exigida")):
        card(img, x, 805, 840, 80, q, fill=C["gold"], outline=None, r=40)
        text(img, x + 420, 822, f"{a}  =  {b}", "sans_b", 33, C["navy0"], "m", q)


# =================================================================== CONTEÚDO
def sc_conteudo(S):
    img = S.img
    title(S, "Conteúdo dos Direitos Humanos")
    p = S.p(0, 0.9)
    cx, cy = 960, 450
    dyn(img, cx - 190, cy - 190, 380, 380, lambda sd: (sd.circle(190, 190, 150, fill=C["panel"]),
                                                          sd.circle(190, 190, 150, outline=C["gold"], width=4),
                                                          sd.dashed_circle(190, 190, 172, C["gold2"], 2, n=40, frac=0.4, rot=S.t * 10)), alpha=p)
    put(img, bust_icon(190, C["white"]), cx, cy + 6, p)
    text(img, cx, 636, "PESSOA HUMANA", "sans_b", 30, C["gold2"], "m", p)
    bk = S.p(0, 0.9, 0.15)
    put(img, icon("book", 210, 250, col=C["panel2"], acc=C["gold"], spine=C["gold"]), 330, 450, bk)
    text(img, 330, 600, "CONSTITUIÇÕES", "sans_b", 30, C["white"], "m", bk)
    tr = S.p(0, 0.9, 0.3)
    put(img, icon("treaty", 200, 250, col=C["g1"], acc=C["gold"], ink=C["g3"]), 1650, 450, tr)
    text(img, 1650, 600, "TRATADOS INTERNACIONAIS", "sans_b", 30, C["white"], "m", tr)
    words = [("dignidade", 640, 330, 0.55, 0), ("liberdade", 640, 520, 0.68, 0), ("igualdade", 1290, 330, 0.80, 1),
             ("proteção da pessoa humana", 1350, 520, 0.92, 1)]
    for wd, x, y, f, side in words:
        q = S.p(0, 0.7, f)
        ww = text_w(wd.upper(), "sans_b", 28) + 44
        sx = 450 if side == 0 else 1550
        outer, inner = (x - ww / 2, x + ww / 2) if side == 0 else (x + ww / 2, x - ww / 2)
        ring = 808 if side == 0 else 1112
        if q > 0.02:
            arrow_dyn(img, (sx, 450), (outer, y), C["g3"], 3, q, alpha=q * 0.9, head=1, dashed=True)
            arrow_dyn(img, (inner, y), (ring, 450), C["gold"], 3, q, alpha=q * 0.9, head=14)
        pill(img, x, y, wd.upper(), 28, C["panel2"], C["gold2"], q, padx=22)
    for k, (nm, sub, ic, x) in enumerate([("EXPRESSA", "escrita no texto jurídico", "mark", 110), ("IMPLÍCITA", "decorre da interpretação do texto", "magnifier", 990)]):
        q = S.p(k + 1, 0.8)
        cur = S.seg() == k + 1
        card(img, x, 730, 820, 120, q, outline=C["gold"] if cur else C["g3"], ow=3 if cur else 2, fill=C["panel"], r=20)
        if ic == "mark":
            put(img, icon("mark", 64, 80, col=C["gold2"]), x + 70, 790, q)
        else:
            put(img, icon("mark", 64, 80, col=C["g2"]), x + 62, 792, q)
            put(img, icon("magnifier", 60, 60, col=C["gold2"]), x + 92, 812, q)
        text(img, x + 140, 750, nm, "serif_b", 40, C["gold2"], "l", q)
        text(img, x + 140, 800, sub, "sans", 29, C["white"], "l", q)


# ========================================================== FUNDAMENTALIDADE
def sc_fundamentalidade(S):
    img = S.img
    title(S, "Fundamentalidade formal × material")
    for i, (nm, x) in enumerate((("FORMAL", 90), ("MATERIAL", 990))):
        q = S.p(0, 0.8, delay=0.2 * i)
        card(img, x, 200, 840, 420, q, outline=C["gold"] if S.seg() == i + 1 else C["g3"], ow=3 if S.seg() == i + 1 else 2)
        pill(img, x + 420, 252, nm, 36, C["gold"], C["navy0"], q, padx=44)
    v = S.p(0, 0.7, delay=0.4)
    put(img, sprite("vs", 110, 110, lambda sd: (sd.circle(55, 55, 52, fill=C["navy"]), sd.circle(55, 55, 52, outline=C["gold"], width=4))), 960, 410, v)
    text(img, 960, 380, "VS", "serif_b", 44, C["gold2"], "m", v)
    q1 = S.p(1, 0.8)
    put(img, icon("treaty", 120, 150, col=C["g1"], acc=C["gold"], ink=C["g3"]), 190, 450 + (1 - q1) * 20, q1)
    put(img, icon("book", 100, 130, col=C["panel2"], acc=C["gold"], spine=C["gold"]), 300, 460 + (1 - q1) * 20, q1)
    rich(img, 380, 330 + (1 - q1) * 14, "[[Reconhecimento]] do direito em um instrumento jurídico: Constituição ou tratado internacional (conforme o contexto).", "sans", 30, C["white"], maxw=500, alpha=q1, lh=1.2)
    text(img, 130, 548, "Dimensão formal do reconhecimento normativo.", "sans_i", 28, C["g1"], "l", q1)
    q2 = S.p(2, 0.8)
    put(img, icon("shield", 130, 150, col=C["white"], inner=C["navy2"]), 1120, 440 + (1 - q2) * 20, q2)
    put(img, icon("heart", 56, 52, col=C["gold"]), 1120, 432 + (1 - q2) * 20, q2)
    rich(img, 1215, 330 + (1 - q2) * 14, "Considera o [[conteúdo]]: o direito é [[indispensável]] para a promoção da dignidade humana?", "sans", 30, C["white"], maxw=580, alpha=q2, lh=1.2)
    text(img, 1030, 548, "Dimensão do conteúdo do direito.", "sans_i", 28, C["g1"], "l", q2)
    q = S.p(3, 0.8)
    for i, s in enumerate(("FORMAL  =  RECONHECIMENTO JURÍDICO.", "MATERIAL  =  IMPORTÂNCIA DO CONTEÚDO PARA A DIGNIDADE HUMANA.")):
        qq = ease((S.t - S.at(3) - i * 0.9) / 0.7)
        card(img, 90, 660 + i * 92, 1740, 76, qq, fill=C["panel2"], outline=C["gold"], r=38)
        text(img, 960, 676 + i * 92, s, "sans_b", 34, C["gold2"], "m", qq)
    text(img, 960, 852, "Recurso de memorização — não é uma definição jurídica exaustiva.", "sans_i", 26, C["g2"], "m", q)


# ======================================================================= MARCAS
def _marcas_nav(S, active):
    names = ["1", "2", "3", "4"]
    for i in range(4):
        x = 1560 + i * 80
        on = i == active
        put(S.img, sprite(("dot", on), 56, 56, lambda sd, on=on: (sd.circle(28, 28, 25, fill=C["gold"] if on else C["panel"], outline=C["gold"], width=3))), x, 112)
        text(S.img, x, 90, names[i], "sans_b", 30, C["navy0"] if on else C["g2"], "m")


def _ring_people(img, cx, cy, r, n, t, alpha, size=70, link=False):
    cols = [C["white"], C["gold2"], C["blue"], C["teal"], C["g1"], C["gold"], C["white"], C["blue"]]
    for i in range(n):
        a = t * 0.25 + i * 2 * math.pi / n
        x, y = cx + r * math.cos(a), cy + r * math.sin(a) * 0.85
        put(img, bust_icon(size, cols[i % len(cols)]), x, y, alpha)
    if link:
        pass


def sc_marcas1(S):
    img = S.img
    title(S, "Marcas distintivas dos Direitos Humanos")
    _marcas_nav(S, 0 if S.seg() == 0 else 1)
    for k, (x, nm, tx, memo) in enumerate(((90, "1 · UNIVERSALIDADE", "Direitos de todas as pessoas: a proteção não depende de privilégios pessoais.", "DIREITOS DE TODOS"),
                                           (990, "2 · ESSENCIALIDADE", "Valores indispensáveis à pessoa humana, que devem ser protegidos.", "VALORES INDISPENSÁVEIS"))):
        q = S.p(k, 0.9)
        cur = S.seg() == k
        card(img, x, 200, 840, 640, q, outline=C["gold"] if cur else C["g3"], ow=3 if cur else 2)
        text(img, x + 420, 232, nm, "serif_b", 44, C["gold2"], "m", q)
        cx, cy = x + 420, 455
        if k == 0:
            put(img, icon("globe", 130, 130, col=C["g1"], width=5), cx, cy, q)
            _ring_people(img, cx, cy, 150, 8, S.t, q, 56)
        else:
            gl = 1 + 0.05 * math.sin(S.t * 2.2)
            dyn(img, cx - 130, cy - 130, 260, 260, lambda sd: sd.circle(130, 130, 110 * gl, fill=mix(C["panel"], C["gold"], 0.18)), alpha=q)
            put(img, icon("gem", 150, 140, col=C["gold"], light=C["gold2"]), cx, cy, q, scale=gl)
        rich(img, cx, 628 + (1 - q) * 10, tx, "sans", 31, C["white"], maxw=700, a="m", alpha=q, lh=1.22)
        pill(img, cx, 770, memo, 32, C["gold"], C["navy0"], q * ease((S.t - S.at(k) - 1.2) / 0.6), padx=34)


def sc_marcas2(S):
    img = S.img
    title(S, "Marcas distintivas dos Direitos Humanos")
    _marcas_nav(S, 2)
    q = S.p(0, 0.9)
    card(img, 90, 200, 1010, 640, q, outline=C["gold"] if S.seg() == 0 else C["g3"], ow=3)
    text(img, 595, 232, "3 · SUPERIORIDADE NORMATIVA", "serif_b", 42, C["gold2"], "m", q)
    text(img, 595, 288, "ou preferenciabilidade", "sans_i", 30, C["g1"], "m", q)
    # degraus
    steps = [("Demais normas", 150, C["panel2"], C["white"]), ("Normas de Direitos Humanos", 280, C["gold"], C["navy0"])]
    for i, (lb, hh, col, fg) in enumerate(steps):
        st = ease((S.t - S.at(0) - 0.8 - i * 0.7) / 0.7)
        bx = 190 + i * 440
        bh = int(hh * st)
        S.img.paste(col, (bx, 650 - bh, bx + 400, 650))
        text(img, bx + 200, 650 - bh + 14, lb, "sans_b", 28, fg, "m", st)
        if i == 1:
            put(img, icon("shield", 84, 96, col=C["navy"], inner=C["gold2"]), bx + 200, 650 - bh + 110, st)
    text(img, 595, 672, "no contexto constitucional e internacional", "sans_i", 28, C["g1"], "m", ease((S.t - S.at(0) - 2.0) / 0.7))
    pill(img, 595, 748, "PROTEÇÃO NORMATIVA ESPECIAL", 31, C["gold"], C["navy0"], q * ease((S.t - S.at(0) - 3.0) / 0.7), padx=34)
    w = S.p(1, 0.9)
    card(img, 1140, 200, 690, 640, w, fill=mix(C["panel"], C["gold"], 0.1), outline=C["gold"], ow=3)
    put(img, sprite("excl", 90, 90, lambda sd: (sd.circle(45, 45, 42, fill=C["gold"]),)), 1485, 275, w)
    text(img, 1485, 238, "!", "serif_b", 80, C["navy0"], "m", w)
    text(img, 1485, 340, "ATENÇÃO", "serif_b", 42, C["gold2"], "m", w)
    rich(img, 1485, 408, "Não significa que toda norma de Direitos Humanos [[prevalece automaticamente]] sobre qualquer outra.", "sans", 31, C["white"], maxw=580, a="m", alpha=w, lh=1.22)
    tl = 6 * math.sin(S.t * 1.3)
    dyn(img, 1485 - 120, 590, 240, 230, lambda sd: draw_scales(sd, 120, 70, 200, tl, C["white"], C["gold"]), alpha=ease((S.t - S.at(1) - 2.0) / 0.7))
    rich(img, 1485, 735, "Conflitos normativos exigem [[análise jurídica adequada]].", "sans_sb", 28, C["white"], maxw=580, a="m", alpha=ease((S.t - S.at(1) - 2.0) / 0.7), lh=1.2)


def sc_marcas3(S):
    img = S.img
    title(S, "Marcas distintivas dos Direitos Humanos")
    _marcas_nav(S, 3)
    gone = ease((S.t - S.at(1) - 0.2) / 0.6)
    q = S.p(0, 0.9) * (1 - gone)
    if q > 0.01:
        card(img, 90, 200, 1740, 640, q, outline=C["gold"], ow=3)
        text(img, 960, 232, "4 · RECIPROCIDADE", "serif_b", 44, C["gold2"], "m", q)
        cx, cy = 480, 520
        n = 6
        pts = []
        cols = [C["white"], C["gold2"], C["blue"], C["teal"], C["g1"], C["gold"]]
        for i in range(n):
            a = -math.pi / 2 + i * 2 * math.pi / n
            pts.append((cx + 190 * math.cos(a), cy + 165 * math.sin(a)))
        pul = 0.5 + 0.5 * math.sin(S.t * 2)
        dyn(img, cx - 280, cy - 260, 560, 520, lambda sd: [sd.line([(p[0] - cx + 280, p[1] - cy + 260) for p in (pts[i], pts[(i + 2) % n])], mix(C["g3"], C["gold"], 0.4 + 0.4 * pul), 3, cap=False) for i in range(n)], alpha=q)
        for i, p in enumerate(pts):
            put(img, bust_icon(84, cols[i]), p[0], p[1], q)
        rich(img, 1170, 340, "Todos têm [[direitos]] — e os [[deveres de respeito e proteção]] não se limitam à atuação do Estado.", "sans", 36, C["white"], maxw=600, alpha=q, lh=1.25)
        rich(img, 1170, 560, "A coletividade e os particulares também podem ter responsabilidades.", "sans", 32, C["g1"], maxw=600, alpha=ease((S.t - S.at(0) - 3.0) / 0.7) * (1 - gone), lh=1.25)
        pill(img, 1170, 770, "TODOS TÊM DIREITOS E DEVERES DE RESPEITO", 30, C["gold"], C["navy0"], q * ease((S.t - S.at(0) - 4.5) / 0.7), padx=30)
    # quatro palavras finais
    f = S.p(1, 0.8, 0.1)
    if f > 0.01:
        text(img, 960, 200, "As quatro marcas distintivas", "sans_sb", 40, C["g1"], "m", f)
        tiles = [("UNIVERSALIDADE", "globe"), ("ESSENCIALIDADE", "gem"), ("SUPERIORIDADE\nNORMATIVA", "shield"), ("RECIPROCIDADE", "ring")]
        for i, (nm, ic) in enumerate(tiles):
            e = ease((S.t - S.at(1) - 0.5 - i * 0.55) / 0.7)
            x = 80 + i * 450
            card(img, x, 290 - (1 - e) * 24, 410, 420, e, outline=C["gold"], ow=3)
            cx, cy = x + 205, 430 - (1 - e) * 24
            if ic == "globe":
                put(img, icon("globe", 130, 130, col=C["g1"], width=5), cx, cy, e)
            elif ic == "gem":
                put(img, icon("gem", 130, 120, col=C["gold"], light=C["gold2"]), cx, cy, e)
            elif ic == "shield":
                put(img, icon("shield", 110, 130, col=C["gold"], inner=C["navy2"]), cx, cy, e)
                put(img, icon("check", 50, 50, col=C["gold2"], width=8), cx, cy - 4, e)
            else:
                _ring_people(img, cx, cy, 60, 5, S.t, e, 42)
            text(img, cx, 520 - (1 - e) * 24 + 0, f"{i + 1}", "sans_b", 30, C["gold"], "m", e)
            for j, ln in enumerate(nm.split("\n")):
                text(img, cx, 560 + j * 44 - (1 - e) * 24, ln, "serif_b", 33, C["white"], "m", e)
    ee = ease((S.t - S.at(1) - 3.0) / 0.8)
    text(img, 960, 770, "UNIVERSALIDADE — ESSENCIALIDADE — SUPERIORIDADE NORMATIVA — RECIPROCIDADE", "sans_b", 30, C["gold2"], "m", ee)


# ================================================================ CONSEQUÊNCIAS
def _wheel_person(sd, x, y, h, col):
    sd.circle(x + 6, y - 0.80 * h, 0.085 * h, fill=col)
    sd.line([(x + 4, y - 0.68 * h), (x - 2, y - 0.34 * h)], col, 0.15 * h)
    sd.line([(x - 2, y - 0.36 * h), (x + 0.30 * h, y - 0.34 * h), (x + 0.32 * h, y - 0.04 * h)], col, 0.075 * h)
    sd.line([(x + 6, y - 0.60 * h), (x + 0.24 * h, y - 0.46 * h)], col, 0.06 * h)
    sd.circle(x + 0.02 * h, y - 0.16 * h, 0.20 * h, outline=col, width=0.035 * h)
    sd.circle(x + 0.02 * h, y - 0.16 * h, 0.03 * h, fill=col)


def _people_row(img, y, alpha_list, t):
    specs = [("adult", 300, C["white"]), ("woman", 290, C["gold2"]), ("child", 190, C["teal"]), ("elder", 270, C["g1"]),
             ("wheel", 270, C["blue"]), ("adult", 285, C["gold2"]), ("teen", 235, C["white"])]
    xs = [300 + i * 220 for i in range(7)]
    for i, (kind, h, col) in enumerate(specs):
        a = alpha_list[i]
        if a < 0.01:
            continue
        x = xs[i]
        cy = y - h * 0.5
        sway = math.sin(t * 1.5 + i) * 2

        def fn(sd, kind=kind, h=h, col=col, i=i):
            ox, oy = 150, 360
            if kind == "wheel":
                _wheel_person(sd, ox - 15, oy, h, col)
                return
            draw_person(sd, ox, oy, h, col, 1, arms=(17 + 5 * math.sin(t * 2 + i), -17 - 5 * math.sin(t * 2 + i)), legs=(5, -5))
            if kind == "woman":
                sd.poly([(ox - 0.07 * h, oy - 0.62 * h), (ox + 0.07 * h, oy - 0.62 * h), (ox + 0.17 * h, oy - 0.22 * h), (ox - 0.17 * h, oy - 0.22 * h)], fill=col)
            if kind == "elder":
                sd.line([(ox + 0.2 * h, oy - 0.45 * h), (ox + 0.2 * h, oy)], C["gold"], 0.025 * h)
            if kind == "child":
                sd.circle(ox, oy - 0.98 * h, 0.04 * h, fill=C["gold"])
        dyn(img, x - 150, y - 360, 300, 380, fn, alpha=a)


def sc_consequencias1(S):
    img = S.img
    title(S, "Consequência 1: o direito a ter direitos")
    base = 640
    als = [S.p(0, 0.7, 0.3 + 0.2 * i) for i in range(7)]
    for i in range(7):
        x = 300 + i * 220
        halo = als[i]
        pul = 1 + 0.03 * math.sin(S.t * 2 + i)
        put(img, sprite("halo", 240, 240, lambda sd: (sd.circle(120, 120, 108, fill=mix(C["navy2"], C["gold"], 0.10)),
                                                         sd.circle(120, 120, 108, outline=C["gold"], width=3))), x, base - 140, halo * 0.9, scale=pul)
    _people_row(img, base, als, S.t)
    q1 = S.p(0, 0.8, 0.9)
    text(img, 960, 190, "Cada pessoa é reconhecida como", "sans", 38, C["g1"], "m", q1)
    text(img, 960, 236, "SUJEITO DE DIREITOS  ·  TITULAR DE PROTEÇÃO JURÍDICA", "sans_b", 40, C["gold2"], "m", q1)
    for i, s in enumerate(("RIQUEZA", "POSIÇÃO SOCIAL", "PRIVILÉGIOS")):
        e = ease((S.t - S.at(1) - 1.4 - i * 1.0) / 0.5)
        x = 480 + i * 480
        w = int(text_w(s, "sans_b", 32)) + 70
        pill(img, x, 745, s, 32, C["panel2"], C["g1"], S.p(1, 0.6, 0.0), padx=35)
        s_w = e * w
        img.paste(C["red"], (int(x - w / 2), 742, int(x - w / 2 + s_w), 748))
    text(img, 960, 818, "A dignidade humana não depende do que a pessoa tem.", "serif_i", 40, C["white"], "m", S.p(1, 0.8, 0.6))


def sc_consequencias2(S):
    img = S.img
    title(S, "Consequência 2: convivência e colisão de direitos", size=52)
    cx, cy, s = 960, 330, 560
    tl = 0.0
    if S.t > S.at(1):
        tl = 7 * math.sin((S.t - S.at(1)) * 2.4) * (1 - 0.5 * ease((S.t - S.at(2)) / 5))
    if S.t > S.at(2):
        d = S.t - S.at(2)
        tl = 9 * math.sin(d * 1.5) * math.exp(-d * 0.22)
    cen = {}

    def fn(sd):
        cen["c"] = draw_scales(sd, 330, 130, s, tl, C["white"], C["gold"])
    p0 = S.p(0, 0.9)
    dyn(img, cx - 330, cy - 130, 660, 130 + 460, fn, alpha=p0)
    # recalcula centros dos pratos (mesma geometria do desenho)
    r = math.radians(tl)
    L = 0.42 * s
    pl = (cx - math.cos(r) * L, cy + math.sin(r) * L + 0.34 * s)
    pr = (cx + math.cos(r) * L, cy - math.sin(r) * L + 0.34 * s)
    q1 = S.p(1, 0.8)
    put(img, icon("bubble", 100, 82, col=C["white"], ink=C["navy2"]), pl[0], pl[1] - 52, q1)
    put(img, icon("shield", 80, 92, col=C["gold"], inner=C["navy2"]), pr[0] + 4, pr[1] - 58, q1)
    put(img, icon("lock", 40, 44, col=C["gold2"], ink=C["navy2"]), pr[0] + 4, pr[1] - 54, q1, scale=0.9)
    text(img, pl[0], pl[1] + 54, "LIBERDADE DE EXPRESSÃO", "sans_b", 28, C["white"], "m", q1)
    text(img, pr[0], pr[1] + 54, "HONRA  ·  PRIVACIDADE", "sans_b", 28, C["gold2"], "m", q1)
    for i, s_ in enumerate(("Limites", "Ponderação", "Circunstâncias concretas")):
        e = ease((S.t - S.at(2) - 0.6 - i * 1.2) / 0.6)
        pill(img, 600 + i * 360, 790, s_.upper(), 26, C["panel2"], C["gold2"], e * (1 - S.p(3, 0.5)), padx=26)
    q3 = S.p(3, 0.8)
    card(img, 150, 740, 1620, 92, q3, fill=C["gold"], outline=None, r=46)
    text(img, 960, 762, "OS DIREITOS DEVEM CONVIVER COM OS DIREITOS DAS OUTRAS PESSOAS.", "sans_b", 35, C["navy0"], "m", q3)
    text(img, 960, 852, "Conflito não significa que um dos direitos deixa de existir.", "sans_i", 29, C["g1"], "m", ease((S.t - S.at(3) - 1.2) / 0.7))


# ===================================================================== QUADRO
QUADRO = [
    ("Conceito", "Liberdade, igualdade e dignidade"),
    ("Estrutura", "Pretensão, liberdade, poder e imunidade"),
    ("Cumprimento subjetivo", "Estado, particular ou ambos"),
    ("Cumprimento objetivo", "Conduta ativa ou passiva"),
    ("Conteúdo", "Valores essenciais reconhecidos juridicamente"),
    ("Fundamentalidade formal", "Reconhecimento formal"),
    ("Fundamentalidade material", "Conteúdo essencial à dignidade"),
    ("Marcas distintivas", "Universalidade, essencialidade, superioridade normativa e reciprocidade"),
    ("Consequências", "Direito a ter direitos e convivência entre direitos"),
]
QUADRO_SEG = [0, 0, 1, 1, 2, 2, 2, 3, 3]


def sc_quadro(S):
    img = S.img
    title(S, "Quadro de revisão final")
    x0, y0, rh = 120, 195, 64
    hd = S.p(0, 0.7)
    card(img, x0, y0, 1680, 58, hd, fill=C["gold"], outline=None, r=12)
    text(img, x0 + 30, y0 + 8, "TEMA", "sans_b", 30, C["navy0"], "l", hd)
    text(img, x0 + 590, y0 + 8, "PALAVRA OU IDEIA-CHAVE", "sans_b", 30, C["navy0"], "l", hd)
    cnt = {}
    for i, (a, b) in enumerate(QUADRO):
        k = QUADRO_SEG[i]
        j = cnt.get(k, 0)
        cnt[k] = j + 1
        e = ease((S.t - S.at(k) - 0.45 * j) / 0.6)
        y = y0 + 68 + i * rh
        cur = S.seg() == k
        card(img, x0 + (1 - e) * 80, y, 1680, rh - 6, e, fill=C["panel2"] if i % 2 == 0 else C["panel"], outline=C["gold"] if cur else None, r=10, ow=2)
        text(img, x0 + 30 + (1 - e) * 80, y + 10, a, "sans_b", 31, C["gold2"], "l", e)
        text(img, x0 + 590 + (1 - e) * 80, y + 10, b, "sans_sb", 29 if i == 7 else 31, C["white"], "l", e)


# ======================================================================== QUIZ
QUIZ = [
    ("Quais são os três valores centrais do conceito de Direitos Humanos?", "LIBERDADE  ·  IGUALDADE  ·  DIGNIDADE"),
    ("Quais são as quatro estruturas dos Direitos Humanos?", "PRETENSÃO  ·  LIBERDADE  ·  PODER  ·  IMUNIDADE"),
    ("Qual é a diferença entre o ponto de vista subjetivo e o objetivo, quanto ao cumprimento?", "SUBJETIVO = QUEM tem a incumbência\nOBJETIVO = QUAL conduta é exigida"),
    ("Qual é a diferença entre fundamentalidade formal e material?", "FORMAL = reconhecimento jurídico\nMATERIAL = conteúdo essencial à dignidade"),
    ("Quais são as quatro marcas distintivas dos Direitos Humanos?", "UNIVERSALIDADE  ·  ESSENCIALIDADE\nSUPERIORIDADE NORMATIVA  ·  RECIPROCIDADE"),
]


def sc_quiz(S):
    img = S.img
    g = min(4, S.seg() // 3)
    ph = S.seg() - g * 3
    base = g * 3
    q, a = QUIZ[g]
    for i in range(5):
        put(img, sprite(("qd", i <= g), 30, 30, lambda sd, on=(i <= g): sd.circle(15, 15, 11, fill=C["gold"] if on else C["panel"], outline=C["gold"], width=2)), 960 + (i - 2) * 56, 130)
    e = ease((S.t - S.at(base)) / 0.6)
    text(img, 960, 175, f"PERGUNTA {g + 1} DE 5", "sans_sb", 32, C["gold2"], "m")
    rich(img, 960, 250 + (1 - e) * 16, q, "serif_b", 60, C["white"], maxw=1500, a="m", alpha=e, lh=1.2)
    if ph == 1:
        d0, d1 = S.at(base + 1), S.at(base + 2)
        u = clamp((S.t - d0) / max(0.1, d1 - d0))
        cx, cy = 960, 600
        left = max(1, math.ceil((1 - u) * (d1 - d0)))
        dyn(img, cx - 100, cy - 100, 200, 200, lambda sd: (sd.circle(100, 100, 80, fill=C["panel"]),
                                                              sd.circle(100, 100, 80, outline=C["g3"], width=6),
                                                              sd.arc((20, 20, 180, 180), -90, -90 + 360 * (1 - u), C["gold"], 8)))
        text(img, cx, cy - 32, str(left), "serif_b", 66, C["white"], "m")
        text(img, cx, cy + 112, "PENSE ANTES DE VER A RESPOSTA…", "sans_sb", 30, C["g1"], "m")
    if ph == 2:
        r = S.p(base + 2, 0.7)
        lines = a.split("\n")
        hh = 70 + 62 * len(lines)
        card(img, 210, 570 - (1 - r) * 20, 1500, hh, r, fill=C["panel2"], outline=C["gold"], ow=4, r=26)
        put(img, icon("check", 50, 50, col=C["green"], width=9), 280, 570 + hh / 2 - (1 - r) * 20, r)
        for j, ln in enumerate(lines):
            text(img, 1000, 596 + j * 62 - (1 - r) * 20, ln, "sans_b", 40, C["gold2"], "m", r)


# ===================================================================== FINAL
def sc_final(S):
    img = S.img
    p = S.p(0, 0.9)
    text(img, 960, 150, "“", "serif_b", 200, C["gold"], "m", p * 0.8)
    paras = [("Mais importante do que decorar os termos é compreender a lógica dos Direitos Humanos:", 0),
             ("[[proteger a dignidade]], [[reconhecer cada pessoa como titular de direitos]]", 1),
             ("e [[permitir a convivência respeitosa entre todos]].", 2)]
    y = 270
    for s, k in paras:
        q = S.p(k, 0.9)
        rich(img, 960, y + (1 - q) * 18, s, "serif", 50, C["white"], hl=C["gold2"], maxw=1560, a="m", alpha=q, lh=1.2, hl_fk="serif_b")
        y += rich_height(s, "serif", 50, 1560, 1.2, "serif_b") + 12
    for i, (cap, ic) in enumerate((("DIGNIDADE", "shield"), ("TITULARES DE DIREITOS", "bust"), ("CONVIVÊNCIA RESPEITOSA", "ring"))):
        e = S.p(i, 0.8, 0.4)
        cx = 480 + i * 480
        put(img, sprite("fmed", 150, 150, lambda sd: (sd.circle(75, 75, 70, fill=C["panel"]), sd.circle(75, 75, 70, outline=C["gold"], width=3))), cx, 735, e)
        if ic == "shield":
            put(img, icon("shield", 62, 72, col=C["white"], inner=C["navy2"]), cx, 735, e)
            put(img, icon("heart", 26, 24, col=C["gold"]), cx, 731, e)
        elif ic == "bust":
            put(img, bust_icon(84, C["white"]), cx, 739, e)
        else:
            _ring_people(img, cx, 735, 32, 5, S.t, e, 30)
        text(img, cx, 822, cap, "sans_b", 24, C["gold2"], "m", e)
    b = S.p(3, 0.9)
    text(img, 960, 872, "Bons estudos!", "serif_b", 54, C["gold2"], "m", b)


SCENES = dict(abertura=sc_abertura, conceito=sc_conceito, estrutura1=sc_estrutura1, estrutura2=sc_estrutura2,
              cumprimento1=sc_cumprimento1, cumprimento2=sc_cumprimento2, conteudo=sc_conteudo,
              fundamentalidade=sc_fundamentalidade, marcas1=sc_marcas1, marcas2=sc_marcas2, marcas3=sc_marcas3,
              consequencias1=sc_consequencias1, consequencias2=sc_consequencias2, quadro=sc_quadro,
              quiz=sc_quiz, final=sc_final)

"""Storyboard da aula: narração (frases), textos de tela, animações e direção de arte — fonte única para vídeo, SRT e roteiro."""
from __future__ import annotations

import math

from PIL import Image, ImageDraw

from engine import (CYAN, GOLD, GOLD_SOFT, GRAY, GRAY_D, GREEN, NAVY, NAVY_2, NAVY_3, RED, WHITE, W, El, Phrase as P, Scene, arrow_el,
                    box, dyn, ease_io, icon, ico, panel, person_pose, pill, rgba, text_sprite, txt)

SCENES: list[Scene] = []
PERSON_COLORS = [WHITE, CYAN, GREEN, GOLD, (232, 160, 190), (170, 150, 235), (240, 200, 140)]


def new(sid, tag, block, phrases, **kw) -> Scene:
    sc = Scene(sid, tag, block, phrases, **kw)
    SCENES.append(sc)
    return sc


def card_sprite(w, h, title=None, body=None, icon_name=None, icon_size=120, border=GOLD_SOFT, title_size=40, body_size=32, title_col=GOLD):
    im = panel(w, h, NAVY_2, border)
    y = 24
    if icon_name:
        ic = icon(icon_name, icon_size)
        im.alpha_composite(ic, ((w - icon_size) // 2, y))
        y += icon_size + 14
    if title:
        t = text_sprite(title, title_size, title_col, "sans-bold", max_w=w - 40, align="center")
        im.alpha_composite(t, ((w - t.size[0]) // 2, y))
        y += t.size[1] + 6
    if body:
        b = text_sprite(body, body_size, WHITE, "sans", max_w=w - 56, align="center", line_h=1.3)
        im.alpha_composite(b, ((w - b.size[0]) // 2, y))
    return im


def card(sc, x, y, w, h, at, anchor="tl", **kw) -> El:
    return sc.add(El(lambda: card_sprite(w, h, **kw), x, y, anchor, at, 0.6, "fade_up", label=kw.get("title") or "[cartão]"))


def chip_sprite(icon_name, text, size=34, fill=NAVY_2, border=GOLD_SOFT, icon_px=64, max_w=None):
    t = text_sprite(text, size, WHITE, "sans-semi", max_w=max_w)
    ic = icon(icon_name, icon_px) if icon_name else None
    pad = 26
    w = t.size[0] + 2 * pad + ((icon_px + 14) if ic else 0)
    h = max(t.size[1], icon_px if ic else 0) + 30
    im = panel(w, h, fill, border, radius=h // 2, bw=2)
    x = pad
    if ic:
        im.alpha_composite(ic, (x, (h - icon_px) // 2))
        x += icon_px + 14
    im.alpha_composite(t, (x, (h - t.size[1]) // 2 - 2))
    return im


def chip(sc, x, y, icon_name, text, at, anchor="mm", **kw) -> El:
    return sc.add(El(lambda: chip_sprite(icon_name, text, **kw), x, y, anchor, at, 0.55, "fade_up", label=text))


def heading(sc, text, at=(0, 0.0), y=150, size=60, color=WHITE, kind="serif"):
    return sc.add(txt(text, 960, y, size, color, kind, "tc", at, align="center"))


def memo(sc, text, at, y=830, size=40):
    return sc.add(pill(text, 960, y, size=size, at=at))


# ============================================================================ ABERTURA
s = new("s00", "", 0, [
    P("Olá! Nesta aula você vai compreender, e não apenas decorar, os principais pontos sobre Direitos Humanos.", 0.35),
    P("Do conceito às consequências de uma sociedade pautada na sua defesa,", 0.12),
    P("e, no final, cinco perguntas de revisão.", 0.4),
], motif="scales", notes="Abertura: balança da Justiça surge com 'pop'; título serifado; linha dourada revelada em wipe; ícones de livro, tribunal e Constituição.")
s.add(ico("scales", 960, 300, 250, at=(0, 0.0)))
s.add(txt("DIREITOS HUMANOS", 960, 430, 120, WHITE, "serif", "tc", (0, 0.4), align="center"))
s.add(box(660, 590, 600, 6, (0, 1.0), fill=GOLD, border=GOLD, radius=3, anim="wipe", dur=0.8))
s.add(txt("Conceito · Estrutura · Cumprimento · Fundamentalidade · Marcas · Consequências", 960, 625, 36, GRAY, "sans-med", "tc", (1, 0.0), align="center"))
s.add(ico("book", 600, 790, 120, at=(1, 0.3)))
s.add(ico("courthouse", 960, 790, 120, at=(1, 0.6)))
s.add(ico("constitution", 1320, 790, 120, at=(1, 0.9)))
s.add(pill("5 perguntas de revisão ativa no final", 960, 880, size=32, at=(2, 0.0)))

# ============================================================================ BLOCO 1
s = new("s01", "BLOCO 1 · CONCEITO", 1, [
    P("Direitos Humanos são o conjunto de direitos considerados indispensáveis para uma vida humana,", 0.15),
    P("pautada na liberdade,", 0.1), P("na igualdade", 0.1), P("e na dignidade.", 0.4),
    P("A fórmula: liberdade, mais igualdade, mais dignidade.", 0.4),
    P("Esses direitos buscam proteger as pessoas e assegurar condições fundamentais para uma existência digna.", 0.4),
    P("No cotidiano, eles aparecem na liberdade de expressão,", 0.1), P("na igualdade perante a lei", 0.1),
    P("e na proteção contra tratamentos desumanos.", 0.7),
], motif="scales", notes="Três pilares surgem em sequência conforme as palavras são ditas; sinais '+' ligam os pilares; fórmula em destaque; três exemplos do cotidiano com ícones.")
heading(s, "O que são Direitos Humanos?", (0, 0.0), 120)
for i, (ic_, name, sub, ph) in enumerate((("chain", "LIBERDADE", "autonomia", 1), ("equal", "IGUALDADE", "mesma dignidade", 2), ("halo_person", "DIGNIDADE", "valor da pessoa", 3))):
    x = 120 + i * 560
    card(s, x, 210, 480, 270, (ph, 0.0), title=name, body=sub, icon_name=ic_, icon_size=120, title_size=44, body_size=30)
s.add(txt("+", 640, 300, 90, GOLD, "sans-bold", "tc", (2, 0.0)))
s.add(txt("+", 1200, 300, 90, GOLD, "sans-bold", "tc", (3, 0.0)))
s.add(El(lambda: panel(1380, 100, NAVY_3, GOLD, 50, 3), 960, 560, "mm", (4, 0.0), 0.6, "pop", label="[faixa]"))
s.add(txt("LIBERDADE + IGUALDADE + DIGNIDADE", 960, 560, 54, GOLD, "sans-bold", "mm", (4, 0.15), align="center", anim="fade"))
s.add(txt("proteger as pessoas  ·  condições fundamentais  ·  existência digna", 960, 650, 34, WHITE, "sans-med", "mm", (5, 0.0), align="center"))
chip(s, 370, 780, "megaphone", "Liberdade de expressão", (6, 0.0), size=30)
chip(s, 960, 780, "scales", "Igualdade perante a lei", (7, 0.0), size=30)
chip(s, 1545, 780, "shield", "Proteção contra tratamentos desumanos", (8, 0.0), max_w=290, size=28)

# ============================================================================ BLOCO 2
s = new("s02a", "BLOCO 2 · ESTRUTURA", 2, [
    P("Um mesmo direito pode ser compreendido por quatro estruturas diferentes.", 0.3),
    P("Não as confunda: cada uma mostra um modo de ver o direito.", 0.6),
], motif="book", notes="Nó central 'UM DIREITO' com quatro satélites ligados por setas que se revelam em wipe.")
s.add(El(lambda: panel(440, 150, NAVY_3, GOLD, 40, 3, glow=True), 960, 500, "mm", (0, 0.0), 0.6, "pop", label="[nó]"))
s.add(txt("UM DIREITO", 960, 500, 56, WHITE, "serif", "mm", (0, 0.2), anim="fade"))
for i, (name, x, y) in enumerate((("PRETENSÃO", 460, 280), ("LIBERDADE", 1460, 280), ("PODER", 460, 720), ("IMUNIDADE", 1460, 720))):
    cx = 960 + (-1 if x < 960 else 1) * 250
    cy = 500 + (-1 if y < 500 else 1) * 62
    s.add(arrow_el(cx, cy, x + (160 if x < 960 else -160), y + (45 if y < 500 else -45), GOLD_SOFT, 5, (1, 0.5 * i), "wipe", 0.5, 20))
    s.add(pill(name, x, y, size=44, at=(1, 0.5 * i + 0.2), fill=NAVY_3, color=GOLD, pad=(40, 22)))

def structure_scene(sid, n, name, phrases, notes):
    sc = new(sid, "BLOCO 2 · ESTRUTURA", 2, phrases, notes=notes)
    sc.add(El(lambda: panel(760, 92, NAVY_3, GOLD, 46, 3), 960, 160, "mm", (0, 0.0), 0.5, "pop", label="[faixa]"))
    sc.add(txt(f"{n} · {name}", 960, 160, 46, GOLD, "sans-bold", "mm", (0, 0.1), anim="fade"))
    return sc

s = structure_scene("s02b", 1, "DIREITO-PRETENSÃO", [
    P("Primeiro, o direito-pretensão: a possibilidade de exigir de alguém uma determinada conduta ou prestação.", 0.5),
    P("Exemplo ilustrativo: a pretensão de receber uma prestação de saúde,", 0.1),
    P("quando presentes os requisitos jurídicos aplicáveis.", 1.0),
], "Pessoa (titular) → seta 'EXIGE' → instituição obrigada; cartão de exemplo com cruz da saúde.")
s.add(ico("person", 560, 400, 210, at=(0, 0.3)))
s.add(txt("titular do direito", 560, 520, 30, GRAY, "sans-med", "tc", (0, 0.5), align="center"))
s.add(ico("courthouse", 1360, 400, 210, at=(0, 0.6)))
s.add(txt("quem deve a conduta", 1360, 520, 30, GRAY, "sans-med", "tc", (0, 0.8), align="center"))
s.add(arrow_el(700, 400, 1220, 400, GOLD, 10, (0, 1.2), "wipe", 0.9, 34))
s.add(pill("EXIGE", 960, 350, size=34, at=(0, 1.9)))
s.add(txt("Exigir de alguém uma conduta ou prestação", 960, 600, 46, WHITE, "sans-semi", "tc", (0, 2.6), align="center"))
chip(s, 960, 760, "cross", "Ex.: prestação de saúde, presentes os requisitos jurídicos", (1, 0.0), max_w=1100, size=34)

s = structure_scene("s02c", 2, "DIREITO-LIBERDADE", [
    P("Segundo, o direito-liberdade: protege uma esfera de autonomia da pessoa,", 0.1),
    P("que pode agir sem interferências indevidas.", 0.5),
    P("Exemplo: manifestar uma opinião, dentro dos limites jurídicos.", 1.0),
], "Pessoa no centro de um círculo (esfera de autonomia); setas vermelhas de interferência param na borda.")
s.add(El(lambda: _ring(430), 960, 430, "mm", (0, 0.2), 0.8, "pop", label="[esfera]"))
s.add(ico("person", 960, 430, 190, at=(0, 0.6)))
s.add(txt("esfera de autonomia", 960, 660, 32, GOLD, "sans-semi", "tc", (0, 1.2), align="center"))
s.add(arrow_el(420, 430, 735, 430, RED, 9, (1, 0.0), "wipe", 0.7, 30))
s.add(arrow_el(1500, 430, 1185, 430, RED, 9, (1, 0.3), "wipe", 0.7, 30))
s.add(pill("× interferência indevida", 540, 360, size=28, fill=RED, color=WHITE, at=(1, 0.8)))
s.add(pill("× interferência indevida", 1380, 360, size=28, fill=RED, color=WHITE, at=(1, 1.0)))
chip(s, 960, 780, "speech", "Ex.: manifestar uma opinião, dentro dos limites jurídicos", (2, 0.0), max_w=1100)

def _ring(d):
    im = Image.new("RGBA", (d + 40, d + 40), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.ellipse((20, 20, d + 20, d + 20), fill=rgba(NAVY_3, 150), outline=rgba(GOLD, 255), width=5)
    return im

s = structure_scene("s02d", 3, "DIREITO-PODER", [
    P("Terceiro, o direito-poder: a possibilidade de exercer uma competência", 0.1),
    P("ou de produzir efeitos jurídicos por meio de um ato reconhecido pelo Direito.", 0.5),
    P("Exemplo: exercer o direito de voto, observados os requisitos legais.", 1.0),
], "Pessoa pratica o ato (voto) → urna → efeito jurídico; seta e rótulos aparecem em sequência.")
s.add(ico("person", 520, 410, 210, at=(0, 0.2)))
s.add(arrow_el(660, 410, 880, 410, GOLD, 9, (0, 1.0), "wipe", 0.7, 30))
s.add(pill("ato reconhecido pelo Direito", 770, 325, size=24, at=(1, 0.0), fill=NAVY_3, color=GOLD))
s.add(ico("ballot", 1010, 410, 210, at=(1, 0.2)))
s.add(arrow_el(1150, 410, 1380, 410, GOLD, 9, (1, 1.0), "wipe", 0.7, 30))
s.add(pill("EFEITOS JURÍDICOS", 1560, 410, size=36, at=(1, 1.7)))
s.add(txt("Exercer uma competência / produzir efeitos jurídicos", 960, 590, 44, WHITE, "sans-semi", "tc", (1, 2.0), align="center"))
chip(s, 960, 760, "ballot", "Ex.: exercer o direito de voto, observados os requisitos legais", (2, 0.0), max_w=1100)

s = structure_scene("s02e", 4, "DIREITO-IMUNIDADE", [
    P("Quarto, o direito-imunidade: protege a pessoa contra determinadas formas de interferência", 0.1),
    P("ou de sujeição ao poder de outra pessoa ou autoridade.", 0.5),
    P("Exemplo ilustrativo: o poder de reformar a Constituição não pode ser usado", 0.1),
    P("para abolir os direitos e garantias individuais, que são cláusulas pétreas.", 1.0),
], "Autoridade tenta alcançar a pessoa; escudo bloqueia a seta vermelha. Exemplo das cláusulas pétreas.")
s.add(ico("courthouse", 440, 420, 200, at=(0, 0.2)))
s.add(txt("poder / autoridade", 440, 530, 28, GRAY, "sans-med", "tc", (0, 0.4), align="center"))
s.add(arrow_el(560, 420, 780, 420, RED, 9, (1, 0.0), "wipe", 0.8, 30))
s.add(ico("shield", 960, 420, 250, at=(0, 0.8), check=False))
s.add(ico("person", 960, 428, 120, at=(0, 1.2), col=GOLD))
s.add(pill("× bloqueado", 700, 350, size=28, fill=RED, color=WHITE, at=(1, 0.8)))
s.add(txt("pessoa protegida", 1400, 420, 38, WHITE, "sans-semi", "mm", (1, 0.2), align="center"))
s.add(txt("não se sujeita a esse poder", 1400, 475, 28, GRAY, "sans", "mm", (1, 0.5), align="center"))
chip(s, 960, 710, "constitution", "Ex. ilustrativo: o poder de reformar a Constituição não pode abolir os direitos e garantias individuais (cláusulas pétreas)",
     (2, 0.0), max_w=1300, size=30, icon_px=70)

s = new("s02f", "BLOCO 2 · ESTRUTURA", 2, [
    P("Pretensão, liberdade, poder e imunidade:", 0.15),
    P("quatro estruturas diferentes,", 0.15),
    P("e não quatro nomes para a mesma coisa.", 1.2),
], notes="Quadro 2×2 recapitulando as quatro estruturas; pausa longa final para fixação.")
heading(s, "As quatro estruturas", (0, 0.0), 120)
for i, (name, key, ic_) in enumerate((("PRETENSÃO", "exigir uma conduta ou prestação", "scales"), ("LIBERDADE", "agir sem interferências indevidas", "person"),
                                      ("PODER", "produzir efeitos jurídicos por ato reconhecido", "ballot"), ("IMUNIDADE", "proteção contra sujeição ao poder alheio", "shield"))):
    x, y = 200 + (i % 2) * 790, 230 + (i // 2) * 300
    card(s, x, y, 720, 260, (0, 0.5 * i), title=name, body=key, icon_name=ic_, icon_size=100, title_size=40, body_size=30)
s.add(pill("4 ESTRUTURAS ≠ 4 NOMES PARA A MESMA COISA", 960, 850, size=34, at=(2, 0.0)))

# ============================================================================ BLOCO 3
s = new("s03a", "BLOCO 3 · CUMPRIMENTO", 3, [
    P("Quanto ao cumprimento, há dois pontos de vista.", 0.25),
    P("No subjetivo, perguntamos: quem tem a incumbência de respeitar, proteger ou concretizar o direito?", 0.35),
    P("Pode ser incumbência do Estado, de um particular, ou de ambos.", 0.35),
    P("Ao Estado cabe, por exemplo, oferecer saúde e educação públicas;", 0.1),
    P("ao empregador particular, respeitar a dignidade de quem trabalha;", 0.1),
    P("e defender o meio ambiente é dever do Poder Público e da coletividade.", 0.35),
    P("Ou seja: proteger Direitos Humanos não é responsabilidade exclusiva do Estado.", 0.7),
], notes="Dois pontos de vista no topo; o subjetivo se destaca. Três cartões (Estado, particular, ambos) com um exemplo cada.")
s.add(pill("SUBJETIVO", 780, 150, size=36, at=(0, 0.2)))
s.add(pill("OBJETIVO", 1140, 150, size=36, at=(0, 0.8), fill=NAVY_3, color=GRAY))
s.add(txt("QUEM tem a incumbência?", 960, 215, 56, WHITE, "serif", "tc", (1, 0.0), align="center"))
for i, (ic_, name, ph, ex) in enumerate((("courthouse", "ESTADO", 2, "Ex.: oferecer saúde e educação públicas"), ("person", "PARTICULAR", 2, "Ex.: empregador que respeita a dignidade de quem trabalha"),
                                         ("people", "AMBOS", 2, "Ex.: defesa do meio ambiente — Poder Público e coletividade"))):
    x = 130 + i * 580
    card(s, x, 320, 520, 330, (ph, 0.35 * i), title=name, icon_name=ic_, icon_size=130, title_size=44)
    s.add(txt(ex, x + 260, 560, 28, WHITE, "sans", "tc", (3 + i, 0.0), max_w=470, align="center"))
s.add(El(lambda: panel(1500, 90, NAVY_3, GOLD, 45, 3), 960, 770, "mm", (6, 0.0), 0.6, "pop", label="[faixa]"))
s.add(txt("Proteção de Direitos Humanos ≠ responsabilidade exclusiva do Estado", 960, 770, 38, GOLD, "sans-bold", "mm", (6, 0.2), align="center", anim="fade"))

def _loop(fn, period=3.0):
    return lambda t: fn((t % period) / period)

s = new("s03b", "BLOCO 3 · CUMPRIMENTO", 3, [
    P("No ponto de vista objetivo, perguntamos: qual conduta é exigida?", 0.4),
    P("Conduta ativa: exige uma ação, uma prestação ou alguma medida para proteger ou efetivar o direito.", 0.4),
    P("Conduta passiva: exige abstenção, isto é, que alguém deixe de praticar uma interferência indevida.", 0.8),
], notes="À esquerda, figura humana levanta uma caixa (ação/prestação) em loop; à direita, autoridade estende a palma e se abstém, com selo de proibição.")
s.add(pill("OBJETIVO", 960, 150, size=36, at=(0, 0.0)))
s.add(txt("QUAL conduta é exigida?", 960, 205, 56, WHITE, "serif", "tc", (0, 0.2), align="center"))
s.add(box(110, 300, 800, 520, (1, 0.0), glow=False))
s.add(txt("CONDUTA ATIVA", 510, 330, 44, GOLD, "sans-bold", "tc", (1, 0.1), align="center"))
s.add(dyn(_loop(lambda p: person_pose(230, min(1.0, p * 1.6), "action")), 510, 520, "mm", (1, 0.3)))
s.add(txt("ação · prestação · medida", 510, 650, 34, WHITE, "sans-med", "tc", (1, 0.6), align="center"))
s.add(txt("Ex.: oferecer vagas em escola pública", 510, 715, 28, GRAY, "sans", "tc", (1, 1.0), align="center"))
s.add(box(1010, 300, 800, 520, (2, 0.0)))
s.add(txt("CONDUTA PASSIVA", 1410, 330, 44, GOLD, "sans-bold", "tc", (2, 0.1), align="center"))
s.add(dyn(_loop(lambda p: person_pose(230, min(1.0, p * 1.6), "stop")), 1410, 520, "mm", (2, 0.3)))
s.add(txt("abstenção · deixar de interferir", 1410, 650, 34, WHITE, "sans-med", "tc", (2, 0.6), align="center"))
s.add(txt("Ex.: não censurar previamente uma opinião", 1410, 715, 28, GRAY, "sans", "tc", (2, 1.0), align="center"))

s = new("s03c", "BLOCO 3 · CUMPRIMENTO", 3, [
    P("Para fixar:", 0.2), P("subjetivo é quem tem a incumbência;", 0.25), P("objetivo é qual conduta é exigida.", 0.4),
    P("Esta é uma síntese didática da classificação, e preserva o sentido jurídico dos conceitos.", 0.8),
], notes="Comparação visual lado a lado: SUBJETIVO = QUEM; OBJETIVO = QUAL.")
heading(s, "Cumprimento: dois pontos de vista", (0, 0.0), 120, 54)
card(s, 130, 230, 800, 400, (1, 0.0), title="SUBJETIVO", body="= QUEM tem a incumbência\n\nEstado · particular · ambos", icon_name="people", icon_size=110, title_size=48, body_size=36)
card(s, 990, 230, 800, 400, (2, 0.0), title="OBJETIVO", body="= QUAL conduta é exigida\n\nconduta ativa · conduta passiva", icon_name="scales", icon_size=110, title_size=48, body_size=36)
s.add(txt("×", 960, 380, 90, GOLD, "sans-bold", "mm", (2, 0.0), anim="fade"))
s.add(pill("síntese didática — o sentido jurídico dos conceitos é preservado", 960, 740, size=30, at=(3, 0.0), fill=NAVY_3, color=GOLD))

# ============================================================================ BLOCO 4
s = new("s04", "BLOCO 4 · CONTEÚDO", 4, [
    P("O conteúdo dos Direitos Humanos são valores essenciais,", 0.15),
    P("retratados expressa ou implicitamente nas Constituições e nos tratados internacionais.", 0.4),
    P("Valores como dignidade, liberdade, igualdade e proteção da pessoa humana.", 0.4),
    P("Essa proteção pode estar escrita no texto jurídico, ou decorrer da sua interpretação.", 0.8),
], notes="Constituição e tratado internacional ligados a um núcleo de valores; palavras-chave orbitam; rótulos EXPRESSO × IMPLÍCITO.")
s.add(ico("constitution", 330, 400, 250, at=(1, 0.0)))
s.add(txt("Constituição", 330, 545, 36, WHITE, "sans-semi", "tc", (1, 0.3), align="center"))
s.add(ico("treaty", 1590, 400, 250, at=(1, 0.5)))
s.add(txt("Tratado internacional", 1590, 545, 36, WHITE, "sans-semi", "tc", (1, 0.8), align="center"))
s.add(El(lambda: panel(560, 170, NAVY_3, GOLD, 40, 3, glow=True), 960, 400, "mm", (0, 0.0), 0.6, "pop", label="[núcleo]"))
s.add(txt("VALORES\nESSENCIAIS", 960, 400, 52, GOLD, "serif", "mm", (0, 0.2), align="center", anim="fade", line_h=1.1))
s.add(arrow_el(620, 400, 680, 400, GOLD_SOFT, 5, (1, 0.2), "wipe", 0.4, 18))
s.add(arrow_el(1300, 400, 1240, 400, GOLD_SOFT, 5, (1, 0.9), "wipe", 0.4, 18))
for i, (w_, x, y) in enumerate((("dignidade", 640, 235), ("liberdade", 1280, 235), ("igualdade", 640, 650), ("proteção da pessoa humana", 1280, 650))):
    s.add(pill(w_, x, y, size=34, at=(2, 0.9 * i), fill=NAVY_3, color=WHITE))
s.add(pill("EXPRESSO no texto jurídico", 600, 790, size=34, at=(3, 0.0)))
s.add(pill("IMPLÍCITO: decorre da interpretação", 1320, 790, size=34, at=(3, 1.8), fill=GOLD_SOFT))

# ============================================================================ BLOCO 5
s = new("s05", "BLOCO 5 · FUNDAMENTALIDADE", 5, [
    P("Este é um dos pontos mais importantes da aula:", 0.15),
    P("a fundamentalidade pode ser formal ou material.", 0.4),
    P("Fundamentalidade formal relaciona-se à inscrição, ou ao reconhecimento, do direito em um instrumento jurídico,", 0.1),
    P("como a Constituição ou um tratado internacional, conforme o contexto jurídico considerado.", 0.1),
    P("Aqui, o foco é a dimensão formal do reconhecimento normativo.", 0.5),
    P("Fundamentalidade material relaciona-se ao conteúdo do direito:", 0.1),
    P("ele é indispensável para a promoção da dignidade humana?", 0.6),
    P("Para memorizar:", 0.2), P("formal, reconhecimento jurídico;", 0.2), P("material, importância do conteúdo para a dignidade humana.", 0.3),
    P("São atalhos de memória, e não definições exaustivas.", 0.9),
], notes="Comparação em duas colunas: FORMAL (instrumento jurídico) × MATERIAL (conteúdo/dignidade); faixas de memorização ao final, com aviso de que não são definições exaustivas.")
heading(s, "Fundamentalidade: formal × material", (0, 0.0), 120, 54)
card(s, 100, 200, 820, 450, (2, 0.0), title="FORMAL", icon_name="constitution", icon_size=120, title_size=48,
     body="Inscrição / reconhecimento do direito em instrumento jurídico:\nConstituição ou tratado, conforme o contexto")
s.add(txt("dimensão formal do reconhecimento normativo", 510, 590, 28, GOLD, "sans-semi", "tc", (4, 0.0), align="center"))
card(s, 1000, 200, 820, 450, (5, 0.0), title="MATERIAL", icon_name="halo_person", icon_size=120, title_size=48,
     body="Conteúdo do direito:\né indispensável para a promoção da dignidade humana?")
s.add(box(160, 680, 1600, 84, (8, 0.0), fill=NAVY_3, border=GOLD, radius=42))
s.add(txt("FORMAL = RECONHECIMENTO JURÍDICO", 960, 722, 42, GOLD, "sans-bold", "mm", (8, 0.1), anim="fade", align="center"))
s.add(box(160, 780, 1600, 84, (9, 0.0), fill=NAVY_3, border=GOLD, radius=42))
s.add(txt("MATERIAL = IMPORTÂNCIA DO CONTEÚDO PARA A DIGNIDADE HUMANA", 960, 822, 38, GOLD, "sans-bold", "mm", (9, 0.1), anim="fade", align="center"))
s.add(txt("recursos de memorização — não são definições jurídicas exaustivas", 960, 880, 28, GRAY, "sans-med", "tc", (10, 0.0), align="center"))

# ============================================================================ BLOCO 6
def mark_scene(sid, n, name, phrases, notes, memo_text, memo_at):
    sc = new(sid, "BLOCO 6 · MARCAS DISTINTIVAS", 6, phrases, notes=notes)
    sc.add(El(lambda: panel(1100, 130, NAVY_3, GOLD, 40, 3, glow=True), 960, 200, "mm", (0, 0.0), 0.6, "pop", label="[cartão]"))
    sc.add(txt(f"{n}", 470, 200, 80, GOLD, "serif", "mm", (0, 0.1), anim="fade"))
    sc.add(txt(name, 1000, 200, 56 if len(name) < 20 else 46, WHITE, "sans-bold", "mm", (0, 0.2), anim="fade", align="center"))
    memo(sc, memo_text, memo_at, 830, 40)
    return sc

s = mark_scene("s06a", 1, "UNIVERSALIDADE", [
    P("Primeira marca: universalidade.", 0.2),
    P("Os Direitos Humanos são reconhecidos como direitos de todas as pessoas,", 0.1),
    P("sem que a sua proteção dependa de privilégios pessoais.", 0.6),
], "Fileira de pessoas diversas surge uma a uma, todas com a mesma moldura de proteção.", "DIREITOS DE TODOS", (2, 0.0))
for i, col in enumerate(PERSON_COLORS):
    s.add(ico("person", 330 + i * 210, 470, 150, at=(1, 0.35 * i), col=col))
s.add(txt("sem privilégios pessoais", 960, 640, 40, WHITE, "sans-semi", "tc", (2, 0.0), align="center"))

s = mark_scene("s06b", 2, "ESSENCIALIDADE", [
    P("Segunda marca: essencialidade.", 0.2),
    P("Representam valores indispensáveis à pessoa humana, que devem ser protegidos.", 0.7),
], "Escudo com o selo de verificação protege a figura humana.", "VALORES INDISPENSÁVEIS", (1, 0.6))
s.add(ico("shield", 960, 480, 280, at=(1, 0.0), check=False))
s.add(ico("person", 960, 488, 135, at=(1, 0.4), col=GOLD))
s.add(txt("valores indispensáveis à pessoa humana", 960, 665, 40, WHITE, "sans-semi", "tc", (1, 0.9), align="center"))

s = mark_scene("s06c", 3, "SUPERIORIDADE NORMATIVA", [
    P("Terceira marca: superioridade normativa, também chamada de preferenciabilidade.", 0.3),
    P("É a ideia de especial importância normativa atribuída aos Direitos Humanos em relação às demais normas,", 0.1),
    P("respeitado o contexto constitucional e internacional.", 0.4),
    P("Atenção: isso não significa que toda norma de Direitos Humanos prevalece automaticamente sobre qualquer outra.", 0.4),
    P("Havendo conflito entre normas, é preciso fazer uma análise jurídica adequada.", 0.7),
], "Degraus normativos com destaque para Direitos Humanos; alerta 'NÃO é prevalência automática'; balança de análise jurídica.", "PROTEÇÃO NORMATIVA ESPECIAL", (2, 0.0))
s.add(txt("também: preferenciabilidade", 960, 285, 32, GRAY, "sans-med", "tc", (0, 1.8), align="center"))
s.add(box(380, 360, 1160, 90, (1, 0.0), fill=NAVY_3, border=GOLD, radius=20, glow=False))
s.add(txt("★  NORMAS DE DIREITOS HUMANOS — especial importância normativa", 960, 405, 30, GOLD, "sans-bold", "mm", (1, 0.2), anim="fade", align="center"))
s.add(box(380, 470, 1160, 80, (1, 0.9), fill=NAVY_2, border=GRAY_D, radius=20))
s.add(txt("demais normas", 960, 510, 34, WHITE, "sans", "mm", (1, 1.0), anim="fade", align="center"))
s.add(txt("respeitado o contexto constitucional e internacional", 960, 580, 30, GRAY, "sans-med", "tc", (2, 0.0), align="center"))
s.add(ico("warn", 330, 690, 100, at=(3, 0.0)))
s.add(txt("NÃO é prevalência automática", 960, 690, 46, GOLD, "sans-bold", "mm", (3, 0.2), align="center"))
s.add(dyn(lambda t: icon("scales", 130, tilt=7 * math.sin(t * 1.4) * math.exp(-t * 0.12)), 1590, 690, "mm", (4, 0.0)))
s.add(txt("conflito ⇒ análise jurídica adequada", 960, 745, 36, WHITE, "sans-semi", "mm", (4, 0.2), align="center"))

s = mark_scene("s06d", 4, "RECIPROCIDADE", [
    P("Quarta marca: reciprocidade.", 0.2),
    P("Os Direitos Humanos envolvem direitos de todas as pessoas e deveres de respeito e proteção", 0.1),
    P("que não se limitam à atuação do Estado:", 0.2),
    P("a coletividade e os particulares também podem ter responsabilidades.", 0.6),
], "Pessoas em círculo ligadas por setas de ida e volta: DIREITOS ↔ DEVERES DE RESPEITO.", "TODOS TÊM DIREITOS E DEVERES DE RESPEITO", (3, 0.5))
s.add(ico("people", 960, 480, 230, at=(1, 0.0)))
s.add(arrow_el(700, 440, 420, 440, GOLD, 8, (1, 0.8), "wipe", 0.7, 28))
s.add(arrow_el(1220, 440, 1500, 440, GOLD, 8, (1, 1.2), "wipe", 0.7, 28))
s.add(pill("DIREITOS de todas as pessoas", 330, 380, size=30, at=(1, 1.4), fill=NAVY_3, color=GOLD))
s.add(pill("DEVERES de respeito e proteção", 1590, 380, size=30, at=(1, 1.8), fill=NAVY_3, color=GOLD))
s.add(txt("não só o Estado: coletividade e particulares", 960, 640, 40, WHITE, "sans-semi", "tc", (2, 0.0), align="center"))
s.add(ico("courthouse", 640, 725, 80, at=(3, 0.0)))
s.add(ico("people", 1280, 725, 80, at=(3, 0.3)))

s = new("s06e", "BLOCO 6 · MARCAS DISTINTIVAS", 6, [
    P("Universalidade, essencialidade, superioridade normativa e reciprocidade:", 0.3),
    P("estas são as quatro marcas distintivas dos Direitos Humanos.", 1.0),
], notes="Tela de fechamento do bloco com as quatro palavras em sequência.")
heading(s, "As quatro marcas distintivas", (0, 0.0), 130, 56)
for i, (nm, ic_) in enumerate((("UNIVERSALIDADE", "people"), ("ESSENCIALIDADE", "shield"), ("SUPERIORIDADE\nNORMATIVA", "constitution"), ("RECIPROCIDADE", "scales"))):
    card(s, 110 + i * 440, 270, 400, 330, (0, 0.5 + 0.9 * i), title=nm, icon_name=ic_, icon_size=130, title_size=34)
s.add(txt("UNIVERSALIDADE — ESSENCIALIDADE — SUPERIORIDADE NORMATIVA — RECIPROCIDADE", 960, 700, 34, GOLD, "sans-bold", "mm", (1, 0.0), align="center", max_w=1700))

# ============================================================================ BLOCO 7
s = new("s07a", "BLOCO 7 · CONSEQUÊNCIAS", 7, [
    P("Uma sociedade pautada na defesa dos Direitos Humanos tem duas consequências centrais.", 0.4),
    P("A primeira: o reconhecimento do direito a ter direitos.", 0.4),
    P("Cada pessoa deve ser reconhecida como sujeito de direitos e titular de proteção jurídica,", 0.15),
    P("e a dignidade humana não depende de riqueza, posição social ou privilégios.", 0.8),
], notes="Duas consequências em destaque (a primeira acende); pessoas diversas surgem com halo de dignidade; riqueza/posição/privilégios aparecem riscados.")
s.add(pill("1  DIREITO A TER DIREITOS", 560, 180, size=34, at=(0, 0.6)))
s.add(pill("2  CONVIVÊNCIA E COLISÃO DE DIREITOS", 1340, 180, size=34, at=(0, 1.2), fill=NAVY_3, color=GRAY))
s.add(txt("Direito a ter direitos", 960, 260, 60, WHITE, "serif", "tc", (1, 0.0), align="center"))
for i, col in enumerate(PERSON_COLORS):
    s.add(ico("halo_person", 300 + i * 220, 500, 160, at=(2, 0.35 * i), col=col))
s.add(txt("SUJEITO DE DIREITOS · TITULAR DE PROTEÇÃO JURÍDICA", 960, 650, 38, GOLD, "sans-bold", "tc", (2, 0.4), align="center"))
for i, w_ in enumerate(("riqueza", "posição social", "privilégios")):
    x = 520 + i * 440
    s.add(pill(w_, x, 780, size=36, at=(3, 0.9 * i), fill=NAVY_3, color=WHITE))
    s.add(box(x - 130, 778, 260, 5, (3, 0.9 * i + 0.5), fill=RED, border=RED, radius=2, anim="wipe", dur=0.5))
s.add(txt("a dignidade não depende de:", 960, 705, 30, GRAY, "sans-med", "tc", (3, 0.0), align="center"))

s = new("s07b", "BLOCO 7 · CONSEQUÊNCIAS", 7, [
    P("A segunda: a convivência e a colisão de direitos.", 0.3),
    P("Os direitos de uma pessoa convivem com os direitos das demais.", 0.3),
    P("Às vezes, dois direitos entram em tensão.", 0.25),
    P("Então o Direito estabelece limites, pondera interesses e identifica qual proteção deve prevalecer nas circunstâncias concretas,", 0.1),
    P("conforme os critérios jurídicos aplicáveis.", 0.4),
    P("Exemplo didático: a liberdade de expressão em conflito com a honra ou a privacidade de outra pessoa.", 0.4),
    P("O conflito não significa que um dos direitos deixa de existir.", 0.5),
    P("Os direitos devem conviver com os direitos das outras pessoas.", 1.2),
], notes="Balança animada que oscila e se estabiliza (ponderação); duas pontas: liberdade de expressão × honra/privacidade; faixa final dourada com a frase-chave.")
s.add(txt("Convivência e colisão de direitos", 960, 120, 56, WHITE, "serif", "tc", (0, 0.0), align="center"))
s.add(dyn(lambda t: icon("scales", 400, tilt=(14 * math.exp(-t * 0.35)) * math.sin(t * 1.5) if t > 4 else 4 * math.sin(t * 1.0)), 960, 430, "mm", (1, 0.0)))
s.add(El(lambda: chip_sprite("speech", "LIBERDADE DE EXPRESSÃO", 30, icon_px=56), 400, 640, "mm", (5, 0.0), 0.5, "fade_up", label="liberdade de expressão"))
s.add(El(lambda: chip_sprite("shield", "HONRA · PRIVACIDADE", 30, icon_px=56), 1500, 640, "mm", (5, 0.9), 0.5, "fade_up", label="honra privacidade"))
s.add(txt("limites · ponderação de interesses · circunstâncias concretas", 960, 235, 32, GOLD, "sans-semi", "tc", (3, 0.0), align="center"))
s.add(pill("conflito ≠ um dos direitos deixa de existir", 960, 745, size=32, at=(6, 0.0), fill=NAVY_3, color=WHITE))
s.add(El(lambda: panel(1700, 110, NAVY_3, GOLD, 55, 4, glow=True), 960, 840, "mm", (7, 0.0), 0.7, "pop", label="[faixa final]"))
s.add(txt("OS DIREITOS DEVEM CONVIVER COM OS DIREITOS DAS OUTRAS PESSOAS.", 960, 840, 40, GOLD, "sans-bold", "mm", (7, 0.2), anim="fade", align="center", max_w=1600))

# ============================================================================ QUADRO FINAL
s = new("s08", "REVISÃO FINAL", 7, [
    P("Revisão rápida.", 0.2),
    P("Conceito: liberdade, igualdade e dignidade.", 0.15),
    P("Estrutura: pretensão, liberdade, poder e imunidade.", 0.15),
    P("Cumprimento subjetivo: Estado, particular ou ambos;", 0.1),
    P("objetivo: conduta ativa ou passiva.", 0.15),
    P("Conteúdo: valores essenciais reconhecidos juridicamente.", 0.15),
    P("Fundamentalidade formal: reconhecimento formal;", 0.1),
    P("material: conteúdo essencial à dignidade.", 0.15),
    P("Marcas: universalidade, essencialidade, superioridade normativa e reciprocidade.", 0.15),
    P("Consequências: direito a ter direitos e convivência entre direitos.", 0.8),
], notes="Quadro-resumo condensado; cada linha entra quando é narrada.")
ROWS = [("Conceito", "Liberdade, igualdade e dignidade", 1), ("Estrutura", "Pretensão, liberdade, poder e imunidade", 2),
        ("Cumprimento subjetivo", "Estado, particular ou ambos", 3), ("Cumprimento objetivo", "Conduta ativa ou passiva", 4),
        ("Conteúdo", "Valores essenciais reconhecidos juridicamente", 5), ("Fundamentalidade formal", "Reconhecimento formal", 6),
        ("Fundamentalidade material", "Conteúdo essencial à dignidade", 7),
        ("Marcas distintivas", "Universalidade, essencialidade, superioridade normativa e reciprocidade", 8),
        ("Consequências", "Direito a ter direitos e convivência entre direitos", 9)]

def row_sprite(a, b, header=False):
    h = 70
    im = Image.new("RGBA", (1700, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 2, 1699, h - 2), radius=14, fill=rgba(NAVY_3 if header else NAVY_2, 235), outline=rgba(GOLD if header else GOLD_SOFT), width=2)
    ta = text_sprite(a, 30, GOLD, "sans-bold")
    tb = text_sprite(b, 28 if len(b) > 60 else 32, WHITE, "sans-semi" if header else "sans")
    im.alpha_composite(ta, (24, (h - ta.size[1]) // 2 - 1))
    im.alpha_composite(tb, (590, (h - tb.size[1]) // 2 - 1))
    return im

s.add(El(lambda: row_sprite("TEMA", "PALAVRA OU IDEIA-CHAVE", True), 110, 150, "tl", (0, 0.0), 0.5, "fade_up", label="TEMA | PALAVRA OU IDEIA-CHAVE"))
for i, (a, b, ph) in enumerate(ROWS):
    s.add(El(lambda a=a, b=b: row_sprite(a, b), 110, 230 + i * 78, "tl", (ph, 0.0), 0.5, "fade_up", label=f"{a} | {b}"))

# ============================================================================ REVISÃO ATIVA
QUIZ = [
    ("Quais são os três valores centrais do conceito de Direitos Humanos?", "Liberdade, igualdade e dignidade.", "Liberdade, igualdade e dignidade."),
    ("Quais são as quatro estruturas dos Direitos Humanos?", "Direito-pretensão, direito-liberdade, direito-poder e direito-imunidade.",
     "Direito-pretensão, direito-liberdade, direito-poder e direito-imunidade."),
    ("Qual é a diferença entre o ponto de vista subjetivo e o objetivo quanto ao cumprimento?",
     "Subjetivo: quem tem a incumbência (Estado, particular ou ambos).\nObjetivo: qual conduta é exigida (ativa ou passiva).",
     "Subjetivo: quem tem a incumbência. Objetivo: qual conduta é exigida."),
    ("Qual é a diferença entre fundamentalidade formal e material?",
     "Formal: reconhecimento jurídico em instrumento normativo.\nMaterial: importância do conteúdo para a dignidade humana.",
     "Formal: reconhecimento jurídico. Material: importância do conteúdo para a dignidade humana."),
    ("Quais são as quatro marcas distintivas dos Direitos Humanos?", "Universalidade, essencialidade, superioridade normativa e reciprocidade.",
     "Universalidade, essencialidade, superioridade normativa e reciprocidade."),
]

def countdown(t):
    n = max(1, 3 - int(t / 0.85))
    p = (t % 0.85) / 0.85
    im = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((10, 10, 190, 190), outline=rgba(GRAY_D), width=10)
    d.arc((10, 10, 190, 190), -90, -90 + 360 * (1 - p), fill=rgba(GOLD), width=10)
    tt = text_sprite(str(n), 100, GOLD, "serif", align="center")
    im.alpha_composite(tt, ((200 - tt.size[0]) // 2, (200 - tt.size[1]) // 2 - 6))
    return im

for i, (q, a_screen, a_spoken) in enumerate(QUIZ, start=1):
    s = new(f"q{i}", f"REVISÃO ATIVA · PERGUNTA {i} DE 5", 7, [P(q, 0.1), P("", 2.6), P(a_spoken, 0.9)],
            notes="Pergunta na tela e lida; contagem regressiva para o aluno pensar; resposta revelada e lida.", tail=0.3)
    s.add(ico("question", 960, 215, 130, at=(0, 0.0)))
    s.add(txt(q, 960, 320, 50, WHITE, "serif", "tc", (0, 0.2), max_w=1500, align="center"))
    s.add(dyn(countdown, 960, 640, "mm", (1, 0.0), until=(2, 0.0)))
    s.add(txt("pense antes de ver a resposta…", 960, 760, 32, GRAY, "sans-med", "tc", (1, 0.3), align="center", until=(2, 0.0)))
    s.add(El(lambda a=a_screen: panel(1500, 240 if "\n" in a else 190, NAVY_3, GOLD, 36, 3, glow=True), 960, 640, "mm", (2, 0.0), 0.6, "pop", label="[resposta]"))
    s.add(txt(a_screen, 960, 640, 44, GOLD, "sans-bold", "mm", (2, 0.15), max_w=1400, align="center", anim="fade"))

# ============================================================================ ENCERRAMENTO
s = new("s10", "", 7, [
    P("Mais importante do que decorar os termos é compreender a lógica dos Direitos Humanos:", 0.2),
    P("proteger a dignidade,", 0.15),
    P("reconhecer cada pessoa como titular de direitos", 0.15),
    P("e permitir a convivência respeitosa entre todos.", 1.6),
], motif="scales", tail=1.0, notes="Mensagem final em linhas progressivas; fade-out para preto.")
s.add(ico("scales", 960, 230, 200, at=(0, 0.0)))
s.add(txt("“Mais importante do que decorar os termos é compreender a lógica dos Direitos Humanos:", 960, 400, 46, WHITE, "serif", "tc", (0, 0.4), max_w=1500, align="center"))
s.add(txt("proteger a dignidade,", 960, 570, 50, GOLD, "sans-bold", "tc", (1, 0.0), align="center"))
s.add(txt("reconhecer cada pessoa como titular de direitos", 960, 645, 50, GOLD, "sans-bold", "tc", (2, 0.0), align="center"))
s.add(txt("e permitir a convivência respeitosa entre todos.”", 960, 720, 50, GOLD, "sans-bold", "tc", (3, 0.0), align="center"))

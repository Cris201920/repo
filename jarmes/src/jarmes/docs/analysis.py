"""Análises LOCAIS (sem internet/IA) de texto: resumo extrativo, temas, flashcards-cloze, esboço/mapa mental."""
from __future__ import annotations

import re
from collections import Counter

STOPWORDS = set("""a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre entre até após
ante perante e ou mas nem que se como quando onde qual quais quem cujo cuja seu sua seus suas lhe lhes ele ela eles elas
isto isso aquilo este esta estes estas esse essa esses essas aquele aquela ao aos à às pelo pela pelos pelas já não sim mais
menos muito muita muitos muitas também só apenas ser é são foi foram será serão sendo seja sejam era eram há haver tem têm ter
terá terão tinha pode podem poder deve devem dever deverá cada todo toda todos todas outro outra outros outras mesmo mesma
art arts inciso incisos parágrafo caput lei lei§ nº n° ainda assim então porque pois onde qualquer quaisquer nele nela""".split())

_SENT_SPLIT = re.compile(r"(?<=[.!?;])\s+(?=[A-ZÀ-Ý0-9“\"(§])")
_WORD = re.compile(r"[A-Za-zÀ-ÿ]{3,}")


def sentences(text: str) -> list[str]:
    # títulos (linhas '#', ou curtas sem pontuação final) não são frases
    lines = [ln for ln in text.splitlines()
             if not ln.lstrip().startswith("#") and not (len(ln.strip()) < 60 and ln.strip() and not ln.strip().endswith((".", ";", ":", "!", "?")))]
    flat = re.sub(r"\s*\n\s*", " ", "\n".join(lines))
    return [s.strip() for s in _SENT_SPLIT.split(flat) if 30 <= len(s.strip()) <= 400]


def keywords(text: str, n: int = 15) -> list[tuple[str, int]]:
    words = [w.lower() for w in _WORD.findall(text)]
    counts = Counter(w for w in words if w not in STOPWORDS and len(w) > 3)
    return counts.most_common(n)


def bigrams(text: str, n: int = 10) -> list[tuple[str, int]]:
    words = [w.lower() for w in _WORD.findall(text)]
    pairs = Counter()
    for a, b in zip(words, words[1:]):
        if a in STOPWORDS or b in STOPWORDS or len(a) < 4 or len(b) < 4:
            continue
        pairs[f"{a} {b}"] += 1
    return [(p, c) for p, c in pairs.most_common(n) if c >= 2]


def extractive_summary(pages: list[tuple[int, str]], max_sentences: int = 8) -> list[tuple[int, str]]:
    """Seleciona as frases mais representativas (frequência de termos), preservando a ordem e a página."""
    all_text = " ".join(t for _, t in pages)
    freq = dict(keywords(all_text, 200))
    if not freq:
        return []
    top = max(freq.values())
    scored = []
    for page, text in pages:
        for idx, sent in enumerate(sentences(text)):
            toks = [w.lower() for w in _WORD.findall(sent)]
            score = sum(freq.get(w, 0) / top for w in toks) / (len(toks) ** 0.6 or 1)
            if idx == 0:
                score *= 1.1
            scored.append((score, page, idx, sent))
    best = sorted(scored, key=lambda x: x[0], reverse=True)[:max_sentences]
    return [(p, s) for _, p, _i, s in sorted(best, key=lambda x: (x[1], x[2]))]


_DEF_PATTERNS = [
    re.compile(r"^(?P<term>[A-ZÀ-Ý][\wÀ-ÿ \-]{3,60}?)\s+(?:é|são|consiste em|consistem em|corresponde a|significa|define-se como|considera-se)\s+(?P<rest>.+)$"),
    re.compile(r"^(?:Considera-se|Entende-se por|Denomina-se)\s+(?P<term>[\wÀ-ÿ \-]{3,60}?)\s*,?\s+(?P<rest>.+)$"),
]


def cloze_flashcards(pages: list[tuple[int, str]], limit: int = 15) -> list[dict]:
    """Cria flashcards a partir de frases definicionais e lacunas em termos-chave. Heurístico: revise antes de usar."""
    cards: list[dict] = []
    seen = set()
    for page, text in pages:
        for sent in sentences(text):
            for pat in _DEF_PATTERNS:
                m = pat.match(sent)
                if m and m.group("term").lower() not in seen:
                    term = m.group("term").strip()
                    seen.add(term.lower())
                    cards.append(dict(front=f"O que é/como se define: {term}?", back=sent, page=page))
                    break
            if len(cards) >= limit:
                return cards
    kws = [k for k, _ in keywords(" ".join(t for _, t in pages), 30)]
    for page, text in pages:
        for sent in sentences(text):
            for k in kws:
                if re.search(rf"\b{re.escape(k)}\b", sent, re.IGNORECASE) and len(sent) < 220:
                    front = re.sub(rf"\b{re.escape(k)}\b", "_____", sent, count=1, flags=re.IGNORECASE)
                    key = front[:60]
                    if key not in seen:
                        seen.add(key)
                        cards.append(dict(front=f"Complete: {front}", back=k, page=page))
                    break
            if len(cards) >= limit:
                return cards
    return cards


_HEADING = re.compile(r"^(?:#{1,3}\s+.+|(?:CAPÍTULO|TÍTULO|SEÇÃO|SEÇAO|PARTE|LIVRO)\b.+|(?:[IVXLC]+\s*[-–.)]\s+.+)|(?:\d{1,2}(?:\.\d{1,2})*[.)]?\s+[A-ZÀ-Ý].{3,80})|(?:[A-ZÀ-Ý][A-ZÀ-Ý \-]{6,80}))$")


def outline(pages: list[tuple[int, str]], max_items: int = 40) -> list[dict]:
    """Esboço hierárquico (base do mapa mental) a partir de títulos detectados; sem títulos, usa temas."""
    items = []
    for page, text in pages:
        for line in text.splitlines():
            line = line.strip()
            if 4 <= len(line) <= 90 and _HEADING.match(line) and not line.endswith((".", ",", ";")):
                level = 1 if line.startswith("# ") or re.match(r"^(CAPÍTULO|TÍTULO|PARTE|LIVRO)\b", line) else 2
                items.append(dict(level=level, title=line.lstrip("# ").strip(), page=page))
    if len(items) < 3:
        all_text = " ".join(t for _, t in pages)
        items = [dict(level=1, title="Temas centrais", page=None)]
        for k, c in keywords(all_text, 8):
            items.append(dict(level=2, title=f"{k} ({c}×)", page=None))
        for b, c in bigrams(all_text, 5):
            items.append(dict(level=2, title=f"expressão: {b} ({c}×)", page=None))
    return items[:max_items]


def outline_to_markdown(items: list[dict], title: str) -> str:
    lines = [f"# {title}"]
    for it in items:
        ref = f" _(p. {it['page']})_" if it.get("page") else ""
        lines.append(("  " * (it["level"] - 1)) + f"- {it['title']}{ref}")
    return "\n".join(lines)

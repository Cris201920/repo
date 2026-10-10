"""Interpretação simples e determinística de datas, horas, durações e disciplinas em português."""
from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timedelta

NUMBERS = {"um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7,
           "oito": 8, "nove": 9, "dez": 10, "onze": 11, "doze": 12, "quinze": 15, "vinte": 20, "trinta": 30,
           "quarenta": 40, "cinquenta": 50, "sessenta": 60}
WEEKDAY_WORDS = {"segunda": 0, "terca": 1, "quarta": 2, "quinta": 3, "sexta": 4, "sabado": 5, "domingo": 6}

DISCIPLINE_ALIASES = {
    "Direito Constitucional": ["direito constitucional", "constitucional", "constituicao"],
    "Direito Administrativo": ["direito administrativo", "administrativo"],
    "Direito Civil": ["direito civil", "civil"],
    "Direito Penal": ["direito penal", "penal"],
    "Direito Processual Civil": ["processo civil", "processual civil", "direito processual civil", "cpc"],
    "Direito Empresarial": ["direito empresarial", "empresarial", "comercial"],
    "Direito do Consumidor": ["direito do consumidor", "consumidor", "cdc"],
    "Estatuto da Criança e do Adolescente": ["eca", "crianca e do adolescente", "estatuto da crianca"],
    "Direito Digital": ["direito digital", "digital", "lgpd", "marco civil"],
    "Direitos Humanos": ["direitos humanos", "direito humanos"],
}


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t.lower()).strip()


def parse_date(text: str, today: date) -> date | None:
    t = norm(text)
    if "depois de amanha" in t:
        return today + timedelta(days=2)
    if "amanha" in t:
        return today + timedelta(days=1)
    if re.search(r"\bhoje\b", t):
        return today
    m = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", t)
    if m:
        d, mo = int(m.group(1)), int(m.group(2))
        y = int(m.group(3)) if m.group(3) else today.year
        if y < 100:
            y += 2000
        try:
            res = date(y, mo, d)
            if not m.group(3) and res < today:
                res = date(y + 1, mo, d)
            return res
        except ValueError:
            return None
    m = re.search(r"\bdia (\d{1,2})\b", t)
    if m:
        d = int(m.group(1))
        for add in range(0, 3):
            month = (today.month - 1 + add) % 12 + 1
            year = today.year + (today.month - 1 + add) // 12
            try:
                res = date(year, month, d)
            except ValueError:
                continue
            if res >= today:
                return res
    for word, wd in WEEKDAY_WORDS.items():
        if re.search(rf"\b{word}(?:-feira)?\b", t):
            delta = (wd - today.weekday()) % 7 or 7
            return today + timedelta(days=delta)
    return None


def parse_time(text: str) -> tuple[int, int] | None:
    t = norm(text)
    m = re.search(r"\b(?:as |a )?(\d{1,2})[:h](\d{2})\b", t)
    if m and int(m.group(1)) < 24 and int(m.group(2)) < 60:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"\b(\d{1,2}) ?h(?:oras?)?\b(?! de estudo)", t)
    if m and int(m.group(1)) < 24 and re.search(r"\bas \d{1,2} ?h|\b\d{1,2} ?h\b(?! ?(?:de|para|em|por))", t) and re.search(r"\bas\b", t):
        h = int(m.group(1))
        return (h + 12 if "da tarde" in t and h < 12 else h), 0
    m = re.search(r"\bas (\d{1,2}) (?:da manha|da tarde|da noite|horas)", t)
    if m:
        h = int(m.group(1))
        if ("tarde" in t or "noite" in t) and h < 12:
            h += 12
        return h, 0
    return None


def parse_duration_minutes(text: str) -> int | None:
    t = norm(text)
    m = re.search(r"(\w+) horas? e meia", t)
    if m:
        n = NUMBERS.get(m.group(1)) or (int(m.group(1)) if m.group(1).isdigit() else None)
        if n:
            return n * 60 + 30
    if re.search(r"\buma hora e meia\b", t):
        return 90
    if re.search(r"\bmeia hora\b", t):
        return 30
    m = re.search(r"(\d+)\s*h(?:oras?)?(?:\s*e?\s*(\d+)\s*(?:min\w*)?)?\b", t)
    if m and not re.search(r"\bas \d", t[:m.start() + 4]):
        return int(m.group(1)) * 60 + int(m.group(2) or 0)
    m = re.search(r"(\w+) horas?\b", t)
    if m:
        n = NUMBERS.get(m.group(1)) or (int(m.group(1)) if m.group(1).isdigit() else None)
        if n:
            return n * 60
    m = re.search(r"(\d+|\w+) min(?:utos?)?\b", t)
    if m:
        n = NUMBERS.get(m.group(1)) or (int(m.group(1)) if m.group(1).isdigit() else None)
        if n:
            return n
    return None


def find_disciplines(text: str, known: list[str] | None = None) -> list[str]:
    t = " " + norm(text) + " "
    found: list[tuple[int, str]] = []
    catalog = dict(DISCIPLINE_ALIASES)
    for name in known or []:
        catalog.setdefault(name, [norm(name)])
    for canonical, aliases in catalog.items():
        pos = None
        for a in sorted(aliases, key=len, reverse=True):
            m = re.search(rf"(?<![a-z]){re.escape(norm(a))}(?![a-z])", t)
            if m:
                pos = m.start() if pos is None else min(pos, m.start())
                break
        if pos is not None:
            found.append((pos, canonical))
    # "direito penal" também casa "penal": evita duplicar quando o alias longo já cobre
    found.sort()
    out: list[str] = []
    for _, name in found:
        if name not in out:
            out.append(name)
    return out

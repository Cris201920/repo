"""QConcursos: integração em modo MANUAL.

Não foi encontrada API pública/oficial nem termos que autorizem acesso automatizado (verificado em out/2026).
Por isso o JARMES NÃO faz login, scraping nem contorna CAPTCHA/controles de acesso, e NUNCA pede sua senha.
O que ele faz: abre o site no seu navegador, registra resultados informados por você e importa CSV que você mesmo
gerar/preencher."""
from __future__ import annotations

import csv
import re
import webbrowser
from datetime import date
from pathlib import Path

from .. import clock
from ..core.nlp import norm
from ..db import Database

QCONCURSOS_URL = "https://www.qconcursos.com/"
TERMS_URL = "https://www.qconcursos.com/termos-de-uso"

_HEADER_ALIASES = {
    "date": ["data", "date", "dia"],
    "discipline": ["disciplina", "materia", "discipline", "subject"],
    "topic": ["assunto", "topico", "topic", "tema"],
    "total": ["total", "questoes", "resolvidas", "respondidas", "quantidade"],
    "correct": ["acertos", "corretas", "correct", "certas"],
    "wrong": ["erros", "incorretas", "wrong", "erradas"],
}


class QConcursosModule:
    STATUS = ("manual", "Modo manual: sem API oficial verificada. Abra o site, resolva as questões e registre os resultados aqui "
                        "ou importe um CSV (data, disciplina, assunto, total, acertos).")

    def __init__(self, db: Database):
        self.db = db

    def open_site(self) -> bool:
        return webbrowser.open(QCONCURSOS_URL)

    def record(self, day: date, discipline: str, total: int, correct: int, topic: str = "", note: str = "",
               source: str = "manual") -> int:
        if not discipline.strip():
            raise ValueError("Informe a disciplina.")
        if total <= 0:
            raise ValueError("O total de questões deve ser maior que zero.")
        if correct < 0 or correct > total:
            raise ValueError("Acertos devem estar entre 0 e o total de questões.")
        return self.db.insert("question_results", dict(
            date=day.isoformat(), discipline=discipline.strip(), topic=topic.strip(), total=total, correct=correct,
            source=source, note=note, created_at=clock.iso(clock.now())))

    def import_csv(self, path: str | Path) -> dict:
        """Importa CSV fornecido pelo usuário. Linhas inválidas são ignoradas e relatadas (nada é inventado)."""
        path = Path(path)
        if path.suffix.lower() not in (".csv", ".txt"):
            raise ValueError("Use um arquivo .csv.")
        if path.stat().st_size > 5 * 1024 * 1024:
            raise ValueError("CSV grande demais (máximo 5 MB).")
        raw = path.read_text(encoding="utf-8-sig", errors="replace")
        dialect = csv.Sniffer().sniff(raw.splitlines()[0] if raw else ",", delimiters=",;\t") if raw else csv.excel
        reader = csv.reader(raw.splitlines(), dialect)
        rows = list(reader)
        if not rows:
            raise ValueError("CSV vazio.")
        header = [norm(h) for h in rows[0]]
        idx: dict[str, int] = {}
        for key, aliases in _HEADER_ALIASES.items():
            for i, h in enumerate(header):
                if h in aliases:
                    idx[key] = i
                    break
        if "discipline" not in idx or "total" not in idx or ("correct" not in idx and "wrong" not in idx):
            raise ValueError("Cabeçalho não reconhecido. Colunas esperadas: data, disciplina, assunto, total, acertos (ou erros).")
        ok, skipped = 0, []
        for n, row in enumerate(rows[1:], start=2):
            try:
                total = int(re.sub(r"\D", "", row[idx["total"]]))
                if "correct" in idx:
                    correct = int(re.sub(r"\D", "", row[idx["correct"]]))
                else:
                    correct = total - int(re.sub(r"\D", "", row[idx["wrong"]]))
                day = clock.parse_date(row[idx["date"]].strip()) if "date" in idx else clock.today()
                if day is None and "date" in idx:
                    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", row[idx["date"]].strip())
                    day = date(int(m.group(3)), int(m.group(2)), int(m.group(1))) if m else None
                if day is None:
                    raise ValueError("data")
                self.record(day, row[idx["discipline"]], total, correct,
                            row[idx["topic"]] if "topic" in idx and idx["topic"] < len(row) else "", source="qconcursos_csv")
                ok += 1
            except (ValueError, IndexError):
                skipped.append(n)
        return dict(imported=ok, skipped_lines=skipped)

    def weak_areas(self, min_questions: int = 10, limit: int = 5) -> list[dict]:
        rows = self.db.query(
            "SELECT discipline, SUM(total) t, SUM(correct) c FROM question_results GROUP BY discipline "
            "HAVING SUM(total) >= ? ORDER BY CAST(SUM(correct) AS REAL)/SUM(total) ASC LIMIT ?", (min_questions, limit))
        return [dict(discipline=r["discipline"], total=r["t"], correct=r["c"], rate=r["c"] / r["t"]) for r in rows]

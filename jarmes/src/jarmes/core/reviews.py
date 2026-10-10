"""Revisão espaçada: flashcards (SM-2 simplificado), revisões D+1/D+7/D+30 e caderno de erros."""
from __future__ import annotations

from datetime import date, timedelta

from .. import clock
from ..db import Database

REVIEW_STAGES = {1: 1, 2: 7, 3: 30}                     # estágio -> dias
ERROR_INTERVALS = [1, 3, 7, 15, 30, 60]
ERROR_CAUSES = ["Falta de conhecimento", "Confusão entre institutos", "Interpretação inadequada",
                "Desatenção", "Esquecimento de lei seca", "Dificuldade com jurisprudência"]


class FlashcardService:
    def __init__(self, db: Database):
        self.db = db

    def add(self, front: str, back: str, discipline: str = "Geral", *, source: str = "manual",
            doc_id: int | None = None, page: int | None = None) -> int:
        if not front.strip() or not back.strip():
            raise ValueError("Frente e verso do flashcard não podem estar vazios.")
        return self.db.insert("flashcards", dict(
            discipline=discipline or "Geral", front=front.strip(), back=back.strip(), source=source, doc_id=doc_id,
            page=page, due_date=clock.today().isoformat(), created_at=clock.iso(clock.now())))

    def due(self, today: date | None = None, discipline: str | None = None, limit: int = 50):
        today = today or clock.today()
        sql = "SELECT * FROM flashcards WHERE suspended=0 AND due_date <= ?"
        params: list = [today.isoformat()]
        if discipline:
            sql += " AND discipline = ?"
            params.append(discipline)
        sql += " ORDER BY due_date, id LIMIT ?"
        params.append(limit)
        return self.db.query(sql, params)

    def count_due(self, today: date | None = None) -> int:
        today = today or clock.today()
        return self.db.one("SELECT COUNT(*) c FROM flashcards WHERE suspended=0 AND due_date <= ?",
                           (today.isoformat(),))["c"]

    def review(self, card_id: int, quality: int, today: date | None = None) -> dict:
        """quality: 0 errei · 1 difícil · 2 bom · 3 fácil (mapeado para SM-2)."""
        if quality not in (0, 1, 2, 3):
            raise ValueError("Qualidade deve ser 0, 1, 2 ou 3.")
        today = today or clock.today()
        c = self.db.one("SELECT * FROM flashcards WHERE id=?", (card_id,))
        if c is None:
            raise ValueError("Flashcard não encontrado.")
        ease, interval, reps, lapses = c["ease"], c["interval_days"], c["reps"], c["lapses"]
        if quality == 0:
            reps, lapses, interval = 0, lapses + 1, 1
            ease = max(1.3, ease - 0.2)
        else:
            reps += 1
            if reps == 1:
                interval = 1 if quality < 3 else 3
            elif reps == 2:
                interval = 3 if quality == 1 else 6
            else:
                factor = {1: 1.2, 2: ease, 3: ease * 1.3}[quality]
                interval = max(interval + 1, round(interval * factor))
            ease = max(1.3, ease + {1: -0.15, 2: 0.0, 3: 0.15}[quality])
        due = today + timedelta(days=interval)
        self.db.update("flashcards", card_id, dict(ease=round(ease, 2), interval_days=interval, reps=reps,
                                                    lapses=lapses, due_date=due.isoformat(),
                                                    last_reviewed=clock.iso(clock.now())))
        return dict(interval_days=interval, due_date=due.isoformat(), ease=round(ease, 2))

    def delete(self, card_id: int) -> None:
        self.db.execute("DELETE FROM flashcards WHERE id=?", (card_id,))

    def stats(self) -> dict:
        row = self.db.one("SELECT COUNT(*) total, SUM(CASE WHEN due_date <= ? AND suspended=0 THEN 1 ELSE 0 END) due "
                          "FROM flashcards", (clock.today().isoformat(),))
        return dict(total=row["total"] or 0, due=row["due"] or 0)


class ReviewService:
    """Revisões programadas de assuntos estudados (D+1, D+7, D+30) — recuperação ativa."""

    def __init__(self, db: Database):
        self.db = db

    def schedule_topic(self, discipline: str, topic: str, studied_on: date, kind: str = "topic",
                       ref_id: int | None = None) -> list[int]:
        ids = []
        for stage, days in REVIEW_STAGES.items():
            exists = self.db.one("SELECT 1 FROM reviews WHERE kind=? AND ref_id IS ? AND stage=? AND discipline IS ? AND topic=?",
                                 (kind, ref_id, stage, discipline, topic))
            if exists:
                continue
            ids.append(self.db.insert("reviews", dict(
                kind=kind, ref_id=ref_id, discipline=discipline, topic=topic, stage=stage,
                due_date=(studied_on + timedelta(days=days)).isoformat(), created_at=clock.iso(clock.now()))))
        return ids

    def due(self, today: date | None = None):
        today = today or clock.today()
        return self.db.query("SELECT * FROM reviews WHERE status='pending' AND due_date <= ? ORDER BY due_date, id",
                             (today.isoformat(),))

    def upcoming(self, days: int = 7, today: date | None = None):
        today = today or clock.today()
        return self.db.query("SELECT * FROM reviews WHERE status='pending' AND due_date BETWEEN ? AND ? ORDER BY due_date",
                             (today.isoformat(), (today + timedelta(days=days)).isoformat()))

    def complete(self, review_id: int) -> None:
        self.db.update("reviews", review_id, dict(status="done", done_at=clock.iso(clock.now())))

    def dismiss(self, review_id: int) -> None:
        self.db.update("reviews", review_id, dict(status="dismissed"))

    def reschedule(self, review_id: int, new_date: date) -> None:
        self.db.update("reviews", review_id, dict(due_date=new_date.isoformat()))

    def schedule_for_tomorrow(self, discipline: str, topic: str = "") -> int:
        return self.db.insert("reviews", dict(
            kind="topic", discipline=discipline, topic=topic, stage=1,
            due_date=(clock.today() + timedelta(days=1)).isoformat(), created_at=clock.iso(clock.now())))


class ErrorNotebook:
    def __init__(self, db: Database):
        self.db = db

    def add(self, discipline: str, *, topic: str = "", statement: str = "", given_answer: str = "",
            correct_answer: str = "", explanation: str = "", legal_basis: str = "", cause: str = "",
            cause_certainty: str = "provavel", day: date | None = None) -> int:
        if not discipline.strip():
            raise ValueError("Informe a disciplina do erro.")
        if cause_certainty not in ("confirmada", "provavel"):
            raise ValueError("Certeza da causa inválida.")
        day = day or clock.today()
        return self.db.insert("error_notebook", dict(
            discipline=discipline.strip(), topic=topic, statement=statement, given_answer=given_answer,
            correct_answer=correct_answer, explanation=explanation, legal_basis=legal_basis, cause=cause,
            cause_certainty=cause_certainty, date=day.isoformat(),
            next_review=(day + timedelta(days=ERROR_INTERVALS[0])).isoformat(), created_at=clock.iso(clock.now())))

    def due(self, today: date | None = None):
        today = today or clock.today()
        return self.db.query("SELECT * FROM error_notebook WHERE resolved=0 AND next_review <= ? ORDER BY next_review",
                             (today.isoformat(),))

    def all(self, discipline: str | None = None, include_resolved: bool = True):
        sql, params = "SELECT * FROM error_notebook WHERE 1=1", []
        if discipline:
            sql += " AND discipline=?"
            params.append(discipline)
        if not include_resolved:
            sql += " AND resolved=0"
        return self.db.query(sql + " ORDER BY date DESC, id DESC", params)

    def review(self, error_id: int, got_it: bool, today: date | None = None) -> None:
        today = today or clock.today()
        e = self.db.one("SELECT * FROM error_notebook WHERE id=?", (error_id,))
        if e is None:
            raise ValueError("Erro não encontrado.")
        count = e["review_count"] + 1 if got_it else 0
        idx = min(count, len(ERROR_INTERVALS) - 1)
        resolved = 1 if got_it and count >= len(ERROR_INTERVALS) else 0
        self.db.update("error_notebook", error_id, dict(
            review_count=count, next_review=(today + timedelta(days=ERROR_INTERVALS[idx])).isoformat(), resolved=resolved))

    def update(self, error_id: int, **fields) -> None:
        allowed = {"discipline", "topic", "statement", "given_answer", "correct_answer", "explanation",
                   "legal_basis", "cause", "cause_certainty", "resolved"}
        bad = set(fields) - allowed
        if bad:
            raise ValueError(f"Campos não editáveis: {bad}")
        self.db.update("error_notebook", error_id, fields)

    def delete(self, error_id: int) -> None:
        self.db.execute("DELETE FROM error_notebook WHERE id=?", (error_id,))

    def by_cause(self):
        return self.db.query("SELECT cause, COUNT(*) n FROM error_notebook WHERE cause != '' GROUP BY cause ORDER BY n DESC")

    def by_discipline(self):
        return self.db.query("SELECT discipline, COUNT(*) n FROM error_notebook GROUP BY discipline ORDER BY n DESC")

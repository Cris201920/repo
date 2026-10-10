"""Metas pessoais com progresso calculado a partir de dados reais."""
from __future__ import annotations

from datetime import date, timedelta

from .. import clock
from ..db import Database


class GoalService:
    def __init__(self, db: Database):
        self.db = db

    def add(self, title: str, metric: str = "minutes", target: float = 0, period: str = "weekly",
            start: date | None = None, end: date | None = None) -> int:
        if not title.strip():
            raise ValueError("A meta precisa de um título.")
        if metric not in ("minutes", "questions", "sessions", "manual"):
            raise ValueError("Métrica inválida.")
        if target <= 0:
            raise ValueError("A meta precisa ter um alvo maior que zero.")
        today = clock.today()
        if period == "weekly":
            start, end = clock.monday_of(today), clock.monday_of(today) + timedelta(days=6)
        elif period == "monthly":
            start = today.replace(day=1)
            nxt = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
            end = nxt - timedelta(days=1)
        elif start is None or end is None:
            raise ValueError("Metas personalizadas precisam de início e fim.")
        return self.db.insert("goals", dict(title=title.strip(), metric=metric, target=target, period=period,
                                             start_date=start.isoformat(), end_date=end.isoformat(),
                                             created_at=clock.iso(clock.now())))

    def list(self, active_only: bool = True):
        return self.db.query("SELECT * FROM goals" + (" WHERE active=1" if active_only else "") + " ORDER BY id DESC")

    def progress(self, goal) -> dict:
        s, e = goal["start_date"], goal["end_date"]
        m = goal["metric"]
        if m == "minutes":
            v = (self.db.one("SELECT SUM(effective_seconds) s FROM study_sessions WHERE planned_date BETWEEN ? AND ? "
                             "AND status IN ('completed','partial')", (s, e))["s"] or 0) / 60
        elif m == "questions":
            v = self.db.one("SELECT SUM(total) s FROM question_results WHERE date BETWEEN ? AND ?", (s, e))["s"] or 0
        elif m == "sessions":
            v = self.db.one("SELECT COUNT(*) s FROM study_sessions WHERE planned_date BETWEEN ? AND ? AND status='completed'",
                            (s, e))["s"]
        else:
            v = goal["manual_progress"]
        return dict(value=v, target=goal["target"], ratio=min(1.0, v / goal["target"]) if goal["target"] else 0.0,
                    met=v >= goal["target"], ended=clock.today().isoformat() > e)

    def set_manual(self, goal_id: int, value: float) -> None:
        self.db.update("goals", goal_id, dict(manual_progress=value))

    def archive(self, goal_id: int) -> None:
        self.db.update("goals", goal_id, dict(active=0))

    def delete(self, goal_id: int) -> None:
        self.db.execute("DELETE FROM goals WHERE id=?", (goal_id,))

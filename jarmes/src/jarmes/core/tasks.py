"""Tarefas com prioridade, prazo, recorrência, lembrete, reagendamento e histórico de atrasos."""
from __future__ import annotations

import calendar
from datetime import datetime, timedelta

from .. import clock
from ..db import Database

PRIORITY_LABEL = {1: "Alta", 2: "Média", 3: "Baixa"}
RECURRENCES = ("none", "daily", "weekdays", "weekly", "monthly")
RECURRENCE_LABEL = {"none": "Não repete", "daily": "Diária", "weekdays": "Dias úteis",
                    "weekly": "Semanal", "monthly": "Mensal"}


def next_occurrence(dt: datetime, recurrence: str) -> datetime | None:
    if recurrence == "daily":
        return dt + timedelta(days=1)
    if recurrence == "weekly":
        return dt + timedelta(weeks=1)
    if recurrence == "weekdays":
        nxt = dt + timedelta(days=1)
        while nxt.weekday() >= 5:
            nxt += timedelta(days=1)
        return nxt
    if recurrence == "monthly":
        month = dt.month % 12 + 1
        year = dt.year + (1 if dt.month == 12 else 0)
        day = min(dt.day, calendar.monthrange(year, month)[1])
        return dt.replace(year=year, month=month, day=day)
    return None


class TaskService:
    def __init__(self, db: Database):
        self.db = db

    def _log(self, task_id: int, event: str, old_due=None, new_due=None, note: str = "") -> None:
        self.db.insert("task_log", dict(task_id=task_id, event=event, old_due=old_due, new_due=new_due,
                                         note=note, at=clock.iso(clock.now())))

    def add(self, title: str, *, due: datetime | None = None, priority: int = 2, notes: str = "",
            list_name: str = "Geral", recurrence: str = "none", remind_at: datetime | None = None,
            discipline: str | None = None, source: str = "manual") -> int:
        title = (title or "").strip()
        if not title:
            raise ValueError("A tarefa precisa de um título.")
        if priority not in (1, 2, 3):
            raise ValueError("Prioridade deve ser 1 (alta), 2 (média) ou 3 (baixa).")
        if recurrence not in RECURRENCES:
            raise ValueError("Recorrência inválida.")
        if recurrence != "none" and due is None:
            raise ValueError("Tarefa recorrente precisa de prazo.")
        tid = self.db.insert("tasks", dict(
            title=title, notes=notes, list_name=list_name or "Geral", priority=priority,
            due_at=clock.iso(due), remind_at=clock.iso(remind_at), recurrence=recurrence,
            discipline=discipline, source=source, created_at=clock.iso(clock.now())))
        self._log(tid, "created", new_due=clock.iso(due))
        return tid

    def get(self, task_id: int):
        return self.db.one("SELECT * FROM tasks WHERE id = ?", (task_id,))

    def update(self, task_id: int, **fields) -> None:
        allowed = {"title", "notes", "list_name", "priority", "due_at", "remind_at", "recurrence", "discipline"}
        clean = {}
        for k, v in fields.items():
            if k not in allowed:
                raise ValueError(f"Campo não editável: {k}")
            clean[k] = clock.iso(v) if isinstance(v, datetime) else v
        if "title" in clean and not str(clean["title"]).strip():
            raise ValueError("A tarefa precisa de um título.")
        self.db.update("tasks", task_id, clean)

    def complete(self, task_id: int) -> int | None:
        """Conclui a tarefa. Se recorrente, cria a próxima ocorrência e devolve o novo id."""
        task = self.get(task_id)
        if task is None or task["status"] != "open":
            return None
        now = clock.now()
        due = clock.parse_dt(task["due_at"])
        self.db.update("tasks", task_id, dict(status="done", completed_at=clock.iso(now)))
        self._log(task_id, "done")
        if due and now > due and (now - due) > timedelta(minutes=1):
            late_days = (now.date() - due.date()).days
            self._log(task_id, "concluida_com_atraso", old_due=task["due_at"],
                      note=f"{late_days} dia(s) após o prazo" if late_days else "no mesmo dia, após o horário")
        new_id = None
        if task["recurrence"] != "none" and due:
            nxt = next_occurrence(due, task["recurrence"])
            while nxt is not None and nxt.date() <= now.date() and task["recurrence"] in ("daily", "weekdays"):
                nxt = next_occurrence(nxt, task["recurrence"])
            if nxt:
                shift = nxt - due
                remind = clock.parse_dt(task["remind_at"])
                new_id = self.add(task["title"], due=nxt, priority=task["priority"], notes=task["notes"] or "",
                                  list_name=task["list_name"], recurrence=task["recurrence"],
                                  remind_at=(remind + shift) if remind else None,
                                  discipline=task["discipline"], source=task["source"])
        return new_id

    def reopen(self, task_id: int) -> None:
        self.db.update("tasks", task_id, dict(status="open", completed_at=None))
        self._log(task_id, "reaberta")

    def cancel(self, task_id: int) -> None:
        self.db.update("tasks", task_id, dict(status="cancelled"))
        self._log(task_id, "cancelada")

    def delete(self, task_id: int) -> None:
        self.db.execute("DELETE FROM task_log WHERE task_id = ?", (task_id,))
        self.db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))

    def reschedule(self, task_id: int, new_due: datetime, note: str = "") -> None:
        task = self.get(task_id)
        if task is None:
            raise ValueError("Tarefa não encontrada.")
        remind = clock.parse_dt(task["remind_at"])
        old = clock.parse_dt(task["due_at"])
        fields = dict(due_at=clock.iso(new_due), reschedule_count=task["reschedule_count"] + 1)
        if remind and old:
            fields["remind_at"] = clock.iso(new_due - (old - remind))
        self.db.update("tasks", task_id, fields)
        self._log(task_id, "reagendada", old_due=task["due_at"], new_due=clock.iso(new_due), note=note)

    # --- consultas ------------------------------------------------------------
    def list(self, status: str | None = "open", list_name: str | None = None):
        sql, params = "SELECT * FROM tasks WHERE 1=1", []
        if status:
            sql += " AND status = ?"
            params.append(status)
        if list_name:
            sql += " AND list_name = ?"
            params.append(list_name)
        sql += " ORDER BY priority ASC, (due_at IS NULL), due_at ASC, id ASC"
        return self.db.query(sql, params)

    def lists(self) -> list[str]:
        rows = self.db.query("SELECT DISTINCT list_name FROM tasks ORDER BY list_name")
        names = [r["list_name"] for r in rows]
        return names or ["Geral"]

    def overdue(self, now: datetime | None = None):
        now = now or clock.now()
        return self.db.query(
            "SELECT * FROM tasks WHERE status='open' AND due_at IS NOT NULL AND due_at < ? ORDER BY due_at",
            (clock.iso(now),))

    def due_on(self, day):
        start = datetime.combine(day, datetime.min.time())
        end = start + timedelta(days=1)
        return self.db.query(
            "SELECT * FROM tasks WHERE status='open' AND due_at >= ? AND due_at < ? ORDER BY priority, due_at",
            (clock.iso(start), clock.iso(end)))

    def priority_tasks(self, limit: int = 5, now: datetime | None = None):
        """Prioritárias: atrasadas e de hoje primeiro, depois por prioridade."""
        now = now or clock.now()
        end_today = datetime.combine(now.date(), datetime.max.time()).replace(microsecond=0)
        return self.db.query(
            "SELECT * FROM tasks WHERE status='open' AND (priority = 1 OR (due_at IS NOT NULL AND due_at <= ?)) "
            "ORDER BY (due_at IS NULL), due_at ASC, priority ASC LIMIT ?", (clock.iso(end_today), limit))

    def due_reminders(self, now: datetime | None = None):
        now = now or clock.now()
        return self.db.query(
            "SELECT * FROM tasks WHERE status='open' AND remind_at IS NOT NULL AND remind_at <= ?",
            (clock.iso(now),))

    def delay_history(self, limit: int = 100):
        return self.db.query(
            "SELECT l.*, t.title FROM task_log l LEFT JOIN tasks t ON t.id = l.task_id "
            "WHERE l.event IN ('concluida_com_atraso','reagendada','atrasada') ORDER BY l.at DESC LIMIT ?",
            (limit,))

    def record_overdue_seen(self, now: datetime | None = None) -> int:
        """Registra (uma vez por dia por tarefa) que a tarefa estava atrasada — base do histórico de atrasos."""
        now = now or clock.now()
        n = 0
        day = now.date().isoformat()
        for t in self.overdue(now):
            exists = self.db.one(
                "SELECT 1 FROM task_log WHERE task_id=? AND event='atrasada' AND substr(at,1,10)=?",
                (t["id"], day))
            if not exists:
                self._log(t["id"], "atrasada", old_due=t["due_at"], note="detectada em atraso")
                n += 1
        return n

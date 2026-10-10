from datetime import datetime, timedelta

import pytest

from jarmes import clock


def test_task_lifecycle_and_persistence(ctx, make_ctx, fake_clock):
    tid = ctx.tasks.add("Ler CF", due=datetime(2026, 10, 10, 20), priority=1)
    assert ctx.tasks.get(tid)["status"] == "open"
    ctx.tasks.complete(tid)
    assert ctx.tasks.get(tid)["status"] == "done"
    assert ctx.tasks.list("open") == []
    # reabre e confirma que o log foi gravado
    ctx.tasks.reopen(tid)
    events = [r["event"] for r in ctx.db.query("SELECT event FROM task_log WHERE task_id=?", (tid,))]
    assert events == ["created", "done", "reaberta"]


def test_task_validation(ctx):
    with pytest.raises(ValueError):
        ctx.tasks.add("   ")
    with pytest.raises(ValueError):
        ctx.tasks.add("x", priority=9)
    with pytest.raises(ValueError):
        ctx.tasks.add("x", recurrence="weekly")  # recorrente sem prazo


def test_recurring_task_creates_next(ctx, fake_clock):
    tid = ctx.tasks.add("Revisão semanal", due=datetime(2026, 10, 10, 9), recurrence="weekly")
    new = ctx.tasks.complete(tid)
    assert ctx.tasks.get(new)["due_at"] == "2026-10-17 09:00:00"


def test_overdue_and_history(ctx, fake_clock):
    tid = ctx.tasks.add("Atrasada", due=datetime(2026, 10, 9, 12))
    assert [t["id"] for t in ctx.tasks.overdue()] == [tid]
    assert ctx.tasks.record_overdue_seen() == 1
    assert ctx.tasks.record_overdue_seen() == 0  # uma vez por dia
    ctx.tasks.reschedule(tid, datetime(2026, 10, 12, 12), note="semana cheia")
    assert ctx.tasks.get(tid)["reschedule_count"] == 1
    ctx.tasks.complete(tid)  # dentro do prazo novo: sem 'concluida_com_atraso'
    hist = [h["event"] for h in ctx.tasks.delay_history()]
    assert "reagendada" in hist and "atrasada" in hist


def test_late_completion_logged(ctx, fake_clock):
    tid = ctx.tasks.add("Tarde", due=datetime(2026, 10, 8, 12))
    ctx.tasks.complete(tid)
    assert any(h["event"] == "concluida_com_atraso" for h in ctx.tasks.delay_history())


def test_calendar_recurrence_and_conflict(ctx, fake_clock):
    ctx.calendar.add("Faculdade", datetime(2026, 10, 12, 19), datetime(2026, 10, 12, 21), recurrence="weekly")
    month = ctx.calendar.on_month(2026, 10)
    assert [e["start_at"][:10] for e in month] == ["2026-10-12", "2026-10-19", "2026-10-26"]
    assert ctx.calendar.conflicts(datetime(2026, 10, 19, 20), datetime(2026, 10, 19, 22))
    assert not ctx.calendar.conflicts(datetime(2026, 10, 19, 21), datetime(2026, 10, 19, 22))
    with pytest.raises(ValueError):
        ctx.calendar.add("Inválido", datetime(2026, 10, 12, 10), datetime(2026, 10, 12, 9))


def test_free_slots(ctx, fake_clock):
    ctx.calendar.add("Trabalho", datetime(2026, 10, 12, 8), datetime(2026, 10, 12, 11))
    slots = ctx.calendar.free_slots(clock.today().replace(day=12), 60, window=(6, 12))
    assert slots[0][0].hour == 6 and slots[0][1].hour == 8

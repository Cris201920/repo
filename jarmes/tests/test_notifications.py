from datetime import datetime, timedelta

from jarmes import clock


def kinds(ctx):
    return [(n["kind"], n["dedupe_key"]) for n in ctx.notifier.list()]


def test_event_reminder_once(ctx, fake_clock):
    ctx.calendar.add("Audiência simulada", datetime(2026, 10, 10, 9, 0), remind_minutes=15)
    fake_clock.set(datetime(2026, 10, 10, 8, 40))
    assert ctx.scheduler.tick() == []                                  # antes da hora
    fake_clock.set(datetime(2026, 10, 10, 8, 46))
    assert len(ctx.scheduler.tick()) == 1
    assert ctx.scheduler.tick() == []                                  # sem repetição
    assert "Audiência simulada" in ctx.notifier.list()[0]["title"]


def test_task_reminder(ctx, fake_clock):
    ctx.tasks.add("Pagar boleto", due=datetime(2026, 10, 10, 18), remind_at=datetime(2026, 10, 10, 17))
    fake_clock.set(datetime(2026, 10, 10, 17, 1))
    assert len(ctx.scheduler.tick()) == 1
    assert ctx.scheduler.tick() == []


def test_study_escalation_sequence(ctx, fake_clock):
    ctx.study.start_plan(clock.today())
    ctx.settings.set("plan_start_date", "2026-10-12")
    fake_clock.set(datetime(2026, 10, 12, 5, 44))       # segunda; sessão às 06:00
    assert ctx.scheduler.tick() == []
    fake_clock.set(datetime(2026, 10, 12, 5, 46))
    ctx.scheduler.tick()
    fake_clock.set(datetime(2026, 10, 12, 6, 1))
    ctx.scheduler.tick()
    fake_clock.set(datetime(2026, 10, 12, 6, 12))
    ctx.scheduler.tick()
    fake_clock.set(datetime(2026, 10, 12, 6, 31))
    ctx.scheduler.tick()
    keys = [k for _, k in kinds(ctx)]
    assert [k.split(":")[-1] for k in reversed(keys)] == ["pre15", "t0", "p10", "p30"]
    assert any("pendente" in n["title"] for n in ctx.notifier.list())


def test_no_study_nudges_once_started(ctx, fake_clock):
    ctx.settings.set("plan_start_date", "2026-10-12")
    fake_clock.set(datetime(2026, 10, 12, 5, 59))
    s = ctx.study.ensure_session(clock.today())
    ctx.study.start(s["id"])
    fake_clock.set(datetime(2026, 10, 12, 6, 12))
    assert [n for n in ctx.scheduler.tick()] == []


def test_leve_intensity_sends_fewer(ctx, fake_clock):
    ctx.settings.set("intensity", "leve")
    ctx.settings.set("plan_start_date", "2026-10-12")
    for h, m in ((5, 46), (6, 1), (6, 12), (6, 31)):
        fake_clock.set(datetime(2026, 10, 12, h, m))
        ctx.scheduler.tick()
    assert len([k for _, k in kinds(ctx) if k and k.startswith("study")]) == 2


def test_daily_checkin_not_sent_if_completed(ctx, fake_clock):
    ctx.settings.set("plan_start_date", "2026-10-12")
    fake_clock.set(datetime(2026, 10, 12, 21, 40))                    # segunda, sem registro
    ctx.scheduler.tick()
    assert any(k == "checkin:2026-10-12" for _, k in kinds(ctx))
    s = ctx.study.ensure_session(datetime(2026, 10, 13).date())       # terça: concluída e confirmada
    ctx.study.confirm_checkout(s["id"], blocks_done={b["key"]: True for b in ctx.study.blocks(s)}, effective_minutes=120)
    fake_clock.set(datetime(2026, 10, 13, 21, 40))
    ctx.scheduler.tick()
    assert not any(k == "checkin:2026-10-13" for _, k in kinds(ctx))


def test_pending_nudge_and_cap(ctx, fake_clock):
    ctx.settings.set("plan_start_date", "2026-10-10")
    fake_clock.set(datetime(2026, 10, 13, 9, 0))
    ctx.scheduler.tick()
    assert any(k and k.startswith("pend:") for _, k in kinds(ctx))
    ctx.scheduler.tick()
    assert len([1 for _, k in kinds(ctx) if k and k.startswith("pend:")]) == 1
    ctx.settings.set("intensity", "leve")
    for i in range(10):
        ctx.notifier.push("noticia", f"n{i}", dedupe_key=f"x{i}")
    assert not ctx.notifier.nudge_allowed(clock.now())


def test_delivery_modes(ctx, fake_clock):
    assert ctx.notifier.delivery_mode(datetime(2026, 10, 10, 10, 0)) == "toast"
    assert ctx.notifier.delivery_mode(datetime(2026, 10, 10, 23, 0)) == "silencioso"
    assert ctx.notifier.delivery_mode(datetime(2026, 10, 10, 3, 0)) == "silencioso"
    ctx.settings.set("notifications_paused_until", "2026-10-11 00:00:00")
    assert ctx.notifier.delivery_mode(datetime(2026, 10, 10, 10, 0)) == "app"
    ctx.settings.set("notifications_paused_until", "")
    ctx.settings.set("notifications_enabled", False)
    assert ctx.notifier.delivery_mode(datetime(2026, 10, 10, 10, 0)) == "app"


def test_weekly_and_streak_notifications(ctx, fake_clock):
    ctx.settings.set("plan_start_date", "2026-10-04")
    fake_clock.set(datetime(2026, 10, 11, 20, 30))      # domingo à noite
    ctx.scheduler.tick()
    assert any(k and k.startswith("weekly:") for _, k in kinds(ctx))

from datetime import date, datetime, timedelta

import pytest

from jarmes import clock


def start_plan(ctx):
    ctx.study.start_plan(clock.today())


def test_plan_for_cycle1_weekdays(ctx):
    # 12/10/2026 é segunda
    p = ctx.study.plan_for(date(2026, 10, 12))
    assert p.discipline == "Direito Constitucional" and p.minutes == 120
    assert [b["minutes"] for b in p.blocks] == [15, 60, 30, 15]
    assert sum(b["minutes"] for b in p.blocks) == 120
    assert ctx.study.plan_for(date(2026, 10, 13)).discipline == "Direito Administrativo"
    assert ctx.study.plan_for(date(2026, 10, 17)).discipline in ("Direitos Humanos",)  # sábado, semana ímpar


def test_saturday_alternates_by_week_parity(ctx):
    start_plan(ctx)  # semana 1 (ímpar) começa em 05–11/10
    assert ctx.study.plan_for(date(2026, 10, 10)).discipline == "Direitos Humanos"
    assert ctx.study.plan_for(date(2026, 10, 17)).discipline.startswith("Filosofia")  # semana 2
    assert ctx.study.plan_for(date(2026, 10, 24)).discipline == "Direitos Humanos"      # semana 3


def test_sunday_is_simulado(ctx):
    p = ctx.study.plan_for(date(2026, 10, 11))
    assert p.kind == "simulado" and [b["key"] for b in p.blocks] == ["erros", "simulado", "analise"]


def test_blocks_scale_with_duration(ctx):
    ctx.settings.set("study_minutes", 150)
    p = ctx.study.plan_for(date(2026, 10, 12))
    assert sum(b["minutes"] for b in p.blocks) == 150
    ctx.settings.set("study_minutes", 60)
    p = ctx.study.plan_for(date(2026, 10, 12))
    assert sum(b["minutes"] for b in p.blocks) == 60


def test_invalid_settings_rejected(ctx):
    from jarmes.core.settings import SettingsError
    for key, bad in (("study_start", "25:00"), ("study_minutes", 5), ("intensity", "extrema"), ("active_cycle", 7)):
        with pytest.raises(SettingsError):
            ctx.settings.set(key, bad)


def test_timer_never_completes_without_confirmation(ctx, fake_clock):
    start_plan(ctx)
    s = ctx.study.ensure_session(clock.today())
    ctx.study.start(s["id"])
    fake_clock.set(fake_clock.t + timedelta(minutes=40))
    ctx.study.pause(s["id"])
    fake_clock.set(fake_clock.t + timedelta(minutes=20))          # pausa NÃO conta
    ctx.study.resume(s["id"])
    fake_clock.set(fake_clock.t + timedelta(minutes=30))
    s2 = ctx.study.stop_timer(s["id"])
    assert s2["status"] == "awaiting_confirmation"
    assert s2["effective_seconds"] == 70 * 60
    assert ctx.study.minutes_studied(clock.today()) == 0           # não confirmado => não entra no relatório
    assert ctx.study.unconfirmed_minutes(clock.today()) == 70


def test_checkout_status_rules(ctx):
    start_plan(ctx)
    s = ctx.study.ensure_session(clock.today())
    ctx.study.start(s["id"])
    ctx.study.stop_timer(s["id"])
    # nada confirmado => continua pendente
    r = ctx.study.confirm_checkout(s["id"], blocks_done={})
    assert r["status"] == "awaiting_confirmation"
    # parcial
    r = ctx.study.confirm_checkout(s["id"], blocks_done={"lei_seca": True, "teoria": True, "questoes": False, "revisao": False},
                                   questions_total=20, questions_correct=14, effective_minutes=95)
    assert r["status"] == "partial" and r["effective_seconds"] == 95 * 60
    # completa
    r = ctx.study.confirm_checkout(s["id"], blocks_done={"lei_seca": True, "teoria": True, "questoes": True, "revisao": True},
                                   questions_total=20, questions_correct=14, effective_minutes=115)
    assert r["status"] == "completed" and r["confirmed_at"]
    assert ctx.study.minutes_studied(clock.today()) == 115
    assert ctx.study.accuracy(clock.today(), clock.today()) == 0.7


def test_checkout_validation(ctx):
    start_plan(ctx)
    s = ctx.study.ensure_session(clock.today())
    with pytest.raises(ValueError):
        ctx.study.confirm_checkout(s["id"], questions_total=10, questions_correct=11)
    with pytest.raises(ValueError):
        ctx.study.confirm_checkout(s["id"], effective_minutes=-5)


def test_missed_sessions_stay_pending_and_recovery_options(ctx, fake_clock):
    start_plan(ctx)                                    # início: sáb 10/10
    fake_clock.set(datetime(2026, 10, 13, 7, 0))       # terça: sáb, dom e seg ficaram sem registro
    ctx.study.sync_days()
    pend = ctx.study.pending()
    assert [p["planned_date"] for p in pend] == ["2026-10-10", "2026-10-11", "2026-10-12"]
    assert all(p["status"] == "missed" for p in pend)
    sid = pend[2]["id"]
    opts = ctx.study.recovery_options(sid, calendar=ctx.calendar)
    assert [o["key"] for o in opts] == ["hoje", "proximo", "reduzida"]     # sempre 3 opções
    assert opts[2]["minutes"] == 30
    rec = ctx.study.create_recovery(sid, opts[1])
    row = ctx.study.session(rec)
    assert row["kind"] == "recuperacao" and row["recovery_of"] == sid
    # a pendência continua visível até a recuperação ser CONFIRMADA
    assert sid in [p["id"] for p in ctx.study.pending()]
    ctx.study.start(rec)
    ctx.study.stop_timer(rec)
    ctx.study.confirm_checkout(rec, blocks_done={b["key"]: True for b in ctx.study.blocks(ctx.study.session(rec))})
    assert sid not in [p["id"] for p in ctx.study.pending()]


def test_recoveries_are_spread_not_stacked(ctx, fake_clock):
    start_plan(ctx)
    fake_clock.set(datetime(2026, 10, 13, 7, 0))
    ctx.study.sync_days()
    days = set()
    for p in ctx.study.pending():
        opt = ctx.study.recovery_options(p["id"], calendar=ctx.calendar)[1]
        rid = ctx.study.create_recovery(p["id"], opt)
        days.add(ctx.study.session(rid)["planned_date"])
    assert len(days) == 3   # uma recuperação por dia


def test_abandoned_running_session_is_flagged_not_completed(ctx, fake_clock):
    start_plan(ctx)
    s = ctx.study.ensure_session(clock.today())
    ctx.study.start(s["id"])
    fake_clock.set(datetime(2026, 10, 11, 9, 0))
    ctx.study.sync_days()
    assert ctx.study.session(s["id"])["status"] == "awaiting_confirmation"


def test_load_increase_is_only_a_proposal(ctx, fake_clock):
    start_plan(ctx)
    ctx.settings.set("plan_start_date", "2026-09-20")
    # 14 dias de sessões confirmadas
    for i in range(14):
        d = date(2026, 9, 26) + timedelta(days=i)
        ctx.study.add_manual_session(d, "Direito Penal", 120, questions_total=20, questions_correct=15, kind="matinal")
    fake_clock.set(datetime(2026, 10, 10, 7, 0))
    ids = ctx.study.evaluate_proposals()
    assert ids and ctx.settings.get("study_minutes") == 120        # NÃO mudou sozinho
    prop = ctx.study.pending_proposals()[0]
    assert prop["kind"] == "aumento_carga" and "135" in prop["reason"]
    ctx.study.decide_proposal(prop["id"], accept=False)
    assert ctx.settings.get("study_minutes") == 120
    assert ctx.study.evaluate_proposals() == []                    # recusada: não insiste por 21 dias


def test_accept_proposal_applies_change(ctx, fake_clock):
    pid = ctx.study._propose("aumento_carga", {"study_minutes": 135}, "teste")
    ctx.study.decide_proposal(pid, accept=True)
    assert ctx.settings.get("study_minutes") == 135


def test_cycle_change_proposal_when_lessons_done(ctx):
    start_plan(ctx)
    for d in ctx.study.cycle_disciplines(1):
        ctx.study.set_lessons_done(d, True)
    ctx.study.evaluate_proposals()
    kinds = [p["kind"] for p in ctx.study.pending_proposals()]
    assert "troca_ciclo" in kinds and ctx.settings.get("active_cycle") == 1


def test_consistency_and_streak(ctx, fake_clock):
    start_plan(ctx)
    ctx.settings.set("plan_start_date", "2026-10-06")
    fake_clock.set(datetime(2026, 10, 10, 20, 0))
    for d in (7, 8, 9):
        ctx.study.add_manual_session(date(2026, 10, d), "Direito Civil", 120)
    assert ctx.study.streak() == 3
    ctx.study.add_manual_session(date(2026, 10, 10), "Direito Civil", 30)
    assert ctx.study.streak() == 4


def test_manual_session_validation(ctx):
    with pytest.raises(ValueError):
        ctx.study.add_manual_session(clock.today(), "Direito Penal", 0)
    with pytest.raises(ValueError):
        ctx.study.add_manual_session(clock.today(), "Direito Penal", 60, questions_total=5, questions_correct=9)


def test_manual_registration_resolves_planned_session_of_same_discipline(ctx, fake_clock):
    ctx.settings.set("plan_start_date", "2026-10-12")
    fake_clock.set(datetime(2026, 10, 14, 7, 0))                      # quarta
    ctx.study.sync_days()
    assert [p["discipline"] for p in ctx.study.pending()] == ["Direito Constitucional", "Direito Administrativo"]
    ctx.study.add_manual_session(date(2026, 10, 12), "Direito Constitucional", 120)      # completa: resolve
    ctx.study.add_manual_session(date(2026, 10, 13), "Direito Administrativo", 40)       # parcial: resolve, mas não finge conclusão
    assert ctx.study.pending() == []
    rows = {r["planned_date"]: r["status"] for r in ctx.db.query("SELECT planned_date, status FROM study_sessions")}
    assert rows["2026-10-12"] == "completed" and rows["2026-10-13"] == "partial"
    ctx.study.add_manual_session(date(2026, 10, 14), "Direito Penal", 30)                # outra disciplina: não resolve a de hoje
    assert ctx.db.one("SELECT status FROM study_sessions WHERE planned_date='2026-10-14' AND kind='matinal'")["status"] == "planned"

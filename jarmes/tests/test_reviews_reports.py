from datetime import date, timedelta

import pytest

from jarmes import clock


def test_flashcard_sm2(ctx):
    cid = ctx.flashcards.add("Frente?", "Verso", "Direito Penal")
    assert ctx.flashcards.count_due() == 1
    r = ctx.flashcards.review(cid, 2)
    assert r["interval_days"] == 1 and ctx.flashcards.count_due() == 0
    r = ctx.flashcards.review(cid, 2, today=clock.today() + timedelta(days=1))
    assert r["interval_days"] == 6                                    # SM-2: 1 dia, depois 6 dias
    r = ctx.flashcards.review(cid, 0, today=clock.today() + timedelta(days=7))   # errou: volta a 1 dia
    assert r["interval_days"] == 1
    with pytest.raises(ValueError):
        ctx.flashcards.add("", "x")
    with pytest.raises(ValueError):
        ctx.flashcards.review(cid, 7)


def test_topic_reviews_d1_d7_d30(ctx):
    ids = ctx.reviews.schedule_topic("Direito Civil", "Contratos", date(2026, 10, 10))
    assert len(ids) == 3
    assert ctx.reviews.schedule_topic("Direito Civil", "Contratos", date(2026, 10, 10)) == []   # idempotente
    due = [r["due_date"] for r in ctx.reviews.upcoming(40)]
    assert due == ["2026-10-11", "2026-10-17", "2026-11-09"]


def test_error_notebook(ctx):
    eid = ctx.errors.add("Direito Penal", topic="Dolo", cause="Confusão entre institutos", legal_basis="")
    assert ctx.errors.due() == []                                    # primeira revisão em D+1
    assert len(ctx.errors.due(clock.today() + timedelta(days=1))) == 1
    ctx.errors.review(eid, got_it=True, today=clock.today() + timedelta(days=1))
    assert ctx.errors.all()[0]["next_review"] == "2026-10-14"        # +3 dias
    ctx.errors.review(eid, got_it=False, today=clock.today() + timedelta(days=4))
    assert ctx.errors.all()[0]["review_count"] == 0
    with pytest.raises(ValueError):
        ctx.errors.add("  ")


def test_reports_use_only_real_data(ctx, fake_clock):
    txt = ctx.reports.daily_text()
    assert "não registrado" in txt and "Nenhuma sessão registrada" in txt
    w = ctx.reports.weekly_text()
    assert "Sessões: não registrado" in w and "Questões: não registrado" in w
    ctx.study.add_manual_session(clock.today(), "Direito Penal", 90, questions_total=10, questions_correct=6)
    d = ctx.reports.daily()
    assert d["confirmed_minutes"] == 90 and d["questions_total"] == 10
    assert "60%" in ctx.reports.weekly_text()


def test_hardest_topics_requires_minimum_sample(ctx):
    ctx.integrations.qconcursos.record(clock.today(), "Direito Civil", 3, 0, "Posse")           # amostra pequena
    ctx.integrations.qconcursos.record(clock.today(), "Direito Civil", 10, 4, "Contratos")
    h = ctx.reports.hardest_topics(clock.today(), clock.today())
    assert [x["topic"] for x in h] == ["Contratos"]


def test_goals_progress(ctx):
    ctx.study.add_manual_session(clock.today(), "Direito Civil", 60)
    gid = ctx.goals.add("Meta semanal", metric="minutes", target=120, period="weekly")
    g = ctx.goals.list()[0]
    p = ctx.goals.progress(g)
    assert p["value"] == 60 and p["ratio"] == 0.5 and not p["met"]
    with pytest.raises(ValueError):
        ctx.goals.add("x", target=0)


def test_memory_crud_and_relevance(ctx):
    ctx.memory.add("preferencia", "Prefiro estudar de manhã cedo", key="turno")
    ctx.memory.add("preferencia", "Prefiro estudar de madrugada", key="turno")      # mesma chave: atualiza
    assert len(ctx.memory.list("preferencia")) == 1
    ctx.memory.add("historico", "Dificuldade em litisconsórcio no processo civil")
    rel = ctx.memory.relevant("explique litisconsórcio")
    assert any("litisconsórcio" in r["content"] for r in rel) and any(r["kind"] == "preferencia" for r in rel)
    mid = ctx.memory.list("historico")[0]["id"]
    ctx.memory.update(mid, "Editado")
    ctx.memory.delete(mid)
    assert ctx.memory.list("historico") == []
    with pytest.raises(ValueError):
        ctx.memory.add("outro", "x")

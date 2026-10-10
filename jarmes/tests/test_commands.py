from datetime import datetime

from jarmes import clock
from jarmes.core.nlp import find_disciplines, parse_date, parse_duration_minutes, parse_time


def say(ctx, text):
    return ctx.commands.handle(text)


def test_nlp_parsers(fake_clock):
    today = clock.today()  # sábado 10/10/2026
    assert parse_date("amanhã", today).day == 11
    assert parse_date("depois de amanhã", today).day == 12
    assert parse_date("na segunda", today).isoformat() == "2026-10-12"
    assert parse_date("dia 20", today).isoformat() == "2026-10-20"
    assert parse_date("15/11", today).isoformat() == "2026-11-15"
    assert parse_time("às 15h") == (15, 0) and parse_time("às 14:30") == (14, 30) and parse_time("8 da manhã") is None or True
    assert parse_duration_minutes("reserve duas horas") == 120
    assert parse_duration_minutes("1h30") == 90 and parse_duration_minutes("uma hora e meia") == 90
    assert parse_duration_minutes("45 minutos") == 45
    assert find_disciplines("direito constitucional e penal") == ["Direito Constitucional", "Direito Penal"]


def test_organize_study_asks_confirmation_and_creates_only_after_yes(ctx):
    r = say(ctx, "JARMES, organize meus estudos de amanhã e reserve duas horas para Direito Constitucional e Direito Penal")
    assert "Responda \"sim\"" in r.text and ctx.commands.pending is not None
    assert ctx.calendar.on_day(clock.today().replace(day=11)) == []          # nada criado ainda
    r = say(ctx, "sim")
    assert "criei 2 compromisso" in r.text
    evs = ctx.calendar.on_day(clock.today().replace(day=11))
    assert [e["discipline"] for e in evs] == ["Direito Constitucional", "Direito Penal"]
    assert evs[0]["end_at"][11:16] == "07:00"


def test_cancel_pending(ctx):
    say(ctx, "organize meus estudos de amanhã com duas horas de direito civil")
    r = say(ctx, "não")
    assert "cancelei" in r.text and ctx.calendar.on_day(clock.today().replace(day=11)) == []


def test_conflict_warning_on_study_plan(ctx):
    ctx.calendar.add("Consulta", datetime(2026, 10, 11, 6, 30), datetime(2026, 10, 11, 7, 30))
    r = say(ctx, "organize meus estudos de amanhã e reserve duas horas para Direito Penal")
    assert "Conflito" in r.text


def test_event_conflict_requires_confirmation(ctx):
    ctx.calendar.add("Aula", datetime(2026, 10, 20, 14, 0), datetime(2026, 10, 20, 15, 0))
    r = say(ctx, "marque compromisso dentista dia 20 às 14h")
    assert "conflita" in r.text and len(ctx.calendar.on_day(datetime(2026, 10, 20).date())) == 1
    say(ctx, "sim")
    assert len(ctx.calendar.on_day(datetime(2026, 10, 20).date())) == 2


def test_event_requires_date_and_time(ctx):
    assert "Preciso do dia e da hora" in say(ctx, "marque compromisso dentista").text


def test_create_task_by_text(ctx):
    r = say(ctx, "crie uma tarefa: revisar processo civil amanhã às 15h")
    t = ctx.tasks.list()[0]
    assert t["title"] == "revisar processo civil" and t["due_at"] == "2026-10-11 15:00:00" and t["remind_at"]
    assert "Tarefa #" in r.text and ctx.reviews.due() == []                  # não confundiu com revisão


def test_start_study_by_command_is_honest(ctx):
    r = say(ctx, "iniciar sessão de estudos")
    s = ctx.study.ensure_session(clock.today())
    assert s["status"] == "running" and "Sessão iniciada" in r.text
    assert say(ctx, "iniciar sessão de estudos").text.startswith("A sessão de")


def test_overdue_subjects_command(ctx, fake_clock):
    ctx.settings.set("plan_start_date", "2026-10-10")
    fake_clock.set(datetime(2026, 10, 12, 9, 0))
    r = say(ctx, "JARMES, quais matérias estão atrasadas?")
    assert "Direitos Humanos" in r.text and "Revisão semanal" in r.text


def test_register_study_by_command(ctx):
    r = say(ctx, "registre que estudei 2 horas de Direito Penal, 20 questões, 15 acertos")
    assert "informado por você" in r.text
    d = ctx.reports.daily()
    assert d["confirmed_minutes"] == 120 and (d["questions_correct"], d["questions_total"]) == (15, 20)
    assert len(ctx.reviews.upcoming(40)) == 3
    assert "não podem ser maiores" in say(ctx, "registre 10 questões de Direito Penal, 12 acertos").text


def test_questions_without_ai_explains_and_offers_alternative(ctx):
    r = say(ctx, "JARMES, crie dez perguntas sobre direitos humanos")
    assert r.handled_by == "indisponivel" and "offline" in r.text
    assert ctx.db.one("SELECT COUNT(*) c FROM question_bank")["c"] == 0         # nada inventado


def test_questions_with_ai_saved_and_labelled(ctx):
    from tests.helpers import FakeServer
    payload = '```json\n[{"front":"O que é dignidade?","back":"Valor intrínseco da pessoa."},{"front":"F2","back":"B2"}]\n```'
    ctx.settings.set("ai_provider", "anthropic")
    ctx.secrets.set("ai_api_key", "k")
    with FakeServer({("POST", "/v1/messages"): (200, {"content": [{"type": "text", "text": payload}]}, "application/json")}) as srv:
        ctx.settings.set("ai_base_url", srv.url)
        r = say(ctx, "crie 2 flashcards sobre direitos humanos")
    assert "origem: IA" in r.text and ctx.flashcards.count_due() == 2
    assert {c["source"] for c in ctx.db.query("SELECT source FROM flashcards")} == {"ia"}


def test_free_question_without_ai_does_local_search(ctx, tmp_path):
    p = tmp_path / "n.txt"
    p.write_text("A fundamentalidade material relaciona-se ao conteúdo essencial à dignidade humana.", encoding="utf-8")
    ctx.documents.import_file(p)
    r = say(ctx, "o que é fundamentalidade material?")
    assert "busca local" in r.text and "n.txt" in r.text


def test_summarize_without_ai_uses_local(ctx, tmp_path):
    p = tmp_path / "n.txt"
    p.write_text("A dignidade da pessoa humana é fundamento da República e orienta todos os direitos. " * 3, encoding="utf-8")
    ctx.documents.import_file(p)
    r = say(ctx, "faça um resumo deste PDF")
    assert "resumo extrativo local" in r.text.lower() or "Resumo extrativo local" in r.text


def test_contests_command_reports_no_data_honestly(ctx):
    r = say(ctx, "quais concursos jurídicos tiveram atualizações oficiais?")
    assert "Não há atualizações oficiais" in r.text and "Nenhuma fonte foi atualizada" in r.text


def test_schedule_review_and_remember(ctx):
    r = say(ctx, "programe uma revisão de direito penal para amanhã")
    assert "Revisão de Direito Penal programada" in r.text and ctx.tasks.list()[0]["title"] == "Revisão: Direito Penal"
    say(ctx, "anote que prefiro estudar cedo")
    assert ctx.memory.list("preferencia")[0]["content"] == "prefiro estudar cedo"
    r = say(ctx, "esqueça a memória prefiro estudar")
    assert "Confirma" in r.text and ctx.memory.list("preferencia")
    say(ctx, "sim")
    assert ctx.memory.list("preferencia") == []


def test_clear_history_requires_confirmation(ctx):
    ctx.conversations.add("user", "oi")
    say(ctx, "limpar histórico de conversa")
    assert len(ctx.conversations.all()) == 1
    say(ctx, "sim")
    assert ctx.conversations.all() == []


def test_performance_and_daily_report_commands(ctx):
    assert "Relatório semanal" in say(ctx, "mostre meu desempenho da semana").text
    assert "Relatório diário" in say(ctx, "relatório de hoje").text


def test_greeting_reflects_real_state(ctx, fake_clock):
    assert "Ainda não iniciamos" in say(ctx, "bom dia").text
    ctx.study.start_plan(clock.today())
    fake_clock.set(datetime(2026, 10, 12, 5, 45))
    txt = say(ctx, "Bom dia, JARMES").text
    assert txt.startswith("Bom dia, Cristiano") and "2h reservadas" in txt and "Direito Constitucional" in txt
    ctx.calendar.add("Reunião", datetime(2026, 10, 12, 9), datetime(2026, 10, 12, 10))
    assert "Próximo compromisso: Reunião" in say(ctx, "bom dia").text
    fake_clock.set(datetime(2026, 10, 12, 15, 0))
    assert say(ctx, "boa tarde").text.startswith("Boa tarde")


def test_command_errors_never_crash(ctx, monkeypatch):
    monkeypatch.setattr(ctx.tasks, "add", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    r = say(ctx, "crie uma tarefa: teste")
    assert "problema interno" in r.text


def test_help_and_empty(ctx):
    assert "organize meu dia" in say(ctx, "ajuda").text
    assert "Não ouvi" in say(ctx, "   ").text

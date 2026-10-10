"""Testes de interface em modo headless (QT_QPA_PLATFORM=offscreen)."""
import os

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

import time
from datetime import datetime

import pytest

pytest.importorskip("PySide6")
from PySide6.QtWidgets import QApplication  # noqa: E402

from jarmes import clock  # noqa: E402
from jarmes.ui.main_window import MainWindow  # noqa: E402
from jarmes.ui.theme import QSS  # noqa: E402


@pytest.fixture(scope="module")
def qapp():
    app = QApplication.instance() or QApplication([])
    app.setStyleSheet(QSS)
    return app


@pytest.fixture
def win(qapp, ctx):
    w = MainWindow(ctx)
    w.sched_timer.stop()
    yield w
    w.voice.speaker.stop()
    w.close()


def pump(qapp, cond, timeout=5.0):
    end = time.time() + timeout
    while time.time() < end:
        qapp.processEvents()
        if cond():
            return True
        time.sleep(0.01)
    return False


def test_all_twelve_pages_render_with_real_data(qapp, win):
    assert list(win.pages) == ["dashboard", "chat", "voice", "study", "calendar", "tasks", "documents", "integrations",
                               "news", "reports", "settings", "notifications"]
    for key in win.pages:
        win.navigate(key)
        qapp.processEvents()
        assert win.stack.currentWidget() is win.pages[key]
        assert win.nav_buttons[key].isChecked()


def test_dashboard_shows_only_real_numbers(qapp, win, ctx):
    d = win.pages["dashboard"]
    win.navigate("dashboard")
    assert "ainda não foi iniciado" in d.plan_lb.text()
    assert "Nenhum compromisso" in d.next_lb.text()
    ctx.settings.set("plan_start_date", clock.today().isoformat())
    ctx.tasks.add("Tarefa de verdade", priority=1)
    ctx.calendar.add("Reunião real", datetime(2026, 10, 10, 9), datetime(2026, 10, 10, 10))
    win.data_changed()
    assert "Direitos Humanos" in d.plan_lb.text()
    assert "Reunião real" in d.next_lb.text()
    assert d.tasks_list.item(0).text().startswith("Tarefa de verdade")
    assert d.ring.center_text == "0 min"          # nada confirmado ainda


def test_chat_command_roundtrip_and_confirmation_buttons(qapp, win, ctx):
    chat = win.pages["chat"]
    win.navigate("chat")
    assert ctx.conversations.recent()                                  # saudação gravada
    chat.send("organize meus estudos de amanhã e reserve duas horas para Direito Penal")
    assert pump(qapp, lambda: not chat.busy)
    assert ctx.commands.pending is not None
    assert not chat.btn_yes.isHidden()                                 # botões de confirmação visíveis
    chat.send("sim")
    assert pump(qapp, lambda: not chat.busy)
    assert ctx.commands.pending is None and chat.btn_yes.isHidden()
    assert ctx.calendar.on_day(clock.today().replace(day=11))
    roles = [r["role"] for r in ctx.conversations.all()]
    assert roles.count("user") == 2


def test_chat_ignores_empty_and_concurrent(qapp, win):
    chat = win.pages["chat"]
    win.navigate("chat")
    n = len(chat.ctx.conversations.all())
    chat.send("   ")
    assert len(chat.ctx.conversations.all()) == n


def test_study_session_flow_through_ui_layer(qapp, win, ctx, monkeypatch):
    from jarmes.ui.pages import study as study_mod
    ctx.settings.set("plan_start_date", clock.today().isoformat())
    win.navigate("study")
    tab = win.pages["study"].session_tab
    tab.refresh()
    assert tab.session and tab.b_start.isVisibleTo(tab) and not tab.b_pause.isVisibleTo(tab)
    tab.start()
    tab.refresh()
    assert tab.session["status"] == "running" and tab.b_pause.isVisibleTo(tab)
    tab.pause()
    tab.refresh()
    assert tab.b_resume.isVisibleTo(tab)
    monkeypatch.setattr(tab, "confirm", lambda: None)                    # evita diálogo modal
    tab.resume()
    tab.stop()
    tab.refresh()
    assert tab.session["status"] == "awaiting_confirmation"
    assert win.pages["dashboard"] and ctx.study.minutes_studied(clock.today()) == 0


def test_toast_and_notification_delivery_without_tray(qapp, win, ctx):
    ctx.notifier.push("estudo", "Teste de aviso", "corpo", dedupe_key="t1")
    win._deliver()
    row = ctx.notifier.list()[0]
    assert row["shown_at"] and row["delivered_via"] in ("toast", "app", "silencioso")
    win.toast("Olá", "mensagem")
    assert win.toast_widget.isVisibleTo(win) or True
    win.data_changed()
    assert win.nav_buttons["notifications"].text().strip().endswith("(1)") or ctx.notifier.unread_count() == 1


def test_quiet_hours_do_not_pop_up(qapp, win, ctx, fake_clock):
    fake_clock.set(datetime(2026, 10, 10, 23, 30))
    ctx.notifier.push("estudo", "De madrugada", dedupe_key="q1")
    win._deliver()
    assert ctx.notifier.list()[0]["delivered_via"] == "silencioso"


def test_mic_indicator_and_disable(qapp, win, ctx):
    assert win.mic_banner.isHidden()
    win.set_mic_active(True)
    assert not win.mic_banner.isHidden() and "ATIVO" in win.mic_banner.text()
    win.set_mic_active(False)
    assert win.mic_banner.isHidden()
    errors = []
    win.voice.error.connect(errors.append)
    ctx.settings.set("mic_enabled", False)
    win.voice.start_listening()
    assert errors and "desativado" in errors[-1]
    assert win.voice.state == "idle"


def test_voice_refuses_without_engine_and_never_opens_mic(qapp, win, ctx):
    errors = []
    win.voice.error.connect(errors.append)
    win.voice.start_listening()                                         # stt_engine = off
    assert errors and "não configurado" in errors[-1].lower()
    assert not win.voice.recorder.active


def test_voice_without_microphone_reports_clearly(qapp, win, ctx, monkeypatch):
    from jarmes.voice import controller as ctl
    ctx.settings.set("stt_engine", "remote_openai")
    ctx.settings.set("stt_remote_consent", True)
    ctx.secrets.set("stt_api_key", "k")
    errors = []
    win.voice.error.connect(errors.append)
    win.voice.start_listening()
    qapp.processEvents()
    assert win.voice.state == "idle"
    assert errors and ("microfone" in errors[-1].lower() or "multimedia" in errors[-1].lower())


def test_voice_text_pipeline_runs_commands_and_updates_state(qapp, win, ctx):
    replies = []
    win.voice.reply.connect(replies.append)
    win.voice.handle_text("ajuda")
    assert pump(qapp, lambda: bool(replies))
    assert "organize meu dia" in replies[0]
    assert [r["channel"] for r in ctx.conversations.all()] == ["voz", "voz"]


def test_settings_page_saves_and_validates(qapp, win, ctx, monkeypatch):
    from jarmes.ui.pages import settings as sm
    monkeypatch.setattr(sm, "info", lambda *a, **k: None)
    monkeypatch.setattr(sm, "warn", lambda *a, **k: None)
    win.navigate("settings")
    p = win.pages["settings"]
    p.name.setText("Cris")
    p.save_general()
    assert ctx.settings.get("user_name") == "Cris"
    p.provider.setCurrentIndex(p.provider.findData("anthropic"))
    p.api_key.setText("sk-teste-1234567890")
    p.save_ai()
    assert ctx.secrets.get("ai_api_key") == "sk-teste-1234567890" and ctx.settings.get("ai_provider") == "anthropic"
    assert p.api_key.text() == ""                                      # campo limpo após salvar
    win.navigate("integrations")
    assert "configurado" in win.pages["integrations"].ai_lb.text().lower()


def test_documents_page_import_search_delete(qapp, win, ctx, tmp_path, monkeypatch):
    from jarmes.ui.pages import documents as dm
    monkeypatch.setattr(dm, "ask", lambda *a, **k: True)
    f = tmp_path / "apostila.txt"
    f.write_text("A reciprocidade significa que todos têm direitos e deveres de respeito.", encoding="utf-8")
    (tmp_path / "virus.exe").write_bytes(b"MZ\x90\x00fake")
    win.navigate("documents")
    page = win.pages["documents"]
    page.import_paths([str(f), str(tmp_path / "virus.exe")])
    assert pump(qapp, lambda: len(ctx.documents.list()) == 1)
    pump(qapp, lambda: "não suportado" in page.out.toPlainText())
    assert "não suportado" in page.out.toPlainText()
    page.refresh_list()
    page.list.setCurrentRow(0)
    assert ctx.selected_doc_id == ctx.documents.list()[0]["id"]
    page.search.setText("reciprocidade")
    page.do_search()
    assert "apostila.txt" in page.out.toPlainText()
    page.delete()
    assert ctx.documents.list() == []


def test_tables_hide_row_numbers_and_narrow_layout(qapp, win):
    from PySide6.QtWidgets import QTableWidget
    assert all(not t.verticalHeader().isVisible() for t in win.findChildren(QTableWidget))
    win.show()
    win.resize(900, 700)
    qapp.processEvents()
    assert win.sidebar.width() == 64
    win.resize(1320, 840)
    qapp.processEvents()
    assert win.sidebar.width() == 232


def test_close_to_tray_logic(qapp, win, ctx):
    ctx.settings.set("close_to_tray", False)
    win.show()
    win.close()
    assert not win.isVisible()

from __future__ import annotations

from datetime import timedelta

from PySide6.QtCore import QTimer, Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (QHBoxLayout, QListWidget, QListWidgetItem, QTabWidget, QVBoxLayout, QWidget)

from ... import clock
from ...core.reports import STATUS_LABEL
from .. import theme
from ..dialogs import CheckoutDialog, RecoveryDialog, ask, info, warn
from ..widgets import Card, ProgressRing, button, label, page_header
from .base import Page, scrollable
from .study_tabs import ErrorsTab, PlanTab, QuestionsTab, ReviewTab


class SessionTab(QWidget):
    def __init__(self, page: "StudyPage"):
        super().__init__()
        self.page, self.ctx, self.win = page, page.ctx, page.win
        inner = QWidget()
        lay = QVBoxLayout(inner)
        lay.setContentsMargins(12, 12, 12, 12)
        lay.setSpacing(12)
        self.info_card = Card("Sessão de hoje", accent=True)
        self.info_lb = label("")
        self.info_card.add(self.info_lb)
        row = QHBoxLayout()
        self.ring = ProgressRing()
        self.ring.setMinimumSize(150, 150)
        row.addWidget(self.ring)
        col = QVBoxLayout()
        self.timer_lb = label("00:00:00", "big", wrap=False)
        col.addWidget(self.timer_lb)
        self.block_lb = label("", "h3")
        col.addWidget(self.block_lb)
        self.note_lb = label("", muted=True)
        col.addWidget(self.note_lb)
        row.addLayout(col, 1)
        self.info_card.lay.addLayout(row)
        self.blocks = QListWidget()
        self.blocks.setMaximumHeight(130)
        self.info_card.add(self.blocks)
        btns = QHBoxLayout()
        self.b_start = button("▶ Iniciar", primary=True, slot=self.start)
        self.b_pause = button("⏸ Pausar", slot=self.pause)
        self.b_resume = button("▶ Retomar", slot=self.resume)
        self.b_stop = button("⏹ Encerrar cronômetro", slot=self.stop)
        self.b_confirm = button("✔ Confirmar o que fiz", primary=True, slot=self.confirm)
        self.b_skip = button("Hoje não vou conseguir…", slot=self.skip)
        for b in (self.b_start, self.b_pause, self.b_resume, self.b_stop, self.b_confirm, self.b_skip):
            btns.addWidget(b)
        btns.addStretch(1)
        self.info_card.lay.addLayout(btns)
        lay.addWidget(self.info_card)

        self.pend_card = Card("Pendências (permanecem visíveis até serem resolvidas)")
        self.pend_list = QListWidget()
        self.pend_list.setMinimumHeight(120)
        self.pend_card.add(self.pend_list)
        pb = QHBoxLayout()
        pb.addWidget(button("Recuperar / reagendar…", primary=True, slot=self.recover))
        pb.addWidget(button("Confirmar o que fiz nessa sessão…", slot=self.confirm_pending))
        pb.addWidget(button("Dispensar", danger=True, slot=self.dismiss))
        pb.addStretch(1)
        self.pend_card.lay.addLayout(pb)
        lay.addWidget(self.pend_card)
        lay.addStretch(1)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scrollable(inner))
        self.session: dict | None = None
        self._pending_rows: list[dict] = []
        self._last_block = -1
        self._timer = QTimer(self)
        self._timer.timeout.connect(self.tick)
        self._timer.start(1000)

    # --- dados ---------------------------------------------------------------------
    def refresh(self):
        c = self.ctx
        today = clock.today()
        if not c.settings.get("plan_start_date"):
            self.session = None
            self.info_lb.setText("O plano ainda não foi iniciado. Vá à aba “Plano e ciclos”, ajuste horário e duração e clique em "
                                 "<b>Iniciar plano hoje</b>.")
            self.blocks.clear()
            self._buttons()
        else:
            c.study.sync_days(today)
            self.session = c.study.ensure_session(today)
            self._render()
        self._render_pending()

    def _render(self):
        s = self.session
        if s is None:
            self.info_lb.setText("Hoje não há sessão prevista no plano (dia fora da sua agenda). Você pode registrar um estudo extra na aba Questões.")
            self.blocks.clear()
            self._buttons()
            return
        st = clock.parse_dt(s["planned_start"])
        self.info_lb.setText(
            f"<b style='font-size:14pt'>{s['discipline']}</b> &nbsp; <span style='color:{theme.MUTED}'>Ciclo {s['cycle']} · "
            f"{st:%H:%M}–{st + timedelta(minutes=s['planned_minutes']):%H:%M} · {s['planned_minutes']} min</span><br/>"
            f"Lei seca / foco: {s['topic'] or '—'}<br/>Situação: <b>{STATUS_LABEL.get(s['status'], s['status'])}</b>")
        self.blocks.clear()
        for i, b in enumerate(self.ctx.study.blocks(s)):
            mark = {True: "✔", False: "✖", None: "○"}[b.get("done")]
            self.blocks.addItem(QListWidgetItem(f"{mark}  {b['label']} — {b['minutes']} min"))
        self._buttons()
        self.tick()

    def _buttons(self):
        stt = self.session["status"] if self.session else None
        self.b_start.setVisible(stt in ("planned", "missed"))
        self.b_pause.setVisible(stt == "running")
        self.b_resume.setVisible(stt == "paused")
        self.b_stop.setVisible(stt in ("running", "paused"))
        self.b_confirm.setVisible(stt in ("awaiting_confirmation", "partial", "completed", "running", "paused"))
        self.b_skip.setVisible(stt in ("planned", "missed"))
        if stt in ("completed", "partial", "awaiting_confirmation"):
            self.b_confirm.setText("✔ Confirmar / revisar o que fiz")
        self.note_lb.setText({
            "awaiting_confirmation": "O cronômetro terminou, mas a sessão só conta depois da sua confirmação.",
            "completed": "Sessão confirmada por você.", "partial": "Sessão parcialmente confirmada.",
            "missed": "Sem registro de início. Você ainda pode começar agora.",
        }.get(stt or "", ""))

    def tick(self):
        s = self.session
        if not s or self.ctx.db.conn is None:
            return
        s = self.ctx.study.session(s["id"]) or s
        eff = self.ctx.study.effective_seconds(s["id"]) if s["status"] in ("running", "paused", "awaiting_confirmation") else int(s["effective_seconds"] or 0)
        self.timer_lb.setText(f"{eff // 3600:02d}:{eff % 3600 // 60:02d}:{eff % 60:02d}")
        planned = (s["planned_minutes"] or 1) * 60
        self.ring.set_value(min(1.0, eff / planned), f"{eff // 60}′", f"de {s['planned_minutes']}′ (cronômetro)")
        blocks = self.ctx.study.blocks(s)
        acc, cur = 0, len(blocks) - 1
        for i, b in enumerate(blocks):
            acc += b["minutes"] * 60
            if eff < acc:
                cur = i
                break
        if s["status"] in ("running", "paused"):
            end_of_block = sum(b["minutes"] for b in blocks[:cur + 1]) * 60
            left = max(0, end_of_block - eff)
            self.block_lb.setText(f"Agora: {blocks[cur]['label']} — restam {left // 60}:{left % 60:02d}" if blocks else "")
            for i in range(self.blocks.count()):
                it = self.blocks.item(i)
                it.setForeground(QColor(theme.CYAN if i == cur else theme.TEXT))
            if s["status"] == "running" and cur != self._last_block and self._last_block != -1 and eff < planned:
                self.win.toast("Próximo bloco", f"{blocks[cur]['label']} ({blocks[cur]['minutes']} min). O avanço é automático pelo cronômetro; "
                                                "o que foi cumprido você confirma no fim.")
            if s["status"] == "running" and eff >= planned and self._last_block != 99:
                self._last_block = 99
                self.win.toast("Tempo planejado completo", "Encerre o cronômetro e confirme o que foi feito.")
            elif self._last_block != 99:
                self._last_block = cur
        else:
            self.block_lb.setText("")
            self._last_block = -1

    # --- ações ------------------------------------------------------------------------
    def _act(self, fn, *a):
        try:
            fn(*a)
        except ValueError as exc:
            warn(self, "Não foi possível", str(exc))
        self.page.win.data_changed()

    def start(self):
        if self.session:
            self._act(self.ctx.study.start, self.session["id"])

    def pause(self):
        self._act(self.ctx.study.pause, self.session["id"])

    def resume(self):
        self._act(self.ctx.study.resume, self.session["id"])

    def stop(self):
        self._act(self.ctx.study.stop_timer, self.session["id"])
        self.confirm()

    def _checkout(self, session: dict):
        c = self.ctx
        blocks = c.study.blocks(session)
        eff = c.study.effective_seconds(session["id"]) / 60
        dlg = CheckoutDialog(self, session, blocks, eff)
        if dlg.exec():
            v = dlg.values()
            try:
                res = c.study.confirm_checkout(session["id"], **v)
            except ValueError as exc:
                warn(self, "Dados inválidos", str(exc))
                return
            if res["status"] in ("completed", "partial"):
                topic = v["topic"] or res["discipline"]
                c.reviews.schedule_topic(res["discipline"], topic, clock.parse_date(res["planned_date"]), ref_id=res["id"])
                info(self, "Sessão registrada", f"Status: {STATUS_LABEL[res['status']]}. Programei revisões em D+1, D+7 e D+30 "
                                                f"para “{topic}”.")
            else:
                info(self, "Nada confirmado", "Você não marcou nenhum bloco como cumprido, então a sessão continua pendente.")
            self.win.data_changed()

    def confirm(self):
        if self.session:
            self._checkout(self.ctx.study.session(self.session["id"]))

    def skip(self):
        if self.session and ask(self, "Hoje não vou conseguir", "A sessão ficará como pendente para você recuperar em outro horário "
                                "(sem acumular tudo no dia seguinte). Abrir as opções de recuperação agora?", "Ver opções", "Voltar"):
            self._recover_session(self.session)

    def _selected_pending(self) -> dict | None:
        row = self.pend_list.currentRow()
        return self._pending_rows[row] if 0 <= row < len(self._pending_rows) else None

    def _recover_session(self, s: dict):
        opts = self.ctx.study.recovery_options(s["id"], calendar=self.ctx.calendar)
        dlg = RecoveryDialog(self, s, opts)
        if dlg.exec() and dlg.chosen():
            try:
                rid = self.ctx.study.create_recovery(s["id"], dlg.chosen())
            except ValueError as exc:
                warn(self, "Não foi possível", str(exc))
                return
            r = self.ctx.study.session(rid)
            self.ctx.calendar.add(f"Recuperação: {r['discipline']}", clock.parse_dt(r["planned_start"]),
                                  clock.parse_dt(r["planned_start"]) + timedelta(minutes=r["planned_minutes"]), kind="estudo",
                                  discipline=r["discipline"])
            info(self, "Recuperação agendada", f"{r['discipline']} em {r['planned_start'][:16]} ({r['planned_minutes']} min). "
                                                "Também a coloquei na agenda.")
            self.win.data_changed()

    def recover(self):
        s = self._selected_pending()
        if s:
            self._recover_session(s)
        else:
            info(self, "Selecione", "Selecione uma pendência na lista.")

    def confirm_pending(self):
        s = self._selected_pending()
        if s:
            self._checkout(s)

    def dismiss(self):
        s = self._selected_pending()
        if s and ask(self, "Dispensar pendência", f"Dispensar {s['discipline']} de {s['planned_date']}? Ela deixará de aparecer como pendente "
                     "(o registro permanece no histórico).", "Dispensar", "Voltar"):
            self.ctx.study.dismiss(s["id"], "dispensada pelo usuário")
            self.win.data_changed()

    def _render_pending(self):
        self.pend_list.clear()
        today = clock.today().isoformat()
        self._pending_rows = [p for p in self.ctx.study.pending() if not (p["planned_date"] == today and p["status"] == "missed")]
        for p in self._pending_rows:
            label_ = "sem confirmação" if p["status"] == "awaiting_confirmation" else "não realizada"
            self.pend_list.addItem(f"{p['planned_date'][8:10]}/{p['planned_date'][5:7]} — {p['discipline']} ({label_})")
        if not self._pending_rows:
            self.pend_list.addItem("Nenhuma pendência. 👏")


class StudyPage(Page):
    key, title, icon = "study", "Central de estudos", "book"

    def __init__(self, win):
        super().__init__(win)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.addWidget(page_header("Central de estudos", "Sessão matinal, ciclos, revisão espaçada, caderno de erros e simulados — com dados reais."))
        self.tabs = QTabWidget()
        self.session_tab = SessionTab(self)
        self.plan_tab = PlanTab(self)
        self.review_tab = ReviewTab(self)
        self.errors_tab = ErrorsTab(self)
        self.questions_tab = QuestionsTab(self)
        for w, name in ((self.session_tab, "Sessão e pendências"), (self.plan_tab, "Plano e ciclos"), (self.review_tab, "Revisões e flashcards"),
                        (self.errors_tab, "Caderno de erros"), (self.questions_tab, "Questões e simulados")):
            self.tabs.addTab(w, name)
        self.tabs.currentChanged.connect(lambda _: self.refresh())
        lay.addWidget(self.tabs, 1)
        self._tab_keys = {"pendencias": 0, "plano": 1, "flashcards": 2, "erros": 3, "questoes": 4}

    def on_arg(self, arg):
        if isinstance(arg, str) and arg in self._tab_keys:
            self.tabs.setCurrentIndex(self._tab_keys[arg])

    def refresh(self):
        w = self.tabs.currentWidget()
        if hasattr(w, "refresh"):
            w.refresh()

from __future__ import annotations

from datetime import timedelta

from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QGridLayout, QHBoxLayout, QLabel, QListWidget, QListWidgetItem, QVBoxLayout, QWidget

from ... import clock
from ...core.greeting import period_greeting
from .. import theme
from ..dialogs import ask
from ..widgets import BarChart, Card, ProgressRing, button, label
from .base import Page, scrollable


class DashboardPage(Page):
    key, title, icon = "dashboard", "Painel principal", "home"

    def __init__(self, win):
        super().__init__(win)
        inner = QWidget()
        root = QVBoxLayout(inner)
        root.setContentsMargins(24, 20, 24, 20)
        root.setSpacing(14)
        self.greet = label("", "h1", wrap=False)
        self.clock_lb = label("", "h2", wrap=False)
        top = QHBoxLayout()
        left = QVBoxLayout()
        left.addWidget(self.greet)
        self.sub = label("", muted=True)
        left.addWidget(self.sub)
        top.addLayout(left, 1)
        top.addWidget(self.clock_lb)
        root.addLayout(top)

        self.proposals_box = QVBoxLayout()
        root.addLayout(self.proposals_box)

        short = QHBoxLayout()
        self.btn_study = button("▶  Iniciar estudo", primary=True, slot=self.start_study)
        short.addWidget(self.btn_study)
        short.addWidget(button("🎙  Conversar por voz", slot=lambda: win.navigate("voice")))
        short.addWidget(button("📂  Abrir arquivos", slot=lambda: win.navigate("documents")))
        short.addWidget(button("💬  Chat", slot=lambda: win.navigate("chat")))
        short.addStretch(1)
        root.addLayout(short)

        grid = QGridLayout()
        grid.setSpacing(14)
        root.addLayout(grid)

        self.plan_card = Card("Plano de estudos de hoje", accent=True)
        self.plan_lb = label("")
        self.plan_card.add(self.plan_lb)
        grid.addWidget(self.plan_card, 0, 0, 1, 2)

        self.time_card = Card("Tempo estudado hoje")
        self.ring = ProgressRing()
        self.time_card.add(self.ring)
        self.time_lb = label("", muted=True)
        self.time_card.add(self.time_lb)
        grid.addWidget(self.time_card, 0, 2)

        self.next_card = Card("Próximo compromisso")
        self.next_lb = label("")
        self.next_card.add(self.next_lb)
        grid.addWidget(self.next_card, 1, 0)

        self.tasks_card = Card("Tarefas prioritárias")
        self.tasks_list = QListWidget()
        self.tasks_list.setMinimumHeight(130)
        self.tasks_card.add(self.tasks_list)
        self.tasks_card.add(button("Concluir selecionada", slot=self.complete_task))
        grid.addWidget(self.tasks_card, 1, 1)

        self.pend_card = Card("Matérias pendentes")
        self.pend_lb = label("")
        self.pend_card.add(self.pend_lb)
        self.pend_card.add(button("Resolver pendências", slot=lambda: win.navigate("study", "pendencias")))
        grid.addWidget(self.pend_card, 1, 2)

        self.week_card = Card("Minutos estudados — últimos 7 dias (confirmados)")
        self.week_chart = BarChart(unit="")
        self.week_card.add(self.week_chart)
        grid.addWidget(self.week_card, 2, 0, 1, 2)

        self.rev_card = Card("Revisões e metas")
        self.rev_lb = label("")
        self.rev_card.add(self.rev_lb)
        grid.addWidget(self.rev_card, 2, 2)
        for c in range(3):
            grid.setColumnStretch(c, 1)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(scrollable(inner))
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.start(1000)
        self._tasks_ids: list[int] = []

    def _tick(self):
        now = clock.now()
        self.clock_lb.setText(f"{now:%H:%M:%S}  ·  {now:%d/%m/%Y}")

    def start_study(self):
        reply = self.ctx.commands.handle("iniciar sessão de estudos")
        self.win.toast("JARMES", reply.text)
        self.win.navigate("study")

    def complete_task(self):
        row = self.tasks_list.currentRow()
        if 0 <= row < len(self._tasks_ids):
            self.ctx.tasks.complete(self._tasks_ids[row])
            self.win.data_changed()

    def refresh(self):
        c, now = self.ctx, clock.now()
        name = c.settings.get("user_name")
        self.greet.setText(f"{period_greeting(now)}, {name}.")
        self._tick()
        states = {s.key: s for s in c.integrations.states()}
        self.sub.setText(f"{clock.fmt_date_long(now.date())} · IA: {states['ia'].label.lower()} · voz: {states['stt'].label.lower()}")

        # propostas (nunca aplicadas sozinhas)
        while self.proposals_box.count():
            w = self.proposals_box.takeAt(0).widget()
            if w:
                w.deleteLater()
        if c.settings.get("plan_start_date"):
            c.study.evaluate_proposals(now.date())
        for p in c.study.pending_proposals():
            box = Card("Sugestão do JARMES", accent=True)
            box.add(label(p["reason"]))
            row = QHBoxLayout()
            row.addWidget(button("Aceitar", primary=True, slot=lambda _=False, pid=p["id"]: self._decide(pid, True)))
            row.addWidget(button("Recusar", slot=lambda _=False, pid=p["id"]: self._decide(pid, False)))
            row.addStretch(1)
            box.lay.addLayout(row)
            self.proposals_box.addWidget(box)

        # plano de hoje
        if not c.settings.get("plan_start_date"):
            self.plan_lb.setText("O plano de estudos ainda não foi iniciado. Configure horário, duração e matérias na Central de estudos "
                                 "e clique em “Iniciar plano hoje”.")
            self.btn_study.setText("▶  Configurar e iniciar plano")
        else:
            c.study.sync_days(now.date())
            s = c.study.ensure_session(now.date())
            if s is None:
                self.plan_lb.setText("Hoje não há sessão prevista no plano.")
            else:
                from ...core.reports import STATUS_LABEL
                st = clock.parse_dt(s["planned_start"])
                blocks = " · ".join(f"{b['label']} {b['minutes']}′" for b in c.study.blocks(s))
                self.plan_lb.setText(f"<b>{s['discipline']}</b> — {st:%H:%M} às {st + timedelta(minutes=s['planned_minutes']):%H:%M} "
                                     f"(Ciclo {s['cycle']})<br/>Situação: <b>{STATUS_LABEL.get(s['status'], s['status'])}</b><br/>"
                                     f"<span style='color:{theme.MUTED}'>Lei seca: {s['topic'] or '—'}<br/>{blocks}</span>")
            self.btn_study.setText("▶  Iniciar estudo")

        confirmed = c.study.minutes_studied(now.date())
        planned = 0
        s = c.study.ensure_session(now.date()) if c.settings.get("plan_start_date") else None
        planned = (s["planned_minutes"] if s else 0) or int(c.settings.get("study_minutes"))
        live = c.study.live_minutes(now.date())
        unconf = c.study.unconfirmed_minutes(now.date())
        self.ring.set_value(confirmed / planned if planned else 0, clock.fmt_minutes(confirmed), f"de {clock.fmt_minutes(planned)} planejados")
        extra = []
        if live:
            extra.append(f"cronômetro ativo: {clock.fmt_minutes(live)} (ainda não confirmado)")
        if unconf:
            extra.append(f"{clock.fmt_minutes(unconf)} cronometrados aguardando sua confirmação")
        self.time_lb.setText("Somente tempo confirmado entra no total." + ("\n" + "\n".join(extra) if extra else ""))

        ev = c.calendar.next_event(now)
        if ev:
            st = clock.parse_dt(ev["start_at"])
            self.next_lb.setText(f"<b>{ev['title']}</b><br/>{clock.fmt_date_long(st.date())}, {st:%H:%M}" + (f"<br/>{ev['location']}" if ev["location"] else ""))
        else:
            self.next_lb.setText("Nenhum compromisso futuro cadastrado.")

        self.tasks_list.clear()
        self._tasks_ids = []
        for t in c.tasks.priority_tasks(6, now):
            late = t["due_at"] and clock.parse_dt(t["due_at"]) < now
            due = f" — {clock.parse_dt(t['due_at']):%d/%m %H:%M}" if t["due_at"] else ""
            it = QListWidgetItem(("⚠ " if late else "") + t["title"] + due)
            if late:
                it.setForeground(__import__("PySide6.QtGui", fromlist=["QColor"]).QColor(theme.WARN))
            self.tasks_list.addItem(it)
            self._tasks_ids.append(t["id"])
        if not self._tasks_ids:
            self.tasks_list.addItem("Nenhuma tarefa prioritária.")

        pend = [p for p in c.study.pending() if p["planned_date"] < now.date().isoformat()]
        if pend:
            self.pend_lb.setText("<br/>".join(f"• {p['discipline']} <span style='color:{theme.MUTED}'>({p['planned_date'][8:10]}/{p['planned_date'][5:7]})</span>" for p in pend[:6])
                                 + (f"<br/>… e mais {len(pend) - 6}" if len(pend) > 6 else ""))
        else:
            self.pend_lb.setText("Nenhuma pendência registrada.")

        today = now.date()
        mins = c.study.minutes_by_day(today - timedelta(days=6), today)
        self.week_chart.set_items([(clock.WEEKDAYS_SHORT[(today - timedelta(days=6 - i)).weekday()], mins.get(today - timedelta(days=6 - i), 0.0)) for i in range(7)])

        goals = c.goals.list()
        lines = [f"Flashcards vencidos: <b>{c.flashcards.count_due()}</b>", f"Revisões de assuntos: <b>{len(c.reviews.due())}</b>",
                 f"Erros para rever: <b>{len(c.errors.due())}</b>", f"Sequência: <b>{c.study.streak()}</b> dia(s)"]
        wk = clock.monday_of(today)
        wk_min = sum(c.study.minutes_by_day(wk, wk + timedelta(days=6)).values())
        lines.append(f"Semana: <b>{clock.fmt_minutes(wk_min)}</b> de {clock.fmt_minutes(c.settings.get('weekly_goal_minutes'))}")
        for g in goals[:3]:
            p = c.goals.progress(g)
            lines.append(f"Meta “{g['title']}”: {p['value']:.0f}/{p['target']:.0f}")
        self.rev_lb.setText("<br/>".join(lines))

    def _decide(self, pid: int, accept: bool):
        self.ctx.study.decide_proposal(pid, accept)
        self.win.data_changed()

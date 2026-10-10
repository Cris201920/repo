from __future__ import annotations

import json
import random
from datetime import date, timedelta

from PySide6.QtCore import QDate, QTime, QTimer
from PySide6.QtWidgets import (QButtonGroup, QCheckBox, QComboBox, QDateEdit, QFormLayout, QGridLayout, QGroupBox, QHBoxLayout,
                               QLineEdit, QListWidget, QPushButton, QRadioButton, QSpinBox, QTableWidget, QTableWidgetItem,
                               QTextEdit, QTimeEdit, QVBoxLayout, QWidget)

from ... import clock
from ...core.reviews import ERROR_CAUSES
from ...core.settings import SettingsError
from ...core.study import BLOCK_LABELS
from ..dialogs import ask, info, warn
from ..widgets import Card, button, label
from .base import scrollable


def _wrap(inner: QWidget) -> QWidget:
    outer = QWidget()
    lay = QVBoxLayout(outer)
    lay.setContentsMargins(0, 0, 0, 0)
    lay.addWidget(scrollable(inner))
    return outer


class PlanTab(QWidget):
    def __init__(self, page):
        super().__init__()
        self.page, self.ctx, self.win = page, page.ctx, page.win
        inner = QWidget()
        lay = QVBoxLayout(inner)
        lay.setContentsMargins(12, 12, 12, 12)
        lay.setSpacing(12)
        card = Card("Rotina de estudo (ponto de partida: 2 horas pela manhã)")
        form = QFormLayout()
        self.start = QTimeEdit()
        self.start.setDisplayFormat("HH:mm")
        self.minutes = QSpinBox()
        self.minutes.setRange(15, 600)
        self.minutes.setSingleStep(15)
        self.minutes.setSuffix(" min")
        self.brk = QSpinBox()
        self.brk.setRange(0, 60)
        self.brk.setSuffix(" min de intervalo (dentro da duração)")
        form.addRow("Horário de início", self.start)
        form.addRow("Duração total", self.minutes)
        form.addRow("Intervalos", self.brk)
        days = QHBoxLayout()
        self.days = []
        for i, d in enumerate(clock.WEEKDAYS_SHORT):
            cb = QCheckBox(d)
            self.days.append(cb)
            days.addWidget(cb)
        form.addRow("Dias da semana", days)
        blocks = QHBoxLayout()
        self.blocks = {}
        for k in ("lei_seca", "teoria", "questoes", "revisao"):
            sp = QSpinBox()
            sp.setRange(0, 600)
            sp.setSuffix("′")
            sp.valueChanged.connect(self._sum)
            self.blocks[k] = sp
            blocks.addWidget(label(BLOCK_LABELS[k], wrap=False))
            blocks.addWidget(sp)
        form.addRow("Blocos (ciclos 1 e 2)", blocks)
        self.sum_lb = label("", muted=True)
        form.addRow("", self.sum_lb)
        self.qgoal = QSpinBox()
        self.qgoal.setRange(0, 500)
        form.addRow("Meta de questões por sessão", self.qgoal)
        self.wgoal = QSpinBox()
        self.wgoal.setRange(0, 6000)
        self.wgoal.setSuffix(" min/semana")
        self.wgoal.setSingleStep(30)
        form.addRow("Meta semanal de estudo", self.wgoal)
        self.intensity = QComboBox()
        for k, v in (("leve", "Leve — poucos avisos"), ("normal", "Normal"), ("intensa", "Intensa — cobrança mais frequente")):
            self.intensity.addItem(v, k)
        form.addRow("Intensidade do plano / cobrança", self.intensity)
        self.cycle = QComboBox()
        for k, v in ((1, "Ciclo 1 — Base"), (2, "Ciclo 2 — Expansão"), (3, "Ciclo 3 — Reta final")):
            self.cycle.addItem(v, k)
        form.addRow("Ciclo ativo", self.cycle)
        self.cweek = QSpinBox()
        self.cweek.setRange(1, 1000)
        form.addRow("Semana atual do ciclo (ímpar/par)", self.cweek)
        self.exam_name = QLineEdit()
        self.exam_name.setPlaceholderText("Ex.: ENAM, concurso de Juiz Substituto…")
        form.addRow("Prova pretendida", self.exam_name)
        self.exam_has = QCheckBox("Data conhecida")
        self.exam_date = QDateEdit(QDate.currentDate().addMonths(3))
        self.exam_date.setCalendarPopup(True)
        self.exam_date.setDisplayFormat("dd/MM/yyyy")
        er = QHBoxLayout()
        er.addWidget(self.exam_has)
        er.addWidget(self.exam_date)
        form.addRow("Data da prova", er)
        self.extra = QLineEdit()
        self.extra.setPlaceholderText("Matérias complementares, separadas por vírgula")
        form.addRow("Matérias extras (Ciclo 2)", self.extra)
        card.lay.addLayout(form)
        row = QHBoxLayout()
        row.addWidget(button("Salvar configurações", primary=True, slot=self.save))
        self.btn_start = button("Iniciar plano hoje", slot=self.start_plan)
        row.addWidget(self.btn_start)
        row.addStretch(1)
        card.lay.addLayout(row)
        card.add(label("A carga horária nunca é alterada automaticamente: quando o desempenho justificar, o JARMES apenas propõe um aumento "
                       "(Painel principal) e você decide.", muted=True))
        lay.addWidget(card)

        wk = Card("Plano dos próximos 7 dias (ciclo ativo)")
        self.week = QTableWidget(0, 4)
        self.week.setHorizontalHeaderLabels(["Dia", "Disciplina / foco", "Lei seca", "Blocos"])
        self.week.horizontalHeader().setStretchLastSection(True)
        self.week.setMinimumHeight(260)
        self.week.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        wk.add(self.week)
        lay.addWidget(wk)

        les = Card("Ciclo 1 — marque quando concluir as aulas de cada matéria-base")
        self.lessons_box = QVBoxLayout()
        les.lay.addLayout(self.lessons_box)
        les.add(label("Quando todas estiverem marcadas, o JARMES propõe passar ao Ciclo 2 (a decisão continua sendo sua).", muted=True))
        lay.addWidget(les)
        lay.addStretch(1)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scrollable(inner))
        self._lesson_checks: list[tuple[str, QCheckBox]] = []

    def _sum(self):
        total = sum(sp.value() for sp in self.blocks.values())
        self.sum_lb.setText(f"Soma dos blocos: {total} min — o JARMES ajusta proporcionalmente à duração total ({self.minutes.value()} min).")

    def refresh(self):
        s = self.ctx.settings
        h, m = map(int, s.get("study_start").split(":"))
        self.start.setTime(QTime(h, m))
        self.minutes.setValue(int(s.get("study_minutes")))
        self.brk.setValue(int(s.get("study_break_minutes")))
        for i, cb in enumerate(self.days):
            cb.setChecked(i in s.get("study_days"))
        for k, sp in self.blocks.items():
            sp.setValue(int(s.get("study_blocks").get(k, 0)))
        self.qgoal.setValue(int(s.get("questions_goal")))
        self.wgoal.setValue(int(s.get("weekly_goal_minutes")))
        self.intensity.setCurrentIndex(self.intensity.findData(s.get("intensity")))
        self.cycle.setCurrentIndex(self.cycle.findData(int(s.get("active_cycle"))))
        self.cweek.setValue(int(s.get("cycle_week")))
        self.exam_name.setText(s.get("exam_name"))
        d = clock.parse_date(s.get("exam_date"))
        self.exam_has.setChecked(bool(d))
        if d:
            self.exam_date.setDate(QDate(d.year, d.month, d.day))
        self.extra.setText(", ".join(s.get("extra_disciplines") or []))
        started = bool(s.get("plan_start_date"))
        self.btn_start.setText("Reiniciar plano a partir de hoje" if started else "Iniciar plano hoje")
        self._sum()
        # tabela da semana
        self.week.setRowCount(0)
        today = clock.today()
        for i in range(7):
            day = today + timedelta(days=i)
            p = self.ctx.study.plan_for(day)
            r = self.week.rowCount()
            self.week.insertRow(r)
            self.week.setItem(r, 0, QTableWidgetItem(f"{clock.WEEKDAYS_SHORT[day.weekday()]} {day:%d/%m}"))
            if p:
                self.week.setItem(r, 1, QTableWidgetItem(p.discipline))
                self.week.setItem(r, 2, QTableWidgetItem(p.lei_seca))
                self.week.setItem(r, 3, QTableWidgetItem(" · ".join(f"{b['label']} {b['minutes']}′" for b in p.blocks)))
            else:
                self.week.setItem(r, 1, QTableWidgetItem("— sem sessão —"))
        self.week.resizeColumnsToContents()
        # aulas concluídas
        while self.lessons_box.count():
            w = self.lessons_box.takeAt(0).widget()
            if w:
                w.deleteLater()
        self._lesson_checks = []
        done = {r["name"] for r in self.ctx.db.query("SELECT name FROM disciplines WHERE lessons_done=1")}
        for name in self.ctx.study.cycle_disciplines(1):
            cb = QCheckBox(name)
            cb.setChecked(name in done)
            cb.toggled.connect(lambda v, n=name: self._lesson(n, v))
            self.lessons_box.addWidget(cb)

    def _lesson(self, name: str, value: bool):
        self.ctx.study.set_lessons_done(name, value)
        self.win.data_changed()

    def save(self):
        s = self.ctx.settings
        old_minutes = int(s.get("study_minutes"))
        try:
            days = [i for i, cb in enumerate(self.days) if cb.isChecked()]
            blocks = {k: sp.value() for k, sp in self.blocks.items() if sp.value() > 0}
            new_minutes = self.minutes.value()
            if new_minutes != old_minutes and not ask(self, "Alterar carga horária",
                                                      f"A duração da sessão mudará de {old_minutes} para {new_minutes} min. Confirmar?"):
                return
            t = self.start.time()
            s.set("study_start", f"{t.hour():02d}:{t.minute():02d}")
            s.set("study_minutes", new_minutes)
            s.set("study_break_minutes", self.brk.value())
            s.set("study_days", days)
            s.set("study_blocks", blocks)
            s.set("questions_goal", self.qgoal.value())
            s.set("weekly_goal_minutes", self.wgoal.value())
            s.set("intensity", self.intensity.currentData())
            s.set("active_cycle", self.cycle.currentData())
            s.set("cycle_week", self.cweek.value())
            s.set("exam_name", self.exam_name.text().strip())
            s.set("exam_date", self.exam_date.date().toString("yyyy-MM-dd") if self.exam_has.isChecked() else "")
            extras = [x.strip() for x in self.extra.text().split(",") if x.strip()]
            s.set("extra_disciplines", extras)
            self.ctx.study.seed_disciplines()
        except SettingsError as exc:
            warn(self, "Configuração inválida", str(exc))
            return
        # sessões futuras ainda não iniciadas são recalculadas; as já registradas permanecem
        self.ctx.db.execute("DELETE FROM study_sessions WHERE status='planned' AND planned_date >= ? AND kind IN ('matinal','simulado')",
                            (clock.today().isoformat(),))
        info(self, "Salvo", "Configurações do plano salvas. Sessões futuras ainda não iniciadas foram recalculadas.")
        self.win.data_changed()

    def start_plan(self):
        started = bool(self.ctx.settings.get("plan_start_date"))
        if started and not ask(self, "Reiniciar plano", "As pendências antigas serão mantidas, mas a contagem do plano passa a começar hoje. Continuar?"):
            return
        self.ctx.settings.set("plan_start_date", clock.today().isoformat())
        self.ctx.study.ensure_session(clock.today())
        info(self, "Plano iniciado", f"Plano iniciado em {clock.today():%d/%m/%Y}. A sessão de hoje já está disponível.")
        self.win.data_changed()


class ReviewTab(QWidget):
    def __init__(self, page):
        super().__init__()
        self.page, self.ctx, self.win = page, page.ctx, page.win
        self.card_row = None
        inner = QWidget()
        lay = QVBoxLayout(inner)
        lay.setContentsMargins(12, 12, 12, 12)
        lay.setSpacing(12)
        fc = Card("Flashcards — recuperação ativa", accent=True)
        self.count_lb = label("", muted=True)
        fc.add(self.count_lb)
        self.front = label("", "h2")
        fc.add(self.front)
        self.back = label("", "h3")
        fc.add(self.back)
        self.src_lb = label("", muted=True)
        fc.add(self.src_lb)
        btns = QHBoxLayout()
        self.b_show = button("Mostrar resposta", primary=True, slot=self.reveal)
        btns.addWidget(self.b_show)
        self.rate = []
        for q, text in ((0, "Errei"), (1, "Difícil"), (2, "Bom"), (3, "Fácil")):
            b = button(text, slot=lambda _=False, quality=q: self.rate_card(quality))
            self.rate.append(b)
            btns.addWidget(b)
        btns.addWidget(button("Excluir cartão", danger=True, slot=self.delete_card))
        btns.addStretch(1)
        fc.lay.addLayout(btns)
        lay.addWidget(fc)

        add = Card("Novo flashcard")
        form = QFormLayout()
        self.disc = QComboBox()
        self.disc.setEditable(True)
        self.f_front = QLineEdit()
        self.f_back = QTextEdit()
        self.f_back.setFixedHeight(60)
        form.addRow("Disciplina", self.disc)
        form.addRow("Pergunta / frente", self.f_front)
        form.addRow("Resposta / verso", self.f_back)
        add.lay.addLayout(form)
        add.add(button("Adicionar flashcard", slot=self.add_card))
        lay.addWidget(add)

        rv = Card("Revisões programadas de assuntos (D+1, D+7, D+30)")
        self.rev_list = QListWidget()
        self.rev_list.setMinimumHeight(140)
        rv.add(self.rev_list)
        rb = QHBoxLayout()
        rb.addWidget(button("Marcar como revisada", primary=True, slot=self.rev_done))
        rb.addWidget(button("Adiar 1 dia", slot=self.rev_postpone))
        rb.addStretch(1)
        rv.lay.addLayout(rb)
        lay.addWidget(rv)
        lay.addStretch(1)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scrollable(inner))
        self.cards = []
        self.reviews = []

    def refresh(self):
        c = self.ctx
        self.cards = [dict(r) for r in c.flashcards.due()]
        st = c.flashcards.stats()
        self.count_lb.setText(f"{len(self.cards)} vencido(s) agora · {st['total']} no total")
        self._show_card()
        self.disc.clear()
        self.disc.addItems(c.study.all_disciplines() + ["Geral"])
        self.rev_list.clear()
        self.reviews = [dict(r) for r in c.reviews.due()] + [dict(r) for r in c.reviews.upcoming(7) if r["due_date"] > clock.today().isoformat()]
        stage = {1: "D+1", 2: "D+7", 3: "D+30"}
        for r in self.reviews:
            venc = "VENCIDA" if r["due_date"] <= clock.today().isoformat() else "em breve"
            self.rev_list.addItem(f"{r['due_date'][8:10]}/{r['due_date'][5:7]} · {r['discipline']} — {r['topic'] or 'assunto da sessão'} ({stage.get(r['stage'], '')}, {venc})")
        if not self.reviews:
            self.rev_list.addItem("Nenhuma revisão programada. Elas são criadas ao confirmar uma sessão.")

    def _show_card(self):
        has = bool(self.cards)
        self.front.setText(self.cards[0]["front"] if has else "Nenhum flashcard para revisar agora.")
        self.back.setText("")
        self.src_lb.setText(f"{self.cards[0]['discipline']} · origem: {self.cards[0]['source']}" + (f" · p. {self.cards[0]['page']}" if has and self.cards[0]["page"] else "") if has else "")
        self.b_show.setVisible(has)
        for b in self.rate:
            b.setVisible(False)

    def reveal(self):
        if self.cards:
            self.back.setText(self.cards[0]["back"])
            self.b_show.setVisible(False)
            for b in self.rate:
                b.setVisible(True)

    def rate_card(self, quality: int):
        if self.cards:
            self.ctx.flashcards.review(self.cards[0]["id"], quality)
            self.win.data_changed()

    def delete_card(self):
        if self.cards and ask(self, "Excluir flashcard", "Excluir este cartão definitivamente?", "Excluir"):
            self.ctx.flashcards.delete(self.cards[0]["id"])
            self.win.data_changed()

    def add_card(self):
        try:
            self.ctx.flashcards.add(self.f_front.text(), self.f_back.toPlainText(), self.disc.currentText())
        except ValueError as exc:
            warn(self, "Dados inválidos", str(exc))
            return
        self.f_front.clear()
        self.f_back.clear()
        self.win.data_changed()

    def _sel(self):
        row = self.rev_list.currentRow()
        return self.reviews[row] if 0 <= row < len(self.reviews) else None

    def rev_done(self):
        r = self._sel()
        if r:
            self.ctx.reviews.complete(r["id"])
            self.win.data_changed()

    def rev_postpone(self):
        r = self._sel()
        if r:
            self.ctx.reviews.reschedule(r["id"], clock.parse_date(r["due_date"]) + timedelta(days=1))
            self.win.data_changed()


class ErrorsTab(QWidget):
    def __init__(self, page):
        super().__init__()
        self.page, self.ctx, self.win = page, page.ctx, page.win
        inner = QWidget()
        lay = QVBoxLayout(inner)
        lay.setContentsMargins(12, 12, 12, 12)
        lay.setSpacing(12)
        self.summary = label("", muted=True)
        lay.addWidget(self.summary)
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["Data", "Disciplina", "Assunto", "Causa", "Próx. revisão", "Situação"])
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setMinimumHeight(200)
        lay.addWidget(self.table)
        row = QHBoxLayout()
        row.addWidget(button("Revisar vencidos", primary=True, slot=self.review))
        row.addWidget(button("Criar flashcard do erro", slot=self.to_flashcard))
        row.addWidget(button("Excluir", danger=True, slot=self.delete))
        row.addStretch(1)
        lay.addLayout(row)
        form_card = Card("Registrar erro")
        form = QFormLayout()
        self.disc = QComboBox()
        self.disc.setEditable(True)
        self.topic = QLineEdit()
        self.statement = QTextEdit()
        self.statement.setFixedHeight(60)
        self.given = QLineEdit()
        self.correct = QLineEdit()
        self.expl = QTextEdit()
        self.expl.setFixedHeight(60)
        self.basis = QLineEdit()
        self.basis.setPlaceholderText("Só preencha com fundamento legal que você conferiu na fonte oficial")
        self.cause = QComboBox()
        self.cause.addItems([""] + ERROR_CAUSES)
        self.certainty = QComboBox()
        self.certainty.addItem("Provável (hipótese)", "provavel")
        self.certainty.addItem("Confirmada por mim", "confirmada")
        for name, w in (("Disciplina", self.disc), ("Assunto", self.topic), ("Enunciado", self.statement), ("Minha resposta", self.given),
                        ("Resposta correta", self.correct), ("Explicação", self.expl), ("Fundamento legal", self.basis),
                        ("Motivo do erro", self.cause), ("Certeza do motivo", self.certainty)):
            form.addRow(name, w)
        form_card.lay.addLayout(form)
        form_card.add(button("Adicionar ao caderno", primary=True, slot=self.add))
        lay.addWidget(form_card)
        lay.addStretch(1)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scrollable(inner))
        self.rows = []

    def refresh(self):
        c = self.ctx
        self.rows = [dict(r) for r in c.errors.all()]
        self.table.setRowCount(0)
        today = clock.today().isoformat()
        for e in self.rows:
            r = self.table.rowCount()
            self.table.insertRow(r)
            state = "resolvido" if e["resolved"] else ("revisar hoje" if e["next_review"] <= today else "agendado")
            for i, v in enumerate((e["date"], e["discipline"], e["topic"], e["cause"] + ("" if e["cause_certainty"] == "confirmada" or not e["cause"] else " (provável)"),
                                   e["next_review"] or "", state)):
                self.table.setItem(r, i, QTableWidgetItem(v))
        self.table.resizeColumnsToContents()
        causes = ", ".join(f"{r['cause']}: {r['n']}" for r in c.errors.by_cause()[:4]) or "sem causas registradas"
        self.summary.setText(f"{len(self.rows)} erro(s) · {len(c.errors.due())} para revisar hoje · principais causas: {causes}")
        self.disc.clear()
        self.disc.addItems(c.study.all_disciplines())

    def _sel(self):
        r = self.table.currentRow()
        return self.rows[r] if 0 <= r < len(self.rows) else None

    def add(self):
        try:
            self.ctx.errors.add(self.disc.currentText(), topic=self.topic.text(), statement=self.statement.toPlainText(),
                                given_answer=self.given.text(), correct_answer=self.correct.text(), explanation=self.expl.toPlainText(),
                                legal_basis=self.basis.text(), cause=self.cause.currentText(), cause_certainty=self.certainty.currentData())
        except ValueError as exc:
            warn(self, "Dados inválidos", str(exc))
            return
        for w in (self.topic, self.given, self.correct, self.basis):
            w.clear()
        self.statement.clear()
        self.expl.clear()
        self.win.data_changed()

    def delete(self):
        e = self._sel()
        if e and ask(self, "Excluir erro", "Excluir este registro do caderno?", "Excluir"):
            self.ctx.errors.delete(e["id"])
            self.win.data_changed()

    def to_flashcard(self):
        e = self._sel()
        if not e:
            return
        front = e["statement"] or f"{e['discipline']}: {e['topic']}"
        back = (e["correct_answer"] + "\n" + e["explanation"]).strip()
        try:
            self.ctx.flashcards.add(front, back or "(sem resposta registrada)", e["discipline"], source="erro")
            info(self, "Flashcard criado", "O cartão entrou na fila de revisão.")
        except ValueError as exc:
            warn(self, "Não foi possível", str(exc))
        self.win.data_changed()

    def review(self):
        due = [dict(r) for r in self.ctx.errors.due()]
        if not due:
            info(self, "Caderno de erros", "Nenhum erro vencido para revisar hoje.")
            return
        for e in due:
            info(self, f"{e['discipline']} — {e['topic'] or 'sem assunto'}", (e["statement"] or "(sem enunciado)") + "\n\nTente responder de cabeça. Clique OK para ver a resposta.")
            ok = ask(self, "Resposta", f"Correta: {e['correct_answer'] or '—'}\n\n{e['explanation'] or ''}\n\nVocê acertou desta vez?", "Acertei", "Errei")
            self.ctx.errors.review(e["id"], ok)
        self.win.data_changed()


class QuestionsTab(QWidget):
    def __init__(self, page):
        super().__init__()
        self.page, self.ctx, self.win = page, page.ctx, page.win
        inner = QWidget()
        lay = QVBoxLayout(inner)
        lay.setContentsMargins(12, 12, 12, 12)
        lay.setSpacing(12)
        res = Card("Registrar resultado de questões (QConcursos ou outra fonte)")
        form = QFormLayout()
        self.q_disc = QComboBox()
        self.q_disc.setEditable(True)
        self.q_topic = QLineEdit()
        self.q_total = QSpinBox()
        self.q_total.setRange(0, 1000)
        self.q_correct = QSpinBox()
        self.q_correct.setRange(0, 1000)
        self.q_date = QDateEdit(QDate.currentDate())
        self.q_date.setCalendarPopup(True)
        for n, w in (("Disciplina", self.q_disc), ("Assunto", self.q_topic), ("Questões resolvidas", self.q_total), ("Acertos", self.q_correct), ("Data", self.q_date)):
            form.addRow(n, w)
        res.lay.addLayout(form)
        rb = QHBoxLayout()
        rb.addWidget(button("Registrar resultado", primary=True, slot=self.record))
        rb.addWidget(button("Abrir QConcursos no navegador", slot=lambda: self.ctx.integrations.qconcursos.open_site()))
        rb.addStretch(1)
        res.lay.addLayout(rb)
        lay.addWidget(res)

        man = Card("Registrar estudo já realizado (manual)")
        mf = QFormLayout()
        self.m_disc = QComboBox()
        self.m_disc.setEditable(True)
        self.m_min = QSpinBox()
        self.m_min.setRange(5, 1440)
        self.m_min.setValue(60)
        self.m_min.setSuffix(" min")
        self.m_topic = QLineEdit()
        mf.addRow("Disciplina", self.m_disc)
        mf.addRow("Duração", self.m_min)
        mf.addRow("Assunto", self.m_topic)
        man.lay.addLayout(mf)
        man.add(button("Registrar estudo", slot=self.manual))
        lay.addWidget(man)

        sim = Card("Simulado cronometrado")
        sf = QHBoxLayout()
        self.s_n = QSpinBox()
        self.s_n.setRange(5, 200)
        self.s_n.setValue(30)
        self.s_n.setSuffix(" questões")
        self.s_min = QSpinBox()
        self.s_min.setRange(5, 600)
        self.s_min.setValue(60)
        self.s_min.setSuffix(" min")
        sf.addWidget(self.s_n)
        sf.addWidget(self.s_min)
        self.s_btn = button("Iniciar simulado", primary=True, slot=self.sim_toggle)
        sf.addWidget(self.s_btn)
        sf.addStretch(1)
        sim.lay.addLayout(sf)
        self.s_lb = label("Resolva as questões na plataforma de sua escolha; ao encerrar, informe o resultado real.", muted=True)
        sim.add(self.s_lb)
        lay.addWidget(sim)

        bank = Card("Banco de questões geradas por IA (não são questões oficiais)")
        self.b_stmt = label("")
        bank.add(self.b_stmt)
        self.b_group = QButtonGroup(self)
        self.b_opts: list[QRadioButton] = []
        for i in range(5):
            rb_ = QRadioButton()
            self.b_group.addButton(rb_, i)
            self.b_opts.append(rb_)
            bank.add(rb_)
        self.b_fb = label("")
        bank.add(self.b_fb)
        br = QHBoxLayout()
        br.addWidget(button("Responder", primary=True, slot=self.answer))
        br.addWidget(button("Próxima", slot=self.next_q))
        br.addStretch(1)
        bank.lay.addLayout(br)
        lay.addWidget(bank)
        lay.addStretch(1)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scrollable(inner))
        self._sim_end = None
        self._sim_timer = QTimer(self)
        self._sim_timer.timeout.connect(self._sim_tick)
        self._cur = None

    def refresh(self):
        names = self.ctx.study.all_disciplines()
        for cb in (self.q_disc, self.m_disc):
            cur = cb.currentText()
            cb.clear()
            cb.addItems(names)
            cb.setCurrentText(cur or (names[0] if names else ""))
        if self._cur is None:
            self.next_q()

    def record(self):
        d = self.q_date.date()
        try:
            self.ctx.integrations.qconcursos.record(date(d.year(), d.month(), d.day()), self.q_disc.currentText(), self.q_total.value(),
                                                    self.q_correct.value(), self.q_topic.text())
        except ValueError as exc:
            warn(self, "Dados inválidos", str(exc))
            return
        info(self, "Registrado", f"{self.q_correct.value()}/{self.q_total.value()} em {self.q_disc.currentText()}.")
        self.q_total.setValue(0)
        self.q_correct.setValue(0)
        self.win.data_changed()

    def manual(self):
        try:
            self.ctx.study.add_manual_session(clock.today(), self.m_disc.currentText(), self.m_min.value(), topic=self.m_topic.text(), notes="registro manual")
        except ValueError as exc:
            warn(self, "Dados inválidos", str(exc))
            return
        info(self, "Registrado", "Estudo manual registrado (marcado como informado por você).")
        self.win.data_changed()

    def sim_toggle(self):
        if self._sim_end is None:
            self._sim_end = clock.now() + timedelta(minutes=self.s_min.value())
            self._sim_timer.start(1000)
            self.s_btn.setText("Encerrar e registrar")
            self._sim_tick()
            return
        self._sim_timer.stop()
        self._sim_end = None
        self.s_btn.setText("Iniciar simulado")
        self.s_lb.setText("Simulado encerrado. Informe o resultado em “Registrar resultado de questões” (Disciplina: Simulado).")
        self.q_topic.setText("Simulado")
        self.q_total.setValue(self.s_n.value())

    def _sim_tick(self):
        left = int((self._sim_end - clock.now()).total_seconds())
        if left <= 0:
            self.s_lb.setText("⏰ Tempo esgotado! Encerre e registre o resultado.")
            self._sim_timer.stop()
            self.win.toast("Simulado", "Tempo esgotado.")
            return
        self.s_lb.setText(f"Tempo restante: {left // 3600:02d}:{left % 3600 // 60:02d}:{left % 60:02d}")

    def next_q(self):
        rows = self.ctx.db.query("SELECT * FROM question_bank")
        self._cur = dict(random.choice(rows)) if rows else None
        self.b_fb.setText("")
        self.b_group.setExclusive(False)
        for r in self.b_opts:
            r.setChecked(False)
        self.b_group.setExclusive(True)
        if not self._cur:
            self.b_stmt.setText("O banco está vazio. Peça ao JARMES: “crie dez perguntas sobre direitos humanos” (requer IA configurada).")
            for r in self.b_opts:
                r.setVisible(False)
            return
        self.b_stmt.setText(f"[{self._cur['discipline']}] {self._cur['statement']}")
        opts = json.loads(self._cur["options_json"])
        for i, r in enumerate(self.b_opts):
            r.setVisible(i < len(opts))
            if i < len(opts):
                r.setText(str(opts[i]))

    def answer(self):
        if not self._cur:
            return
        sel = self.b_group.checkedId()
        if sel < 0:
            info(self, "Responder", "Escolha uma alternativa.")
            return
        right = self._cur["answer_index"]
        ok = sel == right
        today = clock.today()
        self.ctx.integrations.qconcursos.record(today, self._cur["discipline"], 1, 1 if ok else 0, self._cur["topic"] or "", source="banco_local")
        opts = json.loads(self._cur["options_json"])
        self.b_fb.setText(("✔ Correto. " if ok else f"✖ Incorreto. Gabarito (segundo a IA, confira): {opts[right] if right is not None and right < len(opts) else '—'}. ") +
                          (self._cur["explanation"] or ""))
        if not ok and ask(self, "Caderno de erros", "Adicionar esta questão ao caderno de erros?", "Adicionar", "Agora não"):
            self.ctx.errors.add(self._cur["discipline"], topic=self._cur["topic"] or "", statement=self._cur["statement"],
                                given_answer=str(opts[sel]), correct_answer=str(opts[right]) if right is not None and right < len(opts) else "",
                                explanation=self._cur["explanation"] or "", cause="", cause_certainty="provavel")
        self.win.data_changed()

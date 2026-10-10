from __future__ import annotations

from datetime import datetime, timedelta

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (QComboBox, QDoubleSpinBox, QFormLayout, QHBoxLayout, QLineEdit, QSpinBox, QTableWidget,
                               QTableWidgetItem, QTabWidget, QVBoxLayout, QWidget)

from ... import clock
from ...core.tasks import PRIORITY_LABEL, RECURRENCE_LABEL
from .. import theme
from ..dialogs import TaskDialog, ask, info, warn, to_qdt, from_qdt
from ..widgets import Card, button, label, page_header
from .base import Page


class TasksPage(Page):
    key, title, icon = "tasks", "Gerenciador de tarefas", "check"

    def __init__(self, win):
        super().__init__(win)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.addWidget(page_header("Gerenciador de tarefas", "Prioridades, prazos, recorrência, lembretes, reagendamento e histórico de atrasos."))
        self.tabs = QTabWidget()
        lay.addWidget(self.tabs, 1)

        t1 = QWidget()
        l1 = QVBoxLayout(t1)
        flt = QHBoxLayout()
        self.list_box = QComboBox()
        self.list_box.currentIndexChanged.connect(self.refresh_table)
        self.status_box = QComboBox()
        for k, v in (("open", "Abertas"), ("done", "Concluídas"), ("", "Todas")):
            self.status_box.addItem(v, k)
        self.status_box.currentIndexChanged.connect(self.refresh_table)
        flt.addWidget(label("Lista:", wrap=False))
        flt.addWidget(self.list_box)
        flt.addWidget(label("Situação:", wrap=False))
        flt.addWidget(self.status_box)
        flt.addStretch(1)
        l1.addLayout(flt)
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["", "Tarefa", "Prioridade", "Prazo", "Repete", "Lista"])
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.itemDoubleClicked.connect(lambda _: self.edit())
        l1.addWidget(self.table, 1)
        row = QHBoxLayout()
        row.addWidget(button("＋ Nova tarefa", primary=True, slot=self.add))
        row.addWidget(button("✔ Concluir", slot=self.complete))
        row.addWidget(button("Reabrir", slot=self.reopen))
        row.addWidget(button("Reagendar…", slot=self.reschedule))
        row.addWidget(button("Editar", slot=self.edit))
        row.addWidget(button("Excluir", danger=True, slot=self.delete))
        row.addStretch(1)
        l1.addLayout(row)
        self.tabs.addTab(t1, "Tarefas")

        t2 = QWidget()
        l2 = QVBoxLayout(t2)
        l2.addWidget(label("Histórico de atrasos: tarefas detectadas em atraso, concluídas depois do prazo e reagendamentos.", muted=True))
        self.hist = QTableWidget(0, 4)
        self.hist.setHorizontalHeaderLabels(["Quando", "Tarefa", "Evento", "Detalhe"])
        self.hist.horizontalHeader().setStretchLastSection(True)
        self.hist.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        l2.addWidget(self.hist)
        self.tabs.addTab(t2, "Histórico de atrasos")

        t3 = QWidget()
        l3 = QVBoxLayout(t3)
        self.goals = QTableWidget(0, 4)
        self.goals.setHorizontalHeaderLabels(["Meta", "Período", "Progresso (dados reais)", "Situação"])
        self.goals.horizontalHeader().setStretchLastSection(True)
        self.goals.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.goals.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        l3.addWidget(self.goals, 1)
        gc = Card("Nova meta")
        gf = QFormLayout()
        self.g_title = QLineEdit()
        self.g_metric = QComboBox()
        for k, v in (("minutes", "Minutos de estudo confirmados"), ("questions", "Questões resolvidas"), ("sessions", "Sessões concluídas"), ("manual", "Manual")):
            self.g_metric.addItem(v, k)
        self.g_target = QDoubleSpinBox()
        self.g_target.setRange(1, 100000)
        self.g_target.setValue(840)
        self.g_period = QComboBox()
        for k, v in (("weekly", "Semanal"), ("monthly", "Mensal")):
            self.g_period.addItem(v, k)
        for n, w in (("Título", self.g_title), ("Métrica", self.g_metric), ("Alvo", self.g_target), ("Período", self.g_period)):
            gf.addRow(n, w)
        gc.lay.addLayout(gf)
        gr = QHBoxLayout()
        gr.addWidget(button("Criar meta", primary=True, slot=self.add_goal))
        gr.addWidget(button("Arquivar selecionada", slot=self.archive_goal))
        gr.addStretch(1)
        gc.lay.addLayout(gr)
        l3.addWidget(gc)
        self.tabs.addTab(t3, "Metas pessoais")
        self._rows: list = []
        self._goal_rows: list = []

    def refresh(self):
        cur = self.list_box.currentData()
        self.list_box.blockSignals(True)
        self.list_box.clear()
        self.list_box.addItem("Todas as listas", None)
        for n in self.ctx.tasks.lists():
            self.list_box.addItem(n, n)
        idx = self.list_box.findData(cur)
        self.list_box.setCurrentIndex(max(0, idx))
        self.list_box.blockSignals(False)
        self.refresh_table()
        self.refresh_history()
        self.refresh_goals()

    def refresh_table(self):
        self._rows = list(self.ctx.tasks.list(self.status_box.currentData() or None, self.list_box.currentData()))
        self.table.setRowCount(0)
        now = clock.now()
        for t in self._rows:
            r = self.table.rowCount()
            self.table.insertRow(r)
            due = clock.parse_dt(t["due_at"])
            late = t["status"] == "open" and due and due < now
            vals = ("✔" if t["status"] == "done" else "☐", t["title"], PRIORITY_LABEL[t["priority"]],
                    (f"{due:%d/%m/%Y %H:%M}" + ("  ⚠ atrasada" if late else "")) if due else "—",
                    RECURRENCE_LABEL.get(t["recurrence"], ""), t["list_name"])
            for i, v in enumerate(vals):
                it = QTableWidgetItem(v)
                if late:
                    it.setForeground(QColor(theme.WARN))
                elif t["status"] == "done":
                    it.setForeground(QColor(theme.MUTED))
                self.table.setItem(r, i, it)
        self.table.resizeColumnsToContents()
        self.table.setColumnWidth(1, max(self.table.columnWidth(1), 280))

    def refresh_history(self):
        rows = self.ctx.tasks.delay_history()
        self.hist.setRowCount(0)
        names = {"atrasada": "Detectada em atraso", "concluida_com_atraso": "Concluída com atraso", "reagendada": "Reagendada"}
        for h in rows:
            r = self.hist.rowCount()
            self.hist.insertRow(r)
            detail = h["note"] or (f"{h['old_due']} → {h['new_due']}" if h["new_due"] else "")
            for i, v in enumerate((h["at"][:16], h["title"] or "(excluída)", names.get(h["event"], h["event"]), detail)):
                self.hist.setItem(r, i, QTableWidgetItem(v))
        self.hist.resizeColumnsToContents()

    def refresh_goals(self):
        self._goal_rows = list(self.ctx.goals.list())
        self.goals.setRowCount(0)
        for g in self._goal_rows:
            p = self.ctx.goals.progress(g)
            r = self.goals.rowCount()
            self.goals.insertRow(r)
            state = "cumprida ✔" if p["met"] else ("encerrada sem cumprir" if p["ended"] else "em andamento")
            unit = {"minutes": "min", "questions": "questões", "sessions": "sessões", "manual": ""}[g["metric"]]
            for i, v in enumerate((g["title"], f"{g['start_date'][5:].replace('-', '/')} a {g['end_date'][5:].replace('-', '/')}",
                                   f"{p['value']:.0f} / {g['target']:.0f} {unit} ({p['ratio']:.0%})", state)):
                self.goals.setItem(r, i, QTableWidgetItem(v))
        self.goals.resizeColumnsToContents()

    def _sel(self):
        r = self.table.currentRow()
        return self._rows[r] if 0 <= r < len(self._rows) else None

    def add(self):
        dlg = TaskDialog(self, None, self.ctx.tasks.lists())
        if dlg.exec():
            v = dlg.values()
            try:
                self.ctx.tasks.add(v["title"], due=v["due"], priority=v["priority"], notes=v["notes"], list_name=v["list_name"],
                                   recurrence=v["recurrence"], remind_at=v["remind_at"])
            except ValueError as exc:
                warn(self, "Dados inválidos", str(exc))
                return
            self.win.data_changed()

    def edit(self):
        t = self._sel()
        if not t:
            return
        dlg = TaskDialog(self, t, self.ctx.tasks.lists())
        if dlg.exec():
            v = dlg.values()
            try:
                self.ctx.tasks.update(t["id"], title=v["title"], notes=v["notes"], list_name=v["list_name"], priority=v["priority"],
                                      due_at=v["due"], recurrence=v["recurrence"], remind_at=v["remind_at"])
            except ValueError as exc:
                warn(self, "Dados inválidos", str(exc))
                return
            self.win.data_changed()

    def complete(self):
        t = self._sel()
        if t and t["status"] == "open":
            new = self.ctx.tasks.complete(t["id"])
            if new:
                info(self, "Tarefa recorrente", "Concluída. Criei a próxima ocorrência.")
            self.win.data_changed()

    def reopen(self):
        t = self._sel()
        if t and t["status"] == "done":
            self.ctx.tasks.reopen(t["id"])
            self.win.data_changed()

    def reschedule(self):
        t = self._sel()
        if not t:
            return
        from PySide6.QtWidgets import QDateTimeEdit, QDialog, QDialogButtonBox
        d = QDialog(self)
        d.setWindowTitle("Reagendar tarefa")
        v = QVBoxLayout(d)
        v.addWidget(label(f"Novo prazo para “{t['title']}”:"))
        dt = QDateTimeEdit(to_qdt(max(clock.now(), clock.parse_dt(t["due_at"]) or clock.now()) + timedelta(days=1)))
        dt.setCalendarPopup(True)
        dt.setDisplayFormat("dd/MM/yyyy HH:mm")
        v.addWidget(dt)
        note = QLineEdit()
        note.setPlaceholderText("Motivo (opcional)")
        v.addWidget(note)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(d.accept)
        bb.rejected.connect(d.reject)
        v.addWidget(bb)
        if d.exec():
            self.ctx.tasks.reschedule(t["id"], from_qdt(dt.dateTime()), note.text())
            self.win.data_changed()

    def delete(self):
        t = self._sel()
        if t and ask(self, "Excluir tarefa", f"Excluir “{t['title']}” definitivamente?", "Excluir"):
            self.ctx.tasks.delete(t["id"])
            self.win.data_changed()

    def add_goal(self):
        try:
            self.ctx.goals.add(self.g_title.text(), self.g_metric.currentData(), self.g_target.value(), self.g_period.currentData())
        except ValueError as exc:
            warn(self, "Dados inválidos", str(exc))
            return
        self.g_title.clear()
        self.win.data_changed()

    def archive_goal(self):
        r = self.goals.currentRow()
        if 0 <= r < len(self._goal_rows):
            self.ctx.goals.archive(self._goal_rows[r]["id"])
            self.win.data_changed()

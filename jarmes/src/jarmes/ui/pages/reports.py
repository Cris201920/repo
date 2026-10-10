from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from PySide6.QtCore import QDate
from PySide6.QtWidgets import QDateEdit, QFileDialog, QHBoxLayout, QTabWidget, QTextEdit, QVBoxLayout, QWidget

from ... import clock
from .. import theme
from ..dialogs import info
from ..widgets import BarChart, Card, button, label, page_header
from .base import Page, scrollable


class ReportsPage(Page):
    key, title, icon = "reports", "Relatórios de desempenho", "chart"

    def __init__(self, win):
        super().__init__(win)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.addWidget(page_header("Relatórios de desempenho", "Calculados somente com registros reais. O que não foi registrado aparece como “não registrado”."))
        self.tabs = QTabWidget()
        lay.addWidget(self.tabs, 1)

        d = QWidget()
        dl = QVBoxLayout(d)
        bar = QHBoxLayout()
        self.day = QDateEdit(QDate.currentDate())
        self.day.setCalendarPopup(True)
        self.day.setDisplayFormat("dd/MM/yyyy")
        self.day.dateChanged.connect(self.refresh_daily)
        bar.addWidget(label("Dia:", wrap=False))
        bar.addWidget(self.day)
        bar.addWidget(button("Exportar…", slot=lambda: self.export(self.daily.toPlainText(), "relatorio-diario")))
        bar.addStretch(1)
        dl.addLayout(bar)
        self.daily = QTextEdit()
        self.daily.setReadOnly(True)
        dl.addWidget(self.daily, 1)
        self.tabs.addTab(d, "Diário")

        w = QWidget()
        wl = QVBoxLayout(w)
        wb = QHBoxLayout()
        self.week = QDateEdit(QDate.currentDate())
        self.week.setCalendarPopup(True)
        self.week.setDisplayFormat("dd/MM/yyyy")
        self.week.dateChanged.connect(self.refresh_weekly)
        wb.addWidget(label("Semana que contém:", wrap=False))
        wb.addWidget(self.week)
        wb.addWidget(button("Exportar…", slot=lambda: self.export(self.weekly.toPlainText(), "relatorio-semanal")))
        wb.addStretch(1)
        wl.addLayout(wb)
        inner = QWidget()
        il = QVBoxLayout(inner)
        c1 = Card("Minutos confirmados por dia")
        self.chart_days = BarChart()
        c1.add(self.chart_days)
        il.addWidget(c1)
        c2 = Card("Acerto por disciplina na semana (%)")
        self.chart_acc = BarChart(unit="%", max_value=100, color=theme.BLUE)
        c2.add(self.chart_acc)
        il.addWidget(c2)
        c3 = Card("Minutos por disciplina na semana")
        self.chart_disc = BarChart()
        c3.add(self.chart_disc)
        il.addWidget(c3)
        self.weekly = QTextEdit()
        self.weekly.setReadOnly(True)
        self.weekly.setMinimumHeight(300)
        il.addWidget(self.weekly)
        wl.addWidget(scrollable(inner), 1)
        self.tabs.addTab(w, "Semanal")

    def _pyd(self, qd: QDateEdit) -> date:
        d = qd.date()
        return date(d.year(), d.month(), d.day())

    def refresh(self):
        self.refresh_daily()
        self.refresh_weekly()

    def refresh_daily(self):
        self.daily.setPlainText(self.ctx.reports.daily_text(self._pyd(self.day)))

    def refresh_weekly(self):
        ref = self._pyd(self.week)
        w = self.ctx.reports.weekly(ref)
        mon = w["monday"]
        self.chart_days.set_items([(clock.WEEKDAYS_SHORT[i], w["minutes_by_day"].get(mon + timedelta(days=i), 0.0)) for i in range(7)])
        self.chart_acc.empty_text = "Nenhuma questão registrada nesta semana."
        self.chart_acc.set_items([(a["discipline"].replace("Direito ", ""), round(a["rate"] * 100)) for a in w["accuracy"]])
        self.chart_disc.set_items([(n.replace("Direito ", ""), m) for n, m in w["by_discipline"]])
        self.weekly.setPlainText(self.ctx.reports.weekly_text(ref))

    def export(self, text: str, base: str):
        path, _ = QFileDialog.getSaveFileName(self, "Exportar relatório", str(Path.home() / f"{base}.txt"), "Texto (*.txt);;Markdown (*.md)")
        if path:
            Path(path).write_text(text, encoding="utf-8")
            info(self, "Exportado", f"Relatório salvo em:\n{path}")

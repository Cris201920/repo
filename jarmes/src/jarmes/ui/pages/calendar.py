from __future__ import annotations

from datetime import date, datetime, timedelta

from PySide6.QtCore import QDate, QLocale, Qt
from PySide6.QtGui import QColor, QTextCharFormat
from PySide6.QtWidgets import (QButtonGroup, QCalendarWidget, QHBoxLayout, QListWidget, QListWidgetItem, QRadioButton, QVBoxLayout)

from ... import clock
from .. import theme
from ..dialogs import EventDialog, ask, warn
from ..widgets import button, label, page_header
from .base import Page

MODES = (("day", "Dia"), ("week", "Semana"), ("month", "Mês"))


class CalendarPage(Page):
    key, title, icon = "calendar", "Calendário e agenda", "calendar"

    def __init__(self, win):
        super().__init__(win)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.addWidget(page_header("Calendário e agenda", "Compromissos, sessões de estudo e recuperações — com detecção de conflitos."))
        body = QHBoxLayout()
        left = QVBoxLayout()
        self.cal = QCalendarWidget()
        self.cal.setLocale(QLocale(QLocale.Language.Portuguese, QLocale.Country.Brazil))
        self.cal.setGridVisible(False)
        self.cal.setFirstDayOfWeek(Qt.DayOfWeek.Monday)
        head = QTextCharFormat()
        head.setForeground(QColor(theme.CYAN))
        head.setBackground(QColor(theme.PANEL_ALT))
        self.cal.setHeaderTextFormat(head)
        for wd in (Qt.DayOfWeek.Saturday, Qt.DayOfWeek.Sunday):
            f = QTextCharFormat()
            f.setForeground(QColor(theme.MUTED))
            self.cal.setWeekdayTextFormat(wd, f)
        self.cal.setVerticalHeaderFormat(QCalendarWidget.VerticalHeaderFormat.NoVerticalHeader)
        self.cal.selectionChanged.connect(self.refresh_list)
        self.cal.currentPageChanged.connect(lambda *_: self._mark_days())
        left.addWidget(self.cal)
        modes = QHBoxLayout()
        self.group = QButtonGroup(self)
        for i, (k, text) in enumerate(MODES):
            r = QRadioButton(text)
            r.setProperty("mode", k)
            self.group.addButton(r, i)
            modes.addWidget(r)
            if k == "day":
                r.setChecked(True)
        self.group.buttonClicked.connect(lambda _: self.refresh_list())
        modes.addStretch(1)
        left.addLayout(modes)
        left.addWidget(button("Hoje", slot=lambda: self.cal.setSelectedDate(QDate.currentDate())))
        body.addLayout(left, 1)
        right = QVBoxLayout()
        self.heading = label("", "h2")
        right.addWidget(self.heading)
        self.list = QListWidget()
        self.list.itemDoubleClicked.connect(lambda _: self.edit())
        right.addWidget(self.list, 1)
        row = QHBoxLayout()
        row.addWidget(button("＋ Novo compromisso", primary=True, slot=self.add))
        row.addWidget(button("Editar", slot=self.edit))
        row.addWidget(button("Excluir", danger=True, slot=self.delete))
        right.addLayout(row)
        body.addLayout(right, 2)
        lay.addLayout(body, 1)
        self._events: list[dict] = []

    def _mode(self) -> str:
        b = self.group.checkedButton()
        return b.property("mode") if b else "day"

    def _selected(self) -> date:
        d = self.cal.selectedDate()
        return date(d.year(), d.month(), d.day())

    def _mark_days(self):
        fmt = QTextCharFormat()
        fmt.setBackground(QColor("#123a63"))
        fmt.setForeground(QColor(theme.CYAN))
        self.cal.setDateTextFormat(QDate(), QTextCharFormat())
        y, m = self.cal.yearShown(), self.cal.monthShown()
        for ev in self.ctx.calendar.on_month(y, m):
            d = clock.parse_dt(ev["start_at"])
            self.cal.setDateTextFormat(QDate(d.year, d.month, d.day), fmt)

    def refresh(self):
        self._mark_days()
        self.refresh_list()

    def refresh_list(self):
        day, mode = self._selected(), self._mode()
        c = self.ctx.calendar
        if mode == "day":
            events, title = c.on_day(day), clock.fmt_date_long(day)
        elif mode == "week":
            mon = clock.monday_of(day)
            events, title = c.on_week(day), f"Semana de {mon:%d/%m} a {mon + timedelta(days=6):%d/%m}"
        else:
            events, title = c.on_month(day.year, day.month), f"{clock.MONTHS_PT[day.month - 1].capitalize()} de {day.year}"
        self.heading.setText(title)
        tasks = self.ctx.tasks.due_on(day) if mode == "day" else []
        self._events = events
        self.list.clear()
        for e in events:
            s, en = clock.parse_dt(e["start_at"]), clock.parse_dt(e["end_at"])
            prefix = f"{s:%a %d/%m} " if mode != "day" else ""
            rec = " ↻" if e["recurrence"] != "none" else ""
            self.list.addItem(QListWidgetItem(f"{prefix}{s:%H:%M}–{en:%H:%M}  {e['title']}{rec}" + (f"  · {e['location']}" if e["location"] else "")))
        for t in tasks:
            it = QListWidgetItem(f"☐ tarefa: {t['title']}  ({clock.parse_dt(t['due_at']):%H:%M})")
            it.setForeground(QColor(theme.MUTED))
            it.setFlags(Qt.ItemFlag.NoItemFlags)
            self.list.addItem(it)
        if not events and not tasks:
            it = QListWidgetItem("Nada agendado neste período.")
            it.setFlags(Qt.ItemFlag.NoItemFlags)
            self.list.addItem(it)

    def _current(self):
        row = self.list.currentRow()
        return self._events[row] if 0 <= row < len(self._events) else None

    def add(self):
        day = self._selected()
        start = datetime.combine(day, datetime.min.time()).replace(hour=max(clock.now().hour + 1, 8) if day == clock.today() else 9)
        dlg = EventDialog(self, None, start)
        if dlg.exec():
            v = dlg.values()
            conflicts = self.ctx.calendar.conflicts(v["start"], v["end"])
            if conflicts and not ask(self, "Conflito de horário", "Conflita com: " + "; ".join(f"{e['title']} ({clock.parse_dt(e['start_at']):%H:%M})" for e in conflicts) + "\n\nCriar mesmo assim?", "Criar mesmo assim", "Voltar"):
                return
            self.ctx.calendar.add(v["title"], v["start"], v["end"], notes=v["notes"], location=v["location"], kind=v["kind"],
                                  remind_minutes=v["remind_minutes"], recurrence=v["recurrence"])
            self.win.data_changed()

    def edit(self):
        e = self._current()
        if not e:
            return
        full = self.ctx.calendar.get(e["id"])
        dlg = EventDialog(self, full)
        if dlg.exec():
            v = dlg.values()
            self.ctx.calendar.update(e["id"], title=v["title"], start_at=v["start"], end_at=v["end"], location=v["location"], kind=v["kind"],
                                     recurrence=v["recurrence"], remind_minutes=v["remind_minutes"], notes=v["notes"])
            self.win.data_changed()

    def delete(self):
        e = self._current()
        if e and ask(self, "Excluir compromisso", f"Excluir “{e['title']}”" + (" e todas as repetições?" if e["recurrence"] != "none" else "?"), "Excluir"):
            self.ctx.calendar.delete(e["id"])
            self.win.data_changed()

"""Diálogos reutilizáveis (tarefa, compromisso, check-out de estudo, recuperação)."""
from __future__ import annotations

from datetime import datetime, timedelta

from PySide6.QtCore import QDateTime, Qt
from PySide6.QtWidgets import (QCheckBox, QComboBox, QDateTimeEdit, QDialog, QDialogButtonBox, QDoubleSpinBox, QFormLayout,
                               QHBoxLayout, QLabel, QLineEdit, QMessageBox, QRadioButton, QSpinBox, QTextEdit, QVBoxLayout,
                               QWidget)

from .. import clock
from ..core.tasks import RECURRENCE_LABEL


def ask(parent, title: str, text: str, yes: str = "Confirmar", no: str = "Cancelar") -> bool:
    box = QMessageBox(parent)
    box.setWindowTitle(title)
    box.setText(text)
    box.setIcon(QMessageBox.Icon.Question)
    y = box.addButton(yes, QMessageBox.ButtonRole.AcceptRole)
    box.addButton(no, QMessageBox.ButtonRole.RejectRole)
    box.exec()
    return box.clickedButton() is y


def info(parent, title: str, text: str) -> None:
    QMessageBox.information(parent, title, text)


def warn(parent, title: str, text: str) -> None:
    QMessageBox.warning(parent, title, text)


def to_qdt(dt: datetime) -> QDateTime:
    return QDateTime(dt.year, dt.month, dt.day, dt.hour, dt.minute)


def from_qdt(q: QDateTime) -> datetime:
    d, t = q.date(), q.time()
    return datetime(d.year(), d.month(), d.day(), t.hour(), t.minute())


class _Base(QDialog):
    def __init__(self, parent, title: str):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.setMinimumWidth(460)
        self.form = QFormLayout()
        self.root = QVBoxLayout(self)
        self.root.addLayout(self.form)
        self.buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        self.buttons.button(QDialogButtonBox.StandardButton.Ok).setText("Salvar")
        self.buttons.button(QDialogButtonBox.StandardButton.Cancel).setText("Cancelar")
        self.buttons.accepted.connect(self._accept)
        self.buttons.rejected.connect(self.reject)
        self.root.addWidget(self.buttons)

    def _accept(self):
        try:
            self.validate()
        except ValueError as exc:
            warn(self, "Verifique os dados", str(exc))
            return
        self.accept()

    def validate(self):
        pass


class TaskDialog(_Base):
    def __init__(self, parent, task=None, lists: list[str] | None = None):
        super().__init__(parent, "Editar tarefa" if task else "Nova tarefa")
        self.title = QLineEdit(task["title"] if task else "")
        self.notes = QTextEdit(task["notes"] if task else "")
        self.notes.setFixedHeight(70)
        self.list_name = QComboBox()
        self.list_name.setEditable(True)
        self.list_name.addItems(lists or ["Geral"])
        if task:
            self.list_name.setCurrentText(task["list_name"])
        self.priority = QComboBox()
        self.priority.addItems(["Alta", "Média", "Baixa"])
        self.priority.setCurrentIndex((task["priority"] if task else 2) - 1)
        self.has_due = QCheckBox("Com prazo")
        self.due = QDateTimeEdit(to_qdt((clock.now() + timedelta(days=1)).replace(hour=18, minute=0)))
        self.due.setCalendarPopup(True)
        self.due.setDisplayFormat("dd/MM/yyyy HH:mm")
        if task and task["due_at"]:
            self.has_due.setChecked(True)
            self.due.setDateTime(to_qdt(clock.parse_dt(task["due_at"])))
        self.due.setEnabled(self.has_due.isChecked())
        self.has_due.toggled.connect(self.due.setEnabled)
        self.recurrence = QComboBox()
        for k, v in RECURRENCE_LABEL.items():
            self.recurrence.addItem(v, k)
        if task:
            self.recurrence.setCurrentIndex(self.recurrence.findData(task["recurrence"]))
        self.remind = QSpinBox()
        self.remind.setRange(0, 1440)
        self.remind.setSuffix(" min antes do prazo (0 = sem lembrete)")
        if task and task["remind_at"] and task["due_at"]:
            self.remind.setValue(int((clock.parse_dt(task["due_at"]) - clock.parse_dt(task["remind_at"])).total_seconds() // 60))
        for name, w in (("Título", self.title), ("Notas", self.notes), ("Lista", self.list_name), ("Prioridade", self.priority),
                        ("", self.has_due), ("Prazo", self.due), ("Repetição", self.recurrence), ("Lembrete", self.remind)):
            self.form.addRow(name, w)

    def validate(self):
        if not self.title.text().strip():
            raise ValueError("Informe o título da tarefa.")
        if self.recurrence.currentData() != "none" and not self.has_due.isChecked():
            raise ValueError("Tarefas recorrentes precisam de prazo.")
        if self.remind.value() and not self.has_due.isChecked():
            raise ValueError("Para usar lembrete defina o prazo.")

    def values(self) -> dict:
        due = from_qdt(self.due.dateTime()) if self.has_due.isChecked() else None
        remind = due - timedelta(minutes=self.remind.value()) if due and self.remind.value() else None
        return dict(title=self.title.text().strip(), notes=self.notes.toPlainText(), list_name=self.list_name.currentText().strip() or "Geral",
                    priority=self.priority.currentIndex() + 1, due=due, recurrence=self.recurrence.currentData(), remind_at=remind)


class EventDialog(_Base):
    def __init__(self, parent, event=None, default_start: datetime | None = None):
        super().__init__(parent, "Editar compromisso" if event else "Novo compromisso")
        start = clock.parse_dt(event["start_at"]) if event else (default_start or clock.now().replace(minute=0) + timedelta(hours=1))
        end = clock.parse_dt(event["end_at"]) if event else start + timedelta(hours=1)
        self.title = QLineEdit(event["title"] if event else "")
        self.start = QDateTimeEdit(to_qdt(start))
        self.end = QDateTimeEdit(to_qdt(end))
        for w in (self.start, self.end):
            w.setCalendarPopup(True)
            w.setDisplayFormat("dd/MM/yyyy HH:mm")
        self.location = QLineEdit(event["location"] if event else "")
        self.kind = QComboBox()
        for k, v in (("compromisso", "Compromisso"), ("estudo", "Estudo"), ("revisao", "Revisão"), ("outro", "Outro")):
            self.kind.addItem(v, k)
        if event:
            self.kind.setCurrentIndex(max(0, self.kind.findData(event["kind"])))
        self.recurrence = QComboBox()
        for k, v in RECURRENCE_LABEL.items():
            self.recurrence.addItem(v, k)
        if event:
            self.recurrence.setCurrentIndex(self.recurrence.findData(event["recurrence"]))
        self.remind = QSpinBox()
        self.remind.setRange(0, 1440)
        self.remind.setSuffix(" min antes")
        self.remind.setValue(event["remind_minutes"] if event else 15)
        self.notes = QTextEdit(event["notes"] if event else "")
        self.notes.setFixedHeight(60)
        for name, w in (("Título", self.title), ("Início", self.start), ("Término", self.end), ("Local", self.location),
                        ("Tipo", self.kind), ("Repetição", self.recurrence), ("Lembrete", self.remind), ("Notas", self.notes)):
            self.form.addRow(name, w)

    def validate(self):
        if not self.title.text().strip():
            raise ValueError("Informe o título do compromisso.")
        if from_qdt(self.end.dateTime()) <= from_qdt(self.start.dateTime()):
            raise ValueError("O término deve ser depois do início.")

    def values(self) -> dict:
        return dict(title=self.title.text().strip(), start=from_qdt(self.start.dateTime()), end=from_qdt(self.end.dateTime()),
                    location=self.location.text(), kind=self.kind.currentData(), recurrence=self.recurrence.currentData(),
                    remind_minutes=self.remind.value(), notes=self.notes.toPlainText())


class CheckoutDialog(_Base):
    """Check-out: o usuário CONFIRMA o que foi feito. Nada vem marcado por padrão."""

    def __init__(self, parent, session: dict, blocks: list[dict], suggested_minutes: float):
        super().__init__(parent, f"Confirmar sessão — {session.get('discipline') or ''}")
        self.root.insertWidget(0, QLabel("Marque apenas o que você realmente cumpriu. O JARMES não presume nada."))
        self.checks: dict[str, QCheckBox] = {}
        for b in blocks:
            cb = QCheckBox(f"{b['label']} ({b['minutes']} min)")
            cb.setChecked(b.get("done") is True)
            self.checks[b["key"]] = cb
            self.form.addRow(cb)
        self.minutes = QDoubleSpinBox()
        self.minutes.setRange(0, 1440)
        self.minutes.setDecimals(0)
        self.minutes.setSuffix(" min")
        self.minutes.setValue(round(suggested_minutes))
        self.form.addRow("Tempo efetivo de estudo", self.minutes)
        self.total = QSpinBox()
        self.total.setRange(0, 500)
        self.correct = QSpinBox()
        self.correct.setRange(0, 500)
        self.form.addRow("Questões respondidas (0 = não resolveu)", self.total)
        self.form.addRow("Acertos", self.correct)
        self.topic = QLineEdit(session.get("topic") or "")
        self.topic.setPlaceholderText("Assunto estudado (ex.: controle de constitucionalidade)")
        self.form.addRow("Assunto", self.topic)
        self.difficulty = QLineEdit()
        self.difficulty.setPlaceholderText("Principal dificuldade (opcional)")
        self.form.addRow("Dificuldade", self.difficulty)

    def validate(self):
        if self.correct.value() > self.total.value():
            raise ValueError("Os acertos não podem ser maiores que o total de questões.")

    def values(self) -> dict:
        has_q = self.total.value() > 0
        return dict(blocks_done={k: cb.isChecked() for k, cb in self.checks.items()}, effective_minutes=self.minutes.value(),
                    questions_total=self.total.value() if has_q else None, questions_correct=self.correct.value() if has_q else None,
                    difficulty=self.difficulty.text(), topic=self.topic.text().strip())


class RecoveryDialog(_Base):
    def __init__(self, parent, session: dict, options: list[dict]):
        super().__init__(parent, f"Recuperar: {session.get('discipline')}")
        self.root.insertWidget(0, QLabel(f"Sessão de {session['planned_date']} não confirmada. Escolha como recuperar "
                                         "(sem acumular tudo no dia seguinte):"))
        self.options = options
        self.radios: list[QRadioButton] = []
        for i, o in enumerate(options):
            r = QRadioButton(o["label"])
            r.setEnabled(not o.get("disabled"))
            self.radios.append(r)
            self.root.insertWidget(1 + i, r)
        for r in self.radios:
            if r.isEnabled():
                r.setChecked(True)
                break
        self.buttons.button(QDialogButtonBox.StandardButton.Ok).setText("Agendar")

    def chosen(self) -> dict | None:
        for r, o in zip(self.radios, self.options):
            if r.isChecked():
                return o
        return None

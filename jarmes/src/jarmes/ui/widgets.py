"""Componentes visuais reutilizáveis."""
from __future__ import annotations

import math

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, QRectF, Qt, QTimer, Property
from PySide6.QtGui import QColor, QFont, QPainter, QPen
from PySide6.QtWidgets import (QFrame, QHBoxLayout, QLabel, QPushButton, QSizePolicy, QVBoxLayout, QWidget)

from . import theme


def label(text: str = "", obj: str | None = None, wrap: bool = True, muted: bool = False) -> QLabel:
    lb = QLabel(text)
    if obj:
        lb.setObjectName(obj)
    if muted:
        lb.setProperty("muted", True)
    lb.setWordWrap(wrap)
    lb.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
    return lb


def button(text: str, primary: bool = False, danger: bool = False, slot=None, tooltip: str = "") -> QPushButton:
    b = QPushButton(text)
    if primary:
        b.setObjectName("primary")
    elif danger:
        b.setObjectName("danger")
    if slot:
        b.clicked.connect(slot)
    if tooltip:
        b.setToolTip(tooltip)
    b.setCursor(Qt.CursorShape.PointingHandCursor)
    return b


class Card(QFrame):
    def __init__(self, title: str = "", accent: bool = False, parent=None):
        super().__init__(parent)
        self.setObjectName("card")
        if accent:
            self.setProperty("accent", True)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(16, 14, 16, 14)
        self.lay = QVBoxLayout()          # conteúdo (aninhado: mantém altura-por-largura dos textos)
        self.lay.setSpacing(8)
        outer.addLayout(self.lay)
        outer.addStretch(1)               # empurra o conteúdo para o topo quando o cartão é esticado
        if title:
            self.title = label(title, "h2")
            self.lay.addWidget(self.title)

    def add(self, w, stretch: int = 0):
        self.lay.addWidget(w, stretch)
        return w


class PulseDot(QWidget):
    """Indicador de atividade com pulsação suave."""

    def __init__(self, color: str = theme.CYAN, size: int = 12, parent=None):
        super().__init__(parent)
        self._color = QColor(color)
        self._phase = 0.0
        self._active = False
        self.setFixedSize(size * 2, size * 2)
        self._timer = QTimer(self)
        self._timer.setInterval(40)
        self._timer.timeout.connect(self._tick)

    def set_active(self, active: bool, color: str | None = None) -> None:
        if color:
            self._color = QColor(color)
        self._active = active
        if active:
            self._timer.start()
        else:
            self._timer.stop()
            self._phase = 0.0
        self.update()

    def _tick(self):
        self._phase = (self._phase + 0.06) % 1.0
        self.update()

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        c = self.rect().center()
        r = self.width() / 4
        col = QColor(self._color)
        if self._active:
            halo = QColor(col)
            halo.setAlphaF(max(0.0, 0.5 * (1 - self._phase)))
            p.setBrush(halo)
            p.setPen(Qt.PenStyle.NoPen)
            rr = r * (1 + 1.4 * self._phase)
            p.drawEllipse(c, rr, rr)
        else:
            col.setAlphaF(0.45)
        p.setBrush(col)
        p.setPen(Qt.PenStyle.NoPen)
        p.drawEllipse(c, r, r)


class ProgressRing(QWidget):
    """Anel de progresso animado (valor 0..1) com texto central."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._value = 0.0
        self._shown = 0.0
        self.center_text = ""
        self.sub_text = ""
        self.setMinimumSize(130, 130)
        self._anim = QPropertyAnimation(self, b"shown", self)
        self._anim.setDuration(600)
        self._anim.setEasingCurve(QEasingCurve.Type.OutCubic)

    def get_shown(self):
        return self._shown

    def set_shown(self, v):
        self._shown = v
        self.update()

    shown = Property(float, get_shown, set_shown)

    def set_value(self, value: float, center: str, sub: str = "") -> None:
        self._value = max(0.0, min(1.0, value))
        self.center_text, self.sub_text = center, sub
        self._anim.stop()
        self._anim.setStartValue(self._shown)
        self._anim.setEndValue(self._value)
        self._anim.start()

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        side = min(self.width(), self.height()) - 16
        rect = QRectF((self.width() - side) / 2, (self.height() - side) / 2, side, side)
        pen = QPen(QColor(theme.BORDER), 10)
        pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        p.setPen(pen)
        p.drawArc(rect, 0, 360 * 16)
        pen.setColor(QColor(theme.CYAN))
        p.setPen(pen)
        p.drawArc(rect, 90 * 16, int(-360 * 16 * self._shown))
        p.setPen(QColor(theme.TEXT))
        f = QFont(self.font())
        f.setPointSizeF(15)
        f.setBold(True)
        p.setFont(f)
        p.drawText(rect.adjusted(0, -8, 0, -8), Qt.AlignmentFlag.AlignCenter, self.center_text)
        f.setPointSizeF(8.5)
        f.setBold(False)
        p.setFont(f)
        p.setPen(QColor(theme.MUTED))
        p.drawText(rect.adjusted(0, 26, 0, 26), Qt.AlignmentFlag.AlignCenter, self.sub_text)


class BarChart(QWidget):
    """Gráfico de barras simples (valores reais; sem dados fictícios)."""

    def __init__(self, parent=None, unit: str = "", max_value: float | None = None, color: str = theme.CYAN):
        super().__init__(parent)
        self.items: list[tuple[str, float]] = []
        self.unit, self.fixed_max, self.color = unit, max_value, color
        self.empty_text = "Sem dados registrados."
        self.setMinimumHeight(170)

    def set_items(self, items: list[tuple[str, float]]) -> None:
        self.items = items
        self.update()

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        w, h = self.width(), self.height()
        if not self.items or all(v == 0 for _, v in self.items) and self.fixed_max is None:
            p.setPen(QColor(theme.MUTED))
            p.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, self.empty_text)
            return
        top = self.fixed_max or max(v for _, v in self.items) or 1
        n = len(self.items)
        slot = (w - 20) / n
        bw = min(46, slot * 0.6)
        base = h - 34
        p.setPen(QPen(QColor(theme.BORDER), 1))
        p.drawLine(10, base, w - 10, base)
        for i, (name, v) in enumerate(self.items):
            x = 10 + i * slot + (slot - bw) / 2
            bh = (base - 24) * (v / top) if top else 0
            p.setBrush(QColor(self.color))
            p.setPen(Qt.PenStyle.NoPen)
            p.drawRoundedRect(QRectF(x, base - bh, bw, max(bh, 1)), 4, 4)
            p.setPen(QColor(theme.TEXT))
            p.drawText(QRectF(x - 14, base - bh - 20, bw + 28, 18), Qt.AlignmentFlag.AlignCenter,
                       f"{v:.0f}{self.unit}" if v == int(v) else f"{v:.1f}{self.unit}")
            p.setPen(QColor(theme.MUTED))
            p.drawText(QRectF(x - 22, base + 4, bw + 44, 28), Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop,
                       name if len(name) < 14 else name[:12] + "…")


class StatusChip(QFrame):
    def __init__(self, text: str, status: str, detail: str = "", parent=None):
        super().__init__(parent)
        color = theme.STATUS_COLORS.get(status, theme.MUTED)
        self.setStyleSheet(f"QFrame {{ background: {theme.PANEL_ALT}; border: 1px solid {color}; border-radius: 10px; }}"
                           f"QLabel {{ border: none; background: transparent; }}")
        lay = QHBoxLayout(self)
        lay.setContentsMargins(8, 2, 10, 2)
        lay.setSpacing(6)
        dot = QLabel("●")
        dot.setStyleSheet(f"color: {color}; font-size: 9pt;")
        lay.addWidget(dot)
        lab = QLabel(text)
        lab.setStyleSheet("font-size: 9pt;")
        lay.addWidget(lab)
        self.setToolTip(detail)


def hline() -> QFrame:
    f = QFrame()
    f.setFrameShape(QFrame.Shape.HLine)
    f.setStyleSheet(f"color: {theme.BORDER}; background: {theme.BORDER}; max-height: 1px; border: none;")
    return f


def page_header(title: str, subtitle: str = "") -> QWidget:
    w = QWidget()
    lay = QVBoxLayout(w)
    lay.setContentsMargins(0, 0, 0, 4)
    lay.setSpacing(2)
    lay.addWidget(label(title, "h1", wrap=False))
    if subtitle:
        lay.addWidget(label(subtitle, muted=True))
    return w

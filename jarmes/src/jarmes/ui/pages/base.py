from __future__ import annotations

from PySide6.QtWidgets import QScrollArea, QVBoxLayout, QWidget


class Page(QWidget):
    """Página do aplicativo. `refresh()` recarrega os dados reais a cada visita."""
    key = ""
    title = ""
    icon = "home"

    def __init__(self, win):
        super().__init__()
        self.win = win
        self.ctx = win.ctx
        self.setObjectName("page")

    def refresh(self) -> None:  # sobrescrever
        pass

    def on_arg(self, arg) -> None:  # parâmetro de navegação opcional
        pass


def scrollable(inner: QWidget) -> QScrollArea:
    area = QScrollArea()
    area.setWidgetResizable(True)
    area.setFrameShape(QScrollArea.Shape.NoFrame)
    area.setWidget(inner)
    return area

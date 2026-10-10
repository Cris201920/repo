"""Ícones de traço único (SVG embutido) — consistentes e recoloríveis; sem arquivos externos."""
from __future__ import annotations

from PySide6.QtCore import QByteArray, Qt
from PySide6.QtGui import QIcon, QPainter, QPixmap
from PySide6.QtSvg import QSvgRenderer

_PATHS = {
    "home": '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    "chat": '<path d="M4 5h16v11H9l-5 4z"/>',
    "mic": '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    "book": '<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-3a3 3 0 0 0-3 3"/><path d="M20 4v14h-6"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "check": '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
    "folder": '<path d="M3 6h6l2 2h10v11H3z"/>',
    "plug": '<path d="M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0zM12 18v3"/>',
    "news": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    "chart": '<path d="M4 20V4M4 20h16"/><rect x="8" y="12" width="3" height="5"/><rect x="13" y="8" width="3" height="9"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    "bell": '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
}


def svg_icon(name: str, color: str = "#8aa0c2", size: int = 22) -> QIcon:
    body = _PATHS.get(name, _PATHS["home"])
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{color}" '
           f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{body}</svg>')
    renderer = QSvgRenderer(QByteArray(svg.encode()))
    pm = QPixmap(size * 2, size * 2)
    pm.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pm)
    renderer.render(painter)
    painter.end()
    return QIcon(pm)


def app_icon() -> QIcon:
    """Ícone do aplicativo: arquivo em assets/ se existir; senão desenhado em tempo de execução."""
    from pathlib import Path
    for candidate in (Path(__file__).resolve().parent.parent / "assets" / "jarmes.png",):
        if candidate.exists():
            return QIcon(str(candidate))
    pm = QPixmap(256, 256)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    from PySide6.QtGui import QColor, QPen
    p.setBrush(QColor("#060b16"))
    p.setPen(Qt.PenStyle.NoPen)
    p.drawEllipse(8, 8, 240, 240)
    p.setPen(QPen(QColor("#22d3ee"), 12))
    p.setBrush(Qt.BrushStyle.NoBrush)
    p.drawEllipse(30, 30, 196, 196)
    p.end()
    return QIcon(pm)

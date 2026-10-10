"""Tema escuro 'central de comando': azul-marinho, ciano e branco."""
from __future__ import annotations

BG = "#060b16"
PANEL = "#0b1628"
PANEL_ALT = "#0f1f38"
BORDER = "#1b3253"
CYAN = "#22d3ee"
BLUE = "#3b82f6"
TEXT = "#e6f1ff"
MUTED = "#8aa0c2"
OK = "#34d399"
WARN = "#fbbf24"
DANGER = "#f43f5e"

STATUS_COLORS = {
    "conectado": OK, "configurado": OK, "manual": CYAN, "desconectado": WARN, "parcial": WARN,
    "nao_configurado": MUTED, "indisponivel": DANGER, "offline": DANGER,
}

QSS = f"""
* {{ font-family: "Segoe UI", "Inter", "Noto Sans", "DejaVu Sans", sans-serif; font-size: 10.5pt; color: {TEXT}; }}
QMainWindow, QDialog, QWidget#root {{ background: {BG}; }}
QWidget {{ background: transparent; }}
QToolTip {{ background: {PANEL_ALT}; color: {TEXT}; border: 1px solid {CYAN}; padding: 4px; }}

QFrame#card, QFrame#sidebar, QFrame#header {{ background: {PANEL}; border: 1px solid {BORDER}; border-radius: 12px; }}
QFrame#sidebar {{ border-radius: 0; border-top: none; border-bottom: none; border-left: none; }}
QFrame#header {{ border-radius: 0; border-top: none; border-left: none; border-right: none; }}
QFrame#card[accent="true"] {{ border: 1px solid {CYAN}; }}
QLabel#h1 {{ font-size: 20pt; font-weight: 600; color: {TEXT}; }}
QLabel#h2 {{ font-size: 13pt; font-weight: 600; color: {CYAN}; }}
QLabel#h3 {{ font-size: 11pt; font-weight: 600; }}
QLabel#muted, QLabel[muted="true"] {{ color: {MUTED}; }}
QLabel#big {{ font-size: 26pt; font-weight: 700; color: {CYAN}; }}
QLabel#banner {{ background: {PANEL_ALT}; border: 1px solid {WARN}; border-radius: 8px; padding: 8px; }}
QLabel#micbanner {{ background: {DANGER}; color: white; font-weight: 700; border-radius: 8px; padding: 4px 12px; }}

QPushButton {{ background: {PANEL_ALT}; border: 1px solid {BORDER}; border-radius: 8px; padding: 7px 14px; }}
QPushButton:hover {{ border-color: {CYAN}; }}
QPushButton:pressed {{ background: {BORDER}; }}
QPushButton:disabled {{ color: {MUTED}; border-color: {PANEL_ALT}; }}
QPushButton#primary {{ background: {BLUE}; border-color: {BLUE}; color: white; font-weight: 600; }}
QPushButton#primary:hover {{ background: #2563eb; border-color: {CYAN}; }}
QPushButton#danger {{ border-color: {DANGER}; color: {DANGER}; }}
QPushButton#nav {{ text-align: left; border: none; border-radius: 8px; padding: 9px 12px; background: transparent; color: {MUTED}; }}
QPushButton#nav:hover {{ background: {PANEL_ALT}; color: {TEXT}; }}
QPushButton#nav:checked {{ background: {PANEL_ALT}; color: {CYAN}; border-left: 3px solid {CYAN}; }}

QLineEdit, QTextEdit, QPlainTextEdit, QComboBox, QSpinBox, QDoubleSpinBox, QDateTimeEdit, QDateEdit, QTimeEdit, QTextBrowser {{
    background: {PANEL_ALT}; border: 1px solid {BORDER}; border-radius: 8px; padding: 6px; selection-background-color: {BLUE};
}}
QLineEdit:focus, QTextEdit:focus, QComboBox:focus, QSpinBox:focus, QDateTimeEdit:focus {{ border-color: {CYAN}; }}
QComboBox QAbstractItemView {{ background: {PANEL_ALT}; border: 1px solid {CYAN}; selection-background-color: {BLUE}; }}
QComboBox {{ min-width: 9em; }}
QRadioButton {{ spacing: 8px; }}
QRadioButton::indicator {{ width: 16px; height: 16px; border: 1px solid {BORDER}; border-radius: 9px; background: {PANEL_ALT}; }}
QRadioButton::indicator:checked {{ background: {CYAN}; border-color: {CYAN}; }}
QCheckBox {{ spacing: 8px; }}
QCheckBox::indicator {{ width: 18px; height: 18px; border: 1px solid {BORDER}; border-radius: 5px; background: {PANEL_ALT}; }}
QCheckBox::indicator:checked {{ background: {CYAN}; border-color: {CYAN}; }}

QTableWidget, QListWidget, QTreeWidget {{ background: {PANEL}; border: 1px solid {BORDER}; border-radius: 10px; gridline-color: {BORDER}; alternate-background-color: {PANEL_ALT}; }}
QListWidget::item {{ padding: 6px; border-radius: 6px; }}
QListWidget::item:selected, QTableWidget::item:selected, QTreeWidget::item:selected {{ background: {BLUE}; color: white; }}
QHeaderView::section {{ background: {PANEL_ALT}; color: {MUTED}; border: none; padding: 6px; }}
QTabWidget::pane {{ border: 1px solid {BORDER}; border-radius: 10px; top: -1px; }}
QTabBar::tab {{ background: transparent; color: {MUTED}; padding: 8px 16px; border-bottom: 2px solid transparent; }}
QTabBar::tab:selected {{ color: {CYAN}; border-bottom: 2px solid {CYAN}; }}
QScrollBar:vertical {{ background: transparent; width: 10px; }}
QScrollBar::handle:vertical {{ background: {BORDER}; border-radius: 5px; min-height: 30px; }}
QScrollBar:horizontal {{ background: transparent; height: 10px; }}
QScrollBar::handle:horizontal {{ background: {BORDER}; border-radius: 5px; }}
QScrollBar::add-line, QScrollBar::sub-line {{ width: 0; height: 0; }}
QProgressBar {{ background: {PANEL_ALT}; border: 1px solid {BORDER}; border-radius: 6px; text-align: center; height: 14px; }}
QProgressBar::chunk {{ background: {CYAN}; border-radius: 5px; }}
QSlider::groove:horizontal {{ background: {BORDER}; height: 6px; border-radius: 3px; }}
QSlider::handle:horizontal {{ background: {CYAN}; width: 16px; margin: -5px 0; border-radius: 8px; }}
QCalendarWidget QWidget {{ background: {PANEL}; }}
QCalendarWidget QAbstractItemView {{ selection-background-color: {BLUE}; color: {TEXT}; }}
QCalendarWidget QToolButton {{ color: {TEXT}; background: transparent; }}
QMessageBox {{ background: {PANEL}; }}
"""

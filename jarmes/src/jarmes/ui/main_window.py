"""Janela principal: navegação, cabeçalho de estado, bandeja do sistema e entrega de notificações."""
from __future__ import annotations

import logging
from datetime import timedelta

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, QTimer, Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import (QApplication, QFrame, QHBoxLayout, QLabel, QMainWindow, QMenu, QPushButton, QStackedWidget,
                               QSystemTrayIcon, QTableWidget, QVBoxLayout, QWidget)

from .. import APP_NAME, __version__, clock
from ..app_context import AppContext
from ..voice.controller import VoiceController
from . import theme
from .icons import app_icon, svg_icon
from .pages.calendar import CalendarPage
from .pages.chat import ChatPage
from .pages.dashboard import DashboardPage
from .pages.documents import DocumentsPage
from .pages.integrations import IntegrationsPage
from .pages.news import NewsPage
from .pages.notifications import NotificationsPage
from .pages.reports import ReportsPage
from .pages.settings import SettingsPage
from .pages.study import StudyPage
from .pages.tasks import TasksPage
from .pages.voice import VoicePage
from .widgets import PulseDot, StatusChip, button, label

log = logging.getLogger("jarmes.ui")
PAGE_ORDER = [DashboardPage, ChatPage, VoicePage, StudyPage, CalendarPage, TasksPage, DocumentsPage, IntegrationsPage,
              NewsPage, ReportsPage, SettingsPage, NotificationsPage]


class Toast(QLabel):
    """Aviso discreto dentro do app (usado quando a bandeja não está disponível ou para eventos internos)."""

    def __init__(self, parent):
        super().__init__(parent)
        self.setWordWrap(True)
        self.setStyleSheet(f"background:{theme.PANEL_ALT}; border:1px solid {theme.CYAN}; border-radius:10px; padding:10px 14px; color:{theme.TEXT};")
        self.setFixedWidth(340)
        self.hide()
        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.timeout.connect(self.hide)

    def show_message(self, title: str, body: str):
        self.setText(f"<b style='color:{theme.CYAN}'>{title}</b><br/>{body[:260]}")
        self.adjustSize()
        p = self.parentWidget()
        self.move(p.width() - self.width() - 24, p.height() - self.height() - 24)
        self.raise_()
        self.show()
        self._timer.start(6500)


class MainWindow(QMainWindow):
    def __init__(self, ctx: AppContext, start_minimized: bool = False):
        super().__init__()
        self.ctx = ctx
        self._quitting = False
        self.setWindowTitle(f"{APP_NAME} — assistente pessoal")
        self.setWindowIcon(app_icon())
        self.resize(1320, 840)
        self.setMinimumSize(760, 560)
        self.voice = VoiceController(ctx, self)
        self.tray_available = QSystemTrayIcon.isSystemTrayAvailable()

        root = QWidget()
        root.setObjectName("root")
        self.setCentralWidget(root)
        outer = QHBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        # barra lateral
        self.sidebar = QFrame()
        self.sidebar.setObjectName("sidebar")
        self.sidebar.setFixedWidth(232)
        sl = QVBoxLayout(self.sidebar)
        sl.setContentsMargins(10, 14, 10, 10)
        sl.setSpacing(2)
        self.logo = QLabel("◈ JARMES")
        self.logo.setStyleSheet(f"font-size: 17pt; font-weight: 700; color: {theme.CYAN}; padding: 6px 8px;")
        sl.addWidget(self.logo)
        self.nav_buttons: dict[str, QPushButton] = {}
        self.stack = QStackedWidget()
        self.pages: dict = {}
        for cls in PAGE_ORDER:
            page = cls(self)
            self.pages[page.key] = page
            self.stack.addWidget(page)
            b = QPushButton(f"  {page.title}")
            b.setObjectName("nav")
            b.setCheckable(True)
            b.setIcon(svg_icon(page.icon, theme.MUTED))
            b.setToolTip(page.title)
            b.setCursor(Qt.CursorShape.PointingHandCursor)
            b.clicked.connect(lambda _=False, k=page.key: self.navigate(k))
            sl.addWidget(b)
            self.nav_buttons[page.key] = b
        sl.addStretch(1)
        self.version_lb = QLabel(f"v{__version__}")
        self.version_lb.setStyleSheet(f"color:{theme.MUTED}; font-size: 8pt; padding: 4px 8px;")
        sl.addWidget(self.version_lb)
        outer.addWidget(self.sidebar)

        # lado direito
        right = QVBoxLayout()
        right.setSpacing(0)
        self.header = QFrame()
        self.header.setObjectName("header")
        hl = QHBoxLayout(self.header)
        hl.setContentsMargins(18, 8, 18, 8)
        self.page_title = QLabel("")
        self.page_title.setObjectName("h3")
        hl.addWidget(self.page_title)
        hl.addStretch(1)
        self.mic_banner = QLabel("● MICROFONE ATIVO")
        self.mic_banner.setObjectName("micbanner")
        self.mic_banner.hide()
        hl.addWidget(self.mic_banner)
        self.chips_box = QHBoxLayout()
        self.chips_box.setSpacing(6)
        hl.addLayout(self.chips_box)
        self.bell = button("🔔", slot=lambda: self.navigate("notifications"), tooltip="Central de notificações")
        hl.addWidget(self.bell)
        right.addWidget(self.header)
        right.addWidget(self.stack, 1)
        outer.addLayout(right, 1)

        for t in self.findChildren(QTableWidget):
            t.verticalHeader().setVisible(False)
        self.chat_page: ChatPage = self.pages["chat"]
        self.toast_widget = Toast(root)
        self._setup_tray()
        self.current = "dashboard"
        self.navigate("dashboard")

        self.sched_timer = QTimer(self)
        self.sched_timer.timeout.connect(self.tick)
        self.sched_timer.start(30_000)
        self._last_news = clock.now()
        QTimer.singleShot(1500, self.tick)

    # ------------------------------------------------------------------ navegação
    def navigate(self, key: str, arg=None) -> None:
        if key not in self.pages:
            return
        self.current = key
        page = self.pages[key]
        self.stack.setCurrentWidget(page)
        for k, b in self.nav_buttons.items():
            b.setChecked(k == key)
            b.setIcon(svg_icon(self.pages[k].icon, theme.CYAN if k == key else theme.MUTED))
        self.page_title.setText(page.title)
        page.on_arg(arg)
        page.refresh()
        self.update_status_bar()
        QTimer.singleShot(0, lambda: self._relayout(page))

    @staticmethod
    def _relayout(page) -> None:
        """Textos com quebra de linha precisam recalcular a altura depois que a página ganha largura real."""
        for lb in page.findChildren(QLabel):
            if lb.wordWrap():
                lb.updateGeometry()
        if page.layout():
            page.layout().invalidate()
            page.layout().activate()
    def data_changed(self) -> None:
        """Recarrega a página atual e os indicadores após qualquer alteração de dados."""
        try:
            self.pages[self.current].refresh()
            QTimer.singleShot(0, lambda: self._relayout(self.pages[self.current]))
        except Exception:  # noqa: BLE001
            log.exception("Falha ao atualizar página %s", self.current)
        self.update_status_bar()

    def update_status_bar(self) -> None:
        while self.chips_box.count():
            w = self.chips_box.takeAt(0).widget()
            if w:
                w.setParent(None)
                w.deleteLater()
        wanted = ("ia", "stt", "gdrive", "noticias")
        short = {"ia": "IA", "stt": "Voz", "gdrive": "Drive", "noticias": "Notícias"}
        state_word = {"conectado": "ok", "configurado": "ok", "manual": "manual", "desconectado": "desconectado", "parcial": "parcial",
                      "nao_configurado": "a configurar", "indisponivel": "indisponível", "offline": "offline"}
        for s in self.ctx.integrations.states():
            if s.key in wanted:
                self.chips_box.addWidget(StatusChip(f"{short[s.key]} · {state_word.get(s.status, s.status)}", s.status, f"{s.name}: {s.label}. {s.detail}"))
        n = self.ctx.notifier.unread_count()
        self.bell.setText(f"🔔 {n}" if n else "🔔")
        base = self.pages["notifications"].title
        self.nav_buttons["notifications"].setText(f"  {base}" + (f"  ({n})" if n else ""))

    def set_mic_active(self, active: bool) -> None:
        self.mic_banner.setVisible(active)

    # ------------------------------------------------------------------ avisos
    def toast(self, title: str, body: str) -> None:
        self.toast_widget.show_message(title, body)

    def _setup_tray(self) -> None:
        self.tray = None
        if not self.tray_available:
            return
        self.tray = QSystemTrayIcon(app_icon(), self)
        self.tray.setToolTip("JARMES — em execução")
        menu = QMenu()
        for text, fn in (("Abrir JARMES", self.show_window), ("Iniciar sessão de estudos", self._tray_study),
                         ("Pausar avisos por 1 h", self._tray_pause), ("Sair do JARMES", self.quit_app)):
            act = QAction(text, menu)
            act.triggered.connect(fn)
            menu.addAction(act)
        self.tray.setContextMenu(menu)
        self.tray.activated.connect(lambda reason: self.show_window() if reason == QSystemTrayIcon.ActivationReason.Trigger else None)
        self.tray.messageClicked.connect(self.show_window)
        self.tray.show()
        self._tray_menu = menu

    def _tray_study(self):
        self.show_window()
        self.ctx.commands.handle("iniciar sessão de estudos")
        self.navigate("study")

    def _tray_pause(self):
        self.ctx.settings.set("notifications_paused_until", clock.iso(clock.now() + timedelta(hours=1)))

    def show_window(self) -> None:
        self.showNormal()
        self.raise_()
        self.activateWindow()

    def notify_test(self) -> None:
        nid = self.ctx.notifier.push("estudo", "Notificação de teste", "Se você está vendo isto, as notificações do JARMES funcionam neste computador.",
                                     dedupe_key=f"teste:{clock.now().timestamp()}")
        self._deliver()
        if not self.tray_available:
            self.toast("Notificação de teste", "Este sistema não tem bandeja/notificações nativas; o aviso aparece só dentro do app.")
        self.data_changed()

    def _deliver(self) -> None:
        n = self.ctx.notifier
        now = clock.now()
        for row in n.undelivered():
            mode = n.delivery_mode(now)
            if mode == "toast":
                if self.tray is not None:
                    self.tray.showMessage(row["title"], row["body"][:200], QSystemTrayIcon.MessageIcon.Information, 10_000)
                    n.mark_shown(row["id"], "toast")
                else:
                    self.toast(row["title"], row["body"])
                    n.mark_shown(row["id"], "app")
            else:
                n.mark_shown(row["id"], mode)

    def tick(self) -> None:
        """Roda a cada 30 s enquanto o processo estiver ativo (janela aberta ou bandeja)."""
        try:
            if self.ctx.settings.get("plan_start_date"):
                self.ctx.study.sync_days(clock.today())      # materializa dias e marca os não realizados
            created = self.ctx.scheduler.tick()
            self._deliver()
            self._maybe_refresh_news()
            if created:
                self.data_changed()
            else:
                self.update_status_bar()
        except Exception:  # noqa: BLE001
            log.exception("Falha no ciclo de agendamento")

    def _maybe_refresh_news(self) -> None:
        minutes = int(self.ctx.settings.get("news_refresh_minutes"))
        if minutes <= 0 or clock.now() - self._last_news < timedelta(minutes=minutes):
            return
        self._last_news = clock.now()
        from .async_util import run_async
        run_async(self.ctx.integrations.news.refresh_all, lambda _r: self.update_status_bar())

    # ------------------------------------------------------------------ janela
    def resizeEvent(self, e):
        super().resizeEvent(e)
        narrow = self.width() < 1040
        for i in range(self.chips_box.count()):
            w = self.chips_box.itemAt(i).widget()
            if w:
                w.setVisible(self.width() >= 1180)
        self.sidebar.setFixedWidth(64 if narrow else 232)
        self.logo.setText("◈" if narrow else "◈ JARMES")
        self.version_lb.setVisible(not narrow)
        for k, b in self.nav_buttons.items():
            title = self.pages[k].title
            if narrow:
                b.setText("")
            else:
                n = self.ctx.notifier.unread_count() if k == "notifications" else 0
                b.setText(f"  {title}" + (f"  ({n})" if n else ""))

    def closeEvent(self, e):
        if self._quitting or not (self.ctx.settings.get("close_to_tray") and self.tray is not None):
            self._finish()
            e.accept()
            return
        e.ignore()
        self.hide()
        if not getattr(self, "_told_tray", False):
            self._told_tray = True
            self.tray.showMessage("JARMES continua em execução", "Fico na bandeja para os lembretes. Para encerrar, use Sair no menu da bandeja.",
                                  QSystemTrayIcon.MessageIcon.Information, 6000)

    def quit_app(self) -> None:
        self._quitting = True
        self.close()
        QApplication.quit()

    def _finish(self) -> None:
        try:
            self.voice.speaker.stop()
            if self.voice.recorder.active:
                self.voice.recorder.stop()
        finally:
            self.sched_timer.stop()
            if self.tray is not None:
                self.tray.hide()

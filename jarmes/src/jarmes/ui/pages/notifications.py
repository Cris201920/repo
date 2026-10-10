from __future__ import annotations

import json

from PySide6.QtGui import QColor
from PySide6.QtWidgets import QHBoxLayout, QListWidget, QListWidgetItem, QVBoxLayout

from .. import theme
from ..dialogs import ask
from ..widgets import button, label, page_header
from .base import Page

ICON = {"estudo": "📚", "compromisso": "📅", "tarefa": "✅", "pendencia": "⏳", "checkin": "🌙", "atrasadas": "⚠", "revisao": "🔁",
        "sequencia": "🔥", "relatorio": "📊", "noticia": "📰", "proposta": "💡"}


class NotificationsPage(Page):
    key, title, icon = "notifications", "Central de notificações", "bell"

    def __init__(self, win):
        super().__init__(win)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.addWidget(page_header("Central de notificações", "Histórico do que o JARMES avisou. Os avisos do sistema só aparecem com o JARMES em execução "
                                  "(janela aberta ou na bandeja)."))
        self.perm = label("", "banner")
        lay.addWidget(self.perm)
        self.list = QListWidget()
        self.list.itemDoubleClicked.connect(self.open_action)
        lay.addWidget(self.list, 1)
        row = QHBoxLayout()
        row.addWidget(button("Marcar todas como lidas", slot=self.mark_all))
        row.addWidget(button("Abrir ação", primary=True, slot=lambda: self.open_action(None)))
        row.addWidget(button("Enviar notificação de teste", slot=self.test))
        row.addWidget(button("Limpar histórico", danger=True, slot=self.clear))
        row.addStretch(1)
        lay.addLayout(row)
        self.rows: list = []

    def refresh(self):
        n = self.ctx.notifier
        s = self.ctx.settings
        msgs = []
        if not s.get("notifications_enabled"):
            msgs.append("As notificações do sistema estão desativadas nas configurações do JARMES (os avisos ficam só aqui).")
        if not self.win.tray_available:
            msgs.append("Este sistema não oferece bandeja/notificações nativas; os avisos aparecem apenas dentro do JARMES.")
        else:
            msgs.append("Se as notificações do Windows não aparecerem, ative em Configurações do Windows → Sistema → Notificações → JARMES "
                        "e desligue o modo “Não incomodar”/Assistente de foco.")
        self.perm.setText("\n".join(msgs))
        self.rows = [dict(r) for r in n.list()]
        self.list.clear()
        for r in self.rows:
            via = {"toast": "notificação do sistema", "silencioso": "silenciosa (horário de descanso)", "app": "somente no app"}.get(r["delivered_via"], "pendente de entrega")
            it = QListWidgetItem(f"{'● ' if not r['read_at'] else '   '}{ICON.get(r['kind'], '•')} {r['created_at'][5:16].replace('-', '/')}  {r['title']}\n      {r['body'][:140]}  [{via}]")
            if r["read_at"]:
                it.setForeground(QColor(theme.MUTED))
            self.list.addItem(it)
        if not self.rows:
            self.list.addItem("Nenhuma notificação ainda.")

    def _cur(self):
        r = self.list.currentRow()
        return self.rows[r] if 0 <= r < len(self.rows) else None

    def open_action(self, _):
        n = self._cur()
        if not n:
            return
        self.ctx.notifier.mark_read(n["id"])
        act = json.loads(n["action_json"] or "{}")
        if act.get("page"):
            self.win.navigate(act["page"])
        else:
            self.win.data_changed()

    def mark_all(self):
        self.ctx.notifier.mark_all_read()
        self.win.data_changed()

    def test(self):
        self.win.notify_test()

    def clear(self):
        if ask(self, "Limpar histórico", "Apagar todo o histórico de notificações?", "Apagar"):
            self.ctx.notifier.clear()
            self.win.data_changed()

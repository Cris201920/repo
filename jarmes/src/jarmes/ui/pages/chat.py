from __future__ import annotations

import html

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QCheckBox, QHBoxLayout, QLineEdit, QTextBrowser, QVBoxLayout

from ... import clock
from .. import theme
from ..async_util import run_async
from ..widgets import PulseDot, button, label, page_header
from .base import Page

QUICK = ["Bom dia", "Iniciar sessão de estudos", "Quais matérias estão atrasadas?", "Organize meu dia",
         "Desempenho da semana", "Ajuda"]


class ChatPage(Page):
    key, title, icon = "chat", "Chat com o JARMES", "chat"

    def __init__(self, win):
        super().__init__(win)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 20, 24, 20)
        head = QHBoxLayout()
        head.addWidget(page_header("Chat com o JARMES", "Comandos reais e perguntas livres (a IA só responde texto; ações pedem sua confirmação)."), 1)
        self.dot = PulseDot()
        head.addWidget(self.dot)
        self.state_lb = label("pronto", muted=True, wrap=False)
        head.addWidget(self.state_lb)
        lay.addLayout(head)
        self.view = QTextBrowser()
        self.view.setOpenExternalLinks(True)
        lay.addWidget(self.view, 1)
        quick = QHBoxLayout()
        for q in QUICK:
            text = "Mostre meu desempenho da semana" if q == "Desempenho da semana" else q
            quick.addWidget(button(q, slot=lambda _=False, t=text: self.send(t)))
        quick.addStretch(1)
        lay.addLayout(quick)
        self.confirm_row = QHBoxLayout()
        self.btn_yes = button("✔ Confirmar ação", primary=True, slot=lambda: self.send("sim"))
        self.btn_no = button("✖ Cancelar", slot=lambda: self.send("não"))
        self.confirm_row.addWidget(label("Aguardando sua confirmação:", "h3", wrap=False))
        self.confirm_row.addWidget(self.btn_yes)
        self.confirm_row.addWidget(self.btn_no)
        self.confirm_row.addStretch(1)
        self.confirm_widgets = [self.confirm_row.itemAt(i).widget() for i in range(3)]
        lay.addLayout(self.confirm_row)
        self._show_confirm(False)
        row = QHBoxLayout()
        self.input = QLineEdit()
        self.input.setPlaceholderText("Digite um comando ou pergunta… (ex.: organize meus estudos de amanhã)")
        self.input.returnPressed.connect(lambda: self.send(self.input.text()))
        row.addWidget(self.input, 1)
        row.addWidget(button("Enviar", primary=True, slot=lambda: self.send(self.input.text())))
        row.addWidget(button("🎙", slot=lambda: win.navigate("voice"), tooltip="Conversar por voz"))
        lay.addLayout(row)
        self.busy = False
        self._loaded = False

    def _show_confirm(self, show: bool):
        for w in self.confirm_widgets:
            w.setVisible(show)

    def _bubble(self, role: str, text: str, when: str = "") -> str:
        who = "Você" if role == "user" else "JARMES"
        color = theme.BLUE if role == "user" else theme.CYAN
        body = html.escape(text).replace("\n", "<br/>")
        align = "right" if role == "user" else "left"
        return (f"<div style='margin:8px 0; text-align:{align}'><span style='color:{color}; font-weight:600'>{who}</span> "
                f"<span style='color:{theme.MUTED}; font-size:8pt'>{when}</span><br/>"
                f"<span style='color:{theme.TEXT}'>{body}</span></div>")

    def refresh(self):
        if self._loaded:
            return
        self._loaded = True
        rows = self.ctx.conversations.recent(40)
        html_parts = [self._bubble(r["role"], r["content"], r["created_at"][11:16]) for r in rows]
        if not rows:
            greeting = self.ctx.commands.handle("bom dia").text
            self.ctx.conversations.add("assistant", greeting)
            html_parts.append(self._bubble("assistant", greeting, f"{clock.now():%H:%M}"))
        self.view.setHtml("".join(html_parts))
        self.view.verticalScrollBar().setValue(self.view.verticalScrollBar().maximum())

    def append(self, role: str, text: str):
        self.view.append(self._bubble(role, text, f"{clock.now():%H:%M}"))
        self.view.verticalScrollBar().setValue(self.view.verticalScrollBar().maximum())

    def send(self, text: str):
        text = (text or "").strip()
        if not text or self.busy:
            return
        self.input.clear()
        self.append("user", text)
        self.ctx.conversations.add("user", text)
        self.busy = True
        self.dot.set_active(True)
        self.state_lb.setText("processando…")

        def done(reply):
            self.busy = False
            self.dot.set_active(False)
            self.state_lb.setText("pronto")
            self.ctx.conversations.add("assistant", reply.text)
            self.append("assistant", reply.text)
            self._show_confirm(reply.pending is not None or self.ctx.commands.pending is not None)
            self.win.data_changed()
            if reply.navigate and reply.navigate != "chat":
                self.win.navigate(reply.navigate, reply.nav_arg)

        def failed(exc):
            self.busy = False
            self.dot.set_active(False)
            self.state_lb.setText("erro")
            self.append("assistant", "Tive um problema ao processar isso; o erro foi registrado no log. Nenhum dado foi alterado.")

        run_async(lambda: self.ctx.commands.handle(text), done, failed)

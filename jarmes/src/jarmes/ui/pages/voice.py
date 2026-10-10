from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QCheckBox, QComboBox, QGridLayout, QHBoxLayout, QProgressBar, QSlider, QTextEdit, QVBoxLayout, QWidget)

from ... import voice
from ...voice.controller import IDLE, LISTENING, PROCESSING, SPEAKING, VoiceController
from ...voice.recorder import input_devices
from .. import theme
from ..dialogs import ask, info
from ..widgets import Card, PulseDot, button, label, page_header
from .base import Page, scrollable

STATE_TEXT = {IDLE: "Pronto — clique no microfone para falar", LISTENING: "Ouvindo… (clique novamente para parar)",
              PROCESSING: "Processando…", SPEAKING: "Falando…"}
STATE_COLOR = {IDLE: theme.MUTED, LISTENING: theme.DANGER, PROCESSING: theme.WARN, SPEAKING: theme.CYAN}


class VoicePage(Page):
    key, title, icon = "voice", "Assistente de voz", "mic"

    def __init__(self, win):
        super().__init__(win)
        self.controller: VoiceController = win.voice
        inner = QWidget()
        lay = QVBoxLayout(inner)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.setSpacing(14)
        lay.addWidget(page_header("Assistente de voz", "Acionamento por botão. O microfone só é aberto enquanto você ouve o indicador vermelho; "
                                  "nenhuma gravação é guardada."))
        card = Card("Conversa por voz", accent=True)
        row = QHBoxLayout()
        self.dot = PulseDot(size=18)
        row.addWidget(self.dot)
        self.state_lb = label(STATE_TEXT[IDLE], "h3", wrap=False)
        row.addWidget(self.state_lb, 1)
        self.mic_btn = button("🎙  Falar / Parar", primary=True, slot=self.controller.toggle)
        self.mic_btn.setMinimumHeight(46)
        row.addWidget(self.mic_btn)
        card.lay.addLayout(row)
        self.level = QProgressBar()
        self.level.setRange(0, 100)
        self.level.setTextVisible(False)
        card.add(self.level)
        card.add(label("Você disse:", muted=True))
        self.transcript = QTextEdit()
        self.transcript.setReadOnly(True)
        self.transcript.setFixedHeight(70)
        card.add(self.transcript)
        card.add(label("JARMES respondeu:", muted=True))
        self.reply = QTextEdit()
        self.reply.setReadOnly(True)
        self.reply.setMinimumHeight(130)
        card.add(self.reply)
        self.msg = label("", muted=True)
        card.add(self.msg)
        lay.addWidget(card)

        cfg = Card("Controles")
        grid = QGridLayout()
        self.mic_enabled = QCheckBox("Microfone habilitado (desmarque para desativar completamente)")
        self.mic_enabled.toggled.connect(lambda v: self._set("mic_enabled", v))
        grid.addWidget(self.mic_enabled, 0, 0, 1, 2)
        self.tts_enabled = QCheckBox("Resposta falada")
        self.tts_enabled.toggled.connect(lambda v: self._set("tts_enabled", v))
        grid.addWidget(self.tts_enabled, 1, 0, 1, 2)
        grid.addWidget(label("Volume"), 2, 0)
        self.volume = QSlider(Qt.Orientation.Horizontal)
        self.volume.setRange(0, 100)
        self.volume.valueChanged.connect(lambda v: self._set("volume", int(v)))
        grid.addWidget(self.volume, 2, 1)
        grid.addWidget(label("Voz"), 3, 0)
        self.voice_box = QComboBox()
        self.voice_box.currentIndexChanged.connect(self._voice_changed)
        grid.addWidget(self.voice_box, 3, 1)
        grid.addWidget(label("Microfone detectado"), 4, 0)
        self.device_lb = label("", muted=True)
        grid.addWidget(self.device_lb, 4, 1)
        grid.addWidget(label("Reconhecimento"), 5, 0)
        self.stt_lb = label("", muted=True)
        grid.addWidget(self.stt_lb, 5, 1)
        cfg.lay.addLayout(grid)
        test = QHBoxLayout()
        test.addWidget(button("Testar voz do JARMES", slot=self.test_voice))
        test.addWidget(button("Configurar reconhecimento…", slot=lambda: win.navigate("settings", "voz")))
        test.addStretch(1)
        cfg.lay.addLayout(test)
        lay.addWidget(cfg)
        lay.addStretch(1)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scrollable(inner))
        c = self.controller
        c.state_changed.connect(self._on_state)
        c.transcript.connect(lambda t: self.transcript.setPlainText(t))
        c.reply.connect(self._on_reply)
        c.error.connect(self._on_error)
        c.level.connect(lambda v: self.level.setValue(int(v * 100)))
        c.consent_needed.connect(self._consent)
        self._loading = False

    def _set(self, key, value):
        if self._loading:
            return
        self.ctx.settings.set(key, value)
        if key in ("volume", "tts_enabled"):
            self.controller.speaker.apply_settings()
        self.win.update_status_bar()

    def _voice_changed(self):
        if self._loading or self.voice_box.currentData() is None:
            return
        self.ctx.settings.set("tts_voice", self.voice_box.currentData())
        self.controller.speaker.apply_settings()

    def refresh(self):
        s = self.ctx.settings
        self._loading = True
        self.mic_enabled.setChecked(bool(s.get("mic_enabled")))
        self.tts_enabled.setChecked(bool(s.get("tts_enabled")))
        self.volume.setValue(int(s.get("volume")))
        self.voice_box.clear()
        voices = self.controller.speaker.voices()
        if voices:
            for name, desc in voices:
                self.voice_box.addItem(desc, name)
            idx = self.voice_box.findData(s.get("tts_voice"))
            self.voice_box.setCurrentIndex(max(0, idx))
        else:
            self.voice_box.addItem(self.controller.speaker.error or "Nenhuma voz disponível neste sistema", None)
        self.voice_box.setEnabled(bool(voices))
        devices = input_devices()
        self.device_lb.setText(", ".join(d for _, d in devices[:3]) if devices else "Nenhum microfone encontrado")
        from ...voice.stt import stt_status
        st, detail = stt_status(self.ctx)
        self.stt_lb.setText(detail)
        self._loading = False
        self.mic_btn.setEnabled(bool(s.get("mic_enabled")))
        self._on_state(self.controller.state)

    def _on_state(self, state: str):
        self.state_lb.setText(STATE_TEXT.get(state, state))
        self.dot.set_active(state != IDLE, STATE_COLOR.get(state))
        if state != LISTENING:
            self.level.setValue(0)
        self.win.set_mic_active(state == LISTENING)

    def _on_reply(self, text: str):
        self.reply.setPlainText(text)
        self.msg.setText("")
        self.win.data_changed()

    def _on_error(self, message: str):
        self.msg.setText("⚠ " + message)

    def _consent(self, what: str):
        if what == "remote_stt" and ask(self, "Enviar áudio para um serviço remoto?",
                                        "O reconhecimento remoto envia o ÁUDIO que você gravar ao provedor configurado (ex.: API compatível com OpenAI) "
                                        "para ser transcrito. Nada é gravado continuamente: só o que você captura ao clicar no microfone.\n\nAutorizar?",
                                        "Autorizar", "Não autorizar"):
            self.ctx.settings.set("stt_remote_consent", True)
            self.msg.setText("Autorização registrada. Clique no microfone para tentar de novo.")
            self.refresh()

    def test_voice(self):
        sp = self.controller.speaker
        if not sp.available:
            info(self, "Voz indisponível", sp.error or "Nenhum mecanismo de síntese de voz encontrado.")
            return
        sp.speak(f"Olá, {self.ctx.settings.get('user_name')}. Teste de voz do JARMES concluído.")

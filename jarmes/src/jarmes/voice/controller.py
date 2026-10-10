"""Orquestra: ouvir → transcrever → processar comando/IA → falar. Estados sempre visíveis."""
from __future__ import annotations

import logging
from pathlib import Path

from PySide6.QtCore import QObject, QRunnable, QThreadPool, Signal

from .recorder import Recorder
from .stt import STTUnavailable, build_transcriber
from .tts import Speaker

log = logging.getLogger("jarmes.voice")

IDLE, LISTENING, PROCESSING, SPEAKING = "idle", "listening", "processing", "speaking"


class _Job(QRunnable):
    def __init__(self, fn, on_done, on_error):
        super().__init__()
        self.fn, self.on_done, self.on_error = fn, on_done, on_error

    def run(self):
        try:
            self.on_done(self.fn())
        except Exception as exc:  # noqa: BLE001
            self.on_error(exc)


class VoiceController(QObject):
    state_changed = Signal(str)
    transcript = Signal(str)
    reply = Signal(str)
    error = Signal(str)
    level = Signal(float)
    consent_needed = Signal(str)       # 'remote_stt'
    _transcribed = Signal(str)
    _failed = Signal(str)
    _replied = Signal(object)

    def __init__(self, ctx, parent=None):
        super().__init__(parent)
        self.ctx = ctx
        self.state = IDLE
        self.recorder = Recorder(parent=self)
        self.recorder.finished.connect(self._on_audio)
        self.recorder.failed.connect(self._fail)
        self.recorder.level.connect(self.level)
        self.speaker = Speaker(ctx.settings)
        self._transcribed.connect(self._on_text)
        self._failed.connect(self._fail)
        self._replied.connect(self._on_reply_ready)
        if self.speaker.engine is not None:
            self.speaker.engine.stateChanged.connect(self._tts_state)

    def _set(self, state: str) -> None:
        self.state = state
        self.state_changed.emit(state)

    @property
    def mic_active(self) -> bool:
        return self.state == LISTENING

    def toggle(self) -> None:
        if self.state == LISTENING:
            self.stop_listening()
        elif self.state == IDLE:
            self.start_listening()
        elif self.state == SPEAKING:
            self.speaker.stop()
            self._set(IDLE)

    def start_listening(self) -> None:
        s = self.ctx.settings
        if not s.get("mic_enabled"):
            self.error.emit("O microfone está desativado nas configurações. Reative em Configurações → Voz.")
            return
        # valida o mecanismo ANTES de abrir o microfone (não grava à toa)
        try:
            self._transcriber = build_transcriber(self.ctx)
        except STTUnavailable as exc:
            if s.get("stt_engine") == "remote_openai" and not s.get("stt_remote_consent"):
                self.consent_needed.emit("remote_stt")
            self.error.emit(str(exc))
            return
        self.speaker.stop()
        self.recorder.start()
        if self.recorder.active:
            self._set(LISTENING)

    def stop_listening(self) -> None:
        if self.state == LISTENING:
            self._set(PROCESSING)
            self.recorder.stop()

    def _on_audio(self, wav_path: str) -> None:
        transcriber = self._transcriber

        def work():
            try:
                return transcriber.transcribe(Path(wav_path))
            finally:
                Path(wav_path).unlink(missing_ok=True)  # não guarda gravações

        QThreadPool.globalInstance().start(_Job(work, self._transcribed.emit, lambda e: self._failed.emit(
            str(e) if isinstance(e, STTUnavailable) else f"Falha no reconhecimento de voz ({type(e).__name__}).")))

    def _on_text(self, text: str) -> None:
        text = (text or "").strip()
        if not text:
            self._fail("Não entendi o áudio. Tente falar mais perto do microfone.")
            return
        self.transcript.emit(text)
        self.handle_text(text)

    def handle_text(self, text: str) -> None:
        """Processa a solicitação (comando local ou IA) fora da thread da interface e fala a resposta."""
        self._set(PROCESSING)
        self.ctx.conversations.add("user", text, channel="voz")
        QThreadPool.globalInstance().start(_Job(
            lambda: self.ctx.commands.handle(text), self._replied.emit,
            lambda e: self._failed.emit("Não consegui processar o pedido (o erro foi registrado no log).")))

    def _on_reply_ready(self, reply) -> None:
        self.ctx.conversations.add("assistant", reply.text, channel="voz")
        self.reply.emit(reply.text)
        if self.speaker.speak(reply.spoken or reply.text):
            self._set(SPEAKING)
        else:
            self._set(IDLE)

    def _tts_state(self, state) -> None:
        if state.name == "Ready" and self.state == SPEAKING:
            self._set(IDLE)

    def _fail(self, message: str) -> None:
        self.error.emit(message)
        self._set(IDLE)

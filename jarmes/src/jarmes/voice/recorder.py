"""Captura de microfone via Qt Multimedia, somente enquanto o usuário mantém a gravação ativa."""
from __future__ import annotations

import logging
import tempfile
from pathlib import Path

from PySide6.QtCore import QBuffer, QByteArray, QIODevice, QObject, QTimer, Signal

from .wav import convert_to_16k_mono_int16, peak_level, write_wav

log = logging.getLogger("jarmes.recorder")


class MicError(RuntimeError):
    pass


def input_devices() -> list[tuple[str, str]]:
    try:
        from PySide6.QtMultimedia import QMediaDevices
        return [(d.id().data().decode(errors="ignore"), d.description()) for d in QMediaDevices.audioInputs()]
    except Exception:
        return []


class Recorder(QObject):
    level = Signal(float)           # 0..1 (para o medidor)
    finished = Signal(str)          # caminho do WAV
    failed = Signal(str)

    def __init__(self, max_seconds: int = 60, parent=None):
        super().__init__(parent)
        self.max_seconds = max_seconds
        self._source = None
        self._buffer: QBuffer | None = None
        self._data = QByteArray()
        self._fmt = None
        self._timer = QTimer(self)
        self._timer.setInterval(120)
        self._timer.timeout.connect(self._poll)
        self._limit = QTimer(self)
        self._limit.setSingleShot(True)
        self._limit.timeout.connect(self.stop)
        self.active = False

    def start(self) -> None:
        try:
            from PySide6.QtMultimedia import QAudioFormat, QAudioSource, QMediaDevices
        except Exception:
            self.failed.emit("Qt Multimedia indisponível neste sistema.")
            return
        device = QMediaDevices.defaultAudioInput()
        if device.isNull():
            self.failed.emit("Nenhum microfone encontrado. Conecte um microfone e verifique as permissões de privacidade do Windows "
                             "(Configurações → Privacidade → Microfone).")
            return
        fmt = QAudioFormat()
        fmt.setSampleRate(16000)
        fmt.setChannelCount(1)
        fmt.setSampleFormat(QAudioFormat.SampleFormat.Int16)
        if not device.isFormatSupported(fmt):
            fmt = device.preferredFormat()
        self._fmt = fmt
        self._source = QAudioSource(device, fmt, self)
        self._data = QByteArray()
        self._buffer = QBuffer(self._data, self)
        self._buffer.open(QIODevice.OpenModeFlag.WriteOnly)
        self._source.start(self._buffer)
        if self._source.error().name != "NoError":
            self.failed.emit("Não foi possível acessar o microfone (permissão negada ou dispositivo em uso).")
            self._cleanup()
            return
        self.active = True
        self._last = 0
        self._timer.start()
        self._limit.start(self.max_seconds * 1000)

    def _poll(self) -> None:
        raw = bytes(self._data)[self._last:]
        self._last = len(self._data)
        if raw and self._fmt is not None and self._fmt.sampleFormat().name == "Int16":
            self.level.emit(peak_level(raw))

    def stop(self) -> None:
        if not self.active:
            return
        self.active = False
        self._timer.stop()
        self._limit.stop()
        raw = bytes(self._data)
        err = self._source.error().name if self._source else "NoError"
        self._cleanup()
        if err not in ("NoError",):
            self.failed.emit("Falha na captura do microfone.")
            return
        if len(raw) < 3200:
            self.failed.emit("Nenhum áudio foi capturado.")
            return
        try:
            f = self._fmt
            name = f.sampleFormat().name
            fmt = {"Int16": "int16", "Float": "float32", "Int32": "int32", "UInt8": "uint8"}.get(name)
            pcm = convert_to_16k_mono_int16(raw, f.sampleRate(), f.channelCount(), fmt)
            path = Path(tempfile.mkstemp(prefix="jarmes-voz-", suffix=".wav")[1])
            write_wav(path, pcm)
        except Exception as exc:
            log.exception("Conversão de áudio falhou")
            self.failed.emit(f"Falha ao processar o áudio ({type(exc).__name__}).")
            return
        self.finished.emit(str(path))

    def _cleanup(self) -> None:
        if self._source:
            self._source.stop()
            self._source.deleteLater()
            self._source = None
        if self._buffer:
            self._buffer.close()
            self._buffer = None

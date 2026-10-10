"""Executa trabalho pesado/rede fora da thread da interface e devolve o resultado na thread principal."""
from __future__ import annotations

import logging
from typing import Callable

from PySide6.QtCore import QObject, QRunnable, QThreadPool, Signal

log = logging.getLogger("jarmes.ui")


class _Bridge(QObject):
    done = Signal(object)
    failed = Signal(object)


class _Task(QRunnable):
    def __init__(self, fn: Callable, bridge: _Bridge):
        super().__init__()
        self.fn, self.bridge = fn, bridge
        self.setAutoDelete(True)

    def run(self):
        try:
            result = self.fn()
        except Exception as exc:  # noqa: BLE001
            log.exception("Falha em tarefa assíncrona")
            self.bridge.failed.emit(exc)
        else:
            self.bridge.done.emit(result)


_alive: set = set()


def run_async(fn: Callable, on_done: Callable | None = None, on_error: Callable | None = None) -> None:
    bridge = _Bridge()
    _alive.add(bridge)

    def finish(cb):
        def inner(value):
            _alive.discard(bridge)
            if cb:
                cb(value)
            bridge.deleteLater()
        return inner

    bridge.done.connect(finish(on_done))
    bridge.failed.connect(finish(on_error or (lambda e: log.error("Erro não tratado: %s", type(e).__name__))))
    QThreadPool.globalInstance().start(_Task(fn, bridge))

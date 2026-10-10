"""Estado consolidado das integrações — exibido na interface sem maquiagem."""
from __future__ import annotations

import socket
from dataclasses import dataclass

from .. import clock
from ..ai.provider import AIClient
from .gdrive import GoogleDrive
from .news import NewsService
from .qconcursos import QConcursosModule

STATUS_LABEL = {
    "conectado": "Conectado", "configurado": "Configurado", "desconectado": "Desconectado",
    "nao_configurado": "Aguardando configuração", "manual": "Modo manual", "indisponivel": "Indisponível",
    "parcial": "Parcialmente configurado", "offline": "Sem internet",
}


@dataclass
class State:
    key: str
    name: str
    status: str
    detail: str

    @property
    def label(self) -> str:
        return STATUS_LABEL.get(self.status, self.status)

    @property
    def ok(self) -> bool:
        return self.status in ("conectado", "configurado", "manual")


def internet_available(timeout: float = 1.5) -> bool:
    for host in (("1.1.1.1", 443), ("8.8.8.8", 53)):
        try:
            with socket.create_connection(host, timeout=timeout):
                return True
        except OSError:
            continue
    return False


class IntegrationManager:
    def __init__(self, ctx):
        self.ctx = ctx
        self.qconcursos = QConcursosModule(ctx.db)
        self.news = NewsService(ctx.db, ctx.settings, ctx.notifier)
        self.news.seed_sources()
        self._gdrive: GoogleDrive | None = None

    @property
    def gdrive(self) -> GoogleDrive:
        if self._gdrive is None or self._gdrive.scope != self.ctx.settings.get("gdrive_scope"):
            self._gdrive = GoogleDrive(self.ctx.secrets, self.ctx.settings.get("gdrive_scope"))
        return self._gdrive

    def ai_client(self) -> AIClient:
        return self.ctx.assistant.client()

    def states(self) -> list[State]:
        from ..voice.stt import stt_status
        from ..voice.tts import tts_status
        from ..docs.extract import ocr_available
        out = []
        st, detail = self.ai_client().status()
        out.append(State("ia", "Inteligência artificial", st, detail))
        s, d = self.gdrive.status()
        out.append(State("gdrive", "Google Drive", s, d))
        s, d = self.qconcursos.STATUS
        out.append(State("qconcursos", "QConcursos", s, d))
        srcs = self.news.sources()
        active = [x for x in srcs if x["enabled"] and x["feed_url"]]
        ok = [x for x in active if x["last_ok"]]
        if not active:
            out.append(State("noticias", "Notícias jurídicas", "nao_configurado", "Nenhum feed ativo. Configure em Notícias → Fontes."))
        elif ok:
            out.append(State("noticias", "Notícias jurídicas", "conectado", f"{len(ok)} de {len(active)} fonte(s) já responderam com sucesso."))
        else:
            out.append(State("noticias", "Notícias jurídicas", "parcial", f"{len(active)} feed(s) cadastrado(s), ainda sem atualização bem-sucedida."))
        s, d = stt_status(self.ctx)
        out.append(State("stt", "Reconhecimento de voz", s, d))
        s, d = tts_status(self.ctx)
        out.append(State("tts", "Fala (síntese de voz)", s, d))
        out.append(State("ocr", "OCR (imagens/PDF digitalizado)", "configurado" if ocr_available() else "nao_configurado",
                         "Tesseract disponível." if ocr_available() else "Tesseract/pytesseract não encontrados (opcional)."))
        return out

    def refresh_states(self) -> None:
        for st in self.states():
            self.ctx.db.execute(
                "INSERT INTO integrations(name,status,detail,updated_at) VALUES (?,?,?,?) "
                "ON CONFLICT(name) DO UPDATE SET status=excluded.status, detail=excluded.detail, updated_at=excluded.updated_at",
                (st.key, st.status, st.detail, clock.iso(clock.now())))

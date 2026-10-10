from __future__ import annotations

from pathlib import Path

from PySide6.QtWidgets import QFileDialog, QHBoxLayout, QLineEdit, QListWidget, QVBoxLayout, QWidget

from ...ai.provider import AIUnavailable, ChatMessage
from ...integrations.http import IntegrationError
from ...integrations.manager import internet_available
from ...integrations.qconcursos import TERMS_URL
from .. import theme
from ..async_util import run_async
from ..dialogs import ask, info, warn
from ..widgets import Card, StatusChip, button, label, page_header
from .base import Page, scrollable


class IntegrationsPage(Page):
    key, title, icon = "integrations", "Integrações externas", "plug"

    def __init__(self, win):
        super().__init__(win)
        inner = QWidget()
        lay = QVBoxLayout(inner)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.setSpacing(14)
        lay.addWidget(page_header("Integrações externas", "O estado abaixo é verificado de verdade — nada aparece como “conectado” sem estar."))
        self.net_lb = label("", muted=True)
        lay.addWidget(self.net_lb)

        # IA
        self.ai_card = Card("Inteligência artificial")
        self.ai_lb = label("")
        self.ai_card.add(self.ai_lb)
        r = QHBoxLayout()
        r.addWidget(button("Testar conexão", primary=True, slot=self.test_ai))
        r.addWidget(button("Configurar…", slot=lambda: self.win.navigate("settings", "ia")))
        r.addStretch(1)
        self.ai_card.lay.addLayout(r)
        self.ai_result = label("", muted=True)
        self.ai_card.add(self.ai_result)
        lay.addWidget(self.ai_card)

        # Drive
        self.gd_card = Card("Google Drive (OAuth 2.0, somente leitura)")
        self.gd_lb = label("")
        self.gd_card.add(self.gd_lb)
        r = QHBoxLayout()
        self.gd_connect = button("Conectar conta Google", primary=True, slot=self.gd_do_connect)
        self.gd_disconnect = button("Desconectar e revogar", danger=True, slot=self.gd_do_disconnect)
        r.addWidget(self.gd_connect)
        r.addWidget(self.gd_disconnect)
        r.addWidget(button("Configurar credenciais…", slot=lambda: self.win.navigate("settings", "google")))
        r.addStretch(1)
        self.gd_card.lay.addLayout(r)
        sr = QHBoxLayout()
        self.gd_search = QLineEdit()
        self.gd_search.setPlaceholderText("Pesquisar por nome (PDF, DOCX, TXT, MD, Google Docs)…")
        self.gd_search.returnPressed.connect(self.gd_list)
        sr.addWidget(self.gd_search, 1)
        sr.addWidget(button("Listar / pesquisar", slot=self.gd_list))
        self.gd_card.lay.addLayout(sr)
        self.gd_files = QListWidget()
        self.gd_files.setMinimumHeight(120)
        self.gd_card.add(self.gd_files)
        self.gd_card.add(button("Baixar e importar selecionado", slot=self.gd_import))
        self.gd_card.add(label("O arquivo é copiado para o JARMES (o Drive não é alterado). Enviar conteúdo à IA externa exige sua autorização separada.", muted=True))
        lay.addWidget(self.gd_card)

        # QConcursos
        self.qc_card = Card("QConcursos")
        self.qc_lb = label("")
        self.qc_card.add(self.qc_lb)
        r = QHBoxLayout()
        r.addWidget(button("Abrir QConcursos no navegador", primary=True, slot=lambda: self.ctx.integrations.qconcursos.open_site()))
        r.addWidget(button("Importar CSV de resultados…", slot=self.qc_csv))
        r.addWidget(button("Registrar resultado manualmente", slot=lambda: self.win.navigate("study", "questoes")))
        r.addWidget(button("Termos de uso", slot=lambda: __import__("webbrowser").open(TERMS_URL)))
        r.addStretch(1)
        self.qc_card.lay.addLayout(r)
        self.qc_weak = label("")
        self.qc_card.add(self.qc_weak)
        lay.addWidget(self.qc_card)

        self.other = Card("Voz e OCR")
        self.other_lb = label("")
        self.other.add(self.other_lb)
        lay.addWidget(self.other)
        lay.addStretch(1)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scrollable(inner))
        self._gd_rows: list[dict] = []

    def refresh(self):
        c = self.ctx
        c.integrations.refresh_states()
        states = {s.key: s for s in c.integrations.states()}
        run_async(internet_available, lambda ok: self.net_lb.setText("Internet: " + ("disponível" if ok else "indisponível — recursos locais seguem funcionando")))
        self.ai_lb.setText(f"Estado: <b>{states['ia'].label}</b><br/>{states['ia'].detail}")
        gd = states["gdrive"]
        self.gd_lb.setText(f"Estado: <b>{gd.label}</b><br/>{gd.detail}")
        self.gd_connect.setEnabled(gd.status in ("desconectado",))
        self.gd_disconnect.setEnabled(gd.status == "conectado")
        self.qc_lb.setText(f"Estado: <b>{states['qconcursos'].label}</b><br/>{states['qconcursos'].detail}<br/>"
                           "O JARMES não faz login, não usa scraping e nunca pede sua senha do QConcursos.")
        weak = c.integrations.qconcursos.weak_areas(min_questions=10)
        self.qc_weak.setText("Maior dificuldade (mín. 10 questões): " + "; ".join(f"{w['discipline']} {w['rate']:.0%} ({w['correct']}/{w['total']})" for w in weak)
                             if weak else "Ainda não há resultados suficientes registrados para apontar dificuldades.")
        self.other_lb.setText(f"Reconhecimento de voz: <b>{states['stt'].label}</b> — {states['stt'].detail}<br/>"
                              f"Síntese de voz: <b>{states['tts'].label}</b> — {states['tts'].detail}<br/>OCR: <b>{states['ocr'].label}</b> — {states['ocr'].detail}")

    def on_arg(self, arg):
        pass

    # --- IA -----------------------------------------------------------------------------------
    def test_ai(self):
        client = self.ctx.assistant.client()
        self.ai_result.setText("Testando…")

        def work():
            return client.chat("Responda apenas com a palavra OK.", [ChatMessage("user", "Teste de conexão.")], max_tokens=20)

        run_async(work, lambda t: self.ai_result.setText(f"✔ Conexão funcionando. Resposta do provedor: “{t[:60]}”"),
                  lambda e: self.ai_result.setText("✖ " + (str(e) if isinstance(e, AIUnavailable) else f"Falha ({type(e).__name__}).")))

    # --- Drive --------------------------------------------------------------------------------
    def gd_do_connect(self):
        drive = self.ctx.integrations.gdrive
        if not ask(self, "Conectar ao Google Drive", "O JARMES abrirá o navegador para você entrar na sua conta Google e autorizar o acesso "
                   "SOMENTE LEITURA aos seus arquivos. Sua senha não passa pelo JARMES. Continuar?", "Abrir navegador", "Cancelar"):
            return
        self.gd_lb.setText("Aguardando autorização no navegador (até 3 minutos)…")
        run_async(drive.authorize, lambda _: (info(self, "Google Drive", "Conta conectada."), self.refresh()),
                  lambda e: (warn(self, "Google Drive", str(e) if isinstance(e, IntegrationError) else "Falha ao conectar."), self.refresh()))

    def gd_do_disconnect(self):
        if ask(self, "Desconectar", "Remover os tokens locais e revogar o acesso no Google?", "Desconectar"):
            run_async(self.ctx.integrations.gdrive.disconnect, lambda msg: (info(self, "Google Drive", msg), self.refresh()))

    def gd_list(self):
        q = self.gd_search.text()
        run_async(lambda: self.ctx.integrations.gdrive.list_files(q), self._gd_show,
                  lambda e: warn(self, "Google Drive", str(e) if isinstance(e, IntegrationError) else "Falha ao listar."))

    def _gd_show(self, files):
        self._gd_rows = files
        self.gd_files.clear()
        for f in files:
            self.gd_files.addItem(f"{f['name']}   ·   {f.get('modifiedTime', '')[:10]}")
        if not files:
            self.gd_files.addItem("Nenhum arquivo compatível encontrado.")

    def gd_import(self):
        r = self.gd_files.currentRow()
        if not (0 <= r < len(self._gd_rows)):
            info(self, "Google Drive", "Selecione um arquivo da lista.")
            return
        f = self._gd_rows[r]
        c = self.ctx

        def work():
            path = c.integrations.gdrive.download(f["id"], f["name"], f["mimeType"], c.config.data_dir / "downloads", int(c.config.get("JARMES_MAX_FILE_MB", "100")))
            try:
                return c.documents.import_file(path, None, source="gdrive", source_ref=f["id"])
            finally:
                Path(path).unlink(missing_ok=True)

        run_async(work, lambda res: (info(self, "Importado", f"“{f['name']}” importado ({res.status})." + ("\n" + "\n".join(res.warnings) if res.warnings else "")), self.win.data_changed()),
                  lambda e: warn(self, "Google Drive", str(e) if isinstance(e, (IntegrationError, ValueError)) else "Falha ao importar."))

    # --- QConcursos ----------------------------------------------------------------------------
    def qc_csv(self):
        path, _ = QFileDialog.getOpenFileName(self, "CSV de resultados", str(Path.home()), "CSV (*.csv *.txt)")
        if not path:
            return
        try:
            res = self.ctx.integrations.qconcursos.import_csv(path)
        except ValueError as exc:
            warn(self, "CSV inválido", str(exc))
            return
        msg = f"{res['imported']} linha(s) importada(s)."
        if res["skipped_lines"]:
            msg += f"\nIgnoradas por dados inválidos: linhas {res['skipped_lines'][:15]}."
        info(self, "Importação concluída", msg)
        self.win.data_changed()

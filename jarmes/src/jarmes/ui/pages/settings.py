from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import timedelta
from pathlib import Path

from PySide6.QtCore import QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (QCheckBox, QComboBox, QFileDialog, QFormLayout, QHBoxLayout, QInputDialog, QLineEdit, QSpinBox,
                               QTableWidget, QTableWidgetItem, QTabWidget, QTextEdit, QTimeEdit, QVBoxLayout, QWidget)
from PySide6.QtCore import QTime

from ... import __version__, clock
from ...core.memory import KINDS
from ...core.settings import SettingsError
from ...system import autostart
from ..dialogs import ask, info, warn
from ..widgets import Card, button, label, page_header
from .base import Page, scrollable


def _tab(card_builder) -> QWidget:
    inner = QWidget()
    lay = QVBoxLayout(inner)
    lay.setContentsMargins(12, 12, 12, 12)
    lay.setSpacing(12)
    card_builder(lay)
    lay.addStretch(1)
    return scrollable(inner)


class SettingsPage(Page):
    key, title, icon = "settings", "Configurações", "settings"

    def __init__(self, win):
        super().__init__(win)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.addWidget(page_header("Configurações", f"JARMES {__version__} · dados em {self.ctx.config.data_dir}"))
        self.tabs = QTabWidget()
        lay.addWidget(self.tabs, 1)
        self._tabs = {}
        for key, name, builder in (("geral", "Geral e notificações", self._general), ("ia", "Inteligência artificial", self._ai),
                                   ("voz", "Voz", self._voice), ("google", "Google Drive", self._google),
                                   ("sistema", "Sistema e dados", self._system), ("memoria", "Memória", self._memory)):
            self._tabs[key] = self.tabs.count()
            self.tabs.addTab(_tab(builder), name)
        self._loading = False

    def on_arg(self, arg):
        if isinstance(arg, str) and arg in self._tabs:
            self.tabs.setCurrentIndex(self._tabs[arg])

    # ---------------------------------------------------------------- geral
    def _general(self, lay):
        c = Card("Perfil e avisos")
        f = QFormLayout()
        self.name = QLineEdit()
        self.notif = QCheckBox("Ativar notificações do sistema")
        self.qs, self.qe, self.chk = QTimeEdit(), QTimeEdit(), QTimeEdit()
        for t in (self.qs, self.qe, self.chk):
            t.setDisplayFormat("HH:mm")
        f.addRow("Como devo chamá-lo", self.name)
        f.addRow("", self.notif)
        f.addRow("Silêncio a partir de", self.qs)
        f.addRow("Silêncio até", self.qe)
        f.addRow("Fechamento do dia às", self.chk)
        c.lay.addLayout(f)
        r = QHBoxLayout()
        r.addWidget(button("Salvar", primary=True, slot=self.save_general))
        r.addWidget(button("Pausar avisos por 1 h", slot=lambda: self.pause(1)))
        r.addWidget(button("Pausar até amanhã", slot=lambda: self.pause(24)))
        r.addWidget(button("Retomar avisos", slot=lambda: self.pause(0)))
        r.addWidget(button("Notificação de teste", slot=self.win.notify_test))
        r.addStretch(1)
        c.lay.addLayout(r)
        self.pause_lb = label("", muted=True)
        c.add(self.pause_lb)
        lay.addWidget(c)

    def save_general(self):
        s = self.ctx.settings
        try:
            s.set("user_name", self.name.text().strip() or "Cristiano")
            s.set("notifications_enabled", self.notif.isChecked())
            for key, w in (("quiet_start", self.qs), ("quiet_end", self.qe), ("daily_checkin_time", self.chk)):
                s.set(key, w.time().toString("HH:mm"))
        except SettingsError as exc:
            warn(self, "Inválido", str(exc))
            return
        info(self, "Salvo", "Configurações salvas.")
        self.win.data_changed()

    def pause(self, hours: int):
        s = self.ctx.settings
        if hours == 0:
            s.set("notifications_paused_until", "")
        elif hours == 24:
            s.set("notifications_paused_until", clock.iso((clock.now() + timedelta(days=1)).replace(hour=5, minute=0)))
        else:
            s.set("notifications_paused_until", clock.iso(clock.now() + timedelta(hours=hours)))
        self.refresh()

    # ---------------------------------------------------------------- IA
    def _ai(self, lay):
        c = Card("Provedor de IA")
        f = QFormLayout()
        self.provider = QComboBox()
        for k, v in (("none", "Nenhum (somente recursos locais)"), ("anthropic", "Anthropic (Claude)"), ("openai", "OpenAI ou compatível (Ollama, OpenRouter…)")):
            self.provider.addItem(v, k)
        self.model = QLineEdit()
        self.model.setPlaceholderText("vazio = modelo padrão do provedor")
        self.base = QLineEdit()
        self.base.setPlaceholderText("vazio = endereço padrão (ex.: http://localhost:11434/v1 para Ollama)")
        self.api_key = QLineEdit()
        self.api_key.setEchoMode(QLineEdit.EchoMode.Password)
        self.api_key.setPlaceholderText("cole a chave de API aqui (fica criptografada neste computador)")
        self.key_src = label("", muted=True)
        self.hist = QSpinBox()
        self.hist.setRange(0, 60)
        self.consent = QCheckBox("Autorizo enviar TRECHOS dos meus documentos ao provedor quando eu pedir resumos/perguntas com IA")
        for a, b in (("Provedor", self.provider), ("Modelo", self.model), ("Endereço da API", self.base), ("Chave de API", self.api_key), ("", self.key_src),
                     ("Mensagens de histórico enviadas", self.hist)):
            f.addRow(a, b)
        c.lay.addLayout(f)
        c.add(self.consent)
        c.add(label("Alternativa à chave aqui: crie o arquivo .env com JARMES_AI_PROVIDER, JARMES_AI_API_KEY e JARMES_AI_MODEL (veja .env.example). "
                    "A chave nunca vai para o código, para o banco de dados nem para os logs.", muted=True))
        r = QHBoxLayout()
        r.addWidget(button("Salvar", primary=True, slot=self.save_ai))
        r.addWidget(button("Remover chave salva", danger=True, slot=self.del_key))
        r.addWidget(button("Testar conexão", slot=lambda: self.win.navigate("integrations")))
        r.addStretch(1)
        c.lay.addLayout(r)
        lay.addWidget(c)

    def save_ai(self):
        s = self.ctx.settings
        try:
            s.set("ai_provider", self.provider.currentData())
            s.set("ai_model", self.model.text().strip())
            s.set("ai_base_url", self.base.text().strip().rstrip("/"))
            s.set("ai_history_messages", self.hist.value())
            s.set("ai_docs_consent", self.consent.isChecked())
            if self.api_key.text().strip():
                self.ctx.secrets.set("ai_api_key", self.api_key.text().strip())
                self.api_key.clear()
        except SettingsError as exc:
            warn(self, "Inválido", str(exc))
            return
        info(self, "Salvo", "Configuração de IA salva. Use “Testar conexão” em Integrações.")
        self.win.data_changed()

    def del_key(self):
        if ask(self, "Remover chave", "Apagar a chave de API salva neste computador?", "Apagar"):
            self.ctx.secrets.delete("ai_api_key")
            self.refresh()

    # ---------------------------------------------------------------- voz
    def _voice(self, lay):
        c = Card("Voz")
        f = QFormLayout()
        self.mic = QCheckBox("Microfone habilitado (desmarque para desativar completamente)")
        self.tts = QCheckBox("Resposta falada")
        self.stt = QComboBox()
        for k, v in (("off", "Desligado"), ("vosk", "Local e offline — Vosk (pip install vosk + modelo pt-BR)"), ("remote_openai", "Remoto — API compatível com OpenAI/Whisper (envia o áudio)")):
            self.stt.addItem(v, k)
        self.vosk = QLineEdit()
        r = QHBoxLayout()
        r.addWidget(self.vosk, 1)
        r.addWidget(button("Procurar…", slot=lambda: self.vosk.setText(QFileDialog.getExistingDirectory(self, "Pasta do modelo Vosk") or self.vosk.text())))
        self.remote_consent = QCheckBox("Autorizo enviar o áudio que eu gravar ao serviço remoto escolhido")
        self.stt_key = QLineEdit()
        self.stt_key.setEchoMode(QLineEdit.EchoMode.Password)
        self.stt_key.setPlaceholderText("chave do serviço de voz (vazio = reutiliza a chave de IA)")
        f.addRow("", self.mic)
        f.addRow("", self.tts)
        f.addRow("Reconhecimento", self.stt)
        f.addRow("Pasta do modelo Vosk", r)
        f.addRow("", self.remote_consent)
        f.addRow("Chave (remoto)", self.stt_key)
        c.lay.addLayout(f)
        c.add(label("O JARMES só abre o microfone ao clicar no botão e mostra uma faixa vermelha “MICROFONE ATIVO” enquanto escuta. "
                    "Nenhuma gravação é guardada; o áudio temporário é apagado após a transcrição.", muted=True))
        c.add(button("Salvar", primary=True, slot=self.save_voice))
        lay.addWidget(c)

    def save_voice(self):
        s = self.ctx.settings
        try:
            s.set("mic_enabled", self.mic.isChecked())
            s.set("tts_enabled", self.tts.isChecked())
            s.set("stt_engine", self.stt.currentData())
            s.set("vosk_model_path", self.vosk.text().strip())
            s.set("stt_remote_consent", self.remote_consent.isChecked())
            if self.stt_key.text().strip():
                self.ctx.secrets.set("stt_api_key", self.stt_key.text().strip())
                self.stt_key.clear()
        except SettingsError as exc:
            warn(self, "Inválido", str(exc))
            return
        info(self, "Salvo", "Configurações de voz salvas.")
        self.win.data_changed()

    # ---------------------------------------------------------------- google
    def _google(self, lay):
        c = Card("Credenciais OAuth do Google Drive")
        f = QFormLayout()
        self.g_id = QLineEdit()
        self.g_secret = QLineEdit()
        self.g_secret.setEchoMode(QLineEdit.EchoMode.Password)
        self.g_state = label("", muted=True)
        f.addRow("ID do cliente", self.g_id)
        f.addRow("Segredo do cliente", self.g_secret)
        f.addRow("", self.g_state)
        c.lay.addLayout(f)
        c.add(label("Crie no Google Cloud Console um “ID do cliente OAuth” do tipo App para computador, ative a API do Google Drive e cole aqui. "
                    "Passo a passo em docs/INTEGRACOES.md. O JARMES pede somente leitura (drive.readonly).", muted=True))
        c.add(button("Salvar credenciais", primary=True, slot=self.save_google))
        lay.addWidget(c)

    def save_google(self):
        if self.g_id.text().strip():
            self.ctx.secrets.set("google_client_id", self.g_id.text().strip())
        if self.g_secret.text().strip():
            self.ctx.secrets.set("google_client_secret", self.g_secret.text().strip())
            self.g_secret.clear()
        info(self, "Salvo", "Credenciais salvas (criptografadas). Agora conecte em Integrações.")
        self.win.data_changed()

    # ---------------------------------------------------------------- sistema
    def _system(self, lay):
        c = Card("Execução")
        self.tray = QCheckBox("Minimizar para a bandeja ao fechar a janela (necessário para lembretes continuarem)")
        self.auto = QCheckBox("Iniciar com o Windows (minimizado na bandeja)")
        self.auto_state = label("", muted=True)
        c.add(self.tray)
        c.add(self.auto)
        c.add(self.auto_state)
        c.add(button("Salvar", primary=True, slot=self.save_system))
        lay.addWidget(c)
        d = Card("Dados, cópias de segurança e privacidade")
        self.auto_backup = QCheckBox("Cópia de segurança automática diária")
        d.add(self.auto_backup)
        row = QHBoxLayout()
        row.addWidget(button("Fazer backup agora", slot=self.backup))
        row.addWidget(button("Restaurar backup…", slot=self.restore))
        row.addWidget(button("Exportar meus dados (JSON/CSV)", slot=self.export))
        row.addWidget(button("Abrir pasta de dados", slot=lambda: QDesktopServices.openUrl(QUrl.fromLocalFile(str(self.ctx.config.data_dir)))))
        row.addStretch(1)
        d.lay.addLayout(row)
        row2 = QHBoxLayout()
        row2.addWidget(button("Limpar histórico de conversas", slot=self.clear_chat))
        row2.addWidget(button("Apagar todas as informações do usuário…", danger=True, slot=self.wipe))
        row2.addStretch(1)
        d.lay.addLayout(row2)
        self.data_info = label("", muted=True)
        d.add(self.data_info)
        lay.addWidget(d)

    def save_system(self):
        s = self.ctx.settings
        s.set("close_to_tray", self.tray.isChecked())
        s.set("auto_backup", self.auto_backup.isChecked())
        if sys.platform.startswith("win"):
            try:
                if self.auto.isChecked():
                    autostart.enable()
                else:
                    autostart.disable()
                s.set("autostart", self.auto.isChecked())
            except OSError as exc:
                warn(self, "Inicialização com o Windows", f"Não foi possível alterar (permissão do sistema): {exc}")
        info(self, "Salvo", "Configurações salvas.")
        self.refresh()

    def backup(self):
        p = self.ctx.backup_now("manual")
        info(self, "Backup", f"Cópia criada em:\n{p}")
        self.refresh()

    def restore(self):
        path, _ = QFileDialog.getOpenFileName(self, "Escolha o backup", str(self.ctx.config.backups_dir), "Backups (*.db)")
        if not path:
            return
        if ask(self, "Restaurar backup", "A restauração substitui TODOS os dados atuais pelos do backup e será aplicada na próxima vez que o JARMES abrir. "
               "Uma cópia dos dados atuais será feita antes. Agendar a restauração?", "Agendar"):
            self.ctx.backup_now("antes de restaurar")
            (self.ctx.config.data_dir / "restore.pending").write_text(path, encoding="utf-8")
            info(self, "Restauração agendada", "Feche completamente o JARMES (menu da bandeja → Sair) e abra de novo.")

    def export(self):
        p = self.ctx.export_data()
        info(self, "Exportação concluída", f"Arquivos salvos em:\n{p}\n(não incluem chaves nem tokens)")

    def clear_chat(self):
        if ask(self, "Limpar histórico", "Apagar o histórico de conversas?", "Apagar"):
            self.ctx.conversations.clear()
            self.win.chat_page._loaded = False
            info(self, "Pronto", "Histórico apagado.")

    def wipe(self):
        text, ok = QInputDialog.getText(self, "Apagar tudo", "Isto apaga tarefas, agenda, sessões, resultados, memórias, documentos importados e histórico.\n"
                                        "Esta ação NÃO pode ser desfeita (faço um backup antes).\n\nDigite APAGAR para confirmar:")
        if not ok or text.strip() != "APAGAR":
            return
        wipe_keys = ask(self, "Chaves e tokens", "Apagar também as chaves de API e tokens salvos?", "Apagar também", "Manter")
        self.ctx.backup_now("antes de apagar tudo")
        counts = self.ctx.wipe_data(keep_settings=True, wipe_secrets=wipe_keys)
        self.win.chat_page._loaded = False
        info(self, "Dados apagados", "Concluído:\n" + "\n".join(f"{k}: {v}" for k, v in counts.items() if v))
        self.win.data_changed()

    # ---------------------------------------------------------------- memória
    def _memory(self, lay):
        c = Card("Memória do JARMES (você controla)")
        c.add(label("O que o JARMES guarda sobre você entre sessões. Edite ou apague quando quiser. As memórias são enviadas à IA (se configurada) como DADOS, nunca como instruções.", muted=True))
        self.mem_kind = QComboBox()
        self.mem_kind.addItem("Todas", None)
        for k, v in KINDS.items():
            self.mem_kind.addItem(v, k)
        self.mem_kind.currentIndexChanged.connect(self.refresh_memory)
        c.add(self.mem_kind)
        self.mem = QTableWidget(0, 3)
        self.mem.setHorizontalHeaderLabels(["Tipo", "Conteúdo", "Atualizada"])
        self.mem.horizontalHeader().setStretchLastSection(True)
        self.mem.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.mem.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.mem.setMinimumHeight(240)
        c.add(self.mem)
        r = QHBoxLayout()
        r.addWidget(button("＋ Adicionar", primary=True, slot=self.mem_add))
        r.addWidget(button("Editar", slot=self.mem_edit))
        r.addWidget(button("Excluir", danger=True, slot=self.mem_del))
        r.addStretch(1)
        c.lay.addLayout(r)
        lay.addWidget(c)
        self._mem_rows = []

    def refresh_memory(self):
        self._mem_rows = list(self.ctx.memory.list(self.mem_kind.currentData()))
        self.mem.setRowCount(0)
        for m in self._mem_rows:
            r = self.mem.rowCount()
            self.mem.insertRow(r)
            for i, v in enumerate((KINDS[m["kind"]], m["content"], m["updated_at"][:16])):
                self.mem.setItem(r, i, QTableWidgetItem(v))
        self.mem.resizeColumnsToContents()

    def _msel(self):
        r = self.mem.currentRow()
        return self._mem_rows[r] if 0 <= r < len(self._mem_rows) else None

    def mem_add(self):
        kind, ok = QInputDialog.getItem(self, "Nova memória", "Tipo:", list(KINDS.values()), 0, False)
        if not ok:
            return
        text, ok = QInputDialog.getMultiLineText(self, "Nova memória", "Conteúdo:")
        if ok and text.strip():
            self.ctx.memory.add([k for k, v in KINDS.items() if v == kind][0], text)
            self.refresh_memory()

    def mem_edit(self):
        m = self._msel()
        if m:
            text, ok = QInputDialog.getMultiLineText(self, "Editar memória", "Conteúdo:", m["content"])
            if ok and text.strip():
                self.ctx.memory.update(m["id"], text)
                self.refresh_memory()

    def mem_del(self):
        m = self._msel()
        if m and ask(self, "Excluir memória", "Excluir esta memória?", "Excluir"):
            self.ctx.memory.delete(m["id"])
            self.refresh_memory()

    # ---------------------------------------------------------------- carga
    def refresh(self):
        s = self.ctx.settings
        self.name.setText(s.get("user_name"))
        self.notif.setChecked(bool(s.get("notifications_enabled")))
        for w, k in ((self.qs, "quiet_start"), (self.qe, "quiet_end"), (self.chk, "daily_checkin_time")):
            h, m = map(int, s.get(k).split(":"))
            w.setTime(QTime(h, m))
        until = clock.parse_dt(s.get("notifications_paused_until"))
        self.pause_lb.setText(f"Avisos pausados até {until:%d/%m %H:%M}." if until and until > clock.now() else "Avisos ativos.")
        i = self.provider.findData(s.get("ai_provider"))
        self.provider.setCurrentIndex(max(0, i))
        self.model.setText(s.get("ai_model"))
        self.base.setText(s.get("ai_base_url"))
        self.hist.setValue(int(s.get("ai_history_messages")))
        self.consent.setChecked(bool(s.get("ai_docs_consent")))
        self.key_src.setText(f"Chave: {self.ctx.secrets.source('ai_api_key')}")
        self.mic.setChecked(bool(s.get("mic_enabled")))
        self.tts.setChecked(bool(s.get("tts_enabled")))
        self.stt.setCurrentIndex(max(0, self.stt.findData(s.get("stt_engine"))))
        self.vosk.setText(s.get("vosk_model_path"))
        self.remote_consent.setChecked(bool(s.get("stt_remote_consent")))
        self.g_id.setText(self.ctx.secrets.get("google_client_id") or "")
        self.g_state.setText(f"ID: {self.ctx.secrets.source('google_client_id')} · segredo: {self.ctx.secrets.source('google_client_secret')}")
        self.tray.setChecked(bool(s.get("close_to_tray")))
        self.auto_backup.setChecked(bool(s.get("auto_backup")))
        on_win = sys.platform.startswith("win")
        self.auto.setEnabled(on_win)
        self.auto.setChecked(autostart.is_enabled() if on_win else False)
        self.auto_state.setText("" if on_win else "Disponível somente no Windows.")
        backups = sorted(self.ctx.config.backups_dir.glob("jarmes-*.db"))
        self.data_info.setText(f"Pasta de dados: {self.ctx.config.data_dir}\nBackups: {len(backups)}" + (f" (último: {backups[-1].name})" if backups else "")
                               + f"\nProteção das chaves: {self.ctx.secrets.key_backend if self.ctx.secrets.path.exists() else 'sem segredos salvos'}")
        self.refresh_memory()

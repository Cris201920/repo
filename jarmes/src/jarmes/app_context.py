"""Contêiner de serviços: ponto único de composição (usado pela interface e pelos testes)."""
from __future__ import annotations

import logging
from pathlib import Path

from .ai.assistant import Assistant
from .config import Config
from .core.calendar import CalendarService
from .core.export import export_all, wipe_user_data
from .core.goals import GoalService
from .core.memory import ConversationStore, MemoryService
from .core.notifications import NotificationService
from .core.reports import ReportService
from .core.reviews import ErrorNotebook, FlashcardService, ReviewService
from .core.scheduler import Scheduler
from .core.settings import Settings
from .core.study import StudyService
from .core.tasks import TaskService
from .db import Database
from .docs.service import DocumentService
from .security import SecretStore

log = logging.getLogger("jarmes.app")


class AppContext:
    def __init__(self, config: Config, use_keyring: bool = True):
        self.config = config
        config.ensure_dirs()
        self.db = Database(config.db_path, config.backups_dir).open()
        self.settings = Settings(self.db)
        self.secrets = SecretStore(config.data_dir, config.env, use_keyring=use_keyring)
        self.tasks = TaskService(self.db)
        self.calendar = CalendarService(self.db)
        self.study = StudyService(self.db, self.settings)
        self.study.seed_disciplines()
        self.flashcards = FlashcardService(self.db)
        self.reviews = ReviewService(self.db)
        self.errors = ErrorNotebook(self.db)
        self.memory = MemoryService(self.db)
        self.conversations = ConversationStore(self.db)
        self.notifier = NotificationService(self.db, self.settings)
        self.goals = GoalService(self.db)
        self.reports = ReportService(self.db, self.study)
        try:
            max_mb = int(config.get("JARMES_MAX_FILE_MB", "100"))
        except ValueError:
            max_mb = 100
        self.documents = DocumentService(self.db, config.docs_dir, max_mb=max_mb)
        self.scheduler = Scheduler(self.db, self.settings, self.tasks, self.calendar, self.study, self.notifier,
                                   self.flashcards, self.reviews, self.errors)
        self.assistant = Assistant(self)
        self.selected_doc_id: int | None = None
        # integrações são criadas sob demanda (ver jarmes.integrations)
        from .integrations.manager import IntegrationManager
        from .core.commands import CommandProcessor
        self.integrations = IntegrationManager(self)
        self.commands = CommandProcessor(self)
        self.integrations.refresh_states()

    # --- manutenção -----------------------------------------------------------------
    def backup_now(self, reason: str = "manual") -> Path | None:
        return self.db.backup(reason)

    def daily_backup_if_needed(self) -> Path | None:
        if not self.settings.get("auto_backup"):
            return None
        from datetime import date
        today = date.today().isoformat()
        last = self.db.one("SELECT created_at FROM backups_log ORDER BY id DESC LIMIT 1")
        if last and last["created_at"].startswith(today):
            return None
        return self.db.backup("automático diário")

    def export_data(self) -> Path:
        return export_all(self.db, self.config.exports_dir)

    def wipe_data(self, keep_settings: bool = True, wipe_secrets: bool = False) -> dict:
        counts = wipe_user_data(self.db, self.config.docs_dir, keep_settings=keep_settings,
                                secrets=self.secrets if wipe_secrets else None)
        self.settings.reload()
        self.study.seed_disciplines()
        return counts

    def close(self) -> None:
        self.db.close()

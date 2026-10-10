"""Configurações persistentes (tabela settings) com padrões e validação."""
from __future__ import annotations

import json
import re
from typing import Any

from .. import clock
from ..db import Database

# Modelo de estudo padrão do Cristiano (editável nas Configurações → Central de estudos).
CYCLE1_WEEK = {
    "0": {"disc": "Direito Constitucional", "lei": "Constituição Federal (artigos do dia)"},
    "1": {"disc": "Direito Administrativo", "lei": "Lei 9.784/1999 e Lei 14.133/2021"},
    "2": {"disc": "Direito Civil", "lei": "Código Civil (artigos do dia)"},
    "3": {"disc": "Direito Penal", "lei": "Código Penal (artigos do dia)"},
    "4": {"disc": "Direito Processual Civil", "lei": "CPC (artigos do dia)"},
    "5": {"disc": ["Direitos Humanos", "Filosofia, Sociologia e Psicologia"],
          "lei": "Estatutos e tratados de Direitos Humanos"},
    "6": {"disc": "Revisão semanal e mini-simulado", "lei": "Revisão dos erros da semana", "simulado": True},
}
CYCLE2_WEEK = {
    "0": {"disc": "Direito Empresarial", "lei": "Lei 6.404/1976 e Lei 11.101/2005"},
    "1": {"disc": "Direito do Consumidor", "lei": "CDC (Lei 8.078/1990)"},
    "2": {"disc": "Estatuto da Criança e do Adolescente", "lei": "ECA (Lei 8.069/1990)"},
    "3": {"disc": "Direito Digital", "lei": "LGPD e Marco Civil da Internet"},
    "4": {"disc": ["Estatuto da Pessoa Idosa", "Estatuto da Pessoa com Deficiência"],
          "lei": "Estatutos da pessoa idosa e da pessoa com deficiência"},
    "5": {"disc": ["Direito Urbanístico e Legislação Federal", "Direito Penal Militar e Contabilidade Geral"],
          "lei": "Estatuto da Cidade / Código Penal Militar"},
    "6": {"disc": "Revisão semanal e mini-simulado", "lei": "Revisão dos erros da semana", "simulado": True},
}
CYCLE3_WEEK = {
    "0": {"disc": "Direito Constitucional", "lei": "Súmulas e informativos (STF)", "final": True},
    "1": {"disc": "Direito Administrativo", "lei": "Súmulas e informativos (STF/STJ)", "final": True},
    "2": {"disc": "Direito Civil", "lei": "Súmulas e informativos (STJ)", "final": True},
    "3": {"disc": "Direito Penal", "lei": "Súmulas e informativos (STF/STJ)", "final": True},
    "4": {"disc": "Direito Processual Civil", "lei": "Súmulas e informativos (STJ)", "final": True},
    "5": {"disc": "Simulado completo cronometrado", "lei": "Revisão do caderno de erros", "simulado": True, "final": True},
    "6": {"disc": "Análise do simulado e planejamento", "lei": "Revisão dos erros da semana", "final": True},
}

DEFAULTS: dict[str, Any] = {
    "user_name": "Cristiano",
    "study_start": "06:00",
    "study_minutes": 120,
    "study_break_minutes": 0,
    "study_days": [0, 1, 2, 3, 4, 5, 6],
    "study_blocks": {"lei_seca": 15, "teoria": 60, "questoes": 30, "revisao": 15},
    "questions_goal": 20,
    "weekly_goal_minutes": 840,
    "intensity": "normal",                       # leve|normal|intensa
    "active_cycle": 1,
    "cycle_week": 1,
    "plan_start_date": "",
    "exam_name": "",
    "exam_date": "",
    "cycle_templates": {"1": CYCLE1_WEEK, "2": CYCLE2_WEEK, "3": CYCLE3_WEEK},
    "extra_disciplines": [],
    # notificações
    "notifications_enabled": True,
    "notifications_paused_until": "",
    "quiet_start": "22:30",
    "quiet_end": "05:00",
    "daily_checkin_time": "21:30",
    "close_to_tray": True,
    "autostart": False,
    # IA
    "ai_provider": "none",                       # none|anthropic|openai
    "ai_model": "",
    "ai_base_url": "",
    "ai_history_messages": 12,
    "ai_docs_consent": False,                    # permite enviar trechos de documentos ao provedor
    # voz
    "mic_enabled": True,
    "tts_enabled": True,
    "tts_voice": "",
    "volume": 80,
    "stt_engine": "off",                         # off|vosk|remote_openai
    "stt_remote_consent": False,
    "vosk_model_path": "",
    "voice_rate": 0.0,
    # notícias
    "news_refresh_minutes": 0,                   # 0 = somente manual
    "news_keywords": ["concurso", "edital", "magistratura", "ENAM", "STF", "STJ", "súmula", "informativo",
                      "Defensoria", "Ministério Público"],
    "news_notify": False,
    "news_max_age_days": 30,
    # google drive
    "gdrive_scope": "https://www.googleapis.com/auth/drive.readonly",
    # geral
    "auto_backup": True,
    "first_run_done": False,
}

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

VALIDATORS = {
    "study_start": lambda v: bool(TIME_RE.match(str(v))),
    "quiet_start": lambda v: bool(TIME_RE.match(str(v))),
    "quiet_end": lambda v: bool(TIME_RE.match(str(v))),
    "daily_checkin_time": lambda v: bool(TIME_RE.match(str(v))),
    "study_minutes": lambda v: isinstance(v, int) and 15 <= v <= 600,
    "study_break_minutes": lambda v: isinstance(v, int) and 0 <= v <= 60,
    "questions_goal": lambda v: isinstance(v, int) and 0 <= v <= 500,
    "weekly_goal_minutes": lambda v: isinstance(v, int) and 0 <= v <= 6000,
    "intensity": lambda v: v in ("leve", "normal", "intensa"),
    "active_cycle": lambda v: v in (1, 2, 3),
    "cycle_week": lambda v: isinstance(v, int) and 1 <= v <= 1000,
    "ai_provider": lambda v: v in ("none", "anthropic", "openai"),
    "stt_engine": lambda v: v in ("off", "vosk", "remote_openai"),
    "volume": lambda v: isinstance(v, int) and 0 <= v <= 100,
    "news_refresh_minutes": lambda v: isinstance(v, int) and (v == 0 or 15 <= v <= 1440),
    "study_days": lambda v: isinstance(v, list) and all(isinstance(i, int) and 0 <= i <= 6 for i in v) and len(v) > 0,
    "study_blocks": lambda v: isinstance(v, dict) and all(isinstance(x, int) and x >= 0 for x in v.values()) and sum(v.values()) > 0,
    "ai_history_messages": lambda v: isinstance(v, int) and 0 <= v <= 60,
}


class SettingsError(ValueError):
    pass


class Settings:
    def __init__(self, db: Database):
        self.db = db
        self._cache: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        self._cache = {}
        for row in self.db.query("SELECT key, value FROM settings"):
            try:
                self._cache[row["key"]] = json.loads(row["value"])
            except (TypeError, ValueError):
                continue  # valor corrompido: cai no padrão

    def get(self, key: str, default: Any = None) -> Any:
        if key in self._cache:
            return self._cache[key]
        if key in DEFAULTS:
            return DEFAULTS[key]
        return default

    def set(self, key: str, value: Any) -> None:
        validator = VALIDATORS.get(key)
        if validator is not None and not validator(value):
            raise SettingsError(f"Valor inválido para '{key}': {value!r}")
        self.db.execute(
            "INSERT INTO settings(key, value, updated_at) VALUES (?,?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, json.dumps(value, ensure_ascii=False), clock.iso(clock.now())),
        )
        self._cache[key] = value

    def reset(self, key: str) -> None:
        self.db.execute("DELETE FROM settings WHERE key = ?", (key,))
        self._cache.pop(key, None)

    def all(self) -> dict[str, Any]:
        merged = dict(DEFAULTS)
        merged.update(self._cache)
        return merged

    def reload(self) -> None:
        self._load()

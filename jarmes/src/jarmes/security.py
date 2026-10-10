"""Armazenamento protegido de segredos (chaves de API, tokens OAuth).

Ordem de preferência para guardar a chave mestra de criptografia:
1. Gerenciador de credenciais do SO via `keyring` (Windows Credential Manager), se instalado.
2. Arquivo `secret.key` na pasta de dados, com permissão restrita ao usuário (fallback, mais fraco).

Os segredos em si ficam criptografados (Fernet) em `secrets.enc`, nunca em tabelas comuns.
Variáveis de ambiente JARMES_* têm prioridade e nunca são gravadas em disco.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

log = logging.getLogger("jarmes.security")
_SERVICE = "JARMES"
_KEY_NAME = "master-key"


class SecretStore:
    def __init__(self, data_dir: Path, env: dict | None = None, use_keyring: bool = True):
        self.data_dir = Path(data_dir)
        self.env = env or {}
        self.path = self.data_dir / "secrets.enc"
        self.key_path = self.data_dir / "secret.key"
        self._use_keyring = use_keyring
        self.key_backend = "indefinido"
        self._fernet: Fernet | None = None

    # --- chave mestra -------------------------------------------------
    def _load_master_key(self) -> bytes:
        if self._use_keyring:
            try:
                import keyring  # type: ignore

                stored = keyring.get_password(_SERVICE, _KEY_NAME)
                if not stored:
                    stored = Fernet.generate_key().decode()
                    keyring.set_password(_SERVICE, _KEY_NAME, stored)
                self.key_backend = "keyring"
                return stored.encode()
            except Exception as exc:  # keyring ausente ou sem backend
                log.info("keyring indisponível (%s); usando arquivo de chave local.", type(exc).__name__)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if self.key_path.exists():
            key = self.key_path.read_bytes().strip()
        else:
            key = Fernet.generate_key()
            fd = os.open(self.key_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "wb") as fh:
                fh.write(key)
        try:
            os.chmod(self.key_path, 0o600)
        except OSError:
            pass
        self.key_backend = "arquivo local"
        return key

    @property
    def fernet(self) -> Fernet:
        if self._fernet is None:
            self._fernet = Fernet(self._load_master_key())
        return self._fernet

    # --- leitura/gravação --------------------------------------------
    def _read_all(self) -> dict:
        if not self.path.exists():
            return {}
        try:
            return json.loads(self.fernet.decrypt(self.path.read_bytes()).decode("utf-8"))
        except (InvalidToken, ValueError):
            log.error("Arquivo de segredos ilegível (chave mestra diferente ou arquivo corrompido).")
            return {}

    def _write_all(self, data: dict) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        blob = self.fernet.encrypt(json.dumps(data).encode("utf-8"))
        tmp = self.path.with_suffix(".tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "wb") as fh:
            fh.write(blob)
        os.replace(tmp, self.path)

    def get(self, name: str) -> str | None:
        env_name = "JARMES_" + name.upper().replace(".", "_").replace("-", "_")
        if self.env.get(env_name):
            return self.env[env_name]
        return self._read_all().get(name)

    def source(self, name: str) -> str:
        env_name = "JARMES_" + name.upper().replace(".", "_").replace("-", "_")
        if self.env.get(env_name):
            return "variável de ambiente/.env"
        if name in self._read_all():
            return "armazenamento criptografado"
        return "não configurado"

    def set(self, name: str, value: str) -> None:
        data = self._read_all()
        data[name] = value
        self._write_all(data)

    def delete(self, name: str) -> None:
        data = self._read_all()
        if name in data:
            del data[name]
            self._write_all(data)

    def names(self) -> list[str]:
        return sorted(self._read_all().keys())

    def wipe(self) -> None:
        for p in (self.path, self.key_path):
            try:
                p.unlink()
            except FileNotFoundError:
                pass
        if self._use_keyring:
            try:
                import keyring  # type: ignore

                keyring.delete_password(_SERVICE, _KEY_NAME)
            except Exception:
                pass
        self._fernet = None

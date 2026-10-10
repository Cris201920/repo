"""Configuração por variáveis de ambiente e arquivo .env local (nunca versionado)."""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path


def default_data_dir() -> Path:
    override = os.environ.get("JARMES_DATA_DIR")
    if override:
        return Path(override).expanduser()
    if sys.platform.startswith("win"):
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(base) / "JARMES"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "JARMES"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "jarmes"


def parse_env_file(path: Path) -> dict[str, str]:
    """Parser mínimo de .env (KEY=VALUE, comentários com #, aspas opcionais)."""
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        elif " #" in val:
            val = val.split(" #", 1)[0].rstrip()
        if key:
            values[key] = val
    return values


def load_env(data_dir: Path | None = None) -> dict[str, str]:
    """Carrega .env (pasta de dados e pasta atual). Variáveis reais do ambiente têm prioridade."""
    merged: dict[str, str] = {}
    candidates = [Path.cwd() / ".env"]
    if data_dir is not None:
        candidates.insert(0, data_dir / ".env")
    for candidate in reversed(candidates):  # o primeiro da lista vence
        merged.update(parse_env_file(candidate))
    merged.update({k: v for k, v in os.environ.items() if k.startswith("JARMES_")})
    return merged


@dataclass(frozen=True)
class Config:
    data_dir: Path
    env: dict

    @property
    def db_path(self) -> Path:
        return self.data_dir / "jarmes.db"

    @property
    def docs_dir(self) -> Path:
        return self.data_dir / "documentos"

    @property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    @property
    def exports_dir(self) -> Path:
        return self.data_dir / "exportacoes"

    def get(self, key: str, default: str = "") -> str:
        return self.env.get(key, default)

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.docs_dir, self.backups_dir, self.logs_dir, self.exports_dir):
            d.mkdir(parents=True, exist_ok=True)

    @classmethod
    def load(cls, data_dir: Path | None = None) -> "Config":
        data_dir = Path(data_dir) if data_dir else default_data_dir()
        return cls(data_dir=data_dir, env=load_env(data_dir))

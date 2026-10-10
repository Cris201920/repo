"""Acesso ao SQLite com migrações versionadas, backup antes de migrar e tratamento de falhas."""
from __future__ import annotations

import logging
import shutil
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Sequence

from .migrations import LATEST_VERSION, MIGRATIONS

log = logging.getLogger("jarmes.db")


class DatabaseError(RuntimeError):
    pass


class Database:
    def __init__(self, path: Path | str, backups_dir: Path | None = None):
        self.path = Path(path) if str(path) != ":memory:" else path
        self.backups_dir = Path(backups_dir) if backups_dir else None
        self._lock = threading.RLock()
        self.conn: sqlite3.Connection | None = None
        self.fts_available = True
        self.recovered_from: Path | None = None

    # --- ciclo de vida ---------------------------------------------------
    def open(self) -> "Database":
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        try:
            self._connect()
            self.migrate()
        except sqlite3.DatabaseError as exc:
            log.error("Banco ilegível (%s). Tentando recuperar do backup mais recente.", exc)
            self._recover(exc)
        return self

    def _connect(self) -> None:
        self.conn = sqlite3.connect(str(self.path), check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        if self.path != ":memory:":
            self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.execute("PRAGMA synchronous = NORMAL")
        # força leitura do cabeçalho: detecta arquivo corrompido cedo
        self.conn.execute("PRAGMA user_version").fetchone()

    def _recover(self, original: Exception) -> None:
        if self.conn:
            self.conn.close()
            self.conn = None
        latest = self.latest_backup()
        broken = Path(self.path)
        if broken.exists():
            quarantine = broken.with_suffix(f".corrompido-{datetime.now():%Y%m%d%H%M%S}")
            shutil.move(str(broken), str(quarantine))
            log.error("Banco corrompido movido para %s", quarantine)
        for ext in ("-wal", "-shm"):
            Path(str(broken) + ext).unlink(missing_ok=True)
        if latest is None:
            self._connect()
            self.migrate()
            return
        shutil.copy2(latest, broken)
        self.recovered_from = latest
        self._connect()
        self.migrate()

    def close(self) -> None:
        with self._lock:
            if self.conn is not None:
                try:
                    self.conn.close()
                finally:
                    self.conn = None

    # --- migrações ---------------------------------------------------------
    @property
    def version(self) -> int:
        return int(self.one("PRAGMA user_version")["user_version"])

    def migrate(self) -> int:
        current = self.version
        pending = [m for m in MIGRATIONS if m[0] > current]
        if not pending:
            return current
        if current > 0 and self.path != ":memory:":
            self.backup(reason=f"antes da migração v{current}->v{LATEST_VERSION}")
        for version, description, sql in pending:
            log.info("Aplicando migração %s: %s", version, description)
            with self._lock:
                try:
                    self.conn.execute("BEGIN")
                    for stmt in _split_sql(sql):
                        try:
                            self.conn.execute(stmt)
                        except sqlite3.OperationalError as exc:
                            if "fts5" in str(exc).lower():
                                self.fts_available = False
                                log.warning("FTS5 indisponível; busca usará LIKE.")
                                continue
                            raise
                    self.conn.execute(f"PRAGMA user_version = {int(version)}")
                    self.conn.execute("COMMIT")
                except Exception:
                    self.conn.execute("ROLLBACK")
                    raise DatabaseError(f"Falha na migração {version}") from None
        return LATEST_VERSION

    # --- consultas ---------------------------------------------------------
    def execute(self, sql: str, params: Sequence[Any] | dict = ()) -> sqlite3.Cursor:
        with self._lock:
            return self.conn.execute(sql, params)

    def executemany(self, sql: str, rows: Iterable[Sequence[Any]]) -> None:
        with self._lock:
            self.conn.execute("BEGIN")
            try:
                self.conn.executemany(sql, rows)
                self.conn.execute("COMMIT")
            except Exception:
                self.conn.execute("ROLLBACK")
                raise

    def query(self, sql: str, params: Sequence[Any] | dict = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self.conn.execute(sql, params).fetchall()

    def one(self, sql: str, params: Sequence[Any] | dict = ()) -> sqlite3.Row | None:
        with self._lock:
            return self.conn.execute(sql, params).fetchone()

    def insert(self, table: str, values: dict[str, Any]) -> int:
        cols = ", ".join(values)
        marks = ", ".join("?" for _ in values)
        cur = self.execute(f"INSERT INTO {table} ({cols}) VALUES ({marks})", list(values.values()))
        return int(cur.lastrowid)

    def update(self, table: str, row_id: int, values: dict[str, Any], key: str = "id") -> None:
        if not values:
            return
        sets = ", ".join(f"{c} = ?" for c in values)
        self.execute(f"UPDATE {table} SET {sets} WHERE {key} = ?", [*values.values(), row_id])

    def transaction(self):
        return _Tx(self)

    # --- backup --------------------------------------------------------------
    def backup(self, reason: str = "manual", keep: int = 14) -> Path | None:
        if self.path == ":memory:" or self.backups_dir is None:
            return None
        self.backups_dir.mkdir(parents=True, exist_ok=True)
        target = self.backups_dir / f"jarmes-{datetime.now():%Y%m%d-%H%M%S}.db"
        n = 1
        while target.exists():
            target = self.backups_dir / f"jarmes-{datetime.now():%Y%m%d-%H%M%S}-{n}.db"
            n += 1
        with self._lock:
            dest = sqlite3.connect(str(target))
            try:
                self.conn.backup(dest)
            finally:
                dest.close()
        try:
            self.conn.execute(
                "INSERT INTO backups_log(path, reason, created_at) VALUES (?,?,?)",
                (str(target), reason, datetime.now().isoformat(sep=" ", timespec="seconds")),
            )
        except sqlite3.Error:
            pass
        backups = sorted(self.backups_dir.glob("jarmes-*.db"))
        for old in backups[:-keep]:
            old.unlink(missing_ok=True)
        return target

    def latest_backup(self) -> Path | None:
        if self.backups_dir is None or not self.backups_dir.exists():
            return None
        backups = sorted(self.backups_dir.glob("jarmes-*.db"))
        for candidate in reversed(backups):
            try:
                c = sqlite3.connect(str(candidate))
                c.execute("PRAGMA integrity_check").fetchone()
                c.close()
                return candidate
            except sqlite3.Error:
                continue
        return None

    def user_tables(self) -> list[str]:
        rows = self.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' "
            "AND name NOT LIKE 'doc_fts%' ORDER BY name"
        )
        return [r["name"] for r in rows]


class _Tx:
    def __init__(self, db: Database):
        self.db = db

    def __enter__(self):
        self.db._lock.acquire()
        self.db.conn.execute("BEGIN")
        return self.db

    def __exit__(self, exc_type, exc, tb):
        try:
            self.db.conn.execute("ROLLBACK" if exc_type else "COMMIT")
        finally:
            self.db._lock.release()
        return False


def _split_sql(script: str) -> list[str]:
    """Divide script em instruções respeitando blocos BEGIN...END de triggers."""
    stmts, buf = [], []
    for line in script.splitlines():
        buf.append(line)
        candidate = "\n".join(buf).strip()
        if candidate.endswith(";") and sqlite3.complete_statement(candidate):
            stmts.append(candidate)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        stmts.append(tail)
    return stmts

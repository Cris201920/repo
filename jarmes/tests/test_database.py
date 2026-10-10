import sqlite3

import pytest

from jarmes.db import Database
from jarmes.db.migrations import LATEST_VERSION


def test_migrate_creates_schema(tmp_path):
    db = Database(tmp_path / "a.db", tmp_path / "bk").open()
    assert db.version == LATEST_VERSION
    for t in ("tasks", "events", "study_sessions", "documents", "doc_chunks", "memories", "notifications"):
        assert t in db.user_tables()
    db.close()


def test_persistence_after_reopen(tmp_path):
    db = Database(tmp_path / "a.db", tmp_path / "bk").open()
    db.insert("memories", dict(kind="preferencia", key="", content="x", created_at="a", updated_at="a"))
    db.close()
    db2 = Database(tmp_path / "a.db", tmp_path / "bk").open()
    assert db2.one("SELECT content FROM memories")["content"] == "x"
    db2.close()


def test_backup_and_rotation(tmp_path):
    db = Database(tmp_path / "a.db", tmp_path / "bk").open()
    for _ in range(5):
        db.backup("teste", keep=3)
    assert len(list((tmp_path / "bk").glob("jarmes-*.db"))) == 3
    db.close()


def test_corrupted_db_recovers_from_backup(tmp_path):
    db = Database(tmp_path / "a.db", tmp_path / "bk").open()
    db.insert("memories", dict(kind="preferencia", key="", content="importante", created_at="a", updated_at="a"))
    db.backup("pré-corrupção")
    db.close()
    (tmp_path / "a.db").write_bytes(b"isto nao e um banco sqlite" * 50)
    for ext in ("-wal", "-shm"):
        (tmp_path / f"a.db{ext}").unlink(missing_ok=True)
    db2 = Database(tmp_path / "a.db", tmp_path / "bk").open()
    assert db2.recovered_from is not None
    assert db2.one("SELECT content FROM memories")["content"] == "importante"
    db2.close()


def test_failed_migration_rolls_back(tmp_path, monkeypatch):
    from jarmes.db import migrations
    bad = migrations.MIGRATIONS + [(99, "ruim", "CREATE TABLE ok_t(id INTEGER); CREATE TABLE ok_t(id INTEGER);")]
    monkeypatch.setattr("jarmes.db.database.MIGRATIONS", bad)
    db = Database(":memory:")
    db._connect()
    with pytest.raises(Exception):
        db.migrate()
    assert db.version < 99

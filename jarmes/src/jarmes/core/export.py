"""Exportação de dados (JSON + CSV) e apagamento das informações do usuário."""
from __future__ import annotations

import csv
import json
import shutil
from pathlib import Path

from .. import clock
from ..db import Database

EXCLUDE_FROM_EXPORT = {"backups_log"}
USER_DATA_TABLES = [
    "task_log", "tasks", "events", "study_sessions", "question_results", "reviews", "flashcards", "error_notebook",
    "question_bank", "goals", "memories", "messages", "notifications", "doc_derived", "doc_chunks", "documents",
    "news_items", "contests", "proposals", "integrations", "backups_log",
]


def export_all(db: Database, target_dir: Path) -> Path:
    stamp = clock.now().strftime("%Y%m%d-%H%M%S")
    out = Path(target_dir) / f"jarmes-exportacao-{stamp}"
    out.mkdir(parents=True, exist_ok=True)
    dump: dict[str, list[dict]] = {}
    for table in db.user_tables():
        if table in EXCLUDE_FROM_EXPORT:
            continue
        rows = [dict(r) for r in db.query(f"SELECT * FROM {table}")]
        dump[table] = rows
        if rows:
            with open(out / f"{table}.csv", "w", newline="", encoding="utf-8-sig") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
    (out / "jarmes-dados.json").write_text(json.dumps(dump, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    (out / "LEIA-ME.txt").write_text(
        "Exportação de dados do JARMES.\nNão contém chaves de API nem tokens (ficam em armazenamento criptografado separado).\n",
        encoding="utf-8")
    return out


def wipe_user_data(db: Database, docs_dir: Path, *, keep_settings: bool = True, secrets=None) -> dict:
    """Apaga dados do usuário. Retorna contagem por tabela. Os arquivos importados também são removidos."""
    counts = {}
    with db.transaction():
        for t in USER_DATA_TABLES:
            if t in db.user_tables():
                counts[t] = db.execute(f"DELETE FROM {t}").rowcount
        if not keep_settings:
            counts["settings"] = db.execute("DELETE FROM settings").rowcount
    if db.fts_available:
        try:
            db.execute("INSERT INTO doc_fts(doc_fts) VALUES('rebuild')")
        except Exception:
            pass
    if Path(docs_dir).exists():
        shutil.rmtree(docs_dir, ignore_errors=True)
        Path(docs_dir).mkdir(parents=True, exist_ok=True)
    if secrets is not None:
        secrets.wipe()
    return counts

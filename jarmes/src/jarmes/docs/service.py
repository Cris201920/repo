"""Importação, indexação, busca e derivados de documentos (armazenamento local por padrão)."""
from __future__ import annotations

import hashlib
import logging
import re
import shutil
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from .. import clock
from ..db import Database
from . import analysis
from .extract import Extraction, ImportRejected, extract, validate_file

log = logging.getLogger("jarmes.docs")


@dataclass
class ImportResult:
    doc_id: int
    duplicate: bool = False
    status: str = "full"
    warnings: list[str] = field(default_factory=list)


def _chunks(text: str, size: int = 1200) -> list[str]:
    paras = [p.strip() for p in re.split(r"\n\s*\n|\n(?=Art\.)", text) if p.strip()]
    out, buf = [], ""
    for p in paras:
        if buf and len(buf) + len(p) > size:
            out.append(buf)
            buf = ""
        while len(p) > size * 1.5:
            cut = p.rfind(" ", 0, size)
            cut = cut if cut > 200 else size
            out.append(p[:cut])
            p = p[cut:].strip()
        buf = (buf + "\n" + p).strip() if buf else p
    if buf:
        out.append(buf)
    return out


class DocumentService:
    def __init__(self, db: Database, docs_dir: Path, max_mb: int = 100):
        self.db, self.docs_dir, self.max_mb = db, Path(docs_dir), max_mb

    # --- importação -------------------------------------------------------------------
    def import_file(self, path: str | Path, discipline: str | None = None, *, source: str = "local",
                    source_ref: str | None = None, ocr: bool = True) -> ImportResult:
        path = Path(path)
        ext = validate_file(path, self.max_mb)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        existing = self.db.one("SELECT id, read_status FROM documents WHERE sha256=?", (digest,))
        if existing:
            return ImportResult(existing["id"], duplicate=True, status=existing["read_status"],
                                warnings=["Este arquivo já foi importado."])
        self.docs_dir.mkdir(parents=True, exist_ok=True)
        stored = self.docs_dir / f"{uuid.uuid4().hex}{ext}"
        shutil.copy2(path, stored)  # nunca altera/move o original
        try:
            ex: Extraction = extract(stored, ext, ocr=ocr)
        except Exception as exc:
            log.exception("Erro inesperado na extração")
            ex = Extraction(status="unreadable", warnings=[f"Erro inesperado ao ler o arquivo: {type(exc).__name__}."])
        with self.db.transaction():
            doc_id = self.db.insert("documents", dict(
                name=path.name, stored_path=str(stored), sha256=digest, ext=ext, size_bytes=stored.stat().st_size,
                pages=len(ex.pages), read_status=ex.status, warnings="\n".join(ex.warnings), discipline=discipline,
                source=source, source_ref=source_ref, text_chars=ex.chars, imported_at=clock.iso(clock.now())))
            idx = 0
            for page, text in ex.pages:
                for chunk in _chunks(text):
                    self.db.insert("doc_chunks", dict(doc_id=doc_id, page=page, idx=idx, text=chunk))
                    idx += 1
        return ImportResult(doc_id, status=ex.status, warnings=ex.warnings)

    # --- consulta -------------------------------------------------------------------------
    def list(self, discipline: str | None = None):
        if discipline:
            return self.db.query("SELECT * FROM documents WHERE discipline=? ORDER BY imported_at DESC", (discipline,))
        return self.db.query("SELECT * FROM documents ORDER BY imported_at DESC")

    def get(self, doc_id: int):
        return self.db.one("SELECT * FROM documents WHERE id=?", (doc_id,))

    def unit_label(self, doc) -> str:
        return "p." if doc["ext"] in (".pdf",) or doc["ext"] in (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp") else "trecho"

    def pages(self, doc_id: int) -> list[tuple[int, str]]:
        rows = self.db.query("SELECT page, GROUP_CONCAT(text, char(10)) t FROM doc_chunks WHERE doc_id=? GROUP BY page ORDER BY page",
                             (doc_id,))
        return [(r["page"], r["t"]) for r in rows]

    def text(self, doc_id: int, max_chars: int | None = None) -> str:
        parts = [f"[{p}] {t}" for p, t in self.pages(doc_id)]
        out = "\n\n".join(parts)
        return out[:max_chars] if max_chars else out

    def set_discipline(self, doc_id: int, discipline: str | None) -> None:
        self.db.update("documents", doc_id, dict(discipline=discipline))

    def delete(self, doc_id: int) -> None:
        doc = self.get(doc_id)
        if doc is None:
            return
        with self.db.transaction():
            self.db.execute("DELETE FROM doc_chunks WHERE doc_id=?", (doc_id,))
            self.db.execute("DELETE FROM doc_derived WHERE doc_id=?", (doc_id,))
            self.db.execute("DELETE FROM flashcards WHERE doc_id=? AND source='documento_local'", (doc_id,))
            self.db.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        Path(doc["stored_path"]).unlink(missing_ok=True)

    # --- busca ---------------------------------------------------------------------------
    @staticmethod
    def _fts_query(q: str, op: str = "AND") -> str:
        tokens = re.findall(r"[\wÀ-ÿ]+", q, flags=re.UNICODE)
        if op == "OR":  # busca em linguagem natural: ignora palavras vazias
            tokens = [t for t in tokens if len(t) > 3 and t.lower() not in analysis.STOPWORDS]
        return f" {op} ".join(f'"{t}"*' for t in tokens[:8])

    def search(self, query: str, limit: int = 20, doc_id: int | None = None) -> list[dict]:
        query = (query or "").strip()
        if not query:
            return []
        rows = []
        if self.db.fts_available:
            for op in ("AND", "OR"):
                fq = self._fts_query(query, op)
                if fq:
                    rows = self._fts_rows(fq, limit, doc_id)
                if rows:
                    break
        else:
            like = f"%{query}%"
            sql = ("SELECT c.doc_id, c.page, d.name, d.ext, substr(c.text,1,200) AS snip, 0 AS rank FROM doc_chunks c "
                   "JOIN documents d ON d.id=c.doc_id WHERE c.text LIKE ?")
            params = [like]
            if doc_id:
                sql += " AND c.doc_id = ?"
                params.append(doc_id)
            rows = self.db.query(sql + " LIMIT ?", [*params, limit])
        return [dict(doc_id=r["doc_id"], page=r["page"], name=r["name"], ext=r["ext"], snippet=r["snip"]) for r in rows]

    def _fts_rows(self, fq: str, limit: int, doc_id: int | None):
        sql = ("SELECT c.doc_id, c.page, d.name, d.ext, snippet(doc_fts, 0, '«', '»', ' … ', 24) AS snip, bm25(doc_fts) AS rank "
               "FROM doc_fts JOIN doc_chunks c ON c.id = doc_fts.rowid JOIN documents d ON d.id = c.doc_id "
               "WHERE doc_fts MATCH ?")
        params: list = [fq]
        if doc_id:
            sql += " AND c.doc_id = ?"
            params.append(doc_id)
        sql += " ORDER BY rank LIMIT ?"
        params.append(limit)
        return self.db.query(sql, params)

    # --- derivados -------------------------------------------------------------------------
    def save_derived(self, doc_id: int, kind: str, content: str, generator: str = "local") -> int:
        return self.db.insert("doc_derived", dict(doc_id=doc_id, kind=kind, content=content, generator=generator,
                                                   created_at=clock.iso(clock.now())))

    def derived(self, doc_id: int, kind: str | None = None):
        if kind:
            return self.db.query("SELECT * FROM doc_derived WHERE doc_id=? AND kind=? ORDER BY id DESC", (doc_id, kind))
        return self.db.query("SELECT * FROM doc_derived WHERE doc_id=? ORDER BY id DESC", (doc_id,))

    def local_summary(self, doc_id: int, max_sentences: int = 8) -> str:
        doc = self.get(doc_id)
        pages = self.pages(doc_id)
        if not pages:
            raise ValueError("Documento sem texto extraído.")
        lab = self.unit_label(doc)
        picks = analysis.extractive_summary(pages, max_sentences)
        text = ("Resumo extrativo local (frases mais representativas do próprio documento; não é uma paráfrase):\n\n"
                + "\n".join(f"• {s} ({lab} {p})" for p, s in picks))
        self.save_derived(doc_id, "resumo", text, "local")
        return text

    def themes(self, doc_id: int) -> list[tuple[str, int]]:
        pages = self.pages(doc_id)
        alltext = " ".join(t for _, t in pages)
        res = analysis.bigrams(alltext, 6) + analysis.keywords(alltext, 14)
        self.save_derived(doc_id, "temas", "\n".join(f"{k} ({c}×)" for k, c in res), "local")
        return res

    def local_flashcards(self, doc_id: int, limit: int = 12) -> list[dict]:
        pages = self.pages(doc_id)
        cards = analysis.cloze_flashcards(pages, limit)
        return cards

    def mindmap(self, doc_id: int) -> tuple[list[dict], str]:
        doc = self.get(doc_id)
        items = analysis.outline(self.pages(doc_id))
        md = analysis.outline_to_markdown(items, doc["name"])
        self.save_derived(doc_id, "mapa", md, "local")
        return items, md

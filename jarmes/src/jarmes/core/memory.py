"""Memória persistente, organizada e controlável: o usuário consulta, edita e exclui."""
from __future__ import annotations

import re

from .. import clock
from ..db import Database

KINDS = {
    "preferencia": "Preferência permanente",
    "tarefa_atual": "Tarefa/assunto atual",
    "historico": "Histórico",
    "documento": "Extraído de documento",
}
_WORD = re.compile(r"[\wÀ-ÿ]{4,}", re.UNICODE)


class MemoryService:
    def __init__(self, db: Database):
        self.db = db

    def add(self, kind: str, content: str, key: str = "", source: str = "usuario") -> int:
        if kind not in KINDS:
            raise ValueError(f"Tipo de memória inválido: {kind}")
        content = (content or "").strip()
        if not content:
            raise ValueError("O conteúdo da memória não pode ser vazio.")
        now = clock.iso(clock.now())
        if key:
            row = self.db.one("SELECT id FROM memories WHERE kind=? AND key=?", (kind, key))
            if row:
                self.db.update("memories", row["id"], dict(content=content, updated_at=now, source=source))
                return row["id"]
        return self.db.insert("memories", dict(kind=kind, key=key, content=content, source=source,
                                                created_at=now, updated_at=now))

    def update(self, memory_id: int, content: str, key: str | None = None) -> None:
        if not content.strip():
            raise ValueError("O conteúdo da memória não pode ser vazio.")
        fields = dict(content=content.strip(), updated_at=clock.iso(clock.now()))
        if key is not None:
            fields["key"] = key
        self.db.update("memories", memory_id, fields)

    def delete(self, memory_id: int) -> None:
        self.db.execute("DELETE FROM memories WHERE id=?", (memory_id,))

    def clear_kind(self, kind: str) -> int:
        return self.db.execute("DELETE FROM memories WHERE kind=?", (kind,)).rowcount

    def list(self, kind: str | None = None):
        if kind:
            return self.db.query("SELECT * FROM memories WHERE kind=? ORDER BY updated_at DESC", (kind,))
        return self.db.query("SELECT * FROM memories ORDER BY kind, updated_at DESC")

    def relevant(self, query: str, limit: int = 8) -> list[dict]:
        """Preferências sempre entram; demais por sobreposição de palavras com a pergunta."""
        words = {w.lower() for w in _WORD.findall(query or "")}
        picked = [dict(r) for r in self.list("preferencia")][:limit]
        scored = []
        for r in self.db.query("SELECT * FROM memories WHERE kind != 'preferencia'"):
            text = (r["key"] + " " + r["content"]).lower()
            score = sum(1 for w in words if w in text)
            if score or r["kind"] == "tarefa_atual":
                scored.append((score, r["updated_at"], dict(r)))
        scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
        for _, _, r in scored:
            if len(picked) >= limit:
                break
            picked.append(r)
        return picked


class ConversationStore:
    def __init__(self, db: Database):
        self.db = db

    def add(self, role: str, content: str, channel: str = "texto", meta_json: str = "{}") -> int:
        return self.db.insert("messages", dict(role=role, content=content, channel=channel, meta_json=meta_json,
                                                created_at=clock.iso(clock.now())))

    def recent(self, limit: int = 12):
        rows = self.db.query("SELECT * FROM messages WHERE role IN ('user','assistant') ORDER BY id DESC LIMIT ?", (limit,))
        return list(reversed(rows))

    def all(self, limit: int = 500):
        return list(reversed(self.db.query("SELECT * FROM messages ORDER BY id DESC LIMIT ?", (limit,))))

    def clear(self) -> None:
        self.db.execute("DELETE FROM messages")

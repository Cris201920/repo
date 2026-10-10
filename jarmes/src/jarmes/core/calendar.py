"""Compromissos / agenda com recorrência simples e detecção de conflitos."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from .. import clock
from ..db import Database
from .tasks import next_occurrence


class CalendarService:
    def __init__(self, db: Database):
        self.db = db

    def add(self, title: str, start: datetime, end: datetime | None = None, *, notes: str = "",
            location: str = "", kind: str = "compromisso", remind_minutes: int = 15,
            recurrence: str = "none", discipline: str | None = None) -> int:
        title = (title or "").strip()
        if not title:
            raise ValueError("O compromisso precisa de um título.")
        end = end or start + timedelta(hours=1)
        if end <= start:
            raise ValueError("O término deve ser depois do início.")
        if remind_minutes < 0:
            raise ValueError("Lembrete inválido.")
        return self.db.insert("events", dict(
            title=title, notes=notes, start_at=clock.iso(start), end_at=clock.iso(end), location=location,
            kind=kind, remind_minutes=remind_minutes, recurrence=recurrence, discipline=discipline,
            created_at=clock.iso(clock.now())))

    def get(self, event_id: int):
        return self.db.one("SELECT * FROM events WHERE id = ?", (event_id,))

    def update(self, event_id: int, **fields) -> None:
        allowed = {"title", "notes", "start_at", "end_at", "location", "kind", "remind_minutes", "recurrence", "discipline"}
        clean = {}
        for k, v in fields.items():
            if k not in allowed:
                raise ValueError(f"Campo não editável: {k}")
            clean[k] = clock.iso(v) if isinstance(v, datetime) else v
        self.db.update("events", event_id, clean)

    def delete(self, event_id: int) -> None:
        self.db.execute("DELETE FROM events WHERE id = ?", (event_id,))

    def between(self, start: datetime, end: datetime) -> list[dict]:
        """Ocorrências (expandindo recorrências) que começam em [start, end)."""
        out: list[dict] = []
        rows = self.db.query("SELECT * FROM events ORDER BY start_at")
        for r in rows:
            s = clock.parse_dt(r["start_at"])
            e = clock.parse_dt(r["end_at"])
            dur = e - s
            occ = s
            guard = 0
            while occ < end and guard < 2000:
                guard += 1
                if occ >= start:
                    item = dict(r)
                    item["start_at"] = clock.iso(occ)
                    item["end_at"] = clock.iso(occ + dur)
                    item["occurrence"] = occ != s
                    out.append(item)
                if r["recurrence"] == "none":
                    break
                nxt = next_occurrence(occ, r["recurrence"])
                if nxt is None:
                    break
                occ = nxt
        out.sort(key=lambda x: x["start_at"])
        return out

    def on_day(self, day: date) -> list[dict]:
        start = datetime.combine(day, datetime.min.time())
        return self.between(start, start + timedelta(days=1))

    def on_week(self, day: date) -> list[dict]:
        monday = datetime.combine(clock.monday_of(day), datetime.min.time())
        return self.between(monday, monday + timedelta(days=7))

    def on_month(self, year: int, month: int) -> list[dict]:
        first = datetime(year, month, 1)
        nxt = datetime(year + (month == 12), month % 12 + 1, 1)
        return self.between(first, nxt)

    def next_event(self, now: datetime | None = None) -> dict | None:
        now = now or clock.now()
        upcoming = self.between(now, now + timedelta(days=60))
        return upcoming[0] if upcoming else None

    def conflicts(self, start: datetime, end: datetime, ignore_id: int | None = None) -> list[dict]:
        day_start = datetime.combine(start.date(), datetime.min.time())
        hits = []
        for ev in self.between(day_start - timedelta(days=1), end + timedelta(days=1)):
            if ignore_id is not None and ev["id"] == ignore_id:
                continue
            es, ee = clock.parse_dt(ev["start_at"]), clock.parse_dt(ev["end_at"])
            if es < end and ee > start:
                hits.append(ev)
        return hits

    def free_slots(self, day: date, minutes: int, window=(6, 22)) -> list[tuple[datetime, datetime]]:
        """Janelas livres de pelo menos `minutes` entre as horas da janela."""
        w_start = datetime.combine(day, datetime.min.time()) + timedelta(hours=window[0])
        w_end = datetime.combine(day, datetime.min.time()) + timedelta(hours=window[1])
        busy = sorted((clock.parse_dt(e["start_at"]), clock.parse_dt(e["end_at"])) for e in self.on_day(day))
        slots, cursor = [], w_start
        for bs, be in busy:
            if be <= cursor:
                continue
            if bs - cursor >= timedelta(minutes=minutes):
                slots.append((cursor, bs))
            cursor = max(cursor, be)
        if w_end - cursor >= timedelta(minutes=minutes):
            slots.append((cursor, w_end))
        return slots

"""Central de notificações: gravação, política de entrega (silêncio, pausa, limite) e deduplicação."""
from __future__ import annotations

import json
from datetime import datetime, time

from .. import clock
from ..db import Database
from .settings import Settings

# Tipos que são "cutucadas" e entram no limite diário; lembretes de horário marcado não entram.
NUDGE_KINDS = {"pendencia", "checkin", "atrasadas", "revisao", "sequencia", "relatorio", "noticia", "proposta"}
DAILY_CAP = {"leve": 3, "normal": 6, "intensa": 10}


def _hhmm(v: str) -> time:
    h, m = map(int, v.split(":"))
    return time(h, m)


class NotificationService:
    def __init__(self, db: Database, settings: Settings):
        self.db = db
        self.settings = settings

    def push(self, kind: str, title: str, body: str = "", *, dedupe_key: str | None = None,
             scheduled_for: datetime | None = None, action: dict | None = None) -> int | None:
        """Cria a notificação. Retorna None se a chave de deduplicação já existe."""
        if dedupe_key and self.db.one("SELECT 1 FROM notifications WHERE dedupe_key=?", (dedupe_key,)):
            return None
        return self.db.insert("notifications", dict(
            dedupe_key=dedupe_key, kind=kind, title=title, body=body, scheduled_for=clock.iso(scheduled_for),
            action_json=json.dumps(action or {}), created_at=clock.iso(clock.now())))

    # --- política ------------------------------------------------------------------
    def in_quiet_hours(self, now: datetime) -> bool:
        start, end = _hhmm(self.settings.get("quiet_start")), _hhmm(self.settings.get("quiet_end"))
        t = now.time()
        if start <= end:
            return start <= t < end
        return t >= start or t < end

    def paused(self, now: datetime) -> bool:
        until = clock.parse_dt(self.settings.get("notifications_paused_until"))
        return bool(until and now < until)

    def nudges_today(self, now: datetime) -> int:
        marks = ",".join("?" for _ in NUDGE_KINDS)
        row = self.db.one(f"SELECT COUNT(*) c FROM notifications WHERE kind IN ({marks}) AND substr(created_at,1,10)=?",
                          (*NUDGE_KINDS, now.date().isoformat()))
        return row["c"]

    def nudge_allowed(self, now: datetime) -> bool:
        cap = DAILY_CAP.get(self.settings.get("intensity"), 6)
        return self.nudges_today(now) < cap

    def delivery_mode(self, now: datetime) -> str:
        """toast = notificação do sistema; app = só na central; silencioso = guardada sem alerta."""
        if not self.settings.get("notifications_enabled") or self.paused(now):
            return "app"
        if self.in_quiet_hours(now):
            return "silencioso"
        return "toast"

    # --- entrega ----------------------------------------------------------------------
    def undelivered(self):
        return self.db.query("SELECT * FROM notifications WHERE shown_at IS NULL ORDER BY id")

    def mark_shown(self, notification_id: int, via: str) -> None:
        self.db.update("notifications", notification_id, dict(shown_at=clock.iso(clock.now()), delivered_via=via))

    def list(self, unread_only: bool = False, limit: int = 200):
        sql = "SELECT * FROM notifications"
        if unread_only:
            sql += " WHERE read_at IS NULL"
        return self.db.query(sql + " ORDER BY id DESC LIMIT ?", (limit,))

    def unread_count(self) -> int:
        return self.db.one("SELECT COUNT(*) c FROM notifications WHERE read_at IS NULL")["c"]

    def mark_read(self, notification_id: int) -> None:
        self.db.update("notifications", notification_id, dict(read_at=clock.iso(clock.now())))

    def mark_all_read(self) -> None:
        self.db.execute("UPDATE notifications SET read_at=? WHERE read_at IS NULL", (clock.iso(clock.now()),))

    def clear(self) -> None:
        self.db.execute("DELETE FROM notifications")

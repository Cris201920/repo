"""Relógio injetável: facilita testes e mantém uma única fonte de 'agora'."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Callable

_now_fn: Callable[[], datetime] = datetime.now


def now() -> datetime:
    return _now_fn().replace(microsecond=0)


def today() -> date:
    return now().date()


def set_clock(fn: Callable[[], datetime] | None) -> None:
    """Substitui o relógio (apenas testes). `None` restaura o relógio real."""
    global _now_fn
    _now_fn = fn or datetime.now


def iso(dt: datetime | date | None) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.replace(microsecond=0).isoformat(sep=" ")
    return dt.isoformat()


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def parse_date(value: str | None) -> date | None:
    dt = parse_dt(value)
    return dt.date() if dt else None


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


WEEKDAYS_PT = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]
WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
             "setembro", "outubro", "novembro", "dezembro"]


def fmt_date_long(d: date) -> str:
    return f"{WEEKDAYS_PT[d.weekday()]}, {d.day} de {MONTHS_PT[d.month - 1]} de {d.year}"


def fmt_minutes(minutes: float) -> str:
    minutes = int(round(minutes))
    h, m = divmod(minutes, 60)
    if h and m:
        return f"{h}h{m:02d}"
    if h:
        return f"{h}h"
    return f"{m} min"

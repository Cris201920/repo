"""Saudação construída apenas com dados que o app realmente consultou."""
from __future__ import annotations

from datetime import datetime

from .. import clock


def period_greeting(now: datetime) -> str:
    if 5 <= now.hour < 12:
        return "Bom dia"
    if 12 <= now.hour < 18:
        return "Boa tarde"
    return "Boa noite"


def build_greeting(ctx, now: datetime | None = None) -> str:
    now = now or clock.now()
    name = ctx.settings.get("user_name")
    parts = [f"{period_greeting(now)}, {name}. Seu sistema está operacional."]
    study = ctx.study
    if not ctx.settings.get("plan_start_date"):
        parts.append("Ainda não iniciamos seu plano de estudos — abra a Central de estudos e clique em \"Iniciar plano hoje\".")
    else:
        study.sync_days(now.date())
        s = study.ensure_session(now.date())
        if s is None:
            parts.append("Hoje não há sessão de estudos prevista no seu plano.")
        elif s["status"] in ("completed", "partial"):
            parts.append(f"Sua sessão de hoje ({s['discipline']}) está registrada e confirmada. Excelente.")
        elif s["status"] in ("running", "paused"):
            parts.append(f"Sua sessão de {s['discipline']} está em andamento.")
        elif s["status"] == "awaiting_confirmation":
            parts.append(f"A sessão de {s['discipline']} terminou, mas falta você confirmar o que foi feito.")
        else:
            start = clock.parse_dt(s["planned_start"])
            when = f" às {start:%H:%M}" if start else ""
            parts.append(f"Temos {clock.fmt_minutes(s['planned_minutes'])} reservadas para seus estudos{when}: {s['discipline']}.")
    pend = study.pending()
    pend = [p for p in pend if p["planned_date"] < now.date().isoformat()]
    if pend:
        parts.append(f"Há {len(pend)} sessão(ões) pendente(s) de dias anteriores.")
    late = ctx.tasks.overdue(now)
    if late:
        parts.append(f"{len(late)} tarefa(s) atrasada(s).")
    nxt = ctx.calendar.next_event(now)
    if nxt:
        st = clock.parse_dt(nxt["start_at"])
        day = "hoje" if st.date() == now.date() else f"em {st:%d/%m}"
        parts.append(f"Próximo compromisso: {nxt['title']}, {day} às {st:%H:%M}.")
    parts.append("Por onde deseja começar?")
    return " ".join(parts)

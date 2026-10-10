"""Central de estudos: ciclos, plano diário, sessões (cronômetro), pendências e propostas.

Regras invioláveis implementadas aqui:
- Uma sessão só vira 'completed'/'partial' via `confirm_checkout` (confirmação do usuário).
- Ao fim do cronômetro a sessão fica 'awaiting_confirmation' — nunca 'completed'.
- Sessões não iniciadas ficam 'missed' e permanecem visíveis como pendência até serem
  recuperadas, reagendadas ou dispensadas pelo usuário.
- A carga horária NUNCA muda sozinha: o sistema só cria uma 'proposta' que o usuário aceita ou recusa.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from .. import clock
from ..db import Database
from .settings import Settings

BLOCK_LABELS = {
    "lei_seca": "Lei seca", "teoria": "Teoria", "questoes": "Questões", "revisao": "Revisão",
    "erros": "Caderno de erros", "precedentes": "Súmulas e informativos", "simulado": "Simulado",
    "analise": "Análise do simulado", "planejamento": "Planejamento da semana",
    "recuperacao": "Recuperação", "flashcards": "Flashcards",
}
CONFIRMED = ("completed", "partial")
PENDING_STATES = ("missed", "awaiting_confirmation")


@dataclass
class PlanEntry:
    day: date
    cycle: int
    discipline: str
    lei_seca: str
    kind: str = "matinal"
    blocks: list[dict] = field(default_factory=list)
    minutes: int = 120
    start: datetime | None = None

    @property
    def end(self) -> datetime | None:
        return self.start + timedelta(minutes=self.minutes) if self.start else None


def scale_blocks(base: dict[str, int], total: int, break_minutes: int = 0) -> list[dict]:
    """Ajusta os blocos ao tempo total. Minutos extras vão para teoria (assuntos difíceis) e revisão."""
    names = list(base.keys())
    usable = max(total - (break_minutes if len(names) > 1 else 0), len(names))
    base_total = sum(base.values()) or 1
    if usable == base_total:
        mins = dict(base)
    elif usable > base_total:
        extra = usable - base_total
        mins = dict(base)
        targets = [n for n in ("teoria", "revisao") if n in mins] or [names[0]]
        for i, n in enumerate(targets):
            mins[n] += extra // len(targets) + (1 if i < extra % len(targets) else 0)
    else:
        mins = {n: max(1, round(v * usable / base_total)) for n, v in base.items()}
        diff = usable - sum(mins.values())
        biggest = max(mins, key=mins.get)
        mins[biggest] += diff
    blocks = [{"key": n, "label": BLOCK_LABELS.get(n, n), "minutes": mins[n], "done": None} for n in names]
    return blocks


class StudyService:
    def __init__(self, db: Database, settings: Settings):
        self.db = db
        self.settings = settings

    # ---------------------------------------------------------------- plano
    def _template(self, cycle: int) -> dict:
        templates = self.settings.get("cycle_templates") or {}
        return templates.get(str(cycle)) or {}

    def study_days(self) -> list[int]:
        return list(self.settings.get("study_days"))

    def plan_start(self, day: date) -> datetime:
        h, m = map(int, str(self.settings.get("study_start")).split(":"))
        return datetime.combine(day, datetime.min.time()).replace(hour=h, minute=m)

    def plan_for(self, day: date, cycle: int | None = None) -> PlanEntry | None:
        if day.weekday() not in self.study_days():
            return None
        cycle = cycle or int(self.settings.get("active_cycle"))
        entry = self._template(cycle).get(str(day.weekday()))
        if entry is None:
            return None
        disc = entry["disc"]
        if isinstance(disc, list):  # alternância semana ímpar/par (semana 1 = ímpar)
            week = self.cycle_week_on(day)
            disc = disc[0] if week % 2 == 1 else disc[1 % len(disc)]
        total = int(self.settings.get("study_minutes"))
        brk = int(self.settings.get("study_break_minutes"))
        if entry.get("simulado") and cycle in (1, 2):
            base = {"erros": 30, "simulado": 60, "analise": 30}
            kind = "simulado"
        elif entry.get("simulado") and cycle == 3:
            base = {"simulado": 90, "analise": 30}
            kind = "simulado"
        elif cycle == 3:
            base = {"lei_seca": 10, "questoes": 60, "precedentes": 25, "erros": 25}
            kind = "matinal"
        else:
            base = dict(self.settings.get("study_blocks"))
            kind = "matinal"
        if cycle == 3 and entry.get("disc", "").startswith("Análise"):
            base = {"analise": 60, "erros": 30, "planejamento": 30}
            kind = "matinal"
        blocks = scale_blocks(base, total, brk)
        return PlanEntry(day=day, cycle=cycle, discipline=disc, lei_seca=entry.get("lei", ""), kind=kind,
                         blocks=blocks, minutes=total, start=self.plan_start(day))

    def cycle_week_on(self, day: date) -> int:
        start = clock.parse_date(self.settings.get("plan_start_date")) or day
        base_week = int(self.settings.get("cycle_week"))
        weeks = (clock.monday_of(day) - clock.monday_of(start)).days // 7
        return max(1, base_week + weeks)

    def all_disciplines(self) -> list[str]:
        names: list[str] = []
        for c in (1, 2, 3):
            for e in self._template(c).values():
                d = e["disc"]
                for n in (d if isinstance(d, list) else [d]):
                    if n not in names and not n.startswith(("Revisão", "Análise", "Simulado")):
                        names.append(n)
        for n in self.settings.get("extra_disciplines") or []:
            if n not in names:
                names.append(n)
        return names

    def cycle_disciplines(self, cycle: int) -> list[str]:
        names: list[str] = []
        for e in self._template(cycle).values():
            d = e["disc"]
            for n in (d if isinstance(d, list) else [d]):
                if n not in names and not n.startswith(("Revisão", "Análise", "Simulado")):
                    names.append(n)
        return names

    def seed_disciplines(self) -> None:
        for cyc in (1, 2, 3):
            for n in self.cycle_disciplines(cyc):
                self.db.execute("INSERT OR IGNORE INTO disciplines(name, cycle) VALUES (?, ?)", (n, cyc))
        for n in self.settings.get("extra_disciplines") or []:
            self.db.execute("INSERT OR IGNORE INTO disciplines(name, cycle) VALUES (?, 2)", (n,))

    def set_lessons_done(self, discipline: str, done: bool) -> None:
        self.db.execute("INSERT OR IGNORE INTO disciplines(name, cycle) VALUES (?, 1)", (discipline,))
        self.db.execute("UPDATE disciplines SET lessons_done=? WHERE name=?", (1 if done else 0, discipline))

    # ---------------------------------------------------------------- sessões
    def start_plan(self, day: date | None = None) -> None:
        """Define o primeiro dia do plano (pendências só contam a partir daqui)."""
        if not self.settings.get("plan_start_date"):
            self.settings.set("plan_start_date", (day or clock.today()).isoformat())

    def ensure_session(self, day: date) -> dict | None:
        """Obtém (ou cria) a sessão matinal planejada do dia."""
        start = clock.parse_date(self.settings.get("plan_start_date"))
        if start is None or day < start:
            return None
        row = self.db.one(
            "SELECT * FROM study_sessions WHERE planned_date=? AND kind IN ('matinal','simulado') "
            "AND status != 'rescheduled' ORDER BY id LIMIT 1", (day.isoformat(),))
        if row:
            return dict(row)
        plan = self.plan_for(day)
        if plan is None:
            return None
        sid = self.db.insert("study_sessions", dict(
            planned_date=day.isoformat(), planned_start=clock.iso(plan.start), planned_minutes=plan.minutes,
            discipline=plan.discipline, topic=plan.lei_seca, cycle=plan.cycle, kind=plan.kind,
            blocks_json=json.dumps(plan.blocks, ensure_ascii=False), created_at=clock.iso(clock.now())))
        return dict(self.db.one("SELECT * FROM study_sessions WHERE id=?", (sid,)))

    def session(self, session_id: int) -> dict | None:
        row = self.db.one("SELECT * FROM study_sessions WHERE id=?", (session_id,))
        return dict(row) if row else None

    def blocks(self, session: dict) -> list[dict]:
        try:
            return json.loads(session.get("blocks_json") or "[]")
        except ValueError:
            return []

    def sync_days(self, upto: date | None = None) -> None:
        """Materializa sessões planejadas desde o início do plano até hoje e marca as perdidas."""
        start = clock.parse_date(self.settings.get("plan_start_date"))
        today = upto or clock.today()
        if start is None:
            return
        day = start
        while day <= today:
            self.ensure_session(day)
            day += timedelta(days=1)
        self.mark_missed(today)

    def mark_missed(self, today: date | None = None) -> int:
        today = today or clock.today()
        n = 0
        for r in self.db.query("SELECT * FROM study_sessions WHERE planned_date < ? AND status IN ('planned','running','paused')",
                               (today.isoformat(),)):
            if r["status"] == "planned":
                self.db.update("study_sessions", r["id"], dict(status="missed"))
            else:  # iniciada e abandonada: tempo parcial existe, mas não foi confirmado
                eff = self._effective(dict(r), until=None)
                self.db.update("study_sessions", r["id"], dict(
                    status="awaiting_confirmation", effective_seconds=eff, last_resume_at=None,
                    ended_at=r["ended_at"] or None))
            n += 1
        return n

    # cronômetro --------------------------------------------------------------
    def _effective(self, s: dict, until: datetime | None) -> int:
        eff = int(s.get("effective_seconds") or 0)
        if s["status"] == "running" and s.get("last_resume_at"):
            resumed = clock.parse_dt(s["last_resume_at"])
            end = until or resumed  # sem fim conhecido: não inventa tempo
            eff += max(0, int((end - resumed).total_seconds()))
        return eff

    def effective_seconds(self, session_id: int, now: datetime | None = None) -> int:
        s = self.session(session_id)
        return self._effective(s, now or clock.now()) if s else 0

    def start(self, session_id: int) -> dict:
        s = self.session(session_id)
        if s is None:
            raise ValueError("Sessão não encontrada.")
        if s["status"] in CONFIRMED:
            raise ValueError("Esta sessão já foi concluída e confirmada.")
        now = clock.now()
        fields = dict(status="running", last_resume_at=clock.iso(now))
        if not s["started_at"]:
            fields["started_at"] = clock.iso(now)
        if s["status"] in ("missed", "awaiting_confirmation"):  # retomada tardia
            fields["ended_at"] = None
        self.db.update("study_sessions", session_id, fields)
        return self.session(session_id)

    def pause(self, session_id: int) -> dict:
        s = self.session(session_id)
        if s is None or s["status"] != "running":
            raise ValueError("A sessão não está em andamento.")
        now = clock.now()
        eff = self._effective(s, now)
        self.db.update("study_sessions", session_id, dict(status="paused", effective_seconds=eff, last_resume_at=None))
        return self.session(session_id)

    def resume(self, session_id: int) -> dict:
        s = self.session(session_id)
        if s is None or s["status"] != "paused":
            raise ValueError("A sessão não está pausada.")
        self.db.update("study_sessions", session_id, dict(status="running", last_resume_at=clock.iso(clock.now())))
        return self.session(session_id)

    def set_block(self, session_id: int, index: int) -> None:
        self.db.update("study_sessions", session_id, dict(current_block=index))

    def stop_timer(self, session_id: int) -> dict:
        """Encerra o cronômetro. NÃO marca como concluída: aguarda confirmação do usuário."""
        s = self.session(session_id)
        if s is None:
            raise ValueError("Sessão não encontrada.")
        if s["status"] not in ("running", "paused"):
            raise ValueError("A sessão não está em andamento.")
        now = clock.now()
        eff = self._effective(s, now)
        self.db.update("study_sessions", session_id, dict(
            status="awaiting_confirmation", effective_seconds=eff, last_resume_at=None, ended_at=clock.iso(now)))
        return self.session(session_id)

    def confirm_checkout(self, session_id: int, *, blocks_done: dict[str, bool] | None = None,
                         questions_total: int | None = None, questions_correct: int | None = None,
                         difficulty: str = "", notes: str = "", effective_minutes: float | None = None,
                         topic: str | None = None) -> dict:
        """Check-out: registra o que o usuário CONFIRMOU. Status resultante:
        completed = todos os blocos confirmados; partial = parte deles; nenhum bloco → permanece pendente."""
        s = self.session(session_id)
        if s is None:
            raise ValueError("Sessão não encontrada.")
        if questions_total is not None and questions_correct is not None:
            if questions_total < 0 or questions_correct < 0 or questions_correct > questions_total:
                raise ValueError("Acertos não podem exceder o total de questões.")
        blocks = self.blocks(s)
        blocks_done = blocks_done or {}
        for b in blocks:
            if b["key"] in blocks_done:
                b["done"] = bool(blocks_done[b["key"]])
        confirmed = [b for b in blocks if b.get("done") is True]
        if not confirmed:
            status = "awaiting_confirmation"
        elif len(confirmed) == len(blocks):
            status = "completed"
        else:
            status = "partial"
        eff = self._effective(s, clock.now()) if s["status"] == "running" else int(s["effective_seconds"] or 0)
        if effective_minutes is not None:
            if effective_minutes < 0 or effective_minutes > 24 * 60:
                raise ValueError("Tempo efetivo inválido.")
            eff = int(effective_minutes * 60)
        now = clock.now()
        self.db.update("study_sessions", session_id, dict(
            status=status, effective_seconds=eff, last_resume_at=None,
            ended_at=s["ended_at"] or clock.iso(now), blocks_json=json.dumps(blocks, ensure_ascii=False),
            questions_total=questions_total, questions_correct=questions_correct, difficulty_note=difficulty,
            notes=notes, confirmed_at=clock.iso(now) if status in CONFIRMED else None,
            topic=topic if topic is not None else s["topic"]))
        if status in CONFIRMED and questions_total:
            self.db.insert("question_results", dict(
                date=s["planned_date"], discipline=s["discipline"] or "Geral", topic=s["topic"] or "",
                total=questions_total, correct=questions_correct or 0, source="sessao", session_id=session_id,
                created_at=clock.iso(now)))
        if s["recovery_of"] and status in CONFIRMED:
            self.db.update("study_sessions", s["recovery_of"], dict(status="rescheduled"))
        return self.session(session_id)

    def dismiss(self, session_id: int, note: str = "") -> None:
        self.db.update("study_sessions", session_id, dict(status="dismissed", notes=note))

    def add_manual_session(self, day: date, discipline: str, minutes: float, *, topic: str = "",
                           questions_total: int | None = None, questions_correct: int | None = None,
                           notes: str = "", kind: str = "extra") -> int:
        """Registro manual de um estudo já realizado (o usuário informa; fica marcado como manual)."""
        if minutes <= 0 or minutes > 24 * 60:
            raise ValueError("Duração inválida.")
        if questions_total is not None and questions_correct is not None and questions_correct > questions_total:
            raise ValueError("Acertos não podem exceder o total de questões.")
        now = clock.iso(clock.now())
        note = ("[registro manual] " + notes).strip()
        # Se o dia tinha a sessão planejada da MESMA disciplina ainda sem confirmação, o registro a resolve.
        planned = self.db.one(
            "SELECT * FROM study_sessions WHERE planned_date=? AND discipline=? AND kind IN ('matinal','simulado') "
            "AND status IN ('planned','missed','awaiting_confirmation') ORDER BY id LIMIT 1", (day.isoformat(), discipline))
        if planned is not None:
            full = minutes >= planned["planned_minutes"] * 0.9
            self.db.update("study_sessions", planned["id"], dict(
                status="completed" if full else "partial", effective_seconds=int(minutes * 60),
                topic=topic or planned["topic"], questions_total=questions_total, questions_correct=questions_correct,
                notes=note + ("" if full else " (menos que o tempo planejado; blocos não detalhados)"), confirmed_at=now, last_resume_at=None))
            sid = planned["id"]
        else:
            sid = self.db.insert("study_sessions", dict(
                planned_date=day.isoformat(), planned_minutes=int(minutes), discipline=discipline, topic=topic,
                kind=kind, status="completed", effective_seconds=int(minutes * 60), questions_total=questions_total,
                questions_correct=questions_correct, notes=note, confirmed_at=now, created_at=now, blocks_json="[]"))
        if questions_total:
            self.db.insert("question_results", dict(
                date=day.isoformat(), discipline=discipline, topic=topic, total=questions_total,
                correct=questions_correct or 0, source="manual", session_id=sid, created_at=now))
        return sid

    # ---------------------------------------------------------------- pendências
    def pending(self) -> list[dict]:
        rows = self.db.query(
            "SELECT * FROM study_sessions WHERE status IN ('missed','awaiting_confirmation') "
            "ORDER BY planned_date, id")
        return [dict(r) for r in rows]

    def partials(self) -> list[dict]:
        rows = self.db.query("SELECT * FROM study_sessions WHERE status='partial' ORDER BY planned_date DESC LIMIT 20")
        return [dict(r) for r in rows]

    def recovery_options(self, session_id: int, now: datetime | None = None, calendar=None) -> list[dict]:
        """Sempre 3 opções: hoje (se houver janela), próximo horário livre, sessão reduzida.
        Nunca acumula tudo no dia seguinte: um dia já com recuperação é ignorado."""
        s = self.session(session_id)
        if s is None:
            raise ValueError("Sessão não encontrada.")
        now = now or clock.now()
        minutes = min(int(s["planned_minutes"] or 120), 60)
        options = []
        # 1) hoje
        today_slot = None
        if calendar is not None:
            for a, b in calendar.free_slots(now.date(), minutes, window=(max(now.hour + 1, 6), 21)):
                if a >= now:
                    today_slot = a
                    break
        if today_slot:
            options.append(dict(key="hoje", label=f"Recuperar hoje às {today_slot:%H:%M} ({minutes} min)",
                                start=today_slot, minutes=minutes))
        else:
            options.append(dict(key="hoje", label="Hoje não há janela livre suficiente (considerando agenda e descanso)",
                                start=None, minutes=minutes, disabled=True))
        # 2) próximo horário livre sem outra recuperação
        day = now.date() + timedelta(days=1)
        for _ in range(14):
            has_rec = self.db.one("SELECT 1 FROM study_sessions WHERE kind='recuperacao' AND planned_date=? "
                                  "AND status NOT IN ('dismissed','rescheduled')", (day.isoformat(),))
            if not has_rec:
                plan = self.plan_for(day)
                if plan is not None:
                    start = plan.end + timedelta(minutes=15)  # após a sessão regular do dia
                else:
                    start = self.plan_start(day)
                if calendar is not None:
                    slots = calendar.free_slots(day, minutes, window=(5, 21))
                    later = [a for a, _ in slots if a >= start]
                    start = later[0] if later else (slots[0][0] if slots else None)
                if start:
                    options.append(dict(key="proximo", label=f"Reagendar para {start:%d/%m às %H:%M} ({minutes} min)",
                                        start=start, minutes=minutes))
                    break
            day += timedelta(days=1)
        # 3) reduzida
        reduced_start = self.plan_start(now.date() + timedelta(days=1)) + timedelta(hours=2, minutes=15)
        options.append(dict(key="reduzida", label="Sessão reduzida (lei seca + 10 questões + flashcards, 30 min)",
                            start=None, minutes=30, reduced=True))
        return options

    def create_recovery(self, session_id: int, option: dict) -> int:
        s = self.session(session_id)
        if s is None:
            raise ValueError("Sessão não encontrada.")
        if option.get("disabled"):
            raise ValueError("Esta opção não está disponível.")
        minutes = int(option["minutes"])
        if option.get("reduced"):
            blocks = scale_blocks({"lei_seca": 10, "questoes": 15, "flashcards": 5}, minutes)
        else:
            blocks = scale_blocks({"lei_seca": 10, "teoria": max(5, minutes - 25), "questoes": 15}, minutes)
        start = option.get("start") or self.plan_start(clock.today() + timedelta(days=1)) + timedelta(hours=2, minutes=15)
        sid = self.db.insert("study_sessions", dict(
            planned_date=start.date().isoformat(), planned_start=clock.iso(start), planned_minutes=minutes,
            discipline=s["discipline"], topic=s["topic"], cycle=s["cycle"], kind="recuperacao",
            blocks_json=json.dumps(blocks, ensure_ascii=False), recovery_of=session_id, created_at=clock.iso(clock.now())))
        return sid

    # ---------------------------------------------------------------- métricas
    def minutes_by_day(self, start: date, end: date, include_unconfirmed: bool = False) -> dict[date, float]:
        states = ("completed", "partial") + (("awaiting_confirmation",) if include_unconfirmed else ())
        marks = ",".join("?" for _ in states)
        rows = self.db.query(
            f"SELECT planned_date, SUM(effective_seconds) AS s FROM study_sessions WHERE planned_date BETWEEN ? AND ? "
            f"AND status IN ({marks}) GROUP BY planned_date", (start.isoformat(), end.isoformat(), *states))
        return {clock.parse_date(r["planned_date"]): (r["s"] or 0) / 60 for r in rows}

    def minutes_studied(self, day: date) -> float:
        """Minutos CONFIRMADOS no dia (sessão em andamento e não confirmada aparecem à parte)."""
        return self.minutes_by_day(day, day).get(day, 0.0)

    def live_minutes(self, day: date) -> float:
        row = self.db.one("SELECT * FROM study_sessions WHERE status='running' AND planned_date=?", (day.isoformat(),))
        return self._effective(dict(row), clock.now()) / 60 if row else 0.0

    def unconfirmed_minutes(self, day: date) -> float:
        row = self.db.one("SELECT SUM(effective_seconds) s FROM study_sessions WHERE planned_date=? AND status='awaiting_confirmation'",
                          (day.isoformat(),))
        return (row["s"] or 0) / 60

    def consistency(self, days: int = 14, today: date | None = None) -> dict:
        today = today or clock.today()
        start = max(today - timedelta(days=days - 1), clock.parse_date(self.settings.get("plan_start_date")) or today)
        rows = self.db.query(
            "SELECT status, COUNT(*) c FROM study_sessions WHERE planned_date BETWEEN ? AND ? "
            "AND kind IN ('matinal','simulado') GROUP BY status", (start.isoformat(), today.isoformat()))
        by = {r["status"]: r["c"] for r in rows}
        # o dia de hoje ainda pode ser cumprido: não conta como falha enquanto 'planned'
        today_row = self.db.one("SELECT status FROM study_sessions WHERE planned_date=? AND kind IN ('matinal','simulado')",
                                (today.isoformat(),))
        if today_row and today_row["status"] == "planned":
            by["planned"] = max(0, by.get("planned", 0) - 1)
        planned = sum(v for k, v in by.items() if k not in ("dismissed", "rescheduled"))
        done = by.get("completed", 0) + by.get("partial", 0) * 0.5
        return dict(planned=planned, completed=by.get("completed", 0), partial=by.get("partial", 0),
                    missed=by.get("missed", 0), awaiting=by.get("awaiting_confirmation", 0),
                    rate=(done / planned) if planned else None)

    def streak(self, today: date | None = None) -> int:
        """Dias consecutivos (até hoje/ontem) com sessão confirmada."""
        today = today or clock.today()
        rows = self.db.query("SELECT DISTINCT planned_date FROM study_sessions WHERE status IN ('completed','partial')")
        days = {clock.parse_date(r["planned_date"]) for r in rows}
        d = today if today in days else today - timedelta(days=1)
        n = 0
        while d in days:
            n += 1
            d -= timedelta(days=1)
        return n

    def pending_disciplines(self, today: date | None = None) -> list[str]:
        today = today or clock.today()
        out = []
        for s in self.pending():
            if s["discipline"] and s["discipline"] not in out:
                out.append(s["discipline"])
        t = self.db.one("SELECT * FROM study_sessions WHERE planned_date=? AND kind IN ('matinal','simulado') "
                        "AND status='planned'", (today.isoformat(),))
        if t and t["discipline"] not in out:
            out.append(t["discipline"])
        return out

    def not_studied_recently(self, days: int = 7, today: date | None = None) -> list[str]:
        today = today or clock.today()
        cutoff = (today - timedelta(days=days)).isoformat()
        out = []
        for name in self.cycle_disciplines(int(self.settings.get("active_cycle"))):
            row = self.db.one("SELECT 1 FROM study_sessions WHERE discipline=? AND planned_date>=? AND status IN ('completed','partial')",
                              (name, cutoff))
            if not row:
                out.append(name)
        return out

    # ---------------------------------------------------------------- propostas
    def evaluate_proposals(self, today: date | None = None) -> list[int]:
        """Cria PROPOSTAS (nunca aplica sozinho): aumento de carga e troca de ciclo."""
        today = today or clock.today()
        created = []
        pending_kinds = {r["kind"] for r in self.db.query("SELECT kind FROM proposals WHERE status='pending'")}
        recent_declined = self.db.one(
            "SELECT 1 FROM proposals WHERE kind='aumento_carga' AND status='declined' AND decided_at >= ?",
            (clock.iso(datetime.combine(today - timedelta(days=21), datetime.min.time())),))
        # aumento de carga
        c = self.consistency(14, today)
        acc = self.accuracy(today - timedelta(days=14), today)
        current = int(self.settings.get("study_minutes"))
        if ("aumento_carga" not in pending_kinds and not recent_declined and c["planned"] >= 10
                and c["rate"] is not None and c["rate"] >= 0.85 and (acc is None or acc >= 0.65) and current < 240):
            new = current + 15
            reason = (f"Nas últimas 2 semanas você confirmou {c['completed']} de {c['planned']} sessões planejadas "
                      f"({c['rate']:.0%} de cumprimento)"
                      + (f" e acertou {acc:.0%} das questões registradas" if acc is not None else "")
                      + f". Proponho subir de {current} para {new} minutos por sessão, usando o tempo extra em "
                        "assuntos difíceis e revisão. Você pode aceitar ou manter a carga atual.")
            created.append(self._propose("aumento_carga", {"study_minutes": new}, reason))
        # troca de ciclo
        cycle = int(self.settings.get("active_cycle"))
        if "troca_ciclo" not in pending_kinds:
            if cycle == 1:
                names = self.cycle_disciplines(1)
                rows = self.db.query("SELECT name FROM disciplines WHERE lessons_done=1")
                done = {r["name"] for r in rows}
                if names and all(n in done for n in names):
                    created.append(self._propose("troca_ciclo", {"active_cycle": 2},
                        "Você marcou como concluídas as aulas das cinco matérias-base. Proponho passar ao Ciclo 2 (Expansão), "
                        "mantendo questões das matérias do Ciclo 1."))
            exam = clock.parse_date(self.settings.get("exam_date"))
            if cycle in (1, 2) and exam and 0 <= (exam - today).days <= 60:
                created.append(self._propose("troca_ciclo", {"active_cycle": 3},
                    f"A prova ({self.settings.get('exam_name') or 'data informada'}) está a {(exam - today).days} dia(s). "
                    "Considere ativar o Ciclo 3 (Reta final) — mas concluir ciclos não significa dominar todo o conteúdo; "
                    "a decisão é sua."))
        return [c for c in created if c]

    def _propose(self, kind: str, payload: dict, reason: str) -> int | None:
        dup = self.db.one("SELECT 1 FROM proposals WHERE kind=? AND status='pending'", (kind,))
        if dup:
            return None
        return self.db.insert("proposals", dict(kind=kind, payload_json=json.dumps(payload), reason=reason,
                                                 created_at=clock.iso(clock.now())))

    def pending_proposals(self) -> list[dict]:
        return [dict(r) for r in self.db.query("SELECT * FROM proposals WHERE status='pending' ORDER BY id")]

    def decide_proposal(self, proposal_id: int, accept: bool) -> None:
        p = self.db.one("SELECT * FROM proposals WHERE id=?", (proposal_id,))
        if p is None or p["status"] != "pending":
            raise ValueError("Proposta não encontrada ou já decidida.")
        if accept:
            for k, v in json.loads(p["payload_json"]).items():
                self.settings.set(k, v)
        self.db.update("proposals", proposal_id, dict(status="accepted" if accept else "declined",
                                                      decided_at=clock.iso(clock.now())))

    def accuracy(self, start: date, end: date, discipline: str | None = None) -> float | None:
        sql = "SELECT SUM(total) t, SUM(correct) c FROM question_results WHERE date BETWEEN ? AND ?"
        params: list = [start.isoformat(), end.isoformat()]
        if discipline:
            sql += " AND discipline = ?"
            params.append(discipline)
        row = self.db.one(sql, params)
        if not row or not row["t"]:
            return None
        return row["c"] / row["t"]

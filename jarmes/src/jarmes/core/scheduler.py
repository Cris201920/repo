"""Gera as notificações devidas a cada 'tick' (o app chama a cada ~30 s enquanto o processo está ativo).

Importante: isto só funciona com o JARMES em execução (janela aberta ou na bandeja do sistema)."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from .. import clock
from ..db import Database
from .calendar import CalendarService
from .notifications import NotificationService
from .reviews import ErrorNotebook, FlashcardService, ReviewService
from .settings import Settings
from .study import StudyService
from .tasks import TaskService

log = logging.getLogger("jarmes.scheduler")


def pick(variants: list[str], seed: str) -> str:
    return variants[sum(ord(c) for c in seed) % len(variants)]


class Scheduler:
    def __init__(self, db: Database, settings: Settings, tasks: TaskService, calendar: CalendarService,
                 study: StudyService, notifier: NotificationService, flashcards: FlashcardService,
                 reviews: ReviewService, errors: ErrorNotebook):
        self.db, self.settings = db, settings
        self.tasks, self.calendar, self.study, self.notifier = tasks, calendar, study, notifier
        self.flashcards, self.reviews, self.errors = flashcards, reviews, errors

    def tick(self, now: datetime | None = None) -> list[int]:
        now = now or clock.now()
        created: list[int] = []
        for fn in (self._events, self._task_reminders, self._study_sequence, self._checkin, self._pending,
                   self._overdue_tasks, self._reviews_due, self._proposals, self._streak, self._weekly):
            try:
                created.extend(i for i in (fn(now) or []) if i)
            except Exception:
                log.exception("Falha ao gerar notificações em %s", fn.__name__)
        return created

    # --- compromissos e tarefas -----------------------------------------------------
    def _events(self, now: datetime) -> list[int]:
        out = []
        for ev in self.calendar.between(now - timedelta(hours=1), now + timedelta(hours=26)):
            start = clock.parse_dt(ev["start_at"])
            lead = timedelta(minutes=ev["remind_minutes"])
            if start - lead <= now < start + timedelta(minutes=10):
                mins = int((start - now).total_seconds() // 60)
                when = f"em {mins} min" if mins > 0 else "agora"
                out.append(self.notifier.push(
                    "compromisso", f"{ev['title']} — {when}", f"{start:%H:%M}" + (f" · {ev['location']}" if ev["location"] else ""),
                    dedupe_key=f"ev:{ev['id']}:{ev['start_at']}", scheduled_for=start - lead,
                    action={"page": "calendar"}))
        return out

    def _task_reminders(self, now: datetime) -> list[int]:
        out = []
        for t in self.tasks.due_reminders(now):
            out.append(self.notifier.push("tarefa", f"Lembrete: {t['title']}",
                                          f"Prazo: {t['due_at']}" if t["due_at"] else "",
                                          dedupe_key=f"taskrem:{t['id']}:{t['remind_at']}", scheduled_for=clock.parse_dt(t["remind_at"]),
                                          action={"page": "tasks"}))
        return out

    # --- sessão de estudos ------------------------------------------------------------
    def _study_sequence(self, now: datetime) -> list[int]:
        if not self.settings.get("plan_start_date"):
            return []
        s = self.study.ensure_session(now.date())
        if not s or s["status"] != "planned" or not s["planned_start"]:
            return []
        start = clock.parse_dt(s["planned_start"])
        name = self.settings.get("user_name")
        disc = s["discipline"]
        intensity = self.settings.get("intensity")
        steps = [("pre15", -15, f"Em 15 minutos: {disc}", "Deixe o material pronto. A sessão começa às " + f"{start:%H:%M}."),
                 ("t0", 0, f"{name}, é hora de estudar: {disc}",
                  pick([f"Sua sessão de {disc} estava programada para este horário. Deseja começar agora ou reorganizar a agenda?",
                        f"A sessão de {disc} está marcada para agora. Começamos?"], now.date().isoformat())),
                 ("p10", 10, f"{name}, sua sessão de {disc} ainda não começou", "Não há registro de início. Comece com apenas 5 minutos: abra a lei seca do dia."),
                 ("p30", 30, f"Sessão de {disc} sem início — marcada como pendente",
                  "Escolha: começar agora, fazer uma sessão reduzida ou reagendar. Posso propor a recuperação sem comprometer amanhã.")]
        if intensity == "leve":
            steps = [x for x in steps if x[0] in ("t0", "p30")]
        out = []
        for key, offset, title, body in steps:
            moment = start + timedelta(minutes=offset)
            # só dispara a etapa mais recente devida (evita rajada se o app estava fechado)
            if moment <= now < moment + timedelta(minutes=45 if key != "p30" else 240):
                later_due = [k for k, o, *_ in steps if o > offset and start + timedelta(minutes=o) <= now]
                if later_due:
                    continue
                out.append(self.notifier.push("estudo", title, body, dedupe_key=f"study:{s['id']}:{key}",
                                              scheduled_for=moment, action={"page": "study", "session_id": s["id"]}))
        return out

    def _checkin(self, now: datetime) -> list[int]:
        h, m = map(int, str(self.settings.get("daily_checkin_time")).split(":"))
        if now.time() < now.replace(hour=h, minute=m).time() or not self.settings.get("plan_start_date"):
            return []
        s = self.study.ensure_session(now.date())
        if not s or s["status"] in ("completed", "partial", "dismissed", "rescheduled"):
            return []
        if not self.notifier.nudge_allowed(now):
            return []
        text = "Você concluiu o estudo de hoje? Registre o tempo e os assuntos estudados para que eu possa acompanhar sua evolução."
        if s["status"] == "planned":
            text = "Vamos conferir o dia: sua sessão de hoje não tem registro. Quais etapas você cumpriu? Atualizo o plano com o que realmente foi feito."
        return [self.notifier.push("checkin", "Fechamento do dia", text, dedupe_key=f"checkin:{now.date()}",
                                   action={"page": "study", "session_id": s["id"]})]

    def _pending(self, now: datetime) -> list[int]:
        if now.hour < 7 or not self.settings.get("plan_start_date"):
            return []
        self.study.sync_days(now.date())
        pend = [p for p in self.study.pending() if p["planned_date"] < now.date().isoformat()]
        if not pend or not self.notifier.nudge_allowed(now):
            return []
        discs = ", ".join(dict.fromkeys(p["discipline"] for p in pend if p["discipline"]))
        n = len(pend)
        body = (f"Há {n} sessão(ões) pendente(s): {discs}. Podemos reagendá-las sem comprometer as prioridades de amanhã."
                if n < 4 else f"{n} sessões pendentes ({discs}). Vamos rever carga e horários antes de acumular mais.")
        return [self.notifier.push("pendencia", "Matéria pendente no seu plano", body, dedupe_key=f"pend:{now.date()}",
                                   action={"page": "study"})]

    def _overdue_tasks(self, now: datetime) -> list[int]:
        if now.hour < 8:
            return []
        self.tasks.record_overdue_seen(now)
        late = self.tasks.overdue(now)
        if not late or not self.notifier.nudge_allowed(now):
            return []
        names = "; ".join(t["title"] for t in late[:3])
        return [self.notifier.push("atrasadas", f"{len(late)} tarefa(s) atrasada(s)", names + (" …" if len(late) > 3 else ""),
                                   dedupe_key=f"overdue:{now.date()}", action={"page": "tasks"})]

    def _reviews_due(self, now: datetime) -> list[int]:
        if now.hour < 12:
            return []
        cards, revs, errs = self.flashcards.count_due(now.date()), len(self.reviews.due(now.date())), len(self.errors.due(now.date()))
        if not (cards or revs or errs) or not self.notifier.nudge_allowed(now):
            return []
        return [self.notifier.push("revisao", "Revisões esperando por você",
                                   f"{cards} flashcard(s), {revs} revisão(ões) de assunto e {errs} erro(s) do caderno para revisar hoje.",
                                   dedupe_key=f"rev:{now.date()}", action={"page": "study"})]

    def _proposals(self, now: datetime) -> list[int]:
        if not self.settings.get("plan_start_date"):
            return []
        self.study.evaluate_proposals(now.date())
        out = []
        for p in self.study.pending_proposals():
            if self.notifier.nudge_allowed(now):
                out.append(self.notifier.push("proposta", "Sugestão do JARMES aguardando sua decisão", p["reason"],
                                              dedupe_key=f"prop:{p['id']}", action={"page": "study"}))
        return out

    def _streak(self, now: datetime) -> list[int]:
        n = self.study.streak(now.date())
        if n in (3, 7, 14, 30, 60, 100) and self.notifier.nudge_allowed(now):
            return [self.notifier.push("sequencia", f"{n} dias seguidos de estudo confirmado",
                                       "Você vem mantendo uma sequência de estudos. Vamos revisar seu desempenho e definir a próxima meta.",
                                       dedupe_key=f"streak:{n}:{now.date()}", action={"page": "reports"})]
        return []

    def _weekly(self, now: datetime) -> list[int]:
        if now.weekday() != 6 or now.hour < 20 or not self.notifier.nudge_allowed(now):
            return []
        monday = clock.monday_of(now.date())
        return [self.notifier.push("relatorio", "Seu relatório semanal está pronto",
                                   "Abra Relatórios para ver cumprimento, horas registradas e desempenho.",
                                   dedupe_key=f"weekly:{monday}", action={"page": "reports"})]

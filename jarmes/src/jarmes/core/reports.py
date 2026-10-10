"""Relatórios calculados somente com registros reais. Dado ausente aparece como 'não registrado'."""
from __future__ import annotations

from datetime import date, timedelta

from .. import clock
from ..db import Database
from .study import StudyService

NR = "não registrado"
STATUS_LABEL = {"completed": "concluída (confirmada)", "partial": "parcial", "awaiting_confirmation": "sem confirmação",
                "missed": "não realizada", "planned": "planejada", "running": "em andamento", "paused": "pausada",
                "rescheduled": "reagendada", "dismissed": "dispensada"}


class ReportService:
    def __init__(self, db: Database, study: StudyService):
        self.db, self.study = db, study

    # --- agregados ----------------------------------------------------------------
    def accuracy_by_discipline(self, start: date, end: date) -> list[dict]:
        rows = self.db.query(
            "SELECT discipline, SUM(total) t, SUM(correct) c FROM question_results WHERE date BETWEEN ? AND ? "
            "GROUP BY discipline ORDER BY discipline", (start.isoformat(), end.isoformat()))
        return [dict(discipline=r["discipline"], total=r["t"], correct=r["c"], rate=r["c"] / r["t"] if r["t"] else None)
                for r in rows]

    def hardest_topics(self, start: date, end: date, min_questions: int = 5, limit: int = 5) -> list[dict]:
        rows = self.db.query(
            "SELECT discipline, topic, SUM(total) t, SUM(correct) c FROM question_results WHERE date BETWEEN ? AND ? "
            "AND topic != '' GROUP BY discipline, topic HAVING SUM(total) >= ? ORDER BY CAST(SUM(correct) AS REAL)/SUM(total) ASC LIMIT ?",
            (start.isoformat(), end.isoformat(), min_questions, limit))
        return [dict(discipline=r["discipline"], topic=r["topic"], total=r["t"], correct=r["c"], rate=r["c"] / r["t"]) for r in rows]

    def minutes_by_discipline(self, start: date, end: date) -> list[tuple[str, float]]:
        rows = self.db.query(
            "SELECT discipline, SUM(effective_seconds)/60.0 m FROM study_sessions WHERE planned_date BETWEEN ? AND ? "
            "AND status IN ('completed','partial') GROUP BY discipline ORDER BY m DESC", (start.isoformat(), end.isoformat()))
        return [(r["discipline"] or "Sem disciplina", r["m"] or 0.0) for r in rows]

    # --- relatório diário ----------------------------------------------------------
    def daily(self, day: date | None = None) -> dict:
        day = day or clock.today()
        sessions = [dict(r) for r in self.db.query(
            "SELECT * FROM study_sessions WHERE planned_date=? ORDER BY id", (day.isoformat(),))]
        planned = sum(s["planned_minutes"] or 0 for s in sessions if s["kind"] in ("matinal", "simulado"))
        confirmed = sum((s["effective_seconds"] or 0) for s in sessions if s["status"] in ("completed", "partial")) / 60
        unconfirmed = sum((s["effective_seconds"] or 0) for s in sessions if s["status"] == "awaiting_confirmation") / 60
        qt = sum(s["questions_total"] or 0 for s in sessions if s["status"] in ("completed", "partial"))
        qc = sum(s["questions_correct"] or 0 for s in sessions if s["status"] in ("completed", "partial"))
        any_q = any(s["questions_total"] is not None for s in sessions)
        recoveries = [dict(r) for r in self.db.query(
            "SELECT * FROM study_sessions WHERE kind='recuperacao' AND status IN ('planned','running','paused') ORDER BY planned_date")]
        tomorrow = day + timedelta(days=1)
        nxt = self.study.plan_for(tomorrow)
        return dict(day=day, sessions=sessions, planned_minutes=planned, confirmed_minutes=confirmed,
                    unconfirmed_minutes=unconfirmed, questions_total=qt if any_q else None,
                    questions_correct=qc if any_q else None, recoveries=recoveries,
                    pending=self.study.pending(), tomorrow=nxt)

    def daily_text(self, day: date | None = None) -> str:
        d = self.daily(day)
        lines = [f"Relatório diário — {clock.fmt_date_long(d['day'])}", ""]
        lines.append(f"Tempo planejado: {clock.fmt_minutes(d['planned_minutes']) if d['planned_minutes'] else NR}")
        lines.append(f"Tempo registrado (confirmado): {clock.fmt_minutes(d['confirmed_minutes']) if d['confirmed_minutes'] else NR}")
        if d["unconfirmed_minutes"]:
            lines.append(f"Tempo cronometrado sem confirmação: {clock.fmt_minutes(d['unconfirmed_minutes'])}")
        if d["questions_total"] is None:
            lines.append(f"Questões: {NR}")
        else:
            rate = f" ({d['questions_correct'] / d['questions_total']:.0%} de acerto)" if d["questions_total"] else ""
            lines.append(f"Questões: {d['questions_correct']}/{d['questions_total']}{rate}")
        lines.append("")
        if d["sessions"]:
            lines.append("Sessões:")
            for s in d["sessions"]:
                lines.append(f"  • {s['discipline'] or 'Sem disciplina'} — {STATUS_LABEL.get(s['status'], s['status'])}"
                             + (f" · {s['difficulty_note']}" if s["difficulty_note"] else ""))
        else:
            lines.append("Nenhuma sessão registrada para este dia.")
        if d["pending"]:
            lines.append("")
            lines.append("Pendências: " + "; ".join(f"{p['discipline']} ({p['planned_date']})" for p in d["pending"]))
        if d["recoveries"]:
            lines.append("Recuperações agendadas: " + "; ".join(f"{r['discipline']} em {r['planned_date']}" for r in d["recoveries"]))
        if d["tomorrow"]:
            lines.append("")
            lines.append(f"Prioridade de amanhã: {d['tomorrow'].discipline}.")
        return "\n".join(lines)

    # --- relatório semanal -----------------------------------------------------------
    def weekly(self, any_day: date | None = None) -> dict:
        monday = clock.monday_of(any_day or clock.today())
        sunday = monday + timedelta(days=6)
        today = clock.today()
        end = min(sunday, today)
        rows = self.db.query(
            "SELECT status, COUNT(*) c FROM study_sessions WHERE planned_date BETWEEN ? AND ? "
            "AND kind IN ('matinal','simulado') GROUP BY status", (monday.isoformat(), end.isoformat()))
        by = {r["status"]: r["c"] for r in rows}
        cons = self.study.consistency(7, end) if end >= monday else {}
        minutes = self.study.minutes_by_day(monday, sunday)
        total_min = sum(minutes.values())
        goal = int(self.study.settings.get("weekly_goal_minutes"))
        acc = self.accuracy_by_discipline(monday, sunday)
        qt = sum(a["total"] for a in acc)
        qc = sum(a["correct"] for a in acc)
        neglected = self.study.not_studied_recently(7, end)
        delays = self.db.query("SELECT COUNT(*) c FROM task_log WHERE event IN ('atrasada','concluida_com_atraso') AND substr(at,1,10) BETWEEN ? AND ?",
                               (monday.isoformat(), sunday.isoformat()))[0]["c"]
        simulados = [dict(r) for r in self.db.query(
            "SELECT * FROM question_results WHERE source='simulado' AND date BETWEEN ? AND ? ORDER BY date",
            (monday.isoformat(), sunday.isoformat()))]
        return dict(monday=monday, sunday=sunday, status=by, minutes_by_day=minutes, total_minutes=total_min,
                    goal_minutes=goal, accuracy=acc, questions_total=qt, questions_correct=qc, neglected=neglected,
                    delays=delays, simulados=simulados, hardest=self.hardest_topics(monday, sunday),
                    by_discipline=self.minutes_by_discipline(monday, sunday), consistency=cons,
                    streak=self.study.streak(end))

    def weekly_text(self, any_day: date | None = None) -> str:
        w = self.weekly(any_day)
        st = w["status"]
        planned = sum(v for k, v in st.items() if k not in ("dismissed", "rescheduled", "planned"))
        lines = [f"Relatório semanal — {w['monday']:%d/%m} a {w['sunday']:%d/%m/%Y}", ""]
        if planned:
            lines.append(f"Sessões: {st.get('completed', 0)} concluídas, {st.get('partial', 0)} parciais, "
                         f"{st.get('missed', 0)} não realizadas, {st.get('awaiting_confirmation', 0)} sem confirmação.")
        else:
            lines.append(f"Sessões: {NR}.")
        goal_txt = f" de {clock.fmt_minutes(w['goal_minutes'])} (meta)" if w["goal_minutes"] else ""
        lines.append(f"Horas registradas: {clock.fmt_minutes(w['total_minutes']) if w['total_minutes'] else NR}{goal_txt}")
        if w["questions_total"]:
            lines.append(f"Questões: {w['questions_correct']}/{w['questions_total']} ({w['questions_correct'] / w['questions_total']:.0%})")
        else:
            lines.append(f"Questões: {NR}")
        for a in w["accuracy"]:
            lines.append(f"  • {a['discipline']}: {a['correct']}/{a['total']} ({a['rate']:.0%})")
        if w["hardest"]:
            lines.append("Assuntos com menor acerto: " + "; ".join(f"{h['discipline']} — {h['topic']} ({h['rate']:.0%})" for h in w["hardest"]))
        if w["neglected"]:
            lines.append("Disciplinas do ciclo sem estudo confirmado nos últimos 7 dias: " + ", ".join(w["neglected"]))
        lines.append(f"Atrasos de tarefas registrados: {w['delays']}")
        lines.append(f"Sequência atual: {w['streak']} dia(s)")
        lines += ["", "Próxima ação: escolha uma disciplina negligenciada ou o assunto de menor acerto e agende 25 minutos para ele nos próximos dois dias."
                  if (w["neglected"] or w["hardest"]) else "Próxima ação: registre as sessões da semana para que o próximo relatório seja completo."]
        return "\n".join(lines)

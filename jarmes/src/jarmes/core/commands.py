"""Interpretador de comandos em linguagem natural (texto e voz).

Princípios:
- Comandos são reconhecidos por regras locais e determinísticas; a IA NUNCA dispara ações.
- Toda ação que cria compromissos conflitantes, apaga dados ou envia algo exige confirmação explícita.
- A resposta só afirma o que foi realmente feito (confirmado pelo retorno do serviço)."""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable

from .. import clock
from ..ai.provider import AIUnavailable, ChatMessage
from .greeting import build_greeting
from .nlp import find_disciplines, norm, parse_date, parse_duration_minutes, parse_time

log = logging.getLogger("jarmes.commands")

YES = {"sim", "confirmo", "confirmar", "confirma", "pode", "pode criar", "ok", "isso", "claro", "faca", "faça", "s"}
NO = {"nao", "não", "cancelar", "cancela", "deixa", "esquece", "n", "melhor nao"}


@dataclass
class PendingAction:
    description: str
    execute: Callable[[], str]


@dataclass
class Reply:
    text: str
    spoken: str | None = None
    navigate: str | None = None
    nav_arg: object = None
    pending: PendingAction | None = None
    handled_by: str = "local"          # local | ia | indisponivel


class CommandProcessor:
    def __init__(self, ctx):
        self.ctx = ctx
        self.pending: PendingAction | None = None

    # ------------------------------------------------------------------ entrada
    def handle(self, text: str) -> Reply:
        raw = (text or "").strip()
        if not raw:
            return Reply("Não ouvi nenhum comando. Diga, por exemplo: \"organize meu dia\".")
        t = norm(raw)
        t = re.sub(r"^(jarmes|jarvis)[,:!\s]+", "", t).strip()
        try:
            if self.pending is not None:
                answer = self._answer_pending(t)
                if answer is not None:
                    return answer
            for name, matcher in self._routes():
                m = matcher(t, raw)
                if m is not None:
                    return m
            return self._fallback(raw, t)
        except Exception:  # noqa: BLE001 — o chat nunca deve derrubar o app
            log.exception("Erro ao processar comando")
            return Reply("Tive um problema interno ao executar isso. O erro foi registrado no log; nenhum dado foi alterado "
                         "de forma parcial. Tente reformular o pedido.")

    def _answer_pending(self, t: str) -> Reply | None:
        pending = self.pending
        if t in YES or t.startswith(("sim", "confirm")):
            self.pending = None
            return Reply(pending.execute())
        if t in NO or t.startswith(("nao", "cancel")):
            self.pending = None
            return Reply("Certo, cancelei. Nada foi alterado.")
        return None  # outra mensagem: o pendente continua aguardando (e o novo comando é tratado)

    def confirm(self) -> Reply:
        return self.handle("sim") if self.pending else Reply("Não há nada aguardando confirmação.")

    def cancel(self) -> Reply:
        return self.handle("não") if self.pending else Reply("Não há nada aguardando confirmação.")

    # ------------------------------------------------------------------ rotas
    def _routes(self):
        return [
            ("saudacao", self._greeting), ("ajuda", self._help), ("registro", self._log_study),
            ("organizar_estudos", self._organize_study), ("organizar_dia", self._organize_day),
            ("iniciar", self._start_study), ("atrasadas", self._overdue_subjects), ("abrir_materiais", self._open_materials),
            ("perguntas", self._make_questions), ("resumo", self._summarize), ("desempenho", self._performance),
            ("relatorio_dia", self._daily_report), ("concursos", self._contests), ("tarefa", self._create_task),
            ("compromisso", self._create_event), ("revisao", self._schedule_review), ("agenda", self._agenda),
            ("lembrar", self._remember), ("esquecer", self._forget), ("noticias", self._news), ("flashcards", self._flashcards),
            ("limpar", self._clear_history),
        ]

    # ------------------------------------------------------------------ comandos
    def _greeting(self, t, raw):
        if re.fullmatch(r"(bom dia|boa tarde|boa noite|ola|oi|e ai)[\s,]*(jarmes)?[\s.!]*", t):
            return Reply(build_greeting(self.ctx))
        return None

    def _help(self, t, raw):
        if re.search(r"\b(ajuda|o que voce (faz|sabe|pode)|comandos)\b", t):
            return Reply("Posso, entre outras coisas:\n"
                         "• \"iniciar sessão de estudos\" · \"quais matérias estão atrasadas?\" · \"organize meu dia\"\n"
                         "• \"organize meus estudos de amanhã e reserve duas horas para Direito Constitucional e Direito Penal\"\n"
                         "• \"crie uma tarefa: revisar processo civil amanhã às 15h\" · \"marque compromisso dentista dia 20 às 14h\"\n"
                         "• \"registre que estudei 2 horas de Direito Penal, 20 questões, 15 acertos\"\n"
                         "• \"mostre meu desempenho da semana\" · \"relatório de hoje\" · \"programe uma revisão para amanhã\"\n"
                         "• \"abra meus materiais de Direito Penal\" · \"faça um resumo deste PDF\" · \"crie dez perguntas sobre direitos humanos\"\n"
                         "• \"quais concursos jurídicos tiveram atualizações oficiais?\" · \"anote que prefiro estudar cedo\"\n"
                         "Perguntas livres de Direito dependem da IA estar configurada.")
        return None

    def _start_study(self, t, raw):
        if not re.search(r"\b(iniciar|comecar|começar|inicie|comece|vamos)\b.*\b(estud|sessao)|modo estudo|\bbora estudar\b", t):
            return None
        c = self.ctx
        c.study.start_plan()
        s = c.study.ensure_session(clock.today())
        if s is None:
            return Reply("Hoje não há sessão prevista no plano (dia fora da sua agenda de estudos). "
                         "Se quiser estudar mesmo assim, registre uma sessão extra na Central de estudos.")
        if s["status"] in ("completed", "partial"):
            return Reply(f"A sessão de hoje ({s['discipline']}) já está registrada e confirmada.", navigate="study")
        if s["status"] == "running":
            return Reply(f"A sessão de {s['discipline']} já está em andamento.", navigate="study")
        s = c.study.start(s["id"])
        blocks = c.study.blocks(s)
        resumo = " · ".join(f"{b['label']} {b['minutes']} min" for b in blocks)
        return Reply(f"Sessão iniciada agora ({clock.now():%H:%M}): {s['discipline']}. Roteiro: {resumo}. "
                     "Acompanhe o cronômetro na Central de estudos; ao terminar, confirmo com você o que foi cumprido.",
                     navigate="study")

    def _overdue_subjects(self, t, raw):
        if not re.search(r"(materia|disciplina|sessao|sessoes|estudo).*(atrasad|pendent)|(atrasad|pendent).*(materia|disciplina|sessao|estudo)|\bpendencias\b|quais.*atrasad", t):
            return None
        c = self.ctx
        c.study.sync_days()
        pend = c.study.pending()
        late = c.tasks.overdue()
        lines = []
        if pend:
            lines.append("Sessões pendentes (não confirmadas):")
            lines += [f"• {p['discipline']} — {p['planned_date']} ({'sem confirmação' if p['status'] == 'awaiting_confirmation' else 'não realizada'})" for p in pend]
        else:
            lines.append("Nenhuma sessão de estudo pendente registrada.")
        if late:
            lines.append("Tarefas atrasadas:")
            lines += [f"• {x['title']} (prazo {x['due_at']})" for x in late[:8]]
        if pend:
            lines.append("Próxima ação: abra a Central de estudos → Pendências para recuperar, reagendar ou fazer uma sessão reduzida.")
        return Reply("\n".join(lines), navigate="study" if pend else None)

    def _organize_day(self, t, raw):
        if not re.search(r"(organiz|planej|monte|arrume).*\b(meu dia|dia de hoje|o dia|minha agenda de hoje|meu hoje)\b|\borganize meu dia\b", t):
            return None
        c = self.ctx
        now = clock.now()
        day = parse_date(t, now.date()) or now.date()
        events = c.calendar.on_day(day)
        tasks = c.tasks.due_on(day)
        late = c.tasks.overdue(now) if day == now.date() else []
        s = c.study.ensure_session(day) if c.settings.get("plan_start_date") else None
        lines = [f"Plano para {clock.fmt_date_long(day)}:"]
        timeline = []
        for e in events:
            timeline.append((clock.parse_dt(e["start_at"]), f"{clock.parse_dt(e['start_at']):%H:%M}–{clock.parse_dt(e['end_at']):%H:%M} {e['title']}"))
        if s and s["planned_start"]:
            st = clock.parse_dt(s["planned_start"])
            timeline.append((st, f"{st:%H:%M}–{st + timedelta(minutes=s['planned_minutes']):%H:%M} Estudo: {s['discipline']}"))
        elif not c.settings.get("plan_start_date"):
            lines.append("(Plano de estudos ainda não iniciado.)")
        for _, line in sorted(timeline, key=lambda x: x[0]):
            lines.append("• " + line)
        if not timeline:
            lines.append("• Nenhum compromisso ou sessão cadastrada.")
        if tasks or late:
            lines.append("Tarefas:")
            lines += [f"  – {x['title']} (prio. {x['priority']})" for x in tasks]
            lines += [f"  – ATRASADA: {x['title']}" for x in late[:5]]
        free = c.calendar.free_slots(day, 60)
        if free:
            a, b = free[0]
            lines.append(f"Maior janela livre inicial: {a:%H:%M}–{b:%H:%M}. Sugiro manter pelo menos 20% do dia livre.")
        lines.append("Próxima ação: " + (f"começar {s['discipline']} no horário marcado." if s else "defina a prioridade número 1 do dia."))
        return Reply("\n".join(lines))

    def _organize_study(self, t, raw):
        if not re.search(r"(organiz|planej|reserv|agend|bloque).*(estud|direito|materia)|reserve .*(hora|min)", t):
            return None
        c = self.ctx
        now = clock.now()
        day = parse_date(t, now.date())
        if day is None:
            return Reply("Para qual dia devo organizar? Diga, por exemplo, \"amanhã\", \"sexta\" ou \"15/10\".")
        discs = find_disciplines(t, c.study.all_disciplines())
        minutes = parse_duration_minutes(t) or int(c.settings.get("study_minutes"))
        if not discs:
            plan = c.study.plan_for(day)
            if plan is None:
                return Reply(f"Não há disciplina prevista no ciclo para {clock.fmt_date_long(day)} e você não citou nenhuma. Diga quais matérias estudar.")
            discs = [plan.discipline]
        start = c.study.plan_start(day)
        h = parse_time(t)
        if h:
            start = start.replace(hour=h[0], minute=h[1])
        per = max(15, minutes // len(discs))
        blocks, cur = [], start
        for d in discs:
            blocks.append((d, cur, cur + timedelta(minutes=per)))
            cur += timedelta(minutes=per)
        conflicts = []
        for d, a, b in blocks:
            conflicts += [(d, e) for e in c.calendar.conflicts(a, b)]
        lines = [f"Proposta para {clock.fmt_date_long(day)} — {clock.fmt_minutes(per * len(discs))} no total:"]
        lines += [f"• {a:%H:%M}–{b:%H:%M}  {d}" for d, a, b in blocks]
        if conflicts:
            lines.append("⚠ Conflito com: " + "; ".join(f"{e['title']} ({clock.parse_dt(e['start_at']):%H:%M})" for _, e in conflicts))
        lines.append("Posso criar esses compromissos na agenda? Responda \"sim\" para confirmar ou \"não\" para cancelar.")

        def execute():
            ids = [c.calendar.add(f"Estudo: {d}", a, b, kind="estudo", discipline=d, remind_minutes=15) for d, a, b in blocks]
            return f"Pronto: criei {len(ids)} compromisso(s) de estudo em {day:%d/%m}: " + ", ".join(d for d, _, _ in blocks) + "."

        self.pending = PendingAction("criar blocos de estudo", execute)
        return Reply("\n".join(lines), pending=self.pending, navigate="calendar" if False else None)

    def _open_materials(self, t, raw):
        if not re.search(r"\b(abra|abrir|mostre|mostrar|ver|quero)\b.*\b(material|materiais|apostila|documento|arquivo)", t):
            return None
        discs = find_disciplines(t, self.ctx.study.all_disciplines())
        docs = self.ctx.documents.list(discs[0] if discs else None)
        if not docs:
            where = f" de {discs[0]}" if discs else ""
            return Reply(f"Não há documentos{where} importados ainda. Use Arquivos → Importar (PDF, DOCX, TXT, MD ou imagem).",
                         navigate="documents")
        lines = [f"Encontrei {len(docs)} documento(s){' de ' + discs[0] if discs else ''}:"]
        lines += [f"• {d['name']} ({d['pages']} {'páginas' if d['ext'] == '.pdf' else 'trechos'}, {d['read_status']})" for d in docs[:10]]
        return Reply("\n".join(lines), navigate="documents", nav_arg=discs[0] if discs else None)

    def _make_questions(self, t, raw):
        m = re.search(r"\b(crie|criar|gere|gerar|elabore|elaborar|faca|fazer)\b.*\b(perguntas?|questoes|questao|flashcards?|simulado)\b", t)
        if not m or "resumo" in t:
            return None
        c = self.ctx
        n = 10
        mnum = re.search(r"\b(\d{1,2})\b", t)
        words = {"cinco": 5, "dez": 10, "quinze": 15, "vinte": 20, "tres": 3, "oito": 8}
        if mnum:
            n = int(mnum.group(1))
        else:
            for w, v in words.items():
                if re.search(rf"\b{w}\b", t):
                    n = v
        n = max(1, min(n, 20))
        topic_m = re.search(r"\b(?:sobre|de|do|da|acerca de)\s+(.+)$", raw.strip().rstrip("."), re.IGNORECASE)
        topic = topic_m.group(1).strip() if topic_m else "o assunto atual do plano"
        kind = "flashcards" if "flashcard" in t else "questões de múltipla escolha"
        client = c.assistant.client()
        if not client.available:
            return Reply(f"Não consigo gerar {kind} sobre \"{topic}\" agora: {client.status()[1]}\n"
                         "Alternativas que funcionam offline: importe um material em Arquivos e use \"Gerar flashcards (local)\", "
                         "ou cadastre seus próprios cartões/erros na Central de estudos.", handled_by="indisponivel")
        prompt = (f"Crie {n} {kind} em português do Brasil sobre: {topic}. Nível de concurso jurídico/ENAM. "
                  "Responda SOMENTE com JSON válido no formato "
                  + ('[{"front": "...", "back": "..."}]' if kind == "flashcards" else
                     '[{"statement":"...","options":["A) ...","B) ...","C) ...","D) ...","E) ..."],"answer_index":0,"explanation":"..."}]')
                  + ". Não cite número de artigo, súmula ou julgado se não tiver certeza absoluta; prefira explicar o conceito.")
        try:
            out = client.chat(c.assistant.build_system(prompt), [ChatMessage("user", prompt)], max_tokens=3000)
        except AIUnavailable as exc:
            return Reply(str(exc), handled_by="indisponivel")
        data = _extract_json(out)
        disc = (find_disciplines(topic, c.study.all_disciplines()) or ["Geral"])[0]
        if not isinstance(data, list) or not data:
            return Reply("A IA respondeu em um formato que não consegui interpretar, então nada foi salvo. Resposta bruta:\n\n" + out[:1500],
                         handled_by="ia")
        saved = 0
        if kind == "flashcards":
            for it in data:
                if isinstance(it, dict) and it.get("front") and it.get("back"):
                    c.flashcards.add(str(it["front"]), str(it["back"]), disc, source="ia")
                    saved += 1
            return Reply(f"Criei {saved} flashcards sobre \"{topic}\" (origem: IA — confira o conteúdo antes de confiar). "
                         "Eles já estão na fila de revisão.", handled_by="ia", navigate="study")
        lines = []
        for it in data:
            if isinstance(it, dict) and it.get("statement") and isinstance(it.get("options"), list):
                c.db.insert("question_bank", dict(discipline=disc, topic=topic, statement=str(it["statement"]),
                                                   options_json=json.dumps(it["options"], ensure_ascii=False),
                                                   answer_index=it.get("answer_index"), explanation=str(it.get("explanation", "")),
                                                   source="ia", created_at=clock.iso(clock.now())))
                saved += 1
                lines.append(f"{saved}. {it['statement']}\n   " + "\n   ".join(map(str, it["options"])))
        return Reply(f"Gerei {saved} questões sobre \"{topic}\" (IA — não são questões oficiais; confira o gabarito). "
                     "Foram salvas no banco de questões para o simulado.\n\n" + "\n\n".join(lines[:n]), handled_by="ia")

    def _summarize(self, t, raw):
        if not re.search(r"\b(resum[aeoi]\w*|sintetize|sintese)\b", t):
            return None
        c = self.ctx
        doc_id = c.selected_doc_id
        if doc_id is None:
            row = c.db.one("SELECT id FROM documents ORDER BY id DESC LIMIT 1")
            doc_id = row["id"] if row else None
        if doc_id is None:
            return Reply("Não há documento importado. Importe um PDF, DOCX, TXT ou MD em Arquivos e peça novamente.", navigate="documents")
        doc = c.documents.get(doc_id)
        if doc["read_status"] == "unreadable":
            return Reply(f"Não consegui ler \"{doc['name']}\": {doc['warnings']}", navigate="documents")
        warn = f"\n⚠ {doc['warnings']}" if doc["warnings"] else ""
        client = c.assistant.client()
        if client.available and c.settings.get("ai_docs_consent"):
            try:
                text = c.assistant.generate("Resuma o documento em tópicos objetivos, citando a página entre colchetes quando possível. "
                                            "Não acrescente informações que não estejam no texto.",
                                            c.documents.text(doc_id, 24000), name=doc["name"])
                c.documents.save_derived(doc_id, "resumo", text, f"ia:{client.model}")
                return Reply(f"Resumo de \"{doc['name']}\" (gerado por IA a partir do texto do documento):\n\n{text}{warn}", handled_by="ia")
            except AIUnavailable as exc:
                note = f"(IA indisponível: {exc} Usei o resumo local.)\n\n"
        else:
            note = ("(IA não autorizada/configurada para documentos — usei o resumo extrativo local, sem enviar nada para fora.)\n\n")
        return Reply(f"{note}Documento: {doc['name']}\n{c.documents.local_summary(doc_id)}{warn}")

    def _performance(self, t, raw):
        if not re.search(r"\b(desempenho|rendimento|resultado|relatorio)\b.*\b(semana|semanal)\b|\b(semana|semanal)\b.*\b(desempenho|relatorio)|relatorio semanal", t):
            return None
        return Reply(self.ctx.reports.weekly_text(), navigate="reports")

    def _daily_report(self, t, raw):
        if re.search(r"(relatorio|resumo)\b.*\b(diario|do dia|de hoje|hoje)|\bmeu dia foi\b|como foi (meu|o) dia", t):
            return Reply(self.ctx.reports.daily_text(), navigate="reports")
        return None

    def _contests(self, t, raw):
        if not re.search(r"concurso|edital|enam|magistratura", t) or not re.search(r"atualiza|novidade|noticia|oficial|tiveram|saiu|abert", t):
            return None
        items = self.ctx.integrations.news.official_contest_updates(14)
        if not items:
            last = self.ctx.db.one("SELECT MAX(last_ok) m FROM news_sources")["m"]
            msg = "Não há atualizações oficiais de concursos registradas nos últimos 14 dias."
            msg += (f" (última atualização bem-sucedida de fontes: {last})" if last else
                    " Nenhuma fonte foi atualizada ainda: abra Notícias → Atualizar (requer internet e feeds configurados).")
            return Reply(msg + "\nNão confirmado ≠ inexistente: confira o site oficial do órgão/banca.", navigate="news", handled_by="local")
        lines = ["Atualizações de fontes oficiais (últimos 14 dias, conforme os feeds cadastrados):"]
        for i in items[:8]:
            lines.append(f"• [{i['category']}] {i['title']} — {i['source_name']}, {i['published_at'] or 'data não informada'}\n  {i['url']}")
        lines.append("Confirme prazos e requisitos sempre no edital oficial.")
        return Reply("\n".join(lines), navigate="news")

    def _schedule_review(self, t, raw):
        if not re.search(r"(programe|agende|marque|crie|agendar|programar)\b.*\brevis", t) or "tarefa" in t:
            return None
        c = self.ctx
        day = parse_date(t, clock.today()) or clock.today() + timedelta(days=1)
        discs = find_disciplines(t, c.study.all_disciplines())
        if not discs:
            last = c.db.one("SELECT discipline FROM study_sessions WHERE status IN ('completed','partial') ORDER BY planned_date DESC, id DESC LIMIT 1")
            discs = [last["discipline"]] if last and last["discipline"] else []
        if not discs:
            return Reply("De qual matéria é a revisão? Diga, por exemplo, \"programe uma revisão de Direito Penal para amanhã\".")
        rid = c.db.insert("reviews", dict(kind="topic", discipline=discs[0], topic="Revisão programada por comando", stage=1,
                                           due_date=day.isoformat(), created_at=clock.iso(clock.now())))
        tid = c.tasks.add(f"Revisão: {discs[0]}", due=datetime.combine(day, datetime.min.time()).replace(hour=19), priority=2,
                          discipline=discs[0], source="comando", remind_at=datetime.combine(day, datetime.min.time()).replace(hour=18, minute=30))
        return Reply(f"Revisão de {discs[0]} programada para {day:%d/%m}: criei a revisão #{rid} e a tarefa #{tid} (lembrete às 18:30, "
                     "enquanto o JARMES estiver em execução).")

    def _agenda(self, t, raw):
        if not re.search(r"(o que tenho|minha agenda|meus compromissos|proximo compromisso|qual (e )?meu proximo|compromissos (de )?(hoje|amanha))", t):
            return None
        c = self.ctx
        now = clock.now()
        if "proximo" in t:
            e = c.calendar.next_event(now)
            return Reply(f"Próximo compromisso: {e['title']} em {clock.parse_dt(e['start_at']):%d/%m às %H:%M}." if e else "Não há compromissos futuros cadastrados.")
        day = parse_date(t, now.date()) or now.date()
        ev = c.calendar.on_day(day)
        if not ev:
            return Reply(f"Nenhum compromisso cadastrado para {clock.fmt_date_long(day)}.")
        return Reply(f"Agenda de {clock.fmt_date_long(day)}:\n" + "\n".join(
            f"• {clock.parse_dt(e['start_at']):%H:%M}–{clock.parse_dt(e['end_at']):%H:%M} {e['title']}" for e in ev), navigate="calendar")

    def _create_task(self, t, raw):
        m = re.match(r"^(?:crie|criar|adicione|adicionar|nova|anote)\s+(?:uma\s+)?tarefa\s*[:\-]?\s*(.+)$", raw.strip(), re.IGNORECASE) or \
            re.match(r"^(?:lembre-?me|me lembre)\s+(?:de|para)\s+(.+)$", raw.strip(), re.IGNORECASE)
        if not m:
            return None
        body = m.group(1).strip()
        now = clock.now()
        day = parse_date(body, now.date())
        hm = parse_time(body)
        title = re.sub(r"\b(hoje|amanh[ãa]|depois de amanh[ãa]|dia \d{1,2}|\d{1,2}/\d{1,2}(/\d{2,4})?|às? \d{1,2}(h|:)\d{0,2}h?|\bàs? \d{1,2} ?h(oras)?)\b", "", body, flags=re.IGNORECASE)
        title = re.sub(r"\s+", " ", title).strip(" ,.-") or body
        due = None
        if day or hm:
            day = day or now.date()
            hh, mm = hm or (18, 0)
            due = datetime.combine(day, datetime.min.time()).replace(hour=hh, minute=mm)
        prio = 1 if re.search(r"\b(urgente|prioridade alta|importante)\b", norm(body)) else 2
        remind = (due - timedelta(minutes=30)) if due and due > now + timedelta(minutes=30) else None
        tid = self.ctx.tasks.add(title, due=due, priority=prio, remind_at=remind, source="comando")
        when = f" para {due:%d/%m às %H:%M}" if due else " (sem prazo)"
        rem = f"; lembrete às {remind:%H:%M}" if remind else ""
        return Reply(f"Tarefa #{tid} criada: \"{title}\"{when}{rem}.", navigate="tasks")

    def _create_event(self, t, raw):
        m = re.match(r"^(?:marque|agende|crie|adicione|cadastre)\s+(?:um\s+|uma\s+)?(?:compromisso|reuniao|reunião|consulta|evento)\s*[:\-]?\s*(.+)$", raw.strip(), re.IGNORECASE)
        if not m:
            return None
        body = m.group(1)
        now = clock.now()
        day = parse_date(body, now.date())
        hm = parse_time(body)
        if day is None or hm is None:
            return Reply("Preciso do dia e da hora. Exemplo: \"marque compromisso dentista dia 20 às 14h\".")
        title = re.sub(r"\b(hoje|amanh[ãa]|dia \d{1,2}|\d{1,2}/\d{1,2}(/\d{2,4})?|às? \d{1,2}(h|:)\d{0,2}h?|\bàs? \d{1,2} ?h(oras)?)\b", "", body, flags=re.IGNORECASE)
        title = re.sub(r"\s+", " ", title).strip(" ,.-") or "Compromisso"
        start = datetime.combine(day, datetime.min.time()).replace(hour=hm[0], minute=hm[1])
        dur = parse_duration_minutes(body) or 60
        end = start + timedelta(minutes=dur)
        if start < now:
            return Reply(f"{start:%d/%m às %H:%M} já passou. Informe uma data futura.")
        conflicts = self.ctx.calendar.conflicts(start, end)

        def execute():
            eid = self.ctx.calendar.add(title, start, end)
            return f"Compromisso #{eid} criado: \"{title}\" em {start:%d/%m das %H:%M} às {end:%H:%M}."

        if conflicts:
            names = "; ".join(f"{e['title']} ({clock.parse_dt(e['start_at']):%H:%M})" for e in conflicts)
            self.pending = PendingAction("criar compromisso conflitante", execute)
            return Reply(f"⚠ Esse horário conflita com: {names}. Deseja criar mesmo assim? (sim/não)", pending=self.pending)
        return Reply(execute(), navigate="calendar")

    def _log_study(self, t, raw):
        if not re.search(r"\b(registr[eoa]\w*|anote|lance|estudei|resolvi|fiz)\b", t) or not re.search(r"\b(estud|quest|hora|minut)", t):
            return None
        if re.search(r"\b(crie|criar|gere)\b", t):
            return None
        c = self.ctx
        discs = find_disciplines(t, c.study.all_disciplines())
        minutes = parse_duration_minutes(t)
        qm = re.search(r"(\d+)\s*quest", t)
        am = re.search(r"(\d+)\s*(acertos?|certas?|corretas?)", t)
        if not discs and minutes is None and not qm:
            return None  # não é um registro de estudo (ex.: "anote que prefiro estudar cedo")
        if not discs or (minutes is None and not qm):
            return Reply("Para registrar preciso da disciplina e do tempo ou das questões. Exemplo: "
                         "\"registre que estudei 2 horas de Direito Penal, 20 questões, 15 acertos\".")
        total = int(qm.group(1)) if qm else None
        correct = int(am.group(1)) if am else None
        if total is not None and correct is not None and correct > total:
            return Reply("Os acertos não podem ser maiores que o total de questões. Confira os números.")
        day = parse_date(t, clock.today()) or clock.today()
        if "ontem" in t:
            day = clock.today() - timedelta(days=1)
        if minutes is None:
            qr_id = c.integrations.qconcursos.record(day, discs[0], total, correct if correct is not None else 0, source="manual")
            return Reply(f"Registrei {total} questões de {discs[0]} em {day:%d/%m}" + (f" ({correct} acertos)." if correct is not None else " (acertos não informados — registrados como 0)."))
        sid = c.study.add_manual_session(day, discs[0], minutes, questions_total=total,
                                         questions_correct=correct if total else None, notes="registrado por comando")
        c.reviews.schedule_topic(discs[0], "", day, kind="session", ref_id=sid)
        return Reply(f"Registrado (informado por você): {clock.fmt_minutes(minutes)} de {discs[0]} em {day:%d/%m}"
                     + (f", {total} questões" + (f" com {correct} acertos" if correct is not None else "") if total else "")
                     + ". Programei revisões em D+1, D+7 e D+30.")

    def _remember(self, t, raw):
        m = re.match(r"^(?:anote|lembre|memorize|guarde)\s+(?:que\s+)?(.+)$", raw.strip(), re.IGNORECASE)
        if not m or re.match(r"^(?:anote|lembre)\s+(?:uma\s+)?tarefa", raw.strip(), re.IGNORECASE) or re.match(r"^lembre-?me", raw.strip(), re.IGNORECASE):
            return None
        content = m.group(1).strip().rstrip(".")
        kind = "preferencia" if re.search(r"\b(prefiro|gosto|costumo|sempre|nunca|evite)\b", norm(content)) else "tarefa_atual"
        mid = self.ctx.memory.add(kind, content, source="comando")
        return Reply(f"Anotado na memória #{mid} ({'preferência permanente' if kind == 'preferencia' else 'assunto atual'}): \"{content}\". "
                     "Você pode editar ou apagar em Configurações → Memória.")

    def _forget(self, t, raw):
        m = re.match(r"^(?:esqueca|esquecer|apague|apagar|remova)\s+(?:a\s+)?(?:memoria|que)\s*(.*)$", norm(raw))
        if not m:
            return None
        term = m.group(1).strip()
        rows = [r for r in self.ctx.memory.list() if term and term in norm(r["content"])]
        if not rows:
            return Reply("Não encontrei nenhuma memória com esse conteúdo. Veja a lista em Configurações → Memória.")

        def execute():
            for r in rows:
                self.ctx.memory.delete(r["id"])
            return f"Apaguei {len(rows)} memória(s)."

        self.pending = PendingAction("apagar memórias", execute)
        return Reply("Vou apagar: " + "; ".join(f"\"{r['content']}\"" for r in rows) + ". Confirma? (sim/não)", pending=self.pending)

    def _news(self, t, raw):
        if re.search(r"(atualiz\w+|busque|buscar|veja)\b.*\bnoticias\b|\bnoticias (juridicas|de hoje)\b", t):
            return Reply("Abrindo o painel de notícias. Use \"Atualizar agora\" para buscar nos feeds (requer internet).", navigate="news")
        return None

    def _flashcards(self, t, raw):
        if re.search(r"(revisar|revisao de|treinar|me teste|me testa)\b.*(flashcards?|cartoes|cartões)|\bflashcards\b.*(hoje|pendent)", t):
            n = self.ctx.flashcards.count_due()
            return Reply(f"Você tem {n} flashcard(s) para revisar hoje." + (" Abrindo a revisão." if n else " Nada vencido agora."), navigate="study", nav_arg="flashcards")
        return None

    def _clear_history(self, t, raw):
        if not re.search(r"(limpar|apagar|apague|limpe)\b.*\b(historico|conversa)", t):
            return None

        def execute():
            self.ctx.conversations.clear()
            return "Histórico de conversas apagado."

        self.pending = PendingAction("limpar histórico", execute)
        return Reply("Isso apagará todo o histórico de conversas (memórias e tarefas não são afetadas). Confirma? (sim/não)", pending=self.pending)

    # ------------------------------------------------------------------ fallback
    def _fallback(self, raw: str, t: str) -> Reply:
        c = self.ctx
        client = c.assistant.client()
        if client.available:
            try:
                return Reply(c.assistant.ask(raw, use_documents=bool(c.settings.get("ai_docs_consent")) and bool(c.db.one("SELECT 1 FROM documents LIMIT 1"))),
                             handled_by="ia")
            except AIUnavailable as exc:
                return self._offline_answer(raw, str(exc))
        return self._offline_answer(raw, client.status()[1])

    def _offline_answer(self, raw: str, reason: str) -> Reply:
        hits = self.ctx.documents.search(raw, limit=3) if self.ctx.db.one("SELECT 1 FROM documents LIMIT 1") else []
        msg = f"Não consigo responder perguntas livres agora: {reason}\n"
        if hits:
            msg += "\nMas encontrei trechos nos seus documentos (busca local):\n" + "\n".join(
                f"• {h['name']} (p. {h['page']}): {h['snippet']}" for h in hits)
        else:
            msg += ("\nRecursos locais ainda disponíveis: tarefas, agenda, plano de estudos, revisões, relatórios e busca nos documentos importados. "
                    "Digite \"ajuda\" para ver os comandos.")
        return Reply(msg, handled_by="indisponivel")


def _extract_json(text: str):
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(text[start:end + 1])
    except ValueError:
        return None

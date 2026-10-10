from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QComboBox, QFileDialog, QHBoxLayout, QLineEdit, QListWidget, QListWidgetItem, QTextEdit,
                               QTreeWidget, QTreeWidgetItem, QVBoxLayout)

from ... import clock
from ...ai.provider import AIUnavailable
from ...docs.extract import ALLOWED_EXT, ImportRejected
from .. import theme
from ..async_util import run_async
from ..dialogs import ask, info, warn
from ..widgets import Card, button, label, page_header
from .base import Page

STATUS_ICON = {"full": "✔", "partial": "◐", "unreadable": "✖"}
STATUS_TEXT = {"full": "lido integralmente", "partial": "lido parcialmente", "unreadable": "não foi possível ler"}


class DocumentsPage(Page):
    key, title, icon = "documents", "Arquivos e documentos", "folder"

    def __init__(self, win):
        super().__init__(win)
        self.setAcceptDrops(True)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.addWidget(page_header("Arquivos e documentos", "Arraste PDFs, DOCX, TXT, MD ou imagens para esta janela, ou use Importar. "
                                  "Tudo fica guardado localmente; o original nunca é alterado."))
        bar = QHBoxLayout()
        bar.addWidget(button("📥 Importar arquivos…", primary=True, slot=self.pick))
        bar.addWidget(button("Google Drive…", slot=lambda: win.navigate("integrations", "gdrive")))
        self.disc_filter = QComboBox()
        self.disc_filter.currentIndexChanged.connect(self.refresh_list)
        bar.addWidget(label("Disciplina:", wrap=False))
        bar.addWidget(self.disc_filter)
        self.search = QLineEdit()
        self.search.setPlaceholderText("Buscar em todos os documentos (palavras ou conceitos)…")
        self.search.returnPressed.connect(self.do_search)
        bar.addWidget(self.search, 1)
        bar.addWidget(button("Buscar", slot=self.do_search))
        lay.addLayout(bar)
        body = QHBoxLayout()
        left = QVBoxLayout()
        self.list = QListWidget()
        self.list.currentRowChanged.connect(self.show_doc)
        left.addWidget(self.list, 1)
        self.drop_hint = label("⬇ Solte arquivos aqui", "h3", wrap=False)
        self.drop_hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.drop_hint.setStyleSheet(f"border: 2px dashed {theme.BORDER}; border-radius: 12px; padding: 14px; color: {theme.MUTED};")
        left.addWidget(self.drop_hint)
        body.addLayout(left, 2)
        right = QVBoxLayout()
        self.info = Card("Documento")
        self.info_lb = label("Selecione um documento.")
        self.info.add(self.info_lb)
        self.disc_box = QComboBox()
        self.disc_box.currentIndexChanged.connect(self.set_disc)
        self.info.add(self.disc_box)
        grid = QHBoxLayout()
        for text, fn in (("Resumo", self.summary), ("Perguntas (IA)", self.questions), ("Flashcards", self.flashcards), ("Mapa mental", self.mindmap), ("Temas", self.themes)):
            grid.addWidget(button(text, slot=fn))
        self.info.lay.addLayout(grid)
        g2 = QHBoxLayout()
        g2.addWidget(button("Ver texto extraído", slot=self.view_text))
        g2.addWidget(button("Derivados salvos", slot=self.saved))
        g2.addWidget(button("Excluir documento", danger=True, slot=self.delete))
        g2.addStretch(1)
        self.info.lay.addLayout(g2)
        right.addWidget(self.info)
        self.out_title = label("", "h3")
        right.addWidget(self.out_title)
        self.out = QTextEdit()
        self.out.setReadOnly(True)
        right.addWidget(self.out, 1)
        self.tree = QTreeWidget()
        self.tree.setHeaderHidden(True)
        self.tree.hide()
        right.addWidget(self.tree, 1)
        body.addLayout(right, 3)
        lay.addLayout(body, 1)
        self._docs: list = []
        self._loading = False

    # --- importação ---------------------------------------------------------------------
    def dragEnterEvent(self, e):
        if e.mimeData().hasUrls():
            e.acceptProposedAction()

    def dropEvent(self, e):
        self.import_paths([u.toLocalFile() for u in e.mimeData().urls() if u.isLocalFile()])

    def pick(self):
        exts = " ".join(f"*{x}" for x in sorted(ALLOWED_EXT))
        files, _ = QFileDialog.getOpenFileNames(self, "Importar documentos", str(Path.home()), f"Documentos ({exts})")
        if files:
            self.import_paths(files)

    def import_paths(self, paths: list[str]):
        disc = self.disc_filter.currentData()
        self.out_title.setText("Importando…")

        def work():
            results = []
            for p in paths:
                try:
                    r = self.ctx.documents.import_file(p, disc)
                    results.append((Path(p).name, r, None))
                except ImportRejected as exc:
                    results.append((Path(p).name, None, str(exc)))
                except Exception as exc:  # noqa: BLE001
                    results.append((Path(p).name, None, f"Erro inesperado: {type(exc).__name__}"))
            return results

        def done(results):
            lines = []
            for name, r, err in results:
                if err:
                    lines.append(f"✖ {name}: {err}")
                elif r.duplicate:
                    lines.append(f"• {name}: já havia sido importado.")
                else:
                    lines.append(f"{STATUS_ICON[r.status]} {name}: {STATUS_TEXT[r.status]}" + ("\n    ⚠ " + "\n    ⚠ ".join(r.warnings) if r.warnings else ""))
            self.out_title.setText("Resultado da importação")
            self.out.setPlainText("\n".join(lines))
            self.win.data_changed()

        run_async(work, done, lambda e: warn(self, "Falha na importação", "Não foi possível importar (veja o log)."))

    # --- lista --------------------------------------------------------------------------------
    def refresh(self):
        names = ["Todas"] + self.ctx.study.all_disciplines()
        self._loading = True
        cur = self.disc_filter.currentData()
        self.disc_filter.clear()
        self.disc_filter.addItem("Todas", None)
        for n in names[1:]:
            self.disc_filter.addItem(n, n)
        self.disc_filter.setCurrentIndex(max(0, self.disc_filter.findData(cur)))
        self.disc_box.clear()
        self.disc_box.addItem("— sem disciplina —", None)
        for n in names[1:]:
            self.disc_box.addItem(n, n)
        self._loading = False
        self.refresh_list()

    def on_arg(self, arg):
        if isinstance(arg, str):
            idx = self.disc_filter.findData(arg)
            if idx >= 0:
                self.disc_filter.setCurrentIndex(idx)

    def refresh_list(self):
        if self._loading:
            return
        self._docs = list(self.ctx.documents.list(self.disc_filter.currentData()))
        self.list.clear()
        for d in self._docs:
            unit = "pág." if d["ext"] == ".pdf" else "trechos"
            self.list.addItem(QListWidgetItem(f"{STATUS_ICON[d['read_status']]} {d['name']}  ·  {d['pages']} {unit}" + (f"  ·  {d['discipline']}" if d["discipline"] else "")))
        if not self._docs:
            self.list.addItem("Nenhum documento. Arraste arquivos para esta janela.")

    def _cur(self):
        r = self.list.currentRow()
        return self._docs[r] if 0 <= r < len(self._docs) else None

    def show_doc(self):
        d = self._cur()
        if not d:
            return
        self.ctx.selected_doc_id = d["id"]
        unit = "páginas" if d["ext"] == ".pdf" else "trechos"
        self.info_lb.setText(f"<b>{d['name']}</b><br/>{d['ext'].upper()[1:]} · {d['size_bytes'] / 1024:.0f} KB · {d['pages']} {unit} · {d['text_chars']:,} caracteres<br/>"
                             f"Situação: <b>{STATUS_TEXT[d['read_status']]}</b> · origem: {d['source']} · importado em {d['imported_at'][:16]}"
                             + (f"<br/><span style='color:{theme.WARN}'>⚠ {d['warnings'].replace(chr(10), '<br/>⚠ ')}</span>" if d["warnings"] else ""))
        self._loading = True
        self.disc_box.setCurrentIndex(max(0, self.disc_box.findData(d["discipline"])))
        self._loading = False

    def set_disc(self):
        d = self._cur()
        if d and not self._loading:
            self.ctx.documents.set_discipline(d["id"], self.disc_box.currentData())
            self.refresh_list()

    # --- ações -----------------------------------------------------------------------------------
    def _text_out(self, title: str, text: str):
        self.tree.hide()
        self.out.show()
        self.out_title.setText(title)
        self.out.setPlainText(text)

    def do_search(self):
        q = self.search.text().strip()
        if not q:
            return
        hits = self.ctx.documents.search(q, limit=30)
        if not hits:
            self._text_out(f"Busca: “{q}”", "Nenhum trecho encontrado nos documentos indexados.")
            return
        lines = []
        for h in hits:
            unit = "p." if h["ext"] == ".pdf" else "trecho"
            lines.append(f"📄 {h['name']} — {unit} {h['page']}\n    {h['snippet']}\n")
        self._text_out(f"Busca: “{q}” — {len(hits)} resultado(s)", "\n".join(lines))

    def view_text(self):
        d = self._cur()
        if d:
            self._text_out(f"Texto extraído — {d['name']}", self.ctx.documents.text(d["id"], 60000) or "(sem texto)")

    def saved(self):
        d = self._cur()
        if not d:
            return
        rows = self.ctx.documents.derived(d["id"])
        self._text_out("Derivados salvos", "\n\n".join(f"[{r['kind']} · {r['generator']} · {r['created_at'][:16]}]\n{r['content']}" for r in rows) or "Nada gerado ainda.")

    def summary(self):
        d = self._cur()
        if not d:
            return
        if d["read_status"] == "unreadable":
            warn(self, "Documento ilegível", d["warnings"])
            return
        use_ai = self.ctx.assistant.client().available
        if use_ai and not self.ctx.settings.get("ai_docs_consent"):
            if ask(self, "Enviar trechos ao provedor de IA?", f"Para gerar o resumo com IA, o texto de “{d['name']}” (até ~24 mil caracteres) será enviado ao provedor "
                   f"configurado ({self.ctx.settings.get('ai_provider')}). Sem sua autorização, o JARMES usa apenas o resumo extrativo local.\n\nAutorizar o envio de documentos?",
                   "Autorizar", "Usar só o local"):
                self.ctx.settings.set("ai_docs_consent", True)
        self.out_title.setText("Gerando resumo…")
        doc_id = d["id"]

        def work():
            c = self.ctx
            if c.assistant.client().available and c.settings.get("ai_docs_consent"):
                try:
                    txt = c.assistant.generate("Resuma o documento em tópicos objetivos, citando a página entre colchetes. Não acrescente informações que não estejam no texto.",
                                               c.documents.text(doc_id, 24000), name=d["name"])
                    c.documents.save_derived(doc_id, "resumo", txt, f"ia:{c.assistant.client().model}")
                    return "Resumo gerado por IA a partir do texto do documento (confira com o original):\n\n" + txt
                except AIUnavailable as exc:
                    return f"(IA indisponível: {exc} Usando o resumo local.)\n\n" + c.documents.local_summary(doc_id)
            return c.documents.local_summary(doc_id)

        run_async(work, lambda t: self._text_out(f"Resumo — {d['name']}", t), lambda e: warn(self, "Erro", "Não foi possível resumir (veja o log)."))

    def questions(self):
        d = self._cur()
        if d:
            reply = self.ctx.commands.handle(f"crie dez perguntas sobre {d['name']}")
            self._text_out("Perguntas", reply.text + "\n\nObservação: perguntas por IA exigem provedor configurado e autorização de envio do texto.")

    def flashcards(self):
        d = self._cur()
        if not d:
            return
        cards = self.ctx.documents.local_flashcards(d["id"], 12)
        if not cards:
            info(self, "Flashcards", "Não encontrei trechos adequados para gerar cartões automaticamente neste documento.")
            return
        preview = "\n\n".join(f"P: {c['front']}\nR: {c['back']}  (p. {c['page']})" for c in cards)
        if ask(self, f"{len(cards)} flashcards (heurística local)", "Cartões criados por regras locais; podem precisar de ajuste.\n\n" + preview[:1800] + "\n\nAdicionar à fila de revisão?", "Adicionar", "Descartar"):
            for c in cards:
                self.ctx.flashcards.add(c["front"], c["back"], d["discipline"] or "Geral", source="documento_local", doc_id=d["id"], page=c["page"])
            info(self, "Pronto", f"{len(cards)} flashcards adicionados.")
            self.win.data_changed()

    def mindmap(self):
        d = self._cur()
        if not d:
            return
        items, md = self.ctx.documents.mindmap(d["id"])
        self.out.hide()
        self.tree.show()
        self.out_title.setText(f"Mapa mental — {d['name']}")
        self.tree.clear()
        stack: list[tuple[int, QTreeWidgetItem]] = []
        for it in items:
            node = QTreeWidgetItem([it["title"] + (f"  (p. {it['page']})" if it.get("page") else "")])
            while stack and stack[-1][0] >= it["level"]:
                stack.pop()
            (stack[-1][1].addChild(node) if stack else self.tree.addTopLevelItem(node))
            stack.append((it["level"], node))
        self.tree.expandAll()

    def themes(self):
        d = self._cur()
        if d:
            res = self.ctx.documents.themes(d["id"])
            self._text_out(f"Temas recorrentes — {d['name']}", "\n".join(f"• {k}  ({c}×)" for k, c in res) or "Poucos termos recorrentes.")

    def delete(self):
        d = self._cur()
        if d and ask(self, "Excluir documento", f"Excluir “{d['name']}”, o texto extraído, derivados e flashcards gerados dele? A cópia local será apagada (o original não é tocado).", "Excluir"):
            self.ctx.documents.delete(d["id"])
            self.win.data_changed()

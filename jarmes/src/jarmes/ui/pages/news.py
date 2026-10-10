from __future__ import annotations

import webbrowser

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (QCheckBox, QComboBox, QFormLayout, QHBoxLayout, QLineEdit, QListWidget, QListWidgetItem, QTableWidget,
                               QTableWidgetItem, QTabWidget, QTextBrowser, QVBoxLayout, QWidget)

from ... import clock
from ...integrations.news import CATEGORIES
from .. import theme
from ..async_util import run_async
from ..dialogs import ask, info, warn
from ..widgets import Card, button, label, page_header
from .base import Page


class NewsPage(Page):
    key, title, icon = "news", "Notícias jurídicas e concursos", "news"

    def __init__(self, win):
        super().__init__(win)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 20, 24, 20)
        lay.addWidget(page_header("Notícias jurídicas e concursos", "Somente o que as fontes cadastradas realmente publicaram, com fonte, data e link originais."))
        self.tabs = QTabWidget()
        lay.addWidget(self.tabs, 1)

        t1 = QWidget()
        l1 = QVBoxLayout(t1)
        bar = QHBoxLayout()
        self.cat = QComboBox()
        self.cat.addItem("Todas as categorias", None)
        for c in CATEGORIES:
            self.cat.addItem(c, c)
        self.cat.currentIndexChanged.connect(self.refresh_items)
        self.only_rel = QCheckBox("Só relevantes para mim")
        self.only_rel.toggled.connect(self.refresh_items)
        self.q = QLineEdit()
        self.q.setPlaceholderText("Filtrar por palavra…")
        self.q.returnPressed.connect(self.refresh_items)
        self.btn_refresh = button("⟳ Atualizar agora", primary=True, slot=self.update_now)
        for w in (self.cat, self.only_rel, self.q, self.btn_refresh):
            bar.addWidget(w, 1 if w is self.q else 0)
        l1.addLayout(bar)
        self.status_lb = label("", muted=True)
        l1.addWidget(self.status_lb)
        split = QHBoxLayout()
        self.list = QListWidget()
        self.list.setWordWrap(True)
        self.list.currentRowChanged.connect(self.show_item)
        split.addWidget(self.list, 2)
        self.detail = QTextBrowser()
        self.detail.setOpenLinks(False)
        self.detail.anchorClicked.connect(lambda u: webbrowser.open(u.toString()))
        split.addWidget(self.detail, 3)
        l1.addLayout(split, 1)
        self.tabs.addTab(t1, "Notícias")

        t2 = QWidget()
        l2 = QVBoxLayout(t2)
        l2.addWidget(label("Cada fonte precisa de um endereço de feed RSS/Atom oficial (procure “RSS” no rodapé do site do órgão). "
                           "Os endereços pré-cadastrados são tentativas NÃO verificadas — o resultado do último teste aparece abaixo.", muted=True))
        self.src = QTableWidget(0, 5)
        self.src.setHorizontalHeaderLabels(["Ativa", "Fonte", "Feed (RSS/Atom)", "Última atualização", "Último resultado"])
        self.src.horizontalHeader().setStretchLastSection(True)
        self.src.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.src.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        l2.addWidget(self.src, 1)
        r = QHBoxLayout()
        r.addWidget(button("Definir endereço do feed…", slot=self.set_feed))
        r.addWidget(button("Ativar / desativar", slot=self.toggle_src))
        r.addWidget(button("Abrir site do órgão", slot=self.open_home))
        r.addWidget(button("Remover", danger=True, slot=self.del_src))
        r.addStretch(1)
        l2.addLayout(r)
        add = Card("Adicionar fonte")
        f = QFormLayout()
        self.n_name = QLineEdit()
        self.n_url = QLineEdit()
        self.n_url.setPlaceholderText("https://…/rss.xml")
        self.n_cat = QComboBox()
        self.n_cat.addItems(CATEGORIES)
        self.n_off = QCheckBox("É fonte oficial (tribunal, órgão público, diário oficial)")
        for a, b in (("Nome", self.n_name), ("Feed", self.n_url), ("Categoria padrão", self.n_cat), ("", self.n_off)):
            f.addRow(a, b)
        add.lay.addLayout(f)
        add.add(button("Adicionar", slot=self.add_src))
        l2.addWidget(add)
        sch = Card("Atualização programada")
        self.interval = QComboBox()
        for v, t in ((0, "Somente manual"), (30, "A cada 30 min"), (60, "A cada 1 h"), (120, "A cada 2 h"), (360, "A cada 6 h"), (720, "A cada 12 h")):
            self.interval.addItem(t, v)
        self.interval.currentIndexChanged.connect(self.save_interval)
        sch.add(self.interval)
        self.notify = QCheckBox("Notificar sobre notícias recentes que casem com minhas palavras-chave")
        self.notify.toggled.connect(lambda v: self.ctx.settings.set("news_notify", bool(v)))
        sch.add(self.notify)
        self.kw = QLineEdit()
        self.kw.setPlaceholderText("Palavras-chave de interesse, separadas por vírgula")
        self.kw.editingFinished.connect(self.save_kw)
        sch.add(self.kw)
        sch.add(label("A atualização programada só roda com o JARMES aberto (janela ou bandeja do sistema).", muted=True))
        l2.addWidget(sch)
        self.tabs.addTab(t2, "Fontes e agendamento")

        t3 = QWidget()
        l3 = QVBoxLayout(t3)
        l3.addWidget(label("Concursos que você acompanha. Preencha apenas o que confirmou no edital/site oficial; “não confirmado” é um estado válido.", muted=True))
        self.con = QTableWidget(0, 6)
        self.con.setHorizontalHeaderLabels(["Órgão", "Cargo", "Situação", "Inscrições até", "Prova", "Verificado em / fonte"])
        self.con.horizontalHeader().setStretchLastSection(True)
        self.con.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.con.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        l3.addWidget(self.con, 1)
        cr = QHBoxLayout()
        cr.addWidget(button("＋ Adicionar concurso", primary=True, slot=self.add_contest))
        cr.addWidget(button("Editar", slot=self.edit_contest))
        cr.addWidget(button("Abrir edital", slot=self.open_edital))
        cr.addWidget(button("Remover", danger=True, slot=self.del_contest))
        cr.addStretch(1)
        l3.addLayout(cr)
        self.tabs.addTab(t3, "Concursos acompanhados")
        self._items: list[dict] = []
        self._srcs: list = []
        self._cons: list = []
        self._busy = False

    # --- notícias --------------------------------------------------------------------------
    def refresh(self):
        self.refresh_items()
        self.refresh_sources()
        self.refresh_contests()
        s = self.ctx.settings
        self.interval.blockSignals(True)
        self.interval.setCurrentIndex(max(0, self.interval.findData(int(s.get("news_refresh_minutes")))))
        self.interval.blockSignals(False)
        self.notify.blockSignals(True)
        self.notify.setChecked(bool(s.get("news_notify")))
        self.notify.blockSignals(False)
        if not self.kw.hasFocus():
            self.kw.setText(", ".join(s.get("news_keywords") or []))

    def refresh_items(self):
        news = self.ctx.integrations.news
        self._items = news.list(self.cat.currentData(), self.q.text(), self.only_rel.isChecked())
        self.list.clear()
        for n in self._items:
            it = QListWidgetItem(f"{'● ' if not n['is_read'] else ''}{n['title']}\n{n['source_name']} · {n['date_label']} · {n['category']}")
            if n["is_old"]:
                it.setForeground(QColor(theme.MUTED))
            self.list.addItem(it)
        srcs = [s for s in news.sources() if s["enabled"] and s["feed_url"]]
        last = max((s["last_ok"] for s in srcs if s["last_ok"]), default=None)
        if not self._items:
            self.list.addItem("Nenhuma notícia armazenada. Clique em “Atualizar agora” (requer internet e ao menos um feed válido em “Fontes”).")
        self.status_lb.setText(f"{len(self._items)} item(ns) · {len(srcs)} fonte(s) ativa(s) · última atualização bem-sucedida: {last[:16] if last else 'nunca'}")

    def show_item(self):
        r = self.list.currentRow()
        if not (0 <= r < len(self._items)):
            return
        n = self._items[r]
        self.ctx.integrations.news.mark_read(n["id"])
        old = f"<p style='color:{theme.WARN}'>⚠ Publicação antiga ({n['age_days']} dias) — não trate como atual.</p>" if n["is_old"] else ""
        self.detail.setHtml(
            f"<h3 style='color:{theme.CYAN}'>{n['title']}</h3>{old}"
            f"<p><b>Fonte:</b> {n['source_name']}<br/><b>Publicado em:</b> {n['date_label']}<br/><b>Categoria:</b> {n['category']}<br/>"
            f"<b>Verificação:</b> {n['verification_label']}<br/><b>Coletado em:</b> {n['fetched_at'][:16]}</p>"
            f"<p>{n['summary'] or '(a fonte não forneceu resumo)'}</p><p><a href='{n['url']}'>Abrir link original</a></p>"
            f"<p style='color:{theme.MUTED}'>Confirme prazos, requisitos e valores no edital/ato oficial.</p>")

    def update_now(self):
        if self._busy:
            return
        self._busy = True
        self.btn_refresh.setEnabled(False)
        self.status_lb.setText("Atualizando fontes…")

        def done(results):
            self._busy = False
            self.btn_refresh.setEnabled(True)
            ok = [r for r in results if r["ok"]]
            bad = [r for r in results if not r["ok"]]
            new = sum(r["new"] for r in results)
            msg = f"{len(ok)} fonte(s) atualizada(s), {new} item(ns) novo(s)."
            if bad:
                msg += "\nFalhas:\n" + "\n".join(f"• {r['source']}: {r['error']}" for r in bad[:8])
            self.win.data_changed()
            info(self, "Atualização de notícias", msg if results else "Nenhuma fonte ativa com feed configurado. Veja a aba “Fontes e agendamento”.")

        def failed(e):
            self._busy = False
            self.btn_refresh.setEnabled(True)
            warn(self, "Notícias", "Falha inesperada ao atualizar (veja o log).")

        run_async(self.ctx.integrations.news.refresh_all, done, failed)

    # --- fontes --------------------------------------------------------------------------------
    def refresh_sources(self):
        self._srcs = list(self.ctx.integrations.news.sources())
        self.src.setRowCount(0)
        for s in self._srcs:
            r = self.src.rowCount()
            self.src.insertRow(r)
            for i, v in enumerate(("✔" if s["enabled"] else "—", s["name"], s["feed_url"] or "(sem feed)", (s["last_ok"] or "nunca")[:16], s["last_error"] or "ok")):
                self.src.setItem(r, i, QTableWidgetItem(v))
        self.src.resizeColumnsToContents()

    def _src(self):
        r = self.src.currentRow()
        return self._srcs[r] if 0 <= r < len(self._srcs) else None

    def set_feed(self):
        s = self._src()
        if not s:
            return
        from PySide6.QtWidgets import QInputDialog
        url, ok = QInputDialog.getText(self, "Feed RSS/Atom", f"Endereço do feed de {s['name']}:", text=s["feed_url"])
        if ok:
            try:
                self.ctx.integrations.news.update_source(s["id"], feed_url=url.strip(), enabled=1 if url.strip() else 0)
            except ValueError as exc:
                warn(self, "Endereço inválido", str(exc))
            self.refresh_sources()

    def toggle_src(self):
        s = self._src()
        if s:
            if not s["feed_url"] and not s["enabled"]:
                info(self, "Sem feed", "Defina primeiro o endereço do feed.")
                return
            self.ctx.integrations.news.update_source(s["id"], enabled=0 if s["enabled"] else 1)
            self.refresh_sources()

    def open_home(self):
        s = self._src()
        if s and s["home_url"]:
            webbrowser.open(s["home_url"])

    def del_src(self):
        s = self._src()
        if s and ask(self, "Remover fonte", f"Remover “{s['name']}”? As notícias já coletadas permanecem.", "Remover"):
            self.ctx.integrations.news.delete_source(s["id"])
            self.refresh_sources()

    def add_src(self):
        try:
            self.ctx.integrations.news.add_source(self.n_name.text(), self.n_url.text().strip(), self.n_cat.currentText(), self.n_off.isChecked())
        except ValueError as exc:
            warn(self, "Dados inválidos", str(exc))
            return
        self.n_name.clear()
        self.n_url.clear()
        self.refresh_sources()

    def save_interval(self):
        self.ctx.settings.set("news_refresh_minutes", int(self.interval.currentData()))

    def save_kw(self):
        self.ctx.settings.set("news_keywords", [k.strip() for k in self.kw.text().split(",") if k.strip()])

    # --- concursos -------------------------------------------------------------------------------
    def refresh_contests(self):
        self._cons = list(self.ctx.db.query("SELECT * FROM contests ORDER BY org"))
        self.con.setRowCount(0)
        for c in self._cons:
            r = self.con.rowCount()
            self.con.insertRow(r)
            ver = f"{c['last_verified'][:10]} · {c['verified_source']}" if c["last_verified"] else "não verificado"
            for i, v in enumerate((c["org"], c["role"], c["situation"], c["registration_end"] or "—", c["exam_date"] or "—", ver)):
                self.con.setItem(r, i, QTableWidgetItem(v))
        self.con.resizeColumnsToContents()

    def _con(self):
        r = self.con.currentRow()
        return self._cons[r] if 0 <= r < len(self._cons) else None

    def _contest_dialog(self, c=None):
        from PySide6.QtWidgets import QDialog, QDialogButtonBox
        d = QDialog(self)
        d.setWindowTitle("Concurso acompanhado")
        d.setMinimumWidth(460)
        f = QFormLayout(d)
        org, role, board, url, src = QLineEdit(), QLineEdit(), QLineEdit(), QLineEdit(), QLineEdit()
        sit = QComboBox()
        sit.addItems(["Não confirmado", "Autorizado", "Comissão formada", "Banca definida", "Edital publicado", "Inscrições abertas",
                      "Inscrições encerradas", "Prova realizada", "Resultado publicado", "Homologado", "Convocação/nomeação"])
        reg_end, exam = QLineEdit(), QLineEdit()
        reg_end.setPlaceholderText("AAAA-MM-DD")
        exam.setPlaceholderText("AAAA-MM-DD")
        verified = QCheckBox("Confirmei a situação agora em fonte oficial")
        if c:
            org.setText(c["org"]); role.setText(c["role"]); board.setText(c["board"]); url.setText(c["edital_url"])
            sit.setCurrentText(c["situation"]); reg_end.setText(c["registration_end"] or ""); exam.setText(c["exam_date"] or ""); src.setText(c["verified_source"])
        for a, b in (("Órgão", org), ("Cargo", role), ("Banca", board), ("Situação", sit), ("Inscrições até", reg_end), ("Data da prova", exam),
                     ("Link do edital oficial", url), ("Fonte da confirmação", src), ("", verified)):
            f.addRow(a, b)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(d.accept)
        bb.rejected.connect(d.reject)
        f.addRow(bb)
        if not d.exec():
            return
        if not org.text().strip():
            warn(self, "Dados inválidos", "Informe o órgão.")
            return
        for field in (reg_end, exam):
            if field.text().strip() and clock.parse_date(field.text().strip()) is None:
                warn(self, "Data inválida", "Use o formato AAAA-MM-DD.")
                return
        vals = dict(org=org.text().strip(), role=role.text().strip(), board=board.text().strip(), situation=sit.currentText(), edital_url=url.text().strip(),
                    registration_end=reg_end.text().strip() or None, exam_date=exam.text().strip() or None, verified_source=src.text().strip())
        if verified.isChecked():
            vals["last_verified"] = clock.iso(clock.now())
        if c:
            self.ctx.db.update("contests", c["id"], vals)
        else:
            vals["created_at"] = clock.iso(clock.now())
            self.ctx.db.insert("contests", vals)
        self.refresh_contests()

    def add_contest(self):
        self._contest_dialog()

    def edit_contest(self):
        c = self._con()
        if c:
            self._contest_dialog(c)

    def open_edital(self):
        c = self._con()
        if c and c["edital_url"]:
            webbrowser.open(c["edital_url"])

    def del_contest(self):
        c = self._con()
        if c and ask(self, "Remover", f"Remover {c['org']}?", "Remover"):
            self.ctx.db.execute("DELETE FROM contests WHERE id=?", (c["id"],))
            self.refresh_contests()

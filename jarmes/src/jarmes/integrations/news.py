"""Notícias jurídicas e de concursos a partir de feeds RSS/Atom (priorizando fontes oficiais).

Nada é inventado: só aparece o que um feed realmente devolveu, com fonte, data e link originais.
Os endereços de feed são editáveis; os pré-cadastrados NÃO foram testados em produção."""
from __future__ import annotations

import html
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime

from .. import clock
from ..core.nlp import norm
from ..db import Database
from .http import IntegrationError, request

log = logging.getLogger("jarmes.news")

CATEGORIES = ["Concursos públicos", "Editais e retificações", "Magistratura", "ENAM", "Tribunais", "Defensoria Pública",
              "Ministério Público", "Legislação", "Jurisprudência", "Informativos dos tribunais superiores"]

# (nome, site oficial, feed [tentativa, não verificada], categoria padrão)
DEFAULT_SOURCES = [
    ("STF — Notícias", "https://portal.stf.jus.br/", "https://portal.stf.jus.br/rss/noticiastf.asp", "Tribunais"),
    ("STJ — Notícias", "https://www.stj.jus.br/", "https://res.stj.jus.br/hrestp-c-portalp/RSS.xml", "Tribunais"),
    ("CNJ — Notícias", "https://www.cnj.jus.br/", "https://www.cnj.jus.br/feed/", "Tribunais"),
    ("TST — Notícias", "https://www.tst.jus.br/", "", "Tribunais"),
    ("CNMP — Notícias", "https://www.cnmp.mp.br/", "", "Ministério Público"),
    ("Câmara dos Deputados — Notícias", "https://www.camara.leg.br/noticias/", "", "Legislação"),
    ("Agência Senado", "https://www12.senado.leg.br/noticias", "", "Legislação"),
    ("Planalto — Legislação", "https://www.planalto.gov.br/ccivil_03/", "", "Legislação"),
    ("INEP (ENAM)", "https://www.gov.br/inep/", "", "ENAM"),
    ("Imprensa Nacional — DOU", "https://www.in.gov.br/", "", "Editais e retificações"),
    ("Defensoria Pública da União", "https://www.dpu.def.br/", "", "Defensoria Pública"),
    ("Ministério Público Federal", "https://www.mpf.mp.br/", "", "Ministério Público"),
    ("TJMS — Notícias", "https://www.tjms.jus.br/", "", "Tribunais"),
]

CATEGORY_RULES = [
    ("ENAM", r"\benam\b|exame nacional da magistratura"),
    ("Magistratura", r"magistratur|concurso para juiz|juiz substituto|\benfam\b"),
    ("Editais e retificações", r"edital|retifica[cç][aã]o|inscri[cç][õo]es|gabarito|convoca[cç]"),
    ("Concursos públicos", r"concurso|certame|sele[cç][aã]o p[uú]blica|nomea[cç]"),
    ("Defensoria Pública", r"defensoria|defensor p[uú]blico"),
    ("Ministério Público", r"minist[eé]rio p[uú]blico|\bmpf\b|\bcnmp\b|procurador"),
    ("Informativos dos tribunais superiores", r"informativo"),
    ("Jurisprudência", r"s[uú]mula|repercuss[aã]o geral|recurso repetitivo|ac[oó]rd[aã]o|julgamento|decis[aã]o|tema \d+"),
    ("Legislação", r"\blei\b|decreto|medida provis[oó]ria|emenda constitucional|projeto de lei|sanciona|promulga"),
]

_DOCTYPE = re.compile(rb"<!(DOCTYPE|ENTITY)", re.IGNORECASE)


def parse_feed(content: bytes) -> list[dict]:
    """Interpreta RSS 2.0 ou Atom. Recusa DTD/entidades (proteção contra XXE e 'billion laughs')."""
    if _DOCTYPE.search(content[:20000]):
        raise IntegrationError("Feed recusado: contém declaração DTD/entidade.")
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        raise IntegrationError("O endereço não devolveu um feed RSS/Atom válido.") from None
    items = []
    tag = lambda e: e.tag.split("}")[-1]  # noqa: E731
    for el in root.iter():
        if tag(el) not in ("item", "entry"):
            continue
        d = {"title": "", "url": "", "summary": "", "date": None}
        for ch in el:
            t = tag(ch)
            if t == "title":
                d["title"] = "".join(ch.itertext()).strip()
            elif t == "link":
                d["url"] = d["url"] or (ch.get("href") or (ch.text or "")).strip()
            elif t in ("description", "summary", "content") and not d["summary"]:
                d["summary"] = "".join(ch.itertext()).strip()
            elif t in ("pubDate", "published", "updated", "date") and d["date"] is None:
                d["date"] = _parse_date("".join(ch.itertext()).strip())
        if d["title"] and d["url"].startswith(("http://", "https://")):
            d["summary"] = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", d["summary"]))).strip()[:500]
            d["title"] = html.unescape(d["title"])
            items.append(d)
    return items


def _parse_date(text: str) -> datetime | None:
    if not text:
        return None
    try:
        dt = parsedate_to_datetime(text)
        return dt.astimezone().replace(tzinfo=None) if dt.tzinfo else dt
    except (TypeError, ValueError):
        pass
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return dt.astimezone().replace(tzinfo=None) if dt.tzinfo else dt
    except ValueError:
        return None


def classify(title: str, summary: str, default: str) -> str:
    blob = norm(title + " " + summary)
    for cat, pattern in CATEGORY_RULES:
        if re.search(pattern, blob):
            return cat
    return default


class NewsService:
    def __init__(self, db: Database, settings, notifier=None):
        self.db, self.settings, self.notifier = db, settings, notifier

    def seed_sources(self) -> None:
        if self.db.one("SELECT 1 FROM news_sources LIMIT 1"):
            return
        for name, home, feed, cat in DEFAULT_SOURCES:
            self.db.insert("news_sources", dict(name=name, home_url=home, feed_url=feed, category=cat, official=1,
                                                 enabled=1 if feed else 0,
                                                 last_error="Feed não testado" if feed else "Sem endereço de feed configurado"))

    def sources(self):
        return self.db.query("SELECT * FROM news_sources ORDER BY id")

    def add_source(self, name: str, feed_url: str, category: str = "Tribunais", official: bool = False, home_url: str = "") -> int:
        if not feed_url.startswith(("http://", "https://")):
            raise ValueError("O endereço do feed deve começar com http:// ou https://")
        return self.db.insert("news_sources", dict(name=name.strip() or feed_url, home_url=home_url, feed_url=feed_url,
                                                    category=category, official=1 if official else 0, enabled=1))

    def update_source(self, source_id: int, **fields) -> None:
        allowed = {"name", "feed_url", "category", "official", "enabled", "home_url"}
        if set(fields) - allowed:
            raise ValueError("Campo não editável.")
        if fields.get("feed_url") and not str(fields["feed_url"]).startswith(("http://", "https://")):
            raise ValueError("O endereço do feed deve começar com http:// ou https://")
        self.db.update("news_sources", source_id, fields)

    def delete_source(self, source_id: int) -> None:
        self.db.execute("DELETE FROM news_sources WHERE id=?", (source_id,))

    def relevant(self, title: str, summary: str) -> bool:
        blob = norm(title + " " + summary)
        return any(norm(k) in blob for k in self.settings.get("news_keywords") or [])

    def refresh_source(self, source) -> dict:
        now = clock.iso(clock.now())
        if not source["feed_url"]:
            return dict(source=source["name"], ok=False, new=0, error="Sem endereço de feed configurado.")
        try:
            status, _h, body = request("GET", source["feed_url"], timeout=20, max_bytes=3 * 1024 * 1024,
                                       headers={"Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"})
            if status >= 400:
                raise IntegrationError(f"O servidor respondeu HTTP {status}.")
            entries = parse_feed(body)
        except IntegrationError as exc:
            self.db.update("news_sources", source["id"], dict(last_checked=now, last_error=str(exc)))
            return dict(source=source["name"], ok=False, new=0, error=str(exc))
        new = 0
        verification = "feed_oficial" if source["official"] else "feed_nao_oficial"
        for e in entries[:100]:
            if self.db.one("SELECT 1 FROM news_items WHERE url=?", (e["url"],)):
                continue
            cat = classify(e["title"], e["summary"], source["category"])
            rel = 1 if self.relevant(e["title"], e["summary"]) else 0
            iid = self.db.insert("news_items", dict(
                source_id=source["id"], source_name=source["name"], title=e["title"][:300], url=e["url"],
                published_at=clock.iso(e["date"]), summary=e["summary"], category=cat, verification=verification,
                fetched_at=now, relevant=rel))
            new += 1
            if rel and self.notifier and self.settings.get("news_notify"):
                recent = e["date"] is None or e["date"] > clock.now() - timedelta(days=3)
                if recent:
                    self.notifier.push("noticia", f"{source['name']}: {e['title'][:90]}", e["summary"][:140],
                                       dedupe_key=f"news:{iid}", action={"page": "news"})
        self.db.update("news_sources", source["id"], dict(last_checked=now, last_ok=now, last_error=None))
        return dict(source=source["name"], ok=True, new=new, error=None)

    def refresh_all(self) -> list[dict]:
        return [self.refresh_source(s) for s in self.db.query("SELECT * FROM news_sources WHERE enabled=1")]

    def list(self, category: str | None = None, text: str = "", only_relevant: bool = False,
             unread_only: bool = False, limit: int = 300) -> list[dict]:
        sql, params = "SELECT * FROM news_items WHERE 1=1", []
        if category:
            sql += " AND category=?"
            params.append(category)
        if only_relevant:
            sql += " AND relevant=1"
        if unread_only:
            sql += " AND is_read=0"
        if text.strip():
            sql += " AND (title LIKE ? OR summary LIKE ?)"
            params += [f"%{text.strip()}%"] * 2
        sql += " ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?"
        params.append(limit)
        max_age = int(self.settings.get("news_max_age_days"))
        out = []
        for r in self.db.query(sql, params):
            d = dict(r)
            pub = clock.parse_dt(d["published_at"])
            d["age_days"] = (clock.now() - pub).days if pub else None
            d["is_old"] = bool(pub and d["age_days"] > max_age)
            d["date_label"] = (f"{pub:%d/%m/%Y}" if pub else "data não informada pela fonte")
            d["verification_label"] = {"feed_oficial": "Fonte oficial (feed do órgão)",
                                       "feed_nao_oficial": "Fonte não oficial — confirmar no órgão",
                                       "manual": "Inserida manualmente"}.get(d["verification"], d["verification"])
            out.append(d)
        return out

    def mark_read(self, item_id: int) -> None:
        self.db.update("news_items", item_id, dict(is_read=1))

    def official_contest_updates(self, days: int = 14) -> list[dict]:
        cutoff = clock.iso(clock.now() - timedelta(days=days))
        rows = self.db.query(
            "SELECT * FROM news_items WHERE verification='feed_oficial' AND category IN "
            "('Concursos públicos','Editais e retificações','Magistratura','ENAM','Defensoria Pública','Ministério Público') "
            "AND COALESCE(published_at, fetched_at) >= ? ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT 20", (cutoff,))
        return [dict(r) for r in rows]

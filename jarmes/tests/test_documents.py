import zipfile

import pytest

from jarmes.docs.extract import ImportRejected, validate_file
from tests.helpers import make_docx, make_image_pdf, make_text_pdf

TEXT = ("A dignidade da pessoa humana é fundamento da República Federativa do Brasil. "
        "Os direitos humanos são o conjunto de direitos indispensáveis a uma vida com liberdade, igualdade e dignidade.")


def test_import_text_pdf_with_pages_and_search(ctx, tmp_path):
    pdf = make_text_pdf(tmp_path / "dh.pdf", ["Dignidade da pessoa humana e liberdade", "Fundamentalidade formal e material"])
    r = ctx.documents.import_file(pdf, "Direitos Humanos")
    assert r.status == "full" and not r.duplicate
    hits = ctx.documents.search("fundamentalidade")
    assert hits and hits[0]["page"] == 2 and "«" in hits[0]["snippet"]
    assert ctx.documents.search("dignidade", doc_id=r.doc_id)[0]["page"] == 1
    assert ctx.documents.get(r.doc_id)["pages"] == 2


def test_duplicate_import_detected(ctx, tmp_path):
    p = tmp_path / "a.txt"
    p.write_text(TEXT, encoding="utf-8")
    first = ctx.documents.import_file(p)
    second = ctx.documents.import_file(p)
    assert second.duplicate and second.doc_id == first.doc_id
    assert len(ctx.documents.list()) == 1


def test_scanned_pdf_reports_unreadable(ctx, tmp_path):
    r = ctx.documents.import_file(make_image_pdf(tmp_path / "scan.pdf"))
    assert r.status == "unreadable"
    assert any("sem texto" in w or "Nenhum" in w or "digitaliza" in w for w in r.warnings)


def test_docx_import_with_headings(ctx, tmp_path):
    d = make_docx(tmp_path / "r.docx", [TEXT, "A fundamentalidade material relaciona-se ao conteúdo do direito."], heading="Direitos Humanos")
    r = ctx.documents.import_file(d, "Direitos Humanos")
    assert r.status in ("full", "partial") and ctx.documents.search("fundamentalidade")


def test_markdown_summary_flashcards_mindmap(ctx, tmp_path):
    md = tmp_path / "n.md"
    md.write_text("# Direitos Humanos\n\n" + TEXT + "\n\n## Marcas\n\nUniversalidade consiste em direitos de todas as pessoas, sem privilégios.\n\n## Reciprocidade\n\nReciprocidade significa que todos têm direitos e deveres de respeito.", encoding="utf-8")
    r = ctx.documents.import_file(md)
    s = ctx.documents.local_summary(r.doc_id)
    assert "Resumo extrativo local" in s and "trecho" in s
    assert ctx.documents.local_flashcards(r.doc_id, 5)
    items, text = ctx.documents.mindmap(r.doc_id)
    assert any(i["title"] == "Marcas" for i in items) and "Marcas" in text
    assert ctx.documents.themes(r.doc_id)
    assert len(ctx.documents.derived(r.doc_id)) == 3


def test_delete_removes_everything(ctx, tmp_path):
    p = tmp_path / "a.txt"
    p.write_text(TEXT, encoding="utf-8")
    r = ctx.documents.import_file(p)
    stored = ctx.documents.get(r.doc_id)["stored_path"]
    ctx.documents.local_summary(r.doc_id)
    ctx.documents.delete(r.doc_id)
    from pathlib import Path
    assert not Path(stored).exists()
    assert ctx.documents.search("dignidade") == []
    assert ctx.db.one("SELECT COUNT(*) c FROM doc_derived")["c"] == 0


@pytest.mark.parametrize("name,content,msg", [
    ("virus.exe", b"MZ\x90\x00", "não suportado"),
    ("falso.pdf", b"nao sou pdf", "PDF válido"),
    ("falso.docx", b"nao sou zip", "DOCX válido"),
    ("vazio.txt", b"", "vazio"),
    ("bin.txt", b"MZ\x00\x01binario", "binários"),
])
def test_validation_rejects(tmp_path, name, content, msg):
    p = tmp_path / name
    p.write_bytes(content)
    with pytest.raises(ImportRejected, match=msg):
        validate_file(p)


def test_size_limit(tmp_path):
    p = tmp_path / "grande.txt"
    p.write_bytes(b"a" * (2 * 1024 * 1024))
    with pytest.raises(ImportRejected, match="excede"):
        validate_file(p, max_mb=1)


def test_docx_without_main_part_rejected(tmp_path):
    p = tmp_path / "x.docx"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("qualquer.txt", "oi")
    with pytest.raises(ImportRejected, match="documento principal"):
        validate_file(p)


def test_search_is_injection_safe(ctx, tmp_path):
    p = tmp_path / "a.txt"
    p.write_text(TEXT, encoding="utf-8")
    ctx.documents.import_file(p)
    for q in ['"; DROP TABLE documents; --', "a OR b NEAR(", "*", "'", "dignidade' OR 1=1"]:
        ctx.documents.search(q)           # não pode levantar nem apagar
    assert ctx.db.one("SELECT COUNT(*) c FROM documents")["c"] == 1


def test_original_file_not_modified(ctx, tmp_path):
    p = tmp_path / "orig.txt"
    p.write_text(TEXT, encoding="utf-8")
    before = p.read_bytes()
    ctx.documents.import_file(p)
    assert p.exists() and p.read_bytes() == before


# ------------------------------------------------------------------ OCR (executa só se o Tesseract estiver instalado)
from jarmes.docs.extract import ocr_available  # noqa: E402

needs_ocr = pytest.mark.skipif(not ocr_available(), reason="Tesseract/pytesseract não instalados")


def _text_image(path, text="A dignidade da pessoa humana", size=(1400, 220)):
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 72)
    except OSError:
        font = ImageFont.load_default()
    d.text((40, 60), text, fill="black", font=font)
    img.save(path)
    return path


@needs_ocr
def test_ocr_image_import_marks_result_as_ocr(ctx, tmp_path):
    r = ctx.documents.import_file(_text_image(tmp_path / "anotacao.png"))
    assert r.status == "partial" and any("OCR" in w for w in r.warnings)
    assert ctx.documents.search("dignidade")


@needs_ocr
def test_ocr_recovers_scanned_pdf(ctx, tmp_path):
    from PIL import Image
    img = Image.open(_text_image(tmp_path / "p.png", "Reciprocidade e universalidade dos direitos"))
    pdf = tmp_path / "scan.pdf"
    img.convert("RGB").save(pdf, "PDF")
    r = ctx.documents.import_file(pdf)
    assert r.status in ("full", "partial") and any("OCR aplicado" in w for w in r.warnings)
    assert ctx.documents.search("universalidade")


def test_image_without_ocr_is_stored_but_reported_unreadable(ctx, tmp_path, monkeypatch):
    monkeypatch.setattr("jarmes.docs.extract.ocr_available", lambda: False)
    from PIL import Image
    Image.new("RGB", (50, 50), "white").save(tmp_path / "x.png")
    r = ctx.documents.import_file(tmp_path / "x.png")
    assert r.status == "unreadable" and any("OCR não está disponível" in w for w in r.warnings)

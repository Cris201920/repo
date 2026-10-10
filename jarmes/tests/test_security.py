import os
import stat
import sys

from jarmes.logging_setup import redact, setup_logging
from jarmes.security import SecretStore


def test_secret_roundtrip_and_encrypted_on_disk(tmp_path):
    s = SecretStore(tmp_path, use_keyring=False)
    s.set("ai_api_key", "sk-segredo-1234567890")
    assert s.get("ai_api_key") == "sk-segredo-1234567890"
    raw = (tmp_path / "secrets.enc").read_bytes()
    assert b"sk-segredo" not in raw
    s2 = SecretStore(tmp_path, use_keyring=False)          # nova instância lê do disco
    assert s2.get("ai_api_key") == "sk-segredo-1234567890"
    assert s2.source("ai_api_key") == "armazenamento criptografado"


def test_env_overrides_and_is_not_persisted(tmp_path):
    s = SecretStore(tmp_path, env={"JARMES_AI_API_KEY": "from-env"}, use_keyring=False)
    assert s.get("ai_api_key") == "from-env" and s.source("ai_api_key").startswith("variável")
    assert not (tmp_path / "secrets.enc").exists()


def test_key_file_permissions(tmp_path):
    if sys.platform.startswith("win"):
        return
    s = SecretStore(tmp_path, use_keyring=False)
    s.set("x", "y")
    assert stat.S_IMODE(os.stat(tmp_path / "secret.key").st_mode) == 0o600
    assert stat.S_IMODE(os.stat(tmp_path / "secrets.enc").st_mode) == 0o600


def test_wrong_key_does_not_crash(tmp_path):
    s = SecretStore(tmp_path, use_keyring=False)
    s.set("a", "b")
    (tmp_path / "secret.key").unlink()                      # chave perdida
    s2 = SecretStore(tmp_path, use_keyring=False)
    assert s2.get("a") is None


def test_wipe(tmp_path):
    s = SecretStore(tmp_path, use_keyring=False)
    s.set("a", "b")
    s.wipe()
    assert not (tmp_path / "secrets.enc").exists() and not (tmp_path / "secret.key").exists()


def test_redaction():
    out = redact("erro com api_key=sk-abcdef123456789 e Authorization: Bearer abcdef123456 e ?access_token=xyz123&a=1")
    assert "abcdef123456" not in out and "sk-abcdef" not in out and "xyz123" not in out and "a=1" in out


def test_log_file_never_contains_secret(tmp_path):
    import logging
    setup_logging(tmp_path)
    logging.getLogger("jarmes.teste").error("falha chave sk-ZZZZZZZZZZZZZZZZ token=abc123456789")
    for h in logging.getLogger("jarmes").handlers:
        h.flush()
    text = (tmp_path / "jarmes.log").read_text(encoding="utf-8")
    assert "ZZZZZZZZ" not in text and "abc123456789" not in text and "[REDACTED]" in text


def test_secrets_not_in_database(ctx):
    ctx.secrets.set("ai_api_key", "sk-nao-pode-vazar-123456")
    dump = "".join(str(dict(r)) for t in ctx.db.user_tables() for r in ctx.db.query(f"SELECT * FROM {t}"))
    assert "nao-pode-vazar" not in dump
    exported = ctx.export_data()
    blob = "".join(p.read_text(encoding="utf-8", errors="ignore") for p in exported.iterdir())
    assert "nao-pode-vazar" not in blob

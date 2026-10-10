"""Logs em arquivo com rotação e remoção de segredos."""
from __future__ import annotations

import logging
import re
from logging.handlers import RotatingFileHandler
from pathlib import Path

# (padrão, mantém_prefixo): se mantém_prefixo, o grupo 1 é preservado e só o valor é ocultado
_PATTERNS = [
    (re.compile(r"sk-[A-Za-z0-9_\-]{8,}"), False),
    (re.compile(r"AIza[0-9A-Za-z_\-]{20,}"), False),
    (re.compile(r"ya29\.[0-9A-Za-z_\-]{10,}"), False),
    (re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]{8,}"), True),
    (re.compile(r"(?i)((?:api[_-]?key|token|secret|password|senha|authorization|client_secret)\s*[=:]\s*)[^\s,;&'\"]+"), True),
    (re.compile(r"(?i)([?&](?:key|access_token|refresh_token|code|client_secret)=)[^&\s]+"), True),
]


def redact(text: str) -> str:
    """Remove chaves/tokens de qualquer texto antes de gravar em log ou exibir."""
    out = str(text)
    for pat, keep_prefix in _PATTERNS:
        if keep_prefix:
            out = pat.sub(lambda m: m.group(1) + "[REDACTED]", out)
        else:
            out = pat.sub("[REDACTED]", out)
    return out


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = redact(record.getMessage())
            record.args = ()
        except Exception:  # nunca derrubar o app por causa de log
            pass
        return True


def setup_logging(logs_dir: Path, level: int = logging.INFO) -> logging.Logger:
    logs_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("jarmes")
    logger.setLevel(level)
    for h in list(logger.handlers):
        logger.removeHandler(h)
    handler = RotatingFileHandler(logs_dir / "jarmes.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    handler.addFilter(RedactingFilter())
    logger.addHandler(handler)
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    console.addFilter(RedactingFilter())
    logger.addHandler(console)
    logger.propagate = False
    return logger

"""Pequeno cliente HTTP com mensagens de erro seguras (sem expor tokens)."""
from __future__ import annotations

import json
import logging
import socket
import urllib.error
import urllib.parse
import urllib.request

from ..logging_setup import redact

log = logging.getLogger("jarmes.http")
USER_AGENT = "JARMES/0.1 (+assistente pessoal local)"


class IntegrationError(RuntimeError):
    """Falha de integração; `str(exc)` é seguro para mostrar ao usuário."""


def request(method: str, url: str, *, headers: dict | None = None, data: bytes | None = None,
            timeout: int = 30, max_bytes: int = 50 * 1024 * 1024) -> tuple[int, dict, bytes]:
    hdrs = {"User-Agent": USER_AGENT}
    hdrs.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise IntegrationError("A resposta excede o tamanho máximo permitido.")
            return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as exc:
        body = exc.read()[:2000]
        log.warning("HTTP %s em %s: %s", exc.code, urllib.parse.urlsplit(url).netloc, redact(body.decode("utf-8", "replace")))
        return exc.code, dict(exc.headers or {}), body
    except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError, OSError) as exc:
        reason = getattr(exc, "reason", exc)
        log.warning("Falha de rede em %s: %s", urllib.parse.urlsplit(url).netloc, type(reason).__name__)
        raise IntegrationError("Sem conexão com o serviço (verifique a internet, proxy ou firewall).") from None


def request_json(method: str, url: str, **kw) -> dict:
    status, _h, body = request(method, url, **kw)
    try:
        data = json.loads(body.decode("utf-8")) if body else {}
    except ValueError:
        raise IntegrationError(f"Resposta inválida do serviço (HTTP {status}).") from None
    if status >= 400:
        msg = ""
        if isinstance(data, dict):
            err = data.get("error")
            msg = err.get("message") if isinstance(err, dict) else (data.get("error_description") or err or "")
        if status in (401, 403):
            raise IntegrationError(f"Acesso negado (HTTP {status}). {msg} Reconecte a conta se necessário.".strip())
        raise IntegrationError(f"O serviço retornou HTTP {status}. {msg}".strip())
    return data

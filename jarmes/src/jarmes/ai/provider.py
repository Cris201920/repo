"""Adaptadores de provedores de IA (HTTP com urllib; sem SDKs). Nenhuma chave fica no código."""
from __future__ import annotations

import json
import logging
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass

from ..logging_setup import redact

log = logging.getLogger("jarmes.ai")

DEFAULT_MODELS = {"anthropic": "claude-sonnet-5-5", "openai": "gpt-4o-mini"}
DEFAULT_BASE = {"anthropic": "https://api.anthropic.com", "openai": "https://api.openai.com/v1"}


class AIUnavailable(RuntimeError):
    """IA indisponível (sem configuração, sem rede, chave inválida...). A mensagem é segura para exibir."""


@dataclass
class ChatMessage:
    role: str       # user | assistant
    content: str


class AIClient:
    def __init__(self, provider: str, api_key: str | None, model: str = "", base_url: str = "", timeout: int = 60):
        self.provider = provider
        self.api_key = api_key
        self.model = model or DEFAULT_MODELS.get(provider, "")
        self.base_url = (base_url or DEFAULT_BASE.get(provider, "")).rstrip("/")
        self.timeout = timeout

    # --- estado ------------------------------------------------------------------
    def status(self) -> tuple[str, str]:
        """(estado, detalhe): configurado | nao_configurado."""
        if self.provider in ("", "none"):
            return "nao_configurado", "Nenhum provedor de IA selecionado (Configurações → Inteligência artificial)."
        local = self.base_url.startswith(("http://localhost", "http://127.0.0.1"))
        if not self.api_key and not local:
            return "nao_configurado", "Chave de API ausente. Defina JARMES_AI_API_KEY no .env ou salve em Configurações."
        return "configurado", f"{self.provider} · modelo {self.model} (conexão não testada até o primeiro uso)"

    @property
    def available(self) -> bool:
        return self.status()[0] == "configurado"

    # --- chamada --------------------------------------------------------------------
    def chat(self, system: str, messages: list[ChatMessage], max_tokens: int = 1500, temperature: float = 0.3) -> str:
        state, detail = self.status()
        if state != "configurado":
            raise AIUnavailable(detail)
        if self.provider == "anthropic":
            url = f"{self.base_url}/v1/messages"
            headers = {"x-api-key": self.api_key or "", "anthropic-version": "2023-06-01", "content-type": "application/json"}
            body = {"model": self.model, "max_tokens": max_tokens, "temperature": temperature, "system": system,
                    "messages": [{"role": m.role, "content": m.content} for m in messages]}
        elif self.provider == "openai":
            url = f"{self.base_url}/chat/completions"
            headers = {"content-type": "application/json"}
            if self.api_key:
                headers["authorization"] = f"Bearer {self.api_key}"
            body = {"model": self.model, "max_tokens": max_tokens, "temperature": temperature,
                    "messages": [{"role": "system", "content": system}] + [{"role": m.role, "content": m.content} for m in messages]}
        else:
            raise AIUnavailable(f"Provedor desconhecido: {self.provider}")
        data = self._post(url, headers, body)
        try:
            if self.provider == "anthropic":
                return "".join(b.get("text", "") for b in data["content"] if b.get("type") == "text").strip()
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError):
            raise AIUnavailable("Resposta inesperada do provedor de IA.") from None

    def _post(self, url: str, headers: dict, body: dict) -> dict:
        req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = redact(exc.read().decode("utf-8", "replace")[:300])
            log.warning("IA HTTP %s: %s", exc.code, detail)
            if exc.code in (401, 403):
                raise AIUnavailable("O provedor recusou a chave de API (401/403). Confira a chave e as permissões.") from None
            if exc.code == 404:
                raise AIUnavailable("Modelo ou endereço não encontrado (404). Confira o nome do modelo nas Configurações.") from None
            if exc.code == 429:
                raise AIUnavailable("Limite de uso do provedor atingido (429). Tente novamente em instantes.") from None
            raise AIUnavailable(f"O provedor retornou erro HTTP {exc.code}.") from None
        except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError, OSError) as exc:
            log.warning("IA sem rede: %s", type(exc).__name__)
            raise AIUnavailable("Sem conexão com o provedor de IA (verifique a internet). Os recursos locais continuam disponíveis.") from None
        except ValueError:
            raise AIUnavailable("Resposta ilegível do provedor de IA.") from None

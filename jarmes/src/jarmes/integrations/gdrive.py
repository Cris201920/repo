"""Google Drive via OAuth 2.0 (aplicativo instalado, PKCE, redirecionamento local) — escopo somente leitura por padrão.

Você precisa criar um "ID do cliente OAuth" do tipo *App para computador* no Google Cloud Console e informar
JARMES_GOOGLE_CLIENT_ID (e JARMES_GOOGLE_CLIENT_SECRET, se o Google fornecer um). Veja docs/INTEGRACOES.md.
Tokens ficam criptografados (SecretStore); a senha da conta Google nunca passa pelo JARMES."""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from .http import IntegrationError, request, request_json

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
API = "https://www.googleapis.com/drive/v3"

GOOGLE_NATIVE = {
    "application/vnd.google-apps.document": ("application/pdf", ".pdf"),
    "application/vnd.google-apps.presentation": ("application/pdf", ".pdf"),
}
SUPPORTED_MIME = {
    "application/pdf", "text/plain", "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    *GOOGLE_NATIVE.keys(),
}
EXT_BY_MIME = {"application/pdf": ".pdf", "text/plain": ".txt", "text/markdown": ".md",
               "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"}


def _escape_q(text: str) -> str:
    return text.replace("\\", "\\\\").replace("'", "\\'")


class GoogleDrive:
    def __init__(self, secrets_store, scope: str = "https://www.googleapis.com/auth/drive.readonly"):
        self.secrets = secrets_store
        self.scope = scope
        self.auth_url, self.token_url, self.revoke_url, self.api = AUTH_URL, TOKEN_URL, REVOKE_URL, API

    # --- estado -------------------------------------------------------------------------
    @property
    def client_id(self) -> str | None:
        return self.secrets.get("google_client_id")

    @property
    def client_secret(self) -> str | None:
        return self.secrets.get("google_client_secret")

    def _tokens(self) -> dict:
        raw = self.secrets.get("gdrive_tokens")
        try:
            return json.loads(raw) if raw else {}
        except ValueError:
            return {}

    def status(self) -> tuple[str, str]:
        if not self.client_id:
            return "nao_configurado", "Falta o ID do cliente OAuth (JARMES_GOOGLE_CLIENT_ID). Veja docs/INTEGRACOES.md."
        t = self._tokens()
        if not t.get("refresh_token") and not t.get("access_token"):
            return "desconectado", "Configurado, mas nenhuma conta Google conectada. Clique em Conectar."
        return "conectado", f"Conta conectada · permissão: {'somente leitura' if 'readonly' in t.get('scope', self.scope) else t.get('scope', '')}"

    # --- OAuth ----------------------------------------------------------------------------
    def authorize(self, timeout: int = 180, open_browser: bool = True) -> dict:
        """Fluxo interativo: abre o navegador, recebe o código em 127.0.0.1 e troca por tokens. Bloqueante."""
        if not self.client_id:
            raise IntegrationError("Configure o ID do cliente OAuth antes de conectar (JARMES_GOOGLE_CLIENT_ID).")
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        state = secrets.token_urlsafe(24)
        result: dict = {}
        done = threading.Event()

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                qs = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                if qs.get("state", [""])[0] != state:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Estado invalido.")
                    return
                result["code"] = qs.get("code", [""])[0]
                result["error"] = qs.get("error", [""])[0]
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                msg = "Conexão autorizada. Pode fechar esta aba e voltar ao JARMES." if result["code"] else "Autorização negada."
                self.wfile.write(f"<html><body style='font-family:sans-serif'><h2>JARMES</h2><p>{msg}</p></body></html>".encode())
                done.set()

            def log_message(self, *a):  # silencioso
                pass

        server = HTTPServer(("127.0.0.1", 0), Handler)
        redirect = f"http://127.0.0.1:{server.server_port}"
        params = {"client_id": self.client_id, "redirect_uri": redirect, "response_type": "code", "scope": self.scope,
                  "code_challenge": challenge, "code_challenge_method": "S256", "state": state,
                  "access_type": "offline", "prompt": "consent"}
        url = f"{self.auth_url}?{urllib.parse.urlencode(params)}"
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            if open_browser:
                webbrowser.open(url)
            if not done.wait(timeout):
                raise IntegrationError("Tempo esgotado aguardando a autorização no navegador.")
        finally:
            server.shutdown()
            server.server_close()
        if not result.get("code"):
            raise IntegrationError("Autorização não concedida." + (f" ({result.get('error')})" if result.get("error") else ""))
        return self._exchange({"grant_type": "authorization_code", "code": result["code"], "redirect_uri": redirect,
                               "code_verifier": verifier})

    def _exchange(self, extra: dict) -> dict:
        body = {"client_id": self.client_id, **extra}
        if self.client_secret:
            body["client_secret"] = self.client_secret
        data = request_json("POST", self.token_url, data=urllib.parse.urlencode(body).encode(),
                            headers={"Content-Type": "application/x-www-form-urlencoded"})
        old = self._tokens()
        tokens = {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token") or old.get("refresh_token"),
            "expires_at": time.time() + int(data.get("expires_in", 3600)) - 60,
            "scope": data.get("scope", self.scope),
        }
        self.secrets.set("gdrive_tokens", json.dumps(tokens))
        return {"scope": tokens["scope"]}

    def _access_token(self) -> str:
        t = self._tokens()
        if not t:
            raise IntegrationError("Google Drive não conectado.")
        if t.get("expires_at", 0) > time.time() and t.get("access_token"):
            return t["access_token"]
        if not t.get("refresh_token"):
            raise IntegrationError("Sessão do Google expirada. Reconecte a conta.")
        self._exchange({"grant_type": "refresh_token", "refresh_token": t["refresh_token"]})
        return self._tokens()["access_token"]

    def disconnect(self, revoke: bool = True) -> str:
        t = self._tokens()
        msg = "Conta desconectada."
        if revoke and (t.get("refresh_token") or t.get("access_token")):
            try:
                request("POST", self.revoke_url, data=urllib.parse.urlencode({"token": t.get("refresh_token") or t["access_token"]}).encode(),
                        headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=15)
                msg = "Conta desconectada e acesso revogado no Google."
            except IntegrationError:
                msg = ("Conta desconectada localmente, mas não foi possível revogar no Google agora (sem conexão). "
                       "Revogue em myaccount.google.com/permissions.")
        self.secrets.delete("gdrive_tokens")
        return msg

    # --- arquivos ---------------------------------------------------------------------------
    def _get(self, path: str, params: dict) -> dict:
        url = f"{self.api}{path}?{urllib.parse.urlencode(params)}"
        return request_json("GET", url, headers={"Authorization": f"Bearer {self._access_token()}"})

    def list_files(self, name_contains: str = "", page_size: int = 50) -> list[dict]:
        q = ["trashed = false", "(" + " or ".join(f"mimeType = '{m}'" for m in sorted(SUPPORTED_MIME)) + ")"]
        if name_contains.strip():
            q.append(f"name contains '{_escape_q(name_contains.strip())}'")
        data = self._get("/files", {"q": " and ".join(q), "pageSize": min(max(page_size, 1), 100),
                                    "fields": "files(id,name,mimeType,size,modifiedTime,webViewLink)",
                                    "orderBy": "modifiedTime desc", "spaces": "drive"})
        return data.get("files", [])

    def download(self, file_id: str, name: str, mime: str, dest_dir: Path, max_mb: int = 100) -> Path:
        dest_dir = Path(dest_dir)
        dest_dir.mkdir(parents=True, exist_ok=True)
        token = self._access_token()
        if mime in GOOGLE_NATIVE:
            export_mime, ext = GOOGLE_NATIVE[mime]
            url = f"{self.api}/files/{urllib.parse.quote(file_id)}/export?{urllib.parse.urlencode({'mimeType': export_mime})}"
        else:
            ext = EXT_BY_MIME.get(mime, Path(name).suffix or ".bin")
            url = f"{self.api}/files/{urllib.parse.quote(file_id)}?alt=media"
        status, _h, body = request("GET", url, headers={"Authorization": f"Bearer {token}"}, timeout=120,
                                   max_bytes=max_mb * 1024 * 1024)
        if status >= 400:
            raise IntegrationError(f"Não foi possível baixar o arquivo (HTTP {status}). Verifique as permissões.")
        safe = "".join(c for c in Path(name).stem if c.isalnum() or c in " -_()")[:80] or "documento"
        target = dest_dir / f"{safe}{ext}"
        n = 1
        while target.exists():
            target = dest_dir / f"{safe}-{n}{ext}"
            n += 1
        target.write_bytes(body)
        return target

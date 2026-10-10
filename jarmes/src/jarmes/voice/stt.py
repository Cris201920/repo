"""Reconhecimento de fala. Nenhum áudio é enviado à internet sem o consentimento explícito do usuário."""
from __future__ import annotations

import json
import logging
import uuid
import wave
from pathlib import Path

from ..integrations.http import IntegrationError, request

log = logging.getLogger("jarmes.stt")


class STTUnavailable(RuntimeError):
    """Reconhecimento indisponível; a mensagem é segura para mostrar ao usuário."""


def vosk_installed() -> bool:
    try:
        import vosk  # type: ignore  # noqa: F401
        return True
    except Exception:
        return False


def stt_status(ctx) -> tuple[str, str]:
    engine = ctx.settings.get("stt_engine")
    if not ctx.settings.get("mic_enabled"):
        return "indisponivel", "Microfone desativado nas configurações."
    if engine == "off":
        return "nao_configurado", "Escolha um mecanismo de reconhecimento em Configurações → Voz (local Vosk ou remoto)."
    if engine == "vosk":
        if not vosk_installed():
            return "nao_configurado", "Pacote 'vosk' não instalado (pip install vosk)."
        model = ctx.settings.get("vosk_model_path")
        if not model or not Path(model).is_dir():
            return "nao_configurado", "Informe a pasta do modelo Vosk pt-BR em Configurações → Voz."
        return "configurado", "Vosk local (offline) · nenhum áudio sai do computador."
    if engine == "remote_openai":
        if not ctx.secrets.get("ai_api_key") and not ctx.secrets.get("stt_api_key"):
            return "nao_configurado", "Falta chave de API para o reconhecimento remoto."
        if not ctx.settings.get("stt_remote_consent"):
            return "nao_configurado", "Serviço remoto: aguardando sua autorização para enviar áudio (será pedida ao usar)."
        return "configurado", "Remoto (API compatível com OpenAI/Whisper) · o áudio é enviado ao provedor."
    return "indisponivel", "Mecanismo desconhecido."


class VoskTranscriber:
    def __init__(self, model_path: str):
        try:
            import vosk  # type: ignore
        except Exception:
            raise STTUnavailable("O pacote 'vosk' não está instalado.") from None
        if not model_path or not Path(model_path).is_dir():
            raise STTUnavailable("Modelo Vosk não encontrado. Baixe um modelo pt-BR e informe a pasta em Configurações → Voz.")
        vosk.SetLogLevel(-1)
        self._vosk = vosk
        self.model = vosk.Model(model_path)

    def transcribe(self, wav_path: Path) -> str:
        with wave.open(str(wav_path), "rb") as w:
            rec = self._vosk.KaldiRecognizer(self.model, w.getframerate())
            while True:
                data = w.readframes(4000)
                if not data:
                    break
                rec.AcceptWaveform(data)
            return json.loads(rec.FinalResult()).get("text", "").strip()


class RemoteTranscriber:
    """POST multipart em {base}/audio/transcriptions (API compatível com OpenAI)."""

    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1", model: str = "whisper-1", language: str = "pt"):
        if not api_key:
            raise STTUnavailable("Falta a chave de API para o reconhecimento remoto.")
        self.api_key, self.base_url, self.model, self.language = api_key, base_url.rstrip("/"), model, language

    def transcribe(self, wav_path: Path) -> str:
        boundary = uuid.uuid4().hex
        audio = Path(wav_path).read_bytes()
        parts = []
        for name, value in (("model", self.model), ("language", self.language), ("response_format", "json")):
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="fala.wav"\r\n'
                     f"Content-Type: audio/wav\r\n\r\n".encode() + audio + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        try:
            status, _h, body = request("POST", f"{self.base_url}/audio/transcriptions", data=b"".join(parts), timeout=60,
                                       headers={"Authorization": f"Bearer {self.api_key}",
                                                "Content-Type": f"multipart/form-data; boundary={boundary}"})
        except IntegrationError as exc:
            raise STTUnavailable(str(exc)) from None
        if status in (401, 403):
            raise STTUnavailable("O serviço de voz recusou a chave de API.")
        if status >= 400:
            raise STTUnavailable(f"O serviço de voz retornou HTTP {status}.")
        try:
            return json.loads(body.decode("utf-8")).get("text", "").strip()
        except ValueError:
            raise STTUnavailable("Resposta ilegível do serviço de voz.") from None


def build_transcriber(ctx):
    """Cria o transcritor conforme as configurações; levanta STTUnavailable com instruções claras."""
    s = ctx.settings
    if not s.get("mic_enabled"):
        raise STTUnavailable("O microfone está desativado nas configurações.")
    engine = s.get("stt_engine")
    if engine == "off":
        raise STTUnavailable("Reconhecimento de voz não configurado (Configurações → Voz).")
    if engine == "vosk":
        return VoskTranscriber(s.get("vosk_model_path"))
    if engine == "remote_openai":
        if not s.get("stt_remote_consent"):
            raise STTUnavailable("Você ainda não autorizou o envio de áudio ao serviço remoto.")
        key = ctx.secrets.get("stt_api_key") or ctx.secrets.get("ai_api_key") or ""
        base = s.get("ai_base_url") if s.get("ai_provider") == "openai" and s.get("ai_base_url") else "https://api.openai.com/v1"
        return RemoteTranscriber(key, base)
    raise STTUnavailable("Mecanismo de reconhecimento desconhecido.")

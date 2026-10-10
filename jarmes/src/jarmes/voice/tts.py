"""Síntese de voz local via Qt TextToSpeech (usa as vozes instaladas no Windows)."""
from __future__ import annotations

import logging

log = logging.getLogger("jarmes.tts")


def _qt_tts():
    from PySide6 import QtTextToSpeech  # import tardio: pode faltar libs em alguns ambientes
    return QtTextToSpeech


def list_engines() -> list[str]:
    try:
        return list(_qt_tts().QTextToSpeech.availableEngines())
    except Exception:
        return []


def tts_status(ctx) -> tuple[str, str]:
    if not ctx.settings.get("tts_enabled"):
        return "indisponivel", "Resposta falada desativada nas configurações."
    engines = list_engines()
    if not engines:
        return "nao_configurado", "Nenhum mecanismo de síntese de voz encontrado neste sistema (no Windows usa vozes SAPI/OneCore)."
    return "configurado", f"Mecanismo: {', '.join(engines)}"


class Speaker:
    """Envolve QTextToSpeech. Se não houver mecanismo, `available` é False e speak() é um no-op explícito."""

    def __init__(self, settings):
        self.settings = settings
        self.engine = None
        self.error = ""
        try:
            mod = _qt_tts()
            if not mod.QTextToSpeech.availableEngines():
                raise RuntimeError("sem mecanismos TTS")
            self.engine = mod.QTextToSpeech()
            self._mod = mod
            self.apply_settings()
        except Exception as exc:
            self.engine = None
            self.error = f"Síntese de voz indisponível ({type(exc).__name__})."
            log.info(self.error)

    @property
    def available(self) -> bool:
        return self.engine is not None

    def voices(self) -> list[tuple[str, str]]:
        """(nome, descrição) das vozes disponíveis, pt-BR primeiro."""
        if not self.engine:
            return []
        out = []
        for v in self.engine.availableVoices():
            loc = v.locale().name()
            gender = {self._mod.QVoice.Gender.Male: "masculina", self._mod.QVoice.Gender.Female: "feminina"}.get(v.gender(), "")
            out.append((v.name(), f"{v.name()} · {loc} · {gender}".strip(" ·")))
        out.sort(key=lambda x: (not x[1].lower().count("pt"), x[0]))
        return out

    def apply_settings(self) -> None:
        if not self.engine:
            return
        self.engine.setVolume(max(0, min(100, int(self.settings.get("volume")))) / 100.0)
        self.engine.setRate(float(self.settings.get("voice_rate")))
        wanted = self.settings.get("tts_voice")
        chosen = None
        for v in self.engine.availableVoices():
            if wanted and v.name() == wanted:
                chosen = v
                break
        if chosen is None:  # preferência: pt-BR masculina madura
            pt = [v for v in self.engine.availableVoices() if v.locale().name().lower().startswith("pt")]
            male = [v for v in pt if v.gender() == self._mod.QVoice.Gender.Male]
            chosen = (male or pt or [None])[0]
        if chosen is not None:
            self.engine.setVoice(chosen)

    def speak(self, text: str) -> bool:
        if not self.engine or not self.settings.get("tts_enabled") or not text.strip():
            return False
        self.apply_settings()
        self.engine.say(text[:2500])
        return True

    def stop(self) -> None:
        if self.engine:
            self.engine.stop()

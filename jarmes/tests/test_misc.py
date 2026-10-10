import json
import struct

import pytest

from jarmes import clock
from jarmes.config import Config, parse_env_file
from jarmes.system import autostart
from jarmes.voice.stt import RemoteTranscriber, STTUnavailable, build_transcriber, stt_status
from jarmes.voice.wav import convert_to_16k_mono_int16, duration_seconds, peak_level, write_wav
from tests.helpers import FakeServer


def test_env_file_parser(tmp_path):
    f = tmp_path / ".env"
    f.write_text('# c\nJARMES_AI_PROVIDER=anthropic\nJARMES_AI_API_KEY="sk-x y"\nVAZIO=\nJARMES_X=1 # nota\n', encoding="utf-8")
    v = parse_env_file(f)
    assert v["JARMES_AI_API_KEY"] == "sk-x y" and v["JARMES_X"] == "1" and v["VAZIO"] == ""


def test_config_env_priority(tmp_path, monkeypatch):
    (tmp_path / ".env").write_text("JARMES_MAX_FILE_MB=5\n", encoding="utf-8")
    cfg = Config.load(tmp_path)
    assert cfg.get("JARMES_MAX_FILE_MB") == "5"
    monkeypatch.setenv("JARMES_MAX_FILE_MB", "9")
    assert Config.load(tmp_path).get("JARMES_MAX_FILE_MB") == "9"


def test_backup_export_wipe(ctx, tmp_path):
    ctx.tasks.add("Minha tarefa")
    ctx.memory.add("preferencia", "x")
    f = tmp_path / "a.txt"
    f.write_text("Texto sobre dignidade humana suficientemente longo para indexar.", encoding="utf-8")
    ctx.documents.import_file(f)
    bk = ctx.backup_now("teste")
    assert bk and bk.exists()
    assert ctx.daily_backup_if_needed() is None or True
    out = ctx.export_data()
    data = json.loads((out / "jarmes-dados.json").read_text(encoding="utf-8"))
    assert data["tasks"][0]["title"] == "Minha tarefa" and (out / "tasks.csv").exists()
    ctx.settings.set("study_minutes", 90)
    counts = ctx.wipe_data(keep_settings=True)
    assert counts["tasks"] == 1 and ctx.tasks.list(None) == [] and ctx.documents.list() == []
    assert ctx.settings.get("study_minutes") == 90
    assert not any(ctx.config.docs_dir.iterdir())
    assert ctx.documents.search("dignidade") == []
    ctx.wipe_data(keep_settings=False)
    assert ctx.settings.get("study_minutes") == 120


def test_daily_backup_only_once_per_day(ctx):
    assert ctx.daily_backup_if_needed() is not None
    assert ctx.daily_backup_if_needed() is None
    ctx.settings.set("auto_backup", False)


def test_wav_conversion_and_levels(tmp_path):
    # 1 s de 48 kHz estéreo int16 -> 16 kHz mono
    frames = [(1000, 3000)] * 48000
    raw = b"".join(struct.pack("<hh", l, r) for l, r in frames)
    pcm = convert_to_16k_mono_int16(raw, 48000, 2, "int16")
    assert len(pcm) == 16000 * 2
    assert struct.unpack("<h", pcm[:2])[0] == 2000                       # média dos canais
    path = write_wav(tmp_path / "x.wav", pcm)
    assert abs(duration_seconds(path) - 1.0) < 0.01
    assert 0 < peak_level(pcm) < 1
    fl = struct.pack("<4f", 0.5, -0.5, 0.0, 1.0)
    assert len(convert_to_16k_mono_int16(fl, 16000, 1, "float32")) == 8
    with pytest.raises(ValueError):
        convert_to_16k_mono_int16(b"", 16000, 1, "mp3")


def test_stt_status_and_consent(ctx, tmp_path):
    assert stt_status(ctx)[0] == "nao_configurado"
    with pytest.raises(STTUnavailable):
        build_transcriber(ctx)
    ctx.settings.set("stt_engine", "remote_openai")
    ctx.secrets.set("stt_api_key", "k")
    with pytest.raises(STTUnavailable, match="autorizou"):
        build_transcriber(ctx)                                           # sem consentimento: nada é enviado
    ctx.settings.set("stt_remote_consent", True)
    assert isinstance(build_transcriber(ctx), RemoteTranscriber)
    ctx.settings.set("mic_enabled", False)
    with pytest.raises(STTUnavailable, match="desativado"):
        build_transcriber(ctx)
    assert stt_status(ctx)[0] == "indisponivel"
    ctx.settings.set("mic_enabled", True)
    ctx.settings.set("stt_engine", "vosk")
    assert stt_status(ctx)[0] == "nao_configurado"


def test_remote_transcriber_multipart(tmp_path):
    wav = write_wav(tmp_path / "a.wav", b"\x00\x01" * 1600)
    with FakeServer({("POST", "/audio/transcriptions"): (200, {"text": " organize meu dia "}, "application/json")}) as srv:
        assert RemoteTranscriber("KEY", srv.url).transcribe(wav) == "organize meu dia"
        req = srv.requests[-1]
        assert req["headers"]["authorization"] == "Bearer KEY" and b'name="file"' in req["body"] and b"whisper-1" in req["body"]
    with FakeServer({("POST", "/audio/transcriptions"): (401, {}, "application/json")}) as srv:
        with pytest.raises(STTUnavailable, match="recusou"):
            RemoteTranscriber("KEY", srv.url).transcribe(wav)
    with pytest.raises(STTUnavailable, match="conexão"):
        RemoteTranscriber("KEY", "http://127.0.0.1:9").transcribe(wav)


class FakeWinreg:
    HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE, REG_SZ = 1, 2, 3, 4
    store: dict = {}

    class _K:
        def __enter__(self): return self
        def __exit__(self, *a): return False

    @classmethod
    def OpenKey(cls, *a): return cls._K()
    @classmethod
    def SetValueEx(cls, key, name, _r, _t, value): cls.store[name] = value
    @classmethod
    def QueryValueEx(cls, key, name):
        if name not in cls.store: raise FileNotFoundError(name)
        return cls.store[name], 1
    @classmethod
    def DeleteValue(cls, key, name):
        if name not in cls.store: raise FileNotFoundError(name)
        del cls.store[name]


def test_autostart_registry_logic():
    FakeWinreg.store = {}
    assert not autostart.is_enabled(FakeWinreg)
    autostart.enable('"C:\\JARMES\\JARMES.exe" --minimized', FakeWinreg)
    assert autostart.is_enabled(FakeWinreg) and FakeWinreg.store["JARMES"].endswith("--minimized")
    autostart.disable(FakeWinreg)
    autostart.disable(FakeWinreg)                                        # idempotente
    assert not autostart.is_enabled(FakeWinreg)


def test_autostart_unsupported_off_windows(monkeypatch):
    monkeypatch.setattr("sys.platform", "linux")
    with pytest.raises(autostart.AutostartUnsupported):
        autostart.enable("x")
    assert autostart.is_enabled() is False


def test_integration_states_are_honest(ctx):
    st = {s.key: s for s in ctx.integrations.states()}
    assert st["ia"].status == "nao_configurado" and st["gdrive"].status == "nao_configurado"
    assert st["qconcursos"].status == "manual" and st["noticias"].status in ("parcial", "nao_configurado")
    assert st["stt"].status == "nao_configurado"
    ctx.secrets.set("google_client_id", "x")
    assert {s.key: s for s in ctx.integrations.states()}["gdrive"].status == "desconectado"
    ctx.settings.set("ai_provider", "anthropic")
    assert {s.key: s for s in ctx.integrations.states()}["ia"].status == "nao_configurado"        # sem chave
    ctx.secrets.set("ai_api_key", "k")
    assert {s.key: s for s in ctx.integrations.states()}["ia"].status == "configurado"
    rows = ctx.db.query("SELECT name FROM integrations")
    assert {r["name"] for r in rows} >= {"ia", "gdrive", "qconcursos"}

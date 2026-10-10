"""Utilitários de áudio sem dependências nativas (Python 3.13 não tem `audioop`)."""
from __future__ import annotations

import array
import struct
import wave
from pathlib import Path


def convert_to_16k_mono_int16(raw: bytes, sample_rate: int, channels: int, sample_format: str) -> bytes:
    """Converte PCM (int16 | int32 | float32 | uint8) para 16 kHz, mono, int16."""
    if sample_format == "int16":
        samples = array.array("h")
        samples.frombytes(raw[: len(raw) - len(raw) % 2])
        vals = list(samples)
    elif sample_format == "float32":
        n = len(raw) // 4
        vals = [max(-32768, min(32767, int(v * 32767))) for v in struct.unpack(f"<{n}f", raw[: n * 4])]
    elif sample_format == "int32":
        n = len(raw) // 4
        vals = [v >> 16 for v in struct.unpack(f"<{n}i", raw[: n * 4])]
    elif sample_format == "uint8":
        vals = [(b - 128) << 8 for b in raw]
    else:
        raise ValueError(f"Formato de áudio não suportado: {sample_format}")
    if channels > 1:
        frames = len(vals) // channels
        vals = [sum(vals[i * channels:(i + 1) * channels]) // channels for i in range(frames)]
    if sample_rate != 16000 and vals:
        ratio = sample_rate / 16000
        out_len = int(len(vals) / ratio)
        res = []
        for i in range(out_len):
            pos = i * ratio
            j = int(pos)
            frac = pos - j
            a = vals[j]
            b = vals[j + 1] if j + 1 < len(vals) else a
            res.append(int(a + (b - a) * frac))
        vals = res
    return struct.pack(f"<{len(vals)}h", *vals)


def write_wav(path: Path, pcm16_mono_16k: bytes) -> Path:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(pcm16_mono_16k)
    return path


def peak_level(pcm16: bytes) -> float:
    if len(pcm16) < 2:
        return 0.0
    samples = array.array("h")
    samples.frombytes(pcm16[: len(pcm16) - len(pcm16) % 2])
    return min(1.0, max(abs(s) for s in samples) / 32768.0) if samples else 0.0


def duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / float(w.getframerate())

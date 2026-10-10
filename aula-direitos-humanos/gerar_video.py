#!/usr/bin/env python3
"""Gera a aula em vídeo (MP4 1920x1080, 24 fps) a partir do storyboard.

Uso:
  python gerar_video.py                 # gera tudo em out/
  python gerar_video.py --preview       # só imagens de pré-visualização das cenas (sem áudio/vídeo)
  python gerar_video.py --speed 140     # velocidade da fala (palavras/min aprox. do espeak-ng)
Requisitos: Python 3, Pillow, numpy, ffmpeg, espeak-ng + mbrola-br1 (voz brasileira MBROLA).
A voz é sintética (espeak-ng/MBROLA). Para voz mais natural, substitua os WAVs por uma narração humana ou TTS neural
(veja README.md: a montagem usa out/work/<cena>_<n>.wav)."""
from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import engine as E  # noqa: E402
import storyboard as SB  # noqa: E402

OUT = Path(__file__).resolve().parent / "out"
LEAD_IN = 0.3


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_timeline(args, work: Path, synth: bool = True) -> float:
    """Sintetiza a fala (ou estima, no modo preview) e calcula os tempos de cada frase e cena."""
    t = 0.0
    for sc in SB.SCENES:
        sc.t0 = t
        cur = t + LEAD_IN
        sc.ph_times = []
        for i, ph in enumerate(sc.phrases):
            if ph.text:
                custom = Path(args.wav_dir) / f"{sc.sid}_{i}.wav" if getattr(args, "wav_dir", None) else None
                if custom and custom.exists():           # narração externa (humana ou TTS neural) tem prioridade
                    import wave
                    with wave.open(str(custom), "rb") as w:
                        dur = w.getnframes() / w.getframerate()
                    ph.wav = custom
                elif synth:
                    key = hashlib.sha1(f"{ph.text}|{args.voice}|{args.speed}|{args.pitch}".encode()).hexdigest()[:10]
                    wav = work / f"{sc.sid}_{i}_{key}.wav"
                    if not wav.exists():
                        E.tts_phrase(ph.text, wav, args.voice, args.speed, args.pitch)
                    import wave
                    with wave.open(str(wav), "rb") as w:
                        dur = w.getnframes() / w.getframerate()
                    ph.wav = wav
                else:
                    dur = len(ph.text) * 0.062
                    ph.wav = None
            else:
                dur = 0.0
                ph.wav = None
            end = cur + dur
            if not ph.text:
                end = cur + ph.pause  # silêncio para reflexão
            sc.ph_times.append((cur, end))
            cur = end + (ph.pause * 0.8 if ph.text else 0.0)
        sc.t1 = cur + sc.tail + sc.extra
        t = sc.t1
    return t


def write_srt(path: Path) -> list[tuple[float, float, str]]:
    items = []
    for sc in SB.SCENES:
        for ph, (a, b) in zip(sc.phrases, sc.ph_times):
            if ph.text:
                items.append((a, b, ph.text))
    with open(path, "w", encoding="utf-8") as f:
        for i, (a, b, text) in enumerate(items, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b + 0.1)}\n{text}\n\n")
    return items


def build_audio(total: float, path: Path, sr: int = 44100) -> None:
    n = int((total + 1.0) * sr)
    voice = np.zeros(n, dtype=np.float32)
    for sc in SB.SCENES:
        for ph, (a, _b) in zip(sc.phrases, sc.ph_times):
            if ph.wav is None:
                continue
            x, rate = E.read_wav_mono_float(ph.wav)
            x = E.resample(x, rate, sr)
            i0 = int(a * sr)
            voice[i0:i0 + len(x)] += x[: max(0, n - i0)]
    peak = float(np.max(np.abs(voice))) or 1.0
    voice = voice / peak * 0.9
    E.write_wav_stereo(path.with_name("voz_apenas.wav"), voice, sr)      # usado no controle de qualidade (sincronia)
    music = E.ambient_music(total + 1.0, sr)[:n]
    # "ducking": música cai quando há fala
    win = int(0.25 * sr)
    env = np.convolve(np.abs(voice), np.ones(win, dtype=np.float32) / win, mode="same")
    env = np.clip(env / (env.max() or 1) * 4.0, 0, 1)
    music = music * (0.55 - 0.30 * env)
    mix = voice + music * 0.55
    E.write_wav_stereo(path, mix, sr)


def render_video(total: float, audio: Path, out_mp4: Path, crf: int, preset: str) -> None:
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{E.W}x{E.H}", "-r", str(E.FPS), "-i", "-",
           "-i", str(audio), "-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
           "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-ar", "48000", "-movflags", "+faststart", "-t", f"{total:.3f}", str(out_mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    nframes = int(total * E.FPS)
    cache_sig, cache_bytes = None, b""
    scene_idx = 0
    t_start = time.time()
    for fi in range(nframes):
        t = fi / E.FPS
        while scene_idx < len(SB.SCENES) - 1 and t >= SB.SCENES[scene_idx].t1:
            scene_idx += 1
        sc = SB.SCENES[scene_idx]
        local = t - sc.t0
        fade = E.ease_out(local / 0.4) if local < 0.4 else 1.0
        if sc is SB.SCENES[-1] and t > sc.t1 - 1.0:
            fade = min(fade, max(0.0, (sc.t1 - t) / 1.0))
        animating = E.is_animating(sc, t) or fade < 1.0
        sig = E.signature(sc, t)
        if animating or sig != cache_sig:
            cache_bytes = E.render_frame(sc, t, fade).tobytes()
            cache_sig = None if animating else sig
        proc.stdin.write(cache_bytes)
        if fi % (E.FPS * 20) == 0:
            print(f"  quadro {fi}/{nframes}  ({time.time() - t_start:.0f}s)", flush=True)
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg falhou")


def write_roteiro(path: Path, total: float) -> None:
    lines = ["# Roteiro e storyboard — Aula de Direitos Humanos", "",
             f"Duração final: **{int(total // 60)} min {int(total % 60):02d} s** · 1920×1080 · 24 fps · narração em português do Brasil.", "",
             "Gerado automaticamente a partir de `storyboard.py` (fonte única de narração, legendas, textos de tela e animações).", "",
             "| # | Tempo | Cena | Narração (= legendas) | Textos/elementos na tela | Animação / direção de arte |", "|---|---|---|---|---|---|"]
    for i, sc in enumerate(SB.SCENES, 1):
        narr = " ".join(p.text for p in sc.phrases if p.text) or "—"
        screen = "; ".join(dict.fromkeys(el.label.replace("\n", " ") for el in sc.els if el.label and not el.label.startswith("[")))
        icons = ", ".join(dict.fromkeys(el.label for el in sc.els if el.label.startswith("[ícone")))
        lines.append(f"| {i} | {int(sc.t0 // 60)}:{int(sc.t0 % 60):02d}–{int(sc.t1 // 60)}:{int(sc.t1 % 60):02d} | {sc.sid} · {sc.tag or 'abertura/encerramento'} | "
                     f"{narr} | {screen}{' · ' + icons if icons else ''} | {sc.notes} |")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="mb-br1")
    ap.add_argument("--speed", type=int, default=160)
    ap.add_argument("--pitch", type=int, default=45)
    ap.add_argument("--crf", type=int, default=21)
    ap.add_argument("--preset", default="medium")
    ap.add_argument("--wav-dir", help="pasta com narração externa: <cena>_<n>.wav (ex.: s01_0.wav) substitui a voz sintética")
    ap.add_argument("--preview", action="store_true", help="gera só PNGs de pré-visualização")
    ap.add_argument("--no-video", action="store_true", help="só áudio, SRT e roteiro")
    args = ap.parse_args()

    OUT.mkdir(exist_ok=True)
    work = OUT / "work"
    work.mkdir(exist_ok=True)
    if args.preview:
        build_timeline(args, work, synth=False)
        prev = OUT / "preview"
        prev.mkdir(exist_ok=True)
        for sc in SB.SCENES:
            E.render_frame(sc, sc.t1 - 0.2).save(prev / f"{sc.sid}.png")
        print(f"{len(SB.SCENES)} pré-visualizações em {prev}")
        return 0

    print("1/5 narração (espeak-ng/MBROLA)…")
    total = build_timeline(args, work)
    print(f"    duração total: {total:.1f}s ({int(total // 60)}m{int(total % 60):02d}s)")
    print("2/5 legendas (SRT) e roteiro…")
    items = write_srt(OUT / "aula_direitos_humanos.srt")
    write_roteiro(OUT / "roteiro.md", total)
    (OUT / "narracao.txt").write_text("\n\n".join(" ".join(p.text for p in sc.phrases if p.text) for sc in SB.SCENES) + "\n", encoding="utf-8")
    print("3/5 trilha e mixagem…")
    audio = OUT / "work" / "mix.wav"
    build_audio(total, audio)
    if args.no_video:
        return 0
    print("4/5 renderização do vídeo…")
    render_video(total, audio, OUT / "aula_direitos_humanos.mp4", args.crf, args.preset)
    print("5/5 pronto:", OUT / "aula_direitos_humanos.mp4")
    return 0


if __name__ == "__main__":
    sys.exit(main())

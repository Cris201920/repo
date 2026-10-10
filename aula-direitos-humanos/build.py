#!/usr/bin/env python3
"""Pipeline da videoaula: narração -> linha do tempo -> quadros -> música -> MP4 + legendas.

Uso:
  python3 build.py                      # voz sintética provisória (rascunho)
  python3 build.py --voz minha          # usa suas gravações em voz/<id_da_cena>.(ogg|wav|mp3|m4a|webm)
  python3 build.py --preview quiz 12.5  # grava um PNG de teste da cena `quiz` no instante 12,5 s
"""
import argparse
import glob
import json
import math
import os
import re
import subprocess
import sys
import wave
from multiprocessing import Pool

import numpy as np
from PIL import Image

import gfx
from gfx import C, W, H, FPS, background, put, text, rich, wrap_rich, card_sprite, sprite, ease
from roteiro import CENAS
from scenes import SCENES, Ctx

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
LEAD, TAIL, GAP = 0.55, 0.95, 0.20
VOICE = "mb-br1"


def strip(t):
    return re.sub(r"\[\[|\]\]", "", t)


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def load_audio(path):
    """Qualquer áudio -> float32 mono 48 kHz."""
    out = sh(["ffmpeg", "-v", "error", "-i", path, "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"]).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


def trim_silence(x, thr=0.006, keep=0.08):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a, b = max(0, idx[0] - int(keep * SR)), min(len(x), idx[-1] + int(keep * SR))
    return x[a:b]


def tts_segment(text_, path, speed=178):
    import hashlib
    clean = strip(text_).replace("-", " ").replace("Direitos Humanos", "Direitos Umanos")
    h = hashlib.md5(f"{clean}|{speed}|{VOICE}".encode()).hexdigest()[:10]
    path = path.replace(".wav", f"_{h}.wav")
    if not os.path.exists(path):
        sh(["espeak-ng", "-v", VOICE, "-s", str(speed), "-p", "42", "-g", "4", clean, "-w", path])
    return trim_silence(load_audio(path))


# --------------------------------------------------------------- linha do tempo
def build_timeline(modo):
    os.makedirs(os.path.join(HERE, "voz_provisoria"), exist_ok=True)
    tl, cursor = [], 0.0
    for cena in CENAS:
        segs = cena["segs"]
        audio_parts, sp, t = [], [], LEAD
        user = None
        if modo == "minha":
            cand = sorted(glob.glob(os.path.join(HERE, "voz", cena["id"] + ".*")))
            if not cand:
                sys.exit(f"Falta gravação da cena '{cena['id']}' em voz/{cena['id']}.ogg (ou .wav/.mp3/.m4a/.webm)")
            user = trim_silence(load_audio(cand[0]), keep=0.12)
        if user is None:
            offs = []
            buf = np.zeros(int(LEAD * SR), dtype=np.float32)
            for i, s in enumerate(segs):
                pausa = s.get("pausa", 0.0)
                if s["t"]:
                    x = tts_segment(s["t"], os.path.join(HERE, "voz_provisoria", f"{cena['id']}_{i}.wav"))
                else:
                    x = np.zeros(0, dtype=np.float32)
                a = len(buf) / SR
                buf = np.concatenate([buf, x])
                b = len(buf) / SR
                sp.append((a, b + (pausa if not s["t"] else 0)))
                buf = np.concatenate([buf, np.zeros(int((GAP + pausa) * SR), dtype=np.float32)])
            T = len(buf) / SR - GAP + TAIL
            audio = buf
        else:
            weights = [max(1, len(strip(s["t"]))) + s.get("pausa", 0) * 14 for s in segs]
            D = len(user) / SR
            tot = sum(weights)
            t = LEAD
            for w in weights:
                sp.append((t, t + D * w / tot))
                t += D * w / tot
            audio = np.concatenate([np.zeros(int(LEAD * SR), dtype=np.float32), user])
            T = LEAD + D + TAIL
        ts = [a for a, _ in sp] + [sp[-1][1]]
        tl.append(dict(id=cena["id"], bloco=cena["bloco"], segs=segs, sp=sp, ts=ts, T=T, start=cursor, audio=audio))
        cursor += T
    return tl, cursor


# ------------------------------------------------------------------- legendas
def chunk_text(s, maxc=76):
    s = s.strip()
    if len(strip(s)) <= maxc:
        return [s]
    parts = re.split(r"(?<=[\.\?!:;,])\s+", s)
    chunks, cur = [], ""
    for p in parts:
        cand = (cur + " " + p).strip()
        if cur and len(strip(cand)) > maxc:
            chunks.append(cur)
            cur = p
        else:
            cur = cand
    if cur:
        chunks.append(cur)
    out = []
    for c in chunks:  # quebra extra, se ainda longo
        while len(strip(c)) > maxc + 10:
            cut = c.rfind(" ", 0, maxc)
            out.append(c[:cut])
            c = c[cut + 1:]
        out.append(c)
    return out


def hl_state(s):
    """Garante que cada chunk tenha [[ ]] balanceado."""
    inside = False
    res = []
    for c in s:
        pre = "[[" if inside else ""
        for m in re.finditer(r"\[\[|\]\]", c):
            inside = m.group() == "[["
        res.append(pre + c + ("]]" if inside else ""))
    return res


def subtitle_cues(tl):
    cues = []
    for sc in tl:
        for (a, b), s in zip(sc["sp"], sc["segs"]):
            if not s["t"]:
                continue
            chunks = hl_state(chunk_text(s["t"]))
            w = [len(strip(c)) for c in chunks]
            tot = sum(w)
            t = a
            for c, ww in zip(chunks, w):
                d = (b - a) * ww / tot
                cues.append((sc["start"] + t, sc["start"] + t + d, c))
                t += d
    return cues


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(cues, path):
    with open(path, "w", encoding="utf-8") as f:
        for i, (a, b, c) in enumerate(cues, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{strip(c)}\n\n")


# ---------------------------------------------------------------------- quadros
G = {}


def chrome(img, sc, gt, total):
    text(img, 90, 34, "◆  " + sc["bloco"], "sans_sb", 24, C["gold"], "l", 0.95)
    text(img, W - 90, 34, "DIREITOS HUMANOS  ·  VIDEOAULA DE REVISÃO", "sans_sb", 22, C["g2"], "r", 0.9)
    img.paste(C["g3"], (0, H - 8, W, H - 4))
    img.paste(C["gold"], (0, H - 8, int(W * gt / total), H - 4))


def draw_subtitle(img, cue):
    if not cue:
        return
    s = cue[2]
    fk, size = "sans_sb", 42
    lines = wrap_rich(s, fk, size, 1560)
    lh = 56
    hbox = len(lines) * lh + 22
    sp = gfx.text_w(" ", fk, size)
    wbox = int(max(gfx.line_w(ln, sp) for ln in lines)) + 80
    y0 = 1032 - hbox - 8
    put(img, card_sprite(wbox, hbox, 18, (4, 10, 24), None, 1), W // 2, y0 + hbox / 2, 0.80)
    rich(img, W // 2, y0 + 12, s, fk, size, C["white"], C["gold2"], maxw=1560, a="m", lh=lh / size)


def render_frame(f):
    tl, cues, total, fps = G["tl"], G["cues"], G["total"], G["fps"]
    gt = f / fps
    sc = tl[-1]
    for s in tl:
        if gt < s["start"] + s["T"]:
            sc = s
            break
    t = gt - sc["start"]
    img = background().copy()
    S = Ctx(img, t, sc["T"], sc["ts"])
    SCENES[sc["id"]](S)
    chrome(img, sc, gt, total)
    cue = next((c for c in cues if c[0] <= gt < c[1]), None)
    draw_subtitle(img, cue)
    a = min(1.0, t / 0.4, (sc["T"] - t) / 0.4)
    if sc["id"] == "abertura":
        a = min(1.0, t / 0.9, (sc["T"] - t) / 0.4)
    if a < 0.999:
        img = Image.blend(background(), img, max(0.0, a))
    return img.tobytes()


def init_worker(tl, cues, total, fps):
    G.update(tl=tl, cues=cues, total=total, fps=fps)


# ------------------------------------------------------------------------ áudio
def synth_music(dur, seed=7):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    L = np.zeros(n, np.float32)
    R = np.zeros(n, np.float32)

    def hz(m):
        return 440.0 * 2 ** ((m - 69) / 12)

    chords = [[45, 52, 59, 60, 64], [41, 48, 52, 57, 60], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62]]
    clen = 8.0
    for ci in range(int(dur // clen) + 2):
        notes = chords[ci % 4]
        s0 = ci * clen - 1.5
        i0, i1 = max(0, int(s0 * SR)), min(n, int((s0 + clen + 3.0) * SR))
        if i1 <= i0:
            continue
        tt = t[i0:i1] - s0
        env = np.clip(tt / 2.5, 0, 1) * np.clip((clen + 3.0 - tt) / 2.5, 0, 1)
        env = env ** 2 * (3 - 2 * env)
        for j, m in enumerate(notes):
            for det, pan in ((-0.25, 0.35), (0.25, 0.65)):
                f0 = hz(m) + det
                w = np.sin(2 * math.pi * f0 * tt) + 0.35 * np.sin(2 * math.pi * 2 * f0 * tt) + 0.1 * np.sin(2 * math.pi * 3 * f0 * tt)
                amp = 0.05 / (1 + 0.12 * j)
                L[i0:i1] += (amp * (1 - pan) * 1.4 * env * w).astype(np.float32)
                R[i0:i1] += (amp * pan * 1.4 * env * w).astype(np.float32)
    # arpejo suave (sinos) a cada 1,5 s
    step = 1.5
    for bi in range(int(dur / step)):
        ci = int(bi * step // clen) % 4
        m = chords[ci][(bi * 3) % 5] + 12
        s0 = bi * step
        i0, i1 = int(s0 * SR), min(n, int((s0 + 2.5) * SR))
        tt = t[i0:i1] - s0
        w = np.sin(2 * math.pi * hz(m) * tt) * np.exp(-tt * 2.2) * (1 - np.exp(-tt * 80))
        pan = 0.3 + 0.4 * ((bi * 7) % 5) / 4
        L[i0:i1] += (0.018 * (1 - pan) * 2 * w).astype(np.float32)
        R[i0:i1] += (0.018 * pan * 2 * w).astype(np.float32)
    # reverb sintética
    ir_n = int(2.4 * SR)
    for ch in (L, R):
        ir = rng.standard_normal(ir_n).astype(np.float32) * np.exp(-np.arange(ir_n) / (0.55 * SR)).astype(np.float32)
        ir[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR)).astype(np.float32)
        nfft = 1 << int(math.ceil(math.log2(n + ir_n)))
        wet = np.fft.irfft(np.fft.rfft(ch, nfft) * np.fft.rfft(ir, nfft), nfft)[:n].astype(np.float32)
        wet *= np.abs(ch).max() / (np.abs(wet).max() + 1e-9) * 0.9
        ch *= 0.6
        ch += 0.55 * wet
    fade = np.clip(t / 3.0, 0, 1) * np.clip((dur - t) / 4.0, 0, 1)
    st = np.stack([L * fade, R * fade], 1)
    st /= np.abs(st).max() + 1e-9
    return (st * 0.9).astype(np.float32)


def write_wav(path, arr, ch=1):
    a = np.clip(arr, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((a * 32767).astype("<i2").tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voz", choices=["provisoria", "minha"], default="provisoria")
    ap.add_argument("--preview", nargs=2, metavar=("CENA", "SEG"))
    ap.add_argument("--sem-musica", action="store_true")
    ap.add_argument("--out", default=None)
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--crf", type=int, default=21)
    a = ap.parse_args()

    tl, total = build_timeline(a.voz)
    cues = subtitle_cues(tl)
    print(f"duração total: {total:.1f} s ({int(total // 60)}:{int(total % 60):02d}) · cenas: {len(tl)}")
    for s in tl:
        print(f"  {s['id']:<18} início {s['start']:6.1f}s  duração {s['T']:5.1f}s")

    if a.preview:
        sid, tt = a.preview
        sc = next(s for s in tl if s["id"] == sid)
        init_worker(tl, cues, total, FPS)
        f = int((sc["start"] + float(tt)) * FPS)
        raw = render_frame(f)
        out = os.path.join(HERE, "previa", f"{sid}_{float(tt):.1f}.png")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        Image.frombytes("RGB", (W, H), raw).save(out)
        print("prévia:", out)
        return

    outdir = os.path.join(HERE, "saida")
    os.makedirs(outdir, exist_ok=True)
    tag = "voz_provisoria" if a.voz == "provisoria" else "voz_minha"
    base = a.out or os.path.join(outdir, f"aula_direitos_humanos_{tag}")
    write_srt(cues, base + ".srt")

    # trilha de voz + música
    voice = np.zeros(int((total + 1) * SR), np.float32)
    for s in tl:
        i = int(s["start"] * SR)
        voice[i:i + len(s["audio"])] += s["audio"][: len(voice) - i]
    vpath = os.path.join(outdir, "_voz.wav")
    write_wav(vpath, voice)
    mpath = os.path.join(outdir, "_musica.wav")
    write_wav(mpath, synth_music(total + 1), 2)
    apath = os.path.join(outdir, "_audio.m4a")
    if a.sem_musica:
        fc = "[0:a]loudnorm=I=-16:TP=-1.5:LRA=9[a]"
        inputs = ["-i", vpath]
    else:
        fc = ("[0:a]loudnorm=I=-16:TP=-1.5:LRA=9,asplit=2[v1][v2];"
              "[1:a]volume=0.55[m];[m][v2]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=600[d];"
              "[v1][d]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]")
        inputs = ["-i", vpath, "-i", mpath]
    sh(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", fc, "-map", "[a]", "-c:a", "aac", "-b:a", "192k", apath])

    nframes = int(math.ceil(total * FPS))
    mp4 = base + ".mp4"
    ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                           "-i", "-", "-i", apath, "-c:v", "libx264", "-preset", "medium", "-crf", str(a.crf), "-pix_fmt", "yuv420p",
                           "-profile:v", "high", "-movflags", "+faststart", "-c:a", "copy", "-shortest", mp4], stdin=subprocess.PIPE)
    with Pool(a.jobs, initializer=init_worker, initargs=(tl, cues, total, FPS)) as pool:
        for i, raw in enumerate(pool.imap(render_frame, range(nframes), chunksize=8)):
            ff.stdin.write(raw)
            if i % 300 == 0:
                print(f"\r  quadro {i}/{nframes}", end="", flush=True)
    ff.stdin.close()
    ff.wait()
    print(f"\nOK: {mp4}")
    for p in (vpath, mpath, apath):
        os.remove(p)
    json.dump([dict(id=s["id"], inicio=round(s["start"], 2), duracao=round(s["T"], 2)) for s in tl],
              open(base + "_cenas.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()

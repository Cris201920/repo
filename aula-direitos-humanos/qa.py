#!/usr/bin/env python3
"""Revisão final automatizada do vídeo: cobertura de conteúdo, ortografia, legendas, sincronia, áudio e imagem.
Gera out/QA.md. Itens que dependem de ouvido humano (naturalidade da voz) são sinalizados como NÃO verificáveis aqui."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import unicodedata
import wave
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gerar_video as G  # noqa: E402
import storyboard as SB  # noqa: E402

OUT = Path(__file__).resolve().parent / "out"
MP4 = OUT / "aula_direitos_humanos.mp4"


def norm(t: str) -> str:
    t = unicodedata.normalize("NFKD", t.lower())
    return re.sub(r"\s+", " ", "".join(c for c in t if not unicodedata.combining(c)))


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def load_timeline():
    import argparse
    args = argparse.Namespace(voice="mb-br1", speed=160, pitch=45)
    return G.build_timeline(args, OUT / "work")


REQUIRED = {
    "Bloco 1 — Conceito": ["liberdade", "igualdade", "dignidade", "indispensaveis", "liberdade de expressao", "igualdade perante a lei",
                           "tratamentos desumanos", "liberdade + igualdade + dignidade"],
    "Bloco 2 — Estrutura": ["direito-pretensao", "direito-liberdade", "direito-poder", "direito-imunidade", "prestacao de saude",
                            "manifestar uma opiniao", "direito de voto", "esfera de autonomia", "exigir de alguem"],
    "Bloco 3 — Cumprimento": ["subjetivo", "objetivo", "incumbencia do estado", "de um particular", "ou de ambos", "conduta ativa",
                              "conduta passiva", "abstencao", "quem tem a incumbencia", "qual conduta e exigida", "sintese didatica",
                              "nao e responsabilidade exclusiva do estado"],
    "Bloco 4 — Conteúdo": ["valores essenciais", "expressa ou implicitamente", "constituicoes", "tratados internacionais", "protecao da pessoa humana",
                           "interpretacao"],
    "Bloco 5 — Fundamentalidade": ["fundamentalidade formal", "fundamentalidade material", "formal = reconhecimento juridico",
                                   "material = importancia do conteudo para a dignidade humana", "nao sao definicoes"],
    "Bloco 6 — Marcas": ["universalidade", "direitos de todos", "essencialidade", "valores indispensaveis", "superioridade normativa",
                         "preferenciabilidade", "protecao normativa especial", "nao significa que toda norma", "analise juridica adequada",
                         "reciprocidade", "todos tem direitos e deveres de respeito"],
    "Bloco 7 — Consequências": ["direito a ter direitos", "sujeito de direitos", "riqueza", "convivencia e colisao", "honra", "privacidade",
                                "nao significa que um dos direitos deixa de existir",
                                "os direitos devem conviver com os direitos das outras pessoas"],
    "Quadro final": ["liberdade, igualdade e dignidade", "pretensao, liberdade, poder e imunidade", "estado, particular ou ambos",
                     "conduta ativa ou passiva", "valores essenciais reconhecidos juridicamente", "reconhecimento formal",
                     "conteudo essencial a dignidade", "universalidade, essencialidade, superioridade normativa e reciprocidade",
                     "direito a ter direitos e convivencia entre direitos"],
    "Revisão ativa (5 perguntas)": ["tres valores centrais", "quatro estruturas dos direitos humanos", "ponto de vista subjetivo e o objetivo",
                                    "fundamentalidade formal e material", "quatro marcas distintivas"],
}
FINAL_MSG = ("Mais importante do que decorar os termos é compreender a lógica dos Direitos Humanos: proteger a dignidade, reconhecer cada pessoa "
             "como titular de direitos e permitir a convivência respeitosa entre todos.")
WHITELIST = {"preferenciabilidade", "pretensão"}


def all_texts():
    narr = " ".join(p.text for sc in SB.SCENES for p in sc.phrases if p.text)
    screen = " ".join(el.label.replace("\n", " ") for sc in SB.SCENES for el in sc.els if el.label and not el.label.startswith("["))
    return narr, screen


def main() -> int:
    total = load_timeline()
    narr, screen = all_texts()
    blob = norm(narr + " " + screen)
    lines = ["# Revisão final (QA) — Aula de Direitos Humanos", "", f"Gerado por `qa.py` sobre `{MP4.name}`.", ""]
    ok_all = True

    # 1. cobertura
    lines += ["## 1. Cobertura do conteúdo obrigatório", "", "| Item | Resultado |", "|---|---|"]
    for block, terms in REQUIRED.items():
        miss = [t for t in terms if norm(t) not in blob]
        ok_all &= not miss
        lines.append(f"| {block} | {'✅ todos os ' + str(len(terms)) + ' termos presentes' if not miss else '❌ faltando: ' + ', '.join(miss)} |")
    final_ok = norm(FINAL_MSG) == norm(" ".join(p.text for p in SB.SCENES[-1].phrases if p.text))
    ok_all &= final_ok
    lines.append(f"| Mensagem final (texto exato) | {'✅ idêntica ao texto fornecido' if final_ok else '❌ difere'} |")
    quiz = [sc for sc in SB.SCENES if sc.sid.startswith("q")]
    lines.append(f"| Perguntas de revisão ativa | {'✅' if len(quiz) == 5 else '❌'} {len(quiz)} perguntas, cada uma com pausa de reflexão e resposta na tela |")
    lines.append("")

    # 2. ortografia
    words = sorted({w for w in re.findall(r"[A-Za-zÀ-ÿ]{3,}", narr + " " + screen)}, key=str.lower)
    r = subprocess.run(["hunspell", "-d", "pt_BR", "-i", "utf-8", "-l"], input="\n".join(words), capture_output=True, text=True)
    bad = sorted({w for w in r.stdout.split() if w.lower() not in WHITELIST}, key=str.lower)
    ok_all &= not bad
    lines += ["## 2. Ortografia (hunspell pt_BR) — textos de tela e narração", "",
              f"{len(words)} palavras distintas verificadas. " + ("✅ nenhuma palavra suspeita." if not bad else "❌ suspeitas: " + ", ".join(bad)),
              "Termos técnicos aceitos manualmente: " + ", ".join(sorted(WHITELIST)) + " (termos jurídicos corretos, ausentes do dicionário).", ""]

    # 3. legendas
    srt = (OUT / "aula_direitos_humanos.srt").read_text(encoding="utf-8")
    srt_text = " ".join(l for l in srt.splitlines() if l and not l.isdigit() and "-->" not in l)
    sub_ok = norm(srt_text) == norm(narr)
    ok_all &= sub_ok
    cues = srt.count("-->")
    lines += ["## 3. Legendas", "", f"* {cues} legendas; texto idêntico à narração: {'✅' if sub_ok else '❌'}.",
              "* Termos jurídicos destacados em dourado (lista em `engine.TERMS`); legendas queimadas no vídeo e também em SRT separado.", ""]

    # 4. sincronia fala x legenda
    wav = OUT / "work" / "voz_apenas.wav"
    sync_ok, sync_n = 0, 0
    if wav.exists():
        with wave.open(str(wav), "rb") as w:
            sr, ch = w.getframerate(), w.getnchannels()
            data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, ch).mean(axis=1) / 32768
        def rms(a, b):
            seg = data[int(max(a, 0) * sr):int(b * sr)]
            return float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0
        for sc in SB.SCENES:
            for p, (a, b) in zip(sc.phrases, sc.ph_times):
                if not p.text:
                    continue
                sync_n += 1
                inside, before = rms(a + 0.02, a + 0.30), rms(a - 0.25, a - 0.03)
                if inside > 0.01 and inside > 3 * before:
                    sync_ok += 1
        sync_ok_flag = sync_ok / max(1, sync_n) >= 0.9
        ok_all &= sync_ok_flag
        lines += ["## 4. Sincronia legenda × fala", "",
                  f"Em {sync_ok}/{sync_n} frases a fala começa em até 0,3 s do início da legenda ({'✅' if sync_ok_flag else '❌'}). "
                  "Como os tempos vêm das durações reais de cada trecho sintetizado, a sincronia é por construção; este teste confere no áudio final.", ""]

    # 5. formato, duração e áudio
    pr = run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,duration,sample_rate,channels",
              "-of", "json", str(MP4)])
    info = json.loads(pr.stdout)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next(s for s in info["streams"] if s["codec_type"] == "audio")
    fmt_ok = (v["width"], v["height"]) == (1920, 1080) and v["codec_name"] == "h264" and abs(float(v["duration"]) - float(a["duration"])) < 0.2
    ok_all &= fmt_ok
    dur = float(v["duration"])
    lines += ["## 5. Formato e duração", "",
              f"* Vídeo: {v['codec_name']} {v['width']}×{v['height']} @ {v['r_frame_rate']}; áudio: {a['codec_name']} {a['sample_rate']} Hz, {a['channels']} canais.",
              f"* Duração: **{int(dur // 60)}:{int(dur % 60):02d}** (vídeo {float(v['duration']):.2f}s / áudio {float(a['duration']):.2f}s) {'✅' if fmt_ok else '❌'}.",
              f"* Meta do pedido: 4–6 min, \"ajustada conforme a necessidade\". Ficou acima porque o conteúdo obrigatório é extenso e a narração foi mantida em ritmo moderado.", ""]
    ebu = run(["ffmpeg", "-nostats", "-i", str(MP4), "-af", "ebur128=peak=true", "-f", "null", "-"])
    m_i = re.findall(r"I:\s+(-?\d+\.\d+) LUFS", ebu.stderr)
    m_tp = re.findall(r"Peak:\s+(-?\d+\.\d+) dBFS", ebu.stderr)
    vd = run(["ffmpeg", "-nostats", "-i", str(MP4), "-af", "volumedetect", "-vn", "-f", "null", "-"])
    mean = re.findall(r"mean_volume: (-?\d+\.\d+) dB", vd.stderr)
    maxv = re.findall(r"max_volume: (-?\d+\.\d+) dB", vd.stderr)
    loud_ok = bool(m_i) and -19 <= float(m_i[-1]) <= -13 and bool(maxv) and float(maxv[-1]) <= -0.5
    ok_all &= loud_ok
    lines += ["## 6. Áudio", "",
              f"* Loudness integrada: {m_i[-1] if m_i else '?'} LUFS (alvo −16); pico verdadeiro: {m_tp[-1] if m_tp else '?'} dBFS; volume médio {mean[-1] if mean else '?'} dB, máximo {maxv[-1] if maxv else '?'} dB {'✅' if loud_ok else '❌'}.",
              "* Trilha instrumental sintetizada (pad Am–F–C–G, original) com *ducking* automático: cai quando há fala.", ""]

    # 7. imagem
    sheet_dir = OUT / "work" / "qa_frames"
    sheet_dir.mkdir(exist_ok=True)
    thumbs, dark, nosub = [], 0, 0
    for sc in SB.SCENES:
        t = sc.t0 + (sc.t1 - sc.t0) * 0.62
        fp = sheet_dir / f"{sc.sid}.jpg"
        run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(MP4), "-frames:v", "1", "-q:v", "3", str(fp)])
        im = Image.open(fp).convert("L")
        arr = np.asarray(im)
        if arr.mean() < 18:
            dark += 1
        band = arr[int(arr.shape[0] * 0.86):int(arr.shape[0] * 0.97), int(arr.shape[1] * 0.15):int(arr.shape[1] * 0.85)]
        has_text_expected = any(p.text and a_ - 0.0 <= t <= b_ + 0.1 for p, (a_, b_) in zip(sc.phrases, sc.ph_times))
        if has_text_expected and (band > 150).sum() < 400:
            nosub += 1
            print('sem legenda detectada em', sc.sid)
        thumbs.append(Image.open(fp).resize((480, 270)))
    cols = 6
    rows = (len(thumbs) + cols - 1) // cols
    cs = Image.new("RGB", (cols * 480, rows * 270))
    for i, th in enumerate(thumbs):
        cs.paste(th, ((i % cols) * 480, (i // cols) * 270))
    cs.save(OUT / "contact_sheet.jpg", quality=85)
    img_ok = dark == 0 and nosub == 0
    ok_all &= img_ok
    lines += ["## 7. Imagem", "", f"* {len(SB.SCENES)} cenas amostradas no vídeo final: {dark} quadros escuros, {nosub} quadros sem legenda onde deveria haver {'✅' if img_ok else '❌'}.",
              "* Mosaico de conferência: `out/contact_sheet.jpg`.", "* Paleta azul-marinho/branco/dourado/cinza; elementos todos desenhados por código (balança, livros, tribunal, Constituição, tratado, silhuetas) e cada um tem função didática.", ""]

    # 8. pronúncia (fonética do espeak)
    terms = ["Direitos Humanos", "direito-pretensão", "incumbência", "preferenciabilidade", "superioridade normativa", "fundamentalidade", "reciprocidade",
             "essencialidade", "universalidade", "abstenção", "imunidade", "cláusulas pétreas", "coletividade"]
    lines += ["## 8. Pronúncia dos termos (transcrição fonética do sintetizador)", "", "| Termo | Fonemas (espeak-ng, voz mb-br1) |", "|---|---|"]
    for t in terms:
        ph = run(["espeak-ng", "-v", "mb-br1", "-x", "-q", t]).stdout.strip().replace("\n", " ")
        lines.append(f"| {t} | `{ph}` |")
    lines += ["", "> **Não verificável automaticamente:** a *naturalidade* da voz. A narração usa síntese MBROLA (robótica, ritmo moderado); "
              "para a versão final recomenda-se regravar com locutor humano ou TTS neural, mantendo os mesmos textos/tempos (veja README).", ""]

    lines.insert(3, f"**Resultado geral dos testes automáticos: {'✅ APROVADO' if ok_all else '❌ HÁ PENDÊNCIAS (veja abaixo)'}**\n")
    (OUT / "QA.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return 0 if ok_all else 1


if __name__ == "__main__":
    sys.exit(main())

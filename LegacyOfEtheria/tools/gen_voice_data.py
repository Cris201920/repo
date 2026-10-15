# Mede os áudios do Sábio que JÁ estão no pacote de recursos e gera BP/scripts/data/sagevoice.gen.js:
#   DUR[chave]  = duração em ms (o anúncio avança "duração + 30 ms" a cada fala, como o sistema de referência)
#   CUES[cerim] = instantes (ms) em que cada frase começa (detecção de fala por volume a cada 50 ms), para sincronizar as legendas.
import os, json, subprocess, array, math, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOTS = [os.path.join(ROOT, p, "sounds/etheria/sage") for p in ("LegacyOfEtheria_RP", "LegacyOfEtheria_Voz")]
dur, cues = {}, {}
for f in sorted(x for r in ROOTS for x in glob.glob(r + "/**/*.ogg", recursive=True)):
    SND = next(r for r in ROOTS if f.startswith(r))
    rel = os.path.relpath(f, SND)[:-4].replace(os.sep, ".")       # ex.: voice.tsuzukete, tier.unique, ceremony.true_demon_lord
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).decode().strip())
    dur[rel] = int(round(d * 1000))
    if rel.startswith("ceremony."):
        raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"])
        a = array.array("h"); a.frombytes(raw); N = 400
        rms = [math.sqrt(sum(x * x for x in a[i:i + N]) / N) for i in range(0, len(a) - N, N)]
        th = max(rms) * 0.06; segs = []; quiet = 99
        for i, v in enumerate(rms):
            if v > th:
                if quiet >= 6: segs.append([i * 50, i * 50 + 50])
                if segs: segs[-1][1] = i * 50 + 50
                quiet = 0
            else: quiet += 1
        cues[rel.split(".", 1)[1]] = segs
out = os.path.join(ROOT, "LegacyOfEtheria_BP/scripts/data/sagevoice.gen.js")
open(out, "w").write("// GERADO por tools/gen_voice_data.py a partir dos .ogg do pacote de recursos (não edite à mão).\n"
    f"export const DUR = {json.dumps(dur, sort_keys=True)};\nexport const CUES = {json.dumps(cues, sort_keys=True)};\n")
print(len(dur), "falas;", {k: len(v) for k, v in cues.items()})

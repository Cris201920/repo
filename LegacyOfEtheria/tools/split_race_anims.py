"""7.9 - O arquivo único etheria_race_parts.animation.json (1,7 MB, 146 animações) não era aplicado no jogo
(asas paradas, escala das asas e cauda antiga ignoradas), enquanto arquivos pequenos funcionam. Este passo:
- guarda a FONTE em tools/race_src/etheria_race_parts.animation.json (os outros tools continuam editando o caminho antigo:
  se ele reaparecer no RP, vira a nova fonte);
- grava no RP vários arquivos PEQUENOS e compactos (corpos, linhagens, transformações em lotes);
- normaliza canais escalares (\"scale\": 0) para [x, x, x].
Uso: python3 tools/split_race_anims.py (rode por último, depois de qualquer tool que mexa nas animações das raças)"""
import json, os, glob, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); AD = os.path.join(ROOT, "LegacyOfEtheria_RP/animations")
OLD = os.path.join(AD, "etheria_race_parts.animation.json"); SRC = os.path.join(ROOT, "tools/race_src/etheria_race_parts.animation.json")
def main():
    if os.path.exists(OLD): shutil.move(OLD, SRC)
    A = json.load(open(SRC))["animations"]
    for f in glob.glob(os.path.join(AD, "etheria_rp_*.animation.json")): os.remove(f)
    for a in A.values():
        for b in a.get("bones", {}).values():
            for ch in ("rotation", "position", "scale"):
                if ch in b and not isinstance(b[ch], (list, dict)): b[ch] = [b[ch]] * 3
    groups = {}
    for k, a in A.items():
        if k.startswith("animation.etheria.race_lin_"): g = "lin"
        elif k.startswith("animation.etheria.race_"): g = "body"
        else: g = "tfx"
        groups.setdefault(g, []).append((k, a))
    out = []
    for g, items in groups.items():
        size = 5 if g == "tfx" else 6
        for i in range(0, len(items), size):
            name = f"etheria_rp_{g}_{i // size + 1}.animation.json"
            json.dump({"format_version": "1.8.0", "animations": dict(items[i:i + size])}, open(os.path.join(AD, name), "w"), separators=(",", ":"))
            out.append((name, os.path.getsize(os.path.join(AD, name))))
    print(len(out), "arquivos; maior:", max(s for _, s in out), "bytes")
if __name__ == "__main__": main()

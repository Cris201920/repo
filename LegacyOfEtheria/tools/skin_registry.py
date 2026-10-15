# Registro e auditoria de skins: entidade -> textura -> geometria (+ tamanho da imagem e da UV). Gera SKINS.md e acusa:
#   - textura usada por personagens DIFERENTES (fora das variantes conhecidas: _1.._N, _kumo, formas);
#   - textura ausente; tamanho da imagem fora da proporção da geometria (UV desalinhada).
# Correções aprovadas pelo jogador ficam em PENDING/APPLIED abaixo (rastreáveis).
import json, os, glob, re, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
PENDING = {   # aguardando a imagem correta do jogador (não inventar textura)
  "rimuru_tempest": "usa a skin do Souei — aguardando a imagem do Rimuru",
  "shion": "usa a skin da Shuna (cabelo rosa) — aguardando a imagem da Shion",
}
GEO = {}
for f in glob.glob(os.path.join(RP, "models/entity/**/*.json"), recursive=True):
    try: g = json.load(open(f))
    except Exception: continue
    for d in g.get("minecraft:geometry", []): GEO[d["description"]["identifier"]] = d["description"]
VAR = lambda s: re.sub(r"(_\d+|_kumo|_angel|_royal_beast|_echo|_boss)$", "", s)
rows, by_tex, issues = [], {}, []
for f in sorted(glob.glob(os.path.join(RP, "entity/*.json"))):
    d = json.load(open(f))["minecraft:client_entity"]["description"]; idn = d["identifier"]
    if not idn.startswith("etheria:"): continue
    e = idn[8:]; tex = list(d.get("textures", {}).values()); geo = list(d.get("geometry", {}).values())
    t0, g0 = (tex[0] if tex else ""), (geo[0] if geo else "")
    size = "?"
    if t0 and os.path.exists(os.path.join(RP, t0 + ".png")):
        im = Image.open(os.path.join(RP, t0 + ".png")); size = f"{im.width}x{im.height}"
        gd = GEO.get(g0)
        if gd and gd.get("texture_width"):
            if abs(im.width / gd["texture_width"] - im.height / gd["texture_height"]) > 0.01: issues.append(f"{e}: imagem {size} fora da proporção da UV {gd['texture_width']}x{gd['texture_height']}")
    elif t0: issues.append(f"{e}: textura ausente {t0}")
    by_tex.setdefault(t0, set()).add(VAR(e))
    rows.append((e, t0, g0, size))
for t, ents in by_tex.items():
    named = {x for x in ents if not x.startswith(("tt_goblin", "tt_orc", "tt_lizardman", "tt_direwolf", "tt_otherworlder", "tt_special"))}
    if t and len(named) > 1 and not all(x.startswith("npc_") for x in named): issues.append(f"textura compartilhada por personagens diferentes: {os.path.basename(t)} -> {sorted(named)}")
out = ["# Registro de skins (gerado por tools/skin_registry.py)", "", "| Entidade | Textura | Geometria | Imagem | Situação |", "|---|---|---|---|---|"]
for e, t, g, sz in rows: out.append(f"| {e} | {os.path.basename(t)} | {g.replace('geometry.', '')} | {sz} | {PENDING.get(e, 'ok')} |")
out += ["", "## Problemas encontrados", ""] + [f"- {i}" for i in issues or ["nenhum"]]
open(os.path.join(ROOT, "SKINS.md"), "w").write("\n".join(out) + "\n")
print(len(rows), "entidades;", len(issues), "problemas"); print("\n".join(issues[:30]))

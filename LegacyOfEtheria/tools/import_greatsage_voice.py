# Importa as vozes do mod Great Sage (jar fornecido pelo dono do addon, com permissão, uso pessoal) para um pacote de recursos SEPARADO:
#   LegacyOfEtheria_Voz (RP) -> sounds/etheria/sage/<pasta>/<arquivo>.ogg + sound_definitions.json (etheria.sage.<pasta>.<nome>)
# Pastas já existentes no RP principal (voice, tier, sfx, ceremony, raphael) não são duplicadas.
# Uso: python3 tools/import_greatsage_voice.py <caminho do greatsage.jar>
import sys, os, zipfile, json, uuid
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JAR, OUT = sys.argv[1], os.path.join(ROOT, "LegacyOfEtheria_Voz")
SKIP = {"voice", "tier", "sfx", "ceremony", "raphael"}
defs = {}
with zipfile.ZipFile(JAR) as z:
    for n in z.namelist():
        if not (n.startswith("assets/greatsage/sounds/") and n.endswith(".ogg")): continue
        rel = n[len("assets/greatsage/sounds/"):-4]           # ex.: skill/predator, world/skill/x, skill/trnightmare/beelzebuth
        if rel.split("/")[0] in SKIP: continue
        dst = os.path.join(OUT, "sounds/etheria/sage", rel + ".ogg"); os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, "wb").write(z.read(n))
        defs["etheria.sage." + rel.replace("/", ".")] = {"category": "ui", "sounds": [{"name": "sounds/etheria/sage/" + rel, "volume": 1.0}]}
json.dump({"format_version": "1.14.0", "sound_definitions": dict(sorted(defs.items()))}, open(os.path.join(OUT, "sounds/sound_definitions.json"), "w"), indent=1)
mf = os.path.join(OUT, "manifest.json")
if not os.path.exists(mf):
    json.dump({"format_version": 2, "header": {"name": "§6Legacy of Etheria §7Vozes", "description": "Vozes do Grande Sábio (nomes de habilidades e raças, Voz do Mundo, respostas). Uso pessoal.",
        "uuid": str(uuid.uuid4()), "version": [1, 0, 0], "min_engine_version": [1, 21, 80]}, "modules": [{"type": "resources", "uuid": str(uuid.uuid4()), "version": [1, 0, 0]}]}, open(mf, "w"), indent=1)
print(len(defs), "sons importados")

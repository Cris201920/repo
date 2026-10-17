# 6.80 - liga no jogo a FORMA SLIME e o MÍMICO (raça Slime).
#  - BP: propriedades etheria:slime (bool) e etheria:mimic (int 0..N) no player.json.
#  - RP: player.entity ganha a geometria/textura/animação do slime e de cada forma do Mímico (modelos dos próprios mobs do addon,
#    com a animação principal de cada um), o corpo normal e as peças de raça somem enquanto a forma está ativa
#    (variable.etheria_dragon, o mesmo mecanismo das formas dracônicas), controladores em etheria_player_forms.render_controllers.json.
#  - BP: data/mimicforms.gen.js com o catálogo (índice = valor de etheria:mimic).
import json, os, re, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
# (chave, nome, entidade cliente de origem, regex dos typeIds devorados que liberam a forma)
FORMS = [
    ("goblin", "Goblin", "tt_goblin", r"goblin(?!_king)"), ("hobgoblin", "Hobgoblin", "hobgoblin", r"hobgoblin"),
    ("direwolf", "Lobo Tempestuoso", "tt_direwolf", r"direwolf(?!_boss)|magic_wolf|wolf"), ("direwolf_alpha", "Lobo Alfa", "tt_direwolf_boss", r"direwolf_boss"),
    ("orc", "Orc", "tt_orc", r"(?<!mini_)orc(?!_lord|_disaster)"), ("orc_lord", "Lorde Orc", "tt_orc_lord", r"orc_lord|orc_disaster"),
    ("lizardman", "Homem-Lagarto", "tt_lizardman", r"lizardman"), ("ogre", "Ogro", "ogre", r"ogre"),
    ("taratect", "Taratect", "taratect", r"taratect"), ("black_spider", "Aranha Negra", "tt_black_spider", r"black_spider|knight_spider|spider"),
    ("giant_bat", "Morcego Gigante", "tt_giant_bat", r"giant_bat|bat"), ("giant_bear", "Urso Gigante", "tt_giant_bear", r"bear"),
    ("centipede", "Centopeia Maligna", "tt_evil_centipede", r"centipede"), ("serpent", "Serpente Tempestuosa", "tt_tempest_serpent", r"serpent|snake"),
    ("giant_ant", "Formiga Gigante", "tt_giant_ant", r"ant\b|giant_ant"), ("grave_lizard", "Lagarto Sepulcral", "tt_grave_lizard", r"grave_lizard"),
    ("imp", "Diabrete", "imp", r"imp\b|:imp"), ("elf", "Elfo", "tt_elf", r"elf"), ("dwarf", "Anão", "tt_dwarf", r"dwarf"),
    ("skeleton_knight", "Cavaleiro Esqueleto", "skeleton_knight", r"skeleton"), ("arcane_slime", "Slime Arcano", "arcane_slime", r"slime"),
    ("knight", "Cavaleiro", "npc_lm_knight", r"knight(?!_spider)|guard|soldier|paladin"), ("adventurer", "Aventureiro", "npc_tp_adventurer", r"adventurer|villager|pillager|vindicator|evoker|witch|wandering_trader|human|hero|bandit|player"),
]
ents = {}
for f in glob.glob(os.path.join(RP, "entity/*.entity.json")):
    try: dd = json.load(open(f))["minecraft:client_entity"]["description"]
    except Exception: continue
    ents[dd["identifier"]] = dd
rows = []
for i, (key, name, src, rx) in enumerate(FORMS, start=1):
    dd = ents["etheria:" + src]; g = dd["geometry"]; t = dd["textures"]; a = dd.get("animations", {})
    main = a.get("main") or a.get("move.walk") or a.get("walk") or a.get("move")
    rows.append(dict(i=i, key=key, name=name, geo=g.get("default") or next(iter(g.values())), tex=t.get("default") or next(iter(t.values())), anim=main, rx=rx))
N = len(rows)

# ---------- BP: propriedades ----------
pj = os.path.join(BP, "entities/player.json"); s = open(pj).read(); P = json.loads(s)["minecraft:entity"]["description"]["properties"]
if "etheria:slime" not in P:
    s = re.sub(r'("etheria:lord"\s*:\s*\{[^}]*\})', r'\1,\n    "etheria:slime": {"type": "bool", "default": false, "client_sync": true},\n    "etheria:mimic": {"type": "int", "range": [0, ' + str(N) + r'], "default": 0, "client_sync": true}', s, count=1)
s = re.sub(r'("etheria:mimic"\s*:\s*\{"type": "int", "range": \[0, )\d+', r'\g<1>' + str(N), s)
json.loads(s); open(pj, "w").write(s)
assert len(json.loads(s)["minecraft:entity"]["description"]["properties"]) <= 32

# ---------- BP: catálogo ----------
js = "// GERADO por tools/slime_mimic_wire.py — formas do Mímico (índice = etheria:mimic)\nexport const MIMIC_FORMS = [\n"
for r in rows: js += f'  {{ i: {r["i"]}, key: "{r["key"]}", name: "{r["name"]}", rx: /{r["rx"]}/ }},\n'
js += "];\n"
open(os.path.join(BP, "scripts/data/mimicforms.gen.js"), "w").write(js)

# ---------- RP: player.entity ----------
pe = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(pe)); D = E["minecraft:client_entity"]["description"]
D["materials"]["slime_gel"] = "entity_alphablend"
D["geometry"]["slime_form"] = "geometry.etheria_player_slime"; D["textures"]["slime_form"] = "textures/entity/etheria_player_slime"
D["animations"]["slime_form"] = "animation.etheria.slime_form"
for r in rows:
    D["geometry"][f"mim_{r['key']}"] = r["geo"]; D["textures"][f"mim_{r['key']}"] = r["tex"]
    if r["anim"]: D["animations"][f"mim_{r['key']}"] = r["anim"]
FORM = "(query.property('etheria:slime') || query.property('etheria:mimic') > 0)"
pre = D["scripts"]["pre_animation"]
for k, line in enumerate(pre):
    if line.startswith("variable.etheria_dragon = "):
        pre[k] = f"variable.etheria_dragon = (query.property('etheria:lform') == 'true' || query.property('etheria:lform') == 'draconic' || {FORM}) ? 1.0 : 0.0;"
an = [x for x in D["scripts"]["animate"] if not (isinstance(x, dict) and (("slime_form" in x) or any(k.startswith("mim_") for k in x)))]
an.append({"slime_form": "query.property('etheria:slime') && query.property('etheria:mimic') == 0"})
for r in rows:
    if r["anim"]: an.append({f"mim_{r['key']}": f"query.property('etheria:mimic') == {r['i']}"})
D["scripts"]["animate"] = an
rc = []
for x in D["render_controllers"]:
    if isinstance(x, dict) and any(k in ("controller.render.etheria_player_slime", "controller.render.etheria_player_mimic") for k in x): continue
    if isinstance(x, dict) and "controller.render.player.third_person" in x:
        v = x["controller.render.player.third_person"].replace(f" && !{FORM}", "")
        x = {"controller.render.player.third_person": v + f" && !{FORM}"}
    rc.append(x)
rc.append({"controller.render.etheria_player_slime": "!variable.is_first_person && !variable.map_face_icon && !query.is_spectator && query.property('etheria:slime') && query.property('etheria:mimic') == 0"})
rc.append({"controller.render.etheria_player_mimic": "!variable.is_first_person && !variable.map_face_icon && !query.is_spectator && query.property('etheria:mimic') > 0"})
D["render_controllers"] = rc
open(pe, "w").write(json.dumps(E, indent=1, ensure_ascii=False) + "\n")
RC = {"format_version": "1.8.0", "render_controllers": {
    "controller.render.etheria_player_slime": {"geometry": "Geometry.slime_form", "materials": [{"*": "Material.slime_gel"}], "textures": ["Texture.slime_form"]},
    "controller.render.etheria_player_mimic": {
        "arrays": {"geometries": {"Array.mg": [f"Geometry.mim_{r['key']}" for r in rows]}, "textures": {"Array.mt": [f"Texture.mim_{r['key']}" for r in rows]}},
        "geometry": "Array.mg[math.max(0, query.property('etheria:mimic') - 1)]", "materials": [{"*": "Material.default"}],
        "textures": ["Array.mt[math.max(0, query.property('etheria:mimic') - 1)]"]}}}
json.dump(RC, open(os.path.join(RP, "render_controllers/etheria_player_forms.render_controllers.json"), "w"), indent=1)
print("formas:", N, [r["key"] for r in rows if not r["anim"]])

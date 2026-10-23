#!/usr/bin/env python3
# tools/native_worldgen.py - 9.0: GERAÇÃO NATIVA das estruturas (o gerador de mundo do Bedrock coloca junto com os chunks; sem script em tempo de jogo).
# Para cada estrutura da tabela NATIVE abaixo gera (idempotente):
#   BP/structures/etheria_nat/<key>.mcstructure      cópia da estrutura original com: baús já com loot table no NBT (LootTable) e 2 marcadores no
#                                                    centro (light_block_0 invisível = "ainda não ativada"; terracota vitrificada virada ao norte =
#                                                    identidade (cor) + rotação sorteada pelo gerador). Recorte opcional (cabe em 48x48).
#   BP/features/etheria/<key>.feature.json           minecraft:structure_template_feature (facing_direction random)
#   BP/feature_rules/etheria/<key>.feature_rule.json minecraft:feature_rules (bioma/dimensão, raridade por chunk, y por heightmap)
#   BP/loot_tables/etheria/wg_tier{1,2,3}.json       loot dos baús das ruínas/acampamentos (mesmas listas do LOOT de systems/worldgen.js)
#   BP/scripts/data/natgen.gen.js                    dados para systems/natgen.js (ativação leve: guardas/chefe + registro, uma única vez)
# Limite: pegada <= 48x48 (a estrutura cabe na janela de 3x3 chunks em volta do chunk de origem; maiores seriam cortadas na borda dos chunks).
# Uso: python3 tools/native_worldgen.py           (gera e valida)    |   python3 tools/native_worldgen.py --check   (só valida)
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tnbt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
SRC = os.path.join(BP, "structures", "etheria")
NS = "etheria_nat"
OUT_ST = os.path.join(BP, "structures", NS)
OUT_F = os.path.join(BP, "features", "etheria")
OUT_R = os.path.join(BP, "feature_rules", "etheria")
DATA = os.path.join(BP, "scripts", "data", "natgen.gen.js")
MAXW = 48
FV = "1.21.0"

# ---------------------------------------------------------------- tabela: chave -> origem, onde nasce, raridade (1 em N chunks), cor do marcador
#   src: wg (data/wgen.gen.js) | dg (data/dungeons.gen.js) | world (data/arenas.gen.js WORLD, colocadas por systems/structures.js)
#   bio: land | goblin | swamp | plains | deep_ocean | nether | end
NATIVE = [
    # chave                  src      bio          N     cor            recorte (x0, z0, w, d)
    ("ruina_templo",          "wg",    "land",      1500, "white",       None),
    ("ruina_torre",           "wg",    "land",      1500, "orange",      None),
    ("ruina_circulo",         "wg",    "land",      1500, "magenta",     None),
    ("ruina_forte",           "wg",    "land",      1500, "light_blue",  None),
    ("goblin_forte",          "wg",    "goblin",    1100, "yellow",      None),
    ("goblin_covil",          "wg",    "goblin",    1100, "lime",        (1, 1, 47, 47)),   # 49x49 com 1 coluna de ar na borda
    ("lagarto_posto",         "wg",    "swamp",      350, "pink",        None),
    ("lagarto_posto2",        "wg",    "swamp",      350, "gray",        None),
    ("castelo_celestial",     "dg",    "land",      2600, "silver",      None),
    ("masmorra_goblin",       "dg",    "goblin",    1800, "cyan",        None),
    ("santuario_submerso",    "dg",    "deep_ocean", 700, "purple",      None),
    ("fortaleza_sombria",     "dg",    "nether",     500, "red",         None),
    ("santuario_vazio",       "dg",    "end",        300, "black",       None),
    ("otherworlder",          "world", "plains",    1800, "blue",        None),
    ("hinata_church",         "world", "plains",    3000, "brown",       None),
    ("rimuru_ogre_fight_boss", "world", "goblin",   3000, "green",       None),
]
DIM = {"nether": "minecraft:nether", "end": "minecraft:the_end"}
FILLER = {"minecraft:overworld": "minecraft:dirt", "minecraft:nether": "minecraft:netherrack", "minecraft:the_end": "minecraft:end_stone"}
SPAWN_R = 320      # mundo normal: nada nasce a menos de 320 blocos de (0, 0) (spawn / Tempest)
END_R = 1000       # End: só nas ilhas externas

T = lambda v, op="==": {"test": "has_biome_tag", "operator": op, "value": v}
NOT_WET = [T("ocean", "!="), T("river", "!="), T("beach", "!=")]
BIOMES = {
    "land": [T("overworld"), *NOT_WET, T("mushroom_island", "!="), T("swamp", "!="), T("mangrove_swamp", "!=")],
    "goblin": [T("overworld"), *NOT_WET, {"any_of": [T("forest"), T("plains"), T("taiga")]}],
    "swamp": [T("overworld"), {"any_of": [T("swamp"), T("mangrove_swamp")]}],
    "plains": [T("overworld"), *NOT_WET, {"any_of": [T("plains"), T("meadow")]}],
    "deep_ocean": [T("ocean"), T("deep")],
    "nether": [T("nether")],
    "end": [T("the_end")],
}
NETHER_OK = ["minecraft:air", "minecraft:lava", "minecraft:flowing_lava", "minecraft:netherrack", "minecraft:soul_sand", "minecraft:soul_soil",
             "minecraft:basalt", "minecraft:smooth_basalt", "minecraft:blackstone", "minecraft:magma", "minecraft:gravel", "minecraft:glowstone",
             "minecraft:quartz_ore", "minecraft:nether_gold_ore", "minecraft:crimson_nylium", "minecraft:warped_nylium", "minecraft:crimson_roots",
             "minecraft:warped_roots", "minecraft:crimson_fungus", "minecraft:warped_fungus", "minecraft:nether_sprouts", "minecraft:weeping_vines",
             "minecraft:twisting_vines", "minecraft:crimson_stem", "minecraft:warped_stem", "minecraft:nether_wart_block", "minecraft:warped_wart_block",
             "minecraft:shroomlight", "minecraft:fire", "minecraft:soul_fire", "minecraft:bone_block"]
LOOT = {   # = LOOT de systems/worldgen.js (baús das estruturas comuns)
    1: [["minecraft:bread", 2, 5, 0.8], ["minecraft:arrow", 6, 16, 0.6], ["minecraft:iron_ingot", 1, 4, 0.6], ["etheria:goblin_ear", 1, 3, 0.5], ["etheria:hp_potion_s", 1, 2, 0.4], ["minecraft:gold_nugget", 3, 9, 0.5]],
    2: [["minecraft:iron_ingot", 3, 8, 0.8], ["minecraft:gold_ingot", 2, 5, 0.6], ["etheria:mana_crystal", 1, 3, 0.6], ["etheria:hp_potion_s", 1, 3, 0.6], ["minecraft:golden_apple", 1, 1, 0.2], ["etheria:arcane_ingot", 1, 2, 0.3], ["minecraft:emerald", 1, 4, 0.4]],
    3: [["minecraft:diamond", 1, 4, 0.7], ["minecraft:gold_ingot", 4, 10, 0.8], ["etheria:arcane_ingot", 2, 4, 0.6], ["etheria:mana_crystal", 3, 6, 0.8], ["etheria:demonite_shard", 1, 3, 0.5], ["minecraft:enchanted_golden_apple", 1, 1, 0.08], ["minecraft:emerald", 3, 8, 0.7]],
}


def js_obj(path, var):
    s = open(path, encoding="utf8").read()
    m = re.search(r"export const %s = (\{.*?\});\s*(\n|$)" % var, s, re.S)
    return json.loads(m.group(1))


def defs():
    wg = js_obj(os.path.join(BP, "scripts/data/wgen.gen.js"), "WGEN")
    dg = js_obj(os.path.join(BP, "scripts/data/dungeons.gen.js"), "DUNGEONS")
    world = js_obj(os.path.join(BP, "scripts/data/arenas.gen.js"), "WORLD")
    return {"wg": wg, "dg": dg, "world": world}


def wdump(path, obj):
    txt = json.dumps(obj, indent=1, ensure_ascii=False) + "\n"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path) and open(path, encoding="utf8").read() == txt: return 0
    open(path, "w", encoding="utf8").write(txt); return 1


def wbytes(path, b):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path) and open(path, "rb").read() == b: return 0
    open(path, "wb").write(b); return 1


def loot_table(entries):
    pools = [{"rolls": 1, "conditions": [{"condition": "random_chance", "chance": ch}],
              "entries": [{"type": "item", "name": i, "weight": 1, "functions": [{"function": "set_count", "count": {"min": lo, "max": hi}}]}]}
             for i, lo, hi, ch in entries]
    return {"pools": pools}


# ---------------------------------------------------------------- .mcstructure
def C(comp, key): return tnbt.get(comp, key)


def build_struct(key, d, color, crop, dim):
    """lê a estrutura original, recorta, põe LootTable nos baús e os 2 marcadores; devolve (bytes, info)"""
    name, (t, root) = tnbt.read(os.path.join(SRC, d["id"].split(":")[1] + ".mcstructure"))
    sx, sy, sz = C(root, "size")[1][1]
    st = C(root, "structure")[1]
    l0, l1 = [lay[1] for lay in C(st, "block_indices")[1][1]]
    pal_c = C(C(C(st, "palette")[1], "default")[1], "block_palette")[1][1]
    names = [C(p, "name")[1] for p in pal_c]
    ver = C(pal_c[0], "version")[1]
    x0, z0, w, dd = crop or (0, 0, sx, sz)
    I = lambda x, y, z, SY, SZ: x * SY * SZ + y * SZ + z
    n0, n1 = [], []
    for x in range(x0, x0 + w):
        for y in range(sy):
            for z in range(z0, z0 + dd):
                i = I(x, y, z, sy, sz); n0.append(l0[i]); n1.append(l1[i])
    if crop:   # nada de bloco sólido fora do recorte
        for x in range(sx):
            for y in range(sy):
                for z in range(sz):
                    if x0 <= x < x0 + w and z0 <= z < z0 + dd: continue
                    v = l0[I(x, y, z, sy, sz)]
                    assert v < 0 or names[v] in ("minecraft:air", "minecraft:structure_void"), f"{key}: recorte cortaria {names[v]} em {x},{y},{z}"
    sx, sz = w, dd
    floor = d.get("floor", 0)
    L = max(0, floor - 2)
    cx, cz = sx // 2, sz // 2

    def pal_add(n, states):
        pal_c.append([("name", (8, n)), ("states", (10, states)), ("version", (3, ver))]); return len(pal_c) - 1
    restore = []
    for yy, blk, states in ((L, "minecraft:light_block_0", []), (L + 1, f"minecraft:{color}_glazed_terracotta", [("facing_direction", (3, 2))])):
        i = I(cx, yy, cz, sy, sz)
        old = n0[i]
        if old < 0 or names[old] == "minecraft:structure_void": restore.append([FILLER[dim], {}])
        else:
            stt = {k: v[1] for k, v in C(pal_c[old], "states")[1]}
            restore.append([names[old], stt])
        n0[i] = pal_add(blk, states); n1[i] = -1
    # baús: loot table no NBT (rola quando o jogador abre); posições do registro (ajustadas ao recorte)
    bpd = []
    chests = []
    for c in d.get("chests", []):
        x, y, z, tier = c[0] - x0, c[1], c[2] - z0, c[3]
        i = I(x, y, z, sy, sz)
        assert 0 <= x < sx and 0 <= z < sz and "chest" in names[n0[i]], f"{key}: baú esperado em {c} ({names[n0[i]] if n0[i] >= 0 else 'void'})"
        table = f"loot_tables/etheria/{tier}.json" if isinstance(tier, str) else f"loot_tables/etheria/wg_tier{tier}.json"
        chests.append(table)
        bpd.append((str(i), (10, [("block_entity_data", (10, [
            ("Findable", (1, 0)), ("Items", (9, (10, []))), ("LootTable", (8, table)), ("LootTableSeed", (3, 0)),
            ("id", (8, "Chest")), ("isMovable", (1, 1)), ("x", (3, x)), ("y", (3, y)), ("z", (3, z))]))])))
    root2 = [("format_version", (3, 1)), ("size", (9, (3, [sx, sy, sz]))),
             ("structure", (10, [("block_indices", (9, (9, [(3, n0), (3, n1)]))), ("entities", (9, (10, []))),
                                 ("palette", (10, [("default", (10, [("block_palette", (9, (10, pal_c))), ("block_position_data", (10, bpd))]))]))])),
             ("structure_world_origin", (9, (3, [0, 0, 0])))]
    o = [bytes([10])]; tnbt._ws(o, ""); tnbt._wp(o, 10, root2)
    mobs = [[m[0], m[1] - x0 - cx, m[2], m[3] - z0 - cz] for m in d.get("mobs", [])]
    return b"".join(o), {"size": [sx, sy, sz], "floor": floor, "L": L, "c": [cx, cz], "restore": restore, "mobs": mobs, "chests": len(chests)}


# ---------------------------------------------------------------- feature / feature rule
def axis(s):
    h = s // 2
    lo, hi = max(-h, -16), min(16 - h, 32 - s)
    assert lo <= hi, s
    return {"distribution": "uniform", "extent": [lo, hi]}, h


def y_expr(bio, info):
    (hx, hz), F = info["c"], info["floor"]
    if bio == "nether": return 32 - F                                   # piso na altura do mar de lava (y 32)
    q = "q.above_top_solid" if bio == "deep_ocean" else "q.heightmap"  # fundo do mar / superfície
    base = f"{q}(v.worldx + {hx}, v.worldz + {hz}) - {1 + F}"
    r = END_R if bio == "end" else SPAWN_R
    return f"((v.worldx * v.worldx + v.worldz * v.worldz) < {r * r}) ? -300 : ({base})"


def feature(key, bio):
    c = {"block_intersection": {"block_allowlist": NETHER_OK}} if bio == "nether" else \
        {"grounded": {}} if bio in ("deep_ocean", "end") else {"grounded": {}, "unburied": {}}
    return {"format_version": FV, "minecraft:structure_template_feature": {
        "description": {"identifier": f"etheria:nat_{key}_feature"},
        "structure_name": f"{NS}:{key}", "adjustment_radius": 4, "facing_direction": "random", "constraints": c}}


def rule(key, bio, n, info):
    sx, _, sz = info["size"]
    ax, _ = axis(sx); az, _ = axis(sz)
    return {"format_version": FV, "minecraft:feature_rules": {
        "description": {"identifier": f"etheria:nat_{key}_rule", "places_feature": f"etheria:nat_{key}_feature"},
        "conditions": {"placement_pass": "after_surface_pass", "minecraft:biome_filter": BIOMES[bio]},
        "distribution": {"iterations": 1, "scatter_chance": {"numerator": 1, "denominator": n}, "coordinate_eval_order": "xzy",
                         "x": ax, "z": az, "y": y_expr(bio, info)}}}


# ---------------------------------------------------------------- validador
def validate():
    errs = []
    blocks = {b["name"] for b in json.load(open(os.path.join(ROOT, "tools/mojang-blocks-1.21.80.json")))["data_items"]}
    feats = {}
    for f in sorted(os.listdir(OUT_F)) if os.path.isdir(OUT_F) else []:
        p = os.path.join(OUT_F, f)
        try: j = json.load(open(p, encoding="utf8"))
        except Exception as e: errs.append(f"{f}: JSON inválido {e}"); continue
        s = j.get("minecraft:structure_template_feature")
        if j.get("format_version") != FV or not s: errs.append(f"{f}: format_version/tipo"); continue
        ident = s.get("description", {}).get("identifier", "")
        for k in ("structure_name", "constraints"):
            if k not in s: errs.append(f"{f}: falta {k}")
        if s.get("facing_direction") not in (None, "north", "south", "east", "west", "random"): errs.append(f"{f}: facing_direction")
        if not 0 <= s.get("adjustment_radius", 0) <= 16: errs.append(f"{f}: adjustment_radius fora de 0..16")
        if not set(s.get("constraints", {})) <= {"grounded", "unburied", "block_intersection"} or not s.get("constraints"): errs.append(f"{f}: constraints")
        for b in s.get("constraints", {}).get("block_intersection", {}).get("block_allowlist", []):
            if b not in blocks: errs.append(f"{f}: bloco desconhecido {b}")
        ns, nm = s.get("structure_name", ":").split(":", 1)
        sp = os.path.join(BP, "structures", ns, nm + ".mcstructure")
        if not os.path.exists(sp): errs.append(f"{f}: estrutura {s.get('structure_name')} não existe"); continue
        _, (t, root) = tnbt.read(sp)
        sx, sy, sz = C(root, "size")[1][1]
        if max(sx, sz) > MAXW: errs.append(f"{f}: pegada {sx}x{sz} > {MAXW}")
        st = C(root, "structure")[1]; pal = C(C(C(st, "palette")[1], "default")[1], "block_palette")[1][1]
        pn = [C(p, "name")[1] for p in pal]
        if "minecraft:light_block_0" not in pn or not any(n.endswith("_glazed_terracotta") for n in pn): errs.append(f"{f}: sem marcadores")
        unk = sorted({n for n in pn if n not in blocks and n != "minecraft:structure_void" and not n.startswith("etheria:")})
        if unk: errs.append(f"{f}: blocos desconhecidos {unk[:4]}")
        feats[ident] = f
    rules = 0
    for f in sorted(os.listdir(OUT_R)) if os.path.isdir(OUT_R) else []:
        try: j = json.load(open(os.path.join(OUT_R, f), encoding="utf8"))
        except Exception as e: errs.append(f"{f}: JSON inválido {e}"); continue
        r = j.get("minecraft:feature_rules"); rules += 1
        if j.get("format_version") != FV or not r: errs.append(f"{f}: format_version/tipo"); continue
        if r["description"].get("places_feature") not in feats: errs.append(f"{f}: places_feature inexistente")
        c, d = r.get("conditions", {}), r.get("distribution", {})
        if c.get("placement_pass") not in ("first_pass", "before_surface_pass", "surface_pass", "after_surface_pass", "final_pass"): errs.append(f"{f}: placement_pass")
        if not c.get("minecraft:biome_filter"): errs.append(f"{f}: sem biome_filter")
        if d.get("iterations") != 1 or not all(k in d for k in ("x", "y", "z", "scatter_chance")): errs.append(f"{f}: distribution")
        sc = d.get("scatter_chance", {})
        if not (isinstance(sc, dict) and sc.get("numerator") == 1 and sc.get("denominator", 0) >= 100): errs.append(f"{f}: raridade")
    if rules != len(feats): errs.append(f"regras {rules} != features {len(feats)}")
    return errs, len(feats)


def main():
    if "--check" not in sys.argv:
        D = defs(); ch = 0; data = {}
        for t in (1, 2, 3): ch += wdump(os.path.join(BP, f"loot_tables/etheria/wg_tier{t}.json"), loot_table(LOOT[t]))
        for key, src, bio, n, color, crop in NATIVE:
            d = D[src][key]; dim = DIM.get(bio, "minecraft:overworld")
            b, info = build_struct(key, d, color, crop, dim)
            ch += wbytes(os.path.join(OUT_ST, key + ".mcstructure"), b)
            ch += wdump(os.path.join(OUT_F, key + ".feature.json"), feature(key, bio))
            ch += wdump(os.path.join(OUT_R, key + ".feature_rule.json"), rule(key, bio, n, info))
            data[key] = {"src": src, "name": d.get("name", key), "dim": dim, "bio": bio, "n": n, "marker": f"minecraft:{color}_glazed_terracotta",
                         "size": info["size"], "floor": info["floor"], "L": info["L"], "restore": info["restore"], "mobs": info["mobs"],
                         "chests": info["chests"], "sep": d.get("sep", 100)}
        js = ("// GERADO por tools/native_worldgen.py (9.0): estruturas de GERAÇÃO NATIVA (features/feature_rules em BP; arquivos em structures/etheria_nat).\n"
              "// systems/natgen.js acha o marcador (light_block_0 no centro) perto dos jogadores e ativa a estrutura uma única vez.\n"
              f"export const NATIVE = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n")
        if not os.path.exists(DATA) or open(DATA, encoding="utf8").read() != js: open(DATA, "w", encoding="utf8").write(js); ch += 1
        print(f"native_worldgen: {len(NATIVE)} estruturas, {ch} arquivo(s) alterado(s)")
    errs, n = validate()
    print(f"validação: {n} features, erros: {errs}")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()

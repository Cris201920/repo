#!/usr/bin/env python3
# tools/native_worldgen.py - 9.0: GERAÇÃO NATIVA das estruturas (o gerador de mundo do Bedrock coloca junto com os chunks; sem script em tempo de jogo).
# Para cada estrutura da tabela NATIVE abaixo gera (idempotente):
#   BP/structures/etheria_nat/<key>.mcstructure      cópia EXATA da estrutura original (bloco a bloco; 9.3: sem marcadores) com os baús já com
#                                                    loot table no NBT (LootTable). Recorte opcional (cabe em 48x48). O validador confere a cópia.
#   BP/features/etheria/<key>.feature.json           minecraft:structure_template_feature (facing_direction random)
#   BP/feature_rules/etheria/<key>.feature_rule.json minecraft:feature_rules (bioma/dimensão, raridade por chunk, y por heightmap)
#   BP/loot_tables/etheria/wg_tier{1,2,3}.json       loot dos baús das ruínas/acampamentos (mesmas listas do LOOT de systems/worldgen.js)
#   BP/scripts/data/natgen.gen.js                    dados para systems/natgen.js (ativação leve: guardas/chefe + registro, uma única vez):
#                                                    âncora (bloco raro da própria estrutura) + assinatura (12+ blocos vizinhos) para reconhecê-la
#                                                    nas 4 rotações sem nenhum bloco marcador.
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

# ---------------------------------------------------------------- tabela: chave -> origem, onde nasce, raridade (1 em N chunks)
#   src: wg (data/wgen.gen.js) | dg (data/dungeons.gen.js) | world (data/arenas.gen.js WORLD, colocadas por systems/structures.js)
#   bio: land | goblin | swamp | plains | deep_ocean | nether | end
NATIVE = [
    # chave                  src      bio          N     recorte (x0, z0, w, d)
    ("ruina_templo",          "wg",    "land",      1500, None),
    ("ruina_torre",           "wg",    "land",      1500, None),
    ("ruina_circulo",         "wg",    "land",      1500, None),
    ("ruina_forte",           "wg",    "land",      1500, None),
    ("goblin_forte",          "wg",    "goblin",    1100, None),
    ("goblin_covil",          "wg",    "goblin",    1100, (1, 1, 47, 47)),   # 49x49 com 1 coluna de ar na borda
    ("lagarto_posto",         "wg",    "swamp",      350, None),
    ("lagarto_posto2",        "wg",    "swamp",      350, None),
    ("castelo_celestial",     "dg",    "land",      2600, None),
    ("masmorra_goblin",       "dg",    "goblin",    1800, None),
    ("santuario_submerso",    "dg",    "deep_ocean", 700, None),
    ("fortaleza_sombria",     "dg",    "nether",     500, None),
    ("santuario_vazio",       "dg",    "end",        300, None),
    ("otherworlder",          "world", "plains",    1800, None),
    ("hinata_church",         "world", "plains",    3000, None),
    ("rimuru_ogre_fight_boss", "world", "goblin",   3000, None),
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


def build_struct(key, d, crop, dim):
    """lê a estrutura original, recorta e põe LootTable nos baús (NENHUM bloco é acrescentado: 9.3 sem marcadores); devolve (bytes, info)"""
    name, (t, root) = tnbt.read(os.path.join(SRC, d["id"].split(":")[1] + ".mcstructure"))
    sx, sy, sz = C(root, "size")[1][1]
    st = C(root, "structure")[1]
    l0, l1 = [lay[1] for lay in C(st, "block_indices")[1][1]]
    pal_c = C(C(C(st, "palette")[1], "default")[1], "block_palette")[1][1]
    names = [C(p, "name")[1] for p in pal_c]
    stateless = [not C(p, "states")[1] for p in pal_c]
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
    # 9.3: o que as versões 9.0-9.2 punham no centro (light_block_0 em L e terracota em L+1) e o bloco original de cada posição:
    # só para LIMPAR os marcadores que ainda existam em mundos gerados antes (systems/natgen.js devolve o bloco original).
    restore = []
    for yy in (L, L + 1):
        old = n0[I(cx, yy, cz, sy, sz)]
        if old < 0 or names[old] == "minecraft:structure_void": restore.append([FILLER[dim], {}])
        else: restore.append([names[old], {k: v[1] for k, v in C(pal_c[old], "states")[1]}])
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
    mobs = [[m[0], m[1] - x0, m[2], m[3] - z0] for m in d.get("mobs", [])]
    grid = Grid(sx, sy, sz, [names[v] if v >= 0 else None for v in n0], [v >= 0 and stateless[v] for v in n0])
    return b"".join(o), {"size": [sx, sy, sz], "floor": floor, "L": L, "c": [cx, cz], "restore": restore, "mobs": mobs, "chests": len(chests), "grid": grid}


# ---------------------------------------------------------------- 9.3: ÂNCORA + ASSINATURA (sem bloco marcador)
# A estrutura é reconhecida pelos PRÓPRIOS blocos: um bloco raro dela (âncora: baú, atril, mesa de encantamento...) e ~12 blocos
# vizinhos de tipo fixo (assinatura) testados nas 4 rotações. Escolhidos aqui de forma determinística para que nenhuma outra posição
# do mesmo tipo (nesta ou em outra estrutura da mesma dimensão, em qualquer rotação) chegue perto de bater: toda hipótese falsa
# tem >= MISS_FALSE diferenças certas; no jogo aceita-se no máximo MISS_OK (tolera 1 bloco quebrado/trocado).
ANCHOR_OK = ["minecraft:chest", "minecraft:lectern", "minecraft:enchanting_table", "minecraft:jukebox", "minecraft:barrel",
             "minecraft:flower_pot", "minecraft:bookshelf"]
UNSTABLE = re.compile(r"air$|structure_void|light_block|water|lava|grass|dirt|sand|gravel|concrete_powder|ice$|snow|leaves|web$|magma$|"
                      r"farmland|mycelium|podzol|moss|vine|fire|kelp|seagrass|coral|sponge|slime|noteblock|tnt|glowstone|_ore$|infested")
SIG_N, MISS_FALSE, MISS_OK, SIG_R = 12, 3, 1, 20


class Grid:
    def __init__(s, sx, sy, sz, names, stateless):
        s.sx, s.sy, s.sz, s.names, s.stateless = sx, sy, sz, names, stateless

    def at(s, x, y, z):
        """nome do bloco, None = vazio (structure_void) ou fora da caixa"""
        if 0 <= x < s.sx and 0 <= y < s.sy and 0 <= z < s.sz: return s.names[x * s.sy * s.sz + y * s.sz + z]
        return None


def rot(dx, dz, r):
    for _ in range(r & 3): dx, dz = -dz, dx
    return dx, dz


def anchor_of(key, g, cxz):
    cnt = {}
    for n in g.names:
        if n: cnt[n] = cnt.get(n, 0) + 1
    typ = next((t for t in ANCHOR_OK if t == "minecraft:chest" and 0 < cnt.get(t, 0) <= 8), None) or \
        min((t for t in ANCHOR_OK if cnt.get(t)), key=lambda t: cnt[t], default=None)
    assert typ, f"{key}: sem bloco âncora"
    cx, cz = cxz
    a = min(cells_of(g, typ), key=lambda c: ((c[0] - cx) ** 2 + (c[2] - cz) ** 2, c))   # o mais central (determinístico)
    return typ, a


_cells = {}


def cells_of(g, typ):
    k = (id(g), typ)
    if k not in _cells: _cells[k] = [(x, y, z) for x in range(g.sx) for y in range(g.sy) for z in range(g.sz) if g.at(x, y, z) == typ]
    return _cells[k]


def sig_hyps(me, others):
    """hipóteses falsas: (grade, posição de um bloco do tipo âncora, rotação relativa) nesta e nas outras estruturas da dimensão"""
    key, g, typ, a = me
    out = []
    for g2 in [g] + others:
        for c in cells_of(g2, typ):
            for k in range(4):
                if g2 is g and c == a and k == 0: continue
                out.append((g2, c, k))
    return out


def miss(h, p):
    g, (x, y, z), k = h
    dx, dy, dz, n = p
    rx, rz = rot(dx, dz, k)
    v = g.at(x + rx, y + dy, z + rz)
    return v is not None and v != n


def pick_sig(me, others, cxz):
    key, g, typ, a = me
    ax, ay, az = a
    cx, cz = cxz
    pool = []
    for x in range(max(0, ax - SIG_R), min(g.sx, ax + SIG_R + 1)):
        for y in range(g.sy):
            for z in range(max(0, az - SIG_R), min(g.sz, az + SIG_R + 1)):
                n = g.at(x, y, z)
                if n is None or (x, z) == (cx, cz) or (x, y, z) == a or UNSTABLE.search(n) or not g.stateless[x * g.sy * g.sz + y * g.sz + z]: continue
                pool.append((x - ax, y - ay, z - az, n))
    pool.sort(key=lambda p: (abs(p[0]) + abs(p[1]) + abs(p[2]), p))
    pool = pool[::max(1, len(pool) // 1500)]                     # amostra determinística (perto da âncora primeiro)
    hyps = sig_hyps(me, others)
    need = [MISS_FALSE] * len(hyps)
    sig = []
    while any(n > 0 for n in need) and len(sig) < 40:
        best, bs = None, 0
        for p in pool:
            if p in sig: continue
            sc = sum(1 for i, h in enumerate(hyps) if need[i] > 0 and miss(h, p))
            if sc > bs: best, bs = p, sc
        if not best: break
        sig.append(best)
        for i, h in enumerate(hyps):
            if need[i] > 0 and miss(h, best): need[i] -= 1
    bad = sum(1 for n in need if n > 0)
    assert not bad, f"{key}: assinatura não separa {bad} hipóteses"
    rest = [p for p in pool if p not in sig]                     # completa até SIG_N com pontos espalhados (robustez)
    step = max(1, len(rest) // max(1, SIG_N - len(sig)))
    for p in rest[::step]:
        if len(sig) >= SIG_N: break
        sig.append(p)
    return sig, len(hyps)


def check_sig(me, others, sig):
    """devolve (erros) - a âncora verdadeira bate, toda hipótese falsa tem >= MISS_FALSE diferenças"""
    key, g, typ, a = me
    errs = []
    for dx, dy, dz, n in sig:
        if g.at(a[0] + dx, a[1] + dy, a[2] + dz) != n: errs.append(f"{key}: assinatura não bate na própria estrutura")
    for h in sig_hyps(me, others):
        if sum(1 for p in sig if miss(h, p)) < MISS_FALSE: errs.append(f"{key}: assinatura ambígua"); break
    return errs


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
def struct_grid(path):
    _, (t, root) = tnbt.read(path)
    sx, sy, sz = C(root, "size")[1][1]
    st = C(root, "structure")[1]
    l0 = C(st, "block_indices")[1][1][0][1]
    pal = C(C(C(st, "palette")[1], "default")[1], "block_palette")[1][1]
    pn = [C(p, "name")[1] for p in pal]
    return Grid(sx, sy, sz, [pn[v] if v >= 0 else None for v in l0], [v >= 0 and not C(pal[v], "states")[1] for v in l0]), pn


def validate(full=True):
    errs = []
    blocks = {b["name"] for b in json.load(open(os.path.join(ROOT, "tools/mojang-blocks-1.21.80.json")))["data_items"]}
    feats = {}
    grids = {}
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
        g, pn = struct_grid(sp)
        grids[nm] = g
        if max(g.sx, g.sz) > MAXW: errs.append(f"{f}: pegada {g.sx}x{g.sz} > {MAXW}")
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
    # 9.3: cada estrutura nativa = EXATAMENTE a original (recortada), bloco a bloco: nenhum marcador; e a assinatura do natgen.gen.js é única
    try: data = js_obj(DATA, "NATIVE")
    except Exception as e: errs.append(f"natgen.gen.js: {e}"); data = {}
    if full and data:
        D = defs()
        for key, src, bio, n, crop in NATIVE:
            g = grids.get(key)
            if not g: errs.append(f"{key}: sem estrutura"); continue
            og, _ = struct_grid(os.path.join(SRC, D[src][key]["id"].split(":")[1] + ".mcstructure"))
            x0, z0, w, dd = crop or (0, 0, og.sx, og.sz)
            diff = sum(1 for x in range(w) for y in range(og.sy) for z in range(dd) if og.at(x + x0, y, z + z0) != g.at(x, y, z))
            if diff or (g.sx, g.sy, g.sz) != (w, og.sy, dd): errs.append(f"{key}: {diff} bloco(s) diferentes da estrutura original")
        bydim = {}
        for key, d in data.items(): bydim.setdefault(d["dim"], []).append(key)
        for key, d in data.items():
            g = grids.get(key)
            if not g or not d.get("sig"): errs.append(f"{key}: sem assinatura"); continue
            others = [grids[k] for k in bydim[d["dim"]] if k != key and k in grids]
            sig = [(dx, dy, dz, d["types"][ti]) for dx, dy, dz, ti in d["sig"]]
            if g.at(*d["at"]) != d["anchor"]: errs.append(f"{key}: âncora não confere")
            if len(sig) < SIG_N - 2: errs.append(f"{key}: assinatura curta")
            errs += check_sig((key, g, d["anchor"], tuple(d["at"])), others, sig)
    return errs, len(feats)


def main():
    if "--check" not in sys.argv:
        D = defs(); ch = 0; data = {}; built = {}
        for t in (1, 2, 3): ch += wdump(os.path.join(BP, f"loot_tables/etheria/wg_tier{t}.json"), loot_table(LOOT[t]))
        for key, src, bio, n, crop in NATIVE:
            d = D[src][key]; dim = DIM.get(bio, "minecraft:overworld")
            b, info = build_struct(key, d, crop, dim)
            built[key] = (d, dim, info)
            ch += wbytes(os.path.join(OUT_ST, key + ".mcstructure"), b)
            ch += wdump(os.path.join(OUT_F, key + ".feature.json"), feature(key, bio))
            ch += wdump(os.path.join(OUT_R, key + ".feature_rule.json"), rule(key, bio, n, info))
        for key, src, bio, n, crop in NATIVE:
            d, dim, info = built[key]; g = info["grid"]
            typ, a = anchor_of(key, g, info["c"])
            others = [built[k][2]["grid"] for k in built if k != key and built[k][1] == dim]
            sig, nh = pick_sig((key, g, typ, a), others, info["c"])
            types = sorted({p[3] for p in sig})
            ax, ay, az = a; (cx, cz) = info["c"]
            data[key] = {"src": src, "name": d.get("name", key), "dim": dim, "bio": bio, "n": n,
                         "size": info["size"], "floor": info["floor"], "chests": info["chests"], "sep": d.get("sep", 100),
                         "anchor": typ, "at": [ax, ay, az], "types": types, "sig": [[dx, dy, dz, types.index(t)] for dx, dy, dz, t in sig],
                         "c": [cx - ax, -ay, cz - az],
                         "mobs": [[t, x - ax, y - ay, z - az] for t, x, y, z in info["mobs"]],
                         "L": info["L"], "restore": info["restore"]}
            print(f"  {key:24s} âncora {typ.split(':')[1]:16s} em {a}  assinatura {len(sig)} blocos  hipóteses falsas testadas {nh}")
        js = ("// GERADO por tools/native_worldgen.py (9.3): estruturas de GERAÇÃO NATIVA (features/feature_rules em BP; arquivos em structures/etheria_nat).\n"
              "// SEM blocos marcadores: systems/natgen.js reconhece cada estrutura pelos próprios blocos (âncora + assinatura nas 4 rotações)\n"
              "// quando um jogador entra num chunk novo perto dela, e a ativa uma única vez (guardas/chefe + registro).\n"
              "// at = âncora na estrutura sem rotação; sig/mobs/c = deslocamentos relativos à âncora; L/restore = limpeza dos marcadores de mundos 9.0-9.2.\n"
              f"export const NATIVE = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n")
        if not os.path.exists(DATA) or open(DATA, encoding="utf8").read() != js: open(DATA, "w", encoding="utf8").write(js); ch += 1
        print(f"native_worldgen: {len(NATIVE)} estruturas, {ch} arquivo(s) alterado(s)")
    errs, n = validate()
    print(f"validação: {n} features, erros: {errs}")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()

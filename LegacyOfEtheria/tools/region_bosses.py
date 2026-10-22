"""8.7 (Etapa 7a) - CHEFES POR REGIÃO: gera entidades (BP+RP), texturas recoloridas, loot tables, itens de material e regras de spawn.
Reaproveita modelos/animações já existentes no projeto (nada de textura nova do usuário): cada chefe é um modelo do addon com a textura
passada por um "mapa de gradiente" (luminância -> paleta da região), preservando pele/dourado quando faz sentido.
  Vazio (End):    Dragão do Vazio (modelo/voo do Veldanava), Cavaleiro do Vazio (Cavaleiro Negro, espada dourada), Rainha do Vazio (Obera)
                  + o Senhor do Vazio que já existia (boss_void_lord) -> agora só nasce no End.
  Inferno:        Anjo Caído (Feldway Angelical, asas negras/vermelhas do anjo caído)  + Tirano Brasa (boss_ember_tyrant) só no Inferno.
  Mundo normal:   Anjo Guardião (Zalario dourado), Rei Goblin com escolta (script), só 2 aranhas no spawn natural (Taratect e Rainha Taratect).
  Oceano:         Guardiã Cristalina das Marés (Lorde Branco cristalino) segurando o Tridente dos Dragões Marinhos (geometria da arma).
Idempotente: reescreve sempre os mesmos arquivos. Uso: python3 tools/region_bosses.py
Ícones de pena usam a pena do jar do Tensura enviado (uso pessoal, fora do git); sem o jar, desenha uma pena simples."""
import colorsys, copy, glob, json, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "LegacyOfEtheria_BP"); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
FEATHER_SRC = [os.environ.get("TENSURA_FEATHER", ""), "/tmp/claude-0/-home-user-repo/caf30e82-444a-5c52-8cea-01da7f718242/scratchpad/tensura102/assets/tensura/textures/item/dragon_peacock_feather.png"]

# ------------------------------------------------------------------ paletas (posição 0..1 da luminância -> cor)
VOID = [(0, (6, 2, 12)), (0.25, (34, 8, 62)), (0.5, (92, 26, 160)), (0.75, (178, 84, 250)), (1, (236, 205, 255))]
VOID_DARK = [(0, (4, 2, 8)), (0.35, (24, 8, 44)), (0.65, (70, 22, 120)), (1, (170, 110, 240))]
QUEEN = [(0, (10, 2, 18)), (0.3, (58, 10, 88)), (0.6, (150, 30, 170)), (0.85, (240, 110, 220)), (1, (255, 225, 250))]
FALLEN = [(0, (6, 4, 6)), (0.5, (30, 26, 32)), (0.85, (70, 62, 74)), (1, (120, 110, 124))]
CRIMSON = [(0, (30, 0, 4)), (0.45, (120, 8, 20)), (0.8, (210, 30, 40)), (1, (255, 120, 110))]
GOLD = [(0, (54, 30, 6)), (0.35, (150, 96, 22)), (0.7, (236, 190, 70)), (1, (255, 250, 220))]
CRYSTAL = [(0, (18, 16, 58)), (0.3, (88, 52, 170)), (0.55, (190, 90, 210)), (0.8, (150, 200, 250)), (1, (230, 252, 255))]
EMBER = [(0, (28, 4, 0)), (0.4, (140, 30, 6)), (0.75, (240, 110, 20)), (1, (255, 230, 150))]

def ramp(stops, t):
    t = max(0.0, min(1.0, t))
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if t <= b:
            k = 0 if b == a else (t - a) / (b - a)
            return tuple(round(ca[i] + (cb[i] - ca[i]) * k) for i in range(3))
    return stops[-1][1]

def is_skin(h, s, v): return 0.0 <= h <= 0.11 and 0.12 <= s <= 0.62 and v >= 0.5
def is_gold(h, s, v): return 0.08 <= h <= 0.18 and s >= 0.42 and v >= 0.4

def recolor(src, stops, keep_skin=True, gold=None, gamma=1.0, stretch=False):
    """mapa de gradiente pela luminância; pele preservada; dourado: None = preservado, paleta = recolorido nela.
    stretch: estica a luminância da textura (percentis 5-97) para 0..1 antes da paleta (texturas muito claras, ex. dragão branco)"""
    im = Image.open(src).convert("RGBA"); px = im.load()
    lo, hi = 0.0, 1.0
    if stretch:
        ls = sorted((0.299 * r + 0.587 * g + 0.114 * b) / 255 for r, g, b, a in (px[x, y] for y in range(im.height) for x in range(im.width)) if a)
        if ls: lo, hi = ls[int(len(ls) * 0.05)], ls[int(len(ls) * 0.97)]
        if hi - lo < 0.05: lo, hi = 0.0, 1.0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if keep_skin and is_skin(h, s, v): continue
            lum = max(0.0, min(1.0, ((0.299 * r + 0.587 * g + 0.114 * b) / 255 - lo) / (hi - lo)))
            if is_gold(h, s, v):
                if gold is None: continue
                px[x, y] = ramp(gold, lum ** gamma) + (a,); continue
            px[x, y] = ramp(stops, lum ** gamma) + (a,)
    return im

# ------------------------------------------------------------------ chefes
# id: nome, modelo RP de base (entity/*.entity.json), textura de origem, paleta, vida, dano, região, nível mínimo, etc.
BOSSES = {
    "void_dragon":   dict(name="Dragão do Vazio", base="veldanava", tex="etheria_pdrg_veldanava", key="dragon", pal=VOID, hp=24000, dmg=48, spd=0.32,
                          region="end", lv=55, gamma=1.25, stretch=True, fly=True, dragon=True, box=(5.0, 5.0), scale="1.6", fam="void", egg=("#0c0414", "#b054fa"), xp=9000, coins=[2500, 4000], role="dragon"),
    "void_knight":   dict(name="Cavaleiro do Vazio", base="cavaleiro_negro", tex="etheria_cavaleiro_negro", pal=VOID_DARK, gold=None, hp=8000, dmg=30, spd=0.31,
                          region="end", lv=35, box=(0.8, 2.4), scale="1.3", fam="void", egg=("#14081f", "#e2b83a"), xp=3500, coins=[900, 1500], role="melee"),
    "void_queen":    dict(name="Rainha do Vazio", base="obera", tex="etheria_obera", pal=QUEEN, gold=VOID, hp=14000, dmg=36, spd=0.3,
                          region="end", lv=45, box=(0.8, 2.5), scale="1.35", fam="void", egg=("#26062e", "#f06edc"), xp=6000, coins=[1600, 2600], role="caster"),
    "fallen_angel":  dict(name="Anjo Caído", base="feldway_angel", tex="etheria_feldway_angel", pal=FALLEN, gold=CRIMSON, hp=10000, dmg=34, spd=0.3,
                          region="nether", lv=40, fly=True, wings=("geometry.etheria_mobwing_fallen", "textures/entity/etheria_race_fallen"), box=(0.8, 2.4), scale="1.3",
                          fam="angel", fire=True, egg=("#0a0a0c", "#c8102e"), xp=4500, coins=[1200, 2000], role="melee"),
    "angel_guardian": dict(name="Anjo Guardião", base="zalario", tex="etheria_zalario", pal=GOLD, keep_skin=True, hp=6000, dmg=24, spd=0.3,
                          region="overworld", lv=30, fly=True, box=(0.8, 2.4), scale="1.35", fam="angel", egg=("#f6e7b0", "#d4a020"), xp=3000, coins=[800, 1400], role="guardian"),
    "crystal_tide":  dict(name="Guardiã Cristalina das Marés", base="lorde_branco", tex="etheria_lorde_branco", pal=CRYSTAL, gold=CRYSTAL, hp=5000, dmg=22, spd=0.28,
                          region="ocean", lv=28, swim=True, trident=True, box=(0.8, 2.4), scale="1.35", fam="aquatic", egg=("#3a2a8a", "#9ae6ff"), xp=2600, coins=[700, 1200], role="caster"),
}

# ------------------------------------------------------------------ materiais (itens novos) e drops
MATERIALS = {   # id: (nome, cor, ícone de origem, paleta | "feather")
    "pena_celestial": ("Pena Celestial", "§f", "feather", GOLD),
    "pena_sombria": ("Pena Sombria", "§8", "feather", CRIMSON),
    "nucleo_de_luz": ("Núcleo de Luz", "§e", "etheria_celestial_crystal", GOLD),
    "fragmento_do_inferno": ("Fragmento do Inferno", "§c", "etheria_demonite_shard", EMBER),
    "halo_quebrado": ("Halo Quebrado", "§6", "etheria_ring_vigor", GOLD),
    "escama_do_vazio": ("Escama do Vazio", "§5", "etheria_dragon_essence", VOID),
    "diadema_do_vazio": ("Diadema da Rainha do Vazio", "§d", "etheria_amulet_arcane", QUEEN),
    "lagrima_cristalina": ("Lágrima Cristalina", "§b", "etheria_mana_crystal", CRYSTAL),
}
EN = {"void_dragon": "Void Dragon", "void_knight": "Void Knight", "void_queen": "Void Queen", "fallen_angel": "Fallen Angel", "angel_guardian": "Guardian Angel",
      "crystal_tide": "Crystal Tide Guardian", "pena_celestial": "Celestial Feather", "pena_sombria": "Shadow Feather", "nucleo_de_luz": "Light Core",
      "fragmento_do_inferno": "Hell Fragment", "halo_quebrado": "Broken Halo", "escama_do_vazio": "Void Scale", "diadema_do_vazio": "Void Queen's Diadem", "lagrima_cristalina": "Crystal Tear"}
E = lambda i, lo, hi, ch=1.0: (i, lo, hi, ch)
LOOT = {
    "void_dragon": [E("escama_do_vazio", 3, 6), E("void_fragment", 4, 8), E("evolution_core", 1, 1, 0.8), E("void_scepter", 1, 1, 0.12)],
    "void_knight": [E("escama_do_vazio", 1, 3), E("void_fragment", 2, 4), E("void_sword", 1, 1, 0.12)],
    "void_queen": [E("diadema_do_vazio", 1, 1, 0.25), E("escama_do_vazio", 2, 4), E("void_fragment", 3, 6), E("evolution_core", 1, 1, 0.6)],
    "boss_void_lord": [E("escama_do_vazio", 1, 2, 0.6)],
    "fallen_angel": [E("fragmento_do_inferno", 2, 4), E("pena_sombria", 2, 5), E("halo_quebrado", 1, 1, 0.3), E("reaper_scythe", 1, 1, 0.1)],
    "angel_guardian": [E("nucleo_de_luz", 1, 2), E("pena_celestial", 3, 6), E("halo_quebrado", 1, 1, 0.5), E("celestial_blade", 1, 1, 0.12)],
    "crystal_tide": [E("lagrima_cristalina", 2, 4), E("sea_dragons_trident", 1, 1, 0.12), E("minecraft:prismarine_crystals", 3, 8), E("minecraft:heart_of_the_sea", 1, 1, 0.15)],
    # anjos que já existiam: penas e núcleo (o resto continua no script de drops)
    "pico": [E("pena_celestial", 1, 3, 0.8), E("nucleo_de_luz", 1, 1, 0.1)], "garasha": [E("pena_celestial", 1, 3, 0.8), E("nucleo_de_luz", 1, 1, 0.1)],
    "gracia": [E("pena_celestial", 1, 3, 0.8), E("nucleo_de_luz", 1, 1, 0.12)], "zalario": [E("pena_celestial", 2, 4), E("nucleo_de_luz", 1, 1, 0.5), E("halo_quebrado", 1, 1, 0.2)],
    "dino": [E("pena_celestial", 2, 4), E("pena_sombria", 1, 2, 0.5), E("nucleo_de_luz", 1, 1, 0.4)], "feldway_angel": [E("pena_celestial", 3, 6), E("nucleo_de_luz", 1, 2), E("halo_quebrado", 1, 1, 0.35)],
    "cornu": [E("pena_sombria", 1, 3, 0.8), E("fragmento_do_inferno", 1, 1, 0.15)],
}

# ------------------------------------------------------------------ regras de spawn por região
BIOME = {
    "end": {"test": "has_biome_tag", "value": "the_end"},
    "nether": {"test": "has_biome_tag", "value": "nether"},
    "ocean": {"all_of": [{"test": "has_biome_tag", "value": "ocean"}, {"test": "has_biome_tag", "value": "deep"}]},
    "overworld": {"all_of": [{"test": "has_biome_tag", "value": "overworld"}, {"test": "has_biome_tag", "value": "ocean", "operator": "!="}]},
    "highlands": {"all_of": [{"test": "has_biome_tag", "value": "overworld"}, {"any_of": [{"test": "has_biome_tag", "value": "mountains"}, {"test": "has_biome_tag", "value": "extreme_hills"}, {"test": "has_biome_tag", "value": "plains"}]}]},
}
SPAWN_OF = {"void_dragon": ("end", 1), "void_knight": ("end", 2), "void_queen": ("end", 1), "fallen_angel": ("nether", 2), "angel_guardian": ("highlands", 1), "crystal_tide": ("ocean", 2)}
OLD_REGION = {"boss_void_lord": "end", "boss_ember_tyrant": "nether", "boss_goblin_king": "overworld"}
SPIDERS_KEEP = {"taratect", "taratect_queen"}   # 7a: só 2 aranhas nascem sozinhas (a comum e a chefe)

def cond(region, layer, weight, ident):
    c = {"minecraft:weight": {"default": weight}, "minecraft:herd": {"min_size": 1, "max_size": 1},
         "minecraft:distance_filter": {"min": 32, "max": 96},
         "minecraft:delay_filter": {"min": 120, "max": 300, "identifier": ident, "spawn_chance": 25},
         "minecraft:difficulty_filter": {"min": "easy", "max": "hard"}, layer: {},
         "minecraft:density_limit": {"underwater" if layer == "minecraft:spawns_underwater" else ("underground" if layer == "minecraft:spawns_underground" else "surface"): 1},
         "minecraft:biome_filter": BIOME[region]}
    return c

def spawn_rule(ident, region, weight, pop="monster"):
    layers = ["minecraft:spawns_underwater"] if region == "ocean" else ["minecraft:spawns_on_surface", "minecraft:spawns_underground"] if region == "nether" else ["minecraft:spawns_on_surface"]
    return {"format_version": "1.8.0", "minecraft:spawn_rules": {"description": {"identifier": ident, "population_control": pop},
            "conditions": [cond(region, l, weight, ident) for l in layers]}}

# ------------------------------------------------------------------ util
def W(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    txt = json.dumps(obj, ensure_ascii=False, indent=1) if not isinstance(obj, str) else obj
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
    if old is None or old.endswith("\n"): txt += "\n"
    if old != txt: open(path, "w", encoding="utf-8").write(txt); return 1
    return 0

def save_png(path, im):
    os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path)

def feather_icon(stops):
    src = next((p for p in FEATHER_SRC if p and os.path.exists(p)), None)
    if src: return recolor(src, stops, keep_skin=False, gold=stops)
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)   # pena desenhada: haste diagonal + barbas
    for i in range(12):
        x, y = 3 + i, 13 - i; w = 0 if i < 2 else min(3, (12 - i) // 2 + 1)
        d.line([(x - w, y - w), (x + w, y + w)], fill=ramp(stops, 0.45 + 0.04 * i) + (255,))
        d.point((x, y), fill=ramp(stops, 0.95) + (255,))
    return im

# ------------------------------------------------------------------ BP entidade
def bp_entity(bid, b):
    ident = "etheria:" + bid; fams = [b["fam"], "monster", "mob", "etheria_boss", "etheria_region_boss"]
    if b.get("fly"): fams.append("etheria_flyer")
    props = {}
    if b.get("fly"): props["etheria:fly"] = {"type": "int", "range": [0, 4], "default": 0, "client_sync": True}
    if b.get("dragon"):
        props["etheria:form"] = {"type": "enum", "values": ["human", "dragon"], "default": "dragon", "client_sync": True}
        props["etheria:act"] = {"type": "enum", "values": ["none", "bite", "claw", "tail", "roar", "ability", "takeoff", "land", "hurt", "transform", "cast"], "default": "none", "client_sync": True}
    C = {
        "minecraft:type_family": {"family": fams},
        "minecraft:collision_box": {"width": b["box"][0], "height": b["box"][1]},
        "minecraft:health": {"value": b["hp"], "max": b["hp"]},
        "minecraft:movement": {"value": b["spd"]},
        "minecraft:attack": {"damage": b["dmg"]},
        "minecraft:nameable": {}, "minecraft:physics": {}, "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
        "minecraft:loot": {"table": f"loot_tables/entities/etheria_{bid}.json"},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 2, "must_see": False, "reselect_targets": True,
            "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 32}]},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.25, "track_target": True, "reach_multiplier": 1.6 if b.get("dragon") else 1.2},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 12},
        "minecraft:behavior.random_look_around": {"priority": 8},
        "minecraft:despawn": {"despawn_from_distance": {"min_distance": 96, "max_distance": 128}},
        "minecraft:follow_range": {"value": 40, "max": 56},
        "minecraft:knockback_resistance": {"value": 0.95},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}, {"cause": "entity_attack", "damage_multiplier": 0.7}, {"cause": "projectile", "damage_multiplier": 0.7}]},
        "minecraft:boss": {"hud_range": 48, "name": b["name"], "should_darken_sky": False},
    }
    if b.get("fire") or b["region"] in ("end", "nether"): C["minecraft:fire_immune"] = {}
    if b.get("fly"):
        C.update({"minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_pass_doors": True, "can_path_from_air": True, "avoid_water": True, "avoid_damage_blocks": True},
                  "minecraft:movement.hover": {}, "minecraft:flying_speed": {"value": 0.22}, "minecraft:can_fly": {},
                  "minecraft:behavior.random_hover": {"priority": 6, "xz_dist": 10, "y_dist": 5, "y_offset": -1, "interval": 1, "hover_height": [2, 7]}})
    elif b.get("swim"):
        C.update({"minecraft:navigation.generic": {"is_amphibious": True, "can_path_over_water": False, "can_swim": True, "can_walk": True, "can_breach": True},
                  "minecraft:movement.generic": {}, "minecraft:underwater_movement": {"value": 0.14},
                  "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True, "breathes_air": True},
                  "minecraft:behavior.random_swim": {"priority": 6, "speed_multiplier": 1.0, "xz_dist": 12, "y_dist": 6},
                  "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8}, "minecraft:jump.static": {}})
    else:
        C.update({"minecraft:navigation.walk": {"can_path_over_water": True, "can_pass_doors": True, "avoid_water": True},
                  "minecraft:movement.basic": {}, "minecraft:jump.static": {}, "minecraft:can_climb": {},
                  "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8}})
    desc = {"identifier": ident, "is_spawnable": True, "is_summonable": True}
    if props: desc["properties"] = props
    return {"format_version": "1.21.60", "minecraft:entity": {"description": desc, "components": C}}

# ------------------------------------------------------------------ RP entidade (cópia do modelo base com a textura nova)
def rp_entity(bid, b):
    base = json.load(open(os.path.join(RP, "entity", b["base"] + ".entity.json"), encoding="utf-8"))
    ce = copy.deepcopy(base); d = ce["minecraft:client_entity"]["description"]
    d["identifier"] = "etheria:" + bid
    d["textures"][b.get("key", "default")] = "textures/entity/etheria_" + bid
    d["spawn_egg"] = {"base_color": b["egg"][0], "overlay_color": b["egg"][1]}
    d.setdefault("scripts", {})["scale"] = b["scale"]
    if b.get("wings"):
        d["geometry"]["wings"], d["textures"]["wings"] = b["wings"]
    if b.get("trident"):
        d["geometry"]["trident"] = "geometry.etheria_held_trident"; d["textures"]["trident"] = "textures/attachable/w_sea_dragons_trident"
        d["materials"]["trident"] = "entity_alphatest"
        d["render_controllers"] = list(d["render_controllers"]) + ["controller.render.etheria_held_trident"]
    return ce

def held_trident_geo(skin_geo):
    """geometria só com o braço direito do modelo + o tridente na mão (mesmos nomes de osso: a animação do braço move os dois)"""
    sk = json.load(open(os.path.join(RP, "models/entity", skin_geo + ".geo.json")))["minecraft:geometry"][0]
    tr = json.load(open(os.path.join(RP, "models/entity/etheria_w_sea_dragons_trident.geo.json")))["minecraft:geometry"][0]
    bones = {bn["name"]: bn for bn in sk["bones"]}; chain = []; n = "rightArm"
    while n: bn = bones[n]; chain.insert(0, {k: v for k, v in bn.items() if k in ("name", "parent", "pivot", "rotation")}); n = bn.get("parent")
    dy, dz = 9.5, -3.2   # empunhadura (~y 2 do tridente) na mão (y 11,5), um pouco à frente do punho
    cubes = []
    for bn in tr["bones"]:
        for c in bn.get("cubes", []):
            c = copy.deepcopy(c); c["origin"] = [round(c["origin"][0] + 0.2, 3), round(c["origin"][1] + dy, 3), round(c["origin"][2] + dz, 3)]
            if "pivot" in c: c["pivot"] = [c["pivot"][0] + 0.2, c["pivot"][1] + dy, c["pivot"][2] + dz]
            cubes.append(c)
    chain.append({"name": "held_trident", "parent": "rightArm", "pivot": [-6, 11.5, dz], "cubes": cubes})
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": "geometry.etheria_held_trident", "texture_width": tr["description"]["texture_width"],
            "texture_height": tr["description"]["texture_height"], "visible_bounds_width": 6, "visible_bounds_height": 6, "visible_bounds_offset": [0, 1.5, 0]}, "bones": chain}]}

def loot_table(entries):
    pools = []
    for i, lo, hi, ch in entries:
        full = i if ":" in i else "etheria:" + i
        ent = {"type": "item", "name": full, "weight": 1, "functions": [{"function": "set_count", "count": {"min": lo, "max": hi}}]}
        pool = {"rolls": 1, "entries": [ent]}
        if ch < 1: pool["conditions"] = [{"condition": "random_chance_with_looting", "chance": ch, "looting_multiplier": 0.02}]
        pools.append(pool)
    return {"pools": pools}

# ------------------------------------------------------------------ MOBS (scripts/data/mobs.gen.js): entradas dos chefes novos
def update_mobs():
    p = os.path.join(BP, "scripts/data/mobs.gen.js"); src = open(p, encoding="utf-8").read()
    i0 = src.index("{"); i1 = src.index("};") + 1; M = json.loads(src[i0:i1])
    for bid, b in BOSSES.items():
        M["etheria:" + bid] = {"name": b["name"], "xp": b["xp"], "coins": b["coins"], "hp": b["hp"], "role": b["role"], "rar": "boss", "dmg": b["dmg"],
                               "drops": [], "region": b["region"], "minLv": b["lv"]}
    txt = src[:i0] + json.dumps(M, ensure_ascii=False, indent=1) + src[i1:]
    if txt != src: open(p, "w", encoding="utf-8").write(txt); return 1
    return 0

def lang_set(path, pairs):
    lines = open(path, encoding="utf-8").read().split("\n") if os.path.exists(path) else []
    keys = {k for k, _ in pairs}; out = [l for l in lines if l.split("=", 1)[0] not in keys]
    while out and out[-1] == "": out.pop()
    out += [f"{k}={v}" for k, v in pairs]; txt = "\n".join(out) + "\n"
    if txt != "\n".join(lines): open(path, "w", encoding="utf-8").write(txt)

def main():
    n = 0
    # texturas dos chefes
    for bid, b in BOSSES.items():
        im = recolor(os.path.join(RP, "textures/entity", b["tex"] + ".png"), b["pal"], keep_skin=b.get("keep_skin", True), gold=b.get("gold", b["pal"]), gamma=b.get("gamma", 1.0), stretch=b.get("stretch", False))
        save_png(os.path.join(RP, "textures/entity", f"etheria_{bid}.png"), im)
        n += W(os.path.join(BP, "entities", bid + ".json"), bp_entity(bid, b))
        n += W(os.path.join(RP, "entity", bid + ".entity.json"), rp_entity(bid, b))
        reg, wgt = SPAWN_OF[bid]
        n += W(os.path.join(BP, "spawn_rules", bid + ".json"), spawn_rule("etheria:" + bid, reg, wgt, "water_animal" if reg == "ocean" else "monster"))
    n += W(os.path.join(RP, "models/entity/etheria_held_trident.geo.json"), held_trident_geo("etheria_lorde_branco_skin"))
    n += W(os.path.join(RP, "render_controllers/etheria_held_trident.render_controllers.json"), {"format_version": "1.8.0", "render_controllers": {
        "controller.render.etheria_held_trident": {"geometry": "Geometry.trident", "materials": [{"*": "Material.trident"}], "textures": ["Texture.trident"]}}})
    # chefes antigos: só na região deles
    for bid, reg in OLD_REGION.items():
        f = os.path.join(BP, "spawn_rules", bid + ".json"); j = json.load(open(f, encoding="utf-8"))
        for c in j["minecraft:spawn_rules"]["conditions"]: c["minecraft:biome_filter"] = BIOME[reg]
        n += W(f, j)
    # aranhas: só 2 no spawn natural
    for f in glob.glob(os.path.join(BP, "spawn_rules", "*.json")):
        k = os.path.basename(f)[:-5]
        if (k.startswith("taratect") or k in ("tt_black_spider", "tt_knight_spider")) and k not in SPIDERS_KEEP: os.remove(f); n += 1
    # loot tables (chefes novos + anjos que já existiam)
    for bid, ent in LOOT.items():
        n += W(os.path.join(BP, "loot_tables/entities", f"etheria_{bid}.json"), loot_table(ent))
        f = os.path.join(BP, "entities", bid + ".json"); j = json.load(open(f, encoding="utf-8"))
        j["minecraft:entity"]["components"]["minecraft:loot"] = {"table": f"loot_tables/entities/etheria_{bid}.json"}; n += W(f, j)
    # materiais
    it = json.load(open(os.path.join(RP, "textures/item_texture.json"), encoding="utf-8")); pt = []
    for mid, (nm, col, src, pal) in MATERIALS.items():
        icon = feather_icon(pal) if src == "feather" else recolor(os.path.join(RP, "textures/items", src + ".png"), pal, keep_skin=False, gold=pal)
        if mid == "halo_quebrado":   # anel partido: abre uma fenda na diagonal
            d = ImageDraw.Draw(icon); w = icon.width; d.line([(w * 0.55, 0), (w * 0.8, w * 0.45)], fill=(0, 0, 0, 0), width=max(1, w // 10))
        save_png(os.path.join(RP, "textures/items", f"etheria_{mid}.png"), icon)
        it["texture_data"][f"etheria_{mid}"] = {"textures": f"textures/items/etheria_{mid}"}
        n += W(os.path.join(BP, "items", f"08700_{mid}.json"), {"format_version": "1.21.60", "minecraft:item": {
            "description": {"identifier": f"etheria:{mid}", "menu_category": {"category": "items"}},
            "components": {"minecraft:icon": {"textures": {"default": f"etheria_{mid}"}}, "minecraft:display_name": {"value": f"{col}{nm}"}, "minecraft:max_stack_size": 64}}})
        pt.append((f"item.etheria:{mid}", nm))
    en = [(k, EN.get(k.split(":")[1].split(".")[0], v)) for k, v in pt]
    for bid, b in BOSSES.items():
        pt += [(f"entity.etheria:{bid}.name", b["name"]), (f"item.spawn_egg.entity.etheria:{bid}.name", f"Ovo de {b['name']}")]
        en += [(f"entity.etheria:{bid}.name", EN[bid]), (f"item.spawn_egg.entity.etheria:{bid}.name", f"{EN[bid]} Spawn Egg")]
    n += W(os.path.join(RP, "textures/item_texture.json"), it)
    lang_set(os.path.join(RP, "texts", "pt_BR.lang"), pt); lang_set(os.path.join(RP, "texts", "en_US.lang"), en)
    n += update_mobs()
    print(f"chefes por região: {len(BOSSES)} chefes, {len(MATERIALS)} materiais, {len(LOOT)} loot tables | arquivos alterados: {n}")

if __name__ == "__main__":
    main()

"""8.8 (Etapa 7b) - DRAGÕES DOMÁVEIS + armas dos anjos.
Dragões (modelos/animações já refeitos do addon, em escala menor, textura recolorida por mapa de gradiente):
  Dragão Carmim       (etheria:dragon_carmim)     modelo quadrúpede alado do Veldanava/Dragão do Vazio   desertos, savanas, mesas
  Dragão de Gelo      (etheria:dragon_gelo)       dragão-serpente da Velzard                            biomas gelados
  Dragão da Tempestade(etheria:dragon_tempestade) dragão-serpente da Velgrynd                           montanhas
Domar: alimentar com Carne Dracônica (Carmim/Tempestade) ou Peixe Glacial (Gelo/Tempestade). Domado: segue o dono, ataca quem o dono
atacar / quem atacar o dono e monstros por perto, cura com a mesma comida e vira MONTARIA (interagir); voo da montaria em systems/tamedragons.js.
Armas dos anjos (itens + attachables reaproveitando modelos/animações existentes, textura recolorida): Lança do Arcanjo (alabarda de Caedros),
Foice Sombria (Foice Ceifadora). Receitas com os materiais da Etapa 7a.
Idempotente. Uso: python3 tools/tame_dragons.py [--preview saida.png]"""
import copy, json, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from region_bosses import recolor, ramp, W, lang_set, save_png, GOLD, SHADOW, CRIMSON

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "LegacyOfEtheria_BP"); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
ICE = [(0, (12, 30, 58)), (0.35, (52, 120, 178)), (0.7, (150, 214, 244)), (1, (246, 254, 255))]
STORM = [(0, (8, 10, 26)), (0.35, (34, 52, 104)), (0.65, (60, 140, 196)), (0.88, (160, 228, 255)), (1, (255, 248, 160))]
STORM_GOLD = [(0, (60, 50, 10)), (0.5, (200, 180, 40)), (1, (255, 252, 190))]
FIRE_GOLD = [(0, (50, 14, 0)), (0.5, (220, 110, 20)), (1, (255, 226, 120))]

FOOD = {"carne_draconica": ("Carne Dracônica", "Draconic Meat", "§c"), "peixe_glacial": ("Peixe Glacial", "Glacial Fish", "§b")}
DRAGONS = {
    "dragon_carmim": {"name": "Dragão Carmim", "en": "Crimson Dragon", "base": "void_dragon", "src": "etheria_pdrg_veldanava", "pal": CRIMSON, "gold": FIRE_GOLD,
                      "scale": 0.26, "gamma": 1.7, "box": [1.6, 1.8], "hp": 90, "thp": 160, "dmg": 9, "spd": 0.27, "seat": [0, 1.25, 0.25], "fire": True,
                      "food": ["carne_draconica"], "egg": ["#5a0a0e", "#f0a040"], "effect": None,
                      "biome": {"any_of": [{"test": "has_biome_tag", "value": "mesa"}, {"test": "has_biome_tag", "value": "savanna"}, {"test": "has_biome_tag", "value": "desert"}]},
                      "loot": [("etheria:dragon_essence", 1, 2, 0.6), ("minecraft:blaze_powder", 1, 3, 0.7), ("minecraft:leather", 1, 3, 1)]},
    "dragon_gelo": {"name": "Dragão de Gelo", "en": "Frost Dragon", "base": "velzard", "src": "etheria_pdrg_velzard", "pal": ICE, "gold": ICE,
                    "scale": 0.2, "box": [1.4, 1.5], "hp": 80, "thp": 150, "dmg": 8, "spd": 0.28, "seat": [0, 1.05, 0.0], "fire": False,
                    "food": ["peixe_glacial"], "egg": ["#cfefff", "#3a7ab8"], "effect": ["slowness", 3],
                    "biome": {"any_of": [{"test": "has_biome_tag", "value": "frozen"}, {"test": "has_biome_tag", "value": "ice"}]},
                    "loot": [("etheria:dragon_essence", 1, 2, 0.6), ("minecraft:packed_ice", 1, 4, 0.7), ("minecraft:leather", 1, 3, 1)]},
    "dragon_tempestade": {"name": "Dragão da Tempestade", "en": "Storm Dragon", "base": "velgrynd", "src": "etheria_pdrg_velgrynd", "pal": STORM, "gold": STORM_GOLD,
                          "scale": 0.21, "box": [1.4, 1.5], "hp": 85, "thp": 155, "dmg": 9, "spd": 0.3, "seat": [0, 1.1, 0.0], "fire": False,
                          "food": ["carne_draconica", "peixe_glacial"], "egg": ["#1c2a52", "#ffe860"], "effect": ["weakness", 3],
                          "biome": {"any_of": [{"test": "has_biome_tag", "value": "mountains"}, {"test": "has_biome_tag", "value": "extreme_hills"}]},
                          "loot": [("etheria:dragon_essence", 1, 2, 0.6), ("minecraft:feather", 2, 5, 0.8), ("minecraft:leather", 1, 3, 1)]},
}
# armas dos anjos: id -> (nome, en, base (attachable/ícone), paleta, estatísticas para items.gen.js, receita, visual weaponfx)
WEAPONS = {
    "archangel_lance": ("Lança do Arcanjo", "Archangel's Lance", "caedros_ashen_halberd", GOLD,
                        {"rarity": "legendary", "wtype": "spear", "stats": {"atk": 25, "strength": 12, "intelligence": 10, "crit": 6, "light": 16},
                         "onHit": {"kind": "heal", "amount": 3, "chance": 0.2, "name": "Luz do Arcanjo"}, "price": 16000, "sell": 4000},
                        (["HPN", " DP", "D  "], {"H": "etheria:halo_quebrado", "P": "etheria:pena_celestial", "N": "etheria:nucleo_de_luz", "D": "minecraft:diamond"}),
                        ["holy", "gold", "star", "light", "holy", "light"]),
    "shadow_scythe": ("Foice Sombria", "Shadow Scythe", "reaper_scythe", SHADOW,
                      {"rarity": "legendary", "wtype": "scythe", "stats": {"atk": 26, "strength": 16, "intelligence": 6, "lifesteal": 8},
                       "onHit": {"kind": "bleed", "sec": 6, "chance": 0.3, "name": "Ceifa Sombria"}, "price": 16000, "sell": 4000},
                      (["SFF", " B ", " N "], {"S": "etheria:fragmento_do_inferno", "F": "etheria:pena_sombria", "B": "minecraft:blaze_rod", "N": "minecraft:netherite_scrap"}),
                      ["blood", "black", "skull", "reap", "shadow", "shadow"]),
}

def bp_dragon(did, d):
    ident = "etheria:" + did
    atk = {"damage": d["dmg"]}
    if d["effect"]: atk.update({"effect_name": d["effect"][0], "effect_duration": d["effect"][1]})
    C = {
        "minecraft:type_family": {"family": ["etheria_tame_dragon", "dragon", "mob", "etheria_flyer"]},
        "minecraft:collision_box": {"width": d["box"][0], "height": d["box"][1]},
        "minecraft:health": {"value": d["hp"], "max": d["hp"]},
        "minecraft:movement": {"value": d["spd"]}, "minecraft:attack": atk,
        "minecraft:nameable": {}, "minecraft:physics": {}, "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:jump.static": {}, "minecraft:movement.basic": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "can_pass_doors": True},
        "minecraft:loot": {"table": f"loot_tables/entities/etheria_{did}.json"},
        "minecraft:knockback_resistance": {"value": 0.6}, "minecraft:follow_range": {"value": 24, "max": 32},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": False, "breathes_air": True},
        "minecraft:tameable": {"probability": 0.34, "tame_items": ["etheria:" + f for f in d["food"]], "tame_event": {"event": "etheria:tamed", "target": "self"}},
        "minecraft:leashable": {"soft_distance": 4, "hard_distance": 6, "max_distance": 10},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True, "reach_multiplier": 1.4},
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8},
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 10},
        "minecraft:behavior.random_look_around": {"priority": 9},
    }
    if d["fire"]: C["minecraft:fire_immune"] = {}
    G = {
        "etheria:wild": {"minecraft:despawn": {"despawn_from_distance": {"min_distance": 64, "max_distance": 128}}},
        "etheria:tamed": {
            "minecraft:is_tamed": {},
            "minecraft:health": {"value": d["thp"], "max": d["thp"]},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:behavior.nearest_attackable_target": {"priority": 4, "must_see": True, "reselect_targets": True,
                "entity_types": [{"filters": {"all_of": [{"test": "is_family", "subject": "other", "value": "monster"}, {"test": "is_family", "subject": "other", "value": "etheria_boss", "operator": "!="}]}, "max_dist": 14}]},
            "minecraft:behavior.follow_owner": {"priority": 5, "speed_multiplier": 1.3, "start_distance": 10, "stop_distance": 3, "can_teleport": True},
            "minecraft:healable": {"items": [{"item": "etheria:" + f, "heal_amount": 30} for f in d["food"]]},
            "minecraft:rideable": {"seat_count": 1, "family_types": ["player"], "interact_text": "action.interact.ride.horse", "crouching_skip_interact": True,
                                   "seats": [{"position": d["seat"], "min_rider_count": 0, "max_rider_count": 1}]},
            "minecraft:input_ground_controlled": {},
        },
    }
    E = {"minecraft:entity_spawned": {"add": {"component_groups": ["etheria:wild"]}},
         "etheria:tamed": {"remove": {"component_groups": ["etheria:wild"]}, "add": {"component_groups": ["etheria:tamed"]}}}
    props = {"etheria:fly": {"type": "int", "range": [0, 4], "default": 0, "client_sync": True},
             "etheria:form": {"type": "enum", "values": ["human", "dragon"], "default": "dragon", "client_sync": True},
             "etheria:act": {"type": "enum", "values": ["none", "bite", "claw", "tail", "roar", "ability", "takeoff", "land", "hurt", "transform", "cast"], "default": "none", "client_sync": True}}
    return {"format_version": "1.21.60", "minecraft:entity": {"description": {"identifier": ident, "is_spawnable": True, "is_summonable": True, "properties": props},
            "component_groups": G, "components": C, "events": E}}

def rp_dragon(did, d):
    base = json.load(open(os.path.join(RP, "entity", d["base"] + ".entity.json"), encoding="utf-8"))
    ce = copy.deepcopy(base); x = ce["minecraft:client_entity"]["description"]
    x["identifier"] = "etheria:" + did
    x["textures"]["dragon"] = "textures/entity/etheria_" + did
    x["spawn_egg"] = {"base_color": d["egg"][0], "overlay_color": d["egg"][1]}
    x.setdefault("scripts", {})["scale"] = str(d["scale"])
    return ce

def spawn_rule(did, d):
    ident = "etheria:" + did
    return {"format_version": "1.8.0", "minecraft:spawn_rules": {"description": {"identifier": ident, "population_control": "animal"}, "conditions": [{
        "minecraft:spawns_on_surface": {}, "minecraft:brightness_filter": {"min": 7, "max": 15, "adjust_for_weather": False},
        "minecraft:weight": {"default": 2}, "minecraft:herd": {"min_size": 1, "max_size": 1},
        "minecraft:density_limit": {"surface": 1}, "minecraft:distance_filter": {"min": 32, "max": 96},
        "minecraft:delay_filter": {"min": 300, "max": 600, "identifier": ident, "spawn_chance": 20},
        "minecraft:biome_filter": {"all_of": [{"test": "has_biome_tag", "value": "overworld"}, d["biome"]]}}]}}

def loot(entries):
    pools = []
    for i, lo, hi, ch in entries:
        p = {"rolls": 1, "entries": [{"type": "item", "name": i, "weight": 1, "functions": [{"function": "set_count", "count": {"min": lo, "max": hi}}]}]}
        if ch < 1: p["conditions"] = [{"condition": "random_chance_with_looting", "chance": ch, "looting_multiplier": 0.05}]
        pools.append(p)
    return {"pools": pools}

def food_icon(kind):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    if kind == "carne_draconica":   # bife com osso e brasas
        dr.ellipse([2, 3, 13, 13], fill=(140, 26, 20, 255), outline=(70, 10, 8, 255)); dr.ellipse([4, 5, 10, 10], fill=(200, 60, 36, 255))
        dr.line([(11, 4), (14, 1)], fill=(236, 226, 200, 255), width=2); dr.point([(6, 7), (8, 9), (9, 6)], fill=(255, 200, 60, 255))
    else:                           # peixe azul-gelo com cristais
        dr.polygon([(1, 8), (6, 4), (11, 5), (13, 8), (11, 11), (6, 12)], fill=(120, 196, 236, 255), outline=(30, 80, 130, 255))
        dr.polygon([(12, 8), (15, 5), (15, 11)], fill=(80, 150, 210, 255)); dr.point([(4, 7)], fill=(10, 20, 40, 255))
        dr.point([(7, 7), (8, 9), (9, 6)], fill=(240, 252, 255, 255))
    return im

def patch_items_gen():
    p = os.path.join(BP, "scripts/data/items.gen.js"); s = open(p, encoding="utf-8").read()
    i0 = s.index("{"); i1 = s.rindex("};") + 1; M = json.loads(s[i0:i1])
    for wid, (nm, en, base, pal, st, rec, fx) in WEAPONS.items():
        e = {"id": "etheria:" + wid, "name": nm, "rarity": st["rarity"], "kind": "weapon", "wtype": st["wtype"], "stats": st["stats"], "onHit": st["onHit"], "price": st["price"], "sell": st["sell"]}
        M["etheria:" + wid] = e
    txt = s[:i0] + json.dumps(M, ensure_ascii=False, indent=1) + s[i1:]
    if txt != s: open(p, "w", encoding="utf-8").write(txt); return 1
    return 0

def patch_weaponfx():
    p = os.path.join(BP, "scripts/systems/weaponfx.js"); s = open(p, encoding="utf-8").read()
    line = "  " + ", ".join(f'{w}: {json.dumps(v[6])}' for w, v in WEAPONS.items()) + ",   // 8.8: armas dos anjos (tools/tame_dragons.py)\n"
    s2 = "\n".join(l for l in s.split("\n") if "8.8: armas dos anjos" not in l)
    s2 = s2.replace("const W = {\n", "const W = {\n" + line, 1)
    if s2 != s: open(p, "w", encoding="utf-8").write(s2); return 1
    return 0

def update_mobs():
    p = os.path.join(BP, "scripts/data/mobs.gen.js"); src = open(p, encoding="utf-8").read()
    i0 = src.index("{"); i1 = src.index("};") + 1; M = json.loads(src[i0:i1])
    for did, d in DRAGONS.items():
        M["etheria:" + did] = {"name": d["name"], "xp": 140, "coins": [10, 24], "hp": d["hp"], "role": "dragon", "rar": "rare", "dmg": d["dmg"], "drops": [], "region": "overworld", "minLv": 8}
    txt = src[:i0] + json.dumps(M, ensure_ascii=False, indent=1) + src[i1:]
    if txt != src: open(p, "w", encoding="utf-8").write(txt); return 1
    return 0

def main():
    n = 0; pt, en = [], []
    it = json.load(open(os.path.join(RP, "textures/item_texture.json"), encoding="utf-8"))
    for did, d in DRAGONS.items():
        im = recolor(os.path.join(RP, "textures/entity", d["src"] + ".png"), d["pal"], keep_skin=False, gold=d["gold"], stretch=True, gamma=d.get("gamma", 1.0))
        save_png(os.path.join(RP, "textures/entity", f"etheria_{did}.png"), im)
        n += W(os.path.join(BP, "entities", did + ".json"), bp_dragon(did, d))
        n += W(os.path.join(RP, "entity", did + ".entity.json"), rp_dragon(did, d))
        n += W(os.path.join(BP, "spawn_rules", did + ".json"), spawn_rule(did, d))
        n += W(os.path.join(BP, "loot_tables/entities", f"etheria_{did}.json"), loot(d["loot"]))
        pt += [(f"entity.etheria:{did}.name", d["name"]), (f"item.spawn_egg.entity.etheria:{did}.name", f"Ovo de {d['name']}")]
        en += [(f"entity.etheria:{did}.name", d["en"]), (f"item.spawn_egg.entity.etheria:{did}.name", f"{d['en']} Spawn Egg")]
    for fid, (nm, enm, col) in FOOD.items():
        save_png(os.path.join(RP, "textures/items", f"etheria_{fid}.png"), food_icon(fid))
        it["texture_data"][f"etheria_{fid}"] = {"textures": f"textures/items/etheria_{fid}"}
        n += W(os.path.join(BP, "items", f"08800_{fid}.json"), {"format_version": "1.21.60", "minecraft:item": {
            "description": {"identifier": f"etheria:{fid}", "menu_category": {"category": "items"}},
            "components": {"minecraft:icon": {"textures": {"default": f"etheria_{fid}"}}, "minecraft:display_name": {"value": f"{col}{nm}"}, "minecraft:max_stack_size": 16}}})
        pt.append((f"item.etheria:{fid}", nm)); en.append((f"item.etheria:{fid}", enm))
    n += W(os.path.join(BP, "recipes", "carne_draconica.json"), {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
        "description": {"identifier": "etheria:carne_draconica_recipe"}, "tags": ["crafting_table"],
        "ingredients": [{"item": "minecraft:cooked_beef"}, {"item": "minecraft:blaze_powder"}], "unlock": [{"item": "minecraft:blaze_powder"}], "result": {"item": "etheria:carne_draconica", "count": 2}}})
    n += W(os.path.join(BP, "recipes", "peixe_glacial.json"), {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
        "description": {"identifier": "etheria:peixe_glacial_recipe"}, "tags": ["crafting_table"],
        "ingredients": [{"item": "minecraft:cooked_cod"}, {"item": "minecraft:packed_ice"}], "unlock": [{"item": "minecraft:packed_ice"}], "result": {"item": "etheria:peixe_glacial", "count": 2}}})
    # armas dos anjos
    for wid, (nm, enm, base, pal, st, (pat, key), fx) in WEAPONS.items():
        a = json.load(open(os.path.join(RP, "attachables", f"w_{base}.attachable.json"), encoding="utf-8"))
        a["minecraft:attachable"]["description"]["identifier"] = "etheria:" + wid
        a["minecraft:attachable"]["description"]["textures"]["default"] = f"textures/attachable/w_{wid}"
        n += W(os.path.join(RP, "attachables", f"w_{wid}.attachable.json"), a)
        src = os.path.join(RP, "textures/attachable", f"w_{base}.png")
        if os.path.exists(src): save_png(os.path.join(RP, "textures/attachable", f"w_{wid}.png"), recolor(src, pal, keep_skin=False, gold=pal))
        else: print(f"AVISO: {src} ausente (textura derivada de mod, fora do git); regerar com tools/mod_weapons.py antes")
        save_png(os.path.join(RP, "textures/items", f"etheria_{wid}.png"), recolor(os.path.join(RP, "textures/items", f"etheria_{base}.png"), pal, keep_skin=False, gold=pal))
        it["texture_data"][f"etheria_{wid}"] = {"textures": f"textures/items/etheria_{wid}"}
        n += W(os.path.join(BP, "items", f"08800_{wid}.json"), {"format_version": "1.21.60", "minecraft:item": {
            "description": {"identifier": f"etheria:{wid}", "menu_category": {"category": "equipment"}},
            "components": {"minecraft:icon": {"textures": {"default": f"etheria_{wid}"}}, "minecraft:display_name": {"value": f"§6{nm}"},
                           "minecraft:max_stack_size": 1, "minecraft:hand_equipped": True, "minecraft:glint": True}}})
        n += W(os.path.join(BP, "recipes", f"{wid}.json"), {"format_version": "1.20.10", "minecraft:recipe_shaped": {
            "description": {"identifier": f"etheria:{wid}_recipe"}, "tags": ["crafting_table"], "pattern": pat,
            "key": {k: {"item": v} for k, v in key.items()}, "unlock": [{"item": next(iter(key.values()))}], "result": {"item": f"etheria:{wid}", "count": 1}}})
        pt.append((f"item.etheria:{wid}", nm)); en.append((f"item.etheria:{wid}", enm))
    n += W(os.path.join(RP, "textures/item_texture.json"), it)
    lang_set(os.path.join(RP, "texts", "pt_BR.lang"), pt); lang_set(os.path.join(RP, "texts", "en_US.lang"), en)
    n += patch_items_gen() + patch_weaponfx() + update_mobs()
    data = {"etheria:" + k: {"name": d["name"], "food": ["etheria:" + f for f in d["food"]], "fire": d["fire"]} for k, d in DRAGONS.items()}
    js = ("// GERADO por tools/tame_dragons.py (8.8, Etapa 7b): dragões domáveis (montaria com voo em systems/tamedragons.js).\n"
          f"export const TAME_DRAGONS = {json.dumps(data, ensure_ascii=False)};\n")
    p = os.path.join(BP, "scripts/data/tamedragons.gen.js"); old = open(p, encoding="utf-8").read() if os.path.exists(p) else None
    if old != js: open(p, "w", encoding="utf-8").write(js); n += 1
    print(f"dragões domáveis: {len(DRAGONS)} | comidas: {len(FOOD)} | armas: {len(WEAPONS)} | arquivos alterados: {n}")

def preview(out):
    from render_entity import render
    from PIL import ImageFont
    try: fnt = ImageFont.truetype("DejaVuSans.ttf", 13)
    except Exception: fnt = None
    rows = [("dragon_carmim", "void_dragon"), ("dragon_gelo", "velzard"), ("dragon_tempestade", "velgrynd")]
    sheet = Image.new("RGBA", (3 * 300, 2 * 290 + 110), (64, 68, 78, 255)); dr = ImageDraw.Draw(sheet)
    for i, (did, base) in enumerate(rows):
        for j, view in enumerate([(200, 12, 0), (150, 25, 0)]):
            im = render(did, size=270, view=view); sheet.alpha_composite(im, (i * 300 + 15, 10 + j * 290))
        d = DRAGONS[did]
        dr.text((i * 300 + 15, 590), d["name"], fill=(255, 255, 255), font=fnt)
        dr.text((i * 300 + 15, 608), f"modelo: {base} · escala {d['scale']}", fill=(200, 200, 200), font=fnt)
        dr.text((i * 300 + 15, 626), f"domar: {', '.join(FOOD[f][0] for f in d['food'])}", fill=(255, 210, 120), font=fnt)
        dr.text((i * 300 + 15, 644), f"vida {d['hp']} (domado {d['thp']}) · dano {d['dmg']}", fill=(200, 200, 200), font=fnt)
    x0 = 0
    for wid, (nm, *_r) in WEAPONS.items():
        ic = Image.open(os.path.join(RP, "textures/items", f"etheria_{wid}.png")).convert("RGBA").resize((32, 32), Image.NEAREST)
        sheet.alpha_composite(ic, (600 + x0, 662)); dr.text((636 + x0, 670), nm, fill=(255, 220, 120), font=fnt); x0 += 150
    for k, fid in enumerate(FOOD):
        ic = Image.open(os.path.join(RP, "textures/items", f"etheria_{fid}.png")).convert("RGBA").resize((32, 32), Image.NEAREST)
        sheet.alpha_composite(ic, (15 + k * 150, 662)); dr.text((51 + k * 150, 670), FOOD[fid][0], fill=(255, 220, 120), font=fnt)
    sheet.save(out); print("prévia:", out)

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--preview": preview(sys.argv[2])
    else: main()

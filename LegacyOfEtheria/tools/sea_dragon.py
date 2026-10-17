"""6.94 - Dragão Marinho (etheria:sea_dragon): leviatã que mora no oceano (bem mais fraco que os Dragões Verdadeiros).
Modelo como a referência: cabeça larga com coroa de espinhos e babados, mandíbula com dentes, olhos brilhando,
corpo longo segmentado com cristas, nadadeiras peitorais grandes com raios, nadadeiras traseiras e cauda em leque.
Animação: nado (onda que corre até a cauda + nadadeiras remando), parado na água, mordida.
Gera RP (geo, textura, animação, client entity) e BP (entidade, spawn no oceano, registro em MOBS, idioma)."""
import json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dragon_real as dr
from dragon_real import rod, box, seg, taper, _v, _nrm, _cross, _sub, Geo
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP, BP = os.path.join(ROOT, "LegacyOfEtheria_RP"), os.path.join(ROOT, "LegacyOfEtheria_BP")
ID = "etheria:sea_dragon"; NAME = "Dragão Marinho"

CFG = dict(s=1.0, tiles=dict(
    back=("scales", (58, 116, 134), (34, 80, 98)), side=("scales", (84, 156, 170), (52, 116, 132)), belly=("plates", (176, 206, 196), (130, 166, 160)),
    wing=("membrane", (62, 150, 170), (26, 82, 112), (18, 50, 70)), wbone=("solid", (22, 40, 52), (0, 0, 0)), horn=("metal", (200, 210, 200), (240, 246, 236)),
    claw=("solid", (16, 26, 34), (0, 0, 0)), eye=("eye", (20, 40, 46), (170, 255, 120)), glow=("solid", (150, 255, 210), (0, 0, 0)),
    acc1=("membrane", (80, 190, 200), (34, 110, 140), (20, 70, 96)), acc2=("solid", (90, 200, 210), (0, 0, 0)), mane=("membrane", (40, 96, 110), (22, 60, 74), (14, 40, 50)),
    teeth=("solid", (238, 240, 226), (0, 0, 0)), mouth=("solid", (70, 16, 26), (0, 0, 0)), acc3=("solid", (120, 220, 230), (0, 0, 0)), spike=("metal", (24, 46, 58), (60, 104, 120))))

def body_path():
    """corpo na horizontal (frente = -z), leve S; peito na origem do tronco"""
    pts = []
    for i in range(15):
        z = -8 + i * 10.5
        pts.append((math.sin(i * 0.45) * 3.0 * min(1, i / 4), 18 + math.sin(i * 0.35 + 0.6) * 2.5 - i * 0.35, z))
    return pts

def _scale_cube(c, o, k):
    c = json.loads(json.dumps(c))
    c["origin"] = [round(o[i] + (c["origin"][i] - o[i]) * k, 3) for i in range(3)]; c["size"] = [round(v * k, 3) for v in c["size"]]
    if "pivot" in c: c["pivot"] = [round(o[i] + (c["pivot"][i] - o[i]) * k, 3) for i in range(3)]
    return c

def build():
    g = Geo(); g.bone("sd_root", None, (0, 0, 0))
    P = body_path(); M = len(P) - 1
    up = (0, 1, 0)
    def wid(i): return max(4.0, 17 - i * 0.95)
    names = ["sd_body"] + [f"sd_t{i}" for i in range(1, M)]
    for i, nm in enumerate(names):
        a, b = P[i], P[i + 1]; t = _nrm(_sub(b, a)); w = wid(i); lat = _cross(up, t)
        mid = tuple((a[k] + b[k]) / 2 for k in range(3))
        cs = [seg(a, _v(b, t, 1.2), w * 1.15, w * 0.9, up)]
        cs.append(seg(_v(a, up, -w * 0.38), _v(_v(b, t, 1.0), up, -w * 0.38), w * 0.8, w * 0.22, up, tile="belly", top="belly", bottom="belly"))   # placas da barriga
        if i % 1 == 0:   # crista dorsal: espinho + membrana
            hs = max(3, 9 - i * 0.45)
            base = _v(mid, up, w * 0.4)
            cs.append(rod(base, _v(_v(base, up, hs), t, hs * 0.9), 1.4, 1.4, "spike"))
            cs.append(rod(_v(base, t, -2), _v(_v(base, up, hs * 0.7), t, hs * 0.5), 0.6, hs * 0.55, "acc1"))
        if i % 2 == 1 and i < M - 2:   # espinhos laterais / escamas eriçadas
            for sg in (1, -1):
                q = _v(_v(mid, lat, sg * w * 0.55), up, w * 0.1)
                cs.append(rod(q, _v(_v(q, lat, sg * w * 0.35), t, w * 0.45), 1.6, 1.0, "spike"))
        if i == M - 1:   # cauda em leque (dois lobos + raios)
            for sg in (1, -1):
                for k in range(4):
                    ang = math.radians(18 + k * 16)
                    d = _nrm(_v(_v(t, lat, sg * math.sin(ang) * 1.4), up, 0.15 * (k - 1.5)))
                    cs.append(seg(b, _v(b, d, 30 - k * 3.5), 9 - k * 1.2, 0.5, (0, 1, 0), tile="acc1", top="acc1", bottom="acc1"))
                    cs.append(rod(b, _v(b, d, 31 - k * 3.5), 1.0, 1.0, "spike"))
        g.bone(nm, "sd_root" if i == 0 else names[i - 1], a, cs)
    # pescoço curto e cabeça larga
    nk0 = P[0]; nk1 = (0, 21, -20)
    g.bone("sd_neck", "sd_body", nk0, [seg(nk0, nk1, 18, 15, up)] + [rod(_v(nk0, up, 6), _v(_v(nk0, up, 13), (0, 0, 1), 6), 1.6, 1.6, "spike")])
    h = nk1
    head = [box((0, h[1] + 1, h[2] - 9), (22, 13, 18), "side", top="back", bottom="belly"),               # crânio largo
            box((0, h[1] - 1, h[2] - 22), (16, 9, 12), "side", top="back", bottom="belly"),               # focinho
            box((0, h[1] + 7.5, h[2] - 10), (16, 2.5, 16), "back")]
    head += [box((sg * 11.3, h[1] + 3.5, h[2] - 12), (1.0, 3.2, 5.5), "eye") for sg in (1, -1)]
    head += [box((sg * 11.2, h[1] + 5.6, h[2] - 12), (2.4, 1.2, 7.5), "back") for sg in (1, -1)]
    head += [box((sg * (7.5 - k * 0.2), h[1] - 4.8, h[2] - 16 - k * 3.4), (1.0, 2.6, 1.0), "teeth") for sg in (1, -1) for k in range(5)]
    for k in range(9):   # coroa de espinhos irradiando para trás
        a = math.radians(-70 + k * 17.5)
        base = (math.sin(a) * 9, h[1] + 6 + math.cos(a) * 3, h[2] - 3)
        tip = (math.sin(a) * 17, h[1] + 6 + math.cos(a) * 12, h[2] + 12 - abs(math.sin(a)) * 4)
        head.append(rod(base, tip, 2.2 - abs(k - 4) * 0.15, 2.2 - abs(k - 4) * 0.15, "spike" if k % 2 else "horn"))
    head.append(rod((0, h[1] + 8, h[2] - 18), (0, h[1] + 16, h[2] - 4), 2.6, 3.2, "horn"))   # chifre central
    for sg in (1, -1):   # babados das bochechas
        for k in range(4):
            base = (sg * 10.5, h[1] - 1 - k * 1.8, h[2] - 6 + k * 2)
            head.append(rod(base, (sg * (19 + k), h[1] - 3 - k * 3, h[2] + 4 + k * 2), 0.7, 3.4 - k * 0.5, "mane"))
    head = [_scale_cube(c, h, 1.45) for c in head]
    g.bone("sd_head", "sd_neck", h, head)
    jaw = [box((0, h[1] - 7, h[2] - 16), (18, 4, 22), "side", top="mouth", bottom="belly")]
    jaw += [box((sg * (7 - k * 0.2), h[1] - 4.6, h[2] - 17 - k * 3.4), (1.0, 2.2, 1.0), "teeth") for sg in (1, -1) for k in range(5)]
    jaw += [rod((sg * 8, h[1] - 8, h[2] - 8), (sg * 13, h[1] - 14, h[2] + 2), 1.2, 1.2, "spike") for sg in (1, -1)]
    jaw = [_scale_cube(c, h, 1.45) for c in jaw]
    g.bone("sd_jaw", "sd_head", (h[0], h[1] - 5 * 1.45, h[2] - 4 * 1.45), jaw)
    # nadadeiras peitorais (grandes, com raios ósseos e membrana) e traseiras
    def fin(name, parent, root, span, drop, back, rays, scale=1.0):
        for side, sg in (("l", 1), ("r", -1)):
            r0 = (sg * root[0], root[1], root[2])
            el = (sg * (root[0] + span * 0.45 * scale), root[1] - drop * 0.4 * scale, root[2] + back * 0.2)
            cs1 = [rod(r0, el, 3.2 * scale, 3.4 * scale, "side", top="back", bottom="belly")]
            g.bone(f"{name}_{side}", parent, r0, cs1)
            cs2 = []
            for k in range(rays):
                f = k / (rays - 1)
                tip = (sg * (root[0] + span * scale * (1.0 - 0.25 * f)), root[1] - drop * scale * (0.6 + 0.5 * f), root[2] + back * scale * (0.2 + 0.9 * f))
                cs2.append(rod(el, tip, 0.9, 0.9, "wbone"))
                cs2.append(rod(tip, _v(tip, (sg * 1.5, -1.5, 3), 1.0), 0.7, 0.7, "claw"))
            tips = [(sg * (root[0] + span * scale * (1.0 - 0.25 * k / (rays - 1))), root[1] - drop * scale * (0.6 + 0.5 * k / (rays - 1)), root[2] + back * scale * (0.2 + 0.9 * k / (rays - 1))) for k in range(rays)]
            for k in range(rays - 1):   # membrana larga entre raios (placa horizontal)
                m = tuple((tips[k][q] + tips[k + 1][q]) / 2 for q in range(3)); gap = math.dist(tips[k], tips[k + 1])
                cs2.append(seg(el, _v(m, _sub(el, m), 0.04), gap * 0.95, 0.35, (0, 1, 0), tile="wing", top="wing", bottom="wing"))
            g.bone(f"{name}2_{side}", f"{name}_{side}", el, cs2)
    fin("sd_fin", "sd_body", (7, 14, 0), 36, 12, 26, 6)
    fin("sd_rfin", "sd_t6", (4.5, 13, 56), 16, 7, 12, 4, 0.8)
    return g

def anims():
    t = "query.anim_time"; mv = "math.min(1, query.modified_move_speed * 4)"; wtr = "(query.is_in_water ? 1 : 0.35)"
    sp = f"(150 + 260 * {mv})"
    B = {"sd_root": {"rotation": [f"math.sin({t} * 60) * 3 * {wtr}", f"math.sin({t} * {sp} * 0.5) * 4", f"math.sin({t} * {sp} * 0.5 + 60) * 3"],
                     "position": [0, f"math.sin({t} * 70) * 1.2", 0]}}
    names = ["sd_body"] + [f"sd_t{i}" for i in range(1, 14)]
    for i, n in enumerate(names):
        u = i / (len(names) - 1)
        B[n] = {"rotation": [f"math.sin({t} * {sp} * 0.6 - {i * 22}) * {1 + 1.5 * u}",
                             f"math.sin({t} * {sp} - {i * 30}) * ({2 + 6 * u * u} + {4 * u} * {mv})", 0]}
    B["sd_neck"] = {"rotation": [f"math.sin({t} * 50) * 3", f"math.sin({t} * {sp} + 30) * -4", 0]}
    B["sd_head"] = {"rotation": [f"math.sin({t} * 50 + 40) * 2", f"math.sin({t} * {sp} + 60) * -3", 0]}
    B["sd_jaw"] = {"rotation": [f"math.max(0, math.sin({t} * 40)) * 12", 0, 0]}
    for side, sg in (("l", 1), ("r", -1)):
        B[f"sd_fin_{side}"] = {"rotation": [f"math.sin({t} * {sp} * 0.8) * (14 + 14 * {mv})", f"{sg} * math.sin({t} * {sp} * 0.8 - 40) * 10", f"{sg} * (math.sin({t} * {sp} * 0.8 + 90) * (16 + 10 * {mv}) - 6)"]}
        B[f"sd_fin2_{side}"] = {"rotation": [f"math.sin({t} * {sp} * 0.8 - 60) * 12", 0, f"{sg} * math.sin({t} * {sp} * 0.8 + 30) * 12"]}
        B[f"sd_rfin_{side}"] = {"rotation": [f"math.sin({t} * {sp} * 0.8 - 120) * 12", 0, f"{sg} * math.sin({t} * {sp} * 0.8 - 30) * 10"]}
        B[f"sd_rfin2_{side}"] = {"rotation": [0, 0, f"{sg} * math.sin({t} * {sp} * 0.8 - 90) * 10"]}
    A = {"animation.etheria.sea_dragon.swim": {"loop": True, "animation_length": 3600, "bones": B},
         "animation.etheria.sea_dragon.bite": {"loop": False, "animation_length": 0.6, "bones": {
             "sd_neck": {"rotation": {"0.0": [0, 0, 0], "0.2": [-14, 0, 0], "0.35": [16, 0, 0], "0.6": [0, 0, 0]}},
             "sd_head": {"rotation": {"0.0": [0, 0, 0], "0.2": [-12, 0, 0], "0.35": [10, 0, 0], "0.6": [0, 0, 0]}},
             "sd_jaw": {"rotation": {"0.0": [0, 0, 0], "0.2": [38, 0, 0], "0.32": [0, 0, 0], "0.6": [0, 0, 0]}}}}}
    return A

def write_rp(g):
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": "geometry.etheria_sea_dragon", "texture_width": 512, "texture_height": 512,
           "visible_bounds_width": 12, "visible_bounds_height": 6, "visible_bounds_offset": [0, 1.5, 0]}, "bones": g.bones}]}
    json.dump(geo, open(os.path.join(RP, "models/entity/etheria_sea_dragon.geo.json"), "w"), indent=1)
    dr.atlas("sea_dragon", CFG).save(os.path.join(RP, "textures/entity/etheria_sea_dragon.png"))
    json.dump({"format_version": "1.8.0", "animations": anims()}, open(os.path.join(RP, "animations/etheria_sea_dragon.animation.json"), "w"), indent=1)
    ce = {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": ID, "materials": {"default": "entity_alphatest"}, "textures": {"default": "textures/entity/etheria_sea_dragon"},
        "geometry": {"default": "geometry.etheria_sea_dragon"}, "spawn_egg": {"base_color": "#245a6a", "overlay_color": "#8ef0c8"},
        "scripts": {"scale": "1.0", "animate": ["swim", {"bite": "variable.attack_time > 0"}]},
        "animations": {"swim": "animation.etheria.sea_dragon.swim", "bite": "animation.etheria.sea_dragon.bite"},
        "render_controllers": ["controller.render.default"]}}}
    json.dump(ce, open(os.path.join(RP, "entity/sea_dragon.entity.json"), "w"), indent=1)
    for lang in ("pt_BR", "en_US"):
        p = os.path.join(RP, "texts", f"{lang}.lang"); s = open(p, encoding="utf-8").read()
        if ID not in s:
            s = s.rstrip("\n") + f"\nentity.{ID}.name={NAME}\nitem.spawn_egg.entity.{ID}.name=Ovo de {NAME}\n"
            open(p, "w", encoding="utf-8").write(s)

def write_bp():
    E = {"format_version": "1.21.60", "minecraft:entity": {"description": {"identifier": ID, "is_spawnable": True, "is_summonable": True},
        "components": {
            "minecraft:type_family": {"family": ["dragonoid", "sea_dragon", "monster", "mob"]},
            "minecraft:collision_box": {"width": 2.2, "height": 1.6},
            "minecraft:health": {"value": 420, "max": 420},
            "minecraft:attack": {"damage": 22},
            "minecraft:movement": {"value": 0.32}, "minecraft:underwater_movement": {"value": 0.34},
            "minecraft:navigation.generic": {"is_amphibious": True, "can_path_over_water": False, "can_swim": True, "can_walk": False, "can_breach": True, "can_sink": False},
            "minecraft:movement.basic": {}, "minecraft:jump.static": {},
            "minecraft:breathable": {"total_supply": 30, "suffocate_time": 0, "breathes_air": True, "breathes_water": True},
            "minecraft:physics": {"has_gravity": False}, "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
            "minecraft:knockback_resistance": {"value": 0.8},
            "minecraft:nameable": {}, "minecraft:loot": {"table": "loot_tables/empty.json"},
            "minecraft:behavior.hurt_by_target": {"priority": 1},
            "minecraft:behavior.nearest_attackable_target": {"priority": 2, "must_see": True, "reselect_targets": True,
                "entity_types": [{"filters": {"all_of": [{"test": "is_family", "subject": "other", "value": "player"}, {"test": "in_water", "subject": "other", "value": True}]}, "max_dist": 24}]},
            "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.4, "track_target": True},
            "minecraft:behavior.swim_wander": {"priority": 5, "interval": 0.1, "look_ahead": 5.0, "speed_multiplier": 1.0, "wander_time": 6.0},
            "minecraft:behavior.random_swim": {"priority": 6, "speed_multiplier": 1.0, "xz_dist": 16, "y_dist": 4, "interval": 40},
            "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 12},
            "minecraft:despawn": {"despawn_from_distance": {}},
            "minecraft:follow_range": {"value": 32, "max": 48}},
        "component_groups": {}, "events": {}}}
    json.dump(E, open(os.path.join(BP, "entities/sea_dragon.json"), "w"), indent=1)
    SR = {"format_version": "1.8.0", "minecraft:spawn_rules": {"description": {"identifier": ID, "population_control": "water_animal"},
          "conditions": [{"minecraft:spawns_underwater": {}, "minecraft:weight": {"default": 3}, "minecraft:herd": {"min_size": 1, "max_size": 1},
                          "minecraft:density_limit": {"underwater": 1}, "minecraft:distance_filter": {"min": 24, "max": 96},
                          "minecraft:biome_filter": {"test": "has_biome_tag", "value": "ocean"},
                          "minecraft:delay_filter": {"min": 30, "max": 90, "identifier": ID, "spawn_chance": 45}}]}}
    json.dump(SR, open(os.path.join(BP, "spawn_rules/sea_dragon.json"), "w"), indent=1)
    p = os.path.join(BP, "scripts/data/mobs.gen.js"); s = open(p).read()
    if f'"{ID}"' not in s:
        entry = {"name": NAME, "xp": 900, "coins": [80, 160], "hp": 420, "role": "frost", "rar": "rare", "dmg": 22,
                 "drops": [["etheria:dragon_essence", 1, 2, 0.55], ["minecraft:prismarine_crystals", 2, 6, 0.8], ["minecraft:heart_of_the_sea", 1, 1, 0.08]]}
        s = s.replace("export const MOBS = {\n", "export const MOBS = {\n " + json.dumps(ID) + ": " + json.dumps(entry, ensure_ascii=False) + ",\n", 1)
        open(p, "w").write(s)
    p = os.path.join(BP, "scripts/systems/mobai.js"); s = open(p).read()
    if "sea_dragon:" not in s:
        s = s.replace("const BY_ID = { ", 'const BY_ID = { sea_dragon: ["tide", "water_blade", "roar", "slam"], ', 1); open(p, "w").write(s)

if __name__ == "__main__":
    g = build(); write_rp(g); write_bp()
    import dragon_acts; dragon_acts.main()
    print("dragão marinho ok:", len(g.bones), "ossos", sum(len(b.get("cubes", [])) for b in g.bones), "cubos")

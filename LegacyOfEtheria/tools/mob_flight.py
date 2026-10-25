"""ETAPA 4 - VOO DOS MOBS (anjos e dragões).
Estado do voo: propriedade NUMÉRICA etheria:fly (0 chão · 1 pairando · 2 subindo · 3 planando · 4 mergulho/ataque), escrita pelo script
BP systems/mobflight.js (família etheria_flyer). As animações só leem query.property / query.anim_time (loop 3600) — nada de
query.vertical_speed nem variáveis do pre_animation.
- ANJOS (Feldway, Zalario, Dino, Pico, Garasha): recebem as ASAS NOVAS das raças anjo (geometria + textura reaproveitadas de
  etheria_race_angel / _angel_arch / _fallen, ossos renomeados mw_* para não colidir com as asas antigas da skin, que ficam escondidas).
  Animações: chão (asas recolhidas respirando), pairando (batida média, corpo flutuando), subindo (batida forte), planando (abertas,
  ondulação lenta), mergulho (asas para trás, corpo inclinado). Obera não tem asas na referência: fica como está.
  feldway_angel passa a voar (hover), como os outros anjos.
- DRAGÕES: Veldanava (chefe) usa o voo de referência do dragão do jogador (tools/dragon_ref_flight.py, mesmos ossos d_*);
  Velzard/Velgrynd (serpentes, sem asas) ganham inclinação ao subir/mergulhar sobre o voo serpente que já têm.
Uso: python3 tools/mob_flight.py   (idempotente; rode depois de tools/dragon_ref_flight.py)"""
import json, os, copy
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
T = "query.anim_time"; FP = "query.property('etheria:fly')"
ANGELS = {"feldway_angel": ("angel", ["awing_l", "awing_r"], True), "zalario": ("angel_arch", ["wing_l", "wing_r"], True),
          "dino": ("angel", ["wing_l", "wing_r"], False), "pico": ("fallen", ["wing_l", "wing_r"], False),
          "garasha": ("fallen", ["wing_l", "wing_r"], False)}            # mob -> (asas da raça, ossos antigos a esconder, halo)
DRAGONS = ["veldanava", "velzard", "velgrynd"]
STATES = {"ground": 0, "hover": 1, "rise": 2, "glide": 3, "dive": 4}
WB = ["wing", "wingA", "wingB", "wingC", "wingAl"]

IND = {}
def jload(p):
    s = open(p).read(); l2 = s.split("\n")[1] if "\n" in s else ""; IND[p] = (len(l2) - len(l2.lstrip(" ")) or 1, s.endswith("\n"))   # mantém indentação e fim de linha do arquivo
    return json.loads(s)
def jdump(o, p, compact=False):
    s = json.dumps(o, separators=(",", ":")) if compact else json.dumps(o, indent=IND.get(p, (1, 0))[0], ensure_ascii=False)
    open(p, "w").write(s + ("\n" if IND.get(p, (1, 0))[1] and not compact else ""))

def wing_geos():
    for kind in sorted({v[0] for v in ANGELS.values()}):
        if kind == "fallen": continue   # 9.4: asas de penas demoníacas geradas por tools/demon_feather_wings.py
        g = copy.deepcopy(jload(os.path.join(RP, f"models/entity/etheria_race_{kind}.geo.json"))["minecraft:geometry"][0])
        g["description"]["identifier"] = f"geometry.etheria_mobwing_{kind}"
        keep = []
        for b in g["bones"]:
            n = b["name"]
            if n.startswith("wing") or n == "halo":
                b["name"] = "mw_" + n
                if b.get("parent", "").startswith("wing"): b["parent"] = "mw_" + b["parent"]
            elif n not in ("root", "waist", "body", "head"): continue
            keep.append(b)
        g["bones"] = keep
        jdump({"format_version": "1.12.0", "minecraft:geometry": [g]}, os.path.join(RP, f"models/entity/etheria_mobwing_{kind}.geo.json"), True)

def wing_state(st):
    """asas novas (ossos mw_*): z positivo na asa esquerda = abre/ergue para fora; a direita espelha."""
    f, a, open_, sweep, bend = {"ground": (80, 3, -18, 10, -6), "hover": (300, 26, 6, 0, 4), "rise": (430, 38, 10, -4, 6),
                                "glide": (70, 4, 22, -6, 2), "dive": (120, 3, -10, 34, -10)}[st]
    beat = f"math.sin({T} * {f})"; lag = lambda d: f"math.sin({T} * {f} - {d})"
    B = {}
    for s, sg in (("l", ""), ("r", "-")):
        B[f"mw_wing_{s}"] = {"rotation": [f"{beat} * {a * 0.12:.2f}", f"{sg}{sweep}", f"{sg}({open_} + {beat} * {a})"]}
        B[f"mw_wingB_{s}"] = {"rotation": [0, 0, f"{sg}({bend} + {lag(45)} * {a * 0.45:.1f})"]}
        B[f"mw_wingC_{s}"] = {"rotation": [0, 0, f"{sg}({bend} + {lag(90)} * {a * 0.55:.1f})"]}
    # corpo: flutua (pairando/subindo), inclina para frente planando e bem mais no mergulho, pernas soltas no ar
    bob = {"ground": 0, "hover": 1.2, "rise": 0.8, "glide": 0.5, "dive": 0}[st]
    lean = {"ground": 0, "hover": 4, "rise": -6, "glide": 18, "dive": 35}[st]
    if st != "ground":
        B["root"] = {"position": [0, f"math.sin({T} * {f} + 180) * {bob}", 0]}
        B["body"] = {"rotation": [lean, 0, f"math.sin({T} * 40) * 3" if st == "glide" else 0]}
        B["rightLeg"] = {"rotation": [f"{lean * 0.6:.0f} + math.sin({T} * 90) * 6", 0, 2]}
        B["leftLeg"] = {"rotation": [f"{lean * 0.6:.0f} + math.sin({T} * 90 + 60) * 6", 0, -2]}
    return {"loop": True, "animation_length": 3600, "bones": B}

def hide_old(mob, old, halo):
    B = {b: {"scale": 0} for b in old}
    B["mw_wing_l"] = {"scale": 1.15}; B["mw_wing_r"] = {"scale": 1.15}
    if halo: B["mw_halo"] = {"position": [0, f"math.sin({T} * 90) * 0.35", 0], "rotation": [0, f"{T} * 40", 0]}
    else: B["mw_halo"] = {"scale": 0}
    return {"loop": True, "animation_length": 3600, "bones": B}

def serp_state(st):
    p = {"rise": -18, "dive": 28}[st]
    return {"loop": True, "animation_length": 3600, "bones": {"d_All": {"rotation": [f"{p} + math.sin({T} * 60) * 3", 0, 0]}}}

def rp():
    wing_geos()
    A = {f"animation.etheria.mobwing.{st}": wing_state(st) for st in STATES}
    for mob, (kind, old, halo) in ANGELS.items(): A[f"animation.etheria.mobwing.hide_{mob}"] = hide_old(mob, old, halo)
    for st in ("rise", "dive"): A[f"animation.etheria.serp_fly.{st}"] = serp_state(st)
    jdump({"format_version": "1.8.0", "animations": A}, os.path.join(RP, "animations/etheria_mob_flight.animation.json"), True)
    jdump({"format_version": "1.8.0", "render_controllers": {"controller.render.etheria_mob_wings": {
        "geometry": "Geometry.wings", "materials": [{"*": "Material.wings"}], "textures": ["Texture.wings"]}}},
        os.path.join(RP, "render_controllers/etheria_mob_wings.render_controllers.json"))
    for mob, (kind, old, halo) in ANGELS.items():
        p = os.path.join(RP, f"entity/{mob}.entity.json"); E = jload(p); D = E["minecraft:client_entity"]["description"]
        D["geometry"]["wings"] = f"geometry.etheria_mobwing_{kind}"; D["textures"]["wings"] = f"textures/entity/etheria_race_{kind}"
        D["materials"]["wings"] = "entity_alphatest"
        if "controller.render.etheria_mob_wings" not in D["render_controllers"]: D["render_controllers"].append("controller.render.etheria_mob_wings")
        an = D["scripts"]["animate"]; an[:] = [a for a in an if not (isinstance(a, dict) and any(k.startswith("mw_") for k in a)) and a != "mw_hide"]
        D["animations"]["mw_hide"] = f"animation.etheria.mobwing.hide_{mob}"; an.append("mw_hide")
        for st, v in STATES.items():
            D["animations"][f"mw_{st}"] = f"animation.etheria.mobwing.{st}"; an.append({f"mw_{st}": f"{FP} == {v}"})
        jdump(E, p)
    # Veldanava: voo de referência (mesmos ossos d_* do dragão do jogador) no lugar do "fly" antigo
    p = os.path.join(RP, "entity/veldanava.entity.json"); E = jload(p); D = E["minecraft:client_entity"]["description"]
    an = D["scripts"]["animate"]; an[:] = [a for a in an if not (isinstance(a, dict) and any(k == "fly" or k.startswith("rf_") for k in a))]
    for st, v in (("hover", "== 1"), ("rise", "== 2"), ("glide", "== 3 || " + FP + " == 0"), ("dive", "== 4")):
        D["animations"][f"rf_{st}"] = f"animation.etheria_pdrg_veldanava.ref_{st}"
        an.append({f"rf_{st}": f"query.property('etheria:form') == 'dragon' && !query.is_on_ground && ({FP} {v})"})
    jdump(E, p)
    for mob in ("velzard", "velgrynd"):
        p = os.path.join(RP, f"entity/{mob}.entity.json"); E = jload(p); D = E["minecraft:client_entity"]["description"]
        an = D["scripts"]["animate"]; an[:] = [a for a in an if not (isinstance(a, dict) and any(k.startswith("sf_") for k in a))]
        for st, v in (("rise", 2), ("dive", 4)):
            D["animations"][f"sf_{st}"] = f"animation.etheria.serp_fly.{st}"
            an.append({f"sf_{st}": f"query.property('etheria:form') == 'dragon' && !query.is_on_ground && {FP} == {v}"})
        jdump(E, p)

def bp():
    HOVER = {"minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_pass_doors": True, "can_path_from_air": True, "avoid_water": True, "avoid_damage_blocks": True},
             "minecraft:movement.hover": {}, "minecraft:flying_speed": {"value": 0.2}, "minecraft:can_fly": {},
             "minecraft:behavior.random_hover": {"priority": 6, "xz_dist": 10, "y_dist": 5, "y_offset": -1, "interval": 1, "hover_height": [2, 6]}}
    for mob in list(ANGELS) + DRAGONS:
        p = os.path.join(BP, f"entities/{mob}.json"); E = jload(p); M = E["minecraft:entity"]
        M["description"].setdefault("properties", {})["etheria:fly"] = {"type": "int", "range": [0, 4], "default": 0, "client_sync": True}
        groups = [M["components"]] + list(M.get("component_groups", {}).values())
        for C in groups:
            fam = C.get("minecraft:type_family", {}).get("family")
            if fam is not None and "etheria_flyer" not in fam: fam.append("etheria_flyer")
        if mob == "feldway_angel":
            C = M["components"]
            for k in ("minecraft:navigation.walk", "minecraft:movement.basic", "minecraft:jump.static"): C.pop(k, None)
            C.update(copy.deepcopy(HOVER))
        jdump(E, p)

if __name__ == "__main__":
    rp(); bp(); print("ok: voo dos mobs (anjos:", len(ANGELS), "· dragões:", len(DRAGONS), ")")

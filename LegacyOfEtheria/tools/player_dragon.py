# 6.52 - FORMA DE DRAGÃO DO JOGADOR (linhagens Veldora / Velzard / Velgrynd / Veldanava), corrigida:
#  * O jogador transformado mostrava o dragão E o humanoide junto (traje de escamas do Tensura, peças de linhagem em escala humana,
#    armadura e item na mão). Causa: só o render "third_person" do jogador era escondido; os outros renders e os anexos
#    (armadura/armas, presos aos ossos do jogador) continuavam.
#  * Solução: cópias dos modelos de dragão SÓ para o jogador (etheria_pdrg_<linhagem>) com ossos prefixados "d_" — assim uma
#    animação pode zerar a escala dos ossos humanoides (head/body/braços/pernas -> some armadura e item na mão) sem tocar no dragão,
#    e as animações vanilla do jogador (olhar, andar, atacar) deixam de entortar os ossos do dragão. Os chefes continuam com os modelos originais.
#  * Animações do dragão do jogador refeitas a partir das originais: parado (respira, cauda e asas recolhidas), andar, correr,
#    voar (batida de asas forte), planar (asas abertas quase paradas ao descer), pouso, ataque e rugido.
import json, os, glob, copy
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
LINS = ["veldora", "velzard", "velgrynd", "veldanava"]
P = "d_"
def load_geos():
    G = {}
    for f in glob.glob(os.path.join(RP, "models/**/*.json"), recursive=True):
        try:
            for g in json.load(open(f)).get("minecraft:geometry", []): G[g["description"]["identifier"]] = g
        except Exception: pass
    return G
def load_anims():
    A = {}
    for f in glob.glob(os.path.join(RP, "animations/*.json")):
        try: A.update(json.load(open(f))["animations"])
        except Exception: pass
    return A
def pre_bones(bones): return {P + k: v for k, v in bones.items()}

FLY = "(!query.is_on_ground && !query.is_in_water)"
def extra_anims():
    """animações novas (aditivas) sobre os ossos prefixados"""
    out = {}
    # planar: caindo/descendo devagar -> asas abertas e quase paradas, cauda reta (substitui a batida forte do voo)
    out["animation.etheria_pdrg.glide"] = {"loop": True, "bones": {
        P + "left_wing_base": {"rotation": [0, 0, "-18 + math.sin(query.life_time * 90) * 3"]},
        P + "right_wing_base": {"rotation": [0, 0, "18 - math.sin(query.life_time * 90) * 3"]},
        P + "left_wing_top": {"rotation": [0, 0, "-8"]}, P + "right_wing_top": {"rotation": [0, 0, "8"]},
        P + "tail1": {"rotation": ["-4 + math.sin(query.life_time * 60) * 2", 0, 0]},
        P + "tail3": {"rotation": [0, "math.sin(query.life_time * 50) * 4", 0]}}}
    # respiração parado: peito sobe e desce, pescoço acompanha, cauda balança devagar
    out["animation.etheria_pdrg.breathe"] = {"loop": True, "bones": {
        P + "upper_body": {"rotation": ["math.sin(query.life_time * 70) * 1.5", 0, 0], "scale": [1, "1 + math.sin(query.life_time * 70) * 0.012", 1]},
        P + "neck1": {"rotation": ["math.sin(query.life_time * 70 - 30) * 1.5", 0, 0]},
        P + "head": {"rotation": ["math.sin(query.life_time * 70 - 60) * 2", "math.sin(query.life_time * 25) * 6", 0]},
        P + "tail2": {"rotation": [0, "math.sin(query.life_time * 40) * 5", 0]},
        P + "tail4": {"rotation": [0, "math.sin(query.life_time * 40 - 60) * 7", 0]}}}
    # pouso: ao tocar o chão depois de voar, joelhos dobram e asas fecham (0,5 s)
    out["animation.etheria_pdrg.land"] = {"animation_length": 0.5, "bones": {
        P + "body": {"position": {"0.0": [0, -6, 0], "0.25": [0, -2, 0], "0.5": [0, 0, 0]}},
        P + "left_leg": {"rotation": {"0.0": [-25, 0, 0], "0.5": [0, 0, 0]}}, P + "right_leg": {"rotation": {"0.0": [-25, 0, 0], "0.5": [0, 0, 0]}},
        P + "left_leg_lower": {"rotation": {"0.0": [35, 0, 0], "0.5": [0, 0, 0]}}, P + "right_leg_lower": {"rotation": {"0.0": [35, 0, 0], "0.5": [0, 0, 0]}},
        P + "left_wing_base": {"rotation": {"0.0": [0, 0, -40], "0.5": [0, 0, 0]}}, P + "right_wing_base": {"rotation": {"0.0": [0, 0, 40], "0.5": [0, 0, 0]}}}}
    # rugido (ao transformar / usar sopro): pescoço ergue, mandíbula abre, asas se abrem
    out["animation.etheria_pdrg.roar"] = {"animation_length": 1.4, "bones": {
        P + "neck1": {"rotation": {"0.0": [0, 0, 0], "0.3": [-25, 0, 0], "1.1": [-25, 0, 0], "1.4": [0, 0, 0]}},
        P + "neck3": {"rotation": {"0.0": [0, 0, 0], "0.3": [-15, 0, 0], "1.1": [-15, 0, 0], "1.4": [0, 0, 0]}},
        P + "lower_jaw": {"rotation": {"0.0": [0, 0, 0], "0.35": [35, 0, 0], "1.0": [35, 0, 0], "1.3": [0, 0, 0]}},
        P + "left_wing_base": {"rotation": {"0.0": [0, 0, 0], "0.4": [0, 0, -55], "1.1": [0, 0, -55], "1.4": [0, 0, 0]}},
        P + "right_wing_base": {"rotation": {"0.0": [0, 0, 0], "0.4": [0, 0, 55], "1.1": [0, 0, 55], "1.4": [0, 0, 0]}}}}
    # esconde o corpo humanoide (e com ele armadura e item na mão, que ficam presos a esses ossos) — só em 3ª pessoa
    out["animation.etheria_pdrg.hide_humanoid"] = {"loop": True, "bones": {b: {"scale": 0} for b in
        ("head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg", "rightItem", "leftItem", "waist", "root")}}
    return out

def main():
    G = load_geos(); A = load_anims(); outA = {}
    for lin in LINS:
        g = copy.deepcopy(G[f"geometry.etheria_{lin}"])
        g["description"]["identifier"] = f"geometry.etheria_pdrg_{lin}"
        for b in g["bones"]:
            b["name"] = P + b["name"]
            if b.get("parent"): b["parent"] = P + b["parent"]
        json.dump({"format_version": "1.12.0", "minecraft:geometry": [g]}, open(os.path.join(RP, f"models/entity/etheria_pdrg_{lin}.geo.json"), "w"))
        idle = copy.deepcopy(A[f"animation.etheria_{lin}.idle"]); idle["bones"] = pre_bones(idle["bones"])
        outA[f"animation.etheria_pdrg_{lin}.idle"] = idle
    for k in ("walk", "run", "fly", "attack"):
        a = copy.deepcopy(A[f"animation.etheria_tdr.{k}"]); a["bones"] = pre_bones(a["bones"]); outA[f"animation.etheria_pdrg.{k}"] = a
    outA.update(extra_anims())
    json.dump({"format_version": "1.8.0", "animations": outA}, open(os.path.join(RP, "animations/etheria_pdrg.animation.json"), "w"), indent=1)
    # ---- entidade do jogador
    pe = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(pe)); D = E["minecraft:client_entity"]["description"]
    DR = "(query.property('etheria:lform') == 'true' || query.property('etheria:lform') == 'draconic')"
    for lin in LINS: D["geometry"][f"drg_{lin}"] = f"geometry.etheria_pdrg_{lin}"; D["animations"][f"drg_idle_{lin}"] = f"animation.etheria_pdrg_{lin}.idle"
    for k in ("walk", "run", "fly", "attack"): D["animations"][f"drg_{k}"] = f"animation.etheria_pdrg.{k}"
    for k in ("glide", "breathe", "land", "roar", "hide_humanoid"): D["animations"][f"drg_{k}"] = f"animation.etheria_pdrg.{k}"
    pre = D["scripts"].setdefault("pre_animation", [])
    pre[:] = [x for x in pre if "etheria_dragon" not in x and "etheria_air" not in x and "etheria_land" not in x]
    pre[0:0] = [f"variable.etheria_dragon = {DR} ? 1.0 : 0.0;",
                "variable.etheria_land = (variable.etheria_air > 0.3 && query.is_on_ground) ? query.life_time : variable.etheria_land;",
                "variable.etheria_air = query.is_on_ground ? 0.0 : variable.etheria_air + query.delta_time;"]
    an = D["scripts"]["animate"]
    an[:] = [a for a in an if not (isinstance(a, dict) and any(k in ("drg_glide", "drg_breathe", "drg_land", "drg_roar", "drg_hide_humanoid", "drg_fly") for k in a))]
    an += [{"drg_fly": f"variable.etheria_dragon && {FLY} && query.vertical_speed > -1.0"},
           {"drg_glide": f"variable.etheria_dragon && {FLY} && query.vertical_speed <= -1.0"},
           {"drg_breathe": "variable.etheria_dragon && query.is_on_ground && query.modified_move_speed <= 0.05"},
           {"drg_land": "variable.etheria_dragon && query.is_on_ground && (query.life_time - variable.etheria_land) < 0.5"},
           {"drg_roar": "variable.etheria_dragon && query.property('etheria:tfx') != 'none'"},
           {"drg_hide_humanoid": "variable.etheria_dragon && !variable.is_first_person"}]
    # renders do humanoide (peças do Tensura, peças de raça/linhagem em escala humana) não aparecem na forma de dragão
    for r in D["render_controllers"]:
        if not isinstance(r, dict): continue
        k = next(iter(r))
        if (k.startswith("controller.render.tensura.") or (k.startswith("controller.render.etheria_race_"))) and "etheria_dragon" not in r[k]:
            r[k] = f"({r[k]}) && variable.etheria_dragon == 0.0"
    json.dump(E, open(pe, "w"), indent=1)
    print("ok:", len(outA), "animações")
if __name__ == "__main__": main()

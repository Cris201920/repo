# 6.54 - MICHAEL com o modelo/animação originais do mod tensuramoreskills (geo/michael_afk + animação "idleanimation"):
# a alabarda divina gigante flutuando e o corpo pairando. Uso pessoal (arquivos derivados do jar ficam fora do git).
#   - corpo: humanoide de BRAÇO FINO (skin original do Michael é slim) com nomes de ossos padrão -> andar/atacar continuam;
#   - alabarda: geometria própria (etheria_michael_halberd) com a textura própria dela, segundo render controller;
#   - animação do mod dividida: flutuar + alabarda (sempre) e pose dos membros (só parado).
# Uso: python3 tools/michael_afk.py <michael_afk.geo.json> <michael_afk.animation.json> <textura_da_alabarda.png>
import json, os, sys, copy
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SH = (-9.0, 3.5, -8.0)                       # o modelo do mod está fora da origem: centraliza no pé do personagem
REN = {"bone": "leftLeg", "bone2": "rightLeg", "bone3": "leftArm", "bone4": "rightArm", "bone5": "body", "bone6": "head"}
def sh(v): return [round(v[i] + SH[i], 4) for i in range(3)]

def body_geo():
    """humanoide slim (64x64) com camada externa, sob root/player_root (para a flutuação do mod)"""
    B = [{"name": "root", "pivot": [0, 0, 0]}, {"name": "player_root", "parent": "root", "pivot": [0, 0, 0]}]
    def bone(n, piv, cubes): B.append({"name": n, "parent": "player_root", "pivot": piv, "cubes": cubes})
    bone("body", [0, 24, 0], [{"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 16]}, {"origin": [-4, 12, -2], "size": [8, 12, 4], "uv": [16, 32], "inflate": 0.25}])
    bone("head", [0, 24, 0], [{"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [0, 0]}, {"origin": [-4, 24, -4], "size": [8, 8, 8], "uv": [32, 0], "inflate": 0.5}])
    bone("rightArm", [-5, 21.5, 0], [{"origin": [-7, 12, -2], "size": [3, 12, 4], "uv": [40, 16]}, {"origin": [-7, 12, -2], "size": [3, 12, 4], "uv": [40, 32], "inflate": 0.25}])
    bone("leftArm", [5, 21.5, 0], [{"origin": [4, 12, -2], "size": [3, 12, 4], "uv": [32, 48]}, {"origin": [4, 12, -2], "size": [3, 12, 4], "uv": [48, 48], "inflate": 0.25}])
    bone("rightLeg", [-1.9, 12, 0], [{"origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 16]}, {"origin": [-3.9, 0, -2], "size": [4, 12, 4], "uv": [0, 32], "inflate": 0.25}])
    bone("leftLeg", [1.9, 12, 0], [{"origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [16, 48]}, {"origin": [-0.1, 0, -2], "size": [4, 12, 4], "uv": [0, 48], "inflate": 0.25}])
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": "geometry.etheria_michael_body", "texture_width": 64, "texture_height": 64,
            "visible_bounds_width": 16, "visible_bounds_height": 16, "visible_bounds_offset": [0, 4, 0]}, "bones": B}]}

def halberd_geo(G, tw, th):
    w = next(b for b in G["bones"] if b["name"] == "weapon_root"); r = next(b for b in G["bones"] if b["name"] == "root")
    cubes = []
    for c in w["cubes"]:
        c2 = copy.deepcopy(c); c2["origin"] = sh(c["origin"])
        if "pivot" in c2: c2["pivot"] = sh(c["pivot"])
        cubes.append(c2)
    bones = [{"name": "root", "pivot": sh(r["pivot"])}, {"name": "weapon_root", "parent": "root", "pivot": sh(w["pivot"]), "cubes": cubes}]
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": "geometry.etheria_michael_halberd", "texture_width": tw, "texture_height": th,
            "visible_bounds_width": 20, "visible_bounds_height": 20, "visible_bounds_offset": [0, 5, 0]}, "bones": bones}]}

def anims(A):
    a = A["animations"]["idleanimation"]; bones = a["bones"]
    float_ = {k: v for k, v in bones.items() if k in ("root", "player_root", "weapon_root")}
    pose = {REN.get(k, k): v for k, v in bones.items() if k in REN}
    base = {k: v for k, v in a.items() if k != "bones"}; base["loop"] = True
    return {"format_version": "1.8.0", "animations": {
        "animation.etheria.michael.afk_float": {**base, "bones": float_},
        "animation.etheria.michael.afk_pose": {**base, "bones": pose}}}

def main(geo_p, anim_p, tex_p):
    G = json.load(open(geo_p))["minecraft:geometry"][0]; A = json.load(open(anim_p)); T = Image.open(tex_p)
    json.dump(body_geo(), open(os.path.join(RP, "models/entity/etheria_michael_body.geo.json"), "w"))
    json.dump(halberd_geo(G, *T.size), open(os.path.join(RP, "models/entity/etheria_michael_halberd.geo.json"), "w"))
    T.save(os.path.join(RP, "textures/entity/etheria_michael_halberd.png"))
    json.dump(anims(A), open(os.path.join(RP, "animations/etheria_michael_afk.animation.json"), "w"), indent=1)
    # render controller da alabarda (brilho divino: material emissivo com alfa)
    rcp = os.path.join(RP, "render_controllers/etheria_michael.render_controllers.json")
    json.dump({"format_version": "1.8.0", "render_controllers": {"controller.render.etheria_michael_halberd": {
        "geometry": "Geometry.halberd", "materials": [{"*": "Material.halberd"}], "textures": ["Texture.halberd"]}}}, open(rcp, "w"), indent=1)
    # entidade
    ep = os.path.join(RP, "entity/michael_manas.entity.json"); E = json.load(open(ep)); D = E["minecraft:client_entity"]["description"]
    D["geometry"] = {"default": "geometry.etheria_michael_body", "halberd": "geometry.etheria_michael_halberd"}
    D["textures"]["halberd"] = "textures/entity/etheria_michael_halberd"
    D.setdefault("materials", {})["halberd"] = "entity_emissive_alpha"
    D["animations"].update({"afk_float": "animation.etheria.michael.afk_float", "afk_pose": "animation.etheria.michael.afk_pose"})
    an = D.setdefault("scripts", {}).setdefault("animate", [])
    an[:] = [x for x in an if not (isinstance(x, dict) and ("afk_float" in x or "afk_pose" in x))]
    an += [{"afk_float": "query.is_alive"}, {"afk_pose": "query.modified_move_speed < 0.05 && variable.attack_time < 0"}]
    rcs = [r for r in D["render_controllers"] if r != "controller.render.etheria_michael_halberd"]
    D["render_controllers"] = rcs + ["controller.render.etheria_michael_halberd"]
    json.dump(E, open(ep, "w"), indent=1)
    print("ok: corpo slim + alabarda", len(halberd_geo(G, *T.size)["minecraft:geometry"][0]["bones"][1]["cubes"]), "cubos")
if __name__ == "__main__": main(*sys.argv[1:4])

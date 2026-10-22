# tools/weapons85.py - 8.5 ETAPA 5: armas enviadas pelo usuário que ainda não existiam no addon, convertidas SEM inventar texturas:
#   Yamato (Devil May Cry, CIT do OptiFine: modelo "yamato_hand" na mão)      -> etheria:yamato
#   Mirror Sword (CIT: ouro e sangue)                                          -> etheria:mirror_sword_gold / etheria:mirror_sword_blood
#   Two Eagles (modelos Java: Eagle Claw / Eagle Fang)                         -> etheria:eagle_claw / etheria:eagle_fang
#   espadas2 / sword_RE (addon Bedrock: 10 espadas, adaga e foice, brilho)     -> etheria:re_sword_1..10, etheria:re_dagger, etheria:re_scythe
#   sea-dragons-trident (glTF do Blockbench, 11 cubos + textura 128 px)        -> etheria:sea_dragons_trident (corpo a corpo + arremesso)
# Para cada arma: RP/models/entity/etheria_w_<id>.geo.json, RP/attachables/w_<id>.attachable.json, RP/textures/attachable/w_<id>.png,
# ícone RP/textures/items/etheria_<id>.png (o ícone do próprio pacote quando existe; senão renderizado do modelo 3D com a textura original),
# BP/items/02085_<id>.json, entrada em RP/textures/item_texture.json e em BP/scripts/data/items.gen.js (atributos, preço -> loja).
# O tridente arremessado usa RP/entity/vfx_trident.entity.json + BP/entities/vfx_trident.json (modelo deitado, inclinação por propriedade).
# Depois roda tools/weapon_bind.py (liga a arma ao osso da mão + animações de 1ª/3ª pessoa). Idempotente.
# Uso: python3 tools/weapons85.py <pasta pkg dos envios>
import json, os, sys, shutil, base64, struct, re
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
PKG = sys.argv[1]
sys.argv = sys.argv[:1]                         # swords.py lê sys.argv ao ser importado
import swords
from swords import java_model, render_icon, geo_json, Model
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "LegacyOfEtheria_BP"), os.path.join(ROOT, "LegacyOfEtheria_RP")
RC = "controller.render.etheria_weapon"
COLOR = {"common": "§f", "uncommon": "§a", "rare": "§9", "epic": "§5", "legendary": "§6", "mythic": "§c"}
PRICE = {"uncommon": 900, "rare": 2200, "epic": 4800, "legendary": 12000}

# id -> (nome, raridade, tipo, atributos, efeito no golpe, origem)
W = {
  "yamato": ("Yamato", "legendary", "sword", {"atk": 26, "agility": 12, "crit": 14, "void": 8}, {"kind": "bleed", "sec": 4, "chance": 0.3, "name": "Corte Dimensional"},
             ("java", "yamato-l-devil-may-cry/Yamato l Devil May Cry/assets/minecraft/optifine/cit/ibarysta/yamato_hand")),
  "mirror_sword_gold": ("Espada Espelhada Dourada", "epic", "sword", {"atk": 20, "crit": 10, "light": 8}, None,
             ("java", "mirror-sword/Mirror Sword/assets/minecraft/optifine/cit/ibarysta/mirror_sword_gold")),
  "mirror_sword_blood": ("Espada Espelhada Sangrenta", "epic", "sword", {"atk": 21, "crit": 8, "blood": 10}, {"kind": "bleed", "sec": 5, "chance": 0.25, "name": "Reflexo Sangrento"},
             ("java", "mirror-sword/Mirror Sword/assets/minecraft/optifine/cit/ibarysta/mirror_sword_blood")),
  "eagle_claw": ("Garra da Águia", "epic", "sword", {"atk": 19, "agility": 10, "wind": 8}, None,
             ("java2", "two-eagles-swords/Two eagles - swords/assets/minecraft/models/ibarysta/eagle_claw", "two-eagles-swords/Two eagles - swords/assets/minecraft/textures/ibarysta/eagle_claw")),
  "eagle_fang": ("Presa da Águia", "epic", "sword", {"atk": 20, "crit": 9, "wind": 6}, None,
             ("java2", "two-eagles-swords/Two eagles - swords/assets/minecraft/models/ibarysta/eagle_fang", "two-eagles-swords/Two eagles - swords/assets/minecraft/textures/ibarysta/eagle_fang")),
  "re_dagger": ("Adaga Gêmea", "rare", "dagger", {"atk": 11, "agility": 8, "crit": 6}, None, ("re", "adaga")),
  "re_sword_1": ("Lâmina Ametista Sombria", "epic", "sword", {"atk": 18, "void": 6}, None, ("re", "espada_1")),
  "re_sword_2": ("Lâmina de Brasa Negra", "epic", "sword", {"atk": 18, "fire": 6}, {"kind": "burn", "sec": 3, "chance": 0.2, "name": "Brasa"}, ("re", "espada_2")),
  "re_sword_3": ("Lâmina Esmeralda Sombria", "rare", "sword", {"atk": 16, "wind": 5}, None, ("re", "espada_3")),
  "re_sword_4": ("Lâmina da Noite Azul", "epic", "sword", {"atk": 18, "ice": 6}, {"kind": "slow", "sec": 3, "chance": 0.2, "name": "Gelo Noturno"}, ("re", "espada_4")),
  "re_sword_5": ("Espada Violeta", "rare", "sword", {"atk": 15, "arcane": 5}, None, ("re", "espada_5")),
  "re_sword_6": ("Espada de Jade", "rare", "sword", {"atk": 15, "earth": 5}, None, ("re", "espada_6")),
  "re_sword_7": ("Espada Carmesim", "rare", "sword", {"atk": 16, "blood": 5}, {"kind": "bleed", "sec": 4, "chance": 0.2, "name": "Corte Carmesim"}, ("re", "espada_7")),
  "re_sword_8": ("Espada de Ferro Antigo", "uncommon", "sword", {"atk": 11, "strength": 3}, None, ("re", "espada_8")),
  "re_sword_9": ("Espada Estelar", "epic", "sword", {"atk": 20, "light": 6}, None, ("re", "espada_9")),
  "re_sword_10": ("Espada de Prata", "uncommon", "sword", {"atk": 12, "strength": 3}, None, ("re", "espada_10")),
  "re_scythe": ("Foice de Osso", "rare", "scythe", {"atk": 17, "shadow": 5}, {"kind": "bleed", "sec": 4, "chance": 0.2, "name": "Ceifa"}, ("re", "foice_1")),
  "sea_dragons_trident": ("Tridente dos Dragões Marinhos", "legendary", "spear", {"atk": 24, "strength": 8, "water": 12, "lightning": 8},
             {"kind": "slow", "sec": 3, "chance": 0.2, "name": "Maré"}, ("gltf", "sea-dragons-trident/source/model.gltf", "sea-dragons-trident/textures/gltf_embedded_0.png")),
}
# identidade visual (systems/weaponfx.js): cor A, cor B, sprite, padrão de impacto, círculo, elemento
LOOK = {
  "yamato": ["void", "arcane", "line", "iai", "space", "void"], "mirror_sword_gold": ["gold", "holy", "star", "light", "holy", "light"],
  "mirror_sword_blood": ["blood", "black", "drop", "death", "blood", "blood"], "eagle_claw": ["wind", "white", "wing", "wind", "wind", "wind"],
  "eagle_fang": ["steel", "wind", "wing", "slash", "wind", "wind"], "re_dagger": ["steel", "white", "line", "slash", "wind", "physical"],
  "re_sword_1": ["violet", "black", "orb", "rift", "void", "void"], "re_sword_2": ["ember", "black", "flame", "embers", "fire", "fire"],
  "re_sword_3": ["green", "black", "leaf", "wind", "wind", "wind"], "re_sword_4": ["ice", "black", "flake", "pierce", "ice", "ice"],
  "re_sword_5": ["violet", "arcane", "rune1", "rift", "arcane", "arcane"], "re_sword_6": ["green", "gold", "leaf", "slash", "earth", "earth"],
  "re_sword_7": ["blood", "ember", "drop", "death", "blood", "blood"], "re_sword_8": ["steel", "dust", "spark", "slash", "arcane", "physical"],
  "re_sword_9": ["gold", "ice", "star", "light", "holy", "light"], "re_sword_10": ["steel", "white", "spark", "slash", "holy", "physical"],
  "re_scythe": ["white", "shadow", "skull", "reap", "shadow", "shadow"], "sea_dragons_trident": ["water", "bolt", "drop", "pierce", "water", "lightning"],
}

# ------------------------------------------------------------------ glTF do Blockbench (cubos) -> cubos Bedrock com UV por face
FACEN = {"east": (1, 0, 0), "west": (-1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0), "south": (0, 0, 1), "north": (0, 0, -1)}
def corners(o, s, fn):   # mesma ordem de cantos (u,v)->(u+w,v)->(u+w,v+h)->(u,v+h) usada pelo renderizador de conferência
    x0, y0, z0 = o; x1, y1, z1 = o[0] + s[0], o[1] + s[1], o[2] + s[2]
    return {"north": [(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], "south": [(x1, y1, z1), (x0, y1, z1), (x0, y0, z1), (x1, y0, z1)],
            "east": [(x1, y1, z0), (x1, y1, z1), (x1, y0, z1), (x1, y0, z0)], "west": [(x0, y1, z1), (x0, y1, z0), (x0, y0, z0), (x0, y0, z1)],
            "up": [(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)], "down": [(x1, y0, z0), (x0, y0, z0), (x0, y0, z1), (x1, y0, z1)]}[fn]
def gltf_model(path, texsize, scale=0.7, grip_y=-0.25):
    d = json.load(open(path)); bufs = [base64.b64decode(b["uri"].split(",")[1]) for b in d["buffers"]]
    def acc(i):
        a = d["accessors"][i]; bv = d["bufferViews"][a["bufferView"]]; n = {"VEC3": 3, "VEC2": 2}[a["type"]]
        off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        return np.array(struct.unpack_from("<" + "f" * (n * a["count"]), bufs[bv["buffer"]], off)).reshape(-1, n)
    tw, th = texsize; m = Model(tw, th); k = 16 * scale
    for mesh in d["meshes"]:
        pr = mesh["primitives"][0]; P = acc(pr["attributes"]["POSITION"]).copy(); UV = acc(pr["attributes"]["TEXCOORD_0"])
        N = acc(pr["attributes"]["NORMAL"]).copy(); N[:, 0] *= -1   # normais com o mesmo espelhamento de X
        P[:, 1] -= grip_y                      # empunhadura na origem (a rotação de exibição do Blockbench é descartada: arma reta, ponta em +Y)
        P[:, 0] *= -1                          # Bedrock espelha X em relação ao Blockbench
        P *= k
        mn, mx = P.min(0), P.max(0); o, s = mn.tolist(), (mx - mn).tolist()
        faces = {}
        for fn, nrm in FACEN.items():
            ax = [i for i in range(3) if nrm[i]][0]; side = mx[ax] if nrm[ax] > 0 else mn[ax]
            idx = [i for i in range(len(P)) if abs(P[i][ax] - side) < 1e-3 and N[i] @ np.array(nrm, float) > 0.9]   # vértices DESTA face (cada canto tem 3)
            if not idx: continue
            cs = corners(o, s, fn)
            def uv_at(pt):
                j = min(idx, key=lambda i: sum((P[i][q] - pt[q]) ** 2 for q in range(3)))
                return UV[j][0] * tw, (1 - UV[j][1]) * th   # o exportador glTF do Blockbench grava V de baixo para cima
            u0, v0 = uv_at(cs[0]); u2, v2 = uv_at(cs[2])
            if abs(u2 - u0) < 1e-6 and abs(v2 - v0) < 1e-6: continue
            faces[fn] = {"uv": [round(u0, 4), round(v0, 4)], "uv_size": [round(u2 - u0, 4), round(v2 - v0, 4)]}
        m.box(o, [max(v, 0.0) for v in s], faces)
    return m

# ------------------------------------------------------------------ espadas2 (geometria Bedrock no espaço do braço)
def re_geo(gid, src):
    G = json.load(open(src))["minecraft:geometry"][0]
    bones = [{"name": "rightArm", "pivot": [-5, 22, 0]}, {"name": "rightItem", "parent": "rightArm", "pivot": [-6, 15, 1]},
             {"name": "eth_weapon", "parent": "rightItem", "pivot": [-6, 15, 1], "cubes": []}]
    for b in G["bones"]:
        if b["name"].lower() == "rightarm": bones[2]["cubes"] += b.get("cubes", [])
        else:
            nb = {k: v for k, v in b.items() if k not in ("parent",)}; nb["parent"] = "eth_weapon"; bones.append(nb)
    D = G["description"]
    return {"format_version": "1.16.0", "minecraft:geometry": [{"description": {"identifier": gid, "texture_width": D["texture_width"], "texture_height": D["texture_height"],
            "visible_bounds_width": 4, "visible_bounds_height": 4.5, "visible_bounds_offset": [0, 1.25, 0]}, "bones": bones}]}, G

def attachable(iid, gid, tex, emissive):
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {"identifier": iid,
        "materials": {"default": "entity_emissive_alpha" if emissive else "entity_alphatest"}, "textures": {"default": tex},
        "geometry": {"default": gid}, "render_controllers": [RC]}}}

def icon_of(m, tex, view=(-78, 14, -45)):
    at = swords.AT; swords.AT = -1           # textura com recortes (alfa): não forçar opaco no ícone
    try: return render_icon(m, tex, size=64, view=view)
    finally: swords.AT = at

def item_json(sid, name, rarity, trident):
    comps = {"minecraft:icon": {"textures": {"default": f"etheria_{sid}"}}, "minecraft:display_name": {"value": COLOR[rarity] + name},
             "minecraft:max_stack_size": 1, "minecraft:hand_equipped": True}
    if rarity in ("legendary", "mythic"): comps["minecraft:glint"] = True
    if trident: comps["minecraft:cooldown"] = {"category": "etheria_trident", "duration": 2.0}   # arremesso com o botão de usar (systems/trident.js)
    return {"format_version": "1.21.60", "minecraft:item": {"description": {"identifier": f"etheria:{sid}", "menu_category": {"category": "equipment"}}, "components": comps}}

def trident_entities(m, texrel):
    # modelo deitado: a ponta aponta para a frente do modelo (-Z); o osso "root" inclina pela propriedade etheria:pitch
    cubes = json.loads(json.dumps(m.cubes)); ys = [c["origin"][1] for c in cubes] + [c["origin"][1] + c["size"][1] for c in cubes]; cy = (min(ys) + max(ys)) / 2
    for c in cubes: c["origin"][1] -= cy
    geo = {"format_version": "1.16.0", "minecraft:geometry": [{"description": {"identifier": "geometry.etheria_vfx_trident", "texture_width": m.tw, "texture_height": m.th,
           "visible_bounds_width": 4, "visible_bounds_height": 4, "visible_bounds_offset": [0, 0.5, 0]},
           "bones": [{"name": "root", "pivot": [0, 4, 0]}, {"name": "spear", "parent": "root", "pivot": [0, 4, 0], "rotation": [90, 0, 0],
                     "cubes": [dict(c, origin=[c["origin"][0], c["origin"][1] + 4, c["origin"][2]]) for c in cubes]}]}]}
    json.dump(geo, open(os.path.join(RP, "models/entity/etheria_vfx_trident.geo.json"), "w"), indent=1)
    anim = {"format_version": "1.10.0", "animations": {"animation.etheria.vfx_trident.pitch": {"loop": True, "animation_length": 3600,
            "bones": {"root": {"rotation": ["query.property('etheria:pitch')", 0, 0]}}}}}
    json.dump(anim, open(os.path.join(RP, "animations/etheria_vfx_trident.animation.json"), "w"), indent=1)
    ce = {"format_version": "1.10.0", "minecraft:client_entity": {"description": {"identifier": "etheria:vfx_trident",
          "materials": {"default": "entity_alphatest"}, "textures": {"default": texrel}, "geometry": {"default": "geometry.etheria_vfx_trident"},
          "render_controllers": ["controller.render.default"], "animations": {"pitch": "animation.etheria.vfx_trident.pitch"}, "scripts": {"animate": ["pitch"]}}}}
    json.dump(ce, open(os.path.join(RP, "entity/vfx_trident.entity.json"), "w"), indent=1)
    be = {"format_version": "1.21.0", "minecraft:entity": {"description": {"identifier": "etheria:vfx_trident", "is_spawnable": False, "is_summonable": True,
          "properties": {"etheria:pitch": {"type": "float", "range": [-90.0, 90.0], "default": 0.0, "client_sync": True}}},
          "component_groups": {"etheria:vfx_gone": {"minecraft:instant_despawn": {}}},
          "components": {"minecraft:collision_box": {"width": 0.01, "height": 0.01}, "minecraft:physics": {"has_gravity": False, "has_collision": False},
                         "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False}, "minecraft:damage_sensor": {"triggers": {"cause": "all", "deals_damage": "no"}},
                         "minecraft:health": {"value": 1, "max": 1}, "minecraft:fire_immune": True, "minecraft:knockback_resistance": {"value": 1},
                         "minecraft:type_family": {"family": ["etheria_vfx", "inanimate"]},
                         "minecraft:timer": {"looping": False, "time": 8, "time_down_event": {"event": "etheria:vfx_end"}}},
          "events": {"etheria:vfx_end": {"add": {"component_groups": ["etheria:vfx_gone"]}}}}}
    json.dump(be, open(os.path.join(BP, "entities/vfx_trident.json"), "w"), indent=1)

def main():
    rcf = os.path.join(RP, "render_controllers/etheria_weapon.render_controllers.json")
    json.dump({"format_version": "1.8.0", "render_controllers": {RC: {"geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"]}}}, open(rcf, "w"), indent=1)
    itp = os.path.join(RP, "textures/item_texture.json"); it = json.load(open(itp))
    igp = os.path.join(BP, "scripts/data/items.gen.js"); src = open(igp, encoding="utf-8").read()
    head, body = src.split("export const ITEMS = ", 1); ITEMS = json.loads(body.rstrip().rstrip(";"))
    for sid, (name, rarity, wtype, stats, onhit, how) in W.items():
        iid, gid, texrel = f"etheria:{sid}", f"geometry.etheria_w_{sid}", f"textures/attachable/w_{sid}"
        gp = os.path.join(RP, f"models/entity/etheria_w_{sid}.geo.json"); emissive = False; icon = None
        if how[0] in ("java", "java2"):
            mp = os.path.join(PKG, how[1] + ".json"); tp = os.path.join(PKG, (how[2] if how[0] == "java2" else how[1]) + ".png")
            tex = Image.open(tp).convert("RGBA"); m = java_model(mp, tex.size[0], tex.size[1])
            geo = geo_json(gid, m); icon = icon_of(m, tex)
        elif how[0] == "gltf":
            tex = Image.open(os.path.join(PKG, how[2])).convert("RGBA"); m = gltf_model(os.path.join(PKG, how[1]), tex.size)
            geo = geo_json(gid, m); icon = icon_of(m, tex, view=(-10, 12, -45)); trident_entities(m, texrel)   # de frente: as pontas (plano) aparecem inteiras
        else:   # espadas2
            base = os.path.join(PKG, "espadas2/sword_RE")
            geo, _ = re_geo(gid, os.path.join(base, f"models/entity/{how[1]}.json"))
            tex = Image.open(os.path.join(base, f"textures/armas/{how[1]}.png")).convert("RGBA"); emissive = True
            icon = Image.open(os.path.join(base, f"textures/items/{how[1]}.png")).convert("RGBA")
        # não sobrescreve a geometria já ligada à mão (weapon_bind desloca o cabo uma única vez e guarda em weapon_grip.json)
        if not os.path.exists(gp): json.dump(geo, open(gp, "w"), indent=1)
        tex.save(os.path.join(RP, f"textures/attachable/w_{sid}.png")); icon.save(os.path.join(RP, f"textures/items/etheria_{sid}.png"))
        ap = os.path.join(RP, f"attachables/w_{sid}.attachable.json")
        a = attachable(iid, gid, texrel, emissive)
        if os.path.exists(ap):   # mantém as animações de 1ª/3ª pessoa já geradas pelo weapon_bind
            old = json.load(open(ap))["minecraft:attachable"]["description"]
            for k in ("animations", "scripts"):
                if k in old: a["minecraft:attachable"]["description"][k] = old[k]
        json.dump(a, open(ap, "w"), indent=1)
        json.dump(item_json(sid, name, rarity, sid == "sea_dragons_trident"), open(os.path.join(BP, f"items/02085_{sid}.json"), "w"), indent=1, ensure_ascii=False)
        it["texture_data"][f"etheria_{sid}"] = {"textures": f"textures/items/etheria_{sid}"}
        e = {"id": iid, "name": name, "rarity": rarity, "kind": "weapon", "wtype": wtype, "stats": stats}
        if onhit: e["onHit"] = onhit
        e["price"] = PRICE[rarity]; e["sell"] = PRICE[rarity] // 4
        ITEMS[iid] = e
    json.dump(it, open(itp, "w"), indent=1)
    open(igp, "w", encoding="utf-8").write(head + "export const ITEMS = " + json.dumps(ITEMS, indent=1, ensure_ascii=False) + ";\n")
    lk = os.path.join(BP, "scripts/data/weapons85.gen.js")
    open(lk, "w", encoding="utf-8").write("// GERADO por tools/weapons85.py - identidade visual das armas da etapa 5 (cor A, cor B, sprite, impacto, círculo, elemento).\n"
        "export const LOOK85 = " + json.dumps(LOOK) + ";\n")
    import weapon_bind; weapon_bind.main()
    print(len(W), "armas da etapa 5")
if __name__ == "__main__": main()

# 6.41 - ARMAS IDÊNTICAS AO MOD Tensura (uso pessoal): cada arma do addon que tem equivalente no mod usa a imagem original do mod
# (pixel a pixel) como ícone e, na mão, a mesma imagem extrudada em 3D do jeito do Java (1 camada de profundidade), com a escala de mão
# que o mod usa para aquele tipo (espada/katana 0,85 · longa/tachi 1,25 · montante/odachi/lança/foice 2,0).
# Armas especiais com modelo 3D próprio no mod: Dead End Rainbow (geometria Bedrock do mod), Lâmina de Gelo e Lança Vórtice (modelos Java).
# Uso: python3 tools/mod_weapons.py <assets/tensura do jar> [<pasta assets de outros mods>...]
# 6.42: se o item do addon tem o MESMO id em um dos mods enviados (trorigins, irons_spellbooks, deeperdarker, NaturesAura, Aquaculture,
# SlimeThroneExtras, tensura_minesura, tensuramoreskills), usa exatamente aquele modelo/textura; senão, o equivalente do Tensura (MAP).
import json, os, sys, re
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
HAND = (-6.0, 11.5, 0.0); HOLD_ROT = [55.0, 0.0, 0.0]
DRAG = {"": "adamantite", "abyss": "hihiirokane", "earth": "orichalcum", "frost": "mithril", "scorch": "golden", "storm": "high_magisteel", "star": "pure_magisteel"}
DKIND = {"short_sword": "short_sword", "sword": "sword", "long_sword": "long_sword", "katana": "katana", "great_sword": "great_sword"}
MAP = {}
for el, mat in DRAG.items():
    for k in DKIND:
        sid = f"dragotite_{el + '_' if el else ''}{k}"
        tex = f"{mat}_{k}"
        if mat == "golden" and k == "sword": tex = "golden_tachi"     # o mod não tem "golden_sword" (é o vanilla)
        MAP[sid] = tex
MAP.update({
    "iron_blade": "iron_long_sword", "knight_sword": "silver_sword", "infused_iron_sword": "low_magisteel_sword", "flame_sword": "golden_odachi",
    "void_sword": "netherite_tachi", "celestial_blade": "pure_magisteel_odachi", "ember_fang": "orichalcum_odachi", "kusanagi": "silver_tachi",
    "dyrnwyn": "orichalcum_tachi", "warden_sword": "adamantite_tachi", "resonarium_sword": "high_magisteel_tachi", "neptunium_sword": "diamond_long_sword",
    "sky_sword": "silver_long_sword", "depth_sword": "netherite_long_sword", "claymore": "iron_great_sword", "dreadsword": "netherite_great_sword",
    "obsidian_katana": "netherite_katana", "boreal_blade": "diamond_katana", "amethyst_rapier": "hihiirokane_kodachi", "fiery_dagger": "golden_kodachi",
    "shadow_dagger": "spider_dagger", "dead_mans_hand": "centipede_dagger", "tt_kunai": "kunai", "tt_spatial_blades": "pure_magisteel_kunai",
    "tt_spatial_blade": "spatial_blade", "tt_gobuta_kodachi": "iron_kodachi", "tt_katana": "iron_katana", "tt_sword_of_tempest": "tempest_scale_sword",
    "reaper_scythe": "blade_tiger_scythe", "berserker_axe": "adamantite_axe", "geb": "orichalcum_axe", "tt_battle_axe": "mithril_axe",
    "tt_orc_axe": "silver_axe", "tt_orc_cleaver": "low_magisteel_axe", "goblin_king_club": "goblin_club", "caedros_ashen_halberd": "pure_magisteel_spear",
    "storm_bow": "@icon:war_bow", "gandiva": "@icon:long_spider_bow",
    "tt_dead_end_rainbow": "@geo:dead_end_rainbow", "tt_ice_blade": "@java:ice_blade", "wyrm_spear": "@java:vortex_spear",
    # 6.42: as últimas espadas que eram desenhadas pelo addon agora também usam modelos do mod
    "tt_shizue_sword": "@geo:moonlight", "tt_crimson_lotus_edge": "severer_blade", "wild_card": "tempest_scale_knife",
})
NO_TOUCH = {"rimuru_sword", "reid_dragon_sword"}   # já vêm de modelos originais (pacote CIT do Rimuru / Tensura-Blade) via swords.py
VANILLA_DISPLAY = {   # display padrão do Minecraft Java
    "handheld": {"thirdperson_righthand": {"scale": [0.85, 0.85, 0.85]}, "firstperson_righthand": {"scale": [0.68, 0.68, 0.68]}},
    "generated": {"thirdperson_righthand": {"scale": [0.55, 0.55, 0.55]}, "firstperson_righthand": {"scale": [0.68, 0.68, 0.68]}},
}
def scale_of(tex):   # escala de mão do mod (display.thirdperson_righthand)
    if re.search(r"great_sword|odachi|spear|scythe", tex): return 2.0
    if re.search(r"long_sword|tachi|spatial_blade|tempest_scale_sword", tex): return 1.25
    return 0.85
def grip_frac(tex):
    if re.search(r"spear|scythe", tex): return 0.32
    if re.search(r"axe|club", tex): return 0.18
    return 0.14

def sprite(TA, name):
    im = Image.open(os.path.join(TA, "textures/item", name + ".png")).convert("RGBA")
    if im.height > im.width and im.height % im.width == 0: im = im.crop((0, 0, im.width, im.width))   # textura animada: 1º quadro
    return im

def extrude(im, S, gfrac):
    """sprite -> cubos (1 por sequência horizontal de pixels opacos), no plano YZ (espessura em X), cabo na origem"""
    w, h = im.size; A = im.split()[3].load(); k = 16.0 / w * S; t = S
    op = [(c, r) for r in range(h) for c in range(w) if A[c, r] > 20]
    if not op: return []
    # cabo: pixel opaco mais próximo do canto inferior esquerdo; ponta: mais próximo do canto superior direito
    pc, pr = min(op, key=lambda q: q[0] + (h - 1 - q[1])); tc, tr = max(op, key=lambda q: q[0] + (h - 1 - q[1]))
    gc, gr = pc + (tc - pc) * gfrac, pr + (tr - pr) * gfrac
    cubes = []
    for r in range(h):
        c = 0
        while c < w:
            if A[c, r] <= 20: c += 1; continue
            c0 = c
            while c < w and A[c, r] > 20: c += 1
            n = c - c0
            y = (h - 1 - r - (h - 1 - gr)) * k; z = (c0 - gc) * k
            cubes.append({"origin": [round(-t / 2, 4), round(y, 4), round(z, 4)], "size": [round(t, 4), round(k, 4), round(n * k, 4)],
                          "uv": {"west": {"uv": [c0, r], "uv_size": [n, 1]}, "east": {"uv": [c, r], "uv_size": [-n, 1]},
                                 "up": {"uv": [c0, r], "uv_size": [n, 1]}, "down": {"uv": [c0, r], "uv_size": [n, 1]},
                                 "north": {"uv": [c0, r], "uv_size": [1, 1]}, "south": {"uv": [c - 1, r], "uv_size": [1, 1]}}})
    return cubes

def geo(gid, cubes, tw, th, model_rot):
    bones = [{"name": "rightArm", "pivot": [-5, 22, 0]}, {"name": "rightItem", "parent": "rightArm", "pivot": [-6, 15, 1]},
             {"name": "eth_weapon", "parent": "rightItem", "pivot": list(HAND), "rotation": HOLD_ROT},
             {"name": "eth_model", "parent": "eth_weapon", "pivot": list(HAND), "rotation": model_rot, "cubes": []}]
    for c in cubes:
        c2 = json.loads(json.dumps(c)); c2["origin"] = [round(c["origin"][i] + HAND[i], 4) for i in range(3)]
        if "pivot" in c2: c2["pivot"] = [round(c["pivot"][i] + HAND[i], 4) for i in range(3)]
        bones[3]["cubes"].append(c2)
    return {"format_version": "1.16.0", "minecraft:geometry": [{"description": {"identifier": gid, "texture_width": tw, "texture_height": th,
            "visible_bounds_width": 5, "visible_bounds_height": 6, "visible_bounds_offset": [0, 1.5, 0]}, "bones": bones}]}
def attachable(iid, gid, tex):
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {"identifier": iid,
        "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"}, "textures": {"default": tex, "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": gid}, "render_controllers": ["controller.render.item_default"]}}}
def icon_save(im, path):
    k = max(1, 64 // im.width) if im.width < 64 else 1
    im.resize((im.width * k, im.height * k), Image.NEAREST).save(path)

def find_source(sid, roots):
    """modelo do item com o MESMO id em algum dos mods enviados (trorigins, irons_spellbooks, deeperdarker, ...)"""
    base = sid[3:] if sid.startswith("tt_") else sid
    for r in roots:
        for ns in sorted(os.listdir(r)):
            for n in (sid, base):
                p = os.path.join(r, ns, "models/item", n + ".json")
                if os.path.exists(p): return p
    return None
def _ref_path(ref, roots, kind, here_ns):
    ns, _, rest = ref.partition(":") if ":" in ref else (here_ns, "", ref)
    for r in roots:
        p = os.path.join(r, ns, kind, rest + (".json" if kind == "models" else ".png"))
        if os.path.exists(p): return p
    return None
def resolve(path, roots):
    """segue parent/base (separate_transforms) e junta textures/display/elements; devolve também a textura da GUI"""
    ns = path.split(os.sep + "assets" + os.sep)[-1].split(os.sep)[0] if os.sep + "assets" + os.sep in path else path.split(os.sep)[-4]
    out = {"textures": {}, "display": {}, "elements": None, "gui": None, "ns": ns, "texture_size": None, "geo": None}
    def walk(d, ns, depth=0):
        if depth > 8: return
        if d.get("loader", "").endswith("separate_transforms"):
            g = ((d.get("perspectives") or {}).get("gui") or {})
            if g.get("textures", {}).get("layer0") and not out["gui"]: out["gui"] = (g["textures"]["layer0"], ns)
            elif g.get("parent") and not out["gui"]:
                gp = _ref_path(g["parent"], roots, "models", ns)
                if gp:
                    gd = json.load(open(gp)); l0 = (gd.get("textures") or {}).get("layer0")
                    if l0: out["gui"] = (l0, ns)
            if d.get("base"): walk(d["base"], ns, depth + 1)
        for k, v in (d.get("textures") or {}).items(): out["textures"].setdefault(k, (v, ns))
        for k, v in (d.get("display") or {}).items(): out["display"].setdefault(k, v)
        if d.get("elements") and out["elements"] is None: out["elements"] = d["elements"]; out["texture_size"] = d.get("texture_size")
        par = d.get("parent")
        if par:
            pn = par.split(":")[-1]
            if pn in ("item/handheld", "item/generated", "builtin/entity"):
                for k, v in VANILLA_DISPLAY["generated" if pn == "item/generated" else "handheld"].items(): out["display"].setdefault(k, v)
                if pn == "builtin/entity": out["geo"] = True
                return
            pp = _ref_path(par, roots, "models", ns)
            if pp: walk(json.load(open(pp)), par.split(":")[0] if ":" in par else ns, depth + 1)
    walk(json.load(open(path)), ns)
    # modelo sem pai do Minecraft: o Java usa transformação identidade (escala 1)
    for k in ("thirdperson_righthand", "firstperson_righthand"): out["display"].setdefault(k, {"scale": [1, 1, 1]})
    return out
def tex_of(ref_ns, roots):
    ref, ns = ref_ns; p = _ref_path(ref, roots, "textures", ns)
    if not p: raise FileNotFoundError(f"textura {ref} ({ns})")
    return p
def first_frame(p):
    im = Image.open(p).convert("RGBA")
    if im.height > im.width and im.height % im.width == 0: im = im.crop((0, 0, im.width, im.width))
    return im

def scale_cubes(cubes, k):
    out = []
    for c in cubes:
        c2 = json.loads(json.dumps(c)); c2["origin"] = [round(v * k, 4) for v in c["origin"]]; c2["size"] = [round(v * k, 4) for v in c["size"]]
        if "pivot" in c2: c2["pivot"] = [round(v * k, 4) for v in c["pivot"]]
        if "inflate" in c2: c2["inflate"] = round(c2["inflate"] * k, 4)
        out.append(c2)
    return out
def disp_scale(R, view, default):
    try: return float(R["display"][view]["scale"][1])
    except Exception: return default

def main(TA, extra_roots=()):
    from swords import java_model, render_icon, Model
    roots = [os.path.dirname(TA)] + [r for r in extra_roots if os.path.isdir(r)]
    done, skipped, fp = [], [], {}
    ids = sorted(os.path.basename(f)[2:-len(".attachable.json")] for f in os.listdir(os.path.join(RP, "attachables")) if f.startswith("w_"))
    ids = sorted(set(ids) | set(MAP))
    plan = {}
    for sid in ids:
        if sid in NO_TOUCH: continue
        exact = find_source(sid, roots[1:]) if sid not in ("tt_dead_end_rainbow", "tt_ice_blade") else None
        if exact: plan[sid] = ("exact", exact)
        elif sid in MAP: plan[sid] = ("map", MAP[sid])
    for sid, (kind, src) in plan.items():
        iid = f"etheria:{sid}"; gid = f"geometry.etheria_w_{sid}"; texrel = f"textures/attachable/w_{sid}"
        att_p = os.path.join(RP, f"attachables/w_{sid}.attachable.json"); geo_p = os.path.join(RP, f"models/entity/etheria_w_{sid}.geo.json")
        icon_p = os.path.join(RP, f"textures/items/etheria_{sid}.png")
        try:
            if kind == "map" and src.startswith("@icon:"):          # arco: só o ícone (o arco do jogo cuida da animação de puxar)
                icon_save(sprite(TA, src[6:]), icon_p); done.append((sid, src)); continue
            if kind == "map" and src.startswith("@geo:"):           # modelo Bedrock do próprio mod (GeckoLib)
                name = src[5:]; g = json.load(open(os.path.join(TA, f"geo/items/{name}.geo.json")))["minecraft:geometry"][0]
                tex = Image.open(os.path.join(TA, f"textures/item/{name}_model.png")).convert("RGBA")
                R = resolve(os.path.join(TA, f"models/item/{name}_model.json"), roots) if os.path.exists(os.path.join(TA, f"models/item/{name}_model.json")) else {"display": {}}
                k = disp_scale(R, "thirdperson_righthand", 0.85); kf = disp_scale(R, "firstperson_righthand", k * 0.8)
                cubes = [c for b in g["bones"] for c in b.get("cubes", [])]
                ys = [c["origin"][1] for c in cubes] + [c["origin"][1] + c["size"][1] for c in cubes]
                y0 = min(ys) + (max(ys) - min(ys)) * 0.14
                xs = [c["origin"][0] + c["size"][0] / 2 for c in cubes]; zs = [c["origin"][2] + c["size"][2] / 2 for c in cubes]
                cx, cz = sum(xs) / len(xs), sum(zs) / len(zs)
                out = []
                for c in cubes:
                    c2 = json.loads(json.dumps(c)); c2["origin"] = [c["origin"][0] - cx, c["origin"][1] - y0, c["origin"][2] - cz]
                    if "pivot" in c2: c2["pivot"] = [c["pivot"][0] - cx, c["pivot"][1] - y0, c["pivot"][2] - cz]
                    out.append(c2)
                tex.save(os.path.join(RP, texrel + ".png")); G = geo(gid, scale_cubes(out, k), g["description"]["texture_width"], g["description"]["texture_height"], [0, 0, 0])
                icon_save(sprite(TA, name), icon_p); fp[sid] = kf / k
            elif kind == "map" and src.startswith("@java:"):        # modelo Java (elementos) do Tensura
                name = src[6:]; tex = Image.open(os.path.join(TA, f"textures/item/{name}_model.png")).convert("RGBA")
                R = resolve(os.path.join(TA, f"models/item/{name}_model.json"), roots)
                k = disp_scale(R, "thirdperson_righthand", 0.85); kf = disp_scale(R, "firstperson_righthand", 0.68)
                m = java_model(os.path.join(TA, f"models/item/{name}_model.json"), tex.size[0], tex.size[1])
                tex.save(os.path.join(RP, texrel + ".png")); G = geo(gid, scale_cubes(m.cubes, k), m.tw, m.th, [0, 0, 0])
                icon_save(sprite(TA, name), icon_p); fp[sid] = kf / k
            else:
                path = src if kind == "exact" else os.path.join(TA, f"models/item/{src}.json")
                R = resolve(path, roots) if os.path.exists(path) else {"textures": {"layer0": (f"tensura:item/{src}", "tensura")}, "display": {}, "elements": None, "gui": None}
                if not os.path.exists(path): R["display"] = {"thirdperson_righthand": {"scale": [scale_of(src)] * 3}, "firstperson_righthand": {"scale": [0.68] * 3}}
                k = disp_scale(R, "thirdperson_righthand", 0.85); kf = disp_scale(R, "firstperson_righthand", 0.68)
                fp[sid] = kf / k
                if R["elements"]:                                     # modelo 3D Java do mod de origem
                    texs = [v for kk, v in R["textures"].items() if kk != "particle"]
                    tp_ = tex_of(texs[0], roots); tex = Image.open(tp_).convert("RGBA")
                    tmp = os.path.join(os.path.dirname(__file__), ".tmp_model.json")
                    json.dump({"elements": R["elements"], "texture_size": R["texture_size"] or [16, 16]}, open(tmp, "w"))
                    ts = R["texture_size"] or [16, 16]
                    m = java_model(tmp, ts[0], ts[1]); os.remove(tmp)
                    m.cubes = scale_cubes(m.cubes, k)                     # escala de mão do próprio modelo (display)
                    tex.save(os.path.join(RP, texrel + ".png")); G = geo(gid, m.cubes, m.tw, m.th, [0, 0, 0])
                    if len(set(v[0] for v in texs)) > 1: print("aviso: várias texturas em", sid, texs)
                    try: gui_im = first_frame(tex_of(R["gui"], roots)) if R["gui"] else None
                    except FileNotFoundError: gui_im = None
                    if gui_im: icon_save(gui_im, icon_p)
                    else:
                        it = tex.copy(); M2 = Model(m.tw, m.th); M2.cubes = m.cubes
                        render_icon(M2, it, size=160, view=(-78, 14, -45), fill=0.97, outline=9).save(icon_p)
                else:                                                 # imagem do mod extrudada (como o Java segura o item)
                    im = first_frame(tex_of(R["textures"]["layer0"], roots))
                    gsrc = os.path.basename(path)
                    cubes = extrude(im, k, grip_frac(gsrc))
                    im.save(os.path.join(RP, texrel + ".png")); G = geo(gid, cubes, im.width, im.height, [45, 0, 0])
                    try: icon = first_frame(tex_of(R["gui"], roots)) if R["gui"] else im
                    except FileNotFoundError: icon = im
                    icon_save(icon, icon_p)
            json.dump(G, open(geo_p, "w"), indent=1)
            json.dump(attachable(iid, gid, texrel), open(att_p, "w"), indent=1)
            done.append((sid, kind, os.path.relpath(src, os.path.dirname(os.path.dirname(src))) if kind == "exact" else src))
        except (FileNotFoundError, TypeError, KeyError) as e:
            skipped.append((sid, src, repr(e)[-80:]))
    json.dump({sid: (os.path.relpath(src, roots[1]) if kind == "exact" and len(roots) > 1 and src.startswith(roots[1]) else src) for sid, (kind, src) in plan.items()},
              open(os.path.join(os.path.dirname(__file__), "mod_weapons.json"), "w"), indent=1)
    json.dump({k: round(v, 3) for k, v in fp.items()}, open(os.path.join(os.path.dirname(__file__), "weapon_fp.json"), "w"), indent=1)
    for d in done: print(*d)
    print(len(done), "armas iguais ao mod;", len(skipped), "puladas:", skipped)
    import weapon_bind; weapon_bind.main()   # 6.42: liga a arma ao osso da mão + animações de 1ª/3ª pessoa
if __name__ == "__main__": main(sys.argv[1], sys.argv[2:])

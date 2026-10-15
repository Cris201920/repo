# 6.36 - Armaduras com o detalhe do Tensura (modelos GeckoLib = formato de geometria do Bedrock; uso pessoal do jogador).
# Converte geo/armor/*.geo.json do mod em uma geometria Bedrock POR PEÇA (capacete/peitoral/calça/botas), com os ossos do jogador
# (head/body/rightArm/...), e aplica nos conjuntos do addon que NÃO estão em armors.KEEP_ORIGINAL.
import json, os, sys, math
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from swords import Model, render_icon
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
REN = {"bipedHead": "head", "bipedBody": "body", "bipedLeftArm": "leftArm", "bipedRightArm": "rightArm", "bipedLeftLeg": "leftLeg", "bipedRightLeg": "rightLeg"}
PIECE = {"helmet": {"armorHead"}, "chest": {"armorBody", "armorLeftArm", "armorRightArm"}, "legs": {"armorLeftLeg", "armorRightLeg"}, "boots": {"armorLeftBoot", "armorRightBoot"}}
VIS = {"helmet": "helmet_layer_visible", "chest": "chest_layer_visible", "legs": "leg_layer_visible", "boots": "boot_layer_visible"}

def box_faces(c):
    """UV de caixa (Bedrock) -> UV por face, para o renderizador de ícones"""
    u, v = c["uv"]; w, h, d = c["size"]; w2, h2, d2 = [math.floor(x) if x >= 1 else (1 if x > 0 else 0) for x in (w, h, d)]
    w2, h2, d2 = int(round(w)), int(round(h)), int(round(d))
    mir = c.get("mirror", False)
    f = {"east": [u, v + d2, d2, h2], "north": [u + d2, v + d2, w2, h2], "west": [u + d2 + w2, v + d2, d2, h2], "south": [u + 2 * d2 + w2, v + d2, w2, h2],
         "up": [u + d2, v, w2, d2], "down": [u + d2 + w2, v + d2, w2, -d2]}
    if mir: f["east"], f["west"] = f["west"], f["east"]
    return {k: {"uv": [a[0] + (a[2] if mir else 0), a[1]], "uv_size": [-a[2] if mir else a[2], a[3]]} for k, a in f.items()}

def load(path):
    g = json.load(open(path)); d = g["minecraft:geometry"][0]; return d

def subtree(bones, keep):
    """ossos de `keep`, todos os descendentes e a cadeia de ancestrais (sem cubos nos ancestrais que não são de armadura)"""
    byname = {b["name"]: b for b in bones}
    parent = {b["name"]: b.get("parent") for b in bones}
    sel = set()
    for b in bones:
        n = b["name"]; p = n
        while p:
            if p in keep: sel.add(n); break
            p = parent.get(p)
    anc = set()
    for n in list(sel):
        p = parent.get(n)
        while p: anc.add(p); p = parent.get(p)
    out = []
    for b in bones:
        n = b["name"]
        if n in sel: out.append(dict(b))
        elif n in anc: b2 = {k: v for k, v in b.items() if k != "cubes"}; out.append(b2)
    for b in out:
        b["name"] = REN.get(b["name"], b["name"])
        if b.get("parent"): b["parent"] = REN.get(b["parent"], b["parent"])
    # 6.37: os ossos do jogador (head/body/braços/pernas) ficam na RAIZ. No GeckoLib eles vinham dentro de grupos ("Arms", "Legs"),
    # e o Bedrock só acompanha o osso com o nome do jogador quando ele não está pendurado num grupo próprio -> a armadura
    # ficava parada/deslocada enquanto o personagem andava. Grupos vazios (sem cubos) somem.
    SKEL = set(REN.values()); names = {b["name"] for b in out}
    groups = {b["name"] for b in out if b["name"] not in SKEL and not b.get("cubes") and any(c.get("parent") == b["name"] and c["name"] in SKEL for c in out)}
    res = []
    for b in out:
        if b["name"] in groups: continue
        if b["name"] in SKEL: b.pop("parent", None); b.pop("rotation", None)
        elif b.get("parent") in groups: b["parent"] = None
        res.append(b)
    return res

def piece_geo(d, gid, part):
    bones = subtree(d["bones"], PIECE[part])
    return {"format_version": "1.12.0", "minecraft:geometry": [{"description": {"identifier": gid, "texture_width": d["description"]["texture_width"],
            "texture_height": d["description"]["texture_height"], "visible_bounds_width": 3, "visible_bounds_height": 3.5, "visible_bounds_offset": [0, 1.25, 0]}, "bones": bones}]}

def model_of(d, keep=None):
    """modelo achatado para o ícone (aplica as rotações de osso só como rotação de cubo quando o osso não tem cubos girados)"""
    m = Model(d["description"]["texture_width"], d["description"]["texture_height"])
    bones = subtree(d["bones"], keep) if keep else d["bones"]
    for b in bones:
        for c in b.get("cubes", []):
            faces = box_faces(c) if isinstance(c.get("uv"), list) else c["uv"]
            o = list(c["origin"]); s = list(c["size"]); inf = c.get("inflate", 0)
            o = [o[k] - inf for k in range(3)]; s = [s[k] + 2 * inf for k in range(3)]
            rot = c.get("rotation"); pv = c.get("pivot")
            if not rot and b.get("rotation") and any(b["rotation"]): rot, pv = b["rotation"], b.get("pivot", [0, 0, 0])
            m.box(o, s, faces, rot, pv)
    return m

if __name__ == "__main__" and sys.argv[1] == "preview":
    TA = sys.argv[2]; out = sys.argv[3]
    names = [f[:-9] for f in sorted(os.listdir(os.path.join(TA, "geo/armor"))) if "mask" not in f and "chef" not in f and "special" not in f]
    sheet = Image.new("RGBA", (len(names) * 150, 190), (70, 74, 82, 255))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        d = load(os.path.join(TA, "geo/armor", n + ".geo.json"))
        base = n.replace("_armor", "").replace("_set", "")
        cand = [f for f in os.listdir(os.path.join(TA, "textures/models/armor")) if f.startswith(base) and f.endswith(".png") and "overlay" not in f]
        tex = Image.open(os.path.join(TA, "textures/models/armor", sorted(cand)[0])).convert("RGBA") if cand else Image.new("RGBA", (64, 64), (200, 0, 200, 255))
        m = model_of(d)
        sheet.alpha_composite(render_icon(m, tex, size=150, view=(200, 10, 0)), (i * 150, 0)); dr.text((i * 150 + 4, 170), n[:22], fill=(255, 255, 255))
    sheet.save(out); print(names)

# ------------------------------------------------------------------ aplicação nos conjuntos do addon
MAP = {   # 6.41: IDÊNTICO AO MOD — cada conjunto usa uma armadura do Tensura com as cores e a textura originais (sem recolorir, sem suavizar)
  "iron_reinforced": ("low_magisteel_armor", False), "knight": ("high_magisteel_armor", False), "arcane": ("pure_magisteel_armor", False),
  "celestial": ("holy_armaments_armor", False), "archevoker": ("orichalcum_armor", False), "plagued": ("armoursaurus_armor", False),
  "void": ("hihiirokane_armor", False), "shadow": ("adamantite_armor", False), "rimuru_outfit": ("dark_set", False),
  # armaduras de CAMADA do mod (modelo padrão de armadura do jogo + textura layer_1/layer_2 do mod)
  "pyromancer": ("layer:ant_carapace", False), "cultist": ("layer:knight_spider_carapace", False), "shadowwalker": ("layer:serpent_scalemail", False),
}
IDENTICAL = True   # True = textura e ícone exatamente como no mod (pixel a pixel)
VANILLA_GEO = {"helmet": "geometry.humanoid.armor.helmet", "chest": "geometry.humanoid.armor.chestplate", "legs": "geometry.humanoid.armor.leggings", "boots": "geometry.humanoid.armor.boots"}
# peças que o modelo do conjunto não tem (ex.: Holy Armaments não tem capacete) usam a peça de outro modelo, com textura própria
PART_OVERRIDE = {("celestial", "helmet"): "pure_magisteel_armor"}
ICON = {"helmet": "helmet", "chest": "chestplate", "legs": "leggings", "boots": "boots"}
import colorsys
from PIL import ImageFilter
def smooth(im, k):
    big = im.resize((im.width * k, im.height * k), Image.NEAREST)
    rgb = big.convert("RGB").filter(ImageFilter.GaussianBlur(k * 0.32)).filter(ImageFilter.UnsharpMask(radius=k, percent=90, threshold=2))
    out = rgb.convert("RGBA"); out.putalpha(big.split()[3]); return out
def recolor(im, rgb, sat_min=0.12, trim=None):
    if trim is not None and colorsys.rgb_to_hsv(*[x / 255 for x in rgb])[1] < 0.25:   # base quase cinza: matiz vem do detalhe do conjunto
        th_, ts_, _ = colorsys.rgb_to_hsv(*[x / 255 for x in trim]); _, _, tv_ = colorsys.rgb_to_hsv(*[x / 255 for x in rgb])
        R, G, B = colorsys.hsv_to_rgb(th_, ts_ * 0.45, tv_); rgb = (int(R * 255), int(G * 255), int(B * 255))
    th, ts, tv = colorsys.rgb_to_hsv(*[x / 255 for x in rgb]); out = im.copy(); px = out.load()
    vs = [colorsys.rgb_to_hsv(*(c / 255 for c in px[x, y][:3]))[2] for y in range(im.height) for x in range(im.width) if px[x, y][3] > 20]
    gain = max(0.3, min(1.6, (tv * 1.15) / max(0.05, sum(vs) / max(1, len(vs)))))   # brilho médio do modelo -> brilho da cor do conjunto
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s < sat_min and v > 0.92 and tv > 0.55: continue   # só em conjuntos claros os brilhos fortes ficam brancos
            s2 = max(s, ts * 0.85); v2 = v * gain
            R, G, B = colorsys.hsv_to_rgb(th, min(1, s2), min(1, v2)); px[x, y] = (int(R * 255), int(G * 255), int(B * 255), a)
    return out
def texture_of(TA, model):
    base = model.replace("_armor", "").replace("_set", "")
    cand = sorted(f for f in os.listdir(os.path.join(TA, "textures/models/armor")) if f.startswith(base) and f.endswith(".png") and "overlay" not in f)
    return Image.open(os.path.join(TA, "textures/models/armor", cand[0])).convert("RGBA")
def apply(TA):
    from armors import SETS as ASETS
    sys.path.insert(0, os.path.dirname(__file__))
    itx = json.load(open(os.path.join(RP, "textures/item_texture.json")))
    hide = "!(c.owning_entity->q.property('etheria:lform') == 'true' || c.owning_entity->q.property('etheria:lform') == 'draconic')"
    done = []
    for sid, (model, rec) in MAP.items():
        if model.startswith("layer:"):
            base = model[6:]
            for part in ("helmet", "chest", "legs", "boots"):
                att = os.path.join(RP, f"attachables/{sid}_{part}.attachable.json")
                if not os.path.exists(att): continue
                layer = "2" if part == "legs" else "1"
                src = os.path.join(TA, f"textures/models/armor/{base}_layer_{layer}.png")
                texrel = f"textures/models/armor/etheria_t_{sid}_{layer}"
                Image.open(src).convert("RGBA").save(os.path.join(RP, texrel + ".png"))
                a = json.load(open(att)); desc = a["minecraft:attachable"]["description"]
                desc["geometry"] = {"default": VANILLA_GEO[part]}; desc["textures"]["default"] = texrel
                desc["materials"] = {"default": "armor", "enchanted": "armor_enchanted"}; desc["scripts"] = {"parent_setup": f"variable.{VIS[part]} = 0.0;"}
                desc["render_controllers"] = [{"controller.render.armor": hide}]; desc.pop("animations", None)
                json.dump(a, open(att, "w"), indent=1)
                ip = os.path.join(TA, "textures/item", f"{base}_{ICON[part]}.png")
                icon_p = os.path.join(RP, f"textures/items/etheria_{sid}_{part}.png")
                if os.path.exists(ip): ic = Image.open(ip).convert("RGBA"); ic.crop((0, 0, ic.width, ic.width)).resize((ic.width * 4, ic.width * 4), Image.NEAREST).save(icon_p)
                itx["texture_data"][f"etheria_{sid}_{part}"] = {"textures": f"textures/items/etheria_{sid}_{part}"}
                done.append(f"{sid}_{part}")
            continue
        d = load(os.path.join(TA, "geo/armor", model + ".geo.json"))
        tex = texture_of(TA, model); col = ASETS[sid][0] if sid in ASETS else None
        if rec and col: tex = recolor(tex, col, trim=ASETS[sid][2])
        if not IDENTICAL: tex = smooth(tex, 4)
        tex.save(os.path.join(RP, f"textures/models/armor/etheria_t_{sid}.png"))
        for part in ("helmet", "chest", "legs", "boots"):
            att = os.path.join(RP, f"attachables/{sid}_{part}.attachable.json")
            if not os.path.exists(att): continue
            gid = f"geometry.etheria_t_{sid}_{part}"
            dpart, texrel = d, f"textures/models/armor/etheria_t_{sid}"
            if (sid, part) in PART_OVERRIDE:
                om = PART_OVERRIDE[(sid, part)]; dpart = load(os.path.join(TA, "geo/armor", om + ".geo.json"))
                ot = texture_of(TA, om); ot = ot if IDENTICAL else smooth(ot, 4); texrel = f"textures/models/armor/etheria_t_{sid}_{part}"; ot.save(os.path.join(RP, texrel + ".png"))
            g = piece_geo(dpart, gid, part)
            if not any(b.get("cubes") for b in g["minecraft:geometry"][0]["bones"]): continue
            json.dump(g, open(os.path.join(RP, f"models/entity/etheria_t_{sid}_{part}.geo.json"), "w"), indent=1)
            a = json.load(open(att)); desc = a["minecraft:attachable"]["description"]
            desc["geometry"] = {"default": gid}; desc["textures"]["default"] = texrel
            desc["materials"] = {"default": "armor", "enchanted": "armor_enchanted"}; desc["scripts"] = {"parent_setup": f"variable.{VIS[part]} = 0.0;"}
            desc["render_controllers"] = [{"controller.render.armor": hide}]; desc.pop("animations", None)
            json.dump(a, open(att, "w"), indent=1)
            # ícone: o pixel art do próprio mod (recolorido junto) ou, se não houver, o modelo renderizado
            mdl = PART_OVERRIDE.get((sid, part), model)
            src = os.path.join(TA, "textures/item", f"{mdl.replace('_armor', '').replace('_set', '').replace('_scalemail', '_scalemail')}_{ICON[part]}.png")
            icon_p = os.path.join(RP, f"textures/items/etheria_{sid}_{part}.png")
            if os.path.exists(src):
                ic = Image.open(src).convert("RGBA"); ic = ic.crop((0, 0, ic.width, ic.width))
                if rec and col: ic = recolor(ic, col, trim=ASETS[sid][2])
                (ic.resize((ic.width * 4, ic.width * 4), Image.NEAREST) if IDENTICAL else smooth(ic.resize((16, 16), Image.NEAREST), 6)).save(icon_p)
            else:
                render_icon(model_of(d, PIECE[part]), tex, size=96, view=(200, 12, 0)).save(icon_p)
            itx["texture_data"][f"etheria_{sid}_{part}"] = {"textures": f"textures/items/etheria_{sid}_{part}"}
            done.append(f"{sid}_{part}")
    json.dump(itx, open(os.path.join(RP, "textures/item_texture.json"), "w"), indent=1, ensure_ascii=False)
    print(len(done), "peças com modelo detalhado")
    import armor_fix; armor_fix.main()   # 6.42: lado dos braços + pivôs iguais ao jogador do Bedrock
if __name__ == "__main__" and sys.argv[1] == "apply": apply(sys.argv[2])

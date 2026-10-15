# 6.36 - Conjuntos de Tensura com MODELO PRÓPRIO (não é recolor de armadura vanilla):
#   rimuru  = Traje de Rimuru Tempest (casaco longo preto com detalhes dourados, camisa, colarinho alto, abas, calça, botas)
#   milim   = Armadura Berserker de Milim Nava (tiara + rabos de cavalo, peitoral, ombreiras, braçadeiras, saiote de placas, grevas, botas)
# Gera: RP (geometria por peça, attachable, textura do conjunto, ícones, item_texture), BP (itens, receitas de bancada) e
# os dados de script (items.gen.js, SET_DEFS/FORGE/REPAIR_MAT em armor.gen.js). Rodar de novo é seguro (substitui as próprias entradas).
import json, math, os, random, re, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from swords import Model, render_icon

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP, BP = os.path.join(ROOT, "LegacyOfEtheria_RP"), os.path.join(ROOT, "LegacyOfEtheria_BP")
TW = TH = 64
# ------------------------------------------------------------------ atlas de materiais (16x16 cada)
SW = {  # nome: (col, lin, cor base, padrão)
  "coat": (0, 0, (24, 24, 32), "cloth"), "gold": (1, 0, (226, 182, 72), "metal"), "shirt": (2, 0, (226, 230, 238), "cloth"), "pants": (3, 0, (34, 36, 46), "cloth"),
  "leather": (0, 1, (30, 26, 28), "leather"), "blue": (1, 1, (70, 150, 230), "cloth"), "plate": (2, 1, (28, 22, 30), "plate"), "red": (3, 1, (176, 30, 48), "plate"),
  "pink": (0, 2, (246, 140, 186), "hair"), "steel": (1, 2, (150, 150, 166), "metal"), "gem": (2, 2, (240, 50, 90), "gem"), "lining": (3, 2, (60, 90, 150), "cloth"),
  "bluegem": (0, 3, (90, 200, 255), "gem"), "wing": (1, 3, (40, 30, 44), "plate"), "skin": (2, 3, (60, 54, 64), "leather"), "white": (3, 3, (240, 240, 246), "metal"),
}
def mul(c, f): return tuple(max(0, min(255, int(v * f))) for v in c)
def paint():
    im = Image.new("RGBA", (TW, TH), (0, 0, 0, 255)); px = im.load(); rnd = random.Random(7)
    for name, (cx, cy, base, pat) in SW.items():
        for y in range(16):
            for x in range(16):
                n = rnd.uniform(-1, 1); f = 1 + 0.05 * n
                if pat == "cloth": f *= 1 + 0.07 * (((x + y) % 4 == 0) - ((x - y) % 4 == 0))
                if pat == "leather": f *= 0.9 + 0.12 * math.sin(x * 1.3 + y * 0.7) ** 2
                if pat == "metal": f *= 0.78 + 0.45 * (1 - y / 15) + (0.25 if x == 3 else 0)
                if pat == "plate": f *= (0.85 + 0.35 * (1 - y / 15)) * (0.75 if x in (0, 15) or y in (0, 15) else 1) * (1.25 if (x, y) in ((3, 3), (12, 3), (3, 12), (12, 12)) else 1)
                if pat == "hair": f *= 0.82 + 0.3 * math.sin(x * 0.9) ** 2
                if pat == "gem": r = math.hypot(x - 7.5, y - 7.5) / 8; f = 1.6 - r; f *= 1.15 if (x // 4 + y // 4) % 2 else 0.95
                c = mul(base, f)
                if pat == "gem" and (x - 5) ** 2 + (y - 5) ** 2 < 3: c = (255, 255, 255)
                px[cx * 16 + x, cy * 16 + y] = c + (255,)
    return im
def F(mat, faces=None):
    cx, cy = SW[mat][0] * 16, SW[mat][1] * 16
    return {k: {"uv": [cx + 1, cy + 1], "uv_size": [14, 14]} for k in (faces or ("north", "south", "east", "west", "up", "down"))}

# ------------------------------------------------------------------ peças: lista de (osso, origem, tamanho, material, rot, pivot)
def B(bone, o, s, mat, rot=None, pv=None): return (bone, o, s, mat, rot, pv)
def rimuru_chest():
    c = []
    for sx, bone in ((-1, "armorRightArm"), (1, "armorLeftArm")):   # mangas largas com punho dobrado e friso dourado
        x0 = -8.5 if sx < 0 else 4.0
        c += [B(bone, [x0, 11.5, -2.5], [4.5, 12.6, 5], "coat"),
              B(bone, [x0 - 0.3, 11.2, -2.8], [5.1, 2.2, 5.6], "coat"), B(bone, [x0 - 0.35, 13.3, -2.85], [5.2, 0.4, 5.7], "gold"),
              B(bone, [x0 - 0.2, 21.4, -2.7], [4.9, 0.4, 5.4], "gold")]
    c += [B("armorBody", [-4.5, 11.5, -2.5], [9, 12.6, 5], "coat"),                      # casaco
          B("armorBody", [-1.6, 15.5, -2.62], [3.2, 8.3, 0.2], "shirt"),                # camisa (abertura em V)
          B("armorBody", [-0.35, 20.5, -2.75], [0.7, 0.7, 0.2], "bluegem"),             # broche
          B("armorBody", [-1.95, 11.5, -2.7], [0.35, 12.4, 0.2], "gold"), B("armorBody", [1.6, 11.5, -2.7], [0.35, 12.4, 0.2], "gold"),   # vivos da frente
          B("armorBody", [-4.7, 13.4, -2.7], [9.4, 1.3, 5.4], "leather"), B("armorBody", [-0.7, 13.3, -2.85], [1.4, 1.5, 0.25], "gold"),   # cinto + fivela
          B("armorBody", [-4.7, 23.6, 1.4], [9.4, 2.6, 1.2], "coat"),                   # colarinho alto (atrás)
          B("armorBody", [-4.7, 23.6, -2.7], [1.3, 2.4, 4.4], "coat"), B("armorBody", [3.4, 23.6, -2.7], [1.3, 2.4, 4.4], "coat"),
          B("armorBody", [-4.75, 25.9, 1.35], [9.5, 0.35, 1.3], "gold"),
          B("armorBody", [-3.6, 17.5, -2.75], [1.7, 6, 0.3], "lining", [0, 0, -12], [-2.8, 23.5, -2.6]),   # lapelas (forro azul)
          B("armorBody", [1.9, 17.5, -2.75], [1.7, 6, 0.3], "lining", [0, 0, 12], [2.8, 23.5, -2.6])]
    for sx in (-1, 1):   # abas do casaco até o joelho (frente aberta, trás inteira) com barra dourada
        x0 = -4.6 if sx < 0 else 0.3
        c += [B("armorBody", [x0, 3.8, 1.6], [4.3, 7.8, 0.8], "coat", [10, 0, 0], [0, 11.6, 2]),
              B("armorBody", [x0, 3.6, 1.55], [4.3, 0.45, 0.9], "gold", [10, 0, 0], [0, 11.6, 2]),
              B("armorBody", [x0 if sx < 0 else 2.9, 4.2, -2.75], [1.7, 7.4, 0.6], "coat", [-8, 0, 0], [0, 11.6, -2.5]),
              B("armorBody", [-4.75 if sx < 0 else 4.15, 4.4, -2.4], [0.6, 7.2, 4.4], "coat", [0, 0, sx * 6], [sx * 4.4, 11.6, 0])]
    return c
def rimuru_legs():
    c = [B("armorLeggingTorsoLayer", [-4.3, 11.6, -2.3], [8.6, 1.4, 4.6], "pants")]
    for sx, bone in ((-1, "armorRightLeg"), (1, "armorLeftLeg")):
        x0 = -4.2 if sx < 0 else -0.2
        c += [B(bone, [x0, 3, -2.35], [4.4, 9.2, 4.7], "pants"), B(bone, [x0 + (0 if sx < 0 else 4.15), 3.2, -0.3], [0.25, 8.8, 0.6], "blue")]
    return c
def rimuru_boots():
    c = []
    for sx, bone in ((-1, "armorRightBoot"), (1, "armorLeftBoot")):
        x0 = -4.3 if sx < 0 else -0.3
        c += [B(bone, [x0, -0.25, -2.55], [4.6, 4.8, 5.1], "leather"), B(bone, [x0 - 0.2, 4.2, -2.75], [5.0, 1.2, 5.5], "leather"),
              B(bone, [x0 + 0.1, -0.25, -3.35], [4.4, 1.6, 0.9], "leather"), B(bone, [x0 - 0.25, 4.6, -2.8], [5.1, 0.35, 5.6], "gold")]
    return c
def milim_helmet():
    c = [B("armorHead", [-4.3, 30.2, -4.65], [8.6, 1.1, 0.6], "gold"), B("armorHead", [-0.8, 30.5, -4.9], [1.6, 1.6, 0.4], "gem"),   # tiara
         B("armorHead", [-4.55, 29.5, -4.4], [0.5, 1.5, 8.5], "gold"), B("armorHead", [4.05, 29.5, -4.4], [0.5, 1.5, 8.5], "gold")]
    for sx in (-1, 1):
        x = 4.4 if sx > 0 else -6.4
        c += [B("armorHead", [x, 27.6, -0.4], [2.0, 2.4, 2.0], "plate"), B("armorHead", [x + 0.4, 28.2, -0.6], [1.2, 1.2, 0.3], "gem"),   # prendedores
              B("armorHead", [x + 0.1, 30, 0], [0.5, 3.2, 1.6], "wing", [0, 0, -sx * 35], [x + 1, 30, 0.6]),   # asinhas
              B("armorHead", [x + 0.1, 18.5, 0.1], [1.8, 9.4, 1.8], "pink", [8, 0, sx * 9], [x + 1, 28, 1]),   # rabo de cavalo
              B("armorHead", [x + 0.3, 15.8, 0.6], [1.4, 3, 1.4], "pink", [14, 0, sx * 12], [x + 1, 19, 1.2])]
    c += [B("armorHead", [-4.4, 31.4, -1.2], [0.8, 2.6, 0.8], "plate", [0, 0, 25], [-4, 31.4, -0.8]), B("armorHead", [3.6, 31.4, -1.2], [0.8, 2.6, 0.8], "plate", [0, 0, -25], [4, 31.4, -0.8])]   # chifres pequenos
    return c
def milim_chest():
    c = [B("armorBody", [-4.6, 11.6, -2.6], [9.2, 12.5, 5.2], "plate"),
         B("armorBody", [-3.8, 15.8, -2.95], [7.6, 7.2, 0.45], "red"), B("armorBody", [-4.0, 22.8, -3.0], [8.0, 0.4, 0.5], "gold"),
         B("armorBody", [-0.8, 18.6, -3.2], [1.6, 1.6, 0.35], "gem"),
         B("armorBody", [-4.8, 12.0, -2.8], [9.6, 1.4, 5.6], "gold"),                    # cinto
         B("armorBody", [-2.4, 15.5, 2.5], [4.8, 7, 0.6], "red")]                         # placa das costas
    for k, (x0, rz) in enumerate(((-4.7, 8), (-1.4, 0), (1.9, -8))):   # saiote de placas (frente e trás)
        c += [B("armorBody", [x0, 6.8, -2.95], [2.9, 5.4, 0.45], "red" if k != 1 else "plate", [-12, 0, rz], [x0 + 1.45, 12.2, -2.7]),
              B("armorBody", [x0, 6.8, 2.5], [2.9, 5.4, 0.45], "plate", [12, 0, -rz], [x0 + 1.45, 12.2, 2.7])]
    for sx, bone in ((-1, "armorRightArm"), (1, "armorLeftArm")):
        x0 = -9.6 if sx < 0 else 3.8
        c += [B(bone, [x0, 20.6, -3.2], [5.8, 2.6, 6.4], "plate"), B(bone, [x0 - 0.2, 20.2, -3.4], [6.2, 0.6, 6.8], "red"),   # ombreira
              B(bone, [x0 + 1.2, 23.0, -0.6], [1.0, 2.6, 1.0], "gold", [0, 0, -sx * 20], [x0 + 1.7, 23, 0]),                     # espinhos
              B(bone, [x0 + 3.2, 22.8, -0.5], [0.8, 2.0, 0.8], "gold", [0, 0, -sx * 35], [x0 + 3.6, 22.8, 0]),
              B(bone, [x0 + 0.8, 11.3, -2.75], [4.9 - 0.4, 5.2, 5.5], "plate"), B(bone, [x0 + 0.6, 15.9, -2.95], [4.9, 0.6, 5.9], "red"),   # braçadeira
              B(bone, [x0 + 0.6, 11.0, -2.95], [4.9, 0.6, 5.9], "gold")]
    return c
def milim_legs():
    c = [B("armorLeggingTorsoLayer", [-4.3, 11.6, -2.3], [8.6, 1.4, 4.6], "plate")]
    for sx, bone in ((-1, "armorRightLeg"), (1, "armorLeftLeg")):
        x0 = -4.2 if sx < 0 else -0.2
        c += [B(bone, [x0, 3.2, -2.35], [4.4, 9.0, 4.7], "plate"), B(bone, [x0 + 0.5, 5.2, -2.85], [3.4, 2.6, 0.6], "red"), B(bone, [x0 + 1.4, 6.1, -3.0], [1.6, 0.9, 0.3], "gold")]
    return c
def milim_boots():
    c = []
    for sx, bone in ((-1, "armorRightBoot"), (1, "armorLeftBoot")):
        x0 = -4.3 if sx < 0 else -0.3
        c += [B(bone, [x0, -0.25, -2.6], [4.6, 5.2, 5.2], "plate"), B(bone, [x0 + 0.1, -0.25, -3.6], [4.4, 1.8, 1.1], "red"),
              B(bone, [x0 - 0.2, 4.6, -2.8], [5.0, 0.6, 5.6], "red"),
              B(bone, [x0 + (4.6 if sx > 0 else -0.6), 3.4, -0.5], [0.6, 2.4, 1.0], "gold", [0, 0, -sx * 30], [x0 + (4.6 if sx > 0 else 0), 3.4, 0])]
    return c

BONES = {   # osso -> (pai, pivô)
  "armorHead": ("head", [0, 24, 0]), "armorBody": ("body", [0, 24, 0]), "armorRightArm": ("rightArm", [-5, 22, 0]), "armorLeftArm": ("leftArm", [5, 22, 0]),
  "armorLeggingTorsoLayer": ("body", [0, 24, 0]), "armorRightLeg": ("rightLeg", [-2, 12, 0]), "armorLeftLeg": ("leftLeg", [2, 12, 0]),
  "armorRightBoot": ("rightLeg", [-2, 12, 0]), "armorLeftBoot": ("leftLeg", [2, 12, 0]),
}
ROOTS = {"head": [0, 24, 0], "body": [0, 24, 0], "rightArm": [-5, 22, 0], "leftArm": [5, 22, 0], "rightLeg": [-1.9, 12, 0], "leftLeg": [1.9, 12, 0]}
SLOT = {"helmet": ("slot.armor.head", "helmet_layer_visible", "Head"), "chest": ("slot.armor.chest", "chest_layer_visible", "Chest"),
        "legs": ("slot.armor.legs", "leg_layer_visible", "Legs"), "boots": ("slot.armor.feet", "boot_layer_visible", "Feet")}
SETS = {
  "rimuru_outfit": dict(name="Traje de Rimuru Tempest", sname="de Rimuru Tempest", col="§b", rarity="legendary", el="water", aura="ice", passive="arcane_ward",
      ptext="Proteção Arcana: Absorção II renovada.", mat="etheria:mana_crystal", core="etheria:celestial_crystal",
      parts={"chest": ("Casaco de Rimuru Tempest", rimuru_chest, 8, 620, {"vitality": 10, "intelligence": 10, "manaRegen": 14, "defense": 5}),
             "legs": ("Calça de Rimuru Tempest", rimuru_legs, 6, 520, {"vitality": 7, "agility": 8, "defense": 4}),
             "boots": ("Botas de Rimuru Tempest", rimuru_boots, 3, 440, {"agility": 8, "defense": 2})},
      bonus={"2": ({"intelligence": 4, "manaRegen": 6}, "+4 Inteligência, +6 Regeneração de Mana"), "3": ({"maxMana": 80, "defense": 4}, "+80 Mana, +4 Defesa")}),
  "milim_berserker": dict(name="Armadura Berserker de Milim Nava", sname="Berserker de Milim", col="§d", rarity="mythic", el="fire", aura="blood", passive="blood_pact",
      ptext="Pacto de Sangue: Força I quando a vida está abaixo de 50%.", mat="etheria:dragon_essence", core="etheria:demonite_shard",
      parts={"helmet": ("Tiara Berserker de Milim", milim_helmet, 4, 520, {"strength": 8, "crit": 6, "defense": 3}),
             "chest": ("Peitoral Berserker de Milim", milim_chest, 9, 760, {"strength": 14, "vitality": 10, "defense": 6}),
             "legs": ("Grevas Berserker de Milim", milim_legs, 7, 660, {"strength": 9, "agility": 6, "defense": 5}),
             "boots": ("Botas Berserker de Milim", milim_boots, 4, 560, {"agility": 9, "defense": 3})},
      bonus={"2": ({"strength": 6, "crit": 4}, "+6 Força, +4 Crítico"), "3": ({"hp": 30, "defense": 4}, "+30 Vida, +4 Defesa"), "4": ({"strength": 10, "agility": 6}, "+10 Força, +6 Agilidade")}),
}
RECIPE = {"helmet": ["CMC", "M M"], "chest": ["M M", "MCM", "MMM"], "legs": ["MCM", "M M", "M M"], "boots": ["C C", "M M"]}

def geo(gid, cubes):
    used = sorted({c[0] for c in cubes}, key=list(BONES).index)
    roots = sorted({BONES[b][0] for b in used}, key=list(ROOTS).index)
    bones = [{"name": r, "pivot": ROOTS[r]} for r in roots]
    for b in used:
        bones.append({"name": b, "parent": BONES[b][0], "pivot": BONES[b][1], "cubes": [
            dict({"origin": [round(v, 3) for v in c[1]], "size": [round(v, 3) for v in c[2]], "uv": F(c[3])}, **({"rotation": c[4], "pivot": c[5]} if c[4] else {})) for c in cubes if c[0] == b]})
    return {"format_version": "1.16.0", "minecraft:geometry": [{"description": {"identifier": gid, "texture_width": TW, "texture_height": TH,
            "visible_bounds_width": 3, "visible_bounds_height": 3.5, "visible_bounds_offset": [0, 1.25, 0]}, "bones": bones}]}
def attachable(iid, gid, tex, var):
    # some nas formas de dragão (lform true/draconic): a armadura não flutua dentro do modelo do dragão
    hide = "!(c.owning_entity->q.property('etheria:lform') == 'true' || c.owning_entity->q.property('etheria:lform') == 'draconic')"
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {"identifier": iid,
        "materials": {"default": "armor", "enchanted": "armor_enchanted"}, "textures": {"default": tex, "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": gid}, "scripts": {"parent_setup": f"variable.{var} = 0.0;"}, "render_controllers": [{"controller.render.armor": hide}]}}}

def js_block(key, obj, indent=1):
    body = json.dumps(obj, indent=1, ensure_ascii=False)
    return " " * indent + json.dumps(key) + ": " + body.replace("\n", "\n" + " " * indent)
def upsert(text, anchor_line, key, obj):
    """substitui (ou insere antes de anchor_line) a entrada `"key": {...},` de um objeto JS gerado"""
    blk = js_block(key, obj) + ",\n"
    m = re.search(r'^ ' + re.escape(json.dumps(key)) + r': \{.*?^ \},\n', text, flags=re.S | re.M)
    if m: return text[:m.start()] + blk + text[m.end():]
    i = text.index(anchor_line); return text[:i] + blk + text[i:]

def main():
    tex = paint()
    from tensura_armor import smooth
    hd = smooth(tex, 4); hd.save(os.path.join(RP, "textures/models/armor/etheria_tensura_outfits.png"))   # 6.36: alta resolução
    texrel = "textures/models/armor/etheria_tensura_outfits"
    itx = json.load(open(os.path.join(RP, "textures/item_texture.json")))
    items_f = os.path.join(BP, "scripts/data/items.gen.js"); items = open(items_f).read()
    arm_f = os.path.join(BP, "scripts/data/armor.gen.js"); arm = open(arm_f).read()
    forge = []
    for sid, S in SETS.items():
        pieces = []
        for part, (pname, fn, prot, dur, stats) in S["parts"].items():
            iid = f"etheria:{sid}_{part}"; short = f"{sid}_{part}"; gid = f"geometry.etheria_o_{short}"
            cubes = fn(); slot, var, sname = SLOT[part]
            tens = os.path.exists(os.path.join(RP, f"textures/models/armor/etheria_t_{sid}.png"))   # usa o modelo do Tensura (tools/tensura_armor.py)
            if not tens: json.dump(geo(gid, cubes), open(os.path.join(RP, f"models/entity/etheria_o_{short}.geo.json"), "w"), indent=1)
            if not tens: json.dump(attachable(iid, gid, texrel, var), open(os.path.join(RP, f"attachables/{short}.attachable.json"), "w"), indent=1)
            # ícone: o modelo da peça visto de frente, levemente girado
            m = Model(TW, TH)
            for c in cubes:   # pernas/botas levemente separadas no ícone (leitura no inventário)
                dx = -0.8 if "Right" in c[0] and part in ("legs", "boots") else 0.8 if "Left" in c[0] and part in ("legs", "boots") else 0
                m.box([c[1][0] + dx, c[1][1], c[1][2]], c[2], F(c[3]), c[4], [c[5][0] + dx, c[5][1], c[5][2]] if c[5] else None)
            ic = render_icon(m, hd, size=96, view=(205, 30 if part == "boots" else 14, 0))
            if not tens: ic.save(os.path.join(RP, f"textures/items/etheria_{short}.png"))
            itx["texture_data"][f"etheria_{short}"] = {"textures": f"textures/items/etheria_{short}"}
            item = {"format_version": "1.21.60", "minecraft:item": {"description": {"identifier": iid, "menu_category": {"category": "equipment"}},
                "components": {"minecraft:icon": {"textures": {"default": f"etheria_{short}"}}, "minecraft:display_name": {"value": f"{S['col']}{pname}"},
                    "minecraft:max_stack_size": 1, "minecraft:wearable": {"slot": slot, "protection": prot}, "minecraft:durability": {"max_durability": dur},
                    "minecraft:repairable": {"repair_items": [{"items": [S["mat"]], "repair_amount": "context.other->query.remaining_durability + 0.25 * context.other->query.max_durability"}]},
                    "minecraft:enchantable": {"slot": {"helmet": "armor_head", "chest": "armor_torso", "legs": "armor_legs", "boots": "armor_feet"}[part], "value": 12}}}}
            json.dump(item, open(os.path.join(BP, f"items/0420{list(SETS).index(sid)}_{short}.json"), "w"), indent=1, ensure_ascii=False)
            items = upsert(items, ' "etheria:dragotite_ingot": {', iid, {"id": iid, "name": pname, "rarity": S["rarity"], "kind": "armor", "stats": stats, "set": sid, "slot": sname,
                "price": dur * 10, "sell": dur * 2, "protection": prot, "durability": dur})
            rec = {"format_version": "1.20.10", "minecraft:recipe_shaped": {"description": {"identifier": f"etheria:{short}_recipe"}, "tags": ["crafting_table"],
                "pattern": RECIPE[part], "key": {"M": {"item": S["mat"]}, "C": {"item": S["core"]}}, "unlock": [{"item": S["core"]}], "result": {"item": iid, "count": 1}}}
            json.dump(rec, open(os.path.join(BP, f"recipes/{short}.json"), "w"), indent=1)
            forge.append({"id": short, "station": "divine_forge" if sid == "milim_berserker" else "magic_forge", "result": iid, "kind": "craft", "count": 1,
                          "mats": [[S["mat"], 5], [S["core"], 2]], "unlock": {"lvl": 45 if sid == "milim_berserker" else 30}})
            pieces.append(iid)
        arm = upsert(arm, ' "priest": {', sid, {"name": S["sname"], "tier": 5 if sid == "milim_berserker" else 4, "el": S["el"], "aura": S["aura"], "passive": S["passive"],
            "ptext": S["ptext"], "b": {k: {"stats": v[0], "text": v[1]} for k, v in S["bonus"].items()}, "pieces": pieces})
        arm = re.sub(r'(export const REPAIR_MAT = \{)', lambda mm: mm.group(1) + f'"{sid}": "{S["mat"]}", ' if f'"{sid}":' not in arm.split("export const REPAIR_MAT")[1] else mm.group(1), arm)
    # FORGE: troca as entradas deste gerador
    i = arm.index("export const FORGE = ["); j = arm.index("\n];", i)
    lst = json.loads(arm[i + len("export const FORGE = "):j + 3].rstrip(";"))
    lst = [f for f in lst if not f["id"].startswith(tuple(SETS))] + forge
    arm = arm[:i] + "export const FORGE = " + json.dumps(lst, indent=1, ensure_ascii=False) + ";" + arm[j + 3:]
    open(items_f, "w").write(items); open(arm_f, "w").write(arm)
    json.dump(itx, open(os.path.join(RP, "textures/item_texture.json"), "w"), indent=1, ensure_ascii=False)
    # folha de conferência
    sheet = Image.new("RGBA", (7 * 96, 96), (70, 74, 82, 255)); k = 0
    for sid, S in SETS.items():
        for part in S["parts"]:
            sheet.alpha_composite(Image.open(os.path.join(RP, f"textures/items/etheria_{sid}_{part}.png")).resize((96, 96), Image.NEAREST), (k * 96, 0)); k += 1
    if len(sys.argv) > 1: sheet.save(sys.argv[1])
    print("ok", k, "peças")
if __name__ == "__main__": main()

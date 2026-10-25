"""9.7 - RAÇAS COM CORPO HUMANO (até a forma Lord Demônio), SEM PERDER OS TRAÇOS RACIAIS.
O corpo do jogador é sempre o humanoide da skin (32 de altura, ombros 8+8); as raças só somam peças. O que deixava as formas "monstruosas" eram
as peças e escalas por cima dele. Este passo (idempotente) as deixa discretas, como os personagens do anime em forma humana:
  1) chifres: o pivô dos ossos de chifre que estava no centro da cabeça [0,24,0] vai para a BASE do chifre (a escala da animação agora encolhe
     o chifre no lugar, em vez de empurrá-lo para cima/fora) e a escala fica fixa por raça (Ogro 0.6, Demônio 0.85...; sem o x1.3-1.45 do Lorde);
  2) asas (corpo Etheria e Tensura): crescimento por estágio suavizado (0.85+0.07*tier -> 0.9+0.03*tier), Lorde no máximo +5% sobre a raça,
     Dragonoide/Dragonato/Vampiro com asas menores (0.8-0.85). Asas de partículas (Demônio/Caídos) não mudam;
  3) insígnia do Lorde: anel de espinhos/chamas/auréola atrás da cabeça a 70%; auréola dos anjos Lorde sem o x1.2;
  4) kits de corpo do Tensura: Lorde (5) sem a coroa de espinhos da cabeça (a coroa é a do modelo da raça), ombreiras menores e espinhos
     baixos; garras curtas (3, 4); presas do Oni pequenas (2); kit 6 (inseto, sem uso por estágio do jogador) vira o kit do ANÃO
     (barba trançada, bigode, cinto e ombreiras de couro), com 3 ladrilhos novos no atlas (mesmo tamanho 128x128);
  5) posturas (etheria_race_style): todas eretas e humanas (sem corcunda de fera/goblin/demônio, morto-vivo sem braços de zumbi).
Depois rode: python3 tools/split_race_anims.py
Uso: python3 tools/race_human_97.py"""
import json, os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SRC = os.path.join(ROOT, "tools/race_src/etheria_race_parts.animation.json")
MODELS = os.path.join(RP, "models/entity")
KITS = os.path.join(MODELS, "tensura/race/body_kits.geo.json"); KITS_TEX = os.path.join(RP, "textures/entity/tensura/race/body_kits.png")
TANIM = os.path.join(RP, "animations/tensura_race.animation.json"); STYLE = os.path.join(RP, "animations/etheria_race_style.animation.json")
HORN = re.compile(r"^horn2?_[lr]$")
PULSE = "(1 + math.sin(query.anim_time * 40) * 0.015)"
# escala final dos chifres por corpo (base e Lorde)
HORN_K = {"demon": 0.85, "demon_lord": 0.85, "fallen_lord": 0.9, "fallen_lord_lord": 0.9, "ogre": 0.6, "ogre_lord": 0.65,
          "dragonoid": 1.0, "dragonoid_lord": 1.0, "dragonewt": 1.0, "dragonewt_lord": 1.0, "dragonewt_w": 1.0, "dragonewt_w_lord": 1.0}
WING_CAP = {"dragonoid": 0.8, "dragonewt_w": 0.8, "vampire": 0.85}   # multiplicador máximo das asas da raça
LORD_WING = 1.05                                                       # Lorde: no máximo +5% sobre a raça
RING_K = 0.7                                                           # insígnia em anel atrás da cabeça
TIER_OLD, TIER_NEW = "(0.85 + 0.07 * query.property('etheria:tier'))", "(0.9 + 0.03 * query.property('etheria:tier'))"
WEXP = re.compile(r"^(?:([\d.]+) \* )?\((?:0\.85 \+ 0\.07|0\.9 \+ 0\.03) \* query\.property\('etheria:tier'\)\)$")

def base_of(body):
    return {"fallen_dl": "fallen", "fallen_lord_lord": "fallen_lord"}.get(body, body[:-5] if body.endswith("_lord") else body)

# ------------------------------------------------------------------ 1) pivô dos chifres na base
def horn_pivots():
    n = 0; rings = set()
    for f in sorted(os.listdir(MODELS)):
        if not (f.startswith("etheria_race_") and f.endswith(".geo.json")) or "_lin_" in f: continue
        p = os.path.join(MODELS, f); D = json.load(open(p)); ch = False
        for G in D["minecraft:geometry"]:
            for b in G["bones"]:
                if b["name"] == "lord_crown" and b.get("pivot") == [0, 30.5, 5.2]: rings.add(f[13:-9])
                if not HORN.match(b["name"]) or b.get("rotation") or not b.get("cubes"): continue
                if b.get("pivot") != [0, 24, 0]: continue
                c = min(b["cubes"], key=lambda c: c["origin"][1])
                b["pivot"] = [round(c["origin"][0] + c["size"][0] / 2, 3), round(c["origin"][1], 3), round(c["origin"][2] + c["size"][2] / 2, 3)]
                ch = True; n += 1
        if ch: json.dump(D, open(p, "w"), separators=(",", ":"))
    return n, rings

# ------------------------------------------------------------------ 2/3) animações das raças (fonte; o split grava os arquivos pequenos)
def wing_mult(v):
    s = v if isinstance(v, str) else None
    if s is None: return None
    m = WEXP.match(s.strip()); return (float(m.group(1)) if m and m.group(1) else 1.0) if m else None

def race_anims(rings):
    D = json.load(open(SRC)); A = D["animations"]; changed = 0
    key = lambda body: f"animation.etheria.race_{body}"
    def base_wing(body, bone):   # multiplicador (já limitado) das asas do corpo-base
        a = A.get(key(body), {}).get("bones", {}).get(bone, {})
        sc = a.get("scale"); v = sc[0] if isinstance(sc, list) else sc
        m = wing_mult(v); return min(m, WING_CAP.get(body, 9)) if m is not None else None
    for k, a in A.items():
        if not k.startswith("animation.etheria.race_") or k.startswith("animation.etheria.race_lin_"): continue
        body = k[len("animation.etheria.race_"):]; base = base_of(body); lord = base != body
        for bn, b in a.get("bones", {}).items():
            sc = b.get("scale")
            if HORN.match(bn) and body in HORN_K:
                h = HORN_K[body]; new = [h, f"{PULSE} * {h}" if h != 1 else PULSE, h]
                if sc != new: b["scale"] = new; changed += 1
                continue
            if bn == "halo" and lord and sc is not None and sc != 1 and sc != [1, 1, 1]:
                b["scale"] = [1, 1, 1]; changed += 1; continue
            if bn == "lord_crown" and body in rings:
                if sc != [RING_K] * 3: b["scale"] = [RING_K] * 3; changed += 1
                continue
            v = sc[0] if isinstance(sc, list) else sc; m = wing_mult(v)
            if m is None: continue
            cap = WING_CAP.get(base, 9)
            if lord:
                bm = base_wing(base, bn)
                if bm is not None: cap = min(cap, round(bm * LORD_WING, 3))
            nm = round(min(m, cap), 3)
            e = TIER_NEW if nm == 1 else f"{nm} * {TIER_NEW}"
            if sc != [e, e, e]: b["scale"] = [e, e, e]; changed += 1
    json.dump(D, open(SRC, "w"), separators=(",", ":"))
    return changed

# ------------------------------------------------------------------ 4) kits de corpo do Tensura
def F(u, v): return {f: {"uv": [u, v], "uv_size": [8, 8]} for f in ("north", "east", "south", "west", "up", "down")}
def C(o, s, uv, rot=None, piv=None):
    c = {"origin": o, "size": s, "uv": uv}
    if rot: c["rotation"] = rot; c["pivot"] = piv
    return c
BEARD, GOLD, LEATHER = F(112, 64), F(120, 64), F(0, 72)
def dwarf_kit(desc):
    bones = [{"name": "root", "pivot": [0, 0, 0]}, {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
             {"name": "body", "parent": "waist", "pivot": [0, 24, 0], "cubes": [
                 C([-4.3, 12.0, -2.35], [8.6, 1.6, 4.7], LEATHER), C([-1.0, 12.2, -2.65], [2.0, 1.2, 0.4], GOLD)]},
             {"name": "head", "parent": "body", "pivot": [0, 24, 0], "cubes": [
                 C([-4.25, 22.0, -4.7], [8.5, 3.8, 0.9], BEARD),            # barba cheia no queixo
                 C([-3.0, 25.6, -4.55], [6.0, 0.8, 0.5], BEARD),            # bigode
                 C([-4.3, 24.2, -4.3], [0.55, 4.2, 3.2], BEARD), C([3.75, 24.2, -4.3], [0.55, 4.2, 3.2], BEARD),   # costeletas
                 C([-2.6, 19.8, -4.55], [5.2, 2.3, 0.8], BEARD),            # barba descendo no peito
                 C([-1.1, 17.4, -4.45], [2.2, 2.5, 0.7], BEARD),            # trança
                 C([-1.3, 18.9, -4.6], [2.6, 0.6, 1.0], GOLD), C([-1.3, 17.2, -4.6], [2.6, 0.5, 1.0], GOLD)]},   # anéis da trança
             {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0], "cubes": [C([-8.4, 22.6, -2.4], [4.8, 1.6, 4.8], LEATHER)]},
             {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0], "cubes": [C([3.6, 22.6, -2.4], [4.8, 1.6, 4.8], LEATHER)]}]
    return {"description": desc, "bones": bones}

def kits():
    D = json.load(open(KITS)); G = {g["description"]["identifier"]: g for g in D["minecraft:geometry"]}; n = 0
    def edit(gid, bone, fn):
        nonlocal n
        for b in G[gid]["bones"]:
            if b["name"] != bone: continue
            new = [x for x in (fn(c) for c in b.get("cubes", [])) if x is not None]
            if new != b.get("cubes", []): n += 1
            if b.get("cubes") is not None or new: b["cubes"] = new
    # Lorde (5): coroa de espinhos fora; ombreiras 6.2 de largura; espinhos dos ombros baixos
    edit("geometry.tensura.race_body_5", "head", lambda c: None)
    def pauld(c):
        o, s = c["origin"], c["size"]
        if s == [7.5, 2, 7.6]: return {**c, "origin": [-9.4 if o[0] < 0 else 3.2, 23, -3.2], "size": [6.2, 1.8, 6.4]}
        if c.get("rotation") and s[0] == 1.6 and s[1] > 3:
            return {**c, "origin": [o[0] + (0.8 if o[0] < 0 else -0.8), 24.6, o[2]], "size": [1.4, round(s[1] * 0.42, 2), s[2]]}
        return c
    for arm in ("rightArm", "leftArm"): edit("geometry.tensura.race_body_5", arm, pauld)
    # garras curtas (3 dragão, 4 demônio maior)
    def claw(c):
        o, s = c["origin"], c["size"]
        if s[0] == 0.9 and s[2] == 0.9 and s[1] in (1.9, 2.4): return {**c, "origin": [o[0], 11.2, o[2]], "size": [0.9, 1.0, 0.9]}
        return c
    for gid in ("geometry.tensura.race_body_3", "geometry.tensura.race_body_4"):
        for arm in ("rightArm", "leftArm"): edit(gid, arm, claw)
    # presas do Oni (2) pequenas
    edit("geometry.tensura.race_body_2", "head", lambda c: {**c, "origin": [c["origin"][0] + 0.1, 24.5, -4.6], "size": [0.8, 1.4, 0.8]} if c["size"] == [1, 2.8, 1] else c)
    # kit 6 -> Anão
    g6 = G["geometry.tensura.race_body_6"]; new6 = dwarf_kit(g6["description"])
    if g6 != new6: g6.clear(); g6.update(new6); n += 1
    json.dump(D, open(KITS, "w"), indent=1)
    # ladrilhos novos: barba (112,64), ouro (120,64), couro (0,72)
    im = Image.open(KITS_TEX).convert("RGBA"); px = im.load()
    for x in range(8):
        for y in range(8):
            px[112 + x, 64 + y] = (112 - 10 * ((x + y) % 3 == 0) + 8 * (x % 2), 74 - 8 * ((x + y) % 3 == 0) + 5 * (x % 2), 44 - 4 * (y % 2), 255)
            px[120 + x, 64 + y] = (214 - 30 * (x in (0, 7) or y in (0, 7)), 168 - 30 * (x in (0, 7) or y in (0, 7)), 70, 255)
            px[0 + x, 72 + y] = (96 - 10 * (y in (0, 7)) + 4 * ((x * 3 + y) % 2), 62 - 8 * (y in (0, 7)), 38, 255)
    im.save(KITS_TEX)
    return n

# ------------------------------------------------------------------ asas/orelhas/auréola do Tensura (crescimento por estágio suave)
def tensura_tier():
    s = open(TANIM).read(); k = s.count(TIER_OLD)
    if k: open(TANIM, "w").write(s.replace(TIER_OLD, TIER_NEW))
    return k

# ------------------------------------------------------------------ 5) posturas eretas (fonte em tools/race_styles.py)
def styles():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import race_styles as RS
    A = {f"animation.etheria.rstyle.{s}": RS.pose_anim(s) for s in RS.POSE}
    A.update(RS.cast_anims())
    txt = json.dumps({"format_version": "1.8.0", "animations": A}, indent=1).replace("query.life_time", "query.anim_time")
    D = json.loads(txt)
    for k, a in D["animations"].items():
        if a.get("loop") is True: a["animation_length"] = 3600
    json.dump(D, open(STYLE, "w"), indent=1)
    return len(D["animations"])

def main():
    n, rings = horn_pivots()
    print("pivôs de chifre:", n, "| anéis de Lorde:", sorted(rings))
    print("canais de animação de raça alterados:", race_anims(rings))
    print("kits de corpo alterados:", kits())
    print("escalas por estágio do Tensura suavizadas:", tensura_tier())
    print("posturas:", styles())
    print("agora: python3 tools/split_race_anims.py")

if __name__ == "__main__":
    main()

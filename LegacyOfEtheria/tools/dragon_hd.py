"""8.3 - DRAGÕES MAIORES E MAIS DETALHADOS.
- Velzard, Velgrynd, Veldanava (forma do jogador e chefe) e Dragão Marinho:
  * textura em ALTA DEFINIÇÃO (1024 no lugar de 512, mesmos UVs: o Bedrock normaliza pelo texture_width): escamas com volume
    (degradê, contorno escuro, brilho), placas da barriga chanfradas, chifres/espinhos com anéis, membranas com veias, olhos detalhados;
  * geometria: fileira de placas dorsais e quilhas laterais em cada segmento do corpo (no próprio eixo do segmento), crista de escamas na cabeça.
- Tamanho (RP scripts.scale + visible_bounds; BP collision_box da forma de dragão): Veldora (modelo intocado), Velzard, Velgrynd, Veldanava maiores;
  Dragão Marinho gigante (maior que os Dragões Verdadeiros).
Uso: python3 tools/dragon_hd.py (idempotente: parte das geometrias/texturas 'fonte' guardadas em tools/dragon_src)"""
import json, os, math, random, re, shutil, sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dragon_real as drl
import sea_dragon as sdm
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
SRC = os.path.join(ROOT, "tools/dragon_src"); os.makedirs(SRC, exist_ok=True)
TS, HD = 32, 2                      # ladrilho original 32 px; alta definição x2
UVT = drl.UVT
TARGETS = {   # nome -> (geometrias, textura, ladrilhos)
    "velzard": ([f"etheria_pdrg_velzard", "etheria_pdrg_velzard_boss"], "etheria_pdrg_velzard", drl.DRAGONS["velzard"]["tiles"]),
    "velgrynd": ([f"etheria_pdrg_velgrynd", "etheria_pdrg_velgrynd_boss"], "etheria_pdrg_velgrynd", drl.DRAGONS["velgrynd"]["tiles"]),
    "veldanava": ([f"etheria_pdrg_veldanava", "etheria_pdrg_veldanava_boss"], "etheria_pdrg_veldanava", drl.DRAGONS["veldanava"]["tiles"]),
    "sea_dragon": (["etheria_sea_dragon"], "etheria_sea_dragon", sdm.CFG["tiles"]),
}
# escala de render (forma de dragão) e caixa de colisão da forma de dragão
SIZE = {"veldora": (1.7, (6.4, 9.5)), "velzard": (1.75, (5.6, 8.4)), "velgrynd": (1.75, (5.8, 8.6)), "veldanava": (1.45, (6.6, 9.8)), "sea_dragon": (2.1, (5.0, 3.6))}

# ------------------------------------------------------------------ ladrilhos HD
def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)
def hd_tile(kind, a, b, c=None, seed=1):
    T = TS * HD; rnd = random.Random(seed); im = Image.new("RGBA", (T, T), a + (255,)); d = ImageDraw.Draw(im)
    if kind == "scales":
        sz = 10
        for row, y in enumerate(range(-sz // 2, T + sz, sz * 2 // 3)):
            for x in range(-sz + (row % 2) * sz // 2, T + sz, sz):
                base = shade(a, rnd.uniform(0.9, 1.08))
                d.ellipse([x, y, x + sz, y + sz + 2], fill=shade(b, 0.75) + (255,))                       # sombra/contorno
                d.ellipse([x + 1, y, x + sz - 1, y + sz], fill=base + (255,))
                d.ellipse([x + 2, y + 1, x + sz - 3, y + sz // 2], fill=shade(base, 1.14) + (255,))       # luz em cima
                d.arc([x + 1, y, x + sz - 1, y + sz], 20, 160, fill=shade(b, 0.8) + (255,))             # borda inferior
                d.point((x + 3, y + 2), fill=(255, 255, 255, 140))                                         # brilho
    elif kind == "plates":
        for y in range(0, T, 8):
            d.rectangle([0, y, T, y + 7], fill=a + (255,)); d.line([(0, y), (T, y)], fill=shade(a, 1.18) + (255,))
            d.line([(0, y + 1), (T, y + 1)], fill=shade(a, 1.08) + (255,)); d.line([(0, y + 6), (T, y + 6)], fill=shade(b, 0.92) + (255,)); d.line([(0, y + 7), (T, y + 7)], fill=shade(b, 0.7) + (255,))
            for _ in range(2): x = rnd.randint(0, T); d.line([(x, y + 2), (x + rnd.randint(-2, 2), y + 5)], fill=shade(b, 0.85) + (180,))
    elif kind == "metal":
        for y in range(T):
            t = abs(math.sin(y / T * math.pi)); d.line([(0, y), (T, y)], fill=tuple(int(a[i] * (1 - t * 0.35) + b[i] * t * 0.35) for i in range(3)) + (255,))
        for y in range(3, T, 7): d.line([(0, y), (T, y + 1)], fill=shade(a, 0.72) + (255,)); d.line([(0, y + 1), (T, y + 2)], fill=shade(b, 1.1) + (200,))
        for x in range(4, T, 13): d.line([(x, 0), (x + 2, T)], fill=shade(b, 1.15) + (90,))
    elif kind == "membrane":
        for y in range(T): d.line([(0, y), (T, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * y / T) for i in range(3)) + (255,))
        vc = (c or b)
        for x0 in (6, 22, 40, 56):
            pts = [(x0, 0)]; x = x0
            for y in range(8, T + 8, 8): x += rnd.randint(-3, 3); pts.append((x, y))
            d.line(pts, fill=vc + (255,), width=2)
            for k in range(2, len(pts) - 1, 2): d.line([pts[k], (pts[k][0] + rnd.choice((-6, 6)), pts[k][1] + 7)], fill=vc + (190,), width=1)
        for _ in range(14): x, y = rnd.randint(0, T), rnd.randint(0, T); d.ellipse([x, y, x + 3, y + 2], fill=shade(a, 1.15) + (110,))
    elif kind == "feathers":
        for row, y in enumerate(range(-6, T, 7)):
            for x in range(-8 + (row % 2) * 6, T, 12):
                col = a if (row + x // 12) % 2 else b
                d.polygon([(x, y), (x + 12, y), (x + 9, y + 12), (x + 3, y + 12)], fill=col + (255,))
                d.line([(x + 6, y), (x + 6, y + 11)], fill=(c or shade(b, 0.7)) + (255,))
                d.line([(x, y), (x + 12, y)], fill=shade(col, 1.15) + (255,))
    elif kind == "crystal":
        for i in range(10):
            x, y = rnd.randint(0, T), rnd.randint(0, T); r = rnd.randint(5, 11)
            d.polygon([(x, y - r), (x + r * 0.6, y), (x, y + r), (x - r * 0.6, y)], fill=(b if i % 2 else a) + (230,))
            d.polygon([(x, y - r), (x + r * 0.6, y), (x, y)], fill=(255, 255, 255, 120)); d.line([(x, y - r), (x, y + r)], fill=(255, 255, 255, 160))
    elif kind == "fire":
        for y in range(T): d.line([(0, y), (T, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * y / T) for i in range(3)) + (255,))
        for _ in range(9): x = rnd.randint(0, T); d.polygon([(x - 4, T), (x + rnd.randint(-5, 5), rnd.randint(4, 30)), (x + 4, T)], fill=(255, 236, 150, 200))
    elif kind == "stars":
        for _ in range(9): x, y = rnd.randint(1, T - 2), rnd.randint(1, T - 2); d.point((x, y), fill=b + (255,)); d.line([(x - 2, y), (x + 2, y)], fill=b + (150,)); d.line([(x, y - 2), (x, y + 2)], fill=b + (150,))
    elif kind == "eye":
        d.rectangle([0, 0, T, T], fill=a + (255,)); d.ellipse([2, T * 0.16, T - 3, T * 0.84], fill=(10, 6, 10, 255))
        for r in range(int(T * 0.31), 0, -1):
            k = r / (T * 0.31); col = tuple(int(b[i] * (1.2 - 0.55 * k)) for i in range(3))
            d.ellipse([T / 2 - r * 1.42, T / 2 - r, T / 2 + r * 1.42, T / 2 + r], fill=tuple(min(255, v) for v in col) + (255,))
        for k in range(0, 360, 20):   # estrias da íris
            ang = math.radians(k); d.line([(T / 2 + math.cos(ang) * 6, T / 2 + math.sin(ang) * 4), (T / 2 + math.cos(ang) * 26, T / 2 + math.sin(ang) * 18)], fill=shade(b, 0.7) + (120,))
        d.polygon([(T / 2, T * 0.18), (T / 2 + 4, T / 2), (T / 2, T * 0.82), (T / 2 - 4, T / 2)], fill=(6, 2, 6, 255))
        d.ellipse([T * 0.27, T * 0.28, T * 0.27 + 8, T * 0.28 + 6], fill=(255, 255, 255, 240)); d.ellipse([T * 0.6, T * 0.6, T * 0.6 + 3, T * 0.6 + 3], fill=(255, 255, 255, 160))
    else:   # solid: cor com ruído e borda
        px = im.load()
        for y in range(T):
            for x in range(T):
                n = rnd.randint(-6, 6); e = 0.86 if x in (0, T - 1) or y in (0, T - 1) else 1.0
                px[x, y] = tuple(max(0, min(255, int(v * e) + n)) for v in a) + (255,)
    if kind in ("scales", "plates", "metal", "membrane", "feathers"):
        px = im.load()
        for y in range(T):
            f = 1.08 - 0.22 * (y / (T - 1))
            for x in range(T):
                r_, g_, b_, a_ = px[x, y]; n = rnd.randint(-5, 5)
                px[x, y] = (max(0, min(255, int(r_ * f) + n)), max(0, min(255, int(g_ * f) + n)), max(0, min(255, int(b_ * f) + n)), a_)
    return im

def hd_texture(name, tex, tiles):
    sp = os.path.join(SRC, tex + ".png"); rp = os.path.join(RP, f"textures/entity/{tex}.png")
    if not os.path.exists(sp): shutil.copy(rp, sp)
    src = Image.open(sp).convert("RGBA"); W, H = src.size
    out = src.resize((W * HD, H * HD), Image.LANCZOS)
    for i, t in enumerate(drl.TILES):
        spec = tiles[t]; u, v = UVT[t]
        out.paste(hd_tile(spec[0], spec[1], spec[2], spec[3] if len(spec) > 3 else None, seed=i * 11 + len(name)), (u * HD, v * HD))
    out.save(rp)

# ------------------------------------------------------------------ geometria: placas dorsais, quilhas e crista
BODY = re.compile(r"^(d_neck\d|d_upper_body|d_body|d_tail\d|x_serp\d+|sd_body|sd_t\d+|sd_neck)$")
def skin_cube(c):
    uv = c.get("uv"); 
    return isinstance(uv, dict) and uv.get("up", {}).get("uv") == UVT["back"] and uv.get("north", {}).get("uv") == UVT["side"]
def child(c, o, s, tile):
    n = {"origin": [round(v, 3) for v in o], "size": [round(v, 3) for v in s], "uv": drl.faces(tile)}
    if "pivot" in c: n["pivot"] = c["pivot"]
    if "rotation" in c: n["rotation"] = c["rotation"]
    return n
STYLE = {"velzard": "ice", "velgrynd": "flame", "veldanava": "spine", "sea_dragon": "fin"}
def detail(geo, style="spine"):
    add = 0; k = 0
    for b in geo["bones"]:
        cs = b.get("cubes", [])
        if not cs: continue
        if BODY.match(b["name"]) and skin_cube(cs[0]):
            c = cs[0]; (ox, oy, oz), (w, h, L) = c["origin"], c["size"]
            if w < 3 or L < 3: continue
            n = max(2, round(L / 4.5)); new = []
            for j in range(n):   # placas dorsais sobrepostas
                new.append(child(c, (ox + w * 0.2, oy + h - 0.25, oz + L * j / n), (w * 0.6, 1.0, L / n * 1.12), "back"))
            for sx in (ox - 0.4, ox + w - 0.2):   # quilhas laterais (cor das costas)
                new.append(child(c, (sx, oy + h * 0.52, oz + L * 0.08), (0.6, max(0.8, h * 0.16), L * 0.84), "back"))
            k += 1; big = k % 2 == 0
            if style == "ice" and big:     # cristais de gelo cravados nas laterais + tufo de geada
                for sx, dx in ((ox - w * 0.28, 0), (ox + w * 0.98, 0)):
                    new.append(child(c, (sx, oy + h * 0.55, oz + L * 0.3), (w * 0.3, w * 0.42, w * 0.22), "acc1"))
                    new.append(child(c, (sx + w * 0.06, oy + h * 0.9, oz + L * 0.36), (w * 0.16, w * 0.3, w * 0.12), "acc3"))
                new.append(child(c, (ox + w * 0.3, oy + h + 0.8, oz + L * 0.1), (w * 0.4, max(1.5, w * 0.18), L * 0.5), "mane"))
            elif style == "flame" and big:  # tufos de chama nas laterais
                for sx in (ox - w * 0.22, ox + w * 0.92):
                    new.append(child(c, (sx, oy + h * 0.6, oz + L * 0.2), (w * 0.3, max(1.2, h * 0.14), L * 0.6), "mane"))
                    new.append(child(c, (sx + w * 0.05, oy + h * 0.75, oz + L * 0.35), (w * 0.2, max(1, h * 0.1), L * 0.4), "acc3"))
            elif style == "spine" and w >= 6:   # fileira de espinhos
                new.append(child(c, (ox + w * 0.43, oy + h + 0.6, oz + L * 0.25), (w * 0.14, max(2, w * 0.3), L * 0.4), "spike"))
            elif style == "fin":             # babados de nadadeira ao longo do corpo + espinho dorsal
                for sx in (ox - w * 0.45, ox + w * 0.95):
                    new.append(child(c, (sx, oy + h * 0.3, oz + L * 0.05), (w * 0.5, 0.4, L * 0.9), "acc1"))
                if big: new.append(child(c, (ox + w * 0.44, oy + h + 0.6, oz + L * 0.3), (w * 0.12, max(1.5, w * 0.35), L * 0.25), "spike"))
            b["cubes"] = cs + new; add += len(new)
        elif b["name"] in ("d_head", "sd_head") and skin_cube(cs[0]):
            c = cs[0]; (ox, oy, oz), (w, h, L) = c["origin"], c["size"]; new = []
            for j in range(5):   # crista de escamas no crânio
                new.append(child(c, (ox + w * 0.3, oy + h - 0.2, oz + L * (0.1 + j * 0.17)), (w * 0.4, 1.2 + (j % 2) * 0.6, L * 0.15), "back"))
            for sx in (ox - 0.3, ox + w - 0.3): new.append(child(c, (sx, oy + h * 0.15, oz + L * 0.15), (0.6, h * 0.12, L * 0.7), "spike"))   # linha da mandíbula
            b["cubes"] = cs + new; add += len(new)
    return add

def main():
    report = {}
    for name, (geos, tex, tiles) in TARGETS.items():
        n = 0
        for gname in geos:
            gp = os.path.join(RP, f"models/entity/{gname}.geo.json"); sp = os.path.join(SRC, f"{gname}.geo.json")
            if not os.path.exists(sp): shutil.copy(gp, sp)
            D = json.load(open(sp)); g = D["minecraft:geometry"][0]
            n = detail(g, STYLE[name])
            g["description"]["visible_bounds_width"] = 64; g["description"]["visible_bounds_height"] = 48
            json.dump(D, open(gp, "w"), indent=1)
        hd_texture(name, tex, tiles); report[name] = n
    # Veldora: modelo intocado, só os limites de visão (para não sumir de perto quando maior)
    vp = os.path.join(RP, "models/entity/etheria_veldora.geo.json"); V = json.load(open(vp))
    for g in V["minecraft:geometry"]: g["description"]["visible_bounds_width"] = 64; g["description"]["visible_bounds_height"] = 48
    json.dump(V, open(vp, "w"), indent=1)
    # escalas (RP) e colisão da forma de dragão (BP)
    for name, (sc, (cw, ch)) in SIZE.items():
        ep = os.path.join(RP, f"entity/{name}.entity.json"); E = json.load(open(ep)); sc_ = E["minecraft:client_entity"]["description"].setdefault("scripts", {})
        old = sc_.get("scale", "1.0")
        sc_["scale"] = re.sub(r"== 'dragon' \? [0-9.]+", f"== 'dragon' ? {sc}", old) if "'dragon'" in str(old) else str(sc)
        json.dump(E, open(ep, "w"), indent=1, ensure_ascii=False)
        bp = os.path.join(BP, f"entities/{name}.json"); B = json.load(open(bp)); txt = json.dumps(B)
        cols = re.findall(r'"minecraft:collision_box": \{"width": ([0-9.]+), "height": ([0-9.]+)\}', txt)
        if cols:
            big = max(cols, key=lambda x: float(x[0]))
            txt = txt.replace(f'"minecraft:collision_box": {{"width": {big[0]}, "height": {big[1]}}}', f'"minecraft:collision_box": {{"width": {cw}, "height": {ch}}}')
            json.dump(json.loads(txt), open(bp, "w"), indent=1, ensure_ascii=False)
    print("detalhes (cubos novos por geometria):", report)
if __name__ == "__main__": main()

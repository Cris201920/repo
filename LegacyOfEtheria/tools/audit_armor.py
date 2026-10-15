# Auditoria das armaduras: item -> attachable -> geometria -> textura; UV fora da imagem; faces em área transparente (peça invisível/buraco).
import json, os, glob, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from tensura_armor import box_faces
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
GEO = {}
for f in glob.glob(os.path.join(RP, "models/entity/**/*.json"), recursive=True):
    try: g = json.load(open(f))
    except Exception: continue
    for d in g.get("minecraft:geometry", []): GEO[d["description"]["identifier"]] = d
wear = {}
for f in glob.glob(os.path.join(BP, "items/*.json")):
    d = json.load(open(f))["minecraft:item"]; c = d.get("components", {})
    if "minecraft:wearable" in c: wear[d["description"]["identifier"]] = c["minecraft:wearable"].get("slot")
problems, ok = [], 0
for iid, slot in sorted(wear.items()):
    att = None
    for f in glob.glob(os.path.join(RP, "attachables/*.json")):
        d = json.load(open(f))["minecraft:attachable"]["description"]
        if d["identifier"] == iid: att = d; break
    if not att: problems.append((iid, "sem attachable (usa armadura vanilla?)")); continue
    gid = att["geometry"]["default"]; tex = att["textures"]["default"]
    g = GEO.get(gid)
    if not g and gid.startswith("geometry.humanoid.armor."):   # modelo padrão de armadura do jogo (textura de camada 64x32)
        tp = os.path.join(RP, tex + ".png")
        if not os.path.exists(tp): problems.append((iid, f"textura ausente {tex}"))
        else: ok += 1
        continue
    if not g: problems.append((iid, f"geometria ausente {gid}")); continue
    tp = os.path.join(RP, tex + ".png")
    if not os.path.exists(tp): problems.append((iid, f"textura ausente {tex}")); continue
    im = Image.open(tp).convert("RGBA"); tw, th = g["description"].get("texture_width", 64), g["description"].get("texture_height", 64)
    kx, ky = im.width / tw, im.height / th
    if abs(kx - ky) > 0.01: problems.append((iid, f"proporção da textura {im.size} != geometria {tw}x{th}"))
    A = im.split()[3].load(); bad_faces = oob = faces = 0; cubes = 0
    for b in g["bones"]:
        for c in b.get("cubes", []):
            cubes += 1
            F = box_faces(c) if isinstance(c.get("uv"), list) else c.get("uv", {})
            for fn, uv in F.items():
                if not uv: continue
                u, v = uv["uv"]; w, h = uv["uv_size"]
                if abs(w) < 1e-6 or abs(h) < 1e-6: continue
                faces += 1
                x0, x1 = sorted((u * kx, (u + w) * kx)); y0, y1 = sorted((v * ky, (v + h) * ky))
                if x0 < -0.01 or y0 < -0.01 or x1 > im.width + 0.01 or y1 > im.height + 0.01: oob += 1; continue
                n = vis = 0
                for yy in range(int(y0), max(int(y0) + 1, int(y1))):
                    for xx in range(int(x0), max(int(x0) + 1, int(x1))):
                        if xx < im.width and yy < im.height: n += 1; vis += A[xx, yy] > 20
                if n and vis / n < 0.15: bad_faces += 1
    if cubes == 0: problems.append((iid, "geometria sem cubos (peça invisível)"))
    elif oob or bad_faces / max(1, faces) > 0.5: problems.append((iid, f"{oob} faces com UV fora da imagem, {bad_faces}/{faces} faces transparentes ({gid})"))
    else: ok += 1
print(f"{len(wear)} armaduras | ok {ok} | com problema {len(problems)}")
for p in problems: print(" ", *p)

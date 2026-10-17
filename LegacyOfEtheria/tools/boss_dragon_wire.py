"""Liga os bosses Veldanava/Velzard/Velgrynd aos modelos reais (etheria_pdrg_<l>_boss).
As animações de ação do boss (bite, claw, roar...) são cópias das etheria_tdr com ossos d_*."""
import json, os
RP = os.path.join(os.path.dirname(__file__), "..", "LegacyOfEtheria_RP")
LINS = ("veldanava", "velzard", "velgrynd")

def load(p): return json.load(open(os.path.join(RP, p)))
def save(p, d): json.dump(d, open(os.path.join(RP, p), "w"), indent=1)

tdr = load("animations/etheria_tdr.animation.json")["animations"]
out = {}
for k, v in tdr.items():
    act = k.split(".")[-1]
    if act.startswith("h_") or act in ("walk", "run", "fly", "attack"): continue
    v = json.loads(json.dumps(v)); v["bones"] = {"d_" + b: x for b, x in v.get("bones", {}).items()}
    out["animation.etheria_bdrg." + act] = v
save("animations/etheria_bdrg.animation.json", {"format_version": "1.8.0", "animations": out})

for l in LINS:
    p = f"entity/{l}.entity.json"; E = load(p); D = E["minecraft:client_entity"]["description"]
    D["geometry"]["dragon"] = f"geometry.etheria_pdrg_{l}_boss"
    D["textures"]["dragon"] = f"textures/entity/etheria_pdrg_{l}"
    A = D["animations"]
    A["idle"] = f"animation.etheria_pdrg_{l}.idle"
    A["gait"] = f"animation.etheria_pdrg_{l}.gait"
    for a in ("walk", "run", "fly", "attack"): A[a] = f"animation.etheria_pdrg.{a}"
    for a in ("bite", "claw", "tail", "roar", "ability", "takeoff", "landing", "hurt", "death"):
        A[a] = f"animation.etheria_bdrg.{a}"
    an = D["scripts"]["animate"]
    if not any("gait" in x for x in an if isinstance(x, dict)):
        an.insert(1, {"gait": "query.property('etheria:form') == 'dragon' && query.is_on_ground && query.modified_move_speed > 0.05"})
    save(p, E)
print("ok", len(out))

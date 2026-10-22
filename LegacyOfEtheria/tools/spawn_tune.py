"""7.x - SPAWNS NATURAIS COM MENOS LAG: ajusta LegacyOfEtheria_BP/spawn_rules/*.json pela raridade do mob (scripts/data/mobs.gen.js).
Os mobs continuam nascendo SOZINHOS no mundo (regras naturais do jogo), mas com menos de cada tipo ao mesmo tempo (density_limit),
grupos menores (herd) e intervalos maiores (delay_filter). Nenhum mob é removido das regras. Valores ABSOLUTOS por raridade -> idempotente.
Uso: python3 tools/spawn_tune.py [--dry]   (imprime os números antes/depois)"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
# raridade -> (density por camada, herd máx., delay min s, delay máx s, chance %)
RULE = {
    "common":    (3, 3, 6, 14, 100),
    "uncommon":  (2, 2, 12, 30, 60),
    "rare":      (1, 1, 30, 70, 45),
    "special":   (1, 1, 45, 100, 35),
    "legendary": (1, 1, 60, 150, 35),
    "boss":      (1, 1, 120, 300, 25),
}

def mobs():
    src = open(os.path.join(BP, "scripts/data/mobs.gen.js"), encoding="utf-8").read()
    return json.loads(src[src.index("{"):src.index("};") + 1])

def tally(files):
    out = {"surface": 0, "underground": 0, "herd": 0, "rules": 0}
    for f in files:
        for c in json.load(open(f, encoding="utf-8"))["minecraft:spawn_rules"]["conditions"]:
            dl = c.get("minecraft:density_limit", {})
            out["surface"] += dl.get("surface", 0); out["underground"] += dl.get("underground", 0)
            out["herd"] += c.get("minecraft:herd", {}).get("max_size", 1); out["rules"] += 1
    return out

def main(dry=False):
    M = mobs(); files = sorted(glob.glob(os.path.join(BP, "spawn_rules/*.json")))
    before = tally(files); changed = 0
    for f in files:
        j = json.load(open(f, encoding="utf-8")); sr = j["minecraft:spawn_rules"]; ident = sr["description"]["identifier"]
        rar = M.get(ident, {}).get("rar") or ("boss" if "boss_" in ident else "rare")
        dens, herd, dmin, dmax, ch = RULE.get(rar, RULE["rare"])
        for c in sr["conditions"]:
            dl = c.get("minecraft:density_limit")
            if dl: c["minecraft:density_limit"] = {k: min(v, dens) if rar in ("legendary", "boss", "special") else dens for k, v in dl.items()}
            h = c.get("minecraft:herd")
            if h: h["max_size"] = max(1, min(h.get("max_size", 1), herd)); h["min_size"] = max(1, min(h.get("min_size", 1), h["max_size"]))
            df = c.get("minecraft:delay_filter")
            if df: df["min"], df["max"], df["spawn_chance"] = dmin, dmax, ch
        txt = json.dumps(j, ensure_ascii=False, indent=1)
        if open(f, encoding="utf-8").read() != txt:
            changed += 1
            if not dry: open(f, "w", encoding="utf-8").write(txt)
    after = before if dry else tally(files)
    print(f"regras: {len(files)} arquivos, {before['rules']} condições | alterados: {changed}{' (simulação)' if dry else ''}")
    print(f"soma dos limites de densidade  superfície {before['surface']} -> {after['surface']} | subterrâneo {before['underground']} -> {after['underground']}")
    print(f"soma dos grupos máximos {before['herd']} -> {after['herd']}")

if __name__ == "__main__":
    main("--dry" in sys.argv)

# 6.36 - Chefes conforme o mod Tensura: Reincarnated (1.19.2 1.0.2.6). Vida/dano/armadura/resistência a empurrão lidos do bytecode
# (setAttributes de cada entidade; ver tools/tensura_attrs.json). Vida x5 (os jogadores do addon têm atributos de RPG), dano igual ao do mod,
# armadura do mod -> multiplicador de dano recebido (damage_sensor). Chefes que não existem no mod seguem a hierarquia da obra
# (Dragões Verdadeiros > Guy/Milim > Primordiais > Lordes antigos > Charybdis > Hinata > Orc do Desastre).
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
K = 5
MOD = {   # entidade do addon -> (vida, dano, armadura, resist. empurrão, velocidade) do mod
  "tt_charybdis": (3000, 100, 20, 1.0, None), "tt_hinata": (1000, 20, 50, 0.8, None), "tt_orc_disaster": (700, 50, 20, 1.0, None),
  "tt_spirit_colossus": (600, 50, 40, 1.0, None), "tt_shizue_ifrit": (400, 40, 5, 1.0, None), "tt_orc_lord": (200, 20, 0, 1.0, None),
  "tt_ifrit_clone": (50, 10, 5, 1.0, None), "tt_shizue": (60, 10, 5, 0.2, None),
}
LORE = {  # (vida, dano, armadura, empurrão) — fora do mod, pela hierarquia da obra
  "veldanava": (60000, 180, 40, 1.0), "veldora": (40000, 150, 35, 1.0), "velgrynd": (38000, 145, 35, 1.0), "velzard": (38000, 145, 35, 1.0),
  "milim_nava": (36000, 150, 30, 1.0), "guy_crimson": (36000, 140, 35, 1.0), "rimuru_senhor_demonio": (34000, 140, 35, 1.0),
  "michael_manas": (30000, 120, 35, 1.0), "chronoa": (30000, 120, 30, 1.0), "diablo": (26000, 115, 30, 1.0),
  "testarossa": (20000, 100, 25, 1.0), "ultima": (20000, 100, 25, 1.0), "carrera": (20000, 100, 25, 1.0), "rain": (20000, 100, 25, 1.0),
  "luminous_valentine": (20000, 100, 30, 1.0), "feldway_angel": (20000, 105, 30, 1.0), "feldway": (15000, 90, 25, 1.0),
  "demon_lord_returner": (15000, 85, 25, 1.0), "carrion_royal_beast": (13000, 85, 25, 1.0), "dino": (12000, 80, 25, 1.0), "yuuki_kagurazaka": (12000, 80, 20, 0.9),
  "carrion": (10000, 70, 20, 1.0), "zalario": (10000, 75, 25, 1.0), "lorde_branco": (9000, 70, 20, 0.9), "benimaru": (9000, 70, 20, 0.9), "shion": (9000, 75, 20, 0.9),
  "rimuru_tempest": (8000, 60, 25, 1.0), "beretta": (6000, 50, 40, 1.0), "rimuru_ogre_fight": (2500, 30, 10, 0.8),
}
def sensor(arm):
    return round(max(0.35, 1 - arm * 0.012), 3)
def main():
    table = {}
    for k, (hp, atk, arm, kb, _) in MOD.items(): table[k] = (hp * K, atk, arm, kb, "mod")
    for k, (hp, atk, arm, kb) in LORE.items(): table[k] = (hp, atk, arm, kb, "obra")
    mf = os.path.join(BP, "scripts/data/mobs.gen.js"); mobs = open(mf).read()
    rep = []
    for k, (hp, atk, arm, kb, src) in table.items():
        ef = os.path.join(BP, "entities", k + ".json")
        if not os.path.exists(ef): rep.append(f"{k}: SEM ENTIDADE"); continue
        e = json.load(open(ef)); c = e["minecraft:entity"]["components"]
        old = (c.get("minecraft:health", {}).get("max"), c.get("minecraft:attack", {}).get("damage"))
        c["minecraft:health"] = {"value": hp, "max": hp}
        if "minecraft:attack" in c or atk: c["minecraft:attack"] = dict(c.get("minecraft:attack", {}), damage=atk)
        c["minecraft:knockback_resistance"] = {"value": kb}
        trig = {"cause": "entity_attack", "damage_multiplier": sensor(arm)}, {"cause": "projectile", "damage_multiplier": sensor(arm)}
        ds = c.get("minecraft:damage_sensor")
        if ds:
            tr = ds.get("triggers"); tr = [tr] if isinstance(tr, dict) else list(tr or [])
            tr = [t for t in tr if not (t.get("cause") in ("entity_attack", "projectile") and "damage_multiplier" in t and "on_damage" not in t and "deals_damage" not in t)]
            ds["triggers"] = tr + list(trig)
        elif arm: c["minecraft:damage_sensor"] = {"triggers": list(trig)}
        json.dump(e, open(ef, "w"), indent=1, ensure_ascii=False)
        # mobs.gen.js: hp / dmg (usados pelas habilidades e pela interface)
        m = re.search(r'("etheria:' + re.escape(k) + r'": \{.*?\n \})', mobs, re.S)
        if m:
            blk = re.sub(r'"hp": [\d.]+', f'"hp": {hp}', m.group(1), count=1); blk = re.sub(r'"dmg": [\d.]+', f'"dmg": {atk}', blk, count=1)
            mobs = mobs.replace(m.group(1), blk)
        rep.append(f"{k:26s} {src:4s} vida {old[0]} -> {hp:6d} | dano {old[1]} -> {atk:4d} | dano recebido x{sensor(arm)} | empurrão {kb}")
    open(mf, "w").write(mobs)
    print("\n".join(rep))
if __name__ == "__main__": main()

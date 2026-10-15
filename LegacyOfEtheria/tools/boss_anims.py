# 6.37 - ANIMAÇÕES DE COMBATE DOS CHEFES, geradas a partir dos ossos reais de cada modelo (braços, tronco, cabeça, asas, cauda, pernas).
# Saída: RP/animations/etheria_boss_combat.animation.json  (animation.etheria.bc.<modelo>.<tipo>)
#        BP/scripts/data/bossanim.gen.js                    (entidade -> modelo + tipos disponíveis)
# Tipos: swing (golpe), slam (pancada no chão), lunge (investida), roar (rugido), cast (conjuração), breath (sopro), spin (giro/cauda), flinch (reação ao dano).
# Todas: preparação até ~0,45 s (sincronizada com o "wind" das habilidades), impacto e recuperação. Rotações somam às animações normais do mob.
import json, os, re, sys, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP"); BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
IDS = json.load(open(sys.argv[1]))
GEO = {}
for f in glob.glob(os.path.join(RP, "models/entity/**/*.json"), recursive=True):
    try: g = json.load(open(f))
    except Exception: continue
    for d in g.get("minecraft:geometry", []): GEO[d["description"]["identifier"]] = d
HUMANOID = [{"name": n, "pivot": p} for n, p in (("body", [0, 24, 0]), ("head", [0, 24, 0]), ("rightArm", [-5, 22, 0]), ("leftArm", [5, 22, 0]), ("rightLeg", [-1.9, 12, 0]), ("leftLeg", [1.9, 12, 0]))]
def client(idn):
    for f in glob.glob(os.path.join(RP, "entity/*.json")):
        d = json.load(open(f))["minecraft:client_entity"]["description"]
        if d["identifier"] == idn: return d
def bones_of(gid):
    if gid in ("geometry.humanoid.custom", "geometry.humanoid", "geometry.humanoid.customSlim", "geometry.zombie", "geometry.player"): return HUMANOID
    d = GEO.get(gid); return d["bones"] if d else None
def pick(bones):
    par = {b["name"]: b.get("parent") for b in bones}; low = {b["name"]: b["name"].lower() for b in bones}
    def top(cands):   # o mais alto da hierarquia entre os candidatos (ombro, não mão)
        cs = set(cands); return [c for c in cands if not any(a in cs for a in anc(c))]
    def anc(n):
        out, p = [], par.get(n)
        while p: out.append(p); p = par.get(p)
        return out
    piv = {b["name"]: (b.get("pivot") or [0, 0, 0]) for b in bones}
    side = lambda n: ("r" if re.search(r"right|_r$|^r_|r$|\br\b", low[n]) and "left" not in low[n] else "l" if re.search(r"left|_l$|^l_|\bl\b", low[n]) else ("r" if piv[n][0] < -0.5 else "l" if piv[n][0] > 0.5 else "c"))
    names = [b["name"] for b in bones]
    arms = top([n for n in names if re.search(r"arm|shoulder", low[n]) and not re.search(r"armor|forearm|lower", low[n])])
    legs = top([n for n in names if re.search(r"leg|thigh", low[n]) and "armor" not in low[n]])
    R = {"head": next(iter(top([n for n in names if "head" in low[n] and "armor" not in low[n]])), None),
         "body": next(iter(top([n for n in names if re.search(r"^body$|torso|chest|upper_?body|^waist$|^body", low[n])])), None),
         "rarm": next((n for n in arms if side(n) == "r"), None), "larm": next((n for n in arms if side(n) == "l"), None),
         "rleg": next((n for n in legs if side(n) == "r"), None), "lleg": next((n for n in legs if side(n) == "l"), None),
         "wings": [(n, side(n)) for n in top([n for n in names if "wing" in low[n]])][:2],
         "tail": next(iter(top([n for n in names if "tail" in low[n]])), None),
         "jaw": next((n for n in names if re.search(r"jaw|mouth", low[n])), None)}
    return R
def kf(*pts): return {f"{t:.2f}": v for t, v in pts}
def anim(R, kind):
    B = {}
    rot = lambda bone, *pts: bone and B.setdefault(bone, {}).__setitem__("rotation", kf(*pts))
    pos = lambda bone, *pts: bone and B.setdefault(bone, {}).__setitem__("position", kf(*pts))
    Z = [0, 0, 0]
    if kind == "swing":   # golpe: arma erguida, corte diagonal com torção do tronco
        L = 0.9
        rot(R["rarm"], (0, Z), (0.35, [-165, 0, 25]), (0.47, [35, 0, -20]), (0.65, [20, 0, -10]), (L, Z))
        rot(R["larm"], (0, Z), (0.35, [-30, 0, -20]), (0.47, [20, 0, -10]), (L, Z))
        rot(R["body"], (0, Z), (0.35, [-8, -28, 0]), (0.47, [12, 26, 0]), (L, Z))
        rot(R["head"], (0, Z), (0.35, [-8, 15, 0]), (0.47, [8, -12, 0]), (L, Z))
        for w, s in R["wings"]: rot(w, (0, Z), (0.35, [0, 0, 30 if s == "r" else -30]), (0.5, [0, 0, -15 if s == "r" else 15]), (L, Z))
    elif kind == "slam":  # pancada: os dois braços sobem, o corpo agacha e desce com tudo
        L = 1.2
        for a in (R["rarm"], R["larm"]): rot(a, (0, Z), (0.38, [-175, 0, 0]), (0.5, [40, 0, 0]), (0.75, [30, 0, 0]), (L, Z))
        rot(R["body"], (0, Z), (0.38, [-18, 0, 0]), (0.5, [32, 0, 0]), (0.75, [25, 0, 0]), (L, Z))
        pos(R["body"], (0, Z), (0.38, [0, 1.5, 0]), (0.5, [0, -2.5, 0]), (0.75, [0, -2, 0]), (L, Z))
        rot(R["head"], (0, Z), (0.38, [-20, 0, 0]), (0.5, [15, 0, 0]), (L, Z))
        for l, sg in ((R["rleg"], 1), (R["lleg"], -1)): rot(l, (0, Z), (0.5, [-25, 0, 8 * sg]), (0.75, [-20, 0, 6 * sg]), (L, Z))
        for w, s in R["wings"]: rot(w, (0, Z), (0.38, [0, 0, 55 if s == "r" else -55]), (0.5, [0, 0, -35 if s == "r" else 35]), (L, Z))
        rot(R["tail"], (0, Z), (0.38, [-30, 0, 0]), (0.5, [35, 0, 0]), (L, Z))
    elif kind == "lunge": # investida: inclina para trás, dispara para a frente com os braços estendidos
        L = 0.9
        rot(R["body"], (0, Z), (0.3, [-12, 0, 0]), (0.45, [35, 0, 0]), (0.65, [25, 0, 0]), (L, Z))
        for a in (R["rarm"], R["larm"]): rot(a, (0, Z), (0.3, [40, 0, 0]), (0.45, [-95, 0, 0]), (0.65, [-80, 0, 0]), (L, Z))
        rot(R["head"], (0, Z), (0.3, [10, 0, 0]), (0.45, [-25, 0, 0]), (L, Z))
        rot(R["jaw"], (0, Z), (0.45, [35, 0, 0]), (0.6, Z), (L, Z))
        for l, sg in ((R["rleg"], 1), (R["lleg"], -1)): rot(l, (0, Z), (0.45, [-40 * sg, 0, 0]), (L, Z))
        for w, s in R["wings"]: rot(w, (0, Z), (0.3, [0, 0, 50 if s == "r" else -50]), (0.45, [0, 0, -20 if s == "r" else 20]), (L, Z))
    elif kind == "roar":  # rugido: cabeça para cima, braços abertos, tremor
        L = 1.4
        rot(R["head"], (0, Z), (0.35, [-40, 0, 0]), (0.45, [-38, 4, 0]), (0.55, [-40, -4, 0]), (0.65, [-38, 4, 0]), (0.75, [-40, 0, 0]), (1.0, [-35, 0, 0]), (L, Z))
        rot(R["body"], (0, Z), (0.35, [-14, 0, 0]), (1.0, [-12, 0, 0]), (L, Z))
        rot(R["rarm"], (0, Z), (0.35, [-20, 0, 70]), (1.0, [-20, 0, 65]), (L, Z))
        rot(R["larm"], (0, Z), (0.35, [-20, 0, -70]), (1.0, [-20, 0, -65]), (L, Z))
        rot(R["jaw"], (0, Z), (0.35, [40, 0, 0]), (1.0, [38, 0, 0]), (L, Z))
        for w, s in R["wings"]: rot(w, (0, Z), (0.35, [0, 0, 60 if s == "r" else -60]), (0.7, [0, 0, 40 if s == "r" else -40]), (1.0, [0, 0, 60 if s == "r" else -60]), (L, Z))
        rot(R["tail"], (0, Z), (0.35, [-35, 0, 0]), (1.0, [-30, 0, 0]), (L, Z))
    elif kind == "cast":  # conjuração: mãos sobem ao céu, concentram e empurram para a frente
        L = 1.2
        rot(R["rarm"], (0, Z), (0.3, [-160, 0, 15]), (0.45, [-155, 0, 10]), (0.55, [-90, 0, 5]), (0.85, [-85, 0, 5]), (L, Z))
        rot(R["larm"], (0, Z), (0.3, [-160, 0, -15]), (0.45, [-155, 0, -10]), (0.55, [-90, 0, -5]), (0.85, [-85, 0, -5]), (L, Z))
        rot(R["body"], (0, Z), (0.3, [-10, 0, 0]), (0.55, [10, 0, 0]), (L, Z))
        rot(R["head"], (0, Z), (0.3, [-25, 0, 0]), (0.55, [5, 0, 0]), (L, Z))
        pos(R["body"], (0, Z), (0.3, [0, 0.8, 0]), (0.55, Z), (L, Z))
        for w, s in R["wings"]: rot(w, (0, Z), (0.3, [0, 0, 45 if s == "r" else -45]), (0.45, [0, 0, 25 if s == "r" else -25]), (0.55, [0, 0, 50 if s == "r" else -50]), (L, Z))
    elif kind == "breath": # sopro: puxa o ar para trás, cabeça avança, boca aberta
        L = 1.3
        rot(R["head"], (0, Z), (0.35, [-30, 0, 0]), (0.5, [20, 0, 0]), (1.0, [18, 0, 0]), (L, Z))
        rot(R["body"], (0, Z), (0.35, [-12, 0, 0]), (0.5, [10, 0, 0]), (L, Z))
        rot(R["jaw"], (0, Z), (0.35, [10, 0, 0]), (0.5, [45, 0, 0]), (1.0, [42, 0, 0]), (L, Z))
        for w, s in R["wings"]: rot(w, (0, Z), (0.35, [0, 0, 45 if s == "r" else -45]), (L, Z))
        rot(R["rarm"], (0, Z), (0.35, [-40, 0, 20]), (0.5, [-60, 0, 10]), (L, Z)); rot(R["larm"], (0, Z), (0.35, [-40, 0, -20]), (0.5, [-60, 0, -10]), (L, Z))
    elif kind == "spin":  # giro: varredura de 360° (cauda/arma)
        L = 1.0
        rot(R["body"], (0, Z), (0.3, [0, -40, 0]), (0.55, [0, 320, 0]), (0.75, [0, 360, 0]), (L, [0, 360, 0]))
        rot(R["rarm"], (0, Z), (0.3, [-90, 0, 60]), (0.75, [-90, 0, 60]), (L, Z)); rot(R["larm"], (0, Z), (0.3, [-90, 0, -60]), (0.75, [-90, 0, -60]), (L, Z))
        rot(R["tail"], (0, Z), (0.3, [0, -60, 0]), (0.55, [0, 70, 0]), (L, Z))
    elif kind == "flinch": # reação ao dano
        L = 0.4
        rot(R["body"], (0, Z), (0.08, [-10, 0, 4]), (L, Z)); rot(R["head"], (0, Z), (0.08, [-14, 0, -6]), (L, Z))
        rot(R["rarm"], (0, Z), (0.08, [-15, 0, 12]), (L, Z)); rot(R["larm"], (0, Z), (0.08, [-15, 0, -12]), (L, Z))
    B = {k: v for k, v in B.items() if k}
    return {"animation_length": L, "bones": B} if B else None
KINDS = ["swing", "slam", "lunge", "roar", "cast", "breath", "spin", "flinch"]
def main():
    anims, table, skipped = {}, {}, []
    for idn in IDS:
        d = client(idn)
        if not d: skipped.append(idn + " (sem cliente)"); continue
        gid = list(d.get("geometry", {}).values())[0]
        bones = bones_of(gid)
        if not bones: skipped.append(idn + " (modelo " + gid + ")"); continue
        R = pick(bones); key = re.sub(r"[^a-z0-9_]", "_", gid.replace("geometry.", "").lower())
        kinds = []
        for k in KINDS:
            a = anim(R, k)
            if a: anims[f"animation.etheria.bc.{key}.{k}"] = a; kinds.append(k)
        table[idn] = {"g": key, "k": kinds, "wings": bool(R["wings"]), "arms": bool(R["rarm"] or R["larm"])}
    json.dump({"format_version": "1.8.0", "animations": anims}, open(os.path.join(RP, "animations/etheria_boss_combat.animation.json"), "w"), indent=0)
    open(os.path.join(BP, "scripts/data/bossanim.gen.js"), "w").write("// GERADO por tools/boss_anims.py - animações de combate por chefe (modelo + tipos disponíveis).\nexport const BOSS_ANIM = " + json.dumps(table, ensure_ascii=False) + ";\n")
    print(len(table), "chefes,", len(anims), "animações; sem modelo:", skipped)
    for k, v in list(table.items())[:70]: print(" ", k, v["g"], v["k"], "asas" if v["wings"] else "")
if __name__ == "__main__": main()

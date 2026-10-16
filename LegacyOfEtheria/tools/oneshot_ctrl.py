# 6.58 - CORREÇÃO "ATAQUE/TRANSFORMAÇÃO SÓ FUNCIONA UMA VEZ".
# Causa: animações SEM repetição (loop false) colocadas direto em scripts.animate com condição ({"anim": "condição"}). O Bedrock toca a
# animação uma vez e ela fica parada no último quadro: quando a condição volta a valer (novo golpe, novo dano, nova transformação) ela NÃO
# reinicia. Correção: cada uma vira um CONTROLADOR de animação (espera -> toca -> volta a esperar quando acabou e a condição caiu), que
# reinicia do zero a cada disparo. Vale para todas as entidades do pacote de recursos (inclusive o jogador).
# Uso: python3 tools/oneshot_ctrl.py   (idempotente; rode depois de tools/humanoid_life.py e dos geradores de raça)
import json, glob, os, hashlib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
SKIP = {"move.sneak"}   # poses mantidas enquanto agachado (não são golpes)
ANIM = {}
for f in glob.glob(os.path.join(RP, "animations", "**", "*.json"), recursive=True):
    try: ANIM.update(json.load(open(f)).get("animations", {}))
    except Exception: pass
CP = os.path.join(RP, "animation_controllers", "etheria_oneshot.animation_controllers.json")
C = {}; n_ent = n_conv = 0
for f in sorted(glob.glob(os.path.join(RP, "entity", "*.json"))):
    E = json.load(open(f)); D = E["minecraft:client_entity"]["description"]; an = D.get("animations") or {}; sc = D.get("scripts") or {}
    out, changed = [], False
    for x in sc.get("animate", []):
        if isinstance(x, dict) and len(x) == 1:
            short, cond = next(iter(x.items())); a = ANIM.get(an.get(short, ""))
            if a is not None and a.get("loop", False) is False and short not in SKIP and not str(an.get(short, "")).startswith("controller."):
                h = hashlib.md5(f"{short}|{cond}".encode()).hexdigest()[:8]; cid = f"controller.animation.etheria.os.{short.replace('.', '_')}_{h}"
                C[cid] = {"initial_state": "wait", "states": {
                    "wait": {"transitions": [{"play": f"({cond})"}]},
                    "play": {"animations": [short], "blend_transition": 0.12, "transitions": [{"wait": f"query.all_animations_finished && !({cond})"}]}}}
                key = f"os_{short.replace('.', '_')}"; an[key] = cid; out.append(key); changed = True; n_conv += 1; continue
        out.append(x)
    if changed:
        sc["animate"] = out; D["animations"] = an; json.dump(E, open(f, "w"), indent=1); n_ent += 1
old = json.load(open(CP))["animation_controllers"] if os.path.exists(CP) else {}
old.update(C)
json.dump({"format_version": "1.10.0", "animation_controllers": old}, open(CP, "w"), indent=1)
print("entidades:", n_ent, "| animações convertidas:", n_conv, "| controladores:", len(old))

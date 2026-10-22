"""ETAPA 4 - VOO DO DRAGÃO DO JOGADOR (raça Dragonoide, última forma: linhagens Veldora e Veldanava, as aladas) imitando o vídeo de
referência (Saint's Dragons): corpo na HORIZONTAL, envergadura larga, batidas amplas e lentas, longos trechos PLANANDO com o corpo
inclinando de leve (ondulação), MERGULHO com as asas recolhidas para trás.
Regras de animação que funcionam no jogo do usuário: arquivo pequeno, loop com animation_length 3600 + query.anim_time, estado do voo
lido da propriedade NUMÉRICA etheria:fly (systems/flight.js: 0 chão/queda · 1 pairando · 2 subindo · 3 planando/voo rápido · 4 descendo),
condições só com query.property / query.is_on_ground (sem query.vertical_speed nem variáveis do pre_animation).
Substitui no player.entity.json as entradas antigas drg_fly/drg_glide/drg_v_fly/drg_v_glide (que usavam vertical_speed) pelas novas.
Velzard/Velgrynd (serpentes) mantêm o voo serpente; as outras raças não mudam.
Uso: python3 tools/dragon_ref_flight.py   (idempotente)"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
T = "query.anim_time"
TAILS = ["d_tail1", "d_tail2", "d_tail3", "d_tail4", "d_tail5"]
# estados: valor de etheria:fly -> parâmetros (f = velocidade da batida em graus/s, a = amplitude, env = batidas intermitentes ao planar)
ST = {"hover": dict(fly=[1], f=200, a=40, env=False), "rise": dict(fly=[2], f=290, a=50, env=False),
      "glide": dict(fly=[0, 3], f=230, a=38, env=True), "dive": dict(fly=[4], f=150, a=4, env=False)}
IX = {"hover": 0, "rise": 1, "glide": 2, "dive": 3}
def pick(st, *v): return v[IX[st]]
def n(x): return f"({x})" if isinstance(x, str) else str(x)

def common(st, p):
    f, g = p["f"], st == "glide"
    beat = f"math.sin({T} * {f})"; lag = lambda d: f"math.sin({T} * {f} - {d})"
    amp = f"{p['a']} * math.clamp(math.sin({T} * 60) * 1.6 + 0.25, 0, 1)" if p["env"] else str(p["a"])   # planando: ~3 s batendo, ~3 s parado
    roll = f"math.sin({T} * 45) * 9" if g else "0"                                                      # corpo inclinando de leve (ondulação)
    bob = f"-{beat} * {n(amp)} * 0.07"
    return beat, lag, amp, roll, bob

def veldora(st):
    """Veldora: modelo bípede em pé -> inclina o corpo todo (d_All) para a horizontal e compensa pescoço/cauda; asas abertas por z
    e batidas por y (eixo do corpo deitado)."""
    p = ST[st]; beat, lag, amp, roll, bob = common(st, p)
    pit = pick(st, 42, 48, 78, 100)
    B = {"d_All": {"rotation": [f"{pit} + {lag(90)} * 3", 0, roll], "position": [0, bob, 0]},
         "d_neck1": {"rotation": [f"{-pit * 0.5} + {lag(60)} * 3", 0, 0]}, "d_neck2": {"rotation": [-pit * 0.12, 0, 0]},
         "d_head": {"rotation": [f"{-pit * 0.3} + {lag(100)} * 2", f"math.sin({T} * 45 - 80) * 6" if st == "glide" else 0, 0]}}
    for i, tb in enumerate(TAILS):
        B[tb] = {"rotation": [f"{(str(-pit * 0.75) + ' + ') if i == 0 else ''}{lag(40 + i * 35)} * {2 + i}", f"math.sin({T} * 90 - {i * 45}) * {3 + i * 1.5}", 0]}
    for s in ("left", "right"):
        B[f"d_{s}_leg"] = {"rotation": [pick(st, 10, 15, 25, 35), 0, 0]}; B[f"d_{s}_leg_lower"] = {"rotation": [pick(st, 25, 30, 35, 20), 0, 0]}
        B[f"d_{s}_arm"] = {"rotation": [pick(st, -25, -30, -45, -55), 0, 0]}; B[f"d_{s}_arm_lower"] = {"rotation": [pick(st, -30, -30, -40, -45), 0, 0]}
    # asas: aberta = base z ~18 (envergadura máxima, como no vídeo), mergulho = z 75 (recolhida para trás); batida = base y
    for s, sg in (("left", ""), ("right", "-")):
        B[f"d_{s}_wing_base"] = {"rotation": [-15, f"{sg}({pick(st, -6, -8, -6, 12)} + {n(amp)} * {beat})", f"{sg}{pick(st, 32, 28, 18, 75)}"]}
        B[f"d_{s}_wing_top"] = {"rotation": [0, f"{sg}{n(amp)} * 0.35 * {lag(40)}", f"{sg}{pick(st, 40, 40, 40, 20)} * -1"]}
        B[f"d_{s}_wing_mid"] = {"rotation": [0, f"{sg}{n(amp)} * 0.3 * {lag(80)}", f"{sg}{pick(st, 60, 55, 62, 20)} * -1"]}
        B[f"d_{s}_wing_low"] = {"rotation": [0, 0, f"{sg}({-pick(st, 30, 30, 32, 10)} + {n(amp)} * 0.25 * {lag(110)})"]}
    return {"loop": True, "animation_length": 3600, "bones": B}

def veldanava(st):
    """Veldanava: quadrúpede já na horizontal com as asas abertas em V -> inclinação do corpo e asas (batida por z)."""
    p = ST[st]; beat, lag, amp, roll, bob = common(st, p)
    pit = pick(st, -14, -20, 0, 24)
    B = {"d_All": {"rotation": [f"{pit} + {lag(90)} * 2", 0, roll], "position": [0, bob, 0]},
         "d_neck1": {"rotation": [f"{-pit * 0.4} + {lag(60)} * 2", 0, 0]},
         "d_head": {"rotation": [f"{-pit * 0.3} + {lag(100)} * 2", f"math.sin({T} * 45 - 80) * 5" if st == "glide" else 0, 0]}}
    for i, tb in enumerate(TAILS):
        B[tb] = {"rotation": [f"{lag(40 + i * 35)} * {1.5 + i * 0.5}", f"math.sin({T} * 90 - {i * 45}) * {2 + i}", 0]}
    for s in ("left", "right"):
        B[f"d_{s}_leg"] = {"rotation": [pick(st, 30, 35, 45, 50), 0, 0]}; B[f"d_{s}_leg_lower"] = {"rotation": [-35, 0, 0]}
        B[f"d_{s}_arm"] = {"rotation": [pick(st, -25, -30, -40, -50), 0, 0]}; B[f"d_{s}_arm_lower"] = {"rotation": [45, 0, 0]}
    # asas (z negativo = sobe): aberta e plana ao planar (base -20, ponta erguida), mergulho = asas erguidas e varridas para trás
    for s, sg in (("left", ""), ("right", "-")):
        B[f"d_{s}_wing_base"] = {"rotation": [0, f"{sg}{pick(st, 0, 0, 0, -30)}", f"{sg}({pick(st, -10, -10, -20, -40)} - {n(amp)} * {beat})"]}
        B[f"d_{s}_wing_top"] = {"rotation": [0, 0, f"{sg}({pick(st, -10, -10, -15, 10)} - {n(amp)} * 0.5 * {lag(40)})"]}
        B[f"d_{s}_wing_mid"] = {"rotation": [0, 0, f"{sg}({pick(st, -30, -30, -40, 20)} - {n(amp)} * 0.4 * {lag(80)})"]}
    return {"loop": True, "animation_length": 3600, "bones": B}

def main():
    A = {}
    for st in ST: A[f"animation.etheria_pdrg.ref_{st}"] = veldora(st); A[f"animation.etheria_pdrg_veldanava.ref_{st}"] = veldanava(st)
    json.dump({"format_version": "1.8.0", "animations": A}, open(os.path.join(RP, "animations/etheria_pdrg_refflight.animation.json"), "w"), separators=(",", ":"))
    pe = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(pe)); D_ = E["minecraft:client_entity"]["description"]
    LF = "(query.property('etheria:lform') == 'true' || query.property('etheria:lform') == 'draconic')"
    FP = "query.property('etheria:fly')"
    for k in [k for k in D_["animations"] if k.startswith(("drg_ref_", "drg_v_ref_"))]: del D_["animations"][k]
    an = D_["scripts"]["animate"]
    old = ("drg_fly", "drg_glide", "drg_v_fly", "drg_v_glide")
    an[:] = [a for a in an if not (isinstance(a, dict) and any(k in old or k.startswith(("drg_ref_", "drg_v_ref_")) for k in a)) and a not in old]
    for st, p in ST.items():
        cond = "(" + " || ".join(f"{FP} == {v}" for v in p["fly"]) + ")"
        for lin, key, an_id in (("veldora", f"drg_ref_{st}", f"animation.etheria_pdrg.ref_{st}"), ("veldanava", f"drg_v_ref_{st}", f"animation.etheria_pdrg_veldanava.ref_{st}")):
            D_["animations"][key] = an_id
            an.append({key: f"query.property('etheria:lin') == '{lin}' && {LF} && !query.is_on_ground && {cond}"})
    open(pe, "w").write(json.dumps(E, indent=1) + "\n")
    print("ok: voo de referência (Veldora, Veldanava):", len(A), "animações")
if __name__ == "__main__": main()

"""6.95 - Animações de ação que faltavam:
- chefes Velzard/Velgrynd (serpentes em espiral): mordida, garra, chicote de cauda, rugido, giro de habilidade, decolar, pousar,
  dano e morte (a espiral desenrola e cai); ataque do jogador nessas formas
- Dragão Marinho: dano, morte (vira de barriga e afunda) e debatida fora d'água
- Veldanava: ambiente (olha em volta, espreguiça as asas, eriça as penas, mexe as garras, respira, balança a cauda)
Rodar depois de dragon_real.py / sea_dragon.py (dragon_real chama no final)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from serpent_float import chain
RP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "LegacyOfEtheria_RP")
T = "query.anim_time"
def ease(a, b): return f"math.clamp(({T} - {a}) / {b - a}, 0, 1)"
def bell(a, b): return f"math.sin(180 * {ease(a, b)})"
def smooth(a, b): return f"((1 - math.cos(180 * {ease(a, b)})) / 2)"
def R(x=0, y=0, z=0): return {"rotation": [x, y, z]}

def serp_acts(l):
    ch = chain(l); N = len(ch); tail0 = N // 3
    A = {}
    b = {n: R(f"-18 * {bell(0, 0.3)} + 24 * {bell(0.25, 0.55)}") for n in ("d_neck1", "d_neck2", "d_neck3")}
    b["d_head"] = R(f"-14 * {bell(0, 0.3)} + 18 * {bell(0.25, 0.55)}"); b["d_lower_jaw"] = R(f"44 * {bell(0.05, 0.42)}")
    b["d_body"] = R(f"5 * {bell(0.25, 0.55)}")
    A["bite"] = (0.7, b)
    b = {"d_left_arm": R(f"-75 * {bell(0, 0.28)} + 55 * {bell(0.22, 0.5)}"), "d_right_arm": R(f"-75 * {bell(0.08, 0.36)} + 55 * {bell(0.3, 0.58)}"),
         "d_left_hand": R(f"35 * {bell(0.2, 0.45)}"), "d_right_hand": R(f"35 * {bell(0.28, 0.55)}"), "d_upper_body": R(0, f"14 * {bell(0.1, 0.55)}"),
         "d_head": R(f"-10 * {bell(0, 0.5)}"), "d_lower_jaw": R(f"20 * {bell(0, 0.5)}")}
    A["claw"] = (0.6, b)
    b = {n: R(0, f"16 * math.sin(math.clamp({T} * 540 - {(i - tail0) * 16}, 0, 360)) * (1 - {T})", 0) for i, n in enumerate(ch) if i >= tail0}
    b["d_All"] = R(0, f"28 * {bell(0, 1.0)}"); b["d_head"] = R(0, f"-20 * {bell(0, 1.0)}")
    A["tail"] = (1.0, b)
    b = {n: R(f"-14 * {bell(0, 1.3)}") for n in ("d_neck1", "d_neck2", "d_neck3")}
    b["d_head"] = R(f"-30 * {bell(0, 1.3)}"); b["d_lower_jaw"] = R(f"50 * {bell(0.1, 1.25)}")
    b["d_All"] = {"position": [0, f"4 * {bell(0, 1.4)}", 0], "rotation": [0, 0, f"2.5 * math.sin({T} * 2400) * {bell(0.2, 1.2)}"]}
    for i, n in enumerate(ch): b[n] = R(f"2.2 * {bell(0, 1.4)}")                  # a espiral aperta
    for s in ("left", "right"): b[f"d_{s}_arm"] = R(f"-40 * {bell(0.1, 1.2)}"); b[f"d_{s}_hand"] = R(f"30 * {bell(0.1, 1.2)}")
    A["roar"] = (1.4, b)
    b = {"d_All": {"rotation": [0, f"360 * {smooth(0, 1.2)}", 0], "position": [0, f"6 * {bell(0, 1.2)}", 0]},
         "d_left_arm": R(0, 0, f"45 * {bell(0, 1.2)}"), "d_right_arm": R(0, 0, f"-45 * {bell(0, 1.2)}"), "d_head": R(f"-20 * {bell(0, 1.2)}"), "d_lower_jaw": R(f"30 * {bell(0.2, 1.1)}")}
    A["ability"] = (1.2, b)
    b = {"d_All": {"position": [0, f"12 * {smooth(0, 0.8)}", 0], "rotation": [f"-10 * {bell(0, 0.8)}", 0, 0]}}
    for i, n in enumerate(ch): b[n] = R(f"-2.5 * {bell(0, 0.8)}")
    A["takeoff"] = (0.8, b)
    b = {"d_All": {"position": [0, f"-6 * {bell(0, 0.6)}", 0]}}
    for i, n in enumerate(ch): b[n] = R(f"2.5 * {bell(0, 0.6)}")
    A["landing"] = (0.6, b)
    b = {"d_head": R(f"-22 * {bell(0, 0.4)}"), "d_neck3": R(f"-10 * {bell(0, 0.4)}"), "d_All": R(0, 0, f"6 * {bell(0, 0.4)}")}
    for i, n in enumerate(ch): b[n] = R(0, f"{3 if i % 2 else -3} * {bell(0, 0.4)}")
    A["hurt"] = (0.4, b)
    b = {"d_All": {"rotation": [0, 0, f"80 * {smooth(0.6, 2.2)}"], "position": [0, f"-14 * {smooth(0.8, 2.3)}", 0]},
         "d_lower_jaw": R(f"35 * {smooth(0.2, 1.4)}"), "d_head": R(f"25 * {smooth(0.4, 1.8)}"), "d_neck1": R(f"14 * {smooth(0.4, 1.8)}")}
    for i, n in enumerate(ch): b[n] = R(f"-5.5 * {smooth(0.2, 2.0)}", f"{(i % 5 - 2) * 0.8} * {smooth(0.4, 2.0)}")   # desenrola
    for s in ("left", "right"): b[f"d_{s}_arm"] = R(f"40 * {smooth(0.4, 1.6)}")
    A["death"] = (2.4, b)
    out = {}
    for k, (L, bones) in A.items():
        out[f"animation.etheria_serp_{l}.{k}"] = {"loop": "hold_on_last_frame" if k == "death" else False, "animation_length": L, "bones": bones}
    # ataque do jogador nessas formas (acompanha variable.attack_time, como os outros dragões)
    a = "math.sin(variable.attack_time * 180)"
    out[f"animation.etheria_serp_{l}.player_attack"] = {"loop": True, "bones": {
        "d_neck1": R(f"16 * {a}"), "d_neck2": R(f"12 * {a}"), "d_neck3": R(f"10 * {a}"), "d_head": R(f"20 * {a}"),
        "d_lower_jaw": R(f"45 * {a} * (1 - variable.attack_time)"), "d_right_arm": R(f"-55 * {a}"), "d_left_arm": R(f"-25 * {a}")}}
    return out

def sea_acts():
    names = ["sd_body"] + [f"sd_t{i}" for i in range(1, 14)]
    out = {}
    b = {"sd_head": R(f"-16 * {bell(0, 0.35)}"), "sd_neck": R(f"-8 * {bell(0, 0.35)}"), "sd_jaw": R(f"25 * {bell(0, 0.35)}")}
    for i, n in enumerate(names): b[n] = R(0, f"{5 if i % 2 else -5} * {bell(0, 0.35)}")
    out["animation.etheria.sea_dragon.hurt"] = {"loop": False, "animation_length": 0.35, "bones": b}
    b = {"sd_root": {"rotation": [0, 0, f"175 * {smooth(0.2, 1.6)}"], "position": [0, f"-12 * {smooth(0.5, 2.5)}", 0]},
         "sd_jaw": R(f"30 * {smooth(0.1, 1.0)}"), "sd_head": R(f"12 * {smooth(0.3, 1.5)}")}
    for i, n in enumerate(names): b[n] = R(0, f"math.sin({T} * 300 - {i * 30}) * 6 * (1 - {ease(0, 2.0)})")
    for s, sg in (("l", 1), ("r", -1)): b[f"sd_fin_{s}"] = R(0, 0, f"{-sg} * 35 * {smooth(0.4, 1.8)}"); b[f"sd_fin2_{s}"] = R(0, 0, f"{-sg} * 25 * {smooth(0.4, 1.8)}")
    out["animation.etheria.sea_dragon.death"] = {"loop": "hold_on_last_frame", "animation_length": 2.5, "bones": b}
    b = {"sd_root": {"position": [0, f"math.abs(math.sin({T} * 380)) * 3", 0], "rotation": [0, 0, f"math.sin({T} * 380) * 12"]},
         "sd_jaw": R(f"math.max(0, math.sin({T} * 260)) * 30"), "sd_head": R(f"math.sin({T} * 380 + 60) * 12")}
    for i, n in enumerate(names): b[n] = R(f"math.sin({T} * 380 - {i * 25}) * 4", f"math.sin({T} * 700 - {i * 40}) * 14")
    for s, sg in (("l", 1), ("r", -1)): b[f"sd_fin_{s}"] = R(f"math.sin({T} * 900) * 30", 0, f"{sg} * math.sin({T} * 900 + 90) * 25")
    out["animation.etheria.sea_dragon.flop"] = {"loop": True, "animation_length": 3600, "bones": b}
    return out

QUAD_PFX = {"shock": "etheria:fx_is_shockwave", "ring": "etheria:fx_is_ring_smoke", "spark": "etheria:fx_is_spark", "fog": "etheria:fx_is_fog", "dust": "etheria:earth_chunk"}
SERP_PFX = {"velzard": "etheria:fx_is_snowflake", "velgrynd": "etheria:fx_is_embers", "veldanava": "etheria:fx_is_wisp"}
PFX_TIMES = {"roar": {"0.25": ["shock", "elem"]}, "ability": {"0.1": ["elem"], "0.6": ["elem", "shock"]}, "death": {"0.3": ["fog"], "1.9": ["shock", "dust"]},
             "takeoff": {"0.35": ["ring", "dust"]}, "landing": {"0.45": ["ring", "dust"]}, "bite": {"0.35": ["spark"]}, "claw": {"0.4": ["spark"]}, "tail": {"0.3": ["ring"]}, "hurt": {"0.0": ["spark"]}}

def with_pfx(anims, prefix):
    """põe os efeitos de partícula na linha do tempo das ações (o cliente do chefe mapeia os nomes curtos)"""
    for name, a in anims.items():
        if not name.startswith(prefix): continue
        act = name.split(".")[-1]
        if act in PFX_TIMES:
            a["particle_effects"] = {t: [{"effect": e} for e in es] for t, es in PFX_TIMES[act].items()}
    return anims

def quad_acts(l="veldanava"):
    """Veldanava (quadrúpede alado): conjunto completo de animações próprias"""
    out = {}
    ph = "(query.modified_distance_moved * 26)"; A = "math.min(1, query.modified_move_speed * 3)"
    def gait(k, sp):
        p = f"({ph} * {sp})"
        b = {"d_body": {"position": [0, f"math.abs(math.sin({p})) * {1.2 * k} * {A}", 0], "rotation": [f"-{2 * (k - 1)} * {A}", f"math.sin({p}) * 3 * {A}", f"math.sin({p}) * 2 * {A}"]},
             "d_neck1": R(f"math.sin({p} * 2) * 2 * {A}", f"-math.sin({p}) * 3 * {A}"), "d_head": R(f"math.sin({p} * 2 + 40) * 2 * {A}", f"-math.sin({p}) * 2 * {A}")}
        for limb, off in (("left_arm", 0), ("right_leg", 0), ("right_arm", 180), ("left_leg", 180)):   # passo diagonal
            b[f"d_{limb}"] = R(f"math.sin({p} + {off}) * {24 * k} * {A}")
            b[f"d_{limb}_lower"] = R(f"-math.max(0, -math.cos({p} + {off})) * {30 * k} * {A}")
        for s_ in ("left", "right"): b[f"d_{s_}_hand"] = R(f"math.max(0, math.cos({ph} * {sp} + {0 if s_ == 'left' else 180})) * 25 * {A}")
        for i in range(1, 6): b[f"d_tail{i}"] = R(0, f"math.sin({p} - {i * 40}) * {(4 + i * 2) * k} * {A}")
        return {"loop": True, "bones": b}
    out[f"animation.etheria_q_{l}.walk"] = gait(1.0, 1.0)
    out[f"animation.etheria_q_{l}.run"] = gait(1.6, 1.35)
    F = 260; P = round(360 / F, 4)
    def wings(base_amp, top_amp, mid_amp, low_amp, bias=0):
        b = {}
        for s_, sg in (("left", -1), ("right", 1)):
            b[f"d_{s_}_wing_base"] = R(0, f"{sg} * math.sin({T} * {F} - 20) * 6", f"{sg} * (math.sin({T} * {F}) * {base_amp} + {bias})")
            b[f"d_{s_}_wing_top"] = R(0, 0, f"{sg} * math.sin({T} * {F} - 40) * {top_amp}")
            b[f"d_{s_}_wing_mid"] = R(0, 0, f"{sg} * math.sin({T} * {F} - 80) * {mid_amp}")
            b[f"d_{s_}_wing_low"] = R(f"math.sin({T} * {F} - 100) * {low_amp}", 0, 0)
        return b
    b = wings(42, 24, 18, 8)
    b["d_All"] = {"position": [0, f"-math.sin({T} * {F}) * 2", 0]}
    b["d_body"] = R(f"-8 + math.sin({T} * {F} + 180) * 2")
    for s_ in ("left", "right"):
        b[f"d_{s_}_leg"] = R(45); b[f"d_{s_}_leg_lower"] = R(-40); b[f"d_{s_}_arm"] = R(-35); b[f"d_{s_}_arm_lower"] = R(50)
    b["d_neck1"] = R(f"10 + math.sin({T} * {F} - 60) * 2"); b["d_neck2"] = R(-6); b["d_head"] = R(f"-4 + math.sin({T} * {F} - 90) * 2")
    for i in range(1, 6): b[f"d_tail{i}"] = R(f"math.sin({T} * {F} - {i * 40}) * 3", f"math.sin({T} * {F} - {i * 50}) * {2 + i}")
    out[f"animation.etheria_q_{l}.fly"] = {"loop": True, "animation_length": P, "bones": b,
                                           "particle_effects": {str(round(P * 0.3, 3)): [{"effect": "ring"}]}}   # lufada de vento a cada batida
    b = wings(3, 2, 2, 3, bias=-30)
    b["d_body"] = R(-4)
    for s_ in ("left", "right"): b[f"d_{s_}_leg"] = R(45); b[f"d_{s_}_leg_lower"] = R(-40); b[f"d_{s_}_arm"] = R(-35); b[f"d_{s_}_arm_lower"] = R(50)
    for i in range(1, 6): b[f"d_tail{i}"] = R(0, f"math.sin({T} * {F} - {i * 50}) * {1 + i * 0.6}")
    out[f"animation.etheria_q_{l}.glide"] = {"loop": True, "animation_length": P, "bones": b}
    acts = {}
    b = {"d_All": {"position": [0, f"-4 * {bell(0, 0.4)} + 10 * {smooth(0.35, 1.0)}", 0]}, "d_body": R(f"6 * {bell(0, 0.4)} - 10 * {bell(0.35, 1.0)}")}
    for s_, sg in (("left", -1), ("right", 1)):
        b[f"d_{s_}_wing_base"] = R(0, 0, f"{sg} * (30 * {bell(0, 0.35)} - 60 * {bell(0.3, 0.7)})"); b[f"d_{s_}_wing_top"] = R(0, 0, f"{sg} * -25 * {bell(0.35, 0.75)}")
        b[f"d_{s_}_leg"] = R(f"-20 * {bell(0, 0.4)} + 40 * {smooth(0.45, 1.0)}"); b[f"d_{s_}_leg_lower"] = R(f"30 * {bell(0, 0.4)} - 40 * {smooth(0.45, 1.0)}")
        b[f"d_{s_}_arm"] = R(f"20 * {bell(0, 0.4)} - 35 * {smooth(0.45, 1.0)}")
    acts["takeoff"] = (1.0, b)
    b = {"d_All": {"position": [0, f"-5 * {bell(0.4, 0.8)}", 0]}, "d_body": R(f"-8 * {bell(0, 0.45)} + 5 * {bell(0.4, 0.8)}")}
    for s_, sg in (("left", -1), ("right", 1)):
        b[f"d_{s_}_wing_base"] = R(0, 0, f"{sg} * (35 * {bell(0, 0.5)})"); b[f"d_{s_}_leg"] = R(f"-25 * {bell(0.35, 0.8)}"); b[f"d_{s_}_leg_lower"] = R(f"35 * {bell(0.35, 0.8)}")
        b[f"d_{s_}_arm"] = R(f"-20 * {bell(0, 0.4)} + 20 * {bell(0.4, 0.8)}")
    acts["landing"] = (0.8, b)
    b = {n: R(f"-16 * {bell(0, 0.3)} + 22 * {bell(0.25, 0.55)}") for n in ("d_neck1", "d_neck2", "d_neck3")}
    b["d_head"] = R(f"-12 * {bell(0, 0.3)} + 16 * {bell(0.25, 0.55)}"); b["d_lower_jaw"] = R(f"45 * {bell(0.05, 0.42)}"); b["d_upper_body"] = R(f"5 * {bell(0.25, 0.55)}")
    acts["bite"] = (0.7, b)
    b = {"d_body": R(f"-18 * {bell(0, 0.8)}"), "d_left_arm": R(f"-90 * {bell(0.15, 0.45)}"), "d_right_arm": R(f"-90 * {bell(0.3, 0.6)}"),
         "d_left_hand": R(f"30 * {bell(0.15, 0.45)}"), "d_right_hand": R(f"30 * {bell(0.3, 0.6)}"), "d_left_leg": R(f"14 * {bell(0, 0.8)}"), "d_right_leg": R(f"14 * {bell(0, 0.8)}"),
         "d_head": R(f"-10 * {bell(0, 0.8)}"), "d_lower_jaw": R(f"25 * {bell(0.1, 0.7)}")}
    for s_, sg in (("left", -1), ("right", 1)): b[f"d_{s_}_wing_base"] = R(0, 0, f"{sg} * 18 * {bell(0, 0.8)}")
    acts["claw"] = (0.8, b)
    b = {"d_All": R(0, f"40 * {bell(0, 1.0)}"), "d_neck1": R(0, f"-15 * {bell(0, 1.0)}")}
    for i in range(1, 6): b[f"d_tail{i}"] = R(0, f"math.sin(math.clamp({T} * 540 - {i * 30}, 0, 360)) * 20 * (1 - {T})")
    acts["tail"] = (1.0, b)
    b = {"d_neck1": R(f"-20 * {bell(0, 1.5)}"), "d_neck2": R(f"-10 * {bell(0, 1.5)}"), "d_head": R(f"-30 * {bell(0, 1.5)}"), "d_lower_jaw": R(f"50 * {bell(0.1, 1.4)}"),
         "d_body": R(f"-10 * {bell(0, 1.6)}"), "d_All": R(0, 0, f"2 * math.sin({T} * 2400) * {bell(0.2, 1.3)}")}
    for s_, sg in (("left", -1), ("right", 1)): b[f"d_{s_}_wing_base"] = R(0, 0, f"{sg} * 30 * {bell(0.1, 1.5)}"); b[f"d_{s_}_wing_top"] = R(0, 0, f"{sg} * 20 * {bell(0.1, 1.5)}")
    acts["roar"] = (1.6, b)
    b = {"d_All": {"position": [0, f"6 * {bell(0, 1.2)}", 0]}, "d_head": R(f"-25 * {bell(0, 1.2)}"), "d_lower_jaw": R(f"30 * {bell(0.2, 1.1)}")}
    for s_, sg in (("left", -1), ("right", 1)): b[f"d_{s_}_wing_base"] = R(0, 0, f"{sg} * 45 * {bell(0, 1.2)}"); b[f"d_{s_}_wing_mid"] = R(0, 0, f"{sg} * -20 * {bell(0, 1.2)}")
    acts["ability"] = (1.2, b)
    b = {"d_head": R(f"-20 * {bell(0, 0.45)}"), "d_neck2": R(f"-10 * {bell(0, 0.45)}"), "d_body": R(0, 0, f"8 * {bell(0, 0.45)}")}
    for s_, sg in (("left", -1), ("right", 1)): b[f"d_{s_}_wing_base"] = R(0, 0, f"{sg} * 12 * {bell(0, 0.45)}")
    acts["hurt"] = (0.45, b)
    b = {"d_All": {"rotation": [0, 0, f"85 * {smooth(0.8, 2.2)}"], "position": [0, f"-6 * {smooth(0.6, 2.2)}", 0]},
         "d_neck1": R(f"25 * {smooth(0.5, 2.0)}"), "d_head": R(f"20 * {smooth(0.5, 2.0)}"), "d_lower_jaw": R(f"30 * {smooth(0.2, 1.2)}")}
    for s_, sg in (("left", -1), ("right", 1)):
        b[f"d_{s_}_leg"] = R(f"60 * {smooth(0.3, 1.2)}"); b[f"d_{s_}_leg_lower"] = R(f"-50 * {smooth(0.3, 1.2)}"); b[f"d_{s_}_arm"] = R(f"-40 * {smooth(0.3, 1.2)}")
        b[f"d_{s_}_wing_base"] = R(0, 0, f"{sg} * -40 * {smooth(0.6, 2.4)}"); b[f"d_{s_}_wing_top"] = R(0, 0, f"{sg} * -20 * {smooth(0.8, 2.4)}")
    for i in range(1, 6): b[f"d_tail{i}"] = R(0, f"{(i % 3 - 1) * 6} * {smooth(0.6, 2.2)}")
    acts["death"] = (2.8, b)
    for k, (L, bones) in acts.items():
        out[f"animation.etheria_q_{l}.{k}"] = {"loop": "hold_on_last_frame" if k == "death" else False, "animation_length": L, "bones": bones}
    a = "math.sin(variable.attack_time * 180)"
    out[f"animation.etheria_q_{l}.player_attack"] = {"loop": True, "bones": {"d_neck1": R(f"14 * {a}"), "d_neck3": R(f"10 * {a}"), "d_head": R(f"30 * {a}"),
        "d_lower_jaw": R(f"45 * {a} * (1 - variable.attack_time)"), "d_right_arm": R(f"-60 * {a}"), "d_upper_body": R(f"8 * {a}")}}
    return out

def veldanava_ambient():
    st = f"math.pow(math.max(0, math.sin({T} * 40)), 8)"               # espreguiçar as asas (~a cada 9 s)
    rf = f"math.pow(math.max(0, math.sin({T} * 25 + 100)), 6)"         # eriçar as penas
    sw = f"math.pow(math.max(0, math.sin({T} * 35 + 200)), 3)"         # balançar a cauda
    cl = f"math.pow(math.max(0, math.sin({T} * 60)), 4)"               # garras
    b = {"d_neck1": R(f"math.sin({T} * 29) * 3", f"math.sin({T} * 17) * 8"), "d_neck3": R(0, f"math.sin({T} * 17 + 20) * 6"),
         "d_head": R(f"math.sin({T} * 31) * 5", f"math.sin({T} * 23 + 40) * 14", f"math.sin({T} * 19) * 4"),
         "d_upper_body": {"position": [0, f"math.sin({T} * 90) * 0.4", 0]}, "d_lower_jaw": R(f"{st} * 18")}
    for s, sg in (("left", 1), ("right", -1)):
        b[f"d_{s}_wing_base"] = R(0, 0, f"{sg} * -26 * {st}"); b[f"d_{s}_wing_top"] = R(0, f"{sg} * 8 * {st}", f"{sg} * -22 * {st}")
        b[f"d_{s}_wing_mid"] = R(f"math.sin({T} * 300) * 3 * {rf}", 0, f"{sg} * 16 * {st}"); b[f"d_{s}_wing_low"] = R(f"math.sin({T} * 320 + 40) * 5 * {rf}", 0, f"{sg} * 10 * {st}")
        b[f"d_{s}_hand"] = R(f"10 * {cl}"); b[f"d_{s}_hand_lower"] = R(f"18 * {cl}")
    for i in range(3, 6): b[f"d_tail{i}"] = R(0, f"{sw} * math.sin({T} * 200 - {i * 40}) * {6 + i * 2}")
    return {"animation.etheria_pdrg_veldanava.ambient": {"loop": True, "animation_length": 3600, "bones": b}}

def main():
    A = {}
    for l in ("velzard", "velgrynd"): A.update(serp_acts(l))
    A.update(sea_acts()); A.update(veldanava_ambient()); A.update(quad_acts())
    for l in ("velzard", "velgrynd"): with_pfx(A, f"animation.etheria_serp_{l}.")
    with_pfx(A, "animation.etheria_q_veldanava.")
    json.dump({"format_version": "1.8.0", "animations": A}, open(os.path.join(RP, "animations/etheria_dragon_acts.animation.json"), "w"), indent=1)
    FORM = "(query.property('etheria:lform') == 'true' || query.property('etheria:lform') == 'draconic')"
    # chefes
    for l in ("velzard", "velgrynd", "veldanava"):
        p = os.path.join(RP, f"entity/{l}.entity.json"); E = json.load(open(p)); D = E["minecraft:client_entity"]["description"]
        an = D["scripts"]["animate"]
        D["particle_effects"] = {**QUAD_PFX, "elem": SERP_PFX[l]}
        if l == "veldanava":
            D["animations"]["ambient"] = "animation.etheria_pdrg_veldanava.ambient"
            for k in ("walk", "run", "fly", "bite", "claw", "tail", "roar", "ability", "takeoff", "landing", "hurt", "death"): D["animations"][k] = f"animation.etheria_q_veldanava.{k}"
            D["animations"]["attack"] = "animation.etheria_q_veldanava.player_attack"; D["animations"].pop("gait", None)
            an[:] = [x for x in an if not (isinstance(x, dict) and list(x)[0] == "gait")]
            if not any(isinstance(x, dict) and "ambient" in x for x in an): an.insert(1, {"ambient": "query.property('etheria:form') == 'dragon' && query.is_alive"})
        else:
            for k in ("bite", "claw", "tail", "roar", "ability", "takeoff", "landing", "hurt", "death"): D["animations"][k] = f"animation.etheria_serp_{l}.{k}"
            D["animations"]["attack"] = f"animation.etheria_serp_{l}.player_attack"
        json.dump(E, open(p, "w"), indent=1)
    # jogador
    p = os.path.join(RP, "entity/player.entity.json"); E = json.load(open(p)); D = E["minecraft:client_entity"]["description"]; an = D["scripts"]["animate"]
    NOT = " && query.property('etheria:lin') != 'velzard' && query.property('etheria:lin') != 'velgrynd'"
    for x in an:
        if isinstance(x, dict) and list(x)[0] == "drg_attack" and NOT not in x["drg_attack"]: x["drg_attack"] += NOT
    adds = {f"drg_serp_attack_{l}": (f"animation.etheria_serp_{l}.player_attack", f"query.property('etheria:lin') == '{l}' && {FORM} && variable.attack_time > 0") for l in ("velzard", "velgrynd")}
    adds["drg_amb_veldanava"] = ("animation.etheria_pdrg_veldanava.ambient", f"query.property('etheria:lin') == 'veldanava' && {FORM}")
    # Veldanava do jogador: andar/correr/voar/planar/ataque próprios no lugar dos genéricos
    NV = " && query.property('etheria:lin') != 'veldanava'"
    for x in an:
        if isinstance(x, dict) and list(x)[0] in ("drg_walk", "drg_run", "drg_fly", "drg_glide", "drg_attack", "drg_breathe") and NV not in x[list(x)[0]]: x[list(x)[0]] += NV
        if isinstance(x, dict) and list(x)[0] == "drg_gait_veldanava": x["drg_gait_veldanava"] = "false"
    V = f"query.property('etheria:lin') == 'veldanava' && {FORM}"
    adds.update({"drg_v_walk": ("animation.etheria_q_veldanava.walk", f"{V} && query.is_on_ground && query.modified_move_speed > 0.05 && query.modified_move_speed <= 0.6"),
                 "drg_v_run": ("animation.etheria_q_veldanava.run", f"{V} && query.is_on_ground && query.modified_move_speed > 0.6"),
                 "drg_v_fly": ("animation.etheria_q_veldanava.fly", f"{V} && !query.is_on_ground && !query.is_in_water && query.vertical_speed > -1.0"),
                 "drg_v_glide": ("animation.etheria_q_veldanava.glide", f"{V} && !query.is_on_ground && !query.is_in_water && query.vertical_speed <= -1.0"),
                 "drg_v_attack": ("animation.etheria_q_veldanava.player_attack", f"{V} && variable.attack_time > 0")})
    D.setdefault("particle_effects", {}).setdefault("ring", "etheria:fx_is_ring_smoke")   # lufada de vento do voo da Veldanava
    for k, (anim, cond) in adds.items():
        D["animations"][k] = anim
        if not any(isinstance(x, dict) and k in x for x in an): an.append({k: cond})
    open(p, "w").write(json.dumps(E, indent=1, ensure_ascii=False) + "\n")
    # dragão marinho
    p = os.path.join(RP, "entity/sea_dragon.entity.json"); E = json.load(open(p)); D = E["minecraft:client_entity"]["description"]
    D["animations"].update({"hurt": "animation.etheria.sea_dragon.hurt", "death": "animation.etheria.sea_dragon.death", "flop": "animation.etheria.sea_dragon.flop"})
    D["scripts"]["animate"] = [{"swim": "query.is_alive"}, {"bite": "variable.attack_time > 0 && query.is_alive"}, {"hurt": "query.hurt_time > 0 && query.is_alive"},
                               {"flop": "!query.is_in_water && query.is_alive"}, {"death": "!query.is_alive"}]
    json.dump(E, open(p, "w"), indent=1)
    print("ok", len(A), "animações")

if __name__ == "__main__":
    main()

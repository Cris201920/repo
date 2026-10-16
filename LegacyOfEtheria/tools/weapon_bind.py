# 6.42 - ARMAS NA MÃO (correção): todas as armas 3D (attachables w_*) passam a usar o mesmo método do tridente/escudo do jogo:
# o osso "eth_weapon" é LIGADO ao osso do item ("binding": q.item_slot_to_bone_name(c.item_slot)) e há uma animação para a
# 1ª pessoa e outra para a 3ª pessoa. Antes a geometria copiava o esqueleto (rightArm/rightItem) e, na 1ª pessoa, a arma
# ficava fora da tela ("a espada não aparece na mão").
# Calibração (tools/fpsim, ver resposta 6.42): o osso ligado recebe o deslocamento (-6,-9,-1) do jogo (mesmo do guia oficial
# de attachables); a 3ª pessoa devolve +6,+9,+1 para manter a pose de antes (lâmina para a frente e para cima); a 1ª pessoa usa
# o enquadramento do Java (cabo embaixo à direita, lâmina subindo para o centro da tela).
# Idempotente: pode rodar quantas vezes quiser. Uso: python3 tools/weapon_bind.py
import json, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
BIND = "q.item_slot_to_bone_name(c.item_slot)"
TP_POS = [6.0, 9.0, 1.0]
FP_POS = [6.0, 13.0, 3.0]; FP_ROT = [45.0, 0.0, 45.0]
FP_SCALE_DEFAULT = 0.8          # Java: handheld 0,68 na 1ª pessoa / 0,85 na 3ª
ANIM_FILE = os.path.join(RP, "animations/etheria_weapons_hold.animation.json")

# 6.55: CORREÇÃO DA 1ª PESSOA, arma por arma. Antes todas usavam a mesma escala/posição e cada modelo tem o cabo num lugar e um
# comprimento (12 a 40 unidades): espadas longas atravessavam a tela e o cabo "flutuava" fora da mão.
#   1) o CABO de cada modelo é medido (cubos perto do pomo, no eixo da lâmina = Z) e o modelo é deslocado para o cabo ficar no pivô
#      do osso ligado à mão -> a rotação da 1ª pessoa gira em torno da empunhadura (cabo preso na mão);
#   2) a 3ª pessoa recebe o deslocamento inverso -> fica exatamente como antes (não piora a 3ª pessoa);
#   3) a escala da 1ª pessoa normaliza o comprimento VISÍVEL: alvo = 10 + 30% do comprimento real (11 a 20 unidades), então uma
#      montante continua maior que uma adaga, mas nenhuma cobre a tela. Deslocamentos ficam em tools/weapon_grip.json (idempotente).
GRIP_FILE = os.path.join(os.path.dirname(__file__), "weapon_grip.json")
def grip_shift(gp, grips, sid):
    g = json.load(open(gp)); G = g["minecraft:geometry"][0]; bones = G["bones"]
    w = next(b for b in bones if b["name"] == "eth_weapon"); pv = w["pivot"]
    cubes = [c for b in bones for c in b.get("cubes", [])]
    zs = [c["origin"][2] for c in cubes] + [c["origin"][2] + c["size"][2] for c in cubes]
    zmin, zmax = min(zs), max(zs); length = zmax - zmin
    if sid not in grips:
        near = [c for c in cubes if c["origin"][2] <= zmin + 4.5]   # pomo + cabo
        vol = lambda c: max(0.01, c["size"][0] * c["size"][1] * c["size"][2])
        tot = sum(vol(c) for c in near) or 1
        cx = sum((c["origin"][0] + c["size"][0] / 2) * vol(c) for c in near) / tot
        cy = sum((c["origin"][1] + c["size"][1] / 2) * vol(c) for c in near) / tot
        cz = zmin + min(3.0, length * 0.12)
        s = [round(pv[0] - cx, 3), round(pv[1] - cy, 3), round(pv[2] - cz, 3)]
        for b in bones:
            if b is not w and b.get("pivot"): b["pivot"] = [b["pivot"][i] + s[i] for i in range(3)]
            for c in b.get("cubes", []):
                c["origin"] = [round(c["origin"][i] + s[i], 4) for i in range(3)]
                if c.get("pivot"): c["pivot"] = [round(c["pivot"][i] + s[i], 4) for i in range(3)]
        json.dump(g, open(gp, "w"), indent=1)
        grips[sid] = {"shift": s, "length": round(length, 2)}
    return grips[sid]

def fp_scales():
    p = os.path.join(os.path.dirname(__file__), "weapon_fp.json")
    return json.load(open(p)) if os.path.exists(p) else {}

def bind_geo(path):
    g = json.load(open(path)); changed = False
    for G in g["minecraft:geometry"]:
        bones = G["bones"]
        if any(b.get("binding") for b in bones): continue
        keep = [b for b in bones if b["name"] not in ("rightArm", "rightItem")]
        for b in keep:
            if b["name"] == "eth_weapon": b.pop("parent", None); b["binding"] = BIND
        G["bones"] = keep; changed = True
        G["description"]["visible_bounds_width"] = max(G["description"].get("visible_bounds_width", 4), 6)
        G["description"]["visible_bounds_height"] = max(G["description"].get("visible_bounds_height", 4.5), 6)
    if g["format_version"] < "1.16.0": g["format_version"] = "1.16.0"; changed = True
    if changed: json.dump(g, open(path, "w"), indent=1)
    return changed

def main():
    sc = fp_scales(); anims = {}; n = 0
    grips = json.load(open(GRIP_FILE)) if os.path.exists(GRIP_FILE) else {}
    over = json.load(open(os.path.join(os.path.dirname(__file__), "weapon_fp_override.json"))) if os.path.exists(os.path.join(os.path.dirname(__file__), "weapon_fp_override.json")) else {}
    for ap in sorted(glob.glob(os.path.join(RP, "attachables/w_*.attachable.json"))):
        sid = os.path.basename(ap)[2:-len(".attachable.json")]
        a = json.load(open(ap)); d = a["minecraft:attachable"]["description"]
        gid = d["geometry"]["default"]; gp = os.path.join(RP, f"models/entity/etheria_w_{sid}.geo.json")
        if not os.path.exists(gp): print("sem geometria:", sid); continue
        bind_geo(gp)
        gr = grip_shift(gp, grips, sid); sh, L = gr["shift"], gr["length"]
        s = round(float(over[sid]) if sid in over else min(1.2, max(11.0, min(20.0, 10 + 0.3 * L)) / max(1.0, L)), 3)
        fp, tp = f"animation.etheria.w.{sid}.fp", f"animation.etheria.w.{sid}.tp"
        # 3ª pessoa: devolve o deslocamento do modelo (X da animação é espelhado em relação à geometria)
        anims[tp] = {"loop": True, "bones": {"eth_weapon": {"position": [round(TP_POS[0] + sh[0], 3), round(TP_POS[1] - sh[1], 3), round(TP_POS[2] - sh[2], 3)]}}}
        anims[fp] = {"loop": True, "bones": {"eth_weapon": {"position": FP_POS, "rotation": FP_ROT, "scale": s}}}
        d["animations"] = {"eth_fp": fp, "eth_tp": tp}
        d["scripts"] = {"animate": [{"eth_fp": "c.is_first_person"}, {"eth_tp": "!c.is_first_person"}]}
        json.dump(a, open(ap, "w"), indent=1); n += 1
    json.dump({"format_version": "1.10.0", "animations": anims}, open(ANIM_FILE, "w"), indent=1)
    json.dump(grips, open(GRIP_FILE, "w"), indent=1)
    print(n, "armas ligadas à mão (1ª e 3ª pessoa)")
if __name__ == "__main__": main()

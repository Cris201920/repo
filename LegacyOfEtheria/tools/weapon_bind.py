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
    for ap in sorted(glob.glob(os.path.join(RP, "attachables/w_*.attachable.json"))):
        sid = os.path.basename(ap)[2:-len(".attachable.json")]
        a = json.load(open(ap)); d = a["minecraft:attachable"]["description"]
        gid = d["geometry"]["default"]; gp = os.path.join(RP, f"models/entity/etheria_w_{sid}.geo.json")
        if not os.path.exists(gp): print("sem geometria:", sid); continue
        bind_geo(gp)
        s = round(float(sc.get(sid, FP_SCALE_DEFAULT)), 3)
        fp, tp = f"animation.etheria.w.{sid}.fp", f"animation.etheria.w.{sid}.tp"
        anims[tp] = {"loop": True, "bones": {"eth_weapon": {"position": TP_POS}}}
        anims[fp] = {"loop": True, "bones": {"eth_weapon": {"position": FP_POS, "rotation": FP_ROT, "scale": s}}}
        d["animations"] = {"eth_fp": fp, "eth_tp": tp}
        d["scripts"] = {"animate": [{"eth_fp": "c.is_first_person"}, {"eth_tp": "!c.is_first_person"}]}
        json.dump(a, open(ap, "w"), indent=1); n += 1
    json.dump({"format_version": "1.10.0", "animations": anims}, open(ANIM_FILE, "w"), indent=1)
    print(n, "armas ligadas à mão (1ª e 3ª pessoa)")
if __name__ == "__main__": main()

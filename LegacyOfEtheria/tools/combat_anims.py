# tools/combat_anims.py - 8.5 ETAPA 5: GOLPES DE COMBO do jogador em 3ª pessoa (estilo do vídeo de referência de combate).
# Cada golpe é uma animação curta ligada à propriedade NUMÉRICA etheria:combo do jogador (o script systems/weaponfx.js muda o valor
# a cada golpe e volta para 0 depois): 1 corte lateral (direita -> esquerda) · 2 corte diagonal de revés (alto-esquerda -> baixo-direita)
# · 3 estocada · 4 golpe pesado de cima (duas mãos) · 5 arremesso do tridente.
# Regras que funcionam no jogo do usuário: arquivo pequeno, só quadros-chave (sem query.vertical_speed nem variáveis do pre_animation nos
# ossos), condição por query.property, "override_previous_animation" para o golpe substituir o balanço padrão do braço enquanto dura.
# Idempotente: reescreve RP/animations/etheria_combo.animation.json, registra as animações no player.entity.json (RP) e a propriedade
# etheria:combo no player.json (BP). Uso: python3 tools/combat_anims.py
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP, BP = os.path.join(ROOT, "LegacyOfEtheria_RP"), os.path.join(ROOT, "LegacyOfEtheria_BP")
PROP = "etheria:combo"

def kf(**bones):
    """bones: nome -> lista de (tempo, [x,y,z]) ; devolve o bloco "bones" do Bedrock"""
    out = {}
    for b, keys in bones.items():
        ch = {}
        for item in keys:
            t, v = item[0], item[1]; kind = item[2] if len(item) > 2 else "rotation"
            ch.setdefault(kind, {})[f"{t:.2f}".rstrip("0").rstrip(".") if t else "0.0"] = [round(x, 1) for x in v]
        out[b] = ch
    return out

REST_R, REST_L = [-18, 0, 0], [-8, 0, 0]   # braço direito segurando a arma / esquerdo solto
A = {
  # 1: corte lateral da direita para a esquerda (o tronco gira junto)
  "c1": (0.5, kf(
      rightArm=[(0, REST_R), (0.1, [-80, -70, -10]), (0.24, [-88, 72, -20]), (0.34, [-70, 62, -15]), (0.5, REST_R)],
      rightItem=[(0, [0, 0, 0]), (0.1, [110, 0, 0]), (0.24, [115, 0, 0]), (0.34, [100, 0, 0]), (0.5, [0, 0, 0])],
      body=[(0, [0, 0, 0]), (0.1, [0, -24, 0]), (0.24, [4, 30, 0]), (0.34, [3, 24, 0]), (0.5, [0, 0, 0])],
      leftArm=[(0, REST_L), (0.1, [-30, 0, -20]), (0.24, [-10, 0, -35]), (0.5, REST_L)])),
  # 2: revés diagonal (de cima à esquerda para baixo à direita)
  "c2": (0.5, kf(
      rightArm=[(0, REST_R), (0.12, [-158, 38, -10]), (0.26, [-42, -48, 10]), (0.36, [-36, -42, 8]), (0.5, REST_R)],
      rightItem=[(0, [0, 0, 0]), (0.12, [0, 0, 30]), (0.26, [0, 0, 40]), (0.5, [0, 0, 0])],
      body=[(0, [0, 0, 0]), (0.12, [-6, 26, 0]), (0.26, [10, -24, 0]), (0.36, [8, -20, 0]), (0.5, [0, 0, 0])],
      leftArm=[(0, REST_L), (0.12, [-20, 0, -15]), (0.26, [-35, 0, -30]), (0.5, REST_L)])),
  # 3: estocada (puxa para trás e avança a lâmina reta para a frente)
  "c3": (0.5, kf(
      rightArm=[(0, REST_R), (0.12, [-70, -12, 0]), (0.12, [0, 0, 2.5], "position"), (0.22, [-92, 4, 0]), (0.22, [0, 0, -3.5], "position"),
                (0.34, [-88, 4, 0]), (0.34, [0, 0, -3], "position"), (0.5, REST_R), (0.5, [0, 0, 0], "position"), (0, [0, 0, 0], "position")],
      rightItem=[(0, [0, 0, 0]), (0.12, [45, 0, 0]), (0.22, [118, 0, 0]), (0.34, [115, 0, 0]), (0.5, [0, 0, 0])],
      body=[(0, [0, 0, 0]), (0.12, [-4, -22, 0]), (0.22, [12, 14, 0]), (0.34, [10, 12, 0]), (0.5, [0, 0, 0])],
      leftArm=[(0, REST_L), (0.12, [-55, 0, -10]), (0.22, [20, 0, -20]), (0.5, REST_L)])),
  # 4: golpe pesado de cima com as duas mãos
  "c4": (0.6, kf(
      rightArm=[(0, REST_R), (0.16, [-196, 10, 0]), (0.3, [-38, 8, 0]), (0.42, [-34, 6, 0]), (0.6, REST_R)],
      leftArm=[(0, REST_L), (0.16, [-192, -14, 0]), (0.3, [-40, -18, 0]), (0.42, [-36, -16, 0]), (0.6, REST_L)],
      rightItem=[(0, [0, 0, 0]), (0.16, [60, 0, 0]), (0.3, [25, 0, 0]), (0.6, [0, 0, 0])],
      body=[(0, [0, 0, 0]), (0.16, [-12, 0, 0]), (0.3, [20, 0, 0]), (0.42, [18, 0, 0]), (0.6, [0, 0, 0])])),
  # 5: arremesso do tridente (do braço erguido para a frente)
  "c5": (0.45, kf(
      rightArm=[(0, [-172, 0, 12]), (0.12, [-70, 0, 0]), (0.22, [-55, 0, 0]), (0.45, REST_R)],
      rightItem=[(0, [-160, 0, 0]), (0.12, [40, 0, 0]), (0.45, [0, 0, 0])],
      body=[(0, [0, -18, 0]), (0.12, [10, 14, 0]), (0.45, [0, 0, 0])],
      leftArm=[(0, [-60, 0, -15]), (0.12, [20, 0, -15]), (0.45, REST_L)])),
}
anims = {}
for k, (L, bones) in A.items():
    anims[f"animation.etheria.combo.{k}"] = {"loop": False, "animation_length": L, "override_previous_animation": True, "bones": bones}
os.makedirs(os.path.join(RP, "animations"), exist_ok=True)
json.dump({"format_version": "1.10.0", "animations": anims}, open(os.path.join(RP, "animations/etheria_combo.animation.json"), "w"), indent=1)

# ------------------------------------------------------------------ RP: player.entity.json
pe = os.path.join(RP, "entity/player.entity.json"); d = json.load(open(pe)); de = d["minecraft:client_entity"]["description"]
for i in range(1, 6): de["animations"][f"eth_cmb{i}"] = f"animation.etheria.combo.c{i}"
de["animations"].pop("eth_cmb6", None)
anim = de["scripts"]["animate"]
anim[:] = [a for a in anim if not (isinstance(a, dict) and any(k.startswith("eth_cmb") for k in a))]
GATE = "!variable.is_first_person && variable.etheria_dragon == 0.0 && !query.is_riding"
for i in range(1, 6): anim.append({f"eth_cmb{i}": f"query.property('{PROP}') == {i} && {GATE}"})
open(pe, "w").write(json.dumps(d, indent=1, ensure_ascii=False) + "\n")

# ------------------------------------------------------------------ BP: propriedade numérica no player.json
pb = os.path.join(BP, "entities/player.json"); b = json.load(open(pb))
props = b["minecraft:entity"]["description"].setdefault("properties", {})
props[PROP] = {"type": "int", "range": [0, 5], "default": 0, "client_sync": True}
open(pb, "w").write(json.dumps(b, indent=1, ensure_ascii=False))
print(len(anims), "animações de combo;", len(props), "propriedades no jogador")

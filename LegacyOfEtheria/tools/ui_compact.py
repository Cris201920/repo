"""7.x - UI MENOR (pedido: "diminuir os ui"). Pós-processa os JSON UI já gerados, SEM bindings novos e só com propriedades que já são usadas
no projeto/jogo (size, offset, anchor_from/anchor_to, font_scale_factor):
  - server_form.json  eth_form (tela cheia temática dos menus): painel 90% x 90% centralizado (antes 100% x 100%)
  - hud_screen.json   eth_sage_toast (notificação de canto do Sábio): 176 x 34 (antes 210 x 40), ícone 24 px, caixa 12 px, texto 85%
A barra de ação (vida/mana/stamina/habilidades) ficou mais curta pelo script (systems/loop.js e systems/skillbar/ui.js).
Valores ABSOLUTOS -> idempotente. Rodar DEPOIS de tools/gen_ui_json.py / tools/hud_toast.py se eles forem rodados de novo.
Uso: python3 tools/ui_compact.py"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI = os.path.join(ROOT, "LegacyOfEtheria_RP", "ui")

def load(n): return json.load(open(os.path.join(UI, n), encoding="utf-8"))
def save(n, j):
    p = os.path.join(UI, n); txt = json.dumps(j, ensure_ascii=False, indent=1)
    if open(p, encoding="utf-8").read() != txt: open(p, "w", encoding="utf-8").write(txt); return True
    return False
def child(ctrls, name):
    for c in ctrls:
        if name in c: return c[name]
    raise KeyError(name)

def main():
    sf = load("server_form.json"); f = sf["eth_form"]
    f["size"] = ["90%", "90%"]; f["anchor_from"] = "center"; f["anchor_to"] = "center"
    h = load("hud_screen.json"); t = h["eth_sage_toast"]
    t["size"] = [176, 34]
    child(t["controls"], "ico")["size"] = [24, 24]
    box = child(t["controls"], "box"); box["size"] = ["100%c + 8px", 12]; box["offset"] = [5, 22]
    lab = child(box["controls"], "txt"); lab["font_scale_factor"] = 0.85; lab["offset"] = [4, 0]
    a, b = save("server_form.json", sf), save("hud_screen.json", h)
    for n in ("server_form.json", "hud_screen.json"): json.load(open(os.path.join(UI, n), encoding="utf-8"))   # valida
    print(f"server_form.json {'alterado' if a else 'sem mudança'} | hud_screen.json {'alterado' if b else 'sem mudança'}")

if __name__ == "__main__": main()

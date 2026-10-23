# Validador simples do LegacyOfEtheria_RP/ui/hud_screen.json (rodar antes de entregar mudanças visuais da HUD; o jogo pode não abrir o
# mundo com UI quebrada). Verifica: JSON estrito, @hud.* resolvem, nomes de irmãos únicos, tipos de controle/animação válidos, campos das
# animações (from/to/duration/easing/next), laços sem duração zero, texturas existentes, bindings conhecidos, tamanho do arquivo e se os
# cabeçalhos de categoria do Sábio cabem numa linha em tela estreita. Uso: python3 tools/check_hud_ui.py   (sai com código 1 se houver erro)
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); RP = os.path.join(ROOT, "LegacyOfEtheria_RP")
HP = os.path.join(RP, "ui/hud_screen.json"); MAX_BYTES = 160_000
CTRL = {"panel", "image", "label", "stack_panel", "input_panel", "grid", "factory", "button", "custom", "screen", "collection_panel", "selection_wheel"}
ANIM = {"alpha", "offset", "size", "wait", "color", "flip_book", "uv", "clip", "aseprite_flip_book"}
EASE = {"linear", "step", "in_quad", "out_quad", "in_out_quad", "in_cubic", "out_cubic", "in_out_cubic", "in_quart", "out_quart", "in_out_quart", "in_quint", "out_quint",
        "in_out_quint", "in_sine", "out_sine", "in_out_sine", "in_expo", "out_expo", "in_out_expo", "in_circ", "out_circ", "in_out_circ", "in_bounce", "out_bounce",
        "in_out_bounce", "in_back", "out_back", "in_out_back", "in_elastic", "out_elastic", "in_out_elastic", "spring"}
BIND_OK = {"#hud_title_text_string", "#hud_subtitle_text_string", "#hud_actionbar_text_string", "#text", "#visible", "#hud_title_text_alpha"}
err, warn = [], []
raw = open(HP, encoding="utf-8").read()
try: D = json.loads(raw)
except Exception as e: print("ERRO: JSON inválido:", e); sys.exit(1)
if D.get("namespace") != "hud": err.append("namespace != hud")
if len(raw.encode()) > MAX_BYTES: err.append(f"arquivo grande demais: {len(raw.encode())} > {MAX_BYTES}")
def ref_ok(r):
    if not r.startswith("@"): return True
    ns, _, k = r[1:].partition(".")
    return ns != "hud" or k in D or k.split("@")[0] in D   # outros namespaces (vanilla) não são checados aqui
def walk(n, path):
    if not isinstance(n, dict): return
    t = n.get("type")
    if t and t not in CTRL: err.append(f"{path}: type desconhecido {t}")
    for a in n.get("anims", []) or []:
        if not ref_ok(a): err.append(f"{path}: anim {a} não existe")
    tx = n.get("texture")
    if isinstance(tx, str) and tx.startswith("textures/ui/etheria/") and not os.path.exists(os.path.join(RP, tx + ".png")): err.append(f"{path}: textura ausente {tx}")
    for b in n.get("bindings", []) or []:
        for k in ("binding_name", "binding_name_override", "target_property_name"):
            v = b.get(k)
            if v and v not in BIND_OK: warn.append(f"{path}: binding {k}={v} (fora da lista conhecida)")
    names = []
    for c in n.get("controls", []) or []:
        if not isinstance(c, dict) or len(c) != 1: err.append(f"{path}: controle malformado"); continue
        (k, v), = c.items(); nm = k.split("@")[0]
        if nm in names: err.append(f"{path}: nome repetido entre irmãos: {nm}")
        names.append(nm)
        if "@" in k and not ref_ok("@" + k.split("@", 1)[1]): err.append(f"{path}/{k}: herança não resolve")
        walk(v, f"{path}/{nm}")
    for m in n.get("modifications", []) or []:
        for v in m.get("value", []) or []:
            if isinstance(v, dict):
                for k in v:
                    if "@" in k and not ref_ok("@" + k.split("@", 1)[1]): err.append(f"{path}: modificação {k} não resolve")
for k, v in D.items():
    if k == "namespace": continue
    if isinstance(v, dict) and "anim_type" in v:
        at = v["anim_type"]
        if at not in ANIM: err.append(f"{k}: anim_type inválido {at}")
        d = v.get("duration")
        if not isinstance(d, (int, float)) or d < 0: err.append(f"{k}: duration inválida {d}")
        if at != "wait":
            for f in ("from", "to"):
                x = v.get(f)
                if at == "alpha" and not isinstance(x, (int, float)): err.append(f"{k}: {f} deve ser número")
                if at in ("size", "offset") and not (isinstance(x, list) and len(x) == 2): err.append(f"{k}: {f} deve ser [x, y]")
            if v.get("easing", "linear") not in EASE: err.append(f"{k}: easing desconhecido {v.get('easing')}")
        if "next" in v and not ref_ok(v["next"]): err.append(f"{k}: next {v['next']} não existe")
    else: walk(v, k)
# laços: soma das durações de um ciclo precisa ser > 0 (senão o jogo pode travar avaliando a cadeia)
for k, v in D.items():
    if not (isinstance(v, dict) and "anim_type" in v): continue
    seen, cur, tot = [], k, 0.0
    while cur and cur not in seen and cur in D:
        seen.append(cur); tot += D[cur].get("duration", 0); nx = D[cur].get("next"); cur = nx[5:] if nx and nx.startswith("@hud.") else None
    if cur in seen:
        loop = seen[seen.index(cur):]
        if sum(D[x].get("duration", 0) for x in loop) <= 0.01: err.append(f"{k}: laço com duração ~0 ({' > '.join(loop)})")
# texto: os cabeçalhos de categoria (negrito) cabem em 80% de uma tela estreita (320 unidades de UI)?
NARROW = set("il!.,:;|'")
w = lambda s, b: sum((2 if c in NARROW else 4 if c in "It[]" else 6) + (1 if b else 0) for c in s)
for t in ("HABILIDADE EXTRA", "HABILIDADE ÚNICA", "HABILIDADE ULTIMATE", "HABILIDADE INTRÍNSECA", "HABILIDADE COMUM", "RESISTÊNCIA", "INTRINSIC SKILL", "ULTIMATE SKILL"):
    full = w("—— ", False) + w(t, True) + w(" ——", False)
    if full > 0.8 * 320: err.append(f"cabeçalho '{t}' ({full} px) não cabe numa linha em 256 px")
n_ctrl = raw.count('"type":')
print(f"hud_screen.json: {len(raw.encode())} bytes, {len(D) - 1} chaves de topo, ~{n_ctrl} controles/animações tipados")
for x in warn[:10]: print("aviso:", x)
for x in err: print("ERRO:", x)
print("OK" if not err else f"{len(err)} erro(s)"); sys.exit(1 if err else 0)

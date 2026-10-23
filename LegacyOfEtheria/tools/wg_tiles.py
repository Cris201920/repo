#!/usr/bin/env python3
# tools/wg_tiles.py - 9.3: LADRILHOS das estruturas grandes colocadas por SCRIPT (reinos, domínios, vilas, Igreja/Escola/Templo, arenas de 61).
# Por quê: structureManager.place de uma estrutura de até 145x76x145 (1,6 milhão de posições) num ÚNICO tick trava o jogo e o cliente
# recebe ~100 chunks alterados de uma vez (os "blocos invisíveis" até o chunk ser redesenhado). Aqui cada estrutura com pegada > 48
# é dividida em colunas de TxT blocos (altura inteira) que systems/placer.js coloca um ladrilho a cada poucos ticks, na MESMA posição:
# o resultado final é bloco a bloco o mesmo da estrutura original (o validador confere), só que espalhado em ~1-3 s.
# Ordem: colunas inteiras (apoio vertical, gravidade, portas, plantas ficam no mesmo ladrilho); blocos presos na lateral (tocha de parede,
# escada de mão, placa, botão, vinha...) e líquidos ficam DEPOIS do ladrilho vizinho que os apoia/contém; camas e baús duplos que
# cruzam a divisa vão no mesmo passo. Ladrilhos só de structure_void não são gravados.
# Gera (idempotente; arquivos derivados, fora do git):
#   BP/structures/etheria_t/<nome>_<i>_<j>.mcstructure
#   BP/scripts/data/tiles.gen.js     TILES["etheria:<nome>"] = {size, steps: [[["etheria_t:<nome>_i_j", ox, oz], ...], ...]}
# Uso: python3 tools/wg_tiles.py            (gera e valida)
#      python3 tools/wg_tiles.py --check    (só valida: cada ladrilho = recorte exato da original)
#      python3 tools/wg_tiles.py --originals (lista os .mcstructure originais já ladrilhados, para o build.sh deixar fora do pacote)
import json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tnbt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
SRC = os.path.join(BP, "structures", "etheria")
NS = "etheria_t"
OUT = os.path.join(BP, "structures", NS)
DATA = os.path.join(BP, "scripts", "data", "tiles.gen.js")
T, MINW = 32, 49                     # lado do ladrilho; só estruturas com pegada >= MINW (as menores já cabem em 3x3 chunks)
SKIP = re.compile(r"^tempest_")      # Tempest já é ladrilhada (64x64) por tools/tempest_pack.py
ATT = re.compile(r"torch|ladder|_sign|banner|button|lever|tripwire_hook|vine|cocoa|frame|bell|lichen|sculk_vein|coral_fan|fan_hang|skull|head|"
                 r"amethyst_cluster|_bud$|scaffolding")
PAIR = re.compile(r"(^|_)bed$|^chest$|trapped_chest")
LIQ = re.compile(r"^(flowing_)?(water|lava)$|bubble_column|kelp|seagrass")
EMPTY = re.compile(r"air$|structure_void")
C = tnbt.get


def load(path):
    _, (t, root) = tnbt.read(path)
    sx, sy, sz = C(root, "size")[1][1]
    st = C(root, "structure")[1]
    l0, l1 = [lay[1] for lay in C(st, "block_indices")[1][1]]
    pal = C(C(C(st, "palette")[1], "default")[1], "block_palette")[1][1]
    bpd = C(C(C(st, "palette")[1], "default")[1], "block_position_data")[1]
    ents = C(st, "entities")[1][1]
    return (sx, sy, sz), l0, l1, pal, bpd, ents


def tiles_of(size):
    sx, sy, sz = size
    return [(i, j, i * T, j * T, min(T, sx - i * T), min(T, sz - j * T)) for i in range((sx + T - 1) // T) for j in range((sz + T - 1) // T)]


def order(size, l0, l1, names):
    """passos de colocação: lista de grupos de ladrilhos (Tarjan sobre as dependências entre vizinhos), apoio antes do apoiado"""
    sx, sy, sz = size
    att = [bool(ATT.search(n)) for n in names]; pair = [bool(PAIR.search(n)) for n in names]
    liq = [bool(LIQ.search(n)) for n in names]; emp = [bool(EMPTY.search(n)) for n in names]
    tid = lambda x, z: (x // T, z // T)
    G = collections.defaultdict(set)
    for x in range(sx):
        for z in range(sz):
            for dx, dz in ((1, 0), (0, 1)):
                X, Z = x + dx, z + dz
                if X >= sx or Z >= sz or tid(x, z) == tid(X, Z): continue
                A, B = tid(x, z), tid(X, Z)
                for y in range(sy):
                    i, j = x * sy * sz + y * sz + z, X * sy * sz + y * sz + Z
                    a, b = l0[i], l0[j]
                    if a < 0 and b < 0: continue
                    la, lb = (a >= 0 and liq[a]) or l1[i] >= 0, (b >= 0 and liq[b]) or l1[j] >= 0
                    ea, eb = a < 0 or emp[a], b < 0 or emp[b]
                    if a >= 0 and b >= 0 and pair[a] and pair[b]: G[A].add(B); G[B].add(A)
                    if (a >= 0 and att[a] and not eb) or (la and not lb): G[B].add(A)     # B (apoio / vizinho) antes de A
                    if (b >= 0 and att[b] and not ea) or (lb and not la): G[A].add(B)
    nodes = [(i, j) for i, j, *_ in tiles_of(size)]
    idx, low, stack, on, comps, c = {}, {}, [], set(), [], [0]

    def sc(v):
        idx[v] = low[v] = c[0]; c[0] += 1; stack.append(v); on.add(v)
        for w in sorted(G[v]):
            if w not in idx: sc(w); low[v] = min(low[v], low[w])
            elif w in on: low[v] = min(low[v], idx[w])
        if low[v] == idx[v]:
            comp = []
            while True:
                w = stack.pop(); on.discard(w); comp.append(w)
                if w == v: break
            comps.append(sorted(comp))
    for v in nodes:
        if v not in idx: sc(v)
    return comps[::-1]          # Tarjan devolve em ordem topológica reversa: apoio (origem da aresta) primeiro


def tile_bytes(size, l0, l1, pal, i0, j0, w, d):
    sx, sy, sz = size
    used, n0, n1 = {}, [], []
    for x in range(i0, i0 + w):
        for y in range(sy):
            for z in range(j0, j0 + d):
                k = x * sy * sz + y * sz + z
                for src, dst in ((l0[k], n0), (l1[k], n1)):
                    if src < 0: dst.append(-1)
                    else: dst.append(used.setdefault(src, len(used)))
    if all(v < 0 for v in n0) and all(v < 0 for v in n1): return None
    p2 = [None] * len(used)
    for s, t in used.items(): p2[t] = pal[s]
    root = [("format_version", (3, 1)), ("size", (9, (3, [w, sy, d]))),
            ("structure", (10, [("block_indices", (9, (9, [(3, n0), (3, n1)]))), ("entities", (9, (10, []))),
                                ("palette", (10, [("default", (10, [("block_palette", (9, (10, p2))), ("block_position_data", (10, []))]))]))])),
            ("structure_world_origin", (9, (3, [0, 0, 0])))]
    o = [bytes([10])]; tnbt._ws(o, ""); tnbt._wp(o, 10, root)
    return b"".join(o)


def candidates():
    return [os.path.join(SRC, f) for f in sorted(os.listdir(SRC)) if f.endswith(".mcstructure") and not SKIP.match(f)]


def main():
    check, only_list = "--check" in sys.argv, "--originals" in sys.argv
    old = {}
    if os.path.exists(DATA):
        m = re.search(r"export const TILES = (\{.*\});", open(DATA, encoding="utf8").read(), re.S)
        if m: old = json.loads(m.group(1))
    if only_list:
        for sid in sorted(old):
            ok = all(os.path.exists(os.path.join(OUT, t[0].split(":")[1] + ".mcstructure")) for st in old[sid]["steps"] for t in st)
            if ok: print(f"structures/etheria/{sid.split(':')[1]}.mcstructure")
        return 0
    data, ch, errs, keep = {}, 0, [], set()
    for path in candidates():
        name = os.path.basename(path)[:-12]
        size, l0, l1, pal, bpd, ents = load(path)
        if max(size[0], size[2]) < MINW: continue
        if bpd or ents: errs.append(f"{name}: tem block_position_data/entidades (não suportado no ladrilho)"); continue
        names = [C(p, "name")[1].replace("minecraft:", "") for p in pal]
        tl = {(i, j): (x0, z0, w, d) for i, j, x0, z0, w, d in tiles_of(size)}
        steps = []
        for comp in order(size, l0, l1, names):
            step = []
            for (i, j) in comp:
                x0, z0, w, d = tl[(i, j)]
                tid = f"{name}_{i}_{j}"
                b = tile_bytes(size, l0, l1, pal, x0, z0, w, d)
                if b is None: continue
                fp = os.path.join(OUT, tid + ".mcstructure"); keep.add(tid + ".mcstructure")
                if check:
                    if not os.path.exists(fp) or open(fp, "rb").read() != b: errs.append(f"{tid}: ladrilho ausente/diferente da original")
                else:
                    os.makedirs(OUT, exist_ok=True)
                    if not os.path.exists(fp) or open(fp, "rb").read() != b: open(fp, "wb").write(b); ch += 1
                step.append([f"{NS}:{tid}", x0, z0])
            if step: steps.append(step)
        data[f"etheria:{name}"] = {"size": list(size), "steps": steps}
        print(f"  {name:32s} {size[0]}x{size[1]}x{size[2]} -> {sum(len(s) for s in steps)} ladrilhos em {len(steps)} passos")
    if not check:
        for f in os.listdir(OUT) if os.path.isdir(OUT) else []:
            if f.endswith(".mcstructure") and f not in keep: os.remove(os.path.join(OUT, f)); ch += 1
        js = ("// GERADO por tools/wg_tiles.py (9.3): estruturas grandes divididas em ladrilhos de %dx%d colunas (structures/etheria_t, fora do git).\n"
              "// systems/placer.js coloca um passo (grupo de ladrilhos) a cada poucos ticks na mesma posição da original; sem os ladrilhos, usa a original.\n"
              "export const TILES = %s;\n") % (T, T, json.dumps(data, separators=(",", ":")))
        if not os.path.exists(DATA) or open(DATA, encoding="utf8").read() != js: open(DATA, "w", encoding="utf8").write(js); ch += 1
        print(f"wg_tiles: {len(data)} estruturas, {ch} arquivo(s) alterado(s)")
    elif old != data: errs.append("tiles.gen.js desatualizado")
    print(f"validação: {len(data)} estruturas ladrilhadas, erros: {errs}")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())

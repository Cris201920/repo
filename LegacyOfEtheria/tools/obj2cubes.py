# Converte um .obj exportado do Blockbench (cubos, 6 faces de 4 vértices por cubo, possivelmente girados) em cubos Bedrock
# (origin/size/rotation/pivot + UV por face), no mesmo espaço de coordenadas de swords.java_model (pixels, sem espelhar X).
import math, sys
sys.path.insert(0, __import__("os").path.dirname(__file__))
from swords import corners, FACEPTS

def parse(path):
    V, T, F, mat = [], [], [], None
    for ln in open(path):
        p = ln.split()
        if not p: continue
        if p[0] == "v": V.append([float(x) * 16 for x in p[1:4]])
        elif p[0] == "vt": T.append([float(x) for x in p[1:3]])
        elif p[0] == "usemtl": mat = p[1]
        elif p[0] == "f": F.append(([int(q.split("/")[0]) - 1 for q in p[1:]], [int(q.split("/")[1]) - 1 for q in p[1:]], mat))
    return V, T, F

def sub(a, b): return [a[i] - b[i] for i in range(3)]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def norm(a): l = math.sqrt(dot(a, a)) or 1; return [x / l for x in a]

def face_normal(P): return norm(cross(sub(P[1], P[0]), sub(P[2], P[1])))

def cubes(path, tw, th, flipv=False):
    V, T, F = parse(path)
    out, bad = [], 0
    for c0 in range(0, len(F), 6):
        fs = F[c0:c0 + 6]
        if len(fs) < 6: break
        mat = fs[0][2]
        pts = [V[i] for f in fs for i in f[0]]
        uniq = []
        for p in pts:
            if not any(max(abs(p[k] - q[k]) for k in range(3)) < 1e-3 for q in uniq): uniq.append(p)
        normals = [face_normal([V[i] for i in f[0]]) for f in fs]
        # eixos locais: para cada eixo do mundo, a normal mais alinhada (com sinal positivo)
        cols, used = [], set()
        for k in range(3):
            best, bi, bs = -1, None, 1
            for j, n in enumerate(normals):
                if j in used: continue
                if abs(n[k]) > best + 1e-9: best, bi, bs = abs(n[k]), j, (1 if n[k] >= 0 else -1)
            used.add(bi)
            for j, n in enumerate(normals):   # a face oposta também fica usada
                if j != bi and dot(n, normals[bi]) < -0.99: used.add(j)
            cols.append([bs * x for x in normals[bi]])
        if dot(cross(cols[0], cols[1]), cols[2]) < 0: cols[2] = [-x for x in cols[2]]
        ctr = [sum(p[k] for p in uniq) / len(uniq) for k in range(3)]
        size = [max(dot(sub(p, ctr), cols[k]) for p in uniq) * 2 for k in range(3)]
        R = [[cols[j][i] for j in range(3)] for i in range(3)]   # colunas = eixos locais
        # R = Rz(g)·Ry(b)·Rx(a); Bedrock: rx = -a, ry = -b, rz = g (ver swords.corners)
        b = math.asin(max(-1, min(1, -R[2][0])))
        a = math.atan2(R[2][1], R[2][2]); g = math.atan2(R[1][0], R[0][0])
        rot = [round(-math.degrees(a), 4), round(-math.degrees(b), 4), round(math.degrees(g), 4)]
        org = [ctr[k] - size[k] / 2 for k in range(3)]
        cube = {"origin": org, "size": size}
        if any(abs(x) > 1e-3 for x in rot): cube["rotation"] = rot; cube["pivot"] = ctr
        C = corners(cube)
        err = max(min(max(abs(C[key][k] - p[k]) for k in range(3)) for p in uniq) for key in C)
        if err > 0.05: bad += 1
        # UV por face: casa os cantos Bedrock (FACEPTS) com os vértices do .obj
        uvf = {}
        for fn, keys in FACEPTS.items():
            Q = [C[k] for k in keys]
            nrm = face_normal(Q) if fn not in ("east", "west", "up", "down", "north", "south") else face_normal(Q)
            best = None
            for f in fs:
                P = [V[i] for i in f[0]]
                d = sum(min(math.dist(q, p) for p in P) for q in Q)
                if best is None or d < best[0]: best = (d, f)
            f = best[1]; P = [V[i] for i in f[0]]
            def uvat(q):
                j = min(range(4), key=lambda i: math.dist(q, P[i])); u, v = T[f[1][j]]
                return [u * tw, (1 - v) * th if flipv else v * th]
            tl, tr, br, bl = [uvat(q) for q in Q]
            if abs(tr[1] - tl[1]) > 1e-3 or abs(bl[0] - tl[0]) > 1e-3: bad += 0  # face com UV girada: aproxima pelo retângulo
            uvf[fn] = {"uv": [round(tl[0], 4), round(tl[1], 4)], "uv_size": [round(tr[0] - tl[0], 4), round(bl[1] - tl[1], 4)]}
        cube["uv"] = uvf
        cube["mat"] = mat
        out.append(cube)
    return out, bad
if __name__ == "__main__":
    cs, bad = cubes(sys.argv[1], 128, 128)
    print(len(cs), "cubos", bad, "com erro;", {m: sum(1 for c in cs if c["mat"] == m) for m in set(c["mat"] for c in cs)})
    xs = [c["origin"][k] for c in cs for k in range(3)]
    for k in range(3): print("eixo", k, min(c["origin"][k] for c in cs), max(c["origin"][k] + c["size"][k] for c in cs))

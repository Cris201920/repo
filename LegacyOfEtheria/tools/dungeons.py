"""8.8 (Etapa 7b) - MASMORRAS DOS CHEFES POR REGIÃO: gera 5 estruturas .mcstructure (BP/structures/etheria/dg_*.mcstructure),
as loot tables dos baús (BP/loot_tables/etheria/dg_*.json) e os dados para o script (BP/scripts/data/dungeons.gen.js).
  Castelo Celestial      (mundo normal, terra)   -> Anjo Guardião na sala do trono + anjos; cripta no subsolo no mesmo estilo
  Masmorra do Rei Goblin (mundo normal, terra)   -> portaria em ruínas na superfície, escada até o salão do trono subterrâneo
  Santuário Submerso     (mundo normal, oceano)  -> cúpula de vidro e prismarinho no fundo do mar com a Guardiã Cristalina
  Fortaleza Sombria      (Inferno)               -> salão do trono do Anjo Caído, celas e torres de pedra-negra
  Santuário do Vazio     (End)                   -> ilha flutuante com pilares de obsidiana e o trono da Rainha do Vazio
Tudo em blocos vanilla com os estados EXATOS do Bedrock 1.21.80 (tools/mojang-blocks-1.21.80.json). Colocação no jogo:
systems/dungeons.js (escolha do local por dimensão) + systems/worldgen.js (structureManager.place instantâneo, baús, mobs).
Idempotente/determinístico (semente fixa). Uso: python3 tools/dungeons.py [--preview saida.png]"""
import json, math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tnbt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "LegacyOfEtheria_BP")
META = json.load(open(os.path.join(ROOT, "tools/mojang-blocks-1.21.80.json")))
BLK = {b["name"]: [p["name"] for p in b.get("properties", [])] for b in META["data_items"]}
PROP = {p["name"]: p for p in META["block_properties"]}
VERSION = 18173952
DEF = {"pillar_axis": "y", "minecraft:cardinal_direction": "south", "torch_facing_direction": "top", "minecraft:vertical_half": "bottom"}

def B(name, **st):
    """bloco validado: nome existe no Bedrock 1.21.80 e todos os estados presentes (padrão quando omitido)"""
    n = "minecraft:" + name
    assert n in BLK, f"bloco inexistente: {n}"
    st = {k.replace("__", ":"): v for k, v in st.items()}
    out = []
    for k in BLK[n]:
        p = PROP[k]; v = st.pop(k, DEF.get(k, p["values"][0]["value"]))
        out.append((k, p["type"], v))
    assert not st, f"estados extras {st} em {n}"
    return (n, tuple(out))

AIR, VOID = B("air"), None
def chest(face="south"): return B("chest", minecraft__cardinal_direction=face)

class Grid:
    def __init__(s, w, h, d): s.w, s.h, s.d, s.v = w, h, d, {}
    def set(s, x, y, z, b):
        if 0 <= x < s.w and 0 <= y < s.h and 0 <= z < s.d: s.v[(x, y, z)] = b
    def fill(s, x1, y1, z1, x2, y2, z2, b):
        for x in range(min(x1, x2), max(x1, x2) + 1):
            for y in range(min(y1, y2), max(y1, y2) + 1):
                for z in range(min(z1, z2), max(z1, z2) + 1): s.set(x, y, z, b)
    def ring(s, x1, z1, x2, z2, y1, y2, b, pred=None):
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                for z in (z1, z2):
                    if not pred or pred(x, y, z): s.set(x, y, z, b)
            for z in range(z1, z2 + 1):
                for x in (x1, x2):
                    if not pred or pred(x, y, z): s.set(x, y, z, b)
    def room(s, x1, y1, z1, x2, y2, z2, wall, floor=None, ceil=None):
        s.fill(x1, y1, z1, x2, y2, z2, AIR); s.ring(x1, z1, x2, z2, y1, y2, wall)
        s.fill(x1, y1, z1, x2, y1, z2, floor or wall); s.fill(x1, y2, z1, x2, y2, z2, ceil or wall)
    def roof(s, x1, z1, x2, z2, y, b, tip=None):
        k = 0
        while x1 + k <= x2 - k and z1 + k <= z2 - k:
            s.ring(x1 + k, z1 + k, x2 - k, z2 - k, y + k, y + k, b); k += 1
        if tip: s.set((x1 + x2) // 2, y + k, (z1 + z2) // 2, tip)
    def disc(s, cx, cz, r, y1, y2, b, r0=-1):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            for z in range(int(cz - r) - 1, int(cz + r) + 2):
                d = math.hypot(x - cx, z - cz)
                if r0 < d <= r: s.fill(x, y1, z, x, y2, z, b)

# ------------------------------------------------------------------ estruturas
def castelo():
    """Castelo Celestial: muralha de quartzo, 4 torres + portaria, torre de menagem com sala do trono, 2 casas da guarda e cripta"""
    W = D = 45; F = 8; H = F + 37; g = Grid(W, H, D)
    QB, SQ, CQ, QP, GOLD, STB = B("quartz_bricks"), B("smooth_quartz"), B("chiseled_quartz_block"), B("quartz_pillar"), B("gold_block"), B("stone_bricks")
    CAL, ROOF, GL, SEA = B("calcite"), B("light_blue_terracotta"), B("glass_pane"), B("sea_lantern")
    LAN, LANH, YC, ROD = B("lantern"), B("lantern", hanging=True), B("yellow_carpet"), B("end_rod", facing_direction=1)
    g.fill(0, 0, 0, W - 1, F - 1, D - 1, STB)                       # fundação
    g.fill(0, F, 0, W - 1, F, D - 1, SQ)                            # pátio
    g.fill(0, F + 1, 0, W - 1, H - 1, D - 1, AIR)                   # limpa árvores/terreno da pegada
    for z in range(D): g.set(22, F, z, CAL); g.set(21, F, z, CAL); g.set(23, F, z, CAL)
    # muralha
    g.ring(2, 2, 42, 42, F + 1, F + 9, QB); g.ring(2, 2, 42, 42, F + 5, F + 5, CQ); g.ring(2, 2, 42, 42, F + 10, F + 10, CQ)
    g.ring(2, 2, 42, 42, F + 11, F + 11, QB, pred=lambda x, y, z: (x + z) % 2 == 0)
    def tower(cx, cz, h, r=3):
        g.room(cx - r, F, cz - r, cx + r, F + h, cz + r, QB, floor=SQ, ceil=SQ)
        for y in (F + 6, F + 11):
            if y < F + h - 1:
                for dx, dz in ((r, 0), (-r, 0), (0, r), (0, -r)): g.set(cx + dx, y, cz + dz, GL); g.set(cx + dx, y + 1, cz + dz, GL)
        g.ring(cx - r - 1, cz - r - 1, cx + r + 1, cz + r + 1, F + h, F + h, CQ)
        g.ring(cx - r - 1, cz - r - 1, cx + r + 1, cz + r + 1, F + h + 1, F + h + 1, GOLD, pred=lambda x, y, z: (x + z) % 2 == 0)
        g.roof(cx - r, cz - r, cx + r, cz + r, F + h + 1, ROOF, tip=GOLD)
        g.set(cx, F + h + 2 + r + 1, cz, ROD); g.set(cx, F + 1, cz, LAN)
    for cx, cz in ((3, 3), (41, 3), (3, 41), (41, 41)):
        tower(cx, cz, 15)
        ix, iz = cx + (3 if cx < 22 else -3), cz + (3 if cz < 22 else -3)   # porta para o pátio
        g.fill(ix, F + 1, cz, ix, F + 2, cz, AIR); g.fill(cx, F + 1, iz, cx, F + 2, iz, AIR)
    # portaria (sul)
    for cx in (18, 26): tower(cx, 42, 12, r=2)
    g.fill(20, F + 1, 41, 24, F + 5, 43, AIR); g.fill(20, F + 6, 42, 24, F + 6, 42, GOLD); g.fill(19, F + 1, 42, 19, F + 6, 42, GOLD); g.fill(25, F + 1, 42, 25, F + 6, 42, GOLD)
    # torre de menagem (sala do trono)
    g.room(12, F, 6, 32, F + 17, 28, QB, floor=SQ, ceil=SQ)
    g.ring(12, 6, 32, 28, F + 8, F + 8, CQ); g.ring(11, 5, 33, 29, F + 17, F + 17, CQ)
    g.ring(11, 5, 33, 29, F + 18, F + 18, QB, pred=lambda x, y, z: (x + z) % 2 == 0)
    for x, z in ((12, 6), (32, 6), (12, 28), (32, 28)): g.fill(x, F + 1, z, x, F + 19, z, QP); g.set(x, F + 20, z, GOLD)
    for z in (10, 14, 18, 22): g.fill(12, F + 4, z, 12, F + 7, z, GL); g.fill(32, F + 4, z, 32, F + 7, z, GL); g.fill(12, F + 10, z, 12, F + 13, z, GL); g.fill(32, F + 10, z, 32, F + 13, z, GL)
    g.fill(20, F + 1, 28, 24, F + 6, 28, AIR); g.fill(19, F + 1, 28, 19, F + 7, 28, GOLD); g.fill(25, F + 1, 28, 25, F + 7, 28, GOLD); g.fill(19, F + 7, 28, 25, F + 7, 28, GOLD)
    g.fill(21, F + 1, 12, 23, F + 1, 27, YC)
    for z in (10, 14, 18, 22, 26):
        for x in (17, 27): g.fill(x, F + 1, z, x, F + 16, z, QP); g.set(x, F, z, SEA)
    for z in (12, 18, 24): g.set(22, F + 16, z, LANH)
    g.fill(13, F + 1, 7, 31, F + 2, 10, CQ); g.fill(17, F + 1, 11, 27, F + 1, 11, SQ)        # estrado
    g.fill(21, F + 3, 7, 23, F + 7, 7, GOLD); g.set(22, F + 8, 7, CQ); g.set(22, F + 3, 8, SQ); g.set(21, F + 3, 8, GOLD); g.set(23, F + 3, 8, GOLD)
    g.fill(21, F + 3, 9, 23, F + 3, 10, AIR)
    for x in (14, 30): g.set(x, F + 3, 8, LAN)
    # pináculo central sobre a menagem
    g.room(19, F + 17, 14, 25, F + 29, 20, QB, floor=SQ, ceil=SQ)
    for y in (F + 21, F + 25):
        for dx, dz in ((3, 0), (-3, 0), (0, 3), (0, -3)): g.set(22 + dx, y, 17 + dz, GL)
    g.ring(18, 13, 26, 21, F + 29, F + 29, CQ); g.roof(19, 14, 25, 20, F + 30, ROOF, tip=GOLD); g.set(22, F + 35, 17, ROD)
    # casas da guarda
    for x1 in (5, 33):
        g.room(x1, F, 31, x1 + 6, F + 5, 37, QB, floor=SQ, ceil=SQ); g.roof(x1 - 1, 30, x1 + 7, 38, F + 5, ROOF)
        g.fill(x1 + 3, F + 1, 31, x1 + 3, F + 2, 31, AIR); g.set(x1 + 3, F + 1, 36, LAN)
        g.set(x1, F + 3, 34, GL); g.set(x1 + 6, F + 3, 34, GL)
    # cripta (masmorra no subsolo, mesmo estilo)
    g.room(14, 0, 9, 30, F - 1, 27, QB, floor=SQ, ceil=QB)
    for x in (19, 25):
        for z in (13, 18, 23): g.fill(x, 1, z, x, F - 2, z, QP)
    for x, z in ((17, 12), (27, 12), (17, 24), (27, 24)): g.fill(x, 1, z, x, 1, z + 1, CQ); g.set(x, 2, z, LAN)
    for k in range(F):                                             # escada da menagem até a cripta
        z, top = 26 - k, F - 1 - k
        g.fill(15, 0, z, 16, top, z, QB); g.fill(15, top + 1, z, 16, min(F, top + 3), z, AIR)
    chests = [(16, F + 3, 8, "south"), (28, F + 3, 8, "south"), (16, 1, 10, "south"), (28, 1, 10, "south"), (6, F + 1, 36, "north"), (38, F + 1, 36, "north")]
    mobs = [("etheria:angel_guardian", 22, F + 3, 10), ("etheria:pico", 14, F + 1, 33), ("etheria:garasha", 30, F + 1, 33), ("etheria:pico", 22, F + 1, 36), ("etheria:gracia", 22, 1, 15)]
    return g, F, chests, mobs, (22, F + 1, 44)

def fortaleza():
    """Fortaleza Sombria (Inferno): casca de pedra-negra com torres, salão do trono do Anjo Caído e celas"""
    W = D = 41; F = 3; H = F + 28; g = Grid(W, H, D)
    PB, BS, PBS, RNB, GB = B("polished_blackstone_bricks"), B("blackstone"), B("polished_blackstone"), B("red_nether_brick"), B("gilded_blackstone")
    CO, OB, SL, SLH, SH, NBF, RC = B("crying_obsidian"), B("obsidian"), B("soul_lantern"), B("soul_lantern", hanging=True), B("shroomlight"), B("nether_brick_fence"), B("red_carpet")
    g.fill(0, 0, 0, W - 1, F - 1, D - 1, BS); g.fill(0, F, 0, W - 1, F, D - 1, PBS)
    g.fill(0, F + 1, 0, W - 1, F + 8, D - 1, AIR)                     # fosso escavado em volta (a fortaleza fica "numa caverna")
    g.room(4, F, 4, 36, F + 18, 36, PB, floor=PBS, ceil=PB)
    for y in (F + 6, F + 12): g.ring(4, 4, 36, 36, y, y, RNB)
    g.ring(4, 4, 36, 36, F + 19, F + 19, PB, pred=lambda x, y, z: (x + z) % 2 == 0)
    for cx, cz in ((4, 4), (36, 4), (4, 36), (36, 36)):
        g.room(cx - 3, F, cz - 3, cx + 3, F + 24, cz + 3, PB, floor=PBS, ceil=PBS)
        g.ring(cx - 3, cz - 3, cx + 3, cz + 3, F + 18, F + 18, RNB); g.ring(cx - 4, cz - 4, cx + 4, cz + 4, F + 24, F + 24, RNB)
        g.ring(cx - 4, cz - 4, cx + 4, cz + 4, F + 25, F + 25, PB, pred=lambda x, y, z: (x + z) % 2 == 0)
        g.set(cx, F + 25, cz, CO); g.set(cx, F + 26, cz, SL)
        g.fill(cx, F + 1, cz + (3 if cz < 20 else -3), cx, F + 2, cz + (3 if cz < 20 else -3), AIR)
        g.fill(cx + (3 if cx < 20 else -3), F + 1, cz, cx + (3 if cx < 20 else -3), F + 2, cz, AIR)
    # entrada (sul)
    g.fill(18, F + 1, 36, 22, F + 6, 36, AIR); g.fill(17, F + 1, 36, 17, F + 7, 36, GB); g.fill(23, F + 1, 36, 23, F + 7, 36, GB); g.fill(17, F + 7, 36, 23, F + 7, 36, GB)
    for x in (16, 24): g.set(x, F + 1, 38, SL)
    # salão do trono
    for x in (10, 30):
        for z in (10, 16, 22, 28): g.fill(x, F + 1, z, x, F + 17, z, OB); g.fill(x, F + 6, z, x, F + 7, z, CO); g.fill(x, F + 12, z, x, F + 12, z, CO)
    for z in (12, 20, 28): g.set(20, F + 17, z, SLH)
    g.fill(19, F + 1, 11, 21, F + 1, 35, RC)
    g.fill(13, F + 1, 5, 27, F + 2, 9, PBS); g.fill(16, F + 1, 10, 24, F + 1, 10, PB)
    g.fill(19, F + 3, 5, 21, F + 8, 5, CO); g.fill(18, F + 3, 5, 18, F + 9, 5, GB); g.fill(22, F + 3, 5, 22, F + 9, 5, GB); g.set(20, F + 9, 5, GB)
    g.set(20, F + 3, 6, GB); g.set(19, F + 3, 6, BS); g.set(21, F + 3, 6, BS)
    for x in (14, 26): g.set(x, F + 2, 9, SH)
    # celas (oeste e leste)
    for x0, xb, sgn in ((5, 9, 1), (35, 31, -1)):
        for z in (19, 25): g.fill(min(x0, xb), F + 1, z, max(x0, xb), F + 17, z, PB)
        for z in list(range(14, 19)) + list(range(20, 25)) + list(range(26, 31)): g.fill(xb, F + 1, z, xb, F + 3, z, NBF)
        g.fill(xb, F + 4, 14, xb, F + 4, 30, PB)
        for z in (16, 22, 28): g.set(x0 + sgn, F + 1, z, SL)
    chests = [(14, F + 3, 6, "south"), (26, F + 3, 6, "south"), (6, F + 1, 15, "east"), (34, F + 1, 29, "west")]
    mobs = [("etheria:fallen_angel", 20, F + 3, 8), ("etheria:cornu", 12, F + 1, 24), ("etheria:cornu", 28, F + 1, 24),
            ("minecraft:wither_skeleton", 20, F + 1, 32), ("minecraft:wither_skeleton", 7, F + 1, 22)]
    return g, F, chests, mobs, (20, F + 1, 40)

def masmorra_goblin():
    """Masmorra do Rei Goblin: portaria em ruínas na superfície, escada até o salão do trono subterrâneo com celas"""
    W = D = 33; F = 14; H = F + 9; g = Grid(W, H, D); rng = random.Random(77)
    STONES = [B("stone_bricks"), B("mossy_stone_bricks"), B("cracked_stone_bricks"), B("mossy_cobblestone"), B("cobblestone")]
    SB, SP, LOG, HAY, BONE, GOLD = B("stone_bricks"), B("spruce_planks"), B("spruce_log"), B("hay_block"), B("bone_block"), B("gold_block")
    WEB, BARS, TORCH = B("web"), B("iron_bars"), B("torch")
    def mix(x1, y1, z1, x2, y2, z2):
        for x in range(x1, x2 + 1):
            for y in range(y1, y2 + 1):
                for z in range(z1, z2 + 1):
                    if (x, y, z) in g.v and g.v[(x, y, z)] == SB: g.set(x, y, z, rng.choice(STONES))
    g.room(2, 0, 1, 30, 9, 17, SB)                                      # salão subterrâneo
    for x in (7, 12, 20, 25):
        for z in (5, 12): g.fill(x, 1, z, x, 8, z, LOG)
    g.fill(12, 1, 2, 20, 2, 4, SP); g.fill(15, 3, 2, 17, 5, 2, GOLD); g.set(16, 6, 2, GOLD); g.set(16, 3, 3, HAY)
    for x in (14, 18): g.fill(x, 3, 2, x, 5, 2, BONE)
    for x0, xb in ((3, 6), (29, 26)):                                   # celas
        for z in (10, 13): g.fill(min(x0, xb), 1, z, max(x0, xb), 8, z, SB)
        for z in (7, 8, 9, 11, 12, 14, 15, 16): g.fill(xb, 1, z, xb, 3, z, BARS)
        g.fill(xb, 4, 6, xb, 8, 16, SB)
        for z in (7, 16): g.set(x0, 3, z, WEB); g.set(x0, 1, z, BONE)
    for x, z in ((10, 8), (22, 8), (11, 15), (21, 15)): g.set(x, 1, z, TORCH)
    for x, z in ((3, 2), (29, 2), (3, 16)): g.set(x, 8, z, WEB)
    # túnel com degraus até a superfície (sobe para o sul)
    for k in range(F + 1):
        z, top = 31 - k, F - k
        g.fill(14, max(0, top - 1), z, 18, top + 4, z, SB); g.fill(15, 0 if k == F else top, z, 17, top, z, SB)
        g.fill(15, top + 1, z, 17, top + 3, z, AIR)
    g.fill(15, 1, 17, 17, 3, 17, AIR)
    g.fill(13, F, 26, 19, F + 6, 32, SB); g.fill(14, F + 1, 26, 18, F + 5, 32, AIR)
    for k in range(0, 7):                                               # reabre os degraus sob o piso da portaria
        z, top = 31 - k, F - k
        g.fill(15, top + 1, z, 17, top + 3, z, AIR)
    g.fill(15, F + 1, 32, 17, F + 4, 32, AIR); g.fill(15, F, 32, 17, F, 32, SB)
    for x, z in ((14, 31), (18, 31)): g.set(x, F + 1, z, TORCH)
    for (x, z) in [(x, z) for x in range(6, 27) for z in (20, 32)] + [(x, z) for z in range(20, 33) for x in (6, 26)]:   # muro baixo em ruínas
        if 12 <= x <= 20 and z > 24: continue
        h = rng.choice([0, 1, 1, 2, 3])
        if h: g.fill(x, F + 1, z, x, F + h, z, SB)
    mix(0, 0, 0, W - 1, H - 1, D - 1)
    for x, z in ((10, 8), (22, 8), (11, 15), (21, 15)): g.set(x, 1, z, TORCH)
    chests = [(13, 3, 3, "south"), (19, 3, 3, "south"), (4, 1, 8, "east"), (28, 1, 15, "west"), (16, F + 1, 27, "south")]
    mobs = [("etheria:boss_goblin_king", 16, 3, 6), ("etheria:goblin", 10, 1, 10), ("etheria:goblin", 22, 1, 10), ("etheria:hobgoblin", 16, F + 1, 29)]
    return g, F, chests, mobs, (16, F + 1, 32)

def santuario_submerso():
    """Santuário Submerso: disco de prismarinho no fundo do mar, anel de pilares e cúpula de vidro com o altar de ametista"""
    W = D = 33; F = 3; H = F + 15; g = Grid(W, H, D); c = 16
    PR, PRB, DP, SEA, GLS, AM, WATER = B("prismarine"), B("prismarine_bricks"), B("dark_prismarine"), B("sea_lantern"), B("light_blue_stained_glass"), B("amethyst_block"), B("water")
    g.disc(c, c, 16, 0, F - 1, PR); g.disc(c, c, 15.5, F, F, DP); g.disc(c, c, 11.5, F, F, PRB, r0=9.5)
    g.disc(c, c, 16, F + 1, H - 1, WATER)
    for k in range(8):
        a = k * math.pi / 4; x, z = round(c + 13 * math.cos(a)), round(c + 13 * math.sin(a))
        g.fill(x, F + 1, z, x, F + 10, z, PRB); g.set(x, F + 11, z, SEA); g.set(x, F, z, SEA)
    for x in range(W):
        for z in range(D):
            if abs(math.hypot(x - c, z - c) - 13) < 0.55: g.set(x, F + 12, z, DP)
    for x in range(W):                                                   # cúpula com nervuras
        for y in range(F + 1, F + 9):
            for z in range(D):
                d = math.sqrt((x - c) ** 2 + (y - F) ** 2 + (z - c) ** 2)
                if 6.5 <= d <= 7.5:
                    rib = (x == c or z == c or abs(x - c) == abs(z - c))
                    g.set(x, y, z, PRB if rib else GLS)
    g.fill(15, F + 1, 21, 17, F + 3, 24, WATER)                          # entrada (sul)
    g.fill(15, F + 1, 15, 17, F + 1, 17, AM); g.set(16, F + 2, 16, SEA)
    chests = [(12, F + 1, 16, "east"), (20, F + 1, 16, "west"), (16, F + 1, 12, "south")]
    mobs = [("etheria:crystal_tide", 16, F + 2, 19), ("minecraft:drowned", 8, F + 1, 24), ("minecraft:drowned", 24, F + 1, 8),
            ("minecraft:guardian", 5, F + 5, 16), ("minecraft:guardian", 27, F + 5, 16)]
    return g, F, chests, mobs, (16, F + 1, 32)

def santuario_vazio():
    """Santuário do Vazio (End): ilha flutuante de pedra do End, 6 pilares de obsidiana com bastões do End e o trono da Rainha"""
    W = D = 37; F = 10; H = F + 15; g = Grid(W, H, D); c = 18; rng = random.Random(9)
    ES, EB, PUR, PP, OB, CO, AM, ROD = B("end_stone"), B("end_bricks"), B("purpur_block"), B("purpur_pillar"), B("obsidian"), B("crying_obsidian"), B("amethyst_block"), B("end_rod", facing_direction=1)
    for y in range(F):
        r = 2 + 15.5 * (y / F) ** 0.6
        for x in range(W):
            for z in range(D):
                if math.hypot(x - c, z - c) <= r - rng.random() * 1.5: g.set(x, y, z, ES)
    g.disc(c, c, 17, F, F, EB); g.disc(c, c, 6.5, F, F, PUR, r0=5); g.disc(c, c, 2.5, F, F, OB)
    g.disc(c, c, 17, F + 1, H - 1, AIR)
    for k in range(6):
        a = k * math.pi / 3 + math.pi / 6; x, z = round(c + 13 * math.cos(a)), round(c + 13 * math.sin(a))
        g.fill(x - 1, F + 1, z - 1, x + 1, F + 11, z + 1, OB); g.fill(x - 1, F + 6, z - 1, x + 1, F + 6, z + 1, CO); g.set(x, F + 12, z, ROD)
    for k in range(8):
        a = k * math.pi / 4; x, z = round(c + 8 * math.cos(a)), round(c + 8 * math.sin(a))
        if z < c - 5 and abs(x - c) < 3: continue
        g.fill(x, F + 1, z, x, F + 5, z, PP); g.set(x, F + 6, z, PUR)
    g.fill(15, F + 1, 8, 21, F + 1, 12, PUR)
    g.fill(17, F + 2, 8, 19, F + 6, 8, CO); g.fill(16, F + 2, 8, 16, F + 7, 8, OB); g.fill(20, F + 2, 8, 20, F + 7, 8, OB)
    g.set(18, F + 2, 9, OB); g.set(16, F + 8, 8, AM); g.set(20, F + 8, 8, AM); g.set(18, F + 7, 8, AM)
    chests = [(15, F + 2, 9, "south"), (21, F + 2, 9, "south"), (18, F + 1, 27, "north")]
    mobs = [("etheria:void_queen", 18, F + 2, 12), ("etheria:dungeon_crawler", 12, F + 1, 22), ("etheria:dungeon_crawler", 24, F + 1, 22)]
    return g, F, chests, mobs, (18, F + 1, 35)

# chave -> (construtor, nome, dimensão/terreno, tipo, solo, plano máx, separação, peso)
DG = {
    "castelo_celestial": (castelo, "Castelo Celestial", "land", "castelo", "grass|dirt|stone|sand|snow|podzol|coarse|gravel|moss", 7, 420, 2),
    "masmorra_goblin": (masmorra_goblin, "Masmorra do Rei Goblin", "land", "masmorra", "grass|dirt|podzol|moss|coarse|stone|gravel|sand", 5, 320, 3),
    "santuario_submerso": (santuario_submerso, "Santuário Submerso das Marés", "ocean", "santuario", "water|sand|gravel|clay|dirt", 6, 360, 2),
    "fortaleza_sombria": (fortaleza, "Fortaleza Sombria do Anjo Caído", "nether", "fortaleza", ".*", 99, 360, 1),
    "santuario_vazio": (santuario_vazio, "Santuário do Vazio", "end", "santuario", "end_stone", 99, 360, 1),
}
# loot por estrutura: (item, mín, máx, chance)
LOOT = {
    "castelo_celestial": [("etheria:pena_celestial", 2, 5, 0.9), ("etheria:nucleo_de_luz", 1, 1, 0.55), ("etheria:halo_quebrado", 1, 1, 0.22), ("etheria:celestial_crystal", 1, 3, 0.5),
                          ("etheria:archangel_lance", 1, 1, 0.06), ("minecraft:gold_ingot", 2, 6, 0.7), ("minecraft:diamond", 1, 2, 0.3), ("minecraft:golden_apple", 1, 1, 0.25), ("etheria:hp_potion_s", 1, 2, 0.4)],
    "fortaleza_sombria": [("etheria:pena_sombria", 2, 5, 0.9), ("etheria:fragmento_do_inferno", 1, 3, 0.7), ("etheria:demonite_shard", 1, 3, 0.5), ("etheria:shadow_scythe", 1, 1, 0.06),
                          ("minecraft:netherite_scrap", 1, 1, 0.18), ("minecraft:gold_ingot", 3, 8, 0.6), ("minecraft:blaze_rod", 1, 4, 0.5), ("etheria:hp_potion_s", 1, 2, 0.4)],
    "masmorra_goblin": [("etheria:goblin_ear", 1, 4, 0.8), ("minecraft:iron_ingot", 2, 6, 0.7), ("minecraft:gold_nugget", 4, 12, 0.6), ("minecraft:bread", 2, 5, 0.6),
                        ("minecraft:arrow", 6, 16, 0.5), ("minecraft:emerald", 1, 4, 0.45), ("etheria:hp_potion_s", 1, 2, 0.45), ("etheria:carne_draconica", 1, 2, 0.25), ("minecraft:saddle", 1, 1, 0.2)],
    "santuario_submerso": [("etheria:lagrima_cristalina", 1, 3, 0.85), ("minecraft:prismarine_crystals", 3, 8, 0.8), ("minecraft:nautilus_shell", 1, 2, 0.4), ("minecraft:heart_of_the_sea", 1, 1, 0.1),
                           ("etheria:mana_crystal", 1, 3, 0.6), ("minecraft:diamond", 1, 2, 0.3), ("etheria:peixe_glacial", 1, 2, 0.3)],
    "santuario_vazio": [("etheria:escama_do_vazio", 1, 3, 0.85), ("etheria:diadema_do_vazio", 1, 1, 0.12), ("etheria:void_fragment", 2, 5, 0.75), ("minecraft:ender_pearl", 2, 5, 0.6),
                        ("minecraft:shulker_shell", 1, 2, 0.3), ("minecraft:diamond", 1, 3, 0.4), ("etheria:arcane_ingot", 1, 2, 0.4)],
}

def item_ids():
    ids = set()
    for f in os.listdir(os.path.join(BP, "items")):
        try: ids.add(json.load(open(os.path.join(BP, "items", f), encoding="utf-8"))["minecraft:item"]["description"]["identifier"])
        except Exception: pass
    return ids

def loot_table(entries):
    pools = [{"rolls": {"min": 3, "max": 5}, "entries": []}]
    for i, lo, hi, ch in entries:   # um pool por item (chance própria) + nada vazio
        pools.append({"rolls": 1, "conditions": [{"condition": "random_chance", "chance": ch}],
                      "entries": [{"type": "item", "name": i, "weight": 1, "functions": [{"function": "set_count", "count": {"min": lo, "max": hi}}]}]})
    pools[0]["entries"] = [{"type": "item", "name": "minecraft:bread", "weight": 3, "functions": [{"function": "set_count", "count": {"min": 1, "max": 3}}]},
                           {"type": "item", "name": "minecraft:iron_nugget", "weight": 3, "functions": [{"function": "set_count", "count": {"min": 2, "max": 8}}]},
                           {"type": "item", "name": "minecraft:experience_bottle", "weight": 2, "functions": [{"function": "set_count", "count": {"min": 1, "max": 3}}]},
                           {"type": "empty", "weight": 4}]
    return {"pools": pools}

# ------------------------------------------------------------------ escrita .mcstructure
def write_struct(path, g):
    pal, idx = [VOID], {VOID: 0}
    blocks = []
    for x in range(g.w):
        for y in range(g.h):
            for z in range(g.d):
                b = g.v.get((x, y, z))
                if b not in idx: idx[b] = len(pal); pal.append(b)
                blocks.append(idx[b])
    def ent(b):
        if b is None: return [("name", (8, "minecraft:structure_void")), ("states", (10, [])), ("version", (3, VERSION))]
        n, st = b; out = []
        for k, t, v in st: out.append((k, (1, 1 if v else 0)) if t == "bool" else (k, (3, int(v))) if t == "int" else (k, (8, str(v))))
        return [("name", (8, n)), ("states", (10, out)), ("version", (3, VERSION))]
    root = [("format_version", (3, 1)), ("size", (9, (3, [g.w, g.h, g.d]))),
            ("structure", (10, [("block_indices", (9, (9, [(3, blocks), (3, [-1] * len(blocks))]))), ("entities", (9, (10, []))),
                                ("palette", (10, [("default", (10, [("block_palette", (9, (10, [ent(b) for b in pal]))), ("block_position_data", (10, []))]))]))])),
            ("structure_world_origin", (9, (3, [0, 0, 0])))]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"; tnbt.write(tmp, "", (10, root))
    new = open(tmp, "rb").read(); os.remove(tmp)
    if os.path.exists(path) and open(path, "rb").read() == new: return 0
    open(path, "wb").write(new); return 1

def W_(path, txt):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
    if old != txt: open(path, "w", encoding="utf-8").write(txt); return 1
    return 0

def build():
    out = {}
    for key, (fn, *_r) in DG.items():
        g, F, chests, mobs, entry = fn()
        for x, y, z, face in chests: g.set(x, y, z, chest(face))
        out[key] = (g, F, chests, mobs, entry)
    return out

def main():
    ids = item_ids(); miss = [i for L in LOOT.values() for i, *_ in L if i.startswith("etheria:") and i not in ids]
    if miss: print("AVISO: itens ainda inexistentes (gere tools/tame_dragons.py antes):", sorted(set(miss)))
    n = 0; data = {}
    for key, (g, F, chests, mobs, entry) in build().items():
        fn, name, where, kind, ground, flat, sep, w = DG[key]
        n += write_struct(os.path.join(BP, "structures/etheria", f"dg_{key}.mcstructure"), g)
        n += W_(os.path.join(BP, "loot_tables/etheria", f"dg_{key}.json"), json.dumps(loot_table(LOOT[key]), ensure_ascii=False, indent=1) + "\n")
        for x, y, z, _ in chests: assert g.v[(x, y, z)][0] == "minecraft:chest"
        data[key] = {"id": f"etheria:dg_{key}", "name": name, "faction": "regiao", "kind": kind, "size": [g.w, g.h, g.d], "floor": F, "w": w, "flat": flat,
                     "ground": ground, "near": None, "sep": sep, "rare": True, "entry": list(entry), "chests": [[x, y, z, f"dg_{key}"] for x, y, z, _ in chests],
                     "mobs": [list(m) for m in mobs], "lords": [], "manual": False, "dg": where, "blocks": sum(1 for b in g.v.values() if b != AIR), "pal": len(set(g.v.values())) + 1,
                     "pop": [], "gate": None, "realm": None}
        print(f"  {key}: {g.w}x{g.h}x{g.d} piso {F} | blocos {data[key]['blocks']} | baús {len(chests)} | mobs {len(mobs)} | {where}")
    js = ("// GERADO por tools/dungeons.py (8.8, Etapa 7b): masmorras dos chefes por região. Entram no registro WGEN (systems/worldgen.js);\n"
          "// o local é escolhido por systems/dungeons.js conforme `dg` (land / ocean / nether / end). Baús: loot table etheria/dg_<chave> (fallback em DG_LOOT).\n"
          f"export const DUNGEONS = {json.dumps(data, ensure_ascii=False)};\n"
          f"export const DG_LOOT = {json.dumps({'dg_' + k: [list(e) for e in v] for k, v in LOOT.items()}, ensure_ascii=False)};\n")
    n += W_(os.path.join(BP, "scripts/data/dungeons.gen.js"), js)
    print(f"masmorras: {len(data)} | arquivos alterados: {n}")
    return data

# ------------------------------------------------------------------ prévia (isométrica + planta)
COL = {"quartz": (236, 230, 222), "calcite": (222, 224, 220), "gold": (246, 208, 62), "light_blue_terracotta": (114, 108, 138), "stone_bricks": (122, 121, 122), "glass": (170, 210, 230),
       "lantern": (250, 190, 90), "sea_lantern": (200, 230, 230), "end_rod": (240, 230, 220), "yellow_carpet": (240, 200, 40), "blackstone": (44, 38, 46), "red_nether": (90, 12, 14),
       "gilded": (120, 80, 30), "crying": (60, 20, 110), "obsidian": (22, 16, 34), "shroomlight": (240, 150, 70), "fence": (60, 30, 36), "red_carpet": (160, 30, 30),
       "mossy": (100, 118, 86), "cracked": (112, 110, 110), "cobblestone": (120, 120, 120), "spruce": (110, 80, 50), "hay": (190, 160, 40), "bone": (220, 214, 190), "web": (230, 230, 230),
       "iron_bars": (150, 150, 150), "torch": (250, 200, 80), "dark_prismarine": (50, 92, 76), "prismarine_bricks": (96, 166, 150), "prismarine": (96, 150, 140), "stained_glass": (120, 170, 220),
       "amethyst": (150, 100, 200), "end_bricks": (220, 222, 160), "end_stone": (210, 210, 150), "purpur_pillar": (170, 120, 170), "purpur": (166, 122, 166), "chest": (170, 110, 40), "stone": (125, 125, 125)}
def colour(n):
    s = n.split(":")[1]
    for k in sorted(COL, key=len, reverse=True):
        if k in s: return COL[k]
    return (200, 0, 200)

def iso(g, scale=4, skip=("minecraft:air", "minecraft:water")):
    from PIL import Image, ImageDraw
    cw, ch = scale * 0.866, scale * 0.5
    W = int((g.w + g.d) * cw) + 8; H = int((g.w + g.d) * ch + g.h * scale) + 8
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    solid = {k: b for k, b in g.v.items() if b and b[0] not in skip}
    ox, oy = g.d * cw + 4, g.h * scale + 4
    P = lambda x, y, z: (ox + (x - z) * cw, oy + (x + z) * ch - y * scale)
    for (x, y, z) in sorted(solid, key=lambda k: (k[0] + k[2], k[1])):
        top, east, south = (x, y + 1, z) not in solid, (x + 1, y, z) not in solid, (x, y, z + 1) not in solid
        if not (top or east or south): continue
        c = colour(solid[(x, y, z)][0])
        sh = lambda f: tuple(min(255, int(v * f)) for v in c) + (255,)
        if top: dr.polygon([P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], fill=sh(1.0))
        if east: dr.polygon([P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z + 1)], fill=sh(0.72))
        if south: dr.polygon([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], fill=sh(0.86))
    return im.crop(im.getbbox())

PLAN_Y = {"castelo_celestial": 2, "masmorra_goblin": None, "santuario_submerso": 1, "fortaleza_sombria": 2, "santuario_vazio": 1}   # corte: piso + n (None = salão subterrâneo y 2)
def plan(g, F, chests, mobs, key, cell=4):
    """corte horizontal: paredes (bloco na altura do corte) escuras, piso claro, baús em amarelo, chefe em vermelho, guardas em laranja"""
    from PIL import Image, ImageDraw
    cy = 2 if PLAN_Y[key] is None else F + PLAN_Y[key]; fy = cy - 2
    im = Image.new("RGBA", (g.w * cell, g.d * cell), (30, 32, 36, 255)); dr = ImageDraw.Draw(im)
    for x in range(g.w):
        for z in range(g.d):
            b, f = g.v.get((x, cy, z)), g.v.get((x, fy, z))
            if b and b[0] not in ("minecraft:air", "minecraft:water"): col = tuple(int(v * 0.55) for v in colour(b[0]))
            elif f and f[0] not in ("minecraft:air", "minecraft:water"): col = colour(f[0])
            else: continue
            dr.rectangle([x * cell, z * cell, x * cell + cell - 1, z * cell + cell - 1], fill=col)
    for x, y, z, _ in chests:
        if abs(y - cy) <= 4: dr.rectangle([x * cell - 1, z * cell - 1, x * cell + cell, z * cell + cell], outline=(255, 220, 0), width=2)
    for i, (t, x, y, z) in enumerate(mobs):
        if abs(y - cy) > 4: continue
        r = 5 if i == 0 else 3; dr.ellipse([x * cell - r, z * cell - r, x * cell + r, z * cell + r], fill=(230, 30, 30) if i == 0 else (255, 140, 0))
    return im

def preview(out):
    from PIL import Image, ImageDraw
    S = build(); tiles = []
    for key, (g, F, chests, mobs, entry) in S.items():
        a = iso(g); s = min(1.0, 330 / a.width, 300 / a.height); a = a.resize((int(a.width * s), int(a.height * s)))
        p = plan(g, F, chests, mobs, key); p = p.resize((150, 150))
        tiles.append((DG[key][1], DG[key][2], a, p, len(chests), mobs[0][0].split(":")[1]))
    sheet = Image.new("RGBA", (len(tiles) * 340, 520), (58, 62, 70, 255)); dr = ImageDraw.Draw(sheet)
    from PIL import ImageFont
    try: fnt = ImageFont.truetype("DejaVuSans.ttf", 12)
    except Exception: fnt = None
    for i, (nm, where, a, p, nc, boss) in enumerate(tiles):
        x0 = i * 340
        sheet.alpha_composite(a, (x0 + (340 - a.width) // 2, 10 + (300 - a.height)))
        sheet.alpha_composite(p, (x0 + 10, 330)); dr.rectangle([x0 + 9, 329, x0 + 160, 480], outline=(200, 200, 200))
        dr.text((x0 + 10, 490), nm, fill=(255, 255, 255), font=fnt); dr.text((x0 + 170, 352), f"local: {where}", fill=(200, 200, 200), font=fnt)
        dr.text((x0 + 170, 370), f"chefe: {boss}", fill=(255, 120, 120), font=fnt); dr.text((x0 + 170, 388), f"baús: {nc}", fill=(255, 220, 0), font=fnt)
        dr.text((x0 + 170, 406), "planta: corte do salão", fill=(170, 170, 170), font=fnt); dr.text((x0 + 170, 430), "vermelho = chefe", fill=(255, 90, 90), font=fnt); dr.text((x0 + 170, 448), "laranja = guardas", fill=(255, 160, 60), font=fnt)
    sheet.save(out); print("prévia:", out)

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--preview": preview(sys.argv[2])
    else: main()

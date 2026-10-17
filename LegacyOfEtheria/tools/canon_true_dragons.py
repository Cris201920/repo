"""6.97 - Velzard e Velgrynd fiéis à obra (wiki de Tensura):
- chefes: Haki do Espírito do Dragão, Colapso de Gravidade, Existência Paralela, Dominação Espacial (Velgrynd);
  Nevasca, Cristal de Neve, Parede de Ar, Whiteout Absorb, Mundo Eterno / Parada do Tempo (Velzard)
- linhagens: nomes canônicos (Respiração Congelante, Parada Absoluta, Mundo Eterno) + Colapso de Gravidade / Nevasca (nível 75)
- Ultimates: Cthulhu, Senhor do Gelo Divino (nova, linha Velzard) e Cthugha liberada também pela linha Velgrynd.
Idempotente: pode rodar de novo."""
import json, os, re, colorsys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP, RP = os.path.join(ROOT, "LegacyOfEtheria_BP"), os.path.join(ROOT, "LegacyOfEtheria_RP")
S = os.path.join(BP, "scripts")
def rd(p): return open(p, encoding="utf-8").read()
def wr(p, s): open(p, "w", encoding="utf-8").write(s)

# ---------- 1) habilidades das linhagens
p = os.path.join(S, "data/skills.js"); s = rd(p)
REN = {"frost_breath": ("Sopro Congelante", "Respiração Congelante"), "absolute_freeze": ("Congelamento Absoluto", "Parada Absoluta"), "glacial_domain": ("Domínio Glacial", "Mundo Eterno")}
for sid, (a, b) in REN.items(): s = s.replace(f'def(A("{sid}", {{ name: "{a}"', f'def(A("{sid}", {{ name: "{b}"')
s = s.replace('desc: "Um inverno súbito congela tudo ao redor."', 'desc: "Mundo Eterno: o frio absoluto para o tempo ao redor e congela tudo (Gabriel, Senhor da Paciência)."')
NEW = {
 "gravity_collapse": ('def(A("gravity_collapse", { name: "Colapso de Gravidade", cat: "Racial", element: "fire", rarity: "legendary", mana: 70, cd: 28, level: 1, sp: 0,\n'
                      '  desc: "Velgrynd: comprime o espaço num ponto e cria um buraco negro artificial que puxa e esmaga os inimigos.", exec: { kind: "field", range: 24, radius: 7, sec: 4, power: 3.2, pull: 0.9, stat: "intelligence", snd: "mob.warden.sonic_charge" } }));', "// Veldanava (primordial)"),
 "blizzard": ('def(A("blizzard", { name: "Nevasca", cat: "Racial", element: "ice", rarity: "legendary", mana: 60, cd: 24, level: 1, sp: 0,\n'
              '  desc: "Velzard: uma nevasca de gelo dracônico envolve a área e castiga os inimigos sem parar.", exec: { kind: "field", range: 22, radius: 8, sec: 5, power: 2.6, stat: "intelligence", snd: "random.glass" } }));', "// Velgrynd (fogo)"),
}
for sid, (code, anchor) in NEW.items():
    if f'def(A("{sid}"' not in s: s = s.replace(anchor, code + "\n" + anchor, 1)
wr(p, s)
p = os.path.join(S, "data/lineages.js"); s = rd(p)
for lin, sid in (("velzard", "blizzard"), ("velgrynd", "gravity_collapse")):
    blk = re.search(rf'  {lin}: {{.*?mob: "etheria:{lin}"', s, re.S).group(0)
    if sid not in blk:
        nb = blk.replace('      { lvl: 90, depth: 3,', f'      {{ lvl: 75, depth: 3, skill: "{sid}" }},\n      {{ lvl: 90, depth: 3,', 1)
        s = s.replace(blk, nb)
wr(p, s)
# itens / ícones / nomes
def item(sid, name, color="§6"):
    json.dump({"format_version": "1.21.60", "minecraft:item": {"description": {"identifier": f"etheria:sk_{sid}", "menu_category": {"category": "none"}},
        "components": {"minecraft:icon": {"textures": {"default": f"etheria_sk_{sid}"}}, "minecraft:display_name": {"value": f"{color}{name}"},
                       "minecraft:max_stack_size": 1, "minecraft:cooldown": {"category": f"etheria_cd_{sid}", "duration": 0.05}, "minecraft:glint": True}}},
        open(os.path.join(BP, f"items/sk_{sid}.json"), "w"), indent=1, ensure_ascii=False)
def tint(src, dst, hue, sat=1.0):
    im = Image.open(os.path.join(RP, f"textures/items/etheria_sk_{src}.png")).convert("RGBA"); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, l, sa = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if sa > 0.15: r, g, b = [int(v * 255) for v in colorsys.hls_to_rgb(hue, l, min(1, sa * sat))]
            px[x, y] = (r, g, b, a)
    im.save(os.path.join(RP, f"textures/items/etheria_sk_{dst}.png"))
for sid, (a, b) in REN.items():
    ip = os.path.join(BP, f"items/sk_{sid}.json"); J = json.load(open(ip)); J["minecraft:item"]["components"]["minecraft:display_name"]["value"] = J["minecraft:item"]["components"]["minecraft:display_name"]["value"].replace(a, b)
    json.dump(J, open(ip, "w"), indent=1, ensure_ascii=False)
item("gravity_collapse", "Colapso de Gravidade"); item("blizzard", "Nevasca")
tint("dragon_inferno", "gravity_collapse", 0.78, 1.2); tint("glacial_domain", "blizzard", 0.55, 1.1)
tp = os.path.join(RP, "textures/item_texture.json"); T = json.load(open(tp))
for sid in ("gravity_collapse", "blizzard"): T["texture_data"][f"etheria_sk_{sid}"] = {"textures": f"textures/items/etheria_sk_{sid}"}
json.dump(T, open(tp, "w"), indent=1)
for lang in ("pt_BR", "en_US"):
    lp = os.path.join(RP, "texts", f"{lang}.lang"); L = rd(lp)
    for sid, (a, b) in REN.items(): L = L.replace(f"item.etheria:sk_{sid}={a}", f"item.etheria:sk_{sid}={b}")
    for sid, nm in (("gravity_collapse", "Colapso de Gravidade"), ("blizzard", "Nevasca")):
        if f"item.etheria:sk_{sid}=" not in L: L = L.rstrip("\n") + f"\nitem.etheria:sk_{sid}={nm}\n"
    wr(lp, L)

# ---------- 2) Ultimates: Cthulhu (nova) e Cthugha pela linha Velgrynd
p = os.path.join(S, "data/ultimates.js"); s = rd(p)
if '"ult_cthulhu"' not in s:
    s = s.replace('  U("ult_michael",', '''  U("ult_cthulhu", { name: "Cthulhu, Senhor do Gelo Divino", element: "ice", mana: 210, cd: 140, level: 85,
    desc: "Mundo Eterno congela o tempo ao redor (inimigos parados), Fixação Completa aprisiona o alvo num cristal e o Whiteout Absorb drena a energia de todos para você.",
    exec: { range: 30, radius: 14, power: 1.4, sec: 6, snd: "random.glass" } }),
  U("ult_michael",''', 1)
s = s.replace('ult_cthugha:        { level: 85, skillsAny: ["black_flame", "hell_flare", "drago_nova"], why: "nível 85 com uma chama suprema" },',
              'ult_cthugha:        { level: 85, skillsAny: ["black_flame", "hell_flare", "drago_nova", "dragon_inferno"], why: "nível 85 com uma chama suprema (ou a linha da Velgrynd)" },\n  ult_cthulhu:        { level: 85, skillsAny: ["glacial_domain"], why: "nível 85 com o Mundo Eterno (linha da Velzard)" },')
wr(p, s)
p = os.path.join(S, "systems/ultimates.js"); s = rd(p)
if "ULT.ult_cthulhu" not in s:
    s = s.replace("// 10. CTHUGHA:", '''// 12. CTHULHU (Velzard): Mundo Eterno (tempo parado), Fixação Completa (cristal no alvo), Whiteout Absorb (drena tudo)
ULT.ult_cthulhu = (pl, sk, s, d, H) => {
  const c = tc(pl, sk), dim = pl.dimension, sec = sk.exec.sec ?? 6, A = H.aim(pl, sk.exec.range), at = A.target ? { ...A.target.location } : A.point, R = sk.exec.radius;
  H.mark(up(pl.location, 1.3), at, at);
  prepare(c, pl, { col: "ice", col2: "frost", circle: CIRCLE.ice, size: 7, dur: 18, chargeSnd: "random.glass" });
  after(16, () => {               // Mundo Eterno: o tempo para ao redor
    const f = { ...pl.location };
    disc(c, f, { col: "ice", circle: CIRCLE.ice, size: R, life: sec, rot: 20 });
    shockwaves(c, f, R, "frost", 3, 4);
    blast(pl, sk, s, H, f, R, 0.8, { debuff: "stun", sec });
    every(sec * 20, 6, () => ringFlat(c, f, { col: "frost", n: 18, radius: R, life: 0.5, tile: T.shard }));
    snd(c, "random.glass", { at: f, vol: 1.5, pitch: 0.5 });
  });
  after(26, () => {               // Fixação Completa: cristal gigante aprisiona o alvo
    castGesture(pl, "target");
    every(24, 3, () => column(c, at, { col: "ice", n: 12, h: 9, r: 1.6, tile: T.shard, life: 0.8, size: 0.7 }));
    after(4, () => { blast(pl, sk, s, H, at, 3.5, 2.2, { debuff: "stun", sec: sec + 2, push: 0, lift: 0 }); impactCam(dim, at, [180, 230, 255], 30, 0.35); snd(c, "random.glass", { at, vol: 1.6, pitch: 0.7 }); });
  });
  after(50, () => {               // Whiteout Absorb: drena energia e vida de todos para o usuário
    implode(c, pl.location, { col: "frost", n: 40, radius: R, life: 0.8 });
    blast(pl, sk, s, H, pl.location, R, 1.6, { falloff: true });
    try { pl.addEffect("instant_health", 1, { amplifier: 2 }); pl.addEffect("absorption", 200, { amplifier: 3 }); } catch { /* ignore */ }
    try { const dd = getData(pl); dd.mana = Math.min(getStats(pl).maxMana, dd.mana + 120); } catch { /* ignore */ }
  });
  return true;
};

// 10. CTHUGHA:''', 1)
wr(p, s)

# ---------- 3) chefes: ataques canônicos
p = os.path.join(S, "systems/mobai.js"); s = rd(p)
if "gravity_collapse:" not in s:
    s = s.replace("};\n// papéis -> habilidades (ordem = prioridade)", '''  // ---- 6.97: técnicas da obra (wiki) ----
  dragon_haki: { act: "roar", min: 0, max: 14, cd: 18, wind: 16, tele: (e, t, c) => implode(c, eye(e), { col: e.typeId.includes("velzard") ? "frost" : "fire", n: 16, radius: 3 }),
    run(e, t, c) { announce(e, "Haki do Espírito do Dragão"); ringFlat(c, e.location, { col: e.typeId.includes("velzard") ? "ice" : "fire", n: 36, radius: 14, life: 0.9, tile: T.ring });
      for (const pl of near(e, e.location, 14)) { eff(pl, "weakness", 8, 2); eff(pl, "slowness", 4, 1); eff(pl, "nausea", 4, 0); hurtP(pl, e, H(e, 0.5)); push(pl, e.location, 1.2, 0.3); } sound(e, "ambient", 1.6, 0.6); } },
  gravity_collapse: { act: "ability", min: 4, max: 22, cd: 16, wind: 22, tele: (e, t, c) => { implode(c, t.location, { col: "void", n: 20, radius: 6 }); ringFlat(c, t.location, { col: "fire", n: 16, radius: 5 }); },
    run(e, t, c) { announce(e, "Colapso de Gravidade"); const at = { ...t.location };
      for (let i = 0; i < 6; i++) after(i * 4, () => { if (!isValid(e)) return; implode(c, at, { col: i % 2 ? "void" : "fire", n: 18, radius: 7 });
        for (const pl of near(e, at, 9)) { push(pl, at, 0.9, 0.05, true); hurtP(pl, e, H(e, 0.28)); eff(pl, "slowness", 2, 2); } });
      after(26, () => { if (!isValid(e)) return; burst(c, at, { col: "black", n: 30, spd: 6, up: 1 }); ringFlat(c, at, { col: "fire", n: 30, radius: 8, life: 0.6, tile: T.flame });
        for (const pl of near(e, at, 6)) { hurtP(pl, e, H(e, 1.2)); push(pl, at, 1.6, 0.6); } sound(e, "attack", 1.6, 0.6); }); } },
  parallel_existence: { act: "ability", min: 4, max: 24, cd: 20, wind: 14, tele: (e, t, c) => burst(c, eye(e), { col: "fire", n: 16, spd: 2, up: 1 }),
    run(e, t, c) { announce(e, "Existência Paralela"); const d = flat(e.location, t.location), side = { x: -d.z, z: d.x };
      for (const sg of [-1, 1]) { const o = { x: e.location.x + side.x * 5 * sg, y: e.location.y + 2, z: e.location.z + side.z * 5 * sg };
        column(c, o, { col: "fire", n: 14, h: 4, r: 1, tile: T.flame });
        for (let k = 0; k < 3; k++) after(8 + k * 6, () => { if (!isValid(e) || !isValid(t)) return; streak(c, o, eye(t), { col: k % 2 ? "gold" : "fire", w: 0.3, life: 0.35 }); hurtP(t, e, H(e, 0.4)); try { t.setOnFire(3, true); } catch { /* ignore */ } }); }
      sound(e, "attack", 1.3, 1.1); } },
  spatial_domination: { min: 6, max: 26, cd: 12, wind: 8, tele: (e, t, c) => burst(c, e.location, { col: "void", n: 14, up: 1 }),
    run(e, t, c) { announce(e, "Dominação Espacial"); blinkBehind(e, t); burst(c, e.location, { col: "fire", n: 16, up: 1 });
      after(4, () => { if (isValid(e) && isValid(t) && dist(e.location, t.location) < 7) { hurtP(t, e, H(e, 0.9)); push(t, e.location, 1.3, 0.4); } }); sound(e, "attack", 1, 1.4); } },
  blizzard: { act: "ability", min: 0, max: 18, cd: 14, wind: 16, tele: (e, t, c) => ringFlat(c, t.location, { col: "frost", n: 16, radius: 4 }),
    run(e, t, c) { announce(e, "Nevasca"); const at = { ...t.location };
      for (let i = 0; i < 8; i++) after(i * 5, () => { if (!isValid(e)) return; ringFlat(c, at, { col: i % 2 ? "ice" : "frost", n: 24, radius: 8, life: 0.6, tile: T.shard });
        column(c, at, { col: "white", n: 8, h: 6, r: 6 }); for (const pl of near(e, at, 8)) { hurtP(pl, e, H(e, 0.22)); eff(pl, "slowness", 3, 2); } });
      sound(e, "attack", 1.2, 1.2); } },
  snow_crystal: { min: 0, max: 30, cd: 24, wind: 6, cond: (e) => { try { const h = e.getComponent("minecraft:health"); return h.currentValue < h.effectiveMax * 0.7; } catch { return false; } },
    tele: () => {}, run(e, t, c) { announce(e, "Cristal de Neve"); eff(e, "resistance", 6, 3); for (let i = 0; i < 6; i++) after(i * 10, () => { if (isValid(e)) ringFlat(c, eye(e), { col: "ice", n: 14, radius: 3, life: 0.5, tile: T.shard }); }); sound(e, "ambient", 1, 1.5); } },
  air_wall: { min: 0, max: 7, cd: 12, wind: 8, tele: (e, t, c) => ringFlat(c, e.location, { col: "white", n: 12, radius: 3 }),
    run(e, t, c) { announce(e, "Parede de Ar"); ringFlat(c, e.location, { col: "frost", n: 30, radius: 7, life: 0.5, tile: T.ring }); for (const pl of near(e, e.location, 7)) { push(pl, e.location, 2.2, 0.5); hurtP(pl, e, H(e, 0.4)); } sound(e, "attack", 1.1, 1.3); } },
  whiteout_absorb: { act: "ability", min: 0, max: 14, cd: 20, wind: 14, tele: (e, t, c) => implode(c, eye(e), { col: "white", n: 20, radius: 6 }),
    run(e, t, c) { announce(e, "Whiteout Absorb"); implode(c, e.location, { col: "frost", n: 40, radius: 12, life: 0.8 }); let got = 0;
      for (const pl of near(e, e.location, 12)) { hurtP(pl, e, H(e, 0.6)); eff(pl, "hunger", 6, 2); eff(pl, "weakness", 6, 1); got++; }
      if (got) try { e.addEffect("regeneration", 100, { amplifier: 2 + Math.min(2, got) }); } catch { /* ignore */ } sound(e, "attack", 1.2, 0.7); } },
  eternal_world: { act: "roar", min: 0, max: 16, cd: 30, wind: 24, tele: (e, t, c) => { ringFlat(c, e.location, { col: "ice", n: 24, radius: 10 }); implode(c, eye(e), { col: "white", n: 16, radius: 4 }); },
    run(e, t, c) { announce(e, "Mundo Eterno: Parada do Tempo"); ringFlat(c, e.location, { col: "white", n: 40, radius: 16, life: 1.4, tile: T.shard });
      for (const pl of near(e, e.location, 16)) { eff(pl, "slowness", 2, 250); eff(pl, "mining_fatigue", 4, 3); eff(pl, "weakness", 4, 2); hurtP(pl, e, H(e, 0.3)); }
      after(40, () => { if (!isValid(e)) return; for (const pl of near(e, e.location, 16)) hurtP(pl, e, H(e, 0.8)); burst(c, eye(e), { col: "ice", n: 30, spd: 6 }); }); sound(e, "ambient", 1.6, 0.5); } },
};
// papéis -> habilidades (ordem = prioridade)''', 1)
    s = s.replace("const eye = (e) =>", '''const announce = (e, name) => { const col = e.typeId.includes("velzard") ? "§3" : "§c", who = e.nameTag || (MOBS[e.typeId]?.name ?? "");
  for (const q of near(e, e.location, 40)) { try { q.sendMessage(`${col}${who}§7: §f§l${name}!`); } catch { /* ignore */ } } };
const eye = (e) =>''', 1)
s = re.sub(r'  velzard: \["bite", "claw", "tail_sweep", "ice_breath"[^\]]*\],', '  velzard: ["bite", "claw", "tail_sweep", "ice_breath", "blizzard", "air_wall", "whiteout_absorb", "eternal_world", "dragon_haki", "snow_crystal", "roar", "dragon_flight", "heal_self"],', s)
s = re.sub(r'  velgrynd: \["bite", "claw", "tail_sweep", "breath", "fire_wave"[^\]]*\],', '  velgrynd: ["bite", "claw", "tail_sweep", "breath", "fire_wave", "gravity_collapse", "parallel_existence", "spatial_domination", "dragon_haki", "roar", "dragon_flight", "heal_self"],', s)
s = re.sub(r'velzard: \["arcane_burst", "blink", "leap"\]', 'velzard: ["arcane_burst", "blizzard", "air_wall", "snow_crystal", "blink", "leap"]', s)
s = re.sub(r'velgrynd: \["fire_wave", "blink", "leap"\]', 'velgrynd: ["fire_wave", "spatial_domination", "gravity_collapse", "parallel_existence", "leap"]', s)
wr(p, s)
print("ok")

// systems/skillkinds.js - Executores do Skill Pack: link, sense, bind, wave, storm, field, improvise, mark, steal, feast, combo, execute
// + pós-efeitos genéricos (buffSelf, buffAllies, invisible, cleanse, heal em buff, summon+buff).
import { system } from "@minecraft/server";
import { registerExec, registerPost, helpers, castSkill, cdLeft, hasSkill } from "./skills.js";
import { SKILLS } from "../data/skills.js";
import { LOOK } from "../data/fxpack.js";
import { getData, markDirty } from "../core/db.js";
import { getStats, applyDerivedStats } from "./stats.js";
import { addBuff, clearDebuffs } from "./effects.js";
import { ctx, mote, streak, ringFlat, column, bolt, burst, after, snd, T, skillPart } from "./fxlib.js";
import { CHOREO } from "../data/spellstages.js";
import { isValid, add, norm, sub, dot, dist, heal, healthComp, pick, say, toast } from "../core/utils.js";
import { analyze } from "./sage.js";
import { isValidTarget } from "./combat.js";

const H = () => helpers();
const mid = (e) => ({ x: e.location.x, y: e.location.y + 1, z: e.location.z });
const look = (sk) => LOOK[sk.id] ?? { A: "arcane", B: "white", tile: T.spark, circle: 0 };
const live = (e) => { try { return isValid(e) && (healthComp(e)?.currentValue ?? 0) > 0; } catch { return false; } };
const every = (ticks, times, fn) => {
  let n = 0;
  const id = system.runInterval(() => { try { if (n >= times || fn(n) === false) { system.clearRun(id); return; } } catch { system.clearRun(id); return; } n++; }, ticks);
};

// ------------------------------------------------------------------ link: dreno contínuo (Absorver e Dissolver, Vampirismo)
registerExec("link", (player, sk, s, d) => {
  const { aim, hitOne, mark } = H(), ex = sk.exec, a = aim(player, ex.range);
  if (!a.target) return "Sem alvo na mira.";
  const t = a.target, L = look(sk), c = ctx(player), total = Math.max(1, Math.round(ex.sec * 2));
  mark(a.head, mid(t), mid(t));
  every(10, total, (i) => {
    if (!live(t) || !isValid(player) || dist(player.location, t.location) > ex.range + 3) return false;
    const { dmg } = hitOne(player, t, sk, s, 1 / total);
    if (ex.heal) heal(player, dmg * ex.heal);
    if (ex.manaGain) { const dd = getData(player); dd.mana = Math.min(getStats(player).maxMana, dd.mana + dmg * ex.manaGain); markDirty(player); }
    // visual: fios de sucção do alvo até o conjurador
    const a0 = mid(t), b0 = { x: player.location.x, y: player.location.y + 1.2, z: player.location.z };
    for (let k = 1; k <= 4; k++) after(k, () => { const f = k / 5; mote(c, { x: a0.x + (b0.x - a0.x) * f, y: a0.y + (b0.y - a0.y) * f, z: a0.z + (b0.z - a0.z) * f }, { col: k % 2 ? L.A : L.B, tile: L.tile, size: 0.26, life: 0.4, spd: 0.3, dir: [0, 0.2, 0] }); });
    burst(c, a0, { col: L.A, tile: L.tile, n: 3, spd: 1, size: 0.25, life: 0.4 });
    skillPart(c, sk, "link", { from: a0, to: b0, at: a0, pos: b0, key: t.id });   // partículas portadas: fluxo alvo -> conjurador
  });
  return true;
});

// ------------------------------------------------------------------ sense: detecta e destaca criaturas
registerExec("sense", (player, sk) => {
  const { around, mark } = H(), ex = sk.exec, L = look(sk), c = ctx(player);
  mark(player.location, player.location, player.location);
  const list = around(player.dimension, player.location, ex.radius, player);
  for (const e of list) {
    try { e.addEffect("glowing", ex.sec * 20, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
    if (ex.mark) addBuff(e, "mark", ex.sec, { name: "Marcado" });
  }
  const pulses = Math.min(6, ex.sec);
  every(20, pulses, () => {
    if (!isValid(player)) return false;
    ringFlat(c, player.location, { col: L.A, tile: T.ring, radius: ex.radius * 0.3, n: 16, life: 0.6, size: 0.5 });
    for (const e of list.slice(0, 10)) if (live(e)) mote(c, { x: e.location.x, y: e.location.y + 2.3, z: e.location.z }, { col: L.B, tile: L.tile, size: 0.4, life: 0.9, spd: 0.2, dir: [0, 0.3, 0] });
  });
  try { player.onScreenDisplay.setActionBar(`§b${sk.name}: §f${list.length} presença(s) detectada(s)`); } catch { /* ignore */ }
  return true;
});

// ------------------------------------------------------------------ bind: fios que prendem os inimigos
registerExec("bind", (player, sk, s) => {
  const { aim, around, hitOne, mark, push } = H(), ex = sk.exec, a = aim(player, ex.range), L = look(sk), c = ctx(player);
  mark(a.head, a.point);
  const list = around(player.dimension, a.point, ex.radius, player);
  if (!list.length) return "Nenhum inimigo na área.";
  for (const e of list) { hitOne(player, e, sk, s, 0.6); push(e, a.point, 0.4, 0.1, true); }
  every(5, Math.ceil(ex.sec * 4), () => {
    for (const e of list) {
      if (!live(e)) continue;
      const p = e.location;
      streak(c, { x: p.x, y: p.y, z: p.z }, { x: p.x + (Math.random() - 0.5) * 0.6, y: p.y + 2.2, z: p.z + (Math.random() - 0.5) * 0.6 }, { col: L.A, w: 0.05, life: 0.3, tile: T.line });
      skillPart(c, sk, "bind", { at: p, pos: p, key: e.id });   // partículas portadas (fios etc.) em cada prisioneiro
      try { e.applyKnockback(0, 0, 0, 0); } catch { /* ignore */ }
    }
  });
  return true;
});

// ------------------------------------------------------------------ wave: onda ao redor do conjurador
registerExec("wave", (player, sk, s) => {
  const { around, hitOne, mark, push } = H(), ex = sk.exec, c0 = player.location;
  mark(c0, c0, c0);
  for (const e of around(player.dimension, c0, ex.radius, player)) {
    if (ex.power > 0.3) hitOne(player, e, sk, s); else if (ex.debuff) addBuff(e, ex.debuff.id, ex.debuff.sec, { src: player });
    if (ex.power > 0.3 && ex.debuff) { /* já aplicado por hitOne */ }
    if (ex.knock > 0) push(e, c0, ex.knock); else if (ex.knock < 0) push(e, c0, -ex.knock * 0.8, 0.1, true);
  }
  return true;
});

// ------------------------------------------------------------------ storm: raios/impactos repetidos numa área
// Com coreografia própria (data/spellstages.js): a nuvem se mantém no alto, cada raio é ANUNCIADO no chão antes de cair (dá para desviar)
// e o último cai no centro, maior. Sem coreografia: visual simples de antes.
registerExec("storm", (player, sk, s) => {
  const { aim, around, hitOne, mark } = H(), ex = sk.exec, a = aim(player, ex.range), L = look(sk), c = ctx(player), dim = player.dimension, ch = CHOREO[sk.id];
  mark(a.head, a.point);
  const center = a.point, every_ = Math.max(2, Math.round((ex.sec * 20) / ex.strikes));
  const mult = 1.6 / Math.sqrt(ex.strikes), last = ex.strikes - 1;
  const bolts = sk.element === "shadow" || sk.element === "lightning";
  const hitAt = (p, m) => {
    for (const e of around(dim, p, 2.2, player)) hitOne(player, e, sk, s, m);
    if (ex.healAllies) for (const pl of dim.getPlayers({ location: center, maxDistance: ex.radius + 1 })) heal(pl, ex.healAllies);
  };
  every(every_, ex.strikes, (i) => {
    if (!isValid(player)) return false;
    const ang = Math.random() * Math.PI * 2, r = ch?.strike && i === last ? 0 : Math.sqrt(Math.random()) * ex.radius;
    const p = { x: center.x + Math.cos(ang) * r, y: center.y, z: center.z + Math.sin(ang) * r };
    if (ch?.strike) {
      try { ch.sky?.(c, center, ex.radius, i, ex.strikes); ch.telegraph?.(c, p, i, ex.strikes); } catch { /* ignore */ }
      after(ch.delay ?? 4, () => {
        if (!isValid(player)) return;
        try { ch.strike(c, p, i, ex.strikes, ex); skillPart(c, sk, "strike", { at: p, pos: p }); const q = ch.strikeSfx?.(i, ex.strikes); if (q) snd(c, q.id, { vol: q.vol, pitch: q.pitch, at: p }); } catch { /* ignore */ }
        hitAt(p, i === last ? mult * 1.5 : mult);
      });
      return;
    }
    if (bolts) bolt(c, { x: p.x, y: p.y + 14, z: p.z }, p, { col: L.A, jitter: 1, branch: 0.3 });
    else for (let k = 0; k < 6; k++) mote(c, { x: p.x + (Math.random() - 0.5), y: p.y + 6, z: p.z + (Math.random() - 0.5) }, { col: k % 2 ? L.A : L.B, tile: L.tile, size: 0.35, life: 0.6, dir: [0, -1, 0], spd: 10 });
    burst(c, p, { col: L.B, tile: L.tile, n: 5, spd: 3, size: 0.3, up: 1 });
    skillPart(c, sk, "strike", { at: p, pos: p });   // partículas portadas no ponto de impacto de cada raio/golpe da tempestade
    hitAt(p, mult);
  });
  return true;
});

// ------------------------------------------------------------------ field: zona persistente (puxa/empurra/queima)
registerExec("field", (player, sk, s) => {
  const { aim, around, hitOne, mark, push } = H(), ex = sk.exec, a = aim(player, ex.range), L = look(sk), c = ctx(player);
  mark(a.head, a.point);
  const center = a.point, total = Math.round(ex.sec * 2);
  every(10, total, (i) => {
    if (!isValid(player)) return false;
    ringFlat(c, center, { col: L.A, tile: L.tile, radius: ex.radius, n: 14, life: 0.5, size: 0.4, start: ex.pull ? ex.radius : 0.5, spd: ex.pull ? -ex.radius / 0.5 : undefined });
    column(c, center, { col: L.B, tile: L.tile, n: 4, h: 2.5, life: 0.7, r: ex.radius * 0.5 });
    skillPart(c, sk, "pulse", { at: center, pos: center });   // partículas portadas a cada pulso do campo
    for (const e of around(player.dimension, center, ex.radius, player)) {
      hitOne(player, e, sk, s, ex.power > 0.5 ? 0.5 : 0.4);
      if (ex.pull) push(e, center, ex.pull, 0.1, true);
      if (ex.push) push(e, center, ex.push, 0.1);
    }
  });
  return true;
});

// ------------------------------------------------------------------ improvise: lança uma habilidade conhecida aleatória (grátis)
registerExec("improvise", (player, sk) => {
  const d = getData(player), s = getStats(player);
  const pool = d.unlockedSkills.filter((id) => { const k = SKILLS[id]; return k && k.type === "active" && id !== sk.id && !["improvise", "buff", "summon", "devour", "heal", "teleport", "sense", "mark", "feast"].includes(k.exec.kind) && cdLeft(player, id) <= 0; });
  if (!pool.length) return "Nenhuma habilidade ofensiva disponível para improvisar.";
  const id = pick(pool), k = SKILLS[id];
  const r = castSkill(player, id, { free: true });   // improvisação: o custo é o da própria habilidade de improviso
  if (!r.ok) return r.msg;
  say(player, `§d[Improvisação] §f${k.name}`);
  return true;
});

// ------------------------------------------------------------------ mark: Analista
registerExec("mark", (player, sk) => {
  const { aim, mark } = H(), ex = sk.exec, a = aim(player, ex.range);
  if (!a.target) return "Sem alvo na mira.";
  mark(a.head, mid(a.target), mid(a.target));
  addBuff(a.target, "mark", ex.sec, { name: "Analisado" });
  try { a.target.addEffect("glowing", ex.sec * 20, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
  if (ex.analyze) analyze(player, a.target, true);
  return true;
});

// ------------------------------------------------------------------ steal: Inveja / Usurpador
registerExec("steal", (player, sk, s) => {
  const { aim, hitOne, mark } = H(), ex = sk.exec, a = aim(player, ex.range);
  if (!a.target) return "Sem alvo na mira.";
  mark(a.head, mid(a.target), mid(a.target));
  hitOne(player, a.target, sk, s);
  addBuff(a.target, "weak", ex.sec, { src: player });
  const b = Math.round(3 + ex.power * 5);
  addBuff(player, "stolen_" + sk.id, ex.sec, { name: sk.name, stats: { strength: b, defense: Math.round(b * 0.6), intelligence: Math.round(b * 0.6) } });
  applyDerivedStats(player);
  say(player, `§5[${sk.name}] §7Poder roubado: §f+${b} Força §7por ${ex.sec}s.`);
  return true;
});

// ------------------------------------------------------------------ feast: Gourmet
registerExec("feast", (player, sk) => {
  const { mark } = H(), d = getData(player), s = getStats(player);
  mark(player.location, player.location, player.location);
  heal(player, 10);
  d.mana = Math.min(s.maxMana, d.mana + s.maxMana * 0.3);
  d.stamina = Math.min(s.maxStamina, d.stamina + s.maxStamina * 0.4);
  markDirty(player);
  return true;
});

// ------------------------------------------------------------------ combo: Mestre Marcial (3 golpes)
registerExec("combo", (player, sk, s) => {
  const { around, hitOne, mark, push } = H(), ex = sk.exec, c = ctx(player);
  mark(player.location, add(player.location, norm(player.getViewDirection()), ex.range));
  const hit = (n) => {
    if (!isValid(player)) return;
    const head = player.getHeadLocation(), dir = norm(player.getViewDirection()), cosA = Math.cos((ex.angle / 2) * Math.PI / 180);
    for (const e of around(player.dimension, player.location, ex.range + 1, player)) {
      const v = sub(mid(e), head), l = Math.hypot(v.x, v.y, v.z) || 1;
      if (l > ex.range + 1 || dot(norm(v), dir) < cosA) continue;
      hitOne(player, e, sk, s, n === ex.hits - 1 ? 1.6 : 0.8);
      push(e, player.location, n === ex.hits - 1 ? ex.knock * 2 : ex.knock * 0.3);
    }
    const p = add(head, dir, 1.6);
    streak(c, { x: p.x - dir.z * 1.1, y: p.y - 0.5 + n * 0.5, z: p.z + dir.x * 1.1 }, { x: p.x + dir.z * 1.1, y: p.y + 0.5 - n * 0.4, z: p.z - dir.x * 1.1 }, { col: n === 2 ? "gold" : "white", w: 0.16, life: 0.2 });
    try { player.playSound("random.anvil_land", { volume: 0.5, pitch: 1.2 + n * 0.2 }); } catch { /* ignore */ }
  };
  for (let n = 0; n < ex.hits; n++) { if (n === 0) hit(0); else after(n * 5, () => hit(n)); }
  return true;
});

// ------------------------------------------------------------------ execute: Impiedoso
registerExec("execute", (player, sk, s) => {
  const { aim, hitOne, mark } = H(), ex = sk.exec;
  let t = aim(player, ex.range).target;
  if (!t) return "Sem alvo na mira.";
  mark(player.getHeadLocation(), mid(t), mid(t));
  const h = healthComp(t), low = h && h.currentValue <= h.effectiveMax * ex.threshold;
  hitOne(player, t, sk, s, low ? ex.mult : 1);
  if (low) try { player.onScreenDisplay.setActionBar("§4§lEXECUÇÃO!"); } catch { /* ignore */ }
  return true;
});

// ------------------------------------------------------------------ pós-efeitos genéricos
registerPost((player, sk, s, d) => {
  const ex = sk.exec; if (!ex) return;
  const near = (r) => player.dimension.getPlayers({ location: player.location, maxDistance: r });
  if (ex.buffSelf) { addBuff(player, ex.buffSelf.id, ex.buffSelf.sec, { stats: ex.buffSelf.stats, name: sk.name }); applyDerivedStats(player); }
  if (ex.buffAllies) for (const p of near(ex.radius ?? 9)) addBuff(p, ex.buffAllies.id, ex.buffAllies.sec, { name: sk.name, vanilla: [["speed", 0], ["regeneration", 0]] });
  if (ex.invisible) { try { player.addEffect("invisibility", ex.invisible * 20, { amplifier: 0, showParticles: false }); } catch { /* ignore */ } }
  if (ex.cleanse) for (const p of near(ex.radius ?? 10)) clearDebuffs(p);
  if (ex.kind === "buff" && ex.heal) heal(player, ex.heal);
  if (ex.kind === "summon" && ex.buffSelf) { /* já tratado por buffSelf */ }
});

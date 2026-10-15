// systems/truedragon.js - Dragões Verdadeiros: transformação humanoide <-> Dragão Verdadeiro NA MESMA entidade.
// 6.23 — DOIS ESTÁGIOS: estágio 1 = forma humanoide (luta normal); estágio 2 = Dragão Verdadeiro, desperta UMA vez quando a vida cai a STAGE2 (65%) com jogador por perto.
// Fluxo: humanoide -> (vida <= 65% e jogador por perto) CARGA de 2 s (invulnerável e parado, aura crescente) -> evento etheria:to_dragon
//        (muda geometria, textura, escala, hitbox, velocidade e dano no cliente/servidor) + onda de choque + rugido
//        dragão -> (15 s sem inimigos por perto) concentra energia 1,5 s -> evento etheria:to_human.
// Como é UMA só entidade, vida, nome, alvo, efeitos, posição e rotação são preservados e não há duplicação possível.
import { world, system } from "@minecraft/server";
import { isValid, dist, say, healthComp, heal } from "../core/utils.js";
import { ctx, burst, implode, ringFlat, column, after, T } from "./fxlib.js";

export const FORMS = {
  "etheria:veldanava": { name: "Veldanava", col: "light", col2: "gold", sound: "etheria.mob.veldora" },
  "etheria:veldora":  { name: "Veldora", col: "bolt", col2: "violet", sound: "etheria.mob.veldora" },
  "etheria:velzard":  { name: "Velzard", col: "frost", col2: "ice", sound: "etheria.mob.velzard" },
  "etheria:velgrynd": { name: "Velgrynd", col: "fire", col2: "ember", sound: "etheria.mob.velgrynd" },
};
const CHARGE = 50, REVERT = 30, IDLE_BACK = 300, SCAN = 10, RANGE = 30, AGGRO = 26, STAGE2 = 0.65, STAGE2_HEAL = 0.1;
const ratio = (e) => { const h = healthComp(e); return h && h.effectiveMax > 0 ? h.currentValue / h.effectiveMax : 1; };
const st = new Map();   // entityId -> { state: "human"|"charging"|"dragon"|"reverting", last, nxt }

export const formOf = (e) => { try { return e.getProperty("etheria:form"); } catch { return undefined; } };
export function setAct(e, act, ticks = 20) {
  try { e.setProperty("etheria:act", act); } catch { return; }
  if (act === "none") return;
  system.runTimeout(() => { try { if (isValid(e) && e.getProperty("etheria:act") === act) e.setProperty("etheria:act", "none"); } catch { /* ignore */ } }, ticks);
}
const eff = (e, id, ticks, amp = 0) => { try { e.addEffect(id, ticks, { amplifier: amp, showParticles: false }); } catch { /* ignore */ } };
const drop = (e, id) => { try { e.removeEffect(id); } catch { /* ignore */ } };
const nearPlayers = (e, r) => { try { return e.dimension.getPlayers({ location: e.location, maxDistance: r }); } catch { return []; } };
const livePlayer = (p) => { const m = p.getGameMode?.(); return m !== "creative" && m !== "spectator"; };
const sfx = (e, kind, vol = 1.2, pitch = 1) => { const f = FORMS[e.typeId]; if (!f) return; for (const p of nearPlayers(e, 48)) { try { p.playSound(`${f.sound}_${kind}`, { location: e.location, volume: vol, pitch }); } catch { /* ignore */ } } };
const mid = (e, h) => ({ x: e.location.x, y: e.location.y + h, z: e.location.z });

function startCharge(e, tick) {
  const f = FORMS[e.typeId], s = st.get(e.id); s.state = "charging"; s.last = tick;
  e.addTag("tdr_busy"); setAct(e, "transform", CHARGE + 6);
  eff(e, "resistance", CHARGE + 10, 4); eff(e, "slowness", CHARGE + 10, 250);
  const pl = nearPlayers(e, 40); for (const p of pl) say(p, `§6[Etheria] §e${f.name}§f desperta a sua §cverdadeira forma de Dragão§f!`);
  const c = pl[0] ? ctx(pl[0], 1.2) : null;
  sfx(e, "ambient", 1.3, 1.2);
  for (let i = 0; i < 4; i++) after(i * 10, () => { if (!isValid(e) || !c) return; implode(c, mid(e, 1), { col: f.col, n: 10 + i * 4, radius: 3 + i }); column(c, e.location, { col: f.col2, n: 8, h: 4 + i, r: 0.6 }); });
  after(CHARGE, () => finishCharge(e, f, c));
}
function finishCharge(e, f, c) {
  const s = st.get(e.id); if (!isValid(e)) return;
  try { e.triggerEvent("etheria:to_dragon"); } catch (er) { console.warn(`[Etheria] to_dragon ${e.typeId}: ${er}`); }
  drop(e, "slowness"); drop(e, "resistance"); e.removeTag("tdr_busy");
  if (!e.hasTag("tdr_stage2")) { e.addTag("tdr_stage2"); heal(e, (healthComp(e)?.effectiveMax ?? 0) * STAGE2_HEAL); }   // 1ª vez: recupera 10% ao assumir a forma de Dragão (uma só vez por luta)
  if (s) { s.state = "dragon"; s.last = system.currentTick; }
  setAct(e, "roar", 34); sfx(e, "attack", 1.6, 0.7);
  if (c) { ringFlat(c, e.location, { col: f.col, n: 36, radius: 10, life: 0.8, tile: T.ring }); burst(c, mid(e, 2), { col: f.col2, n: 30, spd: 3, up: 2 }); burst(c, mid(e, 1), { col: "white", n: 16, spd: 1.5, up: 1 }); }
  for (const p of nearPlayers(e, 10)) { try { let dx = p.location.x - e.location.x, dz = p.location.z - e.location.z; const l = Math.hypot(dx, dz) || 1; p.applyKnockback(dx / l, dz / l, 1.4, 0.45); } catch { /* ignore */ } }
}
function startRevert(e, tick) {
  const f = FORMS[e.typeId], s = st.get(e.id); s.state = "reverting"; e.addTag("tdr_busy"); setAct(e, "ability", REVERT + 4);
  eff(e, "slowness", REVERT + 8, 250);
  const pl = nearPlayers(e, 48), c = pl[0] ? ctx(pl[0], 1) : null;
  if (c) for (let i = 0; i < 3; i++) after(i * 9, () => { if (isValid(e)) implode(c, mid(e, 3), { col: f.col2, n: 14, radius: 5 - i }); });
  after(REVERT, () => {
    if (!isValid(e)) return;
    try { e.triggerEvent("etheria:to_human"); } catch (er) { console.warn(`[Etheria] to_human ${e.typeId}: ${er}`); }
    drop(e, "slowness"); e.removeTag("tdr_busy"); s.state = "human"; s.nxt = system.currentTick + 100;
    if (c) { burst(c, mid(e, 1), { col: "white", n: 22, spd: 2, up: 1 }); ringFlat(c, e.location, { col: f.col2, n: 20, radius: 4, life: 0.5 }); }
    sfx(e, "ambient", 1, 1.3);
  });
}

function think(e, tick) {
  const f = formOf(e); if (f === undefined) return;                  // propriedade indisponível (BP antigo): não mexe
  let s = st.get(e.id);
  if (!e.hasTag("tdr_init")) { e.addTag("tdr_init"); try { e.triggerEvent("etheria:to_human"); } catch { /* ignore */ } st.set(e.id, { state: "human", last: tick, nxt: 0 }); return; }
  if (!s) { s = { state: f === "dragon" ? "dragon" : "human", last: tick, nxt: 0 }; st.set(e.id, s); if (e.hasTag("tdr_busy")) e.removeTag("tdr_busy"); }
  if (s.state === "charging" || s.state === "reverting") return;
  const foes = nearPlayers(e, AGGRO).filter(livePlayer);
  if (f === "human") {
    if (foes.length && tick >= s.nxt && ratio(e) <= STAGE2) startCharge(e, tick);   // estágio 2 só com a vida baixa
  } else if (f === "dragon") {
    s.state = "dragon";
    if (foes.length) s.last = tick; else if (tick - s.last > IDLE_BACK) startRevert(e, tick);
  }
}

/** alterna a forma (teste/admin): humano -> Dragão (carga completa) ou Dragão -> humano. Respeita a transformação em andamento. */
export function toggleForm(e) {
  if (!FORMS[e?.typeId] || !isValid(e)) return "invalid";
  const tick = system.currentTick; let s = st.get(e.id); if (!s) { s = { state: formOf(e) === "dragon" ? "dragon" : "human", last: tick, nxt: 0 }; st.set(e.id, s); }
  if (s.state === "charging" || s.state === "reverting") return "busy";
  if (formOf(e) === "human") { startCharge(e, tick); return "dragon"; }
  startRevert(e, tick); return "human";
}
export function startTrueDragons() {
  system.runInterval(() => {
    const tick = system.currentTick, seen = new Set();
    for (const pl of world.getAllPlayers()) {
      let es; try { es = pl.dimension.getEntities({ location: pl.location, maxDistance: RANGE * 3, families: ["true_dragon"] }); } catch { continue; }
      for (const e of es) { if (!FORMS[e.typeId] || seen.has(e.id)) continue; seen.add(e.id); try { think(e, tick); } catch (er) { console.warn(`[Etheria] truedragon ${e.typeId}: ${er}`); } }
    }
    if (tick % 600 < SCAN) for (const id of st.keys()) { try { if (!world.getEntity(id)) st.delete(id); } catch { st.delete(id); } }
  }, SCAN);
  // ferido por um jogador: acorda a forma verdadeira na hora; e anima o recuo
  world.afterEvents.entityHurt.subscribe((ev) => { try {
    const e = ev.hurtEntity; if (!FORMS[e?.typeId]) return;
    const s = st.get(e.id), tick = system.currentTick; if (s) s.last = tick;
    const f = formOf(e);
    if (f === "human" && s && s.state === "human" && tick >= s.nxt && ratio(e) <= STAGE2) { try { startCharge(e, tick); } catch { /* ignore */ } }
    else if (f === "dragon" && e.getProperty("etheria:act") === "none") setAct(e, "hurt", 8);
  } catch { /* ignore */ } });
}

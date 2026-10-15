// core/migrate.js - Migração versionada do save do jogador + saneamento a cada carga.
// Regras: cada passo é IDEMPOTENTE e nunca apaga progresso (habilidades desbloqueadas, nível, itens guardados em dados).
// A "verdade" do progresso é sempre d.unlockedSkills; equipadas/hotbar são derivadas e podem ser reconstruídas.
import { SKILLS } from "../data/skills.js";
import { MAX_SLOTS, INV_SIZE, SKILLBAR } from "../config.js";

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const uniq = (a) => [...new Set(a)];

export const MIGRATIONS = {
  // v1 -> v2: garante tipos básicos (saves antigos podiam ter campos nulos)
  1(d) {
    for (const k of ["unlockedSkills", "equippedSkills", "titles", "achievements"]) if (!Array.isArray(d[k])) d[k] = [];
    if (!isObj(d.quests)) d.quests = { active: {}, completed: [], daily: {} };
    if (!isObj(d.mastery)) d.mastery = {};
  },
  // v2 -> v3: habilidades como itens na hotbar (loadout + instâncias + recargas persistentes)
  2(d) {
    if (!isObj(d.loadout)) d.loadout = { v: 1, pos: {} };
    if (!isObj(d.loadout.pos)) d.loadout.pos = {};
    if (!isObj(d.skillInst)) d.skillInst = {};
    if (!isObj(d.cd)) d.cd = {};
    if (!isObj(d.settings)) d.settings = {};
    // O limite antigo era 4 slots; a lista é mantida na mesma ordem (agora vira itens físicos na hotbar no 1º login)
    d.equippedSkills = (Array.isArray(d.equippedSkills) ? d.equippedSkills : []).filter((id) => typeof id === "string");
  },
};

/** Aplica os passos de `from` até `to` (exclusivo). Um passo que falhe é registrado e NÃO interrompe o login. */
export function migrate(d, from, to) {
  let v = Number.isInteger(from) && from >= 1 ? from : 1;
  const applied = [];
  for (; v < to; v++) {
    const step = MIGRATIONS[v];
    if (step) { try { step(d); applied.push(v); } catch (e) { console.warn(`[Etheria] migração v${v}->v${v + 1} falhou: ${e}`); } }
  }
  if (!(d.v > to)) d.v = to;   // save de versão futura não é rebaixado
  return applied;
}

/** Saneamento a cada carga: corrige estados impossíveis sem perder habilidades desbloqueadas. */
export function sanitize(d) {
  const fixes = [];
  if (!Array.isArray(d.unlockedSkills)) { d.unlockedSkills = []; fixes.push("unlocked"); }
  d.unlockedSkills = uniq(d.unlockedSkills.filter((id) => typeof id === "string"));
  if (!Array.isArray(d.equippedSkills)) d.equippedSkills = [];
  const eq = uniq(d.equippedSkills).filter((id) => SKILLS[id]?.type === "active" && d.unlockedSkills.includes(id)).slice(0, MAX_SLOTS);
  if (eq.length !== d.equippedSkills.length) fixes.push("equipped");
  d.equippedSkills = eq;
  if (!Number.isInteger(d.slot) || d.slot < 0) d.slot = 0;
  // loadout.pos: só equipadas, slots inteiros 0..35 e sem dois ids no mesmo slot
  if (!isObj(d.loadout)) d.loadout = { v: 1, pos: {} };
  if (!isObj(d.loadout.pos)) d.loadout.pos = {};
  const used = new Set(), pos = {};
  for (const id of eq) {
    const s = d.loadout.pos[id];
    if (Number.isInteger(s) && s >= 0 && s < INV_SIZE && !used.has(s)) { pos[id] = s; used.add(s); }
  }
  d.loadout.pos = pos;
  if (!isObj(d.skillInst)) d.skillInst = {};
  for (const k of Object.keys(d.skillInst)) if (!eq.includes(k) || typeof d.skillInst[k] !== "string" || !d.skillInst[k]) delete d.skillInst[k];
  // d.cd[id] = instante (ms, relógio real) em que a habilidade volta a ficar pronta; expiradas ou absurdas são descartadas
  if (!isObj(d.cd)) d.cd = {};
  const now = Date.now();
  for (const k of Object.keys(d.cd)) { const v = d.cd[k]; if (!SKILLS[k] || typeof v !== "number" || !(v > now) || v > now + 3600 * 1000) delete d.cd[k]; }
  if (!isObj(d.settings)) d.settings = {};
  if (!isObj(d.settings.skillbar)) d.settings.skillbar = { ...SKILLBAR.defaults };
  for (const [k, v] of Object.entries(SKILLBAR.defaults)) if (typeof d.settings.skillbar[k] !== typeof v) d.settings.skillbar[k] = v;
  return fixes;
}

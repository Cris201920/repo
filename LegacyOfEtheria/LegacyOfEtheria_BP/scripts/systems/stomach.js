// systems/stomach.js - 6.55: ESTÔMAGO do Predador (Gula / Beelzebuth): armazenamento interno REAL, por jogador e salvo no personagem.
// Guarda só dados seguros (ids e contagens — nunca objetos da API):
//   mobs   {typeId: n}  criaturas devoradas INTACTAS (removidas sem soltar itens -> o material só sai pelo processamento, sem duplicar)
//   items  {typeId: n}  itens do chão devorados        blocks {typeId: n} blocos devorados (material)
//   analyzed {typeId: 1}  criaturas já analisadas       log [{t, k, id, n}] histórico (últimos 60)
// Capacidade (unidades somadas) por estágio: Predador 256 · Gula 1024 · Beelzebuth 4096 (STOMACH_CAP).
// PROCESSAR uma criatura usa a tabela REAL de drops dela (data/mobs.gen.js) — nada de recompensa inventada — e pode extrair as habilidades
// absorvíveis da família dela (systems/mobskills.js FAMILY_SKILLS), com requisitos: quantidade devorada, análise feita, nível da habilidade,
// e nunca Únicas/Lendárias/Míticas/Divinas.
import { ItemStack, system, world } from "@minecraft/server";
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, playSound } from "../core/utils.js";
import { MOBS } from "../data/mobs.gen.js";
import { ITEMS } from "../data/items.gen.js";
import { SKILLS } from "../data/skills.js";
import { menu as baseMenu } from "./ui/forms.js";
import { hasSkill, grantSkill, registerExec } from "./skills.js";
import { familyOf } from "./mobskills.js";
import { sageText } from "./voice.js";
import { remember } from "./sageknow.js";
import { ctx, orbit, implode, burst, ringFlat, T } from "./fxlib.js";
import { RANKS } from "./power.js";
import { STOMACH_EVOLVE, BEELZEBUTH_EVOLVE } from "./predator.js";

export const STOMACH_CAP = { predator: 256, gluttony: 1024, beelzebuth: 4096 };
export const EXTRACT_NEED = { common: 5, uncommon: 4, rare: 3, boss: 1, special: 1, legendary: 1 };   // quantos devorados para extrair habilidade
const NO_ABSORB = new Set(["legendary", "mythic", "divine"]);

export const predTier = (d) => (hasSkill(d, "beelzebuth") ? "beelzebuth" : hasSkill(d, "gluttony") ? "gluttony" : hasSkill(d, "predator") ? "predator" : null);
export function stom(d) {
  const s = (d.stom ??= { mobs: {}, items: {}, blocks: {}, analyzed: {}, log: [] });
  s.mobs ??= {}; s.items ??= {}; s.blocks ??= {}; s.analyzed ??= {}; s.log ??= []; s.digested ??= {}; s.digest ??= true;
  return s;
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
export const used = (d) => { const s = stom(d); return sum(s.mobs) + sum(s.items) + sum(s.blocks); };
export const capOf = (d) => STOMACH_CAP[predTier(d)] ?? 0;
export const room = (d) => Math.max(0, capOf(d) - used(d));
const logIt = (s, k, id, n) => { s.log.push({ t: Date.now(), k, id, n }); while (s.log.length > 60) s.log.shift(); };
export const nameOf = (id) => MOBS[id]?.name ?? ITEMS[id]?.name ?? String(id).replace(/^[a-z_]+:/, "").replace(/_/g, " ");

/** guarda conteúdo (k = "mobs" | "items" | "blocks"); devolve quanto coube */
export function store(player, k, id, n = 1) {
  const d = getData(player), fit = Math.min(n, room(d)); if (fit <= 0) return 0;
  const s = stom(d); s[k][id] = (s[k][id] ?? 0) + fit; logIt(s, k, id, fit); markDirty(player);
  return fit;
}
function take(player, k, id, n) {
  const d = getData(player), s = stom(d), have = s[k][id] ?? 0, t = Math.min(have, n); if (t <= 0) return 0;
  if (have - t <= 0) delete s[k][id]; else s[k][id] = have - t;
  logIt(s, "-" + k, id, t); markDirty(player); return t;
}
function give(player, id, n) {
  let left = n;
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    while (left > 0) {
      const st = new ItemStack(id, Math.min(64, left)); const rest = inv?.addItem(st);
      left -= Math.min(64, left);
      if (rest) { try { player.dimension.spawnItem(rest, player.location); } catch { /* ignore */ } }
    }
    return true;
  } catch { return false; }   // id que não vira item (alguns blocos técnicos): nada é perdido, continua no estômago
}

// ---------------------------------------------------------------- análise (só dados reais)
export function analysisLines(d, id) {
  const m = MOBS[id], s = stom(d), have = s.mobs[id] ?? 0, fam = familyOf(id);
  const L = [`§fCriatura: §e${nameOf(id)} §8(${id})`];
  if (m) {
    const hp = m.hp ?? 0, r = hp >= 35000 ? 8 : hp >= 18000 ? 7 : hp >= 8000 ? 6 : hp >= 3000 ? 5 : hp >= 1000 ? 4 : hp >= 300 ? 3 : hp >= 150 ? 2 : hp >= 60 ? 1 : 0;
    L.push(`§7Categoria: §f${{ common: "comum", uncommon: "incomum", rare: "rara", boss: "chefe", legendary: "lendária", special: "especial" }[m.rar] ?? m.rar}§7 · Classe: ${RANKS[r].col}${RANKS[r].name}`);
    L.push(`§7Vida máxima: §c${hp}§7 · Dano base: §c${m.dmg ?? "?"}§7${m.role ? ` · Comportamento: §f${m.role}` : ""}`);
    const drops = (m.drops ?? []).map(([it, a, b, ch]) => `${nameOf(it)} ${a === b ? a : `${a}-${b}`} (${Math.round(ch * 100)}%)`);
    L.push(`§7Materiais por processamento: §f${drops.length ? drops.join(", ") : "nenhum registrado"}`);
  } else L.push("§7Sem registro de atributos para esta criatura.");
  const abs = fam.list.filter((k) => SKILLS[k] && !NO_ABSORB.has(SKILLS[k].rarity) && SKILLS[k].cat !== "Única");
  const need = EXTRACT_NEED[m?.rar] ?? 5;
  L.push(abs.length ? `§7Habilidades absorvíveis: ${abs.map((k) => `${hasSkill(d, k) ? "§a✔" : "§d"}${SKILLS[k].name}§7`).join(", ")} §8(precisa de ${need} no estômago + análise; você tem ${have})`
    : "§7Nenhuma habilidade absorvível foi identificada.");
  return L;
}
export function analyze(player, id) {
  const d = getData(player), s = stom(d);
  const first = !s.analyzed[id]; s.analyzed[id] = 1; markDirty(player);
  const c = ctx(player); orbit(c, () => ({ x: player.location.x, y: player.location.y + 1.1, z: player.location.z }), { col: "mana", tile: T.glyph, n: 4, r: 1, dur: 30, step: 2, size: 0.18, speed: 2, life: 0.4 });
  try { sageText(player, `Análise concluída. Criatura identificada: ${nameOf(id)}. ${first ? "Propriedades registradas no Estômago." : "Registro atualizado."}`, { pri: 3, key: "stom.an." + id, cd: 100 }); } catch { /* ignore */ }
  if (first) { try { remember(player, "know", `Analisou ${nameOf(id)} no Estômago`); } catch { /* ignore */ } }
  return analysisLines(d, id);
}
/** processa n criaturas: drops reais rolados por unidade + tentativa de extrair habilidade da família */
export function processMob(player, id, n = 1, o = {}) {
  const d = getData(player), m = MOBS[id], t = take(player, "mobs", id, n); if (!t) return "Nada para processar.";
  const out = {};
  for (let i = 0; i < t; i++) for (const [it, a, b, ch] of m?.drops ?? []) if (Math.random() < ch) out[it] = (out[it] ?? 0) + a + Math.floor(Math.random() * (b - a + 1));
  for (const [it, q] of Object.entries(out)) if (o.keep || !give(player, it, q)) store(player, "items", it, q);
  const c = ctx(player), L = { x: player.location.x, y: player.location.y + 1, z: player.location.z };
  orbit(c, () => ({ x: player.location.x, y: player.location.y + 1, z: player.location.z }), { col: "violet", tile: T.orb, n: 3, r: 0.7, dur: 24, step: 2, size: 0.16, speed: 3 });
  implode(c, L, { col: "shadow", tile: T.smoke, n: 10, radius: 1.6, life: 0.5, size: 0.3 });
  let learned = null;
  const s = stom(d), need = EXTRACT_NEED[m?.rar] ?? 5;
  s.digested[id] = (s.digested[id] ?? 0) + t;
  const devouredTotal = Math.max((s.mobs[id] ?? 0) + t, s.digested[id]);
  if (s.analyzed[id] && devouredTotal >= need) {
    for (const k of familyOf(id).list) {
      const sk = SKILLS[k]; if (!sk || NO_ABSORB.has(sk.rarity) || sk.cat === "Única" || hasSkill(d, k) || d.level < (sk.level ?? 1)) continue;
      grantSkill(player, k); learned = sk; break;
    }
  }
  if (learned) { burst(c, L, { col: "mana", tile: T.star, n: 24, spd: 4, life: 0.6, size: 0.14 }); ringFlat(c, L, { col: "white", tile: T.ring, n: 20, radius: 2, spd: 4, life: 0.4, size: 0.14 });
    d.predSkills ??= {}; d.predSkills[learned.id] = { from: id, at: Date.now() }; saveNow(player);
    try { sageText(player, `Processamento concluído. Habilidade obtida: ${learned.name}.`, { pri: 2, key: "stom.skill", cd: 40 }); } catch { /* ignore */ } }
  const got = Object.entries(out).map(([it, q]) => `${nameOf(it)} x${q}`).join(", ");
  return `§7Processado: §f${nameOf(id)} x${t}§7 → ${got || "nenhum material desta vez"}${learned ? `\n§d✦ Habilidade obtida: ${learned.name}` : ""}`;
}
// ---------------------------------------------------------------- 6.85: DIGESTÃO AUTOMÁTICA
// A cada ciclo o Estômago digere criaturas guardadas: analisa (se ainda não analisou), quebra em materiais (drops reais, guardados no próprio
// Estômago) e, ao digerir o bastante de uma espécie (EXTRACT_NEED pela raridade), extrai uma habilidade da família dela.
// Velocidade: Predador 1 a cada 10 s · Gula 2 · Beelzebuth 4. Liga/desliga no menu do Estômago.
const DIGEST_EVERY = 200, DIGEST_N = { predator: 1, gluttony: 2, beelzebuth: 4 };
function digestTick(player) {
  const d = getData(player), tier = predTier(d); if (!tier) return;
  if (!hasSkill(d, "stomach")) { try { grantSkill(player, "stomach"); } catch { /* ignore */ } }
  const s = stom(d); if (!s.digest) return;
  const ids = Object.keys(s.mobs); if (!ids.length) return;
  let left = DIGEST_N[tier] ?? 1;
  for (const id of ids) {
    if (left <= 0) break;
    const n = Math.min(left, s.mobs[id] ?? 0); if (!n) continue;
    const first = !s.analyzed[id];
    if (first) { try { analyze(player, id); } catch { /* ignore */ } }
    const before = Object.keys(d.predSkills ?? {}).length;
    processMob(player, id, n, { keep: true });
    left -= n;
    const got = Object.keys(d.predSkills ?? {}).length > before;
    if (got) { const last = Object.entries(d.predSkills).sort((a, b) => b[1].at - a[1].at)[0]; say(player, `§5[Estômago] §fDigestão de ${nameOf(id)} concluída: habilidade §d${SKILLS[last?.[0]]?.name ?? "?"}§f extraída.`); }
    else if (first) say(player, `§5[Estômago] §7Digerindo ${nameOf(id)}... análise registrada §8(${s.digested[id] ?? 0}/${EXTRACT_NEED[MOBS[id]?.rar] ?? 5} para extrair habilidade)`);
  }
}
export function startStomach() {
  registerExec("stomach", (player) => { system.run(() => { try { openStomachUI(player); } catch { /* ignore */ } }); return true; });
  system.runInterval(() => { for (const p of world.getAllPlayers()) { try { digestTick(p); } catch { /* ignore */ } } }, DIGEST_EVERY);
}
export function release(player, k, id, n) {
  const t = Math.min(stom(getData(player))[k][id] ?? 0, n); if (!t) return "Nada para liberar.";
  if (!give(player, id, t)) return "§cEste conteúdo não pode virar item; continua guardado.";
  take(player, k, id, t); playSound(player, "random.pop", 0.6, 0.8);
  return `§7Liberado: §f${nameOf(id)} x${t}`;
}

// ---------------------------------------------------------------- interface
const menu = (p, t, b, B) => baseMenu(p, t, b, B);
const bar = (a, b, n = 16) => { const f = Math.round((a / Math.max(1, b)) * n); return `§5${"█".repeat(Math.min(n, f))}§8${"█".repeat(Math.max(0, n - f))}`; };
export function openStomachUI(player, back) {
  const d = getData(player), tier = predTier(d), s = stom(d);
  if (!tier) { menu(player, "§l§5ESTÔMAGO", "§7Você não possui Predador. A raça Slime começa com ele; também pode surgir ao derrotar slimes, chefes e criaturas especiais.", back ? [{ text: "Voltar", run: back }] : []); return; }
  const name = { predator: "Predador", gluttony: "Gula", beelzebuth: "Beelzebuth" }[tier];
  const body = [`§5${name} §7· capacidade ${bar(used(d), capOf(d))} §f${used(d)}/${capOf(d)}`,
    `§7Criaturas: §f${sum(s.mobs)}§7 · Itens: §f${sum(s.items)}§7 · Materiais: §f${sum(s.blocks)}§7 · Analisadas: §f${Object.keys(s.analyzed).length}`,
    `§7Digestão automática: ${s.digest ? "§aligada" : "§cdesligada"} §8(${({ predator: 1, gluttony: 2, beelzebuth: 4 })[tier]} criatura(s) a cada 10 s)§7 · Digeridas: §f${sum(s.digested)}`,
    `§7Devorados no total: §f${d.devoured ?? 0}§7 · Habilidades obtidas pelo Predador: §f${Object.keys(d.predSkills ?? {}).length + Object.keys(d.absorbed ?? {}).length}`,
    tier === "predator" ? `§7Evolução para §5Gula§7: ${Math.min(d.devoured ?? 0, STOMACH_EVOLVE)}/${STOMACH_EVOLVE} devorados e nível 35 §8(capacidade 1024, devora até 4 alvos, chefes)`
      : tier === "gluttony" ? `§7Evolução para §5Beelzebuth§7: ${Math.min(d.devoured ?? 0, BEELZEBUTH_EVOLVE.devoured)}/${BEELZEBUTH_EVOLVE.devoured} devorados e nível ${BEELZEBUTH_EVOLVE.level} §8(capacidade 4096, seres lendários)` : "§5Beelzebuth: §7forma máxima da Gula."].join("\n");
  const self = () => openStomachUI(player, back);
  menu(player, "§l§5ESTÔMAGO", body, [
    { text: `§lCriaturas §8(${Object.keys(s.mobs).length})`, icon: "menu_inventory", run: () => openList(player, "mobs", self) },
    { text: `§lItens §8(${Object.keys(s.items).length})`, icon: "menu_inventory", run: () => openList(player, "items", self) },
    { text: `§lMateriais §8(${Object.keys(s.blocks).length})`, icon: "menu_inventory", run: () => openList(player, "blocks", self) },
    { text: s.digest ? "§lDigestão: §aLIGADA\n§r§7toque para pausar" : "§lDigestão: §cPAUSADA\n§r§7toque para retomar", icon: "menu_skills", run: () => { s.digest = !s.digest; markDirty(player); self(); } },
    { text: "§lHabilidades obtidas", icon: "menu_skills", run: () => openSkills(player, self) },
    { text: "§lHistórico de absorções", icon: "menu_quests", run: () => openLog(player, self) },
    ...(back ? [{ text: "Voltar", run: back }] : []),
  ]);
}
function openList(player, k, back) {
  const d = getData(player), s = stom(d), ent = Object.entries(s[k]).sort((a, b) => b[1] - a[1]).slice(0, 40);
  const self = () => openList(player, k, back);
  if (!ent.length) { menu(player, "§l§5ESTÔMAGO", "§7Vazio.", [{ text: "Voltar", run: back }]); return; }
  menu(player, { mobs: "§l§5CRIATURAS", items: "§l§5ITENS", blocks: "§l§5MATERIAIS" }[k], "§7Toque para examinar, processar ou liberar.",
    ent.map(([id, n]) => ({ text: `${k === "mobs" && s.analyzed[id] ? "§a" : "§f"}${nameOf(id)} §7x${n}`, run: () => openEntry(player, k, id, self) })).concat([{ text: "Voltar", run: back }]));
}
function openEntry(player, k, id, back) {
  const d = getData(player), n = stom(d)[k][id] ?? 0, self = () => openEntry(player, k, id, back);
  const done = (msg) => { say(player, msg); self(); };
  const B = [];
  if (k === "mobs") {
    B.push({ text: "§lExaminar (análise do Sábio)", run: () => { const L = analyze(player, id); menu(player, "§l§bANÁLISE", L.join("\n"), [{ text: "Voltar", run: self }]); } });
    if (n) B.push({ text: "§lProcessar 1", run: () => done(processMob(player, id, 1)) });
    if (n > 1) B.push({ text: `§lProcessar todos (${n})`, run: () => done(processMob(player, id, n)) });
    if (n) B.push({ text: "§cDescartar 1", run: () => { take(player, "mobs", id, 1); done(`§7Descartado: ${nameOf(id)}`); } });
  } else {
    if (n) B.push({ text: "§lLiberar 1", run: () => done(release(player, k, id, 1)) });
    if (n) B.push({ text: `§lLiberar tudo (${n})`, run: () => done(release(player, k, id, n)) });
  }
  B.push({ text: "Voltar", run: back });
  menu(player, "§l§5" + nameOf(id).toUpperCase(), k === "mobs" ? analysisLines(d, id).join("\n") + `\n\n§7No estômago: §f${n}§7 · Digeridas: §f${stom(d).digested[id] ?? 0}/${EXTRACT_NEED[MOBS[id]?.rar] ?? 5}` : `§7Quantidade: §f${n}\n§7Id: §8${id}`, B);
}
function openSkills(player, back) {
  const d = getData(player), L = [];
  for (const [id, x] of Object.entries(d.predSkills ?? {})) L.push(`§d${SKILLS[id]?.name ?? id} §7← processamento de ${nameOf(x.from)}`);
  for (const [id, x] of Object.entries(d.absorbed ?? {})) L.push(`§d${SKILLS[id]?.name ?? id} §7← golpe absorvido de ${x.from}`);
  for (const id of ["goblin_cunning", "beast_instinct", "demon_flame", "war_cry", "piercing_shot", "barrier"]) if (hasSkill(d, id) && !(d.predSkills ?? {})[id]) L.push(`§8${SKILLS[id]?.name ?? id} §7(possuída; Mimetismo pode tê-la concedido)`);
  menu(player, "§l§5HABILIDADES DO PREDADOR", L.length ? L.join("\n") : "§7Nenhuma habilidade obtida pelo Predador ainda.\n§8Analise criaturas no Estômago e processe-as para extrair habilidades.", [{ text: "Voltar", run: back }]);
}
function openLog(player, back) {
  const s = stom(getData(player)), K = { mobs: "§5devorou", items: "§5engoliu", blocks: "§5consumiu", "-mobs": "§7processou", "-items": "§7liberou", "-blocks": "§7liberou" };
  const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "agora" : m < 60 ? `${m} min` : `${Math.round(m / 60)} h`; };
  menu(player, "§l§5HISTÓRICO", s.log.slice().reverse().slice(0, 25).map((x) => `${K[x.k] ?? x.k} §f${nameOf(x.id)} x${x.n} §8${ago(x.t)}`).join("\n") || "§7Sem registros.", [{ text: "Voltar", run: back }]);
}

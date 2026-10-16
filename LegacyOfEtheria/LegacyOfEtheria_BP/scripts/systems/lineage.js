// systems/lineage.js - LINHAGENS DRACÔNICAS da raça Dragonoide (dados em data/lineages.js; visual em tools/racepart.py LINEAGE_PARTS).
// Escolha da linhagem -> bônus de atributos/resistências + árvore de habilidades própria (concedida por nível/estágio) + formas
// (Dragonoide -> Forma Dracônica -> Dragão Verdadeiro) + aparência no corpo (propriedades etheria:lin e etheria:lform) + reação de personagens.
// Limitação do Bedrock: o tamanho/hitbox do jogador não muda; a forma é visual (modelo maior, asas, focinho, espinhos, aura) + bônus e efeitos.
import { world, system } from "@minecraft/server";
import { getData, saveNow, markDirty } from "../core/db.js";
import { say, toast, playSound } from "../core/utils.js";
import { LINEAGES, LINEAGE_FORMS, LINEAGE_RACE, lineageLock, tierState, formLock } from "../data/lineages.js";
import { RELATIONS, lineageOf, formOfPlayer, lineageStats } from "../data/lineages.js";
import { grantSkill, registerExec } from "./skills.js";
import { applyDerivedStats, dropStats } from "./stats.js";
import { fx, ring } from "./fx.js";
import { applyRaceLook, playTransform } from "./raceparts.js";
import { playCinematic } from "./cinematic.js";
import { refreshName } from "./race.js";
import { sageText } from "./voice.js";
import { playAnim } from "../core/anim.js";
import { ctx, column, ringFlat, burst, T } from "./fxlib.js";

export { lineageOf, formOfPlayer, lineageStats };

/** Concede as habilidades da árvore que o nível/estágio já liberam. Devolve as novas. */
export function syncLineage(player, quiet = false) {
  const d = getData(player), L = lineageOf(d); if (!L) return [];
  const got = [];
  for (const t of tierState(d, L)) if (t.ok && !d.unlockedSkills.includes(t.skill)) { grantSkill(player, t.skill); got.push(t.skill); }
  if (got.length && !quiet) { toast(player, `${L.color}§l${L.name}`, "§7Nova habilidade da linhagem!"); }
  return got;
}

export function chooseLineage(player, id) {
  const d = getData(player), L = LINEAGES[id];
  if (!L) return { ok: false, msg: "Linhagem inválida." };
  const why = lineageLock(d, L); if (why) return { ok: false, msg: why };
  if (d.lineage === id) return { ok: false, msg: "Você já segue esta linhagem." };
  const cost = d.lineage ? 10000 : 0;   // trocar custa moedas (a primeira escolha é gratuita)
  if (d.coins < cost) return { ok: false, msg: `Mudar de linhagem custa ${cost} moedas.` };
  d.coins -= cost; d.lineage = id; d.lform = "base"; d.lcool = 0;
  markDirty(player); syncLineage(player, true);
  const got = d.unlockedSkills.filter((s) => L.tiers.some((t) => t.skill === s));
  dropStats(player.id); applyDerivedStats(player); refreshName(player); try { applyRaceLook(player); } catch { /* ignore */ }
  saveNow(player);
  toast(player, `${L.color}§l${L.name}`, `§7${L.title}`); playSound(player, "mob.enderdragon.growl", 0.6, 1.3);
  fx(player.dimension, player.location, "transform", player, 2); ring(player.dimension, player.location, 2, L.fxKey, player);
  say(player, `${L.color}§l[Linhagem] §r§fVocê agora segue a linhagem de §l${L.name}§r§f (${L.title}). Habilidades liberadas: ${got.length}.`);
  return { ok: true, msg: `Linhagem ${L.name} escolhida!` };
}

// 6.68: SURGIMENTO DO DRAGÃO (sequência de transformação): o dragão nasce pequeno girando, cresce, ABRE AS ASAS e RUGE
// (RP animation.etheria_pdrg.emerge, tocada por script -> reinicia em toda transformação), com coluna de energia e anéis da linhagem.
const LCOL = { veldora: ["bolt", "ice"], velzard: ["ice", "frost"], velgrynd: ["fire", "ember"], veldanava: ["gold", "light"] };
function dragonEmerge(player, L, form) {
  try { playAnim(player, "animation.etheria_pdrg.emerge", { channel: "etheria_drg", blendOut: 0.3 }); } catch { /* ignore */ }
  const [c1, c2] = LCOL[L.id] ?? ["arcane", "mana"], big = form === "true";
  try {
    const c = ctx(player, 1), at = player.location;
    column(c, at, { col: c1, tile: T.spark, n: big ? 40 : 26, h: big ? 14 : 9, life: 1.0, r: 1.6, size: 0.22 });
    for (let i = 0; i < (big ? 4 : 3); i++) system.runTimeout(() => { try { ringFlat(ctx(player, 1), { x: at.x, y: at.y + 0.2 + i * 1.2, z: at.z }, { col: i % 2 ? c2 : c1, tile: T.ring, n: 26, radius: 3 + i * 1.6, life: 0.6, size: 0.24 }); } catch { /* ignore */ } }, 6 + i * 4);
    system.runTimeout(() => { try { burst(ctx(player, 1), { x: at.x, y: at.y + 3, z: at.z }, { col: c2, tile: T.star, n: big ? 30 : 18, spd: 6, life: 0.7, size: 0.2 }); } catch { /* ignore */ } }, 18);
  } catch { /* ignore */ }
  system.runTimeout(() => { try { if (player.isValid) playSound(player, "mob.enderdragon.growl", 1.2, big ? 0.55 : 0.8); } catch { /* ignore */ } }, 20);   // rugido junto com a boca abrindo
}
/** Alterna a forma. Sobe para a forma pedida ou volta ao Dragonoide. */
export function setForm(player, form) {
  const d = getData(player), L = lineageOf(d); if (!L) return { ok: false, msg: "Escolha uma linhagem primeiro." };
  if (form === "base" || form === d.lform) { if (d.lform !== "base") return endForm(player, true); return { ok: false, msg: "Você já está nessa forma." }; }
  const why = formLock(d, L, form); if (why) return { ok: false, msg: why };
  const F = LINEAGE_FORMS[form], now = Date.now();
  if ((d.lcool ?? 0) > now) return { ok: false, msg: `Aguarde ${Math.ceil((d.lcool - now) / 1000)}s para transformar de novo.` };
  if (d.mana < 20) return { ok: false, msg: "Mana insuficiente (20)." };
  if (!roomFor(player, form)) return { ok: false, msg: "Espaço insuficiente: o dragão não cabe aqui. Vá para um lugar aberto." };
  d.mana -= 20; d.lform = form; markDirty(player);
  d.world ??= {}; d.world.flags ??= {}; d.world.flags.used_form = 1;   // 6.54: conquista "Transformação"
  const kind = form === "true" ? "true" : "dragon";
  dropStats(player.id); applyDerivedStats(player);
  const cine = playCinematic(player, { kind, tier: kind === "true" ? "supreme" : "power", change: () => { try { applyRaceLook(player); } catch { /* ignore */ } dragonEmerge(player, L, form); } });
  if (!cine) { playTransform(player, kind); try { applyRaceLook(player); } catch { /* ignore */ } dragonEmerge(player, L, form); }   // sem cinemática: o dragão surge na hora
  const dim = player.dimension, loc = player.location;
  toast(player, `${L.color}§l${F.name}`, `§7Linhagem de ${L.name}`); playSound(player, "mob.enderdragon.growl", 1, form === "true" ? 0.6 : 0.9);
  for (let i = 0; i < F.fx + 1; i++) system.runTimeout(() => { try { ring(dim, player.location, 1.5 + i * 1.5, L.fxKey, player); fx(dim, player.location, L.fx2, player, 2); } catch { /* ignore */ } }, i * 6);
  fx(dim, loc, "transform", player, 2);
  say(player, `${L.color}§l[Linhagem] §r§fVocê assume a §l${F.name}§r§f! Gasta ${F.drain} de mana por segundo. Use o Relógio > Raça > Linhagem para voltar.`);
  return { ok: true, msg: `${F.name} ativada!` };
}
// 6.52: o dragão tem colisão maior (BP player.json, eventos etheria:form_*). Antes de crescer, confere se há espaço livre
// (sem blocos sólidos) no volume da nova forma — evita o jogador ficar preso/sufocado dentro de paredes ou tetos.
const FORM_BOX = { draconic: [1.2, 2.6], true: [1.6, 3.4] };
const SOFT = /grass|fern|flower|sapling|torch|snow_layer|vine|carpet|rail|button|sign|lever|mushroom|dead_bush|wheat|carrots|potatoes|beetroot|sugar_cane|kelp|seagrass|cobweb|tripwire|redstone_wire|pressure_plate|banner|lantern|ladder|leaves|azalea|dripleaf|moss_carpet|tulip|daisy|orchid|allium|bluet|poppy|dandelion|cornflower|lily|rose|peony|lilac|sweet_berry/;
const blocks = (b) => { if (b.isAir || b.isLiquid) return false; if (typeof b.isSolid === "boolean") return b.isSolid; return !SOFT.test(b.typeId); };
export function roomFor(player, form) {
  const box = FORM_BOX[form]; if (!box) return true;
  const [w, h] = box, l = player.location, dim = player.dimension, r = w / 2;
  for (let y = 0; y < Math.ceil(h); y++) for (const dx of [-r, 0, r]) for (const dz of [-r, 0, r]) {
    try { const b = dim.getBlock({ x: Math.floor(l.x + dx), y: Math.floor(l.y + 0.1 + y), z: Math.floor(l.z + dz) }); if (b && blocks(b)) return false; } catch { /* fora do mundo carregado: ignora */ }
  }
  return true;
}
export function endForm(player, manual = false) {
  const d = getData(player), L = lineageOf(d); if (!L || d.lform === "base") return { ok: false, msg: "Já está na forma base." };
  const F = LINEAGE_FORMS[d.lform]; d.lform = "base"; d.lcool = Date.now() + (F.cool ?? 20) * 1000; markDirty(player);
  dropStats(player.id); applyDerivedStats(player); try { applyRaceLook(player); } catch { /* ignore */ }
  for (const e of ["strength", "speed", "resistance", "regeneration", "fire_resistance"]) { try { player.removeEffect(e); } catch { /* ignore */ } }
  toast(player, `${L.color}§l${LINEAGE_FORMS.base.name}`, manual ? "§7Você voltou à forma base." : "§cMana esgotada: a forma se desfez.");
  fx(player.dimension, player.location, "transform", player, 1);
  return { ok: true, msg: "Forma base." };
}

export function startLineage() {
  // laço leve (1 s): drena mana na forma, mantém efeitos e solta a aura (poucas partículas)
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        const d = getData(p), L = lineageOf(d); if (!L) continue;
        const form = formOfPlayer(d);
        if (form === "base") continue;
        const F = LINEAGE_FORMS[form];
        d.mana = Math.max(0, d.mana - F.drain); markDirty(p);
        if (d.mana <= 0) { endForm(p); continue; }
        for (const [id, amp] of L.effects?.[form] ?? []) p.addEffect(id, 60, { amplifier: amp, showParticles: false });
        const l = p.location;
        fx(p.dimension, { x: l.x, y: l.y + 1.0, z: l.z }, L.fxKey, p, 1);
        if (form === "true") fx(p.dimension, { x: l.x, y: l.y + 2.0, z: l.z }, L.fx2, p, 1);
      } catch { /* ignore */ }
    }
  }, 20);
  // 6.52: morrer desfaz a forma (volta ao Dragonoide; a colisão volta ao normal antes do renascimento)
  try {
    world.afterEvents.entityDie.subscribe((ev) => {
      try {
        const p = ev.deadEntity; if (p?.typeId !== "minecraft:player") return;
        const d = getData(p); if (!d.lform || d.lform === "base") return;
        d.lform = "base"; markDirty(p); dropStats(p.id);
        try { applyRaceLook(p); } catch { /* ignore */ }
      } catch { /* ignore */ }
    });
  } catch { /* evento indisponível */ }
  // sincroniza a árvore a cada 5 s (nível/estágio mudam por vários caminhos)
  system.runInterval(() => { for (const p of world.getAllPlayers()) { try { syncLineage(p); } catch { /* ignore */ } } }, 100);
  // personagens reconhecem a linhagem ao serem interagidos (mensagem com recarga por jogador e personagem)
  const seen = new Map();
  try {
    world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
      try {
        const rel = RELATIONS[ev.target?.typeId]; if (!rel) return;
        const d = getData(ev.player), L = lineageOf(d), key = ev.player.id + ev.target.typeId, now = Date.now();
        if ((seen.get(key) ?? 0) > now) return; seen.set(key, now + 8000);
        if (seen.size > 400) seen.clear();
        const line = (L && rel[L.id]) ?? rel.default; if (line) say(ev.player, line);
        if (L && rel[L.id] && ev.target.typeId === L.mob) { ev.player.addEffect("regeneration", 200, { amplifier: 0, showParticles: false }); }
      } catch { /* ignore */ }
    });
  } catch { /* evento indisponível */ }
}

// ---------------------------------------------------------------- Transformação Dracônica (habilidade "dragon_transform")
// Habilidade real na barra de skills: liga/desliga a forma de Dragão da linhagem (Forma Dracônica; Dragão Verdadeiro no nível 90).
// Concedida pelas formas finais da linha Dragonoide (data/races.js: dragonoid_3a / dragonoid_3b). A raça original não muda.
const greet = (player, msg, delay) => system.runTimeout(() => { try { sageText(player, msg, { pri: 4 }); } catch { /* ignore */ } }, delay);   // 6.38: fala do Sábio (fila + indicador)
registerExec("dracform", (player, sk, s, d) => {
  const L = lineageOf(d);
  if (!L) return "Escolha sua linhagem dracônica primeiro (Relógio > Raça).";
  if (d.lform && d.lform !== "base") { const r = endForm(player, true); return r.ok ? true : r.msg; }
  const form = d.level >= LINEAGE_FORMS.true.lvl ? "true" : "draconic";
  const r = setForm(player, form);
  if (!r.ok) return r.msg;
  // rugido e falas do Grande Sábio na ativação (sequência cinematográfica curta)
  try { playSound(player, "mob.enderdragon.growl", 1, form === "true" ? 0.7 : 0.9); } catch { /* ignore */ }
  if (form === "true") {
    greet(player, "§fTransformação detectada.", 10);
    greet(player, "§fForma superior ativada.", 40);
  } else greet(player, "§fTransformação detectada.", 10);
  return true;
});


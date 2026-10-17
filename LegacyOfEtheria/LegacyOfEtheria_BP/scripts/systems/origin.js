import { sageText } from "./voice.js";
// systems/origin.js - SALA DE ORIGEM: o primeiro spawn de um jogador novo leva-o a uma sala fechada (construída uma vez, com fill em pequenos lotes),
// onde um NPC de cada região oferece o ponto de partida. A escolha teleporta o jogador, registra a origem e segue para a escolha de raça.
// Configuração: data/origins.js (SPAWN_ORIGINS). Não substitui a raça, a classe nem as viagens: só define onde a jornada começa.
import { world, system } from "@minecraft/server";
import { getData, markDirty, saveNow } from "../core/db.js";
import { say, playSound } from "../core/utils.js";
import { ORIGIN_ROOM as R, SPAWN_ORIGINS, ORIGIN_LIST, REGION_CITIES } from "../data/origins.js";
import { fx, ring } from "./fx.js";
import { __test as settle, ensureSettlement } from "./settlements.js";
import { ensureTempest, ensureTempestCore, setTempestWorldSpawn, tempestBackground, tempestHasSite, locateTempestLazy } from "./tempest.js";
import { locationOfPlace, markVisited, announceLocation } from "./travel.js";
import { SETTLEMENT_LIST } from "../data/factions.js";
import { menu } from "./ui/forms.js";
import { openRacePick } from "./ui/menus.js";

const PER_TICK = 8;
const dim = () => world.getDimension("minecraft:overworld");
const runC = (D, c) => { try { const r = D.runCommand(c); return (r?.successCount ?? 1) > 0; } catch { return false; } };
const sage = (p, m) => { try { sageText(p, `§f${m}`); } catch { /* ignore */ } };
let building = false;

// ------------------------------------------------------------ sala (puro: testável sem o jogo)
/** Posição (x, z) do NPC de índice i entre n, em anel ao redor do centro da sala. */
export function npcSpot(i, n) {
  const a = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
  return [Math.round(R.ring * Math.cos(a)), Math.round(R.ring * Math.sin(a))];
}
/** Assinatura da sala: muda quando a lista de origens muda, e então a sala é reconstruída. */
export const roomSignature = () => "v1:" + ORIGIN_LIST.map((o) => o.id).join("|");
/** Ops de construção relativas ao piso central da sala (y = 0 é o piso). */
export function roomPlan() {
  const h = R.half, H = 7, ops = [], P = (a, b, blk) => ops.push({ a, b, blk });
  P([-h, 0, -h], [h, H, h], "air");                                                  // limpa o volume
  P([-h, 0, -h], [h, 0, h], "polished_blackstone_bricks");                           // piso
  P([-h, H, -h], [h, H, h], "polished_blackstone");                                  // teto
  P([-h, 1, -h], [-h, H - 1, h], "deepslate_tiles"); P([h, 1, -h], [h, H - 1, h], "deepslate_tiles");   // paredes laterais
  P([-h + 1, 1, -h], [h - 1, H - 1, -h], "deepslate_tiles"); P([-h + 1, 1, h], [h - 1, H - 1, h], "deepslate_tiles");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P([sx * (h - 1), 1, sz * (h - 1)], [sx * (h - 1), H - 1, sz * (h - 1)], "gilded_blackstone");   // pilares dourados
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P([sx * 6, H - 1, sz * 6], [sx * 6, H - 1, sz * 6], "glowstone");                        // luzes do teto
  P([-1, 0, -1], [1, 0, 1], "amethyst_block"); P([0, 1, 0], [0, 1, 0], "sea_lantern");                                                       // pedestal central
  ORIGIN_LIST.forEach((o, i) => { const [x, z] = npcSpot(i, ORIGIN_LIST.length); P([x - 1, 0, z - 1], [x + 1, 0, z + 1], "sea_lantern"); });      // pastilha de cada NPC
  return ops;
}
/** Garante que a cidade da origem existe e está construída; cb({x,y,z}) ou cb(null). Nunca devolve uma posição vazia. */
export function ensureRegion(o, cb, progress = null) {
  const place = o.place ?? "";
  if (place === "tempest") return ensureTempest(cb, 0, progress);
  const [kind, id] = place.split(":");
  if (kind === "settlement") { const def = SETTLEMENT_LIST.find((d) => d.id === id); return def ? ensureSettlement(def, cb) : cb(null); }
  if (kind === "city") { const def = REGION_CITIES[id]; return def ? ensureSettlement(def, cb) : cb(null); }
  return cb(null);
}

// ------------------------------------------------------------ construção (lotes por tick, como as vilas)
export function ensureRoom(done) {
  const sig = roomSignature();
  let have; try { have = world.getDynamicProperty(R.kv); } catch { have = undefined; }
  if (have === sig) return done(true);
  if (building) return done(false);
  building = true;
  const D = dim(), cmds = settle.expand(roomPlan(), { x: R.x, y: R.y, z: R.z });
  runC(D, `tickingarea remove ${R.tag}_build`); runC(D, `tickingarea add circle ${R.x} ${R.y} ${R.z} 3 ${R.tag}_build`);
  let t = 0;
  const wait = system.runInterval(() => {
    t += 5;
    let loaded = false; try { loaded = !!D.getBlock({ x: R.x, y: R.y, z: R.z }); } catch { /* ignore */ }
    if (!loaded && t < 200) return;
    system.clearRun(wait);
    if (!loaded) { building = false; return done(false); }
    let i = 0, fails = 0;
    const h = system.runInterval(() => {
      let n = 0;
      while (n < PER_TICK && i < cmds.length) {
        if (runC(D, cmds[i])) { i++; fails = 0; } else { fails++; if (fails > 40) { i++; fails = 0; } else break; }
        n++;
      }
      if (i >= cmds.length) {
        system.clearRun(h);
        try { world.setDynamicProperty(R.kv, sig); } catch { /* ignore */ }
        building = false; spawnOriginNpcs(); done(true);
      }
    }, 1);
  }, 5);
}

// ------------------------------------------------------------ NPCs de sistema (protegidos: não morrem, não somem, não duplicam)
const tagOf = (o) => R.tag + "_" + o.id;
export function spawnOriginNpcs() {
  let D; try { D = dim(); } catch { return; }
  ORIGIN_LIST.forEach((o, i) => {
    const [x, z] = npcSpot(i, ORIGIN_LIST.length), tag = tagOf(o);
    let ents = []; try { ents = D.getEntities({ tags: [tag], location: { x: R.x, y: R.y, z: R.z }, maxDistance: R.ring + 12 }); } catch { /* ignore */ }
    if (ents.length) { for (const e of ents) { try { e.nameTag = `§6${o.npcName}`; e.getComponent("minecraft:health")?.resetToMaxValue(); } catch { /* ignore */ } } return; }
    try {
      const e = D.spawnEntity(o.npc, { x: R.x + x + 0.5, y: R.y + 1, z: R.z + z + 0.5 });
      e.addTag(R.tag); e.addTag(tag); e.nameTag = `§6${o.npcName}`;
    } catch { /* tenta de novo no próximo ciclo */ }
  });
}
/** Devolve o id da origem de um NPC da sala (ou null se não for NPC de origem). */
export const originOf = (entity) => { try { if (!entity?.hasTag?.(R.tag)) return null; return entity.getTags().find((t) => t.startsWith(R.tag + "_"))?.slice(R.tag.length + 1) ?? null; } catch { return null; } };

// ------------------------------------------------------------ escolha
/** Chamado pelo evento de interação com NPC: true se o NPC pertence à sala de origem (então ele trata a interação). */
export function originInteract(player, entity) {
  if (!entity?.hasTag?.(R.tag)) return false;
  const o = SPAWN_ORIGINS[originOf(entity)];
  if (o) system.run(() => openOrigin(player, o));
  return true;
}
function openOrigin(player, o) {
  const d = getData(player);
  try { player.playSound("random.orb", { volume: 0.5, pitch: 1.2 }); } catch { /* ignore */ }
  if (d.origin) {
    const was = SPAWN_ORIGINS[d.origin];
    menu(player, `§6§l${o.name}`, `§e${o.npcName}§f: "Você já começou sua jornada${was ? " em §l" + was.name + "§r§f" : ""}. Você pode viajar pelo mundo quando quiser."`, [{ text: "§7Fechar" }]);
    return;
  }
  menu(player, `§6§l${o.name}`, `§e${o.npcName}§f:\n§f"${o.ask}"\n\n§7${o.desc}`, [
    { text: `§a§l[ NASCER AQUI ]\n§r§7Começar a jornada em ${o.name}`, run: () => beginBirth(player, o) },
    { text: "§7Ainda não decidi", run: () => say(player, "§7Volte quando estiver pronto. A sala continua aqui.") },
  ]);
}
/** Sequência da escolha: confirmação -> garantia da cidade -> energia -> teleporte -> registro -> Grande Sábio -> escolha de raça. */
export function beginBirth(player, o, auto = false, tries = 0) {
  const d = getData(player); if (d.origin) return;
  const pid = player.id;
  if (auto) {
    sage(player, `Você está nascendo em ${o.name}.`);
    // proteção enquanto a cidade é colocada (poucos segundos): sem dano e sem queda
    try { player.addEffect("resistance", 600, { amplifier: 4, showParticles: false }); player.addEffect("slow_falling", 600, { amplifier: 0, showParticles: false }); } catch { /* ignore */ }
  } else {
    sage(player, "Origem selecionada.");
    try { playSound(player, "random.levelup", 0.8, 0.9); } catch { /* ignore */ }
    sage(player, `Preparando ${o.name}...`);
  }
  // progresso visível: a construção pode levar alguns minutos e o jogador precisa saber que está andando
  let done = false, last = -1;
  const progress = (i, total) => {
    const p = world.getAllPlayers().find((x) => x.id === pid); if (!p || done) return;
    if (i < 0) return sage(p, `Procurando terreno para ${o.name}...`);
    if (i - last >= 8) { last = i; sage(p, `Construindo ${o.name}: ${i}/${total} partes.`); }
  };
  const watch = () => system.runTimeout(() => {
    if (done) return;
    const p = world.getAllPlayers().find((x) => x.id === pid); if (p) sage(p, `${o.name} ainda está sendo preparada. Não se afaste, isso leva só alguns instantes.`);
    watch();
  }, 1200);
  watch();
  ensureRegion(o, (pos) => {
    done = true;
    const p = world.getAllPlayers().find((x) => x.id === pid);
    if (!p || getData(p).origin) return;
    if (!pos) {
      if (auto && tries < 4) { tries++; sage(p, `${o.name} ainda está sendo preparada. Tentando de novo...`); system.runTimeout(() => { const r = world.getAllPlayers().find((x) => x.id === pid); if (r && !getData(r).origin) beginBirth(r, o, true, tries); }, 100); return; }
      sage(p, `${o.name} ainda não pôde ser construída. Sua escolha não foi registrada: tente de novo em instantes.`); return;
    }
    try { for (let k = 0; k < 3; k++) ring(p.dimension, p.location, 1 + k, "light", p); fx(p.dimension, p.location, "arcane", p, 2); } catch { /* ignore */ }
    system.runTimeout(() => {
      const q = world.getAllPlayers().find((x) => x.id === pid); if (!q || getData(q).origin) return;
      try { fx(q.dimension, q.location, "transform", q, 2); } catch { /* ignore */ }
      try { q.teleport({ x: pos.x, y: pos.y, z: pos.z }, { dimension: dim(), rotation: { x: 0, y: pos.yaw ?? 0 } }); } catch (e) { console.warn(`[Etheria] teleporte da origem: ${e}`); sage(q, "Não consegui te levar até lá. Tente de novo."); return; }
      const cur = getData(q); cur.origin = o.id; markDirty(q);
      try { const lid = locationOfPlace(o.place); if (lid) { markVisited(q, lid); announceLocation(q, lid); } } catch { /* ignore */ }
      saveNow(q);
      if (!auto) { sage(q, "Origem registrada."); system.runTimeout(() => { if (q.isValid) sage(q, "Destino definido."); }, 20); }
      try { q.removeEffect("slow_falling"); } catch { /* ignore */ }
      system.runTimeout(() => { if (!q.isValid) return; try { q.removeEffect("resistance"); } catch { /* ignore */ } sage(q, auto ? `Bem-vindo a ${o.name}. Boa sorte em sua jornada.` : "Boa sorte em sua jornada."); if (!getData(q).raceChosen) openRacePick(q); }, auto ? 30 : 44);
    }, auto ? 4 : 30);
  }, progress);
}

// ------------------------------------------------------------ primeiro spawn
function enterRoom(p) {
  ensureRoom((ok) => {
    if (!ok || !p.isValid || getData(p).origin) return;
    try { p.teleport({ x: R.x + 0.5, y: R.y + 1, z: R.z + 0.5 }, { dimension: dim() }); } catch { return; }
    try { fx(p.dimension, p.location, "arcane", p, 2); playSound(p, "mob.enderdragon.growl", 0.4, 1.6); } catch { /* ignore */ }
    sage(p, "Área de nascimento detectada.");
    system.runTimeout(() => { if (p.isValid) sage(p, "Por favor, selecione sua origem."); }, 40);
  });
}
// ------------------------------------------------------------ 6.36: nascimento direto em Tempest (sem sala, sem NPC, sem botão, sem comando)
/** Jogador novo: a cidade é colocada em volta dele (núcleo primeiro), ele é levado ao ponto seguro e o spawn do mundo passa a ser a entrada. */
export function birthInTempest(p, tries = 0) {
  if (!p?.isValid || getData(p).origin) return;
  const pid = p.id;
  try {
    p.addEffect("resistance", 400, { amplifier: 4, showParticles: false });
    p.addEffect("slow_falling", 400, { amplifier: 0, showParticles: false });
    if (tries === 0) p.runCommand("camera @s fade time 0.2 1.6 0.8 color 6 10 22");
  } catch { /* ignore */ }
  ensureTempestCore(p, (sp) => {
    const q = world.getAllPlayers().find((x) => x.id === pid);
    if (!q || getData(q).origin) return;
    if (!sp) {
      if (tries < 6) return void system.runTimeout(() => birthInTempest(q, tries + 1), 60);
      console.warn("[Etheria] nascimento em Tempest: o núcleo da cidade não ficou pronto");
      return;
    }
    try { q.teleport({ x: sp.x, y: sp.y, z: sp.z }, { dimension: dim(), rotation: { x: 0, y: sp.yaw ?? 0 }, keepVelocity: false }); }
    catch (e) { console.warn(`[Etheria] teleporte de nascimento: ${e}`); if (tries < 6) system.runTimeout(() => birthInTempest(q, tries + 1), 40); return; }
    setTempestWorldSpawn(sp);
    try { q.setSpawnPoint({ x: Math.floor(sp.x), y: Math.floor(sp.y), z: Math.floor(sp.z), dimension: dim() }); } catch { /* ignore */ }
    const cur = getData(q); cur.origin = "tempest"; markDirty(q); saveNow(q);
    try { q.removeEffect("slow_falling"); } catch { /* ignore */ }
    system.runTimeout(() => {
      if (!q.isValid) return;
      try { q.removeEffect("resistance"); } catch { /* ignore */ }
      try { markVisited(q, "tempest"); announceLocation(q, "tempest"); } catch { /* ignore */ }
    }, 30);
    if (!getData(q).raceChosen) system.runTimeout(() => { if (q.isValid && !getData(q).raceChosen) openRacePick(q); }, 140);
    // o restante da cidade (55 ladrilhos) sai em segundo plano, sem mensagens
    system.runTimeout(() => tempestBackground(), 100);
  });
}
export function startOrigin() {
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    const p = ev.player;
    system.runTimeout(() => {
      try {
        if (!p.isValid) return;
        const d = getData(p);
        if (d.origin) return;   // já nasceu: reentrar/morrer não reconstrói nem teleporta
        // jogadores antigos (já têm raça ou progresso) ficam onde estão: origem "legacy"; Tempest é gerada longe da base deles
        if (d.raceChosen || d.level > 1) { d.origin = "legacy"; markDirty(p); if (!tempestHasSite()) locateTempestLazy(); return; }
        // 7.1: não nasce mais em Tempest (gerar a cidade no início causava lag). Nasce no spawn normal; a cidade fica num ponto
        // aleatório do mapa (700-1300 blocos) e é construída aos poucos quando alguém chega perto. !tempest mostra a rota.
        d.origin = "wild"; markDirty(p); saveNow(p);
        if (!tempestHasSite()) system.runTimeout(locateTempestLazy, 200);
        if (!d.raceChosen) system.runTimeout(() => { if (p.isValid && !getData(p).raceChosen) openRacePick(p); }, 100);
        system.runTimeout(() => { if (p.isValid) say(p, "§6[Etheria] §fA §eCidade de Tempest§f existe em algum lugar deste mundo. Use §e!tempest§f para ver a direção, ou explore até encontrá-la."); }, 400);
      } catch (e) { console.warn(`[Etheria] nascimento: ${e}`); }
    }, 20);
  });
  // NPCs de sistema: o dano é desfeito (não morrem) e a sala é mantida com todos os NPCs
  try {
    world.afterEvents.entityHurt.subscribe((ev) => {
      const e = ev.hurtEntity; if (!e?.hasTag?.(R.tag)) return;
      try { e.getComponent("minecraft:health")?.resetToMaxValue(); } catch { /* ignore */ }
    });
  } catch { /* evento indisponível */ }
  system.runInterval(() => {
    if (building) return;
    const near = world.getAllPlayers().some((p) => { const l = p.location; return p.dimension.id === "minecraft:overworld" && Math.abs(l.y - R.y) < 40 && Math.abs(l.x - R.x) < 40 && Math.abs(l.z - R.z) < 40; });
    if (near) { try { if (world.getDynamicProperty(R.kv) === roomSignature()) spawnOriginNpcs(); } catch { /* ignore */ } }
  }, 200);
}

export const __test = { npcSpot, roomPlan, roomSignature };

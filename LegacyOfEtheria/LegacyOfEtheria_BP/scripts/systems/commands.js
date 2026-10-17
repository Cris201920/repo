// systems/commands.js - Comandos de chat. Jogadores: !menu !skills !cast N !quests !help.  Admin (tag etheria_admin): !xp !level !coins !sp !give !boss !npc !reset !stats
import { world, system, ItemStack } from "@minecraft/server";
import { ADMIN_TAG, MAX_LEVEL, MAX_SLOTS } from "../config.js";
import { createDefaultData } from "../core/db.js";
import { getData, saveNow, markDirty } from "../core/db.js";
import { addXp } from "./level.js";
import { applyDerivedStats, getStats } from "./stats.js";
import { openMain, openStatus, openSkills, openQuests, openQuickCast, openLordDemon } from "./ui/menus.js";
import { castSlot } from "./skills.js";
import { openHotbar } from "./skillbar/ui.js";
import { reconcile } from "./skillbar/sync.js";
import { skillbarMetrics } from "./skillbar/index.js";
import { ITEMS } from "../data/items.gen.js";
import { BOSSES } from "../data/bosses.js";
import { ensureLore } from "./items.js";
import { refreshName } from "./race.js";
import { applyRaceLook } from "./raceparts.js";
import { say, giveItem, inventory } from "../core/utils.js";
import { spawnNear, STRUCT_IDS } from "./structures.js";
import { octCmd } from "./octagrama.js";
import { realmCmd } from "./realms.js";
import { toggleFlight } from "./flight.js";
import { openPowers } from "./powers.js";
import { openCreator } from "./creator.js";
import { WGEN, wgKeys, placeWgen, verifyWgen } from "./worldgen.js";
import { NPC_NAMES } from "./npcs.js";
import { tempestCmd } from "./tempest.js";
import { settlementsCmd } from "./settlements.js";
import { openWorld } from "./worldnpc.js";
import { warCmd } from "./worldwar.js";
import { bossCmd, openSummonAltar } from "./bossspawn.js";
import { coreCmd } from "./charybdis.js";
import { toggleForm, FORMS } from "./truedragon.js";
import { placeArena, anchorFromPlayer, keyOfBoss, arenaKeys, verifyAll, ARENAS, results as arenaResults } from "./arenas.js";
import { pvpOn, setPvp, teamOf, setTeam } from "./combat.js";
import { structCmd } from "./structcmd.js";
import { canBuild, canSpawnStructures, CREATIVE_ONLY } from "../core/perm.js";

export function registerCommands() {
  // O evento de chat só existe em beta no @minecraft/server 1.17.0: detectar antes de assinar.
  const chatSig = world.beforeEvents?.chatSend;
  if (chatSig && typeof chatSig.subscribe === "function") {
    chatSig.subscribe((ev) => {
      const msg = ev.message.trim();
      if (!msg.startsWith("!")) return;
      ev.cancel = true;
      const p = ev.sender;
      const [cmd, ...args] = msg.slice(1).split(/\s+/);
      system.run(() => run(p, cmd.toLowerCase(), args));
    });
  }
  // Rota estável (todas as versões): /scriptevent etheria:cmd <comando> [args]   ex.: /scriptevent etheria:cmd cast 2
  try {
    system.afterEvents.scriptEventReceive.subscribe((ev) => {
      if (ev.id !== "etheria:cmd") return;
      const p = ev.sourceEntity; if (!p || p.typeId !== "minecraft:player") return;
      const [cmd, ...args] = (ev.message ?? "").trim().replace(/^!/, "").split(/\s+/);
      if (cmd) run(p, cmd.toLowerCase(), args, true);
    });
  } catch (e) { console.warn(`[Etheria] scriptevent indisponível: ${e}`); }
}

function run(p, cmd, args, trusted = false) {
  switch (cmd) {
    case "poderes": case "powers": case "arvore": return openPowers(p, () => openSkills(p));
    case "criar": case "criador": case "creator": return openCreator(p, () => openSkills(p));
    case "voo": case "flight": case "fly": return say(p, toggleFlight(p).msg);
    case "menu": return openMain(p);
    case "lord": case "lorddemonio": return openLordDemon(p);
    case "status": return openStatus(p);
    case "skills": case "habilidades": return openSkills(p);
    case "quests": case "missoes": return openQuests(p);
    case "hotbar": return openHotbar(p, () => openSkills(p));
    case "sync": { const r = reconcile(p, "comando", { force: true }); return say(p, r ? `§aHotbar conferida: ${r.created.length} criado(s), ${r.removed.length} removido(s).` : "§7Nada a conferir agora."); }
    case "cast": case "c": {
      const n = parseInt(args[0]);
      if (!(n >= 1 && n <= MAX_SLOTS)) return openQuickCast(p);
      const r = castSlot(p, n - 1); if (!r.ok && !r.quiet) say(p, `§c${r.msg}`); return;
    }
    case "tempest": case "cidade": return tempestCmd(p, args);
    case "aldeia": case "territorios": return settlementsCmd(p, args);
    case "guerra": return warCmd(p, args);
    case "mundo": case "reputacao": return openWorld(p);
    case "invocar": case "altar": return openSummonAltar(p);   // 6.99: Altar de Invocação
    case "boss": return bossCmd(p, args);
    case "nucleo": return coreCmd(p);
    case "pvp": {
      const a = (args[0] ?? "status").toLowerCase();
      if (a === "on" || a === "off") { if (!p.hasTag(ADMIN_TAG)) return say(p, "§cSó administradores ligam/desligam o PvP."); setPvp(a === "on"); for (const q of world.getAllPlayers()) say(q, `§6[Etheria] §7PvP ${a === "on" ? "§cLIGADO§7: habilidades e golpes atingem outros jogadores" : "§aDESLIGADO"}.`); return; }
      return say(p, `§6[Etheria] §7PvP: ${pvpOn() ? "§cligado" : "§adesligado"}§7. Sua equipe: §f${teamOf(p) ?? "nenhuma"}§7. Admin: §f!pvp on|off§7. Equipes: §f!time <nome>§7 / §f!time sair§7.`);
    }
    case "arena": {   // !arena lista | !arena verificar | !arena <boss>  (coloca a arena exclusiva do boss na hora, na sua frente)
      if (!canSpawnStructures(p)) return say(p, CREATIVE_ONLY);   // 6.40: só no criativo
      const q = (args[0] ?? "lista").toLowerCase();
      if (q === "lista") return say(p, "§6[Etheria] §7Arenas (boss -> estrutura): §f" + arenaKeys().map((k) => `${k} -> ${ARENAS[k].id}`).join("§7, §f"));
      if (q === "verificar") { const r = verifyAll(), bad = r.filter((x) => !x.ok); return say(p, `§6[Etheria] §7Estruturas: §a${r.length - bad.length} OK§7, ${bad.length ? "§c" + bad.length + " com problema: §f" + bad.map((b) => b.id).join(", ") : "§a0 com problema"}§7.`); }
      const key = keyOfBoss(q) ?? arenaKeys().find((k) => k.includes(q));
      if (!key) return say(p, "§cBoss sem arena. Use §f!arena lista§c.");
      placeArena(p.dimension, key, anchorFromPlayer(p, 14), (res) => say(p, res.ok ? `§a[Etheria] ${ARENAS[key].name} §7(${ARENAS[key].id}) ${res.reused ? "já existia aqui (reaproveitada)" : "colocada instantaneamente"}.` : `§c[Etheria] Falhou: ${ARENAS[key].id}: ${res.err}`));
      return;
    }
    case "octagrama": case "octagram": return octCmd(p, args);
    case "inferno": case "ceu": case "céu": case "espiritos": case "espíritos": case "voltar": case "reinos": return realmCmd(p, ({ "céu": "ceu", "espíritos": "espiritos" })[cmd] ?? cmd, args);
    case "predador": case "predator": {
      const d = getData(p), ab = Object.keys(d.absorbed ?? {});
      return say(p, `§5[Predador] §7Devorados: §f${d.devoured ?? 0}§7 | Blocos: §f${d.blocksEaten ?? 0}§7 | Absorvidas (${ab.length}): §f${ab.map((k) => d.absorbed[k] && k).join(", ") || "nenhuma"}§7. Use a habilidade no vazio para abrir 5 s de absorção.`);
    }
    case "cinematica": {
      const d = getData(p), v = (args[0] ?? "").toLowerCase();
      if (v === "on" || v === "off") { d.settings ??= {}; d.settings.cinematic = v === "on"; markDirty(p); }
      return say(p, `§6[Etheria] §7Cinemática de evolução: §f${d.settings?.cinematic === false ? "desligada" : "ligada"}§7 (!cinematica on|off).`);
    }
    case "dragao": case "dragonform": {   // admin: alterna o Dragão Verdadeiro mais próximo entre estágio 1 (humano) e estágio 2 (dragão)
      if (!p.hasTag(ADMIN_TAG)) return say(p, "§cSem permissão.");
      const es = p.dimension.getEntities({ location: p.location, maxDistance: 48 }).filter((e) => FORMS[e.typeId]);
      if (!es.length) return say(p, "§7Nenhum Dragão Verdadeiro por perto (48 blocos).");
      es.sort((a, b) => Math.hypot(a.location.x - p.location.x, a.location.z - p.location.z) - Math.hypot(b.location.x - p.location.x, b.location.z - p.location.z));
      const r = toggleForm(es[0]); return say(p, r === "busy" ? "§7O dragão já está se transformando." : `§6[Etheria] §7${FORMS[es[0].typeId].name}: forma §f${r === "dragon" ? "Dragão Verdadeiro (estágio 2)" : "humanoide (estágio 1)"}§7.`);
    }
    case "time": case "equipe": { const n = args[0]; if (!n || n === "sair") { setTeam(p, undefined); return say(p, "§7Você saiu da equipe."); } setTeam(p, n); return say(p, `§aEquipe: §f${teamOf(p)}§7. Aliados da mesma equipe não se atingem.`); }
    case "estrutura": case "estruturas": case "gerar": case "spawnar": {   // !gerar [nome] [forcar]: QUALQUER estrutura do addon, colocada na hora (systems/structcmd.js)
      const q = (args[0] ?? "").toLowerCase();
      if (q === "verificar") { const r = verifyWgen(), bad = r.filter((x) => !x.ok), a2 = verifyAll(), bad2 = a2.filter((x) => !x.ok); return say(p, `§6[Etheria] §7Estruturas: §a${r.length + a2.length - bad.length - bad2.length} OK§7, ${bad.length + bad2.length ? "§c" + (bad.length + bad2.length) + " com problema: §f" + [...bad.map((b) => `${b.id} (${b.why})`), ...bad2.map((b) => b.id)].join(", ") : "§a0 com problema"}§7.`); }
      return structCmd(p, args, trusted);
    }
    case "help": case "ajuda": return say(p, "§6[Etheria] §7Use o §fRelógio§7 para abrir o menu. Comandos: §f!menu !status !lord !arena !octagrama !inferno !ceu !espiritos !voltar !voo !poderes !criar !skills !hotbar !cast N !quests !tempest !gerar !mundo !aldeia !guerra !invocar !pvp !time§7. Suas habilidades são §fitens na hotbar§7: selecione o slot e use. Sem chat de comandos? Use §f/scriptevent etheria:cmd menu§7.");
  }
  if (!p.hasTag(ADMIN_TAG)) return say(p, `§cSem permissão para !${cmd}. Admin: /tag @s add ${ADMIN_TAG}`);
  const d = getData(p);
  switch (cmd) {
    case "xp": { const n = parseInt(args[0]); if (n > 0) addXp(p, n); else say(p, "§cUso: !xp 100"); return; }
    case "level": { const n = Math.min(MAX_LEVEL, parseInt(args[0])); if (n >= 1) { d.level = n; d.xp = 0; applyDerivedStats(p); refreshName(p); saveNow(p); say(p, `§eNível definido: ${n}`); } return; }
    case "coins": { const n = parseInt(args[0]); if (!isNaN(n)) { d.coins += n; markDirty(p); saveNow(p); say(p, `§eMoedas: ${d.coins}`); } return; }
    case "sp": { const n = parseInt(args[0]); if (!isNaN(n)) { d.skillPoints += n; d.attributePoints += n; markDirty(p); saveNow(p); say(p, `§ePontos +${n}`); } return; }
    case "give": {
      const id = args[0]?.includes(":") ? args[0] : `etheria:${args[0]}`;
      if (!ITEMS[id]) return say(p, `§cItem inexistente. Ex.: !give flame_sword. IDs: ${Object.keys(ITEMS).slice(0, 8).map((k) => k.replace("etheria:", "")).join(", ")}...`);
      const n = parseInt(args[1]) || 1; const c = inventory(p);
      if (["weapon", "armor", "accessory"].includes(ITEMS[id].kind)) { const it = new ItemStack(id, 1); ensureLore(it); c?.addItem(it); } else giveItem(p, id, n);
      return say(p, `§aRecebeu ${ITEMS[id].name}.`);
    }
    case "boss": {
      const def = BOSSES[args[0]]; if (!def) return say(p, `§cBosses: ${Object.keys(BOSSES).join(", ")}`);
      const v = p.getViewDirection();
      try { p.dimension.spawnEntity(def.type, { x: p.location.x + v.x * 8, y: p.location.y + 0.5, z: p.location.z + v.z * 8 }); } catch (e) { say(p, `§cFalha: ${e}`); }
      return;
    }
    case "npc": {
      const role = args[0]; if (!NPC_NAMES[role]) return say(p, `§cNPCs: ${Object.keys(NPC_NAMES).join(", ")}`);
      try { p.dimension.spawnEntity(`etheria:npc_${role}`, p.location); say(p, `§a${NPC_NAMES[role]} criado.`); } catch (e) { say(p, `§cFalha: ${e}`); }
      return;
    }
    case "reset": Object.assign(d, createDefaultData()); applyDerivedStats(p); refreshName(p); applyRaceLook(p); saveNow(p); return say(p, "§eDados resetados.");
    case "skilldebug": return say(p, "§7" + JSON.stringify(skillbarMetrics()));
    case "stats": { const s = getStats(p); return say(p, `§7atk ${s.atk.toFixed(1)} crit ${s.crit.toFixed(1)} red ${(s.reduction * 100).toFixed(0)}% mana ${s.maxMana} st ${s.maxStamina} hp+${s.maxHpExtra}`); }
    default: return say(p, "§7Admin: !xp N, !level N, !coins N, !sp N, !give id [n], !boss id, !npc role, !reset, !stats, !skilldebug");
  }
}

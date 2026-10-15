// main.js - Ponto de entrada de Legacy of Etheria (RPG para Minecraft Bedrock)
import { world, system, ItemStack } from "@minecraft/server";
import { VERSION } from "./config.js";
import { getData, forget, startAutosave, saveNow } from "./core/db.js";
import { applyDerivedStats, dropStats } from "./systems/stats.js";
import { startLoop } from "./systems/loop.js";
import { startCombat } from "./systems/combat.js";
import { startDrops } from "./systems/drops.js";
import { startBosses } from "./systems/bosses.js";
import { startMobAI } from "./systems/mobai.js";
import { startTrueDragons } from "./systems/truedragon.js";
import { startUse } from "./systems/use.js";
import { startNpcs } from "./systems/npcs.js";
import { registerCommands } from "./systems/commands.js";
import { refreshName } from "./systems/race.js";
import { dropSkillState } from "./systems/skills.js";
import { clearBuffs } from "./systems/effects.js";
import { openRacePick } from "./systems/ui/menus.js";
import { ensureLore } from "./systems/items.js";
import { inventory, giveItem } from "./core/utils.js";
import "./systems/sagesave.js";   // ganchos de save do Sábio: precisam existir antes do primeiro getData
import { startSage, dropSage } from "./systems/sage.js";
import { GreatSage } from "./systems/greatsage.js";
import { startPredator } from "./systems/predator.js";
import { startMobSkills } from "./systems/mobskills.js";
import { applyRaceLook, cleanLegacyRaceItems, startAngelGlide } from "./systems/raceparts.js";
import { startLineage } from "./systems/lineage.js";
import { startOrigin } from "./systems/origin.js";
import { startStructures } from "./systems/structures.js";
import { startTempest } from "./systems/tempest.js";
import { startSettlements } from "./systems/settlements.js";
import { startTravelWatch } from "./systems/travel.js";
import { startFactions } from "./systems/factions.js";
import { startBossFight } from "./systems/bossfight.js";
import { startWorldWar } from "./systems/worldwar.js";
import { startBossSpawn } from "./systems/bossspawn.js";
import { startArenas } from "./systems/arenas.js";
import { startPlacer } from "./systems/placer.js";
import { startWorldVoice } from "./systems/worldvoice.js";
import { startWorldgen } from "./systems/worldgen.js";
import { startOctagrama } from "./systems/octagrama.js";
import { startRealms } from "./systems/realms.js";
import { startFlight, dropFlight } from "./systems/flight.js";
import { startAntiSkill } from "./systems/antiskill.js";
import { startPowers } from "./systems/powers.js";
import { startCreator } from "./systems/creator.js";
import { startChronoa } from "./systems/chronoa.js";
import { updateRanking } from "./systems/ranking.js";
import "./systems/skillkinds.js";
import { startVoice, sageSay, dropVoice, sageCfg } from "./systems/voice.js";
import { startDiscovery, grantStarter } from "./systems/discovery.js";
import { startArmorFx } from "./systems/armorfx.js";
import { startSageCore, dropCore } from "./systems/sagecore.js";
import { startForge } from "./systems/forge.js";
import { startProtect } from "./systems/protect.js";
import { startWeaponFx } from "./systems/weaponfx.js";
import { startSkillBar, onPlayerReady, dropSkillBar } from "./systems/skillbar/index.js";

/** Coloca o item num slot específico se estiver vazio; senão usa o primeiro espaço livre do inventário (nunca sobrescreve). */
function placeAt(player, stack, slot) {
  const c = inventory(player); if (!c) return false;
  try {
    if (slot >= 0 && slot < c.size && !c.getSlot(slot).hasItem()) { c.setItem(slot, stack); return true; }
  } catch { /* cai no addItem */ }
  const left = c.addItem(stack);
  if (left) { try { player.dimension.spawnItem(left, player.location); } catch { /* ignore */ } }
  return true;
}

// Layout inicial da hotbar: [0] espada · [1-5] livres para as habilidades (viram itens sozinhas) · [6] poções · [7] Livro do Sábio · [8] Relógio
const KIT_SLOT = { sword: 0, hp: 6, sage: 7, clock: 8, tome: 9, mp: 10 };

function giveStarterKit(player, d) {
  if (d.kit) return;
  d.kit = true;
  const sword = new ItemStack("etheria:iron_blade", 1); ensureLore(sword); placeAt(player, sword, KIT_SLOT.sword);
  placeAt(player, new ItemStack("etheria:hp_potion_s", 3), KIT_SLOT.hp);
  placeAt(player, new ItemStack("minecraft:clock", 1), KIT_SLOT.clock);
  placeAt(player, new ItemStack("etheria:skill_tome", 1), KIT_SLOT.tome);
  placeAt(player, new ItemStack("etheria:mp_potion_s", 2), KIT_SLOT.mp);
}

function giveSage(player, d) {
  if (d.sageGiven) return;
  d.sageGiven = true; placeAt(player, new ItemStack("etheria:sage_book", 1), KIT_SLOT.sage);
  player.sendMessage("§b[Great Sage] §7Você recebeu o §fLivro do Great Sage§7. Use para abrir; agache e use para analisar o alvo.");
}

import { startCinematic } from "./systems/cinematic.js";
import { dropAdapter } from "./systems/sageadapter.js";
import { dropDebug } from "./systems/sagedebug.js";
const dropAdapterAll = (id) => { try { dropAdapter(id); dropDebug(id); } catch { /* ignore */ } };
// Ao sair: tenta salvar (o Bedrock pode recusar escrita neste evento; o autosave e os saves após mudanças importantes cobrem o resto)
try { world.beforeEvents.playerLeave.subscribe((ev) => { const p = ev.player; try { saveNow(p); } catch { /* somente leitura */ } system.run(() => { try { if (p.isValid) saveNow(p); } catch { /* ignore */ } }); }); } catch { /* evento indisponível */ }

function initPlayer(player, first) {
  const d = getData(player);
  dropStats(player.id);
  applyDerivedStats(player);
  refreshName(player);
  if (first) system.runTimeout(() => { try { player.sendMessage(`§8[Etheria] versão §f${VERSION}§8 ativa`); } catch { /* ignore */ } }, 60);   // confirma qual pacote está valendo
  if (first && !d.kit) giveStarterKit(player, d);   // kit com layout fixo ANTES do livro e das habilidades (que ocupam os slots livres)
  giveSage(player, d);
  try { applyRaceLook(player); } catch { /* ignore */ }   // traços raciais no corpo (propriedade do jogador); repete depois para o caso do jogador ainda não estar pronto
  system.runTimeout(() => { try { if (player.isValid) { applyRaceLook(player); cleanLegacyRaceItems(player); } } catch { /* ignore */ } }, 60);
  if (!d.starterUnique) system.runTimeout(() => { try { grantStarter(player); } catch (e) { console.warn(`[Etheria] starter: ${e}`); } }, 100);
  if (first) {
    player.sendMessage("§6§l[Etheria]§r §7Bem-vindo, aventureiro! Use o §fRelógio§7 para abrir o menu. Suas habilidades aparecem como §fitens na hotbar§7: selecione o slot e use.");
    if (!d.raceChosen) system.runTimeout(() => { if (!getData(player).raceChosen) openRacePick(player); }, 60);
    saveNow(player);
  }
  try { onPlayerReady(player, first); } catch (e) { console.warn(`[Etheria] hotbar de habilidades: ${e}`); }
}

world.afterEvents.playerSpawn.subscribe((ev) => initPlayer(ev.player, ev.initialSpawn));
world.afterEvents.playerLeave.subscribe((ev) => { dropAdapterAll(ev.playerId); dropStats(ev.playerId); dropVoice(ev.playerId); dropSage(ev.playerId); dropCore(ev.playerId); dropSkillState(ev.playerId); dropSkillBar(ev.playerId); clearBuffs(ev.playerId); forget(ev.playerId); });

system.run(() => {
  for (const p of world.getAllPlayers()) { initPlayer(p, false); updateRanking(p); }
  startAutosave();
  startCombat();
  startDrops();
  startBosses();
  startMobAI();
  startBossFight();
  startTrueDragons();
  startUse();
  startSkillBar();
  startNpcs();
  startStructures();
  startTempest(); startSettlements(); startTravelWatch(); startFactions(); startWorldWar();
  startBossSpawn();
  startPlacer();
  startWorldVoice();
  startArenas();
  startWorldgen();
  startOctagrama();
  startRealms();
  startFlight();
  startAntiSkill();
  startPowers();
  startCreator();
  startCinematic();
  startChronoa();
  startAngelGlide(); startLineage(); startOrigin();
  startPredator();
  startMobSkills();
  startSage();
  GreatSage.initialize();
  startProtect();
  startVoice();
  startWeaponFx();
  startArmorFx();
  startSageCore();
  startForge();
  startDiscovery();
  startLoop();
  registerCommands();
  console.warn(`[Etheria] v${VERSION} carregado.`);
});

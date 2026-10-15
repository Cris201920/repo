// systems/progress.js - 6.46: REGISTRO DE PROGRESSO REAL para conquistas e para o Grande Sábio.
//  - tipos de arma usados ao atacar (d.world.wtypes) e tipos de criatura derrotados (d.world.killTypes, limitado);
//  - regiões visitadas (flags region_*): ao entrar pela primeira vez, o Grande Sábio comenta a região (uma vez por jogador);
//  - conquistas conferidas logo depois de cada mudança (sem laço pesado: só quem mudou algo).
import { world, system } from "@minecraft/server";
import { getData, markDirty } from "../core/db.js";
import { ITEMS } from "../data/items.gen.js";
import { wd } from "./factions.js";
import { checkAchievements } from "./achievements.js";
import { sageText } from "./voice.js";
import { tempestInfo } from "./tempest.js";
import { settlementInfo } from "./settlements.js";
import { wgRecords } from "./worldgen.js";

const dirty = new Set();
const REGIONS = [
  { id: "region_tempest", name: "Tempest", r: 110, at: () => tempestInfo(), sage: "Região identificada: Federação de Tempest. Monstros e humanos vivem aqui em paz. O Conselho de Rimuru fica perto da praça." },
  { id: "region_luminus", name: "Reino Sagrado de Luminus", r: 75, at: () => wgRecords().find((q) => q.k === "luminus_reino" && q.d === "minecraft:overworld"), sage: "Região identificada: Reino Sagrado de Luminus. Os Cavaleiros Sagrados caçam mortos-vivos. Hinata Sakaguchi comanda a ordem." },
  { id: "region_guy", name: "Domínio de Guy Crimson", r: 65, at: () => wgRecords().find((q) => q.k === "guy_dominio" && q.d === "minecraft:overworld"), sage: "Alerta: Domínio de Guy Crimson. Só o poder é respeitado aqui. Evite provocar os soldados." },
  { id: "region_dwargon", name: "Fortaleza de Dwargon", r: 45, at: () => settlementInfo("dwargon"), sage: "Região identificada: Fortaleza de Dwargon. A melhor forja do mundo; os anões valorizam reputação." },
];
export function startProgress() {
  world.afterEvents.entityHurt.subscribe((ev) => {
    try {
      const p = ev.damageSource?.damagingEntity; if (p?.typeId !== "minecraft:player") return;
      const it = p.getComponent("minecraft:inventory")?.container?.getItem(p.selectedSlotIndex); const wt = it && ITEMS[it.typeId]?.wtype; if (!wt) return;
      const w = wd(getData(p)); w.wtypes ??= {}; if (w.wtypes[wt]) return; w.wtypes[wt] = 1; markDirty(p); dirty.add(p.id);
    } catch { /* ignore */ }
  });
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const p = ev.damageSource?.damagingEntity; if (p?.typeId !== "minecraft:player") return;
      const t = ev.deadEntity?.typeId; if (!t || t === "minecraft:player") return;
      const w = wd(getData(p)); w.killTypes ??= {}; if (w.killTypes[t] || Object.keys(w.killTypes).length >= 300) return; w.killTypes[t] = 1; markDirty(p); dirty.add(p.id);
    } catch { /* ignore */ }
  });
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        if (p.dimension.id === "minecraft:overworld") {
          const w = wd(getData(p)); w.flags ??= {};
          for (const R of REGIONS) {
            if (w.flags[R.id]) continue; const c = R.at(); if (!c || c.x === undefined) continue;
            if (Math.hypot(p.location.x - c.x, p.location.z - c.z) > R.r) continue;
            w.flags[R.id] = 1; markDirty(p); dirty.add(p.id);
            try { sageText(p, R.sage, { pri: 4, key: R.id, cd: 2400 }); } catch { /* ignore */ }
          }
        }
        if (dirty.has(p.id)) { dirty.delete(p.id); checkAchievements(p); }
      } catch { /* ignore */ }
    }
  }, 40);
}

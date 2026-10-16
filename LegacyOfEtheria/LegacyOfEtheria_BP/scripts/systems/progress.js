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
import { WGEN } from "../data/wgen.gen.js";
import { MOBS } from "../data/mobs.gen.js";
import { SKILLS } from "../data/skills.js";
import { on, emit, EV } from "../core/bus.js";

// 6.54: estatísticas que o Grande Sábio e as conquistas usam (por jogador, salvas em d.world.stats; nada é varrido a cada tick)
export function statsOf(d) {
  const w = wd(d); w.stats ??= {};
  const S = w.stats; S.deaths ??= 0; S.superiorKills ??= 0; S.strongKills ??= 0; S.streak ??= 0; S.bestStreak ??= 0; S.skillUses ??= 0; S.skillCats ??= {};
  S.skillKills ??= 0; S.skillEvolved ??= 0; S.bossFights ??= 0; S.bossNoDeath ??= 0; S.structs ??= {}; S.rare ??= {};
  return S;
}
const lastSkill = new Map();   // playerId -> tick do último uso de habilidade (abate "com habilidade" = até 3 s depois)
const RARE = new Set(["legendary", "mythic", "divine"]);
const kindName = { reino: "Reino", lendaria: "Local lendário", acampamento: "Acampamento", vila: "Vila", ruina: "Ruína", portal: "Portal", reino_dim: "Reino dimensional" };
const maxHp = (e) => { try { return e.getComponent("minecraft:health")?.effectiveMax ?? 0; } catch { return 0; } };

const dirty = new Set();
const REGIONS = [
  { id: "region_tempest", name: "Tempest", r: 110, at: () => tempestInfo(), sage: "Região identificada: Federação de Tempest. Monstros e humanos vivem aqui em paz. O Conselho de Rimuru fica perto da praça." },
  { id: "region_luminus", name: "Reino Sagrado de Luminus", r: 75, at: () => wgRecords().find((q) => q.k === "luminus_reino" && q.d === "minecraft:overworld"), sage: "Região identificada: Reino Sagrado de Luminus. Os Cavaleiros Sagrados caçam mortos-vivos. Hinata Sakaguchi comanda a ordem." },
  { id: "region_milim", name: "Domínio de Milim Nava", r: 70, at: () => wgRecords().find((q) => q.k === "milim_reino" && q.d === "minecraft:overworld"), sage: "Região identificada: Domínio de Milim Nava. Os Fiéis do Dragão servem a Destruidora. Recomendo boas maneiras." },
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
      const d = getData(p), w = wd(d), S = statsOf(d);
      // força do inimigo pelo MESMO critério do Grande Sábio (sagecombat.threatOf / alerta "muito superior"): vida máxima do inimigo ÷ a do jogador
      const ratio = (maxHp(ev.deadEntity) || MOBS[t]?.hp || 0) / Math.max(1, maxHp(p));
      if (ratio >= 1.5) { S.superiorKills++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); }
      if (ratio >= 4) { S.strongKills++; try { emit(EV.STRONG_ENEMY_DEFEATED, { player: p, type: t, name: MOBS[t]?.name ?? t, ratio }); } catch { /* ignore */ } }
      if (system.currentTick - (lastSkill.get(p.id) ?? -999) <= 60) S.skillKills++;
      w.killTypes ??= {}; if (!w.killTypes[t] && Object.keys(w.killTypes).length < 300) w.killTypes[t] = 1;
      markDirty(p); dirty.add(p.id);
    } catch { /* ignore */ }
  });
  on(EV.PLAYER_DEATH, ({ player }) => { try { const S = statsOf(getData(player)); S.deaths++; S.streak = 0; markDirty(player); } catch { /* ignore */ } });
  on(EV.SKILL_USED, ({ player, id }) => {
    try {
      lastSkill.set(player.id, system.currentTick);
      const S = statsOf(getData(player)); S.skillUses++; const c = SKILLS[id]?.cat; if (c && !S.skillCats[c]) { S.skillCats[c] = 1; dirty.add(player.id); }
      if (S.skillUses % 25 === 0) dirty.add(player.id); markDirty(player);
    } catch { /* ignore */ }
  });
  on(EV.SAGE_SKILL_EVOLVED, ({ player }) => { try { statsOf(getData(player)).skillEvolved++; markDirty(player); dirty.add(player.id); } catch { /* ignore */ } });
  on(EV.BOSS_ENCOUNTER, ({ player }) => { try { statsOf(getData(player)).bossFights++; markDirty(player); } catch { /* ignore */ } });
  on(EV.BOSS_DEFEATED, ({ player, noDeath }) => { try { if (noDeath) { statsOf(getData(player)).bossNoDeath++; markDirty(player); } dirty.add(player.id); } catch { /* ignore */ } });
  on(EV.PLAYER_LEAVE, ({ player }) => { try { lastSkill.delete(player.id); } catch { /* ignore */ } });
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
            try { emit(EV.REGION_DISCOVERED, { player: p, id: R.id, name: R.name }); } catch { /* ignore */ }
          }
        }
        // 6.54: estruturas geradas (registro real do worldgen): primeira visita a cada uma
        const S = statsOf(getData(p));
        for (const rec of wgRecords()) {
          if (rec.d !== p.dimension.id || S.structs[rec.k]) continue;
          const def = WGEN[rec.k]; if (!def) continue;
          const rr = Math.max(def.size?.[0] ?? 32, def.size?.[2] ?? 32) / 2 + 12, cx = rec.x, cz = rec.z;   // o registro já guarda o centro
          if (Math.hypot(p.location.x - cx, p.location.z - cz) > rr) continue;
          S.structs[rec.k] = def.kind ?? "?"; markDirty(p); dirty.add(p.id);
          try { emit(EV.STRUCTURE_DISCOVERED, { player: p, key: rec.k, name: def.name ?? rec.k, kind: def.kind, kindName: kindName[def.kind] ?? "Estrutura", rare: !!def.rare }); } catch { /* ignore */ }
        }
        // itens raros no inventário (lendário/mítico/divino): registrados uma vez (a cada ~10 s, leve)
        if ((system.currentTick + (p.id.length * 7)) % 200 < 40) {
          const inv = p.getComponent("minecraft:inventory")?.container;
          if (inv) for (let i = 0; i < inv.size; i++) {
            const it = inv.getItem(i); if (!it) continue; const I = ITEMS[it.typeId];
            if (!I || !RARE.has(I.rarity) || S.rare[it.typeId] || Object.keys(S.rare).length >= 200) continue;
            S.rare[it.typeId] = I.rarity; markDirty(p); dirty.add(p.id);
            try { emit(EV.RARE_ITEM, { player: p, id: it.typeId, name: I.name ?? it.typeId, rarity: I.rarity }); } catch { /* ignore */ }
          }
        }
        if (dirty.has(p.id)) { dirty.delete(p.id); checkAchievements(p); }
      } catch { /* ignore */ }
    }
  }, 40);
}

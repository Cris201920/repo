// data/achievements.js - 6.54: CONQUISTAS DO GRANDE SÁBIO 2.0 (substitui a lista antiga de data/misc.js, que agora só reexporta daqui).
// Todos os IDs antigos foram mantidos (o progresso salvo continua valendo). Cada conquista tem:
//   id (único) · cat · name · desc · hint (dica mostrada enquanto bloqueada) · rarity (comum..lendaria) · title · coins · xp
//   check(d) -> bool   (só lê o estado REAL do jogador: nível, raça, abates, missões, flags e estatísticas de systems/progress.js)
//   prog(d)  -> [atual, meta]   (opcional: conquistas acumulativas mostram barra de progresso)
// As recompensas são moedas, XP e títulos — nunca níveis, evoluções ou habilidades supremas de graça.
import { SKILLS } from "./skills.js";
import { RACES, isLordStage } from "./races.js";
import { WGEN } from "./wgen.gen.js";

export const RARITY = {
  comum: { name: "Comum", col: "§f", tier: "common", xp: 50, order: 0 },
  incomum: { name: "Incomum", col: "§a", tier: "intrinsic", xp: 150, order: 1 },
  rara: { name: "Rara", col: "§b", tier: "extra", xp: 400, order: 2 },
  epica: { name: "Épica", col: "§d", tier: "unique", xp: 1000, order: 3 },
  lendaria: { name: "Lendária", col: "§6", tier: "ultimate", xp: 2500, order: 4 },
};
export const ACH_CATS = [["Sobrevivência", "menu_status"], ["Evolução", "menu_race"], ["Exploração", "menu_ranking"], ["Combate", "menu_class"],
  ["Habilidades", "menu_skills"], ["Tensura", "menu_guild"], ["Missões", "menu_quests"]];

const S = (d) => d.world?.stats ?? {};
const F = (d) => d.world?.flags ?? {};
const bk = (d) => Object.values(d.bossKills ?? {}).reduce((a, b) => a + b, 0);
const cat = (id) => SKILLS[id]?.cat, elem = (id) => SKILLS[id]?.element;
const nCat = (d, c) => (d.unlockedSkills ?? []).filter((id) => cat(id) === c).length;
const structKinds = (d) => Object.values(S(d).structs ?? {});
const structIds = (d) => Object.keys(S(d).structs ?? {});
const finalStage = (d) => { const R = RACES[d.race]; const st = R?.stages?.[d.raceStage]; return !!st && !st.next.some((n) => !isLordStage(n)) && !isLordStage(st.id) && !!st.from; };
const P = (cur, max) => [Math.min(cur, max), max];
const lv = (n) => (d) => d.level >= n;
const lvP = (n) => (d) => P(d.level, n);

export const ACHIEVEMENTS = [
  // ============================================================ SOBREVIVÊNCIA
  { id: "first_awakening", cat: "Sobrevivência", rarity: "comum", name: "Primeiro Despertar", desc: "Escolha sua raça e desperte neste mundo.", hint: "Escolha uma raça no Relógio.", title: "Desperto", coins: 30, check: (d) => !!d.raceChosen },
  { id: "first_blood", cat: "Sobrevivência", rarity: "comum", name: "Primeira Batalha", desc: "Vença sua primeira batalha.", hint: "Derrote qualquer inimigo.", title: "Novato", coins: 20, check: (d) => d.kills >= 1 },
  { id: "survivor", cat: "Sobrevivência", rarity: "incomum", name: "Sobrevivente Experiente", desc: "Derrote 25 inimigos superiores sem morrer no meio.", hint: "Vença inimigos com mais vida que você, sem cair.", title: "Sobrevivente", coins: 300,
    check: (d) => (S(d).bestStreak ?? 0) >= 25, prog: (d) => P(S(d).bestStreak ?? 0, 25) },
  { id: "hunter", cat: "Sobrevivência", rarity: "incomum", name: "Caçador", desc: "Derrote 100 inimigos.", hint: "Continue lutando.", title: "Caçador", coins: 150, check: (d) => d.kills >= 100, prog: (d) => P(d.kills, 100) },
  { id: "slayer", cat: "Sobrevivência", rarity: "epica", name: "Exterminador", desc: "Derrote 1.000 inimigos.", hint: "Uma longa jornada de batalhas.", title: "Exterminador", coins: 1500, check: (d) => d.kills >= 1000, prog: (d) => P(d.kills, 1000) },
  { id: "boss_survivor", cat: "Sobrevivência", rarity: "rara", name: "De Pé Diante do Chefe", desc: "Enfrente 3 chefes.", hint: "Chefes aparecem nas arenas e reinos.", title: "Resistente", coins: 600,
    check: (d) => (S(d).bossFights ?? 0) >= 3, prog: (d) => P(S(d).bossFights ?? 0, 3) },
  { id: "giant_killer", cat: "Sobrevivência", rarity: "epica", name: "Davi e Golias", desc: "Derrote um inimigo com mais de 4x a sua vida máxima.", hint: "O Grande Sábio avisa quando um inimigo é muito superior.", title: "Matador de Gigantes", coins: 1200,
    check: (d) => (S(d).strongKills ?? 0) >= 1 },

  // ============================================================ EVOLUÇÃO (marcos do sistema real de níveis: máximo 100)
  { id: "lv2", cat: "Evolução", rarity: "comum", name: "Primeiro Nível", desc: "Suba de nível pela primeira vez.", hint: "Ganhe XP derrotando inimigos e concluindo missões.", title: "Iniciante", coins: 20, check: lv(2) },
  { id: "lv10", cat: "Evolução", rarity: "comum", name: "Veterano", desc: "Alcance o nível 10.", hint: "", title: "Veterano", coins: 100, check: lv(10), prog: lvP(10) },
  { id: "lv16", cat: "Evolução", rarity: "incomum", name: "Aventureiro Formado", desc: "Alcance o nível 16.", hint: "", title: "Formado", coins: 250, check: lv(16), prog: lvP(16) },
  { id: "lv25", cat: "Evolução", rarity: "incomum", name: "Herói", desc: "Alcance o nível 25.", hint: "", title: "Herói", coins: 500, check: lv(25), prog: lvP(25) },
  { id: "lv30", cat: "Evolução", rarity: "rara", name: "Guerreiro Consagrado", desc: "Alcance o nível 30.", hint: "", title: "Consagrado", coins: 900, check: lv(30), prog: lvP(30) },
  { id: "lv50", cat: "Evolução", rarity: "rara", name: "Lenda Viva", desc: "Alcance o nível 50.", hint: "", title: "Lenda Viva", coins: 2500, check: lv(50), prog: lvP(50) },
  { id: "lv75", cat: "Evolução", rarity: "epica", name: "Transcendente", desc: "Alcance o nível 75.", hint: "", title: "Transcendente", coins: 8000, check: lv(75), prog: lvP(75) },
  { id: "lv100", cat: "Evolução", rarity: "lendaria", name: "Ascendido", desc: "Alcance o nível 100 (máximo).", hint: "", title: "Ascendido", coins: 20000, check: lv(100), prog: lvP(100) },
  { id: "evolved", cat: "Evolução", rarity: "incomum", name: "Evolução", desc: "Evolua sua raça pela primeira vez.", hint: "Relógio > Raça > Evolução.", title: "Evoluído", coins: 300, check: (d) => !!d.raceChosen && !!RACES[d.race]?.stages?.[d.raceStage]?.from },
  { id: "ascended_race", cat: "Evolução", rarity: "epica", name: "Forma Suprema", desc: "Complete uma linha evolutiva (estágio final da raça).", hint: "Siga um caminho da árvore de evolução até o fim.", title: "Forma Suprema", coins: 5000, check: finalStage },

  // ============================================================ EXPLORAÇÃO (só lugares que existem no addon)
  { id: "first_structure", cat: "Exploração", rarity: "comum", name: "Primeira Descoberta", desc: "Descubra uma estrutura do mundo.", hint: "Explore: acampamentos, vilas, ruínas e reinos aparecem pelo mundo.", title: "Explorador", coins: 80,
    check: (d) => structIds(d).length >= 1 },
  { id: "ancient_ruin", cat: "Exploração", rarity: "incomum", name: "Ecos do Passado", desc: "Encontre uma ruína antiga.", hint: "Templos, torres, círculos e fortes em ruínas.", title: "Arqueólogo", coins: 300, check: (d) => structKinds(d).includes("ruina") },
  { id: "important_city", cat: "Exploração", rarity: "comum", name: "Cidade Importante", desc: "Visite uma cidade importante (Tempest, Dwargon, Luminus ou o Domínio de Milim).", hint: "", title: "Viajante", coins: 100,
    check: (d) => ["region_tempest", "region_dwargon", "region_luminus", "region_milim"].some((k) => F(d)[k]) },
  { id: "found_tempest", cat: "Exploração", rarity: "comum", name: "Federação de Tempest", desc: "Descubra Tempest.", hint: "A cidade de Rimuru.", title: "Cidadão de Tempest", coins: 100, check: (d) => !!F(d).region_tempest },
  { id: "rare_structure", cat: "Exploração", rarity: "rara", name: "Achado Raro", desc: "Encontre uma estrutura rara (reino ou local lendário).", hint: "As raras ficam longe do início.", title: "Desbravador", coins: 800,
    check: (d) => structIds(d).some((k) => WGEN[k]?.rare) },
  { id: "danger_zone", cat: "Exploração", rarity: "rara", name: "Território Hostil", desc: "Entre em uma região perigosa (Domínio de Guy, Ninho Taratect ou Inferno).", hint: "", title: "Destemido", coins: 900,
    check: (d) => !!F(d).region_guy || ["guy_dominio", "ninho_taratect", "inferno"].some((k) => S(d).structs?.[k]) },
  { id: "legend_place", cat: "Exploração", rarity: "epica", name: "Lugar de Lenda", desc: "Descubra um local lendário (Octagrama, Caverna de Veldora, Domínio de Guy, Domínio de Veldanava, Ninho Taratect).", hint: "", title: "Testemunha da Lenda", coins: 2000,
    check: (d) => structKinds(d).includes("lendaria") || !!F(d).visited_veldanava },
  { id: "luminus_visitor", cat: "Exploração", rarity: "incomum", name: "Peregrino da Luz", desc: "Visite o Reino Sagrado de Luminus.", hint: "", title: "Peregrino", coins: 300, check: (d) => !!F(d).region_luminus },
  { id: "milim_visitor", cat: "Exploração", rarity: "incomum", name: "Visita à Destruidora", desc: "Visite o Domínio de Milim Nava.", hint: "", title: "Amigo dos Dragões", coins: 300, check: (d) => !!F(d).region_milim },
  { id: "world_traveler", cat: "Exploração", rarity: "rara", name: "Andarilho", desc: "Visite Tempest, Luminus, o Domínio de Guy e Dwargon.", hint: "", title: "Andarilho", coins: 1200,
    check: (d) => ["region_tempest", "region_luminus", "region_guy", "region_dwargon"].every((k) => F(d)[k]), prog: (d) => P(["region_tempest", "region_luminus", "region_guy", "region_dwargon"].filter((k) => F(d)[k]).length, 4) },
  { id: "dimension_explorer", cat: "Exploração", rarity: "epica", name: "Explorador Dimensional", desc: "Entre no Domínio de Veldanava.", hint: "Um portal celeste leva até lá.", title: "Viajante das Estrelas", coins: 1500, check: (d) => !!F(d).visited_veldanava },
  { id: "cartographer", cat: "Exploração", rarity: "epica", name: "Cartógrafo", desc: "Descubra 15 estruturas diferentes.", hint: "", title: "Cartógrafo", coins: 3000, check: (d) => structIds(d).length >= 15, prog: (d) => P(structIds(d).length, 15) },

  // ============================================================ COMBATE
  { id: "first_boss", cat: "Combate", rarity: "rara", name: "Primeiro Chefe", desc: "Derrote seu primeiro chefe.", hint: "", title: "Desafiador", coins: 500, check: (d) => bk(d) >= 1 },
  { id: "flawless_boss", cat: "Combate", rarity: "epica", name: "Sem Cair", desc: "Derrote um chefe sem morrer durante a luta.", hint: "Prepare poções e resistências antes.", title: "Invicto", coins: 1500, check: (d) => (S(d).bossNoDeath ?? 0) >= 1 },
  { id: "punch_up", cat: "Combate", rarity: "incomum", name: "Acima do Meu Nível", desc: "Vença um inimigo com pelo menos 1,5x a sua vida máxima.", hint: "", title: "Ousado", coins: 250, check: (d) => (S(d).superiorKills ?? 0) >= 1 },
  { id: "versatile", cat: "Combate", rarity: "rara", name: "Versátil", desc: "Use habilidades de 4 categorias diferentes.", hint: "Magia, Combate, Extra, Única, Racial...", title: "Versátil", coins: 700,
    check: (d) => Object.keys(S(d).skillCats ?? {}).length >= 4, prog: (d) => P(Object.keys(S(d).skillCats ?? {}).length, 4) },
  { id: "skill_finisher", cat: "Combate", rarity: "incomum", name: "Golpe Especial", desc: "Derrote um inimigo logo depois de usar uma habilidade.", hint: "", title: "Técnico", coins: 200, check: (d) => (S(d).skillKills ?? 0) >= 1 },
  { id: "hard_streak", cat: "Combate", rarity: "epica", name: "Sequência Implacável", desc: "Vença 10 batalhas difíceis seguidas sem morrer.", hint: "Inimigos superiores contam; morrer zera a sequência.", title: "Implacável", coins: 2500,
    check: (d) => (S(d).bestStreak ?? 0) >= 10, prog: (d) => P(S(d).bestStreak ?? 0, 10) },
  { id: "king_slayer", cat: "Combate", rarity: "rara", name: "Regicida Goblin", desc: "Derrote o Rei Goblin.", hint: "", title: "Regicida", coins: 500, check: (d) => (d.bossKills?.goblin_king ?? 0) >= 1 },
  { id: "void_breaker", cat: "Combate", rarity: "epica", name: "Quebra-Vazio", desc: "Derrote o Senhor do Vazio.", hint: "", title: "Quebra-Vazio", coins: 3000, check: (d) => (d.bossKills?.void_lord ?? 0) >= 1 },
  { id: "ember_tamer", cat: "Combate", rarity: "epica", name: "Domador de Brasas", desc: "Derrote o Tirano Brasa.", hint: "", title: "Domador de Brasas", coins: 5000, check: (d) => (d.bossKills?.ember_tyrant ?? 0) >= 1 },
  { id: "boss_hunter", cat: "Combate", rarity: "lendaria", name: "Matador de Chefes", desc: "Derrote 10 chefes.", hint: "", title: "Matador de Chefes", coins: 6000, check: (d) => bk(d) >= 10, prog: (d) => P(bk(d), 10) },
  { id: "weapon_master", cat: "Combate", rarity: "rara", name: "Mestre das Armas", desc: "Ataque com 4 tipos diferentes de arma.", hint: "", title: "Mestre das Armas", coins: 800,
    check: (d) => Object.keys(d.world?.wtypes ?? {}).length >= 4, prog: (d) => P(Object.keys(d.world?.wtypes ?? {}).length, 4) },
  { id: "monster_hunter", cat: "Combate", rarity: "rara", name: "Caçador de Monstros", desc: "Derrote 15 tipos diferentes de criaturas.", hint: "", title: "Caçador de Monstros", coins: 900,
    check: (d) => Object.keys(d.world?.killTypes ?? {}).length >= 15, prog: (d) => P(Object.keys(d.world?.killTypes ?? {}).length, 15) },

  // ============================================================ HABILIDADES
  { id: "skill_student", cat: "Habilidades", rarity: "comum", name: "Aprendiz", desc: "Tenha 5 habilidades.", hint: "Mestres, pergaminhos e missões ensinam habilidades.", title: "Aprendiz", coins: 80,
    check: (d) => (d.unlockedSkills ?? []).length >= 5, prog: (d) => P((d.unlockedSkills ?? []).length, 5) },
  { id: "second_unique", cat: "Habilidades", rarity: "epica", name: "Unicidade", desc: "Obtenha uma Habilidade Única além da inicial.", hint: "Combinações e despertares revelam Habilidades Únicas.", title: "Singular", coins: 2000,
    check: (d) => nCat(d, "Única") >= 2 },
  { id: "awakened_skill", cat: "Habilidades", rarity: "rara", name: "Despertar", desc: "Desperte uma habilidade (maestria máxima).", hint: "Use muito a mesma habilidade.", title: "Desperto", coins: 1000, check: (d) => Object.keys(d.awakened ?? {}).length >= 1 },
  { id: "skill_evolver", cat: "Habilidades", rarity: "rara", name: "Evolução de Habilidade", desc: "Evolua uma habilidade.", hint: "Algumas habilidades evoluem para versões superiores.", title: "Aperfeiçoado", coins: 800, check: (d) => (S(d).skillEvolved ?? 0) >= 1 },
  { id: "skill_user", cat: "Habilidades", rarity: "incomum", name: "Na Prática", desc: "Use habilidades 100 vezes.", hint: "", title: "Praticante", coins: 300, check: (d) => (S(d).skillUses ?? 0) >= 100, prog: (d) => P(S(d).skillUses ?? 0, 100) },
  { id: "element_master", cat: "Habilidades", rarity: "epica", name: "Domínio Elemental", desc: "Tenha 5 habilidades do mesmo elemento.", hint: "", title: "Mestre Elemental", coins: 1800,
    check: (d) => Math.max(0, ...Object.values((d.unlockedSkills ?? []).reduce((m, id) => { const e = elem(id); if (e) m[e] = (m[e] ?? 0) + 1; return m; }, {}))) >= 5 },
  { id: "ultimate_skill", cat: "Habilidades", rarity: "lendaria", name: "Poder Supremo", desc: "Obtenha uma Habilidade Ultimate.", hint: "Apenas evoluções extremas de Habilidades Únicas.", title: "Supremo", coins: 10000, check: (d) => nCat(d, "Ultimate") >= 1 },
  { id: "magic_awakening", cat: "Habilidades", rarity: "incomum", name: "Despertar Mágico", desc: "Aprenda uma habilidade da categoria Magia.", hint: "", title: "Desperto", coins: 200, check: (d) => nCat(d, "Magia") >= 1 },
  { id: "elementalist", cat: "Habilidades", rarity: "rara", name: "Elementalista", desc: "Tenha habilidades de 4 elementos diferentes.", hint: "", title: "Elementalista", coins: 1000,
    check: (d) => new Set((d.unlockedSkills ?? []).map(elem).filter(Boolean)).size >= 4, prog: (d) => P(new Set((d.unlockedSkills ?? []).map(elem).filter(Boolean)).size, 4) },

  // ============================================================ TENSURA (cada uma só é possível no caminho da própria raça)
  { id: "demon_evolution", cat: "Tensura", rarity: "rara", name: "Sangue Demoníaco", desc: "Alcance uma evolução demoníaca (Demônio evoluído ou Lord Demônio).", hint: "Raça Demônio, ou o Lord Demônio no fim de qualquer raça.", title: "Demoníaco", coins: 1500,
    check: (d) => (d.race === "demon" && d.raceStage !== "demon_1") || isLordStage(d.raceStage) },
  { id: "transformation", cat: "Tensura", rarity: "epica", name: "Transformação", desc: "Use uma transformação racial (forma dracônica da linhagem).", hint: "Dragonoides: escolha uma linhagem e transforme-se.", title: "Transmutado", coins: 2500, check: (d) => !!F(d).used_form },
  { id: "dragon_power", cat: "Tensura", rarity: "rara", name: "Poder Dracônico", desc: "Desperte uma linhagem dracônica.", hint: "Raça Dragonoide: Relógio > Raça > Linhagem.", title: "Dracônico", coins: 1500, check: (d) => !!d.lineage },
  { id: "true_demon_lord", cat: "Tensura", rarity: "lendaria", name: "Verdadeiro Lord Demônio", desc: "Torne-se Lord Demônio.", hint: "Estágio final de qualquer raça + 300 abates + nível 80.", title: "Lord Demônio", coins: 15000, check: (d) => isLordStage(d.raceStage) },
  { id: "disciple", cat: "Tensura", rarity: "rara", name: "Discípulo", desc: "Conclua a prova de discípulo de um personagem.", hint: "", title: "Discípulo", coins: 500, check: (d) => Object.keys(F(d)).some((k) => k.startsWith("disc_")) },
  { id: "challenger", cat: "Tensura", rarity: "rara", name: "Desafiante", desc: "Vença um duelo contra um personagem.", hint: "", title: "Desafiante", coins: 1000, check: (d) => Object.values(d.world?.chars ?? {}).some((c) => (c.wins ?? 0) > 0) },
  { id: "council_friend", cat: "Tensura", rarity: "incomum", name: "Amigo do Conselho", desc: "Converse com Rimuru, Benimaru, Shion, Shuna e Ranga.", hint: "O Conselho fica perto da praça de Tempest.", title: "Amigo de Tempest", coins: 300,
    check: (d) => ["rimuru_tempest", "benimaru", "shion", "shuna", "ranga"].every((k) => d.world?.chars?.[k]?.met), prog: (d) => P(["rimuru_tempest", "benimaru", "shion", "shuna", "ranga"].filter((k) => d.world?.chars?.[k]?.met).length, 5) },
  { id: "council_champion", cat: "Tensura", rarity: "epica", name: "Campeão do Conselho", desc: "Vença Rimuru, Benimaru, Shion e Shuna em duelo.", hint: "", title: "Campeão de Tempest", coins: 6000,
    check: (d) => ["rimuru_tempest", "benimaru", "shion", "shuna"].every((k) => (d.world?.chars?.[k]?.wins ?? 0) > 0), prog: (d) => P(["rimuru_tempest", "benimaru", "shion", "shuna"].filter((k) => (d.world?.chars?.[k]?.wins ?? 0) > 0).length, 4) },
  { id: "veldanava_heir", cat: "Tensura", rarity: "lendaria", name: "Herdeiro da Memória", desc: "Conclua o Juízo da Luz no Domínio de Veldanava.", hint: "", title: "Herdeiro de Veldanava", coins: 8000, check: (d) => !!F(d).veldanava_trial },
  { id: "tensura_legend", cat: "Tensura", rarity: "lendaria", name: "Lenda de Tensura", desc: "Herdeiro da Memória, Campeão do Conselho e discípulo de um mestre.", hint: "", title: "Lenda de Tensura", coins: 25000,
    check: (d) => !!F(d).veldanava_trial && ["rimuru_tempest", "benimaru", "shion", "shuna"].every((k) => (d.world?.chars?.[k]?.wins ?? 0) > 0) && Object.keys(F(d)).some((k) => k.startsWith("disc_")) },

  // ============================================================ MISSÕES
  { id: "first_step", cat: "Missões", rarity: "comum", name: "Primeiro Passo", desc: "Conclua sua primeira missão.", hint: "NPCs das cidades e personagens dão missões.", title: "Iniciante", coins: 50, check: (d) => d.quests.completed.length >= 1 },
  { id: "adventurer", cat: "Missões", rarity: "incomum", name: "Aventureiro", desc: "Conclua 5 missões.", hint: "", title: "Aventureiro", coins: 400, check: (d) => d.quests.completed.length >= 5, prog: (d) => P(d.quests.completed.length, 5) },
  { id: "questor", cat: "Missões", rarity: "rara", name: "Herói das Missões", desc: "Conclua 10 missões.", hint: "", title: "Herói das Missões", coins: 800, check: (d) => d.quests.completed.length >= 10, prog: (d) => P(d.quests.completed.length, 10) },
  { id: "tempest_guardian", cat: "Missões", rarity: "epica", name: "Guardião de Tempest", desc: "Conclua as missões de defesa de Tempest.", hint: "", title: "Guardião de Tempest", coins: 2000,
    check: (d) => ["tp_leader_defend", "tp_defend_city2", "tp_orc_aftermath"].every((q) => d.quests.completed.includes(q)), prog: (d) => P(["tp_leader_defend", "tp_defend_city2", "tp_orc_aftermath"].filter((q) => d.quests.completed.includes(q)).length, 3) },
  { id: "rich", cat: "Missões", rarity: "rara", name: "Magnata", desc: "Tenha 10.000 moedas.", hint: "", title: "Magnata", coins: 0, check: (d) => d.coins >= 10000, prog: (d) => P(d.coins, 10000) },
  { id: "guild_b", cat: "Missões", rarity: "rara", name: "Aventureiro Rank B", desc: "Alcance o rank B da guilda.", hint: "", title: "Veterano da Guilda", coins: 1000, check: (d) => d.guild.id && d.guild.rank >= 4 },
  { id: "guild_s", cat: "Missões", rarity: "lendaria", name: "Lenda da Guilda", desc: "Alcance o rank S da guilda.", hint: "", title: "Lenda da Guilda", coins: 5000, check: (d) => d.guild.id && d.guild.rank >= 6 },
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// data/powers.js - ÁRVORES DE PODERES (Expansão Suprema, 6.28.0). Arquitetura compartilhada: cada LINHA agrupa estágios que apontam para habilidades REAIS de data/skills.js
// (nome, raridade, custo, recarga, alcance, elemento, resistência já vêm de lá; nada é duplicado). Aqui ficam só: ordem de evolução, requisitos, o que cada estágio muda de verdade e compatibilidades.
// cls: "common" (comum) | "unique" (única) | "supreme" (suprema). A classe MUDA a mecânica, não é só rótulo:
//   - Únicas/Supremas não podem ser absorvidas por jogadores nem anuladas pela Anti-Skill (systems/predator.js canAbsorb, systems/antiskill.js classifySkill);
//   - Supremas exigem chefes derrotados / evento além de nível (ver req dos estágios); Únicas exigem condição de descoberta/despertar;
//   - só Únicas/Supremas têm anúncio de voz do Sábio ao lançar (systems/skills.js announceAllowed).
// req (tipos): level · bosses (total) · boss (id) · skill (id) · devoured · lineage · race · sage (estágio do Sábio) · fn (verificação própria, ver systems/powers.js)
export const POWER_CLASS = Object.freeze({ common: "Comum", unique: "Única", supreme: "Suprema" });

export const LINES = [
  { id: "sage", who: "Rimuru Tempest", name: "Sábio → Grande Sábio → Raphael → Ciel", cls: "supreme",
    about: "Linha de inteligência de Rimuru (Manas). Cada estágio é um sistema distinto: evoluir libera funções novas, não só números. Requisitos reais em Relógio > Livro do Sábio.",
    stages: [
      { id: "gs", name: "Grande Sábio", sage: 2, cls: "unique", feats: ["Análise de criaturas, itens, equipamentos e habilidades (alcance e velocidade crescem com o nº de análises)", "Aceleração, Processamento Paralelo, Anulação de Canto (+resistência mágica)", "Avaliação de ameaça, resistências e fraquezas do alvo", "Dicas de combate e enciclopédia de conhecimento"], evolvesTo: "Raphael" },
      { id: "raphael", name: "Raphael, Rei da Sabedoria", sage: 3, cls: "supreme", feats: ["Análise mais completa e mapa de fases dos chefes", "Otimização de habilidades compatíveis", "Síntese: combina habilidades de maestria 3+ em uma Única superior", "Gerenciamento: conjunto recomendado de habilidades equipado na hotbar", "Mais auras de monitoramento (12)", "Identidade visual e de voz próprias"], evolvesTo: "Ciel" },
      { id: "ciel", name: "Ciel", sage: 4, cls: "supreme", feats: ["Análise avançada e recomendações adaptadas ao inimigo", "Controle aprimorado do conjunto de poderes", "Conversação e memória própria (consciência Manas)", "Interface, efeitos e transição visual exclusivos"], evolvesTo: null },
    ] },
  { id: "predator", who: "Rimuru Tempest", name: "Predador → Gula → Beelzebuth", cls: "supreme",
    about: "Árvore de absorção: devora alvos feridos (guarda no estômago), concede Mimetismo, devora blocos com limites e aprende habilidades comuns de outros jogadores durante a janela de 5 s.",
    stages: [
      { id: "predator", name: "Predador", skill: "predator", cls: "unique", feats: ["Devora 1 alvo com ≤30% de vida (estômago + mana + cura)", "Mimetismo: ao devorar o bastante de uma espécie, aprende uma habilidade dela", "Devora 1 bloco (nunca bedrock, baús, spawners, portais, estruturas protegidas)", "Janela de absorção de 5 s: golpes de habilidades comuns de outros jogadores são devorados e aprendidos"], evolvesTo: "Gula", gate: { devoured: "STOMACH", level: 35 } },
      { id: "gluttony", name: "Gula (Glutonaria)", skill: "gluttony", cls: "unique", feats: ["Devora até 4 alvos com ≤40% de vida, raio 8", "Devora até 5 blocos em cruz"], evolvesTo: "Beelzebuth", gate: { devoured: "BEEL", level: 60 } },
      { id: "beelzebuth", name: "Beelzebuth, Senhor da Gula", skill: "beelzebuth", cls: "supreme", feats: ["Devora até 8 alvos feridos num raio de 10 blocos", "Devora até 14 blocos por conjuração (limite por minuto)"], evolvesTo: null },
    ],
    rules: ["Jogadores: só habilidades COMUNS ativas podem ser absorvidas; Únicas/Supremas/lendárias nunca; sem dano direto em jogadores além da habilidade usada.", "Chefes e entidades especiais: só são devorados quando feridos (≤ limiar); nada de morte instantânea.", "Construções: blocos protegidos, estruturas do addon e recipientes não podem ser devorados; limite por conjuração e por minuto."] },
  { id: "veldora", who: "Veldora Tempest", name: "Dragão da Tempestade → Veldora Tempest → Rei do Caos", cls: "supreme",
    about: "Linhagem Veldora (raça Dragonoide). Etapas tardias exigem nível, estágio da raça E chefes derrotados. A etapa \"Rei do Caos\" foi implementada a pedido; seus detalhes canônicos não foram confirmados na referência consultada.",
    stages: [
      { id: "v_storm", name: "Dragão da Tempestade", skill: "thunder_roar", cls: "common", feats: ["Escamas da Tempestade, Vendaval Cortante e Trovão Dracônico (raios em cadeia)"], evolvesTo: "Veldora Tempest", tiers: ["storm_scales", "windlash", "thunder_roar", "tempest_aura"] },
      { id: "v_tempest", name: "Veldora Tempest", skill: "storm_wall", cls: "unique", feats: ["Raio Negro (feixe que atravessa)", "Muralha da Tempestade: absorção + defesa + resistência a raios", "Trovão Negro: trovões repetidos na área marcada", "Tempestade Dracônica (colossal), Forma Dracônica/Verdadeira"], evolvesTo: "Rei do Caos", tiers: ["black_lightning", "storm_wall", "black_thunder", "draconic_tempest"] },
      { id: "v_chaos", name: "Rei do Caos (Chaos King)", skill: "chaos_king", cls: "supreme", feats: ["Tempestade do Caos: dano devastador em raio 14 com atordoamento curto (2 s) e repulsão; recarga 90 s; não destrói blocos"], evolvesTo: null, tiers: ["chaos_king"] },
    ] },
  { id: "yuuki", who: "Yuuki Kagurazaka", name: "Anti-Skill", cls: "supreme",
    about: "Poder de Yuuki. Ele o usa como chefe (campo que anula/resiste habilidades e sela o lançamento) e o jogador o conquista ao derrotá-lo.",
    stages: [
      { id: "anti_skill", name: "Anti-Skill", skill: "anti_skill", cls: "supreme", feats: ["Aura de 8 s: anula seus efeitos negativos simples, resiste em parte a atordoamento/paralisia", "Remove efeitos positivos de inimigos num raio de 8 (chefes só perdem parte)", "Regras: ANULÁVEL = comum/incomum/rara · PARCIAL = épica/lendária (dano x0,5, sem efeitos) · IMUNE = Única/Suprema/mítica/divina, Dragões Verdadeiros, Primordiais"], evolvesTo: "Criador", gate: { level: 60, boss: "yuuki_kagurazaka" } },
      { id: "creator", name: "Criador", skill: "creator", cls: "supreme", feats: ["Abre a forja: crie habilidades próprias escolhendo FORMA (projétil, raio, cone, explosão, onda, barreira) e ELEMENTO", "5 espaços salvos no personagem: 2 Menores (nv70, 1 pt, 28 mana, recarga 8 s), 2 Maiores (nv80, 2 pts, 50 mana, 16 s) e 1 Suprema (nv90, 3 pts, 85 mana, 40 s)", "As criações vão para a hotbar como habilidades Únicas (imunes à Anti-Skill) e podem ser refeitas pagando os pontos de novo", "Efeitos secundários curtos por elemento (queimadura, lentidão, medo, fraqueza...); sem destruir blocos"], evolvesTo: null, gate: { level: 70, boss: "yuuki_kagurazaka", skill: "anti_skill" } },
    ] },
  { id: "flight", who: "Qualquer (por progressão)", name: "Voo Livre", cls: "unique",
    about: "Passiva de voo por script (não é o voo criativo nativo). Segure pular para decolar/subir, agache para descer, solte tudo para pairar.",
    stages: [
      { id: "free_flight", name: "Voo Livre", skill: "free_flight", cls: "unique", feats: ["Voo sem Elytra, sem custo e sem recarga; funciona em todas as dimensões e reinos", "Sem dano de queda ao pousar; desativação segura em pleno ar"], evolvesTo: null, gate: { level: 50, skill: "teleport" } },
    ] },
];
export const LINE = Object.fromEntries(LINES.map((l) => [l.id, l]));

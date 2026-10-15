// data/characters.js - 6.43: DIÁLOGOS DOS PERSONAGENS IMPORTANTES (interface em systems/characters.js).
// Cada personagem usa SÓ sistemas que já existem: missões (data/quests.js), aulas (data/teachers.js via role de um mestre),
// lojas das nações (data/worldnpcs.js), reputação/flags (systems/factions.js) e conquistas (data/misc.js).
//  where : "council" = Conselho de Tempest | "luminus" = Reino Sagrado (morador de estrutura, systems/residents.js) — ambos calmos, duelo até render-se
//          "veldanava" = Domínio de Veldanava (dimensão própria)
//          "octagrama" = trono do Octagrama (desafio = luta real de chefe)
//  greet : falas de saudação (primeira vez / normal / discípulo / depois de perder para você)
//  talk  : assuntos de conversa [título, fala]
//  quests: missões existentes que este personagem oferece (e a prova de discípulo, se houver)
//  disciple: requisitos para ser discípulo + prova (missão) + aulas liberadas (role = mestre cujas aulas/preço são usados)
//  duel  : nível mínimo para desafiar; recompensa da 1ª vitória (vitórias seguintes valem 25%)
//  shop  : role de uma loja de nação já existente
export const CHARACTERS = {
  rimuru_tempest: {
    name: "Rimuru Tempest", color: "§b", faction: "tempest", where: "council", title: "Lorde de Tempest",
    greet: {
      first: ["Ah, olá! Bem-vindo a Tempest. Aqui todo mundo convive em paz... desde que ninguém comece confusão, tá?"],
      normal: ["E aí, tudo certo? Se precisar de alguma coisa, é só falar.", "Tempest está crescendo bem. Gosto de ver gente nova por aqui.", "Hm? Veio conversar? Fique à vontade."],
      disciple: ["Como vai o treino? Lembre-se: entender o oponente vale mais do que força bruta.", "Meu discípulo! Vamos ver o quanto você evoluiu."],
      rival: ["Você me venceu daquela vez... ainda não acredito. Quer outra rodada?"],
    },
    talk: [
      ["Sobre Tempest", "Tempest é uma nação de monstros que escolheram viver juntos. Goblins, kijins, anões... cada um ajuda do seu jeito. Os guardas e comerciantes daqui têm pedidos para quem quiser ajudar."],
      ["Sobre evolução", "Evoluir não é só ficar mais forte: a raça muda o corpo, as habilidades e até o jeito de lutar. Quando estiver pronto, o menu de Raça mostra o que falta."],
      ["Conselho de combate", "Analise antes de atacar. Use a análise do Grande Sábio, veja a vida e as fraquezas do alvo, e só então gaste mana nas habilidades fortes."],
    ],
    quests: ["tp_leader_defend", "tp_defend_city2", "tp_orc_aftermath", "ch_rimuru_trial"],
    disciple: { lvl: 40, rep: { tempest: 200 }, quest: "tp_leader_defend", trial: "ch_rimuru_trial", role: "tp_mage_master", lessons: ["barrier", "mana_flow", "teleport", "focus_aura", "power_surge"],
      ask: "Você quer aprender comigo? Eu não sou muito de dar aula... mas posso te ensinar a pensar antes de agir. Está disposto a treinar de verdade?",
      yes: "Combinado! Primeiro, uma prova: mostre que consegue proteger Tempest. A missão já está no seu diário.", no: "Sem problema. A porta continua aberta." },
    duel: { lvl: 60, ask: "Um desafio? Hmm... tudo bem, mas não vou pegar leve. Pronto?", start: "Vamos ver o que você tem!", win: "Uau... você é forte mesmo. Eu me rendo — por hoje!", lose: "Foi uma boa luta. Treine mais e volte quando quiser.",
      reward: { xp: 9000, coins: 4000, rep: 60 } },
  },
  benimaru: {
    name: "Benimaru", color: "§c", faction: "tempest", where: "council", title: "Comandante-chefe de Tempest",
    greet: {
      first: ["Sou Benimaru, comandante do exército de Tempest. Se veio em paz, é bem-vindo."],
      normal: ["Os soldados treinam todos os dias. Força sem disciplina não protege ninguém.", "Precisa de algo? Seja direto."],
      disciple: ["Postura firme. Lâmina leve. Repita até o corpo lembrar sozinho.", "Pronto para mais um treino, discípulo?"],
      rival: ["Você me derrotou. Isso não acontece com frequência... respeito."],
    },
    talk: [
      ["Sobre o exército", "O exército de Tempest defende a cidade das ondas de monstros. As missões de defesa do líder da cidade são o melhor lugar para provar seu valor."],
      ["Sobre espadas", "Uma espada longa pede passos largos; uma katana, cortes rápidos. Descubra qual combina com você e domine-a."],
      ["Sobre o fogo", "Chamas descontroladas queimam o próprio usuário. Controle a mana antes de tentar técnicas de fogo maiores."],
    ],
    quests: ["tp_sword_trial", "tp_sword_legend", "ch_benimaru_trial"],
    disciple: { lvl: 20, rep: { tempest: 60 }, quest: "tp_sword_trial", trial: "ch_benimaru_trial", role: "tp_sword_master", lessons: ["sword_flash", "sword_whirl", "sword_charge", "sword_sovereign"],
      ask: "Quer ser meu discípulo? Eu treino soldados, não turistas. Vai aguentar?", yes: "Muito bem. Sua prova está no diário: limpe os arredores e volte inteiro.", no: "Entendo. Volte quando estiver decidido." },
    duel: { lvl: 45, ask: "Quer cruzar espadas comigo? Não me responsabilizo por queimaduras.", start: "Em guarda!", win: "...Rendo-me. Sua técnica é real.", lose: "Ainda falta muito. Mas você tem potencial.",
      reward: { xp: 6000, coins: 2500, rep: 40 } },
  },
  shion: {
    name: "Shion", color: "§5", faction: "tempest", where: "council", title: "Secretária de Rimuru",
    greet: {
      first: ["Sou Shion, secretária do Lorde Rimuru! Se tiver assuntos com ele, fale primeiro comigo."],
      normal: ["Quer provar minha comida? ...Por que essa cara?", "O Lorde Rimuru está ocupado, mas eu posso ajudar!"],
      disciple: ["Força! Mais força! Se o golpe não derrubar, golpeie de novo!", "Meu discípulo chegou! Vamos treinar até cansar!"],
      rival: ["Você me venceu... mas eu treinei desde então! Revanche?"],
    },
    talk: [
      ["Sobre o Lorde Rimuru", "O Lorde Rimuru é o centro de Tempest. Todos aqui o seguem por vontade própria, inclusive eu."],
      ["Sobre combate", "Defender e contra-atacar! Quem aguenta o primeiro golpe e responde na hora sempre vence. Bem... quase sempre."],
      ["Sobre culinária", "A cozinheira da cidade vende refeições que dão bônus. As minhas também dão... algum efeito."],
    ],
    quests: ["tp_guard_patrol", "tp_hobgoblin_nest", "ch_shion_trial"],
    disciple: { lvl: 12, rep: { tempest: 30 }, trial: "ch_shion_trial", role: "tp_combat_master", lessons: ["parry_stance", "evasion_step", "counter_strike"],
      ask: "Você quer ser meu discípulo?! Ótimo! Mas meu treino é pesado. Aceita?", yes: "Perfeito! Primeira tarefa no diário: caçar e trazer ingredientes. Para a minha comida.", no: "Hmpf. Você perdeu uma chance de ouro." },
    duel: { lvl: 35, ask: "Um desafio? Eu adoraria! Só não chore depois.", start: "Lá vou eu!", win: "Ugh... você venceu. Mas foi sorte!", lose: "Hahaha! Treine mais e coma bem!",
      reward: { xp: 4500, coins: 1800, rep: 30 } },
  },
  shuna: {
    name: "Shuna", color: "§d", faction: "tempest", where: "council", title: "Sacerdotisa de Tempest",
    greet: {
      first: ["Seja bem-vindo. Sou Shuna. Cuido dos tecidos, dos rituais e da cozinha de Tempest."],
      normal: ["Que bom vê-lo. Está se alimentando direito?", "Precisa de algo? Tenho alguns itens que podem ajudar na sua jornada."],
      disciple: ["A magia sagrada nasce da calma. Respire fundo e concentre-se.", "Vamos continuar os estudos?"],
      rival: ["Você é realmente forte. Mas tome cuidado para não se ferir à toa."],
    },
    talk: [
      ["Sobre magia sagrada", "Curas e luz sagrada exigem mana e serenidade. Comece com uma cura simples e avance aos poucos."],
      ["Sobre os kijins", "Nós, kijins, evoluímos de ogros. Cada evolução trouxe novas responsabilidades, não só poder."],
      ["Sobre a loja", "Os comerciantes de Tempest vendem poções e materiais. Se precisar, posso mostrar o que temos."],
    ],
    quests: ["tp_healer_herbs", "tp_heal_trial", "ch_shuna_trial"],
    disciple: { lvl: 8, rep: { tempest: 20 }, trial: "ch_shuna_trial", role: "tp_heal_master", lessons: ["heal", "regeneration", "holy_light", "mass_heal"],
      ask: "Deseja estudar comigo? A magia de cura exige paciência. Tem certeza?", yes: "Então começamos. Traga-me cristais de mana; a tarefa está no seu diário.", no: "Tudo bem. Quando quiser, estarei aqui." },
    duel: { lvl: 25, ask: "Um duelo? Eu prefiro não lutar... mas se insiste, aceito. Pronto?", start: "Com licença.", win: "Eu me rendo. Você venceu de forma justa.", lose: "Descanse um pouco. Lutar cansado é perigoso.",
      reward: { xp: 3000, coins: 1200, rep: 25 } },
    shop: "tp_alchemist",
  },
  ranga: {
    name: "Ranga", color: "§9", faction: "tempest", where: "council", title: "Lobo Estelar de Tempest",
    greet: {
      first: ["Grrr... Você cheira a forasteiro. Mas se o Mestre Rimuru permite, eu também permito."],
      normal: ["Auu! Veio brincar? Quer dizer... veio a serviço?", "Eu guardo Tempest pelas sombras. Nada passa por mim."],
      rival: ["Você me venceu... O Mestre vai rir de mim. Grrr."],
    },
    talk: [
      ["Sobre o Mestre Rimuru", "O Mestre Rimuru me deu um nome. Desde então, sou o lobo mais forte de Tempest. Pelo menos eu acho."],
      ["Sobre os lobos", "Os lobos mágicos das planícies não são da minha alcateia. Se atacarem as plantações, pode caçá-los."],
      ["Sobre as sombras", "Eu viajo pelas sombras. Quem luta comigo precisa vigiar as costas."],
    ],
    quests: ["tp_farmer_wolves", "tp_guard_patrol"],
    duel: { lvl: 30, ask: "Um desafio? Auuu! Finalmente! Pronto?", start: "Grrraaaah!", win: "Ganhei... não, espera, você ganhou. Grrr.", lose: "Auu! Treine mais e volte!",
      reward: { xp: 3500, coins: 1400, rep: 25 } },
  },
  tt_hinata: {
    name: "Hinata Sakaguchi", color: "§f", faction: "luminus", where: "luminus", title: "Capitã dos Cavaleiros Sagrados",
    greet: {
      first: ["Sou Hinata Sakaguchi, capitã dos Cavaleiros Sagrados. Enquanto estiver no Reino, respeite as regras da Igreja."],
      normal: ["Os cavaleiros relatam mortos-vivos perto das muralhas. Se quiser ser útil, fale com eles.", "Seja objetivo. Tenho muito a fazer."],
      disciple: ["Postura. Respiração. Cada golpe deve ter um propósito.", "Pronto para o treino de hoje?"],
      rival: ["Você me venceu em duelo. Não vou esquecer isso — nem subestimá-lo de novo."],
    },
    talk: [
      ["Sobre a Igreja", "A Igreja Ocidental protege os fiéis dos monstros que os ameaçam. Pelo menos é isso que ela ensina."],
      ["Sobre técnicas de espada", "Velocidade sem precisão é desperdício. Defenda, observe, e só então contra-ataque."],
      ["Sobre Tempest", "Uma nação de monstros que vive em paz... ainda estou avaliando o que isso significa."],
    ],
    quests: ["lm_patrol", "lm_investigation", "ch_hinata_trial"],
    disciple: { lvl: 35, rep: { luminus: 150 }, quest: "lm_patrol", trial: "ch_hinata_trial", role: "lm_knight", lessons: ["barrier", "evasion_step", "counter_strike", "holy_light", "holy_blade", "wings_of_light"],
      ask: "Quer treinar sob o meu comando? Meus cavaleiros treinam até cair. Está disposto?", yes: "Muito bem. O juramento do cavaleiro está no seu diário. Cumpra-o.", no: "Volte quando estiver certo da sua decisão." },
    duel: { lvl: 50, ask: "Um duelo? Aceito. Mas não espere misericórdia. Pronto?", start: "Em guarda.", win: "...Reconheço a derrota. Você é forte.", lose: "Previsível. Treine mais.",
      reward: { xp: 7000, coins: 3000, rep: 50 } },
  },
  sabio_branco: {
    name: "Sábio Branco", color: "§f", faction: null, where: "veldanava", title: "Guardião da Memória de Veldanava",
    greet: {
      first: ["Você atravessou o portal. Este é o Domínio de Veldanava, longe do mundo que você conhece. Eu guardo as memórias do Rei Dragão Estelar."],
      normal: ["As estrelas daqui não são as do seu céu. Caminhe com cuidado.", "As Constelações guardam este lugar. Elas não perdoam os fracos."],
      rival: ["Você me venceu. A memória de Veldanava registrará isso."],
    },
    talk: [
      ["Sobre Veldanava", "Veldanava foi o primeiro dos Dragões Verdadeiros, aquele que deu forma ao mundo. Este domínio é o que restou da sua memória."],
      ["Sobre este lugar", "Há duas partes: o Palácio Celeste, onde você chegou, e as ruínas do Domínio, do outro lado da ponte de luz. O portal de retorno fica atrás de você."],
      ["Sobre as Constelações", "Cinco Constelações guardam o palácio. Cada uma sentada em seu trono, esperando ser provocada. Derrotá-las é a prova que este domínio exige."],
    ],
    quests: ["vd_echoes", "vd_scribe", "vd_judgement"],
    duel: { lvl: 70, ask: "Testar a memória de Veldanava? Muito bem. Confirma?", start: "Que as estrelas testemunhem.", win: "A memória se curva a você.", lose: "Ainda não. Volte mais forte.",
      reward: { xp: 8000, coins: 3000 } },
  },
  guy_crimson: {
    name: "Guy Crimson", color: "§4", faction: "guy", where: "octagrama", title: "O Lorde Demônio Mais Antigo",
    greet: { first: ["Hah. Um visitante no Octagrama. Ou você é muito corajoso, ou muito tolo."], normal: ["Entediante. Diga logo o que quer.", "Hm. Você de novo."], disciple: ["Meu discípulo. Não me envergonhe."], rival: ["Você me forçou a lutar a sério. Interessante."] },
    talk: [["Sobre o Octagrama", "Oito lordes demônios. Cada trono aqui guarda alguém que pode destruir nações. Escolha bem quem provoca."], ["Sobre poder", "Poder é a única regra que não precisa ser escrita. O resto é conversa."]],
    quests: ["gc_envoy_trial", "ch_guy_trial"],
    disciple: { lvl: 70, rep: { guy: 300 }, quest: "gc_envoy_trial", trial: "ch_guy_trial", role: "gc_master", lessons: ["crimson_authority", "crimson_wave", "overlord_presence"],
      ask: "Você quer aprender com o Lorde Demônio mais antigo? Ridículo... mas divertido. Aceita as consequências?", yes: "Prove que não é um desperdício. Sua prova está no diário.", no: "Sábia decisão." },
    duel: { lvl: 95, ask: "Desafiar a mim? Será sua última decisão. Confirma?", start: "Mostre-me algo que valha o meu tempo." },
  },
  milim_nava: {
    name: "Milim Nava", color: "§d", faction: null, where: "octagrama", title: "A Destruidora",
    greet: { first: ["Wahaha! Alguém novo! Você é forte? Diz que é forte!"], normal: ["Tô entediada! Vamos lutar? Ou comer alguma coisa?", "Ei, ei! Me conta uma aventura!"], rival: ["Você me venceu?! Isso foi DEMAIS! De novo!"] },
    talk: [["Sobre lutar", "Lutar é divertido! Mas eu me empolgo... então se for me desafiar, venha MUITO preparado!"], ["Sobre amigos", "Amigos dividem comida e aventuras. Você tem amigos?"]],
    duel: { lvl: 90, ask: "Uma luta?! Sim sim sim! Mas eu não sei pegar leve, viu? Confirma?", start: "Wahahaha! Lá vou eu!" },
  },
  luminous_valentine: {
    name: "Luminous Valentine", color: "§f", faction: null, where: "octagrama", title: "Rainha dos Vampiros",
    greet: { first: ["Um mortal diante do meu trono. Fale com educação."], normal: ["Seja breve.", "Hm. O que deseja?"], rival: ["Você me feriu. Poucos podem dizer isso."] },
    talk: [["Sobre a noite", "A noite pertence a quem sabe esperar. A luz, a quem sabe governar."], ["Sobre a Igreja", "Há coisas que é melhor não perguntar."]],
    duel: { lvl: 75, ask: "Você ousa me desafiar? Não haverá misericórdia. Confirma?", start: "Ajoelhe-se diante da Rainha." },
  },
  diablo: {
    name: "Diablo", color: "§8", faction: null, where: "octagrama", title: "Primordial Negro",
    greet: { first: ["Kufufufu... um visitante. Que interessante."], normal: ["Em que posso ser útil? Kufufu.", "Hm. Não desperdice meu tempo."], rival: ["Kufufu... você me surpreendeu. Isso é raro."] },
    talk: [["Sobre os Primordiais", "Nós, Primordiais, existimos desde antes das nações. Testarossa, Ultima e Carrera também estão aqui."], ["Sobre lealdade", "Lealdade verdadeira não se compra. Ela se escolhe."]],
    duel: { lvl: 75, ask: "Kufufufu... um desafio? Que divertido. Confirma?", start: "Mostre-me o seu desespero." },
  },
  testarossa: { name: "Testarossa", color: "§c", faction: null, where: "octagrama", title: "Primordial Branca",
    greet: { normal: ["Diplomacia antes da violência. Diga o que quer.", "Seja educado e eu serei também."] }, talk: [["Sobre diplomacia", "Uma palavra bem escolhida vence mais batalhas que uma lâmina."]],
    duel: { lvl: 65, ask: "Um desafio formal? Muito bem. Confirma?", start: "Que seja breve." } },
  ultima: { name: "Ultima", color: "§5", faction: null, where: "octagrama", title: "Primordial Violeta",
    greet: { normal: ["Hehe. Você parece frágil. Quer brincar?", "Está me olhando por quê?"] }, talk: [["Sobre veneno", "Dor e veneno são ferramentas. Eu só uso melhor que os outros."]],
    duel: { lvl: 65, ask: "Uma luta? Eba! Confirma? Não vale fugir depois!", start: "Vamos brincar!" } },
  carrera: { name: "Carrera", color: "§e", faction: null, where: "octagrama", title: "Primordial Amarela",
    greet: { normal: ["Olha só, alguém com coragem. Ou falta de juízo.", "Quer ver uma explosão de verdade?"] }, talk: [["Sobre destruição", "Magia de destruição é simples: mais poder, mais estrago. Hahaha!"]],
    duel: { lvl: 65, ask: "Quer lutar? Até que enfim! Confirma?", start: "Hahaha! Tente sobreviver!" } },
  rain: { name: "Rain", color: "§9", faction: "guy", where: "octagrama", title: "Criada de Guy Crimson",
    greet: { normal: ["Hm? Ah, um visitante. Que trabalho...", "Se for falar com o mestre Guy, fale baixo."] }, talk: [["Sobre o mestre", "Guy Crimson é exigente. Muito exigente. Por isso eu trabalho o mínimo possível."]],
    duel: { lvl: 55, ask: "Lutar comigo? Que preguiça... Tudo bem. Confirma?", start: "Vamos acabar logo com isso." } },
  rimuru_senhor_demonio: { name: "Rimuru Tempest (Lorde Demônio)", color: "§b", faction: "tempest", where: "octagrama", title: "Lorde Demônio",
    greet: { normal: ["No Octagrama sou um lorde demônio. Aqui, as conversas são mais sérias.", "Você veio longe. O que deseja?"] }, talk: [["Sobre ser lorde demônio", "O título trouxe poder e responsabilidade. Tempest depende das decisões que eu tomo aqui."]],
    duel: { lvl: 85, ask: "Desafiar um lorde demônio no próprio trono? Pense bem. Confirma?", start: "Então não vou me conter." } },
  dino: { name: "Dino", color: "§7", faction: null, where: "octagrama", title: "Lorde Demônio Caído",
    greet: { normal: ["Zzz... hm? Ah. Oi.", "Trabalhar? Não, obrigado."] }, talk: [["Sobre anjos caídos", "Já fui um anjo. Hoje prefiro dormir. É bem menos cansativo."]],
    duel: { lvl: 70, ask: "Lutar? Agora? ...Tá, mas depois eu volto a dormir. Confirma?", start: "Hmm. Vamos lá." } },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS);

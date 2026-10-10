# Manual de uso do JARMES

## Visão geral das áreas (barra lateral)
| Área | Para que serve |
|---|---|
| **Painel principal** | Saudação, data/hora, plano de hoje, tempo estudado (só confirmado), próximo compromisso, tarefas prioritárias, pendências, minutos dos últimos 7 dias, revisões e metas. Mostra **sugestões** do JARMES para você aceitar ou recusar. |
| **Chat com o JARMES** | Comandos em linguagem natural e perguntas livres (IA). Ações que alteram a agenda pedem confirmação (botões *Confirmar/Cancelar* ou digite "sim"/"não"). |
| **Assistente de voz** | Botão para falar/parar, transcrição na tela, resposta falada, volume, voz, desativar o microfone. |
| **Central de estudos** | Sessão do dia com cronômetro, pendências, plano/ciclos, flashcards, revisões, caderno de erros, simulados e registro de resultados. |
| **Calendário e agenda** | Compromissos (dia/semana/mês), recorrência, lembretes, conflitos. |
| **Gerenciador de tarefas** | Tarefas com prioridade/prazo/recorrência/lembrete, histórico de atrasos, metas pessoais. |
| **Arquivos e documentos** | Arraste ou importe PDF/DOCX/TXT/MD/imagem; busque; resumo, flashcards, mapa mental, temas. |
| **Integrações externas** | Estado real de IA, Google Drive, QConcursos, voz e OCR; conectar/testar. |
| **Notícias jurídicas e concursos** | Notícias dos feeds cadastrados (com fonte, data, link, verificação), fontes, concursos acompanhados. |
| **Relatórios de desempenho** | Relatório diário e semanal, gráficos, exportação em texto. |
| **Configurações** | Perfil, notificações, IA, voz, Google, sistema/dados, memória. |
| **Central de notificações** | Histórico de avisos e como habilitar as notificações do Windows. |

## A sessão de estudos (regras que o JARMES respeita)
1. **Iniciar plano hoje** (Central de estudos → Plano e ciclos) define o primeiro dia contado.
2. Em dias de estudo existe uma sessão planejada (padrão: 2 h às 06:00: lei seca 15′ + teoria 60′ + questões 30′ + revisão 15′).
3. **Iniciar** liga o cronômetro; **Pausar** não conta como estudo; os blocos avançam sozinhos pelo tempo, com aviso.
4. **Encerrar cronômetro** NÃO conclui a sessão: abre o **check-out**, onde *você* marca o que cumpriu, informa o tempo efetivo,
   questões/acertos e dificuldade. Nada vem marcado por padrão.
   * todos os blocos marcados → *concluída*; alguns → *parcial*; nenhum → continua *pendente*.
5. Dia que passou sem registro vira **pendência** e fica visível até você **recuperar**, **reagendar** ou **dispensar**.
   A recuperação sempre oferece 3 opções (hoje se houver janela livre, próximo horário livre, sessão reduzida de 30 min)
   e nunca empilha tudo no dia seguinte (uma recuperação por dia).
6. Ao confirmar uma sessão, o JARMES programa revisões D+1, D+7 e D+30 do assunto.
7. **A carga horária nunca aumenta sozinha.** Se nas últimas 2 semanas você cumprir ≥ 85 % das sessões (e acertar ≥ 65 %), aparece uma
   *proposta* no Painel (ex.: 120 → 135 min) com a explicação; você aceita ou recusa. Recusou: ele não insiste por 21 dias.
8. **Troca de ciclo** também é só proposta: ao marcar "aulas concluídas" das 5 matérias-base (Ciclo 1 → 2) ou quando a prova
   estiver a ≤ 60 dias (→ Ciclo 3).

### Ciclos (padrão, editáveis na configuração `cycle_templates`)
* **Ciclo 1 — Base:** Seg Constitucional · Ter Administrativo · Qua Civil · Qui Penal · Sex Proc. Civil ·
  Sáb Direitos Humanos (semana ímpar) / Filosofia-Sociologia-Psicologia (par) · Dom revisão de erros + mini-simulado.
* **Ciclo 2 — Expansão:** Empresarial · Consumidor · ECA · Digital · Estatutos (idoso/PcD) · Urbanístico/Penal Militar · Dom simulado.
* **Ciclo 3 — Reta final:** foco em questões (60 min), súmulas/informativos, caderno de erros, simulado cronometrado aos sábados.
* "Lei seca" é um **rótulo do que ler**; o JARMES não inventa números de artigos.

## Notificações (enquanto o JARMES estiver aberto/na bandeja)
* Compromissos (X min antes), lembretes de tarefa, **sequência de estudo** (15 min antes, no horário, +10 min, +30 min → "pendente"),
  fechamento do dia, pendências, tarefas atrasadas, revisões, sequência de dias, relatório semanal, sugestões, notícias relevantes (opcional).
* Sem repetição (cada aviso tem chave única), com **horário de silêncio** (22:30–05:00), **pausa** (1 h / até amanhã) e
  **limite diário** de "cutucadas" conforme a intensidade (leve 3 · normal 6 · intensa 10).
* Se as notificações do Windows estiverem desligadas, o aviso fica na Central de notificações e há instruções para ligá-las.

## Comandos que funcionam (texto ou voz)
Prefixar com "JARMES," é opcional.
* `bom dia` — saudação com dados reais (sessão de hoje, pendências, tarefas atrasadas, próximo compromisso).
* `iniciar sessão de estudos` · `quais matérias estão atrasadas?` · `organize meu dia`
* `organize meus estudos de amanhã e reserve duas horas para Direito Constitucional e Direito Penal` → mostra a proposta, avisa
  conflitos e **só cria na agenda após "sim"**.
* `crie uma tarefa: revisar processo civil amanhã às 15h` · `marque compromisso dentista dia 20 às 14h` (avisa conflito)
* `registre que estudei 2 horas de Direito Penal, 20 questões, 15 acertos` (registro informado por você; resolve a pendência do dia se for a mesma disciplina)
* `mostre meu desempenho da semana` · `relatório de hoje` · `programe uma revisão de Direito Penal para amanhã`
* `abra meus materiais de Direito Penal` · `faça um resumo deste PDF` (IA se autorizada; senão resumo extrativo local)
* `crie dez perguntas sobre direitos humanos` (**exige IA**; senão explica a limitação e oferece alternativas locais)
* `quais concursos jurídicos tiveram atualizações oficiais?` (só do que os feeds oficiais cadastrados já trouxeram)
* `anote que prefiro estudar cedo` · `esqueça a memória <trecho>` (pede confirmação) · `limpar histórico de conversa` (pede confirmação)
* Qualquer outra frase vai para a IA (se configurada); sem IA, o JARMES busca nos seus documentos e explica a limitação.

## Voz
1. *Configurações → Voz*: escolha o reconhecimento — **Vosk** (offline; instale `vosk` e baixe um modelo pt-BR) ou **remoto** (API compatível com OpenAI; envia o áudio — pede autorização).
2. Em *Assistente de voz*, clique **Falar / Parar**. Uma faixa vermelha **"● MICROFONE ATIVO"** aparece em todas as telas enquanto houver captura.
3. O áudio temporário é apagado após a transcrição. Nada é gravado continuamente. Desmarque *Microfone habilitado* para desativar tudo.
4. A resposta é falada com as vozes do Windows (escolha pt-BR em *Voz*; ajuste o volume).

## Documentos
* **Formatos:** PDF, DOCX, TXT, MD, PNG/JPG/TIFF/BMP/WEBP (imagens e PDF digitalizado precisam de OCR).
* Cada arquivo é validado (extensão, tamanho ≤ 100 MB, assinatura real, DOCX sem bomba de compressão). O original nunca é alterado; uma cópia fica em `%APPDATA%\JARMES\documentos`.
* O estado de leitura é mostrado: ✔ integral · ◐ parcial (com o motivo, ex.: "3 de 40 páginas sem texto — provável digitalização") · ✖ ilegível.
* **Busca** em todos os documentos mostra o arquivo e a **página/trecho** de origem. Resumo local = frases do próprio texto (não é paráfrase).
  Flashcards locais são heurísticos — revise antes de usar.
* Enviar trechos a uma IA externa só ocorre com **sua autorização** (*Configurações → IA*), e o conteúdo vai marcado como **dado não confiável**.

## Memória
*Configurações → Memória* lista tudo que o JARMES guarda (preferências permanentes, assunto atual, histórico, extraído de documento). Você edita, adiciona ou exclui.

## Privacidade e dados
* Tudo fica em `%APPDATA%\JARMES`. *Exportar meus dados* gera JSON + CSV (sem chaves). *Apagar todas as informações* exige digitar APAGAR e faz backup antes.
* Backups automáticos diários (14 mais recentes). Banco corrompido é recuperado do último backup válido ao abrir.
* Logs em `logs\jarmes.log`, com chaves/tokens removidos.

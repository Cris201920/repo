# JARMES — assistente pessoal de estudos jurídicos e rotina (desktop)

Aplicativo **desktop** (Python + PySide6 + SQLite) inspirado em assistentes de ficção científica, feito para o Cristiano
organizar a rotina e acompanhar os estudos de Direito (faculdade, concursos, magistratura e ENAM).
Janela própria, tema escuro "central de comando", dados 100 % locais por padrão.

> **Princípio de projeto — honestidade.** O JARMES só afirma o que realmente verificou ou executou. Nada de números
> fictícios, nada de "conectado" sem estar, nenhuma sessão de estudo marcada como concluída sem a sua confirmação.

## Estado atual (v0.1.0)

Testado = coberto por teste automatizado executado (140 testes, todos passando). Veja [docs/TESTES.md](docs/TESTES.md).

| Área | Estado |
|---|---|
| Janela desktop, 12 áreas de navegação, tema escuro, layout adaptável, bandeja do sistema | Implementado e testado (headless) |
| Banco SQLite local, migrações versionadas, backup automático/manual, recuperação de banco corrompido, exportar/apagar dados | Implementado e testado |
| Tarefas (prioridade, prazo, recorrência, lembrete, reagendar, histórico de atrasos), metas | Implementado e testado |
| Calendário (dia/semana/mês), compromissos recorrentes, conflitos, janelas livres | Implementado e testado |
| Central de estudos: ciclos 1/2/3, sessão matinal de 2 h configurável, cronômetro com pausa, check-out, pendências, recuperação em 3 opções, propostas de carga | Implementado e testado |
| Revisão espaçada (D+1/D+7/D+30), flashcards (SM-2), caderno de erros, simulado cronometrado, banco de questões | Implementado e testado |
| Relatórios diário/semanal só com dados reais ("não registrado" quando falta dado), gráficos | Implementado e testado |
| Notificações: central, deduplicação, horário de silêncio, pausa, limite diário, escalonamento de estudo | Implementado e testado; **toast nativo do Windows não testado no Windows** |
| Documentos: PDF, DOCX, TXT, MD, imagens; validação; busca FTS5 com página; resumo/flashcards/mapa/temas **locais**; OCR | Implementado e testado (OCR testado com Tesseract real em Linux) |
| Comandos em linguagem natural (texto e voz) com confirmação para ações sensíveis | Implementado e testado |
| IA conversacional (Anthropic ou API compatível com OpenAI) | Implementado e testado **contra servidor simulado**; precisa da sua chave; **não testado com provedor real** |
| Voz: gravar/transcrever/falar, indicador de microfone, volume, voz | Lógica e interface testadas; **microfone e fala reais não puderam ser testados** (ambiente sem áudio) |
| Google Drive (OAuth 2.0 + PKCE, somente leitura) | Implementado e testado **contra servidor simulado**; exige credenciais suas; **não testado com o Google real** |
| QConcursos | **Modo manual** (abrir site, registrar resultado, importar CSV). Não há API pública oficial verificada |
| Notícias (RSS/Atom) | Implementado e testado com feeds simulados; **os endereços de feed pré-cadastrados não foram verificados** (rede bloqueada no ambiente de desenvolvimento) |
| Empacotamento | Spec do PyInstaller validada gerando e executando um build **Linux**. O `.exe` do Windows precisa ser gerado **no seu Windows** (`scripts\build_exe.ps1`) |

O que ficou de fora de propósito ou ainda não existe está em [Limitações conhecidas](#limitações-conhecidas).

## Instalar e executar (Windows)

```powershell
# 1) Python 3.10–3.13 de python.org (com o "py launcher")
# 2) Na pasta do projeto:
powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -Shortcut
# 3) Abrir:
iniciar_jarmes.bat
```

Detalhes, configuração de chaves, início com o Windows e geração do `.exe`: [docs/INSTALACAO.md](docs/INSTALACAO.md).
Uso diário: [docs/MANUAL.md](docs/MANUAL.md). Integrações: [docs/INTEGRACOES.md](docs/INTEGRACOES.md).

Em Linux/macOS (desenvolvimento): `scripts/install.sh` e `scripts/run.sh`.

## Estrutura

```
jarmes/
├─ run_jarmes.py            executa a partir do código-fonte
├─ iniciar_jarmes.bat       atalho de execução no Windows (sem console)
├─ jarmes.spec              receita do PyInstaller (executável)
├─ requirements*.txt  pyproject.toml  .env.example
├─ scripts/                 install.ps1  build_exe.ps1  installer.iss  make_icon.py  *.sh
├─ docs/                    INSTALACAO  MANUAL  INTEGRACOES  ARQUITETURA  TESTES
├─ src/jarmes/
│  ├─ app.py  app_context.py  config.py  security.py  logging_setup.py  clock.py
│  ├─ db/            SQLite + migrações + backup/recuperação
│  ├─ core/          tarefas, agenda, estudos, revisões, notificações, agendador, relatórios, comandos, memória
│  ├─ ai/            provedores (Anthropic/OpenAI-compatível) e montagem segura de contexto
│  ├─ docs/          extração (PDF/DOCX/TXT/MD/OCR), busca, análises locais
│  ├─ integrations/  Google Drive, QConcursos (manual), notícias RSS, estado das integrações
│  ├─ voice/         gravação, reconhecimento (Vosk local / remoto), síntese de voz, controlador
│  ├─ system/        início com o Windows
│  └─ ui/            tema, widgets, janela principal e 12 páginas
└─ tests/             140 testes (pytest)
```

## Limitações conhecidas

* **Notificações só funcionam com o JARMES em execução** (janela aberta ou ícone na bandeja). Fechado de verdade, nada avisa.
  Ative "Minimizar para a bandeja ao fechar" e, se quiser, "Iniciar com o Windows".
* **Sem pesquisa na web.** A IA não navega: respostas jurídicas livres são explicação didática, sem fonte externa.
  Para legislação/jurisprudência vigente confira Planalto, STF e STJ. Notícias vêm apenas dos feeds que você cadastrar.
* **Perguntas livres, questões e resumos por IA exigem provedor configurado.** Sem ele, o JARMES diz isso e mantém os
  recursos locais (resumo extrativo, flashcards heurísticos, busca nos documentos).
* **Voz:** não há palavra de ativação (somente botão, por privacidade). Reconhecimento exige Vosk (offline) ou serviço remoto.
* **Google Drive:** no modo "Teste" do Google Cloud, a autorização expira em ~7 dias (reconecte).
* **QConcursos:** sem integração automática. É por registro manual ou CSV.
* **Windows não foi testado por mim** (o ambiente de desenvolvimento é Linux). A lógica é multiplataforma e a interface foi
  validada em modo headless, mas o primeiro uso no Windows pode revelar ajustes de aparência/áudio/toast.
* Calendário em modo "dia/semana/mês" é uma lista + calendário mensal (não há grade de horas arrastável).
* Restaurar backup é aplicado na próxima abertura do programa.

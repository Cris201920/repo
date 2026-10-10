# Arquitetura

## Escolhas e por quê
| Decisão | Motivo |
|---|---|
| **Python 3.10–3.13 + PySide6 (Qt 6)** | App desktop nativo com janela própria, bandeja, notificações, áudio (Qt Multimedia) e TTS (Qt TextToSpeech) sem Electron; empacotável com PyInstaller. |
| **SQLite (stdlib) + FTS5** | Zero instalação, arquivo único fácil de copiar/exportar, busca de texto completo nos documentos. Migrações por `PRAGMA user_version`. |
| **HTTP com `urllib`** (sem SDKs) | Menos dependências; os provedores de IA, Drive e feeds usam endpoints REST simples. |
| **Regras locais para comandos; IA só devolve texto** | Segurança: a IA nunca dispara ações. Comandos são reconhecidos por regras determinísticas e ações sensíveis pedem confirmação. |
| **`cryptography` (Fernet) para segredos** | Chaves/tokens nunca ficam em tabelas comuns, no código ou nos logs. |
| **Relógio injetável (`clock.py`)** | Testes determinísticos de agendamento, pendências e relatórios. |

## Camadas
```
ui/  (PySide6)  ──►  core/ + docs/ + integrations/ + voice/ + ai/   ──►  db/ (SQLite)
   páginas finas        regras de negócio testáveis SEM interface
```
`AppContext` (`app_context.py`) compõe todos os serviços; a interface e os testes usam o mesmo contêiner.

| Pacote | Responsabilidade |
|---|---|
| `db/` | `Database` (conexão, transações, backup, recuperação), `migrations.py` (esquema v1–v2). |
| `core/settings.py` | Configurações tipadas com validação (`SettingsError`) e padrões (inclui os modelos de ciclo). |
| `core/tasks.py` `calendar.py` `goals.py` | Tarefas/recorrência/histórico de atrasos; agenda/conflitos/janelas livres; metas com progresso real. |
| `core/study.py` | Plano por ciclo, sessões e cronômetro, check-out, pendências, recuperação, propostas, consistência. |
| `core/reviews.py` | Flashcards (SM-2), revisões D+1/7/30, caderno de erros. |
| `core/notifications.py` `scheduler.py` | Política de entrega (silêncio/pausa/limite), deduplicação, geração dos avisos a cada *tick* de 30 s. |
| `core/commands.py` `nlp.py` | Interpretação de pedidos em pt-BR (datas, horas, durações, disciplinas) e execução com confirmação. |
| `core/reports.py` `greeting.py` `export.py` `memory.py` | Relatórios "só dados reais", saudação, exportar/apagar, memória e histórico de conversa. |
| `ai/` | `AIClient` (Anthropic / OpenAI-compatível) e `Assistant` (monta contexto real e isola documentos). |
| `docs/` | Validação e extração (pypdf, python-docx, OCR), busca FTS5, análises locais (resumo extrativo, temas, cloze, esboço). |
| `integrations/` | Google Drive (OAuth+PKCE), QConcursos (manual), notícias RSS/Atom, gerenciador de estado. |
| `voice/` | Gravação (QAudioSource → WAV 16 kHz mono), STT (Vosk/remoto), TTS, `VoiceController` (idle→listening→processing→speaking). |
| `ui/` | Tema QSS, ícones SVG, widgets (anel de progresso, barras, pulso), `MainWindow` + 12 páginas. |

## Modelo de dados (resumo)
`settings` · `tasks`/`task_log` · `events` · `disciplines` · `study_sessions` (status: planned, running, paused,
**awaiting_confirmation**, completed, partial, missed, rescheduled, dismissed) · `question_results` · `reviews` · `flashcards` ·
`error_notebook` · `question_bank` · `goals` · `memories` · `messages` · `notifications` (`dedupe_key` único) · `documents` ·
`doc_chunks` + `doc_fts` (FTS5) · `doc_derived` · `news_sources` · `news_items` · `contests` · `integrations` · `proposals` · `backups_log`.
Segredos **não** estão no banco (`secrets.enc`).

## Segurança e privacidade (o que está implementado)
* Chaves/tokens: Fernet em `secrets.enc`; chave mestra em `keyring` (se instalado) ou `secret.key` (0600). Variáveis `JARMES_*` têm prioridade e não são gravadas.
* `.env`, `*.key`, `secrets.enc`, `data/`, `backups/`, `logs/` no `.gitignore`.
* Logs com redação de chaves/tokens/Bearer/`?key=`; mensagens de erro de rede/IA nunca ecoam a chave (testado).
* Importação: lista branca de extensões, limite de tamanho, checagem de assinatura, DOCX sem bomba de compressão, texto binário recusado, original intocado.
* Busca FTS com consulta parametrizada e tokens escapados; SQL sempre parametrizado.
* Feeds: DTD/entidades recusadas (XXE / "billion laughs"); só links `http(s)` são aceitos.
* IA: conteúdo de documentos/memórias em blocos `<documento>`/`<memoria>` declarados como **dados não confiáveis**; fecha-tags neutralizadas; a resposta é só texto;
  envio de documentos exige consentimento explícito; sem ferramentas de terminal/arquivos.
* Voz: microfone só por clique, faixa vermelha visível, áudio temporário apagado, serviço remoto só com consentimento, interruptor geral.
* OAuth Google: PKCE (S256), `state`, escopo mínimo (readonly), revogação ao desconectar.
* Instância única (`QLockFile`) e `excepthook` registrando exceções sem derrubar o app.

## Extensão
* Novo comando: adicione uma rota em `CommandProcessor._routes` (função `(t, raw) -> Reply | None`).
* Novo provedor de IA: ramo em `AIClient.chat`.
* Nova notificação: método `_algo(now)` no `Scheduler` com `dedupe_key`.
* Nova migração: acrescente `(versão, descrição, SQL)` ao final de `MIGRATIONS` (nunca edite as antigas).

# Testes e resultados registrados

## Como executar
```bash
pip install -r requirements.txt pytest
QT_QPA_PLATFORM=offscreen python -m pytest          # Linux/macOS
$env:QT_QPA_PLATFORM="offscreen"; .venv\Scripts\python -m pytest   # Windows (PowerShell)
```
Os testes de OCR rodam só se o Tesseract estiver instalado (senão são ignorados e o teste "sem OCR" cobre o caminho alternativo).

## Resultado da última execução (Linux, Python 3.13, PySide6 6.12, Tesseract 5.3.4)
**140 testes — 140 aprovados, 0 falhas, 0 ignorados (~23 s).**

| Arquivo | Testes | O que verifica |
|---|---:|---|
| `test_database.py` | 5 | Migrações, persistência após fechar/reabrir, backup com rotação, **recuperação de banco corrompido** a partir do backup, rollback de migração com erro |
| `test_tasks_calendar.py` | 7 | Ciclo de vida da tarefa, validações, recorrência, atrasos/reagendamento/histórico, agenda recorrente, conflitos, janelas livres |
| `test_study.py` | 17 | Plano por ciclo e paridade de semana, escala dos blocos, **cronômetro com pausa (tempo efetivo)**, **nunca concluir sem confirmação**, check-out (concluída/parcial/pendente), pendências persistentes, recuperação em 3 opções sem empilhar, sessão abandonada, **propostas (carga/ciclo) que nunca se aplicam sozinhas**, sequência, registro manual que resolve a pendência |
| `test_reviews_reports.py` | 7 | SM-2, revisões D+1/7/30, caderno de erros, **relatórios com "não registrado"**, amostra mínima para "assuntos difíceis", metas, memória (CRUD/relevância) |
| `test_notifications.py` | 9 | Lembrete de compromisso e de tarefa (uma só vez), **escalonamento 15 min/hora/+10/+30**, nada após iniciar, intensidade leve, fechamento do dia, pendências + limite diário, modos de entrega (silêncio/pausa/desativado), relatório semanal |
| `test_documents.py` | 18 | Importar PDF (páginas e busca), duplicados, PDF digitalizado ilegível, DOCX, resumo/flashcards/mapa/temas locais, exclusão total, **validação (executável disfarçado, PDF/DOCX falsos, vazio, binário, tamanho, zip sem documento)**, busca resistente a injeção, original intocado, **OCR real** de imagem e de PDF digitalizado |
| `test_security.py` | 8 | Segredos criptografados em disco, variável de ambiente sem persistir, permissões 0600, chave perdida sem travar, apagar, redação de logs, **segredo ausente do banco e da exportação** |
| `test_integrations.py` | 23 | RSS/Atom, **recusa de XXE**, classificação, atualização sem duplicar, datas ausentes não inventadas, falhas reportadas, notícia antiga sinalizada, notificação só de relevantes; **Drive: fluxo OAuth completo contra servidor simulado (PKCE, state, tokens criptografados, listar, baixar, refresh, revogar)**, negação/estado inválido; **IA: payloads Anthropic/OpenAI, erros 401/404/429/500, sem rede, sem vazar a chave, contexto real e documentos cercados, consentimento**; QConcursos manual/CSV |
| `test_commands.py` | 21 | Parsers pt-BR, "organize meus estudos…" com confirmação, cancelamento, conflitos, tarefa/compromisso por texto, iniciar sessão, atrasadas, registro por comando, perguntas sem IA (nada inventado) e com IA (rotuladas), busca local, resumo local, concursos sem dados, memória/histórico com confirmação, saudação com dados reais, erro interno sem derrubar |
| `test_misc.py` | 10 | `.env`, exportar/apagar/backup diário, conversão de áudio, STT (estado/consentimento/multipart/erros), início com o Windows (registro simulado), estados honestos das integrações |
| `test_ui.py` | 15 | **12 páginas renderizam**, painel só com dados reais, chat→comando→confirmação por botões, fluxo de sessão na UI, entrega de notificações/silêncio, **indicador de microfone e desativação**, voz sem motor/sem microfone, pipeline de voz por texto, salvar configurações, documentos (importar/buscar/excluir), layout estreito |

## Outras verificações realmente executadas
* **Interface inspecionada visualmente** (capturas offscreen de todas as páginas, com e sem dados) e corrigida (cartões, calendário, chips, quebras de linha).
* **Build congelado**: `pyinstaller jarmes.spec` gerou um binário **Linux** (~290 MB) e `./JARMES --smoke-test` renderizou as 12 páginas.
* **Instância única** e laço principal por ~8 s sem exceções (modo `--minimized`).

## NÃO testado (e por quê)
| Item | Motivo / como testar |
|---|---|
| Qualquer execução **no Windows** (janela, toast nativo, bandeja, início com o Windows, `.exe`, instalador) | Ambiente de desenvolvimento é Linux. Siga `docs/INSTALACAO.md`; `scripts\install.ps1 -Tests` roda os testes no seu PC. |
| **Microfone e fala reais** (captura, Vosk, TTS) | Sem dispositivo de áudio/vozes no ambiente. A lógica e os erros foram testados; a captura real não. |
| **IA com provedor real** | Sem chave; testado contra servidor simulado com os formatos oficiais. Use *Testar conexão*. |
| **Google Drive real** | Exige credenciais suas; testado contra servidor simulado. |
| **Feeds reais de notícias** | Rede bloqueada para esses domínios; testado com feeds simulados. Os 3 endereços pré-cadastrados são tentativas. |
| OCR no Windows, Vosk com modelo pt-BR | Dependem de instalação local. |

# Integrações e o que você precisa configurar

O estado de cada uma aparece em **Integrações externas** (e nos indicadores do topo). Sem configuração, o resto do JARMES continua funcionando.

## 1. Inteligência artificial (conversa, perguntas, questões, resumos com IA)
Escolha **um** provedor.

**Anthropic (Claude)** — crie uma chave em <https://console.anthropic.com/> (conta e créditos próprios).
**OpenAI ou compatível** — chave em <https://platform.openai.com/> ou use um servidor compatível (Ollama local, OpenRouter...).

Configuração (qualquer uma):
* *Configurações → Inteligência artificial*: provedor, modelo (vazio = padrão: `claude-sonnet-5-5` / `gpt-4o-mini`), endereço da API (vazio = oficial), chave → **Salvar**.
* ou no `.env`: `JARMES_AI_PROVIDER=anthropic`, `JARMES_AI_API_KEY=...`, `JARMES_AI_MODEL=...`.

Teste: *Integrações externas → Inteligência artificial → Testar conexão*. Erros 401/404/429 e falta de internet têm mensagens claras.
Para **Ollama** (offline): provedor *OpenAI ou compatível*, endereço `http://localhost:11434/v1`, modelo que você baixou, chave vazia.

Autorização separada: *"Autorizo enviar TRECHOS dos meus documentos…"*. Sem ela, nenhum texto de documento sai do computador.

## 2. Google Drive (OAuth 2.0, somente leitura)
Você cria suas próprias credenciais (o JARMES não traz chaves embutidas):
1. <https://console.cloud.google.com/> → crie um projeto.
2. *APIs e serviços → Biblioteca* → ative **Google Drive API**.
3. *Tela de permissão OAuth* → tipo **Externo** → preencha o básico → em *Usuários de teste* adicione o seu e-mail.
4. *Credenciais → Criar credenciais → ID do cliente OAuth* → tipo **App para computador**.
5. Copie *ID do cliente* e *Segredo* para *Configurações → Google Drive* (ou `JARMES_GOOGLE_CLIENT_ID/SECRET` no `.env`).
6. *Integrações externas → Conectar conta Google*. O navegador abre; autorize. Escopo pedido: `drive.readonly`.

Observações honestas: o escopo `drive.readonly` é "restrito" no Google — para uso pessoal em modo *Teste* funciona, mas a autorização expira em ~7 dias
(reconecte). Fluxo usa PKCE e `127.0.0.1`; tokens ficam criptografados; **Desconectar e revogar** apaga e revoga no Google.
O Drive nunca é alterado; os arquivos escolhidos são **copiados** para o JARMES (Google Docs/Slides são exportados como PDF).

## 3. QConcursos
Não foi encontrada API pública oficial nem termos que autorizem automação (<https://www.qconcursos.com/termos-de-uso>).
Por isso o JARMES **não faz login, não usa scraping e não pede sua senha**. Você pode:
* abrir o site no navegador (botão), resolver as questões e **registrar** o resultado (disciplina, assunto, total, acertos);
* **importar um CSV** que você mesmo montar/exportar, com colunas `data;disciplina;assunto;total;acertos` (ou `erros` no lugar de `acertos`). Linhas inválidas são ignoradas e listadas.
Se a QConcursos oferecer uma integração oficial no futuro, o módulo `integrations/qconcursos.py` é o ponto de extensão.

## 4. Notícias jurídicas e concursos (feeds RSS/Atom)
O JARMES só mostra o que um feed **realmente devolveu**, com fonte, data de publicação (ou "data não informada pela fonte"), link original, categoria e
o selo de verificação (*fonte oficial* ou *não oficial*). Publicações antigas são sinalizadas.
* Fontes pré-cadastradas: STF, STJ, CNJ, TST, CNMP, Câmara, Senado, Planalto, INEP, DOU, DPU, MPF, TJMS. **Três têm endereço de feed de tentativa
  (STF, STJ, CNJ) que não pude testar** (rede bloqueada no ambiente onde desenvolvi); as demais estão sem feed.
* Em *Notícias → Fontes e agendamento*, use **Definir endereço do feed** (procure o link "RSS" no rodapé do site do órgão) e **Atualizar agora**: o resultado de cada fonte (sucesso ou erro) aparece na tabela.
* Atualização programada opcional (30 min a 12 h; só com o app aberto) e alertas apenas para palavras-chave que você escolher.
* **Concursos acompanhados:** cadastro manual com data da verificação e fonte. "Não confirmado" é um estado válido; previsões/boatos não viram "inscrições abertas".
* O JARMES **não** faz scraping de páginas; para sites sem feed, abra o link do órgão.

## 5. Voz
* **Fala (JARMES falando):** usa as vozes instaladas no Windows (Qt TextToSpeech). Instale vozes em português em *Configurações do Windows → Hora e idioma → Fala*.
* **Reconhecimento local (offline) — Vosk:** `pip install vosk`; baixe um modelo em português em <https://alphacephei.com/vosk/models>, descompacte e
  aponte a pasta em *Configurações → Voz*. (Confira o nome/tamanho atuais do modelo no site.)
* **Reconhecimento remoto:** API compatível com OpenAI (`/audio/transcriptions`, modelo `whisper-1`). Envia o áudio gravado ao provedor; pede sua autorização
  na primeira vez. Usa a chave de voz ou, se vazia, a chave de IA.

## 6. OCR (imagens e PDFs digitalizados)
Opcional. Instale o **Tesseract para Windows** (<https://github.com/UB-Mannheim/tesseract/wiki>) marcando o idioma *Portuguese* e o *PATH*,
depois `pip install pytesseract Pillow` no ambiente do JARMES. Resultado de OCR é sempre rotulado ("confira possíveis erros").

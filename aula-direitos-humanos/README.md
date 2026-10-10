# Aula em vídeo — Direitos Humanos

Vídeo de aula (MP4, 1920×1080, 24 fps, legendas queimadas + SRT) gerado **por código** a partir de um storyboard único.

## O que foi produzido (pasta `out/`)
| Arquivo | O que é |
|---|---|
| `aula_direitos_humanos.mp4` | **Vídeo final** com narração, legendas com termos em destaque, animações e trilha instrumental discreta |
| `aula_direitos_humanos.srt` | Legendas separadas (idênticas à narração) |
| `roteiro.md` | Roteiro/storyboard: tempo de cada cena, narração, textos de tela e direção de animação |
| `narracao.txt` | Texto integral da narração |
| `QA.md` | Revisão final automatizada (cobertura de conteúdo, ortografia, legendas, sincronia, áudio, imagem) |
| `contact_sheet.jpg` | Mosaico com um quadro de cada cena |

## Estrutura da aula (conforme o pedido)
Abertura → Bloco 1 Conceito → Bloco 2 Estrutura (pretensão, liberdade, poder, imunidade + recapitulação) → Bloco 3 Cumprimento
(subjetivo, objetivo e comparação) → Bloco 4 Conteúdo → Bloco 5 Fundamentalidade formal × material → Bloco 6 Marcas distintivas
(4 cartões + tela final) → Bloco 7 Consequências (direito a ter direitos; convivência e colisão) → Quadro de revisão final →
Revisão ativa (5 perguntas com pausa para pensar e resposta na tela) → Mensagem motivadora.

## Limitações — leia antes de usar
* **A voz é sintética e robótica.** O ambiente de produção só tinha o sintetizador espeak-ng com voz brasileira MBROLA (sem acesso a serviços de voz neural).
  O pedido era uma voz natural: **isso não foi atendido**. Tempo, legendas e animações já estão sincronizados com a fala real, então você pode trocar apenas a voz:
  grave (ou gere com um TTS neural) um WAV por trecho e rode `python gerar_video.py --wav-dir MINHA_PASTA` — os nomes dos arquivos seguem `<cena>_<n>.wav`
  (veja `roteiro.md`/`storyboard.py`: ex. `s01_0.wav` é a primeira frase da cena `s01`). Os tempos de tela se ajustam automaticamente às novas durações.
* **Duração: 7 min 38 s**, acima dos 4–6 min desejados. O pedido autoriza ajustar a duração para explicar todo o conteúdo obrigatório sem acelerar a narração;
  cortar para 6 min exigiria falar mais rápido ou omitir conteúdo. (Dá para encurtar editando as frases em `storyboard.py`.)
* **Naturalidade da voz e “pronúncia natural” não puderam ser avaliadas por ouvido** (não há áudio no ambiente). A tabela de fonemas em `QA.md` ajuda a localizar leituras estranhas.
* Os recursos visuais são **desenhos vetoriais gerados por código** (balança, livros, tribunal, Constituição, tratado, silhuetas, setas); não há fotografias nem animações complexas.
  A trilha é um pad ambiente sintetizado (original, sem direitos autorais).
* O exemplo do direito-imunidade (cláusulas pétreas: o poder de reformar a Constituição não pode abolir direitos e garantias individuais) e os exemplos do Bloco 3
  (saúde/educação pelo Estado, dignidade no trabalho pelo empregador, meio ambiente por Estado e coletividade; vagas em escola e não censura prévia) são **ilustrações didáticas
  minhas**, marcadas como “exemplo” na tela; confira se condizem com o seu material antes de publicar.

## Como gerar de novo
Requisitos: Python 3, `pip install pillow numpy`, `ffmpeg`, `espeak-ng` + `mbrola` + `mbrola-br1`, fontes Inter e Caladea (ou DejaVu como alternativa) e, para o QA, `hunspell hunspell-pt-br`.
```bash
python gerar_video.py --preview     # só imagens de cada cena (out/preview) — rápido, para ajustar o layout
python gerar_video.py               # narração + legendas + trilha + vídeo (≈ 5 min)
python gerar_video.py --speed 150   # fala mais lenta
python qa.py                        # revisão final -> out/QA.md
```
Arquivos: `storyboard.py` (conteúdo: narração, textos, animações), `engine.py` (desenho, animação, legendas, áudio), `gerar_video.py` (montagem), `qa.py` (revisão).

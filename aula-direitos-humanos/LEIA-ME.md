# Videoaula — Direitos Humanos

Vídeo 16:9 (1920×1080, 30 fps) gerado por código: quadros desenhados com Python/Pillow, narração + música mixadas e exportadas com ffmpeg.

## O que existe

| Arquivo | Para quê |
|---|---|
| `saida/aula_direitos_humanos_voz_provisoria.mp4` | Vídeo completo com **voz sintética provisória** (só para conferir ritmo, legendas e animações) |
| `saida/*.srt` | Legendas sincronizadas (também já queimadas no vídeo) |
| `roteiro.md` | Roteiro completo, storyboard por cena e textos de tela |
| `gravador.html` | Teleprompter + gravador: abra no celular/navegador e grave **a sua voz**, cena por cena |
| `build.py`, `gfx.py`, `scenes.py`, `roteiro.py` | Código-fonte do vídeo |

## Como colocar a sua voz

Não há, neste ambiente, nenhum modelo de clonagem de voz (os repositórios de modelos estão bloqueados), então o vídeo **não** usa a sua voz ainda. O caminho que funciona de verdade:

1. Abra `gravador.html`, grave cada cena lendo o texto e baixe os arquivos (`abertura.webm`, `conceito.webm`, …).
   Também serve áudio do WhatsApp (.ogg), .m4a, .mp3 ou .wav, desde que o arquivo se chame `<id_da_cena>.<ext>` (ids em `roteiro.md`).
2. Coloque-os na pasta `voz/`.
3. Rode `pip install pillow numpy` (se preciso), `python3 build.py --voz minha`.
   O vídeo é re-cronometrado automaticamente: duração de cada cena = duração da sua gravação; os elementos visuais e as legendas se distribuem ao longo da fala.
   Resultado: `saida/aula_direitos_humanos_voz_minha.mp4`.

Dicas: nas cenas com “pausa” (revisão ativa), deixe os segundos de silêncio indicados; a sincronia das legendas dentro de cada cena é proporcional ao texto, então fale em ritmo regular.

## Requisitos
Python 3, Pillow, numpy, ffmpeg. Voz provisória: `espeak-ng` + `mbrola` + `mbrola-br1`.
`python3 build.py --preview <cena> <segundos>` grava um PNG de teste em `previa/`.

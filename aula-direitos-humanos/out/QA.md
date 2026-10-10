# Revisão final (QA) — Aula de Direitos Humanos

Gerado por `qa.py` sobre `aula_direitos_humanos.mp4`.
**Resultado geral dos testes automáticos: ✅ APROVADO**


## 1. Cobertura do conteúdo obrigatório

| Item | Resultado |
|---|---|
| Bloco 1 — Conceito | ✅ todos os 8 termos presentes |
| Bloco 2 — Estrutura | ✅ todos os 9 termos presentes |
| Bloco 3 — Cumprimento | ✅ todos os 12 termos presentes |
| Bloco 4 — Conteúdo | ✅ todos os 6 termos presentes |
| Bloco 5 — Fundamentalidade | ✅ todos os 5 termos presentes |
| Bloco 6 — Marcas | ✅ todos os 11 termos presentes |
| Bloco 7 — Consequências | ✅ todos os 8 termos presentes |
| Quadro final | ✅ todos os 9 termos presentes |
| Revisão ativa (5 perguntas) | ✅ todos os 5 termos presentes |
| Mensagem final (texto exato) | ✅ idêntica ao texto fornecido |
| Perguntas de revisão ativa | ✅ 5 perguntas, cada uma com pausa de reflexão e resposta na tela |

## 2. Ortografia (hunspell pt_BR) — textos de tela e narração

467 palavras distintas verificadas. ✅ nenhuma palavra suspeita.
Termos técnicos aceitos manualmente: preferenciabilidade, pretensão (termos jurídicos corretos, ausentes do dicionário).

## 3. Legendas

* 111 legendas; texto idêntico à narração: ✅.
* Termos jurídicos destacados em dourado (lista em `engine.TERMS`); legendas queimadas no vídeo e também em SRT separado.

## 4. Sincronia legenda × fala

Em 111/111 frases a fala começa em até 0,3 s do início da legenda (✅). Como os tempos vêm das durações reais de cada trecho sintetizado, a sincronia é por construção; este teste confere no áudio final.

## 5. Formato e duração

* Vídeo: h264 1920×1080 @ 24/1; áudio: aac 48000 Hz, 2 canais.
* Duração: **7:38** (vídeo 458.12s / áudio 458.14s) ✅.
* Meta do pedido: 4–6 min, "ajustada conforme a necessidade". Ficou acima porque o conteúdo obrigatório é extenso e a narração foi mantida em ritmo moderado.

## 6. Áudio

* Loudness integrada: -16.0 LUFS (alvo −16); pico verdadeiro: -2.0 dBFS; volume médio -18.6 dB, máximo -2.0 dB ✅.
* Trilha instrumental sintetizada (pad Am–F–C–G, original) com *ducking* automático: cai quando há fala.

## 7. Imagem

* 27 cenas amostradas no vídeo final: 0 quadros escuros, 0 quadros sem legenda onde deveria haver ✅.
* Mosaico de conferência: `out/contact_sheet.jpg`.
* Paleta azul-marinho/branco/dourado/cinza; elementos todos desenhados por código (balança, livros, tribunal, Constituição, tratado, silhuetas) e cada um tem função didática.

## 8. Pronúncia dos termos (transcrição fonética do sintetizador)

| Termo | Fonemas (espeak-ng, voz mb-br1) |
|---|---|
| Direitos Humanos | `dZ,i*'eItUs ,um'&~nUs` |
| direito-pretensão | `dZ,i*'eItUpR,eteINs'&U~` |
| incumbência | `,iNku~Nb'eINsj&` |
| preferenciabilidade | `pR,efe*,eINsi;,abilid'adZy` |
| superioridade normativa | `s,upe*,i;o*id'adZy n,o*@-matS'iv&` |
| fundamentalidade | `f,u~Nd&m,eINtalid'adZy` |
| reciprocidade | `x,esipR,osid'adZy` |
| essencialidade | `,eseINs,i;alid'adZy` |
| universalidade | `,univ,e*@-salid'adZy` |
| abstenção | `,absteINs'&U~` |
| imunidade | `,imunid'adZy` |
| cláusulas pétreas | `kl'aUzul&s p'EtRe&s` |
| coletividade | `k,oletS,ivid'adZy` |

> **Não verificável automaticamente:** a *naturalidade* da voz. A narração usa síntese MBROLA (robótica, ritmo moderado); para a versão final recomenda-se regravar com locutor humano ou TTS neural, mantendo os mesmos textos/tempos (veja README).

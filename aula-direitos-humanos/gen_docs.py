#!/usr/bin/env python3
"""Gera roteiro.md (roteiro + storyboard) e gravador.html (teleprompter/gravador de voz) a partir de roteiro.py."""
import json
import os
import re

from roteiro import CENAS

HERE = os.path.dirname(os.path.abspath(__file__))
strip = lambda t: re.sub(r"\[\[|\]\]", "", t)

VISUAL = {
    "abertura": "Título animado, balança da Justiça com anel dourado giratório; ao final, quatro objetivos da aula entram como chips (compreender, diferenciar, memorizar, reconhecer na prova).",
    "conceito": "Três medalhões (balão de fala = liberdade; balança equilibrada = igualdade; escudo com coração = dignidade) ligados por “+”; um cartão de exemplo cotidiano para cada; faixa final “proteger as pessoas · condições fundamentais · existência digna”.",
    "estrutura1": "Quatro cartões numerados; cada um ganha vida com animação própria: pretensão (pessoa exige → cruz da saúde → prestação volta), liberdade (esfera tracejada de autonomia com balão de opinião).",
    "estrutura2": "Cartões 1 e 2 permanecem; poder (cédula entra na urna → ✔ → onda de efeito jurídico) e imunidade (escudo repele a seta de interferência da autoridade). Selos finais: exige / protege a autonomia / produz efeitos jurídicos / protege contra interferência.",
    "cumprimento1": "Tela dividida: painel SUBJETIVO ativo (Estado, particular, ambos, com exemplos) e painel OBJETIVO esmaecido (“a seguir”); faixa “não é responsabilidade exclusiva do Estado”.",
    "cumprimento2": "Painel objetivo ativo: conduta ativa (pessoa entrega uma prestação) e conduta passiva (autoridade se abstém: seta de interferência cortada com ✕); barras finais SUBJETIVO = QUEM / OBJETIVO = QUAL.",
    "conteudo": "Constituição e tratado internacional ligados, por setas, às palavras dignidade, liberdade, igualdade e proteção da pessoa humana, que convergem na pessoa; cartões “expressa” e “implícita”.",
    "fundamentalidade": "Comparação FORMAL × MATERIAL em dois painéis com VS; barras de memorização (formal = reconhecimento jurídico; material = importância do conteúdo para a dignidade humana) com aviso de que não são definições exaustivas.",
    "marcas1": "Cartões animados: universalidade (globo cercado de pessoas) e essencialidade (gema); frases-chave DIREITOS DE TODOS e VALORES INDISPENSÁVEIS.",
    "marcas2": "Degraus (demais normas × normas de Direitos Humanos) + painel “ATENÇÃO”: não há prevalência automática; balança e frase sobre análise jurídica adequada; PROTEÇÃO NORMATIVA ESPECIAL.",
    "marcas3": "Reciprocidade (rede de pessoas interligadas; TODOS TÊM DIREITOS E DEVERES DE RESPEITO) e, em seguida, a tela com as quatro marcas lado a lado.",
    "consequencias1": "Sete silhuetas diversas (inclui criança, idosa(o) com bengala e pessoa em cadeira de rodas) com o mesmo halo dourado; RIQUEZA, POSIÇÃO SOCIAL e PRIVILÉGIOS são riscados.",
    "consequencias2": "Balança em tensão: liberdade de expressão × honra/privacidade; oscila e se estabiliza (ponderação); selos limites/ponderação/circunstâncias concretas; faixa OS DIREITOS DEVEM CONVIVER COM OS DIREITOS DAS OUTRAS PESSOAS.",
    "quadro": "Tabela de revisão com as nove linhas pedidas, entrando por grupos conforme a narração.",
    "quiz": "Cinco perguntas: enunciado, contagem regressiva circular (tempo para pensar) e cartão de resposta.",
    "final": "Mensagem final em três tempos, três medalhões (dignidade, titulares de direitos, convivência respeitosa) e “Bons estudos!”.",
}


def main():
    meta = {}
    p = os.path.join(HERE, "saida", "aula_direitos_humanos_voz_provisoria_cenas.json")
    if os.path.exists(p):
        meta = {m["id"]: m for m in json.load(open(p))}
    out = ["# Roteiro e storyboard — Direitos Humanos (videoaula)\n",
           "Formato 16:9, 1920×1080, 30 fps · paleta azul-marinho / branco / dourado / cinza · fontes Source Serif Pro e Source Sans Pro · legendas queimadas com termos jurídicos em dourado.\n",
           "| # | Cena | Início | Duração (voz provisória) |", "|---|---|---|---|"]
    for i, c in enumerate(CENAS, 1):
        m = meta.get(c["id"])
        ini = f"{int(m['inicio'] // 60)}:{int(m['inicio'] % 60):02d}" if m else "—"
        out.append(f"| {i} | `{c['id']}` — {c['bloco']} | {ini} | {m['duracao'] if m else '—'} s |")
    out.append("\nAs durações com a **sua voz** serão as da sua gravação (+1,5 s por cena de respiro).\n")
    for i, c in enumerate(CENAS, 1):
        out.append(f"\n## {i}. {c['bloco']}  (`{c['id']}`)\n")
        out.append(f"**Visual:** {VISUAL[c['id']]}\n")
        out.append("**Narração (cada parágrafo dispara elementos da tela; trechos em **negrito** viram destaque dourado):**\n")
        for s in c["segs"]:
            if s["t"]:
                out.append("> " + re.sub(r"\[\[(.*?)\]\]", r"**\1**", s["t"]) + "\n")
            else:
                out.append(f"> *(pausa de {s['pausa']} s para o estudante pensar — contagem regressiva na tela)*\n")
    open(os.path.join(HERE, "roteiro.md"), "w", encoding="utf-8").write("\n".join(out))

    data = [dict(id=c["id"], bloco=c["bloco"], segs=[dict(t=strip(s["t"]), pausa=s.get("pausa", 0)) for s in c["segs"]]) for c in CENAS]
    html = HTML.replace("__DATA__", json.dumps(data, ensure_ascii=False))
    open(os.path.join(HERE, "gravador.html"), "w", encoding="utf-8").write(html)


HTML = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gravador de narração</title>
<style>
:root{--bg:#0b1b3a;--panel:#152e5c;--gold:#c9a24b;--txt:#fff;--mut:#9aa6bd}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:18px/1.5 system-ui,sans-serif}
header{padding:16px;position:sticky;top:0;background:var(--bg);border-bottom:1px solid #2a3b5e;z-index:2}
h1{margin:0;font-size:20px;color:var(--gold)}p.s{margin:4px 0 0;color:var(--mut);font-size:15px}
.scene{margin:16px;padding:16px;background:var(--panel);border-radius:14px;border:1px solid #2a3b5e}
.scene h2{margin:0 0 8px;font-size:15px;color:var(--gold);letter-spacing:.06em}
.txt{font-size:26px;line-height:1.45;font-family:Georgia,serif}.txt p{margin:.4em 0}.pause{color:var(--mut);font-style:italic;font-size:18px}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}
button,a.dl{background:var(--gold);color:#0b1b3a;border:0;border-radius:10px;padding:10px 16px;font-weight:700;font-size:16px;cursor:pointer;text-decoration:none}
button.sec{background:#2a3b5e;color:#fff}button.rec{background:#d66}.ok{color:#7ecd9c;font-size:14px}
audio{height:36px}
</style></head><body>
<header><h1>Gravador de narração — Direitos Humanos</h1>
<p class="s">Grave cada cena lendo o texto em ritmo calmo, de professor. Nas “pausas”, fique em silêncio pelo tempo indicado. Baixe cada arquivo e coloque em <b>voz/</b> com o nome mostrado (ex.: <b>conceito.webm</b>). Use fones e um lugar silencioso.</p></header>
<main id="m"></main>
<script>
const DATA=__DATA__;
const m=document.getElementById('m');
DATA.forEach(sc=>{
  const d=document.createElement('section');d.className='scene';
  d.innerHTML=`<h2>${sc.bloco} · arquivo: <b>${sc.id}</b></h2><div class="txt">`+sc.segs.map(s=>s.t?`<p>${s.t}</p>`:`<p class="pause">(silêncio de ${s.pausa} s)</p>`).join('')+`</div>
  <div class="bar"><button class="rec">● Gravar</button><button class="sec" disabled>■ Parar</button><span class="ok"></span></div>
  <div class="bar"><audio controls hidden></audio><a class="dl" hidden>Baixar</a></div>`;
  m.appendChild(d);
  const [bR,bS]=d.querySelectorAll('button'),au=d.querySelector('audio'),dl=d.querySelector('a.dl'),ok=d.querySelector('.ok');
  let mr,ch=[];
  bR.onclick=async()=>{
    try{const st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:true}});
      mr=new MediaRecorder(st);ch=[];mr.ondataavailable=e=>ch.push(e.data);
      mr.onstop=()=>{st.getTracks().forEach(t=>t.stop());const b=new Blob(ch,{type:mr.mimeType});const ext=mr.mimeType.includes('ogg')?'ogg':mr.mimeType.includes('mp4')?'m4a':'webm';
        au.src=URL.createObjectURL(b);au.hidden=false;dl.href=au.src;dl.download=sc.id+'.'+ext;dl.textContent='Baixar '+sc.id+'.'+ext;dl.hidden=false;ok.textContent='Gravado ✔';};
      mr.start();bR.disabled=true;bS.disabled=false;ok.textContent='Gravando…';
    }catch(e){ok.textContent='Sem acesso ao microfone: '+e.message}
  };
  bS.onclick=()=>{mr.stop();bR.disabled=false;bS.disabled=true;};
});
</script></body></html>
"""

if __name__ == "__main__":
    main()

"""Roteiro da videoaula: narração (em segmentos) + rótulos de cada cena.

Cada segmento é um trecho de fala que dispara elementos visuais. Marcação [[assim]] =
destaque dourado na legenda/tela. `pausa` = silêncio (em segundos) depois do segmento.
"""

CENAS = [
    dict(id="abertura", bloco="ABERTURA", segs=[
        dict(t="Olá! Nesta aula, vamos entender os [[Direitos Humanos]] de um jeito claro: para compreender a lógica, e não apenas decorar."),
        dict(t="Ao final, você vai diferenciar os termos que confundem, memorizar as classificações e reconhecer como o tema é cobrado em prova."),
    ]),
    dict(id="conceito", bloco="BLOCO 1 · CONCEITO", segs=[
        dict(t="Primeiro, o conceito. Direitos Humanos são o conjunto de direitos indispensáveis a uma vida pautada na [[liberdade]], na [[igualdade]] e na [[dignidade]]."),
        dict(t="Liberdade: por exemplo, poder expressar uma opinião."),
        dict(t="Igualdade: ser tratado de forma igual perante a lei."),
        dict(t="Dignidade: não ser submetido a tratamento desumano."),
        dict(t="Esses direitos protegem as pessoas e asseguram as condições fundamentais para uma existência digna."),
    ]),
    dict(id="estrutura1", bloco="BLOCO 2 · ESTRUTURA", segs=[
        dict(t="Segundo ponto: a estrutura. Um direito pode ser compreendido de quatro maneiras. Elas não são sinônimas: são estruturas diferentes."),
        dict(t="[[Direito-pretensão]]: é a possibilidade de exigir de alguém uma conduta ou uma prestação. Por exemplo, a pretensão de receber uma prestação de saúde, quando presentes os requisitos jurídicos."),
        dict(t="[[Direito-liberdade]]: protege uma esfera de autonomia, permitindo agir sem interferências indevidas. Por exemplo, manifestar uma opinião, dentro dos limites jurídicos."),
    ]),
    dict(id="estrutura2", bloco="BLOCO 2 · ESTRUTURA", segs=[
        dict(t="[[Direito-poder]]: é a possibilidade de exercer uma competência e produzir efeitos jurídicos por meio de um ato reconhecido pelo Direito. Por exemplo, votar, observados os requisitos legais."),
        dict(t="[[Direito-imunidade]]: protege a pessoa contra certas formas de interferência, ou de sujeição ao poder de outra pessoa ou autoridade."),
        dict(t="Para fixar: a pretensão [[exige]], a liberdade [[protege a autonomia]], o poder [[produz efeitos jurídicos]] e a imunidade [[protege contra interferência]].", pausa=0.6),
    ]),
    dict(id="cumprimento1", bloco="BLOCO 3 · CUMPRIMENTO", segs=[
        dict(t="Terceiro ponto: as maneiras de cumprimento. Vamos olhar por dois ângulos. O primeiro é o [[ponto de vista subjetivo]]: quem tem a incumbência de respeitar, proteger ou concretizar o direito."),
        dict(t="A incumbência pode ser do [[Estado]]: como a saúde e a segurança pública."),
        dict(t="Pode ser de um [[particular]]: como o empregador, que não pode discriminar um trabalhador."),
        dict(t="Ou de [[ambos]]: como na proteção da criança, que é dever da família, da sociedade e do Estado."),
        dict(t="Ou seja: proteger os Direitos Humanos não é responsabilidade exclusiva do Estado."),
    ]),
    dict(id="cumprimento2", bloco="BLOCO 3 · CUMPRIMENTO", segs=[
        dict(t="O segundo ângulo é o [[ponto de vista objetivo]]: qual conduta é exigida. A [[conduta ativa]] exige uma ação, uma prestação ou uma medida para efetivar o direito."),
        dict(t="Já a [[conduta passiva]] exige abstenção: alguém deve deixar de praticar uma interferência indevida."),
        dict(t="Resumindo, de forma didática: [[subjetivo]] é quem tem a incumbência; [[objetivo]] é qual conduta é exigida."),
        dict(t="É uma síntese para estudo, que preserva o sentido jurídico dos conceitos.", pausa=0.5),
    ]),
    dict(id="conteudo", bloco="BLOCO 4 · CONTEÚDO", segs=[
        dict(t="Quarto ponto: o conteúdo. Os Direitos Humanos representam [[valores essenciais]], retratados nas Constituições e nos tratados internacionais: dignidade, liberdade, igualdade e proteção da pessoa humana."),
        dict(t="Essa proteção pode aparecer de forma [[expressa]], escrita no texto jurídico."),
        dict(t="Ou de forma [[implícita]], decorrente da interpretação desse texto."),
    ]),
    dict(id="fundamentalidade", bloco="BLOCO 5 · FUNDAMENTALIDADE", segs=[
        dict(t="Quinto ponto, um dos mais importantes: a fundamentalidade [[formal]] e a fundamentalidade [[material]]."),
        dict(t="A [[fundamentalidade formal]] se relaciona ao reconhecimento do direito em um instrumento jurídico, como a Constituição ou um tratado internacional, conforme o contexto considerado. É a dimensão formal do reconhecimento normativo."),
        dict(t="A [[fundamentalidade material]] se relaciona ao conteúdo: o direito é indispensável para a promoção da dignidade humana?"),
        dict(t="Para memorizar: formal, [[reconhecimento jurídico]]; material, [[importância do conteúdo]] para a dignidade humana. Atenção: são atalhos de memória, não definições exaustivas.", pausa=0.6),
    ]),
    dict(id="marcas1", bloco="BLOCO 6 · MARCAS DISTINTIVAS", segs=[
        dict(t="Sexto ponto: as marcas distintivas. A primeira é a [[universalidade]]: os Direitos Humanos são reconhecidos como direitos de todas as pessoas, sem que a proteção dependa de privilégios pessoais. Direitos de todos."),
        dict(t="A segunda é a [[essencialidade]]: eles representam valores indispensáveis à pessoa humana, que devem ser protegidos."),
    ]),
    dict(id="marcas2", bloco="BLOCO 6 · MARCAS DISTINTIVAS", segs=[
        dict(t="A terceira é a [[superioridade normativa]], também chamada de preferenciabilidade: a especial importância normativa atribuída aos Direitos Humanos, no contexto constitucional e internacional."),
        dict(t="Atenção: isso não significa que toda norma de Direitos Humanos prevalece automaticamente sobre qualquer outra. Conflitos normativos exigem análise jurídica adequada. É uma [[proteção normativa especial]]."),
    ]),
    dict(id="marcas3", bloco="BLOCO 6 · MARCAS DISTINTIVAS", segs=[
        dict(t="A quarta é a [[reciprocidade]]: todos têm direitos, e os deveres de respeito e proteção não se limitam ao Estado. A coletividade e os particulares também podem ter responsabilidades."),
        dict(t="Fixe as quatro marcas: [[universalidade]], [[essencialidade]], [[superioridade normativa]] e [[reciprocidade]].", pausa=0.6),
    ]),
    dict(id="consequencias1", bloco="BLOCO 7 · CONSEQUÊNCIAS", segs=[
        dict(t="Sétimo ponto: as consequências de uma sociedade pautada na defesa dos Direitos Humanos. A primeira é o reconhecimento do [[direito a ter direitos]]."),
        dict(t="Cada pessoa deve ser reconhecida como sujeito de direitos e titular de proteção jurídica. A dignidade não depende de riqueza, de posição social ou de privilégios."),
    ]),
    dict(id="consequencias2", bloco="BLOCO 7 · CONSEQUÊNCIAS", segs=[
        dict(t="A segunda consequência é a [[convivência e a colisão de direitos]]. Os direitos de uma pessoa convivem com os direitos das demais."),
        dict(t="Imagine a [[liberdade de expressão]] em tensão com a proteção da [[honra]] ou da [[privacidade]] de outra pessoa."),
        dict(t="Nesse caso, o Direito estabelece limites, pondera os interesses e identifica qual proteção deve prevalecer nas circunstâncias concretas, conforme os critérios jurídicos aplicáveis."),
        dict(t="E o conflito não faz um dos direitos deixar de existir. [[Os direitos devem conviver com os direitos das outras pessoas.]]", pausa=0.6),
    ]),
    dict(id="quadro", bloco="REVISÃO FINAL", segs=[
        dict(t="Hora de revisar. Conceito: liberdade, igualdade e dignidade. Estrutura: pretensão, liberdade, poder e imunidade."),
        dict(t="Cumprimento subjetivo: Estado, particular ou ambos. Cumprimento objetivo: conduta ativa ou passiva."),
        dict(t="Conteúdo: valores essenciais reconhecidos juridicamente. Fundamentalidade formal: reconhecimento formal. Material: conteúdo essencial à dignidade."),
        dict(t="Marcas distintivas: universalidade, essencialidade, superioridade normativa e reciprocidade. Consequências: direito a ter direitos e convivência entre direitos.", pausa=0.6),
    ]),
    dict(id="quiz", bloco="REVISÃO ATIVA", segs=[
        dict(t="Agora, revisão ativa. Quais são os três valores centrais do conceito de Direitos Humanos?"),
        dict(t="", pausa=2.2),
        dict(t="[[Liberdade, igualdade e dignidade.]]"),
        dict(t="Quais são as quatro estruturas dos Direitos Humanos?"),
        dict(t="", pausa=2.2),
        dict(t="[[Pretensão, liberdade, poder e imunidade.]]"),
        dict(t="Qual é a diferença entre o ponto de vista subjetivo e o objetivo, quanto ao cumprimento?"),
        dict(t="", pausa=2.6),
        dict(t="[[Subjetivo]]: quem tem a incumbência. [[Objetivo]]: qual conduta é exigida."),
        dict(t="Qual é a diferença entre a fundamentalidade formal e a material?"),
        dict(t="", pausa=2.4),
        dict(t="[[Formal]]: reconhecimento jurídico. [[Material]]: conteúdo essencial à dignidade."),
        dict(t="Quais são as quatro marcas distintivas dos Direitos Humanos?"),
        dict(t="", pausa=2.4),
        dict(t="[[Universalidade, essencialidade, superioridade normativa e reciprocidade.]]", pausa=0.5),
    ]),
    dict(id="final", bloco="ENCERRAMENTO", segs=[
        dict(t="Mais importante do que decorar os termos é compreender a lógica dos Direitos Humanos:"),
        dict(t="[[proteger a dignidade]], [[reconhecer cada pessoa como titular de direitos]]"),
        dict(t="e [[permitir a convivência respeitosa entre todos]]."),
        dict(t="Bons estudos!", pausa=1.2),
    ]),
]

if __name__ == "__main__":
    import re
    n = sum(len(re.sub(r"\[\[|\]\]", "", s["t"]).split()) for c in CENAS for s in c["segs"])
    print("palavras:", n, "≈ minutos a 150 ppm:", round(n / 150, 1))

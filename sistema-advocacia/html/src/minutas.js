/* Minutas: procuração, contrato de honorários, declaração de hipossuficiência e recibo, preenchidos com os dados do cliente.
   O que não estiver cadastrado sai como [PREENCHER: …] (destacado em amarelo no Word) e é listado antes de gerar. */
const Minutas = (() => {
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataExtenso = (d = new Date()) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

  // ---------- valores em reais por extenso ----------
  const U = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  function ate999(n) {
    if (n === 0) return ''; if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(C[c]);
    if (r) p.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
    return p.join(' e ');
  }
  function inteiroExtenso(n) {
    if (n === 0) return 'zero';
    const g = [[1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1e3, 'mil', 'mil']], partes = [];
    for (const [v, s, p] of g) { const q = Math.floor(n / v); if (q) { partes.push(v === 1e3 && q === 1 ? 'mil' : `${ate999(q)} ${q === 1 ? s : p}`); n -= q * v; } }
    if (n) partes.push(ate999(n));
    // "e" antes do último grupo quando ele é menor que 100 ou múltiplo de 100 (ex.: mil e quinhentos; dois mil e cem)
    if (partes.length > 1) { const ult = partes.pop(), nUlt = ult.split(' ').length; partes.push((nUlt <= 3 && !/^(cento|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos) /.test(ult) ? 'e ' : '') + ult); }
    return partes.join(' ').replace(/ de$/, '');
  }
  function reaisExtenso(valor) {
    const cent = Math.round(Number(valor) * 100); if (!Number.isFinite(cent) || cent < 0 || cent > 1e13) return '';
    const r = Math.floor(cent / 100), c = cent % 100, grande = r >= 1e6 && r % 1e6 === 0;
    const reais = r ? `${inteiroExtenso(r)}${grande ? ' de' : ''} ${r === 1 ? 'real' : 'reais'}` : '';
    const cents = c ? `${inteiroExtenso(c)} ${c === 1 ? 'centavo' : 'centavos'}` : '';
    return [reais, cents].filter(Boolean).join(' e ') || 'zero reais';
  }
  // aceita "1.500,00", "1500.5", "R$ 2.000"
  function lerValor(t) {
    let s = String(t == null ? '' : t).replace(/[^\d.,]/g, ''); if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s); return Number.isFinite(n) && n > 0 ? n : null;
  }
  const brl = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---------- dados das partes ----------
  const falta = (rotulo, falt) => { falt.push(rotulo); return `[PREENCHER: ${rotulo}]`; };
  function qualificacao(c, falt) {
    const pj = c.tipo === 'PJ', doc = String(c.documento || '').trim();
    const gen = (m, f) => m;                                                 // o cadastro não guarda gênero: usa o masculino genérico
    if (pj) return `**${c.nome}**, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${doc || falta('CNPJ', falt)}, com sede em ${c.endereco || falta('endereço da sede', falt)}`;
    return `**${c.nome}**, ${gen('brasileiro', 'brasileira')}, ${c.estado_civil || falta('estado civil', falt)}, ${c.profissao || falta('profissão', falt)}, portador(a) do RG nº ${c.rg || falta('RG', falt)} e inscrito(a) no CPF sob o nº ${doc || falta('CPF', falt)}, residente e domiciliado(a) em ${c.endereco || falta('endereço', falt)}`;
  }
  function qualificacaoAdvogado(a, falt) {
    return `**${a.nome || falta('nome do(a) advogado(a)', falt)}**, advogado(a) inscrito(a) na OAB sob o nº ${a.oab || falta('número da OAB', falt)}, com escritório profissional em ${a.endereco || falta('endereço do escritório', falt)}`;
  }

  const MODELOS = {
    procuracao: { nome: 'Procuração (ad judicia et extra)', categoria: 'procuracao', campos: [],
      texto: ({ c, p, a, falt, ctx }) => [
        '# PROCURAÇÃO',
        `**OUTORGANTE:** ${qualificacao(c, falt)}.`,
        `**OUTORGADO(A):** ${qualificacaoAdvogado(a, falt)}.`,
        `**PODERES:** pelo presente instrumento particular de procuração, o(a) outorgante nomeia e constitui o(a) outorgado(a) seu(sua) procurador(a), conferindo-lhe os poderes da cláusula *ad judicia et extra*, para o foro em geral, em qualquer juízo, instância ou tribunal, podendo propor ações e defender o(a) outorgante nas ações contra ele(a) propostas, acompanhá-las até o final, bem como praticar todos os atos necessários ao bom e fiel cumprimento deste mandato.`,
        `Ficam conferidos, ainda, poderes especiais para receber citação, confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, receber e dar quitação, firmar compromisso, assinar declaração de hipossuficiência econômica e requerer a gratuidade da justiça, levantar alvarás e valores, podendo ainda substabelecer esta a outrem, com ou sem reserva de poderes.`,
        ...(p ? [`**FINALIDADE:** ${p.titulo}${p.numero ? `, processo nº ${p.numero}` : ''}.`] : []),
        `${ctx.cidade}, ${ctx.data}.`, '', '______________________________________', c.nome, ...(c.documento ? [`${c.tipo === 'PJ' ? 'CNPJ' : 'CPF'}: ${c.documento}`] : []),
      ] },

    contrato: { nome: 'Contrato de honorários advocatícios', categoria: 'contrato',
      campos: [{ n: 'valor', rot: 'Valor dos honorários (R$)', ph: 'Ex.: 3.000,00', req: true }, { n: 'parcelas', rot: 'Número de parcelas', ph: 'Ex.: 3 (vazio = à vista)' }, { n: 'vencimento', rot: 'Dia do vencimento', ph: 'Ex.: 10' }, { n: 'exito', rot: 'Honorários de êxito (%)', ph: 'Ex.: 20 (opcional)' }],
      texto: ({ c, p, a, falt, ctx, v }) => {
        const valor = lerValor(v.valor), n = Math.max(1, parseInt(v.parcelas, 10) || 1), exito = lerValor(v.exito);
        if (!valor) falta('valor dos honorários', falt);
        const forma = !valor ? '[PREENCHER: forma de pagamento]' : n === 1 ? 'à vista, na data da assinatura deste contrato' : `em ${n} (${inteiroExtenso(n)}) parcelas mensais e sucessivas de ${brl(valor / n)}, com vencimento todo dia ${v.vencimento || '[PREENCHER: dia do vencimento]'}, a primeira na assinatura deste contrato`;
        return [
          '# CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS',
          `**CONTRATANTE:** ${qualificacao(c, falt)}.`,
          `**CONTRATADO(A):** ${qualificacaoAdvogado(a, falt)}.`,
          'As partes acima qualificadas ajustam o presente contrato, que se regerá pelas cláusulas seguintes e pelo Estatuto da Advocacia e da OAB (Lei nº 8.906/1994) e pelo Código de Ética e Disciplina da OAB.',
          '## CLÁUSULA 1ª — DO OBJETO',
          `O(A) contratado(a) prestará serviços advocatícios ao(à) contratante ${p ? `no caso **${p.titulo}**${p.numero ? ` (processo nº ${p.numero})` : ''}${p.juizo ? `, perante ${p.juizo}` : ''}` : 'em [PREENCHER: descrição do serviço contratado]'}, compreendendo o acompanhamento e a prática dos atos necessários à defesa dos interesses do(a) contratante até a decisão final na instância contratada.`,
          '## CLÁUSULA 2ª — DOS HONORÁRIOS',
          `Pelos serviços, o(a) contratante pagará ao(à) contratado(a) honorários no valor de **${valor ? `${brl(valor)} (${reaisExtenso(valor)})` : '[PREENCHER: valor]'}**, ${forma}.`,
          ...(exito ? [`Além disso, em caso de êxito, serão devidos honorários de **${exito.toLocaleString('pt-BR')}% (${inteiroExtenso(Math.round(exito))} por cento)** sobre o proveito econômico obtido, pagos quando do recebimento dos valores.`] : []),
          'Os honorários de sucumbência pertencem ao(à) advogado(a), nos termos do art. 23 da Lei nº 8.906/1994, e não se confundem com os honorários contratuais.',
          '## CLÁUSULA 3ª — DAS DESPESAS',
          'Custas processuais, taxas, emolumentos, diligências, perícias, cópias, deslocamentos e demais despesas necessárias ao andamento do serviço correrão por conta do(a) contratante, que as antecipará ou reembolsará mediante comprovação.',
          '## CLÁUSULA 4ª — DAS OBRIGAÇÕES',
          'O(A) contratante se compromete a fornecer, com veracidade e no prazo solicitado, todas as informações e documentos necessários, bem como a comparecer quando convocado(a). O(A) contratado(a) se compromete a atuar com diligência e zelo, mantendo o(a) contratante informado(a) sobre o andamento do caso e guardando sigilo profissional.',
          'O(A) contratado(a) não garante resultado, por se tratar de obrigação de meio, e não de fim.',
          '## CLÁUSULA 5ª — DA RESCISÃO',
          'O contrato poderá ser rescindido por qualquer das partes, mediante comunicação por escrito. Em caso de rescisão, serão devidos os honorários proporcionais ao serviço já prestado, observado o disposto no Código de Ética e Disciplina da OAB.',
          '## CLÁUSULA 6ª — DO FORO',
          `Fica eleito o foro da comarca de ${ctx.cidade} para dirimir quaisquer dúvidas oriundas deste contrato.`,
          'E, por estarem justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor.',
          `${ctx.cidade}, ${ctx.data}.`, '', '______________________________________', `CONTRATANTE: ${c.nome}`, '', '______________________________________', `CONTRATADO(A): ${a.nome || '[PREENCHER: nome do(a) advogado(a)]'}`,
        ];
      } },

    hipossuficiencia: { nome: 'Declaração de hipossuficiência econômica', categoria: 'procuracao', campos: [],
      texto: ({ c, p, falt, ctx }) => [
        '# DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA',
        `${qualificacao(c, falt)}, **DECLARA**, para os fins de concessão dos benefícios da gratuidade da justiça, nos termos do art. 98 e seguintes do Código de Processo Civil e do art. 5º, inciso LXXIV, da Constituição Federal, que **não possui condições de arcar com as custas processuais e os honorários advocatícios sem prejuízo do próprio sustento e de sua família**.`,
        `${p ? `A presente declaração destina-se ao processo **${p.titulo}**${p.numero ? ` (nº ${p.numero})` : ''}. ` : ''}Declara, ainda, estar ciente de que a afirmação falsa sujeita o declarante às penalidades da lei.`,
        `${ctx.cidade}, ${ctx.data}.`, '', '______________________________________', c.nome, ...(c.documento ? [`${c.tipo === 'PJ' ? 'CNPJ' : 'CPF'}: ${c.documento}`] : []),
      ] },

    recibo: { nome: 'Recibo de honorários', categoria: 'comprovante',
      campos: [{ n: 'valor', rot: 'Valor recebido (R$)', ph: 'Ex.: 1.000,00', req: true }, { n: 'referente', rot: 'Referente a', ph: 'Ex.: 1ª parcela dos honorários', req: false }, { n: 'forma', rot: 'Forma de pagamento', ph: 'Ex.: PIX, dinheiro, transferência' }],
      texto: ({ c, p, a, falt, ctx, v }) => {
        const valor = lerValor(v.valor); if (!valor) falta('valor recebido', falt);
        return [
          '# RECIBO',
          `**Valor: ${valor ? brl(valor) : '[PREENCHER: valor]'}**`,
          `${qualificacaoAdvogado(a, falt)}, **RECEBEU** de ${qualificacao(c, falt)}, a quantia de **${valor ? `${brl(valor)} (${reaisExtenso(valor)})` : '[PREENCHER: valor]'}**${v.forma ? `, por meio de ${v.forma}` : ''}, referente a ${v.referente || (p ? `honorários advocatícios do caso ${p.titulo}` : 'honorários advocatícios')}, dando por isso plena e geral quitação do valor recebido.`,
          `${ctx.cidade}, ${ctx.data}.`, '', '______________________________________', a.nome || '[PREENCHER: nome do(a) advogado(a)]', ...(a.oab ? [`OAB ${a.oab}`] : []),
        ];
      } },
  };

  // Devolve { markdown, faltando[], nome }
  function montar(chave, { cliente, processo = null, advogado = {}, valores = {}, cidade = '', data = null }) {
    const m = MODELOS[chave]; if (!m) throw new Error('Modelo de documento desconhecido.');
    const falt = [], ctx = { cidade: cidade || '[PREENCHER: cidade]', data: data || dataExtenso() };
    if (!cidade) falt.push('cidade');
    const linhas = m.texto({ c: cliente, p: processo, a: advogado, falt, ctx, v: valores });
    return { markdown: linhas.join('\n'), faltando: [...new Set(falt)], nome: m.nome, categoria: m.categoria };
  }
  return { MODELOS, montar, reaisExtenso, inteiroExtenso, lerValor, dataExtenso };
})();

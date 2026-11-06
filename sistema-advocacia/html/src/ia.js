/* IA: assistente de conversa e análise de documentos, usando a IA da própria plataforma (ou a chave da pessoa no modo avulso). */
const IA = (() => {
  const MAX_BYTES = 250000;                                         // limite de entrada da plataforma: 256 KiB de texto
  const bytes = (s) => new TextEncoder().encode(s).length;

  function promptSistema(contextoCaso) {
    const hoje = new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' });
    return `Você é o ${FIRMA.assistenteNome} do escritório ${FIRMA.nome}, um assistente de IA de uso interno e restrito, que apoia advogados e a equipe do escritório. Hoje é ${hoje}.

# Papel
Auxiliar na análise de documentos, organização de atendimentos, pesquisa de fundamentos e redação de peças e comunicações jurídicas no âmbito do Direito brasileiro. Você produz rascunhos e análises para revisão e assinatura do advogado responsável; a decisão e a responsabilidade técnica são sempre do advogado.

# Regras de ouro
1. **Fidelidade aos fatos**: use apenas fatos presentes nos documentos, no cadastro e na conversa. Nunca invente nomes, datas, valores, números de processo ou qualificações. O que faltar deve aparecer como **[PREENCHER: descrição do dado]** no texto.
2. **Sem alucinação jurídica**: cite artigos de lei, súmulas, temas repetitivos e precedentes somente quando tiver confiança na existência e no conteúdo. Jamais invente números de processo, ementas ou transcrições. Quando a citação depender de conferência, marque **[CONFERIR]** e diga o que verificar. Considere que a legislação e a jurisprudência podem ter mudado depois do seu treinamento e recomende checar a redação vigente.
3. **Transparência**: separe claramente o que está nos documentos, o que é inferência sua e o que é opinião/estratégia. Aponte contradições, lacunas, riscos, prazos (prescrição, decadência, recursos) e documentos que faltam.
4. **Sigilo profissional**: trate tudo como confidencial (Estatuto da Advocacia, art. 7º, II, e Código de Ética da OAB, art. 35). Não proponha divulgar dados do cliente.
5. **Ética**: não auxilie em fraude, ocultação de provas, captação indevida de clientela ou qualquer conduta vedada pelo Código de Ética da OAB.
6. Se o pedido for ambíguo e a resposta depender de dado essencial, faça no máximo 3 perguntas objetivas — mas, sempre que possível, já entregue uma primeira versão com os pontos em aberto marcados.

# Formato
- Responda em português do Brasil, em linguagem técnica e clara, em Markdown (títulos, listas, **negrito**).
- Peças e minutas: estrutura completa e pronta para revisão (endereçamento, qualificação das partes, dos fatos, do direito, dos pedidos, valor da causa, fecho), com tom formal e parágrafos objetivos.
- Resumos: comece pela conclusão em poucas linhas e depois detalhe (partes, objeto, fatos relevantes, prazos, valores, riscos, próximos passos).
- Ao final de minutas e pareceres, inclua uma breve seção **"Pontos para revisão do advogado"**.
${contextoCaso ? `\n# Contexto do caso selecionado pelo usuário\n${contextoCaso}\n` : ''}`;
  }

  function contextoDoCaso(conv) {
    const partes = [];
    const c = conv.cliente_id ? Dados.obter('clientes', conv.cliente_id) : null;
    if (c) {
      const campos = [['Nome', c.nome], ['Tipo', c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'], ['CPF/CNPJ', c.documento], ['RG', c.rg], ['Estado civil', c.estado_civil],
        ['Profissão/ramo', c.profissao], ['Nascimento', c.nascimento], ['Endereço', c.endereco], ['E-mail', c.email], ['Telefone', c.telefone], ['Observações', c.observacoes]].filter(([, v]) => v);
      partes.push('## Cliente\n' + campos.map(([k, v]) => `- ${k}: ${v}`).join('\n'));
    }
    const p = conv.processo_id ? Dados.obter('processos', conv.processo_id) : null;
    if (p) {
      const campos = [['Caso', p.titulo], ['Número', p.numero], ['Área', p.area], ['Juízo/Órgão', p.juizo], ['Parte contrária', p.parte_contraria], ['Situação', p.status],
        ['Valor da causa', p.valor_causa != null ? 'R$ ' + p.valor_causa : null], ['Observações', p.observacoes]].filter(([, v]) => v);
      partes.push('## Processo / caso\n' + campos.map(([k, v]) => `- ${k}: ${v}`).join('\n'));
    }
    const ats = Dados.lista('atendimentos').filter((a) => (conv.processo_id ? a.processo_id === conv.processo_id : conv.cliente_id ? a.cliente_id === conv.cliente_id : false))
      .sort((a, b) => String(b.data_hora).localeCompare(String(a.data_hora))).slice(0, 12);
    if (ats.length) {
      partes.push('## Histórico de atendimentos (mais recentes primeiro)\n' + ats.map((a) => `- ${a.data_hora} (${a.canal}) — ${a.assunto}` + (a.resumo ? `\n  Resumo: ${a.resumo.slice(0, 1500)}` : '') +
        (a.providencias ? `\n  Providências: ${a.providencias.slice(0, 600)}` : '') + (a.prazo ? `\n  Prazo: ${a.prazo}` : '')).join('\n'));
    }
    return partes.join('\n\n');
  }

  const ehImagem = (e) => ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(e);
  // Texto (e, se preciso, imagens) dos documentos escolhidos, dentro do orçamento de caracteres
  async function blocosDosDocumentos(ids, orcamento) {
    const B = Dados.backend, textos = [], imagens = [], avisos = []; let usado = 0;
    for (const id of ids) {
      const d = Dados.obter('documentos', id); if (!d) continue;
      const e = Docs.ext(d.nome_original), cab = `Documento #${d.id} — "${d.titulo}" (${d.categoria}; arquivo: ${d.nome_original})`;
      const texto = d.tem_texto ? await Dados.lerTexto(d.id) : '';
      if (texto && (e !== '.pdf' || texto.length > 80)) {
        const t = texto.slice(0, Math.max(0, orcamento - usado));
        if (!t) { avisos.push(`"${d.titulo}" não coube no limite de leitura.`); continue; }
        usado += t.length;
        textos.push(`<documento id="${d.id}" titulo="${String(d.titulo).replace(/"/g, "'")}">\n${cab}\n\n${t}${t.length < texto.length ? '\n[... texto truncado por tamanho ...]' : ''}\n</documento>`);
        continue;
      }
      if (B.imagensOk && imagens.length < B.limiteImagens && (e === '.pdf' || ehImagem(e))) {   // sem texto (escaneado): leitura visual
        try {
          const u8 = await Arq.ler(d.asset_id);
          if (e === '.pdf') imagens.push(...await Docs.paginasComoImagens(u8, { max: B.limiteImagens - imagens.length }));
          else imagens.push(new Blob([u8], { type: Docs.TIPOS[e] }));
          textos.push(`${cab} — anexado como imagem(ns) nesta mensagem.`); continue;
        } catch { /* cai no aviso */ }
      }
      avisos.push(`"${d.titulo}" (${e || 'sem extensão'}) não pôde ser lido pela IA (formato sem texto extraível).`);
    }
    return { textos, imagens, avisos };
  }

  const MENSAGENS = {
    not_granted: 'A IA não foi autorizada neste aparelho. Permita o uso quando o Claude perguntar e tente de novo.',
    sampling_disabled: 'A IA não está disponível para esta conta.', rate_limited: 'Limite de uso da IA atingido por agora. Tente de novo em instantes.',
    session_expired: 'Sua sessão do Claude expirou. Entre novamente.', prompt_too_large: 'Há texto demais (documentos ou conversa). Selecione menos documentos ou comece outra conversa.',
    image_rejected: 'Uma das imagens/páginas não pôde ser lida pela IA.', empty_completion: 'A IA não devolveu resposta. Reformule o pedido.', refused: 'A IA recusou este pedido.',
    cancelled: 'Interrompido.', invalid_json: 'A IA não devolveu um resultado legível. Tente novamente.',
  };
  const erroAmigavel = (e) => (e && (MENSAGENS[e.code] || e.message)) || 'Falha ao consultar a IA.';

  async function conversar(conv, texto, { onText, signal } = {}) {
    const B = Dados.backend;
    if (!B.iaOk) throw new Error('O Assistente de IA não está disponível neste ambiente.');
    const doc = await blocosDosDocumentos(conv.documentos_ids || [], 160000);
    const instrucoes = promptSistema(contextoDoCaso(conv)) + (doc.textos.length ? '\n\n# Documentos selecionados\n' + doc.textos.join('\n\n') : '');
    const hist = (conv.mensagens || []).filter((m) => m.conteudo).map((m) => ({ role: m.papel, content: m.conteudo }));
    const montar = () => [{ role: 'user', content: instrucoes }, ...hist, { role: 'user', content: texto }];
    while (bytes(montar().map((t) => t.content).join('')) > MAX_BYTES && hist.length) hist.shift();   // descarta as mais antigas
    const opcoes = { cache: false, signal, onText };
    if (doc.imagens.length) opcoes.images = doc.imagens;
    try { const r = await B.ia(montar(), opcoes); return { texto: r.text, avisos: doc.avisos }; }
    catch (e) { if (e && e.code === 'cancelled') { const c = new Error('cancelled'); c.code = 'cancelled'; c.text = e.text; throw c; } const x = new Error(erroAmigavel(e)); x.code = e && e.code; x.text = e && e.text; throw x; }
  }

  // ---------- organização de documentos ----------
  const SISTEMA_ORGANIZAR = `Você organiza o arquivo digital de um escritório de advocacia brasileiro. Receberá um arquivo (texto, PDF ou imagens) e deve classificá-lo.

Categorias (use exatamente estes códigos):
- procuracao: procurações, substabelecimentos, declarações de hipossuficiência
- contrato: contratos, aditivos, termos, acordos, contrato de honorários
- peticao: petições, recursos, contestações, minutas e demais peças
- decisao: sentenças, acórdãos, despachos, decisões, intimações, certidões de andamento
- identificacao: RG, CPF, CNH, certidões civis, título de eleitor, documentos pessoais
- comprovante: comprovantes de residência, pagamento, renda, extratos, boletos, notas fiscais
- prova: fotos, prints, laudos, atas, gravações e demais provas
- parecer: pareceres, memorandos, estudos e análises
- correspondencia: e-mails, cartas, notificações extrajudiciais, mensagens
- outros: o que não se encaixar

Regras:
1. Use SOMENTE o que está no arquivo. Não invente nomes, datas, CPF/CNPJ ou números de processo; deixe vazio quando não constar.
2. Se um PDF reúne documentos diferentes (ex.: RG, CPF e comprovante digitalizados juntos), devolva um item por documento com suas páginas. Só separe quando for claramente outro documento; uma peça de várias páginas é UM documento. Cubra todas as páginas, sem sobreposição.
3. "partes" lista quem é parte/titular do documento (dono do RG; autor e réu de uma ação; outorgante de uma procuração), com CPF/CNPJ quando constar.
4. Título em português, curto, no formato "Tipo — Pessoa/assunto".
5. Se o conteúdo estiver ilegível ou não houver conteúdo, classifique pelo nome do arquivo como "outros" e diga isso no resumo.

Responda SOMENTE com um JSON neste formato, sem nenhum texto fora dele:
{"documentos":[{"pagina_inicial":1,"pagina_final":1,"categoria":"identificacao","titulo":"RG — Maria da Silva","resumo":"Uma ou duas frases.","data_documento":"AAAA-MM-DD ou vazio","partes":[{"nome":"Maria da Silva","documento":"CPF/CNPJ se constar","papel":"titular"}],"numero_processo":"se constar","tags":["até 5 palavras-chave"]}]}`;

  const limpar = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  const dataValida = (v) => { const s = limpar(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null; };
  function segmento(s, pi, pf) {
    return {
      pagina_inicial: pi, pagina_final: pf, categoria: Docs.CATEGORIAS.includes(s.categoria) ? s.categoria : 'outros',
      titulo: limpar(s.titulo, 160) || 'Documento sem título', resumo: limpar(s.resumo, 500), data_documento: dataValida(s.data_documento),
      tags: (Array.isArray(s.tags) ? s.tags : []).map((t) => limpar(t, 30)).filter(Boolean).slice(0, 6),
      partes: (Array.isArray(s.partes) ? s.partes : []).slice(0, 8).map((p) => ({ nome: limpar(p && p.nome, 160), documento: limpar(p && p.documento, 30), papel: limpar(p && p.papel, 40) })).filter((p) => p.nome),
      numero_processo: limpar(s.numero_processo, 40),
    };
  }
  function normalizarSegmentos(brutos, n, ehPdf) {
    const lista = (Array.isArray(brutos) ? brutos : []).slice(0, 30);
    if (!ehPdf || n <= 1 || lista.length <= 1) return [segmento(lista[0] || {}, 1, Math.max(n, 1))];
    const ord = lista.map((s) => ({ s, pi: Math.max(1, Math.min(n, parseInt(s.pagina_inicial, 10) || 1)), pf: Math.max(1, Math.min(n, parseInt(s.pagina_final, 10) || n)) }))
      .filter((x) => x.pi <= x.pf).sort((a, b) => a.pi - b.pi);
    const lacuna = (a, b) => segmento({ categoria: 'outros', titulo: a === b ? `Página ${a} (não identificada)` : `Páginas ${a}–${b} (não identificadas)`, resumo: '' }, a, b);
    const out = []; let prox = 1;
    for (const { s, pi, pf } of ord) {
      if (pf < prox) continue;
      const ini = Math.max(pi, prox);
      if (ini > prox) out.push(lacuna(prox, ini - 1));
      out.push(segmento(s, ini, pf)); prox = pf + 1;
    }
    if (prox <= n) out.push(lacuna(prox, n));
    return out.length ? out : [segmento(lista[0] || {}, 1, n)];
  }

  // cruzamento LOCAL com o cadastro (a lista de clientes nunca vai para a IA)
  const soDigitos = (s) => String(s || '').replace(/\D/g, '');
  const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  const tokens = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t));
  function vincular(seg) {
    const clientes = Dados.lista('clientes').filter((c) => c.ativo !== 0 && c.ativo !== false), processos = Dados.lista('processos');
    const porId = new Map(clientes.map((c) => [c.id, c]));
    const res = { cliente_id: null, processo_id: null, confianca: null, motivo: '', candidatos: [] };
    const nomeCli = (id) => (porId.get(id) || Dados.obter('clientes', id) || {}).nome || '';
    const num = soDigitos(seg.numero_processo);
    if (num.length >= 15) {
      const p = processos.find((x) => soDigitos(x.numero) === num);
      if (p) return { ...res, cliente_id: p.cliente_id, processo_id: p.id, confianca: 'alta', motivo: `Número do processo ${seg.numero_processo} é do caso “${p.titulo}”.`, candidatos: [{ id: p.cliente_id, nome: nomeCli(p.cliente_id) }] };
    }
    for (const dg of seg.partes.map((p) => soDigitos(p.documento)).filter((d) => d.length === 11 || d.length === 14)) {
      const c = clientes.find((x) => soDigitos(x.documento) === dg);
      if (c) return { ...res, cliente_id: c.id, confianca: 'alta', motivo: `CPF/CNPJ ${seg.partes.find((p) => soDigitos(p.documento) === dg).documento} confere com o cadastro.`, candidatos: [{ id: c.id, nome: c.nome }] };
    }
    const achados = [];
    for (const c of clientes) {
      const tc = tokens(c.nome); if (tc.length < 2) continue;
      let melhor = null;
      for (const p of seg.partes) {
        const tp = tokens(p.nome); if (tp.length < 2) continue;
        const a = new Set(tc), b = new Set(tp);
        const iguais = tc.length === tp.length && tc.every((t) => b.has(t)), contido = tc.every((t) => b.has(t)) || tp.every((t) => a.has(t));
        const nivel = iguais ? 'media' : contido ? 'baixa' : null;
        if (nivel && (!melhor || (nivel === 'media' && melhor.nivel === 'baixa'))) melhor = { nivel, nome: p.nome };
      }
      if (melhor) achados.push({ c, ...melhor });
    }
    achados.sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'media' ? -1 : 1));
    res.candidatos = achados.slice(0, 4).map((x) => ({ id: x.c.id, nome: x.c.nome }));
    if (achados.length) {
      const top = achados[0];
      if (achados.filter((x) => x.nivel === top.nivel).length === 1) { res.cliente_id = top.c.id; res.confianca = top.nivel; res.motivo = `Nome “${top.nome}” ${top.nivel === 'media' ? 'coincide com' : 'parece com'} o cliente cadastrado. Confira.`; }
      else res.motivo = 'Há mais de um cliente com nome parecido — escolha o correto.';
    }
    return res;
  }

  async function analisar(doc) {
    const B = Dados.backend;
    if (!B.iaOk) throw new Error('A organização por IA não está disponível neste ambiente.');
    const e = Docs.ext(doc.nome_original), u8 = await Arq.ler(doc.asset_id);
    let paginas = 1, entrada = '', imagens = [];
    if (e === '.pdf') {
      let textos = []; try { textos = await Docs.paginasPdf(u8); } catch { /* escaneado */ }
      paginas = textos.total || textos.length || await Docs.contarPaginas(u8);
      if (textos.join('').trim().length > 200) {
        let total = 0; const partes = [];
        for (let i = 0; i < textos.length && total < 120000; i++) { const t = textos[i].slice(0, 2500) || '[página sem texto]'; total += t.length; partes.push(`=== Página ${i + 1} ===\n${t}`); }
        entrada = partes.join('\n\n');
      } else if (B.imagensOk) {
        imagens = await Docs.paginasComoImagens(u8, { max: Math.min(B.limiteImagens || 6, 8) });
        entrada = `[PDF escaneado: as ${imagens.length} primeira(s) página(s) seguem como imagens, na ordem.]`;
      } else throw new Error('Este PDF é escaneado e a leitura de imagens não está disponível neste ambiente.');
    } else if (ehImagem(e) && B.imagensOk) { imagens = [new Blob([u8], { type: Docs.TIPOS[e] })]; entrada = '[Imagem anexada.]'; }
    else if (doc.tem_texto) entrada = (await Dados.lerTexto(doc.id)).slice(0, 30000);
    const prompt = `${SISTEMA_ORGANIZAR}\n\nArquivo: "${doc.nome_original}" — ${paginas} página(s)${entrada ? '' : ' (conteúdo ilegível: classifique pelo nome do arquivo)'}.\n\n${entrada}`;
    let r;
    try { r = await B.iaJson(prompt, { cache: false, ...(imagens.length ? { images: imagens } : {}) }); }
    catch (er) { const x = new Error(erroAmigavel(er)); x.code = er && er.code; throw x; }
    const brutos = Array.isArray(r) ? r : r && r.documentos;
    const segmentos = normalizarSegmentos(brutos, paginas, e === '.pdf').map((s) => ({ ...s, vinculo: vincular(s) }));
    const dup = Dados.lista('documentos').filter((d) => d.sha256 && d.sha256 === doc.sha256 && d.id !== doc.id).sort((a, b) => a.id - b.id)[0];
    return { paginas, segmentos, duplicado: dup ? { id: dup.id, titulo: dup.titulo } : null, geradoEm: new Date().toISOString() };
  }

  return { conversar, analisar, erroAmigavel, normalizarSegmentos, vincular, promptSistema };
})();

/* LocalAPI (parte 2): documentos, organização por IA e conversas do assistente. */
// Arquivos: sempre cifrados antes de ir para o armazenamento (texto base64) e decifrados ao ler
const Arq = {
  async guardar(u8) { return Dados.backend.enviarArquivo(new Blob([await Cofre.bytes(Dados.master, u8)], { type: 'text/plain' })); },
  async ler(id) { return Cofre.lerBytes(Dados.master, String(await Dados.backend.lerArquivo(id)).trim()); },
  apagar(id) { return Dados.backend.excluirArquivo(id); },
};

(() => {
  const { rota, HttpError, bad, notFound, txt, req_, id_, dataISO, ou404, cliNome, auditar, desc, pastaPadraoPara, sessao } = LocalAPI;

  function vinculos(b) {
    const cliente_id = id_(b.cliente_id) || null, processo_id = id_(b.processo_id) || null, atendimento_id = id_(b.atendimento_id) || null;
    if (cliente_id && !Dados.obter('clientes', cliente_id)) throw bad('Cliente inválido.');
    if (processo_id) {
      const p = Dados.obter('processos', processo_id);
      if (!p) throw bad('Processo inválido.');
      if (cliente_id && p.cliente_id !== cliente_id) throw bad('O processo não pertence a este cliente.');
    }
    if (atendimento_id && !Dados.obter('atendimentos', atendimento_id)) throw bad('Atendimento inválido.');
    return { cliente_id, processo_id, atendimento_id };
  }
  // Pasta de cliente só recebe documentos desse cliente (e, se o documento ainda não tem cliente, ele passa a ser dele)
  function resolverPasta(valor, vinc) {
    const id = id_(valor); if (!id) return null;
    const p = Dados.obter('pastas', id); if (!p) throw notFound('Pasta');
    if (p.cliente_id && vinc.cliente_id && vinc.cliente_id !== p.cliente_id) throw bad('A pasta escolhida pertence a outro cliente.');
    if (!p.cliente_id && vinc.cliente_id) throw bad('A pasta escolhida é geral; para documentos de clientes use uma pasta do cliente.');
    if (p.cliente_id && !vinc.cliente_id) vinc.cliente_id = p.cliente_id;
    return p.id;
  }
  const nomeSeguro = (t, padrao) => (String(t).replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 100) || padrao);

  async function criarDocumento({ u8, nomeOriginal, titulo, categoria, vinc, pasta_id = null, origem = 'upload', extra = {} }) {
    const e = Docs.ext(nomeOriginal), texto = await Docs.extrairTexto(u8, e), sha = await Cofre.sha256(u8);
    const asset_id = await Arq.guardar(u8), u = sessao.usuario, id = Dados.novoId('documentos');
    const reg = {
      id, cliente_id: vinc.cliente_id, processo_id: vinc.processo_id, atendimento_id: vinc.atendimento_id, pasta_id, titulo, categoria, nome_original: nomeOriginal, mime: Docs.TIPOS[e] || 'application/octet-stream',
      tamanho: u8.length, asset_id, sha256: sha, tem_texto: !!texto, origem, usuario_id: u.id, usuario_nome: u.nome, criado_em: Dados.agora(),
      resumo: extra.resumo || null, data_documento: extra.data_documento || null, tags: extra.tags || null, ia_status: extra.ia_status || null, ia_sugestao: null,
    };
    try { await Dados.gravar('documentos', reg); if (texto) await Dados.gravarTexto(id, texto); }
    catch (er) { await Arq.apagar(asset_id); throw er; }
    return id;
  }
  const linhaDoc = (d) => ({
    id: d.id, titulo: d.titulo, categoria: d.categoria, nome_original: d.nome_original, mime: d.mime, tamanho: d.tamanho, origem: d.origem, criado_em: d.criado_em,
    cliente_id: d.cliente_id, processo_id: d.processo_id, atendimento_id: d.atendimento_id, cliente: d.cliente_id ? cliNome(d.cliente_id) : null,
    processo: d.processo_id ? (Dados.obter('processos', d.processo_id) || {}).titulo || null : null, enviado_por: d.usuario_nome || null,
    resumo: d.resumo, data_documento: d.data_documento, tags: d.tags, ia_status: d.ia_status, pasta_id: d.pasta_id || null, pasta: d.pasta_id ? (Dados.obter('pastas', d.pasta_id) || {}).nome || null : null, tem_texto: d.tem_texto ? 1 : 0,
  });

  rota('GET', '/documentos', async ({ q }) => {
    const t = LocalAPI.norm(q.q).trim(); let l = Dados.lista('documentos');
    if (t) {
      const textos = t.length >= 3 ? await Dados.todosTextos() : new Map();
      l = l.filter((d) => LocalAPI.norm([d.titulo, d.nome_original, d.cliente_id ? cliNome(d.cliente_id) : '', d.resumo, d.tags].join(' ')).includes(t) || LocalAPI.norm(textos.get(d.id) || '').includes(t));
    }
    if (q.categoria) l = l.filter((d) => d.categoria === q.categoria);
    if (id_(q.cliente_id)) l = l.filter((d) => d.cliente_id === id_(q.cliente_id));
    if (id_(q.processo_id)) l = l.filter((d) => d.processo_id === id_(q.processo_id));
    if (q.sem_cliente === '1') l = l.filter((d) => !d.cliente_id);
    if (q.pasta_id === '0') l = l.filter((d) => !d.pasta_id); else if (id_(q.pasta_id)) l = l.filter((d) => d.pasta_id === id_(q.pasta_id));
    return l.sort(desc('id')).slice(0, 500).map(linhaDoc);
  });

  rota('POST', '/documentos', async ({ form }) => {
    if (!form) throw bad('Envio inválido.');
    const arquivos = form.getAll('arquivos').filter((f) => f && typeof f !== 'string');
    if (!arquivos.length) throw bad('Selecione ao menos um arquivo.');
    const g = (k) => { const v = form.get(k); return v == null ? '' : v; };
    const categoria = Docs.CATEGORIAS.includes(g('categoria')) ? g('categoria') : 'outros';
    const vinc = vinculos({ cliente_id: g('cliente_id'), processo_id: g('processo_id'), atendimento_id: g('atendimento_id') });
    const pasta_id = resolverPasta(g('pasta_id'), vinc), titulo = txt(g('titulo'), 200), ids = [];
    for (const f of arquivos) if (f.size > Docs.MAX_UPLOAD) throw bad(`“${f.name}” tem mais de ${Math.round(Docs.MAX_UPLOAD / 1048576)} MB.`);
    if (g('juntar_pdf') === '1') {
      const itens = [];
      for (const f of arquivos) itens.push({ u8: await Docs.para8(f), ext: Docs.ext(f.name) });
      const t = titulo || `Documento escaneado ${new Date().toLocaleDateString('pt-BR')}`;
      const id = await criarDocumento({ u8: await Docs.imagensParaPdf(itens), nomeOriginal: `${nomeSeguro(t, 'Documento escaneado')}.pdf`, titulo: t, categoria, vinc, pasta_id, origem: 'scanner' });
      await auditar('enviar', 'documentos', id, `${t}.pdf (${arquivos.length} páginas)`); return { ids: [id] };
    }
    for (const f of arquivos) {
      const nome = String(f.name).replace(/[\\/\0]/g, '_').slice(0, 200), e = Docs.ext(nome);
      if (!Docs.TIPOS[e]) throw bad(`Tipo de arquivo não permitido: ${nome}`);
      const t = arquivos.length === 1 && titulo ? titulo : (titulo ? `${titulo} — ${nome}` : nome.slice(0, nome.length - e.length));
      const id = await criarDocumento({ u8: await Docs.para8(f), nomeOriginal: nome, titulo: t, categoria, vinc, pasta_id });
      await auditar('enviar', 'documentos', id, nome); ids.push(id);
    }
    return { ids };
  });

  rota('GET', '/documentos/:id', ({ params }) => {
    const d = ou404('documentos', params.id, 'Documento');
    return { id: d.id, titulo: d.titulo, categoria: d.categoria, nome_original: d.nome_original, mime: d.mime, tamanho: d.tamanho, cliente_id: d.cliente_id, processo_id: d.processo_id, atendimento_id: d.atendimento_id };
  });
  rota('PUT', '/documentos/:id', async ({ params, body }) => {
    const d = ou404('documentos', params.id, 'Documento'), vinc = vinculos(body), titulo = txt(body.titulo, 200);
    if (!titulo) throw bad('Informe o título.');
    let pasta_id = d.pasta_id || null;
    if (pasta_id) { const p = Dados.obter('pastas', pasta_id); if (!p || (p.cliente_id || null) !== (vinc.cliente_id || null)) pasta_id = null; }   // trocou de cliente: sai da pasta anterior
    await Dados.alterar('documentos', d.id, { titulo, categoria: Docs.CATEGORIAS.includes(body.categoria) ? body.categoria : 'outros', cliente_id: vinc.cliente_id, processo_id: vinc.processo_id, atendimento_id: vinc.atendimento_id, pasta_id });
    await auditar('editar', 'documentos', d.id, titulo); return { ok: true };
  });
  rota('GET', '/documentos/:id/texto', async ({ params }) => { const d = ou404('documentos', params.id, 'Documento'); return { id: d.id, titulo: d.titulo, texto: await Dados.lerTexto(d.id) }; });
  rota('DELETE', '/documentos/:id', async ({ params }) => {
    const d = ou404('documentos', params.id, 'Documento');
    for (const p of Dados.lista('pendencias').filter((x) => x.documento_id === d.id)) await Dados.alterar('pendencias', p.id, { documento_id: null });
    for (const n of Dados.lista('notas').filter((x) => x.entidade === 'documento' && x.entidade_id === d.id)) await Dados.remover('notas', n.id);
    await Dados.remover('documentos', d.id); await Dados.removerTexto(d.id); await Arq.apagar(d.asset_id);
    await auditar('excluir', 'documentos', d.id, d.titulo); return { ok: true };
  });

  // ---------- organização por IA ----------
  const docOu404 = (id) => ou404('documentos', id, 'Documento');
  rota('POST', '/documentos/:id/organizar', async ({ params }) => {
    const d = docOu404(params.id), sug = await IA.analisar(d);
    await Dados.alterar('documentos', d.id, { ia_status: 'sugerido', ia_sugestao: JSON.stringify(sug) });
    await auditar('organizar_ia', 'documentos', d.id, d.nome_original);
    return { id: d.id, nome_original: d.nome_original, titulo_atual: d.titulo, ...sug };
  });
  rota('GET', '/documentos/:id/sugestao', ({ params }) => {
    const d = docOu404(params.id); if (!d.ia_sugestao) throw notFound('Sugestão');
    return { id: d.id, nome_original: d.nome_original, titulo_atual: d.titulo, ...JSON.parse(d.ia_sugestao) };
  });
  rota('POST', '/documentos/:id/organizar/descartar', async ({ params }) => { const d = docOu404(params.id); await Dados.alterar('documentos', d.id, { ia_status: 'ignorado', ia_sugestao: null }); return { ok: true }; });
  function lerSegmento(s) {
    const titulo = txt(s.titulo, 200); if (!titulo) throw bad('Informe o título de cada documento.');
    return {
      pi: parseInt(s.pagina_inicial, 10) || 1, pf: parseInt(s.pagina_final, 10) || 1, titulo, categoria: Docs.CATEGORIAS.includes(s.categoria) ? s.categoria : 'outros', resumo: txt(s.resumo, 600),
      data_documento: dataISO(s.data_documento, 'data do documento'),
      tags: Array.isArray(s.tags) ? s.tags.map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 6).join(', ') || null : null,
    };
  }
  rota('POST', '/documentos/:id/organizar/aplicar', async ({ params, body }) => {
    const d = docOu404(params.id), lista = (Array.isArray(body.segmentos) ? body.segmentos : []).slice(0, 30);
    if (!lista.length) throw bad('Nada para aplicar.');
    const segs = lista.map((s) => ({ ...lerSegmento(s), vinc: vinculos({ cliente_id: s.cliente_id, processo_id: s.processo_id, atendimento_id: d.atendimento_id }) }));
    if (segs.length === 1) {
      const s = segs[0], atual = d.pasta_id ? Dados.obter('pastas', d.pasta_id) : null;
      const pasta = atual && (atual.cliente_id || null) === (s.vinc.cliente_id || null) ? d.pasta_id : pastaPadraoPara(s.vinc.cliente_id, s.categoria);
      await Dados.alterar('documentos', d.id, { titulo: s.titulo, categoria: s.categoria, cliente_id: s.vinc.cliente_id, processo_id: s.vinc.processo_id, resumo: s.resumo, data_documento: s.data_documento, tags: s.tags, pasta_id: pasta, ia_status: 'aplicado', ia_sugestao: null });
      await auditar('organizar_aplicar', 'documentos', d.id, s.titulo); return { ids: [d.id], removido: false };
    }
    if (Docs.ext(d.nome_original) !== '.pdf') throw bad('Só é possível separar arquivos PDF.');
    const origem = await Docs.carregarPdf(await Arq.ler(d.asset_id)), n = origem.getPageCount();
    const ord = [...segs].sort((a, b) => a.pi - b.pi); let ultimo = 0;
    for (const s of ord) {
      if (s.pi < 1 || s.pf > n || s.pi > s.pf) throw bad(`Intervalo de páginas inválido (${s.pi}–${s.pf}); o arquivo tem ${n} páginas.`);
      if (s.pi <= ultimo) throw bad('Os intervalos de páginas não podem se sobrepor.');
      ultimo = s.pf;
    }
    const ids = [];
    for (const s of ord) {
      ids.push(await criarDocumento({ u8: await Docs.extrairPaginas(origem, s.pi, s.pf), nomeOriginal: `${nomeSeguro(s.titulo, 'Documento')}.pdf`, titulo: s.titulo, categoria: s.categoria, vinc: s.vinc, pasta_id: pastaPadraoPara(s.vinc.cliente_id, s.categoria), origem: 'separado',
        extra: { resumo: s.resumo, data_documento: s.data_documento, tags: s.tags, ia_status: 'aplicado' } }));
    }
    const cobertas = ord.reduce((t, s) => t + (s.pf - s.pi + 1), 0);        // o original só some se TODAS as páginas foram aproveitadas
    let removido = false;
    if (body.remover_original && cobertas === n) {
      for (const p of Dados.lista('pendencias').filter((x) => x.documento_id === d.id)) await Dados.alterar('pendencias', p.id, { documento_id: null });
      await Dados.remover('documentos', d.id); await Dados.removerTexto(d.id); await Arq.apagar(d.asset_id); removido = true;
    } else await Dados.alterar('documentos', d.id, { ia_status: 'aplicado', ia_sugestao: null });
    await auditar('separar_ia', 'documentos', d.id, `${d.nome_original} → ${ids.length} documentos${removido ? ' (original removido)' : ''}`);
    return { ids, removido };
  });

  // ---------- conversas do assistente (privadas de cada pessoa) ----------
  const convOu404 = (id) => ou404('conversas', id, 'Conversa');
  function lerCtx(b) {
    const docs = (Array.isArray(b.documentos_ids) ? b.documentos_ids : []).map(id_).filter(Boolean).slice(0, 15);
    return { cliente_id: id_(b.cliente_id) || null, processo_id: id_(b.processo_id) || null, documentos_ids: [...new Set(docs)] };
  }
  rota('GET', '/ia/status', () => ({ configurado: !!Dados.backend.iaOk, modelo: Dados.backend.tipo === 'claude' ? 'Claude (conta de cada pessoa)' : 'Claude (chave informada)' }));
  rota('GET', '/ia/conversas', () => Dados.lista('conversas').sort(desc('atualizado_em')).slice(0, 100).map((c) => ({ id: c.id, titulo: c.titulo, atualizado_em: c.atualizado_em, cliente: c.cliente_id ? cliNome(c.cliente_id) : null })));
  rota('POST', '/ia/conversas', async ({ body }) => {
    const agora = Dados.agora(), reg = { id: Dados.novoId('conversas'), titulo: txt(body.titulo, 120) || 'Nova conversa', ...lerCtx(body), mensagens: [], criado_em: agora, atualizado_em: agora };
    await Dados.gravar('conversas', reg); return { id: reg.id };
  });
  rota('GET', '/ia/conversas/:id', ({ params }) => {
    const c = convOu404(params.id);
    return { ...c, documentos: (c.documentos_ids || []).map((id) => Dados.obter('documentos', id)).filter(Boolean).map((d) => ({ id: d.id, titulo: d.titulo, nome_original: d.nome_original })), mensagens: c.mensagens || [] };
  });
  rota('PUT', '/ia/conversas/:id', async ({ params, body }) => { const c = convOu404(params.id); await Dados.alterar('conversas', c.id, lerCtx(body)); return { ok: true }; });
  rota('DELETE', '/ia/conversas/:id', async ({ params }) => { const c = convOu404(params.id); await Dados.remover('conversas', c.id); return { ok: true }; });

  const tamanhoJson = (m) => JSON.stringify(m).length;
  async function enviarMensagem(convId, texto, op = {}) {
    const conv = convOu404(convId); texto = req_(texto, 'mensagem', 30000);
    const salvar = async (resposta) => {
      const agora = Dados.agora(), t0 = Date.now();
      let msgs = [...(conv.mensagens || []), { id: t0, papel: 'user', conteudo: texto, criado_em: agora }, { id: t0 + 1, papel: 'assistant', conteudo: resposta || '(sem resposta)', criado_em: agora }];
      while (tamanhoJson(msgs) > 110000 && msgs.length > 2) msgs = msgs.slice(2);          // cada registro tem limite de tamanho: descarta o mais antigo
      await Dados.alterar('conversas', conv.id, { mensagens: msgs, atualizado_em: agora, titulo: conv.titulo === 'Nova conversa' ? texto.replace(/\s+/g, ' ').slice(0, 70) : conv.titulo });
      await auditar('consulta_ia', 'conversas', conv.id, texto.slice(0, 120));
    };
    try { const r = await IA.conversar(conv, texto, op); await salvar(r.texto); return r; }
    catch (e) { if (e && e.code === 'cancelled' && e.text) await salvar(e.text + '\n\n_(resposta interrompida)_'); throw e; }
  }

  // ---------- Word e ZIP ----------
  function docxBlob(body) {
    const texto = req_(body.texto, 'texto', 200000);
    return new Blob([Docs.gerarDocx(texto, { escritorio: FIRMA.nome })], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  rota('POST', '/ia/exportar-docx', async ({ body }) => {
    if (!body.salvar) throw bad('Use o download para obter o arquivo.');
    const titulo = txt(body.titulo, 150) || 'Minuta', blob = docxBlob(body), vinc = vinculos(body), pasta_id = resolverPasta(body.pasta_id, vinc);
    const id = await criarDocumento({ u8: new Uint8Array(await blob.arrayBuffer()), nomeOriginal: `${nomeSeguro(titulo, 'Minuta').replace(/\s+/g, '_')}.docx`, titulo, categoria: 'peticao', vinc, pasta_id: pasta_id || pastaPadraoPara(vinc.cliente_id, 'peticao'), origem: 'ia' });
    await auditar('salvar_minuta_ia', 'documentos', id, titulo); return { id };
  });
  async function zipBlob(idsBrutos) {
    const ids = [...new Set((Array.isArray(idsBrutos) ? idsBrutos : []).map(id_).filter(Boolean))].slice(0, 300);
    if (!ids.length) throw bad('Selecione ao menos um documento.');
    const docs = ids.map((id) => Dados.obter('documentos', id)).filter(Boolean);
    if (!docs.length) throw notFound('Documento');
    if (docs.reduce((n, d) => n + d.tamanho, 0) > 200 * 1048576) throw bad('Os arquivos somam mais de 200 MB. Selecione menos documentos.');
    const arquivos = {}, usados = new Set();
    for (const d of docs.sort((a, b) => a.id - b.id)) {
      let nome = d.nome_original.replace(/[\\/:*?"<>|\0]/g, '_');
      while (usados.has(nome.toLowerCase())) { const e = Docs.ext(nome); nome = `${nome.slice(0, nome.length - e.length)} (${d.id})${e}`; }
      usados.add(nome.toLowerCase()); arquivos[nome] = await Arq.ler(d.asset_id);
    }
    await auditar('baixar_zip', 'documentos', null, `${docs.length} arquivos`);
    return new Blob([Docs.zipar(arquivos)], { type: 'application/zip' });
  }
  async function blob(url, body) {                                       // rotas que devolvem arquivo (usadas por "baixarBlob")
    if (url === '/documentos/zip') return zipBlob(body.ids);
    if (url === '/ia/exportar-docx') return docxBlob(body);
    throw new HttpError(404, 'Rota não encontrada.');
  }
  async function bytesDoc(id, acao = 'visualizar') {
    const d = docOu404(id), u8 = await Arq.ler(d.asset_id); await auditar(acao, 'documentos', d.id, d.nome_original); return { u8, doc: d };
  }
  async function baixarDoc(id) { const { u8, doc } = await bytesDoc(id, 'baixar'); await Docs.entregar(doc.nome_original, new Blob([u8], { type: doc.mime })); }

  Object.assign(LocalAPI, { blob, zipBlob, docxBlob, enviarMensagem, bytesDoc, baixarDoc, criarDocumento, vinculos });
})();

/* LocalAPI: as mesmas rotas do servidor, executadas no navegador sobre os dados cifrados. */
const LocalAPI = (() => {
  class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const bad = (m) => new HttpError(400, m), notFound = (w = 'Registro') => new HttpError(404, `${w} não encontrado.`);
  const sessao = { usuario: { id: null, nome: 'Você', papel: 'admin' } };

  // ---------- validação (igual ao servidor) ----------
  const txt = (v, max = 500) => { if (v == null) return null; const s = String(v).trim(); if (!s) return null; if (s.length > max) throw bad(`Texto muito longo (máx. ${max} caracteres).`); return s; };
  const req_ = (v, nome, max = 300) => { const s = txt(v, max); if (!s) throw bad(`Informe: ${nome}.`); return s; };
  const oneOf = (v, l, n) => { if (!l.includes(v)) throw bad(`Valor inválido para ${n}.`); return v; };
  const id_ = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
  function dataISO(v, nome, { obrigatoria = false } = {}) {
    const s = txt(v, 40);
    if (!s) { if (obrigatoria) throw bad(`Informe: ${nome}.`); return null; }
    if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(s) || isNaN(Date.parse(s))) throw bad(`Data inválida: ${nome}.`);
    return s.replace('T', ' ');
  }
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const pad = (n) => String(n).padStart(2, '0');
  const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  const desc = (campo) => (a, b) => (b[campo] > a[campo] ? 1 : b[campo] < a[campo] ? -1 : 0);
  function checarVersao(enviada, atual) {
    if (enviada === undefined || enviada === null || enviada === '') return;
    if (Number(enviada) !== (atual || 1)) throw new HttpError(409, 'Este registro foi alterado por outra pessoa depois que você o abriu. Feche esta janela e clique em Editar de novo para ver as mudanças antes de salvar.');
  }
  const mudancas = (atual, novo) => { const o = {}; for (const [k, v] of Object.entries(novo)) if (JSON.stringify(atual[k]) !== JSON.stringify(v)) o[k] = v; return o; };
  const ou404 = (nome, id, rotulo) => { const r = Dados.obter(nome, id_(id)); if (!r) throw notFound(rotulo); return r; };
  const cliNome = (id) => (Dados.obter('clientes', id) || {}).nome || null;

  // ---------- auditoria ----------
  async function auditar(acao, entidade, entidadeId, detalhe) {
    try {
      const u = sessao.usuario;
      await Dados.gravar('auditoria', { id: Dados.novoId('auditoria'), usuario_id: u.id, usuario_nome: u.nome, acao, entidade: entidade || null, entidade_id: entidadeId || null, detalhe: detalhe ? String(detalhe).slice(0, 500) : null, criado_em: Dados.agora() });
      const todas = Dados.lista('auditoria');
      if (todas.length > 3000) for (const a of todas.sort((x, y) => x.id - y.id).slice(0, 500)) await Dados.remover('auditoria', a.id);   // mantém o histórico recente
    } catch { /* a auditoria nunca impede a ação */ }
  }

  // ---------- roteador ----------
  const rotas = [];
  const rota = (metodo, padrao, fn) => {
    const nomes = [];
    const re = new RegExp('^' + padrao.replace(/:(\w+)/g, (_, n) => { nomes.push(n); return '([^/]+)'; }) + '$');
    rotas.push({ metodo, re, nomes, fn });
  };
  async function handle(metodo, url, corpo) {
    const [caminho, consulta = ''] = String(url).split('?');
    const q = Object.fromEntries(new URLSearchParams(consulta));
    for (const r of rotas) {
      if (r.metodo !== metodo) continue;
      const m = r.re.exec(caminho); if (!m) continue;
      const params = {}; r.nomes.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      const form = typeof FormData !== 'undefined' && corpo instanceof FormData ? corpo : null;
      return r.fn({ params, q, body: form ? {} : (corpo || {}), form, usuario: sessao.usuario });
    }
    throw new HttpError(404, 'Rota não encontrada.');
  }

  const AREAS = ['Cível', 'Trabalhista', 'Família e Sucessões', 'Previdenciário', 'Consumidor', 'Criminal', 'Tributário', 'Empresarial', 'Imobiliário', 'Administrativo', 'Outra'];
  const CANAIS = ['presencial', 'telefone', 'whatsapp', 'videochamada', 'e-mail', 'outro'];
  const STATUS = ['consultivo', 'em_andamento', 'suspenso', 'encerrado'];
  rota('GET', '/opcoes', () => ({ areas: AREAS, canais: CANAIS, status: STATUS, usuarios: [] }));

  // ======================= CLIENTES =======================
  const CAMPOS_CLIENTE = ['tipo', 'nome', 'documento', 'rg', 'estado_civil', 'profissao', 'nascimento', 'email', 'telefone', 'endereco', 'observacoes'];
  function lerCliente(b) {
    return {
      tipo: oneOf(b.tipo || 'PF', ['PF', 'PJ'], 'tipo'), nome: req_(b.nome, 'nome do cliente', 160), documento: txt(b.documento, 30), rg: txt(b.rg, 30), estado_civil: txt(b.estado_civil, 30),
      profissao: txt(b.profissao, 80), nascimento: dataISO(b.nascimento, 'nascimento'), email: txt(b.email, 160), telefone: txt(b.telefone, 40), endereco: txt(b.endereco, 300), observacoes: txt(b.observacoes, 5000),
    };
  }
  rota('GET', '/clientes', ({ q }) => {
    const termo = norm(q.q).trim(), inativos = q.inativos === '1';
    const nProc = new Map(), nAt = new Map(), ult = new Map();
    Dados.lista('processos').forEach((p) => nProc.set(p.cliente_id, (nProc.get(p.cliente_id) || 0) + 1));
    Dados.lista('atendimentos').forEach((a) => { nAt.set(a.cliente_id, (nAt.get(a.cliente_id) || 0) + 1); if (!ult.has(a.cliente_id) || a.data_hora > ult.get(a.cliente_id)) ult.set(a.cliente_id, a.data_hora); });
    let l = Dados.lista('clientes').filter((c) => inativos || c.ativo);
    if (termo) l = l.filter((c) => norm([c.nome, c.documento, c.email, c.telefone].join(' ')).includes(termo));
    return l.sort(porNome).slice(0, 500).map((c) => ({ ...c, n_processos: nProc.get(c.id) || 0, n_atendimentos: nAt.get(c.id) || 0, ultimo_atendimento: ult.get(c.id) || null }));
  });
  rota('GET', '/clientes/:id', ({ params }) => {
    const c = ou404('clientes', params.id, 'Cliente');
    return {
      ...c,
      processos: Dados.lista('processos').filter((p) => p.cliente_id === c.id).sort(desc('id')),
      atendimentos: Dados.lista('atendimentos').filter((a) => a.cliente_id === c.id).sort(desc('data_hora')),
      documentos: Dados.lista('documentos').filter((d) => d.cliente_id === c.id).sort(desc('id')).map(({ id, titulo, categoria, nome_original, tamanho, criado_em, processo_id }) => ({ id, titulo, categoria, nome_original, tamanho, criado_em, processo_id })),
    };
  });
  rota('POST', '/clientes', async ({ body, usuario }) => {
    const c = lerCliente(body), agora = Dados.agora();
    const reg = { id: Dados.novoId('clientes'), ...c, ativo: 1, versao: 1, criado_por: usuario.id, criado_em: agora, atualizado_em: agora };
    await Dados.gravar('clientes', reg); await auditar('criar', 'clientes', reg.id, c.nome);
    return { id: reg.id };
  });
  rota('PUT', '/clientes/:id', async ({ params, body }) => {
    const atual = ou404('clientes', params.id, 'Cliente'); checarVersao(body.versao, atual.versao);
    const c = lerCliente(body), mud = mudancas(atual, c);
    await Dados.alterar('clientes', atual.id, { ...mud, atualizado_em: Dados.agora(), versao: (atual.versao || 1) + 1 });
    await auditar('editar', 'clientes', atual.id, c.nome); return { ok: true };
  });
  rota('POST', '/clientes/:id/ativo', async ({ params, body }) => {
    const atual = ou404('clientes', params.id, 'Cliente'), ativo = body.ativo ? 1 : 0;
    await Dados.alterar('clientes', atual.id, { ativo, versao: (atual.versao || 1) + 1 });
    await auditar(ativo ? 'reativar' : 'arquivar', 'clientes', atual.id); return { ok: true };
  });

  // ======================= CASOS =======================
  const CAMPOS_PROC = ['cliente_id', 'titulo', 'numero', 'area', 'juizo', 'parte_contraria', 'status', 'valor_causa', 'responsavel', 'observacoes'];
  function lerProcesso(b) {
    const cliente_id = id_(b.cliente_id);
    if (!cliente_id || !Dados.obter('clientes', cliente_id)) throw bad('Selecione o cliente.');
    let valor = null;
    if (b.valor_causa !== undefined && b.valor_causa !== null && b.valor_causa !== '') { valor = Number(b.valor_causa); if (!isFinite(valor) || valor < 0) throw bad('Valor da causa inválido.'); }
    return {
      cliente_id, titulo: req_(b.titulo, 'título do caso', 200), numero: txt(b.numero, 40), area: txt(b.area, 60), juizo: txt(b.juizo, 200), parte_contraria: txt(b.parte_contraria, 200),
      status: oneOf(b.status || 'em_andamento', STATUS, 'status'), valor_causa: valor, responsavel: txt(b.responsavel, 120), observacoes: txt(b.observacoes, 5000),
    };
  }
  rota('GET', '/processos', ({ q }) => {
    const termo = norm(q.q).trim(); let l = Dados.lista('processos');
    if (termo) l = l.filter((p) => norm([p.titulo, p.numero, cliNome(p.cliente_id), p.parte_contraria].join(' ')).includes(termo));
    if (q.status) l = l.filter((p) => p.status === q.status);
    if (id_(q.cliente_id)) l = l.filter((p) => p.cliente_id === id_(q.cliente_id));
    return l.sort(desc('atualizado_em')).slice(0, 500).map((p) => ({ ...p, cliente: cliNome(p.cliente_id) }));
  });
  rota('GET', '/processos/:id', ({ params }) => {
    const p = ou404('processos', params.id, 'Processo');
    return {
      ...p, cliente: cliNome(p.cliente_id),
      atendimentos: Dados.lista('atendimentos').filter((a) => a.processo_id === p.id).sort(desc('data_hora')),
      documentos: Dados.lista('documentos').filter((d) => d.processo_id === p.id).sort(desc('id')).map(({ id, titulo, categoria, nome_original, tamanho, criado_em }) => ({ id, titulo, categoria, nome_original, tamanho, criado_em })),
    };
  });
  rota('POST', '/processos', async ({ body }) => {
    const p = lerProcesso(body), agora = Dados.agora();
    const reg = { id: Dados.novoId('processos'), ...p, versao: 1, criado_em: agora, atualizado_em: agora };
    await Dados.gravar('processos', reg); await auditar('criar', 'processos', reg.id, p.titulo); return { id: reg.id };
  });
  rota('PUT', '/processos/:id', async ({ params, body }) => {
    const atual = ou404('processos', params.id, 'Processo'); checarVersao(body.versao, atual.versao);
    const p = lerProcesso(body);
    await Dados.alterar('processos', atual.id, { ...mudancas(atual, p), atualizado_em: Dados.agora(), versao: (atual.versao || 1) + 1 });
    await auditar('editar', 'processos', atual.id, p.titulo); return { ok: true };
  });

  // ======================= ATENDIMENTOS =======================
  const CAMPOS_AT = ['cliente_id', 'processo_id', 'data_hora', 'canal', 'assunto', 'resumo', 'providencias', 'prazo', 'concluido'];
  function lerAtendimento(b) {
    const cliente_id = id_(b.cliente_id);
    if (!cliente_id || !Dados.obter('clientes', cliente_id)) throw bad('Selecione o cliente.');
    const processo_id = id_(b.processo_id);
    if (processo_id) { const p = Dados.obter('processos', processo_id); if (!p || p.cliente_id !== cliente_id) throw bad('O processo não pertence a este cliente.'); }
    return {
      cliente_id, processo_id, data_hora: dataISO(b.data_hora, 'data e hora', { obrigatoria: true }), canal: oneOf(b.canal || 'presencial', CANAIS, 'canal'), assunto: req_(b.assunto, 'assunto', 200),
      resumo: txt(b.resumo, 20000), providencias: txt(b.providencias, 5000), prazo: dataISO(b.prazo, 'prazo'), concluido: b.concluido ? 1 : 0,
    };
  }
  const juntarAt = (a) => ({ ...a, cliente: cliNome(a.cliente_id), processo: a.processo_id ? (Dados.obter('processos', a.processo_id) || {}).titulo || null : null, atendente: a.usuario_nome || null });
  rota('GET', '/atendimentos', ({ q }) => {
    const termo = norm(q.q).trim(); let l = Dados.lista('atendimentos');
    if (termo) l = l.filter((a) => norm([a.assunto, a.resumo, cliNome(a.cliente_id)].join(' ')).includes(termo));
    if (q.canal) l = l.filter((a) => a.canal === q.canal);
    if (q.pendentes === '1') l = l.filter((a) => !a.concluido && a.prazo);
    if (id_(q.cliente_id)) l = l.filter((a) => a.cliente_id === id_(q.cliente_id));
    if (q.de) l = l.filter((a) => String(a.data_hora).slice(0, 10) >= q.de);
    if (q.ate) l = l.filter((a) => String(a.data_hora).slice(0, 10) <= q.ate);
    const nDocs = new Map(); Dados.lista('documentos').forEach((d) => { if (d.atendimento_id) nDocs.set(d.atendimento_id, (nDocs.get(d.atendimento_id) || 0) + 1); });
    return l.sort(desc('data_hora')).slice(0, 500).map((a) => ({ ...juntarAt(a), n_documentos: nDocs.get(a.id) || 0 }));
  });
  rota('GET', '/atendimentos/:id', ({ params }) => {
    const a = ou404('atendimentos', params.id, 'Atendimento');
    return { ...juntarAt(a), documentos: Dados.lista('documentos').filter((d) => d.atendimento_id === a.id).sort(desc('id')).map(({ id, titulo, categoria, nome_original, tamanho, criado_em }) => ({ id, titulo, categoria, nome_original, tamanho, criado_em })) };
  });
  rota('POST', '/atendimentos', async ({ body, usuario }) => {
    const a = lerAtendimento(body), agora = Dados.agora();
    const reg = { id: Dados.novoId('atendimentos'), ...a, usuario_id: usuario.id, usuario_nome: usuario.nome, versao: 1, criado_em: agora, atualizado_em: agora };
    await Dados.gravar('atendimentos', reg); await auditar('criar', 'atendimentos', reg.id, a.assunto); return { id: reg.id };
  });
  rota('PUT', '/atendimentos/:id', async ({ params, body }) => {
    const atual = ou404('atendimentos', params.id, 'Atendimento'); checarVersao(body.versao, atual.versao);
    const a = lerAtendimento(body);
    await Dados.alterar('atendimentos', atual.id, { ...mudancas(atual, a), atualizado_em: Dados.agora(), versao: (atual.versao || 1) + 1 });
    await auditar('editar', 'atendimentos', atual.id, a.assunto); return { ok: true };
  });
  rota('POST', '/atendimentos/:id/concluir', async ({ params, body }) => {
    const atual = ou404('atendimentos', params.id, 'Atendimento');
    await Dados.alterar('atendimentos', atual.id, { concluido: body.concluido ? 1 : 0, atualizado_em: Dados.agora(), versao: (atual.versao || 1) + 1 });
    await auditar(body.concluido ? 'concluir' : 'reabrir', 'atendimentos', atual.id); return { ok: true };
  });
  rota('DELETE', '/atendimentos/:id', async ({ params }) => {
    const a = ou404('atendimentos', params.id, 'Atendimento');
    for (const d of Dados.lista('documentos').filter((x) => x.atendimento_id === a.id)) await Dados.alterar('documentos', d.id, { atendimento_id: null });
    await Dados.remover('atendimentos', a.id); await auditar('excluir', 'atendimentos', a.id); return { ok: true };
  });

  // ======================= PAINEL E BUSCA =======================
  rota('GET', '/painel', () => {
    const hoje = hojeISO(), mes = hoje.slice(0, 7);
    const ativos = new Set(Dados.lista('clientes').filter((c) => c.ativo).map((c) => c.id));
    const pend = Dados.lista('pendencias').filter((p) => p.status === 'pendente' && ativos.has(p.cliente_id));
    const ordemPend = (a, b) => (a.prazo ? (b.prazo ? String(a.prazo).localeCompare(String(b.prazo)) : -1) : b.prazo ? 1 : 0) || a.id - b.id;
    return {
      totais: {
        clientes: ativos.size, processos: Dados.lista('processos').filter((p) => ['em_andamento', 'consultivo'].includes(p.status)).length,
        atendimentosMes: Dados.lista('atendimentos').filter((a) => String(a.data_hora).slice(0, 7) === mes).length, documentos: Dados.lista('documentos').length,
      },
      prazos: Dados.lista('atendimentos').filter((a) => !a.concluido && a.prazo).sort((a, b) => String(a.prazo).localeCompare(String(b.prazo))).slice(0, 12)
        .map((a) => ({ id: a.id, assunto: a.assunto, prazo: a.prazo, providencias: a.providencias, cliente: cliNome(a.cliente_id), cliente_id: a.cliente_id })),
      atendimentos: Dados.lista('atendimentos').sort(desc('data_hora')).slice(0, 8).map((a) => ({ id: a.id, assunto: a.assunto, data_hora: a.data_hora, canal: a.canal, cliente: cliNome(a.cliente_id), cliente_id: a.cliente_id })),
      documentos: Dados.lista('documentos').sort(desc('id')).slice(0, 6).map((d) => ({ id: d.id, titulo: d.titulo, categoria: d.categoria, criado_em: d.criado_em, cliente: d.cliente_id ? cliNome(d.cliente_id) : null })),
      pendencias: {
        abertas: pend.length, vencidas: pend.filter((p) => p.prazo && String(p.prazo).slice(0, 10) < hoje).length,
        lista: pend.sort(ordemPend).slice(0, 8).map((p) => ({ id: p.id, titulo: p.titulo, tipo: p.tipo, prazo: p.prazo, cliente: cliNome(p.cliente_id), cliente_id: p.cliente_id })),
      },
      hoje,
    };
  });
  rota('GET', '/busca', ({ q }) => {
    const t = norm(q.q).trim();
    if (t.length < 2) return { clientes: [], processos: [], atendimentos: [], documentos: [] };
    const tem = (...v) => norm(v.join(' ')).includes(t);
    return {
      clientes: Dados.lista('clientes').filter((c) => tem(c.nome, c.documento, c.email)).slice(0, 6).map(({ id, nome, documento }) => ({ id, nome, documento })),
      processos: Dados.lista('processos').filter((p) => tem(p.titulo, p.numero)).slice(0, 6).map((p) => ({ id: p.id, titulo: p.titulo, numero: p.numero, cliente: cliNome(p.cliente_id) })),
      atendimentos: Dados.lista('atendimentos').filter((a) => tem(a.assunto, a.resumo)).sort(desc('data_hora')).slice(0, 6).map((a) => ({ id: a.id, assunto: a.assunto, data_hora: a.data_hora, cliente: cliNome(a.cliente_id) })),
      documentos: Dados.lista('documentos').filter((d) => tem(d.titulo, d.nome_original, d.resumo, d.tags)).slice(0, 6).map(({ id, titulo, nome_original }) => ({ id, titulo, nome_original })),
    };
  });

  // ======================= OBSERVAÇÕES =======================
  const ENTIDADES = { cliente: 'clientes', processo: 'processos', documento: 'documentos' };
  function conferirEntidade(entidade, id) {
    oneOf(entidade, Object.keys(ENTIDADES), 'entidade');
    if (!id || !Dados.obter(ENTIDADES[entidade], id)) throw notFound('Item da observação');
  }
  const minhaNota = (id, usuario) => {
    const n = ou404('notas', id, 'Observação');
    if (n.usuario_id && usuario.id && n.usuario_id !== usuario.id && usuario.papel !== 'admin') throw new HttpError(403, 'Você só pode alterar as suas próprias observações.');
    return n;
  };
  rota('GET', '/notas', ({ q }) => {
    const e = String(q.entidade || ''), id = id_(q.id); conferirEntidade(e, id);
    return Dados.lista('notas').filter((n) => n.entidade === e && n.entidade_id === id).sort((a, b) => (b.fixada - a.fixada) || (b.id - a.id));
  });
  rota('POST', '/notas', async ({ body, usuario }) => {
    const e = String(body.entidade || ''), eid = id_(body.entidade_id); conferirEntidade(e, eid);
    const agora = Dados.agora();
    const reg = { id: Dados.novoId('notas'), entidade: e, entidade_id: eid, texto: req_(body.texto, 'observação', 5000), fixada: body.fixada ? 1 : 0, usuario_id: usuario.id, usuario_nome: usuario.nome, criado_em: agora, atualizado_em: agora };
    await Dados.gravar('notas', reg); await auditar('criar', 'notas', reg.id, `${e} #${eid}`); return { id: reg.id };
  });
  rota('PUT', '/notas/:id', async ({ params, body, usuario }) => {
    const n = minhaNota(params.id, usuario);
    await Dados.alterar('notas', n.id, { texto: body.texto !== undefined ? req_(body.texto, 'observação', 5000) : n.texto, fixada: body.fixada !== undefined ? (body.fixada ? 1 : 0) : n.fixada, atualizado_em: Dados.agora() });
    await auditar('editar', 'notas', n.id); return { ok: true };
  });
  rota('DELETE', '/notas/:id', async ({ params, usuario }) => {
    const n = minhaNota(params.id, usuario); await Dados.remover('notas', n.id); await auditar('excluir', 'notas', n.id, `${n.entidade} #${n.entidade_id}`); return { ok: true };
  });

  // ======================= PASTAS =======================
  const PADRAO = ['Identificação', 'Procurações e contratos', 'Comprovantes', 'Provas', 'Peças e decisões', 'Correspondência'];
  const PASTA_POR_CATEGORIA = { identificacao: 'Identificação', procuracao: 'Procurações e contratos', contrato: 'Procurações e contratos', comprovante: 'Comprovantes', prova: 'Provas', peticao: 'Peças e decisões', decisao: 'Peças e decisões', parecer: 'Peças e decisões', correspondencia: 'Correspondência' };
  const pastaOu404 = (id) => ou404('pastas', id, 'Pasta');
  const mesmoEscopo = (a, b) => (a || null) === (b || null);
  const existeIrma = (nome, parent, cliente, ignorar = 0) => Dados.lista('pastas').some((p) => p.id !== ignorar && norm(p.nome) === norm(nome) && mesmoEscopo(p.parent_id, parent) && mesmoEscopo(p.cliente_id, cliente));
  function ehDescendente(candidato, ancestral) {
    for (let a = candidato, i = 0; a && i < 50; i++) { if (a === ancestral) return true; a = (Dados.obter('pastas', a) || {}).parent_id; }
    return false;
  }
  function pastaPadraoPara(cliente_id, categoria) {
    const nome = PASTA_POR_CATEGORIA[categoria]; if (!cliente_id || !nome) return null;
    const p = Dados.lista('pastas').find((x) => x.cliente_id === cliente_id && !x.parent_id && norm(x.nome) === norm(nome));
    return p ? p.id : null;
  }
  rota('GET', '/pastas', ({ q }) => {
    const cid = id_(q.cliente_id) || null;
    const docs = Dados.lista('documentos'), pastas = Dados.lista('pastas');
    return pastas.filter((p) => mesmoEscopo(p.cliente_id, cid)).sort(porNome)
      .map((p) => ({ id: p.id, nome: p.nome, parent_id: p.parent_id || null, cliente_id: p.cliente_id || null, n_docs: docs.filter((d) => d.pasta_id === p.id).length, n_sub: pastas.filter((s) => s.parent_id === p.id).length }));
  });
  const nomePasta = (v) => req_(v, 'nome da pasta', 80).replace(/[\\/]/g, '-');
  rota('POST', '/pastas', async ({ body }) => {
    const cliente_id = id_(body.cliente_id) || null;
    if (cliente_id && !Dados.obter('clientes', cliente_id)) throw bad('Cliente inválido.');
    const parent_id = id_(body.parent_id) || null;
    if (parent_id && !mesmoEscopo(pastaOu404(parent_id).cliente_id, cliente_id)) throw bad('A pasta pai pertence a outra área.');
    const nome = nomePasta(body.nome);
    if (existeIrma(nome, parent_id, cliente_id)) throw bad('Já existe uma pasta com este nome aqui.');
    const reg = { id: Dados.novoId('pastas'), nome, parent_id, cliente_id, criado_em: Dados.agora() };
    await Dados.gravar('pastas', reg); await auditar('criar', 'pastas', reg.id, nome); return { id: reg.id };
  });
  rota('PUT', '/pastas/:id', async ({ params, body }) => {
    const p = pastaOu404(params.id), nome = nomePasta(body.nome !== undefined ? body.nome : p.nome); let parent_id = p.parent_id || null;
    if (body.parent_id !== undefined) {
      parent_id = id_(body.parent_id) || null;
      if (parent_id) {
        if (!mesmoEscopo(pastaOu404(parent_id).cliente_id, p.cliente_id)) throw bad('Não é possível mover para a pasta de outro cliente.');
        if (ehDescendente(parent_id, p.id)) throw bad('Não é possível mover uma pasta para dentro dela mesma.');
      }
    }
    if (existeIrma(nome, parent_id, p.cliente_id, p.id)) throw bad('Já existe uma pasta com este nome aqui.');
    await Dados.alterar('pastas', p.id, { nome, parent_id }); await auditar('editar', 'pastas', p.id, nome); return { ok: true };
  });
  rota('DELETE', '/pastas/:id', async ({ params }) => {       // subpastas vão junto; os DOCUMENTOS não são apagados
    const p = pastaOu404(params.id);
    const ids = new Set([p.id]); let mudou = true;
    while (mudou) { mudou = false; for (const s of Dados.lista('pastas')) if (s.parent_id && ids.has(s.parent_id) && !ids.has(s.id)) { ids.add(s.id); mudou = true; } }
    for (const d of Dados.lista('documentos').filter((x) => ids.has(x.pasta_id))) await Dados.alterar('documentos', d.id, { pasta_id: null });
    for (const id of ids) await Dados.remover('pastas', id);
    await auditar('excluir', 'pastas', p.id, p.nome); return { ok: true };
  });
  rota('POST', '/pastas/padrao', async ({ body }) => {
    const cliente_id = id_(body.cliente_id);
    if (!cliente_id || !Dados.obter('clientes', cliente_id)) throw bad('Cliente inválido.');
    let criadas = 0;
    for (const nome of PADRAO) { if (existeIrma(nome, null, cliente_id)) continue; await Dados.gravar('pastas', { id: Dados.novoId('pastas'), nome, parent_id: null, cliente_id, criado_em: Dados.agora() }); criadas++; }
    if (criadas) await auditar('criar_padrao', 'pastas', null, `cliente #${cliente_id}: ${criadas} pastas`);
    return { criadas };
  });
  rota('POST', '/pastas/mover-docs', async ({ body }) => {
    const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(id_).filter(Boolean))].slice(0, 500);
    if (!ids.length) throw bad('Selecione ao menos um documento.');
    const pasta = id_(body.pasta_id) ? pastaOu404(body.pasta_id) : null;
    for (const id of ids) {                                    // valida tudo antes de mexer em qualquer um
      const d = Dados.obter('documentos', id); if (!d || !pasta) continue;
      if (pasta.cliente_id && d.cliente_id && d.cliente_id !== pasta.cliente_id) throw bad(`“${d.titulo}” pertence a outro cliente e não pode ir para esta pasta.`);
      if (!pasta.cliente_id && d.cliente_id) throw bad(`“${d.titulo}” é de um cliente; mova para uma pasta desse cliente.`);
    }
    for (const id of ids) {
      const d = Dados.obter('documentos', id); if (!d) continue;
      await Dados.alterar('documentos', id, pasta ? { pasta_id: pasta.id, cliente_id: d.cliente_id || pasta.cliente_id || null } : { pasta_id: null });
    }
    await auditar('mover_docs', 'pastas', pasta ? pasta.id : null, `${ids.length} documento(s)`); return { ok: true };
  });

  // ======================= PENDÊNCIAS =======================
  const STATUS_PEND = ['pendente', 'ok', 'dispensado'];
  const pendOu404 = (id) => ou404('pendencias', id, 'Pendência');
  function lerPend(b, cliente_id) {
    const processo_id = id_(b.processo_id) || null;
    if (processo_id) { const p = Dados.obter('processos', processo_id); if (!p || p.cliente_id !== cliente_id) throw bad('O caso não pertence a este cliente.'); }
    return {
      processo_id, tipo: oneOf(b.tipo || 'documento', ['documento', 'tarefa'], 'tipo'), titulo: req_(b.titulo, 'título', 200), descricao: txt(b.descricao, 1000),
      categoria: b.categoria && Docs.CATEGORIAS.includes(b.categoria) ? b.categoria : null, prazo: dataISO(b.prazo, 'prazo'), observacao: txt(b.observacao, 1000), responsavel: txt(b.responsavel, 120),
    };
  }
  const juntarPend = (p) => ({ ...p, cliente: cliNome(p.cliente_id), processo: p.processo_id ? (Dados.obter('processos', p.processo_id) || {}).titulo || null : null, documento: p.documento_id ? (Dados.obter('documentos', p.documento_id) || {}).titulo || null : null });
  const ordemStatus = { pendente: 0, ok: 1, dispensado: 2 };
  const ordenarPend = (a, b) => (ordemStatus[a.status] - ordemStatus[b.status]) || (a.prazo ? (b.prazo ? String(a.prazo).localeCompare(String(b.prazo)) : -1) : b.prazo ? 1 : 0) || a.id - b.id;
  rota('GET', '/pendencias', ({ q }) => {
    let l = Dados.lista('pendencias');
    if (id_(q.cliente_id)) l = l.filter((p) => p.cliente_id === id_(q.cliente_id)); else { const at = new Set(Dados.lista('clientes').filter((c) => c.ativo).map((c) => c.id)); l = l.filter((p) => at.has(p.cliente_id)); }
    if (id_(q.processo_id)) l = l.filter((p) => p.processo_id === id_(q.processo_id));
    if (STATUS_PEND.includes(q.status)) l = l.filter((p) => p.status === q.status);
    if (['documento', 'tarefa'].includes(q.tipo)) l = l.filter((p) => p.tipo === q.tipo);
    const t = norm(q.q).trim(); if (t) l = l.filter((p) => norm([p.titulo, cliNome(p.cliente_id), p.observacao].join(' ')).includes(t));
    return l.sort(ordenarPend).slice(0, 1000).map(juntarPend);
  });
  rota('GET', '/pendencias/modelos', () => ({ modelos: Object.entries(Modelos.MODELOS).map(([chave, m]) => ({ chave, nome: m.nome, n: m.itens.length, itens: m.itens.map((i) => i.t) })), por_area: Modelos.POR_AREA }));
  rota('POST', '/pendencias', async ({ body, usuario }) => {
    const cliente_id = id_(body.cliente_id);
    if (!cliente_id || !Dados.obter('clientes', cliente_id)) throw bad('Selecione o cliente.');
    const d = lerPend(body, cliente_id), agora = Dados.agora();
    const reg = { id: Dados.novoId('pendencias'), cliente_id, ...d, palavras: null, status: 'pendente', documento_id: null, concluido_em: null, usuario_id: usuario.id, criado_em: agora, atualizado_em: agora };
    await Dados.gravar('pendencias', reg); await auditar('criar', 'pendencias', reg.id, d.titulo); return { id: reg.id };
  });
  rota('PUT', '/pendencias/:id', async ({ params, body }) => {
    const p = pendOu404(params.id), d = lerPend(body, p.cliente_id);
    await Dados.alterar('pendencias', p.id, { ...d, atualizado_em: Dados.agora() }); await auditar('editar', 'pendencias', p.id, d.titulo); return { ok: true };
  });
  async function mudarStatus(p, status, documento_id, observacao) {
    oneOf(status, STATUS_PEND, 'situação');
    let doc = null;
    if (status === 'ok' && documento_id) {
      doc = Dados.obter('documentos', documento_id);
      if (!doc) throw bad('Documento inválido.');
      if (doc.cliente_id && doc.cliente_id !== p.cliente_id) throw bad('O documento pertence a outro cliente.');
    }
    await Dados.alterar('pendencias', p.id, { status, documento_id: status === 'ok' && doc ? doc.id : null, concluido_em: status === 'pendente' ? null : Dados.agora(), observacao: observacao != null ? observacao : p.observacao, atualizado_em: Dados.agora() });
  }
  rota('POST', '/pendencias/:id/status', async ({ params, body }) => {
    const p = pendOu404(params.id); await mudarStatus(p, body.status, id_(body.documento_id), txt(body.observacao, 1000));
    await auditar('situacao', 'pendencias', p.id, `${p.titulo} → ${body.status}`); return { ok: true };
  });
  rota('POST', '/pendencias/lote', async ({ body }) => {
    const itens = (Array.isArray(body.itens) ? body.itens : []).slice(0, 200);
    if (!itens.length) throw bad('Nada para atualizar.');
    for (const i of itens) pendOu404(i.id);                    // valida antes de aplicar
    for (const i of itens) await mudarStatus(pendOu404(i.id), i.status, id_(i.documento_id), null);
    await auditar('situacao_lote', 'pendencias', null, `${itens.length} itens`); return { ok: true, n: itens.length };
  });
  rota('DELETE', '/pendencias/:id', async ({ params }) => { const p = pendOu404(params.id); await Dados.remover('pendencias', p.id); await auditar('excluir', 'pendencias', p.id, p.titulo); return { ok: true }; });
  rota('POST', '/pendencias/modelo', async ({ body, usuario }) => {
    const cliente_id = id_(body.cliente_id);
    if (!cliente_id || !Dados.obter('clientes', cliente_id)) throw bad('Selecione o cliente.');
    const chaves = (Array.isArray(body.modelos) ? body.modelos : [body.modelo]).filter((k) => Modelos.MODELOS[k]);
    if (!chaves.length) throw bad('Escolha um modelo.');
    const processo_id = id_(body.processo_id) || null;
    if (processo_id) { const p = Dados.obter('processos', processo_id); if (!p || p.cliente_id !== cliente_id) throw bad('O caso não pertence a este cliente.'); }
    let criados = 0, existentes = 0;
    for (const k of chaves) for (const i of Modelos.MODELOS[k].itens) {
      if (Dados.lista('pendencias').some((p) => p.cliente_id === cliente_id && (p.processo_id || null) === processo_id && norm(p.titulo) === norm(i.t))) { existentes++; continue; }
      const agora = Dados.agora();
      await Dados.gravar('pendencias', { id: Dados.novoId('pendencias'), cliente_id, processo_id, tipo: i.tipo, titulo: i.t, descricao: null, categoria: i.c, palavras: JSON.stringify(i.k || []), status: 'pendente', prazo: null, documento_id: null, observacao: null, responsavel: null, usuario_id: usuario.id, criado_em: agora, atualizado_em: agora, concluido_em: null });
      criados++;
    }
    await auditar('aplicar_modelo', 'pendencias', null, `cliente #${cliente_id}: ${chaves.join(', ')} (+${criados})`); return { criados, existentes };
  });
  rota('POST', '/pendencias/conferir', ({ body }) => {
    const cliente_id = id_(body.cliente_id);
    if (!cliente_id) throw bad('Selecione o cliente.');
    const docs = Dados.lista('documentos').filter((d) => d.cliente_id === cliente_id).map((d) => ({ id: d.id, titulo: d.titulo, nome_original: d.nome_original, tags: d.tags, resumo: d.resumo, categoria: d.categoria, processo_id: d.processo_id }));
    const processo_id = id_(body.processo_id) || null;
    const abertas = Dados.lista('pendencias').filter((p) => p.cliente_id === cliente_id && p.status === 'pendente' && p.tipo === 'documento' && (!processo_id || p.processo_id === processo_id || !p.processo_id));
    const usados = new Set(Dados.lista('pendencias').filter((p) => p.cliente_id === cliente_id && p.documento_id && p.status === 'ok').map((p) => p.documento_id));
    const propostas = [];
    for (const p of abertas) {
      const m = Modelos.melhorDocumento(p, docs.filter((d) => !usados.has(d.id)));
      if (m) { propostas.push({ pendencia_id: p.id, pendencia: p.titulo, documento_id: m.documento.id, documento: m.documento.titulo, motivo: m.motivo }); usados.add(m.documento.id); }
    }
    return { propostas, analisadas: abertas.length, documentos: docs.length };
  });

  // ======================= ACESSO E SENHA =======================
  rota('POST', '/auth/senha', async ({ body, usuario }) => {
    if (usuario.papel !== 'admin') throw new HttpError(403, 'Só quem administra pode trocar a senha do escritório.');
    const erro = Cofre.avaliarSenha(body.nova); if (erro) throw bad(erro);
    const meta = await Dados.backend.obter('config', 'seguranca');
    if (!meta || !(await Cofre.abrir(meta, String(body.atual || '')))) throw bad('Senha atual incorreta.');
    await Dados.backend.definir('config', 'seguranca', await Cofre.trocarSenha(Dados.master, String(body.nova)));
    await auditar('senha_alterada', 'config', null, 'Senha do escritório alterada'); return { ok: true };
  });
  rota('GET', '/admin/auditoria', () => Dados.lista('auditoria').sort(desc('id')).slice(0, 300).map((a) => ({ ...a, ip: '' })));

  return { rota, handle, HttpError, bad, notFound, txt, req_, oneOf, id_, dataISO, norm, hojeISO, ou404, cliNome, auditar, checarVersao, mudancas, desc, pastaPadraoPara, sessao, definirUsuario(u) { sessao.usuario = u; } };
})();

/* Pendências (o que falta / o que já chegou) e observações */
'use strict';

const PEND = {
  rot: { documento: { pendente: 'Falta', ok: 'Recebido', dispensado: 'Dispensado' }, tarefa: { pendente: 'A fazer', ok: 'Feito', dispensado: 'Dispensado' } },
  cor: { pendente: 'warn', ok: 'ok', dispensado: '' },
};

function resumoPend(lista) {
  const validos = lista.filter((p) => p.status !== 'dispensado');
  const ok = validos.filter((p) => p.status === 'ok').length;
  return { total: validos.length, ok, falta: validos.length - ok, pct: validos.length ? Math.round((ok / validos.length) * 100) : 0, dispensados: lista.length - validos.length };
}
function barraPend(lista) {
  const r = resumoPend(lista);
  if (!lista.length) return '';
  return `<div style="margin-bottom:12px"><div class="prog" style="margin:0 0 6px"><div style="width:${r.pct}%"></div></div>
    <div class="small"><b>${r.ok} de ${r.total}</b> ${r.total === 1 ? 'item resolvido' : 'itens resolvidos'}${r.falta ? ` · <span style="color:var(--warn)"><b>faltam ${r.falta}</b></span>` : ' · <span style="color:var(--ok)"><b>tudo em dia</b></span>'}${r.dispensados ? ` · <span class="muted">${r.dispensados} dispensado(s)</span>` : ''}</div></div>`;
}

function linhaPend(p, { cliente = false } = {}) {
  const rot = PEND.rot[p.tipo][p.status];
  const ico_ = p.tipo === 'tarefa' ? 'clock' : 'file';
  const acoes = p.status === 'pendente'
    ? `<button class="btn sm gold" data-pa="ok" data-id="${p.id}">${ico('check')} ${p.tipo === 'tarefa' ? 'Feito' : 'Recebido'}</button><button class="btn sm ghost" data-pa="disp" data-id="${p.id}" title="Não é necessário neste caso">Dispensar</button>`
    : `<button class="btn sm ghost" data-pa="reabrir" data-id="${p.id}">Reabrir</button>`;
  return `<div class="pend ${p.status}"><div class="pend-i">${ico(ico_)}</div>
    <div class="pend-t"><div class="pend-n">${p.status === 'dispensado' ? `<s>${esc(p.titulo)}</s>` : esc(p.titulo)} <span class="badge ${PEND.cor[p.status]}">${rot}</span>
        ${p.status === 'pendente' && p.prazo ? badgePrazo(p.prazo) : ''}${p.tipo === 'tarefa' ? ' <span class="badge info">Tarefa</span>' : ''}</div>
      <div class="small muted">${cliente ? `<a href="#/clientes/${p.cliente_id}">${esc(p.cliente)}</a>${p.processo ? ' · ' : ''}` : ''}${p.processo ? 'Caso: ' + esc(p.processo) : ''}${p.responsavel ? ' · Resp.: ' + esc(p.responsavel) : ''}</div>
      ${p.documento ? `<div class="small"><button type="button" class="badge gold" style="cursor:pointer" data-ver="${p.documento_id}">${ico('file').replace('<svg', '<svg width="12" height="12" style="vertical-align:-2px"')} ${esc(p.documento)}</button></div>` : ''}
      ${p.observacao ? `<div class="small" style="color:var(--ink-2)">${esc(p.observacao)}</div>` : ''}</div>
    <div class="pend-a">${acoes}<button class="btn sm ghost" data-pa="ed" data-id="${p.id}" title="Editar">${ico('edit')}</button><button class="btn sm ghost" data-pa="del" data-id="${p.id}" title="Excluir">${ico('trash')}</button></div></div>`;
}

function ligarPend(el, lista, depois) {
  const por = (id) => lista.find((x) => x.id === +id);
  const status = async (p, st, extra = {}) => { try { await api(`/pendencias/${p.id}/status`, { method: 'POST', body: { status: st, ...extra } }); depois(); } catch (e) { falha(e); } };
  $$('[data-pa]', el).forEach((b) => (b.onclick = async () => {
    const p = por(b.dataset.id), a = b.dataset.pa;
    if (a === 'ok') return p.tipo === 'tarefa' ? status(p, 'ok') : modalRecebido(p, depois);
    if (a === 'reabrir') return status(p, 'pendente');
    if (a === 'disp') return modal({ titulo: 'Dispensar item', tamanho: 'sm', corpo: `<p style="margin-top:0">“${esc(p.titulo)}” não será mais cobrado neste caso.</p>${formHTML([{ n: 'observacao', label: 'Motivo (opcional)', tipo: 'textarea', rows: 2, col: 'c6', ph: 'Ex.: consta no RG; cliente não possui' }])}`,
      botoes: [{ texto: 'Cancelar' }, { texto: 'Dispensar', classe: 'primary', acao: async (ov) => { await api(`/pendencias/${p.id}/status`, { method: 'POST', body: { status: 'dispensado', observacao: lerForm(ov).observacao } }); depois(); } }] });
    if (a === 'ed') return abrirPend(p, depois);
    if (a === 'del' && (await confirmar(`Excluir o item “${p.titulo}”?`, { perigo: true, texto: 'Excluir' }))) { try { await api('/pendencias/' + p.id, { method: 'DELETE' }); depois(); } catch (e) { falha(e); } }
  }));
  ligarAcoesDocs();
}

// Dar baixa: escolher o documento que comprova (ou marcar sem anexo) / enviar arquivo agora
async function modalRecebido(p, depois) {
  const docs = await api('/documentos' + qs({ cliente_id: p.cliente_id }));
  modal({ titulo: 'Marcar como recebido', tamanho: 'sm',
    corpo: `<p style="margin-top:0"><b>${esc(p.titulo)}</b></p>
      ${formHTML([{ n: 'documento_id', label: 'Qual documento comprova?', tipo: 'select', op: [['', '— Marcar como recebido, sem vincular arquivo —'], ...docs.map((d) => [d.id, `${d.titulo} (${L.categoria[d.categoria] || d.categoria})`])], col: 'c6' }])}
      <button type="button" class="btn" id="envAgora" style="margin-top:10px">${ico('upload')} Enviar o arquivo agora</button>
      <div class="small muted" style="margin-top:6px">${docs.length ? '' : 'Este cliente ainda não tem documentos arquivados. '}Depois de enviar, volte aqui para vincular.</div>`,
    aoAbrir: (ov) => { $('#envAgora', ov).onclick = () => { $$('.overlay').forEach((o) => o.parentNode.removeChild(o)); abrirUpload({ cliente_id: p.cliente_id, processo_id: p.processo_id }, () => modalRecebido(p, depois)); }; },
    botoes: [{ texto: 'Cancelar' }, { texto: 'Marcar como recebido', classe: 'gold', acao: async (ov) => { await api(`/pendencias/${p.id}/status`, { method: 'POST', body: { status: 'ok', documento_id: lerForm(ov).documento_id } }); toast('Marcado como recebido.'); depois(); } }] });
}

async function abrirPend(v = {}, depois) {
  const cl = await listaClientes(); await carregarOpcoes();
  const ed = !!v.id;
  const opProc = async (cid) => [['', '— Geral do cliente —'], ...(cid ? (await api('/processos' + qs({ cliente_id: cid }))).map((p) => [p.id, p.titulo]) : [])];
  modal({ titulo: ed ? 'Editar item' : 'Novo item pendente',
    corpo: formHTML([
      { n: 'cliente_id', label: 'Cliente', tipo: 'select', op: opClientes(cl), req: true, col: 'c-half' },
      { n: 'processo_id', label: 'Caso / processo', tipo: 'select', op: await opProc(v.cliente_id), col: 'c-half' },
      { n: 'tipo', label: 'Tipo', tipo: 'select', op: [['documento', 'Documento a receber'], ['tarefa', 'Tarefa a fazer']], col: 'c-half' },
      { n: 'categoria', label: 'Tipo de documento', tipo: 'select', op: [['', '—'], ...opts(L.categoria)], col: 'c-half', dica: 'Ajuda a conferir automaticamente.' },
      { n: 'titulo', label: 'O que falta?', req: true, col: 'c6', ph: 'Ex.: Comprovante de renda dos últimos 3 meses' },
      { n: 'prazo', label: 'Prazo (opcional)', tipo: 'date', col: 'c-half' },
      { n: 'responsavel_id', label: 'Responsável', tipo: 'select', op: [['', '—'], ...S.opcoes.usuarios.map((u) => [u.id, u.nome])], col: 'c-half' },
      { n: 'observacao', label: 'Observação', tipo: 'textarea', rows: 2, col: 'c6' },
    ], { tipo: 'documento', ...v }),
    aoAbrir: (ov) => { $('#f_cliente_id', ov).onchange = async (e) => { $('#f_processo_id', ov).innerHTML = (await opProc(e.target.value)).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join(''); }; if (ed) $('#f_cliente_id', ov).disabled = true; },
    botoes: [{ texto: 'Cancelar' }, { texto: ed ? 'Salvar' : 'Adicionar', classe: 'gold', acao: async (ov) => {
      const body = lerForm(ov); if (ed) body.cliente_id = v.cliente_id;
      await api(ed ? `/pendencias/${v.id}` : '/pendencias', { method: ed ? 'PUT' : 'POST', body }); toast('Item salvo.'); depois();
    } }] });
}

// Aplicar um ou mais modelos de checklist
async function abrirModelos(cliente_id, processo, depois) {
  const { modelos, por_area } = await api('/pendencias/modelos');
  const sugeridos = new Set(processo?.area ? por_area[processo.area] || ['basico'] : ['basico']);
  modal({ titulo: 'Aplicar modelo de checklist', tamanho: '',
    corpo: `<p style="margin-top:0">Escolha o que normalmente é preciso reunir. Os itens entram como <b>pendentes</b>; o que já existir não é duplicado. Depois você pode editar, dispensar ou acrescentar.</p>
      ${processo?.area ? `<p class="note small">Sugestão para a área <b>${esc(processo.area)}</b> já marcada.</p>` : ''}
      ${modelos.map((m) => `<label class="chk org-card" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;cursor:pointer"><input type="checkbox" value="${m.chave}" ${sugeridos.has(m.chave) ? 'checked' : ''} style="margin-top:4px">
        <span><b>${esc(m.nome)}</b> <span class="muted small">(${m.n} itens)</span><div class="small muted" style="font-weight:400">${m.itens.map(esc).join(' · ')}</div></span></label>`).join('')}`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Adicionar itens', classe: 'gold', acao: async (ov) => {
      const escolhidos = $$('input:checked', ov).map((i) => i.value);
      if (!escolhidos.length) throw new Error('Marque ao menos um modelo.');
      const r = await api('/pendencias/modelo', { method: 'POST', body: { cliente_id, processo_id: processo?.id || '', modelos: escolhidos } });
      toast(`${r.criados} item(ns) adicionado(s)${r.existentes ? `; ${r.existentes} já existia(m)` : ''}.`); depois();
    } }] });
}

// Confere os documentos arquivados com o que ainda falta (sem IA, tudo local)
async function conferirDocs(cliente_id, processo_id, depois) {
  let r;
  try { r = await api('/pendencias/conferir', { method: 'POST', body: { cliente_id, processo_id: processo_id || '' } }); } catch (e) { return falha(e); }
  if (!r.propostas.length) return toast(r.analisadas ? `Nenhum dos ${r.documentos} documento(s) arquivado(s) corresponde às ${r.analisadas} pendência(s) em aberto.` : 'Não há pendências de documento em aberto para conferir.');
  modal({ titulo: `Documentos que dão baixa em pendências (${r.propostas.length})`, tamanho: '',
    corpo: `<p class="note small" style="margin-top:0">Encontrei, entre os documentos já arquivados do cliente, os que parecem ser o que estava faltando. Confira e confirme.</p>
      ${r.propostas.map((p, i) => `<label class="chk org-card" style="display:flex;gap:10px;margin-bottom:8px;cursor:pointer"><input type="checkbox" data-i="${i}" checked style="margin-top:4px"><span><b>${esc(p.pendencia)}</b><div class="small">← <b>${esc(p.documento)}</b></div><div class="small muted" style="font-weight:400">${esc(p.motivo)}</div></span></label>`).join('')}`,
    botoes: [{ texto: 'Cancelar' }, { texto: 'Marcar como recebidos', classe: 'gold', acao: async (ov) => {
      const itens = $$('[data-i]:checked', ov).map((c) => ({ id: r.propostas[+c.dataset.i].pendencia_id, status: 'ok', documento_id: r.propostas[+c.dataset.i].documento_id }));
      if (!itens.length) throw new Error('Marque ao menos um item.');
      await api('/pendencias/lote', { method: 'POST', body: { itens } }); toast(`${itens.length} pendência(s) baixada(s).`); depois();
    } }] });
}

// Cartão de pendências de um cliente (ou de um caso)
async function cardPendencias(el, { cliente_id, processo = null }) {
  const recarregar = () => cardPendencias(el, { cliente_id, processo });
  const lista = await api('/pendencias' + qs({ cliente_id, processo_id: processo?.id }));
  const abertas = lista.filter((p) => p.status === 'pendente'), resolvidas = lista.filter((p) => p.status !== 'pendente');
  el.innerHTML = `<div class="card-h"><h3>Pendências — o que falta</h3>
      <button class="btn sm" id="pdMod">${ico('check')} Aplicar modelo</button><button class="btn sm" id="pdConf" title="Procura nos documentos já arquivados o que dá baixa nas pendências">${ico('search')} Conferir documentos</button><button class="btn sm gold" id="pdNovo">${ico('plus')} Novo item</button></div>
    <div class="card-b">${lista.length ? barraPend(lista) : ''}
      ${abertas.length ? `<div class="pend-l">${abertas.map((p) => linhaPend(p)).join('')}</div>` : lista.length ? `<div class="empty" style="padding:14px">${ico('check')}Nada pendente.</div>` : `<div class="empty" style="padding:18px">${ico('check')}Nenhum item ainda. Use <b>Aplicar modelo</b> para começar com a lista do que costuma ser necessário.</div>`}
      ${resolvidas.length ? `<details class="pend-res"><summary class="small muted">Já resolvidos (${resolvidas.length})</summary><div class="pend-l">${resolvidas.map((p) => linhaPend(p)).join('')}</div></details>` : ''}</div>`;
  $('#pdMod', el).onclick = () => abrirModelos(cliente_id, processo, recarregar);
  $('#pdConf', el).onclick = () => conferirDocs(cliente_id, processo?.id, recarregar);
  $('#pdNovo', el).onclick = () => abrirPend({ cliente_id, processo_id: processo?.id || '' }, recarregar);
  ligarPend(el, lista, recarregar);
}

// ---------- Página: todas as pendências ----------
async function pagePendencias(params) {
  const cl = await listaClientes();
  const f = { q: '', st: 'pendente', tipo: '', cliente_id: '', ...params };
  view(`<div class="page-h"><div><h1>Pendências</h1><div class="sub">O que falta e o que já chegou, por cliente</div></div>
    <div class="actions"><button class="btn gold" id="pNovo">${ico('plus')} Novo item</button></div></div>
    <div class="grid g3" id="pTot" style="margin-bottom:16px"></div>
    <div class="filters"><input type="search" id="q" placeholder="Buscar por item ou cliente…" value="${esc(f.q)}">
      <select id="st"><option value="pendente" ${f.st === 'pendente' ? 'selected' : ''}>Em aberto (falta)</option><option value="ok" ${f.st === 'ok' ? 'selected' : ''}>Recebidos / feitos</option><option value="dispensado" ${f.st === 'dispensado' ? 'selected' : ''}>Dispensados</option><option value="todos" ${f.st === 'todos' ? 'selected' : ''}>Todos</option></select>
      <select id="tp"><option value="">Documentos e tarefas</option><option value="documento" ${f.tipo === 'documento' ? 'selected' : ''}>Só documentos</option><option value="tarefa" ${f.tipo === 'tarefa' ? 'selected' : ''}>Só tarefas</option></select>
      <select id="cli">${opClientes(cl, 'Todos os clientes').map(([k, l]) => `<option value="${k}" ${String(f.cliente_id) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div id="pLista"></div>`);
  const carregar = async () => {
    const todos = await api('/pendencias' + qs({ q: $('#q').value, tipo: $('#tp').value, cliente_id: $('#cli').value }));
    const abertas = todos.filter((p) => p.status === 'pendente'), hoje = hojeISO();
    $('#pTot').innerHTML = `<div class="card stat"><div class="n">${abertas.length}</div><div class="l">Em aberto</div></div>
      <div class="card stat"><div class="n" style="color:${abertas.some((p) => p.prazo && p.prazo.slice(0, 10) < hoje) ? 'var(--err)' : 'inherit'}">${abertas.filter((p) => p.prazo && p.prazo.slice(0, 10) < hoje).length}</div><div class="l">Com prazo vencido</div></div>
      <div class="card stat"><div class="n">${new Set(abertas.map((p) => p.cliente_id)).size}</div><div class="l">Clientes com pendências</div></div>`;
    const st = $('#st').value;
    const visiveis = st === 'todos' ? todos : todos.filter((p) => p.status === st);
    const porCliente = new Map();
    for (const p of visiveis) { if (!porCliente.has(p.cliente_id)) porCliente.set(p.cliente_id, []); porCliente.get(p.cliente_id).push(p); }
    $('#pLista').innerHTML = porCliente.size ? [...porCliente.entries()].map(([cid, itens]) => {
      const dele = todos.filter((p) => p.cliente_id === cid);
      return `<div class="card" style="margin-bottom:14px"><div class="card-h"><h3><a href="#/clientes/${cid}" style="color:inherit">${esc(itens[0].cliente)}</a></h3><span class="small muted">${resumoPend(dele).ok} de ${resumoPend(dele).total} resolvidos</span><button class="btn sm" data-conf="${cid}">${ico('search')} Conferir documentos</button></div>
        <div class="card-b">${barraPend(dele)}<div class="pend-l">${itens.map((p) => linhaPend(p)).join('')}</div></div></div>`;
    }).join('') : `<div class="card">${vazio(st === 'pendente' ? 'Nenhuma pendência em aberto. 🎉 Use “Aplicar modelo” na página do cliente para criar o checklist.' : 'Nada encontrado.', 'check')}</div>`;
    ligarPend($('#pLista'), todos, carregar);
    $$('[data-conf]').forEach((b) => (b.onclick = () => conferirDocs(+b.dataset.conf, '', carregar)));
  };
  ['st', 'tp', 'cli'].forEach((i) => ($('#' + i).onchange = carregar)); $('#q').oninput = debounce(carregar);
  $('#pNovo').onclick = () => abrirPend({ cliente_id: $('#cli').value }, carregar);
  await carregar();
}

// ---------- Observações (anotações datadas) ----------
async function blocoNotas(el, entidade, id) {
  const recarregar = () => blocoNotas(el, entidade, id);
  const notas = await api('/notas' + qs({ entidade, id }));
  el.innerHTML = `<div style="margin-bottom:12px"><textarea id="nTxt" rows="2" placeholder="Escreva uma observação (fica registrada com seu nome e a data)…"></textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-top:6px"><label class="chk small" style="margin:0"><input type="checkbox" id="nFix"> Fixar no topo</label><span class="right"></span><button class="btn sm gold" id="nAdd">${ico('plus')} Adicionar</button></div></div>
    ${notas.length ? notas.map((n) => `<div class="nota ${n.fixada ? 'fix' : ''}"><div class="small muted">${n.fixada ? '📌 ' : ''}<b>${esc(n.usuario_nome || '—')}</b> · ${fUTC(n.criado_em)}${n.atualizado_em !== n.criado_em ? ' · editada' : ''}
        <span class="right" style="float:right"><button class="btn sm ghost" data-n="fix" data-id="${n.id}" title="${n.fixada ? 'Desafixar' : 'Fixar'}">📌</button><button class="btn sm ghost" data-n="ed" data-id="${n.id}" title="Editar">${ico('edit')}</button><button class="btn sm ghost" data-n="del" data-id="${n.id}" title="Excluir">${ico('trash')}</button></span></div>
      <div class="pre">${esc(n.texto)}</div></div>`).join('') : '<div class="small muted">Nenhuma observação ainda.</div>'}`;
  $('#nAdd', el).onclick = async () => {
    const texto = $('#nTxt', el).value.trim(); if (!texto) return toast('Escreva a observação.', true);
    try { await api('/notas', { method: 'POST', body: { entidade, entidade_id: id, texto, fixada: $('#nFix', el).checked } }); recarregar(); } catch (e) { falha(e); }
  };
  $$('[data-n]', el).forEach((b) => (b.onclick = async () => {
    const n = notas.find((x) => x.id === +b.dataset.id), a = b.dataset.n;
    try {
      if (a === 'fix') { await api('/notas/' + n.id, { method: 'PUT', body: { fixada: !n.fixada } }); recarregar(); }
      else if (a === 'del') { if (await confirmar('Excluir esta observação?', { perigo: true, texto: 'Excluir' })) { await api('/notas/' + n.id, { method: 'DELETE' }); recarregar(); } }
      else modal({ titulo: 'Editar observação', tamanho: 'sm', corpo: formHTML([{ n: 'texto', label: 'Observação', tipo: 'textarea', rows: 5, col: 'c6' }], n),
        botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', classe: 'gold', acao: async (ov) => { await api('/notas/' + n.id, { method: 'PUT', body: { texto: lerForm(ov).texto } }); recarregar(); } }] });
    } catch (e) { falha(e); }
  }));
}

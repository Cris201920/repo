/* Páginas: painel, atendimentos, clientes, processos, documentos, usuários, auditoria */
'use strict';
const view = (html) => { $('#view').innerHTML = html; window.scrollTo(0, 0); };
const vazio = (txt, ic = 'file') => `<div class="empty">${ico(ic)}${esc(txt)}</div>`;
const cache = { clientes: null };
async function listaClientes(forcar) { if (!cache.clientes || forcar) cache.clientes = await api('/clientes'); return cache.clientes; }
const opClientes = (lista, vazioTxt) => [['', vazioTxt || 'Selecione…'], ...lista.map((c) => [c.id, c.nome])];
const primeiroNome = (n) => { const p = String(n || '').split(/\s+/).filter(Boolean); return (/^(dr|dra|sr|sra|prof|profa)\.?$/i.test(p[0]) && p[1]) ? `${p[0]} ${p[1]}` : p[0] || ''; };
const iniciais = (n) => String(n || '?').split(/\s+/).filter((x) => x && !/^(dr|dra|sr|sra|prof|profa)\.?$/i.test(x)).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// ======================= PAINEL =======================
async function pagePainel() {
  const d = await api('/painel');
  const h = new Date().getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  view(`
  <div class="page-h"><div><h1>${saud}, ${esc(primeiroNome(S.usuario.nome))}</h1><div class="sub">${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}</div></div>
    <div class="actions">
      <button class="btn gold" id="aNovoAt">${ico('plus')} Novo atendimento</button>
      <button class="btn" id="aNovoCli">${ico('users')} Novo cliente</button>
      <button class="btn" id="aUp">${ico('upload')} Enviar documento</button>
      <a class="btn" href="#/assistente">${ico('spark')} Assistente IA</a>
    </div></div>
  <div class="grid g4" style="margin-bottom:18px">
    <div class="card stat"><div class="n">${d.totais.clientes}</div><div class="l">Clientes ativos</div></div>
    <div class="card stat"><div class="n">${d.totais.processos}</div><div class="l">Casos em curso</div></div>
    <div class="card stat"><div class="n">${d.totais.atendimentosMes}</div><div class="l">Atendimentos no mês</div></div>
    <div class="card stat"><div class="n">${d.totais.documentos}</div><div class="l">Documentos</div></div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-h"><h3>Prazos e providências pendentes</h3><a class="small" href="#/atendimentos?pendentes=1">ver todos</a></div>
      ${d.prazos.length ? d.prazos.map((p) => `<div class="list-item"><div class="d"><b>${p.prazo.slice(8, 10)}</b>${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+p.prazo.slice(5, 7) - 1]}</div>
        <div style="flex:1;min-width:0"><a href="#/atendimentos/${p.id}"><b>${esc(p.assunto)}</b></a><div class="small muted">${esc(p.cliente)}${p.providencias ? ' · ' + esc(p.providencias.slice(0, 90)) : ''}</div></div>
        <div>${badgePrazo(p.prazo)}</div><button class="btn sm ghost" data-conc="${p.id}" title="Marcar como concluído">${ico('check')}</button></div>`).join('') : vazio('Nenhum prazo pendente. Ao registrar um atendimento, informe o prazo para que ele apareça aqui.', 'clock')}
    </div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="card"><div class="card-h"><h3>Últimos atendimentos</h3><a class="small" href="#/atendimentos">ver todos</a></div>
        ${d.atendimentos.length ? d.atendimentos.map((a) => `<div class="list-item"><div style="flex:1;min-width:0"><a href="#/atendimentos/${a.id}"><b>${esc(a.assunto)}</b></a><div class="small muted">${esc(a.cliente)} · ${L.canal[a.canal] || a.canal}</div></div><div class="small muted">${fData(a.data_hora)}</div></div>`).join('') : vazio('Nenhum atendimento registrado ainda.', 'chat')}
      </div>
      <div class="card"><div class="card-h"><h3>Documentos recentes</h3><a class="small" href="#/documentos">ver todos</a></div>
        ${d.documentos.length ? d.documentos.map((x) => `<div class="list-item"><div style="flex:1;min-width:0"><b>${esc(x.titulo)}</b><div class="small muted">${esc(x.cliente || 'Sem cliente')} · ${L.categoria[x.categoria] || x.categoria}</div></div><div class="small muted">${fUTC(x.criado_em).slice(0, 10)}</div></div>`).join('') : vazio('Nenhum documento enviado ainda.')}
      </div>
    </div>
  </div>`);
  $('#aNovoAt').onclick = () => abrirAtendimento({}, pagePainel);
  $('#aNovoCli').onclick = () => abrirCliente({}, () => { location.hash = '#/clientes'; });
  $('#aUp').onclick = () => abrirUpload({}, () => { location.hash = '#/documentos'; });
  $$('[data-conc]').forEach((b) => (b.onclick = async () => { try { await api(`/atendimentos/${b.dataset.conc}/concluir`, { method: 'POST', body: { concluido: true } }); toast('Marcado como concluído.'); pagePainel(); } catch (e) { falha(e); } }));
}

// ======================= ATENDIMENTOS =======================
const CAMPOS_AT = (cl, procs) => [
  { n: 'cliente_id', label: 'Cliente', tipo: 'select', op: opClientes(cl), req: true, col: 'c2' },
  { n: 'processo_id', label: 'Processo / caso (opcional)', tipo: 'select', op: procs, col: 'c2' },
  { n: 'data_hora', label: 'Data e hora', tipo: 'datetime-local', req: true, col: 'c1' },
  { n: 'assunto', label: 'Assunto', req: true, col: 'c3', ph: 'Ex.: Consulta inicial — divórcio consensual' },
  { n: 'canal', label: 'Canal', tipo: 'select', op: opts(L.canal), col: 'c1' },
  { n: 'resumo', label: 'Registro do atendimento', tipo: 'textarea', rows: 8, col: 'c6', ph: 'O que o cliente relatou, orientações dadas, documentos solicitados, honorários combinados…' },
  { n: 'providencias', label: 'Providências / próximos passos', tipo: 'textarea', rows: 3, col: 'c6' },
  { n: 'prazo', label: 'Prazo da providência', tipo: 'date', col: 'c2', dica: 'Aparece no painel até ser concluído.' },
  { n: 'concluido', label: 'Providência concluída', tipo: 'checkbox', col: 'c2' },
];
async function abrirAtendimento(v = {}, depois) {
  const cl = await listaClientes();
  const opProc = async (cid) => [['', '— Nenhum —'], ...(cid ? (await api('/processos' + qs({ cliente_id: cid }))).map((p) => [p.id, p.titulo + (p.numero ? ' · ' + p.numero : '')]) : [])];
  const val = { canal: 'presencial', data_hora: agoraLocal(), ...v, data_hora: (v.data_hora || agoraLocal()).replace(' ', 'T') };
  const editando = !!v.id;
  modal({ titulo: editando ? 'Editar atendimento' : 'Registrar atendimento', tamanho: 'lg',
    corpo: formHTML(CAMPOS_AT(cl, await opProc(val.cliente_id)), val),
    aoAbrir: (ov) => {
      $('#f_cliente_id', ov).onchange = async (e) => {
        const o = await opProc(e.target.value);
        $('#f_processo_id', ov).innerHTML = o.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('');
      };
    },
    botoes: [{ texto: 'Cancelar' }, { texto: editando ? 'Salvar' : 'Registrar atendimento', classe: 'gold', acao: async (ov) => {
      await api(editando ? `/atendimentos/${v.id}` : '/atendimentos', { method: editando ? 'PUT' : 'POST', body: lerForm(ov) });
      toast('Atendimento salvo.'); depois?.();
    } }] });
}

async function pageAtendimentos(params) {
  const f = { q: '', canal: '', pendentes: '', de: '', ate: '', ...params };
  view(`<div class="page-h"><div><h1>Atendimentos</h1><div class="sub">Registro de todos os contatos e consultas com clientes</div></div>
    <div class="actions"><button class="btn gold" id="novo">${ico('plus')} Novo atendimento</button></div></div>
    <div class="filters"><input type="search" id="q" placeholder="Buscar por cliente, assunto ou conteúdo…" value="${esc(f.q)}">
      <select id="canal"><option value="">Todos os canais</option>${opts(L.canal).map(([k, l]) => `<option value="${k}" ${f.canal === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label class="chk" style="margin:0"><input type="checkbox" id="pend" ${f.pendentes ? 'checked' : ''}> Com prazo pendente</label>
      <input type="date" id="de" value="${esc(f.de)}" title="De"><input type="date" id="ate" value="${esc(f.ate)}" title="Até"></div>
    <div class="card tbl" id="lista"></div>`);
  const carregar = async () => {
    const dados = await api('/atendimentos' + qs({ q: $('#q').value, canal: $('#canal').value, pendentes: $('#pend').checked, de: $('#de').value, ate: $('#ate').value }));
    $('#lista').innerHTML = dados.length ? `<table><thead><tr><th>Data</th><th>Cliente</th><th>Assunto</th><th>Canal</th><th>Prazo</th><th></th></tr></thead><tbody>${dados.map((a) => `
      <tr class="click" data-id="${a.id}"><td class="small" style="white-space:nowrap">${fDataHora(a.data_hora)}</td><td><b>${esc(a.cliente)}</b>${a.processo ? `<div class="small muted">${esc(a.processo)}</div>` : ''}</td>
      <td>${esc(a.assunto)}</td><td><span class="badge">${L.canal[a.canal] || a.canal}</span></td><td>${badgePrazo(a.prazo, a.concluido)}</td>
      <td class="small muted">${a.n_documentos ? ico('file').replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"') + ' ' + a.n_documentos : ''}</td></tr>`).join('')}</tbody></table>` : vazio('Nenhum atendimento encontrado.', 'chat');
    $$('tr.click', $('#lista')).forEach((tr) => (tr.onclick = () => (location.hash = '#/atendimentos/' + tr.dataset.id)));
  };
  ['canal', 'pend', 'de', 'ate'].forEach((i) => ($('#' + i).onchange = carregar)); $('#q').oninput = debounce(carregar);
  $('#novo').onclick = () => abrirAtendimento({}, carregar);
  await carregar();
}

async function pageAtendimento(id) {
  const a = await api('/atendimentos/' + id);
  view(`<div class="crumb"><a href="#/atendimentos">Atendimentos</a> › #${a.id}</div>
    <div class="page-h"><div><h1>${esc(a.assunto)}</h1><div class="sub">${fDataHora(a.data_hora)} · ${L.canal[a.canal] || a.canal} · atendido por ${esc(a.atendente || '—')}</div></div>
      <div class="actions"><button class="btn gold" id="ia">${ico('spark')} Resumir / gerar ata com IA</button><button class="btn" id="ed">${ico('edit')} Editar</button>
        <button class="btn" id="conc">${ico('check')} ${a.concluido ? 'Reabrir' : 'Concluir providência'}</button><button class="btn danger" id="del">${ico('trash')}</button></div></div>
    <div class="grid g2"><div style="display:flex;flex-direction:column;gap:18px">
      <div class="card"><div class="card-h"><h3>Registro do atendimento</h3></div><div class="card-b pre">${esc(a.resumo || 'Sem registro detalhado.')}</div></div>
      <div class="card"><div class="card-h"><h3>Providências e próximos passos</h3>${badgePrazo(a.prazo, a.concluido)}</div><div class="card-b pre">${esc(a.providencias || '—')}</div></div></div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="card"><div class="card-h"><h3>Dados</h3></div><div class="card-b"><dl class="kv">
        <dt>Cliente</dt><dd><a href="#/clientes/${a.cliente_id}">${esc(a.cliente)}</a></dd>
        <dt>Processo</dt><dd>${a.processo_id ? `<a href="#/processos/${a.processo_id}">${esc(a.processo)}</a>` : '—'}</dd></dl></div></div>
      <div class="card"><div class="card-h"><h3>Documentos deste atendimento</h3><button class="btn sm" id="up">${ico('upload')} Anexar</button></div>${listaDocs(a.documentos)}</div></div></div>`);
  $('#ed').onclick = () => abrirAtendimento(a, () => pageAtendimento(id));
  $('#up').onclick = () => abrirUpload({ cliente_id: a.cliente_id, processo_id: a.processo_id, atendimento_id: a.id }, () => pageAtendimento(id));
  $('#conc').onclick = async () => { try { await api(`/atendimentos/${id}/concluir`, { method: 'POST', body: { concluido: !a.concluido } }); pageAtendimento(id); } catch (e) { falha(e); } };
  $('#del').onclick = async () => { if (await confirmar('Excluir este atendimento? Os documentos anexados continuam no cadastro.', { perigo: true, texto: 'Excluir' })) { try { await api('/atendimentos/' + id, { method: 'DELETE' }); location.hash = '#/atendimentos'; } catch (e) { falha(e); } } };
  $('#ia').onclick = () => abrirAssistenteCom({ cliente_id: a.cliente_id, processo_id: a.processo_id,
    prompt: `Com base no registro do atendimento #${a.id} (${a.assunto}) e no histórico do cliente, elabore: (1) um resumo executivo em até 8 linhas; (2) a ata formal do atendimento; (3) lista de providências com responsáveis e prazos sugeridos; (4) documentos que ainda precisam ser solicitados ao cliente; (5) riscos e prazos legais (prescrição/decadência) a observar.` });
  ligarAcoesDocs();
}

// ======================= DOCUMENTOS (componentes) =======================
function listaDocs(docs) {
  if (!docs?.length) return vazio('Nenhum documento.');
  return docs.map((d) => `<div class="list-item"><div style="flex:1;min-width:0"><b>${esc(d.titulo)}</b><div class="small muted">${L.categoria[d.categoria] || d.categoria} · ${fBytes(d.tamanho)} · ${fUTC(d.criado_em).slice(0, 10)}</div></div>
    <button class="btn sm ghost" data-ver="${d.id}" title="Visualizar">${ico('eye')}</button><a class="btn sm ghost" href="/api/documentos/${d.id}/arquivo" title="Baixar">${ico('down')}</a></div>`).join('');
}
function ligarAcoesDocs() { $$('[data-ver]').forEach((b) => (b.onclick = () => visualizarDoc(+b.dataset.ver))); }
function visualizarDoc(id) {
  const base = `/api/documentos/${id}/arquivo`;
  api('/documentos/' + id).then((d) => {
    const corpo = /pdf/.test(d.mime || '') ? `<iframe class="viewer" src="${base}?inline=1" title="${esc(d.titulo)}"></iframe>`
      : /^image\//.test(d.mime || '') ? `<img class="viewer-img" src="${base}?inline=1" alt="${esc(d.titulo)}">`
      : `<div class="empty">${ico('file')}Este formato não tem visualização no navegador. Use “Baixar”.</div>`;
    modal({ titulo: d.titulo, tamanho: 'lg', corpo, botoes: [{ texto: 'Fechar' }, { texto: 'Baixar', acao: () => { location.href = base; return false; } },
      { texto: 'Analisar com IA', classe: 'gold', acao: () => { abrirAssistenteCom({ cliente_id: d.cliente_id, processo_id: d.processo_id, documentos_ids: [d.id], prompt: 'Resuma este documento e destaque: partes, objeto, datas e prazos, valores, obrigações, cláusulas ou pontos de risco e inconsistências.' }); } }] });
  }).catch(falha);
}

async function abrirUpload(pre = {}, depois) {
  const cl = await listaClientes();
  let arquivos = [];
  const opProc = async (cid) => [['', '— Nenhum —'], ...(cid ? (await api('/processos' + qs({ cliente_id: cid }))).map((p) => [p.id, p.titulo]) : [])];
  modal({ titulo: 'Enviar documentos', tamanho: '',
    corpo: `<div class="drop" id="drop" tabindex="0">${ico('upload')}<div><b>Arraste arquivos aqui</b> ou clique para selecionar</div><div class="small muted">PDF, Word, imagens, planilhas, áudios — até 25 MB cada</div><input type="file" id="arq" multiple hidden></div><ul class="files" id="fl"></ul><br>
      <form class="f" onsubmit="return false">
      ${campoHTML({ n: 'titulo', label: 'Título (opcional)', col: 'c6', ph: 'Se vazio, usa o nome do arquivo' }, '')}
      ${campoHTML({ n: 'categoria', label: 'Tipo de documento', tipo: 'select', op: opts(L.categoria), col: 'c-half' }, 'outros')}
      ${campoHTML({ n: 'cliente_id', label: 'Cliente', tipo: 'select', op: opClientes(cl, '— Sem vínculo —'), col: 'c-half' }, pre.cliente_id)}
      ${campoHTML({ n: 'processo_id', label: 'Processo / caso', tipo: 'select', op: await opProc(pre.cliente_id), col: 'c6' }, pre.processo_id)}
      <input type="hidden" name="atendimento_id" value="${pre.atendimento_id || ''}"></form>
      <p class="note small">Os arquivos são gravados <b>criptografados</b> no servidor e só ficam acessíveis a usuários autenticados.</p>`,
    aoAbrir: (ov) => {
      const dz = $('#drop', ov), inp = $('#arq', ov);
      const mostrar = () => ($('#fl', ov).innerHTML = arquivos.map((f) => `<li><span>${esc(f.name)}</span><span class="muted small">${fBytes(f.size)}</span></li>`).join(''));
      const add = (fs) => { arquivos = [...arquivos, ...fs].slice(0, 20); mostrar(); };
      dz.onclick = () => inp.click(); dz.onkeydown = (e) => { if (e.key === 'Enter') inp.click(); };
      inp.onchange = () => add([...inp.files]);
      dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
      dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('over'); add([...e.dataTransfer.files]); };
      $('#f_cliente_id', ov).onchange = async (e) => { $('#f_processo_id', ov).innerHTML = (await opProc(e.target.value)).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join(''); };
    },
    botoes: [{ texto: 'Cancelar' }, { texto: 'Enviar', classe: 'gold', acao: async (ov) => {
      if (!arquivos.length) throw new Error('Selecione ao menos um arquivo.');
      const fd = new FormData(), v = lerForm(ov);
      for (const k of ['titulo', 'categoria', 'cliente_id', 'processo_id', 'atendimento_id']) fd.append(k, v[k] ?? '');
      arquivos.forEach((f) => fd.append('arquivos', f));
      await api('/documentos', { method: 'POST', form: fd });
      toast(arquivos.length > 1 ? 'Documentos enviados.' : 'Documento enviado.'); depois?.();
    } }] });
}

async function pageDocumentos(params) {
  const cl = await listaClientes();
  const f = { q: '', categoria: '', cliente_id: '', ...params };
  view(`<div class="page-h"><div><h1>Documentos</h1><div class="sub">Arquivo digital do escritório — busca também dentro do texto dos documentos</div></div>
    <div class="actions"><button class="btn gold" id="novo">${ico('upload')} Enviar documentos</button></div></div>
    <div class="filters"><input type="search" id="q" placeholder="Buscar por título, arquivo, cliente ou conteúdo…" value="${esc(f.q)}">
      <select id="cat"><option value="">Todos os tipos</option>${opts(L.categoria).map(([k, l]) => `<option value="${k}" ${f.categoria === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select id="cli">${opClientes(cl, 'Todos os clientes').map(([k, l]) => `<option value="${k}" ${String(f.cliente_id) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    <div class="card tbl" id="lista"></div>`);
  const carregar = async () => {
    const dados = await api('/documentos' + qs({ q: $('#q').value, categoria: $('#cat').value, cliente_id: $('#cli').value }));
    $('#lista').innerHTML = dados.length ? `<table><thead><tr><th>Documento</th><th>Tipo</th><th>Cliente / Caso</th><th>Enviado</th><th></th></tr></thead><tbody>${dados.map((d) => `<tr>
      <td><b>${esc(d.titulo)}</b> ${d.origem === 'ia' ? '<span class="badge gold">IA</span>' : ''}<div class="small muted">${esc(d.nome_original)} · ${fBytes(d.tamanho)}</div></td>
      <td><span class="badge">${L.categoria[d.categoria] || d.categoria}</span></td>
      <td>${d.cliente_id ? `<a href="#/clientes/${d.cliente_id}">${esc(d.cliente)}</a>` : '<span class="muted">—</span>'}${d.processo ? `<div class="small muted">${esc(d.processo)}</div>` : ''}</td>
      <td class="small">${fUTC(d.criado_em)}<div class="muted">${esc(d.enviado_por || '')}</div></td>
      <td style="white-space:nowrap;text-align:right"><button class="btn sm ghost" data-ver="${d.id}" title="Visualizar">${ico('eye')}</button><a class="btn sm ghost" href="/api/documentos/${d.id}/arquivo" title="Baixar">${ico('down')}</a>
        <button class="btn sm ghost" data-ia="${d.id}" title="Analisar com IA">${ico('spark')}</button><button class="btn sm ghost" data-ed="${d.id}" title="Editar dados">${ico('edit')}</button><button class="btn sm ghost" data-del="${d.id}" title="Excluir">${ico('trash')}</button></td></tr>`).join('')}</tbody></table>` : vazio('Nenhum documento encontrado.');
    ligarAcoesDocs();
    const por = (id) => dados.find((x) => x.id === +id);
    $$('[data-ia]').forEach((b) => (b.onclick = () => { const d = por(b.dataset.ia); abrirAssistenteCom({ cliente_id: d.cliente_id, processo_id: d.processo_id, documentos_ids: [d.id], prompt: 'Resuma este documento e destaque: partes, objeto, datas e prazos, valores, obrigações, cláusulas ou pontos de risco e inconsistências.' }); }));
    $$('[data-ed]').forEach((b) => (b.onclick = () => editarDoc(por(b.dataset.ed), carregar)));
    $$('[data-del]').forEach((b) => (b.onclick = async () => { const d = por(b.dataset.del); if (await confirmar(`Excluir definitivamente “${d.titulo}”?`, { perigo: true, texto: 'Excluir' })) { try { await api('/documentos/' + d.id, { method: 'DELETE' }); toast('Documento excluído.'); carregar(); } catch (e) { falha(e); } } }));
  };
  $('#q').oninput = debounce(carregar); $('#cat').onchange = carregar; $('#cli').onchange = carregar;
  $('#novo').onclick = () => abrirUpload({ cliente_id: $('#cli').value }, carregar);
  await carregar();
}
async function editarDoc(d, depois) {
  const cl = await listaClientes();
  const procs = [['', '— Nenhum —'], ...(d.cliente_id ? (await api('/processos' + qs({ cliente_id: d.cliente_id }))).map((p) => [p.id, p.titulo]) : [])];
  modal({ titulo: 'Dados do documento', corpo: formHTML([
      { n: 'titulo', label: 'Título', req: true, col: 'c6' }, { n: 'categoria', label: 'Tipo', tipo: 'select', op: opts(L.categoria), col: 'c-half' },
      { n: 'cliente_id', label: 'Cliente', tipo: 'select', op: opClientes(cl, '— Sem vínculo —'), col: 'c-half' }, { n: 'processo_id', label: 'Processo / caso', tipo: 'select', op: procs, col: 'c6' }], d),
    aoAbrir: (ov) => { $('#f_cliente_id', ov).onchange = async (e) => { $('#f_processo_id', ov).innerHTML = [['', '— Nenhum —'], ...(e.target.value ? (await api('/processos' + qs({ cliente_id: e.target.value }))).map((p) => [p.id, p.titulo]) : [])].map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join(''); }; },
    botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', classe: 'primary', acao: async (ov) => { await api('/documentos/' + d.id, { method: 'PUT', body: { ...lerForm(ov), atendimento_id: d.atendimento_id } }); toast('Salvo.'); depois(); } }] });
}

// ======================= CLIENTES =======================
const CAMPOS_CLI = [
  { n: 'tipo', label: 'Tipo', tipo: 'select', op: [['PF', 'Pessoa física'], ['PJ', 'Pessoa jurídica']], col: 'c1' },
  { n: 'nome', label: 'Nome completo / Razão social', req: true, col: 'c3' },
  { n: 'documento', label: 'CPF / CNPJ', col: 'c2' }, { n: 'rg', label: 'RG / Inscrição', col: 'c2' }, { n: 'nascimento', label: 'Nascimento / Fundação', tipo: 'date', col: 'c2' },
  { n: 'estado_civil', label: 'Estado civil', col: 'c2' }, { n: 'profissao', label: 'Profissão / Ramo', col: 'c2' },
  { n: 'email', label: 'E-mail', tipo: 'email', col: 'c-half' }, { n: 'telefone', label: 'Telefone / WhatsApp', col: 'c-half' },
  { n: 'endereco', label: 'Endereço completo', col: 'c6' }, { n: 'observacoes', label: 'Observações internas', tipo: 'textarea', rows: 3, col: 'c6' },
];
function abrirCliente(v = {}, depois) {
  const ed = !!v.id;
  modal({ titulo: ed ? 'Editar cliente' : 'Novo cliente', tamanho: 'lg', corpo: formHTML(CAMPOS_CLI, { tipo: 'PF', ...v }),
    botoes: [{ texto: 'Cancelar' }, { texto: ed ? 'Salvar' : 'Cadastrar cliente', classe: 'gold', acao: async (ov) => {
      const r = await api(ed ? `/clientes/${v.id}` : '/clientes', { method: ed ? 'PUT' : 'POST', body: lerForm(ov) });
      cache.clientes = null; toast('Cliente salvo.'); depois?.(r);
    } }] });
}
async function pageClientes(params) {
  const f = { q: '', ...params };
  view(`<div class="page-h"><div><h1>Clientes</h1><div class="sub">Cadastro e histórico de relacionamento</div></div><div class="actions"><button class="btn gold" id="novo">${ico('plus')} Novo cliente</button></div></div>
    <div class="filters"><input type="search" id="q" placeholder="Buscar por nome, CPF/CNPJ, e-mail ou telefone…" value="${esc(f.q)}"><label class="chk" style="margin:0"><input type="checkbox" id="ina"> Mostrar arquivados</label></div>
    <div class="card tbl" id="lista"></div>`);
  const carregar = async () => {
    const dados = await api('/clientes' + qs({ q: $('#q').value, inativos: $('#ina').checked }));
    $('#lista').innerHTML = dados.length ? `<table><thead><tr><th>Cliente</th><th>CPF / CNPJ</th><th>Contato</th><th>Casos</th><th>Atend.</th><th>Último contato</th></tr></thead><tbody>${dados.map((c) => `
      <tr class="click" data-id="${c.id}"><td><b>${esc(c.nome)}</b> ${c.ativo ? '' : '<span class="badge">Arquivado</span>'}<div class="small muted">${c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}</div></td>
      <td>${esc(c.documento || '—')}</td><td>${esc(c.telefone || '')}<div class="small muted">${esc(c.email || '')}</div></td><td>${c.n_processos}</td><td>${c.n_atendimentos}</td><td class="small">${fData(c.ultimo_atendimento)}</td></tr>`).join('')}</tbody></table>` : vazio('Nenhum cliente encontrado.', 'users');
    $$('tr.click', $('#lista')).forEach((tr) => (tr.onclick = () => (location.hash = '#/clientes/' + tr.dataset.id)));
  };
  $('#q').oninput = debounce(carregar); $('#ina').onchange = carregar;
  $('#novo').onclick = () => abrirCliente({}, (r) => (location.hash = '#/clientes/' + r.id));
  await carregar();
}
async function pageCliente(id) {
  const c = await api('/clientes/' + id);
  view(`<div class="crumb"><a href="#/clientes">Clientes</a> › ${esc(c.nome)}</div>
    <div class="page-h"><div><h1>${esc(c.nome)}</h1><div class="sub">${c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}${c.documento ? ' · ' + esc(c.documento) : ''} ${c.ativo ? '' : '· <span class="badge">Arquivado</span>'}</div></div>
      <div class="actions"><button class="btn gold" id="at">${ico('plus')} Atendimento</button><button class="btn" id="pr">${ico('scale')} Novo caso</button><button class="btn" id="up">${ico('upload')} Documento</button>
        <button class="btn" id="ia">${ico('spark')} IA</button><button class="btn" id="ed">${ico('edit')} Editar</button><button class="btn" id="arq">${c.ativo ? 'Arquivar' : 'Reativar'}</button></div></div>
    <div class="grid g2"><div style="display:flex;flex-direction:column;gap:18px">
      <div class="card"><div class="card-h"><h3>Casos e processos</h3></div>${c.processos.length ? `<div class="tbl"><table><tbody>${c.processos.map((p) => `<tr class="click" data-p="${p.id}"><td><b>${esc(p.titulo)}</b><div class="small muted">${esc(p.numero || 'sem número')} ${p.area ? '· ' + esc(p.area) : ''}</div></td><td><span class="badge ${L.statusCor[p.status]}">${L.status[p.status]}</span></td></tr>`).join('')}</tbody></table></div>` : vazio('Nenhum caso cadastrado.', 'scale')}</div>
      <div class="card"><div class="card-h"><h3>Histórico de atendimentos</h3></div><div class="card-b">${c.atendimentos.length ? `<div class="timeline">${c.atendimentos.map((a) => `<div class="it"><div class="small muted">${fDataHora(a.data_hora)} · ${L.canal[a.canal] || a.canal} ${badgePrazo(a.prazo, a.concluido)}</div><a href="#/atendimentos/${a.id}"><b>${esc(a.assunto)}</b></a>${a.resumo ? `<div class="small muted">${esc(a.resumo.slice(0, 180))}${a.resumo.length > 180 ? '…' : ''}</div>` : ''}</div>`).join('')}</div>` : vazio('Nenhum atendimento registrado.', 'chat')}</div></div></div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div class="card"><div class="card-h"><h3>Dados cadastrais</h3></div><div class="card-b"><dl class="kv">
        <dt>RG / Inscrição</dt><dd>${esc(c.rg || '—')}</dd><dt>Nascimento</dt><dd>${fData(c.nascimento)}</dd><dt>Estado civil</dt><dd>${esc(c.estado_civil || '—')}</dd><dt>Profissão</dt><dd>${esc(c.profissao || '—')}</dd>
        <dt>E-mail</dt><dd>${esc(c.email || '—')}</dd><dt>Telefone</dt><dd>${esc(c.telefone || '—')}</dd><dt>Endereço</dt><dd>${esc(c.endereco || '—')}</dd><dt>Observações</dt><dd class="pre">${esc(c.observacoes || '—')}</dd></dl></div></div>
      <div class="card"><div class="card-h"><h3>Documentos</h3></div>${listaDocs(c.documentos)}</div></div></div>`);
  const rec = () => pageCliente(id);
  $('#at').onclick = () => abrirAtendimento({ cliente_id: c.id }, rec);
  $('#pr').onclick = () => abrirProcesso({ cliente_id: c.id }, rec);
  $('#up').onclick = () => abrirUpload({ cliente_id: c.id }, rec);
  $('#ed').onclick = () => abrirCliente(c, rec);
  $('#ia').onclick = () => abrirAssistenteCom({ cliente_id: c.id });
  $('#arq').onclick = async () => { await api(`/clientes/${id}/ativo`, { method: 'POST', body: { ativo: !c.ativo } }); cache.clientes = null; rec(); };
  $$('tr[data-p]').forEach((tr) => (tr.onclick = () => (location.hash = '#/processos/' + tr.dataset.p)));
  ligarAcoesDocs();
}

// ======================= PROCESSOS =======================
async function abrirProcesso(v = {}, depois) {
  const cl = await listaClientes(); const ed = !!v.id; await carregarOpcoes();
  modal({ titulo: ed ? 'Editar caso' : 'Novo caso / processo', tamanho: 'lg', corpo: formHTML([
      { n: 'cliente_id', label: 'Cliente', tipo: 'select', op: opClientes(cl), req: true, col: 'c3' }, { n: 'status', label: 'Situação', tipo: 'select', op: opts(L.status), col: 'c-half' },
      { n: 'titulo', label: 'Título do caso', req: true, col: 'c6', ph: 'Ex.: Ação de alimentos — Fulano x Beltrano' },
      { n: 'numero', label: 'Nº do processo (CNJ)', col: 'c2', ph: '0000000-00.0000.0.00.0000' }, { n: 'area', label: 'Área', tipo: 'select', op: [['', '—'], ...S.opcoes.areas.map((a) => [a, a])], col: 'c2' },
      { n: 'valor_causa', label: 'Valor da causa (R$)', tipo: 'number', col: 'c2' }, { n: 'juizo', label: 'Juízo / Vara / Órgão', col: 'c-half' }, { n: 'parte_contraria', label: 'Parte contrária', col: 'c-half' },
      { n: 'responsavel_id', label: 'Advogado responsável', tipo: 'select', op: [['', '—'], ...S.opcoes.usuarios.map((u) => [u.id, u.nome])], col: 'c-half' },
      { n: 'observacoes', label: 'Observações', tipo: 'textarea', rows: 3, col: 'c6' }], { status: 'em_andamento', ...v }),
    botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', classe: 'gold', acao: async (ov) => { const r = await api(ed ? `/processos/${v.id}` : '/processos', { method: ed ? 'PUT' : 'POST', body: lerForm(ov) }); toast('Caso salvo.'); depois?.(r); } }] });
}
async function carregarOpcoes() { if (!S.opcoes) S.opcoes = await api('/opcoes'); return S.opcoes; }
async function pageProcessos(params) {
  const f = { q: '', status: '', ...params };
  view(`<div class="page-h"><div><h1>Casos e processos</h1><div class="sub">Acompanhamento da carteira do escritório</div></div><div class="actions"><button class="btn gold" id="novo">${ico('plus')} Novo caso</button></div></div>
    <div class="filters"><input type="search" id="q" placeholder="Buscar por título, número, cliente ou parte contrária…" value="${esc(f.q)}"><select id="st"><option value="">Todas as situações</option>${opts(L.status).map(([k, l]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="card tbl" id="lista"></div>`);
  const carregar = async () => {
    const dados = await api('/processos' + qs({ q: $('#q').value, status: $('#st').value }));
    $('#lista').innerHTML = dados.length ? `<table><thead><tr><th>Caso</th><th>Cliente</th><th>Nº / Juízo</th><th>Área</th><th>Situação</th></tr></thead><tbody>${dados.map((p) => `<tr class="click" data-id="${p.id}"><td><b>${esc(p.titulo)}</b></td><td>${esc(p.cliente)}</td><td>${esc(p.numero || '—')}<div class="small muted">${esc(p.juizo || '')}</div></td><td>${esc(p.area || '—')}</td><td><span class="badge ${L.statusCor[p.status]}">${L.status[p.status]}</span></td></tr>`).join('')}</tbody></table>` : vazio('Nenhum caso encontrado.', 'scale');
    $$('tr.click', $('#lista')).forEach((tr) => (tr.onclick = () => (location.hash = '#/processos/' + tr.dataset.id)));
  };
  $('#q').oninput = debounce(carregar); $('#st').onchange = carregar;
  $('#novo').onclick = () => abrirProcesso({}, (r) => (location.hash = '#/processos/' + r.id));
  await carregar();
}
async function pageProcesso(id) {
  const p = await api('/processos/' + id);
  view(`<div class="crumb"><a href="#/processos">Casos</a> › ${esc(p.titulo)}</div>
    <div class="page-h"><div><h1>${esc(p.titulo)}</h1><div class="sub">${esc(p.numero || 'Sem número')} · <span class="badge ${L.statusCor[p.status]}">${L.status[p.status]}</span></div></div>
      <div class="actions"><button class="btn gold" id="at">${ico('plus')} Atendimento</button><button class="btn" id="up">${ico('upload')} Documento</button><button class="btn" id="ia">${ico('spark')} IA</button><button class="btn" id="ed">${ico('edit')} Editar</button></div></div>
    <div class="grid g2"><div style="display:flex;flex-direction:column;gap:18px">
      <div class="card"><div class="card-h"><h3>Andamento / atendimentos</h3></div><div class="card-b">${p.atendimentos.length ? `<div class="timeline">${p.atendimentos.map((a) => `<div class="it"><div class="small muted">${fDataHora(a.data_hora)} · ${L.canal[a.canal] || a.canal}</div><a href="#/atendimentos/${a.id}"><b>${esc(a.assunto)}</b></a>${a.resumo ? `<div class="small muted">${esc(a.resumo.slice(0, 200))}</div>` : ''}</div>`).join('')}</div>` : vazio('Nenhum atendimento vinculado.', 'chat')}</div></div>
      <div class="card"><div class="card-h"><h3>Documentos do caso</h3></div>${listaDocs(p.documentos)}</div></div>
    <div class="card"><div class="card-h"><h3>Dados do caso</h3></div><div class="card-b"><dl class="kv"><dt>Cliente</dt><dd><a href="#/clientes/${p.cliente_id}">${esc(p.cliente)}</a></dd><dt>Área</dt><dd>${esc(p.area || '—')}</dd><dt>Juízo / Órgão</dt><dd>${esc(p.juizo || '—')}</dd>
      <dt>Parte contrária</dt><dd>${esc(p.parte_contraria || '—')}</dd><dt>Valor da causa</dt><dd>${fMoeda(p.valor_causa)}</dd><dt>Responsável</dt><dd>${esc(p.responsavel || '—')}</dd><dt>Observações</dt><dd class="pre">${esc(p.observacoes || '—')}</dd></dl></div></div></div>`);
  const rec = () => pageProcesso(id);
  $('#at').onclick = () => abrirAtendimento({ cliente_id: p.cliente_id, processo_id: p.id }, rec);
  $('#up').onclick = () => abrirUpload({ cliente_id: p.cliente_id, processo_id: p.id }, rec);
  $('#ed').onclick = () => abrirProcesso(p, rec);
  $('#ia').onclick = () => abrirAssistenteCom({ cliente_id: p.cliente_id, processo_id: p.id });
  ligarAcoesDocs();
}

// ======================= USUÁRIOS / AUDITORIA / SENHA =======================
async function pageUsuarios() {
  const us = await api('/admin/usuarios');
  view(`<div class="page-h"><div><h1>Usuários</h1><div class="sub">Quem tem acesso ao sistema do escritório</div></div><div class="actions"><button class="btn gold" id="novo">${ico('plus')} Novo usuário</button></div></div>
    <div class="card tbl"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>${us.map((u) => `<tr><td><b>${esc(u.nome)}</b></td><td>${esc(u.email)}</td><td><span class="badge gold">${L.papel[u.papel]}</span></td><td>${u.ativo ? '<span class="badge ok">Ativo</span>' : '<span class="badge">Inativo</span>'}</td><td style="text-align:right"><button class="btn sm" data-ed="${u.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>
    <p class="note small" style="margin-top:14px"><b>Perfis:</b> Administrador gerencia usuários e vê o registro de auditoria · Advogado(a) tem acesso completo aos dados · Estagiário(a) não pode excluir documentos nem atendimentos.</p>`);
  const form = (u = {}) => formHTML([{ n: 'nome', label: 'Nome', req: true, col: 'c6' }, { n: 'email', label: 'E-mail (login)', tipo: 'email', req: true, col: 'c-half' }, { n: 'papel', label: 'Perfil', tipo: 'select', op: opts(L.papel), col: 'c-half' },
    { n: 'senha', label: u.id ? 'Nova senha (deixe vazio para manter)' : 'Senha inicial', tipo: 'password', col: 'c6', dica: 'Mínimo de 10 caracteres, com letras e números.' }, ...(u.id ? [{ n: 'ativo', label: 'Usuário ativo', tipo: 'checkbox' }] : [])], u);
  $('#novo').onclick = () => modal({ titulo: 'Novo usuário', corpo: form({ papel: 'advogado' }), botoes: [{ texto: 'Cancelar' }, { texto: 'Criar', classe: 'gold', acao: async (ov) => { await api('/admin/usuarios', { method: 'POST', body: lerForm(ov) }); S.opcoes = null; toast('Usuário criado.'); pageUsuarios(); } }] });
  $$('[data-ed]').forEach((b) => (b.onclick = () => { const u = us.find((x) => x.id === +b.dataset.ed); modal({ titulo: 'Editar usuário', corpo: form(u), aoAbrir: (ov) => { $('#f_email', ov).disabled = true; },
    botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', classe: 'gold', acao: async (ov) => { const v = lerForm(ov); await api('/admin/usuarios/' + u.id, { method: 'PUT', body: { nome: v.nome, papel: v.papel, ativo: v.ativo, senha: v.senha } }); S.opcoes = null; toast('Usuário atualizado.'); pageUsuarios(); } }] }); }));
}
async function pageAuditoria() {
  const rows = await api('/admin/auditoria');
  view(`<div class="page-h"><div><h1>Registro de auditoria</h1><div class="sub">Últimas 300 ações no sistema — quem fez o quê e quando</div></div></div>
    <div class="card tbl"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Item</th><th>Detalhe</th><th>IP</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="small" style="white-space:nowrap">${fUTC(r.criado_em)}</td><td>${esc(r.usuario_nome || '—')}</td><td><span class="badge">${esc(r.acao)}</span></td><td class="small">${esc(r.entidade || '')}${r.entidade_id ? ' #' + r.entidade_id : ''}</td><td class="small">${esc(r.detalhe || '')}</td><td class="small muted">${esc(r.ip || '')}</td></tr>`).join('')}</tbody></table></div>`);
}
function abrirSenha() {
  modal({ titulo: 'Alterar minha senha', tamanho: 'sm', corpo: formHTML([{ n: 'atual', label: 'Senha atual', tipo: 'password', col: 'c6' }, { n: 'nova', label: 'Nova senha', tipo: 'password', col: 'c6', dica: 'Mínimo de 10 caracteres, com letras e números.' }]),
    botoes: [{ texto: 'Cancelar' }, { texto: 'Alterar', classe: 'primary', acao: async (ov) => { await api('/auth/senha', { method: 'POST', body: lerForm(ov) }); toast('Senha alterada. Outros dispositivos foram desconectados.'); } }] });
}

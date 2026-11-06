/* Gerenciador de pastas e documentos (árvore + lista, com arrastar e soltar) */
'use strict';

// escopo: { cliente_id: number | null }  (null = pastas gerais do escritório)
async function painelPastas(el, escopo, depois) {
  const cid = escopo.cliente_id || null;
  const estado = { sel: 'todas' };
  try { const s = sessionStorage.getItem('pastaSel:' + (cid || 0)); if (s) estado.sel = s === 'todas' || s === 'sem' ? s : +s; } catch { /* ok */ }
  const caminho = (pastas, id) => { const nomes = []; for (let a = pastas.find((p) => p.id === id), i = 0; a && i < 30; i++) { nomes.unshift(a.nome); a = pastas.find((p) => p.id === a.parent_id); } return nomes; };

  async function render() {
    const [pastas, docs] = await Promise.all([
      api('/pastas' + qs(cid ? { cliente_id: cid } : { geral: 1 })),
      api('/documentos' + qs(cid ? { cliente_id: cid } : { sem_cliente: 1 })),
    ]);
    if (typeof estado.sel === 'number' && !pastas.some((p) => p.id === estado.sel)) estado.sel = 'todas';
    try { sessionStorage.setItem('pastaSel:' + (cid || 0), String(estado.sel)); } catch { /* ok */ }
    const filhos = (pai) => pastas.filter((p) => (p.parent_id || null) === pai);
    const doNo = (p) => docs.filter((d) => d.pasta_id === p.id).length;
    const arvore = (pai, nivel) => filhos(pai).map((p) => `<div class="fm-n ${estado.sel === p.id ? 'on' : ''}" data-sel="${p.id}" data-drop="${p.id}" style="padding-left:${10 + nivel * 16}px">${ico('folder')}<span class="fm-nome">${esc(p.nome)}</span><span class="fm-c">${doNo(p)}</span></div>${arvore(p.id, nivel + 1)}`).join('');
    const visiveis = estado.sel === 'todas' ? docs : estado.sel === 'sem' ? docs.filter((d) => !d.pasta_id) : docs.filter((d) => d.pasta_id === estado.sel);
    const pastaSel = typeof estado.sel === 'number' ? pastas.find((p) => p.id === estado.sel) : null;
    const titulo = pastaSel ? caminho(pastas, pastaSel.id).map(esc).join(' <span class="muted">›</span> ') : estado.sel === 'sem' ? 'Documentos sem pasta' : 'Todos os documentos';
    const subs = pastaSel ? filhos(pastaSel.id) : estado.sel === 'todas' ? filhos(null) : [];

    el.innerHTML = `<div class="fm"><div class="fm-tree">
        <div class="fm-tools"><button class="btn sm" id="fmNova">${ico('plus')} Nova pasta</button>${cid ? `<button class="btn sm" id="fmPadrao" title="Cria Identificação, Procurações e contratos, Comprovantes, Provas, Peças e decisões, Correspondência">Pastas padrão</button>` : ''}</div>
        <div class="fm-n ${estado.sel === 'todas' ? 'on' : ''}" data-sel="todas">${ico('file')}<span class="fm-nome">Todos os documentos</span><span class="fm-c">${docs.length}</span></div>
        <div class="fm-n ${estado.sel === 'sem' ? 'on' : ''}" data-sel="sem" data-drop="0">${ico('file')}<span class="fm-nome">Sem pasta</span><span class="fm-c">${docs.filter((d) => !d.pasta_id).length}</span></div>
        ${arvore(null, 0) || '<div class="small muted" style="padding:10px">Nenhuma pasta criada. Crie uma ou use “Pastas padrão”.</div>'}</div>
      <div class="fm-main"><div class="fm-h"><div style="min-width:0"><div class="small muted">${cid ? 'Pastas deste cliente' : 'Pastas gerais do escritório (sem cliente)'}</div><h3>${titulo}</h3></div>
        <div class="actions" style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn sm gold" id="fmEnv">${ico('upload')} Enviar ${pastaSel ? 'para esta pasta' : 'documento'}</button>
          ${pastaSel ? `<button class="btn sm" id="fmSub">${ico('plus')} Subpasta</button><button class="btn sm" id="fmRen">${ico('edit')} Renomear</button><button class="btn sm danger" id="fmDel">${ico('trash')} Excluir pasta</button>` : ''}
          <button class="btn sm" id="fmMov" disabled>Mover para…</button><button class="btn sm" id="fmZip" disabled>${ico('down')} ZIP</button></div></div>
        ${subs.length ? `<div class="fm-subs">${subs.map((p) => `<button class="fm-sub" data-sel="${p.id}" data-drop="${p.id}">${ico('folder')} ${esc(p.nome)} <span class="muted small">${doNo(p)}</span></button>`).join('')}</div>` : ''}
        ${visiveis.length ? `<div class="tbl"><table><thead><tr><th style="width:34px"><input type="checkbox" id="fmTodos" aria-label="Selecionar todos"></th><th>Documento</th><th>Tipo</th><th>Data</th><th></th></tr></thead><tbody>${visiveis.map((d) => `<tr draggable="true" data-doc="${d.id}">
          <td><input type="checkbox" class="fmSel" value="${d.id}"></td><td><b>${esc(d.titulo)}</b>${estado.sel === 'todas' && d.pasta ? ` <span class="badge">${esc(d.pasta)}</span>` : ''}${d.resumo ? `<div class="small muted">${esc(d.resumo)}</div>` : ''}<div class="small muted">${esc(d.nome_original)} · ${fBytes(d.tamanho)}</div></td>
          <td><span class="badge">${L.categoria[d.categoria] || d.categoria}</span></td><td class="small">${d.data_documento ? fData(d.data_documento) : fUTC(d.criado_em).slice(0, 10)}</td>
          <td style="white-space:nowrap;text-align:right"><button class="btn sm ghost" data-ver="${d.id}" title="Visualizar">${ico('eye')}</button><a class="btn sm ghost" href="/api/documentos/${d.id}/arquivo" title="Baixar">${ico('down')}</a></td></tr>`).join('')}</tbody></table></div>`
          : `<div class="empty">${ico('file')}${docs.length ? 'Nenhum documento aqui. Arraste documentos da lista para uma pasta ou use “Enviar”.' : 'Nenhum documento ainda.'}</div>`}
        <div class="small muted" style="padding:8px 4px">Dica: arraste um documento e solte sobre uma pasta para movê-lo.</div></div></div>`;

    const recarregar = async () => { await render(); depois?.(); };
    $$('[data-sel]', el).forEach((n) => (n.onclick = () => { const v = n.dataset.sel; estado.sel = v === 'todas' || v === 'sem' ? v : +v; render(); }));
    ligarAcoesDocs();

    const marcados = () => $$('.fmSel:checked', el).map((c) => +c.value);
    const atualiza = () => { const n = marcados().length; $('#fmMov', el).disabled = !n; $('#fmZip', el).disabled = !n; $('#fmMov', el).textContent = n ? `Mover ${n} para…` : 'Mover para…'; };
    $$('.fmSel', el).forEach((c) => (c.onchange = atualiza));
    if ($('#fmTodos', el)) $('#fmTodos', el).onchange = (e) => { $$('.fmSel', el).forEach((c) => (c.checked = e.target.checked)); atualiza(); };
    $('#fmZip', el).onclick = () => baixarZip(marcados());

    const mover = async (ids, pasta_id) => { try { await api('/pastas/mover-docs', { method: 'POST', body: { ids, pasta_id: pasta_id || '' } }); toast('Documento(s) movido(s).'); recarregar(); } catch (e) { falha(e); } };
    $('#fmMov', el).onclick = () => {
      const ids = marcados();
      modal({ titulo: `Mover ${ids.length} documento(s)`, tamanho: 'sm',
        corpo: formHTML([{ n: 'pasta', label: 'Para a pasta', tipo: 'select', op: [['', '— Sem pasta —'], ...pastas.map((p) => [p.id, caminho(pastas, p.id).join(' › ')]).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))], col: 'c6' }]),
        botoes: [{ texto: 'Cancelar' }, { texto: 'Mover', classe: 'gold', acao: async (ov) => { await api('/pastas/mover-docs', { method: 'POST', body: { ids, pasta_id: lerForm(ov).pasta } }); toast('Documento(s) movido(s).'); recarregar(); } }] });
    };

    // arrastar e soltar
    $$('tr[draggable]', el).forEach((tr) => (tr.ondragstart = (e) => {
      const sel = marcados(); const ids = sel.includes(+tr.dataset.doc) ? sel : [+tr.dataset.doc];
      e.dataTransfer.setData('text/plain', JSON.stringify(ids)); e.dataTransfer.effectAllowed = 'move';
    }));
    $$('[data-drop]', el).forEach((alvo) => {
      alvo.ondragover = (e) => { e.preventDefault(); alvo.classList.add('drop-on'); };
      alvo.ondragleave = () => alvo.classList.remove('drop-on');
      alvo.ondrop = (e) => { e.preventDefault(); alvo.classList.remove('drop-on'); try { const ids = JSON.parse(e.dataTransfer.getData('text/plain')); if (Array.isArray(ids)) mover(ids, +alvo.dataset.drop || ''); } catch { /* arrasto de outro tipo */ } };
    });

    const pedirNome = (titulo, valor, ok) => modal({ titulo, tamanho: 'sm', corpo: formHTML([{ n: 'nome', label: 'Nome da pasta', req: true, col: 'c6' }], { nome: valor }), botoes: [{ texto: 'Cancelar' }, { texto: 'Salvar', classe: 'gold', acao: async (ov) => { await ok(lerForm(ov).nome); } }] });
    $('#fmNova', el).onclick = () => pedirNome('Nova pasta', '', async (nome) => { await api('/pastas', { method: 'POST', body: { nome, cliente_id: cid || '' } }); recarregar(); });
    if ($('#fmPadrao', el)) $('#fmPadrao', el).onclick = async () => { try { const r = await api('/pastas/padrao', { method: 'POST', body: { cliente_id: cid } }); toast(r.criadas ? `${r.criadas} pasta(s) criada(s).` : 'As pastas padrão já existem.'); recarregar(); } catch (e) { falha(e); } };
    $('#fmEnv', el).onclick = () => abrirUpload({ cliente_id: cid || '', pasta_id: pastaSel?.id || '' }, recarregar);
    if (pastaSel) {
      $('#fmSub', el).onclick = () => pedirNome('Nova subpasta em “' + pastaSel.nome + '”', '', async (nome) => { await api('/pastas', { method: 'POST', body: { nome, cliente_id: cid || '', parent_id: pastaSel.id } }); recarregar(); });
      $('#fmRen', el).onclick = () => pedirNome('Renomear pasta', pastaSel.nome, async (nome) => { await api('/pastas/' + pastaSel.id, { method: 'PUT', body: { nome } }); recarregar(); });
      $('#fmDel', el).onclick = async () => {
        if (!(await confirmar(`Excluir a pasta “${pastaSel.nome}”${pastaSel.n_sub ? ' e suas subpastas' : ''}? Os documentos NÃO serão apagados: ficam em “Sem pasta”.`, { perigo: true, texto: 'Excluir pasta' }))) return;
        try { await api('/pastas/' + pastaSel.id, { method: 'DELETE' }); estado.sel = 'todas'; toast('Pasta excluída.'); recarregar(); } catch (e) { falha(e); }
      };
    }
  }
  await render();
}

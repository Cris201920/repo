/* Organização de documentos por IA: análise, revisão das sugestões e visão "por cliente" */
'use strict';

async function iaConfigurada() {
  if (S.iaOk === undefined) { try { S.iaOk = (await api('/ia/status')).configurado; } catch { S.iaOk = false; } }
  return S.iaOk;
}

// ---------- Visão em pastas: Cliente > Caso > Tipo ----------
function vistaArvore(dados) {
  if (!dados.length) return vazio('Nenhum documento encontrado.');
  const clientes = new Map();
  for (const d of dados) {
    const k = d.cliente_id || 0;
    if (!clientes.has(k)) clientes.set(k, { nome: d.cliente || 'Sem cliente — a organizar', docs: [] });
    clientes.get(k).docs.push(d);
  }
  const ordemCat = Object.keys(L.categoria);
  const lista = [...clientes.entries()].sort((a, b) => (a[0] === 0 ? -1 : b[0] === 0 ? 1 : a[1].nome.localeCompare(b[1].nome, 'pt-BR')));
  const item = (d) => `<div class="tree-i"><div style="min-width:0"><b>${esc(d.titulo)}</b>${d.data_documento ? ` <span class="small muted">· ${fData(d.data_documento)}</span>` : ''}
      ${d.resumo ? `<div class="small muted">${esc(d.resumo)}</div>` : ''}</div>
      <div style="white-space:nowrap"><button class="btn sm ghost" data-ver="${d.id}" title="Visualizar">${ico('eye')}</button><a class="btn sm ghost" href="/api/documentos/${d.id}/arquivo" title="Baixar">${ico('down')}</a></div></div>`;
  return `<div class="tree">${lista.map(([k, c]) => {
    const casos = new Map();
    for (const d of c.docs) { const kp = d.processo_id || 0; if (!casos.has(kp)) casos.set(kp, { nome: d.processo || 'Sem caso vinculado', docs: [] }); casos.get(kp).docs.push(d); }
    const blocos = [...casos.entries()].sort((a, b) => (a[0] === 0 ? 1 : b[0] === 0 ? -1 : a[1].nome.localeCompare(b[1].nome, 'pt-BR'))).map(([, p]) => {
      const porCat = ordemCat.map((cat) => [cat, p.docs.filter((d) => d.categoria === cat)]).filter(([, a]) => a.length);
      return `<div class="tree-p"><div class="tree-t">${ico('scale')} ${esc(p.nome)}</div>${porCat.map(([cat, a]) => `<div class="tree-g"><div class="tree-cat">${L.categoria[cat] || cat} <span class="muted">(${a.length})</span></div>${a.map(item).join('')}</div>`).join('')}</div>`;
    }).join('');
    return `<details class="tree-c" ${k === 0 ? 'open' : ''}><summary><b>${esc(c.nome)}</b> <span class="badge ${k === 0 ? 'warn' : ''}">${c.docs.length} documento(s)</span>${k ? ` <a class="small" href="#/clientes/${k}">abrir cliente</a>` : ' <span class="small muted">sem cliente vinculado — edite o documento para vincular</span>'}</summary>${blocos}</details>`;
  }).join('')}</div>`;
}

// ---------- Análise (com barra de progresso) ----------
async function organizarDocs(ids, depois) {
  if (!ids.length) return toast('Nenhum documento para organizar.', true);
  if (!(await iaConfigurada())) return toast('O Assistente de IA não está disponível aqui. Em “Acesso e segurança” veja como ativá-lo.', true);
  const resultados = [], erros = [];
  let feitos = 0, cancelado = false;
  const m = modal({ titulo: 'Organizando com IA…', tamanho: 'sm',
    corpo: `<p id="orgmsg">Analisando 0 de ${ids.length}…</p><div class="prog"><div id="orgbar" style="width:0"></div></div>
      <p class="small muted" style="margin-bottom:0">A IA lê cada arquivo, identifica o tipo, as partes e o número do processo e propõe onde guardar. <b>Nada é alterado antes da sua confirmação.</b></p>`,
    botoes: [{ texto: 'Cancelar', acao: () => { cancelado = true; } }] });
  const fila = [...ids];
  const trabalhar = async () => {
    while (fila.length && !cancelado) {
      const id = fila.shift();
      try { resultados.push(await api(`/documentos/${id}/organizar`, { method: 'POST' })); } catch (e) { erros.push(e.message); }
      feitos++;
      if ($('#orgmsg')) { $('#orgmsg').textContent = `Analisando ${Math.min(feitos + 1, ids.length)} de ${ids.length}…`; $('#orgbar').style.width = Math.round((feitos / ids.length) * 100) + '%'; }
    }
  };
  await Promise.all([trabalhar(), trabalhar()]);
  m.fechar();
  if (erros.length) toast(`${erros.length} arquivo(s) não puderam ser analisados: ${erros[0]}`, true);
  if (resultados.length) revisarSugestoes(resultados.sort((a, b) => a.id - b.id), depois); else depois?.();
}

async function revisarPorIds(ids, depois) {
  const sugs = [];
  for (const id of ids) { try { sugs.push(await api(`/documentos/${id}/sugestao`)); } catch { /* sem sugestão salva */ } }
  if (!sugs.length) { toast('Não há sugestões salvas para revisar.'); return depois?.(); }
  revisarSugestoes(sugs, depois);
}

// ---------- Revisão das sugestões ----------
async function revisarSugestoes(sugs, depois) {
  const cl = await listaClientes();
  const cacheProc = new Map();
  const procsDe = async (cid) => { if (!cid) return []; if (!cacheProc.has(String(cid))) cacheProc.set(String(cid), await api('/processos' + qs({ cliente_id: cid }))); return cacheProc.get(String(cid)); };
  const rotuloConf = { alta: ['ok', 'Vínculo seguro'], media: ['warn', 'Confira o cliente'], baixa: ['info', 'Vínculo incerto'] };
  const segHTML = (g, i, j, multi) => {
    const v = g.vinculo || {};
    const conf = rotuloConf[v.confianca];
    const cand = !v.cliente_id && v.candidatos?.length > 1 ? `<div class="small muted">Possíveis clientes: ${v.candidatos.map((c) => esc(c.nome)).join(' · ')}</div>` : '';
    return `<div class="org-seg" data-j="${j}">
      ${multi ? `<div class="small muted" style="margin-bottom:4px"><b>${g.pagina_inicial === g.pagina_final ? 'Página ' + g.pagina_inicial : `Páginas ${g.pagina_inicial}–${g.pagina_final}`}</b></div>` : ''}
      <div class="f">
        <div class="c3"><label>Título</label><input type="text" data-f="titulo" value="${esc(g.titulo)}"></div>
        <div class="c1"><label>Tipo</label><select data-f="categoria">${opts(L.categoria).map(([k, l]) => `<option value="${k}" ${k === g.categoria ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="c-half"><label>Cliente</label><select data-f="cliente_id">${opClientes(cl, '— Sem cliente —').map(([k, l]) => `<option value="${k}" ${String(k) === String(v.cliente_id || '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        <div class="c-half"><label>Caso / processo</label><select data-f="processo_id"><option value="">— Nenhum —</option></select></div>
        <div class="c3"><label>Resumo</label><input type="text" data-f="resumo" value="${esc(g.resumo || '')}"></div>
        <div class="c1"><label>Data do documento</label><input type="date" data-f="data_documento" value="${esc(g.data_documento || '')}"></div>
      </div>
      <div class="small" style="margin-top:6px">${conf ? `<span class="badge ${conf[0]}">${conf[1]}</span> ` : '<span class="badge">Sem vínculo automático</span> '}${esc(v.motivo || 'Nenhum cliente cadastrado foi identificado no documento.')}
        ${g.tags?.length ? `<span class="muted"> · ${g.tags.map(esc).join(', ')}</span>` : ''}</div>${cand}</div>`;
  };
  const cardHTML = (s, i) => {
    const multi = s.segmentos.length > 1;
    return `<div class="org-card" data-i="${i}">
      <div class="org-h"><label class="chk"><input type="checkbox" class="org-on" checked> <b>${esc(s.nome_original)}</b></label><span class="muted small">${s.paginas} pág.</span>
        ${s.duplicado ? `<span class="badge warn" title="Mesmo conteúdo do documento #${s.duplicado.id}: ${esc(s.duplicado.titulo)}">Possível duplicado de “${esc(s.duplicado.titulo)}”</span>` : ''}
        ${multi ? `<span class="badge info">${s.segmentos.length} documentos separados</span>` : ''}</div>
      ${s.segmentos.map((g, j) => segHTML(g, i, j, multi)).join('')}
      ${multi ? `<label class="chk small" style="margin-top:8px"><input type="checkbox" class="org-rm" checked> Excluir o arquivo original depois de separar <span class="muted">(todas as páginas continuam nos novos documentos)</span></label>` : ''}</div>`;
  };

  modal({ titulo: `Sugestões da IA (${sugs.length})`, tamanho: 'lg',
    corpo: `<p class="note small" style="margin-top:0">Revise e ajuste o que quiser. Ao aplicar, o título, o tipo, o cliente e o caso são gravados e, quando o PDF reúne vários documentos, ele é separado em arquivos distintos. <b>A IA pode errar</b> — confira principalmente o cliente.</p>${sugs.map(cardHTML).join('')}`,
    aoAbrir: (ov) => {
      for (const el of $$('.org-seg', ov)) {
        const sel = $('[data-f=processo_id]', el), cli = $('[data-f=cliente_id]', el);
        const s = sugs[+el.closest('.org-card').dataset.i], g = s.segmentos[+el.dataset.j];
        const popular = async (cid, escolhido) => {
          const ps = await procsDe(cid);
          sel.innerHTML = '<option value="">— Nenhum —</option>' + ps.map((p) => `<option value="${p.id}" ${String(p.id) === String(escolhido || '') ? 'selected' : ''}>${esc(p.titulo)}</option>`).join('');
        };
        popular(cli.value, g.vinculo?.processo_id);
        cli.onchange = () => popular(cli.value, '');
      }
    },
    botoes: [
      { texto: 'Agora não (guardar sugestões)' },
      { texto: 'Ignorar sugestões marcadas', classe: 'danger', acao: async (ov) => {
        const marcados = $$('.org-card', ov).filter((c) => $('.org-on', c).checked);
        for (const c of marcados) await api(`/documentos/${sugs[+c.dataset.i].id}/organizar/descartar`, { method: 'POST' });
        toast('Sugestões ignoradas.'); depois?.();
      } },
      { texto: 'Aplicar marcados', classe: 'gold', acao: async (ov) => {
        const cards = $$('.org-card', ov).filter((c) => $('.org-on', c).checked && !c.classList.contains('org-ok'));
        if (!cards.length) throw new Error('Marque ao menos um documento para aplicar.');
        let ok = 0; const falhas = [];
        for (const c of cards) {
          const s = sugs[+c.dataset.i];
          const segmentos = $$('.org-seg', c).map((el) => {
            const g = s.segmentos[+el.dataset.j], val = (f) => $(`[data-f=${f}]`, el).value;
            return { pagina_inicial: g.pagina_inicial, pagina_final: g.pagina_final, titulo: val('titulo'), categoria: val('categoria'), cliente_id: val('cliente_id'), processo_id: val('processo_id'), resumo: val('resumo'), data_documento: val('data_documento'), tags: g.tags };
          });
          try {
            await api(`/documentos/${s.id}/organizar/aplicar`, { method: 'POST', body: { segmentos, remover_original: !!$('.org-rm', c)?.checked } });
            ok++; c.classList.add('org-ok'); $('.org-on', c).checked = false; $('.org-on', c).disabled = true; $$('input,select', c).forEach((x) => (x.disabled = true));
          } catch (e) { falhas.push(`${s.nome_original}: ${e.message}`); }
        }
        if (ok) toast(`${ok} documento(s) organizado(s).`);
        if (falhas.length) { mostrarErro(ov, falhas.join(' | ')); depois?.(); return false; }
        depois?.();
      } },
    ] });
}

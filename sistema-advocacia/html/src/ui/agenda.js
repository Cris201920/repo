/* Agenda de prazos e restauração da cópia de segurança */
'use strict';

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// ======================= AGENDA DE PRAZOS =======================
async function pageAgenda() {
  const d = await api('/agenda');
  const GRUPOS = [
    ['vencidos', 'Vencidos', (n) => n < 0, 'err'], ['hoje', 'Hoje', (n) => n === 0, 'warn'], ['semana', 'Próximos 7 dias', (n) => n > 0 && n <= 7, 'info'],
    ['mes', 'Até 30 dias', (n) => n > 7 && n <= 30, ''], ['depois', 'Mais adiante', (n) => n > 30, ''],
  ];
  const itens = d.itens.map((i) => ({ ...i, dias: diasAte(i.prazo) }));
  const conta = (k) => itens.filter((i) => GRUPOS.find((g) => g[0] === k)[2](i.dias)).length;
  view(`<div class="page-h"><div><h1>Agenda de prazos</h1><div class="sub">Providências de atendimentos e pendências em aberto, por data</div></div>
      <div class="actions"><button class="btn" id="agCsv">${ico('down')} Exportar planilha</button><button class="btn gold" id="agNovo">${ico('plus')} Nova pendência</button></div></div>
    <div class="grid g4" style="margin-bottom:18px">
      <div class="card stat"><div class="n" style="color:${conta('vencidos') ? 'var(--err)' : 'inherit'}">${conta('vencidos')}</div><div class="l">Vencidos</div></div>
      <div class="card stat"><div class="n">${conta('hoje')}</div><div class="l">Para hoje</div></div>
      <div class="card stat"><div class="n">${conta('semana')}</div><div class="l">Próximos 7 dias</div></div>
      <div class="card stat"><div class="n">${itens.length}</div><div class="l">Prazos em aberto</div></div>
    </div>
    <div class="filters"><input type="search" id="agQ" placeholder="Filtrar por cliente, caso ou assunto…">
      <select id="agTipo"><option value="">Tudo</option><option value="atendimento">Providências de atendimentos</option><option value="pendencia">Pendências</option></select></div>
    <div id="agLista"></div>
    ${d.semPrazo ? `<p class="small muted" style="margin-top:14px">Há ${d.semPrazo} pendência(s) em aberto sem data definida. <a href="#/pendencias">Ver pendências</a></p>` : ''}`);
  const linha = (i) => `<div class="list-item"><div class="d"><b>${i.prazo.slice(8, 10)}</b>${MESES_ABREV[+i.prazo.slice(5, 7) - 1]}${i.prazo.slice(0, 4) !== d.hoje.slice(0, 4) ? ' ' + i.prazo.slice(0, 4) : ''}</div>
      <div style="flex:1;min-width:0"><a href="${i.origem === 'atendimento' ? '#/atendimentos/' + i.id : '#/clientes/' + i.cliente_id}"><b>${esc(i.titulo)}</b></a>
        <div class="small muted">${esc(i.cliente)}${i.processo ? ' · ' + esc(i.processo) : ''} · ${i.origem === 'atendimento' ? 'providência de atendimento' : i.tipo === 'tarefa' ? 'tarefa' : 'documento pendente'}${i.responsavel ? ' · ' + esc(i.responsavel) : ''}</div>
        ${i.detalhe ? `<div class="small muted">${esc(i.detalhe.slice(0, 140))}${i.detalhe.length > 140 ? '…' : ''}</div>` : ''}</div>
      <div>${badgePrazo(i.prazo)}</div><button class="btn sm ghost" data-ok="${i.origem}:${i.id}" title="Marcar como resolvido">${ico('check')}</button></div>`;
  const desenhar = () => {
    const t = norm($('#agQ').value), tipo = $('#agTipo').value;
    const vis = itens.filter((i) => (!tipo || i.origem === tipo) && (!t || norm([i.titulo, i.cliente, i.processo, i.detalhe, i.responsavel].join(' ')).includes(t)));
    $('#agLista').innerHTML = vis.length ? GRUPOS.map(([, nome, cabe, cor]) => { const g = vis.filter((i) => cabe(i.dias)); return g.length ? `<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>${nome}</h3><span class="badge ${cor}">${g.length}</span></div>${g.map(linha).join('')}</div>` : ''; }).join('')
      : `<div class="card">${vazio(itens.length ? 'Nenhum prazo com este filtro.' : 'Nenhum prazo em aberto. Informe o prazo ao registrar um atendimento ou uma pendência para ele aparecer aqui.', 'clock')}</div>`;
    $$('[data-ok]', $('#agLista')).forEach((b) => (b.onclick = async () => {
      const [origem, id] = b.dataset.ok.split(':'); b.disabled = true;
      try {
        if (origem === 'atendimento') await api(`/atendimentos/${id}/concluir`, { method: 'POST', body: { concluido: true } });
        else await api(`/pendencias/${id}/status`, { method: 'POST', body: { status: 'ok' } });
        toast('Marcado como resolvido.'); pageAgenda();
      } catch (e) { b.disabled = false; falha(e); }
    }));
  };
  $('#agQ').oninput = debounce(desenhar, 150); $('#agTipo').onchange = desenhar;
  $('#agNovo').onclick = () => abrirPend({}, pageAgenda).catch(falha);
  $('#agCsv').onclick = () => baixarPlanilha('agenda-de-prazos', [[(i) => fData(i.prazo), 'Prazo'], [(i) => (i.dias < 0 ? 'Vencido' : i.dias === 0 ? 'Hoje' : `em ${i.dias} dia(s)`), 'Situação'], ['titulo', 'Assunto'], ['cliente', 'Cliente'], ['processo', 'Caso'],
    [(i) => (i.origem === 'atendimento' ? 'Providência de atendimento' : i.tipo === 'tarefa' ? 'Tarefa' : 'Documento pendente'), 'Tipo'], ['responsavel', 'Responsável'], ['detalhe', 'Detalhe']], itens);
  desenhar();
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ======================= RESTAURAR CÓPIA DE SEGURANÇA =======================
const NOMES_COL = { clientes: 'Clientes', processos: 'Casos', atendimentos: 'Atendimentos', documentos: 'Documentos', pastas: 'Pastas', notas: 'Observações', pendencias: 'Pendências' };
async function restaurarCopiaUI(arquivo, depois) {
  let zip, copia;
  try {
    if (arquivo.size > 600 * 1048576) throw new Error('A cópia tem mais de 600 MB e não pode ser aberta no navegador.');
    zip = fflate.unzipSync(new Uint8Array(await arquivo.arrayBuffer()));
    if (!zip['dados.json']) throw new Error('Este arquivo não é uma cópia de segurança deste sistema (falta o dados.json).');
    copia = LocalAPI.lerCopia(new TextDecoder().decode(zip['dados.json']));
  } catch (e) { return toast(/invalid zip|unexpected|Invalid/i.test(e.message || '') ? 'Não foi possível abrir o arquivo. Escolha o ZIP baixado em “Baixar cópia de segurança”.' : e.message, true); }
  const plano = LocalAPI.planoRestauracao(copia), novos = Object.values(plano).reduce((n, p) => n + p.novos, 0);
  const tabela = `<div class="tbl" style="margin:10px 0"><table><thead><tr><th>Item</th><th>Na cópia</th><th>Serão adicionados</th><th>Já existem</th></tr></thead><tbody>${Object.entries(plano).map(([c, p]) => `<tr><td>${NOMES_COL[c]}</td><td>${p.total}</td><td><b>${p.novos}</b></td><td>${p.existentes}</td></tr>`).join('')}</tbody></table></div>`;
  modal({ titulo: 'Restaurar cópia de segurança', tamanho: '',
    corpo: `<p style="margin-top:0">Cópia de <b>${esc(copia.escritorio || 'escritório não informado')}</b>${copia.exportado_em ? `, feita em ${esc(fData(copia.exportado_em.slice(0, 10)))}` : ''}.</p>${tabela}
      <p class="note small" style="margin-bottom:0">A restauração <b>só acrescenta o que ainda não existe</b>. Nada do que já está no sistema é alterado ou apagado. Os dados entram criptografados com a senha atual do escritório.</p>
      <div id="rsProg" hidden style="margin-top:12px"><div class="small muted" id="rsMsg">Restaurando…</div><div class="prog"><div id="rsBar" style="width:0"></div></div></div>`,
    botoes: [{ texto: 'Cancelar' }, ...(novos ? [{ texto: `Restaurar ${novos} registro(s)`, classe: 'gold', acao: async (ov) => {
      ov.dataset.travar = '1'; $('#rsProg', ov).hidden = false;
      const r = await LocalAPI.restaurar(copia, zip, { aoAvancar: (f, t) => { ultimaAtividade = Date.now(); $('#rsMsg', ov).textContent = `Restaurando ${f} de ${t}…`; $('#rsBar', ov).style.width = Math.round((f / t) * 100) + '%'; } });
      cache.clientes = null;
      toast(`Restauração concluída: ${r.adicionados} adicionado(s), ${r.existentes} já existiam${r.semArquivo ? `, ${r.semArquivo} documento(s) sem arquivo na cópia` : ''}${r.falhas ? `, ${r.falhas} com falha` : ''}.`, !!r.falhas);
      depois?.();
    } }] : [])] });
  if (!novos) toast('Tudo o que está nesta cópia já existe no sistema.');
}

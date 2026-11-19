/* Recursos de escritório: gerar minutas (procuração, contrato, declaração, recibo) e busca rápida (Ctrl+K) */
'use strict';

// ======================= MINUTAS =======================
const lerPref = (k, pad = {}) => { try { return { ...pad, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return pad; } };
const gravarPref = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

async function abrirMinuta(cliente, processos = [], inicial = {}) {
  const pref = lerPref('dadosAdvogado', { advogado: '', oab: '', endereco_escritorio: S.firma.enderecoCabecalho || '', cidade: '' });
  const procSel = inicial.processo_id || (processos.length === 1 ? processos[0].id : '');
  const opModelos = Object.entries(Minutas.MODELOS).map(([k, m]) => `<option value="${k}" ${k === (inicial.modelo || 'procuracao') ? 'selected' : ''}>${esc(m.nome)}</option>`).join('');
  const campo = (n, rot, v, ph = '', extra = '') => `<div class="c-half"><label for="mn_${n}">${esc(rot)}</label><input id="mn_${n}" name="${n}" type="text" value="${esc(v || '')}" placeholder="${esc(ph)}" ${extra}></div>`;
  const m = modal({ titulo: `Gerar documento — ${cliente.nome}`, tamanho: 'lg',
    corpo: `<form class="f" onsubmit="return false" id="mnForm">
      <div class="c-half"><label for="mn_modelo">Documento</label><select id="mn_modelo" name="modelo">${opModelos}</select></div>
      <div class="c-half"><label for="mn_processo_id">Caso (opcional)</label><select id="mn_processo_id" name="processo_id"><option value="">— Nenhum —</option>${processos.map((p) => `<option value="${p.id}" ${String(p.id) === String(procSel) ? 'selected' : ''}>${esc(p.titulo)}</option>`).join('')}</select></div>
      <div id="mnCampos" class="c6" style="display:contents"></div>
      ${campo('advogado', 'Advogado(a) responsável', pref.advogado, 'Nome completo')}${campo('oab', 'OAB', pref.oab, 'Ex.: RS 12345')}
      ${campo('endereco_escritorio', 'Endereço do escritório', pref.endereco_escritorio, 'Rua, nº, cidade/UF')}${campo('cidade', 'Cidade (local da assinatura)', pref.cidade, 'Ex.: Porto Alegre')}
    </form>
    <div id="mnAviso" class="note small" style="margin-top:12px" hidden></div>
    <p class="small muted" style="margin-bottom:0">O documento sai em Word, com os dados do cadastro do cliente. Revise o texto antes de usar: o que faltar fica destacado em amarelo como <b>[PREENCHER]</b>.</p>`,
    botoes: [{ texto: 'Cancelar' },
      { texto: 'Salvar nos documentos do cliente', acao: async (ov) => { const b = corpoMinuta(ov, cliente); salvarPref(b); const r = await api('/minutas/salvar', { method: 'POST', body: b }); toast(r.faltando.length ? 'Documento salvo, com campos a preencher.' : 'Documento salvo nos documentos do cliente.'); } },
      { texto: 'Baixar (Word)', classe: 'gold', acao: async (ov) => { const b = corpoMinuta(ov, cliente); salvarPref(b); const f = await LocalAPI.minutaBlob(b); if (await Docs.entregar(f.nome, f.blob)) toast('Documento salvo.'); return false; } }] });
  const ov = m.el;
  const salvarPref = (b) => gravarPref('dadosAdvogado', { advogado: b.advogado, oab: b.oab, endereco_escritorio: b.endereco_escritorio, cidade: b.cidade });
  const desenharCampos = () => {
    const mod = Minutas.MODELOS[$('#mn_modelo', ov).value];
    $('#mnCampos', ov).innerHTML = mod.campos.map((c) => campo('v_' + c.n, c.rot + (c.req ? ' *' : ''), (inicial.valores || {})[c.n] || '', c.ph)).join('');
    verFaltas();
  };
  let seq = 0;
  const verFaltas = debounce(async () => {
    const eu = ++seq, aviso = $('#mnAviso', ov); if (!aviso) return;
    try {
      const r = await api('/minutas/previa', { method: 'POST', body: corpoMinuta(ov, cliente, true) });
      if (eu !== seq || !$('#mnAviso', ov)) return;
      aviso.hidden = !r.faltando.length; aviso.innerHTML = r.faltando.length ? `<b>Faltam dados:</b> ${r.faltando.map(esc).join(', ')}. ${r.faltando.some((x) => ['CPF', 'CNPJ', 'RG', 'endereço', 'estado civil', 'profissão'].includes(x)) ? `<a href="#/clientes/${cliente.id}" id="mnEd">Completar o cadastro do cliente</a>` : ''}` : '';
    } catch (e) { if (eu === seq && $('#mnAviso', ov)) { aviso.hidden = false; aviso.textContent = e.message; } }
  }, 250);
  $('#mn_modelo', ov).onchange = desenharCampos; ov.addEventListener('input', verFaltas); ov.addEventListener('change', verFaltas);
  desenharCampos();
}
function corpoMinuta(ov, cliente, leve = false) {
  const b = lerForm(ov), valores = {};
  for (const k of Object.keys(b)) if (k.startsWith('v_')) { valores[k.slice(2)] = b[k]; delete b[k]; }
  if (leve) for (const c of Minutas.MODELOS[b.modelo].campos) if (c.req && !valores[c.n]) valores[c.n] = '0';   // na prévia, o valor em branco não deve esconder as outras faltas
  return { ...b, cliente_id: cliente.id, valores };
}

// ======================= BUSCA RÁPIDA (Ctrl+K) =======================
const ACOES_RAPIDAS = () => [
  ['Painel', () => (location.hash = '#/painel'), 'home', 'início'], ['Cadastro', () => (location.hash = '#/cadastro'), 'plus', 'novo cadastrar'], ['Agenda de prazos', () => (location.hash = '#/agenda'), 'clock', 'prazos'],
  ['Atendimentos', () => (location.hash = '#/atendimentos'), 'chat', ''], ['Clientes', () => (location.hash = '#/clientes'), 'users', ''], ['Casos e processos', () => (location.hash = '#/processos'), 'scale', 'processos'],
  ['Pendências', () => (location.hash = '#/pendencias'), 'check', 'o que falta'], ['Documentos', () => (location.hash = '#/documentos'), 'file', 'arquivos'], ['Acesso e segurança', () => (location.hash = '#/usuarios'), 'shield', 'cópia de segurança backup'],
  ['Novo atendimento', () => abrirAtendimento({}, () => rotear()).catch(falha), 'chat', 'registrar'], ['Novo cliente', () => abrirCliente({}, (r) => { location.hash = '#/clientes/' + r.id; }), 'users', 'cadastrar'],
  ['Novo caso', () => abrirProcesso({}, (r) => { location.hash = '#/processos/' + r.id; }).catch(falha), 'scale', 'processo'], ['Enviar documentos', () => abrirUpload({}, () => rotear()).catch(falha), 'upload', 'escanear'],
  ['Nova pendência', () => abrirPend({}, () => rotear()).catch(falha), 'check', ''], ['Bloquear o sistema', () => bloquear(), 'shield', 'sair trancar'],
];
function abrirPaleta() {
  if (!S.usuario || $('.paleta')) return;
  const ov = document.createElement('div'); ov.className = 'overlay paleta'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Busca rápida');
  ov.innerHTML = `<div class="paleta-box"><div class="paleta-in">${ico('search')}<input id="pq" type="text" autocomplete="off" spellcheck="false" placeholder="Ir para… ou buscar clientes, casos, documentos" aria-label="Busca rápida"><kbd>Esc</kbd></div><div class="paleta-res" id="pr" role="listbox"></div><div class="paleta-rod"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span></div></div>`;
  document.body.append(ov);
  const entrada = $('#pq', ov), lista = $('#pr', ov); let itens = [], sel = 0, seq = 0;
  const fechar = () => { document.removeEventListener('keydown', tecla, true); ov.classList.add('saindo'); setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, SEM_MOVIMENTO() ? 0 : 150); };
  const abrir = (i) => { const it = itens[i]; if (!it) return; fechar(); setTimeout(() => it.acao(), 30); };
  const desenhar = () => {
    lista.innerHTML = itens.length ? itens.map((it, i) => `<div class="paleta-it${i === sel ? ' on' : ''}" role="option" data-i="${i}">${ico(it.icone)}<div style="flex:1;min-width:0"><b>${esc(it.titulo)}</b>${it.sub ? `<div class="small muted">${esc(it.sub)}</div>` : ''}</div><span class="badge">${esc(it.tipo)}</span></div>`).join('') : '<div class="empty small">Nada encontrado.</div>';
    $$('.paleta-it', lista).forEach((el) => { el.onmouseenter = () => { sel = +el.dataset.i; $$('.paleta-it', lista).forEach((x, k) => x.classList.toggle('on', k === sel)); }; el.onclick = () => abrir(+el.dataset.i); });
    const on = $('.paleta-it.on', lista); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  const montar = async () => {
    const q = entrada.value.trim(), t = norm(q), eu = ++seq;
    const acoes = ACOES_RAPIDAS().filter(([n, , , kw]) => !t || norm(n + ' ' + kw).includes(t)).slice(0, t ? 6 : 15).map(([n, f, i]) => ({ titulo: n, tipo: /^Novo|^Nova|^Enviar|^Bloquear/.test(n) ? 'Ação' : 'Ir para', icone: i, acao: f }));
    itens = acoes; sel = 0; desenhar();
    if (q.length < 2) return;
    try {
      const r = await api('/busca' + qs({ q }));
      if (eu !== seq) return;
      const achados = [
        ...r.clientes.map((x) => ({ titulo: x.nome, sub: x.documento || '', tipo: 'Cliente', icone: 'users', acao: () => (location.hash = '#/clientes/' + x.id) })),
        ...r.processos.map((x) => ({ titulo: x.titulo, sub: [x.cliente, x.numero].filter(Boolean).join(' · '), tipo: 'Caso', icone: 'scale', acao: () => (location.hash = '#/processos/' + x.id) })),
        ...r.atendimentos.map((x) => ({ titulo: x.assunto, sub: `${x.cliente || ''} · ${fData(x.data_hora)}`, tipo: 'Atendimento', icone: 'chat', acao: () => (location.hash = '#/atendimentos/' + x.id) })),
        ...r.documentos.map((x) => ({ titulo: x.titulo, sub: x.nome_original, tipo: 'Documento', icone: 'file', acao: () => (location.hash = '#/documentos?q=' + encodeURIComponent(q)) })),
      ];
      itens = [...achados, ...acoes]; sel = 0; desenhar();
    } catch { /* mantém as ações */ }
  };
  const tecla = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(itens.length - 1, sel + 1); desenhar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); desenhar(); }
    else if (e.key === 'Enter') { e.preventDefault(); abrir(sel); }
  };
  document.addEventListener('keydown', tecla, true);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) fechar(); });
  entrada.addEventListener('input', debounce(montar, 120)); montar(); entrada.focus();
}
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirPaleta(); }
});

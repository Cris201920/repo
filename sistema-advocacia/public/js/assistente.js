/* Assistente Jurídico (IA) */
'use strict';
const MODELOS = [
  ['Resumir documento', 'Resuma o(s) documento(s) selecionado(s): partes, objeto, datas e prazos, valores, obrigações e riscos. Comece pela conclusão em poucas linhas.'],
  ['Ata do atendimento', 'Com base no histórico de atendimentos do cliente, elabore a ata formal do último atendimento, com resumo executivo, orientações prestadas, providências, responsáveis e prazos.'],
  ['Petição inicial', 'Elabore uma minuta de petição inicial completa com base nos fatos e documentos do caso. Aponte o que falta como [PREENCHER] e liste os pontos a conferir.'],
  ['Contestação', 'Elabore uma minuta de contestação com base nos documentos anexados, enfrentando preliminares, mérito e pedidos. Marque como [CONFERIR] qualquer citação de lei ou precedente que dependa de verificação.'],
  ['Notificação extrajudicial', 'Redija uma notificação extrajudicial formal com base nos fatos do caso, com prazo para cumprimento e advertência das medidas cabíveis.'],
  ['Contrato', 'Redija uma minuta de contrato adequada ao caso, com cláusulas essenciais, foro, penalidades e anexos. Liste as premissas adotadas e os campos a preencher.'],
  ['Procuração e declaração', 'Redija procuração ad judicia et extra (com poderes especiais, se necessário) e declaração de hipossuficiência, com a qualificação do cliente cadastrado.'],
  ['Análise de riscos', 'Faça uma análise de riscos e estratégia do caso: pontos fortes e fracos, provas existentes e faltantes, prazos (prescrição/decadência/recursais), cenários e estimativa qualitativa de resultado.'],
  ['Linha do tempo', 'Monte uma linha do tempo cronológica dos fatos relevantes, citando de qual documento ou atendimento cada informação vem. Destaque contradições.'],
  ['Checklist de documentos', 'Liste os documentos e informações que ainda devem ser solicitados ao cliente para este tipo de caso, por ordem de prioridade.'],
  ['Mensagem ao cliente', 'Redija uma mensagem curta e cordial para o cliente (WhatsApp/e-mail), em linguagem simples, explicando o andamento e os próximos passos.'],
  ['Revisar texto', 'Revise o texto abaixo quanto a gramática, clareza, coesão, tom formal e técnica jurídica. Devolva a versão revisada e liste as principais alterações:\n\n'],
];
const IA = { conv: null, ctx: { cliente_id: '', processo_id: '', documentos_ids: [] }, convs: [], status: null, busy: false, ctrl: null, docs: [] };

function abrirAssistenteCom(pre) {
  try { sessionStorage.setItem('assistentePre', JSON.stringify(pre)); } catch {}
  $$('.overlay').forEach((o) => o.remove());
  if (location.hash.startsWith('#/assistente')) pageAssistente(); else location.hash = '#/assistente';
}

async function pageAssistente() {
  IA.status = await api('/ia/status');
  IA.convs = await api('/ia/conversas');
  const cl = await listaClientes();
  let pre = null; try { pre = JSON.parse(sessionStorage.getItem('assistentePre') || 'null'); sessionStorage.removeItem('assistentePre'); } catch {}
  IA.conv = null; IA.ctx = { cliente_id: '', processo_id: '', documentos_ids: [] };
  if (pre) IA.ctx = { cliente_id: pre.cliente_id || '', processo_id: pre.processo_id || '', documentos_ids: pre.documentos_ids || [] };

  view(`<div class="page-h"><div><h1>Assistente Jurídico</h1><div class="sub">IA do escritório — analisa documentos, resume atendimentos e redige minutas. Sempre revise antes de usar.</div></div>
    <div class="actions"><span class="badge ${IA.status.configurado ? 'ok' : 'err'}">${IA.status.configurado ? 'IA ativa' : 'IA não configurada'}</span></div></div>
    ${IA.status.configurado ? '' : '<div class="err-msg">A chave da IA ainda não foi configurada no servidor (<code>ANTHROPIC_API_KEY</code>). Você pode navegar, mas não enviar mensagens.</div>'}
    <div class="ia-wrap">
      <div class="card ia-col convs-col"><div class="card-h"><h3>Conversas</h3><button class="btn sm gold" id="nova">${ico('plus')} Nova</button></div><div class="convs" id="convs"></div></div>
      <div class="card ia-col"><div class="chat"><div class="msgs" id="msgs"></div>
        <div class="composer"><div class="chips" id="chips">${MODELOS.map(([r], i) => `<button class="chip" data-m="${i}">${esc(r)}</button>`).join('')}</div>
          <textarea id="txt" placeholder="Pergunte ou peça uma minuta… (Ctrl+Enter para enviar)" ${IA.status.configurado ? '' : 'disabled'}></textarea>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center"><span class="small muted">Dados do cliente e documentos selecionados à direita são enviados ao provedor de IA.</span><span class="right"></span><button class="btn" id="parar" hidden>Parar</button><button class="btn gold" id="enviar" ${IA.status.configurado ? '' : 'disabled'}>${ico('spark')} Enviar</button></div></div>
        <div class="disclaimer">A IA pode errar. Confira leis, prazos e jurisprudência. O texto final é de responsabilidade do advogado.</div></div></div>
      <div class="card ia-col ctx-col"><div class="card-h"><h3>Contexto</h3></div><div class="card-b ctx" style="overflow:auto">
        <label for="c_cli" style="margin-top:0">Cliente</label><select id="c_cli">${opClientes(cl, '— Nenhum —').map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
        <label for="c_pro">Processo / caso</label><select id="c_pro"><option value="">— Nenhum —</option></select>
        <label>Documentos para a IA ler</label><div class="docs" id="c_docs"></div><div class="small muted" style="margin-top:6px" id="c_info"></div></div></div></div>`);

  $('#c_cli').value = IA.ctx.cliente_id || '';
  await atualizarProcessos(); $('#c_pro').value = IA.ctx.processo_id || '';
  await atualizarDocs();
  renderConvs(); renderMsgs();
  if (pre?.prompt) $('#txt').value = pre.prompt;

  $('#nova').onclick = () => { IA.conv = null; IA.ctx = { cliente_id: '', processo_id: '', documentos_ids: [] }; $('#c_cli').value = ''; atualizarProcessos().then(atualizarDocs); renderConvs(); renderMsgs(); $('#txt').value = ''; };
  $('#c_cli').onchange = async () => { IA.ctx.cliente_id = $('#c_cli').value; IA.ctx.processo_id = ''; await atualizarProcessos(); await atualizarDocs(); salvarCtx(); };
  $('#c_pro').onchange = async () => { IA.ctx.processo_id = $('#c_pro').value; await atualizarDocs(); salvarCtx(); };
  $$('#chips .chip').forEach((b) => (b.onclick = () => { const t = $('#txt'); t.value = MODELOS[b.dataset.m][1]; t.focus(); t.setSelectionRange(t.value.length, t.value.length); }));
  $('#enviar').onclick = enviarMensagem; $('#parar').onclick = () => IA.ctrl?.abort();
  $('#txt').onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviarMensagem(); } };
}

async function atualizarProcessos() {
  const sel = $('#c_pro'); const ps = IA.ctx.cliente_id ? await api('/processos' + qs({ cliente_id: IA.ctx.cliente_id })) : [];
  sel.innerHTML = `<option value="">— Nenhum —</option>` + ps.map((p) => `<option value="${p.id}">${esc(p.titulo)}</option>`).join('');
  sel.value = IA.ctx.processo_id || '';
}
async function atualizarDocs() {
  const lista = await api('/documentos' + qs({ cliente_id: IA.ctx.cliente_id, processo_id: IA.ctx.processo_id }));
  const sel = new Set(IA.ctx.documentos_ids.map(Number));
  // mantém visíveis documentos já selecionados que não estão no filtro atual
  if (sel.size) { const todos = await api('/documentos'); for (const d of todos) if (sel.has(d.id) && !lista.some((x) => x.id === d.id)) lista.unshift(d); }
  IA.docs = lista.slice(0, 80);
  $('#c_docs').innerHTML = IA.docs.length ? IA.docs.map((d) => `<label><input type="checkbox" value="${d.id}" ${sel.has(d.id) ? 'checked' : ''}><span>${esc(d.titulo)}<br><span class="small muted">${L.categoria[d.categoria] || ''}${d.tem_texto || /pdf|image/.test(d.mime || '') ? '' : ' · sem leitura'}</span></span></label>`).join('') : '<div class="empty small">Nenhum documento neste filtro.</div>';
  $$('#c_docs input').forEach((c) => (c.onchange = () => { IA.ctx.documentos_ids = $$('#c_docs input:checked').map((x) => +x.value); info(); salvarCtx(); }));
  info();
}
function info() { const n = IA.ctx.documentos_ids.length; $('#c_info').textContent = n ? `${n} documento(s) selecionado(s). Quanto menos, mais rápida e precisa a resposta.` : 'Selecione os documentos que a IA deve ler.'; }
let _t; function salvarCtx() { if (!IA.conv) return; clearTimeout(_t); _t = setTimeout(() => api('/ia/conversas/' + IA.conv.id, { method: 'PUT', body: IA.ctx }).catch(falha), 250); }

function renderConvs() {
  $('#convs').innerHTML = IA.convs.length ? IA.convs.map((c) => `<button class="conv ${IA.conv?.id === c.id ? 'on' : ''}" data-id="${c.id}"><span class="t">${esc(c.titulo)}</span><span class="s">${esc(c.cliente || 'Sem cliente')} · ${fUTC(c.atualizado_em).slice(0, 10)}</span></button>`).join('') : '<div class="empty small">Nenhuma conversa ainda.</div>';
  $$('.conv').forEach((b) => (b.onclick = () => abrirConversa(+b.dataset.id)));
}
async function abrirConversa(id) {
  const c = await api('/ia/conversas/' + id);
  IA.conv = c; IA.ctx = { cliente_id: c.cliente_id || '', processo_id: c.processo_id || '', documentos_ids: c.documentos_ids };
  $('#c_cli').value = IA.ctx.cliente_id; await atualizarProcessos(); $('#c_pro').value = IA.ctx.processo_id; await atualizarDocs();
  renderConvs(); renderMsgs();
}

function bolha(m, i) {
  if (m.papel === 'user') return `<div class="msg user"><div class="md">${md(m.conteudo)}</div></div>`;
  return `<div class="msg assistant" data-i="${i}"><div class="md ${m.stream ? 'typing' : ''}">${m.conteudo ? md(m.conteudo) : '<span class="muted">Pensando…</span>'}</div>
    ${m.stream ? '' : `<div class="acts"><button class="btn sm" data-a="copiar">${ico('copy')} Copiar</button><button class="btn sm" data-a="docx">${ico('down')} Word (.docx)</button><button class="btn sm" data-a="salvar">${ico('file')} Salvar no caso</button></div>`}</div>`;
}
function renderMsgs() {
  const el = $('#msgs'); const ms = IA.conv?.mensagens || [];
  el.innerHTML = ms.length ? ms.map(bolha).join('') : `<div class="ia-hero"><img class="hero-escura" src="/assets/emblema-escuro.png" alt=""><img class="hero-clara" src="/assets/emblema.png" alt=""><h2>Como posso ajudar?</h2><p>Escolha um cliente, um caso e os documentos à direita, depois use um dos modelos abaixo ou escreva sua solicitação. Ex.: “resuma a sentença anexada e indique o prazo recursal”.</p></div>`;
  el.scrollTop = el.scrollHeight;
  $$('.msg.assistant [data-a]', el).forEach((b) => (b.onclick = () => acaoMsg(b.dataset.a, ms[+b.closest('.msg').dataset.i])));
}
async function acaoMsg(a, m) {
  try {
    if (a === 'copiar') { await navigator.clipboard.writeText(m.conteudo); toast('Texto copiado.'); }
    if (a === 'docx') { const t = tituloDe(m.conteudo); await baixarBlob('/ia/exportar-docx', { texto: m.conteudo, titulo: t }, t.replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, '_') + '.docx'); }
    if (a === 'salvar') {
      const t = tituloDe(m.conteudo);
      await api('/ia/exportar-docx', { method: 'POST', body: { texto: m.conteudo, titulo: t, salvar: true, cliente_id: IA.ctx.cliente_id, processo_id: IA.ctx.processo_id } });
      toast(IA.ctx.cliente_id ? 'Salvo nos documentos do cliente.' : 'Salvo nos documentos (sem cliente vinculado).');
    }
  } catch (e) { falha(e); }
}
const tituloDe = (t) => (t.match(/^#{1,3}\s+(.+)$/m)?.[1] || t.split('\n').find((l) => l.trim()) || 'Minuta').replace(/[*#_`]/g, '').trim().slice(0, 90);

async function enviarMensagem() {
  const ta = $('#txt'); const texto = ta.value.trim();
  if (!texto || IA.busy) return;
  IA.busy = true; $('#enviar').disabled = true; $('#parar').hidden = false;
  try {
    if (!IA.conv) {
      const { id } = await api('/ia/conversas', { method: 'POST', body: IA.ctx });
      IA.conv = { id, mensagens: [], titulo: 'Nova conversa', ...IA.ctx };
    }
    ta.value = '';
    const ms = IA.conv.mensagens; ms.push({ papel: 'user', conteudo: texto }); const resp = { papel: 'assistant', conteudo: '', stream: true }; ms.push(resp); renderMsgs();
    IA.ctrl = new AbortController();
    const r = await fetch(`/api/ia/conversas/${IA.conv.id}/mensagens`, { method: 'POST', credentials: 'same-origin', signal: IA.ctrl.signal, headers: { 'X-Requested-With': 'adv', 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); ms.splice(-2, 2); ta.value = texto; renderMsgs(); throw new Error(e.erro || 'Falha ao enviar.'); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', pend = false;
    const atualizar = () => { pend = false; const el = $(`.msg.assistant[data-i="${ms.length - 1}"] .md`); const box = $('#msgs'); const perto = box.scrollHeight - box.scrollTop - box.clientHeight < 120; if (el) el.innerHTML = md(resp.conteudo); if (perto) box.scrollTop = box.scrollHeight; };
    try {
      for (;;) {
        const { done, value } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let k;
        while ((k = buf.indexOf('\n\n')) >= 0) {
          const ev = buf.slice(0, k); buf = buf.slice(k + 2);
          if (!ev.startsWith('data: ')) continue;
          const d = JSON.parse(ev.slice(6));
          if (d.t === 'delta') { resp.conteudo += d.v; if (!pend) { pend = true; requestAnimationFrame(atualizar); } }
          else if (d.t === 'aviso') toast(d.v, true);
          else if (d.t === 'erro') { if (!resp.conteudo) { ms.splice(-2, 2); ta.value = texto; } throw new Error(d.v); }
        }
      }
    } catch (e) { if (e.name !== 'AbortError') throw e; resp.conteudo += resp.conteudo ? '\n\n_(interrompido)_' : ''; }
    resp.stream = false; if (!resp.conteudo) ms.pop(); renderMsgs();
    IA.convs = await api('/ia/conversas'); renderConvs();
  } catch (e) { renderMsgs(); falha(e); }
  finally { IA.busy = false; IA.ctrl = null; const b = $('#enviar'); if (b) b.disabled = !IA.status.configurado; const p = $('#parar'); if (p) p.hidden = true; }
}

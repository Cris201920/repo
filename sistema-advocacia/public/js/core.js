/* Utilitários, API, componentes de interface */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { firma: {}, logo: '/assets/logo.png', usuario: null, opcoes: null };

// ---------- Rótulos ----------
const L = {
  status: { consultivo: 'Consultivo', em_andamento: 'Em andamento', suspenso: 'Suspenso', encerrado: 'Encerrado' },
  statusCor: { consultivo: 'info', em_andamento: 'ok', suspenso: 'warn', encerrado: '' },
  canal: { presencial: 'Presencial', telefone: 'Telefone', whatsapp: 'WhatsApp', videochamada: 'Videochamada', 'e-mail': 'E-mail', outro: 'Outro' },
  categoria: { procuracao: 'Procuração', contrato: 'Contrato', peticao: 'Petição / Peça', decisao: 'Decisão / Sentença', identificacao: 'Documento pessoal', comprovante: 'Comprovante', prova: 'Prova', parecer: 'Parecer', correspondencia: 'Correspondência', outros: 'Outros' },
  papel: { admin: 'Administrador', advogado: 'Advogado(a)', estagiario: 'Estagiário(a)' },
};
const opts = (obj) => Object.entries(obj);

// ---------- Formatação ----------
const pad = (n) => String(n).padStart(2, '0');
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const agoraLocal = () => { const d = new Date(); return `${hojeISO()}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function fData(s) { if (!s) return '—'; const [a, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${a}`; }
function fHora(s) { return s && String(s).length >= 16 ? String(s).slice(11, 16) : ''; }
function fDataHora(s) { if (!s) return '—'; return fData(s) + (fHora(s) ? ' ' + fHora(s) : ''); }
// datas "datetime('now')" do SQLite estão em UTC
function fUTC(s) { if (!s) return '—'; const d = new Date(String(s).replace(' ', 'T') + 'Z'); return isNaN(d) ? s : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
const fBytes = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
const fMoeda = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
function diasAte(iso) { if (!iso) return null; const a = new Date(hojeISO() + 'T00:00'), b = new Date(iso.slice(0, 10) + 'T00:00'); return Math.round((b - a) / 864e5); }
function badgePrazo(iso, concluido) {
  if (!iso) return '';
  if (concluido) return `<span class="badge ok">Concluído</span>`;
  const d = diasAte(iso);
  const t = d < 0 ? `Vencido há ${-d} d` : d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : `em ${d} dias`;
  return `<span class="badge ${d < 0 ? 'err' : d <= 3 ? 'warn' : 'info'}">${fData(iso)} · ${t}</span>`;
}

// ---------- Ícones (traço simples) ----------
const ICON = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10', users: 'M16 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 016-6h4a6 6 0 016 6v1', chat: 'M21 12a8 8 0 01-11.5 7.2L3 21l1.8-5.5A8 8 0 1121 12z',
  scale: 'M12 3v18M5 21h14M5 7h14M5 7l-3 7a3 3 0 006 0L5 7zm14 0l-3 7a3 3 0 006 0l-3-7z', file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5', search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17z',
  plus: 'M12 5v14M5 12h14', shield: 'M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z', menu: 'M4 6h16M4 12h16M4 18h16', upload: 'M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3',
  down: 'M12 4v12m0 0l-4-4m4 4l4-4M4 20h16', edit: 'M4 20h4L19 9l-4-4L4 16v4z', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', check: 'M5 12l5 5 9-10', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z', copy: 'M9 9h10v11H9zM5 15V4h10', sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4', moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z', monitor: 'M3 5h18v12H3zM8 21h8M12 17v4', clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2', log: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5',
};
const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[n]}"/></svg>`;

// ---------- API ----------
async function api(url, { method = 'GET', body, form } = {}) {
  const init = { method, headers: { 'X-Requested-With': 'adv' }, credentials: 'same-origin' };
  if (form) init.body = form;
  else if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  let r;
  try { r = await fetch('/api' + url, init); } catch { throw new Error('Sem conexão com o servidor.'); }
  if (r.status === 401 && !url.startsWith('/auth/')) { S.usuario = null; location.hash = ''; mostrarLogin(); throw new Error('Sessão expirada. Entre novamente.'); }
  const ct = r.headers.get('content-type') || '';
  const data = ct.includes('json') ? await r.json() : null;
  if (!r.ok) throw new Error(data?.erro || `Erro ${r.status}`);
  return data;
}
const qs = (o) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== '' && v != null && v !== false) p.set(k, v === true ? '1' : v); const s = p.toString(); return s ? '?' + s : ''; };
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- Toast ----------
function toast(msg, erro = false) {
  const el = document.createElement('div'); el.className = 'toast' + (erro ? ' err' : ''); el.textContent = msg;
  $('#toasts').append(el); setTimeout(() => el.remove(), erro ? 6000 : 3500);
}
const falha = (e) => toast(e.message || String(e), true);

// ---------- Modal ----------
function modal({ titulo, corpo, botoes = [], tamanho = '', aoAbrir, aoFechar }) {
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = `<div class="modal ${tamanho}"><div class="modal-h"><h2>${esc(titulo)}</h2><button class="x" aria-label="Fechar">×</button></div>
    <div class="modal-b">${corpo}</div>${botoes.length ? '<div class="modal-f"></div>' : ''}</div>`;
  document.body.append(ov);
  const fechar = () => { ov.remove(); document.removeEventListener('keydown', esc_); aoFechar?.(); };
  const esc_ = (e) => { if (e.key === 'Escape' && ov === [...document.querySelectorAll('.overlay')].pop()) fechar(); };
  document.addEventListener('keydown', esc_);
  $('.x', ov).onclick = fechar;
  ov.addEventListener('mousedown', (e) => { if (e.target === ov && !ov.dataset.travar) fechar(); });
  const rod = $('.modal-f', ov);
  for (const b of botoes) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'btn ' + (b.classe || ''); el.textContent = b.texto;
    el.onclick = async () => {
      if (!b.acao) return fechar();
      el.disabled = true;
      try { const r = await b.acao(ov); if (r !== false) fechar(); } catch (e) { mostrarErro(ov, e.message); } finally { el.disabled = false; }
    };
    rod.append(el);
  }
  aoAbrir?.(ov);
  setTimeout(() => $('input:not([type=hidden]),select,textarea', ov)?.focus(), 30);
  return { fechar, el: ov };
}
function mostrarErro(ov, msg) {
  let e = $('.err-msg', ov);
  if (!e) { e = document.createElement('div'); e.className = 'err-msg'; $('.modal-b', ov).prepend(e); }
  e.textContent = msg; e.scrollIntoView({ block: 'nearest' });
}
function confirmar(msg, { texto = 'Confirmar', perigo = false, titulo = 'Confirmação' } = {}) {
  return new Promise((ok) => {
    let feito = false;
    modal({ titulo, tamanho: 'sm', corpo: `<p>${esc(msg)}</p>`, aoFechar: () => { if (!feito) ok(false); },
      botoes: [{ texto: 'Cancelar' }, { texto, classe: perigo ? 'danger' : 'primary', acao: () => { feito = true; ok(true); } }] });
  });
}

// ---------- Formulário genérico ----------
// campo: {n, label, tipo:'text|textarea|select|date|datetime-local|number|email|password|checkbox', op:[[v,l]], req, col:'c1|c2|c3|c6', ph, rows}
function campoHTML(c, v) {
  const id = 'f_' + c.n, val = v ?? '';
  if (c.tipo === 'hidden') return `<input type="hidden" id="${id}" name="${c.n}" value="${esc(val)}">`;
  let inp;
  if (c.tipo === 'textarea') inp = `<textarea id="${id}" name="${c.n}" rows="${c.rows || 4}" placeholder="${esc(c.ph || '')}">${esc(val)}</textarea>`;
  else if (c.tipo === 'select') inp = `<select id="${id}" name="${c.n}">${(c.op || []).map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  else if (c.tipo === 'checkbox') return `<div class="${c.col || 'c6'}"><label class="chk"><input type="checkbox" id="${id}" name="${c.n}" ${val ? 'checked' : ''}> ${esc(c.label)}</label></div>`;
  else inp = `<input type="${c.tipo || 'text'}" id="${id}" name="${c.n}" value="${esc(val)}" placeholder="${esc(c.ph || '')}" ${c.tipo === 'number' ? 'step="0.01" min="0"' : ''} ${c.tipo === 'password' ? 'autocomplete="new-password"' : ''}>`;
  return `<div class="${c.col || 'c-half'}"><label for="${id}">${esc(c.label)}${c.req ? ' <span class="rq">*</span>' : ''}</label>${inp}${c.dica ? `<div class="small muted">${esc(c.dica)}</div>` : ''}</div>`;
}
const formHTML = (campos, v = {}) => `<form class="f" onsubmit="return false">${campos.map((c) => campoHTML(c, v[c.n])).join('')}</form>`;
function lerForm(ov) {
  const o = {};
  for (const el of $$('[name]', ov)) o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  return o;
}

// ---------- Markdown (seguro: escapa HTML antes de formatar) ----------
function inlineMd(t) {
  return t.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[(PREENCHER[^\]]*|CONFERIR[^\]]*)\]/g, '<mark class="ph">[$1]</mark>');
}
function md(src) {
  const linhas = esc(src).replace(/\r/g, '').split('\n'); const out = []; let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (/^```/.test(l)) { const b = []; i++; while (i < linhas.length && !/^```/.test(linhas[i])) b.push(linhas[i++]); i++; out.push(`<pre><code>${b.join('\n')}</code></pre>`); continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { out.push(`<h${m[1].length}>${inlineMd(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(linhas[i + 1] || '')) {
      const cel = (x) => x.trim().replace(/^\||\|$/g, '').split('|').map((c) => inlineMd(c.trim()));
      const cab = cel(l); i += 2; const rows = [];
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) rows.push(cel(linhas[i++]));
      out.push(`<div class="tbl"><table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if (/^\s*[-*•]\s+/.test(l)) { const it = []; while (i < linhas.length && /^\s*[-*•]\s+/.test(linhas[i])) it.push(`<li>${inlineMd(linhas[i++].replace(/^\s*[-*•]\s+/, ''))}</li>`); out.push(`<ul>${it.join('')}</ul>`); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { const it = []; while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) it.push(`<li>${inlineMd(linhas[i++].replace(/^\s*\d+[.)]\s+/, ''))}</li>`); out.push(`<ol>${it.join('')}</ol>`); continue; }
    if (/^&gt;\s?/.test(l)) { const b = []; while (i < linhas.length && /^&gt;\s?/.test(linhas[i])) b.push(linhas[i++].replace(/^&gt;\s?/, '')); out.push(`<blockquote>${inlineMd(b.join('<br>'))}</blockquote>`); continue; }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < linhas.length && linhas[i].trim() && !/^(#{1,4}\s|```|\s*[-*•]\s|\s*\d+[.)]\s|&gt;|\s*\|)/.test(linhas[i])) p.push(linhas[i++]);
    out.push(`<p>${inlineMd(p.join('<br>'))}</p>`);
  }
  return out.join('');
}

// ---------- Download de arquivo gerado ----------
async function baixarBlob(url, body, nome) {
  const r = await fetch('/api' + url, { method: 'POST', headers: { 'X-Requested-With': 'adv', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Falha no download.');
  const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- Seletor de tema ----------
const TEMAS = [['claro', 'Claro', 'sun'], ['escuro', 'Escuro', 'moon'], ['auto', 'Automático (do aparelho)', 'monitor']];
const iconeTema = () => (TEMAS.find((t) => t[0] === Tema.pref()) || TEMAS[2])[2];
const botaoTema = () => `<button type="button" class="tema-btn" aria-label="Escolher tema" aria-haspopup="menu" title="Tema">${ico(iconeTema())}</button>`;
function ligarTema() { $$('.tema-btn').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); abrirTema(b); })); }
function fecharTema() { document.querySelectorAll('.tema-pop').forEach((p) => p.parentNode.removeChild(p)); }
function abrirTema(ancora) {
  if ($('.tema-pop')) { fecharTema(); return; }
  const pop = document.createElement('div'); pop.className = 'tema-pop'; pop.setAttribute('role', 'menu');
  const atual = Tema.pref();
  pop.innerHTML = '<h4>Tema</h4>' + TEMAS.map(([v, l, i]) => `<button type="button" role="menuitemradio" aria-checked="${v === atual}" data-v="${v}">${ico(i)} ${l}<span class="ck">${ico('check')}</span></button>`).join('');
  document.body.append(pop);
  const r = ancora.getBoundingClientRect();
  pop.style.top = r.bottom + 8 + 'px';
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + 'px';
  const fechar = () => { fecharTema(); document.removeEventListener('mousedown', fora, true); document.removeEventListener('keydown', tecla, true); };
  const fora = (e) => { if (!pop.contains(e.target) && !ancora.contains(e.target)) fechar(); };
  const tecla = (e) => { if (e.key === 'Escape') { fechar(); ancora.focus(); } };
  document.addEventListener('mousedown', fora, true); document.addEventListener('keydown', tecla, true);
  $$('button', pop).forEach((b) => (b.onclick = () => {
    Tema.set(b.dataset.v);
    $$('.tema-btn').forEach((x) => (x.innerHTML = ico(iconeTema())));
    fechar(); toast('Tema: ' + TEMAS.find((t) => t[0] === b.dataset.v)[1].replace(' (do aparelho)', '') + '.');
  }));
  $('button', pop).focus();
}
// duas versões da logo: nome escuro (tema claro) e nome claro (tema escuro)
const logoImg = (cls = '', alt = '') => `<img class="${cls} logo-escura" src="${esc(S.logo)}" alt="${esc(alt)}"><img class="${cls} logo-clara" src="${esc(S.logoClaro || S.logo)}" alt="${esc(alt)}">`;

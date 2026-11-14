/* Utilitários de cadastro: CPF/CNPJ, telefone e planilhas */
'use strict';

// ---------- CPF / CNPJ / telefone ----------
const soDig = (v) => String(v || '').replace(/\D/g, '');
function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
function cnpjValido(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (n) => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * p[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}
// Devolve { texto, aviso }: formata quando reconhece. CNPJ com letras (formato novo) e documentos estrangeiros ficam como foram digitados.
function conferirDocumento(v) {
  const t = String(v || '').trim(); if (!t || /[a-z]/i.test(t)) return { texto: t, aviso: '' };
  const d = soDig(t);
  if (d.length === 11) return { texto: d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'), aviso: cpfValido(d) ? '' : 'Este CPF não confere (dígito verificador). Confira antes de salvar.' };
  if (d.length === 14) return { texto: d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'), aviso: cnpjValido(d) ? '' : 'Este CNPJ não confere (dígito verificador). Confira antes de salvar.' };
  return { texto: t, aviso: d.length ? 'CPF tem 11 dígitos e CNPJ tem 14. Confira o número.' : '' };
}
function fmtTelefone(v) {
  const t = String(v || '').trim(), d = soDig(t);
  if (/[a-z+]/i.test(t)) return t;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

// ---------- planilha (CSV que o Excel abre direto) ----------
function csvDe(colunas, linhas) {
  const cel = (v) => { let t = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  return '﻿' + [colunas.map(([, r]) => cel(r)).join(';'), ...linhas.map((l) => colunas.map(([k]) => cel(typeof k === 'function' ? k(l) : l[k])).join(';'))].join('\r\n') + '\r\n';
}
async function baixarPlanilha(nome, colunas, linhas) {
  if (!linhas.length) return toast('Não há nada para exportar com este filtro.', true);
  try { await Docs.entregar(`${nome}-${hojeISO()}.csv`, new Blob([csvDe(colunas, linhas)], { type: 'text/csv' })); } catch (e) { falha(e); }
}

// ---------- idade e WhatsApp ----------
function idadeDe(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number), h = new Date();
  return h.getFullYear() - a - (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d) ? 1 : 0);
}
// link que abre a conversa no WhatsApp (só para números brasileiros com DDD)
function linkWhats(telefone) {
  const d = soDig(telefone); if (/[a-z+]/i.test(String(telefone || '')) || (d.length !== 10 && d.length !== 11)) return '';
  return ` <a class="small" href="https://wa.me/55${d}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`;
}

const { Router } = require('express');
const { db, tx } = require('../db');
const { auditar } = require('../auth');
const { MODELOS, POR_AREA, melhorDocumento } = require('../modelos');
const { wrap, bad, notFound, txt, req_, oneOf, id_, dataISO, like } = require('../util');

const r = Router();
const STATUS = ['pendente', 'ok', 'dispensado'];
const CATEGORIAS = ['procuracao', 'contrato', 'peticao', 'decisao', 'identificacao', 'comprovante', 'prova', 'parecer', 'correspondencia', 'outros'];

const SELECT = `SELECT p.*, c.nome AS cliente, pr.titulo AS processo, d.titulo AS documento, u.nome AS responsavel
  FROM pendencias p JOIN clientes c ON c.id = p.cliente_id LEFT JOIN processos pr ON pr.id = p.processo_id
  LEFT JOIN documentos d ON d.id = p.documento_id LEFT JOIN usuarios u ON u.id = p.responsavel_id`;
const ORDEM = `ORDER BY CASE p.status WHEN 'pendente' THEN 0 WHEN 'ok' THEN 1 ELSE 2 END, (p.prazo IS NULL), p.prazo, p.id`;

function pendencia(id) { const p = db.prepare('SELECT * FROM pendencias WHERE id = ?').get(id_(id)); if (!p) throw notFound('Pendência'); return p; }

function lerDados(b, cliente_id) {
  let processo_id = id_(b.processo_id) || null;
  if (processo_id && !db.prepare('SELECT 1 FROM processos WHERE id = ? AND cliente_id = ?').get(processo_id, cliente_id)) throw bad('O caso não pertence a este cliente.');
  const categoria = b.categoria && CATEGORIAS.includes(b.categoria) ? b.categoria : null;
  return {
    processo_id, tipo: oneOf(b.tipo || 'documento', ['documento', 'tarefa'], 'tipo'), titulo: req_(b.titulo, 'título', 200),
    descricao: txt(b.descricao, 1000), categoria, prazo: dataISO(b.prazo, 'prazo'), observacao: txt(b.observacao, 1000), responsavel_id: id_(b.responsavel_id) || null,
  };
}

// Lista (filtros: cliente_id, processo_id, status, tipo, q)
r.get('/', (req, res) => {
  const where = ['1=1'], p = [];
  if (id_(req.query.cliente_id)) { where.push('p.cliente_id = ?'); p.push(id_(req.query.cliente_id)); }
  if (id_(req.query.processo_id)) { where.push('p.processo_id = ?'); p.push(id_(req.query.processo_id)); }
  if (STATUS.includes(req.query.status)) { where.push('p.status = ?'); p.push(req.query.status); }
  if (['documento', 'tarefa'].includes(req.query.tipo)) { where.push('p.tipo = ?'); p.push(req.query.tipo); }
  if (req.query.q) { const l = like(req.query.q); where.push("(p.titulo LIKE ? ESCAPE '\\' OR c.nome LIKE ? ESCAPE '\\' OR p.observacao LIKE ? ESCAPE '\\')"); p.push(l, l, l); }
  if (!id_(req.query.cliente_id)) where.push('c.ativo = 1');
  res.json(db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ${ORDEM} LIMIT 1000`).all(...p));
});

r.get('/modelos', (req, res) => {
  res.json({ modelos: Object.entries(MODELOS).map(([chave, m]) => ({ chave, nome: m.nome, n: m.itens.length, itens: m.itens.map((i) => i.t) })), por_area: POR_AREA });
});

r.post('/', (req, res) => {
  const cliente_id = id_(req.body.cliente_id);
  if (!cliente_id || !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(cliente_id)) throw bad('Selecione o cliente.');
  const d = lerDados(req.body, cliente_id);
  const id = Number(db.prepare(`INSERT INTO pendencias (cliente_id, processo_id, tipo, titulo, descricao, categoria, prazo, observacao, responsavel_id, usuario_id) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(cliente_id, d.processo_id, d.tipo, d.titulo, d.descricao, d.categoria, d.prazo, d.observacao, d.responsavel_id, req.usuario.id).lastInsertRowid);
  auditar(req, 'criar', 'pendencias', id, d.titulo);
  res.json({ id });
});

r.put('/:id', (req, res) => {
  const p = pendencia(req.params.id);
  const d = lerDados(req.body, p.cliente_id);
  db.prepare(`UPDATE pendencias SET processo_id=?, tipo=?, titulo=?, descricao=?, categoria=?, prazo=?, observacao=?, responsavel_id=?, atualizado_em=datetime('now') WHERE id=?`)
    .run(d.processo_id, d.tipo, d.titulo, d.descricao, d.categoria, d.prazo, d.observacao, d.responsavel_id, p.id);
  auditar(req, 'editar', 'pendencias', p.id, d.titulo);
  res.json({ ok: true });
});

function mudarStatus(p, status, documento_id, observacao) {
  oneOf(status, STATUS, 'situação');
  let doc = null;
  if (status === 'ok' && documento_id) {
    doc = db.prepare('SELECT id, cliente_id FROM documentos WHERE id = ?').get(documento_id);
    if (!doc) throw bad('Documento inválido.');
    if (doc.cliente_id && doc.cliente_id !== p.cliente_id) throw bad('O documento pertence a outro cliente.');
  }
  db.prepare(`UPDATE pendencias SET status = ?, documento_id = ?, concluido_em = ?, observacao = COALESCE(?, observacao), atualizado_em = datetime('now') WHERE id = ?`)
    .run(status, status === 'ok' ? (doc?.id ?? null) : null, status === 'pendente' ? null : new Date().toISOString().slice(0, 19).replace('T', ' '), observacao ?? null, p.id);
}

r.post('/:id/status', (req, res) => {
  const p = pendencia(req.params.id);
  mudarStatus(p, req.body.status, id_(req.body.documento_id), txt(req.body.observacao, 1000));
  auditar(req, 'situacao', 'pendencias', p.id, `${p.titulo} → ${req.body.status}`);
  res.json({ ok: true });
});

// Vários de uma vez: { itens: [{ id, status, documento_id }] }
r.post('/lote', (req, res) => {
  const itens = (Array.isArray(req.body.itens) ? req.body.itens : []).slice(0, 200);
  if (!itens.length) throw bad('Nada para atualizar.');
  tx(() => { for (const i of itens) mudarStatus(pendencia(i.id), i.status, id_(i.documento_id), null); });
  auditar(req, 'situacao_lote', 'pendencias', null, `${itens.length} itens`);
  res.json({ ok: true, n: itens.length });
});

r.delete('/:id', (req, res) => {
  const p = pendencia(req.params.id);
  db.prepare('DELETE FROM pendencias WHERE id = ?').run(p.id);
  auditar(req, 'excluir', 'pendencias', p.id, p.titulo);
  res.json({ ok: true });
});

// Aplica um modelo de checklist ao cliente (e opcionalmente a um caso) sem duplicar itens já existentes
r.post('/modelo', (req, res) => {
  const cliente_id = id_(req.body.cliente_id);
  if (!cliente_id || !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(cliente_id)) throw bad('Selecione o cliente.');
  const chaves = (Array.isArray(req.body.modelos) ? req.body.modelos : [req.body.modelo]).filter((k) => MODELOS[k]);
  if (!chaves.length) throw bad('Escolha um modelo.');
  const processo_id = id_(req.body.processo_id) || null;
  if (processo_id && !db.prepare('SELECT 1 FROM processos WHERE id = ? AND cliente_id = ?').get(processo_id, cliente_id)) throw bad('O caso não pertence a este cliente.');
  let criados = 0, existentes = 0;
  tx(() => {
    for (const k of chaves) for (const i of MODELOS[k].itens) {
      const ja = db.prepare('SELECT 1 FROM pendencias WHERE cliente_id = ? AND processo_id IS ? AND lower(titulo) = lower(?)').get(cliente_id, processo_id, i.t);
      if (ja) { existentes++; continue; }
      db.prepare('INSERT INTO pendencias (cliente_id, processo_id, tipo, titulo, categoria, palavras, usuario_id) VALUES (?,?,?,?,?,?,?)')
        .run(cliente_id, processo_id, i.tipo, i.t, i.c, JSON.stringify(i.k || []), req.usuario.id); criados++;
    }
  });
  auditar(req, 'aplicar_modelo', 'pendencias', null, `cliente #${cliente_id}: ${chaves.join(', ')} (+${criados})`);
  res.json({ criados, existentes });
});

// Confere (localmente, sem IA) quais documentos já arquivados do cliente dão baixa em itens pendentes
r.post('/conferir', wrap(async (req, res) => {
  const cliente_id = id_(req.body.cliente_id);
  if (!cliente_id) throw bad('Selecione o cliente.');
  const docs = db.prepare('SELECT id, titulo, nome_original, tags, resumo, categoria, processo_id FROM documentos WHERE cliente_id = ?').all(cliente_id);
  const processo_id = id_(req.body.processo_id) || null;
  const abertas = db.prepare(`SELECT * FROM pendencias WHERE cliente_id = ? AND status = 'pendente' AND tipo = 'documento' ${processo_id ? 'AND (processo_id = ? OR processo_id IS NULL)' : ''}`).all(...(processo_id ? [cliente_id, processo_id] : [cliente_id]));
  const usados = new Set(db.prepare("SELECT documento_id FROM pendencias WHERE cliente_id = ? AND documento_id IS NOT NULL AND status = 'ok'").all(cliente_id).map((x) => x.documento_id));
  const propostas = [];
  for (const p of abertas) {
    const m = melhorDocumento(p, docs.filter((d) => !usados.has(d.id)));
    if (m) { propostas.push({ pendencia_id: p.id, pendencia: p.titulo, documento_id: m.documento.id, documento: m.documento.titulo, motivo: m.motivo }); usados.add(m.documento.id); }
  }
  res.json({ propostas, analisadas: abertas.length, documentos: docs.length });
}));

module.exports = r;

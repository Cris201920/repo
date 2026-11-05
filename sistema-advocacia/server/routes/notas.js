const { Router } = require('express');
const { db } = require('../db');
const { auditar } = require('../auth');
const { bad, notFound, req_, oneOf, id_, HttpError } = require('../util');

const r = Router();
const TABELA = { cliente: 'clientes', processo: 'processos', documento: 'documentos' };

function conferirEntidade(entidade, id) {
  oneOf(entidade, Object.keys(TABELA), 'entidade');
  if (!id || !db.prepare(`SELECT 1 FROM ${TABELA[entidade]} WHERE id = ?`).get(id)) throw notFound('Item da observação');
}
function minhaNota(req) {
  const n = db.prepare('SELECT * FROM notas WHERE id = ?').get(id_(req.params.id));
  if (!n) throw notFound('Observação');
  // o autor sempre pode; advogados e administradores também; estagiário só nas próprias
  if (n.usuario_id !== req.usuario.id && req.usuario.papel === 'estagiario') throw new HttpError(403, 'Você só pode alterar as suas próprias observações.');
  return n;
}

r.get('/', (req, res) => {
  const entidade = String(req.query.entidade || ''), id = id_(req.query.id);
  conferirEntidade(entidade, id);
  res.json(db.prepare('SELECT * FROM notas WHERE entidade = ? AND entidade_id = ? ORDER BY fixada DESC, id DESC').all(entidade, id));
});

r.post('/', (req, res) => {
  const entidade = String(req.body.entidade || ''), eid = id_(req.body.entidade_id);
  conferirEntidade(entidade, eid);
  const texto = req_(req.body.texto, 'observação', 5000);
  const id = Number(db.prepare('INSERT INTO notas (entidade, entidade_id, texto, fixada, usuario_id, usuario_nome) VALUES (?,?,?,?,?,?)')
    .run(entidade, eid, texto, req.body.fixada ? 1 : 0, req.usuario.id, req.usuario.nome).lastInsertRowid);
  auditar(req, 'criar', 'notas', id, `${entidade} #${eid}`);
  res.json({ id });
});

r.put('/:id', (req, res) => {
  const n = minhaNota(req);
  const texto = req.body.texto !== undefined ? req_(req.body.texto, 'observação', 5000) : n.texto;
  const fixada = req.body.fixada !== undefined ? (req.body.fixada ? 1 : 0) : n.fixada;
  db.prepare("UPDATE notas SET texto = ?, fixada = ?, atualizado_em = datetime('now') WHERE id = ?").run(texto, fixada, n.id);
  auditar(req, 'editar', 'notas', n.id);
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  const n = minhaNota(req);
  db.prepare('DELETE FROM notas WHERE id = ?').run(n.id);
  auditar(req, 'excluir', 'notas', n.id, `${n.entidade} #${n.entidade_id}`);
  res.json({ ok: true });
});

module.exports = r;

const { Router } = require('express');
const { db, tx } = require('../db');
const { auditar } = require('../auth');
const { wrap, bad, notFound, req_, id_, HttpError } = require('../util');

const r = Router();

// Pastas criadas por "Pastas padrão" e usadas para guardar automaticamente documentos organizados pela IA
const PADRAO = ['Identificação', 'Procurações e contratos', 'Comprovantes', 'Provas', 'Peças e decisões', 'Correspondência'];
const PASTA_POR_CATEGORIA = {
  identificacao: 'Identificação', procuracao: 'Procurações e contratos', contrato: 'Procurações e contratos', comprovante: 'Comprovantes',
  prova: 'Provas', peticao: 'Peças e decisões', decisao: 'Peças e decisões', parecer: 'Peças e decisões', correspondencia: 'Correspondência',
};

const pastaPorId = (id) => { const p = db.prepare('SELECT * FROM pastas WHERE id = ?').get(id_(id)); if (!p) throw notFound('Pasta'); return p; };
const nomePasta = (v) => { const n = req_(v, 'nome da pasta', 80).replace(/[\\/]/g, '-'); return n; };

function existeIrma(nome, parent_id, cliente_id, ignorarId = 0) {
  return db.prepare(`SELECT 1 FROM pastas WHERE lower(nome) = lower(?) AND parent_id IS ? AND cliente_id IS ? AND id <> ?`).get(nome, parent_id, cliente_id, ignorarId);
}
function ehDescendente(candidatoId, ancestralId) {
  for (let atual = candidatoId, i = 0; atual && i < 50; i++) {
    if (atual === ancestralId) return true;
    atual = db.prepare('SELECT parent_id FROM pastas WHERE id = ?').get(atual)?.parent_id;
  }
  return false;
}

// Pasta padrão correspondente a um tipo de documento (se o cliente já tiver as pastas padrão)
function pastaPadraoPara(cliente_id, categoria) {
  const nome = PASTA_POR_CATEGORIA[categoria];
  if (!cliente_id || !nome) return null;
  return db.prepare('SELECT id FROM pastas WHERE cliente_id = ? AND parent_id IS NULL AND lower(nome) = lower(?)').get(cliente_id, nome)?.id ?? null;
}

// Lista as pastas do escopo: ?cliente_id=N (pastas do cliente) ou ?geral=1 (pastas gerais do escritório)
r.get('/', (req, res) => {
  const cid = id_(req.query.cliente_id);
  res.json(db.prepare(`SELECT p.id, p.nome, p.parent_id, p.cliente_id,
      (SELECT COUNT(*) FROM documentos d WHERE d.pasta_id = p.id) AS n_docs,
      (SELECT COUNT(*) FROM pastas s WHERE s.parent_id = p.id) AS n_sub
    FROM pastas p WHERE p.cliente_id IS ? ORDER BY p.nome COLLATE NOCASE`).all(cid || null));
});

r.post('/', (req, res) => {
  const cliente_id = id_(req.body.cliente_id) || null;
  if (cliente_id && !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(cliente_id)) throw bad('Cliente inválido.');
  const parent_id = id_(req.body.parent_id) || null;
  if (parent_id) { const pai = pastaPorId(parent_id); if ((pai.cliente_id || null) !== cliente_id) throw bad('A pasta pai pertence a outra área.'); }
  const nome = nomePasta(req.body.nome);
  if (existeIrma(nome, parent_id, cliente_id)) throw bad('Já existe uma pasta com este nome aqui.');
  const id = Number(db.prepare('INSERT INTO pastas (nome, parent_id, cliente_id, criado_por) VALUES (?,?,?,?)').run(nome, parent_id, cliente_id, req.usuario.id).lastInsertRowid);
  auditar(req, 'criar', 'pastas', id, nome);
  res.json({ id });
});

r.put('/:id', (req, res) => {
  const p = pastaPorId(req.params.id);
  const nome = nomePasta(req.body.nome ?? p.nome);
  let parent_id = p.parent_id;
  if (req.body.parent_id !== undefined) {
    parent_id = id_(req.body.parent_id) || null;
    if (parent_id) {
      const pai = pastaPorId(parent_id);
      if ((pai.cliente_id || null) !== (p.cliente_id || null)) throw bad('Não é possível mover para a pasta de outro cliente.');
      if (ehDescendente(parent_id, p.id)) throw bad('Não é possível mover uma pasta para dentro dela mesma.');
    }
  }
  if (existeIrma(nome, parent_id, p.cliente_id, p.id)) throw bad('Já existe uma pasta com este nome aqui.');
  db.prepare('UPDATE pastas SET nome = ?, parent_id = ? WHERE id = ?').run(nome, parent_id, p.id);
  auditar(req, 'editar', 'pastas', p.id, nome);
  res.json({ ok: true });
});

// Excluir pasta: as subpastas são excluídas junto; os DOCUMENTOS NÃO são apagados (ficam sem pasta)
r.delete('/:id', (req, res) => {
  if (req.usuario.papel === 'estagiario') throw new HttpError(403, 'Sem permissão para excluir pastas.');
  const p = pastaPorId(req.params.id);
  db.prepare('DELETE FROM pastas WHERE id = ?').run(p.id);
  auditar(req, 'excluir', 'pastas', p.id, p.nome);
  res.json({ ok: true });
});

// Cria as pastas padrão do cliente (não duplica as que já existem)
r.post('/padrao', (req, res) => {
  const cliente_id = id_(req.body.cliente_id);
  if (!cliente_id || !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(cliente_id)) throw bad('Cliente inválido.');
  let criadas = 0;
  tx(() => {
    for (const nome of PADRAO) {
      if (existeIrma(nome, null, cliente_id)) continue;
      db.prepare('INSERT INTO pastas (nome, parent_id, cliente_id, criado_por) VALUES (?,NULL,?,?)').run(nome, cliente_id, req.usuario.id); criadas++;
    }
  });
  if (criadas) auditar(req, 'criar_padrao', 'pastas', null, `cliente #${cliente_id}: ${criadas} pastas`);
  res.json({ criadas });
});

// Move documentos para uma pasta (ou para "sem pasta" com pasta_id vazio)
r.post('/mover-docs', wrap(async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(id_).filter(Boolean))].slice(0, 500);
  if (!ids.length) throw bad('Selecione ao menos um documento.');
  const pasta = id_(req.body.pasta_id) ? pastaPorId(req.body.pasta_id) : null;
  tx(() => {
    for (const id of ids) {
      const d = db.prepare('SELECT id, cliente_id, titulo FROM documentos WHERE id = ?').get(id);
      if (!d) continue;
      if (pasta) {
        if (pasta.cliente_id && d.cliente_id && d.cliente_id !== pasta.cliente_id) throw bad(`“${d.titulo}” pertence a outro cliente e não pode ir para esta pasta.`);
        if (!pasta.cliente_id && d.cliente_id) throw bad(`“${d.titulo}” é de um cliente; mova para uma pasta desse cliente.`);
        db.prepare('UPDATE documentos SET pasta_id = ?, cliente_id = COALESCE(cliente_id, ?) WHERE id = ?').run(pasta.id, pasta.cliente_id, id);
      } else db.prepare('UPDATE documentos SET pasta_id = NULL WHERE id = ?').run(id);
    }
  });
  auditar(req, 'mover_docs', 'pastas', pasta?.id ?? null, `${ids.length} documento(s)`);
  res.json({ ok: true });
}));

module.exports = r;
module.exports.pastaPadraoPara = pastaPadraoPara;
module.exports.pastaPorId = pastaPorId;

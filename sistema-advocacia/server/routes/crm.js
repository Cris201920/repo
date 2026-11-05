const { Router } = require('express');
const { db } = require('../db');
const { auditar } = require('../auth');
const { wrap, bad, notFound, txt, req_, oneOf, id_, dataISO, like, HttpError } = require('../util');

// Edição simultânea: o formulário envia a "versao" que carregou. Se outra pessoa salvou nesse meio tempo,
// recusamos (409) em vez de sobrescrever em silêncio o que ela alterou. Sem "versao" (integrações) = aceita.
function checarVersao(enviada, atual) {
  if (enviada === undefined || enviada === null || enviada === '') return;
  if (Number(enviada) !== atual) {
    throw new HttpError(409, 'Este registro foi alterado por outra pessoa depois que você o abriu. Feche esta janela e clique em Editar de novo para ver as mudanças antes de salvar.');
  }
}

const r = Router();
const AREAS = ['Cível', 'Trabalhista', 'Família e Sucessões', 'Previdenciário', 'Consumidor', 'Criminal', 'Tributário', 'Empresarial', 'Imobiliário', 'Administrativo', 'Outra'];
const CANAIS = ['presencial', 'telefone', 'whatsapp', 'videochamada', 'e-mail', 'outro'];
const STATUS = ['consultivo', 'em_andamento', 'suspenso', 'encerrado'];

// ======================= PAINEL =======================
r.get('/painel', (req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const hoje = new Date().toISOString().slice(0, 10);
  const mes = hoje.slice(0, 7);
  res.json({
    totais: {
      clientes: one('SELECT COUNT(*) n FROM clientes WHERE ativo = 1').n,
      processos: one("SELECT COUNT(*) n FROM processos WHERE status IN ('em_andamento','consultivo')").n,
      atendimentosMes: one('SELECT COUNT(*) n FROM atendimentos WHERE substr(data_hora,1,7) = ?', mes).n,
      documentos: one('SELECT COUNT(*) n FROM documentos').n,
    },
    prazos: db.prepare(`SELECT a.id, a.assunto, a.prazo, a.providencias, c.nome AS cliente, c.id AS cliente_id
      FROM atendimentos a JOIN clientes c ON c.id = a.cliente_id
      WHERE a.concluido = 0 AND a.prazo IS NOT NULL ORDER BY a.prazo LIMIT 12`).all(),
    atendimentos: db.prepare(`SELECT a.id, a.assunto, a.data_hora, a.canal, c.nome AS cliente, c.id AS cliente_id
      FROM atendimentos a JOIN clientes c ON c.id = a.cliente_id ORDER BY a.data_hora DESC LIMIT 8`).all(),
    documentos: db.prepare(`SELECT d.id, d.titulo, d.categoria, d.criado_em, c.nome AS cliente
      FROM documentos d LEFT JOIN clientes c ON c.id = d.cliente_id ORDER BY d.id DESC LIMIT 6`).all(),
    pendencias: {
      abertas: one("SELECT COUNT(*) n FROM pendencias p JOIN clientes c ON c.id = p.cliente_id WHERE p.status = 'pendente' AND c.ativo = 1").n,
      vencidas: one("SELECT COUNT(*) n FROM pendencias p JOIN clientes c ON c.id = p.cliente_id WHERE p.status = 'pendente' AND c.ativo = 1 AND p.prazo IS NOT NULL AND substr(p.prazo,1,10) < ?", hoje).n,
      lista: db.prepare(`SELECT p.id, p.titulo, p.tipo, p.prazo, c.nome AS cliente, c.id AS cliente_id FROM pendencias p JOIN clientes c ON c.id = p.cliente_id
        WHERE p.status = 'pendente' AND c.ativo = 1 ORDER BY (p.prazo IS NULL), p.prazo, p.id LIMIT 8`).all(),
    },
    hoje,
  });
});

// ======================= BUSCA GLOBAL =======================
r.get('/busca', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ clientes: [], processos: [], atendimentos: [], documentos: [] });
  const l = like(q);
  res.json({
    clientes: db.prepare("SELECT id, nome, documento FROM clientes WHERE nome LIKE ? ESCAPE '\\' OR documento LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' LIMIT 6").all(l, l, l),
    processos: db.prepare("SELECT p.id, p.titulo, p.numero, c.nome AS cliente FROM processos p JOIN clientes c ON c.id = p.cliente_id WHERE p.titulo LIKE ? ESCAPE '\\' OR p.numero LIKE ? ESCAPE '\\' LIMIT 6").all(l, l),
    atendimentos: db.prepare("SELECT a.id, a.assunto, a.data_hora, c.nome AS cliente FROM atendimentos a JOIN clientes c ON c.id = a.cliente_id WHERE a.assunto LIKE ? ESCAPE '\\' OR a.resumo LIKE ? ESCAPE '\\' ORDER BY a.data_hora DESC LIMIT 6").all(l, l),
    documentos: db.prepare("SELECT id, titulo, nome_original FROM documentos WHERE titulo LIKE ? ESCAPE '\\' OR nome_original LIKE ? ESCAPE '\\' OR texto LIKE ? ESCAPE '\\' LIMIT 6").all(l, l, l),
  });
});

// ======================= CLIENTES =======================
function lerCliente(b) {
  return {
    tipo: oneOf(b.tipo || 'PF', ['PF', 'PJ'], 'tipo'),
    nome: req_(b.nome, 'nome do cliente', 160),
    documento: txt(b.documento, 30), rg: txt(b.rg, 30), estado_civil: txt(b.estado_civil, 30),
    profissao: txt(b.profissao, 80), nascimento: dataISO(b.nascimento, 'nascimento'),
    email: txt(b.email, 160), telefone: txt(b.telefone, 40), endereco: txt(b.endereco, 300),
    observacoes: txt(b.observacoes, 5000),
  };
}
const CAMPOS_CLIENTE = ['tipo', 'nome', 'documento', 'rg', 'estado_civil', 'profissao', 'nascimento', 'email', 'telefone', 'endereco', 'observacoes'];

r.get('/clientes', (req, res) => {
  const q = String(req.query.q || '').trim();
  const inativos = req.query.inativos === '1';
  const where = [inativos ? '1=1' : 'c.ativo = 1'], p = [];
  if (q) { where.push("(c.nome LIKE ? ESCAPE '\\' OR c.documento LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.telefone LIKE ? ESCAPE '\\')"); p.push(like(q), like(q), like(q), like(q)); }
  res.json(db.prepare(`SELECT c.*,
      (SELECT COUNT(*) FROM processos WHERE cliente_id = c.id) AS n_processos,
      (SELECT COUNT(*) FROM atendimentos WHERE cliente_id = c.id) AS n_atendimentos,
      (SELECT MAX(data_hora) FROM atendimentos WHERE cliente_id = c.id) AS ultimo_atendimento
    FROM clientes c WHERE ${where.join(' AND ')} ORDER BY c.nome COLLATE NOCASE LIMIT 500`).all(...p));
});
r.get('/clientes/:id', (req, res) => {
  const id = id_(req.params.id);
  const c = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
  if (!c) throw notFound('Cliente');
  res.json({
    ...c,
    processos: db.prepare('SELECT * FROM processos WHERE cliente_id = ? ORDER BY id DESC').all(id),
    atendimentos: db.prepare('SELECT * FROM atendimentos WHERE cliente_id = ? ORDER BY data_hora DESC').all(id),
    documentos: db.prepare('SELECT id, titulo, categoria, nome_original, tamanho, criado_em, processo_id FROM documentos WHERE cliente_id = ? ORDER BY id DESC').all(id),
  });
});
r.post('/clientes', (req, res) => {
  const c = lerCliente(req.body);
  const info = db.prepare(`INSERT INTO clientes (${CAMPOS_CLIENTE.join(',')}, criado_por) VALUES (${CAMPOS_CLIENTE.map(() => '?').join(',')}, ?)`)
    .run(...CAMPOS_CLIENTE.map((k) => c[k]), req.usuario.id);
  auditar(req, 'criar', 'clientes', Number(info.lastInsertRowid), c.nome);
  res.json({ id: Number(info.lastInsertRowid) });
});
r.put('/clientes/:id', (req, res) => {
  const id = id_(req.params.id);
  const atual = db.prepare('SELECT versao FROM clientes WHERE id = ?').get(id);
  if (!atual) throw notFound('Cliente');
  checarVersao(req.body.versao, atual.versao);
  const c = lerCliente(req.body);
  db.prepare(`UPDATE clientes SET ${CAMPOS_CLIENTE.map((k) => k + ' = ?').join(', ')}, atualizado_em = datetime('now'), versao = versao + 1 WHERE id = ?`)
    .run(...CAMPOS_CLIENTE.map((k) => c[k]), id);
  auditar(req, 'editar', 'clientes', id, c.nome);
  res.json({ ok: true });
});
r.post('/clientes/:id/ativo', (req, res) => {
  const id = id_(req.params.id), ativo = req.body.ativo ? 1 : 0;
  db.prepare('UPDATE clientes SET ativo = ?, versao = versao + 1 WHERE id = ?').run(ativo, id);
  auditar(req, ativo ? 'reativar' : 'arquivar', 'clientes', id);
  res.json({ ok: true });
});

// ======================= PROCESSOS =======================
function lerProcesso(b) {
  const cliente_id = id_(b.cliente_id);
  if (!cliente_id || !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(cliente_id)) throw bad('Selecione o cliente.');
  let valor = null;
  if (b.valor_causa !== undefined && b.valor_causa !== null && b.valor_causa !== '') {
    valor = Number(b.valor_causa); if (!isFinite(valor) || valor < 0) throw bad('Valor da causa inválido.');
  }
  return {
    cliente_id, titulo: req_(b.titulo, 'título do caso', 200), numero: txt(b.numero, 40),
    area: txt(b.area, 60), juizo: txt(b.juizo, 200), parte_contraria: txt(b.parte_contraria, 200),
    status: oneOf(b.status || 'em_andamento', STATUS, 'status'), valor_causa: valor,
    responsavel_id: id_(b.responsavel_id), observacoes: txt(b.observacoes, 5000),
  };
}
const CAMPOS_PROC = ['cliente_id', 'titulo', 'numero', 'area', 'juizo', 'parte_contraria', 'status', 'valor_causa', 'responsavel_id', 'observacoes'];

r.get('/processos', (req, res) => {
  const where = ['1=1'], p = [];
  if (req.query.q) { const l = like(req.query.q); where.push("(p.titulo LIKE ? ESCAPE '\\' OR p.numero LIKE ? ESCAPE '\\' OR c.nome LIKE ? ESCAPE '\\' OR p.parte_contraria LIKE ? ESCAPE '\\')"); p.push(l, l, l, l); }
  if (req.query.status) { where.push('p.status = ?'); p.push(String(req.query.status)); }
  if (id_(req.query.cliente_id)) { where.push('p.cliente_id = ?'); p.push(id_(req.query.cliente_id)); }
  res.json(db.prepare(`SELECT p.*, c.nome AS cliente, u.nome AS responsavel FROM processos p
    JOIN clientes c ON c.id = p.cliente_id LEFT JOIN usuarios u ON u.id = p.responsavel_id
    WHERE ${where.join(' AND ')} ORDER BY p.atualizado_em DESC LIMIT 500`).all(...p));
});
r.get('/processos/:id', (req, res) => {
  const id = id_(req.params.id);
  const p = db.prepare(`SELECT p.*, c.nome AS cliente, u.nome AS responsavel FROM processos p
    JOIN clientes c ON c.id = p.cliente_id LEFT JOIN usuarios u ON u.id = p.responsavel_id WHERE p.id = ?`).get(id);
  if (!p) throw notFound('Processo');
  res.json({
    ...p,
    atendimentos: db.prepare('SELECT * FROM atendimentos WHERE processo_id = ? ORDER BY data_hora DESC').all(id),
    documentos: db.prepare('SELECT id, titulo, categoria, nome_original, tamanho, criado_em FROM documentos WHERE processo_id = ? ORDER BY id DESC').all(id),
  });
});
r.post('/processos', (req, res) => {
  const p = lerProcesso(req.body);
  const info = db.prepare(`INSERT INTO processos (${CAMPOS_PROC.join(',')}) VALUES (${CAMPOS_PROC.map(() => '?').join(',')})`).run(...CAMPOS_PROC.map((k) => p[k]));
  auditar(req, 'criar', 'processos', Number(info.lastInsertRowid), p.titulo);
  res.json({ id: Number(info.lastInsertRowid) });
});
r.put('/processos/:id', (req, res) => {
  const id = id_(req.params.id);
  const atual = db.prepare('SELECT versao FROM processos WHERE id = ?').get(id);
  if (!atual) throw notFound('Processo');
  checarVersao(req.body.versao, atual.versao);
  const p = lerProcesso(req.body);
  db.prepare(`UPDATE processos SET ${CAMPOS_PROC.map((k) => k + ' = ?').join(', ')}, atualizado_em = datetime('now'), versao = versao + 1 WHERE id = ?`).run(...CAMPOS_PROC.map((k) => p[k]), id);
  auditar(req, 'editar', 'processos', id, p.titulo);
  res.json({ ok: true });
});

// ======================= ATENDIMENTOS =======================
function lerAtendimento(b) {
  const cliente_id = id_(b.cliente_id);
  if (!cliente_id || !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(cliente_id)) throw bad('Selecione o cliente.');
  const processo_id = id_(b.processo_id);
  if (processo_id && !db.prepare('SELECT 1 FROM processos WHERE id = ? AND cliente_id = ?').get(processo_id, cliente_id)) throw bad('O processo não pertence a este cliente.');
  return {
    cliente_id, processo_id, data_hora: dataISO(b.data_hora, 'data e hora', { obrigatoria: true }),
    canal: oneOf(b.canal || 'presencial', CANAIS, 'canal'), assunto: req_(b.assunto, 'assunto', 200),
    resumo: txt(b.resumo, 20000), providencias: txt(b.providencias, 5000),
    prazo: dataISO(b.prazo, 'prazo'), concluido: b.concluido ? 1 : 0,
  };
}
const CAMPOS_AT = ['cliente_id', 'processo_id', 'data_hora', 'canal', 'assunto', 'resumo', 'providencias', 'prazo', 'concluido'];

r.get('/atendimentos', (req, res) => {
  const where = ['1=1'], p = [];
  if (req.query.q) { const l = like(req.query.q); where.push("(a.assunto LIKE ? ESCAPE '\\' OR a.resumo LIKE ? ESCAPE '\\' OR c.nome LIKE ? ESCAPE '\\')"); p.push(l, l, l); }
  if (req.query.canal) { where.push('a.canal = ?'); p.push(String(req.query.canal)); }
  if (req.query.pendentes === '1') where.push('a.concluido = 0 AND a.prazo IS NOT NULL');
  if (id_(req.query.cliente_id)) { where.push('a.cliente_id = ?'); p.push(id_(req.query.cliente_id)); }
  if (req.query.de) { where.push('substr(a.data_hora,1,10) >= ?'); p.push(String(req.query.de)); }
  if (req.query.ate) { where.push('substr(a.data_hora,1,10) <= ?'); p.push(String(req.query.ate)); }
  res.json(db.prepare(`SELECT a.*, c.nome AS cliente, p.titulo AS processo, u.nome AS atendente,
      (SELECT COUNT(*) FROM documentos WHERE atendimento_id = a.id) AS n_documentos
    FROM atendimentos a JOIN clientes c ON c.id = a.cliente_id
    LEFT JOIN processos p ON p.id = a.processo_id LEFT JOIN usuarios u ON u.id = a.usuario_id
    WHERE ${where.join(' AND ')} ORDER BY a.data_hora DESC LIMIT 500`).all(...p));
});
r.get('/atendimentos/:id', (req, res) => {
  const id = id_(req.params.id);
  const a = db.prepare(`SELECT a.*, c.nome AS cliente, p.titulo AS processo, u.nome AS atendente FROM atendimentos a
    JOIN clientes c ON c.id = a.cliente_id LEFT JOIN processos p ON p.id = a.processo_id LEFT JOIN usuarios u ON u.id = a.usuario_id WHERE a.id = ?`).get(id);
  if (!a) throw notFound('Atendimento');
  a.documentos = db.prepare('SELECT id, titulo, categoria, nome_original, tamanho, criado_em FROM documentos WHERE atendimento_id = ? ORDER BY id DESC').all(id);
  res.json(a);
});
r.post('/atendimentos', (req, res) => {
  const a = lerAtendimento(req.body);
  const info = db.prepare(`INSERT INTO atendimentos (${CAMPOS_AT.join(',')}, usuario_id) VALUES (${CAMPOS_AT.map(() => '?').join(',')}, ?)`)
    .run(...CAMPOS_AT.map((k) => a[k]), req.usuario.id);
  auditar(req, 'criar', 'atendimentos', Number(info.lastInsertRowid), a.assunto);
  res.json({ id: Number(info.lastInsertRowid) });
});
r.put('/atendimentos/:id', (req, res) => {
  const id = id_(req.params.id);
  const atual = db.prepare('SELECT versao FROM atendimentos WHERE id = ?').get(id);
  if (!atual) throw notFound('Atendimento');
  checarVersao(req.body.versao, atual.versao);
  const a = lerAtendimento(req.body);
  db.prepare(`UPDATE atendimentos SET ${CAMPOS_AT.map((k) => k + ' = ?').join(', ')}, atualizado_em = datetime('now'), versao = versao + 1 WHERE id = ?`).run(...CAMPOS_AT.map((k) => a[k]), id);
  auditar(req, 'editar', 'atendimentos', id, a.assunto);
  res.json({ ok: true });
});
r.post('/atendimentos/:id/concluir', (req, res) => {
  const id = id_(req.params.id);
  db.prepare("UPDATE atendimentos SET concluido = ?, atualizado_em = datetime('now'), versao = versao + 1 WHERE id = ?").run(req.body.concluido ? 1 : 0, id);
  auditar(req, req.body.concluido ? 'concluir' : 'reabrir', 'atendimentos', id);
  res.json({ ok: true });
});
r.delete('/atendimentos/:id', (req, res) => {
  const id = id_(req.params.id);
  if (req.usuario.papel === 'estagiario') return res.status(403).json({ erro: 'Sem permissão para excluir.' });
  db.prepare('DELETE FROM atendimentos WHERE id = ?').run(id);
  auditar(req, 'excluir', 'atendimentos', id);
  res.json({ ok: true });
});

r.get('/opcoes', (req, res) => {
  res.json({
    areas: AREAS, canais: CANAIS, status: STATUS,
    usuarios: db.prepare('SELECT id, nome FROM usuarios WHERE ativo = 1 ORDER BY nome').all(),
  });
});

module.exports = r;

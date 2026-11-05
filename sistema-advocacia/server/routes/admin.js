const { Router } = require('express');
const { db } = require('../db');
const A = require('../auth');
const { wrap, bad, notFound, req_, oneOf, id_ } = require('../util');

const r = Router();
const PAPEIS = ['admin', 'advogado', 'estagiario'];

r.get('/usuarios', (req, res) => res.json(db.prepare('SELECT id, nome, email, papel, ativo, criado_em FROM usuarios WHERE compartilhado = 0 ORDER BY nome').all()));

r.post('/usuarios', wrap(async (req, res) => {
  const nome = req_(req.body.nome, 'nome', 120);
  const email = req_(req.body.email, 'e-mail', 160).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('E-mail inválido.');
  const papel = oneOf(req.body.papel, PAPEIS, 'perfil');
  if (!A.senhaValida(req.body.senha)) throw bad(A.MSG_SENHA);
  if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) throw bad('Já existe um usuário com este e-mail.');
  const info = db.prepare('INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?,?,?,?)').run(nome, email, A.hashSenha(req.body.senha), papel);
  A.auditar(req, 'criar', 'usuarios', Number(info.lastInsertRowid), `${email} (${papel})`);
  res.json({ id: Number(info.lastInsertRowid) });
}));

r.put('/usuarios/:id', wrap(async (req, res) => {
  const id = id_(req.params.id);
  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  if (!u || u.compartilhado) throw notFound('Usuário');
  const papel = oneOf(req.body.papel, PAPEIS, 'perfil');
  const ativo = req.body.ativo ? 1 : 0;
  const nome = req_(req.body.nome, 'nome', 120);
  // nunca deixar o sistema sem administrador ativo
  if (u.papel === 'admin' && (papel !== 'admin' || !ativo)) {
    const outros = db.prepare("SELECT COUNT(*) n FROM usuarios WHERE papel = 'admin' AND ativo = 1 AND id <> ?").get(id).n;
    if (!outros) throw bad('É necessário manter ao menos um administrador ativo.');
  }
  db.prepare('UPDATE usuarios SET nome=?, papel=?, ativo=? WHERE id=?').run(nome, papel, ativo, id);
  if (!ativo) A.encerrarSessoesDoUsuario(id);
  if (req.body.senha) {
    if (!A.senhaValida(req.body.senha)) throw bad(A.MSG_SENHA);
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(A.hashSenha(req.body.senha), id);
    A.encerrarSessoesDoUsuario(id);
  }
  A.auditar(req, 'editar', 'usuarios', id, `${u.email} → ${papel}${ativo ? '' : ' (inativo)'}${req.body.senha ? ' + nova senha' : ''}`);
  res.json({ ok: true });
}));

r.get('/auditoria', (req, res) => {
  const where = ['1=1'], p = [];
  if (id_(req.query.usuario_id)) { where.push('usuario_id = ?'); p.push(id_(req.query.usuario_id)); }
  if (req.query.entidade) { where.push('entidade = ?'); p.push(String(req.query.entidade)); }
  res.json(db.prepare(`SELECT * FROM auditoria WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 300`).all(...p));
});

// ---- Acesso por link + senha (sem e-mail), opcional ----
const crypto = require('crypto');
const EMAIL_COMPARTILHADO = 'acesso-compartilhado@interno.local';
function gerarSenhaAcesso() {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789'; // sem caracteres ambíguos (0/o, 1/l/i)
  for (;;) {
    const c = Array.from(crypto.randomBytes(16), (b) => alfabeto[b % alfabeto.length]);
    const s = [0, 4, 8, 12].map((i) => c.slice(i, i + 4).join('')).join('-');
    if (/[a-z]/.test(s) && /\d/.test(s)) return s;
  }
}
r.get('/acesso-compartilhado', (req, res) => {
  const u = db.prepare('SELECT ativo, criado_em FROM usuarios WHERE compartilhado = 1').get();
  res.json({ ativo: !!u?.ativo, desde: u?.criado_em || null });
});
r.post('/acesso-compartilhado', wrap(async (req, res) => {
  const existente = db.prepare('SELECT id FROM usuarios WHERE compartilhado = 1').get();
  if (req.body.ativo === false) {
    if (existente) { db.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').run(existente.id); A.encerrarSessoesDoUsuario(existente.id); }
    A.auditar(req, 'acesso_compartilhado_desativado', 'usuarios', existente?.id);
    return res.json({ ativo: false });
  }
  let senha = req.body.senha ? String(req.body.senha) : gerarSenhaAcesso();
  if (req.body.senha && (senha.length < 12 || !A.senhaValida(senha))) throw bad('Use ao menos 12 caracteres, com letras e números (ou deixe vazio para gerar uma senha forte).');
  const hash = A.hashSenha(senha);
  let id;
  if (existente) { id = existente.id; db.prepare('UPDATE usuarios SET senha_hash = ?, ativo = 1 WHERE id = ?').run(hash, id); A.encerrarSessoesDoUsuario(id); }
  else id = Number(db.prepare("INSERT INTO usuarios (nome, email, senha_hash, papel, compartilhado) VALUES ('Acesso compartilhado', ?, ?, 'advogado', 1)").run(EMAIL_COMPARTILHADO, hash).lastInsertRowid);
  A.auditar(req, existente ? 'acesso_compartilhado_nova_senha' : 'acesso_compartilhado_ativado', 'usuarios', id);
  res.json({ ativo: true, senha }); // exibida uma única vez
}));

module.exports = r;

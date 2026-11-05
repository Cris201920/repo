const { Router } = require('express');
const { db } = require('../db');
const A = require('../auth');
const { wrap, bad, txt, req_ } = require('../util');
const { firma } = require('../config');
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR } = require('../config');

const r = Router();

function logoUrl() {
  for (const f of ['logo.png', 'logo.svg', 'logo.webp', 'logo.jpg']) {
    if (fs.existsSync(path.join(PUBLIC_DIR, 'assets', f))) return '/assets/' + f;
  }
  return null;
}

// Informações públicas mínimas para a tela de login
r.get('/status', (req, res) => {
  const n = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
  res.json({ firma, logo: logoUrl(), precisaCriarAdmin: n === 0, usuario: A.carregarUsuario(req) });
});

// Primeiro acesso: cria o administrador (só funciona enquanto não existe nenhum usuário)
r.post('/setup', wrap(async (req, res) => {
  if (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n > 0) throw bad('O sistema já foi configurado.');
  const nome = req_(req.body.nome, 'nome', 120);
  const email = req_(req.body.email, 'e-mail', 160).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('E-mail inválido.');
  if (!A.senhaValida(req.body.senha)) throw bad(A.MSG_SENHA);
  const info = db.prepare("INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?,?,?, 'admin')")
    .run(nome, email, A.hashSenha(req.body.senha));
  req.usuario = { id: Number(info.lastInsertRowid), nome };
  A.auditar(req, 'setup', 'usuarios', req.usuario.id, 'Administrador criado');
  A.criarSessao(req, res, req.usuario.id);
  res.json({ ok: true });
}));

r.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');
  const chave = `${req.ip}|${email}`;
  const espera = A.limiteLogin(chave);
  if (espera) return res.status(429).json({ erro: `Muitas tentativas. Aguarde ${Math.ceil(espera / 60)} min.` });
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  // compara sempre, mesmo sem usuário, para não revelar se o e-mail existe
  const ok = u ? A.conferirSenha(senha, u.senha_hash) : (A.conferirSenha(senha, 'scrypt$00$00'), false);
  if (!ok || !u.ativo) {
    A.falhaLogin(chave);
    A.auditar({ ...req, usuario: null, ip: req.ip }, 'login_falhou', 'usuarios', u?.id, email);
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }
  A.sucessoLogin(chave);
  req.usuario = { id: u.id, nome: u.nome };
  A.criarSessao(req, res, u.id);
  A.auditar(req, 'login', 'usuarios', u.id);
  res.json({ ok: true });
}));

r.post('/logout', (req, res) => {
  const u = A.carregarUsuario(req);
  if (u) { req.usuario = u; A.auditar(req, 'logout', 'usuarios', u.id); }
  A.encerrarSessao(req, res);
  res.json({ ok: true });
});

r.post('/senha', A.exigirLogin, wrap(async (req, res) => {
  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!A.conferirSenha(String(req.body.atual || ''), u.senha_hash)) throw bad('Senha atual incorreta.');
  if (!A.senhaValida(req.body.nova)) throw bad(A.MSG_SENHA);
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(A.hashSenha(req.body.nova), u.id);
  A.encerrarSessoesDoUsuario(u.id, req.tokenAtual); // derruba os outros dispositivos
  A.auditar(req, 'senha_alterada', 'usuarios', u.id);
  res.json({ ok: true });
}));

module.exports = r;

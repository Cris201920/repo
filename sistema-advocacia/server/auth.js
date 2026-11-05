const crypto = require('crypto');
const { db } = require('./db');
const { COOKIE_SECURE } = require('./config');

const SESSAO_MS = 12 * 60 * 60 * 1000;
const COOKIE = 'sid';

// ---------- senhas ----------
function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(senha, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}
function conferirSenha(senha, armazenado) {
  const [alg, saltHex, hashHex] = String(armazenado).split('$');
  if (alg !== 'scrypt') return false;
  const h = crypto.scryptSync(senha, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const esperado = Buffer.from(hashHex, 'hex');
  return h.length === esperado.length && crypto.timingSafeEqual(h, esperado);
}
function senhaValida(s) {
  return typeof s === 'string' && s.length >= 10 && s.length <= 200 && /[A-Za-z]/.test(s) && /\d/.test(s);
}
const MSG_SENHA = 'A senha deve ter no mínimo 10 caracteres, com letras e números.';

// ---------- sessões ----------
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

function parseCookies(req) {
  const out = {};
  for (const p of (req.headers.cookie || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}
function criarSessao(req, res, usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessoes (token_hash, usuario_id, expira_em, ip, agente) VALUES (?,?,?,?,?)')
    .run(sha(token), usuarioId, Date.now() + SESSAO_MS, req.ip, String(req.headers['user-agent'] || '').slice(0, 200));
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: COOKIE_SECURE, maxAge: SESSAO_MS, path: '/' });
}
function encerrarSessao(req, res) {
  const t = parseCookies(req)[COOKIE];
  if (t) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(sha(t));
  res.clearCookie(COOKIE, { path: '/' });
}
function encerrarSessoesDoUsuario(id, exceto) {
  if (exceto) db.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND token_hash <> ?').run(id, sha(exceto));
  else db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id);
}

function carregarUsuario(req) {
  const t = parseCookies(req)[COOKIE];
  if (!t) return null;
  const h = sha(t);
  const s = db.prepare(`SELECT s.expira_em, u.id, u.nome, u.email, u.papel, u.ativo
    FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ?`).get(h);
  if (!s || s.expira_em < Date.now() || !s.ativo) {
    if (s) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(h);
    return null;
  }
  req.tokenAtual = t;
  return { id: s.id, nome: s.nome, email: s.email, papel: s.papel };
}

function exigirLogin(req, res, next) {
  const u = carregarUsuario(req);
  if (!u) return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
  req.usuario = u;
  next();
}
const exigirPapel = (...papeis) => (req, res, next) =>
  papeis.includes(req.usuario.papel) ? next() : res.status(403).json({ erro: 'Sem permissão para esta ação.' });

// Proteção CSRF adicional: requisições que alteram dados precisam do cabeçalho
// customizado (que formulários de outros sites não conseguem enviar) e, quando
// houver Origin, ele precisa ser do mesmo host.
function protegerCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ erro: 'Origem não permitida.' }); }
    catch { return res.status(403).json({ erro: 'Origem inválida.' }); }
  }
  if (req.headers['x-requested-with'] !== 'adv') return res.status(403).json({ erro: 'Requisição inválida.' });
  next();
}

// ---------- limite de tentativas de login ----------
const tentativas = new Map();
function limiteLogin(chave) {
  const agora = Date.now(), t = tentativas.get(chave);
  if (t && t.ate > agora && t.n >= 5) return Math.ceil((t.ate - agora) / 1000);
  return 0;
}
function falhaLogin(chave) {
  const agora = Date.now(); let t = tentativas.get(chave);
  if (!t || t.ate < agora) t = { n: 0, ate: agora + 15 * 60 * 1000 };
  t.n++; tentativas.set(chave, t);
}
const sucessoLogin = (chave) => tentativas.delete(chave);
setInterval(() => { const a = Date.now(); for (const [k, v] of tentativas) if (v.ate < a) tentativas.delete(k); }, 10 * 60 * 1000).unref();
setInterval(() => db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(Date.now()), 60 * 60 * 1000).unref();

// ---------- auditoria ----------
function auditar(req, acao, entidade, entidadeId, detalhe) {
  try {
    db.prepare('INSERT INTO auditoria (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhe, ip) VALUES (?,?,?,?,?,?,?)')
      .run(req.usuario?.id ?? null, req.usuario?.nome ?? null, acao, entidade ?? null, entidadeId ?? null, detalhe ? String(detalhe).slice(0, 500) : null, req.ip);
  } catch (e) { console.error('auditoria', e.message); }
}

module.exports = {
  hashSenha, conferirSenha, senhaValida, MSG_SENHA, criarSessao, encerrarSessao, encerrarSessoesDoUsuario,
  carregarUsuario, exigirLogin, exigirPapel, protegerCsrf, limiteLogin, falhaLogin, sucessoLogin, auditar, parseCookies, COOKIE,
};

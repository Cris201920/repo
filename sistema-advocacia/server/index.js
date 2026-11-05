const express = require('express');
const helmet = require('helmet');
const path = require('path');
const config = require('./config');
const A = require('./auth');
const { HttpError } = require('./util');

const app = express();
if (config.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], frameSrc: ["'self'"], objectSrc: ["'self'"],
      frameAncestors: ["'self'"], formAction: ["'self'"], baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: config.COOKIE_SECURE ? undefined : false,
}));
// Site privado: pede que buscadores não indexem nada
app.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow, noarchive'); next(); });
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));

app.get('/healthz', (req, res) => res.type('text/plain').send('ok'));
app.use(express.json({ limit: '1mb' }));
app.use('/api', A.protegerCsrf);
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ---- API ----
app.use('/api/auth', require('./routes/auth'));
const protegida = express.Router();
protegida.use(A.exigirLogin);
protegida.use('/documentos', require('./routes/documentos'));
protegida.use('/ia', require('./routes/ia'));
protegida.use('/admin', A.exigirPapel('admin'), require('./routes/admin'));
protegida.use('/', require('./routes/crm'));
app.use('/api', protegida);
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// ---- Arquivos estáticos (login, CSS, JS, logo). Dados só pela API autenticada. ----
app.use(express.static(config.PUBLIC_DIR, { index: 'index.html', maxAge: '1h' }));

// ---- Erros ----
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ erro: `Arquivo maior que ${Math.round(config.MAX_UPLOAD / 1048576)} MB.` });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Requisição inválida.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição grande demais.' });
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.name === 'MulterError') return res.status(400).json({ erro: 'Envio de arquivos inválido.' });
  console.error(err);
  res.status(err.status || 500).json({ erro: err.status && err.status < 500 ? err.message : (err.message?.startsWith('Não foi possível') || err.status === 503 ? err.message : 'Erro interno do servidor.') });
});

if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`${config.firma.nome} — sistema em http://localhost:${config.PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) console.warn('[aviso] ANTHROPIC_API_KEY não definida: o Assistente Jurídico ficará indisponível.');
  });
}
module.exports = app;

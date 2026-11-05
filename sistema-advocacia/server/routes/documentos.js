const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('../db');
const { DATA_DIR, MAX_UPLOAD } = require('../config');
const { cifrar, decifrar, sha256 } = require('../crypto');
const { extrairTexto, TIPOS, extensao } = require('../extrair');
const { auditar } = require('../auth');
const { wrap, bad, notFound, txt, id_, like } = require('../util');
const { zipSync } = require('fflate');
const { PDFDocument } = require('pdf-lib');

const r = Router();
const PASTA = path.join(DATA_DIR, 'uploads');
const CATEGORIAS = ['procuracao', 'contrato', 'peticao', 'decisao', 'identificacao', 'comprovante', 'prova', 'parecer', 'correspondencia', 'outros'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD, files: 20 } });

function vinculos(b) {
  const cliente_id = id_(b.cliente_id) || null;
  let processo_id = id_(b.processo_id) || null;
  const atendimento_id = id_(b.atendimento_id) || null;
  if (cliente_id && !db.prepare('SELECT 1 FROM clientes WHERE id = ?').get(cliente_id)) throw bad('Cliente inválido.');
  if (processo_id) {
    const p = db.prepare('SELECT cliente_id FROM processos WHERE id = ?').get(processo_id);
    if (!p) throw bad('Processo inválido.');
    if (cliente_id && p.cliente_id !== cliente_id) throw bad('O processo não pertence a este cliente.');
  }
  if (atendimento_id && !db.prepare('SELECT 1 FROM atendimentos WHERE id = ?').get(atendimento_id)) throw bad('Atendimento inválido.');
  return { cliente_id, processo_id, atendimento_id };
}

// grava o arquivo cifrado e registra no banco
async function salvarDocumento({ buf, nomeOriginal, titulo, categoria, vinc, usuarioId, origem = 'upload' }) {
  const ext = extensao(nomeOriginal);
  const arquivo = crypto.randomBytes(16).toString('hex') + '.bin';
  fs.writeFileSync(path.join(PASTA, arquivo), cifrar(buf), { mode: 0o600 });
  const texto = await extrairTexto(buf, ext);
  try {
    const info = db.prepare(`INSERT INTO documentos (cliente_id, processo_id, atendimento_id, titulo, categoria, nome_original, mime, tamanho, arquivo, sha256, texto, origem, usuario_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(vinc.cliente_id, vinc.processo_id, vinc.atendimento_id, titulo, categoria, nomeOriginal,
      TIPOS[ext], buf.length, arquivo, sha256(buf), texto || null, origem, usuarioId);
    return Number(info.lastInsertRowid);
  } catch (e) { fs.rmSync(path.join(PASTA, arquivo), { force: true }); throw e; }
}

r.get('/', (req, res) => {
  const where = ['1=1'], p = [];
  if (req.query.q) { const l = like(req.query.q); where.push("(d.titulo LIKE ? ESCAPE '\\' OR d.nome_original LIKE ? ESCAPE '\\' OR d.texto LIKE ? ESCAPE '\\' OR c.nome LIKE ? ESCAPE '\\')"); p.push(l, l, l, l); }
  if (req.query.categoria) { where.push('d.categoria = ?'); p.push(String(req.query.categoria)); }
  if (id_(req.query.cliente_id)) { where.push('d.cliente_id = ?'); p.push(id_(req.query.cliente_id)); }
  if (id_(req.query.processo_id)) { where.push('d.processo_id = ?'); p.push(id_(req.query.processo_id)); }
  res.json(db.prepare(`SELECT d.id, d.titulo, d.categoria, d.nome_original, d.mime, d.tamanho, d.origem, d.criado_em,
      d.cliente_id, d.processo_id, d.atendimento_id, c.nome AS cliente, p.titulo AS processo, u.nome AS enviado_por,
      (d.texto IS NOT NULL AND length(d.texto) > 0) AS tem_texto
    FROM documentos d LEFT JOIN clientes c ON c.id = d.cliente_id LEFT JOIN processos p ON p.id = d.processo_id
    LEFT JOIN usuarios u ON u.id = d.usuario_id WHERE ${where.join(' AND ')} ORDER BY d.id DESC LIMIT 500`).all(...p));
});

// Junta fotos/imagens (JPEG ou PNG) em um único PDF, uma página por imagem (como um scanner)
async function imagensParaPdf(files) {
  const pdf = await PDFDocument.create();
  for (const f of files) {
    const ext = extensao(f.originalname);
    const img = ['.jpg', '.jpeg'].includes(ext) ? await pdf.embedJpg(f.buffer) : ext === '.png' ? await pdf.embedPng(f.buffer) : null;
    if (!img) throw bad('Para juntar em PDF use imagens JPG ou PNG.');
    const paisagem = img.width > img.height;
    const [pw, ph] = paisagem ? [841.89, 595.28] : [595.28, 841.89];   // A4
    const esc = Math.min(pw / img.width, ph / img.height);
    const w = img.width * esc, h = img.height * esc;
    pdf.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return Buffer.from(await pdf.save());
}

r.post('/', upload.array('arquivos', 20), wrap(async (req, res) => {
  if (!req.files?.length) throw bad('Selecione ao menos um arquivo.');
  const categoria = CATEGORIAS.includes(req.body.categoria) ? req.body.categoria : 'outros';
  const vinc = vinculos(req.body);
  const titulo = txt(req.body.titulo, 200);
  const ids = [];
  if (req.body.juntar_pdf === '1') {
    const buf = await imagensParaPdf(req.files);
    const t = titulo || `Documento escaneado ${new Date().toLocaleDateString('pt-BR')}`;
    const nome = t.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 100) || 'Documento escaneado';
    const id = await salvarDocumento({ buf, nomeOriginal: `${nome}.pdf`, titulo: t, categoria, vinc, usuarioId: req.usuario.id, origem: 'scanner' });
    auditar(req, 'enviar', 'documentos', id, `${nome}.pdf (${req.files.length} páginas)`);
    return res.json({ ids: [id] });
  }
  for (const f of req.files) {
    const nome = Buffer.from(f.originalname, 'latin1').toString('utf8').replace(/[\\/\0]/g, '_').slice(0, 200);
    if (!TIPOS[extensao(nome)]) throw bad(`Tipo de arquivo não permitido: ${nome}`);
    const t = req.files.length === 1 && titulo ? titulo : (titulo ? `${titulo} — ${nome}` : path.basename(nome, extensao(nome)));
    const id = await salvarDocumento({ buf: f.buffer, nomeOriginal: nome, titulo: t, categoria, vinc, usuarioId: req.usuario.id });
    auditar(req, 'enviar', 'documentos', id, nome);
    ids.push(id);
  }
  res.json({ ids });
}));

r.put('/:id', (req, res) => {
  const id = id_(req.params.id);
  if (!db.prepare('SELECT 1 FROM documentos WHERE id = ?').get(id)) throw notFound('Documento');
  const vinc = vinculos(req.body);
  const titulo = txt(req.body.titulo, 200);
  if (!titulo) throw bad('Informe o título.');
  const categoria = CATEGORIAS.includes(req.body.categoria) ? req.body.categoria : 'outros';
  db.prepare('UPDATE documentos SET titulo=?, categoria=?, cliente_id=?, processo_id=?, atendimento_id=? WHERE id=?')
    .run(titulo, categoria, vinc.cliente_id, vinc.processo_id, vinc.atendimento_id, id);
  auditar(req, 'editar', 'documentos', id, titulo);
  res.json({ ok: true });
});

// Baixa vários documentos de uma vez (ZIP). Corpo: { ids: [1,2,3] }
const LIMITE_ZIP = 300 * 1024 * 1024;
r.post('/zip', wrap(async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(id_).filter(Boolean))].slice(0, 300);
  if (!ids.length) throw bad('Selecione ao menos um documento.');
  const docs = db.prepare(`SELECT id, titulo, nome_original, arquivo, tamanho FROM documentos WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids);
  if (!docs.length) throw notFound('Documento');
  if (docs.reduce((n, d) => n + d.tamanho, 0) > LIMITE_ZIP) throw bad('Os arquivos somam mais de 300 MB. Selecione menos documentos.');
  const arquivos = {}; const usados = new Set();
  for (const d of docs) {
    let nome = d.nome_original.replace(/[\\/:*?"<>|\0]/g, '_');
    while (usados.has(nome.toLowerCase())) { const e = extensao(nome); nome = `${path.basename(nome, e)} (${d.id})${e}`; }
    usados.add(nome.toLowerCase());
    arquivos[nome] = [decifrar(fs.readFileSync(path.join(PASTA, d.arquivo))), { level: 0 }];
  }
  auditar(req, 'baixar_zip', 'documentos', null, `${docs.length} arquivos`);
  res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="documentos-${new Date().toISOString().slice(0, 10)}.zip"`, 'Cache-Control': 'private, no-store' });
  res.send(Buffer.from(zipSync(arquivos)));
}));

r.get('/:id', (req, res) => {
  const d = db.prepare(`SELECT id, titulo, categoria, nome_original, mime, tamanho, cliente_id, processo_id, atendimento_id FROM documentos WHERE id = ?`).get(id_(req.params.id));
  if (!d) throw notFound('Documento');
  res.json(d);
});

r.get('/:id/arquivo', wrap(async (req, res) => {
  const id = id_(req.params.id);
  const d = db.prepare('SELECT * FROM documentos WHERE id = ?').get(id);
  if (!d) throw notFound('Documento');
  let buf;
  try { buf = decifrar(fs.readFileSync(path.join(PASTA, d.arquivo))); }
  catch { throw new Error('Não foi possível abrir o arquivo (chave de criptografia incorreta ou arquivo ausente).'); }
  const inline = req.query.inline === '1' && /^(application\/pdf|image\/)/.test(d.mime || '');
  auditar(req, inline ? 'visualizar' : 'baixar', 'documentos', id, d.nome_original);
  res.set({
    'Content-Type': d.mime || 'application/octet-stream',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.nome_original)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  if (!/pdf/.test(d.mime || '')) res.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src data:");
  res.send(buf);
}));

r.get('/:id/texto', (req, res) => {
  const d = db.prepare('SELECT id, titulo, texto FROM documentos WHERE id = ?').get(id_(req.params.id));
  if (!d) throw notFound('Documento');
  res.json({ id: d.id, titulo: d.titulo, texto: d.texto || '' });
});

r.delete('/:id', (req, res) => {
  if (req.usuario.papel === 'estagiario') return res.status(403).json({ erro: 'Sem permissão para excluir documentos.' });
  const id = id_(req.params.id);
  const d = db.prepare('SELECT arquivo, titulo FROM documentos WHERE id = ?').get(id);
  if (!d) throw notFound('Documento');
  db.prepare('DELETE FROM documentos WHERE id = ?').run(id);
  fs.rmSync(path.join(PASTA, d.arquivo), { force: true });
  auditar(req, 'excluir', 'documentos', id, d.titulo);
  res.json({ ok: true });
});

module.exports = r;
module.exports.salvarDocumento = salvarDocumento;
module.exports.vinculos = vinculos;
module.exports.CATEGORIAS = CATEGORIAS;

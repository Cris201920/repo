const { Router } = require('express');
const { db } = require('../db');
const ai = require('../ai');
const { auditar } = require('../auth');
const { gerarDocx } = require('../docx');
const { salvarDocumento, vinculos } = require('./documentos');
const { wrap, bad, notFound, txt, req_, id_ } = require('../util');

const r = Router();

function minhaConversa(req) {
  const c = db.prepare('SELECT * FROM conversas WHERE id = ? AND usuario_id = ?').get(id_(req.params.id), req.usuario.id);
  if (!c) throw notFound('Conversa');
  return c;
}
function lerContexto(b) {
  const cliente_id = id_(b.cliente_id) || null;
  const processo_id = id_(b.processo_id) || null;
  const docs = (Array.isArray(b.documentos_ids) ? b.documentos_ids : []).map(id_).filter(Boolean).slice(0, 15);
  return { cliente_id, processo_id, documentos_ids: JSON.stringify([...new Set(docs)]) };
}

r.get('/status', (req, res) => res.json({ configurado: ai.configurado(), modelo: ai.MODEL }));

r.get('/conversas', (req, res) => {
  res.json(db.prepare(`SELECT c.id, c.titulo, c.atualizado_em, cl.nome AS cliente FROM conversas c
    LEFT JOIN clientes cl ON cl.id = c.cliente_id WHERE c.usuario_id = ? ORDER BY c.atualizado_em DESC LIMIT 100`).all(req.usuario.id));
});

r.post('/conversas', (req, res) => {
  const ctx = lerContexto(req.body);
  const info = db.prepare('INSERT INTO conversas (usuario_id, titulo, cliente_id, processo_id, documentos_ids) VALUES (?,?,?,?,?)')
    .run(req.usuario.id, txt(req.body.titulo, 120) || 'Nova conversa', ctx.cliente_id, ctx.processo_id, ctx.documentos_ids);
  res.json({ id: Number(info.lastInsertRowid) });
});

r.get('/conversas/:id', (req, res) => {
  const c = minhaConversa(req);
  const ids = JSON.parse(c.documentos_ids || '[]');
  res.json({
    ...c, documentos_ids: ids,
    documentos: ids.length ? db.prepare(`SELECT id, titulo, nome_original FROM documentos WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) : [],
    mensagens: db.prepare('SELECT id, papel, conteudo, criado_em FROM mensagens WHERE conversa_id = ? ORDER BY id').all(c.id),
  });
});

r.put('/conversas/:id', (req, res) => {
  const c = minhaConversa(req);
  const ctx = lerContexto(req.body);
  db.prepare('UPDATE conversas SET cliente_id=?, processo_id=?, documentos_ids=? WHERE id=?').run(ctx.cliente_id, ctx.processo_id, ctx.documentos_ids, c.id);
  res.json({ ok: true });
});

r.delete('/conversas/:id', (req, res) => {
  const c = minhaConversa(req);
  db.prepare('DELETE FROM conversas WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

// Envia uma mensagem e devolve a resposta em streaming (Server-Sent Events)
r.post('/conversas/:id/mensagens', wrap(async (req, res) => {
  const conv = minhaConversa(req);
  const texto = req_(req.body.texto, 'mensagem', 30000);
  const client = ai.api(); // falha cedo (503) se não configurado

  const histRows = db.prepare('SELECT papel, conteudo FROM mensagens WHERE conversa_id = ? ORDER BY id DESC LIMIT 30').all(conv.id).reverse();
  const userMsgId = Number(db.prepare("INSERT INTO mensagens (conversa_id, papel, conteudo) VALUES (?, 'user', ?)").run(conv.id, texto).lastInsertRowid);
  if (conv.titulo === 'Nova conversa') db.prepare('UPDATE conversas SET titulo = ? WHERE id = ?').run(texto.replace(/\s+/g, ' ').slice(0, 70), conv.id);

  let montado;
  try { montado = ai.montarMensagens(conv, [...histRows, { papel: 'user', conteudo: texto }]); }
  catch (e) { db.prepare('DELETE FROM mensagens WHERE id = ?').run(userMsgId); throw e; }

  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const enviar = (o) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(o)}\n\n`); };
  if (montado.avisos.length) enviar({ t: 'aviso', v: montado.avisos.join(' ') });

  let acumulado = '';
  const stream = client.messages.stream({
    model: ai.MODEL, max_tokens: 16000,
    system: ai.promptSistema(ai.contextoDoCaso(conv)),
    messages: montado.msgs,
  });
  res.on('close', () => { if (!res.writableEnded) stream.abort(); });
  stream.on('text', (d) => { acumulado += d; enviar({ t: 'delta', v: d }); });

  try {
    await stream.finalMessage();
    const id = Number(db.prepare("INSERT INTO mensagens (conversa_id, papel, conteudo) VALUES (?, 'assistant', ?)").run(conv.id, acumulado || '(sem resposta)').lastInsertRowid);
    db.prepare("UPDATE conversas SET atualizado_em = datetime('now') WHERE id = ?").run(conv.id);
    auditar(req, 'consulta_ia', 'conversas', conv.id, `${texto.slice(0, 120)}`);
    enviar({ t: 'fim', id });
  } catch (e) {
    if (acumulado) db.prepare("INSERT INTO mensagens (conversa_id, papel, conteudo) VALUES (?, 'assistant', ?)").run(conv.id, acumulado + '\n\n_(resposta interrompida)_');
    else db.prepare('DELETE FROM mensagens WHERE id = ?').run(userMsgId);
    if (res.writableEnded || res.destroyed) return;
    console.error('IA:', e.status || '', e.message);
    enviar({ t: 'erro', v: ai.erroAmigavel(e) });
  }
  res.end();
}));

// Exporta uma resposta da IA como .docx (download) e, opcionalmente, salva no cadastro
r.post('/exportar-docx', wrap(async (req, res) => {
  const texto = req_(req.body.texto, 'texto', 200000);
  const titulo = txt(req.body.titulo, 150) || 'Minuta';
  const buf = await gerarDocx(texto, titulo);
  const nome = titulo.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 80).replace(/\s+/g, '_') || 'Minuta';
  if (req.body.salvar) {
    const vinc = vinculos(req.body);
    const id = await salvarDocumento({ buf, nomeOriginal: `${nome}.docx`, titulo, categoria: 'peticao', vinc, usuarioId: req.usuario.id, origem: 'ia' });
    auditar(req, 'salvar_minuta_ia', 'documentos', id, titulo);
    return res.json({ id });
  }
  auditar(req, 'exportar_docx', 'documentos', null, titulo);
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}.docx`,
  });
  res.send(buf);
}));

module.exports = r;

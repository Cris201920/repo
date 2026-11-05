const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Ambiente isolado + servidor "falso" da Anthropic (para testar o streaming sem chave real)
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-test-'));
process.env.ANTHROPIC_API_KEY = 'chave-de-teste';

let ultimoPedidoIA = null;
const fakeIA = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    ultimoPedidoIA = JSON.parse(b);
    const ev = (t, d) => `event: ${t}\ndata: ${JSON.stringify({ type: t, ...d })}\n\n`;
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(ev('message_start', { message: { id: 'm1', type: 'message', role: 'assistant', model: 'x', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } }));
    res.write(ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }));
    for (const p of ['# Resumo\n', 'Contrato de ', '**locação**. [PREENCHER: valor]']) res.write(ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: p } }));
    res.write(ev('content_block_stop', { index: 0 }));
    res.write(ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } }));
    res.end(ev('message_stop', {}));
  });
});

let base, srv, cookie = '';
const H = { 'X-Requested-With': 'adv', 'Content-Type': 'application/json' };
async function call(method, url, body, extra = {}) {
  const r = await fetch(base + url, { method, headers: { ...H, ...(cookie ? { cookie } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, data: ct.includes('json') ? await r.json() : null, r };
}

test.before(async () => {
  await new Promise((ok) => fakeIA.listen(0, ok));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fakeIA.address().port}`;
  const app = require('../server/index.js');
  srv = app.listen(0); await new Promise((ok) => srv.on('listening', ok));
  base = `http://127.0.0.1:${srv.address().port}`;
});
test.after(() => { srv.close(); fakeIA.close(); });

test('API exige login e bloqueia requisições sem cabeçalho CSRF', async () => {
  assert.equal((await call('GET', '/api/clientes')).status, 401);
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 403);
});

test('primeiro acesso cria admin e só funciona uma vez; senha fraca é recusada', async () => {
  const st = await call('GET', '/api/auth/status');
  assert.equal(st.data.precisaCriarAdmin, true);
  assert.equal((await call('POST', '/api/auth/setup', { nome: 'Dra. Teste', email: 'a@b.com', senha: 'curta1' })).status, 400);
  assert.equal((await call('POST', '/api/auth/setup', { nome: 'Dra. Teste', email: 'a@b.com', senha: 'SenhaForte123' })).status, 200);
  assert.equal((await call('POST', '/api/auth/setup', { nome: 'X', email: 'x@y.com', senha: 'SenhaForte123' })).status, 400);
  assert.equal((await call('GET', '/api/clientes')).status, 200);
});

test('login errado é recusado e limitado após várias tentativas', async () => {
  const saved = cookie; cookie = '';
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/auth/login', { email: 'a@b.com', senha: 'errada' + i })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: 'a@b.com', senha: 'SenhaForte123' })).status, 429);
  cookie = saved;
});

let cli, proc, at, doc;
test('cadastro de cliente, caso e atendimento', async () => {
  cli = (await call('POST', '/api/clientes', { nome: 'Maria da Silva', tipo: 'PF', documento: '123.456.789-00', email: 'm@x.com' })).data.id;
  assert.equal((await call('POST', '/api/clientes', { nome: '' })).status, 400);
  proc = (await call('POST', '/api/processos', { cliente_id: cli, titulo: 'Ação de despejo', area: 'Cível', valor_causa: 12000 })).data.id;
  at = (await call('POST', '/api/atendimentos', { cliente_id: cli, processo_id: proc, data_hora: '2026-11-05T10:00', assunto: 'Consulta inicial', resumo: 'Cliente relata atraso de aluguel.', prazo: '2026-11-10' })).data.id;
  assert.ok(cli && proc && at);
  // processo de outro cliente não pode ser vinculado
  const outro = (await call('POST', '/api/clientes', { nome: 'Outro' })).data.id;
  assert.equal((await call('POST', '/api/atendimentos', { cliente_id: outro, processo_id: proc, data_hora: '2026-11-05T10:00', assunto: 'x' })).status, 400);
  const painel = (await call('GET', '/api/painel')).data;
  assert.equal(painel.prazos.length, 1);
  assert.equal((await call('GET', '/api/busca?q=despejo')).data.processos.length, 1);
});

test('upload cifra o arquivo em disco, extrai texto e o download devolve o original', async () => {
  const conteudo = 'CONTRATO DE LOCAÇÃO\nLocador: João. Locatário: Maria. Aluguel de R$ 1.500,00.';
  const fd = new FormData();
  fd.append('arquivos', new Blob([conteudo]), 'contrato.txt');
  fd.append('cliente_id', cli); fd.append('processo_id', proc); fd.append('categoria', 'contrato');
  const r = await fetch(base + '/api/documentos', { method: 'POST', headers: { 'X-Requested-With': 'adv', cookie }, body: fd });
  assert.equal(r.status, 200); doc = (await r.json()).ids[0];
  const bin = fs.readdirSync(path.join(process.env.DATA_DIR, 'uploads'))[0];
  const bruto = fs.readFileSync(path.join(process.env.DATA_DIR, 'uploads', bin));
  assert.ok(!bruto.includes('LOCAÇÃO') && !bruto.includes('Locador'), 'arquivo em disco deve estar cifrado');
  const dl = await fetch(base + `/api/documentos/${doc}/arquivo`, { headers: { cookie } });
  assert.equal(await dl.text(), conteudo);
  assert.equal((await call('GET', '/api/documentos?q=Locatário')).data.length, 1, 'busca no texto do documento');
  // tipo proibido
  const fd2 = new FormData(); fd2.append('arquivos', new Blob(['<script>']), 'x.html');
  const r2 = await fetch(base + '/api/documentos', { method: 'POST', headers: { 'X-Requested-With': 'adv', cookie }, body: fd2 });
  assert.equal(r2.status, 400);
  // sem login não baixa
  assert.equal((await fetch(base + `/api/documentos/${doc}/arquivo`)).status, 401);
});

test('assistente de IA: streaming, contexto do caso e documento enviados, histórico salvo', async () => {
  const conv = (await call('POST', '/api/ia/conversas', { cliente_id: cli, processo_id: proc, documentos_ids: [doc] })).data.id;
  const r = await fetch(base + `/api/ia/conversas/${conv}/mensagens`, { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify({ texto: 'Resuma o contrato' }) });
  assert.equal(r.status, 200);
  const sse = await r.text();
  assert.match(sse, /"t":"delta"/); assert.match(sse, /"t":"fim"/); assert.doesNotMatch(sse, /"t":"erro"/);
  assert.match(ultimoPedidoIA.system, /Maria da Silva/);
  assert.match(ultimoPedidoIA.system, /Ação de despejo/);
  assert.match(ultimoPedidoIA.system, /atraso de aluguel/);
  const conteudo = JSON.stringify(ultimoPedidoIA.messages);
  assert.match(conteudo, /CONTRATO DE LOCAÇÃO/); assert.match(conteudo, /Resuma o contrato/);
  const hist = (await call('GET', `/api/ia/conversas/${conv}`)).data;
  assert.equal(hist.mensagens.length, 2);
  assert.match(hist.mensagens[1].conteudo, /locação/);
  // conversa é privada do usuário dono
  const docx = await call('POST', '/api/ia/exportar-docx', { texto: hist.mensagens[1].conteudo, titulo: 'Resumo', salvar: true, cliente_id: cli, processo_id: proc });
  assert.equal(docx.status, 200);
  const bruto = await fetch(base + `/api/documentos/${docx.data.id}/arquivo`, { headers: { cookie } });
  assert.equal((await bruto.arrayBuffer()).byteLength > 1000, true);
  assert.equal((await bruto.headers.get('content-type')).includes('wordprocessingml'), true);
});

test('perfis: estagiário não exclui; admin vê auditoria; não remove último admin', async () => {
  const novo = await call('POST', '/api/admin/usuarios', { nome: 'Estagiário', email: 'e@b.com', papel: 'estagiario', senha: 'OutraSenha456' });
  assert.equal(novo.status, 200);
  const adm = cookie; cookie = '';
  assert.equal((await call('POST', '/api/auth/login', { email: 'e@b.com', senha: 'OutraSenha456' })).status, 200);
  assert.equal((await call('DELETE', '/api/atendimentos/' + at)).status, 403);
  assert.equal((await call('DELETE', '/api/documentos/' + doc)).status, 403);
  assert.equal((await call('GET', '/api/admin/usuarios')).status, 403);
  cookie = adm;
  assert.ok((await call('GET', '/api/admin/auditoria')).data.length > 5);
  const me = (await call('GET', '/api/admin/usuarios')).data.find((u) => u.papel === 'admin');
  assert.equal((await call('PUT', '/api/admin/usuarios/' + me.id, { nome: me.nome, papel: 'advogado', ativo: true })).status, 400);
});

test('acesso por link e senha: ativar, entrar só com a senha, limites e desativar', async () => {
  const adm = cookie;
  assert.equal((await call('GET', '/api/auth/status')).data.acessoCompartilhado, false);
  const on = await call('POST', '/api/admin/acesso-compartilhado', { ativo: true });
  assert.match(on.data.senha, /^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
  assert.equal((await call('POST', '/api/admin/acesso-compartilhado', { ativo: true, senha: 'curta1' })).status, 400);
  // ele não aparece na lista de usuários
  assert.ok(!(await call('GET', '/api/admin/usuarios')).data.some((u) => u.email.includes('compartilhado')));
  cookie = '';
  assert.equal((await call('GET', '/api/auth/status')).data.acessoCompartilhado, true);
  assert.equal((await call('POST', '/api/auth/login', { email: '', senha: 'senha-errada-123' })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: '', senha: on.data.senha })).status, 200);
  assert.equal((await call('GET', '/api/clientes')).status, 200, 'acessa os dados');
  assert.equal((await call('GET', '/api/admin/usuarios')).status, 403, 'sem acesso à administração');
  assert.equal((await call('POST', '/api/auth/senha', { atual: on.data.senha, nova: 'NovaSenha12345' })).status, 400, 'não troca a senha por conta própria');
  const sessao = cookie;
  // admin gera nova senha: a sessão e a senha antigas deixam de valer
  cookie = adm;
  const nova = await call('POST', '/api/admin/acesso-compartilhado', { ativo: true });
  assert.notEqual(nova.data.senha, on.data.senha);
  cookie = sessao; assert.equal((await call('GET', '/api/clientes')).status, 401);
  cookie = ''; assert.equal((await call('POST', '/api/auth/login', { email: '', senha: on.data.senha })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { email: '', senha: nova.data.senha })).status, 200);
  // desativar bloqueia
  cookie = adm; await call('POST', '/api/admin/acesso-compartilhado', { ativo: false });
  cookie = ''; assert.equal((await call('POST', '/api/auth/login', { email: '', senha: nova.data.senha })).status, 401);
  assert.equal((await call('GET', '/api/auth/status')).data.acessoCompartilhado, false);
  cookie = adm;
});

test('escanear: fotos viram um único PDF; ZIP em lote devolve os arquivos originais', async () => {
  const { PDFDocument } = require('pdf-lib');
  // PNG 1x1 válido
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const fd = new FormData();
  fd.append('arquivos', new Blob([png], { type: 'image/png' }), 'p1.png'); fd.append('arquivos', new Blob([png], { type: 'image/png' }), 'p2.png');
  fd.append('juntar_pdf', '1'); fd.append('titulo', 'RG escaneado'); fd.append('cliente_id', cli); fd.append('categoria', 'identificacao');
  const r = await fetch(base + '/api/documentos', { method: 'POST', headers: { 'X-Requested-With': 'adv', cookie }, body: fd });
  assert.equal(r.status, 200); const id = (await r.json()).ids[0];
  const pdf = await PDFDocument.load(await (await fetch(base + `/api/documentos/${id}/arquivo`, { headers: { cookie } })).arrayBuffer());
  assert.equal(pdf.getPageCount(), 2);
  assert.equal((await call('GET', '/api/documentos?q=RG')).data.find((d) => d.id === id).origem, 'scanner');
  // ZIP
  const z = await fetch(base + '/api/documentos/zip', { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify({ ids: [doc, id] }) });
  assert.equal(z.status, 200); assert.equal(z.headers.get('content-type'), 'application/zip');
  const { unzipSync, strFromU8 } = require('fflate');
  const arq = unzipSync(new Uint8Array(await z.arrayBuffer()));
  assert.deepEqual(Object.keys(arq).sort(), ['RG escaneado.pdf', 'contrato.txt']);
  assert.match(strFromU8(arq['contrato.txt']), /CONTRATO DE LOCAÇÃO/);
  assert.equal((await call('POST', '/api/documentos/zip', { ids: [] })).status, 400);
  assert.equal((await fetch(base + '/api/documentos/zip', { method: 'POST', headers: H, body: '{"ids":[1]}' })).status, 401);
  // imagem não suportada para junção
  const fd2 = new FormData(); fd2.append('arquivos', new Blob(['x']), 'a.pdf'); fd2.append('juntar_pdf', '1');
  assert.equal((await fetch(base + '/api/documentos', { method: 'POST', headers: { 'X-Requested-With': 'adv', cookie }, body: fd2 })).status, 400);
});

test('arquivos estáticos públicos não expõem dados e o site não é indexável', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200); assert.match(r.headers.get('x-robots-tag'), /noindex/);
  assert.equal((await fetch(base + '/data/advocacia.db')).status === 404 || (await fetch(base + '/data/advocacia.db')).headers.get('content-type')?.includes('html'), true);
  assert.equal((await fetch(base + '/assets/logo.png')).status, 200);
  assert.equal((await fetch(base + '/healthz')).status, 200);
});

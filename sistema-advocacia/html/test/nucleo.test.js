// Testes do núcleo da versão HTML (criptografia, dados, API local) em Node, sem navegador.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { nucleo } = require('../lib/montar');

const RAIZ = path.join(__dirname, '..', '..');
const req = (m) => require(path.join(RAIZ, 'node_modules', m));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let pdfjs;
async function carregar() {
  pdfjs = pdfjs || await import(path.join(RAIZ, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
  const mammoth = req('mammoth');
  const mammothShim = { extractRawText: ({ arrayBuffer }) => mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) }) };
  const fn = new Function('FIRMA', 'PDFLib', 'fflate', 'pdfjsLib', 'mammoth', nucleo() + '\nreturn { Cofre, Dados, Docs, IA, LocalAPI, Arq, criarBackendLocal, Modelos, jsonTolerante };');
  return fn({ nome: 'Escritório Teste', assistenteNome: 'Assistente Jurídico' }, req('pdf-lib'), req('fflate'), pdfjs, mammothShim);
}
async function ambiente({ backend, master, meta, uid = 'u1', nome = 'Dra. Ana' } = {}) {
  const M = await carregar();
  const b = backend || M.criarBackendLocal({ memoria: true });
  if (!backend) await b.iniciar();
  let m = master;
  if (!m) { const c = await M.Cofre.criar('SenhaDeTeste123', 1000); m = c.master; meta = c.meta; }
  await M.Dados.abrir(m, b, uid);
  M.LocalAPI.definirUsuario({ id: uid, nome, papel: 'admin' });
  b.salvos = []; b.salvar = async (n, d) => { b.salvos.push({ nome: n, dados: d }); };
  const call = async (metodo, url, corpo) => { try { return { status: 200, data: await M.LocalAPI.handle(metodo, url, corpo) }; } catch (e) { return { status: e.status || 500, data: { erro: e.message } }; } };
  return { M, b, master: m, meta, call };
}
const arquivo = (nome, conteudo, tipo = 'text/plain') => new File([conteudo], nome, { type: tipo });
async function enviar(call, nome, conteudo, extra = {}, tipo) {
  const fd = new FormData(); fd.append('arquivos', arquivo(nome, conteudo, tipo));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return call('POST', '/documentos', fd);
}

test('cofre: senha certa abre, errada não; troca de senha mantém a chave; verificador da chave salva', async () => {
  const { Cofre } = await carregar();
  const { master, meta } = await Cofre.criar('FraseLongaSegura2026', 1000);
  assert.ok(await Cofre.abrir(meta, 'FraseLongaSegura2026')); assert.equal(await Cofre.abrir(meta, 'senha-errada-123'), null);
  const c = await Cofre.campo(master, { nome: 'Maria' }); assert.ok(!c.includes('Maria'));
  assert.deepEqual(await Cofre.lerCampo(await Cofre.abrir(meta, 'FraseLongaSegura2026'), c), { nome: 'Maria' });
  const meta2 = await Cofre.trocarSenha(master, 'OutraFraseNova9999', 1000);
  assert.equal(await Cofre.abrir(meta2, 'FraseLongaSegura2026'), null); const m2 = await Cofre.abrir(meta2, 'OutraFraseNova9999');
  assert.deepEqual(await Cofre.lerCampo(m2, c), { nome: 'Maria' }, 'a chave mestra é a mesma: dados antigos continuam abrindo');
  assert.ok(await Cofre.abrirComChaveSalva(meta, await Cofre.exportar(master))); assert.equal(await Cofre.abrirComChaveSalva(meta, Cofre.b64(new Uint8Array(32))), null);
  assert.ok(Cofre.avaliarSenha('curta1')); assert.ok(Cofre.avaliarSenha('somenteletrasaqui')); assert.equal(Cofre.avaliarSenha('Frase longa 2026 ok'), null);
});

test('o armazenamento só guarda texto cifrado (nada legível), e os dados voltam ao reabrir com a senha', async () => {
  const { call, b, M, master, meta } = await ambiente();
  const id = (await call('POST', '/clientes', { nome: 'Maria da Silva Sigilosa', documento: '123.456.789-00', telefone: '(54) 9999-1111' })).data.id;
  await call('POST', '/atendimentos', { cliente_id: id, data_hora: '2026-11-05T10:00', assunto: 'Assunto confidencial XYZ', resumo: 'Relato reservado do cliente' });
  await enviar(call, 'contrato.txt', 'CONTRATO SECRETO de locação entre as partes', { cliente_id: id });
  const bruto = JSON.stringify([await b.listar('clientes'), await b.listar('atendimentos'), await b.listar('documentos'), await b.listar('textos')]);
  for (const segredo of ['Maria da Silva', 'Sigilosa', '123.456.789', 'confidencial', 'reservado', 'CONTRATO SECRETO']) assert.ok(!bruto.includes(segredo), `não pode aparecer em claro: ${segredo}`);
  const arqs = await b.listar('documentos'); const idAsset = await M.Cofre.lerCampo(master, arqs[0].data.asset_id);
  assert.ok(!(await b.lerArquivo(idAsset)).includes('CONTRATO'), 'o arquivo guardado também está cifrado');
  // outro aparelho (mesmo armazenamento, mesma chave) lê tudo; chave errada não lê
  const outro = await ambiente({ backend: b, master, meta, uid: 'u2', nome: 'Bia' });
  assert.equal((await outro.call('GET', '/clientes')).data[0].nome, 'Maria da Silva Sigilosa');
  const errada = (await M.Cofre.criar('OutraSenhaQualquer1', 1000)).master;
  const intruso = await ambiente({ backend: b, master: errada, uid: 'u3' });
  assert.ok(!JSON.stringify((await intruso.call('GET', '/clientes')).data).includes('Maria'), 'chave errada não decifra nada');
});

test('cadastros: cliente, caso, atendimento, painel, busca e validações', async () => {
  const { call } = await ambiente();
  const c = (await call('POST', '/clientes', { nome: 'João Pereira', documento: '987.654.321-00', email: 'j@x.com' })).data.id;
  assert.equal((await call('POST', '/clientes', { nome: '' })).status, 400);
  const p = (await call('POST', '/processos', { cliente_id: c, titulo: 'Ação de cobrança', numero: '5009999-11.2026.8.21.0001', area: 'Cível', valor_causa: 5000 })).data.id;
  const at = (await call('POST', '/atendimentos', { cliente_id: c, processo_id: p, data_hora: '2026-11-05T09:00', assunto: 'Consulta', prazo: '2026-11-10' })).data.id;
  const outro = (await call('POST', '/clientes', { nome: 'Outro' })).data.id;
  assert.equal((await call('POST', '/atendimentos', { cliente_id: outro, processo_id: p, data_hora: '2026-11-05T09:00', assunto: 'x' })).status, 400, 'caso de outro cliente');
  const painel = (await call('GET', '/painel')).data;
  assert.equal(painel.prazos.length, 1); assert.equal(painel.totais.clientes, 2); assert.equal(painel.totais.processos, 1);
  assert.equal((await call('GET', '/busca?q=cobranca')).data.processos.length, 1, 'busca ignora acentos');
  assert.equal((await call('GET', '/clientes?q=pereira')).data[0].n_processos, 1);
  const det = (await call('GET', `/clientes/${c}`)).data; assert.equal(det.atendimentos.length, 1); assert.equal(det.versao, 1);
  assert.equal((await call('POST', `/atendimentos/${at}/concluir`, { concluido: true })).status, 200);
  assert.equal((await call('GET', '/painel')).data.prazos.length, 0);
});

test('edição simultânea: duas pessoas, aviso 409, nada é sobrescrito e as mudanças aparecem ao vivo no outro aparelho', async () => {
  const A = await ambiente();
  const B = await ambiente({ backend: A.b, master: A.master, meta: A.meta, uid: 'u2', nome: 'Bia' });
  const id = (await A.call('POST', '/clientes', { nome: 'Concorrência', telefone: '111', email: 'a@a.com' })).data.id;
  await new Promise((r) => setTimeout(r, 30));                                   // o aparelho B recebe pelo "tempo real"
  const formA = (await A.call('GET', `/clientes/${id}`)).data, formB = (await B.call('GET', `/clientes/${id}`)).data;
  assert.equal(formB.nome, 'Concorrência', 'B viu o que A criou');
  assert.equal((await A.call('PUT', `/clientes/${id}`, { ...formA, telefone: '999' })).status, 200);
  const rB = await B.call('PUT', `/clientes/${id}`, { ...formB, email: 'novo@b.com' });
  assert.equal(rB.status, 409); assert.match(rB.data.erro, /alterado por outra pessoa/);
  await new Promise((r) => setTimeout(r, 30));
  const atual = (await B.call('GET', `/clientes/${id}`)).data;
  assert.deepEqual([atual.telefone, atual.email, atual.versao], ['999', 'a@a.com', 2]);
  assert.equal((await B.call('PUT', `/clientes/${id}`, { ...atual, email: 'novo@b.com' })).status, 200);
  await new Promise((r) => setTimeout(r, 30));
  const fim = (await A.call('GET', `/clientes/${id}`)).data; assert.deepEqual([fim.telefone, fim.email, fim.versao], ['999', 'novo@b.com', 3]);
  const at = (await A.call('POST', '/atendimentos', { cliente_id: id, data_hora: '2026-11-05T10:00', assunto: 'X', prazo: '2026-12-01' })).data.id;
  const f1 = (await A.call('GET', `/atendimentos/${at}`)).data; await A.call('POST', `/atendimentos/${at}/concluir`, { concluido: true });
  assert.equal((await A.call('PUT', `/atendimentos/${at}`, { ...f1, resumo: 'x' })).status, 409);
});

test('documentos: envio cifrado, busca no texto, download idêntico, ZIP, escaneamento, exclusão', async () => {
  const { call, M, b } = await ambiente();
  const cli = (await call('POST', '/clientes', { nome: 'Doc Cliente' })).data.id;
  const r = await enviar(call, 'contrato.txt', 'CONTRATO DE LOCAÇÃO\nLocador: João. Locatário: Maria.', { cliente_id: cli, categoria: 'contrato' });
  assert.equal(r.status, 200); const id = r.data.ids[0];
  assert.equal((await call('GET', '/documentos?q=Locatário')).data.length, 1, 'busca dentro do texto');
  assert.equal((await call('GET', '/documentos?q=locatario')).data.length, 1, 'sem acento também');
  const { u8 } = await M.LocalAPI.bytesDoc(id); assert.equal(new TextDecoder().decode(u8), 'CONTRATO DE LOCAÇÃO\nLocador: João. Locatário: Maria.');
  assert.equal((await enviar(call, 'x.exe', 'zzz')).status, 400, 'tipo proibido');
  assert.equal((await call('POST', '/documentos', new FormData())).status, 400);
  // escanear: fotos viram um só PDF
  const fd = new FormData(); fd.append('arquivos', arquivo('p1.png', PNG, 'image/png')); fd.append('arquivos', arquivo('p2.png', PNG, 'image/png'));
  fd.append('juntar_pdf', '1'); fd.append('titulo', 'RG escaneado'); fd.append('cliente_id', cli);
  const sc = await call('POST', '/documentos', fd); assert.equal(sc.status, 200);
  const pdf = await M.Docs.carregarPdf((await M.LocalAPI.bytesDoc(sc.data.ids[0])).u8); assert.equal(pdf.getPageCount(), 2);
  assert.equal((await call('GET', '/documentos')).data.find((d) => d.id === sc.data.ids[0]).origem, 'scanner');
  // ZIP
  const z = await M.LocalAPI.blob('/documentos/zip', { ids: [id, sc.data.ids[0]] });
  const arq = req('fflate').unzipSync(new Uint8Array(await z.arrayBuffer())); assert.deepEqual(Object.keys(arq).sort(), ['RG escaneado.pdf', 'contrato.txt']);
  await assert.rejects(() => M.LocalAPI.blob('/documentos/zip', { ids: [] }));
  // download passa pela entrega da plataforma (ZIP para extensões não permitidas)
  await M.LocalAPI.baixarDoc(id); assert.equal(b.salvos[0].nome, 'contrato.txt');
  // exclusão limpa tudo
  assert.equal((await call('DELETE', `/documentos/${id}`)).status, 200); assert.equal((await call('GET', '/documentos')).data.some((d) => d.id === id), false);
});

test('pastas, observações e pendências (modelos, conferir, lote)', async () => {
  const { call } = await ambiente();
  const c1 = (await call('POST', '/clientes', { nome: 'Pastas Um' })).data.id, c2 = (await call('POST', '/clientes', { nome: 'Pastas Dois' })).data.id;
  const raiz = (await call('POST', '/pastas', { nome: 'Contratos', cliente_id: c1 })).data.id;
  const sub = (await call('POST', '/pastas', { nome: '2026', cliente_id: c1, parent_id: raiz })).data.id;
  assert.equal((await call('POST', '/pastas', { nome: 'contratos', cliente_id: c1 })).status, 400);
  assert.equal((await call('POST', '/pastas', { nome: 'x', cliente_id: c2, parent_id: raiz })).status, 400);
  assert.equal((await call('PUT', `/pastas/${raiz}`, { nome: 'Contratos', parent_id: sub })).status, 400, 'sem ciclos');
  const geral = (await call('POST', '/pastas', { nome: 'Modelos' })).data.id;
  assert.deepEqual((await call('GET', '/pastas?geral=1')).data.map((p) => p.nome), ['Modelos']);
  const d = (await enviar(call, 'c.txt', 'contrato x', { pasta_id: sub })).data.ids[0];
  assert.equal((await call('GET', `/documentos?pasta_id=${sub}`)).data[0].cliente_id, c1, 'pasta do cliente vincula o cliente');
  assert.equal((await call('POST', '/pastas/mover-docs', { ids: [d], pasta_id: geral })).status, 400);
  assert.equal((await call('POST', '/pastas/padrao', { cliente_id: c2 })).data.criadas, 6); assert.equal((await call('POST', '/pastas/padrao', { cliente_id: c2 })).data.criadas, 0);
  assert.equal((await call('DELETE', `/pastas/${raiz}`)).status, 200);
  assert.equal((await call('GET', '/documentos')).data.find((x) => x.id === d).pasta_id, null, 'documento preservado, sem pasta');
  // observações
  const n = (await call('POST', '/notas', { entidade: 'cliente', entidade_id: c1, texto: 'Prefere à tarde' })).data.id;
  await call('POST', '/notas', { entidade: 'cliente', entidade_id: c1, texto: 'Honorários em 3x', fixada: true });
  const notas = (await call('GET', `/notas?entidade=cliente&id=${c1}`)).data; assert.equal(notas[0].texto, 'Honorários em 3x');
  assert.equal((await call('POST', '/notas', { entidade: 'cliente', entidade_id: 999, texto: 'x' })).status, 404); assert.equal((await call('DELETE', `/notas/${n}`)).status, 200);
  // pendências
  const cl = (await call('POST', '/clientes', { nome: 'Checklist' })).data.id;
  assert.equal((await call('POST', '/pendencias/modelo', { cliente_id: cl, modelo: 'basico' })).data.criados, 7);
  assert.equal((await call('POST', '/pendencias/modelo', { cliente_id: cl, modelo: 'basico' })).data.criados, 0, 'não duplica');
  for (const [nome, titulo, cat] of [['a.txt', 'RG — Checklist', 'identificacao'], ['b.txt', 'Conta de energia (comprovante de residência)', 'comprovante'], ['c.txt', 'Foto da fachada', 'prova']]) {
    const id = (await enviar(call, nome, titulo, { cliente_id: cl, categoria: cat, titulo })).data.ids[0]; assert.ok(id);
  }
  const conf = (await call('POST', '/pendencias/conferir', { cliente_id: cl })).data;
  assert.deepEqual(conf.propostas.map((x) => x.pendencia).sort(), ['Comprovante de residência', 'RG ou CNH']);
  await call('POST', '/pendencias/lote', { itens: conf.propostas.map((x) => ({ id: x.pendencia_id, status: 'ok', documento_id: x.documento_id })) });
  const todas = (await call('GET', `/pendencias?cliente_id=${cl}`)).data;
  assert.equal(todas.filter((x) => x.status === 'ok').length, 2); assert.ok(todas.find((x) => x.titulo === 'RG ou CNH').documento);
  assert.equal((await call('GET', '/painel')).data.pendencias.abertas, 5);
});

test('organizar com IA: vínculo por CPF/processo/nome, sem enviar a lista de clientes; separar PDF; lacunas', async () => {
  const { call, M, b } = await ambiente();
  const cli = (await call('POST', '/clientes', { nome: 'Maria da Silva', documento: '123.456.789-00' })).data.id;
  await call('POST', '/clientes', { nome: 'Zé Reservado Sigiloso', documento: '999.888.777-66' });
  const p2 = (await call('POST', '/processos', { cliente_id: cli, titulo: 'Execução', numero: '5001234-56.2026.8.21.0001' })).data.id;
  const seg = (o) => ({ pagina_inicial: 1, pagina_final: 1, categoria: 'outros', titulo: 'Doc', resumo: 'r', partes: [], ...o });
  let ultimo = null, resposta = { documentos: [] };
  b.iaSimulada = async (entrada, opcoes) => { ultimo = { entrada, opcoes }; return { text: JSON.stringify(resposta), truncated: false }; };
  const id = (await enviar(call, 'scan001.txt', 'PROCURAÇÃO\nOutorgante: Maria da Silva, CPF 123.456.789-00')).data.ids[0];
  resposta = { documentos: [seg({ categoria: 'procuracao', titulo: 'Procuração — Maria', data_documento: '2026-03-12', tags: ['locação'], partes: [{ nome: 'Maria da Silva', documento: '123.456.789-00' }] })] };
  const r = (await call('POST', `/documentos/${id}/organizar`)).data;
  assert.equal(r.segmentos[0].vinculo.cliente_id, cli); assert.equal(r.segmentos[0].vinculo.confianca, 'alta');
  assert.ok(String(ultimo.entrada).includes('PROCURAÇÃO') && !String(ultimo.entrada).includes('Zé Reservado') && !String(ultimo.entrada).includes('999.888'), 'a lista de clientes não vai para a IA');
  resposta = { documentos: [seg({ categoria: 'decisao', numero_processo: '50012345620268210001' })] };
  const v = (await call('POST', `/documentos/${id}/organizar`)).data.segmentos[0].vinculo; assert.equal(v.processo_id, p2); assert.equal(v.confianca, 'alta');
  resposta = { documentos: [seg({ partes: [{ nome: 'MARIA DA SILVA' }] })] };
  assert.equal((await call('POST', `/documentos/${id}/organizar`)).data.segmentos[0].vinculo.confianca, 'media');
  const ap = await call('POST', `/documentos/${id}/organizar/aplicar`, { segmentos: [{ titulo: 'Procuração — Maria', categoria: 'procuracao', cliente_id: cli, processo_id: p2, resumo: 'Outorga poderes', data_documento: '2026-03-12', tags: ['locação', 'despejo'] }] });
  assert.equal(ap.status, 200);
  const d = (await call('GET', '/documentos?q=outorga')).data.find((x) => x.id === id);
  assert.deepEqual([d.titulo, d.categoria, d.cliente_id, d.processo_id, d.tags, d.ia_status], ['Procuração — Maria', 'procuracao', cli, p2, 'locação, despejo', 'aplicado']);
  await call('POST', '/pastas/padrao', { cliente_id: cli });
  // PDF com 3 páginas de texto: a IA só devolve as páginas 1 e 3 -> a 2 vira "não identificada"
  const PDFLib = req('pdf-lib'), src = await PDFLib.PDFDocument.create(), fonte = await src.embedFont(PDFLib.StandardFonts.Helvetica);
  ['CARTEIRA DE IDENTIDADE Maria da Silva CPF 123.456.789-00 registro geral expedido pela SSP', 'CADASTRO DE PESSOA FISICA CPF Maria da Silva situacao cadastral regular receita federal', 'COMPROVANTE DE RESIDENCIA conta de energia titular Maria da Silva endereco Rua das Flores 100'].forEach((t) => src.addPage([600, 400]).drawText(t, { x: 20, y: 300, size: 9, font: fonte }));
  const pdfId = (await enviar(call, 'tudo.pdf', Buffer.from(await src.save()), {}, 'application/pdf')).data.ids[0];
  resposta = { documentos: [seg({ pagina_inicial: 1, pagina_final: 1, categoria: 'identificacao', titulo: 'RG — Maria' }), seg({ pagina_inicial: 3, pagina_final: 3, categoria: 'comprovante', titulo: 'Comprovante — Maria' })] };
  const s = (await call('POST', `/documentos/${pdfId}/organizar`)).data;
  assert.deepEqual(s.segmentos.map((x) => [x.pagina_inicial, x.pagina_final]), [[1, 1], [2, 2], [3, 3]]); assert.match(s.segmentos[1].titulo, /não identificada/);
  assert.ok(String(ultimo.entrada).includes('=== Página 3 ==='), 'a IA recebe o texto com marcadores de página');
  const sep = await call('POST', `/documentos/${pdfId}/organizar/aplicar`, { remover_original: true, segmentos: [
    { pagina_inicial: 1, pagina_final: 2, titulo: 'RG e CPF — Maria', categoria: 'identificacao', cliente_id: cli }, { pagina_inicial: 3, pagina_final: 3, titulo: 'Comprovante', categoria: 'comprovante', cliente_id: cli }] });
  assert.equal(sep.status, 200); assert.equal(sep.data.removido, true);
  assert.equal((await M.Docs.carregarPdf((await M.LocalAPI.bytesDoc(sep.data.ids[0])).u8)).getPageCount(), 2);
  const lista = (await call('GET', '/documentos')).data;
  assert.equal(lista.find((x) => x.id === sep.data.ids[0]).pasta, 'Identificação', 'foi para a pasta do tipo'); assert.equal(lista.some((x) => x.id === pdfId), false, 'original removido');
  assert.equal((await call('POST', `/documentos/${id}/organizar/aplicar`, { segmentos: [{ pagina_inicial: 1, pagina_final: 2, titulo: 'A' }, { pagina_inicial: 2, pagina_final: 3, titulo: 'B' }] })).status, 400, 'só PDF separa');
});

test('assistente: contexto do caso e documento chegam à IA, conversa é guardada e cortada quando cresce; Word gerado é válido', async () => {
  const { call, M, b } = await ambiente();
  const cli = (await call('POST', '/clientes', { nome: 'Cliente IA', documento: '111.222.333-44' })).data.id;
  const proc = (await call('POST', '/processos', { cliente_id: cli, titulo: 'Ação de despejo', area: 'Cível' })).data.id;
  await call('POST', '/atendimentos', { cliente_id: cli, processo_id: proc, data_hora: '2026-11-05T10:00', assunto: 'Consulta inicial', resumo: 'atraso de aluguel de três meses' });
  const doc = (await enviar(call, 'contrato.txt', 'CONTRATO DE LOCAÇÃO valor R$ 1.500,00', { cliente_id: cli })).data.ids[0];
  let visto = null; b.iaSimulada = async (entrada, opcoes) => { visto = { entrada, opcoes }; opcoes.onText && opcoes.onText({ text: '## Resumo\nOk', delta: '## Resumo\nOk' }); return { text: '## Resumo\nContrato de **locação**. [PREENCHER: valor]', truncated: false }; };
  const conv = (await call('POST', '/ia/conversas', { cliente_id: cli, processo_id: proc, documentos_ids: [doc] })).data.id;
  const parcial = []; const r = await M.LocalAPI.enviarMensagem(conv, 'Resuma o contrato', { onText: (u) => parcial.push(u.text) });
  assert.match(r.texto, /locação/); assert.ok(parcial.length >= 1);
  const turnos = visto.entrada; assert.equal(turnos[0].role, 'user'); assert.equal(turnos[turnos.length - 1].role, 'user');
  const tudo = turnos.map((t) => t.content).join('\n');
  for (const trecho of ['Cliente IA', 'Ação de despejo', 'atraso de aluguel', 'CONTRATO DE LOCAÇÃO', 'Resuma o contrato', 'Regras de ouro']) assert.ok(tudo.includes(trecho), `a IA deve receber: ${trecho}`);
  assert.equal(visto.opcoes.cache, false);
  const hist = (await call('GET', `/ia/conversas/${conv}`)).data; assert.equal(hist.mensagens.length, 2); assert.equal(hist.titulo, 'Resuma o contrato'); assert.equal(hist.documentos[0].id, doc);
  // conversa longa: o histórico antigo é descartado para caber no limite de cada registro
  b.iaSimulada = async () => ({ text: 'x'.repeat(30000), truncated: false });
  for (let i = 0; i < 6; i++) await M.LocalAPI.enviarMensagem(conv, 'pergunta ' + i, {});
  const longa = (await call('GET', `/ia/conversas/${conv}`)).data; assert.ok(JSON.stringify(longa.mensagens).length <= 130000, 'cabe no limite do registro'); assert.equal(longa.mensagens.at(-1).conteudo.length, 30000);
  // interrupção guarda a resposta parcial
  b.iaSimulada = async () => { const e = new Error('c'); e.code = 'cancelled'; e.text = 'parte da resposta'; throw e; };
  await assert.rejects(() => M.LocalAPI.enviarMensagem(conv, 'interrompe', {}), (e) => e.code === 'cancelled');
  assert.match((await call('GET', `/ia/conversas/${conv}`)).data.mensagens.at(-1).conteudo, /parte da resposta[\s\S]*interrompida/);
  // Word
  const docx = await M.LocalAPI.blob('/ia/exportar-docx', { texto: '# PETIÇÃO\n\nTexto com **negrito** e [PREENCHER: valor].\n\n- item um\n- item dois\n\n1. primeiro\n\n> citação' });
  const zip = req('fflate').unzipSync(new Uint8Array(await docx.arrayBuffer())); assert.ok(zip['word/document.xml'] && zip['[Content_Types].xml']);
  const texto = (await req('mammoth').extractRawText({ buffer: Buffer.from(await docx.arrayBuffer()) })).value; assert.match(texto, /PETIÇÃO/); assert.match(texto, /negrito/); assert.match(texto, /item um/);
  const salvo = await call('POST', '/ia/exportar-docx', { texto: '# Minuta\n\nTexto.', titulo: 'Minuta de teste', salvar: true, cliente_id: cli, processo_id: proc });
  assert.equal(salvo.status, 200); assert.equal((await call('GET', `/documentos?cliente_id=${cli}`)).data.find((d) => d.id === salvo.data.id).origem, 'ia');
});

test('conversas são privadas de cada pessoa; senha do escritório pode ser trocada; auditoria registra as ações', async () => {
  const A = await ambiente();
  const B = await ambiente({ backend: A.b, master: A.master, meta: A.meta, uid: 'u2', nome: 'Bia' });
  await A.call('POST', '/ia/conversas', { titulo: 'Conversa da Ana' });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal((await A.call('GET', '/ia/conversas')).data.length, 1); assert.equal((await B.call('GET', '/ia/conversas')).data.length, 0, 'conversa de A não aparece para B');
  await A.b.definir('config', 'seguranca', A.meta);
  assert.equal((await A.call('POST', '/auth/senha', { atual: 'errada-123456', nova: 'NovaSenhaSegura2026' })).status, 400);
  assert.equal((await A.call('POST', '/auth/senha', { atual: 'SenhaDeTeste123', nova: 'curta' })).status, 400);
  assert.equal((await A.call('POST', '/auth/senha', { atual: 'SenhaDeTeste123', nova: 'NovaSenhaSegura2026' })).status, 200);
  const nova = await A.b.obter('config', 'seguranca'); assert.equal(await A.M.Cofre.abrir(nova, 'SenhaDeTeste123'), null); assert.ok(await A.M.Cofre.abrir(nova, 'NovaSenhaSegura2026'));
  const aud = (await A.call('GET', '/admin/auditoria')).data; assert.ok(aud.length >= 1 && aud.some((x) => x.acao === 'senha_alterada' && x.usuario_nome === 'Dra. Ana'));
});

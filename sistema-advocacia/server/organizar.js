// Organização de documentos por IA:
//  1) a IA lê o arquivo e devolve tipo, título, resumo, data, partes citadas e nº de processo
//     (e, em PDFs com vários documentos juntos, em quais páginas cada um está);
//  2) o servidor cruza esses dados com os clientes/casos JÁ cadastrados, localmente —
//     a lista de clientes nunca é enviada ao provedor de IA.
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { db } = require('./db');
const ai = require('./ai');
const { MODEL_ORGANIZAR, DATA_DIR } = require('./config');
const { decifrar } = require('./crypto');
const { extensao, paginasPdf } = require('./extrair');
const { HttpError } = require('./util');

const PASTA = path.join(DATA_DIR, 'uploads');
const CATEGORIAS = ['procuracao', 'contrato', 'peticao', 'decisao', 'identificacao', 'comprovante', 'prova', 'parecer', 'correspondencia', 'outros'];
const MAX_PDF_NATIVO = 20 * 1024 * 1024;
const MAX_PAGINAS_NATIVO = 100;

const FERRAMENTA = {
  name: 'organizar_documento',
  description: 'Registra a classificação do arquivo analisado.',
  input_schema: {
    type: 'object',
    properties: {
      documentos: {
        type: 'array',
        description: 'Um item para cada documento distinto contido no arquivo, na ordem das páginas. Se o arquivo é um documento só, devolva um único item.',
        items: {
          type: 'object',
          properties: {
            pagina_inicial: { type: 'integer', description: 'Primeira página deste documento (começa em 1).' },
            pagina_final: { type: 'integer', description: 'Última página deste documento.' },
            categoria: { type: 'string', enum: CATEGORIAS },
            titulo: { type: 'string', description: 'Título curto e descritivo. Ex.: "Procuração ad judicia — Maria da Silva", "RG — João Pereira", "Sentença — Ação de despejo".' },
            resumo: { type: 'string', description: 'Uma a duas frases objetivas sobre o conteúdo.' },
            data_documento: { type: 'string', description: 'Data do documento no formato AAAA-MM-DD, somente se constar no texto; senão, vazio.' },
            partes: {
              type: 'array', description: 'Pessoas e empresas citadas como partes/titulares (autor, réu, outorgante, contratante, titular do documento…).',
              items: { type: 'object', properties: { nome: { type: 'string' }, documento: { type: 'string', description: 'CPF ou CNPJ exatamente como consta, se houver.' }, papel: { type: 'string' } }, required: ['nome'] },
            },
            numero_processo: { type: 'string', description: 'Número do processo judicial (padrão CNJ) se constar.' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Até 5 palavras-chave curtas (ex.: "locação", "despejo", "pensão alimentícia").' },
          },
          required: ['pagina_inicial', 'pagina_final', 'categoria', 'titulo', 'resumo'],
        },
      },
    },
    required: ['documentos'],
  },
};

const SISTEMA = `Você organiza o arquivo digital de um escritório de advocacia brasileiro. Receberá um arquivo (texto, PDF ou imagem) e deve classificá-lo chamando a ferramenta "organizar_documento".

Categorias:
- procuracao: procurações, substabelecimentos, declarações de hipossuficiência
- contrato: contratos, aditivos, termos, acordos, contrato de honorários
- peticao: petições, recursos, contestações, minutas e demais peças
- decisao: sentenças, acórdãos, despachos, decisões, intimações, certidões de andamento
- identificacao: RG, CPF, CNH, certidões civis, título de eleitor, documentos pessoais
- comprovante: comprovantes de residência, pagamento, renda, extratos, boletos, notas fiscais
- prova: fotos, prints, laudos, atas, gravações e demais provas
- parecer: pareceres, memorandos, estudos e análises
- correspondencia: e-mails, cartas, notificações extrajudiciais, mensagens
- outros: o que não se encaixar

Regras:
1. Use SOMENTE o que está no arquivo. Não invente nomes, datas, CPF/CNPJ ou números de processo; deixe vazio quando não constar.
2. Se um PDF reúne documentos diferentes (ex.: RG, CPF e comprovante digitalizados juntos), devolva um item por documento com suas páginas. Só separe quando for claramente outro documento; uma peça de várias páginas é UM documento. Cubra todas as páginas, sem sobreposição.
3. "partes" deve listar quem é parte/titular do documento (ex.: o dono do RG; o autor e o réu de uma ação; o outorgante de uma procuração), com CPF/CNPJ quando constar.
4. Título em português, curto, no formato "Tipo — Pessoa/assunto".
5. Se o conteúdo estiver ilegível ou não houver conteúdo, classifique pelo nome do arquivo como "outros" e diga isso no resumo.`;

// ---------- leitura do arquivo para a IA ----------
async function contarPaginas(buf) {
  return (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount();
}

async function prepararConteudo(d, buf) {
  const ext = extensao(d.nome_original);
  const blocos = [];
  let paginas = 1;
  if (ext === '.pdf') {
    let textos = [];
    try { textos = await paginasPdf(buf); } catch { /* PDF sem texto legível: segue para leitura visual */ }
    paginas = textos.total || textos.length || (await contarPaginas(buf));
    if (textos.join('').trim().length > 200) {
      let total = 0;
      const partes = [];
      for (let i = 0; i < textos.length && total < 150_000; i++) {
        const t = textos[i].slice(0, 2500) || '[página sem texto]';
        total += t.length; partes.push(`=== Página ${i + 1} ===\n${t}`);
      }
      blocos.push({ type: 'text', text: partes.join('\n\n') });
    } else if (d.tamanho <= MAX_PDF_NATIVO && paginas <= MAX_PAGINAS_NATIVO) {
      blocos.push({ type: 'document', title: d.nome_original, source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } });
    } else {
      throw new HttpError(400, `PDF escaneado grande demais para a IA analisar (máx. ${MAX_PAGINAS_NATIVO} páginas e 20 MB).`);
    }
  } else if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) && d.tamanho <= 5 * 1024 * 1024) {
    blocos.push({ type: 'image', source: { type: 'base64', media_type: d.mime, data: buf.toString('base64') } });
  } else if (d.texto) {
    blocos.push({ type: 'text', text: d.texto.slice(0, 30_000) });
  }
  return { blocos, paginas, ehPdf: ext === '.pdf' };
}

// ---------- normalização do que a IA devolveu ----------
const limpar = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
function dataValida(v) {
  const s = limpar(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : null;
}
function segmento(s, pi, pf) {
  return {
    pagina_inicial: pi, pagina_final: pf,
    categoria: CATEGORIAS.includes(s.categoria) ? s.categoria : 'outros',
    titulo: limpar(s.titulo, 160) || 'Documento sem título',
    resumo: limpar(s.resumo, 500),
    data_documento: dataValida(s.data_documento),
    tags: (Array.isArray(s.tags) ? s.tags : []).map((t) => limpar(t, 30)).filter(Boolean).slice(0, 6),
    partes: (Array.isArray(s.partes) ? s.partes : []).slice(0, 8).map((p) => ({ nome: limpar(p?.nome, 160), documento: limpar(p?.documento, 30), papel: limpar(p?.papel, 40) })).filter((p) => p.nome),
    numero_processo: limpar(s.numero_processo, 40),
  };
}
function normalizarSegmentos(brutos, n, ehPdf) {
  const lista = (Array.isArray(brutos) ? brutos : []).slice(0, 30);
  if (!ehPdf || n <= 1 || lista.length <= 1) return [segmento(lista[0] || {}, 1, Math.max(n, 1))];
  const ordenados = lista
    .map((s) => ({ s, pi: Math.max(1, Math.min(n, parseInt(s.pagina_inicial, 10) || 1)), pf: Math.max(1, Math.min(n, parseInt(s.pagina_final, 10) || n)) }))
    .filter((x) => x.pi <= x.pf).sort((a, b) => a.pi - b.pi);
  const lacuna = (a, b) => segmento({ categoria: 'outros', titulo: a === b ? `Página ${a} (não identificada)` : `Páginas ${a}–${b} (não identificadas)`, resumo: '' }, a, b);
  const out = []; let prox = 1;
  for (const { s, pi, pf } of ordenados) {
    if (pf < prox) continue;
    const ini = Math.max(pi, prox);
    if (ini > prox) out.push(lacuna(prox, ini - 1));
    out.push(segmento(s, ini, pf)); prox = pf + 1;
  }
  if (prox <= n) out.push(lacuna(prox, n));
  return out.length ? out : [segmento(lista[0] || {}, 1, n)];
}

// ---------- cruzamento com clientes e casos cadastrados (local) ----------
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const tokens = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t));

function vincular(seg) {
  const clientes = db.prepare('SELECT id, nome, documento FROM clientes WHERE ativo = 1').all();
  const processos = db.prepare('SELECT id, cliente_id, titulo, numero FROM processos').all();
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const res = { cliente_id: null, processo_id: null, confianca: null, motivo: '', candidatos: [] };
  const nomeCliente = (id) => porId.get(id)?.nome || db.prepare('SELECT nome FROM clientes WHERE id = ?').get(id)?.nome || '';

  // 1) número do processo (CNJ) — vínculo forte
  const num = soDigitos(seg.numero_processo);
  if (num.length >= 15) {
    const p = processos.find((x) => soDigitos(x.numero) === num);
    if (p) return { ...res, cliente_id: p.cliente_id, processo_id: p.id, confianca: 'alta', motivo: `Número do processo ${seg.numero_processo} é do caso “${p.titulo}”.`, candidatos: [{ id: p.cliente_id, nome: nomeCliente(p.cliente_id) }] };
  }
  // 2) CPF/CNPJ das partes — vínculo forte
  const docsPartes = seg.partes.map((p) => soDigitos(p.documento)).filter((d) => d.length === 11 || d.length === 14);
  for (const dg of docsPartes) {
    const c = clientes.find((x) => soDigitos(x.documento) === dg);
    if (c) return { ...res, cliente_id: c.id, confianca: 'alta', motivo: `CPF/CNPJ ${seg.partes.find((p) => soDigitos(p.documento) === dg).documento} confere com o cadastro.`, candidatos: [{ id: c.id, nome: c.nome }] };
  }
  // 3) nome — vínculo menos seguro
  const achados = [];
  for (const c of clientes) {
    const tc = tokens(c.nome);
    if (tc.length < 2) continue;
    let melhor = null;
    for (const p of seg.partes) {
      const tp = tokens(p.nome);
      if (tp.length < 2) continue;
      const a = new Set(tc), b = new Set(tp);
      const iguais = tc.length === tp.length && tc.every((t) => b.has(t));
      const contido = tc.every((t) => b.has(t)) || tp.every((t) => a.has(t));
      const nivel = iguais ? 'media' : contido ? 'baixa' : null;
      if (nivel && (!melhor || (nivel === 'media' && melhor.nivel === 'baixa'))) melhor = { nivel, nome: p.nome };
    }
    if (melhor) achados.push({ c, ...melhor });
  }
  achados.sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'media' ? -1 : 1));
  res.candidatos = achados.slice(0, 4).map((x) => ({ id: x.c.id, nome: x.c.nome }));
  if (achados.length) {
    const top = achados[0];
    const unico = achados.filter((x) => x.nivel === top.nivel).length === 1;
    if (unico) { res.cliente_id = top.c.id; res.confianca = top.nivel; res.motivo = `Nome “${top.nome}” ${top.nivel === 'media' ? 'coincide com' : 'parece com'} o cliente cadastrado. Confira.`; }
    else res.motivo = 'Há mais de um cliente com nome parecido — escolha o correto.';
  }
  return res;
}

// ---------- análise completa de um documento ----------
async function analisar(d) {
  const buf = decifrar(fs.readFileSync(path.join(PASTA, d.arquivo)));
  const { blocos, paginas, ehPdf } = await prepararConteudo(d, buf);
  const cliente = ai.api();
  const nota = blocos.length ? '' : ' (o conteúdo deste formato não pode ser lido; classifique apenas pelo nome do arquivo)';
  const r = await cliente.messages.create({
    model: MODEL_ORGANIZAR, max_tokens: 4000, system: SISTEMA,
    tools: [FERRAMENTA], tool_choice: { type: 'tool', name: FERRAMENTA.name },
    messages: [{ role: 'user', content: [...blocos, { type: 'text', text: `Arquivo: "${d.nome_original}" — ${paginas} página(s)${nota}. Classifique chamando a ferramenta.` }] }],
  });
  const uso = r.content?.find((b) => b.type === 'tool_use');
  if (!uso) throw new Error('A IA não devolveu a classificação deste arquivo. Tente novamente.');
  const segmentos = normalizarSegmentos(uso.input?.documentos, paginas, ehPdf).map((s) => ({ ...s, vinculo: vincular(s) }));
  const dup = db.prepare('SELECT id, titulo FROM documentos WHERE sha256 = ? AND id <> ? ORDER BY id LIMIT 1').get(d.sha256, d.id);
  return { paginas, segmentos, duplicado: dup || null, geradoEm: new Date().toISOString() };
}

module.exports = { analisar, vincular, normalizarSegmentos, CATEGORIAS };

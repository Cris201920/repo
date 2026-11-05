const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { db } = require('./db');
const { firma, MODEL, DATA_DIR } = require('./config');
const { decifrar } = require('./crypto');
const { extensao } = require('./extrair');

let cliente = null;
const configurado = () => !!process.env.ANTHROPIC_API_KEY;
function api() {
  if (!configurado()) throw Object.assign(new Error('O Assistente Jurídico ainda não está configurado: defina ANTHROPIC_API_KEY no servidor.'), { status: 503 });
  return (cliente ||= new (Anthropic.default || Anthropic)());
}

const MAX_CHARS_DOC = 250_000;     // por documento
const MAX_CHARS_TOTAL = 600_000;   // somados (~150 mil tokens)
const MAX_PDF_NATIVO = 20 * 1024 * 1024;

function promptSistema(contextoCaso) {
  const hoje = new Date().toLocaleDateString('pt-BR', { dateStyle: 'full', timeZone: 'America/Sao_Paulo' });
  return `Você é o ${firma.assistenteNome} do escritório ${firma.nome}, um assistente de IA de uso interno e restrito, que apoia advogados e a equipe do escritório. Hoje é ${hoje}.

# Papel
Auxiliar na análise de documentos, organização de atendimentos, pesquisa de fundamentos e redação de peças e comunicações jurídicas no âmbito do Direito brasileiro. Você produz rascunhos e análises para revisão e assinatura do advogado responsável; a decisão e a responsabilidade técnica são sempre do advogado.

# Regras de ouro
1. **Fidelidade aos fatos**: use apenas fatos presentes nos documentos, no cadastro e na conversa. Nunca invente nomes, datas, valores, números de processo ou qualificações. O que faltar deve aparecer como **[PREENCHER: descrição do dado]** no texto.
2. **Sem alucinação jurídica**: cite artigos de lei, súmulas, temas repetitivos e precedentes somente quando tiver confiança na existência e no conteúdo. Jamais invente números de processo, ementas ou transcrições. Quando a citação depender de conferência, marque **[CONFERIR]** e diga o que verificar. Considere que a legislação e a jurisprudência podem ter mudado depois do seu treinamento e recomende checar a redação vigente.
3. **Transparência**: separe claramente o que está nos documentos, o que é inferência sua e o que é opinião/estratégia. Aponte contradições, lacunas, riscos, prazos (prescrição, decadência, recursos) e documentos que faltam.
4. **Sigilo profissional**: trate tudo como confidencial (Estatuto da Advocacia, art. 7º, II, e Código de Ética da OAB, art. 35). Não proponha divulgar dados do cliente.
5. **Ética**: não auxilie em fraude, ocultação de provas, captação indevida de clientela ou qualquer conduta vedada pelo Código de Ética da OAB.
6. Se o pedido for ambíguo e a resposta depender de dado essencial, faça no máximo 3 perguntas objetivas — mas, sempre que possível, já entregue uma primeira versão com os pontos em aberto marcados.

# Formato
- Responda em português do Brasil, em linguagem técnica e clara, em Markdown (títulos, listas, **negrito**).
- Peças e minutas: estrutura completa e pronta para revisão (endereçamento, qualificação das partes, dos fatos, do direito, dos pedidos, valor da causa, fecho), com tom formal e parágrafos objetivos.
- Resumos: comece pela conclusão em poucas linhas e depois detalhe (partes, objeto, fatos relevantes, prazos, valores, riscos, próximos passos).
- Ao final de minutas e pareceres, inclua uma breve seção **"Pontos para revisão do advogado"**.
${contextoCaso ? `\n# Contexto do caso selecionado pelo usuário\n${contextoCaso}\n` : ''}`;
}

function contextoDoCaso(conv) {
  const partes = [];
  if (conv.cliente_id) {
    const c = db.prepare('SELECT * FROM clientes WHERE id = ?').get(conv.cliente_id);
    if (c) {
      const campos = [['Nome', c.nome], ['Tipo', c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'], ['CPF/CNPJ', c.documento], ['RG', c.rg],
        ['Estado civil', c.estado_civil], ['Profissão/ramo', c.profissao], ['Nascimento', c.nascimento], ['Endereço', c.endereco],
        ['E-mail', c.email], ['Telefone', c.telefone], ['Observações', c.observacoes]].filter(([, v]) => v);
      partes.push('## Cliente\n' + campos.map(([k, v]) => `- ${k}: ${v}`).join('\n'));
    }
  }
  if (conv.processo_id) {
    const p = db.prepare('SELECT * FROM processos WHERE id = ?').get(conv.processo_id);
    if (p) {
      const campos = [['Caso', p.titulo], ['Número', p.numero], ['Área', p.area], ['Juízo/Órgão', p.juizo], ['Parte contrária', p.parte_contraria],
        ['Situação', p.status], ['Valor da causa', p.valor_causa != null ? 'R$ ' + p.valor_causa : null], ['Observações', p.observacoes]].filter(([, v]) => v);
      partes.push('## Processo / caso\n' + campos.map(([k, v]) => `- ${k}: ${v}`).join('\n'));
    }
  }
  const filtro = conv.processo_id ? ['processo_id = ?', conv.processo_id] : conv.cliente_id ? ['cliente_id = ?', conv.cliente_id] : null;
  if (filtro) {
    const ats = db.prepare(`SELECT data_hora, canal, assunto, resumo, providencias, prazo FROM atendimentos WHERE ${filtro[0]} ORDER BY data_hora DESC LIMIT 12`).all(filtro[1]);
    if (ats.length) {
      partes.push('## Histórico de atendimentos (mais recentes primeiro)\n' + ats.map((a) =>
        `- ${a.data_hora} (${a.canal}) — ${a.assunto}` + (a.resumo ? `\n  Resumo: ${a.resumo.slice(0, 1500)}` : '') +
        (a.providencias ? `\n  Providências: ${a.providencias.slice(0, 600)}` : '') + (a.prazo ? `\n  Prazo: ${a.prazo}` : '')).join('\n'));
    }
  }
  return partes.join('\n\n');
}

// Monta os blocos de conteúdo dos documentos selecionados.
function blocosDosDocumentos(ids) {
  const blocos = [], avisos = [];
  let total = 0;
  for (const id of ids) {
    const d = db.prepare('SELECT * FROM documentos WHERE id = ?').get(id);
    if (!d) continue;
    const ext = extensao(d.nome_original);
    const cab = `Documento #${d.id} — "${d.titulo}" (${d.categoria}; arquivo: ${d.nome_original})`;
    // PDF com quase nenhum texto = provavelmente escaneado -> leitura visual; demais formatos usam o texto extraído
    if (d.texto && (ext !== '.pdf' || d.texto.length > 80)) {
      let t = d.texto.slice(0, Math.min(MAX_CHARS_DOC, Math.max(0, MAX_CHARS_TOTAL - total)));
      if (!t) { avisos.push(`"${d.titulo}" não coube no limite de contexto.`); continue; }
      total += t.length;
      const cortado = t.length < d.texto.length ? '\n[... texto truncado por tamanho ...]' : '';
      blocos.push({ type: 'text', text: `<documento id="${d.id}" titulo="${d.titulo.replace(/"/g, "'")}">\n${cab}\n\n${t}${cortado}\n</documento>` });
      continue;
    }
    // sem texto extraído: PDF escaneado ou imagem -> envia o arquivo para leitura visual
    const arq = path.join(DATA_DIR, 'uploads', d.arquivo);
    if (ext === '.pdf' && d.tamanho <= MAX_PDF_NATIVO) {
      blocos.push({ type: 'text', text: cab });
      blocos.push({ type: 'document', title: d.titulo, source: { type: 'base64', media_type: 'application/pdf', data: decifrar(fs.readFileSync(arq)).toString('base64') } });
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) && d.tamanho <= 5 * 1024 * 1024) {
      blocos.push({ type: 'text', text: cab });
      blocos.push({ type: 'image', source: { type: 'base64', media_type: d.mime, data: decifrar(fs.readFileSync(arq)).toString('base64') } });
    } else {
      avisos.push(`"${d.titulo}" (${ext || 'sem extensão'}) não pôde ser lido pelo assistente (formato sem texto extraível).`);
    }
  }
  if (blocos.length) blocos[blocos.length - 1].cache_control = { type: 'ephemeral' };
  return { blocos, avisos };
}

function montarMensagens(conv, historico) {
  const ids = JSON.parse(conv.documentos_ids || '[]');
  const { blocos, avisos } = blocosDosDocumentos(ids);
  const msgs = historico.map((m) => ({ role: m.papel, content: m.conteudo }));
  // os documentos ficam anexados à primeira mensagem (prefixo estável => cache)
  if (blocos.length && msgs[0]?.role === 'user') {
    msgs[0] = { role: 'user', content: [...blocos, { type: 'text', text: msgs[0].content }] };
  }
  return { msgs, avisos };
}

function erroAmigavel(e) {
  const s = e?.status;
  if (s === 401) return 'A chave da API da Anthropic é inválida. Verifique ANTHROPIC_API_KEY no servidor.';
  if (s === 403) return 'A chave da API não tem permissão para este modelo.';
  if (s === 404) return 'Modelo de IA não encontrado. Verifique ANTHROPIC_MODEL.';
  if (s === 413) return 'Os documentos selecionados são grandes demais. Selecione menos documentos.';
  if (s === 429) return 'Limite de uso da IA atingido no momento. Tente novamente em instantes.';
  if (s === 529 || s === 503) return 'O serviço de IA está sobrecarregado. Tente novamente em instantes.';
  if (s === 400 && /credit|billing/i.test(e.message)) return 'Saldo insuficiente na conta da API da Anthropic.';
  if (s === 400) return 'A IA recusou a solicitação (documento ilegível ou muito grande?). Detalhe: ' + String(e.message).slice(0, 200);
  return e?.message || 'Falha ao consultar a IA.';
}

module.exports = { api, configurado, promptSistema, contextoDoCaso, montarMensagens, erroAmigavel, MODEL };

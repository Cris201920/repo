// Modelos de checklist (o que normalmente é preciso reunir) e conferência local de documentos.
// Cada item: t = título, c = tipo de documento (categoria), k = palavras que identificam o documento.

const DOC = (t, c, k) => ({ tipo: 'documento', t, c, k });
const TAREFA = (t) => ({ tipo: 'tarefa', t, c: null, k: [] });

const MODELOS = {
  basico: {
    nome: 'Documentos básicos do cliente (pessoa física)',
    itens: [
      DOC('RG ou CNH', 'identificacao', ['rg', 'identidade', 'cnh', 'habilitacao']),
      DOC('CPF', 'identificacao', ['cpf']),
      DOC('Comprovante de residência', 'comprovante', ['residencia', 'endereco', 'energia', 'agua', 'luz']),
      DOC('Certidão de nascimento ou casamento', 'identificacao', ['certidao', 'nascimento', 'casamento']),
      DOC('Procuração assinada', 'procuracao', ['procuracao', 'substabelecimento']),
      DOC('Contrato de honorários assinado', 'contrato', ['honorarios']),
      DOC('Declaração de hipossuficiência (se houver gratuidade)', 'procuracao', ['hipossuficiencia', 'gratuidade', 'pobreza']),
    ],
  },
  pj: {
    nome: 'Documentos de pessoa jurídica',
    itens: [
      DOC('Contrato social / estatuto e alterações', 'contrato', ['contrato social', 'estatuto', 'alteracao contratual']),
      DOC('Cartão CNPJ', 'identificacao', ['cnpj']),
      DOC('Documentos do representante legal (RG e CPF)', 'identificacao', ['rg', 'cpf', 'representante']),
      DOC('Procuração da empresa', 'procuracao', ['procuracao']),
      DOC('Comprovante de endereço da empresa', 'comprovante', ['endereco', 'residencia', 'sede']),
    ],
  },
  trabalhista: {
    nome: 'Ação trabalhista',
    itens: [
      DOC('Carteira de trabalho (CTPS)', 'prova', ['ctps', 'carteira de trabalho']),
      DOC('Contracheques / holerites', 'comprovante', ['contracheque', 'holerite', 'recibo de pagamento']),
      DOC('Termo de rescisão (TRCT)', 'prova', ['trct', 'rescisao']),
      DOC('Extrato do FGTS', 'comprovante', ['fgts']),
      DOC('Contrato de trabalho', 'contrato', ['contrato de trabalho']),
      DOC('Provas da jornada (cartões de ponto, mensagens, e-mails)', 'prova', ['ponto', 'jornada', 'horas extras']),
      DOC('Lista de testemunhas', 'prova', ['testemunha']),
    ],
  },
  familia: {
    nome: 'Família e sucessões',
    itens: [
      DOC('Certidão de casamento / união estável', 'identificacao', ['casamento', 'uniao estavel']),
      DOC('Certidão de nascimento dos filhos', 'identificacao', ['nascimento', 'filho']),
      DOC('Comprovantes de renda das partes', 'comprovante', ['renda', 'contracheque', 'imposto de renda']),
      DOC('Comprovantes de despesas dos filhos', 'comprovante', ['despesa', 'escola', 'mensalidade', 'saude']),
      DOC('Documentos dos bens (imóveis, veículos, contas)', 'prova', ['matricula', 'bem', 'veiculo', 'imovel']),
      DOC('Pacto antenupcial / escritura (se houver)', 'contrato', ['pacto', 'escritura']),
      DOC('Certidão de óbito e inventário (se sucessão)', 'identificacao', ['obito', 'inventario']),
    ],
  },
  previdenciario: {
    nome: 'Previdenciário (INSS)',
    itens: [
      DOC('CNIS (Cadastro Nacional de Informações Sociais)', 'prova', ['cnis']),
      DOC('Carteira de trabalho (CTPS)', 'prova', ['ctps', 'carteira de trabalho']),
      DOC('PPP / laudos de atividade especial', 'prova', ['ppp', 'laudo', 'insalubre', 'ltcat']),
      DOC('Laudos e atestados médicos', 'prova', ['laudo', 'atestado', 'medico', 'exame']),
      DOC('Carnês / guias de contribuição', 'comprovante', ['carne', 'guia', 'gps', 'contribuicao']),
      DOC('Carta de indeferimento / protocolo do INSS', 'decisao', ['indeferimento', 'protocolo', 'inss']),
    ],
  },
  consumidor: {
    nome: 'Consumidor',
    itens: [
      DOC('Nota fiscal / comprovante da compra', 'comprovante', ['nota fiscal', 'comprovante', 'compra', 'pedido']),
      DOC('Contrato ou termos do serviço', 'contrato', ['contrato', 'termos']),
      DOC('Protocolos de atendimento e reclamações', 'correspondencia', ['protocolo', 'reclamacao', 'sac']),
      DOC('Prints, fotos e conversas (provas do dano)', 'prova', ['print', 'foto', 'conversa', 'whatsapp']),
      DOC('Comprovantes dos prejuízos', 'comprovante', ['prejuizo', 'orcamento', 'recibo']),
    ],
  },
  locacao: {
    nome: 'Locação / imobiliário',
    itens: [
      DOC('Contrato de locação', 'contrato', ['locacao', 'aluguel', 'contrato de locacao']),
      DOC('Matrícula do imóvel', 'prova', ['matricula']),
      DOC('Comprovantes de pagamento / recibos', 'comprovante', ['recibo', 'pagamento', 'comprovante']),
      DOC('Planilha do débito atualizado', 'prova', ['debito', 'calculo', 'planilha']),
      DOC('Notificação ao locatário/locador', 'correspondencia', ['notificacao']),
    ],
  },
  criminal: {
    nome: 'Criminal',
    itens: [
      DOC('Boletim de ocorrência / inquérito', 'prova', ['boletim', 'ocorrencia', 'inquerito']),
      DOC('Intimação ou citação recebida', 'decisao', ['intimacao', 'citacao']),
      DOC('Certidões de antecedentes', 'identificacao', ['antecedentes', 'certidao']),
      DOC('Provas e documentos da defesa', 'prova', ['prova', 'defesa']),
      DOC('Procuração com poderes especiais', 'procuracao', ['procuracao']),
    ],
  },
  processo: {
    nome: 'Acompanhamento do processo (tarefas)',
    itens: [
      TAREFA('Protocolar a petição inicial'),
      TAREFA('Acompanhar a citação / intimação'),
      TAREFA('Conferir os prazos do processo'),
      TAREFA('Preparar documentos e testemunhas para a audiência'),
      TAREFA('Informar o cliente sobre o andamento'),
    ],
  },
};

// área do caso -> modelos sugeridos
const POR_AREA = {
  'Cível': ['basico', 'processo'], 'Trabalhista': ['basico', 'trabalhista', 'processo'], 'Família e Sucessões': ['basico', 'familia', 'processo'],
  'Previdenciário': ['basico', 'previdenciario', 'processo'], 'Consumidor': ['basico', 'consumidor', 'processo'], 'Criminal': ['basico', 'criminal', 'processo'],
  'Tributário': ['basico', 'processo'], 'Empresarial': ['pj', 'processo'], 'Imobiliário': ['basico', 'locacao', 'processo'], 'Administrativo': ['basico', 'processo'], 'Outra': ['basico', 'processo'],
};

// ---------- conferência local (sem IA): relaciona documentos do cliente com itens pendentes ----------
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function palavrasDe(pend) {
  try { const k = JSON.parse(pend.palavras || 'null'); if (Array.isArray(k) && k.length) return k; } catch { /* usa o título */ }
  return norm(pend.titulo).split(' ').filter((w) => w.length >= 5); // item personalizado: palavras significativas do título
}

// devolve { documento, motivo } do melhor documento para o item, ou null
function melhorDocumento(pend, docs) {
  const kws = palavrasDe(pend).map(norm).filter(Boolean);
  if (!kws.length) return null;
  let melhor = null;
  for (const d of docs) {
    const texto = ' ' + norm([d.titulo, d.nome_original, d.tags, d.resumo].join(' ')) + ' ';
    const achadas = kws.filter((k) => texto.includes(' ' + k + ' ') || (k.length >= 6 && texto.includes(k)));
    if (!achadas.length) continue;
    let pontos = achadas.length * 2 + (pend.categoria && d.categoria === pend.categoria ? 3 : 0) + (pend.processo_id && d.processo_id === pend.processo_id ? 1 : 0);
    // sem a categoria certa e com uma só palavra curta, é fraco demais para propor
    if (pend.categoria && d.categoria !== pend.categoria && achadas.length < 2 && achadas[0].length < 6) continue;
    if (!melhor || pontos > melhor.pontos || (pontos === melhor.pontos && d.id > melhor.documento.id)) melhor = { documento: d, pontos, motivo: `Título/etiquetas citam “${achadas[0]}”${pend.categoria && d.categoria === pend.categoria ? ' e o tipo confere' : ''}.` };
  }
  return melhor;
}

module.exports = { MODELOS, POR_AREA, melhorDocumento, norm };

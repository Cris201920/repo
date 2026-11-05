// Converte o texto em Markdown devolvido pela IA em um documento Word (.docx) formatado
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, Footer, PageNumber, LevelFormat, BorderStyle,
} = require('docx');
const { firma } = require('./config');

const FONTE = 'Times New Roman';

function runs(texto, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[PREENCHER[^\]]*\])/g;
  let last = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > last) out.push(new TextRun({ text: texto.slice(last, m.index), font: FONTE, ...base }));
    const tk = m[0];
    if (tk.startsWith('**')) out.push(new TextRun({ text: tk.slice(2, -2), bold: true, font: FONTE, ...base }));
    else if (tk.startsWith('[PREENCHER')) out.push(new TextRun({ text: tk, font: FONTE, highlight: 'yellow', ...base }));
    else out.push(new TextRun({ text: tk.slice(1, -1), italics: true, font: FONTE, ...base }));
    last = m.index + tk.length;
  }
  if (last < texto.length) out.push(new TextRun({ text: texto.slice(last), font: FONTE, ...base }));
  return out;
}

function paragrafos(md) {
  const ps = [];
  for (const linha of String(md).replace(/\r/g, '').split('\n')) {
    const t = linha.trimEnd();
    let m;
    if (!t.trim()) continue;
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) {
      const nivel = m[1].length;
      ps.push(new Paragraph({
        heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][nivel - 1],
        alignment: nivel === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 240, after: 120 }, keepNext: true,
        children: runs(m[2].replace(/\*\*/g, ''), { bold: true, size: nivel === 1 ? 28 : 24 }),
      }));
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(t)) {
      ps.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } }, spacing: { after: 120 } }));
    } else if ((m = t.match(/^\s*[-*•]\s+(.*)$/))) {
      ps.push(new Paragraph({ numbering: { reference: 'marcador', level: 0 }, spacing: { after: 60 }, alignment: AlignmentType.JUSTIFIED, children: runs(m[1], { size: 24 }) }));
    } else if ((m = t.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      ps.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 360, hanging: 360 }, alignment: AlignmentType.JUSTIFIED, children: runs(`${m[1]}. ${m[2]}`, { size: 24 }) }));
    } else if ((m = t.match(/^>\s?(.*)$/))) {
      ps.push(new Paragraph({ indent: { left: 2268 }, spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED, children: runs(m[1], { size: 22 }) }));
    } else {
      ps.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 360 }, indent: { firstLine: 709 }, children: runs(t, { size: 24 }) }));
    }
  }
  return ps;
}

async function gerarDocx(markdown, titulo) {
  const doc = new Document({
    creator: firma.nome, title: titulo || 'Documento',
    numbering: { config: [{ reference: 'marcador', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{
      properties: { page: { margin: { top: 1701, left: 1701, bottom: 1134, right: 1134 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: firma.nome.toUpperCase(), font: FONTE, size: 18, color: '8A6D3B', characterSpacing: 40 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Rascunho gerado por IA — revisão do advogado responsável obrigatória  |  Pág. ', PageNumber.CURRENT], font: FONTE, size: 16, color: '777777' })] })] }) },
      children: paragrafos(markdown),
    }],
  });
  return Packer.toBuffer(doc);
}
module.exports = { gerarDocx };

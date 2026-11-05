// Extração de texto dos documentos (para busca e para o assistente de IA)
const path = require('path');

const MAX_TEXTO = 400_000;
const MAX_PAGINAS = 400;

async function textoPdf(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  const partes = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGINAS); i++) {
      const pg = await doc.getPage(i);
      const c = await pg.getTextContent();
      let linha = '';
      for (const it of c.items) { linha += it.str; linha += it.hasEOL ? '\n' : ' '; }
      partes.push(linha);
      if (partes.join('').length > MAX_TEXTO) break;
    }
  } finally { await doc.destroy(); }
  return partes.join('\n\n').replace(/ {2,}/g, ' ');
}

async function extrairTexto(buf, ext) {
  try {
    let t = '';
    if (ext === '.pdf') {
      t = await textoPdf(buf);
    } else if (ext === '.docx') {
      t = (await require('mammoth').extractRawText({ buffer: buf })).value || '';
    } else if (['.txt', '.md', '.csv', '.rtf'].includes(ext)) {
      t = buf.toString('utf8');
    }
    t = t.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return t.length > MAX_TEXTO ? t.slice(0, MAX_TEXTO) : t;
  } catch (e) {
    console.warn('extração falhou:', e.message);
    return '';
  }
}

const TIPOS = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.rtf': 'application/rtf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};
const extensao = (nome) => path.extname(nome || '').toLowerCase();

module.exports = { extrairTexto, TIPOS, extensao };

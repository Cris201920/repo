/* Docs: ler texto de PDF/Word, montar e dividir PDFs, ZIP, gerar Word (.docx) e entregar arquivos ao usuário. */
const Docs = (() => {
  const CATEGORIAS = ['procuracao', 'contrato', 'peticao', 'decisao', 'identificacao', 'comprovante', 'prova', 'parecer', 'correspondencia', 'outros'];
  const TIPOS = {
    '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.odt': 'application/vnd.oasis.opendocument.text', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.rtf': 'application/rtf',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  };
  const MAX_UPLOAD = 14 * 1024 * 1024;           // o arquivo cifrado em base64 precisa caber nos 20 MB do armazenamento
  const MAX_TEXTO = 90000;                        // texto guardado por documento (busca e IA)
  const ext = (nome) => { const m = /\.[^./\\]+$/.exec(String(nome || '').toLowerCase()); return m ? m[0] : ''; };
  const para8 = async (arq) => new Uint8Array(await arq.arrayBuffer());

  // ---------- leitura de texto ----------
  async function abrirPdf(u8) {
    return pdfjsLib.getDocument({ data: u8.slice(), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  }
  async function paginasPdf(u8, max = 300) {
    const pdf = await abrirPdf(u8), out = [];
    try {
      for (let i = 1; i <= Math.min(pdf.numPages, max); i++) {
        const c = await (await pdf.getPage(i)).getTextContent();
        out.push(c.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/ {2,}/g, ' ').trim());
      }
      out.total = pdf.numPages;
    } finally { try { await pdf.destroy(); } catch { /* ok */ } }
    return out;
  }
  async function extrairTexto(u8, e) {
    try {
      let t = '';
      if (e === '.pdf') t = (await paginasPdf(u8)).join('\n\n');
      else if (e === '.docx') t = (await mammoth.extractRawText({ arrayBuffer: u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) })).value || '';
      else if (['.txt', '.md', '.csv', '.rtf'].includes(e)) t = new TextDecoder().decode(u8);
      t = t.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      return t.length > MAX_TEXTO ? t.slice(0, MAX_TEXTO) : t;
    } catch { return ''; }
  }
  // páginas de um PDF como imagens JPEG (para a IA ler documentos escaneados)
  async function paginasComoImagens(u8, { max = 6, largura = 1100 } = {}) {
    const pdf = await abrirPdf(u8), blobs = [];
    try {
      for (let i = 1; i <= Math.min(pdf.numPages, max); i++) {
        const pg = await pdf.getPage(i), v0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: largura / v0.width });
        const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        await pg.render({ canvasContext: g, viewport: vp }).promise;
        blobs.push(await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8)));
      }
    } finally { try { await pdf.destroy(); } catch { /* ok */ } }
    return blobs;
  }
  // visualizador de PDF dentro da página (o navegador não deixa incorporar o leitor nativo)
  async function mostrarPdf(u8, caixa, limite = 6) {
    const pdf = await abrirPdf(u8); let prox = 1;
    const mais = document.createElement('button'); mais.type = 'button'; mais.className = 'btn'; mais.style.margin = '12px auto'; mais.style.display = 'block';
    async function lote() {
      mais.disabled = true;
      for (let n = 0; n < limite && prox <= pdf.numPages; n++, prox++) {
        const pg = await pdf.getPage(prox), v0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(1.6, 900 / v0.width) });
        const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        c.style.cssText = 'max-width:100%;height:auto;display:block;margin:0 auto 10px;border:1px solid var(--line);background:#fff';
        mais.before(c); await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      }
      mais.disabled = false; mais.hidden = prox > pdf.numPages; mais.textContent = `Mostrar mais páginas (${prox - 1} de ${pdf.numPages})`;
    }
    caixa.innerHTML = ''; caixa.append(mais); mais.onclick = lote; await lote();
    return pdf.numPages;
  }

  // ---------- PDF ----------
  async function contarPaginas(u8) { return (await PDFLib.PDFDocument.load(u8, { ignoreEncryption: true })).getPageCount(); }
  async function imagensParaPdf(itens) {                         // itens: [{ u8, ext }]
    const pdf = await PDFLib.PDFDocument.create();
    for (const it of itens) {
      const img = ['.jpg', '.jpeg'].includes(it.ext) ? await pdf.embedJpg(it.u8) : it.ext === '.png' ? await pdf.embedPng(it.u8) : null;
      if (!img) throw new Error('Para juntar em PDF use imagens JPG ou PNG.');
      const [pw, ph] = img.width > img.height ? [841.89, 595.28] : [595.28, 841.89];
      const k = Math.min(pw / img.width, ph / img.height), w = img.width * k, h = img.height * k;
      pdf.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    return new Uint8Array(await pdf.save());
  }
  async function extrairPaginas(origem, de, ate) {                // páginas de..ate (1-based) como novo PDF
    const novo = await PDFLib.PDFDocument.create();
    const idx = Array.from({ length: ate - de + 1 }, (_, k) => de - 1 + k);
    (await novo.copyPages(origem, idx)).forEach((p) => novo.addPage(p));
    return new Uint8Array(await novo.save());
  }
  const carregarPdf = (u8) => PDFLib.PDFDocument.load(u8, { ignoreEncryption: true });

  // ---------- ZIP ----------
  const zipar = (arquivos) => { const o = {}; for (const [n, u8] of Object.entries(arquivos)) o[n] = [u8, { level: 0 }]; return fflate.zipSync(o); };

  // ---------- Word (.docx) feito à mão ----------
  const x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  function runsXml(texto, base = '') {
    const out = [];
    for (const p of texto.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[PREENCHER[^\]]*\])/g).filter(Boolean)) {
      let rpr = base, t = p;
      if (p.startsWith('**') && p.endsWith('**') && p.length > 4) { t = p.slice(2, -2); rpr += '<w:b/>'; }
      else if (p.startsWith('[PREENCHER')) rpr += '<w:highlight w:val="yellow"/>';
      else if (p.startsWith('*') && p.endsWith('*') && p.length > 2) { t = p.slice(1, -1); rpr += '<w:i/>'; }
      out.push(`<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${x(t)}</w:t></w:r>`);
    }
    return out.join('');
  }
  function paragrafosXml(md) {
    const ps = [];
    for (const linha of String(md).replace(/\r/g, '').split('\n')) {
      const t = linha.trimEnd(); let m;
      if (!t.trim()) continue;
      if ((m = t.match(/^(#{1,3})\s+(.*)$/))) {
        const n = m[1].length;
        ps.push(`<w:p><w:pPr><w:pStyle w:val="Titulo${n}"/>${n === 1 ? '<w:jc w:val="center"/>' : ''}</w:pPr>${runsXml(m[2].replace(/\*\*/g, ''), '<w:b/>')}</w:p>`);
      } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(t)) ps.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>');
      else if ((m = t.match(/^\s*[-*•]\s+(.*)$/))) ps.push(`<w:p><w:pPr><w:spacing w:after="60"/><w:ind w:left="720" w:hanging="360"/><w:jc w:val="both"/></w:pPr>${runsXml('•\t' + m[1])}</w:p>`);
      else if ((m = t.match(/^\s*(\d+)[.)]\s+(.*)$/))) ps.push(`<w:p><w:pPr><w:spacing w:after="60"/><w:ind w:left="360" w:hanging="360"/><w:jc w:val="both"/></w:pPr>${runsXml(m[1] + '. ' + m[2])}</w:p>`);
      else if ((m = t.match(/^>\s?(.*)$/))) ps.push(`<w:p><w:pPr><w:spacing w:after="120"/><w:ind w:left="2268"/><w:jc w:val="both"/></w:pPr>${runsXml(m[1], '<w:sz w:val="22"/>')}</w:p>`);
      else ps.push(`<w:p><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="709"/><w:jc w:val="both"/></w:pPr>${runsXml(t)}</w:p>`);
    }
    return ps.join('');
  }
  function gerarDocx(markdown, { escritorio = '', rodape = 'Rascunho gerado por IA — revisão do advogado responsável obrigatória' } = {}) {
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', te = new TextEncoder();
    const estilo = (id, nome, pt, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${nome}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/>${extra}</w:pPr><w:rPr><w:b/><w:sz w:val="${pt}"/></w:rPr></w:style>`;
    const arq = {
      '[Content_Types].xml': `${cab}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`,
      '_rels/.rels': `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      'word/_rels/document.xml.rels': `${cab}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
      'word/styles.xml': `${cab}<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${estilo('Titulo1', 'heading 1', 28)}${estilo('Titulo2', 'heading 2', 24)}${estilo('Titulo3', 'heading 3', 24)}</w:styles>`,
      'word/header1.xml': `${cab}<w:hdr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="8A6D3B"/><w:spacing w:val="40"/><w:sz w:val="18"/></w:rPr><w:t>${x(String(escritorio).toUpperCase())}</w:t></w:r></w:p></w:hdr>`,
      'word/footer1.xml': `${cab}<w:ftr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:color w:val="777777"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${x(rodape)}  |  Pág. </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:color w:val="777777"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`,
      'word/document.xml': `${cab}<w:document ${NS}><w:body>${paragrafosXml(markdown)}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    };
    const o = {}; for (const [n, c] of Object.entries(arq)) o[n] = te.encode(c);
    return fflate.zipSync(o, { level: 6 });
  }

  // ---------- entrega de arquivos ao usuário ----------
  const PERMITIDAS = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mov', 'txt', 'json', 'md', 'docx', 'pptx', 'epub', 'csv', 'ttf', 'html', 'svg', 'pdf', 'xlsx', 'zip', 'fig']);
  async function entregar(nome, dados) {
    const b = Dados.backend;
    if (!b.downloadsOk) throw new Error('Este ambiente não permite baixar arquivos.');
    const e = ext(nome).slice(1);
    try {
      // a plataforma só aceita algumas extensões: as demais vão dentro de um ZIP
      if (b.tipo === 'claude' && !PERMITIDAS.has(e)) {
        const u8 = dados instanceof Blob ? new Uint8Array(await dados.arrayBuffer()) : dados instanceof Uint8Array ? dados : new TextEncoder().encode(String(dados));
        return await b.salvar(nome + '.zip', new Blob([zipar({ [nome]: u8 })]));
      }
      return await b.salvar(nome, dados instanceof Uint8Array ? new Blob([dados]) : dados);
    } catch (er) {
      if (er && er.code === 'declined') return;                          // a pessoa recusou: não é erro
      throw er instanceof Error ? er : new Error(er && er.message ? er.message : 'Não foi possível salvar o arquivo' + (er && er.code ? ` (${er.code})` : '') + '.');
    }
  }

  return { CATEGORIAS, TIPOS, MAX_UPLOAD, MAX_TEXTO, ext, para8, paginasPdf, extrairTexto, paginasComoImagens, mostrarPdf, contarPaginas, imagensParaPdf, extrairPaginas, carregarPdf, zipar, gerarDocx, entregar };
})();

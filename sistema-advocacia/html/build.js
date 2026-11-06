#!/usr/bin/env node
/* Gera o sistema em HTML único:
 *   dist/artifact.html            → conteúdo para publicar como Artifact do Claude (sem doctype/head/body)
 *   dist/sistema-advocacia.html   → documento completo, para abrir direto no navegador
 * Uso: node build.js */
const fs = require('fs'), path = require('path');
const { nucleo, ler, UI } = require('./lib/montar');

const raiz = __dirname;
const firma = JSON.parse(fs.readFileSync(path.join(raiz, '..', 'firm.config.json'), 'utf8'));
const png = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(raiz, 'assets', f)).toString('base64');

const CDN = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js',
];

const config = `'use strict';
const FIRMA = ${JSON.stringify(firma)};
const LOGO = { escura: ${JSON.stringify(png('logo.png'))}, clara: ${JSON.stringify(png('logo-claro.png'))} };
const EMBLEMA = { claro: ${JSON.stringify(png('emblema.png'))}, escuro: ${JSON.stringify(png('emblema-escuro.png'))} };
try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js'; } catch (e) { /* sem leitor de PDF */ }
`;

// ---- CSS: o tema escuro do app (`:root[data-theme="dark"] …`) também vale quando o sistema do aparelho está escuro e nada foi escolhido
function regrasTopo(css) {
  const out = []; let i = 0, ini = 0, prof = 0;
  for (; i < css.length; i++) {
    const c = css[i];
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) { out.push(css.slice(ini, i + 1)); ini = i + 1; } }
  }
  return out;
}
function css() {
  const base = ler('app.css');
  const sem = base.replace(/\/\*[\s\S]*?\*\//g, '');
  const escuras = regrasTopo(sem).map((r) => r.trim()).filter((r) => r.startsWith(':root[data-theme="dark"]'));
  const espelho = escuras.map((r) => {
    const k = r.indexOf('{');
    const sel = r.slice(0, k).split(',').map((s) => s.trim().replace(':root[data-theme="dark"]', ':root:not([data-theme="light"])')).join(',');
    return sel + r.slice(k);
  });
  return base + `\n/* tema escuro automático (sistema do aparelho) */\n@media (prefers-color-scheme: dark){\n${espelho.join('\n')}\n}\n`;
}

const seguro = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const programa = seguro([config, nucleo(), ...UI.map(ler)].join('\n'));
const corpoApp = `<div id="app"><div class="splash"><img src="${png('emblema.png')}" alt=""></div></div>\n<div id="toasts" aria-live="polite"></div>`;
const scripts = CDN.map((u) => `<script src="${u}"></script>`).join('\n');
const titulo = `${firma.nome}`;

const artifact = `<title>${titulo}</title>
<style>
${css()}
</style>
${corpoApp}
${scripts}
<script>
${programa}
</script>
`;

const completo = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${titulo}</title>
<link rel="icon" type="image/png" href="${png('favicon.png')}">
<style>
${css()}
</style>
</head>
<body>
${corpoApp}
${scripts}
<script>
${programa}
</script>
</body>
</html>
`;

fs.mkdirSync(path.join(raiz, 'dist'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'dist', 'artifact.html'), artifact);
fs.writeFileSync(path.join(raiz, 'dist', 'sistema-advocacia.html'), completo);
console.log('artifact.html', (artifact.length / 1048576).toFixed(2), 'MB · sistema-advocacia.html', (completo.length / 1048576).toFixed(2), 'MB');

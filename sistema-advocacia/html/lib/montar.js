// Junta os arquivos-fonte do núcleo (cofre, dados, API local…) na ordem certa. Usado pelo build e pelos testes.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const ler = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

function modelos() {            // modelos.js era um módulo do servidor: aqui vira um objeto "Modelos" isolado
  const s = ler('modelos.js').replace(/module\.exports\s*=\s*\{[^}]*\};?\s*$/m, '');
  return `const Modelos = (() => {\n${s}\nreturn { MODELOS, POR_AREA, melhorDocumento, norm };\n})();\n`;
}
const NUCLEO = ['cofre.js', 'backend.js', 'dados.js', 'docs.js', 'ia.js', 'localapi.js', 'localapi-docs.js'];
const nucleo = () => modelos() + NUCLEO.map(ler).join('\n');
const UI = ['ui/core.js', 'ui/tema.js', 'ui/pages.js', 'ui/assistente.js', 'ui/organizar.js', 'ui/pastas.js', 'ui/pendencias.js', 'ui/main.js'];
module.exports = { nucleo, ler, SRC, UI };

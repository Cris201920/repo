// Criptografia em repouso dos documentos (AES-256-GCM).
// Formato do arquivo: [iv 12][tag 16][conteúdo cifrado]
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');

function carregarChave() {
  if (process.env.DATA_KEY) {
    return /^[0-9a-f]{64}$/i.test(process.env.DATA_KEY)
      ? Buffer.from(process.env.DATA_KEY, 'hex')
      : crypto.scryptSync(process.env.DATA_KEY, 'advocacia-docs', 32);
  }
  const f = path.join(DATA_DIR, '.chave');
  if (fs.existsSync(f)) return Buffer.from(fs.readFileSync(f, 'utf8').trim(), 'hex');
  const k = crypto.randomBytes(32);
  fs.writeFileSync(f, k.toString('hex'), { mode: 0o600 });
  console.warn('[aviso] Chave de criptografia criada em', f, '— faça uma cópia segura e SEPARADA dos dados.');
  return k;
}
const KEY = carregarChave();

function cifrar(buf) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}
function decifrar(buf) {
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

module.exports = { cifrar, decifrar, sha256 };

const fs = require('fs');
const path = require('path');

// Carrega .env simples (sem dependência externa)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const linha of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const firma = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firm.config.json'), 'utf8'));

module.exports = {
  firma,
  PORT: Number(process.env.PORT) || 3000,
  DATA_DIR: path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')),
  MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  COOKIE_SECURE: process.env.COOKIE_SECURE === '1',
  TRUST_PROXY: process.env.TRUST_PROXY === '1',
  MAX_UPLOAD: 25 * 1024 * 1024,
  PUBLIC_DIR: path.join(__dirname, '..', 'public'),
};

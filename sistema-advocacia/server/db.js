const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');

fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(path.join(DATA_DIR, 'advocacia.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'advogado' CHECK (papel IN ('admin','advogado','estagiario')),
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em INTEGER NOT NULL,
  ip TEXT, agente TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'PF' CHECK (tipo IN ('PF','PJ')),
  nome TEXT NOT NULL,
  documento TEXT, rg TEXT, estado_civil TEXT, profissao TEXT, nascimento TEXT,
  email TEXT, telefone TEXT, endereco TEXT, observacoes TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS processos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  titulo TEXT NOT NULL,
  numero TEXT, area TEXT, juizo TEXT, parte_contraria TEXT,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('consultivo','em_andamento','suspenso','encerrado')),
  valor_causa REAL, responsavel_id INTEGER REFERENCES usuarios(id),
  observacoes TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS atendimentos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  processo_id INTEGER REFERENCES processos(id) ON DELETE SET NULL,
  data_hora TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'presencial',
  assunto TEXT NOT NULL,
  resumo TEXT, providencias TEXT,
  prazo TEXT, concluido INTEGER NOT NULL DEFAULT 0,
  usuario_id INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS documentos (
  id INTEGER PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  processo_id INTEGER REFERENCES processos(id) ON DELETE SET NULL,
  atendimento_id INTEGER REFERENCES atendimentos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL, categoria TEXT NOT NULL DEFAULT 'outros',
  nome_original TEXT NOT NULL, mime TEXT, tamanho INTEGER NOT NULL,
  arquivo TEXT NOT NULL, sha256 TEXT NOT NULL,
  texto TEXT, origem TEXT NOT NULL DEFAULT 'upload',
  usuario_id INTEGER REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS conversas (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Nova conversa',
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  processo_id INTEGER REFERENCES processos(id) ON DELETE SET NULL,
  documentos_ids TEXT NOT NULL DEFAULT '[]',
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY,
  conversa_id INTEGER NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('user','assistant')),
  conteudo TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER, usuario_nome TEXT,
  acao TEXT NOT NULL, entidade TEXT, entidade_id INTEGER, detalhe TEXT, ip TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_proc_cli ON processos(cliente_id);
CREATE INDEX IF NOT EXISTS ix_atend_cli ON atendimentos(cliente_id, data_hora);
CREATE INDEX IF NOT EXISTS ix_atend_prazo ON atendimentos(prazo) WHERE concluido = 0;
CREATE INDEX IF NOT EXISTS ix_doc_cli ON documentos(cliente_id);
CREATE INDEX IF NOT EXISTS ix_doc_proc ON documentos(processo_id);
CREATE INDEX IF NOT EXISTS ix_msg_conv ON mensagens(conversa_id, id);
`);

// migração: usuário especial do "acesso por link e senha"
if (!db.prepare('PRAGMA table_info(usuarios)').all().some((c) => c.name === 'compartilhado')) {
  db.exec('ALTER TABLE usuarios ADD COLUMN compartilhado INTEGER NOT NULL DEFAULT 0');
}

function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { db, tx };

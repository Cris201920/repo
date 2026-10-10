"""Migrações do banco. Cada item é (versão, descrição, SQL). Nunca edite uma migração já
publicada: acrescente uma nova versão ao final da lista."""
from __future__ import annotations

MIGRATIONS: list[tuple[int, str, str]] = [
    (1, "Esquema inicial", """
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
);

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    list_name TEXT DEFAULT 'Geral',
    priority INTEGER NOT NULL DEFAULT 2,          -- 1 alta, 2 média, 3 baixa
    due_at TEXT,
    remind_at TEXT,
    recurrence TEXT NOT NULL DEFAULT 'none',      -- none|daily|weekdays|weekly|monthly
    status TEXT NOT NULL DEFAULT 'open',          -- open|done|cancelled
    completed_at TEXT,
    discipline TEXT,
    source TEXT DEFAULT 'manual',
    reschedule_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_tasks_status_due ON tasks(status, due_at);

CREATE TABLE task_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    event TEXT NOT NULL,                          -- created|done|reopened|rescheduled|overdue
    old_due TEXT,
    new_due TEXT,
    note TEXT,
    at TEXT NOT NULL
);
CREATE INDEX idx_task_log_task ON task_log(task_id);

CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    location TEXT DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'compromisso',     -- compromisso|estudo|revisao|outro
    remind_minutes INTEGER NOT NULL DEFAULT 15,
    recurrence TEXT NOT NULL DEFAULT 'none',
    discipline TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_events_start ON events(start_at);

CREATE TABLE disciplines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    cycle INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    lessons_done INTEGER NOT NULL DEFAULT 0       -- usuário marcou "aulas concluídas"
);

CREATE TABLE study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    planned_date TEXT NOT NULL,
    planned_start TEXT,
    planned_minutes INTEGER NOT NULL DEFAULT 120,
    discipline TEXT,
    topic TEXT DEFAULT '',
    cycle INTEGER DEFAULT 1,
    kind TEXT NOT NULL DEFAULT 'matinal',         -- matinal|recuperacao|simulado|extra|revisao
    status TEXT NOT NULL DEFAULT 'planned',
    -- planned|running|paused|awaiting_confirmation|completed|partial|missed|rescheduled|dismissed
    started_at TEXT,
    ended_at TEXT,
    effective_seconds INTEGER NOT NULL DEFAULT 0,
    last_resume_at TEXT,
    blocks_json TEXT DEFAULT '[]',
    current_block INTEGER NOT NULL DEFAULT 0,
    questions_total INTEGER,
    questions_correct INTEGER,
    difficulty_note TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    recovery_of INTEGER,
    confirmed_at TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_date ON study_sessions(planned_date);
CREATE INDEX idx_sessions_status ON study_sessions(status);

CREATE TABLE question_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    discipline TEXT NOT NULL,
    topic TEXT DEFAULT '',
    total INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',        -- manual|qconcursos_csv|simulado|sessao|banco_local
    session_id INTEGER,
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX idx_qres_date ON question_results(date);

CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'topic',           -- topic|error|session
    ref_id INTEGER,
    discipline TEXT,
    topic TEXT DEFAULT '',
    stage INTEGER NOT NULL DEFAULT 1,             -- 1=D+1, 2=D+7, 3=D+30
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',       -- pending|done|dismissed
    done_at TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_reviews_due ON reviews(status, due_date);

CREATE TABLE flashcards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discipline TEXT DEFAULT 'Geral',
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',        -- manual|documento_local|ia|erro
    doc_id INTEGER,
    page INTEGER,
    ease REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL,
    last_reviewed TEXT,
    suspended INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_cards_due ON flashcards(suspended, due_date);

CREATE TABLE error_notebook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discipline TEXT NOT NULL,
    topic TEXT DEFAULT '',
    statement TEXT DEFAULT '',
    given_answer TEXT DEFAULT '',
    correct_answer TEXT DEFAULT '',
    explanation TEXT DEFAULT '',
    legal_basis TEXT DEFAULT '',                  -- só preencher com fundamento conferido
    cause TEXT DEFAULT '',
    cause_certainty TEXT DEFAULT 'provavel',      -- confirmada|provavel
    date TEXT NOT NULL,
    next_review TEXT,
    review_count INTEGER NOT NULL DEFAULT 0,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE question_bank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discipline TEXT DEFAULT 'Geral',
    topic TEXT DEFAULT '',
    statement TEXT NOT NULL,
    options_json TEXT NOT NULL DEFAULT '[]',
    answer_index INTEGER,
    explanation TEXT DEFAULT '',
    source TEXT NOT NULL DEFAULT 'ia',            -- ia|manual|documento
    doc_id INTEGER,
    created_at TEXT NOT NULL
);

CREATE TABLE goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    metric TEXT NOT NULL DEFAULT 'minutes',       -- minutes|questions|sessions|manual
    target REAL NOT NULL DEFAULT 0,
    period TEXT NOT NULL DEFAULT 'weekly',        -- weekly|monthly|custom
    start_date TEXT,
    end_date TEXT,
    manual_progress REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,                           -- preferencia|tarefa_atual|historico|documento
    key TEXT DEFAULT '',
    content TEXT NOT NULL,
    source TEXT DEFAULT 'usuario',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,                           -- user|assistant|system
    content TEXT NOT NULL,
    channel TEXT DEFAULT 'texto',                 -- texto|voz
    meta_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dedupe_key TEXT UNIQUE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    scheduled_for TEXT,
    shown_at TEXT,
    delivered_via TEXT,                           -- toast|app|silencioso
    read_at TEXT,
    action_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    ext TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    pages INTEGER NOT NULL DEFAULT 0,
    read_status TEXT NOT NULL DEFAULT 'full',     -- full|partial|unreadable
    warnings TEXT DEFAULT '',
    discipline TEXT,
    source TEXT NOT NULL DEFAULT 'local',         -- local|gdrive
    source_ref TEXT,
    text_chars INTEGER NOT NULL DEFAULT 0,
    imported_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_documents_sha ON documents(sha256);

CREATE TABLE doc_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page INTEGER NOT NULL DEFAULT 1,
    idx INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL
);
CREATE INDEX idx_chunks_doc ON doc_chunks(doc_id);

CREATE TABLE doc_derived (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,                           -- resumo|perguntas|flashcards|mapa|temas
    content TEXT NOT NULL,
    generator TEXT NOT NULL,                      -- local|ia:<modelo>
    created_at TEXT NOT NULL
);

CREATE TABLE news_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    home_url TEXT DEFAULT '',
    feed_url TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Tribunais',
    official INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_checked TEXT,
    last_ok TEXT,
    last_error TEXT
);

CREATE TABLE news_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER REFERENCES news_sources(id) ON DELETE SET NULL,
    source_name TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    published_at TEXT,
    event_date TEXT,
    summary TEXT DEFAULT '',
    category TEXT DEFAULT 'Geral',
    verification TEXT NOT NULL DEFAULT 'feed_oficial',  -- feed_oficial|feed_nao_oficial|manual
    fetched_at TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    relevant INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_news_pub ON news_items(published_at);

CREATE TABLE contests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org TEXT NOT NULL,
    role TEXT DEFAULT '',
    situation TEXT DEFAULT 'Não confirmado',
    edital_url TEXT DEFAULT '',
    registration_start TEXT,
    registration_end TEXT,
    exam_date TEXT,
    board TEXT DEFAULT '',
    favorite INTEGER NOT NULL DEFAULT 1,
    notes TEXT DEFAULT '',
    last_verified TEXT,
    verified_source TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE integrations (
    name TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'nao_configurado',
    detail TEXT DEFAULT '',
    updated_at TEXT
);

CREATE TABLE proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,                           -- aumento_carga|troca_ciclo
    payload_json TEXT NOT NULL DEFAULT '{}',
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',       -- pending|accepted|declined
    created_at TEXT NOT NULL,
    decided_at TEXT
);

CREATE TABLE backups_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL
);
"""),
    (2, "Busca de texto completo (FTS5) em documentos", """
CREATE VIRTUAL TABLE doc_fts USING fts5(text, content='doc_chunks', content_rowid='id', tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER doc_chunks_ai AFTER INSERT ON doc_chunks BEGIN
    INSERT INTO doc_fts(rowid, text) VALUES (new.id, new.text);
END;
CREATE TRIGGER doc_chunks_ad AFTER DELETE ON doc_chunks BEGIN
    INSERT INTO doc_fts(doc_fts, rowid, text) VALUES ('delete', old.id, old.text);
END;
CREATE TRIGGER doc_chunks_au AFTER UPDATE ON doc_chunks BEGIN
    INSERT INTO doc_fts(doc_fts, rowid, text) VALUES ('delete', old.id, old.text);
    INSERT INTO doc_fts(rowid, text) VALUES (new.id, new.text);
END;
"""),
]

LATEST_VERSION = MIGRATIONS[-1][0]

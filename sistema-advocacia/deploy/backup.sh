#!/usr/bin/env bash
# Backup consistente do banco + documentos (cifrados). Roda sozinho todo dia (cron criado pelo install.sh).
# Guarda os últimos 14 dias em deploy/backups. A chave DATA_KEY NÃO entra no backup (guarde-a à parte).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
DEST="${BACKUP_DIR:-$DIR/backups}"
mkdir -p "$DEST"

# cópia consistente do banco SQLite, feita pelo próprio sistema (seguro mesmo com o site em uso)
docker compose exec -T app node -e "
const { DatabaseSync } = require('node:sqlite'); const fs = require('fs');
fs.mkdirSync('/data/_bkp', { recursive: true });
fs.rmSync('/data/_bkp/advocacia.db', { force: true });
new DatabaseSync('/data/advocacia.db').exec(\"VACUUM INTO '/data/_bkp/advocacia.db'\");
"

ARQ="$DEST/advocacia-$(date +%F).tar.gz"
tar czf "$ARQ" -C "$DIR/data" _bkp uploads
find "$DEST" -name 'advocacia-*.tar.gz' -mtime +14 -delete
echo "$(date '+%F %T') backup ok: $ARQ ($(du -h "$ARQ" | cut -f1))"

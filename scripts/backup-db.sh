#!/bin/bash
# =============================================================================
# B11 · scripts/backup-db.sh
#
# Dump the MySQL database referenced by DATABASE_URL to a gzipped file under
# storage/backups/. Keep last 30 days, remove older. Exit non-zero on any
# failure so cron can alert.
#
# Cron example (Hostinger):
#   0 2 * * * cd /home/<user>/htdocs && bash scripts/backup-db.sh \
#               >> storage/logs/backup.log 2>&1
#
# DATABASE_URL format expected:
#   mysql://USER:PASSWORD@HOST:PORT/DATABASE
# Special chars in passwords are URL-decoded via Node so even passwords with
# @ : / characters work correctly.
# =============================================================================

set -euo pipefail

# ── Locate project root (scripts/ is one level deep) ─────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Load .env (without overwriting already-set vars) ─────────────────────────
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set. Cannot back up." >&2
  exit 1
fi

# ── Parse DATABASE_URL safely with Node (handles URL-encoded chars) ──────────
read -r DB_USER DB_PASS DB_HOST DB_PORT DB_NAME <<EOF
$(node -e "
  const u = new URL(process.env.DATABASE_URL);
  const port = u.port || '3306';
  const dbname = (u.pathname || '/').slice(1).split('?')[0];
  console.log([
    decodeURIComponent(u.username),
    decodeURIComponent(u.password),
    u.hostname,
    port,
    dbname,
  ].join(' '));
")
EOF

if [ -z "$DB_NAME" ] || [ -z "$DB_HOST" ]; then
  echo "❌ Could not parse DATABASE_URL. Check format: mysql://user:pass@host:port/dbname" >&2
  exit 1
fi

# ── Ensure backup directory exists ───────────────────────────────────────────
BACKUP_DIR="$PROJECT_ROOT/storage/backups"
mkdir -p "$BACKUP_DIR"

# ── Locate mysqldump ─────────────────────────────────────────────────────────
MYSQLDUMP="${MYSQLDUMP_BIN:-$(command -v mysqldump || true)}"
if [ -z "$MYSQLDUMP" ]; then
  echo "❌ mysqldump not found. Install mysql-client or set MYSQLDUMP_BIN." >&2
  exit 1
fi

# ── Run dump → gzip ──────────────────────────────────────────────────────────
TIMESTAMP="$(date +%Y-%m-%d-%H%M)"
OUTFILE="$BACKUP_DIR/${TIMESTAMP}-${DB_NAME}.sql.gz"

echo "▸ Backing up '$DB_NAME' from $DB_HOST:$DB_PORT → $OUTFILE"

# Pass password via env var so it doesn't appear in `ps` output.
# --single-transaction makes InnoDB dumps consistent without locking tables.
# --quick streams rows without buffering whole tables in memory.
# --routines + --triggers + --events captures stored procedures.
MYSQL_PWD="$DB_PASS" "$MYSQLDUMP" \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --default-character-set=utf8mb4 \
  --no-tablespaces \
  "$DB_NAME" \
  | gzip -9 > "$OUTFILE"

# ── Verify the dump is non-empty ─────────────────────────────────────────────
SIZE_BYTES="$(wc -c < "$OUTFILE" | tr -d ' ')"
if [ "$SIZE_BYTES" -lt 200 ]; then
  echo "❌ Backup file is suspiciously small (${SIZE_BYTES} bytes). Removing." >&2
  rm -f "$OUTFILE"
  exit 1
fi

SIZE_HUMAN="$(du -h "$OUTFILE" | cut -f1)"
echo "✅ Backup complete · ${SIZE_HUMAN} · $OUTFILE"

# ── Rotate: delete backups older than 30 days ────────────────────────────────
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.sql.gz' -mtime +30 -delete -print | wc -l | tr -d ' ')"
if [ "$DELETED" -gt 0 ]; then
  echo "🧹 Removed $DELETED backup(s) older than 30 days"
fi

echo "📦 Total backups on disk: $(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"

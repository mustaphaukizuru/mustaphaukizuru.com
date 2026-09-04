#!/bin/bash
# =============================================================================
# scripts/deploy.sh · the SSH deploy path, made transactional (T1-1)
#
# Run from the project root over SSH on the host:
#
#   cd <app dir> && bash scripts/deploy.sh [production|staging]
#
# Or via npm: `npm run deploy`
#
# WHICH PATH IS THIS
#   Production usually deploys through the hPanel Git button, which clones
#   master into a fresh hbuilds/versions/<uuid>/ and runs `npm install` and
#   `npm start`. That path NEVER runs this script. This script is the SSH
#   path for a deliberate deploy from the dev machine or the host shell, and
#   it is the one that can roll back. Both paths are written down in
#   docs/LAUNCH_HANDOVER_2026-08.md.
#
# THE BUNDLE IS TRACKED
#   public/ (assets/, index.html, sw.js, workbox-*.js) is committed — the
#   hPanel path never builds, and an ignored bundle took the site down once
#   (see the rationale block in .gitignore and docs/decisions/0001). So this
#   script does NOT build the SPA by default; it deploys the committed one.
#   Set DEPLOY_BUILD_SPA=1 to rebuild on the host anyway.
#
# WHAT IT DOES, IN ORDER
#   1. record PREV_SHA, pull the target branch (fast-forward only)
#   2. npm ci --omit=dev, then scripts/prisma-generate.js (same engine choice
#      as postinstall — a bare `npx prisma generate` picked a different one)
#   3. schema gate: scripts/check-db-drift.js must be clean (exit 2 = a table
#      or column would be DROPPED by db push → abort before touching the DB),
#      then a JSON snapshot of every table to the persistent backups dir
#   4. prisma db push — never with --accept-data-loss; MySQL DDL is not
#      transactional, which is why step 3's snapshot exists
#   5. raise the maintenance page (public/maintenance.flag → Apache 503),
#      restart, wait
#   6. gate: /api/v1/health must say database:ok AND scripts/smoke-test.sh
#      must pass. If either fails the CODE rolls back to PREV_SHA, the app is
#      restarted and re-checked, and the script exits 1 either way with a
#      clear line. The schema does not roll back; the snapshot is how.
#   7. drop the maintenance page
#
# Env: PORT, DEPLOY_WAIT_SECONDS (5), DEPLOY_BUILD_SPA (0), HEALTH_TOKEN
#      (forwarded to the smoke test for /health/deep), DEPLOY_SKIP_BACKUP=1
#      (only for a database you can lose).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Prefer .env's values if present (PORT, HEALTH_TOKEN, DATABASE_URL for the scripts).
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
fi

TARGET="${1:-${DEPLOY_TARGET:-production}}"
case "$TARGET" in
  production) BRANCH="master" ;;
  staging)    BRANCH="staging" ;;
  *) echo "❌ unknown target '$TARGET' (production|staging)"; exit 1 ;;
esac

PORT="${PORT:-3000}"
APP_NAME="${APP_NAME:-mustaphaukizuru}"
HEALTH_URL="${HEALTH_URL:-http://localhost:${PORT}/api/v1/health}"
BASE_URL="${BASE_URL:-http://localhost:${PORT}}"
WAIT="${DEPLOY_WAIT_SECONDS:-5}"
MAINT_FLAG="public/maintenance.flag"

PREV_SHA="$(git rev-parse HEAD)"
echo "▸ Deploying $TARGET from origin/$BRANCH · current $PREV_SHA · $(date)"

# ── helpers ──────────────────────────────────────────────────────────────────
is_passenger() {
  [ "${PASSENGER:-0}" = "1" ] && return 0
  [ -f tmp/restart.txt ] && return 0
  grep -qs "PassengerAppRoot\|PassengerNodejs\|PassengerEnabled" .htaccess public/.htaccess 2>/dev/null && return 0
  return 1
}

restart_app() {
  if is_passenger; then
    mkdir -p tmp && touch tmp/restart.txt
    echo "▸ Passenger restart requested (tmp/restart.txt)"
  elif command -v pm2 > /dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env || pm2 start src/server.js --name "$APP_NAME"
    pm2 save || true
  else
    echo "⚠️  Neither Passenger nor PM2 detected — falling back to detached node."
    mkdir -p storage/logs
    pkill -f "node src/server.js" || true
    nohup node src/server.js > storage/logs/stdout.log 2>&1 &
    disown || true
  fi
  echo "▸ Waiting ${WAIT}s for the server..."
  sleep "$WAIT"
}

# 200 AND database:ok — a 200 that says database:down is still an outage.
health_ok() {
  local body
  body="$(curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null)" || return 1
  case "$body" in
    *'"database":"ok"'*) return 0 ;;
    *) echo "   health body: $body"; return 1 ;;
  esac
}

wait_for_health() {
  local tries="${1:-6}"
  for i in $(seq 1 "$tries"); do
    if health_ok; then return 0; fi
    echo "   health not ready ($i/$tries)"
    sleep 5
  done
  return 1
}

maintenance_on()  { touch "$MAINT_FLAG"; echo "▸ Maintenance page raised"; }
maintenance_off() { rm -f "$MAINT_FLAG"; echo "▸ Maintenance page dropped"; }

rollback() {
  local reason="$1"
  echo
  echo "❌ $reason"
  echo "↩︎  Rolling code back to $PREV_SHA (the schema is NOT rolled back — restore from the pre-deploy snapshot if a column was added)"
  git reset --hard "$PREV_SHA"
  npm ci --omit=dev
  node scripts/prisma-generate.js
  restart_app
  if wait_for_health 6; then
    echo "✅ Rolled back and healthy at $PREV_SHA"
  else
    echo "❌ Still unhealthy after rollback — run: bash scripts/hostinger-recover.sh status"
  fi
  maintenance_off
  echo "❌ Deploy FAILED · $(date)"
  exit 1
}

# ── 1 · pull ──────────────────────────────────────────────────────────────────
echo "▸ Pulling origin/$BRANCH (fast-forward only)..."
git fetch origin "$BRANCH"
git pull --ff-only origin "$BRANCH"
NEW_SHA="$(git rev-parse HEAD)"
echo "▸ $PREV_SHA → $NEW_SHA"

# ── 2 · install + client ─────────────────────────────────────────────────────
echo "▸ Installing backend deps..."
npm ci --omit=dev

if [ "${DEPLOY_BUILD_SPA:-0}" = "1" ] && [ -d web ]; then
  echo "▸ DEPLOY_BUILD_SPA=1 — rebuilding the SPA on the host..."
  pushd web > /dev/null
  npm ci
  npm run build:seo
  popd > /dev/null
else
  if [ ! -f public/index.html ]; then
    rollback "public/index.html is missing — the committed bundle did not arrive with this checkout"
  fi
  echo "▸ Using the committed SPA bundle (public/index.html present)"
fi

echo "▸ Generating Prisma Client (same engine choice as postinstall)..."
node scripts/prisma-generate.js

# ── 3 · schema gate + snapshot ───────────────────────────────────────────────
echo "▸ Checking for schema drift (anything db push would DROP)..."
if ! node scripts/check-db-drift.js; then
  rollback "schema drift — db push would drop data. Fix the schema or migrate the data first."
fi

if [ "${DEPLOY_SKIP_BACKUP:-0}" = "1" ]; then
  echo "⚠️  DEPLOY_SKIP_BACKUP=1 — no pre-deploy snapshot"
else
  echo "▸ Pre-deploy snapshot..."
  BACKUP_DIR="$(node -e "console.log(require('./src/config/storagePaths').STORAGE_PATHS.backups)")"
  mkdir -p "$BACKUP_DIR"
  if ! node scripts/backup-db-json.js --out "$BACKUP_DIR/predeploy-$(date +%Y%m%dT%H%M%S).json"; then
    rollback "pre-deploy snapshot failed — not pushing a schema without one"
  fi
fi

# ── 4 · schema ───────────────────────────────────────────────────────────────
echo "▸ Pushing schema (the data-loss override is never passed)..."
if ! npx prisma db push; then
  rollback "prisma db push failed"
fi

# ── 5 · restart behind the maintenance page ──────────────────────────────────
maintenance_on
restart_app

# ── 6 · gate ─────────────────────────────────────────────────────────────────
echo "▸ Health gate: $HEALTH_URL"
if ! wait_for_health 6; then
  rollback "health gate failed after restart"
fi
echo "✅ Health OK"

if [ -f scripts/smoke-test.sh ]; then
  echo "▸ Smoke test..."
  if ! BASE="$BASE_URL" HEALTH_TOKEN="${HEALTH_TOKEN:-}" bash scripts/smoke-test.sh; then
    rollback "smoke test failed"
  fi
fi

# ── 7 · done ─────────────────────────────────────────────────────────────────
maintenance_off
echo
echo "✅ Deploy complete · $TARGET · $NEW_SHA · $(date)"

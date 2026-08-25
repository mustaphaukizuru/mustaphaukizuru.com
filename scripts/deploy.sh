#!/bin/bash
# =============================================================================
# B11 · scripts/deploy.sh
#
# Full deploy pipeline. Run from the project root over SSH on Hostinger:
#
#   cd /home/<user>/htdocs && bash scripts/deploy.sh
#
# Or via npm: `npm run deploy`
#
# What it does:
#   1. Pull latest from master
#   2. Install backend deps (omit dev)
#   3. Install + build frontend (uses build:seo if present, else build)
#   4. Generate Prisma Client
#   5. Push schema (idempotent — only applies if changed)
#   6. Restart server — Passenger (touch tmp/restart.txt) on Hostinger,
#      PM2 / detached node elsewhere
#   7. Smoke-test the live API
#
# Build output in public/ (assets/, index.html, sw.js, workbox-*.js) is NOT
# tracked in git — step 3 regenerates it on every deploy.
#
# Halts on any failure so you don't ship a broken build.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Prefer .env's PORT if present
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
fi

PORT="${PORT:-3000}"
APP_NAME="${APP_NAME:-mustaphaukizuru}"

echo "▸ Pulling latest..."
git pull origin master

echo "▸ Installing backend deps..."
npm ci --omit=dev

echo "▸ Installing + building frontend..."
if [ -d web ]; then
  pushd web > /dev/null
  npm ci
  # Use build:seo if defined in package.json, else fall back to build
  if node -e "process.exit(require('./package.json').scripts?.['build:seo'] ? 0 : 1)" 2>/dev/null; then
    npm run build:seo
  else
    npm run build
  fi
  popd > /dev/null
else
  echo "⚠️  No web/ directory — skipping frontend build"
fi

echo "▸ Generating Prisma Client..."
npx prisma generate

echo "▸ Pushing schema..."
npx prisma db push

echo "▸ Restarting server..."
# Hostinger runs the app under Phusion Passenger: a restart is requested by
# touching tmp/restart.txt (no PM2 on shared hosting). Detected via
# PASSENGER=1 in the environment or the Passenger markers on disk.
is_passenger() {
  [ "${PASSENGER:-0}" = "1" ] && return 0
  [ -f tmp/restart.txt ] && return 0
  grep -qs "PassengerAppRoot\|PassengerNodejs\|PassengerEnabled" .htaccess public/.htaccess 2>/dev/null && return 0
  return 1
}

if is_passenger; then
  mkdir -p tmp && touch tmp/restart.txt
  echo "▸ Passenger restart requested (tmp/restart.txt)"
elif command -v pm2 > /dev/null 2>&1; then
  # PM2 path — graceful restart, zero-downtime if cluster mode
  pm2 restart "$APP_NAME" --update-env || pm2 start src/server.js --name "$APP_NAME"
  pm2 save || true
else
  # Fallback: detached node. NOTE: this can spawn orphan processes on
  # repeated deploys without PM2 — install PM2 with `npm install -g pm2`
  # for non-Passenger hosts. See DEPLOY.md.
  echo "⚠️  Neither Passenger nor PM2 detected — falling back to detached node."
  mkdir -p storage/logs
  pkill -f "node src/server.js" || true
  nohup node src/server.js > storage/logs/stdout.log 2>&1 &
  disown || true
fi

echo "▸ Waiting for server to be ready..."
sleep "${DEPLOY_WAIT_SECONDS:-5}"

echo "▸ Running smoke test..."
HEALTH_URL="http://localhost:${PORT}/api/health"
if curl -fsS --max-time 5 "$HEALTH_URL" > /dev/null; then
  echo "✅ Health endpoint responsive"
else
  echo "❌ Health endpoint did not respond at $HEALTH_URL"
  exit 1
fi

# Optional full smoke test if it exists
if [ -f scripts/smoke-test.sh ]; then
  BASE="http://localhost:${PORT}" bash scripts/smoke-test.sh
fi

echo
echo "✅ Deploy complete · $(date)"

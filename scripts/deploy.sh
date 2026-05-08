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
#   1. Pull latest from main
#   2. Install backend deps (omit dev)
#   3. Install + build frontend (uses build:seo if present, else build)
#   4. Generate Prisma Client
#   5. Push schema (idempotent — only applies if changed)
#   6. Restart server via PM2 (falls back to detached node if PM2 missing)
#   7. Smoke-test the live API
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
git pull origin main

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
if command -v pm2 > /dev/null 2>&1; then
  # PM2 path — graceful restart, zero-downtime if cluster mode
  pm2 restart "$APP_NAME" --update-env || pm2 start src/server.js --name "$APP_NAME"
  pm2 save || true
else
  # Fallback: detached node. NOTE: this can spawn orphan processes on
  # repeated deploys without PM2 — install PM2 with `npm install -g pm2`
  # for production. See DEPLOY.md.
  echo "⚠️  PM2 not found — falling back to detached node. Install PM2 for proper process management."
  pkill -f "node src/server.js" || true
  nohup node src/server.js > storage/logs/stdout.log 2>&1 &
  disown || true
fi

echo "▸ Waiting for server to be ready..."
sleep 3

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

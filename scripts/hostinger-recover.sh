#!/bin/bash
# =============================================================================
# scripts/hostinger-recover.sh
#
# Recovery + status helper for the Hostinger / Passenger deployment.
# Replaces the ad-hoc root-level recover.sh / status_check.sh / bootlog.sh /
# restart_verify.sh / fix_modules.sh / restore_modules.sh scripts.
#
# Usage (over SSH on the Hostinger box):
#
#   bash scripts/hostinger-recover.sh status    # node_modules + app load check
#   bash scripts/hostinger-recover.sh log       # tail Passenger stderr.log
#   bash scripts/hostinger-recover.sh restart   # touch tmp/restart.txt + verify
#   bash scripts/hostinger-recover.sh recover   # npm ci + prisma generate + restart
#   bash scripts/hostinger-recover.sh reinstall # wipe node_modules, then recover
#
# Env:
#   PROJECT_ROOT   app directory (default: parent of this script)
#   NODE_BIN_DIR   extra PATH entry for Hostinger's alt-nodejs (auto-detected)
#   STDERR_LOG     Passenger stderr log (default: $PROJECT_ROOT/stderr.log)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
STDERR_LOG="${STDERR_LOG:-$PROJECT_ROOT/stderr.log}"
cd "$PROJECT_ROOT"

# Hostinger keeps Node outside the default PATH for SSH sessions.
NODE_BIN_DIR="${NODE_BIN_DIR:-}"
if [ -z "$NODE_BIN_DIR" ]; then
  for d in /opt/alt/alt-nodejs22/root/usr/bin /opt/alt/alt-nodejs20/root/usr/bin /opt/alt/alt-nodejs18/root/usr/bin; do
    [ -d "$d" ] && NODE_BIN_DIR="$d" && break
  done
fi
[ -n "$NODE_BIN_DIR" ] && export PATH="$NODE_BIN_DIR:$PATH"

# Load .env so prisma generate / npm see DATABASE_URL etc.
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
fi

restart_passenger() {
  mkdir -p tmp
  date > tmp/restart.txt
  echo "▸ Passenger restart requested (tmp/restart.txt touched)"
}

check_app_loads() {
  echo "▸ Loading src/app.js in-process..."
  if node -e "require('$PROJECT_ROOT/src/app'); console.log('app.js: OK'); process.exit(0)"; then
    return 0
  fi
  echo "❌ app.js failed to load — see error above"
  return 1
}

cmd_status() {
  echo "PROJECT_ROOT: $PROJECT_ROOT"
  echo "node: $(command -v node || echo missing) $(node -v 2>/dev/null || true)"
  if [ -d node_modules ]; then
    echo "node_modules: present"
    for pkg in express @prisma/client node-cron nodemailer; do
      if [ -d "node_modules/$pkg" ]; then echo "  ✓ $pkg"; else echo "  ✗ $pkg MISSING"; fi
    done
  else
    echo "node_modules: MISSING — run: bash scripts/hostinger-recover.sh recover"
    return 1
  fi
  check_app_loads
}

cmd_log() {
  if [ -f "$STDERR_LOG" ]; then
    echo "=== last 40 lines of $STDERR_LOG ==="
    tail -n 40 "$STDERR_LOG"
  else
    echo "no stderr.log at $STDERR_LOG"
  fi
}

cmd_recover() {
  echo "[1/3] npm ci (lockfile-strict, prod only)..."
  npm cache clean --force > /dev/null 2>&1 || true
  npm ci --omit=dev --ignore-scripts
  echo "[2/3] prisma generate..."
  npx prisma generate
  echo "[3/3] restart..."
  restart_passenger
  check_app_loads
  echo "✅ Recovery complete"
}

cmd_reinstall() {
  echo "▸ Removing node_modules..."
  rm -rf node_modules
  cmd_recover
}

case "${1:-status}" in
  status)    cmd_status ;;
  log)       cmd_log ;;
  restart)   restart_passenger; check_app_loads ;;
  recover)   cmd_recover ;;
  reinstall) cmd_reinstall ;;
  *)
    echo "usage: $0 {status|log|restart|recover|reinstall}" >&2
    exit 2 ;;
esac

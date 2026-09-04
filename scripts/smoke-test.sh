#!/bin/bash
# =============================================================================
# scripts/smoke-test.sh
#
# Post-deploy sanity check, used as the gate in deploy.sh (a failure there
# rolls the code back). Exits non-zero on the first thing that is wrong.
#
# Usage:
#   bash scripts/smoke-test.sh
#   BASE=https://mustaphaukizuru.com HEALTH_TOKEN=… bash scripts/smoke-test.sh
#
# Beyond the four GETs it always ran (T1-1):
#   - POST /api/v1/auth/login with bad credentials must answer 401 — proves
#     the JSON body parser, the auth path and the database read all work,
#     not just static serving
#   - GET /api/v1/health/deep with X-Health-Token must answer 200 — SMTP and
#     both gateways reachable (skipped with a warning when no token is set)
#   - /api/v1/health/jobs must not be 503 (a job stopped running)
# =============================================================================

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
HEALTH_TOKEN="${HEALTH_TOKEN:-}"

echo "▸ Smoke test against $BASE"
echo

FAILED=0

check_get() {
  local path="$1"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE$path" || echo 0)"
  if [ "$code" != "200" ]; then
    echo "❌ GET $path returned $code"
    FAILED=$((FAILED + 1))
  else
    echo "✅ GET $path"
  fi
}

for path in /api/v1/health /api/v1/products /api/v1/services /api/v1/portfolio; do
  check_get "$path"
done

# The database and the auth path, end to end: a wrong password is a 401,
# anything else (500, 503, a hang) means the app is not really up.
code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@example.invalid","password":"not-the-password"}' \
  "$BASE/api/v1/auth/login" || echo 0)"
if [ "$code" != "401" ]; then
  echo "❌ POST /api/v1/auth/login (bad credentials) returned $code, expected 401"
  FAILED=$((FAILED + 1))
else
  echo "✅ POST /api/v1/auth/login → 401"
fi

# Scheduled jobs: 503 here means a job is older than twice its interval.
code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE/api/v1/health/jobs" || echo 0)"
if [ "$code" != "200" ]; then
  echo "❌ GET /api/v1/health/jobs returned $code (a scheduled job is overdue)"
  FAILED=$((FAILED + 1))
else
  echo "✅ GET /api/v1/health/jobs"
fi

if [ -n "$HEALTH_TOKEN" ]; then
  code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -H "X-Health-Token: $HEALTH_TOKEN" "$BASE/api/v1/health/deep" || echo 0)"
  if [ "$code" != "200" ]; then
    echo "❌ GET /api/v1/health/deep returned $code (SMTP or a gateway is down, or the token is wrong)"
    FAILED=$((FAILED + 1))
  else
    echo "✅ GET /api/v1/health/deep"
  fi
else
  echo "⚠️  HEALTH_TOKEN not set — /api/v1/health/deep skipped"
fi

echo
if [ "$FAILED" -gt 0 ]; then
  echo "❌ $FAILED check(s) failed"
  exit 1
fi
echo "✅ All checks OK"

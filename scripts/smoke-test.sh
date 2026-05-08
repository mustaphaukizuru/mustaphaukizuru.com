#!/bin/bash
# =============================================================================
# B11 · scripts/smoke-test.sh
#
# Quick post-deploy sanity check. Hits the most critical public endpoints
# and exits non-zero on any non-200 response.
#
# Usage:
#   bash scripts/smoke-test.sh
#   BASE=https://mustaphaukizuru.com bash scripts/smoke-test.sh
#
# Note: /api/services and /api/portfolio endpoints exist as of B05/B06.
# /api/health uses the lightweight liveness check (no deep dependency probe).
# =============================================================================

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"

echo "▸ Smoke test against $BASE"
echo

FAILED=0
for path in /api/health /api/products /api/services /api/portfolio; do
  code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE$path" || echo 0)"
  if [ "$code" != "200" ]; then
    echo "❌ $path returned $code"
    FAILED=$((FAILED + 1))
  else
    echo "✅ $path"
  fi
done

echo
if [ "$FAILED" -gt 0 ]; then
  echo "❌ $FAILED endpoint(s) failed"
  exit 1
fi
echo "✅ All endpoints OK"

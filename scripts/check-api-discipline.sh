#!/usr/bin/env bash
# check-api-discipline.sh · Audit H-11
# Surfaces raw fetch() / direct axios.method() calls outside lib/api.js.
# Treated as warning by default — promote to error once exempted call
# sites have an explicit "// api-discipline:exempt" annotation.

set -euo pipefail

EXEMPT_RE='api-discipline:exempt|/\*\s*allow:raw-fetch\s*\*/'

# Raw fetch() outside lib/api.js, excluding comment-only lines
FETCH_HITS=$(grep -rEn 'await\s+fetch\s*\(|=\s*fetch\s*\(' web/src \
  --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null \
  | grep -v 'web/src/lib/api' \
  | grep -vE "$EXEMPT_RE" || true)

# Direct axios.method() outside lib/api.js
AXIOS_HITS=$(grep -rEn 'axios\.(get|post|put|patch|delete|request)\s*\(' web/src \
  --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null \
  | grep -v 'web/src/lib/api' \
  | grep -vE "$EXEMPT_RE" || true)

FETCH_COUNT=$(echo -n "$FETCH_HITS" | grep -c '^' || echo 0)
AXIOS_COUNT=$(echo -n "$AXIOS_HITS" | grep -c '^' || echo 0)

if [ "$FETCH_COUNT" -gt 0 ] || [ "$AXIOS_COUNT" -gt 0 ]; then
  echo "::warning::API-discipline drift detected (audit H-11)"
  echo ""
  echo "  Found $FETCH_COUNT raw fetch() and $AXIOS_COUNT direct axios.method()"
  echo "  calls outside web/src/lib/api.js. Some may be legitimate (blob"
  echo "  downloads, multipart uploads). Annotate with // api-discipline:exempt"
  echo "  on the same line if intentionally bypassing the centralized utility."
  echo ""
  if [ "$FETCH_COUNT" -gt 0 ]; then
    echo "  Raw fetch() sites:"
    echo "$FETCH_HITS" | head -20 | sed 's/^/    /'
  fi
  if [ "$AXIOS_COUNT" -gt 0 ]; then
    echo "  Direct axios sites:"
    echo "$AXIOS_HITS" | head -20 | sed 's/^/    /'
  fi
fi

echo "API-discipline gate complete (warnings allowed; promote to error per H-11 closure)"

#!/usr/bin/env bash
# =============================================================================
# scripts/check-bundle-fresh.sh · T1-7
#
# The SPA bundle under public/ is COMMITTED (see .gitignore's rationale block
# and docs/decisions/0001-tracked-spa-bundle.md): Hostinger's Git deploy
# clones master and never builds. So a change under web/src that is not
# accompanied by a rebuilt public/ is a change that does not ship — and until
# now nothing caught that.
#
# This compares the last commit that touched the frontend SOURCE with the
# last commit that touched the BUNDLE. If the source commit is strictly
# newer (the bundle commit is its ancestor and not the same), the bundle is
# stale. Commit-graph based, so it needs history (fetch-depth: 0 in CI) and
# makes no assumption that Vite output is byte-reproducible.
#
# Exit 0 = fresh, 1 = stale, 2 = cannot tell (shallow clone).
# =============================================================================
set -euo pipefail

# Unit tests under web/src are NOT source for this purpose. They cannot reach
# the bundle — nothing shipped imports a `.test.` module, and the built
# assets contain no reference to one (both checked, not assumed) — so a
# test-only commit was failing this gate and demanding a rebuild that
# produces an identical bundle plus 150 files of renamed-hash churn.
#
# The exclusion is deliberately narrow: only files whose names end in
# .test/.spec. Anything else under web/src still counts, which is the case
# ADR 0001 exists for.
SRC_PATHS=(
  web/src web/public web/index.html web/vite.config.js web/package-lock.json
  web/scripts/generate-sitemap.mjs
  ':(exclude)web/src/**/*.test.js'   ':(exclude)web/src/**/*.test.jsx'
  ':(exclude)web/src/**/*.spec.js'   ':(exclude)web/src/**/*.spec.jsx'
)
BUNDLE_PATHS=(public/index.html public/assets public/sw.js)

SRC_SHA="$(git log -1 --format=%H -- "${SRC_PATHS[@]}" 2>/dev/null || true)"
BUNDLE_SHA="$(git log -1 --format=%H -- "${BUNDLE_PATHS[@]}" 2>/dev/null || true)"

if [ -z "$SRC_SHA" ] || [ -z "$BUNDLE_SHA" ]; then
  echo "::warning::check-bundle-fresh: not enough history to compare (shallow clone?). SRC=$SRC_SHA BUNDLE=$BUNDLE_SHA"
  exit 2
fi

if [ "$SRC_SHA" = "$BUNDLE_SHA" ]; then
  echo "✅ bundle fresh — source and bundle last changed together in ${SRC_SHA:0:7}"
  exit 0
fi

# Is the bundle's last commit an ancestor of the source's last commit?
if git merge-base --is-ancestor "$BUNDLE_SHA" "$SRC_SHA"; then
  echo "❌ stale bundle: web/src changed in ${SRC_SHA:0:7} ($(git log -1 --format=%s "$SRC_SHA"))"
  echo "   but public/ was last rebuilt in ${BUNDLE_SHA:0:7} ($(git log -1 --format=%s "$BUNDLE_SHA"))."
  echo "   Run: cd web && npm run build:seo  — then commit public/ in the same change."
  exit 1
fi

echo "✅ bundle fresh — public/ (${BUNDLE_SHA:0:7}) is newer than or diverged from the last source change (${SRC_SHA:0:7})"
exit 0

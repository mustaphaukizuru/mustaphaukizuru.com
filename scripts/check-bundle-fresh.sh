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
# `web/public` is NOT in this list, and that is the second correction to it.
# It holds static files Vite copies VERBATIM into public/ — images, fonts,
# documents. Adding one does not change a single byte of the JS bundle, so
# the staleness question is meaningless for them and, worse, unanswerable: a
# rebuild produces no new commit for BUNDLE_PATHS, so the gate could never
# go green again. Four generated service covers hit exactly that.
#
# The failure mode those files DO have is a half-committed mirror — written
# to web/public but not to the root copy Express serves, which is the trap
# generate-product-covers.mjs documents. Part 3 below checks for that
# instead, which is the question worth asking.
SRC_PATHS=(
  web/src web/index.html web/vite.config.js web/package-lock.json
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
  # No early exit: freshness and integrity are separate questions and the
  # second one is checked below regardless of how the first was answered.
  FRESH_OK=1
fi

# Is the bundle's last commit an ancestor of the source's last commit?
if [ "${FRESH_OK:-0}" != "1" ] && git merge-base --is-ancestor "$BUNDLE_SHA" "$SRC_SHA"; then
  echo "❌ stale bundle: web/src changed in ${SRC_SHA:0:7} ($(git log -1 --format=%s "$SRC_SHA"))"
  echo "   but public/ was last rebuilt in ${BUNDLE_SHA:0:7} ($(git log -1 --format=%s "$BUNDLE_SHA"))."
  echo "   Run: cd web && npm run build:seo  — then commit public/ in the same change."
  exit 1
fi

# =============================================================================
# Part 2 · does the committed bundle actually RESOLVE?
#
# Freshness and integrity are different questions, and only the first one was
# being asked. `master` is in this state right now: public/index.html points at
# /assets/index-IfKybSJ8.js, and that file was never committed. Every other
# asset it references is there. The entry chunk is not.
#
# A browser served that gets a blank page — the server falls back to
# index.html for the missing .js, the browser refuses it on MIME type, and
# nothing boots. It is the same failure mode as the outage recorded in
# .gitignore's rationale block, arrived at from the other direction: not an
# ignored directory, but an incomplete commit of a tracked one.
#
# CI never caught it because the frontend job BUILDS the bundle and serves
# what it just built. Only Hostinger serves the committed one, and it finds
# out in production.
#
# Cheap to check, so it is checked on every run rather than only on the
# frontend job: every /assets/ URL in public/index.html must exist on disk.
# =============================================================================
missing=()
while IFS= read -r asset; do
  [ -z "$asset" ] && continue
  [ -f "public${asset}" ] || missing+=("$asset")
done < <(grep -oE '/assets/[A-Za-z0-9_.-]+\.(js|css)' public/index.html | sort -u)

if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ incomplete bundle: public/index.html references ${#missing[@]} file(s) that are not committed:"
  for a in "${missing[@]}"; do echo "     public${a}"; done
  echo "   A browser served this gets a blank page — the missing chunk falls back to"
  echo "   index.html and is refused on MIME type. Run: cd web && npm run build:seo"
  echo "   and commit ALL of public/, not just the files git happened to show as changed."
  exit 1
fi

echo "✅ bundle complete — every asset public/index.html references is committed"

# =============================================================================
# Part 3 · is the static mirror in sync?
#
# Two directories hold the same static files on purpose: `web/public` is what
# Vite serves in dev and copies on build (with emptyOutDir, which wipes the
# root first), and the repo-root `public/` is what Express serves in
# production. Writing one and not the other means the dev server 404s, or the
# next build deletes the file outright.
#
# Names and sizes, not hashes — enough to catch a file written to one side
# only or truncated on copy, and it stays fast over ~360 files.
# =============================================================================
unmirrored=()
while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  src="web/public/$rel"
  dst="public/$rel"
  if [ ! -f "$dst" ]; then
    unmirrored+=("missing:  $rel")
  elif [ "$(wc -c < "$src")" != "$(wc -c < "$dst")" ]; then
    unmirrored+=("differs:  $rel")
  fi
done < <(cd web/public 2>/dev/null && find . -type f | sed 's|^\./||' | sort)

if [ ${#unmirrored[@]} -gt 0 ]; then
  echo "❌ static mirror out of sync — ${#unmirrored[@]} file(s) in web/public/ are not in public/:"
  for f in "${unmirrored[@]}"; do echo "     $f"; done
  echo "   Vite serves web/public in dev; Express serves public/ in production."
  echo "   Copy the files across and commit both, or the asset 404s in one of them."
  exit 1
fi

echo "✅ static mirror in sync — every file in web/public/ is in public/"

if [ "${FRESH_OK:-0}" != "1" ]; then
  echo "✅ bundle fresh — public/ (${BUNDLE_SHA:0:7}) is newer than or diverged from the last source change (${SRC_SHA:0:7})"
fi
exit 0

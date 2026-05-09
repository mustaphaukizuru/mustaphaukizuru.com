#!/usr/bin/env bash
# check-legacy-palette.sh · Closes audit C-03
# Fails on legacy v2.x palette in shipping source. Migration-history
# comments (lines containing "was", "legacy", "previously") are exempt.

set -euo pipefail

LEGACY_PATTERN='(#420060|#634F40|#634f40|420060|634f40|ede4ef|EDE4EF)'
ANNOTATION_RE='\b(was|legacy|historical|mapping|previously|formerly|pre-v3)\b'

RAW_HITS=$(grep -rEn "$LEGACY_PATTERN" src web/src \
  --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
  --include='*.css' --include='*.html' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  --exclude-dir=REMEDIATION_KIT --exclude=check-legacy-palette.sh \
  2>/dev/null || true)

HITS=$(echo "$RAW_HITS" | grep -vE "$ANNOTATION_RE" || true)

if [ -n "$HITS" ]; then
  echo ""
  echo "::error::Legacy v2.x palette references found in shipping code"
  echo ""
  echo "  Retired: #420060 / #634F40 / bg-[#ede4ef]"
  echo "  Replace with v3.1 tokens: --color-violet / --color-charcoal /"
  echo "  --color-violet-pale / --color-mist"
  echo ""
  echo "  Offending lines:"
  echo "$HITS" | sed 's/^/    /'
  exit 1
fi

ARB_COUNT=$(grep -rEn '\b(bg|text|border|ring|fill|stroke|shadow|via|from|to)-\[#[0-9a-fA-F]{3,8}\]' web/src \
  --include='*.jsx' --include='*.tsx' --include='*.js' --include='*.ts' \
  --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null | wc -l || echo 0)

if [ "$ARB_COUNT" -gt 0 ]; then
  echo "::warning::$ARB_COUNT arbitrary Tailwind hex utilities still in use."
  echo "Tracked as audit M-05. Migrate to named tokens declared via @theme."
fi

echo "Palette gate passed - no legacy v2.x references in shipping code"

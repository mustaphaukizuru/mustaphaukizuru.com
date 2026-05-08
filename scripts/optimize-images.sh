#!/usr/bin/env bash
#
# optimize-images.sh
#
# Converts every .png / .jpg / .jpeg under web/public/images to WebP at q80,
# preserving the original alongside (so existing <img src=".png"> still works
# while you migrate them). After running, update <img> tags to use the .webp
# variant or wire in a <picture> fallback.
#
# Why: the project currently ships 11.9 MB of uncompressed PNG/JPG project
# screenshots. WebP at q80 typically cuts that to ~1.5–2 MB with no visible
# quality loss, dropping LCP and total transfer significantly.
#
# Requires: cwebp (Google's WebP encoder)
#   macOS:    brew install webp
#   Linux:    apt-get install webp
#   Windows:  https://developers.google.com/speed/webp/download
#
# Usage:
#   bash scripts/optimize-images.sh                   # dry run, prints what would happen
#   bash scripts/optimize-images.sh --apply           # actually convert
#   bash scripts/optimize-images.sh --apply --quality 85
#

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMG_DIR="$ROOT/web/public/images"

QUALITY=80
APPLY=0
for arg in "$@"; do
  case "$arg" in
    --apply)         APPLY=1 ;;
    --quality)       shift; QUALITY="$1" ;;
    --quality=*)     QUALITY="${arg#--quality=}" ;;
    *)               ;;
  esac
done

if ! command -v cwebp >/dev/null 2>&1; then
  echo "❌ cwebp not found. Install:"
  echo "   macOS:    brew install webp"
  echo "   Linux:    apt-get install webp"
  echo "   Windows:  https://developers.google.com/speed/webp/download"
  exit 1
fi

if [ ! -d "$IMG_DIR" ]; then
  echo "❌ Image directory not found: $IMG_DIR"
  exit 1
fi

TAG="[optimize]"
[ "$APPLY" -eq 0 ] && TAG="[optimize · DRY RUN]"
echo "$TAG cwebp quality=$QUALITY  source=$IMG_DIR"
echo

total_in=0
total_out=0
file_count=0

# Find every PNG / JPG that doesn't already have a sibling .webp
while IFS= read -r src; do
  webp="${src%.*}.webp"
  if [ -f "$webp" ]; then
    continue   # already converted
  fi

  size_in=$(stat -c %s "$src" 2>/dev/null || stat -f %z "$src")
  total_in=$((total_in + size_in))
  file_count=$((file_count + 1))

  if [ "$APPLY" -eq 1 ]; then
    cwebp -quiet -q "$QUALITY" -mt "$src" -o "$webp" || {
      echo "  ⚠️  cwebp failed: $src"
      continue
    }
    size_out=$(stat -c %s "$webp" 2>/dev/null || stat -f %z "$webp")
    total_out=$((total_out + size_out))
    pct=$(( 100 - (size_out * 100 / size_in) ))
    printf "  %6d KB → %6d KB  (-%2d%%)  %s\n" \
      $((size_in / 1024)) $((size_out / 1024)) "$pct" "${src#$ROOT/}"
  else
    printf "  would convert  %6d KB  %s\n" $((size_in / 1024)) "${src#$ROOT/}"
  fi
done < <(find "$IMG_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \))

echo
if [ "$APPLY" -eq 1 ]; then
  saved=$((total_in - total_out))
  pct=$(( total_in > 0 ? 100 - (total_out * 100 / total_in) : 0 ))
  printf "$TAG converted %d files · %d KB → %d KB  (saved %d KB · %d%%)\n" \
    "$file_count" $((total_in / 1024)) $((total_out / 1024)) $((saved / 1024)) "$pct"
  echo
  echo "Next steps:"
  echo "  1. Update <img src> tags to point at the .webp variants, OR"
  echo "  2. Wrap critical images in <picture> with a JPG/PNG fallback:"
  echo "       <picture>"
  echo "         <source srcset=\"/images/foo.webp\" type=\"image/webp\" />"
  echo "         <img src=\"/images/foo.jpg\" alt=\"...\" />"
  echo "       </picture>"
  echo "  3. After verifying, delete the original PNG/JPG to save bundle weight."
else
  printf "$TAG would convert %d files · %d KB total source\n" "$file_count" $((total_in / 1024))
  echo
  echo "Re-run with --apply to actually convert."
fi

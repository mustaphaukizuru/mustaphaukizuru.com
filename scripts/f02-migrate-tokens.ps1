# =============================================================================
# F02 · Batch 2 · Bulk token migration script (PowerShell)
#
# Migrates v2 brand tokens to v3.0 across web/src/ in two contexts:
#   1. Tailwind class form:  bg-[#420060]   ->  bg-violet
#   2. Raw CSS string form:  "#420060"      ->  "var(--color-violet)"
#                            #420060 (gradients, inline styles, etc.)
#
# Excludes web/src/assets/* (already-migrated brand SVGs).
#
# Compatible with Windows PowerShell 5.1 (the default on Windows 10/11).
#
# Usage (from project root):
#   .\scripts\f02-migrate-tokens.ps1 -DryRun     # preview only
#   .\scripts\f02-migrate-tokens.ps1             # apply changes
# =============================================================================

param(
    [string]$RootPath = "web/src",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ── Verify project root ──────────────────────────────────────────────────────
if (-not (Test-Path $RootPath)) {
    Write-Host "ERROR: '$RootPath' not found. Run this script from the project root." -ForegroundColor Red
    Write-Host "Expected to find:  web/src/" -ForegroundColor Yellow
    exit 1
}

# ── Tailwind class-form mappings ─────────────────────────────────────────────
# Note: PowerShell hash tables are case-insensitive by default, so each key
# only needs to appear once even though the codebase has both upper- and
# lower-case variants. The regex match is forced to case-sensitive below.
$ClassFormMap = [ordered]@{
    "#420060" = "violet"
    "#2d003f" = "violet-deep"
    "#634F40" = "charcoal-80"
    "#ede4ef" = "violet-pale"
    "#F7F9F4" = "mist"
    "#FFCCAF" = "terracotta"
    "#2E2F3A" = "charcoal"
    "#4A6CFA" = "azure"
}

# ── Raw CSS string-form mappings ─────────────────────────────────────────────
$CssFormMap = [ordered]@{
    "#420060" = "var(--color-violet)"
    "#2d003f" = "var(--color-violet-deep)"
    "#634F40" = "var(--color-charcoal-80)"
    "#ede4ef" = "var(--color-violet-pale)"
    "#F7F9F4" = "var(--color-mist)"
    "#FFCCAF" = "var(--color-terracotta)"
    "#2E2F3A" = "var(--color-charcoal)"
    "#4A6CFA" = "var(--color-azure)"
}

# ── Tailwind utility prefixes that take color-form values ────────────────────
$ClassPrefixes = @(
    "bg", "text", "border", "border-t", "border-r", "border-b", "border-l",
    "border-x", "border-y",
    "ring", "ring-offset",
    "outline",
    "divide",
    "from", "to", "via",
    "decoration",
    "placeholder",
    "shadow",
    "fill", "stroke",
    "caret",
    "accent",
    "focus:bg", "focus:text", "focus:border", "focus:ring", "focus:outline",
    "hover:bg", "hover:text", "hover:border", "hover:ring",
    "active:bg", "active:text", "active:border",
    "focus-visible:ring", "focus-visible:border",
    "group-hover:bg", "group-hover:text",
    "data-[state=open]:bg", "data-[state=open]:text"
)

# Build single regex of all prefixes
$prefixPattern = ($ClassPrefixes | ForEach-Object { [regex]::Escape($_) }) -join "|"

# ── Find target files ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  F02 - Batch 2 - Token migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Scanning $RootPath ..." -ForegroundColor Yellow

$files = Get-ChildItem -Path $RootPath -Recurse -Include *.jsx, *.js |
    Where-Object { $_.FullName -notmatch '[\\/]assets[\\/]' }

Write-Host "  Found $($files.Count) files to scan (excluding assets/)" -ForegroundColor Gray
Write-Host ""

# ── Stats ────────────────────────────────────────────────────────────────────
$stats = [ordered]@{}
foreach ($hex in $ClassFormMap.Keys) {
    $stats[$hex] = @{ ClassReplaced = 0; CssReplaced = 0 }
}

$filesModified = 0
$filesScanned = 0

# ── Process each file ────────────────────────────────────────────────────────
foreach ($file in $files) {
    $filesScanned++
    $original = Get-Content $file.FullName -Raw
    if ($null -eq $original) { continue }
    $content  = $original

    # Step 1: Tailwind class form
    foreach ($hex in $ClassFormMap.Keys) {
        $util = $ClassFormMap[$hex]
        $hexEscaped = [regex]::Escape($hex)

        # Pattern: <prefix>-[<hex>] or <prefix>-[<hex>]/<digits>
        # Use case-insensitive option (?i) so #634F40 and #634f40 both match.
        $pattern = "(?i)($prefixPattern)-\[$hexEscaped\](/\d+)?"
        $matches = [regex]::Matches($content, $pattern)
        if ($matches.Count -gt 0) {
            $stats[$hex].ClassReplaced += $matches.Count
            $content = [regex]::Replace($content, $pattern, "`${1}-$util`${2}")
        }
    }

    # Step 2: Raw CSS form
    foreach ($hex in $CssFormMap.Keys) {
        $cssVar = $CssFormMap[$hex]
        $hexEscaped = [regex]::Escape($hex)

        # Negative lookbehind (?<!\[) prevents replacing inside [#XXX].
        # Case-insensitive so both #634F40 and #634f40 match.
        $pattern = "(?i)(?<!\[)$hexEscaped\b"
        $matches = [regex]::Matches($content, $pattern)
        if ($matches.Count -gt 0) {
            $stats[$hex].CssReplaced += $matches.Count
            $content = [regex]::Replace($content, $pattern, $cssVar)
        }
    }

    if ($content -ne $original) {
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText($file.FullName, $content)
        }
        $filesModified++
    }
}

# ── Print summary ────────────────────────────────────────────────────────────
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host ""
Write-Host ("  {0,-12}  {1,8}  {2,8}  {3,8}" -f "Hex", "Class", "CSS", "Total") -ForegroundColor Yellow
Write-Host ("  {0,-12}  {1,8}  {2,8}  {3,8}" -f "------------", "--------", "--------", "--------") -ForegroundColor Gray

$totalClass = 0
$totalCss   = 0
foreach ($hex in $ClassFormMap.Keys) {
    $cls = $stats[$hex].ClassReplaced
    $css = $stats[$hex].CssReplaced
    $totalClass += $cls
    $totalCss   += $css
    Write-Host ("  {0,-12}  {1,8}  {2,8}  {3,8}" -f $hex, $cls, $css, ($cls + $css))
}

Write-Host ("  {0,-12}  {1,8}  {2,8}  {3,8}" -f "------------", "--------", "--------", "--------") -ForegroundColor Gray
Write-Host ("  {0,-12}  {1,8}  {2,8}  {3,8}" -f "TOTAL", $totalClass, $totalCss, ($totalClass + $totalCss)) -ForegroundColor Green
Write-Host ""
Write-Host "Files scanned:   $filesScanned" -ForegroundColor Gray
Write-Host "Files modified:  $filesModified" -ForegroundColor Gray

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY RUN - no files written. Re-run without -DryRun to apply." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review changes:  git diff --stat"
Write-Host "  2. Detailed diff:   git diff web/src/pages/Home.jsx"
Write-Host "  3. Build check:     cd web ; npm run build"
Write-Host "  4. Visual check:    Click around at http://localhost:5173"
Write-Host "  5. If all good:     git add -A ; git commit"
Write-Host "  6. If wrong:        git checkout -- web/src/   (reverts everything)"
Write-Host ""

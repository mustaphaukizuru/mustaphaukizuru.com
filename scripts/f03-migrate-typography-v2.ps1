# =============================================================================
# F03 - Batch 2 (v2) - Bulk typography migration with explicit UTF-8 encoding
#
# v2 fix: PowerShell 5.1's default encoding behavior corrupts non-ASCII
# characters (em-dashes, smart quotes, accented letters) when files are
# read with one encoding and written with another. This version forces
# UTF-8 (with BOM detection) on both read and write to prevent mojibake.
#
# Migrates ad-hoc font-size declarations across web/src/ to F03 v2 role classes.
#   text-[12px]   -> text-micro
#   text-[14px]   -> text-meta
#   text-[16px]   -> text-body
#   ... etc (full table below)
#
# Excludes web/src/assets/ and web/src/components/ui/typography.jsx.
#
# Compatible with Windows PowerShell 5.1.
#
# Usage (from project root):
#   .\scripts\f03-migrate-typography-v2.ps1 -DryRun     # preview only
#   .\scripts\f03-migrate-typography-v2.ps1             # apply changes
# =============================================================================

param(
    [string]$RootPath = "web/src",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ---- Verify project root ---------------------------------------------------
if (-not (Test-Path $RootPath)) {
    Write-Host "ERROR: '$RootPath' not found. Run this script from the project root." -ForegroundColor Red
    exit 1
}

# ---- Encoding helpers (the v2 fix) -----------------------------------------
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Utf8WithBom = New-Object System.Text.UTF8Encoding($true)

function Read-FileWithEncoding {
    param([string]$Path)

    # Read raw bytes to detect BOM
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)

    # Read content as UTF-8 explicitly (skip BOM if present)
    if ($hasBom) {
        $content = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    } else {
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    }

    return @{ Content = $content; HasBom = $hasBom }
}

function Write-FileWithEncoding {
    param(
        [string]$Path,
        [string]$Content,
        [bool]$HasBom
    )

    $encoding = if ($HasBom) { $Utf8WithBom } else { $Utf8NoBom }
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Test-MangledChars {
    param([string]$Content)

    # Detect double-encoded UTF-8 patterns (mojibake)
    return ($Content -match 'Ã¢â‚¬|Ã©|Ã¡|Ã­|Ã³|Ãº|Ã±|â€"|â€™|â€œ|â€\u009d|â‚¬')
}

# ---- Size -> role class mapping (definitive F03 v2 table) -----------------
$SizeMap = [ordered]@{
    # Display tier
    "6rem"      = "text-display"
    "5rem"      = "text-display"
    "3.8rem"    = "text-display"
    "3.6rem"    = "text-display"
    "3.4rem"    = "text-display"
    "3.2rem"    = "text-display"
    "3rem"      = "text-display"

    # Page tier (H1)
    "2.9rem"    = "text-page"
    "2.8rem"    = "text-page"
    "2.6rem"    = "text-page"
    "2.5rem"    = "text-page"
    "2.4rem"    = "text-page"
    "2.3rem"    = "text-page"
    "2.25rem"   = "text-page"
    "2.2rem"    = "text-page"
    "2.1rem"    = "text-page"
    "2.05rem"   = "text-page"
    "2rem"      = "text-page"
    "28px"      = "text-page"

    # Section tier (H2)
    "1.9rem"    = "text-section"
    "1.8rem"    = "text-section"
    "1.75rem"   = "text-section"
    "1.7rem"    = "text-section"
    "1.6rem"    = "text-section"
    "1.5rem"    = "text-section"
    "26px"      = "text-section"
    "24px"      = "text-section"
    "22px"      = "text-section"

    # Subsection tier (H3)
    "1.4rem"    = "text-subsection"
    "1.3rem"    = "text-subsection"
    "1.25rem"   = "text-subsection"
    "20px"      = "text-subsection"

    # Card tier
    "1.15rem"   = "text-card"
    "1.125rem"  = "text-card"
    "1.1rem"    = "text-card"
    "18px"      = "text-card"
    "17px"      = "text-card"

    # Body tier
    "1.05rem"   = "text-body"
    "1.02rem"   = "text-body"
    "1rem"      = "text-body"
    "16px"      = "text-body"
    "15px"      = "text-body"
    "0.95rem"   = "text-body"
    "0.93rem"   = "text-body"

    # Meta tier
    "0.87rem"   = "text-meta"
    "0.85rem"   = "text-meta"
    "14.5px"    = "text-meta"
    "14px"      = "text-meta"
    "13.5px"    = "text-meta"
    "13px"      = "text-meta"

    # Micro tier
    "0.78rem"   = "text-micro"
    "0.76rem"   = "text-micro"
    "12px"      = "text-micro"
    "11px"      = "text-micro"
    "10px"      = "text-micro"
    "0.67rem"   = "text-micro"
    "9px"       = "text-micro"
}

# ---- Tailwind responsive prefixes ------------------------------------------
$Prefixes = @("", "sm:", "md:", "lg:", "xl:", "2xl:", "hover:", "focus:", "group-hover:")
$prefixPattern = ($Prefixes | ForEach-Object { [regex]::Escape($_) }) -join "|"

# ---- Find target files -----------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  F03 - Batch 2 (v2) - UTF-8 safe migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Scanning $RootPath ..." -ForegroundColor Yellow

$files = Get-ChildItem -Path $RootPath -Recurse -Include *.jsx, *.js |
    Where-Object {
        $_.FullName -notmatch '[\\/]assets[\\/]' -and
        $_.Name -ne 'typography.jsx'
    }

Write-Host "  Found $($files.Count) files to scan (excluding assets/, typography.jsx)" -ForegroundColor Gray
Write-Host ""

# ---- Stats -----------------------------------------------------------------
$stats = [ordered]@{}
foreach ($size in $SizeMap.Keys) {
    $stats[$size] = 0
}
$totalReplaced = 0
$filesModified = 0
$filesScanned = 0
$encodingIssues = @()

# ---- Process each file -----------------------------------------------------
foreach ($file in $files) {
    $filesScanned++

    # Read with explicit UTF-8 (the v2 fix)
    try {
        $fileData = Read-FileWithEncoding -Path $file.FullName
        $original = $fileData.Content
        $hasBom = $fileData.HasBom
    }
    catch {
        Write-Host "  WARN: Failed to read $($file.FullName): $($_.Exception.Message)" -ForegroundColor Yellow
        continue
    }

    if ($null -eq $original) { continue }

    # Pre-flight: warn if file already has mangled characters (won't fix them
    # but won't make them worse either)
    if (Test-MangledChars -Content $original) {
        $encodingIssues += $file.FullName.Substring((Get-Location).Path.Length + 1)
    }

    $content = $original

    # Apply each known size mapping
    foreach ($size in $SizeMap.Keys) {
        $role = $SizeMap[$size]
        $sizeEscaped = [regex]::Escape($size)
        $pattern = "($prefixPattern)text-\[$sizeEscaped\]"

        $matches = [regex]::Matches($content, $pattern)
        if ($matches.Count -gt 0) {
            $stats[$size] += $matches.Count
            $totalReplaced += $matches.Count
            $content = [regex]::Replace($content, $pattern, "`${1}$role")
        }
    }

    # Write back ONLY if changed (preserves mtime on unchanged files)
    if ($content -ne $original) {
        # Sanity check: if migration somehow introduced mangled chars, refuse to save
        if ((Test-MangledChars -Content $content) -and -not (Test-MangledChars -Content $original)) {
            Write-Host "  ERROR: Migration introduced encoding issues in $($file.Name) - SKIPPING" -ForegroundColor Red
            continue
        }

        if (-not $DryRun) {
            try {
                Write-FileWithEncoding -Path $file.FullName -Content $content -HasBom $hasBom
            }
            catch {
                Write-Host "  ERROR: Failed to write $($file.FullName): $($_.Exception.Message)" -ForegroundColor Red
                continue
            }
        }
        $filesModified++
    }
}

# ---- Print summary ---------------------------------------------------------
Write-Host "Migration summary by tier:" -ForegroundColor Cyan
Write-Host ""

$byRole = [ordered]@{
    "text-display"    = 0
    "text-page"       = 0
    "text-section"    = 0
    "text-subsection" = 0
    "text-card"       = 0
    "text-body"       = 0
    "text-meta"       = 0
    "text-micro"      = 0
}
foreach ($size in $SizeMap.Keys) {
    $role = $SizeMap[$size]
    $byRole[$role] += $stats[$size]
}

Write-Host ("  {0,-18}  {1,8}" -f "Role", "Count") -ForegroundColor Yellow
Write-Host ("  {0,-18}  {1,8}" -f "------------------", "--------") -ForegroundColor Gray
foreach ($role in $byRole.Keys) {
    Write-Host ("  {0,-18}  {1,8}" -f $role, $byRole[$role])
}
Write-Host ("  {0,-18}  {1,8}" -f "------------------", "--------") -ForegroundColor Gray
Write-Host ("  {0,-18}  {1,8}" -f "TOTAL", $totalReplaced) -ForegroundColor Green
Write-Host ""

Write-Host "Files scanned:   $filesScanned" -ForegroundColor Gray
Write-Host "Files modified:  $filesModified" -ForegroundColor Gray

# Pre-existing encoding issues (informational only)
if ($encodingIssues.Count -gt 0) {
    Write-Host ""
    Write-Host "Note: $($encodingIssues.Count) file(s) had pre-existing encoding artifacts" -ForegroundColor Yellow
    Write-Host "      (mojibake from before this migration). Listed below." -ForegroundColor Yellow
    Write-Host "      The script preserved them as-is - it did not corrupt them." -ForegroundColor Yellow
    foreach ($f in $encodingIssues | Select-Object -First 5) {
        Write-Host "      - $f" -ForegroundColor DarkYellow
    }
}

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY RUN - no files written. Re-run without -DryRun to apply." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify encoding clean:"
Write-Host "     Get-ChildItem web\src -Recurse -Include *.jsx | Select-String -Pattern '\u00C3\u00A2|\u00C3\u00A9|\u00C3\u00AD' | Measure-Object"
Write-Host "  2. Build check:           cd web ; npm run build"
Write-Host "  3. Visual check:          http://localhost:5173"
Write-Host "  4. If wrong:              Restore from manual backup"
Write-Host ""

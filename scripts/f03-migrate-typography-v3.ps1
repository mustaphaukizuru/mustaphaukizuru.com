# =============================================================================
# F03 - Batch 2 (v3) - Bulk typography migration with explicit UTF-8 encoding
#
# v3 changes vs v2:
#   - Script source is PURE ASCII (no literal non-ASCII characters anywhere)
#   - Mangled-char detection uses [char] casts of code points instead of
#     literal corrupted strings, so the .ps1 file survives any transfer
#     method (paste / download / OneDrive sync / re-save) without itself
#     becoming corrupted.
#
# v2 fix retained:
#   - Reads files via [System.IO.File]::ReadAllBytes + UTF8.GetString
#   - Detects BOM presence and preserves it on write
#   - Writes via [System.IO.File]::WriteAllText with explicit UTF8Encoding
#   - Refuses to save files where migration introduced new mojibake
#
# Compatible with Windows PowerShell 5.1.
#
# Usage (from project root):
#   .\scripts\f03-migrate-typography-v3.ps1 -DryRun     # preview only
#   .\scripts\f03-migrate-typography-v3.ps1             # apply changes
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

# ---- Encoding helpers ------------------------------------------------------
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Utf8WithBom = New-Object System.Text.UTF8Encoding($true)

# Build mojibake detection pattern from code points (no literal chars in source).
# These are the most common double-encoded UTF-8 byte sequences:
#   U+00C3 (A-tilde) followed by U+00A2/A9/A1/AD/B3/BA/B1 = mangled accented letters
#   U+00E2 U+20AC U+00x = mangled em-dash / smart quotes / euro sign
$mangleChars = @(
    [char]0x00C3,   # A-tilde (lead byte of mangled accents)
    [char]0x00E2,   # a-circumflex (lead byte of mangled em-dash etc)
    [char]0x20AC,   # euro sign (often appears in mojibake patterns)
    [char]0x201A    # single low-9 quote (often appears in mojibake patterns)
)
$MangleRegex = [string]::Join("|", ($mangleChars | ForEach-Object { [regex]::Escape($_) }))

function Read-FileWithEncoding {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    if ($hasBom) {
        $content = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    } else {
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    }
    return @{ Content = $content; HasBom = $hasBom }
}

function Write-FileWithEncoding {
    param([string]$Path, [string]$Content, [bool]$HasBom)
    $encoding = if ($HasBom) { $Utf8WithBom } else { $Utf8NoBom }
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Test-MangledChars {
    param([string]$Content)
    return ($Content -match $MangleRegex)
}

# ---- Size -> role class mapping --------------------------------------------
$SizeMap = [ordered]@{
    "6rem"      = "text-display"
    "5rem"      = "text-display"
    "3.8rem"    = "text-display"
    "3.6rem"    = "text-display"
    "3.4rem"    = "text-display"
    "3.2rem"    = "text-display"
    "3rem"      = "text-display"
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
    "1.9rem"    = "text-section"
    "1.8rem"    = "text-section"
    "1.75rem"   = "text-section"
    "1.7rem"    = "text-section"
    "1.6rem"    = "text-section"
    "1.5rem"    = "text-section"
    "26px"      = "text-section"
    "24px"      = "text-section"
    "22px"      = "text-section"
    "1.4rem"    = "text-subsection"
    "1.3rem"    = "text-subsection"
    "1.25rem"   = "text-subsection"
    "20px"      = "text-subsection"
    "1.15rem"   = "text-card"
    "1.125rem"  = "text-card"
    "1.1rem"    = "text-card"
    "18px"      = "text-card"
    "17px"      = "text-card"
    "1.05rem"   = "text-body"
    "1.02rem"   = "text-body"
    "1rem"      = "text-body"
    "16px"      = "text-body"
    "15px"      = "text-body"
    "0.95rem"   = "text-body"
    "0.93rem"   = "text-body"
    "0.87rem"   = "text-meta"
    "0.85rem"   = "text-meta"
    "14.5px"    = "text-meta"
    "14px"      = "text-meta"
    "13.5px"    = "text-meta"
    "13px"      = "text-meta"
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
Write-Host "  F03 - Batch 2 (v3) - Typography migration" -ForegroundColor Cyan
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

    try {
        $fileData = Read-FileWithEncoding -Path $file.FullName
        $original = $fileData.Content
        $hasBom = $fileData.HasBom
    }
    catch {
        Write-Host "  WARN: Failed to read $($file.FullName)" -ForegroundColor Yellow
        continue
    }

    if ($null -eq $original) { continue }

    # Pre-flight check: warn if file already has mangled characters.
    $hadMojibake = Test-MangledChars -Content $original
    if ($hadMojibake) {
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

    # Write back ONLY if changed
    if ($content -ne $original) {
        # Sanity check: refuse to save if migration somehow introduced NEW mojibake
        $nowHasMojibake = Test-MangledChars -Content $content
        if ($nowHasMojibake -and -not $hadMojibake) {
            Write-Host "  ERROR: Migration introduced encoding issues in $($file.Name) - SKIPPING" -ForegroundColor Red
            continue
        }

        if (-not $DryRun) {
            try {
                Write-FileWithEncoding -Path $file.FullName -Content $content -HasBom $hasBom
            }
            catch {
                Write-Host "  ERROR: Failed to write $($file.FullName)" -ForegroundColor Red
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
Write-Host "  1. Encoding clean check:"
Write-Host "     `$count = (Get-ChildItem web\src -Recurse -Include *.jsx | Select-String -Pattern '\u00C3\u00A2|\u00C3\u00A9|\u00C3\u00AD').Count"
Write-Host "     Write-Host `"Mangled: `$count`""
Write-Host "  2. Build check:           cd web ; npm run build"
Write-Host ""

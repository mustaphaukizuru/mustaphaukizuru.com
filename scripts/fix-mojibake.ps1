# =============================================================================
# fix-mojibake.ps1 - Targeted mojibake repair
#
# Fixes UTF-8-as-Windows-1252 encoding artifacts (mojibake) across
# web/src/*.jsx and *.js files.
#
# Source is PURE ASCII (no literal non-ASCII chars) - safe to transfer.
# All mojibake patterns are constructed at runtime from code points.
# All file I/O uses explicit UTF-8 encoding (read + write, with BOM detection).
#
# Patterns repaired (53 total):
#   - Spanish accents (e/a/i/o/u acute, n-tilde, capitals)
#   - German umlauts (a/o/u/A/O/U)
#   - Turkish chars (I-dot, dotless-i, s-cedilla, g-breve)
#   - Cedillas (c, C)
#   - Punctuation (em-dash, en-dash, ellipsis, smart quotes, bullet)
#   - Symbols (degree, registered, copyright, trademark, arrow, euro, multiplication, middle-dot)
#   - Box-drawing characters (-, |, +, etc.)
#
# Usage (from project root):
#   .\scripts\fix-mojibake.ps1 -DryRun     # preview only
#   .\scripts\fix-mojibake.ps1             # apply changes
# =============================================================================

param(
    [string]$RootPath = "web/src",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path $RootPath)) {
    Write-Host "ERROR: '$RootPath' not found. Run this script from the project root." -ForegroundColor Red
    exit 1
}

# ---- Encoding helpers ------------------------------------------------------
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Utf8WithBom = New-Object System.Text.UTF8Encoding($true)

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

# ---- Mojibake repair table -------------------------------------------------
# IMPORTANT: order matters! Longer patterns (3-char) MUST be processed before
# shorter ones (2-char) to avoid partial matches breaking things.
# All 3-char patterns appear first, then 2-char patterns.
$Mappings = @(
    # ---- 3-char punctuation patterns (process FIRST to avoid 2-char prefix matches) ----
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x201D); Good = ([string][char]0x2014); Note = "em-dash" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x201C); Good = ([string][char]0x2013); Note = "en-dash" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x00A6); Good = ([string][char]0x2026); Note = "ellipsis" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x00A2); Good = ([string][char]0x2022); Note = "bullet" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x0153); Good = ([string][char]0x201C); Note = "left-double-quote" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x009D); Good = ([string][char]0x201D); Note = "right-double-quote" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x02DC); Good = ([string][char]0x2018); Note = "left-single-quote" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x2122); Good = ([string][char]0x2019); Note = "right-single-quote" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201E + [string][char]0x00A2); Good = ([string][char]0x2122); Note = "trademark" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x2020 + [string][char]0x2019); Good = ([string][char]0x2192); Note = "right-arrow" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201A + [string][char]0x00AC); Good = ([string][char]0x20AC); Note = "euro" }

    # ---- 3-char box-drawing patterns ----
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x20AC); Good = ([string][char]0x2500); Note = "box-h" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x201A); Good = ([string][char]0x2502); Note = "box-v" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x201D); Good = ([string][char]0x2514); Note = "box-up-right" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x02DC); Good = ([string][char]0x2518); Note = "box-up-left" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x0152); Good = ([string][char]0x250C); Note = "box-down-right" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x0153); Good = ([string][char]0x251C); Note = "box-vertical-right" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x00A4); Good = ([string][char]0x2524); Note = "box-vertical-left" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x00AC); Good = ([string][char]0x252C); Note = "box-down-horizontal" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x00B4); Good = ([string][char]0x2534); Note = "box-up-horizontal" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201D + [string][char]0x00BC); Good = ([string][char]0x253C); Note = "box-cross" }

    # ---- 2-char Spanish accents ----
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00A9); Good = ([string][char]0x00E9); Note = "e-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00A1); Good = ([string][char]0x00E1); Note = "a-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00AD); Good = ([string][char]0x00ED); Note = "i-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00B3); Good = ([string][char]0x00F3); Note = "o-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00BA); Good = ([string][char]0x00FA); Note = "u-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00B1); Good = ([string][char]0x00F1); Note = "n-tilde" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0081); Good = ([string][char]0x00C1); Note = "A-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x2030); Good = ([string][char]0x00C9); Note = "E-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x008D); Good = ([string][char]0x00CD); Note = "I-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x201C); Good = ([string][char]0x00D3); Note = "O-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0161); Good = ([string][char]0x00DA); Note = "U-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x2018); Good = ([string][char]0x00D1); Note = "N-tilde" }

    # ---- 2-char umlauts ----
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00BC); Good = ([string][char]0x00FC); Note = "u-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x009C); Good = ([string][char]0x00DC); Note = "U-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00B6); Good = ([string][char]0x00F6); Note = "o-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0096); Good = ([string][char]0x00D6); Note = "O-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00A4); Good = ([string][char]0x00E4); Note = "a-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0084); Good = ([string][char]0x00C4); Note = "A-umlaut" }

    # ---- 2-char cedillas ----
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00A7); Good = ([string][char]0x00E7); Note = "c-cedilla" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0087); Good = ([string][char]0x00C7); Note = "C-cedilla" }

    # ---- 2-char Turkish ----
    [PSCustomObject]@{ Bad = ([char]0x00C4 + [string][char]0x00B0); Good = ([string][char]0x0130); Note = "I-dot Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C4 + [string][char]0x00B1); Good = ([string][char]0x0131); Note = "i-dotless Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C5 + [string][char]0x009F); Good = ([string][char]0x015F); Note = "small-s-cedilla Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C5 + [string][char]0x009E); Good = ([string][char]0x015E); Note = "S-cedilla Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C4 + [string][char]0x009F); Good = ([string][char]0x011F); Note = "small-g-breve Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C4 + [string][char]0x009E); Good = ([string][char]0x011E); Note = "G-breve Turkish" }

    # ---- 2-char misc ----
    [PSCustomObject]@{ Bad = ([char]0x00C2 + [string][char]0x00B0); Good = ([string][char]0x00B0); Note = "degree" }
    [PSCustomObject]@{ Bad = ([char]0x00C2 + [string][char]0x00AE); Good = ([string][char]0x00AE); Note = "registered" }
    [PSCustomObject]@{ Bad = ([char]0x00C2 + [string][char]0x00A9); Good = ([string][char]0x00A9); Note = "copyright" }
    [PSCustomObject]@{ Bad = ([char]0x00C2 + [string][char]0x00B7); Good = ([string][char]0x00B7); Note = "middle-dot" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x2014); Good = ([string][char]0x00D7); Note = "multiplication-sign" }
)

# ---- Walk files ------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Mojibake repair" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Scanning $RootPath ..." -ForegroundColor Yellow

$files = Get-ChildItem -Path $RootPath -Recurse -Include *.jsx, *.js |
    Where-Object { $_.FullName -notmatch '[\\/]assets[\\/]' }

Write-Host "  Found $($files.Count) files to scan" -ForegroundColor Gray
Write-Host ""

# ---- Stats -----------------------------------------------------------------
$patternStats = @{}
foreach ($m in $Mappings) {
    $patternStats[$m.Note] = 0
}
$totalReplaced = 0
$filesModified = 0
$filesScanned = 0

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

    $content = $original

    # Apply each mapping in order (longer patterns first - already sorted in $Mappings)
    foreach ($m in $Mappings) {
        $bad = [string]$m.Bad
        $good = [string]$m.Good
        if ($content.Contains($bad)) {
            # Count occurrences
            $count = 0
            $idx = 0
            while ($true) {
                $idx = $content.IndexOf($bad, $idx)
                if ($idx -lt 0) { break }
                $count++
                $idx += $bad.Length
            }
            $patternStats[$m.Note] += $count
            $totalReplaced += $count
            $content = $content.Replace($bad, $good)
        }
    }

    # Write only if changed
    if ($content -ne $original) {
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
Write-Host "Repair summary:" -ForegroundColor Cyan
Write-Host ""
Write-Host ("  {0,-32}  {1,8}" -f "Pattern", "Fixed") -ForegroundColor Yellow
Write-Host ("  {0,-32}  {1,8}" -f "----------------", "--------") -ForegroundColor Gray

$any = $false
foreach ($m in $Mappings) {
    $count = $patternStats[$m.Note]
    if ($count -gt 0) {
        Write-Host ("  {0,-32}  {1,8}" -f $m.Note, $count)
        $any = $true
    }
}

if (-not $any) {
    Write-Host "  (no mojibake found - codebase is clean)" -ForegroundColor Green
} else {
    Write-Host ("  {0,-32}  {1,8}" -f "----------------", "--------") -ForegroundColor Gray
    Write-Host ("  {0,-32}  {1,8}" -f "TOTAL", $totalReplaced) -ForegroundColor Green
}

Write-Host ""
Write-Host "Files scanned:   $filesScanned" -ForegroundColor Gray
Write-Host "Files modified:  $filesModified" -ForegroundColor Gray

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY RUN - no files written. Re-run without -DryRun to apply." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify clean:    .\scripts\survey-mojibake.ps1   (should report 0)"
Write-Host "  2. Build check:     cd web ; npm run build"
Write-Host "  3. Visual check:    http://localhost:5173"
Write-Host ""

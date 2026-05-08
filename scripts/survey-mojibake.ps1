# =============================================================================
# survey-mojibake.ps1 - READ-ONLY mojibake diagnostic
#
# Walks every .jsx/.js file in web/src/ and reports actual mojibake patterns
# found, with file paths and counts. Does NOT modify any file.
#
# Use this first to know what real mojibake exists, then I deliver a targeted
# repair script for only the patterns we confirm are real.
#
# Source is PURE ASCII (no literal non-ASCII chars) - safe to transfer.
#
# Usage (from project root):
#   .\scripts\survey-mojibake.ps1
# =============================================================================

param(
    [string]$RootPath = "web/src"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path $RootPath)) {
    Write-Host "ERROR: '$RootPath' not found." -ForegroundColor Red
    exit 1
}

# ---- Mojibake patterns (all built from code points - no literal non-ASCII) ----
# Each entry: [PSCustomObject]@{ Bad; Good; Note }
# 'Bad' is the mojibake string (UTF-8 bytes read as Windows-1252)
# 'Good' is the correct character
$Mappings = @(
    # Spanish accents (most common)
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00A9); Good = [char]0x00E9; Note = "e-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00A1); Good = [char]0x00E1; Note = "a-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00AD); Good = [char]0x00ED; Note = "i-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00B3); Good = [char]0x00F3; Note = "o-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00BA); Good = [char]0x00FA; Note = "u-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00B1); Good = [char]0x00F1; Note = "n-tilde" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0081); Good = [char]0x00C1; Note = "A-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x2030); Good = [char]0x00C9; Note = "E-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x008D); Good = [char]0x00CD; Note = "I-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x201C); Good = [char]0x00D3; Note = "O-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0161); Good = [char]0x00DA; Note = "U-acute" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x2018); Good = [char]0x00D1; Note = "N-tilde" }
    # German/Turkish umlauts
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00BC); Good = [char]0x00FC; Note = "u-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x009C); Good = [char]0x00DC; Note = "U-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00B6); Good = [char]0x00F6; Note = "o-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0096); Good = [char]0x00D6; Note = "O-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00A4); Good = [char]0x00E4; Note = "a-umlaut" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0084); Good = [char]0x00C4; Note = "A-umlaut" }
    # Cedillas
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x00A7); Good = [char]0x00E7; Note = "c-cedilla" }
    [PSCustomObject]@{ Bad = ([char]0x00C3 + [string][char]0x0087); Good = [char]0x00C7; Note = "C-cedilla" }
    # Turkish-specific
    [PSCustomObject]@{ Bad = ([char]0x00C4 + [string][char]0x00B0); Good = [char]0x0130; Note = "I-dot Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C4 + [string][char]0x00B1); Good = [char]0x0131; Note = "i-dotless Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C5 + [string][char]0x009F); Good = [char]0x015F; Note = "small-s-cedilla Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C5 + [string][char]0x009E); Good = [char]0x015E; Note = "S-cedilla Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C4 + [string][char]0x009F); Good = [char]0x011F; Note = "small-g-breve Turkish" }
    [PSCustomObject]@{ Bad = ([char]0x00C4 + [string][char]0x009E); Good = [char]0x011E; Note = "G-breve Turkish" }
    # Punctuation (em-dash, en-dash, ellipsis, smart quotes, bullet)
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x201D); Good = [char]0x2014; Note = "em-dash" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x201C); Good = [char]0x2013; Note = "en-dash" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x00A6); Good = [char]0x2026; Note = "ellipsis" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x00A2); Good = [char]0x2022; Note = "bullet" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x0153); Good = [char]0x201C; Note = "left-double-quote" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x009D); Good = [char]0x201D; Note = "right-double-quote" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x02DC); Good = [char]0x2018; Note = "left-single-quote" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x20AC + [string][char]0x2122); Good = [char]0x2019; Note = "right-single-quote" }
    # Misc
    [PSCustomObject]@{ Bad = ([char]0x00C2 + [string][char]0x00B0); Good = [char]0x00B0; Note = "degree" }
    [PSCustomObject]@{ Bad = ([char]0x00C2 + [string][char]0x00AE); Good = [char]0x00AE; Note = "registered" }
    [PSCustomObject]@{ Bad = ([char]0x00C2 + [string][char]0x00A9); Good = [char]0x00A9; Note = "copyright" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201E + [string][char]0x00A2); Good = [char]0x2122; Note = "trademark" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x2020 + [string][char]0x2019); Good = [char]0x2192; Note = "right-arrow" }
    [PSCustomObject]@{ Bad = ([char]0x00E2 + [string][char]0x201A + [string][char]0x00AC); Good = [char]0x20AC; Note = "euro" }
)

# ---- Encoding helper -------------------------------------------------------
function Read-FileUtf8 {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    if ($hasBom) {
        return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    } else {
        return [System.Text.Encoding]::UTF8.GetString($bytes)
    }
}

# ---- Walk files ------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Mojibake survey (read-only)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Scanning $RootPath ..." -ForegroundColor Yellow

$files = Get-ChildItem -Path $RootPath -Recurse -Include *.jsx, *.js |
    Where-Object { $_.FullName -notmatch '[\\/]assets[\\/]' }

Write-Host "  Found $($files.Count) files to scan" -ForegroundColor Gray
Write-Host ""

# Track per-pattern stats
$patternStats = @{}
$samplePerPattern = @{}
foreach ($m in $Mappings) {
    $patternStats[$m.Note] = 0
    $samplePerPattern[$m.Note] = $null
}

$filesAffected = @{}

foreach ($file in $files) {
    try {
        $content = Read-FileUtf8 -Path $file.FullName
    }
    catch {
        continue
    }
    if ($null -eq $content) { continue }

    foreach ($m in $Mappings) {
        # Count occurrences of this mojibake pattern
        $idx = 0
        $count = 0
        while ($true) {
            $idx = $content.IndexOf($m.Bad, $idx)
            if ($idx -lt 0) { break }
            $count++
            $idx += $m.Bad.Length
        }
        if ($count -gt 0) {
            $patternStats[$m.Note] += $count
            $rel = $file.FullName.Substring((Get-Location).Path.Length + 1)
            if (-not $filesAffected.ContainsKey($rel)) { $filesAffected[$rel] = @{} }
            $filesAffected[$rel][$m.Note] = $count

            # Capture one sample line for this pattern (only first time we see it)
            if ($null -eq $samplePerPattern[$m.Note]) {
                $firstIdx = $content.IndexOf($m.Bad)
                $lineStart = $content.LastIndexOf("`n", $firstIdx)
                if ($lineStart -lt 0) { $lineStart = 0 } else { $lineStart++ }
                $lineEnd = $content.IndexOf("`n", $firstIdx)
                if ($lineEnd -lt 0) { $lineEnd = $content.Length }
                $line = $content.Substring($lineStart, $lineEnd - $lineStart).Trim()
                if ($line.Length -gt 100) {
                    $cutStart = [Math]::Max(0, $firstIdx - $lineStart - 30)
                    $cutLen = [Math]::Min(100, $line.Length - $cutStart)
                    $line = "..." + $line.Substring($cutStart, $cutLen) + "..."
                }
                $samplePerPattern[$m.Note] = @{ File = $rel; Line = $line }
            }
        }
    }
}

# ---- Print summary ---------------------------------------------------------
Write-Host "Results:" -ForegroundColor Cyan
Write-Host ""
Write-Host ("  {0,-32}  {1,8}" -f "Mojibake pattern", "Count") -ForegroundColor Yellow
Write-Host ("  {0,-32}  {1,8}" -f "----------------", "--------") -ForegroundColor Gray

$totalFound = 0
$foundAny = $false
foreach ($m in $Mappings) {
    $count = $patternStats[$m.Note]
    if ($count -gt 0) {
        Write-Host ("  {0,-32}  {1,8}" -f $m.Note, $count) -ForegroundColor Red
        $totalFound += $count
        $foundAny = $true
    }
}

if (-not $foundAny) {
    Write-Host "  (no mojibake patterns found)" -ForegroundColor Green
} else {
    Write-Host ("  {0,-32}  {1,8}" -f "----------------", "--------") -ForegroundColor Gray
    Write-Host ("  {0,-32}  {1,8}" -f "TOTAL", $totalFound) -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Files affected: $($filesAffected.Count) of $($files.Count)" -ForegroundColor Gray

# ---- Print samples ---------------------------------------------------------
if ($foundAny) {
    Write-Host ""
    Write-Host "Sample contexts:" -ForegroundColor Cyan
    Write-Host ""
    foreach ($m in $Mappings) {
        $count = $patternStats[$m.Note]
        if ($count -gt 0 -and $null -ne $samplePerPattern[$m.Note]) {
            $sample = $samplePerPattern[$m.Note]
            Write-Host "  $($m.Note) [$count occurrences] -> should be '$($m.Good)'"
            Write-Host "    $($sample.File)"
            Write-Host "    $($sample.Line)" -ForegroundColor DarkGray
            Write-Host ""
        }
    }
}

# ---- Print top affected files ---------------------------------------------
if ($filesAffected.Count -gt 0) {
    Write-Host "Top affected files:" -ForegroundColor Cyan
    Write-Host ""
    $sorted = $filesAffected.GetEnumerator() | Sort-Object { ($_.Value.Values | Measure-Object -Sum).Sum } -Descending | Select-Object -First 15
    foreach ($entry in $sorted) {
        $totalInFile = ($entry.Value.Values | Measure-Object -Sum).Sum
        Write-Host ("  {0,-50}  {1,4}" -f $entry.Key, $totalInFile)
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Survey complete (read-only - no files modified)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Paste this output and Claude will deliver a targeted repair script" -ForegroundColor Yellow
Write-Host "that fixes ONLY the patterns confirmed above, leaving any false-positive" -ForegroundColor Yellow
Write-Host "legitimate Unicode characters in the codebase untouched." -ForegroundColor Yellow
Write-Host ""

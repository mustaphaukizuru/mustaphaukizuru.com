# =============================================================================
# F03 - Batch 2 - Bulk typography migration script (PowerShell)
#
# Migrates ad-hoc font-size declarations across web/src/ to F03 v2 role classes.
#   text-[12px]   -> text-micro
#   text-[14px]   -> text-meta
#   text-[16px]   -> text-body
#   text-[18px]   -> text-card
#   text-[2.2rem] -> text-page
#   ... etc (full table below)
#
# Excludes web/src/assets/ and web/src/index.css.
#
# Compatible with Windows PowerShell 5.1 (the default on Windows 10/11).
#
# Usage (from project root):
#   .\scripts\f03-migrate-typography.ps1 -DryRun     # preview only
#   .\scripts\f03-migrate-typography.ps1             # apply changes
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

# ---- Size -> role class mapping (definitive F03 v2 table) -----------------
# Comprehensive table covering all 56 distinct sizes found in the codebase.
# Mappings follow the Perfect Fourth modular scale + nearest-tier rounding.
#
# Tier reference (the role classes from index.css):
#   text-display     38-50px  (clamp)   - hero / marketing
#   text-page        28-38px  (clamp)   - page H1
#   text-section     21-28px  (clamp)   - H2
#   text-subsection  18-21px  (clamp)   - H3
#   text-card        18px              - H4 / card title
#   text-lead        18px              - lead paragraph
#   text-body        16px              - body
#   text-meta        14px              - small / metadata
#   text-micro       12px              - caption / fine print
#   text-eyebrow     12px              - uppercase labels
$SizeMap = [ordered]@{
    # ---- Display tier (oversized decorative numbers, hero) ----
    "6rem"      = "text-display"     # 96px decorative (404 page)
    "5rem"      = "text-display"     # 80px decorative
    "3.8rem"    = "text-display"     # 60.8px
    "3.6rem"    = "text-display"     # 57.6px
    "3.4rem"    = "text-display"     # 54.4px
    "3.2rem"    = "text-display"     # 51.2px
    "3rem"      = "text-display"     # 48px (display lower edge)

    # ---- Page tier (H1) ----
    "2.9rem"    = "text-page"        # 46.4px
    "2.8rem"    = "text-page"        # 44.8px
    "2.6rem"    = "text-page"        # 41.6px
    "2.5rem"    = "text-page"        # 40px
    "2.4rem"    = "text-page"        # 38.4px
    "2.3rem"    = "text-page"        # 36.8px
    "2.25rem"   = "text-page"        # 36px
    "2.2rem"    = "text-page"        # 35.2px
    "2.1rem"    = "text-page"        # 33.6px
    "2.05rem"   = "text-page"        # 32.8px
    "2rem"      = "text-page"        # 32px (page lower edge)
    "28px"      = "text-page"        # 28px

    # ---- Section tier (H2) ----
    "1.9rem"    = "text-section"     # 30.4px
    "1.8rem"    = "text-section"     # 28.8px
    "1.75rem"   = "text-section"     # 28px (exact section)
    "1.7rem"    = "text-section"     # 27.2px
    "1.6rem"    = "text-section"     # 25.6px
    "1.5rem"    = "text-section"     # 24px (section lower)
    "26px"      = "text-section"
    "24px"      = "text-section"
    "22px"      = "text-section"

    # ---- Subsection tier (H3) ----
    "1.4rem"    = "text-subsection"  # 22.4px
    "1.3rem"    = "text-subsection"  # 20.8px
    "1.25rem"   = "text-subsection"  # 20px
    "20px"      = "text-subsection"

    # ---- Card tier (H4 / lead) ----
    "1.15rem"   = "text-card"        # 18.4px
    "1.125rem"  = "text-card"        # 18px
    "1.1rem"    = "text-card"        # 17.6px
    "18px"      = "text-card"
    "17px"      = "text-card"

    # ---- Body tier ----
    "1.05rem"   = "text-body"        # 16.8px
    "1.02rem"   = "text-body"        # 16.3px
    "1rem"      = "text-body"        # 16px
    "16px"      = "text-body"
    "15px"      = "text-body"
    "0.95rem"   = "text-body"        # 15.2px
    "0.93rem"   = "text-body"        # 14.9px

    # ---- Meta tier ----
    "0.87rem"   = "text-meta"        # 13.9px
    "0.85rem"   = "text-meta"        # 13.6px
    "14.5px"    = "text-meta"
    "14px"      = "text-meta"
    "13.5px"    = "text-meta"
    "13px"      = "text-meta"

    # ---- Micro tier ----
    "0.78rem"   = "text-micro"       # 12.5px
    "0.76rem"   = "text-micro"       # 12.2px
    "12px"      = "text-micro"
    "11px"      = "text-micro"       # rounds up to spec floor
    "10px"      = "text-micro"
    "0.67rem"   = "text-micro"       # 10.7px
    "9px"       = "text-micro"
}

# ---- Tailwind responsive prefixes that may carry text-[Xpx] ----------------
# Patterns: text-[Xpx], sm:text-[Xpx], md:text-[Xpx], lg:text-[Xpx], xl:text-[Xpx], 2xl:text-[Xpx]
# Hover/focus prefixes also possible but rare for font-size.
$Prefixes = @("", "sm:", "md:", "lg:", "xl:", "2xl:", "hover:", "focus:", "group-hover:")
$prefixPattern = ($Prefixes | ForEach-Object { [regex]::Escape($_) }) -join "|"

# ---- Find target files -----------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  F03 - Batch 2 - Typography migration" -ForegroundColor Cyan
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
$unmatchedFound = @()

# ---- Process each file -----------------------------------------------------
foreach ($file in $files) {
    $filesScanned++
    $original = Get-Content $file.FullName -Raw
    if ($null -eq $original) { continue }
    $content = $original

    # Step 1: Apply each known size mapping (with all responsive prefix variants)
    foreach ($size in $SizeMap.Keys) {
        $role = $SizeMap[$size]
        $sizeEscaped = [regex]::Escape($size)
        # Pattern: <prefix>text-[<size>]
        $pattern = "($prefixPattern)text-\[$sizeEscaped\]"

        $matches = [regex]::Matches($content, $pattern)
        if ($matches.Count -gt 0) {
            $stats[$size] += $matches.Count
            $totalReplaced += $matches.Count
            # Replace: <prefix>text-[<size>] -> <prefix><role>
            $content = [regex]::Replace($content, $pattern, "`${1}$role")
        }
    }

    # Step 2: Detect any remaining text-[Xpx] / text-[Xrem] / text-[Xem] that
    # wasn't in our table. Report (don't modify) so we can extend the table.
    $remaining = [regex]::Matches($content, "($prefixPattern)text-\[[0-9.]+(px|rem|em)\]")
    foreach ($m in $remaining) {
        $unmatchedFound += [pscustomobject]@{
            File = $file.FullName.Substring((Get-Location).Path.Length + 1)
            Match = $m.Value
        }
    }

    if ($content -ne $original) {
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText($file.FullName, $content)
        }
        $filesModified++
    }
}

# ---- Print summary ---------------------------------------------------------
Write-Host "Migration summary by tier:" -ForegroundColor Cyan
Write-Host ""

# Group stats by destination role for readability
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

# Per-source-size detail (top 15)
Write-Host "Top 15 source sizes by count:" -ForegroundColor Cyan
Write-Host ""
Write-Host ("  {0,-12}  {1,-18}  {2,8}" -f "Source", "Target", "Count") -ForegroundColor Yellow
Write-Host ("  {0,-12}  {1,-18}  {2,8}" -f "------", "------", "-----") -ForegroundColor Gray

$sorted = $stats.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 15
foreach ($entry in $sorted) {
    if ($entry.Value -gt 0) {
        Write-Host ("  text-[{0,-6}]  {1,-18}  {2,8}" -f $entry.Key, $SizeMap[$entry.Key], $entry.Value)
    }
}

Write-Host ""
Write-Host "Files scanned:   $filesScanned" -ForegroundColor Gray
Write-Host "Files modified:  $filesModified" -ForegroundColor Gray
Write-Host ""

# Unmatched sizes (sizes in code that aren't in our mapping table)
if ($unmatchedFound.Count -gt 0) {
    Write-Host "WARNING: Unmatched ad-hoc sizes found (not in mapping table):" -ForegroundColor Yellow
    $uniqueUnmatched = $unmatchedFound | Group-Object Match | Sort-Object Count -Descending
    foreach ($g in $uniqueUnmatched | Select-Object -First 10) {
        Write-Host ("  {0,-30}  ({1} occurrences)" -f $g.Name, $g.Count) -ForegroundColor Yellow
        foreach ($occ in ($g.Group | Select-Object -First 1)) {
            Write-Host "    in $($occ.File)" -ForegroundColor DarkGray
        }
    }
    Write-Host ""
    Write-Host "These will be left as-is. Tell Claude and the table will be extended." -ForegroundColor Yellow
} else {
    Write-Host "All ad-hoc sizes matched - codebase is now 100% on the F03 v2 scale." -ForegroundColor Green
}

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY RUN - no files written. Re-run without -DryRun to apply." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review changes:        git diff --stat   (or compare manually)"
Write-Host "  2. Build check:           cd web ; npm run build"
Write-Host "  3. Visual check:          Click around at http://localhost:5173"
Write-Host "  4. If all good:           Commit"
Write-Host "  5. If wrong:              Restore from manual backup"
Write-Host ""

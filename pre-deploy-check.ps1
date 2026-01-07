# ========================================
# IBIKI SMS - PRE-DEPLOYMENT SAFETY CHECK
# ========================================
# Run this BEFORE every deployment to catch issues

$ErrorActionPreference = "Stop"

function Write-Check { param($msg) Write-Host "[CHECK] $msg" -ForegroundColor Cyan }
function Write-Pass { param($msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }

$checks = @{
    Passed = 0
    Failed = 0
    Warnings = 0
}

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  PRE-DEPLOYMENT SAFETY CHECK          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check 1: Build exists
Write-Check "Build directory exists..."
if (Test-Path "dist/public") {
    Write-Pass "Build directory found"
    $checks.Passed++
} else {
    Write-Fail "Build directory not found! Run 'npm run build' first"
    $checks.Failed++
}

# Check 2: Critical files present
Write-Check "Critical files present..."
$criticalFiles = @(
    "dist/public/index.html",
    "dist/public/assets/index-C2lczEwA.js",
    "dist/public/assets/index-BkEmzITG.css"
)

$allPresent = $true
foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Pass "  ✓ $(Split-Path $file -Leaf)"
    } else {
        Write-Fail "  ✗ $(Split-Path $file -Leaf) MISSING"
        $allPresent = $false
    }
}

if ($allPresent) {
    $checks.Passed++
} else {
    $checks.Failed++
}

# Check 3: No sensitive files in git
Write-Check "Sensitive files not tracked..."
$sensitiveInGit = @(
    git ls-files "*.env" 2>$null
    git ls-files "*.pem" 2>$null
    git ls-files "*.key" 2>$null
    git ls-files "*password*" 2>$null
) | Where-Object { $_ }

if ($sensitiveInGit.Count -eq 0) {
    Write-Pass "No sensitive files in git"
    $checks.Passed++
} else {
    Write-Fail "Sensitive files found in git:"
    $sensitiveInGit | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    $checks.Failed++
}

# Check 4: .env.example exists
Write-Check ".env.example template exists..."
if (Test-Path ".env.example") {
    Write-Pass ".env.example found"
    $checks.Passed++
} else {
    Write-Warn ".env.example not found (should exist for reference)"
    $checks.Warnings++
}

# Check 5: Package dependencies up to date
Write-Check "Dependencies installed..."
if (Test-Path "node_modules") {
    Write-Pass "node_modules exists"
    $checks.Passed++
} else {
    Write-Fail "node_modules not found! Run 'npm install'"
    $checks.Failed++
}

# Check 6: Git status clean (or has staged changes)
Write-Check "Git repository status..."
$gitStatus = git status --short 2>$null
if ($null -eq $gitStatus) {
    Write-Pass "Git repository clean"
    $checks.Passed++
} else {
    Write-Warn "Uncommitted changes:"
    $gitStatus | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    $checks.Warnings++
}

# Check 7: Server connectivity
Write-Check "Server connectivity..."
$serverAlive = ssh root@151.243.109.66 "echo 'OK'" 2>&1
if ($serverAlive -eq 'OK') {
    Write-Pass "Server reachable"
    $checks.Passed++
} else {
    Write-Fail "Cannot connect to server"
    $checks.Failed++
}

# Check 8: File count consistency
Write-Check "File count consistency..."
$localCount = (Get-ChildItem "dist/public/assets" -File).Count
if ($localCount -gt 1400) {
    Write-Pass "Local build has $localCount files"
    $checks.Passed++
} else {
    Write-Warn "Local build has only $localCount files (expected ~1500)"
    $checks.Warnings++
}

# Summary
Write-Host "`n" + ("="*50) -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host ("="*50) -ForegroundColor Cyan

Write-Host "Passed:   $($checks.Passed)" -ForegroundColor Green
Write-Host "Failed:   $($checks.Failed)" -ForegroundColor Red
Write-Host "Warnings: $($checks.Warnings)" -ForegroundColor Yellow

if ($checks.Failed -gt 0) {
    Write-Host "`n❌ DEPLOYMENT NOT SAFE - Fix failures before deploying!" -ForegroundColor Red -BackgroundColor DarkRed
    exit 1
} elseif ($checks.Warnings -gt 0) {
    Write-Host "`n⚠️  DEPLOYMENT POSSIBLE - Review warnings" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "`n✅ DEPLOYMENT SAFE - All checks passed!" -ForegroundColor Green -BackgroundColor DarkGreen
    exit 0
}

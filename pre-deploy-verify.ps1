# =============================================================================
# PRE-DEPLOYMENT VERIFICATION
# =============================================================================
# Run this BEFORE deploying to catch common issues
#
# Usage: .\pre-deploy-verify.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "  PRE-DEPLOYMENT VERIFICATION" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

$errors = @()
$warnings = @()

# 1. Check if dist/ exists
Write-Host "`n[1] Checking build output..." -ForegroundColor Yellow
if (-not (Test-Path "dist/public/index.html")) {
    $errors += "dist/public/index.html not found - run 'npm run build' first"
} else {
    Write-Host "    [OK] dist/public/index.html exists" -ForegroundColor Green
}

if (-not (Test-Path "dist/index.js")) {
    $errors += "dist/index.js not found - run 'npm run build' first"
} else {
    $size = [math]::Round((Get-Item "dist/index.js").Length / 1KB, 0)
    Write-Host "    [OK] dist/index.js exists ($size KB)" -ForegroundColor Green
}

# 2. Check index.html references
Write-Host "`n[2] Checking asset references..." -ForegroundColor Yellow
$html = Get-Content "dist/public/index.html" -Raw

# Extract main JS bundle name
if ($html -match 'src="/assets/(index-[^"]+\.js)"') {
    $mainBundle = $Matches[1]
    if (Test-Path "dist/public/assets/$mainBundle") {
        Write-Host "    [OK] Main bundle: $mainBundle" -ForegroundColor Green
    } else {
        $errors += "Main bundle $mainBundle referenced but not found!"
    }
}

# Extract CSS bundle name
if ($html -match 'href="/assets/(index-[^"]+\.css)"') {
    $cssBundle = $Matches[1]
    if (Test-Path "dist/public/assets/$cssBundle") {
        Write-Host "    [OK] CSS bundle: $cssBundle" -ForegroundColor Green
    } else {
        $errors += "CSS bundle $cssBundle referenced but not found!"
    }
}

# 3. Count assets
Write-Host "`n[3] Counting assets..." -ForegroundColor Yellow
$jsCount = (Get-ChildItem "dist/public/assets/*.js" -ErrorAction SilentlyContinue).Count
$cssCount = (Get-ChildItem "dist/public/assets/*.css" -ErrorAction SilentlyContinue).Count
Write-Host "    [OK] $jsCount JavaScript files" -ForegroundColor Green
Write-Host "    [OK] $cssCount CSS files" -ForegroundColor Green

if ($jsCount -lt 50) {
    $warnings += "Low JS file count ($jsCount) - may be missing chunks"
}

# 4. Check for common chunk files
Write-Host "`n[4] Checking critical chunks..." -ForegroundColor Yellow
$criticalPatterns = @("Landing-*.js", "Login-*.js", "button-*.js", "card-*.js")
foreach ($pattern in $criticalPatterns) {
    $files = Get-ChildItem "dist/public/assets/$pattern" -ErrorAction SilentlyContinue
    if ($files.Count -gt 0) {
        Write-Host "    [OK] $pattern found" -ForegroundColor Green
    } else {
        $errors += "Critical chunk $pattern not found!"
    }
}

# 5. Check Git status
Write-Host "`n[5] Checking Git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain 2>&1
$uncommitted = ($gitStatus | Measure-Object -Line).Lines
if ($uncommitted -gt 0) {
    $warnings += "$uncommitted uncommitted changes - consider committing first"
    Write-Host "    [!] $uncommitted uncommitted changes" -ForegroundColor Yellow
} else {
    Write-Host "    [OK] Working directory clean" -ForegroundColor Green
}

# 6. Summary
Write-Host "`n=============================================" -ForegroundColor Cyan
if ($errors.Count -eq 0) {
    Write-Host "  VERIFICATION PASSED" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Cyan
    
    if ($warnings.Count -gt 0) {
        Write-Host "`nWarnings:" -ForegroundColor Yellow
        foreach ($w in $warnings) {
            Write-Host "  - $w" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`nReady to deploy! Run: .\deploy.ps1`n" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "  VERIFICATION FAILED" -ForegroundColor Red
    Write-Host "=============================================" -ForegroundColor Cyan
    
    Write-Host "`nErrors:" -ForegroundColor Red
    foreach ($e in $errors) {
        Write-Host "  - $e" -ForegroundColor Red
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "`nWarnings:" -ForegroundColor Yellow
        foreach ($w in $warnings) {
            Write-Host "  - $w" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`nFix these issues before deploying.`n" -ForegroundColor Red
    exit 1
}

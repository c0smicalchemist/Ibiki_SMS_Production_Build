# =============================================================================
# IBIKI SMS - BULLETPROOF DEPLOYMENT SCRIPT
# =============================================================================
# This script ensures ALL assets are deployed together to prevent
# "Failed to fetch dynamically imported module" errors.
#
# Usage: .\deploy.ps1
#        .\deploy.ps1 -SkipBuild    # If you already built
#        .\deploy.ps1 -FrontendOnly # Only deploy frontend
#        .\deploy.ps1 -BackendOnly  # Only deploy backend
# =============================================================================

param(
    [switch]$SkipBuild,
    [switch]$FrontendOnly,
    [switch]$BackendOnly,
    [string]$Server = "151.243.109.66"
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

function Write-Step { param($num, $text) Write-Host "`n[$num] $text" -ForegroundColor Cyan }
function Write-OK { param($text) Write-Host "    [OK] $text" -ForegroundColor Green }
function Write-Warn { param($text) Write-Host "    [!] $text" -ForegroundColor Yellow }
function Write-Fail { param($text) Write-Host "    [X] $text" -ForegroundColor Red }

Write-Host "`n" -NoNewline
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  IBIKI SMS - BULLETPROOF DEPLOYMENT" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "  Server: $Server" -ForegroundColor Gray
Write-Host "  Time:   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Magenta

# =============================================================================
# STEP 1: BUILD
# =============================================================================
if (-not $SkipBuild) {
    Write-Step "1/5" "Building application..."
    
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Build failed!"
        Write-Host $buildOutput -ForegroundColor Red
        exit 1
    }
    Write-OK "Build complete"
} else {
    Write-Step "1/5" "Skipping build (using existing dist/)"
}

# Verify build output exists
if (-not (Test-Path "dist/public/index.html")) {
    Write-Fail "dist/public/index.html not found! Run build first."
    exit 1
}
if (-not (Test-Path "dist/index.js")) {
    Write-Fail "dist/index.js not found! Run build first."
    exit 1
}

# =============================================================================
# STEP 2: CREATE ASSET ARCHIVE
# =============================================================================
Write-Step "2/5" "Creating asset archive..."

# Remove old archive
if (Test-Path "deploy-bundle.zip") { Remove-Item "deploy-bundle.zip" -Force }

# Count assets
$assetCount = (Get-ChildItem "dist/public/assets" -File).Count
Write-Host "    Found $assetCount assets to package" -ForegroundColor Gray

# Create zip with ALL frontend files
Compress-Archive -Path "dist/public/*" -DestinationPath "deploy-bundle.zip" -Force
$zipSize = [math]::Round((Get-Item "deploy-bundle.zip").Length / 1MB, 2)
Write-OK "Created deploy-bundle.zip ($zipSize MB, $assetCount assets)"

# =============================================================================
# STEP 3: UPLOAD FILES
# =============================================================================
Write-Step "3/5" "Uploading to server..."

if (-not $FrontendOnly) {
    Write-Host "    Uploading backend (dist/index.js)..." -ForegroundColor Gray
    scp dist/index.js "root@${Server}:/opt/ibiki-sms/dist/" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Backend uploaded"
    } else {
        Write-Fail "Backend upload failed!"
        exit 1
    }
}

if (-not $BackendOnly) {
    Write-Host "    Uploading frontend bundle ($zipSize MB)..." -ForegroundColor Gray
    scp deploy-bundle.zip "root@${Server}:/tmp/" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Frontend bundle uploaded"
    } else {
        Write-Fail "Frontend upload failed!"
        exit 1
    }
}

# =============================================================================
# STEP 4: EXTRACT AND DEPLOY ON SERVER
# =============================================================================
if (-not $BackendOnly) {
    Write-Step "4/5" "Extracting assets on server..."
    
    # Clear old assets and extract new ones atomically
    $extractCmd = @"
cd /opt/ibiki-sms/dist/public && \
rm -rf assets.backup 2>/dev/null; \
mv assets assets.backup 2>/dev/null; \
unzip -o /tmp/deploy-bundle.zip && \
rm -rf assets.backup && \
rm /tmp/deploy-bundle.zip && \
echo "Extracted successfully"
"@
    
    $result = ssh "root@$Server" $extractCmd 2>&1
    if ($result -match "Extracted successfully") {
        Write-OK "Assets extracted on server"
    } else {
        Write-Warn "Extraction may have had issues, restoring backup..."
        ssh "root@$Server" "cd /opt/ibiki-sms/dist/public && mv assets.backup assets 2>/dev/null"
        Write-Fail "Deployment failed, rolled back"
        exit 1
    }
}

# =============================================================================
# STEP 5: RESTART AND VERIFY
# =============================================================================
Write-Step "5/5" "Restarting services..."

# Restart PM2
Write-Host "    Restarting PM2..." -ForegroundColor Gray
ssh "root@$Server" "pm2 restart ibiki-sms" 2>&1 | Out-Null

# Reload nginx
Write-Host "    Reloading nginx..." -ForegroundColor Gray
ssh "root@$Server" "nginx -s reload 2>&1" | Out-Null

# Wait for startup
Write-Host "    Waiting for server startup..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Health check
$health = ssh "root@$Server" "curl -s http://127.0.0.1:5000/api/health" 2>&1
if ($health -match '"status":"healthy"') {
    Write-OK "Server is healthy!"
} else {
    Write-Warn "Health check unclear, please verify manually"
}

# Verify key assets exist
$keyAssets = ssh "root@$Server" "ls /opt/ibiki-sms/dist/public/assets/*.js 2>/dev/null | wc -l"
Write-OK "$keyAssets JavaScript assets deployed"

# =============================================================================
# SUMMARY
# =============================================================================
$Duration = (Get-Date) - $StartTime
$DurationStr = "{0:mm\:ss}" -f $Duration

Write-Host "`n=============================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Duration: $DurationStr" -ForegroundColor Gray
Write-Host "  Assets:   $assetCount files" -ForegroundColor Gray
Write-Host "  Server:   $Server" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Green
Write-Host "`n  Site: https://ibiki.run.place" -ForegroundColor Cyan
Write-Host "  Health: https://ibiki.run.place/api/health`n" -ForegroundColor Cyan

# Cleanup
Remove-Item "deploy-bundle.zip" -Force -ErrorAction SilentlyContinue

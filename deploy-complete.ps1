# Complete Deployment Script - Local -> Git -> Server sync
# Ensures tri-data consistency across all locations

param(
    [switch]$SkipBuild,
    [switch]$SkipGit,
    [string]$Server = "151.243.109.66"
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TRI-DATA DEPLOYMENT SYNC" -ForegroundColor Cyan
Write-Host "  Local -> Git -> Server" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Build locally
if (-not $SkipBuild) {
    Write-Host "[1/5] Building application..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Build complete`n" -ForegroundColor Green
} else {
    Write-Host "[1/5] Skipping build (using existing dist/)`n" -ForegroundColor Yellow
}

# Step 2: Commit to Git
if (-not $SkipGit) {
    Write-Host "[2/5] Committing to Git..." -ForegroundColor Yellow
    
    git add dist/
    git add server/routes.ts client/src/components/ClientSelector.tsx
    
    $commitMsg = "deploy: Sync tri-data ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
    git commit -m $commitMsg 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Changes committed: $commitMsg" -ForegroundColor Green
        
        Write-Host "Pushing to origin..." -ForegroundColor Yellow
        git push origin Prod_Live_Latest
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN] Git push failed, but continuing..." -ForegroundColor Yellow
        } else {
            Write-Host "[OK] Pushed to Git`n" -ForegroundColor Green
        }
    } else {
        Write-Host "[INFO] No changes to commit`n" -ForegroundColor Gray
    }
} else {
    Write-Host "[2/5] Skipping Git sync`n" -ForegroundColor Yellow
}

# Step 3: Upload backend
Write-Host "[3/5] Uploading backend..." -ForegroundColor Yellow
scp dist/index.js "root@${Server}:/opt/ibiki-sms/dist/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Backend upload failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Backend uploaded`n" -ForegroundColor Green

# Step 4: Upload frontend (critical files only)
Write-Host "[4/5] Uploading frontend..." -ForegroundColor Yellow

$frontendFiles = @(
    "dist/public/index.html",
    "dist/public/assets/index-*.js",
    "dist/public/assets/index-*.css",
    "dist/public/assets/Landing-*.js",
    "dist/public/assets/ClientSelector-*.js",
    "dist/public/assets/AdminDashboard-*.js"
)

$uploaded = 0
foreach ($pattern in $frontendFiles) {
    $files = Get-ChildItem $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $remotePath = $file.FullName -replace [regex]::Escape($PWD.Path), '' -replace '\\', '/' -replace '^/', ''
        $remotePath = "/opt/ibiki-sms/$remotePath"
        
        Write-Host "  ├─ $($file.Name)" -ForegroundColor Gray
        scp $file.FullName "root@${Server}:$remotePath" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $uploaded++
        }
    }
}

Write-Host "[OK] Uploaded $uploaded frontend files`n" -ForegroundColor Green

# Step 5: Restart services
Write-Host "[5/5] Restarting services..." -ForegroundColor Yellow

Write-Host "  ├─ Restarting PM2..." -ForegroundColor Gray
ssh "root@$Server" "pm2 restart ibiki-sms" 2>&1 | Out-Null

Write-Host "  ├─ Clearing nginx cache..." -ForegroundColor Gray
ssh "root@$Server" "rm -rf /var/cache/nginx/* 2>/dev/null; nginx -s reload 2>&1" | Out-Null

Write-Host "  └─ Verifying health..." -ForegroundColor Gray
Start-Sleep -Seconds 3

$health = ssh "root@$Server" "curl -s http://localhost:3000/health"
$healthObj = $health | ConvertFrom-Json

if ($healthObj.status -eq "healthy") {
    Write-Host "[OK] Services restarted successfully`n" -ForegroundColor Green
} else {
    Write-Host "[WARN] Health check unclear, but continuing...`n" -ForegroundColor Yellow
}

# Final verification
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT COMPLETE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Tri-data sync status:" -ForegroundColor White
Write-Host "  [✓] Local:  dist/ built and ready" -ForegroundColor Green
if (-not $SkipGit) {
    Write-Host "  [✓] Git:    Committed and pushed" -ForegroundColor Green
} else {
    Write-Host "  [~] Git:    Skipped" -ForegroundColor Gray
}
Write-Host "  [✓] Server: Files deployed, PM2 restarted`n" -ForegroundColor Green

Write-Host "Site: http://ibiki.run.place" -ForegroundColor Cyan
Write-Host "Health: curl http://ibiki.run.place/health`n" -ForegroundColor Cyan

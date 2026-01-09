# Fast Deploy Script - Uses rsync for incremental updates
# This is MUCH faster than ZIP + SCP as it only transfers changed files

param(
    [switch]$SkipBuild,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$server = "root@151.243.109.66"
$remotePath = "/opt/ibiki-sms/dist/public"

Write-Host "🚀 Fast Deploy to Production" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Build (unless skipped)
if (-not $SkipBuild) {
    Write-Host "`n📦 Building..." -ForegroundColor Yellow
    $buildStart = Get-Date
    Push-Location "client"
    npm run build 2>&1 | Out-Null
    Pop-Location
    $buildEnd = Get-Date
    Write-Host "✅ Build completed in $([math]::Round(($buildEnd - $buildStart).TotalSeconds, 1))s" -ForegroundColor Green
} else {
    Write-Host "`n⏭️  Skipping build (using existing dist/)" -ForegroundColor Yellow
}

# Step 2: Fast sync using rsync (only transfers changed files)
Write-Host "`n📤 Syncing files (rsync - only changed files)..." -ForegroundColor Yellow
$syncStart = Get-Date

# Use rsync for fast incremental sync
# -a = archive mode (recursive, preserves permissions, etc.)
# -z = compress during transfer
# -v = verbose (optional)
# --delete = remove files on destination that don't exist locally
# --progress = show progress

$rsyncArgs = @("-az", "--delete", "--progress")
if ($Verbose) { $rsyncArgs += "-v" }

$localPath = "dist/public/"
$result = & ssh $server "test -d $remotePath && echo 'exists'" 2>$null

# Check if rsync is available (Git Bash on Windows has it)
$rsyncPath = Get-Command rsync -ErrorAction SilentlyContinue

if ($rsyncPath) {
    # Use rsync (fastest method)
    Write-Host "Using rsync for fast sync..." -ForegroundColor Gray
    & rsync @rsyncArgs "${localPath}" "${server}:${remotePath}/"
} else {
    # Fallback: Use scp with only the assets folder (smaller transfer)
    Write-Host "rsync not found, using scp (slower)..." -ForegroundColor Gray
    
    # Only sync the assets folder and index.html (the parts that change)
    & scp -r "dist/public/index.html" "${server}:${remotePath}/"
    & scp -r "dist/public/favicon.png" "${server}:${remotePath}/"
    
    # For assets, we need to be smarter - get list of local and remote files
    $localAssets = Get-ChildItem "dist/public/assets" -Name | Sort-Object
    $remoteAssets = & ssh $server "ls $remotePath/assets 2>/dev/null" | Sort-Object
    
    # Find new files that need to be uploaded
    $newFiles = $localAssets | Where-Object { $_ -notin $remoteAssets }
    
    if ($newFiles.Count -gt 0) {
        Write-Host "Uploading $($newFiles.Count) new/changed assets..." -ForegroundColor Gray
        foreach ($file in $newFiles) {
            & scp "dist/public/assets/$file" "${server}:${remotePath}/assets/"
        }
    } else {
        Write-Host "No new assets to upload" -ForegroundColor Gray
    }
}

$syncEnd = Get-Date
Write-Host "✅ Sync completed in $([math]::Round(($syncEnd - $syncStart).TotalSeconds, 1))s" -ForegroundColor Green

# Step 3: Restart PM2
Write-Host "`n🔄 Restarting server..." -ForegroundColor Yellow
& ssh $server "pm2 restart ibiki-sms"

# Step 4: Verify
Write-Host "`n🔍 Verifying deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$status = & ssh $server "pm2 show ibiki-sms --no-color 2>/dev/null | grep status"
if ($status -match "online") {
    Write-Host "✅ Server is online!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Server status: $status" -ForegroundColor Yellow
}

$totalEnd = Get-Date
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host "   Total time: $([math]::Round(($totalEnd - (Get-Date).AddSeconds(-((Get-Date) - $buildStart).TotalSeconds)).TotalSeconds, 1))s" -ForegroundColor Cyan
Write-Host "   Site: https://ibiki.run.place" -ForegroundColor Cyan

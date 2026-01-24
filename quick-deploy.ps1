# Quick Deploy Script - Much faster than plain scp
# Uses zip compression for ~10x faster transfers
# Run: .\quick-deploy.ps1

$server = "root@151.243.109.66"
$remotePath = "/opt/ibiki-sms"

Write-Host "Building application..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nDeploying via zip (compressed upload)..." -ForegroundColor Cyan

# Deploy server code (small file, scp is fine)
Write-Host "  -> Server code..." -ForegroundColor Yellow
scp .\dist\index.js "${server}:${remotePath}/dist/"

# Deploy frontend using zip compression
Write-Host "  -> Frontend assets (zip stream)..." -ForegroundColor Yellow
Compress-Archive -Path .\dist\public\* -DestinationPath .\dist\public.zip -Force
scp .\dist\public.zip "${server}:${remotePath}/dist/"
ssh $server "cd ${remotePath}/dist && rm -rf public/* && unzip -o public.zip -d public && rm public.zip"

Write-Host "`nRestarting PM2..." -ForegroundColor Cyan
ssh $server "cd ${remotePath} && pm2 restart all"

Write-Host "`nDeploy complete!" -ForegroundColor Green

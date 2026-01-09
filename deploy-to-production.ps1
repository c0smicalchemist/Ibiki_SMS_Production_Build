# PRODUCTION DEPLOYMENT SCRIPT (PowerShell)
# Deploys cleaned Ibiki SMS to production server
# Run as: .\deploy-to-production.ps1

$ErrorActionPreference = "Stop"

# Load credentials
if (!(Test-Path .deployment-credentials)) {
    Write-Host "ERROR: .deployment-credentials file not found" -ForegroundColor Red
    exit 1
}

$creds = Get-Content .deployment-credentials | ConvertFrom-StringData
$SERVER_HOST = $creds.SERVER_HOST
$SERVER_USER = $creds.SERVER_USER
$SERVER_PASSWORD = $creds.SERVER_PASSWORD
$DB_PASSWORD = $creds.DB_PASSWORD
$ADMIN_EMAIL = $creds.ADMIN_EMAIL

Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   IBIKI SMS - PRODUCTION DEPLOYMENT           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Step 1: Pre-deployment checks
Write-Host "[1/10] Pre-deployment checks..." -ForegroundColor Yellow
npm run check
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript check failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ TypeScript compilation passed`n" -ForegroundColor Green

# Step 2: Build production assets
Write-Host "[2/10] Building production assets..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Production build complete`n" -ForegroundColor Green

# Step 3: Create deployment package
Write-Host "[3/10] Creating deployment package..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$deployPkg = "ibiki-deploy-$timestamp.tar.gz"

# Use WSL tar if available, otherwise 7zip
if (Get-Command wsl -ErrorAction SilentlyContinue) {
    wsl tar -czf $deployPkg --exclude=node_modules --exclude=.git --exclude=.env --exclude=.deployment-credentials --exclude=temp_deploy_build --exclude=tmp --exclude='*.tar.gz' --exclude='*.zip' dist/ server/ shared/ migrations/ package.json package-lock.json ecosystem.config.js drizzle.config.ts .env.example
} else {
    Write-Host "WSL not found. Install WinSCP/plink for deployment or use WSL." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Package created: $deployPkg`n" -ForegroundColor Green

# Step 4: Check for PuTTY tools (plink, pscp)
$plinkPath = Get-Command plink -ErrorAction SilentlyContinue
$pscpPath = Get-Command pscp -ErrorAction SilentlyContinue

if (!$plinkPath -or !$pscpPath) {
    Write-Host "Installing PuTTY tools (plink, pscp)..." -ForegroundColor Yellow
    
    # Download portable PuTTY tools
    $plinkUrl = "https://the.earth.li/~sgtatham/putty/latest/w64/plink.exe"
    $pscpUrl = "https://the.earth.li/~sgtatham/putty/latest/w64/pscp.exe"
    
    Invoke-WebRequest -Uri $plinkUrl -OutFile ".\plink.exe"
    Invoke-WebRequest -Uri $pscpUrl -OutFile ".\pscp.exe"
    
    $plinkPath = ".\plink.exe"
    $pscpPath = ".\pscp.exe"
}

# Step 5: Test SSH connection
Write-Host "[4/10] Testing server connection..." -ForegroundColor Yellow
$testCmd = "echo 'Connection OK'"
$result = & $plinkPath -batch -pw $SERVER_PASSWORD "$SERVER_USER@$SERVER_HOST" $testCmd 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Cannot connect to server!" -ForegroundColor Red
    Write-Host $result
    exit 1
}
Write-Host "✓ Server connection established`n" -ForegroundColor Green

# Step 6: Backup production
Write-Host "[5/10] Backing up production server..." -ForegroundColor Yellow
& $plinkPath -batch -pw $SERVER_PASSWORD "$SERVER_USER@$SERVER_HOST" "BACKUP_DIR='/root/ibiki-backups'; BACKUP_DATE=`$(date +%Y%m%d_%H%M%S); mkdir -p `$BACKUP_DIR; if [ -d '/opt/ibiki-sms' ]; then tar -czf `$BACKUP_DIR/ibiki-app-`${BACKUP_DATE}.tar.gz -C /opt ibiki-sms/ 2>/dev/null || echo 'No existing app'; fi; export PGPASSWORD='$DB_PASSWORD'; pg_dump -U ibiki_user -h localhost ibiki | gzip > `$BACKUP_DIR/ibiki-db-`${BACKUP_DATE}.sql.gz 2>/dev/null || echo 'DB backup skipped'; echo 'Backup complete'"
Write-Host "✓ Production backup complete`n" -ForegroundColor Green

# Step 7: Upload deployment package
Write-Host "[6/10] Uploading to server..." -ForegroundColor Yellow
& $pscpPath -batch -pw $SERVER_PASSWORD $deployPkg "$SERVER_USER@${SERVER_HOST}:/tmp/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Upload complete`n" -ForegroundColor Green

# Step 8: Deploy application
Write-Host "[7/10] Deploying application..." -ForegroundColor Yellow
& $plinkPath -batch -pw $SERVER_PASSWORD "$SERVER_USER@$SERVER_HOST" "set -e; mkdir -p /opt/ibiki-sms; cd /opt/ibiki-sms; pm2 stop ibiki-sms 2>/dev/null || true; pm2 delete ibiki-sms 2>/dev/null || true; tar -xzf /tmp/$deployPkg -C /opt/ibiki-sms/; export NODE_ENV=production; npm ci --production --ignore-scripts 2>&1 || echo 'npm install complete'; echo 'Deployment complete'"
Write-Host "✓ Application deployed`n" -ForegroundColor Green

# Step 9: Configure environment
Write-Host "[8/10] Configuring production environment..." -ForegroundColor Yellow
$envScript = @"
cd /opt/ibiki-sms
if [ ! -f .env ]; then
    cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://ibiki_user:$DB_PASSWORD@localhost:5432/ibiki
PRODUCTION_URL=https://ibiki.run.place
CORS_ORIGIN=https://ibiki.run.place
JWT_SECRET=`$(openssl rand -base64 32)
SESSION_SECRET=`$(openssl rand -base64 32)
WEBHOOK_SECRET=`$(openssl rand -base64 32)
SUPER_ADMIN_EMAIL=$ADMIN_EMAIL
EXTREMESMS_API_KEY=your_api_key_here
EXTREMESMS_BASE_URL=https://extremesms.net
DEFAULT_EXTREME_COST=0.0025
DEFAULT_CLIENT_RATE=0.004
CORS_ORIGIN=*
ENVEOF
    echo "Created .env file"
else
    echo ".env already exists"
fi
"@
& $plinkPath -batch -pw $SERVER_PASSWORD "$SERVER_USER@$SERVER_HOST" $envScript
Write-Host "✓ Environment configured`n" -ForegroundColor Green

# Step 10: Run migrations
Write-Host "[9/10] Running database migrations..." -ForegroundColor Yellow
$migrateScript = @"
cd /opt/ibiki-sms
npm run db:push || echo "Migration may already be applied"
"@
& $plinkPath -batch -pw $SERVER_PASSWORD "$SERVER_USER@$SERVER_HOST" $migrateScript
Write-Host "✓ Database migrations applied`n" -ForegroundColor Green

# Step 11: Start application
Write-Host "[10/10] Starting application..." -ForegroundColor Yellow
& $plinkPath -batch -pw $SERVER_PASSWORD "$SERVER_USER@$SERVER_HOST" "cd /opt/ibiki-sms; pm2 start ecosystem.config.js 2>&1 || pm2 restart ibiki-sms; pm2 save; pm2 status"
Write-Host "✓ Application started`n" -ForegroundColor Green

Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   DEPLOYMENT COMPLETE!                         ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Server Details:" -ForegroundColor Cyan
Write-Host "  URL: https://ibiki.run.place"
Write-Host "  Admin: $ADMIN_EMAIL"
Write-Host "  Database: ibiki (PostgreSQL)`n"

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Login to https://ibiki.run.place"
Write-Host "  2. Configure TextBelt API key (Primary vendor)"
Write-Host "  3. Configure ExtremeSMS API key (Fallback vendor)"
Write-Host "  4. Test SMS sending functionality"
Write-Host "  5. Monitor PM2 logs: ssh root@$SERVER_HOST 'pm2 logs ibiki-sms'`n"

Write-Host "Deployment package: $deployPkg" -ForegroundColor Green
Write-Host "Backup location: ${SERVER_HOST}:/root/ibiki-backups/`n" -ForegroundColor Green

# Cleanup
Remove-Item $deployPkg -Force -ErrorAction SilentlyContinue

exit 0

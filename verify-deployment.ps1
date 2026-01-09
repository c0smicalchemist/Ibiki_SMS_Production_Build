# POST-DEPLOYMENT VERIFICATION CHECKLIST
# Run after deployment to verify everything works

$SERVER = "151.243.109.66"
$PORT = "3000"

Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   POST-DEPLOYMENT VERIFICATION                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Test 1: Server responds
Write-Host "[1/8] Testing server HTTP response..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://${SERVER}:${PORT}/" -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Server is responding`n" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Server not responding: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Check if PM2 process is running: pm2 status`n" -ForegroundColor Yellow
}

# Test 2: API health check
Write-Host "[2/8] Testing API health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://${SERVER}:${PORT}/api/health" -TimeoutSec 5
    Write-Host "✓ API is healthy`n" -ForegroundColor Green
} catch {
    Write-Host "⚠ Health endpoint not available (may need to add it)`n" -ForegroundColor Yellow
}

# Test 3: Database connection
Write-Host "[3/8] Database connection..." -ForegroundColor Yellow
Write-Host "  Check server logs: pm2 logs ibiki-sms --lines 20`n" -ForegroundColor Cyan

# Test 4: Static assets
Write-Host "[4/8] Testing static assets..." -ForegroundColor Yellow
try {
    $assets = Invoke-WebRequest -Uri "http://${SERVER}:${PORT}/assets/" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✓ Static assets loading`n" -ForegroundColor Green
} catch {
    Write-Host "⚠ Static assets check failed (may be expected)`n" -ForegroundColor Yellow
}

Write-Host "`n═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "MANUAL VERIFICATION REQUIRED:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "[5/8] Login Test:" -ForegroundColor Yellow
Write-Host "  1. Open: http://${SERVER}:3000"
Write-Host "  2. Try login with: ibiki_dash@proton.me"
Write-Host "  3. Verify dashboard loads`n"

Write-Host "[6/8] Database Check:" -ForegroundColor Yellow
Write-Host "  SSH command: ssh root@${SERVER}"
Write-Host "  Then run: psql -U ibiki_user -d ibiki -c '\dt'"
Write-Host "  Should show tables: users, client_profiles, api_keys, etc.`n"

Write-Host "[7/8] PM2 Process:" -ForegroundColor Yellow
Write-Host "  SSH command: pm2 status"
Write-Host "  Should show 'ibiki-sms' as 'online'`n"

Write-Host "[8/8] Logs Review:" -ForegroundColor Yellow
Write-Host "  SSH command: pm2 logs ibiki-sms --lines 50"
Write-Host "  Check for errors or warnings`n"

Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "PRODUCTION HARDENING CHECKLIST:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════`n" -ForegroundColor Cyan

$checklist = @"
☐ Update ExtremeSMS API key in .env
☐ Configure Nginx reverse proxy:
   - Port 80 → 3000
   - Port 443 (SSL) → 3000
☐ Install SSL certificate (Let's Encrypt):
   certbot --nginx -d yourdomain.com
☐ Setup firewall rules (UFW):
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 22/tcp
   ufw enable
☐ Configure rate limiting in Nginx
☐ Setup automated backups (cron):
   0 2 * * * /root/backup-ibiki.sh
☐ Enable PM2 monitoring:
   pm2 install pm2-logrotate
☐ Configure external monitoring (UptimeRobot, etc.)
☐ Setup error alerting (email/Slack)
☐ Review and rotate all secrets/keys
"@

Write-Host $checklist

Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   Verification guide complete                  ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Green

# PowerShell script to restore Anveo vendor configuration on remote server
# Run this from Windows to fix the production server

$SERVER = "root@140.238.163.229"
$PROJECT_DIR = "/opt/ibiki-sms"

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Restoring Anveo Vendor Config" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Add Anveo to .env
Write-Host "Step 1: Adding Anveo environment variables to .env..." -ForegroundColor Yellow
ssh $SERVER @"
cd $PROJECT_DIR
if ! grep -q 'ANVEO_API_KEY' .env 2>/dev/null; then
  echo '' >> .env
  echo '# Anveo SMS Configuration' >> .env
  echo 'ANVEO_API_KEY=e601cd693610f9a621d46e92e5ac3752fc865c55' >> .env
  echo 'ANVEO_FROM_NUMBER=+19144080890' >> .env
  echo '✓ Added Anveo env vars'
else
  echo '✓ Anveo env vars already present'
fi
"@

# Step 2: Add Anveo API keys to pool
Write-Host ""
Write-Host "Step 2: Adding Anveo API keys to vendor_api_key_pool..." -ForegroundColor Yellow
ssh $SERVER @"
cd $PROJECT_DIR
ANVEO_COUNT=\$(PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -t -c \"SELECT COUNT(*) FROM vendor_api_key_pool WHERE vendor = 'anveo';\" | tr -d ' ')
if [ \"\$ANVEO_COUNT\" -eq \"0\" ]; then
  PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki << 'SQL'
INSERT INTO vendor_api_key_pool (vendor, api_key, name, is_active, priority, from_number) VALUES 
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #1 +19144080890', true, 1, '19144080890'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #2 +19144080870', true, 2, '19144080870'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo FL #3 +19046409006', true, 3, '19046409006'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo CO #4 +17204398855', true, 4, '17204398855')
ON CONFLICT (vendor, api_key, from_number) DO NOTHING;
SQL
  echo '✓ Added Anveo keys to pool'
else
  echo \"✓ Found \$ANVEO_COUNT Anveo keys in pool\"
fi
"@

# Step 3: Set active vendor to Anveo
Write-Host ""
Write-Host "Step 3: Setting active vendor to Anveo..." -ForegroundColor Yellow
ssh $SERVER @"
cd $PROJECT_DIR
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki << 'SQL'
INSERT INTO system_config (key, value) 
VALUES ('active_sms_vendor', 'anveo') 
ON CONFLICT (key) DO UPDATE SET value = 'anveo';
SQL
echo '✓ Set active vendor to anveo'
"@

# Step 4: Clear vendor_management cache
Write-Host ""
Write-Host "Step 4: Clearing vendor_management cache..." -ForegroundColor Yellow
ssh $SERVER @"
cd $PROJECT_DIR
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -c \"DELETE FROM system_config WHERE key = 'vendor_management';\"
echo '✓ Cleared vendor_management config'
"@

# Step 5: Rebuild server
Write-Host ""
Write-Host "Step 5: Rebuilding server..." -ForegroundColor Yellow
ssh $SERVER @"
cd $PROJECT_DIR
npm run build:server
echo '✓ Server rebuilt'
"@

# Step 6: Restart PM2
Write-Host ""
Write-Host "Step 6: Restarting PM2..." -ForegroundColor Yellow
ssh $SERVER @"
cd $PROJECT_DIR
pm2 restart ibiki-sms
sleep 3
echo '✓ PM2 restarted'
"@

# Step 7: Check logs
Write-Host ""
Write-Host "Step 7: Checking startup logs..." -ForegroundColor Yellow
ssh $SERVER @"
cd $PROJECT_DIR
pm2 logs ibiki-sms --lines 30 --nostream | grep -i 'vendor\|anveo\|initialized' || echo 'No vendor logs found yet'
"@

Write-Host ""
Write-Host "=================================" -ForegroundColor Green
Write-Host "✅ Anveo Restoration Complete!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open https://ibiki.run.place and login as admin" -ForegroundColor White
Write-Host "2. Go to SMS Vendor Configuration page" -ForegroundColor White
Write-Host "3. Verify that Anveo appears in the vendor list" -ForegroundColor White
Write-Host "4. Check that Anveo API keys appear in the API/Number Pool" -ForegroundColor White
Write-Host "5. Test sending an SMS via Anveo" -ForegroundColor White

#!/bin/bash
# Run this directly on the server: bash restore-anveo.sh

cd /opt/ibiki-sms

echo "Step 1: Adding Anveo to .env..."
if ! grep -q "ANVEO_API_KEY" .env 2>/dev/null; then
  cat >> .env << 'EOF'

# Anveo SMS Configuration
ANVEO_API_KEY=e601cd693610f9a621d46e92e5ac3752fc865c55
ANVEO_FROM_NUMBER=+19144080890
EOF
  echo "✓ Added Anveo env vars"
else
  echo "✓ Anveo env vars already present"
fi

echo ""
echo "Step 2: Adding Anveo keys to pool..."
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -c "DELETE FROM vendor_api_key_pool WHERE vendor = 'anveo';"
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -c "INSERT INTO vendor_api_key_pool (vendor, api_key, name, is_active, priority, from_number) VALUES ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #1 +19144080890', true, 1, '19144080890');"
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -c "INSERT INTO vendor_api_key_pool (vendor, api_key, name, is_active, priority, from_number) VALUES ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #2 +19144080870', true, 2, '19144080870');"
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -c "INSERT INTO vendor_api_key_pool (vendor, api_key, name, is_active, priority, from_number) VALUES ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo FL #3 +19046409006', true, 3, '19046409006');"
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -c "INSERT INTO vendor_api_key_pool (vendor, api_key, name, is_active, priority, from_number) VALUES ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo CO #4 +17204398855', true, 4, '17204398855');"
echo "✓ Added 4 Anveo keys"

echo ""
echo "Step 3: Setting active vendor..."
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -c "INSERT INTO system_config (key, value) VALUES ('active_sms_vendor', 'anveo') ON CONFLICT (key) DO UPDATE SET value = 'anveo';"
echo "✓ Set active vendor to anveo"

echo ""
echo "Step 4: Clearing vendor cache..."
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -c "DELETE FROM system_config WHERE key = 'vendor_management';"
echo "✓ Cleared vendor_management config"

echo ""
echo "Step 5: Rebuilding server..."
npm run build:server

echo ""
echo "Step 6: Restarting PM2..."
pm2 restart ibiki-sms

echo ""
echo "Step 7: Waiting for startup..."
sleep 5

echo ""
echo "Step 8: Checking logs..."
pm2 logs ibiki-sms --lines 50 --nostream | grep -i "vendor\|anveo\|initialized" || echo "Server started - check full logs with: pm2 logs"

echo ""
echo "================================="
echo "✅ Anveo Restoration Complete!"
echo "================================="

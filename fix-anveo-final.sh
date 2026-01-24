#!/bin/bash
# FINAL ANVEO FIX - Run this once and it does everything

set -e
cd /opt/ibiki-sms

echo "=========================================="
echo "FINAL ANVEO FIX - Starting..."
echo "=========================================="

# Step 1: Verify ANVEO in .env
echo "1. Checking .env for ANVEO..."
if ! grep -q "ANVEO_API_KEY" .env; then
  echo "Adding ANVEO to .env..."
  cat >> .env << 'EOF'

# Anveo SMS Configuration  
ANVEO_API_KEY=e601cd693610f9a621d46e92e5ac3752fc865c55
ANVEO_FROM_NUMBER=+19144080890
EOF
fi
echo "✓ ANVEO in .env"

# Step 2: Clear everything vendor-related from DB
echo ""
echo "2. Clearing old vendor configs..."
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki << 'SQL'
DELETE FROM system_config WHERE key = 'vendor_management';
DELETE FROM vendor_api_key_pool WHERE vendor = 'anveo';
INSERT INTO system_config (key, value) VALUES ('active_sms_vendor', 'anveo') ON CONFLICT (key) DO UPDATE SET value = 'anveo';
SQL
echo "✓ Cleared old configs"

# Step 3: Add Anveo API keys
echo ""
echo "3. Adding Anveo API keys to pool..."
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki << 'SQL'
INSERT INTO vendor_api_key_pool (vendor, api_key, name, is_active, priority, from_number) VALUES 
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #1 +19144080890', true, 1, '19144080890'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #2 +19144080870', true, 2, '19144080870'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo FL #3 +19046409006', true, 3, '19046409006'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo CO #4 +17204398855', true, 4, '17204398855');
SQL
echo "✓ Added 4 Anveo keys"

# Step 4: Rebuild server
echo ""
echo "4. Rebuilding server..."
npm run build:server
echo "✓ Server rebuilt"

# Step 5: Kill PM2 and restart fresh
echo ""
echo "5. Restarting PM2 with fresh environment..."
pm2 delete ibiki-sms || true
pm2 start ecosystem.config.cjs --update-env
sleep 8
echo "✓ PM2 restarted"

# Step 6: Verify everything
echo ""
echo "6. Verification..."
echo ""
echo "Active vendor in DB:"
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -t -c "SELECT value FROM system_config WHERE key = 'active_sms_vendor';"

echo ""
echo "Vendor config (showing first 3 vendors + active):"
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -t -c "SELECT value::jsonb->'vendors'->0->>'id' || ', ' || value::jsonb->'vendors'->1->>'id' || ', ' || value::jsonb->'vendors'->2->>'id' || ' | Active: ' || value::jsonb->>'activeVendorId' FROM system_config WHERE key = 'vendor_management';" || echo "Config will be generated on first API call"

echo ""
echo "Anveo keys count:"
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -t -c "SELECT COUNT(*) FROM vendor_api_key_pool WHERE vendor = 'anveo';"

echo ""
echo "PM2 Status:"
pm2 list

echo ""
echo "Recent logs (last 40 lines):"
pm2 logs ibiki-sms --lines 40 --nostream

echo ""
echo "=========================================="
echo "✅ ANVEO FIX COMPLETE!"
echo "=========================================="
echo ""
echo "Now:"
echo "1. Open https://ibiki.run.place in your browser"
echo "2. Login as admin"
echo "3. Go to SMS Vendor Configuration"
echo "4. Anveo should appear in the list"
echo "5. Test sending an SMS"

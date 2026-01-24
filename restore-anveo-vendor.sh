#!/bin/bash
# Restore Anveo Vendor Configuration

set -e

echo "================================="
echo "Restoring Anveo Vendor Config"
echo "================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "Error: Must run from project root"
  exit 1
fi

# Step 1: Update .env file if Anveo vars are missing
echo ""
echo "Step 1: Checking .env for Anveo configuration..."
if ! grep -q "ANVEO_API_KEY" .env 2>/dev/null; then
  echo "Adding Anveo environment variables to .env..."
  cat >> .env << 'EOF'

# Anveo SMS Configuration
ANVEO_API_KEY=e601cd693610f9a621d46e92e5ac3752fc865c55
ANVEO_FROM_NUMBER=+19144080890
EOF
  echo "✓ Added ANVEO_API_KEY and ANVEO_FROM_NUMBER"
else
  echo "✓ Anveo env vars already present"
fi

# Step 2: Check database for Anveo in vendor_api_key_pool
echo ""
echo "Step 2: Checking vendor_api_key_pool for Anveo keys..."
ANVEO_COUNT=$(PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -t -c "SELECT COUNT(*) FROM vendor_api_key_pool WHERE vendor = 'anveo';" | tr -d ' ')

if [ "$ANVEO_COUNT" -eq "0" ]; then
  echo "Inserting Anveo API keys into pool..."
  PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki << 'SQL'
INSERT INTO vendor_api_key_pool (vendor, api_key, name, is_active, priority, from_number) VALUES 
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #1 +19144080890', true, 1, '19144080890'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo NY #2 +19144080870', true, 2, '19144080870'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo FL #3 +19046409006', true, 3, '19046409006'),
  ('anveo', 'e601cd693610f9a621d46e92e5ac3752fc865c55', 'Anveo CO #4 +17204398855', true, 4, '17204398855')
ON CONFLICT (vendor, api_key, from_number) DO NOTHING;
SQL
  echo "✓ Added Anveo keys to pool"
else
  echo "✓ Found $ANVEO_COUNT Anveo keys in pool"
fi

# Step 3: Verify anveo_numbers table has data
echo ""
echo "Step 3: Checking anveo_numbers table..."
NUMBER_COUNT=$(PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -t -c "SELECT COUNT(*) FROM anveo_numbers WHERE status IN ('active', 'warming');" | tr -d ' ')
echo "✓ Found $NUMBER_COUNT active/warming numbers"

# Step 4: Check/update active vendor setting
echo ""
echo "Step 4: Setting active vendor to Anveo..."
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki << 'SQL'
INSERT INTO system_config (key, value) 
VALUES ('active_sms_vendor', 'anveo') 
ON CONFLICT (key) DO UPDATE SET value = 'anveo';
SQL
echo "✓ Set active vendor to anveo"

# Step 5: Clear vendor_management config to force reinitialization
echo ""
echo "Step 5: Clearing vendor_management cache to force reload..."
PGPASSWORD=c0smic4382 psql -h localhost -U ibiki_user -d ibiki -c "DELETE FROM system_config WHERE key = 'vendor_management';"
echo "✓ Cleared vendor_management config (will be regenerated from defaults)"

# Step 6: Rebuild server
echo ""
echo "Step 6: Rebuilding server..."
npm run build:server
echo "✓ Server rebuilt"

# Step 7: Restart PM2
echo ""
echo "Step 7: Restarting PM2 processes..."
pm2 restart ibiki-sms
sleep 3

# Step 8: Check logs
echo ""
echo "Step 8: Checking startup logs..."
pm2 logs ibiki-sms --lines 30 --nostream | grep -i "vendor\|anveo\|initialized"

echo ""
echo "================================="
echo "✅ Anveo Restoration Complete!"
echo "================================="
echo ""
echo "Next steps:"
echo "1. Open your browser and check the SMS Vendor Configuration page"
echo "2. Verify that Anveo appears in the vendor list"
echo "3. Check that the Anveo API keys appear in the API/Number Pool"
echo "4. Test sending an SMS via Anveo"

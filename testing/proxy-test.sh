#!/bin/bash
# Test SMS via Ibiki API (with proxy)
echo '=== Test SMS via Ibiki API with Proxy ==='

# Check recent logs for proxy usage
echo "1. Recent proxy usage in logs:"
pm2 logs ibiki-sms --lines 20 --nostream 2>&1 | grep -E 'Webshare|TextBelt|proxy' | tail -10

echo ""
echo "2. Testing proxy endpoint..."
# This would need auth token, so let's check the internal proxy rotation
curl -s http://127.0.0.1:5000/api/admin/queue/health | jq .

echo ""
echo "3. Checking if SMS worker is processing..."
curl -s http://127.0.0.1:5000/api/admin/queue/stats | jq '.stats.worker'

echo ""
echo "4. Recent TextBelt health checks (proves proxy is working):"
pm2 logs ibiki-sms --lines 50 --nostream 2>&1 | grep 'TextBelt Health' | tail -5

echo ""
echo "5. Message log count:"
export PGPASSWORD='c0smic4382'
psql -h localhost -U ibiki_user -d ibiki -t -c 'SELECT COUNT(*) FROM message_logs;'

echo ""
echo "6. Latest ExtremeSMS messages (recent sends):"
psql -h localhost -U ibiki_user -d ibiki -c "SELECT recipient, status, vendor, created_at FROM message_logs WHERE vendor='extremesms' ORDER BY created_at DESC LIMIT 3;"

echo ""
echo "=== Test Complete ==="

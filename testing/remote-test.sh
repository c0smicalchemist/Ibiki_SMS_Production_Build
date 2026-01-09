#!/bin/bash
echo '=== Comprehensive API Testing ==='

# 1. Test health endpoints
echo ''
echo '1. Health Endpoints...'
echo '--- Main Health ---'
curl -s http://127.0.0.1:5000/api/health | jq -c .
echo '--- Liveness ---'
curl -s http://127.0.0.1:5000/health/live | jq -c .
echo '--- Readiness ---'
curl -s http://127.0.0.1:5000/health/ready | jq -c .

# 2. Test queue
echo ''
echo '2. Queue Status...'
curl -s http://127.0.0.1:5000/api/admin/queue/health | jq -c .

# 3. Test TextBelt quota
echo ''
echo '3. TextBelt Quota...'
curl -s "https://textbelt.com/quota/a30321d80c30ac142e640dc2d1a2aa4c3dde81d8DhHW1zKrWnE4QZDyr1RQsH04t" | jq -c .

# 4. Check recent message logs
echo ''
echo '4. Recent Message Logs...'
export PGPASSWORD='c0smic4382'
psql -h localhost -U ibiki_user -d ibiki -t -c 'SELECT COUNT(*) as total_messages FROM message_logs;'
psql -h localhost -U ibiki_user -d ibiki -c 'SELECT id, recipient, status, vendor, created_at FROM message_logs ORDER BY created_at DESC LIMIT 3;'

# 5. Check webhook configs
echo ''
echo '5. Webhook Configurations...'
psql -h localhost -U ibiki_user -d ibiki -c "SELECT user_id, SUBSTRING(webhook_url, 1, 50) as webhook, webhook_secret IS NOT NULL as has_secret, delivery_mode FROM client_profiles WHERE webhook_url IS NOT NULL LIMIT 3;"

# 6. Test SMS Send via TextBelt directly (without consuming quota)
echo ''
echo '6. Proxy Test via TextBelt...'
curl -s http://127.0.0.1:5000/api/admin/proxy-test -X POST 2>/dev/null || echo "Proxy test requires auth"

# 7. Check PM2 status
echo ''
echo '7. PM2 Status...'
pm2 list

# 8. Redis status
echo ''
echo '8. Redis Status...'
redis-cli ping

echo ''
echo '=== Testing Complete ==='

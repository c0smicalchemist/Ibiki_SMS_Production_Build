#!/bin/bash
echo "========================================="
echo "IBIKI SMS PLATFORM - COMPREHENSIVE HEALTH CHECK"
echo "========================================="
echo ""

echo "=== 1. SYSTEM & PROCESS STATUS ==="
echo "--- PM2 Status ---"
pm2 status
echo ""
echo "--- PM2 Process Details ---"
pm2 describe ibiki-sms | head -50
echo ""
echo "--- Port Listeners ---"
ss -ltnp | grep -E ':5000|:80|:443'
echo ""
echo "--- System Resources ---"
free -h
df -h /opt
echo ""

echo "=== 2. NGINX STATUS ==="
systemctl status nginx --no-pager | head -20
echo ""
echo "--- Nginx Config Test ---"
nginx -t
echo ""

echo "=== 3. DATABASE STATUS ==="
echo "--- PostgreSQL Status ---"
systemctl status postgresql --no-pager | head -20
echo ""
echo "--- Database Tables ---"
sudo -u postgres psql -d ibiki -c "\dt"
echo ""
echo "--- Database Size ---"
sudo -u postgres psql -d ibiki -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) AS size FROM pg_database WHERE datname = 'ibiki';"
echo ""

echo "=== 4. APPLICATION LOGS (Last 100 lines) ==="
echo "--- PM2 Error Log ---"
tail -n 100 /root/.pm2/logs/ibiki-sms-error.log | tail -20
echo ""
echo "--- PM2 Output Log ---"
tail -n 100 /root/.pm2/logs/ibiki-sms-out.log | tail -20
echo ""
echo "--- Nginx Error Log ---"
tail -n 50 /var/log/nginx/error.log | grep -v "client: 106.70.220.254" | tail -10
echo ""

echo "=== 5. API HEALTH CHECKS ==="
echo "--- Local Health Endpoint ---"
curl -s http://127.0.0.1:5000/api/health | jq .
echo ""
echo "--- Response Time Test ---"
time curl -s http://127.0.0.1:5000/api/health > /dev/null
echo ""

echo "=== 6. FILE SYSTEM CHECK ==="
echo "--- Application Files ---"
ls -lh /opt/ibiki-sms/ | head -20
echo ""
echo "--- Frontend Assets ---"
ls -lh /opt/ibiki-sms/dist/public/assets/ | wc -l
echo "Total asset files:"
ls /opt/ibiki-sms/dist/public/assets/*.js | wc -l
echo ""
echo "--- Critical Files ---"
ls -lh /opt/ibiki-sms/dist/public/index.html
ls -lh /opt/ibiki-sms/dist/index.js
echo ""

echo "=== 7. ENVIRONMENT CHECK ==="
echo "--- Node Version ---"
node --version
echo "--- NPM Version ---"
npm --version
echo ""
echo "--- .env File Present ---"
ls -lh /opt/ibiki-sms/.env* 2>/dev/null || echo "No .env files found"
echo ""

echo "========================================="
echo "HEALTH CHECK COMPLETE"
echo "========================================="

# Ibiki SMS - Automated Monitoring Setup with UptimeRobot

## Overview
This guide will help you set up free automated monitoring for your Ibiki SMS platform using UptimeRobot.

---

## Step 1: Sign Up for UptimeRobot (Free Tier)

1. Visit: https://uptimerobot.com/
2. Click "Register" (top right)
3. Create account (free tier includes):
   - 50 monitors
   - 5-minute check intervals
   - Email/SMS/Webhook alerts
   - Public status pages

---

## Step 2: Configure Your Health Check Endpoint

Your Ibiki platform already has a health check endpoint ready:

**Endpoint**: `https://ibiki.run.place/api/health`  
**Alternate** (if domain issues): `https://151.243.109.66/api/health`

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-06T17:30:00.000Z",
  "environment": "production",
  "uptime": 2500.123,
  "version": "1.0.1"
}
```

---

## Step 3: Create Monitor in UptimeRobot

After logging in to UptimeRobot:

1. Click **"+ Add New Monitor"**
2. Configure as follows:

### Monitor Type: **HTTP(s)**
- **Monitor Type**: HTTP(s)
- **Friendly Name**: `Ibiki SMS - API Health`
- **URL**: `https://ibiki.run.place/api/health`
- **Monitoring Interval**: 5 minutes (free tier)

### Alert Settings:
- **Alert Contacts**: Add your email
- **Alert When**: Down
- **Alert After**: 1 check (alert immediately if down)

### Advanced Settings:
- **HTTP Method**: GET
- **Expected Status Code**: 200
- **Keyword Monitoring**: Enable
  - **Keyword Type**: Exists
  - **Keyword**: `healthy`
  - This ensures the response contains the word "healthy"

3. Click **"Create Monitor"**

---

## Step 4: Add Additional Monitors (Recommended)

### Monitor 2: Main Website (Domain)
```
Friendly Name: Ibiki SMS - Website (Domain)
URL: https://ibiki.run.place/
Monitoring Interval: 5 minutes
Expected Status: 200
```

### Monitor 3: Main Website (Direct IP)
```
Friendly Name: Ibiki SMS - Website (IP)
URL: https://151.243.109.66/
Monitoring Interval: 5 minutes
Expected Status: 200
```

### Monitor 4: Database Health (via custom endpoint)
**Note**: You can create a dedicated database health endpoint if needed:
```
URL: https://ibiki.run.place/api/admin/health/db
Expected Response: {"database":"connected"}
```

---

## Step 5: Configure Alert Contacts

1. Go to **"My Settings"** → **"Alert Contacts"**
2. Add multiple alert methods:
   - ✅ **Email**: Your primary email
   - ✅ **SMS** (optional, limited in free tier)
   - ✅ **Webhook** (for Slack, Discord, etc.)

### Example Slack Webhook:
If you use Slack, you can get instant notifications:
1. Create Incoming Webhook in Slack
2. Add as "Webhook" type in UptimeRobot
3. URL: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`

---

## Step 6: Create Public Status Page (Optional)

UptimeRobot allows you to create a public status page:

1. Go to **"Status Pages"**
2. Click **"+ Add New Status Page"**
3. Configure:
   - **Page Name**: `Ibiki SMS Status`
   - **Select Monitors**: Choose all Ibiki monitors
   - **Custom Domain** (optional): status.ibiki.run.place
4. Share URL with your clients/team

---

## Step 7: Test Your Monitors

### Test 1: Verify Monitor is Working
1. Go to UptimeRobot dashboard
2. Check that "Ibiki SMS - API Health" shows **"Up"** status
3. Click on monitor to see response time graph

### Test 2: Test Alert System
1. Temporarily stop PM2: `pm2 stop ibiki-sms`
2. Wait 5 minutes
3. Verify you receive alert email
4. Restart PM2: `pm2 start ibiki-sms`
5. Verify you receive "Up again" notification

---

## Monitor Dashboard - What to Expect

Once configured, your UptimeRobot dashboard will show:

```
┌─────────────────────────────────────────────────────────┐
│ Ibiki SMS - API Health                         ✅ Up    │
│ Uptime: 99.98% (30 days)                               │
│ Response Time: 45ms avg                                │
│ Last Check: 2 minutes ago                              │
└─────────────────────────────────────────────────────────┘
```

---

## Alternative: Self-Hosted Monitoring Script

If you prefer a self-hosted solution, I've created a monitoring script:

### Create Monitor Script on Server:
```bash
#!/bin/bash
# /root/monitor_ibiki.sh

HEALTH_URL="http://127.0.0.1:5000/api/health"
ALERT_EMAIL="your-email@example.com"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -ne 200 ]; then
    echo "ALERT: Ibiki SMS is DOWN! HTTP Status: $RESPONSE" | \
        mail -s "🚨 Ibiki SMS Down Alert" $ALERT_EMAIL
fi
```

### Add to Cron (check every 5 minutes):
```bash
*/5 * * * * /root/monitor_ibiki.sh
```

---

## Monitoring Best Practices

### What to Monitor:
- ✅ **API Health Endpoint** (primary)
- ✅ **Website Accessibility**
- ✅ **Response Time Trends**
- ✅ **SSL Certificate Expiry** (UptimeRobot checks this automatically)

### Alert Thresholds:
- **Down for 1 check**: Immediate alert
- **Response time > 1000ms**: Warning alert (configure in UptimeRobot Pro)
- **Uptime < 99.5%**: Monthly review alert

### Response Plan:
1. **Receive alert** → Check UptimeRobot dashboard
2. **Verify issue** → SSH to server: `ssh root@151.243.109.66`
3. **Check PM2** → `pm2 status`
4. **Check logs** → `pm2 logs ibiki-sms --lines 50`
5. **Restart if needed** → `pm2 restart ibiki-sms`
6. **Verify recovery** → Check health endpoint

---

## Monitoring Statistics to Track

UptimeRobot provides these metrics (free tier):
- ✅ **Uptime percentage** (7/30/90 days)
- ✅ **Response time** (average, min, max)
- ✅ **Down events** (count, duration)
- ✅ **SSL certificate expiry date**

### Example Monthly Report:
```
Month: January 2026
Uptime: 99.95%
Average Response: 42ms
Total Downtime: 21 minutes
Down Events: 2 (both <15 min)
SSL Valid Until: 2026-12-31
```

---

## Quick Reference

| Item | Value |
|------|-------|
| **Health Endpoint** | https://ibiki.run.place/api/health |
| **Direct IP Health** | https://151.243.109.66/api/health |
| **Expected Status** | 200 OK |
| **Expected Response** | `{"status":"healthy"}` |
| **Check Interval** | 5 minutes (free tier) |
| **Alert Threshold** | 1 failed check |

---

## Troubleshooting

### Issue: Monitor shows "Down" but server is up
**Solution**: Check domain DNS issues, try direct IP monitor

### Issue: Response time is high (>500ms)
**Solution**: 
1. Check server resources: `htop`
2. Check PM2 status: `pm2 monit`
3. Optimize database queries

### Issue: Not receiving alerts
**Solution**: 
1. Verify email in UptimeRobot settings
2. Check spam folder
3. Test notification manually in UptimeRobot

---

## Next Steps

1. ✅ Sign up for UptimeRobot (5 minutes)
2. ✅ Create API health monitor (2 minutes)
3. ✅ Add alert contacts (2 minutes)
4. ✅ Test alert system (5 minutes)
5. ✅ Create public status page (optional, 5 minutes)

**Total setup time**: ~15-20 minutes

---

## Support

- **UptimeRobot Documentation**: https://blog.uptimerobot.com/
- **Ibiki Health Endpoint**: Already configured and working
- **Server Access**: SSH with key: `ssh -i ~/.ssh/id_ed25519 root@151.243.109.66`

**Your monitoring is now automated and will alert you immediately if any issues occur!**

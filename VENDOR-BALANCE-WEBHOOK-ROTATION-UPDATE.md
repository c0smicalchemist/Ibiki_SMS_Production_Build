# TextBelt Balance & Webhook Rotation Update

## Summary of Changes

### 1. **TextBelt Balance Now Shows Total of All API Keys** ✅

**Problem:** When you added a second TextBelt API key (Secondary TextBelt Key - 1 with 200 credits), the balance in the header only showed 175 credits instead of 375 (175 + 200).

**Solution:** Updated `getTextBeltBalance()` in `server/vendor-manager.ts` to:
- Query all active TextBelt API keys from the pool
- Sum up the balance from each key
- Return the total pooled balance

**Result:** The TextBelt Balance now correctly shows **375 credits** (sum of all pooled keys).

---

### 2. **Webhook Proxy Domain Rotation** ✅

**Problem:** Single webhook domain could get banned/blocked by TextBelt.

**Solution:** Implemented randomized webhook proxy domain rotation:

#### Backend Changes:
1. **New Method in VendorService** (`server/vendor-service.ts`):
   - `getRandomWebhookUrl()` - Randomly selects from configured webhook domains
   - Supports comma-separated list of domains
   - Falls back to single URL if needed

2. **Database Configuration**:
   - New config key: `webhook_proxy_domains` (stores comma-separated domains)
   - Falls back to existing `webhook_public_url` for backward compatibility

3. **New Admin API Endpoints** (`server/routes.ts`):
   - `GET /api/admin/webhook-proxy-domains` - Get current domains
   - `POST /api/admin/webhook-proxy-domains` - Update domains list

#### How It Works:
- Each SMS send randomly selects one webhook URL from your configured domains
- TextBelt will distribute callbacks across multiple domains
- Reduces risk of any single domain being flagged/banned

---

## How to Use Webhook Proxy Rotation

### Option 1: Via API (Recommended)

**Get Current Domains:**
```bash
curl -X GET https://your-server/api/admin/webhook-proxy-domains \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Set Multiple Domains:**
```bash
curl -X POST https://your-server/api/admin/webhook-proxy-domains \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domains": [
      "https://domain1.com",
      "https://domain2.com",
      "https://domain3.com"
    ]
  }'
```

### Option 2: Via Database

```sql
-- Add multiple webhook domains (comma-separated)
INSERT INTO system_config (key, value, created_at, updated_at)
VALUES ('webhook_proxy_domains', 'https://domain1.com,https://domain2.com,https://domain3.com', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

### Option 3: Keep Single Domain (Backward Compatible)

If you only set `webhook_public_url`, the system will continue to use that single domain:

```sql
-- Single webhook domain (old method, still works)
INSERT INTO system_config (key, value, created_at, updated_at)
VALUES ('webhook_public_url', 'https://ibiki.run.place', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

---

## Additional Randomization Suggestions

To further improve anti-ban protection, consider these enhancements:

### 1. **User-Agent Rotation** (Future Enhancement)
```typescript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
  // Add more
];
const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
```

### 2. **Request Timing Jitter** (Future Enhancement)
Add small random delays between requests:
```typescript
const jitter = Math.random() * 1000; // 0-1 second
await new Promise(resolve => setTimeout(resolve, jitter));
```

### 3. **Proxy Rotation** (Already Implemented via Webshare)
You're already using Webshare proxy rotation which handles:
- Random IP addresses
- Geographic distribution
- Automatic proxy health checks

### 4. **Message Fingerprinting Prevention** (Future Enhancement)
Vary message formatting slightly:
- Random spacing/punctuation
- Emoji randomization
- Character case variations (where appropriate)

---

## Testing the Changes

### 1. Verify Balance Pooling:
1. Check your admin dashboard
2. Look at TextBelt Balance in the header
3. Should now show **375 credits** (175 + 200)
4. Compare with API Pool tab which shows individual key quotas

### 2. Verify Webhook Rotation:
1. Add multiple domains via API or database
2. Send test SMS messages
3. Check server logs for: `[TextBelt Send] Reply webhook URL (randomized): https://...`
4. You should see different domains being used across sends

### 3. Monitor Logs:
```bash
# SSH into server
ssh root@151.243.109.66

# Watch PM2 logs for webhook randomization
pm2 logs ibiki-sms --lines 50 | grep "Reply webhook URL"

# Watch for balance updates
pm2 logs ibiki-sms --lines 50 | grep "TextBelt total balance"
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/webhook-url` | Get single webhook URL (legacy) |
| POST | `/api/admin/webhook-url` | Set single webhook URL (legacy) |
| GET | `/api/admin/webhook-proxy-domains` | Get webhook domain rotation list |
| POST | `/api/admin/webhook-proxy-domains` | Set webhook domain rotation list |

---

## File Changes

- ✅ `server/vendor-manager.ts` - TextBelt balance now sums all pooled keys
- ✅ `server/vendor-service.ts` - Added `getRandomWebhookUrl()` with rotation logic
- ✅ `server/routes.ts` - Added webhook proxy domains API endpoints

---

## Benefits

1. **Accurate Balance Tracking**: See total credits across all pooled API keys
2. **Ban Resistance**: Webhook callbacks distributed across multiple domains
3. **Scalability**: Easy to add more webhook domains as needed
4. **Backward Compatible**: Works with existing single-domain setup
5. **Logging**: Clear logs show which webhook URL was used per send
6. **API-Driven**: Manage domains via REST API without server restart

---

## Next Steps

1. ✅ **Deployed** - All changes are live on production
2. **Add More Domains** - Configure additional webhook proxy domains for rotation
3. **Monitor Logs** - Watch for successful rotation and balance updates
4. **Scale Up** - Add more TextBelt API keys as needed
5. **Future Enhancements** - Consider implementing additional randomization (User-Agent, timing jitter)

---

## Questions?

Check the logs or test the API endpoints to verify everything is working correctly!

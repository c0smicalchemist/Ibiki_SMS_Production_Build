# TextBelt Webhook Proxy

This Cloudflare Worker acts as a proxy shield between TextBelt and your master server (ibiki.run.place).

## Why Use This?

- **Protection**: TextBelt never sees your real server domain
- **Disposable**: If a proxy domain gets banned, deploy a new one
- **Redundancy**: Run multiple proxies on different domains
- **Free**: Cloudflare Workers free tier = 100,000 requests/day

## Architecture

```
TextBelt → proxy-domain.com → ibiki.run.place (master)
```

## Quick Deploy (5 minutes)

### Option A: Cloudflare Dashboard (No CLI)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Workers & Pages** → **Create**
3. Select **Create Worker** → Give it a name (e.g., `sms-proxy-1`)
4. Replace the code with contents of `worker.js`
5. Click **Deploy**
6. Go to **Settings** → **Variables** → Add:
   - Name: `MASTER_SERVER`
   - Value: `https://ibiki.run.place`
7. Go to **Settings** → **Triggers** → **Custom Domains**
8. Add your domain: `sms-proxy-1.yourdomain.com`

Your proxy is now live at: `https://sms-proxy-1.yourdomain.com/api/webhook/textbelt`

### Option B: Wrangler CLI

```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
cd proxy-worker
wrangler deploy

# Add custom domain in dashboard
```

## Configure Ibiki to Use Proxy

1. Go to **Admin Dashboard** → **System Health**
2. Find **Webhook Domain** card
3. Enter: `https://sms-proxy-1.yourdomain.com`
4. Click **Save**

All new SMS sends will tell TextBelt to deliver replies to your proxy.

## Multiple Proxies (Recommended)

Deploy the same worker on multiple domains for redundancy:

| Domain | Status | Use For |
|--------|--------|---------|
| `sms-proxy-1.yourdomain.com` | Active | Current |
| `sms-proxy-2.yourdomain.com` | Standby | If #1 banned |
| `sms-relay.otherdomain.com` | Standby | If both banned |

**When banned:**
1. Deploy new worker on new domain
2. Update Webhook Domain in Admin Dashboard
3. Done - no code changes needed

## Testing

```bash
# Test proxy health
curl https://sms-proxy-1.yourdomain.com/health

# Test webhook forwarding (simulates TextBelt)
curl -X POST https://sms-proxy-1.yourdomain.com/api/webhook/textbelt \
  -H "Content-Type: application/json" \
  -d '{"fromNumber":"+1234567890","text":"Test reply","timestamp":1234567890}'
```

## Free Domain Options

If you don't have spare domains:

1. **Cloudflare default**: `your-worker.your-account.workers.dev` (free)
2. **Freenom**: Free .tk, .ml, .ga domains (may be unreliable)
3. **Cheap domains**: .xyz, .site, .online (~$1-3/year)

## Notes

- The proxy returns `200 OK` to TextBelt even if master is temporarily down
- This prevents TextBelt from flagging the domain for failed deliveries
- Webhooks include `X-Proxy-Domain` header so master knows which proxy was used
- All TextBelt signature headers are forwarded for verification

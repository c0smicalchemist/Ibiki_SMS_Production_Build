#!/usr/bin/env bash
set -euo pipefail

# Deploy webhook fix to production
# This script:
# 1. Builds the server bundle locally
# 2. Copies bundle to production server
# 3. Deploys updated Cloudflare Workers
# 4. Restarts PM2

REMOTE_HOST="${REMOTE_HOST:-root@151.243.109.66}"
REMOTE_PATH="${REMOTE_PATH:-/opt/ibiki-sms}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-21a87fb49def68f1fd0639138b817536}"
CF_API_TOKEN="${CF_API_TOKEN:-}"

echo "=== Deploying Webhook Fix ==="

# Step 1: Build server bundle
echo "[1/4] Building server bundle..."
cd "$(dirname "$0")/.."
npm run build 2>/dev/null || npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --external:pg-native --external:better-sqlite3

# Step 2: Copy bundle to production
echo "[2/4] Copying bundle to production server..."
scp dist/index.js "$REMOTE_HOST:$REMOTE_PATH/dist/index.js"

# Step 3: Deploy Cloudflare Workers (if token provided)
if [ -n "$CF_API_TOKEN" ]; then
  echo "[3/4] Deploying Cloudflare Workers..."
  WORKER_SCRIPT="tools/cloudflare_workers/sms-proxy-worker.js"
  
  for i in 1 2 3 4; do
    WORKER_NAME="sms-proxy-$i"
    echo "  Deploying $WORKER_NAME..."
    curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/workers/scripts/$WORKER_NAME" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/javascript" \
      --data-binary @"$WORKER_SCRIPT" > /dev/null
  done
  echo "  Workers deployed."
else
  echo "[3/4] Skipping Cloudflare Workers (no CF_API_TOKEN provided)"
  echo "  To deploy workers, run: CF_API_TOKEN=xxx ./tools/deploy_webhook_fix.sh"
fi

# Step 4: Restart PM2 on production
echo "[4/4] Restarting PM2..."
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && pm2 reload ibiki-sms --update-env"

echo
echo "=== Deployment Complete ==="
echo "Test the webhook with:"
echo "  curl -X POST https://ibiki.run.place/api/webhook/textbelt -H 'Content-Type: application/json' -d '{\"textId\":\"test123\",\"fromNumber\":\"+15551234567\",\"text\":\"Test reply\"}'"
echo
echo "Check logs:"
echo "  ssh $REMOTE_HOST 'pm2 logs ibiki-sms --lines 100 | grep -i webhook'"

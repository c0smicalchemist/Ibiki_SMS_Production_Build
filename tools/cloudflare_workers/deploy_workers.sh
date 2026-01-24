#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   CF_TOKEN="<account-token>" MASTER_SERVER="https://my.ibiki.example" ./deploy_workers.sh

ACCOUNT_ID="21a87fb49def68f1fd0639138b817536"
SCRIPT_PATH="$(dirname "$0")/sms-proxy-worker.js"
TOKEN="${CF_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "Set CF_TOKEN environment variable (account token) and re-run. Example:"
  echo "  CF_TOKEN=RBAK... MASTER_SERVER=https://my.ibiki.example ./deploy_workers.sh"
  exit 1
fi

if [ ! -f "$SCRIPT_PATH" ]; then
  echo "Worker script not found at $SCRIPT_PATH"
  exit 1
fi

# Replace placeholder MASTER_SERVER in the script before deploying
if [ -z "${MASTER_SERVER:-}" ]; then
  echo "Set MASTER_SERVER environment variable to your public ibiki URL (no trailing slash)."
  echo "Example: MASTER_SERVER=https://ibiki.example.com"
  exit 1
fi

TMP_SCRIPT=$(mktemp /tmp/sms-proxy-worker.XXXX.js)
sed "s|https://REPLACE_WITH_YOUR_IBIKI_PUBLIC_URL|${MASTER_SERVER}|g" "$SCRIPT_PATH" > "$TMP_SCRIPT"

for name in sms-proxy-1 sms-proxy-2 sms-proxy-3 sms-proxy-4; do
  echo "Deploying $name..."
  curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${name}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/javascript" \
    --data-binary @"$TMP_SCRIPT" \
    | jq . || true
  echo
  sleep 1
done

rm -f "$TMP_SCRIPT"

echo "Done. Verify worker URLs (e.g. https://sms-proxy-1.c0smicalch3mist.workers.dev) respond and forward to ${MASTER_SERVER}/api/webhook/textbelt"

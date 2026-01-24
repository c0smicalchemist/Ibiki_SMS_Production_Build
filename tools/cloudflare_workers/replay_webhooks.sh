#!/usr/bin/env bash
set -euo pipefail

HOST=${1:-root@151.243.109.66}
WORKER=${2:-https://sms-proxy-1.c0smicalch3mist.workers.dev}
DAYS=${3:-7}
LIMIT=${4:-200}

echo "Host: $HOST"
echo "Worker: $WORKER"

# Fetch TextBelt API key
echo "Fetching textbelt_api_key from $HOST..."
TEXTKEY=$(ssh "$HOST" "sudo -u postgres psql -d ibiki -t -c \"SELECT value FROM system_config WHERE key='textbelt_api_key';\"" | tr -d '\r' | sed -n '1p')
if [ -z "$TEXTKEY" ]; then
  echo "ERROR: textbelt_api_key not found on $HOST" >&2
  exit 1
fi
printf "Fetched textbelt key length: %d\n" "${#TEXTKEY}"

# Fetch recent message_logs for TextBelt
echo "Fetching recent TextBelt message_logs (last $DAYS days, limit $LIMIT)..."
MSG_LINES=$(ssh "$HOST" "sudo -u postgres psql -d ibiki -t -A -F '|' -c \"SELECT id, vendor_message_id, recipient, request_payload, created_at FROM message_logs WHERE vendor='textbelt' AND created_at > NOW() - interval '${DAYS} days' ORDER BY created_at DESC LIMIT ${LIMIT};\"")

if [ -z "$MSG_LINES" ]; then
  echo "No recent TextBelt message_logs found."
  exit 0
fi

count=0
# Iterate lines
while IFS='|' read -r id vid recipient request_payload created_at; do
  # If vendor_message_id empty, skip
  if [ -z "$vid" ] || [ "$vid" = "" ]; then
    continue
  fi

  # Extract message from request_payload JSON if present
  body=""
  if [ -n "$request_payload" ]; then
    # request_payload may contain JSON; try to extract 'message' or 'text'
    body=$(printf "%s" "$request_payload" | jq -r '.message // .text // ""' 2>/dev/null || true)
  fi
  # Fallback: empty body
  body=${body:-}

  # Build payload JSON
  payload=$(jq -n --arg id "$vid" --arg from "$recipient" --arg text "$body" '{textId:$id, fromNumber:$from, text:$text}')

  ts=$(date +%s)
  sig=$(printf "%s%s" "$ts" "$payload" | openssl dgst -sha256 -hmac "$TEXTKEY" | awk '{print $NF}')

  echo "[$((count+1))] Replaying id=$id vid=$vid to $WORKER (ts=$ts)"
  resp=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$WORKER" -H "Content-Type: application/json" -H "x-textbelt-timestamp: $ts" -H "x-textbelt-signature: $sig" --data "$payload" --max-time 15 || true)
  echo "$resp"
  count=$((count+1))
  sleep 0.25

done <<< "$MSG_LINES"

echo "Replayed $count messages. Now fetching recent incoming_messages from $HOST..."
ssh "$HOST" "sudo -u postgres psql -d ibiki -c \"SELECT id, from_number, to_number, body, created_at FROM incoming_messages ORDER BY created_at DESC LIMIT 20;\""

echo "Done."

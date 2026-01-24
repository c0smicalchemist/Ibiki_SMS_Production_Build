#!/usr/bin/env bash
set -euo pipefail

WORKER=${WORKER:-https://sms-proxy-1.c0smicalch3mist.workers.dev}
INFILE=${INFILE:-/tmp/textbelt_last6h.txt}
TEXTKEY=${1:-${TEXTKEY:-}}

if [ -z "$TEXTKEY" ]; then
  echo "Usage: $0 <TEXTKEY>" >&2
  echo "Or export TEXTKEY and run $0" >&2
  exit 2
fi

if [ ! -s "$INFILE" ]; then
  echo "Input file $INFILE not found or empty." >&2
  exit 0
fi

total=0
sent=0
ok=0
fail=0

echo "Replaying messages from $INFILE -> $WORKER using provided TEXTKEY (length=${#TEXTKEY})"

while IFS='|' read -r id vid recipient request_payload created_at; do
  [ -z "$vid" ] && continue
  total=$((total+1))
  body=$(printf '%s' "$request_payload" | jq -r '.message // .text // ""' 2>/dev/null || printf '')
  payload=$(jq -n --arg textId "$vid" --arg from "$recipient" --arg text "$body" '{textId:$textId, fromNumber:$from, text:$text}')
  ts=$(date +%s)
  sig=$(printf "%s%s" "$ts" "$payload" | openssl dgst -sha256 -hmac "$TEXTKEY" | awk '{print $NF}')

  echo "---- [$total] Replaying textId=$vid to $WORKER (ts=$ts) ----"
  resp=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST "$WORKER" \
    -H "Content-Type: application/json" \
    -H "x-textbelt-timestamp: $ts" \
    -H "x-textbelt-signature: $sig" \
    --data "$payload" --max-time 15) || true

  http_status=$(printf '%s' "$resp" | sed -n 's/.*HTTPSTATUS:\([0-9][0-9][0-9]\)$/\1/p' || true)
  body_only=$(printf '%s' "$resp" | sed 's/HTTPSTATUS:[0-9][0-9][0-9]$//')
  sent=$((sent+1))

  if [ "$http_status" = "200" ]; then
    echo "-> HTTP 200" 
    ok=$((ok+1))
  else
    echo "-> HTTP $http_status" 
    echo "$body_only"
    fail=$((fail+1))
  fi
done < "$INFILE"

echo
echo "Replayed: total=$total, attempted=$sent, ok=$ok, fail=$fail"

exit 0

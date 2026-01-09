#!/bin/bash
# Webhook Test Script
echo '=== Webhook Testing ==='

# 1. Test ExtremeSMS webhook endpoint
echo "1. Testing ExtremeSMS webhook endpoint..."
WEBHOOK_RESULT=$(curl -s -X POST http://127.0.0.1:5000/api/webhook/extreme-sms \
  -H 'Content-Type: application/json' \
  -d '{
    "messageId": "test-webhook-123",
    "status": "delivered",
    "recipient": "+14012885277",
    "timestamp": "2026-01-09T08:00:00Z"
  }')
echo "ExtremeSMS Webhook Result: $WEBHOOK_RESULT"

echo ""
echo "2. Testing TextBelt webhook endpoint..."
TEXTBELT_RESULT=$(curl -s -X POST http://127.0.0.1:5000/api/webhook/textbelt \
  -H 'Content-Type: application/json' \
  -d '{
    "textId": "test-textbelt-456",
    "status": "DELIVERED",
    "fromNumber": "+14012885277",
    "text": "Test inbound message"
  }')
echo "TextBelt Webhook Result: $TEXTBELT_RESULT"

echo ""
echo "3. Checking incoming messages table..."
export PGPASSWORD='c0smic4382'
psql -h localhost -U ibiki_user -d ibiki -c "SELECT id, sender, recipient, message_preview, status, created_at FROM incoming_messages ORDER BY created_at DESC LIMIT 5;"

echo ""
echo "4. Recent webhook-related logs..."
pm2 logs ibiki-sms --lines 30 --nostream 2>&1 | grep -i -E 'webhook|incoming|inbound' | tail -10

echo ""
echo "=== Webhook Testing Complete ==="

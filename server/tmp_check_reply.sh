#!/bin/bash
set -e

echo "=== message_log for message_id 678111768239957564 ==="
sudo -u postgres psql -d ibiki -c "SELECT id, user_id, message_id, vendor, status, response_payload, request_payload, created_at FROM message_logs WHERE message_id = '678111768237239742' OR message_id = '678111768239957564' OR message_id = '673041768237239742' ORDER BY created_at DESC;"

echo "=== incoming_messages matching phone or text ==="
sudo -u postgres psql -d ibiki -c "SELECT id, user_id, \"from\", message, message_id, created_at FROM incoming_messages WHERE \"from\" ILIKE '%14077107960%' OR message ILIKE '%Yea dude%' OR message ILIKE '%Yes dude%' ORDER BY created_at DESC LIMIT 50;"

echo "=== system_config webhook keys ==="
sudo -u postgres psql -d ibiki -c "SELECT key, value FROM system_config WHERE key LIKE 'last_webhook_%' OR key = 'last_webhook_routed_user' ORDER BY key;"

echo "=== grep logs for message id and webhook hits ==="

grep -n '678111768239957564\|673041768237239742\|371101768237213394\|672801768237157930' /root/.pm2/logs/ibiki-sms-out-*.log || true

grep -n '/api/webhook/textbelt' /root/.pm2/logs/ibiki-sms-out-*.log || true

echo "=== tail recent logs ==="
tail -n 400 /root/.pm2/logs/ibiki-sms-out-0.log || true

echo "=== done ==="

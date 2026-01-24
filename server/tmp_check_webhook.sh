#!/bin/bash
set -e

echo "=== system_config last_webhook entries ==="
sudo -u postgres psql -d ibiki -c "SELECT key, value FROM system_config WHERE key LIKE 'last_webhook_%' OR key LIKE 'last_inbox_%' OR key = 'last_webhook_routed_user';"

echo "=== last 20 incoming_messages from +15106801079 ==="
sudo -u postgres psql -d ibiki -c "SELECT id, user_id, \"from\", message, message_id, vendor, created_at FROM incoming_messages WHERE \"from\" ILIKE '%15106801079%' ORDER BY created_at DESC LIMIT 20;"

echo "=== done ==="

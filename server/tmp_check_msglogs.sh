#!/bin/bash
set -e

echo "=== message_logs for given message_ids ==="
sudo -u postgres psql -d ibiki -c "SELECT id, user_id, message_id, vendor, status, response_payload, request_payload, created_at FROM message_logs WHERE message_id IN ('673041768237239742','371101768237213394','672801768237213394','672801768237157930') ORDER BY created_at DESC;"

echo "=== done ==="

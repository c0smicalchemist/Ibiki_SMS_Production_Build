#!/bin/bash
set -e

echo "=== webhook config keys ==="
sudo -u postgres psql -d ibiki -c "SELECT key, value FROM system_config WHERE key = 'webhook_proxy_domains' OR key = 'webhook_public_url' OR key = 'webhook_public_url_https';"

#!/usr/bin/env bash
set -euo pipefail
HOST=${HOST:?}
USER=${USER:?}
KEY=${KEY:?}
ROOT=${ROOT:-/opt/ibiki-sms/dist/public}
SITE=${SITE:-/etc/nginx/sites-enabled/ibiki-sms}
ssh -i "$KEY" "$USER@$HOST" "sudo mkdir -p '$ROOT/assets'"
ssh -i "$KEY" "$USER@$HOST" "sudo rm -f '$ROOT/index.html' && sudo rm -rf '$ROOT/assets/*'"
scp -i "$KEY" -r dist/public/* "$USER@$HOST:$ROOT/"
scp -i "$KEY" ops/nginx/ibiki-sms.conf "$USER@$HOST:$SITE"
ssh -i "$KEY" "$USER@$HOST" "sudo find '$ROOT' -type d -exec chmod 755 {} \; && sudo find '$ROOT' -type f -exec chmod 644 {} \;"
ssh -i "$KEY" "$USER@$HOST" "sudo nginx -t && sudo systemctl reload nginx || sudo service nginx reload"
ssh -i "$KEY" "$USER@$HOST" "pm2 restart all || true"

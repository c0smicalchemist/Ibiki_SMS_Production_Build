#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_ROOT=${BACKUP_ROOT:-/root/ibiki_backups}
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "Backing up Ibiki SMS system to: $BACKUP_DIR"

# 1) PostgreSQL dump (custom format)
echo "Dumping PostgreSQL database 'ibiki'..."
if command -v sudo >/dev/null 2>&1; then
  sudo -u postgres pg_dump -Fc ibiki -f "$BACKUP_DIR/ibiki-${TIMESTAMP}.dump"
else
  pg_dump -Fc ibiki -f "$BACKUP_DIR/ibiki-${TIMESTAMP}.dump"
fi

# 2) Export important DB tables/config snapshots
echo "Exporting system_config..."
sudo -u postgres psql -d ibiki -c "COPY (SELECT key,value FROM system_config) TO STDOUT WITH CSV" > "$BACKUP_DIR/system_config.csv"

echo "Exporting incoming_messages (full) and recent message_logs (30d)..."
sudo -u postgres psql -d ibiki -c "COPY incoming_messages TO STDOUT WITH CSV HEADER" > "$BACKUP_DIR/incoming_messages.csv" || true
sudo -u postgres psql -d ibiki -c "COPY (SELECT * FROM message_logs WHERE created_at > NOW() - interval '30 days') TO STDOUT WITH CSV HEADER" > "$BACKUP_DIR/message_logs_recent_30d.csv" || true

# 3) PM2 and process info
if command -v pm2 >/dev/null 2>&1; then
  echo "Saving PM2 process info..."
  pm2 list > "$BACKUP_DIR/pm2-list.txt" || true
  pm2 show ibiki-sms > "$BACKUP_DIR/pm2-show-ibiki-sms.txt" || true
  pm2 save --force || true
fi

# 4) Deployment files and logs
if [ -d /opt/ibiki-sms ]; then
  echo "Archiving /opt/ibiki-sms..."
  tar -C /opt -czf "$BACKUP_DIR/opt_ibiki-sms.tar.gz" ibiki-sms || true
fi

if [ -f /opt/ibiki-sms/ecosystem.config.js ]; then
  cp /opt/ibiki-sms/ecosystem.config.js "$BACKUP_DIR/" || true
fi
if [ -f /opt/ibiki-sms/.env ]; then
  cp /opt/ibiki-sms/.env "$BACKUP_DIR/" || true
fi

# 5) Application logs (tail recent logs if present)
if [ -d /var/log ]; then
  mkdir -p "$BACKUP_DIR/logs"
  # Copy pm2 logs by pattern if present
  cp /root/.pm2/logs/* "$BACKUP_DIR/logs/" 2>/dev/null || true
fi

# 6) Include local repo tools and worker deploy scripts when present
REPO_TOOLS_PATH="/opt/ibiki-sms/tools"
if [ -d "$REPO_TOOLS_PATH" ]; then
  tar -C /opt/ibiki-sms -czf "$BACKUP_DIR/repo_tools.tar.gz" tools || true
fi

# 7) Save checksums and create final archive
echo "Creating final archive..."
FINAL_ARCHIVE="$BACKUP_ROOT/ibiki-backup-${TIMESTAMP}.tar.gz"
tar -C "$BACKUP_ROOT" -czf "$FINAL_ARCHIVE" "${TIMESTAMP}" || true
sha256sum "$FINAL_ARCHIVE" > "${FINAL_ARCHIVE}.sha256"

# 8) Optional remote copy (SCP). Provide REMOTE_USER, REMOTE_HOST, REMOTE_PATH env vars
if [ -n "${REMOTE_USER:-}" ] && [ -n "${REMOTE_HOST:-}" ] && [ -n "${REMOTE_PATH:-}" ]; then
  echo "Copying archive to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}..."
  scp "$FINAL_ARCHIVE" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/" || true
fi

echo
echo "Backup complete: $FINAL_ARCHIVE"
echo "Checksum: ${FINAL_ARCHIVE}.sha256"

echo "Suggested verification commands:"
echo "  sha256sum -c ${FINAL_ARCHIVE}.sha256"
echo "  sudo -u postgres pg_restore -l ${BACKUP_DIR}/ibiki-${TIMESTAMP}.dump | head"

exit 0

#!/bin/bash
# Ibiki SMS Daily Backup Script
# Generated: 2026-01-06

BACKUP_DIR="/root/ibiki-backups"
APP_DIR="/opt/ibiki-sms"
DATE_STAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "=== Ibiki SMS Backup Started: $DATE_STAMP ==="

# 1. Backup Database
echo "Backing up PostgreSQL database..."
sudo -u postgres pg_dump ibiki > $BACKUP_DIR/ibiki_db_$DATE_STAMP.sql
if [ $? -eq 0 ]; then
    gzip $BACKUP_DIR/ibiki_db_$DATE_STAMP.sql
    echo "✓ Database backup completed: ibiki_db_$DATE_STAMP.sql.gz"
else
    echo "✗ Database backup failed!"
    exit 1
fi

# 2. Backup Application Files (excluding node_modules and logs)
echo "Backing up application files..."
tar -czf $BACKUP_DIR/ibiki_app_$DATE_STAMP.tar.gz \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='.git' \
    -C /opt ibiki-sms
if [ $? -eq 0 ]; then
    echo "✓ Application backup completed: ibiki_app_$DATE_STAMP.tar.gz"
else
    echo "✗ Application backup failed!"
    exit 1
fi

# 3. Backup .env file separately (contains secrets)
echo "Backing up environment configuration..."
cp $APP_DIR/.env $BACKUP_DIR/.env_$DATE_STAMP.bak
echo "✓ Environment backup completed: .env_$DATE_STAMP.bak"

# 4. Create backup manifest
echo "Creating backup manifest..."
cat > $BACKUP_DIR/backup_$DATE_STAMP.txt << MANIFEST
Ibiki SMS Backup Manifest
Date: $(date)
Hostname: $(hostname)
Node Version: $(node --version)
PM2 Status: $(pm2 describe ibiki-sms 2>/dev/null | grep -E 'status|uptime|restarts' | head -3)

Files Included:
- ibiki_db_$DATE_STAMP.sql.gz (Database)
- ibiki_app_$DATE_STAMP.tar.gz (Application)
- .env_$DATE_STAMP.bak (Environment)

Backup Sizes:
$(ls -lh $BACKUP_DIR/*$DATE_STAMP* | awk '{print $9, $5}')
MANIFEST

# 5. Cleanup old backups (keep only last RETENTION_DAYS)
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find $BACKUP_DIR -name "ibiki_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "ibiki_app_*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name ".env_*.bak" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "backup_*.txt" -mtime +$RETENTION_DAYS -delete

echo "✓ Cleanup completed"

# 6. Display summary
echo ""
echo "=== Backup Summary ==="
echo "Total backups: $(ls -1 $BACKUP_DIR/ibiki_db_*.sql.gz 2>/dev/null | wc -l)"
echo "Disk usage: $(du -sh $BACKUP_DIR | cut -f1)"
echo "Latest backups:"
ls -lht $BACKUP_DIR | grep $DATE_STAMP | awk '{print $9, $5}'

echo ""
echo "=== Backup Completed Successfully: $(date) ==="
exit 0

#!/bin/bash
# Backup script for source server (151.243.109.79)

echo "🔍 Checking current setup..."
echo "PostgreSQL Status:"
systemctl status postgresql --no-pager -l
echo
echo "Application Status:"
pm2 status
echo
echo "Nginx Status:"
systemctl status nginx --no-pager -l
echo
echo "📊 Database Info:"
sudo -u postgres psql -c "\l" | grep ibiki
sudo -u postgres psql -d ibiki -c "SELECT COUNT(*) as total_users FROM users;"
echo
echo "📁 Application Info:"
du -sh /root/ibiki-sms
ls -la /root/ibiki-sms/
echo
echo "🗂️ Creating backups..."
cd /root

# Database backup
echo "💾 Creating database backup..."
pg_dump -U ibiki_user -h localhost ibiki > /tmp/ibiki-full-backup.sql

# Application backup
echo "📁 Creating application backup..."
tar -czf /tmp/ibiki-app.tar.gz ibiki-sms/

# Nginx config
echo "🌐 Creating nginx backup..."
tar -czf /tmp/nginx-config.tar.gz /etc/nginx/sites-available/ /etc/nginx/sites-enabled/

# Systemd services
echo "⚙️ Creating services backup..."
tar -czf /tmp/systemd-services.tar.gz /etc/systemd/system/ibiki*

# Environment file
echo "🔐 Creating environment backup..."
cp /root/ibiki-sms/.env.production /tmp/ibiki-env.backup

# PM2 ecosystem if exists
if [ -f /root/ibiki-sms/ecosystem.config.js ]; then
    cp /root/ibiki-sms/ecosystem.config.js /tmp/
fi

echo "✅ All backups created successfully!"
echo "📦 Files ready for transfer:"
ls -la /tmp/ibiki-*
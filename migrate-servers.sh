#!/bin/bash

# Quick Migration Script
# Usage: ./migrate-servers.sh

set -e

echo "🚀 Starting complete migration from 151.243.109.79 to 151.243.109.66"

# Step 1: Create backup on source server
echo "📦 Creating backup on source server..."
ssh root@151.243.109.79 << 'EOF'
    echo "🔍 Current status:"
    systemctl status postgresql --no-pager -l
    pm2 status
    systemctl status nginx --no-pager -l
    
    echo "📊 Database info:"
    sudo -u postgres psql -c "\l" | grep ibiki
    sudo -u postgres psql -d ibiki -c "SELECT COUNT(*) FROM users;"
    
    echo "📁 Application size:"
    du -sh /root/ibiki-sms
    
    echo "🗂️ Creating backups..."
    cd /root
    
    # Database backup
    pg_dump -U ibiki_user -h localhost ibiki > /tmp/ibiki-full-backup.sql
    
    # Application backup
    tar -czf /tmp/ibiki-app.tar.gz ibiki-sms/
    
    # Nginx config
    tar -czf /tmp/nginx-config.tar.gz /etc/nginx/sites-available/ /etc/nginx/sites-enabled/
    
    # Systemd services
    tar -czf /tmp/systemd-services.tar.gz /etc/systemd/system/ibiki*
    
    # Environment file
    cp /root/ibiki-sms/.env.production /tmp/ibiki-env.backup
    
    echo "✅ Backups created successfully!"
EOF

# Step 2: Transfer to new server
echo "📤 Transferring backups to new server..."
scp root@151.243.109.79:/tmp/ibiki-full-backup.sql root@151.243.109.66:/tmp/
scp root@151.243.109.79:/tmp/ibiki-app.tar.gz root@151.243.109.66:/tmp/
scp root@151.243.109.79:/tmp/nginx-config.tar.gz root@151.243.109.66:/tmp/
scp root@151.243.109.79:/tmp/systemd-services.tar.gz root@151.243.109.66:/tmp/
scp root@151.243.109.79:/tmp/ibiki-env.backup root@151.243.109.66:/tmp/

# Step 3: Restore on new server
echo "🎯 Restoring on new server..."
ssh root@151.243.109.66 << 'RESTORE_EOF'
    echo "🔧 Setting up new server..."
    
    # Install PostgreSQL if needed
    if ! command -v psql &> /dev/null; then
        apt update && apt install -y postgresql postgresql-contrib
        systemctl start postgresql
        systemctl enable postgresql
    fi
    
    # Install Node.js if needed
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt install -y nodejs
    fi
    
    # Install PM2 if needed
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    
    # Install nginx if needed
    if ! command -v nginx &> /dev/null; then
        apt install -y nginx
    fi
    
    # Set up database
    sudo -u postgres psql -c "CREATE USER ibiki_user WITH PASSWORD 'c0smic4382';"
    sudo -u postgres psql -c "CREATE DATABASE ibiki OWNER ibiki_user;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ibiki TO ibiki_user;"
    
    # Restore database
    sudo -u postgres psql -U ibiki_user -d ibiki < /tmp/ibiki-full-backup.sql
    
    # Restore application
    cd /root
    tar -xzf /tmp/ibiki-app.tar.gz
    
    # Restore nginx config
    tar -xzf /tmp/nginx-config.tar.gz -C /
    
    # Restore systemd services
    tar -xzf /tmp/systemd-services.tar.gz -C /
    
    # Restore environment
    cp /tmp/ibiki-env.backup /root/ibiki-sms/.env.production
    
    # Install dependencies and start
    cd /root/ibiki-sms
    npm ci --only=production
    npm run build
    
    # Start services
    systemctl daemon-reload
    systemctl enable ibiki
    systemctl start ibiki
    
    # Test nginx
    nginx -t && systemctl reload nginx
    
    # Start PM2 if using
    pm2 restart all || pm2 start ecosystem.config.js || true
    
    echo "✅ Migration complete!"
    echo "🌐 New server ready at http://151.243.109.66"
    
    # Final check
    echo "🔍 Final status check:"
    systemctl status postgresql --no-pager -l
    systemctl status nginx --no-pager -l
    systemctl status ibiki --no-pager -l
    pm2 status || echo "PM2 not used"
RESTORE_EOF

echo "🎉 Migration complete!"
echo "🌐 New production server: http://151.243.109.66"
echo "📊 You can now test the application on the new server"
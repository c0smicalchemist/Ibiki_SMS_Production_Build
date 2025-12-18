#!/bin/bash

# Complete Migration Script: 151.243.109.79 → 151.243.109.66
# This script performs a complete wipe and restore

set -e

echo "🚀 Starting complete migration from 151.243.109.79 to 151.243.109.66"
echo "🧹 This will completely wipe existing Ibiki installation on 151.243.109.66"

# Source server details
SOURCE_SERVER="root@151.243.109.79"
TARGET_SERVER="root@151.243.109.66"

# Step 1: Create backup on source server
echo "📦 Creating backup on source server..."
ssh $SOURCE_SERVER << 'EOF'
    echo "🔍 Current setup on source server:"
    systemctl status postgresql --no-pager -l
    pm2 status
    systemctl status nginx --no-pager -l
    
    echo "📊 Database info:"
    sudo -u postgres psql -c "\l" | grep ibiki
    sudo -u postgres psql -d ibiki -c "SELECT COUNT(*) as total_users FROM users;"
    
    echo "📁 Application info:"
    ls -la /root/ | grep -E "(ibiki|sms|app)"
    
    echo "🗂️ Creating backups..."
    cd /root
    
    # Database backup
    sudo -u postgres pg_dump ibiki > /tmp/ibiki-full-backup.sql
    
    # Application backup (excluding large files)
    tar -czf /tmp/ibiki-app.tar.gz . --exclude=node_modules --exclude=.git --exclude=*.tar.gz --exclude=*.zip --exclude=*.dump --exclude=.pm2
    
    # Nginx configuration
    tar -czf /tmp/nginx-config.tar.gz /etc/nginx/sites-available/ /etc/nginx/sites-enabled/
    
    # Environment file
    cp /root/.env.production /tmp/ibiki-env.backup
    
    echo "✅ Backups created successfully!"
    ls -la /tmp/ibiki-*
EOF

# Step 2: Transfer backups
echo "📤 Transferring backups..."
scp $SOURCE_SERVER:/tmp/ibiki-full-backup.sql $TARGET_SERVER:/tmp/
scp $SOURCE_SERVER:/tmp/ibiki-app.tar.gz $TARGET_SERVER:/tmp/
scp $SOURCE_SERVER:/tmp/nginx-config.tar.gz $TARGET_SERVER:/tmp/
scp $SOURCE_SERVER:/tmp/ibiki-env.backup $TARGET_SERVER:/tmp/

# Step 3: Complete wipe and restore on target server
echo "🧹 Wiping existing installation and restoring..."
ssh $TARGET_SERVER << 'RESTORE_EOF'
    echo "🔧 Starting complete wipe and restore..."
    
    # Stop all services
    echo "🛑 Stopping all services..."
    systemctl stop ibiki 2>/dev/null || true
    systemctl stop nginx 2>/dev/null || true
    pm2 stop all 2>/dev/null || true
    
    # Install required packages
    echo "📦 Installing required packages..."
    apt update
    apt install -y postgresql postgresql-contrib nodejs npm nginx
    
    # Set up PostgreSQL
    echo "🗄️ Setting up PostgreSQL..."
    systemctl start postgresql
    systemctl enable postgresql
    
    # Drop existing database and create new one
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS ibiki;"
    sudo -u postgres psql -c "DROP USER IF EXISTS ibiki_user;"
    sudo -u postgres psql -c "CREATE USER ibiki_user WITH PASSWORD 'c0smic4382';"
    sudo -u postgres psql -c "CREATE DATABASE ibiki OWNER ibiki_user;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ibiki TO ibiki_user;"
    
    # Restore database
    echo "💾 Restoring database..."
    sudo -u postgres psql -U ibiki_user -d ibiki < /tmp/ibiki-full-backup.sql
    
    # Clean and restore application
    echo "🧹 Cleaning application directory..."
    rm -rf /root/ibiki-sms /root/ibiki /opt/ibiki* 2>/dev/null || true
    
    echo "📁 Restoring application..."
    cd /root
    tar -xzf /tmp/ibiki-app.tar.gz -C /root/ibiki-sms --strip-components=1 || tar -xzf /tmp/ibiki-app.tar.gz
    
    # Restore environment
    echo "🔐 Restoring environment..."
    cp /tmp/ibiki-env.backup /root/.env.production
    
    # Restore nginx configuration
    echo "🌐 Restoring nginx configuration..."
    rm -rf /etc/nginx/sites-available/ibiki* /etc/nginx/sites-enabled/ibiki*
    tar -xzf /tmp/nginx-config.tar.gz -C /
    
    # Install dependencies
    echo "🔧 Installing dependencies..."
    cd /root
    npm ci --only=production
    npm run build
    
    # Start services
    echo "🚀 Starting services..."
    systemctl daemon-reload
    systemctl enable nginx
    systemctl start nginx
    
    # Start application with PM2
    echo "🔄 Starting application with PM2..."
    pm2 start ecosystem.config.js || pm2 start /root/server/index.js --name ibiki-sms || pm2 start /root/index.js --name ibiki-sms || pm2 start /root/dist/index.js --name ibiki-sms || pm2 start /root/server.js --name ibiki-sms
    pm2 save
    pm2 startup
    
    echo "✅ Migration complete!"
    echo "🌐 New production server ready at http://151.243.109.66"
    
    # Final verification
    echo "🔍 Final verification:"
    systemctl status postgresql --no-pager -l
    systemctl status nginx --no-pager -l
    pm2 status
    
    echo "🎉 Migration successful!"
    echo "📊 Database restored with all data"
    echo "🌐 Application ready at http://151.243.109.66"
RESTORE_EOF

echo "🎉 Complete migration finished!"
echo "🌐 New production server: http://151.243.109.66"
echo "✅ All data and configuration restored from 151.243.109.79"
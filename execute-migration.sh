#!/bin/bash

# Execute complete migration
# Run this on the target server (151.243.109.66)

echo "🚀 Starting complete migration to 151.243.109.66"
echo "🧹 This will completely wipe existing installation"

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

# Create database and user
echo "🗄️ Creating database and user..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ibiki;"
sudo -u postgres psql -c "DROP USER IF EXISTS ibiki_user;"
sudo -u postgres psql -c "CREATE USER ibiki_user WITH PASSWORD 'c0smic4382';"
sudo -u postgres psql -c "CREATE DATABASE ibiki OWNER ibiki_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ibiki TO ibiki_user;"

# Clean existing installation
echo "🧹 Cleaning existing installation..."
rm -rf /root/ibiki-sms /root/ibiki /opt/ibiki* 2>/dev/null || true

# Transfer and restore database
echo "💾 Restoring database..."
scp root@151.243.109.79:/tmp/ibiki-full-backup.sql /tmp/
sudo -u postgres psql -U ibiki_user -d ibiki < /tmp/ibiki-full-backup.sql

# Transfer and restore application
echo "📁 Restoring application..."
scp root@151.243.109.79:/tmp/ibiki-app.tar.gz /tmp/
cd /root
tar -xzf /tmp/ibiki-app.tar.gz

# Transfer and restore nginx configuration
echo "🌐 Restoring nginx configuration..."
scp root@151.243.109.79:/tmp/nginx-config.tar.gz /tmp/
tar -xzf /tmp/nginx-config.tar.gz -C /

# Transfer and restore environment
echo "🔐 Restoring environment..."
scp root@151.243.109.79:/tmp/ibiki-env.backup /tmp/
cp /tmp/ibiki-env.backup /root/.env.production

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

# Start application
echo "🔄 Starting application..."
pm2 start ecosystem.config.js || pm2 start /root/server/index.js --name ibiki-sms || pm2 start /root/index.js --name ibiki-sms
pm2 save
pm2 startup

echo "✅ Migration complete!"
echo "🌐 New production server ready at http://151.243.109.66"
echo "📊 Database restored with all data"
echo "🎉 Migration successful!"
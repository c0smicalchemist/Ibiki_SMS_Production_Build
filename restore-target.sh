#!/bin/bash
# Restore script for target server (151.243.109.66)

echo "🔧 Setting up new production server..."

# Install required packages
echo "📦 Installing required packages..."
apt update

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL..."
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
else
    echo "✅ PostgreSQL already installed"
fi

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo "✅ Node.js already installed"
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
else
    echo "✅ PM2 already installed"
fi

# Install nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing nginx..."
    apt install -y nginx
else
    echo "✅ nginx already installed"
fi

# Set up database
echo "🗄️ Setting up database..."
sudo -u postgres psql -c "CREATE USER ibiki_user WITH PASSWORD 'c0smic4382';"
sudo -u postgres psql -c "CREATE DATABASE ibiki OWNER ibiki_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ibiki TO ibiki_user;"

# Restore database
echo "💾 Restoring database..."
sudo -u postgres psql -U ibiki_user -d ibiki < /tmp/ibiki-full-backup.sql

# Restore application
echo "📁 Restoring application..."
cd /root
tar -xzf /tmp/ibiki-app.tar.gz

# Restore nginx configuration
echo "🌐 Restoring nginx configuration..."
tar -xzf /tmp/nginx-config.tar.gz -C /

# Restore systemd services
echo "⚙️ Restoring systemd services..."
tar -xzf /tmp/systemd-services.tar.gz -C /

# Restore environment
echo "🔐 Restoring environment..."
cp /tmp/ibiki-env.backup /root/ibiki-sms/.env.production

# Install dependencies and start application
echo "🔧 Installing dependencies..."
cd /root/ibiki-sms
npm ci --only=production
npm run build

# Start services
echo "🚀 Starting services..."
systemctl daemon-reload
systemctl enable ibiki
systemctl start ibiki

# Test nginx configuration
echo "🌐 Testing nginx configuration..."
nginx -t && systemctl reload nginx

# Start PM2 if using
echo "🔄 Starting PM2 services..."
pm2 restart all || pm2 start ecosystem.config.js || true

echo "✅ Restoration complete!"
echo "🌐 New production server ready at http://151.243.109.66"

echo "🔍 Final status check:"
echo "PostgreSQL Status:"
systemctl status postgresql --no-pager -l
echo
echo "Nginx Status:"
systemctl status nginx --no-pager -l
echo
echo "Application Status:"
systemctl status ibiki --no-pager -l
echo
echo "PM2 Status:"
pm2 status || echo "PM2 not used"
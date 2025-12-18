#!/bin/bash
# Manual deployment script for Ibiki SMS to new Linux server

SERVER="151.243.109.66"
USER="root"
PASSWORD="COsmic4382##"

echo "🚀 Starting Ibiki SMS deployment to $SERVER"

# Step 1: Connect to server and set up environment
echo "📦 Setting up server environment..."
ssh $USER@$SERVER << 'ENDSSH'
# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js and dependencies
echo "📦 Installing Node.js and dependencies..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx postgresql postgresql-contrib unzip

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Create app directory
mkdir -p /opt/ibiki-sms
cd /opt/ibiki-sms

# Create systemd service for PM2
echo "🔧 Setting up PM2 service..."
pm2 startup systemd -u root --hp /root

ENDSSH

echo "✅ Server environment setup complete"
echo "📦 Now transfer files using:"
echo "scp -r dist/ package.json ecosystem.config.js .env.example server/ migrations/ shared/ $USER@$SERVER:/opt/ibiki-sms/"
echo ""
echo "Then run the final setup:"
echo "ssh $USER@$SERVER 'cd /opt/ibiki-sms && npm install && pm2 start ecosystem.config.js && pm2 save'"
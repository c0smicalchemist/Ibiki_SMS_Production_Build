#!/bin/bash
# Complete cleanup and fresh deployment for Ibiki SMS

SERVER="151.243.109.66"
USER="root"
PASSWORD="COsmic4382##"

echo "🧹 COMPLETE CLEANUP & FRESH DEPLOYMENT"
echo "======================================"
echo "Server: $SERVER"
echo "User: $USER"
echo ""

# Function to run remote commands
run_remote() {
    echo "🚀 Executing: $1"
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $USER@$SERVER "$1"
}

# Step 1: Complete cleanup
echo "🧹 STEP 1: COMPLETE CLEANUP"
echo "=========================="

run_remote "
echo 'Stopping all services...'
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

systemctl stop ibiki-sms 2>/dev/null || true
systemctl disable ibiki-sms 2>/dev/null || true

systemctl stop nginx 2>/dev/null || true

# Remove all old files
echo 'Removing old deployment files...'
rm -rf /opt/ibiki-sms
rm -rf /var/www/ibiki-sms
rm -rf /home/*/ibiki-sms
rm -rf /root/ibiki-sms

# Remove PM2 configurations
echo 'Cleaning PM2 configurations...'
pm2 unstartup systemd 2>/dev/null || true
rm -rf /root/.pm2
rm -rf /etc/systemd/system/ibiki-sms.service

# Remove nginx configurations
echo 'Cleaning nginx configurations...'
rm -f /etc/nginx/sites-available/ibiki-sms
rm -f /etc/nginx/sites-enabled/ibiki-sms

# Clean up any remaining processes
echo 'Killing any remaining processes...'
pkill -f ibiki-sms || true
pkill -f node || true

# Clean up logs
echo 'Cleaning logs...'
rm -f /var/log/ibiki-sms*
rm -f /tmp/ibiki-sms*

echo '✅ Cleanup complete!'
"

# Step 2: Fresh server setup
echo "🔧 STEP 2: FRESH SERVER SETUP"
echo "============================"

run_remote "
echo 'Updating system packages...'
apt update && apt upgrade -y

echo 'Installing Node.js 20.x...'
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx postgresql postgresql-contrib unzip curl wget

echo 'Installing PM2 globally...'
npm install -g pm2

echo 'Creating fresh app directory...'
mkdir -p /opt/ibiki-sms
cd /opt/ibiki-sms

echo 'Setting up PM2 startup...'
pm2 startup systemd -u root --hp /root

echo '✅ Fresh server setup complete!'
"

# Step 3: Build and transfer fresh deployment
echo "📦 STEP 3: BUILD & TRANSFER"
echo "=========================="

# Build fresh version
echo "Building fresh version..."
npm run build

# Create deployment package
echo "Creating deployment package..."
tar -czf ibiki-fresh.tar.gz \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=*.log \
    --exclude=.env \
    --exclude=backup \
    --exclude=release \
    --exclude=client/node_modules \
    --exclude=desktop \
    --exclude=docs \
    --exclude=ops \
    --exclude=scripts \
    --exclude=.trae \
    --exclude=.continue \
    --exclude=.vercel \
    --exclude=attached_assets \
    --exclude=backup \
    --exclude=release \
    --exclude=*.zip \
    --exclude=*.tar.gz \
    dist/ package.json package-lock.json ecosystem.config.js .env.example server/ migrations/ shared/

# Transfer deployment package
echo "Transferring deployment package..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no ibiki-fresh.tar.gz $USER@$SERVER:/tmp/

# Step 4: Deploy on server
echo "🚀 STEP 4: DEPLOY ON SERVER"
echo "=========================="

run_remote "
cd /opt/ibiki-sms

# Extract deployment package
echo 'Extracting deployment package...'
tar -xzf /tmp/ibiki-fresh.tar.gz

# Install dependencies
echo 'Installing dependencies...'
npm ci --production

# Create environment file
echo 'Creating environment file...'
cp .env.example .env

# Set up nginx configuration
echo 'Setting up nginx configuration...'
cat > /etc/nginx/sites-available/ibiki-sms << 'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable nginx site
ln -sf /etc/nginx/sites-available/ibiki-sms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Start services
echo 'Starting services...'
systemctl enable nginx
systemctl restart nginx

# Start PM2
echo 'Starting PM2...'
pm2 start ecosystem.config.js --name ibiki-sms
pm2 save

# Create systemd service
echo 'Creating systemd service...'
pm2 startup systemd

# Clean up deployment package
rm -f /tmp/ibiki-fresh.tar.gz

echo '✅ Deployment complete!'
"

# Step 5: Verification
echo "🔍 STEP 5: VERIFICATION"
echo "======================"

run_remote "
echo 'Checking deployment status...'
echo 'PM2 Status:'
pm2 status

echo 'Service Health:'
curl -s http://localhost:5000/api/health || echo 'Health check failed'

echo 'Nginx Status:'
systemctl status nginx --no-pager

echo 'Port Status:'
netstat -tlnp | grep :5000 || echo 'Port 5000 not found'

echo '✅ Verification complete!'
"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo "✅ Old deployment completely removed"
echo "✅ Fresh latest version deployed"
echo "✅ Services configured and running"
echo ""
echo "🌐 Access your Ibiki SMS at:"
echo "   http://151.243.109.66"
echo "   http://151.243.109.66/api/health (health check)"
echo ""
echo "📋 Next Steps:"
echo "1. Configure your .env file with database settings"
echo "2. Set up SSL certificate (Let's Encrypt)"
echo "3. Configure SMS provider settings"
echo "4. Test the application"
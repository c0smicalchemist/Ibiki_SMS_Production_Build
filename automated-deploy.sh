#!/bin/bash
# Automated Ibiki SMS Deployment Script
# Usage: ./automated-deploy.sh

set -e

# Server configuration
SERVER="151.243.109.66"
USER="root"
PASSWORD="Cosmic4382##"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Automated Ibiki SMS Deployment${NC}"
echo -e "${GREEN}============================================${NC}"

# Function to run remote commands with password
run_remote() {
    echo -e "${YELLOW}🚀 Executing: $1${NC}"
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $USER@$SERVER "$1"
}

# Function to transfer files
transfer_file() {
    echo -e "${YELLOW}📤 Transferring: $1${NC}"
    sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no "$1" $USER@$SERVER:$2
}

# Check if sshpass is available
if ! command -v sshpass &> /dev/null; then
    echo -e "${RED}❌ sshpass not found. Installing...${NC}"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y sshpass
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenkov/sshpass/sshpass
    elif [[ "$OSTYPE" == "msys" ]]; then
        echo -e "${RED}Please install sshpass manually on Windows${NC}"
        exit 1
    fi
fi

# Step 1: Complete cleanup
echo -e "${GREEN}🧹 Step 1: Complete cleanup...${NC}"
run_remote "
    echo '🛑 Stopping services...'
    pm2 delete all 2>/dev/null || true
    systemctl stop nginx 2>/dev/null || true
    
    echo '🧹 Removing old files...'
    rm -rf /opt/ibiki-sms /var/www/ibiki-sms /root/ibiki-sms
    rm -rf /root/.pm2
    rm -f /etc/nginx/sites-available/ibiki-sms /etc/nginx/sites-enabled/ibiki-sms
    
    echo '✅ Cleanup complete'
"

# Step 2: System setup
echo -e "${GREEN}🔧 Step 2: System setup...${NC}"
run_remote "
    echo '📦 Updating system...'
    apt update && apt upgrade -y
    
    echo '📦 Installing Node.js 20.x...'
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs nginx postgresql postgresql-contrib git curl wget
    
    echo '📦 Installing PM2...'
    npm install -g pm2
    
    echo '✅ System setup complete'
"

# Step 3: Clone and setup application
echo -e "${GREEN}📥 Step 3: Clone and setup application...${NC}"
run_remote "
    echo '📁 Creating app directory...'
    mkdir -p /opt/ibiki-sms
    cd /opt/ibiki-sms
    
    echo '📥 Cloning from GitHub...'
    git clone https://github.com/c0smicalchemist/Ibiki_SMS_Production_Build.git .
    git checkout Live_Production
    
    echo '📦 Installing dependencies...'
    npm install
    
    echo '🔨 Building application...'
    npm run build
    
    echo '🔧 Creating environment file...'
    cat > .env << 'ENV'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://ibiki_user:c0smic4382@localhost:5432/ibiki
ENV
    
    echo '✅ Application setup complete'
"

# Step 4: Configure nginx
echo -e "${GREEN}🔧 Step 4: Configure nginx...${NC}"
run_remote "
    echo '📝 Creating nginx configuration...'
    cat > /etc/nginx/sites-available/ibiki-sms << 'NGINX'
server {
    listen 80;
    server_name ibiki.run.place;
    
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
}
NGINX
    
    echo '🔗 Enabling nginx site...'
    ln -sf /etc/nginx/sites-available/ibiki-sms /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    echo '✅ Testing nginx configuration...'
    nginx -t
    
    echo '🚀 Starting nginx...'
    systemctl enable nginx
    systemctl start nginx
    
    echo '✅ Nginx configured'
"

# Step 5: Start application
echo -e "${GREEN}🚀 Step 5: Start application...${NC}"
run_remote "
    echo '📦 Starting PM2...'
    cd /opt/ibiki-sms
    pm2 start dist/index.js --name ibiki-sms
    pm2 save
    pm2 startup systemd
    
    echo '✅ Application started'
"

# Step 6: Verification
echo -e "${GREEN}🔍 Step 6: Verification...${NC}"
run_remote "
    echo '📊 Checking PM2 status...'
    pm2 status
    
    echo '🌐 Checking application health...'
    curl -s http://localhost:5000/api/health || echo 'Health check endpoint not available'
    
    echo '🔍 Checking nginx status...'
    systemctl status nginx --no-pager
    
    echo '🔍 Checking port status...'
    netstat -tlnp | grep :5000
    
    echo '✅ Verification complete'
"

echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}======================${NC}"
echo -e "${GREEN}✅ Ibiki SMS is now running on: http://151.243.109.66${NC}"
echo -e "${GREEN}✅ PM2 is managing the application${NC}"
echo -e "${GREEN}✅ Nginx is configured as reverse proxy${NC}"
echo -e "${GREEN}✅ System will auto-start on reboot${NC}"

echo -e "${YELLOW}📋 Next Steps:${NC}"
echo -e "${YELLOW}1. Configure SSL certificate (Let's Encrypt)${NC}"
echo -e "${YELLOW}2. Set up PostgreSQL database${NC}"
echo -e "${YELLOW}3. Update DNS to point ibiki.run.place to 151.243.109.66${NC}"
echo -e "${YELLOW}4. Test the application${NC}"

echo -e "${GREEN}🚀 Deployment script execution complete!${NC}"
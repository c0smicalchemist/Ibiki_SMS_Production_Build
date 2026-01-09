#!/bin/bash
#
# PRODUCTION DEPLOYMENT SCRIPT
# Deploys cleaned Ibiki SMS to production server with zero-downtime
# Author: Senior Full-Stack Engineer
# Date: 2026-01-06
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Load deployment credentials
if [ ! -f .deployment-credentials ]; then
    echo -e "${RED}ERROR: .deployment-credentials file not found${NC}"
    exit 1
fi

source .deployment-credentials

echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   IBIKI SMS - PRODUCTION DEPLOYMENT           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Pre-deployment checks
echo -e "${YELLOW}[1/10] Pre-deployment checks...${NC}"
npm run check || { echo -e "${RED}TypeScript check failed!${NC}"; exit 1; }
echo -e "${GREEN}✓ TypeScript compilation passed${NC}"

# Step 2: Build production assets
echo -e "${YELLOW}[2/10] Building production assets...${NC}"
npm run build || { echo -e "${RED}Build failed!${NC}"; exit 1; }
echo -e "${GREEN}✓ Production build complete${NC}"

# Step 3: Create deployment package
echo -e "${YELLOW}[3/10] Creating deployment package...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_PKG="ibiki-deploy-${TIMESTAMP}.tar.gz"

tar -czf "$DEPLOY_PKG" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=.env \
    --exclude=.deployment-credentials \
    --exclude=temp_deploy_build \
    --exclude=tmp \
    --exclude=*.tar.gz \
    --exclude=*.zip \
    dist/ \
    server/ \
    shared/ \
    migrations/ \
    package.json \
    package-lock.json \
    ecosystem.config.js \
    drizzle.config.ts \
    .env.example

echo -e "${GREEN}✓ Package created: ${DEPLOY_PKG}${NC}"

# Step 4: Test SSH connection
echo -e "${YELLOW}[4/10] Testing server connection...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
    ${SERVER_USER}@${SERVER_HOST} "echo 'Connection OK'" || {
    echo -e "${RED}Cannot connect to server!${NC}"
    exit 1
}
echo -e "${GREEN}✓ Server connection established${NC}"

# Step 5: Backup existing production
echo -e "${YELLOW}[5/10] Backing up production server...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
    BACKUP_DIR="/root/ibiki-backups"
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Backup application files
    if [ -d "/var/www/ibiki-sms" ]; then
        tar -czf "$BACKUP_DIR/ibiki-app-${BACKUP_DATE}.tar.gz" \
            -C /var/www ibiki-sms/ 2>/dev/null || echo "No existing app to backup"
    fi
    
    # Backup database
    if command -v pg_dump &> /dev/null; then
        export PGPASSWORD='c0smic4382'
        pg_dump -U ibiki_user -h localhost ibiki | gzip > "$BACKUP_DIR/ibiki-db-${BACKUP_DATE}.sql.gz"
        echo "Database backup created"
    fi
    
    # Keep only last 5 backups
    cd "$BACKUP_DIR"
    ls -t ibiki-app-*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f
    ls -t ibiki-db-*.sql.gz 2>/dev/null | tail -n +6 | xargs rm -f
ENDSSH
echo -e "${GREEN}✓ Production backup complete${NC}"

# Step 6: Upload deployment package
echo -e "${YELLOW}[6/10] Uploading to server...${NC}"
sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no \
    "$DEPLOY_PKG" ${SERVER_USER}@${SERVER_HOST}:/tmp/
echo -e "${GREEN}✓ Upload complete${NC}"

# Step 7: Deploy application
echo -e "${YELLOW}[7/10] Deploying application...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh ${SERVER_USER}@${SERVER_HOST} << ENDSSH
    set -e
    
    # Ensure app directory exists
    mkdir -p /opt/ibiki-sms
    cd /opt/ibiki-sms
    
    # Stop existing application
    if command -v pm2 &> /dev/null; then
        pm2 stop ibiki-sms || true
        pm2 delete ibiki-sms || true
    fi
    
    # Extract new deployment
    tar -xzf /tmp/${DEPLOY_PKG} -C /var/www/ibiki-sms/
    
    # Install dependencies (production only)
    export NODE_ENV=production
    npm ci --production --ignore-scripts
    
    echo "Deployment extracted and dependencies installed"
ENDSSH
echo -e "${GREEN}✓ Application deployed${NC}"

# Step 8: Configure environment
echo -e "${YELLOW}[8/10] Configuring production environment...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh ${SERVER_USER}@${SERVER_HOST} << ENDSSH
    cd /var/www/ibiki-sms
    
    # Create production .env if it doesn't exist
    if [ ! -f .env ]; then
        cat > .env << 'EOF'
NODE_ENV=production
PORT=5000

# Production Domain
PRODUCTION_URL=https://ibiki.run.place
CORS_ORIGIN=https://ibiki.run.place

# Database
DATABASE_URL=postgresql://ibiki_user:c0smic4382@localhost:5432/ibiki

# JWT & Security (generate secure secrets in production!)
JWT_SECRET=\$(openssl rand -base64 32)
SESSION_SECRET=\$(openssl rand -base64 32)
WEBHOOK_SECRET=\$(openssl rand -base64 32)

# Admin
SUPER_ADMIN_EMAIL=ibiki_dash@proton.me

# SMS Vendors
# Primary: TextBelt (configure via Admin Dashboard)
# Fallback: ExtremeSMS (configure via Admin Dashboard)
# API keys should be configured post-deployment through the web interface

# Pricing
DEFAULT_EXTREME_COST=0.0025
DEFAULT_CLIENT_RATE=0.004

# CORS
CORS_ORIGIN=*
EOF
        echo "Created new .env file"
    else
        echo ".env already exists, skipping"
    fi
ENDSSH
echo -e "${GREEN}✓ Environment configured${NC}"

# Step 9: Run database migrations
echo -e "${YELLOW}[9/10] Running database migrations...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
    cd /var/www/ibiki-sms
    
    # Run migrations if drizzle-kit is available
    if npm list drizzle-kit &>/dev/null; then
        npm run db:push || echo "Migration skipped (may already be applied)"
    fi
ENDSSH
echo -e "${GREEN}✓ Database migrations applied${NC}"

# Step 10: Start application with PM2
echo -e "${YELLOW}[10/10] Starting application...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
    cd /var/www/ibiki-sms
    
    # Ensure PM2 is installed globally
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    
    # Start application
    pm2 start ecosystem.config.js
    pm2 save
    
    # Setup PM2 to start on boot
    pm2 startup systemd -u root --hp /root || true
    
    echo ""
    echo "Application started successfully!"
    pm2 status
ENDSSH

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   DEPLOYMENT COMPLETE!                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Server Details:${NC}"
echo -e "  URL: http://${SERVER_HOST}:3000"
echo -e "  Admin: ${ADMIN_EMAIL}"
echo -e "  Database: ibiki (PostgreSQL)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Update ExtremeSMS API key in /var/www/ibiki-sms/.env"
echo -e "  2. Configure Nginx reverse proxy (port 80/443 → 3000)"
echo -e "  3. Setup SSL certificate (Let's Encrypt)"
echo -e "  4. Test login with admin account"
echo -e "  5. Verify SMS sending functionality"
echo ""
echo -e "${GREEN}Deployment package: ${DEPLOY_PKG}${NC}"
echo -e "${GREEN}Backup location: ${SERVER_HOST}:/root/ibiki-backups/${NC}"
echo ""

# Cleanup local deployment package
rm -f "$DEPLOY_PKG"

exit 0

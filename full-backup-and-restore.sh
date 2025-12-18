#!/bin/bash

# Full Backup and Restore Script for Ibiki SMS Migration
# From: 151.243.109.79 (working server)
# To: 151.243.109.66 (new production server)

set -e

# Configuration
SOURCE_SERVER="root@151.243.109.79"
TARGET_SERVER="root@151.243.109.66"
BACKUP_DIR="/tmp/ibiki-migration-$(date +%Y%m%d-%H%M%S)"
APP_DIR="/root/ibiki-sms"
DB_NAME="ibiki"
DB_USER="ibiki_user"
DB_PASS="c0smic4382"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Ibiki SMS Migration Script${NC}"
echo -e "${GREEN}📦 Creating full backup from ${SOURCE_SERVER}${NC}"
echo -e "${GREEN}🎯 Restoring to ${TARGET_SERVER}${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to create backup on source server
create_backup() {
    echo -e "${YELLOW}📋 Creating backup on source server...${NC}"
    
    ssh "$SOURCE_SERVER" << 'EOF'
    echo "🔍 Checking current setup..."
    
    # Check PostgreSQL status
    systemctl status postgresql --no-pager
    
    # Check application status
    pm2 status
    
    # Check nginx status
    systemctl status nginx --no-pager
    
    # Check current directory
    ls -la /root/
    
    # Check environment file
    if [ -f /root/ibiki-sms/.env.production ]; then
        echo "✅ Environment file found"
        cat /root/ibiki-sms/.env.production | grep -E "(DATABASE_URL|PORT|NODE_ENV)" | sed 's/password=.*/password=***REDACTED***/'
    fi
EOF
}

# Function to backup PostgreSQL database
backup_database() {
    echo -e "${YELLOW}💾 Backing up PostgreSQL database...${NC}"
    
    # Create database backup
    ssh "$SOURCE_SERVER" "pg_dump -U $DB_USER -h localhost $DB_NAME > /tmp/ibiki-backup.sql"
    
    # Copy backup to local
    scp "$SOURCE_SERVER:/tmp/ibiki-backup.sql" "$BACKUP_DIR/"
    
    echo -e "${GREEN}✅ Database backup created: $BACKUP_DIR/ibiki-backup.sql${NC}"
}

# Function to backup application files
backup_application() {
    echo -e "${YELLOW}📁 Backing up application files...${NC}"
    
    # Create application backup
    ssh "$SOURCE_SERVER" "cd /root && tar -czf /tmp/ibiki-app-backup.tar.gz ibiki-sms/"
    
    # Copy backup to local
    scp "$SOURCE_SERVER:/tmp/ibiki-app-backup.tar.gz" "$BACKUP_DIR/"
    
    echo -e "${GREEN}✅ Application backup created: $BACKUP_DIR/ibiki-app-backup.tar.gz${NC}"
}

# Function to backup nginx configuration
backup_nginx() {
    echo -e "${YELLOW}🌐 Backing up nginx configuration...${NC}"
    
    # Create nginx backup
    ssh "$SOURCE_SERVER" "tar -czf /tmp/nginx-backup.tar.gz /etc/nginx/sites-available/ /etc/nginx/sites-enabled/"
    
    # Copy backup to local
    scp "$SOURCE_SERVER:/tmp/nginx-backup.tar.gz" "$BACKUP_DIR/"
    
    echo -e "${GREEN}✅ Nginx backup created: $BACKUP_DIR/nginx-backup.tar.gz${NC}"
}

# Function to backup systemd services
backup_services() {
    echo -e "${YELLOW}⚙️ Backing up systemd services...${NC}"
    
    # Create services backup
    ssh "$SOURCE_SERVER" "tar -czf /tmp/services-backup.tar.gz /etc/systemd/system/ibiki*"
    
    # Copy backup to local
    scp "$SOURCE_SERVER:/tmp/services-backup.tar.gz" "$BACKUP_DIR/"
    
    echo -e "${GREEN}✅ Services backup created: $BACKUP_DIR/services-backup.tar.gz${NC}"
}

# Function to backup PM2 configuration
backup_pm2() {
    echo -e "${YELLOW}🔄 Backing up PM2 configuration...${NC}"
    
    # Create PM2 ecosystem file
    ssh "$SOURCE_SERVER" "cd $APP_DIR && pm2 ecosystem > /tmp/ecosystem.config.js"
    
    # Copy ecosystem file
    scp "$SOURCE_SERVER:/tmp/ecosystem.config.js" "$BACKUP_DIR/"
    
    echo -e "${GREEN}✅ PM2 configuration backed up: $BACKUP_DIR/ecosystem.config.js${NC}"
}

# Function to restore on target server
restore_to_target() {
    echo -e "${YELLOW}🎯 Restoring to target server...${NC}"
    
    # Transfer all backups to target server
    scp -r "$BACKUP_DIR" "$TARGET_SERVER:/tmp/"
    
    # Execute restore script on target server
    ssh "$TARGET_SERVER" << 'RESTORE_EOF'
    echo "🔧 Starting restoration on target server..."
    
    BACKUP_DIR="/tmp/ibiki-migration-*"
    LATEST_BACKUP=$(ls -t $BACKUP_DIR | head -1)
    
    echo "📦 Using backup: $LATEST_BACKUP"
    
    # Install PostgreSQL if not already installed
    if ! command -v psql &> /dev/null; then
        echo "📦 Installing PostgreSQL..."
        apt update && apt install -y postgresql postgresql-contrib
        systemctl start postgresql
        systemctl enable postgresql
    fi
    
    # Create database and user
    echo "🗄️ Setting up database..."
    sudo -u postgres psql -c "CREATE USER ibiki_user WITH PASSWORD 'c0smic4382';"
    sudo -u postgres psql -c "CREATE DATABASE ibiki OWNER ibiki_user;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ibiki TO ibiki_user;"
    
    # Restore database
    echo "💾 Restoring database..."
    sudo -u postgres psql -U ibiki_user -d ibiki < "$LATEST_BACKUP/ibiki-backup.sql"
    
    # Install Node.js if not already installed
    if ! command -v node &> /dev/null; then
        echo "📦 Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt install -y nodejs
    fi
    
    # Install PM2 if not already installed
    if ! command -v pm2 &> /dev/null; then
        echo "📦 Installing PM2..."
        npm install -g pm2
    fi
    
    # Restore application
    echo "📁 Restoring application..."
    cd /root
    tar -xzf "$LATEST_BACKUP/ibiki-app-backup.tar.gz"
    
    # Restore nginx configuration
    echo "🌐 Restoring nginx configuration..."
    tar -xzf "$LATEST_BACKUP/nginx-backup.tar.gz" -C /
    
    # Restore systemd services
    echo "⚙️ Restoring systemd services..."
    tar -xzf "$LATEST_BACKUP/services-backup.tar.gz" -C /
    
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
    nginx -t && systemctl reload nginx
    
    echo "✅ Restoration complete!"
    echo "🌐 Application should be available at http://151.243.109.66"
RESTORE_EOF
}

# Main execution
echo -e "${GREEN}🚀 Starting migration process...${NC}"

# Step 1: Create backup
create_backup
backup_database
backup_application
backup_nginx
backup_services
backup_pm2

# Step 2: Restore to target
restore_to_target

echo -e "${GREEN}🎉 Migration complete!${NC}"
echo -e "${GREEN}✅ All data has been transferred from 151.243.109.79 to 151.243.109.66${NC}"
echo -e "${GREEN}🌐 New production server: http://151.243.109.66${NC}"
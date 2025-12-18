# 🚀 Complete Cleanup & Fresh Deployment Guide

## Overview
This guide will help you completely remove the old Ibiki SMS deployment and deploy the latest fresh version to your new server.

## Server Details
- **Server**: 151.243.109.66
- **User**: root
- **Password**: COsmic4382##

## 📋 Step-by-Step Instructions

### Step 1: Connect to Your Server
Open PowerShell or Command Prompt and connect:
```bash
ssh root@151.243.109.66
# Enter password: COsmic4382##
```

### Step 2: Complete Cleanup (Run on Server)
Once connected, run these commands:

```bash
# Stop all services
echo "🛑 Stopping all services..."
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
systemctl stop ibiki-sms 2>/dev/null || true
systemctl disable ibiki-sms 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

# Remove all old files
echo "🧹 Removing old deployment files..."
rm -rf /opt/ibiki-sms
rm -rf /var/www/ibiki-sms
rm -rf /home/*/ibiki-sms
rm -rf /root/ibiki-sms

# Clean PM2 configurations
echo "🧹 Cleaning PM2 configurations..."
pm2 unstartup systemd 2>/dev/null || true
rm -rf /root/.pm2
rm -rf /etc/systemd/system/ibiki-sms.service

# Clean nginx configurations
echo "🧹 Cleaning nginx configurations..."
rm -f /etc/nginx/sites-available/ibiki-sms
rm -f /etc/nginx/sites-enabled/ibiki-sms

# Clean processes and logs
echo "🧹 Cleaning processes and logs..."
pkill -f ibiki-sms || true
pkill -f node || true
rm -f /var/log/ibiki-sms*
rm -f /tmp/ibiki-sms*

echo "✅ Cleanup complete!"
```

### Step 3: Fresh Server Setup (Run on Server)
```bash
# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx postgresql postgresql-contrib unzip curl wget

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Create fresh app directory
echo "📁 Creating fresh app directory..."
mkdir -p /opt/ibiki-sms
cd /opt/ibiki-sms

# Set up PM2 startup
echo "🔧 Setting up PM2 startup..."
pm2 startup systemd -u root --hp /root

echo "✅ Fresh server setup complete!"
```

### Step 4: Build Fresh Version (Run on Local)
In a new PowerShell window on your local machine:
```powershell
# Build fresh version
npm run build

# Create deployment package
powershell -Command "Compress-Archive -Path 'dist', 'package.json', 'package-lock.json', 'ecosystem.config.js', '.env.example', 'server', 'migrations', 'shared' -DestinationPath 'ibiki-fresh.zip' -Force"
```

### Step 5: Transfer Files (Run on Local)
```bash
# Transfer deployment package
scp ibiki-fresh.zip root@151.243.109.66:/tmp/
```

### Step 6: Deploy on Server (Run on Server)
```bash
cd /opt/ibiki-sms

# Extract deployment package
echo "📦 Extracting deployment package..."
unzip -o /tmp/ibiki-fresh.zip

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Create environment file
echo "🔧 Creating environment file..."
cp .env.example .env

# Set up nginx configuration
echo "🔧 Setting up nginx configuration..."
cat > /etc/nginx/sites-available/ibiki-sms << 'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable nginx site
ln -sf /etc/nginx/sites-available/ibiki-sms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Start services
echo "🚀 Starting services..."
systemctl enable nginx
systemctl restart nginx

# Start PM2
echo "🚀 Starting PM2..."
pm2 start ecosystem.config.js --name ibiki-sms
pm2 save

# Create systemd service
echo "🔧 Creating systemd service..."
pm2 startup systemd

# Clean up deployment package
rm -f /tmp/ibiki-fresh.zip

echo "✅ Deployment complete!"
```

### Step 7: Verification (Run on Server)
```bash
echo "🔍 Checking deployment status..."
echo "PM2 Status:"
pm2 status

echo "Service Health:"
curl -s http://localhost:5000/api/health

echo "Nginx Status:"
systemctl status nginx --no-pager

echo "Port Status:"
netstat -tlnp | grep :5000

echo "✅ Verification complete!"
```

## 🌐 Access Your Application
After deployment, access your Ibiki SMS at:
- **Main Application**: http://151.243.109.66
- **Health Check**: http://151.243.109.66/api/health
- **Admin Panel**: http://151.243.109.66/admin

## 📋 Next Steps After Deployment
1. **Configure Database**: Edit `/opt/ibiki-sms/.env` with your PostgreSQL connection string
2. **Set up SSL**: Use Let's Encrypt for HTTPS
3. **Configure SMS Provider**: Set up your SMS provider credentials
4. **Test Application**: Verify all features are working

## 🔧 Quick Commands for Management
```bash
# Check application status
pm2 status ibiki-sms

# View logs
pm2 logs ibiki-sms

# Restart application
pm2 restart ibiki-sms

# Stop application
pm2 stop ibiki-sms

# Check nginx status
systemctl status nginx
```

## 🆘 Troubleshooting
If you encounter issues:
1. **SSH Connection**: Ensure you can connect with `ssh root@151.243.109.66`
2. **Port Access**: Check if port 5000 is accessible
3. **Firewall**: Ensure firewall allows HTTP (port 80) and HTTPS (port 443)
4. **Logs**: Check PM2 logs with `pm2 logs ibiki-sms`

## 📞 Support
If you need help with any step, please provide the specific error message and I'll assist you further.
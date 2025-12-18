@echo off
echo 🧹 COMPLETE CLEANUP & FRESH DEPLOYMENT
echo ======================================
echo Server: 151.243.109.66
echo User: root
echo.

REM Check if required tools are available
where ssh >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ SSH not found. Please install OpenSSH or use PuTTY tools.
    pause
    exit /b 1
)

REM Step 1: Complete cleanup
echo 🧹 STEP 1: COMPLETE CLEANUP
echo ==========================
ssh root@151.243.109.66 "
echo Stopping all services...
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

systemctl stop ibiki-sms 2>/dev/null || true
systemctl disable ibiki-sms 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

echo Removing old deployment files...
rm -rf /opt/ibiki-sms
rm -rf /var/www/ibiki-sms
rm -rf /home/*/ibiki-sms
rm -rf /root/ibiki-sms

echo Cleaning PM2 configurations...
pm2 unstartup systemd 2>/dev/null || true
rm -rf /root/.pm2
rm -rf /etc/systemd/system/ibiki-sms.service

echo Cleaning nginx configurations...
rm -f /etc/nginx/sites-available/ibiki-sms
rm -f /etc/nginx/sites-enabled/ibiki-sms

echo Killing any remaining processes...
pkill -f ibiki-sms || true
pkill -f node || true

echo Cleaning logs...
rm -f /var/log/ibiki-sms*
rm -f /tmp/ibiki-sms*

echo ✅ Cleanup complete!
"

REM Step 2: Fresh server setup
echo 🔧 STEP 2: FRESH SERVER SETUP
echo ============================
ssh root@151.243.109.66 "
echo Updating system packages...
apt update && apt upgrade -y

echo Installing Node.js 20.x...
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx postgresql postgresql-contrib unzip curl wget

echo Installing PM2 globally...
npm install -g pm2

echo Creating fresh app directory...
mkdir -p /opt/ibiki-sms
cd /opt/ibiki-sms

echo Setting up PM2 startup...
pm2 startup systemd -u root --hp /root

echo ✅ Fresh server setup complete!
"

REM Step 3: Build fresh version
echo 📦 STEP 3: BUILD FRESH VERSION
echo ==============================
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

REM Step 4: Create deployment package
echo Creating deployment package...
powershell -Command "Compress-Archive -Path 'dist', 'package.json', 'package-lock.json', 'ecosystem.config.js', '.env.example', 'server', 'migrations', 'shared' -DestinationPath 'ibiki-fresh.zip' -Force"

REM Step 5: Transfer and deploy
echo 📤 STEP 4: TRANSFER & DEPLOY
echo ============================

REM Transfer deployment package
scp ibiki-fresh.zip root@151.243.109.66:/tmp/

REM Deploy on server
ssh root@151.243.109.66 "
cd /opt/ibiki-sms

echo Extracting deployment package...
unzip -o /tmp/ibiki-fresh.zip

echo Installing dependencies...
npm ci --production

echo Creating environment file...
cp .env.example .env

echo Setting up nginx configuration...
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
echo Starting services...
systemctl enable nginx
systemctl restart nginx

# Start PM2
echo Starting PM2...
pm2 start ecosystem.config.js --name ibiki-sms
pm2 save

# Create systemd service
echo Creating systemd service...
pm2 startup systemd

# Clean up deployment package
rm -f /tmp/ibiki-fresh.zip

echo ✅ Deployment complete!
"

REM Step 6: Verification
echo 🔍 STEP 5: VERIFICATION
echo ========================
ssh root@151.243.109.66 "
echo Checking deployment status...
echo PM2 Status:
pm2 status

echo Service Health:
curl -s http://localhost:5000/api/health || echo 'Health check failed'

echo Nginx Status:
systemctl status nginx --no-pager

echo Port Status:
netstat -tlnp | grep :5000 || echo 'Port 5000 not found'

echo ✅ Verification complete!
"

echo.
echo 🎉 DEPLOYMENT COMPLETE!
echo ======================
echo ✅ Old deployment completely removed
echo ✅ Fresh latest version deployed
echo ✅ Services configured and running
echo.
echo 🌐 Access your Ibiki SMS at:
echo    http://151.243.109.66
echo    http://151.243.109.66/api/health (health check)
echo.
echo 📋 Next Steps:
echo 1. Configure your .env file with database settings
echo 2. Set up SSL certificate (Let's Encrypt)
echo 3. Configure SMS provider settings
echo 4. Test the application

echo.
pause
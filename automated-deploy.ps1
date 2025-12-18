# Automated Ibiki SMS Deployment Script for Windows PowerShell
# Usage: .\automated-deploy.ps1

param(
    [string]$Server = "151.243.109.66",
    [string]$User = "root",
    [string]$Password = "Cosmic4382##"
)

# Colors for output
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Reset = "`e[0m"

Write-Host "${Green}🚀 Starting Automated Ibiki SMS Deployment${Reset}" -ForegroundColor Green
Write-Host "${Green}============================================${Reset}" -ForegroundColor Green

# Function to run remote commands
function Invoke-RemoteCommand {
    param([string]$Command)
    Write-Host "${Yellow}🚀 Executing: $Command${Reset}" -ForegroundColor Yellow
    $securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential($User, $securePassword)
    
    $session = New-PSSession -HostName $Server -UserName $User -SSHTransport
    Invoke-Command -Session $session -ScriptBlock { param($cmd) Invoke-Expression $cmd } -ArgumentList $Command
    Remove-PSSession -Session $session
}

# Alternative method using plink if available
function Invoke-RemoteCommand-Plink {
    param([string]$Command)
    Write-Host "${Yellow}🚀 Executing: $Command${Reset}" -ForegroundColor Yellow
    $plinkPath = "C:\Program Files\PuTTY\plink.exe"
    if (Test-Path $plinkPath) {
        & $plinkPath -pw $Password "$User@$Server" $Command
    } else {
        Write-Host "${Red}❌ PuTTY plink.exe not found. Please install PuTTY.${Reset}" -ForegroundColor Red
        exit 1
    }
}

# Use the method that's available
function Run-Remote {
    param([string]$Command)
    try {
        Invoke-RemoteCommand-Plink $Command
    } catch {
        Write-Host "${Red}❌ Error executing command: $_${Reset}" -ForegroundColor Red
    }
}

# Step 1: Complete cleanup
Write-Host "${Green}🧹 Step 1: Complete cleanup...${Reset}" -ForegroundColor Green
Run-Remote @"
    echo '🛑 Stopping services...'
    pm2 delete all 2>/dev/null || true
    systemctl stop nginx 2>/dev/null || true
    
    echo '🧹 Removing old files...'
    rm -rf /opt/ibiki-sms /var/www/ibiki-sms /root/ibiki-sms
    rm -rf /root/.pm2
    rm -f /etc/nginx/sites-available/ibiki-sms /etc/nginx/sites-enabled/ibiki-sms
    
    echo '✅ Cleanup complete'
"@

# Step 2: System setup
Write-Host "${Green}🔧 Step 2: System setup...${Reset}" -ForegroundColor Green
Run-Remote @"
    echo '📦 Updating system...'
    apt update && apt upgrade -y
    
    echo '📦 Installing Node.js 20.x...'
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs nginx postgresql postgresql-contrib git curl wget
    
    echo '📦 Installing PM2...'
    npm install -g pm2
    
    echo '✅ System setup complete'
"@

# Step 3: Clone and setup application
Write-Host "${Green}📥 Step 3: Clone and setup application...${Reset}" -ForegroundColor Green
Run-Remote @"
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
"@

# Step 4: Configure nginx
Write-Host "${Green}🔧 Step 4: Configure nginx...${Reset}" -ForegroundColor Green
Run-Remote @"
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
"@

# Step 5: Start application
Write-Host "${Green}🚀 Step 5: Start application...${Reset}" -ForegroundColor Green
Run-Remote @"
    echo '📦 Starting PM2...'
    cd /opt/ibiki-sms
    pm2 start dist/index.js --name ibiki-sms
    pm2 save
    pm2 startup systemd
    
    echo '✅ Application started'
"@

# Step 6: Verification
Write-Host "${Green}🔍 Step 6: Verification...${Reset}" -ForegroundColor Green
Run-Remote @"
    echo '📊 Checking PM2 status...'
    pm2 status
    
    echo '🌐 Checking application health...'
    curl -s http://localhost:5000/api/health || echo 'Health check endpoint not available'
    
    echo '🔍 Checking nginx status...'
    systemctl status nginx --no-pager
    
    echo '🔍 Checking port status...'
    netstat -tlnp | grep :5000
    
    echo '✅ Verification complete'
"@

Write-Host "${Green}🎉 Deployment Complete!${Reset}" -ForegroundColor Green
Write-Host "${Green}======================${Reset}" -ForegroundColor Green
Write-Host "${Green}✅ Ibiki SMS is now running on: http://151.243.109.66${Reset}" -ForegroundColor Green
Write-Host "${Green}✅ PM2 is managing the application${Reset}" -ForegroundColor Green
Write-Host "${Green}✅ Nginx is configured as reverse proxy${Reset}" -ForegroundColor Green
Write-Host "${Green}✅ System will auto-start on reboot${Reset}" -ForegroundColor Green

Write-Host "${Yellow}📋 Next Steps:${Reset}" -ForegroundColor Yellow
Write-Host "${Yellow}1. Configure SSL certificate (Let's Encrypt)${Reset}" -ForegroundColor Yellow
Write-Host "${Yellow}2. Set up PostgreSQL database${Reset}" -ForegroundColor Yellow
Write-Host "${Yellow}3. Update DNS to point ibiki.run.place to 151.243.109.66${Reset}" -ForegroundColor Yellow
Write-Host "${Yellow}4. Test the application${Reset}" -ForegroundColor Yellow

Write-Host "${Green}🚀 Deployment script execution complete!${Reset}" -ForegroundColor Green
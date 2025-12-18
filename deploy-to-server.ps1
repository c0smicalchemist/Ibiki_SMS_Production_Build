# PowerShell deployment script for Ibiki SMS to new Linux server
param(
    [string]$Server = "151.243.109.66",
    [string]$User = "root",
    [string]$Password = "COsmic4382##"
)

Write-Host "🚀 Starting Ibiki SMS deployment to $Server" -ForegroundColor Green

# Check if pscp is available
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"
if (-not (Test-Path $pscpPath)) {
    Write-Host "❌ PuTTY pscp.exe not found at $pscpPath" -ForegroundColor Red
    Write-Host "Please install PuTTY or provide correct pscp path" -ForegroundColor Yellow
    exit 1
}

# Create deployment package
Write-Host "📦 Creating deployment package..." -ForegroundColor Blue
$deploymentFiles = @(
    "dist\*",
    "package.json",
    "package-lock.json",
    "ecosystem.config.js",
    ".env.example",
    "server\*",
    "migrations\*",
    "shared\*",
    "scripts\*"
)

# Create deployment archive
Compress-Archive -Path $deploymentFiles -DestinationPath "ibiki-deployment.zip" -Force

# Deploy via SCP
Write-Host "📤 Transferring files to server..." -ForegroundColor Blue
$remotePath = "/tmp/ibiki-deployment.zip"

# Use pscp to transfer files
$pscpArgs = @(
    "-pw", $Password,
    "-r",
    "ibiki-deployment.zip",
    "$User@${Server}:$remotePath"
)

& $pscpPath @pscpArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to transfer files" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Files transferred successfully" -ForegroundColor Green

# Create remote setup script
$setupScript = @"
#!/bin/bash
echo "🚀 Setting up Ibiki SMS on new server..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js and dependencies
echo "📦 Installing Node.js and dependencies..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx postgresql postgresql-contrib

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Create app directory
mkdir -p /opt/ibiki-sms
cd /opt/ibiki-sms

# Extract deployment package
echo "📦 Extracting deployment package..."
unzip -o /tmp/ibiki-deployment.zip

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm ci --production

# Create systemd service for PM2
echo "🔧 Setting up PM2 service..."
pm2 startup systemd -u root --hp /root

# Create environment file
echo "🔧 Creating environment configuration..."
cp .env.example .env

# Set up nginx
echo "🔧 Setting up Nginx..."
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
echo "🚀 Starting services..."
systemctl enable nginx
systemctl restart nginx

# Start PM2
echo "🚀 Starting PM2..."
pm2 start ecosystem.config.js
pm2 save

# Create startup service
pm2 startup

echo "✅ Deployment complete!"
echo "🌐 Your Ibiki SMS should be available at: http://151.243.109.66"
echo ""
echo "📋 Next steps:"
echo "1. Configure your .env file with database settings"
echo "2. Set up SSL certificate (Let's Encrypt recommended)"
echo "3. Configure your SMS provider settings"
"@

# Write setup script to file
$setupScript | Out-File -FilePath "remote-setup.sh" -Encoding UTF8

# Transfer setup script
Write-Host "📤 Transferring setup script..." -ForegroundColor Blue
& $pscpPath @("-pw", $Password, "remote-setup.sh", "$User@${Server}:/tmp/remote-setup.sh")

# Execute setup script remotely
Write-Host "🔧 Running remote setup..." -ForegroundColor Blue
$plinkPath = "C:\Program Files\PuTTY\plink.exe"
& $plinkPath @("-pw", $Password, "$User@$Server", "chmod +x /tmp/remote-setup.sh && /tmp/remote-setup.sh")

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Access your Ibiki SMS at: http://$Server" -ForegroundColor Cyan
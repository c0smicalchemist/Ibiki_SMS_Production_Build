# Ibiki SMS - Quick Deployment from Laptop

## ✅ Backup Status
**Date**: February 21, 2026  
**Branch**: scalability-queue-system-2026-01-09  
**GitHub Repos**:
- Development: https://github.com/c0smicalchemist/Ibiki_SMS_Development_Build
- Production: https://github.com/c0smicalchemist/Ibiki_SMS_Production_Build

## 🚀 Deploy to New Server (15 Minutes)

### Prerequisites
- Ubuntu 22.04+ VPS (2GB RAM minimum, 4GB recommended)
- Root SSH access
- Domain pointing to server IP (optional but recommended)

### Step 1: Clone Repository on New Server

```bash
# SSH into your new server
ssh root@YOUR_SERVER_IP

# Install git
apt update && apt install -y git

# Clone the repository
git clone https://github.com/c0smicalchemist/Ibiki_SMS_Production_Build.git /opt/ibiki-sms
cd /opt/ibiki-sms

# Checkout the latest stable branch
git checkout scalability-queue-system-2026-01-09
```

### Step 2: Run One-Click Deployment

```bash
# Make deployment script executable
chmod +x deploy.sh

# Run full installation (installs Node.js, PostgreSQL, PM2, nginx, builds app)
./deploy.sh
```

The script will:
- ✅ Install Node.js 20, PostgreSQL, nginx, PM2
- ✅ Create database and run migrations
- ✅ Build frontend and backend
- ✅ Configure nginx with SSL
- ✅ Start application with PM2
- ✅ Configure firewall

### Step 3: Configure Environment Variables

```bash
# Edit environment file
nano /opt/ibiki-sms/.env.production
```

**Required Variables:**
```env
# Database (auto-configured by deploy.sh)
DATABASE_URL=postgresql://ibiki_user:PASSWORD@localhost:5432/ibiki

# Security (CHANGE THESE!)
SESSION_SECRET=your-super-secret-session-key-min-32-chars
WEBHOOK_SECRET=your-webhook-secret-min-32-chars
JWT_SECRET=your-jwt-secret-min-32-chars

# SMS Vendors
ANVEO_API_KEY=your-anveo-api-key
TEXTBELT_API_KEY=your-textbelt-key (optional)

# Optional AI Features
OPENROUTER_API_KEY=your-openrouter-key (for Ibiki Phraser)

# Pricing
DEFAULT_CLIENT_RATE=0.03
DEFAULT_EXTREME_COST=0.01
```

Save and restart:
```bash
pm2 restart ibiki-sms
```

### Step 4: Configure DNS (Optional)

Point your domain to the server:
```
A record: @ → YOUR_SERVER_IP
A record: ibiki → YOUR_SERVER_IP
```

Update nginx:
```bash
nano /etc/nginx/sites-available/ibiki-sms
# Change server_name to your domain
systemctl reload nginx
```

### Step 5: Create Admin User

```bash
# Connect to database
sudo -u postgres psql ibiki

# Create admin user
INSERT INTO users (id, username, email, password, role, credits) 
VALUES (
  gen_random_uuid(), 
  'admin',
  'your@email.com',
  crypt('your_password', gen_salt('bf')),
  'admin',
  10000
);

# Exit
\q
```

### Step 6: Verify Installation

```bash
# Check PM2 status
pm2 status

# Check nginx status
systemctl status nginx

# Test API
curl http://localhost:5000/api/health

# Check logs
pm2 logs ibiki-sms
```

**Access the Dashboard:**
- HTTP: http://YOUR_SERVER_IP
- HTTPS: https://YOUR_DOMAIN (after DNS setup)

---

## 📦 Deploy from Your Laptop (Alternative)

If you want to deploy directly from your laptop:

```powershell
# 1. Navigate to project directory
cd "C:\Users\c0smi\Downloads\Coding Projects\Ibiki_SMS_Development_Build"

# 2. Build locally
npm install
npm run build

# 3. Deploy to server
$SERVER = "root@YOUR_SERVER_IP"

# Copy files
scp -r dist/ $SERVER:/opt/ibiki-sms/
scp package.json $SERVER:/opt/ibiki-sms/
scp ecosystem.config.js $SERVER:/opt/ibiki-sms/

# SSH and restart
ssh $SERVER "cd /opt/ibiki-sms && npm install --production && pm2 restart ibiki-sms"
```

---

## 🔧 Key Fixes Included (Feb 2026)

✅ **DLR Status Bug Fixed** - Messages now show correct delivery status  
✅ **Daily Counter Accuracy** - Counters only increment after successful send  
✅ **Cloudflare Integration** - Nginx configured for Cloudflare proxy  
✅ **Dotenv Bundling Fixed** - No more unhandled promise rejections  
✅ **Number Pool Optimization** - Sticky routing with proper usage tracking

---

## 📊 System Requirements

**Minimum:**
- 2GB RAM
- 2 CPU cores
- 20GB storage
- Ubuntu 22.04

**Recommended:**
- 4GB RAM
- 4 CPU cores
- 40GB storage
- Ubuntu 22.04

---

## 🆘 Troubleshooting

**Server won't start:**
```bash
pm2 logs ibiki-sms --lines 50
```

**Database issues:**
```bash
sudo -u postgres psql -l  # List databases
pm2 restart ibiki-sms
```

**Nginx issues:**
```bash
nginx -t  # Test config
systemctl status nginx
```

**Port already in use:**
```bash
lsof -i :5000  # Check what's using port 5000
killall node   # Kill all node processes
pm2 restart ibiki-sms
```

---

## 📝 Important Files

- `/opt/ibiki-sms/.env.production` - Environment variables
- `/etc/nginx/sites-available/ibiki-sms` - Nginx config
- `/opt/ibiki-sms/ecosystem.config.js` - PM2 config
- `/opt/ibiki-sms/migrations/` - Database schema

---

## 🔐 Security Checklist

- [ ] Change all SECRET keys in .env
- [ ] Configure firewall (UFW)
- [ ] Enable SSL/HTTPS
- [ ] Set strong admin password
- [ ] Configure Cloudflare (optional)
- [ ] Set up daily backups

---

## 📞 Support

Repository: https://github.com/c0smicalchemist/Ibiki_SMS_Production_Build  
Latest Branch: scalability-queue-system-2026-01-09

**Emergency Restore:**
```bash
git clone https://github.com/c0smicalchemist/Ibiki_SMS_Production_Build.git
cd Ibiki_SMS_Production_Build
git checkout scalability-queue-system-2026-01-09
./deploy.sh
```

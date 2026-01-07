# 🛡️ DEPLOYMENT SAFEGUARDS & SYNCHRONIZATION SYSTEM

## Overview
This system ensures complete synchronization between **Local Development**, **Git Repository**, and **Production Server** with automatic integrity checks and security controls.

---

## 🔒 Security-First Approach

### Files That Are NEVER Committed to Git:
- ✅ `.env` (all environment files)
- ✅ `*.pem`, `*.key` (SSH keys, certificates)
- ✅ `passwords.txt`, `credentials.*`
- ✅ `ecosystem.config.js.local` (if contains secrets)
- ✅ `dist/` folder (generated build artifacts)
- ✅ Backup SQL files with user data

### What IS Committed to Git:
- ✅ Source code (`client/`, `server/`, `shared/`)
- ✅ `.env.example` (template without actual secrets)
- ✅ Configuration files (without secrets)
- ✅ Documentation
- ✅ Deployment scripts
- ✅ Package files (`package.json`, `package-lock.json`)

---

## 📁 File Storage Strategy

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  LOCAL MACHINE  │────▶│  GIT REPOSITORY │────▶│ PRODUCTION SVR  │
│  (Development)  │     │  (Code Backup)  │     │  (Live Site)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                            │
  📦 Full Codebase         📦 Source Only          📦 Built Assets
  🔐 .env (secrets)        ❌ No .env              🔐 .env (secrets)
  🔨 node_modules/         ❌ No node_modules/     🔨 node_modules/
  📊 dist/ (builds)        ❌ No dist/             📊 dist/ (builds)
```

### Sensitive Data Locations:
- **Local:** `C:\Users\c0smi\...\Ibiki_SMS_Development_Build\.env`
- **Server:** `/opt/ibiki-sms/.env`
- **Git:** ❌ NEVER stored in Git

---

## 🚀 Deployment Scripts

### 1. **Pre-Deployment Check** (`pre-deploy-check.ps1`)
Run this BEFORE every deployment to catch issues:

```powershell
.\pre-deploy-check.ps1
```

**What it checks:**
- ✅ Build directory exists
- ✅ Critical files present (index.html, main JS/CSS bundles)
- ✅ No sensitive files tracked in Git
- ✅ Dependencies installed
- ✅ Server connectivity
- ✅ File count consistency (~1500 files expected)

**Exit Codes:**
- `0` = All checks passed ✅
- `1` = Critical failures ❌
- Warnings = Review recommended ⚠️

---

### 2. **Deployment Sync** (`sync-deployment.ps1`)
Comprehensive deployment with verification:

```powershell
# Full deployment (recommended)
.\sync-deployment.ps1

# Dry run (see what would happen)
.\sync-deployment.ps1 -DryRun

# Skip Git sync
.\sync-deployment.ps1 -SkipGit

# Skip server upload (Git only)
.\sync-deployment.ps1 -SkipServer

# Force overwrite
.\sync-deployment.ps1 -Force
```

**What it does:**
1. ✅ Pre-flight checks (Git, SSH, build existence)
2. ✅ Compares local vs server file counts
3. ✅ Identifies missing files
4. ✅ Uploads missing files with retry logic (3 attempts per file)
5. ✅ Verifies deployment (file count, critical files, health check)
6. ✅ Commits source to Git (Prod_Live_Latest branch)
7. ✅ Generates deployment report with timestamps

**Output:**
- Logs: `logs/deployment-YYYYMMDD-HHmmss.log`
- Reports: `logs/report-YYYYMMDD-HHmmss.txt`
- Temp files: `%TEMP%\ibiki-sync\`

---

### 3. **Quick Deployment** (Existing `deploy.sh`)
Use for rapid deployments when you trust the build:

```bash
./deploy.sh
```

---

## 🔄 Typical Deployment Workflow

### Step-by-Step Process:

```powershell
# 1. Make code changes
# Edit files in client/ or server/

# 2. Test locally
npm run dev

# 3. Build for production
npm run build

# 4. Run pre-deployment check
.\pre-deploy-check.ps1

# 5. Review check results
# Fix any failures before proceeding

# 6. Deploy with sync verification
.\sync-deployment.ps1

# 7. Verify on server
# Browse to https://ibiki.run.place
# Check Admin Dashboard → API Testing → Vendors

# 8. Monitor logs
ssh root@151.243.109.66
pm2 logs ibiki-sms --lines 50
```

---

## 🛡️ Security Features

### 1. **Automatic Sensitive File Detection**
The sync script checks for:
- `*.env` files
- `*.pem`, `*.key` (certificates)
- `passwords.txt`, `credentials.*`
- Any file matching `.gitignore` sensitive patterns

If found in Git, deployment is **blocked**.

### 2. **Secure .gitignore** (`.gitignore.secure`)
Enhanced version of `.gitignore` with:
- All environment variables
- SSH keys and certificates
- Backup files
- Database dumps
- Deployment credentials
- IDE settings (optional)

To apply:
```powershell
Copy-Item .gitignore.secure .gitignore -Force
```

### 3. **Environment Template** (`.env.example`)
- Documents all required environment variables
- Provides safe defaults
- Never contains actual secrets
- Safe to commit to Git

---

## 📊 Verification & Integrity Checks

### File Count Verification:
```powershell
# Local
(Get-ChildItem dist/public/assets -File).Count  # Should be ~1510

# Server
ssh root@151.243.109.66 "ls -1 /opt/ibiki-sms/dist/public/assets/ | wc -l"
```

### Critical Files Check:
- `index.html` (entry point)
- `index-C2lczEwA.js` (293 KB - React bundle)
- `AdminDashboard-CRc8VhZr.js` (120 KB - Admin UI)
- `index-BkEmzITG.css` (87 KB - Tailwind styles)

### Health Check:
```bash
curl https://ibiki.run.place/api/health
# Should return: {"status":"healthy","uptime":...}
```

---

## 🔧 Git Branch Strategy

### Branches:
- **`Prod_Live_Latest`** ← Production deployments (use this)
- `main` ← Development
- `Live_Production` ← Previous production
- Feature branches as needed

### Pushing to Production Branch:
```bash
git checkout Prod_Live_Latest
git add .
git commit -m "Deployment: YYYY-MM-DD - Description"
git push origin Prod_Live_Latest
```

The sync script handles this automatically.

---

## 📝 Logs & Reports

### Log Locations:
- **Deployment Logs:** `logs/deployment-YYYYMMDD-HHmmss.log`
- **Deployment Reports:** `logs/report-YYYYMMDD-HHmmss.txt`
- **Server Logs:** `ssh root@151.243.109.66 "pm2 logs ibiki-sms"`

### What's Logged:
- All file operations
- Upload successes/failures
- Retry attempts
- Git operations
- Verification results
- Timestamps for everything

---

## 🚨 Troubleshooting

### Issue: "25 files missing on server"
**Solution:** Run `sync-deployment.ps1` - it will upload them automatically

### Issue: "Sensitive files found in Git"
**Solution:**
```bash
git rm --cached .env
git rm --cached *.pem
git commit -m "Remove sensitive files"
git push
```

### Issue: "Server connection failed"
**Solution:**
1. Check SSH key: `ssh root@151.243.109.66`
2. Verify server is running
3. Check firewall rules

### Issue: "Build not found"
**Solution:**
```bash
npm run build
```

### Issue: "File count mismatch after deployment"
**Solution:**
```powershell
# Re-run with force flag
.\sync-deployment.ps1 -Force
```

---

## ⚡ Performance Optimization

### Upload Speed:
- Parallel uploads: Not used (can cause SSH issues)
- Retry logic: 3 attempts per file with 2-second delays
- Batch processing: 5-13 files per batch

### Best Practices:
1. Run pre-check first (catches issues early)
2. Use `-DryRun` to preview changes
3. Deploy during low-traffic hours
4. Monitor PM2 logs during deployment
5. Keep local build fresh (`npm run build` before deploy)

---

## 📞 Emergency Procedures

### Rollback Deployment:
```bash
# SSH to server
ssh root@151.243.109.66

# Check PM2 restarts
pm2 status

# Restore from Git
cd /opt/ibiki-sms
git fetch origin
git checkout Prod_Live_Latest^  # Previous commit
npm run build
pm2 restart ibiki-sms
```

### Quick Health Check:
```bash
curl https://ibiki.run.place/api/health
pm2 status
pm2 logs ibiki-sms --lines 20 --err
```

### Contact Info:
- Server: 151.243.109.66
- GitHub: https://github.com/c0smicalchemist/Ibiki_SMS_Development_Build
- Branch: Prod_Live_Latest

---

## ✅ Deployment Checklist

Before every deployment:

- [ ] Code changes tested locally
- [ ] `npm run build` completed successfully
- [ ] Pre-deployment check passed
- [ ] `.env` file NOT in Git
- [ ] No sensitive data in code
- [ ] Git branch is correct (Prod_Live_Latest)
- [ ] Server backup taken (if major changes)
- [ ] Deployment window scheduled (low traffic)

After deployment:

- [ ] Health endpoint returns 200 OK
- [ ] Admin dashboard loads
- [ ] Vendor status shows correctly
- [ ] PM2 shows "online" status
- [ ] No errors in PM2 logs
- [ ] Test SMS sending (optional)

---

**✨ This system ensures your deployments are safe, traceable, and never lose files again!**

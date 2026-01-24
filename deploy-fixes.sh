#!/bin/bash
# Quick deploy script for Ibiki SMS - fixes storage2 error and number pool issues
set -euo pipefail

echo "🚀 Starting Ibiki SMS deployment..."

cd /opt/ibiki-sms

# Reconcile git branches (merge strategy)
echo "📥 Pulling latest code..."
git config pull.rebase false
git pull origin main || {
  echo "⚠️  Git pull failed, attempting force reset..."
  git fetch origin main
  git reset --hard origin/main
}

# Update dependencies
echo "📦 Installing dependencies..."
npm install --production || {
  echo "⚠️  npm install failed, trying with --force..."
  npm install --production --force
}

# Build server
echo "🔨 Building server..."
npm run build:server

# Verify build
if [ ! -f "dist/index.js" ]; then
  echo "❌ Build failed - dist/index.js not found"
  exit 1
fi

echo "✅ Build successful: $(ls -lh dist/index.js | awk '{print $5}')"

# Reload PM2
echo "🔄 Reloading PM2..."
pm2 reload ecosystem.config.cjs --only ibiki-sms || pm2 restart ibiki-sms

# Wait for processes to stabilize
sleep 3

# Show status
echo "📊 PM2 Status:"
pm2 list

# Tail logs briefly
echo ""
echo "📋 Recent logs (last 50 lines):"
pm2 logs ibiki-sms --lines 50 --nostream

echo ""
echo "✅ Deployment complete!"
echo "💡 Monitor logs with: pm2 logs ibiki-sms"
echo "💡 Check errors: tail -f /opt/ibiki-sms/logs/err-0.log"

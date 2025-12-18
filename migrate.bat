@echo off
echo 🚀 Starting Ibiki SMS Migration
echo 📦 From: 151.243.109.79 (working server)
echo 🎯 To: 151.243.109.66 (new production server)
echo.

REM Step 1: Create backup on source server
echo 📦 Creating backup on source server...
ssh root@151.243.109.79 "bash -s" < backup-source.sh

REM Step 2: Transfer files
echo 📤 Transferring files...
scp root@151.243.109.79:/tmp/ibiki-backup-* root@151.243.109.66:/tmp/

REM Step 3: Restore on target server
echo 🎯 Restoring on new server...
ssh root@151.243.109.66 "bash -s" < restore-target.sh

echo.
echo 🎉 Migration complete!
echo 🌐 New production server: http://151.243.109.66
pause
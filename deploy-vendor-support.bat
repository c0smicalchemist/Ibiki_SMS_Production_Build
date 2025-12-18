@echo off
echo 🚀 Deploying Multi-Vendor SMS Support
echo ======================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the Ibiki SMS project root
    pause
    exit /b 1
)

REM Create migrations directory if it doesn't exist
if not exist "migrations" mkdir migrations

REM Run database migration
echo 📊 Running database migration...
psql %DATABASE_URL% -f migrations\add-vendor-support.sql

REM Update environment variables
echo 🔧 Updating environment variables...
if not exist ".env" (
    copy .env.example .env
    echo ✅ Created .env file from template
)

REM Check if TEXTBELT_API_KEY is set
findstr "TEXTBELT_API_KEY=your-textbelt-api-key" .env >nul
if %errorlevel%==0 (
    echo ⚠️  Please update TEXTBELT_API_KEY in .env file
)

REM Build the application
echo 🏗️  Building application...
npm run build

REM Restart the application
echo 🔄 Restarting application...
pm2 restart all

REM Check application status
echo 📈 Checking application status...
pm2 status

echo ✅ Multi-vendor SMS support deployed successfully!
echo.
echo 📋 Next steps:
echo 1. Update TEXTBELT_API_KEY in .env file
echo 2. Test vendor switching in Admin Dashboard
echo 3. Monitor logs for any issues
echo.
echo 🌐 Access vendor management at: /admin-dashboard → Configuration tab
pause
# PostgreSQL Setup Script for Ibiki SMS Development
param(
    [string]$Password = "postgres"
)

Write-Host "Setting up PostgreSQL for Ibiki SMS Development..." -ForegroundColor Green

# PostgreSQL path
$pgPath = "C:\Program Files\PostgreSQL\17\bin"

# Check if PostgreSQL is installed
if (-not (Test-Path $pgPath)) {
    Write-Host "PostgreSQL not found at $pgPath" -ForegroundColor Red
    exit 1
}

# Set environment variable for password
$env:PGPASSWORD = $Password

Write-Host "Creating database 'ibiki'..." -ForegroundColor Yellow
try {
    & "$pgPath\createdb.exe" -U postgres ibiki
    Write-Host "Database 'ibiki' created successfully!" -ForegroundColor Green
} catch {
    Write-Host "Database might already exist or error occurred: $_" -ForegroundColor Yellow
}

Write-Host "Creating user 'ibiki_user'..." -ForegroundColor Yellow
try {
    & "$pgPath\psql.exe" -U postgres -c "CREATE USER ibiki_user WITH PASSWORD 'c0smic4382';"
    Write-Host "User 'ibiki_user' created successfully!" -ForegroundColor Green
} catch {
    Write-Host "User might already exist or error occurred: $_" -ForegroundColor Yellow
}

Write-Host "Granting privileges..." -ForegroundColor Yellow
try {
    & "$pgPath\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ibiki TO ibiki_user;"
    Write-Host "Privileges granted successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error granting privileges: $_" -ForegroundColor Yellow
}

Write-Host "Testing connection..." -ForegroundColor Yellow
try {
    & "$pgPath\psql.exe" -U postgres -d ibiki -c "SELECT 'Database connection successful' as status;"
    Write-Host "Connection test successful!" -ForegroundColor Green
} catch {
    Write-Host "Connection test failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "Database: ibiki" -ForegroundColor Cyan
Write-Host "User: postgres (using default)" -ForegroundColor Cyan
Write-Host "Password: $Password" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your .env.development file should contain:" -ForegroundColor Yellow
Write-Host "DATABASE_URL=postgresql://postgres:$Password@localhost:5432/ibiki" -ForegroundColor White
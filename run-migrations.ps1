#!/usr/bin/env pwsh
# Database Migration Runner
# Purpose: Run SQL migrations on production server with tracking

param(
    [string]$Server = "151.243.109.66",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "`n==============================================================" -ForegroundColor Cyan
Write-Host "           DATABASE MIGRATION RUNNER                       " -ForegroundColor Cyan
Write-Host "==============================================================`n" -ForegroundColor Cyan

# Get database connection details from server
Write-Host "[*] Connecting to server..." -ForegroundColor Yellow
$dbInfo = ssh root@$Server "grep DATABASE_URL /opt/ibiki-sms/.env | cut -d'=' -f2-"

if (!$dbInfo) {
    Write-Host "[ERROR] Failed to get database connection info" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Database connection retrieved" -ForegroundColor Green

# Parse DATABASE_URL
if ($dbInfo -match "postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)") {
    $dbUser = $Matches[1]
    $dbPass = $Matches[2]
    $dbHost = $Matches[3]
    $dbPort = $Matches[4]
    $dbName = $Matches[5]
    
    Write-Host "[INFO] Database: $dbName on ${dbHost}:${dbPort}" -ForegroundColor Cyan
} else {
    Write-Host "[ERROR] Failed to parse DATABASE_URL" -ForegroundColor Red
    exit 1
}

# Create migrations_history table
$createHistorySQL = @"
CREATE TABLE IF NOT EXISTS migrations_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    execution_time_ms INTEGER,
    status VARCHAR(50) NOT NULL
);
"@

Write-Host "`n[*] Ensuring migrations_history table exists..." -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "[DRY RUN] Would create migrations_history table" -ForegroundColor Magenta
} else {
    # Write SQL to temp file and execute
    $createHistorySQL | Out-File -FilePath "temp_create_history.sql" -Encoding UTF8
    scp "temp_create_history.sql" "root@${Server}:/tmp/create_history.sql" 2>$null | Out-Null
    ssh root@$Server "PGPASSWORD='$dbPass' psql -h $dbHost -U $dbUser -d $dbName -f /tmp/create_history.sql 2>&1" | Out-Null
    Remove-Item "temp_create_history.sql" -Force
    ssh root@$Server "rm -f /tmp/create_history.sql" 2>$null | Out-Null
    
    Write-Host "[OK] migrations_history table ready" -ForegroundColor Green
}

# Get list of migration files
$migrationFiles = Get-ChildItem -Path "migrations" -Filter "*.sql" | Sort-Object Name

Write-Host "`n[INFO] Found $($migrationFiles.Count) migration files" -ForegroundColor Cyan

# Get already executed migrations
Write-Host "`n[*] Checking migration history..." -ForegroundColor Yellow
$executedMigrations = @()
if (!$DryRun) {
    $historySQL = "SELECT migration_name FROM migrations_history WHERE status = 'success'"
    $historySQL | Out-File -FilePath "temp_history.sql" -Encoding UTF8
    scp "temp_history.sql" "root@${Server}:/tmp/history.sql" 2>&1 | Out-Null
    $historyResult = ssh root@$Server "PGPASSWORD='$dbPass' psql -h $dbHost -U $dbUser -d $dbName -t -A -f /tmp/history.sql" 2>&1
    Remove-Item "temp_history.sql" -Force
    ssh root@$Server "rm -f /tmp/history.sql" 2>&1 | Out-Null
    $executedMigrations = $historyResult -split "`n" | Where-Object { $_ -ne "" }
}

Write-Host "[OK] $($executedMigrations.Count) migrations already executed" -ForegroundColor Green

# Execute pending migrations
$pendingCount = 0
$successCount = 0
$failedCount = 0

foreach ($file in $migrationFiles) {
    $migrationName = $file.Name
    
    if ($executedMigrations -contains $migrationName) {
        Write-Host "[SKIP] $migrationName (already executed)" -ForegroundColor Gray
        continue
    }
    
    $pendingCount++
    Write-Host "`n[*] Executing migration: $migrationName" -ForegroundColor Yellow
    
    # Read migration content
    $migrationSQL = Get-Content $file.FullName -Raw
    
    if ($DryRun) {
        Write-Host "[DRY RUN] Would execute:" -ForegroundColor Magenta
        Write-Host $migrationSQL.Substring(0, [Math]::Min(300, $migrationSQL.Length)) -ForegroundColor Gray
        if ($migrationSQL.Length > 300) {
            Write-Host "... (truncated)" -ForegroundColor Gray
        }
        $successCount++
        continue
    }
    
    # Upload migration file to server
    $tempPath = "/tmp/migration_$migrationName"
    scp $file.FullName "root@${Server}:$tempPath" 2>&1 | Out-Null
    
    # Execute migration
    $startTime = Get-Date
    $executeCmd = "PGPASSWORD='$dbPass' psql -h $dbHost -U $dbUser -d $dbName -f $tempPath"
    
    try {
        $output = ssh root@$Server $executeCmd 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $endTime = Get-Date
            $duration = [int](($endTime - $startTime).TotalMilliseconds)
            
            # Record successful migration
            $recordSQL = "INSERT INTO migrations_history (migration_name, execution_time_ms, status) VALUES ('$migrationName', $duration, 'success')"
            $recordSQL | Out-File -FilePath "temp_record.sql" -Encoding UTF8
            scp "temp_record.sql" "root@${Server}:/tmp/record.sql" 2>&1 | Out-Null
            ssh root@$Server "PGPASSWORD='$dbPass' psql -h $dbHost -U $dbUser -d $dbName -f /tmp/record.sql" 2>&1 | Out-Null
            Remove-Item "temp_record.sql" -Force
            ssh root@$Server "rm -f /tmp/record.sql" 2>&1 | Out-Null
            
            Write-Host "[OK] Migration completed in ${duration}ms" -ForegroundColor Green
            $successCount++
        } else {
            throw "Migration failed with exit code $LASTEXITCODE"
        }
    }
    catch {
        # Record failed migration
        $failSQL = "INSERT INTO migrations_history (migration_name, status) VALUES ('$migrationName', 'failed') ON CONFLICT (migration_name) DO UPDATE SET status = 'failed'"
        $failSQL | Out-File -FilePath "temp_fail.sql" -Encoding UTF8
        scp "temp_fail.sql" "root@${Server}:/tmp/fail.sql" 2>&1 | Out-Null
        ssh root@$Server "PGPASSWORD='$dbPass' psql -h $dbHost -U $dbUser -d $dbName -f /tmp/fail.sql" 2>&1 | Out-Null
        Remove-Item "temp_fail.sql" -Force
        ssh root@$Server "rm -f /tmp/fail.sql" 2>&1 | Out-Null
        
        Write-Host "[ERROR] Migration failed: $_" -ForegroundColor Red
        Write-Host $output -ForegroundColor Red
        $failedCount++
    }
    finally {
        # Clean up temp file
        ssh root@$Server "rm -f $tempPath" 2>&1 | Out-Null
    }
}

# Summary
Write-Host "`n==============================================================" -ForegroundColor Cyan
Write-Host "                MIGRATION SUMMARY                          " -ForegroundColor Cyan
Write-Host "==============================================================`n" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "[DRY RUN] No changes made" -ForegroundColor Magenta
}

Write-Host "[INFO] Total migrations: $($migrationFiles.Count)" -ForegroundColor Cyan
Write-Host "[INFO] Already executed: $($executedMigrations.Count)" -ForegroundColor Gray
Write-Host "[INFO] Pending: $pendingCount" -ForegroundColor Yellow
Write-Host "[OK] Successful: $successCount" -ForegroundColor Green

if ($failedCount -gt 0) {
    Write-Host "[ERROR] Failed: $failedCount" -ForegroundColor Red
    Write-Host "`n[!] Some migrations failed! Check logs above." -ForegroundColor Red
    exit 1
}

if ($successCount -gt 0 -and !$DryRun) {
    Write-Host "`n[OK] All migrations executed successfully!" -ForegroundColor Green
    Write-Host "[*] Restarting PM2 to apply schema changes..." -ForegroundColor Yellow
    ssh root@$Server "pm2 restart ibiki-sms" 2>&1 | Out-Null
    Write-Host "[OK] PM2 restarted" -ForegroundColor Green
} elseif ($pendingCount -eq 0) {
    Write-Host "`n[OK] Database is up to date!" -ForegroundColor Green
}

Write-Host ""

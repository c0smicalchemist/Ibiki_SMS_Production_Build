# ========================================
# IBIKI SMS - DEPLOYMENT SYNC & VERIFICATION SCRIPT
# ========================================
# This script ensures complete synchronization between local, git, and server
# with comprehensive integrity checks and automatic recovery

param(
    [switch]$DryRun,
    [switch]$Force,
    [switch]$SkipGit,
    [switch]$SkipServer,
    [string]$Server = "151.243.109.66",
    [string]$ServerUser = "root",
    [string]$ServerPath = "/opt/ibiki-sms/dist/public",
    [string]$GitBranch = "Prod_Live_Latest"
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Colors
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Header { param($msg) Write-Host "`n$('='*60)" -ForegroundColor Cyan; Write-Host $msg -ForegroundColor Cyan; Write-Host $('='*60) -ForegroundColor Cyan }

# Configuration
$script:ProjectRoot = $PSScriptRoot
$script:LocalBuildPath = Join-Path $ProjectRoot "dist\public"
$script:LogPath = Join-Path $ProjectRoot "logs"
$script:TempPath = Join-Path $env:TEMP "ibiki-sync"
$script:DeploymentLog = Join-Path $LogPath "deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$script:Stats = @{
    LocalFiles = 0
    ServerFiles = 0
    GitFiles = 0
    Uploaded = 0
    Failed = 0
    Skipped = 0
    StartTime = Get-Date
}

# Initialize
function Initialize-Environment {
    Write-Header "INITIALIZING DEPLOYMENT ENVIRONMENT"
    
    # Create directories
    @($LogPath, $TempPath) | ForEach-Object {
        if (-not (Test-Path $_)) {
            New-Item -ItemType Directory -Path $_ -Force | Out-Null
            Write-Info "Created directory: $_"
        }
    }
    
    # Start logging
    Start-Transcript -Path $script:DeploymentLog -Append
    Write-Info "Logging to: $script:DeploymentLog"
    Write-Info "Dry Run: $DryRun"
    Write-Info "Force: $Force"
}

# Pre-flight checks
function Test-Prerequisites {
    Write-Header "PRE-FLIGHT CHECKS"
    
    $checks = @()
    
    # Check Git
    $gitVersion = git --version 2>$null
    if ($gitVersion) {
        Write-Success "✓ Git installed: $gitVersion"
        $checks += $true
    } else {
        Write-Error "✗ Git not found"
        $checks += $false
    }
    
    # Check SSH
    $sshVersion = ssh -V 2>&1
    if ($sshVersion) {
        Write-Success "✓ SSH available"
        $checks += $true
    } else {
        Write-Error "✗ SSH not found"
        $checks += $false
    }
    
    # Check local build
    if (Test-Path $script:LocalBuildPath) {
        $script:Stats.LocalFiles = (Get-ChildItem -Path "$script:LocalBuildPath\assets" -File -Recurse).Count
        Write-Success "✓ Local build found: $($script:Stats.LocalFiles) files"
        $checks += $true
    } else {
        Write-Error "✗ Local build not found at: $script:LocalBuildPath"
        $checks += $false
    }
    
    # Check server connectivity
    $pingResult = ssh "$ServerUser@$Server" "echo 'OK'" 2>&1
    if ($pingResult -eq 'OK') {
        Write-Success "✓ Server connection: $Server"
        $checks += $true
    } else {
        Write-Error "✗ Cannot connect to server: $Server"
        $checks += $false
    }
    
    if ($checks -contains $false) {
        Write-Error "`nPre-flight checks failed! Aborting."
        exit 1
    }
    
    Write-Success "`n✓ All pre-flight checks passed"
}

# Compare local vs server
function Compare-LocalServer {
    Write-Header "COMPARING LOCAL vs SERVER FILES"
    
    Write-Info "Scanning server files..."
    $serverFiles = ssh "$ServerUser@$Server" "ls -1 $ServerPath/assets/" | Sort-Object
    $script:Stats.ServerFiles = ($serverFiles | Measure-Object).Count
    
    Write-Info "Scanning local files..."
    $localFiles = Get-ChildItem -Path "$script:LocalBuildPath\assets" -Name | Sort-Object
    $script:Stats.LocalFiles = ($localFiles | Measure-Object).Count
    
    # Save for comparison
    $serverFiles | Out-File "$script:TempPath\server-files.txt" -Encoding UTF8
    $localFiles | Out-File "$script:TempPath\local-files.txt" -Encoding UTF8
    
    # Compare
    $comparison = Compare-Object $serverFiles $localFiles
    
    $missing = $comparison | Where-Object { $_.SideIndicator -eq '=>' } | Select-Object -ExpandProperty InputObject
    $extra = $comparison | Where-Object { $_.SideIndicator -eq '<=' } | Select-Object -ExpandProperty InputObject
    
    Write-Info "`nComparison Results:"
    Write-Info "  Local files:  $($script:Stats.LocalFiles)"
    Write-Info "  Server files: $($script:Stats.ServerFiles)"
    
    if ($missing) {
        Write-Warning "  Missing on server: $($missing.Count) files"
        $missing | Out-File "$script:TempPath\missing-files.txt" -Encoding UTF8
    } else {
        Write-Success "  ✓ No missing files"
    }
    
    if ($extra) {
        Write-Warning "  Extra on server: $($extra.Count) files (outdated?)"
        $extra | Out-File "$script:TempPath\extra-files.txt" -Encoding UTF8
    }
    
    return @{
        Missing = $missing
        Extra = $extra
        InSync = ($missing.Count -eq 0 -and $extra.Count -eq 0)
    }
}

# Upload missing files
function Sync-ToServer {
    param([array]$MissingFiles)
    
    if ($MissingFiles.Count -eq 0) {
        Write-Success "✓ Server already in sync"
        return
    }
    
    Write-Header "UPLOADING MISSING FILES TO SERVER"
    Write-Info "Files to upload: $($MissingFiles.Count)"
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would upload the following files:"
        $MissingFiles | ForEach-Object { Write-Host "  - $_" }
        return
    }
    
    $uploaded = 0
    $failed = @()
    
    foreach ($file in $MissingFiles) {
        $localFile = Join-Path "$script:LocalBuildPath\assets" $file
        
        if (-not (Test-Path $localFile)) {
            Write-Warning "  ⚠ File not found locally: $file"
            $failed += $file
            continue
        }
        
        Write-Info "[$($uploaded + $failed.Count + 1)/$($MissingFiles.Count)] Uploading: $file"
        
        $retries = 0
        $maxRetries = 3
        $success = $false
        
        while ($retries -lt $maxRetries -and -not $success) {
            try {
                scp $localFile "$ServerUser@${Server}:$ServerPath/assets/" 2>&1 | Out-Null
                
                if ($LASTEXITCODE -eq 0) {
                    $success = $true
                    $uploaded++
                    Write-Success "  ✓ Uploaded successfully"
                } else {
                    $retries++
                    if ($retries -lt $maxRetries) {
                        Write-Warning "  Retry $retries/$maxRetries..."
                        Start-Sleep -Seconds 2
                    }
                }
            } catch {
                $retries++
                if ($retries -lt $maxRetries) {
                    Start-Sleep -Seconds 2
                }
            }
        }
        
        if (-not $success) {
            $failed += $file
            Write-Error "  ✗ Failed after $maxRetries attempts"
        }
    }
    
    $script:Stats.Uploaded = $uploaded
    $script:Stats.Failed = $failed.Count
    
    Write-Info "`nUpload Summary:"
    Write-Success "  Uploaded: $uploaded"
    if ($failed.Count -gt 0) {
        Write-Error "  Failed: $($failed.Count)"
        $failed | Out-File "$script:TempPath\failed-uploads.txt" -Encoding UTF8
    }
}

# Verify deployment
function Test-Deployment {
    Write-Header "VERIFYING DEPLOYMENT"
    
    # Re-count server files
    $serverCount = ssh "$ServerUser@$Server" "ls -1 $ServerPath/assets/ | wc -l" 2>&1
    $serverCount = [int]$serverCount.Trim()
    
    Write-Info "Final file count:"
    Write-Info "  Local:  $($script:Stats.LocalFiles)"
    Write-Info "  Server: $serverCount"
    
    if ($serverCount -eq $script:Stats.LocalFiles) {
        Write-Success "`n✓ VERIFICATION PASSED: Files synchronized ($serverCount/$($script:Stats.LocalFiles))"
        
        # Test critical files
        Write-Info "`nTesting critical files..."
        $criticalFiles = @(
            'index-C2lczEwA.js',
            'index-BkEmzITG.css',
            'AdminDashboard-CRc8VhZr.js'
        )
        
        $allPresent = $true
        foreach ($file in $criticalFiles) {
            $exists = ssh "$ServerUser@$Server" "[ -f $ServerPath/assets/$file ] && echo 'OK' || echo 'MISSING'"
            if ($exists -eq 'OK') {
                Write-Success "  ✓ $file"
            } else {
                Write-Error "  ✗ $file MISSING"
                $allPresent = $false
            }
        }
        
        # Test health endpoint
        Write-Info "`nTesting API health..."
        $health = ssh "$ServerUser@$Server" "curl -s http://127.0.0.1:5000/api/health"
        $healthObj = $health | ConvertFrom-Json -ErrorAction SilentlyContinue
        
        if ($healthObj.status -eq 'healthy') {
            Write-Success "  ✓ API Health: $($healthObj.status)"
            Write-Info "  Uptime: $([math]::Round($healthObj.uptime, 2))s"
        } else {
            Write-Error "  ✗ API Health check failed"
        }
        
        return $allPresent
    } else {
        $diff = $script:Stats.LocalFiles - $serverCount
        Write-Error "`n✗ VERIFICATION FAILED: $diff files still missing"
        return $false
    }
}

# Git operations
function Sync-ToGit {
    if ($SkipGit) {
        Write-Warning "Skipping Git sync (--SkipGit flag)"
        return
    }
    
    Write-Header "SYNCING TO GIT REPOSITORY"
    
    # Check if we're in a git repo
    $isGitRepo = Test-Path (Join-Path $script:ProjectRoot ".git")
    if (-not $isGitRepo) {
        Write-Warning "Not a git repository. Skipping git sync."
        return
    }
    
    # Ensure .gitignore.secure is applied
    $gitignoreSecure = Join-Path $script:ProjectRoot ".gitignore.secure"
    $gitignore = Join-Path $script:ProjectRoot ".gitignore"
    
    if (Test-Path $gitignoreSecure) {
        Copy-Item $gitignoreSecure $gitignore -Force
        Write-Success "✓ Applied secure .gitignore"
    }
    
    # Check for sensitive files
    Write-Info "Checking for sensitive files..."
    $sensitivePatterns = @('*.env', '*.pem', '*.key', 'passwords.txt', 'credentials.*')
    $sensitiveFound = @()
    
    foreach ($pattern in $sensitivePatterns) {
        $found = git ls-files $pattern 2>$null
        if ($found) {
            $sensitiveFound += $found
        }
    }
    
    if ($sensitiveFound.Count -gt 0) {
        Write-Error "✗ SECURITY ALERT: Sensitive files found in git:"
        $sensitiveFound | ForEach-Object { Write-Error "  - $_" }
        Write-Error "`nPlease remove these files before committing!"
        return
    }
    
    Write-Success "✓ No sensitive files found"
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would commit and push to $GitBranch"
        return
    }
    
    # Stage changes (excluding dist)
    Write-Info "Staging changes..."
    git add -A
    
    # Show what would be committed
    $status = git status --short
    if ($status) {
        Write-Info "Changes to commit:"
        $status | ForEach-Object { Write-Host "  $_" }
        
        # Commit
        $commitMsg = "Deployment sync - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n`nFiles: $($script:Stats.LocalFiles)`nServer: $Server`nVerified: $(Get-Date)"
        
        git commit -m $commitMsg
        
        # Push to branch
        Write-Info "Pushing to branch: $GitBranch"
        git push origin HEAD:$GitBranch
        
        Write-Success "✓ Changes committed and pushed to $GitBranch"
    } else {
        Write-Info "No changes to commit"
    }
}

# Generate deployment report
function Write-DeploymentReport {
    $duration = (Get-Date) - $script:Stats.StartTime
    
    Write-Header "DEPLOYMENT REPORT"
    
    $report = @"

╔════════════════════════════════════════════════════════════╗
║           IBIKI SMS - DEPLOYMENT SYNC COMPLETE            ║
╚════════════════════════════════════════════════════════════╝

📅 Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
⏱ Duration: $($duration.TotalSeconds) seconds

📊 FILE STATISTICS
   Local Files:    $($script:Stats.LocalFiles)
   Server Files:   $($script:Stats.ServerFiles)
   Uploaded:       $($script:Stats.Uploaded)
   Failed:         $($script:Stats.Failed)
   Skipped:        $($script:Stats.Skipped)

🌐 DEPLOYMENT TARGET
   Server:         $Server
   User:           $ServerUser
   Path:           $ServerPath
   Git Branch:     $GitBranch

🔧 OPERATION MODE
   Dry Run:        $DryRun
   Force:          $Force
   Skip Git:       $SkipGit
   Skip Server:    $SkipServer

📝 LOG FILES
   Deployment:     $script:DeploymentLog
   Temp Files:     $script:TempPath

"@

    Write-Host $report
    
    # Save report
    $reportPath = Join-Path $LogPath "report-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    $report | Out-File $reportPath -Encoding UTF8
    
    Write-Info "Report saved to: $reportPath"
}

# Main execution
function Start-Deployment {
    try {
        Initialize-Environment
        Test-Prerequisites
        
        # Compare and sync
        $comparison = Compare-LocalServer
        
        if (-not $comparison.InSync) {
            if ($SkipServer) {
                Write-Warning "Server sync skipped (--SkipServer flag)"
            } else {
                Sync-ToServer -MissingFiles $comparison.Missing
                $verified = Test-Deployment
                
                if (-not $verified) {
                    Write-Error "Deployment verification failed!"
                    exit 1
                }
            }
        }
        
        # Sync to Git
        Sync-ToGit
        
        # Generate report
        Write-DeploymentReport
        
        Write-Success "`n✓ DEPLOYMENT SYNC COMPLETED SUCCESSFULLY"
        
    } catch {
        Write-Error "Error during deployment: $_"
        Write-Error $_.ScriptStackTrace
        exit 1
    } finally {
        Stop-Transcript
    }
}

# Run
Start-Deployment

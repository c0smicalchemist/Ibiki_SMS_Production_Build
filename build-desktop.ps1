# build-desktop.ps1
param(
    [switch]$Clean,
    [switch]$Dev,
    [switch]$SkipUI
)

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  Ibiki SMS Desktop Builder" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$desktopDir = "$repoRoot\desktop"
$uiDistDir = "$repoRoot\dist\public"

# Clean if requested
if ($Clean) {
    Write-Host "`nCleaning previous builds..." -ForegroundColor Yellow
    
    if (Test-Path $uiDistDir) {
        Remove-Item -Recurse -Force $uiDistDir -ErrorAction SilentlyContinue
        Write-Host "  Removed web UI build" -ForegroundColor Gray
    }
    
    if (Test-Path "$desktopDir\release") {
        Remove-Item -Recurse -Force "$desktopDir\release" -ErrorAction SilentlyContinue
        Write-Host "  Removed desktop releases" -ForegroundColor Gray
    }
    
    if (Test-Path "$desktopDir\node_modules") {
        Remove-Item -Recurse -Force "$desktopDir\node_modules" -ErrorAction SilentlyContinue
        Write-Host "  Removed desktop node_modules" -ForegroundColor Gray
    }
}

# Step 1: Build Web UI
if (-not $SkipUI) {
    Write-Host "`nStep 1: Building Web UI..." -ForegroundColor Green
    Set-Location $repoRoot
    
    # Check Node.js
    $nodeVersion = node --version
    if ($nodeVersion -notmatch "^v2[0-9]") {
        Write-Host "Warning: Node.js $nodeVersion detected. Node 20+ recommended." -ForegroundColor Yellow
    }
    
    npm run build
    
    if (-not (Test-Path "$uiDistDir\index.html")) {
        Write-Host "❌ Web UI build failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✓ Web UI built successfully" -ForegroundColor Green
} else {
    Write-Host "`nStep 1: Skipping UI build" -ForegroundColor Gray
}

# Step 2: Setup Desktop
Write-Host "`nStep 2: Setting up desktop app..." -ForegroundColor Green
Set-Location $desktopDir

if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing desktop dependencies..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "  ✓ Dependencies already installed" -ForegroundColor Gray
}

# Step 3: Build or Dev Mode
if ($Dev) {
    Write-Host "`nStep 3: Starting development mode..." -ForegroundColor Green
    Write-Host "  Press Ctrl+C to stop when done" -ForegroundColor Yellow
    npm run dev
} else {
    Write-Host "`nStep 3: Building installer..." -ForegroundColor Green
    npm run build
    
    # Find the installer
    $installer = Get-ChildItem -Path "release" -Filter "Ibiki SMS Setup*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($installer) {
        $sizeMB = [math]::Round($installer.Length / 1MB, 2)
        Write-Host "`n✅ BUILD SUCCESSFUL!" -ForegroundColor Green
        Write-Host "=======================================" -ForegroundColor Cyan
        Write-Host "Installer created:" -ForegroundColor White
        Write-Host "  $($installer.FullName)" -ForegroundColor Cyan
        Write-Host "  Size: $sizeMB MB" -ForegroundColor Gray
        
        # Show portable version
        $portable = "release\win-unpacked\Ibiki SMS.exe"
        if (Test-Path $portable) {
            $portableSize = [math]::Round((Get-Item $portable).Length / 1MB, 2)
            Write-Host "`nPortable version:" -ForegroundColor White
            Write-Host "  $portable" -ForegroundColor Cyan
            Write-Host "  Size: $portableSize MB" -ForegroundColor Gray
        }
        
        Write-Host "`nTo install:" -ForegroundColor White
        Write-Host "  1. Double-click the installer" -ForegroundColor Gray
        Write-Host "  2. Follow installation wizard" -ForegroundColor Gray
        Write-Host "  3. Launch from Start Menu" -ForegroundColor Gray
        
        $choice = Read-Host "`nOpen release folder? (y/n)"
        if ($choice -eq 'y') {
            explorer release
        }
    } else {
        Write-Host "❌ Installer not found!" -ForegroundColor Red
        Write-Host "Check for errors above." -ForegroundColor Yellow
    }
}

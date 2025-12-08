# build-fixed.ps1 - Workaround for symbolic link issues
param(
    [switch]$Clean,
    [switch]$Dev,
    [switch]$SkipUI
)

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  Ibiki SMS Builder (Workaround)" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$desktopDir = "$repoRoot\desktop"
$uiDistDir = "$repoRoot\dist\public"

# Function to disable winCodeSign temporarily
function Disable-WinCodeSign {
    $electronBuilderConfig = @"
{
  "win": {
    "target": [
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ],
    "signingHashAlgorithms": null,
    "signAndEditExecutable": false,
    "signDlls": false
  }
}
"@
    
    $configPath = "$desktopDir\electron-builder.json"
    Set-Content -Path $configPath -Value $electronBuilderConfig -Encoding UTF8
    Write-Host "  Created electron-builder.json to skip code signing" -ForegroundColor Yellow
}

# Clean if requested
if ($Clean) {
    Write-Host "`nCleaning previous builds..." -ForegroundColor Yellow
    
    # Clear problematic cache
    $cachePath = "$env:LOCALAPPDATA\electron-builder\Cache"
    if (Test-Path $cachePath) {
        Remove-Item -Recurse -Force $cachePath -ErrorAction SilentlyContinue
        Write-Host "  Cleared electron-builder cache" -ForegroundColor Gray
    }
    
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
    
    if (-not (Test-Path "package.json")) {
        Write-Host " package.json not found in repo root!" -ForegroundColor Red
        Write-Host "Make sure you're in the correct directory" -ForegroundColor Yellow
        exit 1
    }
    
    npm run build
    
    if (-not (Test-Path "$uiDistDir\index.html")) {
        Write-Host " Web UI build failed!" -ForegroundColor Red
        Write-Host "Check for errors in npm output above" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "   Web UI built successfully" -ForegroundColor Green
} else {
    Write-Host "`nStep 1: Skipping UI build" -ForegroundColor Gray
}

# Step 2: Setup Desktop
Write-Host "`nStep 2: Setting up desktop app..." -ForegroundColor Green
Set-Location $desktopDir

# Disable winCodeSign to avoid symbolic link issues
Disable-WinCodeSign

if (-not (Test-Path "package.json")) {
    Write-Host " Desktop package.json not found!" -ForegroundColor Red
    Write-Host "Make sure desktop\package.json exists" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing desktop dependencies..." -ForegroundColor Cyan
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host " npm install failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   Dependencies already installed" -ForegroundColor Gray
}

# Step 3: Build or Dev Mode
if ($Dev) {
    Write-Host "`nStep 3: Starting development mode..." -ForegroundColor Green
    Write-Host "  A window will open with your UI" -ForegroundColor Cyan
    Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
    npm run dev
} else {
    Write-Host "`nStep 3: Building portable app (skipping installer due to permissions)..." -ForegroundColor Green
    
    # Build portable app instead of installer
    npx electron-builder --dir --win portable
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   Portable build failed, trying simple pack..." -ForegroundColor Yellow
        npx electron-builder --dir
    }
    
    # Check for built files
    $portableExe = "release\win-unpacked\Ibiki SMS.exe"
    $portableDir = "release\win-unpacked"
    
    if (Test-Path $portableExe) {
        $sizeMB = [math]::Round((Get-Item $portableExe).Length / 1MB, 2)
        
        Write-Host "`n BUILD SUCCESSFUL!" -ForegroundColor Green
        Write-Host "=======================================" -ForegroundColor Cyan
        Write-Host "Portable app created:" -ForegroundColor White
        Write-Host "  $((Get-Item $portableExe).FullName)" -ForegroundColor Cyan
        Write-Host "  Size: $sizeMB MB" -ForegroundColor Gray
        
        Write-Host "`nTo run the app:" -ForegroundColor White
        Write-Host "  1. Navigate to: $((Get-Item $portableDir).FullName)" -ForegroundColor Gray
        Write-Host "  2. Double-click 'Ibiki SMS.exe'" -ForegroundColor Gray
        Write-Host "  3. No installation needed - it's portable!" -ForegroundColor Gray
        
        $choice = Read-Host "`nOpen release folder? (y/n)"
        if ($choice -eq 'y') {
            explorer release
        }
    } else {
        Write-Host " Build failed!" -ForegroundColor Red
        Write-Host "Trying alternative approach..." -ForegroundColor Yellow
        
        # Try direct electron build
        npx @electron-forge/cli import
        
        if (Test-Path "out") {
            Write-Host "Found app in 'out' folder" -ForegroundColor Green
            explorer out
        }
    }
}

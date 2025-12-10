$ErrorActionPreference = "Stop"
param(
  [Parameter(Mandatory=$true)][string]$Host,
  [Parameter(Mandatory=$true)][string]$User,
  [Parameter(Mandatory=$true)][string]$Password,
  [string]$Root,
  [string]$Site
)
if ([string]::IsNullOrEmpty($Root)) { $Root = "/opt/ibiki-sms/dist/public" }
if ([string]::IsNullOrEmpty($Site)) { $Site = "/etc/nginx/sites-enabled/ibiki-sms" }
function Invoke-SSHPassword {
  param([string]$Cmd)
  if (Get-Command plink -ErrorAction SilentlyContinue) {
    & plink -pw $Password "${User}@${Host}" $Cmd
  } elseif (Get-Command ssh -ErrorAction SilentlyContinue) {
    Write-Host "ssh found but password auth is interactive; please ensure keys or use plink/pscp."
    throw "Password-based ssh not supported in non-interactive mode"
  } else { throw "ssh/plink not found" }
}
function Copy-RemotePassword {
  param([string]$Local,[string]$Remote)
  if (Get-Command pscp -ErrorAction SilentlyContinue) {
    & pscp -pw $Password -r $Local "${User}@${Host}:${Remote}"
  } elseif (Get-Command scp -ErrorAction SilentlyContinue) {
    Write-Host "scp found but password auth is interactive; please ensure keys or use pscp."
    throw "Password-based scp not supported in non-interactive mode"
  } else { throw "scp/pscp not found" }
}
Invoke-SSHPassword "sudo mkdir -p '$Root/assets'"
Invoke-SSHPassword "sudo rm -f '$Root/index.html' && sudo rm -rf '$Root/assets/*'"
Copy-RemotePassword "dist/public/*" "$Root/"
Copy-RemotePassword "ops/nginx/ibiki-sms.conf" "$Site"
Invoke-SSHPassword "sudo find '$Root' -type d -exec chmod 755 {} \; && sudo find '$Root' -type f -exec chmod 644 {} \;"
Invoke-SSHPassword "sudo nginx -t && sudo systemctl reload nginx || sudo service nginx reload"
Invoke-SSHPassword "pm2 restart all || true"

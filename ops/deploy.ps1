$ErrorActionPreference = "Stop"
param(
  [Parameter(Mandatory=$true)][string]$Host,
  [Parameter(Mandatory=$true)][string]$User,
  [Parameter(Mandatory=$true)][string]$KeyPath,
  [string]$Root = "/opt/ibiki-sms/dist/public",
  [string]$Site = "/etc/nginx/sites-enabled/ibiki-sms"
)
function Invoke-SSH {
  param([string]$Cmd)
  if (Get-Command plink -ErrorAction SilentlyContinue) {
    & plink -i $KeyPath "$User@$Host" $Cmd
  } elseif (Get-Command ssh -ErrorAction SilentlyContinue) {
    & ssh -i $KeyPath "$User@$Host" $Cmd
  } else { throw "ssh or plink not found" }
}
function Copy-Remote {
  param([string]$Local,[string]$Remote)
  if (Get-Command pscp -ErrorAction SilentlyContinue) {
    & pscp -i $KeyPath -r $Local "$User@$Host:$Remote"
  } elseif (Get-Command scp -ErrorAction SilentlyContinue) {
    & scp -i $KeyPath -r $Local "$User@$Host:$Remote"
  } else { throw "scp or pscp not found" }
}
Invoke-SSH "sudo mkdir -p '$Root/assets'"
Invoke-SSH "sudo rm -f '$Root/index.html' && sudo rm -rf '$Root/assets/*'"
Copy-Remote "dist/public/*" "$Root/"
Copy-Remote "ops/nginx/ibiki-sms.conf" "$Site"
Invoke-SSH "sudo find '$Root' -type d -exec chmod 755 {} \; && sudo find '$Root' -type f -exec chmod 644 {} \;"
Invoke-SSH "sudo nginx -t && sudo systemctl reload nginx || sudo service nginx reload"
Invoke-SSH "pm2 restart all || true"

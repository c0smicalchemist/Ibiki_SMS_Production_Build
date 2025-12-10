Param(
  [string]$ComputerName = 'ibiki.run.place',
  [string]$Username = 'root',
  [string]$PasswordPlain
)

Import-Module Posh-SSH

$securePassword = ConvertTo-SecureString $PasswordPlain -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($Username, $securePassword)

# Trusted host store (in-memory)
$store = New-SSHMemoryKnownHost
$hk = Get-SSHHostKey -ComputerName $ComputerName
New-SSHTrustedHost -HostName $hk.HostName -FingerPrint $hk.Fingerprint -HostKeyName $hk.HostKeyName -KnownHostStore $store | Out-Null

$ssh = New-SSHSession -ComputerName $ComputerName -Credential $cred -KnownHost $store -ErrorOnUntrusted

# Ensure target directories exist
Invoke-SSHCommand -SessionId $ssh.SessionId -Command "mkdir -p /opt/ibiki-sms/dist/public/assets"

# Upload built files
Set-SCPItem -ComputerName $ComputerName -Credential $cred -KnownHost $store -ErrorOnUntrusted -Path (Resolve-Path 'dist/public/index.html') -Destination '/opt/ibiki-sms/dist/public'
if (Test-Path 'dist/public/favicon.png') {
  Set-SCPItem -ComputerName $ComputerName -Credential $cred -KnownHost $store -ErrorOnUntrusted -Path (Resolve-Path 'dist/public/favicon.png') -Destination '/opt/ibiki-sms/dist/public'
}
Set-SCPItem -ComputerName $ComputerName -Credential $cred -KnownHost $store -ErrorOnUntrusted -Path (Resolve-Path 'dist/public/assets') -Destination '/opt/ibiki-sms/dist/public'

# Permissions
Invoke-SSHCommand -SessionId $ssh.SessionId -Command "find /opt/ibiki-sms/dist/public/assets -type d -exec chmod 755 {} \;"
Invoke-SSHCommand -SessionId $ssh.SessionId -Command "find /opt/ibiki-sms/dist/public/assets -type f -exec chmod 644 {} \;"

# Nginx config for static UI
$confPath = '/etc/nginx/conf.d/ibiki-sms-static.conf'
$nginxConf = @"
server {
    listen 80;
    server_name ibiki.run.place;

    root /opt/ibiki-sms/dist/public;

    location /assets/ {
        alias /opt/ibiki-sms/dist/public/assets/;
        try_files $uri =404;
        add_header Cache-Control "no-store, must-revalidate" always;
    }

    location / {
        try_files $uri /index.html;
        add_header Cache-Control "no-store, must-revalidate" always;
    }
}
"@

$cmd = "bash -lc 'cat > " + $confPath + " <<\'CONF\'
" + $nginxConf + "
CONF'"
Invoke-SSHCommand -SessionId $ssh.SessionId -Command $cmd | Out-Null

# Reload Nginx
$test = Invoke-SSHCommand -SessionId $ssh.SessionId -Command "rm -f /etc/nginx/sites-enabled/ibiki-sms-static; nginx -t"
if ($test.ExitStatus -ne 0) {
  throw "nginx -t failed: $($test.Error.Trim())"
}
Invoke-SSHCommand -SessionId $ssh.SessionId -Command "systemctl reload nginx" | Out-Null

# Verify files present
$checkCss = Invoke-SSHCommand -SessionId $ssh.SessionId -Command "test -r /opt/ibiki-sms/dist/public/assets/index-DE2PWPiA.css && echo OK || echo MISSING"
$checkJs = Invoke-SSHCommand -SessionId $ssh.SessionId -Command "test -r /opt/ibiki-sms/dist/public/assets/index-Cxnyac6H.js && echo OK || echo MISSING"
Write-Output ("CSS: " + $checkCss.Output.Trim())
Write-Output ("JS: " + $checkJs.Output.Trim())

# Probe HTTP locally on server
$probeCss = Invoke-SSHCommand -SessionId $ssh.SessionId -Command "curl -I -s -L https://ibiki.run.place/assets/index-DE2PWPiA.css | head -n 1"
$probeAdmin = Invoke-SSHCommand -SessionId $ssh.SessionId -Command "curl -I -s -L https://ibiki.run.place/admin | head -n 1"
Write-Output ("curl CSS: " + $probeCss.Output.Trim())
Write-Output ("curl /admin: " + $probeAdmin.Output.Trim())

Remove-SSHSession -SessionId $ssh.SessionId

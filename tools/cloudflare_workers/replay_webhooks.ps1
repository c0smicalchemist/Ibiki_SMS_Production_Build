<#
PowerShell helper to replay TextBelt webhooks for recent message_logs.
Usage (run locally where you have SSH access):
  .\replay_webhooks.ps1 -Host root@151.243.109.66 -WorkerDomain https://sms-proxy-1.c0smicalch3mist.workers.dev -Days 7

What it does:
- Fetches the TextBelt API key from Postgres system_config
- Fetches recent TextBelt-sent messages from `message_logs` (last N days)
- For each message, crafts a TextBelt-style webhook payload and computes HMAC SHA256 signature
- POSTs the payload to the worker domain (so it goes through your proxy)
- Optionally queries the DB after replay to show recent `incoming_messages` entries
#>
param(
  [Parameter(Mandatory=$true)] [string]$Host,
  [Parameter(Mandatory=$true)] [string]$WorkerDomain,
  [int]$Days = 7,
  [int]$Limit = 20
)

function Run-Remote {
  param($cmd)
  $sshCmd = "ssh $Host '$cmd'"
  Write-Host "Running remote: $cmd"
  $out = & bash -lc $sshCmd 2>&1
  return $out
}

# 1) Get TextBelt API key
$keyQuery = "sudo -u postgres psql -d ibiki -t -c \"SELECT value FROM system_config WHERE key='textbelt_api_key';\""
$keyRaw = Run-Remote $keyQuery
$textbeltKey = ($keyRaw -join "\n").Trim()
if (-not $textbeltKey) { Write-Error "Could not fetch textbelt_api_key from remote. Output:`n$keyRaw"; exit 1 }
Write-Host "Fetched TextBelt key (masked): $($textbeltKey.Substring(0,[math]::Min(8,$textbeltKey.Length)))..."

# 2) Fetch recent message_logs to replay
$msgQuery = "sudo -u postgres psql -d ibiki -t -A -F '|' -c \"SELECT id, vendor_message_id, to_number, body, created_at FROM message_logs WHERE vendor='textbelt' AND created_at > NOW() - interval '${Days} days' ORDER BY created_at DESC LIMIT ${Limit};\""
$msgsRaw = Run-Remote $msgQuery
if (-not $msgsRaw) { Write-Host "No messages found to replay."; exit 0 }
$msgLines = ($msgsRaw -split "\n") | Where-Object { $_ -match '\|' }

Write-Host "Found $($msgLines.Count) messages to replay"

foreach ($line in $msgLines) {
  $parts = $line -split '\|'
  $id = $parts[0]; $vid = $parts[1]; $to = $parts[2]; $body = $parts[3]
  $payloadObj = @{ textId = $vid; fromNumber = $to; text = $body }
  $payloadJson = ($payloadObj | ConvertTo-Json -Compress)
  $ts = [int](Get-Date -UFormat %s)
  # Compute HMAC SHA256 signature (hex)
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($textbeltKey)
  $hmac.Key = $keyBytes
  $dataBytes = [System.Text.Encoding]::UTF8.GetBytes(($ts.ToString() + $payloadJson))
  $sig = ($hmac.ComputeHash($dataBytes) | ForEach-Object { $_.ToString('x2') }) -join ''

  Write-Host "Replaying message id=$id vid=$vid -> $WorkerDomain (ts=$ts)"
  $resp = & curl.exe -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST $WorkerDomain -H "Content-Type: application/json" -H "x-textbelt-timestamp: $ts" -H "x-textbelt-signature: $sig" --data-binary @<(echo $payloadJson)
  Write-Host $resp
  Start-Sleep -Milliseconds 300
}

# 3) Show recent incoming_messages
$checkQuery = "sudo -u postgres psql -d ibiki -c \"SELECT id, from_number, to_number, body, created_at FROM incoming_messages ORDER BY created_at DESC LIMIT 10;\""
$checkOut = Run-Remote $checkQuery
Write-Host "Recent incoming_messages:`n$checkOut"

Write-Host 'Replay complete.'

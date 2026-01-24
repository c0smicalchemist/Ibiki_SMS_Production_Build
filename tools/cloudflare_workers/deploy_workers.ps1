param(
  [string]$Token = 'gjyOPHwyqwOcu1T917IFpd0Jiao3S8we79M9tZE7',
  [string]$Master = 'https://ibiki.run.place'
)

$scriptPath = 'C:\Users\c0smi\Downloads\Coding Projects\Ibiki_SMS_Development_Build\tools\cloudflare_workers\sms-proxy-worker.js'
$tmp = Join-Path $env:TEMP 'worker-deploy.js'

if (-not (Test-Path $scriptPath)) {
  Write-Error "Worker script not found at $scriptPath"
  exit 1
}

(Get-Content $scriptPath -Raw) -replace 'https://REPLACE_WITH_YOUR_IBIKI_PUBLIC_URL',$Master | Set-Content $tmp -Encoding utf8

$account = '21a87fb49def68f1fd0639138b817536'
$names = @('sms-proxy-1','sms-proxy-2','sms-proxy-3','sms-proxy-4')

foreach ($name in $names) {
  Write-Host "Deploying $name..."
  try {
    Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$account/workers/scripts/$name" -Method Put -InFile $tmp -Headers @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/javascript' } -ErrorAction Stop
    Write-Host "Deployed $name"
  } catch {
    $err = $_.Exception
    if ($err -and $err.Response) {
      try { $status = $err.Response.StatusCode } catch { $status = 'unknown' }
      Write-Host ([string]::Format('Failed {0}: {1}', $name, $status))
    } else {
      Write-Host ([string]::Format('Failed {0}: {1}', $name, $err.Message))
    }
  }
  Start-Sleep -Seconds 1
}

Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host 'Done'

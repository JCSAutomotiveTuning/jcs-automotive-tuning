$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

# The portal's .env.local can point at TEST: never silently use it for a production scanner.
$env:JCS_SCAN_SUPABASE_URL = "https://tpvsebxdrluadefhboez.supabase.co"
if (-not $env:JCS_SCAN_SUPABASE_ANON_KEY) {
  $env:JCS_SCAN_SUPABASE_ANON_KEY = Read-Host "Production Supabase PUBLIC publishable/anon key"
}
if (-not $env:JCS_SCAN_SUPABASE_ANON_KEY) { throw "Production public key required." }

$config = Join-Path $env:LOCALAPPDATA "JCS-ClamAV\clamd.conf"
$clamd = Join-Path $env:ProgramFiles "ClamAV\clamd.exe"
if (-not (Test-Path $config)) { throw "ClamAV daemon configuration missing: $config" }
if (-not (Test-Path $clamd)) { throw "ClamAV daemon executable missing: $clamd" }

function Test-JCSClamd {
  $tcp = New-Object System.Net.Sockets.TcpClient
  try {
    $result = $tcp.BeginConnect("127.0.0.1", 3310, $null, $null)
    if (-not $result.AsyncWaitHandle.WaitOne(1000)) { return $false }
    $tcp.EndConnect($result)
    return $true
  } catch { return $false }
  finally { $tcp.Dispose() }
}

if (-not (Test-JCSClamd)) {
  Write-Host "Starting local ClamAV daemon..."
  Start-Process -FilePath $clamd -ArgumentList @("--config-file=`"$config`"") -WindowStyle Minimized
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 2
    if (Test-JCSClamd) { $ready = $true; break }
  }
  if (-not $ready) { throw "ClamAV daemon failed to start. The scanner will not run." }
}
Write-Host "Local ClamAV daemon available on 127.0.0.1:3310."

if (-not $env:JCS_SCAN_EMAIL) { $env:JCS_SCAN_EMAIL = Read-Host "Production admin email" }
$secured = Read-Host "Production admin password (hidden)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secured)
try {
  $env:JCS_SCAN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  node .\scripts\scan-worker.mjs
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Item Env:JCS_SCAN_PASSWORD -ErrorAction SilentlyContinue
}

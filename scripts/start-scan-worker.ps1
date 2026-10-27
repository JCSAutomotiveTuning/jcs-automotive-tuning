$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
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

param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

Write-Host "Checking healthz"
$health = curl.exe -s "$BaseUrl/healthz" | ConvertFrom-Json
if ($health.ok -ne $true) {
  throw "healthz did not return ok=true"
}

Write-Host "Checking bootstrap"
$bootstrap = curl.exe -s "$BaseUrl/content/bootstrap" | ConvertFrom-Json
if (-not $bootstrap.groups -or $bootstrap.groups.Count -lt 1) {
  throw "bootstrap did not return groups"
}

$soundCount = 0
foreach ($group in $bootstrap.groups) {
  $soundCount += $group.sounds.Count
}

Write-Host "groups=$($bootstrap.groups.Count) sounds=$soundCount"

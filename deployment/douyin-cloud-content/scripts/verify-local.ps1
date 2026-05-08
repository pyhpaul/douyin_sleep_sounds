param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

function Get-JsonOrExit {
  param(
    [string]$Url,
    [string]$Name
  )

  $body = curl.exe -fsS $Url
  if ($LASTEXITCODE -ne 0) {
    Write-Error "$Name request failed: $Url"
    exit 1
  }

  try {
    return $body | ConvertFrom-Json
  } catch {
    Write-Error "$Name did not return valid JSON: $($_.Exception.Message)"
    exit 1
  }
}

Write-Host "Checking healthz"
$health = Get-JsonOrExit -Url "$BaseUrl/healthz" -Name "healthz"
if ($health.ok -ne $true) {
  Write-Error "healthz did not return ok=true"
  exit 1
}

Write-Host "Checking bootstrap"
$bootstrap = Get-JsonOrExit -Url "$BaseUrl/content/bootstrap" -Name "bootstrap"
if (-not $bootstrap.groups -or $bootstrap.groups.Count -lt 1) {
  Write-Error "bootstrap did not return groups"
  exit 1
}

$soundCount = 0
foreach ($group in $bootstrap.groups) {
  $soundCount += $group.sounds.Count
}

Write-Host "groups=$($bootstrap.groups.Count) sounds=$soundCount"

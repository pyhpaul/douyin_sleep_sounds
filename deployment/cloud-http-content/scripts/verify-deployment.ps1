param(
  [Parameter(Mandatory = $true)][string]$ApiBaseUrl,
  [Parameter(Mandatory = $true)][string]$StaticBaseUrl
)

Write-Host "Checking bootstrap..."
curl.exe -s "$ApiBaseUrl/content/bootstrap"

Write-Host "`nChecking cover..."
curl.exe -I "$StaticBaseUrl/covers/rain_night.jpg"

Write-Host "`nChecking audio..."
curl.exe -I "$StaticBaseUrl/audio/rain_night.mp3"

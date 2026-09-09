$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $repo 'landing\data\portal.json'
$seedPath = Join-Path $repo 'landing\seed-data.js'

$data = Invoke-RestMethod -Uri 'http://127.0.0.1:5050/api/dashboard' -TimeoutSec 180
$json = $data | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText($dataPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
$header = @'
// GENERADO AUTOMATICAMENTE - no editar a mano.
// Origen: GET http://127.0.0.1:5050/api/dashboard (SSAS/MDX)
// Regenerar: powershell -ExecutionPolicy Bypass -File scripts/actualizar-respaldo.ps1
// Sirve de respaldo para que el portal abra sin servidor ni backend.
window.__MINIRED_SEED__ = 
'@
[IO.File]::WriteAllText($seedPath, $header + $json + ';' + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Write-Host "Respaldo actualizado desde SSAS: $dataPath"

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'leer-env.ps1')
$repo = Split-Path -Parent $PSScriptRoot
$values = Import-MiniRedEnv -Path (Join-Path $repo '.env')
$dataPath = Join-Path $repo 'landing\data\portal.json'
$seedPath = Join-Path $repo 'landing\seed-data.js'
$apiBase = "http://$($values.API_HOST):$($values.API_PORT)/api"

$data = Invoke-RestMethod -Uri "$apiBase/dashboard" -TimeoutSec 180
$json = $data | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText($dataPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
$header = @'
// GENERADO AUTOMATICAMENTE - no editar a mano.
// Origen: backend local configurado en .env (SSAS/MDX)
// Regenerar: powershell -ExecutionPolicy Bypass -File scripts/actualizar-respaldo.ps1
// Sirve de respaldo para que el portal abra sin servidor ni backend.
window.__MINIRED_SEED__ = 
'@
[IO.File]::WriteAllText($seedPath, $header + $json + ';' + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Write-Host "Respaldo actualizado desde SSAS: $dataPath"

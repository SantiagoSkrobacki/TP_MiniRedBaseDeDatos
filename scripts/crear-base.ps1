param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Recrear', 'Migrar')]
    [string]$Modo
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'leer-env.ps1')

$repo = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'aplicar-configuracion.ps1')
$values = Import-MiniRedEnv -Path (Join-Path $repo '.env')
$sqlcmd = Get-Command sqlcmd -ErrorAction Stop

$scripts = if ($Modo -eq 'Recrear') {
    @(
        'sql\01_MiniRed_DW_crear_y_poblar.sql',
        'sql\02_MiniRed_consultas_analiticas.sql',
        'sql\03_portal_api.sql',
        'sql\04_preparar_cubo_existente.sql'
    )
} else {
    @('sql\04_preparar_cubo_existente.sql')
}

if ($Modo -eq 'Recrear') {
    Write-Warning 'Se eliminara y recreara por completo la base MiniRed_DW.'
}

foreach ($relativePath in $scripts) {
    $scriptPath = Join-Path $repo $relativePath
    Write-Host "Ejecutando $relativePath en $($values.SQL_SERVER)..."
    & $sqlcmd.Source -S $values.SQL_SERVER -E -C -b -f 65001 -i $scriptPath
    if ($LASTEXITCODE -ne 0) { throw "Fallo $relativePath con codigo $LASTEXITCODE." }
}

Write-Host "Base MiniRed_DW preparada en $($values.SQL_SERVER)."

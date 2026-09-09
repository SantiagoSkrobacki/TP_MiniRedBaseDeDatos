$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'aplicar-configuracion.ps1')

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $vswhere)) {
    throw 'No se encontro vswhere. Instale Visual Studio y Microsoft Analysis Services Projects.'
}

$installationPath = & $vswhere -latest -products '*' -property installationPath
if (-not $installationPath) { throw 'No se encontro una instalacion de Visual Studio.' }
$devenv = Join-Path $installationPath 'Common7\IDE\devenv.com'
if (-not (Test-Path -LiteralPath $devenv)) { throw "No se encontro devenv.com en $installationPath" }

$solution = Join-Path $repo 'Cubo_MiniRed_Logistica\Cubo_MiniRed_Logistica.sln'
& $devenv $solution /Deploy Development
if ($LASTEXITCODE -ne 0) {
    throw 'Fallo el despliegue. Verifique que Analysis Services sea multidimensional y que la extension esté instalada.'
}

Write-Host 'Cubo compilado, desplegado y procesado correctamente.'

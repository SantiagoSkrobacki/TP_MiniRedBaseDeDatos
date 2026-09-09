$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'leer-env.ps1')

$repo = Split-Path -Parent $PSScriptRoot
$values = Import-MiniRedEnv -Path (Join-Path $repo '.env')
$required = @('SQL_SERVER', 'SSAS_SERVER', 'SSAS_SERVICE_ACCOUNT', 'API_HOST', 'API_PORT')
foreach ($name in $required) {
    if (-not $values.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($values[$name])) {
        throw "Falta $name en .env."
    }
}

$parsedPort = 0
if (-not [int]::TryParse($values.API_PORT, [ref]$parsedPort) -or $parsedPort -lt 1 -or $parsedPort -gt 65535) {
    throw 'API_PORT debe ser un puerto entre 1 y 65535.'
}

$utf8 = [Text.UTF8Encoding]::new($false)
function Set-RequiredMatch {
    param([string]$Path, [string]$Pattern, [string]$Replacement)
    $content = [IO.File]::ReadAllText($Path)
    $regex = [regex]::new($Pattern, [Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $regex.IsMatch($content)) { throw "No se encontro la configuracion esperada en $Path" }
    $updated = $regex.Replace($content, { param($match) $Replacement }, 1)
    [IO.File]::WriteAllText($Path, $updated, $utf8)
}

$sqlDatabase = 'MiniRed_DW'
$ssasDatabase = 'Cubo_MiniRed_Logistica'
$cube = 'MiniRed Logistica'
$connection = "Provider=MSOLEDBSQL.1;Data Source=$($values.SQL_SERVER);Integrated Security=SSPI;Initial Catalog=$sqlDatabase;Trust Server Certificate=True"
$projectDir = Join-Path $repo 'Cubo_MiniRed_Logistica\Cubo_MiniRed_Logistica'

$dataSourcePath = Join-Path $projectDir 'Mini Red DW.ds'
Set-RequiredMatch $dataSourcePath '<ConnectionString>[^<]*</ConnectionString>' "<ConnectionString>$connection</ConnectionString>"

$projectPath = Join-Path $projectDir 'Cubo_MiniRed_Logistica.dwproj'
Set-RequiredMatch $projectPath '<Value xsi:type="xsd:string">Provider=MSOLEDBSQL\.1;.*?</Value>' "<Value xsi:type=`"xsd:string`">$connection</Value>"

$serviceAccountSql = $values.SSAS_SERVICE_ACCOUNT.Replace("'", "''")
$migrationPath = Join-Path $repo 'sql\04_preparar_cubo_existente.sql'
Set-RequiredMatch $migrationPath "DECLARE @CuentaServicioSsas SYSNAME = N'(?:''|[^'])*';" "DECLARE @CuentaServicioSsas SYSNAME = N'$serviceAccountSql';"

$userProjectPath = Join-Path $projectDir 'Cubo_MiniRed_Logistica.dwproj.user'
$userProject = @"
<AnalysisServicesUserConfiguration xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Configurations>
    <Configuration>
      <Name>Development</Name>
      <Options>
        <TargetServer>$($values.SSAS_SERVER)</TargetServer>
        <TargetDatabase>$ssasDatabase</TargetDatabase>
        <StartObject><ObjectId></ObjectId><ObjectType>Current</ObjectType></StartObject>
      </Options>
    </Configuration>
  </Configurations>
</AnalysisServicesUserConfiguration>
"@
[IO.File]::WriteAllText($userProjectPath, $userProject, $utf8)

$appSettingsPath = Join-Path $repo 'backend\appsettings.json'
$ssasServerJson = ConvertTo-Json $values.SSAS_SERVER -Compress
$ssasDatabaseJson = ConvertTo-Json $ssasDatabase -Compress
$cubeJson = ConvertTo-Json $cube -Compress
$urlsJson = ConvertTo-Json "http://$($values.API_HOST):$parsedPort" -Compress
$appSettings = @"
{
  "AnalysisServices": {
    "Server": $ssasServerJson,
    "Database": $ssasDatabaseJson,
    "Cube": $cubeJson
  },
  "Urls": $urlsJson
}
"@
[IO.File]::WriteAllText($appSettingsPath, $appSettings + [Environment]::NewLine, $utf8)

$apiBase = "http://$($values.API_HOST):$parsedPort/api"
$apiBaseJson = ConvertTo-Json $apiBase -Compress
$landingConfig = "// Generado por scripts/aplicar-configuracion.ps1.`nwindow.MINIRED_CONFIG = {`n  apiBase: $apiBaseJson`n};`n"
[IO.File]::WriteAllText((Join-Path $repo 'landing\config.js'), $landingConfig, $utf8)

Write-Host 'Configuracion aplicada:'
Write-Host "  SQL Server:       $($values.SQL_SERVER)"
Write-Host "  Analysis Services: $($values.SSAS_SERVER)"
Write-Host "  Cuenta SSAS:       $($values.SSAS_SERVICE_ACCOUNT)"
Write-Host "  API:               $apiBase"

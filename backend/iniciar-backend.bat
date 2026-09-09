@echo off
setlocal
cd /d "%~dp0"
echo MiniRed API: consulte /api/health en la URL configurada por .env.
echo Deje esta ventana abierta durante la demostracion.
dotnet restore MiniRed.Api.csproj
if errorlevel 1 goto :fin
dotnet run --project MiniRed.Api.csproj --no-restore
:fin
pause

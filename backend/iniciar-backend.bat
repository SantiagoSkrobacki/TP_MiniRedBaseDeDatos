@echo off
setlocal
cd /d "%~dp0"
echo MiniRed API: http://127.0.0.1:5050/api/health
echo Deje esta ventana abierta durante la demostracion.
dotnet restore MiniRed.Api.csproj
if errorlevel 1 goto :fin
dotnet run --project MiniRed.Api.csproj --no-restore
:fin
pause

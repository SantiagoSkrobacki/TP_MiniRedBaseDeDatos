# Backend local de MiniRed

API mínima ASP.NET Core 8 que consulta el cubo multidimensional mediante
ADOMD.NET. No consulta directamente `MiniRed_DW`.

## Configuración

Los valores editables están en `appsettings.json`:

- servidor SSAS: `localhost\SSAS`;
- base: `Cubo_MiniRed_Logistica`;
- cubo: `MiniRed Logistica`;
- escucha: `http://127.0.0.1:5050`.

Usa la identidad de Windows de quien inicia el proceso. Para la demostración
alcanza con ejecutar `iniciar-backend.bat` y dejar esa ventana abierta.

## Endpoints

- `GET http://127.0.0.1:5050/api/health`: abre una conexión, verifica que el
  cubo esté disponible y procesado, y devuelve las medidas de control.
- `GET http://127.0.0.1:5050/api/dashboard`: ejecuta MDX, arma el contrato de la
  landing y lo conserva en memoria hasta que se reinicie el proceso.

Si SSAS no responde, ambos endpoints devuelven HTTP 503 con un error breve. La
API permite CORS y sólo escucha en loopback.

## Ejecución manual

```powershell
dotnet restore backend/MiniRed.Api.csproj
dotnet run --project backend/MiniRed.Api.csproj
```

Para actualizar los dos respaldos estáticos desde la API:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/actualizar-respaldo.ps1
```

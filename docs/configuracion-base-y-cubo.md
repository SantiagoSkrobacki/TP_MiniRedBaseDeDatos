# Configuración práctica de MiniRed_DW y el cubo SSAS

Esta guía explica cómo preparar el proyecto en una computadora nueva usando los
scripts PowerShell del repositorio.

El resultado esperado es:

```text
SQL Server
└── MiniRed_DW

Analysis Services
└── Cubo_MiniRed_Logistica
    └── MiniRed Logistica
```

La landing con `portal.json` no necesita esta configuración. Estos pasos sólo
son necesarios para crear la base, desplegar el cubo o demostrar la conexión en
vivo con SSAS.

## 1. Requisitos de la computadora

Antes de comenzar, verificar que estén instalados:

- SQL Server Database Engine.
- SQL Server Analysis Services en modo **Multidimensional**.
- Visual Studio.
- Extensión **Microsoft Analysis Services Projects** para Visual Studio.
- Microsoft OLE DB Driver for SQL Server (`MSOLEDBSQL`).
- Herramienta `sqlcmd`.
- PowerShell 5.1 o superior.
- .NET 8 SDK únicamente si también se utilizará el backend.

Tener SQL Server instalado no garantiza que Analysis Services también esté
instalado. Son componentes separados.

## 2. Copiar el proyecto

Clonar el repositorio:

```powershell
git clone <URL_DEL_REPOSITORIO>
cd TP_MiniRedBaseDeDatos
```

También se puede copiar la carpeta completa desde un pendrive o un archivo ZIP.
Todos los comandos de esta guía deben ejecutarse desde la raíz del repositorio.

## 3. Identificar las instancias instaladas

Abrir PowerShell y ejecutar:

```powershell
Get-Service *SQL* | Select-Object Name, Status
Get-Service *OLAP* | Select-Object Name, Status
```

Una instalación típica de este proyecto muestra:

```text
MSSQL$SQLEXPRESS   → motor relacional
MSOLAP$SSAS        → Analysis Services
```

En ese caso las direcciones son:

```text
SQL Server:        localhost\SQLEXPRESS
Analysis Services: localhost\SSAS
```

Si el servicio es una instancia predeterminada, la dirección puede ser
simplemente `localhost`.

### Obtener la cuenta del servicio SSAS

Ejecutar:

```powershell
Get-CimInstance Win32_Service |
  Where-Object Name -Like "MSOLAP*" |
  Select-Object Name, StartName
```

Ejemplos de cuentas posibles:

```text
NT Service\MSOLAP$SSAS
NT Service\MSSQLServerOLAPService
DOMINIO\usuario-servicio
```

Guardar el valor de `StartName`, porque SSAS necesita permiso de lectura sobre
`MiniRed_DW`.

## 4. Crear y editar `.env`

Crear la configuración local a partir de la plantilla:

```powershell
Copy-Item .env.example .env
notepad .env
```

Configuración utilizada originalmente:

```env
SQL_SERVER=localhost\SQLEXPRESS
SSAS_SERVER=localhost\SSAS
SSAS_SERVICE_ACCOUNT=NT Service\MSOLAP$SSAS
API_HOST=127.0.0.1
API_PORT=5050
```

Modificar:

- `SQL_SERVER`: instancia del motor relacional.
- `SSAS_SERVER`: instancia de Analysis Services.
- `SSAS_SERVICE_ACCOUNT`: valor `StartName` encontrado en el paso anterior.
- `API_HOST` y `API_PORT`: dirección del backend opcional. Normalmente no se
  modifican.

Los siguientes nombres son identificadores internos del proyecto y se mantienen
fijos:

```text
Base relacional: MiniRed_DW
Base SSAS:       Cubo_MiniRed_Logistica
Cubo:            MiniRed Logistica
```

El archivo `.env` no se versiona en Git. Cada computadora debe tener su propia
copia.

## 5. Aplicar la configuración

Ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\aplicar-configuracion.ps1
```

La salida esperada es similar a:

```text
Configuracion aplicada:
  SQL Server:        localhost\SQLEXPRESS
  Analysis Services: localhost\SSAS
  Cuenta SSAS:       NT Service\MSOLAP$SSAS
  API:               http://127.0.0.1:5050/api
```

Este paso no crea bases ni procesa datos. Solamente sincroniza la configuración
del proyecto con los valores del `.env`.

Los scripts de creación y despliegue también ejecutan automáticamente este paso,
por lo que no es obligatorio repetirlo antes de cada uno.

## 6. Crear la base desde cero

Para una computadora nueva, ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\crear-base.ps1 -Modo Recrear
```

> **Atención:** `-Modo Recrear` elimina cualquier base llamada `MiniRed_DW` y la
> vuelve a crear desde cero.

El script ejecuta, en orden:

1. `01_MiniRed_DW_crear_y_poblar.sql`.
2. `02_MiniRed_consultas_analiticas.sql`.
3. `03_portal_api.sql`.
4. `04_preparar_cubo_existente.sql`.

El proceso crea y carga:

- 731 días, desde 2024-01-01 hasta 2025-12-31.
- 6 sucursales y un depósito.
- 30 productos.
- `Fact_Ventas` y `Fact_Stock`.
- Columnas físicas necesarias para el cubo.
- Vistas y procedimientos analíticos.
- Permiso de lectura para la cuenta del servicio SSAS.

### Preparar una base existente

Si `MiniRed_DW` ya existe y sólo se necesita aplicar la migración idempotente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\crear-base.ps1 -Modo Migrar
```

Este modo no recrea los datos. Ejecuta únicamente
`04_preparar_cubo_existente.sql`.

## 7. Verificar la base relacional

Conectarse desde SQL Server Management Studio a la instancia indicada en
`SQL_SERVER` y verificar que exista:

```text
Databases
└── MiniRed_DW
    ├── Tables
    │   ├── dbo.Fact_Stock
    │   ├── dbo.Fact_Ventas
    │   ├── dbo.Dim_Tiempo
    │   ├── dbo.Dim_Sucursal
    │   └── dbo.Dim_Producto
    └── Views
        └── dbo.vw_Cubo_Logistica
```

Consulta de control:

```sql
USE MiniRed_DW;

SELECT
    Ventas = (SELECT COUNT_BIG(*) FROM dbo.Fact_Ventas),
    Stock  = (SELECT COUNT_BIG(*) FROM dbo.Fact_Stock);
```

Resultados esperados:

```text
Fact_Ventas: 315969 filas
Fact_Stock:  153510 filas
```

Verificación del drill-across:

```sql
SELECT VendidoVentas = SUM(Cantidad)
FROM dbo.Fact_Ventas;

SELECT VendidoStock = SUM(s.CantidadVendida)
FROM dbo.Fact_Stock s
JOIN dbo.Dim_Sucursal u ON u.IdSucursal = s.IdSucursal
WHERE u.TipoUbicacion = 'Sucursal';
```

Ambos resultados deben ser `1372990`.

## 8. Desplegar y procesar el cubo

Ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\desplegar-cubo.ps1
```

El script:

1. Aplica el `.env`.
2. Busca la instalación de Visual Studio mediante `vswhere`.
3. Compila la solución de Analysis Services.
4. Despliega `Cubo_MiniRed_Logistica` en `SSAS_SERVER`.
5. Ejecuta el procesamiento configurado por el proyecto.

La salida debe terminar indicando que la compilación y la implementación fueron
correctas.

### Alternativa desde Visual Studio

Si el script no encuentra Visual Studio:

1. Abrir `Cubo_MiniRed_Logistica\Cubo_MiniRed_Logistica.sln`.
2. Confirmar que el proyecto abre con Microsoft Analysis Services Projects.
3. Abrir las propiedades del proyecto.
4. En `Deployment`, comprobar:

   ```text
   Server:   valor de SSAS_SERVER
   Database: Cubo_MiniRed_Logistica
   ```

5. Seleccionar **Build → Build Solution**.
6. Seleccionar **Build → Deploy Cubo_MiniRed_Logistica**.

## 9. Verificar el cubo

Desde SQL Server Management Studio, conectarse usando el tipo de servidor
**Analysis Services** y la dirección configurada en `SSAS_SERVER`.

Debe aparecer:

```text
Databases
└── Cubo_MiniRed_Logistica
    └── Cubes
        └── MiniRed Logistica
```

También se puede abrir la pestaña `Browser` del cubo en Visual Studio.

Medidas de control esperadas, filtrando `Tipo Ubicacion = Sucursal`:

| Medida | Resultado |
|---|---:|
| Stock Disponible | 8.161 |
| Cantidad Vendida Stock | 1.372.990 |
| Cantidad Vendida Ventas | 1.372.990 |
| Tickets | 220.465 |
| Observaciones | 131.580 |

`Stock Disponible` debe mostrar el último snapshot mediante `LastNonEmpty`; no
debe devolver la suma histórica incorrecta `6.159.125`.

## 10. Backend opcional

El backend no es necesario para presentar la landing con JSON. Sólo se utiliza
si se quiere demostrar una consulta en vivo a SSAS.

Iniciarlo con:

```text
backend\iniciar-backend.bat
```

Después abrir:

```text
http://127.0.0.1:5050/api/health
```

La respuesta debe tener `status: ok`. En la landing, pulsar **Conectar a SSAS**
para cambiar temporalmente de `archivo local` a `datos en vivo`.

## 11. Problemas frecuentes

### No se encuentra SQL Server

Revisar `SQL_SERVER` y comprobar que el servicio esté iniciado:

```powershell
Get-Service *SQL*
```

### No se encuentra Analysis Services

SQL Server Database Engine y Analysis Services son productos separados. Revisar:

```powershell
Get-Service *OLAP*
```

### Visual Studio no reconoce el proyecto

Instalar la extensión **Microsoft Analysis Services Projects**. Tener solamente
Visual Studio o las herramientas de SQL Server no es suficiente.

### SSAS no puede leer MiniRed_DW

Comprobar que `SSAS_SERVICE_ACCOUNT` coincida exactamente con `StartName` y
volver a ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\crear-base.ps1 -Modo Migrar
```

### Error de certificado de SQL Server

Los scripts utilizan `sqlcmd -C`, que confía en el certificado local de la
instancia de desarrollo.

### La landing no conecta con SSAS

La landing seguirá funcionando con `portal.json`. Para el modo en vivo:

1. Comprobar `/api/health`.
2. Confirmar que el backend siga abierto.
3. Aceptar el permiso de red local del navegador.
4. Pulsar nuevamente **Conectar a SSAS**.

## 12. Resumen de los scripts PowerShell

### `scripts/leer-env.ps1`

Función auxiliar que lee las variables de `.env`. No se ejecuta directamente;
es utilizada por los demás scripts.

### `scripts/aplicar-configuracion.ps1`

Aplica las variables de `.env` al datasource del cubo, al destino de despliegue,
a la cuenta del servicio SSAS, al backend y a la configuración opcional de la
landing. No crea bases ni procesa datos.

### `scripts/crear-base.ps1`

Ejecuta los scripts SQL sobre `SQL_SERVER`:

- `-Modo Recrear`: elimina y vuelve a crear `MiniRed_DW`.
- `-Modo Migrar`: aplica únicamente la migración idempotente.

### `scripts/desplegar-cubo.ps1`

Busca Visual Studio, compila el proyecto SSAS, lo despliega en `SSAS_SERVER` y
procesa el cubo.

### `scripts/actualizar-respaldo.ps1`

Consulta el backend configurado en `.env` y regenera simultáneamente:

- `landing/data/portal.json`.
- `landing/seed-data.js`.

Requiere SQL Server, SSAS y el backend activos. No es necesario ejecutarlo para
usar la landing estática porque ambos archivos ya están versionados.

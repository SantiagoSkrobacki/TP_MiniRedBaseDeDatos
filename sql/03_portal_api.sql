/* ==========================================================================
   MiniRed - API DE DATOS DEL PORTAL DE ABASTECIMIENTO
   --------------------------------------------------------------------------
   Este script es INDEPENDIENTE de 01 y 02: no los modifica ni los reemplaza.
   Solo agrega el procedimiento sp_PortalDashboard, que alimenta la landing
   page (carpeta landing/). El sp_LandingDataJson original de la seccion 4 de
   02_MiniRed_consultas_analiticas.sql sigue existiendo y funcionando igual.

   Requiere haber ejecutado antes 01 y 02 (usa la vista vw_Cubo_Logistica).
   ========================================================================== */

SET NOCOUNT ON;
USE MiniRed_DW;
GO

IF OBJECT_ID('sp_PortalDashboard') IS NOT NULL DROP PROCEDURE sp_PortalDashboard;
GO
CREATE PROCEDURE sp_PortalDashboard AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UltimaFecha DATE = (SELECT MAX(Fecha) FROM vw_Cubo_Logistica);

    DECLARE @json NVARCHAR(MAX) = (
    SELECT
        -- ---------- metadatos del período analizado ----------
        meta = JSON_QUERY((
            SELECT
                generado       = CONVERT(VARCHAR(19), SYSDATETIME(), 126),
                desde          = CONVERT(VARCHAR(10), MIN(Fecha), 23),
                hasta          = CONVERT(VARCHAR(10), MAX(Fecha), 23),
                ultimaFecha    = CONVERT(VARCHAR(10), @UltimaFecha, 23),
                dias           = COUNT(DISTINCT Fecha),
                sucursales     = COUNT(DISTINCT NombreSucursal),
                productos      = COUNT(DISTINCT NombreProducto),
                observaciones  = COUNT(*)
            FROM vw_Cubo_Logistica
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        )),

        -- ---------- serie mensual: mes x zona x categoria ----------
        serie = (
            SELECT
                anio          = Anio,
                mes           = MesNumero,
                mesNombre     = MIN(MesNombre),
                zona          = Zona,
                categoria     = Categoria,
                observaciones = COUNT(*),
                quiebres      = SUM(CAST(EsQuiebre AS INT)),
                unidades      = SUM(CantidadVendida),
                stock         = CAST(AVG(CAST(StockDisponible AS DECIMAL(12,4))) AS DECIMAL(10,2))
            FROM vw_Cubo_Logistica
            GROUP BY Anio, MesNumero, Zona, Categoria
            ORDER BY Anio, MesNumero, Zona, Categoria
            FOR JSON PATH
        ),

        -- ---------- sucursales: sucursal x categoria ----------
        sucursales = (
            SELECT
                sucursal      = NombreSucursal,
                zona          = MIN(Zona),
                categoria     = Categoria,
                observaciones = COUNT(*),
                quiebres      = SUM(CAST(EsQuiebre AS INT)),
                bajoMinimo    = SUM(CAST(EsBajoMinimo AS INT)),
                unidades      = SUM(CantidadVendida),
                stockProm     = CAST(AVG(CAST(StockDisponible AS DECIMAL(12,4))) AS DECIMAL(10,2)),
                ventaProm     = CAST(AVG(CAST(CantidadVendida AS DECIMAL(12,4))) AS DECIMAL(10,2)),
                valorInv      = CAST(SUM(CASE WHEN Fecha = @UltimaFecha
                                              THEN ValorInventario ELSE 0 END) AS DECIMAL(16,2)),
                reposPend     = SUM(CASE WHEN Fecha = @UltimaFecha AND EsBajoMinimo = 1
                                         THEN 1 ELSE 0 END),
                combinaciones = SUM(CASE WHEN Fecha = @UltimaFecha THEN 1 ELSE 0 END)
            FROM vw_Cubo_Logistica
            GROUP BY NombreSucursal, Categoria
            ORDER BY NombreSucursal, Categoria
            FOR JSON PATH
        ),

        -- ---------- productos: producto x zona ----------
        productos = (
            SELECT
                producto      = NombreProducto,
                categoria     = MIN(Categoria),
                rubro         = MIN(Rubro),
                proveedor     = MIN(Proveedor),
                diasRepos     = MIN(DiasReposicion),
                zona          = Zona,
                observaciones = COUNT(*),
                quiebres      = SUM(CAST(EsQuiebre AS INT)),
                unidades      = SUM(CantidadVendida),
                valorInv      = CAST(SUM(CASE WHEN Fecha = @UltimaFecha
                                              THEN ValorInventario ELSE 0 END) AS DECIMAL(16,2))
            FROM vw_Cubo_Logistica
            GROUP BY NombreProducto, Zona
            ORDER BY NombreProducto, Zona
            FOR JSON PATH
        ),

        -- ---------- dia de la semana: dia x zona x categoria ----------
        porDiaSemana = (
            SELECT
                dia           = DiaSemanaNombre,
                orden         = MIN(DATEDIFF(DAY, '1900-01-01', Fecha) % 7),
                zona          = Zona,
                categoria     = Categoria,
                observaciones = COUNT(*),
                quiebres      = SUM(CAST(EsQuiebre AS INT))
            FROM vw_Cubo_Logistica
            GROUP BY DiaSemanaNombre, Zona, Categoria
            ORDER BY MIN(DATEDIFF(DAY, '1900-01-01', Fecha) % 7)
            FOR JSON PATH
        ),

        -- ---------- proveedores: el contraejemplo de correlacion espuria ----------
        proveedores = (
            SELECT
                proveedor       = Proveedor,
                categoria       = MIN(Categoria),
                diasRepos       = MIN(DiasReposicion),
                tasaGlobal      = CAST(100.0 * SUM(CAST(EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2)),
                tasaSinOeste    = CAST(100.0 * SUM(CASE WHEN Zona <> N'Oeste'
                                                        THEN CAST(EsQuiebre AS INT) ELSE 0 END)
                                       / NULLIF(SUM(CASE WHEN Zona <> N'Oeste' THEN 1 ELSE 0 END), 0)
                                       AS DECIMAL(5,2))
            FROM vw_Cubo_Logistica
            GROUP BY Proveedor
            ORDER BY CAST(100.0 * SUM(CAST(EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2)) DESC
            FOR JSON PATH
        ),

        -- ---------- reglas inductivas validadas ----------
        reglas = (
            SELECT
                id          = R.id,
                regla       = R.regla,
                accion      = R.accion,
                casos       = COUNT(*),
                antecedente = SUM(R.ant),
                soporte     = CAST(100.0 * SUM(CASE WHEN R.ant = 1 AND R.con = 1 THEN 1 ELSE 0 END)
                                   / COUNT(*) AS DECIMAL(5,2)),
                confianza   = CAST(100.0 * SUM(CASE WHEN R.ant = 1 AND R.con = 1 THEN 1 ELSE 0 END)
                                   / NULLIF(SUM(R.ant), 0) AS DECIMAL(5,2)),
                base        = CAST(100.0 * SUM(R.con) / COUNT(*) AS DECIMAL(5,2)),
                lift        = CAST((1.0 * SUM(CASE WHEN R.ant = 1 AND R.con = 1 THEN 1 ELSE 0 END)
                                    / NULLIF(SUM(R.ant), 0))
                                 / NULLIF(1.0 * SUM(R.con) / COUNT(*), 0) AS DECIMAL(6,2)),
                conf2024    = CAST(100.0 * SUM(CASE WHEN R.anio = 2024 AND R.ant = 1 AND R.con = 1 THEN 1 ELSE 0 END)
                                   / NULLIF(SUM(CASE WHEN R.anio = 2024 THEN R.ant ELSE 0 END), 0) AS DECIMAL(5,2)),
                conf2025    = CAST(100.0 * SUM(CASE WHEN R.anio = 2025 AND R.ant = 1 AND R.con = 1 THEN 1 ELSE 0 END)
                                   / NULLIF(SUM(CASE WHEN R.anio = 2025 THEN R.ant ELSE 0 END), 0) AS DECIMAL(5,2))
            FROM (
                SELECT id = 'R1',
                       regla  = N'Bebidas en zona Oeste',
                       accion = N'Reforzar la reposición de bebidas en el Oeste antes del fin de semana',
                       anio = v.Anio,
                       ant = CASE WHEN v.Zona = N'Oeste' THEN 1 ELSE 0 END,
                       con = CAST(v.EsQuiebre AS INT)
                FROM vw_Cubo_Logistica v WHERE v.Categoria = N'Bebidas'
                UNION ALL
                SELECT 'R2', N'Proveedor Arcor, ciclo de 14 días',
                       N'Renegociar frecuencia de entrega con Arcor o subir el nivel objetivo',
                       v.Anio,
                       CASE WHEN v.Proveedor = N'Arcor' THEN 1 ELSE 0 END,
                       CAST(v.EsQuiebre AS INT)
                FROM vw_Cubo_Logistica v WHERE v.Categoria <> N'Bebidas'
                UNION ALL
                SELECT 'R3', N'Congelados en verano',
                       N'Nivel objetivo estacional para congelados entre diciembre y febrero',
                       v.Anio,
                       CASE WHEN v.Temporada = N'Verano' THEN 1 ELSE 0 END,
                       CAST(v.EsQuiebre AS INT)
                FROM vw_Cubo_Logistica v WHERE v.Categoria = N'Congelados'
                UNION ALL
                SELECT 'R4', N'Sobrestock en San Justo',
                       N'Recalibrar el nivel objetivo de San Justo a su demanda real',
                       v.Anio,
                       CASE WHEN v.NombreSucursal = N'San Justo' THEN 1 ELSE 0 END,
                       CAST(v.EsSobrestock AS INT)
                FROM vw_Cubo_Logistica v
            ) R
            GROUP BY R.id, R.regla, R.accion
            ORDER BY R.id
            FOR JSON PATH
        )
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    SELECT datos = @json;
END
GO

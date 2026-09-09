/* ==========================================================================
   MiniRed S.A. - CONSULTAS ANALITICAS SOBRE MiniRed_DW
   TP Unidad 3 - "Data Detective & Landing Page Challenge"
   PERSPECTIVA: Opcion B - Logistica e Inventario
   --------------------------------------------------------------------------
   Entregable 1 del TP. Cubre las tres misiones analiticas:
     MISION 1 - Data Audit ............ clasificacion de variables y calidad
     MISION 2 - Cube Master ........... consulta aplanada / cubo sin errores
                                        de agregacion (semi-aditividad)
     MISION 3 - Pattern Hunter ........ reglas de aprendizaje inductivo
                                        validadas con soporte, confianza,
                                        lift y hold-out temporal
     SECCION 4 - Export JSON para la Landing Page

   Requiere haber ejecutado antes 01_MiniRed_DW_crear_y_poblar.sql
   ========================================================================== */

SET NOCOUNT ON;
USE MiniRed_DW;
GO

/* ==========================================================================
   MISION 1 - DATA AUDIT
   --------------------------------------------------------------------------
   Punto teorico 2: tipos de variables (continuas vs. discretas).
   Punto teorico 3: fase de SELECCION y PREPROCESAMIENTO del proceso KDD.
   ========================================================================== */

PRINT '=== 1.1 DICCIONARIO: clasificacion de variables del dataset ===';

SELECT Atributo, Tabla, TipoVariable, Escala, Rol
FROM (VALUES
    -- CONTINUAS: admiten cualquier valor dentro de un rango, se promedian
    (N'ImporteTotal',     N'Fact_Ventas', N'Continua', N'Razon',    N'Medida aditiva'),
    (N'CostoTotal',       N'Fact_Ventas', N'Continua', N'Razon',    N'Medida aditiva'),
    (N'PrecioUnitario',   N'Fact_Ventas', N'Continua', N'Razon',    N'Medida NO aditiva'),
    (N'CostoUnitario',    N'Fact_Ventas', N'Continua', N'Razon',    N'Medida NO aditiva'),
    -- DISCRETAS NUMERICAS: conteos, sin valores intermedios
    (N'Cantidad',          N'Fact_Ventas', N'Discreta', N'Razon',   N'Medida aditiva'),
    (N'CantidadIngresada', N'Fact_Stock',  N'Discreta', N'Razon',   N'Medida aditiva'),
    (N'CantidadVendida',   N'Fact_Stock',  N'Discreta', N'Razon',   N'Medida aditiva'),
    (N'StockDisponible',   N'Fact_Stock',  N'Discreta', N'Razon',   N'Medida SEMI-ADITIVA'),
    (N'StockMinimo',       N'Fact_Stock',  N'Discreta', N'Razon',   N'Medida NO aditiva (umbral)'),
    -- DISCRETAS CATEGORICAS
    (N'EsQuiebre',        N'Fact_Stock',   N'Discreta', N'Binaria', N'Variable OBJETIVO'),
    (N'EsBajoMinimo',     N'Fact_Stock',   N'Discreta', N'Binaria', N'Variable objetivo alternativa'),
    (N'EsFinDeSemana',    N'Dim_Tiempo',   N'Discreta', N'Binaria', N'Atributo predictor'),
    (N'Temporada',        N'Dim_Tiempo',   N'Discreta', N'Nominal', N'Atributo predictor'),
    (N'Trimestre',        N'Dim_Tiempo',   N'Discreta', N'Ordinal', N'Atributo predictor'),
    (N'Zona',             N'Dim_Sucursal', N'Discreta', N'Nominal', N'Atributo predictor'),
    (N'NombreSucursal',   N'Dim_Sucursal', N'Discreta', N'Nominal', N'Atributo predictor'),
    (N'Categoria',        N'Dim_Producto', N'Discreta', N'Nominal', N'Atributo predictor'),
    (N'Rubro',            N'Dim_Producto', N'Discreta', N'Nominal', N'Atributo predictor'),
    (N'Proveedor',        N'Dim_Producto', N'Discreta', N'Nominal', N'Atributo predictor'),
    (N'DiasReposicion',   N'Dim_Producto', N'Discreta', N'Ordinal', N'Atributo predictor')
) AS D(Atributo, Tabla, TipoVariable, Escala, Rol);

PRINT '';
PRINT '=== 1.2 PERFILADO: rango y dispersion de las variables continuas ===';

SELECT
    Variable      = N'ImporteTotal (linea de ticket)',
    Minimo        = CAST(MIN(ImporteTotal) AS DECIMAL(12,2)),
    Maximo        = CAST(MAX(ImporteTotal) AS DECIMAL(12,2)),
    Promedio      = CAST(AVG(ImporteTotal) AS DECIMAL(12,2)),
    DesvioEstandar= CAST(STDEV(ImporteTotal) AS DECIMAL(12,2))
FROM Fact_Ventas
UNION ALL
SELECT N'StockDisponible (gondola)',
    MIN(StockDisponible), MAX(StockDisponible),
    CAST(AVG(CAST(StockDisponible AS DECIMAL(12,2))) AS DECIMAL(12,2)),
    CAST(STDEV(StockDisponible) AS DECIMAL(12,2))
FROM Fact_Stock f JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal';

PRINT '';
PRINT '=== 1.3 CALIDAD: controles de integridad (todo debe dar 0) ===';

SELECT Control = N'Ventas huerfanas sin dimension Tiempo',    Casos = COUNT(*)
FROM Fact_Ventas v LEFT JOIN Dim_Tiempo t ON t.IdTiempo = v.IdTiempo WHERE t.IdTiempo IS NULL
UNION ALL
SELECT N'Stock con valor negativo', COUNT(*) FROM Fact_Stock WHERE StockDisponible < 0
UNION ALL
SELECT N'Ventas con cantidad <= 0', COUNT(*) FROM Fact_Ventas WHERE Cantidad <= 0
UNION ALL
SELECT N'Lineas con importe menor al costo', COUNT(*) FROM Fact_Ventas WHERE ImporteTotal < CostoTotal
UNION ALL
SELECT N'Dias faltantes en Dim_Tiempo', 731 - COUNT(*) FROM Dim_Tiempo;

PRINT '';
PRINT '=== 1.4 CONSISTENCIA ENTRE HECHOS: el drill-across tiene que cerrar ===';
PRINT '    (dimensiones conformadas => las dos tablas deben dar lo mismo)';

SELECT
    UnidadesSegunFact_Ventas = (SELECT SUM(Cantidad) FROM Fact_Ventas),
    UnidadesSegunFact_Stock  = (SELECT SUM(f.CantidadVendida) FROM Fact_Stock f
                                JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
                                WHERE s.TipoUbicacion = N'Sucursal'),
    Diferencia               = (SELECT SUM(Cantidad) FROM Fact_Ventas)
                             - (SELECT SUM(f.CantidadVendida) FROM Fact_Stock f
                                JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
                                WHERE s.TipoUbicacion = N'Sucursal');
GO


/* ==========================================================================
   MISION 2 - CUBE MASTER
   --------------------------------------------------------------------------
   "Ejecucion de la consulta analitica aplanada/cubo SIN ERRORES DE AGREGACION"
   El error de agregacion a evitar es sumar StockDisponible sobre el tiempo.
   ========================================================================== */

PRINT '=== 2.1 EL ERROR DE AGREGACION: por que StockDisponible es SEMI-ADITIVA ===';

SELECT
    Lectura = N'A) SUM sobre los 731 dias  -> INCORRECTO',
    Unidades = FORMAT(SUM(CAST(f.StockDisponible AS BIGINT)), 'N0'),
    Interpretacion = N'Cuenta 731 veces la misma gondola. No significa nada.'
FROM Fact_Stock f JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal'
UNION ALL
SELECT N'B) Ultimo dia del periodo -> CORRECTO (LastNonEmpty)',
    FORMAT(SUM(CAST(f.StockDisponible AS BIGINT)), 'N0'),
    N'Stock real en gondola al cierre del periodo.'
FROM Fact_Stock f JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal' AND f.IdTiempo = (SELECT MAX(IdTiempo) FROM Dim_Tiempo)
UNION ALL
SELECT N'C) Promedio diario -> CORRECTO (capital inmovilizado)',
    FORMAT(CAST(AVG(CAST(f.StockDisponible AS DECIMAL(18,4))) * COUNT(DISTINCT f.IdSucursal)
              * COUNT(DISTINCT f.IdProducto) AS BIGINT), 'N0'),
    N'Base correcta para valuar inventario promedio.'
FROM Fact_Stock f JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal';

PRINT '';
PRINT '=== 2.2 CUBO: agregacion multidimensional con GROUPING SETS ===';
PRINT '    Equivale a las operaciones OLAP de roll-up y drill-down.';
PRINT '    Notar que StockDisponible se agrega con AVG, nunca con SUM.';

SELECT
    Zona        = ISNULL(s.Zona, N'>> TODAS'),
    Categoria   = ISNULL(p.Categoria, N'>> TODAS'),
    Nivel       = CASE WHEN GROUPING(s.Zona) = 1 AND GROUPING(p.Categoria) = 1 THEN N'Total general'
                       WHEN GROUPING(s.Zona) = 1 THEN N'Subtotal x Categoria'
                       WHEN GROUPING(p.Categoria) = 1 THEN N'Subtotal x Zona'
                       ELSE N'Detalle' END,
    UnidadesVendidas = SUM(f.CantidadVendida),                                 -- ADITIVA
    UnidadesIngresadas = SUM(f.CantidadIngresada),                             -- ADITIVA
    StockPromedio    = CAST(AVG(CAST(f.StockDisponible AS DECIMAL(12,4))) AS DECIMAL(10,2)), -- SEMI-ADITIVA
    TasaQuiebrePct   = CAST(100.0 * SUM(CAST(f.EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2))
FROM Fact_Stock f
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
JOIN Dim_Producto p ON p.IdProducto = f.IdProducto
WHERE s.TipoUbicacion = N'Sucursal'
GROUP BY GROUPING SETS ((s.Zona, p.Categoria), (s.Zona), (p.Categoria), ())
ORDER BY GROUPING(s.Zona), GROUPING(p.Categoria), s.Zona, p.Categoria;

PRINT '';
PRINT '=== 2.3 DATASET APLANADO (la vista que alimenta el analisis y la landing) ===';

IF OBJECT_ID('vw_Cubo_Logistica') IS NOT NULL DROP VIEW vw_Cubo_Logistica;
GO
CREATE VIEW vw_Cubo_Logistica AS
SELECT
    t.Fecha, t.Anio, t.Trimestre, t.MesNumero, t.MesNombre,
    t.DiaSemanaNombre, t.EsFinDeSemana, t.Temporada,
    s.NombreSucursal, s.Zona,
    p.NombreProducto, p.Categoria, p.Rubro, p.Proveedor, p.DiasReposicion,
    f.CantidadIngresada,
    f.CantidadVendida,
    f.StockDisponible,
    f.StockMinimo,
    f.EsQuiebre,
    f.EsBajoMinimo,
    f.EsSobrestock,
    ValorInventario = CAST(f.StockDisponible * p.CostoUnitario AS DECIMAL(14,2))
FROM Fact_Stock f
JOIN Dim_Tiempo   t ON t.IdTiempo   = f.IdTiempo
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
JOIN Dim_Producto p ON p.IdProducto = f.IdProducto
WHERE s.TipoUbicacion = N'Sucursal';
GO

SELECT TOP 10 * FROM vw_Cubo_Logistica ORDER BY Fecha, NombreSucursal, NombreProducto;
GO


/* ==========================================================================
   MISION 3 - PATTERN HUNTER
   --------------------------------------------------------------------------
   Punto teorico 6: APRENDIZAJE INDUCTIVO. De las instancias particulares
   (cada fila dia-sucursal-producto) se infieren reglas generales SI/ENTONCES.

   Punto teorico 5: se miden SOPORTE, CONFIANZA y LIFT, y se valida con un
   HOLD-OUT TEMPORAL (se induce sobre 2024, se verifica sobre 2025) para
   descartar sobreajuste. El LIFT distingue una regla real de una que solo
   refleja la frecuencia base del quiebre.
   ========================================================================== */

IF OBJECT_ID('tempdb..#Reglas') IS NOT NULL DROP TABLE #Reglas;

SELECT
    Regla,
    Anio,
    Antecedente,
    Consecuente
INTO #Reglas
FROM (
    -- R1: el efecto ZONA sobre las bebidas
    SELECT Regla = N'R1: SI Categoria=Bebidas Y Zona=Oeste -> QUIEBRE',
           v.Anio,
           Antecedente = CASE WHEN v.Zona = N'Oeste' THEN 1 ELSE 0 END,
           Consecuente = CAST(v.EsQuiebre AS INT)
    FROM vw_Cubo_Logistica v WHERE v.Categoria = N'Bebidas'

    UNION ALL
    -- R2: el efecto CICLO DE REPOSICION, controlando por categoria
    --     (se excluyen Bebidas justamente para no arrastrar el efecto de R1)
    SELECT N'R2: SI Proveedor=Arcor (ciclo 14d) -> QUIEBRE  [sin Bebidas]',
           v.Anio,
           CASE WHEN v.Proveedor = N'Arcor' THEN 1 ELSE 0 END,
           CAST(v.EsQuiebre AS INT)
    FROM vw_Cubo_Logistica v WHERE v.Categoria <> N'Bebidas'

    UNION ALL
    -- R3: el efecto ESTACIONAL sobre congelados
    SELECT N'R3: SI Categoria=Congelados Y Temporada=Verano -> QUIEBRE',
           v.Anio,
           CASE WHEN v.Temporada = N'Verano' THEN 1 ELSE 0 END,
           CAST(v.EsQuiebre AS INT)
    FROM vw_Cubo_Logistica v WHERE v.Categoria = N'Congelados'

    UNION ALL
    -- R4: el problema inverso - capital inmovilizado por sobrestock
    SELECT N'R4: SI Sucursal=San Justo -> SOBRESTOCK (stock > 2x minimo)',
           v.Anio,
           CASE WHEN v.NombreSucursal = N'San Justo' THEN 1 ELSE 0 END,
           CASE WHEN v.StockDisponible > v.StockMinimo * 2 THEN 1 ELSE 0 END
    FROM vw_Cubo_Logistica v
) R;

PRINT '=== 3.1 REGLAS INDUCIDAS - metricas sobre el periodo completo ===';

SELECT
    Regla,
    Casos            = COUNT(*),
    CasosAntecedente = SUM(Antecedente),
    -- Soporte: que porcion del universo cumple antecedente Y consecuente
    SoportePct   = CAST(100.0 * SUM(CASE WHEN Antecedente = 1 AND Consecuente = 1 THEN 1 ELSE 0 END)
                        / COUNT(*) AS DECIMAL(5,2)),
    -- Confianza: probabilidad del consecuente DADO el antecedente
    ConfianzaPct = CAST(100.0 * SUM(CASE WHEN Antecedente = 1 AND Consecuente = 1 THEN 1 ELSE 0 END)
                        / NULLIF(SUM(Antecedente), 0) AS DECIMAL(5,2)),
    -- Frecuencia base del consecuente (sin condicionar)
    BasePct      = CAST(100.0 * SUM(Consecuente) / COUNT(*) AS DECIMAL(5,2)),
    -- Lift > 1 => la regla aporta informacion; Lift ~ 1 => es ruido
    Lift         = CAST( (1.0 * SUM(CASE WHEN Antecedente = 1 AND Consecuente = 1 THEN 1 ELSE 0 END)
                          / NULLIF(SUM(Antecedente), 0))
                       / NULLIF(1.0 * SUM(Consecuente) / COUNT(*), 0) AS DECIMAL(6,2))
FROM #Reglas
GROUP BY Regla
ORDER BY Regla;

PRINT '';
PRINT '=== 3.2 VALIDACION HOLD-OUT: induccion en 2024 vs. verificacion en 2025 ===';
PRINT '    Si la confianza se mantiene entre ambos anios, la regla NO esta';
PRINT '    sobreajustada a los datos con los que se descubrio.';

WITH PorAnio AS (
    SELECT
        Regla, Anio,
        ConfianzaPct = CAST(100.0 * SUM(CASE WHEN Antecedente = 1 AND Consecuente = 1 THEN 1 ELSE 0 END)
                            / NULLIF(SUM(Antecedente), 0) AS DECIMAL(5,2))
    FROM #Reglas
    GROUP BY Regla, Anio
)
SELECT
    e.Regla,
    Confianza_2024_Entrenamiento = e.ConfianzaPct,
    Confianza_2025_Validacion    = v.ConfianzaPct,
    DesvioPuntos                 = CAST(ABS(e.ConfianzaPct - v.ConfianzaPct) AS DECIMAL(5,2)),
    Veredicto = CASE WHEN ABS(e.ConfianzaPct - v.ConfianzaPct) <= 5
                     THEN N'ESTABLE - regla valida'
                     ELSE N'INESTABLE - revisar sobreajuste' END
FROM PorAnio e
JOIN PorAnio v ON v.Regla = e.Regla AND v.Anio = 2025
WHERE e.Anio = 2024
ORDER BY e.Regla;

PRINT '';
PRINT '=== 3.3 CONTRAEJEMPLO: una CORRELACION ESPURIA que hay que descartar ===';
PRINT '    Sin controlar por categoria, los proveedores de bebidas parecen los';
PRINT '    peores. Pero el driver real es la ZONA, no el proveedor.';

SELECT
    p.Proveedor,
    p.DiasReposicion,
    CategoriaQueProvee = MIN(p.Categoria),
    TasaQuiebreGlobalPct = CAST(100.0 * SUM(CAST(f.EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2)),
    TasaQuiebreSinOestePct = CAST(100.0 * SUM(CASE WHEN s.Zona <> N'Oeste'
                                                   THEN CAST(f.EsQuiebre AS INT) ELSE 0 END)
                                  / NULLIF(SUM(CASE WHEN s.Zona <> N'Oeste' THEN 1 ELSE 0 END), 0)
                                  AS DECIMAL(5,2))
FROM Fact_Stock f
JOIN Dim_Producto p ON p.IdProducto = f.IdProducto
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal'
GROUP BY p.Proveedor, p.DiasReposicion
ORDER BY TasaQuiebreGlobalPct DESC;

PRINT '';
PRINT '=== 3.4 IMPACTO ECONOMICO: cuanto cuesta cada patron ===';

SELECT
    Hallazgo = N'Venta perdida estimada por quiebre (12 meses)',
    Valor    = CAST(FORMAT(SUM(v.VentaPerdida), 'C0', 'es-AR') AS VARCHAR(30))
FROM (
    SELECT VentaPerdida = c.StockMinimo / 3.0 * pr.PrecioUnitario
    FROM vw_Cubo_Logistica c
    JOIN Dim_Producto pr ON pr.NombreProducto = c.NombreProducto
    WHERE c.EsQuiebre = 1 AND c.Anio = 2025
) v
UNION ALL
SELECT N'Capital inmovilizado promedio en San Justo por sobrestock',
    CAST(FORMAT(AVG(c.ValorInventario) * COUNT(DISTINCT c.NombreProducto), 'C0', 'es-AR') AS VARCHAR(30))
FROM vw_Cubo_Logistica c
WHERE c.NombreSucursal = N'San Justo' AND c.Anio = 2025;
GO


/* ==========================================================================
   SECCION 4 - EXPORT PARA LA LANDING PAGE
   --------------------------------------------------------------------------
   Genera un unico documento JSON con todos los datasets que consume el
   portal de operaciones. Para volcarlo a archivo usar BCP (sqlcmd agrega
   encabezados y recorta el ancho, lo que rompe el JSON):

     bcp "EXEC MiniRed_DW.dbo.sp_LandingDataJson" queryout datos_landing.json ^
         -S localhost -T -c -C 65001
   ========================================================================== */

IF OBJECT_ID('sp_LandingDataJson') IS NOT NULL DROP PROCEDURE sp_LandingDataJson;
GO
CREATE PROCEDURE sp_LandingDataJson AS
BEGIN
    SET NOCOUNT ON;

    -- se resuelve antes: no se puede agregar sobre una expresion con subconsulta
    DECLARE @UltimaFecha DATE = (SELECT MAX(Fecha) FROM vw_Cubo_Logistica);

    -- FOR JSON devuelve el resultado partido en filas de 2033 caracteres.
    -- Asignarlo a una variable NVARCHAR(MAX) lo concatena en un unico valor.
    DECLARE @json NVARCHAR(MAX) = (
    SELECT
        -- Tarjetas de KPI del encabezado
        -- JSON_QUERY evita que el objeto se serialice como string escapado
        kpis = JSON_QUERY((
            SELECT
                tasaQuiebre     = CAST(100.0 * SUM(CAST(EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2)),
                diasCobertura   = CAST(AVG(CAST(StockDisponible AS DECIMAL(12,4)))
                                     / NULLIF(AVG(CAST(CantidadVendida AS DECIMAL(12,4))), 0) AS DECIMAL(6,2)),
                valorInventario = CAST(SUM(CASE WHEN Fecha = @UltimaFecha
                                                THEN ValorInventario ELSE 0 END) AS DECIMAL(16,2)),
                -- combinaciones sucursal-producto que hoy requieren reposicion.
                -- Contar SKU distintos no sirve: con 6 sucursales casi siempre
                -- da 30 de 30 y deja de discriminar.
                reposicionesPendientes = SUM(CASE WHEN EsBajoMinimo = 1 AND Fecha = @UltimaFecha
                                                  THEN 1 ELSE 0 END),
                combinacionesTotales   = SUM(CASE WHEN Fecha = @UltimaFecha THEN 1 ELSE 0 END)
            FROM vw_Cubo_Logistica
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        )),
        -- Mapa de calor zona x categoria
        heatmap = (
            SELECT zona = Zona, categoria = Categoria,
                   tasaQuiebre = CAST(100.0 * SUM(CAST(EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2))
            FROM vw_Cubo_Logistica GROUP BY Zona, Categoria
            FOR JSON PATH
        ),
        -- Serie mensual de quiebre
        serieMensual = (
            SELECT anio = Anio, mes = MesNumero, mesNombre = MIN(MesNombre),
                   tasaQuiebre = CAST(100.0 * SUM(CAST(EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2)),
                   unidadesVendidas = SUM(CantidadVendida)
            FROM vw_Cubo_Logistica GROUP BY Anio, MesNumero
            ORDER BY Anio, MesNumero
            FOR JSON PATH
        ),
        -- Ranking de SKU criticos
        skuCriticos = (
            SELECT TOP 15 producto = NombreProducto, categoria = MIN(Categoria),
                   proveedor = MIN(Proveedor),
                   tasaQuiebre = CAST(100.0 * SUM(CAST(EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2))
            FROM vw_Cubo_Logistica GROUP BY NombreProducto
            ORDER BY tasaQuiebre DESC
            FOR JSON PATH
        ),
        -- Semaforo por sucursal
        sucursales = (
            SELECT sucursal = NombreSucursal, zona = MIN(Zona),
                   tasaQuiebre   = CAST(100.0 * SUM(CAST(EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2)),
                   diasCobertura = CAST(AVG(CAST(StockDisponible AS DECIMAL(12,4)))
                                      / NULLIF(AVG(CAST(CantidadVendida AS DECIMAL(12,4))), 0) AS DECIMAL(6,2)),
                   unidadesVendidas = SUM(CantidadVendida)
            FROM vw_Cubo_Logistica GROUP BY NombreSucursal
            ORDER BY tasaQuiebre DESC
            FOR JSON PATH
        ),
        -- Quiebre por dia de la semana (evidencia del efecto arrastre)
        porDiaSemana = (
            SELECT dia = DiaSemanaNombre,
                   orden = MIN(DATEDIFF(DAY, '1900-01-01', Fecha) % 7),
                   tasaQuiebre = CAST(100.0 * SUM(CAST(EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2))
            FROM vw_Cubo_Logistica WHERE Categoria = N'Bebidas' AND Zona = N'Oeste'
            GROUP BY DiaSemanaNombre
            ORDER BY orden
            FOR JSON PATH
        )
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    SELECT datos = @json;
END
GO

PRINT '';
PRINT '>>> Consultas analiticas listas. Vista vw_Cubo_Logistica y sp_LandingDataJson creadas.';
GO

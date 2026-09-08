/* ==========================================================================
   MiniRed S.A. - Data Warehouse  |  MiniRed_DW
   TP Unidad 3 - "Data Detective & Landing Page Challenge"
   PERSPECTIVA: Opcion B - Logistica e Inventario
   --------------------------------------------------------------------------
   Que hace este script:
     1. Crea la base MiniRed_DW
     2. Crea el modelo en CONSTELACION: Fact_Ventas + Fact_Stock unidas por
        tres dimensiones conformadas (Tiempo, Sucursal, Producto)
     3. Puebla 2 anios completos (2024-2025) de datos simulados
     4. Verifica que los patrones de negocio quedaron plantados

   IMPORTANTE - los datos son SIMULADOS y los patrones estan plantados a
   proposito. Esto NO se oculta: se declara en el informe y se usa como
   material para el punto teorico 5 (extraccion de patrones / correlaciones
   espurias). Un dataset generado con RAND() puro no contiene ninguna regla
   inductiva que descubrir.

   POLITICA DE REPOSICION SIMULADA (es la causa raiz de todos los patrones):
     MiniRed repone con NIVEL OBJETIVO FIJO ("order-up-to"): cada
     DiasReposicion dias el stock se completa hasta un nivel calculado sobre
     el promedio de venta de DIA HABIL. Es decir, la planificacion ignora el
     pico de fin de semana y la estacionalidad. Ese desfasaje entre la
     politica y la demanda real es lo que genera los quiebres.

   PATRONES PLANTADOS (los que despues hay que "descubrir" con el cubo):
     P1 - Bebidas en Zona Oeste los fines de semana: la demanda se multiplica
          x2.0, pero el nivel objetivo se fijo sobre dias habiles.
          => quiebres sistematicos de fin de semana en el Oeste.
     P2 - Proveedor ARCOR entrega cada 14 dias (el resto cada 7) y con una
          cobertura mas ajustada.
          => sus productos agotan el nivel objetivo antes del proximo ingreso.
     P3 - Congelados en diciembre/enero/febrero: demanda x2.0 (verano), contra
          un nivel objetivo calculado sobre el promedio anual.
          => estacionalidad de rotacion Y quiebres concentrados en verano.
     P4 - Sucursal San Justo opera al 55% del volumen del resto, pero se
          abastece con el parametro de una sucursal estandar.
          => sobrestock inmovilizado, rotacion baja, casi sin quiebres.

   Ejecucion:
     sqlcmd -S localhost -E -f 65001 -i 01_MiniRed_DW_crear_y_poblar.sql
   Para deshacer todo:
     DROP DATABASE MiniRed_DW;
   ========================================================================== */

SET NOCOUNT ON;
GO

USE master;
GO

IF DB_ID('MiniRed_DW') IS NOT NULL
BEGIN
    ALTER DATABASE MiniRed_DW SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE MiniRed_DW;
END
GO

CREATE DATABASE MiniRed_DW;
GO

USE MiniRed_DW;
GO

/* ==========================================================================
   1. DDL - DIMENSIONES
   ========================================================================== */

CREATE TABLE Dim_Tiempo (
    IdTiempo         INT           NOT NULL PRIMARY KEY,   -- clave subrogada AAAAMMDD
    Fecha            DATE          NOT NULL,
    Anio             INT           NOT NULL,
    Trimestre        TINYINT       NOT NULL,
    MesNumero        TINYINT       NOT NULL,
    MesNombre        NVARCHAR(15)  NOT NULL,
    DiaSemanaNombre  NVARCHAR(15)  NOT NULL,
    EsFinDeSemana    BIT           NOT NULL,               -- variable DISCRETA (binaria)
    Temporada        NVARCHAR(15)  NOT NULL
);
GO

CREATE TABLE Dim_Sucursal (
    IdSucursal       INT           NOT NULL PRIMARY KEY,
    NombreSucursal   NVARCHAR(50)  NOT NULL,
    Zona             NVARCHAR(20)  NOT NULL,               -- variable DISCRETA (nominal)
    Direccion        NVARCHAR(100) NOT NULL,
    TipoUbicacion    NVARCHAR(20)  NOT NULL,               -- 'Sucursal' | 'Deposito'
    FactorTamanio    DECIMAL(4,2)  NOT NULL                -- escala de volumen operativo
);
GO

CREATE TABLE Dim_Producto (
    IdProducto       INT           NOT NULL PRIMARY KEY,
    NombreProducto   NVARCHAR(80)  NOT NULL,
    Categoria        NVARCHAR(30)  NOT NULL,               -- variable DISCRETA (nominal)
    Rubro            NVARCHAR(30)  NOT NULL,
    Proveedor        NVARCHAR(40)  NOT NULL,
    PrecioUnitario   DECIMAL(10,2) NOT NULL,               -- variable CONTINUA
    CostoUnitario    DECIMAL(10,2) NOT NULL,               -- variable CONTINUA
    DemandaBase      DECIMAL(6,2)  NOT NULL,               -- unidades/dia de referencia
    DiasReposicion   TINYINT       NOT NULL                -- ciclo del proveedor (P2)
);
GO

CREATE TABLE Dim_Cajero (
    IdCajero         INT           NOT NULL PRIMARY KEY,
    NombreCajero     NVARCHAR(50)  NOT NULL,
    Legajo           NVARCHAR(10)  NOT NULL,
    Turno            NVARCHAR(15)  NOT NULL
);
GO

CREATE TABLE Dim_MedioPago (
    IdMedioPago      INT           NOT NULL PRIMARY KEY,
    TipoPago         NVARCHAR(30)  NOT NULL,
    Campania         NVARCHAR(40)  NOT NULL
);
GO

/* ==========================================================================
   2. DDL - TABLAS DE HECHOS (CONSTELACION)

   Fact_Ventas  grano: 1 linea de ticket
   Fact_Stock   grano: 1 snapshot diario por sucursal y producto
   Dimensiones conformadas: Tiempo, Sucursal, Producto.
   Fact_Stock NO usa Dim_Cajero ni Dim_MedioPago: el ingreso de mercaderia
   no pasa por caja. Ese es el argumento de por que Fact_Stock es una tabla
   nueva y no una columna mas en Fact_Ventas.
   ========================================================================== */

CREATE TABLE Fact_Ventas (
    IdVenta          BIGINT        IDENTITY(1,1) PRIMARY KEY,
    IdTicket         BIGINT        NOT NULL,               -- dimension degenerada
    IdTiempo         INT           NOT NULL,
    IdSucursal       INT           NOT NULL,
    IdProducto       INT           NOT NULL,
    IdCajero         INT           NOT NULL,
    IdMedioPago      INT           NOT NULL,
    Cantidad         INT           NOT NULL,               -- ADITIVA
    PrecioUnitario   DECIMAL(10,2) NOT NULL,               -- NO ADITIVA
    CostoUnitario    DECIMAL(10,2) NOT NULL,               -- NO ADITIVA
    ImporteTotal     DECIMAL(12,2) NOT NULL,               -- ADITIVA
    CostoTotal       DECIMAL(12,2) NOT NULL,               -- ADITIVA
    CONSTRAINT FK_FV_Tiempo    FOREIGN KEY (IdTiempo)    REFERENCES Dim_Tiempo(IdTiempo),
    CONSTRAINT FK_FV_Sucursal  FOREIGN KEY (IdSucursal)  REFERENCES Dim_Sucursal(IdSucursal),
    CONSTRAINT FK_FV_Producto  FOREIGN KEY (IdProducto)  REFERENCES Dim_Producto(IdProducto),
    CONSTRAINT FK_FV_Cajero    FOREIGN KEY (IdCajero)    REFERENCES Dim_Cajero(IdCajero),
    CONSTRAINT FK_FV_MedioPago FOREIGN KEY (IdMedioPago) REFERENCES Dim_MedioPago(IdMedioPago)
);
GO

CREATE TABLE Fact_Stock (
    IdStock            BIGINT      IDENTITY(1,1) PRIMARY KEY,
    IdTiempo           INT         NOT NULL,
    IdSucursal         INT         NOT NULL,
    IdProducto         INT         NOT NULL,
    CantidadIngresada  INT         NOT NULL,   -- ADITIVA      (flujo de entrada)
    CantidadVendida    INT         NOT NULL,   -- ADITIVA      (flujo de salida)
    StockDisponible    INT         NOT NULL,   -- SEMI-ADITIVA (foto al cierre del dia)
    StockMinimo        INT         NOT NULL,   -- NO ADITIVA   (umbral de reposicion)
    -- TINYINT y no BIT: son banderas que se SUMAN (contar dias en quiebre), o sea
    -- medidas aditivas. Ademas SSAS no ofrece columnas BIT como medida del cubo,
    -- porque no las considera un tipo numerico agregable.
    EsQuiebre          TINYINT     NOT NULL,   -- 1 = stock en cero al cierre
    EsBajoMinimo       TINYINT     NOT NULL,   -- 1 = por debajo del punto de pedido
    CONSTRAINT FK_FS_Tiempo   FOREIGN KEY (IdTiempo)   REFERENCES Dim_Tiempo(IdTiempo),
    CONSTRAINT FK_FS_Sucursal FOREIGN KEY (IdSucursal) REFERENCES Dim_Sucursal(IdSucursal),
    CONSTRAINT FK_FS_Producto FOREIGN KEY (IdProducto) REFERENCES Dim_Producto(IdProducto)
);
GO

/* ==========================================================================
   3. CARGA - Dim_Tiempo (2024-01-01 a 2025-12-31)
   ========================================================================== */

WITH Fechas AS (
    SELECT CAST('2024-01-01' AS DATE) AS Fecha
    UNION ALL
    SELECT DATEADD(DAY, 1, Fecha) FROM Fechas WHERE Fecha < '2025-12-31'
)
INSERT INTO Dim_Tiempo (IdTiempo, Fecha, Anio, Trimestre, MesNumero, MesNombre,
                        DiaSemanaNombre, EsFinDeSemana, Temporada)
SELECT
    YEAR(Fecha) * 10000 + MONTH(Fecha) * 100 + DAY(Fecha),
    Fecha,
    YEAR(Fecha),
    DATEPART(QUARTER, Fecha),
    MONTH(Fecha),
    CASE MONTH(Fecha)
        WHEN 1 THEN N'Enero'   WHEN 2 THEN N'Febrero'    WHEN 3  THEN N'Marzo'
        WHEN 4 THEN N'Abril'   WHEN 5 THEN N'Mayo'       WHEN 6  THEN N'Junio'
        WHEN 7 THEN N'Julio'   WHEN 8 THEN N'Agosto'     WHEN 9  THEN N'Septiembre'
        WHEN 10 THEN N'Octubre' WHEN 11 THEN N'Noviembre' ELSE N'Diciembre' END,
    -- 1900-01-01 fue lunes => 0=Lunes ... 6=Domingo (independiente del DATEFIRST)
    CASE DATEDIFF(DAY, '1900-01-01', Fecha) % 7
        WHEN 0 THEN N'Lunes'   WHEN 1 THEN N'Martes' WHEN 2 THEN N'Miercoles'
        WHEN 3 THEN N'Jueves'  WHEN 4 THEN N'Viernes' WHEN 5 THEN N'Sabado'
        ELSE N'Domingo' END,
    CASE WHEN DATEDIFF(DAY, '1900-01-01', Fecha) % 7 IN (5, 6) THEN 1 ELSE 0 END,
    CASE WHEN MONTH(Fecha) IN (12, 1, 2) THEN N'Verano'
         WHEN MONTH(Fecha) IN (3, 4, 5)  THEN N'Otonio'
         WHEN MONTH(Fecha) IN (6, 7, 8)  THEN N'Invierno'
         ELSE N'Primavera' END
FROM Fechas
OPTION (MAXRECURSION 0);
GO

/* ==========================================================================
   4. CARGA - Dim_Sucursal
   El deposito Central se modela como una fila mas de Dim_Sucursal con
   TipoUbicacion = 'Deposito', en lugar de crear una Dim_Deposito aparte.
   Justificacion: comparte los mismos atributos (nombre, zona, direccion) y
   participa del mismo proceso de stock. Evita una dimension casi vacia.
   ========================================================================== */

INSERT INTO Dim_Sucursal (IdSucursal, NombreSucursal, Zona, Direccion, TipoUbicacion, FactorTamanio)
VALUES
    (1, N'Palermo',          N'Centro', N'Av. Santa Fe 3421',      N'Sucursal', 1.40),
    (2, N'Moron',            N'Oeste',  N'Av. Rivadavia 17800',    N'Sucursal', 1.10),
    (3, N'San Justo',        N'Oeste',  N'Av. Brigadier Rosas 22', N'Sucursal', 1.00),
    (4, N'Ituzaingo',        N'Oeste',  N'Soler 745',              N'Sucursal', 0.90),
    (5, N'Vicente Lopez',    N'Norte',  N'Av. Maipu 1250',         N'Sucursal', 1.25),
    (6, N'Lomas de Zamora',  N'Sur',    N'Av. Meeks 380',          N'Sucursal', 1.05),
    (7, N'Deposito Central', N'Centro', N'Ruta 3 km 24 - Tapiales', N'Deposito', 1.00);
GO

/* ==========================================================================
   5. CARGA - Dim_Producto
   DiasReposicion = 14 para ARCOR (patron P2), 7 para el resto.
   ========================================================================== */

INSERT INTO Dim_Producto (IdProducto, NombreProducto, Categoria, Rubro, Proveedor,
                          PrecioUnitario, CostoUnitario, DemandaBase, DiasReposicion)
VALUES
    -- Bebidas (protagonistas del patron P1)
    ( 1, N'Gaseosa Cola 2.25L',        N'Bebidas',    N'Gaseosas',      N'Coca-Cola Andina',   2450.00, 1690.00, 14.0,  7),
    ( 2, N'Gaseosa Lima-Limon 2.25L',  N'Bebidas',    N'Gaseosas',      N'Coca-Cola Andina',   2380.00, 1640.00,  9.0,  7),
    ( 3, N'Agua Mineral 2L',           N'Bebidas',    N'Aguas',         N'Aguas Danone',       1290.00,  830.00, 11.0,  7),
    ( 4, N'Agua Saborizada 1.5L',      N'Bebidas',    N'Aguas',         N'Aguas Danone',       1620.00, 1050.00,  7.0,  7),
    ( 5, N'Cerveza Rubia 1L',          N'Bebidas',    N'Cervezas',      N'Cerveceria Quilmes', 2890.00, 1980.00, 12.0,  7),
    ( 6, N'Cerveza Negra 473ml',       N'Bebidas',    N'Cervezas',      N'Cerveceria Quilmes', 1750.00, 1190.00,  6.0,  7),
    ( 7, N'Jugo Naranja 1L',           N'Bebidas',    N'Jugos',         N'Aguas Danone',       1480.00,  960.00,  5.0,  7),
    -- Almacen - Molinos
    ( 8, N'Yerba Mate 1kg',            N'Almacen',    N'Infusiones',    N'Molinos',            4980.00, 3450.00, 10.0,  7),
    ( 9, N'Yerba Mate 500g',           N'Almacen',    N'Infusiones',    N'Molinos',            2790.00, 1920.00,  7.0,  7),
    (10, N'Fideos Guiseros 500g',      N'Almacen',    N'Pastas Secas',  N'Molinos',             980.00,  640.00,  9.0,  7),
    (11, N'Arroz Largo Fino 1kg',      N'Almacen',    N'Arroz',         N'Molinos',            1350.00,  890.00,  8.0,  7),
    (12, N'Aceite Girasol 1.5L',       N'Almacen',    N'Aceites',       N'Molinos',            3690.00, 2540.00,  6.0,  7),
    -- Almacen - ARCOR (patron P2: reposicion cada 14 dias)
    (13, N'Pure de Tomate 520g',       N'Almacen',    N'Conservas',     N'Arcor',              1180.00,  760.00,  8.0, 14),
    (14, N'Mermelada Durazno 390g',    N'Almacen',    N'Dulces',        N'Arcor',              1690.00, 1090.00,  4.0, 14),
    (15, N'Galletitas Dulces 300g',    N'Almacen',    N'Galletitas',    N'Arcor',              1420.00,  920.00, 11.0, 14),
    (16, N'Alfajor Triple 70g',        N'Almacen',    N'Golosinas',     N'Arcor',               890.00,  560.00, 15.0, 14),
    (17, N'Caramelos Surtidos 100g',   N'Almacen',    N'Golosinas',     N'Arcor',               650.00,  400.00,  6.0, 14),
    -- Lacteos
    (18, N'Leche Entera 1L',           N'Lacteos',    N'Leches',        N'La Serenisima',      1590.00, 1080.00, 18.0,  7),
    (19, N'Yogur Bebible 1L',          N'Lacteos',    N'Yogures',       N'La Serenisima',      2140.00, 1460.00,  8.0,  7),
    (20, N'Queso Cremoso 500g',        N'Lacteos',    N'Quesos',        N'La Serenisima',      4350.00, 3010.00,  5.0,  7),
    (21, N'Manteca 200g',              N'Lacteos',    N'Untables',      N'La Serenisima',      2280.00, 1570.00,  4.0,  7),
    (22, N'Dulce de Leche 400g',       N'Lacteos',    N'Untables',      N'La Serenisima',      2650.00, 1810.00,  6.0,  7),
    -- Congelados (patron P3: estacionalidad de verano)
    (23, N'Helado Crema 1L',           N'Congelados', N'Helados',       N'Frigorifico Sur',    5200.00, 3580.00,  7.0,  7),
    (24, N'Palitos Helados x6',        N'Congelados', N'Helados',       N'Frigorifico Sur',    3100.00, 2090.00,  6.0,  7),
    (25, N'Hamburguesas Cong. x4',     N'Congelados', N'Carnes',        N'Frigorifico Sur',    4780.00, 3290.00,  5.0,  7),
    (26, N'Papas Baston 1kg',          N'Congelados', N'Vegetales',     N'Frigorifico Sur',    2950.00, 1980.00,  6.0,  7),
    -- Limpieza
    (27, N'Detergente 750ml',          N'Limpieza',   N'Lavavajilla',   N'Unilever',           1890.00, 1240.00,  7.0,  7),
    (28, N'Lavandina 1L',              N'Limpieza',   N'Desinfectantes',N'Unilever',            980.00,  620.00,  6.0,  7),
    (29, N'Jabon en Polvo 800g',       N'Limpieza',   N'Lavarropas',    N'Unilever',           3450.00, 2380.00,  4.0,  7),
    (30, N'Papel Higienico x4',        N'Limpieza',   N'Papeles',       N'Unilever',           2680.00, 1820.00,  9.0,  7);
GO

/* ==========================================================================
   6. CARGA - Dim_Cajero y Dim_MedioPago
   ========================================================================== */

INSERT INTO Dim_Cajero (IdCajero, NombreCajero, Legajo, Turno) VALUES
    ( 1, N'Juan Perez',        N'A-1001', N'Maniana'),
    ( 2, N'Maria Gomez',       N'A-1002', N'Maniana'),
    ( 3, N'Carlos Ruiz',       N'A-1003', N'Maniana'),
    ( 4, N'Lucia Fernandez',   N'A-1004', N'Maniana'),
    ( 5, N'Diego Sosa',        N'B-2001', N'Tarde'),
    ( 6, N'Ana Martinez',      N'B-2002', N'Tarde'),
    ( 7, N'Pablo Herrera',     N'B-2003', N'Tarde'),
    ( 8, N'Sofia Dominguez',   N'B-2004', N'Tarde'),
    ( 9, N'Martin Acosta',     N'C-3001', N'Noche'),
    (10, N'Valeria Rios',      N'C-3002', N'Noche'),
    (11, N'Nicolas Ferreyra',  N'C-3003', N'Noche'),
    (12, N'Camila Ledesma',    N'C-3004', N'Noche');
GO

INSERT INTO Dim_MedioPago (IdMedioPago, TipoPago, Campania) VALUES
    (1, N'Efectivo',          N'Sin Campania'),
    (2, N'Tarjeta de Debito', N'Sin Campania'),
    (3, N'Tarjeta de Credito',N'Cuotas Sin Interes'),
    (4, N'Tarjeta de Credito',N'Navidad'),
    (5, N'Billetera Virtual', N'Descuento QR'),
    (6, N'Billetera Virtual', N'Sin Campania');
GO

/* ==========================================================================
   7. CARGA - Fact_Ventas
   Demanda diaria = base x tamanio sucursal x factores de patron x ruido.
   El ruido es deterministico (CHECKSUM sobre las claves), asi que el script
   es REPRODUCIBLE: dos ejecuciones dan exactamente los mismos numeros.
   ========================================================================== */

;WITH Tally AS (
    SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3
),
Demanda AS (
    SELECT
        t.IdTiempo, t.MesNumero, t.EsFinDeSemana,
        s.IdSucursal, s.NombreSucursal, s.Zona,
        p.IdProducto, p.Categoria, p.PrecioUnitario, p.CostoUnitario,
        UnidadesDia = CEILING(
              p.DemandaBase
            * s.FactorTamanio
            * CASE WHEN t.EsFinDeSemana = 1 THEN 1.35 ELSE 1.00 END
            -- P1: bebidas + Oeste + fin de semana
            * CASE WHEN p.Categoria = N'Bebidas' AND s.Zona = N'Oeste'
                        AND t.EsFinDeSemana = 1 THEN 2.00 ELSE 1.00 END
            -- P3: congelados en verano
            * CASE WHEN p.Categoria = N'Congelados'
                        AND t.MesNumero IN (12, 1, 2) THEN 2.00 ELSE 1.00 END
            -- P4: San Justo opera al 55%
            * CASE WHEN s.NombreSucursal = N'San Justo' THEN 0.55 ELSE 1.00 END
            -- ruido reproducible entre 0.70 y 1.30
            * (70 + (CHECKSUM(CAST(t.IdTiempo AS VARCHAR(12)) + '|'
                            + CAST(s.IdSucursal AS VARCHAR(6)) + '|'
                            + CAST(p.IdProducto AS VARCHAR(6)) + '|dem') & 2147483647) % 61)
              / 100.0
        )
    FROM Dim_Tiempo t
    CROSS JOIN Dim_Sucursal s
    CROSS JOIN Dim_Producto p
    WHERE s.TipoUbicacion = N'Sucursal'
),
Lineas AS (
    SELECT
        d.*,
        NumLineas = CASE WHEN d.UnidadesDia <= 3 THEN 1
                         WHEN d.UnidadesDia <= 9 THEN 2
                         ELSE 3 END
    FROM Demanda d
    WHERE d.UnidadesDia > 0
)
INSERT INTO Fact_Ventas (IdTicket, IdTiempo, IdSucursal, IdProducto, IdCajero,
                         IdMedioPago, Cantidad, PrecioUnitario, CostoUnitario,
                         ImporteTotal, CostoTotal)
SELECT
    -- ticket: hasta 400 tickets distintos por dia y sucursal
    IdTicket = CAST(l.IdTiempo AS BIGINT) * 100000
             + CAST(l.IdSucursal AS BIGINT) * 1000
             + (CHECKSUM(CAST(l.IdTiempo AS VARCHAR(12)) + '|'
                       + CAST(l.IdSucursal AS VARCHAR(6)) + '|'
                       + CAST(l.IdProducto AS VARCHAR(6)) + '|'
                       + CAST(x.n AS VARCHAR(2)) + '|tk') & 2147483647) % 400,
    l.IdTiempo,
    l.IdSucursal,
    l.IdProducto,
    IdCajero = 1 + (CHECKSUM(CAST(l.IdTiempo AS VARCHAR(12)) + '|'
                           + CAST(l.IdProducto AS VARCHAR(6)) + '|'
                           + CAST(x.n AS VARCHAR(2)) + '|cj') & 2147483647) % 12,
    IdMedioPago = CASE
        -- en diciembre se dispara la campania de Navidad
        WHEN l.MesNumero = 12 AND (CHECKSUM(CAST(l.IdTiempo AS VARCHAR(12)) + '|'
                                          + CAST(l.IdProducto AS VARCHAR(6)) + '|'
                                          + CAST(x.n AS VARCHAR(2)) + '|mp') & 2147483647) % 100 < 45
            THEN 4
        ELSE 1 + (CHECKSUM(CAST(l.IdTiempo AS VARCHAR(12)) + '|'
                         + CAST(l.IdProducto AS VARCHAR(6)) + '|'
                         + CAST(x.n AS VARCHAR(2)) + '|mp') & 2147483647) % 6
        END,
    Cantidad = Cant.Cantidad,
    l.PrecioUnitario,
    l.CostoUnitario,
    ImporteTotal = CAST(Cant.Cantidad * l.PrecioUnitario AS DECIMAL(12,2)),
    CostoTotal   = CAST(Cant.Cantidad * l.CostoUnitario  AS DECIMAL(12,2))
FROM Lineas l
JOIN Tally x ON x.n <= l.NumLineas
CROSS APPLY (
    SELECT Cantidad = CASE
        WHEN x.n < l.NumLineas THEN l.UnidadesDia / l.NumLineas
        ELSE l.UnidadesDia - (l.UnidadesDia / l.NumLineas) * (l.NumLineas - 1)
        END
) Cant
WHERE Cant.Cantidad > 0;
GO

/* ==========================================================================
   8A. CARGA - Fact_Stock (SUCURSALES)

   CantidadVendida sale AGREGANDO Fact_Ventas: las dos tablas de hechos quedan
   consistentes y el drill-across "vendido vs. ingresado" es real.

   Politica de reposicion = NIVEL OBJETIVO ("order-up-to"):
     NivelObjetivo = promedio de venta en DIA HABIL x DiasReposicion x Cobertura
     Cada DiasReposicion dias el stock se completa hasta ese nivel.
     Entre reposiciones el stock baja segun la venta real.

   Al fijar el parametro sobre dias habiles, la planificacion NO contempla el
   pico de fin de semana ni la estacionalidad => de ahi salen los quiebres.
   Al ser un nivel objetivo (y no una suma acumulada), el stock no acumula
   deriva: se recompone en cada ciclo, como en la operacion real.

   StockDisponible es la medida SEMI-ADITIVA del modelo.
   ========================================================================== */

;WITH VentasDia AS (
    SELECT IdTiempo, IdSucursal, IdProducto, Vendidas = SUM(Cantidad)
    FROM Fact_Ventas
    GROUP BY IdTiempo, IdSucursal, IdProducto
),
PromHabil AS (
    -- promedio de venta diaria considerando SOLO dias habiles
    SELECT v.IdSucursal, v.IdProducto,
           PromDiaHabil = AVG(CAST(v.Vendidas AS DECIMAL(12,4)))
    FROM VentasDia v
    JOIN Dim_Tiempo t ON t.IdTiempo = v.IdTiempo
    WHERE t.EsFinDeSemana = 0
    GROUP BY v.IdSucursal, v.IdProducto
),
NivelObj AS (
    SELECT
        ph.IdSucursal, ph.IdProducto, p.DiasReposicion,
        -- P4: San Justo se abastece con el parametro de una sucursal estandar;
        --     nadie ajusto el nivel tras la caida de demanda
        PromAjustado = ph.PromDiaHabil
                     * CASE WHEN s.NombreSucursal = N'San Justo' THEN 1.0 / 0.55 ELSE 1.0 END,
        NivelObjetivo = CAST(CEILING(
              ph.PromDiaHabil
            * CASE WHEN s.NombreSucursal = N'San Justo' THEN 1.0 / 0.55 ELSE 1.0 END
            * p.DiasReposicion
            -- P2: Arcor entrega cada 14 dias y con cobertura mas ajustada
            * CASE WHEN p.Proveedor = N'Arcor' THEN 1.00 ELSE 1.20 END
        ) AS INT)
    FROM PromHabil ph
    JOIN Dim_Sucursal s ON s.IdSucursal = ph.IdSucursal
    JOIN Dim_Producto p ON p.IdProducto = ph.IdProducto
),
Malla AS (
    SELECT
        t.IdTiempo,
        s.IdSucursal,
        p.IdProducto,
        no.NivelObjetivo,
        Vendidas = ISNULL(v.Vendidas, 0),
        -- +14000 evita modulo/division negativos en los primeros dias
        EsDiaReposicion = CASE WHEN (DATEDIFF(DAY, '2024-01-01', t.Fecha)
                                     - s.IdSucursal % p.DiasReposicion + 14000)
                                    % p.DiasReposicion = 0 THEN 1 ELSE 0 END,
        CicloId         = (DATEDIFF(DAY, '2024-01-01', t.Fecha)
                           - s.IdSucursal % p.DiasReposicion + 14000)
                          / p.DiasReposicion,
        -- punto de pedido: 3 dias de venta, independiente del ciclo del proveedor
        StockMinimo     = CAST(CEILING(no.PromAjustado * 3.0) AS INT)
    FROM Dim_Tiempo t
    CROSS JOIN Dim_Sucursal s
    CROSS JOIN Dim_Producto p
    JOIN NivelObj no ON no.IdSucursal = s.IdSucursal AND no.IdProducto = p.IdProducto
    LEFT JOIN VentasDia v ON v.IdTiempo   = t.IdTiempo
                         AND v.IdSucursal = s.IdSucursal
                         AND v.IdProducto = p.IdProducto
    WHERE s.TipoUbicacion = N'Sucursal'
),
Consumo AS (
    SELECT m.*,
           ConsumoAcum = SUM(m.Vendidas) OVER (
                PARTITION BY m.IdSucursal, m.IdProducto, m.CicloId
                ORDER BY m.IdTiempo
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    FROM Malla m
),
Stocks AS (
    SELECT c.*,
           Stock = CASE WHEN c.NivelObjetivo - c.ConsumoAcum < 0
                        THEN 0 ELSE c.NivelObjetivo - c.ConsumoAcum END
    FROM Consumo c
),
ConLag AS (
    SELECT s.*,
           StockPrev = LAG(s.Stock, 1, 0) OVER (
                PARTITION BY s.IdSucursal, s.IdProducto ORDER BY s.IdTiempo)
    FROM Stocks s
)
INSERT INTO Fact_Stock (IdTiempo, IdSucursal, IdProducto, CantidadIngresada,
                        CantidadVendida, StockDisponible, StockMinimo,
                        EsQuiebre, EsBajoMinimo)
SELECT
    cl.IdTiempo,
    cl.IdSucursal,
    cl.IdProducto,
    -- en el dia de reposicion se completa hasta el nivel objetivo
    CantidadIngresada = CASE WHEN cl.EsDiaReposicion = 1
                                  AND cl.NivelObjetivo - cl.StockPrev > 0
                             THEN cl.NivelObjetivo - cl.StockPrev ELSE 0 END,
    CantidadVendida   = cl.Vendidas,
    StockDisponible   = cl.Stock,
    StockMinimo       = cl.StockMinimo,
    EsQuiebre         = CASE WHEN cl.Stock = 0 THEN 1 ELSE 0 END,
    EsBajoMinimo      = CASE WHEN cl.Stock < cl.StockMinimo THEN 1 ELSE 0 END
FROM ConLag cl;
GO

/* ==========================================================================
   8B. CARGA - Fact_Stock (DEPOSITO CENTRAL, IdSucursal = 7)

   El deposito opera en CROSS-DOCKING: recibe del proveedor y despacha a las
   sucursales el mismo dia, manteniendo un stock de seguridad equivalente a
   3 dias de despacho promedio. Se modela asi para poder responder el
   Requerimiento 3 ("cuanto stock ingreso al deposito Central proveniente del
   proveedor X en el trimestre") sin distorsionar el analisis de gondola,
   que siempre filtra TipoUbicacion = 'Sucursal'.
   ========================================================================== */

INSERT INTO Fact_Stock (IdTiempo, IdSucursal, IdProducto, CantidadIngresada,
                        CantidadVendida, StockDisponible, StockMinimo,
                        EsQuiebre, EsBajoMinimo)
SELECT
    t.IdTiempo,
    7,
    p.IdProducto,
    CantidadIngresada = ISNULL(d.Despacho, 0),
    CantidadVendida   = ISNULL(d.Despacho, 0),
    StockDisponible   = ss.StockSeguridad,
    StockMinimo       = ss.StockSeguridad,
    EsQuiebre         = 0,
    EsBajoMinimo      = 0
FROM Dim_Tiempo t
CROSS JOIN Dim_Producto p
LEFT JOIN (
    SELECT IdTiempo, IdProducto, Despacho = SUM(CantidadIngresada)
    FROM Fact_Stock WHERE IdSucursal <> 7
    GROUP BY IdTiempo, IdProducto
) d ON d.IdTiempo = t.IdTiempo AND d.IdProducto = p.IdProducto
JOIN (
    SELECT IdProducto,
           StockSeguridad = CAST(CEILING(SUM(CAST(CantidadIngresada AS DECIMAL(18,4))) / 731.0 * 3) AS INT)
    FROM Fact_Stock WHERE IdSucursal <> 7
    GROUP BY IdProducto
) ss ON ss.IdProducto = p.IdProducto;
GO

/* ==========================================================================
   8C. VALOR DE INVENTARIO (capital inmovilizado)

   El costo unitario vive en Dim_Producto, pero el analisis necesita valuar el
   stock en pesos. En un modelo dimensional el valor calculado se materializa
   en la tabla de hechos, y asi queda disponible como MEDIDA del cubo: en MDX
   no se puede multiplicar una medida por un atributo de dimension.

   Hereda la semi-aditividad de StockDisponible, asi que en SSAS tambien se
   configura con AggregateFunction = LastNonEmpty.
   ========================================================================== */

ALTER TABLE Fact_Stock ADD ValorInventario DECIMAL(14,2) NULL;
GO

UPDATE f
   SET f.ValorInventario = CAST(f.StockDisponible * p.CostoUnitario AS DECIMAL(14,2))
FROM Fact_Stock f
JOIN Dim_Producto p ON p.IdProducto = f.IdProducto;
GO

ALTER TABLE Fact_Stock ALTER COLUMN ValorInventario DECIMAL(14,2) NOT NULL;
GO

/* ==========================================================================
   9. INDICES sobre las FK (SSAS procesa mucho mas rapido con esto)
   ========================================================================== */

CREATE INDEX IX_FV_Tiempo   ON Fact_Ventas(IdTiempo);
CREATE INDEX IX_FV_Sucursal ON Fact_Ventas(IdSucursal);
CREATE INDEX IX_FV_Producto ON Fact_Ventas(IdProducto);
CREATE INDEX IX_FS_Tiempo   ON Fact_Stock(IdTiempo);
CREATE INDEX IX_FS_Sucursal ON Fact_Stock(IdSucursal);
CREATE INDEX IX_FS_Producto ON Fact_Stock(IdProducto);
GO

/* ==========================================================================
   10. VERIFICACION - volumetria y patrones plantados
   ========================================================================== */

PRINT '';
PRINT '=== VOLUMETRIA ===';
SELECT N'Dim_Tiempo' AS Tabla, COUNT(*) AS Filas FROM Dim_Tiempo
UNION ALL SELECT N'Dim_Sucursal',  COUNT(*) FROM Dim_Sucursal
UNION ALL SELECT N'Dim_Producto',  COUNT(*) FROM Dim_Producto
UNION ALL SELECT N'Dim_Cajero',    COUNT(*) FROM Dim_Cajero
UNION ALL SELECT N'Dim_MedioPago', COUNT(*) FROM Dim_MedioPago
UNION ALL SELECT N'Fact_Ventas',   COUNT(*) FROM Fact_Ventas
UNION ALL SELECT N'Fact_Stock',    COUNT(*) FROM Fact_Stock;

PRINT '';
PRINT '=== P1: quiebre de BEBIDAS por zona, finde vs. dia habil ===';
SELECT
    s.Zona,
    Periodo = CASE WHEN t.EsFinDeSemana = 1 THEN N'Fin de semana' ELSE N'Dia habil' END,
    DiasObservados = COUNT(*),
    DiasEnQuiebre  = SUM(CAST(f.EsQuiebre AS INT)),
    TasaQuiebrePct = CAST(100.0 * SUM(CAST(f.EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2))
FROM Fact_Stock f
JOIN Dim_Tiempo   t ON t.IdTiempo   = f.IdTiempo
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
JOIN Dim_Producto p ON p.IdProducto = f.IdProducto
WHERE p.Categoria = N'Bebidas' AND s.TipoUbicacion = N'Sucursal'
GROUP BY s.Zona, CASE WHEN t.EsFinDeSemana = 1 THEN N'Fin de semana' ELSE N'Dia habil' END
ORDER BY s.Zona, Periodo;

PRINT '';
PRINT '=== P1-bis: BEBIDAS en Oeste, quiebre por DIA DE LA SEMANA ===';
PRINT '    (el pico del finde vacia la gondola y el quiebre aparece DESPUES)';
SELECT
    t.DiaSemanaNombre,
    Orden = MIN(DATEDIFF(DAY, '1900-01-01', t.Fecha) % 7),
    TasaQuiebrePct = CAST(100.0 * SUM(CAST(f.EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2))
FROM Fact_Stock f
JOIN Dim_Tiempo   t ON t.IdTiempo   = f.IdTiempo
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
JOIN Dim_Producto p ON p.IdProducto = f.IdProducto
WHERE p.Categoria = N'Bebidas' AND s.Zona = N'Oeste' AND s.TipoUbicacion = N'Sucursal'
GROUP BY t.DiaSemanaNombre
ORDER BY Orden;

PRINT '';
PRINT '=== P2: quiebre por PROVEEDOR - lectura INGENUA (con confusion) ===';
PRINT '    OJO: los proveedores de bebidas encabezan por el efecto ZONA, no por';
PRINT '    su ciclo de entrega. Es una CORRELACION ESPURIA - sirve para el punto 5.';
SELECT
    p.Proveedor,
    p.DiasReposicion,
    Categorias     = MIN(p.Categoria),
    TasaQuiebrePct = CAST(100.0 * SUM(CAST(f.EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2))
FROM Fact_Stock f
JOIN Dim_Producto p ON p.IdProducto = f.IdProducto
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal'
GROUP BY p.Proveedor, p.DiasReposicion
ORDER BY TasaQuiebrePct DESC;

PRINT '';
PRINT '=== P2-bis: mismo analisis CONTROLANDO por categoria (sin Bebidas) ===';
PRINT '    Ahora si se aisla el efecto real del ciclo de reposicion.';
SELECT
    p.Proveedor,
    p.DiasReposicion,
    TasaQuiebrePct = CAST(100.0 * SUM(CAST(f.EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2)),
    TasaBajoMinPct = CAST(100.0 * SUM(CAST(f.EsBajoMinimo AS INT)) / COUNT(*) AS DECIMAL(5,2))
FROM Fact_Stock f
JOIN Dim_Producto p ON p.IdProducto = f.IdProducto
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal' AND p.Categoria <> N'Bebidas'
GROUP BY p.Proveedor, p.DiasReposicion
ORDER BY TasaQuiebrePct DESC;

PRINT '';
PRINT '=== P3: CONGELADOS - venta y quiebre por trimestre (estacionalidad) ===';
SELECT
    t.Anio,
    t.Trimestre,
    UnidadesVendidas = SUM(f.CantidadVendida),
    TasaQuiebrePct   = CAST(100.0 * SUM(CAST(f.EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2))
FROM Fact_Stock f
JOIN Dim_Tiempo   t ON t.IdTiempo   = f.IdTiempo
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
JOIN Dim_Producto p ON p.IdProducto = f.IdProducto
WHERE p.Categoria = N'Congelados' AND s.TipoUbicacion = N'Sucursal'
GROUP BY t.Anio, t.Trimestre
ORDER BY t.Anio, t.Trimestre;

PRINT '';
PRINT '=== P4: rotacion y cobertura por sucursal ===';
SELECT
    s.NombreSucursal,
    s.Zona,
    UnidadesVendidas = SUM(f.CantidadVendida),
    StockPromedio    = CAST(AVG(CAST(f.StockDisponible AS DECIMAL(12,4))) AS DECIMAL(10,2)),
    -- dias de cobertura = cuantos dias de venta cubre el stock que hay en gondola
    DiasCobertura    = CAST(AVG(CAST(f.StockDisponible AS DECIMAL(12,4)))
                          / NULLIF(AVG(CAST(f.CantidadVendida AS DECIMAL(12,4))), 0) AS DECIMAL(6,2)),
    TasaQuiebrePct   = CAST(100.0 * SUM(CAST(f.EsQuiebre AS INT)) / COUNT(*) AS DECIMAL(5,2))
FROM Fact_Stock f
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal'
GROUP BY s.NombreSucursal, s.Zona
ORDER BY DiasCobertura DESC;

PRINT '';
PRINT '=== CONTROL DE SEMI-ADITIVIDAD (por que StockDisponible NO se suma en el tiempo) ===';
SELECT
    N'1. SUM sobre los 731 dias (INCORRECTO)' AS Lectura,
    SUM(CAST(f.StockDisponible AS BIGINT))    AS Unidades
FROM Fact_Stock f
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal'
UNION ALL
SELECT
    N'2. Stock del ultimo dia (CORRECTO = LastNonEmpty)',
    SUM(CAST(f.StockDisponible AS BIGINT))
FROM Fact_Stock f
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal'
  AND f.IdTiempo = (SELECT MAX(IdTiempo) FROM Dim_Tiempo)
UNION ALL
SELECT
    N'3. Stock promedio diario (alternativa valida)',
    CAST(AVG(CAST(f.StockDisponible AS DECIMAL(18,4))) * 180 AS BIGINT)
FROM Fact_Stock f
JOIN Dim_Sucursal s ON s.IdSucursal = f.IdSucursal
WHERE s.TipoUbicacion = N'Sucursal';
GO

PRINT '';
PRINT '>>> MiniRed_DW creada y poblada.';
GO

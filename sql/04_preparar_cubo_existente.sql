/* Prepara una MiniRed_DW ya creada para el cubo y su backend MDX. */
USE MiniRed_DW;
GO

IF COL_LENGTH('dbo.Fact_Stock', 'EsSobrestock') IS NULL
    ALTER TABLE dbo.Fact_Stock
      ADD EsSobrestock TINYINT NULL;
GO

UPDATE dbo.Fact_Stock
   SET EsSobrestock = CASE WHEN StockDisponible > StockMinimo * 2 THEN 1 ELSE 0 END
 WHERE EsSobrestock IS NULL;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Fact_Stock')
      AND name = N'EsSobrestock'
      AND is_nullable = 1
)
    ALTER TABLE dbo.Fact_Stock
      ALTER COLUMN EsSobrestock TINYINT NOT NULL;
GO

IF COL_LENGTH('dbo.Fact_Stock', 'ValorInventario') IS NULL
    ALTER TABLE dbo.Fact_Stock
      ADD ValorInventario DECIMAL(14,2) NULL;
GO

UPDATE s
   SET ValorInventario = CAST(s.StockDisponible * p.CostoUnitario AS DECIMAL(14,2))
FROM dbo.Fact_Stock s
JOIN dbo.Dim_Producto p ON p.IdProducto = s.IdProducto
WHERE s.ValorInventario IS NULL;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Fact_Stock')
      AND name = N'ValorInventario'
      AND is_nullable = 1
)
    ALTER TABLE dbo.Fact_Stock
      ALTER COLUMN ValorInventario DECIMAL(14,2) NOT NULL;
GO

IF SUSER_ID(N'NT Service\MSOLAP$SSAS') IS NULL
    CREATE LOGIN [NT Service\MSOLAP$SSAS] FROM WINDOWS;
GO

IF USER_ID(N'NT Service\MSOLAP$SSAS') IS NULL
    CREATE USER [NT Service\MSOLAP$SSAS] FOR LOGIN [NT Service\MSOLAP$SSAS];
GO

IF IS_ROLEMEMBER(N'db_datareader', N'NT Service\MSOLAP$SSAS') <> 1
    ALTER ROLE db_datareader ADD MEMBER [NT Service\MSOLAP$SSAS];
GO

SELECT EsSobrestock, Filas = COUNT_BIG(*)
FROM dbo.Fact_Stock
GROUP BY EsSobrestock
ORDER BY EsSobrestock;
GO

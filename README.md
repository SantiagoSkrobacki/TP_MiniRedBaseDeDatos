# TP MiniRed — Data Detective & Landing Page Challenge

Trabajo práctico de **Unidad 3: Minería de Datos, Proceso KDD y Modelado Dimensional**.

Caso de estudio: la cadena de minimercados **MiniRed S.A.** necesita transformar sus datos
transaccionales en conocimiento para la toma de decisiones. Nuestro equipo actúa como
consultora analítica: construimos el data warehouse, armamos el cubo dimensional,
extraemos reglas de negocio y las comunicamos en una landing page y un pitch ejecutivo.

## Perspectiva elegida

**Opción B — Logística e Inventario.**

Nos enfocamos en la prevención de quiebres de stock y la rotación de productos en sucursales.
No analizamos ventas ni promociones (Opción A) ni expansión territorial (Opción C).

Las dos preguntas que responde el trabajo:

1. ¿Dónde y cuándo se queda MiniRed sin mercadería en góndola?
2. ¿Dónde hay capital inmovilizado en stock que no rota?

---

## Estado del trabajo

### Hecho

| # | Avance | Detalle |
|---|--------|---------|
| 1 | **Data warehouse construido** | La cátedra define el esquema pero no entrega la base. La creamos y poblamos: 2 años (2024-2025), 6 sucursales + depósito Central, 30 productos, 731 días. |
| 2 | **Modelo en constelación** | `Fact_Ventas` (315.969 líneas de ticket) + `Fact_Stock` (153.510 snapshots diarios), unidas por tres dimensiones conformadas: Tiempo, Sucursal y Producto. |
| 3 | **Integridad verificada** | Las dos tablas de hechos cierran en 1.372.990 unidades — el drill-across "vendido vs. ingresado" es real. Sin stock negativo, sin huérfanos, sin violaciones de FK. |
| 4 | **Misión 1 · Data Audit** | Diccionario de variables continuas vs. discretas, perfilado estadístico y controles de calidad. |
| 5 | **Misión 2 · Cube Master** | Agregación multidimensional con `GROUPING SETS` (roll-up y drill-down con subtotales) y demostración del error de agregación por semi-aditividad. |
| 6 | **Misión 3 · Pattern Hunter** | 4 reglas inductivas extraídas y validadas con soporte, confianza, lift y hold-out temporal. Más un contraejemplo de correlación espuria. |
| 7 | **Entorno SSAS listo** | SQL Server 2025 + Analysis Services en modo **Multidimensional**, y la extensión de proyectos de Analysis Services en Visual Studio 2022. |
| 8 | **Guía de construcción del cubo** | Procedimiento de 10 fases adaptado a MiniRed, en `docs/guia-cubo-ssas.html`. |
| 9 | **Datos exportados para la landing** | `data/datos_landing.json` con KPIs, heatmap, serie mensual, SKU críticos y semáforo por sucursal. |

### Pendiente

- [ ] Construir el cubo en SSAS siguiendo `docs/guia-cubo-ssas.html`
- [ ] Landing page — portal de operaciones para gerentes de abastecimiento
- [ ] Redacción de los 6 puntos teóricos del informe
- [ ] Pitch ejecutivo de 10 minutos

---

## Requisitos

- SQL Server 2019 o superior (probado en **SQL Server 2025 Developer**)
- SQL Server Management Studio
- Para el cubo: **Analysis Services en modo Multidimensional** + Visual Studio con la
  extensión *Microsoft Analysis Services Projects*

## Cómo levantar la base

Desde SSMS, abrir y ejecutar en orden:

1. **`sql/01_MiniRed_DW_crear_y_poblar.sql`** — crea `MiniRed_DW`, el modelo en constelación
   y carga los datos. Al final imprime la verificación de los patrones. Tarda unos minutos.
2. **`sql/02_MiniRed_consultas_analiticas.sql`** — ejecuta las tres misiones analíticas y
   crea la vista `vw_Cubo_Logistica` y el procedimiento `sp_LandingDataJson`.

Desde la línea de comandos:

```
sqlcmd -S localhost -E -f 65001 -i sql\01_MiniRed_DW_crear_y_poblar.sql
sqlcmd -S localhost -E -f 65001 -i sql\02_MiniRed_consultas_analiticas.sql
```

Para regenerar el JSON de la landing (usar `bcp`, no `sqlcmd`: este último agrega
encabezados y recorta el ancho, lo que rompe el JSON):

```
bcp "EXEC MiniRed_DW.dbo.sp_LandingDataJson" queryout data\datos_landing.json -S localhost -T -c -C 65001
```

Para deshacer todo: `DROP DATABASE MiniRed_DW;`

---

## Estructura del repositorio

```
sql/
  01_MiniRed_DW_crear_y_poblar.sql    DDL + carga de datos + verificación de patrones
  02_MiniRed_consultas_analiticas.sql Las tres misiones + export para la landing
data/
  datos_landing.json                  Datasets que consume la landing page
docs/
  guia-cubo-ssas.html                 Guía de 10 fases para construir el cubo
```

## El modelo

**Constelación** (dos procesos de negocio que comparten dimensiones):

| Tabla | Tipo | Grano |
|-------|------|-------|
| `Fact_Ventas` | Hechos | 1 línea de ticket |
| `Fact_Stock` | Hechos | 1 snapshot diario por sucursal y producto |
| `Dim_Tiempo` | Conformada | 1 día |
| `Dim_Sucursal` | Conformada | 1 sucursal o depósito |
| `Dim_Producto` | Conformada | 1 producto |
| `Dim_Cajero` | Sólo ventas | 1 cajero |
| `Dim_MedioPago` | Sólo ventas | 1 medio de pago |

`Dim_Cajero` y `Dim_MedioPago` no aplican a `Fact_Stock`: el ingreso de mercadería no pasa
por caja. Esa asimetría es la prueba de que el stock es un proceso de negocio distinto y no
una columna más en `Fact_Ventas`.

### La medida clave

**`StockDisponible` es semi-aditiva.** Si hay 10 unidades el lunes y 10 el martes, no hay 20:
es la misma góndola fotografiada dos veces. Se suma por sucursal y por producto, nunca por tiempo.

Sobre los 731 días de la base la diferencia es medible:

| Lectura | Unidades |
|---------|----------|
| `SUM` sobre todo el período (incorrecto) | 6.159.125 |
| Stock del último día (`LastNonEmpty`) | 8.161 |

En SSAS hay que configurar `AggregateFunction = LastNonEmpty`. El asistente deja `Sum` por defecto.

`TicketPromedio` es **no aditiva** y nunca se almacena: se calcula como
`SUM(ImporteTotal) / COUNT(DISTINCT IdTicket)`.

---

## Reglas inductivas encontradas

Extraídas sobre 2024 y validadas contra 2025 (hold-out temporal). El **lift** indica cuántas
veces más probable es el resultado cuando se cumple la condición: un lift de 1 sería ruido.

| Regla | Confianza | Lift | Hold-out 2024 → 2025 |
|-------|-----------|------|----------------------|
| **R1** · Bebidas + Zona Oeste → quiebre | 19,34 % | 1,91 | 19,28 → 19,40 ✅ |
| **R2** · Proveedor Arcor (ciclo 14 días) → quiebre | 9,69 % | 2,60 | 9,56 → 9,82 ✅ |
| **R3** · Congelados + Verano → quiebre | 27,03 % | 3,97 | 26,42 → 27,64 ✅ |
| **R4** · Sucursal San Justo → sobrestock | 49,95 % | 1,62 | 50,16 → 49,74 ✅ |

Las cuatro se mantienen estables entre el año de inducción y el de validación (desvío menor a
1,3 puntos porcentuales), lo que descarta sobreajuste.

### Contraejemplo: correlación espuria

| Proveedor | Tasa de quiebre global | Excluyendo zona Oeste |
|-----------|------------------------|------------------------|
| Coca-Cola Andina | 10,77 % | **0,78 %** |
| Arcor | 9,69 % | **11,49 %** |

Coca-Cola encabeza el ranking de quiebres, pero al controlar por zona el efecto **desaparece**:
nunca fue el proveedor, era la zona. En Arcor ocurre lo contrario, el efecto se refuerza — ahí
sí hay un problema real de ciclo de reposición.

Atribuir el problema al proveedor equivocado llevaría a renegociar el contrato incorrecto.

---

## Nota sobre los datos

**Los datos de `MiniRed_DW` son simulados.** La cátedra define el esquema del caso pero no
entrega la base, así que la generamos nosotros con patrones de negocio plantados
deliberadamente y documentados en la cabecera de `01_MiniRed_DW_crear_y_poblar.sql`.

Esto se declara explícitamente y no se presenta como dato real. Un dataset generado al azar no
contendría ninguna regla que descubrir; plantar comportamientos realistas es lo que permite
ejercitar el proceso KDD completo. La contrapartida —que la validación estadística no alcanza
por sí sola y todo hallazgo debe contrastarse contra la lógica del negocio— es justamente el
punto teórico 5 de la consigna.

La generación es **reproducible**: el ruido se calcula con `CHECKSUM` sobre las claves, así que
dos ejecuciones del script producen exactamente los mismos números.

# Portal de Abastecimiento — frontend

Landing page del TP: portal de operaciones y logística de MiniRed S.A., para
gerentes de abastecimiento. Perspectiva **B — Logística e Inventario**.

Sin dependencias ni build. HTML, CSS y JavaScript planos.

```
landing/
  index.html         estructura de la consola
  styles.css         tokens de tema y componentes
  app.js             capa de datos, agregación y gráficos (SVG a mano)
  data/portal.json   datos que consume el portal (generado)
  seed-data.js       copia embebida de esos datos (generado, no editar)
  build-seed.py      regenera seed-data.js desde data/portal.json
```

> Este módulo es **autocontenido**. No modifica `sql/01`, `sql/02` ni
> `data/datos_landing.json`: su API vive en `sql/03_portal_api.sql`, que sólo
> agrega el procedimiento `sp_PortalDashboard`. El `sp_LandingDataJson` original
> sigue intacto y funcionando.

## Cómo abrirlo

**Opción rápida** — doble clic en `index.html`. Funciona con `file://` gracias a
la copia embebida.

**Opción recomendada** — servirlo, así también lee el JSON del repo:

```
python -m http.server 8777
```

y abrir <http://127.0.0.1:8777/landing/index.html>.

El badge de la barra superior dice de dónde salieron los datos que estás viendo:
`datos en vivo` (backend), `archivo local` (JSON) o `copia embebida` (seed).

## Capa de datos

`app.js` pide los datos en orden y se queda con el primero que responde:

| # | Origen | Cuándo aplica |
|---|--------|---------------|
| 1 | `GET {API_BASE}/dashboard` | cuando exista el backend |
| 2 | `landing/data/portal.json` | servido por HTTP |
| 3 | `window.__MINIRED_SEED__` | `file://`, sin servidor — respaldo para la demo |

Los tres devuelven **el mismo documento**: el que produce
`MiniRed_DW.dbo.sp_PortalDashboard` (ver `sql/03_portal_api.sql`). Para conectar
el backend alcanza con cambiar `API_BASE` en la primera línea de `app.js`.

### Contrato

```jsonc
{
  "meta":         { "desde", "hasta", "ultimaFecha", "dias", "sucursales", "productos", "observaciones" },
  "serie":        [ { "anio", "mes", "mesNombre", "zona", "categoria",
                      "observaciones", "quiebres", "unidades", "stock" } ],
  "sucursales":   [ { "sucursal", "zona", "categoria", "observaciones", "quiebres",
                      "bajoMinimo", "unidades", "stockProm", "ventaProm",
                      "valorInv", "reposPend", "combinaciones" } ],
  "productos":    [ { "producto", "categoria", "rubro", "proveedor", "diasRepos",
                      "zona", "observaciones", "quiebres", "unidades", "valorInv" } ],
  "porDiaSemana": [ { "dia", "orden", "zona", "categoria", "observaciones", "quiebres" } ],
  "proveedores":  [ { "proveedor", "categoria", "diasRepos", "tasaGlobal", "tasaSinOeste" } ],
  "reglas":       [ { "id", "regla", "accion", "casos", "antecedente",
                      "soporte", "confianza", "base", "lift", "conf2024", "conf2025" } ]
}
```

**Por qué cada fila trae conteos y no sólo la tasa.** Los filtros de zona y
categoría reagregan en el navegador. Promediar las tasas de subgrupos de
distinto tamaño da un número equivocado; sumar `quiebres` y `observaciones` y
recién ahí dividir, no. Lo mismo con los días de cobertura, que se calculan
ponderando `stockProm` y `ventaProm` por las observaciones de cada fila.

### Backend

El endpoint sólo tiene que devolver lo que ya arma el procedimiento. Ejemplo
mínimo con Node y `mssql`:

```js
app.get("/api/dashboard", async (req, res) => {
  const pool = await sql.connect(config);            // config apunta a MiniRed_DW
  const r = await pool.request().execute("sp_PortalDashboard");
  res.type("application/json").send(r.recordset[0].datos);
});
```

`sp_PortalDashboard` ya devuelve el JSON serializado en una única columna
`datos`, así que no hace falta re-serializar nada.

### Backend en otro origen (por ejemplo, portal en GitHub Pages)

Poner en `API_BASE` la URL completa del backend:

```js
const API_BASE = "https://minired-api.example.com/api";
```

Con una API absoluta el portal la consulta siempre, incluso desde Pages. Del
lado del backend hacen falta dos cosas:

1. **CORS.** El navegador bloquea la respuesta si el backend no declara que
   acepta pedidos desde el origen de la página:
   `Access-Control-Allow-Origin: https://<usuario>.github.io`
2. **HTTPS.** Pages sirve por HTTPS y una página HTTPS no puede consultar un
   backend HTTP: el navegador lo bloquea como contenido mixto, sin importar
   qué diga el backend.

Y el backend tiene que **poder llegar a SQL Server**. Un servidor en la nube no
alcanza una base que corre en una notebook: o la base también está publicada, o
se expone el backend local con un túnel (ngrok, Cloudflare Tunnel), que además
resuelve el HTTPS.

## Regenerar los datos

```
sqlcmd -S localhost -E -f 65001 -i sql/03_portal_api.sql
bcp "EXEC MiniRed_DW.dbo.sp_PortalDashboard" queryout landing/data/portal.json -S localhost -T -c -C 65001
python landing/build-seed.py
```

Se usa `bcp` y no `sqlcmd` porque este último agrega encabezados y recorta el
ancho de línea, y eso rompe el JSON.

## Decisiones de diseño

**Filtros.** Una sola fila arriba que gobierna todo el panel operativo. La
sección de hallazgos queda deliberadamente fuera: las reglas están validadas
sobre el período completo y el control de correlación espuria necesita comparar
con y sin la zona Oeste, así que filtrarlos los invalidaría. Está rotulado.

**Colores.** Paleta de datos validada con el verificador de accesibilidad: el
par azul/naranja de la comparación de proveedores pasa los controles de
separación para daltonismo en tema claro y oscuro. La rampa del mapa de calor es
un solo tono de claro a oscuro. Los colores de estado (bueno / atención / alto /
crítico) están reservados, nunca se usan como color de serie, y siempre viajan
con ícono y etiqueta para que el significado no dependa del color.

**Sin eje doble.** La evolución mensual son dos gráficos apilados que comparten
el eje de meses. Superponer tasa de quiebre y unidades vendidas en un solo eje
alinearía dos escalas arbitrarias e inventaría una correlación que los datos no
tienen.

**Vista de tabla.** Cada gráfico tiene su equivalente en tabla, para lectura con
lector de pantalla y para copiar valores al informe.

**Nombres.** La base guarda los textos sin tildes a propósito, para evitar
problemas de codificación en `sqlcmd`/`bcp` y en el procesamiento del cubo. El
mapa `LINDO` de `app.js` se las devuelve sólo para mostrarlos; no toca el dato.

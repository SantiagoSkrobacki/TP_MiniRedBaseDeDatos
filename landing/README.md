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

La landing es estática. El modo en vivo depende del backend local de `backend/`,
que consulta el cubo SSAS mediante MDX. `sql/03_portal_api.sql` queda únicamente
como referencia relacional y respaldo de resultados.

## Cómo abrirlo

**Opción rápida** — doble clic en `index.html`. Funciona con `file://` gracias a
la copia embebida.

**Opción recomendada** — servirlo, así también lee el JSON del repo:

```
python -m http.server 8777
```

y abrir <http://127.0.0.1:8777/landing/index.html>.

El badge de la barra superior dice de dónde salieron los datos que estás viendo:
`archivo local` (JSON, predeterminado), `copia embebida` (seed) o `datos en vivo`
si el usuario conecta manualmente con SSAS.

## Capa de datos

`app.js` carga los datos estáticos en este orden:

| # | Origen | Cuándo aplica |
|---|--------|---------------|
| 1 | `landing/data/portal.json` | origen predeterminado cuando se sirve por HTTP |
| 2 | `window.__MINIRED_SEED__` | `file://` o JSON inaccesible |

La API no se consulta durante la carga inicial. El botón **Conectar a SSAS**
solicita manualmente `GET http://127.0.0.1:5050/api/dashboard` y cambia el origen
a `datos en vivo` si la conexión tiene éxito.

Los tres devuelven **el mismo documento**. En vivo, todos los valores numéricos
se obtienen del cubo; los filtros se aplican luego en el navegador.

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

### Backend local y GitHub Pages

GitHub Pages sólo aloja los archivos estáticos y funciona normalmente con
`portal.json`, sin backend. Para una demostración opcional en vivo, ejecutar
`backend/iniciar-backend.bat`, comprobar
<http://127.0.0.1:5050/api/health> y pulsar **Conectar a SSAS**. Chrome puede
pedir permiso para que la página acceda a la red local; hay que aceptarlo.

La API escucha sólo en loopback, permite CORS y responde 503 si SSAS o el cubo
no están disponibles. Su configuración está en `backend/appsettings.json`.

## Regenerar los datos

```powershell
powershell -ExecutionPolicy Bypass -File scripts/actualizar-respaldo.ps1
```

El backend debe estar activo. El script consulta `/api/dashboard` y actualiza
en una sola operación `data/portal.json` y `seed-data.js`.

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
